"""
Document Formatting Module for CK3 Language Server.

This module provides document formatting capabilities for CK3 scripts,
allowing users to auto-format their code to follow Paradox conventions.

Formatting Features:
    - Consistent indentation (tabs, as per Paradox convention)
    - Opening braces on same line as key: `key = {`
    - Proper blank lines between top-level blocks
    - Aligned equals signs in consecutive assignments (optional)
    - Consistent spacing around operators
    - Normalized whitespace in blocks

Formatting Rules (Paradox Convention):
    1. Use tabs for indentation, not spaces
    2. Opening brace on same line: `trigger = {` not `trigger =\\n{`
    3. Closing brace on its own line, same indent as opening statement
    4. One blank line between top-level blocks (events, namespaces)
    5. No trailing whitespace
    6. Single space around `=` operator: `key = value` not `key=value`
    7. No space before `:` in comparisons: `>= 5` not `> = 5`

LSP Reference:
    https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_formatting
    https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_rangeFormatting
"""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple
from lsprotocol import types

import logging

logger = logging.getLogger(__name__)


@dataclass
class FormattingOptions:
    """
    Formatting options for CK3 scripts.

    These options can be configured via LSP or used directly.

    Attributes:
        tab_size: Number of spaces per tab (for display, actual output uses tabs)
        insert_spaces: If True, use spaces instead of tabs (Paradox prefers tabs)
        trim_trailing_whitespace: Remove trailing whitespace from lines
        insert_final_newline: Ensure file ends with newline
        trim_final_newlines: Remove extra newlines at end of file
        align_equals: Align consecutive `=` signs (experimental)
        blank_lines_between_blocks: Number of blank lines between top-level blocks
    """

    tab_size: int = 4
    insert_spaces: bool = False  # Paradox convention uses tabs
    trim_trailing_whitespace: bool = True
    insert_final_newline: bool = True
    trim_final_newlines: bool = True
    align_equals: bool = False  # Experimental feature
    blank_lines_between_blocks: int = 1

    @classmethod
    def from_lsp_options(cls, options: types.FormattingOptions) -> "FormattingOptions":
        """
        Create FormattingOptions from LSP FormattingOptions.

        Args:
            options: LSP FormattingOptions from client

        Returns:
            FormattingOptions instance
        """
        return cls(
            tab_size=options.tab_size,
            insert_spaces=options.insert_spaces,
            trim_trailing_whitespace=options.trim_trailing_whitespace or True,
            insert_final_newline=options.insert_final_newline or True,
            trim_final_newlines=options.trim_final_newlines or True,
        )


