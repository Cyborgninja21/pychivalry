"""
CK3 Scripting Language Definitions

This module contains keywords, effects, triggers, scopes, and other
language constructs for Crusader Kings 3 scripting language.

Based on CK3 modding documentation and common patterns.
"""

# Common CK3 keywords and control structures
CK3_KEYWORDS = [
    # Control flow
    "if",
    "else",
    "else_if",
    "limit",
    "trigger",
    "effect",
    "immediate",
    # Event keywords
    "namespace",
    "type",
    "title",
    "desc",
    "theme",
    "option",
    "trigger",
    # Decision keywords
    "is_shown",
    "is_valid",
    "is_valid_showing_failures_only",
    "ai_will_do",
    "ai_check_frequency",
    # Localization
    "localization_key",
]

# Common CK3 effects (things that change the game state)
CK3_EFFECTS = [
    # Character effects
    "add_trait",
    "remove_trait",
    "add_gold",
    "remove_gold",
    "add_prestige",
    "add_piety",
    "add_stress",
    "add_tyranny",
    "death",
    # Character modifiers
    "add_character_modifier",
    "remove_character_modifier",
    # Titles and claims
    "add_claim",
    "remove_claim",
    "create_title",
    "destroy_title",
    # Relationships
    "add_opinion",
    "remove_opinion",
    "marry",
    "divorce",
    # Realm effects
    "change_government",
    "set_capital_county",
    # Events
    "trigger_event",
    # Variables
    "set_variable",
    "change_variable",
    "remove_variable",
    # Miscellaneous
    "random",
    "random_list",
    "save_scope_as",
    "hidden_effect",
]

# Common CK3 triggers (conditional checks)
CK3_TRIGGERS = [
    # Character checks
    "age",
    "has_trait",
    "is_adult",
    "is_child",
    "is_ruler",
    "is_ai",
    "is_player",
    "is_alive",
    # Title checks
    "has_title",
    "has_claim_on",
    "completely_controls",
    # Relationship checks
    "has_relation",
    "is_married",
    "is_close_family_of",
    "opinion",
    # Resource checks
    "gold",
    "prestige",
    "piety",
    "short_term_gold",
    # Government checks
    "has_government",
    "has_law",
    # Location checks
    "location",
    "capital_county",
    # Boolean operators
    "AND",
    "OR",
    "NOT",
    "NOR",
    "NAND",
    # Comparisons
    "exists",
    "always",
    "custom",
    "custom_description",
]

# CK3 scopes (contexts for triggers and effects)
CK3_SCOPES = [
    # Character scopes
    "root",
    "prev",
    "this",
    "from",
    "fromfrom",
    # Character iterations
    "every_vassal",
    "any_vassal",
    "random_vassal",
    "ordered_vassal",
    "every_courtier",
    "any_courtier",
    "random_courtier",
    "every_prisoner",
    "any_prisoner",
    "every_child",
    "any_child",
    "every_spouse",
    "any_spouse",
    # Title scopes
    "primary_title",
    "capital_county",
    "every_held_title",
    "any_held_title",
    # Realm scopes
    "liege",
    "top_liege",
    # Relatives
    "father",
    "mother",
    "real_father",
    "dynasty",
    "house",
]

# CK3 event types
CK3_EVENT_TYPES = [
    "character_event",
    "letter_event",
    "duel_event",
    "feast_event",
    "story_cycle",
]

# CK3 common values and operators
CK3_OPERATORS = [
    "=",
    ">",
    "<",
    ">=",
    "<=",
    "==",
    "!=",
]

CK3_BOOLEAN_VALUES = [
    "yes",
    "no",
    "true",
    "false",
]

# File extensions for CK3 modding
CK3_FILE_EXTENSIONS = [
    ".txt",  # Script files (events, decisions, etc.)
    ".gui",  # GUI definitions
    ".gfx",  # Graphics definitions
    ".asset",  # Asset definitions
]

# Common CK3 script sections
CK3_SECTIONS = [
    "trigger",
    "effect",
    "immediate",
    "option",
    "after",
    "on_actions",
    "localization",
]
