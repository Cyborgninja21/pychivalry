"""
Tests for CK3 Navigation Module

Tests "Go to Definition" and "Find References" functionality.
"""

import pytest
from lsprotocol import types
from pychivalry.navigation import (
    is_navigable_symbol,
    create_definition_location,
    create_reference,
    find_event_definition,
    find_scripted_effect_definition,
    find_scripted_trigger_definition,
    find_saved_scope_definition,
    find_script_value_definition,
    find_all_references,
    convert_to_lsp_location,
    convert_to_lsp_location_link,
    get_symbol_at_position,
    DefinitionLocation,
    Reference,
)


class TestIsNavigableSymbol:
    """Test navigable symbol type checking."""

    def test_navigable_types(self):
        """Test all navigable symbol types."""
        navigable = [
            "event",
            "scripted_effect",
            "scripted_trigger",
            "saved_scope",
            "script_value",
            "localization_key",
            "on_action",
        ]
        for symbol_type in navigable:
            assert is_navigable_symbol(symbol_type) is True

    def test_non_navigable_type(self):
        """Test non-navigable symbol type."""
        assert is_navigable_symbol("unknown_type") is False
        assert is_navigable_symbol("variable") is False


class TestCreateDefinitionLocation:
    """Test creating definition location objects."""

    def test_create_simple_location(self):
        """Test creating simple definition location."""
        loc = create_definition_location("file:///test.txt", 10, 5, "event", "test.0001")
        assert loc.uri == "file:///test.txt"
        assert loc.symbol_type == "event"
        assert loc.symbol_name == "test.0001"
        assert loc.range.start.line == 10
        assert loc.range.start.character == 5

    def test_create_with_symbol_length(self):
        """Test that range includes full symbol."""
        loc = create_definition_location("file:///test.txt", 0, 0, "event", "my_event")
        assert loc.range.end.character == 8  # len('my_event')


class TestCreateReference:
    """Test creating reference objects."""

    def test_create_simple_reference(self):
        """Test creating simple reference."""
        ref = create_reference("file:///test.txt", 5, 10, 8, "reference")
        assert ref.uri == "file:///test.txt"
        assert ref.range.start.line == 5
        assert ref.range.start.character == 10
        assert ref.range.end.character == 18  # 10 + 8
        assert ref.context == "reference"

    def test_default_context(self):
        """Test default context is 'reference'."""
        ref = create_reference("file:///test.txt", 0, 0, 5)
        assert ref.context == "reference"


class TestFindEventDefinition:
    """Test finding event definitions."""

    def test_find_existing_event(self):
        """Test finding an existing event."""
        index = {
            "events": {
                "test.0001": {
                    "uri": "file:///events.txt",
                    "range": types.Range(
                        start=types.Position(line=10, character=0),
                        end=types.Position(line=10, character=10),
                    ),
                }
            }
        }
        loc = find_event_definition("test.0001", index)
        assert loc is not None
        assert loc.uri == "file:///events.txt"
        assert loc.symbol_type == "event"
        assert loc.symbol_name == "test.0001"

    def test_find_nonexistent_event(self):
        """Test finding non-existent event."""
        index = {"events": {}}
        loc = find_event_definition("unknown.0001", index)
        assert loc is None

    def test_empty_index(self):
        """Test with empty index."""
        index = {}
        loc = find_event_definition("test.0001", index)
        assert loc is None


class TestFindScriptedEffectDefinition:
    """Test finding scripted effect definitions."""

    def test_find_existing_effect(self):
        """Test finding an existing effect."""
        index = {
            "scripted_effects": {
                "my_effect": {
                    "uri": "file:///effects.txt",
                    "range": types.Range(
                        start=types.Position(line=5, character=0),
                        end=types.Position(line=5, character=9),
                    ),
                }
            }
        }
        loc = find_scripted_effect_definition("my_effect", index)
        assert loc is not None
        assert loc.uri == "file:///effects.txt"
        assert loc.symbol_type == "scripted_effect"
        assert loc.symbol_name == "my_effect"

    def test_find_nonexistent_effect(self):
        """Test finding non-existent effect."""
        index = {"scripted_effects": {}}
        loc = find_scripted_effect_definition("unknown_effect", index)
        assert loc is None


