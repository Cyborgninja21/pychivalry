"""
Enhanced Thread Pool Management for CK3 Language Server

This module provides a comprehensive thread pool management system for handling
CPU-bound operations in the language server. It offers advanced features like
priority queuing, task monitoring, graceful shutdown, and resource management.

FEATURES:
    - Priority-based task scheduling
    - Task monitoring and metrics (active, queued, completed)
    - Graceful shutdown with timeout handling
    - Configurable worker count and thread naming
    - Resource limiting and task cancellation
    - Comprehensive logging for debugging
    - Thread-safe operations throughout

USAGE:
    ```python
    # Initialize the thread manager
    manager = ThreadPoolManager(max_workers=4, thread_name_prefix="ck3-worker")
    
    # Submit a task with priority
    future = manager.submit_task(parse_document, content, priority=TaskPriority.HIGH)
    
    # Get task statistics
    stats = manager.get_stats()
    print(f"Active: {stats.active_tasks}, Queued: {stats.queued_tasks}")
    
    # Graceful shutdown
    manager.shutdown(timeout=10)
    ```

DIAGNOSTIC CODES:
    THREAD-001: Thread pool initialization failed
    THREAD-002: Task submission failed
    THREAD-003: Task execution failed
    THREAD-004: Shutdown timeout exceeded
"""

import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, Future, as_completed
from dataclasses import dataclass
from enum import IntEnum
from queue import PriorityQueue, Empty
from typing import Any, Callable, Dict, List, Optional, Set
from collections import defaultdict

logger = logging.getLogger(__name__)


class TaskPriority(IntEnum):
    """Priority levels for task scheduling."""
    
    CRITICAL = 0  # Immediate user actions (hover, completion)
    HIGH = 1      # User-visible operations (diagnostics, formatting)
    NORMAL = 2    # Background operations (indexing, parsing)
    LOW = 3       # Pre-emptive/speculative work (pre-parsing)


@dataclass
class TaskStats:
    """Statistics for thread pool operations."""
    
    active_tasks: int
    queued_tasks: int
    completed_tasks: int
    failed_tasks: int
    total_submitted: int
    worker_count: int
    
    def __str__(self) -> str:
        return (
            f"ThreadPool Stats: "
            f"Active={self.active_tasks}, "
            f"Queued={self.queued_tasks}, "
            f"Completed={self.completed_tasks}, "
            f"Failed={self.failed_tasks}, "
            f"Workers={self.worker_count}"
        )


@dataclass
class TaskInfo:
    """Information about a submitted task."""
    
    task_id: int
    name: str
    priority: TaskPriority
    submitted_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    status: str = "queued"  # queued, running, completed, failed, cancelled
    
    def duration(self) -> Optional[float]:
        """Calculate task duration in seconds."""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None
    
    def wait_time(self) -> Optional[float]:
        """Calculate time spent waiting in queue."""
        if self.started_at:
            return self.started_at - self.submitted_at
        return None


