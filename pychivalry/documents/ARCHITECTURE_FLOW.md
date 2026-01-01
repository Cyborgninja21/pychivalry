# PyChivalry Architecture & Analysis Flow

This document illustrates the chain of events and data flow for the CK3 Language Server.

---

## 🏗️ High-Level Architecture

| Layer | Component | Description |
|-------|-----------|-------------|
| **Client** | VS Code / Editor | Sends LSP requests via JSON-RPC over stdin/stdout |
| **Server** | `server.py` | Main entry point - `CK3LanguageServer` class extending pygls `LanguageServer` |
| **State** | Server State | `document_asts`, `DocumentIndex`, thread pool, AST cache, debounce timers |

### Server State Management

| State Object | Type | Purpose |
|--------------|------|---------|
| `document_asts` | `Dict[uri, List[CK3Node]]` | Cached AST per open document |
| `index` | `DocumentIndex` | Cross-file symbol tracking |
| `thread_pool` | `ThreadPoolExecutor` | Async parsing workers |
| `ast_cache` | `Dict[hash, AST]` | Content-hash based cache |
| `pending_updates` | `Dict[uri, Task]` | Debounced update tasks |

---

## 📄 Document Lifecycle

### 1. Document Open (`textDocument/didOpen`)

| Step | Action | Module |
|------|--------|--------|
| 1 | Get document from workspace | `server.py` |
| 2 | Tokenize source text | `parser.py` → `tokenize()` |
| 3 | Build AST | `parser.py` → `parse_document()` |
| 4 | Extract symbols | `indexer.py` → `update_from_ast()` |
| 5 | First open? Scan workspace | `indexer.py` → parallel folder scan |
| 6 | Run diagnostics | `diagnostics.py` → `collect_all_diagnostics()` |
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
| 7 | Parse in thread pool | `get_or_parse_ast()` with cache |
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

| Pipeline Function | Output Codes | Validation Focus |
|-------------------|-------------|------------------|
| `collect_all_diagnostics()` | - | Main orchestrator function |
| `check_syntax()` | CK3001, CK3002 | Brackets, structure validation |
| `check_semantics()` | CK3101-CK3103 | Effects/triggers validation |
| `check_scopes()` | CK3201-CK3203 | Scope chains validation |
| Domain Validators | Various | Module-specific validations (see below) |

### Core Diagnostic Codes

| Code | Module | Description |
|------|--------|-------------|
| CK3001 | `diagnostics.py` | Unmatched closing brace `}` |
| CK3002 | `diagnostics.py` | Unclosed opening brace `{` |
| CK3101 | `diagnostics.py` | Unknown trigger identifier |
| CK3102 | `diagnostics.py` | Effect used in trigger block |
| CK3103 | `diagnostics.py` | Unknown effect identifier |
| CK3201 | `diagnostics.py` | Invalid scope chain |
| CK3202 | `diagnostics.py` | Undefined saved scope reference |
| CK3203 | `diagnostics.py` | Invalid list base for scope |

### Domain-Specific Validators

| Validator Module | Diagnostic Codes | Validation Scope |
|------------------|------------------|------------------|
| `events.py` | EVENT-001 to EVENT-006 | Event types, themes, portraits, options |
| `lists.py` | LIST-001 to LIST-005 | any_, every_, random_, ordered_ iterators |
| `localization.py` | LOC-001 to LOC-006 | Character functions, formatting codes, icons |
| `script_values.py` | VALUE-001 to VALUE-006 | Fixed/range/formula values, conditionals |
| `scripted_blocks.py` | SCRIPT-001 to SCRIPT-006 | Scripted triggers/effects, $PARAM$ syntax |
| `variables.py` | VAR-001 to VAR-006 | var:, local_var:, global_var: references |
| `style_checks.py` | Style warnings | Code style and conventions |
| `paradox_checks.py` | Convention warnings | Paradox-specific conventions |
| `scope_timing.py` | Timing warnings | Scope performance validation |

---

## 💡 Completion System

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
| `server.py` | Main LSP server entry point | `CK3LanguageServer`, `main()` |
| `parser.py` | Tokenization and AST | `CK3Node`, `tokenize()`, `parse_document()` |
| `indexer.py` | Cross-file symbol index | `DocumentIndex`, `update_from_ast()` |
| `diagnostics.py` | Error detection pipeline | `collect_all_diagnostics()`, `check_*()` |

