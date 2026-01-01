"""
Tests for CK3 Scripted Blocks Module

Tests scripted triggers, effects, parameter extraction, and inline scripts.
"""

import pytest
from pychivalry.scripted_blocks import (
    extract_parameters,
    validate_parameter_name,
    create_scripted_trigger,
    create_scripted_effect,
    validate_scripted_block_call,
    parse_inline_script_reference,
    validate_inline_script_path,
    is_scripted_trigger,
    is_scripted_effect,
    get_scripted_block_documentation,
    substitute_parameters,
    find_undefined_parameters,
    ScriptedBlock,
)


class TestExtractParameters:
    """Test parameter extraction from text."""

    def test_extract_single_parameter(self):
        """Test extracting single parameter."""
        text = "add_gold = $AMOUNT$"
        params = extract_parameters(text)
        assert params == {"AMOUNT"}

    def test_extract_multiple_parameters(self):
        """Test extracting multiple parameters."""
        text = "$TARGET$ = { add_trait = $TRAIT$ }"
        params = extract_parameters(text)
        assert params == {"TARGET", "TRAIT"}

    def test_extract_repeated_parameter(self):
        """Test that repeated parameter appears once."""
        text = "add_gold = $AMOUNT$ add_prestige = $AMOUNT$"
        params = extract_parameters(text)
        assert params == {"AMOUNT"}

    def test_extract_no_parameters(self):
        """Test text without parameters."""
        text = "add_gold = 100"
        params = extract_parameters(text)
        assert params == set()

    def test_extract_with_underscores(self):
        """Test parameters with underscores."""
        text = "$TARGET_CHARACTER$ = { $TRAIT_TO_ADD$ = yes }"
        params = extract_parameters(text)
        assert params == {"TARGET_CHARACTER", "TRAIT_TO_ADD"}

    def test_extract_with_numbers(self):
        """Test parameters with numbers."""
        text = "$PARAM1$ $PARAM2$ $PARAM_3$"
        params = extract_parameters(text)
        assert params == {"PARAM1", "PARAM2", "PARAM_3"}


class TestValidateParameterName:
    """Test parameter name validation."""

    def test_valid_uppercase(self):
        """Test valid uppercase parameter."""
        assert validate_parameter_name("AMOUNT") is True
        assert validate_parameter_name("TARGET") is True

    def test_valid_with_underscore(self):
        """Test valid parameters with underscores."""
        assert validate_parameter_name("MY_PARAM") is True
        assert validate_parameter_name("_PRIVATE") is True

    def test_valid_with_numbers(self):
        """Test valid parameters with numbers."""
        assert validate_parameter_name("PARAM1") is True
        assert validate_parameter_name("MY_PARAM_2") is True

    def test_invalid_lowercase(self):
        """Test invalid lowercase parameters."""
        assert validate_parameter_name("amount") is False
        assert validate_parameter_name("myParam") is False

    def test_invalid_special_chars(self):
        """Test invalid parameters with special characters."""
        assert validate_parameter_name("MY-PARAM") is False
        assert validate_parameter_name("MY.PARAM") is False

    def test_invalid_empty(self):
        """Test invalid empty parameter."""
        assert validate_parameter_name("") is False


class TestCreateScriptedTrigger:
    """Test creating scripted trigger objects."""

    def test_create_simple_trigger(self):
        """Test creating simple scripted trigger."""
        content = "is_adult = yes"
        trigger = create_scripted_trigger("my_trigger", content, "test.txt")

        assert trigger.name == "my_trigger"
        assert trigger.block_type == "scripted_trigger"
        assert trigger.file_path == "test.txt"
        assert trigger.parameters == set()
        assert trigger.content == content

    def test_create_trigger_with_parameters(self):
        """Test creating trigger with parameters."""
        content = "age >= $MIN_AGE$ age <= $MAX_AGE$"
        trigger = create_scripted_trigger("age_range", content, "triggers.txt")

        assert trigger.name == "age_range"
        assert trigger.parameters == {"MIN_AGE", "MAX_AGE"}


class TestCreateScriptedEffect:
    """Test creating scripted effect objects."""

    def test_create_simple_effect(self):
        """Test creating simple scripted effect."""
        content = "add_gold = 100"
        effect = create_scripted_effect("my_effect", content, "test.txt")

        assert effect.name == "my_effect"
        assert effect.block_type == "scripted_effect"
        assert effect.file_path == "test.txt"
        assert effect.parameters == set()

    def test_create_effect_with_parameters(self):
        """Test creating effect with parameters."""
        content = "$TARGET$ = { add_trait = $TRAIT$ }"
        effect = create_scripted_effect("add_trait_to_target", content, "effects.txt")

        assert effect.name == "add_trait_to_target"
        assert effect.parameters == {"TARGET", "TRAIT"}


