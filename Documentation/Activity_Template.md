# CK3 Activity Template

## Understanding the Activity System

Activities in CK3 are complex, multi-phase social gatherings that characters can host and attend. Unlike simple events that fire once, activities are persistent game objects with their own lifecycle, participant tracking, and phase progression. Understanding how these pieces connect is essential before building your own.

### How Activities Appear in the Game

An activity becomes available to players through the **activity type definition** (`common/activities/activity_types/`). The game constantly evaluates the `is_shown` block to determine if the activity should appear in a character's activity menu. When a player clicks to start an activity, the game checks `can_start_showing_failures_only` to show any blocking conditions.

The `ai_will_do` block controls whether AI characters will autonomously start this activity. The game periodically evaluates this (controlled by `ai_check_interval`) and if the value is positive, the AI may choose to host.

### Guest Invitation and Acceptance

When an activity is created, the game uses **guest invite rules** to build a list of potential invitees. These rules (defined in `common/activities/guest_invite_rules/`) specify which characters can be invited - vassals, courtiers, friends, neighboring rulers, etc. The `guest_invite_rules` block in your activity type references which rules to use and their priority order.

Once invited, each potential guest's attendance is determined by `guest_join_chance`. This is a weighted calculation considering:
- Base value and standard modifiers (`base_activity_modifier`)
- Relationship with host (friend, rival, lover)
- Character traits (shy characters less likely, gregarious more likely)
- Opinion of host
- Distance and diplomatic range

The `can_be_activity_guest` trigger provides hard requirements - if a character fails this, they cannot attend regardless of join chance.

### The Phase System

Activities progress through **phases** defined in the `phases` block. Each phase has:

- **`on_phase_active`**: Fires when the phase becomes active. Typically used to trigger introduction events and set the phase duration via `progress_activity_phase_after`.
- **`on_weekly_pulse`**: Fires every week during the phase. This is how random events are distributed - it references an `on_action` that contains a weighted random event pool.
- **`on_enter_phase`**: Fires when transitioning INTO this phase (different from `on_phase_active`).
- **`on_end`**: Fires when the phase concludes, used for cleanup or transition effects.

The host controls phase progression. When the host's `on_phase_active` calls `progress_activity_phase_after = { weeks = 2 }`, the phase will automatically advance after 2 weeks.

### How Random Events Fire

Random events during activities are driven by the **`on_weekly_pulse`** hook in each phase. This hook triggers an `on_action` defined in your `common/on_action/` file. The on_action contains a `random_events` block:

```pdx
my_activity_phase1_event_selection = {
    trigger = { exists = scope:activity }
    random_events = {
        100 = my_namespace.1001  # Weight 100
        100 = my_namespace.1002  # Weight 100
        50  = my_namespace.1003  # Weight 50 (half as likely)
        0   = 0                  # Chance of no event
    }
}
```

The weights are relative - an event with weight 100 is twice as likely as one with weight 50. Adding `0 = 0` creates a chance that no event fires at all.

Each event also has its own `trigger` block that must pass for it to be selected. If an event is selected but fails its trigger, another event is chosen. Events can also have `weight_multiplier` blocks that dynamically adjust their selection weight based on conditions.

### Event Blocking and Spam Prevention

To prevent the same event firing repeatedly, use these patterns:

**Character flags** (temporary):
```pdx
add_character_flag = { flag = block_my_events days = 30 }
```

**Local variables** (per-activity instance):
```pdx
set_local_variable = { name = had_event_1001 value = yes }
# Then in trigger: NOT = { has_local_variable = had_event_1001 }
```

**Cooldowns** (permanent until expired):
```pdx
# In event definition
cooldown = { years = 1 }
```

### Scope Context in Activities

Activity events have special scopes available:

| Scope | Description |
|-------|-------------|
| `root` | The character receiving/experiencing the event |
| `scope:activity` | The activity instance itself |
| `scope:host` | The character who started the activity |
| `scope:player` | The human player (if applicable) |

From `scope:activity`, you can access participants:
```pdx
scope:activity = {
    random_participant = {
        limit = { NOT = { this = root } }
        save_scope_as = partner
    }
}
```

### Intents: What Characters Want

**Intents** (`common/activities/intents/`) represent what a character hopes to achieve at the activity. Both hosts and guests can have intents. The `host_intents` and `guest_intents` blocks in your activity type define which intents are available.

Intents can:
- Unlock special event options (check via `has_activity_intent = intent_name`)
- Modify AI behavior during the activity
- Provide narrative flavor in event descriptions
- Track an `intent_target` - a specific character the intent focuses on

### Activity Options: Player Choices at Creation

The `options` block defines customization choices available when creating the activity. These appear in the activity setup UI and can affect:
- Cost (additional gold for fancier options)
- Available events (check via `has_activity_option`)
- Guest behavior and preferences
- Activity duration or rewards

Options are organized into categories. One option per category can be selected, with one marked as `default = yes`.

### The Complete Lifecycle

