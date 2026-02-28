# CK3 Language Server — Feature Reference

**Version**: 1.1.0
**Date**: February 27, 2026
**Runtime**: TypeScript / Node.js (LSP)

---

## Overview

The CK3 Language Server provides full IDE support for Crusader Kings III script files (`.txt`, `.gui`, `.gfx`, `.asset`) and localization files (`_l_english.yml`, etc.). It runs as a VS Code Language Server Protocol (LSP) backend, powering completions, diagnostics, navigation, and more.

---

## 1. Completions

Multi-strategy context-aware completions for CK3 script files.

| Strategy | What it provides |
|----------|-----------------|
| Template | Snippet templates for events, decisions, effects, triggers |
| Schema field | Field suggestions driven by YAML schema definitions |
| Value assignment | Value completions for `type =`, boolean, enum, and numeric fields |
| Scope-aware | Suggestions filtered by the current scope context |
| Saved scope | Completions for `scope:` references from indexed `save_scope_as` |
| Impact/trait | Trait names, list iterators, parameter names |

- Fuzzy matching on all suggestions
- `sortText` ranking for intelligent ordering
- Document-category awareness (event files, decision files, etc.)

---

## 2. Hover

Rich markdown documentation on hover for CK3 script tokens.

- **Effects / triggers**: Full docs with parameters, scope info, examples
- **Traits**: Category, opposites, modifiers
- **Variables**: Inferred type and scope (global / local / temporary)
- **Iterators**: Result scope type (e.g. `every_vassal` -> `character`)
- **Keywords**: Documentation for `trigger`, `immediate`, `option`, `if`, `while`, `else`
- **Context fields**: `ai_chance`, `left_portrait`, `cooldown`, `is_shown`, etc.
- **Localization keys**: Resolved text preview

---

## 3. Diagnostics

Multi-phase validation pipeline producing warnings and errors in real time.

### Phase 1 — Parse Errors
Syntax violations detected by the tokenizer and parser.

### Phase 2 — Scope Validation
| Code | Description |
|------|-------------|
| SCOPE-001 | Unknown scope type |
| SCOPE-002 | Invalid scope link |
| SCOPE-003 | Invalid scope chain |
| SCOPE-004 | Trigger not valid in this scope |
| SCOPE-005 | Effect not valid in this scope |
| SCOPE-006 | Invalid list base for scope |

100+ scope types with link definitions. Validates chains like `root.liege.primary_title`. Supports universal links (`root`, `this`, `prev`, `from`, `fromfrom`).

### Phase 3 — Schema Validation
Validates AST against YAML schema definitions. Checks property types, cardinality, required fields, enum values, and patterns.

### Phase 4 — Convention Checks (Events)
| Code | Description |
|------|-------------|
| EVENT-001 | Invalid event type |
| EVENT-002 | Missing required field (type, title, desc, theme, etc.) |
| EVENT-003 | Invalid event theme |
| EVENT-004 | Invalid portrait position or animation |
| EVENT-005 | Malformed event ID |
| EVENT-006 | Invalid dynamic description |
| EVENT-007 | Invalid option configuration |

Supports 6 event types: `character_event`, `letter_event`, `court_event`, `duel_event`, `feast_event`, `story_cycle`.

### Phase 5 — Localization Checks
Flags localization key references that contain spaces or don't match expected naming patterns.

### Phase 6 — Style Checks
| Code | Description |
|------|-------------|
| CK3302 | Multiple assignments on one line |
| CK3303 | Inconsistent indentation (spaces vs. tabs) |
| CK3304 | Trailing whitespace |
| CK3305 | Block indentation relative to parent |
| CK3306 | Operator spacing |
| CK3307 | Closing brace alignment |
| CK3308 | Blank lines between blocks |
| CK3314 | Empty blocks |
| CK3316 | Line length exceeded |
| CK3317 | Nesting depth exceeded |
| CK3325 | Namespace placement |
| CK3330–CK3332 | Brace matching errors |
| CK3340–CK3345 | Scope reference errors |

