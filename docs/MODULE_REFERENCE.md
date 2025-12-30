# Module Reference Documentation

This document provides detailed documentation of each module in the pygls codebase.

---

## pygls Package (`pygls/__init__.py`)

The root package initializes platform detection flags:

| Constant | Description |
|----------|-------------|
| `IS_WIN` | `True` if running on Windows (`os.name == "nt"`) |
| `IS_PYODIDE` | `True` if running in Pyodide (WebAssembly Python) |
| `IS_WASI` | `True` if running in WASI environment |
| `IS_WASM` | `True` if running in any WebAssembly environment |

---

## Server Module (`pygls/server.py`)

### JsonRPCServer Class

The base server class for JSON-RPC communication.

#### Constructor

```python
def __init__(
    self,
    protocol_cls: Type[JsonRPCProtocol],
    converter_factory: Callable[[], cattrs.Converter],
    max_workers: int | None = None,
):
```

**Parameters:**
- `protocol_cls`: Protocol implementation (should derive from `JsonRPCProtocol`)
- `converter_factory`: Factory function for creating cattrs converters
- `max_workers`: Maximum thread pool workers (default: None, uses system default)

#### Methods

| Method | Description |
|--------|-------------|
| `start_io(stdin, stdout)` | Start server using stdio transport |
| `start_tcp(host, port)` | Start server using TCP transport |
| `start_ws(host, port)` | Start server using WebSocket transport |
| `shutdown()` | Gracefully shutdown the server |
| `feature(name, options)` | Decorator to register LSP features |
| `command(name)` | Decorator to register custom commands |
| `thread()` | Decorator to run handler in thread pool |
| `report_server_error(error, source)` | Error reporting hook (override for custom handling) |

#### Properties

| Property | Description |
|----------|-------------|
| `protocol` | The `JsonRPCProtocol` instance |
| `thread_pool` | Lazy-initialized `ThreadPoolExecutor` |

---

## Client Module (`pygls/client.py`)

### JsonRPCClient Class

Base JSON-RPC client for testing and communication with language servers.

#### Constructor

```python
def __init__(
    self,
    protocol_cls: Type[JsonRPCProtocol] = JsonRPCProtocol,
    converter_factory: Callable[[], Converter] = default_converter,
):
```

#### Methods

| Method | Description |
|--------|-------------|
| `start_io(cmd, *args, **kwargs)` | Start server subprocess and communicate via stdio |
| `start_tcp(host, port)` | Connect to server via TCP |
| `start_ws(host, port)` | Connect to server via WebSocket |
| `stop()` | Stop the client |
| `feature(name, options)` | Decorator to register feature handlers |
| `server_exit(server)` | Called when managed server process exits |
| `report_server_error(error, source)` | Error reporting hook |

#### Properties

| Property | Description |
|----------|-------------|
| `stopped` | `True` if the client has been stopped |
| `protocol` | The `JsonRPCProtocol` instance |

---

## LSP Package (`pygls/lsp/`)

### LanguageServer Class (`pygls/lsp/server.py`)

The main class for building language servers.

#### Constructor

```python
def __init__(
    self,
    name: str,
    version: str,
    text_document_sync_kind: TextDocumentSyncKind = TextDocumentSyncKind.Incremental,
    notebook_document_sync: NotebookDocumentSyncOptions | None = None,
    protocol_cls: Type[LanguageServerProtocol] = LanguageServerProtocol,
    converter_factory: Callable[[], Converter] = default_converter,
    max_workers: int | None = None,
):
```

**Parameters:**
- `name`: Server name (reported to clients)
- `version`: Server version
- `text_document_sync_kind`: How text documents are synchronized
- `notebook_document_sync`: Notebook sync options (optional)
- `protocol_cls`: Protocol class to use
- `converter_factory`: Factory for cattrs converters
- `max_workers`: Thread pool size

#### Key Methods

| Method | Description |
|--------|-------------|
| `show_message(message, type)` | Show message in client UI |
| `show_message_log(message, type)` | Log message to client output |
| `show_document(params)` | Request client to show a document |
| `publish_diagnostics(uri, diagnostics, version)` | Publish diagnostics for a document |
| `register_capability(registrations)` | Dynamically register capabilities |
| `unregister_capability(unregistrations)` | Dynamically unregister capabilities |
| `apply_edit(edit)` | Apply workspace edit |