1. **Creation**: Player/AI starts activity → `on_start` fires → `host_var` set, log entry added
2. **Travel**: Host travels to location → `on_enter_passive_state` fires travel event
3. **Guest Arrival**: Guests travel and arrive over `max_guest_arrival_delay_time`
4. **Phase 1 Active**: `on_phase_active` fires → intro events, weekly pulse begins
5. **Phase Transition**: `progress_activity_phase_after` expires → `on_end` fires → next phase begins
6. **Phase 2+**: Repeat active/pulse/end cycle for each phase
7. **Completion**: Final phase ends → `on_complete` fires → conclusion events, rewards distributed
8. **Cleanup**: Activity object destroyed, participants return home

### Why Each File Exists

| File | Purpose |
|------|---------|
| **Activity Type** | Defines the activity itself - visibility, validity, phases, options, costs, guest handling |
| **On-Actions** | Contains random event pools referenced by phase pulses |
| **Intents** | Defines character goals/motivations during the activity |
| **Guest Rules** | Specifies which characters can be invited (custom rules only) |
| **Triggers** | Reusable conditions for event firing and partner selection |
| **Effects** | Reusable effects for common operations (find partner, block events, rewards) |
| **Opinion Modifiers** | Predefined opinion changes for activity outcomes |
| **Events** | The actual narrative content - descriptions, options, consequences |
| **Localization** | All displayed text (UTF-8 with BOM required) |

---

## Template Variables

Replace these placeholders throughout all files:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `[NAMESPACE]` | Event namespace | `rq_my_activity` |
| `[ACTIVITY_ID]` | Activity type ID | `activity_rq_my_activity` |
| `[ACTIVITY_NAME]` | Display name | `My Custom Activity` |
| `[CHAIN_PREFIX]` | Prefix for triggers/effects | `rq_my_activity` |
| `[PHASE_1_ID]` | First phase ID | `rq_my_activity_phase_setup` |
| `[PHASE_2_ID]` | Second phase ID | `rq_my_activity_phase_main` |
| `[INTENT_ID]` | Guest/host intent ID | `rq_my_activity_intent` |
| `[MOD_PATH]` | Your mod folder | `Rance Quest` |

---

## File Structure

```
[MOD_PATH]/
├── common/
│   ├── activities/
│   │   ├── activity_types/
│   │   │   └── [CHAIN_PREFIX]_activity.txt
│   │   ├── guest_invite_rules/
│   │   │   └── [CHAIN_PREFIX]_guest_rules.txt
│   │   └── intents/
│   │       └── [CHAIN_PREFIX]_intents.txt
│   ├── on_action/
│   │   └── [CHAIN_PREFIX]_on_action.txt
│   ├── scripted_effects/
│   │   └── [CHAIN_PREFIX]_effects.txt
│   ├── scripted_triggers/
│   │   └── [CHAIN_PREFIX]_triggers.txt
│   └── opinion_modifiers/
│       └── [CHAIN_PREFIX]_opinion_modifiers.txt
├── events/
│   └── [CHAIN_PREFIX]_events/
│       ├── [CHAIN_PREFIX]_main_events.txt
│       └── [CHAIN_PREFIX]_random_events.txt
├── gfx/
│   └── interface/
│       └── icons/
│           ├── activities/
│           │   ├── [ACTIVITY_ID].dds
│           │   └── [ACTIVITY_ID]_header.dds
│           └── activity_phases/
│               ├── [PHASE_1_ID].dds
│               └── [PHASE_2_ID].dds
└── localization/
    └── english/
        └── [CHAIN_PREFIX]_l_english.yml
```

---

## Template Files

### 1. Activity Type Definition
**Path:** `common/activities/activity_types/[CHAIN_PREFIX]_activity.txt`

