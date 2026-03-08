# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations - Implementation Plan

## Status
**IN PROGRESS** - Subtasks 1-2 completed (pattern gathering, mocha-testing-patterns skill created). Plan refreshed with comprehensive audit findings.

## Context
The `.github/` directory contains Copilot instructions, prompt templates, skills, and architecture references that still describe the legacy Python/pygls-based LSP server. Since the project has fully migrated to TypeScript, these outdated references cause AI assistants and contributors to receive incorrect guidance — suggesting Python patterns, pytest workflows, and pygls APIs that no longer exist in the codebase. This task removes all Python-era artifacts and replaces them with accurate TypeScript/Mocha guidance matching the current stack.

## Implementation Overview

### Phase 1: Core Configuration Files
Update the foundational configuration files that set the baseline for all AI assistance.

- **`.github/copilot-instructions.md`** — Remove the Python 3.9+ prerequisite (line 124) and the entire "Python Requirements" section (lines 131-170) covering type hints, dataclasses, PEP 8, Black, flake8, mypy, pytest, pytest-asyncio, hypothesis, pygls, lsprotocol. Remove Python folder structure references (`pyproject.toml`, `pychivalry/` package paths). Ensure TypeScript is the sole documented language.
- **`kanban-development-guideline.md`** — Audit for vestigial Python content; current reading shows pure TypeScript — verify and confirm clean.
- **`.claude/settings.local.json`** — Audit for `Bash(pytest:*)` and `Bash(python:*)` permission entries; remove if found; validate JSON.
- **`.github/placeholder`** — Remove Python 3.9+ references, pytest patterns, pygls documentation references, and pip-based setup instructions.

### Phase 2: Prompt Templates with Python Code Examples
Replace Python code examples with TypeScript equivalents drawn from actual project tests (`parser.test.ts`, `fuzzy-match.test.ts`, `script-values.test.ts`) and LSP providers.

**Heavy rewrites (extensive Python code blocks):**
- **`LSP Feature Implementation.prompt.md`** — Replace `from pygls.server import LanguageServer` imports, `@server.feature()` decorator patterns, and pytest fixture/async test patterns with TypeScript LSP provider implementations and Mocha tests.
- **`Adding New CK3 Language Features.prompt.md`** — Replace Python language definitions, completion/hover providers, validation logic, and `@pytest.mark.integration`/`@pytest.mark.asyncio` test examples with TypeScript equivalents.
- **`architecture_and_flow.md`** — Replace Python module paths (`pychivalry/`, `server.py`, `parser.py`), pygls architecture references, and `pygls.readthedocs.io` link with TypeScript server subsystem paths and current data flow.

**Moderate updates (command references and small code blocks):**
- **`Version Update Assistant.prompt.md`** — Remove `pyproject.toml` update procedures, `python -m build`, `pip install`, and `python -c` version checks; replace with `package.json` version workflow.
- **`documentation_standard.md`** — Replace `from pygls.server import LanguageServer` example and any Python docstring/typing references with TSDoc conventions.
- **`Branch Merge Assistant.prompt.md`** — Replace `pytest tests/ -v`, `flake8 pychivalry/`, `mypy pychivalry/` with `npm run test:unit`, `npm run lint`, `npm run format-check`.
- **`gh pr review.prompt.md`** — Replace `pytest tests/` commands with `npm test` / `task test:unit`.
- **`gh run view.prompt.md`** — Update any Python-specific test job logging references with TypeScript/Mocha equivalents.

**Verification only:**
- **`Test Writing Best Practices.prompt.md`** — Verify already TypeScript/Mocha; update if vestiges remain.

### Phase 3: Skills with Python Code Examples
Replace Python code examples in skill files with TypeScript/Node.js equivalents.

- **`ck3-validation-debugging`** — Replace all 7+ Python validator examples with TypeScript test patterns using actual project imports.
- **`lsp-feature-debugging`** — Replace `pychivalry.parser.CK3Parser` usage, pytest tests, and `cProfile`/`pstats` profiling with TypeScript debugging patterns.
- **`lsp-performance-optimization`** — Replace Python profiling tools (`cProfile`, `memory_profiler`, `line_profiler`, `psutil`), `asyncio` patterns, and `pytest-benchmark` with Node.js profiling and Mocha tests.
- **`vscode-extension-workflow`** — Remove `python -m pychivalry --version` command reference.
- **`tool-list.md`** — Remove the Python Environment Management section and Pylance/Python Analysis (MCP) section.

### Phase 4: Index, Agents, and Verification
Ensure no Python references remain in AI-facing configuration.

- Update `.github/prompts/README.md` descriptions to remove mentions of "Python files" or "pytest tests".
- Audit all 13 agent definition files under `.github/agents/` for Python references.
- Run final verification grep across `.github/`, `kanban-development-guideline.md`, and `.claude/` to confirm zero remaining references to `pygls`, `pytest`, `pyproject.toml`, `from pygls`, `pip install`, `Python 3.9+`, `flake8`, `mypy`, `Black` (Python formatter), `hypothesis`.
- Verify consistency between `kanban-development-guideline.md` and `.github/copilot-instructions.md`.

## Key Milestones
- Mocha testing patterns skill created and pytest skill removed (completed)
- Core configuration files updated — AI assistants receive TypeScript-only baseline guidance
- All prompt templates provide TypeScript examples for LSP features, testing, and workflows
- All skill files demonstrate TypeScript/Node.js patterns
- Full grep verification passes with zero Python references in target files

## Success Criteria
- No file in `.github/` contains `pygls`, `pytest`, `pyproject.toml`, or `from pygls` as current project references
- All Python code blocks in `.github/prompts/` are replaced with TypeScript equivalents
- `.github/copilot-instructions.md` describes TypeScript as the sole language
- `.github/prompts/README.md` descriptions are consistent with updated prompt content
- All AI-facing documentation aligns with `kanban-development-guideline.md` and the TypeScript/Mocha/webpack architecture
- `.claude/settings.local.json` is valid JSON with no Python permission entries
