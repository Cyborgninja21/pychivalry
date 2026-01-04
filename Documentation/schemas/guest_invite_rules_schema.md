# Guest Invite Rules Schema Documentation

## Overview

Guest invite rules define scriptable character lists for activity guest invitations. Each rule builds a list of potential characters using the `effect` block and the `add_to_list = characters` command.

## File Location

```
common/activities/guest_invite_rules/
```

## How Rules Link to Activities

Guest invite rules are referenced in activity type definitions via the `guest_invite_rules` block:

```pdx
# In activity_types/*.txt
activity_feast = {
    guest_invite_rules = {
        rules = {
            # Priority number (lower = higher priority) = rule_key
            2 = activity_invite_rule_rivals_if_appropriate
            3 = activity_invite_rule_extended_family
            4 = activity_invite_neighbouring_rulers
            5 = activity_invite_rule_knights
            6 = activity_invite_mp
        }
        defaults = {
            # Rules enabled by default for players
            1 = activity_invite_rule_friends
            1 = activity_invite_rule_potential_friends
            2 = activity_invite_rule_lovers
            # ... etc
        }
    }
}
```

---

## Schema Structure

### Basic Rule Definition

```yaml
guest_invite_rules:
  type: root_block
  
  children:
    rule_key:
      type: named_block
      key_pattern: "^[a-z_][a-z0-9_]*$"
      cardinality: "0..inf"
      
      children:
        effect:
          type: effect_block
          required: true
          description: |
            Build the list of possible characters.
            Use 'add_to_list = characters' to save valid characters.
          
          scopes:
            root: character  # Character hosting the activity
            special_option: flag  # Optional: selected special option flag
            # Dynamic: scope:<option_category_key> for each option category
```

### Scope Context

| Scope | Type | Description |
|-------|------|-------------|
| `root` | Character | The character hosting the activity |
| `scope:special_option` | Flag | The selected special option flag (if activity has special options) |
| `scope:<option_category_key>` | Flag | For every option category defined, contains the selected option flag |

### Output Mechanism

Rules must use `add_to_list = characters` to add characters to the invite pool:

```pdx
# Simple pattern
every_relation = {
    type = friend
    add_to_list = characters
}

# With filtering
every_vassal = {
    limit = {
        highest_held_title_tier >= tier_county
        bannable_serving_diarch_trigger = no
    }
    add_to_list = characters
}
```

---

## Schema Proposal (YAML)

```yaml
# pychivalry/pychivalry/data/schemas/guest_invite_rules.yaml

meta:
  name: guest_invite_rules
  file_pattern: "common/activities/guest_invite_rules/*.txt"
  description: "Scriptable character lists for activity guest invitations"

root:
  type: file
  children:
    invite_rule:
      type: named_block
      key_validation:
        pattern: "^[a-z_][a-z0-9_]*$"
        description: "Unique rule identifier"
      cardinality: "0..inf"
      
      children:
        effect:
          type: effect_block
          required: true
          cardinality: "1..1"
          description: |
            Effect block that builds the character list.
            Must use 'add_to_list = characters' for valid characters.
          
          scope_context:
            root: character
            available_scopes:
              - name: special_option
                type: flag
                optional: true
                description: "Selected special option flag"
              - name: "<option_category_key>"
                type: flag
                dynamic: true
                description: "Flag of selected option per category"
          
          # Common patterns used in rules
          common_effects:
            - every_relation
            - every_close_family_member
            - every_extended_family_member
            - every_vassal
            - every_vassal_or_below
            - every_courtier
            - every_courtier_or_guest
            - every_pool_guest
            - every_foreign_court_guest
            - every_knight
            - every_spouse
            - every_player
            - every_ruler
            - liege
            - suzerain
            - court_position
            - house
            - faith.religious_head
            - player_heir

localization:
  keys:
    - pattern: "{rule_key}"
      description: "Name of the invite rule list"
    - pattern: "{rule_key}_desc"
      description: "Description of the invite rule list"

diagnostics:
  - code: RQ001
    severity: error
    message: "Guest invite rule must contain an 'effect' block"
    
  - code: RQ002
    severity: warning
    message: "Effect block should use 'add_to_list = characters'"
    
  - code: RQ003
    severity: info
    message: "Consider adding 'bannable_serving_diarch_trigger = no' limit"
```

---

## Common Patterns

### 1. Simple Relation-Based Rule

```pdx
activity_invite_rule_friends = {
    effect = {
        every_relation = {
            type = friend
            limit = {
                bannable_serving_diarch_trigger = no
            }
            add_to_list = characters
        }
    }
}
```

### 2. Conditional Rule (Based on Host Traits)

```pdx
activity_invite_rule_rivals_if_appropriate = {
    effect = {
        if = {
            limit = {
                OR = {
                    is_ai = no
                    has_trait = forgiving
                    has_trait = gregarious
                }
            }
            every_relation = {
                type = rival
                limit = { bannable_serving_diarch_trigger = no }
                add_to_list = characters
            }
        }
    }
}
```

### 3. Hierarchical Rule (Vassals with Performance Guard)

```pdx
activity_invite_rule_vassals = {
    effect = {
        every_vassal = {
            limit = {
                trigger_if = {
                    limit = { root = { is_ai = yes } }
                    highest_held_title_tier >= tier_county
                }
                bannable_serving_diarch_trigger = no
            }
            add_to_list = characters
        }
    }
}
```

### 4. Multi-Source Rule

```pdx
activity_invite_rule_guests = {
    effect = {
        every_pool_guest = {
            limit = { bannable_serving_diarch_trigger = no }
            add_to_list = characters
        }
        every_foreign_court_guest = {
            limit = { bannable_serving_diarch_trigger = no }
            add_to_list = characters
        }
    }
}
```

### 5. Special Condition Rule (Trait-Based)

```pdx
activity_invite_rule_house_witches = {
    effect = {
        house ?= {
            every_house_member = {
                limit = {
                    has_trait = witch
                    bannable_serving_diarch_trigger = no
                }
                add_to_list = characters
            }
        }
    }
}
```

---

## Validation Rules

### Required Checks

1. **Effect Block Required**: Every rule must have exactly one `effect` block
2. **List Population**: Effect should use `add_to_list = characters` 
3. **Diarch Filter**: Rules should include `bannable_serving_diarch_trigger = no` for gameplay correctness

### Performance Recommendations

1. **AI Performance Guards**: Use `trigger_if` with `is_ai = yes` to limit AI baron invites:
   ```pdx
   trigger_if = {
       limit = { root = { is_ai = yes } }
       highest_held_title_tier >= tier_county
   }
   ```

2. **Scope Existence Checks**: Use `?=` for optional scopes:
   ```pdx
   liege ?= { add_to_list = characters }
   house ?= { every_house_member = { ... } }
   ```

---

## Integration with Activity Types

### Reference in Activity Definition

```pdx
guest_invite_rules = {
    rules = {
        # Priority = rule_key
        # Lower priority number = invited first
        1 = activity_invite_rule_friends
        2 = activity_invite_rule_lovers
        3 = activity_invite_rule_vassals
    }
    defaults = {
        # Enabled by default for players
        1 = activity_invite_rule_close_family
        2 = activity_invite_rule_courtiers
    }
}
```

### Priority System

- **Priority Number**: Determines invite order (1 = highest priority)
- **Rules vs Defaults**: 
  - `rules` = available but not enabled by default
  - `defaults` = enabled by default for player hosts
- **Same Priority**: Multiple rules can share priority; they are processed together