```pdx
###############################################################################
# ACTIVITY: [ACTIVITY_ID]
###############################################################################

[ACTIVITY_ID] = {
	
	###################
	# VISIBILITY & VALIDITY
	###################
	
	is_shown = {
		is_landed_or_landless_administrative = yes
		highest_held_title_tier > tier_barony
		age >= 18
		# AI restrictions
		trigger_if = {
			limit = { is_ai = yes }
			is_at_war = no
			short_term_gold >= [CHAIN_PREFIX]_activity_cost
		}
	}

	can_start_showing_failures_only = {
		is_available_adult = yes
	}

	is_valid = {
		NOT = { has_variable = activity_invalidated }
		scope:host = {
			is_alive = yes
			is_capable_adult = yes
			is_imprisoned = no
			is_landed_or_landless_administrative = yes
		}
		trigger_if = {
			limit = { is_current_phase_active = yes }
			has_attending_activity_guests = yes
		}
	}
	
	on_invalidated = {
		if = {
			limit = { scope:host = { is_landed = no } }
			scope:activity = { activity_type = { save_scope_as = activity_type } }
			every_attending_character = {
				trigger_event = activity_system.0320
			}
		}
		if = {
			limit = { has_attending_activity_guests = no }
			scope:activity = {
				activity_type = { save_scope_as = activity_type }
				activity_location = { save_scope_as = location }
			}
			scope:host = { trigger_event = activity_system.0100 }
		}
	}

	on_host_death = {
		scope:activity = {
			set_variable = { name = activity_invalidated }
		}
	}

	###################
	# PARAMETERS
	###################

	is_grand_activity = no
	is_single_location = yes
	province_filter = domicile_domain
	ai_province_filter = capital
	max_route_deviation_mult = 2.0

	is_location_valid = {
		has_holding = yes
	}

	cooldown = { years = 5 }

	ai_will_do = {
		value = 30
		# Trait modifiers
		if = {
			limit = { has_trait = [POSITIVE_TRAIT] }
			add = 50
		}
		if = {
			limit = { has_trait = [NEGATIVE_TRAIT] }
			add = -50
		}
		# Economic check
		if = {
			limit = { short_term_gold >= major_gold_value }
			add = 20
		}
	}

	###################
	# GUEST HANDLING
	###################

	max_guests = 20

	guest_invite_rules = {
		rules = {
			1 = activity_invite_rule_friends
			1 = activity_invite_rule_close_family
			2 = activity_invite_rule_courtiers
			2 = activity_invite_rule_vassals
			3 = activity_invite_rule_liege
			4 = activity_invite_neighbouring_rulers
		}
	}

	can_be_activity_guest = {
		is_adult = yes
		is_healthy = yes
		in_diplomatic_range = scope:host
	}

	host_intents = {
		intents = { [INTENT_ID] }
		default = [INTENT_ID]
	}

	guest_intents = {
		intents = { [INTENT_ID] }
		default = [INTENT_ID]
	}

	guest_join_chance = {
		base = 10
		base_activity_modifier = yes
		
		modifier = {
			has_trait = [POSITIVE_TRAIT]
			add = 30
		}
		modifier = {
			has_trait = [NEGATIVE_TRAIT]
			add = -30
		}
		modifier = {
			has_relation_friend = scope:host
			add = 20
		}
		modifier = {
			has_relation_rival = scope:host
			add = -50
		}
	}

	###################
	# COST
	###################

	cost = {
		gold = {
			add = {
				value = [CHAIN_PREFIX]_activity_cost
				desc = [CHAIN_PREFIX]_activity_cost_desc
			}
			# Era scaling
			add = {
				value = [CHAIN_PREFIX]_activity_cost
				multiply = activity_cost_scale_by_era
				subtract = [CHAIN_PREFIX]_activity_cost
				desc = activity_cost_scale_by_era_desc
			}
			# Dynasty perk discount
			if = {
				limit = { dynasty ?= { has_dynasty_perk = law_legacy_1 } }
				subtract = {
					value = [CHAIN_PREFIX]_activity_cost
					multiply = law_legacy_cost_reduction_mult
					desc = law_legacy_1_name
				}
			}
			min = 0
		}
	}

	###################
	# OPTIONS
	###################

	options = {
		[CHAIN_PREFIX]_option_type = {
			[CHAIN_PREFIX]_type_standard = {
				default = yes
				ai_will_do = { value = 50 }
			}
			[CHAIN_PREFIX]_type_elaborate = {
				cost = {
					gold = {
						add = {
							value = 25
							multiply = activity_cost_scale_by_era
							desc = [CHAIN_PREFIX]_type_elaborate_desc
						}
					}
				}
				ai_will_do = {
					value = 25
					if = {
						limit = { short_term_gold >= major_gold_value }
						add = 25
					}
				}
			}
		}
	}

	###################
	# PHASES
	###################

	max_guest_arrival_delay_time = { months = 3 }

	phases = {
		[PHASE_1_ID] = {
			order = 1
			is_predefined = yes
			is_shown = { always = yes }

			on_phase_active = {
				if = {
					limit = { this = scope:host }
					scope:activity = { progress_activity_phase_after = { weeks = 1 } }
					
					# Check minimum guests
					if = {
						limit = {
							scope:activity = {
								any_attending_character = {
									NOT = { this = scope:host }
									count < 2
								}
							}
						}
						trigger_event = [NAMESPACE].0002  # Not enough guests
					}
					else = {
						trigger_event = [NAMESPACE].0101  # Host intro
					}
				}
				else = {
					trigger_event = [NAMESPACE].0102  # Guest intro
				}
			}

			on_weekly_pulse = {
				trigger_event = { on_action = [CHAIN_PREFIX]_phase1_event_selection }
			}

			on_end = {
				# Phase transition effects
			}
		}

		[PHASE_2_ID] = {
			order = 2
			is_predefined = yes

			on_enter_phase = {
				if = {
					limit = { this = scope:host }
					scope:activity = { progress_activity_phase_after = { days = 1 } }
				}
				if = {
					limit = { is_ai = no }
					trigger_event = [NAMESPACE].0201  # Main phase gateway
				}
			}

			on_phase_active = {
				if = {
					limit = { this = scope:host }
					scope:activity = { progress_activity_phase_after = { weeks = 2 } }
				}
			}

			on_weekly_pulse = {
				trigger_event = { on_action = [CHAIN_PREFIX]_phase2_event_selection }
			}

			on_end = {
				# Cleanup effects
			}
		}
	}

	ai_check_interval = 60

	###################
	# ACTIVITY LIFECYCLE
	###################

	on_start = {
		set_variable = {
			name = host_var
			value = scope:host
		}
		add_activity_log_entry = {
			key = [CHAIN_PREFIX]_started
			character = scope:host
		}
	}

	on_enter_passive_state = {
		trigger_event = [NAMESPACE].0001  # Travel/waiting event
	}

	on_complete = {
		if = {
			limit = { this = scope:host }
			scope:host = {
				save_scope_as = root_scope
				trigger_event = [NAMESPACE].0301  # Host conclusion
			}
			[CHAIN_PREFIX]_disburse_host_rewards_effect = yes
		}
		else = {
			if = {
				limit = {
					is_alive = yes
					NOT = { this = scope:host }
					is_imprisoned = no
				}
				trigger_event = [NAMESPACE].0302  # Guest conclusion
			}
		}
	}

	###################
	# BACKGROUNDS
	###################

	background = {
		trigger = {
			activity_location.culture = { has_building_gfx = western_building_gfx }
		}
		texture = "gfx/interface/illustrations/event_scenes/feast.dds"
		environment = "environment_event_feast"
		ambience = "event:/SFX/Events/Backgrounds/feasthall"
	}

	background = {
		texture = "gfx/interface/illustrations/event_scenes/throne_room.dds"
		environment = "environment_event_throne_room"
		ambience = "event:/SFX/Events/Backgrounds/throne_room"
	}
}
```

