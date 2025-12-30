# pychivalry Language Server Development Plan

A phased roadmap for adding CK3/Jomini modding support to the language server using **pygls** (Python Generic Language Server).

---

## Design Principles

> **Modularity over monoliths.** Game data changes. New DLCs add traits, effects, and scopes. The architecture must support easy updates without touching core logic.

### Key Design Goals

1. **Separate data from logic** — Language definitions (traits, effects, triggers) live in dedicated data modules, not embedded in feature code
2. **One file per concern** — Parser, diagnostics, completions, hover each get their own module
3. **Data-driven validation** — Load definitions from structured data files (YAML/JSON) so non-developers can contribute
4. **Plugin-ready architecture** — Core LSP features should be extensible without modifying server.py
5. **Lazy loading** — Don't load all game data at startup; load on demand for better performance

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

The language server currently provides:
- ✅ Document synchronization (open/change/close) via pygls `@server.feature` decorators
- ✅ Basic auto-completion (150+ keywords, effects, triggers, scopes)
- ✅ VS Code extension integration via stdin/stdout JSON-RPC

**Current Architecture:**
```python
from pygls.lsp.server import LanguageServer
from lsprotocol import types

server = LanguageServer("ck3-language-server", "v0.1.0")

@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def completions(params: types.CompletionParams):
    ...
```

---

## Phase 1: Parser Foundation (Week 1-2)
**Priority: Critical | Complexity: Medium**

Before adding advanced features, we need a proper CK3 script parser that integrates with pygls's document management.

### 1.1 Create CK3 Parser Module

Create `pychivalry/parser.py` to parse Jomini syntax:

```python
from dataclasses import dataclass, field
from typing import Any, List, Optional
from lsprotocol import types

@dataclass
class CK3Node:
    """AST node for CK3 script parsing."""
    type: str                           # 'block', 'assignment', 'list', 'comment'
    key: str                            # e.g., 'trigger', 'effect', 'add_gold'
    value: Any                          # Value or nested nodes
    range: types.Range                  # Start/end positions (LSP Range)
    parent: Optional['CK3Node'] = None  # Parent node reference
    scope_type: str = 'unknown'         # 'character', 'title', 'province', etc.
    children: List['CK3Node'] = field(default_factory=list)

def parse_document(text: str) -> List[CK3Node]:
    """Parse CK3 script into AST nodes.
    
    This is called from pygls document event handlers to maintain
    an up-to-date AST for each open document.
    """
    # 1. Tokenize: split into tokens (keys, =, values, {, }, comments)
    # 2. Parse: build tree structure with proper Range objects
    # 3. Return list of top-level nodes with parent references
    ...

def get_node_at_position(nodes: List[CK3Node], position: types.Position) -> Optional[CK3Node]:
    """Find the AST node at a given cursor position.
    
    Used by hover, completions, goto definition, etc.
    """
    ...
```

**What to parse:**

| Construct | Example | Node Type |
|-----------|---------|-----------|
| Assignment | `add_gold = 100` | `assignment` |
| Block | `trigger = { ... }` | `block` |
| Namespace | `namespace = my_mod` | `namespace` |
| Event | `my_mod.0001 = { ... }` | `event` |
| Comment | `# This is a comment` | `comment` |
| Scope chain | `liege.primary_title.holder` | `scope_chain` |
| Saved scope | `scope:my_target` | `saved_scope` |

### 1.2 Extend Language Server with Document Index

Extend the `LanguageServer` class to track parsed documents:

```python
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument
from lsprotocol import types

class CK3LanguageServer(LanguageServer):
    """Extended language server with CK3-specific state."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Document ASTs (updated on open/change)
        self.document_asts: dict[str, List[CK3Node]] = {}
        # Cross-document index
        self.index = DocumentIndex()
    
    def parse_document(self, doc: TextDocument):
        """Parse a document and update the index."""
        ast = parse_document(doc.source)
        self.document_asts[doc.uri] = ast
        self.index.update_from_ast(doc.uri, ast)
        return ast

class DocumentIndex:
    """Track symbols across all open documents."""
    
    def __init__(self):
        self.namespaces = {}        # namespace -> file uri
        self.events = {}            # event_id -> Location
        self.scripted_effects = {}  # name -> Location
        self.scripted_triggers = {} # name -> Location
        self.scripted_lists = {}    # name -> Location
        self.script_values = {}     # name -> Location
        self.on_actions = {}        # name -> event list
        self.saved_scopes = {}      # scope_name -> save Location
    
    def update_from_ast(self, uri: str, ast: List[CK3Node]):
        """Extract and index all symbols from an AST."""
        ...
```

### 1.3 Integrate Parser with pygls Events

Update document handlers to maintain AST:

```python
server = CK3LanguageServer("ck3-language-server", "v0.2.0")

@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: CK3LanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse document when opened."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_document(doc)

@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: CK3LanguageServer, params: types.DidChangeTextDocumentParams):
    """Re-parse document when changed."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_document(doc)

@server.feature(types.TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: CK3LanguageServer, params: types.DidCloseTextDocumentParams):
    """Clean up when document is closed."""
    uri = params.text_document.uri
    ls.document_asts.pop(uri, None)
    ls.index.remove_document(uri)
```

---

## Phase 2: Core Jomini Language Features (Week 3-4)
**Priority: Critical | Complexity: High**

Implement the fundamental Jomini scripting language constructs.

> **🔧 Modularity Note:** The scope definitions below should be loaded from `data/scopes/*.yaml` files, not hardcoded. This allows updates when new DLC adds scope types or promotions without modifying Python code.

### 2.1 Scope System

Define all CK3 scope types with their valid operations:

```python
# pychivalry/scopes.py
# Load scope definitions from YAML data files
from pychivalry.data import load_scopes

SCOPE_TYPES = load_scopes()  # Loaded from data/scopes/*.yaml

# Example of what data/scopes/character.yaml provides:
# SCOPE_TYPES['character'] = {
        'links': ['liege', 'spouse', 'father', 'mother', 'employer', 'host', ...],
        'lists': ['vassal', 'courtier', 'child', 'sibling', 'ally', ...],
        'triggers': ['is_adult', 'is_alive', 'is_ruler', 'has_trait', ...],
        'effects': ['add_gold', 'add_prestige', 'death', 'imprison', ...],
    },
    'landed_title': {
        'links': ['holder', 'previous_holder', 'de_jure_liege', 'capital_county', ...],
        'lists': ['de_jure_vassal', 'in_de_facto_hierarchy', ...],
        'triggers': ['tier', 'is_holy_site', 'is_titular', ...],
        'effects': ['set_capital_county', 'destroy_title', ...],
    },
    'province': {
        'links': ['county', 'barony', 'faith', 'culture', ...],
        'triggers': ['terrain', 'has_holding', ...],
        'effects': ['add_province_modifier', 'set_holding_type', ...],
    },
    'faith': { ... },
    'culture': { ... },
    'dynasty': { ... },
    'dynasty_house': { ... },
    'artifact': { ... },
    'scheme': { ... },
    'secret': { ... },
    'war': { ... },
    'casus_belli': { ... },
    'story_cycle': { ... },
    'activity': { ... },
    'combat': { ... },
    'army': { ... },
    'mercenary_company': { ... },
    'holy_order': { ... },
    'council_task': { ... },
    'travel_plan': { ... },
    # ... etc
}
```

**Scope Navigation (Links):**
```python
# Implement polymorphic scope link resolution
def get_valid_links(scope_type: str) -> List[str]:
    """Return valid scope links for the given scope type."""
    base_links = SCOPE_TYPES.get(scope_type, {}).get('links', [])
    # Add universal links available to all scopes
    universal = ['root', 'this', 'prev', 'from']
    return base_links + universal

# Validate dot notation chains
def validate_scope_chain(chain: str, starting_scope: str) -> Tuple[bool, str]:
    """Validate a scope chain like 'liege.primary_title.holder'"""
    parts = chain.split('.')
    current_scope = starting_scope
    for part in parts:
        if part not in get_valid_links(current_scope):
            return (False, f"'{part}' is not valid from {current_scope} scope")
        current_scope = get_resulting_scope(current_scope, part)
    return (True, current_scope)
```

**Event Target Syntax:**
| Pattern | Example | Description |
|---------|---------|-------------|
| Direct link | `liege` | Single scope navigation |
| Dot chain | `liege.primary_title.holder` | Multi-step navigation |
| Saved scope | `scope:my_target` | Reference saved scope |
| Event target | `event_target:my_target` | Legacy saved scope |

### 2.2 Saved Scopes

Implement saved scope pattern tracking:

```python
# Track save_scope_as and save_temporary_scope_as
class SavedScopeTracker:
    def __init__(self):
        self.permanent = {}    # save_scope_as targets
        self.temporary = {}    # save_temporary_scope_as targets
    
    def track_save(self, node: CK3Node):
        """Extract and track scope saves from AST nodes."""
        if node.key == 'save_scope_as':
            self.permanent[node.value] = node.range
        elif node.key == 'save_temporary_scope_as':
            self.temporary[node.value] = node.range
```

**Validation rules:**
- `scope:name` must reference a previously saved scope
- Warn if `scope:` used before any `save_scope_as`
- Track scope availability per event block (immediate vs option)

### 2.3 Scope Comparison Operators

Support all Jomini comparison operators:

| Operator | Example | Description |
|----------|---------|-------------|
| `=` | `age = 16` | Equals |
| `>` | `age > 16` | Greater than |
| `<` | `gold < 100` | Less than |
| `>=` | `prestige >= 500` | Greater or equal |
| `<=` | `piety <= 0` | Less or equal |
| `!=` | `culture != root.culture` | Not equal |

---

## Phase 3: Script Lists (Week 5)
**Priority: High | Complexity: Medium**

Implement the four list iteration patterns.

### 3.1 List Prefix Patterns

```python
LIST_PREFIXES = {
    'any_': {
        'type': 'trigger',
        'description': 'Returns true if ANY item matches conditions',
        'supports_count': True,
    },
    'every_': {
        'type': 'effect',
        'description': 'Executes effects on EVERY matching item',
        'supports_limit': True,
    },
    'random_': {
        'type': 'effect',
        'description': 'Executes effects on ONE random matching item',
        'supports_weight': True,
    },
    'ordered_': {
        'type': 'effect',
        'description': 'Executes effects on items in sorted order',
        'supports_order': True,
    },
}

# Base lists that can have prefixes
CHARACTER_LISTS = ['vassal', 'courtier', 'child', 'sibling', 'ally', 'enemy', ...]
TITLE_LISTS = ['de_jure_vassal', 'in_de_facto_hierarchy', 'claim', ...]
```

