# Formatting & Style Diagnostics Plan

## Overview

This document outlines the plan to add **formatting, style, and Paradox-specific convention diagnostics** to pychivalry. Currently, the language server only validates:
- **Syntax**: Bracket matching
- **Semantics**: Unknown effects/triggers, context violations
- **Scopes**: Invalid scope chains, undefined saved scopes

It does **NOT** catch:
- Incorrect indentation
- Multiple statements on one line
- Inconsistent spacing
- Style violations
- Paradox-specific gotchas (scope timing, context violations, etc.)

This plan addresses these gaps by adding new diagnostic categories:
- **CK33xx**: Style/Formatting Warnings
- **CK34xx-CK35xx**: Paradox-Specific Convention Warnings

---

## Problem Statement

### Example of Undetected Issues

```pdx
# This currently passes all validation:
		if = {
			limit = { exists = mother }
	mother = { save_scope_as = test_parent }    # ❌ Wrong indentation (dedented inside block)
		}
		else_if = {
			limit = { exists = father }father = { save_scope_as = test_parent }  # ❌ Two statements on one line
		}
```

The parser sees valid brackets, valid effect names, and valid scope usage. The game will parse it, but:
1. The code is hard to read
2. The semantics may not match the intent (the second line may execute outside the `if` block)
3. Style inconsistency makes maintenance harder

---

## Diagnostic Code Registry

### CK33xx - Formatting & Style

| Code | Severity | Description |
|------|----------|-------------|
| **CK3301** | Warning | Inconsistent indentation within block |
| **CK3302** | Warning | Multiple block assignments on one line |
| **CK3303** | Information | Indentation uses spaces instead of tabs |
| **CK3304** | Hint | Trailing whitespace detected |
| **CK3305** | Warning | Block content not indented relative to parent |
| **CK3306** | Information | Inconsistent spacing around operators |
| **CK3307** | Warning | Closing brace indentation doesn't match opening |
| **CK3308** | Hint | Missing blank line between top-level blocks |
| **CK3309** | Warning | Event ID doesn't match namespace |
| **CK3310** | Hint | Non-sequential event numbering |
| **CK3311** | Information | Inconsistent naming style (snake_case vs camelCase) |
| **CK3312** | Information | Missing `_trigger` / `_effect` suffix on scripted block |
| **CK3313** | Information | Scope saved with unclear/generic name |
| **CK3314** | Hint | Empty block detected |
| **CK3315** | Hint | Single-item block could be inline |
| **CK3316** | Information | Line exceeds recommended length (120 chars) |
| **CK3317** | Warning | Deeply nested blocks (>5 levels) |
| **CK3318** | Error | `else` without preceding `if`/`else_if` |
| **CK3319** | Hint | Event missing header documentation comment |
| **CK3320** | Information | TODO/FIXME/HACK comment detected |
| **CK3321** | Hint | Commented-out code block detected |
| **CK3323** | Information | Event blocks in non-standard order |
| **CK3324** | Hint | Options not logically ordered |
| **CK3325** | Warning | Namespace declaration not at top of file |
| **CK3327** | Warning | Duplicate trigger conditions in same block |
| **CK3328** | Information | Redundant `trigger = { always = yes }` |
| **CK3329** | Information | Unnecessary nested `AND` (AND is implicit) |
| **CK3330** | Error | Contradictory conditions in same block |
| **CK3331** | Warning | Hardcoded string instead of localization key |
| **CK3332** | Information | Inconsistent localization key naming |
| **CK3333** | Warning | Localization key doesn't match event ID |
| **CK3334** | Warning | Scope saved but never used |
| **CK3335** | Warning | Variable set but never read |
| **CK3336** | Warning | Temporary scope used outside immediate block |
| **CK3337** | Information | Overly generic scope name |
| **CK3339** | Information | Magic number without explanatory comment |
| **CK3340** | Warning | Opinion modifier defined inline (CW262) |
| **CK3341** | Hint | Effect with no visible player feedback |
| **CK3344** | Warning | Unused scripted effect/trigger definition |
| **CK3345** | Information | Potential copy-pasted code block |

### CK35xx - Scope Timing (The Golden Rule)

| Code | Severity | Description |
|------|----------|-------------|
| **CK3550** | Error | Scope used in `trigger` but defined in `immediate` |
| **CK3551** | Error | Scope used in `desc` but defined in `immediate` |
| **CK3552** | Error | Scope used in `triggered_desc` trigger but defined in `immediate` |
| **CK3553** | Error | Variable checked before being set |
| **CK3554** | Warning | Temporary scope used across events |
| **CK3555** | Warning | Scope from calling event not explicitly passed |

