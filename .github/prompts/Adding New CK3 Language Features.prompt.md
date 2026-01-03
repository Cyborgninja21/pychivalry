# Adding New CK3 Language Features

**Purpose:** Guide for adding support for new CK3 scripting language features to pychivalry.

**Use this when:** Adding new CK3 effects, triggers, scopes, keywords, or other game-specific language elements.

---

## Understanding CK3 Language Elements

CK3 scripting has several types of language elements:

1. **Keywords:** `if`, `else`, `trigger`, `effect`, `limit`, `namespace`
2. **Effects:** `add_trait`, `add_gold`, `trigger_event`, `save_scope_as`
3. **Triggers:** `has_trait`, `is_ruler`, `age`, `gold`
4. **Scopes:** `root`, `prev`, `liege`, `primary_title`
5. **List Iterators:** `any_vassal`, `every_courtier`, `random_realm_province`
6. **Event Types:** `character_event`, `letter_event`, `court_event`
7. **Script Values:** Formulas with `value`, `add`, `multiply`, etc.

## Adding New Keywords

### 1. Update Language Definitions

Edit `pychivalry/ck3_language.py`:

```python
# CK3 Keywords
KEYWORDS = {
    # Control flow
    "if": {
        "description": "Conditional execution",
        "example": "if = { has_trait = brave }",
        "category": "control_flow"
    },
    "else": {
        "description": "Alternative branch",
        "example": "else = { add_trait = craven }",
        "category": "control_flow"
    },
    # Add new keyword
    "new_keyword": {
        "description": "Description of the keyword",
        "example": "new_keyword = { ... }",
        "category": "control_flow"
    },
}
```

### 2. Update Parser (if needed)

If the keyword has special syntax, update `pychivalry/parser.py`:

```python
def parse_statement(self):
    """Parse a statement."""
    if self.current_token == "new_keyword":
        return self.parse_new_keyword()
    # ... existing logic
```

### 3. Add Completion Support

In `pychivalry/completions.py`:

```python
def get_keyword_completions(self) -> List[CompletionItem]:
    """Get keyword completions."""
    items = []
    
    for keyword, info in KEYWORDS.items():
        items.append(CompletionItem(
            label=keyword,
            kind=CompletionItemKind.Keyword,
            detail=info["description"],
            documentation=f"Example: {info['example']}",
            insert_text=f"{keyword} = {{\n\t$0\n}}" if needs_block else keyword,
            insert_text_format=InsertTextFormat.Snippet
        ))
    
    return items
```

### 4. Add Hover Documentation

In `pychivalry/hover.py`:

```python
def get_keyword_hover(self, keyword: str) -> Optional[Hover]:
    """Get hover information for keyword."""
    info = KEYWORDS.get(keyword)
    if not info:
        return None
    
    content = f"**{keyword}** ({info['category']})\n\n"
    content += f"{info['description']}\n\n"
    content += f"Example:\n```ck3\n{info['example']}\n```"
    
    return Hover(contents=MarkupContent(
        kind=MarkupKind.Markdown,
        value=content
    ))
```

### 5. Add Tests

```python
def test_new_keyword_completion():
    """Test completion for new keyword."""
    provider = CompletionProvider()
    completions = provider.get_keyword_completions()
    
    assert any(c.label == "new_keyword" for c in completions)

def test_new_keyword_hover():
    """Test hover for new keyword."""
    provider = HoverProvider()
    hover = provider.get_keyword_hover("new_keyword")
    
    assert hover is not None
    assert "Description of the keyword" in hover.contents.value
```

## Adding New Effects

Effects are actions that modify game state.

### 1. Add to Effect Definitions

Edit `pychivalry/ck3_language.py`:

```python
EFFECTS = {
    "add_trait": {
        "description": "Adds a trait to a character",
        "scopes": ["character"],
        "parameters": {
            "required": ["trait"],
            "optional": []
        },
        "example": "add_trait = brave"
    },
    # Add new effect
    "new_effect": {
        "description": "What this effect does",
        "scopes": ["character", "province"],  # Which scopes it works in
        "parameters": {
            "required": ["param1"],
            "optional": ["param2"]
        },
        "example": "new_effect = param1",
        "added_in": "1.11.0"  # Game version
    },
}
```