### 3.2 List Parameter Validation

| Parameter | Used By | Example |
|-----------|---------|---------|
| `limit` | all | `limit = { is_adult = yes }` |
| `count` | `any_` | `count >= 3` |
| `percent` | `any_` | `percent >= 50` |
| `order_by` | `ordered_` | `order_by = age` |
| `position` | `ordered_` | `position = 0` (first) |
| `max` | `ordered_`, `every_` | `max = 5` |
| `min` | `ordered_` | `min = 1` |
| `weight` | `random_` | `weight = { base = 10 }` |

```python
def validate_list_block(node: CK3Node) -> List[Diagnostic]:
    """Validate list iteration blocks."""
    diagnostics = []
    prefix = get_list_prefix(node.key)
    
    if prefix == 'any_' and has_effect_children(node):
        diagnostics.append(error("any_ blocks can only contain triggers"))
    
    if prefix in ('every_', 'random_', 'ordered_') and has_trigger_children(node):
        # Allow limit = { } blocks
        for child in node.children:
            if child.key != 'limit' and is_trigger(child):
                diagnostics.append(warning("Triggers outside limit block"))
    
    return diagnostics
```

### 3.3 Scripted Lists

Parse and validate custom scripted lists from `common/scripted_lists/`:

```python
# Scripted lists define custom iteration targets
# Auto-generate prefixed versions: any_my_list, every_my_list, etc.

def parse_scripted_list(file_path: str) -> Dict[str, ScriptedList]:
    """Parse scripted list definitions."""
    lists = {}
    ast = parse_file(file_path)
    for node in ast:
        if node.type == 'block':
            lists[node.key] = ScriptedList(
                name=node.key,
                base_scope=extract_scope(node),
                conditions=extract_conditions(node),
            )
    return lists
```

---

## Phase 4: Script Values & Formulas (Week 6)
**Priority: High | Complexity: Medium**

Support named values and mathematical formulas.

### 4.1 Script Value Definitions

Parse from `common/script_values/`:

```python
@dataclass
class ScriptValue:
    name: str
    value_type: str  # 'fixed', 'formula', 'conditional'
    base_value: Optional[float]
    formula: Optional[FormulaNode]
    conditions: List[ConditionalValue]
```

**Script value patterns:**
```pdx
# Fixed value
my_value = 100

# Range value (random between min/max)
my_range = { 50 100 }

# Formula
my_formula = {
    value = gold
    multiply = 0.1
    add = 50
    min = 10
    max = 1000
}
```

### 4.2 Formula Structure

```python
FORMULA_OPERATIONS = {
    'value': 'base',           # Starting value
    'add': 'arithmetic',       # + operand
    'subtract': 'arithmetic',  # - operand
    'multiply': 'arithmetic',  # × operand
    'divide': 'arithmetic',    # ÷ operand
    'modulo': 'arithmetic',    # % operand
    'min': 'clamp',           # Floor value
    'max': 'clamp',           # Ceiling value
    'round': 'round',         # Round to integer
    'round_to': 'round',      # Round to nearest X
    'ceiling': 'round',       # Round up
    'floor': 'round',         # Round down
}
```

### 4.3 Conditional Formulas

```python
# Conditional value modification
def validate_conditional_formula(node: CK3Node) -> List[Diagnostic]:
    """Validate if/else_if/else blocks in formulas."""
    has_else = False
    for child in node.children:
        if child.key == 'if':
            validate_has_limit(child)
        elif child.key == 'else_if':
            if has_else:
                return [error("else_if cannot follow else")]
            validate_has_limit(child)
        elif child.key == 'else':
            has_else = True
```

---

## Phase 5: Variables System (Week 7)
**Priority: Medium-High | Complexity: Medium**

Full variable operation support.

### 5.1 Variable Effects

```python
VARIABLE_EFFECTS = {
    'set_variable': {
        'params': ['name', 'value'],
        'description': 'Set a variable to a value',
    },
    'change_variable': {
        'params': ['name', 'add/subtract/multiply/divide'],
        'description': 'Modify an existing variable',
    },
    'clamp_variable': {
        'params': ['name', 'min', 'max'],
        'description': 'Clamp variable to range',
    },
    'round_variable': {
        'params': ['name', 'nearest'],
        'description': 'Round variable to nearest value',
    },
    'remove_variable': {
        'params': ['name'],
        'description': 'Delete a variable',
    },
}
```

### 5.2 Variable Triggers

```python
VARIABLE_TRIGGERS = {
    'has_variable': 'Check if variable exists',
    'NOT = { has_variable = x }': 'Check variable does not exist',
    # Comparison triggers use the variable directly:
    # var:my_var >= 10
}
```

### 5.3 Variable Storage Types

| Prefix | Scope | Lifetime | Example |
|--------|-------|----------|---------|
| `var:` | Character/Title | Persistent | `var:times_married` |
| `local_var:` | Current block | Block only | `local_var:loop_count` |
| `global_var:` | Global | Save game | `global_var:world_tension` |

```python
# Track variable usage for validation
class VariableTracker:
    def __init__(self):
        self.variables = {}      # var:name -> type
        self.local_vars = {}     # local_var:name -> block scope
        self.global_vars = set() # global_var names
    
    def validate_var_reference(self, name: str, prefix: str) -> Optional[Diagnostic]:
        """Warn if variable used before being set."""
        ...
```

### 5.4 Variable List Operations

```python
VARIABLE_LIST_EFFECTS = [
    'add_to_variable_list',
    'remove_list_variable',
    'clear_variable_list',
]

VARIABLE_LIST_TRIGGERS = [
    'is_target_in_variable_list',
    'variable_list_size',
    'any_in_list',
    'every_in_list',
    'ordered_in_list',
    'random_in_list',
]
```

---

## Phase 6: Scripted Blocks (Week 8)
**Priority: Medium | Complexity: Medium**

Support reusable scripted triggers and effects.

### 6.1 Scripted Triggers

Parse from `common/scripted_triggers/`:

```python
@dataclass
class ScriptedTrigger:
    name: str
    file_path: str
    parameters: List[str]  # $PARAM$ placeholders
    scope_requirement: str  # Expected scope type
    documentation: str
```

### 6.2 Scripted Effects

Parse from `common/scripted_effects/`:

```python
@dataclass
class ScriptedEffect:
    name: str
    file_path: str
    parameters: List[str]
    scope_requirement: str
    documentation: str
```

### 6.3 Parameter Syntax

Support `$PARAM$` syntax in scripted blocks:

```python
def extract_parameters(content: str) -> List[str]:
    """Extract $PARAM$ placeholders from scripted block."""
    import re
    return re.findall(r'\$([A-Z_]+)\$', content)

def validate_parameter_usage(call_node: CK3Node, definition: ScriptedBlock):
    """Validate all required parameters are provided."""
    provided = set(child.key for child in call_node.children)
    required = set(definition.parameters)
    missing = required - provided
    if missing:
        return [error(f"Missing parameters: {missing}")]
```

### 6.4 Inline Scripts

Validate `inline_script` references:

```python
def validate_inline_script(node: CK3Node) -> List[Diagnostic]:
    """Validate inline_script = { script = path } blocks."""
    script_path = get_child_value(node, 'script')
    if not script_path:
        return [error("inline_script requires 'script' parameter")]
    
    full_path = f"common/inline_scripts/{script_path}.txt"
    if not file_exists(full_path):
        return [error(f"Inline script not found: {full_path}")]
```

---

## Phase 7: Event System (Week 9-10)
**Priority: High | Complexity: Medium**

Complete event structure validation.

### 7.1 Event Types

```python
EVENT_TYPES = {
    'character_event': {
        'required': ['type', 'title', 'desc'],
        'optional': ['theme', 'trigger', 'immediate', 'option', 'after'],
        'portraits': True,
    },
    'letter_event': {
        'required': ['type', 'sender', 'desc'],
        'optional': ['trigger', 'immediate', 'option'],
        'portraits': False,
    },
    'court_event': {
        'required': ['type', 'title', 'desc'],
        'optional': ['theme', 'trigger', 'immediate', 'option'],
        'portraits': True,
        'court_scene': True,
    },
    'fullscreen_event': { ... },
    'activity_event': { ... },
    'duel_event': { ... },
}
```

### 7.2 Event Theme Enum

```python
EVENT_THEMES = [
    'default', 'diplomacy', 'intrigue', 'martial', 'stewardship', 'learning',
    'seduction', 'temptation', 'romance', 'faith', 'culture', 'war',
    'death', 'dread', 'dungeon', 'feast', 'hunt', 'travel', 'pet',
    'friendly', 'unfriendly', 'healthcare', 'physical_health', 'mental_health',
    # ... etc
]
```

### 7.3 Event Block Validation

```python
def validate_event(node: CK3Node) -> List[Diagnostic]:
    diagnostics = []
    event_type = get_event_type(node)
    
    # Validate required fields
    for field in EVENT_TYPES[event_type]['required']:
        if not has_child(node, field):
            diagnostics.append(error(f"Missing required field: {field}"))
    
    # Validate trigger block contains only triggers
    trigger_block = get_child(node, 'trigger')
    if trigger_block:
        diagnostics.extend(validate_trigger_only(trigger_block))
    
    # Validate immediate block contains only effects
    immediate_block = get_child(node, 'immediate')
    if immediate_block:
        diagnostics.extend(validate_effect_only(immediate_block))
    
    # Validate options
    for option in get_children(node, 'option'):
        diagnostics.extend(validate_option(option))
    
    return diagnostics
```

### 7.4 Portrait Configuration

```python
PORTRAIT_POSITIONS = [
    'left_portrait', 'right_portrait',
    'lower_left_portrait', 'lower_center_portrait', 'lower_right_portrait',
]

PORTRAIT_ANIMATIONS = [
    'idle', 'happiness', 'sadness', 'anger', 'fear', 'disgust',
    'flirtation', 'shock', 'boredom', 'scheme', 'marshal', 'chancellor',
    'steward', 'spymaster', 'chaplain', 'personality_bold', 'personality_calm',
    # ... etc
]

def validate_portrait(node: CK3Node) -> List[Diagnostic]:
    """Validate portrait block structure."""
    diagnostics = []
    
    # Check character reference
    char_ref = get_child_value(node, 'character')
    if not char_ref:
        diagnostics.append(error("Portrait missing 'character' field"))
    
    # Validate animation if present
    animation = get_child_value(node, 'animation')
    if animation and animation not in PORTRAIT_ANIMATIONS:
        diagnostics.append(warning(f"Unknown animation: {animation}"))
    
    return diagnostics
```

