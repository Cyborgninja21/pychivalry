#!/usr/bin/env python3
"""
Unified CK3 Data Extraction Tool

Extracts all game data files from CK3 installation in one command.

Extracts:
    - Traits (from game/common/traits/)
    - Animations (from game/gfx/portraits/animations/)
    - Themes (from game/common/event_themes/)
    - Backgrounds (from game/common/event_backgrounds/)
    - Environments (from game/gfx/portraits/environments/)
    - On-actions (from game/common/on_action/)

Usage:
    python tools/extract_all.py --ck3-path "/path/to/ck3/install"
    python tools/extract_all.py  # Uses default Steam path
    python tools/extract_all.py --update  # Update existing data files
"""

import argparse
import sys
from pathlib import Path
from typing import List, Tuple
import time

# Import individual extraction modules
try:
    from extract_traits import parse_ck3_trait_file, categorize_traits, write_yaml_files as write_traits
    from extract_themes import extract_all_themes, write_yaml_file as write_themes
    from extract_backgrounds import extract_all_backgrounds, write_yaml_file as write_backgrounds
    from extract_environments import extract_all_environments, write_yaml_file as write_environments
    from extract_on_actions import extract_all_on_actions, write_yaml_file as write_on_actions
except ImportError:
    # If imports fail, try importing from tools directory
    sys.path.insert(0, str(Path(__file__).parent))
    from extract_traits import parse_ck3_trait_file, categorize_traits, write_yaml_files as write_traits
    from extract_themes import extract_all_themes, write_yaml_file as write_themes
    from extract_backgrounds import extract_all_backgrounds, write_yaml_file as write_backgrounds
    from extract_environments import extract_all_environments, write_yaml_file as write_environments
    from extract_on_actions import extract_all_on_actions, write_yaml_file as write_on_actions


# Default CK3 installation path on Linux
DEFAULT_CK3_PATH = Path.home() / ".local/share/Steam/steamapps/common/Crusader Kings III"


class ExtractionTask:
    """Represents a single data extraction task."""

    def __init__(self, name: str, extract_func, write_func, output_path: Path):
        """
        Initialize extraction task.

        Args:
            name: Display name for this task
            extract_func: Function to call to extract data
            write_func: Function to call to write data
            output_path: Where to write the output file(s)
        """
        self.name = name
        self.extract_func = extract_func
        self.write_func = write_func
        self.output_path = output_path
        self.success = False
        self.error = None
        self.duration = 0.0


def print_header():
    """Print a nice header for the extraction tool."""
    print("=" * 70)
    print("  CK3 Data Extraction Tool - Extract All Game Data")
    print("=" * 70)
    print()


def print_summary(tasks: List[ExtractionTask], total_duration: float):
    """
    Print summary of extraction results.

    Args:
        tasks: List of extraction tasks
        total_duration: Total time taken in seconds
    """
    print()
    print("=" * 70)
    print("  EXTRACTION SUMMARY")
    print("=" * 70)
    print()

    successful = [t for t in tasks if t.success]
    failed = [t for t in tasks if not t.success]

    print(f"Total tasks: {len(tasks)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Total time: {total_duration:.2f}s")
    print()

    if successful:
        print("Successfully extracted:")
        for task in successful:
            print(f"  ✓ {task.name} ({task.duration:.2f}s)")
        print()

    if failed:
        print("Failed to extract:")
        for task in failed:
            print(f"  ✗ {task.name}: {task.error}")
        print()

    if len(successful) == len(tasks):
        print("🎉 All data extraction completed successfully!")
    elif len(successful) > 0:
        print("⚠️  Partial extraction completed. Some tasks failed.")
    else:
        print("❌ Extraction failed. No data was extracted.")


