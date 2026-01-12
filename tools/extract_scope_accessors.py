#!/usr/bin/env python3
"""
Scope Accessor Extractor for CK3 Game Files

This script systematically scans the CK3 game directory to find all scope
accessor patterns and outputs them with their file locations.

Usage:
    python tools/extract_scope_accessors.py [game_path] [--output FILE]

Output:
    - CSV file with columns: accessor, context, file_path, line_number
    - Summary statistics of unique accessors found
"""

import argparse
import csv
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import NamedTuple


class ScopeMatch(NamedTuple):
    """Represents a found scope accessor."""
    accessor: str
    context: str  # surrounding context
    file_path: str
    line_number: int
    match_type: str  # 'list_iterator', 'scope_link', 'scope_prefix', 'saved_scope'


# Patterns to find scope accessors
PATTERNS = {
    # List iterators: any_*, every_*, random_*, ordered_*
    'list_iterator': re.compile(
        r'\b(any|every|random|ordered)_([a-z_]+)\s*=',
        re.IGNORECASE
    ),
    
    # Scope links used as keys (e.g., "liege = { ... }")
    'scope_link_block': re.compile(
        r'\b([a-z_]+)\s*=\s*\{',
        re.IGNORECASE
    ),
    
    # Scope prefixes (e.g., "scope:actor", "root.liege", "prev.culture")
    'scope_prefix': re.compile(
        r'\b(scope|root|prev|this|from|event_target)[:.]([a-z_]+)',
        re.IGNORECASE
    ),
    
    # Saved scopes (e.g., "save_scope_as = my_scope", "save_temporary_scope_as")
    'saved_scope': re.compile(
        r'\b(save_scope_as|save_temporary_scope_as)\s*=\s*([a-z_]+)',
        re.IGNORECASE
    ),
    
    # Direct scope transitions in values (e.g., "target = liege")
    'scope_target': re.compile(
        r'\btarget\s*=\s*([a-z_]+)\b',
        re.IGNORECASE
    ),
    
    # Scope type checks (e.g., "exists = liege", "is_valid = capital")
    'scope_exists': re.compile(
        r'\b(exists|is_valid)\s*=\s*([a-z_]+)\b',
        re.IGNORECASE
    ),
}

# Known scope link keywords to look for
KNOWN_SCOPE_LINKS = {
    # Character scope links
    'liege', 'host', 'employer', 'top_liege', 'realm_priest', 'court_owner',
    'father', 'mother', 'real_father', 'betrothed', 'primary_spouse', 'primary_partner',
    'player_heir', 'primary_heir', 'killer', 'ghw_beneficiary',
    'designated_heir', 'matchmaker', 'warden', 'guardian',
    
    # Title scope links
    'holder', 'previous_holder', 'de_jure_liege', 'capital', 'capital_county',
    'title_capital_county', 'duchy', 'kingdom', 'empire',
    'primary_title', 'highest_held_title_tier',
    
    # Province scope links  
    'county', 'barony', 'terrain',
    
    # Faith/Religion scope links
    'faith', 'religion', 'religious_head', 'great_holy_war',
    
    # Culture scope links
    'culture', 'culture_group',
    
    # Dynasty/House scope links
    'dynasty', 'house', 'dynasty_head', 'house_head', 'founder',
    
    # War/Combat scope links
    'war', 'casus_belli', 'primary_attacker', 'primary_defender',
    'attacker', 'defender', 'claimant', 'target_title',
    
    # Scheme scope links
    'scheme', 'scheme_owner', 'scheme_target',
    
    # Activity scope links
    'activity', 'activity_host', 'activity_location',
    
    # Artifact scope links
    'artifact', 'artifact_owner',
    
    # Army scope links
    'army', 'commander', 'army_owner',
    
    # Other scope links
    'location', 'capital_province', 'realm_capital',
    'secret', 'involved_activity', 'travel_plan',
    'domicile', 'accolade', 'legend', 'memory',
    'struggle', 'epidemic', 'situation',
}

# File extensions to scan
VALID_EXTENSIONS = {'.txt', '.info'}

