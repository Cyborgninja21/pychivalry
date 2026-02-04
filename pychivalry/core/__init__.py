"""
Core Infrastructure - Parsing, Indexing, and Utilities

This subpackage contains the foundational components for the LSP server:
- Parser: Converts CK3 script text into an Abstract Syntax Tree (AST)
- Incremental Parser: Optimized incremental parsing for fast edits
- Indexer: Cross-document symbol resolution and workspace management
- Threading: Thread pool management and task prioritization
- Utils: URI/path utilities and position checking helpers
- Workspace: Workspace management and mod descriptor parsing
"""

# Re-export all public symbols for backward compatibility
from .parser import (
    CK3Node,
    Token,
    TokenType,
    ParseError,
    tokenize,
    parse_document,
    get_node_at_position,
    find_parent_node,
)
from .incremental_parser import IncrementalParser
from .indexer import DocumentIndex, IndexedSymbol, SymbolType
from .threading import TaskPriority, TaskQueue, PriorityThreadPoolExecutor
from .utils import (
    uri_to_path,
    path_to_uri,
    is_position_in_range,
    range_contains_position,
    position_to_offset,
    offset_to_position,
)
from .workspace import WorkspaceManager, ModDescriptor

__all__ = [
    # Parser
    "CK3Node",
    "Token",
    "TokenType",
    "ParseError",
    "tokenize",
    "parse_document",
    "get_node_at_position",
    "find_parent_node",
    # Incremental Parser
    "IncrementalParser",
    # Indexer
    "DocumentIndex",
    "IndexedSymbol",
    "SymbolType",
    # Threading
    "TaskPriority",
    "TaskQueue",
    "PriorityThreadPoolExecutor",
    # Utils
    "uri_to_path",
    "path_to_uri",
    "is_position_in_range",
    "range_contains_position",
    "position_to_offset",
    "offset_to_position",
    # Workspace
    "WorkspaceManager",
    "ModDescriptor",
]
