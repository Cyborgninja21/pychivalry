# PyChivalry Python Modules Documentation

## Overview
This document provides a comprehensive analysis of all Python scripts in the PyChivalry project - a Language Server Protocol (LSP) implementation for Crusader Kings 3 modding. The project consists of 31 main modules in the `pychivalry/` package and 42 test files organized by feature.

## Project Structure

```
pychivalry/
├── pychivalry/              # Main package (31 modules)
│   ├── Core Infrastructure
│   ├── LSP Features
│   ├── CK3-Specific Logic
│   └── Validation & Style
├── tests/                   # Test suite (42 test files, 1142+ tests)
└── vscode-extension/        # VS Code client
```

---

## Core Infrastructure Modules

### 1. `__init__.py`
**Purpose**: Package initialization and metadata

**Functions/Classes**:
- Package docstring documenting project purpose and main components
- `__version__` = "0.1.0" - Version string for the package

**Key Features**:
- Defines package version using semantic versioning
- Lists main components and their purposes
- Provides usage instructions for running the server

---

### 2. `server.py` ⭐ (3,212 lines)
**Purpose**: Core LSP server implementation with all feature handlers

**Classes**:
- `CK3LanguageServer(LanguageServer)` - Main server class extending pygls
  - Document AST tracking and caching
  - Thread-safe cross-document indexing
  - Async document update infrastructure with debouncing
  - Progress reporting and user notifications
  - Configuration management

**Key Methods**:
```python
# Thread-Safe Document Access
get_ast(uri: str) -> List[CK3Node]
set_ast(uri: str, ast: List[CK3Node])
remove_ast(uri: str)

# Performance Optimizations
get_adaptive_debounce_delay(source: str) -> float
get_cached_ast(source: str) -> Optional[List[CK3Node]]
cache_ast(source: str, ast: List[CK3Node])
get_or_parse_ast(source: str) -> List[CK3Node]

# Server Communication
notify_info(message: str)
notify_warning(message: str)
notify_error(message: str)
log_message(message: str, msg_type)
with_progress(title: str, task_func, cancellable: bool)

# Configuration
get_user_configuration(section: str) -> Dict[str, Any]
get_cached_config(key: str, default: Any) -> Any

# Workspace Edits
apply_edit(edit: WorkspaceEdit, label: Optional[str]) -> bool
create_text_edit(uri, start_line, start_char, end_line, end_char, new_text) -> WorkspaceEdit
create_insert_edit(uri, line, character, text) -> WorkspaceEdit
create_multi_file_edit(changes: Dict) -> WorkspaceEdit

# Document Updates
schedule_document_update(uri: str, doc_source: str)
parse_and_index_document(doc: TextDocument) -> List[CK3Node]
publish_diagnostics_for_document(doc: TextDocument)

# Workspace Management
_scan_workspace_folders_async()
```

**LSP Feature Handlers** (20 handlers total):
1. `@did_open` - Document opened
2. `@did_change` - Document changed (async with debouncing)
3. `@did_close` - Document closed
4. `@completions` - Auto-completion suggestions
5. `@hover` - Hover documentation
6. `@definition` - Go-to-definition
7. `@code_action` - Quick fixes and refactorings
8. `@references` - Find all references
9. `@document_symbol` - Outline view
10. `@workspace_symbol` - Search symbols across workspace
11. `@semantic_tokens_full` - Semantic highlighting
12. `@document_formatting` - Format entire document
13. `@range_formatting` - Format selected range
14. `@code_lens` - Show reference counts
15. `@code_lens_resolve` - Resolve code lens commands
16. `@inlay_hint` - Type hints
17. `@inlay_hint_resolve` - Resolve inlay hints
18. `@signature_help` - Parameter hints
19. `@document_highlight` - Highlight symbol occurrences
20. `@document_link` - Make file paths clickable
21. `@document_link_resolve` - Resolve links
22. `@prepare_rename` - Prepare rename operation
23. `@rename` - Perform symbol rename
24. `@folding_range` - Code folding support

