# Quick Reference: PyChivalry Validation Codes

## Most Important: The Golden Rule (CK3550-CK3562)

**Event Evaluation Order:**
1. `trigger = { }` ← Evaluated **FIRST**
2. `desc = { }` ← Evaluated **SECOND**
3. `immediate = { }` ← Runs **THIRD**
4. Portraits ← Displayed **FOURTH**
5. Options ← Rendered **FIFTH**

**THE RULE**: Scopes created in `immediate` are **NOT** available in `trigger` or `desc`!

### Examples Location
- ✅ Good: [03_scopes/good_scopes.txt](03_scopes/good_scopes.txt)
- ❌ Bad: [03_scopes/bad_scope_timing.txt](03_scopes/bad_scope_timing.txt)

---

## Error Code Categories

### Syntax Errors (CK3001-CK3002)
**What**: Bracket matching errors
**Location**: [01_syntax/](01_syntax/)
- CK3001: Unmatched closing bracket
- CK3002: Unclosed bracket

### Semantic Errors (CK3101-CK3203)
**What**: Unknown triggers, effects, invalid scopes
**Location**: [02_semantic/](02_semantic/)
- CK3101: Unknown trigger
- CK3102: Effect in trigger block
- CK3103: Unknown effect
- CK3201-CK3203: Invalid scope chains

### Scope Timing (CK3550-CK3562) ⚠️ CRITICAL
**What**: The Golden Rule violations
**Location**: [03_scopes/](03_scopes/)
- CK3550: Scope in trigger from immediate (ERROR)
- CK3551: Scope in desc from immediate (WARNING)
- CK3560-CK3562: Localization scope issues

### Style Issues (CK33xx)
**What**: Formatting and style problems
**Location**: [04_style/](04_style/)
- CK3301: Inconsistent indentation
- CK3303: Spaces instead of tabs
- CK3306: Inconsistent operator spacing
- CK3317: Deeply nested blocks
- etc. (15 total codes)

### Event Structure (CK3760-CK3769)
**What**: Event structure requirements
**Location**: [05_events/](05_events/)
- CK3760: Event missing type
- CK3762: Hidden event with options
- CK3764: Non-hidden event missing desc
- CK3769: Character event has no portraits

### Options (CK3450-CK3461)
**What**: Option block validation
**Location**: [05_events/bad_options.txt](05_events/bad_options.txt)
- CK3450: Option missing name
- CK3459: All options have triggers (no fallback)
- CK3456: show_as_unavailable without trigger

### Descriptions (CK3440-CK3446)
**What**: Description block validation
**Location**: [05_events/bad_descriptions.txt](05_events/bad_descriptions.txt)
- CK3440: triggered_desc missing trigger
- CK3442: first_valid has no fallback
- CK3446: Excessive desc nesting

### Story Cycles (STORY-001 to STORY-045)
**What**: Story cycle structure and lifecycle
**Location**: [06_story_cycles/](06_story_cycles/)
- STORY-001-007: Basic structure
- STORY-020-027: Lifecycle and logic
- STORY-040-045: Best practices

### Decisions (DECISION-001 to DECISION-004)
**What**: Decision structure
**Location**: [07_decisions/](07_decisions/)
- DECISION-001: Missing ai_check_interval
- DECISION-002: Missing effect block

### Interactions (INTERACTION-001 to INTERACTION-003)
**What**: Character interaction structure
**Location**: [08_interactions/](08_interactions/)

### Schemes (SCHEME-001 to SCHEME-003)
**What**: Scheme structure
**Location**: [09_schemes/](09_schemes/)

### On-Actions (ON_ACTION-001, ON_ACTION-002)
**What**: On-action structure
**Location**: [10_on_actions/](10_on_actions/)

### Assets (GFX001, SND001, SND002)
**What**: Missing graphics/sound files
**Location**: [11_assets/](11_assets/)

### Localization (CK3600-CK3605, LOC-001 to LOC-007)
**What**: Localization file validation
**Location**: [12_localization/](12_localization/)
- CK3600: Missing localization key
- LOC-001-007: YML syntax errors

---

## Common Mistakes by Category

