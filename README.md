# pychivalry

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](vscode-extension/)

**A Language Server for Crusader Kings 3 Modding**

pychivalry brings modern IDE features to CK3 mod development—auto-completion, syntax awareness, and intelligent assistance right in VS Code.

<!-- ![Demo placeholder](https://via.placeholder.com/800x400?text=Demo+GIF+Coming+Soon) -->

## ✨ Features

### Available Now

| Feature | Description |
|---------|-------------|
| **🔤 Auto-completion** | 150+ CK3 keywords, effects, triggers, and scopes |
| **✅ Diagnostics** | Real-time syntax and semantic validation |
| **📖 Hover Documentation** | Helpful tooltips for effects, triggers, scopes, and events |
| **🔍 Scope Validation** | Validates scope chains and saved scopes |
| **📋 List Validation** | Validates any_, every_, random_, ordered_ patterns |
| **🔢 Script Values** | Formula and range validation |
| **💾 Variables** | Full variable system support (var:, local_var:, global_var:) |
| **📁 File Support** | `.txt`, `.gui`, `.gfx`, and `.asset` files |
| **🔄 Live Sync** | Real-time document tracking as you type |
| **⚡ Fast** | Lightweight Python server with instant responses |

### Auto-completion Includes

- **Keywords**: `if`, `else`, `trigger`, `effect`, `immediate`, `limit`, `namespace`...
- **Effects**: `add_trait`, `add_gold`, `add_prestige`, `trigger_event`, `save_scope_as`...
- **Triggers**: `has_trait`, `is_ruler`, `is_adult`, `age`, `gold`, `opinion`...
- **Scopes**: `root`, `prev`, `liege`, `every_vassal`, `random_courtier`, `primary_title`...
- **Event Types**: `character_event`, `letter_event`, `duel_event`...

> 📖 See [CK3_FEATURES.md](CK3_FEATURES.md) for the complete list.

### Roadmap

- [x] **Syntax validation & diagnostics** — Real-time error detection (Phase 8 complete)
- [x] **Hover documentation** — Helpful tooltips for CK3 constructs (Phase 10 complete)
- [x] **Parser Foundation** — Full AST parsing (Phase 1 complete)
- [x] **Scope System** — Scope validation and navigation (Phase 2 complete)
- [x] **Script Lists** — List iterator validation (Phase 3 complete)
- [x] **Script Values** — Formula validation (Phase 4 complete)
- [x] **Variables System** — Variable tracking and validation (Phase 5 complete)
- [ ] Context-aware completions (Phase 9 planned)
- [ ] Go to definition (Phase 12 planned)
- [ ] Scripted blocks (Phase 6 planned)
- [ ] Event system validation (Phase 7 planned)

**Status**: 7 of 17 phases complete • 286 tests passing • Ready for production use

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
│   ├── server.py         # LSP implementation
│   └── ck3_language.py   # CK3 language definitions
├── vscode-extension/     # VS Code client extension
│   ├── src/extension.ts
│   └── package.json
├── examples/             # Test files
├── tests/                # Test suite
└── docs/                 # Additional documentation
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
