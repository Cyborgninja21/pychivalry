# pychivalry Language Server — AI Implementation Guide

> **This document is a declarative instruction set for AI agents implementing the CK3/Jomini language server using pygls.**

---

## Design Principles

1. **Separate data from logic** — Language definitions live in `data/` modules, not embedded in feature code
2. **One file per concern** — Parser, diagnostics, completions, hover each get their own module
3. **Data-driven validation** — Load definitions from YAML/JSON so non-developers can contribute
4. **Lazy loading** — Don't load all game data at startup; load on demand

### Module Responsibilities

| Module | Responsibility | Changes When... |
|--------|---------------|-----------------|
| `data/` | Game definitions (traits, effects, scopes) | New DLC, game patches |
| `parser.py` | AST generation | Syntax changes (rare) |
| `scopes.py` | Scope type logic | New scope types added |
| `diagnostics.py` | Error detection rules | New validation rules needed |
| `completions.py` | Completion logic | New completion contexts |
| `server.py` | LSP protocol handling | Never (ideally) |

---

## Current State

- ✅ Document synchronization via pygls `@server.feature` decorators
- ✅ Basic auto-completion (150+ keywords, effects, triggers, scopes)
- ✅ VS Code extension integration via stdin/stdout JSON-RPC

---

## Phase 1: Parser Foundation

### CK3Node AST Structure

```python
@dataclass
class CK3Node:
    type: str                           # 'block', 'assignment', 'list', 'comment'
    key: str                            # e.g., 'trigger', 'effect', 'add_gold'
    value: Any
    range: types.Range
    parent: Optional['CK3Node'] = None
    scope_type: str = 'unknown'
    children: List['CK3Node'] = field(default_factory=list)
```

### What to Parse

| Construct | Example | Node Type |
|-----------|---------|-----------|
| Assignment | `add_gold = 100` | `assignment` |
| Block | `trigger = { ... }` | `block` |
| Namespace | `namespace = my_mod` | `namespace` |
| Event | `my_mod.0001 = { ... }` | `event` |
| Comment | `# This is a comment` | `comment` |
| Scope chain | `liege.primary_title.holder` | `scope_chain` |
| Saved scope | `scope:my_target` | `saved_scope` |

### Document Index

Track symbols across all open documents:
- `namespaces` — namespace → file uri
- `events` — event_id → Location
- `scripted_effects` — name → Location
- `scripted_triggers` — name → Location
- `script_values` — name → Location
- `saved_scopes` — scope_name → save Location

Parse and update index on `TEXT_DOCUMENT_DID_OPEN`, `TEXT_DOCUMENT_DID_CHANGE`. Clear on `TEXT_DOCUMENT_DID_CLOSE`.

---

## Phase 2: Scope System

### Scope Types

Load from `data/scopes/*.yaml`. Each scope type defines:
- `links` — Valid scope navigation (liege, spouse, holder, etc.)
- `lists` — Iterable lists (vassal, courtier, child, etc.)
- `triggers` — Valid triggers for this scope
- `effects` — Valid effects for this scope

**Core scope types:** character, landed_title, province, faith, culture, dynasty, dynasty_house, artifact, scheme, secret, war, casus_belli, story_cycle, activity, combat, army, mercenary_company, holy_order, council_task, travel_plan

### Universal Scopes

Always valid: `root`, `this`, `prev`, `from`

### Scope Chain Validation

Validate dot notation chains like `liege.primary_title.holder`:
1. Split by `.`
2. For each part, verify it's a valid link from current scope
3. Update current scope to the resulting scope type
4. Return (valid: bool, result_scope_or_error: str)

### Event Target Syntax

| Pattern | Example | Description |
|---------|---------|-------------|
| Direct link | `liege` | Single scope navigation |
| Dot chain | `liege.primary_title.holder` | Multi-step navigation |
| Saved scope | `scope:my_target` | Reference saved scope |
| Event target | `event_target:my_target` | Legacy saved scope |

### Saved Scope Tracking

Track `save_scope_as` and `save_temporary_scope_as`. Validate `scope:name` references a previously saved scope.

