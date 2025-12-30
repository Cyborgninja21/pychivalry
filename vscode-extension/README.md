# CK3 Language Support for VS Code

Provides language support for Crusader Kings 3 scripting language through a Language Server Protocol (LSP) implementation.

## Features

- **Syntax Highlighting**: Basic syntax support for CK3 script files
- **Document Synchronization**: Real-time tracking of file changes
- **Language Server Integration**: Powered by pychivalry LSP server

## Requirements

- Python 3.8 or higher
- pychivalry language server installed (`pip install pychivalry`)

## Extension Settings

This extension contributes the following settings:

* `ck3LanguageServer.pythonPath`: Path to Python executable (default: `python`)
* `ck3LanguageServer.trace.server`: Enable verbose logging for debugging

## Supported File Types

- `.txt` - CK3 script files (events, decisions, etc.)
- `.gui` - GUI definition files
- `.gfx` - Graphics definition files
- `.asset` - Asset definition files

## Installation

### From Source

1. Install the pychivalry Python package:
```bash
pip install pychivalry
```

2. Build the extension:
```bash
cd vscode-extension
npm install
npm run compile
```

3. Install in VS Code:
   - Open the extension folder in VS Code
   - Press F5 to run in development mode
   - Or package with `vsce package` and install the .vsix file

## Usage

1. Open a CK3 mod directory in VS Code
2. Open any `.txt`, `.gui`, `.gfx`, or `.asset` file
3. The language server will automatically activate
4. You'll see a notification: "CK3 Language Server is active!"

## Known Issues

- This is an early version with basic functionality
- Advanced features like auto-completion are planned for future releases

## Contributing

Issues and pull requests welcome at: https://github.com/Cyborgninja21/pychivalry

## Release Notes

### 0.1.0

Initial release:
- Basic language server integration
- File type associations for CK3 files
- Document synchronization support

## License

Apache-2.0
