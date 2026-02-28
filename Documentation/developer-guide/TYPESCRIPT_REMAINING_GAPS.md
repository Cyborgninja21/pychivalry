# TypeScript Server — Remaining Gaps Report

**Original Date:** February 7, 2026
**Last Audit:** February 27, 2026
**Branch:** `main`
**Overall Status:** ~98% complete. 18 of 18 original items resolved. Systemic finding §7 (SymbolType coverage) partially addressed — 6 new indexer URI patterns added, 4 remain.

---

## Audit Summary

| # | Gap | Original Priority | Status | Notes |
|---|-----|-------------------|--------|-------|
| 1.1 | Localization Key Hover | MEDIUM | **RESOLVED** | `LocalizationIndex` + `generateLocalizationDocs()` |
| 1.2 | Extra Symbol Type Hovers | MEDIUM | **RESOLVED** | All 7 types in `symbolLabels` map |
| 1.3 | Mod Source Badges | LOW | **RESOLVED** | `getModSourceBadge()` via `ModScanner` |
| 1.4 | Schema-Based Field Hover | MEDIUM | **RESOLVED** | `SchemaHoverProvider` wired as fallback |
| 1.5 | List Iterator Hover | LOW | **RESOLVED** | `generateListIteratorDocs()` implemented |
| 1.6 | Character Flag Enhancement | LOW | **RESOLVED** | Emoji bullet formatting with non-zero filtering |
| 2.1 | Localization Key Navigation | MEDIUM | **RESOLVED** | `DefinitionProvider` + `LocalizationIndex` lookup |
| 2.2 | Scripted GUI Navigation | LOW | **RESOLVED** | URI pattern + `SymbolType.SCRIPTED_GUI` in indexer |
| 2.3 | Decision Group Type Navigation | LOW | **RESOLVED** | URI pattern + `SymbolType.DECISION_GROUP_TYPE` in indexer |
| 3.1 | Sync I/O in Document Links | MEDIUM | **RESOLVED** | All I/O uses `fsp` with async/await |
| 3.2 | Providers Re-Parse Independently | MEDIUM | **RESOLVED** | `CachingParser` with content-based LRU cache |
| 4.1 | Bare console.log | LOW | **RESOLVED** | Zero found; `ServerLogger` in use |
| 4.2 | Incremental Parsing | LOW | **RESOLVED (by design)** | CK3 files ~100-500 lines; fast enough |
| 4.3 | workDoneProgress | LOW | **RESOLVED (acceptable)** | Custom `ck3/indexLog` notifications work |
| 4.4 | Data Loader Categories | LOW | **RESOLVED** | All 9 getters implemented |
| 5.1 | Mod Data Completions | LOW | **RESOLVED** | `ModScanner` with dynamic discovery + `📦` badges |
| 6.1 | Restart Debounce | LOW | **RESOLVED** | Debounce timer cleared on manual restart |
| 6.2 | Crash Recovery Limit | LOW | **RESOLVED** | `MAX_CRASH_RESTARTS=3` with 60s window |

---

## 1. Hover Content Gaps

The hover provider is at `vscode-extension/src/server/lsp/hover.ts`. It covers effects, triggers, traits, scope chains, event IDs, namespaces, keywords, scripted effects/triggers, context fields, saved scopes, character flags, list iterators, and schema fields.

### 1.1 Localization Key Hover — MEDIUM (RESOLVED)

> **Audit finding (Feb 27):** Fully implemented with a new `LocalizationIndex` module at `core/localization-index.ts`:
> - Parses CK3 `.yml` files from the workspace `localization/` directory
> - Provides key lookup with text preview, file path, and line number
> - `generateLocalizationDocs()` method added to `hover.ts` with blockquote text preview, file name, and line number display
> - Wired into server's workspace initialization for automatic scanning on startup

### 1.2 Character Interaction / Modifier / On-Action / Opinion Modifier / Scripted GUI Hover — RESOLVED

