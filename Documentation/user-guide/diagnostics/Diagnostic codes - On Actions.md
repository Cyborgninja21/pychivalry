# On-Action Diagnostic Codes (ON_ACTION-XXX)

This document covers diagnostic codes for **On-Action** validation in CK3 modding. On-actions are game hooks that fire events or effects when specific game events occur.

---

## Overview

On-actions are validated by the schema-driven validation system using `on_actions.yaml`. These checks ensure on-actions have content to execute.

**Module:** `schema_validator.py` with `on_actions.yaml` schema

---

## Validation Warnings

### ON_ACTION-001: Empty On-Action

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `On-action has no effects or events - does nothing` |

On-actions need either `effect`, `events`, or `random_events` to be useful.

```pdx
# ⚠️ ON_ACTION-001: Does nothing
on_birth_child = {
    # Empty - triggers on child birth but does nothing
}

# ✅ Correct - with effect
on_birth_child = {
    effect = {
        if = {
            limit = { is_firstborn = yes }
            add_trait = firstborn
        }
    }
}

# ✅ Correct - with events
on_birth_child = {
    events = {
        birth_events.0001
        birth_events.0002
    }
}

# ✅ Correct - with random_events
on_birth_child = {
    random_events = {
        100 = 0  # 100 weight for nothing
        10 = birth_events.0003
        5 = birth_events.0004
    }
}
```

---

### ON_ACTION-002: Empty Events List

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `On-action has empty events list` |

An `events` block with no events is useless.

```pdx
# ⚠️ ON_ACTION-002: Empty events
on_war_started = {
    events = {
        # No events listed!
    }
}

# ✅ Correct
on_war_started = {
    events = {
        war_events.0001
        war_events.0010
    }
}
```

---

### CK3500: Effect/Trigger Overwrite in Vanilla On-Action

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `Defining 'effect/trigger = {}' on vanilla on_action overwrites vanilla behavior` |

Defining `effect` or `trigger` directly on a vanilla on_action **overwrites** the game's behavior instead of appending to it. Use `events = {}` or `on_actions = {}` to append instead.

```pdx
# ⚠️ CK3500: Overwrites vanilla behavior
on_birth = {
    effect = {
        add_gold = 100
    }
}

# ✅ Correct - Appends via events
on_birth = {
    events = {
        my_mod.100
    }
}

# ✅ Correct - Appends via on_actions
on_birth = {
    on_actions = {
        my_custom_on_birth
    }
}
```

---

### CK3502: Invalid Delay Format

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | On-Actions |
| **Message** | `Invalid delay format - must be number or { days/months/years = X }` |

The `delay` field must be either a number (days) or a block with `days`, `months`, or `years`.

```pdx
# ❌ CK3502: Invalid delay
my_on_action = {
    events = { my_mod.100 }
    delay = invalid_value
}

# ❌ CK3502: Wrong time unit
my_on_action = {
    events = { my_mod.100 }
    delay = {
        weeks = 2  # 'weeks' is not valid
    }
}

# ✅ Correct - Numeric days
my_on_action = {
    events = { my_mod.100 }
    delay = 30
}

# ✅ Correct - Days block
my_on_action = {
    events = { my_mod.100 }
    delay = { days = 30 }
}

# ✅ Correct - Range
my_on_action = {
    events = { my_mod.100 }
    delay = { days = { 10 30 } }
}

# ✅ Correct - Months/Years
my_on_action = {
    events = { my_mod.100 }
    delay = { months = 3 }
}
```

---

### CK3503: N² Performance in Pulse On-Action

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `'every_living_character' in pulse on_action causes O(N²) performance` |

Pulse on_actions run frequently for many characters. Using iterators like `every_living_character` causes **quadratic complexity** which severely impacts performance.

```pdx
# ⚠️ CK3503: N² performance issue
yearly_playable_pulse = {
    effect = {
        every_living_character = {  # Runs for EVERY character, EVERY year
            add_prestige = 1
        }
    }
}

# ✅ Better - Limit scope
yearly_playable_pulse = {
    effect = {
        every_courtier = {  # Only your courtiers
            add_prestige = 1
        }
    }
}

# ✅ Best - Process only root
yearly_playable_pulse = {
    effect = {
        add_prestige = 1  # Only for the triggering character
    }
}
```

**Dangerous iterators in pulse on_actions:**
- `every_living_character`
- `every_ruler`
- `every_player`
- `every_independent_ruler`
- Any global scope iterator

---

### CK3506: Zero Weight Event

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `Event has weight 0 and will never fire` |

Events with weight 0 in `random_events` will never be selected.

```pdx
# ⚠️ CK3506: Will never fire
my_on_action = {
    random_events = {
        0 = my_mod.100     # Weight 0 = never fires
        50 = my_mod.101
    }
}

# ✅ Correct
my_on_action = {
    random_events = {
        25 = my_mod.100
        50 = my_mod.101
    }
}
```

---

### CK3507: chance_to_happen > 100

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `chance_to_happen is X but max is 100` |

`chance_to_happen` values above 100 are capped at 100%. Higher values are misleading.

```pdx
# ⚠️ CK3507: Misleading value
my_on_action = {
    events = { my_mod.100 }
    chance_to_happen = 150  # Capped at 100%
}

# ✅ Correct
my_on_action = {
    events = { my_mod.100 }
    chance_to_happen = 100
}

# ✅ Correct - Partial chance
my_on_action = {
    events = { my_mod.100 }
    chance_to_happen = 50  # 50% chance
}
```

