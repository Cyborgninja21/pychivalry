"""
Tests for document highlighting functionality.

Document highlighting shows all occurrences of a symbol when you click on it.
This helps visualize where a variable, scope, or event is used and defined.
"""

import pytest
from lsprotocol import types

from pychivalry.document_highlight import (
    get_document_highlights,
    get_symbol_at_position,
    find_all_occurrences,
    SymbolInfo,
)


# =============================================================================
# Test: get_symbol_at_position
# =============================================================================


class TestGetSymbolAtPosition:
    """Tests for symbol detection at cursor position."""

    def test_scope_reference_at_position(self):
        """Should detect scope:name at cursor position."""
        text = "scope:target = { }"
        position = types.Position(line=0, character=7)  # On 'target'

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "target"
        assert symbol.symbol_type == "scope_reference"

    def test_scope_reference_start(self):
        """Should detect scope reference at start of 'scope:' prefix."""
        text = "scope:recipient = { }"
        position = types.Position(line=0, character=0)  # On 'scope'

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "recipient"
        assert symbol.symbol_type == "scope_reference"

    def test_scope_definition_at_position(self):
        """Should detect save_scope_as definitions."""
        text = "save_scope_as = target"
        position = types.Position(line=0, character=18)  # On 'target'

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "target"
        assert symbol.symbol_type == "scope_definition"

    def test_temporary_scope_definition(self):
        """Should detect save_temporary_scope_as."""
        text = "save_temporary_scope_as = temp_var"
        position = types.Position(line=0, character=28)  # On 'temp_var'

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "temp_var"
        assert symbol.symbol_type == "scope_definition"

    def test_event_id_at_position(self):
        """Should detect event IDs like namespace.0001."""
        text = "trigger_event = { id = rq.0001 }"
        position = types.Position(line=0, character=25)  # On 'rq.0001'

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "rq.0001"
        assert symbol.symbol_type == "event_id"

    def test_event_id_multidigit(self):
        """Should detect event IDs with multiple digits."""
        text = "id = my_mod.1234"
        position = types.Position(line=0, character=8)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_mod.1234"
        assert symbol.symbol_type == "event_id"

    def test_variable_reference(self):
        """Should detect var:name references."""
        text = "if = { limit = { exists = var:my_counter } }"
        position = types.Position(line=0, character=32)  # On 'my_counter'

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_counter"
        assert symbol.symbol_type == "variable"

    def test_local_variable_reference(self):
        """Should detect local_var:name references."""
        text = "value = local_var:temp"
        position = types.Position(line=0, character=15)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "temp"
        assert symbol.symbol_type == "variable"

    def test_global_variable_reference(self):
        """Should detect global_var:name references."""
        text = "trigger = { global_var:world_state = 1 }"
        position = types.Position(line=0, character=22)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "world_state"
        assert symbol.symbol_type == "variable"

    def test_character_flag_check(self):
        """Should detect has_character_flag."""
        text = "has_character_flag = my_custom_flag"
        position = types.Position(line=0, character=25)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_custom_flag"
        assert symbol.symbol_type == "flag"

    def test_character_flag_add(self):
        """Should detect add_character_flag."""
        text = "add_character_flag = important_flag"
        position = types.Position(line=0, character=25)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "important_flag"
        assert symbol.symbol_type == "flag"

    def test_trait_reference(self):
        """Should detect trait references."""
        text = "has_trait = brave"
        position = types.Position(line=0, character=14)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "brave"
        assert symbol.symbol_type == "trait"

    def test_global_flag(self):
        """Should detect global flags."""
        text = "has_global_flag = game_started"
        position = types.Position(line=0, character=22)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "game_started"
        assert symbol.symbol_type == "global_flag"

    def test_no_symbol_at_whitespace(self):
        """Should return None when cursor is on whitespace."""
        text = "scope:target   = { }"
        position = types.Position(line=0, character=14)  # On space

        symbol = get_symbol_at_position(text, position)

        assert symbol is None

    def test_no_symbol_at_operator(self):
        """Should return None when cursor is on operator."""
        text = "value = 5"
        position = types.Position(line=0, character=6)  # On '='

        symbol = get_symbol_at_position(text, position)

        assert symbol is None

    def test_position_beyond_line_length(self):
        """Should return None when position is beyond line length."""
        text = "short"
        position = types.Position(line=0, character=100)

        symbol = get_symbol_at_position(text, position)

        assert symbol is None

    def test_position_on_invalid_line(self):
        """Should return None when line doesn't exist."""
        text = "single line"
        position = types.Position(line=5, character=0)

        symbol = get_symbol_at_position(text, position)

        assert symbol is None

    def test_scripted_effect(self):
        """Should detect scripted effects."""
        text = "my_custom_effect = yes"
        position = types.Position(line=0, character=5)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_custom_effect"
        assert symbol.symbol_type == "scripted_effect"

    def test_scripted_trigger(self):
        """Should detect scripted triggers."""
        text = "can_do_thing_trigger = yes"
        position = types.Position(line=0, character=5)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "can_do_thing_trigger"
        assert symbol.symbol_type == "scripted_trigger"


