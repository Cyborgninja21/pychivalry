# CK3 Event Modding Reference

*Source: [Paradox Wiki - Event Modding](https://ck3.paradoxwikis.com/Event_modding)*

Events are the meat of every well-rounded mod; smaller and larger bits of story that can happen to a player during the campaign.

## Checklist

Your events must:
- Be in `your_mod/events/` folder
- Have a `.txt` extension
- Have a namespace defined on the first line, like `namespace = my_events`
- Use the namespace as their name + number, like `my_events.1 = {...`
- Be fired from script in some way, like by an on_action

Events do not fire automatically otherwise, like in older games. Other ways to fire them are decisions, character interactions, story cycles, etc.

---

## Table of Contents

1. [Scripting Tools](#scripting-tools)
2. [Location](#location)
3. [Structure](#structure)
4. [Portraits](#portraits)
5. [Themes](#themes)
6. [Trigger](#trigger)
7. [Description](#description)
8. [Immediate](#immediate)
9. [Options](#options)
10. [After](#after)
11. [Widgets](#widgets)
12. [On Actions](#on-actions-on_action)
13. [Strategy](#strategy)

---

## Scripting Tools

There are various tools capable of helping modders script events with greater ease.

### Visual Studio Code

[Visual Studio Code](https://code.visualstudio.com/) is considered to be the superior choice for modders due to the fact that it features various extensions that allow it to syntax highlight ParadoxScript.

**Recommended Extensions:**
- [CWTools - Paradox Language Services by Thomas Boby](https://marketplace.visualstudio.com/items?itemName=tboby.cwtools-vscode)
- [Paradox Syntax Highlighting by Thomas Boby](https://marketplace.visualstudio.com/items?itemName=tboby.paradox-syntax)

### Sublime Text

[Sublime Text](https://www.sublimetext.com/) is a popular choice amongst many because it excels at handling localization files. This is a free software.

### Notepad++

[Notepad++](https://notepad-plus-plus.org/) is a direct update over using regular notepad for scripting, if the two options above seem too daunting, you can start here.

---

## Location

Events belong in a `.txt` file inside the `events` directory directly below your root mod folder. Each file can hold as many events as one would like. The `events` directory may also have sub-folders containing their own event files, if one prefers.

---

## Structure

The overall structure is similar to that of a CK2 event, with some tweaks to the syntax and a whole lot of extra features, many of them optional.

### Minimal Event Example

The barest possible event:

```pdx
namespace = example

example.1 = {
    desc = example.1.desc
    
    option = {
        name = example.1.a
    }
}
```

Add this to your mod, trigger it from the in-game console using `event example.1`, and you have got yourself a working event! Everything else is optional, but necessary to really flesh out the events.

### Complete Event Example

A more fleshed out event containing only the basics:

```pdx
## This a basic event, use it as a base for other events.
## Though you probably will want to remove the annotation spam first.
superexample.1337 = { 
    # Use comments (like this one!) to put the event name here
    # This way other scripters can find the event you are working on without knowing the ID.
    type = character_event
    title = "A Modding Example Worthy of Kings" # Protip: you can use strings and later replace it with loc refs later
    desc = birth.1003.b # For Sublime users: there is a "find in files" feature that is excellent for digging through loc

    theme = mental_break
    left_portrait = root

    option = { 
        # Use comments to state what the option says or does
        # (eg "No, I denounce you heretic!" or "Engage in duel against child")
        # Much like with event titles, it's good practice.
        name = stewardship_domain_special.1424.a
    }
}
```

### ID and Namespace

Namespaces can be any alphanumeric string (without the '.' character), and are used as prefix in the form `<namespace>.<id>`. The ID uniquely identifies your event.

If an event file uses a namespace, it has to be declared at the beginning of the file with `namespace = <namespace>`. This has to be done for every file the namespace is used in.

> **Warning:** If the ID exceeds 9999, the event calling system will become buggy, so please consider the max allowed ID for a given namespace as 9999.

### Flags

These are top-level variables that determine your event's kind and appearance. They have a limited set of values.

| Flag | Meaning | Possible Values |
|------|---------|-----------------|
| `type` | The kind of event. It determines what sort of scope the root is. | `character_event`, `letter_event`, `duel_event`, `none` (when an event doesn't use the root scope at all), `empty` (necessary for characterless events to trigger) |
| `hidden` | Set this to true, and the event will not be shown at all; it will happen in the background. Useful for doing maintenance events that are not immediately relevant to the player. | `true`, `false` |

---

## Portraits

In Crusader Kings III, portraits are now in 3D, and can now be animated as well!

### Portrait Positions

| Portrait Position | Description |
|-------------------|-------------|
| `left_portrait` | Shown on the left side of the event scene |
| `right_portrait` | Shown on the right side of the event scene |
| `lower_left_portrait` | Shown on the lower left part of the event scene |
| `lower_center_portrait` | Shown on the lower center part of the event scene |
| `lower_right_portrait` | Shown on the lower right part of the event scene |

#### Portrait Example

```pdx
example_event.1001 = {
    left_portrait = {
        character = ROOT # Whoever this is scoped to will show up in this event window position
        animation = fear # Take note that characters with SOME genetic traits that change their 
                         # character models have different animations
    }
    right_portrait = {
        character = ROOT
        animation = scheme
    }
    lower_left_portrait = {
        character = ROOT
    }
    lower_center_portrait = {
        character = ROOT
    }
    lower_right_portrait = {
        character = ROOT
    }
}
```

### Portrait Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `character` | The character whose portrait is shown | `character = scope:event_target` |
| `animation` | The animation that will play | `animation = anger` |
| `triggered_animation` | Plays a certain animation if the triggers are met. If not, will default to animation set with `animation =` | `triggered_animation = { trigger = {} animation = fear }` |
| `triggered_outfit` | Set an outfit for use in this event | `triggered_outfit = { trigger = {} outfit_tags = no_clothes remove_default_outfit = yes/no }` |
| `hide_info` | Prevents the game from showing any info on the character (tooltip, COA, clicks, etc). Only the portrait will be shown. | `hide_info = yes/no` |

### Animations

#### Basic Emotions
| | | | | | |
|-|-|-|-|-|-|
| idle | chancellor | steward | marshal | spymaster | chaplain |
| anger | rage | disapproval | disbelief | disgust | fear |
| sadness | shame | shock | worry | boredom | grief |
| paranoia | dismissal | flirtation | flirtation_left | love | schadenfreude |
| stress | happiness | ecstasy | admiration | lunatic | scheme |

#### Actions & States
| | | | | | |
|-|-|-|-|-|-|
| beg | pain | poison | aggressive_axe | aggressive_mace | aggressive_sword |
| aggressive_dagger | aggressive_spear | aggressive_hammer | celebrate_axe | celebrate_mace | celebrate_sword |
| celebrate_dagger | celebrate_spear | celebrate_hammer | loss_1 | chess_certain_win | chess_cocky |
| laugh | lantern | eyeroll | eavesdrop | assassin | toast |
| toast_goblet | drink | drink_goblet | newborn | sick | severelywounded |
| prisonhouse | prisondungeon | war_attacker | war_defender | war_over_tie | war_over_win |
| war_over_loss | pregnant | | | | |

#### Personality Animations
| | | | | | |
|-|-|-|-|-|-|
| personality_honorable | personality_dishonorable | personality_bold | personality_coward | personality_greedy | personality_content |
| personality_vengeful | personality_forgiving | personality_rational | personality_irrational | personality_compassionate | personality_callous |
| personality_zealous | personality_cynical | | | | |

#### Throne Room Animations
| | | | | | |
|-|-|-|-|-|-|
| throne_room_chancellor | throne_room_kneel_1 | throne_room_kneel_2 | throne_room_curtsey_1 | throne_room_messenger_1 | throne_room_messenger_2 |
| throne_room_messenger_3 | throne_room_conversation_1 | throne_room_conversation_2 | throne_room_conversation_3 | throne_room_conversation_4 | throne_room_cheer_1 |
| throne_room_cheer_2 | throne_room_applaud_1 | throne_room_bow_1 | throne_room_bow_2 | throne_room_bow_3 | throne_room_ruler |
| throne_room_ruler_2 | throne_room_ruler_3 | throne_room_one_handed_passive_1 | throne_room_one_handed_passive_2 | throne_room_two_handed_passive_1 | throne_room_writer |

#### Special Animations
| | | | | | |
|-|-|-|-|-|-|
| crying | delirium | disappointed | eccentric | manic | interested |
| interested_left | stunned | wailing | wedding_happy_cry | peekaboo | child_hobby_horse |
| clutching_toy | clutching_ball | clutching_doll | go_to_your_room | cough | shiver |
| sick_stomach | page_flipping | writing | reading | stressed_teacher | happy_teacher |
| thinking | emotion_thinking_scepter | wedding_drunk | acknowledging | betting | bribing |
| dancing | dancing_plague | debating | hero_flex | obsequious_bow | physician |
| prayer | scepter | stayback | storyteller | survey | incapable |
| dead | survey_staff | | | | |

#### Combat Animations
| | | | | | |
|-|-|-|-|-|-|
| aggressive_unarmed | sword_coup_degrace | wrestling_victory | sword_yield_start | wrestling_yield_start | wooden_sword_yield_start |
| throne_room_wooden_sword | celebrate_wooden_sword | aggressive_wooden_sword | marshal_wooden_sword | wooden_sword_coup_degrace | random_weapon_coup_degrace |
| random_weapon_aggressive | random_weapon_celebrate | random_weapon_yield | inspect_weapon | menacing | threatening |

#### Hunting & Sports Animations
| | | | | | |
|-|-|-|-|-|-|
| bow_idle | hunting_shortbow_rest_arrow_default | hunting_shortbow_rest_bluntarrow_default | hunting_shortbow_aim_arrow_default | hunting_shortbow_aim_bluntarrow_default | hunting_longbow_rest_arrow_default |
| hunting_longbow_rest_bluntarrow_default | hunting_longbow_aim_arrow_default | hunting_longbow_aim_bluntarrow_default | hunting_horn | hunting_carcass_start | hunting_knife_start |
| hunting_falcon | jockey_lance_tilted | jockey_lance_couched_gallop | jockey_gallop | jockey_idle | jockey_victory |
| jockey_loss | jockey_walk | jockey_wave | chariot_neutral | chariot_happy | chariot_shocked |

#### Wedding & Music Animations
| | | | | | |
|-|-|-|-|-|-|
| wedding_groom_right | wedding_bride_left | wedding_priest | reception_groom_left | reception_bride_right | wedding_objection_start |
| instrument_active | instrument_idle | shawm_active | shawm_idle | qanun_active | qanun_idle |
| lute_active | lute_idle | chifonie_active | chifonie_idle | alto_flute_active | alto_flute_idle |

---

## Themes

A Theme is a collection of background, lighting environment for character portraits, and sound effects. They are declared in `common/event_themes/`.

### Available Themes

| | | | |
|-|-|-|-|
| abduct_scheme | alliance | bastardy | battle |
| befriend_scheme | claim_throne_scheme | corruption | crown |
| culture_change | death | default | diplomacy |
| diplomacy_family_focus | diplomacy_foreign_affairs_focus | diplomacy_majesty_focus | dread |
| dungeon | dynasty | education | fabricate_hook_scheme |
| faith | family | feast_activity | friend_relation |
| friendly | generic_intrigue_scheme | healthcare | hunt_activity |
| hunting | intrigue | intrigue_intimidation_focus | intrigue_skulduggery_focus |
| intrigue_temptation_focus | learning | learning_medicine_focus | learning_scholarship_focus |
| learning_theology_focus | love | lover_relation | marriage |
| martial | martial_authority_focus | martial_chivalry_focus | martial_strategy_focus |
| medicine | mental_break | mental_health | murder_scheme |
| party | pet | physical_health | pilgrimage_activity |
| pregnancy | prison | realm | recovery |
| rival_relation | romance_scheme | secret | seduce_scheme |
| seduction | skull | stewardship | stewardship_domain_focus |
| stewardship_duty_focus | stewardship_wealth_focus | sway_scheme | unfriendly |
| vassal | war | witchcraft | |

Individual elements of the theme can be overridden using `override_background`, `override_icon`, `override_sound`, and `override_environment`.

### Backgrounds

| | | | |
|-|-|-|-|
| alley_day | alley_night | armory | army_camp |
| battlefield | bedchamber | burning_building | corridor_day |
| corridor_night | council_chamber | courtyard | docks |
| dungeon | farmland | feast | gallows |
| garden | market | market_east | market_india |
| market_tribal | market_west | physicians_study | sitting_room |
| study | tavern | temple | temple_church |
| temple_generic | temple_mosque | temple_scope | terrain |
| terrain_activity | terrain_scope | throne_room | throne_room_east |
| throne_room_india | throne_room_mediterranean | throne_room_scope | throne_room_tribal |
| throne_room_west | wilderness | wilderness_desert | wilderness_forest |
| wilderness_forest_pine | wilderness_mountains | wilderness_scope | wilderness_steppe |

### Environments

When you've selected a background, the appropriate environment is automatically selected. Only overwrite it when necessary.

| | | |
|-|-|-|
| environment_body | environment_council | environment_cw_east_main |
| environment_cw_east_spouse | environment_cw_east_throneroom_main | environment_cw_east_throneroom_spouse |
| environment_cw_india_main | environment_cw_india_spouse | environment_cw_india_throneroom_main |
| environment_cw_india_throneroom_spouse | environment_cw_mediterranean_main | environment_cw_mediterranean_spouse |
| environment_cw_mediterranean_throneroom_main | environment_cw_mediterranean_throneroom_spouse | environment_cw_tavern |
| environment_cw_tavern_spouse | environment_cw_tribal_main | environment_cw_tribal_spouse |
| environment_cw_west | environment_cw_west_spouse | environment_event_alley |
| environment_event_alley_day | environment_event_armory | environment_event_battlefield |
| environment_event_bedchamber | environment_event_church | environment_event_corridor_day |
| environment_event_courtyard | environment_event_desert | environment_event_docks |
| environment_event_dungeon | environment_event_farms | environment_event_feast |
| environment_event_forest | environment_event_forest_pine | environment_event_gallows |
| environment_event_garden | environment_event_genericcamp | environment_event_market_east |
| environment_event_market_tribal | environment_event_market_west | environment_event_mosque |
| environment_event_mountains | environment_event_sittingroom | environment_event_standard |
| environment_event_steppe | environment_event_study | environment_event_study_physician |
| environment_event_tavern | environment_event_temple | environment_event_throne_room_west |
| environment_war_overview | | |

---

## Trigger

This is an additional requirement for an event to work.

```pdx
trigger = { 
    # This is the set of requirements necessary for this event to enable 
    # (a giant IF statement for the event itself)
    culture = {
        has_innovation = innovation_guilds # Checks if you have unlocked guilds on your cultural research
    }
}
```

### Conditional Triggers with trigger_if

You can also lock certain requirements in a trigger behind a trigger of their own, using `trigger_if`. The requirements inside of the `trigger_if` will only be checked if the contents of the `limit` block are true. Optionally, you can add a `trigger_else` afterwards to check alternative requirements if the `trigger_if` fails.

```pdx
trigger = {
    any_held_county = { # We check that we have a blacksmith
        any_county_province = {
            has_building_or_higher = blacksmiths_01
        }
    }

    trigger_if = { # If our character is greedy, then we add the requirement to have 500 gold
        limit = { has_trait = greedy }
        gold > 500
    }
    trigger_else = { # Otherwise, you must have at least 50 piety and 10 gold
        piety > 50
        gold > 10
    }
}
```

### Important: Trigger Evaluation Order

> **Critical:** The trigger is checked **before** the event fires, which means that you cannot use any of the scopes created in the Immediate block when checking if certain characters meet triggers.

For example, if you wanted to create an event where you wanted to know if a knight had the brave trait, you could **not** create a scope called `scope:knight` in the immediate block and then check that same scope in the trigger. Instead, to check if a character could meet the triggers for your event, you probably want to use a list builder.

```pdx
trigger = {
    any_knight = { # Will look at all knights of the root character to see if any match the triggers
        has_trait = brave
    }
}
```

### on_trigger_fail

Runs when the trigger fails.

---

## Description

Text that is going to show up in the event window can include the event's title, description, option names, and option flavor text.

### Literal Text vs Localization Keys

```pdx
my_event.0001 = {
    title = "The Event's Title" # Literal text which will show up in game exactly as displayed here
    desc = my_event.0001.desc   # A localization key to be defined in your_mod\localization\english
    # ...
}
```

It can be useful to write literal text when in the early stages of writing an event, but it is generally not advised to use literal text in your mod as it:
- Produces an error in the error.log
- Prevents you from using the powerful data context tools that allow you to reactively write out a character's name, pronouns, etc.

### Dynamic Descriptions with first_valid and random_valid

```pdx
desc = {
    first_valid = { # Display the localization of the first valid desc block which returns true
        triggered_desc = {
            trigger = {
                has_trait = drunkard
            }
            desc = my_event.0001.desc.drunkard # A loc key to display if the trigger is true
        }
        desc = my_event.0001.desc.fallback # Another loc key to display if nothing before it is valid
    }
    random_valid = { # Will display a random localization key, picking from any loc keys for which the triggers return true
        desc = my_event.0001.random_1
        desc = my_event.0001.random_2
        desc = my_event.0001.random_3
        triggered_desc = {
            trigger = {
                is_female = yes
            }
            desc = my_event.0001.random_4
        }
    }
}
```

### Combining first_valid and random_valid

```pdx
desc = {
    first_valid = { # Pick the first desc block that returns true
        triggered_desc = { # If the character has brave...
            trigger = {
                has_trait = brave 
            }
            desc = { # Then randomly pick one of these
                random_valid = {
                    desc = my_event.0001.brave.random_1
                    desc = my_event.0001.brave.random_2
                    desc = my_event.0001.brave.random_3
                }
            }
        }
        desc = { # Otherwise, if not brave, randomly pick one of these
            random_valid = {
               desc = my_event.0001.fallback.random_1
               desc = my_event.0001.fallback.random_2
               desc = my_event.0001.fallback.random_3
            }
        }
    }
}
```

### Multi-Part Descriptions

You can combine multiple `desc` entries:

```pdx
desc = {
    desc = { # Only display the opening if the character has the eccentric trait
        first_valid = {
            triggered_desc = {
                trigger = {
                    has_trait = eccentric
                }
                desc = "Many people have said, because of my eccentricity,"
            }
        }
    }
    desc = "I am an endless font of inspiration," # Always display the middle
    desc = { # Display a different ending depending on if the character has the pregnant trait
        first_valid = {
            triggered_desc = {
                trigger = {
                    has_trait = pregnant
                }
                desc = "and I hope that I am able to pass that on to my child."
            }
            desc = "and it feels good to be appreciated like that."
        }
    }
}
```

> **Note:** When you combine localization strings like this, they are concatenated with a space between strings.

### Dynamic Option Names

For option names, you have to use a `text` block between `name` and `first_valid`:

```pdx
option = {
    name = {
        text = {
            first_valid = {
                triggered_desc = {
                    trigger = {
                        is_female = yes
                    }
                    desc = my_event.0001.a.female
                }
                desc = my_event.0001.a.fallback
            }
        }
    }
}
```

Alternative syntax for options:

```pdx
name = {
    trigger = { has_trait = brave }
    text = my_event.0001.a.brave
}
```

### Flavor Text

For `flavor` blocks, you do not need the `text` block:

```pdx
flavor = {
    first_valid = {
        triggered_desc = {
            trigger = {
                is_female = yes
            }
            desc = my_event.0001.a.flavor.female
        }
        desc = my_event.0001.a.flavor.fallback
    }
}
```

---

## Immediate

This is a block of effect script: it will be run immediately as your event is triggered, **before** the title, description, and portraits are even evaluated let alone rendered.

This block is useful for:
- Setting variables and saving scopes to use in your text or for portraits
- Functional effects that you want to happen without the player having any control over it

```pdx
immediate = { 
    # Stuff that happens when the event appears on screen
    # Works regardless of what option you select
    add_gold = 50 # adds 50 gold to the player 
}
```

---

## Options

Options within events are able to be pressed by the user. Each event may have any number of options, including none at all (a common example includes hidden events).

### Basic Option Structure

```pdx
example.1 = {
    # [...]

    option = {
        # option info
    }

    # [...]
}
```

### Complex Option Example

```pdx
option = { # Option title
    name = stewardship_domain_special.1424.a
    trigger_event = { # Makes another event happen
        id = yearly.1012 # The event ID
        days = { 7 14 } # Get random number between two values
    }

    hidden_effect = { # Hides stuff from showing up on the tooltip of the option
        scope:county = { # Gets the location stored in the scope "county"
            add_county_modifier = { # To add modifiers (bonuses or penalties)
                modifier = governance_land_cleared_for_settlement_modifier
                days = 3650 # How long it lasts, you can use days = {X Y} too
            }
        }
    }

    ai_chance = {
        base = 50 # What are the chances of selecting this option over others?
        modifier = {
            add = 15
            has_trait = sadistic
        }
        modifier = {
            add = -40 # To remove something you just add a negative number
            has_trait = compassionate
        }
    }
}
```

### Option Keys Reference

| Key | Required | Description | Example |
|-----|----------|-------------|---------|
| `name` | Yes | Points to a localization key for the event option button text | `name = example.1.a` |
| (effects) | No | Any effects that the option may have can be written directly in the option block | `play_music_cue = mx_cue_banquet` |
| `trigger` | No | Defines a trigger that has to be fulfilled for the option to be valid and thus available to the user. Not to be confused with the main event trigger. | `trigger = { has_trait = shy }` |
| `show_as_unavailable` | No | If the option is invalid, but this trigger is, the option will be shown, but disabled. | `show_as_unavailable = { short_term_gold < medium_gold_value }` |
| `trait` | No | If the player has the given trait, show it on the left side of the option. Hovering over it will say the option is available because of the trait. This is only providing flavor, and does not actually affect the functionality of the option. | `trait = honest` |
| `skill` | No | Show the chosen skill on the left side of the option. Hovering over it will say the option is available because of your high skill. This is only providing flavor. | `skill = prowess` |
| `add_internal_flag` | No | Can take the values "special" or "dangerous". "special" highlights the option as yellow, "dangerous" highlights as red. This is only providing flavor. | `add_internal_flag = special` |
| `highlight_portrait` | No | Highlights the event portrait of this character while this option is hovered. | `highlight_portrait = scope:custom` |
| `fallback` | No | If this is yes: if no other options meet their triggers, then this option will be shown even if its trigger is not met either. You can use this together with `trigger = { always = no }` to create an option that is only ever shown as a last resort. | `fallback = yes` |
| `exclusive` | No | If an option is marked `exclusive = yes` and it meets its triggers, it will be the only option shown. If multiple options are marked exclusive and each meets their triggers, each will be shown. | `exclusive = yes` |
| `flavor` | No | Flavor text that is shown in the tooltip of the option. The flavor can either be a loc key or a dynamic desc with first_valid etc. | `flavor = my_events.1001.a.flavor` |

---

## After

This is a block of effect script that runs after the event has run its course and an option has been chosen. Works the exact same as the immediate block. Won't do anything if the event has no options (for hidden events, for example).

It is most commonly used for clean-up duty, removing variables, characters, and other kinds of data that are likely to persist when not intended to.

```pdx
after = {
    if = {
        limit = { NOT = { exists = scope:fp2_2009_thief_permanence_scope } } # Acts as a boolean
        scope:fp2_2009_garduna_young_thief = { silent_disappearance_effect = yes } # Delete the young thief
    }
}
```

---

## Widgets

*(Documentation section for widget types - to be expanded)*

---

## On Actions (on_action)

On Actions are scripts that execute every time a specific action is called by the game code (such as a child being born, a character inheriting land or using a hook). This allows modders to intercept and run their own scripts whenever said On Actions are called.

They are defined in `common/on_action`

> **Important:** Double-check your path. This is a singular `on_action`, not `on_actions`. This is a common mistake.

### Basic Example

Trigger a custom event when a child is born:

```pdx
on_birth_child = {
    events = {
        my_event.1
    }
}
```

Some on_actions are called by game code directly, while others are called by script: other on_actions, events, decisions, etc.

For example, `on_birthday` is fired by code every birthday and tries to fire `on_birthday_adulthood`, but since it has a trigger `is_adult = yes` it will only fire when a character is an adult.

### Common On Action Examples

| On Action | Description |
|-----------|-------------|
| `on_birth_child` | When a child is born |
| `on_16th_birthday` | When a child becomes an adult |
| `random_yearly_playable_pulse` | Once a year, at a random date, for every count+ character who is allowed to be played. Useful for rare events. |
| `quarterly_playable_pulse` | A more frequent pulse, every three months, for the same kind of characters |
| `on_game_start` | When the game starts, but before the player selects a character, so `every_player` doesn't work here |
| `on_game_start_after_lobby` | After the player has selected a character and confirmed. This is where you can affect player characters |
| `on_death` | Right before a character dies. Useful to transfer any variables to the primary_heir |

> **Note:** There is no monthly on_action. This was done to ensure better performance.

### Creating a Monthly Pulse Workaround

If you really need a monthly pulse, you could use `quarterly_playable_pulse` and trigger your on_action three times with increasing delay:

```pdx
on_actions = {
    my_on_action
    delay = { months = 1 }
    my_on_action
    delay = { months = 2 }
    my_on_action
}
```

Alternatively, have the on_action call itself with a monthly delay.

### Appending On Actions

Most of the time, we want to add something to on_actions without overwriting them. We call this **appending**.

> **Important:** Effects and triggers cannot be appended directly. Only events and other on_actions are appended.

To ensure compatibility and not overwrite vanilla effects:

1. Make a new txt file
2. Create your own on_action and add it to an existing on_action:

```pdx
on_birth_child = { 
    on_actions = {
        my_on_action # custom on_action appended to on_birth_child
    } 
} 

my_on_action = {
    trigger = { ... } # trigger used only for this on_action
    effect = { ... }  # all effects are appended safely
}
```

**This will OVERWRITE vanilla effect and trigger (and any added by other mods):**

```pdx
on_birth_child = {
    trigger = { ... } 
    effect = { ... } # effect and trigger are overwritten, not appended
}
```

On_actions can also be called by events and other effects like this:

```pdx
trigger_event = { on_action = my_on_action }
```

### Scopes in On Actions

Make sure to check what scopes are available in each on_action. There are comments above each on_action in their files that explain their scopes.

For example, `on_game_start` doesn't have a root scope. It fires once, globally. This means we need to use global effects, like `every_ruler`.

On the other hand, `yearly_playable_pulse` fires for all playable characters, and has the character as the root scope. So we can use character effects directly, like `add_gold`.

> **Important:** Do not use `every_living_character` in `yearly_playable_pulse` and similar on_actions. That on_action already fires for every character. If you then try to iterate through all characters, that would result in about 200002 operations, causing massive lag and repetition of your effects.

### On Action Properties

| Name | Description | Example |
|------|-------------|---------|
| `trigger` | On_actions can have triggers. If an on_action fires and its trigger returns false, nothing happens | `trigger = { trigger_conditions = yes }` |
| `weight_multiplier` | Used to manipulate the weight of this on_action if it is a candidate in a random_on_actions list | `weight_multiplier = { base = 1 modifier = { add = 1 trigger_conditions = yes } }` |
| `events` | Events listed in "events" brackets will always fire as long as their trigger evaluates to true | See below |
| `random_events` | A single event will be picked to fire | See below |
| `first_valid` | Pick the first event for which the trigger returns true | `first_valid = { event_id_1 event_id_2 fallback_event }` |
| `on_actions` | An on_action can fire other on_actions, following the same rules as with events | `on_actions = { on_action_1 on_action_2 }` |
| `random_on_actions` | Same as with events. On_actions are factored by their weight_multipliers (defaults to 1) | `random_on_actions = { 100 = on_action_1 200 = on_action_2 }` |
| `first_valid_on_action` | Pick the first on_action for which the trigger returns true | `first_valid_on_action = { on_action_1 on_action_2 }` |
| `effect` | An on_action can run effects. Note that it happens concurrently to events triggered by the on_action, NOT before. | `effect = { effects = yes }` |
| `fallback` | If no events/on_actions are run by the on_action, the fallback gets called instead. Avoid creating infinite fallback loops! | `fallback = another_on_action` |

#### Events Block Example

```pdx
events = { 
    event_id_1 
    delay = { days = 365 } # Events listed after delay will only fire after the delay has passed
    # NOTE: For performance, an event will only fire if valid both when on_action executes AND after delay
    event_id_2 
    delay = { months = { 6 12 } } # Setting a new delay overrides previous. Delays support random ranges
    event_id_3 
}
```

#### Random Events Block Example

```pdx
random_events = { 
    chance_to_happen = 25 # Percentage chance whether events will be evaluated at all
    chance_of_no_event = { # Can be formatted as script value with conditional entries
        value = 0
        if = {
            limit = { trigger_conditions = yes }
            add = 10
        }
    }
    100 = event_id_1 # The number is the weight for picking a specific event
    200 = event_id_2 # Higher weight = more likely to be picked
    50 = 0           # Weight for "no event happens"
}
```

### On Actions From Code (Partial List)

| On Action | Root Scope |
|-----------|------------|
| `on_birth_child` | Character |
| `on_birth_mother` | Character |
| `on_birth_father` | None |
| `on_death` | Character |
| `on_marriage` | Character |
| `on_divorce` | None |
| `on_game_start` | None |
| `on_game_start_after_lobby` | None |
| `on_birthday` | Character |
| `on_title_gain` | Character |
| `on_title_lost` | None |
| `on_war_started` | None |
| `on_war_won_attacker` | Casus belli |
| `on_war_won_defender` | Casus belli |
| `on_war_white_peace` | None |
| `on_imprison` | Character |
| `on_release_from_prison` | Character |
| `on_character_faith_change` | Character |
| `on_character_culture_change` | Character |
| `random_yearly_playable_pulse` | Character |
| `random_yearly_everyone_pulse` | Character |
| `quarterly_playable_pulse` | None |
| `yearly_playable_pulse` | Character |
| `yearly_global_pulse` | None |
| `five_year_playable_pulse` | Character |
| `five_year_everyone_pulse` | Character |
| `three_year_playable_pulse` | Character |
| `three_year_pool_pulse` | Character |

---

## Strategy

### Triggering the Event

Events do not fire automatically, they have to be fired by something in the script, for example:
- On_actions
- Story cycles
- Decisions
- Character interactions
- etc.

### Techniques and Design Patterns

If you just input the information directly, you will be overriding vanilla on_actions. The example below is one way to add your own events safely:

```pdx
five_year_playable_pulse = { 
    on_actions = { my_five_year_playable_pulse }
}

my_five_year_playable_pulse = {
    random_events = {
        # Your events here
    }
}
```

---

## Related Documentation

| Category | Topics |
|----------|--------|
| **Documentation** | Scripting • Scopes • Effects • Triggers • Variables • Modifiers |
| **Scripting** | AI • Bookmarks • Characters • Commands • Council • Culture • Decisions • Dynasties • Events • Governments • History • Holdings • Lifestyles • Regiments • Religions • Script Values • Story cycles • Struggles • Titles • Traits |
| **Interface** | Interface • Data types • Localization • Customizable localization • Flavorization |
| **Map** | Map • Terrain |
| **Graphics** | 3D models • Exporters • Coat of arms • Graphical assets • Fonts • Particles • Shaders • Unit models |
| **Audio** | Music • Sound |
| **Other** | Console commands • Checksum • Mod structure • Mod compatibility • Modding tools • Troubleshooting |
