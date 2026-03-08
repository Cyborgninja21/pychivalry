# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations - Implementation Plan

## Status
**PENDING** - Plan created, implementation to begin.

## Context
The project's `.github/` directory, AI assistant configurations, and development guidelines still contain extensive Python/pytest references from the original pygls-based architecture. Since the project has fully migrated to TypeScript with Mocha-based testing, these outdated references actively mislead AI assistants and contributors. This task removes all Python-era guidance and replaces it with accurate TypeScript/Mocha patterns.

## Implementation Overview

### Phase 1: Core AI Configuration Files
Update the foundational AI configuration files that have the broadest impact on AI assistant behavior.

- **`.github/copilot-instructions.md`** — Remove Python 3.9+, pytest, Black, flake8, mypy, pygls references from Development Environment and Testing sections. Replace with TypeScript/Mocha/ESLint/Prettier equivalents. Update folder structure to remove `tests/` Python directory references.
- **`kanban-development-guideline.md`** — Remove the "Python (Historical)" section (lines 77–83).
- **`.claude/settings.local.json`** — Remove `Bash(pytest:*)`, `Bash(python:*)`, and the hardcoded PowerShell `test_paradox_checks.py` permission entries.

### Phase 2: Skills Files
Replace or update all skills that contain Python/pytest patterns.

- **`.github/skills/pytest-testing-patterns`** — Delete and replace with `mocha-testing-patterns` containing TypeScript/Mocha `describe`/`it`/`assert` patterns derived from existing unit tests in `vscode-extension/src/test/unit/`.
- **`.github/skills/lsp-feature-debugging`** — Replace pytest reproducers and `@pytest.mark.asyncio` with Mocha test patterns and TypeScript debugging steps.
- **`.github/skills/ck3-validation-debugging`** — Replace `def test_specific_validation_issue()` pytest patterns with TypeScript/Mocha equivalents.
- **`.github/skills/lsp-performance-optimization`** — Replace `cProfile`/`memory_profiler`/`pytest-benchmark` references with Node.js profiling and Mocha-based performance patterns.
- **`.github/skills/tool-list.md`** — Remove Python environment tool entries (`configure_python_environment`, `install_python_packages`, `mcp_pylance_mcp_s_pylanceRunCodeSnippet`).

### Phase 3: Prompt Templates
Update all `.prompt.md` files that contain Python/pytest code examples.

- **`Test Writing Best Practices.prompt.md`** — Full rewrite from pytest to TypeScript/Mocha with `describe`/`it`/`assert.strictEqual`/`assert.deepStrictEqual` patterns.
- **`Debugging LSP Server Issues.prompt.md`** — Replace `pytest tests/ -v` and `python -m pychivalry.server` with TypeScript equivalents.
- **`Adding New CK3 Language Features.prompt.md`** — Replace `def test_*()`, `@pytest.mark.integration`, `@pytest.mark.asyncio` with Mocha patterns.
- **`LSP Feature Implementation.prompt.md`** — Replace pygls handler patterns and pytest test structure with TypeScript LSP provider and Mocha examples.
- **`Branch Merge Assistant.prompt.md`** — Replace `pytest tests/ -v`, `flake8 pychivalry/`, `mypy pychivalry/` final checks with `npm run lint`, `npm run format-check`, `npm test`.
- **`Version Update Assistant.prompt.md`** — Remove `pyproject.toml`, `pychivalry/__init__.py`, `python -m build`, `pip install` references; keep only `vscode-extension/package.json` and VSIX packaging.
- **`documentation_standard.md`** — Replace Python docstring templates with TSDoc/JSDoc conventions.
- **`architecture_and_flow.md`** — Update testing strategy section to reference Mocha instead of pytest.

### Phase 4: Verification
Validate all changes are consistent and no Python references remain.

- Grep all modified files for residual Python/pytest/pygls/flake8/mypy/Black references.
- Verify TypeScript/Mocha examples use patterns consistent with existing unit tests.

## Key Milestones
- Core configuration files updated (copilot-instructions, kanban guideline, claude settings)
- All 5 skills files updated or replaced (pytest-testing-patterns → mocha-testing-patterns)
- All 8 prompt templates updated
- Zero Python/pytest references confirmed across all modified files

## Success Criteria
- `grep -ri "pytest\|pygls\|flake8\|mypy\|Black\|python 3\.9" .github/` returns zero matches
- `kanban-development-guideline.md` contains no "Python (Historical)" section
- `.claude/settings.local.json` contains no `pytest` or `python` permission entries
- All TypeScript test examples in prompts/skills follow the `describe`/`it`/`assert` pattern from existing unit tests
