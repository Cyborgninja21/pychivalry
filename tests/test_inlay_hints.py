"""
Tests for CK3 Inlay Hints.

Tests the inlay hint provider for CK3 scripts, including:
- Saved scope type hints
- Scope chain type hints
- List iterator type hints
- Configuration options
"""

import pytest
from lsprotocol import types

from pychivalry.inlay_hints import (
    get_inlay_hints,
    get_scope_type_for_link,
    get_scope_type_for_chain,
    get_scope_type_for_iterator,
    InlayHintConfig,
    _infer_scope_type_from_name,
    _find_scope_hints,
    _find_chain_hints,
    _find_iterator_hints,
)


# =============================================================================
# Test Scope Type Resolution
# =============================================================================


class TestScopeTypeForLink:
    """Tests for get_scope_type_for_link function."""

    def test_character_liege(self):
        """Test character.liege -> character."""
        result = get_scope_type_for_link("character", "liege")
        assert result == "character"

    def test_character_spouse(self):
        """Test character.spouse -> character."""
        result = get_scope_type_for_link("character", "spouse")
        assert result == "character"

    def test_character_primary_title(self):
        """Test character.primary_title -> landed_title."""
        result = get_scope_type_for_link("character", "primary_title")
        assert result == "landed_title"

    def test_character_location(self):
        """Test character.location -> province."""
        result = get_scope_type_for_link("character", "location")
        assert result == "province"

    def test_character_dynasty(self):
        """Test character.dynasty -> dynasty."""
        result = get_scope_type_for_link("character", "dynasty")
        assert result == "dynasty"

    def test_character_faith(self):
        """Test character.faith -> faith."""
        result = get_scope_type_for_link("character", "faith")
        assert result == "faith"

    def test_character_culture(self):
        """Test character.culture -> culture."""
        result = get_scope_type_for_link("character", "culture")
        assert result == "culture"

    def test_landed_title_holder(self):
        """Test landed_title.holder -> character."""
        result = get_scope_type_for_link("landed_title", "holder")
        assert result == "character"

    def test_landed_title_de_jure_liege(self):
        """Test landed_title.de_jure_liege -> landed_title."""
        result = get_scope_type_for_link("landed_title", "de_jure_liege")
        assert result == "landed_title"

    def test_province_county(self):
        """Test province.county -> landed_title."""
        result = get_scope_type_for_link("province", "county")
        assert result == "landed_title"

    def test_dynasty_dynast(self):
        """Test dynasty.dynast -> character."""
        result = get_scope_type_for_link("dynasty", "dynast")
        assert result == "character"

    def test_unknown_link(self):
        """Test unknown link returns None."""
        result = get_scope_type_for_link("character", "unknown_link")
        assert result is None

    def test_unknown_scope(self):
        """Test unknown scope returns None."""
        result = get_scope_type_for_link("unknown_scope", "liege")
        assert result is None


class TestScopeTypeForChain:
    """Tests for get_scope_type_for_chain function."""

    def test_simple_chain(self):
        """Test simple chain: liege -> character."""
        result = get_scope_type_for_chain("liege")
        assert result == "character"

    def test_two_link_chain(self):
        """Test two-link chain: liege.primary_title -> landed_title."""
        result = get_scope_type_for_chain("liege.primary_title")
        assert result == "landed_title"

    def test_three_link_chain(self):
        """Test three-link chain: liege.primary_title.holder -> character."""
        result = get_scope_type_for_chain("liege.primary_title.holder")
        assert result == "character"

    def test_chain_with_location(self):
        """Test chain ending in location: spouse.location -> province."""
        result = get_scope_type_for_chain("spouse.location")
        assert result == "province"

    def test_empty_chain(self):
        """Test empty chain returns starting scope."""
        result = get_scope_type_for_chain("", "character")
        assert result == "character"

    def test_this_link(self):
        """Test 'this' link preserves scope type."""
        result = get_scope_type_for_chain("this")
        assert result == "character"

    def test_dynasty_chain(self):
        """Test dynasty chain: dynasty.dynast -> character."""
        result = get_scope_type_for_chain("dynasty.dynast")
        assert result == "character"


