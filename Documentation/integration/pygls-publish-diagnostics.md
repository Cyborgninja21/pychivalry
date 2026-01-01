# pygls Publish Diagnostics Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/publish-diagnostics.html

## Overview

This implements the **publish model** of diagnostics.

The original and most widely supported model of diagnostics in LSP, the publish model allows the server to update the client whenever it is ready. Unlike the pull-model however, there is no way for the client to help the server prioritize which documents it should be computing the diagnostics for.

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


class PublishDiagnosticServer(LanguageServer):
    """Language server demonstrating "push-model" diagnostics."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.diagnostics = {}

    def parse(self, document: TextDocument):
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

        self.diagnostics[document.uri] = (document.version, diagnostics)


server = PublishDiagnosticServer("diagnostic-server", "v1")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: PublishDiagnosticServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)

    for uri, (version, diagnostics) in ls.diagnostics.items():
        ls.text_document_publish_diagnostics(
            types.PublishDiagnosticsParams(
                uri=uri,
                version=version,
                diagnostics=diagnostics,
            )
        )


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: PublishDiagnosticServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)

    for uri, (version, diagnostics) in ls.diagnostics.items():
        ls.text_document_publish_diagnostics(
            types.PublishDiagnosticsParams(
                uri=uri,
                version=version,
                diagnostics=diagnostics,
            )
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Custom LanguageServer with Diagnostics Storage

Extend `LanguageServer` to store diagnostics:

```python
class PublishDiagnosticServer(LanguageServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.diagnostics = {}  # uri -> (version, diagnostics)
```

### 2. Creating a Diagnostic

Create `Diagnostic` objects with message, severity, and range:

```python
types.Diagnostic(
    message="Missing answer",
    severity=types.DiagnosticSeverity.Warning,
    range=types.Range(
        start=types.Position(line=idx, character=0),
        end=types.Position(line=idx, character=len(line) - 1),
    ),
)
```

### 3. Diagnostic Severities

```python
types.DiagnosticSeverity.Error       # Red squiggly, shows in Problems panel
types.DiagnosticSeverity.Warning     # Yellow squiggly
types.DiagnosticSeverity.Information # Blue squiggly
types.DiagnosticSeverity.Hint        # Subtle hint (often dots under code)
```

### 4. Publishing Diagnostics

Push diagnostics to the client:

```python
ls.text_document_publish_diagnostics(
    types.PublishDiagnosticsParams(
        uri=uri,
        version=version,
        diagnostics=diagnostics,
    )
)
```

### 5. Triggering on Document Events

Parse and publish diagnostics when documents are opened or changed:

```python
@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: PublishDiagnosticServer, params: types.DidOpenTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)
    # Publish diagnostics...

@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: PublishDiagnosticServer, params: types.DidOpenTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)
    # Publish diagnostics...
```

### 6. Document Version Tracking

Track document versions to ensure diagnostics match the current document state:

```python
self.diagnostics[document.uri] = (document.version, diagnostics)
```

## Diagnostic Properties

| Property | Type | Description |
|----------|------|-------------|
| `range` | `Range` | Location of the diagnostic |
| `message` | `str` | The diagnostic message |
| `severity` | `DiagnosticSeverity` | Error, Warning, Information, Hint |
| `code` | `str` or `int` (optional) | Diagnostic code (e.g., "E001") |
| `source` | `str` (optional) | Source of diagnostic (e.g., "pylint") |
| `tags` | `List[DiagnosticTag]` (optional) | Unnecessary, Deprecated |
| `related_information` | `List[DiagnosticRelatedInformation]` (optional) | Related locations |
| `data` | `Any` (optional) | Custom data for code actions |

## Enhanced Diagnostic Example

```python
types.Diagnostic(
    message="Variable 'x' is unused",
    severity=types.DiagnosticSeverity.Warning,
    range=types.Range(
        start=types.Position(line=10, character=4),
        end=types.Position(line=10, character=5),
    ),
    code="W0612",
    source="pylint",
    tags=[types.DiagnosticTag.Unnecessary],
)
```

## Clearing Diagnostics

To clear diagnostics for a document, publish an empty list:

```python
ls.text_document_publish_diagnostics(
    types.PublishDiagnosticsParams(
        uri=document_uri,
        diagnostics=[],  # Empty list clears diagnostics
    )
)
```

## Publish vs Pull Model

| Aspect | Publish Model | Pull Model |
|--------|---------------|------------|
| **Control** | Server pushes when ready | Client requests when needed |
| **Prioritization** | Server decides order | Client can prioritize visible documents |
| **Support** | Widely supported | Newer, less supported |
| **Use Case** | Real-time validation | Large projects, lazy loading |

## Common Use Cases

1. **Syntax errors** - Parse errors, invalid tokens
2. **Type errors** - Type mismatches, undefined variables
3. **Style warnings** - Formatting issues, naming conventions
4. **Deprecation notices** - Use of deprecated APIs
5. **Performance hints** - Inefficient patterns

## Related pygls Examples

- [Pull Diagnostics](https://pygls.readthedocs.io/en/latest/servers/examples/pull-diagnostics.html)
- [Code Actions](https://pygls.readthedocs.io/en/latest/servers/examples/code-actions.html) (fix diagnostics)
- [Goto "X" and Find References](https://pygls.readthedocs.io/en/latest/servers/examples/goto.html)

## References

- [LSP Specification - Publish Diagnostics](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_publishDiagnostics)
- [LSP Specification - Diagnostic](https://microsoft.github.io/language-server-protocol/specification.html#diagnostic)
