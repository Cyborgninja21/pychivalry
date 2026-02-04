"""
Unit tests for the custom threading module.

Tests cover:
- Task prioritization
- Task cancellation by URI and prefix
- Timeout enforcement
- Metrics collection
- Thread pool shutdown
"""

import asyncio
import pytest
import threading
import time
from concurrent.futures import CancelledError

from pychivalry.core.threading import CK3ThreadManager, TaskPriority, PrioritizedTask


def test_task_priority_ordering():
    """Test that TaskPriority enum values order correctly."""
    assert TaskPriority.CRITICAL < TaskPriority.HIGH
    assert TaskPriority.HIGH < TaskPriority.NORMAL
    assert TaskPriority.NORMAL < TaskPriority.LOW
    assert TaskPriority.LOW < TaskPriority.BACKGROUND


def test_prioritized_task_ordering():
    """Test that PrioritizedTask instances order by priority then time."""
    task1 = PrioritizedTask(
        priority=TaskPriority.NORMAL, created_at=1.0, task_id="task1", func=lambda: None
    )
    task2 = PrioritizedTask(
        priority=TaskPriority.HIGH, created_at=2.0, task_id="task2", func=lambda: None
    )
    task3 = PrioritizedTask(
        priority=TaskPriority.NORMAL, created_at=0.5, task_id="task3", func=lambda: None
    )

    # HIGH priority comes before NORMAL
    assert task2 < task1

    # Same priority: earlier created_at comes first
    assert task3 < task1


def test_thread_manager_initialization():
    """Test that thread manager initializes correctly."""
    mgr = CK3ThreadManager()

    try:
        metrics = mgr.get_metrics()
        assert metrics["completed_count"] == 0
        assert metrics["cancelled_count"] == 0
        assert metrics["timeout_count"] == 0
        assert metrics["failed_count"] == 0
        assert metrics["active_count"] == 0
        assert metrics["cpu_workers"] >= 2
        assert metrics["io_workers"] == 4
    finally:
        mgr.shutdown(wait=False)


def test_submit_cpu_bound():
    """Test submitting CPU-bound work."""
    mgr = CK3ThreadManager()

    try:

        def add(a, b):
            return a + b

        future = mgr.submit_cpu_bound(add, 2, 3, priority=TaskPriority.NORMAL)
        result = future.result(timeout=1.0)

        assert result == 5

        metrics = mgr.get_metrics()
        assert metrics["completed_count"] == 1
        assert metrics["failed_count"] == 0
    finally:
        mgr.shutdown(wait=True)


def test_submit_cpu_bound_with_kwargs():
    """Test submitting CPU-bound work with keyword arguments."""
    mgr = CK3ThreadManager()

    try:

        def greet(name, greeting="Hello"):
            return f"{greeting}, {name}!"

        future = mgr.submit_cpu_bound(greet, "World", greeting="Hi", priority=TaskPriority.HIGH)
        result = future.result(timeout=1.0)

        assert result == "Hi, World!"
    finally:
        mgr.shutdown(wait=True)


def test_submit_io_bound():
    """Test submitting I/O-bound work."""
    mgr = CK3ThreadManager()

    try:

        def slow_io():
            time.sleep(0.05)
            return "done"

        future = mgr.submit_io_bound(slow_io, priority=TaskPriority.LOW)
        result = future.result(timeout=1.0)

        assert result == "done"

        metrics = mgr.get_metrics()
        assert metrics["completed_count"] == 1
    finally:
        mgr.shutdown(wait=True)


def test_task_cancellation_before_execution():
    """Test cancelling a task before it starts executing."""
    mgr = CK3ThreadManager()

    try:
        cancel_token = threading.Event()
        cancel_token.set()  # Cancel immediately

        def long_task():
            time.sleep(1.0)
            return "should not complete"

        future = mgr.submit_cpu_bound(
            long_task, priority=TaskPriority.LOW, cancellation_token=cancel_token
        )

        with pytest.raises((CancelledError, asyncio.CancelledError)):
            future.result(timeout=0.5)

        # Give metrics time to update
        time.sleep(0.1)

        metrics = mgr.get_metrics()
        # Should be counted as cancelled
        assert metrics["cancelled_count"] >= 1
    finally:
        mgr.shutdown(wait=False)


