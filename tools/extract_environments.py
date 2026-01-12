#!/usr/bin/env python3
"""
Extract CK3 event environment definitions and generate YAML file.

Reads: <CK3_INSTALL>/game/gfx/portraits/environments/*.txt
Outputs: pychivalry/data/environments.yaml

Usage:
    python tools/extract_environments.py --ck3-path "/path/to/ck3/install"
    python tools/extract_environments.py  # Uses default Steam path
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


def parse_environment_file(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse a CK3 environment definition file.

    Args:
        file_path: Path to the environment .txt file

    Returns:
        Dictionary mapping environment names to their parsed data
    """
    print(f"[INFO] Reading {file_path.name}...")

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    environments = {}

    # Pattern to match environment definitions: environment_name = { ... }
    environment_pattern = re.compile(r'^([a-z_][a-z0-9_]*)\s*=\s*\{', re.MULTILINE)
    matches = list(environment_pattern.finditer(content))

    print(f"  Found {len(matches)} environment definitions")

    for match in matches:
        environment_name = match.group(1)
        start_pos = match.end()

        # Find the matching closing brace
        end_pos = find_matching_brace(content, start_pos)

        if end_pos is None:
            print(f"  [WARN] Could not find closing brace for {environment_name}")
            continue

        environment_block = content[start_pos:end_pos]

        # Parse the environment block
        environment_data = parse_environment_block(environment_name, environment_block)
        environments[environment_name] = environment_data

    return environments


def parse_environment_block(environment_name: str, block: str) -> Dict[str, Any]:
    """
    Parse an environment definition block.

    Extracts environment properties including:
    - cubemap: Cubemap texture reference
    - ambient_light: Ambient lighting color
    - sun_light: Directional sun light settings
    - fog: Fog settings

    Args:
        environment_name: Name of the environment
        block: The environment definition block content

    Returns:
        Dictionary with environment metadata
    """
    environment_data = {}

    # Extract cubemap
    cubemap_match = re.search(r'cubemap\s*=\s*"([^"]+)"', block)
    if cubemap_match:
        environment_data['cubemap'] = cubemap_match.group(1)

    # Extract ambient_light color
    ambient_match = re.search(r'ambient_light\s*=\s*\{([^}]+)\}', block)
    if ambient_match:
        ambient_block = ambient_match.group(1)
        # Extract RGB values
        rgb = re.findall(r'([\d.]+)', ambient_block)
        if len(rgb) >= 3:
            environment_data['ambient_light'] = {
                'r': float(rgb[0]),
                'g': float(rgb[1]),
                'b': float(rgb[2])
            }

    # Extract sun_light direction
    sun_match = re.search(r'sun_light\s*=\s*\{([^}]+)\}', block)
    if sun_match:
        sun_block = sun_match.group(1)
        # Extract direction values
        direction = re.findall(r'([-]?[\d.]+)', sun_block)
        if len(direction) >= 3:
            environment_data['sun_light'] = {
                'x': float(direction[0]),
                'y': float(direction[1]),
                'z': float(direction[2])
            }

    # Extract reference (inheritance)
    reference_match = re.search(r'reference\s*=\s*([a-z_][a-z0-9_]*)', block)
    if reference_match:
        environment_data['reference'] = reference_match.group(1)

    # Generate description from environment name
    environment_data['description'] = generate_description(environment_name)

    return environment_data


def generate_description(environment_name: str) -> str:
    """
    Generate a human-readable description from environment name.

    Args:
        environment_name: The environment identifier

    Returns:
        Human-readable description
    """
    # Convert underscores to spaces and capitalize
    return environment_name.replace('_', ' ').title()


def extract_all_environments(ck3_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Extract all environment definitions from CK3 installation.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Dictionary of all environments
    """
    # Try multiple possible locations
    possible_paths = [
        ck3_path / 'game' / 'gfx' / 'portraits' / 'environments',
        ck3_path / 'game' / 'common' / 'event_environments',
    ]

    environments_dir = None
    for path in possible_paths:
        if path.exists():
            environments_dir = path
            break

    if environments_dir is None:
        print(f"[ERROR] Environments directory not found. Tried:")
        for path in possible_paths:
            print(f"  - {path}")
        return {}

    all_environments = {}

    print(f"\n[INFO] Scanning {environments_dir}...")

    # Process all .txt files in the environments directory
    environment_files = list(environments_dir.glob("*.txt"))

    if not environment_files:
        print(f"[WARN] No environment files found in {environments_dir}")
        return {}

    print(f"[INFO] Found {len(environment_files)} environment file(s)")

    for environment_file in sorted(environment_files):
        environments = parse_environment_file(environment_file)
        all_environments.update(environments)

    print(f"[OK] Successfully parsed {len(all_environments)} environments total")

    return all_environments


def write_yaml_file(environments: Dict[str, Dict[str, Any]], output_file: Path):
    """
    Write environments to a YAML file.

    Args:
        environments: Dictionary of environment definitions
        output_file: Output file path
    """
    # Create output directory if it doesn't exist
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] Writing YAML file to {output_file}...")

    # Sort environments alphabetically
    sorted_environments = dict(sorted(environments.items()))

    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header comment
        f.write(f"# CK3 Event Environments\n")
        f.write(f"# Auto-generated from CK3 game files\n")
        f.write(f"# Total environments: {len(environments)}\n")
        f.write(f"#\n")
        f.write(f"# These environments control lighting and atmospheric effects for events.\n")
        f.write(f"# Usage in backgrounds: environment = <environment_name>\n\n")

        # Write YAML
        yaml.dump(sorted_environments, f,
                 default_flow_style=False,
                 sort_keys=False,
                 allow_unicode=True,
                 width=100)

    print(f"[OK] {output_file.name}: {len(environments)} environments")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract CK3 event environments and generate YAML data file"
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
        default=Path(__file__).parent.parent / 'pychivalry' / 'data' / 'environments.yaml',
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

    # Extract environments
    environments = extract_all_environments(args.ck3_path)

    if not environments:
        print("[ERROR] No environments extracted")
        return 1

    # Write YAML file
    write_yaml_file(environments, args.output)

    print("\n[DONE] Environment extraction complete.")
    print(f"\nExtracted {len(environments)} environments:")
    for environment_name in sorted(environments.keys()):
        print(f"  - {environment_name}")

    return 0


if __name__ == '__main__':
    exit(main())
