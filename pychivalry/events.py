"""
CK3 Event System Module

This module handles validation and processing of CK3 events.
Events are the primary way players interact with game mechanics through narrative choices.

Event Types:
- character_event: Standard event with character portrait (most common)
- letter_event: Event presented as a letter/parchment
- court_event: Event with court scene background
- duel_event: Special event for duels
- feast_event: Event during feasts
- story_cycle: Long-running event chains with persistent state

Event Structure:
- namespace: Groups related events (e.g., my_mod)
- type: Event presentation style
- title: Localization key for title
- desc: Localization key for description
- theme: Visual/audio theme (diplomacy, intrigue, martial, etc.)
- trigger: Conditions for event to fire
- immediate: Effects executed before player sees event
- option: Player choices with effects

Required Fields by Type:
- All: type, title, desc
- character_event: Can have portraits
- letter_event: Has sender field
- court_event: Has court_scene field
"""

from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field


@dataclass
class Event:
    """
    Represents a CK3 event.

    Attributes:
        event_id: Event identifier (e.g., my_mod.0001)
        event_type: Type of event (character_event, letter_event, etc.)
        namespace: Event namespace
        title: Localization key for title
        desc: Localization key for description
        theme: Visual/audio theme
        required_fields: Set of required fields for this event type
        portraits: Dict of portrait configurations
        options: List of option definitions
    """

    event_id: str
    event_type: str
    namespace: Optional[str] = None
    title: Optional[str] = None
    desc: Optional[str] = None
    theme: Optional[str] = None
    required_fields: Set[str] = field(default_factory=set)
    portraits: Dict[str, Dict] = field(default_factory=dict)
    options: List[Dict] = field(default_factory=list)


# Valid event types
EVENT_TYPES = {
    "character_event",
    "letter_event",
    "court_event",
    "duel_event",
    "feast_event",
    "story_cycle",
}

# Valid event themes
EVENT_THEMES = {
    "default",
    "diplomacy",
    "intrigue",
    "martial",
    "stewardship",
    "learning",
    "seduction",
    "temptation",
    "romance",
    "faith",
    "culture",
    "war",
    "death",
    "dread",
    "dungeon",
    "feast",
    "hunt",
    "travel",
    "pet",
    "friendly",
    "unfriendly",
    "healthcare",
    "physical_health",
    "mental_health",
    "childhood",
    "pregnancy",
    "family",
    "realm",
    "vassal",
    "courtier",
    "realm_",
    "liege",
    "tax",
}

# Portrait positions
PORTRAIT_POSITIONS = {
    "left_portrait",
    "right_portrait",
    "lower_left_portrait",
    "lower_center_portrait",
    "lower_right_portrait",
}

# Portrait animations
PORTRAIT_ANIMATIONS = {
    "idle",
    "happiness",
    "sadness",
    "anger",
    "fear",
    "disgust",
    "flirtation",
    "shock",
    "boredom",
    "scheme",
    "personality_bold",
    "personality_cautious",
    "personality_compassionate",
    "personality_greedy",
    "personality_honorable",
    "personality_rational",
    "personality_vengeful",
}

# Required fields by event type
REQUIRED_FIELDS = {
    "character_event": {"type", "title", "desc"},
    "letter_event": {"type", "title", "desc", "sender"},
    "court_event": {"type", "title", "desc"},
    "duel_event": {"type", "title", "desc"},
    "feast_event": {"type", "title", "desc"},
    "story_cycle": {"type", "title", "desc"},
}


def is_valid_event_type(event_type: str) -> bool:
    """
    Check if an event type is valid.

    Args:
        event_type: The event type to check

    Returns:
        True if valid event type, False otherwise
    """
    return event_type in EVENT_TYPES


def is_valid_theme(theme: str) -> bool:
    """
    Check if an event theme is valid.

    Args:
        theme: The theme to check

    Returns:
        True if valid theme, False otherwise
    """
    return theme in EVENT_THEMES


def is_valid_portrait_position(position: str) -> bool:
    """
    Check if a portrait position is valid.

    Args:
        position: The position to check

    Returns:
        True if valid position, False otherwise
    """
    return position in PORTRAIT_POSITIONS


def is_valid_portrait_animation(animation: str) -> bool:
    """
    Check if a portrait animation is valid.

    Args:
        animation: The animation to check

    Returns:
        True if valid animation, False otherwise
    """
    return animation in PORTRAIT_ANIMATIONS


def validate_event_fields(event: Event) -> Tuple[bool, List[str]]:
    """
    Validate that an event has all required fields.

    Args:
        event: The event to validate

    Returns:
        Tuple of (is_valid, list_of_missing_fields)

    Examples:
        >>> event = Event(event_id='test.0001', event_type='character_event',
        ...               title='test.t', desc='test.desc')
        >>> validate_event_fields(event)
        (True, [])

        >>> event = Event(event_id='test.0001', event_type='character_event')
        >>> validate_event_fields(event)
        (False, ['title', 'desc'])
    """
    if event.event_type not in REQUIRED_FIELDS:
        return (False, [f"Unknown event type: {event.event_type}"])

    required = REQUIRED_FIELDS[event.event_type]
    missing = []

    # Check each required field
    if "type" in required and not event.event_type:
        missing.append("type")
    if "title" in required and not event.title:
        missing.append("title")
    if "desc" in required and not event.desc:
        missing.append("desc")

    # Check event-type specific fields
    if event.event_type == "letter_event":
        # Note: sender would be in the actual event data, not in our Event object
        # This is simplified - real validation would check the full event structure
        pass

    return (len(missing) == 0, missing)


