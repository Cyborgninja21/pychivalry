# Story Cycles Schema Onboarding Plan

**Status:** ✅ Complete (Updated January 2026)  
**Priority:** High (narrative-driven mods depend on this)  
**Estimated Effort:** ~4-6 hours (COMPLETED)  
**Source:** Analysis of `_story_cycles.info` and 50+ base game files

---

## 1. Current State

From `feature_matrix.md`:

| Aspect | Current Status |
|--------|----------------|
| Location | `common/story_cycles/` |
| Required Fields | ✅ Validated via `story_cycles.yaml` |
| Effect/Trigger Context | ✅ Full context (`on_setup`, `on_end`, `on_owner_death`, `effect_group`) |
| Scope Chains | ✅ Working (`story_owner`, `scope:story`) |
| Cross-File Refs | ⚠️ Event references not indexed |
| Schema Status | ✅ **COMPLETE** |

**Implementation:** Schema-driven validation via `pychivalry/data/schemas/story_cycles.yaml`

---

## 2. Content Type Overview

**Story Cycles** are long-running background processes that track narrative arcs over time. Unlike one-shot events, story cycles persist across game sessions and periodically check conditions to fire effects or trigger events.

### Key Concepts

- **story_owner**: The character who "owns" the story cycle (typically `root`)
- **effect_group**: Timed blocks that fire effects at intervals
- **triggered_effect**: Conditional effects within an effect_group
- **first_valid**: Priority-based effect selection (like `first_valid` in events)

### Common Use Cases

| Example | Purpose | Key Pattern |
|---------|---------|-------------|
| `story_cycle_pet_dog.txt` | Pet lifecycle | Multiple `effect_group` with aging, random events, death |
| `story_cycle_friends_rival.txt` | Relationship tracking | Conditional events based on relationship state |
| `story_cycle_stress_threshold.txt` | Mental health | Trigger events at stress thresholds |
| `story_cycle_building_legend.txt` | Legend progression | Track chronicle progression |

---

## 3. Complete Field Reference

Based on `_story_cycles.info` (official documentation) and analysis of 50 base game files.

### 3.1 Core Lifecycle Hooks

| Field | Type | Scope | Required | Description |
|-------|------|-------|----------|-------------|
| `on_setup` | effect | `root = story_owner` | ❌ Optional | Fires when story is created (initialization) |
| `on_end` | effect | `root = story_owner` | ❌ Optional | Fires when story ends (cleanup) |
| `on_owner_death` | effect | `root = story_owner` | ⚠️ **Recommended** | Handles owner death (prevents orphaned stories) |

### 3.2 Effect Group Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effect_group = { }` | block | ✅ **At least one** | Timed effect container |

### 3.3 Timing Keywords (Inside `effect_group`)

| Field | Type | Format | Description |
|-------|------|--------|-------------|
| `days` | int/range | `30` or `{ 30 60 }` | Interval in days |
| `weeks` | int/range | `4` or `{ 2 4 }` | Interval in weeks |
| `months` | int/range | `6` or `{ 3 6 }` | Interval in months |
| `years` | int/range | `2` or `{ 1 3 }` | Interval in years |

**Note:** Exactly ONE timing keyword per `effect_group` (STORY-004 validates this).

### 3.4 Effect Group Parameters

| Field | Type | Default | Values/Range | Description |
|-------|------|---------|--------------|-------------|
| `chance` | int | 100 | 0-100 | Percentage chance to fire |
| `trigger` | trigger block | - | triggers | Condition to fire this group |

### 3.5 Effect Execution Patterns

#### Pattern A: `triggered_effect` (Multiple Conditional Effects)

```pdx
effect_group = {
    days = 30
    
    triggered_effect = {
        trigger = { <condition_1> }
        effect = { <effects_1> }
    }
    
    triggered_effect = {
        trigger = { <condition_2> }
        effect = { <effects_2> }
    }
}
```

#### Pattern B: `first_valid` (Priority Selection)

```pdx
effect_group = {
    days = 30
    
    first_valid = {
        triggered_effect = {
            trigger = { <high_priority_condition> }
            effect = { <effects> }
        }
        triggered_effect = {
            trigger = { <fallback_condition> }
            effect = { <fallback_effects> }
        }
    }
}
```

#### Pattern C: `random_valid` (Weighted Random Selection)

```pdx
effect_group = {
    days = 30
    
    random_valid = {
        triggered_effect = {
            weight = 100
            trigger = { <condition_1> }
            effect = { <effects_1> }
        }
        triggered_effect = {
            weight = 50
            trigger = { <condition_2> }
            effect = { <effects_2> }
        }
    }
}
```

#### Pattern D: `fallback` (Default if Nothing Matches)

