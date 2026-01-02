"""
CK3 Script Lists Module - Collection Iteration and Validation

DIAGNOSTIC CODES:
    LIST-001: Invalid list iterator prefix
    LIST-002: Invalid parameter for iterator type
    LIST-003: Trigger used in effect iterator outside limit block
    LIST-004: Effect used in trigger iterator (any_)
    LIST-005: Unknown list base for scope type

MODULE OVERVIEW:
    This module provides comprehensive validation and processing of CK3's powerful
    list iteration system. List patterns enable iteration over collections of game
    objects (vassals, courtiers, children, etc.) with filtering, counting, and ordering.
    
    List iteration is one of CK3's most commonly used features, appearing in nearly
    every event and decision. Proper validation prevents common scripting errors.

LIST ITERATION SYSTEM:
    CK3 uses a prefix-based system for iterating collections:
    
    Prefix + Base = Iterator
    Example: any_ + vassal = any_vassal
    
    Four prefixes with different semantics:
    
    1. any_ (TRIGGER):
       - Checks if ANY element in collection matches conditions
       - Returns true if count/percent threshold met
       - Parameters: count, percent, limit
       - Example: any_vassal = { count >= 3 has_trait = brave }
    
    2. every_ (EFFECT):
       - Applies effects to ALL matching elements
       - Can be limited with limit = { triggers }
       - Parameters: limit, max, alternative_limit
       - Example: every_vassal = { limit = { is_adult = yes } add_gold = 10 }
    
    3. random_ (EFFECT):
       - Applies effects to ONE random matching element
       - Can be weighted with weight parameter
       - Parameters: limit, weight, save_temporary_scope_as
       - Example: random_courtier = { weight = { base = 1 } add_trait = brave }
    
    4. ordered_ (EFFECT):
       - Applies effects to elements in sorted order
       - Requires order_by for sorting
       - Parameters: limit, order_by, position, max, min, check_range_bounds
       - Example: ordered_vassal = { order_by = gold position = 0 add_prestige = 100 }

VALIDATION RULES:
    Critical semantic validation prevents runtime errors:
    
    - any_ blocks can ONLY contain triggers (checks)
    - every_/random_/ordered_ blocks primarily contain effects
    - Triggers in effect blocks must be inside limit = { }
    - Each iterator type has specific allowed parameters
    - List bases must be valid for current scope type

SCOPE INTEGRATION:
    List iterators are scope-dependent. Valid bases depend on current scope:
    - character scope: vassal, courtier, child, prisoner, etc.
    - title scope: de_jure_county, de_jure_duchy, etc.
    - province scope: neighboring_province, county_province, etc.

CUSTOM SCRIPTED LISTS:
    Mods can define custom lists in common/scripted_lists/
    These follow same validation rules as built-in lists

USAGE EXAMPLES:
    >>> # Parse a list iterator
    >>> info = parse_list_iterator('any_vassal')
    >>> info.prefix  # 'any_'
    >>> info.base_name  # 'vassal'
    >>> info.iterator_type  # 'trigger'
    
    >>> # Validate parameters
    >>> is_valid_list_parameter(info, 'count')  # True
    >>> is_valid_list_parameter(info, 'weight')  # False (weight is for random_)

PERFORMANCE:
    - Iterator parsing: O(1) with 4 prefixes
    - Parameter validation: O(1) dictionary lookup
    - Base validation: O(1) set membership

SEE ALSO:
    - scopes.py: Provides valid list bases for each scope type
    - diagnostics.py: Uses this module for semantic validation
    - completions.py: Uses for iterator auto-completion
"""

# =============================================================================
# IMPORTS
# =============================================================================

# typing: Type hints for better code clarity
from typing import Dict, List, Optional, Tuple