# Directories to skip
SKIP_DIRS = {'gfx', 'fonts', 'music', 'sound', 'licenses', 'dlc_metadata', 
             'map_data', 'reader_export', 'tweakergui_assets', 'data_binding'}


def should_process_file(file_path: Path) -> bool:
    """Check if a file should be processed."""
    return file_path.suffix.lower() in VALID_EXTENSIONS


def should_skip_directory(dir_name: str) -> bool:
    """Check if a directory should be skipped."""
    return dir_name.lower() in SKIP_DIRS


def extract_context(line: str, match_start: int, match_end: int, context_chars: int = 40) -> str:
    """Extract surrounding context for a match."""
    start = max(0, match_start - context_chars)
    end = min(len(line), match_end + context_chars)
    context = line[start:end].strip()
    return context


def find_scope_accessors_in_file(file_path: Path, game_root: Path) -> list[ScopeMatch]:
    """Find all scope accessor patterns in a single file."""
    matches = []
    relative_path = str(file_path.relative_to(game_root))
    
    try:
        with open(file_path, 'r', encoding='utf-8-sig', errors='replace') as f:
            for line_num, line in enumerate(f, 1):
                # Skip comments
                comment_pos = line.find('#')
                if comment_pos != -1:
                    line = line[:comment_pos]
                
                if not line.strip():
                    continue
                
                # Find list iterators
                for match in PATTERNS['list_iterator'].finditer(line):
                    prefix = match.group(1).lower()
                    suffix = match.group(2).lower()
                    accessor = f"{prefix}_{suffix}"
                    context = extract_context(line, match.start(), match.end())
                    matches.append(ScopeMatch(
                        accessor=accessor,
                        context=context,
                        file_path=relative_path,
                        line_number=line_num,
                        match_type='list_iterator'
                    ))
                
                # Find scope prefixes
                for match in PATTERNS['scope_prefix'].finditer(line):
                    prefix = match.group(1).lower()
                    accessor = match.group(2).lower()
                    full_accessor = f"{prefix}:{accessor}" if prefix == 'scope' else f"{prefix}.{accessor}"
                    context = extract_context(line, match.start(), match.end())
                    matches.append(ScopeMatch(
                        accessor=full_accessor,
                        context=context,
                        file_path=relative_path,
                        line_number=line_num,
                        match_type='scope_prefix'
                    ))
                
                # Find saved scopes
                for match in PATTERNS['saved_scope'].finditer(line):
                    accessor = match.group(2).lower()
                    context = extract_context(line, match.start(), match.end())
                    matches.append(ScopeMatch(
                        accessor=f"saved:{accessor}",
                        context=context,
                        file_path=relative_path,
                        line_number=line_num,
                        match_type='saved_scope'
                    ))
                
                # Find scope targets
                for match in PATTERNS['scope_target'].finditer(line):
                    accessor = match.group(1).lower()
                    if accessor in KNOWN_SCOPE_LINKS:
                        context = extract_context(line, match.start(), match.end())
                        matches.append(ScopeMatch(
                            accessor=accessor,
                            context=context,
                            file_path=relative_path,
                            line_number=line_num,
                            match_type='scope_link'
                        ))
                
                # Find exists/is_valid scope checks
                for match in PATTERNS['scope_exists'].finditer(line):
                    accessor = match.group(2).lower()
                    if accessor in KNOWN_SCOPE_LINKS:
                        context = extract_context(line, match.start(), match.end())
                        matches.append(ScopeMatch(
                            accessor=accessor,
                            context=context,
                            file_path=relative_path,
                            line_number=line_num,
                            match_type='scope_link'
                        ))
                
                # Find scope link blocks (e.g., "liege = {")
                for match in PATTERNS['scope_link_block'].finditer(line):
                    accessor = match.group(1).lower()
                    if accessor in KNOWN_SCOPE_LINKS:
                        context = extract_context(line, match.start(), match.end())
                        matches.append(ScopeMatch(
                            accessor=accessor,
                            context=context,
                            file_path=relative_path,
                            line_number=line_num,
                            match_type='scope_link'
                        ))
                        
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
    
    return matches


