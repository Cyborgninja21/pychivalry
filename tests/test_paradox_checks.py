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
        text = '''test.0001 = {
    trigger = {
        add_gold = 100
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3870" in codes

    def test_effect_in_limit_block_error(self):
        """Effect used in limit block should produce CK3871."""
        text = '''test.0001 = {
    immediate = {
        every_vassal = {
            limit = {
                add_gold = 100
            }
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3871" in codes

    def test_trigger_in_trigger_block_ok(self):
        """Triggers in trigger block should be OK."""
        text = '''test.0001 = {
    trigger = {
        is_adult = yes
        has_trait = brave
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        assert len(diagnostics) == 0

    def test_effect_in_immediate_ok(self):
        """Effects in immediate block should be OK."""
        text = '''test.0001 = {
    immediate = {
        add_gold = 100
        add_prestige = 50
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        assert len(diagnostics) == 0

    def test_control_flow_in_trigger_ok(self):
        """Control flow keywords in trigger should be OK."""
        text = '''test.0001 = {
    trigger = {
        OR = {
            is_adult = yes
            has_trait = brave
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_effect_in_trigger_context(ast, None, config)
        assert len(diagnostics) == 0


class TestListIteratorMisuse:
    """Tests for list iterator validation."""

    def test_effect_in_any_iterator_error(self):
        """Effect in any_ iterator should produce CK3976."""
        text = '''test.0001 = {
    trigger = {
        any_vassal = {
            add_gold = 100
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3976" in codes

    def test_trigger_in_any_iterator_ok(self):
        """Triggers in any_ iterator should be OK."""
        text = '''test.0001 = {
    trigger = {
        any_vassal = {
            is_adult = yes
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        # No CK3976 errors
        errors = [d for d in diagnostics if d.code == "CK3976"]
        assert len(errors) == 0

    def test_every_without_limit_info(self):
        """every_ without limit should produce CK3977 info."""
        text = '''test.0001 = {
    immediate = {
        every_vassal = {
            add_gold = 100
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3977" in codes

    def test_every_with_limit_ok(self):
        """every_ with limit should be OK."""
        text = '''test.0001 = {
    immediate = {
        every_vassal = {
            limit = { is_adult = yes }
            add_gold = 100
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        # No CK3977 info
        info = [d for d in diagnostics if d.code == "CK3977"]
        assert len(info) == 0

    def test_random_without_limit_warning(self):
        """random_ without limit should produce CK3875 warning."""
        text = '''test.0001 = {
    immediate = {
        random_vassal = {
            add_gold = 100
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_list_iterator_misuse(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3875" in codes


class TestOpinionModifiers:
    """Tests for opinion modifier validation."""

    def test_inline_opinion_error(self):
        """Inline opinion value should produce CK3656."""
        text = '''test.0001 = {
    immediate = {
        add_opinion = {
            target = scope:target
            opinion = -50
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_opinion_modifiers(ast, None, config)
        codes = [d.code for d in diagnostics]
        assert "CK3656" in codes

    def test_modifier_reference_ok(self):
        """Opinion modifier by reference should be OK."""
        text = '''test.0001 = {
    immediate = {
        add_opinion = {
            target = scope:target
            modifier = betrayed_opinion
        }
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_opinion_modifiers(ast, None, config)
        assert len(diagnostics) == 0


class TestEventStructure:
    """Tests for event structure validation."""

    def test_event_missing_type_error(self):
        """Event without type should produce CK3760."""
        text = '''test.0001 = {
    title = test.0001.t
    desc = test.0001.desc
    option = { name = test.0001.a }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3760" in codes

    def test_event_missing_options_warning(self):
        """Event without options should produce CK3763."""
        text = '''test.0001 = {
    type = character_event
    title = test.0001.t
    desc = test.0001.desc
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3763" in codes

    def test_multiple_immediate_blocks_error(self):
        """Multiple immediate blocks should produce CK3768."""
        text = '''test.0001 = {
    type = character_event
    immediate = {
        add_gold = 100
    }
    immediate = {
        add_prestige = 50
    }
    option = { name = test.0001.a }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3768" in codes

    def test_complete_event_ok(self):
        """Complete event structure should be OK."""
        text = '''test.0001 = {
    type = character_event
    title = test.0001.t
    desc = test.0001.desc
    immediate = {
        add_gold = 100
    }
    option = { name = test.0001.a }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_event_structure(ast, config)
        assert len(diagnostics) == 0


class TestRedundantTriggers:
    """Tests for redundant trigger detection."""

    def test_always_yes_redundant(self):
        """trigger = { always = yes } should produce CK3872."""
        text = '''test.0001 = {
    trigger = {
        always = yes
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_redundant_triggers(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3872" in codes

    def test_always_no_warning(self):
        """trigger = { always = no } should produce CK3873."""
        text = '''test.0001 = {
    trigger = {
        always = no
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_redundant_triggers(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK3873" in codes

    def test_normal_trigger_ok(self):
        """Normal trigger conditions should be OK."""
        text = '''test.0001 = {
    trigger = {
        is_adult = yes
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_redundant_triggers(ast, config)
        assert len(diagnostics) == 0


class TestCommonGotchas:
    """Tests for common CK3 gotcha detection."""

    def test_character_comparison_with_equals_error(self):
        """Character comparison with = should produce CK5142."""
        text = '''test.0001 = {
    trigger = {
        scope:target = scope:other
    }
}'''
        ast = parse_document(text)
        config = ParadoxConfig()
        diagnostics = check_common_gotchas(ast, config)
        codes = [d.code for d in diagnostics]
        assert "CK5142" in codes

    def test_character_comparison_with_this_ok(self):
        """Character comparison with this = should be OK."""
        text = '''test.0001 = {
    trigger = {
        scope:target = {
            this = scope:other
        }
    }
}'''
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
        text = '''test.0001 = {
    type = character_event
    trigger = {
        scope:friend = { is_alive = yes }
    }
    immediate = {
        random_friend = { save_scope_as = friend }
    }
    option = { name = test.0001.a }
}'''
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        codes = [d.code for d in diagnostics]
        assert "CK3550" in codes

    def test_scope_from_caller_ok(self):
        """Scope passed from calling event should be OK (no immediate definition)."""
        text = '''test.0001 = {
    type = character_event
    trigger = {
        scope:friend = { is_alive = yes }
    }
    immediate = {
        # No save_scope_as here - scope comes from caller
        add_gold = 100
    }
    option = { name = test.0001.a }
}'''
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        # Should NOT produce CK3550 (scope might come from caller)
        errors = [d for d in diagnostics if d.code == "CK3550"]
        assert len(errors) == 0


class TestScopeTimingDesc:
    """Tests for scope timing in desc blocks."""

    def test_scope_in_triggered_desc_trigger_error(self):
        """Scope in triggered_desc trigger defined in immediate should produce CK3552."""
        text = '''test.0001 = {
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
}'''
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        codes = [d.code for d in diagnostics]
        assert "CK3552" in codes


class TestVariableTiming:
    """Tests for variable timing validation."""

    def test_variable_in_trigger_set_in_immediate_error(self):
        """Variable checked in trigger but set in immediate should produce CK3553."""
        text = '''test.0001 = {
    type = character_event
    trigger = {
        has_variable = my_var
    }
    immediate = {
        set_variable = { name = my_var value = 1 }
    }
    option = { name = test.0001.a }
}'''
        ast = parse_document(text)
        diagnostics = check_scope_timing(ast)
        codes = [d.code for d in diagnostics]
        assert "CK3553" in codes


class TestParadoxIntegration:
    """Integration tests for full Paradox convention checking."""

    def test_clean_event_minimal_diagnostics(self):
        """A well-written event should produce minimal diagnostics."""
        text = '''namespace = test

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
}'''
        ast = parse_document(text)
        diagnostics = check_paradox_conventions(ast)
        # Should have very few errors
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) == 0

    def test_problematic_event_catches_issues(self):
        """An event with multiple issues should catch them."""
        text = '''test.0001 = {
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
}'''
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
