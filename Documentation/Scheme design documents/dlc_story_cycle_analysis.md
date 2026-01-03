# DLC Story Cycle Analysis

## Overview

This document analyzes DLC/expansion story cycles (ep3_, fp2_, etc.) to identify unique patterns and features not commonly found in base game story cycles. This analysis is critical for ensuring the LSP can validate all story cycle features.

---

## Summary of Unique DLC Features

### 1. Advanced Variable Systems

DLC story cycles use significantly more complex variable tracking:

#### El Cid (`story_el_cid`)
```pdx
# Loyalty counter system with thresholds
set_variable = {
    name = cid_loyalty_counter
    value = 0
}
change_variable = {
    name = cid_loyalty_counter
    add = 1  # or -1, 2, -2 for major impacts
}

# Variable-based triggers for endings
trigger = {
    var:cid_loyalty_counter >= 5   # Loyal ending
    var:cid_loyalty_counter <= -5  # Disloyal ending
}
```

#### Hasan Sabbah (`story_hasan`)
```pdx
# Phase tracking system
set_variable = {
    name = story_phase
    value = 1
}

# Radical points accumulation
exists = var:radical_points
var:radical_points >= 15
```

#### Harrying of the North (`story_cycle_harrying_of_the_north`)
```pdx
# Dual opposing counters
set_variable = {
    name = pacification
    value = 0
}
set_variable = {
    name = resistance
    value = 5
}

# Threshold comparisons
var:pacification > var:resistance  # Norman victory
var:resistance > var:pacification  # Saxon resistance
```

---

### 2. Global Variables

DLC story cycles frequently use **global variables** for cross-character/cross-story coordination:

```pdx
# Frankokratia - Global champion tracking
set_global_variable = {
    name = byz_claimant_champion
    value = story_owner
}

# Harrying of the North
set_global_variable = {
    name = ruler_england
    value = story_owner
}
set_global_variable = {
    name = harrying_of_the_north
    value = this
}

# Grand Ambitions - Global counter
change_global_variable = {
    name = current_grand_ambitions_counter
    subtract = 1
}
```

---

### 3. Variable Lists

DLC story cycles use **list variables** for dynamic group tracking:

```pdx
# Frankokratia - Dynamic leader tracking
add_to_variable_list = {
    name = frankokratia_leaders
    target = story_owner
}

remove_list_variable = {
    name = frankokratia_leaders
    target = story_owner
}

any_in_list = {
    variable = frankokratia_leaders
    # conditions...
}

every_in_list = {
    variable = frankokratia_leaders
    # effects...
}

ordered_in_list = {
    variable = frankokratia_leaders
    order_by = current_military_strength
    # selection...
}
```

---

### 4. Dynamic Story Owner Transfer

DLC story cycles can transfer ownership without ending:

```pdx
# Frankokratia - Complex inheritance
on_owner_death = {
    if = {
        limit = {
            exists = story_owner.player_heir
            story_owner.player_heir = {
                faith = faith:catholic
            }
        }
        make_story_owner = story_owner.player_heir
    }
}

# Harrying of the North - Non-death transfer
effect_group = {
    days = 1
    triggered_effect = {
        trigger = {
            story_owner = {
                NOT = { has_title = title:k_england }
            }
        }
        effect = {
            title:k_england.holder = { save_scope_as = new_ruler }
            make_story_owner = scope:new_ruler
        }
    }
}
```

**Key Effect**: `make_story_owner = <character>`

---

### 5. Time Unit Diversity

DLC story cycles use various time units in effect_group blocks:

```pdx
# Days (various ranges)
effect_group = {
    days = { 5 10 }        # Very short
    days = { 20 40 }       # Short
    days = { 40 60 }       # Medium-short
    days = { 100 240 }     # Long
}

# Months (fixed and ranged)
effect_group = {
    months = 1             # Monthly tick
    months = 3             # Quarterly
    months = { 6 12 }      # Semi-annual
}

# Years
effect_group = {
    years = 50             # Very long (Harrying of the North attrition)
}
```

---

### 6. Complex Effect Group Patterns

#### Multiple Effect Groups with Same Timing (Admin Eunuch)
```pdx
# Two separate effect groups with overlapping timing for different purposes
effect_group = {
    days = { 100 240 }
    trigger = { /* conditions */ }
    first_valid = { /* reaction events */ }
}

effect_group = {
    days = { 90 180 }
    trigger = { /* same or similar conditions */ }
    random_valid = { /* effect events */ }
}
```

