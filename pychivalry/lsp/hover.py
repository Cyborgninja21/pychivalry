"""
CK3 Hover Documentation - Contextual Information on Hover

DIAGNOSTIC CODES:
    HOVER-001: Unable to provide hover information for symbol
    HOVER-002: Hover documentation truncated (too large)
    HOVER-003: Invalid hover position

MODULE OVERVIEW:
    Provides rich hover information when users move their mouse over CK3
    constructs in the editor. Displays documentation for effects, triggers,
    scopes, events, and other elements in a popup with Markdown formatting.
    
    Hover is one of the most-used LSP features, providing instant documentation
    without leaving the code. This module aggregates information from multiple
    sources (language definitions, indexer, parser) to show comprehensive context.

ARCHITECTURE:
    **Hover Information Pipeline**:
    1. User hovers over text → Editor sends hover request with position
    2. Extract word at position (handles identifiers, scopes, keywords)
    3. Determine symbol type from context (effect, trigger, scope, etc.)
    4. Query appropriate data source:
       - Effects/triggers → ck3_language.py definitions
       - Events/scripted blocks → indexer.py for definitions
       - Scopes → scopes.py for valid links
       - Variables → variables.py for type info
    5. Format information as Markdown with sections
    6. Return Hover object with formatted content
    7. Editor displays in popup near cursor
    
    **Information Sources**:
    - CK3_EFFECTS: 500+ effect definitions with parameters
    - CK3_TRIGGERS: 400+ trigger definitions with valid values
    - CK3_SCOPES: Scope types and navigation rules
    - DocumentIndex: Workspace-wide symbol definitions
    - Parser AST: Current document structure

HOVER CONTENT STRUCTURE:
    Formatted as Markdown with sections:
    ```markdown
    # Effect: add_gold
    
    **Description**: Adds gold to character's treasury
    
    **Parameters**:
    - `add_gold = 100` - Add fixed amount
    - `add_gold = { value = X }` - Add calculated value
    
    **Valid Scopes**: character
    
    **Example**:
    ```ck3
    add_gold = 500
    add_gold = {
        value = monthly_character_income
        multiply = 2
    }
    ```
    ```

HOVER TYPES:
    1. **Effects**: Description, parameters, valid scopes, examples
    2. **Triggers**: Description, comparison operators, valid values
    3. **Scopes**: Type, valid links (this, root, from), navigation
    4. **Events**: Event type, file location, trigger_event syntax
    5. **Saved Scopes**: Where defined, what type, usage locations
    6. **Variables**: Type (var/local_var/global_var), operations
    7. **Keywords**: Context-specific usage notes

USAGE EXAMPLES:
    >>> # Hover over "add_gold" effect
    >>> hover = get_hover(document, position)
    >>> hover.contents.value
    '# Effect: add_gold\\n\\n**Description**: Adds gold to character...'
    
    >>> # Hover over scope reference
    >>> hover = get_hover(document, position_on_scope)
    >>> 'Valid links:' in hover.contents.value
    True

PERFORMANCE:
    - Hover response: <5ms typically
    - Cached language definitions (1ms lookup)
    - Index lookups: <1ms (O(1) hash map)
    - Full hover with examples: ~3-5ms
    
    Debouncing in editor prevents excessive requests on mouse movement.

LSP INTEGRATION:
    textDocument/hover request returns:
    - Hover object with MarkupContent (Markdown)
    - Range indicating the hovered symbol (for highlighting)
    - Null if no information available for position

SEE ALSO:
    - ck3_language.py: Effect/trigger/scope definitions
    - indexer.py: Symbol definition lookup
    - navigation.py: Go-to-definition (related feature)
    - signature_help.py: Parameter hints (similar contextual help)
"""

from typing import Optional
from lsprotocol import types
from pygls.workspace import TextDocument

from pychivalry.core.parser import CK3Node, get_node_at_position
from pychivalry.core.indexer import DocumentIndex
from pychivalry.ck3.language import CK3_EFFECTS, CK3_TRIGGERS, CK3_SCOPES, CK3_KEYWORDS, CK3_CONTEXT_FIELDS, CK3_STORY_CYCLE_FIELDS
from pychivalry.ck3.validation.scopes import get_scope_links
from pychivalry.ck3.effect_trigger_docs import (
    get_effect_documentation as get_effect_doc_yaml,
    get_trigger_documentation as get_trigger_doc_yaml
)
import logging

logger = logging.getLogger(__name__)


def _get_mod_source_badge(identifier: str, identifier_type: str = "any") -> str:
    """
    Get a mod source badge if identifier is from a mod.
    
    Args:
        identifier: The identifier to look up
        identifier_type: Type hint ("effect", "trigger", "trait", etc.)
    
    Returns:
        Markdown badge like "📦 **Mod:** Carnalitas" or empty string.
        Shows warning if multiple mods define the same identifier.
    """
    try:
        from pychivalry.data.mods import get_all_source_mods
        sources = get_all_source_mods(identifier, identifier_type)
        if not sources:
            return ""
        
        if len(sources) == 1:
            # Single source - normal case
            mod_id, display_name = sources[0]
            return f"\n\n📦 **Mod:** {display_name}"
        else:
            # Multiple sources - conflict!
            mod_names = [name for _, name in sources]
            return (
                f"\n\n⚠️ **Conflict:** Defined in multiple mods: {', '.join(mod_names)}\n\n"
                f"*Load order determines which version is used.*"
            )
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"Error getting mod source for {identifier}: {e}")
    return ""


