"""
Tests for Enhanced CK3 Localization System

Tests new features:
- Extended character functions (70+ functions)
- Scope chain validation
- Variable substitution patterns
- Concept link validation
- Extended formatting codes and icons
"""

import pytest
from pychivalry.localization import (
    # Character functions
    is_character_function,
    CHARACTER_FUNCTIONS,
    # Scope validation
    extract_scope_chains,
    validate_scope_chain,
    LOCALIZATION_SCOPES,
    # Variable substitution
    extract_variable_substitutions,
    validate_variable_substitution,
    validate_all_variable_substitutions,
    # Concept links
    extract_concept_links,
    validate_concept_link_reference,
    GAME_CONCEPTS,
    # Formatting and icons
    TEXT_FORMATTING_CODES,
    ICON_REFERENCES,
    is_text_formatting_code,
    is_icon_reference,
)


class TestExtendedCharacterFunctions:
    """Test expanded character function set (70+ functions)."""

    def test_basic_name_functions_exist(self):
        """Test that basic name functions are present."""
        basic_functions = {
            "GetName", "GetFirstName", "GetLastName", "GetFullName",
            "GetBirthName", "GetNickname", "GetTitle"
        }
        for func in basic_functions:
            assert func in CHARACTER_FUNCTIONS
            assert is_character_function(func)

    def test_ui_name_functions_exist(self):
        """Test UI name functions are present."""
        ui_functions = {
            "GetShortUIName", "GetShortUINameNoTooltip", "GetShortUINamePossessive",
            "GetUIName", "GetUINameNoTooltip", "GetTitledFirstNameNoTooltip"
        }
        for func in ui_functions:
            assert func in CHARACTER_FUNCTIONS
            assert is_character_function(func)

    def test_gender_pronoun_functions_exist(self):
        """Test gender-based pronoun functions."""
        gender_functions = {
            "GetHerHis", "GetSheHe", "GetHerHim", "GetHerselfHimself",
            "GetWomanMan", "GetGirlBoy", "GetDaughterSon", "GetLadyLord", "GetQueenKing"
        }
        for func in gender_functions:
            assert func in CHARACTER_FUNCTIONS
            assert is_character_function(func)

    def test_special_accessor_functions_exist(self):
        """Test special accessor functions for scope chains."""
        special_functions = {
            "GetAdjective", "GetReligiousHead", "GetCollectiveNoun",
            "GetTypeName", "GetTextIcon", "Custom", "MakeScope", "ScriptValue"
        }
        for func in special_functions:
            assert func in CHARACTER_FUNCTIONS
            assert is_character_function(func)

    def test_function_count_expanded(self):
        """Test that we have significantly more functions than before."""
        # Original had ~20 functions, we should have 40+
        assert len(CHARACTER_FUNCTIONS) >= 40


class TestScopeChainValidation:
    """Test scope chain extraction and validation."""

    def test_extract_simple_scope_chain(self):
        """Test extracting simple scope chains."""
        text = "[CHARACTER.GetName] is here"
        chains = extract_scope_chains(text)
        assert "CHARACTER.GetName" in chains

    def test_extract_multiple_scope_chains(self):
        """Test extracting multiple scope chains."""
        text = "[ROOT.GetTitle] and [TARGET_CHARACTER.GetFirstName]"
        chains = extract_scope_chains(text)
        assert "ROOT.GetTitle" in chains
        assert "TARGET_CHARACTER.GetFirstName" in chains

    def test_extract_scope_variable_reference(self):
        """Test extracting scope:variable references."""
        text = "[scope:target.GetUIName] appears"
        chains = extract_scope_chains(text)
        assert "scope:target.GetUIName" in chains

    def test_extract_complex_scope_chain(self):
        """Test extracting complex accessor chains."""
        text = "[CHARACTER.GetFaith.GetAdjective] religion"
        chains = extract_scope_chains(text)
        assert "CHARACTER.GetFaith.GetAdjective" in chains

    def test_validate_simple_scope_chain(self):
        """Test validating a simple scope chain."""
        is_valid, error = validate_scope_chain("CHARACTER.GetName")
        assert is_valid is True
        assert error is None

    def test_validate_scope_variable_chain(self):
        """Test validating scope:variable chains."""
        is_valid, error = validate_scope_chain("scope:target.GetFirstName")
        assert is_valid is True
        assert error is None

    def test_validate_complex_accessor_chain(self):
        """Test validating complex accessor chains."""
        is_valid, error = validate_scope_chain("CHARACTER.GetFaith.GetAdjective")
        assert is_valid is True
        assert error is None

    def test_validate_custom_function_chain(self):
        """Test validating Custom() function chains."""
        is_valid, error = validate_scope_chain("CHARACTER.Custom")
        assert is_valid is True
        assert error is None

    def test_validate_makescope_scriptvalue_chain(self):
        """Test validating MakeScope.ScriptValue chains."""
        is_valid, error = validate_scope_chain("CHARACTER.MakeScope.ScriptValue")
        assert is_valid is True
        assert error is None

    def test_invalid_scope_name(self):
        """Test that invalid scope names are rejected."""
        is_valid, error = validate_scope_chain("InvalidScope.GetName")
        assert is_valid is False
        assert "Unknown scope" in error

    def test_invalid_function_name(self):
        """Test that invalid function names are rejected."""
        is_valid, error = validate_scope_chain("CHARACTER.GetInvalidFunc")
        assert is_valid is False
        assert "Unknown character function" in error

    def test_empty_scope_variable(self):
        """Test that empty scope:variable is rejected."""
        is_valid, error = validate_scope_chain("scope:.GetName")
        assert is_valid is False
        assert "Empty scope variable" in error


