"""
Tests for rename functionality.

Rename allows refactoring symbols across the workspace with safe updates to:
- Events and their references
- Saved scopes
- Variables
- Flags
- Scripted effects/triggers
- Related localization keys
"""

import os
import tempfile
import pytest
from lsprotocol import types

from pychivalry.rename import (
    get_symbol_at_position,
    prepare_rename,
    find_all_occurrences_in_file,
    find_all_occurrences_workspace,
    find_localization_keys_for_event,
    create_workspace_edit,
    perform_rename,
    RenameLocation,
    _is_valid_name,
)


# =============================================================================
# Test: get_symbol_at_position
# =============================================================================


class TestGetSymbolAtPosition:
    """Tests for symbol detection at cursor position."""
    
    def test_scope_reference(self):
        """Should detect scope:name references."""
        text = "scope:target = { }"
        position = types.Position(line=0, character=7)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, range_ = result
        assert name == "target"
        assert symbol_type == "saved_scope"
    
    def test_scope_definition(self):
        """Should detect save_scope_as definitions."""
        text = "save_scope_as = my_scope"
        position = types.Position(line=0, character=18)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "my_scope"
        assert symbol_type == "saved_scope"
    
    def test_temporary_scope_definition(self):
        """Should detect save_temporary_scope_as."""
        text = "save_temporary_scope_as = temp"
        position = types.Position(line=0, character=28)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "temp"
        assert symbol_type == "saved_scope"
    
    def test_event_id(self):
        """Should detect event IDs."""
        text = "trigger_event = { id = rq.0001 }"
        position = types.Position(line=0, character=25)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "rq.0001"
        assert symbol_type == "event"
    
    def test_variable_reference(self):
        """Should detect var:name references."""
        text = "value = var:counter"
        position = types.Position(line=0, character=14)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "counter"
        assert symbol_type == "variable"
    
    def test_local_variable(self):
        """Should detect local_var:name."""
        text = "local_var:temp = 5"
        position = types.Position(line=0, character=12)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "temp"
        assert symbol_type == "variable"
    
    def test_character_flag(self):
        """Should detect character flag operations."""
        text = "has_character_flag = my_flag"
        position = types.Position(line=0, character=23)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "my_flag"
        assert symbol_type == "character_flag"
    
    def test_global_flag(self):
        """Should detect global flag operations."""
        text = "set_global_flag = game_started"
        position = types.Position(line=0, character=22)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "game_started"
        assert symbol_type == "global_flag"
    
    def test_scripted_effect(self):
        """Should detect scripted effects."""
        text = "my_custom_effect = yes"
        position = types.Position(line=0, character=5)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "my_custom_effect"
        assert symbol_type == "scripted_effect"
    
    def test_scripted_trigger(self):
        """Should detect scripted triggers."""
        text = "can_do_thing_trigger = yes"
        position = types.Position(line=0, character=10)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "can_do_thing_trigger"
        assert symbol_type == "scripted_trigger"
    
    def test_opinion_modifier(self):
        """Should detect opinion modifier references."""
        text = "modifier = grateful_opinion"
        position = types.Position(line=0, character=15)
        
        result = get_symbol_at_position(text, position)
        
        assert result is not None
        name, symbol_type, _ = result
        assert name == "grateful_opinion"
        assert symbol_type == "opinion_modifier"
    
    def test_no_symbol_at_whitespace(self):
        """Should return None when cursor is on whitespace."""
        text = "scope:target   = { }"
        position = types.Position(line=0, character=14)
        
        result = get_symbol_at_position(text, position)
        
        assert result is None
    
    def test_no_symbol_on_invalid_line(self):
        """Should return None for invalid line number."""
        text = "single line"
        position = types.Position(line=5, character=0)
        
        result = get_symbol_at_position(text, position)
        
        assert result is None


# =============================================================================
# Test: prepare_rename
# =============================================================================


class TestPrepareRename:
    """Tests for prepare_rename validation."""
    
    def test_prepare_rename_scope(self):
        """Should return range for scope rename."""
        text = "scope:my_target = { }"
        position = types.Position(line=0, character=8)
        
        result = prepare_rename(text, position)
        
        assert result is not None
        assert result.placeholder == "my_target"
        assert result.range.start.line == 0
    
    def test_prepare_rename_event(self):
        """Should return range for event rename."""
        text = "rq.0001 = {"
        position = types.Position(line=0, character=3)
        
        result = prepare_rename(text, position)
        
        assert result is not None
        assert result.placeholder == "rq.0001"
    
    def test_prepare_rename_not_renamable(self):
        """Should return None for non-renamable positions."""
        text = "# Just a comment"
        position = types.Position(line=0, character=5)
        
        result = prepare_rename(text, position)
        
        assert result is None


# =============================================================================
# Test: find_all_occurrences_in_file
# =============================================================================


