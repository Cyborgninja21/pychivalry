# Schema Authoring Guide

Complete guide for creating YAML schemas to add validation, completions, hover documentation, and symbols for new CK3 file types in PyChivalry.

## Overview

PyChivalry uses a **declarative, schema-driven architecture**. Instead of writing Python code to validate each file type, you define validation rules, completions, hover docs, and symbols in YAML schema files. The schema engine handles the rest.

**Benefits:**
- Add support for a new file type in ~2 hours (vs. days of Python coding)
- No Python knowledge required
- Schemas are easy to read, review, and maintain
- Changes don't require code deployment—just update YAML

## Schema File Location

All schema files live in:
```
pychivalry/data/schemas/
```

**Core Files:**
| File | Purpose |
|------|---------|
| `_base.yaml` | Common patterns, reusable field definitions |
| `_types.yaml` | Base type definitions (boolean, number, scope_reference, etc.) |
| `events.yaml` | Event file validation |
| `decisions.yaml` | Decision file validation |
| `story_cycles.yaml` | Story cycle validation |
| `schemes.yaml` | Scheme validation |
| `character_interactions.yaml` | Character interaction validation |
| `on_actions.yaml` | On-action validation |
| `generic_rules.yaml` | Universal rules (effect-in-trigger, iterators, etc.) |

## Schema Structure

Every schema file follows this structure:

```yaml
# Schema header
version: "1.0"
file_type: <unique_identifier>

# 1. File identification - when to apply this schema
identification:
  path_patterns:
    - "*/common/decisions/*.txt"
  block_pattern: "^[a-z_]+$"  # regex for top-level block names

# 2. Constants - reusable value lists
constants:
  my_enum_values:
    - value_1
    - value_2

# 3. Fields - validation rules for each field
fields:
  field_name:
    required: true
    type: enum
    values: $my_enum_values
    diagnostic: CK3XXX

# 4. Nested schemas - for complex block structures
nested_schemas:
  child_block:
    fields:
      inner_field:
        required: true
        type: string

# 5. Cross-field validations
validations:
  - name: rule_name
    condition: "field_a.exists AND field_b.missing"
    diagnostic: CK3XXX

# 6. Field documentation (completions & hover)
field_docs:
  field_name:
    description: "Short description for hover"
    detail: "Additional context"
    snippet: "field_name = ${1:value}"

# 7. Symbols configuration (document outline)
symbols:
  primary:
    kind: Class
    name_from: key
  children:
    - field: option
      kind: Method

# 8. Code lens configuration
code_lens:
  enabled: true
  reference_count:
    enabled: true
```

---

## Section Reference

### 1. Identification

Tells the schema engine when to apply this schema:

```yaml
identification:
  path_patterns:
    - "*/events/*.txt"           # Match events folder
    - "*/events/**/*.txt"        # Match nested folders too
  block_pattern: "^[a-z_]+\\.[0-9]+$"  # namespace.0001 format
```

- **path_patterns**: Glob patterns for file paths (use `*/` for any parent)
- **block_pattern**: Regex to match top-level block names in the file

### 2. Constants

Define reusable value lists referenced with `$name`:

```yaml
constants:
  event_types:
    - character_event
    - letter_event
    - court_event
    
  skills:
    - diplomacy
    - martial
    - stewardship
    - intrigue
    - learning
```

Use in fields: `values: $event_types`

### 3. Fields

Define validation rules for each field:

```yaml
fields:
  # Required field with enum validation
  type:
    required: true
    type: enum
    values: $event_types
    diagnostic: CK3760       # Error code when missing
    invalid_diagnostic: CK3761  # Error code when invalid value
    
  # Conditionally required field
  sender:
    required_when:
      field: type
      equals: letter_event
    type: scope_reference
    diagnostic: EVENT-003
    message: "Letter event missing required 'sender' field"
    
  # Optional field with default
  hidden:
    type: boolean
    default: false
    
  # Block that can appear multiple times
  option:
    type: block
    schema: option           # References nested_schemas.option
    min_count: 1
    min_count_unless: [hidden]
    count_diagnostic: CK3763
    
  # Block limited to one occurrence
  immediate:
    type: effect_block
    max_count: 1
    count_diagnostic: CK3768
```

**Field Properties:**

| Property | Description |
|----------|-------------|
| `required` | Field must be present |
| `required_when` | Conditionally required based on another field |
| `required_unless` | Required unless another field is present |
| `type` | Field type (see Types section below) |
| `values` | For enum type, list of valid values |
| `schema` | For block type, reference to nested schema |
| `min_count` / `max_count` | Occurrence limits |
| `multiple` | If true, field can appear multiple times |
| `diagnostic` | Error code when validation fails |
| `message` | Custom error message |

### 4. Types

Available field types from `_types.yaml`:

| Type | Description | Example |
|------|-------------|---------|
| `boolean` | yes/no value | `hidden = yes` |
| `string` | Text value | `name = my_string` |
| `integer` | Whole number | `count = 5` |
| `number` | Decimal number | `factor = 1.5` |
| `enum` | One of predefined values | `type = character_event` |
| `localization_key` | Reference to loc file | `title = event.0001.t` |
| `scope_reference` | Scope chain | `character = scope:actor` |
| `effect_block` | Block with effects | `immediate = { ... }` |
| `trigger_block` | Block with triggers | `trigger = { ... }` |
| `block` | Generic nested block | `option = { ... }` |

### 5. Nested Schemas

Define validation for complex block structures:

