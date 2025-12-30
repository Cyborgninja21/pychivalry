# Getting Started with pychivalry

This guide will help you set up and start using pychivalry for Crusader Kings 3 mod development.

## Quick Start

### 1. Install Python Dependencies

```bash
cd pychivalry
pip install -e .
```

### 2. Verify Installation

Test that the server can start:

```bash
python -m pychivalry.server --help
```

### 3. Set Up VS Code Extension

```bash
cd vscode-extension
npm install
npm run compile
```

### 4. Open in VS Code

Open the extension in VS Code for development:

1. Open the `vscode-extension` folder in VS Code
2. Press `F5` to launch a new VS Code window with the extension
3. Open a CK3 mod folder
4. Create or open a `.txt` file

You should see a message "CK3 Language Server is active!" when you open a CK3 file.

## Supported File Types

The language server activates for the following file extensions:

- `.txt` - Main CK3 script files (events, decisions, etc.)
- `.gui` - GUI definition files
- `.gfx` - Graphics definition files  
- `.asset` - Asset definition files

## Troubleshooting

### Server Not Starting

If the language server doesn't start:

1. Check that Python is in your PATH
2. Verify the installation: `pip list | grep pychivalry`
3. Check VS Code output panel: View > Output > Select "CK3 Language Server"

### Extension Not Activating

1. Make sure you've compiled the extension: `npm run compile`
2. Check the file extension is supported
3. Reload VS Code window: Ctrl+Shift+P > "Reload Window"

### Python Path Issues

If you use a virtual environment or custom Python installation:

1. Open VS Code Settings (Ctrl+,)
2. Search for "ck3LanguageServer.pythonPath"
3. Set the full path to your Python executable

Example:
```json
{
  "ck3LanguageServer.pythonPath": "/path/to/your/python"
}
```

## Next Steps

- Explore the CK3 modding documentation
- Try creating a simple event or decision
- Report issues or contribute on GitHub

## Debugging

Enable verbose logging in VS Code settings:

```json
{
  "ck3LanguageServer.trace.server": "verbose"
}
```

View logs in VS Code:
- View > Output
- Select "CK3 Language Server" from the dropdown
