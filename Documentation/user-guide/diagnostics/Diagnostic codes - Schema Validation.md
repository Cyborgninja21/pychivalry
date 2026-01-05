# Schema Validation Diagnostic Codes (SCHEMA-XXX)

This document covers diagnostic codes for **Schema-Driven Validation**. These codes are emitted when values don't match expected patterns, types, or formats defined in YAML schemas.

---

## Overview

Schema validation provides pattern-based checking for field values, type validation, and field ordering. These checks ensure values conform to CK3's expected formats.

**Module:** `schema_validator.py`

---

## Pattern Validation

### SCHEMA-001: Invalid Localization Key Format

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schema |
| **Message** | `Invalid localization key format: '{value}' (expected lowercase with dots/underscores)` |

Localization keys should follow CK3 conventions: lowercase with dots or underscores.

```pdx
# ⚠️ SCHEMA-001: Invalid format
title = MyEvent_Title  # Mixed case, no dots

# ✅ Correct formats
title = my_event.0001.t
title = my_mod_event_title
```

---

### SCHEMA-002: Invalid Scope Reference Format

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schema |
| **Message** | `Invalid scope reference format: '{value}'` |

Scope references must use valid syntax.

```pdx
# ⚠️ SCHEMA-002: Invalid scope
character = scope-target  # Wrong separator

# ✅ Valid scope references
character = scope:target
character = root
character = prev
character = this
character = from
character = liege.primary_heir
```

---

### SCHEMA-003: Invalid Number Format

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schema |
| **Message** | `Invalid number format: '{value}'` |

Numeric fields must contain valid numbers or script values.

```pdx
# ⚠️ SCHEMA-003: Invalid numbers
gold = "hundred"
days = 30.5.2

# ✅ Valid number formats
gold = 100
gold = -50
modifier = 1.5
days = { 7 30 }  # Range
```

---

### SCHEMA-004: Pattern Mismatch

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schema |
| **Message** | `Value '{value}' does not match required pattern: {pattern}` |

Generic pattern validation failure for custom patterns.

---

## Field Order Validation

### SCHEMA-010: Field Out of Order

| Property | Value |
|----------|-------|
| **Severity** | Information |
| **Category** | Schema |
| **Message** | `Field '{field}' should appear before '{other_field}' for consistency` |

Some schemas define recommended field ordering for readability.

```pdx
# ℹ️ SCHEMA-010: Out of conventional order
my_event.0001 = {
    option = { name = my_event.0001.a }  # Options usually come last
    type = character_event              # Type should be first
    desc = my_event.0001.desc
}

# ✅ Conventional order
my_event.0001 = {
    type = character_event
    desc = my_event.0001.desc
    option = { name = my_event.0001.a }
}
```

---

### SCHEMA-011: Field Order Hint

| Property | Value |
|----------|-------|
| **Severity** | Hint |
| **Category** | Schema |
| **Message** | `Recommended field order: {expected_order}` |

Suggests the recommended field ordering for the current block type.

---

## Range Validation

### SCHEMA-020: Invalid Range Order

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Schema |
| **Message** | `Range values must be in order: min ({min}) should be less than max ({max})` |

Range blocks must have min ≤ max.

```pdx
# ❌ SCHEMA-020: Invalid range
days = { 30 7 }  # min > max!

# ✅ Correct
days = { 7 30 }  # 7 to 30 days
```

---

### SCHEMA-021: Invalid Range Count

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schema |
| **Message** | `Range block should contain exactly 2 values (min and max), found {count}` |

```pdx
# ⚠️ SCHEMA-021: Wrong number of values
days = { 7 }        # Only 1 value
days = { 7 14 30 }  # 3 values

# ✅ Correct
days = { 7 30 }  # Exactly 2: min and max
```

---

## Type Validation

### SCHEMA-022: Type Mismatch

| Property | Value |
|----------|-------|
| **Severity** | Warning |
| **Category** | Schema |
| **Message** | `Expected {expected_type} but got {actual_type}` |

Value type doesn't match what the schema expects.

```pdx
# ⚠️ SCHEMA-022: Expected block, got string
immediate = "do_stuff"  # Should be a block

# ✅ Correct
immediate = {
    add_gold = 100
}
```

---

### SCHEMA-023: Context Mismatch

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Schema |
| **Message** | `Block type mismatch: expected {expected_context} block but found {actual_context}` |

Block contains wrong type of content for its context.

```pdx
# ❌ SCHEMA-023: Trigger block contains effects
trigger = {
    add_gold = 100  # Effect in trigger context!
}

# ✅ Correct
trigger = {
    gold >= 100  # Trigger in trigger context
}
```

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **SCHEMA-001** | Warning | Invalid localization key format |
| **SCHEMA-002** | Warning | Invalid scope reference format |
| **SCHEMA-003** | Warning | Invalid number format |
| **SCHEMA-004** | Warning | Pattern mismatch (generic) |
| **SCHEMA-010** | Info | Field out of recommended order |
| **SCHEMA-011** | Hint | Recommended field order |
| **SCHEMA-020** | Error | Invalid range order (min > max) |
| **SCHEMA-021** | Warning | Invalid range value count |
| **SCHEMA-022** | Warning | Type mismatch |
| **SCHEMA-023** | Error | Block context mismatch |

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
