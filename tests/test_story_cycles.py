"""
Tests for story cycle validation.

This module tests all diagnostic codes and parser functions for story cycle validation.
Tests cover timing validation, lifecycle hooks, effect groups, and triggered effects.
"""

import pytest
from lsprotocol.types import DiagnosticSeverity, Position, Range

from pychivalry.story_cycles import (
    StoryCycleDefinition,
    EffectGroup,
    TriggeredEffect,
    FirstValid,
    find_story_cycles,
    parse_story_cycle,
    parse_effect_group,
    parse_triggered_effect,
    parse_timing_value,
    validate_effect_group_timing,
    validate_triggered_effect,
    validate_story_cycle_lifecycle,
    validate_effect_group_logic,
    validate_story_cycle,
    collect_story_cycle_diagnostics,
)
from pychivalry.parser import parse_document


class TestTimingParsing:
    """Test timing value parsing."""

    def test_parse_timing_fixed_integer(self):
        """Test parsing fixed integer timing."""
        text = "days = 30"
        ast = parse_document(text)
        
        unit, value = parse_timing_value(ast[0])
        assert unit == "days"
        assert value == 30

    def test_parse_timing_range(self):
        """Test parsing range timing."""
        text = "months = { 12 24 }"
        ast = parse_document(text)
        
        unit, value = parse_timing_value(ast[0])
        assert unit == "months"
        assert value == (12, 24)

    def test_parse_timing_invalid_range(self):
        """Test parsing invalid range (min > max)."""
        text = "years = { 10 5 }"
        ast = parse_document(text)
        
        unit, value = parse_timing_value(ast[0])
        assert unit == "years"
        assert value == (10, 5)  # Parser doesn't validate order

    def test_parse_timing_missing_unit(self):
        """Test parsing timing without valid unit."""
        text = "invalid = 30"
        ast = parse_document(text)
        
        unit, value = parse_timing_value(ast[0])
        assert unit is None
        assert value is None


class TestEffectGroupParsing:
    """Test effect group parsing."""

    def test_parse_simple_effect_group(self):
        """Test parsing effect group with timing."""
        text = """effect_group = {
            days = 30
            add_gold = 100
        }"""
        ast = parse_document(text)
        
        effect_group = parse_effect_group(ast[0])
        assert effect_group is not None
        assert effect_group.timing_unit == "days"
        assert effect_group.timing_value == 30

    def test_parse_effect_group_with_range(self):
        """Test parsing effect group with range timing."""
        text = """effect_group = {
            months = { 6 12 }
            trigger = { always = yes }
            add_gold = 200
        }"""
        ast = parse_document(text)
        
        effect_group = parse_effect_group(ast[0])
        assert effect_group is not None
        assert effect_group.timing_unit == "months"
        assert effect_group.timing_value == (6, 12)

    def test_parse_effect_group_with_triggered_effects(self):
        """Test parsing effect group with triggered_effect blocks."""
        text = """effect_group = {
            days = 7
            triggered_effect = {
                trigger = { has_trait = brave }
                effect = { add_prestige = 100 }
            }
        }"""
        ast = parse_document(text)
        
        effect_group = parse_effect_group(ast[0])
        assert effect_group is not None
        assert len(effect_group.triggered_effects) == 1
        assert effect_group.triggered_effects[0].trigger is not None

    def test_parse_effect_group_missing_timing(self):
        """Test parsing effect group without timing."""
        text = """effect_group = {
            add_gold = 100
        }"""
        ast = parse_document(text)
        
        effect_group = parse_effect_group(ast[0])
        assert effect_group is not None
        assert effect_group.timing_unit is None
        assert effect_group.timing_value is None


