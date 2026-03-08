# Update README and user-facing documentation to reflect TypeScript architecture

## Overview

The root README.md, vscode-extension/README.md, CONTRIBUTING.md, and vscode-extension/CHANGELOG.md contain extensive Python references that are now misleading to users and contributors.

**Files to modify:**

1. `README.md` (root) — Major updates needed:
   - Line 3: Remove or replace Python 3.9+ badge (replace with Node.js 18+ badge)
   - Line 103: Change 'Lightweight Python server' to describe the TypeScript server
   - Lines 143-155: Remove Python prerequisite and `pip install -e .` instructions; update to Node.js-only prerequisites and build steps
   - Lines 186-197: Remove `pip install -e ".[dev]"`, `pytest`, `black`, `flake8`, `mypy` developer commands; replace with `npm run compile`, `npm test`, `npm run lint`
   - Lines 199-215: Remove `pythonPath` from configuration table and example JSON
   - Lines 238-243: Update trait extraction section to remove 'Python 3.9+ with PyYAML' requirement (trait extraction is now handled by TypeScript)
   - Lines 269-298: Rewrite project structure to show current TypeScript layout (`vscode-extension/src/server/`, `vscode-extension/src/test/`, etc.) instead of the old Python layout (`pychivalry/*.py`, `tests/`)
   - Lines 319-325: Update contributor setup to remove Python tool references; mention only TypeScript/Prettier/ESLint
   - Lines 342-349: Remove pygls acknowledgment and documentation link; acknowledge vscode-languageserver instead

2. `vscode-extension/README.md` — Update:
   - Remove 'Python Detection' feature description
   - Remove 'Python 3.9 or higher' requirement
   - Remove `pip install pychivalry` instructions
   - Remove `pythonPath` from settings documentation
   - Remove 'Python Not Found' troubleshooting section
   - Update to describe the embedded TypeScript LSP server

3. `vscode-extension/CHANGELOG.md` — Update:
   - Line 50-57: Remove 'Python Detection' feature description
   - Line 106: Remove `pythonPath` from configuration table

4. `CONTRIBUTING.md` — Update:
   - Line 9: Remove 'Python 3.9 or higher' prerequisite
   - Lines 52-54: Remove Python formatting/linting references (Black, flake8)
   - Lines 168-181: Update project structure to reflect TypeScript layout
   - Lines 225-226: Remove 'Python version' from bug report template

**Technical considerations:**
- Preserve the project name 'pychivalry' throughout (it's the project brand, not a Python reference)
- Keep references to `data/` YAML files (these are still used)
- Do not remove the Apache 2.0 license or Paradox Interactive acknowledgment
- Keep the existing feature list accurate — verify against current implementation

**Acceptance criteria:**
- No instructions to install Python, pip, or pygls in any user-facing documentation
- No `pythonPath` configuration documented
- Project structure section accurately reflects the TypeScript codebase
- Setup instructions work for a fresh clone with only Node.js installed
- All markdown files pass YAML/markdown lint

## Goals

- [ ] Define specific goals here

## Key Capabilities

- Describe what this task will accomplish

## Non-Goals

- What is explicitly out of scope

## Requirements

- List technical and functional requirements
