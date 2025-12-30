# CK3 Language Support for VS Code

Language support extension for Crusader Kings 3 scripting language, powered by a Language Server Protocol (LSP) implementation.

## Features

- **Syntax Support**: File association and basic syntax recognition for CK3 script files
- **Real-time Synchronization**: Automatic tracking of document changes
- **Extensible Architecture**: Built on LSP for future language features

### Supported File Types

- `.txt` - CK3 script files (events, decisions, etc.)
- `.gui` - GUI definition files
- `.gfx` - Graphics definition files
- `.asset` - Asset definition files

### Coming Soon

- Auto-completion for CK3 keywords and scopes
- Syntax diagnostics and error checking
- Hover documentation for game concepts
- Go-to-definition for scripted effects and triggers
- Symbol search across files

## Requirements

- Python 3.8 or higher
- The `pychivalry` LSP server installed: `pip install -e path/to/pychivalry`

## Installation

### From Source

1. Clone the repository
2. Navigate to `vscode-extension` directory
3. Install dependencies: `npm install`
4. Compile: `npm run compile`
5. Press F5 in VS Code to run the extension in development mode

## Extension Settings

This extension contributes the following settings:

* `ck3LanguageServer.enable`: Enable/disable the CK3 language server (default: `true`)
* `ck3LanguageServer.pythonPath`: Path to Python executable (default: `python`)
* `ck3LanguageServer.args`: Additional arguments to pass to the language server (default: `[]`)
* `ck3LanguageServer.trace.server`: Trace LSP communication for debugging (`off`, `messages`, `verbose`)

## Commands

* `CK3 Language Server: Restart` - Restart the language server

## Usage

1. Open a CK3 mod folder in VS Code
2. Open any `.txt`, `.gui`, `.gfx`, or `.asset` file
3. The extension will automatically activate and start the language server
4. Check the "CK3 Language Server" output panel for status messages

## Troubleshooting

### Server Not Starting

1. Check that Python is installed and accessible
2. Verify `pychivalry` is installed: `pip list | grep pychivalry`
3. Check the "CK3 Language Server" output panel for errors
4. Set `ck3LanguageServer.trace.server` to `verbose` for detailed logs

### Custom Python Environment

If you use a virtual environment:

```json
{
    "ck3LanguageServer.pythonPath": "/path/to/your/venv/bin/python"
}
```

## Development

### Building

```bash
npm install
npm run compile
```

### Packaging

```bash
npm run package
```

### Debugging

1. Open the extension folder in VS Code
2. Press F5 to launch Extension Development Host
3. Open a CK3 project in the new window
4. Check output panels for logs

## License

Apache-2.0

## Contributing

Issues and pull requests welcome at: https://github.com/Cyborgninja21/pychivalry
