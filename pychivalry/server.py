"""
Crusader Kings 3 Language Server

A Language Server Protocol (LSP) implementation for CK3 scripting language using pygls.

This module implements the core language server that provides IDE-like features for
Crusader Kings 3 modding. It uses the Language Server Protocol (LSP) to communicate
with text editors and IDEs, providing features such as:

- Text document synchronization: Tracking when documents are opened, changed, or closed
- Auto-completion: Suggesting CK3 keywords, effects, triggers, scopes, and event types
- Real-time feedback: Immediate response to user actions in the editor

The server is built on pygls (Python Generic Language Server), which handles the
low-level LSP protocol details, allowing this code to focus on CK3-specific features.

Architecture:
    The server uses a decorator-based approach where functions are registered as
    handlers for specific LSP events using @server.feature decorators. When an
    editor sends a request (like TEXT_DOCUMENT_COMPLETION), the corresponding
    handler function is called automatically.

Communication:
    The server communicates via JSON-RPC over stdin/stdout. The editor sends
    requests and notifications, and the server responds with results or sends
    its own notifications to the editor.

Usage:
    Run directly:
        python -m pychivalry.server

    After pip installation:
        pychivalry

    The server will start and wait for LSP messages from an editor.

For LSP specification: https://microsoft.github.io/language-server-protocol/
For pygls documentation: https://pygls.readthedocs.io/
"""

import logging
from typing import Dict, List, Optional

# Import the LanguageServer class from pygls
# This is the core class that handles LSP protocol communication
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument

# Import LSP types from lsprotocol
# These define the structure of LSP messages (requests, responses, notifications)
from lsprotocol import types

# Import CK3 language definitions
# These lists contain all the CK3 scripting constructs we provide completions for:
# - CK3_KEYWORDS: Control flow and structural keywords
# - CK3_EFFECTS: Commands that modify game state
# - CK3_TRIGGERS: Conditional checks
# - CK3_SCOPES: Context switches for accessing game objects
# - CK3_EVENT_TYPES: Different event presentation styles
# - CK3_BOOLEAN_VALUES: Boolean true/false values
from .ck3_language import (
    CK3_KEYWORDS,
    CK3_EFFECTS,
    CK3_TRIGGERS,
    CK3_SCOPES,
    CK3_EVENT_TYPES,
    CK3_BOOLEAN_VALUES,
)

# Import parser and indexer
from .parser import parse_document, CK3Node
from .indexer import DocumentIndex

# Import diagnostics
from .diagnostics import collect_all_diagnostics

# Import hover
from .hover import create_hover_response

# Logger will be configured in main() after parsing arguments
logger = logging.getLogger(__name__)


def configure_logging(level: str = "info") -> None:
    """
    Configure logging for the language server.
    
    Args:
        level: Log level string (debug, info, warning, error)
    """
    level_map = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
    }
    log_level = level_map.get(level.lower(), logging.INFO)
    
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


