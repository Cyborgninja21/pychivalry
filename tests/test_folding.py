"""
Tests for Folding Range functionality.

Tests the TEXT_DOCUMENT_FOLDING_RANGE feature which allows users
to collapse and expand blocks of code in CK3 script files.
"""

import pytest
from lsprotocol import types

from pychivalry.folding import (
    get_folding_ranges,
    get_folding_ranges_from_ast,
    count_folding_ranges_by_kind,
    get_folding_range_at_line,
    get_all_folding_ranges_containing_line,
    _get_brace_folding_ranges,
    _get_comment_folding_ranges,
    _get_region_folding_ranges,
    _get_block_name,
    _get_folding_kind,
)
from pychivalry.parser import parse_document


# =============================================================================
# Test: Basic Brace Folding
# =============================================================================


class TestBraceFolding:
    """Tests for brace-based code folding."""

    def test_simple_block(self):
        """Should fold a simple block."""
        text = """my_event = {
    content = here
}"""
        ranges = _get_brace_folding_ranges(text)

        assert len(ranges) == 1
        assert ranges[0].start_line == 0
        assert ranges[0].end_line == 2

    def test_nested_blocks(self):
        """Should fold nested blocks."""
        text = """outer = {
    inner = {
        deep = yes
    }
}"""
        ranges = _get_brace_folding_ranges(text)

        assert len(ranges) == 2
        # Should have both outer (0-4) and inner (1-3) blocks
        start_lines = {r.start_line for r in ranges}
        assert 0 in start_lines
        assert 1 in start_lines

    def test_multiple_sibling_blocks(self):
        """Should fold multiple sibling blocks."""
        text = """block_a = {
    content_a = yes
}

block_b = {
    content_b = yes
}"""
        ranges = _get_brace_folding_ranges(text)

        assert len(ranges) == 2

    def test_single_line_block_not_folded(self):
        """Single-line blocks should not create folding ranges."""
        text = "simple = { value = 1 }"

        ranges = _get_brace_folding_ranges(text)

        assert len(ranges) == 0

    def test_event_block(self):
        """Should fold event definitions."""
        text = """namespace = my_mod

my_mod.0001 = {
    type = character_event
    title = my_mod.0001.t
    desc = my_mod.0001.desc
    
    trigger = {
        is_adult = yes
    }
    
    option = {
        name = my_mod.0001.a
    }
}"""
        ranges = _get_brace_folding_ranges(text)

        # Should have: event block, trigger block, option block
        assert len(ranges) >= 3

    def test_braces_in_strings_ignored(self):
        """Braces inside strings should not affect folding."""
        text = """my_block = {
    text = "This has { braces } inside"
    more = yes
}"""
        ranges = _get_brace_folding_ranges(text)

        # Should only fold the outer block
        assert len(ranges) == 1
        assert ranges[0].start_line == 0
        assert ranges[0].end_line == 3

    def test_braces_in_comments_ignored(self):
        """Braces in comments should not affect folding."""
        text = """my_block = {
    # This comment has { braces }
    value = yes
}"""
        ranges = _get_brace_folding_ranges(text)

        assert len(ranges) == 1
        assert ranges[0].start_line == 0
        assert ranges[0].end_line == 3


# =============================================================================
# Test: Block Name Detection
# =============================================================================


class TestBlockNameDetection:
    """Tests for extracting block names."""

    def test_simple_name(self):
        """Should extract simple block name."""
        assert _get_block_name("trigger = {", 10) == "trigger"

    def test_name_with_equals(self):
        """Should handle space around equals."""
        assert _get_block_name("effect={", 7) == "effect"
        assert _get_block_name("effect = {", 9) == "effect"

    def test_event_id(self):
        """Should extract event ID with dots."""
        assert _get_block_name("my_mod.0001 = {", 14) == "my_mod.0001"

    def test_no_name(self):
        """Should return None for anonymous blocks."""
        assert _get_block_name("    {", 4) is None
        assert _get_block_name("{", 0) is None

    def test_underscore_names(self):
        """Should handle underscored names."""
        assert _get_block_name("my_custom_trigger = {", 20) == "my_custom_trigger"


# =============================================================================
# Test: Folding Kind Assignment
# =============================================================================


