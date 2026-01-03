# Event-Specific Diagnostic Codes (EVENT-XXX)

This document covers **event-specific** diagnostic codes that supplement the main CK3XXX event validation codes. These handle edge cases specific to certain event types.

---

## Overview

Event-specific codes cover validation that applies only to particular event types (letter events, court events, etc.) rather than all events.

**Module:** `schema_validator.py` with `events.yaml` schema

---

## Letter Event Validation

### EVENT-003: Letter Event Missing Sender

| Property | Value |
|----------|-------|
| **Severity** | Error |
| **Category** | Events |
| **Message** | `Letter event missing required 'sender' field` |

Letter events must specify who sends the letter.

```pdx
# ❌ EVENT-003: Missing sender
letter_event.0001 = {
    type = letter_event
    title = letter_event.0001.t
    desc = letter_event.0001.desc
    # Missing sender!
    
    option = {
        name = letter_event.0001.a
    }
}

# ✅ Correct
letter_event.0001 = {
    type = letter_event
    sender = scope:letter_sender
    
    title = letter_event.0001.t
    desc = letter_event.0001.desc
    
    option = {
        name = letter_event.0001.a
    }
}
```

**Common Sender Values:**
- `scope:actor` - The character who triggered the event chain
- `scope:letter_sender` - A specifically saved scope
- `root` - The event's root scope (if applicable)
- `liege` - Character's liege
- `primary_spouse` - Character's primary spouse

---

## Summary

| Code | Severity | Description |
|------|----------|-------------|
| **EVENT-003** | Error | Letter event missing sender field |

---

## Note on Event Validation

Most event validation uses CK3XXX codes (CK3760-CK3769, CK3420-CK3456, etc.) documented in the main [Diagnostic codes.md](Diagnostic%20codes.md). The EVENT-XXX codes are reserved for:

- Event-type-specific requirements (like `sender` for letter events)
- Future event validation that doesn't fit CK3 numbering
- Complex cross-event validation

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - CK3XXX codes including CK3760-CK3769 event structure
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
