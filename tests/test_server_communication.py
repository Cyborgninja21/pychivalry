"""
Tests for server communication features.

Tests the new server communication features:
- Show message notifications
- Progress reporting
- Configuration retrieval
- Custom commands
- Apply workspace edit
"""

import pytest
from lsprotocol import types
from pychivalry.server import (
    server,
    CK3LanguageServer,
    generate_event_template_command,
    get_workspace_stats_command,
    find_orphaned_localization_command,
    check_dependencies_command,
    show_event_chain_command,
)


class TestCK3LanguageServerMethods:
    """Test the CK3LanguageServer class methods."""

    def test_server_has_notify_info(self):
        """Test that notify_info method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "notify_info")
        assert callable(ls.notify_info)

    def test_server_has_notify_warning(self):
        """Test that notify_warning method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "notify_warning")
        assert callable(ls.notify_warning)

    def test_server_has_notify_error(self):
        """Test that notify_error method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "notify_error")
        assert callable(ls.notify_error)

    def test_server_has_log_message(self):
        """Test that log_message method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "log_message")
        assert callable(ls.log_message)

    def test_server_has_with_progress(self):
        """Test that with_progress method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "with_progress")
        assert callable(ls.with_progress)

    def test_server_has_get_user_configuration(self):
        """Test that get_user_configuration method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "get_user_configuration")
        assert callable(ls.get_user_configuration)

    def test_server_has_get_cached_config(self):
        """Test that get_cached_config method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "get_cached_config")
        assert callable(ls.get_cached_config)

    def test_config_cache_default(self):
        """Test that config cache returns default values."""
        ls = CK3LanguageServer("test", "v1")
        result = ls.get_cached_config("nonexistent", "default_value")
        assert result == "default_value"

    def test_config_cache_initialized_empty(self):
        """Test that config cache is initialized as empty dict."""
        ls = CK3LanguageServer("test", "v1")
        assert ls._config_cache == {}


class TestGenerateEventTemplateCommand:
    """Test the generate event template command."""

    def test_default_template(self):
        """Test generating a template with default arguments."""
        ls = CK3LanguageServer("test", "v1")
        result = generate_event_template_command(ls, [])

        assert "template" in result
        assert "event_id" in result
        assert "localization_keys" in result
        assert result["event_id"] == "my_mod.0001"
        assert "my_mod.0001.t" in result["localization_keys"]
        assert "my_mod.0001.desc" in result["localization_keys"]

    def test_custom_namespace(self):
        """Test generating a template with custom namespace."""
        ls = CK3LanguageServer("test", "v1")
        result = generate_event_template_command(ls, ["custom_mod"])

        assert result["event_id"] == "custom_mod.0001"
        assert "custom_mod.0001 = {" in result["template"]

    def test_custom_event_number(self):
        """Test generating a template with custom event number."""
        ls = CK3LanguageServer("test", "v1")
        result = generate_event_template_command(ls, ["my_mod", "1234"])

        assert result["event_id"] == "my_mod.1234"
        assert "my_mod.1234 = {" in result["template"]

    def test_custom_event_type(self):
        """Test generating a template with custom event type."""
        ls = CK3LanguageServer("test", "v1")
        result = generate_event_template_command(ls, ["my_mod", "0001", "letter_event"])

        assert "type = letter_event" in result["template"]

    def test_template_structure(self):
        """Test that the template has proper structure."""
        ls = CK3LanguageServer("test", "v1")
        result = generate_event_template_command(ls, ["test_mod", "0001"])

        template = result["template"]

        # Check required elements
        assert "test_mod.0001 = {" in template
        assert "type = character_event" in template
        assert "title = test_mod.0001.t" in template
        assert "desc = test_mod.0001.desc" in template
        assert "theme = diplomacy" in template
        assert "left_portrait = root" in template
        assert "trigger = {" in template
        assert "immediate = {" in template
        assert "option = {" in template


class TestGetWorkspaceStatsCommand:
    """Test the get workspace stats command."""

    def test_returns_dictionary(self):
        """Test that stats returns a dictionary."""
        ls = CK3LanguageServer("test", "v1")
        result = get_workspace_stats_command(ls, [])

        assert isinstance(result, dict)

    def test_has_expected_keys(self):
        """Test that stats has all expected keys."""
        ls = CK3LanguageServer("test", "v1")
        result = get_workspace_stats_command(ls, [])

        expected_keys = [
            "scanned",
            "events",
            "namespaces",
            "scripted_effects",
            "scripted_triggers",
            "script_values",
            "localization_keys",
            "character_flags",
            "saved_scopes",
            "character_interactions",
            "modifiers",
            "on_actions",
            "opinion_modifiers",
            "scripted_guis",
        ]

        for key in expected_keys:
            assert key in result, f"Missing key: {key}"

    def test_initial_values_are_zero_or_false(self):
        """Test that initial values are 0 or False for empty workspace."""
        ls = CK3LanguageServer("test", "v1")
        result = get_workspace_stats_command(ls, [])

        assert result["scanned"] is False
        assert result["events"] == 0
        assert result["scripted_effects"] == 0


class TestFindOrphanedLocalizationCommand:
    """Test the find orphaned localization command."""

    def test_returns_dictionary(self):
        """Test that command returns a dictionary."""
        ls = CK3LanguageServer("test", "v1")
        result = find_orphaned_localization_command(ls, [])

        assert isinstance(result, dict)
        assert "orphaned_keys" in result
        assert "total_count" in result

    def test_empty_workspace_has_no_orphans(self):
        """Test that empty workspace has no orphaned keys."""
        ls = CK3LanguageServer("test", "v1")
        result = find_orphaned_localization_command(ls, [])

        assert result["orphaned_keys"] == []
        assert result["total_count"] == 0


class TestCheckDependenciesCommand:
    """Test the check dependencies command."""

    def test_returns_dictionary(self):
        """Test that command returns a dictionary."""
        ls = CK3LanguageServer("test", "v1")
        result = check_dependencies_command(ls, [])

        assert isinstance(result, dict)
        assert "defined_effects" in result
        assert "defined_triggers" in result
        assert "indexed_events" in result
        assert "status" in result


class TestShowEventChainCommand:
    """Test the show event chain command."""

    def test_requires_event_id(self):
        """Test that command requires event ID."""
        ls = CK3LanguageServer("test", "v1")
        result = show_event_chain_command(ls, [])

        assert "error" in result
        assert "Event ID required" in result["error"]

    def test_nonexistent_event(self):
        """Test that command handles nonexistent event."""
        ls = CK3LanguageServer("test", "v1")
        result = show_event_chain_command(ls, ["nonexistent.0001"])

        assert "error" in result
        assert "not found" in result["error"]


class TestServerInstance:
    """Test the global server instance."""

    def test_server_is_ck3_language_server(self):
        """Test that global server is CK3LanguageServer instance."""
        assert isinstance(server, CK3LanguageServer)

    def test_server_has_index(self):
        """Test that server has index attribute."""
        assert hasattr(server, "index")
        assert server.index is not None

    def test_server_has_document_asts(self):
        """Test that server has document_asts attribute."""
        assert hasattr(server, "document_asts")
        assert isinstance(server.document_asts, dict)


class TestApplyWorkspaceEdit:
    """Test the apply workspace edit functionality."""

    def test_server_has_apply_edit(self):
        """Test that apply_edit method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "apply_edit")
        assert callable(ls.apply_edit)

    def test_server_has_create_text_edit(self):
        """Test that create_text_edit method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "create_text_edit")
        assert callable(ls.create_text_edit)

    def test_server_has_create_insert_edit(self):
        """Test that create_insert_edit method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "create_insert_edit")
        assert callable(ls.create_insert_edit)

    def test_server_has_create_multi_file_edit(self):
        """Test that create_multi_file_edit method exists."""
        ls = CK3LanguageServer("test", "v1")
        assert hasattr(ls, "create_multi_file_edit")
        assert callable(ls.create_multi_file_edit)

    def test_create_text_edit_returns_workspace_edit(self):
        """Test that create_text_edit returns a WorkspaceEdit."""
        ls = CK3LanguageServer("test", "v1")
        edit = ls.create_text_edit(
            uri="file:///test.txt",
            start_line=0,
            start_char=0,
            end_line=0,
            end_char=5,
            new_text="hello",
        )

        assert isinstance(edit, types.WorkspaceEdit)
        assert "file:///test.txt" in edit.changes
        assert len(edit.changes["file:///test.txt"]) == 1

    def test_create_insert_edit_returns_workspace_edit(self):
        """Test that create_insert_edit returns a WorkspaceEdit."""
        ls = CK3LanguageServer("test", "v1")
        edit = ls.create_insert_edit(uri="file:///test.txt", line=5, character=10, text="inserted")

        assert isinstance(edit, types.WorkspaceEdit)
        assert "file:///test.txt" in edit.changes

    def test_create_multi_file_edit_returns_workspace_edit(self):
        """Test that create_multi_file_edit returns a WorkspaceEdit."""
        ls = CK3LanguageServer("test", "v1")

        changes = {
            "file:///a.txt": [
                types.TextEdit(
                    range=types.Range(
                        start=types.Position(line=0, character=0),
                        end=types.Position(line=0, character=0),
                    ),
                    new_text="file a",
                )
            ],
            "file:///b.txt": [
                types.TextEdit(
                    range=types.Range(
                        start=types.Position(line=0, character=0),
                        end=types.Position(line=0, character=0),
                    ),
                    new_text="file b",
                )
            ],
        }

        edit = ls.create_multi_file_edit(changes)

        assert isinstance(edit, types.WorkspaceEdit)
        assert "file:///a.txt" in edit.changes
        assert "file:///b.txt" in edit.changes

    def test_text_edit_has_correct_range(self):
        """Test that created text edits have correct ranges."""
        ls = CK3LanguageServer("test", "v1")
        edit = ls.create_text_edit(
            uri="file:///test.txt",
            start_line=10,
            start_char=5,
            end_line=15,
            end_char=20,
            new_text="replaced",
        )

        text_edit = edit.changes["file:///test.txt"][0]
        assert text_edit.range.start.line == 10
        assert text_edit.range.start.character == 5
        assert text_edit.range.end.line == 15
        assert text_edit.range.end.character == 20
        assert text_edit.new_text == "replaced"

    def test_insert_edit_has_zero_width_range(self):
        """Test that insert edits have zero-width range (start == end)."""
        ls = CK3LanguageServer("test", "v1")
        edit = ls.create_insert_edit(uri="file:///test.txt", line=5, character=10, text="inserted")

        text_edit = edit.changes["file:///test.txt"][0]
        assert text_edit.range.start.line == text_edit.range.end.line
        assert text_edit.range.start.character == text_edit.range.end.character
