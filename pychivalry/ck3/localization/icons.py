"""
CK3 Icon Reference System - Localization Icon Validation

DIAGNOSTIC CODES:
    ICON-001: Unknown icon reference
    ICON-002: Invalid icon reference syntax
    ICON-003: Missing icon file

MODULE OVERVIEW:
    Provides validation and query functions for CK3 icon references used in
    localization. Icons are inline graphics that display in game text.

    Icons are referenced in localization files using the pattern:
    @icon_name!

    Example: @gold_icon! displays the gold coin icon

ICON REFERENCE SYNTAX:
    @icon_name!              -> Standard icon
    @mod_name/icon_path!     -> Mod-specific icon path

USAGE EXAMPLES:
    >>> # Check if icon exists
    >>> is_valid_icon('gold_icon')
    True
    >>> is_valid_icon('nonexistent_icon')
    False

    >>> # Get icon information
    >>> icon_info = get_icon_info('gold_icon')
    >>> icon_info['category']
    'resources'
    >>> icon_info['reference']
    '@gold_icon!'

    >>> # Get suggestions for typos
    >>> suggest_similar_icons('goldd')  # typo
    ['gold_icon', 'gold', 'gold_i']

    >>> # Get icons by category
    >>> resource_icons = get_icons_by_category('resources')
    >>> 'gold_icon' in resource_icons
    True

    >>> # Get all icon names
    >>> all_icons = get_all_icon_names()
    >>> 'prestige_icon' in all_icons
    True

PERFORMANCE:
    - Icon data loaded once and cached
    - Validation: O(1) set membership test (<1μs)
    - Memory: ~100KB for 100+ icons
    - Thread-safe for read operations

SEE ALSO:
    - data/icons/icons.yaml: Icon definitions (user must extract)
    - tools/extract_icons.py: Extraction script
    - localization.py: Uses icons for LOC-004 validation
    - completions.py: Provides icon completions
"""

from typing import Dict, List, Optional, Set, Tuple
from pathlib import Path
from pychivalry.data import DATA_DIR
import logging

logger = logging.getLogger(__name__)

# Cache for fast lookups
_icon_set_cache: Optional[Set[str]] = None
_icon_data_cache: Optional[Dict[str, Dict[str, str]]] = None
_icon_data_available_cache: Optional[bool] = None


# =============================================================================
# DATA AVAILABILITY CHECK
# =============================================================================

def is_icon_data_available() -> bool:
    """
    Check if icon data files are available.

    Icon data files must be extracted by users from their own CK3 installation
    due to copyright restrictions. This function checks if the extraction has
    been performed.

    Returns:
        True if icon YAML files exist, False otherwise

    Note:
        Result is cached after first call for performance. If icon files
        are added/removed, the language server must be restarted.

    Examples:
        >>> is_icon_data_available()
        True  # If user has extracted icon data

        >>> is_icon_data_available()
        False  # If icon data not yet extracted

    See Also:
        - VS Code Command: "CK3: Extract Localization Data from CK3 Installation"
        - tools/extract_icons.py: Extraction script
    """
    global _icon_data_available_cache

    if _icon_data_available_cache is not None:
        return _icon_data_available_cache

    icons_dir = DATA_DIR / "icons"

    if not icons_dir.exists():
        logger.info("Icon data directory does not exist - icon validation disabled")
        _icon_data_available_cache = False
        return False

    # Check if icons.yaml exists
    icons_file = icons_dir / "icons.yaml"
    if not icons_file.exists():
        logger.info("icons.yaml not found - icon validation disabled")
        _icon_data_available_cache = False
        return False

    logger.info(f"Icon data available at {icons_file}")
    _icon_data_available_cache = True
    return True


# =============================================================================
# DATA LOADING
# =============================================================================

