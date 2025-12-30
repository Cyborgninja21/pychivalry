"""
Crusader Kings 3 Language Server

A Language Server Protocol implementation for CK3 scripting language using pygls.
This server provides language features like autocomplete, diagnostics, hover information,
and more for CK3 mod development.
"""

import logging

from pygls.lsp.server import LanguageServer
from lsprotocol import types

from .ck3_language import (
    CK3_KEYWORDS,
    CK3_EFFECTS,
    CK3_TRIGGERS,
    CK3_SCOPES,
    CK3_EVENT_TYPES,
    CK3_BOOLEAN_VALUES,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create the language server instance
server = LanguageServer("ck3-language-server", "v0.1.0")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: LanguageServer, params: types.DidOpenTextDocumentParams):
    """Handle document open event"""
    logger.info(f"Document opened: {params.text_document.uri}")
    ls.show_message("CK3 Language Server is active!", types.MessageType.Info)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: LanguageServer, params: types.DidChangeTextDocumentParams):
    """Handle document change event"""
    logger.debug(f"Document changed: {params.text_document.uri}")


@server.feature(types.TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: LanguageServer, params: types.DidCloseTextDocumentParams):
    """Handle document close event"""
    logger.info(f"Document closed: {params.text_document.uri}")


@server.feature(
    types.TEXT_DOCUMENT_COMPLETION,
    types.CompletionOptions(trigger_characters=["_", "."]),
)
def completions(params: types.CompletionParams):
    """
    Provide completion suggestions for CK3 scripting.

    Returns completion items based on the current context:
    - Keywords (if, else, trigger, effect, etc.)
    - Effects (add_trait, add_gold, etc.)
    - Triggers (age, has_trait, etc.)
    - Scopes (root, prev, every_vassal, etc.)
    - Event types and boolean values
    """
    items = []

    # Add keywords
    for keyword in CK3_KEYWORDS:
        items.append(
            types.CompletionItem(
                label=keyword,
                kind=types.CompletionItemKind.Keyword,
                detail="CK3 Keyword",
                documentation=f"CK3 scripting keyword: {keyword}",
            )
        )

    # Add effects
    for effect in CK3_EFFECTS:
        items.append(
            types.CompletionItem(
                label=effect,
                kind=types.CompletionItemKind.Function,
                detail="CK3 Effect",
                documentation=f"CK3 effect that modifies game state: {effect}",
            )
        )

    # Add triggers
    for trigger in CK3_TRIGGERS:
        items.append(
            types.CompletionItem(
                label=trigger,
                kind=types.CompletionItemKind.Function,
                detail="CK3 Trigger",
                documentation=f"CK3 trigger/condition: {trigger}",
            )
        )

    # Add scopes
    for scope in CK3_SCOPES:
        items.append(
            types.CompletionItem(
                label=scope,
                kind=types.CompletionItemKind.Variable,
                detail="CK3 Scope",
                documentation=f"CK3 scope: {scope}",
            )
        )

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
                kind=types.CompletionItemKind.Value,
                detail="Boolean Value",
                documentation=f"Boolean value: {bool_val}",
            )
        )

    return types.CompletionList(
        is_incomplete=False,
        items=items,
    )


def main():
    """Main entry point for the language server"""
    logger.info("Starting CK3 Language Server...")
    server.start_io()


if __name__ == "__main__":
    main()
