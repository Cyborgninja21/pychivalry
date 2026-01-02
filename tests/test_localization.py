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


# =============================================================================
# FUZZY MATCHING TESTS
# =============================================================================


class TestLevenshteinDistance:
    """Test Levenshtein distance calculation."""

    def test_identical_strings(self):
        """Test identical strings have distance 0."""
        from pychivalry.localization import levenshtein_distance

        assert levenshtein_distance("my_event.t", "my_event.t") == 0
        assert levenshtein_distance("", "") == 0

    def test_single_insertion(self):
        """Test single character insertion."""
        from pychivalry.localization import levenshtein_distance

        assert levenshtein_distance("my_event.t", "my_eventt.t") == 1

    def test_single_deletion(self):
        """Test single character deletion."""
        from pychivalry.localization import levenshtein_distance

        assert levenshtein_distance("my_event.t", "my_evnt.t") == 1

    def test_single_substitution(self):
        """Test single character substitution."""
        from pychivalry.localization import levenshtein_distance

        assert levenshtein_distance("my_event.t", "my_event.x") == 1

    def test_multiple_edits(self):
        """Test multiple edits."""
        from pychivalry.localization import levenshtein_distance

        # 't' -> 'desc' needs 4 edits (substitute t->d, insert e, insert s, insert c)
        dist = levenshtein_distance("my_event.t", "my_event.desc")
        assert dist == 4

    def test_empty_string(self):
        """Test with empty string."""
        from pychivalry.localization import levenshtein_distance

        assert levenshtein_distance("abc", "") == 3
        assert levenshtein_distance("", "abc") == 3

    def test_completely_different(self):
        """Test completely different strings."""
        from pychivalry.localization import levenshtein_distance

        assert levenshtein_distance("abc", "xyz") == 3


class TestSimilarityRatio:
    """Test similarity ratio calculation."""

    def test_identical_strings(self):
        """Test identical strings have ratio 1.0."""
        from pychivalry.localization import similarity_ratio

        assert similarity_ratio("my_event.t", "my_event.t") == 1.0

    def test_empty_strings(self):
        """Test empty strings."""
        from pychivalry.localization import similarity_ratio

        assert similarity_ratio("", "") == 1.0
        assert similarity_ratio("abc", "") == 0.0

    def test_similar_strings(self):
        """Test similar strings have high ratio."""
        from pychivalry.localization import similarity_ratio

        # One character difference in 10-char string = 0.9 similarity
        ratio = similarity_ratio("my_event.t", "my_evnt.t")  # Missing 'e'
        assert ratio >= 0.85

    def test_different_strings(self):
        """Test different strings have low ratio."""
        from pychivalry.localization import similarity_ratio

        ratio = similarity_ratio("abc", "xyz")
        assert ratio == 0.0


class TestFindSimilarKeys:
    """Test finding similar localization keys."""

    def test_find_typo_match(self):
        """Test finding match for typo."""
        from pychivalry.localization import find_similar_keys

        keys = {"my_event.0001.t", "my_event.0001.desc", "my_event.0002.t"}
        matches = find_similar_keys("my_evnt.0001.t", keys, threshold=0.7)

        assert len(matches) >= 1
        assert matches[0][0] == "my_event.0001.t"
        assert matches[0][1] >= 0.85

    def test_find_multiple_matches(self):
        """Test finding multiple similar keys."""
        from pychivalry.localization import find_similar_keys

        keys = {"my_event.0001.t", "my_event.0001.desc", "other.t"}
        matches = find_similar_keys("my_event.0001.x", keys, threshold=0.7)

        # Should find keys with same prefix
        assert len(matches) >= 1

    def test_no_matches_above_threshold(self):
        """Test no matches when strings too different."""
        from pychivalry.localization import find_similar_keys

        keys = {"completely_different.key"}
        matches = find_similar_keys("my_event.0001.t", keys, threshold=0.7)

        assert len(matches) == 0

    def test_empty_inputs(self):
        """Test with empty inputs."""
        from pychivalry.localization import find_similar_keys

        assert find_similar_keys("", {"a", "b"}) == []
        assert find_similar_keys("test", set()) == []

    def test_max_results_limit(self):
        """Test max_results parameter."""
        from pychivalry.localization import find_similar_keys

        keys = {"test.a", "test.b", "test.c", "test.d", "test.e"}
        matches = find_similar_keys("test.x", keys, threshold=0.5, max_results=2)

        assert len(matches) <= 2


