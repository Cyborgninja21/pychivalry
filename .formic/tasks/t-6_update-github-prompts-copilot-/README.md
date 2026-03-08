# Update GitHub prompts, copilot instructions, and AI agent configurations

## Overview

The `.github/` directory contains Copilot instructions, prompt templates, and agent definitions that still reference Python tooling, pytest patterns, and the old pygls-based architecture. These need to be updated so AI assistants and contributors receive accurate guidance.

**Files to search and update in `.github/`:**

1. `.github/prompts/Test Writing Best Practices.prompt.md` — Contains extensive Python/pytest test examples (lines 46-237+). Replace all Python test examples with TypeScript/Mocha equivalents that match the project's actual test patterns in `vscode-extension/src/test/unit/`.

2. `.github/copilot-instructions.md` — Search for and update any references to:
   - Python development workflow
   - pygls architecture
   - pytest testing
   - Python file structure
   - pip/setuptools/pyproject.toml

3. Any other `.prompt.md` or agent definition files in `.github/prompts/`, `.github/skills/`, or `.github/agents/` that reference the old Python stack.

**Also update:**
- `kanban-development-guideline.md` — Remove the 'Python (Historical — guidelines preserved for future contributions)' section (lines 77-83). This was marked historical but is no longer needed and creates confusion.
- `.claude/settings.local.json` — Remove `Bash(pytest:*)` and `Bash(python:*)` from the allowed permissions list (these grant permissions for commands that no longer exist in the project).

**Technical considerations:**
- The TypeScript test patterns to use as replacements are in `vscode-extension/src/test/unit/*.test.ts` — use Mocha `describe`/`it`/`assert` patterns
- Keep any prompt templates that are language-agnostic
- Ensure copilot instructions align with the kanban-development-guideline.md after Python section removal

**Acceptance criteria:**
- No Python/pytest code examples in `.github/prompts/`
- No Python prerequisites or workflow references in copilot instructions
- `kanban-development-guideline.md` has no Python section
- `.claude/settings.local.json` has no Python-related permissions
- All AI assistants receive TypeScript-only guidance

## Goals

- [ ] Define specific goals here

## Key Capabilities

- Describe what this task will accomplish

## Non-Goals

- What is explicitly out of scope

## Requirements

- List technical and functional requirements
