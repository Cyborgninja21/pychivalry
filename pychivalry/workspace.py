"""
Workspace features for cross-file validation and mod descriptor parsing.

This module implements Phase 15 of the deployment plan:
- Cross-file validation for undefined references
- Event chain validation (trigger_event targets exist)
- Localization coverage checks
- Mod descriptor file parsing (*.mod files)
- Workspace-wide symbol tracking
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from pathlib import Path
import re


@dataclass
class ModDescriptor:
    """Represents a CK3 mod descriptor file (*.mod)."""
    name: str
    version: str
    supported_version: str
    path: str
    dependencies: List[str] = field(default_factory=list)
    replace_paths: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    picture: Optional[str] = None
    remote_file_id: Optional[str] = None


@dataclass
class UndefinedReference:
    """Represents an undefined reference found in workspace."""
    symbol_type: str  # 'event', 'scripted_effect', 'scripted_trigger', 'script_value', 'localization'
    symbol_name: str
    referenced_in_file: str
    line: int
    column: int


@dataclass
class EventChainLink:
    """Represents a link in an event chain (trigger_event call)."""
    source_event: str
    target_event: str
    source_file: str
    source_line: int
    target_exists: bool


@dataclass
class LocalizationCoverage:
    """Tracks localization coverage for events and other content."""
    total_events: int
    events_with_loc: int
    missing_keys: List[str] = field(default_factory=list)
    coverage_percentage: float = 0.0


def parse_mod_descriptor(content: str) -> Optional[ModDescriptor]:
    """
    Parse a CK3 mod descriptor file (*.mod).
    
    Example:
        name = "My Cool Mod"
        version = "1.0.0"
        supported_version = "1.11.*"
        path = "mod/my_cool_mod"
        tags = { "Gameplay" "Events" }
        dependencies = { "another_mod" }
    
    Args:
        content: The text content of the .mod file
    
    Returns:
        ModDescriptor if parsing succeeds, None otherwise
    """
    if not content.strip():
        return None
    
    # Extract fields using regex
    name_match = re.search(r'name\s*=\s*"([^"]+)"', content)
    version_match = re.search(r'version\s*=\s*"([^"]+)"', content)
    supported_match = re.search(r'supported_version\s*=\s*"([^"]+)"', content)
    path_match = re.search(r'path\s*=\s*"([^"]+)"', content)
    picture_match = re.search(r'picture\s*=\s*"([^"]+)"', content)
    remote_match = re.search(r'remote_file_id\s*=\s*"([^"]+)"', content)
    
    if not name_match:
        return None
    
    descriptor = ModDescriptor(
        name=name_match.group(1),
        version=version_match.group(1) if version_match else "",
        supported_version=supported_match.group(1) if supported_match else "",
        path=path_match.group(1) if path_match else "",
        picture=picture_match.group(1) if picture_match else None,
        remote_file_id=remote_match.group(1) if remote_match else None
    )
    
    # Extract tags array
    tags_match = re.search(r'tags\s*=\s*\{([^}]+)\}', content)
    if tags_match:
        tags_content = tags_match.group(1)
        descriptor.tags = re.findall(r'"([^"]+)"', tags_content)
    
    # Extract dependencies array
    deps_match = re.search(r'dependencies\s*=\s*\{([^}]+)\}', content)
    if deps_match:
        deps_content = deps_match.group(1)
        descriptor.dependencies = re.findall(r'"([^"]+)"', deps_content)
    
    # Extract replace_path entries
    replace_matches = re.findall(r'replace_path\s*=\s*"([^"]+)"', content)
    descriptor.replace_paths = replace_matches
    
    return descriptor


def is_valid_mod_descriptor(descriptor: ModDescriptor) -> Tuple[bool, List[str]]:
    """
    Validate a mod descriptor for common issues.
    
    Returns:
        (is_valid, list_of_errors)
    """
    errors = []
    
    if not descriptor.name:
        errors.append("Mod name is required")
    
    if not descriptor.path:
        errors.append("Mod path is required")
    
    if descriptor.supported_version and not re.match(r'\d+\.\d+\.\*', descriptor.supported_version):
        errors.append(f"Invalid supported_version format: {descriptor.supported_version}")
    
    return len(errors) == 0, errors


def find_undefined_scripted_effects(
    used_effects: Set[str],
    defined_effects: Set[str]
) -> List[str]:
    """
    Find scripted effects that are used but not defined in workspace.
    
    Args:
        used_effects: Set of effect names that are called
        defined_effects: Set of effect names that are defined
    
    Returns:
        List of undefined effect names
    """
    return sorted(list(used_effects - defined_effects))


def find_undefined_scripted_triggers(
    used_triggers: Set[str],
    defined_triggers: Set[str]
) -> List[str]:
    """
    Find scripted triggers that are used but not defined in workspace.
    
    Args:
        used_triggers: Set of trigger names that are called
        defined_triggers: Set of trigger names that are defined
    
    Returns:
        List of undefined trigger names
    """
    return sorted(list(used_triggers - defined_triggers))


def extract_trigger_event_calls(content: str) -> List[str]:
    """
    Extract all trigger_event calls from content to find event dependencies.
    
    Looks for patterns like:
    - trigger_event = my_mod.0001
    - trigger_event = { id = my_mod.0001 }
    - trigger_event = event_name (also supported)
    
    Args:
        content: File content to search
    
    Returns:
        List of event IDs that are triggered
    """
    event_ids = []
    
    # Pattern 1: trigger_event = event_id (with namespace.number format or simple name)
    # Look for word boundaries to avoid partial matches
    simple_matches = re.findall(r'trigger_event\s*=\s*([a-z_]+(?:\.\d+)?)\b', content)
    event_ids.extend(simple_matches)
    
    # Pattern 2: trigger_event = { id = event_id }
    block_matches = re.findall(r'trigger_event\s*=\s*\{[^}]*id\s*=\s*([a-z_]+(?:\.\d+)?)\b', content, re.DOTALL)
    for match in block_matches:
        if match not in event_ids:
            event_ids.append(match)
    
    return event_ids


def validate_event_chain(
    event_id: str,
    event_content: str,
    all_events: Set[str]
) -> List[EventChainLink]:
    """
    Validate that all triggered events exist in the workspace.
    
    Args:
        event_id: The source event ID
        event_content: Content of the source event
        all_events: Set of all event IDs defined in workspace
    
    Returns:
        List of EventChainLinks with validation status
    """
    triggered_events = extract_trigger_event_calls(event_content)
    links = []
    
    for target_event in triggered_events:
        links.append(EventChainLink(
            source_event=event_id,
            target_event=target_event,
            source_file="",  # Would be filled by caller
            source_line=0,   # Would be filled by caller
            target_exists=(target_event in all_events)
        ))
    
    return links


def extract_localization_keys_from_event(event_content: str) -> List[str]:
    """
    Extract localization keys referenced in an event.
    
    Looks for:
    - title = my_event.t
    - desc = my_event.desc
    - option = { name = my_event.a }
    
    Args:
        event_content: Content of the event block
    
    Returns:
        List of localization keys
    """
    keys = []
    
    # Extract title (allow numbers and underscores)
    title_match = re.search(r'title\s*=\s*([a-z_0-9]+\.[a-z_0-9]+)', event_content)
    if title_match:
        keys.append(title_match.group(1))
    
    # Extract desc (allow numbers and underscores)
    desc_matches = re.findall(r'desc\s*=\s*([a-z_0-9]+\.[a-z_0-9]+)', event_content)
    keys.extend(desc_matches)
    
    # Extract option names (allow numbers and underscores)
    option_matches = re.findall(r'name\s*=\s*([a-z_0-9]+\.[a-z_0-9]+)', event_content)
    keys.extend(option_matches)
    
    return keys


def calculate_localization_coverage(
    events: Dict[str, str],  # event_id -> event_content
    localization_keys: Set[str]
) -> LocalizationCoverage:
    """
    Calculate localization coverage for events.
    
    Args:
        events: Dictionary of event_id to event content
        localization_keys: Set of all defined localization keys
    
    Returns:
        LocalizationCoverage with statistics
    """
    total_events = len(events)
    events_with_loc = 0
    missing_keys = []
    
    for event_id, event_content in events.items():
        required_keys = extract_localization_keys_from_event(event_content)
        
        if not required_keys:
            # Event has no localization requirements, skip
            continue
        
        all_present = all(key in localization_keys for key in required_keys)
        
        if all_present:
            events_with_loc += 1
        else:
            for key in required_keys:
                if key not in localization_keys:
                    missing_keys.append(key)
    
    coverage_percentage = (events_with_loc / total_events * 100) if total_events > 0 else 0.0
    
    return LocalizationCoverage(
        total_events=total_events,
        events_with_loc=events_with_loc,
        missing_keys=sorted(list(set(missing_keys))),
        coverage_percentage=round(coverage_percentage, 2)
    )


def find_broken_event_chains(
    events: Dict[str, str],  # event_id -> event_content
    event_files: Dict[str, str]  # event_id -> file_path
) -> List[EventChainLink]:
    """
    Find all broken event chains in the workspace.
    
    Args:
        events: Dictionary of event_id to event content
        event_files: Dictionary of event_id to file path
    
    Returns:
        List of broken EventChainLinks (where target_exists = False)
    """
    all_event_ids = set(events.keys())
    broken_links = []
    
    for event_id, event_content in events.items():
        links = validate_event_chain(event_id, event_content, all_event_ids)
        
        for link in links:
            if not link.target_exists:
                link.source_file = event_files.get(event_id, "unknown")
                broken_links.append(link)
    
    return broken_links


def get_workspace_diagnostics_summary(
    undefined_effects: List[str],
    undefined_triggers: List[str],
    broken_event_chains: List[EventChainLink],
    loc_coverage: LocalizationCoverage
) -> str:
    """
    Generate a summary of workspace-wide validation issues.
    
    Args:
        undefined_effects: List of undefined scripted effects
        undefined_triggers: List of undefined scripted triggers
        broken_event_chains: List of broken event chain links
        loc_coverage: Localization coverage statistics
    
    Returns:
        Human-readable summary string
    """
    lines = ["# Workspace Validation Summary", ""]
    
    # Undefined references
    if undefined_effects or undefined_triggers:
        lines.append("## Undefined References")
        if undefined_effects:
            lines.append(f"- **Scripted Effects**: {len(undefined_effects)}")
            for effect in undefined_effects[:5]:  # Show first 5
                lines.append(f"  - {effect}")
            if len(undefined_effects) > 5:
                lines.append(f"  - ... and {len(undefined_effects) - 5} more")
        
        if undefined_triggers:
            lines.append(f"- **Scripted Triggers**: {len(undefined_triggers)}")
            for trigger in undefined_triggers[:5]:  # Show first 5
                lines.append(f"  - {trigger}")
            if len(undefined_triggers) > 5:
                lines.append(f"  - ... and {len(undefined_triggers) - 5} more")
        lines.append("")
    
    # Broken event chains
    if broken_event_chains:
        lines.append("## Broken Event Chains")
        lines.append(f"- **Total**: {len(broken_event_chains)}")
        for link in broken_event_chains[:5]:  # Show first 5
            lines.append(f"  - {link.source_event} → {link.target_event} (missing)")
        if len(broken_event_chains) > 5:
            lines.append(f"  - ... and {len(broken_event_chains) - 5} more")
        lines.append("")
    
    # Localization coverage
    lines.append("## Localization Coverage")
    lines.append(f"- **Total Events**: {loc_coverage.total_events}")
    lines.append(f"- **Events with Localization**: {loc_coverage.events_with_loc}")
    lines.append(f"- **Coverage**: {loc_coverage.coverage_percentage}%")
    if loc_coverage.missing_keys:
        lines.append(f"- **Missing Keys**: {len(loc_coverage.missing_keys)}")
        for key in loc_coverage.missing_keys[:5]:
            lines.append(f"  - {key}")
        if len(loc_coverage.missing_keys) > 5:
            lines.append(f"  - ... and {len(loc_coverage.missing_keys) - 5} more")
    
    return "\n".join(lines)


def is_version_compatible(mod_version: str, game_version: str) -> bool:
    """
    Check if a mod version is compatible with the game version.
    
    Handles wildcards like "1.11.*"
    
    Args:
        mod_version: Version from mod descriptor (e.g., "1.11.*")
        game_version: Actual game version (e.g., "1.11.5")
    
    Returns:
        True if compatible
    """
    if not mod_version or not game_version:
        return True  # Assume compatible if no version specified
    
    # Handle wildcard versions
    if '*' in mod_version:
        mod_parts = mod_version.split('.')
        game_parts = game_version.split('.')
        
        for i, part in enumerate(mod_parts):
            if part == '*':
                return True  # Everything after wildcard matches
            if i >= len(game_parts) or part != game_parts[i]:
                return False
        
        return True
    
    # Exact version match
    return mod_version == game_version
