# Update README and User-Facing Documentation to Reflect TypeScript Architecture

## Overview

The root `README.md`, `vscode-extension/README.md`, `CONTRIBUTING.md`, and `vscode-extension/CHANGELOG.md` still describe a Python-based architecture (pygls, pip, pytest, Black, flake8, `pythonPath` configuration) that was fully replaced by a TypeScript/Node.js implementation. This task removes all misleading Python references from user-facing documentation and replaces them with accurate descriptions of the current embedded TypeScript LSP server, Node.js prerequisites, and npm-based build/test workflow.

## Goals

- Eliminate all Python installation, configuration, and tooling instructions from user-facing documentation so that new users and contributors follow a correct Node.js-only setup path
- Accurately describe the current TypeScript project structure (`vscode-extension/src/server/`, `vscode-extension/src/test/`, `data/`) in the project structure sections of `README.md` and `CONTRIBUTING.md`
- Update the extension README (`vscode-extension/README.md`) requirements, troubleshooting, and settings sections to reflect the embedded LSP server that requires no separate installation
- Ensure all four target files pass markdown lint and contain no references to `pip`, `pytest`, `pygls`, `pythonPath`, `Black`, `flake8`, `mypy`, or Python 3.9+ as a prerequisite

## Key Capabilities

- **Accurate onboarding:** Fresh-clone setup instructions work with only Node.js 18+ installed — no Python toolchain required
- **Correct configuration reference:** Settings documentation lists only current settings (no `ck3LanguageServer.pythonPath`); developer commands reference `npm run compile`, `npm test`, `npm run lint`, `task build`, etc.
- **Current project structure:** Tree diagrams reflect the actual TypeScript layout — `vscode-extension/src/server/{core,lsp,ck3,schema,data,log,utils}/`, `vscode-extension/src/test/{unit,suite}/`, and `data/` YAML files
- **Updated acknowledgments:** Replace pygls acknowledgment with vscode-languageserver ^9.0.1 acknowledgment in root README
- **Corrected changelog entries:** `vscode-extension/CHANGELOG.md` removes forward-looking Python instructions (e.g., `pythonPath` as a current setting in the v0.1.0 configuration table, Python detection feature descriptions) while retaining non-Python historical content

## Non-Goals

- Renaming the project from "pychivalry" — the name is the project brand and stays as-is
- Rewriting `kanban-development-guideline.md` — its Python section is already marked "Historical" and is out of scope
- Updating internal developer docs (`vscode-extension/src/server/README.md`) — only user-facing documentation is in scope
- Adding new documentation content beyond what is needed to replace removed Python references (no new feature descriptions, tutorials, or architecture deep-dives)
- Removing the Apache 2.0 license or Paradox Interactive acknowledgment

## Requirements

- All four target files (`README.md`, `vscode-extension/README.md`, `CONTRIBUTING.md`, `vscode-extension/CHANGELOG.md`) must contain zero instructions to install Python, pip, or pygls
- The `ck3LanguageServer.pythonPath` setting must not appear in any settings table or example JSON in user-facing docs
- Project structure sections must match the actual directory layout verified against the filesystem
- Setup instructions must be verifiable: a fresh clone on a machine with only Node.js 18+ and npm should be able to follow them successfully
- The Python 3.9+ badge in root `README.md` must be replaced with a Node.js 18+ badge
- All edits must preserve existing non-Python content (feature lists, license info, Paradox Interactive acknowledgment, links to CK3 wiki)
- All modified markdown files must pass the pre-commit YAML/markdown validation hooks
