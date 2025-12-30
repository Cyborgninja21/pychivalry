# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Auto-completion feature**: 150+ CK3 language constructs
  - 50+ keywords (if, trigger, effect, etc.)
  - 30+ effects (add_trait, add_gold, etc.)
  - 30+ triggers (age, has_trait, etc.)
  - 40+ scopes (root, every_vassal, etc.)
  - 5 event types
  - Boolean values
- CK3 language definitions module (`ck3_language.py`)
- Comprehensive completion tests (5 test cases)
- CK3_FEATURES.md documentation

## [0.1.0] - 2025-12-30

### Added
- Initial implementation of CK3 Language Server using pygls 2.0.0
- Basic text document synchronization (open, change, close)
- VS Code extension for CK3 file types (.txt, .gui, .gfx, .asset)
- Language configuration for CK3 scripting syntax
- Project structure with pyproject.toml
- Documentation:
  - README with installation and usage instructions
  - GETTING_STARTED guide
  - VSCODE_SETTINGS configuration examples
- Example CK3 event file for testing
- Basic test suite for server initialization
- CI/CD workflow with GitHub Actions
- Contributing guidelines
- Reference pygls repository cloned to pygls-workspace/

### Technical Details
- Python 3.9+ support
- pygls 2.0.0 for LSP implementation
- TypeScript VS Code extension
- Apache 2.0 license

[Unreleased]: https://github.com/Cyborgninja21/pychivalry/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0