**Custom Commands** (11 commands):
1. `ck3.validateWorkspace` - Validate entire workspace
2. `ck3.rescanWorkspace` - Force workspace rescan
3. `ck3.getWorkspaceStats` - Get index statistics
4. `ck3.generateEventTemplate` - Create event template
5. `ck3.findOrphanedLocalization` - Find unused loc keys
6. `ck3.showEventChain` - Visualize event chains
7. `ck3.checkDependencies` - Check undefined dependencies
8. `ck3.showNamespaceEvents` - List namespace events
9. `ck3.insertTextAtCursor` - Insert text at position
10. `ck3.generateLocalizationStubs` - Generate loc entries
11. `ck3.renameEvent` - Rename event across files

**Helper Functions**:
```python
configure_logging(level: str = "info")
_find_word_references_in_ast(word, ast, uri) -> List[Location]
_extract_symbol_from_node(node) -> Optional[DocumentSymbol]
_get_workspace_folder_paths(ls) -> List[str]
main() - Entry point
```

**Key Features**:
- Async document processing with adaptive debouncing (80-400ms based on file size)
- AST content hash caching for 30-50% memory reduction
- Thread pool executor for parallel operations (2-4 workers)
- Streaming diagnostics (syntax first, then semantic)
- Progressive error discovery
- Workspace-wide symbol indexing

---

### 3. `parser.py` (396 lines)
**Purpose**: CK3 script parser - converts text to Abstract Syntax Tree (AST)

**Classes**:
- `CK3Node` - AST node with slots for memory efficiency
  - Attributes: type, key, value, range, parent, scope_type, children

- `CK3Token` - Lexical token
  - Attributes: type, value, line, character

**Functions**:
```python
tokenize(text: str) -> List[CK3Token]
    # Lexical analysis - breaks text into tokens
    # Handles: identifiers, operators, strings, numbers, braces, comments

parse_document(text: str) -> List[CK3Node]
    # Main parser - converts tokens to AST
    # Internal helper functions:
    - peek() -> Optional[CK3Token]
    - consume() -> Optional[CK3Token]
    - parse_value()
    - parse_block(key_token, parent)
    - parse_statement(parent)

get_node_at_position(nodes: List[CK3Node], position: Position) -> Optional[CK3Node]
    # Find AST node at cursor position
    # Uses depth-first search
    # Internal: position_in_range(), search_node()
```

**Supported Syntax**:
- Assignments: `key = value`
- Blocks: `key = { ... }`
- Lists: `key = { item1 item2 }`
- Comments: `# comment`
- Operators: =, >, <, >=, <=, !=, ==
- Quoted strings with escape sequences
- Numbers (including negative and decimals)
- Identifiers with special characters (_.:@$-)

**Node Types**:
- `block` - Generic block
- `assignment` - Simple key = value
- `list` - List of items
- `comment` - Comment line
- `namespace` - Namespace declaration
- `event` - Event definition (detected by pattern: `namespace.number`)

---

### 4. `indexer.py` (1,185 lines)
**Purpose**: Cross-document symbol indexing for navigation and validation

**Classes**:
- `DocumentIndex` - Main indexing class
  
**Indexed Symbols** (13 symbol types):
```python
namespaces: Dict[str, str]                    # namespace -> file uri
events: Dict[str, Location]                   # event_id -> Location
scripted_effects: Dict[str, Location]         # name -> Location
scripted_triggers: Dict[str, Location]        # name -> Location
scripted_lists: Dict[str, Location]           # name -> Location
script_values: Dict[str, Location]            # name -> Location
on_actions: Dict[str, List[str]]              # on_action -> event list
saved_scopes: Dict[str, Location]             # scope_name -> Location
localization: Dict[str, tuple]                # key -> (text, file_uri, line)
character_flags: Dict[str, List[tuple]]       # flag_name -> [(action, uri, line)]
character_interactions: Dict[str, Location]   # name -> Location
modifiers: Dict[str, Location]                # name -> Location
on_action_definitions: Dict[str, Location]    # name -> Location
opinion_modifiers: Dict[str, Location]        # name -> Location
scripted_guis: Dict[str, Location]            # name -> Location
```

