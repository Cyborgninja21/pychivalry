"""
Integration tests for schema-driven story cycle validation.

Tests that the story cycle schema properly validates story cycle files through the
diagnostics pipeline.
"""

import pytest
from pychivalry.diagnostics import get_diagnostics_for_text


class TestStoryCycleSchemaIntegration:
    """Test story cycle schema integration with diagnostics system."""

    def test_valid_story_cycle_no_errors(self):
        """Test that a valid story cycle produces no schema errors."""
        text = """
my_story_cycle = {
    on_setup = {
        save_scope_as = story_owner
    }
    
    on_owner_death = {
        scope:story = {
            end_story = yes
        }
    }
    
    effect_group = {
        days = 30
        
        trigger = {
            is_alive = yes
        }
        
        triggered_effect = {
            trigger = {
                age >= 16
            }
            effect = {
                add_prestige = 10
            }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        # Filter to story cycle error/warning diagnostics
        from lsprotocol.types import DiagnosticSeverity
        story_errors = [d for d in diagnostics if d.code and str(d.code).startswith('STORY-')
                       and d.severity in (DiagnosticSeverity.Error, DiagnosticSeverity.Warning)]
        
        assert len(story_errors) == 0, f"Expected no story cycle errors/warnings, got: {story_errors}"

    def test_missing_timing_keyword(self):
        """Test that effect_group without timing triggers STORY-001."""
        text = """
my_story = {
    effect_group = {
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story001 = [d for d in diagnostics if d.code == 'STORY-001']
        assert len(story001) > 0, "Expected STORY-001 diagnostic for missing timing keyword"

    def test_multiple_timing_keywords(self):
        """Test that multiple timing keywords trigger STORY-004."""
        text = """
my_story = {
    effect_group = {
        days = 30
        months = 1
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story004 = [d for d in diagnostics if d.code == 'STORY-004']
        assert len(story004) > 0, "Expected STORY-004 diagnostic for multiple timing keywords"

    def test_triggered_effect_missing_trigger(self):
        """Test that triggered_effect without trigger triggers STORY-005."""
        text = """
my_story = {
    effect_group = {
        days = 30
        
        triggered_effect = {
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story005 = [d for d in diagnostics if d.code == 'STORY-005']
        assert len(story005) > 0, "Expected STORY-005 diagnostic for missing trigger"

    def test_triggered_effect_missing_effect(self):
        """Test that triggered_effect without effect triggers STORY-006."""
        text = """
my_story = {
    effect_group = {
        days = 30
        
        triggered_effect = {
            trigger = { always = yes }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story006 = [d for d in diagnostics if d.code == 'STORY-006']
        assert len(story006) > 0, "Expected STORY-006 diagnostic for missing effect"

    def test_no_effect_groups(self):
        """Test that story cycle without effect_group triggers STORY-007."""
        text = """
my_story = {
    on_setup = {
        save_scope_as = story_owner
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story007 = [d for d in diagnostics if d.code == 'STORY-007']
        assert len(story007) > 0, "Expected STORY-007 diagnostic for missing effect_group"

    def test_missing_on_owner_death(self):
        """Test that story without on_owner_death triggers STORY-020."""
        text = """
my_story = {
    effect_group = {
        days = 30
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story020 = [d for d in diagnostics if d.code == 'STORY-020']
        assert len(story020) > 0, "Expected STORY-020 warning for missing on_owner_death"

    def test_effect_group_without_trigger_warning(self):
        """Test that effect_group without trigger triggers STORY-022."""
        text = """
my_story = {
    effect_group = {
        days = 30
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story022 = [d for d in diagnostics if d.code == 'STORY-022']
        assert len(story022) > 0, "Expected STORY-022 warning for effect_group without trigger"

    def test_chance_exceeds_100(self):
        """Test that chance > 100 triggers STORY-023."""
        text = """
my_story = {
    effect_group = {
        days = 30
        chance = 150
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story023 = [d for d in diagnostics if d.code == 'STORY-023']
        assert len(story023) > 0, "Expected STORY-023 warning for chance > 100"

    def test_chance_zero_or_negative(self):
        """Test that chance <= 0 triggers STORY-024."""
        text = """
my_story = {
    effect_group = {
        days = 30
        chance = 0
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story024 = [d for d in diagnostics if d.code == 'STORY-024']
        assert len(story024) > 0, "Expected STORY-024 warning for chance <= 0"

    def test_effect_group_no_effects(self):
        """Test that effect_group without triggered_effect/first_valid triggers STORY-025."""
        text = """
my_story = {
    effect_group = {
        days = 30
        trigger = { always = yes }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story025 = [d for d in diagnostics if d.code == 'STORY-025']
        assert len(story025) > 0, "Expected STORY-025 warning for effect_group with no effects"

    def test_mixed_triggered_effect_and_first_valid(self):
        """Test that mixing triggered_effect and first_valid triggers STORY-027."""
        text = """
my_story = {
    effect_group = {
        days = 30
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
        
        first_valid = {
            triggered_effect = {
                trigger = { always = yes }
                effect = { add_prestige = 50 }
            }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story027 = [d for d in diagnostics if d.code == 'STORY-027']
        assert len(story027) > 0, "Expected STORY-027 warning for mixing triggered_effect and first_valid"

    def test_empty_on_setup_info(self):
        """Test that empty on_setup triggers STORY-040."""
        text = """
my_story = {
    on_setup = {
    }
    
    effect_group = {
        days = 30
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story040 = [d for d in diagnostics if d.code == 'STORY-040']
        assert len(story040) > 0, "Expected STORY-040 information for empty on_setup"

    def test_empty_on_end_info(self):
        """Test that empty on_end triggers STORY-041."""
        text = """
my_story = {
    on_end = {
    }
    
    effect_group = {
        days = 30
        
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/common/story_cycles/test.txt")
        
        story041 = [d for d in diagnostics if d.code == 'STORY-041']
        assert len(story041) > 0, "Expected STORY-041 information for empty on_end"

    def test_schema_not_applied_to_non_story_cycle_files(self):
        """Test that story cycle schema is not applied to non-story cycle files."""
        text = """
my_event = {
    type = character_event
    title = test.t
}
"""
        # This is NOT in a common/story_cycles folder
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should not have story cycle diagnostics
        story_diags = [d for d in diagnostics if d.code and str(d.code).startswith('STORY-')]
        
        assert len(story_diags) == 0, "Story cycle schema should not apply to non-story cycle files"
