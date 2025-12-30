"""
Scope system for CK3 scripts.

This module provides scope type tracking, validation, and navigation for CK3 scripts.
Scopes represent different game objects (characters, titles, provinces, etc.) and define
what operations are valid in each context.

The scope definitions are loaded from data/scopes/*.yaml files, making it easy to add
new scope types or update existing ones without modifying code.
"""

from typing import List, Tuple, Optional, Dict
from pychivalry.data import get_scopes
import logging

logger = logging.getLogger(__name__)

# Universal scope links available in all scopes
UNIVERSAL_LINKS = ['root', 'this', 'prev', 'from', 'fromfrom']


def get_scope_links(scope_type: str) -> List[str]:
    """
    Get valid scope links for a given scope type.
    
    Scope links are single-step navigations to related objects (e.g., 'liege', 'spouse').
    
    Args:
        scope_type: The scope type (e.g., 'character', 'landed_title', 'province')
        
    Returns:
        List of valid link names, including universal links
    """
    scopes = get_scopes()
    
    if scope_type not in scopes:
        logger.warning(f"Unknown scope type: {scope_type}")
        return UNIVERSAL_LINKS.copy()
    
    scope_data = scopes[scope_type]
    links = scope_data.get('links', [])
    
    # Combine scope-specific links with universal links
    all_links = links + UNIVERSAL_LINKS
    return list(set(all_links))  # Remove duplicates


def get_scope_lists(scope_type: str) -> List[str]:
    """
    Get valid list iterations for a given scope type.
    
    List iterations are bases for any_*, every_*, random_*, ordered_* patterns
    (e.g., 'vassal' becomes 'every_vassal', 'any_vassal', etc.).
    
    Args:
        scope_type: The scope type (e.g., 'character', 'landed_title')
        
    Returns:
        List of valid list iteration base names
    """
    scopes = get_scopes()
    
    if scope_type not in scopes:
        logger.warning(f"Unknown scope type: {scope_type}")
        return []
    
    scope_data = scopes[scope_type]
    return scope_data.get('lists', [])


def get_scope_triggers(scope_type: str) -> List[str]:
    """
    Get valid triggers for a given scope type.
    
    Triggers are conditional checks that can be used in trigger blocks.
    
    Args:
        scope_type: The scope type
        
    Returns:
        List of valid trigger names
    """
    scopes = get_scopes()
    
    if scope_type not in scopes:
        logger.warning(f"Unknown scope type: {scope_type}")
        return []
    
    scope_data = scopes[scope_type]
    return scope_data.get('triggers', [])


def get_scope_effects(scope_type: str) -> List[str]:
    """
    Get valid effects for a given scope type.
    
    Effects are commands that modify game state.
    
    Args:
        scope_type: The scope type
        
    Returns:
        List of valid effect names
    """
    scopes = get_scopes()
    
    if scope_type not in scopes:
        logger.warning(f"Unknown scope type: {scope_type}")
        return []
    
    scope_data = scopes[scope_type]
    return scope_data.get('effects', [])


def get_available_scope_types() -> List[str]:
    """
    Get all available scope types.
    
    Returns:
        List of scope type names
    """
    scopes = get_scopes()
    return list(scopes.keys())


