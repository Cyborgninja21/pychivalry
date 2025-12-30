"""
Code Actions Module for pychivalry Language Server.

This module implements LSP Code Actions (quick fixes and refactorings) for CK3 scripts.

Features:
- Quick fixes for typos (did you mean suggestions)
- Auto-fix for missing namespace declarations
- Scope chain validation suggestions
- Extract scripted effect/trigger refactorings
- Generate localization keys

Phase 14: Code Actions (v0.14.0)
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
from lsprotocol import types
import re


@dataclass
class CodeAction:
    """Represents a code action (quick fix or refactoring)."""
    
    title: str
    kind: str  # 'quickfix', 'refactor', 'source'
    diagnostics: List[types.Diagnostic]
    edit: Optional[types.WorkspaceEdit] = None
    command: Optional[types.Command] = None
    is_preferred: bool = False


@dataclass
class TextReplacement:
    """Represents a text replacement for a code action."""
    
    range: types.Range
    new_text: str


# Known effects and triggers for typo suggestions
KNOWN_EFFECTS = [
    'add_gold', 'add_prestige', 'add_piety', 'add_stress', 'add_dread',
    'add_trait', 'remove_trait', 'add_title', 'create_title',
    'set_variable', 'change_variable', 'trigger_event', 'random_list',
    'save_scope_as', 'death', 'imprison', 'release_from_prison',
    'add_character_flag', 'remove_character_flag', 'set_culture',
    'set_faith', 'add_opinion', 'reverse_add_opinion', 'spawn_army',
]

KNOWN_TRIGGERS = [
    'has_trait', 'has_title', 'has_gold', 'has_variable', 'is_alive',
    'is_landed', 'is_at_war', 'has_character_flag', 'culture', 'faith',
    'religion', 'age', 'diplomacy', 'martial', 'stewardship', 'intrigue',
    'learning', 'prowess', 'any_vassal', 'any_courtier', 'can_have_children',
]


def calculate_levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate Levenshtein distance between two strings.
    
    Args:
        s1: First string
        s2: Second string
        
    Returns:
        Levenshtein distance
        
    Example:
        >>> calculate_levenshtein_distance('add_gold', 'add_glod')
        1
        >>> calculate_levenshtein_distance('has_trait', 'has_triat')
        1
    """
    if len(s1) < len(s2):
        return calculate_levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def find_similar_keywords(word: str, candidates: List[str], max_distance: int = 2) -> List[str]:
    """
    Find similar keywords using Levenshtein distance.
    
    Args:
        word: Word to find matches for
        candidates: List of candidate keywords
        max_distance: Maximum Levenshtein distance to consider
        
    Returns:
        List of similar keywords sorted by distance
        
    Example:
        >>> find_similar_keywords('add_glod', KNOWN_EFFECTS)
        ['add_gold']
        >>> find_similar_keywords('has_triat', KNOWN_TRIGGERS)
        ['has_trait']
    """
    matches = []
    for candidate in candidates:
        distance = calculate_levenshtein_distance(word.lower(), candidate.lower())
        if distance <= max_distance:
            matches.append((candidate, distance))
    
    # Sort by distance
    matches.sort(key=lambda x: x[1])
    return [match[0] for match in matches]


def create_did_you_mean_action(
    diagnostic: types.Diagnostic,
    uri: str,
    word: str,
    suggestion: str
) -> CodeAction:
    """
    Create a "Did you mean?" code action.
    
    Args:
        diagnostic: The diagnostic to fix
        uri: Document URI
        word: The misspelled word
        suggestion: The suggested correction
        
    Returns:
        CodeAction with text replacement
        
    Example:
        >>> diag = types.Diagnostic(...)
        >>> action = create_did_you_mean_action(diag, 'file:///test.txt', 'add_glod', 'add_gold')
        >>> action.title
        "Did you mean 'add_gold'?"
    """
    edit = types.WorkspaceEdit(
        changes={
            uri: [
                types.TextEdit(
                    range=diagnostic.range,
                    new_text=suggestion
                )
            ]
        }
    )
    
    return CodeAction(
        title=f"Did you mean '{suggestion}'?",
        kind='quickfix',
        diagnostics=[diagnostic],
        edit=edit,
        is_preferred=True
    )


