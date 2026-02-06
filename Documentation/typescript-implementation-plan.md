# TypeScript Implementation Plan - Full Feature Parity

## Executive Summary

The current TypeScript implementation (4,000 lines) is a **functional skeleton** but lacks ~35,000 lines of critical functionality from the Python implementation (45,368 lines). This document outlines the complete implementation plan to achieve **true one-to-one feature parity**.

## Current State Analysis

### What's Implemented (✅ Basic Versions)

1. **Core Infrastructure** (~2,000 lines vs 6,040 lines Python)
   - ✅ Basic CK3 parser (tokenizer + AST)
   - ✅ Basic document indexer  
   - ✅ Basic workspace manager
   - ✅ Schema loader (skeleton only)
   - ❌ Missing: Incremental parser, full indexer, workspace analysis

2. **LSP Features** (~1,700 lines vs 10,275 lines Python)
   - ✅ 16 LSP features with basic implementations
   - ✅ 19 custom commands (stubs only)
   - ❌ Missing: Deep implementations, context-awareness, caching

3. **CK3 Language** (~400 lines vs 14,000+ lines Python)
   - ✅ 40 hardcoded effects/triggers
   - ❌ Missing: All validation, scope system, event validation

### What's Missing (❌ Not Implemented)

1. **CK3 Validation** (0 lines vs 13,694 lines Python)
   - ❌ Scope validation (1,500 lines)
   - ❌ Scope timing validation (800 lines)
   - ❌ Event validation (900 lines)
   - ❌ List iterator validation (1,200 lines)
   - ❌ Paradox convention checks (1,800 lines)
   - ❌ Generic rules validation (800 lines)
   - ❌ Style checks (600 lines)
   - ❌ Asset validation (900 lines)
   - ❌ Multi-phase diagnostics pipeline (2,500 lines)

2. **Schema System** (340 lines vs 1,860 lines Python)
   - ⚠️ Basic loader only
   - ❌ Missing: Validator engine (800 lines)
   - ❌ Missing: Schema completions (200 lines)
   - ❌ Missing: Schema hover (150 lines)
   - ❌ Missing: Schema symbols (110 lines)

3. **Log Integration** (0 lines vs 2,400 lines Python)
   - ❌ Log watcher (1,000 lines)
   - ❌ Log analyzer (800 lines)
   - ❌ Log diagnostics (600 lines)

4. **Data Layer** (0 lines vs 10,000+ lines YAML)
   - ❌ YAML data loading
   - ❌ Effect/trigger definitions from files
   - ❌ Scope definitions from files
   - ❌ Trait definitions from files
   - ❌ Animation definitions from files
   - ❌ On-action definitions from files

## Implementation Plan

### Phase 1: Core Infrastructure Enhancement (Priority: CRITICAL)

#### 1.1 Full Parser Implementation (Est: 800 lines)
**Source:** `pychivalry/core/parser.py` (2,500 lines)

Current: Basic tokenizer + parser (650 lines)
Need to add:
- [ ] Error recovery mechanisms
- [ ] Position tracking for all tokens
- [ ] Comment preservation
- [ ] Operator precedence handling
- [ ] Complex literal parsing (multiline strings, etc.)
- [ ] Parse error collection with detailed messages
- [ ] AST node metadata (scope hints, context)

**Key Functions:**
```typescript
class CK3Node {
  // Add missing properties from Python
  parent?: CK3Node;
  scope_type?: string;
  context?: string;
  metadata?: Record<string, any>;
}

class ParseError {
  message: string;
  range: Range;
  code: string;
  severity: DiagnosticSeverity;
}

function get_node_at_position(ast: ASTNode[], pos: Position): ASTNode | null
function find_parent_block(node: ASTNode, type: string): ASTNode | null
function get_node_path(node: ASTNode): string[]
```

#### 1.2 Incremental Parser (Est: 600 lines)
**Source:** `pychivalry/core/incremental_parser.py` (600 lines)

Currently: Not implemented
Need to add:
- [ ] TextRange class for change tracking
- [ ] NodeInterval tree structure
- [ ] IncrementalParser class
- [ ] Differential reparsing logic
- [ ] Change detection algorithms
- [ ] Node reuse optimization