### CK36xx - Opinion Modifiers

| Code | Severity | Description |
|------|----------|-------------|
| **CK3656** | Error | Inline opinion value in `add_opinion` (CW262) |
| **CK3657** | Warning | Opinion modifier missing duration (`years`/`decaying`) |
| **CK3658** | Information | `reverse_add_opinion` without clear target comment |
| **CK3659** | Hint | Opinion modifier name doesn't indicate direction |

### CK37xx - Event Structure

| Code | Severity | Description |
|------|----------|-------------|
| **CK3760** | Error | Event missing `type` declaration |
| **CK3761** | Warning | Event missing `title` |
| **CK3762** | Warning | Event missing `desc` |
| **CK3763** | Warning | Event with no `option` blocks |
| **CK3764** | Error | Portrait block missing `character` |
| **CK3765** | Warning | Portrait `animation` not valid for event theme |
| **CK3766** | Information | Event `theme` doesn't match content |
| **CK3767** | Information | `immediate` block after `option` blocks |
| **CK3768** | Error | Multiple `immediate` blocks in event |
| **CK3769** | Warning | `on_trigger_fail` without matching failure conditions |

### CK38xx - Trigger vs Effect Context

| Code | Severity | Description |
|------|----------|-------------|
| **CK3870** | Error | Effect used in `trigger` block |
| **CK3871** | Error | Effect used in `limit` block |
| **CK3872** | Information | `trigger = { always = yes }` is redundant |
| **CK3873** | Warning | `trigger = { always = no }` makes event impossible |
| **CK3874** | Warning | Trigger-only construct in effect block (does nothing) |
| **CK3875** | Warning | Missing `limit` in `random_` iterator |

### CK39xx - List Iterators

| Code | Severity | Description |
|------|----------|-------------|
| **CK3976** | Error | `any_` iterator contains effects (trigger-only) |
| **CK3977** | Information | `every_` without `limit` affects all entries |
| **CK3978** | Warning | `ordered_` without `order_by` |
| **CK3979** | Information | `random_` without `weight` for weighted selection |
| **CK3980** | Hint | Empty list iterator |
| **CK3981** | Error | `count` parameter in non-`any_` iterator |

### CK40xx - Localization Patterns

| Code | Severity | Description |
|------|----------|-------------|
| **CK4082** | Error | `root` referenced directly in localization context |
| **CK4083** | Error | `scope:` prefix used in .yml file |
| **CK4084** | Error | `prev` used in localization |
| **CK4085** | Error | Gender function without character scope |
| **CK4086** | Warning | `Custom()` wrapper missing for relation functions |
| **CK4087** | Error | Unclosed text formatting tag (`#P` without `#!`) |
| **CK4088** | Warning | Invalid icon reference |
| **CK4089** | Warning | Missing localization key for event |

### CK41xx - Scripted Triggers/Effects

| Code | Severity | Description |
|------|----------|-------------|
| **CK4190** | Information | Scripted trigger doesn't end in `_trigger` |
| **CK4191** | Information | Scripted effect doesn't end in `_effect` |
| **CK4192** | Warning | Parameter `$PARAM$` defined but not used |
| **CK4193** | Error | Parameter used but not passed |
| **CK4194** | Error | Scripted trigger calls state-changing effect |
| **CK4195** | Warning | Scripted effect with no observable result |
| **CK4196** | Error | Recursive scripted block without termination |

### CK42xx - Character Interactions

| Code | Severity | Description |
|------|----------|-------------|
| **CK4297** | Error | Interaction `is_valid` contains effects |
| **CK4298** | Information | Interaction `can_send` duplicates `is_shown` |
| **CK4299** | Warning | Interaction `on_accept` missing |
| **CK4200** | Warning | Interaction `ai_accept` always returns fixed value |
| **CK4201** | Warning | Interaction missing `category` |

### CK43xx - Decisions

| Code | Severity | Description |
|------|----------|-------------|
| **CK4302** | Warning | Decision `is_valid` without `is_shown` |
| **CK4303** | Warning | Decision `cost` without corresponding resource check |
| **CK4304** | Information | Major decision without `confirm_text` |
| **CK4305** | Information | Decision `ai_will_do` always 0 or very low |

### CK44xx - On-Actions

| Code | Severity | Description |
|------|----------|-------------|
| **CK4406** | Error | On-action `trigger` contains effects |
| **CK4407** | Warning | On-action with very broad trigger (performance) |
| **CK4408** | Information | Event weight = 0 in on-action (dead entry) |
| **CK4409** | Error | On-action references non-existent event |