def create_add_namespace_action(uri: str, document_text: str) -> CodeAction:
    """
    Create an action to add missing namespace declaration.
    
    Args:
        uri: Document URI
        document_text: Full document text
        
    Returns:
        CodeAction to add namespace at top of file
        
    Example:
        >>> action = create_add_namespace_action('file:///mod/events.txt', 'event = {...}')
        >>> action.title
        'Add namespace declaration'
    """
    # Extract a reasonable namespace from the file path or use default
    namespace = 'my_mod'
    
    # Try to extract from URI
    if '/events/' in uri or '/common/' in uri:
        parts = uri.split('/')
        for i, part in enumerate(parts):
            if part in ['events', 'common'] and i > 0:
                namespace = parts[i - 1].replace('-', '_').lower()
                break
    
    # Insert at the beginning of the file
    edit = types.WorkspaceEdit(
        changes={
            uri: [
                types.TextEdit(
                    range=types.Range(
                        start=types.Position(line=0, character=0),
                        end=types.Position(line=0, character=0)
                    ),
                    new_text=f"namespace = {namespace}\n\n"
                )
            ]
        }
    )
    
    return CodeAction(
        title='Add namespace declaration',
        kind='quickfix',
        diagnostics=[],
        edit=edit
    )


def create_fix_scope_chain_action(
    diagnostic: types.Diagnostic,
    uri: str,
    invalid_chain: str,
    suggestion: str
) -> CodeAction:
    """
    Create an action to fix an invalid scope chain.
    
    Args:
        diagnostic: The diagnostic about invalid scope chain
        uri: Document URI
        invalid_chain: The invalid scope chain
        suggestion: The suggested valid chain
        
    Returns:
        CodeAction to replace scope chain
        
    Example:
        >>> action = create_fix_scope_chain_action(diag, uri, 'liege.holder', 'liege')
        >>> action.title
        "Replace with 'liege'"
    """
    edit = types.WorkspaceEdit(
        changes={
            uri: [
                types.TextEdit(
                    range=diagnostic.range,
                    new_text=suggestion
                )
            ]
        }
    )
    
    return CodeAction(
        title=f"Replace with '{suggestion}'",
        kind='quickfix',
        diagnostics=[diagnostic],
        edit=edit
    )


def suggest_valid_scope_links(
    current_scope: str,
    invalid_link: str,
    scope_definitions: Dict[str, Dict[str, Any]]
) -> List[str]:
    """
    Suggest valid scope links for a given scope type.
    
    Args:
        current_scope: Current scope type
        invalid_link: The invalid link that was attempted
        scope_definitions: Dictionary of scope definitions
        
    Returns:
        List of valid scope link suggestions
        
    Example:
        >>> suggest_valid_scope_links('character', 'owner', scope_defs)
        ['liege', 'spouse', 'primary_title']
    """
    if current_scope not in scope_definitions:
        return []
    
    scope_def = scope_definitions[current_scope]
    valid_links = scope_def.get('links', [])
    
    # Find similar links
    suggestions = find_similar_keywords(invalid_link, valid_links, max_distance=2)
    
    # If no similar ones, return all valid links (up to 5)
    if not suggestions:
        return valid_links[:5]
    
    return suggestions[:3]


def extract_selection_as_scripted_effect(
    uri: str,
    selection_range: types.Range,
    selected_text: str,
    effect_name: str
) -> CodeAction:
    """
    Create a refactoring action to extract selection as scripted effect.
    
    Args:
        uri: Document URI
        selection_range: Range of selected text
        selected_text: The selected text to extract
        effect_name: Name for the new scripted effect
        
    Returns:
        CodeAction for refactoring
        
    Example:
        >>> action = extract_selection_as_scripted_effect(uri, range, 'add_gold = 100', 'give_gold')
        >>> action.title
        "Extract as scripted effect 'give_gold'"
    """
    # Replace selection with call to scripted effect
    replacement_text = f"{effect_name} = yes"
    
    edit = types.WorkspaceEdit(
        changes={
            uri: [
                types.TextEdit(
                    range=selection_range,
                    new_text=replacement_text
                )
            ]
        }
    )
    
    # Note: In a real implementation, we'd also create the scripted effect file
    # For now, just replace the text
    
    return CodeAction(
        title=f"Extract as scripted effect '{effect_name}'",
        kind='refactor.extract',
        diagnostics=[],
        edit=edit
    )