class TestFindKeysByPrefix:
    """Test finding keys by prefix."""

    def test_find_by_prefix(self):
        """Test finding keys by prefix."""
        from pychivalry.localization import find_keys_by_prefix

        keys = {"my_event.0001.t", "my_event.0001.desc", "other.t"}
        matches = find_keys_by_prefix("my_event.0001", keys)

        assert len(matches) == 2
        assert "my_event.0001.t" in matches
        assert "my_event.0001.desc" in matches

    def test_case_insensitive(self):
        """Test prefix matching is case-insensitive."""
        from pychivalry.localization import find_keys_by_prefix

        keys = {"My_Event.0001.t", "MY_EVENT.0001.desc"}
        matches = find_keys_by_prefix("my_event.0001", keys)

        assert len(matches) == 2

    def test_no_matches(self):
        """Test when no keys match prefix."""
        from pychivalry.localization import find_keys_by_prefix

        keys = {"other.0001.t"}
        matches = find_keys_by_prefix("my_event", keys)

        assert len(matches) == 0

    def test_empty_inputs(self):
        """Test with empty inputs."""
        from pychivalry.localization import find_keys_by_prefix

        assert find_keys_by_prefix("", {"a"}) == []
        assert find_keys_by_prefix("test", set()) == []


class TestFindKeysByNamespace:
    """Test finding keys by namespace."""

    def test_find_by_namespace(self):
        """Test finding keys by namespace."""
        from pychivalry.localization import find_keys_by_namespace

        keys = {"my_mod.0001.t", "my_mod.0002.t", "other_mod.0001.t"}
        matches = find_keys_by_namespace("my_mod", keys)

        assert len(matches) == 2
        assert "my_mod.0001.t" in matches
        assert "my_mod.0002.t" in matches

    def test_sorted_results(self):
        """Test results are sorted alphabetically."""
        from pychivalry.localization import find_keys_by_namespace

        keys = {"my_mod.0002.t", "my_mod.0001.t", "my_mod.0001.desc"}
        matches = find_keys_by_namespace("my_mod", keys)

        assert matches == sorted(matches)

    def test_empty_inputs(self):
        """Test with empty inputs."""
        from pychivalry.localization import find_keys_by_namespace

        assert find_keys_by_namespace("", {"a.b"}) == []
        assert find_keys_by_namespace("test", set()) == []


class TestFindBestLocalizationMatch:
    """Test finding the best localization match."""

    def test_exact_match(self):
        """Test exact match is found."""
        from pychivalry.localization import find_best_localization_match

        keys = {"my_event.0001.t", "my_event.0001.desc"}
        match = find_best_localization_match("my_event.0001.t", keys)

        assert match is not None
        assert match.match_type == "exact"
        assert match.similarity == 1.0
        assert match.matched_key == "my_event.0001.t"

    def test_case_insensitive_exact_match(self):
        """Test case-insensitive exact match."""
        from pychivalry.localization import find_best_localization_match

        keys = {"My_Event.0001.t"}
        match = find_best_localization_match("my_event.0001.t", keys)

        assert match is not None
        assert match.match_type == "exact"

    def test_fuzzy_match_typo(self):
        """Test fuzzy match for typo."""
        from pychivalry.localization import find_best_localization_match

        keys = {"my_event.0001.t", "my_event.0001.desc"}
        match = find_best_localization_match("my_evnt.0001.t", keys)  # Typo

        assert match is not None
        assert match.match_type == "fuzzy"
        assert match.matched_key == "my_event.0001.t"

    def test_prefix_match(self):
        """Test prefix match when fuzzy fails."""
        from pychivalry.localization import find_best_localization_match

        keys = {"my_event.0001.t"}
        match = find_best_localization_match(
            "my_event.0001.completely_wrong_suffix", keys, fuzzy_threshold=0.9
        )

        # Should fall back to prefix match
        assert match is not None
        assert match.match_type in ("fuzzy", "prefix")

    def test_no_match(self):
        """Test when no match is found."""
        from pychivalry.localization import find_best_localization_match

        keys = {"completely.different.key"}
        match = find_best_localization_match(
            "my_event.0001.t", keys, fuzzy_threshold=0.9
        )

        # May or may not find a namespace match depending on threshold
        if match:
            assert match.similarity < 0.9

    def test_empty_inputs(self):
        """Test with empty inputs."""
        from pychivalry.localization import find_best_localization_match

        assert find_best_localization_match("", {"a"}) is None
        assert find_best_localization_match("test", set()) is None