### Phase 7 — Paradox Convention Checks
| Code | Description |
|------|-------------|
| CK3760–CK3768 | Event structure violations |
| CK3870 | Effect used inside trigger block |
| CK3871 | Effect used inside limit block |
| CK3872 | Redundant trigger |
| CK3873 | Impossible trigger combination |
| CK3875 | Missing limit in random iterator |
| CK3976 | Effect inside `any_` iterator |
| CK3977 | `every_` iterator without limit |
| CK5137 | `is_alive` without `exists` guard |

### Phase 8 — Variable Validation
| Code | Description |
|------|-------------|
| CK3701 | Undeclared variable |
| CK3702 | Unused variable |
| CK3703 | Variable scope mismatch |
| CK3704 | Invalid variable name |
| CK3705 | Variable type inconsistency |
| CK3706 | Variable value out of range |

Tracks `set_variable`, `set_local_variable`, `set_global_variable`, `set_temporary_variable` and their usage.

### Phase 9 — Trait Validation
| Code | Description |
|------|-------------|
| CK3800 | Unknown trait |
| CK3801 | Incompatible traits |
| CK3803 | Trait opposite conflict |
| CK3804 | Trait group violation |

### Phase 10 — Script Value Validation
| Code | Description |
|------|-------------|
| VALUE-001 | Invalid script value type |
| VALUE-002 | Range min > max |
| VALUE-003 | Unknown formula operation |
| VALUE-004 | `else_if` after `else` |
| VALUE-005 | Formula missing explicit `value` |
| VALUE-006 | Invalid `round_to` parameter |

Valid formula operations: `value`, `add`, `subtract`, `multiply`, `divide`, `modulo`, `min`, `max`, `round`, `round_to`, `ceiling`, `floor`.

### Phase 11 — Asset Validation
Checks that referenced texture, icon, and GUI file paths exist in the workspace.

### Phase 12 — Story Cycle Validation
Validates story cycle structure, effect group timing, and triggered effect references.

### Phase 13 — Scripted Block Validation
Validates `scripted_effect` and `scripted_trigger` definitions and parameter usage.

### Phase 14 — Generic Rules
Schema-driven extensible rule engine supporting 7 rule types: effect usage, trigger usage, iterator checks, redundancy, missing prerequisites, comparison syntax, value checks.

### Phase 15 — Localization Content Validation (`.yml` files)
| Code | Description |
|------|-------------|
| LOC-001 | Invalid localization key format |
| LOC-002 | Unknown character function (70+ valid functions) |
| LOC-003 | Malformed text formatting code (40+ valid codes) |
| LOC-004 | Invalid icon reference |
| LOC-005 | Unclosed brackets |
| LOC-006 | Unknown concept reference |
| LOC-007 | Invalid variable substitution syntax |

Validates the *contents* of localization strings: `[ROOT.GetName]`, `#bold`, `@gold_icon!`, `$GOLD$`, `[concept|E]`, bracket balance.

### Configuration
All 13 validation categories can be independently enabled/disabled:
`enableScopeValidation`, `enableSchemaValidation`, `enableConventionChecks`, `enableLocalizationChecks`, `enableParadoxChecks`, `enableVariableChecks`, `enableTraitChecks`, `enableScriptedBlockChecks`, `enableGenericRules`, `enableAssetChecks`, `enableStoryCycleChecks`, `enableScriptValueChecks`, `enableLocalizationValidation`.

---

## 4. Navigation

| Capability | Description |
|------------|-------------|
| Go to Definition | Jump to event, decision, scripted effect/trigger, variable, scope definitions. Cross-file via indexer. |
| Find References | All usages of a symbol across the workspace |
| Type Definition | Navigate to the type definition for variables and scopes |
| Find Implementations | Locate scripted effect/trigger implementations |

