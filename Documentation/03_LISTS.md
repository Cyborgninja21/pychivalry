# Lists Module (lists.py)

## Purpose

The lists module handles CK3's list iteration constructs (`any_`, `every_`, `random_`, `ordered_`), validating their parameters and determining result scope types.

## List Iterator Patterns

CK3 supports four types of list iterators:

### 1. any_ (Trigger Context)
Tests if **any** element in a list matches conditions.

```
any_vassal = {
    limit = { gold > 100 }  # Optional filter
    count = 3                # At least 3 must match
    percent = 0.5            # At least 50% must match
}
```

### 2. every_ (Effect Context)
Applies effects to **every** element in a list.

```
every_courtier = {
    limit = { age < 20 }    # Optional filter
    max = 5                  # Limit to first 5
    add_gold = 10
}
```

### 3. random_ (Effect Context)
Applies effects to **random** element(s) from a list.

```
random_held_title = {
    limit = { tier = tier_county }
    weight = {               # Optional weighting
        base = 1
        modifier = {
            factor = 2
            gold > 500
        }
    }
    add_county_modifier = ...
}
```

### 4. ordered_ (Effect Context)
Applies effects to elements in **sorted** order.

```
ordered_vassal = {
    limit = { is_adult = yes }
    order_by = gold          # Sort criterion
    position = 0             # Start position
    max = 3                  # Limit count
    add_prestige = 100
}
```

## Key Classes

### ListIterator
Represents a list iterator construct.

```python
@dataclass
class ListIterator:
    prefix: str           # 'any_', 'every_', 'random_', 'ordered_'
    base: str             # List base: 'vassal', 'courtier', etc.
    element_scope: str    # Scope type of list elements
    parameters: Dict[str, Any]  # Iterator parameters
    is_valid: bool        # Whether parameters are valid
```

## Key Functions

### is_list_iterator(name: str) -> bool
Checks if a name is a list iterator pattern.

**Example:**
```python
is_list_iterator("any_vassal")      # True
is_list_iterator("every_held_title")  # True
is_list_iterator("add_gold")        # False
```

### parse_list_iterator(name: str) -> Tuple[str, str]
Parses a list iterator into prefix and base.

**Example:**
```python
prefix, base = parse_list_iterator("any_vassal")
# ('any_', 'vassal')
```

### get_list_element_scope(base: str, parent_scope: str) -> str
Determines the scope type of list elements.

**Example:**
```python
# In character scope
scope = get_list_element_scope("vassal", "character")
# 'character' (vassals are characters)

scope = get_list_element_scope("held_title", "character")
# 'title' (held titles are titles)
```

### validate_list_parameters(prefix: str, parameters: Dict) -> List[str]
Validates parameters for a list iterator.

**Example:**
```python
# any_ iterator
params = {'count': 3, 'percent': 0.5}
errors = validate_list_parameters('any_', params)
# ['Cannot use both count and percent']

# every_ iterator
params = {'limit': {...}, 'max': 5}
errors = validate_list_parameters('every_', params)
# [] (valid)
```

### is_trigger_list(prefix: str) -> bool
Checks if a list iterator is for triggers.

**Example:**
```python
is_trigger_list('any_')     # True
is_trigger_list('every_')   # False (effect context)
```

### is_effect_list(prefix: str) -> bool
Checks if a list iterator is for effects.

**Example:**
```python
is_effect_list('every_')    # True
is_effect_list('random_')   # True
is_effect_list('any_')      # False (trigger context)
```

## Parameter Validation

### any_ Parameters
- `limit`: Optional trigger filter
- `count`: Minimum number that must match
- `percent`: Minimum percentage that must match
- **Conflict**: Cannot use both `count` and `percent`

### every_ Parameters
- `limit`: Optional trigger filter
- `max`: Maximum number to process

### random_ Parameters
- `limit`: Optional trigger filter
- `weight`: Optional weighting system
  - `base`: Base weight value
  - `modifier`: Conditional weight adjustments

### ordered_ Parameters
- `limit`: Optional trigger filter
- `order_by`: Required sort criterion (variable or attribute name)
- `position`: Starting position (default: 0)
- `max`: Maximum number to process

## Common List Bases

### Character Scope Lists
- `vassal` → character
- `courtier` → character
- `child` → character
- `heir` → character (special: single element)
- `liege` → character (special: single element)

### Title Scope Lists
- `held_title` → title
- `claim` → title
- `de_jure_vassals` → title
- `de_jure_liege` → title (special: single element)

### Province Scope Lists
- `county` → title
- `neighboring_province` → province

## Features

### Scope Type Inference
Automatically determines result scope based on list base:
```python
any_vassal = { ... }  # character scope inside
any_held_title = { ... }  # title scope inside
```

### Parameter Validation
Ensures correct parameter usage:
```python
# ERROR: Cannot use 'count' with every_
every_vassal = {
    count = 3  # Invalid!
    add_gold = 100
}

# OK: 'max' is valid for every_
every_vassal = {
    max = 3
    add_gold = 100
}
```

### Context-Aware
Validates that list content matches context:
```python
# OK: any_ contains triggers
any_vassal = {
    gold > 100
}

# ERROR: any_ cannot contain effects
any_vassal = {
    add_gold = 100  # Invalid!
}
```

## Integration

Integrates with:
- **scopes.py**: Resolves list element scope types
- **diagnostics.py**: Validates list parameters
- **completions.py**: Suggests appropriate parameters
- **parser.py**: Identifies list iterator blocks

## Usage Example

```python
from pychivalry.lists import (
    is_list_iterator,
    parse_list_iterator,
    get_list_element_scope,
    validate_list_parameters
)

# Check if it's a list iterator
if is_list_iterator("any_vassal"):
    prefix, base = parse_list_iterator("any_vassal")
    print(f"Prefix: {prefix}, Base: {base}")
    # Prefix: any_, Base: vassal
    
    # Get element scope
    elem_scope = get_list_element_scope(base, "character")
    print(f"Element scope: {elem_scope}")
    # Element scope: character
    
    # Validate parameters
    params = {'count': 3}
    errors = validate_list_parameters(prefix, params)
    if errors:
        print(f"Errors: {errors}")
```

## Performance

- **Fast pattern matching**: Regex-based iterator detection
- **Cached scope lookups**: O(1) element scope resolution
- **Efficient validation**: Linear time parameter checking

## Test Coverage

36 comprehensive tests covering:
- List iterator pattern detection
- Prefix and base parsing
- Element scope resolution for all list types
- Parameter validation for each iterator type
- Context validation (trigger vs effect)
- Edge cases (invalid parameters, unknown bases)
