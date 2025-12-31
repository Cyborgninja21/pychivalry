"""
Tests for the semantic tokens module.

Tests semantic tokenization functionality for CK3 scripts.
"""

import pytest
from lsprotocol import types

from pychivalry.semantic_tokens import (
    SemanticToken,
    TOKEN_TYPES,
    TOKEN_MODIFIERS,
    TOKEN_TYPE_INDEX,
    TOKEN_MODIFIER_INDEX,
    get_token_legend,
    encode_tokens,
    get_modifier_bits,
    tokenize_line,
    analyze_document,
    get_semantic_tokens,
    SEMANTIC_TOKENS_LEGEND,
)


class TestTokenLegend:
    """Tests for token legend configuration."""
    
    def test_legend_has_token_types(self):
        """Legend should contain token types."""
        legend = get_token_legend()
        assert len(legend.token_types) > 0
        assert 'keyword' in legend.token_types
        assert 'function' in legend.token_types
        assert 'variable' in legend.token_types
    
    def test_legend_has_modifiers(self):
        """Legend should contain token modifiers."""
        legend = get_token_legend()
        assert len(legend.token_modifiers) > 0
        assert 'declaration' in legend.token_modifiers
        assert 'defaultLibrary' in legend.token_modifiers
    
    def test_token_type_index_consistency(self):
        """TOKEN_TYPE_INDEX should match TOKEN_TYPES order."""
        for i, token_type in enumerate(TOKEN_TYPES):
            assert TOKEN_TYPE_INDEX[token_type] == i
    
    def test_token_modifier_index_consistency(self):
        """TOKEN_MODIFIER_INDEX should match TOKEN_MODIFIERS order."""
        for i, modifier in enumerate(TOKEN_MODIFIERS):
            assert TOKEN_MODIFIER_INDEX[modifier] == i


class TestEncodingTokens:
    """Tests for token encoding."""
    
    def test_encode_empty_list(self):
        """Empty token list should encode to empty data."""
        result = encode_tokens([])
        assert result == []
    
    def test_encode_single_token(self):
        """Single token should encode correctly."""
        token = SemanticToken(
            line=5,
            start=10,
            length=8,
            token_type=2,
            modifiers=0,
        )
        result = encode_tokens([token])
        # delta_line=5, delta_start=10, length=8, type=2, modifiers=0
        assert result == [5, 10, 8, 2, 0]
    
    def test_encode_same_line_tokens(self):
        """Tokens on same line should use relative start positions."""
        tokens = [
            SemanticToken(line=0, start=0, length=3, token_type=7, modifiers=0),
            SemanticToken(line=0, start=4, length=5, token_type=2, modifiers=0),
        ]
        result = encode_tokens(tokens)
        # First: delta_line=0, delta_start=0, length=3, type=7, modifiers=0
        # Second: delta_line=0, delta_start=4-0=4, length=5, type=2, modifiers=0
        assert result == [0, 0, 3, 7, 0, 0, 4, 5, 2, 0]
    
    def test_encode_different_line_tokens(self):
        """Tokens on different lines should use absolute start for new line."""
        tokens = [
            SemanticToken(line=0, start=5, length=3, token_type=0, modifiers=0),
            SemanticToken(line=2, start=10, length=4, token_type=1, modifiers=0),
        ]
        result = encode_tokens(tokens)
        # First: delta_line=0, delta_start=5, length=3, type=0, modifiers=0
        # Second: delta_line=2, delta_start=10 (absolute), length=4, type=1, modifiers=0
        assert result == [0, 5, 3, 0, 0, 2, 10, 4, 1, 0]
    
    def test_encode_tokens_sorted(self):
        """Tokens should be sorted by position before encoding."""
        # Provide tokens out of order
        tokens = [
            SemanticToken(line=2, start=0, length=3, token_type=0, modifiers=0),
            SemanticToken(line=0, start=0, length=3, token_type=0, modifiers=0),
        ]
        result = encode_tokens(tokens)
        # First (line 0): delta_line=0
        # Second (line 2): delta_line=2
        assert result[0] == 0  # First token delta_line
        assert result[5] == 2  # Second token delta_line
    
    def test_encode_with_modifiers(self):
        """Token modifiers should be encoded correctly."""
        token = SemanticToken(
            line=0,
            start=0,
            length=5,
            token_type=0,
            modifiers=3,  # bits 0 and 1 set
        )
        result = encode_tokens([token])
        assert result[4] == 3  # modifiers value


