"""
Style and Formatting Validation for CK3 Scripts.

This module provides non-semantic validation focused on code style:
- Indentation consistency (CK3301, CK3303, CK3305, CK3307)
- Statement structure (CK3302)
- Whitespace rules (CK3304, CK3306)
- Brace alignment (CK3307)
- Brace mismatch detection (CK3330, CK3331, CK3332)
- Scope reference validation (CK3340, CK3341)
- Merged identifier detection (CK3345)

All diagnostics from this module use codes CK33xx.

Diagnostic Codes:
    CK3301: Inconsistent indentation within block
    CK3302: Multiple block assignments on one line
    CK3303: Indentation uses spaces instead of tabs
    CK3304: Trailing whitespace detected
    CK3305: Block content not indented relative to parent
    CK3306: Inconsistent spacing around operators
    CK3307: Closing brace indentation doesn't match opening
    CK3308: Missing blank line between top-level blocks
    CK3314: Empty block detected
    CK3316: Line exceeds recommended length
    CK3317: Deeply nested blocks
    CK3325: Namespace declaration not at top of file
    CK3330: Unclosed brace (missing '}')
    CK3331: Extra closing brace (no matching '{')
    CK3332: Brace mismatch in block
    CK3340: Unknown/suspicious scope reference (possible typo)
    CK3341: Scope reference appears truncated
    CK3345: Identifier contains merged text (missing newline)
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from lsprotocol import types
from pygls.workspace import TextDocument

logger = logging.getLogger(__name__)


@dataclass
class StyleConfig:
    """Configuration for style checks."""
    indentation: bool = True
    prefer_tabs: bool = True
    multiple_statements: bool = True
    trailing_whitespace: bool = True
    operator_spacing: bool = True
    brace_alignment: bool = True
    max_line_length: int = 120
    max_nesting_depth: int = 6
    check_empty_blocks: bool = True
    check_namespace_position: bool = True


def create_style_diagnostic(
    message: str,
    line: int,
    start_char: int,
    end_char: int,
    severity: types.DiagnosticSeverity = types.DiagnosticSeverity.Warning,
    code: str = "CK3300"
) -> types.Diagnostic:
    """Create a style diagnostic."""
    return types.Diagnostic(
        message=message,
        severity=severity,
        range=types.Range(
            start=types.Position(line=line, character=start_char),
            end=types.Position(line=line, character=end_char),
        ),
        code=code,
        source="ck3-ls-style",
    )


def _remove_strings_and_comments(line: str) -> str:
    """Remove string literals and comments from a line for analysis."""
    result = []
    in_string = False
    i = 0
    while i < len(line):
        char = line[i]
        
        # Handle string boundaries
        if char == '"' and (i == 0 or line[i-1] != '\\'):
            in_string = not in_string
            result.append(char)
            i += 1
            continue
        
        # Handle comments (only outside strings)
        if char == '#' and not in_string:
            break  # Rest of line is comment
        
        if in_string:
            result.append(' ')  # Replace string content with space
        else:
            result.append(char)
        i += 1
    
    return ''.join(result)


def _count_indent_level(line: str) -> Tuple[int, int, bool]:
    """
    Count the indentation level of a line.
    
    Returns:
        Tuple of (tab_count, space_count, has_mixed)
    """
    tabs = 0
    spaces = 0
    
    for char in line:
        if char == '\t':
            tabs += 1
        elif char == ' ':
            spaces += 1
        else:
            break
    
    has_mixed = tabs > 0 and spaces > 0
    return tabs, spaces, has_mixed


def check_indentation(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for indentation issues.
    
    Detects:
    - CK3301: Inconsistent indentation within block
    - CK3303: Spaces instead of tabs
    - CK3305: Block content not indented relative to parent
    - CK3307: Closing brace doesn't match opening
    """
    diagnostics = []
    
    if not config.indentation:
        return diagnostics
    
    # Track brace stack: (line_num, indent_tabs, key_name)
    brace_stack: List[Tuple[int, int, str]] = []
    expected_indent = 0
    
    for line_num, line in enumerate(lines):
        stripped = line.lstrip()
        
        # Skip empty lines and comment-only lines
        if not stripped or stripped.startswith('#'):
            continue
        
        # Get actual indentation
        tabs, spaces, has_mixed = _count_indent_level(line)
        actual_indent = tabs  # We count tabs as indent level
        
        # CK3303: Check for spaces used as indentation
        if config.prefer_tabs and spaces > 0 and tabs == 0 and len(line) > len(stripped):
            diagnostics.append(create_style_diagnostic(
                message="Indentation uses spaces instead of tabs (Paradox convention prefers tabs)",
                line=line_num,
                start_char=0,
                end_char=spaces,
                severity=types.DiagnosticSeverity.Information,
                code="CK3303"
            ))
        
        # Check for mixed tabs/spaces
        if has_mixed:
            diagnostics.append(create_style_diagnostic(
                message="Mixed tabs and spaces in indentation",
                line=line_num,
                start_char=0,
                end_char=tabs + spaces,
                severity=types.DiagnosticSeverity.Warning,
                code="CK3303"
            ))
        
        # Handle closing brace - check alignment before updating expected
        if stripped.startswith('}'):
            if brace_stack:
                open_line, open_indent, key = brace_stack.pop()
                expected_indent = max(0, expected_indent - 1)
                
                # CK3307: Check closing brace alignment
                if actual_indent != open_indent:
                    diagnostics.append(create_style_diagnostic(
                        message=f"Closing brace indent ({actual_indent} tabs) doesn't match opening '{key}' at line {open_line + 1} ({open_indent} tabs)",
                        line=line_num,
                        start_char=0,
                        end_char=len(line.rstrip()),
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3307"
                    ))
            else:
                expected_indent = max(0, expected_indent - 1)
        else:
            # CK3301/CK3305: Check content indentation
            if actual_indent != expected_indent:
                # Only warn if significantly off (allow some flexibility)
                if abs(actual_indent - expected_indent) > 0:
                    diagnostics.append(create_style_diagnostic(
                        message=f"Inconsistent indentation: expected {expected_indent} tabs, found {actual_indent}",
                        line=line_num,
                        start_char=0,
                        end_char=max(tabs + spaces, 1),
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3301"
                    ))
        
        # Track opening braces for next iteration
        clean_line = _remove_strings_and_comments(stripped)
        
        # Count braces (handling inline blocks)
        open_count = clean_line.count('{')
        close_count = clean_line.count('}')
        
        # If line has opening brace(s), track them
        if open_count > 0:
            # Extract key name before the brace
            key_match = re.match(r'(\w+)\s*=\s*\{', stripped)
            key = key_match.group(1) if key_match else "block"
            
            # For each net opening brace, push to stack
            for _ in range(open_count - close_count):
                brace_stack.append((line_num, actual_indent, key))
        
        # Update expected indent for next line
        net_braces = open_count - close_count
        
        # Only update if this line doesn't start with closing brace
        # (we already handled that case above)
        if not stripped.startswith('}'):
            expected_indent += net_braces
            expected_indent = max(0, expected_indent)
    
    return diagnostics


