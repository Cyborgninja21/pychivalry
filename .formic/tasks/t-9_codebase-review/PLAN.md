# Codebase Review: Remove Legacy Python Remnants - Implementation Plan

## Status
**PENDING** - Plan created, implementation to begin.

## Context
The project migrated from a Python/pygls language server to TypeScript. Runtime code is clean, but documentation, GitHub configs, and the server README still contain stale Python references, a migration artifact document, and Formic tasks for already-completed cleanup work. This task audits and cleans all remnants.

## Implementation Overview

### Phase 1: Audit & Categorize
Full-text search of the repository for Python-related keywords (`python`, `pygls`, `pythonPath`, `serverImplementation`, `.py`, `pip`, `pytest`, `requirements.txt`). Each match is categorized as either a *historical record* (keep — e.g., CHANGELOG.md) or *active guidance / stale artifact* (remove or rewrite).

**Key files already identified:**
- `vscode-extension/src/server/README.md` — "Running" section references `serverImplementation` toggle; "Performance" section compares against Python
- `Documentation/COMPLETE-pygls-replacement.md` — migration-era artifact, no longer needed
- `.github/copilot-instructions.md` and `.github/prompts/*.prompt.md` — multiple Python references
- `Documentation/` — several files with stale Python references (HYBRID_ARCHITECTURE_PROPOSAL, feature-parity-analysis, typescript-server-complete, etc.)
- `tools/README.md` and `tools/SCOPE_EXTRACTION_WORKFLOW.md` — may contain Python tooling references
- `SECURITY.md` — may contain Python dependency references

### Phase 2: Rewrite & Remove
- Rewrite `vscode-extension/src/server/README.md` to describe the TypeScript server standalone, removing the Python toggle and performance comparison
- Remove or archive `Documentation/COMPLETE-pygls-replacement.md`
- Update `.github/copilot-instructions.md` and affected `.github/prompts/` files to remove Python references
- Clean up remaining Documentation files that contain stale Python guidance
- Update `tools/README.md` if it references Python tooling

### Phase 3: Close Stale Tasks & Verify
- Mark Formic tasks t-2, t-3, t-4, t-7 as completed in `.formic/board.json` (their cleanup work is already done)
- Run `task lint` and `task format:check` to confirm zero warnings
- Final keyword sweep to confirm no active Python references remain outside historical records

## Key Milestones
- Audit complete with categorized list of all Python references
- Server README rewritten as TypeScript-only document
- All stale documentation and config files cleaned
- Formic tasks t-2, t-3, t-4, t-7 closed
- Lint and format checks pass clean

## Success Criteria
- Zero Python-related keywords in active guidance files (outside CHANGELOG.md and `.formic/` task docs)
- `vscode-extension/src/server/README.md` contains no Python/pygls references
- `Documentation/COMPLETE-pygls-replacement.md` removed or archived
- `task lint` and `task format:check` pass with zero warnings
- Formic board reflects t-2, t-3, t-4, t-7 as completed
