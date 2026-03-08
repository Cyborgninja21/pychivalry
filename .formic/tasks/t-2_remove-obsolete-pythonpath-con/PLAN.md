# Remove obsolete pythonPath configuration setting and its tests - Implementation Plan

## Status
**PENDING** - Plan created, implementation to begin.

## Context
The `ck3LanguageServer.pythonPath` configuration property is a leftover from the original Python-based server. No runtime code reads this setting, but test files still assert on it. This task removes all `pythonPath` references from `configuration.test.ts` and `extension.test.ts`, and confirms `package.json` is already clean.

## Implementation Overview

### Phase 1: Verify package.json state
Confirm that `package.json` does not contain any `pythonPath` property in `contributes.configuration`. (Exploration already shows it's absent — this is a safety check.)

### Phase 2: Remove pythonPath from configuration.test.ts
Four distinct edits in `vscode-extension/src/test/suite/configuration.test.ts`:
1. Remove `pythonPath: config.get('pythonPath'),` from the `originalConfig` object (line 11)
2. Remove `'pythonPath',` from the `requiredSettings` array (line 47)
3. Delete the entire `'pythonPath should default to "python"'` test block (lines 79–88)
4. Delete the entire `'Should update pythonPath'` test block (lines 183–192)

### Phase 3: Remove pythonPath from extension.test.ts
One edit in `vscode-extension/src/test/suite/extension.test.ts`:
1. Remove `assert.ok(config.has('pythonPath'), 'pythonPath setting should exist');` (line 40)

### Phase 4: Verify
Run `task lint` and `task test:unit` to confirm green CI.

## Key Milestones
- package.json confirmed clean (no `pythonPath`)
- configuration.test.ts updated — four pythonPath references removed
- extension.test.ts updated — one pythonPath assertion removed
- Lint and unit tests pass

## Success Criteria
- Zero references to `pythonPath` in `configuration.test.ts` and `extension.test.ts`
- All remaining configuration tests continue to pass
- `task lint` exits 0
- `task test:unit` exits 0