**Key Classes:**
```typescript
class TextRange {
  start: number;
  end: number;
  text: string;
}

class NodeInterval {
  range: Range;
  node: ASTNode;
  children: NodeInterval[];
}

class IncrementalParser {
  parse_incremental(old_ast: ASTNode[], changes: TextChange[]): ASTNode[]
  find_affected_nodes(changes: TextChange[]): ASTNode[]
  reparse_region(start: number, end: number): ASTNode[]
}
```

#### 1.3 Full Document Indexer (Est: 1,200 lines)
**Source:** `pychivalry/core/indexer.py` (1,500 lines)

Current: Basic symbol table (340 lines)
Need to add:
- [ ] Event indexing with metadata
- [ ] Decision indexing
- [ ] On-action tracking
- [ ] Scripted effect/trigger registry
- [ ] Variable tracking (local, global, scope)
- [ ] Reference counting
- [ ] Cross-file symbol resolution
- [ ] Namespace detection
- [ ] Symbol search with fuzzy matching
- [ ] Dependency graph construction

**Key Methods:**
```typescript
class DocumentIndexer {
  // Add missing functionality
  index_events(ast: ASTNode[]): void
  index_decisions(ast: ASTNode[]): void
  index_on_actions(ast: ASTNode[]): void
  index_scripted_effects(ast: ASTNode[]): void
  index_scripted_triggers(ast: ASTNode[]): void
  index_variables(ast: ASTNode[]): void
  count_references(symbol: string): number
  find_symbol_usages(symbol: string): Location[]
  get_dependency_graph(): DependencyGraph
  search_symbols(query: string, fuzzy: boolean): Symbol[]
}
```

#### 1.4 Workspace Analysis (Est: 1,000 lines)
**Source:** `pychivalry/core/workspace.py` (1,200 lines)

Current: Basic mod discovery (230 lines)
Need to add:
- [ ] ModDescriptor class with full parsing
- [ ] UndefinedReference tracking
- [ ] EventChainLink analysis
- [ ] LocalizationCoverage calculation
- [ ] Decision group validation
- [ ] Dependency resolution
- [ ] Version compatibility checking
- [ ] Orphan detection (unused files, broken links)

**Key Functions:**
```typescript
class ModDescriptor {
  name: string;
  version: string;
  supported_version: string;
  dependencies: string[];
  picture: string;
  tags: string[];
}

function parse_mod_descriptor(content: string): ModDescriptor | null
function find_undefined_scripted_effects(used: Set<string>, defined: Set<string>): string[]
function validate_event_chain(events: Map<string, Event>): EventChainLink[]
function calculate_localization_coverage(keys: Set<string>, defined: Set<string>): LocalizationCoverage
function find_broken_event_chains(events: Map<string, Event>): BrokenChain[]
```

### Phase 2: Data Layer (Priority: HIGH)

#### 2.1 YAML Data Loading (Est: 600 lines)
**Source:** `pychivalry/data/__init__.py` (500+ lines)

Currently: Hardcoded definitions (400 lines)
Need to add:
- [ ] Load effects from `data/effects/*.yaml`
- [ ] Load triggers from `data/triggers/*.yaml`
- [ ] Load scopes from `data/scopes/*.yaml`
- [ ] Load traits from `data/traits/*.yaml`
- [ ] Load animations from `data/animations.yaml`
- [ ] Load on-actions from `data/on_actions.yaml`
- [ ] Load diagnostics from `data/diagnostics.yaml`
- [ ] Cache loaded data
- [ ] Hot-reload on file changes

**Key Functions:**
```typescript
function load_effects(): Map<string, EffectDefinition>
function load_triggers(): Map<string, TriggerDefinition>
function load_scopes(): Map<string, ScopeDefinition>
function load_traits(): Map<string, TraitDefinition>
function load_animations(): Set<string>
function load_on_actions(): Map<string, OnActionDefinition>
function load_diagnostics(): Map<string, DiagnosticDefinition>
function reload_all_data(): void
```

#### 2.2 Effect/Trigger Definitions (Est: 400 lines)
**Source:** `pychivalry/ck3/effect_trigger_docs.py` (400 lines)