class TestVariableSubstitution:
    """Test variable substitution pattern validation."""

    def test_extract_simple_variable(self):
        """Test extracting simple variables."""
        text = "$gold$ coins"
        variables = extract_variable_substitutions(text)
        assert variables == [("gold", None)]

    def test_extract_variable_with_format_plus(self):
        """Test extracting variable with + format."""
        text = "$VALUE|+$ gold"
        variables = extract_variable_substitutions(text)
        assert variables == [("VALUE", "+")]

    def test_extract_variable_with_format_minus(self):
        """Test extracting variable with - format."""
        text = "$VALUE|-$ change"
        variables = extract_variable_substitutions(text)
        assert variables == [("VALUE", "-")]

    def test_extract_variable_with_format_v0(self):
        """Test extracting variable with V0 format."""
        text = "$SIZE|V0$ things"
        variables = extract_variable_substitutions(text)
        assert variables == [("SIZE", "V0")]

    def test_extract_multiple_variables(self):
        """Test extracting multiple variables."""
        text = "$VALUE|-$ gold and $SIZE$ items"
        variables = extract_variable_substitutions(text)
        assert len(variables) == 2
        assert ("VALUE", "-") in variables
        assert ("SIZE", None) in variables

    def test_validate_simple_variable(self):
        """Test validating simple variables."""
        is_valid, error = validate_variable_substitution("GOLD")
        assert is_valid is True
        assert error is None

    def test_validate_variable_with_underscore(self):
        """Test validating variables with underscores."""
        is_valid, error = validate_variable_substitution("MY_VALUE")
        assert is_valid is True
        assert error is None

    def test_validate_variable_with_format_plus(self):
        """Test validating variable with + format."""
        is_valid, error = validate_variable_substitution("VALUE", "+")
        assert is_valid is True
        assert error is None

    def test_validate_variable_with_format_v0(self):
        """Test validating variable with V0 format."""
        is_valid, error = validate_variable_substitution("SIZE", "V0")
        assert is_valid is True
        assert error is None

    def test_invalid_variable_starts_with_number(self):
        """Test that variables starting with numbers are invalid."""
        is_valid, error = validate_variable_substitution("123invalid")
        assert is_valid is False
        assert "Invalid variable name" in error

    def test_invalid_format_specifier(self):
        """Test that invalid format specifiers are rejected."""
        is_valid, error = validate_variable_substitution("VALUE", "invalid")
        assert is_valid is False
        assert "Unknown format specifier" in error

    def test_validate_all_variables_in_text(self):
        """Test validating all variables in text."""
        text = "$VALUE|+$ and $SIZE|V0$ items"
        issues = validate_all_variable_substitutions(text)
        assert len(issues) == 0

    def test_validate_all_with_invalid_variable(self):
        """Test detecting invalid variables in text."""
        text = "$123bad$ variable"
        issues = validate_all_variable_substitutions(text)
        assert len(issues) == 1
        assert "123bad" in issues[0][0]


