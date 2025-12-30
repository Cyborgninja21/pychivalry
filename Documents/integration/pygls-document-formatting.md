# pygls Document Formatting Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/formatting.html

## Overview

This implements the various formatting requests from the LSP specification:

- [textDocument/formatting](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_formatting): Format the entire document
- [textDocument/rangeFormatting](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_rangeFormatting): Format just the given range within a document
- [textDocument/onTypeFormatting](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_onTypeFormatting): Format the document while the user is actively typing

## When Are These Invoked?

These are typically invoked by the client when the user asks their editor to format the document or as part of automatic triggers (e.g., format on save).

Depending on the client, the user may need to do some additional configuration to enable some of these methods. For example, setting `editor.formatOnType` in VSCode to enable `textDocument/onTypeFormatting`.

## Example Description

This server implements basic formatting of Markdown style tables.

## Complete Code Example

```python
import logging
from typing import Dict
from typing import List
from typing import Optional

import attrs
from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument


@attrs.define
class Row:
    """Represents a row in the table"""

    cells: List[str]
    cell_widths: List[int]
    line_number: int


server = LanguageServer("formatting-server", "v1")


@server.feature(types.TEXT_DOCUMENT_FORMATTING)
def format_document(ls: LanguageServer, params: types.DocumentFormattingParams):
    """Format the entire document"""
    logging.debug("%s", params)

    doc = ls.workspace.get_text_document(params.text_document.uri)
    rows = parse_document(doc)
    return format_table(rows)


@server.feature(types.TEXT_DOCUMENT_RANGE_FORMATTING)
def format_range(ls: LanguageServer, params: types.DocumentRangeFormattingParams):
    """Format the given range within a document"""
    logging.debug("%s", params)

    doc = ls.workspace.get_text_document(params.text_document.uri)
    rows = parse_document(doc, params.range)
    return format_table(rows, params.range)


@server.feature(
    types.TEXT_DOCUMENT_ON_TYPE_FORMATTING,
    types.DocumentOnTypeFormattingOptions(first_trigger_character="|"),
)
def format_on_type(ls: LanguageServer, params: types.DocumentOnTypeFormattingParams):
    """Format the document while the user is typing"""
    logging.debug("%s", params)

    doc = ls.workspace.get_text_document(params.text_document.uri)
    rows = parse_document(doc)
    return format_table(rows)


def format_table(
    rows: List[Row], range_: Optional[types.Range] = None
) -> List[types.TextEdit]:
    """Format the given table, returning the list of edits to make to the document.

    If range is given, this method will only modify the document within the specified
    range.
    """
    edits: List[types.TextEdit] = []

    # Determine max widths
    columns: Dict[int, int] = {}
    for row in rows:
        for idx, cell in enumerate(row.cells):
            columns[idx] = max(len(cell), columns.get(idx, 0))

    # Format the table.
    cell_padding = 2
    for row in rows:
        # Only process the lines within the specified range.
        if skip_line(row.line_number, range_):
            continue

        if len(row.cells) == 0:
            # If there are no cells on the row, then this must be a separator row
            cells: List[str] = []
            empty_cells = [
                "-" * (columns[i] + cell_padding) for i in range(len(columns))
            ]
        else:
            # Otherwise ensure that each row has a consistent number of cells
            empty_cells = [" " for _ in range(len(columns) - len(row.cells))]
            cells = [
                c.center(columns[i] + cell_padding) for i, c in enumerate(row.cells)
            ]

        line = f"|{'|'.join([*cells, *empty_cells])}|\n"
        edits.append(
            types.TextEdit(
                range=types.Range(
                    start=types.Position(line=row.line_number, character=0),
                    end=types.Position(line=row.line_number + 1, character=0),
                ),
                new_text=line,
            )
        )

    return edits


def parse_document(
    document: TextDocument, range_: Optional[types.Range] = None
) -> List[Row]:
    """Parse the given document into a list of table rows.

    If range_ is given, only consider lines within the range part of the table.
    """
    rows: List[Row] = []
    for linum, line in enumerate(document.lines):
        if skip_line(linum, range_):
            continue

        line = line.strip()
        cells = [c.strip() for c in line.split("|")]

        if line.startswith("|"):
            cells.pop(0)

        if line.endswith("|"):
            cells.pop(-1)

        chars = set()
        for c in cells:
            chars.update(set(c))

        logging.debug("%s: %s", chars, cells)

        if chars == {"-"}:
            # Check for a separator row, use an empty list to represent it.
            cells = []

        elif len(cells) == 0:
            continue

        row = Row(cells=cells, line_number=linum, cell_widths=[len(c) for c in cells])

        logging.debug("%s", row)
        rows.append(row)

    return rows


def skip_line(line: int, range_: Optional[types.Range]) -> bool:
    """Given a range, determine if we should skip the given line number."""

    if range_ is None:
        return False

    return any([line < range_.start.line, line > range_.end.line])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Document Formatting (Full Document)

Format the entire document:

```python
@server.feature(types.TEXT_DOCUMENT_FORMATTING)
def format_document(ls: LanguageServer, params: types.DocumentFormattingParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    rows = parse_document(doc)
    return format_table(rows)
```

### 2. Range Formatting

Format only a selected range:

```python
@server.feature(types.TEXT_DOCUMENT_RANGE_FORMATTING)
def format_range(ls: LanguageServer, params: types.DocumentRangeFormattingParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    rows = parse_document(doc, params.range)
    return format_table(rows, params.range)
```

### 3. On-Type Formatting

Format while the user types (triggered by specific characters):

```python
@server.feature(
    types.TEXT_DOCUMENT_ON_TYPE_FORMATTING,
    types.DocumentOnTypeFormattingOptions(first_trigger_character="|"),
)
def format_on_type(ls: LanguageServer, params: types.DocumentOnTypeFormattingParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    rows = parse_document(doc)
    return format_table(rows)
```

### 4. Returning TextEdits

Formatting handlers return a list of `TextEdit` objects:

```python
edits.append(
    types.TextEdit(
        range=types.Range(
            start=types.Position(line=row.line_number, character=0),
            end=types.Position(line=row.line_number + 1, character=0),
        ),
        new_text=line,
    )
)
return edits
```

### 5. Using attrs for Data Classes

Use `attrs` to define structured data:

```python
@attrs.define
class Row:
    cells: List[str]
    cell_widths: List[int]
    line_number: int
```

### 6. Range Filtering

Helper to skip lines outside a specified range:

```python
def skip_line(line: int, range_: Optional[types.Range]) -> bool:
    if range_ is None:
        return False
    return any([line < range_.start.line, line > range_.end.line])
```

## Key Types

| Type | Purpose |
|------|---------|
| `DocumentFormattingParams` | Parameters for full document formatting |
| `DocumentRangeFormattingParams` | Parameters for range formatting (includes `range`) |
| `DocumentOnTypeFormattingParams` | Parameters for on-type formatting |
| `DocumentOnTypeFormattingOptions` | Options specifying trigger characters |
| `TextEdit` | A single edit to apply to the document |

## VSCode Settings

To enable on-type formatting in VSCode, users need to enable:

```json
{
    "editor.formatOnType": true
}
```

## Related pygls Examples

- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html)
- [Document Color](https://pygls.readthedocs.io/en/latest/servers/examples/colors.html)
- [Rename](https://pygls.readthedocs.io/en/latest/servers/examples/rename.html)

## References

- [LSP Specification - textDocument/formatting](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_formatting)
- [LSP Specification - textDocument/rangeFormatting](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_rangeFormatting)
- [LSP Specification - textDocument/onTypeFormatting](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_onTypeFormatting)
