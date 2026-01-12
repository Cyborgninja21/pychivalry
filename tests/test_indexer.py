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
        ast, _parse_errors = parse_document(text)

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
        ast, _parse_errors = parse_document(text)

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
        ast, _parse_errors = parse_document(text)

        index.update_from_ast("file:///test.txt", ast)

        assert "my_target" in index.saved_scopes
        scope_loc = index.saved_scopes["my_target"]
        assert scope_loc.uri == "file:///test.txt"

    def test_index_multiple_documents(self):
        """Index tracks symbols from multiple documents."""
        index = DocumentIndex()

        # First document
        text1 = "namespace = mod1"
        ast1, _ = parse_document(text1)
        index.update_from_ast("file:///doc1.txt", ast1)

        # Second document
        text2 = "namespace = mod2"
        ast2, _ = parse_document(text2)
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
        ast1, _ = parse_document(text1)
        index.update_from_ast("file:///test.txt", ast1)

        assert "old_namespace" in index.namespaces

        # Updated content
        text2 = "namespace = new_namespace"
        ast2, _ = parse_document(text2)
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
        ast, _parse_errors = parse_document(text)
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
        ast, _parse_errors = parse_document(text)
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
        ast, _parse_errors = parse_document(text)
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
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        events = index.get_all_events()
        assert len(events) == 2
        assert "test_mod.0001" in events
        assert "test_mod.0002" in events

    def test_get_all_namespaces(self):
        """Can get list of all namespaces."""
        index = DocumentIndex()

        text1 = "namespace = mod1"
        ast1, _ = parse_document(text1)
        index.update_from_ast("file:///doc1.txt", ast1)

        text2 = "namespace = mod2"
        ast2, _ = parse_document(text2)
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
        ast, _parse_errors = parse_document(text)

        index.update_from_ast("file:///test.txt", ast)

        # Should have indexed the namespace
        assert "test_mod" in index.namespaces

        # Should have indexed the event
        assert "test_mod.0001" in index.events

        # Should have indexed saved scope
        assert "main_character" in index.saved_scopes


class TestLocalizationReferenceIndex:
    """Tests for localization reference indexing (Issue #33, CK3600/CK3604)."""

    def test_index_localization_reference(self):
        """Index tracks localization key references."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
}"""
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        # Should have tracked both localization references
        assert "test_mod.0001.t" in index.localization_references
        assert "test_mod.0001.desc" in index.localization_references

        # Check reference details for title
        title_refs = index.get_localization_references("test_mod.0001.t")
        assert len(title_refs) == 1
        assert title_refs[0][0] == "file:///test.txt"  # file_uri
        assert title_refs[0][3] == "title"  # field_type

        # Check reference details for desc
        desc_refs = index.get_localization_references("test_mod.0001.desc")
        assert len(desc_refs) == 1
        assert desc_refs[0][3] == "desc"

    def test_index_multiple_references_same_key(self):
        """Index tracks multiple references to the same key."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    title = shared.key
}
test_mod.0002 = {
    title = shared.key
}"""
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        # Should have tracked both references to the same key
        refs = index.get_localization_references("shared.key")
        assert len(refs) == 2

    def test_ignores_literal_strings(self):
        """Index ignores quoted literal strings."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    title = "Literal Title"
    desc = test_mod.0001.desc
}"""
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        # Should not track literal string
        assert '"Literal Title"' not in index.localization_references
        # Should track actual key
        assert "test_mod.0001.desc" in index.localization_references

    def test_ignores_values_without_dots(self):
        """Index ignores values that don't look like localization keys."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    title = invalid_key_no_dot
    desc = test_mod.0001.desc
}"""
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        # Should not track value without dot
        assert "invalid_key_no_dot" not in index.localization_references
        # Should track valid key
        assert "test_mod.0001.desc" in index.localization_references

    def test_find_orphaned_keys(self):
        """Can find localization keys with no references."""
        index = DocumentIndex()

        # Add some localization keys
        index.localization["used.key"] = ("Used text", "file:///loc.yml", 10)
        index.localization["orphaned.key"] = ("Orphaned text", "file:///loc.yml", 20)

        # Add reference to one key
        index._track_localization_reference(
            "used.key", "file:///test.txt", 5, 10, "title"
        )

        # Find orphaned keys
        orphaned = index.find_orphaned_localization_keys()

        assert len(orphaned) == 1
        assert orphaned[0][0] == "orphaned.key"
        assert orphaned[0][1] == "file:///loc.yml"
        assert orphaned[0][2] == 20

    def test_remove_document_clears_references(self):
        """Removing a document clears its localization references."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    title = test_mod.0001.t
}"""
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        # Should have reference
        assert "test_mod.0001.t" in index.localization_references

        # Remove document
        index.remove_document("file:///test.txt")

        # Reference should be gone
        assert "test_mod.0001.t" not in index.localization_references

    def test_reference_tracking_all_loc_fields(self):
        """Index tracks all types of localization fields."""
        index = DocumentIndex()
        text = """test_mod.0001 = {
    title = test.title
    desc = test.desc
    option = {
        name = test.option
        tooltip = test.tooltip
        custom_tooltip = test.custom_tooltip
    }
    text = test.text
}"""
        ast, _parse_errors = parse_document(text)
        index.update_from_ast("file:///test.txt", ast)

        # Should track all field types
        assert "test.title" in index.localization_references
        assert "test.desc" in index.localization_references
        assert "test.option" in index.localization_references
        assert "test.tooltip" in index.localization_references
        assert "test.custom_tooltip" in index.localization_references
        assert "test.text" in index.localization_references
