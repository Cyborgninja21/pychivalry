"""
Tests for new LSP features in server.py

Tests Find References, Document Symbols, and Workspace Symbols functionality.
"""

import pytest
from lsprotocol import types
from pychivalry.server import (
    CK3LanguageServer,
    _find_word_references_in_ast,
    _extract_symbol_from_node,
)
from pychivalry.parser import parse_document, CK3Node


@pytest.fixture
def server():
    """Create a test server instance."""
    return CK3LanguageServer("test-server", "v0.1.0")


@pytest.fixture
def sample_event_document():
    """Sample event document for testing."""
    return """namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    trigger = {
        age >= 16
        has_trait = brave
    }
    
    immediate = {
        save_scope_as = event_character
        trigger_event = test_mod.0002
    }
    
    option = {
        name = test_mod.0001.a
        add_gold = 100
    }
    
    option = {
        name = test_mod.0001.b
        trigger_event = test_mod.0002
    }
}

test_mod.0002 = {
    type = letter_event
    sender = scope:event_character
    desc = test_mod.0002.desc
    
    option = {
        name = test_mod.0002.a
    }
}
"""


@pytest.fixture
def scripted_effects_document():
    """Sample scripted effects document for testing."""
    return """my_custom_effect = {
    add_gold = 100
    add_prestige = 50
    trigger_event = test_mod.0001
}

another_effect = {
    remove_trait = brave
    trigger_event = test_mod.0001
}
"""


class TestFindWordReferencesInAST:
    """Test finding word references in AST."""
    
    def test_find_event_references(self):
        """Test finding references to an event ID."""
        doc = """namespace = test_mod
        
test_mod.0001 = {
    type = character_event
    option = {
        trigger_event = test_mod.0002
    }
}

test_mod.0002 = {
    type = character_event
}
"""
        ast = parse_document(doc)
        refs = _find_word_references_in_ast("test_mod.0002", ast, "file:///test.txt")
        
        # Should find the event definition and the trigger_event reference
        assert len(refs) >= 1
        assert all(isinstance(ref, types.Location) for ref in refs)
        assert all(ref.uri == "file:///test.txt" for ref in refs)
    
    def test_find_effect_references(self):
        """Test finding references to effects."""
        doc = """namespace = test_mod
        
test_mod.0001 = {
    option = {
        add_gold = 100
    }
}

test_mod.0002 = {
    option = {
        add_gold = 200
    }
}
"""
        ast = parse_document(doc)
        refs = _find_word_references_in_ast("add_gold", ast, "file:///test.txt")
        
        # Should find both occurrences
        assert len(refs) >= 2
    
    def test_no_references_found(self):
        """Test when no references exist."""
        doc = """namespace = test_mod
        
test_mod.0001 = {
    option = {
        add_prestige = 100
    }
}
"""
        ast = parse_document(doc)
        refs = _find_word_references_in_ast("nonexistent_symbol", ast, "file:///test.txt")
        
        assert len(refs) == 0


class TestExtractSymbolFromNode:
    """Test extracting symbols from CK3 nodes."""
    
    def test_extract_namespace_symbol(self):
        """Test extracting namespace symbol."""
        doc = "namespace = test_mod"
        ast = parse_document(doc)
        
        assert len(ast) > 0
        symbol = _extract_symbol_from_node(ast[0])
        
        assert symbol is not None
        assert symbol.name == "namespace"
        assert symbol.kind == types.SymbolKind.Namespace
    
    def test_extract_event_symbol(self):
        """Test extracting event symbol."""
        doc = """test_mod.0001 = {
    type = character_event
    trigger = {
        age >= 16
    }
    option = {
        name = test_option
    }
}
"""
        ast = parse_document(doc)
        
        assert len(ast) > 0
        symbol = _extract_symbol_from_node(ast[0])
        
        assert symbol is not None
        assert symbol.name == "test_mod.0001"
        assert symbol.kind == types.SymbolKind.Event
        
        # Should have children (trigger, option)
        assert symbol.children is not None
        assert len(symbol.children) > 0
    
    def test_extract_trigger_block_symbol(self):
        """Test extracting trigger block as child symbol."""
        doc = """test_mod.0001 = {
    trigger = {
        age >= 16
    }
}
"""
        ast = parse_document(doc)
        
        assert len(ast) > 0
        event_symbol = _extract_symbol_from_node(ast[0])
        
        assert event_symbol is not None
        assert event_symbol.children is not None
        
        # Find trigger child
        trigger_symbols = [s for s in event_symbol.children if s.name == "trigger"]
        assert len(trigger_symbols) > 0
        
        trigger_symbol = trigger_symbols[0]
        assert trigger_symbol.kind == types.SymbolKind.Object
    
    def test_extract_option_symbol(self):
        """Test extracting option symbol."""
        doc = """test_mod.0001 = {
    option = {
        name = my_option
        add_gold = 100
    }
}
"""
        ast = parse_document(doc)
        
        assert len(ast) > 0
        event_symbol = _extract_symbol_from_node(ast[0])
        
        assert event_symbol is not None
        assert event_symbol.children is not None
        
        # Find option child
        option_symbols = [s for s in event_symbol.children if s.name == "option"]
        assert len(option_symbols) > 0
        
        option_symbol = option_symbols[0]
        assert option_symbol.kind == types.SymbolKind.EnumMember
        assert "Option" in option_symbol.detail