### Language Features

| Module | Purpose | Key Functions/Classes |
|--------|---------|----------------------|
| `completions.py` | Auto-completion | `CompletionContext`, `get_context_aware_completions()` |
| `hover.py` | Hover documentation | `get_hover_info()`, `get_word_at_position()` |
| `semantic_tokens.py` | Syntax highlighting | `analyze_document()`, `encode_tokens()` |
| `navigation.py` | Go-to-definition | `get_definition()`, `find_references()` |
| `symbols.py` | Document outline | `DocumentSymbol`, `extract_document_symbols()` |
| `signature_help.py` | Function signatures | Parameter hints for effects/triggers |
| `code_actions.py` | Quick fixes | Refactoring suggestions |
| `code_lens.py` | Inline annotations | Reference counts, run buttons |
| `folding.py` | Code folding | Block-based fold ranges |
| `formatting.py` | Document formatting | Indentation, spacing |
| `inlay_hints.py` | Inline hints | Parameter name hints |
| `document_highlight.py` | Symbol highlighting | Highlight same symbols |
| `document_links.py` | Clickable links | File references, URLs |
| `rename.py` | Symbol rename | Cross-file rename support |

### Domain Validators

| Module | Purpose | Diagnostic Codes |
|--------|---------|------------------|
| `events.py` | Event validation | EVENT-001 to EVENT-006 |
| `lists.py` | List iterator validation | LIST-001 to LIST-005 |
| `localization.py` | Localization syntax | LOC-001 to LOC-006 |
| `script_values.py` | Script value formulas | VALUE-001 to VALUE-006 |
| `scripted_blocks.py` | Reusable code blocks | SCRIPT-001 to SCRIPT-006 |
| `variables.py` | Variable system | VAR-001 to VAR-006 |
| `style_checks.py` | Style conventions | Style warnings |
| `paradox_checks.py` | Paradox conventions | Convention warnings |
| `scope_timing.py` | Scope timing | Timing validation |

### Data & Support

| Module | Purpose | Contents |
|--------|---------|----------|
| `ck3_language.py` | Static definitions | `CK3_EFFECTS`, `CK3_TRIGGERS`, `CK3_SCOPES`, etc. |
| `scopes.py` | Scope type system | `get_scope_links()`, `validate_scope_chain()` |
| `workspace.py` | Workspace validation | Mod descriptor parsing, cross-file checks |
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

### events.py - Event System Validation

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

| Operation Category | Available Operations |
|-------------------|---------------------|
| **Effects** | `set_variable`, `change_variable`, `clamp_variable`, `round_variable`, `remove_variable` |
| **Triggers** | `has_variable`, comparisons (`var:name >= 10`) |
| **Lists** | `add_to_variable_list`, `remove_list_variable`, `any_in_list`, `every_in_list` |

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

## 🔧 Additional Core Modules

### parser.py - AST Generation

| Component | Type | Purpose |
|-----------|------|---------|
| `CK3Node` | Class | AST node with type, key, value, range, parent, scope_type, children |
| `CK3Token` | Class | Lexical token with type, value, line, character |
| `tokenize()` | Function | Breaks text into lexical tokens |
| `parse_document()` | Function | Converts tokens to Abstract Syntax Tree |
| `get_node_at_position()` | Function | Finds AST node at cursor position |

| Supported Syntax | Examples |
|------------------|----------|
| Assignments | `key = value` |
| Blocks | `key = { ... }` |
| Lists | `key = { item1 item2 }` |
| Comments | `# comment` |
| Operators | `=`, `>`, `<`, `>=`, `<=`, `!=`, `==` |
| Strings | Quoted with escape sequences |
| Numbers | Including negative and decimals |

### completions.py - Context-Aware Suggestions

| Trigger | Context | Completion Source |
|---------|---------|-------------------|
| `_` | Keyword continuation | Effects, triggers, keywords |
| `.` | Scope navigation | Scope links for current scope |
| `:` | Saved scope | Saved scopes from index |
| `=` | Value assignment | Values, blocks |

| Context Type | Available Completions |
|--------------|----------------------|
| Trigger block | CK3 triggers only |
| Effect block | CK3 effects only |
| Option block | Both triggers and effects |
| Unknown | All keywords + snippets |

