# Commenting Guide for PyChivalry Example Mod

This document explains the comprehensive commenting pattern used throughout the example mod to make each test crystal clear.

## Purpose

Every file in this example mod is designed to:
1. **Teach** - Show correct and incorrect patterns
2. **Test** - Provide validation examples for all error codes
3. **Document** - Explain why patterns are good or bad

## Comment Structure

### File Header Pattern

Every file starts with a comprehensive header:

```paradox
# ===================================================================
# [GOOD/BAD] [CATEGORY] EXAMPLES
# ===================================================================
# This file demonstrates [CORRECT/INCORRECT] [description].
# All examples in this file should [PASS/FAIL] validation.
#
# Error Codes Demonstrated: (for bad files)
# - CK3xxx: Description
# - CK3xxx: Description
#
# What this tests: (for good files)
# - Feature 1
# - Feature 2
#
# Expected validation result: [NO ERRORS / ERRORS DETECTED]
# ===================================================================

namespace = [category]
```

### Example Section Pattern

Each example within a file follows this structure:

```paradox
# -------------------------------------------------------------------
# [ERROR CKxxxx / Example N]: Description
# -------------------------------------------------------------------
# WHAT THIS TESTS: Specific functionality being tested
# SHOULD PASS/FAIL: Expected validation outcome
# WHY IT'S GOOD/BAD: Explanation of the pattern
# HOW TO FIX: (for bad examples) Step-by-step solution
# SEVERITY: (for critical errors) ERROR/WARNING/INFO
# -------------------------------------------------------------------
[code example]
```

## Examples by Category

### 1. Syntax Files (CK3001-CK3002)

**Good File Header:**
```paradox
# ===================================================================
# GOOD SYNTAX EXAMPLES
# ===================================================================
# This file demonstrates CORRECT bracket matching and syntax structure.
# All examples in this file should PASS validation with NO errors.
#
# What this tests:
# - Proper opening and closing bracket matching
# - Correct nesting of blocks
# - Valid syntax structure
#
# Expected validation result: NO ERRORS
# ===================================================================
```

**Bad File Example:**
```paradox
# -------------------------------------------------------------------
# ERROR CK3001: Unmatched closing bracket - extra closing brace
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of extra closing braces
# SHOULD FAIL: Yes - CK3001 error
# WHY IT'S BAD: Extra closing brace has no matching opening brace
# HOW TO FIX: Remove the extra closing brace on line 21
# -------------------------------------------------------------------
syntax_bad.0001 = {
	type = character_event
	# ...
} # EXTRA CLOSING BRACE - no matching opening brace above this
}
```

### 2. Semantic Files (CK3005, CK3007, CK3101-CK3103, CK3201-CK3203, etc.)

**Bad Triggers Example:**
```paradox
# -------------------------------------------------------------------
# ERROR CK5137: is_alive without exists check (can crash)
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of is_alive without exists guard
# SHOULD FAIL: Yes - CK5137 error (2 instances)
# WHY IT'S BAD: If father/liege is null, game CRASHES
# HOW TO FIX: Check 'exists = yes' before using is_alive
# CRITICAL: This is a crash bug, not just a warning!
# -------------------------------------------------------------------
semantic_bad_triggers.0009 = {
	trigger = {
		father = {
			is_alive = yes # Can crash if father is null
		}
	}
}
```

### 3. Scope Timing Files (CK3550-CK3562) - "The Golden Rule"

**File Header:**
```paradox
# ===================================================================
# BAD SCOPE TIMING EXAMPLES - "THE GOLDEN RULE" VIOLATIONS
# ===================================================================
# This file demonstrates INCORRECT scope timing that SHOULD FAIL validation.
# All examples in this file violate "The Golden Rule".
#
# Error Codes Demonstrated:
# - CK3550: Scope in trigger from immediate
# - CK3551: Scope in desc from immediate
# [... all 9 codes ...]
#
# ⚠️ CRITICAL: This is the #1 source of bugs in CK3 modding!
#
# Expected validation result: ERRORS DETECTED
# ===================================================================
```

**Example:**
```paradox
# -------------------------------------------------------------------
# ERROR CK3550: Scope in trigger from immediate
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of scopes used before creation
# SHOULD FAIL: Yes - CK3550 error
# WHY IT'S BAD: trigger runs BEFORE immediate, scope doesn't exist yet
# HOW TO FIX: Save scope in trigger, not immediate
# SEVERITY: ERROR - will crash or cause unpredictable behavior
# -------------------------------------------------------------------
```

