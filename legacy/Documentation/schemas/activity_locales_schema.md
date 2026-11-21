# Activity Locales Schema Documentation

## Overview

Activity locales define interactive location "hotspots" within an activity that characters can visit. Each locale represents a distinct area (e.g., tournament grounds, tavern, temple) with its own events, visuals, and AI behavior. Players and AI characters can enter locales to trigger locale-specific events during activities.

## File Location

```
common/activities/activity_locales/
```

## How Locales Link to Activities

Activity locales are referenced in activity type definitions via the `locales` block:

```pdx
# In activity_types/*.txt
activity_tournament = {
    locales = {
        tournament_locale_tournament_grounds   # Main arena
        tournament_locale_settlement           # Town area
        tournament_locale_visitor_camp         # Camp area
        tournament_locale_religious_building   # Temple/church
        tournament_locale_tavern               # Entertainment
        tournament_locale_artisans             # Craftsmen quarters
    }
}
```

---

## Schema Structure

### Basic Locale Definition

```yaml
activity_locales:
  type: root_block
  
  children:
    locale_key:
      type: named_block
      key_pattern: "^[a-z_][a-z0-9_]*$"
      cardinality: "0..inf"
      description: "Unique locale identifier"
```

### Scope Context (All Blocks)

| Scope | Type | Description |
|-------|------|-------------|
| `root` | Character | The character picking/entering the locale |
| `scope:host` | Character | The character hosting the activity |
| `scope:activity` | Activity | The activity itself |

---

## Field Reference

### is_available (Optional)

**Type**: Trigger block  
**Purpose**: Determines if this locale is available to the character

```pdx
is_available = {
    # Only available if host owns a temple
    scope:host = { has_held_title = yes }
}
```

**Notes**:
- If omitted, locale is always available
- Can reference activity, host, and current character

---

### chance (Optional)

**Type**: Script value (int32)  
**Purpose**: Weight for random selection when filling locale slots

```pdx
chance = {
    value = 1
    # Increase chance for specific cultures
    if = {
        limit = { culture = { has_cultural_pillar = ... } }
        add = 2
    }
}
```

**Notes**:
- Used for weighted random selection
- Default: 1 if omitted
- Higher value = more likely to be included

---

### on_enter_locale (Required)

**Type**: Effect block  
**Purpose**: Executes when a character enters the locale

```pdx
on_enter_locale = {
    trigger_event = { on_action = tournament_locale_tavern_events }
}
```

**Common Patterns**:
```pdx
# Fire events via on_action
on_enter_locale = {
    trigger_event = { on_action = my_locale_events }
}

# Direct effects
on_enter_locale = {
    add_stress = -5
    trigger_event = my_event.0001
}
```

---

### ai_will_do (Optional)

**Type**: Script value (int32)  
**Purpose**: Weight for AI decision to visit this locale

```pdx
ai_will_do = { 
    value = 0
    if = {
        limit = {
            highest_held_title_tier >= tier_county
        }
        add = 30
    }
}
```

**Notes**:
- Base value of 0 = AI won't visit without conditions
- Higher values = more likely AI visits
- Common pattern: Check rank before visiting

---

### cooldown (Optional)

**Type**: Duration block  
**Purpose**: Time before locale can be entered again after visiting

```pdx
cooldown = { days = 30 }
cooldown = { days = 7 }
cooldown = { months = 1 }
```

**Supported Units**:
- `days`
- `months`
- `years`

---

### visuals (Required)

**Type**: Triggered reference or string  
**Purpose**: Defines the visual widget displayed for the locale

**Long Form (Conditional)**:
```pdx
visuals = {
    trigger = {
        activity_location.culture = {
            has_graphical_india_culture_group_trigger = yes
        }
    }
    reference = locale_tournament1_india
}
```

**Short Form (Fallback)**:
```pdx
visuals = locale_tournament1_west  # Single visual, no conditions
```

**Visual Scopes**:
| Scope | Type | Description |
|-------|------|-------------|
| `root` | Activity | The activity itself |
| `scope:activity` | Activity | The activity itself |
| `scope:host` | Character | Host of the activity |

**Notes**:
- Multiple `visuals` blocks are evaluated in order
- First matching trigger wins
- Always include a fallback (short form) as last entry
- Reference points to widget in `gui/activity_locale_widgets/`

---

## Complete Schema Proposal (YAML)