class TestTriggeredEffectParsing:
    """Test triggered_effect parsing."""

    def test_parse_simple_triggered_effect(self):
        """Test parsing triggered_effect with trigger and effect."""
        text = """triggered_effect = {
            trigger = { has_trait = brave }
            effect = { add_prestige = 100 }
        }"""
        ast = parse_document(text)
        
        triggered = parse_triggered_effect(ast[0])
        assert triggered is not None
        assert triggered.trigger is not None
        assert triggered.effect is not None

    def test_parse_triggered_effect_with_chance(self):
        """Test parsing triggered_effect with chance modifier."""
        text = """triggered_effect = {
            trigger = { always = yes }
            chance = 50
            effect = { add_gold = 500 }
        }"""
        ast = parse_document(text)
        
        triggered = parse_triggered_effect(ast[0])
        assert triggered is not None
        assert triggered.chance == 50

    def test_parse_triggered_effect_with_first_valid(self):
        """Test parsing triggered_effect with first_valid."""
        text = """triggered_effect = {
            trigger = { always = yes }
            first_valid = {
                effect = { add_gold = 100 }
                effect = { add_prestige = 100 }
            }
        }"""
        ast = parse_document(text)
        
        triggered = parse_triggered_effect(ast[0])
        assert triggered is not None
        assert triggered.first_valid is not None
        assert len(triggered.first_valid.effects) == 2


