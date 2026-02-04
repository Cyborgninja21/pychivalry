"""
LSP Features - Language Server Protocol Feature Implementations

This subpackage contains all LSP feature implementations:
- Completions: Context-aware auto-completion
- Hover: Hover documentation provider
- Navigation: Go-to-definition, find references
- Symbols: Document outline and breadcrumb navigation
- Semantic Tokens: Context-aware syntax highlighting
- Code Actions: Quick fixes and refactoring actions
- Code Lens: Inline actionable information
- Formatting: Document and range formatting
- Folding: Code folding ranges
- Rename: Workspace-wide symbol renaming
- Inlay Hints: Inline type annotations
- Signature Help: Parameter hints for functions
- Document Highlight: Highlight all occurrences of a symbol
- Document Links: Clickable file paths and URLs
"""

# Note: Individual feature providers are not re-exported here to avoid circular imports.
# Import specific features directly as needed:
# from pychivalry.lsp.completions import CompletionProvider
# from pychivalry.lsp.hover import HoverProvider

__all__ = []
