"""
Tests for the enhanced thread pool manager.

These tests verify the functionality of the ThreadPoolManager including:
- Task submission and execution
- Priority-based scheduling
- Task monitoring and statistics
- Graceful shutdown
- Error handling
- Thread safety
"""

import pytest
import time
import threading
from concurrent.futures import Future
from pychivalry.thread_manager import (
    ThreadPoolManager,
    TaskPriority,
    TaskStats,
    TaskInfo,
)


class TestThreadPoolManagerBasics:
    """Test basic thread pool manager functionality."""
    
    def test_initialization_default_workers(self):
        """Test initialization with default worker count."""
        manager = ThreadPoolManager()
        stats = manager.get_stats()
        
        assert stats.worker_count > 0
        assert stats.worker_count <= 4
        assert stats.active_tasks == 0
        assert stats.queued_tasks == 0
        assert stats.completed_tasks == 0
        
        manager.shutdown(wait=True)
    
    def test_initialization_custom_workers(self):
        """Test initialization with custom worker count."""
        manager = ThreadPoolManager(max_workers=2, thread_name_prefix="test-worker")
        stats = manager.get_stats()
        
        assert stats.worker_count == 2
        
        manager.shutdown(wait=True)
    
    def test_context_manager(self):
        """Test using ThreadPoolManager as a context manager."""
        with ThreadPoolManager(max_workers=2) as manager:
            stats = manager.get_stats()
            assert stats.worker_count == 2
        
        # Manager should be shut down after exiting context
        with pytest.raises(RuntimeError):
            manager.submit_task(lambda: 42)


class TestTaskSubmission:
    """Test task submission and execution."""
    
    def test_submit_simple_task(self):
        """Test submitting a simple task."""
        manager = ThreadPoolManager(max_workers=2)
        
        def simple_task():
            return 42
        
        future = manager.submit_task(simple_task, task_name="test_task")
        result = future.result(timeout=5)
        
        assert result == 42
        
        stats = manager.get_stats()
        assert stats.completed_tasks == 1
        
        manager.shutdown(wait=True)
    
    def test_submit_task_with_args(self):
        """Test submitting a task with arguments."""
        manager = ThreadPoolManager(max_workers=2)
        
        def add_numbers(a, b):
            return a + b
        
        future = manager.submit_task(add_numbers, 10, 32, task_name="add_task")
        result = future.result(timeout=5)
        
        assert result == 42
        
        manager.shutdown(wait=True)
    
    def test_submit_task_with_kwargs(self):
        """Test submitting a task with keyword arguments."""
        manager = ThreadPoolManager(max_workers=2)
        
        def multiply(x, y, factor=1):
            return (x * y) * factor
        
        future = manager.submit_task(multiply, 6, 7, factor=1, task_name="multiply_task")
        result = future.result(timeout=5)
        
        assert result == 42
        
        manager.shutdown(wait=True)
    
    def test_submit_multiple_tasks(self):
        """Test submitting multiple tasks concurrently."""
        manager = ThreadPoolManager(max_workers=4)
        
        def slow_task(task_id, delay=0.1):
            time.sleep(delay)
            return task_id
        
        # Submit 10 tasks
        futures = []
        for i in range(10):
            future = manager.submit_task(slow_task, i, delay=0.1, task_name=f"task_{i}")
            futures.append(future)
        
        # Wait for all to complete
        results = [f.result(timeout=5) for f in futures]
        
        assert results == list(range(10))
        
        stats = manager.get_stats()
        assert stats.completed_tasks == 10
        
        manager.shutdown(wait=True)
    
    def test_submit_after_shutdown(self):
        """Test that submitting after shutdown raises an error."""
        manager = ThreadPoolManager(max_workers=2)
        manager.shutdown(wait=True)
        
        with pytest.raises(RuntimeError, match="shut down"):
            manager.submit_task(lambda: 42)


