# Development Tasks

## Current Priority

### Fix Extension Loading for Local Development
**Status:** Not Started  
**Priority:** Medium  
**Created:** 2026-01-01

**Problem:**
Currently, the CK3 Language Support extension only works in the Extension Development Host window (separate VS Code instance). This requires launching a second window every time you want to test the extension, which slows down the development workflow.

**Goal:**
Enable the extension to be used in the main VS Code instance during development for faster iteration and testing.

**Solution Options:**

#### Option 1: Create Symlink (Quick & Simple)
Create a symbolic link from the development directory to the VS Code extensions folder:

```bash
# For VS Code Insiders
ln -s /home/cwallace/Documents/git/pychivalry/vscode-extension \
      ~/.vscode-insiders/extensions/ck3-language-support-dev

# For VS Code Stable
ln -s /home/cwallace/Documents/git/pychivalry/vscode-extension \
      ~/.vscode/extensions/ck3-language-support-dev
```

**Pros:**
- Simple one-time setup
- No need to rebuild or reinstall
- Extension auto-updates when you make changes (after reload)

**Cons:**
- Need to reload VS Code window after code changes
- May conflict with published extension if installed

---

#### Option 2: Add "Install Extension Locally" Task (Automated)
Add a new task to `.vscode/tasks.json` that packages and installs the extension locally:

```json
{
    "label": "Install Extension Locally",
    "type": "shell",
    "command": "cd vscode-extension && npm run compile && code-insiders --install-extension . --force",
    "group": "build",
    "presentation": {
        "reveal": "always",
        "panel": "new"
    },
    "problemMatcher": []
}
```

**Pros:**
- Proper installation process
- Works like any other extension
- Can be run via tasks menu

**Cons:**
- Requires packaging on each install
- Need to reload VS Code after install
- Slower iteration cycle

---

#### Option 3: Workspace Extension Recommendations (Clean Setup)
Use VS Code's workspace extension recommendations with local VSIX:

1. Package extension: `npm run package` (requires `vsce` installed)
2. Install locally: `code-insiders --install-extension ck3-language-support-*.vsix`
3. Add to `.vscode/extensions.json`:

```json
{
    "recommendations": [
        "ck3-language-support"
    ]
}
```

**Pros:**
- Professional workflow
- Clean separation from dev code
- Works like published extension

**Cons:**
- Most complex setup
- Need to repackage and reinstall for each test
- Requires `vsce` package tool

---

## Recommendation

**Use Option 1 (Symlink)** for active development. It's the fastest for iteration:

1. Create the symlink once
2. Edit code as normal
3. Run "npm: compile" task (or watch mode)
4. Reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window")
5. Test changes immediately

Switch to **Option 3 (VSIX Package)** when preparing for release or testing the full installation experience.

---

## Implementation Steps

- [ ] Choose solution option (recommended: Option 1)
- [ ] Create symlink or implement chosen solution
- [ ] Test extension loads in main VS Code instance
- [ ] Verify hot-reload workflow (compile + reload)
- [ ] Document the workflow in CONTRIBUTING.md
- [ ] Add watch mode task for automatic compilation

---

## Future Enhancements

- [ ] Add webpack watch mode for automatic compilation on file changes
- [ ] Create "Dev Mode" compound task that starts both Python server and TypeScript watch
- [ ] Add extension test suite that runs in main instance
- [ ] Document debugging setup for main instance vs Extension Development Host