### navigation.py - Go-To-Definition & References

| Feature | Supported Symbols |
|---------|------------------|
| **Go to Definition** | Event IDs, scripted effects/triggers, localization keys, saved scopes, character flags, modifiers, on-actions |
| **Find References** | All symbol types across workspace |
| **Cross-File** | Full workspace symbol tracking |

### hover.py - Documentation Display

| Hover Information | Source |
|-------------------|--------|
| Effect documentation | `ck3_language.py` definitions |
| Trigger documentation | `ck3_language.py` definitions |
| Event definitions | Document index |
| Scope information | `scopes.py` data |
| Localization values | Localization index |
| Custom definitions | User's scripted effects/triggers |

### ck3_language.py - Language Definitions

| Constant | Contents |
|----------|----------|
| `CK3_EFFECTS` | All CK3 effect keywords |
| `CK3_TRIGGERS` | All CK3 trigger keywords |
| `CK3_SCOPES` | All scope types and iterators |
| `CK3_EVENT_TYPES` | Event type keywords |
| `CK3_KEYWORDS` | Control flow keywords |
| `CK3_BOOLEAN_VALUES` | yes, no, true, false |

### scopes.py - Scope Type System

| Scope Type | Description |
|------------|-------------|
| `character` | Individual characters |
| `landed_title` | Titles and holdings |
| `province` | Map provinces |
| `faith` | Religions |
| `culture` | Cultural groups |
| `dynasty` | Family dynasties |
| `house` | Noble houses |
| `artifact` | Items and artifacts |
| `story` | Story cycles |
| `scheme` | Character schemes |

| Function | Purpose |
|----------|---------|
| `validate_scope_chain()` | Validates scope navigation paths |
| `get_scope_type_for_link()` | Determines resulting scope type |
| `track_scope_changes()` | Tracks scope context through AST |

### code_actions.py - Quick Fixes

| Action Type | Use Case |
|-------------|----------|
| Quick fixes | Typo corrections, Did you mean... |
| Add namespace | Missing namespace declarations |
| Fix scope chains | Invalid scope navigation |
| Extract scripted effect | Selection to reusable code |
| Extract scripted trigger | Selection to reusable condition |
| Generate localization | Create missing loc keys |

### code_lens.py - Inline Annotations

| Code Lens Type | Information Displayed |
|----------------|----------------------|
| Event references | Number of times event is triggered |
| Missing localization | Warning for undefined keys |
| Scripted usage | Usage counts for effects/triggers |
| Namespace stats | Event count per namespace |
| Orphaned code | Unused definitions |

### semantic_tokens.py - Syntax Highlighting

| Token Type | CK3 Usage |
|------------|-----------|
| `namespace` | Event namespace declarations |
| `class` | Event type keywords |
| `function` | Effects and triggers |
| `variable` | Scopes, saved scopes |
| `property` | Scope links |
| `string` | Localization keys |
| `number` | Numeric values |
| `keyword` | Control flow (if, else, limit) |
| `comment` | Comment lines |
| `event` | Event IDs |
| `macro` | List iterators |
| `enumMember` | Boolean values, traits |

### formatting.py - Code Formatting

| Formatting Rule | Convention |
|-----------------|------------|
| Indentation | Tab characters (Paradox standard) |
| Brace placement | Opening brace on same line |
| Operator spacing | Consistent spacing around `=` |
| Block separation | Blank lines between blocks |
| Trailing whitespace | Trimmed |
| Assignment alignment | Aligned for readability |

### folding.py - Code Folding

| Foldable Structure | Description |
|-------------------|-------------|
| Event blocks | Complete event definitions |
| Named blocks | trigger, effect, option, immediate |
| Nested blocks | Any `{ }` structure |
| Comment blocks | Consecutive comment lines |
| Region markers | `# region` / `# endregion` |

### document_highlight.py - Symbol Highlighting

| Highlight Type | Usage |
|----------------|-------|
| Read | Symbol being accessed |
| Write | Symbol being defined |
| Text | General text match |

| Supported Symbols |
|------------------|
| Saved scopes (scope:xxx) |
| Variables (var:, local_var:, global_var:) |
| Character flags |
| Event references |

### document_links.py - Clickable Links