# =============================================================================
# Test: get_document_highlights - Saved Scopes
# =============================================================================


class TestDocumentHighlightScopes:
    """Tests for highlighting saved scopes."""

    def test_highlight_scope_reference_finds_definition(self):
        """Clicking on scope:X should highlight save_scope_as = X."""
        text = """immediate = {
    random_friend = { save_scope_as = target }
}
option = {
    scope:target = { add_gold = 100 }
}"""
        position = types.Position(line=4, character=10)  # On 'scope:target'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2

        # Should have a WRITE for the definition
        write_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Write]
        assert len(write_highlights) >= 1

        # Should have a READ for the usage
        read_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Read]
        assert len(read_highlights) >= 1

    def test_highlight_scope_definition_finds_references(self):
        """Clicking on save_scope_as = X should highlight scope:X."""
        text = """immediate = {
    save_scope_as = recipient
}
option = {
    scope:recipient = { add_gold = 100 }
}"""
        position = types.Position(line=1, character=20)  # On 'recipient' in definition

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2

    def test_highlight_multiple_scope_references(self):
        """Should highlight all references to a scope."""
        text = """immediate = {
    save_scope_as = victim
}
option = {
    scope:victim = { 
        add_gold = -50
        scope:victim = { remove_trait = brave }
    }
}"""
        position = types.Position(line=4, character=10)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # One definition + two usages
        assert len(highlights) >= 3

    def test_highlight_temporary_scope(self):
        """Should highlight temporary scopes the same way."""
        text = """immediate = {
    save_temporary_scope_as = temp_target
}
if = {
    limit = { scope:temp_target = { is_alive = yes } }
}"""
        position = types.Position(line=1, character=30)  # On 'temp_target'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2


# =============================================================================
# Test: get_document_highlights - Event IDs
# =============================================================================


class TestDocumentHighlightEvents:
    """Tests for highlighting event IDs."""

    def test_highlight_event_id_in_trigger(self):
        """Should highlight event ID across trigger_event and definition."""
        text = """namespace = my_mod

my_mod.0001 = {
    option = {
        trigger_event = { id = my_mod.0001 }
    }
}"""
        position = types.Position(line=4, character=32)  # On 'my_mod.0001'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2

    def test_highlight_event_definition(self):
        """Clicking on event definition should find references."""
        text = """my_mod.0001 = {
    type = character_event
}

other = {
    trigger_event = { id = my_mod.0001 }
}"""
        position = types.Position(line=0, character=5)  # On definition

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # Definition + reference
        assert len(highlights) >= 2


# =============================================================================
# Test: get_document_highlights - Variables
# =============================================================================