---

### 2. On-Action Definitions
**Path:** `common/on_action/[CHAIN_PREFIX]_on_action.txt`

```pdx
###############################################################################
# ON-ACTIONS: [ACTIVITY_NAME]
###############################################################################

# Phase 1 event pool
[CHAIN_PREFIX]_phase1_event_selection = {
	trigger = {
		exists = scope:activity
	}
	random_events = {
		100 = [NAMESPACE].1001  # Random event 1
		100 = [NAMESPACE].1002  # Random event 2
		100 = [NAMESPACE].1003  # Random event 3
		50  = [NAMESPACE].1004  # Rare event
	}
}

# Phase 2 event pool
[CHAIN_PREFIX]_phase2_event_selection = {
	trigger = {
		exists = scope:activity
	}
	random_events = {
		100 = [NAMESPACE].2001  # Main phase event 1
		100 = [NAMESPACE].2002  # Main phase event 2
		100 = [NAMESPACE].2003  # Main phase event 3
		75  = [NAMESPACE].2004  # Drama event
		50  = [NAMESPACE].2005  # Rare encounter
	}
}

# AI-initiated sub-events (if needed)
[CHAIN_PREFIX]_ai_event_selection = {
	random_events = {
		100 = [NAMESPACE].3001
		100 = [NAMESPACE].3002
	}
}
```

---

### 3. Intents
**Path:** `common/activities/intents/[CHAIN_PREFIX]_intents.txt`

```pdx
###############################################################################
# INTENTS: [ACTIVITY_NAME]
###############################################################################

[INTENT_ID] = {
	category = default

	is_valid = {
		# Validation triggers
	}

	# Intent-specific parameters
	ai_will_do = {
		value = 100
	}
}

# Optional: Additional intents
[CHAIN_PREFIX]_special_intent = {
	category = default

	is_valid = {
		# Special requirements
		has_trait = [SPECIAL_TRAIT]
	}

	ai_will_do = {
		value = 50
		if = {
			limit = { has_trait = [SPECIAL_TRAIT] }
			add = 100
		}
	}
}
```

---

### 4. Guest Invite Rules (Optional Custom Rules)
**Path:** `common/activities/guest_invite_rules/[CHAIN_PREFIX]_guest_rules.txt`

```pdx
###############################################################################
# GUEST RULES: [ACTIVITY_NAME]
###############################################################################

# Example: Custom invite rule for specific character types
[CHAIN_PREFIX]_invite_rule_custom = {
	is_shown = {
		scope:host = {
			# Conditions for rule to appear
		}
	}

	potential_guests = {
		# List gathering logic
		scope:host = {
			every_courtier = {
				limit = {
					[CHAIN_PREFIX]_valid_guest_trigger = yes
				}
				add_to_list = guests
			}
		}
	}

	guests = {
		# Final guest selection
		every_in_list = {
			list = guests
			limit = {
				in_diplomatic_range = scope:host
			}
			add_to_list = potential_activity_guests
		}
	}
}
```

---

### 5. Scripted Triggers
**Path:** `common/scripted_triggers/[CHAIN_PREFIX]_triggers.txt`

```pdx
###############################################################################
# TRIGGERS: [ACTIVITY_NAME]
###############################################################################

# Basic eligibility trigger
[CHAIN_PREFIX]_can_participate_trigger = {
	is_adult = yes
	is_alive = yes
	is_imprisoned = no
	NOT = { has_trait = incapable }
}

# Valid guest trigger
[CHAIN_PREFIX]_valid_guest_trigger = {
	[CHAIN_PREFIX]_can_participate_trigger = yes
	in_diplomatic_range = scope:host
	NOT = { has_character_flag = [CHAIN_PREFIX]_blocked }
}

# Event blocking trigger
[CHAIN_PREFIX]_not_blocked_trigger = {
	NOT = { has_character_flag = [CHAIN_PREFIX]_block_events }
}

# Partner selection trigger
[CHAIN_PREFIX]_valid_partner_trigger = {
	save_temporary_scope_as = partner_check
	[CHAIN_PREFIX]_can_participate_trigger = yes
	NOT = { this = root }
	# Add attraction/relationship checks as needed
}

# Activity type check triggers
[CHAIN_PREFIX]_is_standard_type_trigger = {
	scope:activity = {
		has_activity_option = {
			category = [CHAIN_PREFIX]_option_type
			option = [CHAIN_PREFIX]_type_standard
		}
	}
}

[CHAIN_PREFIX]_is_elaborate_type_trigger = {
	scope:activity = {
		has_activity_option = {
			category = [CHAIN_PREFIX]_option_type
			option = [CHAIN_PREFIX]_type_elaborate
		}
	}
}
```