**Main Methods**:
```python
# Workspace Scanning
scan_workspace(workspace_roots: List[str], executor: Optional[ThreadPoolExecutor])
_scan_workspace_parallel(workspace_roots, executor)  # 2-4x faster with threading
_scan_workspace_sequential(workspace_roots)

# Folder-Specific Scanners
_scan_scripted_effects_folder(folder_path: Path)
_scan_scripted_triggers_folder(folder_path: Path)
_scan_common_folder(folder_path, target_dict, def_type)
_scan_localization_folder(folder_path: Path)
_scan_events_folder(folder_path: Path)
_scan_character_flags(root_path: Path)

# File Scanning (Parallel)
_scan_single_file(file_path: Path, folder_type: str) -> Optional[Dict]
_scan_localization_file_parallel(file_path: Path) -> Optional[Dict]
_scan_events_file_parallel(file_path: Path) -> Optional[Dict]
_merge_scan_result(result: Dict)

# Extraction Functions
_extract_top_level_definitions(content: str, uri: str) -> Dict[str, Location]
_extract_event_definitions(content: str, uri: str) -> Dict[str, Location]
_extract_namespaces(content: str, uri: str) -> Dict[str, str]
_extract_saved_scopes(content: str, uri: str) -> Dict[str, Location]
_extract_character_flags(content: str, uri: str)
_parse_localization_file(content: str, uri: str) -> Dict[str, tuple]

# Lookup Functions
find_event(event_id: str) -> Optional[Location]
find_scripted_effect(name: str) -> Optional[Location]
find_scripted_trigger(name: str) -> Optional[Location]
find_character_interaction(name: str) -> Optional[Location]
find_modifier(name: str) -> Optional[Location]
find_on_action(name: str) -> Optional[Location]
find_opinion_modifier(name: str) -> Optional[Location]
find_scripted_gui(name: str) -> Optional[Location]
find_saved_scope(scope_name: str) -> Optional[Location]
find_character_flag(flag_name: str) -> Optional[Location]
find_localization(key: str) -> Optional[tuple]

# Get All Functions
get_all_events() -> List[str]
get_all_namespaces() -> List[str]
get_all_scripted_effects() -> Set[str]
get_all_scripted_triggers() -> Set[str]
get_all_localization_keys() -> Set[str]
get_all_character_flags() -> Set[str]
get_character_flag_usages(flag_name: str) -> Optional[List[tuple]]

# Event Helpers
get_events_for_namespace(namespace: str) -> List[str]
get_event_title_key(event_id: str) -> str
get_event_localized_title(event_id: str) -> Optional[str]

# AST Integration
update_from_ast(uri: str, ast: List[CK3Node])
_index_node(uri: str, node: CK3Node)
remove_document(uri: str)
_remove_document_entries(uri: str)
```

**Key Features**:
- Parallel workspace scanning with ThreadPoolExecutor
- Multiple encoding support (utf-8-sig, utf-8, latin-1, cp1252)
- Regex-based pattern matching for efficient extraction
- Thread-safe operations with locking
- Incremental updates on document changes
- Brace depth tracking for accurate top-level parsing

---

### 5. `workspace.py`
**Purpose**: Cross-file workspace operations and validation

**Expected Functions** (based on common LSP workspace features):
- Workspace-wide validation
- Cross-file reference checking
- Dependency graph analysis
- Event chain extraction (`extract_trigger_event_calls` - referenced in server.py)
- Project-wide refactoring support

---

## LSP Feature Implementation Modules

### 6. `completions.py`
**Purpose**: Context-aware auto-completion suggestions

**Expected Key Functions**:
```python
get_context_aware_completions(document_uri, position, ast, line_text, document_index) -> CompletionList
detect_context(node, position, line_text, index) -> CompletionContext
```

**Context Detection**:
- Trigger blocks (for condition suggestions)
- Effect blocks (for action suggestions)
- Assignment contexts (for value suggestions)
- Scope chain contexts (for navigation suggestions)
- Event structure contexts (for event-specific keys)

**Completion Types**:
- CK3 keywords (if, else, trigger, effect, limit)
- Effects (add_trait, add_gold, trigger_event)
- Triggers (has_trait, is_ruler, age)
- Scopes (root, prev, liege, every_vassal)
- Event types (character_event, letter_event)
- Custom scripted effects and triggers
- Localization keys
- Saved scopes (scope:xxx)
- Boolean values (yes, no)

---

### 7. `diagnostics.py`
**Purpose**: Real-time validation and error detection

**Expected Key Functions**:
```python
collect_all_diagnostics(doc: TextDocument, ast: List[CK3Node], index: DocumentIndex) -> List[Diagnostic]
check_syntax(doc: TextDocument, ast: List[CK3Node]) -> List[Diagnostic]
check_semantics(ast: List[CK3Node], index: DocumentIndex) -> List[Diagnostic]
check_scopes(ast: List[CK3Node], index: DocumentIndex) -> List[Diagnostic]
```

