#!/usr/bin/env python3
"""
Extract CK3 game concept definitions from localization files.

Reads: <CK3_INSTALL>/game/localization/english/*_l_english.yml
Focuses on: game_concept_* keys
Outputs: pychivalry/data/concepts/concepts.yaml

Game concepts are used in localization for contextual tooltips and links:
- [vassal|E] -> Links to 'game_concept_vassal' with tooltip
- [opinion|E] -> Links to 'game_concept_opinion' with tooltip

Usage:
    python tools/extract_concepts.py --ck3-path "/path/to/ck3/install"
    python tools/extract_concepts.py  # Uses default Steam path
"""

import argparse
import re
import yaml
from pathlib import Path
from typing import Dict, List, Set, Optional
from collections import defaultdict


# Default CK3 installation path (platform-specific)
DEFAULT_CK3_PATH = Path.home() / ".local/share/Steam/steamapps/common/Crusader Kings III"


def find_localization_files(ck3_path: Path) -> List[Path]:
    """
    Find all English localization YAML files in the CK3 installation.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        List of paths to *_l_english.yml files
    """
    loc_dir = ck3_path / "game" / "localization" / "english"

    if not loc_dir.exists():
        raise FileNotFoundError(f"Localization directory not found: {loc_dir}")

    yml_files = list(loc_dir.glob("*_l_english.yml"))
    print(f"[INFO] Found {len(yml_files)} localization files in {loc_dir}")

    return yml_files


def parse_localization_file(file_path: Path) -> Dict[str, str]:
    """
    Parse a CK3 localization YAML file to extract game_concept_* keys.

    CK3 localization files are NOT standard YAML - they have a custom format:
    l_english:
     key_name:0 "Localized text"
     key_name:1 "Updated text"

    Args:
        file_path: Path to the localization file

    Returns:
        Dictionary mapping concept keys to their localized text
    """
    concepts = {}

    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
            content = f.read()

        # Pattern: game_concept_xxx:N "text"
        # Captures: key name (without game_concept_ prefix), version number, localized text
        pattern = r'^\s*game_concept_([a-z0-9_]+):(\d+)\s+"([^"]*)"'

        for match in re.finditer(pattern, content, re.MULTILINE):
            concept_name = match.group(1)
            version = int(match.group(2))
            text = match.group(3)

            # Store the latest version if we see multiple
            if concept_name not in concepts or version > concepts[concept_name].get('version', -1):
                concepts[concept_name] = {
                    'name': concept_name,
                    'text': text,
                    'version': version,
                    'source_file': file_path.name
                }

    except Exception as e:
        print(f"[WARN] Error parsing {file_path.name}: {e}")

    return concepts


def extract_all_concepts(ck3_path: Path) -> Dict[str, Dict[str, str]]:
    """
    Extract all game concepts from CK3 localization files.

    Args:
        ck3_path: Path to CK3 installation directory

    Returns:
        Dictionary of concept data
    """
    print("[INFO] Extracting game concepts from localization files...")

    loc_files = find_localization_files(ck3_path)
    all_concepts = {}

    for loc_file in loc_files:
        concepts = parse_localization_file(loc_file)

        if concepts:
            print(f"  [+] {loc_file.name}: {len(concepts)} concepts")
            all_concepts.update(concepts)

    print(f"[OK] Extracted {len(all_concepts)} unique game concepts")
    return all_concepts


def categorize_concepts(concepts: Dict[str, Dict[str, str]]) -> Dict[str, List[str]]:
    """
    Categorize concepts by common prefixes and themes.

    Args:
        concepts: Dictionary of concept data

    Returns:
        Dictionary mapping categories to concept names
    """
    categories = defaultdict(list)

    for concept_name, concept_data in concepts.items():
        # Categorize by prefix or keyword
        if any(x in concept_name for x in ['title', 'tier', 'barony', 'county', 'duchy', 'kingdom', 'empire']):
            categories['titles'].append(concept_name)
        elif any(x in concept_name for x in ['vassal', 'liege', 'realm', 'de_jure']):
            categories['realm'].append(concept_name)
        elif any(x in concept_name for x in ['religion', 'faith', 'doctrine', 'tenet', 'piety']):
            categories['religion'].append(concept_name)
        elif any(x in concept_name for x in ['culture', 'ethos', 'tradition', 'innovation']):
            categories['culture'].append(concept_name)
        elif any(x in concept_name for x in ['trait', 'stress', 'health', 'fertility']):
            categories['character'].append(concept_name)
        elif any(x in concept_name for x in ['war', 'battle', 'siege', 'army', 'levy', 'knight']):
            categories['warfare'].append(concept_name)
        elif any(x in concept_name for x in ['scheme', 'secret', 'intrigue', 'plot']):
            categories['intrigue'].append(concept_name)
        elif any(x in concept_name for x in ['opinion', 'relation', 'diplomacy', 'alliance']):
            categories['diplomacy'].append(concept_name)
        elif any(x in concept_name for x in ['lifestyle', 'perk', 'focus']):
            categories['lifestyle'].append(concept_name)
        elif any(x in concept_name for x in ['gold', 'prestige', 'dread', 'renown']):
            categories['resources'].append(concept_name)
        elif any(x in concept_name for x in ['council', 'task', 'chancellor', 'steward', 'marshal']):
            categories['council'].append(concept_name)
        elif any(x in concept_name for x in ['succession', 'inheritance', 'heir', 'claim']):
            categories['succession'].append(concept_name)
        else:
            categories['misc'].append(concept_name)

    return dict(categories)


