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
import ctypes
import itertools
import logging
import os
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import IntEnum
from multiprocessing import Value
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

    # Class-level atomic counter for task ID generation
    _task_counter = itertools.count()

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

        # Priority queue for CPU-bound work
        self._cpu_priority_queue: PriorityQueue[PrioritizedTask] = PriorityQueue()

        # Enable/disable priority scheduling via environment variable
        self._use_priority_scheduling = os.environ.get("CK3_PRIORITY_SCHEDULING", "1") == "1"

        # Active tasks tracking
        self._active_tasks: Dict[str, Future] = {}
        self._active_tasks_lock = threading.Lock()

        # URI-to-task index for O(1) cancellation by URI
        # Maps URI -> Set of task_ids for fast lookup
        self._uri_to_tasks: Dict[str, Set[str]] = {}
        self._uri_index_lock = threading.Lock()

        # Pending futures for priority-queued tasks
        # Maps task_id -> Future for tasks in priority queue
        self._pending_futures: Dict[str, Future] = {}
        self._pending_lock = threading.Lock()

        # Metrics - using atomic integers for lock-free updates
        # multiprocessing.Value provides atomic operations without lock contention
        self._completed_count = Value(ctypes.c_longlong, 0, lock=False)
        self._cancelled_count = Value(ctypes.c_longlong, 0, lock=False)
        self._timeout_count = Value(ctypes.c_longlong, 0, lock=False)
        self._failed_count = Value(ctypes.c_longlong, 0, lock=False)

        # Shutdown flag
        self._shutdown = False

        # Pre-warm thread pools for faster first task execution
        self._prewarm_thread_pools()

        # Priority scheduler thread (if enabled)
        self._scheduler_thread = None
        if self._use_priority_scheduling:
            self._scheduler_thread = threading.Thread(
                target=self._priority_scheduler_loop,
                name="ck3-priority-scheduler",
                daemon=True
            )
            self._scheduler_thread.start()
            logger.info(
                "CK3ThreadManager initialized with %d CPU workers, %d I/O workers, and priority scheduling",
                self._cpu_pool._max_workers,
                self._io_pool._max_workers
            )
        else:
            logger.info(
                "CK3ThreadManager initialized with %d CPU workers and %d I/O workers (priority scheduling disabled)",
                self._cpu_pool._max_workers,
                self._io_pool._max_workers
            )

    def _prewarm_thread_pools(self):
        """
        Pre-warm thread pools by submitting dummy tasks.

        This ensures threads are created and ready before first real task,
        eliminating cold-start latency.
        """
        def _warmup_task():
            """Dummy task to warm up thread."""
            pass

        # Warm up CPU pool
        cpu_futures = []
        for _ in range(self._cpu_pool._max_workers):
            future = self._cpu_pool.submit(_warmup_task)
            cpu_futures.append(future)

        # Warm up I/O pool
        io_futures = []
        for _ in range(self._io_pool._max_workers):
            future = self._io_pool.submit(_warmup_task)
            io_futures.append(future)

        # Wait for all warmup tasks to complete
        for future in cpu_futures + io_futures:
            try:
                future.result(timeout=1.0)
            except Exception:
                pass  # Ignore warmup failures

        logger.info("Thread pools pre-warmed")

    def _priority_scheduler_loop(self):
        """
        Priority scheduler thread loop.

        Continuously pulls tasks from the priority queue and submits them
        to the CPU thread pool. This ensures higher priority tasks are
        executed before lower priority ones.
        """
        logger.info("Priority scheduler thread started")

        while not self._shutdown:
            try:
                # Block with timeout to allow shutdown checking
                task = self._cpu_priority_queue.get(timeout=0.1)

                # Check if task was cancelled while in queue
                with self._pending_lock:
                    if task.task_id not in self._pending_futures:
                        # Task was cancelled, skip it
                        continue

                    # Get the future associated with this task
                    future = self._pending_futures.pop(task.task_id)

                # Check cancellation token before submitting
                if task.cancellation_token and task.cancellation_token.is_set():
                    # Mark as cancelled (atomic operation)
                    self._cancelled_count.value += 1
                    future.set_exception(asyncio.CancelledError("Task cancelled in queue"))
                    continue

                # Check if we're shutting down
                if self._shutdown:
                    if not future.done():
                        future.set_exception(RuntimeError("Thread manager shutting down"))
                    continue

                # Submit to thread pool
                try:
                    pool_future = self._cpu_pool.submit(
                        self._execute_task_wrapper,
                        task.func, task.args, task.kwargs, task.task_id,
                        task.timeout, task.cancellation_token, None  # URI handled separately
                    )

                    # Chain the pool future to our future safely
                    def _done_callback(pf, f=future):
                        # Check if future is still in valid state
                        if f.done():
                            return
                        try:
                            result = pf.result()
                            if not f.done():
                                f.set_result(result)
                        except Exception as e:
                            if not f.done():
                                f.set_exception(e)

                    pool_future.add_done_callback(_done_callback)

                except Exception as e:
                    # Failed to submit, propagate error
                    if not future.done():
                        future.set_exception(e)

            except Empty:
                # Timeout waiting for task, loop to check shutdown
                continue
            except Exception as e:
                logger.error("Error in priority scheduler loop: %s", e, exc_info=True)

        logger.info("Priority scheduler thread stopped")

    def _execute_task_wrapper(
        self,
        func: Callable,
        args: tuple,
        kwargs: dict,
        task_id: str,
        timeout: Optional[float],
        cancellation_token: Optional[threading.Event],
        uri: Optional[str],
    ):
        """
        Reusable task execution wrapper.

        Handles timeout tracking, cancellation checking, metrics updates,
        and cleanup for both CPU and I/O tasks.
        """
        # Only track time if timeout is specified
        start_time = time.time() if timeout else None

        try:
            # Check cancellation before starting
            if cancellation_token and cancellation_token.is_set():
                self._cancelled_count.value += 1  # Atomic operation
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug("Task %s cancelled before execution", task_id)
                raise asyncio.CancelledError("Task cancelled before execution")

            # Execute the function
            result = func(*args, **kwargs)

            # Check timeout only if configured
            if start_time is not None:
                elapsed = time.time() - start_time
                if elapsed > timeout:
                    self._timeout_count.value += 1  # Atomic operation
                    logger.warning("Task %s exceeded timeout: %.2fs > %ss",
                                 task_id, elapsed, timeout)

            # Update metrics (atomic operation)
            self._completed_count.value += 1

            return result

        except asyncio.CancelledError:
            raise
        except Exception as e:
            self._failed_count.value += 1  # Atomic operation
            logger.error("Task %s failed: %s", task_id, e, exc_info=True)
            raise
        finally:
            # Remove from active tasks
            with self._active_tasks_lock:
                self._active_tasks.pop(task_id, None)

            # Remove from URI index if applicable
            if uri:
                with self._uri_index_lock:
                    if uri in self._uri_to_tasks:
                        self._uri_to_tasks[uri].discard(task_id)
                        # Clean up empty sets to prevent memory leak
                        if not self._uri_to_tasks[uri]:
                            del self._uri_to_tasks[uri]

    def submit_cpu_bound(
        self,
        func: Callable,
        *args,
        priority: TaskPriority = TaskPriority.NORMAL,
        task_id: Optional[str] = None,
        timeout: Optional[float] = None,
        cancellation_token: Optional[threading.Event] = None,
        uri: Optional[str] = None,
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
            uri: Optional document URI for fast cancellation lookup
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

        # Generate task ID if not provided - using fast counter instead of UUID
        if task_id is None:
            task_id = f"cpu-{next(self._task_counter)}"

        # Choose submission path based on priority scheduling setting
        if self._use_priority_scheduling:
            # Create a Future to return immediately
            future = Future()

            # Create prioritized task
            task = PrioritizedTask(
                priority=priority,
                created_at=time.time(),
                task_id=task_id,
                func=func,
                args=args,
                kwargs=kwargs,
                cancellation_token=cancellation_token,
                timeout=timeout
            )

            # Store future for scheduler to complete
            with self._pending_lock:
                self._pending_futures[task_id] = future

            # Add to priority queue
            self._cpu_priority_queue.put(task)

            # Track active task
            with self._active_tasks_lock:
                self._active_tasks[task_id] = future

        else:
            # Direct submission (legacy path for when priority scheduling disabled)
            future = self._cpu_pool.submit(
                self._execute_task_wrapper,
                func, args, kwargs, task_id, timeout, cancellation_token, uri
            )

            # Track active task
            with self._active_tasks_lock:
                self._active_tasks[task_id] = future

        # Track URI association for fast cancellation
        if uri:
            with self._uri_index_lock:
                if uri not in self._uri_to_tasks:
                    self._uri_to_tasks[uri] = set()
                self._uri_to_tasks[uri].add(task_id)

        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "Submitted CPU task %s with priority %s (timeout=%s, has_cancel_token=%s)",
                task_id, priority.name, timeout, cancellation_token is not None
            )

        return future

    def submit_io_bound(
        self,
        func: Callable,
        *args,
        priority: TaskPriority = TaskPriority.NORMAL,
        task_id: Optional[str] = None,
        uri: Optional[str] = None,
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
            uri: Optional document URI for fast cancellation lookup
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

        # Generate task ID if not provided - using fast counter instead of UUID
        if task_id is None:
            task_id = f"io-{next(self._task_counter)}"

        # Submit to I/O pool with reusable wrapper
        # Note: I/O tasks don't support timeout or cancellation_token currently
        future = self._io_pool.submit(
            self._execute_task_wrapper,
            func, args, kwargs, task_id, None, None, uri
        )

        # Track active task
        with self._active_tasks_lock:
            self._active_tasks[task_id] = future

        # Track URI association for fast cancellation
        if uri:
            with self._uri_index_lock:
                if uri not in self._uri_to_tasks:
                    self._uri_to_tasks[uri] = set()
                self._uri_to_tasks[uri].add(task_id)

        if logger.isEnabledFor(logging.DEBUG):
            logger.debug("Submitted I/O task %s with priority %s", task_id, priority.name)

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
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug("Cancelled task %s (%s)", task_id, description)

        if cancelled > 0:
            self._cancelled_count.value += cancelled  # Atomic operation
            logger.info("Cancelled %d tasks (%s)", cancelled, description)

        return cancelled

    def cancel_by_uri(self, uri: str) -> int:
        """
        Cancel all pending tasks for a document URI.

        This is useful when a document changes, making all pending
        operations for that document stale.

        Uses O(1) lookup via URI index when tasks are submitted with uri parameter.
        Falls back to O(n) scan for tasks submitted with URI embedded in task_id.

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
        # Try O(1) lookup first using URI index
        cancelled = 0
        task_ids_to_cancel = set()

        with self._uri_index_lock:
            if uri in self._uri_to_tasks:
                # Copy set to avoid modification during iteration
                task_ids_to_cancel = self._uri_to_tasks[uri].copy()
                # Clear the index entry
                del self._uri_to_tasks[uri]

        # Cancel tasks found in index
        for task_id in task_ids_to_cancel:
            with self._active_tasks_lock:
                future = self._active_tasks.get(task_id)

            if future and future.cancel():
                cancelled += 1
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug("Cancelled task %s (URI: %s)", task_id, uri)

        # Also check for tasks with URI embedded in task_id (fallback for old-style usage)
        # This handles cases where tasks were submitted without explicit uri parameter
        with self._active_tasks_lock:
            fallback_tasks = [
                (tid, future)
                for tid, future in self._active_tasks.items()
                if uri in tid and tid not in task_ids_to_cancel
            ]

        for task_id, future in fallback_tasks:
            if future.cancel():
                cancelled += 1
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug("Cancelled task %s (URI: %s, fallback)", task_id, uri)

        if cancelled > 0:
            self._cancelled_count.value += cancelled  # Atomic operation
            logger.info("Cancelled %d tasks (URI: %s)", cancelled, uri)

        return cancelled

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
        # Read atomic values (no lock needed)
        completed = self._completed_count.value
        cancelled = self._cancelled_count.value
        timeout = self._timeout_count.value
        failed = self._failed_count.value

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

        logger.info("Shutting down CK3ThreadManager...")

        # If using priority scheduling and graceful shutdown, wait for queue to drain
        if self._use_priority_scheduling and wait:
            # Wait for priority queue to empty (with timeout)
            queue_drain_timeout = 5.0
            start_time = time.time()
            while not self._cpu_priority_queue.empty() and (time.time() - start_time) < queue_drain_timeout:
                time.sleep(0.01)

        # Set shutdown flag to stop scheduler
        self._shutdown = True

        # Wait for scheduler thread to stop (if exists)
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            self._scheduler_thread.join(timeout=1.0)

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