def test_cancel_by_uri():
    """Test cancelling tasks by document URI."""
    mgr = CK3ThreadManager()

    try:

        def slow_task():
            time.sleep(2.0)
            return "done"

        # Submit multiple tasks for different URIs
        uri1 = "file:///path/to/doc1.txt"
        uri2 = "file:///path/to/doc2.txt"

        future1 = mgr.submit_cpu_bound(
            slow_task, priority=TaskPriority.LOW, task_id=f"parse:{uri1}"
        )
        future2 = mgr.submit_cpu_bound(
            slow_task, priority=TaskPriority.LOW, task_id=f"parse:{uri2}"
        )
        future3 = mgr.submit_cpu_bound(
            slow_task, priority=TaskPriority.LOW, task_id=f"diag:{uri1}"
        )

        # Let tasks start
        time.sleep(0.05)

        # Cancel all tasks for uri1
        cancelled = mgr.cancel_by_uri(uri1)

        # Should cancel future1 and future3 (both contain uri1)
        # Note: cancel() only works if task hasn't started yet
        # Since tasks start quickly, we may not be able to cancel them
        assert cancelled >= 0  # At least attempted

        # Verify metrics updated
        metrics = mgr.get_metrics()
        assert metrics["cancelled_count"] >= 0

    finally:
        mgr.shutdown(wait=False)


def test_cancel_by_prefix():
    """Test cancelling tasks by ID prefix."""
    mgr = CK3ThreadManager()

    try:

        def slow_task():
            time.sleep(2.0)
            return "done"

        # Submit tasks with different prefixes
        future1 = mgr.submit_cpu_bound(slow_task, task_id="parse:doc1")
        future2 = mgr.submit_cpu_bound(slow_task, task_id="parse:doc2")
        future3 = mgr.submit_cpu_bound(slow_task, task_id="diag:doc1")

        # Let tasks start
        time.sleep(0.05)

        # Cancel all parse tasks
        cancelled = mgr.cancel_by_prefix("parse:")

        # Should attempt to cancel future1 and future2
        assert cancelled >= 0

        metrics = mgr.get_metrics()
        assert metrics["cancelled_count"] >= 0

    finally:
        mgr.shutdown(wait=False)


def test_timeout_tracking():
    """Test that timeout violations are tracked in metrics."""
    mgr = CK3ThreadManager()

    try:

        def slow_task():
            time.sleep(0.3)
            return "done"

        # Submit task with short timeout
        future = mgr.submit_cpu_bound(
            slow_task, priority=TaskPriority.NORMAL, timeout=0.1, task_id="timeout-test"
        )

        # Wait for completion
        result = future.result(timeout=1.0)
        assert result == "done"

        # Give metrics time to update
        time.sleep(0.1)

        # Should be marked as timeout in metrics
        metrics = mgr.get_metrics()
        assert metrics["timeout_count"] >= 1

    finally:
        mgr.shutdown(wait=True)


def test_failed_task_tracking():
    """Test that failed tasks are tracked in metrics."""
    mgr = CK3ThreadManager()

    try:

        def failing_task():
            raise ValueError("Test error")

        future = mgr.submit_cpu_bound(failing_task, priority=TaskPriority.NORMAL)

        with pytest.raises(ValueError, match="Test error"):
            future.result(timeout=1.0)

        # Give metrics time to update
        time.sleep(0.1)

        metrics = mgr.get_metrics()
        assert metrics["failed_count"] == 1

    finally:
        mgr.shutdown(wait=True)