#### `random_valid` Block (Grand Ambitions, Admin Eunuch)
```pdx
effect_group = {
    months = 1
    chance = 100  # Optional chance percentage

    random_valid = {  # Randomly select one valid triggered_effect
        triggered_effect = {
            trigger = { var:method = flag:coup }
            effect = { /* coup route */ }
        }
        triggered_effect = {
            trigger = { var:method = flag:scheme }
            effect = { /* scheme route */ }
        }
    }
}
```

---

### 7. Flag Variables

DLC story cycles use flag type variables for categorization:

```pdx
# El Cid - Enemy type flags
set_variable = {
    name = cid_enemy
    value = flag:alfonso    # or flag:garcia, flag:liege, flag:courtier
}

# Grand Ambitions - Method flags
var:method = flag:coup
var:method = flag:scheme
```

---

### 8. New Effect/Trigger Patterns

#### `trigger_event` with `on_action`
```pdx
trigger_event = { on_action = el_cid_landless_on_action }
trigger_event = { on_action = ongoing_admin_eunuch_reaction_events }
```

#### `debug_log` and `debug_log_date`
```pdx
on_end = {
    debug_log = "El Cid's story ended on:"
    debug_log_date = yes
}
```

#### EP3 Adventurer-Specific Effects
```pdx
# Domicile interactions (EP3 Adventurer government)
domicile = {
    change_provisions = medium_provisions_loss
}
domicile.domicile_location = { save_scope_as = location }

# Camp officer assignment
camp_officer_grant_effect = {
    EMPLOYER = root
    CANDIDATE = scope:amira
    POS = second
}

# Become landed effects
ep3_become_landed_save_liege_effect = {
    TITLE_GIVER = root.var:cid_liege
    ALWAYS_INDEPENDENT = no
    TITLE_LIST = granted_title
}
ep3_become_landed_transfer_effect = {
    TITLE_RECEIVER = root
    TITLE_LIST = granted_title
    TYPE = granted
    REASON = flag:negotiated
    ENNOBLED_ADVENTURER = flag:no
}
destroy_laamp_effect = { ADVENTURER = root }
```

#### Great Holy War Interactions (Frankokratia)
```pdx
# GHW target tracking
story_owner.faith.great_holy_war.ghw_target_title
story_owner.faith.great_holy_war = {
    any_pledged_attacker = { /* conditions */ }
    random_pledged_attacker = { /* selection */ }
}
```

#### War Contribution Checking
```pdx
war_contribution = {
    target = scope:player_temp
    value > 100
}
```

#### Cultural Acceptance Changes
```pdx
culture = {
    change_cultural_acceptance = {
        target = culture:anglo_saxon
        value = major_cultural_acceptance_gain
        desc = harrying_of_the_north_tt_pacification_level_4
    }
}
```

#### Faction Discontent
```pdx
add_targeting_factions_discontent = 5
```

---

### 9. Special Window Types

#### Fullscreen Events (El Cid)
```pdx
cid.0001 = {
    type = character_event
    window = fullscreen_event  # Special fullscreen display
    override_background = { reference = ep3_fullscreen_adventurer_negative }
}
```

---

### 10. Complex Scoping Patterns

#### Title Iteration and Ordering
```pdx
scope:liege.primary_title = {
    every_de_jure_county = {
        limit = { holder = scope:liege }
        add_to_list = granted_title
    }
    ordered_in_list = {
        list = granted_title
        order_by = development_level
        save_scope_as = target
    }
}
```

#### Safe Navigation with `?=`
```pdx
var:cid_liege ?= { is_alive = no }
var:eunuch ?= { is_alive = yes }
character:41706 ?= { save_scope_as = nizar }
```

#### Temporary Scope Saves
```pdx
save_temporary_scope_as = county_holder
save_temporary_scope_as = player_temp
```

---

### 11. Achievement Integration

```pdx
add_achievement_global_variable_effect = {
    VARIABLE = finished_mio_cid_achievement
    VALUE = yes
}
```

---

### 12. Legend/Chronicle Integration (CE1)

```pdx
# El Cid creates legend seeds with CE1 DLC
if = {
    limit = {
        has_dlc_feature = legends
        NOT = { has_game_rule = historical_legends_only }
    }
    create_legend_seed = {
        type = heroic
        quality = famed
        chronicle = legendary_battle
        properties = {
            winner = root
            loser = scope:loser
            location = root.location
        }
    }
}
```

---

### 13. Travel System Integration (EP3)