class TestFindScriptedTriggerDefinition:
    """Test finding scripted trigger definitions."""

    def test_find_existing_trigger(self):
        """Test finding an existing trigger."""
        index = {
            "scripted_triggers": {
                "my_trigger": {
                    "uri": "file:///triggers.txt",
                    "range": types.Range(
                        start=types.Position(line=3, character=0),
                        end=types.Position(line=3, character=10),
                    ),
                }
            }
        }
        loc = find_scripted_trigger_definition("my_trigger", index)
        assert loc is not None
        assert loc.uri == "file:///triggers.txt"
        assert loc.symbol_type == "scripted_trigger"

    def test_find_nonexistent_trigger(self):
        """Test finding non-existent trigger."""
        index = {"scripted_triggers": {}}
        loc = find_scripted_trigger_definition("unknown_trigger", index)
        assert loc is None


class TestFindSavedScopeDefinition:
    """Test finding saved scope definitions."""

    def test_find_scope_in_current_document(self):
        """Test finding scope in current document."""
        current_uri = "file:///test.txt"
        index = {
            "saved_scopes": {
                "my_target": [
                    {
                        "uri": current_uri,
                        "range": types.Range(
                            start=types.Position(line=5, character=0),
                            end=types.Position(line=5, character=9),
                        ),
                    },
                    {
                        "uri": "file:///other.txt",
                        "range": types.Range(
                            start=types.Position(line=10, character=0),
                            end=types.Position(line=10, character=9),
                        ),
                    },
                ]
            }
        }
        loc = find_saved_scope_definition("my_target", index, current_uri)
        assert loc is not None
        assert loc.uri == current_uri  # Prefers current document
        assert loc.symbol_type == "saved_scope"

    def test_find_scope_in_other_document(self):
        """Test finding scope in other document."""
        index = {
            "saved_scopes": {
                "my_target": [
                    {
                        "uri": "file:///other.txt",
                        "range": types.Range(
                            start=types.Position(line=5, character=0),
                            end=types.Position(line=5, character=9),
                        ),
                    }
                ]
            }
        }
        loc = find_saved_scope_definition("my_target", index, "file:///test.txt")
        assert loc is not None
        assert loc.uri == "file:///other.txt"

    def test_find_nonexistent_scope(self):
        """Test finding non-existent scope."""
        index = {"saved_scopes": {}}
        loc = find_saved_scope_definition("unknown_scope", index, "file:///test.txt")
        assert loc is None


class TestFindScriptValueDefinition:
    """Test finding script value definitions."""

    def test_find_existing_value(self):
        """Test finding an existing script value."""
        index = {
            "script_values": {
                "my_value": {
                    "uri": "file:///values.txt",
                    "range": types.Range(
                        start=types.Position(line=2, character=0),
                        end=types.Position(line=2, character=8),
                    ),
                }
            }
        }
        loc = find_script_value_definition("my_value", index)
        assert loc is not None
        assert loc.uri == "file:///values.txt"
        assert loc.symbol_type == "script_value"

    def test_find_nonexistent_value(self):
        """Test finding non-existent value."""
        index = {"script_values": {}}
        loc = find_script_value_definition("unknown_value", index)
        assert loc is None


class TestFindAllReferences:
    """Test finding all references to a symbol."""

    def test_find_references(self):
        """Test finding references to a symbol."""
        index = {
            "references": {
                "event": {
                    "test.0001": [
                        {
                            "uri": "file:///a.txt",
                            "line": 5,
                            "character": 10,
                            "context": "reference",
                        },
                        {"uri": "file:///b.txt", "line": 3, "character": 5, "context": "reference"},
                    ]
                }
            }
        }
        refs = find_all_references("test.0001", "event", index)
        assert len(refs) == 2
        assert refs[0].uri == "file:///a.txt"
        assert refs[1].uri == "file:///b.txt"

    def test_find_references_with_declaration(self):
        """Test including declaration in references."""
        index = {
            "references": {
                "event": {
                    "test.0001": [
                        {
                            "uri": "file:///a.txt",
                            "line": 0,
                            "character": 0,
                            "context": "declaration",
                        },
                        {"uri": "file:///b.txt", "line": 3, "character": 5, "context": "reference"},
                    ]
                }
            }
        }
        refs = find_all_references("test.0001", "event", index, include_declaration=True)
        assert len(refs) == 2

        refs_no_decl = find_all_references("test.0001", "event", index, include_declaration=False)
        assert len(refs_no_decl) == 1

    def test_find_no_references(self):
        """Test finding no references."""
        index = {"references": {}}
        refs = find_all_references("test.0001", "event", index)
        assert len(refs) == 0