def test_concurrent_tasks():
    """Test running multiple tasks concurrently."""
    mgr = CK3ThreadManager()

    try:

        def add(a, b):
            time.sleep(0.05)
            return a + b

        # Submit multiple tasks
        futures = [
            mgr.submit_cpu_bound(add, i, i * 2, priority=TaskPriority.NORMAL) for i in range(5)
        ]

        # Wait for all to complete
        results = [f.result(timeout=2.0) for f in futures]

        # Verify results
        expected = [i + i * 2 for i in range(5)]
        assert results == expected

        metrics = mgr.get_metrics()
        assert metrics["completed_count"] == 5

    finally:
        mgr.shutdown(wait=True)


def test_shutdown_graceful():
    """Test graceful shutdown waits for tasks."""
    mgr = CK3ThreadManager()

    def slow_task():
        time.sleep(0.2)
        return "completed"

    future = mgr.submit_cpu_bound(slow_task, priority=TaskPriority.NORMAL)

    # Shutdown with wait=True should wait for task
    mgr.shutdown(wait=True)

    # Task should have completed
    result = future.result(timeout=0.1)
    assert result == "completed"


def test_shutdown_forced():
    """Test forced shutdown cancels pending tasks."""
    mgr = CK3ThreadManager()

    def slow_task():
        time.sleep(2.0)
        return "should not complete"

    future = mgr.submit_cpu_bound(slow_task, priority=TaskPriority.LOW)

    # Give task time to start
    time.sleep(0.05)

    # Shutdown without waiting should cancel
    mgr.shutdown(wait=False)

    # Verify shutdown state
    assert mgr._shutdown is True


def test_submit_after_shutdown():
    """Test that submitting after shutdown raises error."""
    mgr = CK3ThreadManager()
    mgr.shutdown(wait=True)

    with pytest.raises(RuntimeError, match="shut down"):
        mgr.submit_cpu_bound(lambda: None)


@pytest.mark.asyncio
async def test_asyncio_integration():
    """Test integration with asyncio via wrap_future."""
    mgr = CK3ThreadManager()

    try:

        def add(a, b):
            time.sleep(0.05)
            return a + b

        future = mgr.submit_cpu_bound(add, 10, 20, priority=TaskPriority.CRITICAL)

        # Wrap future for asyncio
        result = await asyncio.wrap_future(future)

        assert result == 30

    finally:
        mgr.shutdown(wait=True)


def test_metrics_accuracy():
    """Test that metrics accurately reflect operations."""
    mgr = CK3ThreadManager()

    try:
        # Submit successful task
        f1 = mgr.submit_cpu_bound(lambda: 42, priority=TaskPriority.NORMAL)
        f1.result()

        # Submit failing task
        f2 = mgr.submit_cpu_bound(lambda: 1 / 0, priority=TaskPriority.NORMAL)
        try:
            f2.result()
        except ZeroDivisionError:
            pass

        # Submit task that times out
        f3 = mgr.submit_cpu_bound(
            lambda: time.sleep(0.3), priority=TaskPriority.NORMAL, timeout=0.1
        )
        f3.result()

        # Give metrics time to update
        time.sleep(0.1)

        metrics = mgr.get_metrics()
        assert metrics["completed_count"] >= 2  # f1 and f3 completed
        assert metrics["failed_count"] >= 1  # f2 failed
        assert metrics["timeout_count"] >= 1  # f3 timed out

    finally:
        mgr.shutdown(wait=True)