class TestConceptLinks:
    """Test concept link extraction and validation."""

    def test_extract_simple_concept_link(self):
        """Test extracting simple concept links."""
        text = "[vassal|E] is important"
        concepts = extract_concept_links(text)
        assert ("vassal", "E") in concepts

    def test_extract_concept_without_context(self):
        """Test extracting concept without context letter."""
        text = "[gold_i] inline icon"
        concepts = extract_concept_links(text)
        # Should extract gold_i with empty context
        assert len(concepts) > 0

    def test_extract_multiple_concepts(self):
        """Test extracting multiple concept links."""
        text = "[vassal|E] and [opinion|E]"
        concepts = extract_concept_links(text)
        assert len(concepts) >= 2

    def test_concept_link_doesnt_match_scope_chains(self):
        """Test that scope chains are not matched as concepts."""
        text = "[CHARACTER.GetName] is not a concept"
        concepts = extract_concept_links(text)
        # Should not extract CHARACTER as a concept (it has a dot)
        character_concepts = [c for c in concepts if c[0] == "CHARACTER"]
        assert len(character_concepts) == 0

    def test_validate_known_concept(self):
        """Test validating known game concepts."""
        is_valid, error = validate_concept_link_reference("vassal", "E", allow_unknown=False)
        assert is_valid is True
        assert error is None

    def test_validate_unknown_concept_allow(self):
        """Test validating unknown concept with allow_unknown=True."""
        is_valid, error = validate_concept_link_reference("custom_mod_concept", "E", allow_unknown=True)
        assert is_valid is True
        assert error is None

    def test_validate_unknown_concept_strict(self):
        """Test validating unknown concept with allow_unknown=False."""
        is_valid, error = validate_concept_link_reference("custom_mod_concept", "E", allow_unknown=False)
        assert is_valid is False
        assert "Unknown game concept" in error

    def test_validate_invalid_context(self):
        """Test that invalid context letters are rejected."""
        is_valid, error = validate_concept_link_reference("vassal", "Z")
        assert is_valid is False
        assert "Invalid concept context" in error

    def test_validate_empty_concept(self):
        """Test that empty concept names are rejected."""
        is_valid, error = validate_concept_link_reference("", "E")
        assert is_valid is False
        assert "Empty concept name" in error

    def test_common_game_concepts_exist(self):
        """Test that common game concepts are in the set."""
        common_concepts = {
            "vassal", "liege", "opinion", "gold", "prestige", "piety",
            "faith", "culture", "dynasty", "house", "title", "claim"
        }
        for concept in common_concepts:
            assert concept in GAME_CONCEPTS


class TestExtendedFormattingCodes:
    """Test extended text formatting codes."""

    def test_case_sensitive_newline_codes(self):
        """Test that #N and #n are both valid (case matters)."""
        assert is_text_formatting_code("#N")
        assert is_text_formatting_code("#n")
        assert "#N" in TEXT_FORMATTING_CODES
        assert "#n" in TEXT_FORMATTING_CODES

    def test_clear_formatting_code(self):
        """Test #X clear formatting code."""
        assert is_text_formatting_code("#X")

    def test_color_codes_exist(self):
        """Test that color codes are present."""
        color_codes = [
            "#color_blue", "#color_red", "#color_green", "#color_yellow"
        ]
        for code in color_codes:
            assert is_text_formatting_code(code)

    def test_tutorial_keyword_code(self):
        """Test #TUT_KW tutorial keyword highlighting."""
        assert is_text_formatting_code("#TUT_KW")

    def test_emphasis_variants(self):
        """Test both #EMP and #emphasis."""
        assert is_text_formatting_code("#EMP")
        assert is_text_formatting_code("#emphasis")

    def test_value_display_case_sensitive(self):
        """Test #V and #v are both valid."""
        assert is_text_formatting_code("#V")
        assert is_text_formatting_code("#v")

    def test_formatting_code_count_expanded(self):
        """Test that we have significantly more formatting codes."""
        # Original had ~13 codes, we should have 30+
        assert len(TEXT_FORMATTING_CODES) >= 30