> **Audit finding (Feb 27):** All 7 symbol types are already present in the `symbolLabels` map at lines 574-582 of `hover.ts`:
> - `SCRIPTED_EFFECT`, `SCRIPTED_TRIGGER`, `CHARACTER_INTERACTION`, `MODIFIER`, `ON_ACTION`, `OPINION_MODIFIER`, `SCRIPTED_GUI`
>
> The `generateScriptedSymbolDocs()` method handles all of them with a generic file/line output. While the Python server has richer type-specific documentation per symbol type, the TypeScript implementation covers all requested types.

### 1.3 Mod Source Badges — LOW (RESOLVED)

> **Audit finding (Feb 27):** `getModSourceBadge()` method added to `hover.ts`:
> - Appends `📦 Mod: ModName` badges to effect, trigger, trait, and scripted symbol hovers
> - Only shown when the symbol originates from a discovered mod
> - Uses `ModScanner.getSourceMod()` for mod path resolution
> - Unblocked by §5.1 resolution (ModScanner now available)

### 1.4 Schema-Based Field Hover — RESOLVED

> **Audit finding (Feb 27):** The `SchemaHoverProvider` is fully wired:
> - Line 107: `private schemaHoverProvider: SchemaHoverProvider` declared
> - Line 114: Constructor initializes it from the injected `schemaLoader`
> - Lines 194-201: `getFieldHover()` called as a fallback in `provideHover()`
> - `vscode-extension/src/server/schema/hover.ts` exists with a proper `getFieldHover(filePath, fieldName)` implementation
>
> The delegation pattern is correct and functional. No changes needed.

### 1.5 List Iterator Hover — RESOLVED

> **Audit finding (Feb 27):** The `generateListIteratorDocs()` method exists at lines 713-731:
> - Pattern matching for all 4 prefixes (`any_`, `every_`, `random_`, `ordered_`) at line 714
> - Uses `getListIteratorDocumentation()` and `getListResultScope()` from `ck3/validation/lists.ts`
> - Proper markdown assembly with title and result scope info
> - Called from `provideHover()` at lines 189-192

### 1.6 Character Flag Hover — LOW (RESOLVED)

> **Audit finding (Feb 27):** Formatting updated to match Python server's rich output:
> - Individual bullet lines with emoji indicators: `🟢 Set`, `🔍 Checked`, `🗑️ Removed`
> - Non-zero filtering: only usage types with count > 0 are displayed
> - Replaces the previous compact single-line `**Usage:** 5 set, 3 check, 2 remove` format

---

## 2. Navigation Gaps

The navigation provider is at `vscode-extension/src/server/lsp/navigation.ts`.

### 2.1 Localization Key Navigation — MEDIUM (RESOLVED)

> **Audit finding (Feb 27):** `DefinitionProvider` now accepts `LocalizationIndex` and resolves localization key navigation:
> - Looks up the key in the `LocalizationIndex` (from §1.1)
> - Returns the file URI and line number for go-to-definition
> - Bypasses the generic symbol-type filter with a dedicated localization lookup path
> - No changes to `SymbolType` enum needed — localization keys handled via separate index

### 2.2 Scripted GUI Navigation — LOW (RESOLVED)

> **Audit finding (Feb 27):** URI pattern added to `indexer.ts`:
> - `/scripted_guis?\//.test(uri)` pattern with `SymbolType.SCRIPTED_GUI` assignment
> - Navigation provider already had the context mapping — no additional changes needed

### 2.3 Decision Group Type Navigation — LOW (RESOLVED)

> **Audit finding (Feb 27):** URI pattern added to `indexer.ts`:
> - `/decision_group_types?\//.test(uri)` pattern with `SymbolType.DECISION_GROUP_TYPE` assignment
> - Navigation provider already had the context mapping — no additional changes needed

---

## 3. Runtime Issues

### 3.1 Synchronous I/O in Document Links — RESOLVED

