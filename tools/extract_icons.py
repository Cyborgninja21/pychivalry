#!/usr/bin/env python3
"""
Extract CK3 icon references from localization and GFX files.

CK3 icons are referenced in two ways:
1. Direct references: @gold_icon!, @prestige_icon!, @death_icon!
2. Named icons: Standard icon names used in localization

Reads:
- <CK3_INSTALL>/game/localization/english/*_l_english.yml (for icon usage)
- <CK3_INSTALL>/game/gfx/interface/icons/*.dds (for available icons)
- <CK3_INSTALL>/game/common/named_colors/*.txt (for color references)

Outputs: pychivalry/data/icons/icons.yaml

Usage:
    python tools/extract_icons.py --ck3-path "/path/to/ck3/install"
    python tools/extract_icons.py  # Uses default Steam path
"""

import argparse
import re
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict
import yaml


# Default CK3 installation path (platform-specific)
DEFAULT_CK3_PATH = Path.home() / ".local/share/Steam/steamapps/common/Crusader Kings III"


# Standard icon categories and their patterns
ICON_CATEGORIES = {
    'resources': ['gold', 'prestige', 'piety', 'dread', 'stress', 'tyranny', 'renown', 'devotion', 'splendor'],
    'character': ['prowess', 'health', 'fertility', 'age', 'diplomacy', 'martial', 'stewardship', 'intrigue', 'learning'],
    'relationships': ['opinion', 'hook', 'weak_hook', 'strong_hook', 'lover', 'friend', 'rival', 'soulmate'],
    'military': ['knight', 'levy', 'army', 'men_at_arms', 'siege', 'combat_rating', 'advantage'],
    'titles': ['title', 'county', 'duchy', 'kingdom', 'empire', 'barony', 'claim', 'de_jure'],
    'council': ['council', 'councillor', 'chancellor', 'steward', 'marshal', 'spymaster', 'court_chaplain'],
    'religion': ['faith', 'religion', 'doctrine', 'tenet', 'clergy', 'devotion'],
    'culture': ['culture', 'innovation', 'tradition', 'ethos'],
    'ui': ['warning', 'info', 'death', 'yes', 'no', 'success', 'failure', 'alert'],
    'traits': ['trait', 'genetic', 'personality', 'education', 'lifestyle', 'fame'],
    'buildings': ['building', 'holding', 'fort_level', 'garrison'],
    'schemes': ['scheme', 'murder', 'fabricate_hook', 'seduce', 'elope', 'befriend'],
}


def extract_icons_from_localization(ck3_path: Path) -> Set[str]:
    """
    Extract icon references from localization files.

    Looks for patterns like: @icon_name!

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Set of icon names found
    """
    loc_dir = ck3_path / "game" / "localization" / "english"

    if not loc_dir.exists():
        print(f"[WARN] Localization directory not found: {loc_dir}")
        return set()

    icons = set()
    yml_files = list(loc_dir.glob("*_l_english.yml"))

    print(f"[INFO] Scanning {len(yml_files)} localization files for icon references...")

    # Pattern: @icon_name! or @icon_name_icon!
    icon_pattern = re.compile(r'@([a-z0-9_]+)!')

    for yml_file in yml_files:
        try:
            with open(yml_file, 'r', encoding='utf-8-sig') as f:
                content = f.read()

            matches = icon_pattern.findall(content)
            icons.update(matches)

        except Exception as e:
            print(f"[WARN] Error reading {yml_file.name}: {e}")

    print(f"  [+] Found {len(icons)} unique icon references")
    return icons


def extract_icons_from_gfx_files(ck3_path: Path) -> Set[str]:
    """
    Extract icon names from GFX definition files.

    GFX files define sprite sheets and icon references.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Set of icon names from GFX definitions
    """
    gfx_dir = ck3_path / "game" / "gfx" / "interface" / "icons"

    if not gfx_dir.exists():
        print(f"[WARN] GFX icons directory not found: {gfx_dir}")
        return set()

    icons = set()

    # Scan for .dds image files (Direct Draw Surface)
    dds_files = list(gfx_dir.rglob("*.dds"))
    print(f"[INFO] Found {len(dds_files)} icon image files in {gfx_dir}")

    for dds_file in dds_files:
        # Extract icon name from filename (without extension)
        icon_name = dds_file.stem

        # Normalize: remove common suffixes
        icon_name = icon_name.replace('_icon', '').replace('_bg', '')

        if icon_name:
            icons.add(icon_name)

    print(f"  [+] Extracted {len(icons)} icon names from file names")
    return icons


