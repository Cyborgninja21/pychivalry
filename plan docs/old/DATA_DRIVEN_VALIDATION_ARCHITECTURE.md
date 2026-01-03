# Data-Driven Validation Architecture Plan

## Executive Summary

This document proposes a major refactor of PyChivalry's validation system from hardcoded procedural validation to a **declarative, schema-driven architecture**. This change will make it dramatically easier to add validation for new CK3 file types and allow non-developers to contribute validation rules.

**Current State**: Validation logic is embedded in Python functions across multiple modules, requiring Python expertise to extend.

**Target State**: Validation rules defined in YAML schema files that are interpreted by a generic validation engine.

---

## Scope of This Refactor

This refactor covers **ALL file-type-aware functionality**, not just validation:

| Feature Category | Features | Schema Coverage |
|------------------|----------|-----------------|
| **Validation** (9) | Required Fields, Effect/Trigger Context, Scope Chains, Cross-File Refs, Loc Keys, Duplicates, Value Checks, Iterators, Style | ✅ Full |
| **Navigation** (6) | Go-to-Definition, Find References, Document Symbols, Workspace Symbols, Document Highlight, Document Links | ⚠️ Partial (symbols, code lens) |
| **Editing** (10) | Completions, Hover, Signature Help, Inlay Hints, Code Lens, Formatting, Folding, Rename, Code Actions, Semantic Tokens | ⚠️ Partial (completions, hover, sig help, code lens) |

### Features Requiring File-Type-Aware Schema Data

| Feature | Current State | What Schema Provides |
|---------|---------------|---------------------|
| **Required Fields** | Events, Story Cycles only | Field requirements per file type |
| **Completions** | Block context only | File-type-specific field names, valid values |
| **Hover** | Effects/triggers only | Field documentation per file type |
| **Signature Help** | Effects/triggers only | Block parameter info per file type |
| **Code Lens** | Events, Scripted only | What symbols to show lenses for |
| **Inlay Hints** | Generic scope hints | File-type-specific scope context |
| **Document Symbols** | Generic block detection | Symbol types per file type (event, decision, etc.) |
| **Semantic Tokens** | Generic keywords | File-type-specific keywords and contexts |

### Features That Remain Generic (No Schema Needed)

These features work the same regardless of file type:

| Feature | Why Generic |
|---------|-------------|
| **Go-to-Definition** | Works on indexed symbols, not file structure |
| **Find References** | Works on indexed symbols |
| **Document Highlight** | Pattern-based (scope:, var:, etc.) |
| **Document Links** | Pattern-based (paths, URLs) |
| **Formatting** | Paradox syntax rules apply everywhere |
| **Folding** | Brace-based, works everywhere |
| **Rename** | Symbol-based, works on indexed items |

---

## Problem Statement

### Current Architecture Issues

| Problem | Impact | Example |
|---------|--------|---------|
| **Validation rules hardcoded in Python** | Requires Python expertise to add new file types | Adding decisions validation requires writing new functions in `paradox_checks.py` |
| **Scattered diagnostic codes** | Hard to maintain consistency, difficult to document | `CK3xxx` codes in `diagnostics.py`, `STORY-xxx` in `story_cycles.py` |
| **Duplicated patterns** | Same validation logic reimplemented for each file type | Required field checks repeated in events, story cycles, etc. |
| **No unified schema** | No single source of truth for "what makes a valid X" | Event validation spread across `events.py`, `paradox_checks.py`, `diagnostics.py` |
| **Path-based file type detection** | Regex scattered throughout codebase | Each module has its own path matching logic |

### Current Code Locations

| Component | Location | Approach |
|-----------|----------|----------|
| Effects/Triggers definitions | `ck3_language.py` | Hardcoded Python lists |
| Scope definitions | `data/scopes/*.yaml` | ✅ YAML data files |
| Event validation | `events.py`, `paradox_checks.py` | Hardcoded constants + functions |
| Story cycle validation | `story_cycles.py` | Hardcoded `STORY_DIAGNOSTICS` dict |
| File type detection | Scattered | Path-based regex in each module |

---

## Proposed Solution: Declarative Validation Schema System

### Core Concept

Create a **YAML-based schema system** where each CK3 file type has a declarative definition file describing:

- File type identification (path patterns, block patterns)
- Required and optional fields
- Field types and valid values
- Context rules (effect vs trigger blocks)
- Cross-field validations
- Diagnostic codes and messages

### Target Directory Structure

```
pychivalry/
├── data/
│   ├── schemas/                    # NEW: File type schemas (validation + features)
│   │   ├── _base.yaml              # Common patterns (reusable templates)
│   │   ├── _types.yaml             # Field type definitions
│   │   ├── events.yaml             # Event validation + completions + symbols
│   │   ├── story_cycles.yaml       # Story cycle schema
│   │   ├── decisions.yaml          # Decision schema  
│   │   ├── character_interactions.yaml
│   │   ├── schemes.yaml
│   │   ├── on_actions.yaml
│   │   ├── traits.yaml
│   │   └── ...                     # One file per file type
│   │
│   ├── diagnostics.yaml            # NEW: Centralized diagnostic codes
│   │
│   ├── effects/                    # NEW: Effect definitions (for hover, completions)
│   │   └── effects.yaml            # All effects with params, docs, scope requirements
│   │
│   ├── triggers/                   # NEW: Trigger definitions
│   │   └── triggers.yaml           # All triggers with params, docs
│   │
│   └── scopes/                     # Existing scope definitions
│       ├── character.yaml
│       ├── title.yaml
│       └── province.yaml
│
├── schema_loader.py                # NEW: Load, merge, and cache schemas
├── schema_validator.py             # NEW: Generic schema-driven validator
├── schema_completions.py           # NEW: Schema-driven completions provider
├── schema_hover.py                 # NEW: Schema-driven hover provider
├── schema_symbols.py               # NEW: Schema-driven symbol extraction
├── expression_evaluator.py         # NEW: Evaluate condition expressions
│
├── diagnostics.py                  # SIMPLIFIED: Delegates to schema_validator
├── completions.py                  # SIMPLIFIED: Delegates to schema_completions
├── hover.py                        # SIMPLIFIED: Delegates to schema_hover
├── symbols.py                      # SIMPLIFIED: Delegates to schema_symbols
├── paradox_checks.py               # SIMPLIFIED: Generic checks only
├── events.py                       # DEPRECATED: Data moved to schema
└── story_cycles.py                 # DEPRECATED: Data moved to schema
```

### Modules Affected by This Refactor

| Module | Current State | Target State | Change Type |
|--------|---------------|--------------|-------------|
| `events.py` | Hardcoded event validation | Schema-driven | **DEPRECATE** |
| `story_cycles.py` | Hardcoded story validation | Schema-driven | **DEPRECATE** |
| `paradox_checks.py` | Mixed (generic + specific) | Generic only | **SIMPLIFY** |
| `diagnostics.py` | Orchestrates validation | Delegates to schema_validator | **SIMPLIFY** |
| `completions.py` | Hardcoded CK3_EFFECTS, etc. | Schema + data files | **REFACTOR** |
| `hover.py` | Hardcoded effect docs | Schema + data files | **REFACTOR** |
| `signature_help.py` | Hardcoded signatures | Schema + data files | **REFACTOR** |
| `code_lens.py` | Events + scripted only | Schema-driven file types | **EXTEND** |
| `symbols.py` | Generic block detection | Schema-driven symbol types | **EXTEND** |
| `inlay_hints.py` | Generic scope hints | Schema-aware scope context | **EXTEND** |
| `semantic_tokens.py` | Hardcoded keywords | Schema-driven keywords | **EXTEND** |
| `ck3_language.py` | Hardcoded lists | Move to data/effects/, data/triggers/ | **REFACTOR** |

---

## Schema Format Specification

### 1. File Type Schema Structure

Each file type has a YAML schema with these sections:

```yaml
# Schema metadata
file_type: <identifier>           # Unique name for this file type
version: "1.0"                    # Schema version for compatibility
extends: _base                    # Optional: inherit from base schema

# File identification
identification:
  path_patterns: [...]            # Glob patterns to match file paths
  block_pattern: "regex"          # Pattern for top-level blocks (optional)
  
# ============ VALIDATION ============
# Field definitions (for required field validation)
fields:
  <field_name>:
    required: bool                # Is this field required?
    required_when: {...}          # Conditional requirement
    required_unless: [...]        # Required unless these fields exist
    type: <type_name>             # Field type (see types below)
    values: [...]                 # Valid values for enum types
    range: [min, max]             # Valid range for numeric types
    max_count: int                # Maximum occurrences
    min_count: int                # Minimum occurrences
    schema: <nested_schema>       # Reference to nested schema
    diagnostic: <code>            # Diagnostic code for violations
    message: "template"           # Error message template
    severity: error|warning|info  # Diagnostic severity
    
# Nested schemas for complex blocks
nested_schemas:
  <schema_name>:
    fields: {...}                 # Same structure as top-level fields
    
# Cross-field validations
validations:
  - name: <rule_name>
    condition: "expression"       # Condition that triggers diagnostic
    diagnostic: <code>
    severity: warning
    message: "template"

# Warnings (non-blocking issues)
warnings:
  - condition: "expression"
    diagnostic: <code>
    message: "template"
    
# ============ COMPLETIONS & HOVER ============
# Field documentation (for completions and hover)
field_docs:
  <field_name>:
    description: "What this field does"
    snippet: "field_name = ${1:value}"    # Completion snippet
    detail: "short detail for completion"
    
# ============ SYMBOLS ============
# Symbol extraction rules (for document outline)
symbols:
  primary:                        # Main symbol type for this file
    kind: Event|Function|Class    # LSP SymbolKind
    name_from: key                # Where to get symbol name
  children:                       # Child symbols to extract
    - field: option               # Field name to find
      kind: EnumMember            # Symbol kind for children
      name_from: name             # Child field for name

# ============ CODE LENS ============
# Code lens configuration
code_lens:
  enabled: true                   # Show code lenses for this type
  show_reference_count: true      # Show "X references" lens
  show_missing_loc: true          # Show missing localization warning
  custom_lenses:
    - condition: "..."
      title: "template"
      command: "..."

# ============ INLAY HINTS ============
# Inlay hint configuration
inlay_hints:
  scope_context:                  # Default scope for this file type
    root: character               # Root scope type
    common_scopes:                # Frequently used scopes
      - target: character
      - actor: character
```

### 2. Field Types

Define reusable field types in `_types.yaml`:

```yaml
# data/schemas/_types.yaml
types:
  boolean:
    values: [yes, no, true, false]
    
  localization_key:
    pattern: "^[a-z][a-z0-9_.]*$"
    description: "Reference to localization file entry"
    
  localization_key_or_block:
    one_of:
      - type: localization_key
      - type: block
        contains: [triggered_desc, first_valid, random_valid]
        
  scope_reference:
    pattern: "^(scope:|root|prev|this|from|[a-z_]+).*$"
    description: "Reference to a scope (character, title, etc.)"
    
  effect_block:
    context: effect
    description: "Block containing effects (state modifications)"
    
  trigger_block:
    context: trigger
    description: "Block containing triggers (conditions)"
    
  integer:
    pattern: "^-?[0-9]+$"
    
  integer_or_range:
    one_of:
      - type: integer
      - type: block
        description: "Range block like { 30 60 }"
        
  enum:
    description: "One of a predefined set of values"
    # values defined per-field
```

### 3. Centralized Diagnostics

All diagnostic codes in one file for consistency:

```yaml
# data/diagnostics.yaml
version: "1.0"

categories:
  syntax:
    prefix: "CK30"
    description: "Syntax and parsing errors"
  scope:
    prefix: "CK31"
    description: "Scope chain and type validation"
  style:
    prefix: "CK33"
    description: "Code style and formatting"
  event_structure:
    prefix: "CK37"
    description: "Event structure validation"
  context:
    prefix: "CK38"
    description: "Effect/trigger context violations"
  iterators:
    prefix: "CK39"
    description: "List iterator validation"
  gotchas:
    prefix: "CK51"
    description: "Common CK3 gotchas"
  story_cycles:
    prefix: "STORY"
    description: "Story cycle validation"
  decisions:
    prefix: "DECISION"
    description: "Decision validation"

diagnostics:
  # ============== Syntax (CK30xx) ==============
  CK3001:
    severity: error
    category: syntax
    message: "Unmatched closing bracket - no corresponding opening bracket found"
    
  CK3002:
    severity: error
    category: syntax
    message: "Unclosed bracket - opened at line {line}, expected closing '}}'"
    
  # ============== Scope (CK31xx) ==============
  CK3101:
    severity: warning
    category: scope
    message: "Unknown trigger: '{key}'"
    
  CK3102:
    severity: error
    category: scope
    message: "Effect '{key}' used in trigger block (triggers check conditions, not modify state)"
    
  CK3103:
    severity: warning
    category: scope
    message: "Unknown effect: '{key}'"
    
  CK3201:
    severity: error
    category: scope
    message: "Invalid scope chain: {details}"
    
  CK3202:
    severity: warning
    category: scope
    message: "Undefined saved scope: '{name}' (use save_scope_as to define it)"
    
  # ============== Event Structure (CK37xx) ==============
  CK3760:
    severity: error
    category: event_structure
    message: "Event '{id}' missing 'type' declaration (e.g., type = character_event)"
    fix: "Add 'type = character_event' or appropriate event type"
    
  CK3761:
    severity: error
    category: event_structure
    message: "Invalid event type '{value}'. Valid types: {valid_values}"
    
  CK3762:
    severity: warning
    category: event_structure
    message: "Hidden event '{id}' has option blocks, but options are ignored in hidden events"
    
  CK3763:
    severity: warning
    category: event_structure
    message: "Event '{id}' has no option blocks - player cannot interact"
    
  CK3764:
    severity: warning
    category: event_structure
    message: "Event '{id}' is missing 'desc' field"
    
  CK3766:
    severity: error
    category: event_structure
    message: "Event '{id}' has {count} after blocks - only the first will execute"
    
  CK3767:
    severity: warning
    category: event_structure
    message: "Event '{id}' is empty - it has no fields or content"
    
  CK3768:
    severity: error
    category: event_structure
    message: "Event '{id}' has {count} immediate blocks - only the first will execute"
    
  CK3769:
    severity: information
    category: event_structure
    message: "Character event '{id}' has no portrait positions defined"
    
  # ============== Options (CK345x) ==============
  CK3450:
    severity: error
    category: event_structure
    message: "Option block is missing required 'name' field for localization"
    fix: "Add 'name = your_event.option_a'"
    
  CK3453:
    severity: warning
    category: event_structure
    message: "Option has {count} 'name' fields - only the first will be used"
    
  CK3456:
    severity: warning
    category: event_structure
    message: "Empty option block - options need at least a 'name' field"
    
  # ============== Portraits (CK342x) ==============
  CK3420:
    severity: error
    category: event_structure
    message: "Invalid portrait position '{value}'. Valid: {valid_values}"
    
  CK3421:
    severity: warning
    category: event_structure
    message: "Portrait '{position}' is missing required 'character' field"
    
  CK3422:
    severity: warning
    category: event_structure
    message: "Invalid animation '{value}'. Valid: {valid_values}"
    
  CK3430:
    severity: warning
    category: event_structure
    message: "Invalid theme '{value}'. Valid: {valid_values}"
    
  # ============== triggered_desc (CK344x) ==============
  CK3440:
    severity: error
    category: event_structure
    message: "triggered_desc block is missing required 'trigger' field"
    
  CK3441:
    severity: error
    category: event_structure
    message: "triggered_desc block is missing required 'desc' field"
    
  CK3443:
    severity: warning
    category: event_structure
    message: "Empty desc block - event needs a description"
    
  # ============== trigger_if/else (CK351x) ==============
  CK3510:
    severity: error
    category: event_structure
    message: "trigger_else without preceding trigger_if - this block will never execute"
    
  CK3511:
    severity: error
    category: event_structure
    message: "Multiple trigger_else blocks - only the first will execute"
    
  CK3512:
    severity: error
    category: event_structure
    message: "trigger_if block is missing required 'limit' field"
    
  CK3513:
    severity: warning
    category: event_structure
    message: "trigger_if limit is empty - condition always passes"
    
  # ============== After blocks (CK352x) ==============
  CK3520:
    severity: warning
    category: event_structure
    message: "Hidden event has 'after' block - after blocks only run after player chooses an option"
    
  CK3521:
    severity: warning
    category: event_structure
    message: "Event has 'after' block but no options - after block won't execute"
    
  # ============== AI Chance (CK361x) ==============
  CK3610:
    severity: warning
    category: event_structure
    message: "ai_chance has negative base ({value}) - AI will never select unless modifiers bring it positive"
    
  CK3611:
    severity: information
    category: event_structure
    message: "ai_chance has high base ({value}) - heavily weights this option"
    
  CK3612:
    severity: warning
    category: event_structure
    message: "ai_chance has base = 0 with no modifiers - AI will never select this option"
    
  CK3614:
    severity: information
    category: event_structure
    message: "ai_chance modifier has no trigger - applies unconditionally"
    
  # ============== Opinion (CK365x) ==============
  CK3656:
    severity: error
    category: context
    message: "Inline opinion value in {effect}. Define opinion modifier in common/opinion_modifiers/"
    
  # ============== Context (CK387x) ==============
  CK3870:
    severity: error
    category: context
    message: "Effect '{effect}' used in trigger block. Effects cannot be used in trigger contexts."
    
  CK3871:
    severity: error
    category: context
    message: "Effect '{effect}' used in limit block. Limits are triggers, not effects."
    
  CK3872:
    severity: information
    category: context
    message: "'trigger = {{ always = yes }}' is redundant - remove the trigger block"
    
  CK3873:
    severity: warning
    category: context
    message: "'trigger = {{ always = no }}' makes this event impossible to fire"
    
  CK3875:
    severity: warning
    category: iterators
    message: "'{iterator}' without limit - selection is completely random"
    
  # ============== Iterators (CK397x) ==============
  CK3976:
    severity: error
    category: iterators
    message: "Effect '{effect}' used in '{iterator}' iterator. any_* iterators are trigger-only; use every_* or random_*"
    
  CK3977:
    severity: information
    category: iterators
    message: "'{iterator}' without limit - affects ALL entries. Add limit or comment if intentional."
    
  # ============== Gotchas (CK51xx) ==============
  CK5137:
    severity: warning
    category: gotchas
    message: "is_alive without exists check - may crash if target doesn't exist"
    
  CK5142:
    severity: error
    category: gotchas
    message: "Character comparison '{expr}' may not work. Use '{scope} = {{ this = {target} }}'"
    
  # ============== Story Cycles (STORY-xxx) ==============
  STORY-001:
    severity: error
    category: story_cycles
    message: "effect_group missing timing keyword (days/months/years)"
    fix: "Add timing like 'days = 30' or 'months = { 1 3 }'"
    
  STORY-002:
    severity: error
    category: story_cycles
    message: "Invalid timing format: expected integer or {{ min max }} range"
    
  STORY-003:
    severity: error
    category: story_cycles
    message: "Invalid timing range: min ({min}) must be ≤ max ({max}) and both positive"
    
  STORY-004:
    severity: error
    category: story_cycles
    message: "Multiple timing keywords in effect_group (use only one of days/months/years)"
    
  STORY-005:
    severity: error
    category: story_cycles
    message: "triggered_effect missing required 'trigger' block"
    
  STORY-006:
    severity: error
    category: story_cycles
    message: "triggered_effect missing required 'effect' block"
    
  STORY-007:
    severity: error
    category: story_cycles
    message: "Story cycle has no effect_group blocks (does nothing)"
    
  STORY-008:
    severity: error
    category: story_cycles
    message: "Story cycle '{name}' should be in common/story_cycles/ directory"
    
  STORY-020:
    severity: warning
    category: story_cycles
    message: "Story lacks on_owner_death handler (may persist indefinitely)"
    fix: "Add on_owner_death = { scope:story = { end_story = yes } }"
    
  STORY-021:
    severity: warning
    category: story_cycles
    message: "on_owner_death should call end_story or make_story_owner"
    
  STORY-022:
    severity: warning
    category: story_cycles
    message: "effect_group without trigger fires unconditionally every interval"
    
  STORY-023:
    severity: warning
    category: story_cycles
    message: "chance value ({value}) exceeds 100%"
    
  STORY-024:
    severity: warning
    category: story_cycles
    message: "chance value ({value}) is 0 or negative (effect never fires)"
    
  STORY-025:
    severity: warning
    category: story_cycles
    message: "effect_group has trigger but no triggered_effect blocks"
    
  STORY-026:
    severity: warning
    category: story_cycles
    message: "first_valid should have an unconditional fallback effect"
    
  STORY-027:
    severity: warning
    category: story_cycles
    message: "Mixing triggered_effect and first_valid in same effect_group is confusing"
    
  STORY-040:
    severity: information
    category: story_cycles
    message: "on_setup block is empty - consider initialization logic"
    
  STORY-041:
    severity: information
    category: story_cycles
    message: "on_end block is empty - consider cleanup logic"
    
  STORY-043:
    severity: information
    category: story_cycles
    message: "Very short interval ({value} days) - may impact performance"
    
  STORY-044:
    severity: information
    category: story_cycles
    message: "Very long interval ({value} years) - player may not experience this"
    
  STORY-045:
    severity: hint
    category: story_cycles
    message: "Consider adding debug_log in on_end for testing"
```

---

## Example Schemas

### Events Schema (`data/schemas/events.yaml`)

Complete schema showing all feature sections:

```yaml
file_type: event
version: "1.0"

identification:
  path_patterns:
    - "**/events/**/*.txt"
  block_pattern: "^[a-z_]+\\.[0-9]+$"  # namespace.0001

constants:
  event_types:
    - character_event
    - letter_event
    - court_event
    - duel_event
    - feast_event
    - story_cycle
    
  themes:
    - default
    - diplomacy
    - intrigue
    # ... (full list)
    
  portrait_positions:
    - left_portrait
    - right_portrait
    - lower_left_portrait
    - lower_center_portrait
    - lower_right_portrait
    
  animations:
    - idle
    - happiness
    - sadness
    # ... (full list)

# ============ VALIDATION ============
fields:
  type:
    required: true
    type: enum
    values: $event_types
    diagnostic: CK3760
    invalid_diagnostic: CK3761
    
  title:
    required: true
    type: localization_key
    diagnostic: CK3760
    
  desc:
    required_unless: [hidden]
    type: localization_key_or_block
    diagnostic: CK3764
    
  sender:
    required_when:
      field: type
      equals: letter_event
    type: scope_reference
    diagnostic: EVENT-003
    message: "Letter event missing required 'sender' field"
    
  theme:
    type: enum
    values: $themes
    diagnostic: CK3430
    
  hidden:
    type: boolean
    default: false
    
  immediate:
    type: effect_block
    max_count: 1
    count_diagnostic: CK3768
    
  after:
    type: effect_block
    max_count: 1
    count_diagnostic: CK3766
    
  trigger:
    type: trigger_block
    
  option:
    type: block
    schema: option
    min_count: 1
    min_count_unless: [hidden]
    count_diagnostic: CK3763

  # Portrait positions
  left_portrait:
    type: block
    schema: portrait
  right_portrait:
    type: block
    schema: portrait
  lower_left_portrait:
    type: block
    schema: portrait
  lower_center_portrait:
    type: block
    schema: portrait
  lower_right_portrait:
    type: block
    schema: portrait

nested_schemas:
  option:
    fields:
      name:
        required: true
        type: localization_key
        max_count: 1
        diagnostic: CK3450
        count_diagnostic: CK3453
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
    validations:
      - name: negative_base
        condition: "base.value < 0"
        diagnostic: CK3610
      - name: zero_base_no_modifier
        condition: "base.value == 0 AND modifier.count == 0"
        diagnostic: CK3612

  portrait:
    fields:
      character:
        required: true
        type: scope_reference
        diagnostic: CK3421
      animation:
        type: enum
        values: $animations
        diagnostic: CK3422

  triggered_desc:
    fields:
      trigger:
        required: true
        type: trigger_block
        diagnostic: CK3440
      desc:
        required: true
        type: localization_key
        diagnostic: CK3441

validations:
  - name: hidden_with_options
    condition: "hidden.value == yes AND option.count > 0"
    diagnostic: CK3762
    
  - name: after_in_hidden
    condition: "hidden.value == yes AND after.exists"
    diagnostic: CK3520
    
  - name: after_without_options
    condition: "after.exists AND option.count == 0 AND hidden.value != yes"
    diagnostic: CK3521
    
  - name: empty_event
    condition: "children.count == 0"
    diagnostic: CK3767

# ============ COMPLETIONS & HOVER ============
field_docs:
  type:
    description: "Event type determines display style and available features"
    detail: "Required - character_event, letter_event, etc."
    snippet: "type = ${1|character_event,letter_event,court_event,duel_event|}"
    
  title:
    description: "Localization key for the event title displayed at the top"
    detail: "Required localization reference"
    snippet: "title = ${1:namespace.XXXX.t}"
    
  desc:
    description: "Event description text or triggered_desc block"
    detail: "Localization key or block with triggered_desc"
    snippet: "desc = ${1:namespace.XXXX.desc}"
    
  sender:
    description: "Character who sends the letter (letter_event only)"
    detail: "Required for letter_event - scope reference"
    snippet: "sender = ${1:scope:actor}"
    
  theme:
    description: "Visual theme affecting event window appearance"
    detail: "Optional - affects background and styling"
    snippet: "theme = ${1|default,diplomacy,intrigue,martial,stewardship,learning|}"
    
  hidden:
    description: "If yes, event fires silently without popup"
    detail: "Optional - defaults to no"
    snippet: "hidden = ${1|yes,no|}"
    
  immediate:
    description: "Effects that run immediately when event fires, before options shown"
    detail: "Effect block - runs before player sees event"
    snippet: "immediate = {\n\t$0\n}"
    
  after:
    description: "Effects that run after player selects an option"
    detail: "Effect block - runs after option selection"
    snippet: "after = {\n\t$0\n}"
    
  trigger:
    description: "Conditions required for event to fire"
    detail: "Trigger block - all conditions must be true"
    snippet: "trigger = {\n\t$0\n}"
    
  option:
    description: "Player choice option with effects"
    detail: "Required unless hidden - at least one option"
    snippet: "option = {\n\tname = ${1:namespace.XXXX.a}\n\t$0\n}"

# ============ SYMBOLS ============
symbols:
  primary:
    kind: Event
    name_from: key                # Event ID like namespace.0001
    detail_from: type             # Shows "character_event" in outline
  children:
    - field: option
      kind: EnumMember
      name_from: name
      fallback_name: "(unnamed option)"
    - field: immediate
      kind: Function
      name: "immediate"
    - field: after  
      kind: Function
      name: "after"
    - field: trigger
      kind: Object
      name: "trigger"

# ============ CODE LENS ============
code_lens:
  enabled: true
  reference_count:
    enabled: true
    label: "{count} references"
    search_patterns:
      - "trigger_event\\s*=\\s*\\{?\\s*id\\s*=\\s*{id}"
      - "trigger_event\\s*=\\s*{id}"
  missing_localization:
    enabled: true
    fields: [title, desc]
    label: "⚠️ Missing: {field}"
  namespace_summary:
    enabled: true
    pattern: "^namespace\\s*="
    label: "{count} events in namespace"

# ============ INLAY HINTS ============  
inlay_hints:
  scope_context:
    root: character              # Events scope to character by default
    common_saved_scopes:
      - actor: character
      - recipient: character
      - target: character
  show_scope_type: true          # Show ": character" after scope refs
  show_iterator_target: true     # Show "→ character scope" for any_*
```

### Story Cycles Schema (`data/schemas/story_cycles.yaml`)

```yaml
file_type: story_cycle
version: "1.0"

identification:
  path_patterns:
    - "**/common/story_cycles/**/*.txt"

fields:
  on_setup:
    type: effect_block
    warnings:
      - condition: "children.count == 0"
        diagnostic: STORY-040
        
  on_end:
    type: effect_block
    warnings:
      - condition: "children.count == 0"
        diagnostic: STORY-041
        
  on_owner_death:
    type: effect_block
    recommended: true
    missing_diagnostic: STORY-020
    validations:
      - name: no_cleanup
        condition: "NOT contains_effect('end_story') AND NOT contains_effect('make_story_owner')"
        diagnostic: STORY-021
        
  effect_group:
    type: block
    schema: effect_group
    min_count: 1
    count_diagnostic: STORY-007

nested_schemas:
  effect_group:
    timing:
      required_one_of: [days, months, years]
      diagnostic: STORY-001
      multiple_diagnostic: STORY-004
      
    fields:
      days:
        type: integer_or_range
        range_diagnostic: STORY-002
        invalid_range_diagnostic: STORY-003
        warnings:
          - condition: "min_value < 30"
            diagnostic: STORY-043
            
      months:
        type: integer_or_range
        range_diagnostic: STORY-002
        invalid_range_diagnostic: STORY-003
        
      years:
        type: integer_or_range
        range_diagnostic: STORY-002
        invalid_range_diagnostic: STORY-003
        warnings:
          - condition: "max_value > 5"
            diagnostic: STORY-044
            
      trigger:
        type: trigger_block
        recommended: true
        missing_diagnostic: STORY-022
        
      chance:
        type: integer
        range: [1, 100]
        warnings:
          - condition: "value > 100"
            diagnostic: STORY-023
          - condition: "value <= 0"
            diagnostic: STORY-024
            
      triggered_effect:
        type: block
        schema: triggered_effect
        multiple: true
        
      first_valid:
        type: block
        schema: first_valid
        
    validations:
      - name: no_effects
        condition: "triggered_effect.count == 0 AND NOT first_valid.exists"
        diagnostic: STORY-025
        
      - name: mixed_patterns
        condition: "triggered_effect.count > 0 AND first_valid.exists"
        diagnostic: STORY-027

  triggered_effect:
    fields:
      trigger:
        required: true
        type: trigger_block
        diagnostic: STORY-005
        
      effect:
        required: true
        type: effect_block
        diagnostic: STORY-006

  first_valid:
    fields:
      triggered_effect:
        type: block
        schema: triggered_effect
        multiple: true
        
    validations:
      - name: no_fallback
        condition: "last_triggered_effect.trigger != 'always = yes'"
        diagnostic: STORY-026
```

### Decisions Schema (`data/schemas/decisions.yaml`)

```yaml
file_type: decision
version: "1.0"

identification:
  path_patterns:
    - "**/common/decisions/**/*.txt"

fields:
  picture:
    type: string
    
  major:
    type: boolean
    default: false
    
  ai_check_interval:
    required: true
    type: integer
    diagnostic: DECISION-001
    message: "Decision missing 'ai_check_interval' - AI will never consider this decision"
    
  is_shown:
    type: trigger_block
    recommended: true
    
  is_valid:
    type: trigger_block
    
  is_valid_showing_failures_only:
    type: trigger_block
    
  cost:
    type: block
    schema: cost
    
  effect:
    required: true
    type: effect_block
    diagnostic: DECISION-002
    message: "Decision missing 'effect' block - decision does nothing"
    
  ai_will_do:
    type: block
    schema: ai_will_do
    recommended: true
    
  widget:
    type: block

nested_schemas:
  cost:
    fields:
      gold:
        type: number_or_script_value
      prestige:
        type: number_or_script_value
      piety:
        type: number_or_script_value
        
  ai_will_do:
    fields:
      base:
        type: number
      modifier:
        type: block
        multiple: true

validations:
  - name: no_visibility
    condition: "NOT is_shown.exists AND NOT is_valid.exists"
    diagnostic: DECISION-003
    severity: information
    message: "Decision has no is_shown or is_valid - always visible and available"
```

---

## Implementation Architecture

### Schema Loader (`schema_loader.py`)

