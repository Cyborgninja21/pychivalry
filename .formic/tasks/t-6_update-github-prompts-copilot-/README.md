# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations

## Overview

The `.github/` directory contains Copilot instructions, prompt templates, and architecture references that still describe the legacy Python/pygls-based LSP server. Since the project has fully migrated to TypeScript, these outdated references cause AI assistants and contributors to receive incorrect guidance — suggesting Python patterns, pytest workflows, and pygls APIs that no longer exist in the codebase.

## Goals

- Eliminate all Python/pytest/pygls code examples from `.github/prompts/` prompt templates, replacing them with TypeScript/Mocha equivalents drawn from the project's actual test suite in `vscode-extension/src/test/unit/`
- Update `.github/copilot-instructions.md` to remove the Python 3.9+ prerequisite (line 124) and the entire "Python Requirements" section (lines 131–170), making TypeScript the sole documented language
- Update all affected prompt files: `LSP Feature Implementation`, `Adding New CK3 Language Features`, `documentation_standard`, `Version Update Assistant`, `Branch Merge Assistant`, `gh pr review`, `gh run view`, `architecture_and_flow`, and `README.md` index
- Ensure all AI-facing documentation is consistent with `kanban-development-guideline.md` and the current TypeScript architecture

## Key Capabilities

- `.github/copilot-instructions.md` accurately describes TypeScript as the sole language for both the VS Code client and the LSP server
- Prompt templates use TypeScript examples and reference Mocha/assert patterns instead of pytest/pygls — including `describe`/`it` blocks, `assert.strictEqual`, helper factories like `makeConfig()` and `mockConnection()`
- `.github/prompts/README.md` index reflects the updated content of each prompt file with no mentions of "Python files" or "pytest tests"
- Contributors and AI tools receive guidance aligned with the current `vscode-languageserver` ^9.0.1 / webpack / Mocha architecture

## Non-Goals

- Rewriting prompt templates from scratch — preserve language-agnostic structure and intent, only replace Python-specific content
- Modifying any runtime source code, test files, or build configuration
- Updating files outside `.github/` — the `kanban-development-guideline.md` Python section and `.claude/settings.local.json` Python permissions have already been cleaned up in prior work
- Adding new prompt templates, skills, or agent definitions beyond what currently exists

## Requirements

- All Python code blocks (` ```python `) in `.github/prompts/` must be replaced with TypeScript equivalents using patterns from `vscode-extension/src/test/unit/` (Mocha `describe`/`it`, `assert.strictEqual`, helper factories, inline mocks)
- The "Python Requirements" section in `.github/copilot-instructions.md` (lines 131–170) and the Python 3.9+ prerequisite (line 124) must be removed; the "TypeScript Requirements" section must be promoted to cover the full stack
- References to `pygls`, `lsprotocol`, `pytest`, `pytest-asyncio`, `hypothesis`, `Black`, `flake8`, `mypy`, `pyproject.toml`, `pip`, `setuptools`, and `python -m build` must be replaced with their TypeScript equivalents (`vscode-languageserver`, `mocha`, `eslint`, `prettier`, `webpack`, `npm run compile`)
- `.github/prompts/README.md` descriptions must be updated to remove mentions of "Python files" or "pytest tests"
- No file in `.github/` should contain `pygls`, `pytest`, `pyproject.toml`, or `from pygls` as current project references after completion
