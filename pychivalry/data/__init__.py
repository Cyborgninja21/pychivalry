"""
Data loader module for CK3 game definitions.

This module provides functions to load CK3 game data from YAML files in the data/ directory.
The data-driven approach allows updates to game definitions (traits, effects, triggers, scopes)
without modifying Python code.

Benefits:
- Non-developers can contribute game data updates
- Easy to keep in sync with game patches and DLCs
- Modular organization by type (scopes, effects, triggers)
- Clear separation of data and logic
"""

import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Base directory for all data files
DATA_DIR = Path(__file__).parent


def load_yaml_file(file_path: Path) -> Dict[str, Any]:
    """
    Load and parse a YAML file.

    Args:
        file_path: Path to the YAML file

    Returns:
        Parsed YAML data as a dictionary

    Raises:
        FileNotFoundError: If the file doesn't exist
        yaml.YAMLError: If the file is not valid YAML
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            return data if data is not None else {}
    except FileNotFoundError:
        logger.error(f"Data file not found: {file_path}")
        raise
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML file {file_path}: {e}")
        raise


def load_all_files_in_directory(directory: Path) -> Dict[str, Any]:
    """
    Load all YAML files in a directory and merge them into a single dictionary.

    Args:
        directory: Path to directory containing YAML files

    Returns:
        Merged dictionary containing data from all files
    """
    merged_data = {}

    if not directory.exists():
        logger.warning(f"Data directory does not exist: {directory}")
        return merged_data

    for file_path in directory.glob("*.yaml"):
        try:
            data = load_yaml_file(file_path)
            # Merge data, with later files overriding earlier ones
            merged_data.update(data)
            logger.debug(f"Loaded data from {file_path.name}")
        except Exception as e:
            logger.error(f"Failed to load {file_path.name}: {e}")
            # Continue loading other files
            continue

    return merged_data


def load_scopes() -> Dict[str, Dict[str, List[str]]]:
    """
    Load scope definitions from data/scopes/*.yaml files.

    Each scope type (character, title, province, etc.) defines:
    - links: Valid scope navigation targets (e.g., liege, spouse, father)
    - lists: Valid list iterations (e.g., vassal, courtier, child)
    - triggers: Valid triggers in this scope (e.g., is_adult, has_trait)
    - effects: Valid effects in this scope (e.g., add_gold, add_trait)

    Returns:
        Dictionary mapping scope types to their definitions
        Example:
        {
            'character': {
                'links': ['liege', 'spouse', 'father', ...],
                'lists': ['vassal', 'courtier', 'child', ...],
                'triggers': ['is_adult', 'is_alive', 'has_trait', ...],
                'effects': ['add_gold', 'add_prestige', 'death', ...]
            },
            ...
        }
    """
    scopes_dir = DATA_DIR / "scopes"
    return load_all_files_in_directory(scopes_dir)


def load_effects() -> Dict[str, Dict[str, Any]]:
    """
    Load effect definitions from data/effects/*.yaml files.

    Each effect defines:
    - description: Human-readable description
    - scopes: List of valid scope types
    - parameters: Expected parameters (optional)

    Returns:
        Dictionary mapping effect names to their definitions
    """
    effects_dir = DATA_DIR / "effects"
    return load_all_files_in_directory(effects_dir)


def load_triggers() -> Dict[str, Dict[str, Any]]:
    """
    Load trigger definitions from data/triggers/*.yaml files.

    Each trigger defines:
    - description: Human-readable description
    - scopes: List of valid scope types
    - parameters: Expected parameters (optional)

    Returns:
        Dictionary mapping trigger names to their definitions
    """
    triggers_dir = DATA_DIR / "triggers"
    return load_all_files_in_directory(triggers_dir)


def load_traits() -> Dict[str, Dict[str, Any]]:
    """
    Load trait definitions from data/traits/*.yaml files.

    Each trait defines:
    - category: Trait category (personality, lifestyle, health, etc.)
    - opposites: List of opposing traits
    - description: Human-readable description
    - modifiers: Effects of having this trait (optional)

    Returns:
        Dictionary mapping trait names to their definitions
    """
    traits_dir = DATA_DIR / "traits"
    return load_all_files_in_directory(traits_dir)


# Cached data to avoid reloading on every request
_scopes_cache: Optional[Dict[str, Dict[str, List[str]]]] = None
_effects_cache: Optional[Dict[str, Dict[str, Any]]] = None
_triggers_cache: Optional[Dict[str, Dict[str, Any]]] = None
_traits_cache: Optional[Dict[str, Dict[str, Any]]] = None


def get_scopes(use_cache: bool = True) -> Dict[str, Dict[str, List[str]]]:
    """
    Get scope definitions, using cache if available.

    Args:
        use_cache: Whether to use cached data (default: True)

    Returns:
        Scope definitions dictionary
    """
    global _scopes_cache

    if not use_cache or _scopes_cache is None:
        _scopes_cache = load_scopes()

    return _scopes_cache


def get_effects(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """Get effect definitions, using cache if available."""
    global _effects_cache

    if not use_cache or _effects_cache is None:
        _effects_cache = load_effects()

    return _effects_cache


def get_triggers(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """Get trigger definitions, using cache if available."""
    global _triggers_cache

    if not use_cache or _triggers_cache is None:
        _triggers_cache = load_triggers()

    return _triggers_cache


def get_traits(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """Get trait definitions, using cache if available."""
    global _traits_cache

    if not use_cache or _traits_cache is None:
        _traits_cache = load_traits()

    return _traits_cache


def clear_cache():
    """Clear all cached data. Useful for testing or reloading data."""
    global _scopes_cache, _effects_cache, _triggers_cache, _traits_cache
    _scopes_cache = None
    _effects_cache = None
    _triggers_cache = None
    _traits_cache = None
