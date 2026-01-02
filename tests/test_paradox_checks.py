"""
Tests for paradox_checks and scope_timing modules.

Tests Paradox-specific convention validation including:
- Effect/trigger context violations (CK38xx)
- List iterator misuse (CK39xx)
- Opinion modifier issues (CK36xx)
- Event structure validation (CK37xx)
- Scope timing issues (CK3550-3555)
"""

import pytest
from lsprotocol import types

from pychivalry.parser import parse_document
from pychivalry.paradox_checks import (
    check_paradox_conventions,
    check_effect_in_trigger_context,
    check_list_iterator_misuse,
    check_opinion_modifiers,
    check_event_structure,
    check_redundant_triggers,
    check_common_gotchas,
    ParadoxConfig,
)
from pychivalry.scope_timing import (
    check_scope_timing,
    check_event_scope_timing,
    check_variable_timing,
    ScopeTimingConfig,
)


class TestEffectInTriggerContext:
    """Tests for effect/trigger context validation."""

    def test_effect_in_trigger_block_error(self):
        """Effect used in trigger block should produce CK3870."""
        text = """test.0001 = {
    trigger = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3870" in codes

    def test_effect_in_limit_block_error(self):
        """Effect used in limit block should produce CK3871."""
        text = """test.0001 = {
    immediate = {
        every_vassal = {
            limit = {
                add_gold = 100
            }
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3871" in codes

    def test_trigger_in_trigger_block_ok(self):
        """Triggers in trigger block should be OK."""
        text = """test.0001 = {
    trigger = {
        is_adult = yes
        has_trait = brave
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        assert len(diagnostics) == 0

    def test_effect_in_immediate_ok(self):
        """Effects in immediate block should be OK."""
        text = """test.0001 = {
    immediate = {
        add_gold = 100
        add_prestige = 50
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        assert len(diagnostics) == 0

    def test_control_flow_in_trigger_ok(self):
        """Control flow keywords in trigger should be OK."""
        text = """test.0001 = {
    trigger = {
        OR = {
            is_adult = yes
            has_trait = brave
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        assert len(diagnostics) == 0


class TestListIteratorMisuse:
    """Tests for list iterator validation."""

    def test_effect_in_any_iterator_error(self):
        """Effect in any_ iterator should produce CK3976."""
        text = """test.0001 = {
    trigger = {
        any_vassal = {
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3976" in codes

    def test_trigger_in_any_iterator_ok(self):
        """Triggers in any_ iterator should be OK."""
        text = """test.0001 = {
    trigger = {
        any_vassal = {
            is_adult = yes
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        # No CK3976 errors
        errors = [d for d in diagnostics if d.code == "CK3976"]
        assert len(errors) == 0

    def test_every_without_limit_info(self):
        """every_ without limit should produce CK3977 info."""
        text = """test.0001 = {
    immediate = {
        every_vassal = {
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3977" in codes

    def test_every_with_limit_ok(self):
        """every_ with limit should be OK."""
        text = """test.0001 = {
    immediate = {
        every_vassal = {
            limit = { is_adult = yes }
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        # No CK3977 info
        info = [d for d in diagnostics if d.code == "CK3977"]
        assert len(info) == 0

    def test_random_without_limit_warning(self):
        """random_ without limit should produce CK3875 warning."""
        text = """test.0001 = {
    immediate = {
        random_vassal = {
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3875" in codes


class TestOpinionModifiers:
    """Tests for opinion modifier validation."""

    def test_inline_opinion_error(self):
        """Inline opinion value should produce CK3656."""
        text = """test.0001 = {
    immediate = {
        add_opinion = {
            target = scope:target
            opinion = -50
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_opinion_modifiers(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3656" in codes

    def test_modifier_reference_ok(self):
        """Opinion modifier by reference should be OK."""
        text = """test.0001 = {
    immediate = {
        add_opinion = {
            target = scope:target
            modifier = betrayed_opinion
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_opinion_modifiers(ast, None, config)
        assert len(diagnostics) == 0


class TestEventStructure:
    """Tests for event structure validation."""

    def test_event_missing_type_error(self):
        """Event without type should produce CK3760."""
        text = """test.0001 = {
    title = test.0001.t
    desc = test.0001.desc
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3760" in codes

    def test_event_missing_options_warning(self):
        """Event without options should produce CK3763."""
        text = """test.0001 = {
    type = character_event
    title = test.0001.t
    desc = test.0001.desc
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3763" in codes

    def test_multiple_immediate_blocks_error(self):
        """Multiple immediate blocks should produce CK3768."""
        text = """test.0001 = {
    type = character_event
    immediate = {
        add_gold = 100
    }
    immediate = {
        add_prestige = 50
    }
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3768" in codes

    def test_complete_event_ok(self):
        """Complete event structure should be OK."""
        text = """test.0001 = {
    type = character_event
    title = test.0001.t
    desc = test.0001.desc
    immediate = {
        add_gold = 100
    }
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        assert len(diagnostics) == 0


class TestRedundantTriggers:
    """Tests for redundant trigger detection."""

    def test_always_yes_redundant(self):
        """trigger = { always = yes } should produce CK3872."""
        text = """test.0001 = {
    trigger = {
        always = yes
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_redundant_triggers(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3872" in codes

    def test_always_no_warning(self):
        """trigger = { always = no } should produce CK3873."""
        text = """test.0001 = {
    trigger = {
        always = no
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_redundant_triggers(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3873" in codes

    def test_normal_trigger_ok(self):
        """Normal trigger conditions should be OK."""
        text = """test.0001 = {
    trigger = {
        is_adult = yes
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_redundant_triggers(ast, config)
        assert len(diagnostics) == 0


class TestCommonGotchas:
    """Tests for common CK3 gotcha detection."""

    def test_character_comparison_with_equals_error(self):
        """Character comparison with = should produce CK5142."""
        text = """test.0001 = {
    trigger = {
        scope:target = scope:other
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_common_gotchas(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK5142" in codes

    def test_character_comparison_with_this_ok(self):
        """Character comparison with this = should be OK."""
        text = """test.0001 = {
    trigger = {
        scope:target = {
            this = scope:other
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_common_gotchas(ast, config)
        # Should NOT produce CK5142
        errors = [d for d in diagnostics if d.code == "CK5142"]
        assert len(errors) == 0


class TestScopeTimingTrigger:
    """Tests for scope timing in trigger blocks."""

    def test_scope_in_trigger_defined_in_immediate_error(self):
        """Scope used in trigger but defined in immediate should produce CK3550."""
        text = """test.0001 = {
    type = character_event
    trigger = {
        scope:friend = { is_alive = yes }
    }
    immediate = {
        random_friend = { save_scope_as = friend }
    }
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        codes = [d.code for d in diagnostics]
        assert "CK3550" in codes

    def test_scope_from_caller_ok(self):
        """Scope passed from calling event should be OK (no immediate definition)."""
        text = """test.0001 = {
    type = character_event
    trigger = {
        scope:friend = { is_alive = yes }
    }
    immediate = {
        # No save_scope_as here - scope comes from caller
        add_gold = 100
    }
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        # Should NOT produce CK3550 (scope might come from caller)
        errors = [d for d in diagnostics if d.code == "CK3550"]
        assert len(errors) == 0


class TestScopeTimingDesc:
    """Tests for scope timing in desc blocks."""

    def test_scope_in_triggered_desc_trigger_error(self):
        """Scope in triggered_desc trigger defined in immediate should produce CK3552."""
        text = """test.0001 = {
    type = character_event
    desc = {
        triggered_desc = {
            trigger = { scope:friend = { is_alive = yes } }
            desc = test.0001.desc.friend
        }
    }
    immediate = {
        random_friend = { save_scope_as = friend }
    }
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        codes = [d.code for d in diagnostics]
        assert "CK3552" in codes


class TestVariableTiming:
    """Tests for variable timing validation."""

    def test_variable_in_trigger_set_in_immediate_error(self):
        """Variable checked in trigger but set in immediate should produce CK3553."""
        text = """test.0001 = {
    type = character_event
    trigger = {
        has_variable = my_var
    }
    immediate = {
        set_variable = { name = my_var value = 1 }
    }
    option = { name = test.0001.a }
}"""
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        codes = [d.code for d in diagnostics]
        assert "CK3553" in codes


class TestParadoxIntegration:
    """Integration tests for full Paradox convention checking."""

    def test_clean_event_minimal_diagnostics(self):
        """A well-written event should produce minimal diagnostics."""
        text = """namespace = test

test.0001 = {
    type = character_event
    title = test.0001.t
    desc = test.0001.desc
    theme = intrigue
    
    trigger = {
        is_adult = yes
    }
    
    immediate = {
        random_friend = {
            limit = { is_alive = yes }
            save_scope_as = friend
        }
    }
    
    option = {
        name = test.0001.a
        scope:friend = { add_gold = 100 }
    }
}"""
        ast = parse_document(text)
        diagnostics = check_paradox_conventions(ast)
        # Should have very few errors
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) == 0

    def test_problematic_event_catches_issues(self):
        """An event with multiple issues should catch them."""
        text = """test.0001 = {
    trigger = {
        add_gold = 100
        any_vassal = {
            add_prestige = 50
        }
    }
    immediate = {
        add_opinion = {
            target = root
            opinion = -50
        }
    }
}"""
        ast = parse_document(text)
        diagnostics = check_paradox_conventions(ast)
        codes = [d.code for d in diagnostics]

        # Should catch effect in trigger (CK3870)
        assert "CK3870" in codes

        # Should catch effect in any_ (CK3976)
        assert "CK3976" in codes

        # Should catch inline opinion (CK3656)
        assert "CK3656" in codes

        # Should catch missing type (CK3760)
        assert "CK3760" in codes


# =============================================================================
# PHASE 1 QUICK WINS - Event Validation Tests
# =============================================================================


class TestEventTypeValidation:
    """Tests for CK3761: Invalid event type."""

    def test_valid_event_type_no_error(self):
        """Valid event types should not produce errors."""
        text = """mymod.0001 = {
    type = character_event
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_type_valid
        diagnostics = check_event_type_valid(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3761" not in codes

    def test_invalid_event_type_error(self):
        """Invalid event type should produce CK3761."""
        text = """mymod.0001 = {
    type = invalid_event_type
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_type_valid
        diagnostics = check_event_type_valid(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3761" in codes


class TestEventDescValidation:
    """Tests for CK3764: Missing desc in non-hidden event."""

    def test_event_with_desc_no_error(self):
        """Event with desc should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    desc = mymod.0001.desc
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_desc
        diagnostics = check_event_has_desc(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3764" not in codes

    def test_hidden_event_without_desc_no_error(self):
        """Hidden event without desc should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    hidden = yes
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_desc
        diagnostics = check_event_has_desc(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3764" not in codes

    def test_non_hidden_event_without_desc_error(self):
        """Non-hidden event without desc should produce CK3764."""
        text = """mymod.0001 = {
    type = character_event
    title = mymod.0001.t
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_desc
        diagnostics = check_event_has_desc(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3764" in codes


class TestOptionNameValidation:
    """Tests for CK3450: Option missing name."""

    def test_option_with_name_no_error(self):
        """Option with name should not produce error."""
        text = """mymod.0001 = {
    option = {
        name = mymod.0001.a
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_option_has_name
        diagnostics = check_option_has_name(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3450" not in codes

    def test_option_without_name_error(self):
        """Option without name should produce CK3450."""
        text = """mymod.0001 = {
    option = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_option_has_name
        diagnostics = check_option_has_name(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3450" in codes


class TestTriggeredDescValidation:
    """Tests for CK3440/CK3441: triggered_desc structure."""

    def test_triggered_desc_complete_no_error(self):
        """Complete triggered_desc should not produce error."""
        text = """mymod.0001 = {
    desc = {
        triggered_desc = {
            trigger = { always = yes }
            desc = mymod.0001.desc
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_triggered_desc_structure
        diagnostics = check_triggered_desc_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3440" not in codes
        assert "CK3441" not in codes

    def test_triggered_desc_missing_trigger_error(self):
        """triggered_desc without trigger should produce CK3440."""
        text = """mymod.0001 = {
    desc = {
        triggered_desc = {
            desc = mymod.0001.desc
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_triggered_desc_structure
        diagnostics = check_triggered_desc_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3440" in codes

    def test_triggered_desc_missing_desc_error(self):
        """triggered_desc without desc should produce CK3441."""
        text = """mymod.0001 = {
    desc = {
        triggered_desc = {
            trigger = { always = yes }
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_triggered_desc_structure
        diagnostics = check_triggered_desc_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3441" in codes


class TestPortraitPositionValidation:
    """Tests for CK3420: Invalid portrait position."""

    def test_valid_portrait_position_no_error(self):
        """Valid portrait positions should not produce error."""
        text = """mymod.0001 = {
    left_portrait = root
    right_portrait = scope:other
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_portrait_position
        diagnostics = check_portrait_position(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3420" not in codes

    def test_invalid_portrait_position_error(self):
        """Invalid portrait position should produce CK3420."""
        text = """mymod.0001 = {
    center_portrait = root
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_portrait_position
        diagnostics = check_portrait_position(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3420" in codes


class TestPortraitCharacterValidation:
    """Tests for CK3421: Portrait missing character."""

    def test_portrait_with_character_no_error(self):
        """Portrait with character should not produce error."""
        text = """mymod.0001 = {
    left_portrait = {
        character = root
        animation = happiness
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_portrait_has_character
        diagnostics = check_portrait_has_character(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3421" not in codes

    def test_portrait_without_character_warning(self):
        """Portrait without character should produce CK3421."""
        text = """mymod.0001 = {
    left_portrait = {
        animation = happiness
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_portrait_has_character
        diagnostics = check_portrait_has_character(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3421" in codes


class TestAnimationValidation:
    """Tests for CK3422: Invalid animation."""

    def test_valid_animation_no_error(self):
        """Valid animation should not produce error."""
        text = """mymod.0001 = {
    left_portrait = {
        character = root
        animation = happiness
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_animation_valid
        diagnostics = check_animation_valid(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3422" not in codes

    def test_invalid_animation_warning(self):
        """Invalid animation should produce CK3422."""
        text = """mymod.0001 = {
    left_portrait = {
        character = root
        animation = flying
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_animation_valid
        diagnostics = check_animation_valid(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3422" in codes


class TestThemeValidation:
    """Tests for CK3430: Invalid theme."""

    def test_valid_theme_no_error(self):
        """Valid theme should not produce error."""
        text = """mymod.0001 = {
    theme = diplomacy
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_theme_valid
        diagnostics = check_theme_valid(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3430" not in codes

    def test_invalid_theme_warning(self):
        """Invalid theme should produce CK3430."""
        text = """mymod.0001 = {
    theme = invalid_theme
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_theme_valid
        diagnostics = check_theme_valid(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3430" in codes


class TestHiddenEventOptionsValidation:
    """Tests for CK3762: Hidden event with options."""

    def test_hidden_event_no_options_no_error(self):
        """Hidden event without options should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    hidden = yes
    immediate = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_hidden_event_options
        diagnostics = check_hidden_event_options(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3762" not in codes

    def test_visible_event_with_options_no_error(self):
        """Visible event with options should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_hidden_event_options
        diagnostics = check_hidden_event_options(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3762" not in codes

    def test_hidden_event_with_options_warning(self):
        """Hidden event with options should produce CK3762."""
        text = """mymod.0001 = {
    type = character_event
    hidden = yes
    option = {
        name = mymod.0001.a
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_hidden_event_options
        diagnostics = check_hidden_event_options(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3762" in codes


class TestMultipleAfterBlocksValidation:
    """Tests for CK3766: Multiple after blocks."""

    def test_single_after_block_no_error(self):
        """Single after block should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    after = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_multiple_after_blocks
        diagnostics = check_multiple_after_blocks(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3766" not in codes

    def test_multiple_after_blocks_error(self):
        """Multiple after blocks should produce CK3766."""
        text = """mymod.0001 = {
    type = character_event
    after = {
        add_gold = 100
    }
    after = {
        add_prestige = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_multiple_after_blocks
        diagnostics = check_multiple_after_blocks(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3766" in codes


class TestEmptyEventValidation:
    """Tests for CK3767: Empty event block."""

    def test_event_with_content_no_error(self):
        """Event with content should not produce error."""
        text = """mymod.0001 = {
    type = character_event
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_empty_event
        diagnostics = check_empty_event(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3767" not in codes

    def test_empty_event_warning(self):
        """Empty event should produce CK3767."""
        text = """mymod.0001 = {
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_empty_event
        diagnostics = check_empty_event(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3767" in codes


class TestEventPortraitsValidation:
    """Tests for CK3769: Non-hidden event has no portraits."""

    def test_character_event_with_portraits_no_error(self):
        """Character event with portraits should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    left_portrait = root
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_portraits
        diagnostics = check_event_has_portraits(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3769" not in codes

    def test_hidden_character_event_no_portraits_no_error(self):
        """Hidden character event without portraits should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    hidden = yes
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_portraits
        diagnostics = check_event_has_portraits(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3769" not in codes

    def test_letter_event_no_portraits_no_error(self):
        """Letter event without portraits should not produce error."""
        text = """mymod.0001 = {
    type = letter_event
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_portraits
        diagnostics = check_event_has_portraits(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3769" not in codes

    def test_character_event_no_portraits_info(self):
        """Character event without portraits should produce CK3769 info."""
        text = """mymod.0001 = {
    type = character_event
    title = mymod.0001.t
    desc = mymod.0001.desc
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_event_has_portraits
        diagnostics = check_event_has_portraits(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3769" in codes


# =============================================================================
# TRIGGER EXTENSION VALIDATION TESTS (CK3510-CK3513)
# =============================================================================


class TestTriggerExtensions:
    """Tests for trigger_if/trigger_else validation."""

    def test_trigger_if_with_limit_no_error(self):
        """trigger_if with limit should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        trigger_if = {
            limit = { is_ai = yes }
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_trigger_extensions
        diagnostics = check_trigger_extensions(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3512" not in codes

    def test_trigger_if_missing_limit_error(self):
        """trigger_if without limit should produce CK3512."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        trigger_if = {
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_trigger_extensions
        diagnostics = check_trigger_extensions(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3512" in codes

    def test_trigger_if_empty_limit_warning(self):
        """trigger_if with empty limit should produce CK3513."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        trigger_if = {
            limit = { }
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_trigger_extensions
        diagnostics = check_trigger_extensions(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3513" in codes

    def test_trigger_else_without_trigger_if_error(self):
        """trigger_else without trigger_if should produce CK3510."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        trigger_else = {
            add_gold = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_trigger_extensions
        diagnostics = check_trigger_extensions(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3510" in codes

    def test_trigger_else_after_trigger_if_no_error(self):
        """trigger_else after trigger_if should not produce CK3510."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        trigger_if = {
            limit = { is_ai = yes }
            add_gold = 100
        }
        trigger_else = {
            add_prestige = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_trigger_extensions
        diagnostics = check_trigger_extensions(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3510" not in codes

    def test_multiple_trigger_else_error(self):
        """Multiple trigger_else blocks should produce CK3511."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        trigger_if = {
            limit = { is_ai = yes }
            add_gold = 100
        }
        trigger_else = {
            add_prestige = 100
        }
        trigger_else = {
            add_piety = 100
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_trigger_extensions
        diagnostics = check_trigger_extensions(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3511" in codes


# =============================================================================
# AFTER BLOCK VALIDATION TESTS (CK3520-CK3521)
# =============================================================================


class TestAfterBlockValidation:
    """Tests for after block validation."""

    def test_after_in_normal_event_no_error(self):
        """after block in normal event with options should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
    }
    after = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_after_block_issues
        diagnostics = check_after_block_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3520" not in codes
        assert "CK3521" not in codes

    def test_after_in_hidden_event_warning(self):
        """after block in hidden event should produce CK3520."""
        text = """mymod.0001 = {
    type = character_event
    hidden = yes
    after = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_after_block_issues
        diagnostics = check_after_block_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3520" in codes

    def test_after_without_options_warning(self):
        """after block without options should produce CK3521."""
        text = """mymod.0001 = {
    type = character_event
    desc = mymod.0001.desc
    after = {
        add_gold = 100
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_after_block_issues
        diagnostics = check_after_block_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3521" in codes


# =============================================================================
# AI CHANCE VALIDATION TESTS (CK3610-CK3614)
# =============================================================================


class TestAIChanceValidation:
    """Tests for ai_chance validation."""

    def test_ai_chance_normal_base_no_error(self):
        """ai_chance with normal base should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        ai_chance = {
            base = 50
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_ai_chance_issues
        diagnostics = check_ai_chance_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3610" not in codes
        assert "CK3611" not in codes
        assert "CK3612" not in codes

    def test_ai_chance_negative_base_warning(self):
        """ai_chance with negative base should produce CK3610."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        ai_chance = {
            base = -50
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_ai_chance_issues
        diagnostics = check_ai_chance_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3610" in codes

    def test_ai_chance_high_base_info(self):
        """ai_chance with high base should produce CK3611 info."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        ai_chance = {
            base = 150
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_ai_chance_issues
        diagnostics = check_ai_chance_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3611" in codes

    def test_ai_chance_zero_base_no_modifiers_warning(self):
        """ai_chance with zero base and no modifiers should produce CK3612."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        ai_chance = {
            base = 0
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_ai_chance_issues
        diagnostics = check_ai_chance_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3612" in codes

    def test_ai_chance_zero_base_with_modifiers_no_error(self):
        """ai_chance with zero base but modifiers should not produce CK3612."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        ai_chance = {
            base = 0
            modifier = {
                is_ai = yes
                add = 100
            }
        }
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_ai_chance_issues
        diagnostics = check_ai_chance_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3612" not in codes


# =============================================================================
# DESC VALIDATION TESTS (CK3442-CK3443)
# =============================================================================


class TestDescValidation:
    """Tests for desc block validation."""

    def test_desc_with_value_no_error(self):
        """desc with value should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    desc = mymod.0001.desc
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_desc_issues
        diagnostics = check_desc_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3443" not in codes

    def test_desc_with_triggered_desc_no_error(self):
        """triggered desc with content should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    desc = {
        trigger = { is_ai = yes }
        desc = mymod.0001.desc.ai
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_desc_issues
        diagnostics = check_desc_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3443" not in codes

    def test_empty_desc_block_warning(self):
        """Empty desc block should produce CK3443."""
        text = """mymod.0001 = {
    type = character_event
    desc = { }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_desc_issues
        diagnostics = check_desc_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3443" in codes


# =============================================================================
# OPTION VALIDATION TESTS (CK3453, CK3456)
# =============================================================================


class TestOptionValidation:
    """Tests for option block validation."""

    def test_option_single_name_no_error(self):
        """Option with single name should not produce error."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_option_issues
        diagnostics = check_option_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3453" not in codes

    def test_option_multiple_names_warning(self):
        """Option with multiple names should produce CK3453."""
        text = """mymod.0001 = {
    type = character_event
    option = {
        name = mymod.0001.a
        name = mymod.0001.b
    }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_option_issues
        diagnostics = check_option_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3453" in codes

    def test_empty_option_warning(self):
        """Empty option should produce CK3456."""
        text = """mymod.0001 = {
    type = character_event
    option = { }
}"""
        ast = parse_document(text)
        config = ParadoxConfig()
        from pychivalry.paradox_checks import check_option_issues
        diagnostics = check_option_issues(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3456" in codes