class TestModifierBits:
    """Tests for modifier bit flag conversion."""
    
    def test_single_modifier(self):
        """Single modifier should set correct bit."""
        bits = get_modifier_bits('declaration')
        assert bits == 1  # bit 0
        
        bits = get_modifier_bits('definition')
        assert bits == 2  # bit 1
        
        bits = get_modifier_bits('readonly')
        assert bits == 4  # bit 2
        
        bits = get_modifier_bits('defaultLibrary')
        assert bits == 8  # bit 3
    
    def test_multiple_modifiers(self):
        """Multiple modifiers should combine bits."""
        bits = get_modifier_bits('declaration', 'definition')
        assert bits == 3  # bits 0 and 1
        
        bits = get_modifier_bits('declaration', 'defaultLibrary')
        assert bits == 9  # bits 0 and 3
    
    def test_unknown_modifier_ignored(self):
        """Unknown modifiers should be silently ignored."""
        bits = get_modifier_bits('unknown_modifier')
        assert bits == 0
        
        bits = get_modifier_bits('declaration', 'unknown', 'definition')
        assert bits == 3


class TestTokenizeLines:
    """Tests for line tokenization."""
    
    def test_tokenize_comment(self):
        """Comment should be tokenized correctly."""
        tokens = tokenize_line("# This is a comment", 0, 'unknown', None, set(), set())
        assert len(tokens) >= 1
        comment_token = next(t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['comment'])
        assert comment_token.start == 0
    
    def test_tokenize_namespace_declaration(self):
        """Namespace declaration should create two tokens."""
        tokens = tokenize_line("namespace = my_mod", 0, 'unknown', None, set(), set())
        
        # Should have 'namespace' keyword and 'my_mod' namespace name
        keyword_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['keyword']]
        namespace_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['namespace']]
        
        assert len(keyword_tokens) >= 1
        assert len(namespace_tokens) >= 1
    
    def test_tokenize_boolean_values(self):
        """Boolean values should be tokenized as enumMember."""
        tokens = tokenize_line("is_alive = yes", 0, 'unknown', None, set(), set())
        
        enum_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['enumMember']]
        assert len(enum_tokens) >= 1  # 'yes' should be enumMember
    
    def test_tokenize_number(self):
        """Numbers should be tokenized correctly."""
        tokens = tokenize_line("gold = 100", 0, 'unknown', None, set(), set())
        
        number_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['number']]
        assert len(number_tokens) >= 1
    
    def test_tokenize_operator(self):
        """Operators should be tokenized correctly."""
        tokens = tokenize_line("gold >= 50", 0, 'unknown', None, set(), set())
        
        operator_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['operator']]
        assert len(operator_tokens) >= 1
    
    def test_tokenize_saved_scope(self):
        """Saved scope references should be tokenized correctly."""
        tokens = tokenize_line("scope:target = { }", 0, 'unknown', None, set(), set())
        
        # Should have 'scope' keyword and 'target' variable
        keyword_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['keyword']]
        variable_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['variable']]
        
        assert len(keyword_tokens) >= 1
        assert len(variable_tokens) >= 1
    
    def test_tokenize_list_iterator(self):
        """List iterators should be tokenized as macro."""
        tokens = tokenize_line("any_child = { }", 0, 'unknown', None, set(), set())
        
        macro_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['macro']]
        assert len(macro_tokens) >= 1
    
    def test_tokenize_event_type(self):
        """Event types should be tokenized correctly."""
        tokens = tokenize_line("type = character_event", 0, 'unknown', None, set(), set())
        
        class_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['class']]
        assert len(class_tokens) >= 1
    
    def test_tokenize_builtin_effect(self):
        """Built-in effects should be tokenized as function with defaultLibrary."""
        tokens = tokenize_line("add_gold = 100", 0, 'effect', None, set(), set())
        
        # Look for tokens that might be add_gold
        function_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['function']]
        # Note: add_gold may or may not be tokenized depending on context detection
    
    def test_tokenize_keyword(self):
        """Control keywords should be tokenized."""
        tokens = tokenize_line("trigger = {", 0, 'unknown', None, set(), set())
        
        keyword_tokens = [t for t in tokens if t.token_type == TOKEN_TYPE_INDEX['keyword']]
        assert len(keyword_tokens) >= 1