def get_word_at_position(doc: TextDocument, position: types.Position) -> Optional[str]:
    """
    Extract the word at a given cursor position.

    Args:
        doc: The text document
        position: Cursor position

    Returns:
        The word at the position, or None
    """
    try:
        lines = doc.source.split("\n")
        if position.line >= len(lines):
            return None

        line = lines[position.line]
        if position.character >= len(line):
            return None

        # Find word boundaries
        start = position.character
        end = position.character

        # Move start backward to word boundary
        while start > 0 and (line[start - 1].isalnum() or line[start - 1] in "_:.$"):
            start -= 1

        # Move end forward to word boundary
        while end < len(line) and (line[end].isalnum() or line[end] in "_:.$"):
            end += 1

        word = line[start:end]
        return word if word else None
    except Exception as e:
        logger.error(f"Error getting word at position: {e}")
        return None


def get_word_range(doc: TextDocument, position: types.Position, word: str) -> types.Range:
    """
    Get the range of a word at a position.

    Args:
        doc: The text document
        position: Cursor position
        word: The word to get range for

    Returns:
        Range covering the word
    """
    try:
        lines = doc.source.split("\n")
        line = lines[position.line]

        # Find word start
        start = position.character
        while start > 0 and (line[start - 1].isalnum() or line[start - 1] in "_:.$"):
            start -= 1

        # Word end is start + length
        end = start + len(word)

        return types.Range(
            start=types.Position(line=position.line, character=start),
            end=types.Position(line=position.line, character=end),
        )
    except Exception:
        # Return single character range as fallback
        return types.Range(
            start=position,
            end=types.Position(line=position.line, character=position.character + 1),
        )


def get_effect_documentation(effect: str) -> str:
    """
    Get documentation for an effect from YAML with fallback to hardcoded.

    Args:
        effect: Effect name

    Returns:
        Markdown-formatted documentation
    """
    # Check if from a mod
    mod_badge = _get_mod_source_badge(effect, "effect")
    
    # Try to load from YAML first
    try:
        doc = get_effect_doc_yaml(effect)
        if doc:
            # Build rich markdown from YAML
            markdown_parts = [f"# Effect: {effect}"]
            
            if doc.get('description'):
                markdown_parts.append(f"\n{doc['description']}")
            
            if doc.get('detail'):
                markdown_parts.append(f"\n\n_{doc['detail']}_")
            
            if doc.get('scopes'):
                scopes_str = ", ".join(doc['scopes'])
                markdown_parts.append(f"\n\n**Valid Scopes:** {scopes_str}")
            
            if doc.get('example'):
                example = doc['example']
                markdown_parts.append(f"\n\n**Example:**\n```ck3\n{example}\n```")
            
            # Add mod badge if from a mod
            if mod_badge:
                markdown_parts.append(mod_badge)
            
            return "\n".join(markdown_parts)
    except Exception as e:
        logger.debug(f"Failed to load effect docs from YAML for {effect}: {e}")
    
    # Fallback to hardcoded basic docs
    effect_docs = {
        "add_gold": "💰 Adds gold to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_gold = 100\n```",
        "add_prestige": "👑 Adds prestige to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_prestige = 500\n```",
        "add_piety": "⛪ Adds piety to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_piety = 200\n```",
        "add_trait": "⚔️ Adds a trait to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_trait = brave\n```",
        "remove_trait": "❌ Removes a trait from a character.\n\n---\n\n📝 **Usage:**\n```ck3\nremove_trait = craven\n```",
        "add_character_flag": "🚩 Sets a flag on a character for tracking state.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_character_flag = my_custom_flag\n```\n\n💡 Check with `has_character_flag`",
        "remove_character_flag": "🏳️ Removes a flag from a character.\n\n---\n\n📝 **Usage:**\n```ck3\nremove_character_flag = my_custom_flag\n```",
        "death": "💀 Kills a character.\n\n---\n\n📝 **Usage:**\n```ck3\ndeath = {\n    death_reason = death_murder\n    killer = scope:assassin\n}\n```",
        "trigger_event": "📜 Triggers an event.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger_event = {\n    id = my_event.001\n    days = { 3 7 }\n}\n```",
        "save_scope_as": "🎯 Saves the current scope for later reference.\n\n---\n\n📝 **Usage:**\n```ck3\nsave_scope_as = my_target\n```\n\n💡 Reference later with `scope:my_target`",
        "save_temporary_scope_as": "⏱️ Saves scope temporarily (within same event).\n\n---\n\n📝 **Usage:**\n```ck3\nsave_temporary_scope_as = temp_char\n```",
        "hidden_effect": "👻 Execute effects without showing tooltips.\n\n---\n\n📝 **Usage:**\n```ck3\nhidden_effect = {\n    add_trait = secret_trait\n}\n```",
        "add_stress": "😰 Increases character stress level.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_stress = 25\n```",
        "stress_impact": "😓 Apply stress based on character traits.\n\n---\n\n📝 **Usage:**\n```ck3\nstress_impact = {\n    brave = minor_stress_loss\n    craven = major_stress_gain\n}\n```",
        "custom_tooltip": "💬 Display custom tooltip text.\n\n---\n\n📝 **Usage:**\n```ck3\ncustom_tooltip = my_tooltip_loc_key\n```",
        "reverse_add_opinion": "💭 Adds opinion FROM target TO current scope.\n\n---\n\n📝 **Usage:**\n```ck3\nreverse_add_opinion = {\n    target = scope:friend\n    modifier = friendly_opinion\n}\n```",
        "set_relation_lover": "❤️ Makes target a lover.\n\n---\n\n📝 **Usage:**\n```ck3\nset_relation_lover = scope:beloved\n```",
        "if": "🔀 Conditional execution block.\n\n---\n\n📝 **Usage:**\n```ck3\nif = {\n    limit = { is_adult = yes }\n    add_gold = 100\n}\n```",
    }

    base_doc = effect_docs.get(
        effect, f"Modifies game state.\n\n---\n\n📝 **Usage:**\n```ck3\n{effect} = <value>\n```"
    )
    return base_doc + mod_badge


