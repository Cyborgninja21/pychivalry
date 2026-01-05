# Decision Diagnostic Codes (DECISION-XXX)

This document covers diagnostic codes for **Decision** validation in CK3 modding. Decisions are player-triggered actions that appear in the decision menu.

---

## Overview

Decisions are validated by the schema-driven validation system using `decisions.yaml`. These checks ensure decisions have required fields and sensible AI configuration.

**Module:** `schema_validator.py` with `decisions.yaml` schema

---

## Required Fields

### DECISION-001: Missing ai_check_interval

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Decisions |
| **Message** | `Decision missing 'ai_check_interval' - AI will never consider this decision` |

AI-usable decisions need `ai_check_interval` to specify how often AI evaluates them.

```pdx
# ❌ DECISION-001: AI can't use this
my_decision = {
    is_shown = { is_ruler = yes }
    is_valid = { gold >= 100 }
    effect = { add_prestige = 50 }
    # Missing ai_check_interval!
}

# ✅ Correct
my_decision = {
    ai_check_interval = 12  # Check every 12 months
    is_shown = { is_ruler = yes }
    is_valid = { gold >= 100 }
    effect = { add_prestige = 50 }
    ai_will_do = {
        base = 10
    }
}
```

---

### DECISION-002: Missing Effect Block

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Decisions |
| **Message** | `Decision missing 'effect' block - decision does nothing` |

Decisions without effects serve no gameplay purpose.

```pdx
# ❌ DECISION-002: Does nothing
my_decision = {
    is_shown = { is_ruler = yes }
    is_valid = { gold >= 100 }
    # Missing effect block!
}

# ✅ Correct
my_decision = {
    is_shown = { is_ruler = yes }
    is_valid = { gold >= 100 }
    effect = {
        add_gold = -100
        add_prestige = 200
    }
}
```

---

## Validation Warnings

### DECISION-003: No Visibility/Validity Checks

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Decisions |
| **Message** | `Decision has no is_shown or is_valid - always visible and available` |

Decisions without restrictions are visible to everyone, always. This may be intentional for universal decisions but is often an oversight.

```pdx
# ℹ️ DECISION-003: Always available
my_decision = {
    effect = {
        add_gold = 1000
    }
    # No is_shown or is_valid - everyone can use!
}

# ✅ Better - restricted
my_decision = {
    is_shown = {
        is_ruler = yes
        highest_held_title_tier >= tier_county
    }
    is_valid = {
        gold >= 500
    }
    effect = {
        add_gold = -500
        add_prestige = 200
    }
}
```

---

### DECISION-004: Effects Without Cost or Restriction

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Decisions |
| **Message** | `Decision has effects but no cost or validity check - may be exploitable` |

Powerful effects without costs or restrictions can be exploited by players.

```pdx
# ℹ️ DECISION-004: Free power!
my_decision = {
    is_shown = { always = yes }
    effect = {
        add_gold = 1000
        add_prestige = 1000
    }
    # No cost, no cooldown, no restrictions!
}

# ✅ Better - balanced
my_decision = {
    is_shown = { is_ruler = yes }
    is_valid = {
        gold >= 200
        NOT = { has_character_flag = used_my_decision }
    }
    cost = {
        gold = 200
        prestige = 100
    }
    effect = {
        set_character_flag = {
            flag = used_my_decision
            years = 5  # Cooldown
        }
        add_prestige = 500
    }
}
```

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **DECISION-001** | Error | Missing ai_check_interval |
| **DECISION-002** | Error | Missing effect block |
| **DECISION-003** | Info | No is_shown or is_valid restrictions |
| **DECISION-004** | Info | Effects without cost or restrictions |

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