| Link Type | Pattern |
|-----------|---------|
| File paths | `common/scripted_effects/my_effects.txt` |
| GFX paths | `gfx/interface/icons/icon.dds` |
| URLs | `https://ck3.paradoxwikis.com/...` |
| Event IDs | `# See rq.0001` |

### rename.py - Symbol Renaming

| Renameable Symbol | Scope |
|-------------------|-------|
| Events | Definition and all references |
| Saved scopes | Definition and all usages |
| Scripted effects/triggers | Definition and all calls |
| Variables | Definition and all references |
| Character flags | Set/check operations |
| Localization keys | Event-related keys |

### signature_help.py - Parameter Hints

| Feature | Display |
|---------|---------|
| Effect parameters | Structured parameter documentation |
| Trigger parameters | Parameter types and usage |
| Scripted parameters | Custom parameter documentation |
| Active parameter | Highlighted current parameter |

### inlay_hints.py - Inline Type Hints

| Hint Type | Example |
|-----------|---------|
| Scope types | `scope:friend` → `: character` |
| Chain results | `root.primary_title` → `: landed_title` |
| Iterator targets | `every_vassal` → `→ character` |
| Parameter names | Effect parameter labels |

### workspace.py - Workspace Operations

| Feature | Description |
|---------|-------------|
| Workspace validation | Cross-file consistency checks |
| Reference checking | Find undefined dependencies |
| Dependency analysis | Build dependency graphs |
| Event chain extraction | Track event trigger chains |
| Project refactoring | Multi-file changes |

### style_checks.py - Code Style Validation

| Style Check | Focus |
|-------------|-------|
| Indentation | Tab vs space consistency |
| Naming conventions | snake_case enforcement |
| Comment quality | Documentation standards |
| Code organization | Structure and layout |
| Line length | Readability limits |
| Trailing whitespace | Cleanup |

### paradox_checks.py - Best Practices

| Check Type | Purpose |
|------------|---------|
| Performance issues | Expensive operations detection |
| Common mistakes | Typical modding errors |
| Optimization suggestions | Scope chain improvements |
| Event trigger optimization | Efficiency recommendations |
| Memory warnings | Resource usage alerts |

### scope_timing.py - Performance Analysis

| Analysis Type | Detection |
|---------------|-----------|
| Deep scope chains | Excessive navigation depth |
| Expensive iterators | Performance-heavy loops |
| Nested loops | Multiple iteration levels |
| Large limit blocks | Complex condition blocks |

---

## 📊 Complete Module Summary

| Module | Category | Primary Function |
|--------|----------|------------------|
| `__init__.py` | Core | Package initialization |
| `server.py` | Core | LSP server implementation |
| `parser.py` | Core | AST generation and tokenization |
| `indexer.py` | Core | Cross-file symbol indexing |
| `diagnostics.py` | Core | Error detection pipeline |
| `completions.py` | LSP Feature | Auto-completion |
| `hover.py` | LSP Feature | Documentation on hover |
| `navigation.py` | LSP Feature | Go-to-definition, references |
| `code_actions.py` | LSP Feature | Quick fixes and refactoring |
| `code_lens.py` | LSP Feature | Inline annotations |
| `semantic_tokens.py` | LSP Feature | Syntax highlighting |
| `formatting.py` | LSP Feature | Code formatting |
| `folding.py` | LSP Feature | Code folding ranges |
| `document_highlight.py` | LSP Feature | Symbol highlighting |
| `document_links.py` | LSP Feature | Clickable links |
| `rename.py` | LSP Feature | Symbol renaming |
| `signature_help.py` | LSP Feature | Parameter hints |
| `inlay_hints.py` | LSP Feature | Inline type hints |
| `symbols.py` | LSP Feature | Document outline |
| `ck3_language.py` | CK3 Logic | Language definitions |
| `scopes.py` | CK3 Logic | Scope type system |
| `events.py` | Domain Validator | Event validation |
| `lists.py` | Domain Validator | List iterator validation |
| `script_values.py` | Domain Validator | Script value validation |
| `variables.py` | Domain Validator | Variable system |
| `scripted_blocks.py` | Domain Validator | Scripted effects/triggers |
| `localization.py` | Domain Validator | Localization validation |
| `style_checks.py` | Validation | Code style checks |
| `paradox_checks.py` | Validation | Best practices |
| `scope_timing.py` | Validation | Performance analysis |
| `workspace.py` | Support | Workspace operations |
