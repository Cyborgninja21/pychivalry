"""
CK3 Variables System Module - Dynamic Data Storage and Manipulation

DIAGNOSTIC CODES:
    VAR-001: Invalid variable name format
    VAR-002: Unknown variable scope prefix
    VAR-003: Invalid set_variable parameters
    VAR-004: Invalid change_variable parameters
    VAR-005: Invalid clamp_variable parameters (min > max)
    VAR-006: Invalid variable list operation parameters

MODULE OVERVIEW:
    This module provides comprehensive validation and processing for CK3's dynamic variable
    system. Variables enable scripts to store and manipulate data at runtime, allowing for
    complex conditional logic, counters, and dynamic collections.
    
    The variable system is fundamental to advanced CK3 modding, enabling:
    - Persistent character/title state tracking
    - Temporary calculation storage
    - Global game state management
    - Dynamic collections (variable lists)
    - Complex decision trees with state

VARIABLE SYSTEM ARCHITECTURE:
    CK3 variables use a prefix-based scoping system that determines lifetime and visibility:
    
    1. var: (Character/Title Persistent)
       - Scoped to character or title object
       - Persists across save/load
       - Lost when character dies or title destroyed
       - Use for: Character traits, relationship tracking, title flags
       - Example: var:claimed_throne, var:murder_count
    
    2. local_var: (Block Temporary)
       - Scoped to current execution block (event, effect, trigger)
       - Cleared when block completes
       - Not saved with game
       - Use for: Temporary calculations, loop variables
       - Example: local_var:counter, local_var:temp_gold
    
    3. global_var: (Save Game Persistent)
       - Global to entire save game
       - Persists across all game sessions
       - Never cleared unless explicitly removed
       - Use for: Game-wide flags, mod settings, global counters
       - Example: global_var:mod_enabled, global_var:world_event_count

VARIABLE OPERATIONS:
    Effects (State Modification):
    - set_variable: Create or overwrite variable with new value
    - change_variable: Modify existing value (add, subtract, multiply, divide)
    - clamp_variable: Constrain value to min/max range
    - round_variable: Round to nearest integer
    - remove_variable: Delete variable from scope
    
    Triggers (Conditional Checks):
    - has_variable: Check if variable exists
    - Comparisons: var:name >= value, var:name < 10, etc.
    
    List Operations (Dynamic Collections):
    - add_to_variable_list: Add scope reference to list
    - remove_list_variable: Remove scope from list
    - clear_variable_list: Empty entire list
    - is_target_in_variable_list: Check if scope in list
    - variable_list_size: Get number of items in list
    - any_in_list, every_in_list: Iterate over list items

VARIABLE LISTS:
    Special feature allowing dynamic collections of scope references:
    ```
    # Create list and add vassals who are traitors
    every_vassal = {
        limit = { has_trait = traitor }
        root = { add_to_variable_list = { name = traitor_list target = prev } }
    }
    
    # Later, check if specific character is in list
    is_target_in_variable_list = { name = traitor_list target = scope:enemy }
    
    # Iterate over list
    every_in_list = {
        variable = traitor_list
        imprison = yes
    }
    ```

VALIDATION RULES:
    - Variable names must match pattern: [a-zA-Z_][a-zA-Z0-9_]*
    - Scope prefix must be one of: var, local_var, global_var
    - set_variable requires both 'name' and 'value' parameters
    - change_variable requires 'name' and at least one operation
    - clamp_variable requires 'name' and at least 'min' or 'max'
    - List operations require valid 'name' and 'target' (for add/remove)

USAGE EXAMPLES:
    >>> # Parse variable reference
    >>> scope, name = parse_variable_reference('var:gold_count')
    >>> scope  # 'var'
    >>> name   # 'gold_count'
    
    >>> # Validate variable name
    >>> is_valid_variable_name('my_variable')  # True
    >>> is_valid_variable_name('123invalid')   # False (starts with number)
    
    >>> # Check variable effect
    >>> is_variable_effect('set_variable')  # True
    >>> is_variable_effect('add_gold')      # False

PERFORMANCE:
    - Variable reference parsing: O(1) - simple string split
    - Name validation: O(n) where n = name length (regex match)
    - Effect/trigger checks: O(1) - set membership
    - Typical usage: <1ms per validation

SEE ALSO:
    - scopes.py: Variable scopes relate to scope system
    - diagnostics.py: Uses this module for variable validation
    - completions.py: Variable name auto-completion
"""

# =============================================================================
# IMPORTS
# =============================================================================

# typing: Type hints for better code documentation
from typing import Dict, List, Optional, Tuple, Any

# dataclasses: For efficient data structures
from dataclasses import dataclass