def get_trigger_documentation(trigger: str) -> str:
    """
    Get documentation for a trigger from YAML with fallback to hardcoded.

    Args:
        trigger: Trigger name

    Returns:
        Markdown-formatted documentation
    """
    # Check if from a mod
    mod_badge = _get_mod_source_badge(trigger, "trigger")
    
    # Try to load from YAML first
    try:
        doc = get_trigger_doc_yaml(trigger)
        if doc:
            # Build rich markdown from YAML
            markdown_parts = [f"# Trigger: {trigger}"]
            
            if doc.get('description'):
                markdown_parts.append(f"\n{doc['description']}")
            
            if doc.get('detail'):
                markdown_parts.append(f"\n\n_{doc['detail']}_")
            
            if doc.get('scopes'):
                scopes_str = ", ".join(doc['scopes'])
                markdown_parts.append(f"\n\n**Valid Scopes:** {scopes_str}")
            
            if doc.get('example'):
                example = doc['example']
                markdown_parts.append(f"\n\n**Example:**\n```ck3\n{example}\n```")
            
            markdown_parts.append("\n\n↩️ **Returns:** `boolean`")
            
            # Add mod badge if from a mod
            if mod_badge:
                markdown_parts.append(mod_badge)
            
            return "\n".join(markdown_parts)
    except Exception as e:
        logger.debug(f"Failed to load trigger docs from YAML for {trigger}: {e}")
    
    # Fallback to hardcoded basic docs
    trigger_docs = {
        "is_adult": "👤 Checks if character is 16 years or older.\n\n---\n\n📝 **Usage:**\n```ck3\nis_adult = yes\n```\n\n↩️ **Returns:** `boolean`",
        "is_alive": "💚 Checks if character is alive.\n\n---\n\n📝 **Usage:**\n```ck3\nis_alive = yes\n```\n\n↩️ **Returns:** `boolean`",
        "is_ruler": "👑 Checks if character holds any titles.\n\n---\n\n📝 **Usage:**\n```ck3\nis_ruler = yes\n```\n\n↩️ **Returns:** `boolean`",
        "is_female": "♀️ Checks if character is female.\n\n---\n\n📝 **Usage:**\n```ck3\nis_female = yes\n```\n\n↩️ **Returns:** `boolean`",
        "is_male": "♂️ Checks if character is male.\n\n---\n\n📝 **Usage:**\n```ck3\nis_male = yes\n```\n\n↩️ **Returns:** `boolean`",
        "age": "🎂 Compares character age.\n\n---\n\n📝 **Usage:**\n```ck3\nage >= 16\nage < 60\n```\n\n↩️ **Returns:** `boolean`",
        "gold": "💰 Compares character gold amount.\n\n---\n\n📝 **Usage:**\n```ck3\ngold >= 100\n```\n\n↩️ **Returns:** `boolean`",
        "has_trait": "⚔️ Checks if character has a specific trait.\n\n---\n\n📝 **Usage:**\n```ck3\nhas_trait = brave\n```\n\n↩️ **Returns:** `boolean`",
        "has_character_flag": "🚩 Checks if character has a specific flag set.\n\n---\n\n📝 **Usage:**\n```ck3\nhas_character_flag = my_custom_flag\n```\n\n💡 Set with `add_character_flag`\n\n↩️ **Returns:** `boolean`",
        "has_title": "🏰 Checks if character holds a specific title.\n\n---\n\n📝 **Usage:**\n```ck3\nhas_title = title:k_england\n```\n\n↩️ **Returns:** `boolean`",
        "debug_only": "🐛 Only true when game is in debug mode.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger = { debug_only = yes }\n```\n\n💡 Useful for debug options\n\n↩️ **Returns:** `boolean`",
        "any_vassal": "👥 Checks if any vassal meets conditions.\n\n---\n\n📝 **Usage:**\n```ck3\nany_vassal = {\n    has_trait = ambitious\n}\n```\n\n↩️ **Returns:** `boolean`",
        "exists": "❓ Check if a scope/reference exists (not null).\n\n---\n\n📝 **Usage:**\n```ck3\nexists = scope:target\n```\n\n↩️ **Returns:** `boolean`",
        "limit": "🔒 Filtering condition for iterations.\n\n---\n\n📝 **Usage:**\n```ck3\nlimit = {\n    is_adult = yes\n    NOT = { has_trait = incapable }\n}\n```",
        "NOT": "🚫 Inverts the condition (true → false).\n\n---\n\n📝 **Usage:**\n```ck3\nNOT = { is_ruler = yes }\n```",
        "OR": "⚡ At least one condition must be true.\n\n---\n\n📝 **Usage:**\n```ck3\nOR = {\n    has_trait = brave\n    has_trait = ambitious\n}\n```",
        "AND": "🔗 All conditions must be true (default).\n\n---\n\n📝 **Usage:**\n```ck3\nAND = {\n    is_adult = yes\n    is_ruler = yes\n}\n```",
        "trigger": "❓ Trigger block for conditions.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger = {\n    is_adult = yes\n    has_trait = brave\n}\n```",
    }

    base_doc = trigger_docs.get(
        trigger,
        f"Conditional check.\n\n---\n\n📝 **Usage:**\n```ck3\n{trigger} = <value>\n```\n\n↩️ **Returns:** `boolean`",
    )
    return base_doc + mod_badge


