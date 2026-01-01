# pygls Threaded Handlers Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/threaded-handlers.html

## Overview

This example server demonstrates pygls' ability to run message handlers in a **separate thread**.

By default, handlers run on the main event loop, which means long-running operations will block other requests. The `@server.thread()` decorator allows you to run handlers in a thread pool without blocking.

## Complete Code Example

```python
import time
import threading

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer

server = LanguageServer("threaded-server", "v1")


@server.feature(
    types.TEXT_DOCUMENT_COMPLETION,
    types.CompletionOptions(trigger_characters=["."]),
)
def completions(params: types.CompletionParams | None = None) -> types.CompletionList:
    """Returns completion items."""
    return types.CompletionList(
        is_incomplete=False,
        items=[
            types.CompletionItem(label="one"),
            types.CompletionItem(label="two"),
            types.CompletionItem(label="three"),
            types.CompletionItem(label="four"),
            types.CompletionItem(label="five"),
        ],
    )


@server.command("count.down.blocking")
def count_down_blocking(ls: LanguageServer, *args):
    """Starts counting down and showing message synchronously.
    It will block the main thread, which can be tested by trying to show
    completion items.
    """
    thread = threading.current_thread()
    for i in range(10):
        ls.window_show_message(
            types.ShowMessageParams(
                message=f"Counting down in thread {thread.name!r} ... {10 - i}",
                type=types.MessageType.Info,
            ),
        )
        time.sleep(1)


@server.thread()
@server.command("count.down.thread")
def count_down_thread(ls: LanguageServer, *args):
    """Starts counting down and showing messages in a separate thread.
    It will NOT block the main thread, which can be tested by trying to show
    completion items.
    """
    thread = threading.current_thread()

    for i in range(10):
        ls.window_show_message(
            types.ShowMessageParams(
                message=f"Counting down in thread {thread.name!r} ... {10 - i}",
                type=types.MessageType.Info,
            ),
        )
        time.sleep(1)


@server.thread()
@server.command("count.down.error")
def count_down_error(ls: LanguageServer, *args):
    """A threaded handler that throws an error."""
    1 / 0


if __name__ == "__main__":
    start_server(server)
```

## Key Concepts

### 1. The `@server.thread()` Decorator

Add `@server.thread()` **before** other decorators to run the handler in a thread pool:

```python
@server.thread()
@server.command("count.down.thread")
def count_down_thread(ls: LanguageServer, *args):
    # This runs in a separate thread
    ...
```

### 2. Decorator Order Matters

The `@server.thread()` decorator must come **before** the `@server.command()` or `@server.feature()` decorator:

```python
# ✅ Correct order
@server.thread()
@server.command("my.command")
def my_handler(ls, *args):
    ...

# ❌ Wrong order - won't work as expected
@server.command("my.command")
@server.thread()
def my_handler(ls, *args):
    ...
```

### 3. Blocking vs Non-Blocking

**Without `@server.thread()` (blocking):**
```python
@server.command("count.down.blocking")
def count_down_blocking(ls: LanguageServer, *args):
    for i in range(10):
        ls.window_show_message(...)
        time.sleep(1)  # Blocks the entire server!
```

**With `@server.thread()` (non-blocking):**
```python
@server.thread()
@server.command("count.down.thread")
def count_down_thread(ls: LanguageServer, *args):
    for i in range(10):
        ls.window_show_message(...)
        time.sleep(1)  # Other requests can still be processed
```

### 4. Error Handling in Threads

Errors in threaded handlers are caught and logged:

```python
@server.thread()
@server.command("count.down.error")
def count_down_error(ls: LanguageServer, *args):
    1 / 0  # ZeroDivisionError - caught and logged
```

### 5. Checking Current Thread

Use `threading.current_thread()` to see which thread is running:

```python
thread = threading.current_thread()
ls.window_show_message(
    types.ShowMessageParams(
        message=f"Running in thread {thread.name!r}",
        type=types.MessageType.Info,
    ),
)
```

## When to Use Threaded Handlers

| Use Case | Use `@server.thread()` |
|----------|------------------------|
| Quick computations | No |
| Long-running operations | Yes |
| I/O-bound operations | Yes |
| CPU-intensive tasks | Yes |
| Blocking API calls | Yes |
| Simple lookups | No |

## Thread Safety Considerations

When using threaded handlers, be aware of thread safety:

1. **Shared state** - Use locks when accessing shared data
2. **Document state** - The document may change between reads
3. **LSP methods** - pygls methods like `window_show_message` are thread-safe

### Example with Lock

```python
import threading

class MyServer(LanguageServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.data = {}
        self._lock = threading.Lock()
    
    def update_data(self, key, value):
        with self._lock:
            self.data[key] = value

server = MyServer("my-server", "v1")

@server.thread()
@server.command("my.command")
def my_handler(ls: MyServer, *args):
    ls.update_data("key", "value")  # Thread-safe
```

## Comparison: Blocking vs Threaded

| Aspect | Blocking Handler | Threaded Handler |
|--------|------------------|------------------|
| **Other requests** | Blocked | Processed normally |
| **UI responsiveness** | Frozen | Responsive |
| **Completion popup** | Won't show | Shows immediately |
| **Resource usage** | Single thread | Thread pool |
| **Complexity** | Simple | Thread safety needed |

## Common Use Cases

1. **File system operations** - Reading/writing large files
2. **External API calls** - HTTP requests, database queries
3. **Heavy parsing** - Parsing large documents
4. **Index building** - Creating search indexes
5. **Linting/type checking** - Running external tools

## Related pygls Examples

- [JSON Server](https://pygls.readthedocs.io/en/latest/servers/examples/json-server.html) (shows async patterns)
- [Publish Diagnostics](https://pygls.readthedocs.io/en/latest/servers/examples/publish-diagnostics.html)
- [Semantic Tokens](https://pygls.readthedocs.io/en/latest/servers/examples/semantic-tokens.html)

## References

- [Python threading module](https://docs.python.org/3/library/threading.html)
- [pygls Documentation](https://pygls.readthedocs.io/en/latest/)