class TestStoryCycleParsing:
    """Test complete story cycle parsing."""

    def test_parse_complete_story_cycle(self):
        """Test parsing a complete story cycle."""
        text = """destiny_child = {
            on_setup = {
                set_variable = { name = birth_time value = current_date }
            }
            on_end = {
                debug_log = "Story ended"
            }
            on_owner_death = {
                scope:story = { end_story = yes }
            }
            effect_group = {
                days = 30
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        story_cycles = find_story_cycles(ast[0])
        assert len(story_cycles) == 1
        
        story = parse_story_cycle(story_cycles[0])
        assert story.name == "destiny_child"
        assert story.on_setup is not None
        assert story.on_end is not None
        assert story.on_owner_death is not None
        assert len(story.effect_groups) == 1


class TestTimingValidation:
    """Test timing validation diagnostics."""

    def test_missing_timing_error(self):
        """Test STORY-001: Missing timing in effect group."""
        text = """story_test = {
            effect_group = {
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-001" in d.message for d in errors)

    def test_invalid_timing_range_error(self):
        """Test STORY-002: Invalid timing range (min > max)."""
        text = """story_test = {
            effect_group = {
                days = { 60 30 }
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-002" in d.message for d in errors)

    def test_negative_timing_value_error(self):
        """Test STORY-003: Negative timing value."""
        text = """story_test = {
            effect_group = {
                days = -10
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-003" in d.message for d in errors)

    def test_zero_timing_value_error(self):
        """Test STORY-004: Zero timing value."""
        text = """story_test = {
            effect_group = {
                days = 0
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-004" in d.message for d in errors)

    def test_very_short_timing_warning(self):
        """Test STORY-005: Very short timing interval."""
        text = """story_test = {
            effect_group = {
                days = 1
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-005" in d.message for d in warnings)

    def test_very_long_timing_warning(self):
        """Test STORY-006: Very long timing interval."""
        text = """story_test = {
            effect_group = {
                years = 50
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-006" in d.message for d in warnings)


class TestLifecycleValidation:
    """Test lifecycle hook validation."""

    def test_missing_on_setup_warning(self):
        """Test STORY-010: Missing on_setup hook."""
        text = """story_test = {
            effect_group = {
                days = 30
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-010" in d.message for d in warnings)

    def test_missing_on_owner_death_warning(self):
        """Test STORY-011: Missing on_owner_death hook."""
        text = """story_test = {
            on_setup = { add_gold = 100 }
            effect_group = {
                days = 30
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-011" in d.message for d in warnings)

    def test_empty_lifecycle_hook_warning(self):
        """Test STORY-012: Empty lifecycle hook."""
        text = """story_test = {
            on_setup = { }
            effect_group = {
                days = 30
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-012" in d.message for d in warnings)


class TestEffectGroupValidation:
    """Test effect group validation."""

    def test_empty_effect_group_warning(self):
        """Test STORY-020: Empty effect group."""
        text = """story_test = {
            effect_group = {
                days = 30
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-020" in d.message for d in warnings)

    def test_complex_effect_group_warning(self):
        """Test STORY-021: Complex effect group (performance concern)."""
        text = """story_test = {
            effect_group = {
                days = 1
                """ + "\n                ".join([f"add_gold = {i}" for i in range(20)]) + """
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-021" in d.message for d in warnings)


class TestTriggeredEffectValidation:
    """Test triggered_effect validation."""

    def test_missing_trigger_error(self):
        """Test STORY-030: Missing trigger in triggered_effect."""
        text = """story_test = {
            effect_group = {
                days = 30
                triggered_effect = {
                    effect = { add_gold = 100 }
                }
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-030" in d.message for d in errors)

    def test_missing_effect_error(self):
        """Test STORY-031: Missing effect in triggered_effect."""
        text = """story_test = {
            effect_group = {
                days = 30
                triggered_effect = {
                    trigger = { always = yes }
                }
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-031" in d.message for d in errors)

    def test_invalid_chance_error(self):
        """Test STORY-032: Invalid chance value."""
        text = """story_test = {
            effect_group = {
                days = 30
                triggered_effect = {
                    trigger = { always = yes }
                    chance = 150
                    effect = { add_gold = 100 }
                }
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-032" in d.message for d in errors)

    def test_always_true_trigger_warning(self):
        """Test STORY-033: Always-true trigger."""
        text = """story_test = {
            effect_group = {
                days = 30
                triggered_effect = {
                    trigger = { always = yes }
                    effect = { add_gold = 100 }
                }
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        warnings = [d for d in diagnostics if d.severity == DiagnosticSeverity.Warning]
        assert any("STORY-033" in d.message for d in warnings)


class TestCompleteValidation:
    """Test complete story cycle validation."""

    def test_valid_story_cycle(self):
        """Test that a valid story cycle produces no errors."""
        text = """destiny_child = {
            on_setup = {
                set_variable = { name = birth_time value = current_date }
            }
            on_end = {
                debug_log = "Story ended"
            }
            on_owner_death = {
                scope:story = { end_story = yes }
            }
            effect_group = {
                days = 30
                triggered_effect = {
                    trigger = { has_trait = brave }
                    effect = { add_prestige = 100 }
                }
            }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert len(errors) == 0

    def test_multiple_story_cycles(self):
        """Test file with multiple story cycles."""
        text = """
        story_one = {
            on_setup = { add_gold = 100 }
            effect_group = {
                days = 30
                add_prestige = 50
            }
        }
        
        story_two = {
            on_setup = { add_prestige = 100 }
            effect_group = {
                months = 6
                add_gold = 200
            }
        }
        """
        ast = parse_document(text)
        
        story_cycles = find_story_cycles(ast[0])
        assert len(story_cycles) == 2

    def test_no_effect_groups_error(self):
        """Test STORY-040: Story cycle with no effect groups."""
        text = """story_test = {
            on_setup = { add_gold = 100 }
            on_end = { debug_log = "done" }
        }"""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert any("STORY-040" in d.message for d in errors)


class TestEdgeCases:
    """Test edge cases and malformed input."""

    def test_empty_file(self):
        """Test parsing empty file."""
        text = ""
        ast = parse_document(text)
        
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        assert len(diagnostics) == 0

    def test_non_story_cycle_content(self):
        """Test file without story cycles."""
        text = """
        some_event = {
            type = character_event
            title = "An Event"
        }
        """
        ast = parse_document(text)
        
        story_cycles = find_story_cycles(ast[0])
        assert len(story_cycles) == 0

    def test_malformed_timing(self):
        """Test malformed timing block."""
        text = """story_test = {
            effect_group = {
                days = { not_a_number }
                add_gold = 100
            }
        }"""
        ast = parse_document(text)
        
        # Should handle gracefully without crashing
        diagnostics = collect_story_cycle_diagnostics(ast, "file:///test.txt")
        # May produce errors, but shouldn't crash
        assert diagnostics is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