### 4. Style Files (CK33xx)

**Bad Style Example:**
```paradox
# -------------------------------------------------------------------
# ERROR CK3303: Spaces instead of tabs
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of space indentation
# SHOULD FAIL: Yes - CK3303 warnings for each line
# WHY IT'S BAD: CK3 scripting convention requires tabs
# HOW TO FIX: Replace all spaces with tabs for indentation
# SEVERITY: INFO - style preference, not functional error
# -------------------------------------------------------------------
```

### 5. Events Files (CK3420-CK3769)

**File Structure:**
```paradox
# ===================================================================
# GOOD EVENTS EXAMPLES
# ===================================================================
# Demonstrates CORRECT event structure, options, descriptions, and portraits.
#
# What this tests:
# - Proper event structure (type, title, desc)
# - Valid option configurations
# - Correct description blocks (triggered_desc, first_valid)
# - Proper portrait placement
# - Valid AI chance configuration
#
# Expected validation result: NO ERRORS
# ===================================================================
```

**Bad Event Structure Example:**
```paradox
# -------------------------------------------------------------------
# ERROR CK3760: Missing type declaration
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of events without type field
# SHOULD FAIL: Yes - CK3760 error
# WHY IT'S BAD: Every event must declare its type
# HOW TO FIX: Add 'type = character_event' (or letter_event, etc.)
# SEVERITY: ERROR - event won't function without type
# -------------------------------------------------------------------
```

### 6. Story Cycles Files (STORY-001 to STORY-045)

**Header Pattern:**
```paradox
# ===================================================================
# BAD STORY CYCLES EXAMPLES
# ===================================================================
# Demonstrates INCORRECT story cycle patterns that SHOULD FAIL validation.
#
# Error Codes Demonstrated (27 total):
# Critical:
# - STORY-001: Invalid timing format
# - STORY-002: Missing on_setup/on_end
# [... grouped by severity ...]
#
# Expected validation result: ERRORS DETECTED
# ===================================================================
```

### 7. Decisions Files (DECISION-001 to DECISION-004)

```paradox
# -------------------------------------------------------------------
# ERROR DECISION-001: Missing ai_check_interval
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of decisions without AI configuration
# SHOULD FAIL: Yes - DECISION-001 error
# WHY IT'S BAD: AI won't evaluate this decision properly
# HOW TO FIX: Add 'ai_check_interval = 60' (or appropriate value)
# SEVERITY: WARNING - affects AI behavior
# -------------------------------------------------------------------
```

### 8. Localization Files (.yml)

**YML File Header:**
```yaml
# ===================================================================
# GOOD LOCALIZATION EXAMPLES
# ===================================================================
# This file demonstrates CORRECT YAML localization syntax.
# Should PASS validation with NO errors.
#
# What this tests:
# - Proper l_english: header
# - Correct key:version format
# - Valid character functions
# - Proper formatting codes
# - Correct icon syntax
#
# Expected result: NO ERRORS
# ===================================================================

l_english:
```

**Example:**
```yaml
# -------------------------------------------------------------------
# Example 1: Basic localization keys
# -------------------------------------------------------------------
# WHAT THIS TESTS: Proper key:version syntax
# SHOULD PASS: Yes - correct format
# -------------------------------------------------------------------
 loc_good.0001.t:0 "A Simple Title"
 loc_good.0001.desc:0 "A description without variables."
```

### 9. Assets Files (GFX001, SND001, SND002)

```paradox
# -------------------------------------------------------------------
# ERROR GFX001: Missing graphics file
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of referenced but missing graphics files
# SHOULD FAIL: Yes - GFX001 error
# WHY IT'S BAD: Game will show placeholder/missing texture
# HOW TO FIX: Create the graphics file or fix the path
# SEVERITY: ERROR - visual bugs
# -------------------------------------------------------------------
```

### 10. On-Actions Files (CK3400-CK3508)

```paradox
# -------------------------------------------------------------------
# ERROR CK3503: N² performance issue
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of performance anti-patterns
# SHOULD FAIL: Yes - CK3503 warning
# WHY IT'S BAD: Nested on_actions cause exponential complexity
# HOW TO FIX: Restructure to avoid nested fallback chains
# SEVERITY: WARNING - can cause performance issues
# -------------------------------------------------------------------
```

## Comment Requirements

### Required Fields

