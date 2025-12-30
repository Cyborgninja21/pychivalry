# pygls JSON Server Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/json-server.html

## Overview

This larger example demonstrates a number of pygls' advanced capabilities:

- Defining custom commands
- Progress updates
- Fetching configuration values from the client
- Async methods
- Dynamic method (un)registration
- Starting a TCP/WebSocket server

## Complete Code Example

```python
import asyncio
import uuid
from functools import partial
from typing import Optional

from lsprotocol import types as lsp

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer


class JsonLanguageServer(LanguageServer):
    CMD_PROGRESS = "progress"
    CMD_REGISTER_COMPLETIONS = "registerCompletions"
    CMD_SHOW_CONFIGURATION_ASYNC = "showConfigurationAsync"
    CMD_SHOW_CONFIGURATION_CALLBACK = "showConfigurationCallback"
    CMD_SHOW_CONFIGURATION_THREAD = "showConfigurationThread"
    CMD_UNREGISTER_COMPLETIONS = "unregisterCompletions"

    CONFIGURATION_SECTION = "pygls.jsonServer"

    def __init__(self, *args):
        super().__init__(*args)


json_server = JsonLanguageServer("pygls-json-example", "v0.1")


@json_server.feature(
    lsp.TEXT_DOCUMENT_COMPLETION,
    lsp.CompletionOptions(trigger_characters=[","], all_commit_characters=[":"]),
)
def completions(params: Optional[lsp.CompletionParams] = None) -> lsp.CompletionList:
    """Returns completion items."""
    return lsp.CompletionList(
        is_incomplete=False,
        items=[
            lsp.CompletionItem(label='"'),
            lsp.CompletionItem(label="["),
            lsp.CompletionItem(label="]"),
            lsp.CompletionItem(label="{"),
            lsp.CompletionItem(label="}"),
        ],
    )


@json_server.command(JsonLanguageServer.CMD_PROGRESS)
async def progress(ls: JsonLanguageServer, *args):
    """Create and start the progress on the client."""
    token = str(uuid.uuid4())
    # Create
    await ls.work_done_progress.create_async(token)
    # Begin
    ls.work_done_progress.begin(
        token,
        lsp.WorkDoneProgressBegin(title="Indexing", percentage=0, cancellable=True),
    )
    # Report
    for i in range(1, 10):
        # Check for cancellation from client
        if ls.work_done_progress.tokens[token].cancelled():
            # ... and stop the computation if client cancelled
            return
        ls.work_done_progress.report(
            token,
            lsp.WorkDoneProgressReport(message=f"{i * 10}%", percentage=i * 10),
        )
        await asyncio.sleep(2)
    # End
    ls.work_done_progress.end(token, lsp.WorkDoneProgressEnd(message="Finished"))


@json_server.command(JsonLanguageServer.CMD_REGISTER_COMPLETIONS)
async def register_completions(ls: JsonLanguageServer, *args):
    """Register completions method on the client."""
    params = lsp.RegistrationParams(
        registrations=[
            lsp.Registration(
                id=str(uuid.uuid4()),
                method=lsp.TEXT_DOCUMENT_COMPLETION,
                register_options={"triggerCharacters": "[':']"},
            )
        ]
    )

    try:
        await ls.client_register_capability_async(params)
        ls.window_show_message(
            lsp.ShowMessageParams(
                message="Successfully registered completions method",
                type=lsp.MessageType.Info,
            ),
        )
    except Exception:
        ls.window_show_message(
            lsp.ShowMessageParams(
                message="Error happened during completions registration.",
                type=lsp.MessageType.Error,
            ),
        )


@json_server.command(JsonLanguageServer.CMD_UNREGISTER_COMPLETIONS)
async def unregister_completions(ls: JsonLanguageServer, *args):
    """Unregister completions method on the client."""
    params = lsp.UnregistrationParams(
        unregisterations=[
            lsp.Unregistration(
                id=str(uuid.uuid4()),
                method=lsp.TEXT_DOCUMENT_COMPLETION,
            ),
        ],
    )

    try:
        await ls.client_unregister_capability_async(params)
        ls.window_show_message(
            lsp.ShowMessageParams(
                message="Successfully unregistered completions method",
                type=lsp.MessageType.Info,
            ),
        )
    except Exception:
        ls.window_show_message(
            lsp.ShowMessageParams(
                message="Error happened during completions unregistration.",
                type=lsp.MessageType.Error,
            ),
        )


def handle_config(ls: JsonLanguageServer, config):
    """Handle the configuration sent by the client."""
    try:
        example_config = config[0].get("exampleConfiguration")

        ls.window_show_message(
            lsp.ShowMessageParams(
                message=f"jsonServer.exampleConfiguration value: {example_config}",
                type=lsp.MessageType.Info,
            ),
        )

    except Exception as e:
        ls.window_log_message(
            lsp.LogMessageParams(
                message=f"Error ocurred: {e}",
                type=lsp.MessageType.Error,
            ),
        )


@json_server.command(JsonLanguageServer.CMD_SHOW_CONFIGURATION_ASYNC)
async def show_configuration_async(ls: JsonLanguageServer, *args):
    """Gets exampleConfiguration from the client settings using coroutines."""
    config = await ls.workspace_configuration_async(
        lsp.ConfigurationParams(
            items=[
                lsp.ConfigurationItem(
                    scope_uri="",
                    section=JsonLanguageServer.CONFIGURATION_SECTION,
                ),
            ]
        )
    )
    handle_config(ls, config)


@json_server.command(JsonLanguageServer.CMD_SHOW_CONFIGURATION_CALLBACK)
def show_configuration_callback(ls: JsonLanguageServer, *args):
    """Gets exampleConfiguration from the client settings using callback."""

    ls.workspace_configuration(
        lsp.ConfigurationParams(
            items=[
                lsp.ConfigurationItem(
                    scope_uri="",
                    section=JsonLanguageServer.CONFIGURATION_SECTION,
                ),
            ]
        ),
        callback=partial(handle_config, ls),
    )


@json_server.thread()
@json_server.command(JsonLanguageServer.CMD_SHOW_CONFIGURATION_THREAD)
def show_configuration_thread(ls: JsonLanguageServer, *args):
    """Gets exampleConfiguration from the client settings using thread pool."""
    config = ls.workspace_configuration(
        lsp.ConfigurationParams(
            items=[
                lsp.ConfigurationItem(
                    scope_uri="",
                    section=JsonLanguageServer.CONFIGURATION_SECTION,
                ),
            ],
        )
    ).result(2)
    handle_config(ls, config)


if __name__ == "__main__":
    start_server(json_server)
```

