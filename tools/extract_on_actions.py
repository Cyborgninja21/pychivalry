#!/usr/bin/env python3
"""
Extract CK3 on_action definitions and generate YAML file with scope tracking.

Reads: <CK3_INSTALL>/game/common/on_actions/*.txt
Outputs: pychivalry/data/on_actions.yaml

On-actions are event triggers that fire when specific game events occur.
This script extracts their definitions along with scope type information.

Usage:
    python tools/extract_on_actions.py --ck3-path "/path/to/ck3/install"
    python tools/extract_on_actions.py  # Uses default Steam path
"""

import argparse
import re
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Set


# Default CK3 installation path on Linux
DEFAULT_CK3_PATH = Path.home() / ".local/share/Steam/steamapps/common/Crusader Kings III"


# Known scope patterns in on_actions based on common CK3 patterns
# These help us infer scope types when they're not explicitly documented
SCOPE_INFERENCE_PATTERNS = {
    'root': ['character', 'title', 'province', 'faith', 'culture'],
    'actor': ['character'],
    'recipient': ['character'],
    'mother': ['character'],
    'father': ['character'],
    'child': ['character'],
    'killer': ['character'],
    'title': ['landed_title'],
    'province': ['province'],
    'barony': ['landed_title'],
    'county': ['landed_title'],
    'faith': ['faith'],
    'culture': ['culture'],
    'liege': ['character'],
    'vassal': ['character'],
}


def find_matching_brace(text: str, start: int) -> Optional[int]:
    """
    Find the position of the matching closing brace.

    Args:
        text: The text to search in
        start: Starting position (after opening brace)

    Returns:
        Position of matching closing brace, or None if not found
    """
    depth = 1
    pos = start

    while pos < len(text) and depth > 0:
        char = text[pos]

        # Skip strings
        if char == '"':
            pos += 1
            while pos < len(text) and text[pos] != '"':
                if text[pos] == '\\':
                    pos += 2  # Skip escaped characters
                else:
                    pos += 1
            pos += 1
            continue

        # Skip comments
        if char == '#':
            while pos < len(text) and text[pos] != '\n':
                pos += 1
            pos += 1
            continue

        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1

        pos += 1

    return pos - 1 if depth == 0 else None