### 7.5 Dynamic Descriptions

```python
def validate_desc(node: CK3Node) -> List[Diagnostic]:
    """Validate event description blocks."""
    diagnostics = []
    
    if node.type == 'assignment':
        # Simple: desc = my_event.desc
        return []
    
    # Complex description block
    for child in node.children:
        if child.key == 'triggered_desc':
            # Must have trigger and desc
            if not has_child(child, 'trigger'):
                diagnostics.append(error("triggered_desc missing trigger"))
            if not has_child(child, 'desc'):
                diagnostics.append(error("triggered_desc missing desc"))
        elif child.key == 'first_valid':
            diagnostics.extend(validate_first_valid(child))
        elif child.key == 'random_valid':
            diagnostics.extend(validate_random_valid(child))
    
    return diagnostics
```

### 7.6 On-Actions

Parse and validate `common/on_action/` definitions:

```python
def validate_on_action(node: CK3Node) -> List[Diagnostic]:
    """Validate on_action definitions."""
    diagnostics = []
    
    # Check events list
    events_block = get_child(node, 'events')
    if events_block:
        for event_ref in events_block.children:
            if not event_exists(event_ref.value):
                diagnostics.append(warning(f"Unknown event: {event_ref.value}"))
    
    # Check random_events with weights
    random_block = get_child(node, 'random_events')
    if random_block:
        for item in random_block.children:
            validate_weight_block(item, diagnostics)
    
    return diagnostics
```

---

## Phase 8: Diagnostics with pygls (Week 11)
**Priority: High | Complexity: Medium**

Implement the publish diagnostics model using pygls.

> **🔧 Modularity Note:** Diagnostic rules should be defined as a registry. New validation rules (e.g., "trait X requires DLC Y") can be added to `data/validation_rules.yaml` without touching `diagnostics.py`.

### 8.1 Diagnostic Publisher

Use pygls's `text_document_publish_diagnostics` method:

```python
from lsprotocol import types

def publish_diagnostics(ls: CK3LanguageServer, doc: TextDocument):
    """Validate document and publish diagnostics to the client."""
    ast = ls.document_asts.get(doc.uri, [])
    diagnostics = []
    
    # Collect all diagnostics
    diagnostics.extend(check_syntax(doc, ast))
    diagnostics.extend(check_scopes(ast, ls.index))
    diagnostics.extend(check_semantics(ast, ls.index))
    
    # Push to client
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=doc.uri,
            version=doc.version,
            diagnostics=diagnostics,
        )
    )
```

### 8.2 Creating Diagnostics

Build `types.Diagnostic` objects with proper severity and range:

```python
def create_diagnostic(
    message: str,
    range_: types.Range,
    severity: types.DiagnosticSeverity = types.DiagnosticSeverity.Error,
    code: str = None,
    source: str = "ck3-ls"
) -> types.Diagnostic:
    """Create a diagnostic object."""
    return types.Diagnostic(
        message=message,
        severity=severity,
        range=range_,
        code=code,
        source=source,
    )

# Severity levels:
# types.DiagnosticSeverity.Error       - Red squiggly
# types.DiagnosticSeverity.Warning     - Yellow squiggly  
# types.DiagnosticSeverity.Information - Blue squiggly
# types.DiagnosticSeverity.Hint        - Subtle dots
```

### 8.3 Syntax Validation

| Error Type | Example | Severity |
|------------|---------|----------|
| Unclosed bracket | `trigger = { is_adult = yes` | Error |
| Missing equals | `add_gold 100` | Error |
| Invalid operator | `age >> 16` | Error |
| Orphan closing bracket | `}` at wrong level | Error |

```python
def check_syntax(doc: TextDocument, ast: List[CK3Node]) -> List[types.Diagnostic]:
    """Check for syntax errors."""
    diagnostics = []
    
    # Bracket matching
    stack = []
    for idx, line in enumerate(doc.lines):
        for char_idx, char in enumerate(line):
            if char == '{':
                stack.append((idx, char_idx))
            elif char == '}':
                if not stack:
                    diagnostics.append(create_diagnostic(
                        message="Unmatched closing bracket",
                        range_=types.Range(
                            start=types.Position(line=idx, character=char_idx),
                            end=types.Position(line=idx, character=char_idx + 1),
                        ),
                        severity=types.DiagnosticSeverity.Error,
                        code="CK3001",
                    ))
                else:
                    stack.pop()
    
    # Report unclosed brackets
    for line, char in stack:
        diagnostics.append(create_diagnostic(
            message="Unclosed bracket",
            range_=types.Range(
                start=types.Position(line=line, character=char),
                end=types.Position(line=line, character=char + 1),
            ),
            severity=types.DiagnosticSeverity.Error,
            code="CK3002",
        ))
    
    return diagnostics
```

### 8.4 Semantic Validation

| Error Type | Example | Severity |
|------------|---------|----------|
| Unknown effect | `add_goldd = 100` (typo) | Warning |
| Unknown trigger | `is_rular = yes` (typo) | Warning |
| Unknown scope | `every_vassall = { }` | Warning |
| Effect in trigger block | `trigger = { add_gold = 100 }` | Error |
| Trigger in effect block | `effect = { is_adult = yes }` | Warning |
| Invalid scope chain | `liege.invalid_link` | Error |
| Undefined saved scope | `scope:undefined` | Warning |

### 8.5 Trigger Diagnostics on Document Events

```python
@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: CK3LanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse and validate document when opened."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_document(doc)
    publish_diagnostics(ls, doc)

@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: CK3LanguageServer, params: types.DidChangeTextDocumentParams):
    """Re-parse and validate document when changed."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_document(doc)
    publish_diagnostics(ls, doc)

@server.feature(types.TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: CK3LanguageServer, params: types.DidCloseTextDocumentParams):
    """Clear diagnostics when document is closed."""
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=params.text_document.uri,
            diagnostics=[],  # Empty list clears diagnostics
        )
    )
```

---

## Phase 9: Enhanced Completions with pygls (Week 12)
**Priority: High | Complexity: Low-Medium**

Make completions context-aware and scope-aware using pygls's completion feature.

> **🔧 Modularity Note:** Completion items (traits, effects, triggers) come from `data/` files. Adding a new trait or effect automatically adds it to completions—no code changes required.

### 9.1 Context-Aware Completion Handler

```python
@server.feature(
    types.TEXT_DOCUMENT_COMPLETION,
    types.CompletionOptions(
        trigger_characters=["_", ".", ":", "="],
        resolve_provider=True,  # Support lazy resolution
    ),
)
def completions(ls: CK3LanguageServer, params: types.CompletionParams):
    """Provide context-aware completions."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ast = ls.document_asts.get(doc.uri, [])
    position = params.position
    
    # Find context at cursor
    node = get_node_at_position(ast, position)
    context = determine_context(node)  # 'trigger', 'effect', 'list', etc.
    current_scope = determine_scope_type(node)
    
    items = []
    
    if context == 'trigger':
        items.extend(get_trigger_completions(current_scope))
    elif context == 'effect':
        items.extend(get_effect_completions(current_scope))
    elif context == 'scope_chain':
        items.extend(get_scope_link_completions(current_scope))
    elif context == 'saved_scope':
        items.extend(get_saved_scope_completions(ls.index))
    elif context == 'value':
        items.extend(get_value_completions(node))
    
    return types.CompletionList(is_incomplete=False, items=items)
```

### 9.2 Context Detection

| Context | Suggested Completions |
|---------|----------------------|
| Inside `trigger = { }` | Triggers only (is_adult, has_trait, etc.) |
| Inside `effect = { }` | Effects only (add_gold, add_trait, etc.) |
| Inside `immediate = { }` | Effects only |
| Inside `option = { }` | Both triggers (in nested trigger) and effects |
| After `every_*` or `any_*` | Scope iterators + limit keyword |
| After `limit = { }` | Triggers only |
| After `scope:` | Saved scope names |
| After `.` | Valid scope links for current scope type |

### 9.3 Building Completion Items

```python
def create_completion_item(
    label: str,
    kind: types.CompletionItemKind,
    detail: str,
    documentation: str = None,
    insert_text: str = None,
    insert_text_format: types.InsertTextFormat = None,
) -> types.CompletionItem:
    """Create a completion item with full documentation."""
    return types.CompletionItem(
        label=label,
        kind=kind,
        detail=detail,
        documentation=types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value=documentation,
        ) if documentation else None,
        insert_text=insert_text,
        insert_text_format=insert_text_format,
    )

def get_effect_completions(scope_type: str) -> List[types.CompletionItem]:
    """Get effect completions valid for the given scope type."""
    effects = SCOPE_TYPES.get(scope_type, {}).get('effects', [])
    return [
        create_completion_item(
            label=effect,
            kind=types.CompletionItemKind.Function,
            detail=f"Effect ({scope_type} scope)",
            documentation=get_effect_documentation(effect),
        )
        for effect in effects
    ]
```

### 9.4 Snippet Completions

Use `InsertTextFormat.Snippet` for template completions:

```python
def get_snippet_completions() -> List[types.CompletionItem]:
    """Get snippet completions for common patterns."""
    return [
        types.CompletionItem(
            label="event",
            kind=types.CompletionItemKind.Snippet,
            detail="Event template",
            insert_text="""namespace.${1:0001} = {
    type = character_event
    title = namespace.${1:0001}.t
    desc = namespace.${1:0001}.desc
    theme = ${2|diplomacy,intrigue,martial,stewardship,learning|}
    
    left_portrait = root
    
    trigger = {
        ${3:is_adult = yes}
    }
    
    immediate = {
        $4
    }
    
    option = {
        name = namespace.${1:0001}.a
        $0
    }
}""",
            insert_text_format=types.InsertTextFormat.Snippet,
        ),
        types.CompletionItem(
            label="trigger_event",
            kind=types.CompletionItemKind.Snippet,
            detail="Trigger event template",
            insert_text="trigger_event = {\n\tid = ${1:namespace.0001}\n\tdays = ${2:1}\n}",
            insert_text_format=types.InsertTextFormat.Snippet,
        ),
    ]
```

### 9.5 Completion Resolution (Lazy Loading)

