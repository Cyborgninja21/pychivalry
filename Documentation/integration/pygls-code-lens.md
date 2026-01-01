# pygls Code Lens Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/code-lens.html

## Overview

This implements the [textDocument/codeLens](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_codeLens) and [codeLens/resolve](https://microsoft.github.io/language-server-protocol/specification.html#codeLens_resolve) requests.

In VSCode, a code lens is shown as "ghost text" above some line of actual code in your document. These lenses are typically used to show some contextual information (e.g. number of references) or provide easy access to some command (e.g. run this test).

## Example Description

This server scans the document for incomplete sums (e.g., `1 + 1 =`) and returns a code lens object which, when clicked, will call the `codeLens.evaluateSum` command to fill in the answer.

**Note:** While the `command` field could be computed up front, this example demonstrates how the `codeLens/resolve` can be used to defer this computation until it is actually necessary.

## Complete Code Example

```python
import logging
import re

import attrs
from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer

ADDITION = re.compile(r"^\s*(\d+)\s*\+\s*(\d+)\s*=(?=\s*$)")
server = LanguageServer("code-lens-server", "v1")


@server.feature(types.TEXT_DOCUMENT_CODE_LENS)
def code_lens(params: types.CodeLensParams):
    """Return a list of code lens to insert into the given document.

    This method will read the whole document and identify each sum in the document and
    tell the language client to insert a code lens at each location.
    """
    items = []
    document_uri = params.text_document.uri
    document = server.workspace.get_text_document(document_uri)

    lines = document.lines
    for idx, line in enumerate(lines):
        match = ADDITION.match(line)
        if match is not None:
            range_ = types.Range(
                start=types.Position(line=idx, character=0),
                end=types.Position(line=idx, character=len(line) - 1),
            )

            left = int(match.group(1))
            right = int(match.group(2))

            code_lens = types.CodeLens(
                range=range_,
                data={
                    "left": left,
                    "right": right,
                    "uri": document_uri,
                },
            )
            items.append(code_lens)

    return items


@attrs.define
class EvaluateSumArgs:
    """Represents the arguments to pass to the ``codeLens.evaluateSum`` command"""

    uri: str
    """The uri of the document to edit"""

    left: int
    """The left argument to ``+``"""

    right: int
    """The right argument to ``+``"""

    line: int
    """The line number to edit"""


@server.feature(types.CODE_LENS_RESOLVE)
def code_lens_resolve(ls: LanguageServer, item: types.CodeLens):
    """Resolve the ``command`` field of the given code lens.

    Using the ``data`` that was attached to the code lens item created in the function
    above, this prepares an invocation of the ``evaluateSum`` command below.
    """
    logging.info("Resolving code lens: %s", item)

    left = item.data["left"]
    right = item.data["right"]
    uri = item.data["uri"]

    args = EvaluateSumArgs(
        uri=uri,
        left=left,
        right=right,
        line=item.range.start.line,
    )

    item.command = types.Command(
        title=f"Evaluate {left} + {right}",
        command="codeLens.evaluateSum",
        arguments=[args],
    )
    return item


@server.command("codeLens.evaluateSum")
def evaluate_sum(ls: LanguageServer, args: EvaluateSumArgs):
    logging.info("arguments: %s", args)

    document = ls.workspace.get_text_document(args.uri)
    line = document.lines[args.line]

    # Compute the edit that will update the document with the result.
    answer = args.left + args.right
    edit = types.TextDocumentEdit(
        text_document=types.OptionalVersionedTextDocumentIdentifier(
            uri=args.uri,
            version=document.version,
        ),
        edits=[
            types.TextEdit(
                new_text=f"{line.strip()} {answer}\n",
                range=types.Range(
                    start=types.Position(line=args.line, character=0),
                    end=types.Position(line=args.line + 1, character=0),
                ),
            )
        ],
    )

    # Apply the edit.
    ls.workspace_apply_edit(
        types.ApplyWorkspaceEditParams(
            edit=types.WorkspaceEdit(document_changes=[edit]),
        ),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Code Lens Feature Registration

Register the code lens handler with `@server.feature()`:

```python
@server.feature(types.TEXT_DOCUMENT_CODE_LENS)
def code_lens(params: types.CodeLensParams):
    ...
```

### 2. Creating a CodeLens Object

A CodeLens contains a range and optional data for later resolution:

```python
code_lens = types.CodeLens(
    range=range_,
    data={
        "left": left,
        "right": right,
        "uri": document_uri,
    },
)
```

### 3. Code Lens Resolution (Deferred Computation)

Use `codeLens/resolve` to defer expensive computations until the lens is visible:

```python
@server.feature(types.CODE_LENS_RESOLVE)
def code_lens_resolve(ls: LanguageServer, item: types.CodeLens):
    # Access previously stored data
    left = item.data["left"]
    right = item.data["right"]
    
    # Set the command now
    item.command = types.Command(
        title=f"Evaluate {left} + {right}",
        command="codeLens.evaluateSum",
        arguments=[args],
    )
    return item
```

### 4. Registering Custom Commands

Use `@server.command()` to register a command that can be invoked by the code lens:

```python
@server.command("codeLens.evaluateSum")
def evaluate_sum(ls: LanguageServer, args: EvaluateSumArgs):
    ...
```

### 5. Applying Workspace Edits

Apply changes to the document using `workspace_apply_edit`:

```python
ls.workspace_apply_edit(
    types.ApplyWorkspaceEditParams(
        edit=types.WorkspaceEdit(document_changes=[edit]),
    ),
)
```

### 6. Using attrs for Command Arguments

Use the `attrs` library to define structured command arguments:

```python
@attrs.define
class EvaluateSumArgs:
    uri: str
    left: int
    right: int
    line: int
```

## Related pygls Examples

- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html)
- [Document Color](https://pygls.readthedocs.io/en/latest/servers/examples/colors.html)
- [Inlay Hints](https://pygls.readthedocs.io/en/latest/servers/examples/inlay-hints.html)

## References

- [LSP Specification - textDocument/codeLens](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_codeLens)
- [LSP Specification - codeLens/resolve](https://microsoft.github.io/language-server-protocol/specification.html#codeLens_resolve)
- [VSCode Code Lens Roundup](https://code.visualstudio.com/blogs/2017/02/12/code-lens-roundup)