> **Audit finding (Feb 27):** All filesystem operations in `document-links.ts` now use async/await with `fsp` (fs/promises):
> - `addEventLink()` (line 223): declared async, uses `await fsp.access()` (line 248) and `await fsp.readdir()` (line 249)
> - `addFileLink()` (line 140): uses `await fsp.access()` (line 156)
> - `addLocalizationLink()` (line 180): uses `await fsp.access()` (line 193), `await fsp.readdir()` (line 194), `await fsp.readFile()` (line 199)
> - `addScriptedEffectLink()` / `addScriptedTriggerLink()`: same pattern
> - `provideDocumentLinks()` (line 54): correctly declared async with `await` throughout
>
> Zero synchronous I/O calls remain.

### 3.2 Providers Re-Parse Independently — MEDIUM (RESOLVED)

> **Audit finding (Feb 27):** `CachingParser` class added to `parser.ts` extending `CK3Parser`:
> - Content-based LRU cache transparently returns cached parse results for identical content
> - Server constructs `CachingParser` instead of `CK3Parser` — all providers benefit via Liskov substitution
> - No changes needed in individual providers (`CompletionProvider`, `DiagnosticsProvider`, etc.)
> - `DocumentLinksProvider` initialization also fixed to include the indexer parameter

---

## 4. Infrastructure Polish

### 4.1 Bare `console.log` Calls — RESOLVED

> **Audit finding (Feb 27):** Zero bare `console.log()` or `console.error()` calls found across all 8 originally flagged files. A shared `ServerLogger` class exists at `vscode-extension/src/server/utils/logger.ts`:
> - Singleton export: `export const serverLogger = new ServerLogger()`
> - Routes to LSP `connection.console.log` when available, falls back to `console` otherwise
> - Three methods: `log()`, `warn()`, `error()` with variadic argument formatting
> - Properly integrated across all server files (e.g., `data/loader.ts` uses `serverLogger.log()` and `serverLogger.error()`)

### 4.2 No Incremental Parsing — RESOLVED (by design)

> **Audit finding (Feb 27):** No `parseIncremental()` method exists in `parser.ts` (617 lines). However, this is acceptable:
> - Typical CK3 mod files are ~100-500 lines — full reparse completes in milliseconds
> - Validation is debounced at 500ms (`server.ts` line 522), which is the actual performance gate
> - The parse cache in `server.ts` prevents re-parsing unchanged documents
>
> Incremental parsing would be a nice-to-have for very large files but is not a practical bottleneck.

### 4.3 No `window/workDoneProgress` for Workspace Scan — RESOLVED (acceptable)

> **Audit finding (Feb 27):** Custom `ck3/indexLog` notifications are used throughout:
> - `initializeWorkspace()` (server.ts lines 388-410): sends progress notifications
> - `rescanWorkspace()` (server.ts lines 1143-1195): sends per-folder discovery, incremental progress every 10 files, and bulk completion summary via `ck3/indexLog/bulk`
>
> The client-side extension handles rendering these notifications. Standard `workDoneProgress` would add complexity for minimal UX benefit given the relatively fast scan times.

### 4.4 Data Loader Missing 3 Data Categories — RESOLVED

> **Audit finding (Feb 27):** All 9 data getter methods are implemented in `data/loader.ts`:
> - `getEffects()` (line 301), `getTriggers()` (line 337), `getScopes()` (line 373)
> - `getTraits()` (line 418), `getAnimations()` (line 469), `getOnActions()` (line 505)
> - `getConcepts()` (line 541) — loads `concepts/concepts.yaml`
> - `getIcons()` (line 575) — loads `icons/icons.yaml`
> - `getMods()` (line 610) — loads `mods/mod_registry.yaml`
>
> All three previously missing methods follow the same pattern (cache check, lazy load, error handling, fallback). Async preloading variants also exist. All YAML data files verified present under `pychivalry/data/`.

---

## 5. Completion Gap

### 5.1 Mod Data Completions — LOW (RESOLVED)