12+ navigation context types: `EVENT_ID`, `DECISION_ID`, `SCOPE_NAME`, `VARIABLE_NAME`, `SCRIPTED_EFFECT`, `SCRIPTED_TRIGGER`, `ON_ACTION`, `TRAIT_NAME`, `LOCALIZATION_KEY`, etc.

---

## 5. Rename

Workspace-wide semantic rename with scope awareness.

- **Events, decisions, scripted effects/triggers**: Renamed across all files
- **Global variables**: All references updated
- **Local/temporary variables**: Scoped to the enclosing block
- Prepare-rename validation (reserved words, syntax checks)

---

## 6. Document Symbols & Workspace Symbols

- **Document symbols**: Hierarchical outline of events, decisions, effects, triggers in the current file
- **Workspace symbols**: Fuzzy search across the entire workspace (top 100 results, ranked)
- SymbolKind mapping for VS Code outline and breadcrumbs

---

## 7. Semantic Tokens

Context-aware syntax highlighting beyond TextMate grammars.

- **16 token types**: keyword, operator, string, number, variable, function, namespace, class, property, comment, parameter, type, enumMember, event, decorator, macro
- **9 modifiers**: declaration, readonly, static, deprecated, abstract, async, modification, documentation, defaultLibrary
- Scope-aware coloring (effect vs. trigger blocks)

---

## 8. Code Lens

Inline annotations above code blocks.

| Lens | Description |
|------|-------------|
| Reference count | "N references" with click-to-find |
| Complexity | "Complexity: simple/moderate/complex" with metrics |
| Event chains | Visual links between triggered events |
| Namespace stats | Event count per namespace |
| Localization coverage | "Localization: N%" for events with title/desc |

---

## 9. Document Links

Clickable links within CK3 script files.

- File path references (textures, icons, GUI files)
- Event ID links -> jump to event definition
- Localization key links
- 8 link types: file, event, decision, scripted_effect, localization, wiki, documentation
- Tooltip warnings for missing targets

---

## 10. Folding

Smart code folding by block type.

- Block folding (events, options, triggers, effects)
- List folding for multi-line value lists
- Comment region folding
- Configurable minimum line threshold

---

## 11. Formatting

Full document and range-based formatting.

- Paradox convention style (tabs by default)
- Operator alignment within blocks
- Brace style (same-line / new-line)
- Line length enforcement
- Smart indentation
- Empty line preservation

---

## 12. Code Actions

- Template code generation (event, decision, scripted effect templates)
- CodeActionKind support: QuickFix, Refactor, RefactorExtract, RefactorInline, Source
- Quick-fix generator framework (extensible, partially wired)

---

## 13. Inlay Hints

Inline type annotations in the editor.

| Hint type | Example |
|-----------|---------|
| Scope type | `save_scope_as = target` -> `: character` |
| Scope chain | `root.primary_title` -> `: landed_title` |
| Iterator result | `every_vassal` -> `: character` |
| Variable type | Inferred type from assignment |
| Parameter | Named parameter hints for effects/triggers |

Confidence scoring for type inference. Configurable per-hint-type.

---

## 14. Signature Help

Parameter documentation for effects and triggers as you type.

- Active parameter highlighting
- Overload support for effect variants
- Scope-dependent signatures
- Usage examples in documentation

---

## 15. Document Highlight

Highlight all occurrences of the symbol under the cursor.

- Read highlights (usage) vs. write highlights (declaration/assignment)
- Scope-aware: local variables highlighted only within their block
- Handles `scope:`, `var:`, and other CK3 prefixes

---

## 16. Parser

Recursive-descent parser for CK3 Paradox script syntax.