def get_context_field_documentation(field: str) -> Optional[str]:
    """
    Get documentation for a context-specific field (option, event, portrait fields).

    Args:
        field: Field name (e.g., 'name', 'custom_tooltip', 'trait', 'animation')

    Returns:
        Markdown-formatted documentation, or None if not a known field
    """
    if field not in CK3_CONTEXT_FIELDS:
        return None

    info = CK3_CONTEXT_FIELDS[field]

    doc = f"{info['description']}\n\n"
    doc += f"---\n\n"
    doc += f"📝 **Usage:**\n```ck3\n{info['usage']}\n```\n\n"

    if info.get("notes"):
        doc += f"💡 **Notes:** {info['notes']}\n\n"

    if info.get("type"):
        type_emoji = {
            "localization_key": "🏷️",
            "localization_key_or_block": "🏷️",
            "trait_id": "⚔️",
            "skill_id": "📊",
            "trigger_block": "❓",
            "block": "📦",
            "ai_weight_block": "🤖",
            "boolean": "✅",
            "scope": "🎯",
            "event_type": "📜",
            "theme_id": "🎨",
            "window_id": "🪟",
            "portrait_block": "👤",
            "effect_block": "⚡",
            "animation_id": "🎬",
            "list": "📋",
            "camera_id": "📷",
        }.get(info["type"], "📌")
        doc += f"{type_emoji} **Type:** `{info['type']}`"

    return doc


def get_scope_documentation(scope: str) -> str:
    """
    Get documentation for a scope link.

    Args:
        scope: Scope link name

    Returns:
        Markdown-formatted documentation
    """
    scope_docs = {
        "root": "🌳 The root scope - the character who triggered this event/effect.\n\n---\n\n🔄 **Type:** Depends on context",
        "this": "📍 The current scope.\n\n---\n\n🔄 **Type:** Same as current",
        "prev": "⬅️ The previous scope in the chain.\n\n---\n\n🔄 **Type:** Depends on context",
        "from": "📨 The calling scope (who triggered this).\n\n---\n\n🔄 **Type:** Depends on context",
        "liege": "👑 Character's feudal superior.\n\n---\n\n🔄 **Type:** `character` → `character`",
        "spouse": "💍 Character's spouse(s).\n\n---\n\n🔄 **Type:** `character` → `character`",
        "father": "👨 Character's legal father.\n\n---\n\n🔄 **Type:** `character` → `character`",
        "mother": "👩 Character's mother.\n\n---\n\n🔄 **Type:** `character` → `character`",
        "primary_title": "🏰 Character's highest-ranking title.\n\n---\n\n🔄 **Type:** `character` → `landed_title`",
        "holder": "🤴 Title holder.\n\n---\n\n🔄 **Type:** `landed_title` → `character`",
    }

    return scope_docs.get(
        scope, f"Scope navigation link.\n\n---\n\n📝 **Usage:**\n```ck3\n{scope} = {{ ... }}\n```"
    )