# dataclasses: For efficient structured data
from dataclasses import dataclass


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class ListIteratorInfo:
    """
    Structured information about a parsed list iterator.

    This dataclass encapsulates all metadata needed to validate and process
    a list iterator. Created by parse_list_iterator() and used throughout
    the validation pipeline.

    IMMUTABILITY:
    Once created, instances should be treated as immutable. All fields are
    determined at parse time and don't change.

    Attributes:
        prefix: The list iterator prefix string
                One of: 'any_', 'every_', 'random_', 'ordered_'
        base_name: The collection name after the prefix
                   Examples: 'vassal', 'courtier', 'child', 'prisoner'
        iterator_type: Semantic type of iterator
                       - 'trigger': Conditional check (any_)
                       - 'effect': State modification (every_, random_, ordered_)
        supported_params: List of valid parameter names for this iterator
                         Varies by iterator type and prefix

    Examples:
        >>> # any_vassal is a trigger-type iterator
        >>> info = ListIteratorInfo(
        ...     prefix='any_',
        ...     base_name='vassal',
        ...     iterator_type='trigger',
        ...     supported_params=['count', 'percent', 'limit']
        ... )
        
        >>> # random_courtier is an effect-type iterator
        >>> info = ListIteratorInfo(
        ...     prefix='random_',
        ...     base_name='courtier',
        ...     iterator_type='effect',
        ...     supported_params=['limit', 'weight', 'save_temporary_scope_as']
        ... )

    Performance:
        Lightweight dataclass with minimal memory overhead (~80 bytes per instance)
    """

    prefix: str  # List iterator prefix: any_, every_, random_, ordered_
    base_name: str  # Collection name: vassal, courtier, child, etc.
    iterator_type: str  # Semantic type: 'trigger' or 'effect'
    supported_params: List[str]  # Valid parameters for this iterator type


# =============================================================================
# ITERATOR CONFIGURATION
# =============================================================================

# Master configuration for all list iterator prefixes
# Maps each prefix to its semantic type and allowed parameters
# This is the single source of truth for iterator validation
LIST_PREFIXES = {
    # any_: Conditional check - "does ANY element match?"
    # Used in trigger blocks, returns true/false
    "any_": {
        "type": "trigger",  # This is a conditional, not an effect
        "supported_params": [
            "count",  # Minimum matching elements: count >= 3
            "percent",  # Minimum matching percentage: percent >= 0.5
            "limit",  # Filter conditions: limit = { is_adult = yes }
        ],
    },
    # every_: Apply to all - "do this to EVERY matching element"
    # Used in effect blocks, modifies game state
    "every_": {
        "type": "effect",  # This modifies state
        "supported_params": [
            "limit",  # Filter which elements: limit = { is_adult = yes }
            "max",  # Maximum elements to affect: max = 5
            "alternative_limit",  # Fallback filter if limit matches nothing
        ],
    },
    # random_: Apply to one random - "pick ONE random matching element"
    # Used in effect blocks with optional weighting
    "random_": {
        "type": "effect",  # This modifies state
        "supported_params": [
            "limit",  # Filter which elements can be picked
            "weight",  # Probability weighting: weight = { base = 10 }
            "save_temporary_scope_as",  # Save selected element to variable
        ],
    },
    # ordered_: Apply in sort order - "do this in sorted order"
    # Used in effect blocks, processes elements by specified order
    "ordered_": {
        "type": "effect",  # This modifies state
        "supported_params": [
            "limit",  # Filter which elements to process
            "order_by",  # Sort criteria: order_by = gold
            "position",  # Which position to process: position = 0 (first)
            "max",  # Maximum elements to process
            "min",  # Minimum elements required
            "check_range_bounds",  # Validate position is in bounds: yes/no
            "save_temporary_scope_as",  # Save selected element to variable
        ],
    },
}


# =============================================================================
# PARSING AND IDENTIFICATION FUNCTIONS
# =============================================================================

