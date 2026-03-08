# Codebase Review: Remove Legacy Python Remnants

## Overview
The project originally used a Python-based language server built on pygls 2.0.0 and has since been fully rewritten in TypeScript. While the runtime code and tooling have been successfully migrated, documentation files and the server README still contain outdated Python references, stale migration notes, and instructions for a dual-implementation mode that no longer exists. This task audits the entire codebase and removes or rewrites those remnants so the project presents as a clean, single-stack TypeScript extension.

## Goals
- Remove all references to Python, pygls, and the dual-server (`serverImplementation`) setting from active documentation and source READMEs
- Rewrite `vscode-extension/src/server/README.md` to describe the TypeScript server on its own terms, without comparative references to the old Python implementation
- Archive or remove `Documentation/COMPLETE-pygls-replacement.md` and any other migration-era documents that serve no ongoing purpose
- Close out stale Formic cleanup tasks (t-2, t-3, t-4, t-7) whose work has already been completed
- Ensure no stray Python configuration (e.g., `pythonPath`, `serverImplementation`) exists anywhere in source, tests, or settings

## Key Capabilities
- Full-text audit of the repository for Python-related keywords (`pygls`, `pythonPath`, `serverImplementation`, `requirements.txt`, `.py`, `pip`, `pytest`)
- Identification of references that are historical records (CHANGELOG.md) vs. active guidance (READMEs, settings, code comments) and treatment of each appropriately
- Rewriting of the server README (`vscode-extension/src/server/README.md`) to remove the "Running" section's Python toggle and the "Performance" section's Python comparison
- Cleanup of Documentation/ migration artifacts that are no longer needed for day-to-day development

## Non-Goals
- Modifying CHANGELOG.md entries; historical release notes (e.g., v0.1.0 mentioning pygls) are legitimate records and should be preserved
- Altering any runtime TypeScript logic, LSP feature providers, or build configuration
- Removing Python references inside `node_modules/` (third-party dependency artifacts are not project-owned)
- Adding new features, refactoring architecture, or changing coding standards

## Requirements
- Every file in the repository (outside `node_modules/` and `dist/`) must be scanned for the keywords: `python`, `pygls`, `pythonPath`, `serverImplementation`, `.py`, `pip`, `pytest`
- Each match must be categorized as *historical record* (keep) or *active guidance/stale artifact* (remove or rewrite)
- `vscode-extension/src/server/README.md` must be updated so it no longer references a Python server option or performance comparison
- `Documentation/COMPLETE-pygls-replacement.md` must be removed or moved to an archive, as the migration is long complete
- All Formic tasks whose described cleanup is already done (t-2, t-3, t-4, t-7) must be marked completed in `.formic/board.json`
- After changes, `task lint` and `task format:check` must pass with zero warnings
