# Pychivalry Architecture & Module Interaction Flow

## System Overview

Pychivalry is a Language Server Protocol (LSP) implementation for Crusader Kings 3's Jomini scripting language. It provides IDE-like features (completion, validation, navigation, etc.) by understanding CK3's unique syntax and semantics.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Editor (VS Code, etc.)                   │
│                     Sends LSP requests via JSON-RPC              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ JSON-RPC over stdin/stdout
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                        server.py (Main Hub)                      │
│  - Receives LSP requests                                         │
│  - Routes to appropriate handlers                                │
│  - Manages document lifecycle                                    │
│  - Coordinates between modules                                   │
└──────┬─────────┬─────────┬──────────┬──────────┬───────────┬───┘
       │         │         │          │          │           │
       │         │         │          │          │           │
   ┌───▼───┐ ┌──▼───┐ ┌───▼────┐ ┌──▼────┐ ┌───▼────┐ ┌───▼────┐
   │Parser │ │Index │ │Diagno- │ │Comple-│ │ Hover  │ │ More   │
   │       │ │      │ │stics   │ │tions  │ │        │ │Features│
   └───┬───┘ └──┬───┘ └───┬────┘ └──┬────┘ └───┬────┘ └───┬────┘
       │         │         │          │          │           │
       └─────────┴─────────┴──────────┴──────────┴───────────┘
                             │
                   ┌─────────▼──────────┐
                   │  Supporting Layer  │
                   │  - scopes.py       │
                   │  - lists.py        │
                   │  - variables.py    │
                   │  - events.py       │
                   │  - data loader     │
                   └────────────────────┘
```

## Module Categorization and Roles

### 1. FOUNDATION LAYER (Infrastructure)

#### `__init__.py` (139 lines)
**Role**: Package entry point and metadata
**Purpose**: Defines package version, exports, and high-level documentation
**Status**: ✅ Documented
**Interactions**: Imported by all modules for version info

#### `data/__init__.py` (659 lines)
**Role**: Game data loader
**Purpose**: Loads CK3 definitions (scopes, effects, triggers) from YAML files
**Status**: ✅ Documented
**Interactions**:
- Called by: `scopes.py`, `ck3_language.py`, validation modules
- Provides: Cached game definition data
- Performance: Caching layer prevents repeated file I/O

#### `parser.py` (568 lines)
**Role**: Lexical and syntactic analysis
**Purpose**: Converts CK3 script text → Abstract Syntax Tree (AST)
**Status**: ✅ Documented (partial)
**Interactions**:
- Called by: `server.py`, all analysis modules
- Uses: Regular expressions, position tracking
- Produces: `CK3Node` tree structure with LSP positions
- Critical Path: Every feature depends on this

### 2. CORE VALIDATION LAYER

#### `scopes.py` (657 lines)
**Role**: Scope system validation
**Purpose**: Validates scope types, links, and transformations
**Status**: ✅ Documented
**Interactions**:
- Called by: `diagnostics.py`, `completions.py`, `semantic_tokens.py`
- Uses: `data/__init__.py` for scope definitions
- Validates: `character.liege.primary_title` chains
- Critical for: Context-aware validation and completions

#### `lists.py` (862 lines)
**Role**: List iterator validation
**Purpose**: Validates `any_`, `every_`, `random_`, `ordered_` patterns
**Status**: ✅ Documented
**Interactions**:
- Called by: `diagnostics.py`, `completions.py`
- Uses: `scopes.py` for scope-specific list bases
- Validates: Iterator parameters and block contents

#### `variables.py` (421 lines)
**Role**: Variable system validation
**Purpose**: Validates `var:`, `local_var:`, `global_var:` usage
**Status**: ⏳ Needs documentation
**Interactions**:
- Called by: `diagnostics.py`, `completions.py`
- Tracks: Variable declarations and usage
- Validates: Variable operations and scopes

#### `script_values.py` (381 lines)
**Role**: Formula and range validation
**Purpose**: Validates script value calculations and ranges
**Status**: ⏳ Needs documentation
**Interactions**:
- Called by: `diagnostics.py`
- Validates: Mathematical formulas, conditional logic
- Checks: Operation validity, range bounds

#### `events.py` (451 lines)
**Role**: Event structure validation
**Purpose**: Validates event definitions (character_event, letter_event, etc.)
**Status**: ⏳ Needs documentation
**Interactions**:
- Called by: `diagnostics.py`
- Validates: Event types, required fields, portrait configurations
- Checks: Option structures, theme validity

#### `scripted_blocks.py` (399 lines)
**Role**: Scripted trigger/effect validation
**Purpose**: Validates custom scripted triggers and effects
**Status**: ⏳ Needs documentation
**Interactions**:
- Called by: `diagnostics.py`, `completions.py`
- Uses: `indexer.py` to find definitions
- Validates: Parameter passing, scope contexts

### 3. LANGUAGE SERVER PROTOCOL LAYER

#### `server.py` (3,212 lines) ⚠️ LARGEST FILE
**Role**: Main LSP server implementation
**Purpose**: Central hub that receives and routes LSP requests
**Status**: ⏳ Needs documentation
**Key Responsibilities**:
1. Document lifecycle management (open, change, close, save)
2. Request routing to appropriate handlers
3. Response formatting for LSP compliance
4. Workspace management
5. Configuration handling

**Critical Interactions**:
```
Editor Request → server.py → Feature Module → server.py → Editor Response

