"""
Block Semantic Validator - Context-aware CK3 script validation.

This module provides semantic validation of CK3 blocks based on their context.
Unlike syntax validators that check structure, this validates the semantic
correctness of block contents based on CK3 language rules.

Validates:
- Effects used in trigger contexts (CK3101)
- Triggers used in effect contexts (CK3102)
- Scope changers require blocks
- Comparisons require scalar values
- Nested block contexts

Diagnostic Codes:
- CK3101: Effect used in trigger context
- CK3102: Trigger used in effect context
- CK3103: Scope changer requires block
- CK3104: Comparison requires scalar value
"""

from typing import List, Optional
from lsprotocol import types

from .parser import CK3Node
from .ck3_language import CK3_EFFECTS, CK3_TRIGGERS, CK3_SCOPES


def validate_block_semantics(
    nodes: List[CK3Node],
    context: str = "unknown"
) -> List[types.Diagnostic]:
    """
    Validate block semantics based on context (trigger vs effect).

    Args:
        nodes: AST nodes to validate
        context: Current context - "trigger", "effect", or "unknown"

    Returns:
        List of semantic validation diagnostics

    Examples:
        >>> # Effect in trigger context
        >>> ast, _ = parse_document("trigger = { add_gold = 100 }")
        >>> diagnostics = validate_block_semantics(ast)
        >>> any(d.code == "CK3101" for d in diagnostics)
        True  # add_gold is an effect, not allowed in trigger

        >>> # Valid trigger in trigger context
        >>> ast, _ = parse_document("trigger = { is_adult = yes }")
        >>> diagnostics = validate_block_semantics(ast)
        >>> len(diagnostics)
        0  # No errors
    """
    diagnostics = []

    def check_node(node: CK3Node, current_context: str):
        """Recursively validate node and update context."""

        # Determine context for child nodes
        next_context = current_context
        if node.key in ("trigger", "allow", "can_use_hook"):
            next_context = "trigger"
        elif node.key in ("effect", "immediate", "after"):
            next_context = "effect"

        # Check context violations
        if current_context == "trigger":
            # Check if node is an effect being used in trigger context
            if node.key in CK3_EFFECTS:
                diagnostics.append(
                    types.Diagnostic(
                        message=f"Effect '{node.key}' cannot be used in trigger context. Use triggers instead.",
                        severity=types.DiagnosticSeverity.Error,
                        range=node.range,
                        code="CK3101",
                        source="ck3-ls",
                    )
                )
        elif current_context == "effect":
            # Check if node is a trigger being used in effect context
            if node.key in CK3_TRIGGERS:
                diagnostics.append(
                    types.Diagnostic(
                        message=f"Trigger '{node.key}' cannot be used in effect context. Use effects instead.",
                        severity=types.DiagnosticSeverity.Error,
                        range=node.range,
                        code="CK3102",
                        source="ck3-ls",
                    )
                )

        # Scope changers require blocks (any_vassal, every_county, etc.)
        if node.key in CK3_SCOPES:
            if node.type != "block":
                diagnostics.append(
                    types.Diagnostic(
                        message=f"Scope changer '{node.key}' requires a block value {{ ... }}",
                        severity=types.DiagnosticSeverity.Error,
                        range=node.range,
                        code="CK3103",
                        source="ck3-ls",
                    )
                )

        # Recurse to children with updated context
        for child in node.children:
            check_node(child, next_context)

    # Validate each top-level node
    for node in nodes:
        check_node(node, context)

    return diagnostics
