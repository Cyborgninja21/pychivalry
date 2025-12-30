# pychivalry - CK3 Language Server

A Language Server for Crusader Kings 3 (CK3) modding, built using the [pygls](https://github.com/openlawlibrary/pygls) framework.

## Overview

This project aims to provide IDE support for CK3 modding, including:
- **Autocompletion** for triggers, effects, and scopes
- **Syntax validation** for Paradox script files
- **Hover documentation** for game elements
- **Go to definition** for script references
- **Document symbols** for code navigation

## Project Status

🚧 **Under Development** 🚧

This project is in its initial setup phase. The pygls framework has been integrated as the foundation for building the CK3 Language Server.

## Documentation

The `docs/` folder contains comprehensive documentation:

- [**CODEBASE_OVERVIEW.md**](docs/CODEBASE_OVERVIEW.md) - Complete overview of the pygls codebase structure
- [**MODULE_REFERENCE.md**](docs/MODULE_REFERENCE.md) - Detailed API reference for all modules
- [**CK3_DEVELOPMENT_GUIDE.md**](docs/CK3_DEVELOPMENT_GUIDE.md) - Development roadmap for the CK3 Language Server

## About pygls

This project is built on _pygls_ (pronounced like "pie glass"), a pythonic generic implementation of the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/specification). The full pygls documentation is available at <https://pygls.readthedocs.io/en/latest/>.

### Quick Example

```python
from pygls.lsp.server import LanguageServer
from lsprotocol import types

server = LanguageServer("ck3-language-server", "v0.1")

@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def completions(params: types.CompletionParams):
    items = []
    document = server.workspace.get_text_document(params.text_document.uri)
    current_line = document.lines[params.position.line].strip()
    # CK3-specific completion logic here
    return types.CompletionList(is_incomplete=False, items=items)

server.start_io()
```

## Installation

### Prerequisites

- Python 3.9+
- [uv](https://docs.astral.sh/uv/getting-started/installation) package manager

### Setup

```bash
# Clone the repository
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry

# Install dependencies
uv sync --all-extras
```

## Development

### Running Tests

```bash
# Run all tests
uv run --all-extras poe test

# Run Pyodide tests (WebAssembly)
uv run --all-extras poe test-pyodide
```

### Project Structure

```
pychivalry/
├── pygls/           # Core LSP framework
│   ├── lsp/         # LSP-specific implementations
│   ├── protocol/    # JSON-RPC protocol handling
│   └── workspace/   # Document/workspace management
├── examples/        # Example language servers
├── tests/           # Test suite
├── docs/            # Documentation
│   ├── CODEBASE_OVERVIEW.md
│   ├── MODULE_REFERENCE.md
│   └── CK3_DEVELOPMENT_GUIDE.md
└── pyproject.toml   # Project configuration
```

## Contributing

Contributions are welcome! Please see the [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project uses the pygls framework which is licensed under the Apache License 2.0. See [LICENSE.txt](LICENSE.txt) for details.

## Acknowledgments

- [Open Law Library](https://www.openlawlib.org/) for creating pygls
- [Paradox Interactive](https://www.paradoxinteractive.com/) for Crusader Kings 3
