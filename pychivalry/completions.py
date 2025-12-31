"""
Context-Aware Completions for CK3 Language Server

This module implements intelligent, context-aware auto-completion for CK3 scripting.
Unlike simple keyword completion, this system understands the structure of CK3 code
and provides appropriate suggestions based on:
- Current scope type (character, title, province, etc.)
- Block context (trigger, effect, immediate, option, limit, etc.)
- Cursor position (after dot, after scope:, in assignment, etc.)

The completion system filters the full set of CK3 language constructs to show only
what's relevant in the current context, making it easier for modders to write correct
code without consulting documentation.

Architecture:
    1. Context detection analyzes the AST node at cursor position
    2. Scope resolution determines the current scope type from parent blocks
    3. Filtering applies rules based on context (triggers in trigger blocks, etc.)
    4. Snippet expansion provides templates for common patterns

Examples:
    - Inside "trigger = { }" → Only show triggers
    - After "liege." → Only show valid scope links from character scope
    - After "scope:" → Show saved scope names from document
    - In option block → Show both effects and triggers

Integration:
    Called by server.py's TEXT_DOCUMENT_COMPLETION handler, which provides
    document URI, cursor position, and AST for context analysis.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import List, Optional, Set, Dict, Any, Tuple
from lsprotocol import types

from .ck3_language import CK3_KEYWORDS, CK3_EFFECTS, CK3_TRIGGERS, CK3_SCOPES, CK3_EVENT_TYPES, CK3_BOOLEAN_VALUES
from .parser import CK3Node
from .scopes import get_scope_links, get_scope_lists, get_resulting_scope
from .indexer import DocumentIndex


# =============================================================================
# Cached Completion Item Generation
# =============================================================================
# These functions generate the same items repeatedly, so we cache the results.
# Since CompletionItem objects are created fresh each time and the source data
# (CK3_EFFECTS, CK3_TRIGGERS, etc.) is immutable, caching is safe.

@lru_cache(maxsize=1)
def _cached_trigger_completions() -> Tuple[types.CompletionItem, ...]:
    """Generate and cache trigger completion items."""
    items = []
    for trigger in CK3_TRIGGERS:
        items.append(
            types.CompletionItem(
                label=trigger,
                kind=types.CompletionItemKind.Function,
                detail="CK3 Trigger",
                documentation=f"CK3 trigger condition: {trigger}",
            )
        )
    return tuple(items)


@lru_cache(maxsize=1)
def _cached_effect_completions() -> Tuple[types.CompletionItem, ...]:
    """Generate and cache effect completion items."""
    items = []
    for effect in CK3_EFFECTS:
        items.append(
            types.CompletionItem(
                label=effect,
                kind=types.CompletionItemKind.Function,
                detail="CK3 Effect",
                documentation=f"CK3 effect that modifies game state: {effect}",
            )
        )
    return tuple(items)


@lru_cache(maxsize=1)
def _cached_scope_completions() -> Tuple[types.CompletionItem, ...]:
    """Generate and cache scope completion items."""
    items = []
    for scope in CK3_SCOPES:
        items.append(
            types.CompletionItem(
                label=scope,
                kind=types.CompletionItemKind.Variable,
                detail="CK3 Scope",
                documentation=f"CK3 scope switch: {scope}",
            )
        )
    return tuple(items)


@lru_cache(maxsize=1)
def _cached_all_keyword_completions() -> Tuple[types.CompletionItem, ...]:
    """Generate and cache all keyword completion items."""
    items = []
    for keyword in CK3_KEYWORDS:
        items.append(
            types.CompletionItem(
                label=keyword,
                kind=types.CompletionItemKind.Keyword,
                detail="CK3 Keyword",
                documentation=f"CK3 scripting keyword: {keyword}",
            )
        )
    return tuple(items)


@lru_cache(maxsize=32)
def _cached_keyword_completions(keywords_tuple: Tuple[str, ...]) -> Tuple[types.CompletionItem, ...]:
    """Generate and cache keyword completions for specific keyword sets."""
    items = []
    for keyword in keywords_tuple:
        items.append(
            types.CompletionItem(
                label=keyword,
                kind=types.CompletionItemKind.Keyword,
                detail="CK3 Keyword",
                documentation=f"CK3 scripting keyword: {keyword}",
            )
        )
    return tuple(items)


@dataclass
class CompletionContext:
    """
    Represents the context where completion is triggered.
    
    Attributes:
        block_type: Type of block ('trigger', 'effect', 'immediate', 'option', 'limit', etc.)
        scope_type: Current scope type ('character', 'title', 'province', etc.)
        after_dot: True if completion is triggered after a dot (scope chain)
        after_colon: True if completion is triggered after 'scope:'
        in_assignment: True if cursor is in a key = value assignment
        trigger_character: Character that triggered completion ('_', '.', ':', '=', or None)
        saved_scopes: Set of saved scope names from document
        incomplete_text: Partial text before cursor for filtering
    """
    block_type: str = 'unknown'
    scope_type: str = 'character'  # Default scope
    after_dot: bool = False
    after_colon: bool = False
    in_assignment: bool = False
    trigger_character: Optional[str] = None
    saved_scopes: Set[str] = None
    incomplete_text: str = ''
    
    def __post_init__(self):
        if self.saved_scopes is None:
            self.saved_scopes = set()


def detect_context(
    node: Optional[CK3Node],
    position: types.Position,
    line_text: str,
    document_index: Optional[DocumentIndex] = None
) -> CompletionContext:
    """
    Detect the completion context from AST node and cursor position.
    
    Analyzes the current AST node and its parents to determine what kind of
    completion suggestions are appropriate.
    
    Args:
        node: AST node at cursor position (None if not found)
        position: Cursor position in document
        line_text: Full text of the line where cursor is located
        document_index: Document index with saved scopes (optional)
    
    Returns:
        CompletionContext with detected context information
    """
    context = CompletionContext()
    
    # Extract partial text before cursor for filtering
    if position.character > 0 and position.character <= len(line_text):
        # Get text from start of word to cursor
        before_cursor = line_text[:position.character]
        # Find last word boundary (space, =, {, etc.)
        word_start = max(
            before_cursor.rfind(' '),
            before_cursor.rfind('='),
            before_cursor.rfind('{'),
            before_cursor.rfind('\t')
        ) + 1
        context.incomplete_text = before_cursor[word_start:].strip()
    
    # Check for special trigger characters
    if position.character > 0:
        char_before = line_text[position.character - 1] if position.character <= len(line_text) else ''
        if char_before == '.':
            context.after_dot = True
            context.trigger_character = '.'
        elif position.character >= 6 and line_text[position.character - 6:position.character] == 'scope:':
            context.after_colon = True
            context.trigger_character = ':'
        elif char_before in ['_', '=']:
            context.trigger_character = char_before
    
    # Check if in assignment (key = value)
    if '=' in line_text[:position.character]:
        context.in_assignment = True
    
    # Collect saved scopes from document
    if document_index:
        context.saved_scopes = set(document_index.saved_scopes.keys())
    
    # Walk up AST to find enclosing block and scope
    current = node
    while current:
        # Detect block type
        if current.type == 'block':
            key = current.key.lower() if current.key else ''
            if key in ['trigger', 'limit']:
                context.block_type = 'trigger'
                break
            elif key in ['effect', 'immediate', 'after']:
                context.block_type = 'effect'
                break
            elif key == 'option':
                context.block_type = 'option'  # Can have both triggers and effects
                break
            elif key.startswith('every_') or key.startswith('any_') or key.startswith('random_') or key.startswith('ordered_'):
                # Inside an iterator - next level is limit or effect
                context.block_type = 'iterator'
                # Continue to check if we're in the limit sub-block
            
        # Detect scope type from parent scopes or list iterators
        if current.scope_type and current.scope_type != 'unknown':
            context.scope_type = current.scope_type
        
        current = current.parent
    
    return context


def filter_by_context(context: CompletionContext) -> List[types.CompletionItem]:
    """
    Generate completion items filtered by context.
    
    This is the main filtering logic that decides what completions to show
    based on the detected context.
    
    Args:
        context: Detected completion context
    
    Returns:
        List of completion items appropriate for the context
    """
    items = []
    
    # Handle dot notation (scope chain completion)
    if context.after_dot:
        return get_scope_link_completions(context)
    
    # Handle scope: notation (saved scope completion)
    if context.after_colon:
        return get_saved_scope_completions(context)
    
    # Context-specific completions
    if context.block_type == 'trigger':
        # Inside trigger block: only triggers
        items.extend(create_trigger_completions())
        items.extend(create_keyword_completions(['limit', 'NOT', 'AND', 'OR', 'NAND', 'NOR']))
    
    elif context.block_type == 'effect':
        # Inside effect block: only effects
        items.extend(create_effect_completions())
        items.extend(create_keyword_completions(['limit', 'if', 'else', 'else_if']))
    
    elif context.block_type == 'option':
        # Inside option: both effects and nested triggers
        items.extend(create_effect_completions())
        items.extend(create_trigger_completions())
        items.extend(create_keyword_completions(['trigger', 'trigger_event', 'show_as_tooltip']))
    
    elif context.block_type == 'iterator':
        # Inside iterator: suggest limit block
        items.extend(create_keyword_completions(['limit']))
        items.extend(create_effect_completions())
    
    else:
        # Unknown context: provide all completions (backwards compatibility)
        items.extend(create_all_completions())
    
    # Add scope navigation if appropriate
    if not context.after_dot and not context.after_colon:
        items.extend(create_scope_completions())
    
    # Add snippets for top-level contexts
    if context.block_type == 'unknown':
        items.extend(create_snippet_completions())
    
    return items


def get_scope_link_completions(context: CompletionContext) -> List[types.CompletionItem]:
    """
    Get completion items for scope links after a dot.
    
    When user types "liege." we show valid scope links from character scope.
    
    Args:
        context: Completion context with scope_type
    
    Returns:
        List of completion items for valid scope links
    """
    items = []
    
    # Get valid scope links for current scope type
    scope_link_names = get_scope_links(context.scope_type)
    
    for link_name in scope_link_names:
        # Get the resulting scope type for this link
        target_scope = get_resulting_scope(context.scope_type, link_name)
        
        items.append(
            types.CompletionItem(
                label=link_name,
                kind=types.CompletionItemKind.Property,
                detail=f"Scope Link → {target_scope}",
                documentation=types.MarkupContent(
                    kind=types.MarkupKind.Markdown,
                    value=f"Navigate from **{context.scope_type}** to **{target_scope}** scope.\n\n"
                          f"Example: `{context.scope_type}.{link_name}`"
                ),
            )
        )
    
    # Also add scope lists (for iteration)
    scope_list_names = get_scope_lists(context.scope_type)
    for list_name in scope_list_names:
        # Get the resulting scope for this list
        target_scope = get_resulting_scope(context.scope_type, list_name)
        
        items.append(
            types.CompletionItem(
                label=list_name,
                kind=types.CompletionItemKind.Property,
                detail=f"Scope List → {target_scope}[]",
                documentation=types.MarkupContent(
                    kind=types.MarkupKind.Markdown,
                    value=f"Iterate over list of **{target_scope}** from **{context.scope_type}** scope.\n\n"
                          f"Example: `every_{list_name} = {{ ... }}`"
                ),
            )
        )
    
    return items


def get_saved_scope_completions(context: CompletionContext) -> List[types.CompletionItem]:
    """
    Get completion items for saved scopes after 'scope:'.
    
    When user types "scope:" we show all saved scopes from the document.
    
    Args:
        context: Completion context with saved_scopes set
    
    Returns:
        List of completion items for saved scopes
    """
    items = []
    
    for scope_name in sorted(context.saved_scopes):
        items.append(
            types.CompletionItem(
                label=scope_name,
                kind=types.CompletionItemKind.Variable,
                detail="Saved Scope",
                documentation=types.MarkupContent(
                    kind=types.MarkupKind.Markdown,
                    value=f"Reference to saved scope **{scope_name}**.\n\n"
                          f"Must be saved earlier with `save_scope_as = {scope_name}`"
                ),
            )
        )
    
    # If no saved scopes, provide a hint
    if not items:
        items.append(
            types.CompletionItem(
                label="<no saved scopes>",
                kind=types.CompletionItemKind.Text,
                detail="Use save_scope_as to create saved scopes",
                documentation="No saved scopes found in this document. "
                             "Use save_scope_as = scope_name to save the current scope.",
            )
        )
    
    return items


def create_trigger_completions() -> List[types.CompletionItem]:
    """Create completion items for all CK3 triggers (uses cached data)."""
    return list(_cached_trigger_completions())


def create_effect_completions() -> List[types.CompletionItem]:
    """Create completion items for all CK3 effects (uses cached data)."""
    return list(_cached_effect_completions())


def create_keyword_completions(keywords: Optional[List[str]] = None) -> List[types.CompletionItem]:
    """Create completion items for CK3 keywords (uses cached data for common cases)."""
    if keywords is None:
        return list(_cached_all_keyword_completions())
    # Convert to tuple for hashable cache key
    return list(_cached_keyword_completions(tuple(keywords)))


def create_scope_completions() -> List[types.CompletionItem]:
    """Create completion items for CK3 scope switches (uses cached data)."""
    return list(_cached_scope_completions())


def create_all_completions() -> List[types.CompletionItem]:
    """Create all completion items (fallback for unknown context)."""
    items = []
    items.extend(create_keyword_completions())
    items.extend(create_effect_completions())
    items.extend(create_trigger_completions())
    items.extend(create_scope_completions())
    
    # Add event types
    for event_type in CK3_EVENT_TYPES:
        items.append(
            types.CompletionItem(
                label=event_type,
                kind=types.CompletionItemKind.Class,
                detail="CK3 Event Type",
                documentation=f"CK3 event type: {event_type}",
            )
        )
    
    # Add boolean values
    for bool_val in CK3_BOOLEAN_VALUES:
        items.append(
            types.CompletionItem(
                label=bool_val,
                kind=types.CompletionItemKind.Constant,
                detail="Boolean Value",
                documentation=f"Boolean value: {bool_val}",
            )
        )
    
    return items


def create_snippet_completions() -> List[types.CompletionItem]:
    """
    Create snippet completions for common CK3 patterns.
    
    Snippets are templates with placeholders that the user can tab through.
    Uses LSP's InsertTextFormat.Snippet format.
    """
    snippets = []
    
    # Event template
    snippets.append(
        types.CompletionItem(
            label="event",
            kind=types.CompletionItemKind.Snippet,
            detail="Event template",
            documentation="Create a new character event",
            insert_text="""${1:namespace}.${2:0001} = {
\ttype = character_event
\ttitle = ${3:event_title}
\tdesc = ${4:event_desc}
\ttheme = ${5:default}
\t
\ttrigger = {
\t\t${6:# Trigger conditions}
\t}
\t
\timmediate = {
\t\t${7:# Immediate effects}
\t}
\t
\toption = {
\t\tname = ${8:option_name}
\t\t${9:# Option effects}
\t}
}""",
            insert_text_format=types.InsertTextFormat.Snippet,
        )
    )
    
    # Trigger event snippet
    snippets.append(
        types.CompletionItem(
            label="trigger_event",
            kind=types.CompletionItemKind.Snippet,
            detail="Trigger event snippet",
            documentation="Trigger an event on a character",
            insert_text="trigger_event = {\n\tid = ${1:event_id}\n\tdays = ${2:0}\n}",
            insert_text_format=types.InsertTextFormat.Snippet,
        )
    )
    
    # Option snippet
    snippets.append(
        types.CompletionItem(
            label="option",
            kind=types.CompletionItemKind.Snippet,
            detail="Event option",
            documentation="Add an option to an event",
            insert_text="""option = {
\tname = ${1:option_name}
\t${2:# Option effects}
}""",
            insert_text_format=types.InsertTextFormat.Snippet,
        )
    )
    
    # Save scope snippet
    snippets.append(
        types.CompletionItem(
            label="save_scope_as",
            kind=types.CompletionItemKind.Snippet,
            detail="Save current scope",
            documentation="Save the current scope for later reference",
            insert_text="save_scope_as = ${1:scope_name}",
            insert_text_format=types.InsertTextFormat.Snippet,
        )
    )
    
    # Triggered description snippet
    snippets.append(
        types.CompletionItem(
            label="triggered_desc",
            kind=types.CompletionItemKind.Snippet,
            detail="Triggered description",
            documentation="Dynamic description based on conditions",
            insert_text="""triggered_desc = {
\ttrigger = {
\t\t${1:# Conditions}
\t}
\tdesc = ${2:description_key}
}""",
            insert_text_format=types.InsertTextFormat.Snippet,
        )
    )
    
    return snippets


def get_context_aware_completions(
    document_uri: str,
    position: types.Position,
    ast: Optional[CK3Node],
    line_text: str,
    document_index: Optional[DocumentIndex] = None,
) -> types.CompletionList:
    """
    Main entry point for context-aware completions.
    
    This function is called by the LSP server's completion handler. It:
    1. Detects the context from AST and cursor position
    2. Filters completions based on context
    3. Returns a CompletionList for the client
    
    Args:
        document_uri: URI of the document
        position: Cursor position in the document
        ast: Parsed AST of the document (may be None)
        line_text: Full text of the line at cursor position
        document_index: Document index with saved scopes
    
    Returns:
        CompletionList with context-aware completion items
    """
    # Find node at cursor position
    node = None
    if ast:
        # Implementation note: get_node_at_position should be called here
        # For now, we pass the root node
        node = ast
    
    # Detect context
    context = detect_context(node, position, line_text, document_index)
    
    # Get filtered completions
    items = filter_by_context(context)
    
    # Return completion list
    return types.CompletionList(
        is_incomplete=False,  # We return all relevant items
        items=items,
    )
