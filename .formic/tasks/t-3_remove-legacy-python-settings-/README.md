# Remove legacy Python settings from VS Code workspace configuration

## Overview

The `.vscode/settings.json` and `pychivalry.code-workspace` files contain obsolete Python development settings that are no longer relevant now that the project is TypeScript-only.

**Files to modify:**

1. `.vscode/settings.json` — Remove these Python-era settings:
   - Lines 2-12: All `python.*` settings (`python.defaultInterpreterPath`, `python.analysis.typeCheckingMode`, `python.linting.enabled`, `python.linting.flake8Enabled`, `python.linting.mypyEnabled`, `python.formatting.provider`, `python.testing.pytestEnabled`, `python.testing.pytestArgs`)
   - Line 16: `ck3LanguageServer.pythonPath` setting
   - Lines 31-33: Python artifact exclusions from `files.exclude` (`**/__pycache__`, `**/*.pyc`, `**/.pytest_cache`)
   - Lines 41-42: Python artifact exclusions from `search.exclude` (`**/.pytest_cache`, `**/__pycache__`)
   - Lines 44-45: `python-envs.defaultPackageManager` and `python-envs.pythonProjects`

   Keep all legitimate settings: `ck3LanguageServer.enable`, `ck3LanguageServer.logLevel`, `ck3LanguageServer.trace.server`, `ck3LanguageServer.logWatcher.*`, `editor.*`, and Node.js-related exclusions (`**/node_modules`, `**/dist`).

2. `pychivalry.code-workspace` — Remove the `python-envs.defaultPackageManager` setting from the `settings` block. Keep the `folders` array intact.

**Technical considerations:**
- Ensure JSON remains valid after edits
- Do not remove `// CK3 language server settings` comment or valid CK3 settings
- Preserve the `ck3LanguageServer.logWatcher.*` settings block

**Acceptance criteria:**
- No `python.*` settings remain in `.vscode/settings.json`
- No `pythonPath` in `.vscode/settings.json`
- No `__pycache__`, `*.pyc`, or `.pytest_cache` exclusions remain
- No `python-envs` settings in workspace config
- Both JSON files are valid
- Extension still works correctly when launched via F5

## Goals

- [ ] Define specific goals here

## Key Capabilities

- Describe what this task will accomplish

## Non-Goals

- What is explicitly out of scope

## Requirements

- List technical and functional requirements
