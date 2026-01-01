"""
Tests for CK3 Localization System Module

Tests character functions, text formatting, icon references, and concept links.
"""

import pytest
from pychivalry.localization import (
    is_character_function,
    is_text_formatting_code,
    is_icon_reference,
    extract_character_functions,
    extract_text_formatting_codes,
    extract_icon_references,
    validate_character_function_call,
    validate_concept_link,
    parse_localization_key,
    suggest_localization_key_format,
    validate_localization_references,
    get_character_function_description,
    get_formatting_code_description,
    create_localization_key,
)


class TestIsCharacterFunction:
    """Test character function validation."""

    def test_valid_functions(self):
        """Test valid character functions."""
        functions = ["GetName", "GetFirstName", "GetLastName", "GetTitle", "GetUIName"]
        for func in functions:
            assert is_character_function(func) is True

    def test_invalid_function(self):
        """Test invalid character function."""
        assert is_character_function("GetInvalidFunction") is False
        assert is_character_function("getName") is False  # Case sensitive


class TestIsTextFormattingCode:
    """Test text formatting code validation."""

    def test_valid_codes(self):
        """Test valid formatting codes."""
        codes = ["#P", "#N", "#bold", "#italic", "#!"]
        for code in codes:
            assert is_text_formatting_code(code) is True

    def test_invalid_code(self):
        """Test invalid formatting code."""
        assert is_text_formatting_code("#invalid") is False
        assert is_text_formatting_code("P") is False  # Missing #


class TestIsIconReference:
    """Test icon reference validation."""

    def test_valid_icons(self):
        """Test valid icon references."""
        icons = ["@gold_icon!", "@prestige_icon!", "@piety_icon!", "@dread_icon!"]
        for icon in icons:
            assert is_icon_reference(icon) is True

    def test_invalid_icon(self):
        """Test invalid icon reference."""
        assert is_icon_reference("@invalid_icon!") is False
        assert is_icon_reference("gold_icon") is False  # Missing @ and !


class TestExtractCharacterFunctions:
    """Test extracting character functions from text."""

    def test_extract_single_function(self):
        """Test extracting single function."""
        text = "[root.GetName] is here"
        functions = extract_character_functions(text)
        assert functions == ["GetName"]

    def test_extract_multiple_functions(self):
        """Test extracting multiple functions."""
        text = "[root.GetFirstName] and [liege.GetTitle]"
        functions = extract_character_functions(text)
        assert set(functions) == {"GetFirstName", "GetTitle"}

    def test_extract_with_scope_reference(self):
        """Test extracting with scope reference."""
        text = "[scope:target.GetUIName] is present"
        functions = extract_character_functions(text)
        assert functions == ["GetUIName"]

    def test_extract_none(self):
        """Test text without functions."""
        text = "Plain text without functions"
        functions = extract_character_functions(text)
        assert functions == []


class TestExtractTextFormattingCodes:
    """Test extracting text formatting codes."""

    def test_extract_single_code(self):
        """Test extracting single formatting code."""
        text = "This is #bold important"
        codes = extract_text_formatting_codes(text)
        assert "#bold" in codes

    def test_extract_multiple_codes(self):
        """Test extracting multiple formatting codes."""
        text = "#P possession#N newline#! emphasis"
        codes = extract_text_formatting_codes(text)
        assert "#P" in codes
        assert "#N" in codes
        assert "#!" in codes

    def test_extract_none(self):
        """Test text without formatting codes."""
        text = "Plain text"
        codes = extract_text_formatting_codes(text)
        assert len(codes) == 0


class TestExtractIconReferences:
    """Test extracting icon references."""

    def test_extract_single_icon(self):
        """Test extracting single icon."""
        text = "You gain @gold_icon! 100 gold"
        icons = extract_icon_references(text)
        assert icons == ["@gold_icon!"]

    def test_extract_multiple_icons(self):
        """Test extracting multiple icons."""
        text = "@prestige_icon! and @piety_icon! gained"
        icons = extract_icon_references(text)
        assert set(icons) == {"@prestige_icon!", "@piety_icon!"}

    def test_extract_none(self):
        """Test text without icons."""
        text = "Plain text"
        icons = extract_icon_references(text)
        assert len(icons) == 0