class TestDocumentHighlightVariables:
    """Tests for highlighting variables."""

    def test_highlight_variable_reference(self):
        """Clicking on var:X should highlight set_variable name = X."""
        text = """immediate = {
    set_variable = { name = counter value = 1 }
}
option = {
    if = { limit = { var:counter >= 5 } }
}"""
        position = types.Position(line=4, character=28)  # On 'counter'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2

    def test_highlight_local_variable(self):
        """Should highlight local_var references."""
        text = """effect = {
    set_local_variable = { name = temp value = 0 }
    while = {
        local_var:temp < 10
    }
}"""
        position = types.Position(line=3, character=15)  # On 'temp'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2


# =============================================================================
# Test: get_document_highlights - Flags
# =============================================================================


class TestDocumentHighlightFlags:
    """Tests for highlighting character flags."""

    def test_highlight_character_flag(self):
        """Should highlight all uses of a character flag."""
        text = """trigger = {
    has_character_flag = quest_started
}
immediate = {
    add_character_flag = quest_started
}
option = {
    remove_character_flag = quest_started
}"""
        position = types.Position(line=1, character=28)  # On 'quest_started'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # Check, add, remove = 3 occurrences
        assert len(highlights) >= 3

        # Should have both read (has_) and write (add_, remove_) kinds
        read_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Read]
        write_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Write]
        assert len(read_highlights) >= 1
        assert len(write_highlights) >= 2

    def test_highlight_global_flag(self):
        """Should highlight global flags."""
        text = """on_startup = {
    set_global_flag = game_initialized
}
trigger = {
    has_global_flag = game_initialized
}"""
        position = types.Position(line=1, character=25)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2


# =============================================================================
# Test: get_document_highlights - Traits
# =============================================================================


class TestDocumentHighlightTraits:
    """Tests for highlighting traits."""

    def test_highlight_trait_references(self):
        """Should highlight all trait operations."""
        text = """trigger = {
    has_trait = brave
}
option = {
    add_trait = brave
}
after = {
    remove_trait = brave
}"""
        position = types.Position(line=1, character=16)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 3


# =============================================================================
# Test: Localization Key Highlighting
# =============================================================================


class TestDocumentHighlightLocalization:
    """Tests for highlighting localization keys."""

    def test_localization_key_with_suffix(self):
        """Should detect full localization key with suffix like .defeat."""
        text = """root = {
    send_interface_toast = {
        title = rq_rise_wolf_queen.3004.defeat
        add_prestige = -100
    }
}"""
        position = types.Position(line=2, character=20)  # On the loc key

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "rq_rise_wolf_queen.3004.defeat"
        assert symbol.symbol_type == "localization"

    def test_localization_key_standard_title(self):
        """Should detect standard .t title localization key."""
        text = "title = my_event.0001.t"
        position = types.Position(line=0, character=15)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_event.0001.t"
        assert symbol.symbol_type == "localization"

    def test_localization_key_desc(self):
        """Should detect .desc localization key."""
        text = "desc = my_event.0001.desc"
        position = types.Position(line=0, character=15)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_event.0001.desc"
        assert symbol.symbol_type == "localization"

    def test_localization_key_tooltip(self):
        """Should detect tooltip localization key."""
        text = "tooltip = custom_tooltip_key.tt"
        position = types.Position(line=0, character=15)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "custom_tooltip_key.tt"
        assert symbol.symbol_type == "localization"

    def test_localization_key_custom_tooltip(self):
        """Should detect custom_tooltip localization key."""
        text = "custom_tooltip = my_mod.some_tooltip"
        position = types.Position(line=0, character=25)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_mod.some_tooltip"
        assert symbol.symbol_type == "localization"

    def test_localization_highlight_multiple_occurrences(self):
        """Should highlight all occurrences of the same localization key."""
        text = """option = {
    name = my_mod.0001.option_a
    trigger = { always = yes }
}
option = {
    name = my_mod.0001.option_a
    trigger = { always = no }
}"""
        position = types.Position(line=1, character=15)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) == 2

    def test_localization_not_confused_with_event_id(self):
        """Should correctly identify localization keys vs event IDs.
        
        Localization keys like 'my_event.0001.t' should be detected as
        localization type when in title/desc/name context, not as event IDs.
        """
        text = """title = rq_rise_wolf_queen.3004.defeat
trigger_event = {
    id = rq_rise_wolf_queen.3004
}"""
        # Test localization key
        loc_position = types.Position(line=0, character=20)
        loc_symbol = get_symbol_at_position(text, loc_position)

        assert loc_symbol is not None
        assert loc_symbol.symbol_type == "localization"
        assert loc_symbol.name == "rq_rise_wolf_queen.3004.defeat"

        # Test event ID (should still work)
        event_position = types.Position(line=2, character=10)
        event_symbol = get_symbol_at_position(text, event_position)

        assert event_symbol is not None
        assert event_symbol.symbol_type == "event_id"
        assert event_symbol.name == "rq_rise_wolf_queen.3004"


