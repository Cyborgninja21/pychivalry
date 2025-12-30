# Quick Start Testing Guide

This guide will walk you through testing the CK3 Language Server in just a few minutes.

## Step 1: Install the Language Server

```bash
# Clone the repository
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry

# Install the Python package
pip install -e .

# Verify installation
pychivalry --help  # or: python -m pychivalry.server
```

## Step 2: Test the Server Standalone

The simplest way to verify the server works:

```bash
# Start the server (it will wait for LSP JSON-RPC input)
python -m pychivalry.server
```

You should see log output like:
```
2025-12-30 07:00:00,000 - pygls.feature_manager - INFO - Registered builtin feature exit
2025-12-30 07:00:00,000 - pygls.feature_manager - INFO - Registered builtin feature initialize
...
2025-12-30 07:00:00,000 - pychivalry.server - INFO - Starting CK3 Language Server...
```

Press `Ctrl+C` to stop the server.

## Step 3: Build the VS Code Extension

```bash
cd vscode-extension

# Install dependencies
npm install

# Build the extension (development mode)
npm run compile

# Or build for production
npm run package
```

## Step 4: Launch and Test in VS Code

### Option A: Debug Mode (Recommended for Testing)

1. Open the `vscode-extension` folder in VS Code
2. Press `F5` (or Run > Start Debugging)
3. A new VS Code window will open with the extension loaded
4. In the new window:
   - Create a test folder
   - Create a file called `test.txt`
   - Add some CK3 script content (see example below)
5. Check the "CK3 Language Server" output panel (View > Output)
6. You should see: "CK3 Language Server is active!"

### Option B: Install as VSIX

```bash
# Package the extension
npm run package

# Install the .vsix file
# In VS Code: Extensions > ... > Install from VSIX
# Select the generated .vsix file
```

## Step 5: Test with the Hello World Example

Create a file called `hello_ck3.txt` with this content:

```
# Hello World CK3 Script
namespace hello_world

hello_world.0001 = {
    type = character_event
    title = hello_world.0001.t
    desc = hello_world.0001.desc
    
    immediate = {
        # This is a simple test event
        add_gold = 100
    }
    
    option = {
        name = hello_world.0001.a
        add_prestige = 50
    }
}
```

When you open this file in VS Code with the extension active:
1. The file should be recognized as CK3 language
2. Check the "CK3 Language Server" output panel
3. You should see: `Document opened: file:///path/to/hello_ck3.txt`

## Troubleshooting

### Server Not Starting
- Verify Python installation: `python --version` (should be 3.8+)
- Check pychivalry is installed: `pip list | grep pychivalry`
- Try running directly: `python -m pychivalry.server`

### Extension Not Activating
- Check the file extension is `.txt`, `.gui`, `.gfx`, or `.asset`
- Look for errors in: View > Output > "CK3 Language Server"
- Try the restart command: `Ctrl+Shift+P` > "CK3 Language Server: Restart"

### Python Not Found
Set the Python path in VS Code settings:
```json
{
    "ck3LanguageServer.pythonPath": "/path/to/your/python"
}
```

## Next Steps

- See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed information
- See [examples/example_event.txt](examples/example_event.txt) for more CK3 examples
- Check [CONTRIBUTING.md](CONTRIBUTING.md) to add language features

## Quick Commands Reference

```bash
# Python Server
pip install -e .              # Install server
python -m pychivalry.server   # Run server
pytest tests/                 # Run tests

# VS Code Extension
cd vscode-extension
npm install                   # Install dependencies
npm run compile              # Build (development)
npm run package              # Build (production)
npm run watch                # Auto-rebuild
npm run lint                 # Check code quality
```
