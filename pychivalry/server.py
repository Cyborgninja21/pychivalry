"""
Crusader Kings 3 Language Server

A Language Server Protocol implementation for CK3 scripting language using pygls.
This server provides language features like autocomplete, diagnostics, hover information,
and more for CK3 mod development.
"""

import logging
from typing import Optional

from pygls.server import LanguageServer
from lsprotocol.types import (
    TEXT_DOCUMENT_DID_OPEN,
    TEXT_DOCUMENT_DID_CHANGE,
    TEXT_DOCUMENT_DID_CLOSE,
    InitializeParams,
    ServerCapabilities,
    TextDocumentSyncKind,
    DidOpenTextDocumentParams,
    DidChangeTextDocumentParams,
    DidCloseTextDocumentParams,
    MessageType,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class CK3LanguageServer(LanguageServer):
    """Language Server for Crusader Kings 3 scripting language"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.info("CK3 Language Server initialized")


# Create the language server instance
server = CK3LanguageServer("ck3-language-server", "v0.1.0")


@server.feature(TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: CK3LanguageServer, params: DidOpenTextDocumentParams):
    """Handle document open event"""
    logger.info(f"Document opened: {params.text_document.uri}")
    ls.show_message("CK3 Language Server is active!", MessageType.Info)


@server.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: CK3LanguageServer, params: DidChangeTextDocumentParams):
    """Handle document change event"""
    logger.debug(f"Document changed: {params.text_document.uri}")


@server.feature(TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: CK3LanguageServer, params: DidCloseTextDocumentParams):
    """Handle document close event"""
    logger.info(f"Document closed: {params.text_document.uri}")


def main():
    """Main entry point for the language server"""
    logger.info("Starting CK3 Language Server...")
    server.start_io()


if __name__ == "__main__":
    main()