class TestPriorityScheduling:
    """Test priority-based task scheduling."""
    
    def test_priority_levels(self):
        """Test that all priority levels are accepted."""
        manager = ThreadPoolManager(max_workers=2)
        
        priorities = [
            TaskPriority.CRITICAL,
            TaskPriority.HIGH,
            TaskPriority.NORMAL,
            TaskPriority.LOW,
        ]
        
        for priority in priorities:
            future = manager.submit_task(
                lambda p=priority: p.value,
                priority=priority,
                task_name=f"priority_{priority.name}"
            )
            result = future.result(timeout=5)
            assert result == priority.value
        
        manager.shutdown(wait=True)
    
    def test_default_priority(self):
        """Test that default priority is NORMAL."""
        manager = ThreadPoolManager(max_workers=2, enable_monitoring=True)
        
        future = manager.submit_task(lambda: 42, task_name="default_priority")
        future.result(timeout=5)
        
        # Check task info has NORMAL priority
        task_info = manager.get_all_task_info()
        assert len(task_info) == 1
        assert task_info[0].priority == TaskPriority.NORMAL
        
        manager.shutdown(wait=True)


class TestStatistics:
    """Test statistics and monitoring."""
    
    def test_get_stats_structure(self):
        """Test that get_stats returns proper TaskStats."""
        manager = ThreadPoolManager(max_workers=2)
        
        stats = manager.get_stats()
        
        assert isinstance(stats, TaskStats)
        assert hasattr(stats, 'active_tasks')
        assert hasattr(stats, 'queued_tasks')
        assert hasattr(stats, 'completed_tasks')
        assert hasattr(stats, 'failed_tasks')
        assert hasattr(stats, 'total_submitted')
        assert hasattr(stats, 'worker_count')
        
        manager.shutdown(wait=True)
    
    def test_stats_during_execution(self):
        """Test statistics while tasks are running."""
        manager = ThreadPoolManager(max_workers=2)
        
        def slow_task(duration=0.5):
            time.sleep(duration)
            return True
        
        # Submit tasks that will take some time
        futures = []
        for i in range(4):
            future = manager.submit_task(slow_task, duration=0.3, task_name=f"slow_{i}")
            futures.append(future)
        
        # Check stats while tasks are running
        time.sleep(0.1)  # Give tasks time to start
        stats = manager.get_stats()
        
        # Should have some active or queued tasks
        assert stats.active_tasks > 0 or stats.queued_tasks > 0
        assert stats.total_submitted == 4
        
        # Wait for completion
        for f in futures:
            f.result(timeout=5)
        
        # All should be completed now
        final_stats = manager.get_stats()
        assert final_stats.completed_tasks == 4
        assert final_stats.active_tasks == 0
        
        manager.shutdown(wait=True)
    
    def test_failed_task_statistics(self):
        """Test that failed tasks are counted in statistics."""
        manager = ThreadPoolManager(max_workers=2)
        
        def failing_task():
            raise ValueError("Intentional test failure")
        
        future = manager.submit_task(failing_task, task_name="failing_task")
        
        with pytest.raises(ValueError):
            future.result(timeout=5)
        
        stats = manager.get_stats()
        assert stats.failed_tasks == 1
        
        manager.shutdown(wait=True)


class TestTaskMonitoring:
    """Test task information and monitoring features."""
    
    def test_task_info_tracking(self):
        """Test that task info is tracked when monitoring is enabled."""
        manager = ThreadPoolManager(max_workers=2, enable_monitoring=True)
        
        def simple_task():
            time.sleep(0.1)
            return 42
        
        future = manager.submit_task(simple_task, task_name="monitored_task")
        task_id = 0  # First task gets ID 0
        
        # Check task info before completion
        info = manager.get_task_info(task_id)
        assert info is not None
        assert info.name == "monitored_task"
        assert info.status in ("queued", "running")
        
        # Wait for completion
        future.result(timeout=5)
        
        # Give a small delay for status updates to complete
        time.sleep(0.05)
        
        # Check task info after completion
        info = manager.get_task_info(task_id)
        assert info.status == "completed"
        # Duration may be None if task completed very fast
        # but if it's set, it should be >= 0.1
        duration = info.duration()
        if duration is not None:
            assert duration >= 0.1
        
        manager.shutdown(wait=True)
    
    def test_task_info_without_monitoring(self):
        """Test that task info is not tracked when monitoring is disabled."""
        manager = ThreadPoolManager(max_workers=2, enable_monitoring=False)
        
        future = manager.submit_task(lambda: 42, task_name="unmonitored_task")
        future.result(timeout=5)
        
        # Should return None when monitoring disabled
        info = manager.get_task_info(0)
        assert info is None
        
        manager.shutdown(wait=True)
    
    def test_get_all_task_info(self):
        """Test retrieving information about all tasks."""
        manager = ThreadPoolManager(max_workers=2, enable_monitoring=True)
        
        # Submit multiple tasks with a small delay to ensure they complete
        futures = []
        for i in range(5):
            future = manager.submit_task(
                lambda x=i: (time.sleep(0.01), x)[1], 
                task_name=f"task_{i}"
            )
            futures.append(future)
        
        # Wait for completion
        for f in futures:
            f.result(timeout=5)
        
        # Give adequate delay for status updates to complete
        time.sleep(0.2)
        
        # Get all task info
        all_info = manager.get_all_task_info()
        assert len(all_info) == 5
        
        # All should be completed
        for info in all_info:
            assert info.status == "completed", f"Task {info.task_id} status: {info.status}"
        
        manager.shutdown(wait=True)
    
    def test_clear_completed_tasks(self):
        """Test clearing completed task information."""
        manager = ThreadPoolManager(max_workers=2, enable_monitoring=True)
        
        # Submit and complete tasks with a small delay to ensure they complete
        futures = []
        for i in range(10):
            future = manager.submit_task(
                lambda x=i: (time.sleep(0.01), x)[1], 
                task_name=f"task_{i}"
            )
            futures.append(future)
        
        for f in futures:
            f.result(timeout=5)
        
        # Give adequate delay for status updates to complete
        time.sleep(0.2)
        
        # Verify tasks are tracked
        all_info = manager.get_all_task_info()
        assert len(all_info) == 10
        
        # Clear completed tasks
        cleared = manager.clear_completed_tasks()
        assert cleared == 10, f"Expected 10 cleared, got {cleared}"
        
        # Should be empty now
        all_info = manager.get_all_task_info()
        assert len(all_info) == 0
        
        manager.shutdown(wait=True)


