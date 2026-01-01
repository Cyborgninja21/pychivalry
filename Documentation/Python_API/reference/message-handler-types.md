# Message Handler Types

**Module:** Message handling in pygls

## Overview

pygls provides several decorator types for handling Language Server Protocol messages. These decorators register handlers for different types of LSP messages.

## Handler Types

### @server.feature()

Registers a handler for LSP requests and notifications.

**Usage:**
```python
@server.feature('textDocument/completion')
def completion_handler(params: CompletionParams):
    # Handle completion request
    return completion_list
```

### @server.command()

Registers a handler for custom commands that can be invoked by the client.

**Usage:**
```python
@server.command('myServer.customCommand')
def custom_command_handler(args):
    # Handle custom command
    return result
```

### @server.thread()

Runs the decorated handler in a separate thread, preventing blocking of the main event loop.

**Usage:**
```python
@server.thread()
@server.feature('textDocument/documentSymbol')
def document_symbols(params: DocumentSymbolParams):
    # Long-running operation
    return symbols
```

## Common LSP Features

### Text Document Synchronization

- `textDocument/didOpen`: Document opened
- `textDocument/didChange`: Document changed
- `textDocument/didSave`: Document saved
- `textDocument/didClose`: Document closed

### Language Features

- `textDocument/completion`: Code completion
- `textDocument/hover`: Hover information
- `textDocument/signatureHelp`: Signature help
- `textDocument/definition`: Go to definition
- `textDocument/references`: Find references
- `textDocument/documentHighlight`: Document highlights
- `textDocument/documentSymbol`: Document symbols
- `textDocument/codeAction`: Code actions
- `textDocument/codeLens`: Code lens
- `textDocument/documentLink`: Document links
- `textDocument/formatting`: Document formatting
- `textDocument/rangeFormatting`: Range formatting
- `textDocument/rename`: Rename symbol

### Workspace Features

- `workspace/symbol`: Workspace symbols
- `workspace/executeCommand`: Execute command
- `workspace/didChangeConfiguration`: Configuration changed
- `workspace/didChangeWatchedFiles`: Watched files changed

## Example

```python
from pygls.server import LanguageServer
from lsprotocol.types import (
    CompletionParams,
    CompletionList,
    CompletionItem,
    TEXT_DOCUMENT_COMPLETION
)

server = LanguageServer('example', 'v0.1')

@server.feature(TEXT_DOCUMENT_COMPLETION)
def completion(params: CompletionParams):
    items = [
        CompletionItem(label='item1'),
        CompletionItem(label='item2'),
    ]
    return CompletionList(is_incomplete=False, items=items)

@server.command('example.doSomething')
def do_something(args):
    server.show_message('Command executed!')
    return {'success': True}
```