```yaml
# pychivalry/pychivalry/data/schemas/activity_locales.yaml

meta:
  name: activity_locales
  file_pattern: "common/activities/activity_locales/*.txt"
  description: "Interactive location hotspots within activities"

root:
  type: file
  children:
    locale_definition:
      type: named_block
      key_validation:
        pattern: "^[a-z_][a-z0-9_]*$"
        description: "Unique locale identifier (e.g., tournament_locale_tavern)"
      cardinality: "0..inf"
      
      children:
        is_available:
          type: trigger_block
          required: false
          cardinality: "0..1"
          description: "Trigger to check if this locale is available for the activity"
          scope_context:
            root: character
            available_scopes:
              - name: host
                type: character
                description: "Character hosting the activity"
              - name: activity
                type: activity
                description: "The activity itself"
        
        chance:
          type: script_value
          value_type: int32
          required: false
          cardinality: "0..1"
          description: "Weight for locale selection (weighted random)"
          scope_context:
            root: character
            available_scopes:
              - name: host
                type: character
              - name: activity
                type: activity
        
        on_enter_locale:
          type: effect_block
          required: true
          cardinality: "1..1"
          description: "Effect executed when character enters the locale"
          scope_context:
            root: character
            available_scopes:
              - name: host
                type: character
              - name: activity
                type: activity
          common_effects:
            - trigger_event
        
        ai_will_do:
          type: script_value
          value_type: int32
          required: false
          cardinality: "0..1"
          description: "AI weight for choosing to visit this locale"
          scope_context:
            root: character
            available_scopes:
              - name: host
                type: character
              - name: activity
                type: activity
        
        cooldown:
          type: duration_block
          required: false
          cardinality: "0..1"
          description: "Time before locale can be re-entered"
          children:
            days:
              type: int
              cardinality: "0..1"
            months:
              type: int
              cardinality: "0..1"
            years:
              type: int
              cardinality: "0..1"
        
        visuals:
          type: choice
          required: true
          cardinality: "1..inf"
          description: "Visual widget references for locale display"
          choices:
            - type: triggered_reference
              children:
                trigger:
                  type: trigger_block
                  required: true
                  cardinality: "1..1"
                  description: "Condition for this visual variant"
                  scope_context:
                    root: activity
                    available_scopes:
                      - name: activity
                        type: activity
                      - name: host
                        type: character
                reference:
                  type: string
                  required: true
                  cardinality: "1..1"
                  description: "Widget name from gui/activity_locale_widgets/"
            
            - type: string
              description: "Direct widget reference (shorthand for fallback)"

localization:
  keys:
    - pattern: "{locale_key}"
      description: "Display name of the locale"
    - pattern: "{locale_key}_desc"
      description: "Description shown in tooltips"

diagnostics:
  - code: LOC001
    severity: error
    message: "Activity locale must contain an 'on_enter_locale' effect block"
    
  - code: LOC002
    severity: warning
    message: "Activity locale should have at least one 'visuals' entry"
    
  - code: LOC003
    severity: warning
    message: "Visuals block should include a fallback (string-only) entry as last item"
    
  - code: LOC004
    severity: info
    message: "Consider adding cooldown to prevent event spam"
    
  - code: LOC005
    severity: warning
    message: "ai_will_do with base value 0 requires conditions for AI to visit"
```

---

## Common Patterns

### 1. Basic Locale with Events

```pdx
my_locale_tavern = {
    on_enter_locale = {
        trigger_event = { on_action = my_locale_tavern_events }
    }
    
    chance = { value = 1 }
    
    ai_will_do = {
        value = 0
        if = {
            limit = { highest_held_title_tier >= tier_county }
            add = 30
        }
    }
    
    cooldown = { days = 30 }
    
    visuals = locale_tavern_west
}
```

### 2. Culture-Aware Visuals

```pdx
my_locale_grounds = {
    on_enter_locale = {
        trigger_event = { on_action = my_locale_grounds_events }
    }
    
    chance = { value = 1 }
    ai_will_do = { value = 40 }
    cooldown = { days = 30 }
    
    # Indian cultures
    visuals = {
        trigger = {
            activity_location.culture = {
                OR = {
                    has_graphical_india_culture_group_trigger = yes
                    has_graphical_east_asia_culture_group_trigger = yes
                }
            }
        }
        reference = locale_grounds_india
    }
    
    # MENA cultures
    visuals = {
        trigger = {
            activity_location.culture = {
                OR = {
                    has_graphical_mena_culture_group_trigger = yes
                    has_graphical_iranian_culture_group_trigger = yes
                    has_graphical_african_culture_group_trigger = yes
                    has_graphical_steppe_culture_group_trigger = yes
                }
            }
        }
        reference = locale_grounds_mena
    }
    
    # Western (fallback)
    visuals = locale_grounds_west
}
```

### 3. Quality-Based Visuals (Activity Progress)

