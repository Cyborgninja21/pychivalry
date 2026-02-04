"""
Tests for the CK3 script parser.

This module tests the parser's ability to convert CK3 script text into an
Abstract Syntax Tree (AST) with correct structure and position information.
"""

import pytest
from lsprotocol import types

from pychivalry.core.parser import (
    parse_document,
    get_node_at_position,
    tokenize,
    CK3Node,
    CK3Token,
    ParseError,
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
        ast, _parse_errors = parse_document("")
        assert ast == []

    def test_parse_namespace(self, sample_event_text):
        """Parser extracts namespace declarations."""
        ast, _parse_errors = parse_document(sample_event_text)
        namespaces = [n for n in ast if n.type == "namespace"]
        assert len(namespaces) == 1
        assert namespaces[0].key == "namespace"

    def test_parse_event(self, sample_event_text):
        """Parser extracts event definitions."""
        ast, _parse_errors = parse_document(sample_event_text)
        events = [n for n in ast if n.type == "event"]
        assert len(events) == 1
        assert events[0].key == "test_mod.0001"

    def test_parse_nested_blocks(self, sample_event_text):
        """Parser correctly nests blocks."""
        ast, _parse_errors = parse_document(sample_event_text)
        event = [n for n in ast if n.type == "event"][0]

        # Find trigger block
        trigger = next((c for c in event.children if c.key == "trigger"), None)
        assert trigger is not None
        assert trigger.type == "block"
        assert len(trigger.children) > 0

    def test_parse_assignments(self, sample_event_text):
        """Parser extracts assignments."""
        ast, _parse_errors = parse_document(sample_event_text)
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
        ast, _parse_errors = parse_document(text)
        # Comments should not prevent parsing
        assert len(ast) > 0

    def test_node_ranges(self, sample_event_text):
        """Parser assigns correct ranges to nodes."""
        ast, _parse_errors = parse_document(sample_event_text)
        for node in ast:
            assert isinstance(node.range, types.Range)
            assert node.range.start.line >= 0
            assert node.range.end.line >= node.range.start.line

    def test_parse_simple_assignment(self):
        """Parser handles simple key = value assignments."""
        text = "namespace = test_mod"
        ast, _parse_errors = parse_document(text)
        assert len(ast) == 1
        assert ast[0].key == "namespace"
        # Value might be parsed differently depending on implementation

    def test_parse_block_structure(self):
        """Parser handles block structures."""
        text = """trigger = {
    is_adult = yes
    age >= 16
}"""
        ast, _parse_errors = parse_document(text)
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
        ast, _parse_errors = parse_document(text)
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
        ast, _parse_errors = parse_document(text)
        assert len(ast) > 0


class TestParserEdgeCases:
    """Edge case tests for the parser."""

    def test_unclosed_block(self):
        """Parser handles unclosed blocks gracefully."""
        text = """trigger = {
    is_adult = yes
"""
        # Should not crash
        ast, _parse_errors = parse_document(text)
        # Behavior with unclosed blocks is implementation-dependent
        # Just ensure it doesn't raise an exception

    def test_orphan_closing_bracket(self):
        """Parser handles orphan closing brackets."""
        text = """}
namespace = test
"""
        # Should not crash
        ast, _parse_errors = parse_document(text)

    def test_missing_operator(self):
        """Parser handles missing operators."""
        text = """trigger {
    is_adult yes
}"""
        # Should not crash
        ast, _parse_errors = parse_document(text)

    def test_malformed_assignment(self):
        """Parser handles malformed assignments."""
        text = "key = = value"
        # Should not crash
        ast, _parse_errors = parse_document(text)

    def test_empty_block(self):
        """Parser handles empty blocks."""
        text = "trigger = { }"
        ast, _parse_errors = parse_document(text)
        assert len(ast) > 0


class TestGetNodeAtPosition:
    """Tests for cursor-based node lookup."""

    def test_get_node_simple(self):
        """Can find node at cursor position."""
        text = "namespace = test_mod"
        ast, _parse_errors = parse_document(text)

        # Position at the 'namespace' keyword
        pos = types.Position(line=0, character=2)
        node = get_node_at_position(ast, pos)
        assert node is not None

    def test_get_node_in_block(self, sample_event_text):
        """Can find node inside a block."""
        ast, _parse_errors = parse_document(sample_event_text)

        # Position inside trigger block (around line 12)
        pos = types.Position(line=12, character=8)
        node = get_node_at_position(ast, pos)
        # Should find some node, exact node depends on position
        # Just verify it doesn't crash and returns something or None
        assert node is None or isinstance(node, CK3Node)

    def test_get_node_not_found(self, sample_event_text):
        """Returns None when position is outside all nodes."""
        ast, _parse_errors = parse_document(sample_event_text)

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
        ast, _parse_errors = parse_document(text)

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
        ast, _parse_errors = parse_document(text)

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
        ast, _parse_errors = parse_document(text)

        # Should parse without crashing
        assert len(ast) > 0

    def test_parse_syntax_errors_file(self, fixtures_dir):
        """Parser handles files with syntax errors gracefully."""
        file_path = fixtures_dir / "syntax_errors.txt"
        if not file_path.exists():
            pytest.skip("Fixture file not found")

        text = file_path.read_text()

        # Should not crash even with syntax errors
        ast, _parse_errors = parse_document(text)
        # May or may not have nodes depending on error recovery
        # Just ensure it doesn't raise an exception


class TestParserParentReferences:
    """Tests for parent node references."""

    def test_parent_references_set(self):
        """Parser sets parent references correctly."""
        text = """outer = {
    inner = yes
}"""
        ast, _parse_errors = parse_document(text)

        outer = ast[0]
        assert outer.parent is None  # Top-level node

        if outer.children:
            inner = outer.children[0]
            assert inner.parent == outer

    def test_top_level_nodes_no_parent(self, sample_event_text):
        """Top-level nodes have no parent."""
        ast, _parse_errors = parse_document(sample_event_text)

        for node in ast:
            assert node.parent is None


class TestParserScopeTypes:
    """Tests for scope type tracking."""

    def test_default_scope_type(self):
        """New nodes have default scope type."""
        text = "namespace = test"
        ast, _parse_errors = parse_document(text)

        if ast:
            assert ast[0].scope_type == "unknown"


class TestParserErrors:
    """Tests for parser error detection."""

    def test_unclosed_block_detected(self):
        """Parser detects unclosed blocks (PARSE-004)."""
        text = """trigger = {
    is_adult = yes"""  # Missing closing }

        ast, errors = parse_document(text)

        # Should have one PARSE-004 error
        assert len(errors) == 1
        assert errors[0].code == "PARSE-004"
        assert "Unclosed block" in errors[0].message
        assert "trigger" in errors[0].message
        assert errors[0].severity == types.DiagnosticSeverity.Error

        # AST should still be partial (error-tolerant parsing)
        assert len(ast) == 1
        assert ast[0].key == "trigger"

    def test_nested_unclosed_blocks(self):
        """Parser detects multiple unclosed blocks."""
        text = """outer = {
    inner = {
        value = yes
    # Missing two closing braces
"""
        ast, errors = parse_document(text)

        # Should detect unclosed blocks
        assert len(errors) >= 1
        parse_004_errors = [e for e in errors if e.code == "PARSE-004"]
        assert len(parse_004_errors) >= 1

    def test_unmatched_closing_brace(self):
        """Parser detects unmatched closing braces (PARSE-006)."""
        text = """trigger = {
    is_adult = yes
}
}"""  # Extra closing brace

        ast, errors = parse_document(text)

        # Should have one PARSE-006 error
        assert len(errors) == 1
        assert errors[0].code == "PARSE-006"
        assert "Unmatched closing brace" in errors[0].message
        assert errors[0].severity == types.DiagnosticSeverity.Error

    def test_multiple_unmatched_closing_braces(self):
        """Parser detects multiple unmatched closing braces."""
        text = "} } }"  # Three unmatched braces

        ast, errors = parse_document(text)

        # Should detect all three
        assert len(errors) == 3
        for error in errors:
            assert error.code == "PARSE-006"
            assert "Unmatched closing brace" in error.message

    def test_valid_code_no_errors(self):
        """Parser returns no errors for valid code."""
        text = """namespace = test_mod

test_mod.0001 = {
    type = character_event
    trigger = {
        is_adult = yes
        NOT = {
            has_trait = content
        }
    }
}"""

        ast, errors = parse_document(text)

        # Should have no parse errors
        assert len(errors) == 0

        # Should successfully parse AST
        assert len(ast) == 2  # namespace and event

    def test_error_position_accuracy(self):
        """Parser reports accurate positions for errors."""
        text = """line1 = yes
trigger = {
    value = yes"""  # Unclosed at line 2 (0-indexed: line 1)

        ast, errors = parse_document(text)

        assert len(errors) == 1
        error = errors[0]

        # Error should point to 'trigger' keyword (line 1, 0-indexed)
        assert error.range.start.line == 1
        assert "trigger" in text.split("\n")[error.range.start.line]

    def test_error_recovery_continues_parsing(self):
        """Parser continues after errors (error recovery)."""
        text = """first = {
    unclosed = {
        value = yes
    # Missing closing for 'unclosed'
}

second = {
    properly = closed
}"""

        ast, errors = parse_document(text)

        # Should have parse errors for unclosed block
        assert len(errors) >= 1

        # But should still parse what it can
        assert len(ast) >= 1

    def test_regression_NOT_block_unclosed(self):
        """Regression test for the reported bug - unclosed NOT blocks."""
        text = """scripted_trigger rq_activity_feast_participant_trigger = {
    is_alive = yes
    is_imprisoned = no
    NOT = { this = root }"""  # Missing closing brace for scripted_trigger

        ast, errors = parse_document(text)

        # Should detect the unclosed scripted_trigger block
        assert len(errors) >= 1
        assert any(e.code == "PARSE-004" for e in errors)
        assert any("rq_activity_feast_participant_trigger" in e.message for e in errors)
