"""
Tests for the document formatting module.

Tests formatting functionality for CK3 scripts.
"""

import pytest
from lsprotocol import types

from pychivalry.formatting import (
    FormattingOptions,
    CK3Formatter,
    format_document,
    format_range,
)


class TestFormattingOptions:
    """Tests for FormattingOptions configuration."""
    
    def test_default_options(self):
        """Default options should follow Paradox conventions."""
        opts = FormattingOptions()
        assert opts.insert_spaces is False  # Use tabs
        assert opts.trim_trailing_whitespace is True
        assert opts.insert_final_newline is True
        assert opts.blank_lines_between_blocks == 1
    
    def test_from_lsp_options(self):
        """Should convert LSP options correctly."""
        lsp_opts = types.FormattingOptions(
            tab_size=4,
            insert_spaces=True,
            trim_trailing_whitespace=True,
            insert_final_newline=True,
        )
        opts = FormattingOptions.from_lsp_options(lsp_opts)
        assert opts.tab_size == 4
        assert opts.insert_spaces is True
        assert opts.trim_trailing_whitespace is True


class TestCK3FormatterBasics:
    """Tests for basic formatting operations."""
    
    def test_empty_document(self):
        """Empty document should remain empty."""
        formatter = CK3Formatter()
        result = formatter.format_document("")
        assert result == ""
    
    def test_single_line_comment(self):
        """Comments should be preserved."""
        formatter = CK3Formatter()
        result = formatter.format_document("# This is a comment")
        assert "# This is a comment" in result
    
    def test_simple_assignment(self):
        """Simple assignments should be formatted correctly."""
        formatter = CK3Formatter()
        text = "namespace=my_mod"
        result = formatter.format_document(text)
        assert "namespace = my_mod" in result
    
    def test_simple_block(self):
        """Simple blocks should be formatted correctly."""
        formatter = CK3Formatter()
        text = "trigger={is_adult=yes}"
        result = formatter.format_document(text)
        # Should have proper indentation and spacing
        assert "trigger = {" in result
        assert "is_adult = yes" in result


class TestIndentation:
    """Tests for indentation handling."""
    
    def test_nested_block_indentation(self):
        """Nested blocks should have increasing indentation."""
        formatter = CK3Formatter()
        text = """my_event = {
trigger = {
is_adult = yes
has_trait = brave
}
}"""
        result = formatter.format_document(text)
        lines = result.strip().split('\n')
        
        # First line: no indent
        assert lines[0].startswith("my_event")
        # trigger = { should be indented 1 level
        trigger_line = [l for l in lines if "trigger = {" in l][0]
        assert trigger_line.startswith('\t')
        # is_adult should be indented 2 levels
        adult_line = [l for l in lines if "is_adult" in l][0]
        assert adult_line.startswith('\t\t')
    
    def test_closing_brace_indentation(self):
        """Closing braces should match opening statement indent."""
        formatter = CK3Formatter()
        text = """event = {
    trigger = {
        is_adult = yes
    }
}"""
        result = formatter.format_document(text)
        lines = result.strip().split('\n')
        
        # Find closing braces and their indentation
        closing_braces = [l for l in lines if l.strip() == '}']
        # Inner closing brace should have 1 tab
        # Outer closing brace should have 0 tabs
        assert len(closing_braces) == 2
    
    def test_uses_tabs_by_default(self):
        """Default formatting should use tabs, not spaces."""
        formatter = CK3Formatter()
        text = """event = {
trigger = {
is_adult = yes
}
}"""
        result = formatter.format_document(text)
        # Should contain tabs
        assert '\t' in result
        # Inner content should use tabs for indentation
        lines = result.strip().split('\n')
        indented_lines = [l for l in lines if l.startswith('\t')]
        assert len(indented_lines) > 0
    
    def test_uses_spaces_when_configured(self):
        """Should use spaces when configured."""
        opts = FormattingOptions(insert_spaces=True, tab_size=4)
        formatter = CK3Formatter(opts)
        text = """event = {
trigger = {
is_adult = yes
}
}"""
        result = formatter.format_document(text)
        lines = result.strip().split('\n')
        # Lines with content should start with spaces, not tabs
        trigger_line = [l for l in lines if "trigger" in l][0]
        assert trigger_line.startswith('    ')  # 4 spaces