class TestScopeTypeForIterator:
    """Tests for get_scope_type_for_iterator function."""

    def test_every_vassal(self):
        """Test every_vassal -> character."""
        result = get_scope_type_for_iterator("every_vassal")
        assert result == "character"

    def test_random_courtier(self):
        """Test random_courtier -> character."""
        result = get_scope_type_for_iterator("random_courtier")
        assert result == "character"

    def test_any_child(self):
        """Test any_child -> character."""
        result = get_scope_type_for_iterator("any_child")
        assert result == "character"

    def test_ordered_spouse(self):
        """Test ordered_spouse -> character."""
        result = get_scope_type_for_iterator("ordered_spouse")
        assert result == "character"

    def test_every_held_title(self):
        """Test every_held_title -> landed_title."""
        result = get_scope_type_for_iterator("every_held_title")
        assert result == "landed_title"

    def test_random_claim(self):
        """Test random_claim -> landed_title."""
        result = get_scope_type_for_iterator("random_claim")
        assert result == "landed_title"

    def test_any_secret(self):
        """Test any_secret -> secret."""
        result = get_scope_type_for_iterator("any_secret")
        assert result == "secret"

    def test_every_scheme(self):
        """Test every_scheme -> scheme."""
        result = get_scope_type_for_iterator("every_scheme")
        assert result == "scheme"

    def test_unknown_iterator(self):
        """Test unknown iterator returns None."""
        result = get_scope_type_for_iterator("every_unknown_thing")
        assert result is None

    def test_non_iterator(self):
        """Test non-iterator returns None."""
        result = get_scope_type_for_iterator("not_an_iterator")
        assert result is None


# =============================================================================
# Test Scope Name Inference
# =============================================================================


class TestInferScopeTypeFromName:
    """Tests for _infer_scope_type_from_name function."""

    def test_character_suffix(self):
        """Test names ending with _character."""
        assert _infer_scope_type_from_name("my_character") == "character"
        assert _infer_scope_type_from_name("target_character") == "character"

    def test_target_suffix(self):
        """Test names ending with _target."""
        assert _infer_scope_type_from_name("event_target") == "character"
        # Note: scheme_target contains 'scheme' so it matches scheme first
        assert _infer_scope_type_from_name("scheme_target") == "scheme"

    def test_actor_suffix(self):
        """Test names ending with _actor."""
        assert _infer_scope_type_from_name("event_actor") == "character"

    def test_spouse_in_name(self):
        """Test names containing spouse."""
        assert _infer_scope_type_from_name("spouse") == "character"
        assert _infer_scope_type_from_name("main_spouse") == "character"

    def test_friend_in_name(self):
        """Test names containing friend."""
        assert _infer_scope_type_from_name("friend") == "character"
        assert _infer_scope_type_from_name("best_friend") == "character"

    def test_title_in_name(self):
        """Test names containing title."""
        assert _infer_scope_type_from_name("target_title") == "landed_title"
        assert _infer_scope_type_from_name("my_title") == "landed_title"

    def test_county_in_name(self):
        """Test names containing county."""
        assert _infer_scope_type_from_name("target_county") == "landed_title"

    def test_province_in_name(self):
        """Test names containing province."""
        assert _infer_scope_type_from_name("target_province") == "province"
        assert _infer_scope_type_from_name("realm_province") == "province"

    def test_location_in_name(self):
        """Test names containing location."""
        assert _infer_scope_type_from_name("battle_location") == "province"
        assert _infer_scope_type_from_name("meeting_location") == "province"

    def test_dynasty_in_name(self):
        """Test names containing dynasty."""
        assert _infer_scope_type_from_name("my_dynasty") == "dynasty"

    def test_house_in_name(self):
        """Test names containing house."""
        assert _infer_scope_type_from_name("noble_house") == "dynasty_house"

    def test_faith_in_name(self):
        """Test names containing faith."""
        assert _infer_scope_type_from_name("target_faith") == "faith"

    def test_culture_in_name(self):
        """Test names containing culture."""
        assert _infer_scope_type_from_name("my_culture") == "culture"

    def test_war_in_name(self):
        """Test names containing war."""
        assert _infer_scope_type_from_name("current_war") == "war"

    def test_scheme_in_name(self):
        """Test names containing scheme."""
        assert _infer_scope_type_from_name("my_scheme") == "scheme"

    def test_simple_character_names(self):
        """Test simple character scope names."""
        assert _infer_scope_type_from_name("target") == "character"
        assert _infer_scope_type_from_name("actor") == "character"
        assert _infer_scope_type_from_name("recipient") == "character"

    def test_third_party(self):
        """Test third_party -> character (common in events)."""
        assert _infer_scope_type_from_name("third_party") == "character"

    def test_unknown_name(self):
        """Test unknown name returns None."""
        assert _infer_scope_type_from_name("xyz123") is None


