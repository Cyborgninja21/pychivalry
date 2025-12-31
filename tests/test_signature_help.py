"""
Tests for CK3 Signature Help.

Tests the signature help provider for CK3 scripts, including:
- Effect parameter signatures (add_opinion, trigger_event, etc.)
- Trigger parameter signatures (opinion, has_relation, etc.)
- Active parameter detection
- Context detection for nested blocks
"""

import pytest
from lsprotocol import types

from pychivalry.signature_help import (
    get_signature_help,
    get_trigger_characters,
    get_retrigger_characters,
    SIGNATURES,
    TRIGGER_SIGNATURES,
    _find_signature_context,
    _build_signature_help,
    SignatureInfo,
    ParameterInfo,
)


# =============================================================================
# Test Signature Definitions
# =============================================================================

class TestSignatureDefinitions:
    """Tests for signature definition completeness."""
    
    def test_add_opinion_has_required_params(self):
        """Test add_opinion signature has target and modifier as required."""
        sig = SIGNATURES.get("add_opinion")
        assert sig is not None
        
        required_params = [p for p in sig.parameters if p.required]
        required_names = [p.name for p in required_params]
        
        assert "target" in required_names
        assert "modifier" in required_names
    
    def test_add_opinion_has_optional_years(self):
        """Test add_opinion has optional years parameter."""
        sig = SIGNATURES.get("add_opinion")
        assert sig is not None
        
        optional_params = [p for p in sig.parameters if not p.required]
        optional_names = [p.name for p in optional_params]
        
        assert "years" in optional_names
    
    def test_trigger_event_has_id_required(self):
        """Test trigger_event requires id parameter."""
        sig = SIGNATURES.get("trigger_event")
        assert sig is not None
        
        id_param = next((p for p in sig.parameters if p.name == "id"), None)
        assert id_param is not None
        assert id_param.required is True
    
    def test_trigger_event_has_optional_days(self):
        """Test trigger_event has optional days parameter."""
        sig = SIGNATURES.get("trigger_event")
        assert sig is not None
        
        days_param = next((p for p in sig.parameters if p.name == "days"), None)
        assert days_param is not None
        assert days_param.required is False
    
    def test_set_variable_params(self):
        """Test set_variable has name and value params."""
        sig = SIGNATURES.get("set_variable")
        assert sig is not None
        
        param_names = [p.name for p in sig.parameters]
        assert "name" in param_names
        assert "value" in param_names
    
    def test_common_effects_have_signatures(self):
        """Test common effects have signature definitions."""
        common_effects = [
            "add_opinion",
            "trigger_event",
            "set_variable",
            "add_character_modifier",
            "add_trait",
            "random",
            "death",
            "save_scope_as",
        ]
        
        for effect in common_effects:
            assert effect in SIGNATURES, f"Missing signature for {effect}"
    
    def test_trigger_signatures_exist(self):
        """Test that trigger signatures exist."""
        common_triggers = ["opinion", "has_relation"]
        
        for trigger in common_triggers:
            assert trigger in TRIGGER_SIGNATURES, f"Missing trigger signature for {trigger}"


# =============================================================================
# Test Context Detection
# =============================================================================

class TestContextDetection:
    """Tests for finding signature context."""
    
    def test_detect_add_opinion_context(self):
        """Test detecting add_opinion context."""
        text = """add_opinion = {
    target = root
}"""
        lines = text.split('\n')
        position = types.Position(line=1, character=10)  # After "target = "
        
        context = _find_signature_context(lines, position)
        assert context is not None
        assert context[0] == "add_opinion"
    
    def test_detect_trigger_event_context(self):
        """Test detecting trigger_event context."""
        text = """trigger_event = {
    id = 
}"""
        lines = text.split('\n')
        position = types.Position(line=1, character=9)  # After "id = "
        
        context = _find_signature_context(lines, position)
        assert context is not None
        assert context[0] == "trigger_event"
    
    def test_detect_nested_context(self):
        """Test detecting context in nested blocks."""
        text = """effect = {
    add_opinion = {
        target = 
    }
}"""
        lines = text.split('\n')
        position = types.Position(line=2, character=17)  # After "target = "
        
        context = _find_signature_context(lines, position)
        assert context is not None
        assert context[0] == "add_opinion"
    
    def test_no_context_outside_block(self):
        """Test no context returned outside effect blocks."""
        text = """namespace = my_mod

my_event.001 = {"""
        lines = text.split('\n')
        position = types.Position(line=2, character=5)
        
        context = _find_signature_context(lines, position)
        # Either None or an unrecognized effect name
        if context:
            assert context[0] not in SIGNATURES
    
    def test_context_with_completed_params(self):
        """Test context detection with some params already filled."""
        text = """add_opinion = {
    target = root
    modifier = 
}"""
        lines = text.split('\n')
        position = types.Position(line=2, character=15)  # After "modifier = "
        
        context = _find_signature_context(lines, position)
        assert context is not None
        assert context[0] == "add_opinion"


