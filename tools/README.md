# pychivalry Tools

Development and setup utilities for pychivalry.

## Install-Prerequisites.ps1

A PowerShell script that checks for and installs the required development tools on Windows using **winget** (Windows Package Manager).

### Prerequisites Checked

| Tool | Minimum Version | Winget Package |
|------|-----------------|----------------|
| Python | 3.9+ | `Python.Python.3.12` |
| VS Code | any | `Microsoft.VisualStudioCode` |
| Git | any | `Git.Git` |
| Node.js | 18+ | `OpenJS.NodeJS.LTS` |

### Requirements

- **Windows 10** (version 1709+) or **Windows 11**
- **winget** - Windows Package Manager
  - Comes pre-installed on Windows 11
  - On Windows 10: Install "App Installer" from Microsoft Store
  - Or download from: https://aka.ms/getwinget

### Usage

```powershell
# Interactive mode - prompts for each missing tool
.\tools\Install-Prerequisites.ps1

# Auto mode - installs all missing tools without prompting
.\tools\Install-Prerequisites.ps1 -Auto
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `-Auto` | Automatically install all missing prerequisites without prompting |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All prerequisites installed successfully |
| `1` | Some prerequisites missing or installation failed |

### Example Output

```
╔═══════════════════════════════════════════════════════════╗
║         pychivalry - Prerequisites Installer              ║
╚═══════════════════════════════════════════════════════════╝

→ Checking for winget...
✓ winget is available

→ Checking Python...
✓ Python 3.12.4 found
→ Checking VS Code...
✓ VS Code 1.95.0 found
→ Checking Git...
✓ Git 2.51.0 found
→ Checking Node.js...
✓ Node.js 24.12.0 found

═══════════════════════════════════════════════════════════════
                          Summary
═══════════════════════════════════════════════════════════════

  Python       Installed                 3.12.4
  VS Code      Installed                 1.95.0
  Git          Installed                 2.51.0
  Node.js      Installed                 24.12.0

✓ All prerequisites installed!

  Next: pip install pychivalry
```

### How It Works

```
START
  │
  ▼
Check winget available ──NO──► Show error, EXIT 1
  │
  YES
  │
  ▼
FOR EACH prerequisite (Python, VS Code, Git, Node.js):
  │
  ├─► Check if installed via command --version
  │     │
  │     ├─► Found & meets version ──► Mark "Installed"
  │     │
  │     └─► Not found or too old
  │           │
  │           ▼
  │         Prompt user (or -Auto flag)
  │           │
  │           ├─► Yes: winget install ──► Refresh PATH ──► Re-check
  │           │
  │           └─► No: Mark "Skipped"
  │
  ▼
Show Summary Table
  │
  ▼
All installed? ──YES──► EXIT 0
  │
  NO
  │
  ▼
EXIT 1
```

### Troubleshooting

#### "winget is not installed"

Install the App Installer from Microsoft Store, or download from https://aka.ms/getwinget

#### Tool installed but not detected

Some tools require a terminal restart to update the PATH. Close and reopen PowerShell after installation.

#### VS Code not detected

If VS Code is installed but `code --version` doesn't work:
1. Open VS Code
2. Press `Ctrl+Shift+P`
3. Type "Shell Command: Install 'code' command in PATH"
4. Restart your terminal

### After Prerequisites

Once all prerequisites are installed:

```powershell
# Install pychivalry
pip install pychivalry

# Or for development
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
pip install -e ".[dev]"
```