def check_multiple_statements(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for multiple block assignments on one line.
    
    Detects:
    - CK3302: Multiple block assignments on one line
    """
    diagnostics = []
    
    if not config.multiple_statements:
        return diagnostics
    
    for line_num, line in enumerate(lines):
        stripped = line.strip()
        
        # Skip empty lines and comments
        if not stripped or stripped.startswith('#'):
            continue
        
        clean_line = _remove_strings_and_comments(stripped)
        
        # Pattern 1: Closing brace followed by new assignment
        # e.g., "}father = {" or "} else_if = {"
        pattern1 = r'\}\s*\w+\s*=\s*\{'
        
        # Pattern 2: Complete inline block followed by another block assignment
        # e.g., "{ x = y } z = {" - but NOT "{ x = y }" alone
        # Look for: } followed by word = {
        
        matches = list(re.finditer(pattern1, clean_line))
        
        if matches:
            for match in matches:
                # Find position in original line
                start_pos = line.find(match.group())
                if start_pos == -1:
                    start_pos = 0
                
                diagnostics.append(create_style_diagnostic(
                    message="Multiple block assignments on one line - consider splitting for readability",
                    line=line_num,
                    start_char=start_pos,
                    end_char=len(line.rstrip()),
                    severity=types.DiagnosticSeverity.Warning,
                    code="CK3302"
                ))
                break  # One warning per line is enough
    
    return diagnostics


def check_whitespace(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for whitespace issues.
    
    Detects:
    - CK3304: Trailing whitespace
    - CK3306: Inconsistent spacing around operators
    """
    diagnostics = []
    
    for line_num, line in enumerate(lines):
        # CK3304: Trailing whitespace
        if config.trailing_whitespace:
            stripped = line.rstrip()
            if len(stripped) < len(line):
                trailing_count = len(line) - len(stripped)
                diagnostics.append(create_style_diagnostic(
                    message=f"Trailing whitespace ({trailing_count} characters)",
                    line=line_num,
                    start_char=len(stripped),
                    end_char=len(line),
                    severity=types.DiagnosticSeverity.Hint,
                    code="CK3304"
                ))
        
        # CK3306: Operator spacing
        if config.operator_spacing:
            # Skip comment-only lines
            if line.strip().startswith('#'):
                continue
            
            clean_line = _remove_strings_and_comments(line)
            
            # Check for missing space around = (but not ==, >=, <=, !=)
            # Pattern: non-space followed by = followed by non-space-or-=
            # But exclude >=, <=, !=, ==
            
            # Find = that's not part of >=, <=, !=, ==
            for i, char in enumerate(clean_line):
                if char == '=':
                    # Check it's not part of a compound operator
                    prev_char = clean_line[i-1] if i > 0 else ' '
                    next_char = clean_line[i+1] if i < len(clean_line) - 1 else ' '
                    
                    if prev_char in '!><=':
                        continue  # Part of compound operator
                    if next_char == '=':
                        continue  # Part of ==
                    
                    # Check spacing
                    has_space_before = prev_char in ' \t'
                    has_space_after = next_char in ' \t{'
                    
                    if not has_space_before or not has_space_after:
                        # Find actual position in original line
                        actual_pos = i
                        diagnostics.append(create_style_diagnostic(
                            message="Inconsistent spacing around '=' operator. Use: key = value",
                            line=line_num,
                            start_char=max(0, actual_pos - 1),
                            end_char=min(len(line), actual_pos + 2),
                            severity=types.DiagnosticSeverity.Information,
                            code="CK3306"
                        ))
                        break  # One per line
    
    return diagnostics


def check_line_length(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for lines exceeding maximum recommended length.
    
    Detects:
    - CK3316: Line exceeds recommended length
    """
    diagnostics = []
    
    if config.max_line_length <= 0:
        return diagnostics
    
    for line_num, line in enumerate(lines):
        # Use rstrip to not count trailing whitespace
        line_len = len(line.rstrip())
        
        if line_len > config.max_line_length:
            diagnostics.append(create_style_diagnostic(
                message=f"Line exceeds {config.max_line_length} characters ({line_len} chars)",
                line=line_num,
                start_char=config.max_line_length,
                end_char=line_len,
                severity=types.DiagnosticSeverity.Information,
                code="CK3316"
            ))
    
    return diagnostics


def check_nesting_depth(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for deeply nested blocks.
    
    Detects:
    - CK3317: Deeply nested blocks
    """
    diagnostics = []
    
    if config.max_nesting_depth <= 0:
        return diagnostics
    
    current_depth = 0
    max_reported_line = -1  # Avoid reporting multiple times for same deep block
    
    for line_num, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        
        clean_line = _remove_strings_and_comments(stripped)
        
        # Count braces
        for char in clean_line:
            if char == '{':
                current_depth += 1
                if current_depth > config.max_nesting_depth and line_num > max_reported_line:
                    diagnostics.append(create_style_diagnostic(
                        message=f"Deeply nested block (depth {current_depth}, max recommended {config.max_nesting_depth}). Consider refactoring.",
                        line=line_num,
                        start_char=0,
                        end_char=len(line.rstrip()),
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3317"
                    ))
                    max_reported_line = line_num
            elif char == '}':
                current_depth = max(0, current_depth - 1)
    
    return diagnostics


def check_empty_blocks(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for empty blocks.
    
    Detects:
    - CK3314: Empty block detected
    """
    diagnostics = []
    
    if not config.check_empty_blocks:
        return diagnostics
    
    for line_num, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        
        clean_line = _remove_strings_and_comments(stripped)
        
        # Pattern: key = { } with nothing or only whitespace between braces
        empty_block_pattern = r'(\w+)\s*=\s*\{\s*\}'
        matches = re.finditer(empty_block_pattern, clean_line)
        
        for match in matches:
            key = match.group(1)
            # Some empty blocks are OK (like placeholder triggers)
            # But warn about most of them
            if key not in ('trigger', 'limit'):  # These are often intentionally empty
                start_pos = line.find(match.group())
                diagnostics.append(create_style_diagnostic(
                    message=f"Empty block '{key} = {{ }}' - consider removing or adding content",
                    line=line_num,
                    start_char=start_pos if start_pos >= 0 else 0,
                    end_char=len(line.rstrip()),
                    severity=types.DiagnosticSeverity.Hint,
                    code="CK3314"
                ))
    
    return diagnostics


def check_namespace_position(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check that namespace declaration is at the top of the file.
    
    Detects:
    - CK3325: Namespace declaration not at top
    """
    diagnostics = []
    
    if not config.check_namespace_position:
        return diagnostics
    
    found_content = False
    namespace_line = -1
    first_content_line = -1
    
    for line_num, line in enumerate(lines):
        stripped = line.strip()
        
        # Skip empty lines and comments
        if not stripped or stripped.startswith('#'):
            continue
        
        # Check for namespace
        if stripped.startswith('namespace'):
            namespace_line = line_num
            if found_content:
                # Namespace found after other content
                diagnostics.append(create_style_diagnostic(
                    message=f"Namespace declaration should be at the top of the file (found content on line {first_content_line + 1})",
                    line=line_num,
                    start_char=0,
                    end_char=len(line.rstrip()),
                    severity=types.DiagnosticSeverity.Warning,
                    code="CK3325"
                ))
            break
        else:
            if not found_content:
                first_content_line = line_num
            found_content = True
    
    return diagnostics


def check_brace_mismatch(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for mismatched braces within blocks.
    
    Detects:
    - CK3330: Unclosed brace (more '{' than '}')
    - CK3331: Extra closing brace (more '}' than '{')
    - CK3332: Brace mismatch in block
    """
    diagnostics = []
    
    # Track brace positions for better error reporting
    open_braces: List[Tuple[int, int]] = []  # (line, char)
    
    for line_num, line in enumerate(lines):
        # Skip comment-only lines
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        
        clean_line = _remove_strings_and_comments(line)
        
        for char_idx, char in enumerate(clean_line):
            if char == '{':
                open_braces.append((line_num, char_idx))
            elif char == '}':
                if open_braces:
                    open_braces.pop()
                else:
                    # Extra closing brace
                    diagnostics.append(create_style_diagnostic(
                        message="Extra closing brace '}' without matching opening brace",
                        line=line_num,
                        start_char=char_idx,
                        end_char=char_idx + 1,
                        severity=types.DiagnosticSeverity.Error,
                        code="CK3331"
                    ))
    
    # Report unclosed braces
    for brace_line, brace_char in open_braces:
        diagnostics.append(create_style_diagnostic(
            message="Unclosed brace '{' - missing closing '}'",
            line=brace_line,
            start_char=brace_char,
            end_char=brace_char + 1,
            severity=types.DiagnosticSeverity.Error,
            code="CK3330"
        ))
    
    return diagnostics


def check_scope_references(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for potentially invalid scope references.
    
    Detects:
    - CK3340: Unknown/suspicious scope reference (typo detection)
    - CK3341: Scope reference appears truncated
    """
    diagnostics = []
    
    # Common valid scope targets
    known_scope_patterns = {
        'root', 'this', 'prev', 'from', 'actor', 'recipient', 'target',
        'owner', 'holder', 'liege', 'spouse', 'primary_heir', 'player_heir',
        'father', 'mother', 'real_father', 'child', 'friend', 'rival', 'lover',
        'killer', 'culture', 'faith', 'dynasty', 'house', 'capital_province',
        'primary_title', 'location', 'home_court', 'employer', 'activity',
        'secret', 'scheme', 'story', 'inspiration', 'epidemic', 'war',
        # Common custom scopes from event chains
        'character', 'main_character', 'third_party', 'guest', 'host',
    }
    
    # Pattern to find scope: references
    scope_pattern = re.compile(r'\bscope:(\w+)')
    
    for line_num, line in enumerate(lines):
        # Skip comments
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        
        clean_line = _remove_strings_and_comments(line)
        
        for match in scope_pattern.finditer(clean_line):
            scope_name = match.group(1)
            start_pos = match.start(1)
            
            # Check for very short scope names (likely typos/truncations)
            if len(scope_name) <= 2:
                diagnostics.append(create_style_diagnostic(
                    message=f"Suspicious scope reference 'scope:{scope_name}' - name appears truncated",
                    line=line_num,
                    start_char=match.start(),
                    end_char=match.end(),
                    severity=types.DiagnosticSeverity.Warning,
                    code="CK3341"
                ))
            # Check for potential typos in common scopes
            elif scope_name not in known_scope_patterns:
                # Check for near-matches (simple edit distance check)
                close_matches = [
                    known for known in known_scope_patterns
                    if _is_similar(scope_name, known)
                ]
                if close_matches:
                    suggestion = close_matches[0]
                    diagnostics.append(create_style_diagnostic(
                        message=f"Unknown scope 'scope:{scope_name}' - did you mean 'scope:{suggestion}'?",
                        line=line_num,
                        start_char=match.start(),
                        end_char=match.end(),
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3340"
                    ))
    
    return diagnostics


def _is_similar(s1: str, s2: str, threshold: int = 2) -> bool:
    """Check if two strings are similar (within edit distance threshold)."""
    if abs(len(s1) - len(s2)) > threshold:
        return False
    
    # Simple check: same prefix or suffix
    if s1.startswith(s2[:3]) or s2.startswith(s1[:3]):
        return True
    if s1.endswith(s2[-3:]) or s2.endswith(s1[-3:]):
        return True
    
    # Check character overlap
    common = set(s1) & set(s2)
    if len(common) >= min(len(s1), len(s2)) - threshold:
        return True
    
    return False


def check_merged_identifiers(lines: List[str], config: StyleConfig) -> List[types.Diagnostic]:
    """
    Check for identifiers that appear to be accidentally merged.
    
    Detects:
    - CK3345: Identifier appears to contain merged words (missing newline/space)
    """
    diagnostics = []
    
    # Known valid compound identifiers in CK3 (not false positives)
    valid_compound_identifiers = {
        # Portrait positions
        'left_portrait', 'right_portrait', 'lower_left_portrait', 'lower_right_portrait',
        'center_portrait', 'artifact_portrait',
        # Event structure
        'character_event', 'letter_event', 'court_event', 'activity_event',
        'fullscreen_event', 'triggered_desc', 'first_valid', 'random_valid',
        # Triggers
        'has_character_flag', 'has_global_flag', 'has_title_flag', 'has_trait',
        'is_character', 'is_target', 'has_opinion_modifier', 'reverse_opinion',
        # Effects
        'add_character_flag', 'add_gold', 'add_prestige', 'add_piety', 'add_stress',
        'set_character_flag', 'remove_character_flag', 'save_scope_as',
        'trigger_event', 'random_character', 'every_character', 'any_character',
        # Common modifiers
        'opinion_modifier', 'character_modifier', 'county_modifier',
        # Other common
        'event_background', 'override_background', 'window_character',
        'on_action', 'scripted_effect', 'scripted_trigger',
    }
    
    # Known CK3 keywords that might get merged
    ck3_keywords = {
        'animation', 'character', 'trigger', 'effect', 'modifier', 'opinion',
        'scope', 'event', 'option', 'desc', 'title', 'theme', 'portrait',
        'limit', 'weight', 'value', 'target', 'name', 'flag', 'trait',
        'skill', 'gold', 'prestige', 'piety', 'stress', 'health', 'age',
    }
    
    # Pattern for assignments: key = value
    assignment_pattern = re.compile(r'(\w+)\s*=')
    
    for line_num, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        
        clean_line = _remove_strings_and_comments(line)
        
        for match in assignment_pattern.finditer(clean_line):
            identifier = match.group(1)
            
            # Skip known valid compound identifiers
            if identifier.lower() in valid_compound_identifiers:
                continue
            
            # Skip identifiers with underscores (properly separated)
            if '_' in identifier:
                continue
            
            # Check if identifier contains a known keyword NOT at the start
            # This catches things like "cildanimation" or "charactername"
            for keyword in ck3_keywords:
                if keyword in identifier.lower() and not identifier.lower().startswith(keyword):
                    # Found keyword embedded in identifier
                    idx = identifier.lower().find(keyword)
                    if idx > 0:
                        prefix = identifier[:idx]
                        # Only flag if prefix looks like a truncated word (not a valid prefix)
                        if len(prefix) >= 2 and not prefix.lower() in {'un', 're', 'pre', 'sub', 'anti'}:
                            diagnostics.append(create_style_diagnostic(
                                message=f"Identifier '{identifier}' appears to contain merged text - "
                                       f"did you mean '{prefix}' and '{keyword}' on separate lines?",
                                line=line_num,
                                start_char=match.start(1),
                                end_char=match.end(1),
                                severity=types.DiagnosticSeverity.Error,
                                code="CK3345"
                            ))
                            break  # Only report once per identifier
        
        # Also check scope references for merging (these should NOT have keywords embedded)
        scope_pattern = re.compile(r'scope:(\w+)')
        for match in scope_pattern.finditer(clean_line):
            scope_ref = match.group(1)
            
            # Skip properly formatted scope references with underscores
            if '_' in scope_ref:
                continue
            
            for keyword in ck3_keywords:
                if keyword in scope_ref.lower() and not scope_ref.lower() == keyword:
                    idx = scope_ref.lower().find(keyword)
                    if idx > 0:
                        prefix = scope_ref[:idx]
                        if len(prefix) >= 2:
                            diagnostics.append(create_style_diagnostic(
                                message=f"Scope 'scope:{scope_ref}' appears to contain merged text - "
                                       f"possible missing newline before '{keyword}'?",
                                line=line_num,
                                start_char=match.start(),
                                end_char=match.end(),
                                severity=types.DiagnosticSeverity.Error,
                                code="CK3345"
                            ))
                            break
    
    return diagnostics


def check_style(doc: TextDocument, config: Optional[StyleConfig] = None) -> List[types.Diagnostic]:
    """
    Collect all style-related diagnostics for a document.
    
    This is the main entry point for style checking.
    
    Args:
        doc: The text document to check
        config: Style configuration (uses defaults if None)
        
    Returns:
        List of style diagnostics
    """
    config = config or StyleConfig()
    diagnostics = []
    
    try:
        lines = doc.source.split('\n')
        
        # Run all style checks
        diagnostics.extend(check_indentation(lines, config))
        diagnostics.extend(check_multiple_statements(lines, config))
        diagnostics.extend(check_whitespace(lines, config))
        diagnostics.extend(check_line_length(lines, config))
        diagnostics.extend(check_nesting_depth(lines, config))
        diagnostics.extend(check_empty_blocks(lines, config))
        diagnostics.extend(check_namespace_position(lines, config))
        
        # New structural checks
        diagnostics.extend(check_brace_mismatch(lines, config))
        diagnostics.extend(check_scope_references(lines, config))
        diagnostics.extend(check_merged_identifiers(lines, config))
        
        logger.debug(f"Style checks found {len(diagnostics)} issues")
        
    except Exception as e:
        logger.error(f"Error during style check: {e}", exc_info=True)
    
    return diagnostics


def check_style_from_text(text: str, config: Optional[StyleConfig] = None) -> List[types.Diagnostic]:
    """
    Convenience function for testing: check style from raw text.
    
    Args:
        text: CK3 script text
        config: Style configuration (uses defaults if None)
        
    Returns:
        List of style diagnostics
    """
    doc = TextDocument(uri="file:///test.txt", source=text)
    return check_style(doc, config)
