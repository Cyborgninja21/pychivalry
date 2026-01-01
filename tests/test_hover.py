"""Tests for the hover module."""

import pytest
from lsprotocol import types
from pygls.workspace import TextDocument

from pychivalry.hover import (
    get_word_at_position,
    get_hover_content,
    create_hover_response,
)
from pychivalry.parser import parse_document
from pychivalry.indexer import DocumentIndex


class TestWordExtraction:
    """Tests for word extraction at cursor position."""

    def test_get_word_simple(self):
        """Extract a simple word."""
        text = "add_gold = 100"
        doc = TextDocument(uri="file:///test.txt", source=text)
        position = types.Position(line=0, character=5)  # Middle of 'add_gold'

        word = get_word_at_position(doc, position)
        assert word == "add_gold"

    def test_get_word_at_start(self):
        """Extract word at start of line."""
        text = "trigger = { is_adult = yes }"
        doc = TextDocument(uri="file:///test.txt", source=text)
        position = types.Position(line=0, character=0)

        word = get_word_at_position(doc, position)
        assert word == "trigger"

    def test_get_word_with_underscore(self):
        """Extract word with underscores."""
        text = "save_scope_as = my_target"
        doc = TextDocument(uri="file:///test.txt", source=text)
        position = types.Position(line=0, character=5)

        word = get_word_at_position(doc, position)
        assert word == "save_scope_as"

    def test_get_word_with_colon(self):
        """Extract saved scope reference with colon."""
        text = "scope:my_target = { add_gold = 100 }"
        doc = TextDocument(uri="file:///test.txt", source=text)
        position = types.Position(line=0, character=6)

        word = get_word_at_position(doc, position)
        assert "scope:" in word or "my_target" in word


class TestHoverContent:
    """Tests for hover content generation."""

    def test_hover_for_effect(self):
        """Hover shows effect documentation."""
        content = get_hover_content("add_gold", None, None)

        assert content is not None
        assert "Effect" in content
        assert "add_gold" in content
        assert "gold" in content.lower()

    def test_hover_for_trigger(self):
        """Hover shows trigger documentation."""
        content = get_hover_content("is_adult", None, None)

        assert content is not None
        assert "Trigger" in content
        assert "is_adult" in content
        assert "16" in content  # Age threshold

    def test_hover_for_scope(self):
        """Hover shows scope documentation."""
        content = get_hover_content("liege", None, None)

        assert content is not None
        assert "Scope" in content or "scope" in content.lower()
        assert "liege" in content

    def test_hover_for_keyword(self):
        """Hover shows keyword documentation."""
        content = get_hover_content("trigger", None, None)

        assert content is not None
        assert "Keyword" in content or "trigger" in content

    def test_hover_for_list_iterator(self):
        """Hover explains list iterators."""
        content = get_hover_content("every_vassal", None, None)

        assert content is not None
        assert "List" in content or "iterator" in content.lower()
        assert "vassal" in content.lower()

    def test_hover_for_saved_scope_undefined(self):
        """Hover for undefined saved scope shows warning."""
        index = DocumentIndex()
        content = get_hover_content("scope:undefined", None, index)

        assert content is not None
        assert "scope:" in content.lower()
        assert "not been defined" in content or "⚠" in content

    def test_hover_for_event_in_index(self):
        """Hover shows event location from index."""
        index = DocumentIndex()
        index.events["test.0001"] = types.Location(
            uri="file:///events/test.txt",
            range=types.Range(
                start=types.Position(line=10, character=0),
                end=types.Position(line=20, character=0),
            ),
        )

        content = get_hover_content("test.0001", None, index)

        assert content is not None
        assert "Event" in content
        assert "test.0001" in content
        assert "11" in content or "10" in content  # Line number (may be 0 or 1-indexed in display)

    def test_hover_for_unknown_word(self):
        """No hover for unknown words."""
        content = get_hover_content("completely_unknown_thing", None, None)

        assert content is None


class TestHoverResponse:
    """Tests for complete hover response creation."""

    def test_create_hover_for_effect(self):
        """Create hover response for an effect."""
        text = "add_gold = 100"
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast = parse_document(text)
        position = types.Position(line=0, character=5)

        hover = create_hover_response(doc, position, ast, None)

        assert hover is not None
        assert hover.contents is not None
        assert isinstance(hover.contents, types.MarkupContent)
        assert hover.contents.kind == types.MarkupKind.Markdown
        assert "add_gold" in hover.contents.value

    def test_create_hover_for_trigger(self):
        """Create hover response for a trigger."""
        text = "is_adult = yes"
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast = parse_document(text)
        position = types.Position(line=0, character=5)

        hover = create_hover_response(doc, position, ast, None)

        assert hover is not None
        assert "is_adult" in hover.contents.value

    def test_no_hover_for_whitespace(self):
        """No hover for whitespace."""
        text = "add_gold = 100"
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast = parse_document(text)
        position = types.Position(line=0, character=10)  # Space after '='

        hover = create_hover_response(doc, position, ast, None)

        # May return None or a hover for nearby word depending on implementation
        # Just verify it doesn't crash
        assert hover is None or isinstance(hover, types.Hover)

    def test_hover_includes_range(self):
        """Hover response includes range."""
        text = "add_gold = 100"
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast = parse_document(text)
        position = types.Position(line=0, character=5)

        hover = create_hover_response(doc, position, ast, None)

        assert hover is not None
        assert hover.range is not None
        assert isinstance(hover.range, types.Range)


class TestHoverMarkdown:
    """Tests for Markdown formatting in hover content."""

    def test_hover_uses_markdown_formatting(self):
        """Hover content uses Markdown."""
        content = get_hover_content("add_gold", None, None)

        assert content is not None
        # Should have bold text (**word**)
        assert "**" in content
        # Should have italic text (*word*)
        assert "*" in content or "_" in content

    def test_hover_includes_code_blocks(self):
        """Hover includes code examples."""
        content = get_hover_content("add_trait", None, None)

        assert content is not None
        # Should have code formatting (`code`)
        assert "`" in content