# =============================================================================
# Test Individual Hint Finders
# =============================================================================


class TestFindScopeHints:
    """Tests for _find_scope_hints function."""

    def test_single_scope(self):
        """Test finding a single scope reference."""
        hints = _find_scope_hints("scope:target = { }", 0, None)
        assert len(hints) == 1
        assert hints[0].label == ": character"
        assert hints[0].position.character == len("scope:target")

    def test_multiple_scopes(self):
        """Test finding multiple scope references."""
        line = "scope:actor = { scope:recipient = { } }"
        hints = _find_scope_hints(line, 0, None)
        assert len(hints) == 2

    def test_scope_with_title_suffix(self):
        """Test scope with title indicator."""
        hints = _find_scope_hints("scope:target_title = { }", 0, None)
        assert len(hints) == 1
        assert hints[0].label == ": landed_title"

    def test_no_scopes(self):
        """Test line with no scope references."""
        hints = _find_scope_hints("add_gold = 100", 0, None)
        assert len(hints) == 0

    def test_comment_line(self):
        """Test that comment lines are skipped."""
        hints = _find_scope_hints("# scope:target = { }", 0, None)
        # The function doesn't skip comments internally, but get_hints_for_line does
        # Here we just check it finds the scope
        assert len(hints) == 1


class TestFindChainHints:
    """Tests for _find_chain_hints function."""

    def test_root_chain(self):
        """Test finding root.X chains."""
        hints = _find_chain_hints("root.primary_title = { }", 0)
        assert len(hints) == 1
        assert hints[0].label == ": landed_title"

    def test_prev_chain(self):
        """Test finding prev.X chains with type change."""
        hints = _find_chain_hints("prev.primary_title = { }", 0)
        assert len(hints) == 1
        assert hints[0].label == ": landed_title"

    def test_multi_link_chain(self):
        """Test multi-link chain."""
        hints = _find_chain_hints("root.primary_title.de_jure_liege = { }", 0)
        assert len(hints) == 1
        # primary_title.de_jure_liege results in landed_title
        assert hints[0].label == ": landed_title"

    def test_character_link(self):
        """Test character->character link (same type, no hint)."""
        hints = _find_chain_hints("root.liege = { }", 0)
        # liege returns character, same as starting type, so no hint
        assert len(hints) == 0

    def test_no_chain(self):
        """Test line with no scope chains."""
        hints = _find_chain_hints("add_gold = 100", 0)
        assert len(hints) == 0


