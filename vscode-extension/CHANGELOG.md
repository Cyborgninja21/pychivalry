# Changelog

All notable changes to the CK3 Language Support VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned (Phase 1-2)
- TextMate grammar for syntax highlighting
- Code snippets for common CK3 patterns (25+ snippets)

### Planned (Phase 3-4)
- Status bar integration with server state indicator
- Enhanced error handling with recovery UI
- Python/pychivalry installation detection

### Planned (Phase 5-6)
- Mod workspace detection (`.mod` file parsing)
- Game installation detection
- Additional commands and keybindings

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
- No syntax highlighting (planned for v0.2.0)
- No code snippets (planned for v0.2.0)
- No status bar indicator (planned for v0.3.0)
- Limited error recovery (planned for v0.3.0)
- Server must be installed separately via pip

---

## Roadmap

### v0.2.0 - Syntax & Snippets
- [ ] TextMate grammar for syntax highlighting
- [ ] 25+ code snippets for common patterns
- [ ] Event, trigger, effect highlighting
- [ ] Scope reference highlighting

### v0.3.0 - Status & Errors
- [ ] Status bar integration
- [ ] Enhanced error handling
- [ ] Python detection
- [ ] Installation wizard

### v0.4.0 - Workspace Awareness
- [ ] Mod descriptor parsing
- [ ] Game installation detection
- [ ] Multi-mod workspace support

### v0.5.0 - Commands & Productivity
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