### Comparison Operators

`=`, `>`, `<`, `>=`, `<=`, `!=`

---

## Phase 3: Script Lists

### List Prefix Patterns

| Prefix | Type | Supports |
|--------|------|----------|
| `any_` | trigger | `count`, `percent` |
| `every_` | effect | `limit`, `max` |
| `random_` | effect | `limit`, `weight` |
| `ordered_` | effect | `limit`, `order_by`, `position`, `max`, `min` |

### Validation Rules

- `any_` blocks can only contain triggers
- `every_`, `random_`, `ordered_` blocks: triggers only allowed inside `limit = { }`
- Parse custom scripted lists from `common/scripted_lists/`

---

## Phase 4: Script Values & Formulas

### Script Value Patterns

- Fixed: `my_value = 100`
- Range: `my_range = { 50 100 }`
- Formula: `{ value = gold  multiply = 0.1  add = 50  min = 10  max = 1000 }`

### Formula Operations

`value`, `add`, `subtract`, `multiply`, `divide`, `modulo`, `min`, `max`, `round`, `round_to`, `ceiling`, `floor`

### Conditional Formulas

Validate `if`/`else_if`/`else` blocks — `else_if` cannot follow `else`.

---

## Phase 5: Variables System

### Variable Effects

`set_variable`, `change_variable`, `clamp_variable`, `round_variable`, `remove_variable`

### Variable Triggers

`has_variable`, comparison via `var:my_var >= 10`

### Variable Storage Types

| Prefix | Scope | Lifetime |
|--------|-------|----------|
| `var:` | Character/Title | Persistent |
| `local_var:` | Current block | Block only |
| `global_var:` | Global | Save game |

### Variable List Operations

Effects: `add_to_variable_list`, `remove_list_variable`, `clear_variable_list`

Triggers: `is_target_in_variable_list`, `variable_list_size`, `any_in_list`, `every_in_list`, `ordered_in_list`, `random_in_list`

---

## Phase 6: Scripted Blocks

### Scripted Triggers/Effects

Parse from `common/scripted_triggers/` and `common/scripted_effects/`. Track: name, file_path, parameters (`$PARAM$` placeholders), scope_requirement, documentation

### Parameter Validation

Extract `$PARAM$` placeholders with regex: `r'\$([A-Z_]+)\$'`. Validate all required parameters are provided when called.

### Inline Scripts

Validate `inline_script = { script = path }` — check `common/inline_scripts/{path}.txt` exists.

---

## Phase 7: Event System

### Event Types

| Type | Required | Portraits |
|------|----------|-----------|
| `character_event` | type, title, desc | Yes |
| `letter_event` | type, sender, desc | No |
| `court_event` | type, title, desc | Yes + court_scene |

### Event Themes

`default`, `diplomacy`, `intrigue`, `martial`, `stewardship`, `learning`, `seduction`, `temptation`, `romance`, `faith`, `culture`, `war`, `death`, `dread`, `dungeon`, `feast`, `hunt`, `travel`, `pet`, `friendly`, `unfriendly`, `healthcare`, `physical_health`, `mental_health`, etc.

### Event Block Validation

- Validate required fields exist
- `trigger` block: triggers only
- `immediate` block: effects only
- Validate each `option` block

### Portrait Configuration

Positions: `left_portrait`, `right_portrait`, `lower_left_portrait`, `lower_center_portrait`, `lower_right_portrait`

Animations: `idle`, `happiness`, `sadness`, `anger`, `fear`, `disgust`, `flirtation`, `shock`, `boredom`, `scheme`, etc.

### Dynamic Descriptions

Validate `triggered_desc` has both `trigger` and `desc`. Validate `first_valid` and `random_valid` blocks.

### On-Actions

Parse `common/on_action/`. Validate referenced events exist.

---

## Phase 8: Diagnostics

### Diagnostic Publisher

Collect diagnostics from `check_syntax()`, `check_scopes()`, `check_semantics()`. Push via `ls.text_document_publish_diagnostics()`.

### Severity Levels