class TestFoldingKind:
    """Tests for folding kind assignment."""

    def test_trigger_is_region(self):
        """Important blocks should be region kind."""
        assert _get_folding_kind("trigger") == types.FoldingRangeKind.Region
        assert _get_folding_kind("effect") == types.FoldingRangeKind.Region
        assert _get_folding_kind("option") == types.FoldingRangeKind.Region

    def test_namespace_is_imports(self):
        """Namespace should be imports kind."""
        assert _get_folding_kind("namespace") == types.FoldingRangeKind.Imports

    def test_iterator_is_region(self):
        """Iterator blocks should be region kind."""
        assert _get_folding_kind("every_vassal") == types.FoldingRangeKind.Region
        assert _get_folding_kind("random_child") == types.FoldingRangeKind.Region
        assert _get_folding_kind("any_ally") == types.FoldingRangeKind.Region

    def test_regular_block_is_none(self):
        """Regular blocks should have no special kind."""
        assert _get_folding_kind("custom_block") is None
        assert _get_folding_kind("my_mod.0001") is None

    def test_none_input(self):
        """None input should return None."""
        assert _get_folding_kind(None) is None


# =============================================================================
# Test: Comment Folding
# =============================================================================


class TestCommentFolding:
    """Tests for comment block folding."""

    def test_comment_block(self):
        """Should fold consecutive comment lines."""
        text = """# This is a comment block
# with multiple lines
# that should be foldable
code = yes"""
        ranges = _get_comment_folding_ranges(text)

        assert len(ranges) == 1
        assert ranges[0].start_line == 0
        assert ranges[0].end_line == 2
        assert ranges[0].kind == types.FoldingRangeKind.Comment

    def test_single_comment_not_folded(self):
        """Single comment line should not create folding range."""
        text = """# Just one comment
code = yes"""
        ranges = _get_comment_folding_ranges(text)

        assert len(ranges) == 0

    def test_two_comments_minimum(self):
        """Two consecutive comments should be foldable."""
        text = """# Comment one
# Comment two
code = yes"""
        ranges = _get_comment_folding_ranges(text)

        assert len(ranges) == 1

    def test_multiple_comment_blocks(self):
        """Should fold multiple separate comment blocks."""
        text = """# Block one
# continued

code = yes

# Block two
# continued here"""
        ranges = _get_comment_folding_ranges(text)

        assert len(ranges) == 2

    def test_comment_at_end_of_file(self):
        """Should fold comment block at end of file."""
        text = """code = yes
# Final comment
# block here"""
        ranges = _get_comment_folding_ranges(text)

        assert len(ranges) == 1
        assert ranges[0].start_line == 1
        assert ranges[0].end_line == 2

    def test_region_markers_excluded(self):
        """Region markers should not be treated as regular comments."""
        text = """# region My Region
# This is inside
# endregion"""
        ranges = _get_comment_folding_ranges(text)

        # Only the middle comment should potentially fold, but it's single
        # so no comment folding ranges expected
        assert len(ranges) == 0


# =============================================================================
# Test: Region Folding
# =============================================================================


class TestRegionFolding:
    """Tests for explicit region marker folding."""

    def test_basic_region(self):
        """Should fold region markers."""
        text = """# region Event Handlers
my_event = {
    content = yes
}
# endregion"""
        ranges = _get_region_folding_ranges(text)

        assert len(ranges) == 1
        assert ranges[0].start_line == 0
        assert ranges[0].end_line == 4
        assert ranges[0].kind == types.FoldingRangeKind.Region

    def test_nested_regions(self):
        """Should support nested regions."""
        text = """# region Outer
# region Inner
code = yes
# endregion
more = yes
# endregion"""
        ranges = _get_region_folding_ranges(text)

        assert len(ranges) == 2

    def test_region_case_insensitive(self):
        """Region markers should be case-insensitive."""
        text = """# REGION Test
content = yes
# ENDREGION"""
        ranges = _get_region_folding_ranges(text)

        assert len(ranges) == 1

    def test_region_with_leading_whitespace(self):
        """Should handle whitespace before region marker."""
        text = """    # region Indented
    code = yes
    # endregion"""
        ranges = _get_region_folding_ranges(text)

        assert len(ranges) == 1

    def test_unclosed_region(self):
        """Unclosed regions should not create folding range."""
        text = """# region Unclosed
code = yes
# more code"""
        ranges = _get_region_folding_ranges(text)

        assert len(ranges) == 0


# =============================================================================
# Test: Complete Folding
# =============================================================================


