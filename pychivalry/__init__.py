"""
pychivalry - Language Server Protocol Implementation for Crusader Kings 3 Scripting

PACKAGE OVERVIEW:
    This package provides a complete Language Server Protocol (LSP) implementation for
    Crusader Kings 3 mod development, bringing modern IDE features to Paradox's custom
    scripting language. Built on pygls, it enables intelligent code editing across any
    LSP-compatible editor (VS Code, Vim, Emacs, Sublime Text, etc.).

CORE FEATURES:
    ✓ Auto-completion: 150+ CK3 keywords, effects, triggers, and scopes
    ✓ Semantic Highlighting: Context-aware syntax coloring
    ✓ Hover Documentation: Rich tooltips for effects, triggers, scopes, and events
    ✓ Go-to-Definition: Navigate to event definitions, scripted effects/triggers
    ✓ Code Actions: Quick fixes for common errors and refactoring suggestions
    ✓ Real-time Diagnostics: Syntax, semantic, and scope validation
    ✓ Document Synchronization: Live updates as you type
    ✓ Cross-file Indexing: Project-wide symbol awareness

ARCHITECTURE:
    The package follows a modular design with clear separation of concerns:
    
    Core Engine:
    - server.py: LSP server implementation and message handling
    - parser.py: AST generation from CK3 script text
    - indexer.py: Cross-document symbol indexing and caching
    
    Language Features:
    - completions.py: Context-aware autocompletion engine
    - diagnostics.py: Multi-phase validation (syntax, semantics, scopes)
    - hover.py: Hover information provider
    - navigation.py: Go-to-definition and references
    - semantic_tokens.py: Semantic highlighting engine
    - code_actions.py: Quick fixes and refactoring
    - code_lens.py: Inline code annotations
    - formatting.py: Document and range formatting
    - rename.py: Symbol renaming across files
    
    CK3-Specific:
    - ck3_language.py: Language construct definitions
    - scopes.py: Scope system and validation
    - lists.py: List iterator validation (any_, every_, etc.)
    - script_values.py: Formula and range validation
    - variables.py: Variable system (var:, local_var:, global_var:)
    - events.py: Event structure validation
    - scripted_blocks.py: Scripted triggers/effects support
    
    Data & Utilities:
    - data/__init__.py: YAML data loading for game definitions
    - workspace.py: Workspace and multi-folder support
    - document_links.py: File link detection
    - symbols.py: Document symbol extraction

LANGUAGE SERVER PROTOCOL:
    The package implements LSP 3.17 with support for:
    - textDocument/completion
    - textDocument/hover
    - textDocument/definition
    - textDocument/semanticTokens
    - textDocument/codeAction
    - textDocument/diagnostic
    - textDocument/formatting
    - textDocument/rename
    - And 15+ more LSP methods

FILE SUPPORT:
    - *.txt: CK3 script files (events, effects, triggers, decisions, etc.)
    - *.gui: GUI definition files
    - *.gfx: Graphics definition files
    - *.asset: Asset definition files

USAGE:
    Command line execution:
        python -m pychivalry.server
        
    After pip installation:
        pychivalry
        
    The server communicates via stdin/stdout using JSON-RPC 2.0.
    Editors connect automatically when configured.

INSTALLATION:
    pip install pychivalry
    
CONFIGURATION:
    The server auto-detects CK3 mod structure and requires no configuration
    for basic use. Advanced features can be configured via editor settings.

PERFORMANCE:
    - Startup: <100ms
    - Completion: <10ms
    - Diagnostics: <50ms for typical file
    - Full workspace indexing: 1-5s for large mods

MORE INFORMATION:
    GitHub: https://github.com/Cyborgninja21/pychivalry
    Documentation: See README.md and CK3_FEATURES.md
    Issues: https://github.com/Cyborgninja21/pychivalry/issues

VERSION:
    Following Semantic Versioning (MAJOR.MINOR.PATCH)
    - MAJOR: Breaking changes to API or data format
    - MINOR: New features, backwards compatible
    - PATCH: Bug fixes, no API changes
"""

# =============================================================================
# PACKAGE METADATA
# =============================================================================

# Package version following semantic versioning (MAJOR.MINOR.PATCH)
# This version is synchronized between:
# - Python package (pyproject.toml)
# - VS Code extension (package.json)
# - This __init__.py file
# Update all three when releasing new versions
__version__ = "0.1.0"

# Package name for PyPI and imports
__name__ = "pychivalry"

# Short description for package listings
__description__ = "Language Server Protocol implementation for Crusader Kings 3 scripting"

# Author information
__author__ = "Cyborgninja21"

# License type
__license__ = "Apache-2.0"

# Homepage URL
__url__ = "https://github.com/Cyborgninja21/pychivalry"

# All public exports from this package
# Controls what's available when using "from pychivalry import *"
__all__ = [
    "__version__",
    # Main server entry point is accessed via pychivalry.server module
]