### 2. Add Validation

In `pychivalry/diagnostics.py`:

```python
def validate_effect(self, effect_node):
    """Validate an effect."""
    effect_name = effect_node.name
    effect_info = EFFECTS.get(effect_name)
    
    if not effect_info:
        # Unknown effect
        return Diagnostic(
            range=effect_node.range,
            message=f"Unknown effect: {effect_name}",
            severity=DiagnosticSeverity.Error,
            code="CK3201"
        )
    
    # Check scope compatibility
    if self.current_scope not in effect_info["scopes"]:
        return Diagnostic(
            range=effect_node.range,
            message=f"Effect '{effect_name}' not valid in {self.current_scope} scope",
            severity=DiagnosticSeverity.Error,
            code="CK3202"
        )
    
    # Validate parameters
    # ... parameter validation logic
```

### 3. Add Signature Help

In `pychivalry/signature_help.py`:

```python
def get_effect_signature(self, effect_name: str) -> Optional[SignatureHelp]:
    """Get signature help for effect."""
    effect_info = EFFECTS.get(effect_name)
    if not effect_info:
        return None
    
    params = effect_info["parameters"]
    
    signature = SignatureInformation(
        label=f"{effect_name} = ...",
        documentation=effect_info["description"],
        parameters=[
            ParameterInformation(label=p, documentation="Required")
            for p in params["required"]
        ] + [
            ParameterInformation(label=p, documentation="Optional")
            for p in params["optional"]
        ]
    )
    
    return SignatureHelp(signatures=[signature])
```

## Adding New Triggers

Triggers are conditions that evaluate to true/false.

### 1. Add to Trigger Definitions

```python
TRIGGERS = {
    "has_trait": {
        "description": "Checks if character has a trait",
        "scopes": ["character"],
        "type": "boolean",
        "parameters": ["trait_name"],
        "example": "has_trait = brave"
    },
    # Add new trigger
    "new_trigger": {
        "description": "What this trigger checks",
        "scopes": ["character"],
        "type": "boolean",  # or "comparison" for >, <, etc.
        "parameters": ["param"],
        "example": "new_trigger = param"
    },
}
```

### 2. Follow Effect Pattern

Use the same validation, completion, and hover patterns as effects.

## Adding New Scopes

Scopes define the context (character, province, title, etc.) for effects/triggers.

### 1. Define Scope Type

Create YAML file: `pychivalry/data/scopes/new_scope.yaml`

```yaml
name: new_scope_type
description: "Description of this scope type"
properties:
  - property1
  - property2

links:
  # Scope transitions FROM this scope
  - target: character
    syntax: "owner"
    description: "The owner of this new_scope"
  - target: province
    syntax: "location"
    description: "The location of this new_scope"

effects:
  # Effects valid in this scope
  - effect_name1
  - effect_name2

triggers:
  # Triggers valid in this scope
  - trigger_name1
  - trigger_name2
```

### 2. Load in Data Loader

Ensure `pychivalry/data/__init__.py` loads the new scope:

```python
def load_scopes():
    """Load all scope definitions."""
    scopes = {}
    scope_dir = Path(__file__).parent / "scopes"
    
    for yaml_file in scope_dir.glob("*.yaml"):
        with open(yaml_file) as f:
            scope_data = yaml.safe_load(f)
            scopes[scope_data["name"]] = scope_data
    
    return scopes
```

### 3. Update Scope Validator

In `pychivalry/scopes.py`:

```python
class ScopeTracker:
    """Tracks current scope and validates transitions."""
    
    VALID_SCOPES = [
        "character",
        "province",
        "title",
        "new_scope_type",  # Add here
    ]
    
    def navigate_to(self, target: str) -> Optional[str]:
        """Navigate to target scope."""
        # Check if transition is valid from current scope
        scope_data = SCOPES[self.current_scope]
        
        for link in scope_data["links"]:
            if link["syntax"] == target:
                return link["target"]
        
        return None
```

