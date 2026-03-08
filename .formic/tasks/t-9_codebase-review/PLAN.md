# Codebase Review: Remove Legacy Python Remnants — Implementation Plan

## Status
**PENDING** — Plan created, implementation to begin.

## Context
The project migrated from a Python/pygls language server to a pure TypeScript stack. While runtime code and build tooling are fully migrated, documentation and GitHub guidance files still contain extensive Python references that must be removed or rewritten so the project presents as a clean TypeScript-only extension.

## Implementation Overview

### Phase 1: Full-Text Audit
Scan the entire repository (excluding `node_modules/` and `dist/`) for Python-related keywords (`python`, `pygls`, `pythonPath`, `serverImplementation`, `requirements.txt`, `.py`, `pip`, `pytest`, `Black`, `flake8`, `mypy`). Classify each hit as *historical record* (preserve, e.g. CHANGELOG.md) or *active guidance/stale artifact* (remove/rewrite). This produces the authoritative hit list.

### Phase 2: High-Impact File Rewrites
Rewrite the two files with the densest Python references:
- `.github/copilot-instructions.md` (~28 Python references) — Remove all Python 3.9+ requirements, Black/flake8/mypy tooling, pytest patterns, pygls LSP patterns, and Python folder structure. Retain only TypeScript-stack guidance.
- `.github/placeholder` — Remove Python 3.9+, pytest, Black, flake8, mypy, and pip references.

### Phase 3: Documentation Updates
- `Documentation/PRD.md` — Replace pygls 2.0 technology references with current TypeScript LSP stack; remove pygls glossary entry and stale pytest coverage metrics.
- `Documentation/IMPLEMENTATION_STATUS.md` — Review line 4 migration reference; update if it serves as active guidance.
- `vscode-extension/src/server/README.md` — Rewrite to describe the TypeScript server on its own terms, removing Python implementation references and `serverImplementation` toggle.

### Phase 4: Obsolete Document Removal
Delete five migration-era documents:
- `Documentation/HYBRID_ARCHITECTURE_PROPOSAL.md`
- `Documentation/DATA_EXTRACTION_GUIDE.md`
- `Documentation/COMPLETE-pygls-replacement.md`
- `Documentation/typescript-implementation-plan.md`
- `Documentation/typescript-server-complete.md`

### Phase 5: Formic Board Verification & Quality Gate
- Verify `.formic/board.json` reflects completed status for tasks t-2, t-3, t-4, and t-7.
- Run `task lint` and `task format:check` to confirm zero warnings.
- Re-run keyword audit to confirm no active Python guidance remains.

## Key Milestones
- Audit complete with classified hit list
- `.github/copilot-instructions.md` rewritten (highest-impact file)
- All five obsolete migration documents deleted
- Lint and format checks pass with zero warnings

## Success Criteria
- Zero active Python guidance remains in any non-historical file
- `.github/copilot-instructions.md` contains only TypeScript-stack guidance
- All five obsolete migration documents deleted from the repository
- `task lint` and `task format:check` pass with zero warnings
- Formic board accurately reflects completion of prior cleanup tasks (t-2, t-3, t-4, t-7)
