# Codebase Review: Remove Legacy Python Remnants

## Overview
The project originally used a Python-based language server built on pygls 2.0.0 and has since been fully rewritten in TypeScript. While runtime code, build tooling, CI, developer scripts, and VS Code configuration have been successfully migrated, significant Python references persist in documentation and GitHub guidance files. This task audits the entire codebase and removes or rewrites those remnants so the project presents as a clean, single-stack TypeScript extension.

## Goals
- Remove all active Python guidance from `.github/copilot-instructions.md`, which still contains extensive Python requirements sections (Python 3.9+ target, Black/flake8/mypy rules, pytest patterns, pygls LSP patterns, and a Python-based folder structure)
- Remove or rewrite the `.github/placeholder` file, which references Python 3.9+, pytest, Black, flake8, mypy, and pip installation
- Update `Documentation/PRD.md` to remove stale references to pygls 2.0 as a technology choice, pytest coverage metrics, and pygls glossary entries
- Archive or remove obsolete documentation: `HYBRID_ARCHITECTURE_PROPOSAL.md`, `DATA_EXTRACTION_GUIDE.md` (references `python tools/extract_*.py` commands), `COMPLETE-pygls-replacement.md`, `typescript-implementation-plan.md`, and `typescript-server-complete.md`
- Rewrite `vscode-extension/src/server/README.md` to describe the TypeScript server on its own terms, without references to the Python implementation or `serverImplementation` toggle

## Key Capabilities
- Full-text audit of the repository (excluding `node_modules/` and `dist/`) for Python-related keywords: `python`, `pygls`, `pythonPath`, `serverImplementation`, `requirements.txt`, `.py`, `pip`, `pytest`, `Black`, `flake8`, `mypy`
- Classification of each reference as *historical record* (preserve) or *active guidance/stale artifact* (remove or rewrite)
- Targeted cleanup of the two highest-impact files: `.github/copilot-instructions.md` (~28 Python references across multiple sections) and `Documentation/DATA_EXTRACTION_GUIDE.md` (~13 references to obsolete Python extraction tools)
- Verification that previously completed Formic cleanup tasks (t-2, t-3, t-4, t-7) are reflected in `.formic/board.json`

## Non-Goals
- Modifying `CHANGELOG.md` entries — historical release notes (e.g., v0.1.0 mentioning pygls) are legitimate records
- Altering any runtime TypeScript logic, LSP feature providers, or build configuration
- Removing Python references inside `node_modules/` (third-party dependency artifacts like `flatted/python/flatted.py` are not project-owned)
- Adding new features, refactoring architecture, or changing coding standards
- Rewriting documentation content unrelated to Python references

## Requirements
- Every file in the repository (outside `node_modules/` and `dist/`) must be scanned for the target keywords listed above
- `.github/copilot-instructions.md` must be rewritten to reflect the TypeScript-only stack, removing all Python 3.9+ requirements, Black/flake8/mypy tooling, pytest patterns, pygls LSP patterns, and the Python folder structure
- `.github/placeholder` must be updated to remove Python tool references
- `Documentation/PRD.md` must replace pygls technology references with the current TypeScript LSP stack and remove the pygls glossary entry
- Obsolete migration-era documents (`HYBRID_ARCHITECTURE_PROPOSAL.md`, `DATA_EXTRACTION_GUIDE.md`, `COMPLETE-pygls-replacement.md`, `typescript-implementation-plan.md`, `typescript-server-complete.md`) must be removed or archived
- `Documentation/IMPLEMENTATION_STATUS.md` migration reference on line 4 must be reviewed and updated if it serves as active guidance
- All Formic tasks whose described cleanup is already done (t-2, t-3, t-4, t-7) must be verified as completed in `.formic/board.json`
- After all changes, `task lint` and `task format:check` must pass with zero warnings
