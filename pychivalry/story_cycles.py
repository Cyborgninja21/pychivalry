"""
CK3 Story Cycle System - Validation and Processing

DIAGNOSTIC CODES:
    STORY-001: effect_group missing timing keyword (days/months/years)
    STORY-002: Invalid timing format: expected integer or { min max } range
    STORY-003: Invalid timing range: min must be ≤ max and both must be positive
    STORY-004: Multiple timing keywords in effect_group
    STORY-005: triggered_effect missing required trigger block
    STORY-006: triggered_effect missing required effect block
    STORY-007: Story cycle has no effect_group blocks
    STORY-008: Story cycle must be in common/story_cycles/ directory
    
    STORY-020: Story lacks on_owner_death handler (may persist indefinitely)
    STORY-021: on_owner_death doesn't call end_story or transfer ownership
    STORY-022: effect_group without trigger fires unconditionally
    STORY-023: chance value exceeds 100%
    STORY-024: chance value is 0 or negative (never fires)
    STORY-025: effect_group has no triggered_effect blocks
    STORY-026: first_valid has no unconditional fallback effect
    STORY-027: Mixing triggered_effect and first_valid is confusing
    
    STORY-040: Empty on_setup block
    STORY-041: Empty on_end block
    STORY-042: Variable storage detected (good practice)
    STORY-043: Very short interval (< 30 days) - performance concern
    STORY-044: Very long interval (> 5 years) - player may not see it
    STORY-045: Consider adding debug logging in on_end

MODULE OVERVIEW:
    Story cycles are event managers that fire periodic effects and persist
    state across time and character death. They're defined in common/story_cycles/
    and created with the create_story effect. Common uses include:
    
    - Pet events: Track pet age and fire periodic events
    - Long-term quests: Multi-stage questlines with state persistence
    - Destiny mechanics: Track special characters (Child of Destiny)
    - Variable storage: Persist variables/lists beyond character death
    
    This module validates story cycle structure, timing syntax, and lifecycle
    management to prevent runtime errors and silent failures.

ARCHITECTURE:
    **Story Cycle Structure**:
    ```
    story_cycle_name = {
        # Lifecycle hooks
        on_setup = { ... }           # Runs when story is created
        on_end = { ... }             # Runs when story ends
        on_owner_death = { ... }     # Runs when owner dies (while alive)
        
        # Repeating effect groups
        effect_group = {
            days/months/years = X    # Timing interval
            trigger = { ... }        # When this group can fire
            chance = 50              # Optional: probability (1-100)
            
            triggered_effect = {
                trigger = { ... }    # When this specific effect fires
                effect = { ... }     # What happens
            }
            
            # Or use first_valid for conditional effects
            first_valid = {
                triggered_effect = { ... }
                triggered_effect = { ... }
            }
        }
    }
    ```
    
    **Validation Pipeline**:
    1. Parse story cycle definition from AST
    2. Extract lifecycle hooks (on_setup, on_end, on_owner_death)
    3. Parse each effect_group for timing and structure
    4. Validate triggered_effect blocks
    5. Check lifecycle management patterns
    6. Emit diagnostics for violations

STORY CYCLE CONCEPTS:
    **Story Owner**: The character who owns the story (access via story_owner)
    **Story Scope**: The story itself (access via scope:story or scope:storyline)
    **Variable Storage**: Use var: on story scope to persist data
    **Lifecycle Management**: Stories must be explicitly ended with end_story = yes
    **Timing Intervals**: effect_groups fire on schedule, checking triggers each time

USAGE EXAMPLES:
    >>> # Parse a story cycle
    >>> text = "my_story = { on_setup = {} effect_group = { days = 30 } }"
    >>> story = parse_story_cycle(text, tree)
    >>> story.name
    'my_story'
    
    >>> # Validate timing
    >>> group = EffectGroup(timing_type="days", timing_value=30)
    >>> diagnostics = validate_effect_group_timing(group, node)
    >>> len(diagnostics)
    0  # Valid
    
    >>> # Check for lifecycle management
    >>> story = StoryCycleDefinition(name="test", effect_groups=[...])
    >>> diagnostics = validate_story_cycle_lifecycle(story, node)
    >>> any(d.code == "STORY-020" for d in diagnostics)
    True  # Warning: no on_owner_death

DATA SOURCE:
    Based on:
    - Official CK3 modding wiki: https://ck3.paradoxwikis.com/Story_cycles_modding
    - Vanilla game files in common/story_cycles/
    - Community modding experience

PERFORMANCE:
    - Parsing: O(n) where n is story cycle size
    - Validation: O(m) where m is number of effect_groups
    - Memory: ~1KB per story cycle definition
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union
from lsprotocol.types import Diagnostic, DiagnosticSeverity, Range

from .parser import Tree, get_node_text


# ==============================================================================
# DATA STRUCTURES
# ==============================================================================

@dataclass
class TriggeredEffect:
    """
    Represents a triggered_effect within an effect_group.
    
    A triggered_effect conditionally executes effects based on a trigger.
    
    Attributes:
        trigger: Optional trigger block (condition)
        effect: Optional effect block (what happens)
        node: AST node for error reporting
    
    Example:
        ```
        triggered_effect = {
            trigger = { has_trait = brave }
            effect = { add_prestige = 100 }
        }
        ```
    """
    trigger: Optional[Dict[str, Any]] = None
    effect: Optional[Dict[str, Any]] = None
    node: Optional[Any] = None


@dataclass
class FirstValid:
    """
    Represents a first_valid block that chooses one effect.
    
    The first triggered_effect with a true trigger is executed.
    
    Attributes:
        triggered_effects: List of triggered effects (in order)
        node: AST node for error reporting
    
    Example:
        ```
        first_valid = {
            triggered_effect = {
                trigger = { has_trait = brave }
                effect = { add_prestige = 200 }
            }
            triggered_effect = {
                trigger = { always = yes }
                effect = { add_prestige = 50 }
            }
        }
        ```
    """
    triggered_effects: List[TriggeredEffect] = field(default_factory=list)
    node: Optional[Any] = None


@dataclass
class EffectGroup:
    """
    Represents an effect_group within a story cycle.
    
    An effect_group fires periodically based on timing and conditions.
    
    Attributes:
        timing_type: Type of timing ('days', 'months', 'years')
        timing_value: Either a fixed integer or a (min, max) range tuple
        trigger: Optional trigger block (when group can fire)
        chance: Optional probability (1-100)
        triggered_effects: List of triggered effects
        first_valid: Optional first_valid block
        node: AST node for error reporting
    
    Example:
        ```
        effect_group = {
            days = { 30 60 }
            trigger = {
                story_owner = { is_alive = yes }
            }
            chance = 50
            triggered_effect = {
                trigger = { always = yes }
                effect = { add_gold = 10 }
            }
        }
        ```
    """
    timing_type: Optional[str] = None  # 'days', 'months', 'years'
    timing_value: Optional[Union[int, Tuple[int, int]]] = None
    trigger: Optional[Dict[str, Any]] = None
    chance: Optional[int] = None
    triggered_effects: List[TriggeredEffect] = field(default_factory=list)
    first_valid: Optional[FirstValid] = None
    node: Optional[Any] = None


@dataclass
class StoryCycleDefinition:
    """
    Represents a complete story cycle definition.
    
    Story cycles are event managers that persist across time and character death.
    
    Attributes:
        name: Story cycle identifier
        on_setup: Optional setup hook (runs when created)
        on_end: Optional end hook (runs when ended)
        on_owner_death: Optional death hook (runs when owner dies)
        effect_groups: List of repeating effect groups
        node: AST node for error reporting
    
    Example:
        ```
        my_story = {
            on_setup = { add_gold = 100 }
            on_end = { debug_log = "Story ended" }
            on_owner_death = {
                scope:story = { end_story = yes }
            }
            effect_group = { ... }
        }
        ```
    """
    name: str
    on_setup: Optional[Dict[str, Any]] = None
    on_end: Optional[Dict[str, Any]] = None
    on_owner_death: Optional[Dict[str, Any]] = None
    effect_groups: List[EffectGroup] = field(default_factory=list)
    node: Optional[Any] = None


# ==============================================================================
# DIAGNOSTIC INFORMATION
# ==============================================================================

@dataclass
class DiagnosticInfo:
    """Information about a diagnostic code."""
    severity: DiagnosticSeverity
    message: str
    category: str


STORY_DIAGNOSTICS: Dict[str, DiagnosticInfo] = {
    # Critical errors (STORY-001 to STORY-008)
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
    
    # Important warnings (STORY-020 to STORY-027)
    "STORY-020": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="Story lacks on_owner_death handler (may persist indefinitely)",
        category="story_cycles"
    ),
    "STORY-021": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="on_owner_death should call end_story or transfer ownership with make_story_owner",
        category="story_cycles"
    ),
    "STORY-022": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="effect_group without trigger fires unconditionally every interval",
        category="story_cycles"
    ),
    "STORY-023": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="chance value exceeds 100%",
        category="story_cycles"
    ),
    "STORY-024": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="chance value is 0 or negative (effect never fires)",
        category="story_cycles"
    ),
    "STORY-025": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="effect_group has trigger but no triggered_effect blocks",
        category="story_cycles"
    ),
    "STORY-026": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="first_valid should have an unconditional fallback effect",
        category="story_cycles"
    ),
    "STORY-027": DiagnosticInfo(
        severity=DiagnosticSeverity.Warning,
        message="Mixing triggered_effect and first_valid in same effect_group is confusing",
        category="story_cycles"
    ),
    
    # Best practice hints (STORY-040 to STORY-045)
    "STORY-040": DiagnosticInfo(
        severity=DiagnosticSeverity.Information,
        message="on_setup block is empty - consider initialization logic",
        category="story_cycles"
    ),
    "STORY-041": DiagnosticInfo(
        severity=DiagnosticSeverity.Information,
        message="on_end block is empty - consider cleanup logic",
        category="story_cycles"
    ),
    "STORY-042": DiagnosticInfo(
        severity=DiagnosticSeverity.Hint,
        message="Story uses variable storage (good practice for state persistence)",
        category="story_cycles"
    ),
    "STORY-043": DiagnosticInfo(
        severity=DiagnosticSeverity.Information,
        message="Very short interval (< 30 days) - may impact performance",
        category="story_cycles"
    ),
    "STORY-044": DiagnosticInfo(
        severity=DiagnosticSeverity.Information,
        message="Very long interval (> 5 years) - player may not experience this",
        category="story_cycles"
    ),
    "STORY-045": DiagnosticInfo(
        severity=DiagnosticSeverity.Hint,
        message="Consider adding debug_log in on_end for testing",
        category="story_cycles"
    ),
}


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def create_diagnostic(
    code: str,
    range_: Range,
    custom_message: Optional[str] = None
) -> Diagnostic:
    """
    Create a diagnostic with the given code and range.
    
    Args:
        code: Diagnostic code (e.g., "STORY-001")
        range_: Text range for the diagnostic
        custom_message: Optional custom message (overrides default)
    
    Returns:
        Diagnostic object
    """
    info = STORY_DIAGNOSTICS[code]
    message = custom_message if custom_message else info.message
    
    return Diagnostic(
        range=range_,
        severity=info.severity,
        code=code,
        source="pychivalry",
        message=message
    )


def is_story_cycles_file(file_path: str) -> bool:
    """
    Check if file is in common/story_cycles/ directory.
    
    Args:
        file_path: Path to check
    
    Returns:
        True if in story_cycles directory
    """
    normalized = file_path.replace("\\", "/")
    return "common/story_cycles/" in normalized


def check_for_effect(block: Optional[Dict[str, Any]], effect_name: str) -> bool:
    """
    Check if an effect is present in a block (recursively).
    
    Args:
        block: Block to search
        effect_name: Effect name to find
    
    Returns:
        True if effect is found
    """
    if not block or not isinstance(block, dict):
        return False
    
    # Direct check
    if effect_name in block:
        return True
    
    # Recursive check in nested blocks
    for value in block.values():
        if isinstance(value, dict):
            if check_for_effect(value, effect_name):
                return True
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and check_for_effect(item, effect_name):
                    return True
    
    return False


# ==============================================================================
# PARSER FUNCTIONS (STUBS - TO BE IMPLEMENTED)
# ==============================================================================

def parse_story_cycle(tree: Tree, source: str) -> Optional[StoryCycleDefinition]:
    """
    Parse a story cycle definition from the AST.
    
    Args:
        tree: Parsed AST tree
        source: Source code text
    
    Returns:
        StoryCycleDefinition if found, None otherwise
    
    TODO: Implement full parsing logic
    """
    # TODO: Implement
    return None


def parse_effect_group(node: Any, source: str) -> EffectGroup:
    """
    Parse an effect_group block.
    
    Args:
        node: AST node for effect_group
        source: Source code text
    
    Returns:
        Parsed EffectGroup
    
    TODO: Implement full parsing logic
    """
    # TODO: Implement
    return EffectGroup(node=node)


def parse_triggered_effect(node: Any, source: str) -> TriggeredEffect:
    """
    Parse a triggered_effect block.
    
    Args:
        node: AST node for triggered_effect
        source: Source code text
    
    Returns:
        Parsed TriggeredEffect
    
    TODO: Implement full parsing logic
    """
    # TODO: Implement
    return TriggeredEffect(node=node)


def parse_timing_value(
    timing_node: Any, 
    source: str
) -> Tuple[Optional[str], Optional[Union[int, Tuple[int, int]]]]:
    """
    Parse timing value (integer or range).
    
    Args:
        timing_node: AST node for timing value
        source: Source code text
    
    Returns:
        Tuple of (timing_type, timing_value)
        - timing_type: 'days', 'months', or 'years'
        - timing_value: Integer or (min, max) tuple
    
    Examples:
        >>> parse_timing_value(node, "days = 30")
        ('days', 30)
        
        >>> parse_timing_value(node, "days = { 30 60 }")
        ('days', (30, 60))
    
    TODO: Implement full parsing logic
    """
    # TODO: Implement
    return (None, None)


# ==============================================================================
# VALIDATION FUNCTIONS (STUBS - TO BE IMPLEMENTED)
# ==============================================================================

def validate_effect_group_timing(
    group: EffectGroup, 
    node: Any
) -> List[Diagnostic]:
    """
    Validate timing syntax in effect_group.
    
    Checks:
    - STORY-001: Has timing keyword
    - STORY-002: Valid timing format
    - STORY-003: Valid range values
    - STORY-004: No multiple timing keywords
    - STORY-043: Performance (very short intervals)
    - STORY-044: Usability (very long intervals)
    
    Args:
        group: EffectGroup to validate
        node: AST node for error reporting
    
    Returns:
        List of diagnostics
    
    TODO: Implement full validation logic
    """
    diagnostics: List[Diagnostic] = []
    
    # TODO: Implement validation
    
    return diagnostics


def validate_triggered_effect(
    effect: TriggeredEffect, 
    node: Any
) -> List[Diagnostic]:
    """
    Validate triggered_effect structure.
    
    Checks:
    - STORY-005: Has trigger block
    - STORY-006: Has effect block
    
    Args:
        effect: TriggeredEffect to validate
        node: AST node for error reporting
    
    Returns:
        List of diagnostics
    
    TODO: Implement full validation logic
    """
    diagnostics: List[Diagnostic] = []
    
    # TODO: Implement validation
    
    return diagnostics


def validate_story_cycle(
    story: StoryCycleDefinition, 
    node: Any,
    file_path: str
) -> List[Diagnostic]:
    """
    Validate complete story cycle structure.
    
    Checks:
    - STORY-007: Has effect groups
    - STORY-008: In correct directory
    
    Args:
        story: StoryCycleDefinition to validate
        node: AST node for error reporting
        file_path: File path for directory check
    
    Returns:
        List of diagnostics
    
    TODO: Implement full validation logic
    """
    diagnostics: List[Diagnostic] = []
    
    # TODO: Implement validation
    
    return diagnostics


def validate_story_cycle_lifecycle(
    story: StoryCycleDefinition, 
    node: Any
) -> List[Diagnostic]:
    """
    Validate lifecycle management.
    
    Checks:
    - STORY-020: Has on_owner_death
    - STORY-021: Handler has cleanup
    - STORY-040: Empty on_setup
    - STORY-041: Empty on_end
    - STORY-045: Debug logging suggestion
    
    Args:
        story: StoryCycleDefinition to validate
        node: AST node for error reporting
    
    Returns:
        List of diagnostics
    
    TODO: Implement full validation logic
    """
    diagnostics: List[Diagnostic] = []
    
    # TODO: Implement validation
    
    return diagnostics


def validate_effect_group_logic(
    group: EffectGroup, 
    node: Any
) -> List[Diagnostic]:
    """
    Validate effect_group logic and structure.
    
    Checks:
    - STORY-022: Has trigger
    - STORY-023: Valid chance (not > 100)
    - STORY-024: Valid chance (not ≤ 0)
    - STORY-025: Has triggered_effects
    - STORY-026: first_valid has fallback
    - STORY-027: Not mixing patterns
    
    Args:
        group: EffectGroup to validate
        node: AST node for error reporting
    
    Returns:
        List of diagnostics
    
    TODO: Implement full validation logic
    """
    diagnostics: List[Diagnostic] = []
    
    # TODO: Implement validation
    
    return diagnostics


# ==============================================================================
# PUBLIC API
# ==============================================================================

def collect_story_cycle_diagnostics(
    tree: Tree,
    source: str,
    file_path: str
) -> List[Diagnostic]:
    """
    Collect all story cycle validation diagnostics for a file.
    
    This is the main entry point called by diagnostics.py.
    
    Args:
        tree: Parsed AST tree
        source: Source code text
        file_path: File path for context
    
    Returns:
        List of all diagnostics found
    
    TODO: Implement full collection logic
    """
    diagnostics: List[Diagnostic] = []
    
    # TODO: Implement full collection
    # 1. Parse story cycle definitions
    # 2. Run all validation functions
    # 3. Collect diagnostics
    
    return diagnostics
