# Remove obsolete pythonPath configuration setting and its tests

## Overview

The extension still defines a `ck3LanguageServer.pythonPath` configuration property that was used to locate the Python interpreter for the old pygls-based server. This setting is completely unused by the TypeScript server — no code in `src/extension.ts` or `src/server/` reads it. It must be removed along with all tests that validate it.

**Files to modify:**
- `vscode-extension/package.json` — Remove the `ck3LanguageServer.pythonPath` property from `contributes.configuration.properties` (currently defines type string, default 'python', description 'Path to Python interpreter')
- `vscode-extension/src/test/suite/configuration.test.ts` — Remove:
  - Line 11: `pythonPath` from `originalConfig` object
  - Line 47: `'pythonPath'` from `requiredSettings` array
  - Lines 79-88: Entire `'pythonPath should default to "python"'` test
  - Lines 183-192: Entire `'Should update pythonPath'` test and its restore logic
- `vscode-extension/src/test/suite/extension.test.ts` — Remove line 40: `assert.ok(config.has('pythonPath'), 'pythonPath setting should exist')`

**Technical considerations:**
- The `args` setting in package.json is legitimate (used in `extension.ts:1046`) — do NOT remove it
- After removing `pythonPath`, verify remaining tests still pass by running `task test:unit`
- Ensure the `originalConfig` save/restore logic in `configuration.test.ts` is still valid without `pythonPath`

**Acceptance criteria:**
- No `pythonPath` references exist in package.json contributes section
- No `pythonPath` references exist in test files
- `task test:unit` passes
- `task lint` passes

## Goals

- [ ] Define specific goals here

## Key Capabilities

- Describe what this task will accomplish

## Non-Goals

- What is explicitly out of scope

## Requirements

- List technical and functional requirements