def get_keyword_documentation(keyword: str) -> str:
    """
    Get documentation for a CK3 keyword.

    Args:
        keyword: Keyword name

    Returns:
        Markdown-formatted documentation
    """
    keyword_docs = {
        "trigger": "❓ Defines conditions that must be met.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger = {\n    is_adult = yes\n    is_ruler = yes\n}\n```\n\n💡 All conditions must be true (implicit AND)",
        "immediate": "⚡ Effects executed immediately when event fires.\n\n---\n\n📝 **Usage:**\n```ck3\nimmediate = {\n    save_scope_as = protagonist\n}\n```\n\n💡 No tooltip shown to player",
        "option": "🎮 Player choice in an event.\n\n---\n\n📝 **Usage:**\n```ck3\noption = {\n    name = my_event.001.a\n    add_gold = 100\n}\n```",
        "if": "🔀 Conditional execution.\n\n---\n\n📝 **Usage:**\n```ck3\nif = {\n    limit = { is_adult = yes }\n    add_gold = 100\n}\n```",
        "else_if": "🔀 Alternative condition.\n\n---\n\n📝 **Usage:**\n```ck3\nelse_if = {\n    limit = { is_child = yes }\n    add_gold = 10\n}\n```",
        "else": "🔀 Default case.\n\n---\n\n📝 **Usage:**\n```ck3\nelse = {\n    add_gold = 50\n}\n```",
        "limit": "🔒 Filtering condition.\n\n---\n\n📝 **Usage:**\n```ck3\nlimit = {\n    is_adult = yes\n}\n```\n\n💡 Used with list iterations and conditionals",
        "desc": "📝 Event description text.\n\n---\n\n📝 **Usage:**\n```ck3\ndesc = my_event.001.desc\n```\n\n💡 Can be a simple key or complex triggered_desc block",
        "namespace": "📁 Groups related events under a common identifier.\n\n---\n\n📝 **Usage:**\n```ck3\nnamespace = my_mod_events\n```",
    }

    return keyword_docs.get(
        keyword,
        f"CK3 scripting keyword.\n\n---\n\n📝 **Usage:**\n```ck3\n{keyword} = {{ ... }}\n```",
    )


