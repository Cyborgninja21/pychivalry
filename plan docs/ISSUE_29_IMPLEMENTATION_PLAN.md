# Issue #29: Description Block Validation (CK3442-CK3446)

## Implementation Plan

**Issue:** [#29 Description Block Validation](https://github.com/Cyborgninja21/pychivalry/issues/29)  
**Status:** ✅ COMPLETE  
**Priority:** Enhancement - Validation

---

## Current State Analysis

### What's Implemented
| Code | Description | Status |
|------|-------------|--------|
| CK3443 | Empty desc block | ✅ Implemented |

### What's Missing
| Code | Description | Status |
|------|-------------|--------|
| CK3442 | first_valid has no unconditional fallback | ❌ Not implemented |
| CK3444 | Literal string in desc (informational) | ❌ Not implemented |
| CK3445 | Invalid desc structure (mixed first_valid/random_valid) | ❌ Not implemented |
| CK3446 | Excessive nesting (>3 levels) | ❌ Not implemented |

### Code Conflict Resolution
**Problem:** Current docs show CK3442 as "desc missing localization key" but Issue #29 defines it as "first_valid no fallback"

**Resolution:** Re-assign codes to match Issue #29 specification:
- CK3442 → first_valid no fallback (per Issue #29)
- Move "missing localization key" concept to CK3444's "literal string" check (they overlap)

---

## Implementation Phases

### Phase 1: Code Cleanup & Conflict Resolution
**Estimated Edits:** 3

1. Update `pychivalry/data/diagnostics.yaml`
   - Add CK3442 definition for first_valid fallback
   - Add CK3444 definition for literal string
   - Add CK3445 definition for invalid structure
   - Add CK3446 definition for excessive nesting

2. Update documentation in `Documentation/user-guide/diagnostics/`
   - Correct CK3442 description
   - Add new diagnostic codes

3. Update docstring in `paradox_checks.py` header
   - Fix CK3442 description

---

### Phase 2: Core Implementation
**File:** `pychivalry/paradox_checks.py`  
**Estimated Edits:** 4

#### Edit 1: Add helper functions for desc analysis

```python
def _find_desc_children(node: CK3Node, child_key: str) -> List[CK3Node]:
    """Find all children with given key in a desc block."""
    return [c for c in node.children if c.key == child_key]

def _has_unconditional_fallback(first_valid_node: CK3Node) -> bool:
    """
    Check if first_valid has an unconditional fallback.
    
    Returns True if:
    - Has a plain 'desc' child (not triggered_desc)
    - Last triggered_desc has always=yes in trigger
    """
    children = first_valid_node.children
    
    # Check for plain desc child
    for child in children:
        if child.key == "desc" and not child.children:
            # Plain desc = localization_key
            return True
        if child.key == "desc" and child.children:
            # Check if it's a triggered_desc wrapper or plain desc block
            has_trigger = any(c.key == "trigger" for c in child.children)
            if not has_trigger:
                return True
    
    # Check if last triggered_desc has always=yes
    triggered_descs = [c for c in children if c.key == "triggered_desc"]
    if triggered_descs:
        last = triggered_descs[-1]
        trigger = next((c for c in last.children if c.key == "trigger"), None)
        if trigger:
            always = next((c for c in trigger.children if c.key == "always"), None)
            if always and str(always.value).lower() == "yes":
                return True
    
    return False

def _calculate_desc_nesting_depth(node: CK3Node, current_depth: int = 0) -> int:
    """Calculate maximum nesting depth of desc structures."""
    max_depth = current_depth
    
    for child in node.children:
        if child.key in ("first_valid", "random_valid", "triggered_desc"):
            child_depth = _calculate_desc_nesting_depth(child, current_depth + 1)
            max_depth = max(max_depth, child_depth)
        elif child.children:
            child_depth = _calculate_desc_nesting_depth(child, current_depth)
            max_depth = max(max_depth, child_depth)
    
    return max_depth
```

#### Edit 2: Implement CK3442 - first_valid no fallback

```python
def check_first_valid_fallback(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check that first_valid blocks have an unconditional fallback.
    
    Detects CK3442: first_valid in desc without a fallback desc that always displays.
    Without a fallback, the event may show no description if no triggers match.
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node, in_desc: bool = False):
        # Check if this is a first_valid inside a desc context
        if node.key == "first_valid" and in_desc:
            if not _has_unconditional_fallback(node):
                diagnostics.append(
                    create_paradox_diagnostic(
                        message="'first_valid' has no fallback - may show nothing if no triggers match. Add an unconditional 'desc' as the last entry.",
                        node_range=node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3442",
                    )
                )
        
        # Track if we're in a desc context
        new_in_desc = in_desc or node.key == "desc"
        
        for child in node.children:
            check_node(child, new_in_desc)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

#### Edit 3: Implement CK3444 - literal string in desc

```python
def check_desc_literal_string(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for literal strings in desc fields.
    
    Detects CK3444: Using desc = "text" instead of a localization key.
    Literal strings work but bypass the localization system.
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node, in_event: bool = False):
        if node.key == "desc" and in_event:
            # Check if value is a quoted literal string
            if isinstance(node.value, str):
                value = node.value.strip()
                # Literal strings typically contain spaces or are quoted
                # Localization keys are typically identifiers like namespace.event.desc
                if " " in value or (value.startswith('"') and value.endswith('"')):
                    diagnostics.append(
                        create_paradox_diagnostic(
                            message="Consider using a localization key instead of a literal string in 'desc'. Localization keys support translations and text formatting.",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Information,
                            code="CK3444",
                        )
                    )
        
        # Detect event context
        is_event = False
        if "." in node.key:
            parts = node.key.split(".")
            if len(parts) == 2:
                try:
                    int(parts[1])
                    is_event = True
                except ValueError:
                    pass
        
        for child in node.children:
            check_node(child, in_event or is_event)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

#### Edit 4: Implement CK3445 and CK3446

```python
def check_desc_structure(ast: List[CK3Node], config: ParadoxConfig) -> List[types.Diagnostic]:
    """
    Check for invalid desc block structures.
    
    Detects:
    - CK3445: Invalid mixing of first_valid and random_valid at same level
    - CK3446: Excessive nesting depth (>3 levels)
    """
    diagnostics = []
    
    if not config.event_structure:
        return diagnostics
    
    def check_node(node: CK3Node, in_desc: bool = False):
        if node.key == "desc" or in_desc:
            # CK3445: Check for invalid mixing at same level
            if node.children:
                has_first_valid = any(c.key == "first_valid" for c in node.children)
                has_random_valid = any(c.key == "random_valid" for c in node.children)
                
                if has_first_valid and has_random_valid:
                    diagnostics.append(
                        create_paradox_diagnostic(
                            message="Invalid desc structure: mixing 'first_valid' and 'random_valid' at the same level. Use one or the other, or nest them properly.",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Error,
                            code="CK3445",
                        )
                    )
            
            # CK3446: Check nesting depth
            if node.key == "desc":
                depth = _calculate_desc_nesting_depth(node)
                if depth > 3:
                    diagnostics.append(
                        create_paradox_diagnostic(
                            message=f"Description has excessive nesting ({depth} levels > 3) - consider simplifying for maintainability.",
                            node_range=node.range,
                            severity=types.DiagnosticSeverity.Warning,
                            code="CK3446",
                        )
                    )
        
        for child in node.children:
            check_node(child, in_desc or node.key == "desc")
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

---

### Phase 3: Integration
**File:** `pychivalry/paradox_checks.py`  
**Estimated Edits:** 1

Wire new functions into `check_paradox_conventions()`:

```python
# In check_paradox_conventions function, add:
diagnostics.extend(check_first_valid_fallback(ast, config))
diagnostics.extend(check_desc_literal_string(ast, config))
diagnostics.extend(check_desc_structure(ast, config))
```

---

### Phase 4: Unit Tests
**File:** `tests/test_paradox_checks.py`  
**Estimated Edits:** 1 (add new test class)

```python
class TestDescBlockValidation:
    """Tests for description block validation (CK3442-CK3446)."""
    
    def test_first_valid_with_fallback_no_warning(self):
        """first_valid with fallback desc should not warn."""
        text = '''mymod.0001 = {
    type = character_event
    desc = {
        first_valid = {
            triggered_desc = {
                trigger = { has_trait = brave }
                desc = mymod.0001.desc.brave
            }
            desc = mymod.0001.desc.default
        }
    }
}'''
        # Test implementation
        
    def test_first_valid_no_fallback_warning(self):
        """first_valid without fallback should produce CK3442."""
        text = '''mymod.0001 = {
    type = character_event
    desc = {
        first_valid = {
            triggered_desc = {
                trigger = { has_trait = brave }
                desc = mymod.0001.desc.brave
            }
        }
    }
}'''
        # Test for CK3442
        
    def test_literal_string_info(self):
        """Literal string in desc should produce CK3444."""
        text = '''mymod.0001 = {
    type = character_event
    desc = "This is literal text"
}'''
        # Test for CK3444
        
    def test_mixed_first_random_valid_error(self):
        """Mixing first_valid and random_valid should produce CK3445."""
        text = '''mymod.0001 = {
    type = character_event
    desc = {
        first_valid = { }
        random_valid = { }
    }
}'''
        # Test for CK3445
        
    def test_excessive_nesting_warning(self):
        """Nesting >3 levels should produce CK3446."""
        text = '''mymod.0001 = {
    type = character_event
    desc = {
        first_valid = {
            triggered_desc = {
                trigger = { }
                desc = {
                    first_valid = {
                        triggered_desc = {
                            trigger = { }
                            desc = {
                                first_valid = { }
                            }
                        }
                    }
                }
            }
        }
    }
}'''
        # Test for CK3446
```

---

### Phase 5: Documentation Updates
**Estimated Edits:** 2

1. Update `Documentation/user-guide/diagnostics/Diagnostic codes.md`
2. Update `Documentation/user-guide/diagnostics/Diagnostic codes - Basic.md`

---

## Edit Summary

| Phase | File | Edits | Description |
|-------|------|-------|-------------|
| 1 | diagnostics.yaml | 1 | Add new diagnostic definitions |
| 1 | paradox_checks.py docstring | 1 | Fix CK3442 description |
| 2 | paradox_checks.py | 4 | Implement validation functions |
| 3 | paradox_checks.py | 1 | Wire into main check function |
| 4 | test_paradox_checks.py | 1 | Add test class |
| 5 | Diagnostic docs | 2 | Update documentation |
| **Total** | | **10** | |

---

## Execution Order

1. ✅ **Edit 1:** Update `diagnostics.yaml` with new codes
2. ✅ **Edit 2:** Fix docstring in `paradox_checks.py`
3. ✅ **Edit 3:** Add helper functions
4. ✅ **Edit 4:** Implement `check_first_valid_fallback` (CK3442)
5. ✅ **Edit 5:** Implement `check_desc_literal_string` (CK3444)
6. ✅ **Edit 6:** Implement `check_desc_structure` (CK3445, CK3446)
7. ✅ **Edit 7:** Wire into `check_paradox_conventions`
8. ✅ **Edit 8:** Add unit tests
9. ✅ **Tests passing:** All 10 new tests pass

---

## Acceptance Criteria (from Issue #29)

- [x] CK3442: Warning for `first_valid` without fallback
- [x] CK3443: Warning for empty `desc = { }` (already implemented)
- [x] CK3444: Info for literal strings in desc
- [x] CK3445: Error for invalid desc structure (mixed usage)
- [x] CK3446: Warning for >3 levels of nesting
- [x] Unit tests for each check
- [x] Integration with existing desc validation

---

## Notes

- The existing `check_desc_issues` function handles CK3443 - no changes needed
- CK3440/CK3441 (triggered_desc validation) are already implemented separately
- Consider adding quick-fix code actions in future for CK3442 (add fallback)
