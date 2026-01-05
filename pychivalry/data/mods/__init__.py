"""
Mod-specific data loader for PyChivalry.

This module handles loading optional mod support data (traits, triggers, effects, etc.)
from external CK3 mods like Carnalitas. We do NOT ship mod content - we dynamically
discover and extract it from the user's installed mods.

Architecture:
    1. mod_registry.yaml - Defines known mods and how to extract their data
    2. scanner.py - Discovers installed mods and extracts game data
    3. __init__.py (this file) - High-level API for enabling/querying mod data

Usage:
    from pychivalry.data.mods import get_mod_loader
    
    loader = get_mod_loader()
    loader.auto_discover()  # Scan for installed mods
    
    # Check what's available
    print(loader.get_discovered_mods())
    
    # Get all traits from discovered mods
    mod_traits = loader.get_all_traits()
"""

from pathlib import Path
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

# Path to mods data directory
MODS_DATA_DIR = Path(__file__).parent

# Registry of available mods (for backwards compatibility with static data)
AVAILABLE_MODS = {
    "carnalitas": {
        "name": "Carnalitas",
        "description": "Adult content framework mod providing slavery, prostitution, and relationship systems",
        "version": "2.x",
        "folder": "carnalitas",
    },
    "carnalitas_dei": {
        "name": "Carnalitas Dei",
        "description": "Religious integration for Carnalitas",
        "folder": "carnalitas_dei",
    },
}