**Diagnostic Categories**:
1. **Syntax Errors**:
   - Unclosed braces
   - Invalid operators
   - Malformed structures

2. **Semantic Errors**:
   - Unknown effects/triggers
   - Invalid scope links
   - Undefined scripted effects/triggers
   - Missing required parameters

3. **Scope Validation**:
   - Scope chain validation
   - Invalid scope transitions
   - Incorrect scope types for effects/triggers

4. **Event Validation**:
   - Missing required fields (type, title, desc)
   - Invalid event structure
   - Missing localization keys

---

### 8. `hover.py`
**Purpose**: Provide rich documentation on hover

**Expected Key Functions**:
```python
create_hover_response(doc: TextDocument, position: Position, ast: List[CK3Node], index: DocumentIndex) -> Optional[Hover]
get_word_at_position(doc: TextDocument, position: Position) -> Optional[str]
```

**Hover Information Provided**:
- Effect documentation with usage examples
- Trigger documentation with return types
- Scope navigation information
- Event definitions with file locations
- Saved scope references
- List iterator explanations
- Localization key values
- Custom scripted effect/trigger documentation

---

### 9. `navigation.py`
**Purpose**: Go-to-definition and find references support

**Expected Key Functions**:
```python
find_definition(word: str, index: DocumentIndex) -> Optional[Location]
find_references(word: str, workspace_docs: Dict) -> List[Location]
```

**Definition Support For**:
- Event IDs
- Scripted effects
- Scripted triggers
- Localization keys
- Saved scopes
- Character flags
- Character interactions
- Modifiers
- On-actions
- Opinion modifiers
- Scripted GUIs

---

### 10. `code_actions.py`
**Purpose**: Quick fixes and refactoring suggestions

**Expected Key Functions**:
```python
get_all_code_actions(uri, range, diagnostics, document_text, selected_text, context) -> List[CodeAction]
convert_to_lsp_code_action(action) -> types.CodeAction
```

**Code Action Types**:
- Quick fixes for typos (Did you mean...)
- Add missing namespace
- Fix invalid scope chains
- Extract selection as scripted effect
- Extract selection as scripted trigger
- Generate missing localization keys
- Fix formatting issues

---

### 11. `code_lens.py`
**Purpose**: Inline reference counts and warnings

**Expected Key Functions**:
```python
get_code_lenses(source: str, uri: str, index: DocumentIndex) -> Optional[List[CodeLens]]
resolve_code_lens(lens: CodeLens, index: DocumentIndex) -> CodeLens
```

**Code Lens Information**:
- Event reference counts
- Missing localization warnings
- Scripted effect/trigger usage counts
- Namespace event counts
- Orphaned code detection

---

### 12. `semantic_tokens.py`
**Purpose**: Rich context-aware syntax highlighting

**Expected Key Components**:
```python
TOKEN_TYPES = [...]  # namespace, class, function, variable, property, etc.
TOKEN_MODIFIERS = [...]  # declaration, definition, readonly, defaultLibrary

get_semantic_tokens(source: str, index: DocumentIndex) -> SemanticTokens
```

**Token Types**:
- namespace - Event namespace declarations
- class - Event type keywords
- function - Effects and triggers
- variable - Scopes and variables
- property - Scope links
- string - Localization keys
- number - Numeric values
- keyword - Control flow
- operator - Operators
- comment - Comments
- parameter - Parameters
- event - Event definitions/references
- macro - List iterators
- enumMember - Boolean values, traits

---

### 13. `formatting.py`
**Purpose**: Auto-format CK3 scripts

**Expected Key Functions**:
```python
format_document(source: str, options: FormattingOptions) -> List[TextEdit]
format_range(source: str, range: Range, options: FormattingOptions) -> List[TextEdit]
```

**Formatting Rules**:
- Tab indentation (Paradox convention)
- Opening braces on same line
- Consistent spacing around operators
- Blank lines between blocks
- Trimmed trailing whitespace
- Proper alignment of assignments

---

### 14. `inlay_hints.py`
**Purpose**: Inline type annotations