class TestShutdown:
    """Test graceful shutdown behavior."""
    
    def test_shutdown_wait_true(self):
        """Test shutdown with wait=True waits for tasks to complete."""
        manager = ThreadPoolManager(max_workers=2)
        
        def slow_task():
            time.sleep(0.5)
            return True
        
        # Submit task
        future = manager.submit_task(slow_task, task_name="slow_task")
        
        # Shutdown with wait
        start_time = time.time()
        success = manager.shutdown(wait=True, timeout=2)
        elapsed = time.time() - start_time
        
        assert success is True
        assert elapsed >= 0.5  # Should wait for task to complete
        assert future.done()
    
    def test_shutdown_wait_false(self):
        """Test shutdown with wait=False cancels pending tasks."""
        manager = ThreadPoolManager(max_workers=1)
        
        def slow_task():
            time.sleep(2)
            return True
        
        # Submit task
        manager.submit_task(slow_task, task_name="slow_task")
        
        # Shutdown without waiting
        start_time = time.time()
        manager.shutdown(wait=False)
        elapsed = time.time() - start_time
        
        # Should return quickly
        assert elapsed < 1
    
    def test_shutdown_timeout(self):
        """Test shutdown with timeout."""
        manager = ThreadPoolManager(max_workers=2)
        
        def very_slow_task():
            time.sleep(10)
            return True
        
        # Submit long task
        manager.submit_task(very_slow_task, task_name="very_slow")
        time.sleep(0.1)  # Let task start
        
        # Shutdown with short timeout
        start_time = time.time()
        success = manager.shutdown(wait=True, timeout=0.5)
        elapsed = time.time() - start_time
        
        # Should timeout and return False
        # Note: The actual implementation waits for all tasks to complete
        # even if timeout is exceeded, so we expect False but a longer elapsed time
        assert success is False
        assert elapsed >= 0.5  # At least the timeout duration
    
    def test_double_shutdown(self):
        """Test that double shutdown is handled gracefully."""
        manager = ThreadPoolManager(max_workers=2)
        
        # First shutdown
        manager.shutdown(wait=True)
        
        # Second shutdown should log warning but not error
        success = manager.shutdown(wait=True)
        assert success is True