def extract_selection_as_scripted_trigger(
    uri: str,
    selection_range: types.Range,
    selected_text: str,
    trigger_name: str
) -> CodeAction:
    """
    Create a refactoring action to extract selection as scripted trigger.
    
    Args:
        uri: Document URI
        selection_range: Range of selected text
        selected_text: The selected text to extract
        trigger_name: Name for the new scripted trigger
        
    Returns:
        CodeAction for refactoring
        
    Example:
        >>> action = extract_selection_as_scripted_trigger(uri, range, 'has_gold = 100', 'has_enough_gold')
        >>> action.title
        "Extract as scripted trigger 'has_enough_gold'"
    """
    # Replace selection with call to scripted trigger
    replacement_text = trigger_name
    
    edit = types.WorkspaceEdit(
        changes={
            uri: [
                types.TextEdit(
                    range=selection_range,
                    new_text=replacement_text
                )
            ]
        }
    )
    
    return CodeAction(
        title=f"Extract as scripted trigger '{trigger_name}'",
        kind='refactor.extract',
        diagnostics=[],
        edit=edit
    )


def generate_localization_key_action(
    uri: str,
    range: types.Range,
    event_id: str
) -> CodeAction:
    """
    Create an action to generate localization key for an event.
    
    Args:
        uri: Document URI
        range: Range where to insert localization reference
        event_id: Event ID (e.g., 'my_mod.0001')
        
    Returns:
        CodeAction to add localization key
        
    Example:
        >>> action = generate_localization_key_action(uri, range, 'my_mod.0001')
        >>> action.title
        'Generate localization keys'
    """
    # Generate standard localization keys for event
    namespace, number = event_id.split('.') if '.' in event_id else (event_id, '0000')
    
    title_key = f"{namespace}.{number}.t"
    desc_key = f"{namespace}.{number}.desc"
    
    edit = types.WorkspaceEdit(
        changes={
            uri: [
                types.TextEdit(
                    range=range,
                    new_text=f'\n    title = {title_key}\n    desc = {desc_key}'
                )
            ]
        }
    )
    
    return CodeAction(
        title='Generate localization keys',
        kind='refactor.rewrite',
        diagnostics=[],
        edit=edit
    )


def get_code_actions_for_diagnostic(
    diagnostic: types.Diagnostic,
    uri: str,
    document_text: str,
    context: str
) -> List[CodeAction]:
    """
    Get code actions for a specific diagnostic.
    
    Args:
        diagnostic: The diagnostic to provide actions for
        uri: Document URI
        document_text: Full document text
        context: Context ('trigger' or 'effect')
        
    Returns:
        List of applicable code actions
        
    Example:
        >>> diag = types.Diagnostic(message="Unknown effect 'add_glod'", ...)
        >>> actions = get_code_actions_for_diagnostic(diag, uri, text, 'effect')
        >>> len(actions)
        1
        >>> actions[0].title
        "Did you mean 'add_gold'?"
    """
    actions = []
    message = diagnostic.message
    
    # Handle typos in effects
    if 'Unknown effect' in message:
        # Extract the unknown word
        match = re.search(r"Unknown effect '([^']+)'", message)
        if match:
            word = match.group(1)
            suggestions = find_similar_keywords(word, KNOWN_EFFECTS)
            for suggestion in suggestions[:3]:  # Top 3 suggestions
                actions.append(
                    create_did_you_mean_action(diagnostic, uri, word, suggestion)
                )
    
    # Handle typos in triggers
    elif 'Unknown trigger' in message:
        match = re.search(r"Unknown trigger '([^']+)'", message)
        if match:
            word = match.group(1)
            suggestions = find_similar_keywords(word, KNOWN_TRIGGERS)
            for suggestion in suggestions[:3]:
                actions.append(
                    create_did_you_mean_action(diagnostic, uri, word, suggestion)
                )
    
    # Handle invalid scope chains
    elif 'Invalid scope chain' in message or 'Invalid scope link' in message:
        match = re.search(r"'([^']+)'", message)
        if match:
            invalid_chain = match.group(1)
            # For now, suggest removing the invalid part
            # In a real implementation, we'd use scope_definitions
            suggestions = ['liege', 'spouse', 'primary_title', 'capital_county']
            for suggestion in suggestions[:2]:
                actions.append(
                    create_fix_scope_chain_action(diagnostic, uri, invalid_chain, suggestion)
                )
    
    # Handle missing namespace
    elif 'Missing namespace' in message or 'namespace required' in message.lower():
        actions.append(create_add_namespace_action(uri, document_text))
    
    return actions


