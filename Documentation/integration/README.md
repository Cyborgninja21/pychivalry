# pygls Integration Guide - Table of Contents

This directory contains comprehensive documentation for implementing Language Server Protocol (LSP) features using the [pygls](https://pygls.readthedocs.io/) library. Each document provides complete code examples, key concepts, and best practices.

---

## 📚 Document Index

### Core Features

| Document | LSP Feature | Description |
|----------|-------------|-------------|
| [Hover](pygls-hover.md) | `textDocument/hover` | Display documentation/info on mouse hover |
| [Completions](pygls-json-server.md) | `textDocument/completion` | Code completion suggestions |
| [Diagnostics (Push)](pygls-publish-diagnostics.md) | `textDocument/publishDiagnostics` | Server-pushed error/warning reporting |
| [Diagnostics (Pull)](pygls-pull-diagnostics.md) | `textDocument/diagnostic` | Client-requested diagnostics (LSP 3.17+) |

### Navigation

| Document | LSP Feature | Description |
|----------|-------------|-------------|
| [Goto & References](pygls-goto-references.md) | `textDocument/definition`, `references`, etc. | Jump to definitions, find all references |
| [Document Links](pygls-document-links.md) | `textDocument/documentLink` | Custom clickable links in documents |
| [Symbols](pygls-symbols.md) | `textDocument/documentSymbol`, `workspace/symbol` | Outline view and workspace symbol search |

### Code Editing

| Document | LSP Feature | Description |
|----------|-------------|-------------|
| [Code Actions](pygls-code-actions.md) | `textDocument/codeAction` | Quick fixes and refactoring (lightbulb menu) |
| [Rename](pygls-rename.md) | `textDocument/rename` | Symbol renaming across files |
| [Document Formatting](pygls-document-formatting.md) | `textDocument/formatting` | Auto-formatting (full, range, on-type) |

### Visual Enhancements

| Document | LSP Feature | Description |
|----------|-------------|-------------|
| [Code Lens](pygls-code-lens.md) | `textDocument/codeLens` | Inline actionable annotations |
| [Inlay Hints](pygls-inlay-hints.md) | `textDocument/inlayHint` | Inline type/parameter hints |
| [Document Color](pygls-document-color.md) | `textDocument/documentColor` | Color picker integration |
| [Semantic Tokens](pygls-semantic-tokens.md) | `textDocument/semanticTokens` | Rich syntax highlighting |

### Advanced Patterns

| Document | Topics | Description |
|----------|--------|-------------|
| [JSON Server](pygls-json-server.md) | Progress, Config, Dynamic Registration | Advanced server patterns and async |
| [Threaded Handlers](pygls-threaded-handlers.md) | Threading | Non-blocking long-running operations |

---

## 🗂️ Documents by Complexity

### Beginner
1. [Hover](pygls-hover.md) - Simple request/response pattern
2. [Publish Diagnostics](pygls-publish-diagnostics.md) - Server-initiated notifications
3. [Document Links](pygls-document-links.md) - Basic pattern with deferred resolution

### Intermediate
4. [Code Actions](pygls-code-actions.md) - TextEdit and WorkspaceEdit
5. [Document Formatting](pygls-document-formatting.md) - Multiple formatting modes
6. [Goto & References](pygls-goto-references.md) - Document indexing patterns
7. [Symbols](pygls-symbols.md) - Hierarchical vs flat symbol lists
8. [Rename](pygls-rename.md) - Multi-location edits

### Advanced
9. [Code Lens](pygls-code-lens.md) - Custom commands and deferred resolution
10. [Inlay Hints](pygls-inlay-hints.md) - Range-based processing
11. [Document Color](pygls-document-color.md) - Color parsing and presentation
12. [Semantic Tokens](pygls-semantic-tokens.md) - Token encoding and lexing
13. [Pull Diagnostics](pygls-pull-diagnostics.md) - Result caching with IDs
14. [JSON Server](pygls-json-server.md) - Progress, config, dynamic capabilities
15. [Threaded Handlers](pygls-threaded-handlers.md) - Thread safety patterns

---

## 🔧 Common Patterns

### Feature Registration
```python
from lsprotocol import types
from pygls.lsp.server import LanguageServer

server = LanguageServer("my-server", "v1")

@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(params: types.HoverParams):
    return types.Hover(contents=types.MarkupContent(...))
```

### Document Access
```python
document = server.workspace.get_text_document(params.text_document.uri)
lines = document.lines
word = document.word_at_position(params.position)
```

### Deferred Resolution Pattern
Used in: Code Lens, Document Links, Inlay Hints
```python
@server.feature(types.TEXT_DOCUMENT_CODE_LENS)
def code_lens(params):
    return [types.CodeLens(range=..., data={"key": "value"})]

@server.feature(types.CODE_LENS_RESOLVE)
def resolve(item: types.CodeLens):
    item.command = types.Command(title="...", command="...")
    return item
```

### Document Lifecycle
```python
@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls, params: types.DidOpenTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)

@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls, params: types.DidChangeTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)
```

---

## 📋 Key Types Reference

### Positions and Ranges
| Type | Description |
|------|-------------|
| `Position` | Line and character (0-indexed) |
| `Range` | Start and end positions |
| `Location` | URI + Range |

### Edits
| Type | Description |
|------|-------------|
| `TextEdit` | Single text replacement |
| `TextDocumentEdit` | Edits for versioned document |
| `WorkspaceEdit` | Multi-file edit collection |

### Content
| Type | Description |
|------|-------------|
| `MarkupContent` | Markdown or plain text content |
| `CompletionItem` | Completion suggestion |
| `Diagnostic` | Error/warning with severity |

### Responses
| Type | Description |
|------|-------------|
| `Hover` | Hover response with contents |
| `CodeAction` | Quick fix or refactoring |
| `CodeLens` | Inline annotation with command |
| `DocumentSymbol` | Symbol with children (hierarchical) |
| `WorkspaceSymbol` | Symbol with location (flat) |

---

## 🔗 External References

- [pygls Documentation](https://pygls.readthedocs.io/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/specification.html)
- [lsprotocol Types](https://github.com/microsoft/lsprotocol)
- [VSCode Language Extensions](https://code.visualstudio.com/api/language-extensions/overview)

---

## 📁 File Structure

```
Documents/integration/
├── README.md                      # This file
├── pygls-code-actions.md          # Quick fixes and refactoring
├── pygls-code-lens.md             # Inline annotations
├── pygls-document-color.md        # Color picker support
├── pygls-document-formatting.md   # Auto-formatting
├── pygls-document-links.md        # Clickable links
├── pygls-goto-references.md       # Navigation features
├── pygls-hover.md                 # Hover documentation
├── pygls-inlay-hints.md           # Inline hints
├── pygls-json-server.md           # Advanced patterns
├── pygls-publish-diagnostics.md   # Push diagnostics
├── pygls-pull-diagnostics.md      # Pull diagnostics
├── pygls-rename.md                # Symbol renaming
├── pygls-semantic-tokens.md       # Syntax highlighting
├── pygls-symbols.md               # Symbol providers
└── pygls-threaded-handlers.md     # Threading patterns
```

---

## 🚀 Quick Start

1. **Start simple**: Begin with [Hover](pygls-hover.md) to understand the basic pattern
2. **Add diagnostics**: Implement [Publish Diagnostics](pygls-publish-diagnostics.md) for error reporting
3. **Enable navigation**: Add [Goto & References](pygls-goto-references.md) for code navigation
4. **Enhance editing**: Implement [Code Actions](pygls-code-actions.md) for quick fixes
5. **Polish UX**: Add [Semantic Tokens](pygls-semantic-tokens.md) for rich highlighting

Each document contains:
- ✅ Complete working code example
- ✅ Key concepts breakdown
- ✅ Type reference tables
- ✅ Related examples
- ✅ LSP specification links