def parse_gui_files_for_icons(ck3_path: Path) -> Set[str]:
    """
    Parse GUI files for icon definitions.

    GUI files contain icon type definitions and references.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Set of icon names from GUI files
    """
    gui_dir = ck3_path / "game" / "gui"

    if not gui_dir.exists():
        print(f"[WARN] GUI directory not found: {gui_dir}")
        return set()

    icons = set()
    gui_files = list(gui_dir.rglob("*.gui"))

    print(f"[INFO] Scanning {len(gui_files)} GUI files for icon definitions...")

    # Pattern: icon = { name = "icon_name" ... }
    icon_def_pattern = re.compile(r'name\s*=\s*"([a-z0-9_]+_icon)"', re.IGNORECASE)

    for gui_file in gui_files:
        try:
            with open(gui_file, 'r', encoding='utf-8') as f:
                content = f.read()

            matches = icon_def_pattern.findall(content)
            # Remove '_icon' suffix for consistency
            icons.update(m.replace('_icon', '') for m in matches)

        except Exception as e:
            print(f"[WARN] Error reading {gui_file.name}: {e}")

    print(f"  [+] Found {len(icons)} icon definitions in GUI files")
    return icons


def categorize_icons(icons: Set[str]) -> Dict[str, List[str]]:
    """
    Categorize icons by type/usage.

    Args:
        icons: Set of icon names

    Returns:
        Dictionary mapping categories to icon lists
    """
    categorized = defaultdict(list)

    for icon in sorted(icons):
        categorized_flag = False

        # Try to match against known categories
        for category, keywords in ICON_CATEGORIES.items():
            if any(keyword in icon for keyword in keywords):
                categorized[category].append(icon)
                categorized_flag = True
                break

        # If no match, add to 'other'
        if not categorized_flag:
            categorized['other'].append(icon)

    return dict(categorized)


def generate_icon_metadata(icons: Set[str]) -> Dict[str, Dict[str, str]]:
    """
    Generate metadata for each icon.

    Args:
        icons: Set of icon names

    Returns:
        Dictionary mapping icon names to metadata
    """
    metadata = {}

    for icon in sorted(icons):
        # Infer category
        category = 'other'
        for cat, keywords in ICON_CATEGORIES.items():
            if any(keyword in icon for keyword in keywords):
                category = cat
                break

        # Generate description from icon name
        description = icon.replace('_', ' ').title()

        metadata[icon] = {
            'category': category,
            'description': description,
            'reference': f'@{icon}!'
        }

    return metadata