#### Properties

| Property | Description |
|----------|-------------|
| `name` | Server name |
| `version` | Server version |
| `workspace` | Workspace instance (after initialization) |
| `client_capabilities` | Client capabilities (after initialization) |
| `server_capabilities` | Server capabilities (after initialization) |

### LanguageClient Class (`pygls/lsp/client.py`)

Client implementation for LSP communication.

```python
class LanguageClient(JsonRPCClient):
    """LSP-aware client for testing language servers."""
```

---

## Protocol Package (`pygls/protocol/`)

### JsonRPCProtocol Class (`json_rpc.py`)

Low-level JSON-RPC protocol implementation.

#### Key Methods

| Method | Description |
|--------|-------------|
| `set_writer(writer)` | Set output writer |
| `send_request(method, params)` | Send request and await response |
| `send_request_async(method, params)` | Send async request |
| `notify(method, params)` | Send notification |
| `data_received(data)` | Process received data |

### LanguageServerProtocol Class (`language_server.py`)

LSP-specific protocol with built-in handlers.

#### Built-in Feature Handlers

| Method | Handler |
|--------|---------|
| `initialize` | `lsp_initialize` |
| `initialized` | `lsp_initialized` |
| `shutdown` | `lsp_shutdown` |
| `exit` | `lsp_exit` |
| `textDocument/didOpen` | `lsp_text_document__did_open` |
| `textDocument/didChange` | `lsp_text_document__did_change` |
| `textDocument/didClose` | `lsp_text_document__did_close` |
| `notebookDocument/didOpen` | `lsp_notebook_document__did_open` |
| `notebookDocument/didChange` | `lsp_notebook_document__did_change` |
| `notebookDocument/didClose` | `lsp_notebook_document__did_close` |
| `workspace/didChangeWorkspaceFolders` | `lsp_workspace__did_change_workspace_folders` |
| `workspace/executeCommand` | `lsp_workspace__execute_command` |
| `$/setTrace` | `lsp_set_trace` |
| `window/workDoneProgress/cancel` | `lsp_work_done_progress_cancel` |

---

## Workspace Package (`pygls/workspace/`)

### Workspace Class (`workspace.py`)

Manages workspace state including documents, folders, and notebooks.

#### Constructor

```python
def __init__(
    self,
    root_uri: Optional[str],
    sync_kind: TextDocumentSyncKind = TextDocumentSyncKind.Incremental,
    workspace_folders: Optional[Sequence[WorkspaceFolder]] = None,
    position_encoding: Optional[Union[PositionEncodingKind, str]] = PositionEncodingKind.Utf16,
):
```

#### Methods

| Method | Description |
|--------|-------------|
| `get_text_document(uri)` | Get document by URI (creates if not exists) |
| `put_text_document(doc)` | Add document to workspace |
| `remove_text_document(uri)` | Remove document from workspace |
| `update_text_document(doc, change)` | Apply change to document |
| `get_notebook_document(uri)` | Get notebook by URI |
| `put_notebook_document(params)` | Add notebook to workspace |
| `remove_notebook_document(params)` | Remove notebook |
| `update_notebook_document(params)` | Update notebook |
| `add_folder(folder)` | Add workspace folder |
| `remove_folder(uri)` | Remove workspace folder |
| `is_local()` | Check if workspace is local filesystem |

#### Properties

| Property | Description |
|----------|-------------|
| `root_uri` | Workspace root URI |
| `root_path` | Workspace root filesystem path |
| `text_documents` | Dictionary of open documents |
| `notebook_documents` | Dictionary of open notebooks |
| `folders` | Dictionary of workspace folders |
| `position_encoding` | Position encoding kind |
| `position_codec` | PositionCodec instance |

### TextDocument Class (`text_document.py`)

Represents a text document with change tracking.

#### Constructor

```python
def __init__(
    self,
    uri: str,
    source: Optional[str] = None,
    version: Optional[int] = None,
    language_id: Optional[str] = None,
    sync_kind: TextDocumentSyncKind = TextDocumentSyncKind.Incremental,
    position_codec: Optional[PositionCodec] = None,
):
```

#### Properties