def _load_icon_data() -> Dict[str, Dict[str, str]]:
    """
    Load icon data from YAML files.

    Returns:
        Dictionary mapping icon names to their data

    Note:
        This is an internal function. Use get_icon_info() instead.
    """
    global _icon_data_cache

    if _icon_data_cache is not None:
        return _icon_data_cache

    if not is_icon_data_available():
        _icon_data_cache = {}
        return _icon_data_cache

    try:
        import yaml
        icons_file = DATA_DIR / "icons" / "icons.yaml"

        with open(icons_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        if not isinstance(data, dict):
            logger.warning(f"icons.yaml has invalid format - expected dict, got {type(data)}")
            _icon_data_cache = {}
            return _icon_data_cache

        logger.info(f"Loaded {len(data)} icon references from {icons_file}")
        _icon_data_cache = data
        return _icon_data_cache

    except Exception as e:
        logger.error(f"Failed to load icon data: {e}")
        _icon_data_cache = {}
        return _icon_data_cache


def get_all_icon_names() -> Set[str]:
    """
    Get set of all available icon names.

    Returns:
        Set of icon names (without @ prefix and ! suffix)

    Examples:
        >>> icons = get_all_icon_names()
        >>> 'gold_icon' in icons
        True
        >>> 'prestige_icon' in icons
        True
    """
    global _icon_set_cache

    if _icon_set_cache is not None:
        return _icon_set_cache

    if not is_icon_data_available():
        _icon_set_cache = set()
        return _icon_set_cache

    icon_data = _load_icon_data()
    _icon_set_cache = set(icon_data.keys())
    return _icon_set_cache


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def is_valid_icon(icon_name: str) -> bool:
    """
    Check if an icon name is valid.

    Args:
        icon_name: The icon name to check (without @ and !)

    Returns:
        True if icon exists, False otherwise

    Examples:
        >>> is_valid_icon('gold_icon')
        True
        >>> is_valid_icon('nonexistent')
        False
    """
    if not is_icon_data_available():
        return True  # Skip validation if data not available

    # Strip @ and ! if present
    icon_name = icon_name.strip('@!')

    return icon_name in get_all_icon_names()


def get_icon_info(icon_name: str) -> Optional[Dict[str, str]]:
    """
    Get information about a specific icon.

    Args:
        icon_name: The icon name (without @ and !)

    Returns:
        Dictionary with icon data, or None if not found
        Keys: 'category', 'description', 'reference'

    Examples:
        >>> info = get_icon_info('gold_icon')
        >>> info['category']
        'resources'
        >>> info['reference']
        '@gold_icon!'
    """
    if not is_icon_data_available():
        return None

    # Strip @ and ! if present
    icon_name = icon_name.strip('@!')

    icon_data = _load_icon_data()
    return icon_data.get(icon_name)


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


def suggest_similar_icons(icon_name: str, max_suggestions: int = 5, threshold: float = 0.6) -> List[str]:
    """
    Suggest similar icon names for typos.

    Args:
        icon_name: The (possibly misspelled) icon name
        max_suggestions: Maximum number of suggestions to return
        threshold: Minimum similarity ratio (0.0-1.0)

    Returns:
        List of similar icon names, sorted by similarity

    Examples:
        >>> suggest_similar_icons('goldd')  # typo
        ['gold_icon', 'gold', 'gold_i']
    """
    if not is_icon_data_available():
        return []

    # Strip @ and ! if present
    icon_name = icon_name.strip('@!')

    icons = get_all_icon_names()

    if not icons:
        return []

    # Calculate similarity for all icons
    similarities = []
    for icon in icons:
        distance = levenshtein_distance(icon_name.lower(), icon.lower())
        max_len = max(len(icon_name), len(icon))
        similarity = 1.0 - (distance / max_len)

        if similarity >= threshold:
            similarities.append((icon, similarity))

    # Sort by similarity (highest first)
    similarities.sort(key=lambda x: x[1], reverse=True)

    return [icon for icon, _ in similarities[:max_suggestions]]


# =============================================================================
# QUERY FUNCTIONS
# =============================================================================

def get_icons_by_category(category: str) -> Set[str]:
    """
    Get all icons in a specific category.

    Args:
        category: Category name (e.g., 'resources', 'character', 'military')

    Returns:
        Set of icon names in that category

    Examples:
        >>> resource_icons = get_icons_by_category('resources')
        >>> 'gold_icon' in resource_icons
        True
    """
    if not is_icon_data_available():
        return set()

    icon_data = _load_icon_data()
    category_lower = category.lower()

    return {
        icon_name
        for icon_name, info in icon_data.items()
        if info.get('category', '').lower() == category_lower
    }


def get_icon_categories() -> List[str]:
    """
    Get list of all icon categories.

    Returns:
        List of category names

    Examples:
        >>> categories = get_icon_categories()
        >>> 'resources' in categories
        True
    """
    if not is_icon_data_available():
        return []

    icon_data = _load_icon_data()
    categories = {info.get('category', 'other') for info in icon_data.values()}
    return sorted(categories)


def get_icon_statistics() -> Dict[str, int]:
    """
    Get statistics about loaded icons.

    Returns:
        Dictionary with statistics:
        - total: Total number of icons
        - available: Whether icon data is available
        - categories: Number of icon categories

    Examples:
        >>> stats = get_icon_statistics()
        >>> stats['total'] > 0
        True
    """
    if not is_icon_data_available():
        return {
            'total': 0,
            'available': False,
            'categories': 0
        }

    icons = get_all_icon_names()
    categories = get_icon_categories()

    return {
        'total': len(icons),
        'available': True,
        'categories': len(categories)
    }


def search_icons_by_description(search_term: str) -> List[Tuple[str, str]]:
    """
    Search for icons by their description.

    Args:
        search_term: Term to search for (case-insensitive)

    Returns:
        List of (icon_name, description) tuples matching the search

    Examples:
        >>> results = search_icons_by_description('gold')
        >>> len(results) > 0
        True
    """
    if not is_icon_data_available():
        return []

    icon_data = _load_icon_data()
    search_lower = search_term.lower()

    results = []
    for icon_name, info in icon_data.items():
        description = info.get('description', '')
        if search_lower in description.lower() or search_lower in icon_name.lower():
            results.append((icon_name, description))

    return results


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

def clear_cache():
    """
    Clear all cached icon data.

    Useful for testing or when icon files are updated.
    Requires language server restart to reload data.
    """
    global _icon_set_cache, _icon_data_cache, _icon_data_available_cache
    _icon_set_cache = None
    _icon_data_cache = None
    _icon_data_available_cache = None
    logger.info("Icon cache cleared")


# =============================================================================
# DOCUMENTATION
# =============================================================================

def get_icon_description(icon_name: str) -> str:
    """
    Get a user-friendly description of an icon for hover documentation.

    Args:
        icon_name: The icon name (without @ and !)

    Returns:
        Description string suitable for hover tooltips

    Examples:
        >>> desc = get_icon_description('gold_icon')
        >>> 'gold' in desc.lower()
        True
    """
    if not is_icon_data_available():
        return f"Icon: @{icon_name}!"

    # Strip @ and ! if present
    icon_name = icon_name.strip('@!')

    info = get_icon_info(icon_name)
    if not info:
        return f"Icon: @{icon_name}! (not found)"

    description = info.get('description', 'No description available')
    category = info.get('category', 'other')
    reference = info.get('reference', f'@{icon_name}!')

    return f"**{description}**\n\n*Category:* {category}\n\n*Usage:* `{reference}`"
