# pygls Python API Documentation

This directory contains reference documentation for the pygls Python API.

**pygls** (pronounced like "pie glass") is a pythonic generic Language Server Protocol framework that allows you to write language servers in Python.

## About This Documentation

This documentation has been generated from the pygls package source code and provides comprehensive coverage of the Python API for building language servers.

## Contents

### Python API Reference

Core Python API modules for building language servers:

- [Clients](api-reference/clients.md) - Language client implementation
- [IO](api-reference/io.md) - Input/output handling
- [Protocol](api-reference/protocol.md) - JSON-RPC protocol implementation
- [Servers](api-reference/servers.md) - Language server implementation
- [Types](api-reference/types.md) - Protocol types and data structures
- [URIs](api-reference/uris.md) - URI handling utilities
- [Workspace](api-reference/workspace.md) - Workspace management

### Additional References

- [Logging](reference/logging.md) - Logging configuration and usage
- [Message Handler Types](reference/message-handler-types.md) - LSP message handlers and decorators

### Protocol Guides

- [Interpret Semantic Tokens](protocol/interpret-semantic-tokens.md) - Guide to semantic token encoding/decoding

### Server Features

- [Built-In Features](servers/built-in-features.md) - Built-in server features and utilities

## Quick Start

### Creating a Language Server

```python
from pygls.server import LanguageServer
from lsprotocol.types import (
    TEXT_DOCUMENT_COMPLETION,
    CompletionParams,
    CompletionList,
    CompletionItem
)

server = LanguageServer('my-language-server', 'v0.1')

@server.feature(TEXT_DOCUMENT_COMPLETION)
def completions(params: CompletionParams):
    items = [
        CompletionItem(label='example'),
        CompletionItem(label='test'),
    ]
    return CompletionList(is_incomplete=False, items=items)

if __name__ == '__main__':
    server.start_io()
```

### Running the Server

```python
python my_server.py
```

The server will communicate via stdin/stdout using the JSON-RPC protocol.

## Key Concepts

### Language Server Protocol (LSP)

The Language Server Protocol is a standard protocol for providing language intelligence features (like auto-completion, go to definition, etc.) in editors and IDEs. pygls implements this protocol in Python.

### Server Lifecycle

1. **Initialize**: Client sends initialization request
2. **Initialized**: Server confirms initialization
3. **Working**: Server handles requests/notifications
4. **Shutdown**: Client requests shutdown
5. **Exit**: Server exits

### Features

Features are LSP capabilities that your server provides. Common features include:

- Text synchronization (didOpen, didChange, didSave, didClose)
- Code completion
- Hover information
- Go to definition
- Find references
- Document symbols
- Diagnostics (errors/warnings)
- Code actions
- Formatting

### Message Handlers

Use decorators to register handlers:

```python
@server.feature('textDocument/completion')
def handle_completion(params):
    # Handle completion
    pass

@server.command('myServer.customCommand')
def handle_command(args):
    # Handle custom command
    pass
```

## Architecture

### Server

The `LanguageServer` class is the main entry point. It manages:
- Protocol communication
- Feature registration
- Workspace management
- Client capabilities

### Protocol

The protocol layer handles JSON-RPC communication between client and server.

### Workspace

The workspace manages:
- Open documents
- Workspace folders
- Document content and synchronization

## Advanced Topics

### Async Support

pygls supports async handlers:

```python
@server.feature('textDocument/hover')
async def hover(params):
    # Async operation
    result = await async_function()
    return result
```

### Threading

Run handlers in separate threads:

```python
@server.thread()
@server.feature('textDocument/documentSymbol')
def symbols(params):
    # Long-running operation in thread
    return compute_symbols()
```

### Progress Reporting

Report progress for long operations:

```python
from pygls.progress import Progress

@server.feature('myFeature')
async def my_feature(ls: LanguageServer, params):
    token = 'my-progress'
    ls.progress.create(token)
    ls.progress.begin(token, 'Starting...', percentage=0)
    
    # Do work
    ls.progress.report(token, 'Working...', percentage=50)
    
    ls.progress.end(token, 'Complete!')
```

## Resources

### Official Resources

- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/)
- [pygls GitHub Repository](https://github.com/openlawlibrary/pygls)
- [pygls Documentation (Online)](https://pygls.readthedocs.io/)

### Examples

Check the official pygls repository for examples:
- JSON language server
- Plain text language server
- Math language server

## Version

This documentation is based on **pygls 2.0.0**.

## License

pygls is licensed under the Apache License 2.0.

---

**Generated:** 2025-12-30 09:05:52
