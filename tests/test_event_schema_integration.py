"""
Integration tests for schema-driven event validation.

Tests that the event schema properly validates event files through the
diagnostics pipeline.
"""

import pytest
from pychivalry.diagnostics import get_diagnostics_for_text


class TestEventSchemaIntegration:
    """Test event schema integration with diagnostics system."""

    def test_valid_event_no_diagnostics(self):
        """Test that a valid event produces no error/warning schema diagnostics."""
        text = """
namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Filter to schema-related ERROR/WARNING diagnostics (CK37xx, EVENT-xxx)
        # Exclude information/hint level diagnostics like CK3769
        from lsprotocol.types import DiagnosticSeverity
        schema_errors = [d for d in diagnostics if d.code and (
            str(d.code).startswith('CK37') or str(d.code).startswith('EVENT-')
        ) and d.severity in (DiagnosticSeverity.Error, DiagnosticSeverity.Warning)]
        
        assert len(schema_errors) == 0, f"Expected no schema errors/warnings, got: {schema_errors}"

    def test_missing_type_field(self):
        """Test that missing type field triggers CK3760."""
        text = """
test_mod.0001 = {
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3760 diagnostic for missing type
        ck3760 = [d for d in diagnostics if d.code == 'CK3760']
        assert len(ck3760) > 0, "Expected CK3760 diagnostic for missing type field"

    def test_invalid_event_type(self):
        """Test that invalid event type triggers CK3761."""
        text = """
test_mod.0001 = {
    type = invalid_event_type
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3761 diagnostic for invalid type
        ck3761 = [d for d in diagnostics if d.code == 'CK3761']
        assert len(ck3761) > 0, "Expected CK3761 diagnostic for invalid event type"

    def test_letter_event_missing_sender(self):
        """Test that letter_event without sender triggers EVENT-003."""
        text = """
test_mod.0001 = {
    type = letter_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have EVENT-003 diagnostic for missing sender
        event003 = [d for d in diagnostics if d.code == 'EVENT-003']
        assert len(event003) > 0, "Expected EVENT-003 diagnostic for missing sender in letter_event"

    def test_hidden_event_no_desc_required(self):
        """Test that hidden events don't require desc field."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    hidden = yes
    
    immediate = {
        add_gold = 100
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should not have CK3764 diagnostic for missing desc (hidden exempts it)
        ck3764 = [d for d in diagnostics if d.code == 'CK3764']
        assert len(ck3764) == 0, "Hidden events should not require desc field"

    def test_hidden_event_with_options_warning(self):
        """Test that hidden events with options trigger CK3762."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    hidden = yes
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3762 warning for hidden event with options
        ck3762 = [d for d in diagnostics if d.code == 'CK3762']
        assert len(ck3762) > 0, "Expected CK3762 warning for hidden event with options"

    def test_multiple_immediate_blocks(self):
        """Test that multiple immediate blocks trigger CK3768."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    immediate = {
        add_gold = 100
    }
    
    immediate = {
        add_prestige = 50
    }
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3768 error for multiple immediate blocks
        ck3768 = [d for d in diagnostics if d.code == 'CK3768']
        assert len(ck3768) > 0, "Expected CK3768 error for multiple immediate blocks"

    def test_option_missing_name(self):
        """Test that option without name triggers CK3450."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    
    option = {
        add_gold = 100
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3450 error for option missing name
        ck3450 = [d for d in diagnostics if d.code == 'CK3450']
        assert len(ck3450) > 0, "Expected CK3450 error for option missing name field"

    def test_invalid_theme(self):
        """Test that invalid theme triggers CK3430."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    theme = invalid_theme
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3430 warning for invalid theme
        ck3430 = [d for d in diagnostics if d.code == 'CK3430']
        assert len(ck3430) > 0, "Expected CK3430 warning for invalid theme"

    def test_schema_not_applied_to_non_event_files(self):
        """Test that event schema is not applied to non-event files."""
        text = """
test_decision = {
    type = character_event
    title = test.t
}
"""
        # This is NOT in an events folder
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/decisions/test.txt")
        
        # Should not have event-specific diagnostics
        event_diags = [d for d in diagnostics if d.code and (
            str(d.code).startswith('CK37') or str(d.code).startswith('EVENT-')
        )]
        
        assert len(event_diags) == 0, "Event schema should not apply to non-event files"


class TestEventSchemaValidation:
    """Test specific event validation rules."""

    def test_empty_event_warning(self):
        """Test that empty events trigger CK3767."""
        text = """
test_mod.0001 = {
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3767 warning for empty event
        ck3767 = [d for d in diagnostics if d.code == 'CK3767']
        assert len(ck3767) > 0, "Expected CK3767 warning for empty event"

    def test_after_in_hidden_event(self):
        """Test that after block in hidden event triggers CK3520."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    hidden = yes
    
    after = {
        add_gold = 100
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3520 warning
        ck3520 = [d for d in diagnostics if d.code == 'CK3520']
        assert len(ck3520) > 0, "Expected CK3520 warning for after block in hidden event"

    def test_after_without_options(self):
        """Test that after block without options triggers CK3521."""
        text = """
test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    hidden = no
    
    after = {
        add_gold = 100
    }
}
"""
        diagnostics = get_diagnostics_for_text(text, uri="file:///test/events/test.txt")
        
        # Should have CK3521 warning
        ck3521 = [d for d in diagnostics if d.code == 'CK3521']
        assert len(ck3521) > 0, "Expected CK3521 warning for after block without options"
