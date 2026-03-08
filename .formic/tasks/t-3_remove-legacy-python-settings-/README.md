# Remove Legacy Python Settings from VS Code Workspace Configuration

## Overview
The project has fully transitioned from Python to TypeScript, but `.vscode/settings.json` and `pychivalry.code-workspace` still carry obsolete Python development settings. This task removes those legacy entries to reduce confusion and keep workspace configuration clean and accurate for the current TypeScript-only stack.

## Goals
- Eliminate all `python.*` settings from `.vscode/settings.json`
- Remove the obsolete `ck3LanguageServer.pythonPath` setting that referenced the former Python-based server
- Remove Python artifact exclusions (`__pycache__`, `*.pyc`, `.pytest_cache`) from `files.exclude` and `search.exclude`
- Remove `python-envs.*` settings from both `.vscode/settings.json` and `pychivalry.code-workspace`
- Ensure both JSON files remain valid and the extension launches correctly via F5

## Key Capabilities
- Cleaner workspace configuration that reflects the actual TypeScript toolchain
- Reduced developer confusion when onboarding or reviewing settings
- No functional impact — only inert, unused settings are removed

## Non-Goals
- Modifying any active CK3 language server settings (`ck3LanguageServer.enable`, `logLevel`, `trace.server`, `logWatcher.*`)
- Changing editor or Node.js-related settings (`editor.*`, `node_modules`/`dist` exclusions)
- Removing Python references from documentation or historical guidelines (e.g., the Python section in coding standards)
- Altering the `folders` array in `pychivalry.code-workspace`

## Requirements
- `.vscode/settings.json` contains zero `python.*` keys after the edit
- `.vscode/settings.json` contains no `pythonPath` key under any namespace
- `files.exclude` and `search.exclude` retain only `**/node_modules` and `**/dist`
- `pychivalry.code-workspace` `settings` block contains no `python-envs.*` keys
- Both files parse as valid JSON (verified by `json_pp` or equivalent)
- The `// Python settings` comment block is removed since there are no Python settings left
- The `// CK3 language server settings` comment and all valid CK3/editor/exclusion settings are preserved
