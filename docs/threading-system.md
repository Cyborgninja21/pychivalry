# Pychivalry Threading System Documentation

## Overview

The pychivalry threading system is a custom thread management solution built to replace pygls's default threading model. It provides complete control over thread lifecycle, task prioritization, cancellation, and resource allocation for LSP (Language Server Protocol) operations.

**Location**: [pychivalry/threading.py](../pychivalry/threading.py)

## Motivation

The custom threading system was created to address specific needs of the CK3 modding LSP:

1. **Priority-based scheduling**: User-facing operations (hover, completions) need to execute before background tasks (indexing)
2. **Task cancellation**: When users rapidly edit documents, stale parsing/validation tasks should be cancelled
3. **Timeout enforcement**: Long-running operations should not block the server
4. **Separation of concerns**: CPU-bound (parsing) and I/O-bound (file reading) operations benefit from separate thread pools
5. **Observability**: Built-in metrics for monitoring and debugging thread pool utilization
6. **Independence**: No dependency on pygls threading internals, providing architectural flexibility

## Architecture

### Core Components

#### 1. TaskPriority Enum

Defines five priority levels for task scheduling, where lower numbers indicate higher priority:

```python
class TaskPriority(IntEnum):
    CRITICAL = 0     # User is actively waiting (hover, completions)
    HIGH = 10        # Fast feedback needed (diagnostics, highlights)
    NORMAL = 20      # User-initiated but can wait (formatting, references)
    LOW = 30         # Background work (indexing, workspace scan)
    BACKGROUND = 40  # Pre-computation, cache warming
```

**Design Philosophy**: Priorities are organized around user experience rather than technical implementation details.

#### 2. PrioritizedTask Dataclass

Represents a task with metadata for priority-based scheduling:

```python
@dataclass(order=True)
class PrioritizedTask:
    priority: int                           # Task priority level
    created_at: float                       # Unix timestamp for tie-breaking
    task_id: str                            # Unique identifier
    func: Callable                          # Function to execute
    args: tuple                             # Positional arguments
    kwargs: dict                            # Keyword arguments
    cancellation_token: Optional[Event]     # Cancellation signal
    timeout: Optional[float]                # Maximum execution time
```

**Ordering**: Tasks are ordered first by priority, then by creation time (FIFO within same priority).

#### 3. CK3ThreadManager

The main thread pool manager that orchestrates all background operations.

**Key Features**:
- Separate thread pools for CPU-bound and I/O-bound work
- Priority-based task submission
- Task cancellation by URI or ID prefix
- Per-task timeout enforcement
- Comprehensive metrics collection
- Graceful and forced shutdown support

**Thread Pool Sizing**:
- **CPU Pool**: `min(4, cpu_count)` workers (configurable via `CK3_MAX_CPU_WORKERS` env var)
- **I/O Pool**: 4 workers (configurable via `CK3_MAX_IO_WORKERS` env var)
- Minimum of 2 CPU workers to prevent deadlock

## Usage Patterns

### Basic Initialization

```python
from pychivalry.threading import CK3ThreadManager, TaskPriority

# Initialize the thread manager
thread_mgr = CK3ThreadManager()
```

### Submitting CPU-Bound Work

Used for parsing, validation, and computational tasks:

```python
# Submit with priority and timeout
future = thread_mgr.submit_cpu_bound(
    parse_document,
    doc_source,
    priority=TaskPriority.HIGH,
    task_id=f"parse:{uri}",
    timeout=5.0
)

# Get result synchronously
result = future.result()

# Or integrate with asyncio
result = await asyncio.wrap_future(future)
```

### Submitting I/O-Bound Work

Used for file reading, network operations:

```python
future = thread_mgr.submit_io_bound(
    read_file,
    file_path,
    priority=TaskPriority.LOW,
    task_id=f"read:{file_path}"
)

content = future.result()
```

### Task Cancellation

#### Cancel by Document URI

When a document changes, cancel all pending operations for that document:

```python
# User edited document, cancel stale work
cancelled_count = thread_mgr.cancel_by_uri("file:///path/to/document.txt")
logger.info(f"Cancelled {cancelled_count} stale tasks")
```

#### Cancel by Task ID Prefix

Cancel groups of related tasks:

```python
# Cancel all parsing tasks
thread_mgr.cancel_by_prefix("parse:")

# Cancel all diagnostic tasks
thread_mgr.cancel_by_prefix("diag:")
```

### Using Cancellation Tokens

For cooperative cancellation within long-running tasks:

```python
import threading

# Create cancellation token
cancel_token = threading.Event()

# Submit task with token
future = thread_mgr.submit_cpu_bound(
    long_running_parse,
    doc_source,
    cancellation_token=cancel_token,
    priority=TaskPriority.NORMAL
)

# In the task function, check periodically
def long_running_parse(doc_source, cancellation_token=None):
    for chunk in doc_source.chunks():
        if cancellation_token and cancellation_token.is_set():
            logger.debug("Task cancelled, exiting early")
            raise asyncio.CancelledError("Task cancelled")

        # Process chunk
        process(chunk)
```

### Metrics and Monitoring

Track thread pool performance:

```python
metrics = thread_mgr.get_metrics()

print(f"Completed: {metrics['completed_count']}")
print(f"Cancelled: {metrics['cancelled_count']}")
print(f"Timeouts: {metrics['timeout_count']}")
print(f"Failed: {metrics['failed_count']}")
print(f"Active: {metrics['active_count']}")
print(f"CPU Workers: {metrics['cpu_workers']}")
print(f"I/O Workers: {metrics['io_workers']}")
```

**Metrics Dictionary**:
- `completed_count`: Successfully completed tasks
- `cancelled_count`: Tasks cancelled before/during execution
- `timeout_count`: Tasks that exceeded their timeout
- `failed_count`: Tasks that raised exceptions
- `active_count`: Currently running tasks
- `cpu_workers`: Number of CPU pool workers
- `io_workers`: Number of I/O pool workers

### Shutdown

Clean shutdown during server termination:

```python
# Graceful shutdown - wait for active tasks
thread_mgr.shutdown(wait=True)

# Forced shutdown - cancel active tasks
thread_mgr.shutdown(wait=False)
```

## Integration with pychivalry LSP

The thread manager is integrated throughout the LSP server:

### Server Initialization

