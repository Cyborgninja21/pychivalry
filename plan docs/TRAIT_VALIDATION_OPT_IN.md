# Trait Validation - Opt-In Architecture Plan

**Status:** 📋 Planning  
**Priority:** 🔴 Critical (Copyright compliance)  
**Context:** Trait data cannot be distributed due to Paradox copyright

---

## Problem Statement

The current implementation extracts and bundles CK3 trait data with the extension, which violates Paradox's copyright on game data. We need to:

1. **Not distribute game data** - Keep trait YAML files out of repository
2. **Make it opt-in** - Users explicitly extract data from their own CK3 installation
3. **Graceful degradation** - Server works normally without trait data
4. **Easy setup** - Provide VS Code command to extract data when needed

---

## Architecture Changes

### Phase 1: Make Trait Validation Optional

**Goal:** Server works perfectly without trait data files

#### 1.1 Update `.gitignore`

**File:** `.gitignore`

```gitignore
# User-generated game data (copyright Paradox Interactive)
# Users must extract this themselves from their CK3 installation
pychivalry/data/traits/*.yaml
```

**Action:** Prevent accidental commit of extracted game data

#### 1.2 Add Data Availability Check

**File:** `pychivalry/traits.py`

```python
def is_trait_data_available() -> bool:
    """
    Check if trait data files are available.
    
    Returns:
        True if trait YAML files exist, False otherwise
    """
    from pychivalry.data import DATA_DIR
    traits_dir = DATA_DIR / "traits"
    
    if not traits_dir.exists():
        return False
    
    # Check if at least one YAML file exists
    yaml_files = list(traits_dir.glob("*.yaml"))
    return len(yaml_files) > 0


def get_all_trait_names() -> Set[str]:
    """
    Get set of all valid trait names for fast membership testing.
    
    Returns:
        Set of trait names, or empty set if data not available
    """
    global _trait_set_cache
    
    # Check if data is available
    if not is_trait_data_available():
        logger.info("Trait data not available - trait validation disabled")
        return set()  # Return empty set, validation will be skipped
    
    if _trait_set_cache is None:
        traits = get_traits()
        _trait_set_cache = set(traits.keys())
        logger.info(f"Loaded {len(_trait_set_cache)} traits from data files")
    return _trait_set_cache
```

**Result:** 
- Returns empty set when data missing
- All validation naturally skips (empty set means no traits to validate against)
- No errors or crashes

#### 1.3 Update Diagnostic to Skip Gracefully

**File:** `pychivalry/diagnostics.py`

```python
def check_trait_references(ast: List[CK3Node]) -> List[types.Diagnostic]:
    """
    Validate trait references in has_trait, add_trait, remove_trait.
    
    Note: This validation is OPTIONAL and requires user-extracted trait data.
    If trait data is not available, this check is silently skipped.
    
    Returns:
        List of diagnostics, or empty list if trait data unavailable
    """
    from pychivalry.traits import is_trait_data_available
    
    # Skip trait validation if data not available (user hasn't extracted it)
    if not is_trait_data_available():
        logger.debug("Trait data not available - skipping trait validation")
        return []
    
    # Rest of validation code...
```

**Result:** No diagnostics emitted when data missing, no errors

#### 1.4 Update Completions to Skip Gracefully

**File:** `pychivalry/completions.py`

```python
def get_trait_completions(line_text: str, position: types.Position) -> Optional[List[types.CompletionItem]]:
    """
    Provide trait completions after trait keywords.
    
    Note: Requires user-extracted trait data. Returns None if unavailable.
    """
    from pychivalry.traits import is_trait_data_available
    
    # Check if we're in trait context first (fast check)
    trait_pattern = r'\b(has_trait|add_trait|remove_trait)\s*=\s*\S*$'
    if not re.search(trait_pattern, line_text):
        return None
    
    # Check if trait data is available
    if not is_trait_data_available():
        logger.debug("Trait data not available - skipping trait completions")
        return None  # Fall through to regular completions
    
    # Rest of completion code...
```

**Result:** No trait completions offered when data missing, regular completions still work

---

### Phase 2: Add VS Code Command for Extraction

**Goal:** Easy one-click extraction from VS Code UI

#### 2.1 Add TypeScript Command Handler

