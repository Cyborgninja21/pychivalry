# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Folding Range**: Code folding support (Ctrl+Shift+[ to fold, Ctrl+Shift+] to unfold)
  - Event blocks: Collapse entire events to single lines
  - Named blocks: Fold `trigger`, `effect`, `option`, `immediate`, iterators
  - Nested blocks: Any `{ ... }` block spanning multiple lines
  - Comment blocks: Consecutive comment lines can be folded
  - Region markers: Custom folding with `# region Name` / `# endregion`
- **Rename Symbol**: Workspace-wide symbol renaming (F2 or Ctrl+Shift+R)
  - Event IDs: Rename `rq.0001` across all files, including localization keys
  - Saved scopes: Rename `scope:target` and all `save_scope_as = target` definitions
  - Variables: Rename `var:counter` and all `set_variable = { name = counter }` definitions
  - Character flags: Rename across `has_character_flag`, `add_character_flag`, `remove_character_flag`
  - Global flags: Rename across `has_global_flag`, `set_global_flag`, `remove_global_flag`
  - Scripted effects/triggers: Rename definitions and all usages
  - Opinion modifiers: Rename definitions and `modifier =` references
  - Prepare Rename support: Validates rename is possible before starting
  - Name validation: Enforces proper identifier format and event ID format
  - Localization key updates: Automatically renames related localization keys (`.t`, `.desc`, `.a`, etc.)
- **Document Links**: Clickable references for paths, URLs, and event IDs
  - File paths: `common/scripted_effects/file.txt`, `gfx/icons/icon.dds` become clickable
  - URLs: `https://...` links are clickable with domain-specific tooltips (Wiki, GitHub, etc.)
  - Event IDs in comments: `# See rq.0001` links to event definition
  - GFX paths in script: `icon = "gfx/..."` are clickable
  - Workspace-aware path resolution for mod structure
- **Document Highlight**: Click on a symbol to highlight all occurrences in the file
  - Saved scopes: `scope:target` and `save_scope_as = target` highlighted together
  - Event IDs: Definitions and `trigger_event` references highlighted
  - Variables: `var:name`, `local_var:`, `global_var:` with `set_variable` definitions
  - Character flags: `has_character_flag`, `add_character_flag`, `remove_character_flag`
  - Global flags: `has_global_flag`, `set_global_flag`, `remove_global_flag`
  - Traits: `has_trait`, `add_trait`, `remove_trait`
  - Proper highlight kinds: Read (references), Write (definitions)
- **Signature Help**: Parameter hints when typing inside effect blocks
  - Shows required and optional parameters with type hints
  - Highlights active parameter as you type
  - Supports 25+ effects: add_opinion, trigger_event, set_variable, add_character_modifier, random, death, etc.
  - Trigger signatures: opinion, has_relation, is_at_war_with
  - Triggered by `{`, `=`, and space characters
- **Inlay Hints**: Inline type annotations for scopes and iterators
  - Scope type hints: `scope:friend` shows `: character`
  - Chain type hints: `root.primary_title` shows `: landed_title`
  - Iterator hints: `every_vassal` shows `→ character`
  - Smart type inference from naming conventions (e.g., `_target`, `_title`, `_province`)
  - Configurable via settings: show/hide scope types, chain types, iterator types
  - 40+ character list types, 10+ title list types, faith/culture/war/scheme types
- **Document Formatting**: Auto-format CK3 scripts to Paradox conventions (Shift+Alt+F)
  - Tab indentation (Paradox convention, not spaces)
  - Opening braces on same line: `trigger = {`
  - Single space around operators: `key = value`, `>= 5`
  - Proper blank lines between top-level blocks
  - Trailing whitespace trimming
  - Preserved quoted strings and comments
- **Range Formatting**: Format only selected code (Ctrl+K Ctrl+F)
  - Automatically expands to complete blocks
  - Useful when pasting code from other sources
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