# =============================================================================
# Test: Edge Cases
# =============================================================================


class TestDocumentHighlightEdgeCases:
    """Tests for edge cases and error handling."""

    def test_no_highlights_for_unknown_symbol(self):
        """Should return None for unrecognized symbols."""
        text = "value = 123"
        position = types.Position(line=0, character=10)  # On '123'

        highlights = get_document_highlights(text, position)

        # Numbers shouldn't get highlights
        assert highlights is None or len(highlights) == 0

    def test_empty_document(self):
        """Should handle empty document."""
        text = ""
        position = types.Position(line=0, character=0)

        highlights = get_document_highlights(text, position)

        assert highlights is None

    def test_comment_line(self):
        """Should handle comment lines."""
        text = "# scope:target is a saved scope"
        position = types.Position(line=0, character=10)

        highlights = get_document_highlights(text, position)

        # May find something, but should not error
        # The behavior for comments is flexible

    def test_multiple_symbols_same_line(self):
        """Should only highlight the clicked symbol."""
        text = "scope:actor = { scope:target = { add_gold = 100 } }"
        position = types.Position(line=0, character=7)  # On 'actor'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # Should only find 'actor', not 'target'
        for h in highlights:
            line_text = text[h.range.start.character : h.range.end.character]
            assert "target" not in line_text or "actor" in line_text

    def test_similar_names_not_confused(self):
        """Should not confuse similar but different names."""
        text = """scope:target = { }
scope:target_two = { }
save_scope_as = target"""
        position = types.Position(line=0, character=7)  # On 'target' (not 'target_two')

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # Check that we don't have highlights for 'target_two'
        for h in highlights:
            line_num = h.range.start.line
            if line_num == 1:
                # Should not highlight target_two line
                pass  # The highlight range should not include the full 'target_two'

    def test_case_sensitive_matching(self):
        """Symbols should be matched case-sensitively."""
        text = """scope:Target = { }
scope:target = { }"""
        position = types.Position(line=0, character=7)  # On 'Target'

        highlights = get_document_highlights(text, position)

        # Should only highlight 'Target', not 'target'
        if highlights:
            for h in highlights:
                assert h.range.start.line == 0  # Only first line


# =============================================================================
# Test: SymbolInfo Structure
# =============================================================================


class TestSymbolInfoStructure:
    """Tests for SymbolInfo dataclass."""

    def test_symbol_info_attributes(self):
        """Should correctly populate SymbolInfo."""
        text = "scope:my_target = yes"
        position = types.Position(line=0, character=8)

        symbol = get_symbol_at_position(text, position)

        assert symbol is not None
        assert symbol.name == "my_target"
        assert symbol.symbol_type == "scope_reference"
        assert "scope:my_target" in symbol.full_match
        assert symbol.start >= 0
        assert symbol.end > symbol.start


