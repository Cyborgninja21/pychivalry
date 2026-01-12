# PyChivalry Data Extraction Tools

> **Extract CK3 game data for validation - User-extracted, always up-to-date**

---

## Quick Start

### Extract Everything (Recommended)

```bash
# Auto-detect CK3 installation
python tools/extract_all.py

# Or specify path manually
python tools/extract_all.py --ck3-path "/path/to/ck3"
```

**Extracts:** Themes, Backgrounds, Environments, On-Actions, Traits

---

## Individual Extractors

| Script | Extracts | Output |
|--------|----------|--------|
| `extract_all.py` | **Everything** | All data files |
| `extract_themes.py` | Event themes | `pychivalry/data/themes.yaml` |
| `extract_backgrounds.py` | Event backgrounds | `pychivalry/data/backgrounds.yaml` |
| `extract_environments.py` | Lighting environments | `pychivalry/data/environments.yaml` |
| `extract_on_actions.py` | On-actions + scopes | `pychivalry/data/on_actions.yaml` |
| `extract_traits.py` | Character traits | `pychivalry/data/traits/*.yaml` |

---

## Usage Examples

### Extract All Data

```bash
# Basic usage
python tools/extract_all.py

# Custom CK3 path
python tools/extract_all.py --ck3-path "C:/Program Files (x86)/Steam/steamapps/common/Crusader Kings III"

# Extract only specific types
python tools/extract_all.py --only themes,backgrounds,on_actions
```

### Extract Individual Types

```bash
# Themes
python tools/extract_themes.py --ck3-path "/path/to/ck3"

# Backgrounds
python tools/extract_backgrounds.py --ck3-path "/path/to/ck3"

# Environments
python tools/extract_environments.py --ck3-path "/path/to/ck3"

# On-Actions
python tools/extract_on_actions.py --ck3-path "/path/to/ck3"

# Traits
python tools/extract_traits.py --ck3-path "/path/to/ck3"
```

---

## Common Options

All extractors support these options:

| Option | Description | Default |
|--------|-------------|---------|
| `--ck3-path PATH` | CK3 installation directory | Auto-detect Steam path |
| `--output PATH` | Output file/directory | `pychivalry/data/` |
| `--help` | Show help message | - |

---

## Output Files

```
pychivalry/data/
├── themes.yaml              # ~32+ event themes
├── backgrounds.yaml         # ~44+ event backgrounds
├── environments.yaml        # ~44+ lighting environments
├── on_actions.yaml          # ~30+ on-actions with scope tracking
└── traits/                  # ~300+ character traits
    ├── personality.yaml
    ├── education.yaml
    ├── lifestyle.yaml
    └── ...
```

---

## Requirements

- Python 3.7+
- PyYAML (`pip install pyyaml`)
- Valid CK3 installation

---

## Troubleshooting

### "CK3 installation not found"

**Solution:** Specify path manually with `--ck3-path`

```bash
python tools/extract_all.py --ck3-path "/your/ck3/path"
```

Common locations:
- **Windows (Steam):** `C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III`
- **Linux (Steam):** `~/.local/share/Steam/steamapps/common/Crusader Kings III`
- **macOS (Steam):** `~/Library/Application Support/Steam/steamapps/common/Crusader Kings III`

### "No data extracted"

**Cause:** Wrong CK3 path (pointed to launcher instead of game)

**Solution:** Ensure path contains `game/` folder:
```bash
ls "/path/to/ck3/game"  # Should show: common/, events/, gfx/, etc.
```

### Import errors

**Solution:** Run from project root:
```bash
cd /path/to/pychivalry
python tools/extract_all.py
```

---

## How It Works

1. **Parse CK3 Files** - Uses regex + brace-matching to parse Paradox script syntax
2. **Extract Definitions** - Captures all definitions and their properties
3. **Infer Metadata** - For on-actions, infers scope types from patterns
4. **Generate YAML** - Outputs clean, documented YAML files
5. **Cache in PyChivalry** - Data loader caches for fast access

---

## Performance

- **Full extraction:** 10-30 seconds (all types)
- **Individual extractor:** 2-5 seconds
- **Themes:** ~32+ items (~5-15 KB)
- **Backgrounds:** ~44+ items (~10-30 KB)
- **Environments:** ~44+ items (~5-20 KB)
- **On-Actions:** ~30+ items (~15-50 KB)
- **Traits:** ~300+ items (~200 KB total)

---

## VS Code Integration

**Easier method:** Use VS Code command instead of command line!

1. Open Command Palette: `Ctrl+Shift+P`
2. Run: `CK3: Extract All Game Data from CK3 Installation`
3. Follow prompts

See [DATA_EXTRACTION_GUIDE.md](../docs/DATA_EXTRACTION_GUIDE.md) for full documentation.

---

## Technical Details

### Architecture

All extractors follow the same pattern:

```python
def parse_file(file_path) -> Dict[str, Dict]:
    """Parse a CK3 definition file"""

def extract_all_X(ck3_path: Path) -> Dict[str, Dict]:
    """Extract all definitions of type X"""

def write_yaml_file(data: Dict, output_file: Path):
    """Write data to YAML file"""
```

### Parsing Algorithm

1. Find all top-level definitions using regex: `^name = {`
2. Use brace-matching to extract complete definition blocks
3. Parse properties from definition block using regex
4. Generate metadata (descriptions, inferred scopes, etc.)
5. Output sorted YAML with headers

### Special Features

**On-Actions Scope Inference:**
- Analyzes on-action name patterns (`on_birth` → character scope)
- Scans content for scope references (`root`, `actor`, etc.)
- Uses knowledge base of common scope patterns
- Critical for validation of on-action scripts

**Graceful Degradation:**
- Missing files return empty dict (not errors)
- Validation disabled if data not extracted
- Users can extract incrementally

---

## Related

- **Full Documentation:** [DATA_EXTRACTION_GUIDE.md](../docs/DATA_EXTRACTION_GUIDE.md)
- **Issue Tracker:** [GitHub Issue #34](https://github.com/Cyborgninja21/pychivalry/issues/34)
- **Data Loaders:** `pychivalry/data/__init__.py`
- **Events Module:** `pychivalry/events.py` (uses extracted themes)

---

## Contributing

Found a bug? Want to add a new extractor?

1. Fork the repository
2. Create a feature branch
3. Follow existing extractor patterns
4. Add tests
5. Submit pull request

---

## License

PyChivalry is open source. Extracted game data is for **personal use only** and subject to Paradox Interactive's terms of service.

**Do not redistribute extracted data** - each user must extract from their own CK3 installation.

---

**Happy Extracting!** 🎮
