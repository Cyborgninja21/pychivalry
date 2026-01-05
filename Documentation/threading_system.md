# Thread Management System

## Overview

Pychivalry uses a custom internal thread management system that provides complete control over background operations. This replaces the previous reliance on pygls's `@server.thread()` decorator and gives us:

- **Full Control**: Complete ownership of thread lifecycle and resource allocation
- **Task Prioritization**: Priority-based scheduling (CRITICAL > HIGH > NORMAL > LOW > BACKGROUND)
- **Task Cancellation**: Cancel pending work when documents change rapidly
- **Timeout Management**: Per-operation timeout enforcement
- **Metrics & Debugging**: Comprehensive metrics for performance monitoring

## Architecture

### Core Components

#### TaskPriority Enum

Defines priority levels for different LSP operations:

```python
class TaskPriority(IntEnum):
    CRITICAL = 0      # Hover, completions (user is actively waiting)
    HIGH = 10         # Diagnostics, highlights (fast feedback)
    NORMAL = 20       # Formatting, references, code actions
    LOW = 30          # Indexing, workspace scan
    BACKGROUND = 40   # Pre-computation, cache warming
```

#### CK3ThreadManager

Main thread pool manager with two separate pools:

- **CPU Pool**: For parsing, validation, and computational work (sized based on CPU cores)
- **I/O Pool**: For file reading and network operations (fixed at 4 workers)

### Key Features

#### 1. Priority-Based Task Scheduling

Tasks are executed based on priority. Higher priority tasks (lower numbers) are processed first.

```python
# High priority - user is waiting
future = thread_mgr.submit_cpu_bound(
    parse_document,
    doc_source,
    priority=TaskPriority.HIGH,
    task_id=f"parse:{uri}"
)

# Low priority - background work
future = thread_mgr.submit_cpu_bound(
    scan_workspace,
    folders,
    priority=TaskPriority.LOW,
    task_id="workspace:scan"
)
```

#### 2. Task Cancellation

Cancel pending work when documents change to avoid wasting resources on stale operations:

```python
# Cancel all tasks for a specific document
cancelled = thread_mgr.cancel_by_uri("file:///path/to/doc.txt")

# Cancel all tasks with a specific prefix
cancelled = thread_mgr.cancel_by_prefix("parse:")
```

#### 3. Timeout Enforcement

Set maximum execution time for operations:

```python
future = thread_mgr.submit_cpu_bound(
    expensive_operation,
    data,
    timeout=5.0,  # 5 second timeout
    priority=TaskPriority.NORMAL
)
```

Tasks that exceed their timeout are marked in metrics but allowed to complete (for diagnostic purposes).

#### 4. Metrics Collection

Track task execution for debugging and performance monitoring:

```python
metrics = thread_mgr.get_metrics()
# Returns:
# {
#     'completed_count': 1234,
#     'cancelled_count': 45,
#     'timeout_count': 2,
#     'failed_count': 3,
#     'active_count': 5,
#     'cpu_workers': 4,
#     'io_workers': 4
# }
```

Access metrics via the LSP command:
```
ck3.getThreadingMetrics
```

## Usage Examples

### Document Parsing

```python
from .threading import TaskPriority

# Submit parsing with HIGH priority
future = ls.thread_manager.submit_cpu_bound(
    parse_document,
    doc_source,
    priority=TaskPriority.HIGH,
    task_id=f"parse:{uri}:{version}",
    timeout=10.0
)

# Await result in async handler
loop = asyncio.get_event_loop()
ast = await loop.wrap_future(future)
```

### Diagnostics Collection

```python
# Submit diagnostics with HIGH priority
future = ls.thread_manager.submit_cpu_bound(
    collect_diagnostics,
    uri,
    ast,
    priority=TaskPriority.HIGH,
    task_id=f"diag:{uri}:{version}"
)

diagnostics = await loop.wrap_future(future)
```

