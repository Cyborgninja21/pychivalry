"""
Dynamic Mod Scanner for PyChivalry.

This module scans user's installed CK3 mods and dynamically extracts
traits, triggers, effects, and other game data. We don't ship mod content -
we discover and parse it from the user's actual mod installations.

Usage:
    from pychivalry.data.mods.scanner import ModScanner
    
    scanner = ModScanner()
    scanner.discover_mods()
    
    # Get Carnalitas data if installed
    if scanner.is_mod_installed("carnalitas"):
        traits = scanner.get_mod_traits("carnalitas")
"""

import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Path to the mod registry YAML
REGISTRY_PATH = Path(__file__).parent / "mod_registry.yaml"


@dataclass
class ModInfo:
    """Information about a discovered mod."""
    
    mod_id: str
    display_name: str
    path: Path
    descriptor_path: Path | None = None
    version: str = ""
    checksum: str = ""
    
    # Extracted data (populated on demand)
    traits: dict[str, Any] = field(default_factory=dict)
    triggers: dict[str, Any] = field(default_factory=dict)
    effects: dict[str, Any] = field(default_factory=dict)
    opinion_modifiers: dict[str, Any] = field(default_factory=dict)
    
    # State flags
    is_scanned: bool = False


class ModScanner:
    """
    Scans for and extracts data from installed CK3 mods.
    
    This class:
    1. Discovers mods in standard locations
    2. Identifies known mods using the registry
    3. Extracts game data (traits, triggers, effects) from mod files
    4. Caches results for performance
    """
    
    def __init__(self, custom_search_paths: list[str] | None = None):
        """
        Initialize the mod scanner.
        
        Args:
            custom_search_paths: Additional paths to search for mods
        """
        self._registry: dict[str, Any] = {}
        self._discovered_mods: dict[str, ModInfo] = {}
        self._custom_search_paths = custom_search_paths or []
        self._cache_dir: Path | None = None
        
        # Load the mod registry
        self._load_registry()
    
    def _load_registry(self) -> None:
        """Load the mod registry YAML file."""
        try:
            import yaml
            
            if REGISTRY_PATH.exists():
                with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                    self._registry = yaml.safe_load(f) or {}
                logger.debug(f"Loaded mod registry with {len(self._registry.get('mods', {}))} mod definitions")
            else:
                logger.warning(f"Mod registry not found: {REGISTRY_PATH}")
                self._registry = {"mods": {}, "discovery": {}, "patterns": {}}
        except Exception as e:
            logger.error(f"Failed to load mod registry: {e}")
            self._registry = {"mods": {}, "discovery": {}, "patterns": {}}
    
    def _expand_path(self, path_str: str) -> Path | None:
        """Expand environment variables and user home in a path."""
        try:
            # Expand ~ for home directory
            expanded = os.path.expanduser(path_str)
            # Expand environment variables
            expanded = os.path.expandvars(expanded)
            
            path = Path(expanded)
            if path.exists():
                return path
            return None
        except Exception:
            return None
    
    def _get_search_paths(self) -> list[Path]:
        """Get all paths to search for mods."""
        paths = []
        
        # Add custom search paths first
        for path_str in self._custom_search_paths:
            path = self._expand_path(path_str)
            if path:
                paths.append(path)
        
        # Add paths from registry
        discovery_config = self._registry.get("discovery", {})
        for path_str in discovery_config.get("search_paths", []):
            path = self._expand_path(path_str)
            if path and path not in paths:
                paths.append(path)
        
        return paths
    
    def _compute_mod_checksum(self, mod_path: Path) -> str:
        """Compute a checksum for a mod to detect changes."""
        hasher = hashlib.md5()
        
        # Hash key files that indicate mod content changed
        key_patterns = ["common/**/*.txt", "events/**/*.txt", "descriptor.mod"]
        
        for pattern in key_patterns:
            for file_path in mod_path.glob(pattern):
                if file_path.is_file():
                    try:
                        stat = file_path.stat()
                        # Use file path + size + mtime for quick hash
                        hasher.update(f"{file_path}:{stat.st_size}:{stat.st_mtime}".encode())
                    except OSError:
                        pass
        
        return hasher.hexdigest()[:16]
    
    def _identify_mod(self, mod_path: Path) -> str | None:
        """
        Try to identify a mod by checking against registry patterns.
        
        Returns:
            mod_id if identified, None otherwise
        """
        mods_config = self._registry.get("mods", {})
        
        for mod_id, mod_def in mods_config.items():
            identifiers = mod_def.get("identifiers", {})
            
            # Check folder name patterns
            folder_patterns = identifiers.get("folder_patterns", [])
            for pattern in folder_patterns:
                if mod_path.name.lower() == pattern.lower():
                    # Verify with required files if specified
                    required_files = identifiers.get("required_files", [])
                    if required_files:
                        all_present = all(
                            (mod_path / req_file).exists() or 
                            list(mod_path.glob(req_file))
                            for req_file in required_files
                        )
                        if all_present:
                            return mod_id
                    else:
                        return mod_id
            
            # Check descriptor content
            descriptor_patterns = identifiers.get("descriptor_patterns", [])
            if descriptor_patterns:
                descriptor_file = mod_path / "descriptor.mod"
                if descriptor_file.exists():
                    try:
                        content = descriptor_file.read_text(encoding="utf-8", errors="ignore")
                        for pattern in descriptor_patterns:
                            if pattern in content:
                                return mod_id
                    except OSError:
                        pass
        
        return None
    
    def discover_mods(self) -> dict[str, ModInfo]:
        """
        Scan all search paths and discover installed mods.
        
        Returns:
            Dictionary of mod_id -> ModInfo for discovered mods
        """
        self._discovered_mods.clear()
        search_paths = self._get_search_paths()
        
        logger.info(f"Scanning for mods in {len(search_paths)} locations")
        
        for search_path in search_paths:
            logger.debug(f"Scanning: {search_path}")
            
            # Check for .mod descriptor files
            for mod_file in search_path.glob("*.mod"):
                if mod_file.is_file():
                    # Parse .mod file to find actual mod path
                    mod_path = self._parse_mod_descriptor(mod_file)
                    if mod_path and mod_path.exists():
                        self._process_mod_folder(mod_path, mod_file)
            
            # Also check direct subfolders (for development mods)
            for subfolder in search_path.iterdir():
                if subfolder.is_dir() and subfolder not in [m.path for m in self._discovered_mods.values()]:
                    self._process_mod_folder(subfolder, None)
        
        logger.info(f"Discovered {len(self._discovered_mods)} known mods")
        return self._discovered_mods
    
    def _parse_mod_descriptor(self, descriptor_path: Path) -> Path | None:
        """Parse a .mod descriptor file to find the mod path."""
        try:
            content = descriptor_path.read_text(encoding="utf-8", errors="ignore")
            
            # Look for path="..." in the descriptor
            path_match = re.search(r'path\s*=\s*"([^"]+)"', content)
            if path_match:
                mod_path = Path(path_match.group(1))
                # Handle relative paths
                if not mod_path.is_absolute():
                    mod_path = descriptor_path.parent / mod_path
                return mod_path
            
            # If no path, the mod might be in a folder with same name
            mod_folder = descriptor_path.parent / descriptor_path.stem
            if mod_folder.exists():
                return mod_folder
                
        except OSError as e:
            logger.debug(f"Failed to parse descriptor {descriptor_path}: {e}")
        
        return None
    
    def _process_mod_folder(self, mod_path: Path, descriptor_path: Path | None) -> None:
        """Process a potential mod folder."""
        mod_id = self._identify_mod(mod_path)
        
        if mod_id and mod_id not in self._discovered_mods:
            mod_def = self._registry.get("mods", {}).get(mod_id, {})
            
            mod_info = ModInfo(
                mod_id=mod_id,
                display_name=mod_def.get("display_name", mod_id),
                path=mod_path,
                descriptor_path=descriptor_path,
                checksum=self._compute_mod_checksum(mod_path),
            )
            
            self._discovered_mods[mod_id] = mod_info
            logger.info(f"Found mod: {mod_info.display_name} at {mod_path}")
    
    def is_mod_installed(self, mod_id: str) -> bool:
        """Check if a mod is installed."""
        if not self._discovered_mods:
            self.discover_mods()
        return mod_id in self._discovered_mods
    
    def get_mod_path(self, mod_id: str) -> Path | None:
        """Get the installation path of a mod."""
        if mod_id in self._discovered_mods:
            return self._discovered_mods[mod_id].path
        return None
    
    def _extract_definitions(self, mod_path: Path, sources: list[dict], documented: dict | None = None) -> dict[str, Any]:
        """
        Extract definitions (traits/triggers/effects) from mod files.
        
        Args:
            mod_path: Root path of the mod
            sources: List of source configurations from registry
            documented: Optional dict of pre-documented definitions with metadata
        
        Returns:
            Dictionary of extracted definitions
        """
        results = {}
        
        # Add documented definitions first (with full metadata)
        if documented:
            for name, metadata in documented.items():
                results[name] = metadata
        
        # Scan source files
        for source in sources:
            source_path = source.get("path", "")
            pattern = source.get("pattern", "")
            include_prefixes = source.get("include_prefixes", [])
            
            if not source_path or not pattern:
                continue
            
            # Find matching files
            for file_path in mod_path.glob(source_path):
                if not file_path.is_file():
                    continue
                
                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    
                    # Find all definitions matching the pattern
                    regex = re.compile(pattern, re.MULTILINE)
                    for match in regex.finditer(content):
                        name = match.group(1)
                        
                        # Check prefix filter
                        if include_prefixes:
                            if not any(name.startswith(prefix) for prefix in include_prefixes):
                                continue
                        
                        # Add if not already documented with metadata
                        if name not in results:
                            results[name] = {
                                "source_file": str(file_path.relative_to(mod_path)),
                                "auto_extracted": True
                            }
                
                except OSError as e:
                    logger.debug(f"Failed to read {file_path}: {e}")
        
        return results
    
    def scan_mod(self, mod_id: str, force: bool = False) -> ModInfo | None:
        """
        Scan a mod and extract all game data.
        
        Args:
            mod_id: The mod identifier
            force: Force re-scan even if already scanned
        
        Returns:
            ModInfo with extracted data, or None if mod not found
        """
        if mod_id not in self._discovered_mods:
            if not self._discovered_mods:
                self.discover_mods()
            if mod_id not in self._discovered_mods:
                return None
        
        mod_info = self._discovered_mods[mod_id]
        
        if mod_info.is_scanned and not force:
            return mod_info
        
        mod_def = self._registry.get("mods", {}).get(mod_id, {})
        extraction_rules = mod_def.get("extraction_rules", {})
        
        logger.info(f"Scanning mod: {mod_info.display_name}")
        
        # Extract traits
        if "traits" in extraction_rules:
            rules = extraction_rules["traits"]
            mod_info.traits = self._extract_definitions(
                mod_info.path,
                rules.get("sources", []),
                rules.get("documented", {})
            )
            # Add manual additions
            for trait in rules.get("manual_additions", []):
                if trait not in mod_info.traits:
                    mod_info.traits[trait] = {"manual_addition": True}
            logger.debug(f"  Extracted {len(mod_info.traits)} traits")
        
        # Extract triggers
        if "triggers" in extraction_rules:
            rules = extraction_rules["triggers"]
            mod_info.triggers = self._extract_definitions(
                mod_info.path,
                rules.get("sources", []),
                rules.get("documented", {})
            )
            logger.debug(f"  Extracted {len(mod_info.triggers)} triggers")
        
        # Extract effects
        if "effects" in extraction_rules:
            rules = extraction_rules["effects"]
            mod_info.effects = self._extract_definitions(
                mod_info.path,
                rules.get("sources", []),
                rules.get("documented", {})
            )
            logger.debug(f"  Extracted {len(mod_info.effects)} effects")
        
        # Extract opinion modifiers
        if "opinion_modifiers" in extraction_rules:
            rules = extraction_rules["opinion_modifiers"]
            mod_info.opinion_modifiers = self._extract_definitions(
                mod_info.path,
                rules.get("sources", []),
                rules.get("documented", {})
            )
            logger.debug(f"  Extracted {len(mod_info.opinion_modifiers)} opinion modifiers")
        
        mod_info.is_scanned = True
        return mod_info
    
    def get_mod_traits(self, mod_id: str) -> dict[str, Any]:
        """Get traits from a mod (scans if needed)."""
        mod_info = self.scan_mod(mod_id)
        return mod_info.traits if mod_info else {}
    
    def get_mod_triggers(self, mod_id: str) -> dict[str, Any]:
        """Get triggers from a mod (scans if needed)."""
        mod_info = self.scan_mod(mod_id)
        return mod_info.triggers if mod_info else {}
    
    def get_mod_effects(self, mod_id: str) -> dict[str, Any]:
        """Get effects from a mod (scans if needed)."""
        mod_info = self.scan_mod(mod_id)
        return mod_info.effects if mod_info else {}
    
    def get_all_mod_traits(self) -> dict[str, Any]:
        """Get traits from all discovered mods."""
        result = {}
        for mod_id in self._discovered_mods:
            result.update(self.get_mod_traits(mod_id))
        return result
    
    def get_all_mod_triggers(self) -> dict[str, Any]:
        """Get triggers from all discovered mods."""
        result = {}
        for mod_id in self._discovered_mods:
            result.update(self.get_mod_triggers(mod_id))
        return result
    
    def get_all_mod_effects(self) -> dict[str, Any]:
        """Get effects from all discovered mods."""
        result = {}
        for mod_id in self._discovered_mods:
            result.update(self.get_mod_effects(mod_id))
        return result