# =============================================================================
# Test Active Parameter Detection
# =============================================================================

class TestActiveParameterDetection:
    """Tests for determining the active parameter."""
    
    def test_first_param_active_when_empty(self):
        """Test first required param is active in empty block."""
        text = """add_opinion = {
    
}"""
        lines = text.split('\n')
        position = types.Position(line=1, character=4)
        
        context = _find_signature_context(lines, position)
        assert context is not None
        # First param (target) should be active
        assert context[1] == 0
    
    def test_current_param_active_when_typing(self):
        """Test current param is active when typing its value."""
        text = """add_opinion = {
    modifier = """
        lines = text.split('\n')
        position = types.Position(line=1, character=15)  # After "modifier = "
        
        context = _find_signature_context(lines, position)
        assert context is not None
        
        # Find modifier param index
        sig = SIGNATURES["add_opinion"]
        modifier_idx = next(i for i, p in enumerate(sig.parameters) if p.name == "modifier")
        
        assert context[1] == modifier_idx


# =============================================================================
# Test Signature Help Building
# =============================================================================

class TestBuildSignatureHelp:
    """Tests for building SignatureHelp responses."""
    
    def test_build_basic_signature(self):
        """Test building a basic signature help response."""
        sig_info = SignatureInfo(
            name="test_effect",
            documentation="Test effect documentation",
            parameters=[
                ParameterInfo("param1", "string", "First parameter", True),
                ParameterInfo("param2", "int", "Second parameter", False),
            ],
        )
        
        result = _build_signature_help(sig_info, 0)
        
        assert result is not None
        assert len(result.signatures) == 1
        assert result.active_signature == 0
        assert result.active_parameter == 0
    
    def test_signature_label_format(self):
        """Test signature label is correctly formatted."""
        sig_info = SignatureInfo(
            name="test_effect",
            documentation="Test",
            parameters=[
                ParameterInfo("required_param", "string", "Required", True),
                ParameterInfo("optional_param", "int", "Optional", False),
            ],
        )
        
        result = _build_signature_help(sig_info, 0)
        
        label = result.signatures[0].label
        assert "test_effect" in label
        assert "required_param" in label
        assert "optional_param?" in label  # Optional params have ?
    
    def test_parameters_have_documentation(self):
        """Test parameters include documentation."""
        sig_info = SIGNATURES["add_opinion"]
        result = _build_signature_help(sig_info, 0)
        
        assert result.signatures[0].parameters is not None
        assert len(result.signatures[0].parameters) > 0
        
        # Each parameter should have documentation
        for param in result.signatures[0].parameters:
            assert param.documentation is not None
    
    def test_active_parameter_clamped(self):
        """Test active parameter is clamped to valid range."""
        sig_info = SignatureInfo(
            name="test_effect",
            documentation="Test",
            parameters=[
                ParameterInfo("only_param", "string", "Only parameter", True),
            ],
        )
        
        # Request param index beyond range
        result = _build_signature_help(sig_info, 10)
        
        # Should be clamped to max valid index (0)
        assert result.active_parameter == 0


# =============================================================================
# Test Full Signature Help
# =============================================================================