def write_concept_files(concepts: Dict[str, Dict[str, str]], output_dir: Path):
    """
    Write extracted concepts to YAML files.

    Args:
        concepts: Dictionary of concept data
        output_dir: Output directory for YAML files
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create main concepts file
    concepts_file = output_dir / "concepts.yaml"

    # Prepare data for YAML output (simplified structure)
    concept_list = {}
    for concept_name, data in sorted(concepts.items()):
        concept_list[concept_name] = {
            'text': data['text'],
            'source': data['source_file']
        }

    # Write main file
    with open(concepts_file, 'w', encoding='utf-8') as f:
        f.write("# CK3 Game Concepts\n")
        f.write("# Auto-generated from CK3 localization files\n")
        f.write(f"# Total concepts: {len(concept_list)}\n")
        f.write("# Format: concept_name -> {text: 'Display text', source: 'source_file.yml'}\n")
        f.write("#\n")
        f.write("# Usage in localization: [concept_name|E]\n")
        f.write("# Example: [vassal|E] links to game_concept_vassal\n\n")
        yaml.dump(concept_list, f, default_flow_style=False, allow_unicode=True, sort_keys=True)

    print(f"[OK] Written {len(concept_list)} concepts to {concepts_file}")

    # Create categorized index
    categories = categorize_concepts(concepts)
    index_file = output_dir / "categories.yaml"

    with open(index_file, 'w', encoding='utf-8') as f:
        f.write("# CK3 Game Concept Categories\n")
        f.write("# Auto-generated categorization for easier navigation\n\n")
        yaml.dump(categories, f, default_flow_style=False, sort_keys=True)

    print(f"[OK] Written category index to {index_file}")

    # Create README
    readme_file = output_dir / "README.md"
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write("# CK3 Game Concepts Data\n\n")
        f.write("This directory contains extracted game concept definitions from your CK3 installation.\n\n")
        f.write("## Files\n\n")
        f.write("- `concepts.yaml` - All game concepts with localized text\n")
        f.write("- `categories.yaml` - Concepts organized by theme\n\n")
        f.write("## What are Game Concepts?\n\n")
        f.write("Game concepts are special localization keys used for in-game tooltips and links:\n\n")
        f.write("```\n")
        f.write("[vassal|E]     -> Links to 'game_concept_vassal'\n")
        f.write("[opinion|E]    -> Links to 'game_concept_opinion'\n")
        f.write("[de_jure|E]    -> Links to 'game_concept_de_jure'\n")
        f.write("```\n\n")
        f.write("## Usage in Mods\n\n")
        f.write("This data enables:\n")
        f.write("- **Validation**: Warns when you reference a non-existent concept\n")
        f.write("- **Completions**: Auto-complete concept names in `[...|E]` patterns\n")
        f.write("- **Hover Docs**: Shows concept description when you hover over it\n\n")
        f.write("## Copyright Notice\n\n")
        f.write("Game concept data is © Paradox Interactive AB. This data is extracted from your\n")
        f.write("personal CK3 installation for modding assistance only. Do not redistribute.\n\n")
        f.write("## Regenerating\n\n")
        f.write("Run: `CK3: Extract Localization Data from CK3 Installation` in VS Code\n")
        f.write("Or: `python tools/extract_concepts.py --ck3-path \"/path/to/ck3\"`\n")

    print(f"[OK] Written README to {readme_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract CK3 game concept definitions from localization files"
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
        default=Path(__file__).parent.parent / "pychivalry" / "data" / "concepts",
        help="Output directory for YAML files"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("CK3 Game Concept Extractor")
    print("=" * 60)
    print(f"CK3 Path: {args.ck3_path}")
    print(f"Output: {args.output}")
    print()

    # Validate CK3 path
    if not args.ck3_path.exists():
        print(f"[ERROR] CK3 installation not found at: {args.ck3_path}")
        print("Please specify --ck3-path or install CK3 at the default Steam location")
        return 1

    loc_dir = args.ck3_path / "game" / "localization" / "english"
    if not loc_dir.exists():
        print(f"[ERROR] Localization directory not found: {loc_dir}")
        print("Please check your CK3 installation path")
        return 1

    try:
        # Extract concepts
        concepts = extract_all_concepts(args.ck3_path)

        if not concepts:
            print("[ERROR] No game concepts found!")
            return 1

        # Write output files
        write_concept_files(concepts, args.output)

        print()
        print("=" * 60)
        print("✅ Extraction Complete!")
        print("=" * 60)
        print(f"Extracted {len(concepts)} game concepts")
        print(f"Output: {args.output}")
        print()
        print("The language server will now be able to:")
        print("  • Validate concept links in localization: [concept|E]")
        print("  • Provide concept name completions")
        print("  • Show concept descriptions on hover")
        print()

        return 0

    except Exception as e:
        print(f"[ERROR] Extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
