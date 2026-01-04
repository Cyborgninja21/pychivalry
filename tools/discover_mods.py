#!/usr/bin/env python3
"""
Discover and extract data from installed CK3 mods.

Scans standard mod locations for known mods (Carnalitas, etc.) and extracts
their trait, trigger, effect, and scope definitions for LSP validation.

Usage:
    python tools/discover_mods.py
    python tools/discover_mods.py --mod-path "/custom/mod/path"
    python tools/discover_mods.py --list  # Just list discovered mods
    python tools/discover_mods.py --mod carnalitas  # Extract specific mod

This script uses the mod_registry.yaml to identify and extract from mods.
Extracted data is saved to ~/.pychivalry/mod_cache.json for LSP use.
"""

import argparse
import json
import hashlib
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML not installed. Run: pip install pyyaml")
    sys.exit(1)


# Standard mod locations
def get_mod_search_paths() -> List[Path]:
    """Get standard mod installation paths based on OS."""
    paths = []
    
    home = Path.home()
    
    # Windows paths
    paths.append(home / "Documents" / "Paradox Interactive" / "Crusader Kings III" / "mod")
    
    # Linux paths
    paths.append(home / ".local" / "share" / "Paradox Interactive" / "Crusader Kings III" / "mod")
    
    # macOS paths
    paths.append(home / "Documents" / "Paradox Interactive" / "Crusader Kings III" / "mod")
    
    # Steam Workshop (Windows)
    paths.append(Path("C:/Program Files (x86)/Steam/steamapps/workshop/content/1158310"))
    
    # Steam Workshop (Linux)
    paths.append(home / ".local" / "share" / "Steam" / "steamapps" / "workshop" / "content" / "1158310")
    
    return [p for p in paths if p.exists()]


@dataclass
class ModInfo:
    """Information about a discovered mod."""
    mod_id: str
    name: str
    path: Path
    version: Optional[str] = None
    checksum: Optional[str] = None


