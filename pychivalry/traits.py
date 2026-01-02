"""
Trait System for CK3 Scripts

DIAGNOSTIC CODES:
    TRAIT-001: Unknown trait reference
    TRAIT-002: Opposite traits both present
    TRAIT-003: Invalid trait category

MODULE OVERVIEW:
    Provides trait validation and query functions for CK3 scripts. All trait
    definitions are loaded from YAML files in data/traits/. The module supports
    297 CK3 traits across 7 categories extracted from game files.

TRAIT CATEGORIES:
    - Personality (36): brave, ambitious, cruel, kind, etc.
    - Education (33): education_diplomacy_1-4, education_martial_1-4, etc.
    - Lifestyle (32): lifestyle_blademaster, lifestyle_poet, etc.
    - Health (36): ill, wounded, stressed_1-3, etc.
    - Fame (84): fame_1-9, devotion_1-4, splendor_1-4, etc.
    - Childhood (5): bossy, pensive, rowdy, etc.
    - Special (71): incapable, immortal, pregnant, house_head, etc.

USAGE EXAMPLES:
    >>> # Check if trait exists
    >>> is_valid_trait('brave')
    True
    >>> is_valid_trait('nonexistent')
    False
    
    >>> # Get trait information
    >>> trait_info = get_trait_info('brave')
    >>> trait_info['opposites']
    ['craven']
    >>> trait_info['category']
    'personality'
    
    >>> # Check for opposite conflicts
    >>> are_opposite_traits('brave', 'craven')
    True
    
    >>> # Get suggestions for typos
    >>> suggest_similar_traits('brav')
    ['brave', 'arrogant', 'craven']
    
    >>> # Get traits by category
    >>> personality_traits = get_traits_by_category('personality')
    >>> 'brave' in personality_traits
    True

PERFORMANCE:
    - Trait data loaded once and cached
    - Validation: O(1) set membership test (<1μs)
    - Memory: ~100KB for 297 traits
    - Thread-safe for read operations

SEE ALSO:
    - data/traits/*.yaml: Trait definitions
    - tools/extract_traits.py: Extraction script
    - diagnostics.py: Uses traits for CK3451 validation
"""

from typing import Dict, List, Optional, Tuple, Set
from pathlib import Path
from pychivalry.data import get_traits, DATA_DIR
import logging

logger = logging.getLogger(__name__)

# Cache for fast lookups
_trait_set_cache: Optional[Set[str]] = None
_trait_data_available_cache: Optional[bool] = None


# =============================================================================
# DATA AVAILABILITY CHECK
# =============================================================================

def is_trait_data_available() -> bool:
    """
    Check if trait data files are available.
    
    Trait data files must be extracted by users from their own CK3 installation
    due to copyright restrictions. This function checks if the extraction has
    been performed.
    
    Returns:
        True if trait YAML files exist, False otherwise
        
    Note:
        Result is cached after first call for performance. If trait files
        are added/removed, the language server must be restarted.
        
    Examples:
        >>> is_trait_data_available()
        True  # If user has extracted trait data
        
        >>> is_trait_data_available()
        False  # If trait data not yet extracted
        
    See Also:
        - VS Code Command: "PyChivalry: Extract Trait Data from CK3 Installation"
        - tools/extract_traits.py: Extraction script
    """
    global _trait_data_available_cache
    
    if _trait_data_available_cache is not None:
        return _trait_data_available_cache
    
    traits_dir = DATA_DIR / "traits"
    
    if not traits_dir.exists():
        logger.info("Trait data directory does not exist - trait validation disabled")
        _trait_data_available_cache = False
        return False
    
    # Check if at least one YAML file exists
    yaml_files = list(traits_dir.glob("*.yaml"))
    _trait_data_available_cache = len(yaml_files) > 0
    
    if _trait_data_available_cache:
        logger.info(f"Trait data available: {len(yaml_files)} YAML files found")
    else:
        logger.info("No trait YAML files found - trait validation disabled")
    
    return _trait_data_available_cache


# =============================================================================
# CORE TRAIT QUERY FUNCTIONS
# =============================================================================

def get_all_trait_names() -> Set[str]:
    """
    Get set of all valid trait names for fast membership testing.
    
    This function returns a cached set of trait names for O(1) lookup
    performance. The set is populated on first call and reused thereafter.
    
    Returns:
        Set of all valid trait identifiers, or empty set if trait data
        is not available (user hasn't extracted it yet)
        
    Examples:
        >>> traits = get_all_trait_names()
        >>> 'brave' in traits
        True
        >>> len(traits) >= 297  # At least 297 CK3 traits
        True
        
    Performance:
        - First call: ~50ms (loads and caches YAML)
        - Subsequent calls: <1μs (returns cached set)
        
    Note:
        If trait data is not available, returns empty set. All validation
        functions will gracefully skip trait checks in this case.
    """
    global _trait_set_cache
    
    # Check if data is available
    if not is_trait_data_available():
        logger.debug("Trait data not available - returning empty trait set")
        return set()  # Return empty set, validation will be skipped
    
    if _trait_set_cache is None:
        traits = get_traits()
        _trait_set_cache = set(traits.keys())
        logger.info(f"Loaded {len(_trait_set_cache)} traits into cache")
    return _trait_set_cache


