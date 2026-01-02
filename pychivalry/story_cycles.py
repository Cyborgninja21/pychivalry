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

from .parser import CK3Node


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


def check_for_effect(node: Any, effect_name: str) -> bool:
    """
    Check if an effect is present in a node (recursively).
    
    Args:
        node: Node to search
        effect_name: Effect name to find
    
    Returns:
        True if effect is found
    """
    if not node:
        return False
    
    # Check direct key match
    if hasattr(node, 'key') and node.key == effect_name:
        return True
    
    # Recursive check in children
    if hasattr(node, 'children'):
        for child in node.children:
            if check_for_effect(child, effect_name):
                return True
    
    return False


# ==============================================================================
# PARSER FUNCTIONS
# ==============================================================================

def find_story_cycles(node: Any) -> List[Any]:
    """
    Find all story cycle definition nodes in the AST.
    
    Story cycles are top-level blocks containing
    story cycle-specific fields (on_setup, effect_group, etc.).
    
    Args:
        node: AST node or list of nodes to search from
    
    Returns:
        List of story cycle nodes
    """
    story_cycles = []
    
    # Handle both list and single node input
    nodes_to_check = node if isinstance(node, list) else [node]
    
    for check_node in nodes_to_check:
        if not hasattr(check_node, 'children'):
            continue
            
        # Look for top-level blocks that might be story cycles
        if check_node.type == 'block' and hasattr(check_node, 'children') and check_node.children:
            # Check if this block contains story cycle fields
            has_story_cycle_fields = False
            for child in check_node.children:
                if child.key in ('on_setup', 'on_end', 'on_owner_death', 'effect_group'):
                    has_story_cycle_fields = True
                    break
            
            if has_story_cycle_fields:
                story_cycles.append(check_node)
    
    return story_cycles


def parse_timing_value(
    node: Any
) -> Tuple[Optional[str], Optional[Union[int, Tuple[int, int]]]]:
    """
    Parse timing value from a node (integer or range).
    
    Args:
        node: AST node for timing (e.g., days, months, years)
    
    Returns:
        Tuple of (timing_type, timing_value)
        - timing_type: 'days', 'months', or 'years'
        - timing_value: Integer or (min, max) tuple
    
    Examples:
        days = 30  → ('days', 30)
        days = { 30 60 }  → ('days', (30, 60))
        months = 3  → ('months', 3)
    """
    if not node:
        return (None, None)
    
    # Only process timing keywords
    if node.key not in ('days', 'months', 'years'):
        return (None, None)
    
    timing_type = node.key
    
    # Check if value is a simple number (assignment type)
    if node.value is not None:
        try:
            return (timing_type, int(node.value))
        except (ValueError, TypeError):
            pass
    
    # Check if it's a block with children (range specification)
    if node.type == 'block' and hasattr(node, 'children') and node.children:
        # Extract numbers from unnamed children (list items)
        numbers = []
        for child in node.children:
            # In a range block like { 30 60 }, items don't have keys
            if not child.key or child.key == "":
                try:
                    if child.value is not None:
                        numbers.append(int(child.value))
                except (ValueError, TypeError, AttributeError):
                    continue
        
        if len(numbers) == 2:
            return (timing_type, (numbers[0], numbers[1]))
        elif len(numbers) == 1:
            return (timing_type, numbers[0])
    
    return (timing_type, None)


def parse_triggered_effect(node: Any) -> TriggeredEffect:
    """
    Parse a triggered_effect block.
    
    Args:
        node: AST node for triggered_effect
    
    Returns:
        Parsed TriggeredEffect
    """
    effect = TriggeredEffect(node=node)
    
    if not hasattr(node, 'children'):
        return effect
    
    for child in node.children:
        if child.key == 'trigger':
            effect.trigger = {'node': child}  # Store node for validation
        elif child.key == 'effect':
            effect.effect = {'node': child}  # Store node for validation
    
    return effect


