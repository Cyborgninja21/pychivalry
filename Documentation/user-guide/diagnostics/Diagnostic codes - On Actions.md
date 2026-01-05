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

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