**File:** `vscode-extension/src/extension.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Command: Extract CK3 trait data from game installation
 */
async function extractTraitData(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("CK3 Trait Extraction");
    outputChannel.show();
    
    try {
        // Ask user to confirm and provide CK3 installation path
        const proceed = await vscode.window.showInformationMessage(
            'This will extract trait data from your Crusader Kings III installation. ' +
            'The extracted data is for personal use only and not redistributed. Continue?',
            'Yes', 'No'
        );
        
        if (proceed !== 'Yes') {
            return;
        }
        
        // Try to detect CK3 installation path
        let ck3Path = await detectCK3Path();
        
        if (!ck3Path) {
            // Ask user to manually specify path
            const selectedPath = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Crusader Kings III installation folder',
                openLabel: 'Select CK3 Folder'
            });
            
            if (!selectedPath || selectedPath.length === 0) {
                vscode.window.showWarningMessage('CK3 installation path not provided. Extraction cancelled.');
                return;
            }
            
            ck3Path = selectedPath[0].fsPath;
        }
        
        // Validate path
        const traitsFile = path.join(ck3Path, 'game', 'common', 'traits', '00_traits.txt');
        const fs = require('fs');
        if (!fs.existsSync(traitsFile)) {
            vscode.window.showErrorMessage(
                `Invalid CK3 installation path. Could not find: ${traitsFile}`
            );
            return;
        }
        
        outputChannel.appendLine(`Using CK3 installation: ${ck3Path}`);
        outputChannel.appendLine('Starting trait extraction...\n');
        
        // Get Python executable from language server config
        const pythonPath = getPythonPath();
        
        // Get extension path
        const extensionPath = context.extensionPath;
        const scriptPath = path.join(extensionPath, '..', 'tools', 'extract_traits.py');
        
        // Run extraction script
        const cmd = `"${pythonPath}" "${scriptPath}" --ck3-path "${ck3Path}"`;
        outputChannel.appendLine(`Running: ${cmd}\n`);
        
        const { stdout, stderr } = await execAsync(cmd);
        
        outputChannel.appendLine(stdout);
        if (stderr) {
            outputChannel.appendLine('Errors:\n' + stderr);
        }
        
        // Check if successful
        const outputDir = path.join(extensionPath, '..', 'pychivalry', 'data', 'traits');
        const yamlFiles = fs.readdirSync(outputDir).filter((f: string) => f.endsWith('.yaml'));
        
        if (yamlFiles.length > 0) {
            vscode.window.showInformationMessage(
                `✅ Successfully extracted ${yamlFiles.length} trait data files! ` +
                `Trait validation is now enabled. Restart the language server for changes to take effect.`,
                'Restart Language Server'
            ).then(selection => {
                if (selection === 'Restart Language Server') {
                    vscode.commands.executeCommand('pychivalry.restartServer');
                }
            });
        } else {
            vscode.window.showErrorMessage('Extraction completed but no data files were created. Check output for errors.');
        }
        
    } catch (error) {
        outputChannel.appendLine(`\nError: ${error}`);
        vscode.window.showErrorMessage(`Failed to extract trait data: ${error}`);
    }
}

/**
 * Try to auto-detect CK3 installation path
 */
async function detectCK3Path(): Promise<string | null> {
    const fs = require('fs');
    const os = require('os');
    const platform = os.platform();
    
    // Common Steam library locations
    const steamPaths = {
        'linux': [
            path.join(os.homedir(), '.local/share/Steam/steamapps/common/Crusader Kings III'),
            path.join(os.homedir(), '.steam/steam/steamapps/common/Crusader Kings III')
        ],
        'win32': [
            'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crusader Kings III',
            'D:\\SteamLibrary\\steamapps\\common\\Crusader Kings III',
            'E:\\SteamLibrary\\steamapps\\common\\Crusader Kings III'
        ],
        'darwin': [
            path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Crusader Kings III')
        ]
    };
    
    const paths = steamPaths[platform] || [];
    
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    
    return null;
}

/**
 * Get Python executable path from configuration
 */
function getPythonPath(): string {
    const config = vscode.workspace.getConfiguration('pychivalry');
    return config.get('pythonPath') || 'python';
}

// Register command in activate()
export function activate(context: vscode.ExtensionContext) {
    // ... existing activation code ...
    
    // Register trait extraction command
    const extractCommand = vscode.commands.registerCommand(
        'pychivalry.extractTraitData',
        () => extractTraitData(context)
    );
    context.subscriptions.push(extractCommand);
}
```

#### 2.2 Add Command to package.json

**File:** `vscode-extension/package.json`

