# PyChivalry Architecture & Analysis Flow

This document illustrates the chain of events and data flow for the CK3 Language Server (TypeScript implementation).

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PyChivalry Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────┐                                                     │
│  │  VS Code /     │  ◄──── JSON-RPC over stdin/stdout ────►            │
│  │  Editor Client │                                                     │
│  └────────────────┘                                                     │
│         │                                                               │
│         │ LSP Requests (completion, hover, diagnostics, etc.)          │
│         ▼                                                               │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │            server.ts - CK3LanguageServer                   │        │
│  │  (uses vscode-languageserver)                              │        │
│  ├────────────────────────────────────────────────────────────┤        │
│  │  Server State:                                             │        │
│  │    • document_asts: Map<uri, CK3Node[]>                   │        │
│  │    • index: DocumentIndexer (cross-file symbols)          │        │
│  │    • ast_cache: Map<hash, AST> (content-based)            │        │
│  │    • pending_updates: Map<uri, NodeJS.Timeout> (debounce) │        │
│  └────────────────────────────────────────────────────────────┘        │
│         │                                                               │
│         │ Delegates to feature modules                                 │
│         ▼                                                               │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │  Core Modules: parser.ts, indexer.ts, diagnostics.ts      │        │
│  │  LSP Features: completions.ts, hover.ts, navigation.ts    │        │
│  │  Validators: events.ts, scopes.ts, validations/*.ts       │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | Component | Description |
|-------|-----------|-------------|
| **Client** | VS Code / Editor | Sends LSP requests via JSON-RPC over stdin/stdout |
| **Server** | `server.ts` | Main entry point - TypeScript server using vscode-languageserver |
| **State** | Server State | `document_asts`, `DocumentIndexer`, AST cache, debounce timers |

### Server State Management

| State Object | Type | Purpose |
|--------------|------|---------|
| `document_asts` | `Map<uri, CK3Node[]>` | Cached AST per open document |
| `index` | `DocumentIndexer` | Cross-file symbol tracking |
| `ast_cache` | `Map<hash, AST>` | Content-hash based cache |
| `pending_updates` | `Map<uri, NodeJS.Timeout>` | Debounced update tasks |
---

## 📄 Document Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Document Lifecycle Flow                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │ Document Opens   │                                                   │
│  │ (didOpen)        │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ├──► 1. Get document from workspace                          │
│           │                                                             │
│           ├──► 2. parser.ts → tokenize()                               │
│           │    └─ Break text into tokens                               │
│           │                                                             │
│           ├──► 3. parser.ts → parseDocument()                         │
│           │    └─ Build AST from tokens                                │
│           │                                                             │
│           ├──► 4. indexer.ts → updateFromAST()                        │
│           │    └─ Extract & index symbols                              │
│           │                                                             │
│           ├──► 5. First open? → indexer.ts                            │
│           │    └─ Scan workspace folders (async)                      │
│           │                                                             │
│           ├──► 6. diagnostics.ts → collectAllDiagnostics()            │
│           │    └─ Validate & find errors                               │
│           │                                                             │
│           └──► 7. Publish diagnostics to client                        │
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │ Document Changes │                                                   │
│  │ (didChange)      │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ├──► 1. Increment version (track for cancellation)           │
│           │                                                             │
│           ├──► 2. Calculate adaptive debounce                          │
│           │    └─ 80ms (small) → 400ms (very large files)              │
│           │                                                             │
│           ├──► 3. Cancel pending update (if exists)                    │
│           │                                                             │
│           ├──► 4. Schedule async task (non-blocking)                   │
│           │                                                             │
│           ├──► 5. Wait debounce period                                 │
│           │    └─ Coalesce rapid keystrokes                            │
│           │                                                             │
│           ├──► 6. Check version still current                          │
│           │    └─ Skip if newer changes arrived                        │
│           │                                                             │
│           ├──► 7. Parse in thread pool                                 │
│           │    └─ get_or_parse_ast() with cache                        │
│           │                                                             │
│           ├──► 8. Publish syntax errors FIRST                          │
│           │    └─ Fast feedback (CK3001, CK3002)                       │
│           │                                                             │
│           └──► 9. Publish semantic errors                              │
│                └─ Slower analysis (CK3101+, CK3201+)                   │
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │ Document Closes  │                                                   │
│  │ (didClose)       │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ├──► 1. Remove from document_asts                            │
│           ├──► 2. Clear pending updates                                │
│           └──► 3. Optionally clear diagnostics                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Document Open (`textDocument/didOpen`)

| Step | Action | Module |
|------|--------| -------|
| 1 | Get document from workspace | `server.ts` |
| 2 | Tokenize source text | `parser.ts` → `tokenize()` |
| 3 | Build AST | `parser.ts` → `parseDocument()` |
| 4 | Extract symbols | `indexer.ts` → `updateFromAST()` |
| 5 | First open? Scan workspace | `indexer.ts` → async folder scan |
| 6 | Run diagnostics | `diagnostics.ts` → `collectAllDiagnostics()` |
| 7 | Publish to client | LSP `textDocument/publishDiagnostics` |

### 2. Document Change (`textDocument/didChange`)

| Step | Action | Details |
|------|--------|---------|
| 1 | Increment version | Track document version for cancellation |
| 2 | Calculate debounce | 80ms (small) → 400ms (very large files) |
| 3 | Cancel pending | Abort previous update if still waiting |
| 4 | Schedule async task | Non-blocking update |
| 5 | Wait debounce period | Coalesce rapid keystrokes |
| 6 | Check version still current | Skip if newer changes arrived |
| 7 | Parse asynchronously | `getOrParseAST()` with cache |
| 8 | Publish syntax errors first | Fast feedback (CK3001, CK3002) |
| 9 | Publish semantic errors | Slower analysis (CK3101+, CK3201+) |

### 3. Document Close (`textDocument/didClose`)

| Step | Action |
|------|--------|
| 1 | Remove from `document_asts` |
| 2 | Clear pending updates |
| 3 | Optionally clear diagnostics |

---

## 🔍 Diagnostics Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    diagnostics.ts - Main Pipeline                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  collectAllDiagnostics()                                                 │
│       │                                                                 │
│       ├──► checkSyntax()       → CK3001, CK3002 (brackets, structure)  │
│       ├──► checkSemantics()    → CK3101-CK3103 (effects/triggers)      │
│       ├──► checkScopes()       → CK3201-CK3203 (scope chains)          │
│       │                                                                 │
│       └──► Domain Validators (see below)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Diagnostic Codes

| Code | Module | Description |
|------|--------|-------------|
| CK3001 | `diagnostics.ts` | Unmatched closing brace `}` |
| CK3002 | `diagnostics.ts` | Unclosed opening brace `{` |
| CK3101 | `diagnostics.ts` | Unknown trigger identifier |
| CK3102 | `diagnostics.ts` | Effect used in trigger block |
| CK3103 | `diagnostics.ts` | Unknown effect identifier |
| CK3201 | `diagnostics.ts` | Invalid scope chain |
| CK3202 | `diagnostics.ts` | Undefined saved scope reference |
| CK3203 | `diagnostics.ts` | Invalid list base for scope |

### Domain-Specific Validators

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Domain Validation Modules                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  diagnostics.ts                                                         │
│       │                                                                 │
│       ├──► validation/events.ts         EVENT-001 to EVENT-006         │
│       │    └─ Event types, themes, portraits, options                   │
│       │                                                                 │
│       ├──► validation/lists.ts          LIST-001 to LIST-005           │
│       │    └─ any_, every_, random_, ordered_ iterators                 │
│       │                                                                 │
│       ├──► validation/localization.ts   LOC-001 to LOC-006             │
│       │    └─ Character functions, formatting codes, icons              │
│       │                                                                 │
│       ├──► validation/script_values.ts  VALUE-001 to VALUE-006         │
│       │    └─ Fixed/range/formula values, conditionals                  │
│       │                                                                 │
│       ├──► validation/scripted_blocks.ts SCRIPT-001 to SCRIPT-006      │
│       │    └─ Scripted triggers/effects, $PARAM$ syntax                 │
│       │                                                                 │
│       ├──► validation/variables.ts      VAR-001 to VAR-006             │
│       │    └─ var:, local_var:, global_var: references                  │
│       │                                                                 │
│       ├──► validation/style_checks.ts   Style warnings                 │
│       ├──► validation/paradox_checks.ts Paradox convention validation  │
│       └──► validation/scope_timing.ts   Scope timing validation        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 💡 Completion System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Completion System Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User types trigger character: _ . : =                                 │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 1. Get AST node at cursor position                       │          │
│  │    parser.ts → getNodeAtPosition()                       │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 2. Analyze line text & detect context                    │          │
│  │    completions.ts → detectContext()                      │          │
│  │    ├─ Check block type (trigger/effect/option)           │          │
│  │    ├─ Check scope type from parent blocks                │          │
│  │    └─ Identify trigger character                         │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 3. Route to appropriate completion source                │          │
│  │                                                           │          │
│  │  Trigger '_' ──► Keywords/effects/triggers               │          │
│  │                  └─ ck3/language.ts definitions           │          │
│  │                                                           │          │
│  │  Trigger '.' ──► Scope links for current scope           │          │
│  │                  └─ scopes.ts → getScopeLinks()         │          │
│  │                                                           │          │
│  │  Trigger ':' ──► Saved scopes from index                 │          │
│  │                  └─ indexer.ts → savedScopes             │          │
│  │                                                           │          │
│  │  Trigger '=' ──► Values/blocks                           │          │
│  │                  └─ Context-appropriate values           │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 4. Filter by context                                      │          │
│  │                                                           │          │
│  │  In trigger block ──► CK3_TRIGGERS only                  │          │
│  │  In effect block  ──► CK3_EFFECTS only                   │          │
│  │  In option block  ──► Both triggers & effects            │          │
│  │  Unknown context  ──► All keywords + snippets            │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 5. Return CompletionList to client                       │          │
│  │    • Label, kind, detail, documentation                  │          │
│  │    • Insert text / snippet                               │          │
│  │    • Sort text for ordering                              │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Trigger Characters

| Character | Context |
|-----------|---------|
| `_` | Keyword/effect/trigger continuation |
| `.` | Scope link completion (e.g., `liege.`) |
| `:` | Saved scope completion (e.g., `scope:`) |
| `=` | Value/block completion |

### Context Detection Flow

| Step | Action | Module |
|------|--------|--------|
| 1 | Get AST node at cursor | `parser.py` → `get_node_at_position()` |
| 2 | Analyze line text | `completions.py` → `detect_context()` |
| 3 | Determine block type | trigger / effect / option / unknown |
| 4 | Get scope type | From parent blocks |
| 5 | Filter completions | By context and scope |

### Completion Sources

| Context | Source | Module |
|---------|--------|--------|
| After `.` | Scope links for current scope | `scopes.py` → `get_scope_links()` |
| After `:` | Saved scopes from index | `indexer.py` → `saved_scopes` |
| In trigger block | Triggers only | `ck3_language.py` → `CK3_TRIGGERS` |
| In effect block | Effects only | `ck3_language.py` → `CK3_EFFECTS` |
| In option block | Both triggers and effects | Combined |
| Unknown context | All keywords | Full list + snippets |

---

## 🎨 Semantic Tokens

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Semantic Tokens Pipeline                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  textDocument/semanticTokens/full request received                     │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ semantic_tokens.py → analyze_document()                  │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ├──► Iterate through lines                       │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ For each line:                                            │          │
│  │                                                           │          │
│  │  1. Track context state                                  │          │
│  │     ├─ Brace depth (nesting level)                       │          │
│  │     ├─ Block type (trigger/effect/event)                 │          │
│  │     └─ Current scope                                     │          │
│  │                                                           │          │
│  │  2. tokenize_line()                                      │          │
│  │     └─ Apply regex patterns:                             │          │
│  │        ├─ Keywords: if, else, trigger, effect, limit     │          │
│  │        ├─ Functions: add_gold, has_trait, trigger_event  │          │
│  │        ├─ Variables: root, prev, scope:xxx               │          │
│  │        ├─ Properties: liege, primary_title               │          │
│  │        ├─ Strings: localization keys                     │          │
│  │        ├─ Numbers: 100, -50, 3.14                        │          │
│  │        ├─ Comments: # comment text                       │          │
│  │        ├─ Events: namespace.0001                         │          │
│  │        ├─ Macros: any_vassal, every_courtier            │          │
│  │        └─ Enums: yes, no, brave                          │          │
│  │                                                           │          │
│  │  3. Classify each token by type & modifiers              │          │
│  │     └─ namespace, class, function, variable, etc.        │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ encode_tokens()                                           │          │
│  │  └─ Convert to LSP delta encoding format                 │          │
│  │     (line delta, start delta, length, type, modifiers)   │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  Return SemanticTokens response to client                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Token Types

| Token Type | CK3 Usage | Example |
|------------|-----------|---------|
| `namespace` | Event namespace declarations | `namespace = my_mod` |
| `class` | Event types | `character_event`, `letter_event` |
| `function` | Effects and triggers | `add_gold`, `has_trait` |
| `variable` | Scopes, saved scopes | `root`, `scope:target` |
| `property` | Scope links | `liege`, `primary_title` |
| `string` | Localization keys | `my_mod.0001.t` |
| `number` | Numeric values | `100`, `3.14` |
| `keyword` | Control flow | `if`, `else`, `limit` |
| `comment` | Comments | `# This is a comment` |
| `event` | Event IDs | `my_mod.0001` |
| `macro` | List iterators | `any_vassal`, `every_courtier` |
| `enumMember` | Boolean/traits | `yes`, `no`, `brave` |

### Processing Flow

| Step | Action | Module |
|------|--------|--------|
| 1 | Iterate lines | `semantic_tokens.py` → `analyze_document()` |
| 2 | Track context | Brace depth, block type |
| 3 | Apply regex patterns | `tokenize_line()` |
| 4 | Encode to LSP format | `encode_tokens()` → delta encoding |

---

## 🔗 Navigation & Cross-File Features

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  Navigation & Cross-File System                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │              DocumentIndex (indexer.py)                   │          │
│  │  Cross-file symbol tracking with 13 symbol types         │          │
│  ├──────────────────────────────────────────────────────────┤          │
│  │                                                           │          │
│  │  namespaces          → namespace declarations            │          │
│  │  events              → event definitions                 │          │
│  │  scripted_effects    → reusable effects                  │          │
│  │  scripted_triggers   → reusable triggers                 │          │
│  │  scripted_lists      → list definitions                  │          │
│  │  script_values       → value definitions                 │          │
│  │  on_actions          → event hooks                       │          │
│  │  saved_scopes        → scope references                  │          │
│  │  localization        → loc keys & text                   │          │
│  │  character_flags     → flag definitions                  │          │
│  │  character_interactions → interaction defs               │          │
│  │  modifiers           → modifier definitions              │          │
│  │  on_action_definitions → on_action defs                  │          │
│  │                                                           │          │
│  └──────────────┬───────────────────────────────────────────┘          │
│                 │                                                       │
│                 │ Provides data for:                                   │
│                 │                                                       │
│  ┌──────────────┴───────────────────────────────────────────┐          │
│  │                                                           │          │
│  │  textDocument/definition                                 │          │
│  │  ├─ navigation.py → find_definition()                    │          │
│  │  │  └─ Search index for symbol location                 │          │
│  │  │     └─ Return Location (uri, range)                  │          │
│  │  │                                                       │          │
│  │  textDocument/references                                 │          │
│  │  ├─ navigation.py → find_references()                   │          │
│  │  │  └─ Search all workspace docs for symbol             │          │
│  │  │     └─ Return List[Location]                         │          │
│  │  │                                                       │          │
│  │  textDocument/hover                                      │          │
│  │  ├─ hover.py → get_hover_info()                         │          │
│  │  │  └─ Look up in index or language data                │          │
│  │  │     └─ Return documentation markdown                 │          │
│  │  │                                                       │          │
│  │  workspace/symbol                                        │          │
│  │  ├─ symbols.py → search_workspace_symbols()             │          │
│  │  │  └─ Query index by pattern                           │          │
│  │  │     └─ Return List[SymbolInformation]                │          │
│  │  │                                                       │          │
│  │  textDocument/documentSymbol                             │          │
│  │  └─ symbols.py → extract_document_symbols()             │          │
│  │     └─ Walk AST and extract hierarchy                   │          │
│  │        └─ Return List[DocumentSymbol]                   │          │
│  │                                                           │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  Index Maintenance:                                                     │
│  • On document open: update_from_ast() extracts symbols                │
│  • On document change: incremental index update                        │
│  • On document close: remove_document() cleans up                      │
│  • First open: scan_workspace() parallel folder scan                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Supported Operations

| LSP Request | Feature | Module |
|-------------|---------|--------|
| `textDocument/definition` | Go to definition | `navigation.py` |
| `textDocument/references` | Find all references | `navigation.py` |
| `textDocument/hover` | Documentation on hover | `hover.py` |
| `workspace/symbol` | Search all symbols | `indexer.py` |
| `textDocument/documentSymbol` | File outline | `symbols.py` |

### Symbol Index (`indexer.py`)

| Symbol Type | Lookup Method | Source Files |
|-------------|---------------|--------------|
| Events | `find_event(id)` | `events/*.txt` |
| Scripted Effects | `find_scripted_effect(name)` | `common/scripted_effects/*.txt` |
| Scripted Triggers | `find_scripted_trigger(name)` | `common/scripted_triggers/*.txt` |
| Saved Scopes | `find_saved_scope(name)` | Extracted from `save_scope_as` |
| Localization | `find_localization(key)` | `localization/**/*.yml` |
| Character Flags | `find_character_flag(flag)` | Extracted from `has_character_flag` |
| Modifiers | `find_modifier(name)` | `common/modifiers/*.txt` |
| On-Actions | `find_on_action(name)` | `common/on_action/*.txt` |

---

## 📁 Complete Module Reference

### Core Modules

| Module | Purpose | Key Functions/Classes |
|--------|---------|----------------------|
| `server.ts` | Main LSP server entry point | `CK3LanguageServer`, `createConnection()` |
| `parser.ts` | Tokenization and AST | `CK3Node`, `tokenize()`, `parseDocument()` |
| `indexer.ts` | Cross-file symbol index | `DocumentIndexer`, `updateFromAST()` |
| `diagnostics.ts` | Error detection pipeline | `collectAllDiagnostics()`, `check*()` |

### Language Features

| Module | Purpose | Key Functions/Classes |
|--------|---------|----------------------|
| `completions.ts` | Auto-completion | `CompletionContext`, `getContextAwareCompletions()` |
| `hover.ts` | Hover documentation | `getHoverInfo()`, `getWordAtPosition()` |
| `semantic-tokens.ts` | Syntax highlighting | `analyzeDocument()`, `encodeTokens()` |
| `navigation.ts` | Go-to-definition | `getDefinition()`, `findReferences()` |
| `symbols.ts` | Document outline | `DocumentSymbol`, `extractDocumentSymbols()` |
| `signature-help.ts` | Function signatures | Parameter hints for effects/triggers |
| `code-actions.ts` | Quick fixes | Refactoring suggestions |
| `code-lens.ts` | Inline annotations | Reference counts, run buttons |
| `folding.ts` | Code folding | Block-based fold ranges |
| `formatting.ts` | Document formatting | Indentation, spacing |
| `inlay-hints.ts` | Inline hints | Parameter name hints |
| `document-highlight.ts` | Symbol highlighting | Highlight same symbols |
| `document-links.ts` | Clickable links | File references, URLs |
| `rename.ts` | Symbol rename | Cross-file rename support |

### Domain Validators

| Module | Purpose | Diagnostic Codes |
|--------|---------|------------------|
| `validation/events.ts` | Event validation | EVENT-001 to EVENT-006 |
| `validation/lists.ts` | List iterator validation | LIST-001 to LIST-005 |
| `validation/localization.ts` | Localization syntax | LOC-001 to LOC-006 |
| `validation/script_values.ts` | Script value formulas | VALUE-001 to VALUE-006 |
| `validation/scripted_blocks.ts` | Reusable code blocks | SCRIPT-001 to SCRIPT-006 |
| `validation/variables.ts` | Variable system | VAR-001 to VAR-006 |
| `validation/style_checks.ts` | Style conventions | Style warnings |
| `validation/paradox_checks.ts` | Paradox conventions | Convention warnings |
| `validation/scope_timing.ts` | Scope timing | Timing validation |

### Data & Support

| Module | Purpose | Contents |
|--------|---------|----------|
| `ck3/language.ts` | Static definitions | `CK3_EFFECTS`, `CK3_TRIGGERS`, `CK3_SCOPES`, etc. |
| `validation/scopes.ts` | Scope type system | `getScopeLinks()`, `validateScopeChain()` |
| `workspace.ts` | Workspace validation | Mod descriptor parsing, cross-file checks |
| `data/scopes/*.yaml` | Scope definitions | `character.yaml`, `province.yaml`, `title.yaml` |

---

## 📊 Key Data Structures

| Structure | Location | Purpose |
|-----------|----------|---------|
| `CK3Node` | `parser.py` | AST node: type, key, value, range, children, scope_type, parent |
| `CK3Token` | `parser.py` | Lexer token: type, value, line, column |
| `DocumentIndex` | `indexer.py` | Cross-file symbol tracking with dictionaries per type |
| `CompletionContext` | `completions.py` | Context for completion: block_type, scope, trigger_char |
| `SemanticToken` | `semantic_tokens.py` | Token: line, start, length, type, modifiers |
| `Event` | `events.py` | Event definition: id, type, title, desc, options |
| `ScriptValue` | `script_values.py` | Value definition: name, type (fixed/range/formula) |
| `ScriptedBlock` | `scripted_blocks.py` | Reusable block: name, type, parameters, content |
| `Variable` | `variables.py` | Variable: name, scope, value, is_list |
| `ListIteratorInfo` | `lists.py` | Iterator: prefix, base_name, type, supported_params |
| `LocalizationKey` | `localization.py` | Loc key: key, file_path, key_type |
| `DocumentSymbol` | `symbols.py` | Outline symbol: name, kind, range, children |

---

## 🔄 Event Flow Summary

| Event | Flow |
|-------|------|
| **Document Opens** | Parse → Index → Scan Workspace (first time) → Publish Diagnostics |
| **Document Changes** | Debounce → Async Parse → Syntax Diagnostics → Semantic Diagnostics |
| **Completion Request** | Detect Context → Filter by Block Type → Return Items |
| **Hover Request** | Get Word → Look up in Index/Language Data → Return Documentation |
| **Definition Request** | Get Word → Search Index → Return Location |
| **Semantic Tokens** | Line-by-line Analysis → Context Tracking → Encode Tokens |
| **Document Symbols** | Walk AST → Extract Hierarchy → Return Symbol Tree |

---

## 🎯 Domain Module Details

### validation/events.ts - Event System Validation

| Feature | Description |
|---------|-------------|
| **Event Types** | `character_event`, `letter_event`, `court_event`, `duel_event`, `feast_event`, `story_cycle` |
| **Required Fields** | All: `type`, `title`, `desc`. letter_event: + `sender` |
| **Themes** | `diplomacy`, `intrigue`, `martial`, `stewardship`, `learning`, `faith`, etc. |
| **Portrait Positions** | `left_portrait`, `right_portrait`, `lower_left_portrait`, etc. |
| **Animations** | `happiness`, `sadness`, `anger`, `fear`, `scheme`, personality traits |
| **Dynamic Descriptions** | `triggered_desc`, `first_valid`, `random_valid` |

### lists.py - List Iteration System

| Prefix | Type | Parameters | Example |
|--------|------|------------|---------|
| `any_` | trigger | `count`, `percent`, `limit` | `any_vassal = { count >= 3 }` |
| `every_` | effect | `limit`, `max`, `alternative_limit` | `every_vassal = { add_gold = 10 }` |
| `random_` | effect | `limit`, `weight`, `save_temporary_scope_as` | `random_courtier = { ... }` |
| `ordered_` | effect | `limit`, `order_by`, `position`, `max`, `min` | `ordered_vassal = { order_by = gold }` |

### localization.py - Localization System

| Feature | Format | Examples |
|---------|--------|----------|
| **Character Functions** | `[scope.GetFunction]` | `GetName`, `GetTitle`, `GetHerHis` |
| **Formatting Codes** | `#code` | `#bold`, `#P` (possessive), `#N` (newline) |
| **Icon References** | `@icon_name!` | `@gold_icon!`, `@prestige_icon!` |
| **Concept Links** | `[concept\|context]` | `[concept_marriage\|E]` |

### script_values.py - Dynamic Calculations

| Type | Format | Example |
|------|--------|---------|
| **Fixed** | Number | `my_gold = 100` |
| **Range** | Min/Max | `my_range = { 50 100 }` |
| **Formula** | Operations | `{ value = gold multiply = 0.1 add = 50 min = 10 }` |
| **Conditional** | if/else_if/else | `{ if = { limit = {...} value = 100 } }` |

### scripted_blocks.py - Reusable Code

| Type | Location | Usage |
|------|----------|-------|
| **Scripted Triggers** | `common/scripted_triggers/*.txt` | Returns boolean |
| **Scripted Effects** | `common/scripted_effects/*.txt` | Modifies state |
| **Inline Scripts** | `common/inline_scripts/*.txt` | Text substitution |
| **Parameters** | `$PARAM_NAME$` | Substituted at call site |

### variables.py - Variable System

| Scope | Lifetime | Example |
|-------|----------|---------|
| `var:` | Character/Title persistent | `var:murder_count` |
| `local_var:` | Block temporary | `local_var:temp_gold` |
| `global_var:` | Save game persistent | `global_var:mod_enabled` |

**Variable Operations:**
- Effects: `set_variable`, `change_variable`, `clamp_variable`, `round_variable`, `remove_variable`
- Triggers: `has_variable`, comparisons (`var:name >= 10`)
- Lists: `add_to_variable_list`, `remove_list_variable`, `any_in_list`, `every_in_list`

### symbols.py - Document Outline

| Construct | Symbol Kind | Children |
|-----------|-------------|----------|
| Events | `Event` | trigger, immediate, options, after |
| Scripted Effects | `Function` | parameters |
| Scripted Triggers | `Function` | parameters |
| Script Values | `Variable` | - |
| On-Actions | `Event` | - |
| Namespaces | `Namespace` | - |

---

## 🏛️ Complete Module Dependency Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PyChivalry Module Architecture                       │
│                         (TypeScript Implementation)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                     server.ts (Core)                      │          │
│  │          CK3LanguageServer - Main LSP Entry Point         │          │
│  │                                                           │          │
│  │  • 27 LSP feature handlers (didOpen, completion, etc.)   │          │
│  │  • 19 custom commands (validateWorkspace, etc.)          │          │
│  │  • Server state management & coordination                │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│         ┌─────────────┼─────────────┬──────────────────────────┐       │
│         │             │             │                          │       │
│         ▼             ▼             ▼                          ▼       │
│  ┌────────────┐ ┌───────────┐ ┌──────────────┐  ┌──────────────────┐  │
│  │ parser.ts  │ │indexer.ts │ │ck3/language  │  │  diagnostics.ts  │  │
│  │  (Core)    │ │  (Core)   │ │    .ts       │  │     (Core)       │  │
│  ├────────────┤ ├───────────┤ │   (Data)     │  ├──────────────────┤  │
│  │            │ │           │ ├──────────────┤  │                  │  │
│  │• tokenize()│ │• Document │ │              │  │• checkSyntax()   │  │
│  │• parse     │ │  Indexer  │ │• CK3_EFFECTS │  │• check           │  │
│  │  Document()│ │• Symbol   │ │• CK3_TRIGGERS│  │  Semantics()     │  │
│  │• getNode   │ │  tracking │ │• CK3_SCOPES  │  │• checkScopes()   │  │
│  │  AtPos()   │ │• Cross-   │ │• CK3_KEYWORDS│  │                  │  │
│  │            │ │  file refs│ │• Static defs │  │                  │  │
│  │• CK3Node   │ │• Symbol   │ │              │  │                  │  │
│  │• CK3Token  │ │  types    │ │              │  │                  │  │
│  └────────────┘ └───────────┘ └──────────────┘  └─────────┬────────┘  │
│         │             │              │                      │           │
│         │             │              │        ┌─────────────┴────┐      │
│         │             │              │        │                  │      │
│         │             │              │        ▼                  ▼      │
│         │             │              │  ┌────────────┐    ┌──────────┐ │
│         │             │              │  │validation/ │    │validation│ │
│         │             │              │  │ scopes.ts  │    │/events.ts│ │
│         │             │              │  ├────────────┤    ├──────────┤ │
│         │             │              │  │• Scope type│    │• Event   │ │
│         │             │              │  │  system    │    │  struct  │ │
│         │             │              │  │• validate  │    │  valid.  │ │
│         │             │              │  │  ScopeChain│    │• Theme   │ │
│         │             │              │  │• getScope  │    │  checks  │ │
│         │             │              │  │  Links()   │    │• Loc key │ │
│         │             │              │  │            │    │  checks  │ │
│         │             │              │  └────────────┘    └──────────┘ │
│         │             │              │                                  │
│         │             │              │  ┌──────────────────────────┐   │
│         │             │              │  │  Additional Validators   │   │
│         │             │              │  ├──────────────────────────┤   │ 
│         │             │              │  │• validation/lists.ts     │   │
│         │             │              │  │• validation/localization │   │
│         │             │              │  │• validation/script_values│   │
│         │             │              │  │• validation/traits.ts    │   │
│         │             │              │  │• validation/modifiers.ts │   │
│         │             │              │  └──────────────────────────┘   │
│         │             │              │                                  │
│         │             │              │                                  │
│  ┌──────┴─────────────┴──────────────┴────────────────────────────┐   │
│  │                      LSP Feature Modules                        │   │
│  │                 (Depend on Core + Data + Validators)            │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │   │
│  │  │ completions.ts  │  │  hover.ts       │  │ navigation.ts  │ │   │
│  │  │ • Context-aware │  │  • Doc on hover │  │ • Go-to-def    │ │   │
│  │  │   suggestions   │  │  • Effect/trig  │  │ • Find refs    │ │   │
│  │  │ • Trigger chars │  │    docs         │  │ • Cross-file   │ │   │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ │   │
│  │                                                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │   │
│  │  │code-actions.ts  │  │ code-lens.ts    │  │semantic-tokens │ │   │
│  │  │ • Quick fixes   │  │ • Ref counts    │  │     .ts        │ │   │
│  │  │ • Refactorings  │  │ • Inline annot. │  │ • Syntax       │ │   │
│  │  └─────────────────┘  └─────────────────┘  │   highlight    │ │   │
│  │                                             └────────────────┘ │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │   │
│  │  │ formatting.ts   │  │  folding.ts     │  │document-       │ │   │
│  │  │ • Code format   │  │  • Code folding │  │  highlight.ts  │ │   │
│  │  │ • Indentation   │  │  • Regions      │  │ • Symbol       │ │   │
│  │  │ • Paradox style │  │                 │  │   highlight    │ │   │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ │   │
│  │                                                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │   │
│  │  │document-links   │  │  rename.ts      │  │signature-help  │ │   │
│  │  │     .ts         │  │  • Symbol       │  │     .ts        │ │   │
│  │  │ • Clickable     │  │    rename       │  │ • Parameter    │ │   │
│  │  │   file paths    │  │  • Cross-file   │  │   hints        │ │   │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ │   │
│  │                                                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                     │   │
│  │  │ inlay-hints.ts  │  │  symbols.ts     │                     │   │
│  │  │ • Type hints    │  │  • Doc outline  │                     │   │
│  │  │ • Inline annot. │  │  • Symbol tree  │                     │   │
│  │  └─────────────────┘  └─────────────────┘                     │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    workspace.ts (Support)                       │   │
│  │  • Workspace-wide validation                                    │   │
│  │  • Cross-file reference checking                                │   │
│  │  • Project refactoring support                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Module Count Summary:                                                  │
│  • Core Infrastructure: 4 modules (server, parser, indexer, diag.)     │
│  • LSP Features: 15 modules (completion, hover, navigation, etc.)      │
│  • CK3 Domain Logic: 2 modules (ck3/language, scopes)                  │
│  • Domain Validators: 8 modules (events, lists, localization, etc.)    │
│  • Support: Data loader, workspace manager                             │
│  ─────────────────────────────────────────────────────────────────      │
│  Total: ~27 TypeScript modules                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
| `ck3_language.py` | Data | Language definitions & constants | - |
| `scopes.py` | CK3 Logic | Scope type system & validation | ck3_language |
| `completions.py` | LSP Feature | Context-aware auto-completion | parser, indexer, ck3_language |
| `hover.py` | LSP Feature | Documentation on hover | indexer, ck3_language |
| `navigation.py` | LSP Feature | Go-to-def, find references | indexer |
| `code_actions.py` | LSP Feature | Quick fixes, refactorings | parser, indexer |
| `code_lens.py` | LSP Feature | Inline annotations | indexer |
| `semantic_tokens.py` | LSP Feature | Syntax highlighting | parser, ck3_language |
| `formatting.py` | LSP Feature | Code formatting | parser |
| `folding.py` | LSP Feature | Code folding ranges | parser |
| `document_highlight.py` | LSP Feature | Symbol highlighting | parser |
| `document_links.py` | LSP Feature | Clickable file links | - |
| `rename.py` | LSP Feature | Symbol renaming | parser, indexer |
| `signature_help.py` | LSP Feature | Parameter hints | parser, ck3_language |
| `inlay_hints.py` | LSP Feature | Inline type hints | parser, scopes |
| `symbols.py` | LSP Feature | Document outline | parser |
| `events.py` | Domain Validator | Event validation | parser, indexer |
| `lists.py` | Domain Validator | List iterator validation | parser, scopes |
| `localization.py` | Domain Validator | Localization validation | indexer |
| `script_values.py` | Domain Validator | Script value validation | parser |
| `scripted_blocks.py` | Domain Validator | Scripted blocks validation | parser, indexer |
| `variables.py` | Domain Validator | Variable system validation | parser |
| `style_checks.py` | Validator | Code style checks | parser |
| `paradox_checks.py` | Validator | Best practices validation | parser, scopes |
| `scope_timing.py` | Validator | Performance analysis | parser, scopes |
| `workspace.py` | Support | Workspace operations | indexer |
| `data/__init__.py` | Support | Package data management | - |