---

### 6. Scripted Effects
**Path:** `common/scripted_effects/[CHAIN_PREFIX]_effects.txt`

```pdx
###############################################################################
# EFFECTS: [ACTIVITY_NAME]
###############################################################################

# Find a valid partner
[CHAIN_PREFIX]_find_partner_effect = {
	scope:activity = {
		random_participant = {
			limit = {
				[CHAIN_PREFIX]_valid_partner_trigger = yes
			}
			weight = {
				base = 10
				modifier = {
					has_relation_friend = root
					add = 20
				}
				modifier = {
					has_relation_lover = root
					add = 30
				}
			}
			save_scope_as = [CHAIN_PREFIX]_partner
		}
	}
}

# Block event spam
[CHAIN_PREFIX]_block_events_effect = {
	add_character_flag = {
		flag = [CHAIN_PREFIX]_block_events
		days = 30
	}
}

# Unblock events
[CHAIN_PREFIX]_unblock_events_effect = {
	remove_character_flag = [CHAIN_PREFIX]_block_events
}

# Consequence management (if applicable)
[CHAIN_PREFIX]_add_consequence_immunity_effect = {
	add_character_flag = {
		flag = [CHAIN_PREFIX]_no_consequences
		days = 150
	}
}

[CHAIN_PREFIX]_remove_consequence_immunity_effect = {
	if = {
		limit = { has_character_flag = [CHAIN_PREFIX]_no_consequences }
		remove_character_flag = [CHAIN_PREFIX]_no_consequences
	}
}

# Host rewards distribution
[CHAIN_PREFIX]_disburse_host_rewards_effect = {
	scope:activity = {
		add_activity_log_entry = {
			key = [CHAIN_PREFIX]_host_completed
			tags = { completed }
			show_in_conclusion = yes
			character = scope:host
			
			scope:host = {
				add_prestige = medium_prestige_gain
				stress_impact = {
					base = minor_stress_loss
				}
			}
		}
	}
}

# Guest rewards
[CHAIN_PREFIX]_disburse_guest_rewards_effect = {
	add_prestige = minor_prestige_gain
	stress_impact = {
		base = miniscule_stress_loss
	}
}

# Create backup character (if needed)
[CHAIN_PREFIX]_create_guest_effect = {
	$WHO$ = { save_scope_as = who }
	create_character = {
		save_scope_as = created_character
		location = $WHO$.location
		culture = $WHO$.culture
		faith = $WHO$.faith
		gender_female_chance = 50
		# template = [CHAIN_PREFIX]_character_template
	}
	scope:created_character = {
		root = { add_to_activity = scope:activity }
	}
}
```

---

### 7. Opinion Modifiers
**Path:** `common/opinion_modifiers/[CHAIN_PREFIX]_opinion_modifiers.txt`

```pdx
###############################################################################
# OPINION MODIFIERS: [ACTIVITY_NAME]
###############################################################################

[CHAIN_PREFIX]_enjoyed_activity_opinion = {
	opinion = 15
	decaying = yes
	years = 3
}

[CHAIN_PREFIX]_disappointed_opinion = {
	opinion = -15
	decaying = yes
	years = 2
}

[CHAIN_PREFIX]_bonded_at_activity_opinion = {
	opinion = 25
	decaying = yes
	years = 5
}

[CHAIN_PREFIX]_insulted_at_activity_opinion = {
	opinion = -30
	decaying = yes
	years = 3
}
```

---

### 8. Main Events
**Path:** `events/[CHAIN_PREFIX]_events/[CHAIN_PREFIX]_main_events.txt`

