# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations

## Overview

The `.github/` directory, `kanban-development-guideline.md`, and `.claude/settings.local.json` still contain references to the legacy Python/pygls-based architecture, including pytest test examples, Python workflow instructions, and Python-specific tool permissions. These outdated references mislead AI assistants and contributors into generating Python code or following obsolete patterns. This task removes all Python-era artifacts and replaces them with accurate TypeScript/Mocha guidance that reflects the current project stack.

## Goals

- Eliminate all Python/pytest code examples from `.github/prompts/`, replacing them with TypeScript/Mocha equivalents drawn from the project's actual test suite in `vscode-extension/src/test/unit/`
- Update `.github/copilot-instructions.md` to remove Python workflow, pygls architecture, pytest, and pip/setuptools/pyproject.toml references so AI assistants receive TypeScript-only guidance
- Remove the historical Python section from `kanban-development-guideline.md` (lines 77-83) to prevent confusion about supported languages
- Remove `Bash(pytest:*)` and `Bash(python:*)` from `.claude/settings.local.json` since those commands no longer exist in the project
- Audit all `.prompt.md` files, agent definitions, and skill files under `.github/` for any remaining Python stack references

## Key Capabilities

- `.github/prompts/Test Writing Best Practices.prompt.md` provides TypeScript/Mocha test examples using `describe`/`it`/`assert` patterns with helper builders, inline mocks, and loop-driven parametric tests matching the project's conventions
- `.github/copilot-instructions.md` directs AI assistants to the TypeScript-only stack (VS Code API, vscode-languageserver, webpack, Mocha) with no mention of Python tooling
- All 26 prompt templates, 13 agent definitions, and 7 skill files under `.github/` reference only the current TypeScript/Node.js architecture
- `kanban-development-guideline.md` contains only TypeScript coding standards, with no vestigial Python section

## Non-Goals

- Rewriting language-agnostic prompt templates that don't reference any specific tech stack
- Modifying CK3-specific game logic guidance in agent definitions (e.g., event builders, scope timing) that is independent of the implementation language
- Adding new prompt templates, skills, or agent definitions beyond what already exists
- Changing the project's build system, test infrastructure, or CI pipeline

## Requirements

- Replacement TypeScript test examples must use the project's actual patterns: Mocha `describe`/`it` with Node.js `assert`, `beforeEach` for setup, Arrange-Act-Assert structure, helper factory functions, and inline mock objects (no mocking framework)
- All changes must pass `task lint` and `task format:check` for any modified TypeScript files
- `.claude/settings.local.json` must remain valid JSON after permission entries are removed
- `kanban-development-guideline.md` must remain consistent with `.github/copilot-instructions.md` after the Python section is removed
- No file in the repository should reference `pytest`, `pygls`, `pyproject.toml`, `pip install`, or `Python 3.9+` as current project requirements
