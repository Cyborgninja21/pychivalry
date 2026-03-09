# Scope Accessor Extraction Workflow

This document describes how to extract and update scope accessor information from the CK3 game files. This workflow should be run whenever a new CK3 game version or DLC is released to ensure our scope type inference stays current.

## Purpose

The pychivalry LSP uses scope type information to:
- Provide accurate CK3605 diagnostics (scope type mismatch warnings)
- Power auto-completions based on current scope context
- Enable hover documentation for scope transitions

## Prerequisites

- Node.js 18+
- TypeScript Development Environment
- Access to CK3 game installation directory
- Typically located at: `C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III\game`

## Step 1: Run the Extraction Script

Run the extraction script against the CK3 game directory:

```bash
cd /path/to/pychivalry
npx ts-node tools/extract-scopes.ts "C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III\game" --output tools/scope_accessors_extracted.csv --summary tools/scope_accessors_summary.txt
```

### Script Options

| Option | Default | Description |
|--------|---------|-------------|
| `game_path` | Steam default path | Path to CK3 game directory |
| `--output`, `-o` | `scope_accessors_extracted.csv` | Output CSV file path |
| `--summary`, `-s` | `scope_accessors_summary.txt` | Output summary file path |

### Expected Output

The script will:
1. Scan ~4,000 game files
2. Find ~380,000+ scope accessor matches
3. Generate two output files:
   - **CSV file**: All matches with file locations, line numbers, and context
   - **Summary file**: Organized breakdown by accessor type

## Step 2: Review Output Files

### scope_accessors_extracted.csv

CSV columns:
- `accessor` - The scope accessor name (e.g., `any_vassal`, `liege`, `scope:actor`)
- `match_type` - Category: `list_iterator`, `scope_link`, `scope_prefix`, `saved_scope`
- `file_path` - Relative path within game directory
- `line_number` - Line number in the source file
- `context` - Surrounding code context

### scope_accessors_summary.txt

Organized sections:
- **LIST ITERATORS** - `any_*`, `every_*`, `random_*`, `ordered_*` patterns
- **SCOPE LINKS** - Direct scope transitions (`liege`, `holder`, `faith`, etc.)
- **SCOPE PREFIXES** - Qualified accessors (`scope:actor`, `root.location`, `prev.holder`)
- **GROUPED BY TARGET SCOPE TYPE** - Inferred scope type categories

## Step 3: Compare with Current Implementation

Check the current scope type map in `vscode-extension/src/server/core/indexer.ts`:

```typescript
// Look for the inferScopeType() method
// Compare the scopeTypeMap object against extracted data
```

Key questions to answer:
1. Are there new list iterator suffixes not in our map?
2. Are there new scope links we're not handling?
3. Have any scope types been deprecated or renamed?

## Step 4: Update Indexer if Needed

If new scope accessors are found:

1. Update `inferScopeType()` in `vscode-extension/src/server/core/indexer.ts`
2. Add new entries to the `scopeTypeMap` object
3. Update `data/scope_accessors.yaml` reference file

### Example Update

```typescript
// In inferScopeType() scopeTypeMap
character: [
    // ... existing entries ...
    "new_character_accessor",  // Added in CK3 version X.Y
],
```

## Step 5: Run Tests

After updating, validate the changes:

```bash
# Run indexer tests
npm test -- --grep "indexer"

# Run diagnostics tests  
npm test -- --grep "diagnostics"

# Full test suite
npm test
```

## Output Files Reference

After running this workflow, the tools folder should contain:

```
tools/
├── extract-scopes.ts                # Extraction script (TypeScript)
├── scope_accessors_extracted.csv    # Full extraction results
├── scope_accessors_summary.txt      # Summary report
└── SCOPE_EXTRACTION_WORKFLOW.md     # This documentation
```

## Extraction Statistics (Last Run)

| Metric | Value |
|--------|-------|
| Date | January 2026 |
| Game Version | CK3 with all DLCs |
| Files Processed | 3,962 |
| Total Matches | 384,094 |
| Unique Accessors | 17,687 |
| Unique List Iterator Suffixes | 452 |
| Unique Scope Links | 74 |

## Common Scope Types

The game uses these primary scope types:

| Scope Type | Examples |
|------------|----------|
| `character` | liege, holder, father, mother, spouse |
| `landed_title` | primary_title, duchy, kingdom, empire |
| `province` | location, capital_province |
| `faith` | faith, religion |
| `culture` | culture, culture_group |
| `dynasty` | dynasty |
| `house` | house |
| `war` | war |
| `scheme` | scheme |
| `activity` | activity, involved_activity |
| `artifact` | artifact |
| `army` | army |
| `secret` | secret |
| `faction` | joined_faction, targeting_faction |
| `travel_plan` | current_travel_plan |
| `domicile` | domicile |
| `accolade` | accolade |
| `legend` | legend |
| `memory` | memory |
| `struggle` | struggle |
| `epidemic` | epidemic |
| `situation` | situation |

## Troubleshooting

### Script runs slowly
- The script processes thousands of files; expect 1-3 minutes runtime
- Progress is printed every 100 files

### Missing game files
- Ensure all DLCs are installed
- Verify the game path is correct
- Check that game files haven't been moved

### Encoding errors
- The script uses `utf-8-sig` encoding with error replacement
- Some files may have special characters that are skipped

## Notes for Future Releases

When CK3 releases new content:

1. **New DLCs** often add new scope types (e.g., EP2 added accolades, EP3 added legends)
2. **Patches** may add new scope links or list iterators
3. **Modding updates** sometimes change how scopes work

Always check the CK3 patch notes for scripting changes and run this workflow to capture updates.
