"""
Folding Range support for CK3 Language Server.

This module provides code folding capabilities for CK3 script files,
allowing users to collapse and expand blocks of code.

Folding is supported for:
- Event blocks: `my_event.0001 = { ... }`
- Named blocks: `trigger = { ... }`, `effect = { ... }`, `option = { ... }`
- Nested blocks: Any `{ ... }` block
- Comment blocks: Multiple consecutive comment lines
- Region markers: `# region` / `# endregion` custom folding
"""

import re
from typing import List, Optional, Tuple
from lsprotocol import types

from .parser import CK3Node, parse_document


# =============================================================================
# Folding Range Types
# =============================================================================

# Block types that should have special folding treatment
IMPORTANT_BLOCKS = {
    # Event structure
    "trigger",
    "immediate",
    "option",
    "after",
    "desc",
    # Common blocks
    "effect",
    "modifier",
    "limit",
    "if",
    "else",
    "else_if",
    # Iterators
    "every_",
    "random_",
    "any_",
    "ordered_",
    # Lists
    "OR",
    "AND",
    "NOT",
    "NOR",
    "NAND",
    # Scripted content
    "scripted_trigger",
    "scripted_effect",
}


# =============================================================================
# Core Folding Functions
# =============================================================================


def get_folding_ranges(
    text: str,
    line_folding_only: bool = True,
) -> List[types.FoldingRange]:
    """
    Get all folding ranges in a document.

    Args:
        text: Document text
        line_folding_only: If True, only return line-based folding (most editors)

    Returns:
        List of FoldingRange objects
    """
    ranges: List[types.FoldingRange] = []

    # Get block-based folding from braces
    ranges.extend(_get_brace_folding_ranges(text))

    # Get comment block folding
    ranges.extend(_get_comment_folding_ranges(text))

    # Get region-based folding
    ranges.extend(_get_region_folding_ranges(text))

    # Sort by start line, then by end line (larger ranges first for same start)
    ranges.sort(key=lambda r: (r.start_line, -r.end_line))

    # Remove duplicates (same start and end)
    seen = set()
    unique_ranges = []
    for r in ranges:
        key = (r.start_line, r.end_line)
        if key not in seen:
            seen.add(key)
            unique_ranges.append(r)

    return unique_ranges


def _get_brace_folding_ranges(text: str) -> List[types.FoldingRange]:
    """
    Get folding ranges based on brace matching.

    Handles CK3's `key = { ... }` block syntax.
    """
    ranges: List[types.FoldingRange] = []
    lines = text.split("\n")

    # Stack of (line_number, character, block_name)
    brace_stack: List[Tuple[int, int, Optional[str]]] = []

    # Track if we're in a string or comment
    in_string = False

    for line_num, line in enumerate(lines):
        i = 0
        while i < len(line):
            char = line[i]

            # Handle comments - skip rest of line
            if char == "#" and not in_string:
                break

            # Handle strings
            if char == '"':
                in_string = not in_string
                i += 1
                continue

            if in_string:
                i += 1
                continue

            # Opening brace
            if char == "{":
                # Try to find block name before the brace
                block_name = _get_block_name(line, i)
                brace_stack.append((line_num, i, block_name))
                i += 1
                continue

            # Closing brace
            if char == "}":
                if brace_stack:
                    start_line, start_char, block_name = brace_stack.pop()

                    # Only create folding range if it spans multiple lines
                    if line_num > start_line:
                        # Determine folding kind based on block name
                        kind = _get_folding_kind(block_name)

                        ranges.append(
                            types.FoldingRange(
                                start_line=start_line,
                                start_character=start_char,
                                end_line=line_num,
                                end_character=i,
                                kind=kind,
                            )
                        )
                i += 1
                continue

            i += 1

    return ranges


def _get_block_name(line: str, brace_pos: int) -> Optional[str]:
    """
    Extract the block name before an opening brace.

    Examples:
        "trigger = {" -> "trigger"
        "my_event.0001 = {" -> "my_event.0001"
        "{" -> None
    """
    # Get the part of line before the brace
    before_brace = line[:brace_pos].rstrip()

    # Remove trailing '='
    if before_brace.endswith("="):
        before_brace = before_brace[:-1].rstrip()

    # Extract the identifier (word characters, dots, underscores)
    match = re.search(r"([a-zA-Z_][a-zA-Z0-9_.]*)$", before_brace)
    if match:
        return match.group(1)

    return None


def _get_folding_kind(block_name: Optional[str]) -> Optional[str]:
    """
    Determine the FoldingRangeKind for a block.

    Returns:
        'comment' for comment blocks
        'imports' for namespace blocks
        'region' for important structural blocks
        None for regular blocks
    """
    if not block_name:
        return None

    # Namespace declarations
    if block_name == "namespace":
        return types.FoldingRangeKind.Imports

    # Check if it's an important block type
    if block_name in IMPORTANT_BLOCKS:
        return types.FoldingRangeKind.Region

    # Check for iterator prefixes
    for prefix in ("every_", "random_", "any_", "ordered_"):
        if block_name.startswith(prefix):
            return types.FoldingRangeKind.Region

    return None


