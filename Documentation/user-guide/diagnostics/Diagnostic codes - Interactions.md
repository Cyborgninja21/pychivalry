# Character Interaction Diagnostic Codes (INTERACTION-XXX)

This document covers diagnostic codes for **Character Interaction** validation in CK3 modding. Interactions are actions characters can take targeting other characters.

---

## Overview

Character interactions are validated by the schema-driven validation system using `character_interactions.yaml`. These checks ensure interactions have required fields and proper configuration.

**Module:** `schema_validator.py` with `character_interactions.yaml` schema

---

## Required Fields

### INTERACTION-001: Missing Category

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Interactions |
| **Message** | `Interaction missing 'category' field` |

All interactions must specify a category for UI organization.

```pdx
# ❌ INTERACTION-001: Missing category
my_interaction = {
    target_type = character
    is_shown = { ... }
    on_accept = { ... }
    # Missing category!
}

# ✅ Correct
my_interaction = {
    category = interaction_category_hostile
    target_type = character
    is_shown = { ... }
    on_accept = { ... }
}
```

**Valid Categories:**
- `interaction_category_hostile` - Hostile actions (war, arrest, etc.)
- `interaction_category_diplomacy` - Diplomatic actions
- `interaction_category_friendly` - Friendly actions
- `interaction_category_vassal` - Vassal management
- `interaction_category_religion` - Religious actions
- `interaction_category_prison` - Prisoner management

---

## Validation Warnings

### INTERACTION-002: No Effects

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Interactions |
| **Message** | `Interaction has no effects - does nothing` |

Interactions without `on_accept`, `on_decline`, or `effect` blocks serve no purpose.

```pdx
# ⚠️ INTERACTION-002: Does nothing
my_interaction = {
    category = interaction_category_diplomacy
    target_type = character
    is_shown = { is_ruler = yes }
    # No on_accept or effects!
}

# ✅ Correct
my_interaction = {
    category = interaction_category_diplomacy
    target_type = character
    is_shown = { is_ruler = yes }
    on_accept = {
        add_opinion = {
            target = scope:recipient
            modifier = pleased_opinion
        }
    }
}
```

---

### INTERACTION-003: No AI Configuration

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Interactions |
| **Message** | `Interaction has no AI configuration - AI will never use` |

Without AI configuration (`ai_accept`, `ai_will_do`, `ai_frequency`), AI characters will never initiate or accept this interaction.

```pdx
# ℹ️ INTERACTION-003: Player-only interaction
my_interaction = {
    category = interaction_category_friendly
    target_type = character
    on_accept = {
        add_gold = 100
    }
    # No AI config - only players use this
}

# ✅ AI-enabled
my_interaction = {
    category = interaction_category_friendly
    target_type = character
    
    ai_accept = {
        base = 0
        modifier = {
            add = 50
            opinion = { who = root value >= 50 }
        }
    }
    
    ai_will_do = {
        base = 10
        modifier = {
            factor = 2
            gold >= 500
        }
    }
    
    on_accept = {
        add_gold = 100
    }
}
```

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **INTERACTION-001** | Error | Missing category field |
| **INTERACTION-002** | Warning | No effects defined |
| **INTERACTION-003** | Info | No AI configuration |

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