class TestValidateCharacterFunctionCall:
    """Test character function call validation."""

    def test_valid_call_simple(self):
        """Test valid simple function call."""
        call = "[root.GetName]"
        is_valid, error = validate_character_function_call(call)
        assert is_valid is True
        assert error is None

    def test_valid_call_with_scope(self):
        """Test valid call with scope reference."""
        call = "[scope:target.GetFirstName]"
        is_valid, error = validate_character_function_call(call)
        assert is_valid is True

    def test_invalid_no_brackets(self):
        """Test invalid call without brackets."""
        call = "root.GetName"
        is_valid, error = validate_character_function_call(call)
        assert is_valid is False
        assert "wrapped in []" in error

    def test_invalid_no_dot(self):
        """Test invalid call without dot."""
        call = "[rootGetName]"
        is_valid, error = validate_character_function_call(call)
        assert is_valid is False
        assert "format" in error.lower()

    def test_invalid_function(self):
        """Test invalid function name."""
        call = "[root.GetInvalidFunction]"
        is_valid, error = validate_character_function_call(call)
        assert is_valid is False
        assert "Unknown character function" in error


class TestValidateConceptLink:
    """Test concept link validation."""

    def test_valid_concept_link(self):
        """Test valid concept link."""
        link = "[martial|E]"
        is_valid, error = validate_concept_link(link)
        assert is_valid is True
        assert error is None

    def test_valid_complex_link(self):
        """Test valid complex concept link."""
        link = "[my_concept|context]"
        is_valid, error = validate_concept_link(link)
        assert is_valid is True

    def test_invalid_no_brackets(self):
        """Test invalid link without brackets."""
        link = "martial|E"
        is_valid, error = validate_concept_link(link)
        assert is_valid is False
        assert "wrapped in []" in error

    def test_invalid_no_pipe(self):
        """Test invalid link without pipe."""
        link = "[martialE]"
        is_valid, error = validate_concept_link(link)
        assert is_valid is False
        assert "|" in error

    def test_invalid_empty_concept(self):
        """Test invalid link with empty concept."""
        link = "[|E]"
        is_valid, error = validate_concept_link(link)
        assert is_valid is False
        assert "empty" in error.lower()


class TestParseLocalizationKey:
    """Test localization key parsing."""

    def test_parse_event_title(self):
        """Test parsing event title key."""
        namespace, identifier = parse_localization_key("my_mod.0001.t")
        assert namespace == "my_mod"
        assert identifier == "0001.t"

    def test_parse_event_desc(self):
        """Test parsing event description key."""
        namespace, identifier = parse_localization_key("my_mod.0001.desc")
        assert namespace == "my_mod"
        assert identifier == "0001.desc"

    def test_parse_option(self):
        """Test parsing option key."""
        namespace, identifier = parse_localization_key("my_mod.option.a")
        assert namespace == "my_mod"
        assert identifier == "option.a"

    def test_parse_invalid_no_dot(self):
        """Test parsing invalid key without dot."""
        namespace, identifier = parse_localization_key("invalid")
        assert namespace is None
        assert identifier is None


class TestSuggestLocalizationKeyFormat:
    """Test localization key format suggestions."""

    def test_suggest_title_key(self):
        """Test suggesting title key."""
        key = suggest_localization_key_format("my_mod.0001", "title")
        assert key == "my_mod.0001.t"

    def test_suggest_desc_key(self):
        """Test suggesting description key."""
        key = suggest_localization_key_format("my_mod.0001", "desc")
        assert key == "my_mod.0001.desc"

    def test_suggest_option_key(self):
        """Test suggesting option key."""
        key = suggest_localization_key_format("my_mod.0001", "option")
        assert key == "my_mod.0001.a"


