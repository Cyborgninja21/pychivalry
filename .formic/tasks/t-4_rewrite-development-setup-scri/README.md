# Rewrite development setup scripts for TypeScript-only workflow

## Overview

The three developer-facing setup scripts in `tools/` still reference a Python-based workflow that no longer exists — checking for Python 3.9+, running `pip install -e ".[dev]"` against a nonexistent `setup.py`, and guiding developers to run `pytest`. This task rewrites all three scripts to reflect the current TypeScript-only stack (VS Code extension + embedded LSP server built with webpack).

## Goals

- Eliminate all Python, pip, pytest, pygls, and pychivalry-package references from `tools/` scripts
- Ensure `tools/setup-dev-env.sh` successfully bootstraps a fresh clone when only Node.js 18+ is installed
- Ensure `tools/Check-Prerequisites.ps1` reports pass/fail for exactly: Git, GitHub CLI, Node.js 18+, npm, and VS Code
- Ensure `tools/Install-Prerequisites.ps1` offers to install only Node.js, Git, GitHub CLI, and VS Code via winget

## Key Capabilities

- `tools/setup-dev-env.sh` validates Node.js 18+ and npm, runs `npm ci` in `vscode-extension/`, installs pre-commit hooks, runs `pre-commit run --all-files`, and prints next steps referencing `task test:unit`, `task lint`, and F5 launch
- `tools/Check-Prerequisites.ps1` checks Git, GitHub CLI (with auth status), Node.js 18+, npm, VS Code, and `vscode-extension/node_modules` presence — with no Python sections, helper functions, or parameters (`-SkipPythonPackages`)
- `tools/Install-Prerequisites.ps1` removes the Python prerequisite entry from its `$Prerequisites` array and removes the `pip install pychivalry` next-step message

## Non-Goals

- Adding new tooling or dependencies (e.g., nvm, volta, fnm) — scripts check for Node.js but do not manage its installation on Linux/macOS
- Changing the pre-commit hook configuration (`.pre-commit-config.yaml`) — it already targets TypeScript/Prettier/ESLint
- Updating CI workflows (`.github/`) — those already use the correct TypeScript pipeline
- Cross-platform unification (rewriting PowerShell scripts into bash or vice-versa)

## Requirements

- Scripts preserve existing style conventions: emoji status indicators in bash (`✓`, `❌`, `✅`), `Write-Check`/`Write-Status` helpers and box-drawing banners in PowerShell
- `setup-dev-env.sh` uses `set -e` and exits non-zero on missing prerequisites
- `Check-Prerequisites.ps1` retains its `Write-Check` helper, `Get-CommandVersion` helper, `Test-MinVersion` helper, `-Detailed` parameter, and summary/exit-code behavior
- `Install-Prerequisites.ps1` retains its winget-based install flow and `-Auto` parameter
- No references remain to: Python, pip, pytest, pygls, pyyaml, black, flake8, mypy, isort, `setup.py`, or `pychivalry` as a pip package
- Next-steps messaging in all scripts references the TypeScript workflow: `npm ci`, `task build`, `task test:unit`, `task lint`, F5 in VS Code
