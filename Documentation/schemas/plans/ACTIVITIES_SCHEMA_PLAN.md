# Activities Schema Onboarding Plan

**Status:** Planning  
**Priority:** Medium  
**Estimated Effort:** ~6-8 hours  
**Source:** Analysis of `_activity_type.info` and 21 base game activity files

---

## 1. Current State

From `feature_matrix.md`:

| Aspect | Current Status |
|--------|----------------|
| Location | `common/activities/` |
| Required Fields | ❌ Not validated |
| Effect/Trigger Context | ⚠️ Generic only |
| Scope Chains | ✅ Working |
| Cross-File Refs | ❌ Not indexed |
| Schema Status | 🔄 Planned |

---

## 2. Activity System Overview

CK3 activities are complex systems with **6 subdirectories**:

| Subdirectory | Files | Purpose | Schema Priority |
|--------------|-------|---------|-----------------|
| `activity_types/` | 21 | Main activity definitions | **HIGH** |
| `intents/` | 18 | AI intent definitions | Medium |
| `pulse_actions/` | 20 | Periodic effect triggers | Medium |
| `guest_invite_rules/` | 1 | Guest invitation logic | Low |
| `activity_group_types/` | 1 | Grouping definitions | Low |
| `activity_locales/` | 1 | Location requirements | Low |

**Focus:** Start with `activity_types/` as it contains the core content modders create.

---

## 3. Complete Activity Type Field Reference

Based on `_activity_type.info` (official documentation) and analysis of all 21 base game activities.

### 3.1 Core Trigger Blocks (REQUIRED)

| Field | Type | Scope | Required | Description |
|-------|------|-------|----------|-------------|
| `is_shown` | trigger | `root = host` | ✅ **YES** | When activity appears in menu |
| `is_valid` | trigger | `root = activity` | ✅ **YES** | Ongoing validity check |
| `phases` | block | - | ✅ **YES** | Phase definitions (see §4) |

### 3.2 Optional Trigger Blocks

| Field | Type | Scope | Description |
|-------|------|-------|-------------|
| `can_start` | trigger | `root = host` | Full validation with feedback |
| `can_start_showing_failures_only` | trigger | `root = host` | Only shows failures |
| `can_plan` | trigger | `root = host` | Planning requirements |
| `is_location_valid` | trigger | `root = province` | Province validation |
| `can_be_activity_guest` | trigger | `root = character` | Guest eligibility |

### 3.3 Optional Effect Blocks

| Field | Type | Scope | Description |
|-------|------|-------|-------------|
| `on_invalidated` | effect | `root = activity` | Cleanup on cancel |
| `on_host_death` | effect | `root = activity` | Host death handling |
| `on_start` | effect | `root = activity` | Activity creation |
| `on_complete` | effect | `root = character` | After last phase |
| `on_enter_travel_state` | effect | `root = character` | Enter travel |
| `on_enter_passive_state` | effect | `root = character` | Enter passive |
| `on_enter_active_state` | effect | `root = character` | Enter active |
| `on_leave_travel_state` | effect | `root = character` | Leave travel |
| `on_leave_passive_state` | effect | `root = character` | Leave passive |
| `on_leave_active_state` | effect | `root = character` | Leave active |
| `on_travel_state_pulse` | effect | `root = character` | Travel pulse |
| `on_passive_state_pulse` | effect | `root = character` | Passive pulse |
| `on_active_state_pulse` | effect | `root = character` | Active pulse |

### 3.4 Simple Parameters

| Field | Type | Default | Values/Range | Description |
|-------|------|---------|--------------|-------------|
| `is_single_location` | bool | `yes` | yes/no | Single province activity |
| `can_always_plan` | bool | `yes` | yes/no | Allow planning without requirements |
| `open_invite` | bool | `no` | yes/no | Anyone can join |
| `allow_zero_guest_invites` | bool | `no` | yes/no | Allow no guests |
| `notify_player_can_join_open_activity` | bool | `no` | yes/no | Show alert for joinable |
| `planner_type` | enum | `province` | `province`, `holder` | Planner display mode |

### 3.5 Province Filter Enum Values

| Field | Valid Values |
|-------|--------------|
| `province_filter` | `capital`, `domain`, `realm`, `top_realm`, `holy_sites`, `holy_sites_domain`, `holy_sites_realm`, `domicile`, `domicile_domain`, `domicile_realm`, `top_liege_border_inner`, `top_liege_border_outer`, `landed_title`, `geographical_region`, `all` |
| `ai_province_filter` | Same as above |
| `province_filter_target` | Title key or region key (when using `landed_title` or `geographical_region`) |

### 3.6 Numeric Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_guests` | script_value | - | Guest capacity |
| `reserved_guest_slots` | int | - | Reserved for effect-added guests |
| `max_province_icons` | int | unlimited | Province icons shown |
| `max_route_deviation_mult` | float | define | Player waypoint deviation |
| `sort_order` | int | 0 | GUI ordering |

### 3.7 Duration Parameters