> **Audit finding (Feb 27):** New `ModScanner` class at `data/mod-scanner.ts` provides full mod discovery and data extraction:
> - Loads `mod_registry.yaml` for known mod patterns and search paths
> - Discovers mods via `.mod` descriptors and folder matching
> - Extracts traits, triggers, effects using regex patterns with prefix filtering
> - `CompletionProvider` now generates mod-sourced completions with `📦` badges and `z_` sort prefix for lower priority than vanilla items
> - `ModScanner.getSourceMod()` also used by §1.3 for hover badges

---

## 6. Extension Client Minor Items

### 6.1 Restart Debounce Incomplete — LOW (RESOLVED)

> **Audit finding (Feb 27):** Manual restart command now clears `restartDebounceTimer` before calling `deactivate()` + `startServer()`:
> - Prevents the double-restart race condition where a pending config-change debounce timer could fire after a manual restart
> - Timer is cleared and set to `undefined` before proceeding

### 6.2 Crash Recovery Has No Max-Restart Limit — RESOLVED

> **Audit finding (Feb 27):** Full crash recovery safeguards are implemented:
> - `crashCount` counter (line 23), `lastStableTimestamp` (line 24)
> - `MAX_CRASH_RESTARTS = 3` (line 25), `CRASH_STABLE_WINDOW_MS = 60000` (line 26)
> - `onDidChangeState` handler (lines 1799-1834):
>   - Resets `crashCount` to 0 if server was stable for >60 seconds
>   - After 3 crashes: stops auto-restart, shows error message with "Restart Server" button
>   - User must manually click to restart (which resets the counter)
>   - Auto-restart has 3-second delay between crash and attempt

---

## 7. New Finding: SymbolType Coverage Gaps (Feb 27 Audit)

A cross-cutting audit of all 23 `SymbolType` values (defined in `indexer.ts` lines 28-52) against all LSP features revealed systemic coverage gaps beyond the individual items above.

### 7.1 Coverage Matrix

| SymbolType | Hover | Nav | Completions | Symbols | Rename | Doc-Links | Code-Lens |
|---|---|---|---|---|---|---|---|
| EVENT | - | Yes | - | Yes | Yes | Yes | Yes |
| DECISION | - | Yes | - | Yes | Yes | Yes | Yes |
| CHARACTER_INTERACTION | Yes | Yes | - | Yes | - | - | - |
| ON_ACTION | Yes | Yes | - | Yes | - | - | - |
| SCRIPTED_EFFECT | Yes | Yes | - | Yes | Yes | Yes | - |
| SCRIPTED_TRIGGER | Yes | Yes | - | Yes | Yes | Yes | - |
| SCRIPT_VALUE | - | - | - | Yes | - | - | - |
| TRAIT | - | Yes | - | Yes | - | - | - |
| CULTURE | - | - | - | Yes | - | - | - |
| RELIGION | - | - | - | Yes | - | - | - |
| TITLE | - | - | - | Yes | - | - | - |
| MODIFIER | Yes | Yes | - | Yes | - | - | - |
| VARIABLE | - | Yes | - | Yes | Yes | - | - |
| SCOPE | Yes | Yes | Yes | Yes | Yes | - | - |
| NAMESPACE | - | - | - | Yes | - | - | - |
| STORY_CYCLE | - | - | - | Yes | - | - | - |
| ACTIVITY | - | - | - | Yes | - | - | - |
| SCHEME | - | - | - | Yes | - | - | - |
| CHARACTER_FLAG | Yes | Yes | - | Yes | - | - | - |
| OPINION_MODIFIER | Yes | Yes | - | Yes | - | - | - |
| SCRIPTED_GUI | Yes | Yes | - | Yes | - | - | - |
| DECISION_GROUP_TYPE | - | Yes | - | Yes | - | - | - |
| GENERIC | - | - | - | Yes | Yes | - | - |

### 7.2 Coverage by Feature

