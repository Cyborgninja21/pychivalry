"""
Scope System for CK3 Scripts

DIAGNOSTIC CODES:
    SCOPE-001: Unknown scope type
    SCOPE-002: Invalid scope link
    SCOPE-003: Invalid scope chain
    SCOPE-004: Trigger not valid in scope
    SCOPE-005: Effect not valid in scope
    SCOPE-006: Invalid list base for scope

MODULE OVERVIEW:
    This module provides comprehensive scope type tracking, validation, and navigation
    for Crusader Kings 3 script files. Scopes are the fundamental context system in CK3
    scripting, representing different game entities (characters, titles, provinces, etc.)
    and defining what operations and commands are valid in each context.

SCOPE CONCEPT:
    In CK3 scripting, a "scope" is the current game object context. Different commands
    and checks work on different scope types. For example:
    - add_gold only works on character scopes
    - has_holder only works on title scopes
    - Scope transitions like "liege" or "primary_title" change the active scope

DATA-DRIVEN DESIGN:
    All scope definitions are loaded from YAML files in the data/scopes/ directory.
    This allows non-developers to update game definitions when new patches or DLCs
    are released, without touching Python code. Each YAML file defines:
    - links: Valid single-step scope transitions
    - lists: Valid collection iterations (for any_*, every_*, etc.)
    - triggers: Conditional checks available in this scope
    - effects: Commands that modify state in this scope

SCOPE CHAINS:
    Scopes can be chained together with dot notation to navigate through relationships:
    Example: root.liege.primary_title.holder
    - Start at root (original character)
    - Navigate to liege (their feudal lord)
    - Navigate to primary_title (the liege's main title)
    - Navigate to holder (back to the character holding that title)

USAGE EXAMPLES:
    >>> # Check if a link is valid for a scope
    >>> links = get_scope_links('character')
    >>> 'liege' in links  # True
    
    >>> # Validate a scope chain
    >>> is_valid, result = validate_scope_chain('liege.primary_title.holder', 'character')
    >>> # Returns (True, 'character')
    
    >>> # Check if an effect works in a scope
    >>> is_valid_effect('add_gold', 'character')  # True
    >>> is_valid_effect('add_gold', 'province')   # False

PERFORMANCE NOTES:
    - Scope data is cached after first load
    - Validation is fast (O(1) dictionary lookups)
    - Scope chain validation is O(n) where n = chain length

SEE ALSO:
    - data/scopes/*.yaml: Scope definitions
    - parser.py: AST nodes have scope_type tracking
    - diagnostics.py: Uses scope validation for error checking
"""

# Standard library imports for type hints and logging
from typing import List, Tuple, Optional, Dict

# Internal imports - data loading utilities
from pychivalry.data import get_scopes

# Logging for diagnostic output
import logging

# Initialize logger for this module - used for warnings about unknown scopes
logger = logging.getLogger(__name__)

# =============================================================================
# UNIVERSAL SCOPE LINKS
# =============================================================================
# These scope links work in ALL scope types and maintain the current scope type
# - root: The original scope when the script started executing
# - this: The current scope (redundant but sometimes used for clarity)
# - prev: The previous scope in a scope transition
# - from: The scope that triggered the current event/effect
# - fromfrom: The scope two levels back in the trigger chain
UNIVERSAL_LINKS = ["root", "this", "prev", "from", "fromfrom"]

# =============================================================================
# SCOPE DATA RETRIEVAL FUNCTIONS
# =============================================================================

def get_scope_links(scope_type: str) -> List[str]:
    """
    Get valid scope links for a given scope type.

    Scope links are single-step navigations to related objects (e.g., 'liege', 'spouse').
    This function retrieves the valid navigation paths from the current scope type to
    other game objects.

    Args:
        scope_type: The scope type to query (e.g., 'character', 'landed_title', 'province')
                   Must match a key in the data/scopes/*.yaml files

    Returns:
        List of valid link names, always including universal links.
        Returns only universal links if scope_type is unknown.

    Examples:
        >>> get_scope_links('character')
        ['liege', 'spouse', 'father', 'mother', 'primary_title', ..., 'root', 'this', ...]
        
        >>> get_scope_links('unknown_scope')  # Returns universal links only
        ['root', 'this', 'prev', 'from', 'fromfrom']

    Diagnostic Codes:
        SCOPE-001: Emitted when scope_type is not found in scope definitions
    """
    # Load scope definitions from YAML files (cached after first call)
    scopes = get_scopes()

    # Check if the requested scope type exists in our definitions
    if scope_type not in scopes:
        # Log warning with diagnostic code for tracking unknown scopes
        logger.warning(f"Unknown scope type: {scope_type}")  # SCOPE-001
        # Fallback: return only universal links that work everywhere
        return UNIVERSAL_LINKS.copy()

    # Extract the scope-specific data dictionary
    scope_data = scopes[scope_type]
    # Get the 'links' list from scope data, defaulting to empty list if not present
    links = scope_data.get("links", [])

    # Combine scope-specific links with universal links that work in all scopes
    all_links = links + UNIVERSAL_LINKS
    # Convert to set and back to list to remove any duplicate entries
    # (in case a scope-specific link name matches a universal one)
    return list(set(all_links))


