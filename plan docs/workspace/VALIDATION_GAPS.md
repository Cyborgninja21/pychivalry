# CK3 Language Server - Missing Validation Checks

This document identifies validation checks that **should be implemented** based on the CK3 Event Modding Reference but are **not yet covered** in the current validation system.

> **Note:** This document was reviewed against the actual codebase to verify implementation status.

---

## Table of Contents

1. [Event Structure Gaps](#1-event-structure-gaps)
2. [Namespace and ID Validation Gaps](#2-namespace-and-id-validation-gaps)
3. [Portrait Validation Gaps](#3-portrait-validation-gaps)
4. [Theme and Background Validation Gaps](#4-theme-and-background-validation-gaps)
5. [Description Block Validation Gaps](#5-description-block-validation-gaps)
6. [Option Block Validation Gaps](#6-option-block-validation-gaps)
7. [On Action Validation Gaps](#7-on-action-validation-gaps)
8. [Trigger Block Validation Gaps](#8-trigger-block-validation-gaps)
9. [After Block Validation Gaps](#9-after-block-validation-gaps)
10. [Localization Validation Gaps](#10-localization-validation-gaps)
11. [AI Chance Validation Gaps](#11-ai-chance-validation-gaps)
12. [Priority Implementation Roadmap](#12-priority-implementation-roadmap)

---

## 1. Event Structure Gaps

### Currently Validated
- ✅ CK3760: Missing event type declaration (`paradox_checks.py`)
- ✅ CK3763: Event has no options (`paradox_checks.py`)
- ✅ CK3768: Multiple immediate blocks (`paradox_checks.py`)

### Partially Implemented (in helper modules, not as diagnostics)
- 🟡 `events.py` has `is_valid_event_type()` - validates against `EVENT_TYPES` set
- 🟡 `events.py` has `validate_event_fields()` - checks required fields
- 🟡 `events.py` has `validate_option()` - checks option has `name` field

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3761** | Error | Invalid event type | `type` must be one of: `character_event`, `letter_event`, `duel_event`, `none`, `empty` (Note: helper exists in `events.py` but not wired to diagnostics) |
| **CK3762** | Warning | Hidden event with options | Event has `hidden = yes` but also has `option` blocks (options are ignored) |
| **CK3764** | Warning | Missing desc | Non-hidden event lacks `desc` for display text (Note: helper exists but not wired) |
| **CK3765** | Warning | Missing title | Event lacks `title` (title is optional but recommended) |
| **CK3766** | Error | Multiple after blocks | Only first `after` block executes (same as immediate) |
| **CK3767** | Warning | Empty event block | Event definition contains no meaningful content |
| **CK3769** | Information | No portraits | Non-hidden event has no portrait positions defined |

### Example

```pdx
# CK3761: Invalid event type
my_event.1 = {
    type = invalid_type  # ERROR: Must be character_event, letter_event, duel_event, none, or empty
}

# CK3762: Hidden event with options
my_event.2 = {
    hidden = yes
    option = { name = ignored }  # WARNING: Options ignored in hidden events
}
```

---

## 2. Namespace and ID Validation Gaps

### Currently Validated
- ✅ CK3325: Namespace not at top of file (`style_checks.py`)

### Partially Implemented (helpers exist but not wired as diagnostics)
- 🟡 `events.py` has `parse_event_id()` - parses `namespace.number` format
- 🟡 `code_lens.py` tracks namespaces and event counts
- 🟡 `localization.py` has `parse_localization_key()` for namespace parsing

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3400** | Error | Missing namespace | File has events but no `namespace` declaration |
| **CK3401** | Error | Event ID mismatch | Event ID doesn't use declared namespace (e.g., `other.1` when namespace is `my_events`) |
| **CK3402** | Warning | Event ID exceeds 9999 | ID `>9999` causes buggy event calling system |
| **CK3403** | Error | Invalid namespace characters | Namespace contains `.` or non-alphanumeric characters |
| **CK3404** | Error | Duplicate event ID | Same event ID defined multiple times in workspace |
| **CK3405** | Warning | Non-sequential IDs | Large gaps in event IDs (organizational hint) |
| **CK3406** | Error | Invalid event ID format | Event ID not in `namespace.number` format |

### Example

```pdx
namespace = my_events

# CK3401: Event ID mismatch
other_namespace.1 = {  # ERROR: Should use 'my_events' namespace
    desc = ...
}

# CK3402: Event ID exceeds 9999
my_events.10001 = {  # WARNING: IDs > 9999 are buggy
    desc = ...
}
```

---

## 3. Portrait Validation Gaps

### Currently Validated
- ❌ No portrait validation diagnostics exist

### Partially Implemented (data exists but not wired as diagnostics)
- 🟡 `events.py` has `PORTRAIT_POSITIONS` set with 5 valid positions
- 🟡 `events.py` has `PORTRAIT_ANIMATIONS` set (limited subset ~17 animations)
- 🟡 `events.py` has `is_valid_portrait_position()` and `is_valid_portrait_animation()` helpers
- 🟡 `events.py` has `validate_portrait_configuration()` helper
- 🟡 `style_checks.py` has `valid_compound_identifiers` with portrait positions for merged ID detection
- 🟡 `ck3_language.py` has `CK3_PORTRAIT_FIELDS` dict with field documentation
- 🟡 `hover.py` provides hover info for portrait fields

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3420** | Error | Invalid portrait position | Portrait key not one of: `left_portrait`, `right_portrait`, `lower_left_portrait`, `lower_center_portrait`, `lower_right_portrait` |
| **CK3421** | Warning | Missing character in portrait | Portrait block lacks required `character` parameter |
| **CK3422** | Warning | Invalid animation | Animation name not in known animations list (Note: `events.py` has `PORTRAIT_ANIMATIONS` but incomplete - only ~17 of 150+ animations) |
| **CK3423** | Error | triggered_animation missing trigger | `triggered_animation` block lacks `trigger` |
| **CK3424** | Error | triggered_animation missing animation | `triggered_animation` block lacks `animation` |
| **CK3425** | Warning | triggered_outfit missing trigger | `triggered_outfit` block lacks `trigger` |
| **CK3426** | Information | Duplicate portrait position | Same portrait position defined multiple times |

### Data Gap: Animation List
The current `PORTRAIT_ANIMATIONS` set in `events.py` only contains ~17 animations. The CK3_EVENT_MODDING.md lists 150+ animations across categories:
- Basic Emotions (24)
- Actions & States (31)
- Personality (14)
- Throne Room (24)
- Special (42)
- Combat (18)
- Hunting & Sports (24)
- Wedding & Music (12)

**Action Required**: Expand `PORTRAIT_ANIMATIONS` or create new `animations.yaml` data file.

### Example

```pdx
# CK3420: Invalid portrait position
my_event.1 = {
    center_portrait = { character = root }  # ERROR: Invalid position
}

# CK3422: Invalid animation
left_portrait = {
    character = root
    animation = not_a_real_animation  # WARNING: Unknown animation
}
```

---

## 4. Theme and Background Validation Gaps

### Currently Validated
- ❌ No theme/background validation diagnostics exist

### Partially Implemented (data exists but not wired as diagnostics)
- 🟡 `events.py` has `EVENT_THEMES` set (~32 themes but incomplete)
- 🟡 `events.py` has `is_valid_theme()` helper function
- 🟡 `ck3_language.py` has `CK3_EVENT_FIELDS` with `theme` documentation
- 🟡 `semantic_tokens.py` recognizes `theme` as a token type
- 🟡 `hover.py` provides hover info for themes

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3430** | Warning | Invalid theme | `theme` value not in known themes list |
| **CK3431** | Warning | Invalid override_background | Background name not in known backgrounds list |
| **CK3432** | Warning | Invalid override_environment | Environment name not in known environments list |
| **CK3433** | Information | Redundant override | `override_background` matches theme's default background |
| **CK3434** | Warning | Invalid override_icon | Icon reference doesn't exist |
| **CK3435** | Warning | Invalid override_sound | Sound reference doesn't exist |

### Data Gap: Theme List
The current `EVENT_THEMES` set in `events.py` contains ~32 themes but is incomplete. CK3_EVENT_MODDING.md lists 72+ themes including:
- Focus themes: `diplomacy_family_focus`, `martial_authority_focus`, etc.
- Scheme themes: `murder_scheme`, `seduce_scheme`, `befriend_scheme`, etc.
- Activity themes: `feast_activity`, `hunt_activity`, `pilgrimage_activity`

### Data Gap: Backgrounds
No background validation data exists. CK3_EVENT_MODDING.md lists 44+ backgrounds:
- `throne_room`, `bedchamber`, `dungeon`, `battlefield`, etc.
- Regional variants: `throne_room_east`, `market_india`, `temple_mosque`

### Data Gap: Environments  
No environment data exists. CK3_EVENT_MODDING.md lists 44+ environments.

**Action Required**: Create `themes.yaml`, `backgrounds.yaml`, `environments.yaml` data files.

### Example

```pdx
# CK3430: Invalid theme
my_event.1 = {
    theme = not_a_theme  # WARNING: Unknown theme
    override_background = { background = throne_room }
}
```

---

## 5. Description Block Validation Gaps

### Currently Validated
- ❌ No description block validation diagnostics exist

### Partially Implemented (data/helpers exist)
- 🟡 `events.py` has `validate_dynamic_description()` helper - checks `triggered_desc` structure
- 🟡 `scope_timing.py` handles `triggered_desc` for scope timing validation (CK3552)
- 🟡 `completions.py` provides completion for `triggered_desc` blocks
- 🟡 `hover.py` provides hover info for `desc` field

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3440** | Error | triggered_desc missing trigger | `triggered_desc` block lacks `trigger` block (Note: helper exists in `events.py` - wire to diagnostics) |
| **CK3441** | Error | triggered_desc missing desc | `triggered_desc` block lacks `desc` (Note: helper exists in `events.py` - wire to diagnostics) |
| **CK3442** | Warning | first_valid no fallback | `first_valid` block has no unconditional fallback `desc` |
| **CK3443** | Warning | Empty desc block | `desc = { }` with no content |
| **CK3444** | Information | Literal string in desc | Using `desc = "text"` instead of localization key |
| **CK3445** | Error | Invalid desc structure | Mixing `first_valid` and `random_valid` incorrectly |
| **CK3446** | Warning | Nested desc complexity | Excessive nesting of `first_valid`/`random_valid` (>3 levels) |

### Example

```pdx
# CK3440: triggered_desc missing trigger
desc = {
    first_valid = {
        triggered_desc = {
            # ERROR: Missing trigger block
            desc = my_event.1.desc.a
        }
    }
}

# CK3442: first_valid no fallback
desc = {
    first_valid = {
        triggered_desc = {
            trigger = { has_trait = brave }
            desc = my_event.1.desc.brave
        }
        # WARNING: No fallback desc - may show nothing!
    }
}
```

---

## 6. Option Block Validation Gaps

### Currently Validated
- ❌ No option-specific validation diagnostics exist

### Partially Implemented (data/helpers exist)
- 🟡 `events.py` has `validate_option()` helper - checks for required `name` field
- 🟡 `ck3_language.py` has comprehensive `CK3_OPTION_FIELDS` dict with all option fields
- 🟡 `diagnostics.py` has `skill` in `COMMON_PARAMETERS` for effect validation
- 🟡 `hover.py` provides hover info for option fields (`name`, `trait`, `skill`, `ai_chance`, etc.)
- 🟡 `completions.py` provides option block completions
- 🟡 `symbols.py` extracts option symbols with names

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3450** | Error | Option missing name | Option block lacks required `name` parameter (Note: helper exists in `events.py` - wire to diagnostics) |
| **CK3451** | Warning | Invalid trait reference | `trait = xxx` references unknown trait |
| **CK3452** | Warning | Invalid skill reference | `skill = xxx` not one of: `diplomacy`, `martial`, `stewardship`, `intrigue`, `learning`, `prowess` |
| **CK3453** | Warning | Invalid add_internal_flag | Value not `special` or `dangerous` |
| **CK3454** | Warning | fallback with always=yes trigger | `fallback = yes` with `trigger = { always = yes }` is redundant |
| **CK3455** | Warning | Multiple exclusive options | Multiple options with `exclusive = yes` may conflict |
| **CK3456** | Warning | show_as_unavailable without trigger | `show_as_unavailable` defined but no `trigger` to make it unavailable |
| **CK3457** | Error | highlight_portrait invalid scope | `highlight_portrait` references undefined scope |
| **CK3458** | Information | Option name is literal | Using `name = "text"` instead of localization key |
| **CK3459** | Warning | All options have triggers | Every option has triggers; consider a fallback option |

### Data Note
`CK3_OPTION_FIELDS` in `ck3_language.py` already documents valid option fields including:
- `name`, `custom_tooltip`, `trait`, `skill`, `trigger`, `show_as_unavailable`
- `ai_chance`, `fallback`, `exclusive`, `highlight_portrait`, `first_valid_triggered_desc`

This data can be used for validation.

### Example

```pdx
# CK3450: Option missing name
option = {
    add_gold = 100  # ERROR: Missing 'name' parameter
}

# CK3452: Invalid skill reference
option = {
    name = my_event.1.a
    skill = charisma  # WARNING: Should be diplomacy/martial/stewardship/intrigue/learning/prowess
}

# CK3453: Invalid add_internal_flag
option = {
    name = my_event.1.b
    add_internal_flag = highlighted  # WARNING: Must be 'special' or 'dangerous'
}
```

---

## 7. On Action Validation Gaps

### Currently Validated
- ❌ No on_action validation diagnostics exist

### Partially Implemented (infrastructure exists)
- 🟡 `symbols.py` has `extract_on_action_symbols()` for document symbols
- 🟡 `ck3_language.py` has `on_actions` in `CK3_SECTIONS`
- 🟡 `style_checks.py` recognizes `on_action` as valid compound identifier
- 🟡 `semantic_tokens.py` can tokenize on_action content

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3500** | Error | Effect/trigger overwrite | Defining `effect` or `trigger` in on_action that appends to vanilla (overwrites instead of appends) |
| **CK3501** | Warning | Unknown on_action | Referencing on_action that doesn't exist |
| **CK3502** | Error | Invalid delay format | `delay` not in valid format (`days`, `months`, or range) |
| **CK3503** | Warning | every_character in pulse | Using `every_living_character` inside character pulse on_action (N² performance) |
| **CK3504** | Warning | Infinite fallback loop | on_action `fallback` creates circular reference |
| **CK3505** | Information | Missing weight_multiplier | on_action in `random_on_actions` lacks `weight_multiplier` |
| **CK3506** | Warning | Zero weight event | Event in `random_events` has weight of 0 |
| **CK3507** | Warning | chance_to_happen > 100 | `chance_to_happen` exceeds 100% |
| **CK3508** | Error | on_action wrong path | File in `on_actions/` instead of `on_action/` (common mistake) |

### Data Gap: Known On Actions
No on_action reference data exists. CK3_EVENT_MODDING.md lists 30+ code-triggered on_actions with their root scopes:
- `on_birth_child`, `on_death`, `on_marriage` (Character scope)
- `on_game_start`, `on_game_start_after_lobby` (No scope)
- `yearly_playable_pulse`, `five_year_playable_pulse` (Character scope)
- etc.

**Action Required**: Create `on_actions.yaml` data file with scopes.

### Example

```pdx
# CK3500: Effect overwrite warning
on_birth_child = {
    effect = { add_gold = 100 }  # WARNING: This overwrites vanilla effect!
}

# CK3503: Performance warning
yearly_playable_pulse = {
    effect = {
        every_living_character = {  # WARNING: N² operations - very slow!
            add_gold = 1
        }
    }
}
```

---

## 8. Trigger Block Validation Gaps

### Currently Validated
- ✅ CK3102: Effect in trigger block (`diagnostics.py`)
- ✅ CK3870: Effect in trigger block (`paradox_checks.py` - duplicate of CK3102)
- ✅ CK3871: Effect in limit block (`paradox_checks.py`)
- ✅ CK3872: Redundant trigger (always = yes) (`paradox_checks.py`)
- ✅ CK3873: Impossible trigger (always = no) (`paradox_checks.py`)

### Partially Implemented (recognized but not validated)
- 🟡 `paradox_checks.py` includes `trigger_if` and `trigger_else` in `control_flow` set
- 🟡 `ck3_language.py` has `on_trigger_fail` documentation

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3510** | Error | trigger_else without trigger_if | `trigger_else` block without preceding `trigger_if` |
| **CK3511** | Warning | Multiple trigger_else | Multiple `trigger_else` blocks (only first executes) |
| **CK3512** | Error | trigger_if missing limit | `trigger_if` block lacks required `limit` block |
| **CK3513** | Warning | Empty trigger_if limit | `trigger_if` with `limit = { }` always passes |
| **CK3514** | Information | on_trigger_fail defined | Informational: event has `on_trigger_fail` handler |
| **CK3515** | Warning | Duplicate trigger conditions | Same trigger condition repeated in block |

### Example

```pdx
# CK3510: trigger_else without trigger_if
trigger = {
    trigger_else = {  # ERROR: No preceding trigger_if
        gold > 100
    }
}

# CK3512: trigger_if missing limit
trigger = {
    trigger_if = {  # ERROR: Missing 'limit' block
        gold > 500
    }
}
```

---

## 9. After Block Validation Gaps

### Currently Validated
- ❌ No after block validation diagnostics exist

### Partially Implemented
- 🟡 `symbols.py` extracts `after` as a child symbol in event symbols

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3520** | Warning | after in hidden event | `after` block in hidden event (won't execute - no options) |
| **CK3521** | Warning | after in optionless event | `after` block but event has no options |
| **CK3522** | Information | Cleanup pattern detected | `after` block removes variables/scopes (good practice) |
| **CK3523** | Warning | Trigger in after block | Triggers in `after` block (effect context only) |

### Example

```pdx
# CK3520: after in hidden event
my_event.1 = {
    hidden = yes
    immediate = { add_gold = 100 }
    after = {  # WARNING: Won't execute - no options to trigger it
        remove_variable = my_var
    }
}
```

---

## 10. Localization Validation Gaps

### Currently Validated
- ❌ No localization validation diagnostics exist

### Partially Implemented (significant infrastructure exists)
- 🟡 `localization.py` has `LocalizationKey` dataclass and helper functions
- 🟡 `localization.py` has `parse_localization_key()` - parses namespace.identifier
- 🟡 `localization.py` has `suggest_localization_key_format()` - suggests proper format
- 🟡 `workspace.py` has `extract_localization_keys_from_event()` - extracts referenced keys
- 🟡 `workspace.py` has `calculate_localization_coverage()` - calculates missing keys
- 🟡 `workspace.py` has `LocalizationCoverage` dataclass with `missing_keys` field
- 🟡 `rename.py` has `find_localization_keys_for_event()` - finds related loc keys
- 🟡 `semantic_tokens.py` recognizes localization keys as token type
- 🟡 `signature_help.py` documents localization_key parameter types

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3600** | Warning | Missing localization key | Referenced loc key not found in localization files (Note: `calculate_localization_coverage()` can detect this - wire to diagnostics) |
| **CK3601** | Information | Literal text usage | Literal string used instead of localization key |
| **CK3602** | Warning | Localization file encoding | Localization file not UTF-8-BOM encoded |
| **CK3603** | Hint | Inconsistent loc key naming | Loc key doesn't follow `namespace.id.element` pattern |
| **CK3604** | Warning | Unused localization key | Loc key defined but never referenced |

### Implementation Note
Most of the infrastructure for CK3600 already exists! The `calculate_localization_coverage()` function in `workspace.py` already identifies missing localization keys. This just needs to be wired to produce diagnostics.

### Example

```pdx
# CK3600: Missing localization key
my_event.1 = {
    desc = my_event.1.desc  # WARNING: Key not found in localization files
}

# CK3601: Literal text
my_event.2 = {
    title = "My Event Title"  # INFO: Consider using localization key
}
```

---

## 11. AI Chance Validation Gaps

### Currently Validated
- ❌ No AI chance validation diagnostics exist

### Partially Implemented (documentation exists)
- 🟡 `ck3_language.py` has `ai_chance` in `CK3_OPTION_FIELDS` with usage documentation
- 🟡 `hover.py` provides hover info for `ai_chance` field
- 🟡 `document_highlight.py` recognizes `modifier` in `add_opinion` blocks

### Missing Checks

| Proposed Code | Severity | Check | Description |
|---------------|----------|-------|-------------|
| **CK3610** | Warning | Negative base chance | `ai_chance` with `base < 0` |
| **CK3611** | Warning | ai_chance total can be zero | All modifiers could reduce to 0 (AI never picks option) |
| **CK3612** | Warning | ai_chance total can be negative | Modifiers could result in negative chance |
| **CK3613** | Information | Missing ai_chance | Option lacks `ai_chance` (defaults to equal weight) |
| **CK3614** | Warning | Modifier missing trigger | `modifier` in `ai_chance` lacks condition |

### Example

```pdx
# CK3611: AI chance can be zero
option = {
    name = my_event.1.a
    ai_chance = {
        base = 10
        modifier = {
            add = -15  # WARNING: Could result in negative total
            has_trait = compassionate
        }
    }
}
```

---

## 12. Priority Implementation Roadmap

### Quick Wins (Wire existing helpers to diagnostics)

These checks have helper functions that just need to be called from diagnostic collection:

| Category | Codes | Existing Helper | Action |
|----------|-------|-----------------|--------|
| Event Structure | CK3761 | `events.is_valid_event_type()` | Wire to `paradox_checks.py` |
| Event Structure | CK3764 | `events.validate_event_fields()` | Wire to `paradox_checks.py` |
| Option | CK3450 | `events.validate_option()` | Wire to `paradox_checks.py` |
| Description | CK3440-3441 | `events.validate_dynamic_description()` | Wire to `paradox_checks.py` |
| Localization | CK3600 | `workspace.calculate_localization_coverage()` | Create workspace diagnostic |

### High Priority (Critical for Modding)

| Category | Codes | Rationale |
|----------|-------|-----------|
| Namespace/ID Validation | CK3400-CK3406 | Fundamental event structure; prevents runtime errors |
| Trigger Block Extensions | CK3510-CK3515 | `trigger_if`/`trigger_else` are commonly misused |
| Event Structure Extensions | CK3762, CK3766-CK3769 | Complete event type validation |

### Medium Priority (Quality Improvements)

| Category | Codes | Rationale |
|----------|-------|-----------|
| Portrait Validation | CK3420-CK3426 | Invalid animations silently fail (need animation data expansion) |
| Theme/Background Validation | CK3430-CK3435 | Visual correctness (need theme/background data) |
| After Block Validation | CK3520-CK3523 | Common gotcha with hidden events |
| Option Validation | CK3451-CK3459 | Complete option checking |

### Lower Priority (Nice to Have)

| Category | Codes | Rationale |
|----------|-------|-----------|
| On Action Validation | CK3500-CK3508 | Complex; requires cross-file analysis |
| Localization Extensions | CK3601-CK3604 | Beyond basic missing key check |
| AI Chance Validation | CK3610-CK3614 | Edge cases; not blocking |

---

## Implementation Notes

### Data Files Needed

To implement these checks, the following data files should be created in `pychivalry/data/`:

| File | Status | Contents |
|------|--------|----------|
| `animations.yaml` | **NEEDED** | All valid animation names (~150) |
| `themes.yaml` | **NEEDED** | All valid theme names (~72) |
| `backgrounds.yaml` | **NEEDED** | All valid background names (~44) |
| `environments.yaml` | **NEEDED** | All valid environment names (~44) |
| `traits.yaml` | **NEEDED** | All valid trait names (for option validation) |
| `on_actions.yaml` | **NEEDED** | Known on_actions with their scopes |
| `scopes/*.yaml` | ✅ EXISTS | Character, title, province scope definitions |

### Existing Data Gaps

| Module | Data | Current Count | Needed Count |
|--------|------|---------------|--------------|
| `events.py` | `PORTRAIT_ANIMATIONS` | ~17 | ~150 |
| `events.py` | `EVENT_THEMES` | ~32 | ~72 |
| `events.py` | `EVENT_TYPES` | 6 | 6 ✅ |
| `events.py` | `PORTRAIT_POSITIONS` | 5 | 5 ✅ |

### Configuration Extensions

```python
# Proposed additions to DiagnosticConfig in diagnostics.py
@dataclass
class DiagnosticConfig:
    # Existing
    style_enabled: bool = True
    paradox_enabled: bool = True
    scope_timing_enabled: bool = True
    
    # New categories (based on existing partial implementations)
    event_structure_extended: bool = True  # CK3761-CK3769
    namespace_validation: bool = True       # CK3400-CK3406
    portrait_validation: bool = True        # CK3420-CK3426
    theme_validation: bool = True           # CK3430-CK3435
    description_validation: bool = True     # CK3440-CK3446
    option_validation: bool = True          # CK3450-CK3459
    on_action_validation: bool = True       # CK3500-CK3508
    localization_validation: bool = True    # CK3600-CK3604
    ai_chance_validation: bool = True       # CK3610-CK3614
```

### Cross-File Validation Requirements

Some checks require workspace-wide analysis (already have infrastructure):

- **CK3404** (Duplicate event ID): Use `DocumentIndex` event tracking
- **CK3501** (Unknown on_action): Index on_action definitions (need new index)
- **CK3600** (Missing localization): Use `workspace.calculate_localization_coverage()`

---

## Revised Summary Statistics

| Category | Implemented | Helpers Exist | Missing | Total |
|----------|-------------|---------------|---------|-------|
| Event Structure | 3 | 3 | 4 | 10 |
| Namespace/ID | 1 | 3 | 6 | 7 |
| Portrait | 0 | 5 | 6 | 6 |
| Theme/Background | 0 | 3 | 6 | 6 |
| Description | 0 | 2 | 7 | 7 |
| Option | 0 | 4 | 10 | 10 |
| On Action | 0 | 2 | 9 | 9 |
| Trigger Extensions | 5 | 1 | 6 | 9 |
| After Block | 0 | 1 | 4 | 4 |
| Localization | 0 | 6 | 5 | 5 |
| AI Chance | 0 | 2 | 5 | 5 |
| **Total** | **9** | **32** | **68** | **78** |

**Diagnostic Coverage: ~12%** (9 of 78 checks produce diagnostics)  
**Infrastructure Coverage: ~53%** (41 of 78 have some implementation)

### Key Finding
**32 checks have partial implementations** (helpers, data, or infrastructure) that just need to be wired to produce diagnostics. This is "low-hanging fruit" that can significantly increase coverage with minimal new code.
