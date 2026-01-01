"""
Integration tests for the CK3 language server with parser and indexer.

This module tests the complete integration of parser, indexer, and server.
"""

import pytest
from lsprotocol import types
from pygls.workspace import TextDocument

from pychivalry.server import CK3LanguageServer


class TestServerIntegration:
    """Tests for server integration with parser and indexer."""

    def test_server_creation(self):
        """CK3LanguageServer can be created."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        assert server is not None
        assert hasattr(server, "document_asts")
        assert hasattr(server, "index")
        assert len(server.document_asts) == 0

    def test_parse_and_index_document(self):
        """Server can parse and index a document."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        text = """namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test.t
}"""

        doc = TextDocument(uri="file:///test.txt", source=text)
        ast = server.parse_and_index_document(doc)

        # AST should be stored
        assert "file:///test.txt" in server.document_asts
        assert len(server.document_asts["file:///test.txt"]) > 0

        # Index should be updated
        assert "test_mod" in server.index.namespaces
        assert "test_mod.0001" in server.index.events

    def test_document_lifecycle(self):
        """Server handles full document lifecycle."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        text1 = "namespace = mod1"
        doc = TextDocument(uri="file:///test.txt", source=text1)

        # Open - parse and index
        server.parse_and_index_document(doc)
        assert "file:///test.txt" in server.document_asts
        assert "mod1" in server.index.namespaces

        # Change - re-parse and update index
        text2 = "namespace = mod2"
        doc._source = text2
        server.parse_and_index_document(doc)
        assert "mod2" in server.index.namespaces
        assert "mod1" not in server.index.namespaces  # Old removed

        # Close - clean up
        server.document_asts.pop("file:///test.txt", None)
        server.index.remove_document("file:///test.txt")
        assert "file:///test.txt" not in server.document_asts
        assert "mod2" not in server.index.namespaces

    def test_multiple_documents(self):
        """Server can track multiple documents."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        # Document 1
        text1 = "namespace = mod1"
        doc1 = TextDocument(uri="file:///doc1.txt", source=text1)
        server.parse_and_index_document(doc1)

        # Document 2
        text2 = "namespace = mod2"
        doc2 = TextDocument(uri="file:///doc2.txt", source=text2)
        server.parse_and_index_document(doc2)

        # Both should be tracked
        assert "file:///doc1.txt" in server.document_asts
        assert "file:///doc2.txt" in server.document_asts
        assert "mod1" in server.index.namespaces
        assert "mod2" in server.index.namespaces

    def test_parse_error_handling(self):
        """Server handles parse errors gracefully."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        # Malformed text (unclosed bracket)
        text = "trigger = { is_adult = yes"
        doc = TextDocument(uri="file:///test.txt", source=text)

        # Should not crash
        ast = server.parse_and_index_document(doc)

        # Returns empty or partial AST
        assert isinstance(ast, list)
        assert "file:///test.txt" in server.document_asts

    def test_index_lookup_after_parsing(self):
        """Can lookup indexed symbols after parsing."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        text = """test_mod.0001 = {
    type = character_event
    immediate = {
        save_scope_as = my_target
    }
}"""

        doc = TextDocument(uri="file:///test.txt", source=text)
        server.parse_and_index_document(doc)

        # Find event
        event_loc = server.index.find_event("test_mod.0001")
        assert event_loc is not None
        assert event_loc.uri == "file:///test.txt"

        # Find saved scope
        scope_loc = server.index.find_saved_scope("my_target")
        assert scope_loc is not None
        assert scope_loc.uri == "file:///test.txt"

    def test_empty_document(self):
        """Server handles empty documents."""
        server = CK3LanguageServer("test-server", "v0.1.0")

        doc = TextDocument(uri="file:///empty.txt", source="")
        ast = server.parse_and_index_document(doc)

        # Should handle gracefully
        assert isinstance(ast, list)
        assert "file:///empty.txt" in server.document_asts


class TestServerWithRealFixtures:
    """Integration tests with real fixture files."""

    def test_parse_valid_event_fixture(self, fixtures_dir):
        """Server can parse valid event fixture."""
        file_path = fixtures_dir / "valid_event.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")

        server = CK3LanguageServer("test-server", "v0.1.0")
        text = file_path.read_text()
        doc = TextDocument(uri="file:///valid_event.txt", source=text)

        ast = server.parse_and_index_document(doc)

        # Should parse successfully
        assert len(ast) > 0

        # Should index namespace
        assert "test_mod" in server.index.namespaces

        # Should index event
        assert "test_mod.0001" in server.index.events

        # Should index saved scope
        assert "main_character" in server.index.saved_scopes

    def test_parse_scope_chains_fixture(self, fixtures_dir):
        """Server can parse scope chains fixture."""
        file_path = fixtures_dir / "scope_chains.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")

        server = CK3LanguageServer("test-server", "v0.1.0")
        text = file_path.read_text()
        doc = TextDocument(uri="file:///scope_chains.txt", source=text)

        ast = server.parse_and_index_document(doc)

        # Should parse successfully
        assert len(ast) > 0

        # Should index event
        assert "test_mod.0001" in server.index.events

        # Should index saved scope
        assert "target" in server.index.saved_scopes