def run_extraction_task(task: ExtractionTask, ck3_path: Path) -> bool:
    """
    Run a single extraction task.

    Args:
        task: The extraction task to run
        ck3_path: Path to CK3 installation

    Returns:
        True if successful, False otherwise
    """
    print(f"\n{'=' * 70}")
    print(f"  EXTRACTING: {task.name.upper()}")
    print(f"{'=' * 70}\n")

    start_time = time.time()

    try:
        # Extract data
        data = task.extract_func(ck3_path)

        if not data:
            raise Exception("No data extracted")

        # Write data
        task.write_func(data, task.output_path)

        task.duration = time.time() - start_time
        task.success = True

        print(f"\n✓ {task.name} extraction completed in {task.duration:.2f}s")
        return True

    except Exception as e:
        task.duration = time.time() - start_time
        task.error = str(e)
        task.success = False

        print(f"\n✗ {task.name} extraction failed: {e}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract all CK3 game data and generate YAML files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract all data using default Steam path
  python tools/extract_all.py

  # Extract from custom CK3 installation
  python tools/extract_all.py --ck3-path "C:/Program Files/Steam/steamapps/common/Crusader Kings III"

  # Update existing data files
  python tools/extract_all.py --update

  # Extract only specific data types
  python tools/extract_all.py --only themes,backgrounds
        """
    )

    parser.add_argument(
        '--ck3-path',
        type=Path,
        default=DEFAULT_CK3_PATH,
        help=f"Path to CK3 installation (default: {DEFAULT_CK3_PATH})"
    )

    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path(__file__).parent.parent / 'pychivalry' / 'data',
        help="Output directory for YAML files"
    )

    parser.add_argument(
        '--update',
        action='store_true',
        help="Update existing data files (same as running normally)"
    )

    parser.add_argument(
        '--only',
        type=str,
        help="Comma-separated list of data types to extract (traits,themes,backgrounds,environments,on_actions)"
    )

    args = parser.parse_args()

    # Print header
    print_header()

    # Validate CK3 path
    if not args.ck3_path.exists():
        print(f"[ERROR] CK3 installation not found at {args.ck3_path}")
        print(f"\nPlease specify correct CK3 path with --ck3-path")
        print(f"\nCommon locations:")
        print(f"  Linux (Steam):   ~/.local/share/Steam/steamapps/common/Crusader Kings III")
        print(f"  Windows (Steam): C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crusader Kings III")
        print(f"  macOS (Steam):   ~/Library/Application Support/Steam/steamapps/common/Crusader Kings III")
        return 1

    print(f"CK3 Installation: {args.ck3_path}")
    print(f"Output directory: {args.output_dir}")
    print()

    # Helper function for traits extraction
    def extract_traits_helper(ck3_path: Path):
        traits_file = ck3_path / 'game' / 'common' / 'traits' / '00_traits.txt'
        if not traits_file.exists():
            raise Exception(f"Traits file not found at {traits_file}")
        traits = parse_ck3_trait_file(traits_file)
        return categorize_traits(traits)

    # Define extraction tasks
    all_tasks = [
        ExtractionTask(
            name="Traits",
            extract_func=extract_traits_helper,
            write_func=write_traits,
            output_path=args.output_dir / 'traits'
        ),
        ExtractionTask(
            name="Themes",
            extract_func=extract_all_themes,
            write_func=write_themes,
            output_path=args.output_dir / 'themes.yaml'
        ),
        ExtractionTask(
            name="Backgrounds",
            extract_func=extract_all_backgrounds,
            write_func=write_backgrounds,
            output_path=args.output_dir / 'backgrounds.yaml'
        ),
        ExtractionTask(
            name="Environments",
            extract_func=extract_all_environments,
            write_func=write_environments,
            output_path=args.output_dir / 'environments.yaml'
        ),
        ExtractionTask(
            name="On-Actions",
            extract_func=extract_all_on_actions,
            write_func=write_on_actions,
            output_path=args.output_dir / 'on_actions.yaml'
        ),
    ]

    # Filter tasks if --only is specified
    if args.only:
        only_types = set(t.strip().lower() for t in args.only.split(','))
        tasks = [t for t in all_tasks if t.name.lower() in only_types]
        if not tasks:
            print(f"[ERROR] No matching tasks found for: {args.only}")
            print(f"Available types: {', '.join(t.name.lower() for t in all_tasks)}")
            return 1
    else:
        tasks = all_tasks

    print(f"Extracting {len(tasks)} data type(s)...\n")

    # Run extraction tasks
    start_time = time.time()
    for task in tasks:
        run_extraction_task(task, args.ck3_path)

    total_duration = time.time() - start_time

    # Print summary
    print_summary(tasks, total_duration)

    # Return exit code
    return 0 if all(t.success for t in tasks) else 1


if __name__ == '__main__':
    exit(main())