### CK45xx - Modifiers

| Code | Severity | Description |
|------|----------|-------------|
| **CK4510** | Warning | Character modifier without duration or permanent flag |
| **CK4511** | Information | Stacking modifier without `stacking = yes` |
| **CK4512** | Error | Modifier with contradictory effects |
| **CK4513** | Warning | Modifier icon reference doesn't exist |

### CK46xx - Flags & Variables

| Code | Severity | Description |
|------|----------|-------------|
| **CK4614** | Warning | Flag set but never checked |
| **CK4615** | Warning | Flag checked but never set |
| **CK4616** | Error | Variable compared but never set |
| **CK4617** | Information | Flag without namespace prefix |
| **CK4618** | Information | Temporary flag used for permanent state |

### CK47xx - Script Values

| Code | Severity | Description |
|------|----------|-------------|
| **CK4719** | Warning | Script value with divide by zero potential |
| **CK4720** | Information | Script value without `min`/`max` bounds |
| **CK4721** | Warning | Script value with `if` but no `else` fallback |
| **CK4722** | Hint | Fixed value disguised as script value |

### CK48xx - Portrait & UI

| Code | Severity | Description |
|------|----------|-------------|
| **CK4823** | Warning | Portrait references scope that may not exist |
| **CK4824** | Error | Portrait `trigger` references unavailable scope |
| **CK4825** | Warning | More than 5 portraits in event (UI overflow) |
| **CK4826** | Warning | `override_background` references non-existent asset |

### CK49xx - Cultural & Faith Context

| Code | Severity | Description |
|------|----------|-------------|
| **CK4927** | Warning | Hardcoded culture/faith reference |
| **CK4928** | Information | Religious content without faith check |
| **CK4929** | Information | Gendered content without `is_male`/`is_female` check |
| **CK4930** | Warning | Age-restricted content without age check |

### CK50xx - Performance Concerns

| Code | Severity | Description |
|------|----------|-------------|
| **CK5031** | Warning | `every_living_character` without tight limit |
| **CK5032** | Warning | `any_*` with `count = all` (expensive) |
| **CK5033** | Warning | Nested `every_` iterators (O(n²)) |
| **CK5034** | Warning | `trigger_event` in tight loop |
| **CK5035** | Warning | On-action fires on common event without filter |

### CK51xx - Common CK3 Gotchas

| Code | Severity | Description |
|------|----------|-------------|
| **CK5136** | Error | `exists = scope:x` used in desc trigger (timing issue) |
| **CK5137** | Warning | `is_alive = yes` without prior `exists` check |
| **CK5138** | Warning | `primary_title` on potentially landless character |
| **CK5139** | Warning | `spouse` on potentially unmarried character |
| **CK5140** | Warning | `random_child` without `any_child` guard |
| **CK5141** | Information | `liege` on potentially independent ruler |
| **CK5142** | Error | Character comparison with `=` instead of `this` |
| **CK5143** | Information | `death = yes` without `death_reason` |
| **CK5144** | Warning | `set_relation_*` without checking existing relation |
| **CK5145** | Warning | `marry` without `can_marry` check |

### CK52xx - Mod Compatibility

| Code | Severity | Description |
|------|----------|-------------|
| **CK5246** | Warning | Overwriting vanilla file without `replace_path` |
| **CK5247** | Warning | Namespace collides with known mod |
| **CK5248** | Warning | Using deprecated effect/trigger |
| **CK5249** | Information | Version-specific syntax without compat layer |
| **CK5250** | Warning | Hardcoded DLC content without DLC check |

---

## Implementation Priority Tiers

### Tier 1 - Critical (Prevent Broken Mods)

These catch errors that will cause the mod to malfunction or crash:

| Code | Issue | Complexity |
|------|-------|------------|
| CK3550-3555 | Scope timing issues | Medium |
| CK3870-3875 | Effect/trigger context violations | Low |
| CK3976-3981 | List iterator misuse | Low |
| CK4082-4087 | Localization scope issues | Medium |
| CK5136-5145 | Common CK3 gotchas | Medium |
| CK3656 | Inline opinion modifier (CW262) | Low |
| CK3760, 3764, 3768 | Event structure errors | Low |
| CK4193, 4194, 4196 | Scripted block errors | Medium |

### Tier 2 - Important (Prevent Bugs)

These catch issues that may cause unexpected behavior:

| Code | Issue | Complexity |
|------|-------|------------|
| CK3301-3307 | Core formatting/indentation | Low |
| CK3334-3336 | Unused scopes/variables | Medium |
| CK3657-3659 | Opinion modifier issues | Low |
| CK3761-3769 | Event structure warnings | Low |
| CK4190-4195 | Scripted block issues | Low |
| CK4614-4618 | Flag/variable hygiene | Medium |
| CK4719-4721 | Script value issues | Medium |

### Tier 3 - Code Quality (Best Practices)

These improve maintainability and readability:

| Code | Issue | Complexity |
|------|-------|------------|
| CK3308-3317 | Additional style checks | Low |
| CK3319-3329 | Documentation & redundancy | Low |
| CK3331-3333 | Localization patterns | Medium |
| CK4297-4305 | Interaction/decision patterns | Medium |
| CK4406-4409 | On-action patterns | Low |
| CK4510-4513 | Modifier issues | Low |

### Tier 4 - Performance & Advanced

These catch potential performance issues or advanced problems:

| Code | Issue | Complexity |
|------|-------|------------|
| CK5031-5035 | Performance concerns | Medium |
| CK4823-4826 | Portrait/UI issues | Low |
| CK4927-4930 | Cultural/faith context | Medium |
| CK5246-5250 | Mod compatibility | High |

---

## Phase 1: Core Indentation Validation

### 1.1 Track Expected Indentation Level

**Goal**: Detect when indentation doesn't match the expected level based on brace nesting.

**Algorithm**:
```python
def check_indentation(lines: List[str]) -> List[Diagnostic]:
    diagnostics = []
    expected_indent = 0
    
    for line_num, line in enumerate(lines):
        stripped = line.lstrip()
        if not stripped or stripped.startswith('#'):
            continue
            
        # Calculate actual indentation
        actual_indent = len(line) - len(stripped)
        actual_tabs = line[:actual_indent].count('\t')
        
        # Check for closing brace (should decrease expected before checking)
        if stripped.startswith('}'):
            expected_indent = max(0, expected_indent - 1)
        
        # Compare expected vs actual
        expected_chars = expected_indent  # 1 tab = 1 indent level
        if actual_tabs != expected_indent:
            diagnostics.append(...)
        
        # Update expected for next line
        open_braces = stripped.count('{') - stripped.count('}')
        expected_indent += open_braces
        expected_indent = max(0, expected_indent)
    
    return diagnostics
```

**Edge Cases**:
- Single-line blocks: `option = { name = x }` (no indent change needed)
- Comment-only lines (preserve any indentation)
- Continuation of multi-line values
- Empty lines (skip validation)

### 1.2 Detect Tabs vs Spaces

**Goal**: Warn when spaces are used instead of tabs (Paradox convention).

```python
def check_indent_style(line: str, line_num: int) -> Optional[Diagnostic]:
    indent = line[:len(line) - len(line.lstrip())]
    if ' ' in indent and '\t' not in indent:
        # Pure spaces used for indentation
        return create_diagnostic(
            message="Indentation uses spaces instead of tabs (Paradox convention prefers tabs)",
            range_=...,
            severity=DiagnosticSeverity.Information,
            code="CK3303"
        )
```

---

## Phase 2: Multi-Statement Detection

### 2.1 Detect Multiple Block Assignments on One Line

**Goal**: Catch patterns like `}father = { save_scope_as = test_parent }`

**Pattern to detect**:
```
} followed by identifier = {
key = { ... } followed by another key = { ... }
```

**Algorithm**:
```python
def check_multiple_statements(line: str, line_num: int) -> List[Diagnostic]:
    diagnostics = []
    
    # Remove strings and comments first
    clean_line = remove_strings_and_comments(line)
    
    # Pattern: closing brace followed by assignment
    # e.g., "}father = {" or "} else_if = {"
    pattern1 = r'\}\s*\w+\s*=\s*\{'
    
    # Pattern: complete block followed by another assignment
    # e.g., "{ x = y } z = {"
    pattern2 = r'\}\s+\w+\s*=\s*\{'
    
    if re.search(pattern1, clean_line) or re.search(pattern2, clean_line):
        diagnostics.append(create_diagnostic(
            message="Multiple block assignments on one line - consider splitting for readability",
            range_=...,
            severity=DiagnosticSeverity.Warning,
            code="CK3302"
        ))
    
    return diagnostics
```

**Exceptions**:
- Single-value assignments are OK: `key = value key2 = value2` (though unusual)
- Inline blocks that are logically grouped (rare, but valid)

---

## Phase 3: Structural Style Checks

### 3.1 Closing Brace Alignment

**Goal**: Ensure closing `}` is at the same indent level as the line with the opening `{`.