def parse_list_iterator(identifier: str) -> Optional[ListIteratorInfo]:
    """
    Parse a list iterator identifier into structured information.

    This is the primary entry point for list iterator analysis. It examines
    an identifier string and determines if it matches any of the four list
    iterator patterns (any_, every_, random_, ordered_).

    Algorithm:
    1. Iterate through each known prefix (any_, every_, random_, ordered_)
    2. Check if identifier starts with that prefix
    3. If match found, extract base name (part after prefix)
    4. Validate base name is non-empty
    5. Construct and return ListIteratorInfo with all metadata
    6. If no match, return None

    Args:
        identifier: The identifier string to parse
                   Examples: 'any_vassal', 'every_courtier', 'random_child'
                   Can also be non-iterator like 'trigger' or 'add_gold'

    Returns:
        ListIteratorInfo object with parsed components if valid iterator
        None if identifier doesn't match any iterator pattern

    Examples:
        >>> # Valid list iterators
        >>> parse_list_iterator('any_vassal')
        ListIteratorInfo(prefix='any_', base_name='vassal', 
                        iterator_type='trigger', 
                        supported_params=['count', 'percent', 'limit'])

        >>> parse_list_iterator('every_courtier')
        ListIteratorInfo(prefix='every_', base_name='courtier',
                        iterator_type='effect',
                        supported_params=['limit', 'max', 'alternative_limit'])
        
        >>> # Not a list iterator
        >>> parse_list_iterator('trigger')
        None
        
        >>> # Empty base name is invalid
        >>> parse_list_iterator('any_')
        None

    Performance:
        O(4) = O(1) - checks exactly 4 prefixes
        Very fast, typically <1 microsecond

    Diagnostic Codes:
        LIST-001: Emitted by callers when this returns None
    """
    # Iterate through all known list iterator prefixes
    # There are only 4, so this is effectively O(1)
    for prefix, config in LIST_PREFIXES.items():
        # Check if identifier starts with this prefix
        if identifier.startswith(prefix):
            # Extract the base name by removing the prefix
            # Example: 'any_vassal' -> 'vassal'
            base_name = identifier[len(prefix):]
            
            # Validate that there's actually a base name after the prefix
            # Empty base (like 'any_') is invalid
            if base_name:
                # Construct and return the info object with all metadata
                return ListIteratorInfo(
                    prefix=prefix,
                    base_name=base_name,
                    iterator_type=config["type"],  # 'trigger' or 'effect'
                    supported_params=config["supported_params"],  # Valid params
                )
    
    # No prefix matched - not a list iterator
    return None


def is_list_iterator(identifier: str) -> bool:
    """
    Quick check if an identifier is a list iterator pattern.

    Convenience function that wraps parse_list_iterator() for boolean checks.
    Use this when you only need to know if something is a list iterator,
    not the detailed information.

    Args:
        identifier: The identifier string to check
                   Examples: 'any_vassal', 'trigger', 'add_gold'

    Returns:
        True if identifier is a valid list iterator pattern
        False if identifier is not a list iterator

    Examples:
        >>> is_list_iterator('any_vassal')
        True
        
        >>> is_list_iterator('every_courtier')
        True
        
        >>> is_list_iterator('trigger')
        False
        
        >>> is_list_iterator('add_gold')
        False

    Performance:
        Same as parse_list_iterator: O(1), <1 microsecond
    """
    # Delegate to parse_list_iterator and check for None
    # Returns True if parse succeeded (returned info object)
    # Returns False if parse failed (returned None)
    return parse_list_iterator(identifier) is not None