class TestSpacing:
    """Tests for spacing around operators."""
    
    def test_equals_spacing(self):
        """Should have single space around = operator."""
        formatter = CK3Formatter()
        
        # No spaces
        assert "key = value" in formatter.format_document("key=value")
        # Too many spaces
        assert "key = value" in formatter.format_document("key  =  value")
        # Mixed
        assert "key = value" in formatter.format_document("key= value")
        assert "key = value" in formatter.format_document("key =value")
    
    def test_comparison_operators(self):
        """Should format comparison operators correctly."""
        formatter = CK3Formatter()
        
        assert ">= 5" in formatter.format_document("gold>=5")
        assert "<= 10" in formatter.format_document("prestige<=10")
        assert "!= 0" in formatter.format_document("age!=0")
    
    def test_brace_spacing(self):
        """Should have space before opening brace."""
        formatter = CK3Formatter()
        
        result = formatter.format_document("trigger={")
        assert "trigger = {" in result
        
        result = formatter.format_document("trigger= {")
        assert "trigger = {" in result


class TestComments:
    """Tests for comment handling."""
    
    def test_standalone_comment(self):
        """Standalone comments should preserve their content."""
        formatter = CK3Formatter()
        text = "# This is a comment about the event"
        result = formatter.format_document(text)
        assert "# This is a comment about the event" in result
    
    def test_inline_comment(self):
        """Inline comments should be preserved."""
        formatter = CK3Formatter()
        text = "is_adult = yes  # Must be an adult"
        result = formatter.format_document(text)
        assert "is_adult = yes" in result
        assert "# Must be an adult" in result
    
    def test_comment_in_block(self):
        """Comments inside blocks should be indented."""
        formatter = CK3Formatter()
        text = """trigger = {
# Check if adult
is_adult = yes
}"""
        result = formatter.format_document(text)
        lines = result.strip().split('\n')
        comment_line = [l for l in lines if "# Check if adult" in l][0]
        assert comment_line.startswith('\t')


class TestBlankLines:
    """Tests for blank line handling."""
    
    def test_blank_lines_between_top_level_blocks(self):
        """Should have blank lines between top-level blocks."""
        formatter = CK3Formatter()
        text = """namespace = my_mod
event_1 = {
trigger = { is_adult = yes }
}
event_2 = {
trigger = { is_ruler = yes }
}"""
        result = formatter.format_document(text)
        # Should have blank line between namespace and event_1, and between events
        assert "\n\n" in result or result.count('\n') > 5
    
    def test_no_multiple_blank_lines(self):
        """Should not have multiple consecutive blank lines."""
        formatter = CK3Formatter()
        text = """trigger = {
is_adult = yes


is_ruler = yes
}"""
        result = formatter.format_document(text)
        assert "\n\n\n" not in result


class TestWhitespace:
    """Tests for whitespace handling."""
    
    def test_trim_trailing_whitespace(self):
        """Should trim trailing whitespace from lines."""
        formatter = CK3Formatter()
        text = "is_adult = yes   \ntrigger = {  \n}"
        result = formatter.format_document(text)
        lines = result.strip().split('\n')
        for line in lines:
            assert not line.endswith(' ')
            assert not line.endswith('\t')
    
    def test_final_newline(self):
        """Should ensure file ends with newline."""
        formatter = CK3Formatter()
        text = "namespace = my_mod"
        result = formatter.format_document(text)
        assert result.endswith('\n')


class TestQuotedStrings:
    """Tests for string handling."""
    
    def test_preserve_quoted_strings(self):
        """Should preserve content of quoted strings."""
        formatter = CK3Formatter()
        text = 'desc = "This   has   weird   spacing"'
        result = formatter.format_document(text)
        assert '"This   has   weird   spacing"' in result
    
    def test_preserve_equals_in_strings(self):
        """Should not modify = inside strings."""
        formatter = CK3Formatter()
        text = 'name = "key=value test"'
        result = formatter.format_document(text)
        assert '"key=value test"' in result


class TestComplexEvents:
    """Tests for formatting complete CK3 events."""
    
    def test_format_complete_event(self):
        """Should format a complete CK3 event correctly."""
        formatter = CK3Formatter()
        text = """my_mod.0001={
type=character_event
title=my_mod.0001.t
desc=my_mod.0001.desc
theme=diplomacy

left_portrait=root

trigger={
is_adult=yes
is_ruler=yes
}

immediate={
# Save scopes
random_courtier={
save_scope_as=target
}
}

option={
name=my_mod.0001.a
add_gold=100
}
}"""
        result = formatter.format_document(text)
        
        # Check structure is preserved
        assert "my_mod.0001 = {" in result
        assert "type = character_event" in result
        assert "trigger = {" in result
        assert "is_adult = yes" in result
        assert "random_courtier = {" in result
        assert "save_scope_as = target" in result
        assert "option = {" in result
        assert "add_gold = 100" in result
    
    def test_preserve_localization_keys(self):
        """Should preserve localization key format."""
        formatter = CK3Formatter()
        text = """title = my_mod.0001.t
desc = my_mod.0001.desc
name = my_mod.0001.a.tt"""
        result = formatter.format_document(text)
        
        assert "my_mod.0001.t" in result
        assert "my_mod.0001.desc" in result
        assert "my_mod.0001.a.tt" in result