def get_scope_lists(scope_type: str) -> List[str]:
    """
    Get valid list iterations for a given scope type.

    List iterations are base names that can be prefixed with any_*, every_*, random_*,
    or ordered_* to create collection iterators. For example, 'vassal' becomes:
    - any_vassal: Trigger checking if any vassal matches conditions
    - every_vassal: Effect applying to all vassals
    - random_vassal: Effect applying to one random vassal
    - ordered_vassal: Effect applying to vassals in specified order

    Args:
        scope_type: The scope type to query (e.g., 'character', 'landed_title')
                   Must match a key in the data/scopes/*.yaml files

    Returns:
        List of valid list iteration base names for this scope.
        Returns empty list if scope_type is unknown.

    Examples:
        >>> get_scope_lists('character')
        ['vassal', 'courtier', 'child', 'prisoner', 'heir', ...]
        
        >>> get_scope_lists('province')
        ['neighboring_province', 'county_province', ...]

    Diagnostic Codes:
        SCOPE-001: Emitted when scope_type is not found in scope definitions
    """
    # Load scope definitions from YAML files (cached)
    scopes = get_scopes()

    # Validate that the scope type exists
    if scope_type not in scopes:
        # Log warning - invalid scope type means no valid list iterations
        logger.warning(f"Unknown scope type: {scope_type}")  # SCOPE-001
        # Return empty list since we don't know what lists are valid
        return []

    # Get the scope-specific data
    scope_data = scopes[scope_type]
    # Extract and return the list of valid list iteration bases
    # Default to empty list if 'lists' key doesn't exist
    return scope_data.get("lists", [])



def get_scope_triggers(scope_type: str) -> List[str]:
    """
    Get valid triggers for a given scope type.

    Triggers are conditional checks that can be used in trigger blocks to test game state.
    Different triggers are available in different scopes - for example, 'is_adult' works
    on characters but not on provinces.

    Args:
        scope_type: The scope type to query (e.g., 'character', 'title', 'province')

    Returns:
        List of valid trigger names for this scope type.
        Returns empty list if scope_type is unknown.

    Examples:
        >>> get_scope_triggers('character')
        ['is_adult', 'is_alive', 'has_trait', 'age', 'gold', ...]

    Diagnostic Codes:
        SCOPE-001: Emitted when scope_type is not found
    """
    # Load cached scope definitions
    scopes = get_scopes()

    # Validate scope type exists
    if scope_type not in scopes:
        logger.warning(f"Unknown scope type: {scope_type}")  # SCOPE-001
        return []

    # Extract scope data and return triggers list
    scope_data = scopes[scope_type]
    return scope_data.get("triggers", [])


def get_scope_effects(scope_type: str) -> List[str]:
    """
    Get valid effects for a given scope type.

    Effects are commands that modify game state. Like triggers, different effects
    work on different scope types - 'add_gold' works on characters, but 'set_county_faith'
    only works on county titles.

    Args:
        scope_type: The scope type to query (e.g., 'character', 'title', 'province')

    Returns:
        List of valid effect names for this scope type.
        Returns empty list if scope_type is unknown.

    Examples:
        >>> get_scope_effects('character')
        ['add_gold', 'add_trait', 'death', 'imprison', ...]

    Diagnostic Codes:
        SCOPE-001: Emitted when scope_type is not found
    """
    # Load cached scope definitions
    scopes = get_scopes()

    # Validate scope type exists
    if scope_type not in scopes:
        logger.warning(f"Unknown scope type: {scope_type}")  # SCOPE-001
        return []

    # Extract scope data and return effects list
    scope_data = scopes[scope_type]
    return scope_data.get("effects", [])


