"""
CK3 Document Symbols Module

This module implements LSP document symbol features for CK3 scripts.
Provides outline/breadcrumb navigation for documents.

Document Symbols show the structure of a document:
- Events with their triggers, immediate, and options
- Scripted effects with their parameters
- Scripted triggers with their parameters
- Script values and their formulas
- On-actions and their events

LSP Methods:
- TEXT_DOCUMENT_DOCUMENT_SYMBOL: Get symbols in a document
- WORKSPACE_SYMBOL: Find symbols across workspace
"""

from typing import List, Optional, Dict
from dataclasses import dataclass
from lsprotocol import types


@dataclass
class DocumentSymbol:
    """
    Represents a symbol in a document.

    Attributes:
        name: Symbol name
        kind: LSP SymbolKind
        range: Full range including children
        selection_range: Range of the symbol name itself
        detail: Additional details about the symbol
        children: Nested symbols
    """

    name: str
    kind: types.SymbolKind
    range: types.Range
    selection_range: types.Range
    detail: Optional[str] = None
    children: List["DocumentSymbol"] = None

    def __post_init__(self):
        if self.children is None:
            self.children = []


# Map CK3 constructs to LSP SymbolKinds
CK3_TO_SYMBOL_KIND = {
    "event": types.SymbolKind.Event,
    "scripted_effect": types.SymbolKind.Function,
    "scripted_trigger": types.SymbolKind.Function,
    "script_value": types.SymbolKind.Variable,
    "on_action": types.SymbolKind.Event,
    "trigger": types.SymbolKind.Object,
    "immediate": types.SymbolKind.Object,
    "option": types.SymbolKind.EnumMember,
    "after": types.SymbolKind.Object,
    "effect": types.SymbolKind.Object,
    "namespace": types.SymbolKind.Namespace,
    "parameter": types.SymbolKind.Property,
}


def get_symbol_kind(construct_type: str) -> types.SymbolKind:
    """
    Get the appropriate LSP SymbolKind for a CK3 construct.

    Args:
        construct_type: Type of CK3 construct

    Returns:
        Appropriate LSP SymbolKind
    """
    return CK3_TO_SYMBOL_KIND.get(construct_type, types.SymbolKind.Object)


def create_document_symbol(
    name: str,
    construct_type: str,
    start_line: int,
    start_char: int,
    end_line: int,
    end_char: int,
    detail: Optional[str] = None,
) -> DocumentSymbol:
    """
    Create a DocumentSymbol object.

    Args:
        name: Symbol name
        construct_type: Type of CK3 construct
        start_line: Start line (0-indexed)
        start_char: Start character (0-indexed)
        end_line: End line (0-indexed)
        end_char: End character (0-indexed)
        detail: Optional detail string

    Returns:
        DocumentSymbol object
    """
    range_obj = types.Range(
        start=types.Position(line=start_line, character=start_char),
        end=types.Position(line=end_line, character=end_char),
    )

    # Selection range is typically just the name
    selection_range = types.Range(
        start=types.Position(line=start_line, character=start_char),
        end=types.Position(line=start_line, character=start_char + len(name)),
    )

    return DocumentSymbol(
        name=name,
        kind=get_symbol_kind(construct_type),
        range=range_obj,
        selection_range=selection_range,
        detail=detail,
    )