class TestGetFoldingRanges:
    """Tests for the main get_folding_ranges function."""

    def test_combined_folding(self):
        """Should combine all folding types."""
        text = """# Header comment
# for this file

namespace = my_mod

# region Events

my_mod.0001 = {
    trigger = {
        is_adult = yes
    }
}

# endregion"""
        ranges = get_folding_ranges(text)

        # Should have: comment block, region, event block, trigger block
        assert len(ranges) >= 4

    def test_empty_document(self):
        """Empty document should return no ranges."""
        ranges = get_folding_ranges("")

        assert ranges == []

    def test_no_foldable_content(self):
        """Document with no foldable content."""
        text = "simple = yes"

        ranges = get_folding_ranges(text)

        assert len(ranges) == 0

    def test_sorted_by_start_line(self):
        """Ranges should be sorted by start line."""
        text = """block_a = {
    content = yes
}

block_b = {
    content = yes
}

block_c = {
    content = yes
}"""
        ranges = get_folding_ranges(text)

        start_lines = [r.start_line for r in ranges]
        assert start_lines == sorted(start_lines)

    def test_no_duplicates(self):
        """Should not return duplicate ranges."""
        text = """block = {
    nested = {
        deep = yes
    }
}"""
        ranges = get_folding_ranges(text)

        # Check for unique (start, end) pairs
        pairs = [(r.start_line, r.end_line) for r in ranges]
        assert len(pairs) == len(set(pairs))


# =============================================================================
# Test: Real CK3 Event Files
# =============================================================================


class TestRealEventFolding:
    """Tests with realistic CK3 event structures."""

    def test_full_event(self):
        """Should fold a complete event properly."""
        text = """\
namespace = rq

# =============================================================================
# Event: The Proposition
# =============================================================================

rq.0001 = {
    type = character_event
    title = rq.0001.t
    desc = rq.0001.desc
    theme = seduction
    
    left_portrait = root
    right_portrait = scope:target
    
    trigger = {
        is_adult = yes
        is_attracted_to_gender_of = scope:target
    }
    
    immediate = {
        random_courtier = {
            limit = { is_adult = yes }
            save_scope_as = target
        }
    }
    
    option = {
        name = rq.0001.a
        trigger = { has_trait = lustful }
        add_stress = -10
    }
    
    option = {
        name = rq.0001.b
        add_stress = 5
    }
}"""
        ranges = get_folding_ranges(text)

        # Should fold: comment block (3 lines), event block, trigger, immediate,
        # random_courtier, both options. Single-line blocks (limit, trigger in option)
        # are NOT folded since they don't span multiple lines.
        assert len(ranges) >= 5  # At least event + trigger + immediate + random_courtier + options

        # Verify we have an event-sized block
        start_lines = [r.start_line for r in ranges]
        end_lines = [r.end_line for r in ranges]

        # The event block should be the largest one
        largest_range = max(ranges, key=lambda r: r.end_line - r.start_line)
        assert largest_range.end_line - largest_range.start_line >= 25  # Event spans ~30 lines

    def test_scripted_effect_file(self):
        """Should fold scripted effects properly."""
        text = """# Reward effects for quest completion

grant_reward_effect = {
    add_gold = 100
    add_prestige = 50
    
    if = {
        limit = { has_trait = greedy }
        add_gold = 50
    }
}

punish_failure_effect = {
    add_stress = 20
    remove_short_term_gold = 25
}"""
        ranges = get_folding_ranges(text)

        # Should fold: grant_reward_effect, if block, punish_failure_effect
        # Single-line limit block is NOT folded
        # Comment is only 1 line so not folded
        assert len(ranges) >= 3

    def test_scripted_trigger_file(self):
        """Should fold scripted triggers properly."""
        text = """can_start_quest_trigger = {
    is_adult = yes
    is_alive = yes
    NOT = { has_character_flag = quest_cooldown }
    
    OR = {
        has_trait = ambitious
        has_trait = diligent
    }
}"""
        ranges = get_folding_ranges(text)

        # Should fold: main trigger, OR block
        # NOT = { ... } is single-line so NOT folded
        assert len(ranges) >= 2


# =============================================================================
# Test: Helper Functions
# =============================================================================