def get_available_scope_types() -> List[str]:
    """
    Get all available scope types defined in the system.

    This returns all scope types that have been defined in the data/scopes/*.yaml files.
    Useful for validation, UI dropdowns, and autocomplete suggestions.

    Returns:
        List of all defined scope type names.
        Common scope types include: 'character', 'landed_title', 'province',
        'dynasty', 'house', 'faith', 'culture', etc.

    Examples:
        >>> get_available_scope_types()
        ['character', 'landed_title', 'province', 'dynasty', 'house', 'faith', ...]
    """
    # Load scope definitions (cached)
    scopes = get_scopes()
    # Return all keys from the scopes dictionary
    # Each key is a scope type name
    return list(scopes.keys())


# =============================================================================
# SCOPE NAVIGATION AND TRANSFORMATION
# =============================================================================

def get_resulting_scope(current_scope: str, link: str) -> str:
    """
    Determine the resulting scope type after following a link.

    When you navigate from one scope to another using a link (like 'liege' or
    'primary_title'), the resulting scope type may be different. This function
    determines what type of scope you end up in after the navigation.

    IMPLEMENTATION NOTE:
    This is a simplified hardcoded implementation. In an ideal data-driven design,
    this mapping would come from the YAML scope definitions. However, for performance
    and simplicity, common mappings are hardcoded here.

    Args:
        current_scope: The scope type you're starting from (e.g., 'character')
        link: The link you're following (e.g., 'liege', 'primary_title')

    Returns:
        The resulting scope type after following the link.
        Defaults to current_scope if the mapping is unknown.

    Examples:
        >>> get_resulting_scope('character', 'liege')
        'character'  # liege of a character is another character
        
        >>> get_resulting_scope('character', 'primary_title')
        'landed_title'  # primary_title of a character is a title
        
        >>> get_resulting_scope('character', 'root')
        'character'  # universal links preserve scope type

    Scope Flow Examples:
        character -> liege -> character
        character -> primary_title -> landed_title
        landed_title -> holder -> character
        character -> location -> province
    """
    # Universal links always preserve the current scope type
    # These are special reference links that don't change scope type
    if link in ["this", "root", "prev", "from", "fromfrom"]:
        return current_scope

    # Hardcoded scope transformation mappings for performance
    # Each scope type maps link names to resulting scope types
    # TODO: Consider moving this to YAML data files for maintainability
    scope_mappings = {
        # Character scope transformations
        "character": {
            # Character -> Character (family and relationships)
            "liege": "character",  # Your feudal lord
            "spouse": "character",  # Your husband/wife
            "father": "character",  # Your biological father
            "mother": "character",  # Your biological mother
            # Character -> Title (holdings and governance)
            "primary_title": "landed_title",  # Your main title
            "capital_county": "landed_title",  # Your capital county
            # Character -> Location
            "location": "province",  # Where you are physically
            # Character -> Dynasty/House
            "dynasty": "dynasty",  # Your dynasty
            "house": "house",  # Your cadet branch
            # Character -> Culture/Religion
            "faith": "faith",  # Your religion
            "culture": "culture",  # Your culture
        },
        # Landed title scope transformations
        "landed_title": {
            # Title -> Character
            "holder": "character",  # Who currently holds this title
            "previous_holder": "character",  # Who held it before
            # Title -> Title (hierarchy)
            "de_jure_liege": "landed_title",  # De jure liege title
            "capital_county": "landed_title",  # Capital of realm
        },
        # Province scope transformations
        "province": {
            # Province -> Title
            "county": "landed_title",  # County containing this province
            "barony": "landed_title",  # Barony (holding) in this province
            # Province -> Character
            "holder": "character",  # Who controls this province
        },
    }

    # Look up the transformation for this scope and link
    if current_scope in scope_mappings:
        # Get the resulting scope type from our mapping
        # Default to current_scope if the specific link isn't mapped
        return scope_mappings[current_scope].get(link, current_scope)

    # If we don't have a mapping for this scope type, assume the scope type doesn't change
    # This is a safe default that prevents errors
    return current_scope


