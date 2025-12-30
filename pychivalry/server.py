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
from typing import Dict, List

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

# Configure logging for debugging and monitoring
# Logs help track server activity and diagnose issues
# Output goes to stderr to avoid interfering with LSP communication on stdout
logging.basicConfig(
    level=logging.INFO,  # INFO level shows important events (change to DEBUG for verbose logging)
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class CK3LanguageServer(LanguageServer):
    """
    Extended language server with CK3-specific state.
    
    This class extends the base LanguageServer to add:
    - Document AST tracking (updated on open/change)
    - Cross-document symbol indexing
    - Parser integration with document lifecycle
    """
    
    def __init__(self, *args, **kwargs):
        """Initialize the CK3 language server."""
        super().__init__(*args, **kwargs)
        # Document ASTs (updated on open/change)
        self.document_asts: Dict[str, List[CK3Node]] = {}
        # Cross-document index for navigation
        self.index = DocumentIndex()
    
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
    
    # Parse the document and update the index
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_and_index_document(doc)
    
    # Publish diagnostics for immediate feedback
    ls.publish_diagnostics_for_document(doc)
    
    # Show a message in the editor to confirm the server is working
    # MessageType.Info = informational popup/notification
    ls.show_message("CK3 Language Server is active!", types.MessageType.Info)


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

    The server will log "Starting CK3 Language Server..." and then wait for
    LSP messages. You should see "Starting IO server" when it begins listening.
    """
    logger.info("Starting CK3 Language Server...")
    # Start the language server in IO mode (stdin/stdout communication)
    # This is a blocking call that runs until the server is shut down
    server.start_io()


# Standard Python idiom: run main() only when this file is executed directly
# This allows the module to be imported without running the server
if __name__ == "__main__":
    main()