def get_hover_content(
    word: str, node: Optional[CK3Node], index: Optional[DocumentIndex]
) -> Optional[str]:
    """
    Generate markdown hover content for a symbol.

    Args:
        word: The word to provide hover for
        node: AST node at cursor position (optional)
        index: Document index (optional)

    Returns:
        Markdown-formatted hover content, or None if no documentation available
    """
    if not word:
        return None

    # Check if it's a namespace (word appears in index.namespaces)
    if index and word in index.namespaces:
        events = index.get_events_for_namespace(word)

        doc = f"## 📁 `{word}`\n\n**🔷 Event Namespace** — *{len(events)} events*\n\n---\n\n"

        if events:
            doc += "📜 **Events in this namespace:**\n\n"
            doc += "| Event ID | Title |\n|----------|-------|\n"

            # Show up to 25 events (to avoid huge hovers)
            display_events = events[:25]
            for event_id in display_events:
                title = index.get_event_localized_title(event_id)
                if title:
                    # Clean up title text for table display
                    title = title.replace("\n", " ").replace("|", "\\|")
                    if len(title) > 60:
                        title = title[:57] + "..."
                else:
                    title = "*No localized title*"
                doc += f"| `{event_id}` | {title} |\n"

            if len(events) > 25:
                doc += f"\n*... and {len(events) - 25} more events*\n"
        else:
            doc += "*No events indexed for this namespace yet*\n"

        # Show file location
        file_uri = index.namespaces[word]
        filename = file_uri.split("/")[-1]
        doc += f"\n---\n\n📂 **Defined in:** `{filename}`"

        return doc

    # Check if it's an event ID (format: namespace.number like rq_nts_daughter.0001)
    if "." in word and index:
        parts = word.split(".")
        if len(parts) == 2 and parts[1].isdigit():
            # This looks like an event ID
            event_loc = index.find_event(word)
            if event_loc:
                title = index.get_event_localized_title(word)
                filename = event_loc.uri.split("/")[-1]
                line_num = event_loc.range.start.line + 1

                doc = f"## 📜 `{word}`\n\n**🔵 Event** — *Character Event*\n\n---\n\n"

                if title:
                    # Clean up title for display
                    display_title = title.replace("\\n", "\n").replace("#N", "\n")
                    doc += f"📝 **Title:**\n> {display_title}\n\n---\n\n"

                # Try to get the description too
                desc_key = f"{word}.desc"
                desc_info = index.find_localization(desc_key)
                if desc_info:
                    desc_text, _, _ = desc_info
                    desc_text = desc_text.replace("\\n", "\n").replace("#N", "\n")
                    if len(desc_text) > 300:
                        desc_text = desc_text[:297] + "..."
                    doc += f"📖 **Description:**\n> {desc_text}\n\n---\n\n"

                doc += f"📂 **Defined in:** `{filename}`\n\n📍 **Line:** {line_num}\n\n💡 *Ctrl+Click to go to definition*"

                return doc

    # Check if it's a localization key (contains dots like event.0001.a or event.0001.a.tt)
    if "." in word and index:
        loc_info = index.find_localization(word)
        if loc_info:
            text, file_uri, line_num = loc_info
            filename = file_uri.split("/")[-1]
            # Handle CK3 escape sequences
            display_text = text.replace("\\n", "\n").replace("#N", "\n")
            # Truncate if too long
            if len(display_text) > 500:
                display_text = display_text[:500] + "..."
            # Format paragraphs properly for Markdown blockquote
            # Each line in a blockquote needs its own > prefix
            paragraphs = display_text.split("\n\n")
            formatted_paragraphs = []
            for para in paragraphs:
                # Replace single newlines with spaces within a paragraph
                para = para.replace("\n", " ").strip()
                if para:
                    formatted_paragraphs.append(f"> {para}")
            formatted_text = "\n>\n".join(formatted_paragraphs)
            return f"## 🏷️ `{word}`\n\n**🌐 Localization Key**\n\n---\n\n📝 **Text:**\n\n{formatted_text}\n\n---\n\n📂 **File:** `{filename}`\n\n📍 **Line:** {line_num + 1}"

    # Check if it's a character flag (custom mod flags)
    if index and word in index.character_flags:
        flag_usages = index.character_flags[word]

        # Count usages by type
        set_count = sum(1 for u in flag_usages if u[0] == "set")
        check_count = sum(1 for u in flag_usages if u[0] == "check")
        remove_count = sum(1 for u in flag_usages if u[0] == "remove")

        # Find first set location (definition)
        first_set = next((u for u in flag_usages if u[0] == "set"), None)

        doc = f"## 🚩 `{word}`\n\n**🔶 Character Flag** — *Mod-defined*\n\n---\n\n"
        doc += f"📊 **Usage Statistics:**\n"
        doc += f"- 🟢 Set: {set_count} time(s)\n"
        doc += f"- 🔵 Checked: {check_count} time(s)\n"
        if remove_count > 0:
            doc += f"- 🔴 Removed: {remove_count} time(s)\n"

        doc += f"\n---\n\n📝 **Usage:**\n```ck3\n# Set the flag\nadd_character_flag = {word}\n\n# Check the flag\nhas_character_flag = {word}\n```\n"

        if first_set:
            action, file_uri, line_num = first_set
            filename = file_uri.split("/")[-1]
            doc += f"\n---\n\n📂 **First defined in:** `{filename}`\n\n📍 **Line:** {line_num + 1}"

        return doc

    # Check if it's a decision group type
    if index and word in index.decision_group_types:
        loc = index.decision_group_types[word]
        filename = loc.uri.split("/")[-1]
        line_num = loc.range.start.line + 1

        # Find decisions that reference this group
        refs = index.find_decision_group_type_references(word)

        # Check localization first for the title
        loc_key = f"decision_group_type_{word}"
        loc_info = index.find_localization(loc_key)
        
        # Build header with localized title if available
        if loc_info:
            loc_text, loc_file, loc_line = loc_info
            # Clean up loc text for display
            display_title = loc_text.replace("\\n", " ").strip()
            if len(display_title) > 80:
                display_title = display_title[:77] + "..."
            doc = f"## 📋 {display_title}\n\n"
            doc += f"**🔷 Decision Group Type** `{word}`\n\n"
            doc += f"🏷️ **Localization:** `{loc_key}` = \"{display_title}\" ✅\n\n---\n\n"
        else:
            doc = f"## 📋 `{word}`\n\n"
            doc += f"**🔷 Decision Group Type** — *Collapsible category in decision panel*\n\n"
            doc += f"⚠️ **Missing localization:** `{loc_key}`\n\n"
            doc += f"*UI will display raw key name until localization is added*\n\n---\n\n"

        # Show referencing decisions
        if refs:
            doc += f"### 📜 Decisions in this group ({len(refs)})\n\n"
            doc += "| Decision | File |\n|----------|------|\n"

            # Show up to 15 decisions
            display_refs = refs[:15]
            for ref in display_refs:
                decision_name = ref.get("context", "unknown")
                ref_file = ref.get("uri", "").split("/")[-1]
                doc += f"| `{decision_name}` | {ref_file} |\n"

            if len(refs) > 15:
                doc += f"\n*... and {len(refs) - 15} more decisions*\n"
        else:
            doc += "📭 *No decisions currently use this group*\n"

        doc += f"\n---\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {line_num}\n\n💡 *Ctrl+Click to go to definition*"

        return doc

    # Check if it's a context-specific field (option fields, event fields, portrait fields)
    # This should be checked early as these are common fields users will hover over
    context_doc = get_context_field_documentation(word)
    if context_doc:
        # Determine the category for display with emoji
        from pychivalry.ck3.language import CK3_OPTION_FIELDS, CK3_EVENT_FIELDS, CK3_PORTRAIT_FIELDS

        if word in CK3_OPTION_FIELDS:
            category = "🎮 Option Field"
            color_bar = "🟢"
        elif word in CK3_EVENT_FIELDS:
            category = "📜 Event Field"
            color_bar = "🔵"
        elif word in CK3_PORTRAIT_FIELDS:
            category = "👤 Portrait Field"
            color_bar = "🟣"
        elif word in CK3_STORY_CYCLE_FIELDS:
            category = "📖 Story Cycle Field"
            color_bar = "🟠"
        else:
            category = "📌 Script Field"
            color_bar = "⚪"
        return f"## {color_bar} `{word}`\n\n**{category}**\n\n{context_doc}"

    # Check if it's a list iterator (any_, every_, random_, ordered_) FIRST
    # This must come before scope checking since some list iterators are also in scope lists
    for prefix in ["any_", "every_", "random_", "ordered_"]:
        if word.startswith(prefix):
            base = word[len(prefix) :]
            type_info = {
                "any_": ("❓", "Returns true if ANY item matches conditions", "Trigger"),
                "every_": ("🔄", "Executes effects on EVERY item", "Effect"),
                "random_": ("🎲", "Executes effects on ONE random item", "Effect"),
                "ordered_": ("📊", "Executes effects on items in sorted order", "Effect"),
            }
            emoji, desc, category = type_info[prefix]
            return f"## 🔁 `{word}`\n\n**{emoji} List Iterator** — *{category}*\n\n{desc}\n\n---\n\n🎯 **Base list:** `{base}`\n\n📝 **Usage:**\n```ck3\n{word} = {{\n    limit = {{ <conditions> }}\n    <effects>\n}}\n```"

    # Check if it's a known effect
    if word in CK3_EFFECTS:
        return f"## ⚡ `{word}`\n\n**🟠 Effect** — *Modifies game state*\n\n{get_effect_documentation(word)}"

    # Check if it's a custom scripted effect from workspace
    if index and word in index.scripted_effects:
        loc = index.scripted_effects[word]
        filename = loc.uri.split("/")[-1]
        return f"## ⚡ `{word}`\n\n**🟧 Custom Scripted Effect** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\n{word} = yes\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's a known trigger
    if word in CK3_TRIGGERS:
        return f"## ❓ `{word}`\n\n**🟡 Trigger** — *Conditional check*\n\n{get_trigger_documentation(word)}"

    # Check if it's a custom scripted trigger from workspace
    if index and word in index.scripted_triggers:
        loc = index.scripted_triggers[word]
        filename = loc.uri.split("/")[-1]
        return f"## ❓ `{word}`\n\n**🟨 Custom Scripted Trigger** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\n{word} = yes\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's a trait (with extracted trait data)
    from pychivalry.ck3.validation.traits import is_trait_data_available, is_valid_trait, get_trait_info
    
    if is_trait_data_available() and is_valid_trait(word):
        trait_info = get_trait_info(word)
        if trait_info:
            # Build comprehensive trait documentation
            category = trait_info.get('category', 'trait')
            description = trait_info.get('description', word.replace('_', ' ').title())
            opposites = trait_info.get('opposites', [])
            
            doc = f"## ⚔️ `{word}`\n\n**🟢 Trait** — *{category.replace('_', ' ').title()}*\n\n---\n\n"
            doc += f"📝 **Description:** {description}\n\n"
            
            if opposites:
                doc += f"⚠️ **Opposite Traits:** {', '.join(opposites)}\n\n"
            
            # Add skill bonuses
            skills = trait_info.get('skills', {})
            if skills:
                doc += "**📊 Skills:**\n"
                for skill, value in skills.items():
                    sign = '+' if value > 0 else ''
                    doc += f"- {skill.capitalize()}: {sign}{value}\n"
                doc += "\n"
            
            # Add opinion modifiers
            opinions = trait_info.get('opinions', {})
            if opinions:
                doc += "**💭 Opinion Modifiers:**\n"
                for opinion_type, value in list(opinions.items())[:5]:  # Show first 5
                    sign = '+' if value > 0 else ''
                    opinion_label = opinion_type.replace('_', ' ').title()
                    doc += f"- {opinion_label}: {sign}{value}\n"
                if len(opinions) > 5:
                    doc += f"- *... and {len(opinions) - 5} more*\n"
                doc += "\n"
            
            # Add lifestyle XP gains
            xp_gains = trait_info.get('lifestyle_xp_gains', {})
            if xp_gains:
                doc += "**✨ Lifestyle XP:**\n"
                for lifestyle, mult in xp_gains.items():
                    sign = '+' if mult > 0 else ''
                    doc += f"- {lifestyle.capitalize()}: {sign}{mult*100:.0f}%/month\n"
                doc += "\n"
            
            # Add ruler designer cost
            cost = trait_info.get('ruler_designer_cost')
            if cost is not None:
                doc += f"**💰 Ruler Designer Cost:** {cost} points\n\n"
            
            # Add key flags
            flags = trait_info.get('flags', [])
            if flags:
                interesting_flags = [f for f in flags if not f.startswith('level_')][:3]
                if interesting_flags:
                    doc += "**🚩 Flags:**\n"
                    for flag in interesting_flags:
                        doc += f"- {flag.replace('_', ' ')}\n"
                    doc += "\n"
            
            # Add key modifiers
            modifiers = trait_info.get('modifiers', {})
            if modifiers:
                mod_list = list(modifiers.items())[:3]
                if mod_list:
                    doc += "**📈 Modifiers:**\n"
                    for mod_name, mod_value in mod_list:
                        sign = '+' if mod_value > 0 else ''
                        mod_label = mod_name.replace('_', ' ').title()
                        # Format as percentage if it's a mult
                        if 'mult' in mod_name:
                            doc += f"- {mod_label}: {sign}{mod_value*100:.0f}%\n"
                        else:
                            doc += f"- {mod_label}: {sign}{mod_value}\n"
                    doc += "\n"
            
            doc += "---\n\n"
            doc += "📝 **Usage:**\n```ck3\nhas_trait = " + word + "\nadd_trait = " + word + "\nremove_trait = " + word + "\n```"
            
            return doc

    # Check if it's a character interaction from workspace
    if index and word in index.character_interactions:
        loc = index.character_interactions[word]
        filename = loc.uri.split("/")[-1]
        return f"## 🤝 `{word}`\n\n**🟦 Character Interaction** — *Mod-defined*\n\n---\n\n📝 **Usage (in script):**\n```ck3\nopen_interaction_window = {{\n    interaction = {word}\n    actor = root\n    recipient = scope:target\n}}\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's a modifier from workspace
    if index and word in index.modifiers:
        loc = index.modifiers[word]
        filename = loc.uri.split("/")[-1]
        return f"## 📊 `{word}`\n\n**🟩 Modifier** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\nadd_character_modifier = {{\n    modifier = {word}\n    years = 5\n}}\n# Or check:\nhas_character_modifier = {word}\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's an on_action from workspace
    if index and word in index.on_action_definitions:
        loc = index.on_action_definitions[word]
        filename = loc.uri.split("/")[-1]
        return f"## 🎬 `{word}`\n\n**🟪 On Action** — *Mod-defined*\n\n---\n\nEvents in this on_action fire automatically when the game triggers `{word}`.\n\n📝 **Hooks into game event:** `{word}`\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's an opinion modifier from workspace
    if index and word in index.opinion_modifiers:
        loc = index.opinion_modifiers[word]
        filename = loc.uri.split("/")[-1]
        return f"## 💭 `{word}`\n\n**🟫 Opinion Modifier** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\nadd_opinion = {{\n    target = scope:target\n    modifier = {word}\n}}\n# Or check:\nhas_opinion_modifier = {{\n    target = scope:target\n    modifier = {word}\n}}\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's a scripted GUI from workspace
    if index and word in index.scripted_guis:
        loc = index.scripted_guis[word]
        filename = loc.uri.split("/")[-1]
        return f"## 🖼️ `{word}`\n\n**🔲 Scripted GUI** — *Mod-defined*\n\n---\n\nA scripted GUI button/toggle for use in GUI files.\n\n📝 **Usage (in .gui files):**\n```gui\nonclick = \"[GetScriptedGui('{word}').Execute(...)]\"\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"

    # Check if it's a scope link
    if word in CK3_SCOPES or word in get_scope_links("character"):
        return f"## 🎯 `{word}`\n\n**🔷 Scope Link** — *Navigate to related scope*\n\n{get_scope_documentation(word)}"

    # Check if it's a keyword
    if word in CK3_KEYWORDS:
        return f"## 🔑 `{word}`\n\n**🟣 Keyword** — *CK3 script structure*\n\n{get_keyword_documentation(word)}"

    # Check if it's an event in the index
    if index and word in index.events:
        loc = index.events[word]
        # Extract filename from URI
        filename = loc.uri.split("/")[-1]
        return f"## 📜 `{word}`\n\n**🟢 Event Definition**\n\n---\n\n📂 **File:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}"

    # Check if it's a saved scope reference (scope:xxx)
    if word.startswith("scope:"):
        scope_name = word[6:]
        if index and scope_name in index.saved_scopes:
            loc = index.saved_scopes[scope_name]
            filename = loc.uri.split("/")[-1]
            return f"## 🎯 `{word}`\n\n**🔵 Saved Scope Reference**\n\n---\n\n✅ Defined with `save_scope_as = {scope_name}`\n\n📂 **Location:** `{filename}:{loc.range.start.line + 1}`"
        else:
            return f"## 🎯 `{word}`\n\n**🔴 Saved Scope Reference**\n\n---\n\n⚠️ **Warning:** This scope has not been defined!\n\n💡 Use `save_scope_as = {scope_name}` to define it."

    # No documentation available
    return None


def create_hover_response(
    doc: TextDocument, position: types.Position, ast: list[CK3Node], index: Optional[DocumentIndex]
) -> Optional[types.Hover]:
    """
    Create a hover response for a position in a document.

    Args:
        doc: The text document
        position: Cursor position
        ast: Parsed AST
        index: Document index (optional)

    Returns:
        Hover response with documentation, or None if no hover available
    """
    # Get word at cursor position
    word = get_word_at_position(doc, position)
    if not word:
        return None

    # Get AST node at position (for context)
    node = get_node_at_position(ast, position)

    # Build hover content
    content = get_hover_content(word, node, index)
    if not content:
        return None

    # Create hover response
    return types.Hover(
        contents=types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value=content,
        ),
        range=get_word_range(doc, position, word),
    )