### Workspace Scanning

```python
# Submit workspace scan with LOW priority (background work)
future = ls.thread_manager.submit_cpu_bound(
    scan_workspace,
    folders,
    priority=TaskPriority.LOW,
    task_id="workspace:scan"
)

await loop.wrap_future(future)
```

### Handler Migration Pattern

To migrate a handler to use the thread manager:

```python
@server.feature(types.TEXT_DOCUMENT_REFERENCES)
async def references(ls: CK3LanguageServer, params: types.ReferenceParams):
    """Handler docstring..."""
    
    def _references_sync():
        """Synchronous implementation for thread pool execution."""
        # Original handler logic here
        doc = ls.workspace.get_text_document(params.text_document.uri)
        # ... processing logic ...
        return results
    
    # Submit to thread manager with appropriate priority
    from .threading import TaskPriority
    
    try:
        future = ls.thread_manager.submit_cpu_bound(
            _references_sync,
            priority=TaskPriority.HIGH,  # User is waiting
            task_id=f"refs:{params.text_document.uri}",
            timeout=30.0
        )
        return await asyncio.wrap_future(future)
    except Exception as e:
        logger.error(f"Error in references handler: {e}", exc_info=True)
        return None
```

## Benefits

### Performance

- **Separate Pools**: CPU-bound and I/O-bound operations don't compete for resources
- **Priority Scheduling**: User-facing operations complete faster
- **Cancellation**: Rapid typing doesn't queue up stale work
- **Metrics**: Identify performance bottlenecks easily

### Flexibility

- **No pygls Dependency**: Complete control over threading behavior
- **Customizable**: Easy to add new priority levels or pools
- **Observable**: Full visibility into thread states and work queues
- **Testable**: Comprehensive unit tests ensure reliability

### Optimization

- **Tuned for CK3**: Priority levels designed for modding workloads
- **Resource Control**: Explicit control over thread pool sizing
- **Adaptive**: Can adjust priorities based on workload characteristics

## Monitoring & Debugging

### Get Current Metrics

Via LSP command:
```json
{
  "command": "ck3.getThreadingMetrics"
}
```

Via server method:
```python
metrics = server.thread_manager.get_metrics()
print(f"Active tasks: {metrics['active_count']}")
print(f"Completed: {metrics['completed_count']}")
print(f"Cancelled: {metrics['cancelled_count']}")
```

### Interpreting Metrics

- **completed_count**: Tasks that finished successfully
- **cancelled_count**: Tasks cancelled before execution (usually due to document changes)
- **timeout_count**: Tasks that exceeded their timeout (may indicate slow operations)
- **failed_count**: Tasks that raised exceptions (indicates errors to investigate)
- **active_count**: Currently running tasks (high value may indicate backlog)

## Thread Safety

The thread manager is thread-safe and can be called from multiple async handlers concurrently. All internal state is protected by locks.

Document ASTs and the index are also protected by locks (`_ast_lock`, `_index_lock`) in the language server.

## Shutdown

The thread manager is automatically shut down when the language server shuts down:

```python
def shutdown(self):
    """Clean shutdown of server resources."""
    # ...
    self.thread_manager.shutdown(wait=True)
```

This ensures all threads are stopped and resources are cleaned up gracefully.

## Future Enhancements

Possible future improvements:

1. **Dynamic Priority Adjustment**: Automatically adjust priorities based on workload
2. **Work Stealing**: Allow CPU pool workers to help with I/O-bound work when idle
3. **Per-Client Pools**: Separate pools for different LSP clients in multi-root workspaces
4. **Adaptive Pool Sizing**: Dynamically adjust worker count based on load
5. **Task Batching**: Group related tasks for better cache locality

## See Also

- `pychivalry/threading.py`: Thread manager implementation
- `tests/test_threading.py`: Comprehensive unit tests
- `pychivalry/server.py`: Integration with LSP handlers
