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

- Python 3.9 or higher
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

### Quick Start Testing

Want to test the language server right away? See **[TESTING.md](TESTING.md)** for a step-by-step guide.

**TL;DR:**
```bash
# 1. Install server
pip install -e .

# 2. Build extension
cd vscode-extension && npm install && npm run compile

# 3. Test in VS Code
# Press F5 in the vscode-extension folder
# Open examples/hello_world.txt in the new window
```

### Running the Language Server

The language server can be started directly:

```bash
python -m pychivalry.server
```

Or if installed via pip:

```bash
pychivalry
```

The server will start and wait for LSP JSON-RPC messages on stdin. You should see:
```
INFO - Starting CK3 Language Server...
INFO - Starting IO server
```

### Using with VS Code

#### Development/Testing Mode

1. Open the `vscode-extension` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. In the new window, open a CK3 mod folder or test file
4. Open any `.txt`, `.gui`, `.gfx`, or `.asset` file
5. Check the "CK3 Language Server" output panel (View > Output)

#### Production Mode

1. Build and package the extension:
   ```bash
   cd vscode-extension
   npm install
   npm run package
   ```

2. Install the generated `.vsix` file:
   - In VS Code: Extensions → `...` → Install from VSIX
   - Select `vscode-extension/ck3-language-support-0.1.0.vsix`

3. Open a CK3 mod directory and start editing!

### Hello World Test

Try the included hello world example:

```bash
# Open this file in VS Code with the extension active
code examples/hello_world.txt
```

The file contains a simple CK3 event and decision. When opened:
- The language server should activate
- You'll see "CK3 Language Server is active!" notification
- Check the output panel for detailed logs

### Configuration

VS Code settings can be configured in your `settings.json`:

```json
{
  "ck3LanguageServer.enable": true,
  "ck3LanguageServer.pythonPath": "python",
  "ck3LanguageServer.args": [],
  "ck3LanguageServer.trace.server": "off"
}
```

**Settings:**
- `enable`: Enable/disable the language server (default: `true`)
- `pythonPath`: Path to the Python interpreter (default: `python`)
- `args`: Additional arguments to pass to the server (default: `[]`)
- `trace.server`: Set to `messages` or `verbose` for debugging (default: `off`)

**Commands:**
- `CK3 Language Server: Restart` - Restart the language server

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
├── examples/            # Example CK3 files
│   ├── hello_world.txt  # Simple test example
│   └── example_event.txt
├── tests/               # Python tests
├── pyproject.toml       # Python project configuration
├── TESTING.md          # Quick start testing guide
└── README.md
```

### Running Tests

Run Python tests:
```bash
pytest tests/ -v
```

Run code quality checks:
```bash
black pychivalry/      # Format code
flake8 pychivalry/     # Lint code
mypy pychivalry/       # Type check
```

For extension tests:
```bash
cd vscode-extension
npm run lint           # Lint TypeScript
npm run format-check   # Check formatting
```

### Testing the Language Server

See **[TESTING.md](TESTING.md)** for detailed testing instructions, including:
- Standalone server testing
- VS Code extension testing
- Hello world example walkthrough
- Troubleshooting common issues

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

- Built with [pygls 2.0.0](https://github.com/openlawlibrary/pygls) - a pythonic generic language server framework
- Designed for [Crusader Kings 3](https://www.crusaderkings.com/) by Paradox Interactive

## Resources

- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/)
- [pygls Documentation](https://pygls.readthedocs.io/)
- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding)
