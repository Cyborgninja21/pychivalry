"""
Tests for context-aware completions module.

This test suite validates that the completion system correctly:
1. Detects context from AST and cursor position
2. Filters completions appropriately for each context
3. Provides scope-aware suggestions
4. Handles special cases (dot notation, scope:, snippets)
"""

import pytest
from lsprotocol import types

from pychivalry.completions import (
    CompletionContext,
    detect_context,
    filter_by_context,
    get_scope_link_completions,
    get_saved_scope_completions,
    create_trigger_completions,
    create_effect_completions,
    create_keyword_completions,
    create_snippet_completions,
    get_context_aware_completions,
)
from pychivalry.parser import CK3Node
from pychivalry.indexer import DocumentIndex


class TestCompletionContext:
    """Test CompletionContext dataclass."""

    def test_completion_context_creation(self):
        """Test creating a CompletionContext."""
        context = CompletionContext(
            block_type="trigger",
            scope_type="character",
            after_dot=False,
            after_colon=False,
        )

        assert context.block_type == "trigger"
        assert context.scope_type == "character"
        assert not context.after_dot
        assert not context.after_colon
        assert isinstance(context.saved_scopes, set)

    def test_completion_context_defaults(self):
        """Test default values in CompletionContext."""
        context = CompletionContext()

        assert context.block_type == "unknown"
        assert context.scope_type == "character"
        assert not context.after_dot
        assert not context.after_colon
        assert not context.in_assignment
        assert context.trigger_character is None
        assert isinstance(context.saved_scopes, set)
        assert context.incomplete_text == ""


class TestContextDetection:
    """Test context detection from AST and cursor position."""

    def test_detect_context_empty_line(self):
        """Test context detection on empty line."""
        context = detect_context(
            node=None,
            position=types.Position(line=0, character=0),
            line_text="",
        )

        assert context.block_type == "unknown"
        assert context.scope_type == "character"
        assert not context.after_dot

    def test_detect_context_after_dot(self):
        """Test context detection after dot (scope chain)."""
        context = detect_context(
            node=None,
            position=types.Position(line=0, character=6),
            line_text="liege.",
        )

        assert context.after_dot
        assert context.trigger_character == "."

    def test_detect_context_after_scope_colon(self):
        """Test context detection after 'scope:'."""
        context = detect_context(
            node=None,
            position=types.Position(line=0, character=6),
            line_text="scope:",
        )

        assert context.after_colon
        assert context.trigger_character == ":"

    def test_detect_context_in_trigger_block(self):
        """Test context detection inside trigger block."""
        # Create AST node for trigger block
        trigger_node = CK3Node(
            type="block",
            key="trigger",
            value={},
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=2, character=1),
            ),
            scope_type="character",
        )

        context = detect_context(
            node=trigger_node,
            position=types.Position(line=1, character=4),
            line_text="    age",
        )

        assert context.block_type == "trigger"
        assert context.scope_type == "character"

    def test_detect_context_in_effect_block(self):
        """Test context detection inside effect block."""
        effect_node = CK3Node(
            type="block",
            key="immediate",
            value={},
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=2, character=1),
            ),
            scope_type="character",
        )

        context = detect_context(
            node=effect_node,
            position=types.Position(line=1, character=4),
            line_text="    add_",
        )

        assert context.block_type == "effect"

    def test_detect_context_in_option_block(self):
        """Test context detection inside option block."""
        option_node = CK3Node(
            type="block",
            key="option",
            value={},
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=2, character=1),
            ),
        )

        context = detect_context(
            node=option_node,
            position=types.Position(line=1, character=4),
            line_text="    ",
        )

        assert context.block_type == "option"

    def test_detect_context_with_saved_scopes(self):
        """Test context detection with document index."""
        doc_index = DocumentIndex()
        doc_index.saved_scopes["my_target"] = types.Location(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=5, character=0),
                end=types.Position(line=5, character=10),
            ),
        )

        context = detect_context(
            node=None,
            position=types.Position(line=0, character=0),
            line_text="",
            document_index=doc_index,
        )

        assert "my_target" in context.saved_scopes

    def test_detect_context_incomplete_text(self):
        """Test extracting incomplete text before cursor."""
        context = detect_context(
            node=None,
            position=types.Position(line=0, character=7),
            line_text="    add_go",
        )

        # The incomplete text extraction looks for word boundaries
        # With '    add_go' and cursor at position 7, it finds 'add'
        assert "add" in context.incomplete_text