```yaml
nested_schemas:
  option:
    fields:
      name:
        required: true
        type: localization_key
        max_count: 1
        diagnostic: CK3450
        
      trigger:
        type: trigger_block
        
      ai_chance:
        type: block
        schema: ai_chance
        
    validations:
      - name: empty_option
        condition: "children.count == 0"
        diagnostic: CK3456

  ai_chance:
    fields:
      base:
        type: number
      modifier:
        type: block
        multiple: true
```

### 6. Cross-Field Validations

Rules that check relationships between multiple fields:

```yaml
validations:
  - name: hidden_with_options
    condition: "hidden.value == yes AND option.count > 0"
    diagnostic: CK3762
    message: "Hidden event should not have options"
    
  - name: missing_timing
    condition: "on_start.missing AND on_end.missing AND on_monthly.missing"
    diagnostic: STORY-001
    message: "Story cycle must have at least one timing hook"
```

**Condition Syntax:**
- `field.exists` / `field.missing` - Field presence
- `field.value == X` - Value comparison
- `field.count > 0` - Occurrence count
- `AND`, `OR`, `NOT` - Logical operators

### 7. Field Documentation

Powers completions and hover:

```yaml
field_docs:
  type:
    description: "Event type determines display style and available features"
    detail: "Required - character_event, letter_event, etc."
    snippet: "type = ${1|character_event,letter_event,court_event|}"
    
  immediate:
    description: "Effects that run immediately when event fires"
    detail: "Effect block - runs before player sees event"
    snippet: "immediate = {\n\t$0\n}"
```

**Snippet Syntax:**
- `${1:placeholder}` - Tab stop with default text
- `${1|a,b,c|}` - Choice dropdown
- `$0` - Final cursor position
- `\n\t` - Newline with tab

### 8. Symbols Configuration

Controls document outline/breadcrumbs:

```yaml
symbols:
  primary:
    kind: Event              # LSP SymbolKind
    name_from: key           # Use block key as name
    detail_from: type        # Show type field in detail
    
  children:
    - field: option
      kind: EnumMember
      name_from: name        # Use localization key
      fallback_name: "(unnamed option)"
      
    - field: immediate
      kind: Function
      name: "immediate"      # Static name
```

**Symbol Kinds:** Class, Function, Method, Property, Event, Enum, EnumMember, Interface, etc.

### 9. Code Lens Configuration

Inline information above definitions:

```yaml
code_lens:
  enabled: true
  
  reference_count:
    enabled: true
    label: "{count} references"
    search_patterns:
      - "trigger_event\\s*=\\s*{id}"
      
  missing_localization:
    enabled: true
    fields: [title, desc]
    label: "⚠️ Missing: {field}"
```

---

## Creating a New Schema

### Step-by-Step Process

1. **Identify the file type** - What folder/files does this cover?
2. **Study examples** - Look at actual CK3 files of this type
3. **Create the schema file** - `pychivalry/data/schemas/my_type.yaml`
4. **Define identification** - Path patterns and block patterns
5. **List all fields** - Required, optional, types, validations
6. **Add nested schemas** - For complex block structures
7. **Write field_docs** - Descriptions and snippets
8. **Configure symbols** - Document outline structure
9. **Test** - Open files of this type and verify validation works

### Example: Adding Trait Support

```yaml
# pychivalry/data/schemas/traits.yaml
version: "1.0"
file_type: trait

identification:
  path_patterns:
    - "*/common/traits/*.txt"
  block_pattern: "^[a-z_]+$"

constants:
  categories:
    - personality
    - education
    - childhood
    - health
    - fame
    - lifestyle
    - commander
    - court
    - descendant
    - winter

fields:
  category:
    required: true
    type: enum
    values: $categories
    diagnostic: TRAIT-001
    
  opposite:
    type: string
    description: "Trait that is incompatible with this one"
    
  cost:
    type: integer
    description: "Character creation point cost"
    
  birth:
    type: number
    description: "Base chance to be born with this trait"
    
  genetic:
    type: boolean
    description: "If yes, can be inherited"
    
  good:
    type: boolean
    description: "If yes, AI considers this positive"
    
  triggered_opinion:
    type: block
    schema: triggered_opinion
    multiple: true

nested_schemas:
  triggered_opinion:
    fields:
      opinion_modifier:
        required: true
        type: string
      parameter:
        required: true
        type: string
      check_missing:
        type: boolean
      same_faith:
        type: boolean
      same_culture:
        type: boolean

field_docs:
  category:
    description: "Trait category for grouping in UI"
    snippet: "category = ${1|personality,education,health,lifestyle|}"
    
  opposite:
    description: "Trait that conflicts with this one"
    snippet: "opposite = ${1:trait_name}"

symbols:
  primary:
    kind: Class
    name_from: key
    detail_from: category
```

---

## Best Practices

1. **Start simple** - Get basic field validation working first, then add complexity
2. **Use constants** - Avoid repeating value lists; define once and reference
3. **Clear diagnostics** - Use meaningful error codes and messages
4. **Complete field_docs** - Good docs improve the editor experience significantly
5. **Test incrementally** - Validate each section before moving to the next
6. **Copy existing schemas** - Use `events.yaml` or `decisions.yaml` as templates
7. **Check `_types.yaml`** - Reuse existing types before creating custom ones

## Diagnostic Codes

Use consistent error code prefixes:
- `CK3XXX` - General CK3 validation
- `EVENT-XXX` - Event-specific
- `STORY-XXX` - Story cycle-specific
- `DECISION-XXX` - Decision-specific
- `SCHEME-XXX` - Scheme-specific
- Custom prefix for new file types

## Related Documentation

- [feature_matrix.md](feature_matrix.md) - Feature coverage by file type
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- Schema files in `pychivalry/data/schemas/` - Working examples
