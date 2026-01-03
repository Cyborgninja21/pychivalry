# Story Cycle Diagnostic Codes (STORY-XXX)

This document covers diagnostic codes for **Story Cycle** validation in CK3 modding. Story cycles are long-running background processes that track narrative arcs over time.

---

## Overview

Story cycles are validated by the schema-driven validation system using `story_cycles.yaml`. These checks ensure story cycles have proper timing, effect groups, and lifecycle handlers.

**Module:** `schema_validator.py` with `story_cycles.yaml` schema

---

## Structure Validation

### STORY-001: Effect Group Missing Timing

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Story Cycles |
| **Message** | `effect_group missing timing keyword (days/months/years)` |

Effect groups must specify when they fire using `days`, `months`, or `years`.

```pdx
# ❌ STORY-001: Missing timing
my_story = {
    effect_group = {
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}

# ✅ Correct
my_story = {
    effect_group = {
        days = 30
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_gold = 100 }
        }
    }
}
```

---

### STORY-004: Multiple Timing Keywords

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Story Cycles |
| **Message** | `Multiple timing keywords in effect_group (use only one of days/months/years)` |

Only one timing keyword is allowed per effect_group.

```pdx
# ❌ STORY-004: Multiple timing keywords
effect_group = {
    days = 30
    months = 1  # ERROR: Can't have both
    triggered_effect = { ... }
}
```

---

### STORY-005: triggered_effect Missing Trigger

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Story Cycles |
| **Message** | `triggered_effect missing required 'trigger' block` |

```pdx
# ❌ STORY-005: Missing trigger
triggered_effect = {
    effect = { add_gold = 100 }
    # Missing trigger block!
}

# ✅ Correct
triggered_effect = {
    trigger = { gold >= 100 }
    effect = { add_gold = 100 }
}
```

---

### STORY-006: triggered_effect Missing Effect

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Story Cycles |
| **Message** | `triggered_effect missing required 'effect' block` |

```pdx
# ❌ STORY-006: Missing effect
triggered_effect = {
    trigger = { is_adult = yes }
    # Missing effect block!
}
```

---

### STORY-007: No Effect Groups

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Story Cycles |
| **Message** | `Story cycle has no effect_group blocks (does nothing)` |

A story cycle without effect_groups serves no purpose.

```pdx
# ❌ STORY-007: No effect_group
my_story = {
    on_setup = { ... }
    on_end = { ... }
    # No effect_group blocks!
}
```

---

## Lifecycle Validation

### STORY-020: Missing on_owner_death Handler

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Story Cycles |
| **Message** | `Story lacks on_owner_death handler (may persist indefinitely)` |

Stories should handle owner death to prevent orphaned stories.

```pdx
# ⚠️ STORY-020: No death handler
my_story = {
    effect_group = { ... }
    # Missing on_owner_death!
}

# ✅ Correct
my_story = {
    on_owner_death = {
        scope:story = { end_story = yes }
    }
    effect_group = { ... }
}
```

---

### STORY-022: Effect Group Without Trigger

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Story Cycles |
| **Message** | `effect_group without trigger fires unconditionally every interval` |

Effect groups without conditions fire every time period. This may be intentional but is often an oversight.

```pdx
# ⚠️ STORY-022: No trigger - fires every 30 days
effect_group = {
    days = 30
    triggered_effect = {
        # No trigger block - always fires
        effect = { add_gold = 100 }
    }
}
```

---

### STORY-025: Trigger Without triggered_effect

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Story Cycles |
| **Message** | `effect_group has trigger but no triggered_effect blocks` |

---

### STORY-027: Mixing triggered_effect and first_valid

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Story Cycles |
| **Message** | `Mixing triggered_effect and first_valid in same effect_group is confusing` |

Choose one pattern per effect_group for clarity.

---

## Chance Validation

### STORY-023: Chance Exceeds 100%

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Story Cycles |
| **Message** | `chance value ({value}) exceeds 100%` |

```pdx
# ⚠️ STORY-023: Over 100%
triggered_effect = {
    chance = 150  # WARNING
    trigger = { ... }
    effect = { ... }
}
```

---

### STORY-024: Zero or Negative Chance

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Story Cycles |
| **Message** | `chance value ({value}) is 0 or negative (effect never fires)` |

```pdx
# ⚠️ STORY-024: Never fires
triggered_effect = {
    chance = 0  # WARNING
    trigger = { ... }
    effect = { ... }
}
```

---

## Setup/End Block Validation

### STORY-040: Empty on_setup Block

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Story Cycles |
| **Message** | `on_setup block is empty - consider initialization logic` |

---

### STORY-041: Empty on_end Block

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Story Cycles |
| **Message** | `on_end block is empty - consider cleanup logic` |

---

## Performance Hints

### STORY-043: Very Short Interval

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Story Cycles |
| **Message** | `Very short interval ({value} days) - may impact performance` |

Intervals under ~7 days can impact game performance if the story is common.

---

### STORY-044: Very Long Interval

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Story Cycles |
| **Message** | `Very long interval ({value} years) - player may not experience this` |

Intervals over 10+ years may never fire during a typical playthrough.

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **STORY-001** | Error | Effect group missing timing keyword |
| **STORY-004** | Error | Multiple timing keywords |
| **STORY-005** | Error | triggered_effect missing trigger |
| **STORY-006** | Error | triggered_effect missing effect |
| **STORY-007** | Error | No effect_group blocks |
| **STORY-020** | Warning | Missing on_owner_death handler |
| **STORY-022** | Warning | Effect group fires unconditionally |
| **STORY-023** | Warning | Chance exceeds 100% |
| **STORY-024** | Warning | Zero/negative chance |
| **STORY-025** | Warning | Trigger without triggered_effect |
| **STORY-027** | Warning | Mixing triggered_effect and first_valid |
| **STORY-040** | Info | Empty on_setup block |
| **STORY-041** | Info | Empty on_end block |
| **STORY-043** | Info | Very short interval |
| **STORY-044** | Info | Very long interval |

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
