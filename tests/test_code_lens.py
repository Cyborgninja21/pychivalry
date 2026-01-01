"""
Tests for CK3 Code Lens functionality.

Tests the code_lens module that provides inline actionable information
for events, scripted effects, scripted triggers, and namespaces.
"""

import pytest
from lsprotocol import types

from pychivalry.code_lens import (
    get_code_lenses,
    resolve_code_lens,
    _find_namespace_lenses,
    _find_event_lenses,
    _find_scripted_effect_lenses,
    _find_scripted_trigger_lenses,
    _analyze_event,
)
from pychivalry.indexer import DocumentIndex


class TestGetCodeLenses:
    """Tests for the main get_code_lenses function."""

    def test_empty_document(self):
        """Empty document should return no lenses."""
        lenses = get_code_lenses("", "file:///test.txt", None)
        assert lenses == []

    def test_namespace_lens(self):
        """Namespace declaration should get a code lens."""
        content = "namespace = my_mod"
        lenses = get_code_lenses(content, "file:///events/test.txt", None)

        assert len(lenses) >= 1
        # Find the namespace lens
        namespace_lens = next(
            (l for l in lenses if l.data and l.data.get("lens_type") == "namespace"), None
        )
        assert namespace_lens is not None
        assert namespace_lens.data["symbol_name"] == "my_mod"

    def test_event_lens(self):
        """Event definition should get a code lens."""
        content = """namespace = my_mod

my_mod.0001 = {
    type = character_event
    title = my_mod.0001.t
}
"""
        lenses = get_code_lenses(content, "file:///events/test.txt", None)

        # Find the event lens
        event_lens = next(
            (l for l in lenses if l.data and l.data.get("lens_type") == "event"), None
        )
        assert event_lens is not None
        assert event_lens.data["symbol_name"] == "my_mod.0001"
        assert event_lens.range.start.line == 2  # Line with event definition

    def test_multiple_events(self):
        """Multiple events should each get their own lens."""
        content = """namespace = my_mod

my_mod.0001 = {
    type = character_event
}

my_mod.0002 = {
    type = character_event
}

my_mod.0003 = {
    type = character_event
}
"""
        lenses = get_code_lenses(content, "file:///events/test.txt", None)

        event_lenses = [l for l in lenses if l.data and l.data.get("lens_type") == "event"]
        assert len(event_lenses) == 3

        event_ids = {l.data["symbol_name"] for l in event_lenses}
        assert event_ids == {"my_mod.0001", "my_mod.0002", "my_mod.0003"}

    def test_scripted_effect_lens(self):
        """Scripted effect definition should get a code lens in scripted_effects files."""
        content = """my_custom_effect = {
    add_gold = 100
}

another_effect = {
    add_prestige = 50
}
"""
        # Only scripted_effects folder gets effect lenses
        lenses = get_code_lenses(content, "file:///common/scripted_effects/test.txt", None)

        effect_lenses = [
            l for l in lenses if l.data and l.data.get("lens_type") == "scripted_effect"
        ]
        assert len(effect_lenses) == 2

        effect_names = {l.data["symbol_name"] for l in effect_lenses}
        assert effect_names == {"my_custom_effect", "another_effect"}

    def test_scripted_trigger_lens(self):
        """Scripted trigger definition should get a code lens in scripted_triggers files."""
        content = """my_custom_trigger = {
    is_adult = yes
}
"""
        lenses = get_code_lenses(content, "file:///common/scripted_triggers/test.txt", None)

        trigger_lenses = [
            l for l in lenses if l.data and l.data.get("lens_type") == "scripted_trigger"
        ]
        assert len(trigger_lenses) == 1
        assert trigger_lenses[0].data["symbol_name"] == "my_custom_trigger"

    def test_no_lens_for_nested_blocks(self):
        """Nested blocks (trigger, effect, etc.) should not get lenses."""
        content = """my_mod.0001 = {
    type = character_event
    
    trigger = {
        is_adult = yes
    }
    
    immediate = {
        add_gold = 100
    }
    
    option = {
        name = my_mod.0001.a
    }
}
"""
        lenses = get_code_lenses(content, "file:///events/test.txt", None)

        # Should only have namespace-less event, no lenses for trigger/immediate/option
        event_lenses = [l for l in lenses if l.data and l.data.get("lens_type") == "event"]
        assert len(event_lenses) == 1
        assert event_lenses[0].data["symbol_name"] == "my_mod.0001"


class TestNamespaceLenses:
    """Tests for namespace code lens detection."""

    def test_simple_namespace(self):
        """Simple namespace declaration should be detected."""
        lines = ["namespace = my_mod"]
        lenses = _find_namespace_lenses(lines, "file:///test.txt", None)

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_mod"
        assert lenses[0].range.start.line == 0

    def test_namespace_with_whitespace(self):
        """Namespace with leading whitespace should still be detected."""
        lines = ["  namespace = my_mod"]
        lenses = _find_namespace_lenses(lines, "file:///test.txt", None)

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_mod"

    def test_namespace_with_index(self):
        """Namespace lens should show event count from index."""
        index = DocumentIndex()
        # Manually add events to index
        index.events["my_mod.0001"] = types.Location(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
        )
        index.events["my_mod.0002"] = types.Location(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=5, character=0),
                end=types.Position(line=5, character=10),
            ),
        )

        lines = ["namespace = my_mod"]
        lenses = _find_namespace_lenses(lines, "file:///test.txt", index)

        assert len(lenses) == 1
        # Command title should show event count
        assert "2 events" in lenses[0].command.title


