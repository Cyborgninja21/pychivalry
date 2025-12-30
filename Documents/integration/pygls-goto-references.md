# pygls Goto "X" and Find References Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/goto.html

## Overview

This implements the various "Goto X" requests from the LSP specification:

- [textDocument/definition](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_definition)
- [textDocument/declaration](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_declaration)
- [textDocument/implementation](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_implementation)
- [textDocument/typeDefinition](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_typeDefinition)

Along with the [textDocument/references](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_references) request.

## Key Insight

All of these methods are essentially the same - they accept a document URI and return zero or more locations (even goto definition can return multiple results!). The only difference between them are the semantic differences between say a definition and a declaration in your target language.

## Complete Code Example

```python
import logging
import re

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument

ARGUMENT = re.compile(r"(?P<name>\w+): (?P<type>\w+)")
FUNCTION = re.compile(r"^fn ([a-z]\w+)\(")
TYPE = re.compile(r"^type ([A-Z]\w+)\(")


class GotoLanguageServer(LanguageServer):
    """Language server demonstrating the various "Goto X" methods in the LSP
    specification."""

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


server = GotoLanguageServer("goto-server", "v1")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: GotoLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: GotoLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_TYPE_DEFINITION)
def goto_type_definition(ls: GotoLanguageServer, params: types.TypeDefinitionParams):
    """Jump to an object's type definition."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return

    try:
        line = doc.lines[params.position.line]
    except IndexError:
        line = ""

    word = doc.word_at_position(params.position)

    for match in ARGUMENT.finditer(line):
        if match.group("name") == word:
            if (range_ := index["types"].get(match.group("type"), None)) is not None:
                return types.Location(uri=doc.uri, range=range_)


@server.feature(types.TEXT_DOCUMENT_DEFINITION)
def goto_definition(ls: GotoLanguageServer, params: types.DefinitionParams):
    """Jump to an object's definition."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return

    word = doc.word_at_position(params.position)

    # Is word a type?
    if (range_ := index["types"].get(word, None)) is not None:
        return types.Location(uri=doc.uri, range=range_)


@server.feature(types.TEXT_DOCUMENT_DECLARATION)
def goto_declaration(ls: GotoLanguageServer, params: types.DeclarationParams):
    """Jump to an object's declaration."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return

    try:
        line = doc.lines[params.position.line]
    except IndexError:
        line = ""

    word = doc.word_at_position(params.position)

    for match in ARGUMENT.finditer(line):
        if match.group("name") == word:
            linum = params.position.line
            return types.Location(
                uri=doc.uri,
                range=types.Range(
                    start=types.Position(line=linum, character=match.start()),
                    end=types.Position(line=linum, character=match.end()),
                ),
            )


@server.feature(types.TEXT_DOCUMENT_IMPLEMENTATION)
def goto_implementation(ls: GotoLanguageServer, params: types.ImplementationParams):
    """Jump to an object's implementation."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return

    word = doc.word_at_position(params.position)

    # Is word a function?
    if (range_ := index["functions"].get(word, None)) is not None:
        return types.Location(uri=doc.uri, range=range_)


@server.feature(types.TEXT_DOCUMENT_REFERENCES)
def find_references(ls: GotoLanguageServer, params: types.ReferenceParams):
    """Find references of an object."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    index = ls.index.get(doc.uri)
    if index is None:
        return

    word = doc.word_at_position(params.position)
    is_object = any([word in index[name] for name in index])
    if not is_object:
        return

    references = []
    for linum, line in enumerate(doc.lines):
        for match in re.finditer(f"\\b{word}\\b", line):
            references.append(
                types.Location(
                    uri=doc.uri,
                    range=types.Range(
                        start=types.Position(line=linum, character=match.start()),
                        end=types.Position(line=linum, character=match.end()),
                    ),
                )
            )

    return references


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Custom Language Server Class

Extend `LanguageServer` to maintain state (like an index):

```python
class GotoLanguageServer(LanguageServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.index = {}

    def parse(self, doc: TextDocument):
        # Build index of types and functions
        ...
```

### 2. Document Lifecycle Events

Parse documents when opened or changed to keep the index updated:

```python
@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: GotoLanguageServer, params: types.DidOpenTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)

@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: GotoLanguageServer, params: types.DidOpenTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)
```

### 3. Getting Word at Position

Use `doc.word_at_position()` to get the word under the cursor:

```python
word = doc.word_at_position(params.position)
```

### 4. Returning a Location

All goto methods return `types.Location` with a URI and range:

```python
return types.Location(uri=doc.uri, range=range_)
```

### 5. Find References (Multiple Results)

Find references returns a list of locations:

```python
references = []
for linum, line in enumerate(doc.lines):
    for match in re.finditer(f"\\b{word}\\b", line):
        references.append(
            types.Location(
                uri=doc.uri,
                range=types.Range(
                    start=types.Position(line=linum, character=match.start()),
                    end=types.Position(line=linum, character=match.end()),
                ),
            )
        )
return references
```

## Feature Types Summary

| Feature | Request Type | Params Type | Purpose |
|---------|--------------|-------------|---------|
| `TEXT_DOCUMENT_DEFINITION` | Go to Definition | `DefinitionParams` | Jump to where a symbol is defined |
| `TEXT_DOCUMENT_DECLARATION` | Go to Declaration | `DeclarationParams` | Jump to where a symbol is declared |
| `TEXT_DOCUMENT_TYPE_DEFINITION` | Go to Type Definition | `TypeDefinitionParams` | Jump to the type of a symbol |
| `TEXT_DOCUMENT_IMPLEMENTATION` | Go to Implementation | `ImplementationParams` | Jump to implementation of interface/abstract |
| `TEXT_DOCUMENT_REFERENCES` | Find References | `ReferenceParams` | Find all references to a symbol |

## Related pygls Examples

- [Hover](https://pygls.readthedocs.io/en/latest/servers/examples/hover.html)
- [Rename](https://pygls.readthedocs.io/en/latest/servers/examples/rename.html)
- [Document & Workspace Symbols](https://pygls.readthedocs.io/en/latest/servers/examples/symbols.html)

## References

- [LSP Specification - textDocument/definition](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_definition)
- [LSP Specification - textDocument/declaration](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_declaration)
- [LSP Specification - textDocument/implementation](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_implementation)
- [LSP Specification - textDocument/typeDefinition](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_typeDefinition)
- [LSP Specification - textDocument/references](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_references)
