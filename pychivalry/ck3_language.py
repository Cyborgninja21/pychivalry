"""
CK3 Scripting Language Definitions

This module provides comprehensive definitions of the Crusader Kings 3 scripting language
constructs used for modding. It serves as a central reference for all CK3 language features
that the language server can provide auto-completion and validation for.

The module organizes CK3 scripting constructs into several categories:
- Keywords: Control flow and structural elements
- Effects: Commands that modify game state (actions)
- Triggers: Conditional checks that test game state (conditions)
- Scopes: Context switches for accessing different game objects
- Event Types: Different kinds of in-game events
- Operators: Comparison and assignment operators
- Boolean Values: Truth values recognized by CK3
- File Extensions: Supported CK3 modding file types
- Sections: Common script structure sections

These definitions are based on official CK3 modding documentation and commonly used
patterns in the CK3 modding community. They enable the language server to provide
intelligent auto-completion suggestions to mod developers.

Usage:
    from ck3_language import CK3_KEYWORDS, CK3_EFFECTS, CK3_TRIGGERS

    # Use in completion suggestions
    for keyword in CK3_KEYWORDS:
        # Provide as completion item
        ...

For complete CK3 modding documentation, see:
https://ck3.paradoxwikis.com/Modding
"""

# Common CK3 keywords and control structures
# These are fundamental building blocks of CK3 scripts that control program flow,
# define events, decisions, and other game elements.
CK3_KEYWORDS = [
    # Control flow keywords - Used to create conditional logic and branching
    "if",  # Conditional statement: executes code block if condition is true
    "else",  # Alternative branch when 'if' condition is false
    "else_if",  # Additional conditional branches between 'if' and 'else'
    "limit",  # Restricts scope iteration to entities matching conditions
    "trigger",  # Defines conditions that must be met for an action/event
    "effect",  # Defines the actions/changes that occur
    "immediate",  # Executes effects immediately without delay
    # Event keywords - Used in event definitions
    "namespace",  # Groups related events under a common identifier
    "type",  # Specifies the event type (character_event, letter_event, etc.)
    "title",  # Localization key for event title/header
    "desc",  # Localization key for event description/body text
    "theme",  # Visual/audio theme for the event presentation
    "option",  # Player choice in an event with associated effects
    # Note: 'trigger' appears in both control flow and event contexts with same meaning
    # Decision keywords - Used in decision definitions
    "is_shown",  # Determines if decision appears in UI for the player
    "is_valid",  # Checks if decision can be taken (shows why if invalid)
    "is_valid_showing_failures_only",  # Like is_valid but only shows blocking conditions
    "ai_will_do",  # Scoring system for AI to evaluate decision desirability
    "ai_check_frequency",  # How often AI re-evaluates this decision (in days)
    # Localization keywords
    "localization_key",  # Reference to text definition in localization files
]

# Common CK3 effects (things that change the game state)
# Effects are commands that modify the game world. They are the "actions" in CK3 scripts.
# Effects can only be used in effect blocks, not in trigger/condition blocks.
# Effects execute in order and can have cascading results on the game state.
CK3_EFFECTS = [
    # Character effects - Modify individual character attributes
    "add_trait",  # Grants a trait to a character (e.g., brave, cruel)
    "remove_trait",  # Removes a trait from a character
    "add_gold",  # Increases character's gold/money by specified amount
    "remove_gold",  # Decreases character's gold (can go into debt)
    "add_prestige",  # Increases prestige (measure of reputation/fame)
    "add_piety",  # Increases piety (measure of religious devotion)
    "add_stress",  # Increases stress level (can lead to mental breaks)
    "add_tyranny",  # Increases tyranny (measure of despotic rule)
    "death",  # Kills the character (triggers death events and inheritance)
    # Character modifiers - Temporary or permanent stat adjustments
    "add_character_modifier",  # Applies a modifier (buff/debuff) to a character
    "remove_character_modifier",  # Removes an existing modifier from a character
    # Titles and claims - Land ownership and inheritance rights
    "add_claim",  # Grants a claim on a title (allows declaring wars for it)
    "remove_claim",  # Removes a claim on a title
    "create_title",  # Creates a new title (kingdom, duchy, county, etc.)
    "destroy_title",  # Destroys a title (useful for vassal management)
    # Relationships - Character interactions and bonds
    "add_opinion",  # Modifies opinion one character has of another (can be positive/negative)
    "remove_opinion",  # Removes a specific opinion modifier
    "marry",  # Creates a marriage between two characters
    "divorce",  # Ends a marriage between two characters
    # Realm effects - Government and realm-wide changes
    "change_government",  # Changes government type (feudal, clan, tribal, etc.)
    "set_capital_county",  # Changes the capital county of a realm
    # Events - Triggering other events
    "trigger_event",  # Fires another event (by event ID)
    # Variables - Dynamic data storage for scripting
    "set_variable",  # Creates or updates a variable with a value
    "change_variable",  # Modifies an existing variable's value (add/subtract)
    "remove_variable",  # Deletes a variable
    # Miscellaneous effects - Special purpose effects
    "random",  # Execute effects with a specified probability (0-100)
    "random_list",  # Choose one option from a weighted list of effects
    "save_scope_as",  # Saves current scope to a variable for later reference
    "hidden_effect",  # Execute effects without showing tooltips to player
]