| Field | Format | Description |
|-------|--------|-------------|
| `cooldown` | `{ days/months/years = X }` | Hosting cooldown |
| `wait_time_before_start` | `{ days/months/years = X }` | Delay before first phase |
| `max_guest_arrival_delay_time` | `{ days/months/years = X }` | Guest travel allowance |
| `locale_cooldown` | `{ days = X }` | Between locale visits |
| `auto_select_locale_cooldown` | `{ days = X }` | Auto-visit timing |
| `early_locale_opening_duration` | `{ days = X }` | Locales open before start |

### 3.8 AI Configuration

| Field | Type | Description |
|-------|------|-------------|
| `ai_will_do` | script_value | Host likelihood |
| `ai_check_interval` | int | Check frequency (months) |
| `ai_check_interval_by_tier` | block | Per-tier check frequency |
| `ai_will_select_province` | script_value | Province preference |
| `ai_select_num_provinces` | script_value | Multi-location count |

### 3.9 Cost Structure

```pdx
cost = {
    gold = { <script_value> }
    piety = { <script_value> }
    prestige = { <script_value> }
    renown = { <script_value> }
}

ui_predicted_cost = {
    # Same structure, for display
}
```

### 3.10 Guest System

```pdx
guest_invite_rules = {
    rules = {
        <priority> = <invite_rule_key>
    }
    defaults = {
        <priority> = <invite_rule_key>
    }
}

guest_subsets = { <key1> <key2> }

special_guests = {
    <key> = {
        is_shown = { <triggers> }
        is_required = yes/no
        select_character = { <effects> }
        can_pick = { <triggers> }
        ai_will_do = { <script_value> }
        on_invite = { <effects> }
    }
}

guest_join_chance = { <script_value> }
```

### 3.11 Intent System

```pdx
host_intents = {
    intents = { <intent_key> <intent_key> }
    default = <intent_key>
    player_defaults = { <intent_key> }
}

guest_intents = {
    # Same structure
}
```

### 3.12 Pulse Actions

```pdx
pulse_actions = {
    entries = { <pulse_action_key> <pulse_action_key> }
    chance_of_no_event = <int>  # 0-100
}
```

### 3.13 Options Structure

```pdx
options = {
    <category_key> = {
        <option_key> = {
            is_shown = { <triggers> }
            is_valid = { <triggers> }
            on_start = { <effects> }
            default = yes/<trigger>
            blocked_intents = { <intent_key> }
            blocked_phases = { <phase_key> }
            ai_will_do = { <script_value> }
            cost = { gold = {} piety = {} prestige = {} renown = {} }
            travel_entourage_selection = { ... }
        }
    }
}

special_option_category = <category_key>
```

### 3.14 Graphics

```pdx
background = {
    trigger = { <triggers> }
    texture = "path"
    environment = "name"
    ambience = "event_path"
    music = "cue_name"
}

locale_background = { ... }  # Same structure

map_entity = {
    trigger = { <triggers> }
    reference = "entity_name"
}
map_entity = "entity_name"  # Shorthand

window_characters = {
    <key> = {
        camera = <camera_name>
        effect = { <effects> }
        scripted_animation = { <animation_block> }
        animation = <animation_name>
    }
}

activity_window_widgets = {
    <widget_name> = "<container>"
}

activity_planner_widgets = {
    <widget_name> = "<container>"
}
```

### 3.15 Locales

```pdx
locales = {
    <slot_key> = {
        is_available = { <triggers> }
        locales = { <locale_key> <locale_key> }
    }
}
```

### 3.16 Descriptions (Localization References)

| Field | Default Key |
|-------|-------------|
| `province_description` | `<key>_province_desc` |
| `host_description` | `<key>_host_desc` |
| `conclusion_description` | `<key>_conclusion_desc` |

### 3.17 References

| Field | Type | Description |
|-------|------|-------------|
| `activity_group_type` | key | Group categorization |
| `travel_entourage_selection` | block | Entourage rules |
| `num_pickable_phases` | script_value | Pickable phase count |
| `max_pickable_phases_per_province` | script_value | Per-location limit |

---

## 4. Phase Structure (Nested)

Phases are the core gameplay structure. Each activity must have at least one phase.

### 4.1 Phase Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `order` | int | ✅ **YES** | - | Execution order |
| `is_predefined` | bool | No | `no` | Always present vs pickable |
| `number_of_picks` | script_value | No | 1 | How many times pickable |
| `location_source` | enum | No | `pickable` | `pickable`, `first_picked_phase`, `last_picked_phase`, `scripted` |
| `select_scripted_location` | effect | No | - | For `location_source = scripted` |

### 4.2 Phase Trigger Blocks

| Field | Scope | Description |
|-------|-------|-------------|
| `is_shown` | `root = host` | Phase visibility |
| `can_pick` | `root = host` | Phase pickability |
| `is_valid` | `root = activity` | Ongoing phase validity |

### 4.3 Phase Effect Blocks

| Field | Scope | Description |
|-------|-------|-------------|
| `on_enter_phase` | `root = character` | Set as current (not active) |
| `on_phase_active` | `root = character` | Phase becomes active |
| `on_end` | `root = character` | Phase ends |
| `on_monthly_pulse` | `root = character` | Monthly tick |
| `on_weekly_pulse` | `root = character` | Weekly tick |
| `on_invalidated` | `root = character` | Phase invalidation |