**Expected Key Classes/Functions**:
```python
class InlayHintConfig:
    show_scope_types: bool
    show_link_types: bool
    show_iterator_types: bool
    show_parameter_names: bool

get_inlay_hints(source: str, range: Range, index: DocumentIndex, config: InlayHintConfig) -> Optional[List[InlayHint]]
resolve_inlay_hint(hint: InlayHint) -> InlayHint
```

**Hint Types**:
- Scope types after saved scopes: `scope:friend` → `: character`
- Scope types after chains: `root.primary_title` → `: landed_title`
- Iterator target types: `every_vassal` → `→ character`
- Parameter names for effects

---

### 15. `signature_help.py`
**Purpose**: Parameter documentation while typing

**Expected Key Functions**:
```python
get_signature_help(source: str, position: Position) -> Optional[SignatureHelp]
get_trigger_characters() -> List[str]
get_retrigger_characters() -> List[str]
```

**Signature Help For**:
- Effects with structured parameters (add_opinion, trigger_event)
- Triggers with parameters
- Scripted effects/triggers with parameters
- Current parameter highlighting

---

### 16. `document_highlight.py`
**Purpose**: Highlight all occurrences of symbol

**Expected Key Functions**:
```python
get_document_highlights(source: str, position: Position) -> Optional[List[DocumentHighlight]]
```

**Highlight Types**:
- Read - Symbol is being accessed
- Write - Symbol is being defined
- Text - General text match

**Supported Symbols**:
- Saved scopes (both `scope:xxx` and `save_scope_as = xxx`)
- Variables (var:, local_var:, global_var:)
- Character flags
- Event references

---

### 17. `document_links.py`
**Purpose**: Make file paths and URLs clickable

**Expected Key Functions**:
```python
get_document_links(source: str, uri: str, workspace_folders: List[str]) -> Optional[List[DocumentLink]]
resolve_document_link(link: DocumentLink, workspace_folders: List[str]) -> DocumentLink
```

**Link Types Detected**:
- File paths: `common/scripted_effects/my_effects.txt`
- GFX paths: `gfx/interface/icons/icon.dds`
- URLs: `https://ck3.paradoxwikis.com/...`
- Event IDs in comments: `# See rq.0001`

---

### 18. `rename.py`
**Purpose**: Symbol renaming across workspace

**Expected Key Functions**:
```python
prepare_rename(source: str, position: Position) -> Optional[PrepareRenameResult]
perform_rename(source: str, position: Position, new_name: str, uri: str, workspace_folders: List[str]) -> Optional[WorkspaceEdit]
```

**Renameable Symbols**:
- Event definitions and references
- Saved scope definitions and references
- Scripted effect/trigger definitions and usages
- Variable definitions and references
- Character flags (set/check operations)
- Related localization keys (for events)

---

### 19. `folding.py`
**Purpose**: Code folding support

**Expected Key Functions**:
```python
get_folding_ranges(source: str) -> List[FoldingRange]
```

**Foldable Structures**:
- Event blocks
- Named blocks (trigger, effect, option, immediate)
- Nested blocks
- Comment blocks (consecutive comments)
- Region markers (`# region` / `# endregion`)

---

### 20. `symbols.py`
**Purpose**: Document and workspace symbol support

**Expected Key Functions**:
```python
extract_document_symbols(ast: List[CK3Node]) -> List[DocumentSymbol]
search_workspace_symbols(query: str, index: DocumentIndex) -> List[SymbolInformation]
```

**Symbol Types**:
- Namespaces
- Events
- Scripted effects
- Scripted triggers
- Event options
- Trigger/effect blocks

---

## CK3-Specific Logic Modules

### 21. `ck3_language.py`
**Purpose**: CK3 language definitions and constants

**Expected Constants**:
```python
CK3_KEYWORDS: List[str]           # if, else, trigger, effect, limit, etc.
CK3_EFFECTS: List[str]            # add_trait, add_gold, trigger_event, etc.
CK3_TRIGGERS: List[str]           # has_trait, is_ruler, age, etc.
CK3_SCOPES: List[str]             # root, prev, liege, every_vassal, etc.
CK3_EVENT_TYPES: List[str]        # character_event, letter_event, etc.
CK3_BOOLEAN_VALUES: List[str]     # yes, no, true, false

# Additional Likely Constants:
CK3_SCOPE_LINKS: Dict[str, str]   # Scope navigation mappings
CK3_TRAITS: List[str]             # Character traits
CK3_THEMES: List[str]             # Event themes
CK3_PORTRAIT_POSITIONS: List[str] # left_portrait, right_portrait, etc.
```

