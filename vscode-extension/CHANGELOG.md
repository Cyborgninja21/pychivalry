# Changelog

All notable changes to the CK3 Language Support VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added (v0.2.0)

#### Syntax Highlighting 🎨
- **TextMate Grammar**: Comprehensive syntax highlighting for CK3 script files
- **Keyword Highlighting**: Control flow (`if`, `else`, `while`, `limit`), event keywords (`trigger`, `effect`, `immediate`)
- **Scope References**: `scope:target`, `root`, `prev`, `liege` and other scope keywords
- **Variables**: `var:counter`, `$PARAM$` style parameters
- **Functions**: Built-in effects (`add_gold`, `add_trait`) and triggers (`has_trait`, `is_adult`)
- **Event Definitions**: Event IDs like `namespace.0001` highlighted as functions
- **Iterators**: `every_vassal`, `any_courtier`, `random_child` patterns
- **Constants**: `yes`, `no`, `true`, `false`
- **Comments & Strings**: Properly highlighted with escape sequences

#### Code Snippets 📝
- **30+ Snippets**: Common CK3 patterns for rapid development
  - Character/letter events (`event` prefix)
  - Control flow blocks (`if`, `else`, `limit`)
  - Options and portraits (`option`, `portrait`)
  - Iterators (`every`, `any`, `random`, `ordered`)
  - Scope management (`savescope`)
  - Effects (`addgold`, `addtrait`, `triggerevent`)
  - Triggers (`hastrait`, `hastitle`)
  - Variables (`setvar`, `changevar`)
  - Advanced patterns (switch, weight, scripted effects)

#### Status Bar Integration 📊
- **Visual Indicator**: Color-coded status icon in status bar
  - 🟢 Running (green checkmark)
  - 🔵 Starting (spinning sync icon)
  - ⚠️ Stopped (warning background)
  - 🔴 Error (error background)
- **Quick Action Menu**: Click status bar for:
  - Restart server
  - Show output logs
  - Open settings
  - Open CK3 modding documentation

#### Enhanced Error Handling 🛡️
- **Python Detection**: Automatic discovery of Python 3.9+ installations
  - Tries configured path, then `python3`, `python`, `py`
  - Validates Python version meets requirements
- **Server Installation Check**: Verifies `pychivalry` module is installed
- **User-Friendly Errors**: Actionable error dialogs with options:
  - Configure Python path
  - Install Python
  - Install pychivalry server
  - View documentation
- **Workspace Trust**: Respects VS Code workspace trust settings
- **Security Hardened**: Proper shell escaping to prevent command injection

#### Commands 🎮
- **CK3: Restart Language Server** - Restart the language server
- **CK3: Show Output Channel** - View server logs and diagnostics
- **CK3: Open CK3 Modding Documentation** - Open official CK3 modding wiki
- **Status Bar Menu** (internal) - Quick action menu from status bar

#### Documentation 📚
- **Enhanced README**: Comprehensive feature documentation
- **Code Examples**: Test workspace with sample CK3 files
- **Troubleshooting Guide**: Common issues and solutions
- **Security**: All security vulnerabilities addressed

### Technical Details
- Platform-specific shell escaping (Windows/Unix)
- User confirmation for package installation
- Proper error boundaries and recovery
- CodeQL security scanning passed (0 alerts)
- Linter passing with no errors

---

## [0.1.0] - 2024-12-30

### Added

#### Language Client
- **Language Server Connection**: Connects to pychivalry LSP server via stdio
- **Auto-start**: Server starts automatically when CK3 files are opened
- **Configuration Watching**: Restarts server when settings change

#### Language Configuration
- **File Associations**: `.txt`, `.gui`, `.gfx`, `.asset` files recognized as CK3
- **Comment Support**: Line comments (`#`) and block comments (`/* */`)
- **Bracket Matching**: Automatic matching for `{}`, `[]`, `()`
- **Auto-closing Pairs**: Brackets and quotes auto-close
- **Folding Markers**: Support for `#region` / `#endregion`

#### Commands
- **Restart Server** (`ck3LanguageServer.restart`): Manually restart the language server

#### Configuration Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ck3LanguageServer.enable` | boolean | `true` | Enable/disable the language server |
| `ck3LanguageServer.pythonPath` | string | `"python"` | Path to Python executable |
| `ck3LanguageServer.args` | array | `[]` | Additional server arguments |
| `ck3LanguageServer.trace.server` | string | `"off"` | LSP trace level |

#### Developer Experience
- **Output Channel**: "CK3 Language Server" output for debugging
- **Trace Levels**: Off, Messages, or Verbose logging
- **Error Messages**: User-friendly error notifications

### Technical Details
- VS Code engine: `^1.75.0`
- Language client: `vscode-languageclient ^9.0.0`
- Build: Webpack with TypeScript
- Node.js target

### Known Limitations
- Server must be installed separately via pip (but extension helps with this)
- No auto-completion yet (coming from LSP server)
- No diagnostics yet (coming from LSP server)
- No hover documentation yet (coming from LSP server)
- No go-to-definition yet (coming from LSP server)

---

## Roadmap

### v0.3.0 - Workspace Awareness
- [ ] Mod descriptor parsing (`.mod` files)
- [ ] Game installation detection
- [ ] Multi-mod workspace support
- [ ] Workspace info panel

### v0.4.0 - Commands & Productivity
- [ ] Copy console command
- [ ] Generate localization keys
- [ ] Create event file wizard
- [ ] Context menu items

### v1.0.0 - Marketplace Release
- [ ] Full test coverage
- [ ] Extension icon and branding
- [ ] Comprehensive documentation
- [ ] Marketplace publishing

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0 | 2024-12-30 | Initial release with LSP client |

---

[Unreleased]: https://github.com/Cyborgninja21/pychivalry/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0