| Level | Use |
|-------|-----|
| Error | Syntax errors, missing required fields, effects in trigger blocks |
| Warning | Unknown effects/triggers (typos), undefined saved scopes |
| Information | Style suggestions |
| Hint | Minor improvements |

### Syntax Validation

| Error | Code |
|-------|------|
| Unclosed bracket | CK3001 |
| Orphan closing bracket | CK3002 |
| Missing equals | CK3003 |
| Invalid operator | CK3004 |

### Semantic Validation

| Error | Severity |
|-------|----------|
| Unknown effect (typo) | Warning |
| Unknown trigger (typo) | Warning |
| Effect in trigger block | Error |
| Trigger in effect block (outside limit) | Warning |
| Invalid scope chain | Error |
| Undefined saved scope | Warning |

Trigger diagnostics on `TEXT_DOCUMENT_DID_OPEN`, `TEXT_DOCUMENT_DID_CHANGE`. Clear on `TEXT_DOCUMENT_DID_CLOSE`.

---

## Phase 9: Completions

### Trigger Characters

`_`, `.`, `:`, `=`

### Context Detection

| Context | Completions |
|---------|-------------|
| Inside `trigger = { }` | Triggers only |
| Inside `effect = { }` or `immediate = { }` | Effects only |
| Inside `option = { }` | Both (effects + nested triggers) |
| After `every_*` or `any_*` | Scope iterators + `limit` |
| Inside `limit = { }` | Triggers only |
| After `scope:` | Saved scope names |
| After `.` | Valid scope links for current scope |

### Completion Item Structure

- `label` — Display text
- `kind` — Function for triggers/effects, Variable for scope links
- `detail` — Brief description
- `documentation` — Full markdown documentation
- `insert_text` / `insert_text_format` — For snippets

### Snippet Templates

Provide snippets for: event template, trigger_event, option, triggered_desc, save_scope_as, etc.

### Lazy Resolution

Use `COMPLETION_ITEM_RESOLVE` to defer expensive documentation lookup.

---

## Phase 10: Hover Documentation

Return markdown content for:
- Known effects/triggers — Usage, scope, description
- Scope links — From/to scope types
- Events in index — File location, event type
- Saved scope references — Explanation of `save_scope_as`

---

## Phase 11: Localization System

### Character Functions

`GetName`, `GetFirstName`, `GetTitledFirstName`, `GetNamePossessive`, `GetSheHe`, `GetHerHis`, `GetHerHim`, `GetHerselfHimself`, `GetLadyLord`, `GetWifeHusband`, etc.

### Text Formatting

Color codes (close with `#!`): `#P` (positive), `#N` (negative), `#high`, `#warning`, `#weak`, `#E`, `#S`

Text effects: `#bold`, `#italic`

### Validate

- All `#` codes properly closed with `#!`
- Icon references (`@gold_icon!`) exist
- Concept links (`[martial|E]`) valid

---

## Phase 12: Navigation

### Go to Definition

Navigate from:
- Event ID → Event definition
- Scripted effect/trigger name → Definition file
- `scope:name` → `save_scope_as` location
- Script value name → Definition

### Find References

Search all indexed documents for symbol occurrences.

---

## Phase 13: Document Symbols

### Symbol Kinds Mapping

| CK3 Construct | SymbolKind |
|---------------|------------|
| namespace | Namespace |
| event | Event |
| trigger/effect block | Property |
| option | Method |
| scripted_effect/trigger | Function |
| script_value | Constant |
| saved_scope | Variable |

Return hierarchical symbols with children (event → trigger, immediate, options).

---

## Phase 14: Code Actions

### Quick Fixes

| Diagnostic | Fix |
|------------|-----|
| Unknown effect (typo) | "Did you mean 'add_gold'?" → Replace |
| Missing namespace | Add namespace declaration |
| Invalid scope chain | Suggest valid link |

### Refactoring

- Extract scripted effect/trigger
- Generate localization keys
- Convert to parameterized scripted block

---

## Phase 15: Workspace Features

### Cross-File Validation

