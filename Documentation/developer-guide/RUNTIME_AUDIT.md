# TypeScript Server Runtime Edge Case & Error Handling Audit

> **Date:** 2025-07-14
> **Scope:** All files under `vscode-extension/src/server/`
> **Severity Legend:** 🔴 Crash risk / data loss · 🟠 Degraded experience · 🟡 Minor / best practice

---

## Table of Contents

1. [Synchronous I/O in Hot Paths](#1-synchronous-io-in-hot-paths)
2. [Missing Error Handling / try-catch Gaps](#2-missing-error-handling)
3. [Unbounded Caches & Memory Leaks](#3-unbounded-caches--memory-leaks)
4. [Unhandled Promise Rejections](#4-unhandled-promise-rejections)
5. [console.log / console.error Instead of connection.console](#5-consolelog--consoleerror-usage)
6. [Parser / Input Validation Gaps](#6-parser--input-validation-gaps)
7. [Performance Issues](#7-performance-issues)
8. [Null / Undefined Access Risks](#8-null--undefined-access-risks)
9. [Miscellaneous Issues](#9-miscellaneous-issues)
10. [Recommendations Summary](#10-recommendations-summary)

---

## 1. Synchronous I/O in Hot Paths

### 🔴 document-links.ts — Reads ALL localization files synchronously on every link request

**File:** `vscode-extension/src/server/lsp/document-links.ts`

| Location | Issue |
|----------|-------|
| `addLocalizationLink()` ~L142-155 | `fs.existsSync(locPath)` + `fs.readdirSync(locPath)` + `fs.readFileSync(fullPath)` for *every* `.yml` file in `localization/english/`. This runs for every `name`, `desc`, `text`, `title`, or `tooltip` node in the document. |
| `addEventLink()` ~L178-192 | `fs.existsSync(eventsPath)` + `fs.readdirSync(eventsPath)` to search for event files by namespace prefix. |
| `addScriptedEffectLink()` ~L205-222 | `fs.existsSync(effectsPath)` + `fs.readdirSync(effectsPath)` + `fs.readFileSync(fullPath)` — reads entire file contents to search for `effectName =`. |
| `addScriptedTriggerLink()` ~L235-252 | Same pattern — reads all `.txt` files in `scripted_triggers/` synchronously. |
| `addFileLink()` ~L122-134 | Multiple `fs.existsSync()` calls in a loop. |
| `validateLinkTarget()` ~L284 | `fs.existsSync()` on resolve — relatively benign. |

**Impact:** Every `onDocumentLinks` request blocks the Node.js event loop while performing full directory scans and file content reads. For a workspace with many localization or scripted effect files, this causes visible UI freezes.

**Fix:** Use async `fs.promises` APIs, cache directory listings, or resolve links lazily (defer to `resolveDocumentLink`).

---

### 🔴 data/loader.ts — All data loading methods use synchronous fs

**File:** `vscode-extension/src/server/data/loader.ts`

| Location | Issue |
|----------|-------|
| `getInstance()` ~L74-100 | `fs.existsSync()` + `fs.readdirSync()` + `fs.statSync()` in a loop over 8+ candidate paths. |
| `getEffects()` ~L109-126 | `fs.existsSync()` + `fs.readFileSync()` |
| `getTriggers()` ~L133-150 | `fs.existsSync()` + `fs.readFileSync()` |
| `getScopes()` ~L157-180 | `fs.existsSync()` + `fs.readFileSync()` in a loop (3 files). |
| `getTraits()` ~L187-214 | `fs.existsSync()` + `fs.readFileSync()` in a loop (7 files). |
| `getAnimations()` ~L221-237 | `fs.existsSync()` + `fs.readFileSync()` |
| `getOnActions()` ~L244-260 | `fs.existsSync()` + `fs.readFileSync()` |

**Mitigating factor:** Data is loaded lazily and then cached—subsequent calls hit the cache. The
first call to each method will block, typically during startup.

**Fix:** Convert to async loading during `initializeWorkspace()`. Pre-warm all caches.

---

### 🟠 log/watcher.ts — All file reading is synchronous

**File:** `vscode-extension/src/server/log/watcher.ts`

| Location | Issue |
|----------|-------|
| `initialScan()` ~L176 | `fs.readFileSync()` + `fs.statSync()` |
| `readNewLines()` ~L215-226 | `fs.statSync()` + `fs.openSync()` + `fs.readSync()` + `fs.closeSync()` |
| `start()` ~L114 | `fs.existsSync()` in loops |

**Impact:** The watcher runs on an interval callback (`fs.watchFile`). Synchronous reads block the event loop during each poll.

---

### 🟠 schema/loader.ts — Synchronous file existence checks

**File:** `vscode-extension/src/server/schema/loader.ts`

Uses `fs.existsSync()` before async `readFile` operations — minor but unnecessary blocking.

---

### 🟠 workspace-enhanced.ts — `discoverModDescriptor()` uses `fs.existsSync()`

**File:** `vscode-extension/src/server/core/workspace-enhanced.ts` ~L258
Synchronous existence check before async file read.

---

## 2. Missing Error Handling

### 🔴 server.ts — `onReferences` accesses `params.context` without null check

**File:** `vscode-extension/src/server/server.ts` ~L358

```typescript
return this.definitionProvider.findAllReferences(
    document, params.position, params.context.includeDeclaration
);
```

If `params.context` is `null` or `undefined`, this throws `TypeError: Cannot read properties of null`.

---

### 🟠 server.ts — Most LSP handler methods lack try-catch

The following handlers at the listed approximate lines have **no try-catch** protection:

| Handler | ~Line |
|---------|-------|
| `onCompletion` | 345 |
| `onHover` | 355 |
| `onDefinition` | 365 |
| `onReferences` | 373 |
| `onTypeDefinition` | 383 |
| `onImplementation` | 393 |
| `onDeclaration` | 403 |
| `onDocumentSymbol` | 413 |
| `onDocumentFormatting` | 423 |
| `onDocumentRangeFormatting` | 433 |
| `onFoldingRanges` | 443 |
| `onPrepareRename` | 453 |
| `onRenameRequest` | 463 |
| `onDocumentHighlight` | 473 |
| `onSemanticTokens` | 483 |
| `onSemanticTokensRange` | 493 |
| `onCodeAction` | 503 |
| `onCodeLens` | 513 |
| `onDocumentLinks` | 523 |
| `onInlayHint` | 533 |
| `onSignatureHelp` | 543 |
| `onWorkspaceSymbol` | 563 |

**Impact:** Any uncaught exception in a handler sends InternalError back to the client and potentially kills the server connection.

**Fix:** Wrap every handler body in try-catch and return appropriate empty/null responses on error while logging to `connection.console.error`.

---

### 🟠 server.ts — `onExecuteCommand` throws for unknown commands

**File:** `vscode-extension/src/server/server.ts` ~L605

```typescript
default: throw new Error(`Unknown command: ${command}`);
```

This surfaces as an unhandled error on the client side. Should return a structured error response instead.

---

### 🔴 log/watcher.ts — File descriptor leak in `readNewLines()`

**File:** `vscode-extension/src/server/log/watcher.ts` ~L215-226

```typescript
const fd = fs.openSync(filePath, 'r');
const buffer = Buffer.alloc(stat.size - currentPos);
fs.readSync(fd, buffer, 0, buffer.length, currentPos);
fs.closeSync(fd);
```

If `fs.readSync()` throws (e.g., file locked, permission denied), `fs.closeSync(fd)` is never called.

**Fix:** Use try-finally:
```typescript
const fd = fs.openSync(filePath, 'r');
try {
    fs.readSync(fd, buffer, 0, buffer.length, currentPos);
} finally {
    fs.closeSync(fd);
}
```

---

### 🟠 schema/validator.ts — `matchesBlockPattern()` catches regex errors but only `console.warn`s

**File:** `vscode-extension/src/server/schema/validator.ts` ~L108

A malformed regex in a YAML schema file silently fails. No diagnostic is surfaced to the user.

---

### 🟠 ck3/validation/diagnostics.ts — `checkSchema()` catches errors with `console.error`

**File:** `vscode-extension/src/server/ck3/validation/diagnostics.ts` ~L154

```typescript
} catch (error) {
    console.error(`Schema validation error: ${error}`);
    return [];
}
```

Should use `connection.console.error` and potentially return a diagnostic indicating schema validation failed.

---

## 3. Unbounded Caches & Memory Leaks

### 🟠 hover.ts — `docCache` is an unbounded Map

**File:** `vscode-extension/src/server/lsp/hover.ts` ~L101

```typescript
private docCache: Map<string, string> = new Map();
```

The cache key is `${context}:${token}`. For workspaces with many unique symbols, this grows without limit. There is no eviction policy, no size limit, and no cache invalidation when data files are reloaded.

**Fix:** Use an LRU cache with a maximum size (e.g., 500 entries), or clear on `DataLoader.reload()`.

---

### 🟠 code-lens.ts — Reference/namespace caches grow within TTL window

**File:** `vscode-extension/src/server/lsp/code-lens.ts`

The `referenceCache` and `namespaceCache` use a 5-second TTL but have no size limit. During rapid typing, many cache entries accumulate before expiry.

---

### 🟠 workspace-enhanced.ts — `undefinedReferences` and `eventChains` arrays grow unbounded

**File:** `vscode-extension/src/server/core/workspace-enhanced.ts`

Both arrays (`undefinedReferences`, `eventChains`) are append-only via `addUndefinedReference()` and `addEventChain()`. They are only cleared by `clearWorkspaceData()`, which filters by URI prefix.

---

### 🟡 indexer-enhanced.ts — No cleanup of enhanced data on re-index

**File:** `vscode-extension/src/server/core/indexer-enhanced.ts`

`indexDocumentEnhanced()` calls `super.indexDocument()` which cleans up base symbol data, but enhanced data (`events`, `decisions`, `references`, `dependencies`, `localizationKeys`, `eventsByNamespace`) is **not** cleaned up before re-indexing. This causes:

- Duplicate entries in `eventsByNamespace`
- Stale references persisting after document changes
- Stale dependency entries

---

## 4. Unhandled Promise Rejections

### 🟠 server.ts — `onDidChangeDocument` runs async validation without error boundary

**File:** `vscode-extension/src/server/server.ts` ~L312

```typescript
private async onDidChangeDocument(event: { document: TextDocument }): Promise<void> {
    const parsed = this.parser.parse(document.getText());
    await this.indexer.indexDocumentEnhanced(document.uri, parsed.ast);
    await this.validateDocument(document);
}
```

If `parser.parse()` throws (e.g., on binary input), the promise rejects with no handler. The `validateDocument()` method has its own try-catch, but the lines above it do not.

**Fix:** Wrap the entire method body in try-catch.

---

### 🟠 server.ts — `onDidOpenDocument` same pattern

**File:** `vscode-extension/src/server/server.ts` ~L298

---

### 🟠 server.ts — `onDidSaveDocument` same pattern

**File:** `vscode-extension/src/server/server.ts` ~L334

---

## 5. console.log / console.error Usage

These should all use `connection.console.log` / `connection.console.error` for proper LSP output channel routing.

| File | ~Line(s) | Usage |
|------|----------|-------|
| `data/loader.ts` | Throughout (~15 occurrences) | `console.log(...)`, `console.error(...)`, `console.warn(...)` |
| `schema/loader.ts` | Multiple | `console.log(...)`, `console.error(...)` |
| `ck3/validation/diagnostics.ts` | ~154 | `console.error(...)` |
| `schema/validator.ts` | ~108 | `console.warn(...)` |
| `ck3/validation/scopes.ts` | ~41, ~67, ~85, ~240 | Multiple `console.warn(...)` for unknown scope types/links |

**Impact:** Output goes to the Node.js process stderr/stdout instead of the VS Code Output panel. Users never see these diagnostic messages.

---

## 6. Parser / Input Validation Gaps

### 🟠 parser.ts — No input size limit

**File:** `vscode-extension/src/server/core/parser.ts`

The parser accepts input of any size. A multi-megabyte file will create millions of tokens and AST nodes, consuming proportional memory.

---

### 🟠 parser.ts — No recursion depth limit in `parseBlock()`

**File:** `vscode-extension/src/server/core/parser.ts` ~L234

`parseBlock()` calls itself recursively via `parseStatement()` → `parseAssignment()` → `parseBlock()`. A deeply nested CK3 file (e.g., 500+ levels deep) could cause a stack overflow.

---

### 🟡 parser.ts — `readString()` has no length limit

**File:** `vscode-extension/src/server/core/parser.ts` ~L301

An unterminated or extremely long quoted string will consume memory until EOF.

---

### 🟡 parser.ts — No handling of binary/null bytes

If a binary file is accidentally opened as a CK3 document, the parser will process it character by character without any early bail-out.

---

## 7. Performance Issues

### 🔴 semantic-tokens.ts — `getLineText()` splits entire document on every call

**File:** `vscode-extension/src/server/lsp/semantic-tokens.ts` ~L336

```typescript
private getLineText(documentText: string, lineNumber: number): string {
    const lines = documentText.split('\n');
    return lines[lineNumber] || '';
}
```

This is called once per AST node (for `emitValueToken` and `emitOperatorToken`). For a document with N nodes and M lines, this is O(N × M) string splitting.

**Fix:** Split once at the start of `generateSemanticTokens()` and pass the lines array through, or cache the split result.

---

### 🟠 Multiple providers re-parse the document on every request

The following providers call `this.parser.parse(document.getText())` on every invocation, even though the document hasn't changed since the last parse:

| Provider | File |
|----------|------|
| CompletionProvider | `lsp/completions.ts` |
| DocumentHighlightProvider | `lsp/document-highlight.ts` |
| FoldingRangeProvider | `lsp/folding.ts` |
| SemanticTokensProvider | `lsp/semantic-tokens.ts` |
| DocumentLinksProvider | `lsp/document-links.ts` |
| InlayHintsProvider | `lsp/inlay-hints.ts` |
| SignatureHelpProvider | `lsp/signature-help.ts` |
| CodeLensProvider | `lsp/code-lens.ts` |
| CodeActionsProvider | `lsp/code-actions.ts` |
| RenameProvider | `lsp/rename.ts` |
| SymbolProvider | `lsp/symbols.ts` |
| DefinitionProvider | `lsp/navigation.ts` |
| HoverProvider | `lsp/hover.ts` (implicit via `extractTokenInfo`) |

**Impact:** The same document gets parsed 5-10+ times per keystroke (once per provider that fires). The parser is pure computation, so it's not a correctness issue, but it's wasteful.

**Fix:** Implement a parsed document cache keyed by `(uri, version)` in the server, so all providers share the same parse result.

---

### 🟠 server.ts — No debounce on `onDidChangeDocument`

**File:** `vscode-extension/src/server/server.ts` ~L312

Every keystroke triggers full parse + index + validation. There is no debounce/throttle.

**Fix:** Add a 200-300ms debounce before running validation. Keep parse + index immediate for responsive completion/hover.

---

### 🟠 document-highlight.ts — Parses document TWICE per request

**File:** `vscode-extension/src/server/lsp/document-highlight.ts`

`provideDocumentHighlights()` calls `this.parser.parse()` at L43, then `getHighlightContext()` calls `this.parser.parse()` **again** at L92 for the same document text.

---

### 🟠 ck3/language.ts — `getEffects()`, `getTriggers()` etc. create new objects on every call

**File:** `vscode-extension/src/server/ck3/language.ts`

Static methods like `getEffects()`, `getTriggers()`, `getTraits()` return new object/array literals on every call. These are called by `isEffect()`, `isTrigger()`, `isTrait()` which construct the full collection just to check membership.

**Fix:** Cache the results as static class fields, initialized once.

---

## 8. Null / Undefined Access Risks

### 🟠 server.ts — `onReferences` params.context may be null/undefined

Already noted in Section 2. ~L358.

---

### 🟡 server.ts — `insertTextAtCursor` uses `parseInt()` without validation

**File:** `vscode-extension/src/server/server.ts` ~L554

```typescript
const line = parseInt(args[1]);
const character = parseInt(args[2]);
```

If args contain non-numeric strings, `parseInt` returns `NaN`, which propagates silently.

---

### 🟡 Various providers — `document.get()` returns `undefined` but only checked for truthiness

All handlers check `if (!document) return null;` which is correct. No issues here.

---

### 🟡 schema/validator.ts — `evaluateCondition` splits on first ` = ` or ` != ` only

**File:** `vscode-extension/src/server/schema/validator.ts` ~L251

```typescript
const [fieldName, value] = condition.split(' = ').map(s => s.trim());
```

If the condition contains multiple ` = ` tokens, only the first split is used; the rest is silently dropped. Could produce incorrect validation results.

---

## 9. Miscellaneous Issues

### 🟡 workspace-enhanced.ts — Uses deprecated `promisify(fs.exists)`

**File:** `vscode-extension/src/server/core/workspace-enhanced.ts` ~L29

```typescript
const exists = promisify(fs.exists);
```

`fs.exists` is deprecated because it doesn't follow the standard Node.js callback signature. Use `fs.promises.access()` or `fs.promises.stat()` with a try-catch instead.

**Note:** The `exists` variable appears to be imported but not actually used in the code paths examined; however, its presence as a `promisify` target is a lint/correctness concern.

---

### 🟡 schema/loader.ts — `processInheritance()` has potential infinite recursion

**File:** `vscode-extension/src/server/schema/loader.ts`

If two schemas reference each other via `inherits`, `processInheritance()` will recurse infinitely. There is no cycle detection.

---

### 🟡 code-actions.ts — Creates new `SchemaLoader`/`DocumentIndexer` in constructor

**File:** `vscode-extension/src/server/lsp/code-actions.ts`

The constructor creates fresh `SchemaLoader` and `DocumentIndexer` instances if they are not provided. These instances have no connection to the server's shared state.

---

### 🟡 ck3/validation/scopes.ts — `getDataLoader()` called per function invocation

Each function (`getScopeLinks`, `getScopeLists`, `getTargetScopeType`, etc.) calls `getDataLoader()` individually. While `getDataLoader()` returns a singleton, it adds unnecessary overhead in tight loops. Consider caching the reference locally.

---

### 🟡 server.ts — `renameEvent()` regex uses unescaped user input

**File:** `vscode-extension/src/server/server.ts` ~L580

```typescript
const regex = new RegExp(`\\b${oldId.replace(/\./g, '\\.')}\\b`, 'g');
```

Only `.` is escaped. If `oldId` contains other regex metacharacters (`(`, `[`, `*`, `+`, `?`, `{`, etc.), the regex will be malformed and throw (or match incorrectly).

**Fix:** Use a proper regex-escape function or `String.prototype.replaceAll()`.

---

### 🟡 diagnostics-enhanced.ts — `checkCircularDependencies()` reports at line 0, char 0

**File:** `vscode-extension/src/server/ck3/validation/diagnostics-enhanced.ts` ~L313

Circular dependency diagnostics use a hardcoded `{ line: 0, character: 0 }` range since the cycle isn't tied to a specific location. This is technically valid LSP but provides poor UX.

---

## 10. Recommendations Summary

### Critical (address first)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Sync I/O in `document-links.ts` hot paths | Convert to async, cache directory listings |
| 2 | Missing try-catch in all LSP handlers | Wrap every handler in try-catch |
| 3 | File descriptor leak in `readNewLines()` | Use try-finally around `openSync`/`closeSync` |
| 4 | `onReferences` null access on `params.context` | Add null check |
| 5 | `getLineText()` in semantic-tokens splits doc per token | Split once, pass array |

### High Priority

| # | Issue | Fix |
|---|-------|-----|
| 6 | Duplicate parsing per keystroke across providers | Implement parsed document cache `(uri, version) → ParsedDocument` |
| 7 | No debounce on `onDidChangeDocument` | Add 200-300ms debounce for validation |
| 8 | `console.log`/`console.error` used instead of `connection.console` | Replace ~20 occurrences across 4 files |
| 9 | Unbounded `docCache` in hover.ts | Use LRU cache or cap at 500 entries |
| 10 | Enhanced indexer doesn't clean up before re-indexing | Clear enhanced maps for URI before re-indexing |

### Medium Priority

| # | Issue | Fix |
|---|-------|-----|
| 11 | `CK3Language` static methods recreate collections per call | Cache in static fields |
| 12 | Sync I/O in `data/loader.ts` | Convert to async, pre-warm at startup |
| 13 | `document-highlight.ts` parses document twice | Reuse parse result |
| 14 | Schema `processInheritance()` missing cycle detection | Track visited set |
| 15 | `renameEvent()` incomplete regex escaping | Use proper escape utility |

### Low Priority

| # | Issue | Fix |
|---|-------|-----|
| 16 | Deprecated `promisify(fs.exists)` | Use `fs.promises.access()` |
| 17 | Parser has no input size or recursion depth limits | Add guards |
| 18 | `code-actions.ts` creates orphan instances | Pass shared instances |
| 19 | `onExecuteCommand` throws on unknown command | Return error response |
| 20 | `insertTextAtCursor` no `parseInt` validation | Validate / default to 0 |
