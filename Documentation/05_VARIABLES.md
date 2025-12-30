# Variables Module (variables.py)

## Purpose

The variables module handles CK3's variable system, which allows storing and manipulating numeric and flag values across different scopes (local, character, global).

## Variable Scopes

CK3 supports three variable scope types:

### 1. Local Variables (local_var:)
Exist only within the current block:
```
set_local_variable = {
    name = temp_gold
    value = 100
}
local_var:temp_gold >= 50  # Access local variable
```

### 2. Character Variables (var:)
Stored on a specific character:
```
set_variable = {
    name = quest_progress
    value = 0
}
var:quest_progress < 10  # Access character variable
```

### 3. Global Variables (global_var:)
Accessible from anywhere in the game:
```
set_global_variable = {
    name = world_event_count
    value = 0
}
global_var:world_event_count > 100  # Access global variable
```

## Key Classes

### Variable
Represents a variable definition or reference.

```python
@dataclass
class Variable:
    name: str           # Variable name
    scope: str          # 'local_var', 'var', 'global_var'
    value_type: str     # 'numeric', 'flag', 'reference'
    initial_value: Any  # Initial value (if set)
```

### VariableOperation
Represents an operation on a variable.

```python
@dataclass
class VariableOperation:
    op_type: str    # 'set', 'change', 'clamp', 'round', 'remove'
    variable: str   # Variable name
    parameters: Dict[str, Any]  # Operation parameters
```

## Key Functions

### is_variable_effect(name: str) -> bool
Checks if a name is a variable effect.

**Example:**
```python
is_variable_effect("set_variable")       # True
is_variable_effect("change_variable")    # True
is_variable_effect("add_gold")           # False
```

### is_variable_trigger(name: str) -> bool
Checks if a name is a variable trigger.

**Example:**
```python
is_variable_trigger("has_variable")      # True
is_variable_trigger("gold")              # False
```

### parse_variable_reference(text: str) -> Tuple[str, str]
Parses a variable reference into scope and name.

**Example:**
```python
scope, name = parse_variable_reference("var:quest_progress")
# ('var', 'quest_progress')

scope, name = parse_variable_reference("local_var:temp_value")
# ('local_var', 'temp_value')
```

### extract_variable_comparison(node: CK3Node) -> Optional[Dict]
Extracts variable comparison from trigger.

**Example:**
```python
# var:quest_progress >= 10
comparison = extract_variable_comparison(node)
# {
#   'variable': 'quest_progress',
#   'scope': 'var',
#   'operator': '>=',
#   'value': 10
# }
```

### validate_variable_name(name: str) -> List[str]
Validates a variable name.

**Example:**
```python
errors = validate_variable_name("my_variable")
# [] (valid)

errors = validate_variable_name("my-variable")
# ['Variable name cannot contain hyphens']

errors = validate_variable_name("123variable")
# ['Variable name cannot start with number']
```

## Variable Effects

### set_variable
Sets a variable value:
```
set_variable = {
    name = quest_progress
    value = 0
}

# Or shorthand
set_variable = quest_progress
```

### change_variable
Changes a variable by an amount:
```
change_variable = {
    name = quest_progress
    add = 1
}

# Or subtract
change_variable = {
    name = quest_progress
    subtract = 1
}
```

### clamp_variable
Clamps a variable between min and max:
```
clamp_variable = {
    name = quest_progress
    min = 0
    max = 10
}
```

### round_variable
Rounds a variable value:
```
round_variable = {
    name = gold_ratio
    step = 0.1
}
```

### remove_variable
Removes a variable:
```
remove_variable = quest_progress
```

## Variable List Operations

### add_to_variable_list
Adds a scope to a variable list:
```
add_to_variable_list = {
    name = important_vassals
    target = scope:current_vassal
}
```

### remove_list_variable
Removes a specific entry from a variable list:
```
remove_list_variable = {
    name = important_vassals
    target = scope:removed_vassal
}
```

### clear_variable_list
Clears entire variable list:
```
clear_variable_list = important_vassals
```

## Variable Triggers

### has_variable
Checks if a variable exists:
```
has_variable = quest_progress
```

### Variable Comparisons
Compare variable values:
```
var:quest_progress >= 10
var:quest_progress < 5
var:quest_progress = 0
var:gold_amount > var:cost
```

### is_target_in_variable_list
Checks if scope is in a variable list:
```
is_target_in_variable_list = {
    name = important_vassals
    target = scope:current_vassal
}
```

### variable_list_size
Gets size of a variable list (for comparison):
```
variable_list_size = {
    name = important_vassals
    value >= 5
}
```

### any_in_list
Iterates over variable list (trigger):
```
any_in_list = {
    variable = important_vassals
    gold > 500
}
```

### every_in_list
Iterates over variable list (effect):
```
every_in_list = {
    variable = important_vassals
    add_gold = 100
}
```

## Features

### Variable Name Validation
Ensures valid variable names:
```python
# Valid names
my_variable
quest_progress_01
character_data

# Invalid names
my-variable  # No hyphens
123variable  # Cannot start with number
my variable  # No spaces
```

### Scope Tracking
Tracks which variables are in which scopes:
```python
# Local scope
set_local_variable = { name = temp }

# Character scope
set_variable = { name = permanent }

# Global scope
set_global_variable = { name = world }
```

### List Operations
Manages variable lists:
```python
# Create list
add_to_variable_list = {
    name = my_list
    target = root
}

# Check membership
is_target_in_variable_list = {
    name = my_list
    target = root
}

# Iterate
every_in_list = {
    variable = my_list
    add_gold = 10
}
```

## Integration

Integrates with:
- **parser.py**: Parses variable definitions
- **script_values.py**: Variables used in formulas
- **diagnostics.py**: Validates variable operations
- **completions.py**: Suggests variable names
- **scopes.py**: Resolves variable scope contexts

## Usage Example

```python
from pychivalry.variables import (
    is_variable_effect,
    parse_variable_reference,
    validate_variable_name,
    extract_variable_comparison
)

# Check if it's a variable effect
if is_variable_effect("set_variable"):
    print("This is a variable effect")

# Parse variable reference
scope, name = parse_variable_reference("var:quest_progress")
print(f"Scope: {scope}, Name: {name}")
# Scope: var, Name: quest_progress

# Validate variable name
errors = validate_variable_name("my_quest_01")
if not errors:
    print("Valid variable name")

# Extract comparison
# From: var:quest_progress >= 10
comparison = extract_variable_comparison(comparison_node)
print(f"Variable: {comparison['variable']}")
print(f"Operator: {comparison['operator']}")
print(f"Value: {comparison['value']}")
```

## Performance

- **Fast name validation**: Regex-based validation
- **Efficient parsing**: Single-pass variable extraction
- **O(1) lookups**: Variable effect/trigger detection

## Test Coverage

64 comprehensive tests covering:
- Variable effect detection
- Variable trigger detection
- Variable reference parsing (all three scopes)
- Variable name validation
- Variable comparison extraction
- List operations (add, remove, clear, iterate)
- Edge cases (invalid names, malformed references)
- Integration with script values