Example Flow (Completion):
1. Editor: textDocument/completion request
2. server.py: Parse request, get document
3. completions.py: Generate suggestions
4. server.py: Format LSP response
5. Editor: Display suggestions
```

**Handlers** (examples):
- `@server.feature(TEXT_DOCUMENT_COMPLETION)` → `completions.py`
- `@server.feature(TEXT_DOCUMENT_HOVER)` → `hover.py`
- `@server.feature(TEXT_DOCUMENT_DIAGNOSTIC)` → `diagnostics.py`

#### `workspace.py` (439 lines)
**Role**: Multi-folder workspace management
**Purpose**: Manages multiple workspace folders and their documents
**Status**: ⏳ Needs documentation
**Interactions**:
- Called by: `server.py`
- Manages: Document collection across folders
- Provides: Workspace-wide symbol lookup

### 4. FEATURE IMPLEMENTATION LAYER

#### `completions.py` (626 lines)
**Role**: Auto-completion generation
**Purpose**: Context-aware completion suggestions
**Status**: ⏳ Needs documentation
**Decision Flow**:
```
1. Analyze cursor position
2. Determine context (inside trigger?, effect?, scope?)
3. Query relevant validators:
   - scopes.py: Valid scope links
   - lists.py: Valid list iterators
   - ck3_language.py: Valid keywords
4. Filter by context
5. Return suggestions
```

#### `diagnostics.py` (667 lines)
**Role**: Error and warning detection
**Purpose**: Multi-phase validation (syntax → semantics → scopes)
**Status**: ⏳ Needs documentation
**Validation Pipeline**:
```
Phase 1: Syntax (parser.py)
  → Basic structure validity
  
Phase 2: Semantics (ck3_language.py)
  → Effect/trigger validity
  → Parameter correctness
  
Phase 3: Scope Validation (scopes.py)
  → Scope chain validity
  → Context-appropriate commands
  
Phase 4: Specialized (lists.py, events.py, etc.)
  → Domain-specific rules
```

#### `hover.py` (563 lines)
**Role**: Hover information provider
**Purpose**: Shows documentation when hovering over identifiers
**Status**: ⏳ Needs documentation
**Interactions**:
- Uses: `parser.py` to find node at position
- Uses: `ck3_language.py` for effect/trigger docs
- Uses: `scopes.py` for scope information
- Uses: `indexer.py` for event/scripted block definitions

#### `navigation.py` (560 lines)
**Role**: Go-to-definition implementation
**Purpose**: Jumps to definition of events, scripted blocks, etc.
**Status**: ⏳ Needs documentation
**Interactions**:
- Uses: `indexer.py` heavily for symbol lookup
- Uses: `parser.py` for position mapping
- Handles: Events, scripted effects, scripted triggers

#### `semantic_tokens.py` (686 lines)
**Role**: Semantic syntax highlighting
**Purpose**: Rich, context-aware syntax coloring
**Status**: ⏳ Needs documentation
**Token Classification**:
```
1. Parse document → AST
2. Walk AST nodes
3. Classify each token:
   - Keywords (if, trigger, effect)
   - Effects (add_gold, add_trait)
   - Triggers (is_adult, has_trait)
   - Scopes (character, title)
   - Operators (=, >, <)
