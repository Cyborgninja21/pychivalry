# Scheme Diagnostic Codes (SCHEME-XXX)

This document covers diagnostic codes for **Scheme** validation in CK3 modding. Schemes are covert operations characters can execute against targets over time.

---

## Overview

Schemes are validated by the schema-driven validation system using `schemes.yaml`. These checks ensure schemes have required configuration and proper agent handling.

**Module:** `schema_validator.py` with `schemes.yaml` schema

---

## Required Fields

### SCHEME-001: Missing Skill Field

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Schemes |
| **Message** | `Scheme missing required 'skill' field` |

All schemes must specify which skill determines success chance.

```pdx
# ❌ SCHEME-001: Missing skill
my_scheme = {
    target_type = character
    power_per_skill_point = 2
    # Missing skill!
}

# ✅ Correct
my_scheme = {
    skill = intrigue
    target_type = character
    power_per_skill_point = 2
}
```

**Valid Skills:**
- `diplomacy`
- `martial`
- `stewardship`
- `intrigue`
- `learning`
- `prowess`

---

## Validation Warnings

### SCHEME-002: No Effects

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schemes |
| **Message** | `Scheme has no effects - does nothing when executed` |

Schemes need `on_success`, `on_failure`, or `on_expose` effects.

```pdx
# ⚠️ SCHEME-002: Does nothing
my_scheme = {
    skill = intrigue
    target_type = character
    power_per_skill_point = 2
    # No outcome effects!
}

# ✅ Correct
my_scheme = {
    skill = intrigue
    target_type = character
    power_per_skill_point = 2
    
    on_success = {
        scope:target = {
            add_trait = wounded
        }
    }
    
    on_failure = {
        add_stress = 20
    }
    
    on_expose = {
        scope:target = {
            add_opinion = {
                target = scope:owner
                modifier = attempted_to_harm_me
            }
        }
    }
}
```

---

### SCHEME-003: Agents Without Conditions

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schemes |
| **Message** | `Scheme uses agents but has no valid_agent conditions` |

If a scheme uses agents (`uses_agents = yes`), it should define who can be recruited.

```pdx
# ⚠️ SCHEME-003: Anyone can be an agent?
my_scheme = {
    skill = intrigue
    uses_agents = yes
    # No valid_agent - who can join?
}

# ✅ Correct
my_scheme = {
    skill = intrigue
    uses_agents = yes
    
    valid_agent = {
        is_adult = yes
        NOT = { this = scope:target }
        OR = {
            is_courtier_of = scope:owner
            is_vassal_of = scope:owner
        }
    }
    
    agent_join_chance = {
        base = 0
        modifier = {
            add = 20
            has_relation_rival = scope:target
        }
    }
}
```

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **SCHEME-001** | Error | Missing skill field |
| **SCHEME-002** | Warning | No effects defined |
| **SCHEME-003** | Warning | Agents without valid_agent conditions |

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
