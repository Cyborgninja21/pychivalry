"""
pychivalry - A Language Server Protocol implementation for Crusader Kings 3 scripting language

This package provides intelligent language features for Crusader Kings 3 modding, including:
- Auto-completion for CK3 keywords, effects, triggers, scopes, and event types
- Semantic tokens for rich, context-aware syntax highlighting
- Hover documentation for effects, triggers, and scopes
- Go-to-definition for events, scripted effects/triggers
- Code actions for quick fixes and refactoring
- Text document synchronization for real-time editing support
- Integration with VS Code and other LSP-compatible editors

The language server is built using the pygls (Python Generic Language Server) framework
and implements the Language Server Protocol (LSP) to provide IDE-like features for
CK3's scripting language (.txt, .gui, .gfx, .asset files).

Main Components:
- server.py: Core LSP implementation with event handlers and completion logic
- ck3_language.py: Definitions of CK3 language constructs (keywords, effects, triggers, etc.)
- completions.py: Context-aware completion suggestions
- semantic_tokens.py: Rich syntax highlighting based on parser analysis
- code_actions.py: Quick fixes and refactoring actions
- diagnostics.py: Validation and error detection
- indexer.py: Cross-document symbol indexing
- hover.py: Hover documentation
- navigation.py: Go-to-definition support

Usage:
    From command line:
        python -m pychivalry.server

    Or after pip installation:
        pychivalry

For more information, see: https://github.com/Cyborgninja21/pychivalry
"""

# Package version following semantic versioning (MAJOR.MINOR.PATCH)
# This version is used by both the Python package and the VS Code extension
__version__ = "0.1.0"
