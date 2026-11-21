# Pre-commit Hooks User Guide

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Daily Workflow](#daily-workflow)
- [What Gets Checked](#what-gets-checked)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)
- [FAQ](#faq)

## Overview

Pre-commit hooks are automated checks that run before you commit code to git. They help maintain code quality by:
- ✅ Automatically fixing formatting issues
- ✅ Catching common errors before they reach code review
- ✅ Ensuring consistent code style across the project
- ✅ Preventing CI/CD failures

This guide shows you how to use pre-commit hooks in the pychivalry project.

## Quick Start

### First-Time Setup

1. **Install dependencies and hooks** (one command does it all):
   ```bash
   ./tools/setup-dev-env.sh
   ```

2. **Verify installation**:
   ```bash
   pre-commit --version
   ```

3. **Start coding!** Pre-commit hooks will now run automatically on every commit.

### Basic Workflow

```bash
# Make your changes
vim vscode-extension/src/server/server.ts

# Stage your changes
git add vscode-extension/src/server/server.ts

# Commit (hooks run automatically)
git commit -m "Add new feature"

# If hooks auto-fix issues, review and commit again
git diff  # Review auto-fixes
git add -u  # Stage the fixes
git commit -m "Add new feature"
```

## Installation

### Option 1: Automatic Setup (Recommended)

The setup script installs everything you need:

```bash
./tools/setup-dev-env.sh
```

This will:
- Install TypeScript development dependencies
- Install pre-commit hooks
- Install VS Code extension dependencies
- Run initial checks on all files

### Option 2: Manual Setup

If you prefer to install manually:

```bash
# 1. Install pre-commit hooks
pre-commit install

# 2. Install TypeScript dependencies
cd vscode-extension
npm install
cd ..

# 3. Install development dependencies for linting and formatting
npm install
```

### Verify Installation

Check that hooks are installed:
```bash
# Should show the hook script
cat .git/hooks/pre-commit

# Should show pre-commit version
pre-commit --version
```

## Daily Workflow

### Normal Commits (Recommended)

Just commit as usual. Hooks run automatically:

```bash
git add .
git commit -m "Your commit message"
```

**What happens:**
1. Pre-commit runs all configured hooks
2. Auto-fixable issues are fixed automatically
3. If fixes were made, the commit is aborted
4. Review the changes, stage them, and commit again

### Example: Successful Commit

```bash
$ git commit -m "Add LSP hover feature"
prettier.................................................................Passed
eslint...................................................................Passed
trailing whitespace......................................................Passed
[main abc1234] Add LSP hover feature
 1 file changed, 10 insertions(+)
```

### Example: Auto-Fixed Issues

```bash
$ git commit -m "Add LSP hover feature"
prettier.................................................................Failed
- hook id: prettier
- files were modified by this hook

vscode-extension/src/server/lsp/hover.ts

# Review the auto-fixes
$ git diff

# Stage the fixes and commit again
$ git add -u
$ git commit -m "Add LSP hover feature"
prettier.................................................................Passed
[main def5678] Add LSP hover feature
 1 file changed, 10 insertions(+)
```

### Example: Manual Fixes Required

```bash
$ git commit -m "Add LSP hover feature"
eslint...................................................................Failed
- hook id: eslint
- exit code: 1

vscode-extension/src/server/lsp/hover.ts
  42:80  error  Line too long (max 120 characters)  max-len

# Fix the issue manually
$ vim vscode-extension/src/server/lsp/hover.ts

# Try again
$ git add vscode-extension/src/server/lsp/hover.ts
$ git commit -m "Add LSP hover feature"
```

## What Gets Checked

### TypeScript Files (Main Language Server)

#### Prettier (Auto-formats)
- **What**: Formats TypeScript code for consistent style
- **Auto-fixes**: Yes
- **Files**: `vscode-extension/src/**/*.ts`

Example:
```typescript
// Before (poorly formatted)
function parseDocument(text:string,uri:string):Document{
return{uri,ast:parse(text)}
}

// After (Prettier auto-formats)
function parseDocument(text: string, uri: string): Document {
  return { uri, ast: parse(text) };
}
```

#### ESLint (Linting)
- **What**: Checks code quality and catches potential TypeScript errors
- **Auto-fixes**: Some issues (when `--fix` can handle them)
- **Files**: `vscode-extension/src/**/*.ts`

Common errors caught:
- Unused variables and imports
- Missing type annotations
- Inconsistent code style
- Potential runtime errors
- TypeScript-specific issues

### TypeScript Files (Data Extraction Tools)

#### Prettier (Auto-formats)
- **What**: Formats TypeScript code for consistent style
- **Line length**: 120 characters
- **Auto-fixes**: Yes
- **Files**: `tools/**/*.ts`

#### ESLint (Linting)
- **What**: Checks code style and catches potential TypeScript errors
- **Auto-fixes**: Some issues (when `--fix` can handle them)
- **Files**: `tools/**/*.ts`

Example:
```typescript
// Before (poorly formatted)
function extractData(filePath:string,outputPath:string):Promise<void>{
const data=processFile(filePath);return writeOutput(outputPath,data);
}

// After (Prettier auto-formats)
function extractData(filePath: string, outputPath: string): Promise<void> {
  const data = processFile(filePath);
  return writeOutput(outputPath, data);
}
```

### All Files

- **Trailing whitespace**: Removes spaces/tabs at end of lines (auto-fix)
- **End of file**: Ensures files end with newline (auto-fix)
- **YAML/JSON/TOML**: Validates syntax (no auto-fix)
- **Large files**: Prevents commits >1MB (no auto-fix)
- **Merge conflicts**: Detects conflict markers (no auto-fix)

## Common Scenarios

### Scenario 1: First Commit After Setup

```bash
# Setup hooks
./tools/setup-dev-env.sh

# Make a change to the TypeScript server
echo "export function newFeature() { return 'feature'; }" >> vscode-extension/src/server/core/parser.ts

# Commit
git add vscode-extension/src/server/core/parser.ts
git commit -m "Add new parser feature"

# Hooks run automatically ✓
```

### Scenario 2: Multiple Files Changed

```bash
# Edit multiple TypeScript files
vim vscode-extension/src/server/lsp/completions.ts
vim vscode-extension/src/server/lsp/hover.ts

# Commit all changes
git add .
git commit -m "Add LSP features"

# All changed files are checked ✓
```

### Scenario 3: Hooks Auto-Fix Your Code

```bash
# Make changes with poor formatting
vim vscode-extension/src/server/server.ts

# Commit
git add vscode-extension/src/server/server.ts
git commit -m "Update server"

# Output:
# prettier..................................................Failed
# - files were modified by this hook

# Review what was fixed
git diff

# Stage fixes and commit again
git add vscode-extension/src/server/server.ts
git commit -m "Update server"

# Now it passes ✓
```

### Scenario 4: Emergency Commit (Skip Hooks)

**Warning**: Only use in emergencies! Skipped hooks may cause CI failures.

```bash
git commit --no-verify -m "Emergency hotfix"
```

### Scenario 5: Running Hooks Manually

```bash
# Run hooks on all files
pre-commit run --all-files

# Run hooks on staged files only
pre-commit run

# Run specific hook on all files
pre-commit run prettier --all-files

# Run on specific file
pre-commit run --files tools/extract-traits.ts
```

### Scenario 6: Hooks Fail on Large Codebase Import

When first running hooks on an existing codebase:

```bash
# Install hooks
pre-commit install

# Run on all files (may find many issues)
pre-commit run --all-files

# Many files may be reformatted. Review changes:
git diff

# If changes look good, commit them
git add -u
git commit -m "Apply code formatting with pre-commit hooks"
```

## Troubleshooting

### Problem: Hooks Don't Run

**Symptom**: Commits succeed without any hook output

**Solution**:
```bash
# Check if hooks are installed
ls -la .git/hooks/pre-commit

# Reinstall hooks
pre-commit install

# Test manually
pre-commit run --all-files
```

### Problem: Hook Hangs or Takes Too Long

**Symptom**: Hook seems stuck or runs for several minutes

**Solution**:
```bash
# Cancel with Ctrl+C

# Run with verbose output to see what's happening
pre-commit run --verbose --all-files

# Or run specific hook
pre-commit run prettier --verbose
```

### Problem: "Command Not Found" Error

**Symptom**: `pre-commit: command not found`

**Solution**:
```bash
# Install pre-commit via npm or pip
npm install -g pre-commit
# or
pip install pre-commit

# Reinstall TypeScript dependencies
cd vscode-extension && npm install
```

### Problem: TypeScript/Node Module Errors in Hooks

**Symptom**: Hooks fail with module resolution errors

**Solution**:
```bash
# Reinstall TypeScript dependencies
cd vscode-extension && npm install

# Clear pre-commit cache
pre-commit clean
pre-commit install --install-hooks
```

### Problem: Can't Commit Due to Formatting Issues

**Symptom**: Hook keeps failing with same error

**Solution**:
```bash
# For auto-fixable issues, run manually
pre-commit run prettier --all-files

# Stage the fixes
git add -u

# For non-fixable issues, check the error and fix manually
pre-commit run eslint --all-files
```

### Problem: Hooks Modified Files But Commit Still Fails

**Symptom**: Hook says "files were modified" but commit fails

**Solution**: This is expected behavior! Review and re-commit:
```bash
# Review the changes made by hooks
git diff

# Stage the auto-fixes
git add -u

# Commit again
git commit -m "Your message"
```

### Problem: Need to Skip One Specific Hook

**Symptom**: One hook fails but others pass, need to skip it temporarily

**Solution**:
```bash
# Skip specific hook (not recommended)
SKIP=eslint git commit -m "message"

# Or fix the issue instead (recommended)
pre-commit run eslint --all-files
# Fix the issues shown
git add -u
git commit -m "message"
```

## Advanced Usage

### Running Specific Hooks

```bash
# TypeScript formatting only (extraction tools)
pre-commit run prettier --all-files

# TypeScript linting only (extraction tools)
pre-commit run eslint --all-files

# TypeScript formatting only
pre-commit run prettier --all-files

# TypeScript linting only
pre-commit run eslint --all-files
```

### Updating Hooks

Pre-commit hooks can be updated to latest versions:

```bash
# Update to latest hook versions
pre-commit autoupdate

# See what changed
git diff .pre-commit-config.yaml

# Test the updates
pre-commit run --all-files
```

### Running Hooks in CI/CD

The same hooks run in CI. To test locally what CI will check:

```bash
# Run all hooks like CI does
pre-commit run --all-files

# Install hooks for CI (in CI script)
pre-commit run --show-diff-on-failure --color=always --all-files
```

### Temporarily Disabling Hooks

**For development only** (not recommended for commits):

```bash
# Disable for one commit
git commit --no-verify -m "WIP: testing"

# Uninstall hooks completely (not recommended)
pre-commit uninstall

# Reinstall when ready
pre-commit install
```

### Configuring Hook Behavior

Edit `.pre-commit-config.yaml` to customize:

```yaml
repos:
  - repo: https://github.com/prettier/prettier
    rev: 3.2.5
    hooks:
      - id: prettier
        args: [--line-length=120]  # Change line length
        exclude: ^tests/  # Skip tests directory
```

### Running on Specific File Patterns

```bash
# Run on TypeScript files only (main extension)
pre-commit run --files vscode-extension/src/**/*.ts

# Run on TypeScript files only (extraction tools)
pre-commit run --files tools/**/*.ts

# Run on changed files in git
pre-commit run --files $(git diff --name-only --cached)
```

## FAQ

### Do I need to install pre-commit every time I clone the repo?

No, just run `./tools/setup-dev-env.sh` once after cloning.

### What happens if I forget to install hooks?

Your commits will succeed locally, but may fail CI checks. Install hooks to catch issues early.

### Can I commit without running hooks?

Yes, with `git commit --no-verify`, but this is not recommended. Your code may fail CI.

### Do hooks run on all files or just changed files?

By default, only on staged (changed) files. Use `--all-files` to run on everything.

### How do I see what a hook would do without running it?

```bash
# Dry run (doesn't modify files)
pre-commit run --all-files --verbose
```

### What if hooks conflict with my editor's formatting?

Configure your editor to use the same tools (Prettier, ESLint) with the same settings. See `.vscode/settings.json` for VS Code configuration.

### Can I use different Node.js version for hooks?

Hooks use the Node.js version from your current environment. To change:
```bash
# Switch Node.js version (if using nvm)
nvm use 18

# Reinstall TypeScript dependencies
cd vscode-extension && npm install

# Reinstall hooks
pre-commit install
```

### How much time do hooks add to commits?

- First run: 2-5 seconds (downloads tools)
- Subsequent runs: <1 second for small changes
- Large changesets: 2-10 seconds

### Can I run hooks in parallel?

Hooks already run in parallel automatically. You can't make them faster, but you can run specific hooks:
```bash
# Run only fast hooks
pre-commit run prettier eslint
```

### What if I'm working on a large refactor?

Commit frequently with hooks enabled, or:
```bash
# Disable for rapid iteration
pre-commit uninstall

# When done, format all at once
pre-commit run --all-files

# Reinstall
pre-commit install
```

### Do hooks work on Windows?

Yes! Pre-commit supports Windows, Mac, and Linux.

### How do I contribute a new hook?

1. Edit `.pre-commit-config.yaml`
2. Add your hook configuration
3. Test with `pre-commit run --all-files`
4. Submit a PR with your changes

## Additional Resources

- [Pre-commit official documentation](https://pre-commit.com/)

- [Prettier documentation](https://prettier.io/)
- [ESLint documentation](https://eslint.org/)
- [Project CONTRIBUTING.md](../CONTRIBUTING.md)

## Getting Help

If you encounter issues:
1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review error messages carefully
3. Run with `--verbose` for more details
4. Check `.pre-commit-config.yaml` for configuration
5. Open an issue on GitHub

---

**Remember**: Pre-commit hooks are your friends! They help you write better code and catch mistakes early. 🚀