```pdx
###############################################################################
# EVENTS: [ACTIVITY_NAME] - Main Activity Events
###############################################################################

namespace = [NAMESPACE]

###############################################################################
# EVENT: [NAMESPACE].0001 - "Travel/Passive State"
###############################################################################
[NAMESPACE].0001 = {
	type = activity_event
	title = [NAMESPACE].0001.t
	desc = [NAMESPACE].0001.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = personality_honorable
	}
	
	trigger = {
		exists = scope:activity
	}
	
	cooldown = { years = 1 }
	
	immediate = {
		play_music_cue = "mx_cue_[APPROPRIATE_MUSIC]"
	}
	
	option = {
		name = [NAMESPACE].0001.a
		add_prestige = miniscule_prestige_gain
	}
}

###############################################################################
# EVENT: [NAMESPACE].0002 - "Not Enough Guests"
###############################################################################
[NAMESPACE].0002 = {
	type = activity_event
	title = [NAMESPACE].0002.t
	desc = [NAMESPACE].0002.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = sadness
	}
	
	immediate = {
		scope:activity = {
			set_variable = { name = activity_invalidated }
		}
	}
	
	option = {
		name = [NAMESPACE].0002.a
	}
}

###############################################################################
# EVENT: [NAMESPACE].0101 - "Host Introduction"
###############################################################################
[NAMESPACE].0101 = {
	type = activity_event
	title = [NAMESPACE].0101.t
	desc = [NAMESPACE].0101.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = happiness
	}
	right_portrait = {
		character = scope:random_guest
		animation = personality_honorable
	}
	
	trigger = {
		exists = scope:activity
	}
	
	immediate = {
		scope:activity = {
			random_participant = {
				limit = { NOT = { this = scope:host } }
				save_scope_as = random_guest
			}
		}
	}
	
	option = {
		name = [NAMESPACE].0101.a
		custom_tooltip = [NAMESPACE]_activity_begins_tt
	}
}

###############################################################################
# EVENT: [NAMESPACE].0102 - "Guest Introduction"
###############################################################################
[NAMESPACE].0102 = {
	type = activity_event
	title = [NAMESPACE].0102.t
	desc = [NAMESPACE].0102.desc
	theme = [THEME]
	
	left_portrait = {
		character = scope:host
		animation = personality_honorable
	}
	right_portrait = {
		character = root
		animation = happiness
	}
	
	trigger = {
		exists = scope:activity
	}
	
	option = {
		name = [NAMESPACE].0102.a
	}
}

###############################################################################
# EVENT: [NAMESPACE].0201 - "Main Phase Gateway"
###############################################################################
[NAMESPACE].0201 = {
	type = activity_event
	title = [NAMESPACE].0201.t
	desc = [NAMESPACE].0201.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = thinking
	}
	
	trigger = {
		is_ai = no
		exists = scope:activity
		NOT = { has_character_flag = [CHAIN_PREFIX]_block_events }
	}
	
	immediate = {
		# Set up scopes for options
	}
	
	# Full participation
	option = {
		name = [NAMESPACE].0201.a
		custom_tooltip = [NAMESPACE].0201.a.tt
		# Effects for joining main activity
	}
	
	# Alternative path
	option = {
		name = [NAMESPACE].0201.b
		trigger = {
			# Condition for alternative
		}
		custom_tooltip = [NAMESPACE].0201.b.tt
		[CHAIN_PREFIX]_block_events_effect = yes
		trigger_event = {
			id = [NAMESPACE].0202
			days = { 3 7 }
		}
	}
	
	# Opt out
	option = {
		name = [NAMESPACE].0201.c
		custom_tooltip = [NAMESPACE].0201.c.tt
		[CHAIN_PREFIX]_block_events_effect = yes
		stress_impact = {
			shy = minor_stress_loss
		}
	}
}

###############################################################################
# EVENT: [NAMESPACE].0301 - "Host Conclusion"
###############################################################################
[NAMESPACE].0301 = {
	type = activity_event
	title = [NAMESPACE].0301.t
	desc = [NAMESPACE].0301.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = happiness
	}
	
	trigger = {
		exists = scope:activity
	}
	
	immediate = {
		play_music_cue = "mx_cue_positive_effect"
	}
	
	option = {
		name = [NAMESPACE].0301.a
		# Conclusion effects handled by on_complete
	}
}

###############################################################################
# EVENT: [NAMESPACE].0302 - "Guest Conclusion"
###############################################################################
[NAMESPACE].0302 = {
	type = activity_event
	title = [NAMESPACE].0302.t
	desc = [NAMESPACE].0302.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = happiness
	}
	right_portrait = {
		character = scope:host
		animation = personality_honorable
	}
	
	trigger = {
		exists = scope:activity
	}
	
	cooldown = { years = 3 }
	
	option = {
		name = [NAMESPACE].0302.a
		[CHAIN_PREFIX]_disburse_guest_rewards_effect = yes
	}
}
```

---

### 9. Random Events
**Path:** `events/[CHAIN_PREFIX]_events/[CHAIN_PREFIX]_random_events.txt`

