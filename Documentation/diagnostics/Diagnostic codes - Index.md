# PyChivalry Diagnostic Codes - Index

This is the master index for all diagnostic codes used by the PyChivalry CK3 Language Server.

---

## Quick Reference

| Prefix | Range | Category | Document |
|--------|-------|----------|----------|
| `CK30XX` | 3001-3002 | Syntax Errors | [Main Codes](Diagnostic%20codes.md#syntax-checks-ck3001-ck3002) |
| `CK31XX` | 3101-3103 | Semantic Errors | [Main Codes](Diagnostic%20codes.md#semantic-checks-ck3101-ck3103) |
| `CK32XX` | 3201-3203 | Scope Validation | [Main Codes](Diagnostic%20codes.md#scope-checks-ck3201-ck3203) |
| `CK33XX` | 3301-3345 | Style Checks | [Main Codes](Diagnostic%20codes.md#style-checks-ck33xx) |
| `CK342X` | 3420-3422 | Portrait/Animation | [Main Codes](Diagnostic%20codes.md#portrait--animation-validation-ck3420-ck3422) |
| `CK343X` | 3430 | Theme Validation | [Main Codes](Diagnostic%20codes.md#theme-validation-ck3430) |
| `CK344X` | 3440-3443 | Description Validation | [Main Codes](Diagnostic%20codes.md#description-validation-ck3440-ck3443) |
| `CK345X` | 3450-3456 | Option Validation | [Main Codes](Diagnostic%20codes.md#option-validation-ck3450-ck3456) |
| `CK351X` | 3510-3513 | Trigger Extensions | [Main Codes](Diagnostic%20codes.md#trigger-extension-validation-ck3510-ck3513) |
| `CK352X` | 3520-3521 | After Blocks | [Main Codes](Diagnostic%20codes.md#after-block-validation-ck3520-ck3521) |
| `CK355X` | 3550-3555 | Scope Timing | [Main Codes](Diagnostic%20codes.md#scope-timing-checks-ck3550-ck3555) |
| `CK360X` | 3600-3604 | Localization | [Main Codes](Diagnostic%20codes.md#localization-validation-ck3600-ck3604) |
| `CK361X` | 3610-3614 | AI Chance | [Main Codes](Diagnostic%20codes.md#ai-chance-validation-ck3610-ck3614) |
| `CK365X` | 3656 | Opinion Modifiers | [Main Codes](Diagnostic%20codes.md#opinion-modifier-checks-ck3656) |
| `CK376X` | 3760-3769 | Event Structure | [Main Codes](Diagnostic%20codes.md#event-structure-checks-ck3760-ck3769) |
| `CK387X` | 3870-3875 | Effect/Trigger Context | [Main Codes](Diagnostic%20codes.md#effecttrigger-context-checks-ck3870-ck3875) |
| `CK397X` | 3976-3977 | List Iterators | [Main Codes](Diagnostic%20codes.md#list-iterator-checks-ck3976-ck3977) |
| `CK51XX` | 5137, 5142 | Common Gotchas | [Main Codes](Diagnostic%20codes.md#common-gotchas-ck51xx) |
| `STORY-XXX` | 001-045 | Story Cycles | [Story Cycles](Diagnostic%20codes%20-%20Story%20Cycles.md) |
| `DECISION-XXX` | 001-004 | Decisions | [Decisions](Diagnostic%20codes%20-%20Decisions.md) |
| `INTERACTION-XXX` | 001-003 | Character Interactions | [Interactions](Diagnostic%20codes%20-%20Interactions.md) |
| `SCHEME-XXX` | 001-003 | Schemes | [Schemes](Diagnostic%20codes%20-%20Schemes.md) |
| `ON_ACTION-XXX` | 001-002 | On-Actions | [On Actions](Diagnostic%20codes%20-%20On%20Actions.md) |
| `EVENT-XXX` | 003 | Event-Specific | [Events](Diagnostic%20codes%20-%20Events.md) |
| `SCHEMA-XXX` | 001-023 | Schema Validation | [Schema Validation](Diagnostic%20codes%20-%20Schema%20Validation.md) |
| Internal | Various | Internal/Debug | [Internal](Diagnostic%20codes%20-%20Internal.md) |

---

## Documentation Files

### User-Facing Codes

| File | Description |
|------|-------------|
| [Diagnostic codes.md](Diagnostic%20codes.md) | **Main document** - All CK3XXX standard codes (~74 codes) |
| [Diagnostic codes - Story Cycles.md](Diagnostic%20codes%20-%20Story%20Cycles.md) | Story cycle validation (15 codes) |
| [Diagnostic codes - Decisions.md](Diagnostic%20codes%20-%20Decisions.md) | Decision validation (4 codes) |
| [Diagnostic codes - Interactions.md](Diagnostic%20codes%20-%20Interactions.md) | Character interaction validation (3 codes) |
| [Diagnostic codes - Schemes.md](Diagnostic%20codes%20-%20Schemes.md) | Scheme validation (3 codes) |
| [Diagnostic codes - On Actions.md](Diagnostic%20codes%20-%20On%20Actions.md) | On-action validation (2 codes) |
| [Diagnostic codes - Events.md](Diagnostic%20codes%20-%20Events.md) | Event-type-specific validation (1 code) |
| [Diagnostic codes - Schema Validation.md](Diagnostic%20codes%20-%20Schema%20Validation.md) | Pattern/type validation (10 codes) |

### Internal Codes

| File | Description |
|------|-------------|
| [Diagnostic codes - Internal.md](Diagnostic%20codes%20-%20Internal.md) | Internal/debug codes for development |

---

## Severity Levels

| Severity | Visual | Meaning |
|----------|--------|---------|
| **Error** | 🔴 Red squiggle | Will fail at runtime |
| **Warning** | 🟡 Yellow squiggle | May have issues |
| **Information** | 🔵 Blue squiggle | Suggestions |
| **Hint** | ⚪ Faint dots | Minor improvements |

---

## Total Code Counts

| Category | Count |
|----------|-------|
| CK3XXX Standard Codes | ~74 |
| STORY-XXX Codes | 15 |
| DECISION-XXX Codes | 4 |
| INTERACTION-XXX Codes | 3 |
| SCHEME-XXX Codes | 3 |
| ON_ACTION-XXX Codes | 2 |
| EVENT-XXX Codes | 1 |
| SCHEMA-XXX Codes | 10 |
| **Total User-Facing** | **~112** |
| Internal Codes | ~35 |
| **Grand Total** | **~147** |

---

## Code Naming Convention

### Standard Codes (CK3XXX)
- `CK3` = Crusader Kings 3 prefix
- Next 2 digits = Category (30=syntax, 31=semantic, 33=style, etc.)
- Last 2 digits = Specific code within category

### Schema Codes (PREFIX-XXX)
- Prefix = Content type (STORY, DECISION, INTERACTION, etc.)
- Number = Sequential within that type

### Internal Codes (PREFIX-XXX)
- Prefix = Module name abbreviation (INDEX, PARSE, WORKSPACE, etc.)
- Number = Sequential within that module