class TestGetSignatureHelp:
    """Tests for the main get_signature_help function."""
    
    def test_add_opinion_signature_help(self):
        """Test getting signature help for add_opinion."""
        text = """effect = {
    add_opinion = {
        target = 
    }
}"""
        position = types.Position(line=2, character=17)  # After "target = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert len(result.signatures) >= 1
        assert "add_opinion" in result.signatures[0].label
    
    def test_trigger_event_signature_help(self):
        """Test getting signature help for trigger_event."""
        text = """immediate = {
    trigger_event = {
        id = 
    }
}"""
        position = types.Position(line=2, character=13)  # After "id = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert "trigger_event" in result.signatures[0].label
    
    def test_no_help_outside_known_effects(self):
        """Test no help for unknown effect names."""
        text = """effect = {
    unknown_effect = {
        param = 
    }
}"""
        position = types.Position(line=2, character=16)
        
        result = get_signature_help(text, position)
        
        assert result is None
    
    def test_no_help_outside_block(self):
        """Test no help outside effect blocks."""
        text = """namespace = my_mod"""
        position = types.Position(line=0, character=10)
        
        result = get_signature_help(text, position)
        
        assert result is None
    
    def test_signature_help_with_multiple_params(self):
        """Test signature help shows all parameters."""
        text = """effect = {
    add_opinion = {
        
    }
}"""
        position = types.Position(line=2, character=8)
        
        result = get_signature_help(text, position)
        
        if result:
            sig = result.signatures[0]
            # Should have multiple parameters
            assert len(sig.parameters) >= 2


# =============================================================================
# Test Trigger Characters
# =============================================================================

class TestTriggerCharacters:
    """Tests for signature help trigger characters."""
    
    def test_trigger_characters_include_brace(self):
        """Test { is a trigger character."""
        triggers = get_trigger_characters()
        assert "{" in triggers
    
    def test_trigger_characters_include_equals(self):
        """Test = is a trigger character."""
        triggers = get_trigger_characters()
        assert "=" in triggers
    
    def test_retrigger_characters_exist(self):
        """Test retrigger characters are defined."""
        retriggers = get_retrigger_characters()
        assert len(retriggers) > 0
    
    def test_retrigger_includes_space(self):
        """Test space is a retrigger character."""
        retriggers = get_retrigger_characters()
        assert " " in retriggers


# =============================================================================
# Test Real World Patterns
# =============================================================================

class TestRealWorldPatterns:
    """Tests with realistic CK3 code patterns."""
    
    def test_event_with_trigger_event(self):
        """Test signature help in a real event context."""
        text = """namespace = rq

rq.0001 = {
    type = character_event
    title = rq.0001.t
    desc = rq.0001.desc
    
    option = {
        name = rq.0001.a
        trigger_event = {
            id = 
        }
    }
}"""
        position = types.Position(line=10, character=17)  # After "id = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert "trigger_event" in result.signatures[0].label
    
    def test_add_opinion_in_option(self):
        """Test add_opinion in an option block."""
        text = """option = {
    name = my_option
    add_opinion = {
        target = scope:friend
        modifier = 
    }
}"""
        position = types.Position(line=4, character=19)  # After "modifier = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert "add_opinion" in result.signatures[0].label
    
    def test_set_variable_in_immediate(self):
        """Test set_variable in immediate block."""
        text = """immediate = {
    set_variable = {
        name = my_var
        value = 
    }
}"""
        position = types.Position(line=3, character=16)  # After "value = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert "set_variable" in result.signatures[0].label
    
    def test_nested_random_block(self):
        """Test signature help in nested random block."""
        text = """effect = {
    random = {
        chance = 
    }
}"""
        position = types.Position(line=2, character=17)  # After "chance = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert "random" in result.signatures[0].label
    
    def test_death_effect(self):
        """Test death effect signature."""
        text = """effect = {
    death = {
        death_reason = 
    }
}"""
        position = types.Position(line=2, character=23)  # After "death_reason = "
        
        result = get_signature_help(text, position)
        
        assert result is not None
        assert "death" in result.signatures[0].label


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_empty_document(self):
        """Test with empty document."""
        result = get_signature_help("", types.Position(line=0, character=0))
        assert result is None
    
    def test_position_past_end(self):
        """Test with position past end of document."""
        text = "short"
        result = get_signature_help(text, types.Position(line=10, character=0))
        assert result is None
    
    def test_malformed_block(self):
        """Test with malformed block (no closing brace)."""
        text = """add_opinion = {
    target = root"""
        result = get_signature_help(text, types.Position(line=1, character=10))
        # Should still work or gracefully return None
        # (depends on implementation - just shouldn't crash)
        assert result is None or isinstance(result, types.SignatureHelp)
    
    def test_comment_line(self):
        """Test cursor on comment line."""
        text = """add_opinion = {
    # target = root
    modifier = test
}"""
        result = get_signature_help(text, types.Position(line=1, character=10))
        # Should return help for the block even on comment
        # (the comment doesn't change the context)
        assert result is None or isinstance(result, types.SignatureHelp)
