"""
Core Infrastructure - Parsing, Indexing, and Utilities

This subpackage contains the foundational components for the LSP server:
- Parser: Converts CK3 script text into an Abstract Syntax Tree (AST)
- Incremental Parser: Optimized incremental parsing for fast edits
- Indexer: Cross-document symbol resolution and workspace management
- Threading: Thread pool management and task prioritization
- Utils: URI/path utilities and position checking helpers
- Workspace: Workspace management and mod descriptor parsing

Import directly from the submodules as needed:
    from pychivalry.core.parser import parse_document, CK3Node
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.core.threading import TaskPriority
"""

__all__ = []
