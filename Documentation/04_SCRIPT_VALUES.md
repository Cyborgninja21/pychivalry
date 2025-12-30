# Script Values Module (script_values.py)

## Purpose

The script_values module handles CK3's script value system, which allows dynamic calculation of numeric values using formulas, variables, and conditional logic.

## Script Value Types

### 1. Fixed Values
Simple numeric values:
```
my_value = 100
my_value = -50.5
```

### 2. Range Values
Random value within a range:
```
my_value = { 50 100 }  # Random between 50 and 100
```

### 3. Formula Values
Complex calculations:
```
my_value = {
    value = 10              # Base value
    add = gold              # Add character's gold
    multiply = 2            # Multiply by 2
    divide = 3              # Divide by 3
    min = 0                 # Minimum value
    max = 1000              # Maximum value
}
```

### 4. Conditional Formulas
Values that depend on conditions:
```
my_value = {
    value = 100
    if = {
        limit = { gold > 500 }
        add = 50
    }
    else_if = {
        limit = { gold > 200 }
        add = 25
    }
    else = {
        add = 10
    }
}
```

## Key Classes

### ScriptValue
Represents a script value definition.

```python
@dataclass
class ScriptValue:
    name: str                    # Value name
    value_type: str              # 'fixed', 'range', 'formula'
    base_value: Optional[float]  # For fixed/formula
    range_values: Optional[Tuple[float, float]]  # For range
    operations: List[Operation]  # For formula
    conditions: List[Condition]  # For conditional
    complexity: int              # Complexity score
```

### Operation
Represents a formula operation.

```python
@dataclass
class Operation:
    op_type: str    # 'add', 'subtract', 'multiply', 'divide', etc.
    operand: Any    # Value or variable name
```

### Condition
Represents a conditional formula branch.

```python
@dataclass
class Condition:
    condition_type: str  # 'if', 'else_if', 'else'
    trigger: Optional[Dict]  # Trigger block (for if/else_if)
    operations: List[Operation]  # Operations to apply
```

## Key Functions

### is_script_value(name: str) -> bool
Checks if a name is a script value.

**Example:**
```python
is_script_value("my_value")    # True
is_script_value("add_gold")    # False (it's an effect)
```

### parse_script_value(node: CK3Node) -> ScriptValue
Parses a script value definition from AST.

**Example:**
```python
# my_value = { value = 100 add = 50 }
script_value = parse_script_value(value_node)
# ScriptValue(
#   name='my_value',
#   value_type='formula',
#   operations=[
#     Operation(op_type='value', operand=100),
#     Operation(op_type='add', operand=50)
#   ]
# )
```

### validate_formula(formula: Dict) -> List[str]
Validates a formula structure.

**Example:**
```python
formula = {
    'value': 100,
    'add': 'gold',
    'multiply': 2,
    'invalid_op': 5
}
errors = validate_formula(formula)
# ['Unknown operation: invalid_op']
```

### calculate_complexity(value: ScriptValue) -> int
Calculates complexity score of a script value.

**Example:**
```python
# Simple fixed value
simple = ScriptValue(value_type='fixed', base_value=100)
complexity = calculate_complexity(simple)
# 1

# Complex formula with conditions
complex = ScriptValue(
    value_type='formula',
    operations=[...],  # 5 operations
    conditions=[...]   # 3 conditions
)
complexity = calculate_complexity(complex)
# 8 (5 operations + 3 conditions)
```

### is_valid_operation(op: str) -> bool
Checks if an operation is valid.

**Example:**
```python
is_valid_operation('add')       # True
is_valid_operation('multiply')  # True
is_valid_operation('invalid')   # False
```

## Formula Operations

### Arithmetic Operations
- `value`: Set base value
- `add`: Addition
- `subtract`: Subtraction
- `multiply`: Multiplication
- `divide`: Division
- `modulo`: Modulo (remainder)

### Rounding Operations
- `round`: Round to nearest integer
- `round_to`: Round to specified decimal places
- `ceiling`: Round up
- `floor`: Round down

### Constraint Operations
- `min`: Set minimum value
- `max`: Set maximum value

### Advanced Operations
- `abs`: Absolute value
- `clamp`: Clamp between min and max

## Conditional Logic

### if
Execute if condition is true:
```
if = {
    limit = { gold > 500 }
    add = 100
}
```

### else_if
Execute if previous conditions false and this true:
```
else_if = {
    limit = { gold > 200 }
    add = 50
}
```

### else
Execute if all previous conditions false:
```
else = {
    add = 10
}
```

## Features

### Formula Validation
Ensures correct formula structure:
```python
# Valid formula
my_value = {
    value = 100
    add = 50
    multiply = 2
}

# Invalid: 'value' must come first
my_value = {
    add = 50
    value = 100  # ERROR: value must be first
}
```

### Conditional Validation
Ensures proper conditional logic:
```python
# Valid
my_value = {
    value = 100
    if = { ... }
    else_if = { ... }
    else = { ... }
}

# Invalid: else_if without prior if
my_value = {
    value = 100
    else_if = { ... }  # ERROR: no preceding if
}
```

### Complexity Scoring
Helps identify overly complex formulas:
```python
# Simple (complexity: 2)
value = {
    value = 100
    add = 50
}

# Complex (complexity: 10+)
value = {
    value = base_value
    add = modifier_1
    multiply = factor_1
    if = { ... }
    else_if = { ... }
    else_if = { ... }
    else = { ... }
    min = 0
    max = 1000
}
```

## Integration

Integrates with:
- **parser.py**: Parses script value definitions
- **variables.py**: Resolves variable references
- **diagnostics.py**: Validates formulas
- **hover.py**: Shows formula documentation
- **completions.py**: Suggests operations

## Usage Example

```python
from pychivalry.script_values import (
    parse_script_value,
    validate_formula,
    calculate_complexity
)

# Parse a script value
text = """
my_value = {
    value = 100
    add = gold
    multiply = 2
    if = {
        limit = { prestige > 500 }
        add = 50
    }
    max = 1000
}
"""
ast = parse_document(text)
script_value = parse_script_value(ast.children[0])

# Validate formula
formula = script_value.operations
errors = validate_formula(formula)
if errors:
    print(f"Errors: {errors}")

# Check complexity
complexity = calculate_complexity(script_value)
print(f"Complexity: {complexity}")
# Complexity: 6
```

## Performance

- **Fast parsing**: Linear time formula parsing
- **Efficient validation**: Single-pass validation
- **Complexity calculation**: O(n) where n is number of operations

## Test Coverage

44 comprehensive tests covering:
- Fixed value parsing
- Range value parsing
- Formula structure validation
- All operation types
- Conditional logic (if/else_if/else)
- Complexity calculation
- Error detection for invalid formulas
- Edge cases (nested conditions, missing values)
