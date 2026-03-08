# Update README and User-Facing Documentation — Implementation Plan

## Status
**PENDING** — Plan created, implementation to begin.

## Context
The root `README.md`, `vscode-extension/README.md`, `CONTRIBUTING.md`, and `vscode-extension/CHANGELOG.md` still describe a Python-based architecture (pygls, pip, pytest, Black, flake8, `pythonPath`) that was fully replaced by the TypeScript/Node.js embedded LSP server. This task removes all misleading Python references and replaces them with accurate descriptions of the current stack.

## Implementation Overview

### Phase 1: Root README.md
The largest and most visible file. Replace the Python 3.9+ badge with Node.js 18+; rewrite Prerequisites (remove Python, keep Node.js 18+ and VS Code); replace `pip install -e .` installation with `npm install && npm run compile` from `vscode-extension/`; remove the "For Developers" Python section (`pip install -e ".[dev]"`, `pytest`, `black`, `flake8`, `mypy`); remove `ck3LanguageServer.pythonPath` from configuration table and example JSON; replace "⚡ Fast — Lightweight Python server" with TypeScript/Node description; replace the project structure tree with the actual TypeScript layout; update pre-commit hook descriptions to remove Python formatting references; replace pygls acknowledgment with vscode-languageserver acknowledgment; remove pygls docs link from Resources; update Trait Validation section to remove Python 3.9+ requirement.

### Phase 2: vscode-extension/README.md
Rewrite Requirements to state "VS Code 1.75+" and "Node.js 18+ (development only)" — no Python; remove `pythonPath` from Extension Settings; remove Python Detection, Module Check, and "Install pychivalry" from Enhanced Error Handling; remove all Troubleshooting sections about Python Not Found and pychivalry Not Installed; update Usage to remove Python prerequisites; remove "Coming Soon" section (features already shipped); update settings example JSON.

### Phase 3: CONTRIBUTING.md
Rewrite Prerequisites to list Node.js 18+, npm, Git (no Python); replace manual setup `pip install -e ".[dev]"` with `cd vscode-extension && npm install`; update Pre-commit Hooks to remove Python-specific hooks (Black, flake8, isort); replace development workflow commands (`black`, `flake8`, `isort`, `pytest`) with `npm run lint`, `npm run format`, `npm test`, `task` commands; update project structure tree to match actual TypeScript layout; update PR checklist to reference npm/task commands; update Bug Reports to ask for Node.js version instead of Python version; update "Areas for Contribution" to reflect current state (many items are already done).

### Phase 4: vscode-extension/CHANGELOG.md
Remove forward-looking "Coming Soon"-style items from historical entries (features already exist); remove `pythonPath` from v0.1.0 Configuration Settings table; update v0.2.0 "Enhanced Error Handling" to remove Python Detection references; remove stale Roadmap section (v0.3.0, v0.4.0, v1.0.0 targets); keep historical facts intact (dates, what was actually released).

### Phase 5: Verification
Grep all four files for banned terms (`pip`, `pytest`, `pygls`, `pythonPath`, `Black`, `flake8`, `mypy`, `Python 3.9`); run pre-commit markdown/YAML validation hooks.

## Key Milestones
- Root README.md fully updated (largest single file)
- All four files free of Python installation/configuration instructions
- Pre-commit hooks pass on all modified files

## Success Criteria
- Zero occurrences of `pip`, `pytest`, `pygls`, `pythonPath`, `Black`, `flake8`, `mypy`, or `Python 3.9+` as a prerequisite in any target file
- Project structure sections match actual filesystem layout
- Setup instructions work with Node.js 18+ only (no Python required)
- All modified files pass pre-commit validation