```python
"""
Schema Loader - Load and merge validation schemas from YAML files.

Responsibilities:
- Load schema files from data/schemas/
- Resolve inheritance ($extends)
- Resolve variable references ($variable_name)
- Cache parsed schemas for performance
- Provide schema lookup by file type
"""

from pathlib import Path
from typing import Dict, Any, Optional, List
import yaml
import logging
import fnmatch

logger = logging.getLogger(__name__)

SCHEMAS_DIR = Path(__file__).parent / "data" / "schemas"
DIAGNOSTICS_FILE = Path(__file__).parent / "data" / "diagnostics.yaml"

class SchemaLoader:
    """Load and cache validation schemas."""
    
    def __init__(self):
        self._schemas: Dict[str, Dict[str, Any]] = {}
        self._diagnostics: Dict[str, Dict[str, Any]] = {}
        self._file_type_cache: Dict[str, str] = {}  # path -> schema_name
        
    def load_all(self) -> None:
        """Load all schemas and diagnostics."""
        self._load_diagnostics()
        self._load_schemas()
        
    def _load_diagnostics(self) -> None:
        """Load centralized diagnostics definitions."""
        if DIAGNOSTICS_FILE.exists():
            with open(DIAGNOSTICS_FILE, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                self._diagnostics = data.get('diagnostics', {})
                
    def _load_schemas(self) -> None:
        """Load all schema files."""
        for schema_file in SCHEMAS_DIR.glob("*.yaml"):
            if schema_file.name.startswith("_"):
                continue  # Skip base/type files
            try:
                with open(schema_file, 'r', encoding='utf-8') as f:
                    schema = yaml.safe_load(f)
                    if schema and 'file_type' in schema:
                        self._resolve_references(schema)
                        self._schemas[schema['file_type']] = schema
            except Exception as e:
                logger.error(f"Failed to load schema {schema_file}: {e}")
                
    def _resolve_references(self, schema: Dict[str, Any]) -> None:
        """Resolve $variable references in schema."""
        constants = schema.get('constants', {})
        self._resolve_in_dict(schema, constants)
        
    def _resolve_in_dict(self, obj: Any, constants: Dict[str, Any]) -> None:
        """Recursively resolve variable references."""
        if isinstance(obj, dict):
            for key, value in list(obj.items()):
                if isinstance(value, str) and value.startswith('$'):
                    var_name = value[1:]
                    if var_name in constants:
                        obj[key] = constants[var_name]
                else:
                    self._resolve_in_dict(value, constants)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, str) and item.startswith('$'):
                    var_name = item[1:]
                    if var_name in constants:
                        obj[i] = constants[var_name]
                else:
                    self._resolve_in_dict(item, constants)
                    
    def get_schema_for_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get the appropriate schema for a file path."""
        # Check cache first
        if file_path in self._file_type_cache:
            return self._schemas.get(self._file_type_cache[file_path])
            
        # Find matching schema
        normalized_path = file_path.replace('\\', '/')
        for schema_name, schema in self._schemas.items():
            patterns = schema.get('identification', {}).get('path_patterns', [])
            for pattern in patterns:
                if fnmatch.fnmatch(normalized_path, pattern):
                    self._file_type_cache[file_path] = schema_name
                    return schema
                    
        return None
        
    def get_diagnostic(self, code: str) -> Optional[Dict[str, Any]]:
        """Get diagnostic definition by code."""
        return self._diagnostics.get(code)
        
    def clear_cache(self) -> None:
        """Clear all caches for reload."""
        self._schemas.clear()
        self._diagnostics.clear()
        self._file_type_cache.clear()
```

### Schema Validator (`schema_validator.py`)

```python
"""
Schema Validator - Generic validation engine driven by YAML schemas.

Responsibilities:
- Validate AST against schema rules
- Check required fields
- Validate field types and values
- Evaluate cross-field conditions
- Generate diagnostics with proper codes/messages
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Set
from lsprotocol.types import Diagnostic, DiagnosticSeverity, Range
import re
import logging

from .parser import CK3Node
from .schema_loader import SchemaLoader

logger = logging.getLogger(__name__)

SEVERITY_MAP = {
    'error': DiagnosticSeverity.Error,
    'warning': DiagnosticSeverity.Warning,
    'information': DiagnosticSeverity.Information,
    'info': DiagnosticSeverity.Information,
    'hint': DiagnosticSeverity.Hint,
}

class SchemaValidator:
    """Validate CK3 files against YAML schemas."""
    
    def __init__(self, schema_loader: SchemaLoader):
        self.loader = schema_loader
        
    def validate(self, file_path: str, ast: List[CK3Node]) -> List[Diagnostic]:
        """Validate AST against appropriate schema."""
        schema = self.loader.get_schema_for_file(file_path)
        if not schema:
            return []  # No schema for this file type
            
        diagnostics = []
        
        # Find blocks matching the schema's block pattern
        block_pattern = schema.get('identification', {}).get('block_pattern')
        
        for node in ast:
            if self._matches_block_pattern(node.key, block_pattern):
                diagnostics.extend(self._validate_block(node, schema, schema.get('fields', {})))
                
                # Run top-level validations
                for validation in schema.get('validations', []):
                    if self._evaluate_condition(node, validation.get('condition', '')):
                        diagnostics.append(self._create_diagnostic(
                            validation['diagnostic'],
                            node.range,
                            validation.get('severity', 'warning'),
                            **self._get_template_vars(node)
                        ))
                        
        return diagnostics
        
    def _matches_block_pattern(self, key: str, pattern: Optional[str]) -> bool:
        """Check if key matches the block identification pattern."""
        if not pattern:
            return True  # No pattern means match all top-level blocks
        return bool(re.match(pattern, key))
        
    def _validate_block(
        self, 
        node: CK3Node, 
        schema: Dict[str, Any],
        fields: Dict[str, Any]
    ) -> List[Diagnostic]:
        """Validate a block against field definitions."""
        diagnostics = []
        present_fields: Dict[str, List[CK3Node]] = {}
        
        # Group children by field name
        for child in node.children:
            if child.key not in present_fields:
                present_fields[child.key] = []
            present_fields[child.key].append(child)
            
        # Check each field definition
        for field_name, field_def in fields.items():
            field_nodes = present_fields.get(field_name, [])
            
            # Required field check
            if field_def.get('required'):
                if not self._check_required(node, field_name, field_def, present_fields):
                    diagnostics.append(self._create_diagnostic(
                        field_def.get('diagnostic', 'UNKNOWN'),
                        node.range,
                        'error',
                        field_name=field_name,
                        **self._get_template_vars(node)
                    ))
                    
            # Count constraints
            if 'max_count' in field_def and len(field_nodes) > field_def['max_count']:
                diag_code = field_def.get('count_diagnostic', field_def.get('diagnostic'))
                diagnostics.append(self._create_diagnostic(
                    diag_code,
                    node.range,
                    'error',
                    count=len(field_nodes),
                    **self._get_template_vars(node)
                ))
                
            if 'min_count' in field_def:
                min_count = field_def['min_count']
                unless_fields = field_def.get('min_count_unless', [])
                
                # Check if any "unless" field is present and truthy
                skip_check = False
                for unless_field in unless_fields:
                    if unless_field in present_fields:
                        unless_nodes = present_fields[unless_field]
                        if unless_nodes and unless_nodes[0].value in ('yes', True, 'true'):
                            skip_check = True
                            break
                            
                if not skip_check and len(field_nodes) < min_count:
                    diag_code = field_def.get('count_diagnostic', field_def.get('diagnostic'))
                    diagnostics.append(self._create_diagnostic(
                        diag_code,
                        node.range,
                        'warning',
                        count=len(field_nodes),
                        **self._get_template_vars(node)
                    ))
                    
            # Type validation
            if field_def.get('type') == 'enum' and field_nodes:
                valid_values = field_def.get('values', [])
                for field_node in field_nodes:
                    if field_node.value and field_node.value not in valid_values:
                        diag_code = field_def.get('invalid_diagnostic', field_def.get('diagnostic'))
                        diagnostics.append(self._create_diagnostic(
                            diag_code,
                            field_node.range,
                            'error',
                            value=field_node.value,
                            valid_values=', '.join(valid_values),
                            **self._get_template_vars(field_node)
                        ))
                        
            # Nested schema validation
            if 'schema' in field_def:
                nested_schema_name = field_def['schema']
                nested_schemas = schema.get('nested_schemas', {})
                if nested_schema_name in nested_schemas:
                    nested_schema = nested_schemas[nested_schema_name]
                    for field_node in field_nodes:
                        diagnostics.extend(self._validate_block(
                            field_node, 
                            schema,
                            nested_schema.get('fields', {})
                        ))
                        # Run nested validations
                        for validation in nested_schema.get('validations', []):
                            if self._evaluate_condition(field_node, validation.get('condition', '')):
                                diagnostics.append(self._create_diagnostic(
                                    validation['diagnostic'],
                                    field_node.range,
                                    validation.get('severity', 'warning'),
                                    **self._get_template_vars(field_node)
                                ))
                                
            # Field-level warnings
            for warning in field_def.get('warnings', []):
                for field_node in field_nodes:
                    if self._evaluate_condition(field_node, warning.get('condition', '')):
                        diagnostics.append(self._create_diagnostic(
                            warning['diagnostic'],
                            field_node.range,
                            warning.get('severity', 'warning'),
                            **self._get_template_vars(field_node)
                        ))
                        
        return diagnostics
        
    def _check_required(
        self,
        node: CK3Node,
        field_name: str,
        field_def: Dict[str, Any],
        present_fields: Dict[str, List[CK3Node]]
    ) -> bool:
        """Check if a required field is present (considering conditions)."""
        # Check required_unless
        unless_fields = field_def.get('required_unless', [])
        for unless_field in unless_fields:
            if unless_field in present_fields:
                unless_nodes = present_fields[unless_field]
                if unless_nodes and unless_nodes[0].value in ('yes', True, 'true'):
                    return True  # Condition met, field not required
                    
        # Check required_when
        when_condition = field_def.get('required_when')
        if when_condition:
            check_field = when_condition.get('field')
            check_value = when_condition.get('equals')
            if check_field in present_fields:
                field_value = present_fields[check_field][0].value if present_fields[check_field] else None
                if field_value != check_value:
                    return True  # Condition not met, field not required
            else:
                return True  # Condition field not present, field not required
                
        return field_name in present_fields
        
    def _evaluate_condition(self, node: CK3Node, condition: str) -> bool:
        """Evaluate a condition expression against a node."""
        if not condition:
            return False
            
        # Build context for evaluation
        context = self._build_evaluation_context(node)
        
        # Simple expression evaluator
        # Supports: field.exists, field.count, field.value, comparisons, AND, OR, NOT
        try:
            return self._eval_expr(condition, context)
        except Exception as e:
            logger.warning(f"Failed to evaluate condition '{condition}': {e}")
            return False
            
    def _build_evaluation_context(self, node: CK3Node) -> Dict[str, Any]:
        """Build context dictionary for condition evaluation."""
        context = {
            'children': {'count': len(node.children)},
        }
        
        # Index children by key
        for child in node.children:
            if child.key not in context:
                context[child.key] = {
                    'exists': True,
                    'count': 0,
                    'value': child.value,
                    'nodes': []
                }
            context[child.key]['count'] += 1
            context[child.key]['nodes'].append(child)
            
        return context
        
    def _eval_expr(self, expr: str, context: Dict[str, Any]) -> bool:
        """Simple expression evaluator."""
        expr = expr.strip()
        
        # Handle NOT
        if expr.startswith('NOT '):
            return not self._eval_expr(expr[4:], context)
            
        # Handle AND
        if ' AND ' in expr:
            parts = expr.split(' AND ')
            return all(self._eval_expr(p.strip(), context) for p in parts)
            
        # Handle OR
        if ' OR ' in expr:
            parts = expr.split(' OR ')
            return any(self._eval_expr(p.strip(), context) for p in parts)
            
        # Handle comparisons
        for op in ['==', '!=', '>=', '<=', '>', '<']:
            if op in expr:
                left, right = expr.split(op, 1)
                left_val = self._resolve_value(left.strip(), context)
                right_val = self._resolve_value(right.strip(), context)
                return self._compare(left_val, op, right_val)
                
        # Handle field.exists
        if '.exists' in expr:
            field = expr.replace('.exists', '')
            return field in context and context[field].get('exists', False)
            
        # Handle field.count
        if '.count' in expr:
            field = expr.split('.')[0]
            return context.get(field, {}).get('count', 0)
            
        return False
        
    def _resolve_value(self, expr: str, context: Dict[str, Any]) -> Any:
        """Resolve a value expression."""
        if expr.isdigit():
            return int(expr)
        if expr in ('yes', 'true'):
            return True
        if expr in ('no', 'false'):
            return False
        if '.' in expr:
            parts = expr.split('.')
            obj = context
            for part in parts:
                if isinstance(obj, dict) and part in obj:
                    obj = obj[part]
                else:
                    return None
            return obj
        return expr
        
    def _compare(self, left: Any, op: str, right: Any) -> bool:
        """Perform comparison."""
        if op == '==':
            return left == right
        if op == '!=':
            return left != right
        if op == '>':
            return left > right if left is not None and right is not None else False
        if op == '<':
            return left < right if left is not None and right is not None else False
        if op == '>=':
            return left >= right if left is not None and right is not None else False
        if op == '<=':
            return left <= right if left is not None and right is not None else False
        return False
        
    def _get_template_vars(self, node: CK3Node) -> Dict[str, Any]:
        """Get template variables for message formatting."""
        return {
            'id': node.key,
            'key': node.key,
            'value': node.value,
        }
        
    def _create_diagnostic(
        self,
        code: str,
        range_: Range,
        severity: str = 'error',
        **kwargs
    ) -> Diagnostic:
        """Create a diagnostic from code and template variables."""
        diag_def = self.loader.get_diagnostic(code) or {}
        
        message = diag_def.get('message', kwargs.get('message', f'Validation error: {code}'))
        try:
            message = message.format(**kwargs)
        except KeyError:
            pass  # Keep original message if formatting fails
            
        severity_str = severity if severity else diag_def.get('severity', 'error')
        severity_enum = SEVERITY_MAP.get(severity_str, DiagnosticSeverity.Error)
        
        return Diagnostic(
            range=range_,
            severity=severity_enum,
            code=code,
            source='pychivalry',
            message=message
        )
```

