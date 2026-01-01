"""
CK3 Variables System Module

This module handles validation and processing of CK3 variable system.
Variables allow dynamic data storage and manipulation in CK3 scripts.

Variable Types:
- var: - Character/Title scoped variables (persistent)
- local_var: - Block-scoped variables (temporary)
- global_var: - Global variables (save game)

Variable Effects:
- set_variable: Create or update a variable
- change_variable: Modify an existing variable
- clamp_variable: Constrain variable to a range
- round_variable: Round variable to nearest integer
- remove_variable: Delete a variable

Variable Triggers:
- has_variable: Check if variable exists
- Comparisons: var:name >= value

Variable Lists:
- add_to_variable_list: Add to list
- remove_list_variable: Remove from list
- clear_variable_list: Clear list
- is_target_in_variable_list: Check membership
- variable_list_size: Get list size
- any_in_list, every_in_list: Iterate list
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import re


@dataclass
class Variable:
    """
    Represents a CK3 variable.

    Attributes:
        name: Variable identifier (without prefix)
        scope: 'var', 'local_var', or 'global_var'
        value: Variable value (if known)
        is_list: Whether variable is a list
    """

    name: str
    scope: str
    value: Optional[Any] = None
    is_list: bool = False


# Variable scope prefixes
VARIABLE_SCOPES = {
    "var",  # Character/Title persistent
    "local_var",  # Block scope temporary
    "global_var",  # Global save game
}

# Variable effects
VARIABLE_EFFECTS = {
    "set_variable",  # Create/update variable
    "change_variable",  # Modify value
    "clamp_variable",  # Constrain to range
    "round_variable",  # Round to integer
    "remove_variable",  # Delete variable
    "add_to_variable_list",  # Add to list
    "remove_list_variable",  # Remove from list
    "clear_variable_list",  # Clear list
}

# Variable triggers
VARIABLE_TRIGGERS = {
    "has_variable",  # Check existence
    "is_target_in_variable_list",  # Check list membership
    "variable_list_size",  # Get list size
    "any_in_list",  # Iterate list (trigger)
    "every_in_list",  # Iterate list (effect)
    "ordered_in_list",  # Iterate list ordered
    "random_in_list",  # Iterate list random
}


def parse_variable_reference(identifier: str) -> Optional[Tuple[str, str]]:
    """
    Parse a variable reference identifier.

    Args:
        identifier: The identifier to parse (e.g., 'var:my_var', 'local_var:counter')

    Returns:
        Tuple of (scope, name) if valid variable reference, None otherwise

    Examples:
        >>> parse_variable_reference('var:my_variable')
        ('var', 'my_variable')

        >>> parse_variable_reference('local_var:counter')
        ('local_var', 'counter')

        >>> parse_variable_reference('invalid')
        None
    """
    if ":" not in identifier:
        return None

    parts = identifier.split(":", 1)
    if len(parts) != 2:
        return None

    scope, name = parts

    if scope not in VARIABLE_SCOPES:
        return None

    if not name or not is_valid_variable_name(name):
        return None

    return (scope, name)


def is_variable_reference(identifier: str) -> bool:
    """
    Check if an identifier is a variable reference.

    Args:
        identifier: The identifier to check

    Returns:
        True if identifier is a valid variable reference, False otherwise
    """
    return parse_variable_reference(identifier) is not None


def is_valid_variable_name(name: str) -> bool:
    """
    Check if a variable name is valid.

    Variable names must:
    - Start with a letter or underscore
    - Contain only letters, numbers, and underscores

    Args:
        name: The variable name to validate

    Returns:
        True if name is valid, False otherwise
    """
    if not name:
        return False

    # Check pattern: starts with letter/underscore, followed by alphanumeric/underscore
    pattern = r"^[a-zA-Z_][a-zA-Z0-9_]*$"
    return bool(re.match(pattern, name))


def is_variable_effect(identifier: str) -> bool:
    """
    Check if an identifier is a variable effect.

    Args:
        identifier: The identifier to check

    Returns:
        True if identifier is a variable effect, False otherwise
    """
    return identifier in VARIABLE_EFFECTS


def is_variable_trigger(identifier: str) -> bool:
    """
    Check if an identifier is a variable trigger.

    Args:
        identifier: The identifier to check

    Returns:
        True if identifier is a variable trigger, False otherwise
    """
    return identifier in VARIABLE_TRIGGERS


def validate_set_variable(params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate set_variable parameters.

    Required:
    - name: Variable name
    - value: Variable value

    Optional:
    - days: Expiration in days

    Args:
        params: Dictionary of parameters

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(params, dict):
        return (False, "set_variable parameters must be a dictionary")

    if "name" not in params:
        return (False, "set_variable requires 'name' parameter")

    if "value" not in params:
        return (False, "set_variable requires 'value' parameter")

    name = params["name"]
    if not is_valid_variable_name(name):
        return (False, f"Invalid variable name: {name}")

    return (True, None)


def validate_change_variable(params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate change_variable parameters.

    Required:
    - name: Variable name

    Optional (at least one):
    - add: Value to add
    - subtract: Value to subtract
    - multiply: Value to multiply by
    - divide: Value to divide by

    Args:
        params: Dictionary of parameters

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(params, dict):
        return (False, "change_variable parameters must be a dictionary")

    if "name" not in params:
        return (False, "change_variable requires 'name' parameter")

    operations = {"add", "subtract", "multiply", "divide"}
    has_operation = any(op in params for op in operations)

    if not has_operation:
        return (
            False,
            "change_variable requires at least one operation (add, subtract, multiply, divide)",
        )

    return (True, None)


def validate_clamp_variable(params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate clamp_variable parameters.

    Required:
    - name: Variable name
    - min or max: At least one bound

    Args:
        params: Dictionary of parameters

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(params, dict):
        return (False, "clamp_variable parameters must be a dictionary")

    if "name" not in params:
        return (False, "clamp_variable requires 'name' parameter")

    if "min" not in params and "max" not in params:
        return (False, "clamp_variable requires at least 'min' or 'max' parameter")

    # Validate min <= max if both present
    if "min" in params and "max" in params:
        try:
            min_val = float(params["min"])
            max_val = float(params["max"])
            if min_val > max_val:
                return (
                    False,
                    f"clamp_variable min ({min_val}) cannot be greater than max ({max_val})",
                )
        except (ValueError, TypeError):
            pass  # Will be caught by type validation elsewhere

    return (True, None)


def validate_variable_list_operation(
    operation: str, params: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Validate variable list operation parameters.

    Args:
        operation: The operation name (add_to_variable_list, etc.)
        params: Dictionary of parameters

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(params, dict):
        return (False, f"{operation} parameters must be a dictionary")

    if operation == "add_to_variable_list":
        if "name" not in params:
            return (False, "add_to_variable_list requires 'name' parameter")
        if "target" not in params:
            return (False, "add_to_variable_list requires 'target' parameter")

    elif operation == "remove_list_variable":
        if "name" not in params:
            return (False, "remove_list_variable requires 'name' parameter")
        if "target" not in params:
            return (False, "remove_list_variable requires 'target' parameter")

    elif operation == "clear_variable_list":
        if "name" not in params:
            return (False, "clear_variable_list requires 'name' parameter")

    return (True, None)


def get_variable_scope_type(scope: str) -> str:
    """
    Get the description of a variable scope type.

    Args:
        scope: The scope identifier (var, local_var, global_var)

    Returns:
        Description of the scope type
    """
    descriptions = {
        "var": "Character/Title persistent",
        "local_var": "Block-scoped temporary",
        "global_var": "Global save game",
    }
    return descriptions.get(scope, "Unknown scope")


def suggest_variable_scope(context: str) -> str:
    """
    Suggest appropriate variable scope based on context.

    Args:
        context: The usage context ('event', 'decision', 'effect', etc.)

    Returns:
        Suggested scope type
    """
    if context in ("immediate", "option", "effect"):
        return "local_var"  # Temporary for single-use
    elif context in ("character", "title"):
        return "var"  # Persistent character/title data
    else:
        return "global_var"  # Long-term cross-scope data


def create_variable(
    name: str, scope: str = "var", value: Any = None, is_list: bool = False
) -> Variable:
    """
    Create a Variable object.

    Args:
        name: Variable name
        scope: Variable scope type
        value: Initial value
        is_list: Whether variable is a list

    Returns:
        Variable object
    """
    if scope not in VARIABLE_SCOPES:
        scope = "var"  # Default to persistent

    return Variable(name=name, scope=scope, value=value, is_list=is_list)


def format_variable_reference(variable: Variable) -> str:
    """
    Format a variable as a reference string.

    Args:
        variable: The variable to format

    Returns:
        Formatted reference (e.g., 'var:my_variable')
    """
    return f"{variable.scope}:{variable.name}"


def extract_variable_comparisons(text: str) -> List[Tuple[str, str, str]]:
    """
    Extract variable comparisons from text.

    Finds patterns like: var:name >= 10

    Args:
        text: The text to search

    Returns:
        List of tuples: (variable_ref, operator, value)
    """
    comparisons = []

    # Pattern: (var|local_var|global_var):name operator value
    pattern = r"((?:var|local_var|global_var):[a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|>|<|==|!=|=)\s*(\S+)"

    matches = re.finditer(pattern, text)
    for match in matches:
        var_ref, operator, value = match.groups()
        comparisons.append((var_ref, operator, value))

    return comparisons