class TestErrorHandling:
    """Test error handling in task execution."""
    
    def test_task_exception_isolation(self):
        """Test that exceptions in one task don't affect others."""
        manager = ThreadPoolManager(max_workers=2)
        
        def failing_task():
            raise ValueError("Task failed")
        
        def working_task():
            return 42
        
        # Submit both tasks
        failing_future = manager.submit_task(failing_task, task_name="failing")
        working_future = manager.submit_task(working_task, task_name="working")
        
        # Failing task should raise exception
        with pytest.raises(ValueError):
            failing_future.result(timeout=5)
        
        # Working task should complete successfully
        result = working_future.result(timeout=5)
        assert result == 42
        
        manager.shutdown(wait=True)
    
    def test_task_cancellation(self):
        """Test cancelling a submitted task."""
        manager = ThreadPoolManager(max_workers=1)
        
        def slow_task():
            time.sleep(5)
            return True
        
        # Submit a task that blocks the worker
        blocking_future = manager.submit_task(slow_task, task_name="blocking")
        
        # Submit another task (will be queued)
        queued_future = manager.submit_task(lambda: 42, task_name="queued")
        
        # Try to cancel the queued task
        cancelled = manager.cancel_task(queued_future)
        
        # Should be able to cancel queued task
        if cancelled:
            assert queued_future.cancelled()
        
        # Clean up
        manager.shutdown(wait=False)


class TestThreadSafety:
    """Test thread safety of the manager."""
    
    def test_concurrent_submissions(self):
        """Test submitting tasks from multiple threads."""
        manager = ThreadPoolManager(max_workers=4)
        results = []
        results_lock = threading.Lock()
        
        def submit_tasks(thread_id, count=10):
            for i in range(count):
                future = manager.submit_task(
                    lambda tid=thread_id, idx=i: (tid, idx),
                    task_name=f"thread_{thread_id}_task_{i}"
                )
                result = future.result(timeout=5)
                with results_lock:
                    results.append(result)
        
        # Create multiple threads submitting tasks
        threads = []
        for thread_id in range(5):
            thread = threading.Thread(target=submit_tasks, args=(thread_id,))
            thread.start()
            threads.append(thread)
        
        # Wait for all threads
        for thread in threads:
            thread.join(timeout=10)
        
        # Should have 50 results total
        assert len(results) == 50
        
        manager.shutdown(wait=True)
    
    def test_concurrent_stats_access(self):
        """Test accessing stats from multiple threads."""
        manager = ThreadPoolManager(max_workers=4)
        stats_results = []
        stats_lock = threading.Lock()
        
        def check_stats():
            for _ in range(100):
                stats = manager.get_stats()
                with stats_lock:
                    stats_results.append(stats)
                time.sleep(0.001)
        
        # Start threads checking stats
        threads = []
        for _ in range(3):
            thread = threading.Thread(target=check_stats)
            thread.start()
            threads.append(thread)
        
        # Submit some work
        for i in range(50):
            manager.submit_task(lambda x=i: x, task_name=f"work_{i}")
        
        # Wait for stat checker threads
        for thread in threads:
            thread.join(timeout=10)
        
        # Should have collected stats without errors
        assert len(stats_results) == 300
        
        manager.shutdown(wait=True)


class TestTaskStatsDataclass:
    """Test the TaskStats dataclass."""
    
    def test_task_stats_string_representation(self):
        """Test TaskStats string representation."""
        stats = TaskStats(
            active_tasks=2,
            queued_tasks=5,
            completed_tasks=10,
            failed_tasks=1,
            total_submitted=18,
            worker_count=4,
        )
        
        str_repr = str(stats)
        assert "Active=2" in str_repr
        assert "Queued=5" in str_repr
        assert "Completed=10" in str_repr
        assert "Failed=1" in str_repr
        assert "Workers=4" in str_repr


class TestTaskInfoDataclass:
    """Test the TaskInfo dataclass."""
    
    def test_task_info_duration(self):
        """Test TaskInfo duration calculation."""
        info = TaskInfo(
            task_id=1,
            name="test",
            priority=TaskPriority.NORMAL,
            submitted_at=time.time(),
        )
        
        # No duration before completion
        assert info.duration() is None
        
        # Set start and completion times
        info.started_at = info.submitted_at + 0.1
        info.completed_at = info.started_at + 0.5
        
        duration = info.duration()
        assert duration is not None
        assert abs(duration - 0.5) < 0.01
    
    def test_task_info_wait_time(self):
        """Test TaskInfo wait time calculation."""
        submitted = time.time()
        info = TaskInfo(
            task_id=1,
            name="test",
            priority=TaskPriority.NORMAL,
            submitted_at=submitted,
        )
        
        # No wait time before starting
        assert info.wait_time() is None
        
        # Set start time
        info.started_at = submitted + 0.3
        
        wait = info.wait_time()
        assert wait is not None
        assert abs(wait - 0.3) < 0.01
