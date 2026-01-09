#!/usr/bin/env python3
"""
Script to update all parse_document() calls from:
    ast = parse_document(...)
to:
    ast, _parse_errors = parse_document(...)
"""

import re
import glob
import os

# Find all Python files that might contain parse_document calls
files_to_update = []

# Search in tests
test_patterns = [
    "tests/**/*.py",
    "pychivalry/**/*.py",
]

for pattern in test_patterns:
    files_to_update.extend(glob.glob(pattern, recursive=True))

# Remove this script itself
script_path = os.path.abspath(__file__)
files_to_update = [f for f in files_to_update if os.path.abspath(f) != script_path]

# Pattern to match: "ast = parse_document(...)"
# We need to replace it with: "ast, _parse_errors = parse_document(...)"
pattern = r'\bast\s*=\s*parse_document\('

updated_count = 0
files_changed = []

for filepath in files_to_update:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if file contains pattern
        if re.search(pattern, content):
            # Replace pattern
            new_content = re.sub(
                pattern,
                'ast, _parse_errors = parse_document(',
                content
            )

            # Write back if changed
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                files_changed.append(filepath)
                # Count replacements
                count = len(re.findall(pattern, content))
                updated_count += count
                print(f"Updated {count} calls in: {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

print(f"\n{'='*60}")
print(f"Total: Updated {updated_count} parse_document() calls in {len(files_changed)} files")
print(f"{'='*60}")