def parse_first_valid(node: Any) -> FirstValid:
    """
    Parse a first_valid block.
    
    Args:
        node: AST node for first_valid
    
    Returns:
        Parsed FirstValid
    """
    first_valid = FirstValid(node=node)
    
    if not hasattr(node, 'children'):
        return first_valid
    
    for child in node.children:
        if child.key == 'triggered_effect':
            te = parse_triggered_effect(child)
            first_valid.triggered_effects.append(te)
    
    return first_valid


def parse_effect_group(node: Any) -> EffectGroup:
    """
    Parse an effect_group block.
    
    Args:
        node: AST node for effect_group
    
    Returns:
        Parsed EffectGroup
    """
    group = EffectGroup(node=node)
    
    if not hasattr(node, 'children'):
        return group
    
    for child in node.children:
        if child.key in ('days', 'months', 'years'):
            timing_type, timing_value = parse_timing_value(child)
            if not group.timing_type:  # Only set if not already set
                group.timing_type = timing_type
                group.timing_value = timing_value
        elif child.key == 'trigger':
            group.trigger = {'node': child}
        elif child.key == 'chance':
            try:
                group.chance = int(child.value)
            except (ValueError, TypeError):
                pass  # Invalid chance value will be caught by validation
        elif child.key == 'triggered_effect':
            te = parse_triggered_effect(child)
            group.triggered_effects.append(te)
        elif child.key == 'first_valid':
            group.first_valid = parse_first_valid(child)
    
    return group


def parse_story_cycle(node: Any) -> StoryCycleDefinition:
    """
    Parse a story cycle definition from an AST node.
    
    Args:
        node: AST node for story cycle (top-level assignment)
    
    Returns:
        StoryCycleDefinition
    """
    story = StoryCycleDefinition(
        name=node.key,
        node=node
    )
    
    if not hasattr(node, 'children'):
        return story
    
    for child in node.children:
        if child.key == 'on_setup':
            story.on_setup = {'node': child}
        elif child.key == 'on_end':
            story.on_end = {'node': child}
        elif child.key == 'on_owner_death':
            story.on_owner_death = {'node': child}
        elif child.key == 'effect_group':
            group = parse_effect_group(child)
            story.effect_groups.append(group)
    
    return story


# ==============================================================================
# VALIDATION FUNCTIONS
# ==============================================================================

