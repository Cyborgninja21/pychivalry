# pygls Rename Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/rename.html

## Overview

This implements [textDocument/rename](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_rename) and [textDocument/prepareRename](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_prepareRename).

- **`textDocument/rename`** - Returns a collection of edits the client should perform to correctly rename all occurrences of the given symbol
- **`textDocument/prepareRename`** - Used by the client to check that it actually makes sense to rename the given symbol, giving the server a chance to reject the operation as invalid

> **Note:** This server's rename implementation is no different from a naive find and replace. A real server would have to check to make sure it only renames symbols in the relevant scope.

## Complete Code Example

```python
import logging
import re
from typing import List

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument

ARGUMENT = re.compile(r"(?P<name>\w+): (?P<type>\w+)")
FUNCTION = re.compile(r"^fn ([a-z]\w+)\(")
TYPE = re.compile(r"^type ([A-Z]\w+)\(")


class RenameLanguageServer(LanguageServer):
    """Language server demonstrating symbol renaming."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.index = {}

    def parse(self, doc: TextDocument):
        typedefs = {}
        funcs = {}

        for linum, line in enumerate(doc.lines):
            if (match := TYPE.match(line)) is not None:
                name = match.group(1)
                start_char = match.start() + line.find(name)

                typedefs[name] = types.Range(
                    start=types.Position(line=linum, character=start_char),
                    end=types.Position(line=linum, character=start_char + len(name)),
                )

            elif (match := FUNCTION.match(line)) is not None:
                name = match.group(1)
                start_char = match.start() + line.find(name)

                funcs[name] = types.Range(
                    start=types.Position(line=linum, character=start_char),
                    end=types.Position(line=linum, character=start_char + len(name)),
                )

        self.index[doc.uri] = {
            "types": typedefs,
            "functions": funcs,
        }
        logging.info("Index: %s", self.index)


server = RenameLanguageServer("rename-server", "v1")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: RenameLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: RenameLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_RENAME)
def rename(ls: RenameLanguageServer, params: types.RenameParams):
    """Rename the symbol at the given position."""
    logging.debug("%s", params)

    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return None

    word = doc.word_at_position(params.position)
    is_object = any([word in index[name] for name in index])
    if not is_object:
        return None

    edits: List[types.TextEdit] = []
    for linum, line in enumerate(doc.lines):
        for match in re.finditer(f"\\b{word}\\b", line):
            edits.append(
                types.TextEdit(
                    new_text=params.new_name,
                    range=types.Range(
                        start=types.Position(line=linum, character=match.start()),
                        end=types.Position(line=linum, character=match.end()),
                    ),
                )
            )

    return types.WorkspaceEdit(changes={params.text_document.uri: edits})


@server.feature(types.TEXT_DOCUMENT_PREPARE_RENAME)
def prepare_rename(ls: RenameLanguageServer, params: types.PrepareRenameParams):
    """Called by the client to determine if renaming the symbol at the given location
    is a valid operation."""
    logging.debug("%s", params)

    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return None

    word = doc.word_at_position(params.position)
    is_object = any([word in index[name] for name in index])
    if not is_object:
        return None

    # At this point, we can rename this symbol.
    #
    # For simplicity we can tell the client to use its default behaviour however, it's
    # relatively new to the spec (LSP v3.16+) so a production server should check the
    # client's capabilities before responding in this way
    return types.PrepareRenameDefaultBehavior(default_behavior=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Rename Feature Registration

Register the rename handler:

```python
@server.feature(types.TEXT_DOCUMENT_RENAME)
def rename(ls: RenameLanguageServer, params: types.RenameParams):
    ...
```

### 2. RenameParams

The `params` object contains:
- `text_document.uri` - The document URI
- `position` - The cursor position
- `new_name` - The new name for the symbol

### 3. Returning a WorkspaceEdit

Return a `WorkspaceEdit` with all the changes to apply:

```python
edits: List[types.TextEdit] = []
for linum, line in enumerate(doc.lines):
    for match in re.finditer(f"\\b{word}\\b", line):
        edits.append(
            types.TextEdit(
                new_text=params.new_name,
                range=types.Range(
                    start=types.Position(line=linum, character=match.start()),
                    end=types.Position(line=linum, character=match.end()),
                ),
            )
        )

return types.WorkspaceEdit(changes={params.text_document.uri: edits})
```

### 4. Prepare Rename (Validation)

Use `prepareRename` to validate before the rename dialog opens:

```python
@server.feature(types.TEXT_DOCUMENT_PREPARE_RENAME)
def prepare_rename(ls: RenameLanguageServer, params: types.PrepareRenameParams):
    # ... validate that symbol can be renamed ...
    
    if not is_object:
        return None  # Reject rename
    
    # Allow rename with default behavior
    return types.PrepareRenameDefaultBehavior(default_behavior=True)
```

### 5. PrepareRename Return Types

| Return Type | Description |
|-------------|-------------|
| `None` | Reject the rename operation |
| `Range` | The range of the symbol to rename |
| `PrepareRenameResult` | Range and placeholder text |
| `PrepareRenameDefaultBehavior` | Use client's default behavior (LSP 3.16+) |

### 6. Using word_at_position

Get the word under the cursor:

```python
word = doc.word_at_position(params.position)
```

## WorkspaceEdit Structure

For multi-file renames:

```python
types.WorkspaceEdit(
    changes={
        "file:///path/to/file1.py": [edit1, edit2],
        "file:///path/to/file2.py": [edit3],
    }
)
```

Or using document changes (with version tracking):

```python
types.WorkspaceEdit(
    document_changes=[
        types.TextDocumentEdit(
            text_document=types.OptionalVersionedTextDocumentIdentifier(
                uri=uri,
                version=version,
            ),
            edits=[...],
        )
    ]
)
```

## Important Considerations

1. **Scope awareness** - A production server should only rename symbols in the relevant scope
2. **Cross-file renames** - Real implementations often need to rename across multiple files
3. **Client capabilities** - Check client capabilities before using `PrepareRenameDefaultBehavior`
4. **Word boundaries** - Use `\b` regex to match whole words only

## Related pygls Examples

- [Goto "X" and Find References](https://pygls.readthedocs.io/en/latest/servers/examples/goto.html)
- [Document & Workspace Symbols](https://pygls.readthedocs.io/en/latest/servers/examples/symbols.html)
- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html)

## References

- [LSP Specification - textDocument/rename](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_rename)
- [LSP Specification - textDocument/prepareRename](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_prepareRename)