4. Return token array to editor
```

#### `code_actions.py` (588 lines)
**Role**: Quick fixes and refactoring
**Purpose**: Suggests fixes for diagnostics
**Status**: ⏳ Needs documentation
**Interactions**:
- Triggered by: Diagnostics with fixes
- Generates: Text edits to fix issues
- Examples: Fix typos, add missing fields

#### `code_lens.py` (603 lines)
**Role**: Inline code annotations
**Purpose**: Shows clickable hints in editor
**Status**: ⏳ Needs documentation
**Features**: Reference counts, run commands

#### `formatting.py` (626 lines)
**Role**: Code formatting
**Purpose**: Formats CK3 scripts consistently
**Status**: ⏳ Needs documentation
**Formatting Rules**: Indentation, spacing, alignment

#### `rename.py` (653 lines)
**Role**: Symbol renaming
**Purpose**: Renames symbols across files
**Status**: ⏳ Needs documentation
**Interactions**: Uses `indexer.py` for all references

#### `signature_help.py` (646 lines)
**Role**: Parameter hints
**Purpose**: Shows parameter info while typing
**Status**: ⏳ Needs documentation

#### `inlay_hints.py` (663 lines)
**Role**: Inline type hints
**Purpose**: Shows inferred types/values in editor
**Status**: ⏳ Needs documentation

#### `document_highlight.py` (548 lines)
**Role**: Symbol highlighting
**Purpose**: Highlights all occurrences of symbol under cursor
**Status**: ⏳ Needs documentation

#### `document_links.py` (561 lines)
**Role**: Clickable links
**Purpose**: Detects file paths and makes them clickable
**Status**: ⏳ Needs documentation

#### `symbols.py` (449 lines)
**Role**: Document symbol extraction
**Purpose**: Provides outline/breadcrumb navigation
**Status**: ⏳ Needs documentation

#### `folding.py` (458 lines)
**Role**: Code folding ranges
**Purpose**: Enables collapsing/expanding code blocks
**Status**: ⏳ Needs documentation

### 5. SPECIALIZED VALIDATION LAYER

#### `style_checks.py` (957 lines)
**Role**: Style and convention validation
**Purpose**: Enforces CK3 modding best practices
**Status**: ⏳ Needs documentation
**Checks**: Naming conventions, structure, patterns

#### `paradox_checks.py` (506 lines)
**Role**: Paradox-specific validations
**Purpose**: Checks for common Paradox engine issues
**Status**: ⏳ Needs documentation
**Checks**: Performance patterns, known bugs

#### `scope_timing.py` (444 lines)
**Role**: Performance tracking for scopes
**Purpose**: Monitors scope validation performance
**Status**: ⏳ Needs documentation
**Purpose**: Development/debugging tool

### 6. INDEXING LAYER

#### `indexer.py` (1,184 lines) ⚠️ SECOND LARGEST
**Role**: Cross-document symbol indexing
**Purpose**: Maintains searchable index of all symbols
**Status**: ⏳ Needs documentation
**Critical Responsibilities**:
1. Parses all workspace files
2. Extracts symbol definitions:
   - Events (my_mod.0001)
   - Scripted effects (my_scripted_effect)
   - Scripted triggers (my_scripted_trigger)
   - Localization keys
3. Maintains reverse lookup: name → file/position
4. Provides fast symbol resolution

**Interactions**:
- Called by: `navigation.py`, `hover.py`, `completions.py`
- Uses: `parser.py` for each file
- Critical for: Go-to-definition, hover on events

### 7. LANGUAGE DEFINITIONS LAYER

#### `ck3_language.py` (623 lines)
**Role**: CK3 language definition catalog
**Purpose**: Central registry of CK3 keywords, effects, triggers
**Status**: ⏳ Needs documentation
**Contents**:
- `CK3_KEYWORDS`: Control flow keywords
- `CK3_EFFECTS`: All effect commands
- `CK3_TRIGGERS`: All trigger conditions
- `CK3_SCOPES`: Scope navigation commands
- `CK3_EVENT_TYPES`: Event type identifiers

**Interactions**:
- Used by: Almost every module
- Provides: Quick lookups for validation
- Source: Maintained manually from CK3 documentation

#### `localization.py` (440 lines)
**Role**: Localization key validation
**Purpose**: Validates localization key references
**Status**: ⏳ Needs documentation
**Interactions**:
- Validates: Keys like `my_event.t`, `my_event.desc`
- Checks: Key existence across localization files

## Typical Request Flow Examples

### Example 1: User Types "any_v" and Triggers Completion

```
1. Editor → server.py
   Request: textDocument/completion
   Position: line 5, character 8

