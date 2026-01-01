# pygls Document Color Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/colors.html

## Overview

This implements the [textDocument/documentColor](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_documentColor) and [textDocument/colorPresentation](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_colorPresentation) requests.

Together these methods allow you to teach a language client how to recognize and display colors that may appear in your document.

## Use Cases

Think of the different ways you can write a color in a CSS file:
- `black`
- `#000`
- `#000000`
- `rgb(0, 0, 0)`
- `hsl(...)`
- etc.

By implementing the `textDocument/documentColor` request, you can tell the client about all the places within a document that represent a color, and what its equivalent RGBA value is. In VSCode, these locations will be represented by a small colored square next to the color value.

Some editors (like VSCode) also provide a color picker. By implementing the `textDocument/colorPresentation` request, you provide the conversion from an RGBA color value into its equivalent representation in your document's syntax. This allows users to easily choose new color values from within their text editor.

## Example Description

This server implements the requests defined above for CSS's hex color code syntax (`#000` and `#000000`).

## Complete Code Example

```python
import logging
import re

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer

COLOR = re.compile(r"""\#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})(?!\w)""")
server = LanguageServer("color-server", "v1")


@server.feature(
    types.TEXT_DOCUMENT_DOCUMENT_COLOR,
)
def document_color(params: types.CodeActionParams):
    """Return a list of colors declared in the document."""
    items = []
    document_uri = params.text_document.uri
    document = server.workspace.get_text_document(document_uri)

    for linum, line in enumerate(document.lines):
        for match in COLOR.finditer(line.strip()):
            start_char, end_char = match.span()

            # Is this a short form color?
            if (end_char - start_char) == 4:
                color = "".join(c * 2 for c in match.group(1))
                value = int(color, 16)
            else:
                value = int(match.group(1), 16)

            # Split the single color value into a value for each color channel.
            blue = (value & 0xFF) / 0xFF
            green = (value & (0xFF << 8)) / (0xFF << 8)
            red = (value & (0xFF << 16)) / (0xFF << 16)

            items.append(
                types.ColorInformation(
                    color=types.Color(red=red, green=green, blue=blue, alpha=1.0),
                    range=types.Range(
                        start=types.Position(line=linum, character=start_char),
                        end=types.Position(line=linum, character=end_char),
                    ),
                )
            )

    return items


@server.feature(
    types.TEXT_DOCUMENT_COLOR_PRESENTATION,
)
def color_presentation(params: types.ColorPresentationParams):
    """Given a color, instruct the client how to insert the representation of that
    color into the document"""
    color = params.color

    b = int(color.blue * 255)
    g = int(color.green * 255)
    r = int(color.red * 255)

    # Combine each color channel into a single value
    value = (r << 16) | (g << 8) | b
    return [types.ColorPresentation(label=f"#{value:0{6}x}")]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Document Color Feature Registration

Register the document color handler:

```python
@server.feature(types.TEXT_DOCUMENT_DOCUMENT_COLOR)
def document_color(params: types.CodeActionParams):
    ...
```

### 2. Color Regex Pattern

Match hex color codes (both short and long form):

```python
COLOR = re.compile(r"""\#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})(?!\w)""")
```

### 3. Parsing Hex Colors to RGBA

Convert hex color values to normalized RGBA (0.0 - 1.0):

```python
# Handle short form (#ABC -> #AABBCC)
if (end_char - start_char) == 4:
    color = "".join(c * 2 for c in match.group(1))
    value = int(color, 16)
else:
    value = int(match.group(1), 16)

# Extract color channels
blue = (value & 0xFF) / 0xFF
green = (value & (0xFF << 8)) / (0xFF << 8)
red = (value & (0xFF << 16)) / (0xFF << 16)
```

### 4. Creating ColorInformation

Return color information with the color value and its location:

```python
types.ColorInformation(
    color=types.Color(red=red, green=green, blue=blue, alpha=1.0),
    range=types.Range(
        start=types.Position(line=linum, character=start_char),
        end=types.Position(line=linum, character=end_char),
    ),
)
```

### 5. Color Presentation (Color Picker Integration)

Convert RGBA back to document syntax when user picks a color:

```python
@server.feature(types.TEXT_DOCUMENT_COLOR_PRESENTATION)
def color_presentation(params: types.ColorPresentationParams):
    color = params.color

    b = int(color.blue * 255)
    g = int(color.green * 255)
    r = int(color.red * 255)

    value = (r << 16) | (g << 8) | b
    return [types.ColorPresentation(label=f"#{value:0{6}x}")]
```

### 6. Key Types

- `types.Color` - RGBA color with values 0.0-1.0
- `types.ColorInformation` - Associates a color with a range in the document
- `types.ColorPresentation` - How to display/insert a color in the document
- `types.ColorPresentationParams` - Contains the color to convert and the range

## Related pygls Examples

- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html)
- [Code Lens](https://pygls.readthedocs.io/en/latest/servers/examples/code-lens.html)
- [Document Formatting](https://pygls.readthedocs.io/en/latest/servers/examples/formatting.html)

## References

- [LSP Specification - textDocument/documentColor](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_documentColor)
- [LSP Specification - textDocument/colorPresentation](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_colorPresentation)
- [VSCode CSS Color Preview](https://code.visualstudio.com/docs/languages/css#_syntax-coloring-color-preview)