# =============================================================================
# CACHING SYSTEM
# =============================================================================

class ModCache:
    """
    Persistent cache for extracted mod data.
    
    Stores extracted mod data to avoid re-scanning on every LSP startup.
    Uses checksums to detect when mods have changed.
    """
    
    def __init__(self, cache_dir: Path | None = None):
        """Initialize the cache."""
        if cache_dir is None:
            # Default cache location
            cache_base = os.environ.get("PYCHIVALRY_CACHE")
            if cache_base:
                cache_dir = Path(cache_base) / "mods"
            else:
                cache_dir = Path.home() / ".pychivalry" / "cache" / "mods"
        
        self._cache_dir = cache_dir
        self._cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_cache_path(self, mod_id: str) -> Path:
        """Get the cache file path for a mod."""
        return self._cache_dir / f"{mod_id}.json"
    
    def get(self, mod_id: str, checksum: str) -> dict[str, Any] | None:
        """
        Get cached mod data if valid.
        
        Returns None if cache is missing or checksum doesn't match.
        """
        cache_path = self._get_cache_path(mod_id)
        
        if not cache_path.exists():
            return None
        
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            
            if cached.get("checksum") == checksum:
                logger.debug(f"Cache hit for mod: {mod_id}")
                return cached.get("data")
            else:
                logger.debug(f"Cache stale for mod: {mod_id}")
                return None
                
        except (OSError, json.JSONDecodeError) as e:
            logger.debug(f"Failed to read cache for {mod_id}: {e}")
            return None
    
    def set(self, mod_id: str, checksum: str, data: dict[str, Any]) -> None:
        """Store mod data in cache."""
        cache_path = self._get_cache_path(mod_id)
        
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump({
                    "checksum": checksum,
                    "data": data
                }, f, indent=2)
            logger.debug(f"Cached mod data: {mod_id}")
        except OSError as e:
            logger.warning(f"Failed to write cache for {mod_id}: {e}")
    
    def clear(self, mod_id: str | None = None) -> None:
        """Clear cache for a specific mod or all mods."""
        if mod_id:
            cache_path = self._get_cache_path(mod_id)
            if cache_path.exists():
                cache_path.unlink()
        else:
            for cache_file in self._cache_dir.glob("*.json"):
                cache_file.unlink()


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_scanner: ModScanner | None = None


def get_scanner() -> ModScanner:
    """Get the global mod scanner instance."""
    global _scanner
    if _scanner is None:
        _scanner = ModScanner()
    return _scanner


def discover_mods() -> dict[str, ModInfo]:
    """Convenience function to discover all mods."""
    return get_scanner().discover_mods()


def is_mod_installed(mod_id: str) -> bool:
    """Convenience function to check if a mod is installed."""
    return get_scanner().is_mod_installed(mod_id)


def get_mod_traits(mod_id: str) -> dict[str, Any]:
    """Convenience function to get mod traits."""
    return get_scanner().get_mod_traits(mod_id)


def get_mod_triggers(mod_id: str) -> dict[str, Any]:
    """Convenience function to get mod triggers."""
    return get_scanner().get_mod_triggers(mod_id)


def get_mod_effects(mod_id: str) -> dict[str, Any]:
    """Convenience function to get mod effects."""
    return get_scanner().get_mod_effects(mod_id)