class TestSuggestLocalizationFix:
    """Test localization fix suggestions."""

    def test_suggest_for_typo(self):
        """Test suggestion for typo."""
        from pychivalry.localization import suggest_localization_fix

        keys = {"my_event.0001.t", "my_event.0001.desc"}
        suggestion = suggest_localization_fix("my_evnt.0001.t", keys)

        assert suggestion is not None
        assert "Did you mean" in suggestion
        assert "my_event.0001.t" in suggestion

    def test_suggest_title_suffix(self):
        """Test suggestion for .title -> .t suffix mistake."""
        from pychivalry.localization import suggest_localization_fix

        keys = {"my_event.0001.t"}
        suggestion = suggest_localization_fix("my_event.0001.title", keys)

        assert suggestion is not None
        assert ".t" in suggestion

    def test_suggest_desc_suffix(self):
        """Test suggestion for .description -> .desc suffix mistake."""
        from pychivalry.localization import suggest_localization_fix

        keys = {"my_event.0001.desc"}
        suggestion = suggest_localization_fix("my_event.0001.description", keys)

        assert suggestion is not None

    def test_no_suggestion_for_existing_key(self):
        """Test no suggestion when key exists."""
        from pychivalry.localization import suggest_localization_fix

        keys = {"my_event.0001.t"}
        suggestion = suggest_localization_fix("my_event.0001.t", keys)

        assert suggestion is None

    def test_no_suggestion_for_completely_different(self):
        """Test no suggestion for completely different key."""
        from pychivalry.localization import suggest_localization_fix

        keys = {"x.y.z"}
        suggestion = suggest_localization_fix("a.b.c", keys, fuzzy_threshold=0.9)

        # May return None or namespace-level suggestion
        if suggestion:
            assert "not found" in suggestion.lower()


class TestValidateLocalizationKeyWithSuggestions:
    """Test validation with suggestions."""

    def test_valid_key(self):
        """Test valid key passes validation."""
        from pychivalry.localization import validate_localization_key_with_suggestions

        keys = {"my_event.0001.t"}
        valid, msg, match = validate_localization_key_with_suggestions(
            "my_event.0001.t", keys
        )

        assert valid is True
        assert msg is None
        assert match is None

    def test_invalid_key_with_suggestion(self):
        """Test invalid key returns suggestion."""
        from pychivalry.localization import validate_localization_key_with_suggestions

        keys = {"my_event.0001.t", "my_event.0001.desc"}
        valid, msg, match = validate_localization_key_with_suggestions(
            "my_evnt.0001.t", keys  # Typo
        )

        assert valid is False
        assert msg is not None
        assert "Did you mean" in msg
        assert match is not None

    def test_invalid_key_no_suggestion(self):
        """Test invalid key with no close match."""
        from pychivalry.localization import validate_localization_key_with_suggestions

        keys = {"completely.different.key"}
        valid, msg, match = validate_localization_key_with_suggestions(
            "my_event.0001.t", keys, fuzzy_threshold=0.95
        )

        assert valid is False
        assert msg is not None
        assert "not found" in msg.lower()


