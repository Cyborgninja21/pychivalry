# pychivalry

A Language Server Protocol (LSP) implementation for Crusader Kings 3 scripting language, built with [pygls](https://github.com/openlawlibrary/pygls).

## Overview

pychivalry is a language server designed to enhance the modding experience for Crusader Kings 3. It provides intelligent code assistance, syntax highlighting, and other language features to make CK3 mod development faster and easier.

## Features

- **Text Document Synchronization**: Real-time tracking of document changes
- **VS Code Integration**: Native support through a VS Code extension
- **CK3 File Support**: Handles `.txt`, `.gui`, `.gfx`, and `.asset` files
- **Extensible Architecture**: Built on pygls for easy feature additions

### Planned Features

- Syntax validation and diagnostics
- Auto-completion for CK3 keywords and scopes
- Hover information for game concepts
- Go to definition for scripted effects, triggers, and modifiers
- Symbol search across the codebase
- Code formatting

## Installation

### Prerequisites

- Python 3.8 or higher
- VS Code (for the editor extension)
- Node.js and npm (for building the VS Code extension)

### Installing the Language Server

1. Clone the repository:
```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
```

2. Install the Python package:
```bash
pip install -e .
```

Or install with development dependencies:
```bash
pip install -e ".[dev]"
```

### Installing the VS Code Extension

1. Navigate to the extension directory:
```bash
cd vscode-extension
```

2. Install dependencies:
```bash
npm install
```

3. Compile the extension:
```bash
npm run compile
```

4. Install the extension in VS Code:
   - Press `F5` to open a new VS Code window with the extension loaded (for development)
   - Or package and install: `vsce package` and then install the `.vsix` file

## Usage

### Running the Language Server

The language server can be started directly:

```bash
python -m pychivalry.server
```

Or if installed via pip:

```bash
pychivalry
```

### Using with VS Code

1. Install the VS Code extension (see above)
2. Open a CK3 mod directory in VS Code
3. Open any `.txt`, `.gui`, `.gfx`, or `.asset` file
4. The language server will automatically activate

### Configuration

VS Code settings can be configured in your `settings.json`:

```json
{
  "ck3LanguageServer.pythonPath": "python",
  "ck3LanguageServer.trace.server": "off"
}
```

- `pythonPath`: Path to the Python interpreter (default: `python`)
- `trace.server`: Set to `messages` or `verbose` for debugging

## Development

### Project Structure

```
pychivalry/
├── pychivalry/          # Python package
│   ├── __init__.py
│   └── server.py        # Main language server implementation
├── vscode-extension/    # VS Code extension
│   ├── src/
│   │   └── extension.ts
│   ├── package.json
│   └── tsconfig.json
├── pyproject.toml       # Python project configuration
└── README.md
```

### Running Tests

```bash
pytest
```

### Code Formatting

Format Python code with Black:
```bash
black pychivalry/
```

Check with flake8:
```bash
flake8 pychivalry/
```

Type check with mypy:
```bash
mypy pychivalry/
```

## Contributing

Contributions are welcome! This project is intended to help the CK3 modding community and to learn about LSP development and AI-assisted coding.

### Areas for Contribution

- Adding CK3-specific syntax validation
- Implementing auto-completion for game scopes and keywords
- Creating hover documentation for game concepts
- Improving error diagnostics
- Adding more language features

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [pygls](https://github.com/openlawlibrary/pygls) - a pythonic generic language server
- Designed for [Crusader Kings 3](https://www.crusaderkings.com/) by Paradox Interactive

## Resources

- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/)
- [pygls Documentation](https://pygls.readthedocs.io/)
- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding)