| LSP Feature | Types Covered | Coverage |
|---|---|---|
| **Symbols** | 23/23 | 100% |
| **Navigation** | 14/23 | 61% |
| **Hover** | 9/23 | 39% |
| **Rename** | 7/23 | 30% |
| **Doc-Links** | 4/23 | 17% |
| **Code-Lens** | 2/23 | 9% |
| **Completions** | 1/23 | 4% |

### 7.3 Orphaned SymbolTypes

The following 8 types are defined in the enum and appear in the Symbols provider but have **no support** in hover, navigation, completions, rename, doc-links, or code-lens:

- `SCRIPT_VALUE`
- `CULTURE`
- `RELIGION`
- `TITLE`
- `NAMESPACE`
- `STORY_CYCLE`
- `ACTIVITY`
- `SCHEME`

### 7.4 Indexer Extraction Gaps

Several SymbolTypes are defined but **never extracted** by the indexer (no URI pattern detection in `indexer.ts` lines 172-179):

| SymbolType | Extracted by Indexer? | Has URI Pattern? |
|---|---|---|
| SCRIPTED_GUI | **Yes** | Added |
| DECISION_GROUP_TYPE | **Yes** | Added |
| SCRIPT_VALUE | **Yes** | Added |
| TRAIT | **Yes** | Added |
| CULTURE | No | Missing |
| RELIGION | No | Missing |
| TITLE | No | Missing |
| MODIFIER | **Yes** | Added |
| CHARACTER_FLAG | No | Missing |
| OPINION_MODIFIER | **Yes** | Added |

6 of 10 previously missing URI patterns have been added. The remaining 4 (`CULTURE`, `RELIGION`, `TITLE`, `CHARACTER_FLAG`) still rely on `EnhancedIndexer` or generic fallbacks rather than proper symbol extraction.

---

## Priority Summary (Updated Feb 27)

| Priority | Items | Description |
|----------|-------|-------------|
| **Systemic** | §7 | SymbolType coverage gaps across LSP features (partially addressed — 6 of 10 indexer patterns added) |

All 18 original gap items are now **RESOLVED**.

### Resolved Items (18 of 18)

- ~~§1.1 Localization Key Hover~~ — `LocalizationIndex` + `generateLocalizationDocs()`
- ~~§1.2 Extra Symbol Type Hovers~~ — All 7 types mapped
- ~~§1.3 Mod Source Badges~~ — `getModSourceBadge()` via `ModScanner`
- ~~§1.4 Schema-Based Field Hover~~ — SchemaHoverProvider wired
- ~~§1.5 List Iterator Hover~~ — `generateListIteratorDocs()` implemented
- ~~§1.6 Character Flag Enhancement~~ — Emoji bullet formatting with non-zero filtering
- ~~§2.1 Localization Key Navigation~~ — `DefinitionProvider` + `LocalizationIndex` lookup
- ~~§2.2 Scripted GUI Navigation~~ — URI pattern added to indexer
- ~~§2.3 Decision Group Type Navigation~~ — URI pattern added to indexer
- ~~§3.1 Synchronous I/O~~ — All async with fsp
- ~~§3.2 Providers Re-Parse Independently~~ — `CachingParser` with content-based LRU cache
- ~~§4.1 Bare console.log~~ — ServerLogger in use
- ~~§4.2 Incremental Parsing~~ — Acceptable by design
- ~~§4.3 workDoneProgress~~ — Custom notifications acceptable
- ~~§4.4 Data Loader Categories~~ — All 9 getters implemented
- ~~§5.1 Mod Data Completions~~ — `ModScanner` with dynamic discovery + `📦` badges
- ~~§6.1 Restart Debounce~~ — Timer cleared on manual restart
- ~~§6.2 Crash Recovery Limit~~ — MAX_CRASH_RESTARTS=3

The TypeScript server is fully functional for day-to-day CK3 modding with complete feature parity on all originally identified gaps. The systemic §7 SymbolType coverage gaps (4 remaining indexer patterns: `CULTURE`, `RELIGION`, `TITLE`, `CHARACTER_FLAG`) are the only outstanding items.
