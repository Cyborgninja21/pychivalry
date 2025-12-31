"""
Signature Help Module for CK3 Language Server.

This module provides parameter hints when typing CK3 effects and triggers
that take structured block arguments.

Signature Help Features:
    - Shows parameter documentation when typing inside effect blocks
    - Highlights the current parameter being typed
    - Provides type information for each parameter
    - Shows required vs optional parameters

LSP Reference:
    https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_signatureHelp

CK3 Effects with Block Parameters:
    - add_opinion = { target = <character> modifier = <opinion_modifier> [years = <int>] }
    - trigger_event = { id = <event_id> [days = <int>] [triggered_desc = ...] }
    - add_character_modifier = { modifier = <modifier_id> [years = <int>] }
    - set_variable = { name = <var_name> value = <value> }
    - change_variable = { name = <var_name> add/subtract/multiply/divide = <value> }
    - save_scope_as = <scope_name>
    - random = { chance = <int> ... }
    - random_list = { <weight> = { ... } }
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from lsprotocol import types

logger = logging.getLogger(__name__)


@dataclass
class ParameterInfo:
    """Information about a single parameter."""
    name: str
    type_hint: str
    documentation: str
    required: bool = True
    default_value: Optional[str] = None


@dataclass
class SignatureInfo:
    """Information about a command/effect signature."""
    name: str
    documentation: str
    parameters: List[ParameterInfo] = field(default_factory=list)
    # The trigger characters that activate this signature within the block
    trigger_pattern: Optional[str] = None


# Comprehensive signature definitions for CK3 effects and triggers
SIGNATURES: Dict[str, SignatureInfo] = {
    # Opinion effects
    "add_opinion": SignatureInfo(
        name="add_opinion",
        documentation="Add an opinion modifier from one character to another.",
        parameters=[
            ParameterInfo("target", "character", "The character whose opinion is being modified", True),
            ParameterInfo("modifier", "opinion_modifier", "The opinion modifier to apply (defined in common/opinion_modifiers/)", True),
            ParameterInfo("years", "int", "Number of years the modifier lasts (omit for permanent)", False),
            ParameterInfo("months", "int", "Number of months the modifier lasts", False),
            ParameterInfo("opinion", "int", "Override the opinion value from the modifier", False),
        ],
    ),
    "reverse_add_opinion": SignatureInfo(
        name="reverse_add_opinion",
        documentation="Add an opinion modifier from target character to the current scope.",
        parameters=[
            ParameterInfo("target", "character", "The character who will have the opinion of current scope", True),
            ParameterInfo("modifier", "opinion_modifier", "The opinion modifier to apply", True),
            ParameterInfo("years", "int", "Number of years the modifier lasts", False),
            ParameterInfo("months", "int", "Number of months the modifier lasts", False),
        ],
    ),
    "remove_opinion": SignatureInfo(
        name="remove_opinion",
        documentation="Remove an opinion modifier.",
        parameters=[
            ParameterInfo("target", "character", "The character whose opinion modifier is being removed", True),
            ParameterInfo("modifier", "opinion_modifier", "The opinion modifier to remove", True),
        ],
    ),
    
    # Event effects
    "trigger_event": SignatureInfo(
        name="trigger_event",
        documentation="Trigger an event on the current scope (usually a character).",
        parameters=[
            ParameterInfo("id", "event_id", "The event ID to trigger (namespace.number format)", True),
            ParameterInfo("days", "int", "Delay in days before the event fires (default: 0)", False, "0"),
            ParameterInfo("months", "int", "Delay in months before the event fires", False),
            ParameterInfo("years", "int", "Delay in years before the event fires", False),
            ParameterInfo("triggered_desc", "block", "Conditional description for the event", False),
            ParameterInfo("saved_event_id", "string", "Save the event ID to cancel later", False),
        ],
    ),
    "send_interface_message": SignatureInfo(
        name="send_interface_message",
        documentation="Send an interface message to a character.",
        parameters=[
            ParameterInfo("type", "message_type", "The type of interface message", True),
            ParameterInfo("title", "localization_key", "Title localization key", True),
            ParameterInfo("desc", "localization_key", "Description localization key", False),
            ParameterInfo("left_icon", "character", "Character to show on the left", False),
            ParameterInfo("right_icon", "character", "Character to show on the right", False),
            ParameterInfo("goto", "character|title", "Clickable goto location", False),
        ],
    ),
    
    # Variable effects
    "set_variable": SignatureInfo(
        name="set_variable",
        documentation="Set a variable on the current scope.",
        parameters=[
            ParameterInfo("name", "string", "The variable name", True),
            ParameterInfo("value", "any", "The value to set (number, scope, or list)", True),
            ParameterInfo("days", "int", "Days until the variable expires", False),
            ParameterInfo("months", "int", "Months until the variable expires", False),
            ParameterInfo("years", "int", "Years until the variable expires", False),
        ],
    ),
    "change_variable": SignatureInfo(
        name="change_variable",
        documentation="Change an existing variable's value.",
        parameters=[
            ParameterInfo("name", "string", "The variable name to modify", True),
            ParameterInfo("add", "number", "Value to add (use one of: add, subtract, multiply, divide)", False),
            ParameterInfo("subtract", "number", "Value to subtract", False),
            ParameterInfo("multiply", "number", "Value to multiply by", False),
            ParameterInfo("divide", "number", "Value to divide by", False),
        ],
    ),
    "clamp_variable": SignatureInfo(
        name="clamp_variable",
        documentation="Clamp a variable to a range.",
        parameters=[
            ParameterInfo("name", "string", "The variable name", True),
            ParameterInfo("min", "number", "Minimum value", True),
            ParameterInfo("max", "number", "Maximum value", True),
        ],
    ),
    
    # Character modifier effects
    "add_character_modifier": SignatureInfo(
        name="add_character_modifier",
        documentation="Add a modifier to a character.",
        parameters=[
            ParameterInfo("modifier", "modifier_id", "The modifier ID (defined in common/modifiers/)", True),
            ParameterInfo("years", "int", "Duration in years (omit for permanent)", False),
            ParameterInfo("months", "int", "Duration in months", False),
            ParameterInfo("days", "int", "Duration in days", False),
        ],
    ),
    "remove_character_modifier": SignatureInfo(
        name="remove_character_modifier",
        documentation="Remove a modifier from a character.",
        parameters=[
            ParameterInfo("modifier", "modifier_id", "The modifier ID to remove", True),
        ],
    ),
    
    # Trait effects  
    "add_trait": SignatureInfo(
        name="add_trait",
        documentation="Add a trait to a character.",
        parameters=[
            ParameterInfo("trait", "trait_id", "The trait to add (from Official_Trait_List.md)", True),
            ParameterInfo("track", "string", "Optional trait track for leveled traits", False),
        ],
    ),
    "remove_trait": SignatureInfo(
        name="remove_trait",
        documentation="Remove a trait from a character.",
        parameters=[
            ParameterInfo("trait", "trait_id", "The trait to remove", True),
        ],
    ),
    
    # Flag effects
    "add_character_flag": SignatureInfo(
        name="add_character_flag",
        documentation="Add a flag to a character for tracking state.",
        parameters=[
            ParameterInfo("flag", "string", "The flag name to set", True),
            ParameterInfo("years", "int", "Years until flag expires", False),
            ParameterInfo("months", "int", "Months until flag expires", False),
            ParameterInfo("days", "int", "Days until flag expires", False),
        ],
    ),
    
    # Claim effects
    "add_claim": SignatureInfo(
        name="add_claim",
        documentation="Add a claim on a title.",
        parameters=[
            ParameterInfo("target", "landed_title", "The title to add a claim on", True),
            ParameterInfo("pressed", "bool", "Whether the claim is pressed (stronger)", False, "no"),
        ],
    ),
    
    # Relation effects
    "set_relation_lover": SignatureInfo(
        name="set_relation_lover",
        documentation="Establish a lover relationship with target.",
        parameters=[
            ParameterInfo("target", "character", "The character to become lovers with", True),
            ParameterInfo("reason", "flag", "Optional reason flag for the relationship", False),
            ParameterInfo("copy_reason", "character", "Copy the reason from another relationship", False),
        ],
    ),
    "set_relation_friend": SignatureInfo(
        name="set_relation_friend",
        documentation="Establish a friend relationship with target.",
        parameters=[
            ParameterInfo("target", "character", "The character to become friends with", True),
            ParameterInfo("reason", "flag", "Optional reason flag for the relationship", False),
        ],
    ),
    "set_relation_rival": SignatureInfo(
        name="set_relation_rival",
        documentation="Establish a rival relationship with target.",
        parameters=[
            ParameterInfo("target", "character", "The character to become rivals with", True),
            ParameterInfo("reason", "flag", "Optional reason flag for the relationship", False),
        ],
    ),
    
    # Random effects
    "random": SignatureInfo(
        name="random",
        documentation="Execute effects with a random chance.",
        parameters=[
            ParameterInfo("chance", "int (0-100)", "Percentage chance to execute the effects", True),
            ParameterInfo("modifier", "block", "Modify chance based on conditions", False),
        ],
    ),
    "random_list": SignatureInfo(
        name="random_list",
        documentation="Choose one option from a weighted list.",
        parameters=[
            ParameterInfo("<weight>", "int", "Weight for this option (e.g., 10 = {...})", True),
            ParameterInfo("modifier", "block", "Modify weight based on conditions", False),
            ParameterInfo("trigger", "block", "Conditions for this option to be valid", False),
        ],
    ),
    
    # Stress effects
    "stress_impact": SignatureInfo(
        name="stress_impact",
        documentation="Apply stress based on character traits.",
        parameters=[
            ParameterInfo("base", "int", "Base stress amount", False),
            ParameterInfo("<trait>", "int", "Stress modifier for having this trait (e.g., brave = -10)", False),
        ],
    ),
    
    # Title effects
    "create_title_and_vassal_change": SignatureInfo(
        name="create_title_and_vassal_change",
        documentation="Create a title transfer change (used with resolve_title_and_vassal_change).",
        parameters=[
            ParameterInfo("type", "change_type", "Type of change: conquest, granted, usurped, etc.", True),
            ParameterInfo("save_scope_as", "string", "Save the change for later resolution", True),
            ParameterInfo("add_claim_on_loss", "bool", "Whether previous holder gets a claim", False, "yes"),
        ],
    ),
    
    # Death effect
    "death": SignatureInfo(
        name="death",
        documentation="Kill the character.",
        parameters=[
            ParameterInfo("death_reason", "death_reason", "The cause of death (affects death event)", True),
            ParameterInfo("killer", "character", "The character responsible for the death", False),
        ],
    ),
    
    # Marriage effects
    "marry": SignatureInfo(
        name="marry",
        documentation="Create a marriage between two characters.",
        parameters=[
            ParameterInfo("target", "character", "The character to marry", True),
            ParameterInfo("matrilineal", "bool", "Whether children belong to the mother's dynasty", False, "no"),
        ],
    ),
    
    # Scope save effects (simple = value)
    "save_scope_as": SignatureInfo(
        name="save_scope_as",
        documentation="Save the current scope for later reference with scope:<name>.",
        parameters=[
            ParameterInfo("name", "string", "The name to save the scope as", True),
        ],
    ),
    "save_temporary_scope_as": SignatureInfo(
        name="save_temporary_scope_as",
        documentation="Save scope temporarily (cleared after current effect block).",
        parameters=[
            ParameterInfo("name", "string", "The name to save the scope as", True),
        ],
    ),
    
    # Duel effects
    "duel": SignatureInfo(
        name="duel",
        documentation="Initiate a duel between characters.",
        parameters=[
            ParameterInfo("target", "character", "The character to duel against", True),
            ParameterInfo("skill", "skill_type", "The skill used for the duel (martial, intrigue, etc.)", True),
            ParameterInfo("value", "int", "Base value for the duel roll", False),
            ParameterInfo("on_win", "block", "Effects if current scope wins", False),
            ParameterInfo("on_loss", "block", "Effects if current scope loses", False),
            ParameterInfo("on_tie", "block", "Effects on a tie", False),
        ],
    ),
    
    # Portrait effects
    "show_as_tooltip": SignatureInfo(
        name="show_as_tooltip",
        documentation="Show effects in tooltip without executing them.",
        parameters=[
            ParameterInfo("...", "effects", "Effects to show (not executed)", True),
        ],
    ),
    "custom_tooltip": SignatureInfo(
        name="custom_tooltip",
        documentation="Display custom tooltip text.",
        parameters=[
            ParameterInfo("text", "localization_key", "The localization key for the tooltip", True),
        ],
    ),
    
    # Hidden effects
    "hidden_effect": SignatureInfo(
        name="hidden_effect",
        documentation="Execute effects without showing tooltips to the player.",
        parameters=[
            ParameterInfo("...", "effects", "Effects to execute silently", True),
        ],
    ),
}

# Trigger signatures (for triggers that take block parameters)
TRIGGER_SIGNATURES: Dict[str, SignatureInfo] = {
    "opinion": SignatureInfo(
        name="opinion",
        documentation="Check opinion value between characters.",
        parameters=[
            ParameterInfo("target", "character", "The character to check opinion of", True),
            ParameterInfo("value", "int", "Opinion value to compare against", True),
        ],
    ),
    "is_at_war_with": SignatureInfo(
        name="is_at_war_with",
        documentation="Check if at war with a specific character.",
        parameters=[
            ParameterInfo("target", "character", "The character to check war status against", True),
        ],
    ),
    "has_relation": SignatureInfo(
        name="has_relation",
        documentation="Check for a specific relationship type.",
        parameters=[
            ParameterInfo("type", "relation_type", "Type of relation: friend, rival, lover, etc.", True),
            ParameterInfo("target", "character", "The character to check the relation with", True),
        ],
    ),
    "is_close_family_of": SignatureInfo(
        name="is_close_family_of",
        documentation="Check if character is close family of target.",
        parameters=[
            ParameterInfo("target", "character", "The character to check family relation with", True),
        ],
    ),
}


def get_signature_help(
    text: str,
    position: types.Position,
) -> Optional[types.SignatureHelp]:
    """
    Get signature help for the current cursor position.
    
    Args:
        text: Document text
        position: Cursor position
        
    Returns:
        SignatureHelp object if inside a relevant block, None otherwise
    """
    lines = text.split('\n')
    
    if position.line >= len(lines):
        return None
    
    # Find the context - what effect/trigger are we inside?
    context = _find_signature_context(lines, position)
    
    if not context:
        return None
    
    effect_name, active_param_index = context
    
    # Look up the signature
    sig_info = SIGNATURES.get(effect_name) or TRIGGER_SIGNATURES.get(effect_name)
    
    if not sig_info:
        return None
    
    # Build the signature help response
    return _build_signature_help(sig_info, active_param_index)


def _find_signature_context(
    lines: List[str],
    position: types.Position,
) -> Optional[Tuple[str, int]]:
    """
    Find the effect/trigger context and active parameter.
    
    Scans backwards from cursor position to find:
    1. The enclosing effect/trigger block name
    2. Which parameter is currently being typed
    
    Args:
        lines: Document lines
        position: Cursor position
        
    Returns:
        Tuple of (effect_name, active_param_index) or None
    """
    # Get current line content up to cursor
    current_line = lines[position.line][:position.character] if position.line < len(lines) else ""
    
    # Track brace depth to find enclosing block
    brace_depth = 0
    effect_name = None
    params_seen = []
    
    # First, count braces on current line before cursor
    for char in current_line:
        if char == '{':
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
    
    # Check if we're typing a parameter name on current line
    current_param_match = re.search(r'(\w+)\s*=\s*$', current_line)
    if current_param_match:
        param_name = current_param_match.group(1)
        if param_name not in params_seen:
            params_seen.append(param_name)
    
    # Also check for completed parameters on current line
    for match in re.finditer(r'(\w+)\s*=\s*[^=]+', current_line):
        param = match.group(1)
        if param not in params_seen:
            params_seen.append(param)
    
    # Scan backwards to find the enclosing effect block
    for line_num in range(position.line, -1, -1):
        line = lines[line_num]
        
        # For lines above cursor, use full line
        if line_num < position.line:
            for char in reversed(line):
                if char == '}':
                    brace_depth += 1
                elif char == '{':
                    brace_depth -= 1
            
            # Collect parameters from this line too
            for match in re.finditer(r'(\w+)\s*=', line):
                param = match.group(1)
                if param not in params_seen:
                    params_seen.append(param)
        
        # At brace_depth 0, we're looking for the effect = { line
        if brace_depth <= 0:
            # Look for effect_name = { pattern
            effect_match = re.search(r'(\w+)\s*=\s*\{', line)
            if effect_match:
                effect_name = effect_match.group(1)
                break
    
    if not effect_name:
        return None
    
    # Determine active parameter index
    # If we just typed "param = ", the active param is that one
    # Otherwise, it's the next expected parameter
    sig_info = SIGNATURES.get(effect_name) or TRIGGER_SIGNATURES.get(effect_name)
    
    if not sig_info:
        return None
    
    # Find which parameter is active
    active_index = 0
    
    # Check if cursor is right after "param = "
    if current_param_match:
        param_name = current_param_match.group(1)
        for i, param in enumerate(sig_info.parameters):
            if param.name == param_name:
                active_index = i
                break
    else:
        # Find the first required parameter not yet specified
        for i, param in enumerate(sig_info.parameters):
            if param.required and param.name not in params_seen:
                active_index = i
                break
            elif param.name not in params_seen:
                active_index = i
                # Don't break - keep looking for required params
    
    return (effect_name, active_index)


def _build_signature_help(
    sig_info: SignatureInfo,
    active_param_index: int,
) -> types.SignatureHelp:
    """
    Build a SignatureHelp response from signature info.
    
    Args:
        sig_info: The signature information
        active_param_index: Index of the currently active parameter
        
    Returns:
        SignatureHelp object for the LSP response
    """
    # Build parameter information list
    parameters = []
    param_labels = []
    
    for param in sig_info.parameters:
        # Format: param_name: type_hint (required/optional)
        req_marker = "" if param.required else "?"
        default_str = f" = {param.default_value}" if param.default_value else ""
        label = f"{param.name}{req_marker}: {param.type_hint}{default_str}"
        param_labels.append(label)
        
        # Create parameter info with documentation
        doc = param.documentation
        if not param.required:
            doc = f"(Optional) {doc}"
        
        parameters.append(types.ParameterInformation(
            label=label,
            documentation=types.MarkupContent(
                kind=types.MarkupKind.Markdown,
                value=f"**{param.name}**: `{param.type_hint}`\n\n{doc}",
            ),
        ))
    
    # Build the full signature label
    params_str = ", ".join(param_labels)
    signature_label = f"{sig_info.name} = {{ {params_str} }}"
    
    # Create the signature information
    signature = types.SignatureInformation(
        label=signature_label,
        documentation=types.MarkupContent(
            kind=types.MarkupKind.Markdown,
            value=sig_info.documentation,
        ),
        parameters=parameters,
        active_parameter=min(active_param_index, len(parameters) - 1) if parameters else 0,
    )
    
    return types.SignatureHelp(
        signatures=[signature],
        active_signature=0,
        active_parameter=min(active_param_index, len(parameters) - 1) if parameters else 0,
    )


def get_trigger_characters() -> List[str]:
    """
    Get the characters that should trigger signature help.
    
    Returns:
        List of trigger characters
    """
    return ["{", "=", " "]


def get_retrigger_characters() -> List[str]:
    """
    Get the characters that should re-trigger signature help.
    
    Returns:
        List of retrigger characters
    """
    return [",", " ", "\n", "\t"]