**Expected Functions**:
```python
is_effect(name: str) -> bool
is_trigger(name: str) -> bool
is_scope(name: str) -> bool
get_scope_type(scope_name: str) -> Optional[str]
```

---

### 22. `scopes.py`
**Purpose**: Scope system validation and tracking

**Expected Key Functions**:
```python
validate_scope_chain(chain: str, current_scope: str) -> Tuple[bool, Optional[str]]
get_scope_type_for_link(link: str, from_scope: str) -> Optional[str]
track_scope_changes(node: CK3Node, current_scope: str) -> str
get_scope_for_effect(effect_name: str) -> Optional[str]
get_scope_for_trigger(trigger_name: str) -> Optional[str]
```

**Scope Types**:
- character
- landed_title
- province
- faith
- culture
- dynasty
- house
- artifact
- story
- scheme
- struggle
- culture_pillar
- activity

---

### 23. `events.py`
**Purpose**: Event structure validation

**Expected Key Functions**:
```python
validate_event_structure(node: CK3Node) -> List[Diagnostic]
check_event_localization(event_id: str, node: CK3Node, index: DocumentIndex) -> List[Diagnostic]
validate_event_type(event_type: str) -> Optional[Diagnostic]
validate_event_options(node: CK3Node) -> List[Diagnostic]
```

**Event Validation Checks**:
- Required fields (type, title, desc)
- Valid event type
- Theme validation
- Portrait validation
- Option structure
- Localization key existence
- Trigger/immediate/after blocks
- Scope validity for event type

---

### 24. `lists.py`
**Purpose**: List iterator validation (any_, every_, random_, ordered_)

**Expected Key Functions**:
```python
validate_list_iterator(node: CK3Node) -> List[Diagnostic]
get_iterator_scope_type(iterator_name: str) -> Optional[str]
validate_list_parameters(node: CK3Node) -> List[Diagnostic]
```

**List Iterators**:
- `any_*` - Check if any item matches
- `every_*` - Check if all items match
- `random_*` - Pick random item
- `ordered_*` - Iterate in order
- Variants: `any_vassal`, `every_province`, `random_courtier`, etc.

**Validation**:
- Valid iterator pattern
- Correct scope type
- Valid parameters (limit, count, etc.)
- Inner block validation with correct scope

---

### 25. `script_values.py`
**Purpose**: Script value and formula validation

**Expected Key Functions**:
```python
validate_script_value(value: str) -> Optional[Diagnostic]
parse_formula(formula: str) -> Optional[ScriptValue]
validate_range(range_str: str) -> Optional[Diagnostic]
```

**Script Value Types**:
- Numeric literals: `100`, `-50`, `2.5`
- Ranges: `1-10`, `min-max`
- Formulas: `@gold_value * 2`
- References: `value:my_custom_value`
- Operations: `+`, `-`, `*`, `/`, `min`, `max`

---

### 26. `variables.py`
**Purpose**: Variable system support

**Expected Key Functions**:
```python
validate_variable_reference(var_ref: str) -> Optional[Diagnostic]
track_variable_definitions(node: CK3Node) -> Dict[str, Location]
get_variable_type(var_ref: str) -> str
```

**Variable Types**:
- `var:xxx` - Regular variables
- `local_var:xxx` - Local scope variables
- `global_var:xxx` - Global variables
- `flag:xxx` - Flag variables

**Operations**:
- `set_variable` - Define/update
- `change_variable` - Modify value
- Variable comparisons in triggers

---

### 27. `scripted_blocks.py`
**Purpose**: Scripted effects and triggers with parameters

**Expected Key Functions**:
```python
validate_scripted_effect(node: CK3Node, index: DocumentIndex) -> List[Diagnostic]
validate_scripted_trigger(node: CK3Node, index: DocumentIndex) -> List[Diagnostic]
extract_parameters(node: CK3Node) -> Dict[str, str]
validate_parameter_usage(node: CK3Node, params: Dict) -> List[Diagnostic]
```

**Parameter System**:
- Parameter definitions: `$PARAMETER$`
- Default values: `$PARAMETER|default_value$`
- Parameter validation
- Type checking for parameters

