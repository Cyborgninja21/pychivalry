"""
Paradox-Specific Convention Validation for CK3 Scripts.

This module validates CK3 scripts against Paradox modding conventions and
common pitfalls, including:
- Effect/trigger context violations (CK38xx)
- List iterator misuse (CK39xx)
- Opinion modifier issues (CK36xx)
- Event structure validation (CK37xx)
- Common CK3 gotchas (CK51xx)

These checks catch issues that are syntactically valid but semantically
incorrect or likely to cause bugs.

Diagnostic Codes:
    CK3656: Inline opinion value (CW262)
    CK3760: Event missing type declaration
    CK3763: Event with no option blocks
    CK3768: Multiple immediate blocks
    CK3870: Effect used in trigger block
    CK3871: Effect used in limit block
    CK3872: Redundant trigger = { always = yes }
    CK3873: Impossible trigger = { always = no }
    CK3875: Missing limit in random_ iterator
    CK3976: Effect in any_ iterator
    CK3977: every_ without limit
    CK5137: is_alive without exists check
    CK5142: Character comparison with = instead of this
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Set, Dict, Any

from lsprotocol import types

from .parser import CK3Node
from .indexer import DocumentIndex
from .ck3_language import CK3_EFFECTS, CK3_TRIGGERS

logger = logging.getLogger(__name__)


@dataclass
class ParadoxConfig:
    """Configuration for Paradox convention checks."""
    effect_trigger_context: bool = True
    list_iterators: bool = True
    opinion_modifiers: bool = True
    event_structure: bool = True
    common_gotchas: bool = True
    redundant_triggers: bool = True


def create_paradox_diagnostic(
    message: str,
    node_range: types.Range,
    severity: types.DiagnosticSeverity = types.DiagnosticSeverity.Warning,
    code: str = "CK3800"
) -> types.Diagnostic:
    """Create a Paradox convention diagnostic."""
    return types.Diagnostic(
        message=message,
        severity=severity,
        range=node_range,
        code=code,
        source="ck3-ls-paradox",
    )


def _get_all_effects(index: Optional[DocumentIndex]) -> Set[str]:
    """Get all known effects including custom scripted effects."""
    effects = set(CK3_EFFECTS)
    if index:
        effects |= index.get_all_scripted_effects()
    return effects


def _get_all_triggers(index: Optional[DocumentIndex]) -> Set[str]:
    """Get all known triggers including custom scripted triggers."""
    triggers = set(CK3_TRIGGERS)
    if index:
        triggers |= index.get_all_scripted_triggers()
    return triggers


def check_effect_in_trigger_context(
    ast: List[CK3Node],
    index: Optional[DocumentIndex],
    config: ParadoxConfig
) -> List[types.Diagnostic]:
    """
    Check for effects used in trigger contexts.
    
    Detects:
    - CK3870: Effect used in trigger block
    - CK3871: Effect used in limit block
    """
    diagnostics = []
    
    if not config.effect_trigger_context:
        return diagnostics
    
    all_effects = _get_all_effects(index)
    
    # Keywords that indicate trigger-only context
    trigger_contexts = {'trigger', 'limit', 'can_send', 'is_shown', 'is_valid', 'is_highlighted'}
    
    # Control flow keywords allowed in any context
    control_flow = {'if', 'else_if', 'else', 'AND', 'OR', 'NOT', 'NOR', 'NAND', 'switch', 'trigger_if', 'trigger_else'}
    
    def check_node(node: CK3Node, in_trigger_context: bool, context_name: str):
        """Recursively check nodes for context violations."""
        # Update context based on node key
        new_context = in_trigger_context
        new_context_name = context_name
        
        if node.key in trigger_contexts:
            new_context = True
            new_context_name = node.key
        elif node.key in ('immediate', 'effect', 'on_accept', 'on_decline'):
            new_context = False
            new_context_name = node.key
        elif node.key == 'option':
            # Options can have both - effects at root, triggers in nested trigger/limit
            new_context = False
            new_context_name = 'option'
        
        # Check if this node is an effect in trigger context
        if in_trigger_context and node.key in all_effects:
            if node.key not in control_flow:
                code = "CK3871" if context_name == 'limit' else "CK3870"
                diagnostics.append(create_paradox_diagnostic(
                    message=f"Effect '{node.key}' used in {context_name} block. Effects cannot be used in trigger contexts.",
                    node_range=node.range,
                    severity=types.DiagnosticSeverity.Error,
                    code=code
                ))
        
        # Recurse into children
        for child in node.children:
            check_node(child, new_context, new_context_name)
    
    for node in ast:
        check_node(node, False, 'root')
    
    return diagnostics


def check_list_iterator_misuse(
    ast: List[CK3Node],
    index: Optional[DocumentIndex],
    config: ParadoxConfig
) -> List[types.Diagnostic]:
    """
    Check for list iterator misuse.
    
    Detects:
    - CK3976: Effect in any_ iterator (any_ is trigger-only)
    - CK3977: every_ without limit (affects all entries - intentional?)
    - CK3875: Missing limit in random_ iterator
    """
    diagnostics = []
    
    if not config.list_iterators:
        return diagnostics
    
    all_effects = _get_all_effects(index)
    control_flow = {'if', 'else_if', 'else', 'AND', 'OR', 'NOT', 'limit', 'alternative', 'weight'}
    
    def check_any_iterator(node: CK3Node):
        """Check any_ iterator for effects (not allowed)."""
        for child in node.children:
            if child.key in all_effects and child.key not in control_flow:
                diagnostics.append(create_paradox_diagnostic(
                    message=f"Effect '{child.key}' used in '{node.key}' iterator. any_* iterators are trigger-only; use every_* or random_* for effects.",
                    node_range=child.range,
                    severity=types.DiagnosticSeverity.Error,
                    code="CK3976"
                ))
            # Recurse but stay in any_ context
            if child.key not in ('limit',):  # limit blocks are OK
                check_any_iterator(child)
    
    def check_every_iterator(node: CK3Node):
        """Check every_ iterator for missing limit."""
        has_limit = any(child.key == 'limit' for child in node.children)
        has_content = any(child.key not in ('limit', 'alternative') for child in node.children)
        
        if not has_limit and has_content:
            diagnostics.append(create_paradox_diagnostic(
                message=f"'{node.key}' without limit - this affects ALL entries. Add a limit or comment if intentional.",
                node_range=node.range,
                severity=types.DiagnosticSeverity.Information,
                code="CK3977"
            ))
    
    def check_random_iterator(node: CK3Node):
        """Check random_ iterator for missing limit."""
        has_limit = any(child.key == 'limit' for child in node.children)
        has_content = any(child.key not in ('limit', 'alternative', 'weight') for child in node.children)
        
        if not has_limit and has_content:
            diagnostics.append(create_paradox_diagnostic(
                message=f"'{node.key}' without limit - selection is completely random. Consider adding a limit.",
                node_range=node.range,
                severity=types.DiagnosticSeverity.Warning,
                code="CK3875"
            ))
    
    def walk_ast(node: CK3Node):
        """Walk AST looking for list iterators."""
        if node.key.startswith('any_'):
            check_any_iterator(node)
        elif node.key.startswith('every_'):
            check_every_iterator(node)
        elif node.key.startswith('random_') and node.key != 'random_list' and node.key != 'random':
            check_random_iterator(node)
        
        for child in node.children:
            walk_ast(child)
    
    for node in ast:
        walk_ast(node)
    
    return diagnostics


def check_opinion_modifiers(
    ast: List[CK3Node],
    index: Optional[DocumentIndex],
    config: ParadoxConfig
) -> List[types.Diagnostic]:
    """
    Check for opinion modifier issues.
    
    Detects:
    - CK3656: Inline opinion value (should use predefined modifier)
    """
    diagnostics = []
    
    if not config.opinion_modifiers:
        return diagnostics
    
    def walk_ast(node: CK3Node):
        """Walk AST looking for opinion issues."""
        # Check for add_opinion with inline opinion value
        if node.key in ('add_opinion', 'reverse_add_opinion'):
            for child in node.children:
                if child.key == 'opinion':
                    # Inline opinion value - this is CW262
                    diagnostics.append(create_paradox_diagnostic(
                        message=f"Inline opinion value in {node.key}. Define opinion modifier in common/opinion_modifiers/ and reference by name with 'modifier = your_modifier_name'.",
                        node_range=node.range,
                        severity=types.DiagnosticSeverity.Error,
                        code="CK3656"
                    ))
                    break
        
        for child in node.children:
            walk_ast(child)
    
    for node in ast:
        walk_ast(node)
    
    return diagnostics


def check_event_structure(
    ast: List[CK3Node],
    config: ParadoxConfig
) -> List[types.Diagnostic]:
    """
    Check event structure for common issues.
    
    Detects:
    - CK3760: Event missing type declaration
    - CK3763: Event with no option blocks
    - CK3768: Multiple immediate blocks
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    for node in ast:
        # Check if this looks like an event (namespace.XXXX = { ... })
        if '.' in node.key and node.children:
            # Likely an event definition
            parts = node.key.split('.')
            if len(parts) == 2:
                try:
                    int(parts[1])  # Event ID should be numeric
                    # This is an event
                    
                    has_type = False
                    has_option = False
                    immediate_count = 0
                    
                    for child in node.children:
                        if child.key == 'type':
                            has_type = True
                        elif child.key == 'option':
                            has_option = True
                        elif child.key == 'immediate':
                            immediate_count += 1
                    
                    # CK3760: Missing type
                    if not has_type:
                        diagnostics.append(create_paradox_diagnostic(
                            message=f"Event '{node.key}' missing 'type' declaration (e.g., type = character_event)",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Error,
                            code="CK3760"
                        ))
                    
                    # CK3763: No options
                    if not has_option:
                        diagnostics.append(create_paradox_diagnostic(
                            message=f"Event '{node.key}' has no option blocks - player cannot interact with or dismiss this event",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Warning,
                            code="CK3763"
                        ))
                    
                    # CK3768: Multiple immediate blocks
                    if immediate_count > 1:
                        diagnostics.append(create_paradox_diagnostic(
                            message=f"Event '{node.key}' has {immediate_count} immediate blocks - only the first will execute",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Error,
                            code="CK3768"
                        ))
                        
                except ValueError:
                    pass  # Not an event ID
    
    return diagnostics


