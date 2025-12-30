# pygls Document Links Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/links.html

## Overview

This implements the [textDocument/documentLink](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_documentLink) and [documentLink/resolve](https://microsoft.github.io/language-server-protocol/specification.html#documentLink_resolve) requests.

These allow you to add support for custom link syntax to your language. In editors like VSCode, links will often be underlined and can be opened with Ctrl+Click.

## Example Description

This server scans the document given to `textDocument/documentLink` for the syntax `<LINK_TYPE:PATH>` and returns a document link describing its location.

While we could easily compute the `target` and `tooltip` fields in the same method, this example demonstrates how the `documentLink/resolve` method can be used to defer this until it is actually necessary.

## Complete Code Example

```python
import logging
import re

from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer

LINK = re.compile(r"<(\w+):([^>]+)>")
server = LanguageServer("links-server", "v1")


@server.feature(
    types.TEXT_DOCUMENT_DOCUMENT_LINK,
)
def document_links(params: types.DocumentLinkParams):
    """Return a list of links contained in the document."""
    items = []
    document_uri = params.text_document.uri
    document = server.workspace.get_text_document(document_uri)

    for linum, line in enumerate(document.lines):
        for match in LINK.finditer(line):
            start_char, end_char = match.span()
            items.append(
                types.DocumentLink(
                    range=types.Range(
                        start=types.Position(line=linum, character=start_char),
                        end=types.Position(line=linum, character=end_char),
                    ),
                    data={"type": match.group(1), "target": match.group(2)},
                ),
            )

    return items


LINK_TYPES = {
    "github": ("https://github.com/{}", "Github - {}"),
    "pypi": ("https://pypi.org/project/{}", "PyPi - {}"),
}


@server.feature(types.DOCUMENT_LINK_RESOLVE)
def document_link_resolve(link: types.DocumentLink):
    """Given a link, fill in additional information about it"""
    logging.info("resolving link: %s", link)

    link_type = link.data.get("type", "<unknown>")
    link_target = link.data.get("target", "<unknown>")

    if (link_info := LINK_TYPES.get(link_type, None)) is None:
        logging.error("Unknown link type: '%s'", link_type)
        return link

    url, tooltip = link_info
    link.target = url.format(link_target)
    link.tooltip = tooltip.format(link_target)

    return link


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Document Link Feature Registration

Register the document link handler:

```python
@server.feature(types.TEXT_DOCUMENT_DOCUMENT_LINK)
def document_links(params: types.DocumentLinkParams):
    ...
```

### 2. Link Regex Pattern

Match custom link syntax:

```python
LINK = re.compile(r"<(\w+):([^>]+)>")
# Matches: <github:openlawlibrary/pygls>
# Group 1: github (link type)
# Group 2: openlawlibrary/pygls (target)
```

### 3. Creating a DocumentLink

Return `DocumentLink` objects with range and data for deferred resolution:

```python
types.DocumentLink(
    range=types.Range(
        start=types.Position(line=linum, character=start_char),
        end=types.Position(line=linum, character=end_char),
    ),
    data={"type": match.group(1), "target": match.group(2)},
)
```

### 4. DocumentLink Properties

| Property | Type | Description |
|----------|------|-------------|
| `range` | `Range` | The location of the link in the document |
| `target` | `str` (optional) | The URI the link points to |
| `tooltip` | `str` (optional) | Hover tooltip text |
| `data` | `Any` (optional) | Custom data for deferred resolution |

### 5. Document Link Resolution (Deferred Computation)

Use `documentLink/resolve` to compute `target` and `tooltip` only when needed:

```python
@server.feature(types.DOCUMENT_LINK_RESOLVE)
def document_link_resolve(link: types.DocumentLink):
    link_type = link.data.get("type", "<unknown>")
    link_target = link.data.get("target", "<unknown>")

    if (link_info := LINK_TYPES.get(link_type, None)) is None:
        return link  # Return unchanged if unknown type

    url, tooltip = link_info
    link.target = url.format(link_target)
    link.tooltip = tooltip.format(link_target)

    return link
```

### 6. Link Type Mapping

Map custom link types to URL patterns:

```python
LINK_TYPES = {
    "github": ("https://github.com/{}", "Github - {}"),
    "pypi": ("https://pypi.org/project/{}", "PyPi - {}"),
}
```

## Example Custom Link Syntax

| Syntax | Resolves To |
|--------|-------------|
| `<github:openlawlibrary/pygls>` | https://github.com/openlawlibrary/pygls |
| `<pypi:pygls>` | https://pypi.org/project/pygls |

## Common Use Cases

1. **Package references** - Link to package documentation
2. **Issue references** - Link to issue trackers (e.g., `#123`)
3. **File includes** - Link to included/imported files
4. **Custom URL schemes** - Support project-specific link syntax
5. **Documentation cross-references** - Link between documentation sections

## Example: Issue Link Support

```python
ISSUE = re.compile(r"#(\d+)")

@server.feature(types.TEXT_DOCUMENT_DOCUMENT_LINK)
def document_links(params: types.DocumentLinkParams):
    items = []
    document = server.workspace.get_text_document(params.text_document.uri)

    for linum, line in enumerate(document.lines):
        for match in ISSUE.finditer(line):
            start_char, end_char = match.span()
            items.append(
                types.DocumentLink(
                    range=types.Range(
                        start=types.Position(line=linum, character=start_char),
                        end=types.Position(line=linum, character=end_char),
                    ),
                    target=f"https://github.com/owner/repo/issues/{match.group(1)}",
                    tooltip=f"Issue #{match.group(1)}",
                ),
            )
    return items
```

## Performance Considerations

1. **Use `data` for deferred resolution** - Store minimal data needed to resolve later
2. **Batch processing** - Process all links in one pass through the document
3. **Cache results** - Consider caching resolved links for frequently accessed documents

## Related pygls Examples

- [Hover](https://pygls.readthedocs.io/en/latest/servers/examples/hover.html)
- [Goto "X" and Find References](https://pygls.readthedocs.io/en/latest/servers/examples/goto.html)
- [Code Lens](https://pygls.readthedocs.io/en/latest/servers/examples/code-lens.html)

## References

- [LSP Specification - textDocument/documentLink](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_documentLink)
- [LSP Specification - documentLink/resolve](https://microsoft.github.io/language-server-protocol/specification.html#documentLink_resolve)