```json
{
  "contributes": {
    "commands": [
      {
        "command": "pychivalry.extractTraitData",
        "title": "Extract Trait Data from CK3 Installation",
        "category": "PyChivalry"
      },
      {
        "command": "pychivalry.restartServer",
        "title": "Restart Language Server",
        "category": "PyChivalry"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "pychivalry.extractTraitData",
          "when": "true"
        },
        {
          "command": "pychivalry.restartServer",
          "when": "true"
        }
      ]
    },
    "configuration": {
      "title": "PyChivalry",
      "properties": {
        "pychivalry.ck3InstallPath": {
          "type": "string",
          "default": "",
          "description": "Path to Crusader Kings III installation (optional, auto-detected if empty)"
        },
        "pychivalry.traitValidation.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable trait validation (requires extracted trait data)"
        }
      }
    }
  }
}
```

---

### Phase 3: Documentation & User Guidance

#### 3.1 Update README.md

**File:** `README.md`

Add new section:

```markdown
## Optional: Trait Validation Setup

PyChivalry can validate trait names (has_trait, add_trait, remove_trait) against CK3's trait list, providing:
- ✅ Warnings for invalid trait names
- 💡 Smart suggestions for misspelled traits
- 🔍 Auto-completion with 297 CK3 traits
- 📚 Hover documentation with trait details

**This feature is OPTIONAL** and requires you to extract trait data from your own CK3 installation.

### Setup Steps

1. **Open VS Code Command Palette** (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. **Run:** `PyChivalry: Extract Trait Data from CK3 Installation`
3. **Select your CK3 installation folder** (auto-detected on Steam)
4. **Restart the language server** when prompted

The extraction tool will create local YAML files in `pychivalry/data/traits/` for your personal use.

### Requirements

- Crusader Kings III installed (Steam or standalone)
- Python 3.9+ with PyYAML package

### Privacy & Copyright

- Extracted data stays on your machine (not uploaded anywhere)
- Data files are gitignored (not committed to repository)
- This is for personal use only (Paradox owns the game data)

### Without Trait Data

The language server works perfectly without trait validation:
- ✅ All other features work normally
- ✅ Syntax validation
- ✅ Scope validation
- ✅ Effect/trigger validation
- ✅ Auto-completion (except trait-specific completions)
- ✅ Hover documentation
- ❌ Trait name validation (skipped)
```

#### 3.2 Add TRAIT_DATA_README.md

**File:** `pychivalry/data/traits/README.md`

```markdown
# CK3 Trait Data Files

This directory contains trait data extracted from your Crusader Kings III installation.

## ⚠️ Copyright Notice

These files contain game data that is **copyright Paradox Interactive AB**. 

- ✅ **Allowed:** Personal use for modding your own game
- ❌ **Not Allowed:** Redistribution, sharing, or commercial use
- 🔒 **Gitignored:** These files are not tracked by Git

## How to Extract

1. Open VS Code Command Palette (`Ctrl+Shift+P`)
2. Run: `PyChivalry: Extract Trait Data from CK3 Installation`
3. Select your CK3 installation folder
4. Restart language server

## Files

After extraction, you'll have:
- `personality.yaml` - Personality traits (brave, ambitious, etc.)
- `education.yaml` - Education traits (education_diplomacy_1-4, etc.)
- `lifestyle.yaml` - Lifestyle traits (lifestyle_blademaster, etc.)
- `health.yaml` - Health traits (ill, wounded, stressed, etc.)
- `fame.yaml` - Fame/devotion/splendor levels
- `childhood.yaml` - Childhood traits
- `special.yaml` - Special traits (house_head, immortal, etc.)

Total: ~297 traits across 7 categories

## Re-extraction

To update after CK3 patches:
1. Run the extraction command again
2. Restart the language server

## Removal

To disable trait validation:
1. Delete all `.yaml` files in this directory
2. Restart the language server

The extension will automatically skip trait validation when these files are missing.
```

#### 3.3 Update CONTRIBUTING.md