class TestValidateLocalizationReferences:
    """Test validation of all localization references."""

    def test_valid_text(self):
        """Test text with all valid references."""
        text = "[root.GetName] gains @gold_icon! 100 gold #bold"
        issues = validate_localization_references(text)
        assert len(issues) == 0

    def test_invalid_function(self):
        """Test text with invalid function."""
        text = "[root.GetInvalidFunction]"
        issues = validate_localization_references(text)
        assert len(issues) > 0
        assert any("GetInvalidFunction" in str(issue) for issue in issues)

    def test_invalid_formatting(self):
        """Test text with invalid formatting code."""
        text = "#invalid_code"
        issues = validate_localization_references(text)
        assert len(issues) > 0

    def test_mixed_valid_invalid(self):
        """Test text with mix of valid and invalid references."""
        text = "[root.GetName] and [root.GetInvalidFunction]"
        issues = validate_localization_references(text)
        assert len(issues) == 1  # Only the invalid one


class TestGetCharacterFunctionDescription:
    """Test getting character function descriptions."""

    def test_get_known_function(self):
        """Test getting description for known function."""
        desc = get_character_function_description("GetName")
        assert "name" in desc.lower()

    def test_get_first_name_function(self):
        """Test getting description for GetFirstName."""
        desc = get_character_function_description("GetFirstName")
        assert "first" in desc.lower()

    def test_get_unknown_function(self):
        """Test getting description for unknown function."""
        desc = get_character_function_description("GetUnknownFunction")
        assert "GetUnknownFunction" in desc


class TestGetFormattingCodeDescription:
    """Test getting formatting code descriptions."""

    def test_get_known_code(self):
        """Test getting description for known code."""
        desc = get_formatting_code_description("#P")
        assert "possessive" in desc.lower()

    def test_get_bold_code(self):
        """Test getting description for bold code."""
        desc = get_formatting_code_description("#bold")
        assert "bold" in desc.lower()

    def test_get_unknown_code(self):
        """Test getting description for unknown code."""
        desc = get_formatting_code_description("#unknown")
        assert "#unknown" in desc


class TestCreateLocalizationKey:
    """Test creating localization key objects."""

    def test_create_simple_key(self):
        """Test creating simple localization key."""
        key = create_localization_key("my_mod.0001.t", "test.txt")
        assert key.key == "my_mod.0001.t"
        assert key.file_path == "test.txt"
        assert key.key_type is None

    def test_create_with_type(self):
        """Test creating key with type."""
        key = create_localization_key("my_mod.0001.t", "test.txt", "title")
        assert key.key_type == "title"


class TestLocalizationIntegration:
    """Integration tests for localization system."""

    def test_complete_localization_workflow(self):
        """Test complete workflow for localization."""
        # Create localization text with various references
        text = "[root.GetName] gains @gold_icon! 100 gold. #bold Important#!"

        # Extract components
        functions = extract_character_functions(text)
        assert "GetName" in functions

        codes = extract_text_formatting_codes(text)
        assert "#bold" in codes
        assert "#!" in codes

        icons = extract_icon_references(text)
        assert "@gold_icon!" in icons

        # Validate all references
        issues = validate_localization_references(text)
        assert len(issues) == 0  # All valid

    def test_event_localization_keys(self):
        """Test event localization key workflow."""
        event_id = "my_mod.0001"

        # Generate keys
        title_key = suggest_localization_key_format(event_id, "title")
        desc_key = suggest_localization_key_format(event_id, "desc")

        assert title_key == "my_mod.0001.t"
        assert desc_key == "my_mod.0001.desc"

        # Parse keys
        namespace, _ = parse_localization_key(title_key)
        assert namespace == "my_mod"

    def test_character_function_validation(self):
        """Test character function validation workflow."""
        # Valid call
        call = "[root.GetFirstName]"
        is_valid, error = validate_character_function_call(call)
        assert is_valid is True

        # Get description
        desc = get_character_function_description("GetFirstName")
        assert "first" in desc.lower()