- **Node types**: ROOT, ASSIGNMENT, BLOCK, LIST, VALUE, COMPARISON, COMMENT
- **Supports**: key=value assignments, nested blocks, value lists, comparisons (`>`, `<`, `>=`, `<=`), quoted strings with escapes, `#` comments, numbers (int/float), scope chains (`root.liege.spouse`)
- Line/character range tracking on every node
- Error recovery (continues parsing after errors)
- **Incremental parsing**: On small edits, only the affected block is reparsed (10-100x speedup for typical edits). Falls back to full parse for large changes.

---

## 17. Indexer

Cross-file symbol tracking with two tiers.

### Base Indexer
- Symbol types: EVENT, DECISION, VARIABLE, SCOPE, SCRIPTED_EFFECT, SCRIPTED_TRIGGER, ON_ACTION, CHARACTER_INTERACTION, NAMESPACE, TRAIT
- Document-level indexing with add/remove/update
- Lookup by name, by type, and fuzzy search

### Enhanced Indexer
- EventMetadata: namespace, number, type, theme, title, options, triggers, immediate, after, portrait, animation
- DecisionMetadata tracking
- Reference graph (requires, optional, triggers, calls)
- Dependency analysis and undefined reference detection
- Localization key extraction
- Event chain mapping

---

## 18. Localization Index

Parses and indexes CK3 YAML localization files.

- `key:number "text"` format parsing
- UTF-8 BOM handling
- O(1) key lookup
- File-specific key tracking
- Entry metadata: fileUri, filePath, line number

---

## 19. Data Loader

Singleton lazy-loading game data from bundled YAML files.

| Data set | Source file | Approximate count |
|----------|------------|-------------------|
| Effects | effects.yaml | 300+ |
| Triggers | triggers.yaml | 200+ |
| Scopes | scopes.yaml | 100+ |
| Traits | traits.yaml | 500+ |
| Animations | animations.yaml | 100+ |
| On-actions | on_actions.yaml | 50+ |
| Concepts | concepts.yaml | 100+ |
| Icons | icons.yaml | 200+ |

Data files bundled into `dist/data/` via webpack copy-plugin.

---

## 20. Mod Scanner

Discovers and extracts data from installed CK3 mods.

- Mod registry loading from `mod_registry.yaml`
- Discovery by descriptor patterns or folder patterns
- Extraction rules: traits, triggers, effects, opinion modifiers, relations
- Discovered mod data merged into completions and validation

---

## 21. Schema System

YAML-based schema definitions for CK3 file types.

- Lazy-loading with caching
- Schema inheritance (`inherits` field)
- Field type information: type, required, description, enum, pattern, items, properties, cardinality
- Used by completions (field suggestions) and diagnostics (validation)

---

## 22. Game Log Watcher

Real-time monitoring of CK3 game log files during play.

### Log Files Monitored
`game.log`, `error.log`, `exceptions.log`, `system.log`, `setup.log`

### Log Analyzer
14 pre-defined error patterns:
- `script_system_error`, `effect_error`, `missing_key_reference`, `unknown_modifier`
- `unknown_effect`, `unknown_trigger`, `scope_error`, `missing_event`
- `missing_localization`, `undefined_variable`, `performance`, `syntax_error`
- `missing_file`, `duplicate_definition`

### Capabilities
- Auto-detection of CK3 log directory (Windows, macOS, Linux)
- Location extraction from log lines (maps errors back to source files)
- Fix suggestions via fuzzy matching (e.g. typo in effect name)
- Diagnostic publication merged with static analysis (source: `ck3-game-log`)
- Statistics tracking (errors by category, most common errors)
- Pause/resume/clear controls

### Configuration
- `logPath`: Custom path or auto-detect
- `debounceDelay`: Polling interval (default 1000ms)
- `maxLogSize`: Initial scan line limit (default 200)
- Custom regex patterns for additional error matching

---

## 23. Extension Commands

