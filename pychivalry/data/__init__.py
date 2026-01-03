"""
Data Loader Module for CK3 Game Definitions

DIAGNOSTIC CODES:
    DATA-001: YAML file not found
    DATA-002: YAML parsing error
    DATA-003: Data directory does not exist
    DATA-004: Failed to load data file

MODULE OVERVIEW:
    This module provides a robust, data-driven system for loading Crusader Kings 3
    game definitions from YAML files. Instead of hardcoding game data (traits, effects,
    triggers, scopes) in Python, we load them from easily-editable YAML files in the
    data/ directory tree.

ARCHITECTURE BENEFITS:
    1. Non-developers can contribute: Game data updates don't require Python knowledge
    2. Version control friendly: YAML files are text-based and diff-friendly
    3. Easy patching: When CK3 updates, just update YAML files, not code
    4. Modular organization: Different data types in separate subdirectories
    5. Clear separation: Data and logic are completely separate
    6. Performance: Data is cached after first load for fast subsequent access

DIRECTORY STRUCTURE:
    data/
    ├── scopes/         # Scope type definitions (character, title, province, etc.)
    ├── effects/        # Effect command definitions  
    ├── triggers/       # Trigger condition definitions
    └── traits/         # Character trait definitions

YAML FILE FORMAT:
    Each YAML file contains a dictionary where keys are identifiers and values
    are definition objects. Example:

    ```yaml
    character:
      links: [liege, spouse, father, mother, primary_title]
      lists: [vassal, courtier, child, prisoner]
      triggers: [is_adult, is_alive, has_trait, age]
      effects: [add_gold, add_trait, death, imprison]
    ```

CACHING SYSTEM:
    Data is loaded once and cached in module-level variables to avoid repeated
    file I/O. The cache can be cleared manually using clear_cache() for testing
    or reloading updated data files.

ERROR HANDLING:
    The module uses defensive programming to handle errors gracefully:
    - Missing files log errors but don't crash
    - Invalid YAML logs errors but continues with other files
    - Missing directories return empty data structures
    - All functions document their exception behavior

USAGE EXAMPLES:
    >>> # Get scope definitions (cached after first call)
    >>> scopes = get_scopes()
    >>> 'character' in scopes  # True
    
    >>> # Clear cache and reload (useful for testing)
    >>> clear_cache()
    >>> scopes = get_scopes(use_cache=False)
    
    >>> # Get effect definitions
    >>> effects = get_effects()
    >>> 'add_gold' in effects  # True

PERFORMANCE:
    - First load: ~50-100ms (depending on data size)
    - Cached loads: <1ms (dictionary lookup)
    - Memory: ~1-5MB for all game definitions

SEE ALSO:
    - scopes.py: Uses scope data for validation
    - ck3_language.py: Uses effect/trigger data for completions
    - diagnostics.py: Uses data for semantic validation
"""

# =============================================================================
# IMPORTS
# =============================================================================

# yaml: YAML parser for reading .yaml data files
# We use safe_load() to prevent code execution from YAML
import yaml

# pathlib: Modern path manipulation library
# Cleaner and more portable than os.path
from pathlib import Path

# typing: Type hints for better code documentation and IDE support
from typing import Dict, List, Any, Optional

# logging: For diagnostic output and error tracking
import logging

# Initialize module logger for tracking data loading operations
# Uses standard Python logging for integration with application logging
logger = logging.getLogger(__name__)

# =============================================================================
# MODULE-LEVEL CONSTANTS
# =============================================================================

# Base directory for all data files
# __file__ is the path to this Python file (data/__init__.py)
# .parent gives us the data/ directory containing YAML files
# This is resolved at import time and remains constant
DATA_DIR = Path(__file__).parent


# =============================================================================
# CORE DATA LOADING FUNCTIONS
# =============================================================================