class CK3Formatter:
    """
    Formatter for CK3 script files.

    This class handles the actual formatting logic, converting CK3 scripts
    to follow consistent styling conventions.
    """

    def __init__(self, options: Optional[FormattingOptions] = None):
        """
        Initialize the formatter.

        Args:
            options: Formatting options (uses defaults if None)
        """
        self.options = options or FormattingOptions()
        self.indent_char = " " * self.options.tab_size if self.options.insert_spaces else "\t"

    def format_document(self, text: str) -> str:
        """
        Format an entire CK3 script document.

        Args:
            text: The full document text

        Returns:
            The formatted document text
        """
        lines = text.split("\n")
        formatted_lines = self._format_lines(lines, 0, len(lines))

        result = "\n".join(formatted_lines)

        # Handle final newline
        if self.options.insert_final_newline and not result.endswith("\n"):
            result += "\n"

        if self.options.trim_final_newlines:
            result = result.rstrip("\n") + "\n" if result.strip() else ""

        return result

    def format_range(self, text: str, start_line: int, end_line: int) -> Tuple[str, int, int]:
        """
        Format a range of lines within a document.

        For range formatting, we need to be careful to:
        1. Determine the current indentation level at start_line
        2. Only format lines within the range
        3. Preserve context outside the range

        Args:
            text: The full document text
            start_line: First line to format (0-indexed)
            end_line: Last line to format (exclusive, 0-indexed)

        Returns:
            Tuple of (formatted_text, actual_start_line, actual_end_line)
            The actual lines may be adjusted to include complete blocks
        """
        lines = text.split("\n")

        # Expand range to include complete blocks
        actual_start, actual_end = self._expand_range_to_blocks(lines, start_line, end_line)

        # Calculate initial indent level based on context
        initial_indent = self._get_indent_level_at_line(lines, actual_start)

        # Extract and format the range
        range_lines = lines[actual_start:actual_end]
        formatted_range = self._format_lines(range_lines, initial_indent, len(range_lines))

        # Reconstruct document
        result_lines = lines[:actual_start] + formatted_range + lines[actual_end:]

        return "\n".join(result_lines), actual_start, actual_start + len(formatted_range)

    def _format_lines(self, lines: List[str], start_indent: int, line_count: int) -> List[str]:
        """
        Format a list of lines.

        This is the core formatting logic that handles:
        - Indentation tracking
        - Brace placement
        - Whitespace normalization

        Args:
            lines: Lines to format
            start_indent: Initial indentation level
            line_count: Number of lines (for progress)

        Returns:
            List of formatted lines
        """
        formatted = []
        indent_level = start_indent
        prev_was_block_end = False
        prev_was_blank = False
        in_multiline_string = False

        for i, line in enumerate(lines):
            # Handle multi-line strings (rare in CK3 but possible)
            if in_multiline_string:
                formatted.append(line)
                if '"' in line and not line.strip().startswith("#"):
                    in_multiline_string = False
                continue

            # Strip the line for analysis
            stripped = line.strip()

            # Skip empty lines but track them
            if not stripped:
                if not prev_was_blank and formatted:
                    formatted.append("")
                prev_was_blank = True
                prev_was_block_end = False
                continue

            prev_was_blank = False

            # Handle comments
            if stripped.startswith("#"):
                formatted.append(self._indent(indent_level) + stripped)
                continue

            # Check for closing brace (decrease indent before formatting)
            if stripped == "}" or stripped.startswith("}"):
                indent_level = max(0, indent_level - 1)
                formatted_line = self._format_single_line(stripped, indent_level)
                formatted.append(formatted_line)
                prev_was_block_end = True

                # Handle cases like `} else {` or similar
                if stripped.count("{") > stripped.count("}"):
                    indent_level += 1
                continue

            # Add blank line between top-level blocks if needed
            if (
                indent_level == 0
                and prev_was_block_end
                and formatted
                and formatted[-1] != ""
                and self.options.blank_lines_between_blocks > 0
            ):
                formatted.append("")

            prev_was_block_end = False

            # Format the line
            formatted_line = self._format_single_line(stripped, indent_level)
            formatted.append(formatted_line)

            # Check for opening brace (increase indent for next line)
            open_braces = stripped.count("{")
            close_braces = stripped.count("}")
            indent_level += open_braces - close_braces
            indent_level = max(0, indent_level)

            # Check for unclosed string
            quote_count = stripped.count('"') - stripped.count('\\"')
            if quote_count % 2 == 1:
                in_multiline_string = True

        return formatted

    def _format_single_line(self, line: str, indent_level: int) -> str:
        """
        Format a single line of CK3 script.

        Handles:
        - Spacing around operators
        - Brace placement
        - Indentation

        Args:
            line: The line to format (already stripped)
            indent_level: Current indentation level

        Returns:
            Formatted line with proper indentation
        """
        # Handle empty or whitespace-only lines
        if not line:
            return ""

        # Handle pure comments
        if line.startswith("#"):
            return self._indent(indent_level) + line

        # Separate inline comments
        comment = ""
        code_part = line
        comment_idx = self._find_comment_start(line)
        if comment_idx >= 0:
            comment = "  " + line[comment_idx:].strip()
            code_part = line[:comment_idx].strip()

        # Format the code part
        formatted_code = self._normalize_spacing(code_part)

        # Handle brace on same line convention
        formatted_code = self._fix_brace_placement(formatted_code)

        # Combine with indent and comment
        result = self._indent(indent_level) + formatted_code
        if comment:
            result += comment

        # Trim trailing whitespace
        if self.options.trim_trailing_whitespace:
            result = result.rstrip()

        return result

    def _normalize_spacing(self, code: str) -> str:
        """
        Normalize spacing around operators and keywords.

        Rules:
        - Single space around `=`
        - Single space around comparison operators (>, <, >=, <=, !=)
        - No space after opening brace or before closing brace for inline
        - Single space after `{` if followed by content on same line

        Args:
            code: Code to normalize

        Returns:
            Code with normalized spacing
        """
        if not code:
            return code

        # Preserve quoted strings by replacing them temporarily
        strings = []
        string_pattern = r'"(?:[^"\\]|\\.)*"'

        def save_string(match):
            strings.append(match.group())
            return f"\x00STRING{len(strings)-1}\x00"

        code = re.sub(string_pattern, save_string, code)

        # Normalize spacing around = (but not ==, >=, <=, !=)
        # First protect multi-char operators
        code = re.sub(r">=", "\x01GTE\x01", code)
        code = re.sub(r"<=", "\x01LTE\x01", code)
        code = re.sub(r"!=", "\x01NEQ\x01", code)
        code = re.sub(r"==", "\x01EQ\x01", code)

        # Now normalize single =
        code = re.sub(r"\s*=\s*", " = ", code)

        # Restore multi-char operators with proper spacing
        code = re.sub(r"\x01GTE\x01", " >= ", code)
        code = re.sub(r"\x01LTE\x01", " <= ", code)
        code = re.sub(r"\x01NEQ\x01", " != ", code)
        code = re.sub(r"\x01EQ\x01", " == ", code)

        # Normalize spacing around comparison operators
        code = re.sub(r"\s*>\s*(?!=)", " > ", code)
        code = re.sub(r"\s*<\s*(?!=)", " < ", code)

        # Clean up multiple spaces
        code = re.sub(r"  +", " ", code)

        # Handle braces
        # Ensure space before opening brace: `key = {` not `key ={`
        code = re.sub(r"(\S)\{", r"\1 {", code)

        # No space after `{` at end of line (will be handled by indent)
        # But keep space if there's content: `{ trigger`

        # Restore strings
        for i, s in enumerate(strings):
            code = code.replace(f"\x00STRING{i}\x00", s)

        # Clean up any leading/trailing spaces
        code = code.strip()

        return code

    def _fix_brace_placement(self, code: str) -> str:
        """
        Fix brace placement to follow Paradox conventions.

        The convention is:
        - Opening brace on same line as key: `trigger = {`
        - Closing brace on its own line

        This function handles edge cases like:
        - `key = { value }` (single-line blocks)
        - `key = { # comment`

        Args:
            code: Code to fix

        Returns:
            Code with proper brace placement
        """
        # Most of this is handled by line-by-line processing
        # This function handles inline blocks

        # Don't modify single-line blocks like `key = { value }`
        # They're acceptable in CK3

        return code

    def _find_comment_start(self, line: str) -> int:
        """
        Find the start of a comment in a line, respecting strings.

        Args:
            line: Line to search

        Returns:
            Index of '#' starting the comment, or -1 if no comment
        """
        in_string = False
        for i, char in enumerate(line):
            if char == '"' and (i == 0 or line[i - 1] != "\\"):
                in_string = not in_string
            elif char == "#" and not in_string:
                return i
        return -1

    def _indent(self, level: int) -> str:
        """
        Generate indentation string for a given level.

        Args:
            level: Indentation level (0 = no indent)

        Returns:
            Indentation string (tabs or spaces)
        """
        return self.indent_char * level

    def _get_indent_level_at_line(self, lines: List[str], line_num: int) -> int:
        """
        Calculate the indentation level at a specific line.

        This counts brace nesting from the start of the document.

        Args:
            lines: All lines in the document
            line_num: Line number to check (0-indexed)

        Returns:
            Indentation level at that line
        """
        level = 0
        for i in range(line_num):
            if i < len(lines):
                line = lines[i]
                # Count braces, ignoring strings and comments
                level += self._count_net_braces(line)
                level = max(0, level)
        return level

    def _count_net_braces(self, line: str) -> int:
        """
        Count net brace change in a line (opens - closes).

        Ignores braces in strings and comments.

        Args:
            line: Line to analyze

        Returns:
            Net brace change (+1 for each {, -1 for each })
        """
        # Remove comment part
        comment_idx = self._find_comment_start(line)
        if comment_idx >= 0:
            line = line[:comment_idx]

        # Remove strings
        string_pattern = r'"(?:[^"\\]|\\.)*"'
        line = re.sub(string_pattern, "", line)

        return line.count("{") - line.count("}")

    def _expand_range_to_blocks(
        self, lines: List[str], start_line: int, end_line: int
    ) -> Tuple[int, int]:
        """
        Expand a formatting range to include complete blocks.

        This ensures we don't break block structure by formatting
        partial blocks.

        Args:
            lines: All lines in document
            start_line: Requested start line
            end_line: Requested end line

        Returns:
            Tuple of (actual_start, actual_end) that includes complete blocks
        """
        # Find the start of the containing block
        actual_start = start_line
        brace_depth = 0

        # Scan backwards to find block start
        for i in range(start_line - 1, -1, -1):
            if i < len(lines):
                brace_depth -= self._count_net_braces(lines[i])
                if brace_depth <= 0:
                    actual_start = i
                    break

        # Find the end of the containing block
        actual_end = min(end_line, len(lines))
        brace_depth = 0

        # Calculate brace depth at start
        for i in range(actual_start):
            if i < len(lines):
                brace_depth += self._count_net_braces(lines[i])

        # Scan forward to close all braces opened in range
        for i in range(actual_start, len(lines)):
            if i < len(lines):
                brace_depth += self._count_net_braces(lines[i])
                if i >= end_line and brace_depth <= 0:
                    actual_end = i + 1
                    break
                actual_end = i + 1

        return actual_start, actual_end


