# pygls.protocol.language_server

**Module:** `pygls.protocol.language_server`

No module documentation available.

## Classes

### LanguageServerProtocol

A class that represents language server protocol.

It contains implementations for generic LSP features.

Attributes:
    workspace(Workspace): In memory workspace

**Methods:**

- `__init__(self, server: 'LanguageServer', converter: 'Converter')`: Initialize self.  See help(type(self)) for accurate signature.
- `handle_message(self, message: 'RPCMessage')`: Delegates message to handlers depending on message type.
- `lsp_exit(self, *args) -> 'Generator[Any, Any, None]'`: Stops the server process.
- `lsp_initialize(self, params: 'types.InitializeParams') -> 'Generator[Any, Any, types.InitializeResult]'`: Method that initializes language server.
- `lsp_initialized(self, *args)`: Notification received when client and server are connected.
- `lsp_notebook_document__did_change(self, params: 'types.DidChangeNotebookDocumentParams')`: Update a notebook's contents
- `lsp_notebook_document__did_close(self, params: 'types.DidCloseNotebookDocumentParams')`: Remove a notebook document from the workspace.
- `lsp_notebook_document__did_open(self, params: 'types.DidOpenNotebookDocumentParams')`: Put a notebook document into the workspace
- `lsp_set_trace(self, params: 'types.SetTraceParams') -> 'Generator[Any, Any, None]'`: Changes server trace value.
- `lsp_shutdown(self, *args) -> 'Generator[Any, Any, None]'`: Request from client which asks server to shutdown.
- `lsp_text_document__did_change(self, params: 'types.DidChangeTextDocumentParams')`: Updates document's content.
- `lsp_text_document__did_close(self, params: 'types.DidCloseTextDocumentParams')`: Removes document from workspace.
- `lsp_text_document__did_open(self, params: 'types.DidOpenTextDocumentParams')`: Puts document to the workspace.
- `lsp_work_done_progress_cancel(self, params: 'types.WorkDoneProgressCancelParams')`: Received a progress cancellation from client.
- `lsp_workspace__did_change_workspace_folders(self, params: 'types.DidChangeWorkspaceFoldersParams')`: Adds/Removes folders from the workspace.
- `lsp_workspace__execute_command(self, params: 'types.ExecuteCommandParams') -> 'Generator[Any, Any, Any]'`: Executes commands with passed arguments and returns a value.
- `notify(self, method: 'str', params: 'Any | None' = None)`: Send a JSON-RPC notification.
- `send_request(self, method: 'str', params: 'Any | None' = None, callback: 'Callable[[Any], None] | None' = None, msg_id: 'MsgId | None' = None) -> 'Future[Any]'`: Send a JSON-RPC request
- `send_request_async(self, method: 'str', params: 'Any | None' = None, msg_id: 'MsgId | None' = None)`: Send a JSON-RPC request, asynchronously.
- `set_writer(self, writer: 'AsyncWriter | Writer', include_headers: 'bool' = True)`: Set the writer object to use when sending data
- `structure_message(self, data: 'dict[str, Any]')`: Function used to deserialize data recevied from the client.

## Functions

### lsp_method(method_name: 'str') -> 'Callable[[F], F]'