class CK3LanguageServer(LanguageServer):
    """
    Extended language server with CK3-specific state.
    
    This class extends the base LanguageServer to add:
    - Document AST tracking (updated on open/change)
    - Cross-document symbol indexing
    - Parser integration with document lifecycle
    - Workspace scanning for scripted effects/triggers
    """
    
    def __init__(self, *args, **kwargs):
        """Initialize the CK3 language server."""
        super().__init__(*args, **kwargs)
        # Document ASTs (updated on open/change)
        self.document_asts: Dict[str, List[CK3Node]] = {}
        # Cross-document index for navigation
        self.index = DocumentIndex()
        # Track whether workspace has been scanned
        self._workspace_scanned = False
    
    def _scan_workspace_folders(self):
        """
        Scan all workspace folders for scripted effects and triggers.
        
        This is called on first document open to index all custom effects
        and triggers in the mod's common/ folder.
        """
        if self._workspace_scanned:
            return
        
        try:
            # Get workspace folders
            workspace_folders = []
            if self.workspace.folders:
                for folder in self.workspace.folders:
                    # Convert URI to path
                    folder_uri = folder.uri if hasattr(folder, 'uri') else folder
                    if folder_uri.startswith('file:///'):
                        # Convert file URI to path
                        from urllib.parse import unquote
                        path = unquote(folder_uri[8:])  # Remove 'file:///'
                        # On Windows, handle drive letter
                        if len(path) > 2 and path[0] == '/' and path[2] == ':':
                            path = path[1:]  # Remove leading slash
                        workspace_folders.append(path)
                    else:
                        workspace_folders.append(folder_uri)
            
            if workspace_folders:
                logger.info(f"Scanning {len(workspace_folders)} workspace folder(s) for scripted effects/triggers")
                self.index.scan_workspace(workspace_folders)
            else:
                logger.warning("No workspace folders found for scanning")
            
            self._workspace_scanned = True
            
        except Exception as e:
            logger.error(f"Error scanning workspace folders: {e}", exc_info=True)
            self._workspace_scanned = True  # Don't retry on error
    
    def parse_and_index_document(self, doc: TextDocument):
        """
        Parse a document and update the index.
        
        This is called whenever a document is opened or changed.
        
        Args:
            doc: The text document to parse
            
        Returns:
            The parsed AST
        """
        try:
            ast = parse_document(doc.source)
            self.document_asts[doc.uri] = ast
            self.index.update_from_ast(doc.uri, ast)
            logger.debug(f"Parsed and indexed document: {doc.uri}")
            return ast
        except Exception as e:
            logger.error(f"Error parsing document {doc.uri}: {e}")
            # Return empty AST on parse error
            return []
    
    def publish_diagnostics_for_document(self, doc: TextDocument):
        """
        Validate document and publish diagnostics to the client.
        
        This collects all validation errors and warnings for the document
        and sends them to the client via LSP's PublishDiagnostics notification.
        
        Args:
            doc: The text document to validate
        """
        try:
            ast = self.document_asts.get(doc.uri, [])
            diagnostics = collect_all_diagnostics(doc, ast, self.index)
            
            # Publish diagnostics to client
            self.text_document_publish_diagnostics(
                types.PublishDiagnosticsParams(
                    uri=doc.uri,
                    diagnostics=diagnostics,
                )
            )
            logger.debug(f"Published {len(diagnostics)} diagnostics for {doc.uri}")
        except Exception as e:
            logger.error(f"Error publishing diagnostics for {doc.uri}: {e}", exc_info=True)


# Create the CK3 language server instance
# This is the main server object that will handle all LSP communication
# Parameters:
#   - name: Identifier for this language server
#   - version: Server version (should match package version)
server = CK3LanguageServer("ck3-language-server", "v0.1.0")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: CK3LanguageServer, params: types.DidOpenTextDocumentParams):
    """
    Handle document open event

    This handler is called when a user opens a CK3 script file in their editor.
    It parses the document, updates the index, and publishes diagnostics.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the opened document:
            - text_document.uri: The file URI (file path)
            - text_document.text: The full document content
            - text_document.language_id: The language identifier (e.g., "ck3")
            - text_document.version: Document version number

    LSP Specification:
        This is a notification from client to server, no response is expected.
    """
    logger.info(f"Document opened: {params.text_document.uri}")
    
    # On first document open, scan workspace if not already done
    if not ls._workspace_scanned:
        ls._scan_workspace_folders()
    
    # Parse the document and update the index
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_and_index_document(doc)
    
    # Publish diagnostics for immediate feedback
    ls.publish_diagnostics_for_document(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: CK3LanguageServer, params: types.DidChangeTextDocumentParams):
    """
    Handle document change event

    This handler is called whenever the user makes changes to a CK3 script file.
    It re-parses the document, updates the index, and publishes updated diagnostics.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the document changes:
            - text_document.uri: The file URI being modified
            - text_document.version: New document version number
            - content_changes: List of changes (incremental or full document)

    LSP Specification:
        This is a notification from client to server. The server should update
        its internal representation of the document but no response is required.

    Performance Note:
        This can be called very frequently during typing. The parser is designed
        to be fast, but for very large files, consider debouncing.
    """
    logger.debug(f"Document changed: {params.text_document.uri}")
    
    # Re-parse the document and update the index
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_and_index_document(doc)
    
    # Publish updated diagnostics
    ls.publish_diagnostics_for_document(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: CK3LanguageServer, params: types.DidCloseTextDocumentParams):
    """
    Handle document close event

    This handler is called when a user closes a CK3 script file in their editor.
    It cleans up document-specific resources, removes entries from the index,
    and clears diagnostics.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the closed document:
            - text_document.uri: The file URI being closed

    LSP Specification:
        This is a notification from client to server. After this, the server
        should no longer track this document until it's opened again.
        No response is expected.

    Note:
        The server should not send diagnostics or other information about
        this document after it's closed.
    """
    logger.info(f"Document closed: {params.text_document.uri}")
    
    # Remove the document from our tracking
    uri = params.text_document.uri
    ls.document_asts.pop(uri, None)
    ls.index.remove_document(uri)
    
    # Clear diagnostics for this document
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=uri,
            diagnostics=[],  # Empty list clears all diagnostics
        )
    )