@dataclass
class ExtractedData:
    """Data extracted from a mod."""
    traits: List[str]
    triggers: List[str]
    effects: List[str]
    scopes: List[str]
    opinion_modifiers: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ModDiscovery:
    """Discovers and extracts data from CK3 mods."""
    
    def __init__(self, registry_path: Optional[Path] = None, verbose: bool = True):
        self.verbose = verbose
        
        # Find registry path
        if registry_path is None:
            # Look relative to this script
            script_dir = Path(__file__).parent.parent
            registry_path = script_dir / "pychivalry" / "data" / "mods" / "mod_registry.yaml"
        
        if not registry_path.exists():
            raise FileNotFoundError(f"Mod registry not found: {registry_path}")
        
        self.registry_path = registry_path
        self.registry = self._load_registry()
        
        # Cache directory
        self.cache_dir = Path.home() / ".pychivalry"
        self.cache_file = self.cache_dir / "mod_cache.json"
        self.cache_dir.mkdir(exist_ok=True)
        
        self._log(f"Loaded mod registry from {registry_path}")
        self._log(f"Cache directory: {self.cache_dir}")
    
    def _log(self, message: str) -> None:
        """Print log message if verbose."""
        if self.verbose:
            self._safe_print(f"[INFO] {message}")
    
    def _warn(self, message: str) -> None:
        """Print warning message."""
        self._safe_print(f"[WARN] {message}")
    
    def _error(self, message: str) -> None:
        """Print error message."""
        self._safe_print(f"[ERROR] {message}")
    
    def _safe_print(self, message: str) -> None:
        """Print message with safe encoding for Windows console."""
        try:
            print(message)
        except UnicodeEncodeError:
            # Fall back to ASCII-safe version
            print(message.encode('ascii', 'replace').decode('ascii'))
    
    def _load_registry(self) -> Dict[str, Any]:
        """Load the mod registry YAML file."""
        with open(self.registry_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _load_cache(self) -> Dict[str, Any]:
        """Load the mod cache."""
        if self.cache_file.exists():
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _save_cache(self, cache: Dict[str, Any]) -> None:
        """Save the mod cache."""
        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2)
    
    def _calculate_checksum(self, mod_path: Path) -> str:
        """Calculate checksum for mod files to detect changes."""
        hasher = hashlib.md5()
        
        # Hash key files that indicate mod changes
        key_patterns = [
            "descriptor.mod",
            "common/traits/**/*.txt",
            "common/scripted_triggers/**/*.txt",
            "common/scripted_effects/**/*.txt",
        ]
        
        for pattern in key_patterns:
            for file_path in mod_path.glob(pattern):
                if file_path.is_file():
                    hasher.update(file_path.name.encode())
                    hasher.update(str(file_path.stat().st_mtime).encode())
        
        return hasher.hexdigest()
    
    def _identify_mod(self, folder_path: Path) -> Optional[str]:
        """
        Identify if a folder matches a known mod from the registry.
        
        Returns mod_id if identified, None otherwise.
        """
        folder_name = folder_path.name.lower()
        
        for mod_id, mod_config in self.registry.get('mods', {}).items():
            identifiers = mod_config.get('identifiers', {})
            
            # Check folder name patterns
            folder_patterns = identifiers.get('folder_patterns', [])
            for pattern in folder_patterns:
                if re.match(pattern.lower(), folder_name):
                    # Verify required files exist
                    required_files = identifiers.get('required_files', [])
                    if all((folder_path / rf).exists() for rf in required_files):
                        return mod_id
        
        return None
    
    def discover_mods(self, additional_paths: Optional[List[Path]] = None, scan_all: bool = False,
                       exclude_paths: Optional[List[Path]] = None) -> List[ModInfo]:
        """
        Discover installed mods.
        
        Args:
            additional_paths: Additional paths to search for mods
            scan_all: If True, discover ALL mods (not just registered ones)
            exclude_paths: Paths to exclude (e.g., mods being developed)
            
        Returns:
            List of discovered mod info
        """
        search_paths = get_mod_search_paths()
        if additional_paths:
            search_paths.extend(additional_paths)
        
        # Normalize exclude paths for comparison
        exclude_set = {p.resolve() for p in (exclude_paths or [])}
        
        self._log(f"Searching {len(search_paths)} locations for mods...")
        if exclude_set:
            self._log(f"  Excluding {len(exclude_set)} path(s): {[str(p) for p in exclude_set]}")
        
        discovered = []
        seen_paths: Set[Path] = set()
        
        for search_path in search_paths:
            if not search_path.exists():
                continue
            
            # Skip if we've already searched this path (handles duplicates in search_paths)
            if search_path in seen_paths:
                continue
            seen_paths.add(search_path)
            
            self._log(f"  Scanning: {search_path}")
            
            # Check each subdirectory
            for item in search_path.iterdir():
                if not item.is_dir():
                    continue
                
                # Skip if we've already found this mod path
                if item in seen_paths:
                    continue
                
                # Skip excluded paths (mods being developed)
                if item.resolve() in exclude_set:
                    self._log(f"    [SKIP] Excluding workspace mod: {item.name}")
                    continue
                
                # Try to identify as registered mod first
                mod_id = self._identify_mod(item)
                if mod_id:
                    seen_paths.add(item)
                    mod_config = self.registry['mods'][mod_id]
                    
                    mod_info = ModInfo(
                        mod_id=mod_id,
                        name=mod_config.get('display_name', mod_id),
                        path=item,
                        version=self._get_mod_version(item),
                        checksum=self._calculate_checksum(item)
                    )
                    
                    discovered.append(mod_info)
                    self._log(f"    [+] Found (registered): {mod_info.name} ({mod_id}) at {item}")
                elif scan_all:
                    # Check if it looks like a CK3 mod
                    mod_info = self._identify_generic_mod(item)
                    if mod_info:
                        seen_paths.add(item)
                        discovered.append(mod_info)
                        self._log(f"    [+] Found (unregistered): {mod_info.name} at {item}")
        
        return discovered
    
    def _identify_generic_mod(self, folder_path: Path) -> Optional[ModInfo]:
        """
        Identify a generic CK3 mod from its folder.
        
        Returns ModInfo if it looks like a valid CK3 mod, None otherwise.
        """
        # Check for descriptor.mod (required for CK3 mods)
        descriptor = folder_path / "descriptor.mod"
        if not descriptor.exists():
            # Also check for .mod files in the folder
            mod_files = list(folder_path.glob("*.mod"))
            if not mod_files:
                return None
            descriptor = mod_files[0]
        
        # Parse descriptor for mod name
        try:
            content = descriptor.read_text(encoding='utf-8')
        except Exception:
            return None
        
        # Extract mod name from descriptor
        name_match = re.search(r'name\s*=\s*"([^"]+)"', content)
        mod_name = name_match.group(1) if name_match else folder_path.name
        
        # Create a sanitized mod_id from the folder name
        mod_id = re.sub(r'[^a-z0-9_]', '_', folder_path.name.lower())
        mod_id = re.sub(r'_+', '_', mod_id).strip('_')
        if not mod_id:
            mod_id = "unknown_mod"
        
        # Mark as unregistered for extraction purposes
        mod_id = f"_unregistered_{mod_id}"
        
        return ModInfo(
            mod_id=mod_id,
            name=mod_name,
            path=folder_path,
            version=self._get_mod_version(folder_path),
            checksum=self._calculate_checksum(folder_path)
        )
        
        return discovered
    
    def _get_mod_version(self, mod_path: Path) -> Optional[str]:
        """Extract version from descriptor.mod if available."""
        descriptor = mod_path / "descriptor.mod"
        if descriptor.exists():
            try:
                content = descriptor.read_text(encoding='utf-8')
                match = re.search(r'version\s*=\s*"([^"]+)"', content)
                if match:
                    return match.group(1)
            except Exception:
                pass
        return None
    
    def _get_generic_extraction_rules(self) -> Dict[str, Any]:
        """
        Return generic extraction rules for unregistered mods.
        
        These rules extract ALL traits, triggers, and effects without prefix filtering.
        """
        return {
            'traits': {
                'sources': [
                    {
                        'path': 'common/traits/*.txt',
                        'pattern': r'^([a-z_][a-z0-9_]*)\s*=\s*\{',
                        'include_prefixes': [],  # No filtering - get all
                    }
                ]
            },
            'triggers': {
                'sources': [
                    {
                        'path': 'common/scripted_triggers/*.txt',
                        'pattern': r'^([a-z_][a-z0-9_]*)\s*=\s*\{',
                        'include_prefixes': [],
                    }
                ]
            },
            'effects': {
                'sources': [
                    {
                        'path': 'common/scripted_effects/*.txt',
                        'pattern': r'^([a-z_][a-z0-9_]*)\s*=\s*\{',
                        'include_prefixes': [],
                    }
                ]
            },
            'opinion_modifiers': {
                'sources': [
                    {
                        'path': 'common/opinion_modifiers/*.txt',
                        'pattern': r'^([a-z_][a-z0-9_]*)\s*=\s*\{',
                        'include_prefixes': [],
                    }
                ]
            },
            'scopes': {
                'sources': [
                    {
                        'path': 'common/scripted_relations/*.txt',
                        'pattern': r'^([a-z_][a-z0-9_]*)\s*=\s*\{',
                        'include_prefixes': [],
                    }
                ]
            },
        }
    
    def _extract_definitions(self, mod_path: Path, extraction_rules: Dict[str, Any]) -> ExtractedData:
        """
        Extract definitions from mod files using registry rules.
        
        Args:
            mod_path: Path to the mod
            extraction_rules: Extraction rules from registry
            
        Returns:
            ExtractedData with all extracted definitions
        """
        result = ExtractedData(
            traits=[],
            triggers=[],
            effects=[],
            scopes=[],
            opinion_modifiers=[]
        )
        
        # Map extraction rule keys to result attributes
        type_mapping = {
            'traits': 'traits',
            'triggers': 'triggers',
            'effects': 'effects',
            'scopes': 'scopes',
            'opinion_modifiers': 'opinion_modifiers',
            'relations': 'scopes',  # Relations go to scopes
        }
        
        for rule_type, attr_name in type_mapping.items():
            rule_config = extraction_rules.get(rule_type, {})
            sources = rule_config.get('sources', [])
            
            for source in sources:
                path_pattern = source.get('path')
                regex_pattern = source.get('pattern', r'^([a-z_][a-z0-9_]*)\s*=\s*\{')
                include_prefixes = source.get('include_prefixes', [])
                
                if not path_pattern:
                    continue
                
                # Find matching files
                for file_path in mod_path.glob(path_pattern):
                    if not file_path.is_file():
                        continue
                    
                    try:
                        content = file_path.read_text(encoding='utf-8')
                        
                        # Apply regex to extract names
                        matches = re.findall(regex_pattern, content, re.MULTILINE)
                        
                        for match in matches:
                            name = match if isinstance(match, str) else match[0]
                            
                            # Filter by prefix if specified
                            if include_prefixes:
                                if not any(name.startswith(p) for p in include_prefixes):
                                    continue
                            
                            # Add to appropriate list
                            target_list = getattr(result, attr_name, None)
                            if target_list is not None and name not in target_list:
                                target_list.append(name)
                    
                    except Exception as e:
                        self._warn(f"Error reading {file_path}: {e}")
            
            # Also add manual additions if specified
            manual_additions = rule_config.get('manual_additions', [])
            target_list = getattr(result, attr_name, None)
            if target_list is not None:
                for name in manual_additions:
                    if name not in target_list:
                        target_list.append(name)
        
        return result
    
    def extract_mod(self, mod_info: ModInfo, force: bool = False) -> ExtractedData:
        """
        Extract data from a specific mod.
        
        Args:
            mod_info: Information about the mod to extract
            force: If True, ignore cache and re-extract
            
        Returns:
            Extracted data from the mod
        """
        cache = self._load_cache()
        
        # Check cache
        if not force and mod_info.mod_id in cache:
            cached = cache[mod_info.mod_id]
            if cached.get('checksum') == mod_info.checksum:
                self._log(f"Using cached data for {mod_info.name}")
                return ExtractedData(
                    traits=cached.get('traits', []),
                    triggers=cached.get('triggers', []),
                    effects=cached.get('effects', []),
                    scopes=cached.get('scopes', []),
                    opinion_modifiers=cached.get('opinion_modifiers', [])
                )
        
        self._log(f"Extracting data from {mod_info.name}...")
        
        # Get extraction rules from registry, or use generic rules for unregistered mods
        if mod_info.mod_id.startswith('_unregistered_'):
            extraction_rules = self._get_generic_extraction_rules()
        else:
            mod_config = self.registry['mods'].get(mod_info.mod_id, {})
            extraction_rules = mod_config.get('extraction_rules', {})
        
        # Extract definitions
        data = self._extract_definitions(mod_info.path, extraction_rules)
        
        # Count what we found
        self._log(f"  Traits: {len(data.traits)}")
        self._log(f"  Triggers: {len(data.triggers)}")
        self._log(f"  Effects: {len(data.effects)}")
        self._log(f"  Scopes: {len(data.scopes)}")
        self._log(f"  Opinion modifiers: {len(data.opinion_modifiers)}")
        
        # Update cache
        cache[mod_info.mod_id] = {
            'checksum': mod_info.checksum,
            'extracted_at': datetime.now().isoformat(),
            'version': mod_info.version,
            'path': str(mod_info.path),
            **data.to_dict()
        }
        self._save_cache(cache)
        
        return data
    
    def discover_and_extract_all(self, additional_paths: Optional[List[Path]] = None, 
                                  force: bool = False, scan_all: bool = False,
                                  exclude_paths: Optional[List[Path]] = None) -> Dict[str, ExtractedData]:
        """
        Discover all mods and extract their data.
        
        Args:
            additional_paths: Additional paths to search
            force: Force re-extraction even if cached
            scan_all: If True, scan ALL mods (not just registered ones)
            exclude_paths: Paths to exclude (e.g., mods being developed)
            
        Returns:
            Dictionary mapping mod_id to extracted data
        """
        mods = self.discover_mods(additional_paths, scan_all=scan_all, exclude_paths=exclude_paths)
        
        if not mods:
            self._log("No mods found in standard locations.")
            return {}
        
        results = {}
        for mod_info in mods:
            try:
                data = self.extract_mod(mod_info, force=force)
                results[mod_info.mod_id] = data
            except Exception as e:
                self._error(f"Failed to extract {mod_info.name}: {e}")
        
        # Clean up stale cache entries for removed mods
        self._cleanup_stale_cache(set(results.keys()))
        
        return results
    
    def _cleanup_stale_cache(self, discovered_mod_ids: Set[str]) -> None:
        """
        Remove cache entries for mods that are no longer installed.
        
        Args:
            discovered_mod_ids: Set of mod IDs that were found during discovery
        """
        cache = self._load_cache()
        cached_mod_ids = set(cache.keys())
        
        # Find mods that are cached but no longer installed
        stale_mods = cached_mod_ids - discovered_mod_ids
        
        if stale_mods:
            self._log(f"\nCleaning up {len(stale_mods)} removed mod(s) from cache:")
            for mod_id in stale_mods:
                cached_path = cache[mod_id].get('path', 'unknown')
                self._log(f"  🗑️  Removing: {mod_id} (was at {cached_path})")
                del cache[mod_id]
            
            self._save_cache(cache)
            self._log(f"Cache cleaned. {len(cache)} mod(s) remaining.")
    
    def clear_cache(self) -> None:
        """Clear all cached mod data."""
        if self.cache_file.exists():
            self.cache_file.unlink()
            self._log("Cache cleared.")
        else:
            self._log("No cache file to clear.")
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of cached mod data."""
        cache = self._load_cache()
        
        summary = {
            'cached_mods': len(cache),
            'mods': {}
        }
        
        for mod_id, data in cache.items():
            summary['mods'][mod_id] = {
                'version': data.get('version'),
                'extracted_at': data.get('extracted_at'),
                'traits': len(data.get('traits', [])),
                'triggers': len(data.get('triggers', [])),
                'effects': len(data.get('effects', [])),
                'scopes': len(data.get('scopes', [])),
                'opinion_modifiers': len(data.get('opinion_modifiers', []))
            }
        
        return summary


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Discover and extract data from installed CK3 mods.'
    )
    parser.add_argument(
        '--mod-path', '-p',
        type=Path,
        action='append',
        help='Additional mod folder path to search'
    )
    parser.add_argument(
        '--mod', '-m',
        type=str,
        help='Extract specific mod by ID (e.g., carnalitas)'
    )
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='Only list discovered mods without extracting'
    )
    parser.add_argument(
        '--force', '-f',
        action='store_true',
        help='Force re-extraction even if cached'
    )
    parser.add_argument(
        '--summary', '-s',
        action='store_true',
        help='Show summary of cached mod data'
    )
    parser.add_argument(
        '--clean',
        action='store_true',
        help='Clean up cache entries for removed mods'
    )
    parser.add_argument(
        '--clear-cache',
        action='store_true',
        help='Clear all cached mod data'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Quiet mode (minimal output)'
    )
    parser.add_argument(
        '--all', '-a',
        action='store_true',
        help='Scan ALL mods (not just registered ones)'
    )
    parser.add_argument(
        '--exclude', '-e',
        type=Path,
        action='append',
        help='Exclude mod paths (e.g., mods you are developing)'
    )
    parser.add_argument(
        '--output', '-o',
        type=Path,
        help='Output JSON file for results'
    )
    
    args = parser.parse_args()
    
    try:
        discovery = ModDiscovery(verbose=not args.quiet)
        
        # Clear cache mode
        if args.clear_cache:
            discovery.clear_cache()
            return 0
        
        # Summary mode
        if args.summary:
            summary = discovery.get_summary()
            print(json.dumps(summary, indent=2))
            return 0
        
        # Gather additional paths
        additional_paths = args.mod_path or []
        exclude_paths = [p.resolve() for p in (args.exclude or [])]
        
        # Clean mode - just clean up stale entries without full extraction
        if args.clean:
            mods = discovery.discover_mods(additional_paths, scan_all=args.all, exclude_paths=exclude_paths)
            discovered_ids = {m.mod_id for m in mods}
            discovery._cleanup_stale_cache(discovered_ids)
            print(f"\n[OK] Cache cleanup complete. {len(discovered_ids)} active mod(s) found.")
            return 0
        
        # List mode
        if args.list:
            mods = discovery.discover_mods(additional_paths, scan_all=args.all, exclude_paths=exclude_paths)
            mod_type = "all" if args.all else "registered"
            print(f"\nDiscovered {len(mods)} {mod_type} mod(s):\n")
            for mod in mods:
                registered = "" if mod.mod_id.startswith('_unregistered_') else " [registered]"
                print(f"  - {mod.name}{registered}")
                print(f"    ID: {mod.mod_id}")
                print(f"    Path: {mod.path}")
                if mod.version:
                    print(f"    Version: {mod.version}")
                print()
            return 0
        
        # Extract specific mod
        if args.mod:
            mods = discovery.discover_mods(additional_paths, scan_all=args.all, exclude_paths=exclude_paths)
            target = next((m for m in mods if m.mod_id == args.mod), None)
            
            if not target:
                print(f"ERROR: Mod '{args.mod}' not found in any search location.")
                return 1
            
            data = discovery.extract_mod(target, force=args.force)
            
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump({args.mod: data.to_dict()}, f, indent=2)
                print(f"\nResults written to {args.output}")
            
            return 0
        
        # Extract all mods
        results = discovery.discover_and_extract_all(additional_paths, force=args.force, 
                                                      scan_all=args.all, exclude_paths=exclude_paths)
        
        if results:
            print(f"\n[OK] Successfully extracted data from {len(results)} mod(s)!")
            
            if args.output:
                output_data = {mod_id: data.to_dict() for mod_id, data in results.items()}
                with open(args.output, 'w') as f:
                    json.dump(output_data, f, indent=2)
                print(f"Results written to {args.output}")
            
            # Print summary
            total_traits = sum(len(d.traits) for d in results.values())
            total_triggers = sum(len(d.triggers) for d in results.values())
            total_effects = sum(len(d.effects) for d in results.values())
            
            print(f"\nTotal extracted:")
            print(f"  Traits: {total_traits}")
            print(f"  Triggers: {total_triggers}")
            print(f"  Effects: {total_effects}")
        else:
            print("\nNo mods were extracted.")
            return 1
        
        return 0
        
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        return 1
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