```python
@server.feature(types.TEXT_DOCUMENT_COMPLETION_ITEM_RESOLVE)
def completion_resolve(ls: CK3LanguageServer, item: types.CompletionItem):
    """Resolve additional completion details on demand.
    
    This is called when the user hovers over a completion item,
    allowing us to defer expensive documentation lookup.
    """
    if item.data:
        # Load full documentation based on item.data
        item.documentation = types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value=get_full_documentation(item.data),
        )
    return item
```

---

## Phase 10: Hover Documentation with pygls (Week 13)
**Priority: Medium | Complexity: Low**

Implement hover using pygls's `TEXT_DOCUMENT_HOVER` feature.

> **🔧 Modularity Note:** Hover documentation comes from `data/` YAML files (same files used for completions/validation). Each trait/effect/trigger entry can include a `description` field that becomes hover text.

### 10.1 Hover Handler

```python
@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(ls: CK3LanguageServer, params: types.HoverParams):
    """Provide hover documentation for CK3 constructs."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    position = params.position
    
    # Get word at cursor position
    word = doc.word_at_position(position)
    if not word:
        return None
    
    # Check what kind of symbol this is
    ast = ls.document_asts.get(doc.uri, [])
    node = get_node_at_position(ast, position)
    
    # Build hover content based on symbol type
    content = get_hover_content(word, node, ls.index)
    if not content:
        return None
    
    return types.Hover(
        contents=types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value=content,
        ),
        range=get_word_range(doc, position, word),
    )
```

### 10.2 Building Hover Content

```python
def get_hover_content(word: str, node: CK3Node, index: DocumentIndex) -> Optional[str]:
    """Generate markdown hover content for a symbol."""
    
    # Check if it's a known effect
    if word in CK3_EFFECTS:
        return f"""**{word}**

*Effect* — Modifies game state

**Usage:** `{word} = <value>`

**Scope:** character

{get_effect_description(word)}
"""
    
    # Check if it's a known trigger
    if word in CK3_TRIGGERS:
        return f"""**{word}**

*Trigger* — Conditional check

**Usage:** `{word} = <value>`

**Returns:** yes/no

{get_trigger_description(word)}
"""
    
    # Check if it's a scope link
    if word in SCOPE_LINKS:
        target_scope = SCOPE_LINKS[word]['target']
        return f"""**{word}**

*Scope Link* — Navigate to {target_scope}

**From:** character → **To:** {target_scope}
"""
    
    # Check if it's an event in the index
    if word in index.events:
        loc = index.events[word]
        return f"""**Event: {word}**

Defined in: `{loc.uri}`

Type: character_event
"""
    
    # Check if it's a saved scope reference
    if word.startswith('scope:'):
        scope_name = word[6:]
        if scope_name in index.saved_scopes:
            return f"""**Saved Scope Reference**

`{scope_name}` was saved with `save_scope_as`

Use this to reference the saved target.
"""
    
    return None
```

### 10.3 Hover Content Examples

| Hover Over | Show |
|------------|------|
| `add_gold` | "**add_gold**\n\nEffect: Adds gold to a character.\n\nUsage: `add_gold = <amount>`\n\nScope: character" |
| `every_vassal` | "**every_vassal**\n\nScope: Iterates over all direct vassals.\n\nParameters: limit, max" |
| `scope:target` | "**Saved Scope Reference**\n\nReferences a scope saved with save_scope_as" |
| `my_mod.0001` | "**Event: my_mod.0001**\n\nDefined in: events/my_events.txt\n\nType: character_event" |

---

## Phase 11: Localization System (Week 14)
**Priority: Low-Medium | Complexity: Medium**

Support localization function validation.

### 11.1 Character Name Functions

```python
LOCALIZATION_FUNCTIONS = {
    # Name functions
    'GetName': 'Full name with title',
    'GetFirstName': 'First name only',
    'GetFirstNameNoTooltip': 'First name without tooltip',
    'GetTitledFirstName': 'Title + first name',
    'GetNamePossessive': "Name's (possessive)",
    'GetFirstNamePossessive': "First name's",
    
    # Gender functions
    'GetSheHe': 'she/he pronoun',
    'GetHerHis': 'her/his possessive',
    'GetHerHim': 'her/him objective',
    'GetHerselfHimself': 'herself/himself reflexive',
    'GetSheHeHasHave': 'she has/he has',
    'GetIsAre': 'is/are based on context',
    
    # Title functions
    'GetTitledName': 'Full titled name',
    'GetLadyLord': 'Lady/Lord title',
    'GetWifeHusband': 'Wife/Husband',
    'GetHeroHeroine': 'Hero/Heroine',
    
    # Value functions
    'GetGold': 'Character gold amount',
    'GetPrestige': 'Character prestige',
    'GetPiety': 'Character piety',
}
```

### 11.2 Text Formatting Validation

```python
# Color codes (paired)
COLOR_CODES = {
    '#P': 'positive (green)',      # Close with #!
    '#N': 'negative (red)',        # Close with #!
    '#high': 'highlighted',        # Close with #!
    '#warning': 'warning color',   # Close with #!
    '#weak': 'weak/gray',          # Close with #!
    '#E': 'emphasized',            # Close with #!
    '#S': 'scope reference',       # Close with #!
}

# Text effects (paired)
TEXT_EFFECTS = {
    '#bold': 'Bold text',          # Close with #!
    '#italic': 'Italic text',      # Close with #!
}

def validate_formatting_pairs(text: str) -> List[Diagnostic]:
    """Ensure all # codes are properly closed with #!"""
    ...
```

### 11.3 Icon References

```python
ICON_REFERENCES = [
    '@gold_icon!',
    '@prestige_icon!',
    '@piety_icon!',
    '@stress_icon!',
    '@dread_icon!',
    '@health_icon!',
    '@prowess_icon!',
    # ... etc
]

def validate_icon_reference(text: str) -> List[Diagnostic]:
    """Validate @icon! references exist."""
    ...
```

### 11.4 Concept Linking

```python
# Validate [concept|E] syntax
def validate_concept_link(text: str) -> List[Diagnostic]:
    """Validate concept references like [martial|E]"""
    pattern = r'\[([a-z_]+)\|E\]'
    # Check concept exists in game data
    ...
```

---

## Phase 12: Go to Definition / Find References with pygls (Week 15)
**Priority: Medium | Complexity: Medium**

Implement navigation features using pygls.

### 12.1 Go to Definition Handler

```python
@server.feature(types.TEXT_DOCUMENT_DEFINITION)
def goto_definition(ls: CK3LanguageServer, params: types.DefinitionParams):
    """Jump to the definition of a symbol."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    word = doc.word_at_position(params.position)
    
    if not word:
        return None
    
    # Check various definition sources
    
    # 1. Event definition
    if word in ls.index.events:
        return ls.index.events[word]  # Returns types.Location
    
    # 2. Scripted effect definition
    if word in ls.index.scripted_effects:
        return ls.index.scripted_effects[word]
    
    # 3. Scripted trigger definition
    if word in ls.index.scripted_triggers:
        return ls.index.scripted_triggers[word]
    
    # 4. Saved scope definition (where save_scope_as was called)
    if word.startswith('scope:'):
        scope_name = word[6:]
        if scope_name in ls.index.saved_scopes:
            return ls.index.saved_scopes[scope_name]
    
    # 5. Script value definition
    if word in ls.index.script_values:
        return ls.index.script_values[word]
    
    return None
```

### 12.2 Find References Handler

```python
@server.feature(types.TEXT_DOCUMENT_REFERENCES)
def find_references(ls: CK3LanguageServer, params: types.ReferenceParams):
    """Find all references to a symbol."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    word = doc.word_at_position(params.position)
    
    if not word:
        return None
    
    references = []
    
    # Search all indexed documents
    for uri, ast in ls.document_asts.items():
        doc = ls.workspace.get_text_document(uri)
        
        # Search for the word in the document
        for linum, line in enumerate(doc.lines):
            import re
            for match in re.finditer(rf'\b{re.escape(word)}\b', line):
                references.append(
                    types.Location(
                        uri=uri,
                        range=types.Range(
                            start=types.Position(line=linum, character=match.start()),
                            end=types.Position(line=linum, character=match.end()),
                        ),
                    )
                )
    
    return references if references else None
```

### 12.3 Navigation Targets

| From | Navigate To |
|------|-------------|
| `trigger_event = { id = my_mod.0002 }` | Event definition |
| `my_custom_effect = yes` | Scripted effect file |
| `my_custom_trigger = yes` | Scripted trigger file |
| `scope:my_saved` | Where `save_scope_as = my_saved` |
| `var:my_variable` | Where `set_variable = { name = my_variable }` |
| `my_script_value` | Script value definition |

---

## Phase 13: Document Symbols with pygls (Week 16)
**Priority: Medium | Complexity: Low**

Show document structure in outline view (Ctrl+Shift+O).

### 13.1 Document Symbol Handler

```python
@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(ls: CK3LanguageServer, params: types.DocumentSymbolParams):
    """Return hierarchical symbols for the document outline."""
    uri = params.text_document.uri
    ast = ls.document_asts.get(uri, [])
    
    if not ast:
        return None
    
    symbols = []
    
    for node in ast:
        if node.type == 'namespace':
            symbols.append(types.DocumentSymbol(
                name=f"namespace: {node.value}",
                kind=types.SymbolKind.Namespace,
                range=node.range,
                selection_range=node.range,
            ))
        
        elif node.type == 'event':
            # Event with nested children
            event_symbol = types.DocumentSymbol(
                name=node.key,
                kind=types.SymbolKind.Event,
                range=node.range,
                selection_range=node.range,
                detail=get_event_type(node),
                children=[],
            )
            
            # Add trigger, immediate, options as children
            for child in node.children:
                if child.key == 'trigger':
                    event_symbol.children.append(types.DocumentSymbol(
                        name="trigger",
                        kind=types.SymbolKind.Property,
                        range=child.range,
                        selection_range=child.range,
                    ))
                elif child.key == 'immediate':
                    event_symbol.children.append(types.DocumentSymbol(
                        name="immediate",
                        kind=types.SymbolKind.Property,
                        range=child.range,
                        selection_range=child.range,
                    ))
                elif child.key == 'option':
                    option_name = get_option_name(child)
                    event_symbol.children.append(types.DocumentSymbol(
                        name=f"option: {option_name}",
                        kind=types.SymbolKind.Method,
                        range=child.range,
                        selection_range=child.range,
                    ))
            
            symbols.append(event_symbol)
    
    return symbols
```

### 13.2 Workspace Symbol Handler