```pdx
effect_group = {
    days = 30
    
    first_valid = {
        triggered_effect = { ... }
    }
    
    fallback = {
        <effects>  # Runs if no triggered_effect matches
    }
}
```

### 3.6 Triggered Effect Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trigger` | trigger block | ✅ **YES** | Condition to fire this effect |
| `effect` | effect block | ✅ **YES** | Effects to execute |
| `chance` | int | Optional | Override group chance (0-100) |
| `weight` | int | Optional | Weight for `random_valid` selection |

---

## 4. Nested Schema: effect_group

The `effect_group` is the core structure that makes story cycles tick.

### 4.1 Required Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Timing keyword | `days`/`weeks`/`months`/`years` | ✅ **ONE** | - | How often this group fires |

### 4.2 Optional Fields

| Field | Scope | Description |
|-------|-------|-------------|
| `chance` | - | Percentage chance to fire (0-100) |
| `trigger` | `root = story_owner` | Condition to evaluate |
| `triggered_effect` | `root = story_owner` | Conditional effect (repeatable) |
| `first_valid` | - | Priority-based selection container |
| `random_valid` | - | Weighted random selection container |
| `fallback` | `root = story_owner` | Default effects if nothing matches |

---

## 5. Nested Schema: triggered_effect

### 5.1 Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trigger` | trigger block | ✅ **YES** | Condition to fire this effect |
| `effect` | effect block | ✅ **YES** | Effects to execute |

### 5.2 Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `chance` | int | Override group chance (0-100) |
| `weight` | int | Weight for `random_valid` (default: 1) |

---

## 6. Scope Reference

| Scope | Type | Description |
|-------|------|-------------|
| `story_owner` | character | The character who owns the story |
| `scope:story` | story | The story cycle itself |
| `root` | story | In story context, root is the story |
| `var:*` | any | Variables stored on the story |

### Common Story Operations

```pdx
# End the story
scope:story = { end_story = yes }

# Store variable on story
set_variable = { name = my_var value = 5 }

# Access story owner
story_owner = { trigger_event = my_event.001 }
```

---

## 7. Diagnostic Codes (IMPLEMENTED)

| Code | Severity | Description |
|------|----------|-------------|
| **STORY-001** | Error | Effect group missing timing keyword (`days`/`weeks`/`months`/`years`) |
| **STORY-004** | Error | Multiple timing keywords in effect_group |
| **STORY-005** | Error | `triggered_effect` missing required `trigger` block |
| **STORY-006** | Error | `triggered_effect` missing required `effect` block |
| **STORY-007** | Error | Story cycle has no `effect_group` blocks |
| **STORY-020** | Warning | Missing `on_owner_death` handler (may persist indefinitely) |
| **STORY-022** | Warning | Effect group without trigger fires unconditionally |
| **STORY-023** | Warning | `chance` value exceeds 100% |
| **STORY-024** | Warning | `chance` value is 0 or negative (effect never fires) |
| **STORY-025** | Warning | No effect selection pattern (triggered_effect/first_valid/random_valid) |
| **STORY-027** | Warning | Mixing `triggered_effect` with `first_valid`/`random_valid` in same effect_group |
| **STORY-040** | Info | Empty `on_setup` block |
| **STORY-041** | Info | Empty `on_end` block |
| **STORY-043** | Info | Very short interval (< 7 days) - performance concern |
| **STORY-044** | Info | Very long interval (> 10 years) - may never fire |

---

## 8. Schema File Reference

**File:** `pychivalry/data/schemas/story_cycles.yaml`

### Current Implementation

```yaml
version: "1.0"
file_type: story_cycle

identification:
  path_patterns:
    - "common/story_cycles/*.txt"

fields:
  on_setup:
    type: effect
    required: false
    description: "Fires when story cycle is created"
    
  on_end:
    type: effect
    required: false
    description: "Fires when story cycle ends"
    
  on_owner_death:
    type: effect
    required: false
    description: "Fires when story owner dies"
    
  effect_group:
    type: nested
    multiple: true
    required: true
    schema: effect_group

nested_schemas:
  effect_group:
    fields:
      days: { type: int_or_range }
      weeks: { type: int_or_range }
      months: { type: int_or_range }
      years: { type: int_or_range }
      chance: { type: int, range: [0, 100] }
      trigger: { type: trigger }
      triggered_effect: { type: nested, multiple: true, schema: triggered_effect }
      first_valid: { type: container }
      random_valid: { type: container }
      fallback: { type: effect }
```

---

## 9. Validation Priority Matrix