@server.feature(
    types.TEXT_DOCUMENT_COMPLETION,
    types.CompletionOptions(trigger_characters=["_", "."]),
)
def completions(params: types.CompletionParams):
    """
    Provide completion suggestions for CK3 scripting.

    This is the core feature that provides auto-completion (IntelliSense) when users
    type in CK3 script files. It suggests relevant CK3 keywords, effects, triggers,
    scopes, event types, and boolean values based on what the user is typing.

    Current Implementation:
        Returns all CK3 language constructs as completion items. The editor will
        filter these based on what the user has typed. This is a simple but effective
        approach that provides comprehensive suggestions.

    Future Enhancements:
        - Context-aware completions (only show effects in effect blocks, etc.)
        - Smart filtering based on cursor position and surrounding code
        - Snippet completions for common patterns (event templates, etc.)
        - Documentation and examples for each completion item

    Args:
        params: Contains information about the completion request:
            - text_document.uri: The file where completion was triggered
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)
            - context.trigger_kind: How completion was triggered:
                - Invoked (1): User explicitly requested (Ctrl+Space)
                - TriggerCharacter (2): Typed a trigger character (_, .)
                - TriggerForIncompleteCompletions (3): Filtering previous results

    Returns:
        CompletionList: Contains:
            - is_incomplete: False (we return all items, no pagination needed)
            - items: List of CompletionItem objects with:
                - label: What the user sees in the completion menu
                - kind: Icon/category (Keyword, Function, Variable, etc.)
                - detail: Short description shown in the menu
                - documentation: Detailed help text (shown in detail panel)

    LSP Specification:
        This is a request from client to server. The server must respond with
        a CompletionList or CompletionItem[].

    Trigger Characters:
        The completion is automatically triggered when the user types _ or .
        This is useful for CK3 identifiers like "add_trait" or "every_vassal".
    """
    # Initialize list to collect all completion items
    items = []

    # Add CK3 keywords as completions
    # These are structural elements like 'if', 'trigger', 'effect', etc.
    # Shown as keywords (blue color in most editors)
    for keyword in CK3_KEYWORDS:
        items.append(
            types.CompletionItem(
                label=keyword,
                kind=types.CompletionItemKind.Keyword,
                detail="CK3 Keyword",
                documentation=f"CK3 scripting keyword: {keyword}",
            )
        )

    # Add CK3 effects as completions
    # These are commands that modify the game state (add_trait, add_gold, etc.)
    # Shown as functions (purple/magenta color in most editors)
    for effect in CK3_EFFECTS:
        items.append(
            types.CompletionItem(
                label=effect,
                kind=types.CompletionItemKind.Function,
                detail="CK3 Effect",
                documentation=f"CK3 effect that modifies game state: {effect}",
            )
        )

    # Add CK3 triggers as completions
    # These are conditional checks (age, has_trait, is_ruler, etc.)
    # Shown as functions (purple/magenta color in most editors)
    for trigger in CK3_TRIGGERS:
        items.append(
            types.CompletionItem(
                label=trigger,
                kind=types.CompletionItemKind.Function,
                detail="CK3 Trigger",
                documentation=f"CK3 trigger/condition: {trigger}",
            )
        )

    # Add CK3 scopes as completions
    # These are context switches (root, every_vassal, father, etc.)
    # Shown as variables (light blue color in most editors)
    for scope in CK3_SCOPES:
        items.append(
            types.CompletionItem(
                label=scope,
                kind=types.CompletionItemKind.Variable,
                detail="CK3 Scope",
                documentation=f"CK3 scope: {scope}",
            )
        )

    # Add CK3 event types as completions
    # These define the presentation style of events (character_event, letter_event, etc.)
    # Shown as classes (teal color in most editors)
    for event_type in CK3_EVENT_TYPES:
        items.append(
            types.CompletionItem(
                label=event_type,
                kind=types.CompletionItemKind.Class,
                detail="CK3 Event Type",
                documentation=f"CK3 event type: {event_type}",
            )
        )

    # Add boolean values as completions
    # These are yes/no/true/false values used throughout CK3 scripts
    # Shown as values (orange color in most editors)
    for bool_val in CK3_BOOLEAN_VALUES:
        items.append(
            types.CompletionItem(
                label=bool_val,
                kind=types.CompletionItemKind.Value,
                detail="Boolean Value",
                documentation=f"Boolean value: {bool_val}",
            )
        )

    # Return the complete list wrapped in a CompletionList
    # is_incomplete=False means we've returned all available completions
    # (no pagination needed, the editor can filter locally)
    return types.CompletionList(
        is_incomplete=False,
        items=items,
    )


