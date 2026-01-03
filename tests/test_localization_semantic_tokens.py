"""
Tests for Semantic Tokens in Localization Files

Tests:
- Localization key highlighting
- Character function highlighting in scope chains
- Formatting code highlighting
- Icon reference highlighting
- Variable substitution highlighting
- Concept link highlighting
"""

import pytest
from pychivalry.semantic_tokens import (
    analyze_localization_file,
    tokenize_localization_content,
    TOKEN_TYPE_INDEX,
    get_semantic_tokens,
)


class TestLocalizationSemanticTokens:
    """Test semantic token generation for localization files."""

    def test_language_header(self):
        """Test tokenization of language header."""
        source = "l_english:"
        tokens = analyze_localization_file(source)

        assert len(tokens) > 0
        # Should have a keyword token for l_english
        assert any(t.token_type == TOKEN_TYPE_INDEX["keyword"] for t in tokens)

    def test_localization_key(self):
        """Test tokenization of localization key."""
        source = ' key_name:0 "Some text"'
        tokens = analyze_localization_file(source)

        assert len(tokens) > 0
        # Should have a string token for the key name
        key_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["string"]]
        assert len(key_tokens) > 0

        # Should have a number token for the version
        number_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["number"]]
        assert len(number_tokens) > 0

    def test_character_function_in_scope_chain(self):
        """Test tokenization of character functions in scope chains."""
        content = "[CHARACTER.GetName] is here"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have a variable token for CHARACTER
        var_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["variable"]]
        assert len(var_tokens) > 0

        # Should have a function token for GetName
        func_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["function"]]
        assert len(func_tokens) > 0

    def test_formatting_codes(self):
        """Test tokenization of formatting codes."""
        content = "This is #bold important#! text"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have keyword tokens for #bold and #!
        keyword_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["keyword"]]
        assert len(keyword_tokens) >= 1  # At least #bold

    def test_icon_references(self):
        """Test tokenization of icon references."""
        content = "You gain @gold_icon! 100 gold"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have a property token for @gold_icon!
        prop_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["property"]]
        assert len(prop_tokens) > 0

    def test_variable_substitution(self):
        """Test tokenization of variable substitutions."""
        content = "$VALUE$ gold"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have a variable token for VALUE
        var_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["variable"]]
        assert len(var_tokens) > 0

    def test_variable_with_format_specifier(self):
        """Test tokenization of variables with format specifiers."""
        content = "$VALUE|+$ gold"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have a variable token for VALUE
        var_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["variable"]]
        assert len(var_tokens) > 0

        # Should have a parameter token for the format specifier
        param_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["parameter"]]
        assert len(param_tokens) > 0

    def test_concept_links(self):
        """Test tokenization of concept links."""
        content = "[vassal|E] is important"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have an enumMember token for the concept
        enum_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["enumMember"]]
        assert len(enum_tokens) > 0

    def test_complex_localization_line(self):
        """Test tokenization of a complex localization line."""
        source = ' event_key:0 "[CHARACTER.GetName] has $VALUE|+$ @gold_icon! and #bold won#!"'
        tokens = analyze_localization_file(source)

        # Should have tokens for all elements
        assert len(tokens) > 0

        # Should have:
        # - string token (key_name)
        # - number token (version)
        # - variable token (CHARACTER)
        # - function token (GetName)
        # - variable token (VALUE)
        # - parameter token (format specifier)
        # - property token (icon)
        # - keyword token (formatting code)

        token_types = [t.token_type for t in tokens]
        assert TOKEN_TYPE_INDEX["string"] in token_types
        assert TOKEN_TYPE_INDEX["number"] in token_types
        assert TOKEN_TYPE_INDEX["variable"] in token_types
        assert TOKEN_TYPE_INDEX["function"] in token_types

    def test_multiple_scope_chains(self):
        """Test tokenization of multiple scope chains in one line."""
        content = "[CHARACTER.GetName] and [ROOT.GetTitle]"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have two variable tokens (CHARACTER and ROOT)
        var_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["variable"]]
        assert len(var_tokens) >= 2

        # Should have two function tokens (GetName and GetTitle)
        func_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["function"]]
        assert len(func_tokens) >= 2

    def test_multiple_formatting_codes(self):
        """Test tokenization of multiple formatting codes."""
        content = "#bold This#! and #italic that#!"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should have keyword tokens for formatting codes
        keyword_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["keyword"]]
        assert len(keyword_tokens) >= 2

    def test_get_semantic_tokens_with_uri(self):
        """Test get_semantic_tokens with .yml file URI."""
        source = ' key:0 "[CHARACTER.GetName]"'
        result = get_semantic_tokens(source, index=None, file_uri="test.yml")

        assert result is not None
        assert hasattr(result, "data")
        assert isinstance(result.data, list)
        assert len(result.data) > 0  # Should have encoded tokens

    def test_empty_localization_file(self):
        """Test tokenization of empty file."""
        source = ""
        tokens = analyze_localization_file(source)
        assert tokens == []

    def test_comment_lines_ignored(self):
        """Test that comment lines are ignored."""
        source = "# This is a comment\n key:0 \"text\""
        tokens = analyze_localization_file(source)

        # Should only have tokens from the key line, not the comment
        assert len(tokens) > 0
        # All tokens should be from line 1, not line 0
        assert all(t.line == 1 for t in tokens)


class TestLocalizationTokenIntegration:
    """Test integration of semantic tokens with full files."""

    def test_realistic_localization_file(self):
        """Test tokenization of a realistic localization file."""
        source = """l_english:
 my_event.0001.t:0 "[CHARACTER.GetTitledFirstName] gains $VALUE|+$ @gold_icon!"
 my_event.0001.desc:0 "This is #bold important#! and affects [vassal|E]"
 my_event.0001.a:0 "Accept"
"""
        tokens = analyze_localization_file(source)

        # Should have many tokens
        assert len(tokens) > 10

        # Should have various token types
        token_types = set(t.token_type for t in tokens)
        assert len(token_types) > 3  # At least keyword, string, number, variable, etc.

    def test_scope_chain_with_accessor(self):
        """Test tokenization of complex scope chain with accessor."""
        content = "[CHARACTER.GetFaith.GetAdjective] religion"
        tokens = tokenize_localization_content(content, 0, 0)

        # Should tokenize CHARACTER as variable
        var_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["variable"]]
        assert len(var_tokens) > 0

        # Should tokenize functions (GetFaith is intermediate, GetAdjective is final)
        func_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX["function"]]
        # At least GetAdjective should be tokenized as a function
        assert len(func_tokens) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