# re: Regular expressions for variable name validation
import re


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class Variable:
    """
    Represents a CK3 variable with its properties and value.

    Variables in CK3 are key-value pairs scoped to different contexts (character,
    block, or global). This dataclass encapsulates all metadata about a variable
    for tracking and validation purposes.

    IMMUTABILITY NOTE:
    While the dataclass is mutable, instances should generally be treated as
    snapshots of variable state at a point in time.

    Attributes:
        name: Variable identifier without scope prefix
             Examples: 'gold_counter', 'my_flag', 'temp_value'
             Must match pattern: [a-zA-Z_][a-zA-Z0-9_]*
        scope: Variable scope type determining lifetime and visibility
              One of: 'var', 'local_var', 'global_var'
        value: Current value if known at validation time
              Can be: int, float, string, or None if unknown
              None is common during static analysis before runtime
        is_list: Whether this variable holds a list of scope references
                True for variables used with add_to_variable_list
                False for scalar variables (numbers, flags)

    Examples:
        >>> # Scalar persistent variable
        >>> var = Variable(
        ...     name='gold_count',
        ...     scope='var',
        ...     value=100,
        ...     is_list=False
        ... )
        
        >>> # Temporary list variable
        >>> var = Variable(
        ...     name='traitor_list',
        ...     scope='local_var',
        ...     value=None,  # Value unknown during parsing
        ...     is_list=True
        ... )
        
        >>> # Global flag
        >>> var = Variable(
        ...     name='mod_initialized',
        ...     scope='global_var',
        ...     value=True,
        ...     is_list=False
        ... )

    Performance:
        Lightweight dataclass with minimal memory overhead (~100 bytes)
    """

    name: str  # Variable identifier (without prefix)
    scope: str  # Scope type: 'var', 'local_var', 'global_var'
    value: Optional[Any] = None  # Current value if known
    is_list: bool = False  # True for variable lists


# =============================================================================
# VARIABLE SYSTEM CONSTANTS
# =============================================================================

# Variable scope prefixes - defines the three scoping levels in CK3
# Each prefix determines lifetime and visibility of variables
# These are part of the CK3 scripting language syntax
VARIABLE_SCOPES = {
    "var",  # Character/Title persistent - saved with character/title
    "local_var",  # Block scope temporary - cleared after block execution
    "global_var",  # Global save game - persists across entire game
}

# Variable effects - commands that create or modify variables
# These are effect commands (change game state) not triggers (check state)
# All variable modifications must use these commands
VARIABLE_EFFECTS = {
    "set_variable",  # Create/update variable with new value
    "change_variable",  # Modify existing value with arithmetic
    "clamp_variable",  # Constrain value to min/max bounds
    "round_variable",  # Round value to nearest integer
    "remove_variable",  # Delete variable from scope
    "add_to_variable_list",  # Add scope reference to list
    "remove_list_variable",  # Remove scope from list
    "clear_variable_list",  # Empty all items from list
}

# Variable triggers - conditional checks for variable state
# These are trigger commands (test state) not effects (change state)
# Used in trigger blocks to make decisions based on variables
VARIABLE_TRIGGERS = {
    "has_variable",  # Check if variable exists in scope
    "is_target_in_variable_list",  # Check if scope is in list
    "variable_list_size",  # Get number of items in list (can compare)
    # List iterators - can be used in both triggers and effects
    "any_in_list",  # Iterate list (trigger mode: check if any match)
    "every_in_list",  # Iterate list (effect mode: apply to all)
    "ordered_in_list",  # Iterate list in sorted order
    "random_in_list",  # Iterate list with random selection
}


# =============================================================================
# PARSING AND IDENTIFICATION FUNCTIONS
# =============================================================================

def parse_variable_reference(identifier: str) -> Optional[Tuple[str, str]]:
    """
    Parse a variable reference identifier into scope and name components.

    Variable references in CK3 use colon syntax: scope_prefix:variable_name
    This function validates the syntax and extracts both components.

    Algorithm:
    1. Check for colon separator (required for variable syntax)
    2. Split on first colon only (names can't have colons anyway)
    3. Validate scope prefix is known (var, local_var, global_var)
    4. Validate variable name matches identifier rules
    5. Return tuple if valid, None otherwise

    Args:
        identifier: String to parse
                   Valid: 'var:my_var', 'local_var:counter', 'global_var:flag'
                   Invalid: 'my_var' (no scope), 'bad:my_var' (unknown scope)

    Returns:
        Tuple of (scope_prefix, variable_name) if valid variable reference
        None if identifier doesn't match variable reference pattern

    Examples:
        >>> # Valid variable references
        >>> parse_variable_reference('var:my_variable')
        ('var', 'my_variable')

        >>> parse_variable_reference('local_var:counter')
        ('local_var', 'counter')
        
        >>> parse_variable_reference('global_var:mod_flag')
        ('global_var', 'mod_flag')

        >>> # Invalid references
        >>> parse_variable_reference('invalid')
        None  # No colon
        
        >>> parse_variable_reference('bad:my_var')
        None  # Unknown scope prefix
        
        >>> parse_variable_reference('var:123invalid')
        None  # Invalid name (starts with number)

    Performance:
        O(1) for split and scope check
        O(n) for name validation where n = name length

    Diagnostic Codes:
        VAR-002: Emitted by callers when scope prefix is unknown
        VAR-001: Emitted by callers when variable name is invalid
    """
    # Check for colon separator - required for variable reference syntax
    if ":" not in identifier:
        return None  # Not a variable reference

    # Split on first colon only (maxsplit=1)
    # This handles edge case of colons in unexpected places
    parts = identifier.split(":", 1)
    
    # Defensive check - should always be 2 parts after split with maxsplit=1
    if len(parts) != 2:
        return None

    # Extract scope prefix and variable name
    scope, name = parts

    # Validate scope prefix is one of the three valid types
    if scope not in VARIABLE_SCOPES:
        return None  # Unknown scope prefix (VAR-002)

    # Validate variable name is non-empty and follows identifier rules
    if not name or not is_valid_variable_name(name):
        return None  # Invalid or empty name (VAR-001)

    # Valid variable reference - return components
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
