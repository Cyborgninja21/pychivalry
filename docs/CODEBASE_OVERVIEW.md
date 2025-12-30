# pygls Codebase Overview

This document provides a comprehensive overview of the **pygls** (pronounced "pie glass") codebase, which serves as the foundation for building the CK3 Language Server. pygls is a pythonic generic implementation of the Language Server Protocol (LSP).

## Table of Contents

1. [Project Structure](#project-structure)
2. [Core Components](#core-components)
3. [Module Documentation](#module-documentation)
4. [Examples](#examples)
5. [Testing](#testing)
6. [Future Development](#future-development)

---

## Project Structure

```
pychivalry/
├── pygls/                    # Core library source code
│   ├── __init__.py          # Package initialization with platform detection
│   ├── capabilities.py       # Server capabilities builder
│   ├── cli.py               # Command-line interface utilities
│   ├── client.py            # JSON-RPC client implementation
│   ├── constants.py         # Constants and configuration values
│   ├── exceptions.py        # Custom exception classes
│   ├── feature_manager.py   # Feature registration and management
│   ├── io_.py               # I/O handling (stdin/stdout, async readers)
│   ├── progress.py          # Progress reporting utilities
│   ├── server.py            # JSON-RPC server implementation
│   ├── uris.py              # URI handling utilities
│   ├── lsp/                  # LSP-specific implementations
│   │   ├── __init__.py
│   │   ├── _base_client.py  # Base LSP client class
│   │   ├── _base_server.py  # Base LSP server class
│   │   ├── _capabilities.py # Capability definitions
│   │   ├── client.py        # LSP client (LanguageClient)
│   │   └── server.py        # LSP server (LanguageServer)
│   ├── protocol/             # Protocol implementation
│   │   ├── __init__.py
│   │   ├── json_rpc.py      # JSON-RPC protocol handler
│   │   └── language_server.py # LSP protocol implementation
│   └── workspace/            # Workspace management
│       ├── __init__.py
│       ├── position_codec.py # Position encoding/decoding
│       ├── text_document.py  # Text document handling
│       └── workspace.py      # Workspace state management
├── examples/                 # Example language servers
│   ├── hello-world/         # Simple hello world example
│   └── servers/             # Feature-specific examples
├── tests/                   # Test suite
├── docs/                    # Documentation (Sphinx-based)
├── scripts/                 # Build and maintenance scripts
├── pyproject.toml          # Project configuration and dependencies
└── uv.lock                 # Dependency lock file
```

---

## Core Components

### 1. JSON-RPC Server (`pygls/server.py`)

The `JsonRPCServer` class is the foundation for all server implementations:

```python
class JsonRPCServer:
    """Base server class for JSON-RPC communication."""
    
    def __init__(self, protocol_cls, converter_factory, max_workers=None):
        # Initializes the server with protocol and converter
        pass
    
    def start_io(self, stdin=None, stdout=None):
        """Starts an IO server (stdin/stdout communication)."""
        pass
    
    def start_tcp(self, host, port):
        """Starts a TCP server."""
        pass
    
    def start_ws(self, host, port):
        """Starts a WebSocket server."""
        pass
```

**Key Features:**
- Supports multiple transport mechanisms: stdio, TCP, WebSocket
- Thread pool for parallel execution
- Decorator-based feature and command registration
- Async/sync operation modes

### 2. Language Server (`pygls/lsp/server.py`)

The `LanguageServer` class extends `JsonRPCServer` with LSP-specific functionality:

```python
from pygls.lsp.server import LanguageServer
from lsprotocol import types

server = LanguageServer("server-name", "v1.0")

@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def completions(params: types.CompletionParams):
    return types.CompletionList(is_incomplete=False, items=[])

server.start_io()
```

**Key Methods:**
- `feature(name, options)`: Decorator to register LSP features
- `command(name)`: Decorator to register custom commands
- `thread()`: Decorator to mark functions for thread execution
- `send_notification()`: Send notifications to the client
- `show_message()`: Display messages in the client

### 3. Feature Manager (`pygls/feature_manager.py`)

The `FeatureManager` handles registration and management of LSP features and commands:

```python
class FeatureManager:
    """Manages server features and commands."""
    
    @property
    def features(self):
        """Returns registered features."""
        pass
    
    @property
    def commands(self):
        """Returns registered commands."""
        pass
    
    def feature(self, feature_name, options=None):
        """Decorator for registering features."""
        pass
    
    def command(self, command_name):
        """Decorator for registering commands."""
        pass
```

### 4. Workspace Management (`pygls/workspace/`)

The workspace module handles document and folder management:

#### Workspace Class (`workspace.py`)
```python
class Workspace:
    """Manages workspace state including documents and folders."""
    
    def get_text_document(self, doc_uri):
        """Retrieves a text document by URI."""
        pass
    
    def put_text_document(self, text_document):
        """Adds a document to the workspace."""
        pass
    
    def update_text_document(self, text_doc, change):
        """Applies changes to a document."""
        pass
```

#### TextDocument Class (`text_document.py`)
```python
class TextDocument:
    """Represents a text document with change tracking."""
    
    @property
    def source(self):
        """Returns document content."""
        pass
    
    @property
    def lines(self):
        """Returns document lines."""
        pass
    
    def apply_change(self, change):
        """Applies a content change."""
        pass
```

#### PositionCodec (`position_codec.py`)
Handles position encoding/decoding for UTF-16/UTF-32 conversion.

### 5. Protocol Implementation (`pygls/protocol/`)

#### JSON-RPC Protocol (`json_rpc.py`)
```python
class JsonRPCProtocol:
    """Handles JSON-RPC message encoding/decoding."""
    
    def handle_message(self, message):
        """Processes incoming messages."""
        pass
    
    def send_request(self, method, params):
        """Sends a request to the client."""
        pass
    
    def notify(self, method, params):
        """Sends a notification."""
        pass
```

#### Language Server Protocol (`language_server.py`)
```python
class LanguageServerProtocol(JsonRPCProtocol):
    """LSP-specific protocol implementation."""
    
    # Built-in feature handlers:
    # - initialize
    # - initialized  
    # - shutdown
    # - exit
    # - textDocument/didOpen
    # - textDocument/didChange
    # - textDocument/didClose
    # - workspace/executeCommand
    # etc.
```

### 6. I/O Handling (`pygls/io_.py`)

Provides async I/O primitives for server communication:
- `StdinAsyncReader`: Async stdin reader
- `StdoutWriter`: Stdout writer
- `run_async()`: Main async event loop
- `run_websocket()`: WebSocket communication handler

### 7. Capabilities Builder (`pygls/capabilities.py`)

The `ServerCapabilitiesBuilder` constructs server capabilities based on registered features:

```python
class ServerCapabilitiesBuilder:
    """Builds ServerCapabilities based on registered features."""
    
    def build(self):
        """Returns the server's capability set."""
        pass
```

---

## Module Documentation

### pygls/__init__.py

Platform detection constants:
- `IS_WIN`: True if running on Windows
- `IS_PYODIDE`: True if running in Pyodide (WebAssembly Python)
- `IS_WASI`: True if running in WASI environment
- `IS_WASM`: True if running in any WebAssembly environment

### pygls/constants.py

Key constants for feature management:
- `ATTR_FEATURE_TYPE`: Marker for feature decorators
- `ATTR_COMMAND_TYPE`: Marker for command decorators
- `ATTR_EXECUTE_IN_THREAD`: Marker for threaded execution
- `PARAM_LS`: Parameter name for language server injection

### pygls/exceptions.py

Custom exceptions:
- `PyglsError`: Base pygls exception
- `JsonRpcException`: JSON-RPC protocol errors
- `FeatureAlreadyRegisteredError`: Duplicate feature registration
- `CommandAlreadyRegisteredError`: Duplicate command registration
- `ValidationError`: Validation failures
- `ThreadDecoratorError`: Invalid thread decorator usage

### pygls/uris.py

URI handling utilities:
- `from_fs_path(path)`: Convert filesystem path to URI
- `to_fs_path(uri)`: Convert URI to filesystem path
- `uri_scheme(uri)`: Extract URI scheme

### pygls/progress.py

Progress reporting support:
```python
class Progress:
    """Handles work done progress tokens."""
    
    async def create(self, token):
        """Creates a progress token."""
        pass
    
    def begin(self, token, value):
        """Begins progress reporting."""
        pass
    
    def report(self, token, value):
        """Reports progress update."""
        pass
    
    def end(self, token, value):
        """Ends progress reporting."""
        pass
```

---

## Examples

### Hello World Example (`examples/hello-world/main.py`)

A minimal example demonstrating basic completion:

```python
from pygls.lsp.server import LanguageServer
from lsprotocol import types

server = LanguageServer("example-server", "v0.1")

@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def completions(params: types.CompletionParams):
    items = []
    document = server.workspace.get_text_document(params.text_document.uri)
    current_line = document.lines[params.position.line].strip()
    if current_line.endswith("hello."):
        items = [
            types.CompletionItem(label="world"),
            types.CompletionItem(label="friend"),
        ]
    return types.CompletionList(is_incomplete=False, items=items)

server.start_io()
```

### Feature Examples (`examples/servers/`)

- **code_actions.py**: Code action providers
- **code_lens.py**: Code lens implementation
- **colors.py**: Document color providers
- **commands.py**: Custom command implementation
- **formatting.py**: Document formatting
- **goto.py**: Go to definition/declaration
- **hover.py**: Hover information
- **inlay_hints.py**: Inlay hints
- **json_server.py**: JSON language server example
- **links.py**: Document links
- **publish_diagnostics.py**: Publishing diagnostics
- **pull_diagnostics.py**: Pull diagnostics model
- **rename.py**: Rename refactoring
- **semantic_tokens.py**: Semantic token highlighting
- **symbols.py**: Document/workspace symbols
- **threaded_handlers.py**: Thread-based handlers

---

## Testing

The test suite is organized as follows:

```
tests/
├── conftest.py              # Pytest fixtures
├── test_document.py         # TextDocument tests
├── test_feature_manager.py  # FeatureManager tests
├── test_language_server.py  # LanguageServer tests
├── test_protocol.py         # Protocol tests
├── test_workspace.py        # Workspace tests
├── test_uris.py             # URI handling tests
├── e2e/                     # End-to-end tests
│   ├── test_completion.py
│   ├── test_hover.py
│   └── ...
├── lsp/                     # LSP-specific tests
└── pyodide/                 # WebAssembly tests
```

### Running Tests

```bash
# Install dependencies
uv sync --all-extras

# Run all tests
uv run --all-extras poe test

# Run Pyodide tests
uv run --all-extras poe test-pyodide
```

---

## Future Development

### Building the CK3 Language Server

To build a language server for Crusader Kings 3 using pygls:

1. **Create the server instance:**
```python
from pygls.lsp.server import LanguageServer

server = LanguageServer("ck3-language-server", "v0.1.0")
```

2. **Implement CK3-specific features:**
   - Completion for CK3 script keywords and variables
   - Diagnostics for syntax errors
   - Hover information for script elements
   - Go to definition for scopes and triggers
   - Document symbols for script structure

3. **Define CK3 file types:**
   - `.txt` files (events, decisions, etc.)
   - `.gui` files (UI definitions)
   - `.yml` files (localization)

4. **Parse CK3 script syntax:**
   - Implement a parser for Paradox script language
   - Build AST for semantic analysis
   - Validate against CK3 schemas

### Next Steps

1. Define CK3 script grammar and parser
2. Implement CK3-specific completions
3. Add diagnostic providers
4. Create hover providers for CK3 documentation
5. Implement go-to-definition for script references
6. Add document outline/symbols support
7. Create VS Code extension wrapper

---

## Dependencies

- **lsprotocol** (2025.0.0): LSP type definitions
- **cattrs** (>=23.1.2): Structured/unstructured data conversion
- **attrs** (>=24.3.0): Class boilerplate elimination

### Optional Dependencies

- **websockets** (>=13.0): WebSocket transport support

### Development Dependencies

- **pytest**: Testing framework
- **ruff**: Fast Python linter
- **mypy**: Static type checking
- **black**: Code formatting
- **sphinx**: Documentation generation

---

## License

This project uses pygls which is licensed under the Apache License 2.0. Original work from Palantir Technologies is licensed under the MIT License.