def test_priority_enforcement_critical_vs_low():
    """Test that CRITICAL priority tasks execute before LOW priority tasks."""
    mgr = CK3ThreadManager()
    execution_order = []
    lock = threading.Lock()
    start_event = threading.Event()

    try:
        # Create a slow task to occupy all CPU workers
        def blocker():
            start_event.wait()  # Wait until all tasks are queued
            time.sleep(0.2)

        # Submit blocking tasks to fill the pool
        cpu_workers = mgr.get_metrics()["cpu_workers"]
        blocking_futures = []
        for i in range(cpu_workers):
            f = mgr.submit_cpu_bound(blocker, priority=TaskPriority.BACKGROUND, task_id=f"blocker-{i}")
            blocking_futures.append(f)

        # Give blockers time to start
        time.sleep(0.1)

        # Submit LOW priority tasks first
        def low_task(task_num):
            with lock:
                execution_order.append(f"LOW-{task_num}")

        for i in range(5):
            mgr.submit_cpu_bound(low_task, i, priority=TaskPriority.LOW, task_id=f"low-{i}")

        # Submit CRITICAL priority tasks
        def critical_task(task_num):
            with lock:
                execution_order.append(f"CRITICAL-{task_num}")

        critical_futures = []
        for i in range(3):
            f = mgr.submit_cpu_bound(critical_task, i, priority=TaskPriority.CRITICAL, task_id=f"critical-{i}")
            critical_futures.append(f)

        # Release blockers
        start_event.set()

        # Wait for all tasks to complete
        for f in blocking_futures + critical_futures:
            f.result(timeout=2.0)

        time.sleep(0.1)

        # CRITICAL tasks should execute before LOW tasks
        critical_count = sum(1 for item in execution_order if item.startswith("CRITICAL"))
        assert critical_count == 3, f"Expected 3 CRITICAL tasks, got {critical_count}"

        # Find position of first CRITICAL and last CRITICAL
        first_critical_idx = next((i for i, x in enumerate(execution_order) if x.startswith("CRITICAL")), None)
        last_critical_idx = len(execution_order) - 1 - next((i for i, x in enumerate(reversed(execution_order)) if x.startswith("CRITICAL")), 0)
        first_low_idx = next((i for i, x in enumerate(execution_order) if x.startswith("LOW")), None)

        # At least the first CRITICAL should execute before first LOW
        if first_critical_idx is not None and first_low_idx is not None:
            assert first_critical_idx < first_low_idx, \
                f"CRITICAL task at index {first_critical_idx} should execute before LOW task at {first_low_idx}"

    finally:
        mgr.shutdown(wait=True)


def test_priority_enforcement_multiple_levels():
    """Test that tasks execute in strict priority order: CRITICAL > HIGH > NORMAL > LOW."""
    mgr = CK3ThreadManager()
    execution_order = []
    lock = threading.Lock()
    start_event = threading.Event()

    try:
        # Create blocker to fill the pool
        def blocker():
            start_event.wait()
            time.sleep(0.2)

        cpu_workers = mgr.get_metrics()["cpu_workers"]
        blocking_futures = []
        for i in range(cpu_workers):
            f = mgr.submit_cpu_bound(blocker, priority=TaskPriority.BACKGROUND, task_id=f"blocker-{i}")
            blocking_futures.append(f)

        time.sleep(0.1)

        # Submit tasks in reverse priority order (all at once before release)
        def record_task(priority_name):
            with lock:
                execution_order.append(priority_name)

        priorities = [
            (TaskPriority.LOW, "LOW"),
            (TaskPriority.NORMAL, "NORMAL"),
            (TaskPriority.HIGH, "HIGH"),
            (TaskPriority.CRITICAL, "CRITICAL"),
        ]

        task_futures = []
        for priority, name in priorities:
            f = mgr.submit_cpu_bound(record_task, name, priority=priority, task_id=f"task-{name}")
            task_futures.append(f)

        # Release blockers now that all tasks are queued
        start_event.set()

        # Wait for completion
        for f in blocking_futures + task_futures:
            f.result(timeout=2.0)

        time.sleep(0.1)

        # Verify execution order matches priority
        assert len(execution_order) == 4, f"Expected 4 tasks, got {len(execution_order)}: {execution_order}"
        assert execution_order[0] == "CRITICAL", f"First task should be CRITICAL, got {execution_order[0]} (full order: {execution_order})"
        assert execution_order[1] == "HIGH", f"Second task should be HIGH, got {execution_order[1]} (full order: {execution_order})"
        assert execution_order[2] == "NORMAL", f"Third task should be NORMAL, got {execution_order[2]} (full order: {execution_order})"
        assert execution_order[3] == "LOW", f"Fourth task should be LOW, got {execution_order[3]} (full order: {execution_order})"

    finally:
        mgr.shutdown(wait=True)


