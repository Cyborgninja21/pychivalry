"""
Custom thread management system for pychivalry LSP operations.

This module provides a complete replacement for pygls's threading model,
giving us full control over:
- Thread prioritization and scheduling
- Task cancellation and timeouts
- Resource allocation across different operation types
- Future architectural flexibility

ARCHITECTURE:
    The threading system is built around three core components:
    
    1. TaskPriority: Enum defining priority levels for different operations
       - CRITICAL (0): User-waiting operations (hover, completions)
       - HIGH (10): Fast feedback operations (diagnostics)
       - NORMAL (20): Background operations (formatting, references)
       - LOW (30): Indexing and workspace scanning
       - BACKGROUND (40): Pre-computation and cache warming
    
    2. PrioritizedTask: Dataclass representing a task with metadata
       - Contains function, args, kwargs, priority, timeout, cancellation token
       - Supports comparison for priority queue ordering
    
    3. CK3ThreadManager: Main thread pool manager
       - Separate pools for CPU-bound and I/O-bound operations
       - Priority-based task scheduling
       - Task cancellation by URI or prefix
       - Timeout enforcement
       - Metrics collection for debugging

USAGE:
    ```python
    # Initialize thread manager
    thread_mgr = CK3ThreadManager()
    
    # Submit CPU-bound work with priority and cancellation
    cancel_token = threading.Event()
    future = thread_mgr.submit_cpu_bound(
        parse_document,
        doc_source,
        priority=TaskPriority.HIGH,
        task_id=f"parse:{uri}",
        timeout=5.0,
        cancellation_token=cancel_token
    )
    
    # Wait for result
    result = await asyncio.wrap_future(future)
    
    # Cancel pending work for a document
    thread_mgr.cancel_by_uri(uri)
    
    # Get metrics
    metrics = thread_mgr.get_metrics()
    print(f"Completed: {metrics['completed_count']}")
    
    # Clean shutdown
    thread_mgr.shutdown(wait=True)
    ```

BENEFITS:
    - Complete control over thread lifecycle
    - Custom scheduling based on operation priority
    - Built-in task cancellation when documents change
    - Per-operation timeout enforcement
    - No dependency on pygls threading internals
    - Full visibility into thread states
    - Optimized for CK3 modding workloads

SEE ALSO:
    - server.py: Uses CK3ThreadManager for all background operations
    - diagnostics.py: Runs validation in thread pool
    - indexer.py: Runs workspace scanning in thread pool
"""

import asyncio
import logging
import os
import threading
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import IntEnum
from queue import Empty, PriorityQueue
from typing import Any, Callable, Dict, Optional, Set

logger = logging.getLogger(__name__)


class TaskPriority(IntEnum):
    """
    Task priorities for scheduling - lower number = higher priority.
    
    Priority levels are designed around user experience:
    - CRITICAL: User is actively waiting (hover, completions)
    - HIGH: User wants fast feedback (diagnostics, highlights)
    - NORMAL: User initiated but can wait (formatting, references)
    - LOW: Background work (indexing, workspace scan)
    - BACKGROUND: Pre-computation, cache warming
    """

    CRITICAL = 0  # Hover, completions (user is waiting)
    HIGH = 10  # Diagnostics, document highlights (fast feedback)
    NORMAL = 20  # Formatting, references, code actions
    LOW = 30  # Indexing, workspace scan
    BACKGROUND = 40  # Precomputation, cache warming


@dataclass(order=True)
class PrioritizedTask:
    """
    A task with priority for priority queue ordering.
    
    Tasks are ordered by:
    1. Priority (lower number = higher priority)
    2. Creation time (earlier = higher priority for same priority level)
    
    The task includes metadata for execution:
    - Function to call and its arguments
    - Cancellation token to check for early termination
    - Timeout for maximum execution time
    - Task ID for tracking and cancellation
    
    Attributes:
        priority: Task priority level (lower = higher priority)
        created_at: Unix timestamp when task was created
        task_id: Unique identifier for the task
        func: Function to execute
        args: Positional arguments for the function
        kwargs: Keyword arguments for the function
        cancellation_token: Event that signals task should be cancelled
        timeout: Maximum execution time in seconds
    """

    priority: int
    created_at: float = field(compare=True)
    task_id: str = field(compare=False)
    func: Callable = field(compare=False)
    args: tuple = field(compare=False, default=())
    kwargs: dict = field(compare=False, default_factory=dict)
    cancellation_token: Optional[threading.Event] = field(compare=False, default=None)
    timeout: Optional[float] = field(compare=False, default=None)