---

## Migration Plan

### Overview: 8-Week Migration

| Phase | Weeks | Focus | Features Affected |
|-------|-------|-------|-------------------|
| 1 | 1 | Foundation | Schema infrastructure |
| 2 | 2 | Event Validation | Required fields, cross-field checks |
| 3 | 3 | Story Cycles | Required fields, timing validation |
| 4 | 4 | Completions & Hover | Context-aware editing |
| 5 | 5 | Symbols & Code Lens | Navigation features |
| 6 | 6-7 | High Priority Types | Decisions, Interactions, Schemes |
| 7 | 8 | Cleanup & Docs | Remove deprecated code |

### Phase 1: Foundation (Week 1)

**Goal**: Create schema infrastructure without changing existing validation.

| Task | Description | Effort |
|------|-------------|--------|
| 1.1 | Create `data/schemas/` directory structure | 0.5 day |
| 1.2 | Create `data/diagnostics.yaml` with all existing codes | 1 day |
| 1.3 | Implement `schema_loader.py` | 1 day |
| 1.4 | Implement basic `schema_validator.py` | 2 days |
| 1.5 | Write unit tests for schema loader/validator | 1 day |

**Deliverables**:
- Working schema loader that can parse YAML schemas
- Basic schema validator that can check required fields and types
- All existing diagnostic codes in centralized YAML file
- Unit tests with 80%+ coverage

### Phase 2: Event Schema Migration (Week 2)

**Goal**: Migrate event validation to schema-driven approach.

| Task | Description | Effort |
|------|-------------|--------|
| 2.1 | Create `data/schemas/events.yaml` | 1 day |
| 2.2 | Create `data/schemas/_types.yaml` | 0.5 day |
| 2.3 | Add nested schema support to validator | 1 day |
| 2.4 | Add condition evaluation for cross-field validations | 1 day |
| 2.5 | Integrate schema validator into `diagnostics.py` | 0.5 day |
| 2.6 | Run existing tests, fix regressions | 1 day |

**Deliverables**:
- Complete events.yaml schema covering all existing event checks
- Schema validator running alongside existing code
- All existing event tests passing

### Phase 3: Story Cycles Migration (Week 3)

**Goal**: Migrate story cycle validation to schema.

| Task | Description | Effort |
|------|-------------|--------|
| 3.1 | Create `data/schemas/story_cycles.yaml` | 1 day |
| 3.2 | Add timing validation support to validator | 0.5 day |
| 3.3 | Add `contains_effect()` helper for conditions | 0.5 day |
| 3.4 | Update `story_cycles.py` to use schema | 1 day |
| 3.5 | Run tests, fix regressions | 1 day |

**Deliverables**:
- Complete story_cycles.yaml schema
- Story cycle validation via schema
- Deprecation of hardcoded story cycle validation

### Phase 4: Completions & Hover Migration (Week 4)

**Goal**: Make completions and hover file-type-aware using schemas.