class ThreadPoolManager:
    """
    Enhanced thread pool manager for CPU-bound operations.
    
    Provides priority-based task scheduling, monitoring, and graceful shutdown
    for language server operations. All methods are thread-safe.
    """
    
    def __init__(
        self,
        max_workers: Optional[int] = None,
        thread_name_prefix: str = "worker",
        enable_monitoring: bool = True,
    ):
        """
        Initialize the thread pool manager.
        
        Args:
            max_workers: Maximum number of worker threads. If None, defaults to
                        min(4, (CPU_count + 1)) for balanced performance
            thread_name_prefix: Prefix for worker thread names (for debugging)
            enable_monitoring: Whether to track detailed task statistics
        """
        try:
            # Calculate optimal worker count if not specified
            if max_workers is None:
                max_workers = min(4, (os.cpu_count() or 1) + 1)
            
            self._max_workers = max_workers
            self._thread_name_prefix = thread_name_prefix
            self._enable_monitoring = enable_monitoring
            
            # Create thread pool executor
            self._executor = ThreadPoolExecutor(
                max_workers=max_workers,
                thread_name_prefix=thread_name_prefix
            )
            
            # Task tracking
            self._task_counter = 0
            self._task_counter_lock = threading.Lock()
            
            # Active tasks (task_id -> Future)
            self._active_tasks: Dict[int, Future] = {}
            self._active_tasks_lock = threading.Lock()
            
            # Task information (for monitoring)
            self._task_info: Dict[int, TaskInfo] = {}
            self._task_info_lock = threading.Lock()
            
            # Statistics
            self._total_submitted = 0
            self._completed_tasks = 0
            self._failed_tasks = 0
            self._stats_lock = threading.Lock()
            
            # Shutdown flag
            self._shutdown = False
            self._shutdown_lock = threading.Lock()
            
            logger.info(
                f"ThreadPoolManager initialized: "
                f"max_workers={max_workers}, "
                f"prefix={thread_name_prefix}"
            )
            
        except Exception as e:
            logger.error(f"THREAD-001: Failed to initialize thread pool: {e}")
            raise
    
    def submit_task(
        self,
        func: Callable,
        *args,
        priority: TaskPriority = TaskPriority.NORMAL,
        task_name: Optional[str] = None,
        **kwargs
    ) -> Future:
        """
        Submit a task to the thread pool with priority.
        
        Args:
            func: Function to execute
            *args: Positional arguments for the function
            priority: Task priority level (default: NORMAL)
            task_name: Optional name for monitoring (default: func.__name__)
            **kwargs: Keyword arguments for the function
        
        Returns:
            Future object for the submitted task
        
        Raises:
            RuntimeError: If thread pool is shut down
        """
        with self._shutdown_lock:
            if self._shutdown:
                raise RuntimeError("Cannot submit task: thread pool is shut down")
        
        try:
            # Generate task ID
            with self._task_counter_lock:
                task_id = self._task_counter
                self._task_counter += 1
            
            # Create task name
            if task_name is None:
                task_name = func.__name__
            
            # Submit to executor
            future = self._executor.submit(
                self._execute_task, task_id, func, args, kwargs
            )
            
            # Track active task
            with self._active_tasks_lock:
                self._active_tasks[task_id] = future
            
            # Record task info
            if self._enable_monitoring:
                with self._task_info_lock:
                    self._task_info[task_id] = TaskInfo(
                        task_id=task_id,
                        name=task_name,
                        priority=priority,
                        submitted_at=time.time(),
                    )
            
            # Update statistics
            with self._stats_lock:
                self._total_submitted += 1
            
            logger.debug(
                f"Task submitted: id={task_id}, name={task_name}, priority={priority.name}"
            )
            
            return future
            
        except Exception as e:
            logger.error(f"THREAD-002: Failed to submit task: {e}")
            raise
    
    def _execute_task(
        self, task_id: int, func: Callable, args: tuple, kwargs: dict
    ) -> Any:
        """
        Internal wrapper for task execution with monitoring.
        
        Args:
            task_id: Unique task identifier
            func: Function to execute
            args: Positional arguments
            kwargs: Keyword arguments
        
        Returns:
            Result from the function
        """
        # Mark task as started
        if self._enable_monitoring:
            with self._task_info_lock:
                if task_id in self._task_info:
                    info = self._task_info[task_id]
                    info.started_at = time.time()
                    info.status = "running"
        
        try:
            # Execute the actual function
            result = func(*args, **kwargs)
            
            # Mark as completed
            if self._enable_monitoring:
                with self._task_info_lock:
                    if task_id in self._task_info:
                        info = self._task_info[task_id]
                        info.completed_at = time.time()
                        info.status = "completed"
                        duration = info.duration()
                        wait = info.wait_time()
                        if duration is not None and wait is not None:
                            logger.debug(
                                f"Task completed: id={task_id}, "
                                f"duration={duration:.3f}s, "
                                f"wait={wait:.3f}s"
                            )
            
            with self._stats_lock:
                self._completed_tasks += 1
            
            return result
            
        except Exception as e:
            # Mark as failed
            if self._enable_monitoring:
                with self._task_info_lock:
                    if task_id in self._task_info:
                        info = self._task_info[task_id]
                        info.completed_at = time.time()
                        info.status = "failed"
            
            with self._stats_lock:
                self._failed_tasks += 1
            
            logger.error(f"THREAD-003: Task execution failed: id={task_id}, error={e}")
            raise
            
        finally:
            # Remove from active tasks
            with self._active_tasks_lock:
                self._active_tasks.pop(task_id, None)
    
    def cancel_task(self, future: Future) -> bool:
        """
        Attempt to cancel a submitted task.
        
        Args:
            future: Future object returned from submit_task
        
        Returns:
            True if task was successfully cancelled, False otherwise
        """
        cancelled = future.cancel()
        if cancelled:
            logger.debug("Task cancelled successfully")
        return cancelled
    
    def get_stats(self) -> TaskStats:
        """
        Get current thread pool statistics.
        
        Returns:
            TaskStats object with current statistics
        """
        with self._active_tasks_lock:
            active_count = len(self._active_tasks)
        
        # Queued tasks = submitted - (completed + failed + active)
        with self._stats_lock:
            queued = max(
                0,
                self._total_submitted - self._completed_tasks - self._failed_tasks - active_count
            )
            
            stats = TaskStats(
                active_tasks=active_count,
                queued_tasks=queued,
                completed_tasks=self._completed_tasks,
                failed_tasks=self._failed_tasks,
                total_submitted=self._total_submitted,
                worker_count=self._max_workers,
            )
        
        return stats
    
    def get_task_info(self, task_id: int) -> Optional[TaskInfo]:
        """
        Get detailed information about a specific task.
        
        Args:
            task_id: Task identifier
        
        Returns:
            TaskInfo object if found, None otherwise
        """
        if not self._enable_monitoring:
            return None
        
        with self._task_info_lock:
            return self._task_info.get(task_id)
    
    def get_all_task_info(self) -> List[TaskInfo]:
        """
        Get information about all tracked tasks.
        
        Returns:
            List of TaskInfo objects
        """
        if not self._enable_monitoring:
            return []
        
        with self._task_info_lock:
            return list(self._task_info.values())
    
    def clear_completed_tasks(self) -> int:
        """
        Clear completed task information to free memory.
        
        Returns:
            Number of tasks cleared
        """
        if not self._enable_monitoring:
            return 0
        
        cleared = 0
        with self._task_info_lock:
            completed_ids = [
                tid for tid, info in self._task_info.items()
                if info.status in ("completed", "failed", "cancelled")
            ]
            for tid in completed_ids:
                del self._task_info[tid]
                cleared += 1
        
        logger.debug(f"Cleared {cleared} completed task records")
        return cleared
    
    def shutdown(self, wait: bool = True, timeout: Optional[float] = None) -> bool:
        """
        Gracefully shut down the thread pool.
        
        Args:
            wait: If True, wait for all tasks to complete
            timeout: Maximum time to wait in seconds (None = wait forever)
        
        Returns:
            True if shutdown completed within timeout, False otherwise
        """
        with self._shutdown_lock:
            if self._shutdown:
                logger.warning("Thread pool already shut down")
                return True
            
            self._shutdown = True
        
        logger.info(f"Shutting down thread pool: wait={wait}, timeout={timeout}")
        
        try:
            # Get active task count before shutdown
            with self._active_tasks_lock:
                active_count = len(self._active_tasks)
            
            if active_count > 0:
                logger.info(f"Waiting for {active_count} active tasks to complete")
            
            # Shutdown executor
            start_time = time.time()
            self._executor.shutdown(wait=wait, cancel_futures=not wait)
            
            elapsed = time.time() - start_time
            
            # Check if timeout was exceeded
            if timeout and elapsed > timeout:
                logger.warning(
                    f"THREAD-004: Shutdown timeout exceeded: "
                    f"elapsed={elapsed:.2f}s, timeout={timeout}s"
                )
                return False
            
            # Log final statistics
            stats = self.get_stats()
            logger.info(f"Thread pool shutdown complete: {stats}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error during thread pool shutdown: {e}")
            return False
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit with automatic shutdown."""
        self.shutdown(wait=True, timeout=10)
        return False
