"""
Unit tests for schema-based completions and hover.

Tests that field_docs from schemas are properly converted to
LSP completions and hover documentation.
"""

import pytest
from pychivalry.schema_loader import SchemaLoader
from pychivalry.schema_completions import SchemaCompletionProvider, get_schema_completions
from pychivalry.schema_hover import SchemaHoverProvider, get_schema_hover
from lsprotocol.types import CompletionItemKind, InsertTextFormat, MarkupKind


@pytest.fixture
def schema_loader():
    """Create and load a schema loader."""
    loader = SchemaLoader()
    loader.load_all()
    return loader


@pytest.fixture
def completion_provider(schema_loader):
    """Create a completion provider."""
    return SchemaCompletionProvider(schema_loader)


@pytest.fixture
def hover_provider(schema_loader):
    """Create a hover provider."""
    return SchemaHoverProvider(schema_loader)


class TestSchemaCompletions:
    """Test schema-based completions."""

    def test_get_event_field_completions(self, completion_provider):
        """Test getting field completions for events."""
        completions = completion_provider.get_field_completions('events/test.txt')
        
        assert len(completions) > 0
        
        # Check that expected fields are present
        labels = [c.label for c in completions]
        assert 'type' in labels
        assert 'title' in labels
        assert 'desc' in labels
        assert 'immediate' in labels
        assert 'option' in labels

    def test_event_type_completion(self, completion_provider):
        """Test that type field completion has proper details."""
        completions = completion_provider.get_field_completions('events/test.txt')
        
        type_completion = next((c for c in completions if c.label == 'type'), None)
        assert type_completion is not None
        assert type_completion.kind == CompletionItemKind.Field
        assert type_completion.insert_text_format == InsertTextFormat.Snippet
        assert 'character_event' in type_completion.insert_text
        assert type_completion.documentation is not None

    def test_event_snippet_completion(self, completion_provider):
        """Test that snippet completions have proper format."""
        completions = completion_provider.get_field_completions('events/test.txt')
        
        immediate_completion = next((c for c in completions if c.label == 'immediate'), None)
        assert immediate_completion is not None
        assert '$0' in immediate_completion.insert_text or '${' in immediate_completion.insert_text
        assert '{' in immediate_completion.insert_text

    def test_story_cycle_field_completions(self, completion_provider):
        """Test getting field completions for story cycles."""
        completions = completion_provider.get_field_completions('common/story_cycles/test.txt')
        
        assert len(completions) > 0
        
        labels = [c.label for c in completions]
        assert 'on_setup' in labels
        assert 'on_end' in labels
        assert 'on_owner_death' in labels
        assert 'effect_group' in labels

    def test_enum_value_completions(self, completion_provider):
        """Test getting completions for enum field values."""
        completions = completion_provider.get_enum_value_completions('events/test.txt', 'type')
        
        assert len(completions) > 0
        
        labels = [c.label for c in completions]
        assert 'character_event' in labels
        assert 'letter_event' in labels
        assert 'court_event' in labels
        
        # Check completion kind
        for completion in completions:
            assert completion.kind == CompletionItemKind.EnumMember

    def test_no_completions_for_unknown_file_type(self, completion_provider):
        """Test that no completions are returned for unknown file types."""
        completions = completion_provider.get_field_completions('unknown/test.txt')
        
        assert len(completions) == 0

    def test_convenience_function(self, schema_loader):
        """Test the convenience function for getting completions."""
        completions = get_schema_completions('events/test.txt', schema_loader)
        
        assert len(completions) > 0
        assert any(c.label == 'type' for c in completions)


