"""
Hover documentation module for CK3 language server.

This module provides hover information for CK3 constructs, including:
- Effects: What they do and their parameters
- Triggers: Conditions and valid values
- Scopes: Navigation targets and types
- Events: Type and location information
- Saved scopes: Where they were defined

Hover content is formatted as Markdown for rich display in the editor.
"""

from typing import Optional
from lsprotocol import types
from pygls.workspace import TextDocument
import re

from .parser import CK3Node, get_node_at_position
from .indexer import DocumentIndex
from .ck3_language import CK3_EFFECTS, CK3_TRIGGERS, CK3_SCOPES, CK3_KEYWORDS
from .scopes import get_scope_links, get_available_scope_types
import logging

logger = logging.getLogger(__name__)


def get_word_at_position(doc: TextDocument, position: types.Position) -> Optional[str]:
    """
    Extract the word at a given cursor position.
    
    Args:
        doc: The text document
        position: Cursor position
        
    Returns:
        The word at the position, or None
    """
    try:
        lines = doc.source.split('\n')
        if position.line >= len(lines):
            return None
        
        line = lines[position.line]
        if position.character >= len(line):
            return None
        
        # Find word boundaries
        start = position.character
        end = position.character
        
        # Move start backward to word boundary
        while start > 0 and (line[start - 1].isalnum() or line[start - 1] in '_:.$'):
            start -= 1
        
        # Move end forward to word boundary
        while end < len(line) and (line[end].isalnum() or line[end] in '_:.$'):
            end += 1
        
        word = line[start:end]
        return word if word else None
    except Exception as e:
        logger.error(f"Error getting word at position: {e}")
        return None


def get_word_range(doc: TextDocument, position: types.Position, word: str) -> types.Range:
    """
    Get the range of a word at a position.
    
    Args:
        doc: The text document
        position: Cursor position
        word: The word to get range for
        
    Returns:
        Range covering the word
    """
    try:
        lines = doc.source.split('\n')
        line = lines[position.line]
        
        # Find word start
        start = position.character
        while start > 0 and (line[start - 1].isalnum() or line[start - 1] in '_:.$'):
            start -= 1
        
        # Word end is start + length
        end = start + len(word)
        
        return types.Range(
            start=types.Position(line=position.line, character=start),
            end=types.Position(line=position.line, character=end),
        )
    except Exception:
        # Return single character range as fallback
        return types.Range(
            start=position,
            end=types.Position(line=position.line, character=position.character + 1),
        )


def get_effect_documentation(effect: str) -> str:
    """
    Get documentation for an effect.
    
    Args:
        effect: Effect name
        
    Returns:
        Markdown-formatted documentation
    """
    # Basic documentation - can be expanded from data files
    effect_docs = {
        'add_gold': 'Adds gold to a character.\n\n**Usage:** `add_gold = <amount>`\n\n**Example:** `add_gold = 100`',
        'add_prestige': 'Adds prestige to a character.\n\n**Usage:** `add_prestige = <amount>`',
        'add_piety': 'Adds piety to a character.\n\n**Usage:** `add_piety = <amount>`',
        'add_trait': 'Adds a trait to a character.\n\n**Usage:** `add_trait = <trait_name>`\n\n**Example:** `add_trait = brave`',
        'remove_trait': 'Removes a trait from a character.\n\n**Usage:** `remove_trait = <trait_name>`',
        'death': 'Kills a character.\n\n**Usage:** `death = { death_reason = <reason> }`',
        'trigger_event': 'Triggers an event.\n\n**Usage:** `trigger_event = { id = <event_id> days = <delay> }`',
        'save_scope_as': 'Saves the current scope for later reference.\n\n**Usage:** `save_scope_as = <name>`\n\nUse `scope:<name>` to reference it later.',
        'save_temporary_scope_as': 'Saves the current scope temporarily (within same event).\n\n**Usage:** `save_temporary_scope_as = <name>`',
    }
    
    return effect_docs.get(effect, f'Effect that modifies game state.\n\n**Usage:** `{effect} = <value>`')


