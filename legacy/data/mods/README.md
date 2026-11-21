# PyChivalry Mod Support System

This system provides **dynamic mod discovery** - PyChivalry scans your installed mods
and extracts game data automatically. We do NOT ship other people's mod content.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOD DISCOVERY FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SCAN               2. IDENTIFY            3. EXTRACT        │
│  ─────────            ───────────            ──────────         │
│  Search user's        Match against          Parse mod files    │
│  mod folders          mod_registry.yaml      for traits/        │
│                       patterns               triggers/effects   │
│                                                                 │
│  User's Mods/     →   mod_registry.yaml  →   Extracted Data    │
│  ├── Carnalitas/      (identification        {                  │
│  ├── Some Mod/         rules)                  "traits": [...], │
│  └── Other/                                    "triggers": [...] │
│                                                }                 │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

| File | Purpose |
|------|---------|
| `mod_registry.yaml` | Defines known mods and extraction rules |
| `scanner.ts` | Discovers mods and extracts data dynamically |
| `index.ts` | High-level API for the LSP |
| `carnalitas/` | Fallback static data (if mod not installed) |

## Usage

### Auto-Discovery (Recommended)

```typescript
import { autoDiscoverMods, getModLoader } from 'pychivalry/data/mods';

// Scan for installed mods and enable them
const discovered = autoDiscoverMods();
console.log(discovered);
// {'carnalitas': {'name': 'Carnalitas', 'path': 'C:/Users/.../mod/Carnalitas'}}

// Get all traits from discovered mods
const loader = getModLoader();
const traits = loader.getAllTraits();
'lifestyle_prostitute' in traits  // True if Carnalitas installed
```

### Manual Enable

```typescript
import { enableMod } from 'pychivalry/data/mods';

// Enable specific mod (will use dynamic if found, static fallback otherwise)
enableMod("carnalitas");
```

### VS Code Extension Integration

```json
{
    "pychivalry.modSearchPaths": [
        "C:/Users/Me/Documents/Paradox Interactive/Crusader Kings III/mod"
    ],
    "pychivalry.autoDiscoverMods": true
}
```

## mod_registry.yaml Structure

The registry defines how to identify and extract data from each known mod:

```yaml
mods:
  carnalitas:
    display_name: "Carnalitas"
    
    # How to identify this mod
    identifiers:
      folder_patterns:
        - "carnalitas"
        - "Carnalitas"
      required_files:
        - "common/scripted_effects/carn_sex_effects.txt"
    
    # How to extract game data
    extraction_rules:
      traits:
        sources:
          - path: "common/traits/*.txt"
            pattern: "^([a-z_][a-z0-9_]*)\\s*=\\s*\\{"
            include_prefixes:
              - "carn_"
              - "slave"
        
        # Pre-documented with metadata
        documented:
          lifestyle_prostitute:
            category: lifestyle
            description: "Character works as a prostitute"
```

## Adding Support for New Mods

1. Add entry to `mod_registry.yaml`:
```yaml
mods:
  my_mod:
    display_name: "My Cool Mod"
    identifiers:
      folder_patterns: ["my_mod"]
      required_files: ["common/scripted_effects/my_mod_effects.txt"]
    extraction_rules:
      traits:
        sources:
          - path: "common/traits/*.txt"
            pattern: "^([a-z_][a-z0-9_]*)\\s*=\\s*\\{"
            include_prefixes: ["mm_"]
```

2. That's it! The scanner will automatically discover and extract data.

## Search Paths

The scanner checks these locations by default:

**Windows:**
- `%USERPROFILE%/Documents/Paradox Interactive/Crusader Kings III/mod`
- Steam Workshop: `%PROGRAMFILES(X86)%/Steam/steamapps/workshop/content/1158310`

**Linux:**
- `~/.local/share/Paradox Interactive/Crusader Kings III/mod`
- `~/.steam/steam/steamapps/workshop/content/1158310`

## Caching

Extracted mod data is cached to avoid re-scanning on every startup:
- Cache location: `~/.pychivalry/cache/mods/`
- Uses checksums to detect mod updates
- Automatically invalidates when mod files change

## Fallback Static Data

The `carnalitas/` folder contains static YAML files as a fallback when:
- User doesn't have the mod installed
- Scanner fails for some reason
- For development/testing

This static data is **not the source of truth** - it's just a backup.

## Why Dynamic Discovery?

1. **No copyright issues** - We don't ship other people's mod content
2. **Always up-to-date** - Picks up mod updates automatically
3. **Version-agnostic** - Works with any version of supported mods
4. **User's actual setup** - Uses the exact mods they have installed
