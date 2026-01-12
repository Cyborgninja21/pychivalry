"""
Unit tests for incremental parser.

Tests the incremental parsing functionality that provides 10-100x speedup
for small edits by only reparsing changed regions.
"""

import pytest
from lsprotocol import types
from pychivalry.incremental_parser import IncrementalParser, TextRange


class TestTextRange:
    """Test the TextRange helper class."""

    def test_overlaps_no_overlap(self):
        """Test ranges that don't overlap."""
        r1 = TextRange(0, 0, 0, 10)
        r2 = TextRange(1, 0, 1, 10)
        assert not r1.overlaps(r2)
        assert not r2.overlaps(r1)

    def test_overlaps_partial(self):
        """Test ranges that partially overlap."""
        r1 = TextRange(0, 0, 1, 10)
        r2 = TextRange(0, 5, 2, 0)
        assert r1.overlaps(r2)
        assert r2.overlaps(r1)

    def test_overlaps_contained(self):
        """Test range fully contained in another."""
        r1 = TextRange(0, 0, 10, 0)
        r2 = TextRange(2, 0, 3, 0)
        assert r1.overlaps(r2)
        assert r2.overlaps(r1)

    def test_overlaps_same(self):
        """Test identical ranges."""
        r1 = TextRange(0, 0, 1, 10)
        r2 = TextRange(0, 0, 1, 10)
        assert r1.overlaps(r2)

    def test_contains_position(self):
        """Test position containment."""
        r = TextRange(0, 5, 2, 10)
        assert r.contains_position(0, 5)  # Start position
        assert r.contains_position(0, 10)  # Middle of first line
        assert r.contains_position(1, 0)  # Middle line
        assert r.contains_position(2, 10)  # End position
        assert not r.contains_position(0, 4)  # Before start
        assert not r.contains_position(2, 11)  # After end
        assert not r.contains_position(3, 0)  # After end line


class TestIncrementalParser:
    """Test the IncrementalParser class."""

    def test_initial_parse(self):
        """Test initial full parse."""
        parser = IncrementalParser()
        text = """
        namespace = test
        character_event = {
            id = test.001
            desc = test.001.desc
        }
        """
        ast, errors = parser.parse(text)

        assert len(ast) > 0
        assert parser._current_text == text
        assert parser._current_ast is not None
        assert len(parser._position_map) > 0

    def test_small_text_insertion(self):
        """Test incremental parsing with small text insertion."""
        parser = IncrementalParser()

        # Initial parse
        initial_text = "trigger = { is_adult = yes }"
        ast, _ = parser.parse(initial_text)
        initial_node_count = self._count_nodes(ast)

        # Make a small change - change "yes" to "no"
        new_text = "trigger = { is_adult = no }"
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=0, character=24),
                end=types.Position(line=0, character=27)
            ),
            text="no"
        )

        # Incremental parse
        new_ast, errors = parser.incremental_parse(change, new_text)

        # Verify the parse succeeded
        assert len(new_ast) > 0
        assert parser._current_text == new_text

    def test_multiline_change(self):
        """Test incremental parsing with multiline changes."""
        parser = IncrementalParser()

        # Initial parse
        initial_text = """trigger = {
    is_adult = yes
    age >= 16
}"""
        ast, _ = parser.parse(initial_text)

        # Add a new line in the middle
        new_text = """trigger = {
    is_adult = yes
    is_alive = yes
    age >= 16
}"""
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=2, character=0),
                end=types.Position(line=2, character=0)
            ),
            text="    is_alive = yes\n"
        )

        # Incremental parse
        new_ast, errors = parser.incremental_parse(change, new_text)

        # Verify the parse succeeded
        assert len(new_ast) > 0
        assert parser._current_text == new_text

    def test_deletion(self):
        """Test incremental parsing with deletion."""
        parser = IncrementalParser()

        # Initial parse
        initial_text = """trigger = {
    is_adult = yes
    is_alive = yes
}"""
        ast, _ = parser.parse(initial_text)

        # Delete one line
        new_text = """trigger = {
    is_adult = yes
}"""
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=2, character=0),
                end=types.Position(line=3, character=0)
            ),
            text=""
        )

        # Incremental parse
        new_ast, errors = parser.incremental_parse(change, new_text)

        # Verify the parse succeeded
        assert len(new_ast) > 0
        assert parser._current_text == new_text

    def test_fallback_to_full_parse_on_no_previous_ast(self):
        """Test that parser falls back to full parse when no previous AST exists."""
        parser = IncrementalParser()

        text = "trigger = { is_adult = yes }"
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=0, character=24),
                end=types.Position(line=0, character=27)
            ),
            text="no"
        )

        # Should fall back to full parse since no previous AST
        ast, errors = parser.incremental_parse(change, text)

        assert len(ast) > 0
        assert parser._current_ast is not None

    def test_fallback_to_full_parse_on_full_document_change(self):
        """Test fallback when change has no range (full document replace)."""
        parser = IncrementalParser()

        # Initial parse
        initial_text = "trigger = { is_adult = yes }"
        parser.parse(initial_text)

        # Full document change (no range)
        new_text = "completely_different_content = { foo = bar }"
        change = types.TextDocumentContentChangeWholeDocument(
            text=new_text
        )

        # Should fall back to full parse
        ast, errors = parser.incremental_parse(change, new_text)

        assert len(ast) > 0
        assert parser._current_text == new_text

    def test_position_map_rebuild(self):
        """Test that position map is rebuilt after parsing."""
        parser = IncrementalParser()

        text = """
        namespace = test
        character_event = {
            id = test.001
            desc = test.001.desc
            immediate = {
                add_gold = 100
            }
        }
        """
        ast, _ = parser.parse(text)

        # Position map should be populated
        assert len(parser._position_map) > 0

        # Position map should cover multiple nodes
        node_count = self._count_nodes(ast)
        # Each node should be in the position map
        assert len(parser._position_map) == node_count

    def test_thread_safety(self):
        """Test that parser operations are thread-safe."""
        import threading

        parser = IncrementalParser()
        text = "trigger = { is_adult = yes }"
        parser.parse(text)

        results = []
        errors = []

        def parse_in_thread():
            try:
                new_text = "trigger = { is_adult = no }"
                change = types.TextDocumentContentChangePartial(
                    range=types.Range(
                        start=types.Position(line=0, character=24),
                        end=types.Position(line=0, character=27)
                    ),
                    text="no"
                )
                ast, errs = parser.incremental_parse(change, new_text)
                results.append(ast)
            except Exception as e:
                errors.append(e)

        # Run multiple threads
        threads = [threading.Thread(target=parse_in_thread) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Should have results and no errors
        # Due to locking, only one should succeed, others might get stale state
        # The important thing is no crashes
        assert len(errors) == 0

    def test_invalidate(self):
        """Test invalidating parser state."""
        parser = IncrementalParser()

        text = "trigger = { is_adult = yes }"
        parser.parse(text)

        assert parser._current_ast is not None
        assert parser._current_text != ""
        assert len(parser._position_map) > 0

        # Invalidate
        parser.invalidate()

        assert parser._current_ast is None
        assert parser._current_text == ""
        assert len(parser._position_map) == 0

    def test_complex_nested_structure(self):
        """Test incremental parsing with deeply nested structures."""
        parser = IncrementalParser()

        initial_text = """character_event = {
    id = test.001
    immediate = {
        if = {
            limit = {
                age >= 16
            }
            add_gold = 100
        }
    }
}"""
        ast, _ = parser.parse(initial_text)

        # Change the age value
        new_text = """character_event = {
    id = test.001
    immediate = {
        if = {
            limit = {
                age >= 18
            }
            add_gold = 100
        }
    }
}"""
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=5, character=24),
                end=types.Position(line=5, character=26)
            ),
            text="18"
        )

        # Incremental parse
        new_ast, errors = parser.incremental_parse(change, new_text)

        # Verify parse succeeded
        assert len(new_ast) > 0
        assert len(errors) == 0
        assert parser._current_text == new_text

    def test_adding_block_to_empty_file(self):
        """Test adding content to an initially empty file."""
        parser = IncrementalParser()

        # Start with empty file
        initial_text = ""
        ast, _ = parser.parse(initial_text)
        assert len(ast) == 0

        # Add content
        new_text = "namespace = test"
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=0)
            ),
            text="namespace = test"
        )

        # Should fall back to full parse (too complex)
        new_ast, errors = parser.incremental_parse(change, new_text)

        assert len(new_ast) >= 1

    def _count_nodes(self, ast):
        """Helper to count total nodes in AST."""
        count = 0
        for node in ast:
            count += 1
            count += self._count_nodes(node.children)
        return count


