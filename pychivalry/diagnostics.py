"""
Diagnostics module for CK3 language server.

This module provides validation and error detection for CK3 scripts, including:
- Syntax validation (bracket matching, malformed structures)
- Semantic validation (unknown effects/triggers, invalid scopes)
- Scope chain validation

Diagnostics are published to the client via LSP's PublishDiagnostics notification.
"""

from typing import List, Optional
from lsprotocol import types
from pygls.workspace import TextDocument

from .parser import CK3Node
from .indexer import DocumentIndex
from .scopes import (
    validate_scope_chain,
    get_scope_triggers,
    get_scope_effects,
    is_valid_list_base,
    parse_list_iterator,
)
from .ck3_language import CK3_EFFECTS, CK3_TRIGGERS
import logging

logger = logging.getLogger(__name__)


def create_diagnostic(
    message: str,
    range_: types.Range,
    severity: types.DiagnosticSeverity = types.DiagnosticSeverity.Error,
    code: Optional[str] = None,
    source: str = "ck3-ls"
) -> types.Diagnostic:
    """
    Create a diagnostic object.
    
    Args:
        message: Human-readable error/warning message
        range_: Document range where the diagnostic applies
        severity: Severity level (Error, Warning, Information, Hint)
        code: Optional diagnostic code (e.g., "CK3001")
        source: Source of the diagnostic (default: "ck3-ls")
        
    Returns:
        Diagnostic object ready to send to client
    """
    return types.Diagnostic(
        message=message,
        severity=severity,
        range=range_,
        code=code,
        source=source,
    )


def check_syntax(doc: TextDocument, ast: List[CK3Node]) -> List[types.Diagnostic]:
    """
    Check for syntax errors in the document.
    
    Validates:
    - Bracket matching (unclosed/unmatched brackets)
    - Basic structural issues
    
    Args:
        doc: The text document to check
        ast: Parsed AST (may be incomplete if syntax errors exist)
        
    Returns:
        List of syntax error diagnostics
    """
    diagnostics = []
    
    # Check bracket matching
    stack = []
    lines = doc.source.split('\n')
    
    for line_num, line in enumerate(lines):
        # Track position in line
        for char_idx, char in enumerate(line):
            if char == '#':
                # Rest of line is comment, skip it
                break
            
            if char == '{':
                stack.append((line_num, char_idx))
            elif char == '}':
                if not stack:
                    # Unmatched closing bracket
                    diagnostics.append(create_diagnostic(
                        message="Unmatched closing bracket",
                        range_=types.Range(
                            start=types.Position(line=line_num, character=char_idx),
                            end=types.Position(line=line_num, character=char_idx + 1),
                        ),
                        severity=types.DiagnosticSeverity.Error,
                        code="CK3001",
                    ))
                else:
                    stack.pop()
    
    # Report unclosed brackets
    for line_num, char_idx in stack:
        diagnostics.append(create_diagnostic(
            message="Unclosed bracket",
            range_=types.Range(
                start=types.Position(line=line_num, character=char_idx),
                end=types.Position(line=line_num, character=char_idx + 1),
            ),
            severity=types.DiagnosticSeverity.Error,
            code="CK3002",
        ))
    
    return diagnostics