Every example must have:
1. **Section Header** with divider lines (`# -----`)
2. **Error Code or Example Number** in the header
3. **WHAT THIS TESTS** - Brief description
4. **SHOULD PASS/FAIL** - Clear expectation
5. **WHY IT'S GOOD/BAD** - Explanation

### Optional Fields

Include when relevant:
1. **HOW TO FIX** - For bad examples
2. **SEVERITY** - For critical errors (crash bugs, warnings vs errors)
3. **DEMONSTRATES** - Special patterns being shown
4. **NOTE** - Additional context
5. **CRITICAL** - For dangerous patterns
6. **COMMON MISTAKE** - Frequent errors

## Inline Comments

Within code examples:
```paradox
semantic_bad.0001 = {
	trigger = {
		is_adult = yes
		is_super_powerful = yes # ERROR CK3101: Unknown trigger
		has_magic_powers = yes  # ERROR CK3101: Unknown trigger
	}
}
```

Mark errors inline with:
- `# ERROR CKxxxx: Brief explanation`
- `# MISSING CLOSING BRACE for [block]`
- `# Too late! This runs after...`

## Severity Indicators

Use these consistently:
- `ERROR` - Will crash or break functionality
- `WARNING` - Likely bugs or bad practices
- `INFO` - Style suggestions
- `HINT` - Best practice recommendations
- `CRITICAL` - Can crash the game

## Writing Style

- **Be concise** - Get to the point quickly
- **Be specific** - Reference exact line numbers when helpful
- **Be educational** - Explain WHY, not just WHAT
- **Be consistent** - Follow the pattern throughout

## Example: Complete File with Pattern Applied

```paradox
# ===================================================================
# BAD TRIGGERS EXAMPLES
# ===================================================================
# This file demonstrates INCORRECT trigger usage that SHOULD FAIL validation.
# All examples in this file contain semantic errors.
#
# Error Codes Demonstrated:
# - CK3101: Unknown/invalid trigger keyword
# - CK3102: Effect used in trigger block
# - CK5137: is_alive check without exists check (crash risk)
#
# Expected validation result: ERRORS DETECTED
# ===================================================================

namespace = semantic_bad_triggers

# -------------------------------------------------------------------
# ERROR CK3101: Unknown trigger
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of invalid/nonexistent trigger keywords
# SHOULD FAIL: Yes - CK3101 errors for made-up triggers
# WHY IT'S BAD: These triggers don't exist in CK3
# HOW TO FIX: Use only valid CK3 trigger keywords
# -------------------------------------------------------------------
semantic_bad_triggers.0001 = {
	type = character_event
	title = semantic_bad_triggers.0001.t
	desc = semantic_bad_triggers.0001.desc

	trigger = {
		is_adult = yes
		is_super_powerful = yes # ERROR CK3101: Unknown trigger
		has_magic_powers = yes  # ERROR CK3101: Unknown trigger
	}

	option = {
		name = semantic_bad_triggers.0001.a
		add_gold = 100
	}
}

# -------------------------------------------------------------------
# ERROR CK3102: Effect used in trigger block
# -------------------------------------------------------------------
# WHAT THIS TESTS: Detection of effects in trigger-only contexts
# SHOULD FAIL: Yes - CK3102 errors for each effect
# WHY IT'S BAD: Triggers check conditions, effects modify state - can't mix
# HOW TO FIX: Move effects to immediate or option blocks
# -------------------------------------------------------------------
semantic_bad_triggers.0002 = {
	type = character_event
	title = semantic_bad_triggers.0002.t
	desc = semantic_bad_triggers.0002.desc

	trigger = {
		is_adult = yes
		add_gold = 100     # ERROR CK3102: Effect in trigger block
		add_prestige = 50  # ERROR CK3102: Effect in trigger block
	}

	option = {
		name = semantic_bad_triggers.0002.a
		add_piety = 50
	}
}
```

## Maintenance

When adding new examples:
1. Follow the established pattern exactly
2. Include all required fields
3. Test that the example actually triggers the error code
4. Update the file header if adding new error codes
5. Maintain consistency with existing examples

## Benefits of This Pattern

1. **Self-Documenting** - Examples explain themselves
2. **Educational** - Teaches best practices
3. **Testable** - Clear expectations for validation
4. **Maintainable** - Easy to update and extend
5. **Professional** - Production-quality documentation

---

*Last Updated: 2026-01-17*
*Pattern Version: 1.0*
