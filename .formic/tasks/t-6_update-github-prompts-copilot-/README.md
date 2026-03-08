# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations

## Overview

The project's `.github/` directory, AI assistant configurations, and development guidelines still contain extensive Python/pytest references from the original pygls-based architecture. Since the project has fully migrated to TypeScript with Mocha-based testing, these outdated references actively mislead AI assistants and contributors. This task removes all Python-era guidance and replaces it with accurate TypeScript/Mocha patterns that reflect the current codebase.

## Goals

- Eliminate all Python/pytest code examples and workflow references from `.github/prompts/`, `.github/skills/`, and `.github/copilot-instructions.md` so AI assistants generate TypeScript-only guidance
- Replace the `pytest-testing-patterns` skill and Python test examples in `Test Writing Best Practices.prompt.md` with TypeScript/Mocha equivalents derived from the project's 25 existing unit tests in `vscode-extension/src/test/unit/`
- Remove the historical Python section from `kanban-development-guideline.md` and Python-related permissions from `.claude/settings.local.json`
- Ensure all AI-facing documentation is internally consistent and aligned with the TypeScript-only development workflow

## Key Capabilities

- `.github/skills/pytest-testing-patterns` replaced with a comprehensive TypeScript/Mocha testing patterns guide covering `describe`/`it`/`assert`, `beforeEach` setup, and the project's actual test conventions
- `.github/copilot-instructions.md` provides TypeScript-only prerequisites, build commands, and folder structure with no Python sections
- `.github/skills/ck3-validation-debugging` and `.github/skills/lsp-feature-debugging` reference TypeScript debugging and Mocha test patterns instead of Python/pytest examples
- `.github/prompts/Test Writing Best Practices.prompt.md` contains TypeScript/Mocha test examples matching project conventions
- `.github/prompts/Debugging LSP Server Issues.prompt.md` updated to reference TypeScript-based server debugging

## Non-Goals

- Rewriting or restructuring the CK3-specific agent definitions in `.github/agents/` (these are game-content-focused and do not reference Python)
- Modifying any language-agnostic prompt templates (e.g., `gh` CLI prompts, `Branch Creation Assistant`, `Commit Message Assistant`)
- Changing actual test code or test infrastructure in `vscode-extension/src/test/`
- Adding new prompt templates or skills beyond what currently exists

## Requirements

- All `.prompt.md` files in `.github/prompts/` must contain zero Python/pytest code blocks or Python-specific workflow references
- All skill files in `.github/skills/` must use TypeScript/Mocha examples exclusively; the `pytest-testing-patterns` skill must be replaced with `mocha-testing-patterns` (or equivalent)
- `.github/copilot-instructions.md` must not reference Python 3.9+, pytest, Black, flake8, mypy, pygls, pip, setuptools, or pyproject.toml
- `kanban-development-guideline.md` must have the "Python (Historical)" section (lines 77-83) removed entirely
- `.claude/settings.local.json` must have `Bash(pytest:*)` and `Bash(python:*)` entries removed from the allowed permissions list
- TypeScript test examples used as replacements must follow the Mocha `describe`/`it`/`assert.strictEqual`/`assert.deepStrictEqual` patterns found in existing unit tests