class TestValidateScriptedBlockCall:
    """Test validation of scripted block calls."""

    def test_valid_call_all_params(self):
        """Test valid call with all parameters."""
        block = ScriptedBlock(
            name="my_trigger",
            block_type="scripted_trigger",
            file_path="test.txt",
            parameters={"AMOUNT", "TARGET"},
        )
        is_valid, error = validate_scripted_block_call(block, {"AMOUNT": "100", "TARGET": "root"})
        assert is_valid is True
        assert error is None

    def test_valid_call_no_params(self):
        """Test valid call with no parameters required."""
        block = ScriptedBlock(
            name="simple_trigger",
            block_type="scripted_trigger",
            file_path="test.txt",
            parameters=set(),
        )
        is_valid, error = validate_scripted_block_call(block, {})
        assert is_valid is True

    def test_invalid_missing_params(self):
        """Test invalid call missing parameters."""
        block = ScriptedBlock(
            name="my_trigger",
            block_type="scripted_trigger",
            file_path="test.txt",
            parameters={"AMOUNT", "TARGET"},
        )
        is_valid, error = validate_scripted_block_call(block, {"AMOUNT": "100"})
        assert is_valid is False
        assert "Missing required parameters" in error
        assert "TARGET" in error

    def test_valid_call_extra_params(self):
        """Test call with extra parameters (allowed in CK3)."""
        block = ScriptedBlock(
            name="my_trigger",
            block_type="scripted_trigger",
            file_path="test.txt",
            parameters={"AMOUNT"},
        )
        is_valid, error = validate_scripted_block_call(block, {"AMOUNT": "100", "EXTRA": "value"})
        assert is_valid is True  # Extra params allowed


class TestParseInlineScriptReference:
    """Test parsing inline script references."""

    def test_parse_simple_form(self):
        """Test parsing simple inline_script = path."""
        text = "inline_script = my_script"
        result = parse_inline_script_reference(text)
        assert result is not None
        script_path, params = result
        assert script_path == "my_script"
        assert params == {}

    def test_parse_block_form_no_params(self):
        """Test parsing inline_script block without parameters."""
        text = "inline_script = { script = my_script }"
        result = parse_inline_script_reference(text)
        assert result is not None
        script_path, params = result
        assert script_path == "my_script"
        assert params == {}

    def test_parse_block_form_with_params(self):
        """Test parsing inline_script block with parameters."""
        text = "inline_script = { script = my_script AMOUNT = 100 TARGET = root }"
        result = parse_inline_script_reference(text)
        assert result is not None
        script_path, params = result
        assert script_path == "my_script"
        assert "AMOUNT" in params
        assert "TARGET" in params

    def test_parse_invalid(self):
        """Test parsing invalid inline_script."""
        text = "not_inline_script = value"
        result = parse_inline_script_reference(text)
        assert result is None  # Should be None since 'inline_script' keyword not in text


class TestValidateInlineScriptPath:
    """Test inline script path validation."""

    def test_validate_simple_path(self):
        """Test validating simple path."""
        path = validate_inline_script_path("my_script")
        assert path == "common/inline_scripts/my_script.txt"

    def test_validate_path_with_extension(self):
        """Test path already has extension."""
        path = validate_inline_script_path("my_script.txt")
        assert path == "common/inline_scripts/my_script.txt"

    def test_validate_nested_path(self):
        """Test validating nested path."""
        path = validate_inline_script_path("utils/helper")
        assert path == "common/inline_scripts/utils/helper.txt"


class TestIsScriptedTrigger:
    """Test checking if identifier is scripted trigger."""

    def test_is_known_trigger(self):
        """Test known scripted trigger."""
        triggers = {
            "my_trigger": ScriptedBlock("my_trigger", "scripted_trigger", "test.txt", set())
        }
        assert is_scripted_trigger("my_trigger", triggers) is True

    def test_is_unknown_trigger(self):
        """Test unknown trigger."""
        triggers = {}
        assert is_scripted_trigger("unknown_trigger", triggers) is False


class TestIsScriptedEffect:
    """Test checking if identifier is scripted effect."""

    def test_is_known_effect(self):
        """Test known scripted effect."""
        effects = {"my_effect": ScriptedBlock("my_effect", "scripted_effect", "test.txt", set())}
        assert is_scripted_effect("my_effect", effects) is True

    def test_is_unknown_effect(self):
        """Test unknown effect."""
        effects = {}
        assert is_scripted_effect("unknown_effect", effects) is False