| Task | Description | Effort |
|------|-------------|--------|
| 4.1 | Add `field_docs` section to events.yaml | 0.5 day |
| 4.2 | Create `data/effects/effects.yaml` with effect docs | 1 day |
| 4.3 | Create `data/triggers/triggers.yaml` with trigger docs | 1 day |
| 4.4 | Implement `schema_completions.py` | 1 day |
| 4.5 | Implement `schema_hover.py` | 1 day |
| 4.6 | Refactor `completions.py` to use schema | 0.5 day |
| 4.7 | Refactor `hover.py` to use schema | 0.5 day |
| 4.8 | Run existing tests, verify completions work | 0.5 day |

**Deliverables**:
- Completions now file-type-aware (shows `effect` for decisions, `type` for events)
- Hover shows documentation from schema
- Existing completions still work for effects/triggers

**Key Changes**:
```yaml
# events.yaml - field_docs section
field_docs:
  type:
    description: "Event type determines display and behavior"
    snippet: "type = ${1|character_event,letter_event,court_event|}"
    detail: "Required: character_event, letter_event, etc."
  title:
    description: "Localization key for event title"
    snippet: "title = ${1:namespace.XXXX.t}"
    detail: "Required localization reference"
```

### Phase 5: Symbols & Code Lens (Week 5)

**Goal**: Make document outline and code lenses file-type-aware.

| Task | Description | Effort |
|------|-------------|--------|
| 5.1 | Add `symbols` section to events.yaml | 0.5 day |
| 5.2 | Add `code_lens` section to events.yaml | 0.5 day |
| 5.3 | Implement `schema_symbols.py` | 1 day |
| 5.4 | Refactor `symbols.py` to use schema | 0.5 day |
| 5.5 | Refactor `code_lens.py` to use schema | 1 day |
| 5.6 | Add symbols/code_lens to story_cycles.yaml | 0.5 day |
| 5.7 | Test document outline for all file types | 0.5 day |

**Deliverables**:
- Document outline shows proper symbol types (Event, Function, etc.)
- Code lenses appear for file types that define them
- Story cycles get code lenses

**Key Changes**:
```yaml
# events.yaml - symbols section
symbols:
  primary:
    kind: Event                   # Shows as event icon in outline
    name_from: key                # Event ID like namespace.0001
  children:
    - field: option
      kind: EnumMember
      name_from: name             # Option's localization key
    - field: immediate
      kind: Function
      name: "immediate"
    - field: after
      kind: Function
      name: "after"

# code_lens section
code_lens:
  enabled: true
  reference_count:
    show: true
    label: "{count} references"
  missing_localization:
    show: true
    fields: [title, desc]
    label: "⚠️ Missing localization: {field}"
```

### Phase 6: High Priority File Types (Weeks 6-7)

**Goal**: Add full schema support for Decisions, Character Interactions, Schemes.

| Task | File Type | Validation | Completions | Symbols | Effort |
|------|-----------|------------|-------------|---------|--------|
| 6.1 | Decisions | ✅ | ✅ | ✅ | 2 days |
| 6.2 | Character Interactions | ✅ | ✅ | ✅ | 2 days |
| 6.3 | Schemes | ✅ | ✅ | ✅ | 1.5 days |
| 6.4 | On Actions | ✅ | ✅ | ✅ | 1 day |
| 6.5 | Integration testing | - | - | - | 1.5 days |

**Deliverables**:
- Full schemas for all high-priority file types
- Validation, completions, hover, symbols all working
- Integration tests for each type

### Phase 7: Cleanup and Documentation (Week 8)

**Goal**: Remove deprecated code, update documentation.

| Task | Description | Effort |
|------|-------------|--------|
| 7.1 | Remove hardcoded validation from `events.py` | 0.5 day |
| 7.2 | Remove hardcoded validation from `story_cycles.py` | 0.5 day |
| 7.3 | Simplify `paradox_checks.py` (keep generic checks only) | 1 day |
| 7.4 | Move `ck3_language.py` lists to YAML | 1 day |
| 7.5 | Update module docstrings | 0.5 day |
| 7.6 | Create schema authoring guide | 1 day |
| 7.7 | Update CONTRIBUTING.md | 0.5 day |
| 7.8 | Performance profiling and optimization | 1 day |

**Deliverables**:
- Cleaned up codebase with no duplication
- Schema authoring documentation
- Performance within acceptable limits
- Updated REQUIRED_FIELDS_VALIDATION.md with new status

### Phase 8: Medium/Low Priority Types (Ongoing)

**Goal**: Incrementally add schemas for remaining file types.

| Priority | File Types | Effort Each |
|----------|------------|-------------|
| Medium | Traits, Casus Belli, Buildings, Laws, Factions | 0.5-1 day |
| Low | Cultures, Religions, Doctrines, Holdings, etc. | 0.5 day |

Each new file type follows the pattern:
1. Create `data/schemas/<type>.yaml`
2. Define required fields from game documentation
3. Add `field_docs` for completions/hover
4. Add `symbols` for document outline
5. Add `code_lens` if appropriate
6. Write tests
7. Update REQUIRED_FIELDS_VALIDATION.md

---

## Expression Language Specification

The condition expressions used in validations support:

### Supported Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `==` | `type.value == 'character_event'` | Equality |
| `!=` | `hidden.value != yes` | Inequality |
| `>`, `<`, `>=`, `<=` | `base.value > 100` | Numeric comparison |
| `AND` | `a.exists AND b.exists` | Logical AND |
| `OR` | `a.exists OR b.exists` | Logical OR |
| `NOT` | `NOT hidden.exists` | Logical NOT |

### Supported Properties

| Property | Example | Description |
|----------|---------|-------------|
| `.exists` | `hidden.exists` | True if field is present |
| `.count` | `option.count` | Number of occurrences |
| `.value` | `type.value` | Field value |
| `children.count` | `children.count == 0` | Total child count |

### Future Extensions

- `contains_effect('effect_name')` - Check if block contains an effect
- `min_value`, `max_value` - For range types
- `last_*` - Access last item in list (for fallback checks)
- `parent.*` - Access parent node properties

---

## Testing Strategy

### Unit Tests

```python
# tests/test_schema_loader.py
def test_load_schema():
    """Test basic schema loading."""
    loader = SchemaLoader()
    loader.load_all()
    
    schema = loader.get_schema_for_file("events/test.txt")
    assert schema is not None
    assert schema['file_type'] == 'event'
    
def test_variable_resolution():
    """Test $variable resolution in schemas."""
    loader = SchemaLoader()
    loader.load_all()
    
    schema = loader.get_schema_for_file("events/test.txt")
    # Check that $event_types was resolved
    assert 'character_event' in schema['fields']['type']['values']
    
def test_diagnostic_lookup():
    """Test diagnostic code lookup."""
    loader = SchemaLoader()
    loader.load_all()
    
    diag = loader.get_diagnostic('CK3760')
    assert diag is not None
    assert diag['severity'] == 'error'
```

```python
# tests/test_schema_validator.py
def test_required_field():
    """Test required field validation."""
    ast = parse_document("""
    test.0001 = {
        desc = test.desc
    }
    """)
    
    validator = SchemaValidator(schema_loader)
    diagnostics = validator.validate("events/test.txt", ast)
    
    # Should flag missing 'type' field
    assert any(d.code == 'CK3760' for d in diagnostics)
    
def test_enum_validation():
    """Test enum value validation."""
    ast = parse_document("""
    test.0001 = {
        type = invalid_type
    }
    """)
    
    validator = SchemaValidator(schema_loader)
    diagnostics = validator.validate("events/test.txt", ast)
    
    assert any(d.code == 'CK3761' for d in diagnostics)
```

### Integration Tests

```python
# tests/test_schema_integration.py
def test_full_event_validation():
    """Test complete event validation through schema."""
    content = load_fixture("events/sample_event.txt")
    ast = parse_document(content)
    
    validator = SchemaValidator(schema_loader)
    diagnostics = validator.validate("events/sample.txt", ast)
    
    # Should produce same diagnostics as current implementation
    assert_diagnostics_match(diagnostics, expected_diagnostics)
```

---

## Performance Considerations

### Caching Strategy

1. **Schema caching**: Schemas loaded once at startup, cached in memory
2. **Path pattern caching**: File type lookups cached per-path
3. **Compiled conditions**: Frequently-used conditions pre-compiled

### Expected Performance