def get_trigger_documentation(trigger: str) -> str:
    """
    Get documentation for a trigger.
    
    Args:
        trigger: Trigger name
        
    Returns:
        Markdown-formatted documentation
    """
    trigger_docs = {
        'is_adult': 'Checks if character is 16 years or older.\n\n**Usage:** `is_adult = yes/no`\n\n**Returns:** Boolean',
        'is_alive': 'Checks if character is alive.\n\n**Usage:** `is_alive = yes/no`',
        'is_ruler': 'Checks if character holds any titles.\n\n**Usage:** `is_ruler = yes/no`',
        'age': 'Compares character age.\n\n**Usage:** `age >= 16`, `age < 60`',
        'gold': 'Compares character gold amount.\n\n**Usage:** `gold >= 100`',
        'has_trait': 'Checks if character has a specific trait.\n\n**Usage:** `has_trait = <trait_name>`\n\n**Example:** `has_trait = brave`',
        'has_title': 'Checks if character holds a specific title.\n\n**Usage:** `has_title = <title_id>`',
        'any_vassal': 'Checks if any vassal meets conditions.\n\n**Usage:** `any_vassal = { <conditions> }`',
        'every_vassal': 'Executes effects on every vassal.\n\n**Usage:** `every_vassal = { limit = { ... } <effects> }`',
    }
    
    return trigger_docs.get(trigger, f'Conditional check.\n\n**Usage:** `{trigger} = <value>`\n\n**Returns:** Boolean')


def get_scope_documentation(scope: str) -> str:
    """
    Get documentation for a scope link.
    
    Args:
        scope: Scope link name
        
    Returns:
        Markdown-formatted documentation
    """
    scope_docs = {
        'root': 'The root scope - the character who triggered this event/effect.\n\n**Type:** Depends on context',
        'this': 'The current scope.\n\n**Type:** Same as current',
        'prev': 'The previous scope in the chain.\n\n**Type:** Depends on context',
        'from': 'The calling scope (who triggered this).\n\n**Type:** Depends on context',
        'liege': 'Character\'s feudal superior.\n\n**Type:** character → character',
        'spouse': 'Character\'s spouse(s).\n\n**Type:** character → character',
        'father': 'Character\'s legal father.\n\n**Type:** character → character',
        'mother': 'Character\'s mother.\n\n**Type:** character → character',
        'primary_title': 'Character\'s highest-ranking title.\n\n**Type:** character → landed_title',
        'holder': 'Title holder.\n\n**Type:** landed_title → character',
    }
    
    return scope_docs.get(scope, f'Scope navigation link.\n\n**Usage:** `{scope} = {{ ... }}`')


def get_keyword_documentation(keyword: str) -> str:
    """
    Get documentation for a CK3 keyword.
    
    Args:
        keyword: Keyword name
        
    Returns:
        Markdown-formatted documentation
    """
    keyword_docs = {
        'trigger': 'Defines conditions that must be met.\n\n**Usage:** `trigger = { <conditions> }`\n\nAll conditions must be true.',
        'immediate': 'Effects executed immediately when event fires.\n\n**Usage:** `immediate = { <effects> }`\n\nNo tooltip shown to player.',
        'option': 'Player choice in an event.\n\n**Usage:** `option = { name = <loc_key> <effects> }`',
        'if': 'Conditional execution.\n\n**Usage:** `if = { limit = { <trigger> } <effects> }`',
        'else_if': 'Alternative condition.\n\n**Usage:** `else_if = { limit = { <trigger> } <effects> }`',
        'else': 'Default case.\n\n**Usage:** `else = { <effects> }`',
        'limit': 'Filtering condition.\n\n**Usage:** `limit = { <triggers> }`\n\nUsed with list iterations and conditionals.',
    }
    
    return keyword_docs.get(keyword, f'CK3 scripting keyword: {keyword}')


