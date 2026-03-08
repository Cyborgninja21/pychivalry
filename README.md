# pychivalry

[![Node.js 18+](https://img.shields.io/badge/node.js-18+-339933.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](vscode-extension/)

**A Language Server for Crusader Kings 3 Modding**

CK3 modding is powerful but challenging—Paradox's custom scripting language lacks the tooling that modern developers expect. No autocomplete, no error checking, no documentation on hover. You're left hunting through wiki pages and guessing at syntax.

**pychivalry changes that.**

Built on the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), pychivalry brings the full power of modern IDE features to CK3 mod development. Get instant feedback on syntax errors, discover effects and triggers through intelligent autocomplete, navigate your mod with go-to-definition, and understand any scope chain at a glance—all without leaving VS Code.

Whether you're writing your first event or maintaining a complex overhaul mod, pychivalry helps you write better scripts faster and catch mistakes before they crash your game.

<!-- ![Demo placeholder](https://via.placeholder.com/800x400?text=Demo+GIF+Coming+Soon) -->

## ✨ Features

### Available Now

#### 🔤 Context-Aware Auto-completion
150+ CK3 keywords, effects, triggers, and scopes with intelligent filtering.

<!-- ![Auto-completion demo](assets/images/autocomplete.png) -->

#### ✅ Real-Time Diagnostics
Syntax, semantic, and scope validation as you type.

<!-- ![Diagnostics demo](assets/images/diagnostics.png) -->

#### 📖 Hover Documentation
Rich tooltips for effects, triggers, scopes, events, and saved scopes.

<!-- ![Hover demo](assets/images/hover.png) -->

#### 🔗 Go to Definition
Jump to events, scripted effects/triggers, localization keys, and more.

<!-- ![Go to definition demo](assets/images/goto-definition.png) -->

#### 🔍 Scope System
Full scope chain validation and saved scope tracking.

<!-- ![Scope validation demo](assets/images/scope-system.png) -->

#### 📋 List Iterators
Validates any_, every_, random_, ordered_ patterns with parameters.

<!-- ![List iterators demo](assets/images/list-iterators.png) -->

#### 🔢 Script Values
Formula and range validation with operations support.

<!-- ![Script values demo](assets/images/script-values.png) -->

#### 💾 Variables
Full variable system support (var:, local_var:, global_var:).

<!-- ![Variables demo](assets/images/variables.png) -->

#### 📝 Event Validation
Event structure, themes, portraits, and option validation.

<!-- ![Event validation demo](assets/images/event-validation.png) -->

#### 🔧 Code Actions
Quick fixes for typos, refactoring suggestions.

<!-- ![Code actions demo](assets/images/code-actions.png) -->

#### 🎮 Live Game Log Analysis (NEW!)
Real-time monitoring of CK3 game logs with intelligent error detection:
- Watch `game.log` for errors as you test your mod
- 10+ error pattern types with fuzzy-match suggestions
- Diagnostics appear directly in VS Code Problems panel
- Performance analytics and statistics tracking
- Custom pattern support for mod-specific validation

See [Log Watcher Usage Guide](plan%20docs/LOG_WATCHER_USAGE.md) for details.

<!-- ![Log watcher demo](assets/images/log-watcher.png) -->

#### 🎯 Trait Validation (OPTIONAL)
Validate trait names in `has_trait`, `add_trait`, and `remove_trait`:
- ✅ Warnings for unknown traits (CK3451)
- 💡 Smart suggestions for typos ("Did you mean: brave, craven?")
- 🔍 Auto-completion with all 297 CK3 traits
- 📚 Hover documentation with trait details, opposites, categories

**This feature is OPTIONAL** and requires you to extract trait data from your own CK3 installation.

See **Optional: Trait Validation Setup** section below for setup instructions.

#### 📁 File Support
`.txt`, `.gui`, `.gfx`, and `.asset` files.

#### 🔄 Live Sync
Real-time document tracking as you type.

#### ⚡ Fast
Lightweight embedded TypeScript server with instant responses.

### Auto-completion Includes

- **Keywords**: `if`, `else`, `trigger`, `effect`, `immediate`, `limit`, `namespace`...
- **Effects**: `add_trait`, `add_gold`, `add_prestige`, `trigger_event`, `save_scope_as`...
- **Triggers**: `has_trait`, `is_ruler`, `is_adult`, `age`, `gold`, `opinion`...
- **Scopes**: `root`, `prev`, `liege`, `every_vassal`, `random_courtier`, `primary_title`...
- **Event Types**: `character_event`, `letter_event`, `court_event`, `duel_event`...
- **Snippets**: Event templates, scripted effects/triggers, common patterns

> 📖 See [CK3_FEATURES.md](CK3_FEATURES.md) for the complete list.

### Development Status

- [x] **Parser Foundation** — Full AST parsing with position tracking
- [x] **Scope System** — Scope validation, chains, and saved scopes
- [x] **Script Lists** — List iterator validation (any_, every_, random_, ordered_)
- [x] **Script Values** — Formula and range validation
- [x] **Variables System** — Variable tracking (var:, local_var:, global_var:)
- [x] **Scripted Blocks** — Scripted triggers/effects with parameter support
- [x] **Event System** — Event structure and validation
- [x] **Diagnostics** — Real-time syntax and semantic validation
- [x] **Context-Aware Completions** — Intelligent filtering by context
- [x] **Hover Documentation** — Rich tooltips with examples
- [x] **Localization Support** — Localization key validation and navigation
- [x] **Go to Definition** — Navigation to definitions across files
- [x] **Code Actions** — Quick fixes and refactoring suggestions
- [x] **Find References** — Find all usages of symbols (NEW!)
- [x] **Document Symbols** — Outline view for scripts (NEW!)
- [x] **Workspace Symbols** — Search symbols across workspace (NEW!)
- [ ] **Semantic Tokens** — Rich syntax highlighting
- [ ] **Workspace Validation** — Cross-file validation

**Status**: 1,142+ tests • Comprehensive CK3 support • Production ready (v1.0.0)

## 🚀 Quick Start

### Prerequisites

- **VS Code** — [Download](https://code.visualstudio.com/)
- **Node.js 18+** — [Download](https://nodejs.org/) (for building the extension)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry

# 2. Build the VS Code extension
cd vscode-extension
npm install
npm run compile
```

### Try It Out

1. Open `vscode-extension/` in VS Code
2. Press **F5** to launch the Extension Development Host
3. In the new window, open `examples/hello_world.txt`
4. Start typing and enjoy auto-completion!

> 📖 See [TESTING.md](TESTING.md) for detailed testing instructions.

## 📦 Installation Options

### For Users (VS Code Extension)

```bash
cd vscode-extension
npm install
npm run package
```

Then in VS Code: **Extensions** → **...** → **Install from VSIX** → select the generated `.vsix` file.

### For Developers

```bash
cd vscode-extension

# Run tests
npm test

# Unit tests only (fast)
npm run test:unit

# Lint and format
npm run lint
npm run format
```

Or from the workspace root using the Taskfile:
```bash
task build    # Full build (install + compile + compile tests)
task test     # Full test suite
task lint     # Lint TypeScript
task format   # Format with Prettier
```

## ⚙️ Configuration

Add to your VS Code `settings.json`:

```json
{
  "ck3LanguageServer.enable": true,
  "ck3LanguageServer.trace.server": "off",
  "ck3LanguageServer.logLevel": "info"
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enable` | `true` | Enable/disable the language server |
| `trace.server` | `"off"` | Set to `"verbose"` for debugging |
| `logLevel` | `"info"` | Log level: `debug`, `info`, `warning`, `error` |
| `formatting.enabled` | `true` | Enable document formatting |
| `inlayHints.enabled` | `true` | Enable inlay hints for scopes and types |
| `logWatcher.enabled` | `true` | Enable game log watcher |

**Command Palette:**
- `CK3 Language Server: Restart` — Restart the server

## 🎯 Optional: Trait Validation Setup

PyChivalry can validate trait names (`has_trait`, `add_trait`, `remove_trait`) against CK3's trait list, providing:

- ✅ Warnings for invalid trait names (CK3451)
- 💡 Smart suggestions for misspelled traits
- 🔍 Auto-completion with all 297 CK3 traits
- 📚 Hover documentation with trait details

**This feature is OPTIONAL** and requires you to extract trait data from your own CK3 installation.

### Setup Steps

1. **Open VS Code Command Palette** (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. **Run:** `CK3: Extract Trait Data from CK3 Installation`
3. **Select your CK3 installation folder** (auto-detected on Steam)
4. **Restart the language server** when prompted

The extraction tool will create local YAML files in `pychivalry/data/traits/` for your personal use.

### Requirements

- Crusader Kings III installed (Steam or standalone)

### Privacy & Copyright

- ⚠️ Extracted data contains game content that is **copyright Paradox Interactive AB**
- ✅ Stored locally on your machine (not uploaded or distributed)
- ✅ For personal use only (respects Paradox copyright)
- ✅ Files are automatically gitignored

### Without Trait Data

The language server works perfectly without trait validation:

- ✅ All other features work normally
- ✅ Syntax validation
- ✅ Scope validation
- ✅ Effect/trigger validation
- ✅ Auto-completion (except trait-specific)
- ✅ Hover documentation
- ❌ Trait name validation (skipped)

Trait validation is silently disabled when data files are not available—no errors or crashes.

## 📂 Project Structure

```
pychivalry/
├── vscode-extension/          # VS Code extension + embedded LSP server
│   ├── src/
│   │   ├── extension.ts       # Extension client entry point
│   │   ├── server-main.ts     # Language server entry point
│   │   ├── server/
│   │   │   ├── core/          # Parser, indexer, workspace management
│   │   │   ├── lsp/           # LSP feature providers (completions, hover, etc.)
│   │   │   ├── ck3/           # CK3 game logic and validation
│   │   │   ├── schema/        # YAML schema loading and validation
│   │   │   ├── data/          # Data loader, directory registry
│   │   │   ├── log/           # Game log watcher and analyzer
│   │   │   └── utils/         # Shared utilities (logger, fuzzy match, etc.)
│   │   └── test/
│   │       ├── unit/          # Unit tests (Mocha)
│   │       └── suite/         # Integration tests (VS Code test runner)
│   ├── syntaxes/              # TextMate grammars
│   ├── snippets/              # Code snippets
│   ├── package.json
│   └── webpack.config.js
├── data/                      # Static YAML data files (effects, triggers, scopes, schemas)
├── Documentation/             # Developer and user guides
├── example mod/               # Example CK3 mod for manual testing
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Whether it's:

- 🐛 Bug reports and fixes
- ✨ New CK3 language features
- 📖 Documentation improvements
- 💡 Feature suggestions

### Quick Start for Contributors

1. **Clone and set up development environment:**
   ```bash
   git clone https://github.com/Cyborgninja21/pychivalry.git
   cd pychivalry
   ./tools/setup-dev-env.sh
   ```

2. **Pre-commit hooks** are automatically installed to ensure code quality:
   - Formats TypeScript with Prettier
   - Lints TypeScript with ESLint
   - Validates YAML/JSON and checks for common issues

   See [docs/PRE_COMMIT_SETUP.md](docs/PRE_COMMIT_SETUP.md) for details.

3. **GitHub Copilot** is configured to assist development:
   - Instructions and coding standards in [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
   - Custom prompts for common tasks in [`.github/prompts/`](.github/prompts/)
   - Specialized skills in [`.github/skills/`](.github/skills/)

   See [`.github/README.md`](.github/README.md) for details on using Copilot with this project.

4. See [CONTRIBUTING.md](CONTRIBUTING.md) for complete guidelines.

## 📄 License

[Apache License 2.0](LICENSE) — Free to use, modify, and distribute.

## 🙏 Acknowledgments

- **[vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node)** — The LSP framework powering this server
- **[Paradox Interactive](https://www.paradoxinteractive.com/)** — Creators of Crusader Kings 3
- **CK3 Modding Community** — For inspiration and support

## 📚 Resources

- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) — LSP specification
- [vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node) — Server framework
- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding) — Official modding reference

---

<p align="center">
  Made with ❤️ for the CK3 modding community
</p>
