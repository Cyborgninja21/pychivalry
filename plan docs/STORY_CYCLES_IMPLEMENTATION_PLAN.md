# Story Cycles Validation - Implementation Plan

**Status**: 🔴 Not Started  
**Priority**: Medium  
**Estimated Effort**: 2-3 days  
**Target Version**: v1.3.0

---

## Table of Contents

1. [Overview](#overview)
2. [Story Cycle Structure](#story-cycle-structure)
3. [Validation Requirements](#validation-requirements)
4. [Implementation Architecture](#implementation-architecture)
5. [Diagnostic Codes](#diagnostic-codes)
6. [Data Requirements](#data-requirements)
7. [Implementation Tasks](#implementation-tasks)
8. [Testing Strategy](#testing-strategy)
9. [Documentation Requirements](#documentation-requirements)
10. [Examples](#examples)

---

## Overview

### What are Story Cycles?

Story cycles are event managers that fire events periodically and store related values. They persist across time and can survive character death by transferring to heirs. Common uses include:

- **Pet events**: Track pet age and fire periodic pet-related events
- **Long-term quests**: Multi-stage questlines with state persistence
- **Destiny mechanics**: Track special characters (Child of Destiny)
- **Variable storage**: Store variables/lists that persist beyond character death

### Current Support Status

✅ **What we have:**
- Story cycles recognized as an event type in `EVENT_TYPES`
- Basic event structure validation (type, title, desc)
- Listed in [ck3_language.py](pychivalry/ck3_language.py#L401) and [events.py](pychivalry/events.py#L35)

❌ **What we're missing:**
- No validation for story cycle-specific structure
- No validation for `on_setup`, `on_end`, `on_owner_death` blocks
- No validation for `effect_group` timing syntax
- No validation for `triggered_effect` nested structure
- No completions for story cycle-specific keywords
- No hover documentation for story cycle constructs

### Why This Matters

Story cycles have unique syntax that's completely different from regular events. Without validation, modders get:
- Silent failures when timing syntax is wrong (`days = x` vs `days = { min max }`)
- Confusion about block execution order
- No feedback on missing required blocks
- Runtime errors from incorrect `triggered_effect` structure

---

## Story Cycle Structure

### File Location
Story cycles are defined in `common/story_cycles/*.txt` files.

### Basic Structure

```paradox
story_cycle_name = {
    # Lifecycle hooks
    on_setup = { ... }           # Runs when story is created
    on_end = { ... }             # Runs when story ends
    on_owner_death = { ... }     # Runs when owner dies (while still alive)
    
    # Repeating effect groups (can have multiple)
    effect_group = {
        # Timing - ONE of these required
        days = 30                    # Fixed interval
        days = { 30 60 }            # Random range
        months = 3                   # Fixed months
        months = { 1 3 }            # Random range
        years = 1                    # Fixed years
        years = { 1 5 }             # Random range
        
        # When this group can fire
        trigger = { ... }
        
        # Optional: chance modifier (1-100)
        chance = 50
        
        # Effects to execute (can have multiple)
        triggered_effect = {
            trigger = { ... }        # When this specific effect fires
            effect = { ... }         # What happens
        }
        
        # Alternative: first_valid for conditional effects
        first_valid = {
            triggered_effect = {
                trigger = { ... }
                effect = { ... }
            }
            triggered_effect = { ... }  # Fallback
        }
    }
}
```

### Key Concepts

1. **Story Owner**: The character who owns the story (accessed via `story_owner`)
2. **Story Scope**: The story itself (accessed via `scope:story` or `scope:storyline`)
3. **Variable Storage**: Use `var:` on the story scope to persist data
4. **Lifecycle Management**: Stories must be explicitly ended with `end_story = yes`
5. **Timing Intervals**: effect_groups fire on schedule, checking triggers each time

---

## Validation Requirements

### Critical Validations (Must Have)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **STORY-001** | Error | Missing timing keyword | `effect_group` lacks `days`, `months`, or `years` |
| **STORY-002** | Error | Invalid timing format | Timing value not integer or `{ min max }` range |
| **STORY-003** | Error | Invalid range | Range has min > max or negative values |
| **STORY-004** | Error | Multiple timing keywords | `effect_group` has both `days` and `months` |
| **STORY-005** | Error | triggered_effect missing trigger | `triggered_effect` lacks required `trigger` block |
| **STORY-006** | Error | triggered_effect missing effect | `triggered_effect` lacks required `effect` block |
| **STORY-007** | Error | No effect groups | Story cycle has no `effect_group` blocks (does nothing) |
| **STORY-008** | Error | Invalid file location | Story cycle not in `common/story_cycles/` |

### Important Validations (Should Have)

| Code | Severity | Check | Description |
|------|----------|-------|-------------|
| **STORY-020** | Warning | No on_owner_death handler | Story lacks `on_owner_death` (story may persist indefinitely) |
| **STORY-021** | Warning | on_owner_death without end_story | Handler doesn't call `end_story` or transfer ownership |
| **STORY-022** | Warning | effect_group without trigger | effect_group has no trigger (fires unconditionally every interval) |
| **STORY-023** | Warning | Chance > 100 | `chance` value exceeds 100% |
| **STORY-024** | Warning | Chance ≤ 0 | `chance` value is 0 or negative (never fires) |
| **STORY-025** | Warning | No triggered_effects | effect_group has trigger but no `triggered_effect` blocks |
| **STORY-026** | Warning | first_valid no fallback | `first_valid` has no unconditional fallback effect |
| **STORY-027** | Warning | Mixing triggered_effect and first_valid | Both used in same effect_group (confusing) |

### Best Practice Validations (Nice to Have)

| Code | Severity | Information | Check | Description |
|------|----------|-------------|-------|-------------|
| **STORY-040** | Info | Empty on_setup | `on_setup` block is empty or missing |
| **STORY-041** | Info | Empty on_end | `on_end` block is empty or missing |
| **STORY-042** | Info | Variable storage detected | Story uses `var:` for state persistence (good practice) |
| **STORY-043** | Info | Very short interval | effect_group fires more frequently than 30 days (performance concern) |
| **STORY-044** | Info | Very long interval | effect_group fires less frequently than 5 years (player may not see it) |
| **STORY-045** | Hint | Consider debug logging | Add `debug_log` in `on_end` for testing |

---

## Implementation Architecture

### Module: `story_cycles.py`

New module in `pychivalry/story_cycles.py` following existing module patterns.

```python
"""
CK3 Story Cycle System - Validation and Processing

DIAGNOSTIC CODES:
    STORY-001 to STORY-008: Critical errors
    STORY-020 to STORY-027: Important warnings
    STORY-040 to STORY-045: Best practice hints

MODULE OVERVIEW:
    Story cycles are event managers that fire periodic effects and persist
    state across time. They can survive character death by transferring to
    heirs. This module validates story cycle structure, timing syntax, and
    lifecycle management.
    
ARCHITECTURE:
    **Validation Pipeline**:
    1. Parse story cycle definition
    2. Validate lifecycle hooks (on_setup, on_end, on_owner_death)
    3. Validate effect_group structures (timing, triggers, effects)
    4. Check triggered_effect nested structure
    5. Emit diagnostics for violations
    
STORY CYCLE STRUCTURE:
    - Lifecycle hooks: on_setup, on_end, on_owner_death
    - effect_groups: Repeating pulses with timing and conditions
    - triggered_effects: Conditional effects within groups
    - Variable storage: Use var: on story scope for persistence
"""
```

### Integration Points

1. **diagnostics.py** - Add story cycle validation to diagnostic collection
2. **ck3_language.py** - Add story cycle keywords to language definitions
3. **completions.py** - Add story cycle-specific completions
4. **hover.py** - Add hover documentation for story cycle constructs
5. **symbols.py** - Add story cycle symbol extraction
6. **semantic_tokens.py** - Add token types for story cycle keywords

### Data Structures

```python
@dataclass
class StoryCycleDefinition:
    """Represents a parsed story cycle."""
    name: str
    on_setup: Optional[Dict[str, Any]] = None
    on_end: Optional[Dict[str, Any]] = None
    on_owner_death: Optional[Dict[str, Any]] = None
    effect_groups: List[EffectGroup] = field(default_factory=list)
    
@dataclass
class EffectGroup:
    """Represents an effect_group within a story cycle."""
    timing_type: Optional[str] = None  # 'days', 'months', 'years'
    timing_value: Optional[Union[int, Tuple[int, int]]] = None
    trigger: Optional[Dict[str, Any]] = None
    chance: Optional[int] = None
    triggered_effects: List[TriggeredEffect] = field(default_factory=list)
    first_valid: Optional[FirstValid] = None
    
@dataclass
class TriggeredEffect:
    """Represents a triggered_effect within an effect_group."""
    trigger: Optional[Dict[str, Any]] = None
    effect: Optional[Dict[str, Any]] = None
```

---

## Diagnostic Codes

### Error Codes (STORY-001 to STORY-008)

Prevent runtime errors and undefined behavior.

```python
STORY_DIAGNOSTICS = {
    "STORY-001": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="effect_group missing timing keyword (days/months/years)",
        category="story_cycles"
    ),
    "STORY-002": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="Invalid timing format: expected integer or {{ min max }} range",
        category="story_cycles"
    ),
    "STORY-003": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="Invalid timing range: min must be ≤ max and both must be positive",
        category="story_cycles"
    ),
    "STORY-004": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="Multiple timing keywords in effect_group (use only one of days/months/years)",
        category="story_cycles"
    ),
    "STORY-005": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="triggered_effect missing required trigger block",
        category="story_cycles"
    ),
    "STORY-006": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="triggered_effect missing required effect block",
        category="story_cycles"
    ),
    "STORY-007": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="Story cycle has no effect_group blocks (does nothing)",
        category="story_cycles"
    ),
    "STORY-008": DiagnosticInfo(
        severity=DiagnosticSeverity.Error,
        message="Story cycle must be in common/story_cycles/ directory",
        category="story_cycles"
    ),
}
```

---

## Data Requirements

### New Language Definitions

Add to [ck3_language.py](pychivalry/ck3_language.py):

```python
# Story cycle-specific keywords
STORY_CYCLE_KEYWORDS = {
    "on_setup",
    "on_end", 
    "on_owner_death",
    "effect_group",
    "triggered_effect",
    "first_valid",
    "story_owner",
}

# Timing keywords for effect_groups
STORY_CYCLE_TIMING_KEYWORDS = {
    "days",
    "months", 
    "years",
    "chance",
}

# Story cycle effects
STORY_CYCLE_EFFECTS = {
    "end_story": "Ends the current story cycle",
    "make_story_owner": "Transfers story ownership to another character",
    "create_story": "Creates a new story cycle",
}

# Story cycle triggers
STORY_CYCLE_TRIGGERS = {
    "has_active_story": "Check if character has an active story of type",
    "story_owner": "Reference the owner of the story",
}
```

### Effect/Trigger Documentation

```python
CK3_STORY_CYCLE_FIELDS = {
    "on_setup": {
        "description": "Executes when the story is created via create_story effect",
        "context": "Story scope",
        "example": "on_setup = {\n    save_scope_value_as = { name = start_date value = current_date }\n}",
    },
    "on_end": {
        "description": "Executes when the story ends via end_story effect",
        "context": "Story scope", 
        "example": "on_end = {\n    debug_log = 'Story ended'\n}",
    },
    "on_owner_death": {
        "description": "Executes when story owner dies (while still alive, like on_death)",
        "context": "Story scope",
        "example": "on_owner_death = {\n    scope:story = { end_story = yes }\n}",
        "note": "Often contains end_story or make_story_owner to transfer to heir",
    },
    "effect_group": {
        "description": "Repeating pulse that fires every X time units",
        "timing": "Requires ONE of: days, months, or years",
        "example": "effect_group = {\n    days = { 30 60 }\n    trigger = { story_owner = { is_alive = yes } }\n    triggered_effect = { ... }\n}",
    },
    "triggered_effect": {
        "description": "Conditional effect within an effect_group",
        "required_fields": ["trigger", "effect"],
        "example": "triggered_effect = {\n    trigger = { has_trait = brave }\n    effect = { add_prestige = 100 }\n}",
    },
}
```

---

## Implementation Tasks

### Phase 1: Core Infrastructure (Day 1)

**1.1 Create Module Structure**
- [ ] Create `pychivalry/story_cycles.py` with module docstring
- [ ] Define data structures (StoryCycleDefinition, EffectGroup, TriggeredEffect)
- [ ] Add diagnostic codes (STORY-001 to STORY-045)
- [ ] Import in `pychivalry/__init__.py`

**1.2 Add Language Definitions**
- [ ] Add STORY_CYCLE_KEYWORDS to [ck3_language.py](pychivalry/ck3_language.py)
- [ ] Add STORY_CYCLE_TIMING_KEYWORDS
- [ ] Add story cycle effects to CK3_EFFECTS
- [ ] Add story cycle triggers to CK3_TRIGGERS
- [ ] Add CK3_STORY_CYCLE_FIELDS documentation

**1.3 Parser Functions**
- [ ] `parse_story_cycle()` - Extract story cycle definition
- [ ] `parse_effect_group()` - Extract effect_group structure
- [ ] `parse_triggered_effect()` - Extract triggered_effect structure
- [ ] `parse_timing_value()` - Parse integer or {min max} range

**Deliverable**: Module skeleton with parsing functions

---

### Phase 2: Validation Logic (Day 2)

**2.1 Critical Validations (STORY-001 to STORY-008)**

```python
def validate_effect_group_timing(group: EffectGroup, node: Any) -> List[Diagnostic]:
    """Validate timing syntax in effect_group."""
    diagnostics = []
    
    # STORY-001: Missing timing keyword
    if not group.timing_type:
        diagnostics.append(create_diagnostic(
            "STORY-001", node.range,
            "effect_group missing timing keyword"
        ))
    
    # STORY-004: Multiple timing keywords
    timing_count = sum([
        'days' in node,
        'months' in node, 
        'years' in node
    ])
    if timing_count > 1:
        diagnostics.append(create_diagnostic(
            "STORY-004", node.range,
            "Multiple timing keywords"
        ))
    
    # STORY-002, STORY-003: Validate timing format
    if group.timing_value:
        if isinstance(group.timing_value, tuple):
            min_val, max_val = group.timing_value
            if min_val > max_val or min_val < 0:
                diagnostics.append(create_diagnostic(
                    "STORY-003", node.range,
                    f"Invalid range: {min_val} to {max_val}"
                ))
    
    return diagnostics


def validate_triggered_effect(effect: TriggeredEffect, node: Any) -> List[Diagnostic]:
    """Validate triggered_effect structure."""
    diagnostics = []
    
    # STORY-005: Missing trigger
    if not effect.trigger:
        diagnostics.append(create_diagnostic(
            "STORY-005", node.range,
            "triggered_effect missing trigger block"
        ))
    
    # STORY-006: Missing effect
    if not effect.effect:
        diagnostics.append(create_diagnostic(
            "STORY-006", node.range,
            "triggered_effect missing effect block"
        ))
    
    return diagnostics


def validate_story_cycle(story: StoryCycleDefinition, node: Any) -> List[Diagnostic]:
    """Validate complete story cycle structure."""
    diagnostics = []
    
    # STORY-007: No effect groups
    if not story.effect_groups:
        diagnostics.append(create_diagnostic(
            "STORY-007", node.range,
            "Story cycle has no effect_group blocks"
        ))
    
    # Validate each effect group
    for group_node, group in zip(get_effect_group_nodes(node), story.effect_groups):
        diagnostics.extend(validate_effect_group_timing(group, group_node))
        
        # Validate triggered effects
        for effect_node, effect in zip(get_triggered_effect_nodes(group_node), group.triggered_effects):
            diagnostics.extend(validate_triggered_effect(effect, effect_node))
    
    return diagnostics
```

**2.2 Warning Validations (STORY-020 to STORY-027)**

```python
def validate_story_cycle_lifecycle(story: StoryCycleDefinition, node: Any) -> List[Diagnostic]:
    """Validate lifecycle management."""
    diagnostics = []
    
    # STORY-020: No on_owner_death handler
    if not story.on_owner_death:
        diagnostics.append(create_diagnostic(
            "STORY-020", node.range,
            "Story cycle lacks on_owner_death handler",
            severity=DiagnosticSeverity.Warning
        ))
    
    # STORY-021: on_owner_death without end_story
    elif story.on_owner_death:
        has_end_story = check_for_effect(story.on_owner_death, "end_story")
        has_transfer = check_for_effect(story.on_owner_death, "make_story_owner")
        
        if not (has_end_story or has_transfer):
            diagnostics.append(create_diagnostic(
                "STORY-021", node.range,
                "on_owner_death should call end_story or transfer ownership",
                severity=DiagnosticSeverity.Warning
            ))
    
    return diagnostics


def validate_effect_group_logic(group: EffectGroup, node: Any) -> List[Diagnostic]:
    """Validate effect_group logic."""
    diagnostics = []
    
    # STORY-022: effect_group without trigger
    if not group.trigger:
        diagnostics.append(create_diagnostic(
            "STORY-022", node.range,
            "effect_group without trigger fires unconditionally",
            severity=DiagnosticSeverity.Warning
        ))
    
    # STORY-023, STORY-024: Chance validation
    if group.chance is not None:
        if group.chance > 100:
            diagnostics.append(create_diagnostic(
                "STORY-023", node.range,
                f"chance = {group.chance} exceeds 100%",
                severity=DiagnosticSeverity.Warning
            ))
        elif group.chance <= 0:
            diagnostics.append(create_diagnostic(
                "STORY-024", node.range,
                f"chance = {group.chance} means effect never fires",
                severity=DiagnosticSeverity.Warning
            ))
    
    # STORY-025: No triggered_effects
    if not group.triggered_effects and not group.first_valid:
        diagnostics.append(create_diagnostic(
            "STORY-025", node.range,
            "effect_group has no triggered_effect blocks",
            severity=DiagnosticSeverity.Warning
        ))
    
    # STORY-027: Mixing patterns
    if group.triggered_effects and group.first_valid:
        diagnostics.append(create_diagnostic(
            "STORY-027", node.range,
            "Mixing triggered_effect and first_valid is confusing",
            severity=DiagnosticSeverity.Warning
        ))
    
    return diagnostics
```

**Deliverable**: Complete validation functions

---

### Phase 3: Integration (Day 2-3)

**3.1 Wire to Diagnostics**

```python
# In diagnostics.py

def collect_story_cycle_diagnostics(
    tree: Tree, 
    source: str, 
    config: DiagnosticConfig
) -> List[Diagnostic]:
    """Collect story cycle validation diagnostics."""
    if not config.story_cycle_enabled:
        return []
    
    diagnostics = []
    
    # Find story cycle definitions
    story_cycles = find_story_cycle_definitions(tree)
    
    for node, story in story_cycles:
        # Critical validations
        diagnostics.extend(validate_story_cycle(story, node))
        
        # Lifecycle validations
        diagnostics.extend(validate_story_cycle_lifecycle(story, node))
        
        # Effect group validations
        for group_node, group in zip(get_effect_group_nodes(node), story.effect_groups):
            diagnostics.extend(validate_effect_group_logic(group, group_node))
    
    return diagnostics
```

**3.2 Add to Completions**

```python
# In completions.py

def get_story_cycle_completions(context: str) -> List[CompletionItem]:
    """Get completions for story cycle constructs."""
    if context == "story_cycle_root":
        return [
            CompletionItem(
                label="on_setup",
                kind=CompletionItemKind.Keyword,
                detail="Lifecycle hook",
                documentation="Executes when story is created"
            ),
            CompletionItem(
                label="on_end",
                kind=CompletionItemKind.Keyword,
                detail="Lifecycle hook",
                documentation="Executes when story ends"
            ),
            CompletionItem(
                label="on_owner_death",
                kind=CompletionItemKind.Keyword,
                detail="Lifecycle hook", 
                documentation="Executes when story owner dies"
            ),
            CompletionItem(
                label="effect_group",
                kind=CompletionItemKind.Snippet,
                detail="Repeating pulse",
                insert_text="effect_group = {\n\tdays = $1\n\ttrigger = {\n\t\t$2\n\t}\n\ttriggered_effect = {\n\t\ttrigger = { $3 }\n\t\teffect = { $4 }\n\t}\n}",
                insert_text_format=InsertTextFormat.Snippet
            ),
        ]
    
    elif context == "effect_group":
        return [
            CompletionItem(label="days", kind=CompletionItemKind.Keyword),
            CompletionItem(label="months", kind=CompletionItemKind.Keyword),
            CompletionItem(label="years", kind=CompletionItemKind.Keyword),
            CompletionItem(label="trigger", kind=CompletionItemKind.Keyword),
            CompletionItem(label="chance", kind=CompletionItemKind.Keyword),
            CompletionItem(
                label="triggered_effect",
                kind=CompletionItemKind.Snippet,
                insert_text="triggered_effect = {\n\ttrigger = { $1 }\n\teffect = { $2 }\n}",
                insert_text_format=InsertTextFormat.Snippet
            ),
        ]
```

**3.3 Add Hover Documentation**

```python
# In hover.py

STORY_CYCLE_HOVER_DOCS = {
    "on_setup": """
    **on_setup** - Story Lifecycle Hook
    
    Executes when the story is created via `create_story` effect.
    
    **Context**: Story scope
    
    **Example**:
    ```paradox
    on_setup = {
        save_scope_value_as = { 
            name = story_start_date 
            value = current_date 
        }
    }
    ```
    """,
    
    "effect_group": """
    **effect_group** - Repeating Pulse
    
    Fires effects periodically based on timing interval.
    
    **Required**: ONE timing keyword (days/months/years)
    
    **Example**:
    ```paradox
    effect_group = {
        days = { 30 60 }  # Random interval
        trigger = {
            story_owner = { is_alive = yes }
        }
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                story_owner = { trigger_event = my_event.1 }
            }
        }
    }
    ```
    """,
}
```

**3.4 Add Symbol Extraction**

```python
# In symbols.py

def extract_story_cycle_symbols(tree: Tree, source: str) -> List[DocumentSymbol]:
    """Extract symbols from story cycle definitions."""
    symbols = []
    
    story_cycles = find_story_cycle_definitions(tree)
    
    for node, story in story_cycles:
        # Story cycle symbol
        story_symbol = DocumentSymbol(
            name=story.name,
            kind=SymbolKind.Class,
            range=node.range,
            selection_range=get_name_range(node),
            children=[]
        )
        
        # Add lifecycle hooks
        if story.on_setup:
            story_symbol.children.append(create_block_symbol("on_setup", ...))
        if story.on_end:
            story_symbol.children.append(create_block_symbol("on_end", ...))
        if story.on_owner_death:
            story_symbol.children.append(create_block_symbol("on_owner_death", ...))
        
        # Add effect groups
        for i, group in enumerate(story.effect_groups, 1):
            group_symbol = DocumentSymbol(
                name=f"effect_group #{i}",
                kind=SymbolKind.Method,
                ...
            )
            story_symbol.children.append(group_symbol)
        
        symbols.append(story_symbol)
    
    return symbols
```

**Deliverable**: Full LSP integration

---

### Phase 4: Testing (Day 3)

**4.1 Unit Tests**

Create `tests/test_story_cycles.py`:

```python
"""Tests for story cycle validation."""

import pytest
from pychivalry.story_cycles import (
    parse_story_cycle,
    validate_effect_group_timing,
    validate_triggered_effect,
    validate_story_cycle,
)


class TestStoryCycleParsing:
    """Test story cycle parsing functions."""
    
    def test_parse_simple_story_cycle(self):
        """Test parsing a simple story cycle."""
        text = """
        my_story = {
            on_setup = { add_gold = 100 }
            effect_group = {
                days = 30
                triggered_effect = {
                    trigger = { always = yes }
                    effect = { add_prestige = 10 }
                }
            }
        }
        """
        story = parse_story_cycle(text)
        assert story.name == "my_story"
        assert story.on_setup is not None
        assert len(story.effect_groups) == 1
    
    def test_parse_timing_fixed(self):
        """Test parsing fixed timing value."""
        text = "days = 30"
        timing_type, timing_value = parse_timing_value(text)
        assert timing_type == "days"
        assert timing_value == 30
    
    def test_parse_timing_range(self):
        """Test parsing range timing value."""
        text = "days = { 30 60 }"
        timing_type, timing_value = parse_timing_value(text)
        assert timing_type == "days"
        assert timing_value == (30, 60)


class TestEffectGroupValidation:
    """Test effect_group validation."""
    
    def test_missing_timing_keyword(self):
        """Test STORY-001: Missing timing keyword."""
        text = """
        effect_group = {
            trigger = { always = yes }
        }
        """
        diagnostics = validate_effect_group_timing(...)
        assert any(d.code == "STORY-001" for d in diagnostics)
    
    def test_multiple_timing_keywords(self):
        """Test STORY-004: Multiple timing keywords."""
        text = """
        effect_group = {
            days = 30
            months = 1
        }
        """
        diagnostics = validate_effect_group_timing(...)
        assert any(d.code == "STORY-004" for d in diagnostics)
    
    def test_invalid_range(self):
        """Test STORY-003: Invalid timing range."""
        text = """
        effect_group = {
            days = { 60 30 }  # min > max
        }
        """
        diagnostics = validate_effect_group_timing(...)
        assert any(d.code == "STORY-003" for d in diagnostics)


class TestTriggeredEffectValidation:
    """Test triggered_effect validation."""
    
    def test_missing_trigger(self):
        """Test STORY-005: Missing trigger."""
        text = """
        triggered_effect = {
            effect = { add_gold = 100 }
        }
        """
        diagnostics = validate_triggered_effect(...)
        assert any(d.code == "STORY-005" for d in diagnostics)
    
    def test_missing_effect(self):
        """Test STORY-006: Missing effect."""
        text = """
        triggered_effect = {
            trigger = { always = yes }
        }
        """
        diagnostics = validate_triggered_effect(...)
        assert any(d.code == "STORY-006" for d in diagnostics)


class TestStoryCycleValidation:
    """Test complete story cycle validation."""
    
    def test_no_effect_groups(self):
        """Test STORY-007: No effect groups."""
        text = """
        my_story = {
            on_setup = { add_gold = 100 }
        }
        """
        diagnostics = validate_story_cycle(...)
        assert any(d.code == "STORY-007" for d in diagnostics)
    
    def test_no_on_owner_death(self):
        """Test STORY-020: No on_owner_death handler."""
        text = """
        my_story = {
            effect_group = {
                days = 30
                triggered_effect = {
                    trigger = { always = yes }
                    effect = { add_gold = 10 }
                }
            }
        }
        """
        diagnostics = validate_story_cycle_lifecycle(...)
        assert any(d.code == "STORY-020" for d in diagnostics)
    
    def test_valid_story_cycle(self):
        """Test a valid story cycle has no errors."""
        text = """
        my_story = {
            on_owner_death = {
                scope:story = { end_story = yes }
            }
            
            effect_group = {
                days = { 30 60 }
                trigger = {
                    story_owner = { is_alive = yes }
                }
                triggered_effect = {
                    trigger = { always = yes }
                    effect = { add_gold = 10 }
                }
            }
        }
        """
        diagnostics = validate_story_cycle(...)
        errors = [d for d in diagnostics if d.severity == DiagnosticSeverity.Error]
        assert len(errors) == 0
```

**4.2 Integration Tests**

Create fixture file `tests/fixtures/story_cycles/destiny_child.txt`:

```paradox
# Real example from vanilla CK3
story_destiny_child = {
    on_setup = {}
    
    on_end = {
        debug_log = "Child of Destiny story ended on:"
        debug_log_date = yes
    }
    
    on_owner_death = {
        scope:story = { end_story = yes }
    }
    
    # Check if destiny child is dead
    effect_group = {
        days = 30
        trigger = { always = yes }
        
        triggered_effect = {
            trigger = {
                NOT = { exists = var:destiny_child }
            }
            effect = {
                end_story = yes
            }
        }
    }
    
    # Random events
    effect_group = {
        days = { 200 250 }
        trigger = {
            story_owner = { is_available = yes }
            var:destiny_child = {
                is_alive = yes
                is_available = yes
                is_adult = no
            }
        }
        
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                var:destiny_child = { save_scope_as = destiny_child }
                story_owner = {
                    trigger_event = { on_action = destiny_child_events }
                }
            }
        }
    }
    
    # Child becomes adult - end story
    effect_group = {
        days = { 5 10 }
        trigger = {
            story_owner = { is_available = yes }
            var:destiny_child = {
                is_alive = yes
                is_available = yes
                is_adult = yes
            }
        }
        
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                var:destiny_child = { save_scope_as = destiny_child }
                story_owner = { trigger_event = destiny_child.9999 }
                scope:story = { end_story = yes }
            }
        }
    }
}
```

Test against this fixture:
- Should parse successfully
- Should have no errors
- Should extract 3 effect groups
- Should recognize all lifecycle hooks

**4.3 Error Case Tests**

Test all diagnostic codes with intentionally broken examples.

**Deliverable**: Comprehensive test suite

---

## Documentation Requirements

### 1. Module Documentation

Complete docstring in `story_cycles.py` following existing module patterns.

### 2. Wiki Documentation

Create new wiki page: `Story-Cycles.md`

```markdown
# Story Cycles

Story cycles are event managers that fire periodic effects and can persist across character death.

## Structure

[Basic structure explanation with code example]

## Validation

The language server validates:
- Required timing keywords
- Timing format and ranges
- triggered_effect structure
- Lifecycle management
- [etc.]

## Common Mistakes

1. **Missing timing keyword** - Every effect_group needs days/months/years
2. **Forgetting on_owner_death** - Story will persist forever
3. **Invalid range syntax** - Use `{ min max }` not `{ min..max }`

[etc.]
```

### 3. Update Existing Documentation

- Add story cycles to [LSP-Feature-Matrix.md](pychivalry.wiki/LSP-Feature-Matrix.md)
- Update [CK3-Language-Features.md](pychivalry.wiki/CK3-Language-Features.md)
- Add to diagnostic codes reference
- Update [VALIDATION_GAPS.md](plan docs/workspace/VALIDATION_GAPS.md) to mark as implemented

### 4. Code Examples

Add to `examples/` directory:

- `examples/story_cycle_basic.txt` - Simple example
- `examples/story_cycle_complex.txt` - Advanced with first_valid
- `examples/story_cycle_errors.txt` - Common mistakes

**Deliverable**: Complete documentation

---

## Examples

### Valid Story Cycle

```paradox
# Pet story cycle - tracks pet age and fires events
pet_story = {
    on_setup = {
        # Initialize pet age
        set_variable = {
            name = pet_age
            value = 0
        }
    }
    
    on_end = {
        debug_log = "Pet story ended"
        story_owner = {
            send_interface_message = {
                type = event_generic_neutral
                title = pet_died_notification
            }
        }
    }
    
    on_owner_death = {
        # Transfer pet to heir
        if = {
            limit = {
                story_owner = {
                    exists = primary_heir
                }
            }
            make_story_owner = story_owner.primary_heir
        }
        else = {
            # No heir, pet dies with owner
            scope:story = { end_story = yes }
        }
    }
    
    # Age pet every year
    effect_group = {
        years = 1
        trigger = {
            story_owner = { is_alive = yes }
        }
        
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                change_variable = {
                    name = pet_age
                    add = 1
                }
            }
        }
    }
    
    # Random pet events
    effect_group = {
        days = { 90 180 }
        trigger = {
            story_owner = {
                is_available = yes
                is_adult = yes
            }
        }
        chance = 30
        
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                story_owner = {
                    trigger_event = {
                        on_action = pet_events
                    }
                }
            }
        }
    }
    
    # Pet dies of old age
    effect_group = {
        days = 30
        trigger = {
            var:pet_age >= 15
        }
        
        triggered_effect = {
            trigger = { always = yes }
            effect = {
                story_owner = {
                    trigger_event = pet.9999  # Death event
                }
                scope:story = { end_story = yes }
            }
        }
    }
}
```

### Common Errors

```paradox
# ERROR: STORY-001 - Missing timing keyword
effect_group = {
    trigger = { always = yes }
    triggered_effect = {
        trigger = { always = yes }
        effect = { add_gold = 10 }
    }
}

# ERROR: STORY-002 - Invalid timing format
effect_group = {
    days = "30"  # Should be integer
}

# ERROR: STORY-003 - Invalid range
effect_group = {
    days = { 60 30 }  # min > max
}

# ERROR: STORY-004 - Multiple timing keywords
effect_group = {
    days = 30
    months = 1  # Can only have one
}

# ERROR: STORY-005 - Missing trigger in triggered_effect
effect_group = {
    days = 30
    triggered_effect = {
        effect = { add_gold = 10 }  # Where's the trigger?
    }
}

# ERROR: STORY-006 - Missing effect in triggered_effect
effect_group = {
    days = 30
    triggered_effect = {
        trigger = { always = yes }  # Where's the effect?
    }
}

# ERROR: STORY-007 - No effect groups
my_empty_story = {
    on_setup = { add_gold = 100 }
    # Missing effect_group - story does nothing!
}

# WARNING: STORY-020 - No on_owner_death
my_immortal_story = {
    effect_group = {
        days = 30
        triggered_effect = {
            trigger = { always = yes }
            effect = { add_prestige = 1 }
        }
    }
    # Missing on_owner_death - story persists forever!
}

# WARNING: STORY-021 - on_owner_death without cleanup
my_leaky_story = {
    on_owner_death = {
        story_owner = { add_gold = 100 }
        # Should call end_story or make_story_owner!
    }
}
```

---

## Success Criteria

- [ ] All 8 critical diagnostic codes (STORY-001 to STORY-008) implemented and tested
- [ ] All 8 warning diagnostic codes (STORY-020 to STORY-027) implemented and tested
- [ ] Story cycle completions work in VS Code
- [ ] Hover documentation displays for story cycle keywords
- [ ] Symbol outline shows story cycle structure
- [ ] Real CK3 story cycle (destiny_child) validates without errors
- [ ] All common error cases caught with helpful messages
- [ ] Test coverage >90% for story_cycles.py
- [ ] Documentation complete and published to wiki
- [ ] Integration with existing diagnostics pipeline

---

## Future Enhancements

These are out of scope for initial implementation but could be added later:

1. **Cross-file validation**: Check if `create_story` references exist
2. **Scope validation**: Verify `story_owner` usage in correct context
3. **Variable tracking**: Check if referenced variables (var:) are set
4. **Performance analysis**: Warn about too many active stories
5. **Code actions**: Quick fixes for common errors (add missing timing, etc.)
6. **First_valid validation**: Deep validation of first_valid patterns
7. **Chance probability analysis**: Sum up probabilities across triggered_effects

---

## Related Documentation

- [CK3 Wiki - Story Cycles Modding](https://ck3.paradoxwikis.com/Story_cycles_modding)
- [VALIDATION_GAPS.md](workspace/VALIDATION_GAPS.md) - Section 13 (to be added)
- [events.py](pychivalry/events.py) - Related event validation
- [ck3_language.py](pychivalry/ck3_language.py) - Language definitions

---

**Status**: 🔴 Ready for implementation  
**Next Step**: Begin Phase 1 - Core Infrastructure