def get_supported_parameters(iterator_info: ListIteratorInfo) -> List[str]:
    """
    Extract the list of supported parameters from iterator info.

    Simple accessor function that returns the supported_params field.
    Provided for API completeness and potential future expansion.

    Args:
        iterator_info: Parsed list iterator information object

    Returns:
        List of valid parameter names for this iterator type
        Examples: ['count', 'percent', 'limit'] for any_
                 ['limit', 'max', 'alternative_limit'] for every_

    Examples:
        >>> info = parse_list_iterator('any_vassal')
        >>> get_supported_parameters(info)
        ['count', 'percent', 'limit']
        
        >>> info = parse_list_iterator('random_courtier')
        >>> get_supported_parameters(info)
        ['limit', 'weight', 'save_temporary_scope_as']

    Performance:
        O(1) - direct field access
    """
    # Simply return the supported_params field from the info object
    return iterator_info.supported_params


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def validate_list_block_content(
    iterator_info: ListIteratorInfo, block_content: str, inside_limit: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Validate that block content matches iterator type semantics.

    This enforces CK3's critical semantic rule: triggers and effects must be
    used in the correct contexts. Mixing them causes runtime errors or
    unexpected behavior.

    VALIDATION RULES:
    1. any_ (trigger iterator): Can ONLY contain triggers
       - Effects like add_gold are invalid
       - Runtime error if violated
    
    2. every_/random_/ordered_ (effect iterators): Primarily contain effects
       - Triggers are ONLY allowed inside limit = { } blocks
       - Triggers outside limit cause semantic errors

    CURRENT IMPLEMENTATION:
    This is a simplified validator that checks structure without deep
    semantic analysis. Full implementation would query effect/trigger
    databases to determine identifier types.

    Args:
        iterator_info: Parsed iterator information with type metadata
        block_content: Identifier found within the iterator block
                      Examples: 'has_trait', 'add_gold', 'is_adult'
        inside_limit: Whether we're currently inside a limit = { } block
                     Important for effect iterators where triggers are only
                     allowed inside limit blocks

    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
        - If valid: (True, None)
        - If invalid: (False, "descriptive error message")

    Examples:
        >>> # Valid: trigger in trigger iterator
        >>> info = parse_list_iterator('any_vassal')
        >>> validate_list_block_content(info, 'has_trait', False)
        (True, None)

        >>> # Invalid: effect in trigger iterator
        >>> info = parse_list_iterator('any_vassal')
        >>> validate_list_block_content(info, 'add_gold', False)
        (False, "Effects not allowed in 'any_' blocks")  # (would be in full impl)
        
        >>> # Valid: effect in effect iterator
        >>> info = parse_list_iterator('every_vassal')
        >>> validate_list_block_content(info, 'add_gold', False)
        (True, None)

    Diagnostic Codes:
        LIST-003: Trigger used in effect iterator outside limit
        LIST-004: Effect used in trigger iterator (any_)

    TODO:
        Implement full semantic validation by checking against:
        - ck3_language.CK3_EFFECTS for effect identifiers
        - ck3_language.CK3_TRIGGERS for trigger identifiers
    """
    # Check iterator type to determine validation rules
    if iterator_info.iterator_type == "trigger":
        # any_ blocks are triggers - should only contain trigger conditions
        # In full implementation, would verify block_content is not an effect
        # For now, accept all content (simplified validation)
        return (True, None)

    elif iterator_info.iterator_type == "effect":
        # every_/random_/ordered_ blocks are effects
        # Can contain effects directly
        # Triggers only allowed inside limit = { } blocks
        # For now, accept all content (simplified validation)
        return (True, None)

    # Unknown iterator type - should never happen with valid ListIteratorInfo
    # But defensive programming requires handling it
    return (False, f"Unknown iterator type: {iterator_info.iterator_type}")


def is_valid_list_parameter(iterator_info: ListIteratorInfo, param_name: str) -> bool:
    """
    Check if a parameter is valid for a specific list iterator.

    Each iterator type supports different parameters. Using invalid parameters
    causes script parsing errors in CK3. This validation prevents those errors.

    Parameter Support by Iterator:
    - any_: count, percent, limit
    - every_: limit, max, alternative_limit  
    - random_: limit, weight, save_temporary_scope_as
    - ordered_: limit, order_by, position, max, min, check_range_bounds, 
                save_temporary_scope_as

    Args:
        iterator_info: Parsed iterator information with supported params
        param_name: Parameter name to validate
                   Examples: 'count', 'limit', 'weight', 'order_by'

    Returns:
        True if parameter is valid for this iterator type
        False if parameter is not supported by this iterator

    Examples:
        >>> # Valid parameters for any_
        >>> info = parse_list_iterator('any_vassal')
        >>> is_valid_list_parameter(info, 'count')
        True
        >>> is_valid_list_parameter(info, 'percent')
        True
        
        >>> # Invalid parameter for any_ (belongs to ordered_)
        >>> is_valid_list_parameter(info, 'order_by')
        False
        
        >>> # Valid parameter for ordered_
        >>> info = parse_list_iterator('ordered_vassal')
        >>> is_valid_list_parameter(info, 'order_by')
        True

    Performance:
        O(n) where n = number of supported params (typically 3-7)
        List membership check is fast for small lists

    Diagnostic Codes:
        LIST-002: Emitted by callers when this returns False
    """
    # Check if param_name is in the supported_params list
    # This is O(n) but n is small (3-7 params typically)
    return param_name in iterator_info.supported_params


# =============================================================================
# COMMON LIST BASE NAMES
# =============================================================================

# Comprehensive set of common list base names used across CK3
# These are collection names that can be prefixed with any_, every_, random_, ordered_
# 
# SCOPE DEPENDENCY:
# Not all bases are valid in all scopes. This set represents common bases that
# appear frequently, but actual validation must check scope-specific lists.
# Example: 'vassal' is valid in character scope but not province scope
#
# DATA SOURCE:
# Derived from CK3 game files and documentation. Kept in code for performance
# rather than YAML file since it's frequently accessed.
#
# ORGANIZATION:
# Grouped by semantic category for readability:
# - Character lists: Collections of characters (vassal, courtier, etc.)
# - Title lists: Collections of titles/holdings
# - Province lists: Collections of provinces
# - Dynasty/House lists: Family and dynasty members
# - Faith/Culture lists: Religious and cultural groups
# - Artifact lists: Character possessions
# - Variable lists: Dynamic script-created lists
COMMON_LIST_BASES = {
    # =============================================================================
    # CHARACTER LISTS - Collections of character objects
    # =============================================================================
    "vassal",  # Characters who are vassals of current character
    "courtier",  # Characters in the court (not landed)
    "prisoner",  # Characters imprisoned by current character
    "child",  # Direct children of current character
    "sibling",  # Brothers and sisters
    "spouse",  # Married partners
    "ally",  # Allied characters through pacts
    "enemy",  # Characters at war with current character
    "claim",  # Characters with claims (context-dependent)
    "heir",  # Potential heirs
    "heir_to_title",  # Heirs to specific titles
    "heir_title",  # Titles this character is heir to
    "held_title",  # Titles currently held by character
    "neighboring_county",  # Counties adjacent to realm
    "neighboring_duke",  # Duke-tier neighbors
    "neighboring_king",  # King-tier neighbors
    "realm_county",  # All counties in realm
    "realm_province",  # All provinces in realm
    "realm_de_jure_duchy",  # De jure duchies in realm
    "realm_de_jure_kingdom",  # De jure kingdoms in realm
    "character_to_title_neighboring_county",  # Counties bordering character's titles
    "character_to_title_neighboring_duke",  # Duke-tier titles bordering realm
    "character_to_title_neighboring_king",  # King-tier titles bordering realm
    "character_to_title_neighboring_emperor",  # Emperor-tier titles bordering realm
    
    # =============================================================================
    # TITLE LISTS - Collections of title/holding objects
    # =============================================================================
    "de_jure_county",  # De jure county-tier titles within this title
    "de_jure_duchy",  # De jure duchy-tier titles within this title
    "de_jure_kingdom",  # De jure kingdom-tier titles within this title
    "de_jure_empire",  # De jure empire-tier titles within this title
    "county",  # County-tier titles
    "duchy",  # Duchy-tier titles
    "kingdom",  # Kingdom-tier titles
    "empire",  # Empire-tier titles
    
    # =============================================================================
    # PROVINCE LISTS - Collections of province/barony objects
    # =============================================================================
    "county_province",  # Provinces within a county
    "neighboring_province",  # Adjacent provinces
    
    # =============================================================================
    # DYNASTY AND HOUSE LISTS - Family organization
    # =============================================================================
    "dynasty_member",  # All members of a dynasty
    "house_member",  # All members of a cadet house
    
    # =============================================================================
    # FAITH AND CULTURE LISTS - Religious and cultural groups
    # =============================================================================
    "faith_holy_order",  # Holy orders of a faith
    "faith_character",  # Characters of a faith
    
    # =============================================================================
    # ARTIFACT LISTS - Character possessions and treasures
    # =============================================================================
    "equipped_character_artifact",  # Artifacts currently equipped
    "inventory_artifact",  # Artifacts in inventory (not equipped)
    "artifact",  # All artifacts (generic)
    "character_artifact",  # All artifacts owned by character
    "court_artifact",  # Artifacts in the court
    
    # =============================================================================
    # VARIABLE LISTS - Script-created dynamic lists
    # =============================================================================
    "in_list",  # Iterate over a variable list created by add_to_variable_list
}

# TODO: These entries below are reserved for future feature implementation
# They are commented out to prevent syntax errors until the feature is ready
#     "de_jure_duchy",
#     "de_jure_kingdom",
#     "de_jure_empire",
#     "county",
#     "duchy",
#     "kingdom",
#     "empire",
#     # Province lists
#     "county_province",
#     "neighboring_province",
#     # Dynasty/House lists
#     "dynasty_member",
#     "house_member",
#     # Faith/Culture lists
#     "faith_holy_order",
#     "faith_character",
#     # Artifact lists
#     "equipped_character_artifact",
#     "inventory_artifact",
#     "artifact",
#     "character_artifact",
#     "court_artifact",
#     # Variable lists
#     "in_list",  # For variable lists
# }


# =============================================================================
# HELPER FUNCTIONS FOR LIST BASES
# =============================================================================

def is_valid_list_base(base_name: str) -> bool:
    """
    Check if a base name is a valid common list iterator base.

    This performs a quick O(1) lookup against the COMMON_LIST_BASES set.
    It checks if the base name is one of the frequently-used list bases
    across all scope types.

    IMPORTANT LIMITATION:
    This only checks COMMON bases. For complete validation, must also check
    scope-specific bases using scopes.get_scope_lists(scope_type).
    
    Some bases are scope-specific and won't be in COMMON_LIST_BASES:
    - 'councillor' is character-specific
    - 'barony' is title-specific
    - etc.

    Args:
        base_name: The base name to validate
                  Examples: 'vassal', 'courtier', 'held_title'
                  Should be the part AFTER the prefix

    Returns:
        True if base_name is in the common list bases set
        False if base_name is not a common base (may still be valid in specific scope)

    Examples:
        >>> is_valid_list_base('vassal')
        True  # Common base used in character scope
        
        >>> is_valid_list_base('courtier')
        True  # Common base used in character scope
        
        >>> is_valid_list_base('held_title')
        True  # Common base for title iteration
        
        >>> is_valid_list_base('invalid_base')
        False  # Not a known base

    Performance:
        O(1) - set membership test is constant time

    Note:
        For complete validation, combine with scope-specific validation:
        ```python
        is_common = is_valid_list_base(base)
        is_scope_specific = base in get_scope_lists(scope_type)
        is_valid = is_common or is_scope_specific
        ```

    Diagnostic Codes:
        LIST-005: Emitted by callers when base is invalid for scope
    """
    # O(1) set membership check
    # Fast lookup in hash set of ~50 common bases
    return base_name in COMMON_LIST_BASES


def get_list_result_scope(base_name: str, current_scope: str = "character") -> Optional[str]:
    """
    Determine the resulting scope type after iterating a list.

    When you iterate a list (any_vassal, every_courtier, etc.), the code
    inside the iterator executes in a different scope - the scope of the
    iterated elements. This function determines that resulting scope.

    SCOPE TRANSFORMATION EXAMPLES:
    - any_vassal: character → character (iterates over characters)
    - every_held_title: character → title (iterates over titles)
    - random_county_province: title → province (iterates over provinces)
    - any_in_list: Preserves current scope (variable lists)

    HARDCODED MAPPING:
    This uses hardcoded mappings for common cases. In an ideal data-driven
    design, this would come from YAML scope definitions. However, for
    performance and simplicity, common mappings are hardcoded.

    Args:
        base_name: The list base being iterated
                  Examples: 'vassal', 'held_title', 'county_province'
        current_scope: The scope type before iteration
                      Usually 'character' for most common cases
                      Defaults to 'character' if not specified

    Returns:
        The resulting scope type string after iteration
        Examples: 'character', 'title', 'province', 'artifact'
        Returns current_scope if mapping is unknown (safe default)
        Returns None only in exceptional error cases

    Examples:
        >>> # Character lists iterate over characters
        >>> get_list_result_scope('vassal', 'character')
        'character'
        
        >>> get_list_result_scope('courtier', 'character')
        'character'
        
        >>> # Title lists iterate over titles
        >>> get_list_result_scope('held_title', 'character')
        'title'
        
        >>> get_list_result_scope('de_jure_county', 'title')
        'title'
        
        >>> # Province lists iterate over provinces
        >>> get_list_result_scope('county_province', 'title')
        'province'
        
        >>> # Variable lists preserve scope
        >>> get_list_result_scope('in_list', 'character')
        'character'

    Performance:
        O(1) - set membership tests are constant time
        Multiple set checks, but sets are small (10-30 items each)

    See Also:
        scopes.get_resulting_scope() - For scope link transformations
    """
    # =============================================================================
    # CHARACTER SCOPE RESULTS - Lists that iterate over characters
    # =============================================================================
    # These lists produce character-scoped iterations
    # Any element accessed will be a character object
    character_lists = {
        "vassal",  # Your vassals (characters)
        "courtier",  # Court members (characters)
        "prisoner",  # Imprisoned characters
        "child",  # Children (characters)
        "sibling",  # Siblings (characters)
        "spouse",  # Spouses (characters)
        "ally",  # Allied characters
        "enemy",  # Enemy characters
        "heir",  # Potential heirs (characters)
        "dynasty_member",  # Dynasty members (characters)
        "house_member",  # House members (characters)
    }

    # =============================================================================
    # ARTIFACT SCOPE RESULTS - Lists that iterate over artifacts
    # =============================================================================
    # These lists produce artifact-scoped iterations
    # Any element accessed will be an artifact object
    artifact_lists = {
        "equipped_character_artifact",  # Equipped items
        "inventory_artifact",  # Inventory items
        "artifact",  # All artifacts (generic)
        "character_artifact",  # Character's artifacts
        "court_artifact",  # Court artifacts
    }

    # =============================================================================
    # TITLE SCOPE RESULTS - Lists that iterate over titles/holdings
    # =============================================================================
    # These lists produce title-scoped iterations
    # Any element accessed will be a title object
    title_lists = {
        "held_title",  # Titles currently held
        "claim",  # Claims on titles
        "heir_title",  # Titles character is heir to
        "heir_to_title",  # Heir relationships to titles
        "de_jure_county",  # De jure county titles
        "de_jure_duchy",  # De jure duchy titles
        "de_jure_kingdom",  # De jure kingdom titles
        "de_jure_empire",  # De jure empire titles
        "county",  # County-tier titles
        "duchy",  # Duchy-tier titles
        "kingdom",  # Kingdom-tier titles
        "empire",  # Empire-tier titles
        "neighboring_county",  # Adjacent counties
        "neighboring_duchy",  # Adjacent duchies
        "neighboring_kingdom",  # Adjacent kingdoms
        "character_to_title_neighboring_county",  # County neighbors
        "character_to_title_neighboring_duke",  # Duke-tier neighbors
        "character_to_title_neighboring_king",  # King-tier neighbors
        "character_to_title_neighboring_emperor",  # Emperor-tier neighbors
    }

    # =============================================================================
    # PROVINCE SCOPE RESULTS - Lists that iterate over provinces/baronies
    # =============================================================================
    # These lists produce province-scoped iterations
    # Any element accessed will be a province object
    province_lists = {
        "realm_province",  # All provinces in realm
        "county_province",  # Provinces in a county
        "neighboring_province",  # Adjacent provinces
    }

    # =============================================================================
    # SCOPE DETERMINATION LOGIC
    # =============================================================================
    # Check which category the base_name falls into
    # Return the appropriate resulting scope type
    
    if base_name in character_lists:
        # Lists that iterate over characters
        return "character"
    elif base_name in title_lists:
        # Lists that iterate over titles
        return "title"
    elif base_name in province_lists:
        # Lists that iterate over provinces
        return "province"
    elif base_name in artifact_lists:
        # Lists that iterate over artifacts
        return "artifact"
    elif base_name == "in_list":
        # Variable lists preserve the original scope of saved items
        # The scope depends on what was added to the list
        return current_scope

    # =============================================================================
    # DEFAULT FALLBACK
    # =============================================================================
    # If base_name doesn't match any known category, assume scope is preserved
    # This is a safe default that prevents errors while allowing unknown bases
    # In practice, unknown bases should be validated elsewhere
    return current_scope