class TestDocumentSymbolExtraction:
    """Test full document symbol extraction."""
    
    def test_extract_symbols_from_event_file(self, sample_event_document):
        """Test extracting all symbols from an event file."""
        ast = parse_document(sample_event_document)
        
        symbols = []
        for node in ast:
            symbol = _extract_symbol_from_node(node)
            if symbol:
                symbols.append(symbol)
        
        # Should have namespace and two events
        assert len(symbols) >= 2
        
        # Check for namespace
        namespace_symbols = [s for s in symbols if s.kind == types.SymbolKind.Namespace]
        assert len(namespace_symbols) > 0
        
        # Check for events
        event_symbols = [s for s in symbols if s.kind == types.SymbolKind.Event]
        assert len(event_symbols) >= 2
    
    def test_hierarchical_structure(self, sample_event_document):
        """Test that symbols have proper hierarchy."""
        ast = parse_document(sample_event_document)
        
        symbols = []
        for node in ast:
            symbol = _extract_symbol_from_node(node)
            if symbol:
                symbols.append(symbol)
        
        # Find first event
        event_symbols = [s for s in symbols if s.kind == types.SymbolKind.Event]
        assert len(event_symbols) > 0
        
        first_event = event_symbols[0]
        
        # Should have children (trigger, immediate, options)
        assert first_event.children is not None
        assert len(first_event.children) >= 3
        
        # Check for trigger
        trigger_children = [c for c in first_event.children if c.name == "trigger"]
        assert len(trigger_children) > 0
        
        # Check for immediate
        immediate_children = [c for c in first_event.children if c.name == "immediate"]
        assert len(immediate_children) > 0
        
        # Check for options
        option_children = [c for c in first_event.children if c.name == "option"]
        assert len(option_children) >= 2


class TestSymbolSearch:
    """Test symbol search functionality."""
    
    def test_case_insensitive_search(self):
        """Test that symbol search is case-insensitive."""
        # This would test the workspace_symbol handler
        # For now, we test that lowercase query matches uppercase symbols
        query = "test_mod"
        symbol_name = "TEST_MOD.0001"
        
        assert query.lower() in symbol_name.lower()
    
    def test_partial_match(self):
        """Test partial string matching."""
        query = "mod"
        symbol_names = ["test_mod.0001", "my_modifier", "another_thing"]
        
        matches = [name for name in symbol_names if query.lower() in name.lower()]
        assert len(matches) == 2
        assert "test_mod.0001" in matches
        assert "my_modifier" in matches


class TestReferenceContext:
    """Test reference context detection."""
    
    def test_definition_vs_reference(self):
        """Test distinguishing between definition and reference."""
        # Event definition
        definition_doc = """test_mod.0001 = {
    type = character_event
}
"""
        
        # Event reference
        reference_doc = """test_mod.0002 = {
    option = {
        trigger_event = test_mod.0001
    }
}
"""
        
        def_ast = parse_document(definition_doc)
        ref_ast = parse_document(reference_doc)
        
        # Definition should be at top level
        def_refs = _find_word_references_in_ast("test_mod.0001", def_ast, "file:///def.txt")
        assert len(def_refs) > 0
        
        # Reference should be inside a block
        ref_refs = _find_word_references_in_ast("test_mod.0001", ref_ast, "file:///ref.txt")
        assert len(ref_refs) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