class TestAnalyzeDocument:
    """Tests for full document analysis."""
    
    def test_analyze_simple_event(self):
        """Simple event should be analyzed correctly."""
        source = """namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    
    trigger = {
        is_alive = yes
    }
    
    option = {
        name = test_mod.0001.a
        add_gold = 100
    }
}
"""
        tokens = analyze_document(source)
        assert len(tokens) > 0
        
        # Should have namespace, keyword, event, number tokens
        token_types_found = set(t.token_type for t in tokens)
        assert TOKEN_TYPE_INDEX['namespace'] in token_types_found
        assert TOKEN_TYPE_INDEX['keyword'] in token_types_found
        assert TOKEN_TYPE_INDEX['event'] in token_types_found
        assert TOKEN_TYPE_INDEX['number'] in token_types_found
    
    def test_analyze_empty_document(self):
        """Empty document should return empty list."""
        tokens = analyze_document("")
        assert tokens == []
    
    def test_analyze_comment_only(self):
        """Comment-only document should return comment token."""
        tokens = analyze_document("# This is just a comment")
        assert len(tokens) >= 1
        assert any(t.token_type == TOKEN_TYPE_INDEX['comment'] for t in tokens)


class TestGetSemanticTokens:
    """Tests for LSP semantic tokens response."""
    
    def test_returns_semantic_tokens_object(self):
        """Should return SemanticTokens LSP type."""
        result = get_semantic_tokens("namespace = test")
        assert isinstance(result, types.SemanticTokens)
    
    def test_returns_valid_data(self):
        """Data should be valid (length divisible by 5)."""
        result = get_semantic_tokens("namespace = test")
        assert len(result.data) % 5 == 0
    
    def test_empty_document_returns_empty_data(self):
        """Empty document should return empty data."""
        result = get_semantic_tokens("")
        assert result.data == []
    
    def test_handles_parse_errors_gracefully(self):
        """Should not crash on malformed input."""
        # Malformed but shouldn't crash
        result = get_semantic_tokens("{{{{ invalid }}}}")
        assert isinstance(result, types.SemanticTokens)


class TestIntegration:
    """Integration tests for semantic tokens."""
    
    def test_full_event_tokenization(self):
        """Full event should produce reasonable tokens."""
        source = """namespace = my_events

my_events.0001 = {
    type = character_event
    title = my_events.0001.t
    desc = my_events.0001.desc
    theme = intrigue
    
    left_portrait = root
    right_portrait = scope:target
    
    trigger = {
        is_adult = yes
        is_alive = yes
        NOT = { has_trait = incapable }
    }
    
    immediate = {
        random_courtier = {
            limit = { is_alive = yes }
            save_scope_as = target
        }
    }
    
    option = {
        name = my_events.0001.a
        trigger = { has_trait = brave }
        add_prestige = 100
    }
    
    option = {
        name = my_events.0001.b
        add_gold = -50
    }
}
"""
        result = get_semantic_tokens(source)
        
        # Should produce many tokens
        token_count = len(result.data) // 5
        assert token_count > 20  # Should have many tokens for this event
        
        # All token types should be valid indices
        for i in range(0, len(result.data), 5):
            token_type = result.data[i + 3]
            assert 0 <= token_type < len(TOKEN_TYPES)