def extract_event_symbols(event_node: Dict) -> DocumentSymbol:
    """
    Extract symbols from an event node.

    Events contain:
    - Event ID (main symbol)
    - Trigger block (child symbol)
    - Immediate block (child symbol)
    - Options (child symbols)
    - After block (child symbol)

    Args:
        event_node: Parsed event node

    Returns:
        DocumentSymbol for the event with children
    """
    event_id = event_node.get("id", "unknown_event")
    event_type = event_node.get("type", "character_event")

    event_symbol = create_document_symbol(
        name=event_id,
        construct_type="event",
        start_line=event_node.get("start_line", 0),
        start_char=event_node.get("start_char", 0),
        end_line=event_node.get("end_line", 0),
        end_char=event_node.get("end_char", 0),
        detail=event_type,
    )

    # Add trigger as child if present
    if "trigger" in event_node:
        trigger_symbol = create_document_symbol(
            name="trigger",
            construct_type="trigger",
            start_line=event_node["trigger"].get("start_line", 0),
            start_char=event_node["trigger"].get("start_char", 0),
            end_line=event_node["trigger"].get("end_line", 0),
            end_char=event_node["trigger"].get("end_char", 0),
        )
        event_symbol.children.append(trigger_symbol)

    # Add immediate as child if present
    if "immediate" in event_node:
        immediate_symbol = create_document_symbol(
            name="immediate",
            construct_type="immediate",
            start_line=event_node["immediate"].get("start_line", 0),
            start_char=event_node["immediate"].get("start_char", 0),
            end_line=event_node["immediate"].get("end_line", 0),
            end_char=event_node["immediate"].get("end_char", 0),
        )
        event_symbol.children.append(immediate_symbol)

    # Add options as children
    if "options" in event_node:
        for i, option in enumerate(event_node["options"]):
            option_name = option.get("name", f"option_{i}")
            option_symbol = create_document_symbol(
                name=option_name,
                construct_type="option",
                start_line=option.get("start_line", 0),
                start_char=option.get("start_char", 0),
                end_line=option.get("end_line", 0),
                end_char=option.get("end_char", 0),
            )
            event_symbol.children.append(option_symbol)

    # Add after as child if present
    if "after" in event_node:
        after_symbol = create_document_symbol(
            name="after",
            construct_type="after",
            start_line=event_node["after"].get("start_line", 0),
            start_char=event_node["after"].get("start_char", 0),
            end_line=event_node["after"].get("end_line", 0),
            end_char=event_node["after"].get("end_char", 0),
        )
        event_symbol.children.append(after_symbol)

    return event_symbol


def extract_scripted_effect_symbols(effect_node: Dict) -> DocumentSymbol:
    """
    Extract symbols from a scripted effect node.

    Args:
        effect_node: Parsed scripted effect node

    Returns:
        DocumentSymbol for the scripted effect
    """
    effect_name = effect_node.get("name", "unknown_effect")
    parameters = effect_node.get("parameters", [])

    detail = None
    if parameters:
        detail = f"Parameters: {', '.join(parameters)}"

    effect_symbol = create_document_symbol(
        name=effect_name,
        construct_type="scripted_effect",
        start_line=effect_node.get("start_line", 0),
        start_char=effect_node.get("start_char", 0),
        end_line=effect_node.get("end_line", 0),
        end_char=effect_node.get("end_char", 0),
        detail=detail,
    )

    # Add parameters as children
    for param in parameters:
        param_symbol = create_document_symbol(
            name=f"${param}$",
            construct_type="parameter",
            start_line=effect_node.get("start_line", 0),
            start_char=effect_node.get("start_char", 0),
            end_line=effect_node.get("start_line", 0),
            end_char=effect_node.get("start_char", 0) + len(param) + 2,
        )
        effect_symbol.children.append(param_symbol)

    return effect_symbol


def extract_scripted_trigger_symbols(trigger_node: Dict) -> DocumentSymbol:
    """
    Extract symbols from a scripted trigger node.

    Args:
        trigger_node: Parsed scripted trigger node

    Returns:
        DocumentSymbol for the scripted trigger
    """
    trigger_name = trigger_node.get("name", "unknown_trigger")
    parameters = trigger_node.get("parameters", [])

    detail = None
    if parameters:
        detail = f"Parameters: {', '.join(parameters)}"

    trigger_symbol = create_document_symbol(
        name=trigger_name,
        construct_type="scripted_trigger",
        start_line=trigger_node.get("start_line", 0),
        start_char=trigger_node.get("start_char", 0),
        end_line=trigger_node.get("end_line", 0),
        end_char=trigger_node.get("end_char", 0),
        detail=detail,
    )

    # Add parameters as children
    for param in parameters:
        param_symbol = create_document_symbol(
            name=f"${param}$",
            construct_type="parameter",
            start_line=trigger_node.get("start_line", 0),
            start_char=trigger_node.get("start_char", 0),
            end_line=trigger_node.get("start_line", 0),
            end_char=trigger_node.get("start_char", 0) + len(param) + 2,
        )
        trigger_symbol.children.append(param_symbol)

    return trigger_symbol


