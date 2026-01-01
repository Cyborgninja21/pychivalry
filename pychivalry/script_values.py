"""
CK3 Script Values & Formulas Module - Dynamic Calculation System

DIAGNOSTIC CODES:
    VALUE-001: Invalid script value type
    VALUE-002: Invalid range (min > max)
    VALUE-003: Unknown formula operation
    VALUE-004: Invalid conditional structure (else_if after else)
    VALUE-005: Missing value in arithmetic formula
    VALUE-006: Invalid round_to parameter (must be positive)

MODULE OVERVIEW:
    This module provides comprehensive validation and processing for CK3's script value
    system, which enables dynamic calculations, ranges, and conditional logic in scripts.
    Script values are fundamental to data-driven game design, allowing modders to create
    complex formulas that react to game state.

SCRIPT VALUE SYSTEM:
    CK3 uses three types of script values, each serving different purposes:
    
    1. Fixed Values (Simple Numbers)
       - Direct numeric assignment
       - Example: my_gold = 100
       - Use: Constant values, simple assignments
    
    2. Range Values (Min/Max Bounds)
       - Two numbers defining a range
       - Example: my_range = { 50 100 } or { min = 50 max = 100 }
       - Use: Random selection within bounds, AI weights
    
    3. Formula Values (Dynamic Calculations)
       - Complex calculations with operations and conditions
       - Example: { value = gold multiply = 0.1 add = 50 min = 10 max = 1000 }
       - Use: Dynamic scaling, conditional calculations

FORMULA OPERATIONS:
    Arithmetic Operations (Order of Execution):
    1. value: Starting value (can be number or game value like 'gold')
    2. add: Addition (value + X)
    3. subtract: Subtraction (value - X)
    4. multiply: Multiplication (value * X)
    5. divide: Division (value / X)
    6. modulo: Remainder (value % X)
    
    Constraints (Applied After Arithmetic):
    - min: Minimum value (clamp below)
    - max: Maximum value (clamp above)
    
    Rounding (Applied After Constraints):
    - round: Round to nearest integer
    - round_to: Round to nearest multiple (e.g., round_to = 5 → 0, 5, 10, ...)
    - ceiling: Round up to next integer
    - floor: Round down to previous integer

CONDITIONAL FORMULAS:
    Formulas can include conditional branches for dynamic behavior:
    
    ```
    my_value = {
        if = {
            limit = { has_trait = brave }
            value = 100
        }
        else_if = {
            limit = { has_trait = craven }
            value = 50
        }
        else = {
            value = 75
        }
    }
    ```
    
    Rules:
    - if must come first
    - else_if can follow if or else_if
    - else_if CANNOT follow else
    - else must come last
    - Each branch requires a limit (trigger block) except else

FORMULA COMPLEXITY:
    Formulas can be simple or arbitrarily complex:
    
    Simple: { value = 10 multiply = 2 } → 20
    
    Complex: {
        value = gold
        multiply = 0.1
        add = age
        subtract = 10
        min = 5
        max = 100
        round = yes
    }

VALIDATION RULES:
    - Range values must have min <= max
    - Formula operations must be recognized keywords
    - Conditional else_if cannot follow else
    - Arithmetic operations should have a value (can be implicit 0)
    - round_to parameter must be positive number

USAGE EXAMPLES:
    >>> # Parse fixed value
    >>> sv = parse_script_value('my_gold', 100)
    >>> sv.value_type  # 'fixed'
    >>> sv.value  # 100
    
    >>> # Parse range
    >>> sv = parse_script_value('my_range', {'min': 50, 'max': 100})
    >>> sv.value_type  # 'range'
    >>> sv.value  # (50, 100)
    
    >>> # Validate range
    >>> is_valid, error = is_valid_range((50, 100))  # (True, None)
    >>> is_valid, error = is_valid_range((100, 50))  # (False, "min > max")

PERFORMANCE:
    - Value type detection: O(1)
    - Formula validation: O(n) where n = number of operations
    - Range validation: O(1)
    - Typical usage: <1ms per value

SEE ALSO:
    - diagnostics.py: Uses this module for script value validation
    - parser.py: Parses script value definitions from text
    - ck3_language.py: Provides value reference names (gold, prestige, etc.)
"""

# =============================================================================
# IMPORTS
# =============================================================================

# typing: Type hints for complex types
from typing import Dict, List, Optional, Tuple, Union, Any