## Adding List Iterators

List iterators like `any_vassal`, `every_courtier` allow iteration over collections.

### 1. Define Iterator

```python
LIST_ITERATORS = {
    "any_vassal": {
        "description": "Iterates over vassals",
        "parent_scope": "character",
        "child_scope": "character",
        "has_limit": True,
        "example": "any_vassal = { limit = { ... } }"
    },
    # Add new iterator
    "any_new_collection": {
        "description": "Iterates over new collection",
        "parent_scope": "new_scope_type",
        "child_scope": "character",
        "has_limit": True,
        "example": "any_new_collection = { ... }"
    },
}
```

### 2. Update List Validator

In `pychivalry/lists.py`:

```python
def validate_list_iterator(self, node):
    """Validate list iterator syntax."""
    iterator_name = node.name
    iterator_info = LIST_ITERATORS.get(iterator_name)
    
    if not iterator_info:
        return self._unknown_iterator_diagnostic(node)
    
    # Check parent scope
    if self.current_scope != iterator_info["parent_scope"]:
        return self._invalid_scope_diagnostic(node, iterator_info)
    
    # Track scope transition
    self.scope_tracker.enter_scope(iterator_info["child_scope"])
```

## Testing New Features

### 1. Unit Tests

```python
def test_new_feature_completion():
    """Test completion for new feature."""
    provider = CompletionProvider()
    completions = provider.get_completions(context="effect")
    
    assert any(c.label == "new_effect" for c in completions)

def test_new_feature_validation():
    """Test validation of new feature."""
    validator = DiagnosticsEngine()
    code = "new_effect = param"
    
    diagnostics = validator.validate(code, scope="character")
    
    # Should not produce errors
    assert len(diagnostics) == 0

def test_new_feature_wrong_scope():
    """Test new feature in wrong scope."""
    validator = DiagnosticsEngine()
    code = "new_effect = param"
    
    diagnostics = validator.validate(code, scope="province")
    
    # Should produce scope error
    assert len(diagnostics) == 1
    assert diagnostics[0].code == "CK3202"
```

### 2. Integration Tests

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_new_feature_full_workflow():
    """Test new feature in full LSP workflow."""
    server = CK3LanguageServer()
    uri = "file:///test.txt"
    
    code = """
    namespace = test
    
    test_event = {
        type = character_event
        immediate = {
            new_effect = param
        }
    }
    """
    
    # Open document
    await server.did_open(uri, code)
    
    # Get diagnostics (should be none)
    diagnostics = server.get_diagnostics(uri)
    assert len(diagnostics) == 0
    
    # Get completion at "new_"
    completions = await server.completion(uri, line=6, char=16)
    assert any("new_effect" in c.label for c in completions.items)
    
    # Get hover on "new_effect"
    hover = await server.hover(uri, line=6, char=12)
    assert "What this effect does" in hover.contents.value
```

## Documentation

### Update Feature List

Add to `README.md`:

```markdown
#### 🆕 New Feature Support
Support for CK3 version X.X.X features:
- `new_effect` - What it does
- `new_trigger` - What it checks
- `new_scope_type` - New scope context
```

### Update Changelog

Add to `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- Support for `new_effect` effect (CK3 1.11.0+)
- Support for `new_trigger` trigger
- New scope type `new_scope_type` with validation
```

## Checklist for New Features

- [ ] Add to language definitions (`ck3_language.py`)
- [ ] Update parser if syntax is special
- [ ] Add validation logic
- [ ] Add completion support
- [ ] Add hover documentation
- [ ] Add signature help (for effects/triggers)
- [ ] Create scope definition (for new scopes)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update README.md
- [ ] Update CHANGELOG.md
- [ ] Test in VS Code Extension Development Host

## Resources

- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding)
- [CK3 Effects Documentation](https://ck3.paradoxwikis.com/Effects)
- [CK3 Triggers Documentation](https://ck3.paradoxwikis.com/Triggers)
- [CK3 Scopes Documentation](https://ck3.paradoxwikis.com/Scopes)
