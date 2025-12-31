"""
Document Highlight Module for CK3 Language Server.

This module provides document highlighting - when you click on a symbol,
all other occurrences of that symbol in the document are highlighted.

Highlight Types:
    - TEXT: General text match
    - READ: Symbol is being read (e.g., scope:target in a trigger)
    - WRITE: Symbol is being defined (e.g., save_scope_as = target)

Symbol Types Highlighted:
    - Saved scopes: scope:name and save_scope_as = name
    - Event IDs: namespace.0001 in trigger_event and definitions
    - Variables: var:name, local_var:name, global_var:name
    - Character flags: has_character_flag = flag, add_character_flag = flag
    - Scripted effects/triggers: usage and definitions

LSP Reference:
    https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentHighlight
"""

import re
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple
from lsprotocol import types

logger = logging.getLogger(__name__)


@dataclass
class SymbolInfo:
    """
    Information about a symbol at a position.
    
    Attributes:
        name: The symbol name
        symbol_type: Type of symbol (scope, event, variable, flag, etc.)
        full_match: The full matched text including prefix
        start: Start character position in line
        end: End character position in line
    """
    name: str
    symbol_type: str
    full_match: str
    start: int
    end: int


# Patterns for different symbol types
SYMBOL_PATTERNS = {
    # Saved scopes: scope:name
    'scope_reference': re.compile(r'\bscope:([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Scope saving: save_scope_as = name or save_temporary_scope_as = name
    'scope_definition': re.compile(r'\bsave_(?:temporary_)?scope_as\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Event IDs: namespace.0001
    'event_id': re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]*\.\d+)\b'),
    # Variables: var:name, local_var:name, global_var:name
    'variable': re.compile(r'\b((?:local_)?(?:global_)?var):([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Variable setting: set_variable = { name = x }, set_local_variable, set_global_variable
    'variable_set': re.compile(r'\bset_(?:local_|global_)?variable\s*=\s*\{[^}]*name\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Character flags: has_character_flag = x, add_character_flag = x
    'flag': re.compile(r'\b(?:has_|add_|remove_)character_flag\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Global flags: has_global_flag, set_global_flag
    'global_flag': re.compile(r'\b(?:has_|set_|remove_)global_flag\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Title flags
    'title_flag': re.compile(r'\b(?:has_|add_|remove_)title_flag\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Scripted effect calls
    'scripted_effect': re.compile(r'^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*_effect)\s*='),
    # Scripted trigger calls
    'scripted_trigger': re.compile(r'^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*_trigger)\s*='),
    # Opinion modifiers: modifier = x in add_opinion blocks
    'opinion_modifier': re.compile(r'\bmodifier\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Character modifiers in add_character_modifier
    'character_modifier': re.compile(r'\b(?:add_|remove_|has_)character_modifier\s*=\s*(?:\{[^}]*modifier\s*=\s*)?([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Trait references
    'trait': re.compile(r'\b(?:has_trait|add_trait|remove_trait)\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)'),
    # Localization keys (basic pattern)
    'localization': re.compile(r'(?:title|desc|name|tooltip)\s*=\s*([a-zA-Z_][a-zA-Z0-9_.]*[a-zA-Z0-9_])'),
}


def get_symbol_at_position(
    text: str,
    position: types.Position,
) -> Optional[SymbolInfo]:
    """
    Get the symbol at a specific position in the document.
    
    Args:
        text: Document text
        position: Cursor position
        
    Returns:
        SymbolInfo if a symbol is found at position, None otherwise
    """
    lines = text.split('\n')
    
    if position.line >= len(lines):
        return None
    
    line = lines[position.line]
    char = position.character
    
    if char >= len(line):
        return None
    
    # Try each pattern to see if cursor is on a match
    for symbol_type, pattern in SYMBOL_PATTERNS.items():
        for match in pattern.finditer(line):
            # Check if cursor position falls within this match
            if match.start() <= char <= match.end():
                # Get the captured group (the actual symbol name)
                if match.lastindex:
                    # For patterns with groups, use the last group as the symbol name
                    name = match.group(match.lastindex)
                else:
                    name = match.group(0)
                
                return SymbolInfo(
                    name=name,
                    symbol_type=symbol_type,
                    full_match=match.group(0),
                    start=match.start(),
                    end=match.end(),
                )
    
    # If no pattern matched, try to extract a word and classify it
    word_info = _extract_word_at_position(line, char)
    if word_info:
        word, start, end = word_info
        # Try to classify the word based on context
        symbol_type = _classify_word(line, word, start)
        if symbol_type:
            return SymbolInfo(
                name=word,
                symbol_type=symbol_type,
                full_match=word,
                start=start,
                end=end,
            )
    
    return None


def _extract_word_at_position(line: str, char: int) -> Optional[Tuple[str, int, int]]:
    """
    Extract the word at a position in a line.
    
    Args:
        line: Line text
        char: Character position
        
    Returns:
        Tuple of (word, start, end) or None
    """
    if char >= len(line):
        return None
    
    # Valid word characters for CK3: alphanumeric, underscore, dot (for event IDs), colon (for scope:)
    def is_word_char(c: str) -> bool:
        return c.isalnum() or c in ('_', '.', ':')
    
    # Find start of word
    start = char
    while start > 0 and is_word_char(line[start - 1]):
        start -= 1
    
    # Find end of word
    end = char
    while end < len(line) and is_word_char(line[end]):
        end += 1
    
    if start == end:
        return None
    
    word = line[start:end]
    return (word, start, end)


def _classify_word(line: str, word: str, start: int) -> Optional[str]:
    """
    Try to classify a word based on context.
    
    Args:
        line: Line text
        word: The word to classify
        start: Start position of word
        
    Returns:
        Symbol type or None
    """
    # Check for scope reference
    if word.startswith('scope:'):
        return 'scope_reference'
    
    # Check for variable reference
    if word.startswith(('var:', 'local_var:', 'global_var:')):
        return 'variable'
    
    # Check for event ID pattern (namespace.number)
    if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*\.\d+$', word):
        return 'event_id'
    
    # Check context before the word
    prefix = line[:start].rstrip()
    
    if prefix.endswith('scope:'):
        return 'scope_reference'
    
    if prefix.endswith('save_scope_as =') or prefix.endswith('save_temporary_scope_as ='):
        return 'scope_definition'
    
    if prefix.endswith(('has_trait =', 'add_trait =', 'remove_trait =')):
        return 'trait'
    
    if prefix.endswith(('has_character_flag =', 'add_character_flag =', 'remove_character_flag =')):
        return 'flag'
    
    # Check for scripted effect/trigger suffix
    if word.endswith('_effect'):
        return 'scripted_effect'
    if word.endswith('_trigger'):
        return 'scripted_trigger'
    
    return None


def find_all_occurrences(
    text: str,
    symbol: SymbolInfo,
) -> List[types.DocumentHighlight]:
    """
    Find all occurrences of a symbol in the document.
    
    Args:
        text: Document text
        symbol: The symbol to find occurrences of
        
    Returns:
        List of DocumentHighlight objects
    """
    highlights: List[types.DocumentHighlight] = []
    lines = text.split('\n')
    
    # Build patterns based on symbol type
    patterns = _get_patterns_for_symbol(symbol)
    
    for line_num, line in enumerate(lines):
        for pattern, highlight_kind in patterns:
            for match in pattern.finditer(line):
                # Check if this match contains our symbol name
                if _match_contains_symbol(match, symbol.name):
                    # Determine the range to highlight
                    # Prefer highlighting just the symbol name, not the full pattern
                    start_char, end_char = _get_highlight_range(match, symbol.name, line)
                    
                    highlight = types.DocumentHighlight(
                        range=types.Range(
                            start=types.Position(line=line_num, character=start_char),
                            end=types.Position(line=line_num, character=end_char),
                        ),
                        kind=highlight_kind,
                    )
                    highlights.append(highlight)
    
    return highlights


def _get_patterns_for_symbol(symbol: SymbolInfo) -> List[Tuple[re.Pattern, types.DocumentHighlightKind]]:
    """
    Get regex patterns to find all occurrences of a symbol.
    
    Args:
        symbol: The symbol to find
        
    Returns:
        List of (pattern, highlight_kind) tuples
    """
    name = re.escape(symbol.name)
    patterns = []
    
    if symbol.symbol_type in ('scope_reference', 'scope_definition'):
        # Find scope:name references (READ)
        patterns.append((
            re.compile(rf'\bscope:{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
        # Find save_scope_as = name definitions (WRITE)
        patterns.append((
            re.compile(rf'\bsave_(?:temporary_)?scope_as\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
    
    elif symbol.symbol_type == 'event_id':
        # Event ID in definitions (WRITE)
        patterns.append((
            re.compile(rf'^{name}\s*=\s*\{{', re.MULTILINE),
            types.DocumentHighlightKind.Write,
        ))
        # Event ID in trigger_event (READ)
        patterns.append((
            re.compile(rf'\bid\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
        # Event ID in other contexts (TEXT)
        patterns.append((
            re.compile(rf'\b{name}\b'),
            types.DocumentHighlightKind.Text,
        ))
    
    elif symbol.symbol_type == 'variable':
        # Variable references (READ)
        patterns.append((
            re.compile(rf'\b(?:local_|global_)?var:{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
        # Variable setting (WRITE)
        patterns.append((
            re.compile(rf'\bset_(?:local_|global_)?variable\s*=\s*\{{[^}}]*name\s*=\s*{name}'),
            types.DocumentHighlightKind.Write,
        ))
        # Variable in change_variable (WRITE)
        patterns.append((
            re.compile(rf'\bchange_(?:local_|global_)?variable\s*=\s*\{{[^}}]*name\s*=\s*{name}'),
            types.DocumentHighlightKind.Write,
        ))
    
    elif symbol.symbol_type == 'flag':
        # Flag checks (READ)
        patterns.append((
            re.compile(rf'\bhas_character_flag\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
        # Flag setting (WRITE)
        patterns.append((
            re.compile(rf'\badd_character_flag\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
        # Flag removal (WRITE)
        patterns.append((
            re.compile(rf'\bremove_character_flag\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
    
    elif symbol.symbol_type == 'global_flag':
        patterns.append((
            re.compile(rf'\bhas_global_flag\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
        patterns.append((
            re.compile(rf'\bset_global_flag\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
        patterns.append((
            re.compile(rf'\bremove_global_flag\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
    
    elif symbol.symbol_type == 'trait':
        patterns.append((
            re.compile(rf'\bhas_trait\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
        patterns.append((
            re.compile(rf'\badd_trait\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
        patterns.append((
            re.compile(rf'\bremove_trait\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Write,
        ))
    
    elif symbol.symbol_type in ('scripted_effect', 'scripted_trigger'):
        # Definition (WRITE)
        patterns.append((
            re.compile(rf'^{name}\s*=\s*\{{', re.MULTILINE),
            types.DocumentHighlightKind.Write,
        ))
        # Usage (READ)
        patterns.append((
            re.compile(rf'\b{name}\s*='),
            types.DocumentHighlightKind.Read,
        ))
    
    elif symbol.symbol_type == 'opinion_modifier':
        # Generic pattern for modifier names
        patterns.append((
            re.compile(rf'\bmodifier\s*=\s*{name}\b'),
            types.DocumentHighlightKind.Read,
        ))
    
    elif symbol.symbol_type == 'localization':
        # Localization key usage (READ)
        patterns.append((
            re.compile(rf'\b{name}\b'),
            types.DocumentHighlightKind.Text,
        ))
    
    else:
        # Default: find all exact matches
        patterns.append((
            re.compile(rf'\b{name}\b'),
            types.DocumentHighlightKind.Text,
        ))
    
    return patterns


def _match_contains_symbol(match: re.Match, symbol_name: str) -> bool:
    """
    Check if a regex match contains the symbol name.
    
    Args:
        match: Regex match object
        symbol_name: Symbol name to look for
        
    Returns:
        True if the match contains the symbol
    """
    # Check in captured groups first
    for group in match.groups():
        if group and group == symbol_name:
            return True
    
    # Check in full match
    return symbol_name in match.group(0)


def _get_highlight_range(
    match: re.Match,
    symbol_name: str,
    line: str,
) -> Tuple[int, int]:
    """
    Get the character range to highlight for a match.
    
    Prefers highlighting just the symbol name rather than the full pattern.
    
    Args:
        match: Regex match object
        symbol_name: Symbol name
        line: Line text
        
    Returns:
        Tuple of (start, end) character positions
    """
    # Find the symbol name within the match
    match_text = match.group(0)
    symbol_start_in_match = match_text.find(symbol_name)
    
    if symbol_start_in_match >= 0:
        # Highlight just the symbol name
        start = match.start() + symbol_start_in_match
        end = start + len(symbol_name)
        return (start, end)
    
    # Fallback to highlighting the full match
    return (match.start(), match.end())


def get_document_highlights(
    text: str,
    position: types.Position,
) -> Optional[List[types.DocumentHighlight]]:
    """
    Get document highlights for the symbol at a position.
    
    Args:
        text: Document text
        position: Cursor position
        
    Returns:
        List of DocumentHighlight objects, or None if no symbol at position
    """
    # Get the symbol at the cursor position
    symbol = get_symbol_at_position(text, position)
    
    if not symbol:
        return None
    
    logger.debug(f"Finding highlights for symbol: {symbol.name} ({symbol.symbol_type})")
    
    # Find all occurrences
    highlights = find_all_occurrences(text, symbol)
    
    if highlights:
        logger.debug(f"Found {len(highlights)} highlight(s)")
    
    return highlights if highlights else None
