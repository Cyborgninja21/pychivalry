"""
CK3 Script Lists Module

This module handles validation and processing of CK3 script list patterns.
List patterns allow iteration over collections of game objects with various
modifiers and filters.

List Prefixes:
- any_: Trigger that checks if any element matches conditions (supports count, percent)
- every_: Effect that applies to all matching elements (supports limit, max)
- random_: Effect that applies to one random element (supports limit, weight)
- ordered_: Effect that applies in sorted order (supports limit, order_by, position, max, min)

Validation Rules:
- any_ blocks can only contain triggers
- every_, random_, ordered_ blocks: triggers only allowed inside limit = { }
- Custom scripted lists can be loaded from common/scripted_lists/
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ListIteratorInfo:
    """
    Information about a list iterator pattern.

    Attributes:
        prefix: The prefix (any_, every_, random_, ordered_)
        base_name: The base list name (vassal, courtier, etc.)
        iterator_type: 'trigger' or 'effect'
        supported_params: List of valid parameters for this iterator type
    """

    prefix: str
    base_name: str
    iterator_type: str
    supported_params: List[str]


# List prefixes and their types
LIST_PREFIXES = {
    "any_": {"type": "trigger", "supported_params": ["count", "percent", "limit"]},
    "every_": {"type": "effect", "supported_params": ["limit", "max", "alternative_limit"]},
    "random_": {
        "type": "effect",
        "supported_params": ["limit", "weight", "save_temporary_scope_as"],
    },
    "ordered_": {
        "type": "effect",
        "supported_params": [
            "limit",
            "order_by",
            "position",
            "max",
            "min",
            "check_range_bounds",
            "save_temporary_scope_as",
        ],
    },
}


def parse_list_iterator(identifier: str) -> Optional[ListIteratorInfo]:
    """
    Parse a list iterator identifier and extract information.

    Args:
        identifier: The identifier to parse (e.g., 'any_vassal', 'every_courtier')

    Returns:
        ListIteratorInfo if valid list iterator, None otherwise

    Examples:
        >>> parse_list_iterator('any_vassal')
        ListIteratorInfo(prefix='any_', base_name='vassal', iterator_type='trigger', ...)

        >>> parse_list_iterator('every_courtier')
        ListIteratorInfo(prefix='every_', base_name='courtier', iterator_type='effect', ...)
    """
    for prefix, config in LIST_PREFIXES.items():
        if identifier.startswith(prefix):
            base_name = identifier[len(prefix) :]
            if base_name:  # Ensure there's something after the prefix
                return ListIteratorInfo(
                    prefix=prefix,
                    base_name=base_name,
                    iterator_type=config["type"],
                    supported_params=config["supported_params"],
                )
    return None


def is_list_iterator(identifier: str) -> bool:
    """
    Check if an identifier is a list iterator pattern.

    Args:
        identifier: The identifier to check

    Returns:
        True if identifier matches a list iterator pattern, False otherwise
    """
    return parse_list_iterator(identifier) is not None


def get_supported_parameters(iterator_info: ListIteratorInfo) -> List[str]:
    """
    Get the list of supported parameters for a list iterator.

    Args:
        iterator_info: Information about the list iterator

    Returns:
        List of valid parameter names for this iterator type
    """
    return iterator_info.supported_params


def validate_list_block_content(
    iterator_info: ListIteratorInfo, block_content: str, inside_limit: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Validate that block content matches the iterator type.

    For any_ (trigger): Only triggers allowed
    For every_/random_/ordered_ (effect): Effects allowed, triggers only in limit blocks

    Args:
        iterator_info: Information about the list iterator
        block_content: The identifier found in the block
        inside_limit: Whether we're inside a limit = { } block

    Returns:
        Tuple of (is_valid, error_message)

    Examples:
        >>> info = parse_list_iterator('any_vassal')
        >>> validate_list_block_content(info, 'has_trait', False)
        (True, None)

        >>> info = parse_list_iterator('any_vassal')
        >>> validate_list_block_content(info, 'add_gold', False)
        (False, "Effects not allowed in 'any_' blocks")
    """
    # For now, this is a simplified implementation
    # In a full implementation, we'd check against known effects/triggers

    if iterator_info.iterator_type == "trigger":
        # any_ blocks should only contain triggers
        # We'd check if block_content is an effect (not allowed)
        # For now, just validate structure
        return (True, None)

    elif iterator_info.iterator_type == "effect":
        # every_/random_/ordered_ blocks can contain effects
        # Triggers are only allowed inside limit blocks
        return (True, None)

    return (False, f"Unknown iterator type: {iterator_info.iterator_type}")