def get_resulting_scope(current_scope: str, link: str) -> str:
    """
    Determine the resulting scope type after following a link.
    
    This is a simplified implementation. In reality, some links return the same
    scope type (e.g., character.liege -> character), while others return different
    types (e.g., character.primary_title -> landed_title).
    
    Args:
        current_scope: Current scope type
        link: Link to follow
        
    Returns:
        Resulting scope type (may be same as current_scope)
    """
    # Universal links preserve scope type
    if link in ['this', 'root', 'prev', 'from', 'fromfrom']:
        return current_scope
    
    # Simplified mapping for common cases
    # In a real implementation, this would be data-driven from scope definitions
    scope_mappings = {
        'character': {
            'liege': 'character',
            'spouse': 'character',
            'father': 'character',
            'mother': 'character',
            'primary_title': 'landed_title',
            'capital_county': 'landed_title',
            'location': 'province',
            'dynasty': 'dynasty',
            'house': 'house',
            'faith': 'faith',
            'culture': 'culture',
        },
        'landed_title': {
            'holder': 'character',
            'previous_holder': 'character',
            'de_jure_liege': 'landed_title',
            'capital_county': 'landed_title',
        },
        'province': {
            'county': 'landed_title',
            'barony': 'landed_title',
            'holder': 'character',
        },
    }
    
    if current_scope in scope_mappings:
        return scope_mappings[current_scope].get(link, current_scope)
    
    # Default: assume same scope type
    return current_scope


def validate_scope_chain(chain: str, starting_scope: str) -> Tuple[bool, str]:
    """
    Validate a scope chain (e.g., 'liege.primary_title.holder').
    
    Checks that each link in the chain is valid for the current scope type,
    and returns the final scope type if valid.
    
    Args:
        chain: Scope chain string (e.g., 'liege.primary_title.holder')
        starting_scope: Starting scope type (e.g., 'character')
        
    Returns:
        Tuple of (is_valid, result_or_error)
        - If valid: (True, final_scope_type)
        - If invalid: (False, error_message)
    """
    if not chain:
        return (True, starting_scope)
    
    parts = chain.split('.')
    current_scope = starting_scope
    
    for part in parts:
        valid_links = get_scope_links(current_scope)
        
        if part not in valid_links:
            return (False, f"'{part}' is not a valid link from {current_scope} scope")
        
        # Move to next scope
        current_scope = get_resulting_scope(current_scope, part)
    
    return (True, current_scope)


def is_valid_trigger(trigger: str, scope_type: str) -> bool:
    """
    Check if a trigger is valid in the given scope type.
    
    Args:
        trigger: Trigger name
        scope_type: Scope type
        
    Returns:
        True if trigger is valid in this scope
    """
    valid_triggers = get_scope_triggers(scope_type)
    return trigger in valid_triggers


def is_valid_effect(effect: str, scope_type: str) -> bool:
    """
    Check if an effect is valid in the given scope type.
    
    Args:
        effect: Effect name
        scope_type: Scope type
        
    Returns:
        True if effect is valid in this scope
    """
    valid_effects = get_scope_effects(scope_type)
    return effect in valid_effects


def is_valid_list_base(list_base: str, scope_type: str) -> bool:
    """
    Check if a list base is valid in the given scope type.
    
    List bases are used with any_*, every_*, random_*, ordered_* prefixes.
    
    Args:
        list_base: List base name (e.g., 'vassal', 'courtier')
        scope_type: Scope type
        
    Returns:
        True if list base is valid in this scope
    """
    valid_lists = get_scope_lists(scope_type)
    return list_base in valid_lists


def get_list_prefixes() -> List[str]:
    """
    Get all valid list iteration prefixes.
    
    Returns:
        List of prefixes (e.g., ['any_', 'every_', 'random_', 'ordered_'])
    """
    return ['any_', 'every_', 'random_', 'ordered_']


def parse_list_iterator(identifier: str) -> Optional[Tuple[str, str]]:
    """
    Parse a list iterator identifier into prefix and base.
    
    Args:
        identifier: List iterator (e.g., 'every_vassal', 'any_child')
        
    Returns:
        Tuple of (prefix, base) if valid, None otherwise
        Example: 'every_vassal' -> ('every_', 'vassal')
    """
    # Special cases that look like list iterators but aren't
    NON_LIST_ITERATORS = {'random_list', 'ordered_list', 'any_of', 'every_one'}
    if identifier in NON_LIST_ITERATORS:
        return None
    
    for prefix in get_list_prefixes():
        if identifier.startswith(prefix):
            base = identifier[len(prefix):]
            return (prefix, base)
    
    return None