Currently: Hardcoded 40 items
Need to add:
- [ ] Load 500+ effects from YAML
- [ ] Load 400+ triggers from YAML
- [ ] Parse documentation strings
- [ ] Parameter type information
- [ ] Scope requirements
- [ ] Return type information
- [ ] Usage examples

### Phase 3: CK3 Validation System (Priority: CRITICAL)

#### 3.1 Diagnostics Engine (Est: 2,000 lines)
**Source:** `pychivalry/ck3/validation/diagnostics.py` (2,500 lines)

Currently: Basic parse errors (70 lines)
Need to add:
- [ ] Multi-phase validation pipeline
- [ ] DiagnosticConfig class
- [ ] create_diagnostic() with full formatting
- [ ] parse_errors_to_diagnostics()
- [ ] check_syntax() - comprehensive (120 lines)
- [ ] check_semantics() - deep validation (280 lines)
- [ ] check_scopes() - scope validation (90 lines)
- [ ] collect_all_diagnostics() - orchestrator (170 lines)
- [ ] collect_missing_localization_diagnostics()
- [ ] collect_orphaned_localization_diagnostics()
- [ ] collect_scope_type_diagnostics()
- [ ] Diagnostic caching and invalidation

#### 3.2 Scope System (Est: 1,200 lines)
**Source:** `pychivalry/ck3/validation/scopes.py` (1,500 lines)

Currently: Not implemented
Need to add:
- [ ] get_scope_links() - valid transitions
- [ ] get_scope_lists() - iterator bases
- [ ] validate_scope_chain() - chain validation
- [ ] get_scope_result_type() - result type inference
- [ ] is_valid_effect() - effect scope checking
- [ ] is_valid_trigger() - trigger scope checking
- [ ] Scope type tracking through AST
- [ ] Scope chain resolution
- [ ] Universal scope link handling

**Key Functions:**
```typescript
function get_scope_links(scope_type: string): string[]
function get_scope_lists(scope_type: string): string[]
function validate_scope_chain(chain: string, start_scope: string): [boolean, string]
function get_scope_result_type(chain: string, start_scope: string): string | null
function is_valid_effect(effect: string, scope_type: string): boolean
function is_valid_trigger(trigger: string, scope_type: string): boolean
```

#### 3.3 Scope Timing Validation (Est: 700 lines)
**Source:** `pychivalry/ck3/validation/scope_timing.py` (800 lines)

Currently: Not implemented
Need to add:
- [ ] Golden Rule validation
- [ ] Timing constraint checking
- [ ] Variable initialization order validation
- [ ] Scope persistence validation
- [ ] before/after timing checks
- [ ] Scope validity window tracking

#### 3.4 Event Validation (Est: 800 lines)
**Source:** `pychivalry/ck3/validation/events.py` (900 lines)

Currently: Not implemented
Need to add:
- [ ] Event class with full properties
- [ ] validate_event_fields() - structure validation
- [ ] validate_portrait_configuration()
- [ ] parse_event_id() - namespace/id extraction
- [ ] validate_dynamic_description()
- [ ] validate_option() - option structure
- [ ] Event theme validation (40+ themes)
- [ ] Animation validation (60+ animations)
- [ ] Event type validation
- [ ] Localization key checking

#### 3.5 List Iterator Validation (Est: 1,000 lines)
**Source:** `pychivalry/ck3/validation/lists.py` (1,200 lines)

Currently: Not implemented
Need to add:
- [ ] ListIteratorInfo class
- [ ] parse_list_iterator() - parse any_*/every_*/etc
- [ ] validate_list_block_content() - validate list structure
- [ ] get_list_result_scope() - determine result scope
- [ ] is_valid_list_base() - validate base name
- [ ] is_list_iterator() - detection
- [ ] get_supported_parameters() - parameter validation
- [ ] is_valid_list_parameter()

#### 3.6 Paradox Convention Checks (Est: 1,500 lines)
**Source:** `pychivalry/ck3/validation/paradox_checks.py` (1,800 lines)