def validate_portrait_configuration(portrait_config: Dict) -> Tuple[bool, Optional[str]]:
    """
    Validate a portrait configuration.

    Portrait configuration can specify:
    - character: The character to show
    - animation: The animation to use

    Args:
        portrait_config: Dictionary with portrait configuration

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(portrait_config, dict):
        return (False, "Portrait configuration must be a dictionary")

    # Check animation if specified
    if "animation" in portrait_config:
        animation = portrait_config["animation"]
        if not is_valid_portrait_animation(animation):
            return (False, f"Invalid portrait animation: {animation}")

    return (True, None)


def parse_event_id(event_id: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse an event ID into namespace and number.

    Event IDs typically follow the format: namespace.number

    Args:
        event_id: The event ID to parse

    Returns:
        Tuple of (namespace, number) if valid, (None, None) otherwise

    Examples:
        >>> parse_event_id('my_mod.0001')
        ('my_mod', '0001')

        >>> parse_event_id('my_mod.events.0001')
        ('my_mod.events', '0001')
    """
    if "." not in event_id:
        return (None, None)

    parts = event_id.rsplit(".", 1)
    if len(parts) == 2:
        namespace, number = parts
        return (namespace, number)

    return (None, None)


def validate_dynamic_description(desc_config: Dict) -> Tuple[bool, Optional[str]]:
    """
    Validate a dynamic description configuration.

    Dynamic descriptions include:
    - triggered_desc: Shows desc if trigger is true
    - first_valid: Shows first desc where trigger is true
    - random_valid: Shows random desc where trigger is true

    Args:
        desc_config: Dictionary with dynamic description config

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(desc_config, dict):
        return (False, "Dynamic description must be a dictionary")

    # triggered_desc must have both trigger and desc
    if "triggered_desc" in desc_config:
        triggered = desc_config["triggered_desc"]
        if not isinstance(triggered, dict):
            return (False, "triggered_desc must be a dictionary")
        if "trigger" not in triggered:
            return (False, "triggered_desc requires 'trigger' field")
        if "desc" not in triggered:
            return (False, "triggered_desc requires 'desc' field")

    return (True, None)


def get_event_type_description(event_type: str) -> str:
    """
    Get a description of an event type.

    Args:
        event_type: The event type

    Returns:
        Description string
    """
    descriptions = {
        "character_event": "Standard event with character portrait and options",
        "letter_event": "Event presented as a letter with parchment background",
        "court_event": "Event with court scene background and multiple characters",
        "duel_event": "Special event for combat/duel interactions",
        "feast_event": "Event during feast activities with feast-specific theming",
        "story_cycle": "Long-running event chain with persistent state across events",
    }
    return descriptions.get(event_type, "Unknown event type")


def get_theme_description(theme: str) -> str:
    """
    Get a description of an event theme.

    Args:
        theme: The theme name

    Returns:
        Description string
    """
    descriptions = {
        "default": "Default event styling",
        "diplomacy": "Diplomatic interactions and negotiations",
        "intrigue": "Plots, schemes, and secrets",
        "martial": "War, combat, and military matters",
        "stewardship": "Administration and economic matters",
        "learning": "Education, innovation, and knowledge",
        "faith": "Religious matters and faith interactions",
        "culture": "Cultural events and traditions",
        "war": "Warfare and military campaigns",
        "death": "Death and mortality events",
        "family": "Family relationships and dynamics",
    }
    return descriptions.get(theme, "Custom event theme")


def create_event(event_id: str, event_type: str, **kwargs) -> Event:
    """
    Create an Event object with validation.

    Args:
        event_id: Event identifier
        event_type: Event type
        **kwargs: Additional event properties

    Returns:
        Event object

    Raises:
        ValueError: If event_type is invalid
    """
    if not is_valid_event_type(event_type):
        raise ValueError(f"Invalid event type: {event_type}")

    namespace, _ = parse_event_id(event_id)

    return Event(
        event_id=event_id,
        event_type=event_type,
        namespace=namespace,
        title=kwargs.get("title"),
        desc=kwargs.get("desc"),
        theme=kwargs.get("theme"),
        required_fields=REQUIRED_FIELDS.get(event_type, set()),
        portraits=kwargs.get("portraits", {}),
        options=kwargs.get("options", []),
    )


def validate_option(option_config: Dict) -> Tuple[bool, Optional[str]]:
    """
    Validate an event option configuration.

    Options must have:
    - name: Localization key for the option text

    Args:
        option_config: Dictionary with option configuration

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(option_config, dict):
        return (False, "Option must be a dictionary")

    if "name" not in option_config:
        return (False, "Option requires 'name' field for localization")

    return (True, None)


def suggest_event_id_format(namespace: str) -> List[str]:
    """
    Suggest proper event ID formats for a namespace.

    Args:
        namespace: The namespace to use

    Returns:
        List of example event IDs
    """
    return [
        f"{namespace}.0001",
        f"{namespace}.0010",
        f"{namespace}.0100",
        f"{namespace}.1000",
    ]