- Undefined scripted effects/triggers
- Event chain validation (trigger_event targets exist)
- Localization coverage
- Scope availability across event chains

### Mod Descriptor Awareness

Parse `*.mod` files for dependencies, replace paths, version compatibility.

---

## Phase 16: Visual Features

### Semantic Tokens

Token types: `keyword`, `variable`, `function`, `operator`, `type`, `parameter`, `string`, `number`, `comment`, `scope`, `namespace`, `event`

Token modifiers: `declaration`, `definition`, `readonly`, `deprecated`

### Inlay Hints

Show scope types after scope-changing operations: `liege = {` → `: character`

### Code Lens

- Reference counts above events
- "▶ Run Event" action
- Override indicators for scripted blocks

### Threading

Use `@server.thread()` for: workspace-wide search, index building, external tool calls.

---

## Phase 17: Server Infrastructure

### Progress Reporting

Use `ls.progress.create/begin/report/end` for long operations.

### Configuration

Read settings via `get_configuration_async("ck3LanguageServer")`:
- `validateOnSave`
- `maxDiagnostics`
- `gameDataPath`
- `enableSemanticTokens`

### Messages

- `show_message()` — Popup messages
- `show_message_log()` — Output channel logging

### Workspace Edits

Use `apply_edit_async()` for code actions that modify files.

---

## File Structure

```
pychivalry/
├── server.py              # LSP protocol handling (thin wrapper)
├── ck3_language.py        # Language definitions
├── parser.py              # CK3 script parser
├── indexer.py             # Document/workspace indexer
├── scopes.py              # Scope type logic
├── lists.py               # Script list handling
├── script_values.py       # Script value validation
├── variables.py           # Variable tracking
├── scripted_blocks.py     # Scripted triggers/effects
├── events.py              # Event validation
├── diagnostics.py         # Validation logic
├── documentation.py       # Hover documentation
├── completions.py         # Context-aware completions
├── localization.py        # Localization validation
├── symbols.py             # Symbol providers
├── actions.py             # Code actions
└── data/
    ├── scopes/*.yaml      # Scope definitions per type
    ├── traits/*.yaml      # Trait definitions by category
    ├── effects/*.yaml     # Effect definitions
    ├── triggers/*.yaml    # Trigger definitions
    └── events/*.yaml      # Theme/animation enums
```

---

## Testing Strategy

### Test Directory Structure

```
tests/
├── conftest.py              # Shared fixtures
├── fixtures/                # Test CK3 files
├── test_parser.py
├── test_scopes.py
├── test_lists.py
├── test_script_values.py
├── test_variables.py
├── test_diagnostics.py
├── test_completions.py
├── test_hover.py
├── test_goto.py
├── test_symbols.py
└── test_integration.py
```

### Key Test Fixtures

```python
@pytest.fixture
def server():
    return CK3LanguageServer("test-server", "v0.1.0")

@pytest.fixture
def sample_event_text():
    return '''namespace = test_mod
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    trigger = { is_adult = yes }
    immediate = { save_scope_as = main_character }
    option = { name = test_mod.0001.a  add_gold = 100 }
}'''
```

### Test Categories

**Parser:** empty doc, namespace extraction, event extraction, nested blocks, assignments, comments, node ranges, get_node_at_position, edge cases

**Scopes:** scope type existence, links/triggers/effects per scope, valid/invalid scope chains, universal scopes, get_resulting_scope

**Diagnostics:** unclosed bracket, orphan bracket, unknown effect warning, effect in trigger block error, invalid scope chain, undefined saved scope

**Completions:** trigger context returns triggers only, effect context returns effects only, scope chain context returns links, correct CompletionItemKind

**Integration:** server creation, document parsing on open, index updated, completions return items, hover returns content, diagnostics generated

### Running Tests

```bash
pytest tests/ -v                          # All tests
pytest tests/test_parser.py -v            # Specific file
pytest tests/ --cov=pychivalry --cov-report=html  # With coverage
pytest tests/ -k "test_scope" -v          # Pattern matching
```

