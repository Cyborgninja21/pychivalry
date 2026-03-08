# Remove obsolete pythonPath configuration setting and its tests

## Overview

The `ck3LanguageServer.pythonPath` configuration property is a vestige of the original pygls-based Python server. Since the extension was rewritten in TypeScript, no code in `src/extension.ts` or `src/server/` reads this setting — it is dead configuration that confuses users and clutters the settings UI. This task removes the property definition from `package.json` (if still present) and all test assertions that reference it, ensuring the configuration surface accurately reflects the current TypeScript server.

## Goals

- Eliminate every reference to `pythonPath` from the extension manifest (`package.json`) and test suites (`configuration.test.ts`, `extension.test.ts`)
- Keep all remaining configuration settings (`args`, `trace.server`, `logLevel`, `enable`, formatting, inlay hints, log watcher) intact and tested
- Maintain green CI: `task test:unit` and `task lint` pass after the change

## Key Capabilities

- Clean configuration UX — users no longer see a "Path to Python interpreter" setting that does nothing
- Accurate test coverage — tests validate only settings the TypeScript server actually uses
- Save/restore logic in `configuration.test.ts` remains correct after removing the `pythonPath` key from `originalConfig`

## Non-Goals

- Removing the `args` setting — it is actively used in `extension.ts` for passing extra arguments to the language server
- Refactoring the test structure or adding new tests beyond what is necessary to keep existing tests passing
- Modifying any runtime source code (`src/extension.ts`, `src/server/`) — this task is limited to manifest and test files

## Requirements

- `package.json`: no `ck3LanguageServer.pythonPath` entry exists in `contributes.configuration[].properties`
- `configuration.test.ts`: `pythonPath` removed from `originalConfig` object, `requiredSettings` array, the "pythonPath should default to python" test, and the "Should update pythonPath" test
- `extension.test.ts`: the `config.has('pythonPath')` assertion removed
- `task test:unit` exits 0
- `task lint` exits 0