```python
@server.feature(types.WORKSPACE_SYMBOL)
def workspace_symbol(ls: CK3LanguageServer, params: types.WorkspaceSymbolParams):
    """Search for symbols across all open documents."""
    query = params.query.lower()
    results = []
    
    # Search events
    for event_id, location in ls.index.events.items():
        if query == "" or query in event_id.lower():
            results.append(types.WorkspaceSymbol(
                name=event_id,
                kind=types.SymbolKind.Event,
                location=location,
            ))
    
    # Search scripted effects
    for name, location in ls.index.scripted_effects.items():
        if query == "" or query in name.lower():
            results.append(types.WorkspaceSymbol(
                name=name,
                kind=types.SymbolKind.Function,
                location=location,
                container_name="scripted_effects",
            ))
    
    # Search scripted triggers
    for name, location in ls.index.scripted_triggers.items():
        if query == "" or query in name.lower():
            results.append(types.WorkspaceSymbol(
                name=name,
                kind=types.SymbolKind.Function,
                location=location,
                container_name="scripted_triggers",
            ))
    
    return results
```

### 13.3 Symbol Kinds Mapping

| CK3 Construct | SymbolKind |
|---------------|------------|
| namespace | Namespace |
| event | Event |
| trigger block | Property |
| effect block | Property |
| option | Method |
| scripted_effect | Function |
| scripted_trigger | Function |
| script_value | Constant |
| saved_scope | Variable |

---

## Phase 14: Code Actions / Quick Fixes (Week 17)
**Priority: Low-Medium | Complexity: Medium**

Provide automated fixes for common issues.

### 14.1 Quick Fixes for Diagnostics

| Diagnostic | Quick Fix |
|------------|-----------|
| Unknown effect (typo) | "Did you mean 'add_gold'?" → Replace |
| Unknown trigger (typo) | "Did you mean 'is_adult'?" → Replace |
| Missing namespace | "Add namespace declaration" |
| Missing localization key | "Create localization entry" |
| Invalid scope chain | "Did you mean 'liege'?" → Replace |
| Undefined saved scope | "Add save_scope_as in immediate block" |

### 14.2 Refactoring Actions

| Action | Description |
|--------|-------------|
| Extract scripted effect | Move selected effects to common/scripted_effects/ |
| Extract scripted trigger | Move selected triggers to common/scripted_triggers/ |
| Extract script value | Move formula to common/script_values/ |
| Generate localization keys | Create .yml entries for all missing keys |
| Convert to parameterized | Add $PARAM$ placeholders to scripted block |

---

## Phase 15: Workspace-Wide Features (Week 18-19)
**Priority: Low | Complexity: High**

Features that span multiple files.

### 15.1 Workspace Symbol Search (Ctrl+T)

Search across all mod files for:
- Event IDs
- Scripted effects/triggers
- Script values
- Namespaces
- On-actions
- Saved scopes
- Variables

### 15.2 Cross-File Validation

| Validation | Description |
|------------|-------------|
| Undefined scripted effect | Effect used but not defined in common/scripted_effects/ |
| Undefined scripted trigger | Trigger used but not defined in common/scripted_triggers/ |
| Undefined script value | Value used but not defined in common/script_values/ |
| Event chain validation | Verify trigger_event targets exist |
| On-action validation | Verify events referenced in on_actions exist |
| Localization coverage | Find missing localization keys |
| Scope availability | Warn if scope used before event where it's saved |

### 15.3 Mod Descriptor Awareness

Parse `*.mod` file to understand:
- Mod dependencies
- Replace paths
- Supported versions
- Load order implications

---

## Phase 16: Advanced Visual Features (Week 20-21)
**Priority: Low | Complexity: Medium-High**

Additional pygls features for enhanced editor experience.

> **Reference:** See `Documents/integration/` for complete pygls examples.

### 16.1 Semantic Tokens (Rich Syntax Highlighting)

Provide token-level semantic information for enhanced syntax highlighting:

```python
from lsprotocol import types
from functools import reduce
import operator

# Define token types for CK3 scripts
TOKEN_TYPES = [
    "keyword",      # trigger, effect, if, else
    "variable",     # var:name, local_var:name
    "function",     # scripted_effect, scripted_trigger
    "operator",     # =, >, <, >=, <=, !=
    "type",         # character, landed_title, province
    "parameter",    # $PARAM$
    "string",       # "quoted strings"
    "number",       # 100, 0.5, -10
    "comment",      # # comment lines
    "scope",        # scope:name, root, this, prev
    "namespace",    # event namespace
    "event",        # event IDs
]

TOKEN_MODIFIERS = [
    "declaration",   # First definition
    "definition",    # Definition site
    "readonly",      # Constants
    "deprecated",    # Deprecated keywords
]

@server.feature(
    types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL,
    types.SemanticTokensLegend(
        token_types=TOKEN_TYPES,
        token_modifiers=TOKEN_MODIFIERS,
    ),
)
def semantic_tokens_full(ls: CK3LanguageServer, params: types.SemanticTokensParams):
    """Return semantic tokens for rich syntax highlighting."""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    tokens = ls.tokenize_document(doc)  # Use existing parser
    
    data = []
    prev_line = 0
    prev_char = 0
    
    for token in tokens:
        # Encode as 5 integers per token
        data.extend([
            token.line - prev_line,           # Delta line
            token.char - prev_char if token.line == prev_line else token.char,
            token.length,                     # Token length
            TOKEN_TYPES.index(token.type),    # Token type index
            reduce(operator.or_, token.modifiers, 0),  # Modifier bitmask
        ])
        prev_line = token.line
        prev_char = token.char
    
    return types.SemanticTokens(data=data)
```

**CK3-specific token types:**
| Token | Type | Modifiers |
|-------|------|-----------|
| `has_trait` | keyword | - |
| `scope:friend` | scope | - |
| `save_scope_as` | keyword | definition |
| `$GOLD_AMOUNT$` | parameter | - |
| `my_scripted_effect` | function | - |
| `# comment` | comment | - |

### 16.2 Inlay Hints

Show inline hints for scope types and parameter values:

```python
@server.feature(types.TEXT_DOCUMENT_INLAY_HINT)
def inlay_hints(ls: CK3LanguageServer, params: types.InlayHintParams):
    """Show scope types and parameter hints inline."""
    items = []
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ast = ls.document_asts.get(doc.uri, [])
    
    # Only process visible range for performance
    start_line = params.range.start.line
    end_line = params.range.end.line
    
    for node in ast:
        if not (start_line <= node.line <= end_line):
            continue
            
        # Show scope type after scope changes
        if node.key in SCOPE_CHANGING_EFFECTS:
            result_scope = get_resulting_scope(node)
            items.append(
                types.InlayHint(
                    label=f": {result_scope}",
                    kind=types.InlayHintKind.Type,
                    position=types.Position(line=node.line, character=node.end_char),
                    padding_left=True,
                )
            )
    
    return items
```

**CK3-specific inlay hints:**
- Scope type after `liege = {` → `: character`
- Parameter type after `$AMOUNT$` → `: int`
- Event target scope after `save_scope_as = friend` → `scope:friend: character`

### 16.3 Code Lens

Show actionable information above events and scripted blocks:

```python
@server.feature(types.TEXT_DOCUMENT_CODE_LENS)
def code_lens(ls: CK3LanguageServer, params: types.CodeLensParams):
    """Show reference counts and actions above definitions."""
    items = []
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ast = ls.document_asts.get(doc.uri, [])
    
    for node in ast:
        # Show reference count for events
        if node.key == 'namespace':
            namespace = node.value
            event_count = count_events_in_namespace(ast, namespace)
            items.append(
                types.CodeLens(
                    range=node_to_range(node),
                    data={"type": "event_count", "namespace": namespace},
                )
            )
        
        # Show "Run Event" lens for events
        if is_event_definition(node):
            items.append(
                types.CodeLens(
                    range=node_to_range(node),
                    data={"type": "run_event", "event_id": get_event_id(node)},
                )
            )
    
    return items

@server.feature(types.CODE_LENS_RESOLVE)
def code_lens_resolve(ls: CK3LanguageServer, item: types.CodeLens):
    """Resolve code lens command."""
    if item.data["type"] == "event_count":
        count = ls.index.count_events(item.data["namespace"])
        item.command = types.Command(
            title=f"{count} events in namespace",
            command="",  # No action, just informational
        )
    elif item.data["type"] == "run_event":
        item.command = types.Command(
            title="▶ Run Event",
            command="ck3.runEvent",
            arguments=[item.data["event_id"]],
        )
    return item
```

**CK3-specific code lenses:**
| Lens | Location | Action |
|------|----------|--------|
| `5 references` | Event definition | Find all trigger_event calls |
| `▶ Run Event` | Event definition | Copy console command |
| `2 overrides` | Scripted effect | Show vanilla vs mod versions |

### 16.4 Threading for Long Operations

Use `@server.thread()` for expensive operations:

```python
@server.thread()
@server.feature(types.WORKSPACE_SYMBOL)
def workspace_symbols(ls: CK3LanguageServer, params: types.WorkspaceSymbolParams):
    """Search workspace - runs in thread to avoid blocking."""
    # Long-running workspace search
    return search_all_files(ls.workspace, params.query)

@server.thread()
@server.command("ck3.reindexWorkspace")
def reindex_workspace(ls: CK3LanguageServer, *args):
    """Reindex all mod files - runs in background thread."""
    ls.show_message("Reindexing workspace...", types.MessageType.Info)
    
    for folder in ls.workspace.folders:
        for file in glob.glob(f"{folder}/**/*.txt", recursive=True):
            ls.index.add_file(file)
    
    ls.show_message("Reindexing complete!", types.MessageType.Info)
```

**When to use threading:**
| Operation | Use `@server.thread()` |
|-----------|------------------------|
| Single file diagnostics | No |
| Workspace-wide search | Yes |
| External tool calls | Yes |
| Index building | Yes |
| Simple completions | No |

---

## Phase 17: Server Infrastructure (Week 22)
**Priority: Medium | Complexity: Medium**

Production-ready server features.

### 17.1 Progress Reporting

Show progress for long operations:

```python
@server.feature("workspace/executeCommand")
async def execute_command(ls: CK3LanguageServer, params: types.ExecuteCommandParams):
    if params.command == "ck3.validateWorkspace":
        token = "validate-progress"
        
        # Create and start progress
        ls.progress.create(token)
        ls.progress.begin(token, "Validating mod files...", percentage=0)
        
        files = list_all_mod_files(ls.workspace)
        for i, file in enumerate(files):
            # Report progress
            percent = int((i / len(files)) * 100)
            ls.progress.report(token, f"Checking {file.name}...", percentage=percent)
            
            validate_file(file)
        
        # End progress
        ls.progress.end(token, "Validation complete!")
```

