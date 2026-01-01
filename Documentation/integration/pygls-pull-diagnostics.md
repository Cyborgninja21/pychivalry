# pygls Pull Diagnostics Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/pull-diagnostics.html

## Overview

This implements the **pull-model** of diagnostics (also known as "push-model" in the docs, but it's actually pull).

This is a fairly new addition to LSP (v3.17), so not all clients will support this.

Instead of the server broadcasting updates whenever it feels like, the client explicitly requests diagnostics for:
- A particular document ([textDocument/diagnostic](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_diagnostic))
- The entire workspace ([workspace/diagnostic](https://microsoft.github.io/language-server-protocol/specification.html#workspace_diagnostic))

This approach helps guide the server to perform work that's most relevant to the client.

## Example Description

This server scans a document for sums (e.g., `1 + 2 = 3`), highlighting any that are either:
- **Missing answers** (warnings)
- **Incorrect answers** (errors)

## Complete Code Example

```python
import logging
import re

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument

ADDITION = re.compile(r"^\s*(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)?$")


class PullDiagnosticServer(LanguageServer):
    """Language server demonstrating "pull-model" diagnostics."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.diagnostics = {}

    def parse(self, document: TextDocument):
        _, previous = self.diagnostics.get(document.uri, (0, []))
        diagnostics = []

        for idx, line in enumerate(document.lines):
            match = ADDITION.match(line)
            if match is not None:
                left = int(match.group(1))
                right = int(match.group(2))

                expected_answer = left + right
                actual_answer = match.group(3)

                if actual_answer is not None and expected_answer == int(actual_answer):
                    continue

                if actual_answer is None:
                    message = "Missing answer"
                    severity = types.DiagnosticSeverity.Warning
                else:
                    message = f"Incorrect answer: {actual_answer}"
                    severity = types.DiagnosticSeverity.Error

                diagnostics.append(
                    types.Diagnostic(
                        message=message,
                        severity=severity,
                        range=types.Range(
                            start=types.Position(line=idx, character=0),
                            end=types.Position(line=idx, character=len(line) - 1),
                        ),
                    )
                )

        # Only update if the list has changed
        if previous != diagnostics:
            self.diagnostics[document.uri] = (document.version, diagnostics)


server = PullDiagnosticServer("diagnostic-server", "v1")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: PullDiagnosticServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: PullDiagnosticServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(
    types.TEXT_DOCUMENT_DIAGNOSTIC,
    types.DiagnosticOptions(
        identifier="pull-diagnostics",
        inter_file_dependencies=False,
        workspace_diagnostics=True,
    ),
)
def document_diagnostic(
    ls: PullDiagnosticServer, params: types.DocumentDiagnosticParams
):
    """Return diagnostics for the requested document"""
    if (uri := params.text_document.uri) not in ls.diagnostics:
        return

    version, diagnostics = ls.diagnostics[uri]
    result_id = f"{uri}@{version}"

    if result_id == params.previous_result_id:
        return types.UnchangedDocumentDiagnosticReport(result_id)

    return types.FullDocumentDiagnosticReport(items=diagnostics, result_id=result_id)


@server.feature(types.WORKSPACE_DIAGNOSTIC)
def workspace_diagnostic(
    ls: PullDiagnosticServer, params: types.WorkspaceDiagnosticParams
):
    """Return diagnostics for the workspace."""
    items = []
    previous_ids = {result.value for result in params.previous_result_ids}

    for uri, (version, diagnostics) in ls.diagnostics.items():
        result_id = f"{uri}@{version}"
        if result_id in previous_ids:
            items.append(
                types.WorkspaceUnchangedDocumentDiagnosticReport(
                    uri=uri, result_id=result_id, version=version
                )
            )
        else:
            items.append(
                types.WorkspaceFullDocumentDiagnosticReport(
                    uri=uri,
                    version=version,
                    items=diagnostics,
                )
            )

    return types.WorkspaceDiagnosticReport(items=items)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. DiagnosticOptions

Register with options to enable workspace diagnostics:

```python
@server.feature(
    types.TEXT_DOCUMENT_DIAGNOSTIC,
    types.DiagnosticOptions(
        identifier="pull-diagnostics",
        inter_file_dependencies=False,
        workspace_diagnostics=True,
    ),
)
def document_diagnostic(ls, params):
    ...
```

### 2. Document Diagnostics (textDocument/diagnostic)

Return diagnostics for a single document:

```python
def document_diagnostic(ls, params: types.DocumentDiagnosticParams):
    uri = params.text_document.uri
    version, diagnostics = ls.diagnostics[uri]
    result_id = f"{uri}@{version}"

    # Return unchanged if result_id matches previous
    if result_id == params.previous_result_id:
        return types.UnchangedDocumentDiagnosticReport(result_id)

    # Otherwise return full diagnostics
    return types.FullDocumentDiagnosticReport(items=diagnostics, result_id=result_id)
```

### 3. Workspace Diagnostics (workspace/diagnostic)

Return diagnostics for all documents:

```python
@server.feature(types.WORKSPACE_DIAGNOSTIC)
def workspace_diagnostic(ls, params: types.WorkspaceDiagnosticParams):
    items = []
    previous_ids = {result.value for result in params.previous_result_ids}

    for uri, (version, diagnostics) in ls.diagnostics.items():
        result_id = f"{uri}@{version}"
        if result_id in previous_ids:
            items.append(types.WorkspaceUnchangedDocumentDiagnosticReport(...))
        else:
            items.append(types.WorkspaceFullDocumentDiagnosticReport(...))

    return types.WorkspaceDiagnosticReport(items=items)
```

### 4. Result IDs for Caching

Use result IDs to avoid sending unchanged diagnostics:

```python
result_id = f"{uri}@{version}"

# Check if client already has this version
if result_id == params.previous_result_id:
    return types.UnchangedDocumentDiagnosticReport(result_id)
```

## Key Types

| Type | Purpose |
|------|---------|
| `DiagnosticOptions` | Registration options for pull diagnostics |
| `DocumentDiagnosticParams` | Request params with `previous_result_id` |
| `FullDocumentDiagnosticReport` | Full list of diagnostics |
| `UnchangedDocumentDiagnosticReport` | Indicates no changes since `result_id` |
| `WorkspaceDiagnosticParams` | Request params with `previous_result_ids` |
| `WorkspaceDiagnosticReport` | Container for workspace diagnostic items |
| `WorkspaceFullDocumentDiagnosticReport` | Full diagnostics for a workspace document |
| `WorkspaceUnchangedDocumentDiagnosticReport` | Unchanged diagnostics for a workspace document |

## Publish vs Pull Model Comparison

| Aspect | Publish Model | Pull Model |
|--------|---------------|------------|
| **Trigger** | Server pushes anytime | Client requests |
| **Prioritization** | Server decides | Client guides priority |
| **Caching** | No built-in caching | Result IDs for caching |
| **LSP Version** | Original | LSP 3.17+ |
| **Client Support** | Universal | Limited (newer clients) |

## DiagnosticOptions Properties

| Property | Type | Description |
|----------|------|-------------|
| `identifier` | `str` | Unique identifier for this diagnostic provider |
| `inter_file_dependencies` | `bool` | Whether changes in one file affect diagnostics in others |
| `workspace_diagnostics` | `bool` | Whether workspace diagnostics are supported |

## Related pygls Examples

- [Publish Diagnostics](https://pygls.readthedocs.io/en/latest/servers/examples/publish-diagnostics.html)
- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html)
- [Goto "X" and Find References](https://pygls.readthedocs.io/en/latest/servers/examples/goto.html)

## References

- [LSP Specification - textDocument/diagnostic](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_diagnostic)
- [LSP Specification - workspace/diagnostic](https://microsoft.github.io/language-server-protocol/specification.html#workspace_diagnostic)