def get_refactoring_actions(
    uri: str,
    selection_range: types.Range,
    selected_text: str,
    context: str
) -> List[CodeAction]:
    """
    Get refactoring actions for a text selection.
    
    Args:
        uri: Document URI
        selection_range: Range of selected text
        selected_text: The selected text
        context: Context ('trigger' or 'effect' or 'unknown')
        
    Returns:
        List of refactoring actions
        
    Example:
        >>> actions = get_refactoring_actions(uri, range, 'add_gold = 100', 'effect')
        >>> any('Extract as scripted effect' in a.title for a in actions)
        True
    """
    actions = []
    
    # Only offer refactoring if there's meaningful content
    if len(selected_text.strip()) < 5:
        return actions
    
    # Extract as scripted effect
    if context == 'effect' or context == 'unknown':
        actions.append(
            extract_selection_as_scripted_effect(
                uri, selection_range, selected_text, 'new_scripted_effect'
            )
        )
    
    # Extract as scripted trigger
    if context == 'trigger' or context == 'unknown':
        actions.append(
            extract_selection_as_scripted_trigger(
                uri, selection_range, selected_text, 'new_scripted_trigger'
            )
        )
    
    return actions


def convert_to_lsp_code_action(action: CodeAction) -> types.CodeAction:
    """
    Convert internal CodeAction to LSP CodeAction.
    
    Args:
        action: Internal code action
        
    Returns:
        LSP CodeAction
        
    Example:
        >>> internal_action = CodeAction(title='Fix', kind='quickfix', diagnostics=[], edit=edit)
        >>> lsp_action = convert_to_lsp_code_action(internal_action)
        >>> lsp_action.title
        'Fix'
    """
    return types.CodeAction(
        title=action.title,
        kind=action.kind,
        diagnostics=action.diagnostics if action.diagnostics else None,
        edit=action.edit,
        command=action.command,
        is_preferred=action.is_preferred if action.is_preferred else None
    )


def get_all_code_actions(
    uri: str,
    range: types.Range,
    diagnostics: List[types.Diagnostic],
    document_text: str,
    selected_text: str,
    context: str
) -> List[CodeAction]:
    """
    Get all applicable code actions for a given context.
    
    Args:
        uri: Document URI
        range: Range for code actions
        diagnostics: Diagnostics in the range
        document_text: Full document text
        selected_text: Text in the range
        context: Context ('trigger', 'effect', or 'unknown')
        
    Returns:
        List of all applicable code actions
        
    Example:
        >>> actions = get_all_code_actions(uri, range, [diag], text, 'add_glod', 'effect')
        >>> len(actions) > 0
        True
    """
    actions = []
    
    # Get actions for each diagnostic
    for diagnostic in diagnostics:
        actions.extend(
            get_code_actions_for_diagnostic(diagnostic, uri, document_text, context)
        )
    
    # Get refactoring actions if there's a selection
    if selected_text and len(selected_text.strip()) > 0:
        actions.extend(
            get_refactoring_actions(uri, range, selected_text, context)
        )
    
    return actions