def is_valid_trait(trait_name: str) -> bool:
    """
    Check if a trait name is valid.
    
    Fast O(1) validation using cached trait set. This is the primary
    function for trait validation in diagnostics.
    
    Args:
        trait_name: The trait identifier to validate
                   Examples: 'brave', 'genius', 'education_diplomacy_4'
        
    Returns:
        True if trait exists in CK3, False otherwise
        
    Examples:
        >>> is_valid_trait('brave')
        True
        >>> is_valid_trait('genius')
        True
        >>> is_valid_trait('nonexistent')
        False
        >>> is_valid_trait('BRAVE')  # Case-sensitive
        False
        
    Performance:
        O(1) set membership test, <1 microsecond
        
    Diagnostic Codes:
        Used by check_trait_references() to emit TRAIT-001/CK3451
    """
    trait_names = get_all_trait_names()
    return trait_name in trait_names


def get_trait_info(trait_name: str) -> Optional[Dict]:
    """
    Get full information about a trait.
    
    Returns the complete trait data dictionary including category,
    opposites, group, level, and description.
    
    Args:
        trait_name: The trait to query
        
    Returns:
        Trait data dictionary with keys:
        - category: Trait category (personality, education, etc.)
        - opposites: List of conflicting traits
        - group: Trait group (for education/lifestyle)
        - level: Trait level (for tiered traits)
        - description: Human-readable description
        
        Returns None if trait not found or trait data not available
        
    Examples:
        >>> info = get_trait_info('brave')
        >>> info['category']
        'personality'
        >>> info['opposites']
        ['craven']
        >>> info['description']
        'Brave'
        
        >>> get_trait_info('nonexistent')
        None
        
    Performance:
        O(1) dictionary lookup after first load
    """
    if not is_trait_data_available():
        return None
    
    traits = get_traits()
    return traits.get(trait_name)


def get_trait_category(trait_name: str) -> Optional[str]:
    """
    Get the category of a trait.
    
    Categories include: personality, education, lifestyle, health,
    fame, childhood, special
    
    Args:
        trait_name: The trait to query
        
    Returns:
        Category name, or None if trait not found
        
    Examples:
        >>> get_trait_category('brave')
        'personality'
        >>> get_trait_category('education_diplomacy_4')
        'education'
        >>> get_trait_category('lifestyle_blademaster')
        'lifestyle'
    """
    info = get_trait_info(trait_name)
    return info.get('category') if info else None


def get_trait_opposites(trait_name: str) -> List[str]:
    """
    Get list of opposite traits that conflict with this one.
    
    Opposite traits are mutually exclusive - a character cannot have
    both traits simultaneously. For example, brave and craven are opposites.
    
    Args:
        trait_name: The trait to query
        
    Returns:
        List of opposite trait names (may be empty)
        Returns empty list if trait not found
        
    Examples:
        >>> get_trait_opposites('brave')
        ['craven']
        >>> get_trait_opposites('ambitious')
        ['content']
        >>> get_trait_opposites('callous')
        ['compassionate', 'sadistic']
        >>> get_trait_opposites('genius')
        []  # Some traits have no opposites
    """
    info = get_trait_info(trait_name)
    return info.get('opposites', []) if info else []


def are_opposite_traits(trait1: str, trait2: str) -> bool:
    """
    Check if two traits are opposites (mutually exclusive).
    
    This function checks the opposites relationship in both directions
    since opposite relationships should be bidirectional.
    
    Args:
        trait1: First trait name
        trait2: Second trait name
        
    Returns:
        True if traits are opposites, False otherwise
        
    Examples:
        >>> are_opposite_traits('brave', 'craven')
        True
        >>> are_opposite_traits('craven', 'brave')
        True
        >>> are_opposite_traits('brave', 'ambitious')
        False
        
    Diagnostic Codes:
        Can be used for TRAIT-002 (opposite traits both present)
    """
    opposites1 = get_trait_opposites(trait1)
    opposites2 = get_trait_opposites(trait2)
    
    return trait2 in opposites1 or trait1 in opposites2


def get_trait_group(trait_name: str) -> Optional[str]:
    """
    Get the trait group (for education and lifestyle traits).
    
    Args:
        trait_name: The trait to query
        
    Returns:
        Group name, or None if trait has no group
        
    Examples:
        >>> get_trait_group('education_diplomacy_1')
        'education_diplomacy'
        >>> get_trait_group('lifestyle_blademaster')
        'lifestyle_blademaster'
    """
    info = get_trait_info(trait_name)
    return info.get('group') if info else None


def get_trait_level(trait_name: str) -> Optional[int]:
    """
    Get the level of a tiered trait (education, fame, stress, etc.).
    
    Args:
        trait_name: The trait to query
        
    Returns:
        Trait level (1-4 for education, 1-9 for fame), or None
        
    Examples:
        >>> get_trait_level('education_diplomacy_4')
        4
        >>> get_trait_level('fame_5')
        5
        >>> get_trait_level('brave')
        None  # Not a leveled trait
    """
    info = get_trait_info(trait_name)
    return info.get('level') if info else None