### CI Configuration (pyproject.toml)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-v --tb=short"

[tool.coverage.run]
source = ["pychivalry"]
branch = true

[tool.coverage.report]
exclude_lines = ["pragma: no cover", "def __repr__", "raise NotImplementedError"]
```

---

## Success Criteria

### Parser (v0.2.0)
- [ ] Parses all valid CK3 syntax patterns
- [ ] Generates correct AST with ranges
- [ ] Handles malformed input gracefully
- [ ] `get_node_at_position` works correctly

### Scope System (v0.3.0)
- [ ] All Jomini scope types defined
- [ ] Scope chain validation works
- [ ] Saved scope tracking accurate
- [ ] Universal scopes recognized

### Diagnostics (v0.8.0)
- [ ] Syntax errors detected accurately
- [ ] Semantic errors produce correct severity
- [ ] No false positives on valid Jomini syntax
- [ ] Diagnostics cleared when documents close

### Completions (v0.9.0)
- [ ] Context-aware filtering works
- [ ] Scope-aware completions accurate
- [ ] Snippets expand correctly
- [ ] Performance < 100ms

### Navigation (v0.12.0)
- [ ] Go to definition works for events and saved scopes
- [ ] Find references finds all usages
- [ ] Workspace symbols searchable

### Overall (v1.0.0)
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] Real mod files validate correctly
- [ ] No crashes on any input

---

## pygls API Checklist

### Core Features

| Feature | Method | Status |
|---------|--------|--------|
| Document sync | `TEXT_DOCUMENT_DID_OPEN/CHANGE/CLOSE` | ✅ Exists |
| Completions | `TEXT_DOCUMENT_COMPLETION` | ✅ Exists |
| Completion resolve | `COMPLETION_ITEM_RESOLVE` | Planned |
| Diagnostics | `publish_diagnostics()` | Planned |

### Navigation

| Feature | Method | Status |
|---------|--------|--------|
| Hover | `TEXT_DOCUMENT_HOVER` | Planned |
| Go to definition | `TEXT_DOCUMENT_DEFINITION` | Planned |
| Find references | `TEXT_DOCUMENT_REFERENCES` | Planned |
| Document symbols | `TEXT_DOCUMENT_DOCUMENT_SYMBOL` | Planned |
| Workspace symbols | `WORKSPACE_SYMBOL` | Planned |

### Editing

| Feature | Method | Status |
|---------|--------|--------|
| Code actions | `TEXT_DOCUMENT_CODE_ACTION` | Planned |
| Rename | `TEXT_DOCUMENT_RENAME` | Optional |

### Visual

| Feature | Method | Status |
|---------|--------|--------|
| Semantic tokens | `TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL` | Planned |
| Inlay hints | `TEXT_DOCUMENT_INLAY_HINT` | Planned |
| Code lens | `TEXT_DOCUMENT_CODE_LENS` | Planned |

### Infrastructure

| Feature | Method | Status |
|---------|--------|--------|
| Progress | `progress.create/begin/report/end` | Planned |
| Configuration | `get_configuration_async()` | Planned |
| Messages | `show_message()` | Planned |
| Workspace edit | `apply_edit_async()` | Planned |
| Threading | `@server.thread()` | Planned |

---

## Version Milestones

| Version | Features |
|---------|----------|
| **v0.2.0** | Parser + AST |
| **v0.3.0** | Scope system |
| **v0.4.0** | Script lists |
| **v0.5.0** | Script values |
| **v0.6.0** | Variables |
| **v0.7.0** | Scripted blocks |
| **v0.8.0** | Diagnostics |
| **v0.9.0** | Context-aware completions |
| **v0.10.0** | Hover |
| **v0.11.0** | Localization |
| **v0.12.0** | Navigation |
| **v0.13.0** | Document symbols |
| **v1.0.0** | Workspace support + code actions |

---

## Resources

- [pygls Documentation](https://pygls.readthedocs.io/)
- [pygls Integration Examples](./Documents/integration/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/specification.html)
- [lsprotocol Types Reference](https://github.com/microsoft/lsprotocol)
