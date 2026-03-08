# Run full verification suite and confirm zero Python remnants

## Overview

After all cleanup tasks are complete, perform a comprehensive verification to confirm the migration is fully complete with no remaining Python artifacts, broken references, or test failures.

**Verification steps:**

1. **Codebase search** — Run a project-wide search for the following terms and confirm zero hits (excluding `node_modules/`, `dist/`, and the migration documentation in `Documentation/COMPLETE-pygls-replacement.md`):
   - `pythonPath` (should be zero in source, config, and tests)
   - `pygls` (should be zero outside Documentation/)
   - `pip install` (should be zero outside Documentation/)
   - `pytest` (should be zero outside Documentation/)
   - `setup.py` (should be zero)
   - `pyproject.toml` (should be zero)
   - `requirements.txt` (should be zero)

2. **Build verification:**
   - Run `task build` — confirm clean compilation with no errors
   - Run `task lint` — confirm zero warnings
   - Run `task format:check` — confirm all files properly formatted
   - Run `task test:unit` — confirm all unit tests pass
   - Run `task ci` — confirm full CI pipeline passes

3. **Extension functionality:**
   - Verify `vscode-extension/package.json` has no `pythonPath` in contributes
   - Verify `vscode-extension/package.json` activationEvents are correct (onLanguage:ck3, workspaceContains:**/descriptor.mod)
   - Verify the `args` setting still works correctly (it's legitimate)

4. **Documentation consistency:**
   - Verify README prerequisites list only Node.js, npm, and VS Code
   - Verify CONTRIBUTING.md setup instructions are TypeScript-only
   - Verify no user-facing doc mentions Python as a requirement

5. **File inventory:**
   - Confirm no `.py` files exist outside `node_modules/`
   - Confirm no `__pycache__/`, `.venv/`, or `.pytest_cache/` directories exist
   - Confirm `.gitignore` has no Python-specific entries

**Acceptance criteria:**
- All build, lint, format, and test commands pass with zero errors/warnings
- Project-wide search for Python artifacts returns zero results (outside Documentation/)
- Extension launches correctly via F5 in VS Code
- The project is fully self-consistent as a TypeScript-only codebase

## Goals

- [ ] Define specific goals here

## Key Capabilities

- Describe what this task will accomplish

## Non-Goals

- What is explicitly out of scope

## Requirements

- List technical and functional requirements
