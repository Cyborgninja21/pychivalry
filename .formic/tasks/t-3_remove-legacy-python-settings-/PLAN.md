# Remove Legacy Python Settings — Implementation Plan

## Status
**PENDING** — Plan created, implementation to begin.

## Context
The project has fully transitioned from Python to TypeScript, but `.vscode/settings.json` and `pychivalry.code-workspace` still carry obsolete Python development settings. This task removes those inert entries to keep workspace configuration accurate for the current TypeScript-only stack.

## Implementation Overview

### Phase 1: Clean `.vscode/settings.json`
Remove all legacy Python content from the VS Code settings file:
- Delete the `// Python settings` comment block and all `python.*` keys (lines 2–13)
- Delete the `ck3LanguageServer.pythonPath` key (line 16)
- Remove Python artifact patterns (`__pycache__`, `*.pyc`, `.pytest_cache`) from `files.exclude` and `search.exclude`, keeping only `**/node_modules` and `**/dist`
- Delete the `python-envs.*` keys (lines 44–45)
- Ensure remaining structure is valid JSON with correct trailing commas

### Phase 2: Clean `pychivalry.code-workspace`
Remove the `python-envs.defaultPackageManager` key from the `settings` block. If the `settings` object becomes empty, remove it entirely (the `folders` array must remain untouched).

### Phase 3: Validate
- Verify both files parse as valid JSON
- Confirm no `python` or `pythonPath` keys remain in either file
- Confirm all active CK3/editor/logWatcher settings are preserved

## Key Milestones
- `.vscode/settings.json` cleaned of all Python references
- `pychivalry.code-workspace` cleaned of `python-envs` settings
- Both files validated as correct JSON with no regressions

## Success Criteria
- Zero `python.*` keys in `.vscode/settings.json`
- Zero `pythonPath` keys under any namespace in `.vscode/settings.json`
- `files.exclude` and `search.exclude` contain only `**/node_modules` and `**/dist`
- `pychivalry.code-workspace` contains no `python-envs.*` keys
- Both files parse as valid JSON
- All CK3 language server, log watcher, and editor settings are preserved unchanged