def scan_game_directory(game_path: Path) -> list[ScopeMatch]:
    """Recursively scan the game directory for scope accessors."""
    all_matches = []
    files_processed = 0
    
    for root, dirs, files in os.walk(game_path):
        # Skip certain directories
        dirs[:] = [d for d in dirs if not should_skip_directory(d)]
        
        for file_name in files:
            file_path = Path(root) / file_name
            if should_process_file(file_path):
                matches = find_scope_accessors_in_file(file_path, game_path)
                all_matches.extend(matches)
                files_processed += 1
                
                if files_processed % 100 == 0:
                    print(f"Processed {files_processed} files...", file=sys.stderr)
    
    print(f"Total files processed: {files_processed}", file=sys.stderr)
    return all_matches


def generate_summary(matches: list[ScopeMatch]) -> dict:
    """Generate summary statistics from matches."""
    # Group by accessor
    by_accessor = defaultdict(list)
    for m in matches:
        by_accessor[m.accessor].append(m)
    
    # Group by match type
    by_type = defaultdict(set)
    for m in matches:
        by_type[m.match_type].add(m.accessor)
    
    # Find unique list iterators
    list_iterators = sorted({m.accessor for m in matches if m.match_type == 'list_iterator'})
    
    # Find unique scope links
    scope_links = sorted({m.accessor for m in matches if m.match_type == 'scope_link'})
    
    # Find unique scope prefixes
    scope_prefixes = sorted({m.accessor for m in matches if m.match_type == 'scope_prefix'})
    
    return {
        'total_matches': len(matches),
        'unique_accessors': len(by_accessor),
        'list_iterators': list_iterators,
        'scope_links': scope_links,
        'scope_prefixes': scope_prefixes,
        'by_accessor': by_accessor,
    }


def write_csv_output(matches: list[ScopeMatch], output_file: Path):
    """Write matches to a CSV file."""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['accessor', 'match_type', 'file_path', 'line_number', 'context'])
        for m in sorted(matches, key=lambda x: (x.accessor, x.file_path, x.line_number)):
            writer.writerow([m.accessor, m.match_type, m.file_path, m.line_number, m.context])