class TestSchemaHover:
    """Test schema-based hover documentation."""

    def test_get_event_field_hover(self, hover_provider):
        """Test getting hover for event fields."""
        hover = hover_provider.get_field_hover('events/test.txt', 'type')
        
        assert hover is not None
        assert hover.contents is not None
        assert hover.contents.kind == MarkupKind.Markdown
        assert 'type' in hover.contents.value
        assert 'event type' in hover.contents.value.lower()

    def test_hover_includes_description(self, hover_provider):
        """Test that hover includes field description."""
        hover = hover_provider.get_field_hover('events/test.txt', 'immediate')
        
        assert hover is not None
        assert 'immediately' in hover.contents.value.lower()
        assert 'effect' in hover.contents.value.lower()

    def test_hover_includes_detail(self, hover_provider):
        """Test that hover includes field detail."""
        hover = hover_provider.get_field_hover('events/test.txt', 'title')
        
        assert hover is not None
        assert 'localization' in hover.contents.value.lower()

    def test_story_cycle_field_hover(self, hover_provider):
        """Test getting hover for story cycle fields."""
        hover = hover_provider.get_field_hover('common/story_cycles/test.txt', 'on_setup')
        
        assert hover is not None
        assert 'on_setup' in hover.contents.value
        assert 'created' in hover.contents.value.lower() or 'initialization' in hover.contents.value.lower()

    def test_hover_for_nonexistent_field(self, hover_provider):
        """Test that hover returns None for nonexistent fields."""
        hover = hover_provider.get_field_hover('events/test.txt', 'nonexistent_field')
        
        assert hover is None

    def test_no_hover_for_unknown_file_type(self, hover_provider):
        """Test that no hover is returned for unknown file types."""
        hover = hover_provider.get_field_hover('unknown/test.txt', 'type')
        
        assert hover is None

    def test_enum_value_hover(self, hover_provider):
        """Test getting hover for enum field values."""
        hover = hover_provider.get_enum_value_hover('events/test.txt', 'type', 'character_event')
        
        assert hover is not None
        assert 'character_event' in hover.contents.value
        assert 'type' in hover.contents.value

    def test_convenience_function(self, schema_loader):
        """Test the convenience function for getting hover."""
        hover = get_schema_hover('events/test.txt', 'type', schema_loader)
        
        assert hover is not None
        assert 'type' in hover.contents.value


class TestSchemaCompletionsIntegration:
    """Integration tests for schema completions."""

    def test_completions_match_schema_fields(self, completion_provider, schema_loader):
        """Test that completions match the fields defined in schema."""
        schema = schema_loader.get_schema_for_file('events/test.txt')
        assert schema is not None
        
        field_docs = schema.get('field_docs', {})
        completions = completion_provider.get_field_completions('events/test.txt')
        
        completion_labels = {c.label for c in completions}
        
        # All field_docs should have corresponding completions
        for field_name in field_docs.keys():
            assert field_name in completion_labels, f"Missing completion for {field_name}"

    def test_hover_matches_schema_fields(self, hover_provider, schema_loader):
        """Test that hover works for all fields defined in schema."""
        schema = schema_loader.get_schema_for_file('events/test.txt')
        assert schema is not None
        
        field_docs = schema.get('field_docs', {})
        
        # All field_docs should have working hover
        for field_name in field_docs.keys():
            hover = hover_provider.get_field_hover('events/test.txt', field_name)
            assert hover is not None, f"Missing hover for {field_name}"
            assert field_name in hover.contents.value


class TestSchemaBasedFeatures:
    """Test that schema-based features work correctly."""

    def test_completion_priority(self, completion_provider):
        """Test that schema completions have proper priority sorting."""
        completions = completion_provider.get_field_completions('events/test.txt')
        
        # All completions should have sort_text starting with "1_" for priority
        for completion in completions:
            assert completion.sort_text.startswith('1_'), \
                f"Completion {completion.label} doesn't have priority sorting"

    def test_markdown_formatting(self, hover_provider):
        """Test that hover uses proper Markdown formatting."""
        hover = hover_provider.get_field_hover('events/test.txt', 'type')
        
        assert hover is not None
        # Should have Markdown formatting
        assert '**' in hover.contents.value or '_' in hover.contents.value or '`' in hover.contents.value
