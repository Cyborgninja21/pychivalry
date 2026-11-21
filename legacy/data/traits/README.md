# CK3 Trait Data Files

This directory contains trait data extracted from your Crusader Kings III installation.

## ⚠️ Copyright Notice

These files contain game data that is **copyright Paradox Interactive AB**.

- ✅ **Allowed:** Personal use for modding your own game
- ❌ **Not Allowed:** Redistribution, sharing, or commercial use
- 🔒 **Gitignored:** These files are not tracked by Git

## How to Extract

1. Open VS Code Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run: `PyChivalry: Extract Trait Data from CK3 Installation`
3. Select your CK3 installation folder (auto-detected on Steam)
4. Restart language server when prompted

## Files

After extraction, you'll have:

- `personality.yaml` - Personality traits (brave, ambitious, etc.)
- `education.yaml` - Education traits (education_diplomacy_1-4, etc.)
- `lifestyle.yaml` - Lifestyle traits (lifestyle_blademaster, etc.)
- `health.yaml` - Health traits (ill, wounded, stressed, etc.)
- `fame.yaml` - Fame/devotion/splendor levels
- `childhood.yaml` - Childhood traits
- `special.yaml` - Special traits (house_head, immortal, etc.)

**Total:** ~297 traits across 7 categories

## What You Get

With trait data extracted, you'll have:

- ✅ **Validation:** Warnings for unknown traits (CK3451)
- 💡 **Smart Suggestions:** "Did you mean: brave, craven?" for typos
- 🔍 **Auto-completion:** All 297 CK3 traits with metadata
- 📚 **Hover Documentation:** Trait details, opposites, categories

## Re-extraction

To update after CK3 patches:

1. Run the extraction command again
2. Restart the language server

New or changed traits will be automatically detected.

## Removal

To disable trait validation:

1. Delete all `.yaml` files in this directory
2. Restart the language server

The extension will automatically skip trait validation when these files are missing. All other features continue to work normally.

## Privacy

- Extracted data stays on your machine (not uploaded anywhere)
- Files are automatically gitignored (not committed to repository)
- This is for personal use only (respects Paradox copyright)

## Technical Details

- **Format:** YAML with structured trait definitions
- **Size:** ~50KB total for 297 traits
- **Performance:** Cached in memory for O(1) validation
- **Extraction Tool:** `tools/extract-traits.ts`

## Support

If extraction fails:

1. Check that your CK3 installation path is correct
2. Verify `game/common/traits/00_traits.txt` exists in your CK3 folder
3. Check the Output panel for error messages
4. Report issues at: https://github.com/Cyborgninja21/pychivalry/issues