class ModDataLoader:
    """
    Loader for mod-specific game data.
    
    This class provides two modes of operation:
    1. Static mode: Load from bundled YAML files (fallback)
    2. Dynamic mode: Discover and scan actual installed mods (preferred)
    
    Dynamic mode is preferred as it:
    - Doesn't require shipping other people's mod content
    - Automatically picks up mod updates
    - Works with any version of supported mods
    """
    
    def __init__(self):
        self._enabled_mods: set[str] = set()
        self._cache: dict[str, dict[str, Any]] = {}
        self._yaml_loader: Optional[Any] = None
        self._scanner: Optional[Any] = None
        self._use_dynamic: bool = True  # Prefer dynamic discovery
    
    def _get_yaml_loader(self):
        """Lazy load YAML to avoid circular imports."""
        if self._yaml_loader is None:
            try:
                import yaml
                self._yaml_loader = yaml
            except ImportError:
                logger.warning("PyYAML not available, mod data loading disabled")
                return None
        return self._yaml_loader
    
    def _get_scanner(self):
        """Lazy load the mod scanner."""
        if self._scanner is None:
            try:
                from pychivalry.data.mods.scanner import ModScanner
                self._scanner = ModScanner()
            except ImportError as e:
                logger.warning(f"Mod scanner not available: {e}")
                self._use_dynamic = False
                return None
        return self._scanner
    
    def auto_discover(self, custom_paths: list[str] | None = None) -> dict[str, Any]:
        """
        Automatically discover and enable all installed mods.
        
        Args:
            custom_paths: Additional paths to search for mods
        
        Returns:
            Dictionary of discovered mod IDs to their info
        """
        scanner = self._get_scanner()
        if not scanner:
            return {}
        
        if custom_paths:
            scanner._custom_search_paths.extend(custom_paths)
        
        discovered = scanner.discover_mods()
        
        # Auto-enable all discovered mods
        for mod_id in discovered:
            self._enabled_mods.add(mod_id)
            logger.info(f"Auto-enabled mod: {mod_id}")
        
        return {mod_id: {"name": info.display_name, "path": str(info.path)} 
                for mod_id, info in discovered.items()}
    
    def get_discovered_mods(self) -> dict[str, dict[str, str]]:
        """Return list of discovered mods with their paths."""
        scanner = self._get_scanner()
        if not scanner or not scanner._discovered_mods:
            return {}
        
        return {
            mod_id: {
                "name": info.display_name,
                "path": str(info.path),
                "enabled": mod_id in self._enabled_mods
            }
            for mod_id, info in scanner._discovered_mods.items()
        }
    
    def get_available_mods(self) -> dict[str, dict[str, str]]:
        """Return list of available mod support packages."""
        return AVAILABLE_MODS.copy()
    
    def enable_mod(self, mod_id: str) -> bool:
        """
        Enable support for a specific mod.
        
        Args:
            mod_id: Identifier for the mod (e.g., 'carnalitas')
            
        Returns:
            True if mod was enabled successfully
        """
        # Try dynamic discovery first
        scanner = self._get_scanner()
        if scanner and self._use_dynamic:
            if not scanner._discovered_mods:
                scanner.discover_mods()
            
            if mod_id in scanner._discovered_mods:
                self._enabled_mods.add(mod_id)
                self._cache.pop(mod_id, None)
                logger.info(f"Enabled mod (dynamic): {mod_id}")
                return True
        
        # Fall back to static data
        if mod_id not in AVAILABLE_MODS:
            logger.warning(f"Unknown mod: {mod_id}")
            return False
        
        mod_path = MODS_DATA_DIR / AVAILABLE_MODS[mod_id]["folder"]
        if not mod_path.exists():
            logger.warning(f"Mod data not found: {mod_path}")
            return False
        
        self._enabled_mods.add(mod_id)
        self._cache.pop(mod_id, None)
        logger.info(f"Enabled mod (static): {AVAILABLE_MODS[mod_id]['name']}")
        return True
    
    def disable_mod(self, mod_id: str) -> None:
        """Disable support for a specific mod."""
        self._enabled_mods.discard(mod_id)
        self._cache.pop(mod_id, None)
    
    def is_mod_enabled(self, mod_id: str) -> bool:
        """Check if a mod is currently enabled."""
        return mod_id in self._enabled_mods
    
    def get_enabled_mods(self) -> set[str]:
        """Return set of currently enabled mod IDs."""
        return self._enabled_mods.copy()
    
    # =========================================================================
    # STATIC DATA LOADING (Fallback)
    # =========================================================================
    
    def _load_yaml_file(self, mod_id: str, filename: str) -> dict[str, Any]:
        """Load a YAML file from a mod's static data folder."""
        yaml = self._get_yaml_loader()
        if yaml is None:
            return {}
        
        if mod_id not in AVAILABLE_MODS:
            return {}
        
        filepath = MODS_DATA_DIR / AVAILABLE_MODS[mod_id]["folder"] / filename
        if not filepath.exists():
            return {}
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                return data if data else {}
        except Exception as e:
            logger.error(f"Error loading {filepath}: {e}")
            return {}
    
    # =========================================================================
    # DATA ACCESS METHODS
    # =========================================================================
    
    def get_mod_traits(self, mod_id: str) -> dict[str, Any]:
        """Get traits defined by a specific mod."""
        # Try dynamic first
        scanner = self._get_scanner()
        if scanner and self._use_dynamic and mod_id in scanner._discovered_mods:
            return scanner.get_mod_traits(mod_id)
        
        # Fall back to static
        cache_key = f"{mod_id}_traits"
        if cache_key not in self._cache:
            self._cache[cache_key] = self._load_yaml_file(mod_id, "traits.yaml")
        return self._cache[cache_key]
    
    def get_mod_triggers(self, mod_id: str) -> dict[str, Any]:
        """Get triggers defined by a specific mod."""
        scanner = self._get_scanner()
        if scanner and self._use_dynamic and mod_id in scanner._discovered_mods:
            return scanner.get_mod_triggers(mod_id)
        
        cache_key = f"{mod_id}_triggers"
        if cache_key not in self._cache:
            self._cache[cache_key] = self._load_yaml_file(mod_id, "triggers.yaml")
        return self._cache[cache_key]
    
    def get_mod_effects(self, mod_id: str) -> dict[str, Any]:
        """Get effects defined by a specific mod."""
        scanner = self._get_scanner()
        if scanner and self._use_dynamic and mod_id in scanner._discovered_mods:
            return scanner.get_mod_effects(mod_id)
        
        cache_key = f"{mod_id}_effects"
        if cache_key not in self._cache:
            self._cache[cache_key] = self._load_yaml_file(mod_id, "effects.yaml")
        return self._cache[cache_key]
    
    def get_mod_scopes(self, mod_id: str) -> dict[str, Any]:
        """Get scope links defined by a specific mod."""
        cache_key = f"{mod_id}_scopes"
        if cache_key not in self._cache:
            self._cache[cache_key] = self._load_yaml_file(mod_id, "scopes.yaml")
        return self._cache[cache_key]
    
    def get_mod_opinion_modifiers(self, mod_id: str) -> dict[str, Any]:
        """Get opinion modifiers defined by a specific mod."""
        cache_key = f"{mod_id}_opinion_modifiers"
        if cache_key not in self._cache:
            self._cache[cache_key] = self._load_yaml_file(mod_id, "opinion_modifiers.yaml")
        return self._cache[cache_key]
    
    # =========================================================================
    # AGGREGATE METHODS (All Enabled Mods)
    # =========================================================================
    
    def get_all_traits(self) -> dict[str, Any]:
        """Get traits from all enabled mods, merged together."""
        result = {}
        for mod_id in self._enabled_mods:
            result.update(self.get_mod_traits(mod_id))
        return result
    
    def get_all_triggers(self) -> dict[str, Any]:
        """Get triggers from all enabled mods, merged together."""
        result = {}
        for mod_id in self._enabled_mods:
            result.update(self.get_mod_triggers(mod_id))
        return result
    
    def get_all_effects(self) -> dict[str, Any]:
        """Get effects from all enabled mods, merged together."""
        result = {}
        for mod_id in self._enabled_mods:
            result.update(self.get_mod_effects(mod_id))
        return result
    
    def get_all_scopes(self) -> dict[str, Any]:
        """Get scope links from all enabled mods, merged together."""
        result = {}
        for mod_id in self._enabled_mods:
            result.update(self.get_mod_scopes(mod_id))
        return result
    
    def get_all_opinion_modifiers(self) -> dict[str, Any]:
        """Get opinion modifiers from all enabled mods, merged together."""
        result = {}
        for mod_id in self._enabled_mods:
            result.update(self.get_mod_opinion_modifiers(mod_id))
        return result
    
    # =========================================================================
    # SOURCE LOOKUP (Which mod provides an identifier?)
    # =========================================================================
    
    def get_source_mod(self, identifier: str, identifier_type: str = "any") -> tuple[str, str] | None:
        """
        Look up which mod provides a specific identifier.
        
        If multiple mods define the same identifier, returns the first one found.
        Use get_all_source_mods() to detect conflicts.
        
        Args:
            identifier: The trait/trigger/effect/etc. name to look up
            identifier_type: Type to search ("trait", "trigger", "effect", 
                           "scope", "opinion_modifier", or "any")
        
        Returns:
            Tuple of (mod_id, display_name) or None if not from any mod
        
        Examples:
            >>> loader.get_source_mod("carn_sex_scene_effect")
            ('carnalitas', 'Carnalitas')
            >>> loader.get_source_mod("add_gold")
            None  # Vanilla CK3
        """
        sources = self.get_all_source_mods(identifier, identifier_type)
        return sources[0] if sources else None
    
    def get_all_source_mods(self, identifier: str, identifier_type: str = "any") -> list[tuple[str, str]]:
        """
        Look up ALL mods that provide a specific identifier.
        
        Use this to detect conflicts where multiple mods define the same identifier.
        
        Args:
            identifier: The trait/trigger/effect/etc. name to look up
            identifier_type: Type to search ("trait", "trigger", "effect", 
                           "scope", "opinion_modifier", or "any")
        
        Returns:
            List of (mod_id, display_name) tuples for all mods that define this identifier.
            Empty list if not from any mod.
        
        Examples:
            >>> loader.get_all_source_mods("shared_trait")
            [('carnalitas', 'Carnalitas'), ('other_mod', 'Other Mod')]  # Conflict!
            >>> loader.get_all_source_mods("carn_sex_scene_effect")
            [('carnalitas', 'Carnalitas')]  # Single source
        """
        type_methods = {
            "trait": self.get_mod_traits,
            "trigger": self.get_mod_triggers,
            "effect": self.get_mod_effects,
            "scope": self.get_mod_scopes,
            "opinion_modifier": self.get_mod_opinion_modifiers,
        }
        
        types_to_check = [identifier_type] if identifier_type != "any" else type_methods.keys()
        sources = []
        
        for mod_id in self._enabled_mods:
            mod_def = AVAILABLE_MODS.get(mod_id, {})
            display_name = mod_def.get("name", mod_id)
            
            for check_type in types_to_check:
                if check_type not in type_methods:
                    continue
                    
                mod_data = type_methods[check_type](mod_id)
                if identifier in mod_data:
                    sources.append((mod_id, display_name))
                    break  # Found in this mod, check next mod
        
        return sources
    
    def is_from_mod(self, identifier: str, identifier_type: str = "any") -> bool:
        """Check if an identifier comes from any enabled mod."""
        return self.get_source_mod(identifier, identifier_type) is not None