Currently: Not implemented
Need to add:
- [ ] ParadoxConfig class
- [ ] check_effect_in_trigger_context() - misplaced effects
- [ ] check_list_iterator_misuse() - iterator validation
- [ ] check_opinion_modifiers() - opinion validation
- [ ] check_event_structure() - event conventions
- [ ] check_redundant_triggers() - redundancy detection
- [ ] check_common_gotchas() - common errors
- [ ] check_event_type_valid()
- [ ] check_event_has_desc()
- [ ] check_option_has_name()
- [ ] check_triggered_desc_structure()
- [ ] check_portrait_position()

#### 3.7 Generic Rules Validation (Est: 700 lines)
**Source:** `pychivalry/ck3/validation/generic_rules_validator.py` (800 lines)

Currently: Not implemented
Need to add:
- [ ] Load rules from `data/schemas/generic_rules.yaml`
- [ ] Rule-based validation engine
- [ ] Context-aware rule checking
- [ ] Effect/trigger usage rules
- [ ] Redundant check detection
- [ ] Iterator usage rules

#### 3.8 Style Checks (Est: 500 lines)
**Source:** `pychivalry/ck3/validation/style_checks.py` (600 lines)

Currently: Not implemented
Need to add:
- [ ] Code formatting validation
- [ ] Naming convention checking
- [ ] Indentation validation
- [ ] Brace style checking
- [ ] Whitespace rules

#### 3.9 Asset Validation (Est: 800 lines)
**Source:** `pychivalry/ck3/validation/asset_validation.py` (900 lines)

Currently: Not implemented
Need to add:
- [ ] AssetConfig class
- [ ] Graphics reference checking
- [ ] Sound reference checking
- [ ] Music event validation
- [ ] Path resolution
- [ ] File existence checking
- [ ] create_asset_diagnostic()
- [ ] check_graphics_references()
- [ ] check_sound_references()
- [ ] check_music_event_paths()

#### 3.10 Additional Validators (Est: 800 lines)

**block_validator.py** (200 lines)
- [ ] validate_block_semantics()
- [ ] Nested block validation

**scripted_blocks.py** (500 lines)
- [ ] Scripted effect validation
- [ ] Scripted trigger validation

**variables.py** (600 lines)
- [ ] Variable declaration validation
- [ ] Variable usage tracking

**traits.py** (400 lines)
- [ ] Trait reference validation

**story_cycles.py** (600 lines)
- [ ] Story cycle validation

### Phase 4: Schema System Enhancement (Priority: HIGH)

#### 4.1 Schema Validator (Est: 700 lines)
**Source:** `pychivalry/schema/validator.py` (800 lines)

Current: Basic skeleton
Need to add:
- [ ] SchemaValidator class with full validation
- [ ] Required field checking (with conditions)
- [ ] Type validation (string, number, boolean, block, etc.)
- [ ] Cardinality validation (min/max occurrences)
- [ ] Cross-field validation
- [ ] Conditional requirements
- [ ] Field order validation
- [ ] Value constraint checking (enum, regex, range)
- [ ] Nested schema validation
- [ ] _validate_block() - 100+ lines
- [ ] _validate_field() - 80+ lines
- [ ] _check_required_fields() - 60+ lines
- [ ] _evaluate_condition() - 40+ lines

#### 4.2 Schema Completions (Est: 180 lines)
**Source:** `pychivalry/schema/completions.py` (200 lines)

Currently: Not implemented
Need to add:
- [ ] SchemaCompletionProvider class
- [ ] Schema-driven completion items
- [ ] Field name completions
- [ ] Value completions from enum
- [ ] Nested block templates
- [ ] Context-aware filtering

#### 4.3 Schema Hover (Est: 130 lines)
**Source:** `pychivalry/schema/hover.py` (150 lines)

Currently: Not implemented
Need to add:
- [ ] SchemaHoverProvider class
- [ ] Field documentation from schema
- [ ] Type information display
- [ ] Value constraint display
- [ ] Example values

#### 4.4 Schema Symbols (Est: 100 lines)
**Source:** `pychivalry/schema/symbols.py` (110 lines)

Currently: Not implemented
Need to add:
- [ ] SchemaSymbol class
- [ ] SchemaSymbolExtractor
- [ ] Schema-based symbol hierarchy

### Phase 5: LSP Feature Enhancement (Priority: MEDIUM)

#### 5.1 Advanced Completions (Est: 600 lines)
**Source:** `pychivalry/lsp/completions.py` (1,800 lines)

