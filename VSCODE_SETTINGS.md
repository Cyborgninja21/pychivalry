# Example VS Code Workspace Settings for CK3 Modding

This file shows recommended VS Code settings for working with CK3 mods using pychivalry.

Save this as `.vscode/settings.json` in your CK3 mod workspace.

```json
{
  // CK3 Language Server Settings
  "ck3LanguageServer.pythonPath": "python",
  "ck3LanguageServer.trace.server": "off",

  // File Associations
  "files.associations": {
    "*.txt": "ck3",
    "*.gui": "ck3",
    "*.gfx": "ck3",
    "*.asset": "ck3"
  },

  // Editor Settings for CK3 Files
  "[ck3]": {
    "editor.tabSize": 4,
    "editor.insertSpaces": false,
    "editor.detectIndentation": false
  },

  // Exclude common CK3 directories from search
  "search.exclude": {
    "**/gfx/**": true,
    "**/music/**": true,
    "**/sound/**": true
  },

  // File explorer settings
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/*.dds": true
  }
}
```

## Workspace Recommendations

For a complete CK3 modding setup, consider also installing:

- File icons extension for better file visualization
- Git extension for version control
- Bracket pair colorizer for easier code reading

## File Structure

Typical CK3 mod structure:

```
my_ck3_mod/
├── common/
│   ├── decisions/
│   ├── events/
│   ├── traits/
│   └── ...
├── events/
├── gfx/
├── localization/
└── descriptor.mod
```

## Tips

- Use tabs for indentation (CK3 convention)
- Keep files organized in the `common/` directory
- Use meaningful file names
- Test in-game frequently
