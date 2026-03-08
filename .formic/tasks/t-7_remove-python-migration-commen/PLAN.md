# Remove Python Migration Comments — Implementation Plan

## Status
**PENDING** — Plan created, implementation to begin.

## Context
The CK3 Language Support extension was rewritten from Python to TypeScript, but several source files and the root `.gitignore` still contain references to the Python origin. These stale references should be replaced with accurate, forward-looking descriptions of the current TypeScript LSP architecture.

## Implementation Overview

### Phase 1: Update `server.ts` comments
Replace the file-header block (lines 1–13) that describes the project as "a complete rewrite of the Python language server" with a self-contained description of the TypeScript LSP server architecture. Update the `getThreadingMetrics()` comment (line 1373) from the comparative "doesn't have threading like Python" to a positive statement about the single-threaded event-loop model.

### Phase 2: Update `commands.test.ts` comment
Replace the comment on line 97 ("depending on whether Python/LSP server is available") with a reference to LSP server availability only, removing the Python mention.

### Phase 3: Clean `.gitignore`
Remove the two Python-era entries (`pygls-workspace/`, `vscode-python-tools-template/`) and the now-empty "Reference repositories" section header from the root `.gitignore`.

### Phase 4: Verify quality gates
Run `task lint` and `task format:check` to confirm zero warnings and no formatting regressions. Grep the TypeScript source tree for any remaining references to "Python", "pygls", or migration language to ensure completeness.

## Key Milestones
- `server.ts` header and threading comment updated
- `commands.test.ts` comment updated
- `.gitignore` cleaned
- Lint and format checks pass with zero warnings

## Success Criteria
- No TypeScript source comment references "Python", "pygls", or the migration
- `server.ts` header describes the TypeScript LSP server without comparative language
- `getThreadingMetrics()` comment describes the single-threaded event-loop model positively
- `commands.test.ts` comment references LSP server availability without mentioning Python
- `.gitignore` no longer contains `pygls-workspace/` or `vscode-python-tools-template/`
- `task lint` and `task format:check` pass with zero warnings
- CK3 game-data `// legacy format` and `// Legacy:` comments are preserved unchanged