Current: Basic (300 lines)
Need to add:
- [ ] CompletionContext detection (90 lines from Python)
- [ ] Context-aware filtering (60 lines)
- [ ] Scope link completions (50 lines)
- [ ] Saved scope completions (40 lines)
- [ ] Trait completions with search (150 lines)
- [ ] Snippet templates (100 lines)
- [ ] Caching with invalidation (50 lines)
- [ ] Fuzzy matching (40 lines)
- [ ] Ranking and sorting (40 lines)

#### 5.2 Enhanced Code Actions (Est: 400 lines)
**Source:** `pychivalry/lsp/code_actions.py` (600 lines)

Current: Basic (100 lines)
Need to add:
- [ ] calculate_levenshtein_distance()
- [ ] find_similar_keywords() - did you mean
- [ ] create_did_you_mean_action()
- [ ] create_fix_scope_chain_action()
- [ ] extract_selection_as_scripted_effect()
- [ ] extract_selection_as_scripted_trigger()
- [ ] generate_localization_key_action()
- [ ] get_refactoring_actions()

#### 5.3 Enhanced Code Lens (Est: 500 lines)
**Source:** `pychivalry/lsp/code_lens.py` (700 lines)

Current: Basic (70 lines)
Need to add:
- [ ] CodeLensData class with metadata
- [ ] _find_namespace_lenses() - namespace metrics
- [ ] _find_event_lenses() - event analysis
- [ ] _find_scripted_effect_lenses() - usage counting
- [ ] _find_scripted_trigger_lenses()
- [ ] _analyze_event() - complexity metrics
- [ ] Reference counting integration
- [ ] resolve_code_lens() with actual data

#### 5.4 Enhanced Hover (Est: 200 lines)
**Source:** `pychivalry/lsp/hover.py` (400 lines)

Current: Basic (80 lines)
Need to add:
- [ ] Full effect/trigger documentation
- [ ] Scope documentation with examples
- [ ] Parameter documentation
- [ ] Return type information
- [ ] Usage examples
- [ ] Related links

#### 5.5 Enhanced Navigation (Est: 300 lines)
**Source:** `pychivalry/lsp/navigation.py` (500 lines)

Current: Basic (90 lines)
Need to add:
- [ ] DefinitionLocation with context
- [ ] Cross-file symbol resolution
- [ ] Event chain navigation
- [ ] Scripted effect/trigger navigation
- [ ] Variable definition tracking
- [ ] Reference counting

#### 5.6 Enhanced Symbols (Est: 250 lines)
**Source:** `pychivalry/lsp/symbols.py` (400 lines)

Current: Basic (70 lines)
Need to add:
- [ ] DocumentSymbol with rich metadata
- [ ] Hierarchical symbol tree
- [ ] Event symbol extraction
- [ ] Decision symbol extraction
- [ ] Namespace detection
- [ ] Symbol categorization

#### 5.7 Enhanced Semantic Tokens (Est: 400 lines)
**Source:** `pychivalry/lsp/semantic_tokens.py` (600 lines)

Current: Basic (120 lines)
Need to add:
- [ ] Context-aware token types
- [ ] Scope-based coloring
- [ ] Variable type detection
- [ ] Reference highlighting
- [ ] Error token marking

#### 5.8 Enhanced Inlay Hints (Est: 600 lines)
**Source:** `pychivalry/lsp/inlay_hints.py` (800 lines)

Current: Basic (170 lines)
Need to add:
- [ ] InlayHintConfig
- [ ] Scope type hints at transitions
- [ ] Variable type hints
- [ ] Parameter name hints
- [ ] Return type hints
- [ ] resolve_inlay_hint() with details

#### 5.9 Enhanced Signature Help (Est: 250 lines)
**Source:** `pychivalry/lsp/signature_help.py` (400 lines)

Current: Basic (135 lines)
Need to add:
- [ ] Context-aware signatures
- [ ] Parameter documentation
- [ ] Parameter type information
- [ ] Active parameter tracking
- [ ] Overload support

### Phase 6: Log Integration (Priority: LOW)

#### 6.1 Log Watcher (Est: 900 lines)
**Source:** `pychivalry/log/watcher.py` (1,000 lines)