def get_hover_content(
    word: str,
    node: Optional[CK3Node],
    index: Optional[DocumentIndex]
) -> Optional[str]:
    """
    Generate markdown hover content for a symbol.
    
    Args:
        word: The word to provide hover for
        node: AST node at cursor position (optional)
        index: Document index (optional)
        
    Returns:
        Markdown-formatted hover content, or None if no documentation available
    """
    if not word:
        return None
    
    # Check if it's a list iterator (any_, every_, random_, ordered_) FIRST
    # This must come before scope checking since some list iterators are also in scope lists
    for prefix in ['any_', 'every_', 'random_', 'ordered_']:
        if word.startswith(prefix):
            base = word[len(prefix):]
            type_desc = {
                'any_': 'Returns true if ANY item matches conditions',
                'every_': 'Executes effects on EVERY item',
                'random_': 'Executes effects on ONE random item',
                'ordered_': 'Executes effects on items in sorted order',
            }
            return f"**{word}**\n\n*List Iterator*\n\n{type_desc[prefix]}\n\n**Base:** `{base}`\n\n**Usage:** `{word} = {{ limit = {{ ... }} <content> }}`"
    
    # Check if it's a known effect
    if word in CK3_EFFECTS:
        return f"**{word}**\n\n*Effect* — Modifies game state\n\n{get_effect_documentation(word)}"
    
    # Check if it's a known trigger
    if word in CK3_TRIGGERS:
        return f"**{word}**\n\n*Trigger* — Conditional check\n\n{get_trigger_documentation(word)}"
    
    # Check if it's a scope link
    if word in CK3_SCOPES or word in get_scope_links('character'):
        return f"**{word}**\n\n*Scope Link* — Navigate to related scope\n\n{get_scope_documentation(word)}"
    
    # Check if it's a keyword
    if word in CK3_KEYWORDS:
        return f"**{word}**\n\n*Keyword* — CK3 script structure\n\n{get_keyword_documentation(word)}"
    
    # Check if it's an event in the index
    if index and word in index.events:
        loc = index.events[word]
        # Extract filename from URI
        filename = loc.uri.split('/')[-1]
        return f"**Event: {word}**\n\n*Event Definition*\n\nDefined in: `{filename}`\n\nLine: {loc.range.start.line + 1}"
    
    # Check if it's a saved scope reference (scope:xxx)
    if word.startswith('scope:'):
        scope_name = word[6:]
        if index and scope_name in index.saved_scopes:
            loc = index.saved_scopes[scope_name]
            filename = loc.uri.split('/')[-1]
            return f"**Saved Scope: {word}**\n\n*Scope Reference*\n\nDefined with `save_scope_as = {scope_name}`\n\nLocation: `{filename}:{loc.range.start.line + 1}`"
        else:
            return f"**Saved Scope: {word}**\n\n*Scope Reference*\n\n⚠️ This scope has not been defined.\n\nUse `save_scope_as = {scope_name}` to define it."
    
    # No documentation available
    return None


def create_hover_response(
    doc: TextDocument,
    position: types.Position,
    ast: list[CK3Node],
    index: Optional[DocumentIndex]
) -> Optional[types.Hover]:
    """
    Create a hover response for a position in a document.
    
    Args:
        doc: The text document
        position: Cursor position
        ast: Parsed AST
        index: Document index (optional)
        
    Returns:
        Hover response with documentation, or None if no hover available
    """
    # Get word at cursor position
    word = get_word_at_position(doc, position)
    if not word:
        return None
    
    # Get AST node at position (for context)
    node = get_node_at_position(ast, position)
    
    # Build hover content
    content = get_hover_content(word, node, index)
    if not content:
        return None
    
    # Create hover response
    return types.Hover(
        contents=types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value=content,
        ),
        range=get_word_range(doc, position, word),
    )
