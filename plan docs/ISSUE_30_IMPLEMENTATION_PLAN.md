# Issue #30: Option Block Validation (CK3451-CK3459) - Implementation Plan

## Overview

This plan covers the implementation of option block validation checks for CK3 events.
Options are the primary player interaction in events - validating option fields ensures
trait icons display correctly, skill bonuses show properly, AI behavior works as intended,
and players always have an available option.

## Diagnostic Code Summary

| Code | Severity | Check | Status | Priority |
|------|----------|-------|--------|----------|
| **CK3450** | Error | Option missing name | ✅ Done | - |
| **CK3451** | Warning | Invalid trait reference | ✅ Done | - |
| **CK3452** | Warning | Invalid skill reference | ✅ Done | HIGH |
| **CK3453** | Warning | Invalid add_internal_flag | ✅ Done | MEDIUM |
| **CK3454** | Warning | Redundant fallback | ✅ Done | LOW |
| **CK3455** | Warning | Multiple exclusive options | ✅ Done | MEDIUM |
| **CK3456** | Warning | show_as_unavailable without trigger | ✅ Done | MEDIUM |
| **CK3457** | Error | highlight_portrait invalid scope | ✅ Done | LOW |
| **CK3458** | Info | Option name is literal | ✅ Done | LOW |
| **CK3459** | Warning | All options have triggers | ✅ Done | HIGH |
| **CK3460** | Warning | Option with multiple names | ✅ Done (reassigned) | - |
| **CK3461** | Warning | Empty option block | ✅ Done (reassigned) | - |

## Code Conflict Resolution (Completed)

The following codes were reassigned to free up space for the intended checks:

- **CK3453** (multiple names) → **CK3460**
- **CK3456** (empty option) → **CK3461**

---

## Phase 1: High-Priority Checks (CK3452, CK3459)

### Edit 1: Add CK3452 - Invalid Skill Reference

**Purpose**: Validate that `skill = xxx` in options references a valid CK3 skill.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_option_skill_reference()`

**Valid Skills**:
```python
VALID_SKILLS = {"diplomacy", "martial", "stewardship", "intrigue", "learning", "prowess"}
```

**Detection Logic**:
```python
def check_option_skill_reference(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for invalid skill references in option blocks.
    
    Detects:
    - CK3452: Invalid skill reference (skill = xxx not a valid skill)
    """
    VALID_SKILLS = {"diplomacy", "martial", "stewardship", "intrigue", "learning", "prowess"}
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node):
        if node.key == "option":
            for child in node.children:
                if child.key == "skill" and child.value:
                    skill_name = str(child.value).lower()
                    if skill_name not in VALID_SKILLS:
                        diagnostics.append(
                            create_paradox_diagnostic(
                                message=f"Invalid skill '{child.value}'. Valid skills: diplomacy, martial, stewardship, intrigue, learning, prowess",
                                node_range=child.range,
                                severity=types.DiagnosticSeverity.Warning,
                                code="CK3452",
                            )
                        )
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

**Tests Required**:
- `test_option_valid_skill_no_error()` - Test each valid skill
- `test_option_invalid_skill_warning()` - Test invalid skill produces CK3452

---

### Edit 2: Add CK3459 - All Options Have Triggers (No Fallback)

**Purpose**: Warn when all options in an event have trigger conditions but no fallback option.
This can leave players with no available choices if no triggers match.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_all_options_have_triggers()`

**Detection Logic**:
```python
def check_all_options_have_triggers(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for events where all options have triggers with no fallback.
    
    Detects:
    - CK3459: All options have triggers - player may have no available options
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    for node in ast:
        # Check if this looks like an event
        if "." in node.key and node.children:
            parts = node.key.split(".")
            if len(parts) == 2:
                try:
                    int(parts[1])  # Event ID should be numeric
                    
                    # Collect options
                    options = [child for child in node.children if child.key == "option"]
                    
                    if not options:
                        continue  # No options to check
                    
                    # Check if ALL options have triggers and NONE have fallback
                    all_have_triggers = True
                    any_has_fallback = False
                    any_has_always_yes = False
                    
                    for opt in options:
                        has_trigger = False
                        has_fallback = False
                        
                        for child in opt.children:
                            if child.key == "trigger":
                                has_trigger = True
                                # Check for always = yes in trigger (effectively no trigger)
                                for tc in child.children:
                                    if tc.key == "always" and tc.value in ("yes", True):
                                        any_has_always_yes = True
                            elif child.key == "fallback" and child.value in ("yes", True):
                                has_fallback = True
                        
                        if not has_trigger:
                            all_have_triggers = False
                        if has_fallback:
                            any_has_fallback = True
                    
                    # Warn if all options have triggers but no fallback
                    if all_have_triggers and not any_has_fallback and not any_has_always_yes and len(options) > 0:
                        # Report on the last option
                        last_option = options[-1]
                        diagnostics.append(
                            create_paradox_diagnostic(
                                message=f"All {len(options)} options have trigger conditions with no fallback - player may have no available options if no triggers match. Consider adding 'fallback = yes' to one option.",
                                node_range=last_option.range,
                                severity=types.DiagnosticSeverity.Warning,
                                code="CK3459",
                            )
                        )
                
                except ValueError:
                    pass
    
    return diagnostics
```

**Tests Required**:
- `test_options_with_fallback_no_error()` - Event with fallback option
- `test_options_without_fallback_warning()` - All options with triggers, no fallback
- `test_options_one_without_trigger_no_error()` - At least one unconditional option

---

## Phase 2: Medium-Priority Checks (CK3453, CK3455, CK3456)

### Edit 3: Add CK3453 - Invalid add_internal_flag

**Purpose**: Validate that `add_internal_flag` only uses valid values: `special` or `dangerous`.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_option_internal_flag()`

**Valid Flags**:
```python
VALID_INTERNAL_FLAGS = {"special", "dangerous"}
```

**Detection Logic**:
```python
def check_option_internal_flag(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for invalid add_internal_flag values in option blocks.
    
    Detects:
    - CK3453: Invalid add_internal_flag (value not 'special' or 'dangerous')
    """
    VALID_INTERNAL_FLAGS = {"special", "dangerous"}
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node):
        if node.key == "option":
            for child in node.children:
                if child.key == "add_internal_flag" and child.value:
                    flag_value = str(child.value).lower()
                    if flag_value not in VALID_INTERNAL_FLAGS:
                        diagnostics.append(
                            create_paradox_diagnostic(
                                message=f"Invalid add_internal_flag '{child.value}'. Must be 'special' or 'dangerous'.",
                                node_range=child.range,
                                severity=types.DiagnosticSeverity.Warning,
                                code="CK3453",
                            )
                        )
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