---

### CK3508: Wrong Folder Path

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | On-Actions |
| **Message** | `File is in 'on_actions/' directory but should be in 'on_action/' (singular)` |

On-action files must be in `common/on_action/` (singular), not `common/on_actions/` (plural). Files in the wrong directory will not load.

```
❌ mod/common/on_actions/my_events.txt  # Wrong - plural
✅ mod/common/on_action/my_events.txt   # Correct - singular
```

---

### CK3501: Unknown On-Action Reference

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `Unknown on_action 'X' in fallback/reference` |

Referencing an on_action that doesn't exist (typo or removed) causes silent failures.

```pdx
# ⚠️ CK3501: Typo in fallback
my_on_action = {
    events = { my_mod.100 }
    fallback = on_birht  # Typo! Should be on_birth_child
}

# ⚠️ CK3501: Reference to removed on_action
legacy_system = {
    fallback = old_removed_on_action  # Doesn't exist anymore
}

# ✅ Correct - Valid vanilla on_action
my_on_action = {
    events = { my_mod.100 }
    fallback = on_birth_child  # Exists in vanilla
}

# ✅ Correct - Custom on_action defined in workspace
my_on_action_a = {
    fallback = my_on_action_b  # Defined elsewhere in mod
}
```

**What this catches:**
- Typos in on_action names
- References to on_actions removed in game updates
- Broken fallback chains
- Undefined custom on_actions

---

### CK3504: Circular Fallback Reference

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | On-Actions |
| **Message** | `Circular fallback detected: A → B → C → A` |

Circular fallback chains create infinite loops that hang or crash the game.

```pdx
# ⚠️ CK3504: Simple cycle (A → B → A)
on_action_a = {
    events = { my_mod.100 }
    fallback = on_action_b
}

on_action_b = {
    events = { my_mod.101 }
    fallback = on_action_a  # Cycle!
}

# ⚠️ CK3504: Self-reference (A → A)
my_on_action = {
    fallback = my_on_action  # Instant infinite loop!
}

# ⚠️ CK3504: Longer cycle (A → B → C → A)
morning_routine = { fallback = afternoon_routine }
afternoon_routine = { fallback = evening_routine }
evening_routine = { fallback = morning_routine }  # Cycle!

# ✅ Correct - Linear chain (no cycle)
on_action_a = {
    fallback = on_action_b
}

on_action_b = {
    fallback = on_action_c
}

on_action_c = {
    events = { final.event }
}

# ✅ Correct - Branching (no cycle)
on_action_a = { fallback = on_action_c }
on_action_b = { fallback = on_action_c }
on_action_c = { events = { shared.event } }
```

**Detection algorithm:** Uses depth-first search (DFS) to detect cycles in the fallback graph.

---

### CK3505: Missing Weight Multiplier

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | On-Actions |
| **Message** | `Event 'X' has no explicit weight in random_events` |

Events without explicit weights make probability calculations unclear. This is a code quality suggestion, not an error.

```pdx
# ℹ️ CK3505: Unclear probabilities
my_on_action = {
    random_events = {
        my_mod.100  # What weight?
        my_mod.101  # Equal probability?
    }
}

# ✅ Better - Explicit weights
my_on_action = {
    random_events = {
        50 = my_mod.100  # 50% chance
        30 = my_mod.101  # 30% chance
        20 = my_mod.102  # 20% chance
    }
}

# ✅ Also OK - Weighted with conditions
my_on_action = {
    random_events = {
        100 = {
            trigger = { is_adult = yes }
            my_mod.100
        }
        50 = my_mod.101
    }
}
```

**Why this matters:**
- Makes probability balancing easier
- Clearer for future maintainers
- Easier to tune event frequencies

**Note:** This is informational only - the game will still work, but explicit weights are best practice.

---

## Common On-Action Hooks

For reference, here are commonly used on-action hooks:

**Character Lifecycle:**
- `on_birth_child` - When a child is born
- `on_death` - When a character dies
- `on_marriage` - When characters marry
- `on_divorce` - When characters divorce

**Title Events:**
- `on_title_gain` - When gaining a title
- `on_title_lost` - When losing a title
- `on_realm_created` - When creating a realm

**War & Combat:**
- `on_war_started` - War declared
- `on_war_ended` - War concluded
- `on_battle_end` - Battle finished

**Periodic:**
- `yearly_playable_pulse` - Once per year for playable characters
- `monthly_council_pulse` - Monthly for council members

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **ON_ACTION-001** | Warning | No effects or events defined |
| **ON_ACTION-002** | Warning | Empty events list |
| **CK3500** | Warning | Effect/trigger overwrites vanilla on_action |
| **CK3501** | Warning | Unknown on_action reference |
| **CK3502** | Error | Invalid delay format |
| **CK3503** | Warning | N² performance issue in pulse on_action |
| **CK3504** | Warning | Circular fallback reference |
| **CK3505** | Information | Missing weight multiplier in random_events |
| **CK3506** | Warning | Zero weight event (never fires) |
| **CK3507** | Warning | chance_to_happen > 100 |
| **CK3508** | Error | Wrong folder path (on_actions/ vs on_action/) |

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