# Common CK3 triggers (conditional checks)
# Triggers are conditions that test the game state and return true or false.
# They are used in trigger blocks, decision conditions, event triggers, and if statements.
# Triggers do NOT modify the game state - they only check/test conditions.
# Many triggers can accept comparison operators (=, >, <, >=, <=) and values.
CK3_TRIGGERS = [
    # Character checks - Test character properties
    "age",  # Check character's age (e.g., age >= 16)
    "has_trait",  # Check if character has a specific trait
    "is_adult",  # True if character is 16 or older
    "is_child",  # True if character is under 16
    "is_ruler",  # True if character holds any titles
    "is_ai",  # True if character is controlled by AI
    "is_player",  # True if character is controlled by a human player
    "is_alive",  # True if character is currently alive (not dead)
    # Title checks - Test title ownership and rights
    "has_title",  # Check if character holds a specific title
    "has_claim_on",  # Check if character has a claim on a title
    "completely_controls",  # Check if character controls all counties in a title
    # Relationship checks - Test character relationships
    "has_relation",  # Check for specific relationship type (friend, rival, etc.)
    "is_married",  # True if character is currently married
    "is_close_family_of",  # True if character is close family (parent, child, sibling)
    "opinion",  # Check opinion value one character has of another
    # Resource checks - Test character resources
    "gold",  # Check character's gold amount
    "prestige",  # Check character's prestige amount
    "piety",  # Check character's piety amount
    "short_term_gold",  # Check gold including expected income (for cost checks)
    # Government checks - Test realm government and laws
    "has_government",  # Check character's government type
    "has_law",  # Check if realm has a specific law enacted
    # Location checks - Test character location and capital
    "location",  # Get or check character's current location
    "capital_county",  # Check character's capital county
    # Boolean operators - Combine multiple conditions
    "AND",  # All conditions must be true (this is default behavior)
    "OR",  # At least one condition must be true
    "NOT",  # Inverts the condition (true becomes false, false becomes true)
    "NOR",  # None of the conditions can be true (all must be false)
    "NAND",  # Not all conditions are true (at least one must be false)
    # Comparisons and special checks
    "exists",  # Check if a scope/reference exists (not null)
    "always",  # Always true (used for unconditional effects)
    "custom",  # Custom trigger with scripted logic
    "custom_description",  # Custom description for tooltips with trigger logic
]

