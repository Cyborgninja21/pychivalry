# CK3 Game Data Extraction Guide

> **Complete guide to extracting and using CK3 game data for validation in pychivalry**

---

## Table of Contents

- [Overview](#overview)
- [What Gets Extracted](#what-gets-extracted)
- [Quick Start](#quick-start)
- [Extraction Methods](#extraction-methods)
  - [Method 1: VS Code Command (Recommended)](#method-1-vs-code-command-recommended)
  - [Method 2: Command Line](#method-2-command-line)
- [Individual Extractors](#individual-extractors)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)
- [Technical Details](#technical-details)

---

## Overview

pychivalry uses **user-extracted game data** instead of hardcoded definitions. This ensures:

✅ **Always up-to-date** - Data matches your CK3 version (including patches & DLC)
✅ **Mod support** - Extract mod-specific data (Carnalitas, etc.)
✅ **No manual updates** - No need to update pychivalry when Paradox adds new content
✅ **Accurate validation** - Direct extraction eliminates transcription errors
✅ **Legal compliance** - Users provide their own game data (no redistribution)

**First time setup:** Run the extraction once to generate data files. pychivalry will use them for validation.

---

## What Gets Extracted

| Data Type | Source Location | Output File | Count | Usage |
|-----------|----------------|-------------|-------|-------|
| **Themes** | `game/common/event_themes/` | `data/themes.yaml` | ~32+ | Event theme validation |
| **Backgrounds** | `game/common/event_backgrounds/` | `data/backgrounds.yaml` | ~44+ | Event background validation |
| **Environments** | `game/gfx/portraits/environments/` | `data/environments.yaml` | ~44+ | Environment lighting validation |
| **On-Actions** | `game/common/on_action/` | `data/on_actions.yaml` | ~30+ | On-action + scope validation |
| **Traits** | `game/common/traits/` | `data/traits/*.yaml` | ~300+ | Trait validation (already working) |
| **Animations** | Extracted from events | `data/animations.yaml` | ~251 | Portrait animation validation (already working) |

**Note:** Traits and Animations are already extracted and included in pychivalry. You only need to extract the new data types (themes, backgrounds, environments, on-actions).

---

## Quick Start

### ⚡ Fastest Method (VS Code)

1. Open VS Code Command Palette: `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type: `CK3: Extract All Game Data`
3. Click **Yes** when prompted
4. Select your CK3 installation folder (auto-detected if possible)
5. Wait for extraction to complete (~10-30 seconds)
6. Restart the language server when prompted

**Done!** pychivalry now has all game data for validation.

---

## Extraction Methods

### Method 1: VS Code Command (Recommended)

**Best for:** Most users, one-click setup

#### Steps:

1. **Open Command Palette**
   - Windows/Linux: `Ctrl+Shift+P`
   - macOS: `Cmd+Shift+P`

2. **Run Extraction Command**
   - Type: `CK3: Extract All Game Data from CK3 Installation`
   - Press Enter

3. **Confirm Extraction**
   - Click **Yes** in the confirmation dialog

4. **Select CK3 Folder (if needed)**
   - pychivalry tries to auto-detect your CK3 installation
   - If not found, browse to your CK3 installation folder
   - Common locations:
     ```
     Windows (Steam):  C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III
     Linux (Steam):    ~/.local/share/Steam/steamapps/common/Crusader Kings III
     macOS (Steam):    ~/Library/Application Support/Steam/steamapps/common/Crusader Kings III
     ```

5. **Monitor Progress**
   - Output channel opens automatically showing extraction progress
   - You'll see each data type being processed

6. **Restart Language Server**
   - Click **Restart Language Server** when prompted
   - Or do it manually later: `Ctrl+Shift+P` → `CK3: Restart Language Server`

#### Success Indicators:

✅ Output shows: `✓ Themes extraction completed`
✅ Output shows: `✓ Backgrounds extraction completed`
✅ Output shows: `✓ Environments extraction completed`
✅ Output shows: `✓ On-Actions extraction completed`
✅ Files created in `data/` directory

---

### Method 2: Command Line

**Best for:** Automation, CI/CD, advanced users

#### Extract Everything:

```bash
# Basic usage (auto-detect Steam path)
npx ts-node tools/extract-all.ts

# Specify custom CK3 path
npx ts-node tools/extract-all.ts --ck3-path "C:/Program Files (x86)/Steam/steamapps/common/Crusader Kings III"

# Custom output directory
npx ts-node tools/extract-all.ts --ck3-path "/path/to/ck3" --output-dir "./my-data"
```

#### Extract Specific Types:

```bash
# Only extract themes and backgrounds
npx ts-node tools/extract-all.ts --only themes,backgrounds

# Only extract on_actions
npx ts-node tools/extract-all.ts --only on_actions
```

#### Command Line Options:

| Option | Description | Default |
|--------|-------------|---------|
| `--ck3-path PATH` | Path to CK3 installation | `~/.local/share/Steam/steamapps/common/Crusader Kings III` (Linux) |
| `--output-dir DIR` | Output directory for YAML files | `data` |
| `--only TYPES` | Comma-separated list of data types | All types |
| `--update` | Update existing data files | Same as running normally |

---

## Individual Extractors

You can also run extractors individually for specific data types:

### Extract Themes

```bash
npx ts-node tools/extract-themes.ts --ck3-path "/path/to/ck3"
```

**Output:** `data/themes.yaml`
**Contains:** Event themes (diplomacy, intrigue, war, etc.)

### Extract Backgrounds

```bash
npx ts-node tools/extract-backgrounds.ts --ck3-path "/path/to/ck3"
```

**Output:** `data/backgrounds.yaml`
**Contains:** Event backgrounds (throne_room, bedchamber, etc.)

### Extract Environments

```bash
npx ts-node tools/extract-environments.ts --ck3-path "/path/to/ck3"
```

**Output:** `data/environments.yaml`
**Contains:** Lighting environments (interior, exterior, etc.)

### Extract On-Actions

```bash
npx ts-node tools/extract-on-actions.ts --ck3-path "/path/to/ck3"
```

**Output:** `data/on_actions.yaml`
**Contains:** On-actions with scope information (on_birth, on_death, etc.)

### Extract Traits

```bash
npx ts-node tools/extract-traits.ts --ck3-path "/path/to/ck3"
```

**Output:** `data/traits/*.yaml`
**Contains:** Character traits (brave, cruel, genius, etc.)

---

## Troubleshooting

### ❌ "CK3 installation not found"

**Problem:** pychivalry can't auto-detect your CK3 installation

**Solutions:**
1. Manually specify the path with `--ck3-path`
2. Check that the path contains a `game/` folder
3. Verify you have CK3 installed (not just the launcher)

**Example:**
```bash
npx ts-node tools/extract-all.ts --ck3-path "D:/SteamLibrary/steamapps/common/Crusader Kings III"
```

### ❌ "No data extracted" / Empty files

**Problem:** Extraction ran but created empty/missing files

**Possible Causes:**
- Wrong CK3 path (pointed to launcher instead of game)
- Corrupted CK3 installation
- File permissions issues

**Solutions:**
1. Verify CK3 path contains `game/common/` folder
2. Run Steam's "Verify Integrity of Game Files"
3. Check file permissions on CK3 installation
4. Try running with administrator/sudo privileges

### ❌ "Permission denied" errors

**Problem:** Can't write to output directory

**Solutions:**
```bash
# Linux/macOS: Check permissions
ls -la data/

# Windows: Run as administrator
# Right-click command prompt, select "Run as administrator"

# Or specify different output directory
npx ts-node tools/extract-all.ts --output-dir "./data-backup"
```

### ❌ YAML parsing errors

**Problem:** Extracted YAML files have syntax errors

**Cause:** Usually indicates corrupted CK3 game files

**Solutions:**
1. Run Steam's "Verify Integrity of Game Files"
2. Re-extract after CK3 is repaired
3. Check if specific mods are causing issues

### ❌ "Import error" when running extractors

**Problem:** TypeScript can't find extraction modules

**Solutions:**
```bash
# Make sure you're in the project root
cd /path/to/pychivalry

# Ensure TypeScript dependencies are installed
npm install

# Run from project root
npx ts-node tools/extract-all.ts

# Or use absolute paths
npx ts-node "/path/to/pychivalry/tools/extract-all.ts"
```

### ⚠️ Validation not working after extraction

**Problem:** Extracted data but still getting validation errors

**Cause:** Language server needs to be restarted

**Solutions:**
1. In VS Code: `Ctrl+Shift+P` → `CK3: Restart Language Server`
2. Or reload VS Code window: `Ctrl+Shift+P` → `Developer: Reload Window`
3. Check that YAML files exist in `data/`

---

## Advanced Usage

### Extracting Mod Data

To extract mod-specific data (requires mod to be installed):

```bash
# Point to your mod's folder instead of base game
npx ts-node tools/extract-themes.ts --ck3-path "/path/to/mod"

# Use custom output to keep mod data separate
npx ts-node tools/extract-all.ts \
    --ck3-path "/path/to/mod" \
    --output-dir "./mod-data"
```

**Note:** Mod data extraction is experimental. Use the "Discover Mod Data" command in VS Code for better mod support.

### Automation / CI/CD

Extract data automatically in build scripts:

```bash
#!/bin/bash
# extract-data.sh

CK3_PATH="/mnt/steam/Crusader Kings III"

echo "Extracting CK3 game data..."
npx ts-node tools/extract-all.ts --ck3-path "$CK3_PATH"

if [ $? -eq 0 ]; then
    echo "✓ Extraction successful"
else
    echo "✗ Extraction failed"
    exit 1
fi
```

### Validating Extracted Data

Check that extraction worked:

```typescript
// test-extraction.ts
import { getThemes, getBackgrounds, getOnActions } from './vscode-extension/src/server/data/loader';

const themes = getThemes();
const backgrounds = getBackgrounds();
const onActions = getOnActions();

console.log(`Themes: ${Object.keys(themes).length}`);
console.log(`Backgrounds: ${Object.keys(backgrounds).length}`);
console.log(`On-actions: ${Object.keys(onActions).length}`);

console.assert(Object.keys(themes).length > 0, "No themes extracted!");
console.assert(Object.keys(backgrounds).length > 0, "No backgrounds extracted!");
console.assert(Object.keys(onActions).length > 0, "No on-actions extracted!");

console.log("✓ All data extracted successfully");
```

### Updating Data After CK3 Patches

When CK3 updates, re-extract data:

**VS Code:**
- Run `CK3: Extract All Game Data` again

**Command Line:**
```bash
# Re-extract everything
npx ts-node tools/extract-all.ts --update

# Restart language server to reload data
# (in VS Code: Ctrl+Shift+P → Restart Language Server)
```

---

## Technical Details

### Data File Format

All extracted data uses YAML format:

```yaml
# themes.yaml example
diplomacy:
  description: Diplomacy
  icon: diplomacy_icon
  sound: event_theme_diplomacy

intrigue:
  description: Intrigue
  icon: intrigue_icon
  sound: event_theme_intrigue
```

### How Extraction Works

1. **Parse CK3 Files:** Uses regex and brace-matching to parse Paradox script files
2. **Extract Metadata:** Captures definitions, properties, and relationships
3. **Infer Scopes:** For on-actions, infers scope types from name patterns and content
4. **Generate YAML:** Outputs structured YAML with headers and documentation
5. **Cache Data:** PyChivalry loads and caches data on first use

### Loading Data in Code

```typescript
import { getThemes, getBackgrounds, getEnvironments, getOnActions } from './data/loader';

// Load themes (cached after first call)
const themes = getThemes();
const isValid = 'diplomacy' in themes;

// Load backgrounds
const backgrounds = getBackgrounds();
const hasThroneRoom = 'throne_room' in backgrounds;

// Load on-actions with scope info
const onActions = getOnActions();
const onBirthScopes = onActions['on_birth']?.scopes || {};
// Returns: { root: 'character', mother: 'character', father: 'character' }
```

### Performance

- **Initial extraction:** 10-30 seconds (all data types)
- **Individual extractor:** 2-5 seconds
- **Data loading:** <50ms (first load), <1ms (cached)
- **Memory usage:** ~1-5MB for all cached data

### File Locations

```
pychivalry/
├── data/
│   ├── themes.yaml              # Event themes
│   ├── backgrounds.yaml         # Event backgrounds
│   ├── environments.yaml        # Lighting environments
│   ├── on_actions.yaml          # On-actions with scopes
│   ├── animations.yaml          # Portrait animations (pre-extracted)
│   └── traits/                  # Character traits (pre-extracted)
│       ├── personality.yaml
│       ├── education.yaml
│       └── ...
├── vscode-extension/
│   └── src/
│       └── server/
│           └── data/
│               └── loader.ts    # TypeScript data loader
└── ...

tools/
├── extract-all.ts               # Unified extraction command
├── extract-themes.ts            # Theme extractor
├── extract-backgrounds.ts       # Background extractor
├── extract-environments.ts      # Environment extractor
├── extract-on-actions.ts        # On-action extractor
└── extract-traits.ts            # Trait extractor
```

---

## FAQ

### Do I need to extract data every time I use pychivalry?

**No!** Extract once, and pychivalry will use those files until you update them. Only re-extract when:
- CK3 receives a patch/DLC
- You install new mods
- You want to update validation data

### What happens if I don't extract data?

pychivalry will still work, but validation will be **disabled** for missing data types:
- ✅ Animations & Traits: Pre-extracted (work out of the box)
- ⚠️ Themes: Validation disabled (accepts all values)
- ⚠️ Backgrounds: Validation disabled
- ⚠️ Environments: Validation disabled
- ⚠️ On-actions: Validation disabled

**Recommendation:** Extract data for full validation support.

### Can I share extracted data with others?

**No.** Extracted data contains Paradox's intellectual property and should not be redistributed. Each user must extract their own data from their CK3 installation.

### Does this work with pirated CK3?

**No comment.** This tool is designed for legitimate CK3 owners. PyChivalry is developed to support the modding community and Paradox Interactive.

### Can I extract from DLC I don't own?

**No.** You can only extract data from content you own. The extractor reads from your CK3 installation, which only contains DLC you've purchased.

### How do I know if extraction was successful?

Check for output files:
```bash
ls -lh data/*.yaml

# Should show:
# themes.yaml (5-15 KB)
# backgrounds.yaml (10-30 KB)
# environments.yaml (5-20 KB)
# on_actions.yaml (15-50 KB)
```

Or in TypeScript:
```typescript
import { getThemes } from './vscode-extension/src/server/data/loader';

const themes = getThemes();
console.log(`Extracted ${Object.keys(themes).length} themes`);  // Should be 30+
```

---

## Support

### Getting Help

1. **Check the output channel** - Shows detailed extraction logs
2. **Read error messages** - Usually indicate the exact problem
3. **Verify CK3 path** - Most issues are incorrect paths
4. **Check GitHub Issues** - [PyChivalry Issues](https://github.com/Cyborgninja21/pychivalry/issues)

### Reporting Issues

When reporting extraction issues, include:
- CK3 version (from launcher)
- PyChivalry version
- Operating system
- CK3 installation path
- Full error message / output
- Any active mods

### Contributing

Found a bug in the extractors? Want to improve extraction?
- Fork the repository
- Submit a pull request
- Open an issue for discussion

---

## Changelog

### v1.0.0 - Data Extraction System (Issue #34)

**Added:**
- ✨ `extract_all.py` - Unified extraction command
- ✨ `extract_themes.py` - Theme extraction
- ✨ `extract_backgrounds.py` - Background extraction
- ✨ `extract_environments.py` - Environment extraction
- ✨ `extract_on_actions.py` - On-action extraction with scope tracking
- ✨ VS Code command: "Extract All Game Data from CK3 Installation"
- ✨ Automatic CK3 path detection (Steam, GOG, Epic)

**Changed:**
- 🔄 Event validation - Themes now loaded from YAML (removed hardcoded set)
- 🔄 Data loader - Added theme/background/environment/on-action loaders in TypeScript

**Benefits:**
- ✅ Always up-to-date with CK3 patches
- ✅ Mod support ready
- ✅ No manual data updates needed
- ✅ Better validation accuracy

---

## License

pychivalry is open source. Extracted game data is for personal use only and subject to Paradox Interactive's terms of service.

---

**🎉 You're all set! Happy modding with pychivalry!**