```pdx
###############################################################################
# EVENTS: [ACTIVITY_NAME] - Random Phase Events
###############################################################################

namespace = [NAMESPACE]

###############################################################################
# EVENT: [NAMESPACE].1001 - "Phase 1 Random Event"
###############################################################################
[NAMESPACE].1001 = {
	type = activity_event
	title = [NAMESPACE].1001.t
	desc = [NAMESPACE].1001.desc
	theme = [THEME]
	
	left_portrait = {
		character = root
		animation = personality_bold
	}
	right_portrait = {
		character = scope:[CHAIN_PREFIX]_partner
		animation = happiness
	}
	
	trigger = {
		exists = scope:activity
		[CHAIN_PREFIX]_not_blocked_trigger = yes
		# Specific conditions
	}
	
	weight_multiplier = {
		base = 1
		# Weight modifiers
	}
	
	immediate = {
		[CHAIN_PREFIX]_find_partner_effect = yes
		# Set local variable to prevent repeat
		set_local_variable = {
			name = had_[NAMESPACE]_1001
			value = yes
		}
	}
	
	# Accept
	option = {
		name = [NAMESPACE].1001.a
		# Positive outcome
		reverse_add_opinion = {
			target = scope:[CHAIN_PREFIX]_partner
			modifier = [CHAIN_PREFIX]_enjoyed_activity_opinion
		}
	}
	
	# Decline
	option = {
		name = [NAMESPACE].1001.b
		reverse_add_opinion = {
			target = scope:[CHAIN_PREFIX]_partner
			modifier = [CHAIN_PREFIX]_disappointed_opinion
		}
	}
}

###############################################################################
# EVENT: [NAMESPACE].2001 - "Phase 2 Drama Event"
###############################################################################
[NAMESPACE].2001 = {
	type = activity_event
	title = [NAMESPACE].2001.t
	desc = [NAMESPACE].2001.desc
	theme = [THEME]
	
	left_portrait = {
		character = scope:character_a
		animation = anger
	}
	right_portrait = {
		character = scope:character_b
		animation = worry
	}
	
	trigger = {
		exists = scope:activity
		[CHAIN_PREFIX]_not_blocked_trigger = yes
		# Two characters with conflict needed
		scope:activity = {
			any_participant = {
				count >= 2
				NOT = { this = root }
			}
		}
	}
	
	weight_multiplier = {
		base = 0.75  # Lower weight for drama events
	}
	
	immediate = {
		set_local_variable = {
			name = had_[NAMESPACE]_2001
			value = yes
		}
		scope:activity = {
			random_participant = {
				limit = { NOT = { this = root } }
				save_scope_as = character_a
			}
			random_participant = {
				limit = {
					NOT = { this = root }
					NOT = { this = scope:character_a }
				}
				save_scope_as = character_b
			}
		}
	}
	
	# Mediate
	option = {
		name = [NAMESPACE].2001.a
		duel = {
			skill = diplomacy
			value = medium_skill_rating
			50 = {
				desc = [NAMESPACE].2001.a.success
				# Success effects
			}
			50 = {
				desc = [NAMESPACE].2001.a.failure
				# Failure effects
			}
		}
	}
	
	# Side with A
	option = {
		name = [NAMESPACE].2001.b
		progress_towards_friend_effect = {
			CHARACTER = scope:character_a
			OPINION = 15
		}
		reverse_add_opinion = {
			target = scope:character_b
			modifier = [CHAIN_PREFIX]_disappointed_opinion
		}
	}
	
	# Side with B
	option = {
		name = [NAMESPACE].2001.c
		progress_towards_friend_effect = {
			CHARACTER = scope:character_b
			OPINION = 15
		}
		reverse_add_opinion = {
			target = scope:character_a
			modifier = [CHAIN_PREFIX]_disappointed_opinion
		}
	}
	
	# Stay out of it
	option = {
		name = [NAMESPACE].2001.d
		stress_impact = {
			just = minor_stress_gain
		}
	}
}
```

---

### 10. Localization
**Path:** `localization/english/[CHAIN_PREFIX]_l_english.yml`

```yaml
l_english:
 # Activity
 [ACTIVITY_ID]: "[ACTIVITY_NAME]"
 TRAVEL_NAME_FOR_[ACTIVITY_ID]: "Travel for [ACTIVITY_NAME]"
 [ACTIVITY_ID]_host_an_a: "a"
 [ACTIVITY_ID]_name: "Your [ACTIVITY_NAME]"
 [ACTIVITY_ID]_owner: "Host"
 [ACTIVITY_ID]_desc: "[Description of the activity]"
 [ACTIVITY_ID]_destination_selection: "Select location to hold your [ACTIVITY_NAME]"
 [ACTIVITY_ID]_selection_tooltip: "[Benefits and requirements tooltip]"
 [ACTIVITY_ID]_host_desc: "[Host-specific description]"
 [ACTIVITY_ID]_guest_desc: "[Guest-specific description]"
 [ACTIVITY_ID]_conclusion_desc: "The [ACTIVITY_NAME] has concluded"

 # Phases
 [PHASE_1_ID]: "Phase 1 Name"
 [PHASE_1_ID]_desc: "Phase 1 description"
 [PHASE_2_ID]: "Phase 2 Name"
 [PHASE_2_ID]_desc: "Phase 2 description"

 # Options
 [CHAIN_PREFIX]_option_type: "Activity Type"
 [CHAIN_PREFIX]_type_standard: "Standard"
 [CHAIN_PREFIX]_type_standard_desc: "Standard type description"
 [CHAIN_PREFIX]_type_elaborate: "Elaborate"
 [CHAIN_PREFIX]_type_elaborate_desc: "Elaborate type description"

 # Intents
 [INTENT_ID]: "Intent Name"
 [INTENT_ID]_desc: "Intent description"

 # Activity Log
 [CHAIN_PREFIX]_started_title: "Activity Started"
 [CHAIN_PREFIX]_host_completed_title: "Activity Completed"

 # Tooltips
 [NAMESPACE]_activity_begins_tt: "The [ACTIVITY_NAME] begins!"

 # Events - 0001 Travel
 [NAMESPACE].0001.t: "On the Way"
 [NAMESPACE].0001.desc: "Description of travel/waiting..."
 [NAMESPACE].0001.a: "Let us proceed."

 # Events - 0002 Not Enough Guests
 [NAMESPACE].0002.t: "A Poor Turnout"
 [NAMESPACE].0002.desc: "Not enough guests arrived..."
 [NAMESPACE].0002.a: "Perhaps another time."

 # Events - 0101 Host Intro
 [NAMESPACE].0101.t: "Welcome, Everyone"
 [NAMESPACE].0101.desc: "Host introduction description..."
 [NAMESPACE].0101.a: "Let us begin!"

 # Events - 0102 Guest Intro
 [NAMESPACE].0102.t: "Arriving at the [ACTIVITY_NAME]"
 [NAMESPACE].0102.desc: "Guest arrival description..."
 [NAMESPACE].0102.a: "I look forward to this."

 # Events - 0201 Gateway
 [NAMESPACE].0201.t: "A Choice to Make"
 [NAMESPACE].0201.desc: "Gateway event description..."
 [NAMESPACE].0201.a: "Full participation"
 [NAMESPACE].0201.a.tt: "Join the main activity."
 [NAMESPACE].0201.b: "Alternative path"
 [NAMESPACE].0201.b.tt: "Take the alternative route."
 [NAMESPACE].0201.c: "Step aside"
 [NAMESPACE].0201.c.tt: "Opt out of active participation."

 # Events - 0301 Host Conclusion
 [NAMESPACE].0301.t: "A Successful [ACTIVITY_NAME]"
 [NAMESPACE].0301.desc: "Host conclusion description..."
 [NAMESPACE].0301.a: "Until next time!"

 # Events - 0302 Guest Conclusion
 [NAMESPACE].0302.t: "Departing"
 [NAMESPACE].0302.desc: "Guest conclusion description..."
 [NAMESPACE].0302.a: "Farewell."

 # Events - Random 1001
 [NAMESPACE].1001.t: "Random Event Title"
 [NAMESPACE].1001.desc: "Random event description..."
 [NAMESPACE].1001.a: "Accept"
 [NAMESPACE].1001.b: "Decline"

 # Events - Drama 2001
 [NAMESPACE].2001.t: "A Conflict"
 [NAMESPACE].2001.desc: "Drama event description..."
 [NAMESPACE].2001.a: "Mediate"
 [NAMESPACE].2001.a.success: "Mediation succeeded"
 [NAMESPACE].2001.a.failure: "Mediation failed"
 [NAMESPACE].2001.b: "Side with [character_a.GetFirstName]"
 [NAMESPACE].2001.c: "Side with [character_b.GetFirstName]"
 [NAMESPACE].2001.d: "Stay out of it"

 # Opinion Modifiers
 [CHAIN_PREFIX]_enjoyed_activity_opinion: "Enjoyed [ACTIVITY_NAME]"
 [CHAIN_PREFIX]_disappointed_opinion: "Disappointed at [ACTIVITY_NAME]"
 [CHAIN_PREFIX]_bonded_at_activity_opinion: "Bonded at [ACTIVITY_NAME]"
 [CHAIN_PREFIX]_insulted_at_activity_opinion: "Insulted at [ACTIVITY_NAME]"
```