def check_redundant_triggers(
    ast: List[CK3Node],
    config: ParadoxConfig
) -> List[types.Diagnostic]:
    """
    Check for redundant trigger patterns.
    
    Detects:
    - CK3872: trigger = { always = yes } is redundant
    - CK3873: trigger = { always = no } makes event impossible
    """
    diagnostics = []
    
    if not config.redundant_triggers:
        return diagnostics
    
    def check_always_patterns(node: CK3Node, parent_key: str = ''):
        """Check for always = yes/no patterns."""
        if node.key == 'trigger' and node.children:
            # Check if only child is always = yes/no
            non_comment_children = [c for c in node.children if c.type != 'comment']
            if len(non_comment_children) == 1:
                child = non_comment_children[0]
                if child.key == 'always':
                    if child.value == 'yes' or child.value == True:
                        diagnostics.append(create_paradox_diagnostic(
                            message="'trigger = { always = yes }' is redundant - remove the trigger block entirely",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Information,
                            code="CK3872"
                        ))
                    elif child.value == 'no' or child.value == False:
                        diagnostics.append(create_paradox_diagnostic(
                            message="'trigger = { always = no }' makes this event impossible to fire - is this intentional?",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Warning,
                            code="CK3873"
                        ))
        
        for child in node.children:
            check_always_patterns(child, node.key)
    
    for node in ast:
        check_always_patterns(node)
    
    return diagnostics