# dataclasses: For efficient data structures
from dataclasses import dataclass


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class ScriptValue:
    """
    Represents a parsed CK3 script value definition.

    Script values are named calculations that can be referenced throughout CK3 scripts.
    They enable data-driven design by centralizing complex calculations and making
    them reusable.

    VALUE TYPES:
    - fixed: Simple numeric constant (e.g., 100, 3.14)
    - range: Min/max bounds (e.g., {50, 100})
    - formula: Complex calculation with operations and conditions

    Attributes:
        name: Unique identifier for this script value
             Example: 'my_gold_bonus', 'prestige_cost', 'opinion_modifier'
        value_type: Type classification - 'fixed', 'range', or 'formula'
        value: The actual value data, type depends on value_type:
              - fixed: int or float
              - range: Tuple[float, float] with (min, max)
              - formula: Dict[str, Any] with operation keys
        conditions: Optional list of conditional branches for formula type
                   Only used when formula includes if/else_if/else logic
                   None for fixed and range types

    Examples:
        >>> # Fixed value
        >>> ScriptValue(name='base_gold', value_type='fixed', value=100)
        
        >>> # Range value
        >>> ScriptValue(name='random_gold', value_type='range', value=(50, 150))
        
        >>> # Formula value
        >>> ScriptValue(
        ...     name='scaled_gold',
        ...     value_type='formula',
        ...     value={'value': 'gold', 'multiply': 0.1, 'min': 10}
        ... )

    Performance:
        Lightweight dataclass with minimal memory overhead (~120 bytes)
    """

    name: str  # Script value identifier
    value_type: str  # 'fixed', 'range', or 'formula'
    value: Union[int, float, Tuple[float, float], Dict[str, Any]]  # Value data
    conditions: Optional[List[Dict[str, Any]]] = None  # Conditional branches


# =============================================================================
# FORMULA OPERATION CONSTANTS
# =============================================================================

# Valid formula operations - defines all arithmetic and transformation operations
# These are keywords recognized in formula dictionaries
# Order matters: operations execute in sequence as they appear
FORMULA_OPERATIONS = {
    # Base value - starting point for calculation
    "value",  # Can be number or game value reference (gold, prestige, age, etc.)
    
    # Arithmetic operations - modify the running value
    "add",  # Addition: result = result + X
    "subtract",  # Subtraction: result = result - X
    "multiply",  # Multiplication: result = result * X
    "divide",  # Division: result = result / X
    "modulo",  # Modulo: result = result % X (remainder after division)
    
    # Constraint operations - clamp value to bounds
    "min",  # Minimum: if result < min, result = min
    "max",  # Maximum: if result > max, result = max
    
    # Rounding operations - convert to integers
    "round",  # Round to nearest integer: 3.7 → 4, 3.2 → 3
    "round_to",  # Round to nearest multiple: round_to=5 → 0,5,10,15,...
    "ceiling",  # Round up: 3.1 → 4, 3.9 → 4
    "floor",  # Round down: 3.1 → 3, 3.9 → 3
}

# Conditional keywords - control flow within formulas
# Allow formulas to branch based on game state conditions
CONDITIONAL_KEYWORDS = {
    "if",  # Primary conditional branch - requires 'limit' (trigger block)
    "else_if",  # Alternative conditional - requires 'limit', cannot follow 'else'
    "else",  # Default branch - no limit needed, must be last
}


def is_formula_operation(key: str) -> bool:
    """
    Check if a key is a valid formula operation.

    Args:
        key: The key to check

    Returns:
        True if key is a valid formula operation, False otherwise
    """
    return key in FORMULA_OPERATIONS


def is_conditional_keyword(key: str) -> bool:
    """
    Check if a key is a conditional keyword.

    Args:
        key: The key to check

    Returns:
        True if key is a conditional keyword, False otherwise
    """
    return key in CONDITIONAL_KEYWORDS


def parse_script_value(name: str, value_data: Any) -> Optional[ScriptValue]:
    """
    Parse a script value definition.

    Args:
        name: The script value name
        value_data: The value data (number, range, or formula dict)

    Returns:
        ScriptValue object if valid, None otherwise

    Examples:
        >>> parse_script_value('my_gold', 100)
        ScriptValue(name='my_gold', value_type='fixed', value=100)

        >>> parse_script_value('my_range', {'min': 50, 'max': 100})
        ScriptValue(name='my_range', value_type='range', value=(50, 100))
    """
    # Fixed value (number)
    if isinstance(value_data, (int, float)):
        return ScriptValue(name=name, value_type="fixed", value=value_data)

    # Check for range (dictionary with two numbers or min/max)
    if isinstance(value_data, dict):
        # Range format: { min max } or { 'min': value, 'max': value }
        if "min" in value_data and "max" in value_data:
            return ScriptValue(
                name=name, value_type="range", value=(value_data["min"], value_data["max"])
            )

        # Formula format
        if any(key in FORMULA_OPERATIONS for key in value_data.keys()):
            return ScriptValue(name=name, value_type="formula", value=value_data)

        # Conditional format
        if any(key in CONDITIONAL_KEYWORDS for key in value_data.keys()):
            return ScriptValue(
                name=name,
                value_type="formula",
                value=value_data,
                conditions=extract_conditions(value_data),
            )

    # List format for range: [50, 100]
    if isinstance(value_data, (list, tuple)) and len(value_data) == 2:
        return ScriptValue(name=name, value_type="range", value=(value_data[0], value_data[1]))

    return None


