"""
Tests for the document indexer.

This module tests indexing of symbols across documents for navigation features.
"""

import pytest
from lsprotocol import types

from pychivalry.indexer import DocumentIndex
from pychivalry.parser import parse_document


class TestDocumentIndex:
    """Tests for basic document indexing."""
    
    def test_index_initialization(self):
        """Index initializes with empty dictionaries."""
        index = DocumentIndex()
        
        assert len(index.namespaces) == 0
        assert len(index.events) == 0
        assert len(index.saved_scopes) == 0
    
    def test_index_namespace(self):
        """Index tracks namespace declarations."""
        index = DocumentIndex()
        text = "namespace = test_mod"
        ast = parse_document(text)
        
        index.update_from_ast("file:///test.txt", ast)
        
        assert "test_mod" in index.namespaces
        assert index.namespaces["test_mod"] == "file:///test.txt"
    
    def test_index_event(self):
        """Index tracks event definitions."""
        index = DocumentIndex()
        text = """namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test.t
}"""
        ast = parse_document(text)
        
        index.update_from_ast("file:///test.txt", ast)
        
        assert "test_mod.0001" in index.events
        event_loc = index.events["test_mod.0001"]
        assert event_loc.uri == "file:///test.txt"
        assert isinstance(event_loc.range, types.Range)
    
    def test_index_saved_scope(self):
        """Index tracks saved scope declarations."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    immediate = {
        save_scope_as = my_target
    }
}"""
        ast = parse_document(text)
        
        index.update_from_ast("file:///test.txt", ast)
        
        assert "my_target" in index.saved_scopes
        scope_loc = index.saved_scopes["my_target"]
        assert scope_loc.uri == "file:///test.txt"
    
    def test_index_multiple_documents(self):
        """Index tracks symbols from multiple documents."""
        index = DocumentIndex()
        
        # First document
        text1 = "namespace = mod1"
        ast1 = parse_document(text1)
        index.update_from_ast("file:///doc1.txt", ast1)
        
        # Second document
        text2 = "namespace = mod2"
        ast2 = parse_document(text2)
        index.update_from_ast("file:///doc2.txt", ast2)
        
        assert "mod1" in index.namespaces
        assert "mod2" in index.namespaces
        assert index.namespaces["mod1"] == "file:///doc1.txt"
        assert index.namespaces["mod2"] == "file:///doc2.txt"
    
    def test_update_removes_old_entries(self):
        """Updating a document removes old entries."""
        index = DocumentIndex()
        
        # Initial content
        text1 = "namespace = old_namespace"
        ast1 = parse_document(text1)
        index.update_from_ast("file:///test.txt", ast1)
        
        assert "old_namespace" in index.namespaces
        
        # Updated content
        text2 = "namespace = new_namespace"
        ast2 = parse_document(text2)
        index.update_from_ast("file:///test.txt", ast2)
        
        # Old namespace should be gone
        assert "old_namespace" not in index.namespaces
        assert "new_namespace" in index.namespaces
    
    def test_remove_document(self):
        """Removing a document clears all its entries."""
        index = DocumentIndex()
        
        text = """namespace = test_mod

test_mod.0001 = {
    type = character_event
    immediate = {
        save_scope_as = my_scope
    }
}"""
        ast = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)
        
        assert "test_mod" in index.namespaces
        assert "test_mod.0001" in index.events
        assert "my_scope" in index.saved_scopes
        
        # Remove the document
        index.remove_document("file:///test.txt")
        
        assert "test_mod" not in index.namespaces
        assert "test_mod.0001" not in index.events
        assert "my_scope" not in index.saved_scopes


class TestIndexLookup:
    """Tests for index lookup methods."""
    
    def test_find_event(self):
        """Can find event by ID."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    type = character_event
}"""
        ast = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)
        
        location = index.find_event("test_mod.0001")
        assert location is not None
        assert location.uri == "file:///test.txt"
    
    def test_find_event_not_found(self):
        """Returns None for unknown event."""
        index = DocumentIndex()
        
        location = index.find_event("unknown.0001")
        assert location is None
    
    def test_find_saved_scope(self):
        """Can find saved scope location."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    immediate = {
        save_scope_as = target
    }
}"""
        ast = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)
        
        location = index.find_saved_scope("target")
        assert location is not None
        assert location.uri == "file:///test.txt"
    
    def test_find_saved_scope_not_found(self):
        """Returns None for unknown saved scope."""
        index = DocumentIndex()
        
        location = index.find_saved_scope("unknown")
        assert location is None
    
    def test_get_all_events(self):
        """Can get list of all events."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    type = character_event
}

test_mod.0002 = {
    type = letter_event
}"""
        ast = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)
        
        events = index.get_all_events()
        assert len(events) == 2
        assert "test_mod.0001" in events
        assert "test_mod.0002" in events
    
    def test_get_all_namespaces(self):
        """Can get list of all namespaces."""
        index = DocumentIndex()
        
        text1 = "namespace = mod1"
        ast1 = parse_document(text1)
        index.update_from_ast("file:///doc1.txt", ast1)
        
        text2 = "namespace = mod2"
        ast2 = parse_document(text2)
        index.update_from_ast("file:///doc2.txt", ast2)
        
        namespaces = index.get_all_namespaces()
        assert len(namespaces) == 2
        assert "mod1" in namespaces
        assert "mod2" in namespaces


class TestIndexIntegration:
    """Integration tests with real fixture files."""
    
    def test_index_valid_event_file(self, fixtures_dir):
        """Index a complete event file."""
        file_path = fixtures_dir / "valid_event.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")
        
        index = DocumentIndex()
        text = file_path.read_text()
        ast = parse_document(text)
        
        index.update_from_ast("file:///test.txt", ast)
        
        # Should have indexed the namespace
        assert "test_mod" in index.namespaces
        
        # Should have indexed the event
        assert "test_mod.0001" in index.events
        
        # Should have indexed saved scope
        assert "main_character" in index.saved_scopes