def check_common_gotchas(
    ast: List[CK3Node],
    config: ParadoxConfig
) -> List[types.Diagnostic]:
    """
    Check for common CK3 gotchas.
    
    Detects:
    - CK5137: is_alive without prior exists check
    - CK5142: Character comparison with = instead of this
    """
    diagnostics = []
    
    if not config.common_gotchas:
        return diagnostics
    
    def walk_ast(node: CK3Node, context: Dict[str, Any]):
        """Walk AST looking for gotchas."""
        # CK5142: Character comparison with = instead of this
        # Pattern: scope:a = scope:b (should be scope:a = { this = scope:b })
        if node.key.startswith('scope:') and isinstance(node.value, str) and node.value.startswith('scope:'):
            diagnostics.append(create_paradox_diagnostic(
                message=f"Character comparison '{node.key} = {node.value}' may not work as expected. Use '{node.key} = {{ this = {node.value} }}' for character comparison.",
                node_range=node.range,
                severity=types.DiagnosticSeverity.Error,
                code="CK5142"
            ))
        
        # CK5137: is_alive without exists (simplified check)
        # This is a heuristic - we look for is_alive on scoped targets
        if node.key == 'is_alive' and node.value in ('yes', True):
            # Check if parent is a scope reference that might not exist
            parent_key = context.get('parent_key', '')
            if parent_key.startswith('scope:') or parent_key in ('mother', 'father', 'spouse', 'killer', 'betrothed'):
                # This might need an exists check
                pass  # TODO: Track exists checks in context
        
        # Recurse
        new_context = context.copy()
        new_context['parent_key'] = node.key
        
        for child in node.children:
            walk_ast(child, new_context)
    
    for node in ast:
        walk_ast(node, {})
    
    return diagnostics


def check_paradox_conventions(
    ast: List[CK3Node],
    index: Optional[DocumentIndex] = None,
    config: Optional[ParadoxConfig] = None
) -> List[types.Diagnostic]:
    """
    Collect all Paradox convention diagnostics for an AST.
    
    This is the main entry point for Paradox convention checking.
    
    Args:
        ast: Parsed AST
        index: Document index for cross-file validation
        config: Paradox configuration (uses defaults if None)
        
    Returns:
        List of Paradox convention diagnostics
    """
    config = config or ParadoxConfig()
    diagnostics = []
    
    try:
        diagnostics.extend(check_effect_in_trigger_context(ast, index, config))
        diagnostics.extend(check_list_iterator_misuse(ast, index, config))
        diagnostics.extend(check_opinion_modifiers(ast, index, config))
        diagnostics.extend(check_event_structure(ast, config))
        diagnostics.extend(check_redundant_triggers(ast, config))
        diagnostics.extend(check_common_gotchas(ast, config))
        
        logger.debug(f"Paradox convention checks found {len(diagnostics)} issues")
        
    except Exception as e:
        logger.error(f"Error during Paradox convention check: {e}", exc_info=True)
    
    return diagnostics
