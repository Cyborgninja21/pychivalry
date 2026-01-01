# pychivalry

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
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

#### 📁 File Support
`.txt`, `.gui`, `.gfx`, and `.asset` files.

#### 🔄 Live Sync
Real-time document tracking as you type.

#### ⚡ Fast
Lightweight Python server with instant responses.

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

- **Python 3.9+** — [Download](https://www.python.org/downloads/)
- **VS Code** — [Download](https://code.visualstudio.com/)
- **Node.js 18+** — [Download](https://nodejs.org/) (for building the extension)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry

# 2. Install the language server
pip install -e .

# 3. Build the VS Code extension
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
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Code quality
black pychivalry/
flake8 pychivalry/
mypy pychivalry/
```

## ⚙️ Configuration

Add to your VS Code `settings.json`:

```json
{
  "ck3LanguageServer.enable": true,
  "ck3LanguageServer.pythonPath": "python",
  "ck3LanguageServer.trace.server": "off"
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enable` | `true` | Enable/disable the language server |
| `pythonPath` | `"python"` | Path to Python interpreter |
| `trace.server` | `"off"` | Set to `"verbose"` for debugging |

**Command Palette:**
- `CK3 Language Server: Restart` — Restart the server

## 📂 Project Structure

```
pychivalry/
├── pychivalry/           # Python language server
│   ├── server.py         # LSP implementation with feature handlers
│   ├── parser.py         # CK3 script parser (syntax → AST)
│   ├── indexer.py        # Document symbol indexer
│   ├── scopes.py         # Scope system & validation
│   ├── diagnostics.py    # Validation & error detection
│   ├── hover.py          # Hover documentation
│   ├── completions.py    # Context-aware completions
│   ├── navigation.py     # Go-to-definition support
│   ├── code_actions.py   # Quick fixes & refactoring
│   ├── events.py         # Event structure validation
│   ├── lists.py          # List iterator validation
│   ├── script_values.py  # Script value validation
│   ├── variables.py      # Variable system support
│   ├── scripted_blocks.py# Scripted effects/triggers
│   ├── localization.py   # Localization support
│   ├── workspace.py      # Cross-file validation
│   ├── ck3_language.py   # CK3 language definitions
│   └── data/             # YAML data files for game definitions
├── vscode-extension/     # VS Code client extension
│   ├── src/extension.ts
│   └── package.json
├── examples/             # Test files
├── tests/                # Comprehensive test suite (645+ tests)
│   ├── integration/      # Integration tests
│   ├── regression/       # Regression tests
│   ├── fuzzing/          # Fuzz tests
│   └── performance/      # Performance benchmarks
└── Documentation/        # Developer documentation
```

## 🤝 Contributing

Contributions are welcome! Whether it's:

- 🐛 Bug reports and fixes
- ✨ New CK3 language features
- 📖 Documentation improvements
- 💡 Feature suggestions

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## 📄 License

[Apache License 2.0](LICENSE) — Free to use, modify, and distribute.

## 🙏 Acknowledgments

- **[pygls](https://github.com/openlawlibrary/pygls)** — The Python LSP framework powering this server
- **[Paradox Interactive](https://www.paradoxinteractive.com/)** — Creators of Crusader Kings 3
- **CK3 Modding Community** — For inspiration and support

## 📚 Resources

- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) — LSP specification
- [pygls Documentation](https://pygls.readthedocs.io/) — Server framework docs
- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding) — Official modding reference

---

<p align="center">
  Made with ❤️ for the CK3 modding community
</p>