@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(ls: CK3LanguageServer, params: types.HoverParams):
    """
    Provide hover documentation for CK3 constructs.
    
    This feature shows helpful information when users hover over CK3 keywords,
    effects, triggers, scopes, events, and other constructs. The documentation
    includes usage examples, parameter information, and cross-references.
    
    Args:
        ls: The CK3 language server instance
        params: Contains information about the hover request:
            - text_document.uri: The file where hover was triggered
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)
    
    Returns:
        Hover: Contains:
            - contents: Markdown-formatted documentation
            - range: Optional range that the hover applies to
        or None if no hover information available
    
    LSP Specification:
        This is a request from client to server. The server should respond with
        a Hover object containing documentation, or null if no information is available.
    
    Features:
        - Effect documentation with usage examples
        - Trigger documentation with return types
        - Scope navigation information
        - Event definitions with file locations
        - Saved scope references with definition locations
        - List iterator explanations
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)
        ast = ls.document_asts.get(doc.uri, [])
        
        return create_hover_response(doc, params.position, ast, ls.index)
    except Exception as e:
        logger.error(f"Error in hover handler: {e}", exc_info=True)
        return None


@server.feature(types.TEXT_DOCUMENT_DEFINITION)
def definition(ls: CK3LanguageServer, params: types.DefinitionParams):
    """
    Provide Go-to-Definition for CK3 constructs.
    
    This feature allows users to Ctrl+Click (or F12) on symbols to navigate
    to their definitions. Supports:
    - Localization keys -> Jump to .yml file definition
    - Event IDs -> Jump to event definition
    - Custom scripted effects -> Jump to effect definition
    - Custom scripted triggers -> Jump to trigger definition
    - Saved scopes -> Jump to save_scope_as location
    
    Args:
        ls: The CK3 language server instance
        params: Contains information about the definition request:
            - text_document.uri: The file where definition was requested
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)
    
    Returns:
        Location or list of Locations for the definition(s), or None if not found
    
    LSP Specification:
        This is a request from client to server. The server should respond with
        a Location, Location[], LocationLink[], or null.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)
        
        # Get word at cursor position
        from .hover import get_word_at_position
        word = get_word_at_position(doc, params.position)
        
        if not word:
            return None
        
        logger.debug(f"Go-to-definition for: {word}")
        
        # Check if it's a localization key (contains dots)
        if '.' in word and ls.index:
            loc_info = ls.index.find_localization(word)
            if loc_info:
                text, file_uri, line_num = loc_info
                return types.Location(
                    uri=file_uri,
                    range=types.Range(
                        start=types.Position(line=line_num, character=0),
                        end=types.Position(line=line_num, character=len(word)),
                    )
                )
        
        # Check if it's an event ID (format: namespace.number like rq_nts_daughter.0001)
        if '.' in word and ls.index:
            event_loc = ls.index.find_event(word)
            if event_loc:
                return event_loc
        
        # Check if it's a custom scripted effect
        if ls.index:
            effect_loc = ls.index.find_scripted_effect(word)
            if effect_loc:
                return effect_loc
        
        # Check if it's a custom scripted trigger
        if ls.index:
            trigger_loc = ls.index.find_scripted_trigger(word)
            if trigger_loc:
                return trigger_loc
        
        # Check if it's a saved scope reference (scope:xxx)
        if word.startswith('scope:') and ls.index:
            scope_name = word[6:]
            scope_loc = ls.index.find_saved_scope(scope_name)
            if scope_loc:
                return scope_loc
        
        # Check if it's a character flag
        if ls.index:
            flag_loc = ls.index.find_character_flag(word)
            if flag_loc:
                return flag_loc
        
        # Check if it's a character interaction
        if ls.index:
            interaction_loc = ls.index.find_character_interaction(word)
            if interaction_loc:
                return interaction_loc
        
        # Check if it's a modifier
        if ls.index:
            modifier_loc = ls.index.find_modifier(word)
            if modifier_loc:
                return modifier_loc
        
        # Check if it's an on_action
        if ls.index:
            on_action_loc = ls.index.find_on_action(word)
            if on_action_loc:
                return on_action_loc
        
        # Check if it's an opinion modifier
        if ls.index:
            opinion_loc = ls.index.find_opinion_modifier(word)
            if opinion_loc:
                return opinion_loc
        
        # Check if it's a scripted GUI
        if ls.index:
            gui_loc = ls.index.find_scripted_gui(word)
            if gui_loc:
                return gui_loc
        
        return None
        
    except Exception as e:
        logger.error(f"Error in definition handler: {e}", exc_info=True)
        return None