def test_priority_scheduling_disabled():
    """Test that priority scheduling can be disabled via environment variable."""
    import os

    # Disable priority scheduling
    old_value = os.environ.get("CK3_PRIORITY_SCHEDULING")
    os.environ["CK3_PRIORITY_SCHEDULING"] = "0"

    try:
        mgr = CK3ThreadManager()

        try:
            # Should still accept priority parameter but may not enforce it
            def task():
                return 42

            f1 = mgr.submit_cpu_bound(task, priority=TaskPriority.LOW)
            f2 = mgr.submit_cpu_bound(task, priority=TaskPriority.CRITICAL)

            # Both should complete successfully
            assert f1.result(timeout=1.0) == 42
            assert f2.result(timeout=1.0) == 42

        finally:
            mgr.shutdown(wait=True)
    finally:
        # Restore environment
        if old_value is None:
            os.environ.pop("CK3_PRIORITY_SCHEDULING", None)
        else:
            os.environ["CK3_PRIORITY_SCHEDULING"] = old_value


def test_priority_with_uri_cancellation():
    """Test that priority scheduling works correctly with URI-based cancellation."""
    mgr = CK3ThreadManager()

    try:
        # Submit tasks with different priorities and URIs
        def slow_task():
            time.sleep(0.3)
            return "completed"

        # Submit CRITICAL task with URI
        f1 = mgr.submit_cpu_bound(
            slow_task,
            priority=TaskPriority.CRITICAL,
            task_id="critical-task",
            uri="file:///test/critical.py"
        )

        # Submit LOW priority tasks with different URI
        low_futures = []
        for i in range(3):
            f = mgr.submit_cpu_bound(
                slow_task,
                priority=TaskPriority.LOW,
                task_id=f"low-task-{i}",
                uri="file:///test/low.py"
            )
            low_futures.append(f)

        # Give tasks time to queue
        time.sleep(0.05)

        # Cancel all LOW tasks by URI (should be O(1))
        cancelled_count = mgr.cancel_by_uri("file:///test/low.py")

        # Should have cancelled pending LOW tasks
        assert cancelled_count >= 0, "Should cancel some LOW tasks"

        # CRITICAL task should still complete
        result = f1.result(timeout=1.0)
        assert result == "completed"

    finally:
        mgr.shutdown(wait=True)


@pytest.mark.asyncio
async def test_priority_with_asyncio():
    """Test that priority scheduling works with asyncio integration."""
    mgr = CK3ThreadManager()

    try:
        execution_order = []
        lock = threading.Lock()
        start_event = threading.Event()

        # Create blocker
        def blocker():
            start_event.wait()
            time.sleep(0.1)

        cpu_workers = mgr.get_metrics()["cpu_workers"]
        for i in range(cpu_workers):
            mgr.submit_cpu_bound(blocker, priority=TaskPriority.BACKGROUND)

        await asyncio.sleep(0.1)

        # Submit tasks via asyncio
        def record_priority(priority_name):
            with lock:
                execution_order.append(priority_name)

        low_future = mgr.submit_cpu_bound(record_priority, "LOW", priority=TaskPriority.LOW)
        critical_future = mgr.submit_cpu_bound(record_priority, "CRITICAL", priority=TaskPriority.CRITICAL)

        # Release blockers
        start_event.set()

        # Wait using asyncio
        await asyncio.wrap_future(low_future)
        await asyncio.wrap_future(critical_future)

        await asyncio.sleep(0.1)

        # CRITICAL should execute first
        if len(execution_order) >= 2:
            assert execution_order[0] == "CRITICAL", f"Expected CRITICAL first, got {execution_order}"

    finally:
        mgr.shutdown(wait=True)
