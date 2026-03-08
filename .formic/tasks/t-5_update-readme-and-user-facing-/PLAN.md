# Update README and User-Facing Documentation — Implementation Plan

## Status
**IN PROGRESS** — Root README.md updates completed (subtasks 1–6). Extension README, CONTRIBUTING, and CHANGELOG remain.

## Context
All four user-facing docs (`README.md`, `vscode-extension/README.md`, `CONTRIBUTING.md`, `vscode-extension/CHANGELOG.md`) still describe the original Python/pygls architecture. Every Python prerequisite, setup command, configuration reference, and project-structure diagram must be replaced with the current TypeScript/Node.js embedded-server reality.

## Implementation Overview

### Phase 1: Root README.md ✅
Replace the Python 3.9+ badge with Node.js 18+; rewrite Quick Start / Installation / For Developers sections to use npm/Taskfile commands only; update the Configuration table to reflect actual `package.json` settings (remove `pythonPath`, add formatting/inlayHints/logWatcher groups); replace the entire Project Structure tree with the real TypeScript layout; update Contributing quick-start to reference TypeScript-only pre-commit hooks; swap the pygls acknowledgment for vscode-languageserver; update Trait Validation to remove Python 3.9+ requirement.

### Phase 2: vscode-extension/README.md
Remove Python 3.9+ / pip requirements; rewrite the Requirements section to state the server is embedded (no separate install); remove Python Detection and pychivalry-install error-handling sections; update Extension Settings table to match actual `package.json` contributes; update Troubleshooting to remove Python-specific issues; remove "Coming Soon" items that are already shipped; update Usage steps to remove Python prerequisites.

### Phase 3: CONTRIBUTING.md
Replace prerequisites (Python 3.9 → Node.js 18+); rewrite dev-environment setup (remove `pip install`, add `npm install`); update pre-commit hooks section to TypeScript-only hooks; replace code-style section (PEP 8/Black → Prettier/ESLint); update testing commands (`pytest` → `npm test` / `task test`); rewrite PR checklist; update project structure tree; update Bug Reports to ask for Node.js/VS Code versions instead of Python.

### Phase 4: vscode-extension/CHANGELOG.md
Remove Python-specific feature descriptions from v0.1.0 and v0.2.0 entries (Python detection, `pythonPath` setting, `pip install pychivalry` references) while keeping all non-Python content. Update the v0.1.0 Configuration Settings table to remove `pythonPath`. Remove stale Roadmap section.

### Phase 5: Verification
Grep all four files for residual Python references (`pip`, `pytest`, `pygls`, `pythonPath`, `Black`, `flake8`, `mypy`, `Python 3.9`). Run pre-commit markdown/YAML validation hooks on all modified files.

## Key Milestones
- Root README.md fully updated ✅
- Extension README describes embedded server with no Python dependency
- CONTRIBUTING.md provides accurate TypeScript-only contributor workflow
- CHANGELOG.md cleaned of misleading Python feature descriptions
- Zero residual Python references confirmed across all four files

## Success Criteria
- A user with only Node.js 18+ and npm can follow setup instructions successfully
- All settings tables match `vscode-extension/package.json` contributes.configuration
- Project structure trees match actual filesystem layout
- `grep -iE 'pip|pytest|pygls|pythonPath|Black|flake8|mypy|Python 3\.9' README.md vscode-extension/README.md CONTRIBUTING.md vscode-extension/CHANGELOG.md` returns zero matches
- All modified files pass pre-commit hooks