class TestFindOccurrencesInFile:
    """Tests for finding occurrences in a single file."""
    
    def test_find_scope_occurrences(self):
        """Should find all scope occurrences."""
        text = """save_scope_as = target
scope:target = { add_gold = 100 }
scope:target = { add_prestige = 50 }"""
        
        locations = find_all_occurrences_in_file(text, "file:///test.txt", "target", "saved_scope")
        
        assert len(locations) >= 3
    
    def test_find_event_occurrences(self):
        """Should find event definition and references."""
        text = """rq.0001 = {
    trigger_event = { id = rq.0001 }
}"""
        
        locations = find_all_occurrences_in_file(text, "file:///test.txt", "rq.0001", "event")
        
        assert len(locations) >= 2
    
    def test_find_variable_occurrences(self):
        """Should find variable definition and references."""
        text = """set_variable = { name = counter value = 1 }
if = { limit = { var:counter >= 5 } }"""
        
        locations = find_all_occurrences_in_file(text, "file:///test.txt", "counter", "variable")
        
        assert len(locations) >= 2
    
    def test_find_flag_occurrences(self):
        """Should find all flag operations."""
        text = """add_character_flag = quest_started
has_character_flag = quest_started
remove_character_flag = quest_started"""
        
        locations = find_all_occurrences_in_file(text, "file:///test.txt", "quest_started", "character_flag")
        
        assert len(locations) >= 3
    
    def test_location_has_correct_range(self):
        """Location range should be accurate."""
        text = "scope:precise_name = yes"
        
        locations = find_all_occurrences_in_file(text, "file:///test.txt", "precise_name", "saved_scope")
        
        assert len(locations) >= 1
        loc = locations[0]
        
        # Extract the text at the range
        start = loc.range.start.character
        end = loc.range.end.character
        extracted = text[start:end]
        
        assert extracted == "precise_name"


# =============================================================================
# Test: create_workspace_edit
# =============================================================================


class TestCreateWorkspaceEdit:
    """Tests for creating WorkspaceEdit from locations."""
    
    def test_creates_text_edits(self):
        """Should create proper TextEdits."""
        locations = [
            RenameLocation(
                uri="file:///test.txt",
                range=types.Range(
                    start=types.Position(line=0, character=6),
                    end=types.Position(line=0, character=12),
                ),
                old_text="target",
                context="reference",
            ),
            RenameLocation(
                uri="file:///test.txt",
                range=types.Range(
                    start=types.Position(line=1, character=16),
                    end=types.Position(line=1, character=22),
                ),
                old_text="target",
                context="definition",
            ),
        ]
        
        edit = create_workspace_edit(locations, "new_target", "target")
        
        assert edit.changes is not None
        assert "file:///test.txt" in edit.changes
        assert len(edit.changes["file:///test.txt"]) == 2
    
    def test_groups_edits_by_file(self):
        """Should group edits by file URI."""
        locations = [
            RenameLocation(
                uri="file:///file1.txt",
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=0, character=5),
                ),
                old_text="scope",
                context="reference",
            ),
            RenameLocation(
                uri="file:///file2.txt",
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=0, character=5),
                ),
                old_text="scope",
                context="reference",
            ),
        ]
        
        edit = create_workspace_edit(locations, "new_scope", "scope")
        
        assert edit.changes is not None
        assert len(edit.changes) == 2
    
    def test_handles_localization_keys(self):
        """Should properly rename localization key prefixes."""
        locations = [
            RenameLocation(
                uri="file:///loc.yml",
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=0, character=12),
                ),
                old_text="rq.0001.desc",
                context="localization",
            ),
        ]
        
        edit = create_workspace_edit(locations, "rq.0002", "rq.0001")
        
        assert edit.changes is not None
        text_edit = edit.changes["file:///loc.yml"][0]
        assert text_edit.new_text == "rq.0002.desc"


# =============================================================================
# Test: perform_rename
# =============================================================================


class TestPerformRename:
    """Tests for the main rename function."""
    
    def test_rename_scope_in_single_file(self):
        """Should rename scope within a single file."""
        text = """save_scope_as = old_name
scope:old_name = { add_gold = 100 }"""
        position = types.Position(line=0, character=18)
        
        edit = perform_rename(text, position, "new_name", "file:///test.txt", [])
        
        assert edit is not None
        assert edit.changes is not None
        assert len(edit.changes.get("file:///test.txt", [])) >= 2
    
    def test_rename_event_in_single_file(self):
        """Should rename event within a single file."""
        text = """rq.0001 = {
    trigger_event = { id = rq.0001 }
}"""
        position = types.Position(line=0, character=3)
        
        edit = perform_rename(text, position, "rq.0002", "file:///test.txt", [])
        
        assert edit is not None
        assert edit.changes is not None
    
    def test_rename_validates_new_name(self):
        """Should reject invalid new names."""
        text = "scope:valid = { }"
        position = types.Position(line=0, character=7)
        
        # Invalid name (starts with number)
        edit = perform_rename(text, position, "123invalid", "file:///test.txt", [])
        
        assert edit is None
    
    def test_rename_event_validates_format(self):
        """Event rename should require namespace.number format."""
        text = "rq.0001 = { }"
        position = types.Position(line=0, character=3)
        
        # Invalid event ID (missing number)
        edit = perform_rename(text, position, "invalid", "file:///test.txt", [])
        
        assert edit is None
    
    def test_rename_returns_none_for_no_symbol(self):
        """Should return None when no symbol at position."""
        text = "# Just a comment"
        position = types.Position(line=0, character=5)
        
        edit = perform_rename(text, position, "new_name", "file:///test.txt", [])
        
        assert edit is None