def write_icon_files(icons: Set[str], output_dir: Path):
    """
    Write extracted icons to YAML files.

    Args:
        icons: Set of icon names
        output_dir: Output directory for YAML files
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate metadata
    icon_metadata = generate_icon_metadata(icons)

    # Write main icons file
    icons_file = output_dir / "icons.yaml"

    with open(icons_file, 'w', encoding='utf-8') as f:
        f.write("# CK3 Icon References\n")
        f.write("# Auto-generated from CK3 localization and GFX files\n")
        f.write(f"# Total icons: {len(icon_metadata)}\n")
        f.write("# Format: icon_name -> {category, description, reference}\n")
        f.write("#\n")
        f.write("# Usage in localization: @icon_name!\n")
        f.write("# Example: @gold_icon! displays the gold coin icon\n\n")
        yaml.dump(icon_metadata, f, default_flow_style=False, sort_keys=True)

    print(f"[OK] Written {len(icon_metadata)} icons to {icons_file}")

    # Write categorized index
    categories = categorize_icons(icons)
    index_file = output_dir / "categories.yaml"

    with open(index_file, 'w', encoding='utf-8') as f:
        f.write("# CK3 Icon Categories\n")
        f.write("# Auto-generated categorization for easier navigation\n\n")
        yaml.dump(categories, f, default_flow_style=False, sort_keys=True)

    print(f"[OK] Written category index with {len(categories)} categories to {index_file}")

    # Create README
    readme_file = output_dir / "README.md"
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write("# CK3 Icon References Data\n\n")
        f.write("This directory contains extracted icon reference data from your CK3 installation.\n\n")
        f.write("## Files\n\n")
        f.write("- `icons.yaml` - All icon references with metadata\n")
        f.write("- `categories.yaml` - Icons organized by category\n\n")
        f.write("## What are Icon References?\n\n")
        f.write("Icons are inline graphics used in CK3 localization:\n\n")
        f.write("```\n")
        f.write("@gold_icon!      -> Gold coin icon\n")
        f.write("@prestige_icon!  -> Prestige icon\n")
        f.write("@death_icon!     -> Skull icon\n")
        f.write("```\n\n")
        f.write("## Categories\n\n")
        for category, icon_list in sorted(categories.items()):
            f.write(f"### {category.title()} ({len(icon_list)} icons)\n\n")
            # Show first 10 icons as examples
            examples = icon_list[:10]
            for icon in examples:
                f.write(f"- `@{icon}!`\n")
            if len(icon_list) > 10:
                f.write(f"- ... and {len(icon_list) - 10} more\n")
            f.write("\n")

        f.write("## Usage in Mods\n\n")
        f.write("This data enables:\n")
        f.write("- **Validation**: Warns when you use a non-existent icon\n")
        f.write("- **Completions**: Auto-complete icon names in `@...!` patterns\n")
        f.write("- **Hover Docs**: Shows icon description when you hover over it\n\n")
        f.write("## Copyright Notice\n\n")
        f.write("Icon data is © Paradox Interactive AB. This data is extracted from your\n")
        f.write("personal CK3 installation for modding assistance only. Do not redistribute.\n\n")
        f.write("## Regenerating\n\n")
        f.write("Run: `CK3: Extract Localization Data from CK3 Installation` in VS Code\n")
        f.write("Or: `python tools/extract_icons.py --ck3-path \"/path/to/ck3\"`\n")

    print(f"[OK] Written README to {readme_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract CK3 icon references from localization and GFX files"
    )
    parser.add_argument(
        "--ck3-path",
        type=Path,
        default=DEFAULT_CK3_PATH,
        help=f"Path to CK3 installation (default: {DEFAULT_CK3_PATH})"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "pychivalry" / "data" / "icons",
        help="Output directory for YAML files"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("CK3 Icon Reference Extractor")
    print("=" * 60)
    print(f"CK3 Path: {args.ck3_path}")
    print(f"Output: {args.output}")
    print()

    # Validate CK3 path
    if not args.ck3_path.exists():
        print(f"[ERROR] CK3 installation not found at: {args.ck3_path}")
        print("Please specify --ck3-path or install CK3 at the default Steam location")
        return 1

    try:
        # Extract icons from multiple sources
        icons = set()

        # Source 1: Localization files (@icon!)
        loc_icons = extract_icons_from_localization(args.ck3_path)
        icons.update(loc_icons)

        # Source 2: GFX directory (.dds files)
        gfx_icons = extract_icons_from_gfx_files(args.ck3_path)
        icons.update(gfx_icons)

        # Source 3: GUI files (icon definitions)
        gui_icons = parse_gui_files_for_icons(args.ck3_path)
        icons.update(gui_icons)

        if not icons:
            print("[ERROR] No icons found!")
            return 1

        # Write output files
        write_icon_files(icons, args.output)

        print()
        print("=" * 60)
        print("✅ Extraction Complete!")
        print("=" * 60)
        print(f"Extracted {len(icons)} unique icon references")
        print(f"Output: {args.output}")
        print()
        print("The language server will now be able to:")
        print("  • Validate icon references in localization: @icon!")
        print("  • Provide icon name completions")
        print("  • Show icon descriptions on hover")
        print()

        return 0

    except Exception as e:
        print(f"[ERROR] Extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