**Tests Required**:
- `test_option_valid_internal_flag_no_error()` - Test 'special' and 'dangerous'
- `test_option_invalid_internal_flag_warning()` - Test invalid flag produces CK3453

---

### Edit 4: Add CK3455 - Multiple Exclusive Options

**Purpose**: Warn when multiple options have `exclusive = yes` which may conflict.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_multiple_exclusive_options()`

**Detection Logic**:
```python
def check_multiple_exclusive_options(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for events with multiple exclusive options.
    
    Detects:
    - CK3455: Multiple exclusive options may conflict
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    for node in ast:
        # Check if this looks like an event
        if "." in node.key and node.children:
            parts = node.key.split(".")
            if len(parts) == 2:
                try:
                    int(parts[1])  # Event ID should be numeric
                    
                    # Find exclusive options
                    exclusive_options = []
                    for child in node.children:
                        if child.key == "option":
                            for opt_child in child.children:
                                if opt_child.key == "exclusive" and opt_child.value in ("yes", True):
                                    exclusive_options.append(child)
                                    break
                    
                    # Warn on duplicates (skip first)
                    if len(exclusive_options) > 1:
                        for opt in exclusive_options[1:]:
                            diagnostics.append(
                                create_paradox_diagnostic(
                                    message=f"Multiple 'exclusive = yes' options ({len(exclusive_options)} found) may conflict - only one exclusive option should be shown.",
                                    node_range=opt.range,
                                    severity=types.DiagnosticSeverity.Warning,
                                    code="CK3455",
                                )
                            )
                
                except ValueError:
                    pass
    
    return diagnostics
```

**Tests Required**:
- `test_single_exclusive_option_no_error()` - One exclusive option is fine
- `test_multiple_exclusive_options_warning()` - Multiple exclusive options

---

### Edit 5: Add CK3456 - show_as_unavailable Without Trigger

**Purpose**: Warn when `show_as_unavailable` is used but option has no trigger - makes no sense.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_show_as_unavailable_without_trigger()`

**Detection Logic**:
```python
def check_show_as_unavailable_without_trigger(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for show_as_unavailable without a trigger block.
    
    Detects:
    - CK3456: show_as_unavailable without trigger has no effect
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node):
        if node.key == "option":
            has_trigger = False
            show_unavail_node = None
            
            for child in node.children:
                if child.key == "trigger":
                    has_trigger = True
                elif child.key == "show_as_unavailable":
                    show_unavail_node = child
            
            if show_unavail_node and not has_trigger:
                diagnostics.append(
                    create_paradox_diagnostic(
                        message="'show_as_unavailable' has no effect without a 'trigger' block. Add a trigger or remove show_as_unavailable.",
                        node_range=show_unavail_node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3456",
                    )
                )
        
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

**Tests Required**:
- `test_show_as_unavailable_with_trigger_no_error()` - Has both trigger and show_as_unavailable
- `test_show_as_unavailable_without_trigger_warning()` - show_as_unavailable without trigger

---

## Phase 3: Low-Priority Checks (CK3454, CK3457, CK3458)

### Edit 6: Add CK3454 - Redundant Fallback

**Purpose**: Warn when `fallback = yes` is used with `always = yes` trigger (redundant).

**Location**: `pychivalry/paradox_checks.py` - add new function `check_redundant_fallback()`

**Detection Logic**:
```python
def check_redundant_option_fallback(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for redundant fallback usage.
    
    Detects:
    - CK3454: Redundant fallback - fallback = yes with always = yes trigger
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node):
        if node.key == "option":
            has_fallback = False
            fallback_node = None
            has_always_yes = False
            
            for child in node.children:
                if child.key == "fallback" and child.value in ("yes", True):
                    has_fallback = True
                    fallback_node = child
                elif child.key == "trigger":
                    # Check if trigger has always = yes
                    for tc in child.children:
                        if tc.key == "always" and tc.value in ("yes", True):
                            has_always_yes = True
                            break
            
            if has_fallback and has_always_yes and fallback_node:
                diagnostics.append(
                    create_paradox_diagnostic(
                        message="'fallback = yes' is redundant when trigger has 'always = yes' - the option is already always available.",
                        node_range=fallback_node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3454",
                    )
                )
        
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

**Tests Required**:
- `test_fallback_without_always_yes_no_error()` - Normal fallback usage
- `test_fallback_with_always_yes_warning()` - Redundant combination

---

### Edit 7: Add CK3457 - Invalid highlight_portrait Scope

**Purpose**: Warn when `highlight_portrait` references an undefined scope.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_highlight_portrait_scope()`

**Detection Logic**:
```python
def check_highlight_portrait_scope(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for invalid scope references in highlight_portrait.
    
    Detects:
    - CK3457: highlight_portrait references undefined scope
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    # Common valid scope references
    BUILTIN_SCOPES = {"root", "this", "prev", "from", "yes", "no"}
    
    def check_node(node: CK3Node, defined_scopes: Set[str]):
        if node.key == "option":
            for child in node.children:
                if child.key == "highlight_portrait" and child.value:
                    scope_ref = str(child.value)
                    
                    # Check if it's a scope: reference
                    if scope_ref.startswith("scope:"):
                        scope_name = scope_ref[6:]  # Remove "scope:" prefix
                        if scope_name not in defined_scopes and scope_name not in BUILTIN_SCOPES:
                            diagnostics.append(
                                create_paradox_diagnostic(
                                    message=f"highlight_portrait references undefined scope '{scope_ref}'. Make sure this scope is defined in the event's immediate or trigger blocks.",
                                    node_range=child.range,
                                    severity=types.DiagnosticSeverity.Error,
                                    code="CK3457",
                                )
                            )
        
        for child in node.children:
            check_node(child, defined_scopes)
    
    # TODO: Extract defined scopes from immediate/trigger blocks for more accurate validation
    # For now, just check for obvious patterns
    for node in ast:
        check_node(node, set())
    
    return diagnostics
```

**Tests Required**:
- `test_highlight_portrait_valid_scope_no_error()` - References known scope
- `test_highlight_portrait_undefined_scope_error()` - References undefined scope

---

### Edit 8: Add CK3458 - Option Name is Literal String

**Purpose**: Info when option uses literal string instead of localization key.

**Location**: `pychivalry/paradox_checks.py` - add new function `check_option_literal_name()`

**Detection Logic**:
```python
def check_option_literal_name(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for literal string names in options.
    
    Detects:
    - CK3458: Option name is literal string instead of localization key
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node):
        if node.key == "option":
            for child in node.children:
                if child.key == "name" and child.value:
                    name_value = str(child.value)
                    # Check if it's a quoted literal string (contains spaces or special chars)
                    # Localization keys are typically identifiers like "my_event.001.a"
                    if " " in name_value or name_value.startswith('"') or name_value.startswith("'"):
                        diagnostics.append(
                            create_paradox_diagnostic(
                                message=f"Option uses literal string '{name_value}' instead of localization key. Consider using a localization key for translation support.",
                                node_range=child.range,
                                severity=types.DiagnosticSeverity.Information,
                                code="CK3458",
                            )
                        )
        
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

**Tests Required**:
- `test_option_loc_key_name_no_info()` - Normal localization key
- `test_option_literal_string_name_info()` - Literal string produces info

---

## Phase 4: Integration & Wiring

### Edit 9: Wire All New Functions into check_paradox_conventions()

**Location**: `pychivalry/paradox_checks.py` - update `check_paradox_conventions()` function

Add calls to all new validation functions:

```python
# Phase 4 - Option Block Validation (CK3452-CK3459)
diagnostics.extend(check_option_skill_reference(ast, config))
diagnostics.extend(check_option_internal_flag(ast, config))
diagnostics.extend(check_redundant_option_fallback(ast, config))
diagnostics.extend(check_multiple_exclusive_options(ast, config))
diagnostics.extend(check_show_as_unavailable_without_trigger(ast, config))
diagnostics.extend(check_highlight_portrait_scope(ast, config))
diagnostics.extend(check_option_literal_name(ast, config))
diagnostics.extend(check_all_options_have_triggers(ast, config))
```

---

## Phase 5: Documentation & Data Files

### Edit 10: Update diagnostics.yaml

Add entries for all new diagnostic codes:

```yaml
CK3452:
  message: "Invalid skill reference"
  severity: warning
  description: "skill = xxx references unknown skill. Valid: diplomacy, martial, stewardship, intrigue, learning, prowess"

CK3453:
  message: "Invalid add_internal_flag"
  severity: warning
  description: "add_internal_flag value must be 'special' or 'dangerous'"

CK3454:
  message: "Redundant fallback"
  severity: warning
  description: "fallback = yes is redundant when trigger has always = yes"

CK3455:
  message: "Multiple exclusive options"
  severity: warning
  description: "Multiple exclusive = yes options may conflict"

CK3456:
  message: "show_as_unavailable without trigger"
  severity: warning
  description: "show_as_unavailable has no effect without a trigger block"

CK3457:
  message: "Invalid highlight_portrait scope"
  severity: error
  description: "highlight_portrait references undefined scope"

CK3458:
  message: "Option name is literal"
  severity: information
  description: "Consider using localization key instead of literal string"

CK3459:
  message: "All options have triggers"
  severity: warning
  description: "All options have triggers with no fallback - player may have no available options"

CK3460:
  message: "Option with multiple names"
  severity: warning
  description: "Option has multiple name fields - only the first will be used"

CK3461:
  message: "Empty option block"
  severity: warning
  description: "Option block has no content"
```

### Edit 11: Update Documentation

Update `Documentation/user-guide/diagnostics/Diagnostic codes.md`:
- Add new codes to Option Validation section
- Update code range to CK3450-CK3461
- Add examples for each new code

---

## Implementation Order

1. **Phase 1** (HIGH priority): CK3452, CK3459
   - These catch real bugs that affect gameplay
   
2. **Phase 2** (MEDIUM priority): CK3453, CK3455, CK3456
   - These catch common mistakes that cause unexpected behavior

3. **Phase 3** (LOW priority): CK3454, CK3457, CK3458
   - These are code quality and best practice checks

4. **Phase 4**: Wire all functions into main validation

5. **Phase 5**: Documentation and data files

---

## Estimated Effort

| Phase | Edits | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 2 functions | ~30 min |
| Phase 2 | 3 functions | ~45 min |
| Phase 3 | 3 functions | ~45 min |
| Phase 4 | Integration | ~15 min |
| Phase 5 | Docs/Data | ~30 min |
| Testing | Unit tests | ~45 min |
| **Total** | **11 edits** | **~3.5 hours** |

---

## Acceptance Criteria (from Issue #30)

- [x] CK3451: Warning for unknown trait (integrate with traits.py) ✅ Already done
- [ ] CK3452: Warning for invalid skill
- [ ] CK3453: Warning for invalid add_internal_flag
- [ ] CK3454: Warning for redundant fallback
- [ ] CK3455: Warning for multiple exclusive options
- [ ] CK3456: Warning for show_as_unavailable without trigger
- [ ] CK3457: Error for invalid highlight_portrait scope
- [ ] CK3458: Info for literal option name
- [ ] CK3459: Warning when all options have triggers
- [ ] Unit tests for each check
