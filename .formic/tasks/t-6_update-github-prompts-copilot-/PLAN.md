# Update GitHub Prompts, Copilot Instructions, and AI Agent Configurations - Implementation Plan

## Status
**PENDING** - Plan created, implementation to begin.

## Context
The project's `.github/` directory and AI assistant configurations still contain extensive Python/pytest references from the original pygls-based architecture. Since the project has fully migrated to TypeScript with Mocha-based testing, these outdated references actively mislead AI assistants and contributors. This task removes all Python-era guidance and replaces it with accurate TypeScript/Mocha patterns.

## Implementation Overview

### Phase 1: Gather Mocha/TypeScript test patterns from existing unit tests
Read existing unit tests (`parser.test.ts`, `log-diagnostics.test.ts`, `style-checks.test.ts`) to extract the project's actual `describe`/`it`/`assert` conventions, `beforeEach` setup patterns, and CLI invocation commands. These patterns will serve as the basis for all replacement examples.

### Phase 2: Replace the pytest testing skill with a Mocha equivalent
Delete `.github/skills/pytest-testing-patterns` (223 lines, entirely pytest-focused) and create `.github/skills/mocha-testing-patterns` with TypeScript/Mocha testing patterns covering: basic test structure, async tests, beforeEach setup, parametric patterns (loop-driven `it` blocks), mocking/stubbing, performance benchmarks, and Mocha CLI commands.

### Phase 3: Update prompt templates that contain Python/pytest references
Nine `.prompt.md` files contain Python code blocks or pytest workflow references:
- `Test Writing Best Practices.prompt.md` — full rewrite from pytest to Mocha/TypeScript
- `Debugging LSP Server Issues.prompt.md` — replace pytest examples with Mocha, remove Python server references
- `LSP Feature Implementation.prompt.md` — replace pytest fixtures/marks with Mocha equivalents
- `Adding New CK3 Language Features.prompt.md` — replace Python snippets and pytest test examples with TypeScript/Mocha
- `Branch Merge Assistant.prompt.md` — replace `pytest tests/ -v`, `flake8`, `mypy` with npm commands
- `gh pr review.prompt.md` — replace `pytest tests/` with `npm run test:unit`
- `Version Update Assistant.prompt.md` — remove `pyproject.toml`, `python -m build`, `twine` references
- `architecture_and_flow.md` — update Python module names to TypeScript equivalents
- `documentation_standard.md` — replace Python docstring standards with TSDoc/TypeScript conventions

### Phase 4: Update skills with Python/pytest debugging references
Three additional skill files reference Python/pytest patterns in specific steps:
- `lsp-feature-debugging` — replace Step 8 (pytest) with Mocha test reproduction
- `lsp-performance-optimization` — replace `@pytest.mark.performance`, `cProfile`, `memory_profiler` with TypeScript profiling approaches
- `ck3-validation-debugging` — replace pytest-style test function with Mocha equivalent

### Phase 5: Update top-level configuration files
- `.github/copilot-instructions.md` — remove Python 3.9+, pytest, Black, flake8, mypy, pygls, hypothesis sections; remove Python folder structure; ensure TypeScript-only content throughout
- `kanban-development-guideline.md` — remove the "Python (Historical)" section (lines 77-83)
- `.claude/settings.local.json` — remove `Bash(pytest:*)`, `Bash(python:*)`, and the obsolete PowerShell `test_paradox_checks.py` entry

### Phase 6: Verification
- Grep all modified files for residual Python/pytest/pygls/flake8/mypy/Black references
- Confirm zero Python/pytest code blocks remain in any `.prompt.md` file
- Confirm `.claude/settings.local.json` has no pytest/python entries

## Key Milestones
- Mocha testing patterns skill created and pytest skill removed
- All prompt templates updated to TypeScript/Mocha exclusively
- All skills updated to TypeScript debugging patterns
- Configuration files cleaned of Python references
- Full grep verification passes with zero Python/pytest hits in target files

## Success Criteria
- `grep -ri "pytest\|pyproject\|pygls\|flake8\|mypy\|black.*line-length\|python 3.9" .github/` returns zero results
- `grep -ri "pytest\|python" .claude/settings.local.json` returns zero results (excluding unrelated words)
- `grep -ri "Python (Historical" kanban-development-guideline.md` returns zero results
- The new `mocha-testing-patterns` skill covers: basic test structure, async tests, fixtures/setup, parametric patterns, mocking, performance benchmarks, and CLI commands
- All TypeScript test examples follow the `describe`/`it`/`assert.strictEqual`/`assert.deepStrictEqual` patterns from existing unit tests