class TestGetScriptedBlockDocumentation:
    """Test generating documentation for scripted blocks."""

    def test_documentation_trigger_no_params(self):
        """Test documentation for trigger without parameters."""
        block = ScriptedBlock(
            name="my_trigger",
            block_type="scripted_trigger",
            file_path="common/scripted_triggers/test.txt",
            parameters=set(),
        )
        doc = get_scripted_block_documentation(block)
        assert "my_trigger" in doc
        assert "Scripted Trigger" in doc
        assert "common/scripted_triggers/test.txt" in doc
        assert "Parameters" in doc and "None" in doc

    def test_documentation_effect_with_params(self):
        """Test documentation for effect with parameters."""
        block = ScriptedBlock(
            name="my_effect",
            block_type="scripted_effect",
            file_path="common/scripted_effects/test.txt",
            parameters={"AMOUNT", "TARGET"},
        )
        doc = get_scripted_block_documentation(block)
        assert "my_effect" in doc
        assert "Scripted Effect" in doc
        assert "$AMOUNT$" in doc or "$TARGET$" in doc

    def test_documentation_with_scope(self):
        """Test documentation with scope requirement."""
        block = ScriptedBlock(
            name="my_trigger",
            block_type="scripted_trigger",
            file_path="test.txt",
            parameters=set(),
            scope_requirement="character",
        )
        doc = get_scripted_block_documentation(block)
        assert "character" in doc


class TestSubstituteParameters:
    """Test parameter substitution in text."""

    def test_substitute_single(self):
        """Test substituting single parameter."""
        text = "add_gold = $AMOUNT$"
        result = substitute_parameters(text, {"AMOUNT": "100"})
        assert result == "add_gold = 100"

    def test_substitute_multiple(self):
        """Test substituting multiple parameters."""
        text = "$TARGET$ = { add_trait = $TRAIT$ }"
        result = substitute_parameters(text, {"TARGET": "root", "TRAIT": "brave"})
        assert result == "root = { add_trait = brave }"

    def test_substitute_repeated(self):
        """Test substituting repeated parameter."""
        text = "add_gold = $AMOUNT$ add_prestige = $AMOUNT$"
        result = substitute_parameters(text, {"AMOUNT": "50"})
        assert result == "add_gold = 50 add_prestige = 50"

    def test_substitute_none(self):
        """Test text without parameters."""
        text = "add_gold = 100"
        result = substitute_parameters(text, {})
        assert result == "add_gold = 100"


class TestFindUndefinedParameters:
    """Test finding undefined parameters."""

    def test_find_undefined_some(self):
        """Test finding some undefined parameters."""
        text = "$DEFINED$ = { value = $UNDEFINED$ }"
        defined = {"DEFINED"}
        undefined = find_undefined_parameters(text, defined)
        assert undefined == {"UNDEFINED"}

    def test_find_undefined_none(self):
        """Test all parameters defined."""
        text = "$PARAM1$ = { value = $PARAM2$ }"
        defined = {"PARAM1", "PARAM2"}
        undefined = find_undefined_parameters(text, defined)
        assert undefined == set()

    def test_find_undefined_all(self):
        """Test all parameters undefined."""
        text = "$PARAM1$ $PARAM2$"
        defined = set()
        undefined = find_undefined_parameters(text, defined)
        assert undefined == {"PARAM1", "PARAM2"}


class TestScriptedBlockIntegration:
    """Integration tests for scripted blocks."""

    def test_complete_trigger_workflow(self):
        """Test complete workflow for scripted trigger."""
        # Create trigger
        content = "age >= $MIN_AGE$ is_adult = yes"
        trigger = create_scripted_trigger("age_check", content, "triggers/age.txt")

        assert trigger.name == "age_check"
        assert trigger.parameters == {"MIN_AGE"}

        # Validate call
        is_valid, error = validate_scripted_block_call(trigger, {"MIN_AGE": "16"})
        assert is_valid is True

        # Generate documentation
        doc = get_scripted_block_documentation(trigger)
        assert "age_check" in doc
        assert "$MIN_AGE$" in doc

    def test_complete_effect_workflow(self):
        """Test complete workflow for scripted effect."""
        # Create effect
        content = "$TARGET$ = { add_gold = $AMOUNT$ }"
        effect = create_scripted_effect("give_gold", content, "effects/gold.txt")

        assert effect.name == "give_gold"
        assert effect.parameters == {"TARGET", "AMOUNT"}

        # Validate call
        is_valid, error = validate_scripted_block_call(effect, {"TARGET": "liege", "AMOUNT": "100"})
        assert is_valid is True

        # Substitute parameters
        result = substitute_parameters(content, {"TARGET": "liege", "AMOUNT": "100"})
        assert result == "liege = { add_gold = 100 }"

    def test_inline_script_workflow(self):
        """Test complete workflow for inline script."""
        # Parse reference
        text = "inline_script = { script = utils/helper PARAM = value }"
        result = parse_inline_script_reference(text)

        assert result is not None
        script_path, params = result
        assert script_path == "utils/helper"
        assert params == {"PARAM": "value"}

        # Validate path
        full_path = validate_inline_script_path(script_path)
        assert full_path == "common/inline_scripts/utils/helper.txt"
