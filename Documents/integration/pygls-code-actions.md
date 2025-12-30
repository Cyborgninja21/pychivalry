# pygls Code Actions Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html

## Overview

This example server implements the [textDocument/codeAction](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_codeAction) request.

In VSCode, code actions are typically accessed via a small lightbulb placed near the code the action will affect. Code actions usually modify the code in some way, usually to fix an error or refactor it.

## Example Description

This server scans the document for incomplete sums (e.g., `1 + 1 =`) and returns a code action which, when invoked, will fill in the answer.

## Complete Code Example

```python
import re
from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from lsprotocol import types


ADDITION = re.compile(r"^\s*(\d+)\s*\+\s*(\d+)\s*=(?=\s*$)")
server = LanguageServer("code-action-server", "v0.1")


@server.feature(
    types.TEXT_DOCUMENT_CODE_ACTION,
    types.CodeActionOptions(code_action_kinds=[types.CodeActionKind.QuickFix]),
)
def code_actions(params: types.CodeActionParams):
    items = []
    document_uri = params.text_document.uri
    document = server.workspace.get_text_document(document_uri)

    start_line = params.range.start.line
    end_line = params.range.end.line

    lines = document.lines[start_line : end_line + 1]
    for idx, line in enumerate(lines):
        match = ADDITION.match(line)
        if match is not None:
            range_ = types.Range(
                start=types.Position(line=start_line + idx, character=0),
                end=types.Position(line=start_line + idx, character=len(line) - 1),
            )

            left = int(match.group(1))
            right = int(match.group(2))
            answer = left + right

            text_edit = types.TextEdit(
                range=range_, new_text=f"{line.strip()} {answer}!"
            )

            action = types.CodeAction(
                title=f"Evaluate '{match.group(0)}'",
                kind=types.CodeActionKind.QuickFix,
                edit=types.WorkspaceEdit(changes={document_uri: [text_edit]}),
            )
            items.append(action)

    return items


if __name__ == "__main__":
    start_server(server)
```

## Key Concepts

### 1. Feature Registration

Use the `@server.feature()` decorator to register a code action handler:

```python
@server.feature(
    types.TEXT_DOCUMENT_CODE_ACTION,
    types.CodeActionOptions(code_action_kinds=[types.CodeActionKind.QuickFix]),
)
def code_actions(params: types.CodeActionParams):
    ...
```

### 2. CodeActionParams

The `params` object contains:
- `text_document.uri` - The URI of the document
- `range` - The selected range in the document (start and end positions)

### 3. Getting Document Content

Access the document text through the workspace:

```python
document = server.workspace.get_text_document(document_uri)
lines = document.lines[start_line : end_line + 1]
```

### 4. Creating a TextEdit

Define what text should be replaced and with what:

```python
text_edit = types.TextEdit(
    range=range_,
    new_text=f"{line.strip()} {answer}!"
)
```

### 5. Creating a CodeAction

Build the code action with a title, kind, and workspace edit:

```python
action = types.CodeAction(
    title=f"Evaluate '{match.group(0)}'",
    kind=types.CodeActionKind.QuickFix,
    edit=types.WorkspaceEdit(changes={document_uri: [text_edit]}),
)
```

### 6. Code Action Kinds

Common code action kinds include:
- `types.CodeActionKind.QuickFix` - Quick fixes for errors/warnings
- `types.CodeActionKind.Refactor` - Code refactoring
- `types.CodeActionKind.Source` - Source-level actions
- `types.CodeActionKind.SourceOrganizeImports` - Organize imports

## Related pygls Examples

- [Code Lens](https://pygls.readthedocs.io/en/latest/servers/examples/code-lens.html)
- [Document Formatting](https://pygls.readthedocs.io/en/latest/servers/examples/formatting.html)
- [Hover](https://pygls.readthedocs.io/en/latest/servers/examples/hover.html)
- [Publish Diagnostics](https://pygls.readthedocs.io/en/latest/servers/examples/publish-diagnostics.html)
- [Rename](https://pygls.readthedocs.io/en/latest/servers/examples/rename.html)

## References

- [LSP Specification - textDocument/codeAction](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_codeAction)
- [VSCode Code Actions Documentation](https://code.visualstudio.com/docs/editor/refactoring)
