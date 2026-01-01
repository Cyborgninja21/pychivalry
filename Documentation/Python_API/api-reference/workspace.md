# pygls.workspace.workspace

**Module:** `pygls.workspace.workspace`

No module documentation available.

## Classes

### Workspace

**Methods:**

- `__init__(self, root_uri: Optional[str], sync_kind: lsprotocol.types.TextDocumentSyncKind = <TextDocumentSyncKind.Incremental: 2>, workspace_folders: Optional[Sequence[lsprotocol.types.WorkspaceFolder]] = None, position_encoding: Union[lsprotocol.types.PositionEncodingKind, str, NoneType] = <PositionEncodingKind.Utf16: 'utf-16'>)`: Initialize self.  See help(type(self)) for accurate signature.
- `add_folder(self, folder: lsprotocol.types.WorkspaceFolder)`
- `get_notebook_document(self, *, notebook_uri: Optional[str] = None, cell_uri: Optional[str] = None) -> Optional[lsprotocol.types.NotebookDocument]`: Return the notebook corresponding with the given uri.
- `get_text_document(self, doc_uri: str) -> pygls.workspace.text_document.TextDocument`: Return a managed document if-present,
- `is_local(self)`
- `put_notebook_document(self, params: lsprotocol.types.DidOpenNotebookDocumentParams)`
- `put_text_document(self, text_document: lsprotocol.types.TextDocumentItem, notebook_uri: Optional[str] = None)`: Add a text document to the workspace.
- `remove_folder(self, folder_uri: str)`
- `remove_notebook_document(self, params: lsprotocol.types.DidCloseNotebookDocumentParams)`
- `remove_text_document(self, doc_uri: str)`
- `update_notebook_document(self, params: lsprotocol.types.DidChangeNotebookDocumentParams)`
- `update_text_document(self, text_doc: lsprotocol.types.VersionedTextDocumentIdentifier, change: Union[ForwardRef('TextDocumentContentChangePartial'), ForwardRef('TextDocumentContentChangeWholeDocument')])`