# =============================================================================
# SINGLETON & CONVENIENCE FUNCTIONS
# =============================================================================

_mod_loader: Optional[ModDataLoader] = None


def get_mod_loader() -> ModDataLoader:
    """Get the global mod data loader instance."""
    global _mod_loader
    if _mod_loader is None:
        _mod_loader = ModDataLoader()
    return _mod_loader


def enable_mod(mod_id: str) -> bool:
    """Convenience function to enable a mod globally."""
    return get_mod_loader().enable_mod(mod_id)


def disable_mod(mod_id: str) -> None:
    """Convenience function to disable a mod globally."""
    get_mod_loader().disable_mod(mod_id)


def auto_discover_mods(custom_paths: list[str] | None = None) -> dict[str, Any]:
    """Convenience function to auto-discover and enable all installed mods."""
    return get_mod_loader().auto_discover(custom_paths)


def is_mod_installed(mod_id: str) -> bool:
    """Check if a mod is installed (discovered)."""
    loader = get_mod_loader()
    scanner = loader._get_scanner()
    if scanner:
        return scanner.is_mod_installed(mod_id)
    return mod_id in AVAILABLE_MODS


def get_source_mod(identifier: str, identifier_type: str = "any") -> tuple[str, str] | None:
    """
    Look up which mod provides a specific identifier.
    
    Convenience function that delegates to the mod loader.
    
    Args:
        identifier: The trait/trigger/effect/etc. name to look up
        identifier_type: Type to search ("trait", "trigger", "effect", 
                       "scope", "opinion_modifier", or "any")
    
    Returns:
        Tuple of (mod_id, display_name) or None if not from any mod
    
    Examples:
        >>> get_source_mod("carn_sex_scene_effect")
        ('carnalitas', 'Carnalitas')
        >>> get_source_mod("lifestyle_prostitute", "trait")
        ('carnalitas', 'Carnalitas')
        >>> get_source_mod("add_gold")
        None  # Vanilla CK3
    """
    return get_mod_loader().get_source_mod(identifier, identifier_type)


def is_from_mod(identifier: str, identifier_type: str = "any") -> bool:
    """Check if an identifier comes from any enabled mod."""
    return get_mod_loader().is_from_mod(identifier, identifier_type)


def get_all_source_mods(identifier: str, identifier_type: str = "any") -> list[tuple[str, str]]:
    """
    Look up ALL mods that provide a specific identifier.
    
    Use this to detect conflicts where multiple mods define the same identifier.
    
    Returns:
        List of (mod_id, display_name) tuples for all mods that define this identifier.
    """
    return get_mod_loader().get_all_source_mods(identifier, identifier_type)

