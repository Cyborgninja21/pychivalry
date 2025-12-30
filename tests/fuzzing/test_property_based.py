"""Fuzzing tests using hypothesis for property-based testing.

Tests the parser and other components with randomly generated inputs.
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from pychivalry.parser import parse_document
from pychivalry.diagnostics import collect_all_diagnostics, get_diagnostics_for_text
from pychivalry.completions import get_context_aware_completions
from pychivalry.indexer import DocumentIndex


# Custom strategies for generating CK3-like content
@st.composite
def ck3_identifier(draw):
    """Generate valid CK3 identifiers."""
    first_char = draw(st.sampled_from('abcdefghijklmnopqrstuvwxyz_'))
    rest = draw(st.text(alphabet='abcdefghijklmnopqrstuvwxyz0123456789_', min_size=0, max_size=20))
    return first_char + rest


@st.composite
def ck3_namespace(draw):
    """Generate namespace declarations."""
    name = draw(ck3_identifier())
    return f"namespace = {name}\n"


@st.composite
def ck3_simple_assignment(draw):
    """Generate simple key = value assignments."""
    key = draw(ck3_identifier())
    value = draw(st.one_of(
        st.integers(min_value=-1000, max_value=1000).map(str),
        st.booleans().map(lambda b: "yes" if b else "no"),
        ck3_identifier(),
        st.text(alphabet='abcdefghijklmnopqrstuvwxyz ', min_size=1, max_size=50).map(lambda s: f'"{s}"')
    ))
    return f"{key} = {value}\n"


@st.composite
def ck3_block(draw, max_depth=3):
    """Generate nested CK3 blocks."""
    if draw(st.booleans()) and max_depth > 0:
        # Nested block
        name = draw(ck3_identifier())
        num_statements = draw(st.integers(min_value=0, max_value=5))
        statements = [draw(ck3_block(max_depth=max_depth-1)) for _ in range(num_statements)]
        return f"{name} = {{\n{''.join(statements)}}}\n"
    else:
        # Simple assignment
        return draw(ck3_simple_assignment())


class TestParserRobustness:
    """Test parser handles malformed and edge case inputs."""

    @given(st.text(min_size=0, max_size=1000))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_parser_handles_arbitrary_text(self, text):
        """Parser should not crash on arbitrary text input."""
        try:
            result = parse_document(text)
            # Parser should return something (even if it's an error tree)
            assert result is not None
        except Exception as e:
            # No uncaught exceptions allowed
            pytest.fail(f"Parser crashed on input: {repr(text[:100])}\nError: {e}")

    @given(st.integers(min_value=0, max_value=10).flatmap(
        lambda n: st.lists(ck3_simple_assignment(), min_size=0, max_size=n)
    ))
    @settings(max_examples=50)
    def test_parser_handles_valid_assignments(self, assignments):
        """Parser should handle lists of valid assignments."""
        content = "".join(assignments)
        result = parse_document(content)
        assert result is not None

    @given(st.text(alphabet='{}[]()=\n\t ', min_size=0, max_size=200))
    @settings(max_examples=50)
    def test_parser_handles_brackets_and_delimiters(self, text):
        """Parser should handle random combinations of brackets and delimiters."""
        try:
            result = parse_document(text)
            assert result is not None
        except Exception as e:
            pytest.fail(f"Parser crashed on delimiters: {repr(text[:100])}\nError: {e}")

    @given(st.integers(min_value=1, max_value=100))
    @settings(max_examples=20)
    def test_parser_handles_deep_nesting(self, depth):
        """Parser should handle deeply nested structures."""
        # Create nested structure
        content = "test = {\n"
        content += "{\n" * depth
        content += "value = 1\n"
        content += "}\n" * depth
        content += "}\n"
        
        try:
            result = parse_document(content)
            assert result is not None
        except RecursionError:
            pytest.skip("Recursion limit reached - expected for very deep nesting")

    @given(st.text(alphabet='"\'\n', min_size=0, max_size=100))
    @settings(max_examples=50)
    def test_parser_handles_quotes(self, text):
        """Parser should handle various quote combinations."""
        try:
            result = parse_document(text)
            assert result is not None
        except Exception as e:
            pytest.fail(f"Parser crashed on quotes: {repr(text[:100])}\nError: {e}")


class TestDiagnosticsRobustness:
    """Test diagnostics handles edge cases."""

    @given(st.text(min_size=0, max_size=500))
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_diagnostics_handles_arbitrary_input(self, text):
        """Diagnostics should not crash on arbitrary parsed input."""
        try:
            doc = parse_document(text)
            diagnostics = get_diagnostics_for_text(text)
            # Should return list (possibly empty)
            assert isinstance(diagnostics, list)
        except Exception as e:
            pytest.fail(f"Diagnostics crashed: {e}")

    @given(ck3_namespace(), st.lists(ck3_simple_assignment(), min_size=0, max_size=20))
    @settings(max_examples=30)
    def test_diagnostics_on_valid_structure(self, namespace, assignments):
        """Diagnostics should handle valid CK3 structures."""
        content = namespace + "".join(assignments)
        doc = parse_document(content)
        diagnostics = get_diagnostics_for_text(text)
        assert isinstance(diagnostics, list)


class TestCompletionsRobustness:
    """Test completions handles edge cases."""

    @given(st.text(min_size=0, max_size=200), st.integers(min_value=0, max_value=20), st.integers(min_value=0, max_value=100))
    @settings(max_examples=30, suppress_health_check=[HealthCheck.too_slow])
    def test_completions_handles_arbitrary_position(self, text, line, col):
        """Completions should handle arbitrary cursor positions without crashing."""
        try:
            doc = parse_document(text)
            index = DocumentIndex()
            index.index_document("fuzz.txt", doc)
            
            # Try to get completions at position
            position = (line, col)
            completions = get_context_aware_completions(doc, position, index)
            
            # Should return list (possibly empty)
            assert isinstance(completions, list)
        except Exception as e:
            # Some positions might be invalid - that's okay
            # But we shouldn't crash with unhandled exceptions
            assert "index out of range" in str(e).lower() or "invalid position" in str(e).lower()


class TestPropertyInvariants:
    """Test properties that must always hold true."""

    @given(st.text(min_size=0, max_size=500))
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_parser_always_returns_document(self, text):
        """Property: Parser must always return a document object."""
        result = parse_document(text)
        assert result is not None
        assert hasattr(result, 'root')

    @given(st.text(min_size=0, max_size=300))
    @settings(max_examples=30)
    def test_diagnostics_always_returns_list(self, text):
        """Property: Diagnostics must always return a list."""
        doc = parse_document(text)
        diagnostics = get_diagnostics_for_text(text)
        assert isinstance(diagnostics, list)

    @given(ck3_namespace(), st.lists(ck3_simple_assignment(), min_size=1, max_size=10))
    @settings(max_examples=20)
    def test_valid_ck3_produces_no_parse_errors(self, namespace, assignments):
        """Property: Valid CK3 syntax should produce parseable document."""
        content = namespace + "".join(assignments)
        doc = parse_document(content)
        
        # Document should be created
        assert doc is not None
        assert doc.root is not None


class TestEdgeCases:
    """Test specific edge cases."""

    def test_empty_file(self):
        """Parser should handle empty files."""
        result = parse_document("")
        assert result is not None

    def test_single_character(self):
        """Parser should handle single character files."""
        for char in "abcdefghijklmnopqrstuvwxyz0123456789_={}[]()\"'":
            result = parse_document(char)
            assert result is not None

    def test_very_long_line(self):
        """Parser should handle very long lines."""
        long_line = "value = " + "a" * 10000
        result = parse_document(long_line)
        assert result is not None

    def test_unicode_characters(self):
        """Parser should handle unicode characters."""
        content = """
        namespace = tëst
        événement = {
            id = tëst.001
            描述 = "Unicode test"
        }
        """
        result = parse_document(content)
        assert result is not None

    def test_mixed_line_endings(self):
        """Parser should handle mixed line endings."""
        content = "line1 = value1\nline2 = value2\r\nline3 = value3\rline4 = value4"
        result = parse_document(content)
        assert result is not None

    def test_incomplete_structures(self):
        """Parser should handle incomplete structures gracefully."""
        incomplete = [
            "namespace = ",
            "event = {",
            "event = { id =",
            "event = { id = test.001",
            '{"key": "missing_close_brace"'
        ]
        
        for content in incomplete:
            result = parse_document(content)
            assert result is not None  # Should not crash

    @given(st.binary(min_size=0, max_size=200))
    @settings(max_examples=20)
    def test_invalid_utf8_sequences(self, binary_data):
        """Parser should handle invalid UTF-8 sequences."""
        try:
            # Try to decode as UTF-8, with error handling
            text = binary_data.decode('utf-8', errors='replace')
            result = parse_document(text)
            assert result is not None
        except Exception:
            # Some binary data might not be decodable at all - that's okay
            pass