def validate_scope_chain(chain: str, starting_scope: str) -> Tuple[bool, str]:
    """
    Validate a complete scope chain and return the final scope type.

    Scope chains allow navigation through multiple relationships using dot notation.
    This function validates each step of the chain and tracks the scope type
    transformations along the way.

    Algorithm:
    1. Split chain by '.' to get individual link steps
    2. For each step:
       a. Check if link is valid from current scope
       b. If invalid, return error with diagnostic info
       c. If valid, update current scope to resulting scope type
    3. Return final scope type if all steps valid

    Args:
        chain: Dot-separated scope chain (e.g., 'liege.primary_title.holder')
               Can be empty string for identity chain
        starting_scope: Initial scope type (e.g., 'character', 'title')

    Returns:
        Tuple of (is_valid, result_or_error):
        - If valid: (True, final_scope_type_as_string)
        - If invalid: (False, error_message_describing_problem)

    Examples:
        >>> validate_scope_chain('liege.primary_title.holder', 'character')
        (True, 'character')
        # Explanation: character -> character -> landed_title -> character
        
        >>> validate_scope_chain('invalid_link', 'character')
        (False, "'invalid_link' is not a valid link from character scope")
        
        >>> validate_scope_chain('', 'character')
        (True, 'character')  # Empty chain is identity transformation

    Diagnostic Codes:
        SCOPE-002: Invalid scope link
        SCOPE-003: Invalid scope chain
    """
    # Handle empty chain - this is a valid identity transformation
    # (scope doesn't change)
    if not chain:
        return (True, starting_scope)

    # Split the chain into individual link steps
    # Example: "liege.primary_title.holder" -> ["liege", "primary_title", "holder"]
    parts = chain.split(".")
    
    # Track the current scope as we navigate through the chain
    current_scope = starting_scope

    # Validate each link in the chain sequentially
    for part in parts:
        # Get all valid links available from the current scope type
        valid_links = get_scope_links(current_scope)

        # Check if this link is allowed from the current scope
        if part not in valid_links:
            # Invalid link - return error with diagnostic information
            # Include both the invalid link and current scope for debugging
            return (False, f"'{part}' is not a valid link from {current_scope} scope")  # SCOPE-002

        # Link is valid - update current scope to the result of following this link
        # This prepares us for validating the next link in the chain
        current_scope = get_resulting_scope(current_scope, part)

    # All links validated successfully
    # Return success with the final scope type after all transformations
    return (True, current_scope)


# =============================================================================
# VALIDATION HELPER FUNCTIONS
# =============================================================================

def is_valid_trigger(trigger: str, scope_type: str) -> bool:
    """
    Check if a trigger is valid in the given scope type.

    Triggers are conditional checks (like 'is_adult', 'has_trait', 'age >= 16')
    that test game state. Each trigger only works in specific scope types.

    Args:
        trigger: The trigger name to validate (e.g., 'is_adult', 'has_trait')
        scope_type: The scope type to check against (e.g., 'character', 'province')

    Returns:
        True if the trigger can be used in this scope type, False otherwise

    Examples:
        >>> is_valid_trigger('is_adult', 'character')
        True  # Characters have an age, can be adult
        
        >>> is_valid_trigger('is_adult', 'province')
        False  # Provinces don't have age, can't be adult

    Performance:
        O(1) lookup using set membership testing after first load (cached)

    Diagnostic Codes:
        SCOPE-004: Used by callers when this returns False
    """
    # Get the list of valid triggers for this scope type
    valid_triggers = get_scope_triggers(scope_type)
    # Check if the requested trigger is in the valid list
    # This is an O(n) list search, but lists are typically small (<100 items)
    return trigger in valid_triggers


def is_valid_effect(effect: str, scope_type: str) -> bool:
    """
    Check if an effect is valid in the given scope type.

    Effects are commands that modify game state (like 'add_gold', 'add_trait', 'death').
    Each effect only works in specific scope types - you can't add gold to a province.

    Args:
        effect: The effect name to validate (e.g., 'add_gold', 'add_trait')
        scope_type: The scope type to check against (e.g., 'character', 'province')

    Returns:
        True if the effect can be used in this scope type, False otherwise

    Examples:
        >>> is_valid_effect('add_gold', 'character')
        True  # Characters can receive gold
        
        >>> is_valid_effect('add_gold', 'province')
        False  # Provinces don't have gold

    Performance:
        O(1) lookup using set membership testing after first load (cached)

    Diagnostic Codes:
        SCOPE-005: Used by callers when this returns False
    """
    # Get the list of valid effects for this scope type
    valid_effects = get_scope_effects(scope_type)
    # Check if the requested effect is in the valid list
    return effect in valid_effects