### 17.2 Configuration Support

Read user settings from VS Code:

```python
@server.feature("workspace/didChangeConfiguration")
async def did_change_config(ls: CK3LanguageServer, params):
    """Handle configuration changes."""
    config = await ls.get_configuration_async("ck3LanguageServer")
    
    if config:
        ls.settings = {
            "validateOnSave": config.get("validateOnSave", True),
            "maxDiagnostics": config.get("maxDiagnostics", 100),
            "gameDataPath": config.get("gameDataPath", ""),
            "enableSemanticTokens": config.get("enableSemanticTokens", True),
        }
```

### 17.3 Show Messages and Logging

Communicate with the user:

```python
# Show popup messages
server.show_message("Error: Invalid scope chain", types.MessageType.Error)
server.show_message("Mod loaded successfully", types.MessageType.Info)

# Log to output channel
server.show_message_log("Debug: Parsed 150 events", types.MessageType.Log)
```

### 17.4 Workspace Edit Application

Apply edits programmatically (for code actions):

```python
async def apply_fix(ls: CK3LanguageServer, uri: str, edit: types.TextEdit):
    """Apply a quick fix to the document."""
    result = await ls.apply_edit_async(
        types.WorkspaceEdit(
            changes={uri: [edit]}
        )
    )
    
    if result.applied:
        ls.show_message("Fix applied!", types.MessageType.Info)
    else:
        ls.show_message(f"Fix failed: {result.failure_reason}", types.MessageType.Error)
```

---

## Implementation Priority Matrix

| Phase | Weeks | Priority | Features |
|-------|-------|----------|----------|
| 1 | 1-2 | Critical | Parser foundation, basic AST |
| 2 | 3-4 | Critical | Scope system, navigation, saved scopes |
| 3 | 5 | High | Script lists (any_, every_, random_, ordered_) |
| 4 | 6 | High | Script values, formulas, conditionals |
| 5 | 7 | Med-High | Variables (var:, local_var:, global_var:) |
| 6 | 8 | Medium | Scripted triggers/effects, parameters |
| 7 | 9-10 | High | Event system, portraits, descriptions |
| 8 | 11 | High | Diagnostics (syntax + semantic) |
| 9 | 12 | High | Context-aware + scope-aware completions |
| 10 | 13 | Medium | Hover documentation |
| 11 | 14 | Low-Med | Localization functions |
| 12 | 15 | Medium | Go to definition / Find references |
| 13 | 16 | Medium | Document symbols / Outline |
| 14 | 17 | Low-Med | Code actions / Quick fixes |
| 15 | 18-19 | Low | Workspace-wide features |
| 16 | 20-21 | Low | Semantic tokens, inlay hints, code lens |
| 17 | 22 | Medium | Progress, config, messages, workspace edits |

---

## pygls API Coverage Checklist

Features from the pygls API and their implementation status:

### Core Server Features
| Feature | pygls Method | Phase | Status |
|---------|-------------|-------|--------|
| Document sync (open) | `TEXT_DOCUMENT_DID_OPEN` | 1 | ✅ Exists |
| Document sync (change) | `TEXT_DOCUMENT_DID_CHANGE` | 1 | ✅ Exists |
| Document sync (close) | `TEXT_DOCUMENT_DID_CLOSE` | 1 | ✅ Exists |
| Completions | `TEXT_DOCUMENT_COMPLETION` | 9 | ✅ Exists |
| Completion resolve | `COMPLETION_ITEM_RESOLVE` | 9 | Planned |
| Diagnostics (push) | `publish_diagnostics()` | 8 | Planned |
| Diagnostics (pull) | `TEXT_DOCUMENT_DIAGNOSTIC` | 8 | Optional |

### Navigation Features
| Feature | pygls Method | Phase | Status |
|---------|-------------|-------|--------|
| Hover | `TEXT_DOCUMENT_HOVER` | 10 | Planned |
| Go to definition | `TEXT_DOCUMENT_DEFINITION` | 12 | Planned |
| Find references | `TEXT_DOCUMENT_REFERENCES` | 12 | Planned |
| Document symbols | `TEXT_DOCUMENT_DOCUMENT_SYMBOL` | 13 | Planned |
| Workspace symbols | `WORKSPACE_SYMBOL` | 15 | Planned |
| Document links | `TEXT_DOCUMENT_DOCUMENT_LINK` | 11 | Planned |

### Editing Features
| Feature | pygls Method | Phase | Status |
|---------|-------------|-------|--------|
| Code actions | `TEXT_DOCUMENT_CODE_ACTION` | 14 | Planned |
| Rename | `TEXT_DOCUMENT_RENAME` | 15 | Optional |
| Formatting | `TEXT_DOCUMENT_FORMATTING` | - | Not planned |

### Visual Features
| Feature | pygls Method | Phase | Status |
|---------|-------------|-------|--------|
| Semantic tokens | `TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL` | 16 | Planned |
| Inlay hints | `TEXT_DOCUMENT_INLAY_HINT` | 16 | Planned |
| Code lens | `TEXT_DOCUMENT_CODE_LENS` | 16 | Planned |
| Document color | `TEXT_DOCUMENT_DOCUMENT_COLOR` | - | Not applicable |

### Infrastructure
| Feature | pygls Method | Phase | Status |
|---------|-------------|-------|--------|
| Progress reporting | `progress.create/begin/report/end` | 17 | Planned |
| Configuration | `get_configuration_async()` | 17 | Planned |
| Show message | `show_message()` | 17 | Planned |
| Log message | `show_message_log()` | 17 | Planned |
| Apply workspace edit | `apply_edit_async()` | 14 | Planned |
| Custom commands | `@server.command()` | 14 | Planned |
| Threaded handlers | `@server.thread()` | 15, 16 | Planned |

---

## File Structure After Implementation

> **🔧 Modularity:** Game data is separated into `data/` directory. Adding new traits, effects, or scopes means editing data files, not Python code.

```
pychivalry/
├── __init__.py
├── server.py              # LSP protocol handling ONLY (thin wrapper)
├── ck3_language.py        # Language definitions (existing)
├── parser.py              # CK3 script parser (syntax → AST)
├── indexer.py             # Document/workspace indexer
│
├── # Feature Modules (one concern per file)
├── scopes.py              # Scope type logic (uses data/scopes/)
├── lists.py               # Script list handling (any_, every_, etc.)
├── script_values.py       # Script value and formula validation
├── variables.py           # Variable tracking and validation
├── scripted_blocks.py     # Scripted triggers/effects parsing
├── events.py              # Event structure validation
├── diagnostics.py         # Validation logic (uses registries)
├── documentation.py       # Hover documentation logic
├── completions.py         # Context-aware completions
├── localization.py        # Localization function validation
├── symbols.py             # Symbol providers
├── actions.py             # Code actions
│
├── # Data Directory (edit these to add new game content)
├── data/
│   ├── __init__.py        # Loaders for all data files
│   ├── scopes/
│   │   ├── character.yaml # Character scope: promotions, effects, triggers
│   │   ├── title.yaml     # Landed title scope definitions
│   │   ├── province.yaml  # Province scope definitions
│   │   └── ...            # One file per scope type
│   ├── traits/
│   │   ├── personality.yaml   # Personality traits (brave, craven, etc.)
│   │   ├── lifestyle.yaml     # Lifestyle traits
│   │   ├── health.yaml        # Health-related traits
│   │   └── congenital.yaml    # Genetic traits
│   ├── effects/
│   │   ├── character.yaml     # Character effects (add_gold, kill, etc.)
│   │   ├── title.yaml         # Title effects
│   │   └── scope_change.yaml  # Scope-changing effects (every_, random_)
│   ├── triggers/
│   │   ├── character.yaml     # Character triggers (is_adult, has_trait)
│   │   ├── comparison.yaml    # Comparison operators
│   │   └── logical.yaml       # AND, OR, NOT, etc.
│   └── events/
│       ├── themes.yaml        # Valid event themes
│       └── portrait_animations.yaml  # Portrait animation values
│
└── # Optional: Plugin Architecture
    └── plugins/              # For mod-specific extensions
        └── carnalitas.py     # Example: Carnalitas mod support
```

### Data File Format (Example: traits/personality.yaml)

```yaml
# pychivalry/data/traits/personality.yaml
# Edit this file to add new personality traits - no Python changes needed!

traits:
  brave:
    category: personality
    opposites: [craven]
    description: "This character is courageous in the face of danger."
    modifiers:
      monthly_prestige: 1
      prowess: 2
      
  craven:
    category: personality
    opposites: [brave]
    description: "This character lacks courage."
    modifiers:
      monthly_prestige: -1
      prowess: -2
      
  # Add new traits here following the same pattern
  # The server will automatically pick them up on restart
```

---

## Quick Start: Recommended First Steps

### Step 1: Basic Parser (Week 1)
```python
# parser.py - Start simple
def parse_document(text: str) -> List[CK3Node]:
    """Parse CK3 script into nodes."""
    # 1. Tokenize: split into tokens (keys, =, values, {, }, comments)
    # 2. Parse: build tree structure
    # 3. Return flat list of nodes with parent references
```

### Step 2: Scope System (Week 2)
```python
# scopes.py - Define scope types
SCOPE_TYPES = {
    'character': {...},
    'landed_title': {...},
    # ... etc
}

def validate_scope_chain(chain: str, starting_scope: str) -> Tuple[bool, str]:
    """Validate dot notation scope chains."""
    ...
```

### Step 3: Simple Diagnostics (Week 3)
```python
# diagnostics.py - Bracket matching first
def check_brackets(doc: TextDocument) -> List[Diagnostic]:
    """Check for unclosed/unmatched brackets."""
    stack = []
    for line_num, line in enumerate(doc.lines):
        for char_num, char in enumerate(line):
            if char == '{':
                stack.append((line_num, char_num))
            elif char == '}':
                if not stack:
                    # Error: unmatched closing bracket
                    ...
                stack.pop()
    # Any remaining in stack = unclosed brackets
```

### Step 4: Hover for Keywords (Week 4)
```python
# Add to server.py
@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(params: types.HoverParams):
    word = doc.word_at_position(params.position)
    if word in CK3_EFFECTS:
        return types.Hover(
            contents=types.MarkupContent(
                kind=types.MarkupKind.Markdown,
                value=get_effect_documentation(word)
            )
        )
```