## Key Concepts

### 1. Custom LanguageServer Class with Command Constants

Define command names as class constants:

```python
class JsonLanguageServer(LanguageServer):
    CMD_PROGRESS = "progress"
    CMD_REGISTER_COMPLETIONS = "registerCompletions"
    CONFIGURATION_SECTION = "pygls.jsonServer"
```

### 2. Completion with Options

Register completions with trigger characters:

```python
@json_server.feature(
    lsp.TEXT_DOCUMENT_COMPLETION,
    lsp.CompletionOptions(trigger_characters=[","], all_commit_characters=[":"]),
)
def completions(params: Optional[lsp.CompletionParams] = None) -> lsp.CompletionList:
    return lsp.CompletionList(
        is_incomplete=False,
        items=[lsp.CompletionItem(label='"'), ...],
    )
```

### 3. Progress Updates

Show progress to the user during long-running operations:

```python
@json_server.command(JsonLanguageServer.CMD_PROGRESS)
async def progress(ls: JsonLanguageServer, *args):
    token = str(uuid.uuid4())
    
    # Create progress
    await ls.work_done_progress.create_async(token)
    
    # Begin progress
    ls.work_done_progress.begin(
        token,
        lsp.WorkDoneProgressBegin(title="Indexing", percentage=0, cancellable=True),
    )
    
    # Report progress
    for i in range(1, 10):
        if ls.work_done_progress.tokens[token].cancelled():
            return  # Handle cancellation
        ls.work_done_progress.report(
            token,
            lsp.WorkDoneProgressReport(message=f"{i * 10}%", percentage=i * 10),
        )
        await asyncio.sleep(2)
    
    # End progress
    ls.work_done_progress.end(token, lsp.WorkDoneProgressEnd(message="Finished"))
```