Currently: Not implemented
Need to add:
- [ ] CK3LogWatcher class
- [ ] detect_ck3_log_path() - auto-detection
- [ ] File watching with fs.watch
- [ ] Real-time parsing
- [ ] Pattern detection
- [ ] Error extraction
- [ ] Statistics tracking

#### 6.2 Log Analyzer (Est: 700 lines)
**Source:** `pychivalry/log/analyzer.py` (800 lines)

Currently: Not implemented
Need to add:
- [ ] CK3LogAnalyzer class
- [ ] Error pattern matching (regex)
- [ ] Warning detection
- [ ] Performance issue detection
- [ ] Statistics generation
- [ ] Trend analysis

#### 6.3 Log Diagnostics (Est: 500 lines)
**Source:** `pychivalry/log/diagnostics.py` (600 lines)

Currently: Not implemented
Need to add:
- [ ] LogDiagnosticConverter class
- [ ] Log error to LSP diagnostic mapping
- [ ] Source code correlation
- [ ] Stack trace parsing
- [ ] Quick fix suggestions

### Phase 7: Custom Commands Enhancement (Priority: MEDIUM)

Currently: All 19 commands are stubs returning placeholder data
Need to implement:

1. **ck3.validateWorkspace** - Full workspace validation
2. **ck3.rescanWorkspace** - Complete re-indexing
3. **ck3.getWorkspaceStats** - Real statistics
4. **ck3.generateEventTemplate** - Full template generation
5. **ck3.findOrphanedLocalization** - Actual orphan detection
6. **ck3.showEventChain** - Event chain visualization
7. **ck3.checkDependencies** - Dependency resolution
8. **ck3.showNamespaceEvents** - Full namespace analysis
9. **ck3.generateLocalizationStubs** - Stub generation
10. **ck3.renameEvent** - Workspace edit implementation
11. **All log commands** - Full log integration

## Implementation Estimates

### Total Lines to Implement

| Category | Current | Python Target | To Implement |
|----------|---------|---------------|--------------|
| Core Infrastructure | 2,000 | 6,040 | 4,040 |
| LSP Features | 1,700 | 10,275 | 8,575 |
| CK3 Validation | 0 | 13,694 | 13,694 |
| Schema System | 340 | 1,860 | 1,520 |
| Log Integration | 0 | 2,400 | 2,400 |
| Data Layer | 400 | 1,000 | 600 |
| Server | 600 | 3,912 | 3,312 |
| **TOTAL** | **5,040** | **39,181** | **34,141** |

### Time Estimates (Conservative)

- **Core Infrastructure:** 2-3 weeks
- **Data Layer:** 1 week
- **CK3 Validation:** 6-8 weeks (largest component)
- **Schema System:** 2-3 weeks
- **LSP Enhancement:** 3-4 weeks
- **Log Integration:** 2 weeks
- **Custom Commands:** 1-2 weeks
- **Testing & Polish:** 2-3 weeks

**Total Estimated Time:** 19-28 weeks (4.5-7 months) for full implementation

## Priority Recommendations

### Must Have (Weeks 1-8)
1. Core parser enhancements
2. Data layer (YAML loading)
3. Full indexer
4. Scope system implementation
5. Basic diagnostics pipeline
6. Schema validator

### Should Have (Weeks 9-16)
1. Event validation
2. List iterator validation
3. Paradox convention checks
4. Enhanced completions
5. Enhanced code actions
6. Enhanced code lens

### Nice to Have (Weeks 17-24)
1. Incremental parser
2. Log integration
3. Advanced validators
4. Full custom commands
5. Performance optimization

## Conclusion

The TypeScript implementation is currently at **~12% completion** (5,040 / 39,181 lines). To achieve true feature parity with the Python implementation, we need to implement:

- **34,141 lines of missing functionality**
- **~200 missing functions/classes**
- **Complete validation system** (13,694 lines - 0% done)
- **Full schema system** (1,520 lines - 18% done)
- **Enhanced LSP features** (8,575 lines - 17% done)
- **Log integration** (2,400 lines - 0% done)

This is a substantial engineering effort requiring **4.5-7 months** of focused development to achieve the same level of functionality as the mature Python implementation.