def check_semantics(ast: List[CK3Node], index: Optional[DocumentIndex]) -> List[types.Diagnostic]:
    """
    Check for semantic errors in the AST.
    
    Validates:
    - Unknown effects and triggers
    - Effects in trigger blocks
    - Triggers in effect blocks (warnings)
    - Undefined event references
    
    Args:
        ast: Parsed AST
        index: Document index for cross-file validation (optional)
        
    Returns:
        List of semantic diagnostics
    """
    diagnostics = []
    
    def check_node(node: CK3Node, context: str = 'unknown'):
        """Recursively check a node and its children."""
        # Determine context from node type
        new_context = context
        if node.key == 'trigger':
            new_context = 'trigger'
        elif node.key in ('immediate', 'effect'):
            new_context = 'effect'
        elif node.key == 'option':
            # Options can contain both triggers (in nested trigger blocks) and effects
            new_context = 'option'
        
        # Check for unknown effects/triggers based on context
        if context == 'trigger':
            # In trigger context, check if this is a known trigger
            if node.key not in CK3_TRIGGERS and node.type == 'assignment':
                # Check if it's a valid scope-specific trigger
                # For now, just check against global trigger list
                if node.key not in ['NOT', 'OR', 'AND', 'NAND', 'NOR']:
                    diagnostics.append(create_diagnostic(
                        message=f"Unknown trigger: '{node.key}'",
                        range_=node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3101",
                    ))
            
            # Check if someone put an effect in a trigger block
            if node.key in CK3_EFFECTS:
                diagnostics.append(create_diagnostic(
                    message=f"Effect '{node.key}' used in trigger block (triggers should check conditions, not modify state)",
                    range_=node.range,
                    severity=types.DiagnosticSeverity.Error,
                    code="CK3102",
                ))
        
        elif context == 'effect':
            # In effect context, check if this is a known effect
            if node.key not in CK3_EFFECTS and node.type == 'assignment':
                # Allow some control flow keywords
                if node.key not in ['if', 'else_if', 'else', 'random', 'random_list', 'trigger']:
                    diagnostics.append(create_diagnostic(
                        message=f"Unknown effect: '{node.key}'",
                        range_=node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3103",
                    ))
        
        # Recursively check children
        for child in node.children:
            check_node(child, new_context)
    
    # Check all top-level nodes
    for node in ast:
        check_node(node)
    
    return diagnostics


def check_scopes(ast: List[CK3Node], index: Optional[DocumentIndex]) -> List[types.Diagnostic]:
    """
    Check for scope-related errors.
    
    Validates:
    - Scope chain validity (e.g., liege.primary_title.holder)
    - Undefined saved scope references
    - Invalid list iterations
    
    Args:
        ast: Parsed AST
        index: Document index for saved scope tracking (optional)
        
    Returns:
        List of scope-related diagnostics
    """
    diagnostics = []
    
    def check_node(node: CK3Node, current_scope: str = 'character'):
        """Recursively check scope validity."""
        # Check for scope chains (contains '.')
        if '.' in node.key and not node.key.startswith('scope:'):
            # Validate scope chain
            valid, result = validate_scope_chain(node.key, current_scope)
            if not valid:
                diagnostics.append(create_diagnostic(
                    message=f"Invalid scope chain: {result}",
                    range_=node.range,
                    severity=types.DiagnosticSeverity.Error,
                    code="CK3201",
                ))
        
        # Check for saved scope references (scope:xxx)
        if node.key.startswith('scope:'):
            scope_name = node.key[6:]  # Remove 'scope:' prefix
            if index and scope_name not in index.saved_scopes:
                diagnostics.append(create_diagnostic(
                    message=f"Undefined saved scope: '{scope_name}' (use save_scope_as to define it)",
                    range_=node.range,
                    severity=types.DiagnosticSeverity.Warning,
                    code="CK3202",
                ))
        
        # Check list iterations (any_, every_, random_, ordered_)
        parsed = parse_list_iterator(node.key)
        if parsed:
            prefix, base = parsed
            if not is_valid_list_base(base, current_scope):
                diagnostics.append(create_diagnostic(
                    message=f"'{base}' is not a valid list in {current_scope} scope",
                    range_=node.range,
                    severity=types.DiagnosticSeverity.Warning,
                    code="CK3203",
                ))
        
        # Recursively check children
        for child in node.children:
            check_node(child, current_scope)
    
    # Check all top-level nodes
    for node in ast:
        check_node(node)
    
    return diagnostics


def collect_all_diagnostics(
    doc: TextDocument,
    ast: List[CK3Node],
    index: Optional[DocumentIndex] = None
) -> List[types.Diagnostic]:
    """
    Collect all diagnostics for a document.
    
    This is the main entry point for diagnostic collection. It runs all
    validation checks and returns the combined results.
    
    Args:
        doc: The text document to validate
        ast: Parsed AST
        index: Document index for cross-file validation (optional)
        
    Returns:
        Combined list of all diagnostics
    """
    diagnostics = []
    
    try:
        # Syntax checks
        diagnostics.extend(check_syntax(doc, ast))
        
        # Semantic checks
        diagnostics.extend(check_semantics(ast, index))
        
        # Scope checks
        diagnostics.extend(check_scopes(ast, index))
        
        logger.debug(f"Found {len(diagnostics)} diagnostics for {doc.uri}")
    except Exception as e:
        logger.error(f"Error during diagnostic collection: {e}", exc_info=True)
    
    return diagnostics
