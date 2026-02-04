"""
CK3 Game Concepts System - Localization Concept Validation

DIAGNOSTIC CODES:
    CONCEPT-001: Unknown concept reference
    CONCEPT-002: Invalid concept link syntax
    CONCEPT-003: Missing concept context marker

MODULE OVERVIEW:
    Provides validation and query functions for CK3 game concepts used in
    localization. Game concepts are special localization keys that provide
    in-game tooltips and contextual information.

    Concepts are referenced in localization files using the pattern:
    [concept_name|E] or [concept_name|context]

    Example: [vassal|E] links to the 'game_concept_vassal' localization key

CONCEPT LINK SYNTAX:
    [concept|E]              -> Standard concept with tooltip (E = enabled)
    [concept|U]              -> Uppercase concept
    [concept|L]              -> Lowercase concept
    [GetFaith.Custom|E]      -> Dynamic concept from scope

USAGE EXAMPLES:
    >>> # Check if concept exists
    >>> is_valid_concept('vassal')
    True
    >>> is_valid_concept('nonexistent_concept')
    False

    >>> # Get concept information
    >>> concept_info = get_concept_info('vassal')
    >>> concept_info['text']
    'A character who has sworn fealty to a liege...'

    >>> # Get suggestions for typos
    >>> suggest_similar_concepts('vasal')  # typo
    ['vassal', 'vassalage', 'vassal_contract']

    >>> # Get all concept names
    >>> all_concepts = get_all_concept_names()
    >>> 'opinion' in all_concepts
    True

PERFORMANCE:
    - Concept data loaded once and cached
    - Validation: O(1) set membership test (<1μs)
    - Memory: ~50KB for 200-300 concepts
    - Thread-safe for read operations

SEE ALSO:
    - data/concepts/concepts.yaml: Concept definitions (user must extract)
    - tools/extract_concepts.py: Extraction script
    - localization.py: Uses concepts for LOC-006 validation
    - completions.py: Provides concept completions
"""

from typing import Dict, List, Optional, Set, Tuple
from pathlib import Path
from pychivalry.core.data import DATA_DIR
import logging

logger = logging.getLogger(__name__)

# Cache for fast lookups
_concept_set_cache: Optional[Set[str]] = None
_concept_data_cache: Optional[Dict[str, Dict[str, str]]] = None
_concept_data_available_cache: Optional[bool] = None


# =============================================================================
# DATA AVAILABILITY CHECK
# =============================================================================

def is_concept_data_available() -> bool:
    """
    Check if concept data files are available.

    Concept data files must be extracted by users from their own CK3 installation
    due to copyright restrictions. This function checks if the extraction has
    been performed.

    Returns:
        True if concept YAML files exist, False otherwise

    Note:
        Result is cached after first call for performance. If concept files
        are added/removed, the language server must be restarted.

    Examples:
        >>> is_concept_data_available()
        True  # If user has extracted concept data

        >>> is_concept_data_available()
        False  # If concept data not yet extracted

    See Also:
        - VS Code Command: "CK3: Extract Localization Data from CK3 Installation"
        - tools/extract_concepts.py: Extraction script
    """
    global _concept_data_available_cache

    if _concept_data_available_cache is not None:
        return _concept_data_available_cache

    concepts_dir = DATA_DIR / "concepts"

    if not concepts_dir.exists():
        logger.info("Concept data directory does not exist - concept validation disabled")
        _concept_data_available_cache = False
        return False

    # Check if concepts.yaml exists
    concepts_file = concepts_dir / "concepts.yaml"
    if not concepts_file.exists():
        logger.info("concepts.yaml not found - concept validation disabled")
        _concept_data_available_cache = False
        return False

    logger.info(f"Concept data available at {concepts_file}")
    _concept_data_available_cache = True
    return True


# =============================================================================
# DATA LOADING
# =============================================================================