| Operation | Current | With Schema | Target |
|-----------|---------|-------------|--------|
| Schema load (startup) | N/A | ~100ms | <200ms |
| File type lookup | ~5ms | ~1ms (cached) | <5ms |
| Event validation | ~20ms | ~25ms | <50ms |
| Full file validation | ~100ms | ~120ms | <200ms |

### Optimization Opportunities

1. **Lazy loading**: Only load schemas when first needed
2. **Pre-compilation**: Compile regex patterns and conditions at load time
3. **Incremental validation**: Only re-validate changed sections
4. **Parallel validation**: Run independent checks concurrently

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance regression | Medium | Medium | Benchmark before/after, optimize hot paths |
| Breaking existing validation | Medium | High | Run existing tests throughout migration, feature checklist |
| Breaking completions | Medium | High | Test completions for all effect/trigger types |
| Breaking code lenses | Low | Medium | Verify lenses appear for events and scripted |
| Complex conditions not expressible | Low | Medium | Fall back to Python for edge cases |
| Schema format too complex | Low | Medium | Keep schema format simple, provide examples |
| Contributors confused by new system | Medium | Low | Write clear documentation, provide templates |
| Indexer integration issues | Low | Medium | Test cross-file references thoroughly |
| Hover documentation incomplete | Medium | Low | Migrate all existing docs, verify coverage |

### Critical Path Items

These items MUST work correctly or the migration fails:

1. **Event validation** - Most used file type, most tests
2. **Effect completions** - Core editing feature
3. **Trigger completions** - Core editing feature  
4. **Go-to-definition** - Core navigation (generic, should be safe)
5. **Code lenses for events** - Visible user-facing feature

### Rollback Strategy

If critical issues are found:

1. **Phase 2-3**: Schema validator runs alongside existing code - can disable schema validation
2. **Phase 4-5**: New providers call old providers as fallback - can revert to old providers
3. **Phase 7**: Old code deleted - must complete all testing before this phase

---

## Success Metrics

1. **Code reduction**: 50%+ reduction in validation Python code
2. **New file type time**: Adding a new file type takes <1 day (vs. 3+ days currently)
3. **Test coverage**: Maintain 80%+ coverage
4. **Performance**: No more than 20% regression in validation time
5. **Contributor PRs**: Non-Python contributors can add schemas

---

## Feature Preservation Checklist

**CRITICAL**: This checklist must be verified before each phase is considered complete.

### Validation Features (Must Not Regress)

| Feature | Test File | Key Tests | Phase |
|---------|-----------|-----------|-------|
| Event required fields (type, title, desc) | `test_events.py` | `test_missing_type`, `test_missing_title` | 2 |
| Letter event sender requirement | `test_events.py` | `test_letter_event_missing_sender` | 2 |
| Option name requirement | `test_events.py` | `test_option_missing_name` | 2 |
| Portrait character requirement | `test_events.py` | `test_portrait_missing_character` | 2 |
| triggered_desc requirements | `test_events.py` | `test_triggered_desc_*` | 2 |
| Effect in trigger block | `test_paradox_checks.py` | `test_effect_in_trigger` | 2 |
| Hidden event with options warning | `test_events.py` | `test_hidden_with_options` | 2 |
| Multiple immediate blocks | `test_events.py` | `test_multiple_immediate` | 2 |
| ai_chance value checks | `test_events.py` | `test_ai_chance_*` | 2 |
| Story cycle timing | `test_story_cycles.py` | `test_missing_timing` | 3 |
| Story cycle triggered_effect | `test_story_cycles.py` | `test_triggered_effect_*` | 3 |
| Story cycle on_owner_death | `test_story_cycles.py` | `test_missing_owner_death` | 3 |
| Iterator validation (any_, every_) | `test_lists.py` | `test_effect_in_any_*` | Generic |
| Scope chain validation | `test_scopes.py` | `test_invalid_scope_chain` | Generic |
| Cross-file reference validation | `test_indexer.py` | `test_unknown_scripted_effect` | Generic |
| Localization key validation | `test_localization.py` | `test_missing_loc_key` | Generic |

### Navigation Features (Must Not Regress)

| Feature | Test File | Key Tests | Phase |
|---------|-----------|-----------|-------|
| Go-to-definition for events | `test_navigation.py` | `test_goto_event_definition` | Generic |
| Go-to-definition for scripted effects | `test_navigation.py` | `test_goto_scripted_effect` | Generic |
| Find references for events | `test_navigation.py` | `test_find_event_references` | Generic |
| Document symbols for events | `test_symbols.py` | `test_event_symbols` | 5 |
| Document symbols for scripted | `test_symbols.py` | `test_scripted_effect_symbols` | 5 |
| Document highlight | `test_document_highlight.py` | `test_scope_highlight` | Generic |

### Editing Features (Must Not Regress)

| Feature | Test File | Key Tests | Phase |
|---------|-----------|-----------|-------|
| Effect completions in effect blocks | `test_completions.py` | `test_effect_completions` | 4 |
| Trigger completions in trigger blocks | `test_completions.py` | `test_trigger_completions` | 4 |
| Scope completions | `test_completions.py` | `test_scope_completions` | 4 |
| Hover for effects | `test_hover.py` | `test_effect_hover` | 4 |
| Hover for triggers | `test_hover.py` | `test_trigger_hover` | 4 |
| Signature help for effects | `test_signature_help.py` | `test_effect_signature` | 4 |
| Code lens for events | `test_code_lens.py` | `test_event_reference_lens` | 5 |
| Code lens for scripted effects | `test_code_lens.py` | `test_scripted_effect_lens` | 5 |
| Inlay hints for scopes | `test_inlay_hints.py` | `test_scope_type_hint` | Generic |
| Formatting | `test_formatting.py` | `test_format_document` | Generic |
| Folding | `test_folding.py` | `test_block_folding` | Generic |
| Rename symbols | `test_rename.py` | `test_rename_event` | Generic |

### Generic Features (No Changes Expected)

These features should continue working without modification:

| Feature | Why Unchanged |
|---------|---------------|
| Document Links | Pattern-based, no file-type awareness |
| Formatting | Paradox syntax rules, universal |
| Folding | Brace-based, universal |
| Rename | Symbol-based from indexer |
| Semantic Tokens | Keyword-based, may extend later |

---

## Appendix: File Type Priority Matrix

Based on `REQUIRED_FIELDS_VALIDATION.md`:

| Priority | File Type | Current Status | Features Needed | Schema Complexity |
|----------|-----------|----------------|-----------------|-------------------|
| **Implemented** | Events | ✅ Full validation + features | All | High (done) |
| **Implemented** | Story Cycles | ✅ Validation only | +Completions, +CodeLens | Medium (done) |
| **High** | Decisions | ❌ Generic only | All | Medium |
| **High** | Character Interactions | ❌ Generic only | All | Medium |
| **High** | Schemes | ❌ Generic only | All | Medium |
| **Medium** | On Actions | ❌ Generic only | Validation, Symbols | Low |
| **Medium** | Traits | ❌ Generic only | Validation, Completions | Low |
| **Medium** | Casus Belli | ❌ Generic only | Validation | Low |
| **Medium** | Buildings | ❌ Generic only | Validation | Medium |
| **Medium** | Laws | ❌ Generic only | Validation | Medium |
| **Low** | 30+ other types | ❌ Generic only | Varies | Varies |

### Feature Coverage After Migration

| File Type | Validation | Completions | Hover | Symbols | CodeLens |
|-----------|------------|-------------|-------|---------|----------|
| Events | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema |
| Story Cycles | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema |
| Decisions | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema | ⚠️ Optional |
| Char Interactions | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema | ⚠️ Optional |
| Schemes | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema | ⚠️ Optional |
| Others | ✅ Schema | ✅ Schema | ✅ Schema | ✅ Schema | ❌ N/A |
| Generic (.txt) | ⚠️ Generic | ⚠️ Generic | ⚠️ Generic | ⚠️ Generic | ❌ N/A |

---

## References

- [REQUIRED_FIELDS_VALIDATION.md](REQUIRED_FIELDS_VALIDATION.md) - Complete feature matrix by file type
- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/) - Official documentation
- [JSON Schema](https://json-schema.org/) - Inspiration for schema format
- [ESLint Rules](https://eslint.org/docs/rules/) - Inspiration for rule configuration