@server.feature(types.TEXT_DOCUMENT_REFERENCES)
def references(ls: CK3LanguageServer, params: types.ReferenceParams):
    """
    Find all references to a symbol across the workspace.
    
    This feature allows users to find all places where a symbol (event, effect,
    trigger, saved scope, etc.) is referenced. This is useful for understanding
    how events are connected, where effects are used, and for refactoring.
    
    Args:
        ls: The CK3 language server instance
        params: Contains information about the references request:
            - text_document.uri: The file where references was requested
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)
            - context.include_declaration: Whether to include the declaration
    
    Returns:
        List of Location objects where the symbol is referenced, or None if not found
    
    LSP Specification:
        This is a request from client to server. The server should respond with
        a Location[], or null if no references found.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)
        
        # Get word at cursor position
        from .hover import get_word_at_position
        word = get_word_at_position(doc, params.position)
        
        if not word:
            return None
        
        logger.debug(f"Find references for: {word}")
        
        references_list = []
        
        # Search through all open documents for references
        for uri in ls.document_asts.keys():
            try:
                ref_doc = ls.workspace.get_text_document(uri)
                ast = ls.document_asts.get(uri, [])
                
                # Find all occurrences of the word in this document
                refs = _find_word_references_in_ast(word, ast, uri)
                references_list.extend(refs)
            except Exception as e:
                logger.warning(f"Error searching {uri}: {e}")
                continue
        
        # If include_declaration is False, filter out the definition itself
        if not params.context.include_declaration:
            # Try to find the definition location
            def_location = None
            
            # Check various symbol types
            if '.' in word and ls.index:
                def_location = ls.index.find_event(word)
            if not def_location and ls.index:
                def_location = ls.index.find_scripted_effect(word)
            if not def_location and ls.index:
                def_location = ls.index.find_scripted_trigger(word)
            if not def_location and word.startswith('scope:') and ls.index:
                scope_name = word[6:]
                def_location = ls.index.find_saved_scope(scope_name)
            
            # Filter out the definition
            if def_location:
                references_list = [
                    ref for ref in references_list
                    if ref.uri != def_location.uri or
                       ref.range.start.line != def_location.range.start.line
                ]
        
        return references_list if references_list else None
        
    except Exception as e:
        logger.error(f"Error in references handler: {e}", exc_info=True)
        return None


def _find_word_references_in_ast(word: str, ast: List[CK3Node], uri: str) -> List[types.Location]:
    """
    Find all occurrences of a word in an AST.
    
    Args:
        word: The word to search for
        ast: The AST to search
        uri: The document URI
    
    Returns:
        List of Location objects where the word appears
    """
    locations = []
    
    def search_node(node: CK3Node):
        # Check if the node key matches
        if node.key == word or (isinstance(node.value, str) and node.value == word):
            locations.append(
                types.Location(
                    uri=uri,
                    range=node.range
                )
            )
        
        # Search children recursively
        for child in node.children:
            search_node(child)
    
    for node in ast:
        search_node(node)
    
    return locations


@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(ls: CK3LanguageServer, params: types.DocumentSymbolParams):
    """
    Provide document symbols for outline view.
    
    This feature provides a hierarchical view of the document structure, showing
    events, scripted effects, scripted triggers, and their components. This appears
    as an outline in the editor's sidebar.
    
    Args:
        ls: The CK3 language server instance
        params: Contains information about the symbol request:
            - text_document.uri: The file to get symbols for
    
    Returns:
        List of DocumentSymbol objects representing the document structure
    
    LSP Specification:
        This is a request from client to server. The server should respond with
        DocumentSymbol[] or SymbolInformation[], or null.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)
        ast = ls.document_asts.get(doc.uri, [])
        
        if not ast:
            return None
        
        symbols = []
        
        # Extract symbols from AST
        for node in ast:
            symbol = _extract_symbol_from_node(node)
            if symbol:
                symbols.append(symbol)
        
        return symbols if symbols else None
        
    except Exception as e:
        logger.error(f"Error in document_symbol handler: {e}", exc_info=True)
        return None