---

## Testing Strategy

Testing is critical for a language server. We'll use pytest with pygls's testing utilities.

### Test Directory Structure

```
tests/
├── __init__.py
├── conftest.py              # Shared fixtures
├── fixtures/                # Test CK3 files
│   ├── valid_event.txt
│   ├── syntax_errors.txt
│   ├── semantic_errors.txt
│   ├── scope_chains.txt
│   ├── script_lists.txt
│   ├── script_values.txt
│   └── variables.txt
├── test_parser.py           # Parser unit tests
├── test_scopes.py           # Scope system tests
├── test_lists.py            # Script list tests
├── test_script_values.py    # Formula/value tests
├── test_variables.py        # Variable system tests
├── test_diagnostics.py      # Diagnostic tests
├── test_completions.py      # Completion tests
├── test_hover.py            # Hover tests
├── test_goto.py             # Navigation tests
├── test_symbols.py          # Symbol tests
└── test_integration.py      # End-to-end tests
```

### Setting Up Test Fixtures (conftest.py)

```python
import pytest
from pathlib import Path
from lsprotocol import types
from pygls.workspace import Workspace, TextDocument

from pychivalry.server import CK3LanguageServer
from pychivalry.parser import parse_document

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def server():
    """Create a fresh language server instance for testing."""
    return CK3LanguageServer("test-server", "v0.1.0")


@pytest.fixture
def workspace(tmp_path):
    """Create a workspace for testing."""
    return Workspace(str(tmp_path))


@pytest.fixture
def sample_event_text():
    """Sample valid event text."""
    return '''
namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    theme = intrigue
    
    left_portrait = root
    
    trigger = {
        is_adult = yes
        is_ruler = yes
    }
    
    immediate = {
        save_scope_as = main_character
    }
    
    option = {
        name = test_mod.0001.a
        add_gold = 100
    }
}
'''


@pytest.fixture
def sample_doc(workspace, sample_event_text, tmp_path):
    """Create a sample text document."""
    uri = (tmp_path / "test_event.txt").as_uri()
    return TextDocument(uri=uri, source=sample_event_text)


@pytest.fixture
def syntax_error_text():
    """Sample text with syntax errors."""
    return '''
namespace = test_mod

test_mod.0001 = {
    type = character_event
    trigger = {
        is_adult = yes
    # Missing closing bracket
    
    option = {
        name = test_mod.0001.a
    }
}
'''


@pytest.fixture
def scope_chain_text():
    """Sample text with scope chains."""
    return '''
test_mod.0001 = {
    type = character_event
    trigger = {
        liege = {
            primary_title = {
                holder = { is_adult = yes }
            }
        }
    }
    immediate = {
        liege.primary_title.holder = { save_scope_as = target }
        scope:target = { add_gold = 100 }
    }
}
'''
```

### Parser Tests (test_parser.py)

```python
import pytest
from pychivalry.parser import parse_document, CK3Node, get_node_at_position
from lsprotocol import types


class TestParser:
    """Tests for the CK3 script parser."""
    
    def test_parse_empty_document(self):
        """Parser handles empty documents."""
        ast = parse_document("")
        assert ast == []
    
    def test_parse_namespace(self, sample_event_text):
        """Parser extracts namespace declarations."""
        ast = parse_document(sample_event_text)
        namespaces = [n for n in ast if n.type == 'namespace']
        assert len(namespaces) == 1
        assert namespaces[0].value == 'test_mod'
    
    def test_parse_event(self, sample_event_text):
        """Parser extracts event definitions."""
        ast = parse_document(sample_event_text)
        events = [n for n in ast if n.type == 'event']
        assert len(events) == 1
        assert events[0].key == 'test_mod.0001'
    
    def test_parse_nested_blocks(self, sample_event_text):
        """Parser correctly nests blocks."""
        ast = parse_document(sample_event_text)
        event = [n for n in ast if n.type == 'event'][0]
        
        # Find trigger block
        trigger = next((c for c in event.children if c.key == 'trigger'), None)
        assert trigger is not None
        assert trigger.type == 'block'
    
    def test_parse_assignments(self, sample_event_text):
        """Parser extracts assignments."""
        ast = parse_document(sample_event_text)
        event = [n for n in ast if n.type == 'event'][0]
        
        # Find type assignment
        type_node = next((c for c in event.children if c.key == 'type'), None)
        assert type_node is not None
        assert type_node.value == 'character_event'
    
    def test_parse_with_comments(self):
        """Parser handles comments correctly."""
        text = '''
# This is a comment
namespace = test # inline comment
'''
        ast = parse_document(text)
        comments = [n for n in ast if n.type == 'comment']
        assert len(comments) >= 1
    
    def test_node_ranges(self, sample_event_text):
        """Parser assigns correct ranges to nodes."""
        ast = parse_document(sample_event_text)
        for node in ast:
            assert isinstance(node.range, types.Range)
            assert node.range.start.line >= 0
            assert node.range.end.line >= node.range.start.line
    
    def test_get_node_at_position(self, sample_event_text):
        """Can find node at cursor position."""
        ast = parse_document(sample_event_text)
        # Position inside trigger block
        pos = types.Position(line=12, character=10)
        node = get_node_at_position(ast, pos)
        assert node is not None


class TestParserEdgeCases:
    """Edge case tests for the parser."""
    
    def test_deeply_nested_blocks(self):
        """Parser handles deeply nested structures."""
        text = '''
a = { b = { c = { d = { e = yes } } } }
'''
        ast = parse_document(text)
        assert len(ast) > 0
    
    def test_operators(self):
        """Parser recognizes all comparison operators."""
        text = '''
trigger = {
    age > 16
    age >= 18
    gold < 100
    prestige <= 500
    culture != root.culture
}
'''
        ast = parse_document(text)
        assert len(ast) > 0
    
    def test_scope_chain_parsing(self):
        """Parser identifies scope chains."""
        text = '''
liege.primary_title.holder = { is_adult = yes }
'''
        ast = parse_document(text)
        chains = [n for n in ast if n.type == 'scope_chain']
        # Should recognize the chain
        assert len([n for n in ast if '.' in str(n.key)]) > 0
    
    def test_saved_scope_parsing(self):
        """Parser identifies saved scope references."""
        text = '''
scope:my_target = { add_gold = 100 }
'''
        ast = parse_document(text)
        # Should recognize scope: prefix
        assert any('scope:' in str(n.key) for n in ast)
```

### Scope System Tests (test_scopes.py)

```python
import pytest
from pychivalry.scopes import (
    SCOPE_TYPES,
    get_valid_links,
    validate_scope_chain,
    get_resulting_scope,
)


class TestScopeTypes:
    """Tests for scope type definitions."""
    
    def test_character_scope_exists(self):
        """Character scope is defined."""
        assert 'character' in SCOPE_TYPES
    
    def test_character_has_links(self):
        """Character scope has valid links."""
        links = SCOPE_TYPES['character'].get('links', [])
        assert 'liege' in links
        assert 'spouse' in links
        assert 'father' in links
    
    def test_character_has_triggers(self):
        """Character scope has valid triggers."""
        triggers = SCOPE_TYPES['character'].get('triggers', [])
        assert 'is_adult' in triggers
        assert 'is_alive' in triggers
    
    def test_character_has_effects(self):
        """Character scope has valid effects."""
        effects = SCOPE_TYPES['character'].get('effects', [])
        assert 'add_gold' in effects
        assert 'add_prestige' in effects
    
    def test_landed_title_scope_exists(self):
        """Landed title scope is defined."""
        assert 'landed_title' in SCOPE_TYPES
    
    def test_province_scope_exists(self):
        """Province scope is defined."""
        assert 'province' in SCOPE_TYPES


class TestScopeNavigation:
    """Tests for scope chain validation."""
    
    def test_valid_single_link(self):
        """Single valid scope link passes."""
        valid, result = validate_scope_chain('liege', 'character')
        assert valid is True
        assert result == 'character'  # liege returns a character
    
    def test_valid_chain(self):
        """Valid scope chain passes."""
        valid, result = validate_scope_chain(
            'liege.primary_title.holder', 
            'character'
        )
        assert valid is True
        assert result == 'character'
    
    def test_invalid_link(self):
        """Invalid scope link fails."""
        valid, error = validate_scope_chain('invalid_link', 'character')
        assert valid is False
        assert 'not valid' in error
    
    def test_invalid_chain_middle(self):
        """Invalid link in middle of chain fails."""
        valid, error = validate_scope_chain(
            'liege.invalid.holder', 
            'character'
        )
        assert valid is False
    
    def test_universal_scopes(self):
        """Universal scopes (root, this, prev) are valid everywhere."""
        for scope in ['root', 'this', 'prev', 'from']:
            links = get_valid_links('character')
            assert scope in links
    
    def test_get_resulting_scope(self):
        """get_resulting_scope returns correct target scope."""
        assert get_resulting_scope('character', 'liege') == 'character'
        assert get_resulting_scope('character', 'primary_title') == 'landed_title'
```

### Diagnostics Tests (test_diagnostics.py)

