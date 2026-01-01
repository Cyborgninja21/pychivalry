# Installation Guide for pychivalry v1.0.0

This guide covers various ways to install and use pychivalry, the CK3 Language Server.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Option 1: Install from PyPI (Recommended)](#option-1-install-from-pypi-recommended)
- [Option 2: Install from Source](#option-2-install-from-source)
- [Option 3: Install VS Code Extension](#option-3-install-vs-code-extension)
- [Verification](#verification)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before installing pychivalry, ensure you have:

- **Python 3.9 or higher**: [Download Python](https://www.python.org/downloads/)
- **VS Code**: [Download VS Code](https://code.visualstudio.com/) (for the extension)
- **pip**: Usually comes with Python, verify with `pip --version`

## Option 1: Install from PyPI (Recommended)

Once published to PyPI, you can install with a single command:

```bash
pip install pychivalry
```

### For Development

If you want to contribute or modify the code:

```bash
pip install pychivalry[dev]
```

This includes all development dependencies (pytest, black, flake8, mypy).

## Option 2: Install from Source

### Clone the Repository

```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
```

### Install in Editable Mode

For users who want the latest features:

```bash
pip install -e .
```

For developers:

```bash
pip install -e ".[dev]"
```

### Verify Installation

```bash
pychivalry --version
```

## Option 3: Install VS Code Extension

### Method A: From VSIX File (Pre-release)

1. Download `ck3-language-support-1.0.0.vsix` from the [releases page](https://github.com/Cyborgninja21/pychivalry/releases)

2. Open VS Code

3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)

4. Type "Extensions: Install from VSIX"

5. Select the downloaded `.vsix` file

6. Reload VS Code when prompted

### Method B: From VS Code Marketplace (Coming Soon)

Once published:

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Crusader Kings 3 Language Support"
4. Click "Install"

### Method C: Build from Source

```bash
# 1. Install the Python package first
cd pychivalry
pip install -e .

# 2. Build the VS Code extension
cd vscode-extension
npm install
npm run compile

# 3. Open in VS Code and press F5 to test
# Or package it:
npm install -g @vscode/vsce
vsce package
# Then install the generated .vsix file
```

## Verification

### Verify Python Package

```bash
# Check if the command is available
pychivalry --help

# Or test in Python
python -c "import pychivalry; print('Success!')"
```

### Verify VS Code Extension

1. Open VS Code
2. Create a new file with `.txt` extension
3. Type `namespace` - you should see auto-completion
4. Type `character_event` - you should see a snippet

### Run Tests

```bash
cd pychivalry
pytest tests/ -v
```

All 1,142 tests should pass.

## Configuration

### VS Code Settings

Add to your `settings.json` (File > Preferences > Settings > Open Settings JSON):

```json
{
  "ck3LanguageServer.enable": true,
  "ck3LanguageServer.pythonPath": "python",
  "ck3LanguageServer.trace.server": "off",
  "ck3LanguageServer.logLevel": "info"
}
```

### Advanced Configuration

For debugging:

```json
{
  "ck3LanguageServer.logLevel": "debug",
  "ck3LanguageServer.trace.server": "verbose"
}
```

For formatting preferences:

```json
{
  "ck3LanguageServer.formatting.enabled": true,
  "ck3LanguageServer.formatting.insertSpaces": false,
  "ck3LanguageServer.formatting.tabSize": 4
}
```

For inlay hints:

```json
{
  "ck3LanguageServer.inlayHints.enabled": true,
  "ck3LanguageServer.inlayHints.showScopeTypes": true,
  "ck3LanguageServer.inlayHints.showChainTypes": true,
  "ck3LanguageServer.inlayHints.showIteratorTypes": true
}
```

## Troubleshooting

### Language Server Not Starting

**Issue**: VS Code shows "CK3 Language Server not found"

**Solution**:
```bash
# Verify Python is in PATH
python --version

# Reinstall the package
pip install --force-reinstall pychivalry

# Check VS Code settings for correct Python path
# Update ck3LanguageServer.pythonPath if needed
```

### No Auto-completion

**Issue**: Typing doesn't trigger completions

**Solution**:
1. Ensure file has `.txt`, `.gui`, `.gfx`, or `.asset` extension
2. Check that the extension is enabled: `ck3LanguageServer.enable: true`
3. Restart the language server: Press `Ctrl+Shift+P`, type "CK3: Restart Language Server"

### Diagnostics Not Appearing

**Issue**: No red squiggles for errors

**Solution**:
1. Check VS Code's Output panel: View > Output > Select "CK3: Server"
2. Look for error messages
3. Increase log level: `"ck3LanguageServer.logLevel": "debug"`
4. Restart VS Code

### Extension Tests Failing

**Issue**: `pytest` shows failures

**Solution**:
```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests again
pytest tests/ -v

# If still failing, check Python version
python --version  # Should be 3.9+
```

### Performance Issues

**Issue**: Language server is slow

**Solution**:
1. Large files (>1000 lines) may take longer to parse
2. Adjust debouncing in settings
3. Close unused CK3 files
4. Check if other extensions conflict
5. Increase VS Code memory: Add to settings:
   ```json
   {
     "files.maxMemoryForLargeFilesMB": 4096
   }
   ```

### Import Errors

**Issue**: `ModuleNotFoundError: No module named 'pychivalry'`

**Solution**:
```bash
# Ensure package is installed
pip list | grep pychivalry

# If not installed
pip install pychivalry

# If installed in wrong Python environment
which python  # or 'where python' on Windows
# Use the correct Python to install
```

## Getting Help

If you encounter issues not covered here:

1. **Check Documentation**: [README.md](README.md), [TESTING.md](TESTING.md)
2. **Search Issues**: [GitHub Issues](https://github.com/Cyborgninja21/pychivalry/issues)
3. **Ask Questions**: Open a new issue with the `question` label
4. **Report Bugs**: Open a new issue with the `bug` label

Include:
- Python version (`python --version`)
- VS Code version (Help > About)
- pychivalry version (`pip show pychivalry`)
- Operating system
- Relevant log output from VS Code Output panel

## Next Steps

Once installed:

1. **Try Examples**: Open files in `examples/` folder
2. **Read Documentation**: Check [CK3_FEATURES.md](CK3_FEATURES.md) for feature list
3. **Configure Settings**: Customize [VSCODE_SETTINGS.md](VSCODE_SETTINGS.md)
4. **Start Modding**: Create your first CK3 event with auto-completion!

---

Happy modding! 🎮