```pdx
start_travel_plan = {
    destination = scope:ismaili_caliph.capital_province
    players_use_planner = yes
    return_trip = no
    travel_with_domicile = yes
    on_arrival_destinations = last
    on_arrival_event = hasan_sabbah.1022
    on_travel_planner_cancel_event = hasan_sabbah.1020
}
```

---

### 14. Dynamic Title Creation

```pdx
create_dynamic_title = {
    tier = kingdom
    name = HASAN_KINGDOM
    adj = HASAN_KINGDOM_adj
}

# Post-creation title configuration
scope:new_title = {
    set_de_jure_liege_title = root.location.empire
    set_coa = title:b_alamut
    set_color_from_title = scope:hasan_home
    set_capital_county = scope:hasan_home
}
```

---

### 15. Complex Modifier Systems (Admin Eunuch)

```pdx
# Tiered modifier checking (levels 1-8)
story_owner = {
    OR = {
        has_character_modifier = admin_eunuch_liege_1_modifier
        has_character_modifier = admin_eunuch_liege_2_modifier
        # ... up to level 8
    }
}
```

---

## Validation Requirements

Based on this analysis, the LSP schema should validate:

### New Story Cycle Fields
- `make_story_owner` effect
- `random_valid` block type (alongside `first_valid`)
- `chance` parameter in effect_group
- `years` time unit (in addition to `days` and `months`)

### New Effect Types
- `debug_log` / `debug_log_date`
- `add_to_variable_list` / `remove_list_variable`
- `any_in_list` / `every_in_list` / `ordered_in_list` with `variable` parameter
- `set_global_variable` / `change_global_variable` / `remove_global_variable`
- Global variable access: `global_var:variable_name`
- `start_travel_plan` with all parameters
- `create_dynamic_title`
- `create_legend_seed`
- `add_achievement_global_variable_effect`
- `change_cultural_acceptance`
- `add_targeting_factions_discontent`
- `war_contribution` trigger

### Flag Variables
- `value = flag:name` syntax
- `var:variable = flag:name` comparisons

### Event Features
- `window = fullscreen_event`
- `on_arrival_event` / `on_travel_planner_cancel_event` in travel plans
- `trigger_event = { on_action = action_name }`

### Scoping
- Safe navigation: `scope ?= { }` and `var:name ?= { }`
- `save_temporary_scope_as`
- Variable-based scoping: `var:variable = { }`

---

## Bell of Huesca (FP2) - Special Patterns

The Bell of Huesca story is actually implemented via **regular events** rather than a story cycle definition file. Key patterns:

### Scripted Triggers for Event Chains
```pdx
scripted_trigger valid_faction_member_trigger = {
    NOT = { is_primary_heir_of = root }
    is_a_faction_member = yes
    is_available_ai_adult = yes
}

scripted_trigger eligible_to_create_bell_trigger = {
    is_available = yes
    OR = {
        has_trait = torturer
        has_trait = paranoid
        has_trait = sadistic
        dread >= high_dread
        tyranny >= high_tyranny
    }
}
```

### Dynamic List Building
```pdx
every_courtier_or_guest = {
    limit = { family_or_close_to_dead_faction_member_1_trigger = yes }
    add_to_list = possible_bell_discoverers
}
```

### Duel System
```pdx
duel = {
    skill = intrigue
    target = scope:bell_discoverer
    30 = {
        compare_modifier = {
            value = scope:duel_value
            multiplier = 2.5
        }
        desc = bell_discovery_success_effect
        # success effects
    }
    40 = {
        compare_modifier = {
            value = scope:duel_value
            multiplier = -2.5
        }
        # failure effects
    }
}
```

### Developer Testing Shortcut
```pdx
if = {
    limit = { is_developer_testing_trigger = yes }
    custom_tooltip = debug_generic_option_shortened_trigger_can_disable
    trigger_event = {
        id = bell_special_yearly.2000
        days = 4
    }
}
else = {
    trigger_event = {
        id = bell_special_yearly.2000
        days = { 40 60 }
    }
}
```

---

## Conclusion

DLC story cycles introduce several sophisticated features:

1. **State Management**: Complex variable systems with counters, flags, lists, and global state
2. **Dynamic Ownership**: Stories can transfer between characters without ending
3. **Cross-System Integration**: Travel, legends, achievements, great holy wars
4. **Advanced Timing**: Year-long effect groups, multiple overlapping groups
5. **Random Selection**: `random_valid` blocks for varied outcomes

These features should be added to the story cycle schema to ensure proper validation of DLC content.