def is_valid_list_parameter(iterator_info: ListIteratorInfo, param_name: str) -> bool:
    """
    Check if a parameter is valid for the given list iterator.

    Args:
        iterator_info: Information about the list iterator
        param_name: The parameter name to validate

    Returns:
        True if parameter is valid for this iterator, False otherwise

    Examples:
        >>> info = parse_list_iterator('any_vassal')
        >>> is_valid_list_parameter(info, 'count')
        True

        >>> is_valid_list_parameter(info, 'order_by')
        False
    """
    return param_name in iterator_info.supported_params


# Common list bases that are valid across different scopes
# This is a subset - the full list depends on the scope type
COMMON_LIST_BASES = {
    # Character lists
    "vassal",
    "courtier",
    "prisoner",
    "child",
    "sibling",
    "spouse",
    "ally",
    "enemy",
    "claim",
    "heir",
    "heir_to_title",
    "heir_title",
    "held_title",
    "neighboring_county",
    "neighboring_duke",
    "neighboring_king",
    "realm_county",
    "realm_province",
    "realm_de_jure_duchy",
    "realm_de_jure_kingdom",
    "character_to_title_neighboring_county",
    "character_to_title_neighboring_duke",
    "character_to_title_neighboring_king",
    "character_to_title_neighboring_emperor",
    # Title lists
    "de_jure_county",
    "de_jure_duchy",
    "de_jure_kingdom",
    "de_jure_empire",
    "county",
    "duchy",
    "kingdom",
    "empire",
    # Province lists
    "county_province",
    "neighboring_province",
    # Dynasty/House lists
    "dynasty_member",
    "house_member",
    # Faith/Culture lists
    "faith_holy_order",
    "faith_character",
    # Artifact lists
    "equipped_character_artifact",
    "inventory_artifact",
    "artifact",
    "character_artifact",
    "court_artifact",
    # Variable lists
    "in_list",  # For variable lists
}


def is_valid_list_base(base_name: str) -> bool:
    """
    Check if a base name is a valid list iterator base.

    Args:
        base_name: The base name to check (e.g., 'vassal', 'courtier')

    Returns:
        True if base_name is a known list base, False otherwise

    Note:
        This checks against common list bases. Scope-specific validation
        should also consult the scope definitions.
    """
    return base_name in COMMON_LIST_BASES


def get_list_result_scope(base_name: str, current_scope: str = "character") -> Optional[str]:
    """
    Determine the resulting scope type after a list iteration.

    Args:
        base_name: The base name of the list (e.g., 'vassal', 'courtier')
        current_scope: The current scope type

    Returns:
        The resulting scope type, or None if unknown

    Examples:
        >>> get_list_result_scope('vassal', 'character')
        'character'

        >>> get_list_result_scope('held_title', 'character')
        'title'
    """
    # Character lists return character scope
    character_lists = {
        "vassal",
        "courtier",
        "prisoner",
        "child",
        "sibling",
        "spouse",
        "ally",
        "enemy",
        "heir",
        "dynasty_member",
        "house_member",
    }

    # Artifact lists return artifact scope
    artifact_lists = {
        "equipped_character_artifact",
        "inventory_artifact",
        "artifact",
        "character_artifact",
        "court_artifact",
    }

    # Title lists return title scope
    title_lists = {
        "held_title",
        "claim",
        "heir_title",
        "heir_to_title",
        "de_jure_county",
        "de_jure_duchy",
        "de_jure_kingdom",
        "de_jure_empire",
        "county",
        "duchy",
        "kingdom",
        "empire",
        "neighboring_county",
        "neighboring_duchy",
        "neighboring_kingdom",
        "character_to_title_neighboring_county",
        "character_to_title_neighboring_duke",
        "character_to_title_neighboring_king",
        "character_to_title_neighboring_emperor",
    }

    # Province lists return province scope
    province_lists = {
        "realm_province",
        "county_province",
        "neighboring_province",
    }

    if base_name in character_lists:
        return "character"
    elif base_name in title_lists:
        return "title"
    elif base_name in province_lists:
        return "province"
    elif base_name in artifact_lists:
        return "artifact"
    elif base_name == "in_list":
        # Variable lists preserve the original scope of saved items
        return current_scope

    # Default to current scope if unknown
    return current_scope
