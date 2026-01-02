#!/usr/bin/env python3
"""
Extract CK3 trait definitions and generate YAML files.

Reads: <CK3_INSTALL>/game/common/traits/00_traits.txt
Outputs: pychivalry/data/traits/*.yaml (categorized by trait type)

Usage:
    python tools/extract_traits.py --ck3-path "/path/to/ck3/install"
    python tools/extract_traits.py  # Uses default Steam path
"""

import argparse
import re
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict


# Default CK3 installation path on Linux
DEFAULT_CK3_PATH = Path.home() / ".local/share/Steam/steamapps/common/Crusader Kings III"


# Trait category mappings for organizing YAML files
CATEGORY_MAPPINGS = {
    'education': 'education',
    'personality': 'personality',
    'commander_trait': 'commander',
    'fame': 'fame',
    'lifestyle': 'lifestyle',
    'childhood': 'childhood',
    'health': 'health',
    'physical': 'physical',
    'dynasty_house': 'dynasty',
    'court': 'special',
    'track': 'special',
    'fame_type': 'fame',
}


def parse_ck3_trait_file(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse a CK3 trait definition file.
    
    Args:
        file_path: Path to the 00_traits.txt file
        
    Returns:
        Dictionary mapping trait names to their parsed data
    """
    print(f"📖 Reading {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    traits = {}
    
    # Pattern to match trait definitions: trait_name = { ... }
    # We'll use a simpler approach: find trait names, then extract their blocks
    
    # Find all trait names
    trait_pattern = re.compile(r'^([a-z_][a-z0-9_]*)\s*=\s*\{', re.MULTILINE)
    matches = list(trait_pattern.finditer(content))
    
    print(f"Found {len(matches)} trait definitions")
    
    for i, match in enumerate(matches):
        trait_name = match.group(1)
        start_pos = match.end()
        
        # Find the matching closing brace
        end_pos = find_matching_brace(content, start_pos)
        
        if end_pos is None:
            print(f"⚠️  Warning: Could not find closing brace for {trait_name}")
            continue
        
        trait_block = content[start_pos:end_pos]
        
        # Parse the trait block
        trait_data = parse_trait_block(trait_name, trait_block)
        traits[trait_name] = trait_data
    
    print(f"✅ Successfully parsed {len(traits)} traits")
    return traits


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
        
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
        
        pos += 1
    
    return pos - 1 if depth == 0 else None


def parse_trait_block(trait_name: str, block: str) -> Dict[str, Any]:
    """
    Parse a trait definition block.
    
    Extracts:
    - category
    - opposites
    - group
    - level
    - description (from desc key or computed)
    
    Args:
        trait_name: Name of the trait
        block: The trait definition block content
        
    Returns:
        Dictionary with trait metadata
    """
    trait_data = {
        'name': trait_name,
        'category': None,
        'opposites': [],
        'group': None,
        'level': None,
        'description': None,
    }
    
    # Extract category
    category_match = re.search(r'category\s*=\s*([a-z_]+)', block)
    if category_match:
        trait_data['category'] = category_match.group(1)
    
    # Extract opposites block
    opposites_match = re.search(r'opposites\s*=\s*\{([^}]+)\}', block)
    if opposites_match:
        opposites_block = opposites_match.group(1)
        # Extract trait names from opposites block
        opposite_traits = re.findall(r'([a-z_][a-z0-9_]*)', opposites_block)
        trait_data['opposites'] = opposite_traits
    
    # Extract group
    group_match = re.search(r'group\s*=\s*([a-z_]+)', block)
    if group_match:
        trait_data['group'] = group_match.group(1)
    
    # Extract level
    level_match = re.search(r'level\s*=\s*(\d+)', block)
    if level_match:
        trait_data['level'] = int(level_match.group(1))
    
    # Generate description from trait name
    trait_data['description'] = generate_description(trait_name, trait_data)
    
    return trait_data


def generate_description(trait_name: str, trait_data: Dict[str, Any]) -> str:
    """
    Generate a human-readable description from trait name and data.
    
    Args:
        trait_name: The trait identifier
        trait_data: Parsed trait metadata
        
    Returns:
        Human-readable description
    """
    # For education traits
    if trait_name.startswith('education_'):
        parts = trait_name.split('_')
        if len(parts) >= 3:
            skill = parts[1].capitalize()
            level = parts[2]
            return f"{skill} education level {level}"
    
    # For lifestyle traits
    if trait_name.startswith('lifestyle_'):
        lifestyle = trait_name.replace('lifestyle_', '').replace('_', ' ').title()
        return f"Lifestyle trait: {lifestyle}"
    
    # For fame/level traits
    if re.match(r'(fame|devotion|splendor)_\d+', trait_name):
        parts = trait_name.split('_')
        return f"{parts[0].capitalize()} level {parts[1]}"
    
    # Default: convert underscores to spaces and capitalize
    return trait_name.replace('_', ' ').title()


def categorize_traits(traits: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Dict[str, Any]]]:
    """
    Group traits by category for organized YAML files.
    
    Args:
        traits: Dictionary of all traits
        
    Returns:
        Dictionary mapping category names to trait dictionaries
    """
    categorized = defaultdict(dict)
    
    for trait_name, trait_data in traits.items():
        category = trait_data.get('category')
        
        # Map CK3 category to our file category
        file_category = CATEGORY_MAPPINGS.get(category, 'special')
        
        # Store trait without the 'name' field (redundant as key)
        trait_info = {k: v for k, v in trait_data.items() if k != 'name' and v is not None}
        
        categorized[file_category][trait_name] = trait_info
    
    return dict(categorized)


def write_yaml_files(categorized: Dict[str, Dict[str, Dict[str, Any]]], output_dir: Path):
    """
    Write categorized traits to separate YAML files.
    
    Args:
        categorized: Traits grouped by category
        output_dir: Output directory for YAML files
    """
    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n📝 Writing YAML files to {output_dir}...")
    
    for category, traits in sorted(categorized.items()):
        output_file = output_dir / f"{category}.yaml"
        
        # Sort traits alphabetically
        sorted_traits = dict(sorted(traits.items()))
        
        with open(output_file, 'w', encoding='utf-8') as f:
            # Write header comment
            f.write(f"# CK3 {category.capitalize()} Traits\n")
            f.write(f"# Auto-generated from CK3 game files\n")
            f.write(f"# Total traits: {len(traits)}\n\n")
            
            # Write YAML
            yaml.dump(sorted_traits, f, 
                     default_flow_style=False, 
                     sort_keys=False,
                     allow_unicode=True,
                     width=100)
        
        print(f"  ✅ {output_file.name}: {len(traits)} traits")
    
    # Print summary
    total_traits = sum(len(traits) for traits in categorized.values())
    print(f"\n✨ Total: {total_traits} traits in {len(categorized)} categories")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract CK3 traits and generate YAML data files"
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
        default=Path(__file__).parent.parent / 'pychivalry' / 'data' / 'traits',
        help="Output directory for YAML files"
    )
    
    args = parser.parse_args()
    
    # Construct path to traits file
    traits_file = args.ck3_path / 'game' / 'common' / 'traits' / '00_traits.txt'
    
    if not traits_file.exists():
        print(f"❌ Error: Trait file not found at {traits_file}")
        print(f"   Please specify correct CK3 path with --ck3-path")
        return 1
    
    print(f"🎮 CK3 Installation: {args.ck3_path}")
    print(f"📂 Output directory: {args.output}")
    print()
    
    # Parse traits
    traits = parse_ck3_trait_file(traits_file)
    
    # Categorize traits
    print("\n📊 Categorizing traits...")
    categorized = categorize_traits(traits)
    
    # Write YAML files
    write_yaml_files(categorized, args.output)
    
    print("\n✅ Done! Trait extraction complete.")
    return 0


if __name__ == '__main__':
    exit(main())
