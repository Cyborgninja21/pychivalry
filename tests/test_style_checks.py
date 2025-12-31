"""
Tests for style_checks module.

Tests style and formatting validation including:
- Indentation consistency (CK3301, CK3303, CK3305, CK3307)
- Multiple statements on one line (CK3302)
- Whitespace issues (CK3304, CK3306)
- Line length (CK3316)
- Nesting depth (CK3317)
- Empty blocks (CK3314)
- Namespace position (CK3325)
"""

import pytest
from lsprotocol import types

from pychivalry.style_checks import (
    check_style_from_text,
    check_indentation,
    check_multiple_statements,
    check_whitespace,
    check_line_length,
    check_nesting_depth,
    check_empty_blocks,
    check_namespace_position,
    StyleConfig,
)


class TestIndentation:
    """Tests for indentation validation."""
    
    def test_correct_indentation_no_warnings(self):
        """Properly indented code should produce no warnings."""
        text = '''namespace = test
test.0001 = {
\ttype = character_event
\ttrigger = {
\t\tis_adult = yes
\t}
\timmediate = {
\t\tadd_gold = 100
\t}
}'''
        config = StyleConfig()
        diagnostics = check_indentation(text.split('\n'), config)
        # Filter only indentation-related codes
        indent_diags = [d for d in diagnostics if d.code in ("CK3301", "CK3303", "CK3305", "CK3307")]
        assert len(indent_diags) == 0

    def test_wrong_indent_inside_block(self):
        """Content with wrong indent should produce CK3301."""
        text = '''if = {
\tlimit = { exists = mother }
mother = { save_scope_as = x }
}'''
        config = StyleConfig()
        diagnostics = check_indentation(text.split('\n'), config)
        codes = [d.code for d in diagnostics]
        assert "CK3301" in codes

    def test_spaces_instead_of_tabs_warning(self):
        """Spaces used for indentation should produce CK3303."""
        text = '''trigger = {
    is_adult = yes
}'''
        config = StyleConfig(prefer_tabs=True)
        diagnostics = check_indentation(text.split('\n'), config)
        codes = [d.code for d in diagnostics]
        assert "CK3303" in codes

    def test_closing_brace_misalignment(self):
        """Misaligned closing brace should produce CK3307."""
        text = '''trigger = {
\tis_adult = yes
\t}'''
        config = StyleConfig()
        diagnostics = check_indentation(text.split('\n'), config)
        codes = [d.code for d in diagnostics]
        assert "CK3307" in codes

    def test_skip_empty_lines(self):
        """Empty lines should be skipped without errors."""
        text = '''trigger = {

\tis_adult = yes

}'''
        config = StyleConfig()
        diagnostics = check_indentation(text.split('\n'), config)
        # Should have no CK3301 errors for empty lines
        indent_errors = [d for d in diagnostics if d.code == "CK3301"]
        assert len(indent_errors) == 0

    def test_skip_comment_lines(self):
        """Comment-only lines should be skipped."""
        text = '''trigger = {
# This is a comment
\tis_adult = yes
}'''
        config = StyleConfig()
        diagnostics = check_indentation(text.split('\n'), config)
        indent_errors = [d for d in diagnostics if d.code == "CK3301"]
        assert len(indent_errors) == 0


