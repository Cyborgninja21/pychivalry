#!/usr/bin/env python3
"""
Extract CK3 event theme definitions and generate YAML file.

Reads: <CK3_INSTALL>/game/common/event_themes/*.txt
Outputs: pychivalry/data/themes.yaml

Usage:
    python tools/extract_themes.py --ck3-path "/path/to/ck3/install"
    python tools/extract_themes.py  # Uses default Steam path
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


def parse_theme_file(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse a CK3 theme definition file.

    Args:
        file_path: Path to the theme .txt file

    Returns:
        Dictionary mapping theme names to their parsed data
    """
    print(f"[INFO] Reading {file_path.name}...")

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    themes = {}

    # Pattern to match theme definitions: theme_name = { ... }
    theme_pattern = re.compile(r'^([a-z_][a-z0-9_]*)\s*=\s*\{', re.MULTILINE)
    matches = list(theme_pattern.finditer(content))

    print(f"  Found {len(matches)} theme definitions")

    for match in matches:
        theme_name = match.group(1)
        start_pos = match.end()

        # Find the matching closing brace
        end_pos = find_matching_brace(content, start_pos)

        if end_pos is None:
            print(f"  [WARN] Could not find closing brace for {theme_name}")
            continue

        theme_block = content[start_pos:end_pos]

        # Parse the theme block
        theme_data = parse_theme_block(theme_name, theme_block)
        themes[theme_name] = theme_data

    return themes


def parse_theme_block(theme_name: str, block: str) -> Dict[str, Any]:
    """
    Parse a theme definition block.

    Extracts theme properties including:
    - icon: Theme icon reference
    - sound: Associated sound effect
    - soundeffect: Alternative sound effect property
    - background: Background image or texture
    -
    Args:
        theme_name: Name of the theme
        block: The theme definition block content

    Returns:
        Dictionary with theme metadata
    """
    theme_data = {}

    # Extract icon
    icon_match = re.search(r'icon\s*=\s*"([^"]+)"', block)
    if icon_match:
        theme_data['icon'] = icon_match.group(1)

    # Extract sound
    sound_match = re.search(r'sound\s*=\s*"([^"]+)"', block)
    if sound_match:
        theme_data['sound'] = sound_match.group(1)

    # Extract soundeffect (alternative property)
    soundeffect_match = re.search(r'soundeffect\s*=\s*"([^"]+)"', block)
    if soundeffect_match:
        theme_data['soundeffect'] = soundeffect_match.group(1)

    # Extract background
    background_match = re.search(r'background\s*=\s*"([^"]+)"', block)
    if background_match:
        theme_data['background'] = background_match.group(1)

    # Generate description from theme name
    theme_data['description'] = generate_description(theme_name)

    return theme_data


def generate_description(theme_name: str) -> str:
    """
    Generate a human-readable description from theme name.

    Args:
        theme_name: The theme identifier

    Returns:
        Human-readable description
    """
    # Convert underscores to spaces and capitalize
    return theme_name.replace('_', ' ').title()


def extract_all_themes(ck3_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Extract all theme definitions from CK3 installation.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Dictionary of all themes
    """
    themes_dir = ck3_path / 'game' / 'common' / 'event_themes'

    if not themes_dir.exists():
        print(f"[ERROR] Themes directory not found at {themes_dir}")
        return {}

    all_themes = {}

    print(f"\n[INFO] Scanning {themes_dir}...")

    # Process all .txt files in the themes directory
    theme_files = list(themes_dir.glob("*.txt"))

    if not theme_files:
        print(f"[WARN] No theme files found in {themes_dir}")
        return {}

    print(f"[INFO] Found {len(theme_files)} theme file(s)")

    for theme_file in sorted(theme_files):
        themes = parse_theme_file(theme_file)
        all_themes.update(themes)

    print(f"[OK] Successfully parsed {len(all_themes)} themes total")

    return all_themes


def write_yaml_file(themes: Dict[str, Dict[str, Any]], output_file: Path):
    """
    Write themes to a YAML file.

    Args:
        themes: Dictionary of theme definitions
        output_file: Output file path
    """
    # Create output directory if it doesn't exist
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] Writing YAML file to {output_file}...")

    # Sort themes alphabetically
    sorted_themes = dict(sorted(themes.items()))

    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header comment
        f.write(f"# CK3 Event Themes\n")
        f.write(f"# Auto-generated from CK3 game files (game/common/event_themes/)\n")
        f.write(f"# Total themes: {len(themes)}\n")
        f.write(f"#\n")
        f.write(f"# These themes control the visual and audio presentation of events.\n")
        f.write(f"# Usage in events: theme = <theme_name>\n\n")

        # Write YAML
        yaml.dump(sorted_themes, f,
                 default_flow_style=False,
                 sort_keys=False,
                 allow_unicode=True,
                 width=100)

    print(f"[OK] {output_file.name}: {len(themes)} themes")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract CK3 event themes and generate YAML data file"
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
        default=Path(__file__).parent.parent / 'pychivalry' / 'data' / 'themes.yaml',
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

    # Extract themes
    themes = extract_all_themes(args.ck3_path)

    if not themes:
        print("[ERROR] No themes extracted")
        return 1

    # Write YAML file
    write_yaml_file(themes, args.output)

    print("\n[DONE] Theme extraction complete.")
    print(f"\nExtracted {len(themes)} themes:")
    for theme_name in sorted(themes.keys()):
        print(f"  - {theme_name}")

    return 0


if __name__ == '__main__':
    exit(main())
