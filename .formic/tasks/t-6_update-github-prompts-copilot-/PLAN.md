# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations — Implementation Plan

## Status
**IN PROGRESS** — Subtasks 1–2 completed (pattern gathering, mocha-testing-patterns skill created). Plan refreshed with comprehensive audit findings.

## Context
The `.github/` directory and AI assistant configurations still contain extensive Python/pygls references from the original pygls-based architecture. Since the project has fully migrated to TypeScript with Mocha-based testing, these outdated references actively mislead AI assistants and contributors. This task removes all Python-era artifacts and replaces them with accurate TypeScript/Mocha guidance matching the current stack.

## Implementation Overview

### Phase 1: Core Configuration Files
Update the foundational configuration files that set the baseline for all AI assistance.

- **`.github/copilot-instructions.md`** — Major update: remove the Python Requirements section (Python 3.9+, type hints, dataclasses, PEP 8, Black, flake8, mypy, pytest, pytest-asyncio, hypothesis, pygls, lsprotocol), remove Python folder structure references (`pyproject.toml`, `pychivalry/` package paths), ensure all guidance is TypeScript/Node.js only.
- **`kanban-development-guideline.md`** — Audit for any vestigial Python section (README references lines 77–83); current reading shows pure TypeScript content, so this may already be clean — verify and remove if needed.
- **`.claude/settings.local.json`** — Audit for `Bash(pytest:*)` and `Bash(python:*)` permission entries; current reading shows no Python permissions present — verify and remove if found; validate JSON.
- **`.github/placeholder`** — Remove Python 3.9+ references, pytest patterns, pygls documentation references, and pip-based pre-commit setup instructions.

### Phase 2: Prompt Templates with Python Code Examples
Replace Python code examples in prompt files with TypeScript equivalents drawn from the project's actual test suite (`parser.test.ts`, `fuzzy-match.test.ts`, `script-values.test.ts`) and LSP implementation.

**Heavy rewrites (extensive Python code blocks):**
- **`LSP Feature Implementation.prompt.md`** — Replace pygls `@server.feature()` decorator patterns, `from pygls.server import LanguageServer` examples, and pytest fixture/async test patterns with TypeScript LSP provider implementations and Mocha tests.
- **`Adding New CK3 Language Features.prompt.md`** — Replace Python language definitions (`pychivalry/ck3_language.py`), completion/hover providers, validation logic (`pychivalry/diagnostics.py`), and `@pytest.mark.integration`/`@pytest.mark.asyncio` test examples with TypeScript equivalents.
- **`architecture_and_flow.md`** — Replace Python module paths (`pychivalry/`, `server.py`, `parser.py`), pygls architecture references, and `pygls.readthedocs.io` links with TypeScript server subsystem paths (`server/core/`, `server/lsp/`, etc.).

**Moderate updates (command references and small code blocks):**
- **`Version Update Assistant.prompt.md`** — Remove `pyproject.toml` update procedures, `python -m build`, `pip install`, and `python -c` version checks; replace with `package.json` version update workflow.
- **`documentation_standard.md`** — Audit for Python docstring/typing references (Google/NumPy style, mypy compatibility); update to TSDoc conventions if found.
- **`Branch Merge Assistant.prompt.md`** — Replace `pytest tests/ -v`, `flake8 pychivalry/`, `mypy pychivalry/` with `npm run test:unit`, `npm run lint`, `npm run format-check`.
- **`gh pr review.prompt.md`** — Replace `pytest tests/` commands with `npm test` / `task test:unit`.

**Verification only (likely already TypeScript):**
- **`Test Writing Best Practices.prompt.md`** — Verify already TypeScript/Mocha (initial audit found no Python); update if any vestiges remain.

### Phase 3: Skills with Python Code Examples
Replace Python code examples in skill files with TypeScript/Node.js equivalents.

- **`ck3-validation-debugging`** — Replace all 7+ Python validator examples (`pychivalry.parser.CK3Parser`, `pychivalry.scopes.ScopeValidator`, `pychivalry.traits.TraitValidator`, `pychivalry.events.EventValidator`, `pychivalry.lists.ListValidator`, `pychivalry.script_values.ScriptValueValidator`, `pychivalry.localization.LocalizationValidator`) with TypeScript test patterns using actual project imports.
- **`lsp-feature-debugging`** — Replace `pychivalry.parser.CK3Parser` usage, pytest `@pytest.mark.asyncio` test examples, and `cProfile`/`pstats` profiling with TypeScript debugging patterns.
- **`lsp-performance-optimization`** — Replace Python profiling tools (`cProfile`, `memory_profiler`, `line_profiler`, `psutil`), async/await patterns (`asyncio`), `functools.wraps` decorator examples, and `@pytest.mark.performance`/`pytest-benchmark` with Node.js profiling approaches and Mocha performance tests.
- **`vscode-extension-workflow`** — Remove `python -m pychivalry --version` command reference.
- **`tool-list.md`** — Remove the Python Environment Management section (~4 tools) and Pylance/Python Analysis (MCP) section (~11 tools).

### Phase 4: Audit and Verification
Ensure no Python references remain anywhere in AI-facing configuration.

- Audit all 13 agent definition files under `.github/agents/` for Python references.
- Update `.github/prompts/README.md` if it describes any prompt as pytest-related.
- Grep the entire `.github/` directory, `kanban-development-guideline.md`, and `.claude/` for any remaining references to: `pytest`, `pygls`, `pyproject.toml`, `pip install`, `Python 3.9+`, `pychivalry` (as Python package import), `flake8`, `mypy`, `Black` (Python formatter), `hypothesis`.
- Verify `kanban-development-guideline.md` and `.github/copilot-instructions.md` are consistent after edits.
- Validate `.claude/settings.local.json` remains valid JSON.

## Key Milestones
- Mocha testing patterns skill created and pytest skill removed ✓
- Core configuration files updated — AI assistants receive TypeScript-only baseline guidance
- All prompt templates provide TypeScript examples for LSP features, testing, and workflows
- All skill files demonstrate TypeScript/Node.js patterns
- Full grep verification passes with zero Python references in target files

## Success Criteria
- `grep -ri "pytest\|pygls\|pyproject\.toml\|pip install\|Python 3\.9" .github/ kanban-development-guideline.md` returns zero matches
- `.claude/settings.local.json` is valid JSON with no `pytest:*` or `python:*` permission entries
- All TypeScript replacement examples use actual project patterns: Mocha `describe`/`it`, Node.js `assert`, `beforeEach`, helper factory functions, inline mock objects
- `kanban-development-guideline.md` content is consistent with `.github/copilot-instructions.md`
- No file in the repository references `pytest`, `pygls`, `pyproject.toml`, `pip install`, or `Python 3.9+` as current project requirements