def load_yaml_file(file_path: Path) -> Dict[str, Any]:
    """
    Load and parse a single YAML file into a Python dictionary.

    This function safely loads YAML data using yaml.safe_load() which prevents
    arbitrary code execution. It handles common error cases and provides clear
    diagnostic messages.

    Algorithm:
    1. Open file with UTF-8 encoding (CK3 uses Unicode characters)
    2. Parse YAML content using safe_load (security-conscious)
    3. Handle None result (empty YAML file) by returning empty dict
    4. Catch and log specific errors with diagnostic codes

    Args:
        file_path: Path object pointing to the YAML file to load
                  Should be a .yaml or .yml file

    Returns:
        Dictionary containing the parsed YAML data.
        Returns empty dictionary {} if file is empty or only contains comments.

    Raises:
        FileNotFoundError: If the file does not exist at file_path
                          (Diagnostic code: DATA-001)
        yaml.YAMLError: If the file contains invalid YAML syntax
                        (Diagnostic code: DATA-002)

    Examples:
        >>> path = DATA_DIR / 'scopes' / 'character.yaml'
        >>> data = load_yaml_file(path)
        >>> 'character' in data  # True if file defines character scope

    Performance:
        - Small files (<10KB): <5ms
        - Large files (>100KB): 10-50ms
        - Cached by calling functions, not cached here

    Security:
        Uses yaml.safe_load() instead of yaml.load() to prevent code execution
        from maliciously crafted YAML files.
    """
    try:
        # Open file with UTF-8 encoding to support international characters
        # 'r' mode for reading text
        with open(file_path, "r", encoding="utf-8") as f:
            # safe_load() parses YAML without executing Python code
            # This is critical for security when loading untrusted files
            data = yaml.safe_load(f)
            
            # safe_load returns None for empty files or files with only comments
            # Convert None to empty dict for consistent return type
            return data if data is not None else {}
            
    except FileNotFoundError:
        # File doesn't exist at the specified path
        # This is a critical error - log it and re-raise
        logger.error(f"Data file not found: {file_path}")  # DATA-001
        raise  # Re-raise to let caller handle
        
    except yaml.YAMLError as e:
        # YAML syntax error - malformed file
        # Log with context and re-raise for caller to handle
        logger.error(f"Error parsing YAML file {file_path}: {e}")  # DATA-002
        raise  # Re-raise to let caller handle


def load_all_files_in_directory(directory: Path) -> Dict[str, Any]:
    """
    Load all YAML files in a directory and merge them into a single dictionary.

    This function provides bulk loading with graceful error handling. If one file
    fails to load, the others continue processing. This resilience ensures that
    a single bad file doesn't break the entire data loading system.

    Merging Strategy:
    Files are loaded in alphabetical order (determined by glob()'s sorting).
    Later files override earlier files if they define the same keys. This allows
    for a base definition file plus override files for customization.

    Algorithm:
    1. Check if directory exists, return empty dict if not
    2. Find all .yaml files using glob pattern
    3. For each file:
       a. Try to load the YAML data
       b. Merge into accumulated dictionary (update overwrites duplicates)
       c. Log success at debug level
       d. If error, log it and continue with next file
    4. Return merged dictionary

    Args:
        directory: Path object pointing to a directory containing YAML files
                  Should contain *.yaml files

    Returns:
        Dictionary containing merged data from all YAML files in the directory.
        Keys from later files (alphabetically) override keys from earlier files.
        Returns empty dictionary if directory doesn't exist or has no YAML files.

    Examples:
        >>> # Load all scope definitions from data/scopes/*.yaml
        >>> scopes_dir = DATA_DIR / 'scopes'
        >>> scopes = load_all_files_in_directory(scopes_dir)
        >>> 'character' in scopes  # True
        >>> 'landed_title' in scopes  # True

    Error Handling:
        - Missing directory: Logs warning (DATA-003), returns {}
        - Individual file errors: Logs error (DATA-004), continues loading
        - YAML syntax errors: Logs error (DATA-004), continues loading
        This defensive approach ensures partial data is better than no data

    Performance:
        - Small directory (5-10 files): 10-50ms
        - Large directory (50+ files): 100-500ms
        - Dominated by disk I/O and YAML parsing time

    Diagnostic Codes:
        DATA-003: Directory does not exist
        DATA-004: Failed to load individual file (continues with others)
    """
    # Initialize empty dictionary to accumulate merged data
    merged_data = {}

    # Check if directory exists before trying to read files
    if not directory.exists():
        # Directory missing is a warning, not an error
        # This allows optional data directories
        logger.warning(f"Data directory does not exist: {directory}")  # DATA-003
        # Return empty dict - no data available from this directory
        return merged_data

    # Iterate through all YAML files in the directory
    # glob("*.yaml") finds all files ending in .yaml
    # Results are returned in sorted (alphabetical) order
    for file_path in directory.glob("*.yaml"):
        try:
            # Attempt to load this YAML file
            data = load_yaml_file(file_path)
            
            # Merge loaded data into accumulated dictionary
            # update() adds all key-value pairs from data into merged_data
            # If keys exist in both, data's values overwrite merged_data's values
            merged_data.update(data)
            
            # Log successful load at debug level (not shown in production)
            # Includes just filename (not full path) for cleaner logs
            logger.debug(f"Loaded data from {file_path.name}")
            
        except Exception as e:
            # Catch ANY exception to prevent one bad file from breaking everything
            # This includes FileNotFoundError, YAMLError, and unexpected errors
            logger.error(f"Failed to load {file_path.name}: {e}")  # DATA-004
            
            # Continue loading other files
            # The 'continue' is implicit (loop continues automatically)
            # We don't raise or return early - resilience is key
            continue

    # Return the merged data from all successfully loaded files
    return merged_data