# CK3 scopes (contexts for triggers and effects)
# Scopes represent different game objects (characters, titles, provinces, etc.) and
# define the context in which triggers and effects operate. Switching scopes allows
# you to access and modify different game entities within your scripts.
#
# Scope switches can be:
# - Direct references: root, prev, this, from
# - Relationship navigation: father, mother, liege, spouse
# - Iteration: every_*, any_*, random_*, ordered_*
#
# Understanding scopes is crucial for CK3 modding as they determine what entity
# your triggers check and what entity your effects modify.
CK3_SCOPES = [
    # Character scopes - Basic scope references
    "root",  # The character who initiated the current script/event chain
    "prev",  # The previous scope before the last scope change
    "this",  # Current scope (usually implicit, rarely needed explicitly)
    "from",  # The scope passed from the calling context (event sender, etc.)
    "fromfrom",  # The scope two levels up in the calling chain
    # Character iterations - Loop through or check collections of characters
    # every_* : Iterate through all matching characters (for effects on each)
    # any_*   : Check if any character matches conditions (for triggers)
    # random_*: Select one random matching character
    # ordered_*: Iterate through characters in a specific order (by a sort key)
    "every_vassal",  # All direct vassals of current character
    "any_vassal",  # Check/iterate any vassal (used in triggers/effects)
    "random_vassal",  # One random vassal
    "ordered_vassal",  # Vassals in sorted order
    "every_courtier",  # All courtiers in current character's court
    "any_courtier",  # Check/iterate any courtier
    "random_courtier",  # One random courtier
    "every_prisoner",  # All characters imprisoned by current character
    "any_prisoner",  # Check/iterate any prisoner
    "every_child",  # All children of current character
    "any_child",  # Check/iterate any child
    "every_spouse",  # All spouses (in case of polygamy)
    "any_spouse",  # Check/iterate any spouse
    # Title scopes - Navigate to title-related scopes
    "primary_title",  # Character's highest-tier title (e.g., Kingdom if they're a King)
    "capital_county",  # Character's capital county title
    "every_held_title",  # All titles held by character
    "any_held_title",  # Check/iterate any held title
    # Realm scopes - Navigate the feudal hierarchy
    "liege",  # Character's direct feudal superior (who they're a vassal to)
    "top_liege",  # The top of the feudal chain (usually an Emperor or independent ruler)
    # Relatives - Direct family member scopes
    "father",  # Character's father (legal father, may not be biological)
    "mother",  # Character's mother
    "real_father",  # Character's biological father (may differ from legal father)
    "dynasty",  # Character's dynasty
    "house",  # Character's house (subdivision of dynasty)
]

# CK3 event types
# Different types of events with unique presentation styles and UI layouts.
# Each event type determines how the event is displayed to the player and what
# interaction options are available. Event types affect both gameplay feel and
# the mechanical structure of events.
CK3_EVENT_TYPES = [
    "character_event",  # Standard event with character portrait and text options
    "letter_event",  # Event presented as a letter (parchment background)
    "duel_event",  # Special event type for combat/duel interactions
    "feast_event",  # Event during feasts with feast-specific theming
    "story_cycle",  # Long-running event chains with persistent state
]

# CK3 common values and operators
# Comparison operators used in triggers to compare values.
# These operators work with numeric values, scopes, and some string comparisons.
# The right side can be a literal value, another scope's value, or a scripted value.
CK3_OPERATORS = [
    "=",  # Assignment (in effects) or equality check (in triggers)
    ">",  # Greater than (numeric comparison)
    "<",  # Less than (numeric comparison)
    ">=",  # Greater than or equal to
    "<=",  # Less than or equal to
    "==",  # Strict equality check (rarely used, = is more common)
    "!=",  # Not equal to (inequality check)
]

# Boolean values recognized by CK3
# CK3 uses both yes/no and true/false for boolean values.
# They are interchangeable - use whichever fits your coding style.
# These are case-insensitive in CK3, but lowercase is conventional.
CK3_BOOLEAN_VALUES = [
    "yes",  # Boolean true (most common in CK3 scripts)
    "no",  # Boolean false (most common in CK3 scripts)
    "true",  # Boolean true (alternative syntax)
    "false",  # Boolean false (alternative syntax)
]

# File extensions for CK3 modding
# CK3 uses different file extensions for different types of game content.
# The language server recognizes these extensions to provide appropriate language features.
CK3_FILE_EXTENSIONS = [
    ".txt",  # Script files: events, decisions, traits, cultures, religions, etc.
    # This is the most common file type and contains the game logic
    ".gui",  # GUI definitions: interface layouts, windows, buttons, etc.
    # Defines the visual presentation of game UI elements
    ".gfx",  # Graphics definitions: sprite references, textures, animations
    # Links game objects to visual assets
    ".asset",  # Asset definitions: 3D models, particle effects, sound references
    # Defines references to game assets and how they're used
]

# Common CK3 script sections
# These define the structure and organization of CK3 script files.
# Different script types (events, decisions, traits) use different combinations
# of these sections to organize their functionality.
CK3_SECTIONS = [
    "trigger",  # Condition block - determines when something is available/fires
    "effect",  # Action block - what happens when triggered
    "immediate",  # Immediate execution block - runs without delay
    "option",  # Player choice in events with associated effects
    "after",  # Code that runs after an effect completes
    "on_actions",  # Hooks that fire on game events (birth, death, war, etc.)
    "localization",  # Text definitions for display to players in their language
]