# =============================================================================
# Test: Name Validation
# =============================================================================


class TestNameValidation:
    """Tests for name validation."""
    
    def test_valid_identifier(self):
        """Valid identifiers should pass."""
        assert _is_valid_name("my_scope", "saved_scope") is True
        assert _is_valid_name("camelCase", "variable") is True
        assert _is_valid_name("_underscore", "character_flag") is True
    
    def test_invalid_identifier_starts_with_number(self):
        """Names starting with numbers should fail."""
        assert _is_valid_name("123name", "saved_scope") is False
    
    def test_invalid_identifier_empty(self):
        """Empty names should fail."""
        assert _is_valid_name("", "saved_scope") is False
    
    def test_valid_event_id(self):
        """Valid event IDs should pass."""
        assert _is_valid_name("rq.0001", "event") is True
        assert _is_valid_name("my_mod.1234", "event") is True
    
    def test_invalid_event_id_no_number(self):
        """Event IDs without numbers should fail."""
        assert _is_valid_name("rq.abc", "event") is False
        assert _is_valid_name("just_name", "event") is False


# =============================================================================
# Test: Edge Cases
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_empty_document(self):
        """Should handle empty document."""
        text = ""
        position = types.Position(line=0, character=0)
        
        result = get_symbol_at_position(text, position)
        
        assert result is None
    
    def test_position_beyond_document(self):
        """Should handle position beyond document."""
        text = "short"
        position = types.Position(line=10, character=0)
        
        result = get_symbol_at_position(text, position)
        
        assert result is None
    
    def test_position_beyond_line(self):
        """Should handle position beyond line."""
        text = "short"
        position = types.Position(line=0, character=100)
        
        result = get_symbol_at_position(text, position)
        
        assert result is None
    
    def test_similar_names_not_confused(self):
        """Should not confuse similar names."""
        text = """scope:target = { }
scope:target_two = { }"""
        
        locations = find_all_occurrences_in_file(text, "file:///test.txt", "target", "saved_scope")
        
        # Should only find exact match "target", not "target_two"
        for loc in locations:
            assert loc.old_text == "target"


# =============================================================================
# Test: Complex Scenarios
# =============================================================================


class TestComplexScenarios:
    """Tests with realistic CK3 content."""
    
    def test_full_event_rename(self):
        """Should handle renaming in a complete event."""
        text = """namespace = rq

rq.0001 = {
    type = character_event
    title = rq.0001.t
    desc = rq.0001.desc
    
    immediate = {
        random_friend = { save_scope_as = friend }
    }
    
    option = {
        name = rq.0001.a
        scope:friend = { add_gold = 100 }
        trigger_event = { id = rq.0001 days = 30 }
    }
}"""
        position = types.Position(line=2, character=3)  # On rq.0001
        
        edit = perform_rename(text, position, "rq.0002", "file:///test.txt", [])
        
        assert edit is not None
        # Should find multiple occurrences
        edits = edit.changes.get("file:///test.txt", [])
        assert len(edits) >= 2
    
    def test_scope_rename_multiple_uses(self):
        """Should rename scope used multiple times."""
        text = """immediate = {
    save_scope_as = victim
}
option = {
    scope:victim = { add_gold = -50 }
    scope:victim = { add_opinion = { target = root modifier = angry } }
}
after = {
    scope:victim = { remove_trait = brave }
}"""
        position = types.Position(line=1, character=20)  # On 'victim' in definition
        
        edit = perform_rename(text, position, "target", "file:///test.txt", [])
        
        assert edit is not None
        edits = edit.changes.get("file:///test.txt", [])
        # 1 definition + 3 references
        assert len(edits) >= 4
    
    def test_flag_rename_all_operations(self):
        """Should rename flag across all operations."""
        text = """trigger = {
    has_character_flag = old_flag
}
immediate = {
    add_character_flag = old_flag
}
option = {
    remove_character_flag = old_flag
}"""
        position = types.Position(line=1, character=26)
        
        edit = perform_rename(text, position, "new_flag", "file:///test.txt", [])
        
        assert edit is not None
        edits = edit.changes.get("file:///test.txt", [])
        assert len(edits) >= 3


# =============================================================================
# Test: RenameLocation Dataclass
# =============================================================================


class TestRenameLocationDataclass:
    """Tests for RenameLocation structure."""
    
    def test_location_attributes(self):
        """Should have all required attributes."""
        loc = RenameLocation(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=5),
            ),
            old_text="hello",
            context="reference",
        )
        
        assert loc.uri == "file:///test.txt"
        assert loc.range.start.line == 0
        assert loc.old_text == "hello"
        assert loc.context == "reference"