class TestEventLenses:
    """Tests for event code lens detection."""

    def test_simple_event(self):
        """Simple event definition should be detected."""
        lines = ["my_mod.0001 = {"]
        processed = set()
        lenses = _find_event_lenses(lines, "file:///test.txt", None, processed)

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_mod.0001"
        assert "my_mod.0001" in processed

    def test_event_with_underscore_namespace(self):
        """Event with underscored namespace should be detected."""
        lines = ["rq_nts_daughter.0001 = {"]
        processed = set()
        lenses = _find_event_lenses(lines, "file:///test.txt", None, processed)

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "rq_nts_daughter.0001"

    def test_indented_event_ignored(self):
        """Indented event definitions (nested blocks) should be ignored."""
        lines = [
            "my_mod.0001 = {",
            "    nested.0002 = {",  # This shouldn't be detected
            "    }",
            "}",
        ]
        processed = set()
        lenses = _find_event_lenses(lines, "file:///test.txt", None, processed)

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_mod.0001"

    def test_missing_localization_detection(self):
        """Event lens should show missing localization."""
        index = DocumentIndex()
        # Don't add any localization - it should be detected as missing

        # Analyze the event
        ref_count, trigger_count, missing_loc = _analyze_event("my_mod.0001", index)

        # Should detect missing .t and .desc
        assert "my_mod.0001.t" in missing_loc
        assert "my_mod.0001.desc" in missing_loc


class TestScriptedEffectLenses:
    """Tests for scripted effect code lens detection."""

    def test_simple_effect(self):
        """Simple effect definition should be detected."""
        lines = ["my_effect = {", "    add_gold = 100", "}"]
        processed = set()
        lenses = _find_scripted_effect_lenses(
            lines, "file:///common/scripted_effects/test.txt", None, processed
        )

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_effect"

    def test_skip_keywords(self):
        """Common keywords should not be detected as effects."""
        lines = [
            "if = {",  # Should be skipped
            "    condition = yes",
            "}",
        ]
        processed = set()
        lenses = _find_scripted_effect_lenses(
            lines, "file:///common/scripted_effects/test.txt", None, processed
        )

        assert len(lenses) == 0

    def test_nested_blocks_not_detected(self):
        """Nested blocks should not be detected as effects."""
        lines = [
            "my_effect = {",
            "    if = {",  # Nested if
            "        add_gold = 100",
            "    }",
            "}",
        ]
        processed = set()
        lenses = _find_scripted_effect_lenses(
            lines, "file:///common/scripted_effects/test.txt", None, processed
        )

        # Should only detect my_effect, not if
        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_effect"


class TestScriptedTriggerLenses:
    """Tests for scripted trigger code lens detection."""

    def test_simple_trigger(self):
        """Simple trigger definition should be detected."""
        lines = ["my_trigger = {", "    is_adult = yes", "}"]
        processed = set()
        lenses = _find_scripted_trigger_lenses(
            lines, "file:///common/scripted_triggers/test.txt", None, processed
        )

        assert len(lenses) == 1
        assert lenses[0].data["symbol_name"] == "my_trigger"


class TestResolveCodeLens:
    """Tests for code lens resolution."""

    def test_resolve_event_lens(self):
        """Event code lens should resolve with reference info."""
        lens = types.CodeLens(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            data={
                "lens_type": "event",
                "symbol_name": "my_mod.0001",
                "uri": "file:///test.txt",
            },
        )

        resolved = resolve_code_lens(lens, None)

        assert resolved.command is not None
        assert "references" in resolved.command.title.lower()

    def test_resolve_namespace_lens(self):
        """Namespace code lens should resolve with event count."""
        index = DocumentIndex()
        index.events["my_mod.0001"] = types.Location(
            uri="file:///test.txt",
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
        )

        lens = types.CodeLens(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            data={
                "lens_type": "namespace",
                "symbol_name": "my_mod",
                "uri": "file:///test.txt",
            },
        )

        resolved = resolve_code_lens(lens, index)

        assert resolved.command is not None
        assert "1 events" in resolved.command.title

    def test_resolve_effect_lens(self):
        """Effect code lens should resolve with usage count."""
        lens = types.CodeLens(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            data={
                "lens_type": "scripted_effect",
                "symbol_name": "my_effect",
                "uri": "file:///test.txt",
            },
        )

        resolved = resolve_code_lens(lens, None)

        assert resolved.command is not None
        assert "used" in resolved.command.title.lower()

    def test_resolve_trigger_lens(self):
        """Trigger code lens should resolve with usage count."""
        lens = types.CodeLens(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            data={
                "lens_type": "scripted_trigger",
                "symbol_name": "my_trigger",
                "uri": "file:///test.txt",
            },
        )

        resolved = resolve_code_lens(lens, None)

        assert resolved.command is not None
        assert "used" in resolved.command.title.lower()


class TestCodeLensCommands:
    """Tests for code lens command configuration."""

    def test_event_lens_command(self):
        """Event lens should have findReferences command."""
        content = "my_mod.0001 = {"
        lenses = get_code_lenses(content, "file:///events/test.txt", None)

        event_lens = next(
            (l for l in lenses if l.data and l.data.get("lens_type") == "event"), None
        )
        assert event_lens is not None
        assert event_lens.command.command == "editor.action.findReferences"

    def test_namespace_lens_command(self):
        """Namespace lens should have showNamespaceEvents command."""
        content = "namespace = my_mod"
        lenses = get_code_lenses(content, "file:///events/test.txt", None)

        namespace_lens = next(
            (l for l in lenses if l.data and l.data.get("lens_type") == "namespace"), None
        )
        assert namespace_lens is not None
        assert namespace_lens.command.command == "ck3.showNamespaceEvents"
        assert namespace_lens.command.arguments == ["my_mod"]