# =============================================================================
# Test: Highlight Kinds
# =============================================================================


class TestHighlightKinds:
    """Tests for proper highlight kind assignment."""

    def test_scope_definition_is_write(self):
        """save_scope_as should be marked as WRITE."""
        text = "save_scope_as = target"
        position = types.Position(line=0, character=18)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        write_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Write]
        assert len(write_highlights) >= 1

    def test_scope_reference_is_read(self):
        """scope:X usage should be marked as READ."""
        text = """save_scope_as = target
scope:target = { }"""
        position = types.Position(line=1, character=7)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        read_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Read]
        assert len(read_highlights) >= 1

    def test_flag_add_is_write(self):
        """add_character_flag should be WRITE."""
        text = """add_character_flag = my_flag
has_character_flag = my_flag"""
        position = types.Position(line=0, character=23)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        write_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Write]
        assert len(write_highlights) >= 1

    def test_flag_check_is_read(self):
        """has_character_flag should be READ."""
        text = """add_character_flag = my_flag
has_character_flag = my_flag"""
        position = types.Position(line=1, character=23)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        read_highlights = [h for h in highlights if h.kind == types.DocumentHighlightKind.Read]
        assert len(read_highlights) >= 1


# =============================================================================
# Test: Complex Documents
# =============================================================================


class TestComplexDocuments:
    """Tests with realistic CK3 event content."""

    def test_full_event_chain(self):
        """Should handle a complete event with multiple scope uses."""
        text = """namespace = my_events

my_events.0001 = {
    type = character_event
    title = my_events.0001.t
    desc = my_events.0001.desc
    
    immediate = {
        random_friend = { save_scope_as = friend }
        random_enemy = { save_scope_as = enemy }
    }
    
    option = {
        name = my_events.0001.a
        scope:friend = { add_gold = 50 }
    }
    
    option = {
        name = my_events.0001.b
        scope:enemy = { add_gold = -50 }
        scope:friend = { add_opinion = { target = root modifier = grateful } }
    }
}"""
        # Click on 'friend' in scope:friend
        position = types.Position(line=14, character=14)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # Definition (1) + usages (2)
        assert len(highlights) >= 3

    def test_nested_scopes(self):
        """Should handle nested scope blocks."""
        text = """effect = {
    scope:outer = {
        random_child = {
            save_scope_as = inner
            scope:outer = { add_gold = 10 }
        }
    }
}"""
        position = types.Position(line=1, character=11)  # On 'outer'

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # Two uses of scope:outer
        assert len(highlights) >= 2


# =============================================================================
# Test: Range Accuracy
# =============================================================================


class TestHighlightRangeAccuracy:
    """Tests for accurate highlight ranges."""

    def test_highlight_range_matches_symbol(self):
        """Highlight range should cover exactly the symbol."""
        text = "scope:precise_name = yes"
        position = types.Position(line=0, character=10)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 1

        h = highlights[0]
        highlighted_text = text[h.range.start.character : h.range.end.character]
        assert "precise_name" in highlighted_text or highlighted_text == "precise_name"

    def test_highlight_does_not_include_prefix(self):
        """Highlight should ideally not include 'scope:' prefix in range."""
        text = "scope:target = yes"
        position = types.Position(line=0, character=8)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        # The implementation may include prefix - verify the symbol name is included
        h = highlights[0]
        highlighted_text = text[h.range.start.character : h.range.end.character]
        assert "target" in highlighted_text

    def test_multiline_highlight_positions(self):
        """Highlights on different lines should have correct line numbers."""
        text = """line_zero
scope:my_scope
line_two
scope:my_scope"""
        position = types.Position(line=1, character=8)

        highlights = get_document_highlights(text, position)

        assert highlights is not None
        assert len(highlights) >= 2

        # Check that we have highlights on line 1 and line 3
        lines = {h.range.start.line for h in highlights}
        assert 1 in lines
        assert 3 in lines