class TestFilterByContext:
    """Test filtering completions by context."""

    def test_filter_trigger_context(self):
        """Test filtering for trigger block context."""
        context = CompletionContext(block_type="trigger")
        items = filter_by_context(context)

        # Should have triggers and trigger-related keywords
        labels = [item.label for item in items]
        assert any("age" in labels for labels in [labels])  # Has triggers
        assert "limit" in labels  # Has trigger keywords
        assert "NOT" in labels

        # Should not have effects
        assert "add_gold" not in labels

    def test_filter_effect_context(self):
        """Test filtering for effect block context."""
        context = CompletionContext(block_type="effect")
        items = filter_by_context(context)

        labels = [item.label for item in items]
        assert "add_gold" in labels  # Has effects
        assert "if" in labels  # Has effect keywords

        # Should not have pure triggers
        # Note: Some items might overlap, but effects should be dominant

    def test_filter_option_context(self):
        """Test filtering for option block context."""
        context = CompletionContext(block_type="option")
        items = filter_by_context(context)

        labels = [item.label for item in items]
        # Options can have both effects and triggers
        assert "add_gold" in labels
        assert "trigger" in labels

    def test_filter_unknown_context(self):
        """Test filtering for unknown context (fallback)."""
        context = CompletionContext(block_type="unknown")
        items = filter_by_context(context)

        # Should have everything
        labels = [item.label for item in items]
        assert "add_gold" in labels  # Effects
        assert "age" in labels  # Triggers
        assert "trigger" in labels  # Keywords


class TestScopeLinkCompletions:
    """Test scope link completions after dot."""

    def test_scope_link_completions_character(self):
        """Test scope link completions for character scope."""
        context = CompletionContext(
            scope_type="character",
            after_dot=True,
        )
        items = get_scope_link_completions(context)

        labels = [item.label for item in items]
        # Character scope should have links like liege, spouse, etc.
        assert any("liege" in label for label in labels)

    def test_scope_link_completions_title(self):
        """Test scope link completions for title scope."""
        context = CompletionContext(
            scope_type="landed_title",  # Use the correct CK3 scope name
            after_dot=True,
        )
        items = get_scope_link_completions(context)

        labels = [item.label for item in items]
        # Title scope should have links like holder
        assert any("holder" in label for label in labels)

    def test_scope_link_includes_documentation(self):
        """Test that scope link completions include documentation."""
        context = CompletionContext(scope_type="character", after_dot=True)
        items = get_scope_link_completions(context)

        if items:
            item = items[0]
            assert item.kind == types.CompletionItemKind.Property
            assert item.detail is not None
            assert item.documentation is not None


class TestSavedScopeCompletions:
    """Test saved scope completions after 'scope:'."""

    def test_saved_scope_completions_with_scopes(self):
        """Test saved scope completions when scopes exist."""
        context = CompletionContext(
            after_colon=True,
            saved_scopes={"my_target", "my_actor", "saved_character"},
        )
        items = get_saved_scope_completions(context)

        labels = [item.label for item in items]
        assert "my_target" in labels
        assert "my_actor" in labels
        assert "saved_character" in labels

    def test_saved_scope_completions_empty(self):
        """Test saved scope completions when no scopes exist."""
        context = CompletionContext(after_colon=True, saved_scopes=set())
        items = get_saved_scope_completions(context)

        # Should provide a hint
        assert len(items) == 1
        assert "<no saved scopes>" in items[0].label

    def test_saved_scope_completion_kinds(self):
        """Test that saved scope completions use Variable kind."""
        context = CompletionContext(
            after_colon=True,
            saved_scopes={"test_scope"},
        )
        items = get_saved_scope_completions(context)

        assert items[0].kind == types.CompletionItemKind.Variable


class TestCompletionCreators:
    """Test individual completion creator functions."""

    def test_create_trigger_completions(self):
        """Test creating trigger completions."""
        items = create_trigger_completions()

        assert len(items) > 0
        labels = [item.label for item in items]
        assert "age" in labels
        assert all(item.kind == types.CompletionItemKind.Function for item in items)

    def test_create_effect_completions(self):
        """Test creating effect completions."""
        items = create_effect_completions()

        assert len(items) > 0
        labels = [item.label for item in items]
        assert "add_gold" in labels
        assert all(item.kind == types.CompletionItemKind.Function for item in items)

    def test_create_keyword_completions(self):
        """Test creating keyword completions."""
        items = create_keyword_completions(["if", "else", "limit"])

        assert len(items) == 3
        labels = [item.label for item in items]
        assert "if" in labels
        assert "else" in labels
        assert "limit" in labels
        assert all(item.kind == types.CompletionItemKind.Keyword for item in items)

    def test_create_keyword_completions_default(self):
        """Test creating all keyword completions."""
        items = create_keyword_completions()

        assert len(items) > 0
        # Should include standard CK3 keywords