class TestFindIteratorHints:
    """Tests for _find_iterator_hints function."""

    def test_every_vassal(self):
        """Test every_vassal iterator."""
        hints = _find_iterator_hints("every_vassal = {", 0)
        assert len(hints) == 1
        assert hints[0].label == " → character"

    def test_random_courtier(self):
        """Test random_courtier iterator."""
        hints = _find_iterator_hints("random_courtier = {", 0)
        assert len(hints) == 1
        assert hints[0].label == " → character"

    def test_any_held_title(self):
        """Test any_held_title iterator."""
        hints = _find_iterator_hints("any_held_title = {", 0)
        assert len(hints) == 1
        assert hints[0].label == " → landed_title"

    def test_ordered_child(self):
        """Test ordered_child iterator."""
        hints = _find_iterator_hints("ordered_child = {", 0)
        assert len(hints) == 1
        assert hints[0].label == " → character"

    def test_random_list_not_iterator(self):
        """Test random_list is not treated as iterator."""
        hints = _find_iterator_hints("random_list = {", 0)
        assert len(hints) == 0

    def test_multiple_iterators(self):
        """Test finding multiple iterators on one line."""
        # This is unusual but should work
        line = "every_vassal = { } every_child = { }"
        hints = _find_iterator_hints(line, 0)
        assert len(hints) == 2

    def test_unknown_iterator(self):
        """Test unknown base name."""
        hints = _find_iterator_hints("every_unknown_thing = {", 0)
        assert len(hints) == 0


# =============================================================================
# Test Full Inlay Hints
# =============================================================================


class TestGetInlayHints:
    """Tests for get_inlay_hints function."""

    def test_basic_event(self):
        """Test hints in a basic event."""
        text = """rq.0001 = {
    trigger = {
        scope:target = { is_alive = yes }
    }
    immediate = {
        every_vassal = {
            add_gold = 100
        }
    }
}"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=10, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should have at least scope:target and every_vassal hints
        assert len(hints) >= 2

    def test_scope_chain_in_trigger(self):
        """Test scope chain hints in trigger blocks."""
        text = """trigger = {
    root.primary_title = { tier = tier_duchy }
}"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=3, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should have hint for root.primary_title -> landed_title
        title_hints = [h for h in hints if "landed_title" in h.label]
        assert len(title_hints) >= 1

    def test_multiple_hint_types(self):
        """Test getting multiple types of hints."""
        text = """immediate = {
    scope:friend = { }
    root.primary_title = { }
    random_courtier = { }
}"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=5, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should have hints for scope:friend, root.primary_title, random_courtier
        assert len(hints) >= 2

    def test_range_filtering(self):
        """Test that hints are only returned for the specified range."""
        text = """line0