class TestConvertToLspLocation:
    """Test converting to LSP Location format."""

    def test_convert_location(self):
        """Test converting definition location to LSP location."""
        def_loc = DefinitionLocation(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=5, character=10), end=types.Position(line=5, character=20)
            ),
            symbol_type="event",
            symbol_name="test.0001",
        )
        lsp_loc = convert_to_lsp_location(def_loc)
        assert isinstance(lsp_loc, types.Location)
        assert lsp_loc.uri == "file:///test.txt"
        assert lsp_loc.range.start.line == 5


class TestConvertToLspLocationLink:
    """Test converting to LSP LocationLink format."""

    def test_convert_location_link(self):
        """Test converting to location link."""
        def_loc = DefinitionLocation(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=5, character=10), end=types.Position(line=5, character=20)
            ),
            symbol_type="event",
            symbol_name="test.0001",
        )
        origin_range = types.Range(
            start=types.Position(line=1, character=5), end=types.Position(line=1, character=15)
        )
        link = convert_to_lsp_location_link(def_loc, origin_range)
        assert isinstance(link, types.LocationLink)
        assert link.target_uri == "file:///test.txt"
        assert link.origin_selection_range == origin_range


class TestGetSymbolAtPosition:
    """Test getting symbol at position."""

    def test_get_simple_symbol(self):
        """Test getting simple symbol."""
        text = "my_event = { }"
        result = get_symbol_at_position(text, 0, 3)
        assert result is not None
        symbol, symbol_type = result
        assert "my_event" in symbol or "my" in symbol

    def test_get_saved_scope(self):
        """Test getting saved scope symbol."""
        text = "scope:my_target = { }"
        result = get_symbol_at_position(text, 0, 8)
        assert result is not None
        symbol, symbol_type = result
        assert symbol_type == "saved_scope"

    def test_get_event_id(self):
        """Test getting event ID symbol."""
        text = "trigger_event = test.0001"
        result = get_symbol_at_position(text, 0, 18)
        assert result is not None
        symbol, symbol_type = result
        if "." in symbol:
            # Might be identified as event
            assert symbol_type in ("event", "unknown")

    def test_position_out_of_bounds(self):
        """Test position out of bounds."""
        text = "test"
        result = get_symbol_at_position(text, 10, 0)
        assert result is None

        result = get_symbol_at_position(text, 0, 100)
        assert result is None


class TestNavigationIntegration:
    """Integration tests for navigation."""

    def test_complete_navigation_workflow(self):
        """Test complete workflow for navigation."""
        # Create index with event definition
        index = {
            "events": {
                "test.0001": {
                    "uri": "file:///events.txt",
                    "range": types.Range(
                        start=types.Position(line=10, character=0),
                        end=types.Position(line=10, character=10),
                    ),
                }
            },
            "references": {
                "event": {
                    "test.0001": [
                        {
                            "uri": "file:///usage.txt",
                            "line": 5,
                            "character": 10,
                            "context": "reference",
                        },
                    ]
                }
            },
        }

        # Find definition
        definition = find_event_definition("test.0001", index)
        assert definition is not None
        assert definition.uri == "file:///events.txt"

        # Find references
        refs = find_all_references("test.0001", "event", index)
        assert len(refs) == 1
        assert refs[0].uri == "file:///usage.txt"

        # Convert to LSP format
        lsp_loc = convert_to_lsp_location(definition)
        assert isinstance(lsp_loc, types.Location)
