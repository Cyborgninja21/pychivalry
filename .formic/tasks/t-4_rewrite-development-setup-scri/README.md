# Rewrite development setup scripts for TypeScript-only workflow

## Overview

The development setup and prerequisite-check scripts still assume a Python-based workflow. They try to install Python packages, check for pygls/pytest, and reference `pip install -e .` against a nonexistent `setup.py`. These must be updated to reflect the TypeScript-only reality.

**Files to modify:**

1. `tools/setup-dev-env.sh` — Complete rewrite. Currently:
   - Checks for Python 3.9+ (unnecessary)
   - Runs `pip install -e ".[dev]"` (broken — no setup.py exists)
   - Tells user to run `pytest` (no Python tests exist)
   
   New version should:
   - Check for Node.js 18+ and npm
   - Run `cd vscode-extension && npm ci`
   - Install pre-commit hooks (`pre-commit install`)
   - Run pre-commit on all files
   - Print next steps referencing `task test:unit`, `task lint`, and F5 launch

2. `tools/Check-Prerequisites.ps1` — Update to remove Python-specific checks:
   - Remove Python 3.9+ version check
   - Remove pip availability check
   - Remove Python package checks (pytest, black, flake8, mypy, pre-commit, isort, pygls, pyyaml)
   - Remove `pychivalry` pip package check
   - Keep: Git, GitHub CLI, Node.js 18+, npm, VS Code checks

3. `tools/Install-Prerequisites.ps1` — Update to remove Python installation:
   - Remove Python 3.12 winget installation
   - Remove `pip install pychivalry` instructions
   - Keep: Node.js, Git, GitHub CLI installation

**Technical considerations:**
- Follow existing script style and emoji conventions
- Keep pre-commit hook installation (it's still used for TypeScript linting)
- Ensure scripts work on both Linux/macOS (bash) and Windows (PowerShell)

**Acceptance criteria:**
- `tools/setup-dev-env.sh` runs successfully on a fresh clone with Node.js installed
- No references to Python, pip, pytest, pygls, or pychivalry package in any tools/ script
- Scripts correctly guide developers through TypeScript-only setup
- `tools/Check-Prerequisites.ps1` only checks Node.js/npm/Git/VS Code

## Goals

- [ ] Define specific goals here

## Key Capabilities

- Describe what this task will accomplish

## Non-Goals

- What is explicitly out of scope

## Requirements

- List technical and functional requirements