### 4. Dynamic Capability Registration

Register capabilities at runtime:

```python
@json_server.command(JsonLanguageServer.CMD_REGISTER_COMPLETIONS)
async def register_completions(ls: JsonLanguageServer, *args):
    params = lsp.RegistrationParams(
        registrations=[
            lsp.Registration(
                id=str(uuid.uuid4()),
                method=lsp.TEXT_DOCUMENT_COMPLETION,
                register_options={"triggerCharacters": "[':']"},
            )
        ]
    )
    await ls.client_register_capability_async(params)
```

### 5. Dynamic Capability Unregistration

Unregister capabilities at runtime:

```python
@json_server.command(JsonLanguageServer.CMD_UNREGISTER_COMPLETIONS)
async def unregister_completions(ls: JsonLanguageServer, *args):
    params = lsp.UnregistrationParams(
        unregisterations=[
            lsp.Unregistration(
                id=str(uuid.uuid4()),
                method=lsp.TEXT_DOCUMENT_COMPLETION,
            ),
        ],
    )
    await ls.client_unregister_capability_async(params)
```

### 6. Fetching Configuration - Three Approaches

**Async/Await:**
```python
@json_server.command(JsonLanguageServer.CMD_SHOW_CONFIGURATION_ASYNC)
async def show_configuration_async(ls: JsonLanguageServer, *args):
    config = await ls.workspace_configuration_async(
        lsp.ConfigurationParams(items=[...])
    )
    handle_config(ls, config)
```

**Callback:**
```python
@json_server.command(JsonLanguageServer.CMD_SHOW_CONFIGURATION_CALLBACK)
def show_configuration_callback(ls: JsonLanguageServer, *args):
    ls.workspace_configuration(
        lsp.ConfigurationParams(items=[...]),
        callback=partial(handle_config, ls),
    )
```

**Thread Pool:**
```python
@json_server.thread()
@json_server.command(JsonLanguageServer.CMD_SHOW_CONFIGURATION_THREAD)
def show_configuration_thread(ls: JsonLanguageServer, *args):
    config = ls.workspace_configuration(
        lsp.ConfigurationParams(items=[...])
    ).result(2)  # 2 second timeout
    handle_config(ls, config)
```

### 7. Showing Messages to User

```python
ls.window_show_message(
    lsp.ShowMessageParams(
        message="Success!",
        type=lsp.MessageType.Info,  # Info, Warning, Error
    ),
)
```

### 8. Logging Messages

```python
ls.window_log_message(
    lsp.LogMessageParams(
        message=f"Error occurred: {e}",
        type=lsp.MessageType.Error,
    ),
)
```

## Key Types Summary

| Type | Purpose |
|------|---------|
| `WorkDoneProgressBegin` | Start a progress notification |
| `WorkDoneProgressReport` | Update progress |
| `WorkDoneProgressEnd` | Complete progress |
| `RegistrationParams` | Register dynamic capabilities |
| `UnregistrationParams` | Unregister dynamic capabilities |
| `ConfigurationParams` | Request configuration from client |
| `ShowMessageParams` | Show message to user |
| `LogMessageParams` | Log message (output panel) |

## Related pygls Examples

- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html)
- [Threaded Handlers](https://pygls.readthedocs.io/en/latest/servers/examples/threaded-handlers.html)
- [Publish Diagnostics](https://pygls.readthedocs.io/en/latest/servers/examples/publish-diagnostics.html)

## References

- [LSP Specification - Progress](https://microsoft.github.io/language-server-protocol/specification.html#progress)
- [LSP Specification - Configuration](https://microsoft.github.io/language-server-protocol/specification.html#workspace_configuration)