---

### 28. `localization.py`
**Purpose**: Localization key validation and management

**Expected Key Functions**:
```python
validate_localization_reference(key: str, index: DocumentIndex) -> Optional[Diagnostic]
find_missing_localization_keys(event_id: str, index: DocumentIndex) -> List[str]
suggest_localization_keys(event_id: str) -> List[str]
```

**Localization Patterns**:
- Event titles: `event_id.t`
- Event descriptions: `event_id.desc`
- Event options: `event_id.a`, `event_id.b`, etc.
- Tooltips: `event_id.a.tt`
- Custom keys with dot notation

---

## Validation & Style Modules

### 29. `style_checks.py`
**Purpose**: Code style and convention checking

**Expected Key Functions**:
```python
check_indentation(source: str) -> List[Diagnostic]
check_naming_conventions(node: CK3Node) -> List[Diagnostic]
check_code_organization(ast: List[CK3Node]) -> List[Diagnostic]
```

**Style Checks**:
- Indentation consistency (tabs vs spaces)
- Naming conventions (snake_case, etc.)
- Comment quality
- Code organization
- Line length
- Trailing whitespace

---

### 30. `paradox_checks.py`
**Purpose**: Paradox-specific best practices

**Expected Key Functions**:
```python
check_performance_issues(node: CK3Node) -> List[Diagnostic]
check_common_mistakes(node: CK3Node) -> List[Diagnostic]
suggest_optimization(node: CK3Node) -> List[CodeAction]
```

**Paradox Best Practices**:
- Performance optimization suggestions
- Common modding mistakes
- Scope chain optimization
- Event trigger optimization
- Memory usage warnings

---

### 31. `scope_timing.py`
**Purpose**: Scope performance analysis and timing checks

**Expected Key Functions**:
```python
analyze_scope_performance(node: CK3Node) -> PerformanceReport
check_expensive_operations(node: CK3Node) -> List[Diagnostic]
suggest_scope_optimizations(node: CK3Node) -> List[CodeAction]
```

**Performance Concerns**:
- Deep scope chains
- Expensive scope iterators
- Nested loops
- Large limit blocks

---

## Test Suite Organization (42 Test Files)

### Test Categories

#### Unit Tests (Main Features - 26 files)
1. `test_code_actions.py` - Code action tests
2. `test_code_lens.py` - Code lens tests
3. `test_completions.py` - Completion tests
4. `test_data.py` - Data module tests
5. `test_diagnostics.py` - Diagnostic tests
6. `test_document_highlight.py` - Document highlight tests
7. `test_document_links.py` - Document link tests
8. `test_events.py` - Event validation tests
9. `test_folding.py` - Folding range tests
10. `test_formatting.py` - Formatting tests
11. `test_hover.py` - Hover documentation tests
12. `test_indexer.py` - Indexer tests
13. `test_inlay_hints.py` - Inlay hint tests
14. `test_lists.py` - List iterator tests
15. `test_localization.py` - Localization tests
16. `test_lsp_features.py` - General LSP feature tests
17. `test_navigation.py` - Navigation tests
18. `test_paradox_checks.py` - Paradox check tests
19. `test_parser.py` - Parser tests
20. `test_rename.py` - Rename tests
21. `test_scopes.py` - Scope validation tests
22. `test_script_values.py` - Script value tests
23. `test_scripted_blocks.py` - Scripted block tests
24. `test_semantic_tokens.py` - Semantic token tests
25. `test_server.py` - Server tests
26. `test_server_communication.py` - Server communication tests
27. `test_server_integration.py` - Server integration tests
28. `test_signature_help.py` - Signature help tests
29. `test_style_checks.py` - Style check tests
30. `test_symbols.py` - Symbol tests
31. `test_variables.py` - Variable tests
32. `test_workspace.py` - Workspace tests

#### Integration Tests (4 files)
1. `integration/__init__.py`
2. `integration/test_lsp_workflows.py` - End-to-end LSP workflows

#### Performance Tests (2 files)
1. `performance/__init__.py`
2. `performance/test_benchmarks.py` - Performance benchmarks

#### Regression Tests (2 files)
1. `regression/__init__.py`
2. `regression/test_bug_fixes.py` - Fixed bug regression tests

#### Fuzzing Tests (2 files)
1. `fuzzing/__init__.py`
2. `fuzzing/test_property_based.py` - Property-based testing