### 4.4 Phase Cost

```pdx
cost = {
    gold = { <script_value> }
    # scope:province, scope:previous_province available
}
```

### 4.5 Phase AI

```pdx
ai_will_do = { <script_value> }
```

---

## 5. Subdirectory Schemas (Secondary Priority)

### 5.1 Intents (`intents/`)

```pdx
<intent_key> = {
    is_shown = { <triggers> }
    is_valid = { <triggers> }
    is_target_valid = { <triggers> }
    on_invalidated = { <effects> }
    on_target_invalidated = { <effects> }
    ai_will_do = { <script_value> }
    ai_targets = { ai_recipients = <type>, max = <int>, chance = <float> }
    ai_target_quick_trigger = { adult = yes, ... }
    ai_target_score = { <script_value> }
    icon = "filename"
    scripted_animation = "<key>" | { <block> }
}
```

### 5.2 Pulse Actions (`pulse_actions/`)

```pdx
<action_key> = {
    icon = "filename"
    is_valid = { <triggers> }
    weight = { <script_value> }
    effect = { <effects> }
}
```

### 5.3 Guest Invite Rules (`guest_invite_rules/`)

```pdx
<rule_key> = {
    effect = {
        # root = host
        # Use: add_to_list = characters
    }
}
```

---

## 6. Required Work Items

### 6.1 Create Schema File

**File:** `pychivalry/data/schemas/activities.yaml`

**Estimated Fields:** ~80+ top-level, ~15 phase fields, ~30 nested structures

### 6.2 Add Diagnostic Codes

| Code | Severity | Description |
|------|----------|-------------|
| ACT001 | Error | Missing required `is_shown` block |
| ACT002 | Error | Missing required `is_valid` block |
| ACT003 | Error | Missing required `phases` block |
| ACT004 | Error | Phase missing required `order` field |
| ACT005 | Warning | Duplicate phase order values |
| ACT006 | Warning | Non-sequential phase order |
| ACT007 | Error | Invalid `province_filter` value |
| ACT008 | Warning | `province_filter_target` required but missing |
| ACT009 | Error | Invalid `location_source` value |
| ACT010 | Warning | `select_scripted_location` without `location_source = scripted` |

### 6.3 Implementation Phases

**Phase 1 - Core Structure (2-3 hours)**
- Required fields: `is_shown`, `is_valid`, `phases`
- Phase required fields: `order`
- Basic enums: `province_filter`, `location_source`

**Phase 2 - Complete Fields (2-3 hours)**
- All optional trigger/effect blocks
- Duration parameters
- Cost structure
- AI configuration

**Phase 3 - Nested Structures (2-3 hours)**
- Options with categories
- Guest system (special_guests, invite_rules)
- Graphics blocks
- Window characters

---

## 7. Validation Priority Matrix

| Priority | Field/Block | Reason |
|----------|-------------|--------|
| P0 | `is_shown`, `is_valid`, `phases` | Required for activity to function |
| P0 | `phases.*.order` | Required for phase ordering |
| P1 | `province_filter` enum | Common error source |
| P1 | `location_source` enum | Phase location errors |
| P1 | Duration format | Syntax errors common |
| P2 | Cost structure | Financial balance |
| P2 | `special_guests` | Complex nested validation |
| P3 | Graphics blocks | Lower priority, cosmetic |
| P3 | `window_characters` | Complex, DLC-specific |

---

## 8. Cross-Reference Index

Activities reference these other content types:

| Reference Type | Location | Indexing Needed |
|----------------|----------|-----------------|
| `activity_group_type` | `activity_group_types/` | Yes |
| `intent_key` | `intents/` | Yes |
| `pulse_action_key` | `pulse_actions/` | Yes |
| `invite_rule_key` | `guest_invite_rules/` | Yes |
| `locale_key` | `activity_locales/` | Yes |
| `scripted_animation` | `scripted_animations/` | Existing |
| `trigger_event` | `events/` | Existing |

---

## 9. Success Criteria

- [ ] Activities appear in Table 1 of feature_matrix.md
- [ ] `is_shown`, `is_valid`, `phases` validated as required
- [ ] Phase `order` field validated
- [ ] `province_filter` enum validated
- [ ] Diagnostic codes ACT001-ACT010 documented
- [ ] At least one test fixture passes validation
- [ ] No regression in existing validation

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large file sizes (5K+ lines) | Performance | Incremental parsing, cache AST |
| 80+ field definitions | Maintenance | Generate from info file |
| DLC-gated features | False positives | Document DLC requirements |
| Complex nesting (4 levels) | Validation complexity | Validate top-down |
| Scope context varies | Wrong diagnostics | Document scope per block |

---

## 11. Next Steps After Completion

1. `intents/` schema (simpler, ~20 fields)
2. `pulse_actions/` schema (~5 fields)
3. `guest_invite_rules/` schema (~3 fields)
4. Cross-file reference indexing for activity system
