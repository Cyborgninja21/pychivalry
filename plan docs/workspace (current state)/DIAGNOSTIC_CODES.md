# CK3 Language Server - Diagnostic Codes Reference

This document provides a comprehensive reference of all diagnostic codes implemented in the pychivalry CK3 Language Server.

---

## Table of Contents

1. [Syntax Checks (CK3001-CK3002)](#syntax-checks-ck3001-ck3002)
2. [Semantic Checks (CK3101-CK3103)](#semantic-checks-ck3101-ck3103)
3. [Scope Checks (CK3201-CK3203)](#scope-checks-ck3201-ck3203)
4. [Style Checks (CK33xx)](#style-checks-ck33xx)
5. [Event Validation - Phase 1 Quick Wins (CK3420-CK3450, CK3761-CK3769)](#event-validation---phase-1-quick-wins-ck3420-ck3450-ck3761-ck3769)
6. [Scope Timing Checks (CK3550-CK3555)](#scope-timing-checks-ck3550-ck3555)
7. [Opinion Modifier Checks (CK36xx)](#opinion-modifier-checks-ck36xx)
8. [Event Structure Checks (CK37xx)](#event-structure-checks-ck37xx)
9. [Effect/Trigger Context Checks (CK38xx)](#effecttrigger-context-checks-ck38xx)
10. [List Iterator Checks (CK39xx)](#list-iterator-checks-ck39xx)
11. [Common Gotchas (CK51xx)](#common-gotchas-ck51xx)

---

## Syntax Checks (CK3001-CK3002)

**Module:** `diagnostics.py`

These checks validate basic syntax structure of CK3 scripts.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3001** | Error | **Unmatched closing bracket** - A `}` was found with no corresponding opening `{` |
| **CK3002** | Error | **Unclosed bracket** - An opening `{` was found with no corresponding closing `}` |

### Examples

```pdx
# CK3001: Unmatched closing bracket
my_event.1 = {
    trigger = { is_adult = yes }
}
}  # ERROR: Extra closing bracket

# CK3002: Unclosed bracket
my_event.2 = {
    trigger = {
        is_adult = yes
    # ERROR: Missing closing bracket for trigger
}
```

---

## Semantic Checks (CK3101-CK3103)

**Module:** `diagnostics.py`

These checks validate semantic correctness of effects, triggers, and their usage contexts.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3101** | Warning | **Unknown trigger** - Trigger name not recognized in CK3 trigger list |
| **CK3102** | Error | **Effect in trigger block** - An effect command was used where only triggers are allowed |
| **CK3103** | Warning | **Unknown effect** - Effect name not recognized in CK3 effect list |

### Examples

```pdx
# CK3101: Unknown trigger
trigger = {
    is_adlut = yes  # WARNING: Unknown trigger (typo)
}

# CK3102: Effect in trigger block
trigger = {
    add_gold = 100  # ERROR: Effects cannot be used in trigger blocks
}

# CK3103: Unknown effect
immediate = {
    add_goldd = 100  # WARNING: Unknown effect (typo)
}
```

---

## Scope Checks (CK3201-CK3203)

**Module:** `diagnostics.py`

These checks validate scope chains and scope references.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3201** | Error | **Invalid scope chain** - Scope navigation path is invalid (e.g., `liege.invalid_link`) |
| **CK3202** | Warning | **Undefined saved scope** - Reference to `scope:xxx` that hasn't been defined with `save_scope_as` |
| **CK3203** | Warning | **Invalid list iteration base** - List base (e.g., `vassal` in `every_vassal`) not valid for current scope |

### Examples

```pdx
# CK3201: Invalid scope chain
liege.invalid_scope_link = {  # ERROR: 'invalid_scope_link' not valid from character
    add_gold = 100
}

# CK3202: Undefined saved scope
scope:my_target = {  # WARNING: 'my_target' not defined with save_scope_as
    add_gold = 100
}

# CK3203: Invalid list iteration
every_invalid_list = {  # WARNING: 'invalid_list' not a valid list in this scope
    add_gold = 100
}
```

---

## Style Checks (CK33xx)

**Module:** `style_checks.py`

These checks validate code style and formatting according to Paradox conventions.

### Indentation Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3301** | Warning | **Inconsistent indentation** - Content not indented at expected level |
| **CK3303** | Information | **Spaces instead of tabs** - Paradox convention prefers tabs for indentation |
| **CK3307** | Warning | **Closing brace misalignment** - Closing `}` doesn't match indentation of opening block |

### Statement Structure Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3302** | Warning | **Multiple statements on one line** - Multiple block assignments on single line reduces readability |

### Whitespace Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3304** | Hint | **Trailing whitespace** - Line has trailing spaces/tabs |
| **CK3306** | Information | **Inconsistent operator spacing** - Missing space around `=` operator |

### Block Structure Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3314** | Hint | **Empty block detected** - Block `{ }` with no content (may be intentional) |
| **CK3316** | Information | **Line exceeds length** - Line exceeds recommended 120 character limit |
| **CK3317** | Warning | **Deeply nested blocks** - Nesting depth exceeds 6 levels; consider refactoring |

### File Structure Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3325** | Warning | **Namespace not at top** - Namespace declaration should be at the beginning of file |

### Brace Mismatch Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3330** | Error | **Unclosed brace** - Opening `{` without matching closing `}` |
| **CK3331** | Error | **Extra closing brace** - Closing `}` without matching opening `{` |

### Scope Reference Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3340** | Warning | **Suspicious scope reference** - Possible typo in `scope:xxx` reference |
| **CK3341** | Warning | **Truncated scope reference** - Scope name appears too short (possible truncation) |

### Identifier Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3345** | Error | **Merged identifier** - Identifier appears to contain merged words (missing newline) |

### Examples

```pdx
# CK3301: Inconsistent indentation
my_event.1 = {
trigger = {  # WARNING: Should be indented
    is_adult = yes
}
}

# CK3302: Multiple statements on one line
my_event.2 = { type = character_event } my_event.3 = {  # WARNING

# CK3303: Spaces instead of tabs
my_event.4 = {
    trigger = {  # INFO: Using spaces, Paradox prefers tabs
        is_adult = yes
    }
}

# CK3307: Closing brace misalignment
my_event.5 = {
    trigger = {
        is_adult = yes
        }  # WARNING: Should align with 'trigger'
}

# CK3314: Empty block
my_event.6 = {
    effect = { }  # HINT: Empty block
}

# CK3325: Namespace not at top
my_event.1 = { }
namespace = my_events  # WARNING: Should be at top of file

# CK3345: Merged identifier
triggeradd_gold = 100  # ERROR: Missing newline between 'trigger' and 'add_gold'
```

---

## Event Validation - Phase 1 Quick Wins (CK3420-CK3450, CK3761-CK3769)

**Module:** `paradox_checks.py`

These checks validate CK3 event structure, options, portraits, animations, themes, and descriptions. All checks in this section were implemented in Phase 1 of the validation expansion.

### Portrait & Animation Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3420** | Error | **Invalid portrait position** - Portrait position name not recognized (valid: left_portrait, right_portrait, lower_left_portrait, lower_center_portrait, lower_right_portrait) |
| **CK3421** | Warning | **Portrait missing character** - Portrait block lacks required 'character' field |
| **CK3422** | Warning | **Invalid animation** - Animation name not recognized in valid animations list |

### Theme Validation

| Code | Severity | Description |
|------|----------|-------------|
| **CK3430** | Warning | **Invalid theme** - Theme name not recognized in valid themes list (diplomacy, intrigue, martial, etc.) |

### Dynamic Description Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3440** | Error | **triggered_desc missing trigger** - triggered_desc block requires 'trigger' field |
| **CK3441** | Error | **triggered_desc missing desc** - triggered_desc block requires 'desc' field |

### Option Validation

| Code | Severity | Description |
|------|----------|-------------|
| **CK3450** | Error | **Option missing name** - Option block lacks required 'name' field for localization |
| **CK3451** | Warning | **Invalid trait reference** - Trait name not recognized in valid traits list |

### Event Structure Checks

| Code | Severity | Description |
|------|----------|-------------|
| **CK3761** | Error | **Invalid event type** - Event type not recognized (valid: character_event, letter_event, court_event, duel_event, feast_event, story_cycle) |
| **CK3762** | Warning | **Hidden event with options** - Hidden events have option blocks, but options are ignored |
| **CK3764** | Warning | **Non-hidden event missing desc** - Event is not hidden but lacks 'desc' field |
| **CK3766** | Error | **Multiple after blocks** - Event has multiple 'after' blocks; only first will execute |
| **CK3767** | Warning | **Empty event block** - Event has no fields or content |
| **CK3769** | Information | **Character event has no portraits** - Character event has no portrait positions defined |

### Examples

```pdx
# CK3420: Invalid portrait position
my_event.1 = {
    center_portrait = root  # ERROR: Not a valid position
}

# CK3421: Portrait missing character
my_event.2 = {
    left_portrait = {
        animation = happiness  # WARNING: Missing 'character' field
    }
}

# CK3422: Invalid animation
my_event.3 = {
    left_portrait = {
        character = root
        animation = flying  # WARNING: Not a valid animation
    }
}

# CK3430: Invalid theme
my_event.4 = {
    theme = invalid_theme  # WARNING: Not a valid theme
}

# CK3440-CK3441: triggered_desc validation
my_event.5 = {
    desc = {
        triggered_desc = {
            # ERROR CK3440: Missing 'trigger' field
            # ERROR CK3441: Missing 'desc' field
        }
    }
}

# CK3450: Option missing name
my_event.6 = {
    option = {
        add_gold = 100  # ERROR: Missing 'name' field
    }
}

# CK3451: Invalid trait reference
my_event.6b = {
    option = {
        name = my_event.6b.a
        trigger = {
            has_trait = super_speed  # WARNING: Unknown trait
        }
        add_trait = awesomeness  # WARNING: Unknown trait
    }
}

# CK3761: Invalid event type
my_event.7 = {
    type = invalid_type  # ERROR: Not a valid event type
}

# CK3762: Hidden event with options
my_event.8 = {
    hidden = yes
    option = {  # WARNING: Options ignored in hidden events
        name = my_event.8.a
    }
}

# CK3764: Missing desc in non-hidden event
my_event.9 = {
    type = character_event
    title = my_event.9.t
    # WARNING: Missing 'desc' field
}

# CK3766: Multiple after blocks
my_event.10 = {
    after = { add_gold = 100 }
    after = { add_prestige = 100 }  # ERROR: Only first 'after' executes
}

# CK3767: Empty event
my_event.11 = {
    # WARNING: Event is empty
}

# CK3769: No portraits in character event
my_event.12 = {
    type = character_event
    # INFO: Consider adding portrait positions
}
```

---

## Scope Timing Checks (CK3550-CK3555)

**Module:** `scope_timing.py`

These checks validate the "Golden Rule" of CK3 event scripting: scopes created in `immediate` are NOT available in `trigger` or `desc` blocks because those are evaluated BEFORE `immediate` runs.

**Event Evaluation Order:**
1. `trigger = { }` — Evaluated FIRST
2. `desc = { }` — Triggers evaluated SECOND
3. `immediate = { }` — Runs THIRD (scopes created here)
4. Portraits — Displayed FOURTH (scopes now available)
5. Options — Rendered FIFTH (scopes available)

| Code | Severity | Description |
|------|----------|-------------|
| **CK3550** | Error | **Scope in trigger from immediate** - Using `scope:xxx` in trigger block, but scope is saved in immediate |
| **CK3551** | Warning | **Scope in desc from immediate** - Using `scope:xxx` in desc block, but scope is saved in immediate |
| **CK3552** | Error | **Scope in triggered_desc trigger** - Using `scope:xxx` in triggered_desc trigger, but scope is saved in immediate |
| **CK3553** | Error | **Variable checked before set** - Checking `var:xxx` in trigger, but variable is set in immediate |
| **CK3554** | Warning | **Temporary scope across events** - Using `save_temporary_scope_as` but triggering another event (scope won't persist) |

### Examples

```pdx
# CK3550: Scope in trigger from immediate
my_event.1 = {
    trigger = {
        scope:my_target = {  # ERROR: 'my_target' not available yet!
            is_adult = yes
        }
    }
    immediate = {
        random_courtier = {
            save_scope_as = my_target  # Defined HERE, after trigger evaluates
        }
    }
}

# CK3552: Scope in triggered_desc trigger
my_event.2 = {
    desc = {
        first_valid = {
            triggered_desc = {
                trigger = {
                    scope:target = { is_female = yes }  # ERROR: Scope not available
                }
                desc = my_event.2.desc.female
            }
        }
    }
    immediate = {
        save_scope_as = target  # Defined after desc triggers evaluate
    }
}

# CK3554: Temporary scope across events
my_event.3 = {
    immediate = {
        save_temporary_scope_as = temp_char  # Temporary scope
    }
    option = {
        trigger_event = other_event.1  # WARNING: temp_char won't exist in other_event
    }
}
```

---

## Opinion Modifier Checks (CK36xx)

**Module:** `paradox_checks.py`

These checks validate proper usage of opinion modifiers.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3656** | Error | **Inline opinion value** - Using `opinion = X` directly instead of referencing a predefined opinion modifier |

### Examples

```pdx
# CK3656: Inline opinion value
add_opinion = {
    target = scope:friend
    opinion = 50  # ERROR: Define modifier in common/opinion_modifiers/ and use 'modifier = your_modifier_name'
}

# Correct usage:
add_opinion = {
    target = scope:friend
    modifier = friendly_opinion  # References common/opinion_modifiers/friendly_opinion
}
```

---

## Event Structure Checks (CK37xx)

**Module:** `paradox_checks.py`

These checks validate event structure and required fields.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3760** | Error | **Missing event type** - Event lacks required `type` declaration |
| **CK3763** | Warning | **No option blocks** - Event has no `option` blocks; player cannot interact with or dismiss it |
| **CK3768** | Error | **Multiple immediate blocks** - Event has multiple `immediate` blocks; only the first executes |

### Examples

```pdx
# CK3760: Missing event type
my_event.1 = {
    # ERROR: Missing 'type = character_event'
    desc = my_event.1.desc
    option = { name = my_event.1.a }
}

# CK3763: No option blocks
my_event.2 = {
    type = character_event
    desc = my_event.2.desc
    immediate = { add_gold = 100 }
    # WARNING: No options - player cannot dismiss this event!
}

# CK3768: Multiple immediate blocks
my_event.3 = {
    type = character_event
    immediate = { add_gold = 100 }  # This runs
    immediate = { add_prestige = 100 }  # ERROR: This is ignored!
    option = { name = my_event.3.a }
}
```

---

## Effect/Trigger Context Checks (CK38xx)

**Module:** `paradox_checks.py`

These checks validate that effects and triggers are used in appropriate contexts.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3870** | Error | **Effect in trigger block** - Effect command used in `trigger` block where only triggers allowed |
| **CK3871** | Error | **Effect in limit block** - Effect command used in `limit` block where only triggers allowed |
| **CK3872** | Information | **Redundant always=yes** - `trigger = { always = yes }` is redundant; remove the trigger block |
| **CK3873** | Warning | **Impossible always=no** - `trigger = { always = no }` makes the event impossible to fire |

### Examples

```pdx
# CK3870: Effect in trigger block
my_event.1 = {
    trigger = {
        add_gold = 100  # ERROR: This is an effect, not a trigger!
    }
}

# CK3871: Effect in limit block
every_vassal = {
    limit = {
        add_trait = brave  # ERROR: Effects not allowed in limit
    }
    add_gold = 100
}

# CK3872: Redundant always=yes
my_event.2 = {
    trigger = {
        always = yes  # INFO: Just remove the entire trigger block
    }
}

# CK3873: Impossible always=no
my_event.3 = {
    trigger = {
        always = no  # WARNING: This event can never fire!
    }
}
```

---

## List Iterator Checks (CK39xx)

**Module:** `paradox_checks.py`

These checks validate proper usage of list iterators (`any_`, `every_`, `random_`, `ordered_`).

| Code | Severity | Description |
|------|----------|-------------|
| **CK3875** | Warning | **random_ without limit** - `random_*` iterator has no `limit`; selection is completely random |
| **CK3976** | Error | **Effect in any_ iterator** - `any_*` iterators are trigger-only; use `every_*` or `random_*` for effects |
| **CK3977** | Information | **every_ without limit** - `every_*` iterator without `limit` affects ALL entries; add limit or comment if intentional |

### Examples

```pdx
# CK3875: random_ without limit
random_courtier = {
    # WARNING: No limit - picks completely at random
    add_gold = 100
}

# Better:
random_courtier = {
    limit = { is_adult = yes }  # Filter candidates
    add_gold = 100
}

# CK3976: Effect in any_ iterator
any_vassal = {
    add_gold = 100  # ERROR: any_ is trigger-only!
}

# Should be:
every_vassal = {
    add_gold = 100  # Correct: every_ executes effects
}

# CK3977: every_ without limit
every_courtier = {
    # INFO: This affects ALL courtiers - is that intentional?
    add_gold = 1
}

# Better (if you want all):
every_courtier = {
    limit = { always = yes }  # Explicit: yes, we want all
    add_gold = 1
}
```

---

## Common Gotchas (CK51xx)

**Module:** `paradox_checks.py`

These checks catch common CK3 scripting mistakes and gotchas.

| Code | Severity | Description |
|------|----------|-------------|
| **CK5142** | Error | **Character comparison with =** - Using `scope:a = scope:b` instead of `scope:a = { this = scope:b }` |

### Examples

```pdx
# CK5142: Character comparison with =
trigger = {
    scope:person_a = scope:person_b  # ERROR: May not work as expected
}

# Correct:
trigger = {
    scope:person_a = {
        this = scope:person_b  # Correct character comparison
    }
}
```

---

## Summary Statistics

| Category | Code Range | Count | Status |
|----------|------------|-------|--------|
| Syntax Checks | CK3001-CK3002 | 2 | ✅ Implemented |
| Semantic Checks | CK3101-CK3103 | 3 | ✅ Implemented |
| Scope Checks | CK3201-CK3203 | 3 | ✅ Implemented |
| Style Checks | CK33xx | 13 | ✅ Implemented |
| Portrait Validation | CK3420-CK3422 | 3 | ✅ Implemented |
| Theme Validation | CK3430 | 1 | ✅ Implemented |
| Description Validation | CK3440-CK3441 | 2 | ✅ Implemented |
| Option Validation | CK3450-CK3451 | 2 | ✅ Implemented |
| Scope Timing | CK3550-CK3554 | 5 | ✅ Implemented |
| Opinion Modifiers | CK3656 | 1 | ✅ Implemented |
| Event Structure | CK3760-CK3769 | 9 | ✅ Implemented |
| Effect/Trigger Context | CK3870-CK3873 | 4 | ✅ Implemented |
| List Iterators | CK3875-CK3977 | 3 | ✅ Implemented |
| Common Gotchas | CK5142 | 1 | ✅ Implemented |
| **Total Implemented** | | **52** | |
| | | | |
| Namespace/ID Validation | CK3400-CK3406 | 7 | ⚠️ Planned (Phase 3) |
| Trigger Extensions | CK3510-CK3515 | 6 | ⚠️ Planned (Phase 4) |
| On Action Validation | CK3500-CK3508 | 9 | ⚠️ Planned (Phase 9) |
| After Block Validation | CK3520-CK3521 | 2 | ⚠️ Planned (Phase 11) |
| Localization Validation | CK3600-CK3603 | 4 | ⚠️ Planned (Phase 10) |
| AI Chance Validation | CK3610-CK3614 | 5 | ⚠️ Planned (Phase 12) |
| **Total Planned** | | **33** | |

---

## Implementation Status by Phase

### ✅ Completed Phases
- **Phase 1 (Quick Wins)**: 12 checks - All implemented
- **Phase 2 (Event Structure)**: 7 checks - All implemented

### 🔴 Remaining Phases
- **Phase 3 (Namespace & ID)**: 7 checks - Not started
- **Phase 4 (Trigger Extensions)**: 6 checks - Not started
- **Phase 5-12 (Advanced)**: 20+ checks - Not started

---

## Planned Checks (Future Implementation - Phases 3-12)

> **Note:** The following diagnostic codes are **NOT YET IMPLEMENTED**. They represent planned validation checks from the implementation roadmap.
> See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [VALIDATION_GAPS.md](VALIDATION_GAPS.md) for details.

### Namespace & ID Validation (CK3400-CK3403) - Phase 3

| Code | Severity | Description |
|------|----------|-------------|
| **CK3400** | Error | **Missing namespace declaration** - Event file lacks `namespace = ...` |
| **CK3401** | Warning | **Event ID namespace mismatch** - Event ID doesn't match declared namespace |
| **CK3402** | Warning | **Event ID exceeds 9999** - Event numbers should be under 9999 |
| **CK3403** | Error | **Invalid namespace characters** - Namespace contains invalid characters |

### Portrait Validation (CK3420-CK3422) - ✅ Phase 1 IMPLEMENTED

| Code | Severity | Description |
|------|----------|-------------|
| **CK3420** | Error | **Invalid portrait position** - Portrait position not valid (left_portrait, etc.) |
| **CK3421** | Warning | **Portrait missing character** - Portrait block lacks 'character' parameter |
| **CK3422** | Warning | **Invalid animation name** - Portrait animation not recognized |

### Theme & Background Validation (CK3430-CK3431) - ✅ Phase 1 IMPLEMENTED (CK3430 only)

| Code | Severity | Description |
|------|----------|-------------|
| **CK3430** | Warning | **Invalid theme** - Event theme not recognized |
| **CK3431** | Warning | **Invalid override_background** - Background not recognized |

### Description Validation (CK3440-CK3443) - ✅ Phase 1 IMPLEMENTED (CK3440-CK3441 only)

| Code | Severity | Description |
|------|----------|-------------|
| **CK3440** | Error | **triggered_desc missing trigger** - triggered_desc block lacks trigger |
| **CK3441** | Error | **triggered_desc missing desc** - triggered_desc block lacks desc |
| **CK3442** | Warning | **desc missing localization key** - desc used without localization reference |
| **CK3443** | Warning | **Empty desc block** - desc block has no content |

### Option Validation (CK3450-CK3456) - ✅ Phase 1 IMPLEMENTED (CK3450 only)

| Code | Severity | Description |
|------|----------|-------------|
| **CK3450** | Error | **Option missing name** - Option block lacks 'name' parameter |
| **CK3453** | Warning | **Option with multiple names** - Option has multiple name parameters |
| **CK3456** | Warning | **Empty option block** - Option block has no content |

### On Action Validation (CK3500-CK3508) - Phase 9

| Code | Severity | Description |
|------|----------|-------------|
| **CK3500** | Warning | **Effect/trigger block in on_action** - Use 'events' list instead |
| **CK3501** | Hint | **Unknown on_action name** - Possible typo in on_action name |
| **CK3502** | Error | **Invalid delay format** - Delay value not valid number or range |
| **CK3503** | Warning | **every_character in pulse** - Performance warning |
| **CK3505** | Info | **Missing weight_multiplier** - Random event entry missing weight |
| **CK3506** | Warning | **Zero weight event** - Event will never be selected |
| **CK3507** | Warning | **chance_to_happen > 100** - Value will be clamped |
| **CK3508** | Warning | **Wrong file path** - on_action vs on_actions folder |

### Trigger Extension Validation (CK3510-CK3513) - Phase 4

| Code | Severity | Description |
|------|----------|-------------|
| **CK3510** | Error | **trigger_else without trigger_if** - Missing preceding trigger_if |
| **CK3511** | Error | **Multiple trigger_else blocks** - Only first will execute |
| **CK3512** | Error | **trigger_if missing limit** - trigger_if requires limit block |
| **CK3513** | Warning | **Empty trigger_if limit** - Condition always passes |

### After Block Validation (CK3520-CK3521) - Phase 11

| Code | Severity | Description |
|------|----------|-------------|
| **CK3520** | Warning | **after block in hidden event** - Won't execute |
| **CK3521** | Warning | **after block without options** - Won't execute |

### Localization Validation (CK3601-CK3603) - Phase 10

| Code | Severity | Description |
|------|----------|-------------|
| **CK3601** | Info | **Literal text usage** - Consider using localization key |
| **CK3603** | Hint | **Inconsistent key naming** - Doesn't follow namespace.id.element pattern |

### AI Chance Validation (CK3610-CK3614) - Phase 12

| Code | Severity | Description |
|------|----------|-------------|
| **CK3610** | Warning | **Negative base ai_chance** - AI will never select option |
| **CK3614** | Info | **Modifier without trigger** - Applies unconditionally |

### Event Structure Validation (CK3760-CK3769) - ✅ Phase 1 & 2 IMPLEMENTED

| Code | Severity | Description |
|------|----------|-------------|
| **CK3760** | Warning | **Event missing type** - No type declaration |
| **CK3761** | Error | **Invalid event type** - Type not recognized |
| **CK3762** | Warning | **Hidden event with options** - Options ignored |
| **CK3764** | Warning | **Missing desc in non-hidden** - Event needs description |
| **CK3766** | Warning | **Multiple after blocks** - Only first executes |
| **CK3767** | Warning | **Empty event block** - Event has no content |
| **CK3768** | Warning | **Multiple immediate blocks** - Only first executes |
| **CK3769** | Info | **No portraits** - Consider adding portraits |

---

## Configuration

Diagnostics can be enabled/disabled via the `DiagnosticConfig` class in `diagnostics.py`:

```python
@dataclass
class DiagnosticConfig:
    style_enabled: bool = True          # CK33xx checks
    paradox_enabled: bool = True        # CK35xx-CK52xx checks
    scope_timing_enabled: bool = True   # CK3550-CK3555 checks
```

---

## See Also

- [VALIDATION.md](parts/VALIDATION.md) - Detailed validation documentation
- [VALIDATION_GAPS.md](parts/VALIDATION_GAPS.md) - Proposed future checks
- [CK3_EVENT_MODDING.md](parts/CK3_EVENT_MODDING.md) - CK3 modding reference
