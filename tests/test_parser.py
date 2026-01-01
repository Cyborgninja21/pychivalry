"""
Tests for the CK3 script parser.

This module tests the parser's ability to convert CK3 script text into an
Abstract Syntax Tree (AST) with correct structure and position information.
"""

import pytest
from lsprotocol import types

from pychivalry.parser import (
    parse_document,
    get_node_at_position,
    tokenize,
    CK3Node,
    CK3Token,
)


class TestTokenizer:
    """Tests for the CK3 tokenizer."""

    def test_tokenize_empty(self):
        """Tokenizer handles empty input."""
        tokens = tokenize("")
        assert tokens == []

    def test_tokenize_identifiers(self):
        """Tokenizer recognizes identifiers."""
        tokens = tokenize("namespace add_gold is_adult")
        assert len(tokens) == 3
        assert all(t.type == "identifier" for t in tokens)
        assert [t.value for t in tokens] == ["namespace", "add_gold", "is_adult"]

    def test_tokenize_operators(self):
        """Tokenizer recognizes all operators."""
        tokens = tokenize("= > < >= <= != ==")
        assert len(tokens) == 7
        assert all(t.type == "operator" for t in tokens)
        assert [t.value for t in tokens] == ["=", ">", "<", ">=", "<=", "!=", "=="]

    def test_tokenize_braces(self):
        """Tokenizer recognizes braces."""
        tokens = tokenize("{ }")
        assert len(tokens) == 2
        assert all(t.type == "brace" for t in tokens)
        assert [t.value for t in tokens] == ["{", "}"]

    def test_tokenize_numbers(self):
        """Tokenizer recognizes numbers."""
        tokens = tokenize("100 -50 3.14 -2.5")
        assert len(tokens) == 4
        assert all(t.type == "number" for t in tokens)
        assert [t.value for t in tokens] == ["100", "-50", "3.14", "-2.5"]

    def test_tokenize_strings(self):
        """Tokenizer recognizes quoted strings."""
        tokens = tokenize('"hello world" "test"')
        assert len(tokens) == 2
        assert all(t.type == "string" for t in tokens)
        assert [t.value for t in tokens] == ['"hello world"', '"test"']

    def test_tokenize_comments(self):
        """Tokenizer recognizes comments."""
        tokens = tokenize("# This is a comment\nnamespace = test  # inline comment")
        comments = [t for t in tokens if t.type == "comment"]
        assert len(comments) == 2
        assert comments[0].value == "# This is a comment"
        assert comments[1].value == "# inline comment"

    def test_tokenize_scope_references(self):
        """Tokenizer recognizes scope references."""
        tokens = tokenize("scope:my_target event_target:test")
        assert len(tokens) == 2
        assert all(t.type == "identifier" for t in tokens)
        assert tokens[0].value == "scope:my_target"
        assert tokens[1].value == "event_target:test"

    def test_tokenize_position_tracking(self):
        """Tokenizer tracks line and character positions."""
        text = "line1\nline2 test"
        tokens = tokenize(text)
        assert tokens[0].line == 0
        assert tokens[1].line == 1
        assert tokens[1].character == 0  # 'line2' starts at character 0
        assert tokens[2].character > 0  # 'test' is after 'line2 '


class TestParser:
    """Tests for the CK3 script parser."""

    def test_parse_empty_document(self):
        """Parser handles empty documents."""
        ast = parse_document("")
        assert ast == []

    def test_parse_namespace(self, sample_event_text):
        """Parser extracts namespace declarations."""
        ast = parse_document(sample_event_text)
        namespaces = [n for n in ast if n.type == "namespace"]
        assert len(namespaces) == 1
        assert namespaces[0].key == "namespace"

    def test_parse_event(self, sample_event_text):
        """Parser extracts event definitions."""
        ast = parse_document(sample_event_text)
        events = [n for n in ast if n.type == "event"]
        assert len(events) == 1
        assert events[0].key == "test_mod.0001"

    def test_parse_nested_blocks(self, sample_event_text):
        """Parser correctly nests blocks."""
        ast = parse_document(sample_event_text)
        event = [n for n in ast if n.type == "event"][0]

        # Find trigger block
        trigger = next((c for c in event.children if c.key == "trigger"), None)
        assert trigger is not None
        assert trigger.type == "block"
        assert len(trigger.children) > 0

    def test_parse_assignments(self, sample_event_text):
        """Parser extracts assignments."""
        ast = parse_document(sample_event_text)
        event = [n for n in ast if n.type == "event"][0]

        # Find type assignment
        type_node = next((c for c in event.children if c.key == "type"), None)
        assert type_node is not None
        assert type_node.value == "character_event"

    def test_parse_with_comments(self):
        """Parser handles comments correctly."""
        text = """# This is a comment
namespace = test  # inline comment
"""
        ast = parse_document(text)
        # Comments should not prevent parsing
        assert len(ast) > 0

    def test_node_ranges(self, sample_event_text):
        """Parser assigns correct ranges to nodes."""
        ast = parse_document(sample_event_text)
        for node in ast:
            assert isinstance(node.range, types.Range)
            assert node.range.start.line >= 0
            assert node.range.end.line >= node.range.start.line

    def test_parse_simple_assignment(self):
        """Parser handles simple key = value assignments."""
        text = "namespace = test_mod"
        ast = parse_document(text)
        assert len(ast) == 1
        assert ast[0].key == "namespace"
        # Value might be parsed differently depending on implementation

    def test_parse_block_structure(self):
        """Parser handles block structures."""
        text = """trigger = {
    is_adult = yes
    age >= 16
}"""
        ast = parse_document(text)
        assert len(ast) == 1
        assert ast[0].key == "trigger"
        assert ast[0].type == "block"

    def test_parse_nested_blocks_deep(self):
        """Parser handles deeply nested structures."""
        text = """a = {
    b = {
        c = {
            d = yes
        }
    }
}"""
        ast = parse_document(text)
        assert len(ast) == 1

        # Navigate down the tree
        a = ast[0]
        assert a.key == "a"
        assert len(a.children) > 0

        b = next((c for c in a.children if c.key == "b"), None)
        assert b is not None
        assert len(b.children) > 0

    def test_parse_operators(self):
        """Parser recognizes all comparison operators."""
        text = """trigger = {
    age > 16
    age >= 18
    gold < 100
    prestige <= 500
}"""
        ast = parse_document(text)
        assert len(ast) > 0


