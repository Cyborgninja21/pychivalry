"""
Hover documentation module for CK3 language server.

This module provides hover information for CK3 constructs, including:
- Effects: What they do and their parameters
- Triggers: Conditions and valid values
- Scopes: Navigation targets and types
- Events: Type and location information
- Saved scopes: Where they were defined

Hover content is formatted as Markdown for rich display in the editor.
"""

from typing import Optional
from lsprotocol import types
from pygls.workspace import TextDocument
import re

from .parser import CK3Node, get_node_at_position
from .indexer import DocumentIndex
from .ck3_language import CK3_EFFECTS, CK3_TRIGGERS, CK3_SCOPES, CK3_KEYWORDS, CK3_CONTEXT_FIELDS
from .scopes import get_scope_links, get_available_scope_types
import logging

logger = logging.getLogger(__name__)


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
        lines = doc.source.split('\n')
        if position.line >= len(lines):
            return None
        
        line = lines[position.line]
        if position.character >= len(line):
            return None
        
        # Find word boundaries
        start = position.character
        end = position.character
        
        # Move start backward to word boundary
        while start > 0 and (line[start - 1].isalnum() or line[start - 1] in '_:.$'):
            start -= 1
        
        # Move end forward to word boundary
        while end < len(line) and (line[end].isalnum() or line[end] in '_:.$'):
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
        lines = doc.source.split('\n')
        line = lines[position.line]
        
        # Find word start
        start = position.character
        while start > 0 and (line[start - 1].isalnum() or line[start - 1] in '_:.$'):
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
    Get documentation for an effect.
    
    Args:
        effect: Effect name
        
    Returns:
        Markdown-formatted documentation
    """
    # Basic documentation - can be expanded from data files
    effect_docs = {
        'add_gold': '💰 Adds gold to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_gold = 100\n```',
        'add_prestige': '👑 Adds prestige to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_prestige = 500\n```',
        'add_piety': '⛪ Adds piety to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_piety = 200\n```',
        'add_trait': '⚔️ Adds a trait to a character.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_trait = brave\n```',
        'remove_trait': '❌ Removes a trait from a character.\n\n---\n\n📝 **Usage:**\n```ck3\nremove_trait = craven\n```',
        'add_character_flag': '🚩 Sets a flag on a character for tracking state.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_character_flag = my_custom_flag\n```\n\n💡 Check with `has_character_flag`',
        'remove_character_flag': '🏳️ Removes a flag from a character.\n\n---\n\n📝 **Usage:**\n```ck3\nremove_character_flag = my_custom_flag\n```',
        'death': '💀 Kills a character.\n\n---\n\n📝 **Usage:**\n```ck3\ndeath = {\n    death_reason = death_murder\n    killer = scope:assassin\n}\n```',
        'trigger_event': '📜 Triggers an event.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger_event = {\n    id = my_event.001\n    days = { 3 7 }\n}\n```',
        'save_scope_as': '🎯 Saves the current scope for later reference.\n\n---\n\n📝 **Usage:**\n```ck3\nsave_scope_as = my_target\n```\n\n💡 Reference later with `scope:my_target`',
        'save_temporary_scope_as': '⏱️ Saves scope temporarily (within same event).\n\n---\n\n📝 **Usage:**\n```ck3\nsave_temporary_scope_as = temp_char\n```',
        'hidden_effect': '👻 Execute effects without showing tooltips.\n\n---\n\n📝 **Usage:**\n```ck3\nhidden_effect = {\n    add_trait = secret_trait\n}\n```',
        'add_stress': '😰 Increases character stress level.\n\n---\n\n📝 **Usage:**\n```ck3\nadd_stress = 25\n```',
        'stress_impact': '😓 Apply stress based on character traits.\n\n---\n\n📝 **Usage:**\n```ck3\nstress_impact = {\n    brave = minor_stress_loss\n    craven = major_stress_gain\n}\n```',
        'custom_tooltip': '💬 Display custom tooltip text.\n\n---\n\n📝 **Usage:**\n```ck3\ncustom_tooltip = my_tooltip_loc_key\n```',
        'reverse_add_opinion': '💭 Adds opinion FROM target TO current scope.\n\n---\n\n📝 **Usage:**\n```ck3\nreverse_add_opinion = {\n    target = scope:friend\n    modifier = friendly_opinion\n}\n```',
        'set_relation_lover': '❤️ Makes target a lover.\n\n---\n\n📝 **Usage:**\n```ck3\nset_relation_lover = scope:beloved\n```',
        'if': '🔀 Conditional execution block.\n\n---\n\n📝 **Usage:**\n```ck3\nif = {\n    limit = { is_adult = yes }\n    add_gold = 100\n}\n```',
    }
    
    return effect_docs.get(effect, f'Modifies game state.\n\n---\n\n📝 **Usage:**\n```ck3\n{effect} = <value>\n```')


def get_trigger_documentation(trigger: str) -> str:
    """
    Get documentation for a trigger.
    
    Args:
        trigger: Trigger name
        
    Returns:
        Markdown-formatted documentation
    """
    trigger_docs = {
        'is_adult': '👤 Checks if character is 16 years or older.\n\n---\n\n📝 **Usage:**\n```ck3\nis_adult = yes\n```\n\n↩️ **Returns:** `boolean`',
        'is_alive': '💚 Checks if character is alive.\n\n---\n\n📝 **Usage:**\n```ck3\nis_alive = yes\n```\n\n↩️ **Returns:** `boolean`',
        'is_ruler': '👑 Checks if character holds any titles.\n\n---\n\n📝 **Usage:**\n```ck3\nis_ruler = yes\n```\n\n↩️ **Returns:** `boolean`',
        'is_female': '♀️ Checks if character is female.\n\n---\n\n📝 **Usage:**\n```ck3\nis_female = yes\n```\n\n↩️ **Returns:** `boolean`',
        'is_male': '♂️ Checks if character is male.\n\n---\n\n📝 **Usage:**\n```ck3\nis_male = yes\n```\n\n↩️ **Returns:** `boolean`',
        'age': '🎂 Compares character age.\n\n---\n\n📝 **Usage:**\n```ck3\nage >= 16\nage < 60\n```\n\n↩️ **Returns:** `boolean`',
        'gold': '💰 Compares character gold amount.\n\n---\n\n📝 **Usage:**\n```ck3\ngold >= 100\n```\n\n↩️ **Returns:** `boolean`',
        'has_trait': '⚔️ Checks if character has a specific trait.\n\n---\n\n📝 **Usage:**\n```ck3\nhas_trait = brave\n```\n\n↩️ **Returns:** `boolean`',
        'has_character_flag': '🚩 Checks if character has a specific flag set.\n\n---\n\n📝 **Usage:**\n```ck3\nhas_character_flag = my_custom_flag\n```\n\n💡 Set with `add_character_flag`\n\n↩️ **Returns:** `boolean`',
        'has_title': '🏰 Checks if character holds a specific title.\n\n---\n\n📝 **Usage:**\n```ck3\nhas_title = title:k_england\n```\n\n↩️ **Returns:** `boolean`',
        'debug_only': '🐛 Only true when game is in debug mode.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger = { debug_only = yes }\n```\n\n💡 Useful for debug options\n\n↩️ **Returns:** `boolean`',
        'any_vassal': '👥 Checks if any vassal meets conditions.\n\n---\n\n📝 **Usage:**\n```ck3\nany_vassal = {\n    has_trait = ambitious\n}\n```\n\n↩️ **Returns:** `boolean`',
        'exists': '❓ Check if a scope/reference exists (not null).\n\n---\n\n📝 **Usage:**\n```ck3\nexists = scope:target\n```\n\n↩️ **Returns:** `boolean`',
        'limit': '🔒 Filtering condition for iterations.\n\n---\n\n📝 **Usage:**\n```ck3\nlimit = {\n    is_adult = yes\n    NOT = { has_trait = incapable }\n}\n```',
        'NOT': '🚫 Inverts the condition (true → false).\n\n---\n\n📝 **Usage:**\n```ck3\nNOT = { is_ruler = yes }\n```',
        'OR': '⚡ At least one condition must be true.\n\n---\n\n📝 **Usage:**\n```ck3\nOR = {\n    has_trait = brave\n    has_trait = ambitious\n}\n```',
        'AND': '🔗 All conditions must be true (default).\n\n---\n\n📝 **Usage:**\n```ck3\nAND = {\n    is_adult = yes\n    is_ruler = yes\n}\n```',
        'trigger': '❓ Trigger block for conditions.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger = {\n    is_adult = yes\n    has_trait = brave\n}\n```',
    }
    
    return trigger_docs.get(trigger, f'Conditional check.\n\n---\n\n📝 **Usage:**\n```ck3\n{trigger} = <value>\n```\n\n↩️ **Returns:** `boolean`')


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
    
    if info.get('notes'):
        doc += f"💡 **Notes:** {info['notes']}\n\n"
    
    if info.get('type'):
        type_emoji = {
            'localization_key': '🏷️',
            'localization_key_or_block': '🏷️',
            'trait_id': '⚔️',
            'skill_id': '📊',
            'trigger_block': '❓',
            'block': '📦',
            'ai_weight_block': '🤖',
            'boolean': '✅',
            'scope': '🎯',
            'event_type': '📜',
            'theme_id': '🎨',
            'window_id': '🪟',
            'portrait_block': '👤',
            'effect_block': '⚡',
            'animation_id': '🎬',
            'list': '📋',
            'camera_id': '📷',
        }.get(info['type'], '📌')
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
        'root': '🌳 The root scope - the character who triggered this event/effect.\n\n---\n\n🔄 **Type:** Depends on context',
        'this': '📍 The current scope.\n\n---\n\n🔄 **Type:** Same as current',
        'prev': '⬅️ The previous scope in the chain.\n\n---\n\n🔄 **Type:** Depends on context',
        'from': '📨 The calling scope (who triggered this).\n\n---\n\n🔄 **Type:** Depends on context',
        'liege': '👑 Character\'s feudal superior.\n\n---\n\n🔄 **Type:** `character` → `character`',
        'spouse': '💍 Character\'s spouse(s).\n\n---\n\n🔄 **Type:** `character` → `character`',
        'father': '👨 Character\'s legal father.\n\n---\n\n🔄 **Type:** `character` → `character`',
        'mother': '👩 Character\'s mother.\n\n---\n\n🔄 **Type:** `character` → `character`',
        'primary_title': '🏰 Character\'s highest-ranking title.\n\n---\n\n🔄 **Type:** `character` → `landed_title`',
        'holder': '🤴 Title holder.\n\n---\n\n🔄 **Type:** `landed_title` → `character`',
    }
    
    return scope_docs.get(scope, f'Scope navigation link.\n\n---\n\n📝 **Usage:**\n```ck3\n{scope} = {{ ... }}\n```')


def get_keyword_documentation(keyword: str) -> str:
    """
    Get documentation for a CK3 keyword.
    
    Args:
        keyword: Keyword name
        
    Returns:
        Markdown-formatted documentation
    """
    keyword_docs = {
        'trigger': '❓ Defines conditions that must be met.\n\n---\n\n📝 **Usage:**\n```ck3\ntrigger = {\n    is_adult = yes\n    is_ruler = yes\n}\n```\n\n💡 All conditions must be true (implicit AND)',
        'immediate': '⚡ Effects executed immediately when event fires.\n\n---\n\n📝 **Usage:**\n```ck3\nimmediate = {\n    save_scope_as = protagonist\n}\n```\n\n💡 No tooltip shown to player',
        'option': '🎮 Player choice in an event.\n\n---\n\n📝 **Usage:**\n```ck3\noption = {\n    name = my_event.001.a\n    add_gold = 100\n}\n```',
        'if': '🔀 Conditional execution.\n\n---\n\n📝 **Usage:**\n```ck3\nif = {\n    limit = { is_adult = yes }\n    add_gold = 100\n}\n```',
        'else_if': '🔀 Alternative condition.\n\n---\n\n📝 **Usage:**\n```ck3\nelse_if = {\n    limit = { is_child = yes }\n    add_gold = 10\n}\n```',
        'else': '🔀 Default case.\n\n---\n\n📝 **Usage:**\n```ck3\nelse = {\n    add_gold = 50\n}\n```',
        'limit': '🔒 Filtering condition.\n\n---\n\n📝 **Usage:**\n```ck3\nlimit = {\n    is_adult = yes\n}\n```\n\n💡 Used with list iterations and conditionals',
        'desc': '📝 Event description text.\n\n---\n\n📝 **Usage:**\n```ck3\ndesc = my_event.001.desc\n```\n\n💡 Can be a simple key or complex triggered_desc block',
        'namespace': '📁 Groups related events under a common identifier.\n\n---\n\n📝 **Usage:**\n```ck3\nnamespace = my_mod_events\n```',
    }
    
    return keyword_docs.get(keyword, f'CK3 scripting keyword.\n\n---\n\n📝 **Usage:**\n```ck3\n{keyword} = {{ ... }}\n```')


def get_hover_content(
    word: str,
    node: Optional[CK3Node],
    index: Optional[DocumentIndex]
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
                    title = title.replace('\n', ' ').replace('|', '\\|')
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
        filename = file_uri.split('/')[-1]
        doc += f"\n---\n\n📂 **Defined in:** `{filename}`"
        
        return doc
    
    # Check if it's an event ID (format: namespace.number like rq_nts_daughter.0001)
    if '.' in word and index:
        parts = word.split('.')
        if len(parts) == 2 and parts[1].isdigit():
            # This looks like an event ID
            event_loc = index.find_event(word)
            if event_loc:
                title = index.get_event_localized_title(word)
                filename = event_loc.uri.split('/')[-1]
                line_num = event_loc.range.start.line + 1
                
                doc = f"## 📜 `{word}`\n\n**🔵 Event** — *Character Event*\n\n---\n\n"
                
                if title:
                    # Clean up title for display
                    display_title = title.replace('\\n', '\n').replace('#N', '\n')
                    doc += f"📝 **Title:**\n> {display_title}\n\n---\n\n"
                
                # Try to get the description too
                desc_key = f"{word}.desc"
                desc_info = index.find_localization(desc_key)
                if desc_info:
                    desc_text, _, _ = desc_info
                    desc_text = desc_text.replace('\\n', '\n').replace('#N', '\n')
                    if len(desc_text) > 300:
                        desc_text = desc_text[:297] + "..."
                    doc += f"📖 **Description:**\n> {desc_text}\n\n---\n\n"
                
                doc += f"📂 **Defined in:** `{filename}`\n\n📍 **Line:** {line_num}\n\n💡 *Ctrl+Click to go to definition*"
                
                return doc
    
    # Check if it's a localization key (contains dots like event.0001.a or event.0001.a.tt)
    if '.' in word and index:
        loc_info = index.find_localization(word)
        if loc_info:
            text, file_uri, line_num = loc_info
            filename = file_uri.split('/')[-1]
            # Escape any special markdown characters in the text
            # Also handle CK3 special tokens like [character.GetName]
            display_text = text.replace('\\n', '\n').replace('#N', '\n')
            # Truncate if too long
            if len(display_text) > 500:
                display_text = display_text[:500] + "..."
            return f"## 🏷️ `{word}`\n\n**🌐 Localization Key**\n\n---\n\n📝 **Text:**\n> {display_text}\n\n---\n\n📂 **File:** `{filename}`\n\n📍 **Line:** {line_num + 1}"
    
    # Check if it's a character flag (custom mod flags)
    if index and word in index.character_flags:
        flag_usages = index.character_flags[word]
        
        # Count usages by type
        set_count = sum(1 for u in flag_usages if u[0] == 'set')
        check_count = sum(1 for u in flag_usages if u[0] == 'check')
        remove_count = sum(1 for u in flag_usages if u[0] == 'remove')
        
        # Find first set location (definition)
        first_set = next((u for u in flag_usages if u[0] == 'set'), None)
        
        doc = f"## 🚩 `{word}`\n\n**🔶 Character Flag** — *Mod-defined*\n\n---\n\n"
        doc += f"📊 **Usage Statistics:**\n"
        doc += f"- 🟢 Set: {set_count} time(s)\n"
        doc += f"- 🔵 Checked: {check_count} time(s)\n"
        if remove_count > 0:
            doc += f"- 🔴 Removed: {remove_count} time(s)\n"
        
        doc += f"\n---\n\n📝 **Usage:**\n```ck3\n# Set the flag\nadd_character_flag = {word}\n\n# Check the flag\nhas_character_flag = {word}\n```\n"
        
        if first_set:
            action, file_uri, line_num = first_set
            filename = file_uri.split('/')[-1]
            doc += f"\n---\n\n📂 **First defined in:** `{filename}`\n\n📍 **Line:** {line_num + 1}"
        
        return doc
    
    # Check if it's a context-specific field (option fields, event fields, portrait fields)
    # This should be checked early as these are common fields users will hover over
    context_doc = get_context_field_documentation(word)
    if context_doc:
        # Determine the category for display with emoji
        from .ck3_language import CK3_OPTION_FIELDS, CK3_EVENT_FIELDS, CK3_PORTRAIT_FIELDS
        if word in CK3_OPTION_FIELDS:
            category = "🎮 Option Field"
            color_bar = "🟢"
        elif word in CK3_EVENT_FIELDS:
            category = "📜 Event Field"
            color_bar = "🔵"
        elif word in CK3_PORTRAIT_FIELDS:
            category = "👤 Portrait Field"
            color_bar = "🟣"
        else:
            category = "📌 Script Field"
            color_bar = "⚪"
        return f"## {color_bar} `{word}`\n\n**{category}**\n\n{context_doc}"
    
    # Check if it's a list iterator (any_, every_, random_, ordered_) FIRST
    # This must come before scope checking since some list iterators are also in scope lists
    for prefix in ['any_', 'every_', 'random_', 'ordered_']:
        if word.startswith(prefix):
            base = word[len(prefix):]
            type_info = {
                'any_': ('❓', 'Returns true if ANY item matches conditions', 'Trigger'),
                'every_': ('🔄', 'Executes effects on EVERY item', 'Effect'),
                'random_': ('🎲', 'Executes effects on ONE random item', 'Effect'),
                'ordered_': ('📊', 'Executes effects on items in sorted order', 'Effect'),
            }
            emoji, desc, category = type_info[prefix]
            return f"## 🔁 `{word}`\n\n**{emoji} List Iterator** — *{category}*\n\n{desc}\n\n---\n\n🎯 **Base list:** `{base}`\n\n📝 **Usage:**\n```ck3\n{word} = {{\n    limit = {{ <conditions> }}\n    <effects>\n}}\n```"
    
    # Check if it's a known effect
    if word in CK3_EFFECTS:
        return f"## ⚡ `{word}`\n\n**🟠 Effect** — *Modifies game state*\n\n{get_effect_documentation(word)}"
    
    # Check if it's a custom scripted effect from workspace
    if index and word in index.scripted_effects:
        loc = index.scripted_effects[word]
        filename = loc.uri.split('/')[-1]
        return f"## ⚡ `{word}`\n\n**🟧 Custom Scripted Effect** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\n{word} = yes\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's a known trigger
    if word in CK3_TRIGGERS:
        return f"## ❓ `{word}`\n\n**🟡 Trigger** — *Conditional check*\n\n{get_trigger_documentation(word)}"
    
    # Check if it's a custom scripted trigger from workspace
    if index and word in index.scripted_triggers:
        loc = index.scripted_triggers[word]
        filename = loc.uri.split('/')[-1]
        return f"## ❓ `{word}`\n\n**🟨 Custom Scripted Trigger** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\n{word} = yes\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's a character interaction from workspace
    if index and word in index.character_interactions:
        loc = index.character_interactions[word]
        filename = loc.uri.split('/')[-1]
        return f"## 🤝 `{word}`\n\n**🟦 Character Interaction** — *Mod-defined*\n\n---\n\n📝 **Usage (in script):**\n```ck3\nopen_interaction_window = {{\n    interaction = {word}\n    actor = root\n    recipient = scope:target\n}}\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's a modifier from workspace
    if index and word in index.modifiers:
        loc = index.modifiers[word]
        filename = loc.uri.split('/')[-1]
        return f"## 📊 `{word}`\n\n**🟩 Modifier** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\nadd_character_modifier = {{\n    modifier = {word}\n    years = 5\n}}\n# Or check:\nhas_character_modifier = {word}\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's an on_action from workspace
    if index and word in index.on_action_definitions:
        loc = index.on_action_definitions[word]
        filename = loc.uri.split('/')[-1]
        return f"## 🎬 `{word}`\n\n**🟪 On Action** — *Mod-defined*\n\n---\n\nEvents in this on_action fire automatically when the game triggers `{word}`.\n\n📝 **Hooks into game event:** `{word}`\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's an opinion modifier from workspace
    if index and word in index.opinion_modifiers:
        loc = index.opinion_modifiers[word]
        filename = loc.uri.split('/')[-1]
        return f"## 💭 `{word}`\n\n**🟫 Opinion Modifier** — *Mod-defined*\n\n---\n\n📝 **Usage:**\n```ck3\nadd_opinion = {{\n    target = scope:target\n    modifier = {word}\n}}\n# Or check:\nhas_opinion_modifier = {{\n    target = scope:target\n    modifier = {word}\n}}\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's a scripted GUI from workspace
    if index and word in index.scripted_guis:
        loc = index.scripted_guis[word]
        filename = loc.uri.split('/')[-1]
        return f"## 🖼️ `{word}`\n\n**🔲 Scripted GUI** — *Mod-defined*\n\n---\n\nA scripted GUI button/toggle for use in GUI files.\n\n📝 **Usage (in .gui files):**\n```gui\nonclick = \"[GetScriptedGui('{word}').Execute(...)]\"\n```\n\n📂 **Defined in:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}\n\n💡 *Go to Definition: Ctrl+Click*"
    
    # Check if it's a scope link
    if word in CK3_SCOPES or word in get_scope_links('character'):
        return f"## 🎯 `{word}`\n\n**🔷 Scope Link** — *Navigate to related scope*\n\n{get_scope_documentation(word)}"
    
    # Check if it's a keyword
    if word in CK3_KEYWORDS:
        return f"## 🔑 `{word}`\n\n**🟣 Keyword** — *CK3 script structure*\n\n{get_keyword_documentation(word)}"
    
    # Check if it's an event in the index
    if index and word in index.events:
        loc = index.events[word]
        # Extract filename from URI
        filename = loc.uri.split('/')[-1]
        return f"## 📜 `{word}`\n\n**🟢 Event Definition**\n\n---\n\n📂 **File:** `{filename}`\n\n📍 **Line:** {loc.range.start.line + 1}"
    
    # Check if it's a saved scope reference (scope:xxx)
    if word.startswith('scope:'):
        scope_name = word[6:]
        if index and scope_name in index.saved_scopes:
            loc = index.saved_scopes[scope_name]
            filename = loc.uri.split('/')[-1]
            return f"## 🎯 `{word}`\n\n**🔵 Saved Scope Reference**\n\n---\n\n✅ Defined with `save_scope_as = {scope_name}`\n\n📂 **Location:** `{filename}:{loc.range.start.line + 1}`"
        else:
            return f"## 🎯 `{word}`\n\n**🔴 Saved Scope Reference**\n\n---\n\n⚠️ **Warning:** This scope has not been defined!\n\n💡 Use `save_scope_as = {scope_name}` to define it."
    
    # No documentation available
    return None


def create_hover_response(
    doc: TextDocument,
    position: types.Position,
    ast: list[CK3Node],
    index: Optional[DocumentIndex]
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
