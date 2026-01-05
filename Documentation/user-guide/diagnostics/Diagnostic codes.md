# PyChivalry Diagnostic Codes Reference

This document provides a comprehensive reference of all diagnostic codes implemented in the PyChivalry CK3 Language Server. These codes help identify issues in your CK3 mod scripts and provide actionable guidance for fixes.

---

## Table of Contents

1. [Syntax Checks (CK3001-CK3002)](#syntax-checks-ck3001-ck3002)
2. [Semantic Checks (CK3101-CK3103)](#semantic-checks-ck3101-ck3103)
3. [Scope Checks (CK3201-CK3203)](#scope-checks-ck3201-ck3203)
4. [Style Checks (CK33xx)](#style-checks-ck33xx)
5. [Portrait & Animation Validation (CK3420-CK3422)](#portrait--animation-validation-ck3420-ck3422)
6. [Theme Validation (CK3430)](#theme-validation-ck3430)
7. [Description Validation (CK3440-CK3443)](#description-validation-ck3440-ck3443)
8. [Option Validation (CK3450-CK3456)](#option-validation-ck3450-ck3456)
9. [Trigger Extension Validation (CK3510-CK3513)](#trigger-extension-validation-ck3510-ck3513)
10. [After Block Validation (CK3520-CK3521)](#after-block-validation-ck3520-ck3521)
11. [Scope Timing Checks (CK3550-CK3555)](#scope-timing-checks-ck3550-ck3555)
12. [Localization Validation (CK3600-CK3604)](#localization-validation-ck3600-ck3604)
13. [AI Chance Validation (CK3610-CK3614)](#ai-chance-validation-ck3610-ck3614)
14. [Opinion Modifier Checks (CK3656)](#opinion-modifier-checks-ck3656)
15. [Event Structure Checks (CK3760-CK3769)](#event-structure-checks-ck3760-ck3769)
16. [Effect/Trigger Context Checks (CK3870-CK3875)](#effecttrigger-context-checks-ck3870-ck3875)
17. [List Iterator Checks (CK3976-CK3977)](#list-iterator-checks-ck3976-ck3977)
18. [Common Gotchas (CK51xx)](#common-gotchas-ck51xx)
19. [Summary Statistics](#summary-statistics)

---

## Syntax Checks (CK3001-CK3002)

**Module:** `diagnostics.py`

These checks validate basic syntax structure of CK3 scripts, catching bracket mismatches that would cause parse failures.

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
    # ERROR: Missing closing bracket for trigger block
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
# CK3101: Unknown trigger (typo)
trigger = {
    is_adlut = yes  # WARNING: Unknown trigger - did you mean 'is_adult'?
}

# CK3102: Effect in trigger block
trigger = {
    add_gold = 100  # ERROR: Effects cannot be used in trigger blocks
}

# CK3103: Unknown effect (typo)
immediate = {
    add_goldd = 100  # WARNING: Unknown effect - did you mean 'add_gold'?
}
```

---

## Scope Checks (CK3201-CK3203)

**Module:** `diagnostics.py`

These checks validate scope chains and scope references for validity.

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
| **CK3305** | Warning | **Block content not indented** - Content should be indented relative to parent block |
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
| **CK3308** | Hint | **Missing blank line** - Missing blank line between top-level blocks |

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
| **CK3332** | Error | **Brace mismatch** - Brace mismatch detected in block |

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

## Portrait & Animation Validation (CK3420-CK3422)

**Module:** `paradox_checks.py`

These checks validate portrait definitions, positions, and animations in events.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3420** | Error | **Invalid portrait position** - Portrait position not recognized (valid: `left_portrait`, `right_portrait`, `lower_left_portrait`, `lower_center_portrait`, `lower_right_portrait`) |
| **CK3421** | Warning | **Portrait missing character** - Portrait block lacks required `character` field |
| **CK3422** | Warning | **Invalid animation** - Animation name not recognized in valid animations list (251 animations loaded from `data/animations.yaml`) |

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

# CK3422: Invalid animation (251 animations loaded from data/animations.yaml)
my_event.3 = {
    left_portrait = {
        character = root
        animation = flying  # WARNING: Not a valid animation
    }
}

# Valid animations include: happiness, sadness, anger, thinking, personality_bold,
# aggressive_sword, throne_room_ruler, wedding_bride_left, and 243 more...
# See pychivalry/data/animations.yaml for the complete list.
```

---

## Theme Validation (CK3430)

**Module:** `paradox_checks.py`

Validates event theme declarations.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3430** | Warning | **Invalid theme** - Theme name not recognized in valid themes list (diplomacy, intrigue, martial, etc.) |

### Examples

```pdx
# CK3430: Invalid theme
my_event.4 = {
    theme = invalid_theme  # WARNING: Not a valid theme
}

# Valid themes include: diplomacy, intrigue, martial, stewardship, learning,
# family, religion, health, war, friendly, unfriendly, dread, death
```

---

## Description Validation (CK3440-CK3443)

**Module:** `paradox_checks.py`

Validates event description structures, including triggered_desc blocks.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3440** | Error | **triggered_desc missing trigger** - triggered_desc block requires `trigger` field |
| **CK3441** | Error | **triggered_desc missing desc** - triggered_desc block requires `desc` field |
| **CK3442** | Warning | **desc missing localization key** - desc used without localization reference |
| **CK3443** | Warning | **Empty desc block** - desc block has no content |

### Examples

```pdx
# CK3440-CK3441: triggered_desc validation
my_event.5 = {
    desc = {
        triggered_desc = {
            # ERROR CK3440: Missing 'trigger' field
            # ERROR CK3441: Missing 'desc' field
        }
    }
}

# Correct usage:
my_event.5 = {
    desc = {
        triggered_desc = {
            trigger = { is_female = yes }
            desc = my_event.5.desc_female
        }
        triggered_desc = {
            trigger = { is_male = yes }
            desc = my_event.5.desc_male
        }
    }
}

# CK3443: Empty desc block
my_event.6 = {
    desc = { }  # WARNING: Empty desc block
}
```

---

## Option Validation (CK3450-CK3456)

**Module:** `paradox_checks.py` and `diagnostics.py`

Validates event option structures and trait references.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3450** | Error | **Option missing name** - Option block lacks required `name` field for localization |
| **CK3451** | Warning | **Unknown trait referenced** - Trait name not recognized in valid traits list (requires extracted trait data) |
| **CK3453** | Warning | **Option with multiple names** - Option has multiple name parameters |
| **CK3456** | Warning | **Empty option block** - Option block has no content |

### Examples

```pdx
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

# CK3453: Multiple names
my_event.7 = {
    option = {
        name = my_event.7.a
        name = my_event.7.b  # WARNING: Multiple names
    }
}

# CK3456: Empty option
my_event.8 = {
    option = { }  # WARNING: Empty option block
}
```

---

## Trigger Extension Validation (CK3510-CK3513)

**Module:** `paradox_checks.py`

Validates proper usage of `trigger_if`, `trigger_else_if`, and `trigger_else` blocks.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3510** | Error | **trigger_else without trigger_if** - Missing preceding `trigger_if` block |
| **CK3511** | Error | **Multiple trigger_else blocks** - Only first `trigger_else` will execute |
| **CK3512** | Error | **trigger_if missing limit** - `trigger_if` requires a `limit` block |
| **CK3513** | Warning | **Empty trigger_if limit** - Condition always passes; limit block is empty |

### Examples

```pdx
# CK3510: trigger_else without trigger_if
my_event.1 = {
    trigger = {
        trigger_else = {  # ERROR: No preceding trigger_if
            is_adult = yes
        }
    }
}

# CK3511: Multiple trigger_else blocks
my_event.2 = {
    trigger = {
        trigger_if = {
            limit = { is_adult = yes }
        }
        trigger_else = { }
        trigger_else = { }  # ERROR: Only first trigger_else executes
    }
}

# CK3512: trigger_if missing limit
my_event.3 = {
    trigger = {
        trigger_if = {  # ERROR: Missing 'limit' block
            is_adult = yes
        }
    }
}

# CK3513: Empty trigger_if limit
my_event.4 = {
    trigger = {
        trigger_if = {
            limit = { }  # WARNING: Empty limit always passes
        }
    }
}
```

---

## After Block Validation (CK3520-CK3521)

**Module:** `paradox_checks.py`

Validates proper usage of `after` blocks in events.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3520** | Warning | **after block in hidden event** - Won't execute as expected; hidden events don't have player interaction |
| **CK3521** | Warning | **after block without options** - Won't execute; `after` requires options to trigger |

### Examples

```pdx
# CK3520: after in hidden event
my_event.1 = {
    hidden = yes
    after = {  # WARNING: Won't execute as expected in hidden event
        add_gold = 100
    }
}

# CK3521: after without options
my_event.2 = {
    type = character_event
    immediate = { add_gold = 50 }
    after = {  # WARNING: Won't execute without options
        add_prestige = 100
    }
    # No option blocks!
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
| **CK3555** | Warning | **Scope needed in triggered event but not passed** - Event triggered without passing required scope |

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

## Localization Validation (CK3600-CK3604)

**Module:** `localization.py`

These checks validate localization key usage, encoding, and naming conventions. Missing localization keys are one of the most common modding mistakes - they cause blank text in-game with no error message.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3600** | Warning | **Missing localization key** - Referenced key not found in loc files. Includes fuzzy matching suggestions for typos. |
| **CK3601** | Information | **Literal text usage** - Consider using localization key instead of literal string in title/desc/name fields. |
| **CK3602** | Warning | **Encoding issue** - Localization file not UTF-8-BOM encoded. CK3 requires this encoding. |
| **CK3603** | Hint | **Inconsistent key naming** - Key doesn't follow namespace.id.suffix pattern (e.g., `my_mod.0001.t`). |
| **CK3604** | Warning | **Unused localization key** - Key defined in loc file but never referenced (workspace-wide analysis). |

### Examples

```pdx
# CK3600: Missing localization key (with fuzzy suggestion)
my_event.0001 = {
    title = my_evnt.0001.t  # WARNING: Key not found. Did you mean 'my_event.0001.t'?
    desc = my_event.0001.desc
}

# CK3601: Literal text usage
my_event.0002 = {
    title = "My Event Title"  # INFO: Consider using localization key
    desc = "Some description"  # INFO: Consider using localization key
}

# CK3603: Inconsistent key naming
my_event.0003 = {
    title = random_key_name  # HINT: Doesn't follow namespace.id.suffix pattern
    desc = my_event.0003.desc  # OK
}
```

### Fuzzy Matching Features

CK3600 includes intelligent fuzzy matching to help catch common mistakes:

- **Typos**: `my_evnt.0001.t` → suggests `my_event.0001.t`
- **Wrong suffixes**: `my_event.0001.title` → suggests `my_event.0001.t` (CK3 uses `.t`)
- **Wrong suffixes**: `my_event.0001.description` → suggests `my_event.0001.desc`
- **Namespace matching**: Suggests keys from the same mod namespace
- **Prefix matching**: Suggests keys for the same event

---

## AI Chance Validation (CK3610-CK3614)

**Module:** `paradox_checks.py`

Validates AI weighting in event options and decisions.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3610** | Warning | **Negative base ai_chance** - AI will never select option unless modifiers bring it positive |
| **CK3611** | Information | **High base ai_chance** - Value over 100; heavily weights this option |
| **CK3612** | Warning | **Zero base ai_chance** - AI will never select option (no modifiers present) |
| **CK3614** | Information | **Modifier without trigger** - AI modifier applies unconditionally |

### Examples

```pdx
# CK3610: Negative base ai_chance
option = {
    name = my_event.a
    ai_chance = {
        base = -10  # WARNING: AI will never choose unless modifiers help
    }
}

# CK3612: Zero base without modifiers
option = {
    name = my_event.b
    ai_chance = {
        base = 0  # WARNING: AI will never choose this option
    }
}

# CK3614: Modifier without trigger
option = {
    name = my_event.c
    ai_chance = {
        base = 50
        modifier = {
            add = 25  # INFO: No trigger - always applies
        }
    }
}
```

---

## Opinion Modifier Checks (CK3656)

**Module:** `paradox_checks.py`

Validates proper usage of opinion modifiers.

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

## Event Structure Checks (CK3760-CK3769)

**Module:** `paradox_checks.py`

Validates event structure and required fields.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3760** | Error | **Missing event type** - Event lacks required `type` declaration |
| **CK3761** | Error | **Invalid event type** - Event type not recognized (valid: `character_event`, `letter_event`, `court_event`, `duel_event`, `feast_event`, `story_cycle`) |
| **CK3762** | Warning | **Hidden event with options** - Hidden events have option blocks, but options are ignored |
| **CK3763** | Warning | **No option blocks** - Event has no `option` blocks; player cannot interact with or dismiss it |
| **CK3764** | Warning | **Non-hidden event missing desc** - Event is not hidden but lacks `desc` field |
| **CK3766** | Error | **Multiple after blocks** - Event has multiple `after` blocks; only first will execute |
| **CK3767** | Warning | **Empty event block** - Event has no fields or content |
| **CK3768** | Error | **Multiple immediate blocks** - Event has multiple `immediate` blocks; only first executes |
| **CK3769** | Information | **Character event has no portraits** - Character event has no portrait positions defined |

### Examples

```pdx
# CK3760: Missing event type
my_event.1 = {
    # ERROR: Missing 'type = character_event'
    desc = my_event.1.desc
    option = { name = my_event.1.a }
}

# CK3761: Invalid event type
my_event.2 = {
    type = invalid_type  # ERROR: Not a valid event type
}

# CK3762: Hidden event with options
my_event.3 = {
    hidden = yes
    option = {  # WARNING: Options ignored in hidden events
        name = my_event.3.a
    }
}

# CK3763: No option blocks
my_event.4 = {
    type = character_event
    desc = my_event.4.desc
    immediate = { add_gold = 100 }
    # WARNING: No options - player cannot dismiss this event!
}

# CK3764: Missing desc in non-hidden event
my_event.5 = {
    type = character_event
    title = my_event.5.t
    # WARNING: Missing 'desc' field
}

# CK3766: Multiple after blocks
my_event.6 = {
    after = { add_gold = 100 }
    after = { add_prestige = 100 }  # ERROR: Only first 'after' executes
}

# CK3768: Multiple immediate blocks
my_event.7 = {
    immediate = { add_gold = 100 }  # This runs
    immediate = { add_prestige = 100 }  # ERROR: This is ignored!
}
```

---

## Effect/Trigger Context Checks (CK3870-CK3875)

**Module:** `paradox_checks.py`

Validates that effects and triggers are used in appropriate contexts.

| Code | Severity | Description |
|------|----------|-------------|
| **CK3870** | Error | **Effect in trigger block** - Effect command used in `trigger` block where only triggers allowed |
| **CK3871** | Error | **Effect in limit block** - Effect command used in `limit` block where only triggers allowed |
| **CK3872** | Information | **Redundant always=yes** - `trigger = { always = yes }` is redundant; remove the trigger block |
| **CK3873** | Warning | **Impossible always=no** - `trigger = { always = no }` makes the event impossible to fire |
| **CK3875** | Warning | **random_ without limit** - `random_*` iterator has no `limit`; selection is completely random |

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
```

---

## List Iterator Checks (CK3976-CK3977)

**Module:** `paradox_checks.py`

Validates proper usage of list iterators (`any_`, `every_`, `random_`, `ordered_`).

| Code | Severity | Description |
|------|----------|-------------|
| **CK3976** | Error | **Effect in any_ iterator** - `any_*` iterators are trigger-only; use `every_*` or `random_*` for effects |
| **CK3977** | Information | **every_ without limit** - `every_*` iterator without `limit` affects ALL entries; add limit or comment if intentional |

### Examples

```pdx
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

These checks catch common CK3 scripting mistakes and gotchas that can cause subtle bugs.

| Code | Severity | Description |
|------|----------|-------------|
| **CK5137** | Warning | **is_alive without exists** - Using `is_alive` without first checking `exists` can crash if target doesn't exist *(planned)* |
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

# CK5137: is_alive without exists (planned check)
trigger = {
    scope:target = {
        is_alive = yes  # WARNING: Will crash if scope:target doesn't exist
    }
}

# Safer:
trigger = {
    exists = scope:target
    scope:target = {
        is_alive = yes  # Safe: we know scope:target exists
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
| Style Checks | CK33xx | 15 | ✅ Implemented |
| Portrait Validation | CK3420-CK3422 | 3 | ✅ Implemented |
| Theme Validation | CK3430 | 1 | ✅ Implemented |
| Description Validation | CK3440-CK3443 | 4 | ✅ Implemented |
| Option Validation | CK3450-CK3456 | 4 | ✅ Implemented |
| Trigger Extensions | CK3510-CK3513 | 4 | ✅ Implemented |
| After Block Validation | CK3520-CK3521 | 2 | ✅ Implemented |
| Scope Timing | CK3550-CK3555 | 6 | ✅ Implemented |
| Localization Validation | CK3600-CK3604 | 5 | ✅ Implemented |
| AI Chance Validation | CK3610-CK3614 | 4 | ✅ Implemented |
| Opinion Modifiers | CK3656 | 1 | ✅ Implemented |
| Event Structure | CK3760-CK3769 | 9 | ✅ Implemented |
| Effect/Trigger Context | CK3870-CK3875 | 5 | ✅ Implemented |
| List Iterators | CK3976-CK3977 | 2 | ✅ Implemented |
| Common Gotchas | CK51xx | 1 | ✅ Partial (CK5142) |
| **Total Implemented** | | **~74** | |

---

## Diagnostic Severity Levels

PyChivalry uses standard LSP diagnostic severity levels:

| Severity | Visual | Description |
|----------|--------|-------------|
| **Error** | Red squiggle | Code will fail at runtime or behave incorrectly |
| **Warning** | Yellow squiggle | Code may have issues or deviate from best practices |
| **Information** | Blue squiggle | Suggestions for improvements |
| **Hint** | Faint dots | Minor style suggestions or optional optimizations |

---

## Configuration

Diagnostics can be configured via LSP settings. Categories can be enabled/disabled:

- `style_enabled` - CK33xx style checks
- `paradox_enabled` - CK35xx-CK52xx convention checks  
- `scope_timing_enabled` - CK3550-CK3555 timing checks
- `localization_enabled` - CK3600-CK3604 localization checks

---

## Other Diagnostic Code Categories

PyChivalry also uses additional diagnostic code prefixes for specialized validation. See the separate documentation for each:

| Document | Code Prefix | Description |
|----------|-------------|-------------|
| [Story Cycles](Diagnostic%20codes%20-%20Story%20Cycles.md) | `STORY-XXX` | Story cycle timing, effects, and lifecycle |
| [Decisions](Diagnostic%20codes%20-%20Decisions.md) | `DECISION-XXX` | Decision requirements and AI config |
| [Interactions](Diagnostic%20codes%20-%20Interactions.md) | `INTERACTION-XXX` | Character interaction validation |
| [Schemes](Diagnostic%20codes%20-%20Schemes.md) | `SCHEME-XXX` | Scheme configuration and agents |
| [On Actions](Diagnostic%20codes%20-%20On%20Actions.md) | `ON_ACTION-XXX` | On-action hooks and events |
| [Events](Diagnostic%20codes%20-%20Events.md) | `EVENT-XXX` | Event-type-specific validation |
| [Schema Validation](Diagnostic%20codes%20-%20Schema%20Validation.md) | `SCHEMA-XXX` | Pattern and type validation |
| [Internal](Diagnostic%20codes%20-%20Internal.md) | Various | Internal/debug codes |

---

## Related Documentation

- [Feature Matrix](../docs/feature_matrix.md) - Complete LSP feature documentation
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Guide for creating validation schemas
- [Validation Implementation Plan](../plan%20docs/workspace%20(current%20state)/IMPLEMENTATION_PLAN.md) - Roadmap for future checks