```python
def check_brace_alignment(lines: List[str]) -> List[Diagnostic]:
    diagnostics = []
    brace_stack = []  # (line_num, indent_level, key_name)
    
    for line_num, line in enumerate(lines):
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        
        # Track opening braces
        if '{' in stripped:
            # Find the key that opened this block
            key_match = re.match(r'(\w+)\s*=\s*\{', stripped)
            key = key_match.group(1) if key_match else "block"
            brace_stack.append((line_num, indent, key))
        
        # Check closing braces
        if stripped.startswith('}'):
            if brace_stack:
                open_line, open_indent, key = brace_stack.pop()
                if indent != open_indent:
                    diagnostics.append(create_diagnostic(
                        message=f"Closing brace indent ({indent}) doesn't match opening brace at line {open_line + 1} ({open_indent})",
                        range_=...,
                        severity=DiagnosticSeverity.Warning,
                        code="CK3307"
                    ))
    
    return diagnostics
```

### 3.2 Block Content Indentation

**Goal**: Ensure content inside a block is indented relative to the block opener.

```python
def check_block_content_indent(lines: List[str]) -> List[Diagnostic]:
    # Content inside { } should be indented more than the line with {
    # Exception: single-line blocks like { key = value }
    ...
```

---

## Phase 4: Spacing & Whitespace

### 4.1 Operator Spacing

**Goal**: Detect inconsistent spacing around `=` and comparison operators.

**Good**: `key = value`, `gold >= 100`
**Bad**: `key=value`, `key =value`, `gold>=100`

```python
def check_operator_spacing(line: str, line_num: int) -> List[Diagnostic]:
    diagnostics = []
    
    # Check for missing space around =
    # Pattern: non-space followed by = followed by non-space (outside strings)
    if re.search(r'[^\s]=|=[^\s]', clean_line):
        diagnostics.append(...)
    
    return diagnostics
```

### 4.2 Trailing Whitespace

**Goal**: Detect and hint about trailing whitespace.

```python
def check_trailing_whitespace(line: str, line_num: int) -> Optional[Diagnostic]:
    if line.rstrip() != line:
        return create_diagnostic(
            message="Trailing whitespace",
            range_=types.Range(
                start=types.Position(line=line_num, character=len(line.rstrip())),
                end=types.Position(line=line_num, character=len(line))
            ),
            severity=DiagnosticSeverity.Hint,
            code="CK3304"
        )
```

---

## Phase 5: Top-Level Structure

### 5.1 Blank Lines Between Blocks

**Goal**: Suggest blank lines between top-level blocks (events, namespaces) for readability.

```python
def check_block_separation(lines: List[str]) -> List[Diagnostic]:
    # Find top-level block endings and check for blank line before next block
    ...
```

---

## Implementation Plan

### File Changes

1. **`diagnostics.py`**: Add new `check_style()` function
2. **`server.py`**: Add configuration option to enable/disable style checks
3. **New file `style_checks.py`**: Keep style-specific logic separate for maintainability

### New Module: `style_checks.py`

```python
"""
Style and formatting validation for CK3 scripts.

This module provides non-semantic validation focused on code style:
- Indentation consistency
- Statement structure
- Whitespace rules
- Brace alignment

All diagnostics from this module use codes CK33xx.
"""

from typing import List, Optional
from lsprotocol import types
from pygls.workspace import TextDocument

def check_style(doc: TextDocument) -> List[types.Diagnostic]:
    """
    Collect all style-related diagnostics for a document.
    """
    diagnostics = []
    lines = doc.source.split('\n')
    
    diagnostics.extend(check_indentation(lines))
    diagnostics.extend(check_multiple_statements(lines))
    diagnostics.extend(check_brace_alignment(lines))
    diagnostics.extend(check_spacing(lines))
    diagnostics.extend(check_whitespace(lines))
    
    return diagnostics
```

### Configuration

Add user-configurable options:

```python
# In server.py or config
STYLE_CHECK_CONFIG = {
    "enabled": True,                    # Master toggle for style checks
    "indentation": {
        "enabled": True,
        "prefer_tabs": True,            # Warn on spaces
        "check_consistency": True,       # Warn on mixed
    },
    "multiple_statements": {
        "enabled": True,
        "severity": "warning",
    },
    "whitespace": {
        "trailing": True,               # Hint on trailing whitespace
        "operator_spacing": True,       # Info on inconsistent spacing
    },
    "structure": {
        "brace_alignment": True,
        "blank_lines_between_blocks": True,
    }
}
```

### Integration with Existing Diagnostics