class TestExtendedIconReferences:
    """Test extended icon reference set."""

    def test_currency_icons_exist(self):
        """Test currency and resource icons."""
        icons = ["@gold_icon!", "@prestige_icon!", "@piety_icon!", "@renown_icon!"]
        for icon in icons:
            assert is_icon_reference(icon)

    def test_skill_icons_exist(self):
        """Test skill icons."""
        icons = [
            "@diplomacy_icon!", "@martial_icon!", "@stewardship_icon!",
            "@intrigue_icon!", "@learning_icon!"
        ]
        for icon in icons:
            assert is_icon_reference(icon)

    def test_title_tier_icons_exist(self):
        """Test title tier icons."""
        icons = [
            "@barony_icon!", "@county_icon!", "@duchy_icon!",
            "@kingdom_icon!", "@empire_icon!"
        ]
        for icon in icons:
            assert is_icon_reference(icon)

    def test_special_mechanics_icons_exist(self):
        """Test special mechanics icons."""
        icons = ["@scheme_icon!", "@secret_icon!", "@trait_icon!", "@modifier_icon!"]
        for icon in icons:
            assert is_icon_reference(icon)

    def test_short_form_icons_exist(self):
        """Test short form icons."""
        icons = ["@gold!", "@prestige!", "@piety!", "@dread!"]
        for icon in icons:
            assert is_icon_reference(icon)

    def test_icon_count_expanded(self):
        """Test that we have significantly more icons."""
        # Original had ~14 icons, we should have 70+
        assert len(ICON_REFERENCES) >= 70


class TestIntegration:
    """Test integration of all enhanced localization features."""

    def test_complex_localization_text(self):
        """Test validating complex localization text with all features."""
        text = (
            "[CHARACTER.GetShortUIName] has gained $VALUE|+$ @gold_icon! "
            "and now has #color_green positive#! [opinion|E] "
            "with [scope:target.GetUINameNoTooltip]#N"
            "This is important!"
        )

        # Extract and validate scope chains
        chains = extract_scope_chains(text)
        assert len(chains) >= 2  # CHARACTER.GetShortUIName and scope:target.GetUINameNoTooltip

        # Extract and validate variables
        variables = extract_variable_substitutions(text)
        assert len(variables) >= 1  # VALUE|+

        # Extract concept links
        concepts = extract_concept_links(text)
        assert len([c for c in concepts if c[0] == "opinion"]) >= 1

    def test_scope_chain_with_accessor(self):
        """Test complex scope chain with faith accessor."""
        text = "[CHARACTER.GetFaith.GetAdjective|U] religion"
        chains = extract_scope_chains(text)
        assert len(chains) >= 1

        # Validate the chain
        chain = chains[0]
        is_valid, error = validate_scope_chain(chain)
        assert is_valid is True

    def test_custom_function_usage(self):
        """Test Custom() function in scope chain."""
        text = "[CHARACTER.Custom('GetCourt')] appears"
        chains = extract_scope_chains(text)
        # The pattern might not capture the quotes, but should get CHARACTER.Custom
        assert len(chains) >= 1

    def test_makescope_scriptvalue(self):
        """Test MakeScope.ScriptValue() pattern."""
        text = "[actor.MakeScope.ScriptValue('number_of_vassals')] vassals"
        chains = extract_scope_chains(text)
        assert len(chains) >= 1


class TestBackwardCompatibility:
    """Ensure backward compatibility with existing functionality."""

    def test_original_functions_still_work(self):
        """Test that all original functions still exist."""
        original_functions = {
            "GetName", "GetFirstName", "GetLastName", "GetTitle",
            "GetHerHis", "GetSheHe", "GetHerHim"
        }
        for func in original_functions:
            assert is_character_function(func)

    def test_original_formatting_codes_still_work(self):
        """Test that original formatting codes still exist."""
        original_codes = ["#P", "#N", "#bold", "#italic", "#!", "#weak"]
        for code in original_codes:
            assert is_text_formatting_code(code)

    def test_original_icons_still_work(self):
        """Test that original icons still exist."""
        original_icons = [
            "@gold_icon!", "@prestige_icon!", "@piety_icon!",
            "@dread_icon!", "@stress_icon!"
        ]
        for icon in original_icons:
            assert is_icon_reference(icon)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