def _load_concept_data() -> Dict[str, Dict[str, str]]:
    """
    Load concept data from YAML files.

    Returns:
        Dictionary mapping concept names to their data

    Note:
        This is an internal function. Use get_concept_info() instead.
    """
    global _concept_data_cache

    if _concept_data_cache is not None:
        return _concept_data_cache

    if not is_concept_data_available():
        _concept_data_cache = {}
        return _concept_data_cache

    try:
        import yaml
        concepts_file = DATA_DIR / "concepts" / "concepts.yaml"

        with open(concepts_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        if not isinstance(data, dict):
            logger.warning(f"concepts.yaml has invalid format - expected dict, got {type(data)}")
            _concept_data_cache = {}
            return _concept_data_cache

        logger.info(f"Loaded {len(data)} game concepts from {concepts_file}")
        _concept_data_cache = data
        return _concept_data_cache

    except Exception as e:
        logger.error(f"Failed to load concept data: {e}")
        _concept_data_cache = {}
        return _concept_data_cache


def get_all_concept_names() -> Set[str]:
    """
    Get set of all available concept names.

    Returns:
        Set of concept names (without 'game_concept_' prefix)

    Examples:
        >>> concepts = get_all_concept_names()
        >>> 'vassal' in concepts
        True
        >>> 'opinion' in concepts
        True
    """
    global _concept_set_cache

    if _concept_set_cache is not None:
        return _concept_set_cache

    if not is_concept_data_available():
        _concept_set_cache = set()
        return _concept_set_cache

    concept_data = _load_concept_data()
    _concept_set_cache = set(concept_data.keys())
    return _concept_set_cache


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def is_valid_concept(concept_name: str) -> bool:
    """
    Check if a concept name is valid.

    Args:
        concept_name: The concept name to check (without 'game_concept_' prefix)

    Returns:
        True if concept exists, False otherwise

    Examples:
        >>> is_valid_concept('vassal')
        True
        >>> is_valid_concept('nonexistent')
        False
    """
    if not is_concept_data_available():
        return True  # Skip validation if data not available

    return concept_name in get_all_concept_names()


def get_concept_info(concept_name: str) -> Optional[Dict[str, str]]:
    """
    Get information about a specific concept.

    Args:
        concept_name: The concept name (without 'game_concept_' prefix)

    Returns:
        Dictionary with concept data, or None if not found
        Keys: 'text' (localized string), 'source' (source file)

    Examples:
        >>> info = get_concept_info('vassal')
        >>> info['text']
        'A character who has sworn fealty to a liege...'
    """
    if not is_concept_data_available():
        return None

    concept_data = _load_concept_data()
    return concept_data.get(concept_name)


# =============================================================================
# FUZZY MATCHING
# =============================================================================

def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate Levenshtein edit distance between two strings.

    Args:
        s1: First string
        s2: Second string

    Returns:
        Edit distance (number of single-character edits needed)
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)

    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def suggest_similar_concepts(concept_name: str, max_suggestions: int = 5, threshold: float = 0.6) -> List[str]:
    """
    Suggest similar concept names for typos.

    Args:
        concept_name: The (possibly misspelled) concept name
        max_suggestions: Maximum number of suggestions to return
        threshold: Minimum similarity ratio (0.0-1.0)

    Returns:
        List of similar concept names, sorted by similarity

    Examples:
        >>> suggest_similar_concepts('vasal')  # typo
        ['vassal', 'vassalage', 'vassal_contract']
    """
    if not is_concept_data_available():
        return []

    concepts = get_all_concept_names()

    if not concepts:
        return []

    # Calculate similarity for all concepts
    similarities = []
    for concept in concepts:
        distance = levenshtein_distance(concept_name.lower(), concept.lower())
        max_len = max(len(concept_name), len(concept))
        similarity = 1.0 - (distance / max_len)

        if similarity >= threshold:
            similarities.append((concept, similarity))

    # Sort by similarity (highest first)
    similarities.sort(key=lambda x: x[1], reverse=True)

    return [concept for concept, _ in similarities[:max_suggestions]]


# =============================================================================
# QUERY FUNCTIONS
# =============================================================================

def get_concept_statistics() -> Dict[str, int]:
    """
    Get statistics about loaded concepts.

    Returns:
        Dictionary with statistics:
        - total: Total number of concepts
        - available: Whether concept data is available

    Examples:
        >>> stats = get_concept_statistics()
        >>> stats['total']
        287
    """
    if not is_concept_data_available():
        return {
            'total': 0,
            'available': False
        }

    concepts = get_all_concept_names()

    return {
        'total': len(concepts),
        'available': True
    }


def search_concepts_by_text(search_term: str) -> List[Tuple[str, str]]:
    """
    Search for concepts by their localized text.

    Args:
        search_term: Term to search for (case-insensitive)

    Returns:
        List of (concept_name, text) tuples matching the search

    Examples:
        >>> results = search_concepts_by_text('vassal')
        >>> len(results) > 0
        True
    """
    if not is_concept_data_available():
        return []

    concept_data = _load_concept_data()
    search_lower = search_term.lower()

    results = []
    for concept_name, info in concept_data.items():
        text = info.get('text', '')
        if search_lower in text.lower() or search_lower in concept_name.lower():
            results.append((concept_name, text))

    return results


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

def clear_cache():
    """
    Clear all cached concept data.

    Useful for testing or when concept files are updated.
    Requires language server restart to reload data.
    """
    global _concept_set_cache, _concept_data_cache, _concept_data_available_cache
    _concept_set_cache = None
    _concept_data_cache = None
    _concept_data_available_cache = None
    logger.info("Concept cache cleared")


# =============================================================================
# DOCUMENTATION
# =============================================================================

def get_concept_description(concept_name: str) -> str:
    """
    Get a user-friendly description of a concept for hover documentation.

    Args:
        concept_name: The concept name

    Returns:
        Description string suitable for hover tooltips

    Examples:
        >>> desc = get_concept_description('vassal')
        >>> 'vassal' in desc.lower()
        True
    """
    if not is_concept_data_available():
        return f"Game concept: {concept_name}"

    info = get_concept_info(concept_name)
    if not info:
        return f"Game concept: {concept_name} (not found)"

    text = info.get('text', 'No description available')

    # Truncate long descriptions for hover
    if len(text) > 200:
        text = text[:197] + "..."

    return f"**{concept_name}**\n\n{text}\n\n*Usage:* `[{concept_name}|E]`"