class TestFuzzyMatchingIntegration:
    """Integration tests for fuzzy matching."""

    def test_complete_workflow(self):
        """Test complete validation workflow with fuzzy matching."""
        from pychivalry.localization import (
            validate_localization_key_with_suggestions,
            find_similar_keys,
            find_keys_by_namespace,
        )

        # Simulate a mod's localization keys
        available_keys = {
            "my_mod.0001.t",
            "my_mod.0001.desc",
            "my_mod.0001.a",
            "my_mod.0001.b",
            "my_mod.0002.t",
            "my_mod.0002.desc",
            "other_mod.0001.t",
        }

        # Valid key
        valid, _, _ = validate_localization_key_with_suggestions(
            "my_mod.0001.t", available_keys
        )
        assert valid is True

        # Typo in key
        valid, msg, match = validate_localization_key_with_suggestions(
            "my_mod.0001.tt", available_keys  # Extra 't'
        )
        assert valid is False
        assert match is not None

        # Find all keys in namespace
        namespace_keys = find_keys_by_namespace("my_mod", available_keys)
        assert len(namespace_keys) == 6

        # Find similar keys
        similar = find_similar_keys("my_mod.0001.c", available_keys, threshold=0.8)
        assert len(similar) >= 1  # Should find .a or .b

    def test_common_modder_mistakes(self):
        """Test detection of common modder mistakes."""
        from pychivalry.localization import suggest_localization_fix

        keys = {"my_event.0001.t", "my_event.0001.desc", "my_event.0001.a"}

        # Mistake: Using .title instead of .t
        suggestion = suggest_localization_fix("my_event.0001.title", keys)
        assert suggestion is not None

        # Mistake: Using .description instead of .desc
        suggestion = suggest_localization_fix("my_event.0001.description", keys)
        assert suggestion is not None

        # Mistake: Typo in event number
        suggestion = suggest_localization_fix("my_event.0O01.t", keys)  # 'O' vs '0'
        assert suggestion is not None


# =============================================================================
# DIAGNOSTIC CREATION TESTS (CK3600-CK3604)
# =============================================================================


class TestDiagnosticCodes:
    """Test diagnostic code constants."""

    def test_diagnostic_codes_defined(self):
        """Test that all diagnostic codes are defined."""
        from pychivalry.localization import (
            DIAG_MISSING_LOC_KEY,
            DIAG_LITERAL_TEXT,
            DIAG_ENCODING_ISSUE,
            DIAG_INCONSISTENT_NAMING,
            DIAG_UNUSED_LOC_KEY,
        )

        assert DIAG_MISSING_LOC_KEY == "CK3600"
        assert DIAG_LITERAL_TEXT == "CK3601"
        assert DIAG_ENCODING_ISSUE == "CK3602"
        assert DIAG_INCONSISTENT_NAMING == "CK3603"
        assert DIAG_UNUSED_LOC_KEY == "CK3604"


class TestCreateMissingKeyDiagnostic:
    """Test CK3600 diagnostic creation."""

    def test_create_basic_diagnostic(self):
        """Test creating basic missing key diagnostic."""
        from pychivalry.localization import create_missing_key_diagnostic

        diag = create_missing_key_diagnostic("my_event.0001.t", 5, 10, 25)

        assert diag.code == "CK3600"
        assert diag.severity == "warning"
        assert diag.line == 5
        assert diag.start_char == 10
        assert diag.end_char == 25
        assert "my_event.0001.t" in diag.message
        assert "not found" in diag.message

    def test_create_diagnostic_with_suggestion(self):
        """Test diagnostic includes fuzzy match suggestion."""
        from pychivalry.localization import create_missing_key_diagnostic

        keys = {"my_event.0001.t", "my_event.0001.desc"}
        diag = create_missing_key_diagnostic(
            "my_evnt.0001.t", 5, 10, 25, available_keys=keys
        )

        assert diag.code == "CK3600"
        assert "Did you mean" in diag.message
        assert diag.suggestion is not None

    def test_create_diagnostic_no_matches(self):
        """Test diagnostic when no similar keys exist."""
        from pychivalry.localization import create_missing_key_diagnostic

        keys = {"completely.different.key"}
        diag = create_missing_key_diagnostic(
            "my_event.0001.t", 5, 10, 25, available_keys=keys, fuzzy_threshold=0.95
        )

        assert diag.code == "CK3600"
        assert "not found" in diag.message