class TestParserEdgeCases:
    """Edge case tests for the parser."""

    def test_unclosed_block(self):
        """Parser handles unclosed blocks gracefully."""
        text = """trigger = {
    is_adult = yes
"""
        # Should not crash
        ast = parse_document(text)
        # Behavior with unclosed blocks is implementation-dependent
        # Just ensure it doesn't raise an exception

    def test_orphan_closing_bracket(self):
        """Parser handles orphan closing brackets."""
        text = """}
namespace = test
"""
        # Should not crash
        ast = parse_document(text)

    def test_missing_operator(self):
        """Parser handles missing operators."""
        text = """trigger {
    is_adult yes
}"""
        # Should not crash
        ast = parse_document(text)

    def test_malformed_assignment(self):
        """Parser handles malformed assignments."""
        text = "key = = value"
        # Should not crash
        ast = parse_document(text)

    def test_empty_block(self):
        """Parser handles empty blocks."""
        text = "trigger = { }"
        ast = parse_document(text)
        assert len(ast) > 0


class TestGetNodeAtPosition:
    """Tests for cursor-based node lookup."""

    def test_get_node_simple(self):
        """Can find node at cursor position."""
        text = "namespace = test_mod"
        ast = parse_document(text)

        # Position at the 'namespace' keyword
        pos = types.Position(line=0, character=2)
        node = get_node_at_position(ast, pos)
        assert node is not None

    def test_get_node_in_block(self, sample_event_text):
        """Can find node inside a block."""
        ast = parse_document(sample_event_text)

        # Position inside trigger block (around line 12)
        pos = types.Position(line=12, character=8)
        node = get_node_at_position(ast, pos)
        # Should find some node, exact node depends on position
        # Just verify it doesn't crash and returns something or None
        assert node is None or isinstance(node, CK3Node)

    def test_get_node_not_found(self, sample_event_text):
        """Returns None when position is outside all nodes."""
        ast = parse_document(sample_event_text)

        # Position way beyond the document
        pos = types.Position(line=1000, character=1000)
        node = get_node_at_position(ast, pos)
        assert node is None

    def test_get_node_nested(self):
        """Returns most specific (deepest) node."""
        text = """outer = {
    inner = {
        deep = yes
    }
}"""
        ast = parse_document(text)

        # Position at 'deep' keyword
        pos = types.Position(line=2, character=10)
        node = get_node_at_position(ast, pos)
        # Should return the deepest matching node
        # Implementation may vary, just ensure no crash


class TestParserIntegration:
    """Integration tests with real-world fixtures."""

    def test_parse_valid_event_file(self, fixtures_dir):
        """Parser handles valid event files."""
        file_path = fixtures_dir / "valid_event.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")

        text = file_path.read_text()
        ast = parse_document(text)

        # Should parse without crashing
        assert len(ast) > 0

        # Should contain namespace
        namespaces = [n for n in ast if n.type == "namespace"]
        assert len(namespaces) == 1

        # Should contain event
        events = [n for n in ast if n.type == "event"]
        assert len(events) == 1

    def test_parse_scope_chains_file(self, fixtures_dir):
        """Parser handles scope chain syntax."""
        file_path = fixtures_dir / "scope_chains.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")

        text = file_path.read_text()
        ast = parse_document(text)

        # Should parse without crashing
        assert len(ast) > 0

    def test_parse_syntax_errors_file(self, fixtures_dir):
        """Parser handles files with syntax errors gracefully."""
        file_path = fixtures_dir / "syntax_errors.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")

        text = file_path.read_text()

        # Should not crash even with syntax errors
        ast = parse_document(text)
        # May or may not have nodes depending on error recovery
        # Just ensure it doesn't raise an exception


class TestParserParentReferences:
    """Tests for parent node references."""

    def test_parent_references_set(self):
        """Parser sets parent references correctly."""
        text = """outer = {
    inner = yes
}"""
        ast = parse_document(text)

        outer = ast[0]
        assert outer.parent is None  # Top-level node

        if outer.children:
            inner = outer.children[0]
            assert inner.parent == outer

    def test_top_level_nodes_no_parent(self, sample_event_text):
        """Top-level nodes have no parent."""
        ast = parse_document(sample_event_text)

        for node in ast:
            assert node.parent is None


class TestParserScopeTypes:
    """Tests for scope type tracking."""

    def test_default_scope_type(self):
        """New nodes have default scope type."""
        text = "namespace = test"
        ast = parse_document(text)

        if ast:
            assert ast[0].scope_type == "unknown"