```python
import pytest
from lsprotocol import types
from pychivalry.diagnostics import (
    check_syntax,
    check_semantics,
    check_scopes,
    create_diagnostic,
)
from pychivalry.parser import parse_document


class TestSyntaxDiagnostics:
    """Tests for syntax error detection."""
    
    def test_unclosed_bracket(self, syntax_error_text):
        """Detects unclosed brackets."""
        ast = parse_document(syntax_error_text)
        diagnostics = check_syntax(syntax_error_text, ast)
        
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0
        assert any('bracket' in d.message.lower() for d in errors)
    
    def test_valid_syntax_no_errors(self, sample_event_text):
        """Valid syntax produces no syntax errors."""
        ast = parse_document(sample_event_text)
        diagnostics = check_syntax(sample_event_text, ast)
        
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) == 0
    
    def test_orphan_closing_bracket(self):
        """Detects orphan closing brackets."""
        text = '''
}
namespace = test
'''
        ast = parse_document(text)
        diagnostics = check_syntax(text, ast)
        
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0


class TestSemanticDiagnostics:
    """Tests for semantic error detection."""
    
    def test_unknown_effect_warning(self):
        """Unknown effects produce warnings."""
        text = '''
effect = {
    add_goldd = 100  # typo
}
'''
        ast = parse_document(text)
        diagnostics = check_semantics(ast, None)
        
        warnings = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Warning]
        assert len(warnings) > 0
    
    def test_effect_in_trigger_block(self):
        """Effects in trigger blocks produce errors."""
        text = '''
trigger = {
    add_gold = 100  # effect in trigger block!
}
'''
        ast = parse_document(text)
        diagnostics = check_semantics(ast, None)
        
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0
    
    def test_valid_semantics_no_errors(self, sample_event_text):
        """Valid semantics produce no errors."""
        ast = parse_document(sample_event_text)
        diagnostics = check_semantics(ast, None)
        
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        # May have warnings for custom triggers, but no errors
        assert len(errors) == 0


class TestScopeDiagnostics:
    """Tests for scope-related diagnostics."""
    
    def test_invalid_scope_chain(self):
        """Invalid scope chains produce errors."""
        text = '''
immediate = {
    liege.invalid_link = { add_gold = 100 }
}
'''
        ast = parse_document(text)
        diagnostics = check_scopes(ast, None)
        
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0
    
    def test_undefined_saved_scope(self):
        """Using undefined saved scopes produces warnings."""
        text = '''
immediate = {
    scope:undefined_scope = { add_gold = 100 }
}
'''
        ast = parse_document(text)
        diagnostics = check_scopes(ast, None)
        
        warnings = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Warning]
        assert len(warnings) > 0


class TestDiagnosticCreation:
    """Tests for diagnostic object creation."""
    
    def test_create_diagnostic(self):
        """create_diagnostic creates valid objects."""
        diag = create_diagnostic(
            message="Test error",
            range_=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            severity=types.DiagnosticSeverity.Error,
            code="CK3001",
        )
        
        assert diag.message == "Test error"
        assert diag.severity == types.DiagnosticSeverity.Error
        assert diag.code == "CK3001"
        assert diag.source == "ck3-ls"
```

### Completion Tests (test_completions.py)

```python
import pytest
from lsprotocol import types
from pychivalry.completions import (
    get_completions_for_context,
    get_trigger_completions,
    get_effect_completions,
    get_scope_link_completions,
)


class TestContextAwareCompletions:
    """Tests for context-aware completion filtering."""
    
    def test_trigger_context_returns_triggers(self):
        """Trigger context returns only triggers."""
        items = get_completions_for_context('trigger', 'character')
        
        labels = [item.label for item in items]
        assert 'is_adult' in labels
        assert 'is_alive' in labels
        # Effects should not be included
        assert 'add_gold' not in labels
    
    def test_effect_context_returns_effects(self):
        """Effect context returns only effects."""
        items = get_completions_for_context('effect', 'character')
        
        labels = [item.label for item in items]
        assert 'add_gold' in labels
        assert 'add_prestige' in labels
        # Triggers should not be included (except in limit blocks)
        assert 'is_adult' not in labels
    
    def test_scope_chain_context_returns_links(self):
        """Scope chain context returns valid links."""
        items = get_completions_for_context('scope_chain', 'character')
        
        labels = [item.label for item in items]
        assert 'liege' in labels
        assert 'spouse' in labels


class TestCompletionItems:
    """Tests for completion item properties."""
    
    def test_trigger_completions_have_correct_kind(self):
        """Trigger completions have Function kind."""
        items = get_trigger_completions('character')
        
        for item in items:
            assert item.kind == types.CompletionItemKind.Function
    
    def test_effect_completions_have_correct_kind(self):
        """Effect completions have Function kind."""
        items = get_effect_completions('character')
        
        for item in items:
            assert item.kind == types.CompletionItemKind.Function
    
    def test_scope_link_completions_have_correct_kind(self):
        """Scope link completions have Variable kind."""
        items = get_scope_link_completions('character')
        
        for item in items:
            assert item.kind == types.CompletionItemKind.Variable
    
    def test_completions_have_documentation(self):
        """Completions include documentation."""
        items = get_trigger_completions('character')
        
        # At least some should have documentation
        with_docs = [i for i in items if i.documentation is not None]
        assert len(with_docs) > 0
```

### Integration Tests (test_integration.py)

```python
import pytest
from lsprotocol import types
from pygls.workspace import TextDocument

from pychivalry.server import CK3LanguageServer


class TestServerIntegration:
    """End-to-end integration tests."""
    
    def test_server_creation(self):
        """Server can be created."""
        server = CK3LanguageServer("test-server", "v0.1.0")
        assert server is not None
    
    def test_document_parsing_on_open(self, server, sample_doc):
        """Documents are parsed when opened."""
        # Simulate document open
        server.parse_document(sample_doc)
        
        assert sample_doc.uri in server.document_asts
        assert len(server.document_asts[sample_doc.uri]) > 0
    
    def test_index_updated_on_parse(self, server, sample_doc):
        """Index is updated when documents are parsed."""
        server.parse_document(sample_doc)
        
        # Event should be indexed
        assert 'test_mod.0001' in server.index.events
    
    def test_completions_return_items(self, server, sample_doc):
        """Completions return items for valid positions."""
        server.parse_document(sample_doc)
        
        # Request completions at a position
        params = types.CompletionParams(
            text_document=types.TextDocumentIdentifier(uri=sample_doc.uri),
            position=types.Position(line=10, character=8),
        )
        
        # Call the completion handler directly
        from pychivalry.server import completions
        result = completions(server, params)
        
        assert result is not None
        assert len(result.items) > 0
    
    def test_hover_returns_content(self, server, sample_doc):
        """Hover returns content for known symbols."""
        server.parse_document(sample_doc)
        server.workspace._text_documents[sample_doc.uri] = sample_doc
        
        # Request hover at "is_adult" position
        params = types.HoverParams(
            text_document=types.TextDocumentIdentifier(uri=sample_doc.uri),
            position=types.Position(line=12, character=8),
        )
        
        from pychivalry.server import hover
        result = hover(server, params)
        
        # May or may not return content depending on exact position
        # Just verify it doesn't crash
        assert result is None or isinstance(result, types.Hover)
    
    def test_diagnostics_published(self, server, sample_doc):
        """Diagnostics are generated for documents."""
        server.parse_document(sample_doc)
        
        from pychivalry.diagnostics import check_syntax, check_semantics
        ast = server.document_asts[sample_doc.uri]
        
        syntax_diags = check_syntax(sample_doc.source, ast)
        semantic_diags = check_semantics(ast, server.index)
        
        # Valid document should have no errors
        all_diags = syntax_diags + semantic_diags
        errors = [d for d in all_diags if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) == 0


class TestRealWorldFiles:
    """Tests with real-world CK3 mod files."""
    
    @pytest.fixture
    def fixtures_dir(self):
        """Path to test fixtures."""
        from pathlib import Path
        return Path(__file__).parent / "fixtures"
    
    def test_valid_event_file(self, server, fixtures_dir):
        """Parser handles valid event files."""
        if not (fixtures_dir / "valid_event.txt").exists():
            pytest.skip("Fixture file not found")
        
        text = (fixtures_dir / "valid_event.txt").read_text()
        doc = TextDocument(uri="file:///test.txt", source=text)
        
        server.parse_document(doc)
        
        # Should parse without crashing
        assert doc.uri in server.document_asts
    
    def test_syntax_errors_file(self, server, fixtures_dir):
        """Parser handles files with syntax errors."""
        if not (fixtures_dir / "syntax_errors.txt").exists():
            pytest.skip("Fixture file not found")
        
        text = (fixtures_dir / "syntax_errors.txt").read_text()
        doc = TextDocument(uri="file:///test.txt", source=text)
        
        server.parse_document(doc)
        
        from pychivalry.diagnostics import check_syntax
        ast = server.document_asts.get(doc.uri, [])
        diagnostics = check_syntax(text, ast)
        
        # Should detect errors
        assert len(diagnostics) > 0
```

### Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_parser.py -v

# Run with coverage
pytest tests/ --cov=pychivalry --cov-report=html

# Run tests matching a pattern
pytest tests/ -k "test_scope" -v

# Run with output visible
pytest tests/ -v -s
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
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
]
```

---

## Success Criteria

Before each release, verify:

### Parser (v0.2.0)
- [ ] Parses all valid CK3 syntax patterns
- [ ] Generates correct AST with ranges
- [ ] Handles malformed input gracefully
- [ ] `get_node_at_position` works correctly

### Scope System (v0.3.0)
- [ ] All Jomini scope types defined
- [ ] Scope chain validation works
- [ ] Saved scope tracking accurate
- [ ] Universal scopes (root, this, prev, from) recognized

### Script Lists (v0.4.0)
- [ ] All four prefixes (any_, every_, random_, ordered_) supported
- [ ] List parameters validated
- [ ] Context detection (trigger vs effect) correct

### Diagnostics (v0.8.0)
- [ ] Syntax errors detected accurately
- [ ] Semantic errors produce correct severity
- [ ] No false positives on valid Jomini syntax
- [ ] Diagnostics cleared when documents close

### Completions (v0.9.0)
- [ ] Context-aware filtering works
- [ ] Scope-aware completions accurate
- [ ] Snippets expand correctly
- [ ] Performance acceptable (< 100ms)

### Navigation (v0.12.0)
- [ ] Go to definition works for events
- [ ] Go to definition works for saved scopes
- [ ] Find references finds all usages
- [ ] Workspace symbols searchable

### Overall (v1.0.0)
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] Real Rance Quest mod files validate correctly
- [ ] No crashes on any input

---

## Resources

- [pygls Documentation](https://pygls.readthedocs.io/)
- [pygls Integration Examples](./Documents/integration/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/specification.html)
- [Grand Jomini Modding Guide](../Crusader-Kings-workspace/docs/modding-guide/)
- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding)
- [lsprotocol Types Reference](https://github.com/microsoft/lsprotocol)

---

## Version Milestones

| Version | Features |
|---------|----------|
| **v0.2.0** | Basic parser + AST generation |
| **v0.3.0** | Scope system + chain validation |
| **v0.4.0** | Script lists (any_, every_, random_, ordered_) |
| **v0.5.0** | Script values + formulas |
| **v0.6.0** | Variables system |
| **v0.7.0** | Scripted triggers/effects |
| **v0.8.0** | Diagnostics (syntax + semantic) |
| **v0.9.0** | Context + scope-aware completions |
| **v0.10.0** | Hover documentation |
| **v0.11.0** | Localization validation |
| **v0.12.0** | Go to definition / Find references |
| **v0.13.0** | Document symbols / Outline |
| **v1.0.0** | Full workspace support + code actions |
