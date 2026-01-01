# PyChivalry Documentation Index

This is the master index for the comprehensive Python module documentation of the PyChivalry project.

## 📚 Documentation Files

### 1. [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md)
**Comprehensive Analysis of All Python Scripts**

A detailed analysis covering:
- All 31 Python modules in the `pychivalry/` package
- All 42 test files organized by category
- Module purposes, key features, and relationships
- Dependency graphs and design patterns
- Extension points for future development
- Statistics: 1,142+ tests, 20 LSP features, 11 custom commands

**Best For**: Understanding the overall project structure, finding which module handles what functionality, and planning new features.

---

### 2. [FUNCTION_SIGNATURES.md](FUNCTION_SIGNATURES.md)
**Detailed Function and Class Signatures**

Provides detailed signatures for:
- Core infrastructure modules (parser, indexer, server)
- CK3 language definitions (ck3_language, scopes)
- LSP feature implementations (completions, diagnostics)
- 100+ functions with full type hints
- 6 main classes with all methods
- 24 LSP handlers and 11 custom commands

**Best For**: Implementing new features, understanding function parameters, and API integration.

---

## 🗺️ Quick Navigation Guide

### By Role

#### **For New Contributors**
1. Start with [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md) - Section "Module Dependency Graph"
2. Read "Key Design Patterns" to understand the architecture
3. Review the module you want to contribute to

#### **For API Users**
1. Check [FUNCTION_SIGNATURES.md](FUNCTION_SIGNATURES.md) for the module you need
2. Look at function signatures and return types
3. See related modules in the dependency graph

#### **For Maintainers**
1. Review "Extension Points for Future Development" in [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md)
2. Check test coverage for each module
3. Use function signatures for code review reference

---

## 📖 Module Categories

### Core Infrastructure (4 modules)
| Module | Documentation | Lines | Key Purpose |
|--------|--------------|-------|-------------|
| `server.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#2-serverpy-⭐-3212-lines) / [Sig](FUNCTION_SIGNATURES.md#serverpy) | 3,212 | Main LSP server with 24 feature handlers |
| `parser.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#3-parserpy-396-lines) / [Sig](FUNCTION_SIGNATURES.md#parserpy) | 396 | CK3 script → AST conversion |
| `indexer.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#4-indexerpy-1185-lines) / [Sig](FUNCTION_SIGNATURES.md#indexerpy) | 1,185 | Cross-document symbol tracking |
| `workspace.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#5-workspacepy) | TBD | Workspace-wide operations |

### CK3 Language (2 modules)
| Module | Documentation | Key Purpose |
|--------|--------------|-------------|
| `ck3_language.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#21-ck3_languagepy) / [Sig](FUNCTION_SIGNATURES.md#ck3_languagepy) | 150+ CK3 language constructs |
| `scopes.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#22-scopespy) / [Sig](FUNCTION_SIGNATURES.md#scopespy) | Scope validation and tracking |