class TestHelperFunctions:
    """Tests for helper utility functions."""

    def test_count_by_kind(self):
        """Should count ranges by kind correctly."""
        text = """# Comment block
# continues

# region Test Region
my_block = {
    trigger = {
        is_adult = yes
    }
}
# endregion"""
        ranges = get_folding_ranges(text)
        counts = count_folding_ranges_by_kind(ranges)

        assert counts["comment"] >= 1
        assert counts["region"] >= 1
        assert counts["block"] >= 0

    def test_get_range_at_line(self):
        """Should find folding range starting at specific line."""
        text = """block_a = {
    content = yes
}

block_b = {
    content = yes
}"""
        ranges = get_folding_ranges(text)

        range_at_0 = get_folding_range_at_line(ranges, 0)
        assert range_at_0 is not None
        assert range_at_0.start_line == 0

        range_at_4 = get_folding_range_at_line(ranges, 4)
        assert range_at_4 is not None
        assert range_at_4.start_line == 4

        range_at_3 = get_folding_range_at_line(ranges, 3)
        assert range_at_3 is None  # Line 3 is empty

    def test_get_ranges_containing_line(self):
        """Should find all ranges containing a line."""
        text = """outer = {
    inner = {
        deep = yes
    }
}"""
        ranges = get_folding_ranges(text)

        containing = get_all_folding_ranges_containing_line(ranges, 2)

        # Line 2 is inside both outer and inner blocks
        assert len(containing) == 2

        # Should be sorted by size (smallest first)
        assert (
            containing[0].end_line - containing[0].start_line
            < containing[1].end_line - containing[1].start_line
        )


# =============================================================================
# Test: Edge Cases
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_mismatched_braces(self):
        """Should handle mismatched braces gracefully."""
        text = """block = {
    content = yes
# Missing closing brace"""

        # Should not crash
        ranges = get_folding_ranges(text)
        # May or may not have ranges, but shouldn't crash
        assert isinstance(ranges, list)

    def test_extra_closing_brace(self):
        """Should handle extra closing braces gracefully."""
        text = """block = {
    content = yes
}
}"""  # Extra closing brace

        ranges = get_folding_ranges(text)
        assert isinstance(ranges, list)

    def test_empty_block(self):
        """Should handle empty blocks."""
        text = """empty = {
}"""
        ranges = get_folding_ranges(text)

        assert len(ranges) == 1

    def test_very_deeply_nested(self):
        """Should handle very deep nesting."""
        text = """l1 = {
    l2 = {
        l3 = {
            l4 = {
                l5 = {
                    deep = yes
                }
            }
        }
    }
}"""
        ranges = get_folding_ranges(text)

        assert len(ranges) == 5  # One range per level

    def test_unicode_content(self):
        """Should handle Unicode content."""
        text = """# Événements français
événement = {
    desc = "Héroïque"
}"""
        ranges = get_folding_ranges(text)

        assert len(ranges) >= 1

    def test_tabs_and_spaces_mixed(self):
        """Should handle mixed indentation."""
        text = """block = {
\tinner_tab = {
        inner_space = yes
\t}
}"""
        ranges = get_folding_ranges(text)

        assert len(ranges) == 2

    def test_windows_line_endings(self):
        """Should handle CRLF line endings."""
        text = "block = {\r\n    content = yes\r\n}"

        ranges = get_folding_ranges(text)

        assert len(ranges) == 1

    def test_inline_block_followed_by_multiline(self):
        """Should handle inline then multiline blocks."""
        text = """inline = { value = 1 }
multiline = {
    value = 2
}"""
        ranges = get_folding_ranges(text)

        # Only multiline should be folded
        assert len(ranges) == 1
        assert ranges[0].start_line == 1


# =============================================================================
# Test: AST-Based Folding
# =============================================================================


class TestASTFolding:
    """Tests for AST-based folding (when parser succeeds)."""

    def test_ast_folding_simple(self):
        """Should create folding from AST."""
        text = """my_event = {
    trigger = {
        is_adult = yes
    }
}"""
        root = parse_document(text)

        ranges = get_folding_ranges_from_ast(root, text)

        assert len(ranges) >= 2  # Event and trigger blocks

    def test_ast_includes_comments(self):
        """AST folding should still include comment blocks."""
        text = """# Comment block
# continues here

my_event = {
    content = yes
}"""
        root = parse_document(text)

        ranges = get_folding_ranges_from_ast(root, text)

        # Should have both AST ranges and comment ranges
        kinds = [r.kind for r in ranges]
        assert types.FoldingRangeKind.Comment in kinds


# =============================================================================
# Test: Performance
# =============================================================================


class TestPerformance:
    """Basic performance tests."""

    def test_large_file(self):
        """Should handle large files efficiently."""
        # Generate a large file with many events
        events = []
        for i in range(100):
            events.append(
                f"""event_{i} = {{
    trigger = {{
        is_adult = yes
    }}
    option = {{
        name = event_{i}.a
    }}
}}"""
            )

        text = "\n\n".join(events)

        import time

        start = time.time()
        ranges = get_folding_ranges(text)
        elapsed = time.time() - start

        # Should complete in reasonable time (< 1 second)
        assert elapsed < 1.0

        # Should find all event blocks and their children
        assert len(ranges) >= 300  # 100 events * 3 blocks each