def validate_effect_group_timing(
    group: EffectGroup
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
    
    Returns:
        List of diagnostics
    """
    diagnostics: List[Diagnostic] = []
    
    if not group.node or not hasattr(group.node, 'range'):
        return diagnostics
    
    # STORY-001: Missing timing keyword
    if not group.timing_type:
        diagnostics.append(create_diagnostic("STORY-001", group.node.range))
        return diagnostics  # Can't do further timing validation without a type
    
    # STORY-002: Invalid timing format
    if group.timing_value is None:
        diagnostics.append(create_diagnostic("STORY-002", group.node.range))
        return diagnostics
    
    # STORY-003: Invalid range
    if isinstance(group.timing_value, tuple):
        min_val, max_val = group.timing_value
        if min_val < 0 or max_val < 0:
            diagnostics.append(create_diagnostic(
                "STORY-003", 
                group.node.range,
                f"Invalid timing range: values cannot be negative ({min_val}, {max_val})"
            ))
        elif min_val > max_val:
            diagnostics.append(create_diagnostic(
                "STORY-003",
                group.node.range,
                f"Invalid timing range: min ({min_val}) > max ({max_val})"
            ))
    
    # STORY-004: Multiple timing keywords
    timing_count = 0
    if hasattr(group.node, 'children'):
        for child in group.node.children:
            if child.key in ('days', 'months', 'years'):
                timing_count += 1
    
    if timing_count > 1:
        diagnostics.append(create_diagnostic("STORY-004", group.node.range))
    
    # STORY-043: Very short interval
    if group.timing_type == 'days' and isinstance(group.timing_value, int):
        if group.timing_value < 30:
            diagnostics.append(create_diagnostic(
                "STORY-043",
                group.node.range,
                f"Very short interval ({group.timing_value} days) - may impact performance"
            ))
    elif group.timing_type == 'days' and isinstance(group.timing_value, tuple):
        if group.timing_value[0] < 30:  # Check minimum value
            diagnostics.append(create_diagnostic(
                "STORY-043",
                group.node.range,
                f"Very short minimum interval ({group.timing_value[0]} days) - may impact performance"
            ))
    
    # STORY-044: Very long interval
    if group.timing_type == 'years':
        interval = group.timing_value if isinstance(group.timing_value, int) else group.timing_value[1]
        if interval > 5:
            diagnostics.append(create_diagnostic(
                "STORY-044",
                group.node.range,
                f"Very long interval ({interval} years) - player may not experience this"
            ))
    
    return diagnostics


def validate_triggered_effect(
    effect: TriggeredEffect
) -> List[Diagnostic]:
    """
    Validate triggered_effect structure.
    
    Checks:
    - STORY-005: Has trigger block
    - STORY-006: Has effect block
    
    Args:
        effect: TriggeredEffect to validate
    
    Returns:
        List of diagnostics
    """
    diagnostics: List[Diagnostic] = []
    
    if not effect.node or not hasattr(effect.node, 'range'):
        return diagnostics
    
    # STORY-005: Missing trigger
    if not effect.trigger:
        diagnostics.append(create_diagnostic("STORY-005", effect.node.range))
    
    # STORY-006: Missing effect
    if not effect.effect:
        diagnostics.append(create_diagnostic("STORY-006", effect.node.range))
    
    return diagnostics


def validate_story_cycle(
    story: StoryCycleDefinition,
    file_path: str
) -> List[Diagnostic]:
    """
    Validate complete story cycle structure.
    
    Checks:
    - STORY-007: Has effect groups
    - STORY-008: In correct directory
    
    Args:
        story: StoryCycleDefinition to validate
        file_path: File path for directory check
    
    Returns:
        List of diagnostics
    """
    diagnostics: List[Diagnostic] = []
    
    if not story.node or not hasattr(story.node, 'range'):
        return diagnostics
    
    # STORY-007: No effect groups
    if not story.effect_groups:
        diagnostics.append(create_diagnostic("STORY-007", story.node.range))
    
    # STORY-008: Not in correct directory
    if not is_story_cycles_file(file_path):
        diagnostics.append(create_diagnostic(
            "STORY-008",
            story.node.range,
            f"Story cycle '{story.name}' should be in common/story_cycles/ directory"
        ))
    
    return diagnostics


def validate_story_cycle_lifecycle(
    story: StoryCycleDefinition
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
    
    Returns:
        List of diagnostics
    """
    diagnostics: List[Diagnostic] = []
    
    if not story.node or not hasattr(story.node, 'range'):
        return diagnostics
    
    # STORY-020: No on_owner_death handler
    if not story.on_owner_death:
        diagnostics.append(create_diagnostic("STORY-020", story.node.range))
    else:
        # STORY-021: on_owner_death without cleanup
        if story.on_owner_death and isinstance(story.on_owner_death, dict):
            handler_node = story.on_owner_death.get('node')
            has_end_story = handler_node and check_for_effect(handler_node, "end_story")
            has_transfer = handler_node and check_for_effect(handler_node, "make_story_owner")
            
            if not (has_end_story or has_transfer):
                range_ = handler_node.range if handler_node and hasattr(handler_node, 'range') else story.node.range
                diagnostics.append(create_diagnostic("STORY-021", range_))
    
    # STORY-040: Empty on_setup
    if story.on_setup and isinstance(story.on_setup, dict):
        setup_node = story.on_setup.get('node')
        if setup_node and (not hasattr(setup_node, 'children') or not setup_node.children):
            diagnostics.append(create_diagnostic("STORY-040", setup_node.range))
    
    # STORY-041: Empty on_end
    if story.on_end and isinstance(story.on_end, dict):
        end_node = story.on_end.get('node')
        if end_node and (not hasattr(end_node, 'children') or not end_node.children):
            diagnostics.append(create_diagnostic("STORY-041", end_node.range))
    
    # STORY-045: Suggest debug logging in on_end
    if story.on_end and isinstance(story.on_end, dict):
        end_node = story.on_end.get('node')
        if end_node:
            has_debug_log = check_for_effect(end_node, "debug_log")
            if not has_debug_log:
                diagnostics.append(create_diagnostic("STORY-045", end_node.range))
    
    return diagnostics


def validate_effect_group_logic(
    group: EffectGroup
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
    
    Returns:
        List of diagnostics
    """
    diagnostics: List[Diagnostic] = []
    
    if not group.node or not hasattr(group.node, 'range'):
        return diagnostics
    
    # STORY-022: effect_group without trigger
    if not group.trigger:
        diagnostics.append(create_diagnostic("STORY-022", group.node.range))
    
    # STORY-023 & STORY-024: Chance validation
    if group.chance is not None:
        if group.chance > 100:
            diagnostics.append(create_diagnostic(
                "STORY-023",
                group.node.range,
                f"chance = {group.chance} exceeds 100%"
            ))
        elif group.chance <= 0:
            diagnostics.append(create_diagnostic(
                "STORY-024",
                group.node.range,
                f"chance = {group.chance} means effect never fires"
            ))
    
    # STORY-025: No triggered_effects
    if not group.triggered_effects and not group.first_valid:
        diagnostics.append(create_diagnostic("STORY-025", group.node.range))
    
    # STORY-026: first_valid without fallback
    if group.first_valid and group.first_valid.triggered_effects:
        last_effect = group.first_valid.triggered_effects[-1]
        # Check if last effect has an unconditional trigger (always = yes)
        if last_effect.trigger:
            trigger_node = last_effect.trigger.get('node') if isinstance(last_effect.trigger, dict) else None
            has_always = False
            if trigger_node and hasattr(trigger_node, 'children'):
                for child in trigger_node.children:
                    if child.key == 'always' and child.value in (True, 'yes', 'true'):
                        has_always = True
                        break
            
            if not has_always and group.first_valid.node and hasattr(group.first_valid.node, 'range'):
                diagnostics.append(create_diagnostic("STORY-026", group.first_valid.node.range))
    
    # STORY-027: Mixing triggered_effect and first_valid
    if group.triggered_effects and group.first_valid:
        diagnostics.append(create_diagnostic("STORY-027", group.node.range))
    
    return diagnostics


# ==============================================================================
# PUBLIC API
# ==============================================================================

def collect_story_cycle_diagnostics(
    tree: Any,
    file_path: str
) -> List[Diagnostic]:
    """
    Collect all story cycle validation diagnostics for a file.
    
    This is the main entry point called by diagnostics.py.
    
    Args:
        tree: Parsed AST tree
        file_path: File path for context
    
    Returns:
        List of all diagnostics found
    """
    diagnostics: List[Diagnostic] = []
    
    # Find all story cycle definitions in the AST
    story_cycle_nodes = find_story_cycles(tree)
    
    for node in story_cycle_nodes:
        # Parse the story cycle
        story = parse_story_cycle(node)
        
        # Validate structure
        diagnostics.extend(validate_story_cycle(story, file_path))
        
        # Validate lifecycle
        diagnostics.extend(validate_story_cycle_lifecycle(story))
        
        # Validate each effect group
        for group in story.effect_groups:
            diagnostics.extend(validate_effect_group_timing(group))
            diagnostics.extend(validate_effect_group_logic(group))
            
            # Validate triggered effects
            for triggered_effect in group.triggered_effects:
                diagnostics.extend(validate_triggered_effect(triggered_effect))
            
            # Validate first_valid if present
            if group.first_valid:
                for triggered_effect in group.first_valid.triggered_effects:
                    diagnostics.extend(validate_triggered_effect(triggered_effect))
    
    return diagnostics