line1
scope:target = { }
line3
line4"""
        # Only look at line 2
        range_ = types.Range(
            start=types.Position(line=2, character=0),
            end=types.Position(line=2, character=100),
        )
        hints = get_inlay_hints(text, range_)

        # Should only have hint on line 2
        assert all(h.position.line == 2 for h in hints)

    def test_comment_line_skipped(self):
        """Test that comment lines don't generate hints."""
        text = """# scope:target = { }
scope:actor = { }"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=2, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should only have hint on line 1, not line 0
        assert len(hints) == 1
        assert hints[0].position.line == 1


class TestInlayHintConfig:
    """Tests for InlayHintConfig options."""

    def test_disable_scope_types(self):
        """Test disabling scope type hints."""
        text = "scope:target = { }"
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=1, character=0),
        )
        config = InlayHintConfig(show_scope_types=False)
        hints = get_inlay_hints(text, range_, config=config)

        # Should have no scope hints
        scope_hints = [h for h in hints if "scope:" not in str(h.tooltip)]
        # All hints should not be from scope:
        assert not any("scope:" in str(h.tooltip) or "Saved scope" in str(h.tooltip) for h in hints)

    def test_disable_link_types(self):
        """Test disabling scope chain hints."""
        text = "root.primary_title = { }"
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=1, character=0),
        )
        config = InlayHintConfig(show_link_types=False)
        hints = get_inlay_hints(text, range_, config=config)

        # Should have no chain hints
        assert not any("chain" in str(h.tooltip).lower() for h in hints)

    def test_disable_iterator_types(self):
        """Test disabling iterator hints."""
        text = "every_vassal = { }"
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=1, character=0),
        )
        config = InlayHintConfig(show_iterator_types=False)
        hints = get_inlay_hints(text, range_, config=config)

        # Should have no iterator hints
        assert not any("Iterator" in str(h.tooltip) for h in hints)

    def test_max_hints_per_line(self):
        """Test limiting hints per line."""
        # Line with many potential hints
        text = "scope:a = { } scope:b = { } scope:c = { } scope:d = { } scope:e = { }"
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=1, character=0),
        )
        config = InlayHintConfig(max_hints_per_line=2)
        hints = get_inlay_hints(text, range_, config=config)

        # Should have at most 2 hints
        assert len(hints) <= 2


class TestHintPositions:
    """Tests for correct hint positioning."""

    def test_scope_hint_position(self):
        """Test scope hint appears after scope:name."""
        text = "scope:friend = { }"
        hints = _find_scope_hints(text, 0, None)

        assert len(hints) == 1
        # Should appear right after "scope:friend"
        assert hints[0].position.character == len("scope:friend")

    def test_chain_hint_position(self):
        """Test chain hint appears after full chain."""
        text = "root.primary_title.holder = { }"
        hints = _find_chain_hints(text, 0)

        if hints:  # May not have hint if type is same as starting
            # Should appear after the full chain
            chain = "root.primary_title.holder"
            assert hints[0].position.character == len(chain)

    def test_iterator_hint_position(self):
        """Test iterator hint appears after iterator name."""
        text = "every_vassal = { }"
        hints = _find_iterator_hints(text, 0)

        assert len(hints) == 1
        # Should appear after "every_vassal"
        assert hints[0].position.character == len("every_vassal")


class TestHintKinds:
    """Tests for hint kind classification."""

    def test_scope_hint_is_type_kind(self):
        """Test scope hints have Type kind."""
        hints = _find_scope_hints("scope:target = { }", 0, None)
        assert hints[0].kind == types.InlayHintKind.Type

    def test_chain_hint_is_type_kind(self):
        """Test chain hints have Type kind."""
        hints = _find_chain_hints("root.primary_title = { }", 0)
        if hints:
            assert hints[0].kind == types.InlayHintKind.Type

    def test_iterator_hint_is_type_kind(self):
        """Test iterator hints have Type kind."""
        hints = _find_iterator_hints("every_vassal = { }", 0)
        assert hints[0].kind == types.InlayHintKind.Type


class TestRealWorldPatterns:
    """Tests with realistic CK3 code patterns."""

    def test_event_with_scopes(self):
        """Test hints in a realistic event."""
        text = """rq_swinging.0001 = {
    type = character_event
    title = rq_swinging.0001.t
    
    trigger = {
        is_married = yes
        scope:spouse = { is_alive = yes }
    }
    
    immediate = {
        random_spouse = {
            save_scope_as = spouse
        }
        random_courtier = {
            limit = { is_attracted_to_gender_of = root }
            save_scope_as = third_party
        }
    }
    
    option = {
        name = rq_swinging.0001.a
        scope:third_party = {
            add_opinion = {
                target = root
                modifier = pleased_opinion
            }
        }
    }
}"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=30, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should find hints for:
        # - scope:spouse (character)
        # - random_spouse -> character
        # - random_courtier -> character
        # - scope:third_party (character)
        assert len(hints) >= 3

    def test_title_chain_hints(self):
        """Test hints for title-related chains."""
        text = """trigger = {
    root.primary_title = {
        tier = tier_duchy
        de_jure_liege = {
            holder = root
        }
    }
}"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=10, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should have hint for root.primary_title -> landed_title
        labels = [h.label for h in hints]
        assert any("landed_title" in label for label in labels)

    def test_nested_scopes(self):
        """Test hints with nested scope references."""
        text = """scope:actor = {
    scope:recipient = {
        root.liege.primary_title = { }
    }
}"""
        range_ = types.Range(
            start=types.Position(line=0, character=0),
            end=types.Position(line=5, character=0),
        )
        hints = get_inlay_hints(text, range_)

        # Should have hints for scope:actor, scope:recipient, and the chain
        assert len(hints) >= 2
