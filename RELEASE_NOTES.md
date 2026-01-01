# pychivalry v1.0.0 Release Notes

**Release Date**: January 1, 2026

We're excited to announce the **first stable release** of pychivalry, a comprehensive Language Server Protocol implementation for Crusader Kings 3 mod development! 🎉

## What is pychivalry?

pychivalry brings modern IDE features to CK3 modding—auto-completion, real-time diagnostics, go-to-definition, and intelligent assistance right in VS Code. It's like having an expert CK3 modder looking over your shoulder!

## 🌟 Highlights

- **Production Ready**: 1,142 passing tests with comprehensive coverage
- **15+ LSP Features**: Full-featured language server implementation
- **High Performance**: Async/threading architecture with intelligent caching
- **Rich Documentation**: Extensive guides, examples, and API documentation
- **Open Source**: Apache 2.0 licensed

## ✨ Features

### Core Language Server Features

- **🔤 Context-Aware Auto-completion**: 150+ CK3 keywords, effects, triggers, and scopes with intelligent filtering by context
- **✅ Real-Time Diagnostics**: Three-layer validation (syntax, semantic, scope) as you type
- **📖 Hover Documentation**: Rich Markdown tooltips with examples and usage information
- **🔗 Go to Definition**: Navigate to events, scripted effects/triggers, localization keys, and more
- **🔍 Find References**: Find all usages of symbols across your workspace
- **📋 Document Symbols**: Hierarchical outline view of your scripts (Ctrl+Shift+O)
- **🔎 Workspace Symbols**: Search symbols across entire workspace (Ctrl+T)
- **🔧 Code Actions**: Quick fixes for typos and intelligent refactoring suggestions
- **✏️ Rename Symbol**: Workspace-wide symbol renaming with validation (F2)
- **🔗 Document Links**: Clickable file paths, URLs, and event IDs
- **💡 Document Highlight**: Highlight all occurrences of a symbol in the file
- **📝 Signature Help**: Parameter hints when typing in effect blocks
- **🏷️ Inlay Hints**: Inline type annotations for scopes and iterators
- **🎨 Document Formatting**: Auto-format to Paradox conventions (Shift+Alt+F)
- **📁 Folding Ranges**: Smart code folding for blocks, events, and regions

### CK3 Language Support

- **Scope System**: Complete scope chain validation and saved scope tracking
- **Script Lists**: List iterator validation (any_, every_, random_, ordered_)
- **Script Values**: Formula and range validation with operations
- **Variables System**: Full var:, local_var:, global_var: support
- **Scripted Blocks**: Scripted triggers/effects with parameter substitution
- **Event System**: Comprehensive event structure and validation
- **Localization**: Key parsing, navigation, and text formatting validation

### Performance Optimizations

- **Async Architecture**: Non-blocking document operations with smart debouncing
- **Thread Pool**: Multi-threaded processing for CPU-intensive operations
- **LRU Caching**: Intelligent caching for fast repeated lookups
- **Adaptive Delays**: Smart debouncing based on file size
- **Memory Optimization**: Reduced AST memory footprint with `__slots__`

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- VS Code
- Node.js 18+ (for building the extension)

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

## 📊 Project Stats

- **1,142 tests** passing with comprehensive coverage
- **15+ LSP features** fully implemented
- **30+ Python modules** with clean architecture
- **150+ CK3 constructs** supported (keywords, effects, triggers, scopes)
- **Multiple test categories**: unit, integration, regression, fuzzing, performance

## 🔒 Security

This release includes a comprehensive [SECURITY.md](SECURITY.md) file with:
- Supported versions
- Vulnerability reporting process
- Security best practices
- Known security considerations

## 📚 Documentation

- [README.md](README.md) - Quick start guide and feature overview
- [CHANGELOG.md](CHANGELOG.md) - Complete version history
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [TESTING.md](TESTING.md) - Testing instructions
- [SECURITY.md](SECURITY.md) - Security policy
- [CK3_FEATURES.md](CK3_FEATURES.md) - Complete CK3 language feature list

## 🤝 Contributing

We welcome contributions! Whether it's bug reports, feature requests, documentation improvements, or code contributions, we appreciate your help. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

pychivalry is licensed under the [Apache License 2.0](LICENSE) - free to use, modify, and distribute.

## 🙏 Acknowledgments

- **[pygls](https://github.com/openlawlibrary/pygls)** - The Python LSP framework powering this server
- **[Paradox Interactive](https://www.paradoxinteractive.com/)** - Creators of Crusader Kings 3
- **CK3 Modding Community** - For inspiration and support

## 🔮 What's Next?

While v1.0.0 is feature-complete and production-ready, we have exciting plans for future releases:

- Semantic tokens for enhanced syntax highlighting
- Workspace-wide validation for cross-file consistency
- Additional CK3 language constructs as the game evolves
- Community-contributed improvements and features

## 📣 Feedback

We'd love to hear from you! Please:
- ⭐ Star the repository if you find it useful
- 🐛 Report bugs via [GitHub Issues](https://github.com/Cyborgninja21/pychivalry/issues)
- 💡 Share feature ideas and suggestions
- 📢 Spread the word in the CK3 modding community

---

<p align="center">
  Made with ❤️ for the CK3 modding community
</p>