| Command | Description |
|---------|-------------|
| `ck3.validateWorkspace` | Full workspace validation |
| `ck3.rescanWorkspace` | Re-index all workspace files |
| `ck3.getWorkspaceStats` | Show workspace statistics |
| `ck3.generateEventTemplate` | Insert event template |
| `ck3.findOrphanedLocalization` | Find unused localization keys |
| `ck3.checkDependencies` | Analyze cross-file dependencies |
| `ck3.showNamespaceEvents` | List events in a namespace |
| `ck3.insertTextAtCursor` | Insert text at cursor position |
| `ck3.generateLocalizationStubs` | Generate missing localization entries |
| `ck3.renameEvent` | Semantic event rename |
| `ck3.startLogWatcher` | Start game log monitoring |
| `ck3.stopLogWatcher` | Stop game log monitoring |
| `ck3.pauseLogWatcher` | Pause log monitoring |
| `ck3.resumeLogWatcher` | Resume log monitoring |
| `ck3.forceRefreshLogs` | Manual log refresh |
| `ck3.clearGameLogs` | Clear log diagnostics |
| `ck3.getLogStatistics` | Show log analysis statistics |
| `ck3.extractTraits` | Extract trait data |
| `ck3.extractLocalization` | Extract localization data |
| `ck3.extractAllData` | Extract all game data |
| `ck3.discoverMods` | Discover installed mods |
| `ck3.openDocumentation` | Open documentation |

---

## 24. Output Channels

8 dedicated output channels for categorized logging:
Combined, GameLogs, Error, Exceptions, System, Setup, Patterns, TraitExtraction, ModDiscovery, AllDataExtraction.

ANSI color support for game log output.

---

## 25. Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ck3LanguageServer.enable` | boolean | true | Enable/disable the language server |
| `ck3LanguageServer.trace` | string | "off" | LSP trace level |
| `ck3LanguageServer.logLevel` | string | "info" | Server log level |
| `ck3LanguageServer.formatting.enabled` | boolean | true | Enable formatting |
| `ck3LanguageServer.formatting.insertSpaces` | boolean | false | Spaces instead of tabs |
| `ck3LanguageServer.formatting.tabSize` | number | 4 | Tab size |
| `ck3LanguageServer.inlayHints.enabled` | boolean | true | Enable inlay hints |
| `ck3LanguageServer.inlayHints.showScopeTypes` | boolean | true | Show scope type hints |
| `ck3LanguageServer.inlayHints.showChainTypes` | boolean | true | Show chain type hints |
| `ck3LanguageServer.inlayHints.showIteratorTypes` | boolean | true | Show iterator type hints |
| `ck3LanguageServer.inlayHints.maxHintsPerLine` | number | 3 | Max hints per line |
| `ck3LanguageServer.logWatcher.enabled` | boolean | true | Enable log watcher |
| `ck3LanguageServer.logWatcher.autoStart` | boolean | false | Auto-start on extension activation |
| `ck3LanguageServer.logWatcher.logPath` | string | "" | Custom log directory path |
| `ck3LanguageServer.logWatcher.showInOutput` | boolean | true | Show logs in output channels |
| `ck3LanguageServer.logWatcher.maxLogSize` | number | 200 | Initial scan line limit |
| `ck3LanguageServer.logWatcher.debounceDelay` | number | 1000 | Polling interval (ms) |

---

## Test Coverage

225 unit tests across 12 test suites:
- Parser (tokens, AST, error recovery, range tracking)
- Parse cache (LRU eviction, versioning)
- Document indexer (symbol tracking, search, re-indexing)
- Style checks (indentation, whitespace, operators, braces, scopes)
- Diagnostics engine (parse errors, conventions, localization, limits)
- Completions (templates, schema, scope, values, robustness)
- Hover (keywords, context fields, cache)
- Fuzzy match (Levenshtein, similarity, findSimilar)
- Script values (ranges, formulas, conditionals)
- Incremental parser (initial parse, incremental changes, invalidation)
- Log analyzer (patterns, location extraction, statistics)
- Log diagnostics (conversion, resolution, clearing)
- Localization validator (functions, formatting, icons, variables, brackets)
