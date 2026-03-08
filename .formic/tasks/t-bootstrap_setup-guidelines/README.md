# Setup AI Development Guidelines

## Overview
This task audits the pychivalry codebase and produces a `kanban-development-guideline.md` document that captures the project's tech stack, architectural patterns, coding standards, testing strategy, and forbidden practices. The guideline serves as a single-source-of-truth reference for AI-assisted development, ensuring generated code aligns with established project conventions.

## Goals
- Produce a `kanban-development-guideline.md` at the workspace root that accurately reflects the current state of the codebase
- Document the dual-language stack (Python 3.9+ LSP server with pygls; TypeScript VS Code extension) with specific dependency versions
- Codify existing coding standards from `.pre-commit-config.yaml`, `.github/copilot-instructions.md`, and `CONTRIBUTING.md` into actionable rules
- Capture the project's testing strategy across both Python (pytest) and TypeScript (Mocha/VS Code test runner) components
- Define forbidden practices derived from linting rules, pre-commit hooks, and observed patterns

## Key Capabilities
- Enumerates the complete tech stack: Python (pygls, lsprotocol, PyYAML), TypeScript (vscode API, vscode-languageclient), build tools (webpack, Black, flake8, ESLint, Prettier), and task runners (Taskfile, pre-commit)
- Maps the architectural layout including `pychivalry/` (core, lsp, ck3, schema, log, data subsystems) and `vscode-extension/` (client extension with TextMate grammars and snippets)
- Documents the development workflow: branching strategy, pre-commit hooks, CI pipeline (GitHub Actions on ubuntu/windows/macos with Node 18), and build/test commands for both Python and TypeScript
- Extracts naming conventions (PEP 8, Black line-length 100, camelCase TS, strict TypeScript mode) and error handling patterns from existing configuration files

## Non-Goals
- Modifying any source code, configuration files, or project structure
- Creating or updating CI/CD pipelines, pre-commit hooks, or linting configurations
- Writing or running tests to validate existing functionality
- Documenting CK3 game-specific modding syntax or game logic

## Requirements
- The guideline must reference only files and patterns that exist within `/home/cwallace/git/pychivalry`
- All dependency versions cited must come from actual `package.json`, `pyproject.toml`, or configuration files in the workspace
- The document must follow the template structure specified in the task description (sections 1-7: Project Overview, Architectural Patterns, Coding Standards, Preferred Libraries & Tools, Development Workflow, Build & Test Commands, Forbidden Practices)
- The output file must be saved as `kanban-development-guideline.md` in the workspace root (`/home/cwallace/git/pychivalry/`)
