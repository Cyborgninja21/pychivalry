"""
Document indexer for CK3 language server.

This module provides the DocumentIndex class that tracks symbols across all open
documents in the workspace. It extracts and indexes events, scripted effects,
scripted triggers, namespaces, and other CK3 constructs for cross-file navigation.

Features:
- Workspace scanning for scripted_effects and scripted_triggers folders
- Symbol indexing from parsed ASTs
- Go-to-definition support for custom effects/triggers
"""

from typing import Dict, List, Optional, Set, Callable
from lsprotocol import types
from pychivalry.parser import CK3Node, parse_document
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import os
import re

logger = logging.getLogger(__name__)


class DocumentIndex:
    """
    Track symbols across all open documents.

    This index is updated whenever a document is opened, changed, or closed.
    It enables features like:
    - Go to definition for events, scripted effects, scripted triggers
    - Find references across files
    - Workspace-wide symbol search
    - Validation of custom effects/triggers
    - Localization key lookup for hover documentation
    """

    def __init__(self):
        """Initialize empty index."""
        self.namespaces: Dict[str, str] = {}  # namespace -> file uri
        self.events: Dict[str, types.Location] = {}  # event_id -> Location
        self.scripted_effects: Dict[str, types.Location] = {}  # name -> Location
        self.scripted_triggers: Dict[str, types.Location] = {}  # name -> Location
        self.scripted_lists: Dict[str, types.Location] = {}  # name -> Location
        self.script_values: Dict[str, types.Location] = {}  # name -> Location
        self.on_actions: Dict[str, List[str]] = {}  # on_action -> event list
        self.saved_scopes: Dict[str, types.Location] = {}  # scope_name -> save Location

        # Localization: key -> (text, file_uri, line_number)
        self.localization: Dict[str, tuple] = {}

        # Character flags: flag_name -> list of (action, file_uri, line_number)
        # action is 'set' (add_character_flag) or 'check' (has_character_flag)
        self.character_flags: Dict[str, List[tuple]] = {}

        # New common/ folder indexes
        self.character_interactions: Dict[str, types.Location] = {}  # name -> Location
        self.modifiers: Dict[str, types.Location] = {}  # name -> Location
        self.on_action_definitions: Dict[str, types.Location] = (
            {}
        )  # name -> Location (actual definitions)
        self.opinion_modifiers: Dict[str, types.Location] = {}  # name -> Location
        self.scripted_guis: Dict[str, types.Location] = {}  # name -> Location

        # Track workspace roots for rescanning
        self._workspace_roots: List[str] = []

    def scan_workspace(
        self, workspace_roots: List[str], executor: Optional[ThreadPoolExecutor] = None
    ):
        """
        Scan workspace folders for scripted effects, triggers, localization, events, and flags.

        This method looks for common/scripted_effects/, common/scripted_triggers/,
        localization/, and events/ folders in each workspace root and indexes all definitions found.

        If an executor is provided, scanning is parallelized for 2-4x faster indexing.

        Args:
            workspace_roots: List of workspace folder paths
            executor: Optional ThreadPoolExecutor for parallel scanning
        """
        self._workspace_roots = workspace_roots

        if executor:
            self._scan_workspace_parallel(workspace_roots, executor)
        else:
            self._scan_workspace_sequential(workspace_roots)

        logger.info(
            f"Workspace scan complete: {len(self.scripted_effects)} effects, {len(self.scripted_triggers)} triggers, "
            f"{len(self.character_interactions)} interactions, {len(self.modifiers)} modifiers, "
            f"{len(self.on_action_definitions)} on_actions, {len(self.opinion_modifiers)} opinion_mods, "
            f"{len(self.scripted_guis)} GUIs, {len(self.localization)} loc keys, "
            f"{len(self.events)} events, {len(self.character_flags)} flags"
        )

    def _scan_workspace_parallel(self, workspace_roots: List[str], executor: ThreadPoolExecutor):
        """
        Scan workspace folders in parallel using thread pool.

        Parallelizes file I/O and parsing across multiple threads for 2-4x speedup.

        Args:
            workspace_roots: List of workspace folder paths
            executor: ThreadPoolExecutor for parallel execution
        """
        # Collect all scan tasks
        scan_tasks = []

        for root in workspace_roots:
            root_path = Path(root)

            # Collect all folders to scan with their target dicts and types
            folder_configs = [
                (
                    root_path / "common" / "scripted_effects",
                    self.scripted_effects,
                    "scripted_effects",
                ),
                (
                    root_path / "common" / "scripted_triggers",
                    self.scripted_triggers,
                    "scripted_triggers",
                ),
                (
                    root_path / "common" / "character_interactions",
                    self.character_interactions,
                    "character_interactions",
                ),
                (root_path / "common" / "modifiers", self.modifiers, "modifiers"),
                (root_path / "common" / "on_action", self.on_action_definitions, "on_actions"),
                (
                    root_path / "common" / "opinion_modifiers",
                    self.opinion_modifiers,
                    "opinion_modifiers",
                ),
                (root_path / "common" / "scripted_guis", self.scripted_guis, "scripted_guis"),
            ]

            # Submit file scanning tasks
            for folder_path, target_dict, folder_type in folder_configs:
                if folder_path.exists() and folder_path.is_dir():
                    for file_path in folder_path.glob("**/*.txt"):
                        scan_tasks.append(
                            executor.submit(self._scan_single_file, file_path, folder_type)
                        )

            # Localization (different format)
            loc_path = root_path / "localization"
            if loc_path.exists() and loc_path.is_dir():
                loc_files = list(loc_path.glob("**/*.yml"))
                logger.info(f"Found {len(loc_files)} localization files in {loc_path}")
                for file_path in loc_files:
                    scan_tasks.append(
                        executor.submit(self._scan_localization_file_parallel, file_path)
                    )
            else:
                logger.debug(f"No localization folder at {loc_path} (not a CK3 mod)")

            # Events
            events_path = root_path / "events"
            if events_path.exists() and events_path.is_dir():
                for file_path in events_path.glob("**/*.txt"):
                    scan_tasks.append(executor.submit(self._scan_events_file_parallel, file_path))

        # Collect results
        for future in as_completed(scan_tasks):
            try:
                result = future.result()
                if result:
                    self._merge_scan_result(result)
            except Exception as e:
                logger.warning(f"Error in parallel scan task: {e}")

        # Scan character flags (depends on having events/effects indexed)
        for root in workspace_roots:
            self._scan_character_flags(Path(root))

    def _scan_single_file(self, file_path: Path, folder_type: str) -> Optional[Dict]:
        """
        Scan a single file and return results for merging.

        Args:
            file_path: Path to the file to scan
            folder_type: Type of definitions to extract

        Returns:
            Dictionary with scan results or None on error
        """
        try:
            content = file_path.read_text(encoding="utf-8-sig")
            uri = file_path.as_uri()

            definitions = self._extract_top_level_definitions(content, uri)

            return {
                "type": folder_type,
                "definitions": definitions,
                "file": str(file_path),
            }
        except Exception as e:
            logger.warning(f"Error scanning {file_path}: {e}")
            return None

    def _scan_localization_file_parallel(self, file_path: Path) -> Optional[Dict]:
        """Scan a localization file in parallel."""
        try:
            content = file_path.read_text(encoding="utf-8-sig")
            uri = file_path.as_uri()

            entries = self._parse_localization_file(content, uri)

            return {
                "type": "localization",
                "entries": entries,
                "uri": uri,
            }
        except Exception as e:
            logger.warning(f"Error scanning localization {file_path}: {e}")
            return None

    def _scan_events_file_parallel(self, file_path: Path) -> Optional[Dict]:
        """Scan an events file in parallel."""
        try:
            # Try multiple encodings
            content = None
            for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
                try:
                    content = file_path.read_text(encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if content is None:
                return None

            uri = file_path.as_uri()

            return {
                "type": "events",
                "namespaces": self._extract_namespaces(content, uri),
                "events": self._extract_event_definitions(content, uri),
                "scopes": self._extract_saved_scopes(content, uri),
            }
        except Exception as e:
            logger.warning(f"Error scanning events {file_path}: {e}")
            return None

    def _merge_scan_result(self, result: Dict):
        """Merge scan result into the index."""
        result_type = result.get("type")

        if result_type == "localization":
            entries = result.get("entries", {})
            uri = result.get("uri", "")
            for key, (text, line_num) in entries.items():
                self.localization[key] = (text, uri, line_num)

        elif result_type == "events":
            for ns_name, ns_uri in result.get("namespaces", {}).items():
                if ns_name not in self.namespaces:
                    self.namespaces[ns_name] = ns_uri
            for event_id, location in result.get("events", {}).items():
                self.events[event_id] = location
            for scope_name, location in result.get("scopes", {}).items():
                if scope_name not in self.saved_scopes:
                    self.saved_scopes[scope_name] = location

        elif result_type in (
            "scripted_effects",
            "scripted_triggers",
            "character_interactions",
            "modifiers",
            "on_actions",
            "opinion_modifiers",
            "scripted_guis",
        ):
            target_dict = {
                "scripted_effects": self.scripted_effects,
                "scripted_triggers": self.scripted_triggers,
                "character_interactions": self.character_interactions,
                "modifiers": self.modifiers,
                "on_actions": self.on_action_definitions,
                "opinion_modifiers": self.opinion_modifiers,
                "scripted_guis": self.scripted_guis,
            }.get(result_type)

            if target_dict is not None:
                for name, location in result.get("definitions", {}).items():
                    target_dict[name] = location

    def _scan_workspace_sequential(self, workspace_roots: List[str]):
        """
        Scan workspace folders sequentially (fallback when no executor provided).

        Args:
            workspace_roots: List of workspace folder paths
        """
        for root in workspace_roots:
            root_path = Path(root)

            # Scan scripted effects
            effects_path = root_path / "common" / "scripted_effects"
            if effects_path.exists() and effects_path.is_dir():
                self._scan_scripted_effects_folder(effects_path)

            # Scan scripted triggers
            triggers_path = root_path / "common" / "scripted_triggers"
            if triggers_path.exists() and triggers_path.is_dir():
                self._scan_scripted_triggers_folder(triggers_path)

            # Scan character interactions
            interactions_path = root_path / "common" / "character_interactions"
            if interactions_path.exists() and interactions_path.is_dir():
                self._scan_common_folder(
                    interactions_path, self.character_interactions, "character interaction"
                )

            # Scan modifiers
            modifiers_path = root_path / "common" / "modifiers"
            if modifiers_path.exists() and modifiers_path.is_dir():
                self._scan_common_folder(modifiers_path, self.modifiers, "modifier")

            # Scan on_actions
            on_actions_path = root_path / "common" / "on_action"
            if on_actions_path.exists() and on_actions_path.is_dir():
                self._scan_common_folder(on_actions_path, self.on_action_definitions, "on_action")

            # Scan opinion modifiers
            opinion_path = root_path / "common" / "opinion_modifiers"
            if opinion_path.exists() and opinion_path.is_dir():
                self._scan_common_folder(opinion_path, self.opinion_modifiers, "opinion modifier")

            # Scan scripted GUIs
            guis_path = root_path / "common" / "scripted_guis"
            if guis_path.exists() and guis_path.is_dir():
                self._scan_common_folder(guis_path, self.scripted_guis, "scripted GUI")

            # Scan localization
            loc_path = root_path / "localization"
            if loc_path.exists() and loc_path.is_dir():
                self._scan_localization_folder(loc_path)

            # Scan events
            events_path = root_path / "events"
            if events_path.exists() and events_path.is_dir():
                self._scan_events_folder(events_path)

            # Scan for character flags in events and scripted effects
            self._scan_character_flags(root_path)

    def _scan_scripted_effects_folder(self, folder_path: Path):
        """
        Scan a scripted_effects folder for effect definitions.

        Effect definitions are top-level blocks in .txt files:
            my_custom_effect = {
                ...
            }

        Args:
            folder_path: Path to the scripted_effects folder
        """
        for file_path in folder_path.glob("**/*.txt"):
            try:
                content = file_path.read_text(encoding="utf-8-sig")
                uri = file_path.as_uri()

                # Parse top-level definitions
                definitions = self._extract_top_level_definitions(content, uri)
                for name, location in definitions.items():
                    self.scripted_effects[name] = location
                    logger.debug(f"Indexed scripted effect: {name} in {file_path.name}")

            except Exception as e:
                logger.warning(f"Error scanning {file_path}: {e}")

    def _scan_common_folder(
        self, folder_path: Path, target_dict: Dict[str, types.Location], def_type: str
    ):
        """
        Generic scanner for common/ subfolders with top-level definitions.

        Scans .txt files for top-level block definitions and stores them in the target dict.
        Works for: character_interactions, modifiers, on_action, opinion_modifiers, scripted_guis

        Args:
            folder_path: Path to the common/ subfolder
            target_dict: Dictionary to store definitions (name -> Location)
            def_type: Type name for logging (e.g., "modifier", "character interaction")
        """
        for file_path in folder_path.glob("**/*.txt"):
            try:
                content = file_path.read_text(encoding="utf-8-sig")
                uri = file_path.as_uri()

                # Parse top-level definitions
                definitions = self._extract_top_level_definitions(content, uri)
                for name, location in definitions.items():
                    target_dict[name] = location
                    logger.debug(f"Indexed {def_type}: {name} in {file_path.name}")

            except Exception as e:
                logger.warning(f"Error scanning {file_path}: {e}")

    def _scan_scripted_triggers_folder(self, folder_path: Path):
        """
        Scan a scripted_triggers folder for trigger definitions.

        Trigger definitions are top-level blocks in .txt files:
            my_custom_trigger = {
                ...
            }

        Args:
            folder_path: Path to the scripted_triggers folder
        """
        for file_path in folder_path.glob("**/*.txt"):
            try:
                content = file_path.read_text(encoding="utf-8-sig")
                uri = file_path.as_uri()

                # Parse top-level definitions
                definitions = self._extract_top_level_definitions(content, uri)
                for name, location in definitions.items():
                    self.scripted_triggers[name] = location
                    logger.debug(f"Indexed scripted trigger: {name} in {file_path.name}")

            except Exception as e:
                logger.warning(f"Error scanning {file_path}: {e}")

    def _scan_localization_folder(self, folder_path: Path):
        """
        Scan a localization folder for localization keys and their text.

        Localization files are YAML with format:
            l_english:
             key:0 "Text value"

        Args:
            folder_path: Path to the localization folder
        """
        for file_path in folder_path.glob("**/*.yml"):
            try:
                content = file_path.read_text(encoding="utf-8-sig")
                uri = file_path.as_uri()

                # Parse localization entries
                entries = self._parse_localization_file(content, uri)
                for key, (text, line_num) in entries.items():
                    self.localization[key] = (text, uri, line_num)

                logger.debug(f"Indexed {len(entries)} loc keys from {file_path.name}")

            except Exception as e:
                logger.warning(f"Error scanning localization {file_path}: {e}")

    def _parse_localization_file(self, content: str, uri: str) -> Dict[str, tuple]:
        """
        Parse a CK3 localization YAML file.

        Format:
            l_english:
             key:0 "Text value"
             another_key:0 "Another text"

        Args:
            content: File content
            uri: File URI

        Returns:
            Dictionary of key -> (text, line_number)
        """
        entries = {}
        lines = content.split("\n")

        # Pattern: key:number "text" (captures key and text)
        # CK3 loc format: key:0 "text" or key:1 "text"
        pattern = re.compile(r'^\s*([a-zA-Z_][a-zA-Z0-9_\.]*):(\d+)\s+"(.*)"\s*$')

        for line_num, line in enumerate(lines):
            match = pattern.match(line)
            if match:
                key = match.group(1)
                text = match.group(3)
                entries[key] = (text, line_num)

        return entries

    def find_localization(self, key: str) -> Optional[tuple]:
        """
        Find localization text for a key.

        Args:
            key: Localization key (e.g., 'rq_nts_daughter.0001.a.tt')

        Returns:
            Tuple of (text, file_uri, line_number), or None if not found
        """
        return self.localization.get(key)

    def get_all_localization_keys(self) -> Set[str]:
        """
        Get all indexed localization keys.

        Returns:
            Set of localization keys
        """
        return set(self.localization.keys())

    def _scan_events_folder(self, folder_path: Path):
        """
        Scan an events folder for event definitions and saved scopes.

        Event definitions have format:
            namespace.number = {
                type = character_event
                ...
            }

        Also extracts save_scope_as definitions and namespaces.

        Args:
            folder_path: Path to the events folder
        """
        for file_path in folder_path.glob("**/*.txt"):
            try:
                # Try multiple encodings
                content = None
                for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
                    try:
                        content = file_path.read_text(encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue

                if content is None:
                    logger.warning(f"Could not decode {file_path}")
                    continue

                uri = file_path.as_uri()

                # Extract namespace declarations
                namespaces = self._extract_namespaces(content, uri)
                for ns_name, ns_uri in namespaces.items():
                    if ns_name not in self.namespaces:
                        self.namespaces[ns_name] = ns_uri

                # Parse event definitions
                events = self._extract_event_definitions(content, uri)
                for event_id, location in events.items():
                    self.events[event_id] = location

                # Extract saved scopes (save_scope_as = name)
                scopes = self._extract_saved_scopes(content, uri)
                for scope_name, location in scopes.items():
                    # Only add if not already defined (first definition wins)
                    if scope_name not in self.saved_scopes:
                        self.saved_scopes[scope_name] = location

                logger.debug(
                    f"Indexed {len(namespaces)} namespaces, {len(events)} events, {len(scopes)} scopes from {file_path.name}"
                )

            except Exception as e:
                logger.warning(f"Error scanning events {file_path}: {e}")

    def _extract_event_definitions(self, content: str, uri: str) -> Dict[str, types.Location]:
        """
        Extract event definitions from file content.

        Event format: namespace.number = { ... }

        Args:
            content: File content
            uri: File URI

        Returns:
            Dictionary of event_id -> Location
        """
        events = {}
        lines = content.split("\n")

        # Pattern for event definition: namespace.number = { at start of line
        # Event IDs have format: word.digits (e.g., rq_nts_daughter.0001)
        pattern = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*\.\d+)\s*=\s*\{")

        for line_num, line in enumerate(lines):
            stripped = line.lstrip()
            leading_ws = len(line) - len(stripped)

            # Events should be at top level (no/minimal indentation)
            if leading_ws > 1:
                continue

            match = pattern.match(stripped)
            if match:
                event_id = match.group(1)
                char_start = line.find(event_id)

                location = types.Location(
                    uri=uri,
                    range=types.Range(
                        start=types.Position(line=line_num, character=char_start),
                        end=types.Position(line=line_num, character=char_start + len(event_id)),
                    ),
                )
                events[event_id] = location

        return events

    def _extract_namespaces(self, content: str, uri: str) -> Dict[str, str]:
        """
        Extract namespace declarations from file content.

        Pattern: namespace = name_here

        Args:
            content: File content
            uri: File URI

        Returns:
            Dictionary of namespace_name -> file_uri
        """
        namespaces = {}
        lines = content.split("\n")

        # Pattern for namespace = name
        pattern = re.compile(r"^\s*namespace\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)")

        for line in lines:
            match = pattern.match(line)
            if match:
                ns_name = match.group(1)
                namespaces[ns_name] = uri

        return namespaces

    def _extract_saved_scopes(self, content: str, uri: str) -> Dict[str, types.Location]:
        """
        Extract save_scope_as definitions from file content.

        Patterns:
            save_scope_as = scope_name
            { save_scope_as = scope_name }

        Args:
            content: File content
            uri: File URI

        Returns:
            Dictionary of scope_name -> Location
        """
        scopes = {}
        lines = content.split("\n")

        # Pattern for save_scope_as = name
        pattern = re.compile(r"save_scope_as\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)")

        for line_num, line in enumerate(lines):
            for match in pattern.finditer(line):
                scope_name = match.group(1)
                char_start = match.start(1)

                location = types.Location(
                    uri=uri,
                    range=types.Range(
                        start=types.Position(line=line_num, character=char_start),
                        end=types.Position(line=line_num, character=char_start + len(scope_name)),
                    ),
                )
                # First definition wins
                if scope_name not in scopes:
                    scopes[scope_name] = location

        return scopes

    def _scan_character_flags(self, root_path: Path):
        """
        Scan workspace for character flag usage.

        Looks for:
        - add_character_flag = flag_name (sets the flag)
        - has_character_flag = flag_name (checks the flag)
        - remove_character_flag = flag_name (removes the flag)

        Args:
            root_path: Root path of the workspace
        """
        # Scan events folder
        events_path = root_path / "events"
        if events_path.exists():
            self._scan_flags_in_folder(events_path)

        # Scan scripted effects folder
        effects_path = root_path / "common" / "scripted_effects"
        if effects_path.exists():
            self._scan_flags_in_folder(effects_path)

        # Scan scripted triggers folder
        triggers_path = root_path / "common" / "scripted_triggers"
        if triggers_path.exists():
            self._scan_flags_in_folder(triggers_path)

    def _scan_flags_in_folder(self, folder_path: Path):
        """
        Scan a folder for character flag usage.

        Args:
            folder_path: Path to scan
        """
        for file_path in folder_path.glob("**/*.txt"):
            try:
                # Try multiple encodings
                content = None
                for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
                    try:
                        content = file_path.read_text(encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue

                if content is None:
                    continue

                uri = file_path.as_uri()
                self._extract_character_flags(content, uri)

            except Exception as e:
                logger.warning(f"Error scanning flags in {file_path}: {e}")

    def _extract_character_flags(self, content: str, uri: str):
        """
        Extract character flag usages from file content.

        Args:
            content: File content
            uri: File URI
        """
        lines = content.split("\n")

        # Patterns for flag operations
        patterns = [
            (re.compile(r"add_character_flag\s*=\s*(\w+)"), "set"),
            (re.compile(r"has_character_flag\s*=\s*(\w+)"), "check"),
            (re.compile(r"remove_character_flag\s*=\s*(\w+)"), "remove"),
        ]

        for line_num, line in enumerate(lines):
            # Skip comments
            comment_pos = line.find("#")
            if comment_pos != -1:
                line = line[:comment_pos]

            for pattern, action in patterns:
                match = pattern.search(line)
                if match:
                    flag_name = match.group(1)

                    # Add to index
                    if flag_name not in self.character_flags:
                        self.character_flags[flag_name] = []

                    self.character_flags[flag_name].append((action, uri, line_num))

    def find_character_flag(self, flag_name: str) -> Optional[types.Location]:
        """
        Find the definition location of a character flag (first 'set' action).

        Args:
            flag_name: The flag name to find

        Returns:
            Location of the flag's first 'set' action, or first usage if never set
        """
        usages = self.character_flags.get(flag_name)
        if not usages:
            return None

        # Prefer 'set' actions
        for action, file_uri, line_num in usages:
            if action == "set":
                return types.Location(
                    uri=file_uri,
                    range=types.Range(
                        start=types.Position(line=line_num, character=0),
                        end=types.Position(line=line_num, character=100),
                    ),
                )

        # Fall back to first usage
        action, file_uri, line_num = usages[0]
        return types.Location(
            uri=file_uri,
            range=types.Range(
                start=types.Position(line=line_num, character=0),
                end=types.Position(line=line_num, character=100),
            ),
        )

    def get_character_flag_usages(self, flag_name: str) -> Optional[List[tuple]]:
        """
        Get all usages of a character flag.

        Args:
            flag_name: The flag name to find

        Returns:
            List of (action, file_uri, line_number) tuples, or None if not found
        """
        return self.character_flags.get(flag_name)

    def get_all_character_flags(self) -> Set[str]:
        """
        Get all indexed character flag names.

        Returns:
            Set of flag names
        """
        return set(self.character_flags.keys())

    def _extract_top_level_definitions(self, content: str, uri: str) -> Dict[str, types.Location]:
        """
        Extract top-level block definitions from file content.

        Uses regex to find patterns like:
            definition_name = {

        Only extracts definitions at brace depth 0 (true top-level).

        Args:
            content: File content
            uri: File URI for location

        Returns:
            Dictionary of definition_name -> Location
        """
        definitions = {}
        lines = content.split("\n")

        # Track brace depth to ensure we're at top level
        brace_depth = 0

        for line_num, line in enumerate(lines):
            # Calculate brace depth at the START of this line (before any braces on this line)
            current_depth = brace_depth

            # First check for definition at current depth (before counting this line's braces)
            if current_depth == 0:
                stripped = line.lstrip()
                # Match pattern: name = { (with optional content before brace)
                match = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{", stripped)
                if match:
                    name = match.group(1)
                    # Skip special keywords that aren't definition names
                    if name not in (
                        "if",
                        "else",
                        "else_if",
                        "trigger",
                        "effect",
                        "limit",
                        "modifier",
                        "hidden_effect",
                        "show_as_tooltip",
                        "random_list",
                        "switch",
                    ):
                        # Create location for this definition
                        char_start = line.find(name)
                        location = types.Location(
                            uri=uri,
                            range=types.Range(
                                start=types.Position(line=line_num, character=char_start),
                                end=types.Position(line=line_num, character=char_start + len(name)),
                            ),
                        )
                        definitions[name] = location

            # Now count braces on this line for the NEXT line's depth
            in_string = False
            for i, char in enumerate(line):
                if char == '"' and (i == 0 or line[i - 1] != "\\"):
                    in_string = not in_string
                elif not in_string:
                    if char == "#":
                        break  # Rest is comment
                    elif char == "{":
                        brace_depth += 1
                    elif char == "}":
                        brace_depth = max(0, brace_depth - 1)

        return definitions

    def get_all_scripted_effects(self) -> Set[str]:
        """
        Get all indexed scripted effect names.

        Returns:
            Set of effect names
        """
        return set(self.scripted_effects.keys())

    def get_all_scripted_triggers(self) -> Set[str]:
        """
        Get all indexed scripted trigger names.

        Returns:
            Set of trigger names
        """
        return set(self.scripted_triggers.keys())

    def find_scripted_effect(self, name: str) -> Optional[types.Location]:
        """
        Find the location of a scripted effect definition.

        Args:
            name: Effect name

        Returns:
            Location of the effect definition, or None if not found
        """
        return self.scripted_effects.get(name)

    def find_scripted_trigger(self, name: str) -> Optional[types.Location]:
        """
        Find the location of a scripted trigger definition.

        Args:
            name: Trigger name

        Returns:
            Location of the trigger definition, or None if not found
        """
        return self.scripted_triggers.get(name)

    def find_character_interaction(self, name: str) -> Optional[types.Location]:
        """
        Find the location of a character interaction definition.

        Args:
            name: Interaction name

        Returns:
            Location of the interaction definition, or None if not found
        """
        return self.character_interactions.get(name)

    def find_modifier(self, name: str) -> Optional[types.Location]:
        """
        Find the location of a modifier definition.

        Args:
            name: Modifier name

        Returns:
            Location of the modifier definition, or None if not found
        """
        return self.modifiers.get(name)

    def find_on_action(self, name: str) -> Optional[types.Location]:
        """
        Find the location of an on_action definition.

        Args:
            name: On_action name

        Returns:
            Location of the on_action definition, or None if not found
        """
        return self.on_action_definitions.get(name)

    def find_opinion_modifier(self, name: str) -> Optional[types.Location]:
        """
        Find the location of an opinion modifier definition.

        Args:
            name: Opinion modifier name

        Returns:
            Location of the opinion modifier definition, or None if not found
        """
        return self.opinion_modifiers.get(name)

    def find_scripted_gui(self, name: str) -> Optional[types.Location]:
        """
        Find the location of a scripted GUI definition.

        Args:
            name: Scripted GUI name

        Returns:
            Location of the scripted GUI definition, or None if not found
        """
        return self.scripted_guis.get(name)

    def update_from_ast(self, uri: str, ast: List[CK3Node]):
        """
        Extract and index all symbols from an AST.

        Args:
            uri: Document URI
            ast: List of top-level AST nodes
        """
        # Remove existing entries for this document first
        self._remove_document_entries(uri)

        # Index new symbols
        for node in ast:
            self._index_node(uri, node)

    def _remove_document_entries(self, uri: str):
        """Remove all entries from a specific document."""
        # Remove namespaces from this document
        self.namespaces = {k: v for k, v in self.namespaces.items() if v != uri}

        # Remove events from this document
        self.events = {k: v for k, v in self.events.items() if v.uri != uri}

        # Remove scripted effects from this document
        self.scripted_effects = {k: v for k, v in self.scripted_effects.items() if v.uri != uri}

        # Remove scripted triggers from this document
        self.scripted_triggers = {k: v for k, v in self.scripted_triggers.items() if v.uri != uri}

        # Remove scripted lists from this document
        self.scripted_lists = {k: v for k, v in self.scripted_lists.items() if v.uri != uri}

        # Remove script values from this document
        self.script_values = {k: v for k, v in self.script_values.items() if v.uri != uri}

        # Remove saved scopes from this document
        self.saved_scopes = {k: v for k, v in self.saved_scopes.items() if v.uri != uri}

        # Remove character interactions from this document
        self.character_interactions = {
            k: v for k, v in self.character_interactions.items() if v.uri != uri
        }

        # Remove modifiers from this document
        self.modifiers = {k: v for k, v in self.modifiers.items() if v.uri != uri}

        # Remove on_action definitions from this document
        self.on_action_definitions = {
            k: v for k, v in self.on_action_definitions.items() if v.uri != uri
        }

        # Remove opinion modifiers from this document
        self.opinion_modifiers = {k: v for k, v in self.opinion_modifiers.items() if v.uri != uri}

        # Remove scripted GUIs from this document
        self.scripted_guis = {k: v for k, v in self.scripted_guis.items() if v.uri != uri}

    def _index_node(self, uri: str, node: CK3Node):
        """
        Index a single node and its children.

        Args:
            uri: Document URI
            node: AST node to index
        """
        # Index namespaces
        if node.type == "namespace":
            if node.value:
                self.namespaces[node.value] = uri
                logger.debug(f"Indexed namespace: {node.value} in {uri}")

        # Index events (identified by type == 'event')
        elif node.type == "event":
            location = types.Location(uri=uri, range=node.range)
            self.events[node.key] = location
            logger.debug(f"Indexed event: {node.key} in {uri}")

        # Index saved scopes
        if node.key == "save_scope_as" or node.key == "save_temporary_scope_as":
            if node.value:
                location = types.Location(uri=uri, range=node.range)
                self.saved_scopes[node.value] = location
                logger.debug(f"Indexed saved scope: {node.value} in {uri}")

        # Recursively index children
        for child in node.children:
            self._index_node(uri, child)

    def remove_document(self, uri: str):
        """
        Remove all symbols from a document when it's closed.

        Args:
            uri: Document URI to remove
        """
        self._remove_document_entries(uri)
        logger.info(f"Removed index entries for {uri}")

    def find_event(self, event_id: str) -> Optional[types.Location]:
        """
        Find the location of an event definition.

        Args:
            event_id: Event identifier (e.g., 'my_mod.0001')

        Returns:
            Location of the event definition, or None if not found
        """
        return self.events.get(event_id)

    def find_saved_scope(self, scope_name: str) -> Optional[types.Location]:
        """
        Find the location where a scope was saved.

        Args:
            scope_name: Saved scope name (without 'scope:' prefix)

        Returns:
            Location where the scope was saved, or None if not found
        """
        return self.saved_scopes.get(scope_name)

    def get_all_events(self) -> List[str]:
        """
        Get all indexed event IDs.

        Returns:
            List of event identifiers
        """
        return list(self.events.keys())

    def get_all_namespaces(self) -> List[str]:
        """
        Get all indexed namespaces.

        Returns:
            List of namespace names
        """
        return list(self.namespaces.keys())

    def get_events_for_namespace(self, namespace: str) -> List[str]:
        """
        Get all event IDs that belong to a specific namespace.

        Args:
            namespace: The namespace to find events for (e.g., 'rq_nts_daughter')

        Returns:
            List of event IDs belonging to the namespace, sorted numerically
        """
        prefix = f"{namespace}."
        events = [event_id for event_id in self.events.keys() if event_id.startswith(prefix)]
        # Sort by event number
        events.sort(key=lambda x: int(x.split(".")[-1]) if x.split(".")[-1].isdigit() else 0)
        return events

    def get_event_title_key(self, event_id: str) -> str:
        """
        Get the standard title localization key for an event.

        CK3 convention: event_id.t for title

        Args:
            event_id: The event ID (e.g., 'rq_nts_daughter.0001')

        Returns:
            The title localization key (e.g., 'rq_nts_daughter.0001.t')
        """
        return f"{event_id}.t"

    def get_event_localized_title(self, event_id: str) -> Optional[str]:
        """
        Get the localized title text for an event.

        Args:
            event_id: The event ID

        Returns:
            The localized title text, or None if not found
        """
        title_key = self.get_event_title_key(event_id)
        loc_info = self.find_localization(title_key)
        if loc_info:
            text, _, _ = loc_info
            return text
        return None