```pdx
my_locale_arena = {
    on_enter_locale = {
        trigger_event = { on_action = my_locale_arena_events }
    }
    
    chance = { value = 1 }
    ai_will_do = { value = 50 }
    cooldown = { days = 20 }
    
    # High quality (many phases completed)
    visuals = {
        trigger = {
            num_phases > 4
            activity_location.culture = {
                has_graphical_western_culture_group_trigger = yes
            }
        }
        reference = locale_arena3_west  # Premium visual
    }
    
    # Normal quality
    visuals = {
        trigger = {
            activity_location.culture = {
                has_graphical_western_culture_group_trigger = yes
            }
        }
        reference = locale_arena1_west  # Standard visual
    }
    
    visuals = locale_arena1_west  # Fallback
}
```

### 4. Faith-Based Visuals (Religious Buildings)

```pdx
my_locale_temple = {
    on_enter_locale = {
        trigger_event = { on_action = my_locale_temple_events }
    }
    
    chance = { value = 1 }
    ai_will_do = { value = 30 }
    cooldown = { days = 30 }
    
    # Eastern religions
    visuals = {
        trigger = {
            activity_location.faith = {
                OR = {
                    religion = religion:shintoism_religion
                    religion = { is_in_family = rf_sinitic }
                    religion = { is_in_family = rf_eastern }
                    religion = religion:bon_religion
                }
            }
        }
        reference = locale_temple_india
    }
    
    # Islamic
    visuals = {
        trigger = {
            activity_location.faith = {
                religion = religion:islam_religion
            }
        }
        reference = locale_temple_mena
    }
    
    # Western/other
    visuals = locale_temple_west
}
```

### 5. Conditional Availability

```pdx
my_locale_secret_meeting = {
    # Only available to intrigue characters
    is_available = {
        OR = {
            has_lifestyle = intrigue_lifestyle
            intrigue >= 15
        }
    }
    
    on_enter_locale = {
        trigger_event = { on_action = secret_meeting_events }
    }
    
    chance = { value = 1 }
    ai_will_do = {
        value = 0
        if = {
            limit = { has_lifestyle = intrigue_lifestyle }
            add = 50
        }
    }
    
    cooldown = { days = 14 }
    visuals = locale_secret_chamber
}
```

---

## Validation Rules

### Required Checks

1. **on_enter_locale Required**: Every locale must have exactly one `on_enter_locale` effect block
2. **Visuals Required**: At least one `visuals` entry must be present
3. **Fallback Visual**: Final `visuals` entry should be a simple string (no trigger) for fallback

### Best Practices

1. **AI Behavior**: Always set base `ai_will_do` to 0 and add conditions:
   ```pdx
   ai_will_do = {
       value = 0  # Base prevents random AI visits
       if = {
           limit = { highest_held_title_tier >= tier_county }
           add = 30
       }
   }
   ```

2. **Visual Ordering**: Order visuals from most specific to least specific:
   - Quality variants first (`num_phases > X`)
   - Culture/faith variants next
   - Fallback last (string only)

3. **Cooldown Periods**: Use appropriate cooldowns to prevent event spam:
   - Major locales: 20-30 days
   - Minor locales: 7-14 days

4. **Event Integration**: Fire events via `on_action` for better organization:
   ```pdx
   on_enter_locale = {
       trigger_event = { on_action = my_activity_my_locale_events }
   }
   ```

---

## Visual Reference Naming Convention

```
locale_{type}[{quality}]_{culture_group}
```

**Examples**:
- `locale_tournament1_west` - Western tournament, normal quality
- `locale_tournament3_india` - Indian tournament, high quality (3)
- `locale_temple_mena` - MENA-style religious building
- `locale_camp_west` - Western visitor camp

**Culture Groups**:
- `west` - Western, Norse, Iberian, Mediterranean
- `india` - Indian, East Asian
- `mena` - MENA, Iranian, African, Steppe

---

## Integration with Activity Types

### Reference in Activity Definition

```pdx
# In activity_types/*.txt
activity_my_tournament = {
    # Other activity config...
    
    locales = {
        my_locale_arena
        my_locale_settlement
        my_locale_camp
        my_locale_tavern
        my_locale_temple
    }
}
```

### Creating the On-Action for Events

```pdx
# In common/on_action/
my_activity_locale_events = {
    trigger = {
        # Optional filtering
    }
    random_events = {
        100 = my_locale.0001
        100 = my_locale.0002
        100 = my_locale.0003
    }
}
```

---

## Localization Requirements

```yaml
# In localization/english/*_l_english.yml
l_english:
  tournament_locale_tavern: "Tavern"
  tournament_locale_tavern_desc: "A lively establishment where guests gather to drink, gamble, and share stories."
  
  tournament_locale_artisans: "Artisan Quarters"
  tournament_locale_artisans_desc: "The craftsmen's district, filled with armorers, weaponsmiths, and other skilled tradespeople."
```