def extract_script_value_symbols(value_node: Dict) -> DocumentSymbol:
    """
    Extract symbols from a script value node.

    Args:
        value_node: Parsed script value node

    Returns:
        DocumentSymbol for the script value
    """
    value_name = value_node.get("name", "unknown_value")
    value_type = value_node.get("type", "fixed")

    detail = f"Type: {value_type}"

    return create_document_symbol(
        name=value_name,
        construct_type="script_value",
        start_line=value_node.get("start_line", 0),
        start_char=value_node.get("start_char", 0),
        end_line=value_node.get("end_line", 0),
        end_char=value_node.get("end_char", 0),
        detail=detail,
    )


def extract_on_action_symbols(on_action_node: Dict) -> DocumentSymbol:
    """
    Extract symbols from an on_action node.

    Args:
        on_action_node: Parsed on_action node

    Returns:
        DocumentSymbol for the on_action
    """
    on_action_name = on_action_node.get("name", "unknown_on_action")
    event_count = len(on_action_node.get("events", []))

    detail = f"{event_count} event(s)" if event_count > 0 else None

    return create_document_symbol(
        name=on_action_name,
        construct_type="on_action",
        start_line=on_action_node.get("start_line", 0),
        start_char=on_action_node.get("start_char", 0),
        end_line=on_action_node.get("end_line", 0),
        end_char=on_action_node.get("end_char", 0),
        detail=detail,
    )


def extract_document_symbols(parsed_document: Dict) -> List[DocumentSymbol]:
    """
    Extract all symbols from a parsed document.

    Args:
        parsed_document: Parsed CK3 document

    Returns:
        List of top-level DocumentSymbol objects
    """
    symbols = []

    # Extract events
    if "events" in parsed_document:
        for event_node in parsed_document["events"]:
            symbols.append(extract_event_symbols(event_node))

    # Extract scripted effects
    if "scripted_effects" in parsed_document:
        for effect_node in parsed_document["scripted_effects"]:
            symbols.append(extract_scripted_effect_symbols(effect_node))

    # Extract scripted triggers
    if "scripted_triggers" in parsed_document:
        for trigger_node in parsed_document["scripted_triggers"]:
            symbols.append(extract_scripted_trigger_symbols(trigger_node))

    # Extract script values
    if "script_values" in parsed_document:
        for value_node in parsed_document["script_values"]:
            symbols.append(extract_script_value_symbols(value_node))

    # Extract on_actions
    if "on_actions" in parsed_document:
        for on_action_node in parsed_document["on_actions"]:
            symbols.append(extract_on_action_symbols(on_action_node))

    return symbols


def convert_to_lsp_document_symbol(symbol: DocumentSymbol) -> types.DocumentSymbol:
    """
    Convert internal DocumentSymbol to LSP DocumentSymbol.

    Args:
        symbol: Internal DocumentSymbol object

    Returns:
        LSP DocumentSymbol object
    """
    children = [convert_to_lsp_document_symbol(child) for child in symbol.children]

    return types.DocumentSymbol(
        name=symbol.name,
        kind=symbol.kind,
        range=symbol.range,
        selection_range=symbol.selection_range,
        detail=symbol.detail,
        children=children if children else None,
    )


def find_symbols_by_name(symbols: List[DocumentSymbol], query: str) -> List[DocumentSymbol]:
    """
    Find symbols matching a query string.

    Used for workspace symbol search.

    Args:
        symbols: List of symbols to search
        query: Search query (case-insensitive)

    Returns:
        List of matching symbols
    """
    results = []
    query_lower = query.lower()

    for symbol in symbols:
        if query_lower in symbol.name.lower():
            results.append(symbol)

        # Recursively search children
        if symbol.children:
            results.extend(find_symbols_by_name(symbol.children, query))

    return results


def get_symbol_hierarchy(symbol: DocumentSymbol) -> str:
    """
    Get a hierarchical representation of a symbol.

    Used for displaying symbol context.

    Args:
        symbol: The symbol to represent

    Returns:
        String representation (e.g., "event_name > trigger")
    """
    parts = [symbol.name]

    # Could be extended to include parent information
    # if we track parent references

    return " > ".join(parts)
