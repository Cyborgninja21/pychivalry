# Quick Start Testing Guide

This guide will walk you through testing the CK3 Language Server in just a few minutes.

## VS Code Automated Setup (Recommended)

The fastest way to get started is using the built-in VS Code tasks. This automates all the manual steps below.

### One-Click Setup After Cloning

1. Clone and open the repository in VS Code:
   ```bash
   git clone https://github.com/Cyborgninja21/pychivalry.git
   code pychivalry
   ```

2. **Install Recommended Extensions** - VS Code will prompt you to install recommended extensions (Python, Pylance, Black, etc.). Click "Install All".

3. **Run the Setup Task**:
   - Press `Ctrl+Shift+P` → type "Tasks: Run Task" → Enter
   - Select **"Setup Project (After Clone)"**
   - This automatically:
     - Creates the Python virtual environment
     - Installs Python dependencies (including dev tools)
     - Installs Node.js dependencies for the VS Code extension

4. **Start Debugging**:
   - Press `F5` to launch the extension in debug mode
   - A new VS Code window opens with the extension loaded

### Available VS Code Tasks

Access via `Ctrl+Shift+P` → "Tasks: Run Task":

| Task | Description |
|------|-------------|
| **Setup Project (After Clone)** | Complete one-time setup - creates venv, installs all dependencies |
| **Install All Dependencies** | Reinstall Python + Node deps (runs in parallel) |
| **Build Extension** | Compile the VS Code extension (Ctrl+Shift+B) |
| **Watch Extension** | Auto-rebuild extension on file changes |
| **Package Extension** | Build production .vsix file |
| **Run All Tests** | Run pytest → flake8 → mypy in sequence |
| **Run Python Tests** | Run pytest only |
| **Lint Python** | Check code style with flake8 |
| **Type Check Python** | Run mypy type checking |
| **Format Python** | Auto-format code with black |

### VS Code Testing Sidebar

The project is configured for VS Code's built-in test explorer:

1. Click the **Testing** icon in the sidebar (beaker/flask icon)
2. You'll see all tests from the `tests/` folder
3. Click the play button to run individual tests or all tests
4. Test results appear inline and in the Test Results panel

### Debug Configurations

Press `F5` or go to **Run and Debug** (`Ctrl+Shift+D`) to see available configurations:

| Configuration | Description |
|---------------|-------------|
| **Run VS Code Extension** | Build and launch extension in debug mode |
| **Run VS Code Extension (No Build)** | Launch without rebuilding (use with Watch task) |
| **Python: Debug Server** | Debug the Python language server directly |

---

## Manual Setup

If you prefer manual setup or the automated tasks don't work, follow these steps:

### Step 1: Install the Language Server

```bash
# Clone the repository
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry

# Create a virtual environment
python -m venv pychivalry

# Activate the environment
# On Linux/macOS:
source ./pychivalry/bin/activate
# On Windows:
.\pychivalry\Scripts\activate

# Install the Python package with dev dependencies
(pychivalry) pip install -e ".[dev]"

# Verify installation
pychivalry --help  # or: python -m pychivalry.server
```

### Step 2: Test the Server Standalone

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

### Step 3: Build the VS Code Extension

```bash
cd vscode-extension

# Install dependencies
npm install

# Build the extension (development mode)
npm run compile

# Or build for production
npm run package
```

### Step 4: Launch and Test in VS Code

### Option A: Debug Mode (Recommended for Testing)

This is the best approach during development because it lets you see logs and quickly iterate.

#### Prerequisites
1. Make sure you've completed Steps 1-3 (server installed, extension built)
2. Have VS Code installed with the necessary development tools

#### Detailed Steps

1. **Open the extension folder in VS Code**
   ```bash
   code vscode-extension
   ```
   Or use File > Open Folder and navigate to `vscode-extension`

2. **Ensure dependencies are installed**
   - Open the integrated terminal (`Ctrl+``)
   - Run `npm install` if you haven't already

3. **Start debugging**
   - Press `F5` or go to **Run > Start Debugging**
   - Select "VS Code Extension Development" if prompted
   - This launches a new VS Code window called the **Extension Development Host**

4. **In the new Extension Development Host window:**
   - Open any folder (or create a new one for testing)
   - Create a new file with one of these extensions: `.txt`, `.gui`, `.gfx`, or `.asset`
   - The extension should automatically activate

5. **Verify the extension is working:**
   - Go to **View > Output** (or `Ctrl+Shift+U`)
   - In the dropdown, select **"CK3 Language Server"**
   - You should see startup messages like:
     ```
     CK3 Language Server is active!
     Using Python: python
     ```

6. **Test with sample content:**
   - Paste CK3 script content into your file
   - Watch the output panel for document events
   - Try typing to see if the language server responds

#### Debugging Tips

| Action | What to Check |
|--------|---------------|
| Extension not loading | Check "Extension Host" output channel for errors |
| Server crashes | Check "CK3 Language Server" output for Python errors |
| No syntax highlighting | Verify file extension is correct |
| Commands not working | Press `Ctrl+Shift+P` and search for "CK3" |

### Option B: Install as VSIX (Production Testing)

Use this when you want to test the extension as a regular user would experience it.

#### Build the VSIX Package

```bash
cd vscode-extension
npm run package
```

This creates a file like `ck3-language-server-0.0.1.vsix` in the `vscode-extension` folder.

#### Install the VSIX

**Method 1: Through VS Code UI**
1. Open VS Code
2. Go to **Extensions** view (`Ctrl+Shift+X`)
3. Click the `...` menu at the top of the Extensions panel
4. Select **"Install from VSIX..."**
5. Navigate to and select the `.vsix` file

**Method 2: Via Command Line**
```bash
code --install-extension ck3-language-server-0.0.1.vsix
```

#### After Installation
- Restart VS Code
- Open a `.txt`, `.gui`, `.gfx`, or `.asset` file
- The extension should activate automatically

### Testing Checklist

Once you have the extension running, verify these features:

| Feature | How to Test |
|---------|-------------|
| **Activation** | Open a `.txt` file - check Output panel shows "CK3 Language Server is active!" |
| **Document Tracking** | Open/close files - output should show "Document opened/closed" messages |
| **Restart Command** | `Ctrl+Shift+P` > "CK3 Language Server: Restart" |
| **Status Bar** | Look for CK3-related info in the bottom status bar |

### Common Issues & Solutions

#### "Python not found" Error
The extension needs Python to run the language server. Set the path in settings:
1. Open Settings (`Ctrl+,`)
2. Search for "ck3"
3. Set **Ck3 Language Server: Python Path** to your Python executable, e.g.:
   - Windows: `C:\Users\YourName\AppData\Local\Programs\Python\Python311\python.exe`
   - Or if using the venv: `path\to\pychivalry\pychivalry\Scripts\python.exe`

#### Extension Host Crashes
- Check the **Debug Console** in the original VS Code window (not the Extension Development Host)
- Look for JavaScript/TypeScript errors

#### Server Not Responding
- Make sure `pychivalry` is installed: run `pip list | grep pychivalry` in your activated venv
- Try running the server manually: `python -m pychivalry.server`

### Step 5: Test with the Hello World Example

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
- Verify Python installation: `python --version` (should be 3.9+)
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