def _extract_symbol_from_node(node: CK3Node) -> Optional[types.DocumentSymbol]:
    """
    Extract a DocumentSymbol from a CK3Node.
    
    Args:
        node: The CK3Node to extract symbol from
    
    Returns:
        DocumentSymbol or None
    """
    # Determine symbol kind based on node type
    if node.type == 'namespace':
        kind = types.SymbolKind.Namespace
        detail = "Namespace"
    elif node.type == 'event':
        kind = types.SymbolKind.Event
        detail = "Event"
    elif node.key in ('trigger', 'immediate', 'after', 'effect'):
        kind = types.SymbolKind.Object
        detail = node.key.capitalize()
    elif node.key == 'option':
        kind = types.SymbolKind.EnumMember
        # Try to find the option name
        name_value = None
        for child in node.children:
            if child.key == 'name':
                name_value = child.value
                break
        detail = f"Option: {name_value}" if name_value else "Option"
    elif node.type == 'block' and ('_effect' in node.key or '_trigger' in node.key):
        kind = types.SymbolKind.Function
        detail = "Scripted Effect" if '_effect' in node.key else "Scripted Trigger"
    else:
        # Default for other blocks
        kind = types.SymbolKind.Object
        detail = None
    
    # Extract children symbols
    children = []
    for child in node.children:
        child_symbol = _extract_symbol_from_node(child)
        if child_symbol:
            children.append(child_symbol)
    
    # Create selection range (just the key name)
    selection_range = types.Range(
        start=node.range.start,
        end=types.Position(
            line=node.range.start.line,
            character=node.range.start.character + len(node.key)
        )
    )
    
    return types.DocumentSymbol(
        name=node.key,
        kind=kind,
        range=node.range,
        selection_range=selection_range,
        detail=detail,
        children=children if children else None
    )


