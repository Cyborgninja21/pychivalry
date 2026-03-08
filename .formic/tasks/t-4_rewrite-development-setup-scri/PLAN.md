# Rewrite development setup scripts for TypeScript-only workflow - Implementation Plan

## Status
**PENDING** - Plan created, implementation to begin.

## Context
The three developer-facing scripts in `tools/` still reference a Python-based workflow (Python 3.9+, pip, pytest, pygls, pyyaml, etc.) that no longer exists. This task rewrites all three scripts to reflect the current TypeScript-only stack while preserving each script's existing style conventions and helper-function structure.

## Implementation Overview

### Phase 1: Rewrite `tools/setup-dev-env.sh`
Strip all Python/pip/pytest logic from the bash setup script (~56 lines). Replace the Python 3.9+ check with a Node.js 18+ / npm check. Replace `pip install -e ".[dev]"` with `npm ci` in `vscode-extension/`. Update next-steps messaging to reference `task build`, `task test:unit`, `task lint`, and F5 launch. Keep `set -e`, emoji status indicators, and the existing section-break style.

### Phase 2: Rewrite `tools/Check-Prerequisites.ps1`
Remove the entire Python section (~100+ lines), the `Test-PythonPackage` and `Test-PipPackage` helper functions, and the `-SkipPythonPackages` parameter from the ~414-line PowerShell script. Remove all checks for pytest, black, flake8, mypy, isort, pygls, and pyyaml. Retain `Write-Check`, `Get-CommandVersion`, `Test-MinVersion`, the `-Detailed` parameter, box-drawing banners, and summary/exit-code behavior. Ensure checks cover exactly: Git, GitHub CLI (with auth status), Node.js 18+, npm, VS Code, and `vscode-extension/node_modules` presence.

### Phase 3: Rewrite `tools/Install-Prerequisites.ps1`
Remove the Python prerequisite entry from the `$Prerequisites` configuration array and the `pip install pychivalry` next-step message in the ~262-line PowerShell script. Retain `Write-Status`, `Show-Banner`, `Test-Winget`, `Get-InstalledVersion`, `Install-WithWinget`, `Update-PathFromRegistry` helpers, the `-Auto` parameter, and the winget-based install flow. Ensure the prerequisites list covers only: Node.js, Git, GitHub CLI, and VS Code.

### Phase 4: Verification
Confirm no Python-related references remain in any `tools/` script. Validate scripts are syntactically correct (shellcheck for bash, PowerShell parsing for .ps1). Review next-steps messaging in all three scripts for consistency with the TypeScript workflow.

## Key Milestones
- `setup-dev-env.sh` bootstraps a fresh clone with only Node.js 18+ installed
- `Check-Prerequisites.ps1` passes/fails for exactly the TypeScript-stack prerequisites
- `Install-Prerequisites.ps1` offers only Node.js, Git, GitHub CLI, and VS Code
- Zero references to Python/pip/pytest/pygls/pyyaml/black/flake8/mypy/isort/setup.py/pychivalry-as-pip-package remain in `tools/`

## Success Criteria
- `tools/setup-dev-env.sh` exits 0 on a machine with Node.js 18+ and npm, after running `npm ci` and installing pre-commit hooks
- `tools/Check-Prerequisites.ps1` reports correct pass/fail for Git, GitHub CLI, Node.js 18+, npm, VS Code, and `node_modules`
- `tools/Install-Prerequisites.ps1` lists only Node.js, Git, GitHub CLI, and VS Code as installable prerequisites
- `grep -riE 'python|pip |pytest|pygls|pyyaml|black|flake8|mypy|isort|setup\.py|pychivalry' tools/` returns no matches
- All three scripts preserve their existing visual style (emoji indicators, box-drawing banners, helper functions)
