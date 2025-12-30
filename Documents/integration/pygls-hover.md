# pygls Hover Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/hover.html

## Overview

This implements the [textDocument/hover](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_hover) request.

Typically this method will be called when the user places their mouse or cursor over a symbol in a document, allowing you to provide documentation for the selected symbol.

## Example Description

This server implements `textDocument/hover` for various datetime representations, displaying a table showing how the selected date would be formatted in each of the supported formats.

## Complete Code Example

```python
import logging
from datetime import datetime

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer

DATE_FORMATS = [
    "%H:%M:%S",
    "%d/%m/%y",
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
]
server = LanguageServer("hover-server", "v1")


@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(ls: LanguageServer, params: types.HoverParams):
    pos = params.position
    document_uri = params.text_document.uri
    document = ls.workspace.get_text_document(document_uri)

    try:
        line = document.lines[pos.line]
    except IndexError:
        return None

    for fmt in DATE_FORMATS:
        try:
            value = datetime.strptime(line.strip(), fmt)
            break
        except ValueError:
            pass

    else:
        # No valid datetime found.
        return None

    hover_content = [
        f"# {value.strftime('%a %d %b %Y')}",
        "",
        "| Format | Value |",
        "|:-|-:|",
        *[f"| `{fmt}` | {value.strftime(fmt)} |" for fmt in DATE_FORMATS],
    ]

    return types.Hover(
        contents=types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value="\n".join(hover_content),
        ),
        range=types.Range(
            start=types.Position(line=pos.line, character=0),
            end=types.Position(line=pos.line + 1, character=0),
        ),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Hover Feature Registration

Register the hover handler:

```python
@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(ls: LanguageServer, params: types.HoverParams):
    ...
```

### 2. HoverParams

The `params` object contains:
- `position` - The cursor position (line and character)
- `text_document.uri` - The URI of the document

```python
pos = params.position
document_uri = params.text_document.uri
```

### 3. Returning None

Return `None` if there's nothing to show for the current position:

```python
# No valid datetime found.
return None
```

### 4. Creating a Hover Response

Return a `types.Hover` object with contents and optional range:

```python
return types.Hover(
    contents=types.MarkupContent(
        kind=types.MarkupKind.Markdown,
        value="\n".join(hover_content),
    ),
    range=types.Range(
        start=types.Position(line=pos.line, character=0),
        end=types.Position(line=pos.line + 1, character=0),
    ),
)
```

### 5. MarkupContent

Hover content supports both plain text and Markdown:

```python
# Markdown content
types.MarkupContent(
    kind=types.MarkupKind.Markdown,
    value="# Heading\n\nSome **bold** text",
)

# Plain text content
types.MarkupContent(
    kind=types.MarkupKind.PlainText,
    value="Plain text content",
)
```

### 6. Building Rich Markdown Content

Create tables and formatted content:

```python
hover_content = [
    f"# {value.strftime('%a %d %b %Y')}",
    "",
    "| Format | Value |",
    "|:-|-:|",
    *[f"| `{fmt}` | {value.strftime(fmt)} |" for fmt in DATE_FORMATS],
]
```

## Key Types

| Type | Purpose |
|------|---------|
| `HoverParams` | Contains position and document URI |
| `Hover` | The hover response with contents and optional range |
| `MarkupContent` | Content with a kind (Markdown or PlainText) and value |
| `MarkupKind.Markdown` | Indicates Markdown formatting |
| `MarkupKind.PlainText` | Indicates plain text |

## Common Use Cases

1. **Documentation tooltips** - Show function/class documentation
2. **Type information** - Display inferred or declared types
3. **Value previews** - Show computed values or expressions
4. **Symbol information** - Display symbol metadata
5. **Error details** - Show detailed error information

## Example Hover Content Patterns

### Simple Text
```python
return types.Hover(
    contents=types.MarkupContent(
        kind=types.MarkupKind.PlainText,
        value="This is a simple tooltip",
    ),
)
```

### Code Block
```python
hover_content = """
```python
def example():
    pass
```
"""
```

### Documentation with Signature
```python
hover_content = """
**function_name**(arg1: str, arg2: int) -> bool

Description of the function.

**Parameters:**
- `arg1`: Description of arg1
- `arg2`: Description of arg2

**Returns:** Description of return value
"""
```

## Related pygls Examples

- [Goto "X" and Find References](https://pygls.readthedocs.io/en/latest/servers/examples/goto.html)
- [Inlay Hints](https://pygls.readthedocs.io/en/latest/servers/examples/inlay-hints.html)
- [Document & Workspace Symbols](https://pygls.readthedocs.io/en/latest/servers/examples/symbols.html)

## References

- [LSP Specification - textDocument/hover](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_hover)