def write_summary_output(summary: dict, output_file: Path):
    """Write summary to a text file."""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("CK3 SCOPE ACCESSOR EXTRACTION SUMMARY\n")
        f.write("=" * 80 + "\n\n")
        
        f.write(f"Total matches found: {summary['total_matches']}\n")
        f.write(f"Unique accessors: {summary['unique_accessors']}\n\n")
        
        f.write("-" * 80 + "\n")
        f.write(f"LIST ITERATORS ({len(summary['list_iterators'])} unique)\n")
        f.write("-" * 80 + "\n")
        for accessor in summary['list_iterators']:
            count = len(summary['by_accessor'][accessor])
            f.write(f"  {accessor}: {count} occurrences\n")
        
        f.write("\n" + "-" * 80 + "\n")
        f.write(f"SCOPE LINKS ({len(summary['scope_links'])} unique)\n")
        f.write("-" * 80 + "\n")
        for accessor in summary['scope_links']:
            count = len(summary['by_accessor'][accessor])
            f.write(f"  {accessor}: {count} occurrences\n")
        
        f.write("\n" + "-" * 80 + "\n")
        f.write(f"SCOPE PREFIXES ({len(summary['scope_prefixes'])} unique)\n")
        f.write("-" * 80 + "\n")
        # Group by prefix
        prefix_groups = defaultdict(list)
        for accessor in summary['scope_prefixes']:
            if ':' in accessor:
                prefix, name = accessor.split(':', 1)
            elif '.' in accessor:
                prefix, name = accessor.split('.', 1)
            else:
                prefix, name = 'other', accessor
            prefix_groups[prefix].append((accessor, len(summary['by_accessor'][accessor])))
        
        for prefix in sorted(prefix_groups.keys()):
            f.write(f"\n  [{prefix}]\n")
            for accessor, count in sorted(prefix_groups[prefix]):
                f.write(f"    {accessor}: {count} occurrences\n")
        
        # Group accessors by inferred target scope type
        f.write("\n" + "=" * 80 + "\n")
        f.write("ACCESSORS GROUPED BY INFERRED TARGET SCOPE TYPE\n")
        f.write("=" * 80 + "\n")
        
        scope_type_patterns = {
            'character': ['liege', 'host', 'father', 'mother', 'spouse', 'heir', 'killer',
                         'guardian', 'warden', 'betrothed', 'partner', 'employer', 'owner',
                         'commander', 'head', 'founder', 'attacker', 'defender', 'claimant',
                         'vassal', 'courtier', 'knight', 'councillor', 'child', 'sibling',
                         'parent', 'grandparent', 'ancestor', 'descendant', 'prisoner'],
            'title': ['title', 'duchy', 'kingdom', 'empire', 'county', 'barony',
                     'de_jure', 'claim', 'realm'],
            'province': ['province', 'location', 'capital_province', 'neighbor'],
            'faith': ['faith', 'religion', 'holy_site'],
            'culture': ['culture', 'culture_group', 'heritage'],
            'dynasty': ['dynasty'],
            'house': ['house'],
            'war': ['war', 'battle'],
            'army': ['army', 'regiment', 'men_at_arms'],
            'scheme': ['scheme'],
            'artifact': ['artifact'],
            'activity': ['activity'],
            'secret': ['secret'],
        }
        
        for scope_type, keywords in scope_type_patterns.items():
            matching = []
            for accessor in summary['list_iterators'] + summary['scope_links']:
                accessor_lower = accessor.lower()
                if any(kw in accessor_lower for kw in keywords):
                    count = len(summary['by_accessor'][accessor])
                    matching.append((accessor, count))
            
            if matching:
                f.write(f"\n  [{scope_type}]\n")
                for accessor, count in sorted(matching):
                    f.write(f"    {accessor}: {count} occurrences\n")


def main():
    parser = argparse.ArgumentParser(
        description='Extract scope accessor patterns from CK3 game files'
    )
    parser.add_argument(
        'game_path',
        nargs='?',
        default=r'C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III\game',
        help='Path to CK3 game directory'
    )
    parser.add_argument(
        '--output', '-o',
        default='scope_accessors_extracted.csv',
        help='Output CSV file path'
    )
    parser.add_argument(
        '--summary', '-s',
        default='scope_accessors_summary.txt',
        help='Output summary file path'
    )
    
    args = parser.parse_args()
    game_path = Path(args.game_path)
    
    if not game_path.exists():
        print(f"Error: Game path does not exist: {game_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Scanning: {game_path}", file=sys.stderr)
    print("This may take a few minutes...", file=sys.stderr)
    
    # Scan the game directory
    matches = scan_game_directory(game_path)
    
    # Generate summary
    summary = generate_summary(matches)
    
    # Write outputs
    output_csv = Path(args.output)
    output_summary = Path(args.summary)
    
    write_csv_output(matches, output_csv)
    write_summary_output(summary, output_summary)
    
    print(f"\nResults written to:", file=sys.stderr)
    print(f"  CSV: {output_csv}", file=sys.stderr)
    print(f"  Summary: {output_summary}", file=sys.stderr)
    
    # Print quick summary to stdout
    print("\n" + "=" * 60)
    print("QUICK SUMMARY")
    print("=" * 60)
    print(f"Total matches: {summary['total_matches']}")
    print(f"Unique accessors: {summary['unique_accessors']}")
    print(f"List iterators: {len(summary['list_iterators'])}")
    print(f"Scope links: {len(summary['scope_links'])}")
    print(f"Scope prefixes: {len(summary['scope_prefixes'])}")
    
    print("\nTop 20 most used accessors:")
    sorted_accessors = sorted(
        summary['by_accessor'].items(),
        key=lambda x: len(x[1]),
        reverse=True
    )[:20]
    for accessor, occurrences in sorted_accessors:
        print(f"  {accessor}: {len(occurrences)} occurrences")


if __name__ == '__main__':
    main()
