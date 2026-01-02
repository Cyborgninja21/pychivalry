# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Live Game Log Analysis** - Real-time monitoring of CK3 game logs with intelligent error detection
  - Auto-detect CK3 log directory on Windows, Linux, and macOS
  - Monitor `game.log` for changes using OS-native file events (watchdog)
  - Pattern-based error detection with 10 pre-defined error types
  - Fuzzy matching suggestions for typos in effects/triggers
  - LSP diagnostics integration - errors appear in Problems panel
  - Statistics tracking (error counts, categories, performance metrics)
  - VS Code commands: start/stop/pause/resume/clear/showStatistics
  - GameLogs output channel with color-coded severity icons
  - Configuration settings for auto-start, debounce delay, custom patterns
  - Comprehensive user guide in `plan docs/LOG_WATCHER_USAGE.md`

### Changed
- Updated README.md to highlight new live log analysis feature
- Added Copilot instructions for log watcher development workflow
- Extended VS Code extension with 6 new commands and notification handlers

## [1.0.0] - 2026-01-01

### 🎉 First Stable Release

pychivalry is now production-ready! This release marks the first stable version of the CK3 Language Server, bringing professional IDE features to Crusader Kings 3 mod development.

### Highlights

- **1,142 passing tests** with comprehensive coverage
- **15+ major LSP features** fully implemented
- **Production-ready** architecture with async/threading optimizations
- **Rich documentation** with examples and guides

### Features

All features from previous releases are now stable and production-ready:

#### Core Language Server Features
- **Context-Aware Auto-completion**: 150+ CK3 keywords, effects, triggers, and scopes
- **Real-Time Diagnostics**: Three-layer validation (syntax, semantic, scope)
- **Hover Documentation**: Rich Markdown tooltips with examples
- **Go to Definition**: Navigate to events, scripted effects/triggers, localization keys
- **Find References**: Find all usages across workspace
- **Document Symbols**: Hierarchical outline view (Ctrl+Shift+O)
- **Workspace Symbols**: Search symbols across workspace (Ctrl+T)
- **Code Actions**: Quick fixes for typos and refactoring suggestions
- **Rename Symbol**: Workspace-wide symbol renaming (F2)
- **Document Links**: Clickable file paths, URLs, and event IDs
- **Document Highlight**: Highlight all occurrences of symbol
- **Signature Help**: Parameter hints when typing
- **Inlay Hints**: Inline type annotations for scopes
- **Document Formatting**: Auto-format to Paradox conventions (Shift+Alt+F)
- **Folding Ranges**: Code folding support

#### CK3 Language Support
- **Scope System**: Full scope chain validation and saved scope tracking
- **Script Lists**: List iterator validation (any_, every_, random_, ordered_)
- **Script Values**: Formula and range validation
- **Variables System**: Complete var:, local_var:, global_var: support
- **Scripted Blocks**: Scripted triggers/effects with parameter support
- **Event System**: Full event structure and validation
- **Localization**: Key parsing, navigation, and validation

#### Performance Optimizations
- **Async Architecture**: Non-blocking operations with debouncing
- **Thread Pool**: Multi-threaded CPU-intensive operations
- **LRU Caching**: Optimized lookups and parsing
- **Adaptive Delays**: Smart debouncing based on file size
- **Memory Optimization**: Reduced AST memory footprint with __slots__

### Documentation
- Comprehensive README with quick start guide
- CHANGELOG following Keep a Changelog format
- CONTRIBUTING guide for contributors
- TESTING guide with detailed instructions
- Multiple feature-specific documentation files
- Apache 2.0 license

### Changed
- Version bumped to 1.0.0 across all packages
- Development status changed from Alpha to Production/Stable
- All URLs verified to point to public repository

## [Unreleased]

### Added
- **Multi-Channel Output Logging**: Organized output into dedicated channels for better debugging
  - **CK3: Server**: Server lifecycle messages (start, stop, restart, config changes)
  - **CK3: Debug**: Detailed debug information (auto-enabled when `logLevel` is `debug`)
  - **CK3: Commands**: Results from workspace commands (validation, rescan, stats)
  - **CK3: Trace**: LSP protocol tracing (when trace.server enabled)
  - **CK3: Performance**: Timing and cache metrics (auto-enabled when `logLevel` is `debug`)
  - Quick pick menu for "Show Output" command to select which channel to view
  - Timestamps on all log messages
  - Debug and Performance channels automatically enabled when `logLevel` setting is `debug`
- **Async & Threading Architecture**: Complete overhaul for non-blocking performance
  - **Thread Pool**: 2-4 worker threads (based on CPU count) for CPU-bound operations
  - **Async `did_change`**: Document changes now use 150ms debouncing with automatic stale update cancellation
  - **Threaded Handlers**: 10 CPU-intensive handlers now run in thread pool:
    - `semantic_tokens_full` - Rich syntax highlighting
    - `references` - Find all references
    - `workspace_symbol` - Workspace search (Ctrl+T)
    - `rename` - Symbol renaming across workspace
    - `document_formatting` / `range_formatting` - Code formatting
    - `code_lens` - Reference counts and metadata
    - `inlay_hint` - Inline type annotations
    - `folding_range` - Code folding
    - `document_highlight` - Symbol highlighting
  - **Thread-Safe Data Access**: RLocks protect `document_asts` and `index` structures
  - **Graceful Shutdown**: Clean thread pool shutdown when server stops
- **LRU Caching Optimizations**: Additional performance improvements
  - **Semantic Token Caching**: Cached builtin identifier lookups (2048-entry LRU cache) for 20-40% faster highlighting
  - **Completion Item Caching**: Cached completion item generation eliminates redundant object creation
  - **Frozenset Lookups**: O(1) membership testing for effects, triggers, keywords, scopes, and scope links
- **Advanced Optimizations** (Tiers 1-4 from ASYNC_IMPLEMENTATION_GUIDE.md):
  - **`__slots__` for CK3Node/CK3Token**: 30-50% memory reduction for large files with many AST nodes
  - **AST Content Hash Caching**: 50-entry LRU cache by MD5 hash - instant re-parsing for unchanged content
  - **Adaptive Debounce Delay**: 80ms for small files (<500 lines), 150ms medium, 250ms large, 400ms very large
  - **Parallel Workspace Scanning**: 2-4x faster workspace indexing using thread pool for file I/O
  - **Streaming Diagnostics**: Syntax errors published immediately, semantic analysis runs in background
  - **Pre-emptive Parsing Infrastructure**: Queue system for background parsing of related files (ready for Tier 4)
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

[Unreleased]: https://github.com/Cyborgninja21/pychivalry/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v1.0.0
[0.2.0]: https://github.com/Cyborgninja21/pychivalry/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0
