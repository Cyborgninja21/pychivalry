# pygls Inlay Hints Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/inlay-hints.html

## Overview

This implements the [textDocument/inlayHint](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_inlayHint) and [inlayHint/resolve](https://microsoft.github.io/language-server-protocol/specification.html#inlayHint_resolve) requests.

In editors like VSCode, inlay hints are often rendered as inline "ghost text". They are typically used to show the types of variables and return values from functions.

## Example Description

This server implements `textDocument/inlayHint` to scan the given document for integer values and returns the equivalent representation of that number in binary.

While we could easily compute the inlay hint's tooltip in the same method, this example uses `inlayHint/resolve` to demonstrate how you can defer expensive computations to when they are required.

## Complete Code Example

```python
import re
from typing import Optional

from lsprotocol import types
from pygls.cli import start_server
from pygls.lsp.server import LanguageServer

NUMBER = re.compile(r"\d+")
server = LanguageServer("inlay-hint-server", "v1")


def parse_int(chars: str) -> Optional[int]:
    try:
        return int(chars)
    except Exception:
        return None


@server.feature(types.TEXT_DOCUMENT_INLAY_HINT)
def inlay_hints(params: types.InlayHintParams):
    items = []
    document_uri = params.text_document.uri
    document = server.workspace.get_text_document(document_uri)

    start_line = params.range.start.line
    end_line = params.range.end.line

    lines = document.lines[start_line : end_line + 1]
    for lineno, line in enumerate(lines):
        for match in NUMBER.finditer(line):
            if not match:
                continue

            number = parse_int(match.group(0))
            if number is None:
                continue

            binary_num = bin(number).split("b")[1]
            items.append(
                types.InlayHint(
                    label=f":{binary_num}",
                    kind=types.InlayHintKind.Type,
                    padding_left=False,
                    padding_right=True,
                    position=types.Position(line=lineno, character=match.end()),
                )
            )

    return items


@server.feature(types.INLAY_HINT_RESOLVE)
def inlay_hint_resolve(hint: types.InlayHint):
    try:
        n = int(hint.label[1:], 2)
        hint.tooltip = f"Binary representation of the number: {n}"
    except Exception:
        pass

    return hint


if __name__ == "__main__":
    start_server(server)
```

## Key Concepts

### 1. Inlay Hint Feature Registration

Register the inlay hint handler:

```python
@server.feature(types.TEXT_DOCUMENT_INLAY_HINT)
def inlay_hints(params: types.InlayHintParams):
    ...
```

### 2. InlayHintParams

The `params` object contains:
- `text_document.uri` - The URI of the document
- `range` - The visible range to provide hints for (optimization)

```python
start_line = params.range.start.line
end_line = params.range.end.line
lines = document.lines[start_line : end_line + 1]
```

### 3. Creating an InlayHint

Return `types.InlayHint` objects with label, kind, and position:

```python
types.InlayHint(
    label=f":{binary_num}",
    kind=types.InlayHintKind.Type,
    padding_left=False,
    padding_right=True,
    position=types.Position(line=lineno, character=match.end()),
)
```

### 4. InlayHint Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | `str` or `List[InlayHintLabelPart]` | The text to display |
| `kind` | `InlayHintKind` | Type or Parameter |
| `position` | `Position` | Where to insert the hint |
| `padding_left` | `bool` | Add space before the hint |
| `padding_right` | `bool` | Add space after the hint |
| `tooltip` | `str` or `MarkupContent` | Hover tooltip (can be deferred) |

### 5. InlayHint Kinds

```python
types.InlayHintKind.Type       # For type annotations
types.InlayHintKind.Parameter  # For parameter names
```

### 6. Inlay Hint Resolution (Deferred Computation)

Use `inlayHint/resolve` to defer expensive computations until the hint is hovered:

```python
@server.feature(types.INLAY_HINT_RESOLVE)
def inlay_hint_resolve(hint: types.InlayHint):
    # Compute expensive tooltip only when needed
    hint.tooltip = f"Binary representation of the number: {n}"
    return hint
```

## Common Use Cases

### Type Hints
Show inferred types for variables:
```python
# Code: x = 42
# Display: x: int = 42
```

### Parameter Names
Show parameter names at call sites:
```python
# Code: calculate(10, 20)
# Display: calculate(width: 10, height: 20)
```

### Return Types
Show return types for functions:
```python
# Code: def foo():
# Display: def foo() -> str:
```

### Computed Values
Show computed values inline (like this example with binary):
```python
# Code: 255
# Display: 255:11111111
```

## Performance Considerations

1. **Range-based processing** - Only process lines within `params.range` for efficiency
2. **Deferred resolution** - Use `inlayHint/resolve` for expensive tooltip computations
3. **Minimal hints** - Don't overwhelm users with too many hints

## Example: Parameter Name Hints

```python
@server.feature(types.TEXT_DOCUMENT_INLAY_HINT)
def inlay_hints(params: types.InlayHintParams):
    items = []
    # ... find function calls ...
    
    for arg_index, arg in enumerate(call.arguments):
        items.append(
            types.InlayHint(
                label=f"{param_names[arg_index]}:",
                kind=types.InlayHintKind.Parameter,
                padding_left=False,
                padding_right=True,
                position=types.Position(line=arg.line, character=arg.start),
            )
        )
    
    return items
```

## Related pygls Examples

- [Code Lens](https://pygls.readthedocs.io/en/latest/servers/examples/code-lens.html)
- [Hover](https://pygls.readthedocs.io/en/latest/servers/examples/hover.html)
- [Semantic Tokens](https://pygls.readthedocs.io/en/latest/servers/examples/semantic-tokens.html)

## References

- [LSP Specification - textDocument/inlayHint](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_inlayHint)
- [LSP Specification - inlayHint/resolve](https://microsoft.github.io/language-server-protocol/specification.html#inlayHint_resolve)
- [VSCode Inlay Hints](https://code.visualstudio.com/Docs/editor/editingevolved#_inlay-hints)
