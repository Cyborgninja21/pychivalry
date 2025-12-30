# Scopes Module (scopes.py)

## Purpose

The scopes module implements CK3's scope system, which tracks what type of game object (character, title, province, etc.) is being referenced at any point in the script. This enables validation of scope chains and intelligent code completion.

## Key Concepts

### Scope Types

CK3 has three main scope types:
- **character**: A person in the game
- **title**: A landed title (kingdom, duchy, county, barony)
- **province**: A geographic location

### Scope Links

Ways to navigate from one scope to another:
```
character.liege → character (your liege lord)
character.primary_title → title (your main title)
title.holder → character (who holds this title)
province.county → title (county containing this province)
```

### Scope Lists

Generate lists of related scopes:
```
character.vassal → list of character (all vassals)
character.held_title → list of title (all titles held)
title.de_jure_vassals → list of title (legal vassals)
```

### Universal Scopes

Special scopes available everywhere:
- **root**: The original scope
- **this**: The current scope
- **prev**: The previous scope
- **from**: The event/effect caller scope

### Saved Scopes

Named scopes saved for later use:
```
save_scope_as = my_liege  # Save current scope
scope:my_liege = { ... }  # Use saved scope later
```

## Key Classes

### ScopeDefinition
Defines a scope type and its properties.

```python
@dataclass
class ScopeDefinition:
    name: str                    # Scope name (e.g., "character")
    links: Dict[str, str]        # Scope links: {link_name: target_scope}
    lists: Dict[str, str]        # Scope lists: {list_name: element_scope}
    universal: List[str]         # Universal scopes available
```

### ScopeChain
Represents a chain of scope navigations.

```python
@dataclass
class ScopeChain:
    scopes: List[str]      # List of scopes in chain
    is_valid: bool         # Whether chain is valid
    final_scope: str       # Resulting scope type
```

## Key Functions

### load_scope_definitions() -> Dict[str, ScopeDefinition]
Loads scope definitions from YAML files in `data/scopes/`.

**Example:**
```python
scopes = load_scope_definitions()
# {
#   'character': ScopeDefinition(...),
#   'title': ScopeDefinition(...),
#   'province': ScopeDefinition(...)
# }
```

### validate_scope_chain(chain: str, start_scope: str) -> ScopeChain
Validates a scope chain like `liege.primary_title.holder`.

**Example:**
```python
# Starting from character scope
chain = validate_scope_chain("liege.primary_title.holder", "character")
# ScopeChain(
#   scopes=['character', 'character', 'title', 'character'],
#   is_valid=True,
#   final_scope='character'
# )
```

### get_scope_links(scope_type: str) -> List[str]
Gets all available scope links for a scope type.

**Example:**
```python
links = get_scope_links("character")
# ['liege', 'spouse', 'primary_title', 'capital_county', ...]
```

### get_scope_lists(scope_type: str) -> List[str]
Gets all available scope lists for a scope type.

**Example:**
```python
lists = get_scope_lists("character")
# ['vassal', 'courtier', 'child', 'held_title', ...]
```

### infer_scope_from_context(node: CK3Node) -> str
Infers the current scope type from AST context.

**Example:**
```python
# Inside an event block
scope = infer_scope_from_context(event_node)
# 'character' (events start in character scope)
```

### track_saved_scopes(document: CK3Node) -> Dict[str, str]
Extracts all saved scopes from a document.

**Example:**
```python
saved_scopes = track_saved_scopes(ast)
# {
#   'my_liege': 'character',
#   'target_title': 'title',
#   'home_province': 'province'
# }
```

## Scope Data Files

Scope definitions are stored in YAML files:

```yaml
# data/scopes/character.yaml
name: character
links:
  liege: character
  spouse: character
  primary_title: title
  capital_county: title
  employer: character
  killer: character
lists:
  vassal: character
  courtier: character
  child: character
  held_title: title
  claim: title
universal:
  - root
  - this
  - prev
  - from
```

## Features

### Scope Chain Validation
Validates complex scope chains:
```python
# Valid chains
liege.primary_title.holder
spouse.primary_title.de_jure_liege

# Invalid chains
liege.county  # character doesn't have 'county' link
title.spouse  # title doesn't have 'spouse' link
```

### List Scope Resolution
Determines result scope of list iterations:
```python
any_vassal = { ... }  # Iterates over character scopes
every_held_title = { ... }  # Iterates over title scopes
```

### Saved Scope Tracking
Tracks scope:name references:
```python
# Definition
random_vassal = {
    save_scope_as = important_vassal
}

# Usage
scope:important_vassal = {
    add_gold = 100
}
```

### Event Target Support
Handles event_target:name references:
```python
# Set event target
set_global_variable = {
    name = important_person
    value = this
}

# Use event target
event_target:important_person = {
    add_prestige = 50
}
```

## Integration

Integrates with:
- **parser.py**: Analyzes AST for scope context
- **completions.py**: Suggests valid scope links
- **diagnostics.py**: Validates scope chains
- **hover.py**: Shows scope information
- **lists.py**: Determines list element scopes

## Usage Example

```python
from pychivalry.scopes import (
    load_scope_definitions,
    validate_scope_chain,
    infer_scope_from_context
)

# Load scope definitions
scopes = load_scope_definitions()

# Validate a scope chain
chain = validate_scope_chain("liege.primary_title", "character")
if chain.is_valid:
    print(f"Final scope: {chain.final_scope}")  # 'title'

# Infer scope from context
current_scope = infer_scope_from_context(ast_node)
print(f"Current scope: {current_scope}")  # 'character'
```

## Performance

- **Fast lookups**: O(1) scope link resolution
- **Cached definitions**: YAML files loaded once
- **Efficient validation**: Linear time scope chain validation

## Test Coverage

28 comprehensive tests covering:
- Scope definition loading from YAML
- Scope chain validation (valid and invalid)
- Scope link and list resolution
- Universal scope handling
- Saved scope tracking
- Event target support
- Context inference from AST
