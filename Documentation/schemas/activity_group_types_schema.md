# Activity Group Types Schema Documentation

## Overview

Activity group types define how activities are organized and displayed in the activity view UI. Each group type specifies sorting order and GUI styling tags.

## File Location

```plaintext
common/activities/activity_group_types/
```

## How Groups Link to Activities

Activity types reference their group via the `activity_group_type` field:

```pdx
# In activity_types/*.txt
activity_feast = {
    activity_group_type = activities  # References group defined in activity_group_types
    sort_order = 10                   # Order within the group
    # ...
}
```

---

## Schema Structure

### Basic Group Type Definition

```yaml
activity_group_types:
  type: root_block
  
  children:
    group_key:
      type: named_block
      key_pattern: "^[a-z_][a-z0-9_]*$"
      cardinality: "0..inf"
      
      children:
        sort_order:
          type: integer
          required: false
          default: 0
          description: |
            Display order in activity view.
            Higher number = sorted first.
            Tie-breaking uses definition order.
        
        gui_tags:
          type: list
          required: false
          item_type: identifier
          description: |
            GUI styling tags for the activity view.
            Used to set size and appearance in GUI.
```

---

## Schema Proposal (YAML)

```yaml
# pychivalry/pychivalry/data/schemas/activity_group_types.yaml

meta:
  name: activity_group_types
  file_pattern: "common/activities/activity_group_types/*.txt"
  description: "Activity grouping and display configuration for the activity UI"

root:
  type: file
  children:
    group_type:
      type: named_block
      key_validation:
        pattern: "^[a-z_][a-z0-9_]*$"
        description: "Unique group type identifier"
      cardinality: "0..inf"
      
      children:
        sort_order:
          type: integer
          required: false
          default: 0
          cardinality: "0..1"
          description: |
            The order activity groups show up in the activity view.
            Higher number is sorted first.
            Tie breaking is on definition order.
          validation:
            range: "-inf..inf"
        
        gui_tags:
          type: clause
          required: false
          cardinality: "0..1"
          description: "List of GUI tags for styling"
          children:
            tag:
              type: identifier
              cardinality: "0..inf"
              known_values:
                - big_button

localization:
  keys:
    - pattern: "activity_group_type_{group_key}"
      description: "Display name of the activity group"

code_references:
  description: "Some group types are referenced in code and should not be removed"
  required_groups:
    - joinable    # Open activities players can join
    - invitations # Activities with pending invitations
    - grand       # Grand/major activities
    - activities  # Standard activities (default group)
    - unavailable # Activities not currently available
    - debug       # Debug-only activities

diagnostics:
  - code: AGT001
    severity: error
    message: "Activity group type '{key}' is referenced in code and cannot be removed"
    applies_to: [joinable, invitations, grand, activities, unavailable, debug]
    
  - code: AGT002
    severity: warning
    message: "Activity group type should have a sort_order defined for predictable UI ordering"
```

---

## Vanilla Group Types Reference

| Group Key | Sort Order | GUI Tags | Purpose |
|-----------|------------|----------|---------|
| `joinable` | 220 | `big_button` | Open activities players can join |
| `invitations` | 210 | `big_button` | Activities with pending invitations |
| `grand` | 200 | `big_button` | Grand/major activities |
| `activities` | 10 | (none) | Standard activities (default) |
| `unavailable` | 5 | (none) | Activities not currently available |
| `debug` | -1 | (none) | Debug-only activities |

### Sort Order Ranges

The vanilla game uses these ranges:

- **201-300**: Top-priority activities (joinable, invitations, grand)
- **101-200**: Mid-tier activities (reserved for expansion)
- **001-100**: Lower-priority activities (standard activities)
- **≤0**: Bottom activities (unavailable, debug)

---

## Integration with Activity Types

### Activity Type Reference

Each activity type can specify which group it belongs to:

```pdx
activity_feast = {
    # Group assignment (defaults to 'activities' if not specified)
    activity_group_type = activities
    
    # Sort order WITHIN the group (higher = first)
    sort_order = 10
    
    # ... rest of activity definition
}
```

### Hierarchy

```plaintext
Activity View UI
├── joinable (sort_order: 220)
│   └── [Open activities sorted by their sort_order]
├── invitations (sort_order: 210)
│   └── [Invitation activities sorted by their sort_order]
├── grand (sort_order: 200)
│   └── [Grand activities sorted by their sort_order]
├── activities (sort_order: 10)
│   └── [Standard activities sorted by their sort_order]
├── unavailable (sort_order: 5)
│   └── [Unavailable activities]
└── debug (sort_order: -1)
    └── [Debug activities]
```

---

## GUI Tags

### Known Tags

| Tag | Effect |
|-----|--------|
| `big_button` | Displays activity with larger button styling |

### Usage in GUI

GUI tags are referenced in the activity window GUI definitions to apply styling:

```pdx
# In gui/activity_window.gui (example)
widget = {
    visible = "[ActivityGroupType.HasGuiTag('big_button')]"
    size = { 300 80 }  # Larger size for big_button tagged groups
}
```

---

## Modding Guidelines

### Adding New Groups

1. Define the group in `common/activities/activity_group_types/`:

```pdx
# my_mod_activity_group_types.txt
my_special_activities = {
    sort_order = 150  # Between grand (200) and activities (10)
    gui_tags = { big_button }
}
```

2. Reference in activity type:

```pdx
my_custom_activity = {
    activity_group_type = my_special_activities
    sort_order = 10
    # ...
}
```

### Preserving Code References

The following groups are referenced in game code and **must not be removed**:

- `joinable`
- `invitations`
- `grand`
- `activities`
- `unavailable`
- `debug`

You can modify their `sort_order` and `gui_tags`, but the keys must exist.

---

## Validation Rules

### Required Checks

1. **Code-Referenced Groups**: Ensure vanilla required groups exist
2. **Unique Keys**: Group type keys must be unique across all files
3. **Valid Sort Order**: Must be an integer

### Recommendations

1. **Define Sort Order**: Always specify `sort_order` for predictable UI behavior
2. **Use Standard Ranges**: Follow vanilla sort_order conventions for consistency
3. **Document Custom Groups**: Comment purpose when adding new groups