class TestMultipleStatements:
    """Tests for multiple statement detection."""

    def test_multiple_blocks_on_line(self):
        """Multiple block assignments on one line should produce CK3302."""
        text = '''limit = { exists = father }father = { save_scope_as = x }'''
        config = StyleConfig()
        diagnostics = check_multiple_statements([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3302" in codes

    def test_closing_brace_then_new_block(self):
        """Closing brace followed by new block should produce CK3302."""
        text = '''}else_if = {'''
        config = StyleConfig()
        diagnostics = check_multiple_statements([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3302" in codes

    def test_single_line_block_ok(self):
        """Single inline block is acceptable."""
        text = '''limit = { is_adult = yes }'''
        config = StyleConfig()
        diagnostics = check_multiple_statements([text], config)
        assert len(diagnostics) == 0

    def test_assignment_only_ok(self):
        """Simple assignments without blocks are OK."""
        text = '''add_gold = 100'''
        config = StyleConfig()
        diagnostics = check_multiple_statements([text], config)
        assert len(diagnostics) == 0


class TestWhitespace:
    """Tests for whitespace validation."""

    def test_trailing_whitespace_detected(self):
        """Trailing whitespace should produce CK3304."""
        text = '''trigger = {   '''
        config = StyleConfig(trailing_whitespace=True)
        diagnostics = check_whitespace([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3304" in codes

    def test_no_trailing_whitespace_ok(self):
        """Lines without trailing whitespace should pass."""
        text = '''trigger = {'''
        config = StyleConfig(trailing_whitespace=True)
        diagnostics = check_whitespace([text], config)
        trailing_diags = [d for d in diagnostics if d.code == "CK3304"]
        assert len(trailing_diags) == 0

    def test_operator_spacing_missing_before(self):
        """Missing space before = should produce CK3306."""
        text = '''key= value'''
        config = StyleConfig(operator_spacing=True)
        diagnostics = check_whitespace([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3306" in codes

    def test_operator_spacing_missing_after(self):
        """Missing space after = should produce CK3306."""
        text = '''key =value'''
        config = StyleConfig(operator_spacing=True)
        diagnostics = check_whitespace([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3306" in codes

    def test_correct_operator_spacing_ok(self):
        """Correct operator spacing should pass."""
        text = '''key = value'''
        config = StyleConfig(operator_spacing=True)
        diagnostics = check_whitespace([text], config)
        spacing_diags = [d for d in diagnostics if d.code == "CK3306"]
        assert len(spacing_diags) == 0


class TestLineLength:
    """Tests for line length validation."""

    def test_long_line_detected(self):
        """Lines exceeding max length should produce CK3316."""
        text = 'a' * 150  # 150 characters
        config = StyleConfig(max_line_length=120)
        diagnostics = check_line_length([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3316" in codes

    def test_normal_line_ok(self):
        """Lines within limit should pass."""
        text = 'a' * 50  # 50 characters
        config = StyleConfig(max_line_length=120)
        diagnostics = check_line_length([text], config)
        assert len(diagnostics) == 0

    def test_line_length_disabled(self):
        """Disabled line length check should pass any line."""
        text = 'a' * 500
        config = StyleConfig(max_line_length=0)  # Disabled
        diagnostics = check_line_length([text], config)
        assert len(diagnostics) == 0


class TestNestingDepth:
    """Tests for nesting depth validation."""

    def test_deep_nesting_detected(self):
        """Deeply nested blocks should produce CK3317."""
        # Create 7 levels of nesting (exceeds default max of 6)
        text = '''a = {
\tb = {
\t\tc = {
\t\t\td = {
\t\t\t\te = {
\t\t\t\t\tf = {
\t\t\t\t\t\tg = {
\t\t\t\t\t\t\th = yes
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}
\t\t}
\t}
}'''
        config = StyleConfig(max_nesting_depth=6)
        diagnostics = check_nesting_depth(text.split('\n'), config)
        codes = [d.code for d in diagnostics]
        assert "CK3317" in codes

    def test_acceptable_nesting_ok(self):
        """Acceptable nesting depth should pass."""
        text = '''a = {
\tb = {
\t\tc = yes
\t}
}'''
        config = StyleConfig(max_nesting_depth=6)
        diagnostics = check_nesting_depth(text.split('\n'), config)
        assert len(diagnostics) == 0


class TestEmptyBlocks:
    """Tests for empty block detection."""

    def test_empty_block_detected(self):
        """Empty blocks should produce CK3314."""
        text = '''effect = { }'''
        config = StyleConfig(check_empty_blocks=True)
        diagnostics = check_empty_blocks([text], config)
        codes = [d.code for d in diagnostics]
        assert "CK3314" in codes

    def test_empty_trigger_ok(self):
        """Empty trigger blocks are allowed (often intentional)."""
        text = '''trigger = { }'''
        config = StyleConfig(check_empty_blocks=True)
        diagnostics = check_empty_blocks([text], config)
        # Should NOT produce CK3314 for trigger
        assert len(diagnostics) == 0

    def test_empty_limit_ok(self):
        """Empty limit blocks are allowed."""
        text = '''limit = { }'''
        config = StyleConfig(check_empty_blocks=True)
        diagnostics = check_empty_blocks([text], config)
        assert len(diagnostics) == 0

    def test_non_empty_block_ok(self):
        """Non-empty blocks should pass."""
        text = '''effect = { add_gold = 100 }'''
        config = StyleConfig(check_empty_blocks=True)
        diagnostics = check_empty_blocks([text], config)
        assert len(diagnostics) == 0


class TestNamespacePosition:
    """Tests for namespace position validation."""

    def test_namespace_at_top_ok(self):
        """Namespace at top of file should pass."""
        text = '''namespace = test
test.0001 = {
\ttype = character_event
}'''
        config = StyleConfig(check_namespace_position=True)
        diagnostics = check_namespace_position(text.split('\n'), config)
        assert len(diagnostics) == 0

    def test_namespace_after_content_warns(self):
        """Namespace after other content should produce CK3325."""
        text = '''test.0001 = {
\ttype = character_event
}
namespace = test'''
        config = StyleConfig(check_namespace_position=True)
        diagnostics = check_namespace_position(text.split('\n'), config)
        codes = [d.code for d in diagnostics]
        assert "CK3325" in codes

    def test_namespace_after_comments_ok(self):
        """Namespace after only comments should pass."""
        text = '''# Header comment
# Another comment

namespace = test'''
        config = StyleConfig(check_namespace_position=True)
        diagnostics = check_namespace_position(text.split('\n'), config)
        assert len(diagnostics) == 0


class TestIntegration:
    """Integration tests for the full style check pipeline."""

    def test_full_check_on_clean_file(self):
        """A well-formatted file should produce minimal diagnostics."""
        text = '''namespace = test

test.0001 = {
\ttype = character_event
\ttitle = test.0001.t
\tdesc = test.0001.desc
\ttheme = intrigue

\ttrigger = {
\t\tis_adult = yes
\t}

\timmediate = {
\t\tadd_gold = 100
\t}

\toption = {
\t\tname = test.0001.a
\t}
}'''
        diagnostics = check_style_from_text(text)
        # Should have very few or no diagnostics
        # Allow for minor style preferences
        error_diags = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(error_diags) == 0

    def test_full_check_catches_mangled_file(self):
        """The original mangled file should produce diagnostics."""
        text = '''namespace = rq_gender_test

rq_gender_test.0001 = {
\ttype = character_event
\timmediate = {
\t\tif = {
\t\t\tlimit = { exists = mother }
\tmother = { save_scope_as = test_parent }
\t\t}
\t\telse_if = {
\t\t\tlimit = { exists = father }father = { save_scope_as = test_parent }
\t\t}
\t}
}'''
        diagnostics = check_style_from_text(text)
        codes = [d.code for d in diagnostics]
        
        # Should catch indentation issue (CK3301)
        assert "CK3301" in codes or "CK3307" in codes
        
        # Should catch multiple statements (CK3302)
        assert "CK3302" in codes

    def test_config_disables_checks(self):
        """Disabled config options should skip those checks."""
        text = '''key=value'''  # Would trigger CK3306
        
        config = StyleConfig(operator_spacing=False)
        diagnostics = check_whitespace([text], config)
        
        spacing_diags = [d for d in diagnostics if d.code == "CK3306"]
        assert len(spacing_diags) == 0
