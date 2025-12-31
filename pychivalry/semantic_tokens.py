"""
Semantic Tokens Module for CK3 Language Server.

This module provides semantic token analysis for CK3 scripts, enabling
rich syntax highlighting that is parser-aware and context-sensitive.

Unlike TextMate grammars (regex-based), semantic tokens understand:
- Whether a word is an effect vs trigger based on context
- Scope types and their relationships
- Custom mod definitions (scripted effects, triggers, etc.)
- Event definitions vs references

Token Types:
    - namespace: Event namespace declarations
    - class: Event type keywords (character_event, etc.)
    - function: Effects and triggers
    - variable: Scopes and saved scope references
    - property: Scope links (liege, spouse, primary_title)
    - string: Localization keys
    - number: Numeric values
    - keyword: Control flow (if, else, trigger, effect, limit)
    - operator: Operators (=, >, <, >=, <=)
    - comment: Comments (# ...)
    - parameter: Effect/trigger parameters
    - event: Event definitions and references

Token Modifiers:
    - declaration: Where a symbol is defined
    - definition: Definition site
    - readonly: Immutable values
    - defaultLibrary: Built-in game effects/triggers
    - modification: Modified values

LSP Reference:
    https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_semanticTokens
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import List, Optional, Set, Tuple, FrozenSet
from lsprotocol import types

from .parser import CK3Node, parse_document
from .indexer import DocumentIndex
from .ck3_language import (
    CK3_KEYWORDS,
    CK3_EFFECTS,
    CK3_TRIGGERS,
    CK3_SCOPES,
    CK3_EVENT_TYPES,
    CK3_BOOLEAN_VALUES,
)
from .scopes import get_scope_links

import logging
import re

logger = logging.getLogger(__name__)


# Token type definitions - order matters for encoding
TOKEN_TYPES = [
    'namespace',      # 0: namespace declarations
    'class',          # 1: event types (character_event, etc.)
    'function',       # 2: effects and triggers
    'variable',       # 3: scopes and saved scopes
    'property',       # 4: scope links
    'string',         # 5: localization keys
    'number',         # 6: numeric values
    'keyword',        # 7: control flow keywords
    'operator',       # 8: operators
    'comment',        # 9: comments
    'parameter',      # 10: parameters
    'event',          # 11: event IDs
    'macro',          # 12: list iterators (any_, every_, etc.)
    'type',           # 13: type annotations
    'enumMember',     # 14: boolean values, traits
]

# Token modifier definitions - bit flags
TOKEN_MODIFIERS = [
    'declaration',    # bit 0: definition site
    'definition',     # bit 1: definition
    'readonly',       # bit 2: immutable
    'defaultLibrary', # bit 3: built-in
    'modification',   # bit 4: modified
    'async',          # bit 5: (unused, for compatibility)
    'documentation',  # bit 6: doc comments
]

# Create lookup dictionaries for fast access
TOKEN_TYPE_INDEX = {t: i for i, t in enumerate(TOKEN_TYPES)}
TOKEN_MODIFIER_INDEX = {m: i for i, m in enumerate(TOKEN_MODIFIERS)}

# Frozensets for faster membership testing (O(1) lookups)
_KEYWORD_SET: FrozenSet[str] = frozenset(CK3_KEYWORDS) | frozenset({
    'trigger', 'immediate', 'effect', 'option', 'limit', 'desc', 'title', 'theme',
    'if', 'else', 'else_if', 'NOT', 'AND', 'OR', 'NAND', 'NOR', 
    'hidden_effect', 'show_as_tooltip'
})
_EFFECT_SET: FrozenSet[str] = frozenset(CK3_EFFECTS)
_TRIGGER_SET: FrozenSet[str] = frozenset(CK3_TRIGGERS)
_SCOPE_SET: FrozenSet[str] = frozenset(CK3_SCOPES) | frozenset({'root', 'this', 'prev', 'from'})
_EVENT_TYPE_SET: FrozenSet[str] = frozenset(CK3_EVENT_TYPES)
_BOOLEAN_SET: FrozenSet[str] = frozenset(CK3_BOOLEAN_VALUES)
_SCOPE_LINK_SET: FrozenSet[str] = frozenset(get_scope_links('character'))


@lru_cache(maxsize=2048)
def _get_builtin_token_type(word: str) -> Tuple[Optional[int], int]:
    """
    Get token type and modifiers for a built-in identifier.
    
    This function is cached to avoid repeated set lookups for common words.
    Returns (token_type_index, modifiers) or (None, 0) if not a known builtin.
    
    Args:
        word: The identifier to classify
        
    Returns:
        Tuple of (token_type_index, modifier_bits) or (None, 0)
    """
    # Check each category in order of frequency
    if word in _KEYWORD_SET:
        return (TOKEN_TYPE_INDEX['keyword'], 0)
    
    if word in _EFFECT_SET:
        return (TOKEN_TYPE_INDEX['function'], get_modifier_bits('defaultLibrary'))
    
    if word in _TRIGGER_SET:
        return (TOKEN_TYPE_INDEX['function'], get_modifier_bits('defaultLibrary'))
    
    if word in _SCOPE_SET:
        return (TOKEN_TYPE_INDEX['variable'], get_modifier_bits('readonly'))
    
    if word in _SCOPE_LINK_SET:
        return (TOKEN_TYPE_INDEX['property'], 0)
    
    if word in _EVENT_TYPE_SET:
        return (TOKEN_TYPE_INDEX['class'], get_modifier_bits('defaultLibrary'))
    
    if word in _BOOLEAN_SET:
        return (TOKEN_TYPE_INDEX['enumMember'], get_modifier_bits('readonly'))
    
    return (None, 0)


@dataclass
class SemanticToken:
    """
    Represents a single semantic token.
    
    Attributes:
        line: Line number (0-indexed)
        start: Start character (0-indexed)
        length: Token length
        token_type: Index into TOKEN_TYPES
        modifiers: Bit flags from TOKEN_MODIFIERS
    """
    line: int
    start: int
    length: int
    token_type: int
    modifiers: int = 0


def get_token_legend() -> types.SemanticTokensLegend:
    """
    Get the semantic tokens legend for capability registration.
    
    Returns:
        SemanticTokensLegend with token types and modifiers
    """
    return types.SemanticTokensLegend(
        token_types=TOKEN_TYPES,
        token_modifiers=TOKEN_MODIFIERS,
    )


def encode_tokens(tokens: List[SemanticToken]) -> List[int]:
    """
    Encode semantic tokens into the LSP delta format.
    
    Each token is encoded as 5 integers:
    1. Delta line from previous token
    2. Delta start (from previous token if same line, else from line start)
    3. Length
    4. Token type index
    5. Token modifiers (bit flags)
    
    Args:
        tokens: List of SemanticToken objects, sorted by position
        
    Returns:
        Flat list of integers in LSP format
    """
    if not tokens:
        return []
    
    # Sort tokens by position
    sorted_tokens = sorted(tokens, key=lambda t: (t.line, t.start))
    
    data = []
    prev_line = 0
    prev_start = 0
    
    for token in sorted_tokens:
        # Calculate deltas
        delta_line = token.line - prev_line
        
        if delta_line > 0:
            # New line - start is absolute
            delta_start = token.start
        else:
            # Same line - start is relative
            delta_start = token.start - prev_start
        
        data.extend([
            delta_line,
            delta_start,
            token.length,
            token.token_type,
            token.modifiers,
        ])
        
        prev_line = token.line
        prev_start = token.start
    
    return data


def get_modifier_bits(*modifiers: str) -> int:
    """
    Convert modifier names to bit flags.
    
    Args:
        modifiers: Modifier names (e.g., 'declaration', 'defaultLibrary')
        
    Returns:
        Combined bit flags
    """
    bits = 0
    for mod in modifiers:
        if mod in TOKEN_MODIFIER_INDEX:
            bits |= (1 << TOKEN_MODIFIER_INDEX[mod])
    return bits


def tokenize_line(
    line: str,
    line_num: int,
    context: str,
    index: Optional[DocumentIndex],
    custom_effects: Set[str],
    custom_triggers: Set[str],
) -> List[SemanticToken]:
    """
    Tokenize a single line of CK3 script.
    
    Args:
        line: The line text
        line_num: Line number (0-indexed)
        context: Current context ('trigger', 'effect', 'unknown')
        index: Document index for custom definitions
        custom_effects: Set of custom scripted effect names
        custom_triggers: Set of custom scripted trigger names
        
    Returns:
        List of SemanticToken objects for this line
    """
    tokens = []
    
    # Handle comments first
    comment_match = re.search(r'#.*$', line)
    if comment_match:
        tokens.append(SemanticToken(
            line=line_num,
            start=comment_match.start(),
            length=len(comment_match.group()),
            token_type=TOKEN_TYPE_INDEX['comment'],
        ))
        # Process the part before the comment
        line = line[:comment_match.start()]
    
    # Tokenize the line content
    # Pattern to match various CK3 constructs
    # Order matters - more specific patterns first
    patterns = [
        # Namespace declaration: namespace = name
        (r'\b(namespace)\s*=\s*(\w+)', 'namespace_decl'),
        # Event type: type = character_event
        (r'\b(type)\s*=\s*(character_event|letter_event|court_event|activity_event|fullscreen_event|empty_event)', 'event_type'),
        # Event ID: namespace.0001 (at start of definition)
        (r'^(\s*)([a-zA-Z_]\w*\.\d+)\s*=', 'event_def'),
        # Event reference in trigger_event: id = namespace.0001
        (r'\b(id)\s*=\s*([a-zA-Z_]\w*\.\d+)', 'event_ref'),
        # Saved scope: scope:name
        (r'\b(scope):(\w+)', 'saved_scope'),
        # List iterators: any_, every_, random_, ordered_
        (r'\b(any_|every_|random_|ordered_)(\w+)', 'list_iterator'),
        # Boolean values
        (r'\b(yes|no)\b', 'boolean'),
        # Numbers (including negative and decimals)
        (r'\b(-?\d+\.?\d*)\b', 'number'),
        # Operators
        (r'(>=|<=|!=|==|[=<>])', 'operator'),
        # Localization keys (word.word.word pattern)
        (r'\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*){2,})\b', 'loc_key'),
        # Keywords and identifiers (must be last)
        (r'\b([a-zA-Z_]\w*)\b', 'identifier'),
    ]
    
    # Track which positions we've already tokenized
    tokenized_positions = set()
    
    for pattern, pattern_type in patterns:
        for match in re.finditer(pattern, line):
            # Skip if this position overlaps with already tokenized content
            start = match.start()
            end = match.end()
            if any(start <= pos < end or tokenized_positions.__contains__(pos) 
                   for pos in range(start, end) if pos in tokenized_positions):
                continue
            
            token = None
            
            if pattern_type == 'namespace_decl':
                # 'namespace' keyword
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['keyword'],
                    modifiers=get_modifier_bits('declaration'),
                ))
                # namespace name
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(2),
                    length=len(match.group(2)),
                    token_type=TOKEN_TYPE_INDEX['namespace'],
                    modifiers=get_modifier_bits('declaration'),
                ))
                for pos in range(match.start(), match.end()):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'event_type':
                # 'type' keyword
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['keyword'],
                ))
                # event type value
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(2),
                    length=len(match.group(2)),
                    token_type=TOKEN_TYPE_INDEX['class'],
                    modifiers=get_modifier_bits('defaultLibrary'),
                ))
                for pos in range(match.start(), match.end()):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'event_def':
                # Event definition
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(2),
                    length=len(match.group(2)),
                    token_type=TOKEN_TYPE_INDEX['event'],
                    modifiers=get_modifier_bits('declaration', 'definition'),
                ))
                for pos in range(match.start(2), match.end(2)):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'event_ref':
                # 'id' keyword
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['keyword'],
                ))
                # Event reference
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(2),
                    length=len(match.group(2)),
                    token_type=TOKEN_TYPE_INDEX['event'],
                ))
                for pos in range(match.start(), match.end()):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'saved_scope':
                # 'scope' prefix
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['keyword'],
                ))
                # scope name
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(2),
                    length=len(match.group(2)),
                    token_type=TOKEN_TYPE_INDEX['variable'],
                ))
                for pos in range(match.start(), match.end()):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'list_iterator':
                # Full iterator name
                full_name = match.group(1) + match.group(2)
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(),
                    length=len(full_name),
                    token_type=TOKEN_TYPE_INDEX['macro'],
                    modifiers=get_modifier_bits('defaultLibrary'),
                ))
                for pos in range(match.start(), match.end()):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'boolean':
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['enumMember'],
                    modifiers=get_modifier_bits('readonly'),
                ))
                for pos in range(match.start(1), match.end(1)):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'number':
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['number'],
                ))
                for pos in range(match.start(1), match.end(1)):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'operator':
                tokens.append(SemanticToken(
                    line=line_num,
                    start=match.start(1),
                    length=len(match.group(1)),
                    token_type=TOKEN_TYPE_INDEX['operator'],
                ))
                for pos in range(match.start(1), match.end(1)):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'loc_key':
                # Check if it's an event ID first
                word = match.group(1)
                parts = word.split('.')
                if len(parts) == 2 and parts[1].isdigit():
                    # Event ID reference
                    tokens.append(SemanticToken(
                        line=line_num,
                        start=match.start(1),
                        length=len(word),
                        token_type=TOKEN_TYPE_INDEX['event'],
                    ))
                else:
                    # Localization key
                    tokens.append(SemanticToken(
                        line=line_num,
                        start=match.start(1),
                        length=len(word),
                        token_type=TOKEN_TYPE_INDEX['string'],
                    ))
                for pos in range(match.start(1), match.end(1)):
                    tokenized_positions.add(pos)
                    
            elif pattern_type == 'identifier':
                word = match.group(1)
                word_start = match.start(1)
                
                # Skip if already tokenized
                if word_start in tokenized_positions:
                    continue
                
                token_type = None
                modifiers = 0
                
                # First check cached builtin lookups (fast path for common words)
                builtin_type, builtin_mods = _get_builtin_token_type(word)
                if builtin_type is not None:
                    token_type = builtin_type
                    modifiers = builtin_mods
                # Then check custom definitions (not cached - index can change)
                elif word in custom_effects:
                    token_type = TOKEN_TYPE_INDEX['function']
                    modifiers = get_modifier_bits('definition')
                elif word in custom_triggers:
                    token_type = TOKEN_TYPE_INDEX['function']
                    modifiers = get_modifier_bits('definition')
                
                # Check index for custom definitions
                elif index:
                    if word in index.scripted_effects:
                        token_type = TOKEN_TYPE_INDEX['function']
                    elif word in index.scripted_triggers:
                        token_type = TOKEN_TYPE_INDEX['function']
                    elif word in index.modifiers:
                        token_type = TOKEN_TYPE_INDEX['enumMember']
                    elif word in index.character_flags:
                        token_type = TOKEN_TYPE_INDEX['variable']
                    elif word in index.opinion_modifiers:
                        token_type = TOKEN_TYPE_INDEX['enumMember']
                
                # If we identified a type, create the token
                if token_type is not None:
                    tokens.append(SemanticToken(
                        line=line_num,
                        start=word_start,
                        length=len(word),
                        token_type=token_type,
                        modifiers=modifiers,
                    ))
                    for pos in range(word_start, word_start + len(word)):
                        tokenized_positions.add(pos)
    
    return tokens


def analyze_document(
    source: str,
    index: Optional[DocumentIndex] = None,
) -> List[SemanticToken]:
    """
    Analyze a document and extract all semantic tokens.
    
    Args:
        source: Document source text
        index: Document index for custom definitions
        
    Returns:
        List of SemanticToken objects
    """
    tokens = []
    lines = source.split('\n')
    
    # Get custom effects and triggers from index
    custom_effects = index.get_all_scripted_effects() if index else set()
    custom_triggers = index.get_all_scripted_triggers() if index else set()
    
    # Track context (trigger vs effect blocks)
    context = 'unknown'
    brace_depth = 0
    context_stack = []
    
    for line_num, line in enumerate(lines):
        # Update context based on block keywords
        stripped = line.strip()
        
        # Check for context-changing keywords
        if 'trigger' in stripped and '=' in stripped and '{' in stripped:
            context_stack.append(('trigger', brace_depth))
            context = 'trigger'
        elif 'limit' in stripped and '=' in stripped and '{' in stripped:
            context_stack.append(('trigger', brace_depth))
            context = 'trigger'
        elif 'immediate' in stripped and '=' in stripped and '{' in stripped:
            context_stack.append(('effect', brace_depth))
            context = 'effect'
        elif 'effect' in stripped and '=' in stripped and '{' in stripped:
            context_stack.append(('effect', brace_depth))
            context = 'effect'
        elif 'option' in stripped and '=' in stripped and '{' in stripped:
            context_stack.append(('option', brace_depth))
            context = 'option'
        
        # Count braces to track depth
        in_string = False
        for char in line:
            if char == '"':
                in_string = not in_string
            elif not in_string:
                if char == '{':
                    brace_depth += 1
                elif char == '}':
                    brace_depth -= 1
                    # Pop context if we've closed its block
                    while context_stack and context_stack[-1][1] >= brace_depth:
                        context_stack.pop()
                    context = context_stack[-1][0] if context_stack else 'unknown'
        
        # Tokenize this line
        line_tokens = tokenize_line(line, line_num, context, index, custom_effects, custom_triggers)
        tokens.extend(line_tokens)
    
    return tokens


def get_semantic_tokens(
    source: str,
    index: Optional[DocumentIndex] = None,
) -> types.SemanticTokens:
    """
    Get semantic tokens for a document in LSP format.
    
    Args:
        source: Document source text
        index: Document index for custom definitions
        
    Returns:
        SemanticTokens object with encoded data
    """
    try:
        tokens = analyze_document(source, index)
        data = encode_tokens(tokens)
        return types.SemanticTokens(data=data)
    except Exception as e:
        logger.error(f"Error generating semantic tokens: {e}", exc_info=True)
        return types.SemanticTokens(data=[])


# Export the legend for server registration
SEMANTIC_TOKENS_LEGEND = get_token_legend()
