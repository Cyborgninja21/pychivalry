# Built-In Features

## Overview

pygls provides several built-in features that language servers can use out of the box. These features simplify common language server tasks.

## Progress Reporting

Language servers can report progress for long-running operations.

```python
from pygls.server import LanguageServer

server = LanguageServer('example', 'v0.1')

@server.feature('textDocument/documentSymbol')
async def document_symbols(ls: LanguageServer, params):
    # Create progress token
    token = 'symbol-progress'
    
    # Start progress
    ls.progress.create(token)
    ls.progress.begin(token, 'Analyzing document...', percentage=0)
    
    try:
        # Do work...
        ls.progress.report(token, 'Processing symbols...', percentage=50)
        
        # More work...
        symbols = analyze_symbols(params.text_document.uri)
        
        ls.progress.report(token, 'Finalizing...', percentage=90)
        return symbols
        
    finally:
        ls.progress.end(token, 'Complete')
```

## Show Message

Display messages to the user in the client.

```python
from lsprotocol.types import MessageType

# Show information message
server.show_message('Server started successfully', MessageType.Info)

# Show warning
server.show_message('Configuration file not found', MessageType.Warning)

# Show error
server.show_message('Failed to parse document', MessageType.Error)
```

## Log Messages

Send log messages to the client's output channel.

```python
from lsprotocol.types import MessageType

server.show_message_log('Debug information', MessageType.Log)
```

## Workspace Management

### Get Workspace Folders

```python
@server.feature('initialized')
def initialized(params):
    folders = server.workspace.folders
    if folders:
        for folder in folders:
            server.show_message(f'Workspace: {folder.uri}')
```

### Get Document

```python
@server.feature('textDocument/completion')
def completion(params: CompletionParams):
    # Get document from workspace
    doc = server.workspace.get_document(params.text_document.uri)
    
    # Access document content
    text = doc.source
    lines = doc.lines
    
    # Get word at position
    word = doc.word_at_position(params.position)
```

## Configuration

### Get Configuration

```python
@server.feature('workspace/didChangeConfiguration')
async def did_change_config(params):
    # Get configuration from client
    config = await server.get_configuration_async('myServer')
    
    # Update server settings
    if config:
        server.show_message(f'Config updated: {config}')
```

## Publish Diagnostics

Report errors, warnings, and information to the client.

```python
from lsprotocol.types import (
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range
)

@server.feature('textDocument/didChange')
def did_change(params):
    doc = server.workspace.get_document(params.text_document.uri)
    
    # Validate document
    diagnostics = []
    
    for i, line in enumerate(doc.lines):
        if 'ERROR' in line:
            diagnostic = Diagnostic(
                range=Range(
                    start=Position(line=i, character=0),
                    end=Position(line=i, character=len(line))
                ),
                message='Error found in document',
                severity=DiagnosticSeverity.Error,
                source='example-linter'
            )
            diagnostics.append(diagnostic)
    
    # Publish diagnostics
    server.publish_diagnostics(doc.uri, diagnostics)
```

## Apply Workspace Edit

Make changes to files in the workspace.

```python
from lsprotocol.types import (
    WorkspaceEdit,
    TextEdit,
    Position,
    Range
)

@server.command('example.refactor')
async def refactor_code(args):
    uri = args[0]
    
    # Create edit
    edit = WorkspaceEdit(
        changes={
            uri: [
                TextEdit(
                    range=Range(
                        start=Position(line=0, character=0),
                        end=Position(line=0, character=0)
                    ),
                    new_text='// Refactored code
'
                )
            ]
        }
    )
    
    # Apply edit
    result = await server.apply_edit_async(edit)
    if result.applied:
        server.show_message('Refactoring applied')
    else:
        server.show_message('Refactoring failed', MessageType.Error)
```

## Server Lifecycle

### Initialize

```python
@server.feature('initialize')
def initialize(params):
    # Server initialization logic
    server.show_message('Server initializing...')
    return {}

@server.feature('initialized')
def initialized(params):
    server.show_message('Server initialized!')
```

### Shutdown

```python
@server.feature('shutdown')
def shutdown(params):
    # Cleanup before shutdown
    server.show_message('Server shutting down...')
    return None

@server.feature('exit')
def exit(params):
    # Final cleanup
    pass
```

## Example: Complete Server with Built-In Features

```python
from pygls.server import LanguageServer
from lsprotocol.types import (
    TEXT_DOCUMENT_DID_OPEN,
    TEXT_DOCUMENT_DID_CHANGE,
    DidOpenTextDocumentParams,
    DidChangeTextDocumentParams,
    MessageType
)

server = LanguageServer('example-server', 'v0.1')

@server.feature('initialize')
def initialize(params):
    server.show_message('Example server starting...', MessageType.Info)
    return {}

@server.feature(TEXT_DOCUMENT_DID_OPEN)
def did_open(params: DidOpenTextDocumentParams):
    doc = server.workspace.get_document(params.text_document.uri)
    server.show_message_log(f'Opened: {doc.uri}')

@server.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(params: DidChangeTextDocumentParams):
    doc = server.workspace.get_document(params.text_document.uri)
    server.show_message_log(f'Changed: {doc.uri}')
    
    # Validate and publish diagnostics
    # ... validation logic

if __name__ == '__main__':
    server.start_io()
```