def is_valid_list_base(list_base: str, scope_type: str) -> bool:
    """
    Check if a list base is valid in the given scope type.

    List bases are used with prefixes (any_*, every_*, random_*, ordered_*) to
    iterate over collections. For example, 'vassal' is a list base that becomes
    'every_vassal', 'any_vassal', etc.

    Args:
        list_base: The base name to validate (e.g., 'vassal', 'courtier', 'child')
        scope_type: The scope type to check against (e.g., 'character', 'title')

    Returns:
        True if the list base is valid for this scope type, False otherwise

    Examples:
        >>> is_valid_list_base('vassal', 'character')
        True  # Characters can have vassals
        
        >>> is_valid_list_base('vassal', 'province')
        False  # Provinces don't have vassals

    Performance:
        O(1) lookup using set membership testing after first load (cached)

    Diagnostic Codes:
        SCOPE-006: Used by callers when this returns False
    """
    # Get the list of valid list iteration bases for this scope type
    valid_lists = get_scope_lists(scope_type)
    # Check if the requested list base is in the valid list
    return list_base in valid_lists


# =============================================================================
# LIST ITERATOR PARSING AND VALIDATION
# =============================================================================

def get_list_prefixes() -> List[str]:
    """
    Get all valid list iteration prefixes used in CK3 scripting.

    List iteration prefixes are combined with list bases to create iteration commands:
    - any_: Creates a trigger that checks if any item matches (e.g., any_vassal)
    - every_: Creates an effect that applies to all items (e.g., every_vassal)
    - random_: Creates an effect for one random item (e.g., random_vassal)
    - ordered_: Creates an effect for items in sorted order (e.g., ordered_vassal)

    Returns:
        List of four standard list prefixes used in CK3

    Examples:
        >>> get_list_prefixes()
        ['any_', 'every_', 'random_', 'ordered_']

    Usage in CK3:
        any_vassal = { ... }      # Trigger: checks if any vassal matches
        every_vassal = { ... }    # Effect: applies to all vassals
        random_vassal = { ... }   # Effect: applies to one random vassal
        ordered_vassal = { ... }  # Effect: applies in sorted order
    """
    # These four prefixes are standard across all CK3 list iterations
    # They are hardcoded as they are part of the core CK3 scripting language
    return ["any_", "every_", "random_", "ordered_"]


def parse_list_iterator(identifier: str) -> Optional[Tuple[str, str]]:
    """
    Parse a list iterator identifier into its prefix and base components.

    List iterators follow the pattern: prefix + base (e.g., 'every_' + 'vassal').
    This function splits an identifier into these components if it matches
    a valid list iterator pattern.

    Algorithm:
    1. Check if identifier is a special non-iterator keyword
    2. For each valid prefix:
       a. Check if identifier starts with that prefix
       b. If yes, extract the base name (everything after prefix)
       c. Return (prefix, base) tuple
    3. Return None if no prefix matches

    Args:
        identifier: The identifier to parse (e.g., 'every_vassal', 'any_child')
                   Must be a string that might be a list iterator

    Returns:
        Tuple of (prefix, base) if valid list iterator, None otherwise.
        - prefix: One of 'any_', 'every_', 'random_', 'ordered_'
        - base: The list base name (e.g., 'vassal', 'child', 'courtier')

    Examples:
        >>> parse_list_iterator('every_vassal')
        ('every_', 'vassal')
        
        >>> parse_list_iterator('any_child')
        ('any_', 'child')
        
        >>> parse_list_iterator('random_list')
        None  # Special keyword, not a list iterator
        
        >>> parse_list_iterator('add_gold')
        None  # Not a list iterator pattern

    Special Cases:
        Some identifiers look like list iterators but aren't:
        - random_list: A different construct for weighted random selection
        - ordered_list: A different construct for ordered selection
        - any_of, every_one: Logic operators, not iterators

    Performance:
        O(1) for special case check, O(4) = O(1) for prefix matching
        (only 4 prefixes to check)
    """
    # Define special cases that look like list iterators but aren't
    # These are control flow or logic constructs with different semantics
    NON_LIST_ITERATORS = {"random_list", "ordered_list", "any_of", "every_one"}
    
    # Quick check: if identifier is a special non-iterator, return None immediately
    if identifier in NON_LIST_ITERATORS:
        return None

    # Try each valid list prefix in order
    for prefix in get_list_prefixes():
        # Check if the identifier starts with this prefix
        if identifier.startswith(prefix):
            # Extract the base name by removing the prefix
            # Example: 'every_vassal'[6:] = 'vassal'
            base = identifier[len(prefix):]
            # Return the parsed components as a tuple
            return (prefix, base)

    # No matching prefix found - not a valid list iterator
    return None