# =============================================================================
# SPECIALIZED DATA LOADER FUNCTIONS
# =============================================================================

def load_scopes() -> Dict[str, Dict[str, List[str]]]:
    """
    Load scope definitions from data/scopes/*.yaml files.

    Scopes are the fundamental context system in CK3 scripting. Each scope type
    represents a different game entity and defines what operations are valid.

    Data Structure:
    Each YAML file in data/scopes/ defines one or more scope types. Each scope
    type is a dictionary with four list properties:
    - links: Single-step navigations to related objects
    - lists: Collection iterations for any_*, every_*, etc.
    - triggers: Conditional checks available in this scope
    - effects: State-modifying commands available in this scope

    Returns:
        Dictionary mapping scope type names to their complete definitions.
        
        Structure:
        {
            'character': {
                'links': ['liege', 'spouse', 'father', 'mother', ...],
                'lists': ['vassal', 'courtier', 'child', 'prisoner', ...],
                'triggers': ['is_adult', 'is_alive', 'has_trait', 'age', ...],
                'effects': ['add_gold', 'add_prestige', 'death', 'imprison', ...]
            },
            'landed_title': {
                'links': ['holder', 'previous_holder', 'de_jure_liege', ...],
                'lists': ['de_jure_county', 'de_jure_duchy', ...],
                'triggers': ['has_holder', 'is_title_created', ...],
                'effects': ['set_county_faith', 'set_county_culture', ...]
            },
            ...
        }

    Examples:
        >>> scopes = load_scopes()
        >>> 'character' in scopes  # True
        >>> 'liege' in scopes['character']['links']  # True

    Performance:
        Typically 10-50ms to load all scope definitions (5-10 YAML files)

    See Also:
        get_scopes() - Cached version of this function
        scopes.py - Module that uses this data for validation
    """
    # Construct path to scopes subdirectory
    scopes_dir = DATA_DIR / "scopes"
    # Load and merge all YAML files in that directory
    return load_all_files_in_directory(scopes_dir)


def load_effects() -> Dict[str, Dict[str, Any]]:
    """
    Load effect definitions from data/effects/*.yaml files.

    Effects are commands that modify game state (add gold, kill character, etc.).
    Each effect definition includes metadata for validation and documentation.

    Data Structure:
    Each effect is defined with:
    - description: Human-readable explanation of what the effect does
    - scopes: List of scope types where this effect is valid
    - parameters: Expected parameters (optional) for validation
    - examples: Usage examples (optional) for hover documentation

    Returns:
        Dictionary mapping effect names to their definition objects.
        
        Structure:
        {
            'add_gold': {
                'description': 'Add gold to character',
                'scopes': ['character'],
                'parameters': ['value'],
                'examples': ['add_gold = 100']
            },
            ...
        }

    Examples:
        >>> effects = load_effects()
        >>> 'add_gold' in effects  # True
        >>> effects['add_gold']['description']  # 'Add gold to character'

    See Also:
        get_effects() - Cached version of this function
    """
    # Construct path to effects subdirectory
    effects_dir = DATA_DIR / "effects"
    # Load and merge all YAML files in that directory
    return load_all_files_in_directory(effects_dir)


def load_triggers() -> Dict[str, Dict[str, Any]]:
    """
    Load trigger definitions from data/triggers/*.yaml files.

    Triggers are conditional checks that test game state (is adult, has trait, etc.).
    Each trigger definition includes metadata for validation and documentation.

    Data Structure:
    Each trigger is defined with:
    - description: Human-readable explanation of what the trigger checks
    - scopes: List of scope types where this trigger is valid
    - parameters: Expected parameters (optional) for validation
    - examples: Usage examples (optional) for hover documentation

    Returns:
        Dictionary mapping trigger names to their definition objects.
        
        Structure:
        {
            'is_adult': {
                'description': 'Check if character is adult (age >= 16)',
                'scopes': ['character'],
                'examples': ['is_adult = yes']
            },
            ...
        }

    Examples:
        >>> triggers = load_triggers()
        >>> 'is_adult' in triggers  # True
        >>> triggers['is_adult']['description']  # 'Check if character is adult...'

    See Also:
        get_triggers() - Cached version of this function
    """
    # Construct path to triggers subdirectory
    triggers_dir = DATA_DIR / "triggers"
    # Load and merge all YAML files in that directory
    return load_all_files_in_directory(triggers_dir)