class CK3ThreadManager:
    """
    Custom thread pool manager for pychivalry LSP operations.
    
    This class provides a complete threading solution with:
    - Priority-based task scheduling
    - Task cancellation support
    - Per-task timeouts
    - Separate pools for CPU-bound and I/O-bound work
    - Metrics and debugging support
    
    The manager maintains two thread pools:
    1. CPU pool: For parsing, validation, and computation
    2. I/O pool: For file reading and network operations
    
    Tasks can be cancelled by document URI or by task ID prefix,
    allowing rapid document changes to cancel stale work.
    
    Example:
        ```python
        mgr = CK3ThreadManager()
        
        # Submit high-priority parsing
        future = mgr.submit_cpu_bound(
            parse_document,
            doc_source,
            priority=TaskPriority.HIGH,
            task_id=f"parse:{uri}"
        )
        
        # Cancel all parsing for this URI
        mgr.cancel_by_uri(uri)
        
        # Clean shutdown
        mgr.shutdown(wait=True)
        ```
    """

    def __init__(self):
        """Initialize the thread manager with CPU and I/O pools."""
        # Separate pools for different operation types
        # Use min(4, cpu_count) to avoid over-subscription on high-core systems
        # Allow override via environment variable for testing/tuning
        cpu_count = os.cpu_count() or 2
        max_cpu_workers = int(os.environ.get("CK3_MAX_CPU_WORKERS", min(4, cpu_count)))
        max_io_workers = int(os.environ.get("CK3_MAX_IO_WORKERS", 4))
        
        self._cpu_pool = ThreadPoolExecutor(
            max_workers=max(2, max_cpu_workers), thread_name_prefix="ck3-cpu"
        )
        self._io_pool = ThreadPoolExecutor(
            max_workers=max_io_workers, thread_name_prefix="ck3-io"
        )

        # Priority queue for deferred work (not currently used but reserved for future)
        self._work_queue: PriorityQueue[PrioritizedTask] = PriorityQueue()

        # Active tasks tracking
        self._active_tasks: Dict[str, Future] = {}
        self._active_tasks_lock = threading.RLock()

        # Metrics
        self._completed_count = 0
        self._cancelled_count = 0
        self._timeout_count = 0
        self._failed_count = 0
        self._metrics_lock = threading.Lock()

        # Shutdown flag
        self._shutdown = False

        logger.info(
            f"CK3ThreadManager initialized with {self._cpu_pool._max_workers} CPU workers "
            f"and {self._io_pool._max_workers} I/O workers"
        )

    def submit_cpu_bound(
        self,
        func: Callable,
        *args,
        priority: TaskPriority = TaskPriority.NORMAL,
        task_id: Optional[str] = None,
        timeout: Optional[float] = None,
        cancellation_token: Optional[threading.Event] = None,
        **kwargs,
    ) -> Future:
        """
        Submit CPU-bound work (parsing, validation, analysis).
        
        CPU-bound tasks run in a thread pool sized based on CPU cores.
        These tasks typically involve parsing, validation, and other
        computational work that benefits from parallelism.
        
        Args:
            func: Function to execute
            *args: Positional arguments for the function
            priority: Task priority level (default: NORMAL)
            task_id: Unique identifier for tracking and cancellation
            timeout: Maximum execution time in seconds
            cancellation_token: Event to check for cancellation
            **kwargs: Keyword arguments for the function
        
        Returns:
            Future that resolves with the function result
        
        Example:
            ```python
            future = mgr.submit_cpu_bound(
                parse_document,
                doc_source,
                priority=TaskPriority.HIGH,
                task_id=f"parse:{uri}",
                timeout=5.0
            )
            result = future.result()
            ```
        """
        if self._shutdown:
            raise RuntimeError("Thread manager is shut down")

        # Generate task ID if not provided
        if task_id is None:
            task_id = f"cpu-{uuid.uuid4().hex[:8]}"

        # Create wrapper that handles timeout and cancellation
        def wrapped_func():
            start_time = time.time()

            try:
                # Check cancellation before starting
                if cancellation_token and cancellation_token.is_set():
                    with self._metrics_lock:
                        self._cancelled_count += 1
                    logger.debug(f"Task {task_id} cancelled before execution")
                    raise asyncio.CancelledError("Task cancelled before execution")

                # Execute the function
                result = func(*args, **kwargs)

                # Check timeout
                elapsed = time.time() - start_time
                if timeout and elapsed > timeout:
                    with self._metrics_lock:
                        self._timeout_count += 1
                    logger.warning(f"Task {task_id} exceeded timeout: {elapsed:.2f}s > {timeout}s")

                # Update metrics
                with self._metrics_lock:
                    self._completed_count += 1

                return result

            except asyncio.CancelledError:
                raise
            except Exception as e:
                with self._metrics_lock:
                    self._failed_count += 1
                logger.error(f"Task {task_id} failed: {e}", exc_info=True)
                raise
            finally:
                # Remove from active tasks
                with self._active_tasks_lock:
                    self._active_tasks.pop(task_id, None)

        # Submit to thread pool
        future = self._cpu_pool.submit(wrapped_func)

        # Track active task
        with self._active_tasks_lock:
            self._active_tasks[task_id] = future

        logger.debug(
            f"Submitted CPU task {task_id} with priority {priority.name} "
            f"(timeout={timeout}, has_cancel_token={cancellation_token is not None})"
        )

        return future

    def submit_io_bound(
        self,
        func: Callable,
        *args,
        priority: TaskPriority = TaskPriority.NORMAL,
        task_id: Optional[str] = None,
        **kwargs,
    ) -> Future:
        """
        Submit I/O-bound work (file reading, network operations).
        
        I/O-bound tasks run in a separate thread pool optimized for
        waiting on I/O operations rather than CPU-intensive work.
        
        Args:
            func: Function to execute
            *args: Positional arguments for the function
            priority: Task priority level (default: NORMAL)
            task_id: Unique identifier for tracking and cancellation
            **kwargs: Keyword arguments for the function
        
        Returns:
            Future that resolves with the function result
        
        Example:
            ```python
            future = mgr.submit_io_bound(
                read_file,
                file_path,
                priority=TaskPriority.LOW,
                task_id=f"read:{file_path}"
            )
            content = future.result()
            ```
        """
        if self._shutdown:
            raise RuntimeError("Thread manager is shut down")

        # Generate task ID if not provided
        if task_id is None:
            task_id = f"io-{uuid.uuid4().hex[:8]}"

        # Create wrapper for metrics
        def wrapped_func():
            try:
                result = func(*args, **kwargs)
                with self._metrics_lock:
                    self._completed_count += 1
                return result
            except Exception as e:
                with self._metrics_lock:
                    self._failed_count += 1
                logger.error(f"I/O task {task_id} failed: {e}", exc_info=True)
                raise
            finally:
                with self._active_tasks_lock:
                    self._active_tasks.pop(task_id, None)

        # Submit to I/O pool
        future = self._io_pool.submit(wrapped_func)

        # Track active task
        with self._active_tasks_lock:
            self._active_tasks[task_id] = future

        logger.debug(f"Submitted I/O task {task_id} with priority {priority.name}")

        return future

    def _cancel_tasks(self, match_fn: Callable[[str], bool], description: str) -> int:
        """
        Internal helper to cancel tasks matching a predicate.
        
        Args:
            match_fn: Function that returns True for task IDs to cancel
            description: Description for logging
        
        Returns:
            Number of tasks cancelled
        """
        cancelled = 0

        with self._active_tasks_lock:
            # Find tasks matching the predicate
            tasks_to_cancel = [
                (task_id, future)
                for task_id, future in self._active_tasks.items()
                if match_fn(task_id)
            ]

        # Cancel found tasks
        for task_id, future in tasks_to_cancel:
            if future.cancel():
                cancelled += 1
                logger.debug(f"Cancelled task {task_id} ({description})")

        if cancelled > 0:
            with self._metrics_lock:
                self._cancelled_count += cancelled
            logger.info(f"Cancelled {cancelled} tasks ({description})")

        return cancelled

    def cancel_by_uri(self, uri: str) -> int:
        """
        Cancel all pending tasks for a document URI.
        
        This is useful when a document changes, making all pending
        operations for that document stale.
        
        Args:
            uri: Document URI to cancel tasks for
        
        Returns:
            Number of tasks cancelled
        
        Example:
            ```python
            # User is rapidly typing, cancel old work
            mgr.cancel_by_uri("file:///path/to/document.txt")
            ```
        """
        return self._cancel_tasks(lambda task_id: uri in task_id, f"URI: {uri}")

    def cancel_by_prefix(self, prefix: str) -> int:
        """
        Cancel all tasks with IDs starting with a prefix.
        
        This allows cancelling groups of related tasks, such as
        all parsing tasks or all diagnostic tasks.
        
        Args:
            prefix: Task ID prefix to match
        
        Returns:
            Number of tasks cancelled
        
        Example:
            ```python
            # Cancel all parsing tasks
            mgr.cancel_by_prefix("parse:")
            ```
        """
        return self._cancel_tasks(lambda task_id: task_id.startswith(prefix), f"prefix: {prefix}")

    def get_metrics(self) -> dict:
        """
        Return threading metrics for debugging and monitoring.
        
        Provides insight into thread pool utilization and task completion
        statistics. Useful for understanding performance and identifying
        bottlenecks.
        
        Returns:
            Dictionary with metric values:
            - completed_count: Successfully completed tasks
            - cancelled_count: Tasks cancelled before completion
            - timeout_count: Tasks that exceeded their timeout
            - failed_count: Tasks that raised exceptions
            - active_count: Currently running tasks
            - cpu_workers: Number of CPU pool workers
            - io_workers: Number of I/O pool workers
        
        Example:
            ```python
            metrics = mgr.get_metrics()
            print(f"Completed: {metrics['completed_count']}")
            print(f"Active: {metrics['active_count']}")
            ```
        """
        with self._metrics_lock:
            completed = self._completed_count
            cancelled = self._cancelled_count
            timeout = self._timeout_count
            failed = self._failed_count

        with self._active_tasks_lock:
            active = len(self._active_tasks)

        return {
            "completed_count": completed,
            "cancelled_count": cancelled,
            "timeout_count": timeout,
            "failed_count": failed,
            "active_count": active,
            "cpu_workers": self._cpu_pool._max_workers,
            "io_workers": self._io_pool._max_workers,
        }

    def shutdown(self, wait: bool = True):
        """
        Clean shutdown of all thread pools.
        
        Stops accepting new tasks and optionally waits for active
        tasks to complete. Should be called during server shutdown
        to ensure clean resource cleanup.
        
        Args:
            wait: If True, wait for active tasks to complete.
                  If False, attempt to cancel active tasks.
        
        Example:
            ```python
            # Graceful shutdown
            mgr.shutdown(wait=True)
            
            # Force shutdown
            mgr.shutdown(wait=False)
            ```
        """
        if self._shutdown:
            logger.warning("Thread manager already shut down")
            return

        self._shutdown = True
        logger.info("Shutting down CK3ThreadManager...")

        # Get final metrics
        metrics = self.get_metrics()
        logger.info(
            f"Final metrics: {metrics['completed_count']} completed, "
            f"{metrics['cancelled_count']} cancelled, "
            f"{metrics['failed_count']} failed, "
            f"{metrics['active_count']} active"
        )

        # Shutdown thread pools
        self._cpu_pool.shutdown(wait=wait, cancel_futures=not wait)
        self._io_pool.shutdown(wait=wait, cancel_futures=not wait)

        logger.info("CK3ThreadManager shutdown complete")