### LSP Features (14 modules)
| Module | Documentation | Key Feature |
|--------|--------------|-------------|
| `completions.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#6-completionspy) / [Sig](FUNCTION_SIGNATURES.md#completionspy) | Context-aware auto-completion |
| `diagnostics.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#7-diagnosticspy) / [Sig](FUNCTION_SIGNATURES.md#diagnosticspy) | Real-time validation |
| `hover.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#8-hoverpy) | Rich hover documentation |
| `navigation.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#9-navigationpy) | Go-to-definition |
| `code_actions.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#10-code_actionspy) | Quick fixes |
| `code_lens.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#11-code_lenspy) | Reference counts |
| `semantic_tokens.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#12-semantic_tokenspy) | Rich syntax highlighting |
| `formatting.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#13-formattingpy) | Auto-formatting |
| `inlay_hints.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#14-inlay_hintspy) | Inline type annotations |
| `signature_help.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#15-signature_helppy) | Parameter hints |
| `document_highlight.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#16-document_highlightpy) | Symbol highlighting |
| `document_links.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#17-document_linkspy) | Clickable links |
| `rename.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#18-renamepy) | Symbol renaming |
| `folding.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#19-foldingpy) | Code folding |
| `symbols.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#20-symbolspy) | Document symbols |

### CK3-Specific Logic (8 modules)
| Module | Documentation | Purpose |
|--------|--------------|---------|
| `events.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#23-eventspy) | Event validation |
| `lists.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#24-listspy) | List iterator validation |
| `script_values.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#25-script_valuespy) | Formula validation |
| `variables.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#26-variablespy) | Variable system |
| `scripted_blocks.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#27-scripted_blockspy) | Scripted effects/triggers |
| `localization.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#28-localizationpy) | Localization keys |
| `style_checks.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#29-style_checkspy) | Style validation |
| `paradox_checks.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#30-paradox_checkspy) | Best practices |
| `scope_timing.py` | [Doc](PYTHON_MODULES_DOCUMENTATION.md#31-scope_timingpy) | Performance analysis |

---

## 🔍 Finding What You Need

### "I want to understand how X works"
1. Search [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md) for the feature name
2. Read the module's "Purpose" and "Key Features" sections
3. Check the "Module Dependency Graph" to see related modules

### "I need to call function X"
1. Open [FUNCTION_SIGNATURES.md](FUNCTION_SIGNATURES.md)
2. Find the module section
3. Look up the function signature with types and documentation

### "I want to add feature X"
1. Check "Extension Points for Future Development" in [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md)
2. Find similar existing features
3. Review the pattern used in those modules

### "I need to fix a bug in X"
1. Find the module in [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md)
2. Check the corresponding test file in the "Test Suite Organization" section
3. Review the function signatures in [FUNCTION_SIGNATURES.md](FUNCTION_SIGNATURES.md)

---

## 📊 Project Statistics

### Codebase
- **Total Modules**: 31 main modules
- **Test Files**: 42 test files
- **Total Tests**: 1,142+ tests
- **Lines of Code**: ~15,000+ lines (estimated)

### LSP Implementation
- **Feature Handlers**: 24 LSP features
- **Custom Commands**: 11 custom commands
- **Symbol Types**: 13 indexed types
- **File Types Supported**: .txt, .gui, .gfx, .asset, .yml

### CK3 Language Support
- **Keywords**: 60+ keywords
- **Effects**: 150+ effects
- **Triggers**: 250+ triggers
- **Scopes**: 30+ scope types
- **Event Types**: 5 event types

---

## 🚀 Getting Started

### For Development
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

### For Usage
```bash
# Run the language server
python -m pychivalry.server

# With debug logging
python -m pychivalry.server --log-level debug
```

---

## 🤝 Contributing

Before contributing:
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Review relevant module documentation
3. Check existing tests for patterns
4. Ensure your code follows the documented patterns

---

## 📝 Documentation Updates

### When to Update

**Update [PYTHON_MODULES_DOCUMENTATION.md](PYTHON_MODULES_DOCUMENTATION.md) when:**
- Adding a new module
- Changing module purpose or architecture
- Adding new LSP features
- Updating design patterns

**Update [FUNCTION_SIGNATURES.md](FUNCTION_SIGNATURES.md) when:**
- Adding new public functions
- Changing function signatures
- Adding new classes
- Modifying return types

### How to Update

1. Follow the existing format in each file
2. Maintain alphabetical/logical ordering
3. Include type hints for all signatures
4. Add brief but clear descriptions
5. Update the statistics section

---

## 🔗 Related Resources

- [README.md](README.md) - Project overview and quick start
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [TESTING.md](TESTING.md) - Testing documentation
- [CK3_FEATURES.md](CK3_FEATURES.md) - Complete list of CK3 features

---

## 📧 Questions?

If you can't find what you're looking for:
1. Check the relevant documentation file
2. Search the codebase for examples
3. Look at test files for usage patterns
4. Open an issue if documentation is missing

---

*Last Updated: 2026-01-01*
*Documentation Version: 1.0*
