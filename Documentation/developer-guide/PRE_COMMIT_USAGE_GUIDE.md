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
vim pychivalry/server.py

# Stage your changes
git add pychivalry/server.py

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
- Install Python development dependencies
- Install pre-commit hooks
- Install VS Code extension dependencies (if Node.js is available)
- Run initial checks on all files

### Option 2: Manual Setup

If you prefer to install manually:

```bash
# 1. Install Python dependencies
pip install -e ".[dev]"

# 2. Install pre-commit hooks
pre-commit install

# 3. (Optional) Install VS Code extension dependencies
cd vscode-extension
npm install
cd ..
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
$ git commit -m "Add user authentication"
black....................................................................Passed
flake8...................................................................Passed
isort....................................................................Passed
trailing whitespace......................................................Passed
[main abc1234] Add user authentication
 1 file changed, 10 insertions(+)
```

### Example: Auto-Fixed Issues

```bash
$ git commit -m "Add user authentication"
black....................................................................Failed
- hook id: black
- files were modified by this hook

reformatted pychivalry/auth.py
1 file reformatted.

# Review the auto-fixes
$ git diff

# Stage the fixes and commit again
$ git add -u
$ git commit -m "Add user authentication"
black....................................................................Passed
[main def5678] Add user authentication
 1 file changed, 10 insertions(+)
```

### Example: Manual Fixes Required

```bash
$ git commit -m "Add user authentication"
flake8...................................................................Failed
- hook id: flake8
- exit code: 1

pychivalry/auth.py:42:80: E501 line too long (110 > 100 characters)

# Fix the issue manually
$ vim pychivalry/auth.py

# Try again
$ git add pychivalry/auth.py
$ git commit -m "Add user authentication"
```

## What Gets Checked

### Python Files

#### Black (Auto-formats)
- **What**: Formats Python code for consistent style
- **Line length**: 100 characters
- **Auto-fixes**: Yes
- **Files**: `pychivalry/`, `tests/`, `tools/`

Example:
```python
# Before (poorly formatted)
def my_function(arg1,arg2,arg3):
    return arg1+arg2+arg3

# After (Black auto-formats)
def my_function(arg1, arg2, arg3):
    return arg1 + arg2 + arg3
```

#### flake8 (Linting)
- **What**: Checks code style and catches potential errors
- **Auto-fixes**: No (you must fix manually)
- **Files**: `pychivalry/`, `tests/`, `tools/`

Common errors caught:
- Unused imports
- Undefined variables
- Lines too long
- Missing whitespace
- Syntax errors

#### isort (Import sorting)
- **What**: Organizes import statements
- **Auto-fixes**: Yes
- **Files**: `pychivalry/`, `tests/`, `tools/`

Example:
```python
# Before (messy imports)
from typing import Dict
import os
from pychivalry.parser import parse_document
import sys

# After (isort organizes)
import os
import sys
from typing import Dict

from pychivalry.parser import parse_document
```

### TypeScript Files (VS Code Extension)

#### Prettier (Auto-formats)
- **What**: Formats TypeScript code
- **Auto-fixes**: Yes
- **Files**: `vscode-extension/src/*.ts`

#### ESLint (Linting)
- **What**: Checks TypeScript code quality
- **Auto-fixes**: Some issues (when `--fix` can handle them)
- **Files**: `vscode-extension/src/*.ts`

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

# Make a change
echo "# New feature" >> pychivalry/server.py

# Commit
git add pychivalry/server.py
git commit -m "Add feature"

# Hooks run automatically ✓
```

### Scenario 2: Multiple Files Changed

```bash
# Edit multiple files
vim pychivalry/server.py
vim tests/test_server.py

# Commit all changes
git add .
git commit -m "Add server tests"

# All changed files are checked ✓
```

### Scenario 3: Hooks Auto-Fix Your Code

```bash
# Make changes with poor formatting
vim pychivalry/server.py

# Commit
git add pychivalry/server.py
git commit -m "Update server"

# Output:
# black....................................................Failed
# - files were modified by this hook

# Review what was fixed
git diff

# Stage fixes and commit again
git add pychivalry/server.py
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
pre-commit run black --all-files

# Run on specific file
pre-commit run --files pychivalry/server.py
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
pre-commit run black --verbose
```

### Problem: "Command Not Found" Error

**Symptom**: `pre-commit: command not found`

**Solution**:
```bash
# Install pre-commit
pip install pre-commit

# Or reinstall all dev dependencies
pip install -e ".[dev]"
```

### Problem: Python Import Errors in Hooks

**Symptom**: Hooks fail with `ModuleNotFoundError`

**Solution**:
```bash
# Reinstall project and dependencies
pip install -e ".[dev]"

# Clear pre-commit cache
pre-commit clean
pre-commit install --install-hooks
```

### Problem: Can't Commit Due to Formatting Issues

**Symptom**: Hook keeps failing with same error

**Solution**:
```bash
# For auto-fixable issues, run manually
pre-commit run black --all-files
pre-commit run isort --all-files

# Stage the fixes
git add -u

# For non-fixable issues, check the error and fix manually
pre-commit run flake8 --all-files
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
SKIP=flake8 git commit -m "message"

# Or fix the issue instead (recommended)
pre-commit run flake8 --all-files
# Fix the issues shown
git add -u
git commit -m "message"
```

## Advanced Usage

### Running Specific Hooks

```bash
# Python formatting only
pre-commit run black --all-files

# Python linting only
pre-commit run flake8 --all-files

# Import sorting only
pre-commit run isort --all-files

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
  - repo: https://github.com/psf/black
    rev: 24.1.1
    hooks:
      - id: black
        args: [--line-length=120]  # Change line length
        exclude: ^tests/  # Skip tests directory
```

### Running on Specific File Patterns

```bash
# Run on Python files only
pre-commit run --files pychivalry/**/*.py

# Run on TypeScript files only
pre-commit run --files vscode-extension/src/**/*.ts

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

Configure your editor to use the same tools (Black, Prettier) with the same settings. See `.vscode/settings.json` for VS Code configuration.

### Can I use different Python version for hooks?

Hooks use the Python version from your virtual environment. To change:
```bash
# Activate different Python environment
source venv/bin/activate

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
pre-commit run black isort
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
- [Black documentation](https://black.readthedocs.io/)
- [flake8 documentation](https://flake8.pycqa.org/)
- [isort documentation](https://pycqa.github.io/isort/)
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