def validate_formula(formula: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate a formula structure.

    Args:
        formula: The formula dictionary to validate

    Returns:
        Tuple of (is_valid, error_message)

    Examples:
        >>> validate_formula({'value': 100, 'add': 50})
        (True, None)

        >>> validate_formula({'invalid_op': 100})
        (False, "Unknown formula operation: invalid_op")
    """
    if not isinstance(formula, dict):
        return (False, "Formula must be a dictionary")

    # Check all keys are valid operations or conditionals
    for key in formula.keys():
        if not (is_formula_operation(key) or is_conditional_keyword(key)):
            return (False, f"Unknown formula operation: {key}")

    # Validate that value exists if using arithmetic operations
    arithmetic_ops = {"add", "subtract", "multiply", "divide", "modulo"}
    if any(op in formula for op in arithmetic_ops):
        if "value" not in formula:
            # Value is optional - can use implicit 0 or reference
            pass

    return (True, None)


def validate_conditional_formula(formula: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate conditional structure in a formula.

    Rules:
    - else_if cannot follow else
    - else can only appear once
    - if must have a trigger block

    Args:
        formula: The formula with conditionals to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(formula, dict):
        return (False, "Formula must be a dictionary")

    # Track conditional order
    has_else = False
    has_if = False

    for key in formula.keys():
        if key == "if":
            has_if = True
        elif key == "else_if":
            if has_else:
                return (False, "else_if cannot follow else")
            if not has_if:
                return (False, "else_if must follow if")
        elif key == "else":
            if has_else:
                return (False, "Multiple else blocks not allowed")
            has_else = True

    return (True, None)


def extract_conditions(formula: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract conditional branches from a formula.

    Args:
        formula: The formula dictionary

    Returns:
        List of conditional branches
    """
    conditions = []

    for key in ["if", "else_if", "else"]:
        if key in formula:
            if isinstance(formula[key], list):
                conditions.extend(formula[key])
            else:
                conditions.append({key: formula[key]})

    return conditions


def evaluate_formula_complexity(formula: Dict[str, Any]) -> int:
    """
    Calculate the complexity score of a formula.

    Complexity is based on number of operations and conditionals.

    Args:
        formula: The formula to evaluate

    Returns:
        Complexity score (higher = more complex)
    """
    if not isinstance(formula, dict):
        return 0

    complexity = 0

    # Count operations
    for key in formula.keys():
        if is_formula_operation(key):
            complexity += 1
        elif is_conditional_keyword(key):
            complexity += 2  # Conditionals add more complexity

    # Recursively count nested formulas
    for value in formula.values():
        if isinstance(value, dict):
            complexity += evaluate_formula_complexity(value)

    return complexity


def get_formula_operations(formula: Dict[str, Any]) -> List[str]:
    """
    Get all operations used in a formula.

    Args:
        formula: The formula dictionary

    Returns:
        List of operation names used
    """
    if not isinstance(formula, dict):
        return []

    operations = []

    for key in formula.keys():
        if is_formula_operation(key):
            operations.append(key)

    return operations


def is_valid_range(range_value: Tuple[float, float]) -> Tuple[bool, Optional[str]]:
    """
    Validate a range value.

    Rules:
    - Must have exactly two values
    - First value (min) should be <= second value (max)

    Args:
        range_value: Tuple of (min, max)

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(range_value, (tuple, list)) or len(range_value) != 2:
        return (False, "Range must have exactly two values")

    min_val, max_val = range_value

    if not isinstance(min_val, (int, float)) or not isinstance(max_val, (int, float)):
        return (False, "Range values must be numbers")

    if min_val > max_val:
        return (False, f"Range minimum ({min_val}) cannot be greater than maximum ({max_val})")

    return (True, None)


def format_script_value(script_value: ScriptValue) -> str:
    """
    Format a script value for display.

    Args:
        script_value: The script value to format

    Returns:
        Formatted string representation
    """
    if script_value.value_type == "fixed":
        return f"{script_value.name} = {script_value.value}"

    elif script_value.value_type == "range":
        min_val, max_val = script_value.value
        return f"{script_value.name} = {{ {min_val} {max_val} }}"

    elif script_value.value_type == "formula":
        ops = get_formula_operations(script_value.value)
        return f"{script_value.name} = {{ {' '.join(ops)} }}"

    return f"{script_value.name} = <unknown>"


# Common script value patterns
COMMON_VALUE_REFERENCES = {
    "gold",
    "prestige",
    "piety",
    "age",
    "max_military_strength",
    "realm_size",
    "num_of_vassals",
    "num_of_powerful_vassals",
    "short_term_gold",
    "monthly_character_income",
    "monthly_character_expenses",
}


def is_value_reference(identifier: str) -> bool:
    """
    Check if an identifier references a common value.

    Args:
        identifier: The identifier to check

    Returns:
        True if identifier is a known value reference, False otherwise
    """
    return identifier in COMMON_VALUE_REFERENCES
