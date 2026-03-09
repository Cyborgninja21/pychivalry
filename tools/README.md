# CK3 Language Support - Data Extraction Tools

> **Extract CK3 game data for validation — TypeScript tools for up-to-date definitions**

---

## Quick Start

### Extract Everything (Recommended)

```bash
# Auto-detect CK3 installation
npx ts-node tools/extract-all.ts

# Or specify path manually
npx ts-node tools/extract-all.ts --game-path "/path/to/ck3"
```

**Extracts:** Themes, Backgrounds, Traits, Effects, Triggers, On-Actions, Scopes

---

## Individual Extractors

| Script | Extracts | Output |
|--------|----------|--------|
| `extract-traits.ts` | Character traits | `data/traits/*.yaml` |
| `extract-effects.ts` | Game effects | `data/effects/effects.yaml` |
| `extract-triggers.ts` | Game triggers | `data/triggers/triggers.yaml` |
| `extract-on-actions.ts` | On-actions + scopes | `data/on_actions.yaml` |
| `extract-themes.ts` | Event themes | `data/themes.yaml` |
| `extract-backgrounds.ts` | Event backgrounds | `data/backgrounds.yaml` |
| `extract-scopes.ts` | Scope accessors | `data/scopes/*.yaml` |

---

## Usage Examples

### Extract All Data

```bash
# Basic usage
npx ts-node tools/extract-all.ts

# Custom CK3 path
npx ts-node tools/extract-all.ts --game-path "C:/Program Files (x86)/Steam/steamapps/common/Crusader Kings III"

# Extract only specific types
npx ts-node tools/extract-all.ts --only traits,effects,triggers
```

### Extract Individual Types

```bash
# Traits
npx ts-node tools/extract-traits.ts --game-path "/path/to/ck3"

# Effects
npx ts-node tools/extract-effects.ts --game-path "/path/to/ck3"

# Triggers
npx ts-node tools/extract-triggers.ts --game-path "/path/to/ck3"

# On-Actions
npx ts-node tools/extract-on-actions.ts --game-path "/path/to/ck3"

# Themes
npx ts-node tools/extract-themes.ts --game-path "/path/to/ck3"
```

---

## Other Tools

### merge-keywords.js

Merges keyword data from the `pdx-parser-re` reverse engineering project:

```bash
node tools/merge-keywords.js
```

Reads keyword lists from `../pdx-parser-re/spec/keywords/` and merges new entries into `data/` YAML files.

### Setup Scripts

| Script | Platform | Purpose |
|--------|----------|---------|
| `Check-Prerequisites.ps1` | Windows | Verify Node.js, npm, VS Code installed |
| `Install-Prerequisites.ps1` | Windows | Install prerequisites |
| `setup-dev-env.sh` | Linux/macOS | Set up development environment |

---

## Common Options

All TypeScript extractors support these options:

| Option | Description | Default |
|--------|-------------|---------|
| `--game-path PATH` | CK3 installation directory | Auto-detect Steam path |
| `--output PATH` | Output file/directory | `data/` |
| `--help` | Show help message | - |

---

## Output Files

```
data/
├── themes.yaml              # Event themes
├── backgrounds.yaml         # Event backgrounds
├── on_actions.yaml          # On-actions with scope tracking
├── effects/
│   └── effects.yaml         # All game effects with signatures
├── triggers/
│   └── triggers.yaml        # All game triggers with signatures
├── scopes/                  # Scope types (15 files)
│   ├── character.yaml
│   ├── province.yaml
│   └── ...
└── traits/                  # Character traits by category
    ├── personality.yaml
    ├── education.yaml
    └── ...
```

---

## Requirements

- Node.js 18+
- TypeScript (`npm install -g typescript ts-node`)
- Valid CK3 installation

---

## Troubleshooting

### "CK3 installation not found"

Specify path manually with `--game-path`:

```bash
npx ts-node tools/extract-traits.ts --game-path "/your/ck3/path"
```

Common locations:
- **Windows (Steam):** `C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III`
- **Linux (Steam):** `~/.local/share/Steam/steamapps/common/Crusader Kings III`
- **macOS (Steam):** `~/Library/Application Support/Steam/steamapps/common/Crusader Kings III`

### "No data extracted"

Ensure the CK3 path contains the `game/` folder:
```bash
ls "/path/to/ck3/game"  # Should show: common/, events/, gfx/, etc.
```

---

## How It Works

1. **Parse CK3 Files** — Uses regex + brace-matching to parse Paradox script syntax
2. **Extract Definitions** — Captures all definitions and their properties
3. **Infer Metadata** — For on-actions, infers scope types from patterns
4. **Generate YAML** — Outputs clean, documented YAML files
5. **Load in Extension** — DataLoader singleton caches YAML for fast LSP access

---

## License

PyChivalry is open source. Extracted game data is for **personal use only** and subject to Paradox Interactive's terms of service.

**Do not redistribute extracted data** - each user must extract from their own CK3 installation.

---

**Happy Extracting!** 🎮