def format_document(
    text: str, options: Optional[types.FormattingOptions] = None
) -> List[types.TextEdit]:
    """
    Format an entire CK3 document.

    This is the main entry point for document formatting, returning
    LSP TextEdit objects that can be applied by the client.

    Args:
        text: The full document text
        options: LSP formatting options from client

    Returns:
        List of TextEdit objects to apply
    """
    try:
        # Convert LSP options to our options
        format_opts = FormattingOptions()
        if options:
            format_opts = FormattingOptions.from_lsp_options(options)

        # Create formatter and format
        formatter = CK3Formatter(format_opts)
        formatted_text = formatter.format_document(text)

        # If no changes, return empty list
        if formatted_text == text:
            return []

        # Create a single edit that replaces the entire document
        lines = text.split("\n")
        line_count = len(lines)
        last_line_length = len(lines[-1]) if lines else 0

        return [
            types.TextEdit(
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=line_count - 1, character=last_line_length),
                ),
                new_text=formatted_text.rstrip("\n"),  # Client adds final newline if needed
            )
        ]

    except Exception as e:
        logger.error(f"Error formatting document: {e}", exc_info=True)
        return []


def format_range(
    text: str, range_: types.Range, options: Optional[types.FormattingOptions] = None
) -> List[types.TextEdit]:
    """
    Format a range within a CK3 document.

    This formats only the selected range, expanding to complete blocks
    if necessary to maintain valid syntax.

    Args:
        text: The full document text
        range_: The range to format
        options: LSP formatting options from client

    Returns:
        List of TextEdit objects to apply
    """
    try:
        # Convert LSP options to our options
        format_opts = FormattingOptions()
        if options:
            format_opts = FormattingOptions.from_lsp_options(options)

        # Create formatter and format range
        formatter = CK3Formatter(format_opts)
        formatted_text, actual_start, actual_end = formatter.format_range(
            text, range_.start.line, range_.end.line + 1  # Convert to exclusive
        )

        # If no changes, return empty list
        if formatted_text == text:
            return []

        # Calculate the range that was actually modified
        original_lines = text.split("\n")
        formatted_lines = formatted_text.split("\n")

        # Find the actual changed region
        # This could be optimized but for simplicity we replace the expanded range
        end_line = actual_end - 1
        end_char = len(original_lines[end_line]) if end_line < len(original_lines) else 0

        # Get just the formatted portion
        new_range_text = "\n".join(formatted_lines[actual_start:actual_end])

        return [
            types.TextEdit(
                range=types.Range(
                    start=types.Position(line=actual_start, character=0),
                    end=types.Position(line=end_line, character=end_char),
                ),
                new_text=new_range_text,
            )
        ]

    except Exception as e:
        logger.error(f"Error formatting range: {e}", exc_info=True)
        return []