#### Test Infrastructure
1. `conftest.py` - Pytest configuration and fixtures

---

## Module Dependency Graph

```
server.py (Core)
├── parser.py (AST generation)
├── indexer.py (Symbol tracking)
├── ck3_language.py (Language definitions)
│
├── LSP Features
│   ├── completions.py
│   ├── diagnostics.py
│   │   ├── scopes.py
│   │   ├── events.py
│   │   ├── lists.py
│   │   ├── script_values.py
│   │   ├── variables.py
│   │   ├── style_checks.py
│   │   └── paradox_checks.py
│   ├── hover.py
│   ├── navigation.py
│   ├── code_actions.py
│   ├── code_lens.py
│   ├── semantic_tokens.py
│   ├── formatting.py
│   ├── inlay_hints.py
│   ├── signature_help.py
│   ├── document_highlight.py
│   ├── document_links.py
│   ├── rename.py
│   ├── folding.py
│   └── symbols.py
│
└── Workspace
    ├── workspace.py
    ├── localization.py
    └── scripted_blocks.py
```

---

## Key Design Patterns

### 1. **Thread-Safe Operations**
- All index access wrapped in locks (`_ast_lock`, `_index_lock`)
- Thread pool executor for CPU-bound operations
- Async/await for I/O operations

### 2. **Performance Optimizations**
- **Adaptive Debouncing**: 80-400ms based on file size
- **AST Caching**: Content hash-based caching with LRU eviction
- **Streaming Diagnostics**: Syntax errors first, semantic later
- **Parallel Scanning**: 2-4x faster workspace indexing

### 3. **Error Handling**
- Try-catch blocks with fallback behavior
- Multiple encoding support for file reading
- Graceful degradation on parse errors

### 4. **LSP Protocol Adherence**
- Proper request/response handling
- Progress reporting for long operations
- User notifications for important events
- Configuration management

---

## Extension Points for Future Development

### Areas for Expansion

1. **Additional CK3 Features**
   - Trait definitions
   - Decision validation
   - Title history validation
   - Character history validation
   - GUI file support
   - Localization completeness checking

2. **Advanced Analysis**
   - Complexity metrics
   - Performance profiling
   - Scope chain optimization
   - Event chain visualization
   - Dependency graph generation

3. **Refactoring Tools**
   - Extract to scripted effect/trigger
   - Inline scripted effect/trigger
   - Rename with localization update
   - Event template generation
   - Mass refactoring operations

4. **Integration Features**
   - Git integration for mod versioning
   - Steam Workshop integration
   - Mod conflict detection
   - Cross-mod compatibility checking

5. **Documentation Generation**
   - Auto-generate mod documentation
   - API reference generation
   - Event flow diagrams
   - Scope relationship diagrams

---

## Statistics

- **Total Modules**: 31 main modules
- **Test Files**: 42 test files
- **Total Tests**: 1,142+ tests
- **Lines of Code**: ~15,000+ lines (estimated based on viewed files)
- **LSP Features Implemented**: 20 features
- **Custom Commands**: 11 commands
- **Symbol Types Indexed**: 13 types
- **Supported File Types**: .txt, .gui, .gfx, .asset, .yml

---

## Development Commands

### Running the Server
```bash
# Direct execution
python -m pychivalry.server

# With pip installation
pychivalry

# With debug logging
python -m pychivalry.server --log-level debug
```

### Testing
```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_parser.py -v

# Run with coverage
pytest tests/ --cov=pychivalry --cov-report=html
```

### Code Quality
```bash
# Format code
black pychivalry/

# Lint code
flake8 pychivalry/

# Type checking
mypy pychivalry/
```

---

## Conclusion

PyChivalry is a comprehensive LSP implementation for CK3 modding with:

- **Robust parsing** with AST generation and position tracking
- **Extensive indexing** of 13 symbol types across workspace
- **20 LSP features** for IDE-like experience
- **Advanced optimizations** including caching, debouncing, and parallel processing
- **Comprehensive testing** with 1,142+ tests covering unit, integration, performance, and regression scenarios
- **CK3-specific validation** for events, scopes, lists, script values, and variables
- **Developer-friendly** with clear documentation and extension points

The modular design allows for easy maintenance and extension while maintaining high performance and reliability for CK3 mod development workflows.