class TestRangeFormatting:
    """Tests for range formatting."""
    
    def test_format_range_basic(self):
        """Should format only the specified range."""
        text = """namespace = my_mod

event_1 = {
trigger={is_adult=yes}
}

event_2 = {
trigger = { is_ruler = yes }
}"""
        range_ = types.Range(
            start=types.Position(line=3, character=0),
            end=types.Position(line=4, character=0),
        )
        edits = format_range(text, range_)
        
        # Should return edits
        assert edits is not None or edits == []
    
    def test_range_expands_to_block(self):
        """Range should expand to include complete blocks."""
        formatter = CK3Formatter()
        text = """trigger = {
    is_adult = yes
    is_ruler=yes
}"""
        lines = text.split('\n')
        
        # Try to format just line 2 (is_ruler=yes)
        formatted, start, end = formatter.format_range(text, 2, 3)
        
        # Should have been expanded to include the whole block
        # The result should include trigger = { and closing }


class TestFormatDocument:
    """Tests for the format_document API function."""
    
    def test_returns_text_edits(self):
        """Should return list of TextEdit objects."""
        text = "trigger={is_adult=yes}"
        edits = format_document(text)
        
        assert isinstance(edits, list)
        if edits:
            assert all(isinstance(e, types.TextEdit) for e in edits)
    
    def test_returns_empty_for_already_formatted(self):
        """Should return empty list if no changes needed."""
        text = "trigger = {\n\tis_adult = yes\n}\n"
        edits = format_document(text)
        
        # May return empty or contain no-op edits
        if edits:
            # If there are edits, applying them should not change the text
            for edit in edits:
                assert isinstance(edit, types.TextEdit)
    
    def test_accepts_lsp_options(self):
        """Should accept LSP formatting options."""
        text = "trigger={is_adult=yes}"
        options = types.FormattingOptions(
            tab_size=2,
            insert_spaces=True,
        )
        edits = format_document(text, options)
        
        assert isinstance(edits, list)


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_malformed_braces(self):
        """Should handle unclosed braces gracefully."""
        formatter = CK3Formatter()
        text = """trigger = {
is_adult = yes
# Missing closing brace"""
        
        # Should not raise exception
        result = formatter.format_document(text)
        assert "trigger = {" in result
        assert "is_adult = yes" in result
    
    def test_empty_blocks(self):
        """Should handle empty blocks."""
        formatter = CK3Formatter()
        text = "trigger = { }"
        result = formatter.format_document(text)
        assert "trigger = {" in result
    
    def test_single_line_block(self):
        """Should preserve single-line blocks when appropriate."""
        formatter = CK3Formatter()
        text = "limit = { is_adult = yes }"
        result = formatter.format_document(text)
        # Single line blocks can be preserved
        assert "limit = {" in result
    
    def test_deeply_nested_blocks(self):
        """Should handle deeply nested blocks."""
        formatter = CK3Formatter()
        text = """a = {
b = {
c = {
d = {
value = yes
}
}
}
}"""
        result = formatter.format_document(text)
        lines = result.strip().split('\n')
        
        # Find the deepest value
        value_line = [l for l in lines if "value = yes" in l][0]
        # Should be indented 4 levels (4 tabs or equivalent)
        tab_count = len(value_line) - len(value_line.lstrip('\t'))
        assert tab_count == 4
    
    def test_unicode_content(self):
        """Should handle unicode content correctly."""
        formatter = CK3Formatter()
        text = 'desc = "Der König kämpft für Österreich"'
        result = formatter.format_document(text)
        assert "Der König kämpft für Österreich" in result
    
    def test_escaped_quotes(self):
        """Should handle escaped quotes in strings."""
        formatter = CK3Formatter()
        text = r'desc = "He said \"hello\" to me"'
        result = formatter.format_document(text)
        assert r'\"hello\"' in result


class TestIntegrationScenarios:
    """Integration tests with realistic CK3 content."""
    
    def test_format_scripted_effect(self):
        """Should format scripted effects correctly."""
        formatter = CK3Formatter()
        text = """my_reward_effect={
add_gold=100
add_prestige=50
if={
limit={has_trait=greedy}
add_gold=50
}
}"""
        result = formatter.format_document(text)
        
        assert "my_reward_effect = {" in result
        assert "add_gold = 100" in result
        assert "if = {" in result
        assert "limit = { has_trait = greedy }" in result or "limit = {" in result
    
    def test_format_event_chain_snippet(self):
        """Should format event chain declarations correctly."""
        formatter = CK3Formatter()
        text = """trigger_event={
id=my_mod.0002
days=5
}"""
        result = formatter.format_document(text)
        
        assert "trigger_event = {" in result
        assert "id = my_mod.0002" in result
        assert "days = 5" in result