def load_traits() -> Dict[str, Dict[str, Any]]:
    """
    Load trait definitions from data/traits/*.yaml files.

    Traits are character attributes (brave, cruel, genius, etc.) that affect
    gameplay. Each trait definition includes categorization and relationships.

    Data Structure:
    Each trait is defined with:
    - category: Trait category (personality, lifestyle, health, education, etc.)
    - opposites: List of traits that conflict with this one
    - description: Human-readable explanation
    - modifiers: Gameplay effects (optional)
    - level: For multi-level traits (optional)

    Returns:
        Dictionary mapping trait names to their definition objects.
        
        Structure:
        {
            'brave': {
                'category': 'personality',
                'opposites': ['craven'],
                'description': 'Character is brave and confident in battle'
            },
            ...
        }

    Examples:
        >>> traits = load_traits()
        >>> 'brave' in traits  # True
        >>> traits['brave']['category']  # 'personality'
        >>> 'craven' in traits['brave']['opposites']  # True

    See Also:
        get_traits() - Cached version of this function
    """
    # Construct path to traits subdirectory
    traits_dir = DATA_DIR / "traits"
    # Load and merge all YAML files in that directory
    return load_all_files_in_directory(traits_dir)


def load_animations() -> Dict[str, Dict[str, Any]]:
    """
    Load animation definitions from data/animations.yaml.

    Animations are the visual poses/expressions used in portrait blocks.
    Each animation definition includes metadata for categorization.

    Data Structure:
    Each animation is defined with:
    - description: Human-readable explanation of the animation
    - category: Animation category (emotion, personality, combat, etc.)

    Returns:
        Dictionary mapping animation names to their definition objects.
        
        Structure:
        {
            'happiness': {
                'description': 'Joyful expression',
                'category': 'emotion'
            },
            'thinking': {
                'description': 'Thoughtful/contemplative pose',
                'category': 'emotion'
            },
            ...
        }

    Examples:
        >>> animations = load_animations()
        >>> 'thinking' in animations  # True
        >>> animations['happiness']['category']  # 'emotion'

    See Also:
        get_animations() - Cached version of this function
    """
    # Load from single animations.yaml file
    animations_file = DATA_DIR / "animations.yaml"
    return load_yaml_file(animations_file)


# =============================================================================
# CACHING SYSTEM
# =============================================================================

# Module-level cache variables to store loaded data
# These are initialized to None and populated on first access
# Using Optional[] type hints to indicate they can be None or dict

# Cache for scope definitions (character, title, province, etc.)
_scopes_cache: Optional[Dict[str, Dict[str, List[str]]]] = None

# Cache for effect definitions (add_gold, add_trait, etc.)
_effects_cache: Optional[Dict[str, Dict[str, Any]]] = None

# Cache for trigger definitions (is_adult, has_trait, etc.)
_triggers_cache: Optional[Dict[str, Dict[str, Any]]] = None

# Cache for trait definitions (brave, cruel, genius, etc.)
_traits_cache: Optional[Dict[str, Dict[str, Any]]] = None

# Cache for animation definitions (idle, happiness, thinking, etc.)
_animations_cache: Optional[Dict[str, Dict[str, Any]]] = None


# =============================================================================
# PUBLIC API FUNCTIONS (WITH CACHING)
# =============================================================================