```markdown
## Working with Trait Data

**Important:** Trait data files (`pychivalry/data/traits/*.yaml`) are NOT included in the repository due to copyright.

### For Development

1. Extract trait data from your CK3 installation
2. Files are gitignored automatically
3. Never commit extracted game data

### For Testing

```python
# Mock trait data for tests
from unittest.mock import patch

@patch('pychivalry.traits.is_trait_data_available', return_value=False)
def test_without_trait_data(mock_available):
    # Test graceful degradation
    ...
```

### Adding New Trait Features

Always check data availability:

```python
from pychivalry.traits import is_trait_data_available

if not is_trait_data_available():
    logger.info("Feature requires trait data (user must extract)")
    return default_behavior()
```
```

---

### Phase 4: Update .gitignore

**File:** `.gitignore`

```gitignore
# User-generated game data (copyright Paradox Interactive)
# Users must extract this from their own CK3 installation
pychivalry/data/traits/*.yaml

# Keep the directory structure and README
!pychivalry/data/traits/README.md
!pychivalry/data/traits/.gitkeep
```

---

### Phase 5: Testing

#### 5.1 Test Without Trait Data

```python
# tests/test_traits_optional.py

def test_server_starts_without_trait_data():
    """Server should start normally without trait data."""
    # Ensure trait data doesn't exist
    # Start server
    # Verify no errors
    pass

def test_diagnostics_skip_traits_when_unavailable():
    """Diagnostics should skip trait validation gracefully."""
    with patch('pychivalry.traits.is_trait_data_available', return_value=False):
        diags = get_diagnostics_for_text('trigger = { has_trait = invalid }')
        # Should not have CK3451 diagnostic
        assert not any(d.code == 'CK3451' for d in diags)

def test_completions_work_without_traits():
    """Regular completions should work without trait data."""
    with patch('pychivalry.traits.is_trait_data_available', return_value=False):
        completions = get_context_aware_completions(...)
        # Should have regular completions
        assert len(completions.items) > 0
        # Should not have trait-specific completions
        assert not any('brave' in c.label for c in completions.items)
```

#### 5.2 Test With Trait Data

```python
def test_trait_validation_works_when_data_available():
    """Trait validation should work when data is available."""
    # Assumes trait data has been extracted
    if not is_trait_data_available():
        pytest.skip("Trait data not available")
    
    diags = get_diagnostics_for_text('trigger = { has_trait = invalid }')
    assert any(d.code == 'CK3451' for d in diags)
```

---

## Migration Steps

### For Current Development

1. **Remove committed trait files from Git history:**
   ```bash
   git rm -r --cached pychivalry/data/traits/*.yaml
   git commit -m "chore: Remove trait data files (copyright compliance)"
   ```

2. **Update .gitignore:**
   ```bash
   echo "pychivalry/data/traits/*.yaml" >> .gitignore
   git add .gitignore
   git commit -m "chore: Gitignore trait data files"
   ```

3. **Add README to traits directory:**
   ```bash
   # Create README explaining copyright
   git add pychivalry/data/traits/README.md
   git commit -m "docs: Add trait data copyright notice"
   ```

4. **Implement graceful degradation:**
   - Update traits.py with availability checks
   - Update diagnostics.py to skip when unavailable
   - Update completions.py to skip when unavailable

5. **Add VS Code command:**
   - Implement TypeScript command handler
   - Update package.json with command
   - Test extraction flow

6. **Update documentation:**
   - README.md with setup instructions
   - CONTRIBUTING.md with developer guidance
   - Add copyright notices

7. **Test thoroughly:**
   - Test without trait data (clean state)
   - Test extraction command
   - Test with trait data
   - Test all edge cases

---

## Benefits of This Approach

✅ **Copyright Compliant:** No game data distributed  
✅ **Opt-in:** Users choose to enable trait validation  
✅ **No Breaking Changes:** Server works without trait data  
✅ **Easy Setup:** One command in VS Code  
✅ **Clear Documentation:** Users understand what they're doing  
✅ **Graceful Degradation:** No errors or crashes without data  
✅ **Future-Proof:** Easy to update after CK3 patches  

---

## Timeline

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| 1. Make Optional | Availability checks, graceful skips | 1 hour |
| 2. VS Code Command | TypeScript handler, path detection | 2 hours |
| 3. Documentation | README, notices, guides | 1 hour |
| 4. Testing | Without/with data, edge cases | 1 hour |
| 5. Cleanup | Remove committed files, update .gitignore | 30 min |

**Total:** 5.5 hours

---

## Open Questions

1. **Should we bundle tools/extract_traits.py?** 
   - Yes, it's our code (not game data)
   - Document that output data is copyright Paradox

2. **Should we have a "Check for CK3 Updates" command?**
   - Compare trait counts to detect new CK3 patches
   - Prompt user to re-extract if game updated

3. **Should we cache detection of trait data availability?**
   - Check once at server start
   - Refresh only when files change
   - Improves performance

4. **Should we show notification when trait validation is disabled?**
   - One-time info message on first start without data
   - Link to extraction command
   - Don't be annoying if user doesn't care

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Implement Phase 1 (graceful degradation)
3. ⏳ Implement Phase 2 (VS Code command)
4. ⏳ Update documentation
5. ⏳ Test thoroughly
6. ⏳ Clean up committed files