2. server.py → parser.py
   Action: Parse document to get AST
   Output: CK3Node tree

3. server.py → parser.py
   Action: Get node at cursor position
   Output: CK3Node (inside trigger block)

4. server.py → completions.py
   Action: get_context_aware_completions()
   Context: Inside trigger, partial text "any_v"

5. completions.py → scopes.py
   Query: get_scope_lists(current_scope)
   Output: ['vassal', 'courtier', 'child', ...]

6. completions.py → lists.py
   Query: Valid list prefixes for triggers
   Output: ['any_'] (not 'every_' in trigger context)

7. completions.py
   Filter: Starts with "any_v"
   Generate: ['any_vassal']

8. server.py → Editor
   Response: LSP CompletionList with suggestions
```

### Example 2: User Saves File, Triggers Diagnostics

```
1. Editor → server.py
   Notification: textDocument/didSave

2. server.py → parser.py
   Action: Parse entire document
   Output: AST with all nodes

3. server.py → diagnostics.py
   Action: collect_all_diagnostics(ast)

4. diagnostics.py → Phase 1: Syntax
   Check: Unclosed braces, invalid syntax
   Output: Syntax errors list

5. diagnostics.py → Phase 2: Semantics
   Check: Unknown effects/triggers via ck3_language.py
   Output: Semantic errors list

6. diagnostics.py → Phase 3: Scope Validation
   Call: scopes.validate_scope_chain()
   Check: Each scope transition validity
   Output: Scope errors list

7. diagnostics.py → Phase 4: Domain Specific
   Call: lists.validate_list_block_content()
   Call: events.validate_event_fields()
   Output: Domain-specific errors

8. diagnostics.py
   Aggregate: Combine all error lists
   Deduplicate: Remove duplicates

9. server.py → Editor
   Notification: textDocument/publishDiagnostics
   Content: All errors and warnings with positions
```

### Example 3: User Hovers Over "add_gold"

```
1. Editor → server.py
   Request: textDocument/hover
   Position: Over "add_gold" identifier

2. server.py → parser.py
   Action: Get node at position
   Output: CK3Node with key="add_gold"

3. server.py → hover.py
   Action: create_hover_response(node)

4. hover.py → ck3_language.py
   Query: Is "add_gold" a known effect?
   Output: Yes, with documentation

5. hover.py → scopes.py
   Query: Valid scopes for "add_gold"
   Output: ['character']

6. hover.py
   Build: Rich markdown hover content
   - Description of effect
   - Valid parameters
   - Usage examples
   - Current scope compatibility

7. server.py → Editor
   Response: LSP Hover with markdown content
```

## Data Flow Summary

### Input Pipeline
```
CK3 Script File
    ↓
parser.py (tokenize + parse)
    ↓
AST (CK3Node tree)
    ↓
[Feature modules analyze AST]
    ↓
LSP Response
    ↓
Editor
```

### Validation Pipeline
```
AST
    ↓
Syntax Check (parser.py)
    ↓
Semantic Check (ck3_language.py)
    ↓
Scope Check (scopes.py)
    ↓
Domain Check (lists.py, events.py, etc.)
    ↓
Diagnostics List
```

### Symbol Resolution Pipeline
```
User Action (go-to-definition)
    ↓
server.py
    ↓
navigation.py
    ↓
indexer.py (symbol lookup)
    ↓