```python
# In diagnostics.py - modify collect_all_diagnostics()

def collect_all_diagnostics(
    doc: TextDocument,
    ast: List[CK3Node],
    index: Optional[DocumentIndex] = None,
    style_enabled: bool = True  # New parameter
) -> List[types.Diagnostic]:
    diagnostics = []
    
    # Existing checks
    diagnostics.extend(check_syntax(doc, ast))
    diagnostics.extend(check_semantics(ast, index))
    diagnostics.extend(check_scopes(ast, index))
    
    # NEW: Style checks
    if style_enabled:
        from .style_checks import check_style
        diagnostics.extend(check_style(doc))
    
    return diagnostics
```

---

## Test Plan

### Test File: `tests/test_style_checks.py`

```python
"""Tests for style and formatting diagnostics."""

import pytest
from pychivalry.style_checks import check_style, check_indentation

class TestIndentation:
    def test_correct_indentation_no_warnings(self):
        """Properly indented code should produce no warnings."""
        text = '''namespace = test
test.0001 = {
	trigger = {
		is_adult = yes
	}
}'''
        diagnostics = check_indentation(text.split('\n'))
        assert len(diagnostics) == 0
    
    def test_wrong_indent_inside_block(self):
        """Content with wrong indent should warn."""
        text = '''if = {
	limit = { exists = mother }
mother = { save_scope_as = x }
}'''
        diagnostics = check_indentation(text.split('\n'))
        assert len(diagnostics) >= 1
        assert "CK3301" in [d.code for d in diagnostics]


class TestMultipleStatements:
    def test_multiple_blocks_on_line(self):
        """Multiple block assignments on one line should warn."""
        text = 'limit = { exists = father }father = { save_scope_as = x }'
        diagnostics = check_multiple_statements([text])
        assert len(diagnostics) >= 1
        assert "CK3302" in [d.code for d in diagnostics]
    
    def test_single_line_block_ok(self):
        """Single inline block is acceptable."""
        text = 'limit = { is_adult = yes }'
        diagnostics = check_multiple_statements([text])
        assert len(diagnostics) == 0


class TestBraceAlignment:
    def test_misaligned_closing_brace(self):
        """Closing brace at wrong indent should warn."""
        text = '''trigger = {
	is_adult = yes
	}'''  # Closing brace has extra indent
        diagnostics = check_brace_alignment(text.split('\n'))
        assert len(diagnostics) >= 1
        assert "CK3307" in [d.code for d in diagnostics]
```

---

## Rollout Strategy

### Phase 1 (Week 1-2): Core Formatting + Critical Paradox Checks
1. Create `style_checks.py` with basic structure
2. Implement `check_indentation()` (CK3301, CK3303, CK3305, CK3307)
3. Implement `check_multiple_statements()` (CK3302)
4. Create `paradox_checks.py` for Paradox-specific validation
5. Implement scope timing validation (CK3550-3555)
6. Implement effect/trigger context checks (CK3870-3875)
7. Add tests for Phase 1 features
8. Integrate into `collect_all_diagnostics()`

### Phase 2 (Week 3-4): List Iterators + Localization
1. Implement list iterator validation (CK3976-3981)
2. Implement localization scope checks (CK4082-4089)
3. Implement common gotcha detection (CK5136-5145)
4. Implement opinion modifier validation (CK3656-3659)
5. Add comprehensive tests

### Phase 3 (Week 5-6): Event Structure + Scripted Blocks
1. Implement event structure validation (CK3760-3769)
2. Implement scripted trigger/effect checks (CK4190-4196)
3. Implement flag/variable hygiene checks (CK4614-4618)
4. Add code actions for auto-fixing common issues

### Phase 4 (Week 7-8): Code Quality + Configuration
1. Implement remaining style checks (CK3308-3345)
2. Add configuration options (enable/disable per category)
3. Add LSP settings support
4. Implement interaction/decision/on-action checks
5. Documentation and examples

### Phase 5 (Week 9-10): Performance + Advanced
1. Implement performance warning checks (CK5031-5035)
2. Implement mod compatibility checks (CK5246-5250)
3. Integration testing against real CK3 mods
4. Tune sensitivity to reduce false positives
5. User feedback integration
6. Release

---

## Success Criteria

1. **Detects the original problem**: The mangled code in `rq_gender_test_events.txt` should produce at least 2 warnings
2. **Catches scope timing issues**: Events using `scope:x` in trigger/desc before `save_scope_as` in immediate should error
3. **Catches context violations**: Effects in trigger blocks, triggers in effect blocks should error
4. **Catches CW262**: Inline opinion modifiers should error
5. **No false positives on valid code**: Running against well-formatted CK3 files should produce minimal/no warnings
6. **Configurable**: Users can disable entire categories or individual checks
7. **Fast**: All checks combined should add < 50ms to diagnostic time
8. **Actionable**: Each diagnostic message clearly explains what's wrong and how to fix it
9. **Graduated severity**: Errors for broken code, warnings for likely bugs, info/hints for style