In [server.py:340-341](../pychivalry/server.py#L340-L341):

```python
from .threading import CK3ThreadManager
self.thread_manager = CK3ThreadManager()
```

### Document Parsing

High-priority parsing for immediate feedback (line 887):

```python
future = self.thread_manager.submit_cpu_bound(
    self.get_or_parse_ast,
    current_source,
    priority=TaskPriority.HIGH,
    task_id=f"parse:{uri}",
    timeout=10.0
)
```

### Two-Phase Diagnostics

**Phase 1**: Immediate syntax error feedback (line 912):

```python
future = self.thread_manager.submit_cpu_bound(
    self._collect_syntax_diagnostics_sync,
    uri,
    priority=TaskPriority.HIGH,
    task_id=f"syntax_diag:{uri}",
    timeout=5.0
)
```

**Phase 2**: Background semantic analysis (line 936):

```python
future = self.thread_manager.submit_cpu_bound(
    self._collect_semantic_diagnostics_sync,
    uri,
    priority=TaskPriority.NORMAL,
    task_id=f"semantic_diag:{uri}",
    timeout=30.0
)
```

### Workspace Scanning

Low-priority background indexing (line 1131):

```python
future = self.thread_manager.submit_cpu_bound(
    scan_with_lock,
    priority=TaskPriority.LOW,
    task_id="workspace:scan",
    timeout=300.0
)
```

## Implementation Details

### Thread-Safe Task Tracking

The manager maintains thread-safe data structures:

```python
# Active tasks dictionary with reentrant lock
self._active_tasks: Dict[str, Future] = {}
self._active_tasks_lock = threading.RLock()

# Metrics protected by lock
self._completed_count = 0
self._cancelled_count = 0
self._timeout_count = 0
self._failed_count = 0
self._metrics_lock = threading.Lock()
```

### Task Wrapper Pattern

Each submitted task is wrapped to handle:

1. **Cancellation checking**: Before execution starts
2. **Timeout tracking**: After execution completes
3. **Metrics updates**: Success, failure, or timeout
4. **Cleanup**: Remove from active tasks dictionary

```python
def wrapped_func():
    start_time = time.time()

    try:
        # Check cancellation
        if cancellation_token and cancellation_token.is_set():
            raise asyncio.CancelledError()

        # Execute function
        result = func(*args, **kwargs)

        # Check timeout
        if timeout and (time.time() - start_time) > timeout:
            self._timeout_count += 1

        self._completed_count += 1
        return result

    except Exception as e:
        self._failed_count += 1
        raise
    finally:
        # Cleanup
        self._active_tasks.pop(task_id, None)
```

### Cancellation Algorithm

The `_cancel_tasks` method uses a predicate-based approach:

```python
def _cancel_tasks(self, match_fn: Callable[[str], bool], description: str) -> int:
    # Atomic snapshot of matching tasks
    with self._active_tasks_lock:
        tasks_to_cancel = [
            (task_id, future)
            for task_id, future in self._active_tasks.items()
            if match_fn(task_id)
        ]

    # Cancel outside lock to avoid holding lock during I/O
    cancelled = 0
    for task_id, future in tasks_to_cancel:
        if future.cancel():  # Returns False if already running
            cancelled += 1

    return cancelled
```

**Note**: `future.cancel()` only succeeds if the task hasn't started executing. Running tasks cannot be forcibly terminated.

## Testing

Comprehensive test suite in [tests/test_threading.py](../tests/test_threading.py):

- **Priority ordering**: Verify TaskPriority enum and PrioritizedTask comparison
- **Task submission**: CPU-bound and I/O-bound work execution
- **Cancellation**: By URI, prefix, and cancellation token
- **Timeout tracking**: Detect and report timeout violations
- **Metrics accuracy**: Verify counters update correctly
- **Concurrent execution**: Multiple tasks running in parallel
- **Shutdown behavior**: Graceful and forced shutdown
- **AsyncIO integration**: Using `asyncio.wrap_future()`

**Run tests**:
```bash
pytest tests/test_threading.py -v
```

## Performance Characteristics

### Thread Pool Sizing

**CPU Pool**: Limited to `min(4, cpu_count)` to prevent:
- Context switching overhead on high-core systems
- Resource contention between parsing operations
- Default: 2-4 workers on typical developer machines

**I/O Pool**: Fixed at 4 workers, suitable for:
- File reading operations
- Network requests (future use)
- Operations that spend most time waiting

### Priority Scheduling

Tasks are submitted directly to ThreadPoolExecutor, which uses FIFO queuing. The PrioritizedTask dataclass and priority queue infrastructure is **reserved for future use** when implementing a custom scheduler.

**Current Behavior**: Tasks execute in submission order within each pool.

**Future Enhancement**: Could implement a priority-aware scheduler that pulls from a priority queue.

### Cancellation Performance

- **Task ID lookup**: O(1) via dictionary
- **URI matching**: O(n) scan of active tasks
- **Prefix matching**: O(n) scan of active tasks

**Trade-off**: Simple implementation favoring correctness over optimization. URI/prefix cancellation is infrequent (only on document changes), so linear scan is acceptable.

## Configuration

### Environment Variables

- `CK3_MAX_CPU_WORKERS`: Override CPU pool size (default: `min(4, cpu_count)`)
- `CK3_MAX_IO_WORKERS`: Override I/O pool size (default: 4)

**Example**:
```bash
# Increase CPU workers for high-core systems
export CK3_MAX_CPU_WORKERS=8

# Reduce for constrained environments
export CK3_MAX_CPU_WORKERS=2
```

### Tuning Guidelines

**CPU Pool Size**:
- **Too small**: Sequential parsing bottleneck, slow hover/completion
- **Too large**: Context switching overhead, reduced per-task performance
- **Recommended**: 2-4 workers for typical LSP workloads

**I/O Pool Size**:
- **Too small**: File reading becomes sequential
- **Too large**: Minimal benefit (I/O is naturally concurrent)
- **Recommended**: 4 workers

**Timeouts**:
- **CRITICAL operations**: 1-2 seconds (hover, completion)
- **HIGH operations**: 5-10 seconds (diagnostics)
- **NORMAL operations**: 30 seconds (formatting, references)
- **LOW operations**: 300 seconds (workspace scan)

## Best Practices

### 1. Use Appropriate Priorities

```python
# ✅ GOOD: Critical path for user interaction
future = mgr.submit_cpu_bound(
    compute_hover_info,
    priority=TaskPriority.CRITICAL
)

# ❌ BAD: Background indexing with high priority
future = mgr.submit_cpu_bound(
    scan_workspace,
    priority=TaskPriority.CRITICAL  # Wrong!
)
```

### 2. Always Provide Task IDs

```python
# ✅ GOOD: Task ID enables cancellation
future = mgr.submit_cpu_bound(
    parse_document,
    doc_source,
    task_id=f"parse:{uri}"
)

# ⚠️ SUBOPTIMAL: Auto-generated ID, can't cancel by URI
future = mgr.submit_cpu_bound(parse_document, doc_source)
```

### 3. Include Document URI in Task IDs

```python
# ✅ GOOD: Can cancel all tasks for this document
task_id = f"parse:{uri}"
task_id = f"diag:{uri}"
task_id = f"format:{uri}"

# ❌ BAD: Can't cancel by document
task_id = "parse_task_123"
```

### 4. Set Realistic Timeouts

```python
# ✅ GOOD: Reasonable timeout for operation
future = mgr.submit_cpu_bound(
    parse_large_document,
    timeout=30.0  # 30 seconds
)

# ❌ BAD: Timeout too short, will always fail
future = mgr.submit_cpu_bound(
    parse_large_document,
    timeout=0.1  # 100ms - unrealistic
)
```

### 5. Cancel Stale Work on Document Changes

```python
@server.feature(TEXT_DOCUMENT_DID_CHANGE)
async def did_change(ls, params):
    uri = params.text_document.uri

    # Cancel stale parsing/diagnostics
    ls.thread_manager.cancel_by_uri(uri)

    # Submit fresh work
    future = ls.thread_manager.submit_cpu_bound(
        parse_document,
        params.content_changes[0].text,
        task_id=f"parse:{uri}"
    )
```

### 6. Use Cancellation Tokens for Long Operations

```python
def parse_large_file(content, cancellation_token=None):
    lines = content.split('\n')

    for i, line in enumerate(lines):
        # Check every 100 lines
        if i % 100 == 0:
            if cancellation_token and cancellation_token.is_set():
                raise asyncio.CancelledError("Cancelled")

        parse_line(line)
```

### 7. Integrate with AsyncIO

```python
# ✅ GOOD: Non-blocking await
future = mgr.submit_cpu_bound(expensive_operation)
result = await asyncio.wrap_future(future)

# ❌ BAD: Blocks event loop
future = mgr.submit_cpu_bound(expensive_operation)
result = future.result()  # Blocking!
```

## Troubleshooting

### Issue: Tasks Not Executing

**Symptoms**: Futures never complete, server appears frozen

**Possible Causes**:
1. Thread pool exhausted by long-running tasks
2. Deadlock waiting for shared resources
3. Thread pool shut down

**Diagnosis**:
```python
metrics = thread_mgr.get_metrics()
print(f"Active tasks: {metrics['active_count']}")
print(f"CPU workers: {metrics['cpu_workers']}")
```

**Solutions**:
- Check for blocking operations in tasks
- Ensure tasks release locks promptly
- Increase pool size if genuinely CPU-bound

### Issue: High Cancellation Count

**Symptoms**: Many cancelled tasks in metrics

**Possible Causes**:
1. User rapidly editing documents (expected)
2. Aggressive cancellation logic
3. Short timeouts

**Diagnosis**:
```python
metrics = thread_mgr.get_metrics()
ratio = metrics['cancelled_count'] / (metrics['completed_count'] + 1)
print(f"Cancellation ratio: {ratio:.2%}")
```

**Solutions**:
- Review cancellation logic
- Increase timeouts if tasks are timing out prematurely
- Consider debouncing document change events

### Issue: Timeout Count Increasing

**Symptoms**: Operations completing but marked as timeouts

**Possible Causes**:
1. Timeouts too aggressive for operation complexity
2. System under heavy load
3. Inefficient parsing/validation logic

**Diagnosis**:
```python
# Add timing to task functions
import time

def parse_with_timing(content):
    start = time.time()
    result = parse(content)
    elapsed = time.time() - start
    logger.info(f"Parse took {elapsed:.2f}s")
    return result
```

**Solutions**:
- Increase timeout for complex operations
- Optimize parsing logic
- Consider breaking large operations into chunks

### Issue: Memory Growth

**Symptoms**: LSP server memory usage grows over time

**Possible Causes**:
1. Task results not being consumed
2. Active tasks dictionary growing
3. Metrics counters overflow (unlikely)

**Diagnosis**:
```python
metrics = thread_mgr.get_metrics()
print(f"Active tasks: {metrics['active_count']}")

# Check for leaked futures
print(f"Active tasks dict size: {len(thread_mgr._active_tasks)}")
```

**Solutions**:
- Always consume future results or catch exceptions
- Ensure tasks complete (check for infinite loops)
- Verify task cleanup in finally blocks

## Future Enhancements

### 1. Priority Queue Scheduler

Currently, tasks are submitted directly to ThreadPoolExecutor. Future enhancement could add a worker thread that pulls from the priority queue:

```python
def _priority_worker(self):
    """Worker that processes priority queue."""
    while not self._shutdown:
        try:
            task = self._work_queue.get(timeout=1.0)
            self._cpu_pool.submit(task.func, *task.args, **task.kwargs)
        except Empty:
            continue
```

### 2. Adaptive Pool Sizing

Dynamically adjust pool size based on workload:

```python
def _adjust_pool_size(self):
    """Adjust pool size based on queue depth and utilization."""
    metrics = self.get_metrics()
    if metrics['active_count'] == metrics['cpu_workers']:
        # Pool saturated, consider expansion
        pass
```

### 3. Task Dependencies

Support task chains where one task depends on another:

```python
future1 = mgr.submit_cpu_bound(parse_document)
future2 = mgr.submit_cpu_bound(
    validate_document,
    depends_on=future1
)
```

### 4. Task Telemetry

Detailed per-task metrics for profiling:

```python
task_stats = mgr.get_task_stats("parse:")
print(f"Average parse time: {task_stats['avg_duration']}")
print(f"P95 parse time: {task_stats['p95_duration']}")
```

## References

- **Implementation**: [pychivalry/threading.py](../pychivalry/threading.py)
- **Tests**: [tests/test_threading.py](../tests/test_threading.py)
- **Server Integration**: [pychivalry/server.py](../pychivalry/server.py)
- **Python ThreadPoolExecutor**: [concurrent.futures documentation](https://docs.python.org/3/library/concurrent.futures.html)
- **AsyncIO Integration**: [asyncio.wrap_future](https://docs.python.org/3/library/asyncio-task.html#asyncio.wrap_future)

## Changelog

### Initial Implementation (2025)
- Custom thread manager replacing pygls threading
- Priority-based task scheduling
- Task cancellation by URI and prefix
- Per-task timeout enforcement
- Separate CPU and I/O pools
- Comprehensive metrics collection
- Full test coverage

---

**Document Version**: 1.0
**Last Updated**: 2026-01-08
**Maintained By**: pychivalry development team
