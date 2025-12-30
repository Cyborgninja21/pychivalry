# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-30

### Added
- Initial implementation of CK3 Language Server using pygls
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

### Technical Details
- Python 3.8+ support
- pygls 1.x for LSP implementation
- TypeScript VS Code extension
- Apache 2.0 license

[Unreleased]: https://github.com/Cyborgninja21/pychivalry/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0