class TestCreateLiteralTextDiagnostic:
    """Test CK3601 diagnostic creation."""

    def test_create_diagnostic(self):
        """Test creating literal text diagnostic."""
        from pychivalry.localization import create_literal_text_diagnostic

        diag = create_literal_text_diagnostic("title", '"My Event"', 3, 12, 24)

        assert diag.code == "CK3601"
        assert diag.severity == "information"
        assert diag.line == 3
        assert "localization key" in diag.message.lower()
        assert "title" in diag.message

    def test_truncates_long_literals(self):
        """Test that long literal values are truncated."""
        from pychivalry.localization import create_literal_text_diagnostic

        long_literal = '"' + "x" * 100 + '"'
        diag = create_literal_text_diagnostic("desc", long_literal, 5, 0, 100)

        assert diag.code == "CK3601"
        assert "..." in diag.message


class TestCreateEncodingDiagnostic:
    """Test CK3602 diagnostic creation."""

    def test_create_diagnostic(self):
        """Test creating encoding diagnostic."""
        from pychivalry.localization import create_encoding_diagnostic

        diag = create_encoding_diagnostic("localization/english/events.yml")

        assert diag.code == "CK3602"
        assert diag.severity == "warning"
        assert diag.line == 0
        assert "UTF-8-BOM" in diag.message
        assert diag.suggestion is not None


class TestCreateInconsistentNamingDiagnostic:
    """Test CK3603 diagnostic creation."""

    def test_create_diagnostic(self):
        """Test creating inconsistent naming diagnostic."""
        from pychivalry.localization import create_inconsistent_naming_diagnostic

        diag = create_inconsistent_naming_diagnostic(
            "random_key", "my_mod.0001.t", 10, 5, 15
        )

        assert diag.code == "CK3603"
        assert diag.severity == "hint"
        assert diag.line == 10
        assert "random_key" in diag.message
        assert "pattern" in diag.message.lower()


class TestCreateUnusedKeyDiagnostic:
    """Test CK3604 diagnostic creation."""

    def test_create_diagnostic(self):
        """Test creating unused key diagnostic."""
        from pychivalry.localization import create_unused_key_diagnostic

        diag = create_unused_key_diagnostic("old_event.unused.t", 50, 0, 20)

        assert diag.code == "CK3604"
        assert diag.severity == "warning"
        assert diag.line == 50
        assert "never referenced" in diag.message
        assert "old_event.unused.t" in diag.message


class TestLocalizationFieldHelpers:
    """Test localization field helper functions."""

    def test_is_localization_field(self):
        """Test identifying localization fields."""
        from pychivalry.localization import is_localization_field

        # These should use loc keys
        assert is_localization_field("title") is True
        assert is_localization_field("desc") is True
        assert is_localization_field("name") is True
        assert is_localization_field("tooltip") is True
        assert is_localization_field("custom_tooltip") is True

        # These should not
        assert is_localization_field("trigger") is False
        assert is_localization_field("effect") is False
        assert is_localization_field("immediate") is False

    def test_is_localization_field_case_insensitive(self):
        """Test case insensitivity."""
        from pychivalry.localization import is_localization_field

        assert is_localization_field("Title") is True
        assert is_localization_field("DESC") is True

    def test_is_literal_string(self):
        """Test literal string detection."""
        from pychivalry.localization import is_literal_string

        assert is_literal_string('"Hello World"') is True
        assert is_literal_string("'Hello World'") is True
        assert is_literal_string("my_event.t") is False
        assert is_literal_string("123") is False


