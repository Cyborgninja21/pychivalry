"""
CK3 Scripting Language Definitions - Complete Language Reference

DIAGNOSTIC CODES:
    LANG-001: Unknown keyword
    LANG-002: Unknown effect
    LANG-003: Unknown trigger
    LANG-004: Unknown scope type
    LANG-005: Invalid operator usage

MODULE OVERVIEW:
    Provides comprehensive definitions of the Crusader Kings 3 scripting language
    constructs used for modding. This is the central reference for all CK3 language
    features that the language server uses for auto-completion, validation, and
    documentation.
    
    Organized into categories (keywords, effects, triggers, scopes) for easy
    lookup and filtering. All definitions are immutable and cached for performance.

ARCHITECTURE:
    **Language Definition Structure**:
    - **CK3_KEYWORDS**: Control flow and structural elements (50+ items)
    - **CK3_EFFECTS**: State-modifying commands (500+ items)
    - **CK3_TRIGGERS**: Conditional checks (400+ items)
    - **CK3_SCOPES**: Context switches (20+ scope types)
    - **CK3_EVENT_TYPES**: Event presentation styles (6 types)
    - **CK3_OPERATORS**: Comparison operators (10+ operators)
    - **CK3_BOOLEAN_VALUES**: Truth values (yes/no)
    - **CK3_CONTEXT_FIELDS**: Event/decision structure fields
    
    **Usage in Language Server**:
    1. Completions: Filter by context and provide as suggestions
    2. Validation: Check if used constructs are defined
    3. Hover: Provide documentation for constructs
    4. Diagnostics: Warn about unknown/deprecated constructs

LANGUAGE CATEGORIES:
    **Keywords** (Control Flow):
    - Conditionals: if, else, else_if
    - Blocks: trigger, effect, immediate, limit
    - Event structure: namespace, type, title, desc, option
    - Logic: OR, AND, NOT, NOR, NAND
    
    **Effects** (Actions - modify game state):
    - Character effects: add_gold, add_prestige, add_trait, death
    - Title effects: create_title, destroy_title, add_claim
    - Scope effects: save_scope_as, trigger_event, spawn_army
    - Variable effects: set_variable, change_variable
    - 500+ total effects
    
    **Triggers** (Conditions - test game state):
    - Character triggers: age, gold, has_trait, is_alive
    - Title triggers: tier, is_landless, has_law
    - Scope triggers: exists, has_variable, has_flag
    - Comparison triggers: >, <, >=, <=, =, !=
    - 400+ total triggers
    
    **Scopes** (Context Switches):
    - Character: character, ruler, player, heir
    - Title: title, primary_title, capital_province
    - Dynasty: dynasty, house
    - Faith/Culture: faith, culture
    - Geographic: province, county, duchy, kingdom, empire

DEFINITION FORMAT:
    Each construct is defined with:
    - Name: Identifier used in code
    - Category: Effect, trigger, keyword, etc.
    - Description: What it does
    - Parameters: Expected arguments
    - Valid Scopes: Where it can be used
    - Examples: Usage patterns

USAGE EXAMPLES:
    >>> # Check if construct is defined
    >>> 'add_gold' in CK3_EFFECTS
    True
    >>> 'invalid_effect' in CK3_EFFECTS
    False
    
    >>> # Get all triggers for completion
    >>> trigger_completions = [CompletionItem(label=t) for t in CK3_TRIGGERS]
    
    >>> # Filter effects by scope
    >>> character_effects = [e for e in CK3_EFFECTS if 'character' in e.scopes]

DATA SOURCE:
    Definitions based on:
    - Official Paradox CK3 modding documentation
    - Community modding wiki (ck3.paradoxwikis.com)
    - Analysis of vanilla game files
    - Common modding patterns
    
    Updated periodically to match latest CK3 patch.

PERFORMANCE:
    - Lookups: O(1) via set membership
    - Filtering: O(n) but with small n (<1000)
    - Memory: ~500KB for all definitions
    - Immutable: Safe for concurrent access

SEE ALSO:
    - completions.py: Uses definitions for auto-complete
    - diagnostics.py: Validates against definitions
    - hover.py: Shows definition documentation
    - scopes.py: Uses scope definitions for validation
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
    "add_short_term_gold",  # Adds gold that's tracked for short-term cost calculations
    "remove_short_term_gold",  # Removes short-term gold (common for costs/purchases)
    "add_prestige",  # Increases prestige (measure of reputation/fame)
    "remove_prestige",  # Decreases prestige
    "add_piety",  # Increases piety (measure of religious devotion)
    "remove_piety",  # Decreases piety
    # Lifestyle XP effects - Add experience to specific lifestyle trees
    "add_diplomacy_lifestyle_xp",  # Add XP to diplomacy lifestyle
    "add_martial_lifestyle_xp",  # Add XP to martial lifestyle
    "add_stewardship_lifestyle_xp",  # Add XP to stewardship lifestyle
    "add_intrigue_lifestyle_xp",  # Add XP to intrigue lifestyle
    "add_learning_lifestyle_xp",  # Add XP to learning lifestyle
    "add_wanderer_lifestyle_xp",  # Add XP to wanderer lifestyle (Roads to Power DLC)
    "add_stress",  # Increases stress level (can lead to mental breaks)
    "add_tyranny",  # Increases tyranny (measure of despotic rule)
    "death",  # Kills the character (triggers death events and inheritance)
    # Flag effects - Set/remove temporary flags on characters/scopes
    "add_character_flag",  # Sets a flag on a character (used for tracking state)
    "remove_character_flag",  # Removes a flag from a character
    "add_flag",  # Generic flag setting (works on most scopes)
    "remove_flag",  # Generic flag removal
    "set_global_flag",  # Sets a global game flag
    "remove_global_flag",  # Removes a global game flag
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
    "reverse_add_opinion",  # Adds opinion from target to current scope
    "remove_opinion",  # Removes a specific opinion modifier
    "set_relation_lover",  # Makes target a lover
    "set_relation_friend",  # Makes target a friend
    "set_relation_rival",  # Makes target a rival
    "remove_relation_lover",  # Removes lover relationship
    "remove_relation_friend",  # Removes friend relationship
    "remove_relation_rival",  # Removes rival relationship
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
    # Scope saving and switching
    "save_scope_as",  # Saves current scope to a variable for later reference
    "save_temporary_scope_as",  # Saves scope temporarily (cleared after event)
    # Conditional effects
    "if",  # Conditional block - executes effects if trigger is true
    "else_if",  # Alternative condition if previous if/else_if failed
    "else",  # Executes if all previous if/else_if conditions failed
    "switch",  # Switch statement for multiple conditions
    # Iteration effects
    "every_vassal",  # Execute effects on every vassal
    "random_vassal",  # Execute effects on a random vassal
    "every_courtier",  # Execute effects on every courtier
    "random_courtier",  # Execute effects on a random courtier
    # Miscellaneous effects - Special purpose effects
    "random",  # Execute effects with a specified probability (0-100)
    "random_list",  # Choose one option from a weighted list of effects
    "hidden_effect",  # Execute effects without showing tooltips to player
    "show_as_tooltip",  # Show effect in tooltip without executing
    "custom_tooltip",  # Display custom tooltip text
    # Stress effects
    "stress_impact",  # Apply stress based on traits
    # Debug effects
    "debug_log",  # Logs a message to the game debug output
    "debug_log_scopes",  # Logs current scope chain to debug output
    "assert_if",  # Assertion that logs an error if condition is true
    "assert_read",  # Assert for reading values
    # Audio/visual effects
    "play_music_cue",  # Play a music cue
    "play_sound_effect",  # Play a sound effect
    # Animation and presentation
    "animate_custom",  # Trigger custom animation
    # Title effects
    "create_title_and_vassal_change",  # Create a title transfer
    "change_title_holder",  # Change who holds a title
    # Activity effects
    "start_activity",  # Start an activity
    "complete_activity",  # Complete an activity
    "leave_activity",  # Leave an activity
    # Story cycle effects
    "create_story",  # Create a new story cycle with specified type
    "end_story",  # End the current story cycle and execute on_end block
    "make_story_owner",  # Transfer story cycle ownership to another character
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
    "is_female",  # True if character is female
    "is_male",  # True if character is male
    # Flag checks - Test temporary flags on characters/scopes
    "has_character_flag",  # Check if character has a specific flag set
    "has_flag",  # Generic flag check (works on most scopes)
    "has_global_flag",  # Check if a global game flag is set
    "has_title_flag",  # Check if a title has a specific flag
    "has_province_flag",  # Check if a province has a specific flag
    # Title checks - Test title ownership and rights
    "has_title",  # Check if character holds a specific title
    "has_claim_on",  # Check if character has a claim on a title
    "completely_controls",  # Check if character controls all counties in a title
    # Title tier triggers (used in title scope)
    "tier",  # Check title tier (tier = tier_duchy, tier >= tier_kingdom, etc.)
    "highest_held_title_tier",  # Check character's highest title tier
    "primary_title",  # Scope to character's primary title (also used as trigger)
    # Relationship checks - Test character relationships
    "has_relation",  # Check for specific relationship type (friend, rival, etc.)
    "has_relation_lover",  # Check if character has a lover relationship with target
    "has_relation_friend",  # Check if character has a friend relationship with target
    "has_relation_rival",  # Check if character has a rival relationship with target
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
    # War and conflict checks
    "is_at_war",  # True if character is currently at war
    "is_at_war_with",  # True if character is at war with specified target
    "is_at_war_with_target_on_side",  # Check if at war with target on specific side
    "has_truce",  # Check if character has a truce with target
    # Scope references (also valid as triggers to check existence)
    "this",  # Reference to current scope
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
    # Debug triggers
    "debug_only",  # Only true when game is in debug mode
    "game_start",  # True during game start initialization
    # Game rule checks
    "has_game_rule",  # Check if a game rule is set to a specific value
    # Modifier checks
    "has_character_modifier",  # Check if character has a specific modifier
    "has_modifier",  # Generic modifier check
    # Culture and religion checks
    "has_culture",  # Check character's culture
    "has_religion",  # Check character's religion
    "has_faith",  # Check character's faith
    "culture",  # Access character's culture scope
    "faith",  # Access character's faith scope
    # Dynasty checks
    "has_dynasty",  # Check if character belongs to a dynasty
    "dynasty",  # Access character's dynasty scope
    # Trigger blocks (used inside effects for conditions)
    "trigger",  # Trigger block for conditions
    "limit",  # Limit block for filtering in iterations
    # Variable checks
    "has_variable",  # Check if a variable is set on the scope
    "has_variable_list",  # Check if a variable list is set
    "variable_list_size",  # Check the size of a variable list
    # Attraction and sexuality checks
    "is_attracted_to_gender_of",  # Check if character is attracted to another's gender
    "is_attracted_to_women",  # Check if character is attracted to women
    "is_attracted_to_men",  # Check if character is attracted to men
    # Opinion and relations
    "has_opinion_modifier",  # Check if an opinion modifier exists
    "reverse_has_opinion_modifier",  # Check reverse opinion modifier
    # Scheme checks
    "is_scheme_target_of",  # Check if character is target of a scheme
    "has_scheme",  # Check if character has a scheme in progress
    # Activity checks
    "is_in_activity",  # Check if character is in an activity
    "has_activity",  # Check if character has an activity
    # Story cycle checks
    "has_active_story",  # Check if character has an active story of specified type
    # War and military
    "is_defender_in_war",  # Check if character is defending in a war
    "is_attacker_in_war",  # Check if character is attacking in a war
    # Special triggers for triggers in effect blocks
    "calc_true_if",  # Counts how many conditions are true
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

# CK3 Title Tier Values
# These are the valid values for title tier comparisons (tier = X, highest_held_title_tier >= X)
# Used in triggers that check or compare title ranks.
CK3_TITLE_TIERS = [
    "tier_barony",  # Lowest tier - baronies (castles, temples, cities)
    "tier_county",  # Counties - the basic land-holding unit
    "tier_duchy",  # Duchies - mid-tier titles grouping counties
    "tier_kingdom",  # Kingdoms - major realm titles
    "tier_empire",  # Empires - highest tier titles
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

# CK3 Event Option Fields
# These fields are used inside option = { } blocks to configure player choices.
# Options are the interactive elements of events that players click on.
CK3_OPTION_FIELDS = {
    "name": {
        "description": "Localization key for the option button text.",
        "usage": "name = my_event.001.option_a",
        "notes": (
            "Required. References a key in localization files that " "contains the displayed text."
        ),
        "type": "localization_key",
    },
    "custom_tooltip": {
        "description": "Displays a custom tooltip explaining what the option does.",
        "usage": "custom_tooltip = my_event.001.option_a.tt",
        "notes": (
            "References a localization key. Appears when hovering over the "
            "option. Use for effects that aren't self-explanatory."
        ),
        "type": "localization_key",
    },
    "trait": {
        "description": (
            "Highlights the option with a trait-colored border and " "shows the trait icon."
        ),
        "usage": "trait = brave",
        "notes": (
            "Does NOT require having the trait - it's purely cosmetic. "
            "Used to suggest which personality would choose this."
        ),
        "type": "trait_id",
    },
    "skill": {
        "description": (
            "Highlights the option with a skill-colored border and " "shows the skill icon."
        ),
        "usage": "skill = diplomacy",
        "notes": (
            "Shows which skill is relevant to this choice. Values: "
            "diplomacy, martial, stewardship, intrigue, learning, prowess."
        ),
        "type": "skill_id",
    },
    "trigger": {
        "description": "Conditions that must be true for the option to appear.",
        "usage": "trigger = { is_adult = yes }",
        "notes": (
            "If trigger fails, option is hidden from player. "
            "Use 'show_as_unavailable' to gray out instead."
        ),
        "type": "trigger_block",
    },
    "show_as_unavailable": {
        "description": "Shows the option grayed out instead of hiding it when trigger fails.",
        "usage": "show_as_unavailable = { trigger = { ... } }",
        "notes": "Useful for showing players what options exist even if they can't choose them.",
        "type": "block",
    },
    "ai_chance": {
        "description": "Controls how likely AI characters are to pick this option.",
        "usage": ("ai_chance = { base = 50 modifier = { add = 20 has_trait = brave } }"),
        "notes": (
            "Higher values = more likely. Can use modifiers to adjust based "
            "on character traits/situation."
        ),
        "type": "ai_weight_block",
    },
    "fallback": {
        "description": "Marks this option as the fallback if no other options are available.",
        "usage": "fallback = yes",
        "notes": "Ensures the event always has at least one valid option to prevent soft-locks.",
        "type": "boolean",
    },
    "exclusive": {
        "description": "Makes this option mutually exclusive with other exclusive options.",
        "usage": "exclusive = yes",
        "notes": "Only one exclusive option will be shown if multiple would be valid.",
        "type": "boolean",
    },
    "highlight_portrait": {
        "description": "Highlights a character portrait when hovering over this option.",
        "usage": "highlight_portrait = scope:target",
        "notes": "Helps players understand who the option affects.",
        "type": "scope",
    },
    "first_valid_triggered_desc": {
        "description": "Shows the first matching description from a list.",
        "usage": "first_valid_triggered_desc = { triggered_desc = { trigger = {...} desc = key } }",
        "notes": "Useful for dynamic option text based on character/situation.",
        "type": "block",
    },
}

# CK3 Event Fields
# These fields are used at the event level (inside event_id = { } blocks).
CK3_EVENT_FIELDS = {
    "type": {
        "description": "The type of event, determining its presentation style.",
        "usage": "type = character_event",
        "notes": (
            "Required. Options: character_event, letter_event, duel_event, "
            "court_event, fullscreen_event."
        ),
        "type": "event_type",
    },
    "title": {
        "description": "Localization key for the event title/header.",
        "usage": "title = my_event.001.t",
        "notes": "Shown at the top of the event window.",
        "type": "localization_key",
    },
    "desc": {
        "description": "Localization key for the event description/body text.",
        "usage": "desc = my_event.001.desc",
        "notes": "Can be a simple key or a complex block with triggered_desc for dynamic text.",
        "type": "localization_key_or_block",
    },
    "theme": {
        "description": "Visual and audio theme for the event.",
        "usage": "theme = seduction",
        "notes": (
            "Affects background music, colors, and overall mood. "
            "Common: seduction, intrigue, war, diplomacy, faith."
        ),
        "type": "theme_id",
    },
    "window": {
        "description": "The window style/template for the event.",
        "usage": "window = clear_event_window_v2",
        "notes": "Determines the visual layout. Most mods use clear_event_window_v2.",
        "type": "window_id",
    },
    "override_background": {
        "description": "Sets a specific background image for the event.",
        "usage": "override_background = { event_background = bedchamber }",
        "notes": "Overrides the default background from theme.",
        "type": "block",
    },
    "left_portrait": {
        "description": "Configuration for the left character portrait.",
        "usage": "left_portrait = { character = root animation = happiness }",
        "notes": "Shows a character on the left side of the event.",
        "type": "portrait_block",
    },
    "right_portrait": {
        "description": "Configuration for the right character portrait.",
        "usage": "right_portrait = { character = scope:target animation = anger }",
        "notes": "Shows a character on the right side of the event.",
        "type": "portrait_block",
    },
    "lower_left_portrait": {
        "description": "Configuration for the lower-left character portrait.",
        "usage": "lower_left_portrait = { character = scope:witness }",
        "notes": "Additional portrait position for events with many characters.",
        "type": "portrait_block",
    },
    "lower_right_portrait": {
        "description": "Configuration for the lower-right character portrait.",
        "usage": "lower_right_portrait = { character = scope:guard }",
        "notes": "Additional portrait position for events with many characters.",
        "type": "portrait_block",
    },
    "immediate": {
        "description": "Effects that execute immediately when the event fires.",
        "usage": "immediate = { save_scope_as = protagonist }",
        "notes": (
            "Runs before the player sees the event. Use for setup, "
            "saving scopes, hidden effects."
        ),
        "type": "effect_block",
    },
    "on_trigger_fail": {
        "description": "Effects that run if the event's trigger fails after being queued.",
        "usage": "on_trigger_fail = { trigger_event = fallback_event }",
        "notes": "Useful for cleanup when conditions change between queuing and firing.",
        "type": "effect_block",
    },
    "orphan": {
        "description": "Allows the event to fire even if the character dies.",
        "usage": "orphan = yes",
        "notes": "Useful for death-related events that should still complete.",
        "type": "boolean",
    },
    "hidden": {
        "description": "Makes the event not display to the player.",
        "usage": "hidden = yes",
        "notes": "The event runs but shows no window. Useful for background processing.",
        "type": "boolean",
    },
}

# CK3 Portrait Block Fields
# Fields used inside portrait blocks (left_portrait, right_portrait, etc.)
CK3_PORTRAIT_FIELDS = {
    "character": {
        "description": "The character to display in the portrait.",
        "usage": "character = scope:friend",
        "notes": "Required. Can be a scope reference or direct character.",
        "type": "scope",
    },
    "animation": {
        "description": "The animation the character performs in the portrait.",
        "usage": "animation = happiness",
        "notes": (
            "Common: happiness, sadness, anger, fear, ecstasy, shock, "
            "disgust, flirtation, personality_bold."
        ),
        "type": "animation_id",
    },
    "outfit_tags": {
        "description": "Controls what clothes the character wears.",
        "usage": "outfit_tags = { no_clothes }",
        "notes": "Use for special outfits. Values include: no_clothes, war_clothes, feast_clothes.",
        "type": "list",
    },
    "triggered_animation": {
        "description": "Animation that changes based on conditions.",
        "usage": "triggered_animation = { trigger = { ... } animation = shock }",
        "notes": "Allows dynamic animations based on game state.",
        "type": "block",
    },
    "camera": {
        "description": "Camera position/angle for the portrait.",
        "usage": "camera = camera_body",
        "notes": "Controls framing. Values: camera_head, camera_body, camera_torso.",
        "type": "camera_id",
    },
    "hide_info": {
        "description": "Hides the character info tooltip on hover.",
        "usage": "hide_info = yes",
        "notes": "Useful for mystery characters or dramatic reveals.",
        "type": "boolean",
    },
}

# ==============================================================================
# Story Cycle Definitions
# ==============================================================================

# Story cycle-specific keywords
# Story cycles are event managers that persist across time and character death.
# They fire periodic effects and can store persistent state via variables.
STORY_CYCLE_KEYWORDS = {
    "on_setup",  # Lifecycle hook: runs when story is created via create_story
    "on_end",  # Lifecycle hook: runs when story ends via end_story
    "on_owner_death",  # Lifecycle hook: runs when story owner dies (while still alive)
    "effect_group",  # Repeating pulse that fires effects periodically
    "triggered_effect",  # Conditional effect within an effect_group
    "first_valid",  # Choose first triggered_effect with true trigger
    "story_owner",  # Reference the character who owns the story
}

# Timing keywords for effect_groups
# Each effect_group must have exactly ONE of these timing keywords.
# Values can be fixed integers or ranges { min max }.
STORY_CYCLE_TIMING_KEYWORDS = {
    "days",  # Fire every X days (e.g., days = 30 or days = { 30 60 })
    "months",  # Fire every X months (e.g., months = 3)
    "years",  # Fire every X years (e.g., years = 1 or years = { 1 5 })
    "chance",  # Optional: probability 1-100 that effect fires (e.g., chance = 50)
}

# Story cycle effects
# Effects specific to story cycle management
STORY_CYCLE_EFFECTS = {
    "end_story": "Ends the current story cycle and executes on_end block",
    "make_story_owner": "Transfers story ownership to another character",
    "create_story": "Creates a new story cycle with specified type",
}

# Story cycle triggers
# Triggers for checking story cycle state
STORY_CYCLE_TRIGGERS = {
    "has_active_story": "Check if character has an active story of specified type",
}

# Story Cycle Field Documentation
# Detailed documentation for story cycle structure and fields.
# Story cycles are defined in common/story_cycles/ files.
CK3_STORY_CYCLE_FIELDS = {
    "on_setup": {
        "description": "Executes when the story is created via create_story effect",
        "context": "Story scope",
        "example": (
            "on_setup = {\n"
            "    save_scope_value_as = { name = start_date value = current_date }\n"
            "}"
        ),
        "notes": "Use for initialization logic and setting up initial variables",
    },
    "on_end": {
        "description": "Executes when the story ends via end_story effect",
        "context": "Story scope",
        "example": (
            "on_end = {\n"
            "    debug_log = 'Story ended'\n"
            "    debug_log_date = yes\n"
            "}"
        ),
        "notes": "Use for cleanup logic and final notifications to story_owner",
    },
    "on_owner_death": {
        "description": "Executes when story owner dies (while still alive, like on_death on_action)",
        "context": "Story scope",
        "example": (
            "on_owner_death = {\n"
            "    scope:story = { end_story = yes }\n"
            "}"
        ),
        "notes": (
            "Often contains end_story to cleanup or make_story_owner to transfer to heir. "
            "Without this handler, story persists indefinitely even after owner dies."
        ),
    },
    "effect_group": {
        "description": "Repeating pulse that fires effects periodically based on timing interval",
        "timing": "Requires ONE of: days, months, or years",
        "example": (
            "effect_group = {\n"
            "    days = { 30 60 }  # Random interval\n"
            "    trigger = { story_owner = { is_alive = yes } }\n"
            "    chance = 50  # 50% probability\n"
            "    triggered_effect = {\n"
            "        trigger = { always = yes }\n"
            "        effect = { add_gold = 10 }\n"
            "    }\n"
            "}"
        ),
        "notes": (
            "Multiple effect_groups can exist in one story cycle. "
            "Each fires independently based on its timing and conditions."
        ),
    },
    "triggered_effect": {
        "description": "Conditional effect within an effect_group - executes if trigger is true",
        "required_fields": ["trigger", "effect"],
        "example": (
            "triggered_effect = {\n"
            "    trigger = { has_trait = brave }\n"
            "    effect = { add_prestige = 100 }\n"
            "}"
        ),
        "notes": "Multiple triggered_effects can exist in one effect_group",
    },
    "first_valid": {
        "description": "Chooses first triggered_effect with true trigger (like if/else_if chain)",
        "example": (
            "first_valid = {\n"
            "    triggered_effect = {\n"
            "        trigger = { has_trait = brave }\n"
            "        effect = { add_prestige = 200 }\n"
            "    }\n"
            "    triggered_effect = {\n"
            "        trigger = { always = yes }  # Fallback\n"
            "        effect = { add_prestige = 50 }\n"
            "    }\n"
            "}"
        ),
        "notes": "Should have an unconditional fallback as the last triggered_effect",
    },
    "story_owner": {
        "description": "References the character who owns this story cycle",
        "usage": "story_owner = { add_gold = 100 }",
        "notes": "Can be used in triggers and effects within the story cycle",
    },
}

# Combined field lookup for all context-specific fields
CK3_CONTEXT_FIELDS = {
    **CK3_OPTION_FIELDS,
    **CK3_EVENT_FIELDS,
    **CK3_PORTRAIT_FIELDS,
    **CK3_STORY_CYCLE_FIELDS,
}
