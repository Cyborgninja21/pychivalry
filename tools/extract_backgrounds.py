#!/usr/bin/env python3
"""
Extract CK3 event background definitions and generate YAML file.

Reads: <CK3_INSTALL>/game/common/event_backgrounds/*.txt
Outputs: pychivalry/data/backgrounds.yaml

Usage:
    python tools/extract_backgrounds.py --ck3-path "/path/to/ck3/install"
    python tools/extract_backgrounds.py  # Uses default Steam path
"""

import argparse
import re
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional


# Default CK3 installation path on Linux
DEFAULT_CK3_PATH = Path.home() / ".local/share/Steam/steamapps/common/Crusader Kings III"


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


def parse_background_file(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse a CK3 background definition file.

    Args:
        file_path: Path to the background .txt file

    Returns:
        Dictionary mapping background names to their parsed data
    """
    print(f"[INFO] Reading {file_path.name}...")

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    backgrounds = {}

    # Pattern to match background definitions: background_name = { ... }
    background_pattern = re.compile(r'^([a-z_][a-z0-9_]*)\s*=\s*\{', re.MULTILINE)
    matches = list(background_pattern.finditer(content))

    print(f"  Found {len(matches)} background definitions")

    for match in matches:
        background_name = match.group(1)
        start_pos = match.end()

        # Find the matching closing brace
        end_pos = find_matching_brace(content, start_pos)

        if end_pos is None:
            print(f"  [WARN] Could not find closing brace for {background_name}")
            continue

        background_block = content[start_pos:end_pos]

        # Parse the background block
        background_data = parse_background_block(background_name, background_block)
        backgrounds[background_name] = background_data

    return backgrounds


def parse_background_block(background_name: str, block: str) -> Dict[str, Any]:
    """
    Parse a background definition block.

    Extracts background properties including:
    - texture: Background texture/image reference
    - reference: Reference to another background (inheritance)
    - environment: Associated environment
    - camera: Camera settings

    Args:
        background_name: Name of the background
        block: The background definition block content

    Returns:
        Dictionary with background metadata
    """
    background_data = {}

    # Extract texture
    texture_match = re.search(r'texture\s*=\s*"([^"]+)"', block)
    if texture_match:
        background_data['texture'] = texture_match.group(1)

    # Extract reference (inheritance)
    reference_match = re.search(r'reference\s*=\s*([a-z_][a-z0-9_]*)', block)
    if reference_match:
        background_data['reference'] = reference_match.group(1)

    # Extract environment
    environment_match = re.search(r'environment\s*=\s*"?([a-z_][a-z0-9_]*)"?', block)
    if environment_match:
        background_data['environment'] = environment_match.group(1)

    # Extract camera type
    camera_match = re.search(r'camera\s*=\s*([a-z_][a-z0-9_]*)', block)
    if camera_match:
        background_data['camera'] = camera_match.group(1)

    # Extract scripted_animation blocks (multiple possible)
    scripted_animations = re.findall(r'scripted_animation\s*=\s*"([^"]+)"', block)
    if scripted_animations:
        background_data['scripted_animations'] = scripted_animations

    # Generate description from background name
    background_data['description'] = generate_description(background_name)

    return background_data


def generate_description(background_name: str) -> str:
    """
    Generate a human-readable description from background name.

    Args:
        background_name: The background identifier

    Returns:
        Human-readable description
    """
    # Convert underscores to spaces and capitalize
    return background_name.replace('_', ' ').title()


def extract_all_backgrounds(ck3_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Extract all background definitions from CK3 installation.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Dictionary of all backgrounds
    """
    backgrounds_dir = ck3_path / 'game' / 'common' / 'event_backgrounds'

    if not backgrounds_dir.exists():
        print(f"[ERROR] Backgrounds directory not found at {backgrounds_dir}")
        return {}

    all_backgrounds = {}

    print(f"\n[INFO] Scanning {backgrounds_dir}...")

    # Process all .txt files in the backgrounds directory
    background_files = list(backgrounds_dir.glob("*.txt"))

    if not background_files:
        print(f"[WARN] No background files found in {backgrounds_dir}")
        return {}

    print(f"[INFO] Found {len(background_files)} background file(s)")

    for background_file in sorted(background_files):
        backgrounds = parse_background_file(background_file)
        all_backgrounds.update(backgrounds)

    print(f"[OK] Successfully parsed {len(all_backgrounds)} backgrounds total")

    return all_backgrounds


def write_yaml_file(backgrounds: Dict[str, Dict[str, Any]], output_file: Path):
    """
    Write backgrounds to a YAML file.

    Args:
        backgrounds: Dictionary of background definitions
        output_file: Output file path
    """
    # Create output directory if it doesn't exist
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] Writing YAML file to {output_file}...")

    # Sort backgrounds alphabetically
    sorted_backgrounds = dict(sorted(backgrounds.items()))

    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header comment
        f.write(f"# CK3 Event Backgrounds\n")
        f.write(f"# Auto-generated from CK3 game files (game/common/event_backgrounds/)\n")
        f.write(f"# Total backgrounds: {len(backgrounds)}\n")
        f.write(f"#\n")
        f.write(f"# These backgrounds control the visual backdrop of events.\n")
        f.write(f"# Usage in events: background = <background_name>\n\n")

        # Write YAML
        yaml.dump(sorted_backgrounds, f,
                 default_flow_style=False,
                 sort_keys=False,
                 allow_unicode=True,
                 width=100)

    print(f"[OK] {output_file.name}: {len(backgrounds)} backgrounds")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract CK3 event backgrounds and generate YAML data file"
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
        default=Path(__file__).parent.parent / 'pychivalry' / 'data' / 'backgrounds.yaml',
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

    # Extract backgrounds
    backgrounds = extract_all_backgrounds(args.ck3_path)

    if not backgrounds:
        print("[ERROR] No backgrounds extracted")
        return 1

    # Write YAML file
    write_yaml_file(backgrounds, args.output)

    print("\n[DONE] Background extraction complete.")
    print(f"\nExtracted {len(backgrounds)} backgrounds:")
    for background_name in sorted(backgrounds.keys()):
        print(f"  - {background_name}")

    return 0


if __name__ == '__main__':
    exit(main())