---

## Event ID Numbering Convention

| Range | Purpose |
|-------|---------|
| 0001-0099 | System events (invalidation, travel, logs) |
| 0101-0199 | Phase 1 lifecycle events (intro, transitions) |
| 0201-0299 | Phase 2 lifecycle events (gateway, transitions) |
| 0301-0399 | Conclusion events |
| 1001-1999 | Phase 1 random events |
| 2001-2999 | Phase 2 random events |
| 3001-3999 | AI-initiated events |
| 9001-9999 | Debug/test events |

---

## Activity Lifecycle Flow

```
ACTIVITY CREATED
    │
    ▼
on_start
    │ - set_variable host_var
    │ - add_activity_log_entry
    │
    ▼
on_enter_passive_state ──► [NAMESPACE].0001 (Travel Event)
    │
    ▼
GUESTS ARRIVE (max_guest_arrival_delay_time)
    │
    ▼
PHASE 1: [PHASE_1_ID]
    │
    ├── on_phase_active
    │   ├── Host: [NAMESPACE].0101 or [NAMESPACE].0002
    │   └── Guest: [NAMESPACE].0102
    │
    ├── on_weekly_pulse ──► [CHAIN_PREFIX]_phase1_event_selection
    │   └── Random events 1001-1999
    │
    └── on_end (phase transition effects)
    │
    ▼
PHASE 2: [PHASE_2_ID]
    │
    ├── on_enter_phase
    │   └── Player: [NAMESPACE].0201 (Gateway)
    │
    ├── on_phase_active
    │   └── progress_activity_phase_after
    │
    ├── on_weekly_pulse ──► [CHAIN_PREFIX]_phase2_event_selection
    │   └── Random events 2001-2999
    │
    └── on_end (cleanup)
    │
    ▼
on_complete
    ├── Host: [NAMESPACE].0301 + rewards
    └── Guests: [NAMESPACE].0302 + rewards
    │
    ▼
ACTIVITY ENDS
```

---

## Checklist for New Activity

- [ ] Replace all `[PLACEHOLDER]` values
- [ ] Create activity type file
- [ ] Create on_action file
- [ ] Create intents file
- [ ] Create triggers file
- [ ] Create effects file
- [ ] Create opinion modifiers file
- [ ] Create main events file
- [ ] Create random events file
- [ ] Create localization file (UTF-8 with BOM)
- [ ] Add graphics (activity icon, header, phase icons)
- [ ] Test activity start/validity
- [ ] Test guest invitations
- [ ] Test phase transitions
- [ ] Test random event pools
- [ ] Test conclusion and rewards
- [ ] Verify localization displays correctly