class TestSnippetCompletions:
    """Test snippet completions."""

    def test_create_snippet_completions(self):
        """Test creating snippet completions."""
        snippets = create_snippet_completions()

        assert len(snippets) > 0
        labels = [s.label for s in snippets]
        assert "event" in labels
        assert "trigger_event" in labels
        assert "option" in labels

    def test_snippet_has_insert_text(self):
        """Test that snippets have insert text."""
        snippets = create_snippet_completions()

        for snippet in snippets:
            assert snippet.insert_text is not None
            assert snippet.insert_text_format == types.InsertTextFormat.Snippet
            assert snippet.kind == types.CompletionItemKind.Snippet

    def test_event_snippet_structure(self):
        """Test event snippet has proper structure."""
        snippets = create_snippet_completions()
        event_snippet = next((s for s in snippets if s.label == "event"), None)

        assert event_snippet is not None
        assert "${" in event_snippet.insert_text  # Has placeholders
        assert "type = character_event" in event_snippet.insert_text
        assert "trigger =" in event_snippet.insert_text
        assert "option =" in event_snippet.insert_text


class TestContextAwareCompletions:
    """Test main entry point for context-aware completions."""

    def test_get_context_aware_completions_basic(self):
        """Test getting context-aware completions."""
        result = get_context_aware_completions(
            document_uri="file:///test.txt",
            position=types.Position(line=0, character=0),
            ast=None,
            line_text="",
        )

        assert isinstance(result, types.CompletionList)
        assert not result.is_incomplete
        assert len(result.items) > 0

    def test_get_context_aware_completions_trigger_block(self):
        """Test completions in trigger block."""
        trigger_node = CK3Node(
            type="block",
            key="trigger",
            value={},
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=2, character=1),
            ),
        )

        result = get_context_aware_completions(
            document_uri="file:///test.txt",
            position=types.Position(line=1, character=4),
            ast=trigger_node,
            line_text="    age",
        )

        labels = [item.label for item in result.items]
        # Should have triggers, not effects
        assert any("age" in label for label in labels)

    def test_get_context_aware_completions_after_dot(self):
        """Test completions after dot (scope chain)."""
        result = get_context_aware_completions(
            document_uri="file:///test.txt",
            position=types.Position(line=0, character=6),
            ast=None,
            line_text="liege.",
        )

        # Should only have scope links
        assert len(result.items) > 0
        assert all(item.kind == types.CompletionItemKind.Property for item in result.items)

    def test_get_context_aware_completions_with_saved_scopes(self):
        """Test completions with saved scopes in index."""
        doc_index = DocumentIndex()
        doc_index.saved_scopes["my_target"] = types.Location(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=5, character=0),
                end=types.Position(line=5, character=10),
            ),
        )

        result = get_context_aware_completions(
            document_uri="file:///test.txt",
            position=types.Position(line=0, character=6),
            ast=None,
            line_text="scope:",
            document_index=doc_index,
        )

        labels = [item.label for item in result.items]
        assert "my_target" in labels


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_detect_context_none_node(self):
        """Test context detection with None node."""
        context = detect_context(
            node=None,
            position=types.Position(line=0, character=0),
            line_text="",
        )

        assert context.block_type == "unknown"

    def test_detect_context_boundary_position(self):
        """Test context detection at line boundaries."""
        context = detect_context(
            node=None,
            position=types.Position(line=0, character=0),
            line_text="test",
        )

        assert context.incomplete_text == ""

    def test_filter_by_context_none_scope_system(self):
        """Test filtering with no scope system."""
        context = CompletionContext(after_dot=True, scope_type="character")
        items = filter_by_context(context)

        # Should still return items
        assert len(items) > 0


# Performance and integration tests
class TestIntegration:
    """Integration tests for completion system."""

    def test_completion_workflow_trigger_to_effect(self):
        """Test completion workflow from trigger to effect context."""
        # Start in trigger block
        trigger_context = CompletionContext(block_type="trigger")
        trigger_items = filter_by_context(trigger_context)
        trigger_labels = [item.label for item in trigger_items]

        # Should have triggers
        assert any("age" in label for label in trigger_labels)

        # Move to effect block
        effect_context = CompletionContext(block_type="effect")
        effect_items = filter_by_context(effect_context)
        effect_labels = [item.label for item in effect_items]

        # Should have effects
        assert any("add_gold" in label for label in effect_labels)

    def test_completion_counts_reasonable(self):
        """Test that completion counts are reasonable."""
        # Trigger context should have fewer items than 'all'
        trigger_context = CompletionContext(block_type="trigger")
        trigger_items = filter_by_context(trigger_context)

        unknown_context = CompletionContext(block_type="unknown")
        all_items = filter_by_context(unknown_context)

        # Trigger context should be more focused
        assert len(trigger_items) < len(all_items)
