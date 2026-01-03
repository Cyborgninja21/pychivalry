# Custom Thread Pool Management System

## Overview

The pychivalry language server uses a custom thread pool management system for handling CPU-bound operations. This system provides priority-based task scheduling, comprehensive monitoring, and graceful resource management.

## Architecture

### ThreadPoolManager

The `ThreadPoolManager` class (in `pychivalry/thread_manager.py`) is the core component that manages all threaded operations in the language server.

**Key Features:**
- **Priority-based scheduling**: Tasks can be submitted with different priorities (CRITICAL, HIGH, NORMAL, LOW)
- **Task monitoring**: Track active, queued, and completed tasks with detailed statistics
- **Graceful shutdown**: Configurable timeout handling for clean resource cleanup
- **Thread safety**: All operations are thread-safe with proper locking
- **Comprehensive logging**: Detailed diagnostic information for debugging

### Task Priorities

The system supports four priority levels:

```python
class TaskPriority(IntEnum):
    CRITICAL = 0  # Immediate user actions (hover, highlight)
    HIGH = 1      # User-initiated operations (find refs, format, rename)
    NORMAL = 2    # Background operations (diagnostics, indexing, parsing)
    LOW = 3       # Pre-emptive/speculative work (pre-parsing)
```

## Integration with Language Server

### Helper Methods

The `CK3LanguageServer` class provides convenient helper methods for submitting tasks:

```python
async def run_in_thread(
    self,
    func: callable,
    *args,
    priority: TaskPriority = TaskPriority.NORMAL,
    task_name: Optional[str] = None,
    **kwargs
)
```

**Example Usage:**
```python
# In an LSP handler
async def my_handler(ls: CK3LanguageServer, params):
    result = await ls.run_in_thread(
        expensive_computation,
        input_data,
        priority=TaskPriority.HIGH,
        task_name="my_computation"
    )
    return result
```

### Migrated Handlers

All LSP handlers that were previously using `@server.thread()` have been migrated to use the custom thread pool:

| Handler | Priority | Rationale |
|---------|----------|-----------|
| `document_highlight()` | CRITICAL | Immediate visual feedback when clicking on a symbol |
| `references()` | HIGH | User-initiated "Find All References" action |
| `workspace_symbol()` | HIGH | User-initiated workspace symbol search (Ctrl+T) |
| `document_formatting()` | HIGH | User-initiated format document command |
| `range_formatting()` | HIGH | User-initiated format selection command |
| `rename()` | HIGH | User-initiated refactoring operation |
| `semantic_tokens_full()` | NORMAL | Background syntax highlighting |
| `code_lens()` | NORMAL | Background reference counting |
| `inlay_hint()` | NORMAL | Background type annotation hints |
| `folding_range()` | NORMAL | Background code folding detection |

### Background Operations

Non-handler operations also use the thread pool:

| Operation | Priority | Location |
|-----------|----------|----------|
| Document parsing | HIGH | `schedule_document_update()` |
| Syntax diagnostics | HIGH | `schedule_document_update()` |
| Semantic diagnostics | NORMAL | `schedule_document_update()` |
| Workspace scanning | NORMAL | `scan_workspace_folders_with_progress()` |

## Monitoring and Debugging

### Task Statistics

Get current thread pool statistics:

```python
stats = ls.get_thread_pool_stats()
print(stats)
# ThreadPool Stats: Active=2, Queued=5, Completed=10, Failed=1, Workers=4
```

### Log Thread Pool Stats

Log statistics at DEBUG level:

```python
ls.log_thread_pool_stats()
```

### Task Information

When monitoring is enabled (default), detailed information about each task is tracked:

```python
# Get info about a specific task
task_info = manager.get_task_info(task_id)
print(f"Duration: {task_info.duration()}s")
print(f"Wait time: {task_info.wait_time()}s")

# Get all task info
all_info = manager.get_all_task_info()
for info in all_info:
    print(f"{info.name}: {info.status}")
```

## Configuration

### Worker Count

The thread pool automatically configures an optimal number of workers:

```python
max_workers = min(4, (os.cpu_count() or 1) + 1)
```

This balances parallelism with resource usage. For a typical quad-core system, this results in 4 workers.

### Custom Configuration

For testing or special scenarios, you can customize the thread pool:

```python
manager = ThreadPoolManager(
    max_workers=2,
    thread_name_prefix="my-worker",
    enable_monitoring=True
)
```

## Shutdown Behavior

The thread pool supports graceful shutdown with configurable timeout:

```python
# Wait for all tasks to complete (up to 10 seconds)
success = manager.shutdown(wait=True, timeout=10)

# Don't wait, cancel pending tasks
manager.shutdown(wait=False)
```

The language server automatically shuts down the thread pool during the LSP shutdown sequence.

## Testing

Comprehensive tests are provided in `tests/test_thread_manager.py`:

- **28 test cases** covering all functionality
- **Thread safety tests** for concurrent access
- **Error handling tests** for failure isolation
- **Performance tests** for multi-task scenarios

Run the tests:

```bash
pytest tests/test_thread_manager.py -v
```

## Benefits Over pygls Threading

### Before (pygls @server.thread())

```python
@server.feature(types.TEXT_DOCUMENT_REFERENCES)
@server.thread()  # Generic thread pool, no priority
def references(ls, params):
    # Synchronous implementation
    return find_references()
```

**Limitations:**
- No priority control
- Limited monitoring
- No task statistics
- Generic threading for all operations

### After (Custom ThreadPoolManager)

```python
@server.feature(types.TEXT_DOCUMENT_REFERENCES)
async def references(ls, params):
    def _sync():
        return find_references()
    
    # Priority-based, monitored execution
    return await ls.run_in_thread(
        _sync,
        priority=TaskPriority.HIGH,
        task_name="find_references"
    )
```

**Advantages:**
- ✅ **Priority-based scheduling**: Critical tasks execute first
- ✅ **Comprehensive monitoring**: Track all task metrics
- ✅ **Better debugging**: Named tasks with detailed logging
- ✅ **Unified management**: Single thread pool for all operations
- ✅ **Resource control**: Configurable worker count and shutdown behavior
- ✅ **Battle-tested**: 28 unit tests covering all scenarios

## Future Enhancements

Potential areas for future improvement:

1. **Dynamic priority adjustment**: Automatically boost priority for long-running tasks
2. **Task queuing strategies**: FIFO vs priority queue vs work stealing
3. **Resource limits**: Memory and CPU usage monitoring per task
4. **Task dependencies**: Support for task chains and dependencies
5. **Distributed processing**: Horizontal scaling across multiple processes

## See Also

- `pychivalry/thread_manager.py`: Implementation
- `tests/test_thread_manager.py`: Test suite
- `pychivalry/server.py`: Integration with LSP server