| Property | Description |
|----------|-------------|
| `uri` | Document URI |
| `source` | Full document content |
| `lines` | List of document lines |
| `version` | Document version |
| `language_id` | Language identifier |
| `line_count` | Number of lines |
| `filename` | Document filename |
| `path` | Document filesystem path |
| `position_codec` | PositionCodec instance |

#### Methods

| Method | Description |
|--------|-------------|
| `apply_change(change)` | Apply content change event |
| `offset_at_position(position)` | Get byte offset for position |
| `position_at_offset(offset)` | Get position for byte offset |
| `word_at_position(position)` | Get word at position |

### PositionCodec Class (`position_codec.py`)

Handles position encoding conversions (UTF-16, UTF-32).

---

## Feature Manager (`pygls/feature_manager.py`)

### FeatureManager Class

Manages feature and command registration.

#### Properties

| Property | Description |
|----------|-------------|
| `features` | Registered feature handlers |
| `builtin_features` | Built-in feature handlers |
| `commands` | Registered command handlers |
| `feature_options` | Options for registered features |

#### Decorators

```python
@feature_manager.feature("textDocument/completion", options)
def handler(params):
    pass

@feature_manager.command("my.custom.command")
def command_handler(args):
    pass

@feature_manager.thread()
def threaded_handler(params):
    # Runs in thread pool
    pass
```

---

## Capabilities (`pygls/capabilities.py`)

### ServerCapabilitiesBuilder Class

Builds server capabilities based on registered features.

#### Constructor

```python
def __init__(
    self,
    client_capabilities: ClientCapabilities,
    feature_names: Set[str],
    feature_options: Dict[str, Any],
    command_names: List[str],
    text_document_sync_kind: TextDocumentSyncKind,
    notebook_document_sync: Optional[NotebookDocumentSyncOptions],
    position_encoding: Optional[PositionEncodingKind],
):
```

#### Methods

| Method | Description |
|--------|-------------|
| `build()` | Build and return `ServerCapabilities` |
| `choose_position_encoding(caps)` | Select position encoding based on client capabilities |

---

## I/O Module (`pygls/io_.py`)

### Classes and Functions

| Name | Description |
|------|-------------|
| `StdinAsyncReader` | Async reader for stdin |
| `StdoutWriter` | Writer for stdout |
| `run_async(stop_event, reader, protocol, ...)` | Main async event loop |
| `run(stop_event, reader, protocol, ...)` | Synchronous event loop |
| `run_websocket(stop_event, websocket, protocol, ...)` | WebSocket event loop |

---

## Exceptions (`pygls/exceptions.py`)

| Exception | Description |
|-----------|-------------|
| `PyglsError` | Base pygls exception |
| `JsonRpcException` | JSON-RPC protocol error |
| `JsonRpcInvalidRequest` | Invalid request error |
| `JsonRpcMethodNotFound` | Method not found error |
| `JsonRpcInvalidParams` | Invalid parameters error |
| `JsonRpcInternalError` | Internal error |
| `FeatureAlreadyRegisteredError` | Duplicate feature |
| `CommandAlreadyRegisteredError` | Duplicate command |
| `ValidationError` | Validation failure |
| `ThreadDecoratorError` | Invalid thread decorator use |

---

## URI Utilities (`pygls/uris.py`)

### Functions

| Function | Description |
|----------|-------------|
| `from_fs_path(path)` | Convert filesystem path to URI |
| `to_fs_path(uri)` | Convert URI to filesystem path |
| `uri_scheme(uri)` | Get URI scheme |
| `uri_with_path(uri, new_path)` | Create URI with different path |
| `urlparse(uri)` | Parse URI components |

---

## Progress Reporting (`pygls/progress.py`)

### Progress Class

Manages work done progress tokens.

#### Methods

| Method | Description |
|--------|-------------|
| `create(token)` | Create a progress token |
| `begin(token, value)` | Begin progress |
| `report(token, value)` | Report progress |
| `end(token, value)` | End progress |

---

## CLI Module (`pygls/cli.py`)

Provides command-line utilities for language servers.

### Functions

| Function | Description |
|----------|-------------|
| `start_server(server, args)` | Start server with CLI arguments |
| `get_parser()` | Get argument parser |