### 1. Scope Timing (Most Common Bug)
```paradox
# ❌ BAD - scope:my_liege doesn't exist in trigger!
trigger = {
    scope:my_liege = { is_alive = yes }
}
immediate = {
    liege = { save_scope_as = my_liege } # Too late!
}

# ✅ GOOD - Save scope in trigger
trigger = {
    liege = {
        is_alive = yes
        save_temporary_scope_as = my_liege # Available everywhere now
    }
}
```

### 2. Effects in Triggers
```paradox
# ❌ BAD - Effects can't go in trigger blocks
trigger = {
    is_adult = yes
    add_gold = 100 # ERROR CK3102
}

# ✅ GOOD - Effects go in immediate or options
immediate = {
    add_gold = 100
}
```

### 3. Missing Exists Checks
```paradox
# ❌ BAD - Can crash if father is null
trigger = {
    father = { is_alive = yes } # ERROR CK5137
}

# ✅ GOOD - Check exists first
trigger = {
    father = {
        exists = yes
        is_alive = yes
    }
}
```

### 4. All Options Have Triggers
```paradox
# ❌ BAD - All options have triggers, no fallback
option = {
    name = option_a
    trigger = { has_trait = brave }
}
option = {
    name = option_b
    trigger = { has_trait = craven }
}
# ERROR CK3459: What if neither trait?

# ✅ GOOD - Always have a fallback option
option = {
    name = option_c # No trigger = always available
}
```

### 5. Character Comparison
```paradox
# ❌ BAD - Wrong syntax
trigger = {
    liege = root # ERROR CK5142
}

# ✅ GOOD - Use 'this'
trigger = {
    liege = { this = root }
}
```

---

## Testing Strategy

### For Each Error Code
1. Find the relevant file in this comprehensive mod
2. Look for comments with the error code (e.g., `# ERROR CK3101`)
3. Compare with the good example in the same category
4. Write a unit test using the bad example to verify the diagnostic appears

### Example Test Pattern
```python
def test_ck3550_scope_in_trigger_from_immediate():
    """Test that scopes created in immediate can't be used in trigger"""
    with open('tests/fixtures/comprehensive_mod/03_scopes/bad_scope_timing.txt') as f:
        content = f.read()
        diagnostics = collect_all_diagnostics(content)
        assert any(d.code == 'CK3550' for d in diagnostics)
```

---

## Statistics

- **150+ error codes** documented
- **12 validation categories** organized
- **~2,500 lines** of example code
- **Good and bad examples** for every rule

---

## Priority Order for Learning

1. **Scope Timing (CK3550-CK3562)** ← Start here! Most important
2. **Semantic Validation (CK3101-CK3203)** ← Core functionality
3. **Event Structure (CK3760-CK3769)** ← Most common feature
4. **Options (CK3450-CK3461)** ← Every event needs options
5. **Descriptions (CK3440-CK3446)** ← Event presentation
6. **Style (CK33xx)** ← Code quality
7. **Syntax (CK3001-CK3002)** ← Basic but rare
8. Rest of the categories as needed

---

## File Structure Summary

```
comprehensive_mod/
├── README.md              # Full index of all error codes
├── QUICK_REFERENCE.md     # This file
├── PROGRESS.md            # Creation progress tracker
├── 01_syntax/             # CK3001-CK3002
├── 02_semantic/           # CK3101-CK3203
├── 03_scopes/             # CK3550-CK3562 (GOLDEN RULE)
├── 04_style/              # CK33xx
├── 05_events/             # CK3760-CK3769, CK3450-CK3461, CK3440-CK3446
├── 06_story_cycles/       # STORY-xxx
├── 07_decisions/          # DECISION-xxx
├── 08_interactions/       # INTERACTION-xxx
├── 09_schemes/            # SCHEME-xxx
├── 10_on_actions/         # ON_ACTION-xxx
├── 11_assets/             # GFX, SND codes
└── 12_localization/       # CK3600-CK3605, LOC-xxx
```

Each directory contains:
- `good_*.txt` - Working examples
- `bad_*.txt` - Error demonstrations with comments

---

## Need Help?

1. Check the README in each category folder
2. Compare bad examples with good examples
3. Look for `# ERROR CKxxxx:` comments
4. See [main README.md](README.md) for complete error code index