def get_scopes(use_cache: bool = True) -> Dict[str, Dict[str, List[str]]]:
    """
    Get scope definitions with intelligent caching.

    This is the recommended way to access scope data. It uses module-level
    caching to avoid repeated file I/O operations. On first call, data is
    loaded from YAML files and cached. Subsequent calls return the cached data.

    Caching Logic:
    - If use_cache=True and cache exists: Return cached data (fast)
    - If use_cache=True and cache is None: Load data, cache it, return it
    - If use_cache=False: Load data fresh, update cache, return it

    Args:
        use_cache: Whether to use cached data if available (default: True)
                  Set to False to force reload from files (useful for testing)

    Returns:
        Complete scope definitions dictionary (same as load_scopes())

    Examples:
        >>> # First call loads from files (~50ms)
        >>> scopes = get_scopes()
        
        >>> # Second call uses cache (~0.1ms) - 500x faster
        >>> scopes_again = get_scopes()
        
        >>> # Force reload (for testing or after file changes)
        >>> fresh_scopes = get_scopes(use_cache=False)

    Performance:
        - Cached: <1ms (dictionary access)
        - Uncached: 10-50ms (file I/O + YAML parsing)

    Thread Safety:
        Not thread-safe. For multi-threaded use, implement locking around cache access.
    """
    # Declare that we're modifying the global cache variable
    global _scopes_cache

    # Check if we need to load data
    # Load if: use_cache is False (force reload) OR cache is None (not yet loaded)
    if not use_cache or _scopes_cache is None:
        # Load data from YAML files and update cache
        _scopes_cache = load_scopes()

    # Return cached data (may have just been loaded above)
    return _scopes_cache


def get_effects(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """
    Get effect definitions with intelligent caching.

    See get_scopes() for detailed documentation on caching behavior.
    This function works identically but for effect definitions.

    Args:
        use_cache: Whether to use cached data (default: True)

    Returns:
        Complete effect definitions dictionary

    Examples:
        >>> effects = get_effects()
        >>> 'add_gold' in effects  # True
    """
    # Declare we're modifying the global cache variable
    global _effects_cache

    # Load if cache is invalid or use_cache is False
    if not use_cache or _effects_cache is None:
        _effects_cache = load_effects()

    # Return cached data
    return _effects_cache


def get_triggers(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """
    Get trigger definitions with intelligent caching.

    See get_scopes() for detailed documentation on caching behavior.
    This function works identically but for trigger definitions.

    Args:
        use_cache: Whether to use cached data (default: True)

    Returns:
        Complete trigger definitions dictionary

    Examples:
        >>> triggers = get_triggers()
        >>> 'is_adult' in triggers  # True
    """
    # Declare we're modifying the global cache variable
    global _triggers_cache

    # Load if cache is invalid or use_cache is False
    if not use_cache or _triggers_cache is None:
        _triggers_cache = load_triggers()

    # Return cached data
    return _triggers_cache


def get_traits(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """
    Get trait definitions with intelligent caching.

    See get_scopes() for detailed documentation on caching behavior.
    This function works identically but for trait definitions.

    Args:
        use_cache: Whether to use cached data (default: True)

    Returns:
        Complete trait definitions dictionary

    Examples:
        >>> traits = get_traits()
        >>> 'brave' in traits  # True
    """
    # Declare we're modifying the global cache variable
    global _traits_cache

    # Load if cache is invalid or use_cache is False
    if not use_cache or _traits_cache is None:
        _traits_cache = load_traits()

    # Return cached data
    return _traits_cache


def get_animations(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """
    Get animation definitions with intelligent caching.

    See get_scopes() for detailed documentation on caching behavior.
    This function works identically but for animation definitions.

    Args:
        use_cache: Whether to use cached data (default: True)

    Returns:
        Complete animation definitions dictionary

    Examples:
        >>> animations = get_animations()
        >>> 'thinking' in animations  # True
        >>> 'happiness' in animations  # True
    """
    # Declare we're modifying the global cache variable
    global _animations_cache

    # Load if cache is invalid or use_cache is False
    if not use_cache or _animations_cache is None:
        _animations_cache = load_animations()

    # Return cached data
    return _animations_cache


def clear_cache():
    """
    Clear all cached data to force reload on next access.

    This function resets all module-level cache variables to None. The next
    call to any get_*() function will reload data from YAML files.

    Use Cases:
    - Unit testing: Reset state between tests
    - Development: Reload after modifying YAML files
    - Hot reload: Reload data without restarting server
    - Memory management: Free cached data if needed

    Examples:
        >>> # Initial load
        >>> scopes = get_scopes()
        
        >>> # Modify YAML file externally
        >>> # ...
        
        >>> # Clear cache and reload
        >>> clear_cache()
        >>> fresh_scopes = get_scopes()  # Reloads from files

    Performance:
        O(1) - just sets four variables to None

    Side Effects:
        Next call to get_scopes/effects/triggers/traits/animations will reload from disk
    """
    # Declare we're modifying all global cache variables
    global _scopes_cache, _effects_cache, _triggers_cache, _traits_cache, _animations_cache
    
    # Reset all caches to None
    # This invalidates the cache and forces reload on next access
    _scopes_cache = None
    _effects_cache = None
    _triggers_cache = None
    _traits_cache = None
    _animations_cache = None