---

## Code Action Integration (Future Enhancement)

Add auto-fix capabilities:

```python
# In code_actions.py

def get_style_fixes(diagnostic: types.Diagnostic, doc: TextDocument) -> List[types.CodeAction]:
    """Generate code actions to fix style issues."""
    
    if diagnostic.code == "CK3301":  # Wrong indentation
        return [create_fix_indentation_action(diagnostic, doc)]
    
    if diagnostic.code == "CK3302":  # Multiple statements
        return [create_split_statements_action(diagnostic, doc)]
    
    if diagnostic.code == "CK3304":  # Trailing whitespace
        return [create_trim_whitespace_action(diagnostic, doc)]
    
    return []
```

---

## References

- [Paradox Modding Conventions](../docs/modding-guide/)
- [LSP Diagnostic Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic)
- [Existing pychivalry diagnostics.py](./pychivalry/diagnostics.py)
- [Existing pychivalry formatting.py](./pychivalry/formatting.py) - Has complementary formatting logic

---

## Appendix: Diagnostic Message Templates

### CK3301 - Inconsistent Indentation
```
Inconsistent indentation: expected {expected} tabs, found {actual}. 
Block opened at line {open_line}.
```

### CK3302 - Multiple Statements
```
Multiple block assignments on one line. Consider splitting:
  Line contains: `{closing_context}` followed by `{next_block}`.
  Suggestion: Place `{next_block}` on a new line.
```

### CK3303 - Spaces Instead of Tabs
```
Indentation uses spaces instead of tabs. 
Paradox convention prefers tabs for indentation.
```

### CK3304 - Trailing Whitespace
```
Trailing whitespace detected ({count} characters).
```

### CK3305 - Block Content Not Indented
```
Block content should be indented relative to parent.
Content at column {actual}, parent block at column {parent}.
```

### CK3306 - Operator Spacing
```
Inconsistent spacing around '{operator}'. 
Use: `key = value` with single spaces around '='.
```

### CK3307 - Brace Alignment
```
Closing brace at column {actual} doesn't match opening at line {open_line} column {expected}.
```

### CK3308 - Missing Blank Line

```text
Consider adding a blank line between top-level blocks for readability.
Previous block ended at line {prev_end}.
```

---

## Appendix B: Paradox-Specific Diagnostic Templates

### CK3550 - Scope Used Before Definition (Trigger)

```text
Scope 'scope:{name}' used in trigger block but defined in immediate block.
The trigger block evaluates BEFORE immediate runs.
Fix: Pass scope from calling event, or use a variable check instead.
```

### CK3551 - Scope Used Before Definition (Desc)

```text
Scope 'scope:{name}' used in desc block but defined in immediate block.
Description text is evaluated BEFORE immediate runs.
Fix: Pass scope from calling event, or use triggered_desc with variable checks.
```

### CK3656 - Inline Opinion Modifier (CW262)

```text
Inline opinion value in add_opinion effect.
Found: add_opinion = {{ opinion = {value} }}
Fix: Define opinion modifier in common/opinion_modifiers/ and reference by name:
  add_opinion = {{ target = {target}  modifier = your_modifier_name }}
```

### CK3870 - Effect in Trigger Block

```text
Effect '{effect_name}' used in trigger block.
Trigger blocks should only contain conditions, not state-changing effects.
Move '{effect_name}' to immediate or option block.
```

### CK3976 - Effect in any_ Iterator

```text
Effect '{effect_name}' used inside any_{list} iterator.
any_* iterators are trigger-only and cannot contain effects.
Use every_{list} or random_{list} for effects.
```

### CK4082 - Root in Localization

```text
'root' cannot be referenced directly in localization.
Found: [root.GetName]
Fix: Save root as a named scope in immediate:
  immediate = {{ root = {{ save_scope_as = main_char }} }}
Then use: [main_char.GetName]
```

### CK4083 - Scope Prefix in Localization

```text
'scope:' prefix used in localization file.
Found: [scope:{name}.GetName]
Fix: Use just the scope name without prefix:
  [{name}.GetName]
```

### CK5137 - is_alive Without exists Check

```text
'is_alive = yes' check on '{scope}' without prior existence check.
If '{scope}' doesn't exist, this may cause errors.
Fix: Add existence check first:
  exists = {scope}
  {scope} = {{ is_alive = yes }}
```