| Priority | Field/Block | Reason | Status |
|----------|-------------|--------|--------|
| P0 | `effect_group` required | Story does nothing without it | ✅ STORY-007 |
| P0 | Timing keyword required | Effect group timing undefined | ✅ STORY-001 |
| P0 | Single timing keyword | Ambiguous interval | ✅ STORY-004 |
| P1 | `triggered_effect` structure | Core pattern validation | ✅ STORY-005, STORY-006 |
| P1 | `on_owner_death` handler | Prevents orphaned stories | ✅ STORY-020 |
| P2 | Chance range validation | Common error | ✅ STORY-023, STORY-024 |
| P3 | Performance hints | Nice to have | ✅ STORY-043, STORY-044 |

---

## 10. Cross-Reference Index

| Reference Type | Location | Indexing Status |
|----------------|----------|-----------------|
| Event IDs | `trigger_event = { id = X }` | ⚠️ Not indexed |
| On-Actions | `trigger_event = { on_action = X }` | ⚠️ Not indexed |
| Scripted Effects | `effect = { scripted_effect = yes }` | ✅ Validated |
| Scripted Triggers | `trigger = { scripted_trigger = yes }` | ✅ Validated |
| Modifiers | `add_character_modifier` | ⚠️ Not cross-validated |

---

## 11. Success Criteria

- [x] Story Cycles appears in Table 1 of feature_matrix.md
- [x] Required fields validated (`effect_group`, timing keywords)
- [x] Diagnostic codes documented (15 codes: STORY-001 through STORY-044)
- [x] Nested schemas defined (`effect_group`, `triggered_effect`, `first_valid`)
- [x] Code lens support (effect_group count, triggered_effect details)
- [x] Document symbols (story cycle names, effect_groups)
- [ ] Cross-file event reference validation (future work)

---

## 12. Future Enhancements

### 12.1 Cross-File Event Indexing

```pdx
# Currently not validated - event may not exist
story_owner = {
    trigger_event = {
        id = my_event.001  # Should validate event exists
    }
}
```

### 12.2 On-Action Reference Validation

```pdx
trigger_event = {
    on_action = ongoing_dog_events  # Should validate on_action exists
}
```

### 12.3 Variable Usage Tracking

```pdx
# Could track that var:dog_age_variable is used
set_variable = { name = dog_age_variable value = 0 }
# ...later...
exists = var:dog_age_variable  # Could validate variable was set
```

---

## 13. Related Documentation

| Document | Location |
|----------|----------|
| Diagnostic Codes Reference | `Documentation/diagnostics/Diagnostic codes - Story Cycles.md` |
| Schema YAML | `pychivalry/data/schemas/story_cycles.yaml` |
| Official Info File | `game/common/story_cycles/_story_cycles.info` |
| Feature Matrix | `Documentation/feature_matrix.md` |

---

## 14. Example: Complete Story Cycle

From `story_cycle_pet_dog.txt`:

```pdx
story_cycle_pet_dog = {

    # Initialization - set up variables, add modifiers
    on_setup = {
        set_variable = { name = dog_age_variable value = 0 }
        story_owner = {
            add_character_modifier = { modifier = dog_story_modifier }
        }
    }

    # Cleanup - remove modifiers when story ends
    on_end = {
        story_owner = {
            remove_dog_story_modifiers_effect = yes
        }
    }

    # Handle owner death - prevent orphaned story
    on_owner_death = {
        # Transfer info to heir for funeral events
        if = {
            limit = { exists = story_owner.player_heir }
            story_owner.player_heir = {
                set_variable = { name = dead_dog_owner value = root.story_owner }
            }
        }
        scope:story = { end_story = yes }
    }

    # Age the dog annually
    effect_group = {
        days = 365
        trigger = { exists = var:dog_age_variable }
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                change_variable = { name = dog_age_variable add = 1 }
            }
        }
    }

    # Dog dies after 5-7 years
    effect_group = {
        days = { 5000 7000 }
        chance = 100
        triggered_effect = {
            trigger = { exists = story_owner.var:story_cycle_dog_name }
            effect = {
                story_owner = { trigger_event = pet_animal.1199 }
            }
        }
    }

    # Random events throughout dog's life
    effect_group = {
        days = { 365 600 }
        chance = 30
        trigger = {
            exists = story_owner.var:story_cycle_dog_name
            story_owner = { NOT = { has_character_flag = dog_is_dying } }
        }
        first_valid = {
            triggered_effect = {
                trigger = { always = yes }
                effect = {
                    story_owner = {
                        trigger_event = { on_action = ongoing_dog_events }
                    }
                }
            }
        }
    }
}
```

---

## Summary

**Story Cycles schema validation is COMPLETE.** The schema covers:

- ✅ All lifecycle hooks (`on_setup`, `on_end`, `on_owner_death`)
- ✅ Effect group structure and timing validation
- ✅ Nested `triggered_effect` validation
- ✅ `first_valid`/`random_valid`/`fallback` patterns
- ✅ 15 diagnostic codes with appropriate severities
- ✅ Performance hints for extreme intervals

**Future work:** Cross-file event reference indexing.