def parse_on_action_file(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse a CK3 on_action definition file.

    Args:
        file_path: Path to the on_action .txt file

    Returns:
        Dictionary mapping on_action names to their parsed data
    """
    print(f"[INFO] Reading {file_path.name}...")

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    on_actions = {}

    # Pattern to match on_action definitions: on_action_name = { ... }
    on_action_pattern = re.compile(r'^([a-z_][a-z0-9_]*)\s*=\s*\{', re.MULTILINE)
    matches = list(on_action_pattern.finditer(content))

    print(f"  Found {len(matches)} on_action definitions")

    for match in matches:
        on_action_name = match.group(1)
        start_pos = match.end()

        # Find the matching closing brace
        end_pos = find_matching_brace(content, start_pos)

        if end_pos is None:
            print(f"  [WARN] Could not find closing brace for {on_action_name}")
            continue

        on_action_block = content[start_pos:end_pos]

        # Parse the on_action block
        on_action_data = parse_on_action_block(on_action_name, on_action_block)
        on_actions[on_action_name] = on_action_data

    return on_actions


def parse_on_action_block(on_action_name: str, block: str) -> Dict[str, Any]:
    """
    Parse an on_action definition block with scope tracking.

    Extracts on_action properties including:
    - trigger: Conditions for when this on_action fires
    - effect: Effects executed when triggered
    - events: List of events that can be triggered
    - scopes: Inferred scope types available (root, actor, etc.)

    Args:
        on_action_name: Name of the on_action
        block: The on_action definition block content

    Returns:
        Dictionary with on_action metadata including scope information
    """
    on_action_data = {}

    # Extract trigger condition (indicates when on_action fires)
    has_trigger = 'trigger' in block
    if has_trigger:
        on_action_data['has_trigger'] = True

    # Extract effect block (indicates what happens)
    has_effect = 'effect' in block
    if has_effect:
        on_action_data['has_effect'] = True

    # Extract events list
    events = extract_events(block)
    if events:
        on_action_data['events'] = events

    # Extract random_events list
    random_events = extract_random_events(block)
    if random_events:
        on_action_data['random_events'] = random_events

    # Infer scopes from the on_action name and content
    scopes = infer_scopes(on_action_name, block)
    if scopes:
        on_action_data['scopes'] = scopes

    # Generate description from on_action name
    on_action_data['description'] = generate_description(on_action_name)

    return on_action_data


def extract_events(block: str) -> List[str]:
    """
    Extract event IDs from the events = { } block.

    Args:
        block: The on_action block content

    Returns:
        List of event IDs
    """
    events = []

    # Find events block
    events_match = re.search(r'events\s*=\s*\{([^}]*)\}', block, re.DOTALL)
    if events_match:
        events_block = events_match.group(1)
        # Extract event IDs (namespace.number format)
        event_ids = re.findall(r'([a-z_][a-z0-9_]*\.\d+)', events_block)
        events.extend(event_ids)

    return events


def extract_random_events(block: str) -> List[Dict[str, Any]]:
    """
    Extract random event entries from random_events = { } block.

    Args:
        block: The on_action block content

    Returns:
        List of random event entries with weights
    """
    random_events = []

    # Find random_events block
    random_match = re.search(r'random_events\s*=\s*\{([^}]*)\}', block, re.DOTALL)
    if random_match:
        random_block = random_match.group(1)

        # Extract individual random event entries
        # Format: chance_to_happen = X, event = { id = Y }
        entries = re.finditer(r'(\d+)\s*=\s*([a-z_][a-z0-9_]*\.\d+)', random_block)
        for entry in entries:
            weight = int(entry.group(1))
            event_id = entry.group(2)
            random_events.append({
                'weight': weight,
                'event': event_id
            })

    return random_events


def infer_scopes(on_action_name: str, block: str) -> Dict[str, str]:
    """
    Infer available scopes from on_action name and content.

    This uses heuristics to determine what scopes are likely available:
    1. Common patterns in on_action names (on_birth, on_death, etc.)
    2. Scope references in the content (root, actor, etc.)
    3. Known scope patterns from CK3 documentation

    Args:
        on_action_name: The on_action identifier
        block: The on_action block content

    Returns:
        Dictionary mapping scope names to their inferred types
    """
    scopes = {}

    # Default: most on_actions have a root scope
    # Try to infer type from name
    if 'birth' in on_action_name or 'death' in on_action_name or 'marriage' in on_action_name:
        scopes['root'] = 'character'
    elif 'title' in on_action_name or 'county' in on_action_name:
        scopes['root'] = 'landed_title'
    elif 'faith' in on_action_name:
        scopes['root'] = 'faith'
    elif 'culture' in on_action_name:
        scopes['root'] = 'culture'
    else:
        # Default to character for most on_actions
        scopes['root'] = 'character'

    # Look for common scope references in the block
    for scope_name, possible_types in SCOPE_INFERENCE_PATTERNS.items():
        # Check if this scope is referenced in the block
        scope_pattern = rf'\b{scope_name}\s*='
        if re.search(scope_pattern, block):
            # Use the most common type for this scope
            scopes[scope_name] = possible_types[0]

    # Special cases based on on_action patterns
    if 'actor' in on_action_name or 'recipient' in on_action_name:
        scopes['actor'] = 'character'
        scopes['recipient'] = 'character'

    if 'mother' in on_action_name or 'father' in on_action_name:
        scopes['mother'] = 'character'
        scopes['father'] = 'character'

    if 'child' in on_action_name:
        scopes['child'] = 'character'

    return scopes


def generate_description(on_action_name: str) -> str:
    """
    Generate a human-readable description from on_action name.

    Args:
        on_action_name: The on_action identifier

    Returns:
        Human-readable description
    """
    # Convert underscores to spaces and capitalize
    description = on_action_name.replace('_', ' ').replace('on ', 'On ').title()

    # Add context based on common patterns
    if on_action_name.startswith('on_'):
        return f"Triggered {description[3:].lower()}"
    else:
        return description


def extract_all_on_actions(ck3_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Extract all on_action definitions from CK3 installation.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Dictionary of all on_actions
    """
    on_actions_dir = ck3_path / 'game' / 'common' / 'on_action'

    if not on_actions_dir.exists():
        print(f"[ERROR] On_actions directory not found at {on_actions_dir}")
        return {}

    all_on_actions = {}

    print(f"\n[INFO] Scanning {on_actions_dir}...")

    # Process all .txt files in the on_actions directory
    on_action_files = list(on_actions_dir.glob("*.txt"))

    if not on_action_files:
        print(f"[WARN] No on_action files found in {on_actions_dir}")
        return {}

    print(f"[INFO] Found {len(on_action_files)} on_action file(s)")

    for on_action_file in sorted(on_action_files):
        on_actions = parse_on_action_file(on_action_file)
        all_on_actions.update(on_actions)

    print(f"[OK] Successfully parsed {len(all_on_actions)} on_actions total")

    return all_on_actions


def write_yaml_file(on_actions: Dict[str, Dict[str, Any]], output_file: Path):
    """
    Write on_actions to a YAML file.

    Args:
        on_actions: Dictionary of on_action definitions
        output_file: Output file path
    """
    # Create output directory if it doesn't exist
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] Writing YAML file to {output_file}...")

    # Sort on_actions alphabetically
    sorted_on_actions = dict(sorted(on_actions.items()))

    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header comment
        f.write(f"# CK3 On-Actions\n")
        f.write(f"# Auto-generated from CK3 game files (game/common/on_action/)\n")
        f.write(f"# Total on_actions: {len(on_actions)}\n")
        f.write(f"#\n")
        f.write(f"# On-actions are triggered when specific game events occur.\n")
        f.write(f"# Each on_action includes inferred scope information for validation.\n")
        f.write(f"#\n")
        f.write(f"# Structure:\n")
        f.write(f"#   on_action_name:\n")
        f.write(f"#     description: Human-readable description\n")
        f.write(f"#     scopes: Available scopes (root, actor, etc.) with their types\n")
        f.write(f"#     events: List of events that can be triggered\n")
        f.write(f"#     has_trigger: Whether this on_action has a trigger condition\n")
        f.write(f"#     has_effect: Whether this on_action has an effect block\n\n")

        # Write YAML
        yaml.dump(sorted_on_actions, f,
                 default_flow_style=False,
                 sort_keys=False,
                 allow_unicode=True,
                 width=100)

    print(f"[OK] {output_file.name}: {len(on_actions)} on_actions")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract CK3 on_actions with scope tracking and generate YAML data file"
    )
    parser.add_argument(
        '--ck3-path',
        type=Path,
        default=DEFAULT_CK3_PATH,
        help=f"Path to CK3 installation (default: {DEFAULT_CK3_PATH})"
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).parent.parent / 'pychivalry' / 'data' / 'on_actions.yaml',
        help="Output file for YAML data"
    )

    args = parser.parse_args()

    # Validate CK3 path
    if not args.ck3_path.exists():
        print(f"[ERROR] CK3 installation not found at {args.ck3_path}")
        print(f"        Please specify correct CK3 path with --ck3-path")
        return 1

    print(f"[INFO] CK3 Installation: {args.ck3_path}")
    print(f"[INFO] Output file: {args.output}")
    print()

    # Extract on_actions
    on_actions = extract_all_on_actions(args.ck3_path)

    if not on_actions:
        print("[ERROR] No on_actions extracted")
        return 1

    # Write YAML file
    write_yaml_file(on_actions, args.output)

    print("\n[DONE] On-action extraction complete.")
    print(f"\nExtracted {len(on_actions)} on_actions with scope information")

    # Print statistics
    with_scopes = sum(1 for oa in on_actions.values() if 'scopes' in oa)
    with_events = sum(1 for oa in on_actions.values() if 'events' in oa)
    with_trigger = sum(1 for oa in on_actions.values() if 'has_trigger' in oa)

    print(f"\nStatistics:")
    print(f"  - On-actions with scope info: {with_scopes}")
    print(f"  - On-actions with events: {with_events}")
    print(f"  - On-actions with triggers: {with_trigger}")

    return 0


if __name__ == '__main__':
    exit(main())
