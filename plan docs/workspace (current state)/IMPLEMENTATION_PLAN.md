# CK3 Language Server - Implementation Plan

This document outlines the phased implementation plan for adding missing validation checks to the pychivalry CK3 Language Server.

> **Reference Documents:**
> - [DIAGNOSTIC_CODES.md](parts/DIAGNOSTIC_CODES.md) - Currently implemented checks (42 codes)
> - [VALIDATION_GAPS.md](parts/VALIDATION_GAPS.md) - Missing checks analysis (68 proposed)
> - [CK3_EVENT_MODDING.md](parts/CK3_EVENT_MODDING.md) - CK3 modding reference

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Quick Wins](#phase-1-quick-wins-wire-existing-helpers)
3. [Phase 2: Event Structure](#phase-2-event-structure-validation)
4. [Phase 3: Namespace & ID](#phase-3-namespace--id-validation)
5. [Phase 4: Trigger Extensions](#phase-4-trigger-block-extensions)
6. [Phase 5: Portrait Validation](#phase-5-portrait-validation)
7. [Phase 6: Theme & Background](#phase-6-theme--background-validation)
8. [Phase 7: Description Validation](#phase-7-description-block-validation)
9. [Phase 8: Option Validation](#phase-8-option-block-validation)
10. [Phase 9: On Action Validation](#phase-9-on-action-validation)
11. [Phase 10: Localization](#phase-10-localization-validation)
12. [Phase 11: After Block](#phase-11-after-block-validation)
13. [Phase 12: AI Chance](#phase-12-ai-chance-validation)
14. [Data Files Required](#data-files-required)
15. [Testing Strategy](#testing-strategy)
16. [Configuration Updates](#configuration-updates)

---

## Executive Summary

### Current State (Updated)
- **61 diagnostic codes** IMPLEMENTED across 4 modules (Phase 1 & 2 complete)
- **Base checks (42 codes)** + **Phase 1 (12 codes)** + **Phase 2 overlap (7 codes, 5 unique)**
- **66 proposed checks** remain unimplemented (Phases 3-12)

### Implementation Strategy
- **12 phases** organized by priority and complexity
- **Phase 1** delivers 12 new diagnostics with minimal code changes
- **Phases 2-4** are high priority (critical for modding)
- **Phases 5-12** are medium/lower priority (quality improvements)

### Expected Outcomes
| Phase | New Codes | Cumulative Total | Status |
|-------|-----------|------------------|--------|
| Phase 1 | 12 | 54 | ✅ Complete |
| Phase 2 | 7 | 61 | ✅ Complete |
| Phase 3 | 7 | 68 | 🔴 Not Started |
| Phase 4 | 6 | 74 | 🔴 Not Started |
| Phase 5 | 7 | 81 | 🔴 Not Started |
| Phase 6 | 6 | 87 | 🔴 Not Started |
| Phase 7 | 7 | 94 | 🔴 Not Started |
| Phase 8 | 10 | 104 | 🔴 Not Started |
| Phase 9 | 9 | 113 | 🔴 Not Started |
| Phase 10 | 5 | 118 | 🔴 Not Started |
| Phase 11 | 4 | 122 | 🔴 Not Started |
| Phase 12 | 5 | 127 | 🔴 Not Started |

---

## Phase 1: Quick Wins (Wire Existing Helpers)

**Priority:** 🔴 Critical  
**Effort:** Low  
**Impact:** High  
**Dependencies:** None  
**Status:** ✅ **COMPLETE**

All Phase 1 checks are fully implemented and active in `paradox_checks.py`.

### Tasks

#### 1.1 Wire Event Type Validation (CK3761)

**File:** `paradox_checks.py`  
**Helper:** `events.is_valid_event_type()`  
**Data:** `events.EVENT_TYPES` (already complete)

```python
# Add to paradox_checks.py
def check_event_type_valid(node: CK3Node) -> List[Diagnostic]:
    """CK3761: Invalid event type"""
    if node.key == "type" and node.parent_is_event():
        if not is_valid_event_type(node.value):
            return [Diagnostic(
                range=node.range,
                message=f"Invalid event type '{node.value}'. Must be: character_event, letter_event, duel_event, none, or empty",
                severity=DiagnosticSeverity.Error,
                code="CK3761"
            )]
    return []
```

#### 1.2 Wire Missing Desc Validation (CK3764)

**File:** `paradox_checks.py`  
**Helper:** `events.validate_event_fields()`

```python
# Add to paradox_checks.py
def check_event_has_desc(node: CK3Node) -> List[Diagnostic]:
    """CK3764: Missing desc in non-hidden event"""
    if node.is_event() and not node.has_child("hidden"):
        if not node.has_child("desc"):
            return [Diagnostic(
                range=node.range,
                message="Non-hidden event lacks 'desc' field",
                severity=DiagnosticSeverity.Warning,
                code="CK3764"
            )]
    return []
```

#### 1.3 Wire Option Name Validation (CK3450)

**File:** `paradox_checks.py`  
**Helper:** `events.validate_option()`

```python
# Add to paradox_checks.py  
def check_option_has_name(node: CK3Node) -> List[Diagnostic]:
    """CK3450: Option missing name"""
    if node.key == "option" and node.is_block():
        if not node.has_child("name"):
            return [Diagnostic(
                range=node.range,
                message="Option block lacks required 'name' parameter",
                severity=DiagnosticSeverity.Error,
                code="CK3450"
            )]
    return []
```

#### 1.4 Wire triggered_desc Validation (CK3440-CK3441)

**File:** `paradox_checks.py`  
**Helper:** `events.validate_dynamic_description()`

```python
# Add to paradox_checks.py
def check_triggered_desc_structure(node: CK3Node) -> List[Diagnostic]:
    """CK3440/CK3441: triggered_desc missing trigger or desc"""
    diagnostics = []
    if node.key == "triggered_desc" and node.is_block():
        if not node.has_child("trigger"):
            diagnostics.append(Diagnostic(
                range=node.range,
                message="triggered_desc block lacks required 'trigger' block",
                severity=DiagnosticSeverity.Error,
                code="CK3440"
            ))
        if not node.has_child("desc"):
            diagnostics.append(Diagnostic(
                range=node.range,
                message="triggered_desc block lacks required 'desc'",
                severity=DiagnosticSeverity.Error,
                code="CK3441"
            ))
    return diagnostics
```

#### 1.5 Wire Localization Coverage (CK3600)

**File:** `workspace.py` → Create `workspace_diagnostics.py`  
**Helper:** `workspace.calculate_localization_coverage()`

```python
# Create new file: workspace_diagnostics.py
def check_missing_localization(event_node: CK3Node, loc_index: Dict) -> List[Diagnostic]:
    """CK3600: Missing localization key"""
    diagnostics = []
    keys = extract_localization_keys_from_event(event_node)
    for key in keys:
        if key not in loc_index:
            diagnostics.append(Diagnostic(
                range=key.range,
                message=f"Localization key '{key.name}' not found in localization files",
                severity=DiagnosticSeverity.Warning,
                code="CK3600"
            ))
    return diagnostics
```

#### 1.6 Wire Portrait Position Validation (CK3420)

**File:** `paradox_checks.py`  
**Helper:** `events.is_valid_portrait_position()`  
**Data:** `events.PORTRAIT_POSITIONS` (already complete)

```python
# Add to paradox_checks.py
def check_portrait_position(node: CK3Node) -> List[Diagnostic]:
    """CK3420: Invalid portrait position"""
    if node.key.endswith("_portrait") and node.is_block():
        if not is_valid_portrait_position(node.key):
            return [Diagnostic(
                range=node.range,
                message=f"Invalid portrait position '{node.key}'. Valid: left_portrait, right_portrait, lower_left_portrait, lower_center_portrait, lower_right_portrait",
                severity=DiagnosticSeverity.Error,
                code="CK3420"
            )]
    return []
```

#### 1.7 Wire Portrait Character Check (CK3421)

**File:** `paradox_checks.py`  
**Helper:** `events.validate_portrait_configuration()`

```python
# Add to paradox_checks.py
def check_portrait_has_character(node: CK3Node) -> List[Diagnostic]:
    """CK3421: Portrait missing character"""
    if is_valid_portrait_position(node.key) and node.is_block():
        if not node.has_child("character"):
            return [Diagnostic(
                range=node.range,
                message=f"Portrait block lacks required 'character' parameter",
                severity=DiagnosticSeverity.Warning,
                code="CK3421"
            )]
    return []
```

#### 1.8 Wire Theme Validation (CK3430)

**File:** `paradox_checks.py`  
**Helper:** `events.is_valid_theme()`  
**Data:** `events.EVENT_THEMES` (needs expansion - see Phase 6)

```python
# Add to paradox_checks.py
def check_theme_valid(node: CK3Node) -> List[Diagnostic]:
    """CK3430: Invalid theme"""
    if node.key == "theme":
        if not is_valid_theme(node.value):
            return [Diagnostic(
                range=node.range,
                message=f"Unknown theme '{node.value}'",
                severity=DiagnosticSeverity.Warning,
                code="CK3430"
            )]
    return []
```

### Additional Quick Wins

| Code | Check | Helper Location |
|------|-------|-----------------|
| CK3762 | Hidden event with options | Check `hidden=yes` + `option` blocks |
| CK3766 | Multiple after blocks | Same pattern as CK3768 |
| CK3767 | Empty event block | Check if event has no children |
| CK3769 | No portraits | Check non-hidden event lacks portrait positions |

### Deliverables
- [x] Update `paradox_checks.py` with new check functions
- [ ] Create `workspace_diagnostics.py` for cross-file checks (deferred)
- [x] Add new codes to `DIAGNOSTIC_CODES.md`
- [ ] Add tests for each new check in `test_paradox_checks.py`

### Implementation Summary
All 12 Phase 1 checks implemented:
- ✅ CK3761: Invalid event type
- ✅ CK3764: Missing desc
- ✅ CK3450: Option missing name
- ✅ CK3440: triggered_desc missing trigger
- ✅ CK3441: triggered_desc missing desc
- ✅ CK3420: Invalid portrait position
- ✅ CK3421: Portrait missing character
- ✅ CK3422: Invalid animation
- ✅ CK3430: Invalid theme
- ✅ CK3762: Hidden event with options
- ✅ CK3766: Multiple after blocks
- ✅ CK3767: Empty event block

### Actual Effort
- **Code Changes:** ~400 lines
- **Time:** Completed

---

## Phase 2: Event Structure Validation

**Priority:** 🔴 Critical  
**Effort:** Low-Medium  
**Impact:** High  
**Dependencies:** Phase 1  
**Status:** ✅ **COMPLETE**

All Phase 2 checks are fully implemented and active in `paradox_checks.py`.

### Tasks

#### 2.1 Hidden Event with Options (CK3762)

```python
def check_hidden_event_options(node: CK3Node) -> List[Diagnostic]:
    """CK3762: Hidden event with options (options are ignored)"""
    if node.is_event():
        is_hidden = node.find_child("hidden")
        if is_hidden and is_hidden.value == "yes":
            options = node.find_children("option")
            if options:
                return [Diagnostic(
                    range=options[0].range,
                    message="Hidden event has option blocks which will be ignored",
                    severity=DiagnosticSeverity.Warning,
                    code="CK3762"
                )]
    return []
```

#### 2.2 Multiple After Blocks (CK3766)

```python
def check_multiple_after_blocks(node: CK3Node) -> List[Diagnostic]:
    """CK3766: Multiple after blocks (only first executes)"""
    if node.is_event():
        after_blocks = node.find_children("after")
        if len(after_blocks) > 1:
            return [Diagnostic(
                range=after_blocks[1].range,
                message="Multiple 'after' blocks - only the first executes",
                severity=DiagnosticSeverity.Error,
                code="CK3766"
            )]
    return []
```

#### 2.3 Empty Event Block (CK3767)

```python
def check_empty_event(node: CK3Node) -> List[Diagnostic]:
    """CK3767: Empty event block"""
    if node.is_event():
        meaningful_children = [c for c in node.children 
                              if c.key not in ("type", "hidden")]
        if not meaningful_children:
            return [Diagnostic(
                range=node.range,
                message="Event block contains no meaningful content",
                severity=DiagnosticSeverity.Warning,
                code="CK3767"
            )]
    return []
```

#### 2.4 No Portraits (CK3769)

```python
def check_event_has_portraits(node: CK3Node) -> List[Diagnostic]:
    """CK3769: Non-hidden event has no portraits"""
    if node.is_event():
        is_hidden = node.find_child("hidden")
        if not is_hidden or is_hidden.value != "yes":
            portrait_positions = ["left_portrait", "right_portrait", 
                                 "lower_left_portrait", "lower_center_portrait",
                                 "lower_right_portrait"]
            has_portrait = any(node.has_child(p) for p in portrait_positions)
            if not has_portrait:
                return [Diagnostic(
                    range=node.range,
                    message="Non-hidden event has no portrait positions defined",
                    severity=DiagnosticSeverity.Information,
                    code="CK3769"
                )]
    return []
```

### Remaining Tasks
- [ ] CK3765: Missing title (optional but recommended)
- [ ] Event type context validation (character_event needs character scope)
- [ ] Integrate with existing CK3760, CK3763, CK3768 checks

### Deliverables
- [x] Complete event structure validation in `paradox_checks.py`
- [ ] Unit tests for all 7 checks
- [ ] Integration test with complete event example

### Implementation Summary
All 7 Phase 2 checks implemented:
- ✅ CK3762: Hidden event with options (line 866)
- ✅ CK3766: Multiple after blocks (line 913)
- ✅ CK3767: Empty event block (line 953)
- ✅ CK3769: No portraits (line 993)
- ✅ CK3760: Missing event type (already in base checks)
- ✅ CK3763: Event no options (already in base checks)
- ✅ CK3768: Multiple immediate blocks (already in base checks)

### Actual Effort
- **Code Changes:** ~200 lines
- **Time:** Completed

---

## Phase 3: Namespace & ID Validation

**Priority:** 🔴 Critical  
**Effort:** Medium  
**Impact:** High  
**Dependencies:** Phase 1 (uses existing namespace tracking in `code_lens.py`)

### Tasks

#### 3.1 Missing Namespace (CK3400)

```python
def check_file_has_namespace(document: TextDocument, ast: List[CK3Node]) -> List[Diagnostic]:
    """CK3400: File has events but no namespace declaration"""
    has_namespace = any(node.key == "namespace" for node in ast)
    has_events = any(is_event_definition(node) for node in ast)
    
    if has_events and not has_namespace:
        return [Diagnostic(
            range=Range(Position(0, 0), Position(0, 0)),
            message="File contains events but no namespace declaration",
            severity=DiagnosticSeverity.Error,
            code="CK3400"
        )]
    return []
```

#### 3.2 Event ID Mismatch (CK3401)

```python
def check_event_namespace_match(node: CK3Node, namespace: str) -> List[Diagnostic]:
    """CK3401: Event ID doesn't use declared namespace"""
    if is_event_definition(node):
        event_id = node.key  # e.g., "my_events.1"
        event_namespace = event_id.split(".")[0] if "." in event_id else ""
        if event_namespace != namespace:
            return [Diagnostic(
                range=node.range,
                message=f"Event '{event_id}' uses namespace '{event_namespace}' but file declares '{namespace}'",
                severity=DiagnosticSeverity.Error,
                code="CK3401"
            )]
    return []
```

#### 3.3 Event ID > 9999 (CK3402)

```python
def check_event_id_range(node: CK3Node) -> List[Diagnostic]:
    """CK3402: Event ID exceeds 9999 (causes buggy event calling)"""
    if is_event_definition(node) and "." in node.key:
        try:
            event_num = int(node.key.split(".")[-1])
            if event_num > 9999:
                return [Diagnostic(
                    range=node.range,
                    message=f"Event ID {event_num} exceeds 9999. IDs > 9999 cause buggy event calling.",
                    severity=DiagnosticSeverity.Warning,
                    code="CK3402"
                )]
        except ValueError:
            pass
    return []
```

#### 3.4 Invalid Namespace Characters (CK3403)

```python
def check_namespace_characters(node: CK3Node) -> List[Diagnostic]:
    """CK3403: Namespace contains invalid characters"""
    if node.key == "namespace":
        namespace = node.value
        if not namespace.replace("_", "").isalnum() or "." in namespace:
            return [Diagnostic(
                range=node.range,
                message=f"Namespace '{namespace}' contains invalid characters. Use only alphanumeric and underscores.",
                severity=DiagnosticSeverity.Error,
                code="CK3403"
            )]
    return []
```

#### 3.5 Duplicate Event ID (CK3404)

**Requires:** Workspace-level validation using `DocumentIndex`

```python
def check_duplicate_event_ids(index: DocumentIndex) -> Dict[str, List[Diagnostic]]:
    """CK3404: Duplicate event ID across workspace"""
    diagnostics_by_file = {}
    event_locations = {}  # event_id -> [(file, range), ...]
    
    for file, events in index.events.items():
        for event_id, event_range in events:
            if event_id not in event_locations:
                event_locations[event_id] = []
            event_locations[event_id].append((file, event_range))
    
    for event_id, locations in event_locations.items():
        if len(locations) > 1:
            for file, range in locations:
                if file not in diagnostics_by_file:
                    diagnostics_by_file[file] = []
                other_files = [f for f, r in locations if f != file]
                diagnostics_by_file[file].append(Diagnostic(
                    range=range,
                    message=f"Duplicate event ID '{event_id}'. Also defined in: {', '.join(other_files)}",
                    severity=DiagnosticSeverity.Error,
                    code="CK3404"
                ))
    
    return diagnostics_by_file
```

#### 3.6 Additional Checks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3405 | Non-sequential IDs | Compare consecutive event IDs for large gaps |
| CK3406 | Invalid event ID format | Validate `namespace.number` pattern |

### Deliverables
- [ ] Namespace validation functions in `paradox_checks.py`
- [ ] Workspace-level duplicate detection using `DocumentIndex`
- [ ] Update indexer to track event IDs with locations
- [ ] Tests for all 7 checks

### Estimated Effort
- **Code Changes:** ~250 lines
- **Time:** 3-5 hours

---

## Phase 4: Trigger Block Extensions

**Priority:** 🔴 Critical  
**Effort:** Medium  
**Impact:** High  
**Dependencies:** None

### Tasks

#### 4.1 trigger_else Without trigger_if (CK3510)

```python
def check_trigger_else_structure(node: CK3Node) -> List[Diagnostic]:
    """CK3510: trigger_else without preceding trigger_if"""
    diagnostics = []
    if node.key == "trigger" and node.is_block():
        children = node.children
        for i, child in enumerate(children):
            if child.key == "trigger_else":
                # Check if preceded by trigger_if
                has_trigger_if = any(
                    c.key == "trigger_if" 
                    for c in children[:i]
                )
                if not has_trigger_if:
                    diagnostics.append(Diagnostic(
                        range=child.range,
                        message="trigger_else without preceding trigger_if",
                        severity=DiagnosticSeverity.Error,
                        code="CK3510"
                    ))
    return diagnostics
```

#### 4.2 Multiple trigger_else (CK3511)

```python
def check_multiple_trigger_else(node: CK3Node) -> List[Diagnostic]:
    """CK3511: Multiple trigger_else blocks (only first executes)"""
    if node.key == "trigger" and node.is_block():
        trigger_else_blocks = [c for c in node.children if c.key == "trigger_else"]
        if len(trigger_else_blocks) > 1:
            return [Diagnostic(
                range=trigger_else_blocks[1].range,
                message="Multiple trigger_else blocks - only the first executes",
                severity=DiagnosticSeverity.Warning,
                code="CK3511"
            )]
    return []
```

#### 4.3 trigger_if Missing limit (CK3512)

```python
def check_trigger_if_has_limit(node: CK3Node) -> List[Diagnostic]:
    """CK3512: trigger_if block lacks required 'limit' block"""
    if node.key == "trigger_if" and node.is_block():
        if not node.has_child("limit"):
            return [Diagnostic(
                range=node.range,
                message="trigger_if block lacks required 'limit' block",
                severity=DiagnosticSeverity.Error,
                code="CK3512"
            )]
    return []
```

#### 4.4 Empty trigger_if limit (CK3513)

```python
def check_trigger_if_empty_limit(node: CK3Node) -> List[Diagnostic]:
    """CK3513: trigger_if with empty limit always passes"""
    if node.key == "trigger_if" and node.is_block():
        limit = node.find_child("limit")
        if limit and limit.is_block() and not limit.children:
            return [Diagnostic(
                range=limit.range,
                message="trigger_if with empty limit always passes",
                severity=DiagnosticSeverity.Warning,
                code="CK3513"
            )]
    return []
```

#### 4.5 Additional Checks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3514 | on_trigger_fail defined | Information diagnostic |
| CK3515 | Duplicate trigger conditions | Compare trigger children for duplicates |

### Deliverables
- [ ] Trigger extension validation in `paradox_checks.py`
- [ ] Tests for all 6 checks
- [ ] Update documentation

### Estimated Effort
- **Code Changes:** ~150 lines
- **Time:** 2-3 hours

---

## Phase 5: Portrait Validation

**Priority:** 🟡 Medium  
**Effort:** Medium-High  
**Impact:** Medium  
**Dependencies:** Phase 1 (basic portrait checks), Data file creation

### Prerequisites: Create animations.yaml

**Location:** `pychivalry/data/animations.yaml`

Extract from CK3_EVENT_MODDING.md:

```yaml
# pychivalry/data/animations.yaml
basic_emotions:
  - idle
  - chancellor
  - steward
  - marshal
  - spymaster
  - chaplain
  - anger
  - rage
  - disapproval
  - disbelief
  - disgust
  - fear
  - sadness
  - shame
  - shock
  - worry
  - boredom
  - grief
  - paranoia
  - dismissal
  - flirtation
  - flirtation_left
  - love
  - schadenfreude
  - stress
  - happiness
  - ecstasy
  - admiration
  - lunatic
  - scheme

actions_states:
  - beg
  - pain
  - poison
  - aggressive_axe
  - aggressive_mace
  - aggressive_sword
  - aggressive_dagger
  - aggressive_spear
  - aggressive_hammer
  - celebrate_axe
  - celebrate_mace
  - celebrate_sword
  - celebrate_dagger
  - celebrate_spear
  - celebrate_hammer
  - loss_1
  - chess_certain_win
  - chess_cocky
  - laugh
  - lantern
  - eyeroll
  - eavesdrop
  - assassin
  - toast
  - toast_goblet
  - drink
  - drink_goblet
  - newborn
  - sick
  - severelywounded
  - prisonhouse
  - prisondungeon
  - war_attacker
  - war_defender
  - war_over_tie
  - war_over_win
  - war_over_loss
  - pregnant

personality:
  - personality_honorable
  - personality_dishonorable
  - personality_bold
  - personality_coward
  - personality_greedy
  - personality_content
  - personality_vengeful
  - personality_forgiving
  - personality_rational
  - personality_irrational
  - personality_compassionate
  - personality_callous
  - personality_zealous
  - personality_cynical

throne_room:
  - throne_room_chancellor
  - throne_room_kneel_1
  - throne_room_kneel_2
  - throne_room_curtsey_1
  - throne_room_messenger_1
  - throne_room_messenger_2
  - throne_room_messenger_3
  - throne_room_conversation_1
  - throne_room_conversation_2
  - throne_room_conversation_3
  - throne_room_conversation_4
  - throne_room_cheer_1
  - throne_room_cheer_2
  - throne_room_applaud_1
  - throne_room_bow_1
  - throne_room_bow_2
  - throne_room_bow_3
  - throne_room_ruler
  - throne_room_ruler_2
  - throne_room_ruler_3
  - throne_room_one_handed_passive_1
  - throne_room_one_handed_passive_2
  - throne_room_two_handed_passive_1
  - throne_room_writer

special:
  - crying
  - delirium
  - disappointed
  - eccentric
  - manic
  - interested
  - interested_left
  - stunned
  - wailing
  - wedding_happy_cry
  - peekaboo
  - child_hobby_horse
  - clutching_toy
  - clutching_ball
  - clutching_doll
  - go_to_your_room
  - cough
  - shiver
  - sick_stomach
  - page_flipping
  - writing
  - reading
  - stressed_teacher
  - happy_teacher
  - thinking
  - emotion_thinking_scepter
  - wedding_drunk
  - acknowledging
  - betting
  - bribing
  - dancing
  - dancing_plague
  - debating
  - hero_flex
  - obsequious_bow
  - physician
  - prayer
  - scepter
  - stayback
  - storyteller
  - survey
  - incapable
  - dead
  - survey_staff

combat:
  - aggressive_unarmed
  - sword_coup_degrace
  - wrestling_victory
  - sword_yield_start
  - wrestling_yield_start
  - wooden_sword_yield_start
  - throne_room_wooden_sword
  - celebrate_wooden_sword
  - aggressive_wooden_sword
  - marshal_wooden_sword
  - wooden_sword_coup_degrace
  - random_weapon_coup_degrace
  - random_weapon_aggressive
  - random_weapon_celebrate
  - random_weapon_yield
  - inspect_weapon
  - menacing
  - threatening

hunting_sports:
  - bow_idle
  - hunting_shortbow_rest_arrow_default
  - hunting_shortbow_rest_bluntarrow_default
  - hunting_shortbow_aim_arrow_default
  - hunting_shortbow_aim_bluntarrow_default
  - hunting_longbow_rest_arrow_default
  - hunting_longbow_rest_bluntarrow_default
  - hunting_longbow_aim_arrow_default
  - hunting_longbow_aim_bluntarrow_default
  - hunting_horn
  - hunting_carcass_start
  - hunting_knife_start
  - hunting_falcon
  - jockey_lance_tilted
  - jockey_lance_couched_gallop
  - jockey_gallop
  - jockey_idle
  - jockey_victory
  - jockey_loss
  - jockey_walk
  - jockey_wave
  - chariot_neutral
  - chariot_happy
  - chariot_shocked

wedding_music:
  - wedding_groom_right
  - wedding_bride_left
  - wedding_priest
  - reception_groom_left
  - reception_bride_right
  - wedding_objection_start
  - instrument_active
  - instrument_idle
  - shawm_active
  - shawm_idle
  - qanun_active
  - qanun_idle
  - lute_active
  - lute_idle
  - chifonie_active
  - chifonie_idle
  - alto_flute_active
  - alto_flute_idle
```

### Tasks

#### 5.1 Load Animation Data

```python
# In pychivalry/data/__init__.py
def load_animations() -> Set[str]:
    """Load all valid animation names from animations.yaml"""
    data_path = Path(__file__).parent / "animations.yaml"
    with open(data_path) as f:
        data = yaml.safe_load(f)
    
    animations = set()
    for category in data.values():
        animations.update(category)
    return animations

VALID_ANIMATIONS = load_animations()
```

#### 5.2 Invalid Animation Check (CK3422)

```python
def check_animation_valid(node: CK3Node) -> List[Diagnostic]:
    """CK3422: Invalid animation name"""
    if node.key == "animation" and node.value:
        if node.value not in VALID_ANIMATIONS:
            return [Diagnostic(
                range=node.range,
                message=f"Unknown animation '{node.value}'",
                severity=DiagnosticSeverity.Warning,
                code="CK3422"
            )]
    return []
```

#### 5.3 Additional Portrait Checks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3423 | triggered_animation missing trigger | Check block structure |
| CK3424 | triggered_animation missing animation | Check block structure |
| CK3425 | triggered_outfit missing trigger | Check block structure |
| CK3426 | Duplicate portrait position | Track positions in event |

### Deliverables
- [ ] Create `animations.yaml` data file (~150 animations)
- [ ] Update `events.py` to use data file instead of hardcoded set
- [ ] Add animation validation to `paradox_checks.py`
- [ ] Tests for portrait validation

### Estimated Effort
- **Code Changes:** ~200 lines + data file
- **Time:** 4-6 hours

---

## Phase 6: Theme & Background Validation

**Priority:** 🟡 Medium  
**Effort:** Medium  
**Impact:** Medium  
**Dependencies:** Data file creation

### Prerequisites: Create Data Files

#### themes.yaml

```yaml
# pychivalry/data/themes.yaml
focus_themes:
  - diplomacy_family_focus
  - diplomacy_foreign_affairs_focus
  - diplomacy_majesty_focus
  - intrigue_intimidation_focus
  - intrigue_skulduggery_focus
  - intrigue_temptation_focus
  - learning_medicine_focus
  - learning_scholarship_focus
  - learning_theology_focus
  - martial_authority_focus
  - martial_chivalry_focus
  - martial_strategy_focus
  - stewardship_domain_focus
  - stewardship_duty_focus
  - stewardship_wealth_focus

scheme_themes:
  - abduct_scheme
  - befriend_scheme
  - claim_throne_scheme
  - fabricate_hook_scheme
  - generic_intrigue_scheme
  - murder_scheme
  - romance_scheme
  - seduce_scheme
  - sway_scheme

activity_themes:
  - feast_activity
  - hunt_activity
  - pilgrimage_activity

relation_themes:
  - friend_relation
  - lover_relation
  - rival_relation

general_themes:
  - alliance
  - bastardy
  - battle
  - corruption
  - crown
  - culture_change
  - death
  - default
  - diplomacy
  - dread
  - dungeon
  - dynasty
  - education
  - faith
  - family
  - friendly
  - healthcare
  - hunting
  - intrigue
  - learning
  - love
  - marriage
  - martial
  - medicine
  - mental_break
  - mental_health
  - party
  - pet
  - physical_health
  - pregnancy
  - prison
  - realm
  - recovery
  - secret
  - seduction
  - skull
  - stewardship
  - unfriendly
  - vassal
  - war
  - witchcraft
```

#### backgrounds.yaml

```yaml
# pychivalry/data/backgrounds.yaml
indoor:
  - armory
  - bedchamber
  - corridor_day
  - corridor_night
  - council_chamber
  - courtyard
  - dungeon
  - feast
  - gallows
  - market
  - market_east
  - market_india
  - market_tribal
  - market_west
  - physicians_study
  - sitting_room
  - study
  - tavern
  - temple
  - temple_church
  - temple_generic
  - temple_mosque
  - temple_scope
  - throne_room
  - throne_room_east
  - throne_room_india
  - throne_room_mediterranean
  - throne_room_scope
  - throne_room_tribal
  - throne_room_west

outdoor:
  - alley_day
  - alley_night
  - army_camp
  - battlefield
  - burning_building
  - docks
  - farmland
  - garden
  - terrain
  - terrain_activity
  - terrain_scope
  - wilderness
  - wilderness_desert
  - wilderness_forest
  - wilderness_forest_pine
  - wilderness_mountains
  - wilderness_scope
  - wilderness_steppe
```

### Tasks

#### 6.1 Theme Validation (CK3430)

```python
def check_theme_valid(node: CK3Node) -> List[Diagnostic]:
    """CK3430: Invalid theme"""
    if node.key == "theme" and node.value:
        if node.value not in VALID_THEMES:
            return [Diagnostic(
                range=node.range,
                message=f"Unknown theme '{node.value}'",
                severity=DiagnosticSeverity.Warning,
                code="CK3430"
            )]
    return []
```

#### 6.2 Background Validation (CK3431)

```python
def check_background_valid(node: CK3Node) -> List[Diagnostic]:
    """CK3431: Invalid override_background"""
    if node.key == "background" and node.parent and node.parent.key == "override_background":
        if node.value not in VALID_BACKGROUNDS:
            return [Diagnostic(
                range=node.range,
                message=f"Unknown background '{node.value}'",
                severity=DiagnosticSeverity.Warning,
                code="CK3431"
            )]
    return []
```

### Deliverables
- [ ] Create `themes.yaml` (~72 themes)
- [ ] Create `backgrounds.yaml` (~44 backgrounds)
- [ ] Create `environments.yaml` (~44 environments)
- [ ] Validation functions in `paradox_checks.py`
- [ ] Tests

### Estimated Effort
- **Code Changes:** ~150 lines + data files
- **Time:** 4-5 hours

---

## Phase 7: Description Block Validation

**Priority:** 🟡 Medium  
**Effort:** Medium  
**Impact:** Medium  
**Dependencies:** Phase 1 (basic triggered_desc checks)

### Tasks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3442 | first_valid no fallback | Check last child of first_valid is unconditional |
| CK3443 | Empty desc block | Check for `desc = { }` with no children |
| CK3444 | Literal string in desc | Warn on `desc = "text"` |
| CK3445 | Invalid desc structure | Mixed first_valid/random_valid incorrectly |
| CK3446 | Nested desc complexity | Track nesting depth > 3 |

### Deliverables
- [ ] Description validation functions
- [ ] Tests for all 7 description checks
- [ ] Documentation updates

### Estimated Effort
- **Code Changes:** ~200 lines
- **Time:** 3-4 hours

---

## Phase 8: Option Block Validation

**Priority:** 🟡 Medium  
**Effort:** Medium  
**Impact:** Medium  
**Dependencies:** Phase 1 (basic option name check), Data files

### Prerequisites: Trait Data

✅ **COMPLETED** (Phase 6): User-extracted trait system implemented with 15+ property types.

**For CK3451 validation**, trait data is available via `pychivalry/traits.py` query API:
- `is_valid_trait(trait_name)` - Check if trait exists
- `get_all_trait_names()` - Get set of all 297 trait names
- `get_trait_info(trait_name)` - Get complete trait metadata

Users must extract trait data from their CK3 installation using:
```
VS Code Command: "CK3: Extract Trait Data from CK3 Installation"
```

See: [Trait Validation Setup](../../README.md#trait-validation-opt-in)

### Tasks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3451 | Invalid trait reference | Validate against traits.yaml |
| CK3452 | Invalid skill reference | Validate against skill list |
| CK3453 | Invalid add_internal_flag | Must be "special" or "dangerous" |
| CK3454 | fallback with always=yes | Redundant pattern |
| CK3455 | Multiple exclusive options | Conflict detection |
| CK3456 | show_as_unavailable without trigger | Missing trigger |
| CK3457 | highlight_portrait invalid scope | Undefined scope reference |
| CK3458 | Option name is literal | Warn on `name = "text"` |
| CK3459 | All options have triggers | No fallback option |

### Deliverables
- [ ] Option validation functions
- [ ] Create traits.yaml data file
- [ ] Tests for all 10 option checks

### Estimated Effort
- **Code Changes:** ~300 lines + data file
- **Time:** 5-7 hours

---

## Phase 9: On Action Validation

**Priority:** 🟢 Lower  
**Effort:** High  
**Impact:** Medium  
**Dependencies:** Data file creation, cross-file analysis infrastructure

### Prerequisites: Create on_actions.yaml

```yaml
# pychivalry/data/on_actions.yaml
code_triggered:
  on_birth_child:
    root_scope: character
    description: "When a child is born"
  on_birth_mother:
    root_scope: character
    description: "Mother scope when giving birth"
  on_death:
    root_scope: character
    description: "Right before a character dies"
  on_marriage:
    root_scope: character
    description: "When a character gets married"
  on_game_start:
    root_scope: none
    description: "When the game starts (before character selection)"
  on_game_start_after_lobby:
    root_scope: none
    description: "After player selects character"
  yearly_playable_pulse:
    root_scope: character
    description: "Once per year for each playable character"
  five_year_playable_pulse:
    root_scope: character
    description: "Once every 5 years for playable characters"
  # ... (30+ more)
```

### Tasks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3500 | Effect/trigger overwrite | Detect effect/trigger in appended on_action |
| CK3501 | Unknown on_action | Validate against known on_actions |
| CK3502 | Invalid delay format | Validate delay syntax |
| CK3503 | every_character in pulse | Performance warning |
| CK3504 | Infinite fallback loop | Detect circular fallback |
| CK3505 | Missing weight_multiplier | Check random_on_actions |
| CK3506 | Zero weight event | Weight of 0 warning |
| CK3507 | chance_to_happen > 100 | Validate percentage |
| CK3508 | Wrong path (on_actions vs on_action) | Check file path |

### Deliverables
- [ ] Create on_actions.yaml data file
- [ ] On action validation functions
- [ ] Cross-file circular reference detection
- [ ] Tests

### Estimated Effort
- **Code Changes:** ~400 lines + data file
- **Time:** 8-12 hours

---

## Phase 10: Localization Validation

**Priority:** 🟢 Lower  
**Effort:** Medium  
**Impact:** Medium  
**Dependencies:** Phase 1 (basic missing key check)

### Tasks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3601 | Literal text usage | Warn on string literals |
| CK3602 | File encoding | Check for UTF-8-BOM |
| CK3603 | Inconsistent key naming | Validate namespace.id.element pattern |
| CK3604 | Unused localization key | Find orphaned loc keys |

### Deliverables
- [ ] Extended localization validation
- [ ] File encoding checker
- [ ] Tests

### Estimated Effort
- **Code Changes:** ~200 lines
- **Time:** 3-5 hours

---

## Phase 11: After Block Validation

**Priority:** 🟢 Lower  
**Effort:** Low  
**Impact:** Low  
**Dependencies:** Phase 2 (event structure)

### Tasks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3520 | after in hidden event | Won't execute |
| CK3521 | after in optionless event | Won't execute |
| CK3522 | Cleanup pattern detected | Information diagnostic |
| CK3523 | Trigger in after block | Effect context only |

### Deliverables
- [ ] After block validation
- [ ] Tests

### Estimated Effort
- **Code Changes:** ~100 lines
- **Time:** 1-2 hours

---

## Phase 12: AI Chance Validation

**Priority:** 🟢 Lower  
**Effort:** Medium  
**Impact:** Low  
**Dependencies:** Phase 8 (option validation)

### Tasks

| Code | Check | Implementation |
|------|-------|----------------|
| CK3610 | Negative base chance | Check base < 0 |
| CK3611 | ai_chance total can be zero | Analyze modifiers |
| CK3612 | ai_chance total can be negative | Analyze modifiers |
| CK3613 | Missing ai_chance | Information diagnostic |
| CK3614 | Modifier missing trigger | Check modifier structure |

### Deliverables
- [ ] AI chance validation
- [ ] Tests

### Estimated Effort
- **Code Changes:** ~150 lines
- **Time:** 2-3 hours

---

## Data Files Required

### Summary Table

| File | Location | Status | Priority | Contents |
|------|----------|--------|----------|----------|
| `animations.yaml` | `data/` | **NEEDED** | Phase 5 | ~150 animation names |
| `themes.yaml` | `data/` | **NEEDED** | Phase 6 | ~72 theme names |
| `backgrounds.yaml` | `data/` | **NEEDED** | Phase 6 | ~44 background names |
| `environments.yaml` | `data/` | **NEEDED** | Phase 6 | ~44 environment names |
| `traits/*.yaml` | `data/traits/` | ✅ **USER-EXTRACTED** | Phase 8 | **297 traits with 15+ properties** (skills, opinions, modifiers, XP gains, costs, flags). Users extract from own CK3 installation. See `tools/extract_traits.py` |
| `on_actions.yaml` | `data/` | **NEEDED** | Phase 9 | ~30 on_actions with scopes |
| `character.yaml` | `data/scopes/` | ✅ EXISTS | - | Character scope links |
| `title.yaml` | `data/scopes/` | ✅ EXISTS | - | Title scope links |
| `province.yaml` | `data/scopes/` | ✅ EXISTS | - | Province scope links |

### Existing Data Gaps to Fix

| Module | Data | Current | Target |
|--------|------|---------|--------|
| `events.py` | `PORTRAIT_ANIMATIONS` | ~17 | ~150 (use yaml) |
| `events.py` | `EVENT_THEMES` | ~32 | ~72 (use yaml) |

---

## Testing Strategy

### Unit Tests Per Phase

Each phase should include:
1. **Positive tests** - Valid code should produce no diagnostics
2. **Negative tests** - Invalid code should produce expected diagnostics
3. **Edge cases** - Boundary conditions, empty blocks, nested structures

### Test File Structure

```
tests/
├── test_paradox_checks.py        # Existing, expand
├── test_event_structure.py       # Phase 2
├── test_namespace_validation.py  # Phase 3
├── test_trigger_extensions.py    # Phase 4
├── test_portrait_validation.py   # Phase 5
├── test_theme_validation.py      # Phase 6
├── test_description_validation.py # Phase 7
├── test_option_validation.py     # Phase 8
├── test_on_action_validation.py  # Phase 9
├── test_localization_extended.py # Phase 10
├── test_after_block.py           # Phase 11
├── test_ai_chance.py             # Phase 12
└── fixtures/
    ├── valid_complete_event.txt
    ├── invalid_event_structure.txt
    ├── namespace_errors.txt
    └── ...
```

### Integration Tests

```python
# tests/integration/test_full_validation.py
def test_complete_event_validation():
    """Test all validation phases on a complete event file"""
    with open("fixtures/valid_complete_event.txt") as f:
        content = f.read()
    
    diagnostics = collect_all_diagnostics(content, full_config)
    assert len(diagnostics) == 0

def test_all_error_types():
    """Test that we can detect all implemented error types"""
    # One test case per diagnostic code
    ...
```

---

## Configuration Updates

### Updated DiagnosticConfig

```python
@dataclass
class DiagnosticConfig:
    # Existing categories
    syntax_enabled: bool = True           # CK3001-CK3002
    semantic_enabled: bool = True         # CK3101-CK3103
    scope_enabled: bool = True            # CK3201-CK3203
    style_enabled: bool = True            # CK33xx
    paradox_enabled: bool = True          # CK35xx-CK52xx
    scope_timing_enabled: bool = True     # CK3550-CK3555
    
    # New categories (Phases 1-12)
    event_structure_enabled: bool = True  # CK3760-CK3769
    namespace_enabled: bool = True        # CK3400-CK3406
    portrait_enabled: bool = True         # CK3420-CK3426
    theme_enabled: bool = True            # CK3430-CK3435
    description_enabled: bool = True      # CK3440-CK3446
    option_enabled: bool = True           # CK3450-CK3459
    on_action_enabled: bool = True        # CK3500-CK3508
    localization_enabled: bool = True     # CK3600-CK3604
    trigger_ext_enabled: bool = True      # CK3510-CK3515
    after_block_enabled: bool = True      # CK3520-CK3523
    ai_chance_enabled: bool = True        # CK3610-CK3614
```

### VS Code Extension Settings

```json
{
  "pychivalry.validation.eventStructure": true,
  "pychivalry.validation.namespace": true,
  "pychivalry.validation.portrait": true,
  "pychivalry.validation.theme": true,
  "pychivalry.validation.description": true,
  "pychivalry.validation.option": true,
  "pychivalry.validation.onAction": true,
  "pychivalry.validation.localization": true,
  "pychivalry.validation.triggerExtensions": true,
  "pychivalry.validation.afterBlock": true,
  "pychivalry.validation.aiChance": true
}
```

---

## Timeline Estimate

| Phase | Effort | Dependencies | Est. Hours |
|-------|--------|--------------|------------|
| Phase 1 | Low | None | 2-4 |
| Phase 2 | Low-Medium | Phase 1 | 2-3 |
| Phase 3 | Medium | Phase 1 | 3-5 |
| Phase 4 | Medium | None | 2-3 |
| Phase 5 | Medium-High | Data files | 4-6 |
| Phase 6 | Medium | Data files | 4-5 |
| Phase 7 | Medium | Phase 1 | 3-4 |
| Phase 8 | Medium | Data files | 5-7 |
| Phase 9 | High | Data files, cross-file | 8-12 |
| Phase 10 | Medium | Phase 1 | 3-5 |
| Phase 11 | Low | Phase 2 | 1-2 |
| Phase 12 | Medium | Phase 8 | 2-3 |
| **Total** | | | **39-59 hours** |

### Recommended Implementation Order

1. **Sprint 1 (Immediate):** Phases 1-4 (Quick wins + critical checks)
2. **Sprint 2 (Near-term):** Phases 5-7 (Portrait, theme, description)
3. **Sprint 3 (Medium-term):** Phases 8, 10, 11, 12 (Option, localization, after, AI)
4. **Sprint 4 (Long-term):** Phase 9 (On action - most complex)

---

## Success Metrics

| Metric | Current | After Phase 1 | After Phase 4 | Final |
|--------|---------|---------------|---------------|-------|
| Diagnostic Codes | 42 | 54 | 74 | 127 |
| Coverage % | 33% | 43% | 58% | 100% |
| Data Files | 3 | 3 | 3 | 9 |
| Tests | ~200 | ~250 | ~300 | ~500 |

---

## Appendix: Code Allocation Summary

| Code Range | Category | Phase | Count |
|------------|----------|-------|-------|
| CK3001-CK3002 | Syntax | Existing | 2 |
| CK3101-CK3103 | Semantic | Existing | 3 |
| CK3201-CK3203 | Scope | Existing | 3 |
| CK33xx | Style | Existing | 15 |
| CK3400-CK3406 | Namespace/ID | Phase 3 | 7 |
| CK3420-CK3426 | Portrait | Phase 5 | 7 |
| CK3430-CK3435 | Theme/Background | Phase 6 | 6 |
| CK3440-CK3446 | Description | Phase 7 | 7 |
| CK3450-CK3459 | Option | Phase 8 | 10 |
| CK3500-CK3508 | On Action | Phase 9 | 9 |
| CK3510-CK3515 | Trigger Extensions | Phase 4 | 6 |
| CK3520-CK3523 | After Block | Phase 11 | 4 |
| CK3550-CK3555 | Scope Timing | Existing | 6 |
| CK3600-CK3604 | Localization | Phase 10 | 5 |
| CK3610-CK3614 | AI Chance | Phase 12 | 5 |
| CK3656 | Opinion | Existing | 1 |
| CK3760-CK3769 | Event Structure | Phases 1-2 | 10 |
| CK3870-CK3875 | Effect/Trigger Context | Existing | 5 |
| CK3976-CK3977 | List Iterators | Existing | 2 |
| CK51xx | Common Gotchas | Existing | 2 |
