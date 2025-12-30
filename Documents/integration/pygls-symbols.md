# pygls Document & Workspace Symbols Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/symbols.html

## Overview

This implements the [textDocument/documentSymbol](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_documentSymbol) and [workspace/symbol](https://microsoft.github.io/language-server-protocol/specification.html#workspace_symbol) requests from the LSP specification.

In VSCode:
- **`textDocument/documentSymbol`** powers the [Outline View](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_outline-view) and [Goto Symbol in File](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_go-to-symbol-in-file) (Ctrl+Shift+O)
- **`workspace/symbol`** powers [Goto Symbol in Workspace](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_go-to-symbol-in-workspace) (Ctrl+T)

## Key Difference

The key difference is that `textDocument/documentSymbol` can provide a **symbol hierarchy** (nested symbols) whereas `workspace/symbol` is a **flat list**.

## Complete Code Example

```python
import logging
import re

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument

ARGUMENT = re.compile(r"(?P<name>\w+)(: ?(?P<type>\w+))?")
FUNCTION = re.compile(r"^fn ([a-z]\w+)\(([^)]*?)\)")
TYPE = re.compile(r"^type ([A-Z]\w+)\(([^)]*?)\)")


class SymbolsLanguageServer(LanguageServer):
    """Language server demonstrating the document and workspace symbol methods in
    the LSP specification."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.index = {}

    def parse(self, doc: TextDocument):
        typedefs = {}
        funcs = {}

        for linum, line in enumerate(doc.lines):
            if (match := TYPE.match(line)) is not None:
                self.parse_typedef(typedefs, linum, line, match)

            elif (match := FUNCTION.match(line)) is not None:
                self.parse_function(funcs, linum, line, match)

        self.index[doc.uri] = {
            "types": typedefs,
            "functions": funcs,
        }
        logging.info("Index: %s", self.index)

    def parse_function(self, funcs, linum, line, match):
        """Parse a function definition on the given line."""
        name = match.group(1)
        args = match.group(2)

        start_char = match.start() + line.find(name)
        args_offset = match.start() + line.find(args)

        funcs[name] = dict(
            range_=types.Range(
                start=types.Position(line=linum, character=start_char),
                end=types.Position(line=linum, character=start_char + len(name)),
            ),
            args=self.parse_args(args, linum, args_offset),
        )

    def parse_typedef(self, typedefs, linum, line, match):
        """Parse a type definition on the given line."""
        name = match.group(1)
        fields = match.group(2)

        start_char = match.start() + line.find(name)
        field_offset = match.start() + line.find(fields)

        typedefs[name] = dict(
            range_=types.Range(
                start=types.Position(line=linum, character=start_char),
                end=types.Position(line=linum, character=start_char + len(name)),
            ),
            fields=self.parse_args(fields, linum, field_offset),
        )

    def parse_args(self, text: str, linum: int, offset: int):
        """Parse arguments for a type or function definition"""
        arguments = {}

        for match in ARGUMENT.finditer(text):
            name = match.group("name")
            start_char = offset + text.find(name)

            arguments[name] = types.Range(
                start=types.Position(line=linum, character=start_char),
                end=types.Position(line=linum, character=start_char + len(name)),
            )

        return arguments


server = SymbolsLanguageServer("symbols-server", "v1")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: SymbolsLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: SymbolsLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(ls: SymbolsLanguageServer, params: types.DocumentSymbolParams):
    """Return all the symbols defined in the given document."""
    if (index := ls.index.get(params.text_document.uri)) is None:
        return None

    results = []
    for name, info in index.get("types", {}).items():
        range_ = info["range_"]
        type_symbol = types.DocumentSymbol(
            name=name,
            kind=types.SymbolKind.Class,
            range=types.Range(
                start=types.Position(line=range_.start.line, character=0),
                end=types.Position(line=range_.start.line + 1, character=0),
            ),
            selection_range=range_,
            children=[],
        )

        for name, range_ in info["fields"].items():
            field_symbol = types.DocumentSymbol(
                name=name,
                kind=types.SymbolKind.Field,
                range=range_,
                selection_range=range_,
            )
            type_symbol.children.append(field_symbol)

        results.append(type_symbol)

    for name, info in index.get("functions", {}).items():
        range_ = info["range_"]
        func_symbol = types.DocumentSymbol(
            name=name,
            kind=types.SymbolKind.Function,
            range=types.Range(
                start=types.Position(line=range_.start.line, character=0),
                end=types.Position(line=range_.start.line + 1, character=0),
            ),
            selection_range=range_,
            children=[],
        )

        for name, range_ in info["args"].items():
            arg_symbol = types.DocumentSymbol(
                name=name,
                kind=types.SymbolKind.Variable,
                range=range_,
                selection_range=range_,
            )
            func_symbol.children.append(arg_symbol)

        results.append(func_symbol)

    return results


@server.feature(types.WORKSPACE_SYMBOL)
def workspace_symbol(ls: SymbolsLanguageServer, params: types.WorkspaceSymbolParams):
    """Return all the symbols defined in the given document."""
    query = params.query
    results = []

    for uri, symbols in ls.index.items():
        for type_name, info in symbols.get("types", {}).items():
            if params.query == "" or type_name.startswith(query):
                func_symbol = types.WorkspaceSymbol(
                    name=type_name,
                    kind=types.SymbolKind.Class,
                    location=types.Location(uri=uri, range=info["range_"]),
                )
                results.append(func_symbol)

            for field_name, range_ in info["fields"].items():
                if params.query == "" or field_name.startswith(query):
                    field_symbol = types.WorkspaceSymbol(
                        name=field_name,
                        kind=types.SymbolKind.Field,
                        location=types.Location(uri=uri, range=range_),
                        container_name=type_name,
                    )
                    results.append(field_symbol)

        for func_name, info in symbols.get("functions", {}).items():
            if params.query == "" or func_name.startswith(query):
                func_symbol = types.WorkspaceSymbol(
                    name=func_name,
                    kind=types.SymbolKind.Function,
                    location=types.Location(uri=uri, range=info["range_"]),
                )
                results.append(func_symbol)

            for arg_name, range_ in info["args"].items():
                if params.query == "" or arg_name.startswith(query):
                    arg_symbol = types.WorkspaceSymbol(
                        name=arg_name,
                        kind=types.SymbolKind.Variable,
                        location=types.Location(uri=uri, range=range_),
                        container_name=func_name,
                    )
                    results.append(arg_symbol)

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Document Symbols (Hierarchical)

Return `DocumentSymbol` objects with nested children:

```python
@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(ls, params: types.DocumentSymbolParams):
    type_symbol = types.DocumentSymbol(
        name=name,
        kind=types.SymbolKind.Class,
        range=types.Range(...),       # Full range of symbol
        selection_range=range_,        # Range to highlight when selected
        children=[],                   # Nested symbols
    )
    
    # Add children
    for field_name, range_ in info["fields"].items():
        field_symbol = types.DocumentSymbol(
            name=field_name,
            kind=types.SymbolKind.Field,
            range=range_,
            selection_range=range_,
        )
        type_symbol.children.append(field_symbol)
```

### 2. Workspace Symbols (Flat List)

Return `WorkspaceSymbol` objects with location and optional container:

```python
@server.feature(types.WORKSPACE_SYMBOL)
def workspace_symbol(ls, params: types.WorkspaceSymbolParams):
    query = params.query  # Filter query from user
    
    results = []
    for uri, symbols in ls.index.items():
        for type_name, info in symbols.get("types", {}).items():
            if query == "" or type_name.startswith(query):
                results.append(types.WorkspaceSymbol(
                    name=type_name,
                    kind=types.SymbolKind.Class,
                    location=types.Location(uri=uri, range=info["range_"]),
                ))
            
            # Child symbols with container_name
            for field_name, range_ in info["fields"].items():
                results.append(types.WorkspaceSymbol(
                    name=field_name,
                    kind=types.SymbolKind.Field,
                    location=types.Location(uri=uri, range=range_),
                    container_name=type_name,  # Parent symbol name
                ))
```

### 3. DocumentSymbol Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `str` | Symbol name |
| `kind` | `SymbolKind` | Type of symbol |
| `range` | `Range` | Full extent of symbol |
| `selection_range` | `Range` | Range to highlight |
| `children` | `List[DocumentSymbol]` | Nested symbols |
| `detail` | `str` (optional) | Additional details |
| `tags` | `List[SymbolTag]` (optional) | Deprecated tag, etc. |

### 4. WorkspaceSymbol Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `str` | Symbol name |
| `kind` | `SymbolKind` | Type of symbol |
| `location` | `Location` | File URI and range |
| `container_name` | `str` (optional) | Parent symbol name |
| `tags` | `List[SymbolTag]` (optional) | Deprecated tag, etc. |

## SymbolKind Values

| Value | Kind | Value | Kind |
|-------|------|-------|------|
| 1 | File | 14 | Number |
| 2 | Module | 15 | Boolean |
| 3 | Namespace | 16 | Array |
| 4 | Package | 17 | Object |
| 5 | Class | 18 | Key |
| 6 | Method | 19 | Null |
| 7 | Property | 20 | EnumMember |
| 8 | Field | 21 | Struct |
| 9 | Constructor | 22 | Event |
| 10 | Enum | 23 | Operator |
| 11 | Interface | 24 | TypeParameter |
| 12 | Function | | |
| 13 | Variable | | |

## Document vs Workspace Symbols

| Aspect | Document Symbols | Workspace Symbols |
|--------|------------------|-------------------|
| **Scope** | Single file | Entire workspace |
| **Hierarchy** | Nested children | Flat with container_name |
| **Type** | `DocumentSymbol` | `WorkspaceSymbol` |
| **Location** | Implicit (same file) | Explicit `Location` |
| **VSCode Feature** | Outline, Ctrl+Shift+O | Ctrl+T |

## Query Filtering

Workspace symbols should filter by `params.query`:

```python
if params.query == "" or name.startswith(query):
    results.append(symbol)
```

## Related pygls Examples

- [Goto "X" and Find References](https://pygls.readthedocs.io/en/latest/servers/examples/goto.html)
- [Rename](https://pygls.readthedocs.io/en/latest/servers/examples/rename.html)
- [Semantic Tokens](https://pygls.readthedocs.io/en/latest/servers/examples/semantic-tokens.html)

## References

- [LSP Specification - textDocument/documentSymbol](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_documentSymbol)
- [LSP Specification - workspace/symbol](https://microsoft.github.io/language-server-protocol/specification.html#workspace_symbol)
- [VSCode Outline View](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_outline-view)
