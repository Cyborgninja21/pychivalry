# Getting Started with pychivalry

A comprehensive guide to setting up and using pychivalry—the Language Server Protocol (LSP) implementation for Crusader Kings 3 mod development.

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Download Link |
|-------------|---------|---------------|
| **Python** | 3.9 or higher | [python.org/downloads](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **VS Code** | 1.75+ | [code.visualstudio.com](https://code.visualstudio.com/) |

### Verify Prerequisites

```bash
# Check Python version (must be 3.9+)
python --version

# Check Node.js version (must be 18+)
node --version

# Check npm is available
npm --version
```

## Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
```

### Step 2: Install the Python Language Server

The language server is a Python package that provides all the IDE intelligence. Install it in development mode:

```bash
# Basic installation
pip install -e .

# Or with development dependencies (recommended for contributors)
pip install -e ".[dev]"
```

**Dependencies installed:**
- `pygls>=2.0.0` — Python Generic Language Server framework
- `pyyaml>=6.0` — YAML parsing support

### Step 3: Verify Server Installation

Test that the language server is properly installed:

```bash
# Method 1: Use the installed command
pychivalry

# Method 2: Run as a Python module
python -m pychivalry.server
```

You should see log output like:
```
2025-12-30 07:00:00,000 - pychivalry.server - INFO - Starting CK3 Language Server...
```

Press `Ctrl+C` to stop the server. The server waiting for input is expected behavior—it communicates via JSON-RPC over stdin/stdout.

### Step 4: Build the VS Code Extension

```bash
cd vscode-extension

# Install Node.js dependencies
npm install

# Build the extension (development mode)
npm run compile
```

### Step 5: Launch the Extension

**Option A: From the vscode-extension subfolder**

1. Open the `vscode-extension` folder in VS Code:
   ```bash
   code vscode-extension
   ```
2. Press **F5** to launch the Extension Development Host

**Option B: From the root pychivalry folder (recommended)**

If you're already working in the root `pychivalry` folder, you don't need to open a separate VS Code window. The repository includes launch configurations in `.vscode/launch.json`:

1. Open the root `pychivalry` folder in VS Code:
   ```bash
   code pychivalry
   ```
2. Press **F5** to launch "Launch CK3 Extension" (auto-compiles first)
   - Or select "Launch CK3 Extension (No Build)" from the Run dropdown if you're using watch mode

> **Tip:** Run `npm run watch` in the `vscode-extension` directory to auto-compile on changes, then use the "No Build" configuration for faster iteration.

**After launching:**

3. In the new VS Code window, open any CK3 mod folder or create a test file
4. Create or open a file with a supported extension (`.txt`, `.gui`, `.gfx`, or `.asset`)

**Success indicator:** You'll see a notification popup: "CK3 Language Server is active!"

## Supported File Types

The language server automatically activates for these file extensions:

| Extension | Description | Common Uses |
|-----------|-------------|-------------|
| `.txt` | Main CK3 script files | Events, decisions, triggers, effects, on_actions, scripted triggers/effects |
| `.gui` | GUI definition files | Window layouts, widget definitions, templates |
| `.gfx` | Graphics definition files | Sprite definitions, texture assignments |
| `.asset` | Asset definition files | 3D models, portraits, entity definitions |

## Features Available

Once the extension is running, you'll have access to:

| Feature | Description |
|---------|-------------|
| **Auto-completion** | 150+ CK3 keywords, effects, triggers, and scopes with `Ctrl+Space` |
| **Real-time Diagnostics** | Syntax and semantic errors highlighted as you type |
| **Hover Documentation** | Hover over keywords to see helpful tooltips |
| **Scope Validation** | Validates scope chains like `root.liege.primary_title` |
| **List Validation** | Validates `any_`, `every_`, `random_`, `ordered_` iterator patterns |
| **Script Value Validation** | Checks formulas and range expressions |
| **Variable Support** | Tracks `var:`, `local_var:`, and `global_var:` usage |
| **Syntax Highlighting** | Full TextMate grammar for CK3 scripting language |
| **Code Snippets** | Pre-built templates for common patterns |

## VS Code Configuration

### Available Settings

Access via `Ctrl+,` (Settings) or add to your `settings.json`:

```json
{
  "ck3LanguageServer.enable": true,
  "ck3LanguageServer.pythonPath": "python",
  "ck3LanguageServer.args": [],
  "ck3LanguageServer.trace.server": "off"
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ck3LanguageServer.enable` | boolean | `true` | Enable or disable the language server entirely |
| `ck3LanguageServer.pythonPath` | string | `"python"` | Full path to your Python executable |
| `ck3LanguageServer.args` | array | `[]` | Additional command-line arguments for the server |
| `ck3LanguageServer.trace.server` | string | `"off"` | Logging level: `"off"`, `"messages"`, or `"verbose"` |

### Available Commands

Access via Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `CK3: Restart Language Server` | Restart the server (useful after configuration changes) |
| `CK3: Show Output Channel` | Open the server output log |
| `CK3: Open CK3 Modding Documentation` | Open the official CK3 modding wiki |

## Troubleshooting

### Server Not Starting

If the language server fails to start:

1. **Check Python is accessible:**
   ```bash
   python --version
   # Must output Python 3.9 or higher
   ```

2. **Verify pychivalry is installed:**
   ```bash
   pip list | grep pychivalry
   # Should show: pychivalry 0.1.0
   ```

3. **Test the server manually:**
   ```bash
   python -m pychivalry.server
   # Should show "Starting CK3 Language Server..."
   ```

4. **Check VS Code output:**
   - Go to **View → Output** (or `Ctrl+Shift+U`)
   - Select **"CK3 Language Server"** from the dropdown
   - Look for error messages

### "Python not found" Error

The extension automatically searches for Python in this order:
1. The path specified in `ck3LanguageServer.pythonPath`
2. `python3` command
3. `python` command
4. `py` command (Windows only)

**To fix:** Configure the exact Python path in VS Code settings:

```json
{
  "ck3LanguageServer.pythonPath": "C:\\Users\\YourName\\AppData\\Local\\Programs\\Python\\Python311\\python.exe"
}
```

Or for a virtual environment:
```json
{
  "ck3LanguageServer.pythonPath": "C:\\path\\to\\pychivalry\\.venv\\Scripts\\python.exe"
}
```

### "pychivalry module not installed" Error

This means Python is found but the language server package isn't installed:

```bash
# Make sure you're using the same Python the extension is configured to use
pip install -e /path/to/pychivalry
```

### Extension Not Activating

1. **Verify file extension:** Only `.txt`, `.gui`, `.gfx`, and `.asset` files activate the server
2. **Check the extension is compiled:**
   ```bash
   cd vscode-extension
   npm run compile
   ```
3. **Trust the workspace:** VS Code must trust the workspace for the server to start
4. **Reload VS Code:** Press `Ctrl+Shift+P` → type "Reload Window" → Enter

### Workspace Not Trusted

The language server requires VS Code workspace trust. When you open a CK3 mod folder:
1. Click "Yes, I trust the authors" when prompted
2. Or go to **File → Preferences → Settings** and search for "workspace trust"

## Debugging

### Enable Verbose Logging

For troubleshooting, enable detailed logging:

```json
{
  "ck3LanguageServer.trace.server": "verbose"
}
```

### View Server Logs

1. Open **View → Output** (`Ctrl+Shift+U`)
2. Select **"CK3 Language Server"** from the dropdown
3. Look for:
   - Server startup messages
   - Document open/close events
   - Parsing errors
   - Diagnostic information

### Check Extension Host Logs

For extension-level issues:
1. Open **View → Output**
2. Select **"Extension Host"** from the dropdown
3. Search for "ck3" to find relevant messages

## Using Virtual Environments (Recommended)

For isolation, use a Python virtual environment:

```bash
# Create virtual environment
cd pychivalry
python -m venv .venv

# Activate (Windows)
.\.venv\Scripts\activate

# Activate (Linux/macOS)
source .venv/bin/activate

# Install pychivalry
pip install -e .
```

Then configure VS Code to use the virtual environment's Python:

```json
{
  "ck3LanguageServer.pythonPath": "${workspaceFolder}/.venv/Scripts/python.exe"
}
```

## Test Files

The repository includes example files to test the language server:

- [examples/hello_world.txt](examples/hello_world.txt) — Basic CK3 script structure
- [examples/example_event.txt](examples/example_event.txt) — More complex event examples

## Next Steps

Once you're up and running:

1. **Explore Features:** Try auto-completion (`Ctrl+Space`), hover documentation, and diagnostics
2. **Read the Documentation:**
   - [README.md](README.md) — Project overview and feature list
   - [CK3_FEATURES.md](CK3_FEATURES.md) — Complete list of supported CK3 constructs
   - [TESTING.md](TESTING.md) — Detailed testing instructions
3. **Contribute:** See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
4. **Report Issues:** Open issues on GitHub for bugs or feature requests

## Quick Reference

```bash
# Python Server Commands
pip install -e .                    # Install server
pip install -e ".[dev]"             # Install with dev dependencies
pychivalry                          # Run server (installed command)
python -m pychivalry.server         # Run server (module)
pytest tests/ -v                    # Run test suite

# VS Code Extension Commands  
cd vscode-extension
npm install                         # Install dependencies
npm run compile                     # Build (development)
npm run watch                       # Auto-rebuild on changes
npm run package                     # Build production .vsix
npm run lint                        # Check code quality
```