# =============================================================================
# TRAIT FILTERING AND QUERYING
# =============================================================================

def get_traits_by_category(category: str) -> List[str]:
    """
    Get all traits in a specific category.
    
    Categories: personality, education, lifestyle, health, fame, 
                childhood, special
    
    Args:
        category: Category name to filter by
        
    Returns:
        List of trait names in that category
        
    Examples:
        >>> personality = get_traits_by_category('personality')
        >>> 'brave' in personality
        True
        >>> 'ambitious' in personality
        True
        >>> len(personality)
        36
        
        >>> education = get_traits_by_category('education')
        >>> any('education_' in t for t in education)
        True
    """
    traits = get_traits()
    return [
        name for name, data in traits.items()
        if data.get('category') == category
    ]


def get_personality_traits() -> List[str]:
    """Get all personality traits (brave, ambitious, etc.)."""
    return get_traits_by_category('personality')


def get_education_traits() -> List[str]:
    """Get all education traits (education_diplomacy_1, etc.)."""
    return get_traits_by_category('education')


def get_lifestyle_traits() -> List[str]:
    """Get all lifestyle traits (lifestyle_blademaster, etc.)."""
    return get_traits_by_category('lifestyle')


def get_health_traits() -> List[str]:
    """Get all health traits (ill, wounded, stressed_1, etc.)."""
    return get_traits_by_category('health')


# =============================================================================
# TRAIT SUGGESTIONS AND SIMILARITY
# =============================================================================

def suggest_similar_traits(invalid_trait: str, max_suggestions: int = 3) -> List[str]:
    """
    Suggest similar valid traits for an invalid trait name.
    
    Uses Levenshtein distance algorithm to find close matches based on
    character edit distance. Useful for quick fixes and helpful error messages.
    
    Args:
        invalid_trait: The invalid/misspelled trait name
        max_suggestions: Maximum number of suggestions to return (default: 3)
        
    Returns:
        List of suggested trait names, sorted by similarity (most similar first)
        
    Examples:
        >>> suggest_similar_traits('brav')
        ['brave', 'arrogant', 'craven']
        
        >>> suggest_similar_traits('ambitous')  # Missing 'i'
        ['ambitious', 'callous', 'zealous']
        
        >>> suggest_similar_traits('genuis')  # Wrong order
        ['genius', 'zealous', 'generous']
        
    Algorithm:
        Computes Levenshtein (edit) distance for all valid traits,
        then returns top N matches with smallest distance.
        
    Performance:
        O(n * m) where n = number of traits, m = string length
        Typically ~50ms for 297 traits
        
    Diagnostic Codes:
        Used by check_trait_references() for CK3451 quick fixes
    """
    from pychivalry.code_actions import calculate_levenshtein_distance
    
    trait_names = get_all_trait_names()
    
    # Calculate distances for all traits
    distances = [
        (trait, calculate_levenshtein_distance(invalid_trait.lower(), trait.lower()))
        for trait in trait_names
    ]
    
    # Sort by distance (closest matches first)
    distances.sort(key=lambda x: x[1])
    
    # Return top N suggestions
    return [trait for trait, _ in distances[:max_suggestions]]


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

def clear_cache():
    """
    Clear trait cache (for testing and hot reload).
    
    Resets the cached trait set and forces reload on next access.
    Useful for:
    - Unit testing (reset state between tests)
    - Development (reload after modifying YAML files)
    - Hot reload (refresh without restarting server)
    
    Examples:
        >>> # Initial load
        >>> traits = get_all_trait_names()
        
        >>> # Modify YAML file externally
        >>> # ...
        
        >>> # Clear and reload
        >>> clear_cache()
        >>> fresh_traits = get_all_trait_names()  # Reloads from disk
    """
    global _trait_set_cache
    _trait_set_cache = None
    logger.debug("Trait cache cleared")


# =============================================================================
# STATISTICS AND INTROSPECTION
# =============================================================================

def get_trait_statistics() -> Dict[str, int]:
    """
    Get statistics about loaded traits.
    
    Returns:
        Dictionary with trait counts by category
        
    Examples:
        >>> stats = get_trait_statistics()
        >>> stats['total']
        297
        >>> stats['personality']
        36
        >>> stats['education']
        33
    """
    traits = get_traits()
    stats = {'total': len(traits)}
    
    # Count by category
    for trait_name, trait_data in traits.items():
        category = trait_data.get('category', 'unknown')
        stats[category] = stats.get(category, 0) + 1
    
    return stats


def get_traits_with_opposites() -> List[Tuple[str, List[str]]]:
    """
    Get all traits that have opposite traits defined.
    
    Returns:
        List of tuples (trait_name, list_of_opposites)
        
    Examples:
        >>> opposites = get_traits_with_opposites()
        >>> ('brave', ['craven']) in opposites
        True
    """
    traits = get_traits()
    return [
        (name, data.get('opposites', []))
        for name, data in traits.items()
        if data.get('opposites')
    ]