@server.feature(types.WORKSPACE_SYMBOL)
def workspace_symbol(ls: CK3LanguageServer, params: types.WorkspaceSymbolParams):
    """
    Search for symbols across the entire workspace.
    
    This feature allows users to quickly find and navigate to any symbol in the
    workspace by name. It supports fuzzy matching and is typically invoked with
    Ctrl+T in VS Code.
    
    Args:
        ls: The CK3 language server instance
        params: Contains information about the symbol search:
            - query: The search query string
    
    Returns:
        List of SymbolInformation objects matching the query
    
    LSP Specification:
        This is a request from client to server. The server should respond with
        SymbolInformation[] or WorkspaceSymbol[], or null.
    """
    try:
        query = params.query.lower()
        
        if not query:
            return None
        
        symbols = []
        
        # Search events
        if ls.index:
            for event_id, location in ls.index.events.items():
                if query in event_id.lower():
                    symbols.append(
                        types.SymbolInformation(
                            name=event_id,
                            kind=types.SymbolKind.Event,
                            location=location,
                            container_name="Event"
                        )
                    )
        
        # Search scripted effects
        if ls.index:
            for effect_name, location in ls.index.scripted_effects.items():
                if query in effect_name.lower():
                    symbols.append(
                        types.SymbolInformation(
                            name=effect_name,
                            kind=types.SymbolKind.Function,
                            location=location,
                            container_name="Scripted Effect"
                        )
                    )
        
        # Search scripted triggers
        if ls.index:
            for trigger_name, location in ls.index.scripted_triggers.items():
                if query in trigger_name.lower():
                    symbols.append(
                        types.SymbolInformation(
                            name=trigger_name,
                            kind=types.SymbolKind.Function,
                            location=location,
                            container_name="Scripted Trigger"
                        )
                    )
        
        # Search script values
        if ls.index:
            for value_name, location in ls.index.script_values.items():
                if query in value_name.lower():
                    symbols.append(
                        types.SymbolInformation(
                            name=value_name,
                            kind=types.SymbolKind.Variable,
                            location=location,
                            container_name="Script Value"
                        )
                    )
        
        # Search on_actions
        if ls.index:
            for on_action_name, location in ls.index.on_action_definitions.items():
                if query in on_action_name.lower():
                    symbols.append(
                        types.SymbolInformation(
                            name=on_action_name,
                            kind=types.SymbolKind.Event,
                            location=location,
                            container_name="On-Action"
                        )
                    )
        
        return symbols if symbols else None
        
    except Exception as e:
        logger.error(f"Error in workspace_symbol handler: {e}", exc_info=True)
        return None


def main():
    """
    Main entry point for the language server

    This function starts the language server and begins listening for LSP messages
    from an editor/IDE over stdin/stdout.

    How it works:
        1. The server is configured with feature handlers (did_open, completions, etc.)
        2. start_io() begins reading JSON-RPC messages from stdin
        3. The server processes requests and sends responses to stdout
        4. This continues until the editor sends a shutdown request or stdin closes

    Communication Protocol:
        The server uses JSON-RPC 2.0 over stdin/stdout:
        - Editor sends requests/notifications to stdin
        - Server sends responses/notifications to stdout
        - stderr is used for logging (doesn't interfere with LSP communication)

    Process Lifecycle:
        The editor typically:
        1. Starts the server process
        2. Sends 'initialize' request with client capabilities
        3. Sends 'initialized' notification when ready
        4. Exchanges messages (document events, completion requests, etc.)
        5. Sends 'shutdown' request to begin graceful shutdown
        6. Sends 'exit' notification to terminate the process

    Usage:
        python -m pychivalry.server
        python -m pychivalry.server --log-level debug

    The server will log "Starting Crusader Kings 3 Language Server..." and then wait for
    LSP messages. You should see "Starting IO server" when it begins listening.
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Crusader Kings 3 Language Server")
    parser.add_argument(
        "--log-level",
        choices=["debug", "info", "warning", "error"],
        default="info",
        help="Set the logging level (default: info)"
    )
    args = parser.parse_args()
    
    # Configure logging with the specified level
    configure_logging(args.log_level)
    
    logger.info("Starting Crusader Kings 3 Language Server...")
    # Start the language server in IO mode (stdin/stdout communication)
    # This is a blocking call that runs until the server is shut down
    server.start_io()


# Standard Python idiom: run main() only when this file is executed directly
# This allows the module to be imported without running the server
if __name__ == "__main__":
    main()