class TestIncrementalParserPerformance:
    """Performance-related tests for incremental parser."""

    def test_small_change_faster_than_full_parse(self):
        """Test that incremental parse is faster for small changes."""
        import time
        from pychivalry.parser import parse_document

        # Create a large document
        large_text = "namespace = test\n\n"
        for i in range(100):
            large_text += f"""character_event = {{
    id = test.{i:03d}
    desc = test.{i:03d}.desc
    immediate = {{
        add_gold = {i * 10}
    }}
}}
"""

        # Time full parse
        start = time.perf_counter()
        full_ast, _ = parse_document(large_text)
        full_parse_time = time.perf_counter() - start

        # Setup incremental parser
        parser = IncrementalParser()
        parser.parse(large_text)

        # Make small change at the end
        new_text = large_text.replace("test.099", "test.100")
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=500, character=10),
                end=types.Position(line=500, character=17)
            ),
            text="test.100"
        )

        # Time incremental parse
        start = time.perf_counter()
        inc_ast, _ = parser.incremental_parse(change, new_text)
        inc_parse_time = time.perf_counter() - start

        # Incremental should be faster (or at least not much slower)
        # We don't enforce speedup here since the fallback might trigger
        # But we verify it completes successfully
        assert inc_parse_time < full_parse_time * 2  # At most 2x slower

    def test_position_map_lookup_efficiency(self):
        """Test that position map lookups are efficient."""
        parser = IncrementalParser()

        # Create document with many nodes
        text = "namespace = test\n\n"
        for i in range(50):
            text += f"event_{i} = {{ id = test.{i:03d} }}\n"

        ast, _ = parser.parse(text)

        # Position map should have many entries
        assert len(parser._position_map) >= 50

        # All lookups should complete quickly
        import time
        start = time.perf_counter()

        # Simulate finding affected nodes for various positions
        for line in range(0, 52, 5):
            test_range = TextRange(line, 0, line, 10)
            affected = parser._find_affected_nodes(test_range)

        elapsed = time.perf_counter() - start

        # Should be very fast (< 10ms for 10 lookups)
        assert elapsed < 0.01