def _get_comment_folding_ranges(text: str) -> List[types.FoldingRange]:
    """
    Get folding ranges for consecutive comment blocks.

    Groups of 2+ consecutive comment lines can be folded.
    """
    ranges: List[types.FoldingRange] = []
    lines = text.split("\n")

    comment_start: Optional[int] = None

    for line_num, line in enumerate(lines):
        stripped = line.strip()
        is_comment = (
            stripped.startswith("#")
            and not stripped.startswith("# region")
            and not stripped.startswith("# endregion")
        )

        if is_comment:
            if comment_start is None:
                comment_start = line_num
        else:
            # End of comment block
            if comment_start is not None and line_num - comment_start >= 2:
                ranges.append(
                    types.FoldingRange(
                        start_line=comment_start,
                        end_line=line_num - 1,
                        kind=types.FoldingRangeKind.Comment,
                    )
                )
            comment_start = None

    # Handle comment block at end of file
    if comment_start is not None and len(lines) - comment_start >= 2:
        ranges.append(
            types.FoldingRange(
                start_line=comment_start,
                end_line=len(lines) - 1,
                kind=types.FoldingRangeKind.Comment,
            )
        )

    return ranges


def _get_region_folding_ranges(text: str) -> List[types.FoldingRange]:
    """
    Get folding ranges for explicit region markers.

    Supports:
        # region Name
        ...
        # endregion
    """
    ranges: List[types.FoldingRange] = []
    lines = text.split("\n")

    # Stack of (line_number, region_name)
    region_stack: List[Tuple[int, str]] = []

    region_pattern = re.compile(r"^\s*#\s*region\b\s*(.*)", re.IGNORECASE)
    endregion_pattern = re.compile(r"^\s*#\s*endregion\b", re.IGNORECASE)

    for line_num, line in enumerate(lines):
        # Check for region start
        region_match = region_pattern.match(line)
        if region_match:
            region_name = region_match.group(1).strip() or "region"
            region_stack.append((line_num, region_name))
            continue

        # Check for region end
        if endregion_pattern.match(line):
            if region_stack:
                start_line, region_name = region_stack.pop()
                ranges.append(
                    types.FoldingRange(
                        start_line=start_line,
                        end_line=line_num,
                        kind=types.FoldingRangeKind.Region,
                    )
                )

    return ranges


# =============================================================================
# AST-Based Folding (Alternative approach)
# =============================================================================


def get_folding_ranges_from_ast(
    root: List[CK3Node],
    text: str,
) -> List[types.FoldingRange]:
    """
    Get folding ranges from parsed AST.

    This provides more accurate folding based on the actual syntax tree,
    but requires successful parsing.

    Args:
        root: Parsed AST root nodes (list from parse_document)
        text: Original document text (for position conversion)

    Returns:
        List of FoldingRange objects
    """
    ranges: List[types.FoldingRange] = []

    def visit_node(node: CK3Node):
        """Recursively visit nodes and create folding ranges."""
        if not node.children:
            return

        # Create folding range for this node if it spans multiple lines
        # CK3Node uses 'range' attribute which is lsprotocol.types.Range
        if node.range:
            start_line = node.range.start.line
            end_line = node.range.end.line

            if end_line > start_line:
                kind = _get_folding_kind(node.key)
                ranges.append(
                    types.FoldingRange(
                        start_line=start_line,
                        start_character=node.range.start.character,
                        end_line=end_line,
                        end_character=node.range.end.character,
                        kind=kind,
                    )
                )

        # Visit children
        for child in node.children:
            visit_node(child)

    # Handle root as a list of nodes
    for node in root:
        visit_node(node)

    # Add comment and region folding (not in AST)
    ranges.extend(_get_comment_folding_ranges(text))
    ranges.extend(_get_region_folding_ranges(text))

    # Sort and deduplicate
    ranges.sort(key=lambda r: (r.start_line, -r.end_line))
    seen = set()
    unique_ranges = []
    for r in ranges:
        key = (r.start_line, r.end_line)
        if key not in seen:
            seen.add(key)
            unique_ranges.append(r)

    return unique_ranges


# =============================================================================
# Helper Functions
# =============================================================================


def count_folding_ranges_by_kind(
    ranges: List[types.FoldingRange],
) -> dict:
    """
    Count folding ranges by kind for debugging/statistics.

    Returns:
        Dict mapping kind to count
    """
    counts = {
        "comment": 0,
        "imports": 0,
        "region": 0,
        "block": 0,
    }

    for r in ranges:
        if r.kind == types.FoldingRangeKind.Comment:
            counts["comment"] += 1
        elif r.kind == types.FoldingRangeKind.Imports:
            counts["imports"] += 1
        elif r.kind == types.FoldingRangeKind.Region:
            counts["region"] += 1
        else:
            counts["block"] += 1

    return counts


def get_folding_range_at_line(
    ranges: List[types.FoldingRange],
    line: int,
) -> Optional[types.FoldingRange]:
    """
    Get the smallest folding range that starts at a specific line.

    Useful for "Fold at cursor" functionality.

    Args:
        ranges: List of folding ranges
        line: Line number to check

    Returns:
        The folding range starting at that line, or None
    """
    matching = [r for r in ranges if r.start_line == line]
    if not matching:
        return None

    # Return the smallest range (most specific)
    return min(matching, key=lambda r: r.end_line - r.start_line)


def get_all_folding_ranges_containing_line(
    ranges: List[types.FoldingRange],
    line: int,
) -> List[types.FoldingRange]:
    """
    Get all folding ranges that contain a specific line.

    Args:
        ranges: List of folding ranges
        line: Line number to check

    Returns:
        List of ranges containing the line, sorted by size (smallest first)
    """
    containing = [r for r in ranges if r.start_line <= line <= r.end_line]
    return sorted(containing, key=lambda r: r.end_line - r.start_line)
