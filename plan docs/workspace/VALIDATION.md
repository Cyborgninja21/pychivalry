# CK3 Language Server Validation Reference

This document describes all validation checks performed by the CK3 Language Server as you type. Diagnostics are organized by category with their diagnostic codes for easy reference.

## Table of Contents

- [1. Syntax Validation](#1-syntax-validation-ck3001-ck3002-ck3330-ck3345)
- [2. Semantic Validation](#2-semantic-validation-ck3101-ck3103)
- [3. Scope Validation](#3-scope-validation-ck3201-ck3203)
- [4. Style Validation](#4-style-validation-ck33xx)
- [5. Paradox Convention Validation](#5-paradox-convention-validation-ck35xx-ck52xx)
- [6. Scope Timing Validation](#6-scope-timing-validation-ck3550-ck3555)
- [Configuration](#configuration)

---

## 1. Syntax Validation (CK3001-CK3002, CK3330-CK3345)

Basic syntax checks for bracket matching and structural issues.

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3001** | Error | Unmatched closing bracket | Detects `}` without a corresponding opening `{` |
| **CK3002** | Error | Unclosed bracket | Detects `{` without closing `}`, with context about which block is unclosed |
| **CK3330** | Error | Unclosed brace | More `{` than `}` in the document |
| **CK3331** | Error | Extra closing brace | More `}` than `{` in the document |
| **CK3332** | Error | Brace mismatch | Braces don't balance within blocks |
| **CK3345** | Error | Merged identifier | Detects accidentally merged text (e.g., `cildanimation` instead of `child` and `animation` on separate lines) |

### Parser Tokenization

The parser tokenizes CK3 scripts into the following token types:

- **Identifiers**: Keywords, names, scope references (e.g., `trigger`, `add_gold`, `scope:target`)
- **Operators**: `=`, `>`, `<`, `>=`, `<=`, `!=`, `==`
- **Strings**: Quoted text with escape handling (e.g., `"my_string"`)
- **Numbers**: Integers and decimals, including negative numbers (e.g., `100`, `-50`, `3.14`)
- **Braces**: `{` and `}`
- **Comments**: Lines starting with `#`

---

## 2. Semantic Validation (CK3101-CK3103)

Validates that effects and triggers are used in the correct contexts.

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3101** | Warning | Unknown trigger | Trigger in trigger block not recognized in known triggers or custom scripted triggers |
| **CK3102** | Error | Effect in trigger block | Effects (state-changing commands) used where only triggers (conditions) are allowed |
| **CK3103** | Warning | Unknown effect | Effect in effect block not recognized in known effects or custom scripted effects |

### Context-Aware Validation

The semantic checker tracks the current context as it traverses the AST:

- **Trigger context**: Inside `trigger = { }`, `limit = { }`, `is_shown = { }`, `is_valid = { }` blocks
- **Effect context**: Inside `effect = { }`, `immediate = { }`, `option = { }` blocks

### What Gets Validated

1. **Known effects and triggers**: Checked against the built-in CK3 language definitions
2. **Custom scripted effects/triggers**: Loaded from workspace index (cross-file validation)
3. **Effect parameters**: Validates parameters like `target`, `modifier`, `opinion`, `years` for effects like `add_opinion`
4. **Control flow keywords**: `if`, `else_if`, `else`, `AND`, `OR`, `NOT` are allowed in any context

### Example Errors

```
# CK3102: Effect in trigger block
trigger = {
    add_gold = 100  # ERROR: add_gold is an effect, not a trigger
}

# CK3101: Unknown trigger
trigger = {
    my_typo_trigger = yes  # WARNING: Unknown trigger
}
```

---

## 3. Scope Validation (CK3201-CK3203)

Validates scope chains, saved scope references, and list iterations.

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3201** | Error | Invalid scope chain | Validates chains like `liege.primary_title.holder` against scope definitions |
| **CK3202** | Warning | Undefined saved scope | References to `scope:xxx` where `xxx` was never saved with `save_scope_as` |
| **CK3203** | Warning | Invalid list base | List iteration (e.g., `every_xxx`) uses invalid base for current scope type |

### Scope System Features

#### Universal Links (Available in All Scopes)
- `root` - The character who initiated the current script/event chain
- `this` - Current scope (usually implicit)
- `prev` - The previous scope before the last scope change
- `from` - The scope passed from the calling context
- `fromfrom` - The scope two levels up in the calling chain

#### Scope-Specific Links
Loaded from YAML definition files in `pychivalry/data/scopes/`:
- `character.yaml` - Character scope links (liege, spouse, father, mother, etc.)
- `title.yaml` - Title scope links (holder, de_jure_liege, etc.)
- `province.yaml` - Province scope links (county, barony, etc.)

#### Scope Chain Validation
The validator tracks resulting scope types through chains:

```
character.liege         → character
character.primary_title → landed_title
landed_title.holder     → character
```

### Example Errors

```
# CK3201: Invalid scope chain
liege.invalid_link.holder = { }  # ERROR: 'invalid_link' not valid from character scope

# CK3202: Undefined saved scope
scope:my_target = { }  # WARNING: 'my_target' never defined with save_scope_as

# CK3203: Invalid list base
every_invalid_list = { }  # WARNING: 'invalid_list' not a valid list for this scope
```

---

## 4. Style Validation (CK33xx)

Non-semantic validation focused on code style and formatting.

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3301** | Warning | Inconsistent indentation | Indentation doesn't match expected level |
| **CK3302** | Warning | Multiple statements | Multiple block assignments on one line |
| **CK3303** | Information | Spaces vs tabs | Uses spaces when tabs are preferred (Paradox convention) |
| **CK3304** | Hint | Trailing whitespace | Whitespace at end of lines |
| **CK3305** | Warning | Content not indented | Block content not indented relative to parent |
| **CK3306** | Information | Operator spacing | Inconsistent spacing around `=` operator |
| **CK3307** | Warning | Brace alignment | Closing brace doesn't match opening indentation |
| **CK3308** | Information | Missing blank line | Missing blank line between top-level blocks |
| **CK3314** | Hint | Empty block | Empty `key = { }` detected |
| **CK3316** | Information | Line too long | Line exceeds 120 characters |
| **CK3317** | Warning | Deep nesting | Block nesting exceeds 6 levels |
| **CK3325** | Warning | Namespace position | `namespace` declaration not at top of file |
| **CK3340** | Warning | Suspicious scope reference | Unknown `scope:xxx` with typo detection |
| **CK3341** | Warning | Truncated scope | Very short scope name (≤2 chars) |

### Style Conventions

The style checker follows Paradox modding conventions:

1. **Indentation**: Tabs preferred over spaces
2. **Operator spacing**: `key = value` with spaces around `=`
3. **Brace alignment**: Closing `}` should align with opening line
4. **Line length**: Maximum 120 characters recommended
5. **Nesting depth**: Maximum 6 levels recommended

### Example Warnings

```
# CK3303: Spaces instead of tabs
    trigger = { }  # INFO: Indentation uses spaces instead of tabs

# CK3306: Inconsistent operator spacing
key=value  # INFO: Use 'key = value' with spaces

# CK3317: Deep nesting
if = { if = { if = { if = { if = { if = { if = {
    # WARNING: Deeply nested block (depth 7)
} } } } } } }
```

---

## 5. Paradox Convention Validation (CK35xx-CK52xx)

Validates CK3 scripts against Paradox modding conventions and common pitfalls.

### Effect/Trigger Context Violations (CK38xx)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3870** | Error | Effect in trigger block | Effect used in trigger context |
| **CK3871** | Error | Effect in limit block | Effect used in `limit` block |
| **CK3872** | Information | Redundant trigger | `trigger = { always = yes }` is redundant - remove the trigger block |
| **CK3873** | Warning | Impossible trigger | `trigger = { always = no }` makes event impossible to fire |

### List Iterator Misuse (CK39xx)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3875** | Warning | Missing limit in random_ | `random_` iterator without `limit` - selection is completely random |
| **CK3976** | Error | Effect in any_ | Effects in `any_*` iterators (trigger-only) |
| **CK3977** | Information | every_ without limit | `every_*` affecting all entries without filter |

### Opinion Modifier Issues (CK36xx)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3656** | Error | Inline opinion value | Using `opinion = X` instead of predefined modifier (CW262) |

### Event Structure Validation (CK37xx)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3760** | Error | Missing event type | Event lacks `type = character_event` declaration |
| **CK3763** | Warning | Event no options | Event has no `option` blocks for player interaction |
| **CK3768** | Error | Multiple immediate blocks | Only first `immediate` block executes |

### Common CK3 Gotchas (CK51xx)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK5137** | Warning | is_alive without exists | Checking `is_alive` on scope that might not exist |
| **CK5142** | Error | Character comparison | Using `scope:a = scope:b` instead of `scope:a = { this = scope:b }` |

### Example Errors

```
# CK3976: Effect in any_ iterator
any_vassal = {
    add_gold = 100  # ERROR: any_* is trigger-only; use every_* or random_*
}

# CK3656: Inline opinion value
add_opinion = {
    target = scope:friend
    opinion = 50  # ERROR: Define modifier in common/opinion_modifiers/
}

# CK5142: Character comparison
scope:actor = scope:recipient  # ERROR: Use scope:actor = { this = scope:recipient }
```

---

## 6. Scope Timing Validation (CK3550-CK3555)

Validates the **"Golden Rule"** of CK3 event scripting: scopes created in `immediate` are NOT available in `trigger` or `desc` blocks because those blocks are evaluated BEFORE `immediate` runs.

### Event Evaluation Order

```
1. trigger = { }     ← Evaluated FIRST
2. desc = { }        ← Triggers evaluated SECOND
3. immediate = { }   ← Runs THIRD (scopes created here)
4. portraits         ← Displayed FOURTH (scopes now available)
5. options           ← Rendered FIFTH (scopes available)
```

### Timing Diagnostics

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **CK3550** | Error | Scope in trigger from immediate | Using `scope:xxx` in `trigger` but defined in `immediate` |
| **CK3551** | Warning | Scope in desc from immediate | Using scope in `desc` defined in `immediate` |
| **CK3552** | Error | Scope in triggered_desc from immediate | Using scope in `triggered_desc` trigger from `immediate` |
| **CK3553** | Error | Variable timing | Checking variable in `trigger` that's set in `immediate` |
| **CK3554** | Warning | Temporary scope persistence | `save_temporary_scope_as` won't persist to triggered events |
| **CK3555** | Warning | Scope not passed | Scope needed in triggered event but not passed |

### Example Errors

```
my_event.0001 = {
    trigger = {
        scope:my_target = { is_alive = yes }  # ERROR: CK3550
        # 'my_target' doesn't exist yet - trigger runs BEFORE immediate!
    }
    
    immediate = {
        random_courtier = {
            save_scope_as = my_target  # Scope defined here
        }
    }
    
    option = {
        scope:my_target = { add_gold = 100 }  # OK - options run AFTER immediate
    }
}
```

### Correct Pattern

```
# Pass scope from calling event:
trigger_event = {
    id = my_event.0001
    saved_scope = my_target  # Pass the scope
}

# Or use variables that persist:
immediate = {
    set_variable = { name = has_target value = yes }
}
trigger = {
    has_variable = has_target  # Variables work in triggers
}
```

---

## Configuration

All validation categories can be enabled/disabled programmatically:

```python
from pychivalry.diagnostics import DiagnosticConfig, collect_all_diagnostics

config = DiagnosticConfig(
    style_enabled=True,        # CK33xx checks
    paradox_enabled=True,      # CK35xx-CK52xx checks
    scope_timing_enabled=True  # CK3550-CK3555 checks
)

diagnostics = collect_all_diagnostics(doc, ast, index, config)
```

### Trait Validation

Trait validation requires user-extracted data:

```python
from pychivalry.traits import is_trait_data_available, is_valid_trait

if is_trait_data_available():
    # Trait data extracted - can validate trait references
    if not is_valid_trait('brave'):
        # Emit diagnostic for unknown trait
        pass
else:
    # Gracefully skip trait validation
    pass
```

Users extract trait data via VS Code command: **"CK3: Extract Trait Data from CK3 Installation"**

See: [Enhanced Trait System](../../README.md#trait-validation-opt-in) for details on:
- 15+ extracted property types (skills, opinions, modifiers, XP gains, costs, flags)
- 10+ query functions for programmatic access
- Rich tooltip display in completions

### Individual Module Configurations

#### Style Configuration
```python
from pychivalry.style_checks import StyleConfig

style_config = StyleConfig(
    indentation=True,
    prefer_tabs=True,
    multiple_statements=True,
    trailing_whitespace=True,
    operator_spacing=True,
    brace_alignment=True,
    max_line_length=120,
    max_nesting_depth=6,
    check_empty_blocks=True,
    check_namespace_position=True
)
```

#### Paradox Convention Configuration
```python
from pychivalry.paradox_checks import ParadoxConfig

paradox_config = ParadoxConfig(
    effect_trigger_context=True,
    list_iterators=True,
    opinion_modifiers=True,
    event_structure=True,
    common_gotchas=True,
    redundant_triggers=True
)
```

#### Scope Timing Configuration
```python
from pychivalry.scope_timing import ScopeTimingConfig

timing_config = ScopeTimingConfig(
    check_trigger_block=True,
    check_desc_block=True,
    check_triggered_desc=True,
    check_variables=True,
    check_temporary_scopes=True
)
```

---

## Diagnostic Code Summary

| Range | Category | Module |
|-------|----------|--------|
| CK3001-CK3002 | Syntax (brackets) | `diagnostics.py` |
| CK3101-CK3103 | Semantic (effects/triggers) | `diagnostics.py` |
| CK3201-CK3203 | Scope validation | `diagnostics.py` |
| CK3301-CK3345 | Style/formatting | `style_checks.py` |
| CK3550-CK3555 | Scope timing | `scope_timing.py` |
| CK3656 | Opinion modifiers | `paradox_checks.py` |
| CK3760-CK3768 | Event structure | `paradox_checks.py` |
| CK3870-CK3875 | Effect/trigger context | `paradox_checks.py` |
| CK3976-CK3977 | List iterators | `paradox_checks.py` |
| CK5137-CK5142 | Common gotchas | `paradox_checks.py` |