File + Position
    ↓
Editor (jump to location)
```

## Critical Dependencies

### parser.py Dependencies
- **No internal dependencies** (foundation)
- Used by: Everything

### scopes.py Dependencies
- Depends on: `data/__init__.py`
- Used by: `diagnostics.py`, `completions.py`, `semantic_tokens.py`, `hover.py`

### indexer.py Dependencies
- Depends on: `parser.py`, `workspace.py`
- Used by: `navigation.py`, `hover.py`, `completions.py`, `rename.py`

### server.py Dependencies
- Depends on: ALL feature modules
- Orchestrates: Entire system

## Module Documentation Priority

### Critical Path (Must Document First)
1. **server.py** - System hub, routes all requests
2. **indexer.py** - Symbol resolution, used by many features
3. **diagnostics.py** - Core validation engine
4. **completions.py** - Most visible user feature

### High Value (Document Next)
5. **semantic_tokens.py** - Visible highlighting
6. **hover.py** - Common user action
7. **navigation.py** - Go-to-definition
8. **ck3_language.py** - Central definitions

### Important Features
9. **code_actions.py** - Quick fixes
10. **formatting.py** - Code formatting
11. **rename.py** - Refactoring
12. **signature_help.py** - Parameter hints

### Specialized Validators
13. **variables.py** - Variable validation
14. **script_values.py** - Formula validation
15. **events.py** - Event validation
16. **scripted_blocks.py** - Scripted block validation

### Supporting Features
17. **style_checks.py** - Style validation
18. **paradox_checks.py** - Engine-specific checks
19. **document_links.py** - Link detection
20. **symbols.py** - Symbol extraction
21. **folding.py** - Code folding
22. **inlay_hints.py** - Inline hints
23. **document_highlight.py** - Symbol highlighting
24. **code_lens.py** - Code lens
25. **localization.py** - Localization validation
26. **workspace.py** - Workspace management
27. **scope_timing.py** - Performance monitoring

## Key Architectural Patterns

### 1. Cached Data Loading
- **Pattern**: Load once, cache, reuse
- **Modules**: `data/__init__.py`, `indexer.py`
- **Benefit**: 50ms → <1ms performance improvement

### 2. Multi-Phase Validation
- **Pattern**: Syntax → Semantics → Domain
- **Module**: `diagnostics.py`
- **Benefit**: Clear error categories, maintainable

### 3. Position Tracking
- **Pattern**: Every AST node has LSP Range
- **Modules**: `parser.py`, all feature modules
- **Benefit**: Precise cursor-based operations

### 4. Scope Context Awareness
- **Pattern**: Track scope type through tree
- **Modules**: `scopes.py`, `parser.py`
- **Benefit**: Context-aware completions/validation

### 5. Decorator-Based Routing
- **Pattern**: `@server.feature()` decorators
- **Module**: `server.py`
- **Benefit**: Clean LSP request routing

## Performance Considerations

### Hot Paths (Optimize First)
1. `parser.py`: Called on every keystroke
2. `completions.py`: Called frequently
3. `diagnostics.py`: Called on save/change
4. `semantic_tokens.py`: Called on every change

### Cold Paths (Less Critical)
1. `rename.py`: Infrequent operation
2. `navigation.py`: User-initiated only
3. `indexer.py`: Background/on-open only

## Testing Strategy

### Unit Tests
- Each validator module independently
- `scopes.py`, `lists.py`, `variables.py`, etc.

### Integration Tests
- `server.py` with mocked LSP client
- End-to-end feature flows

### Performance Tests
- Parse large files (>5000 lines)
- Index large workspaces (>1000 files)
- Completion response time (<100ms target)

## Documentation Status

✅ **Completed (5 files)**:
- `__init__.py`
- `data/__init__.py`
- `scopes.py`
- `parser.py` (partial)
- `lists.py`

⏳ **Remaining (27 files)**:
- All others listed above

## References

- LSP Specification: https://microsoft.github.io/language-server-protocol/
- pygls Documentation: https://pygls.readthedocs.io/
- CK3 Modding Wiki: https://ck3.paradoxwikis.com/Modding

Last Updated: 2026-01-01
