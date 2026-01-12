# Test Workspace for CK3 Language Support Extension

This workspace contains sample CK3 mod files for testing the extension functionality.

## Structure

```
test-workspace/
├── events/
│   └── test_events.txt          # Sample event definitions with various test cases
├── common/
│   └── traits/
│       └── test_traits.txt      # Sample trait definitions
├── localization/
│   └── english/
│       └── test_events_l_english.yml  # Localization keys
├── gui/
│   └── test_window.gui          # GUI definition file
└── .vscode/
    └── settings.json            # Test-specific settings
```

## Test Cases Included

### Events (test_events.txt)
- **test_mod.0001**: Basic character event with triggers, options, and scopes
- **test_mod.0002**: Event with scope chains and vassal interactions
- **test_mod.0003**: Event with intentional syntax error (missing closing brace)

### Traits (test_traits.txt)
- **clever**: Properly defined trait
- **brave**: Trait with inherit_chance
- **missing_ref_trait**: Trait with reference to non-existent trait (for testing diagnostics)

### Localization
- Complete localization for test events
- Trait descriptions
- Orphaned keys (not referenced in scripts)
- Missing keys (referenced but not defined)

### GUI
- Basic window definition
- Button and textbox widgets
- Template definition

## Usage in Tests

This workspace is used by the extension test suite to:
1. Test LSP server integration with real CK3 files
2. Verify diagnostic detection (syntax errors, missing references)
3. Test localization key validation
4. Verify scope chain analysis
5. Test formatting and inlay hints
