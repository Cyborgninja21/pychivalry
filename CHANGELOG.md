# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Go to Definition**: Navigate to events, scripted effects/triggers, localization keys, saved scopes, modifiers, flags, on_actions, and more
- **Code Actions**: Quick fixes for typos, missing namespace suggestions, scope chain validation
- **Context-Aware Completions**: Intelligent filtering by block type (trigger/effect), scope type, and cursor position
- **Snippet Completions**: Event templates, scripted effect/trigger templates, common patterns
- **Event System Validation**: Full validation of event structure, types, themes, portraits, options
- **Script Values**: Formula and range validation with operation support
- **Variables System**: Full var:, local_var:, global_var: support with validation
- **Scripted Blocks**: Scripted triggers/effects with parameter support ($PARAM$)
- **List Iterators**: any_, every_, random_, ordered_ validation with parameters
- **Localization Support**: Key parsing, navigation, and text formatting validation
- **Workspace Features**: Mod descriptor parsing, cross-file symbol tracking

### Improved
- **Completions**: Now context-aware with scope filtering and saved scope suggestions
- **Diagnostics**: Enhanced with event validation, variable checking, list parameter validation
- **Test Coverage**: Expanded from 142 to 645+ tests including integration, regression, fuzzing, and performance tests

## [0.2.0] - 2025-12-30

### Added
- **Hover Documentation**: Rich Markdown tooltips for effects, triggers, scopes, events, saved scopes
- **Real-Time Diagnostics**: Three-layer validation (syntax, semantic, scope)
- **Scope System**: Full scope chain validation and saved scope tracking
- **Parser Foundation**: Complete AST parsing with position tracking
- **Document Indexer**: Cross-file symbol tracking

### Technical
- Data-driven architecture with YAML scope definitions
- pytest-asyncio for LSP handler testing

## [0.1.0] - 2025-12-30

### Added
- Initial implementation of CK3 Language Server using pygls 2.0.0
- Basic text document synchronization (open, change, close)
- **Auto-completion**: 150+ CK3 language constructs
  - 50+ keywords (if, trigger, effect, etc.)
  - 30+ effects (add_trait, add_gold, etc.)
  - 30+ triggers (age, has_trait, etc.)
  - 40+ scopes (root, every_vassal, etc.)
  - 5 event types
  - Boolean values
- VS Code extension for CK3 file types (.txt, .gui, .gfx, .asset)
- Language configuration for CK3 scripting syntax
- CK3 language definitions module (`ck3_language.py`)

### Documentation
- README with installation and usage instructions
- GETTING_STARTED guide
- VSCODE_SETTINGS configuration examples
- CK3_FEATURES.md documentation

### Technical Details
- Python 3.9+ support
- pygls 2.0.0 for LSP implementation
- TypeScript VS Code extension
- Apache 2.0 license

[Unreleased]: https://github.com/Cyborgninja21/pychivalry/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Cyborgninja21/pychivalry/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0