class TestEncodingCheck:
    """Test UTF-8-BOM encoding check."""

    def test_valid_bom(self):
        """Test detecting valid UTF-8-BOM."""
        from pychivalry.localization import check_localization_file_encoding

        content_with_bom = b"\xef\xbb\xbfl_english:\n  key: value"
        assert check_localization_file_encoding(content_with_bom) is True

    def test_missing_bom(self):
        """Test detecting missing BOM."""
        from pychivalry.localization import check_localization_file_encoding

        content_without_bom = b"l_english:\n  key: value"
        assert check_localization_file_encoding(content_without_bom) is False

    def test_empty_content(self):
        """Test empty file."""
        from pychivalry.localization import check_localization_file_encoding

        assert check_localization_file_encoding(b"") is False


class TestValidateKeyNaming:
    """Test localization key naming validation."""

    def test_valid_key_formats(self):
        """Test valid key formats."""
        from pychivalry.localization import validate_localization_key_naming

        valid, _ = validate_localization_key_naming("my_mod.0001.t")
        assert valid is True

        valid, _ = validate_localization_key_naming("my_mod.0001.desc")
        assert valid is True

        valid, _ = validate_localization_key_naming("my_mod.event_name")
        assert valid is True

    def test_invalid_key_formats(self):
        """Test invalid key formats."""
        from pychivalry.localization import validate_localization_key_naming

        valid, pattern = validate_localization_key_naming("single_word")
        assert valid is False
        assert pattern is not None

    def test_event_id_mismatch(self):
        """Test key doesn't match event ID."""
        from pychivalry.localization import validate_localization_key_naming

        valid, pattern = validate_localization_key_naming(
            "wrong_mod.0001.t", event_id="my_mod.0001"
        )
        assert valid is False


class TestCollectLocalizationDiagnostics:
    """Test the main diagnostic collection function."""

    def test_collect_missing_key_diagnostics(self):
        """Test collecting CK3600 diagnostics."""
        from pychivalry.localization import collect_localization_diagnostics

        refs = [
            ("my_event.0001.t", 5, 10, 25),
            ("my_evnt.0001.desc", 6, 10, 28),  # Typo
        ]
        keys = {"my_event.0001.t", "my_event.0001.desc"}

        diags = collect_localization_diagnostics(refs, keys)

        # Should find one missing key (the typo)
        missing_diags = [d for d in diags if d.code == "CK3600"]
        assert len(missing_diags) == 1
        assert "my_evnt.0001.desc" in missing_diags[0].message

    def test_collect_naming_diagnostics(self):
        """Test collecting CK3603 diagnostics."""
        from pychivalry.localization import collect_localization_diagnostics

        refs = [
            ("my_event.0001.t", 5, 10, 25),  # Valid
            ("random", 6, 10, 16),  # Invalid naming
        ]
        keys = {"my_event.0001.t", "random"}

        diags = collect_localization_diagnostics(refs, keys, check_naming=True)

        # Should find one naming issue
        naming_diags = [d for d in diags if d.code == "CK3603"]
        assert len(naming_diags) == 1
        assert "random" in naming_diags[0].message

    def test_disable_naming_check(self):
        """Test disabling naming convention check."""
        from pychivalry.localization import collect_localization_diagnostics

        refs = [("random", 6, 10, 16)]  # Invalid naming
        keys = {"random"}

        diags = collect_localization_diagnostics(refs, keys, check_naming=False)

        # Should find no naming issues when disabled
        naming_diags = [d for d in diags if d.code == "CK3603"]
        assert len(naming_diags) == 0

    def test_empty_inputs(self):
        """Test with empty inputs."""
        from pychivalry.localization import collect_localization_diagnostics

        diags = collect_localization_diagnostics([], set())
        assert len(diags) == 0

    def test_all_keys_valid(self):
        """Test when all keys exist and are valid."""
        from pychivalry.localization import collect_localization_diagnostics

        refs = [
            ("my_event.0001.t", 5, 10, 25),
            ("my_event.0001.desc", 6, 10, 28),
        ]
        keys = {"my_event.0001.t", "my_event.0001.desc"}

        diags = collect_localization_diagnostics(refs, keys)

        # Should find no issues
        assert len(diags) == 0