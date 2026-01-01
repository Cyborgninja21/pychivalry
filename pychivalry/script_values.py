"""
CK3 Script Values & Formulas Module

This module handles validation and processing of CK3 script values and formulas.
Script values allow dynamic calculation and conditional evaluation in CK3 scripts.

Script Value Types:
- Fixed: my_value = 100
- Range: my_range = { 50 100 }
- Formula: { value = gold multiply = 0.1 add = 50 min = 10 max = 1000 }

Formula Operations:
- value: Base value
- add: Addition
- subtract: Subtraction
- multiply: Multiplication
- divide: Division
- modulo: Modulo operation
- min: Minimum value
- max: Maximum value
- round: Round to nearest integer
- round_to: Round to nearest multiple
- ceiling: Round up
- floor: Round down

Conditional Formulas:
- if: Conditional branch (requires trigger)
- else_if: Alternative conditional (cannot follow else)
- else: Default branch
"""

from typing import Dict, List, Optional, Tuple, Union, Any
from dataclasses import dataclass


@dataclass
class ScriptValue:
    """
    Represents a script value definition.

    Attributes:
        name: Value identifier
        value_type: 'fixed', 'range', or 'formula'
        value: The actual value or formula definition
        conditions: Optional conditional logic
    """

    name: str
    value_type: str
    value: Union[int, float, Tuple[float, float], Dict[str, Any]]
    conditions: Optional[List[Dict[str, Any]]] = None


# Valid formula operations
FORMULA_OPERATIONS = {
    "value",  # Base value
    "add",  # Addition
    "subtract",  # Subtraction
    "multiply",  # Multiplication
    "divide",  # Division
    "modulo",  # Modulo operation
    "min",  # Minimum constraint
    "max",  # Maximum constraint
    "round",  # Round to nearest integer
    "round_to",  # Round to nearest multiple
    "ceiling",  # Round up to nearest integer
    "floor",  # Round down to nearest integer
}

# Conditional keywords
CONDITIONAL_KEYWORDS = {
    "if",  # Conditional branch
    "else_if",  # Alternative conditional
    "else",  # Default branch
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