### CK5142 - Character Comparison With =

```text
Character comparison using '=' operator.
Found: scope:{a} = scope:{b}
This checks if the left side equals the literal string "scope:{b}".
Fix: Use 'this' for character comparison:
  scope:{a} = {{ this = scope:{b} }}
```

### CK5031 - Expensive List Iteration

```text
'every_living_character' without restrictive limit.
This iterates ALL living characters in the game (very expensive).
Add a limit to reduce scope:
  every_living_character = {{
    limit = {{ is_courtier_of = root }}  # Or other restriction
    ...
  }}
```

---

## Appendix C: Module Architecture

### New Files to Create

```text
pychivalry/
├── style_checks.py          # CK33xx - Formatting & style validation
├── paradox_checks.py        # CK35xx-CK52xx - Paradox convention validation  
├── scope_timing.py          # CK3550-3555 - Scope timing validation
├── context_checks.py        # CK3870-3981 - Effect/trigger context validation
└── data/
    ├── deprecated.yaml      # List of deprecated effects/triggers
    ├── known_namespaces.yaml # Known mod namespaces to avoid collision
    └── dlc_content.yaml     # DLC-specific content identifiers
```

### Integration Points

```python
# In diagnostics.py

def collect_all_diagnostics(
    doc: TextDocument,
    ast: List[CK3Node],
    index: Optional[DocumentIndex] = None,
    config: Optional[DiagnosticConfig] = None
) -> List[types.Diagnostic]:
    """Collect all diagnostics for a document."""
    diagnostics = []
    config = config or DiagnosticConfig()
    
    # Existing checks (always enabled)
    diagnostics.extend(check_syntax(doc, ast))
    diagnostics.extend(check_semantics(ast, index))
    diagnostics.extend(check_scopes(ast, index))
    
    # NEW: Style checks (CK33xx)
    if config.style_enabled:
        from .style_checks import check_style
        diagnostics.extend(check_style(doc, config.style))
    
    # NEW: Paradox convention checks (CK35xx+)
    if config.paradox_enabled:
        from .paradox_checks import check_paradox_conventions
        diagnostics.extend(check_paradox_conventions(ast, index, config.paradox))
    
    # NEW: Scope timing checks (CK3550-3555)
    if config.scope_timing_enabled:
        from .scope_timing import check_scope_timing
        diagnostics.extend(check_scope_timing(ast, index))
    
    return diagnostics


@dataclass
class DiagnosticConfig:
    """Configuration for diagnostic checks."""
    style_enabled: bool = True
    paradox_enabled: bool = True
    scope_timing_enabled: bool = True
    
    style: StyleConfig = field(default_factory=StyleConfig)
    paradox: ParadoxConfig = field(default_factory=ParadoxConfig)


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
    max_nesting_depth: int = 5


@dataclass
class ParadoxConfig:
    """Configuration for Paradox convention checks."""
    effect_trigger_context: bool = True
    list_iterators: bool = True
    opinion_modifiers: bool = True
    event_structure: bool = True
    scripted_blocks: bool = True
    localization: bool = True
    performance_warnings: bool = True
    common_gotchas: bool = True
```

---

## Appendix D: LSP Configuration Schema

```json
{
  "ck3LanguageServer.diagnostics.style": {
    "type": "object",
    "description": "Style and formatting diagnostic settings",
    "properties": {
      "enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable style/formatting diagnostics"
      },
      "indentation": {
        "type": "boolean",
        "default": true,
        "description": "Check for consistent indentation"
      },
      "preferTabs": {
        "type": "boolean",
        "default": true,
        "description": "Prefer tabs over spaces (Paradox convention)"
      },
      "maxLineLength": {
        "type": "integer",
        "default": 120,
        "description": "Maximum recommended line length"
      }
    }
  },
  "ck3LanguageServer.diagnostics.paradox": {
    "type": "object",
    "description": "Paradox-specific convention diagnostics",
    "properties": {
      "enabled": {
        "type": "boolean", 
        "default": true,
        "description": "Enable Paradox convention diagnostics"
      },
      "scopeTiming": {
        "type": "boolean",
        "default": true,
        "description": "Check for scope timing issues (trigger/desc before immediate)"
      },
      "effectTriggerContext": {
        "type": "boolean",
        "default": true,
        "description": "Check for effects in trigger blocks and vice versa"
      },
      "performanceWarnings": {
        "type": "boolean",
        "default": true,
        "description": "Warn about potentially expensive operations"
      }
    }
  }
}
```
