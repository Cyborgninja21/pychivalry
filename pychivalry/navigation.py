"""
CK3 Navigation Module

This module implements LSP navigation features for CK3 scripts.
Provides "Go to Definition" and "Find References" functionality.

Navigation Targets:
- Events: Navigate to event definitions
- Scripted Effects: Navigate to scripted_effect definitions
- Scripted Triggers: Navigate to scripted_trigger definitions
- Saved Scopes: Navigate to scope save locations
- Script Values: Navigate to script value definitions
- Localization Keys: Navigate to localization file entries

LSP Methods:
- TEXT_DOCUMENT_DEFINITION: Jump to symbol definition
- TEXT_DOCUMENT_REFERENCES: Find all references to symbol
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from lsprotocol import types


@dataclass
class DefinitionLocation:
    """
    Represents the location of a definition.

    Attributes:
        uri: Document URI where definition is located
        range: Range within the document
        symbol_type: Type of symbol (event, scripted_effect, etc.)
        symbol_name: Name of the symbol
    """

    uri: str
    range: types.Range
    symbol_type: str
    symbol_name: str


@dataclass
class Reference:
    """
    Represents a reference to a symbol.

    Attributes:
        uri: Document URI where reference is located
        range: Range within the document
        context: Context of the reference (call, definition, etc.)
    """

    uri: str
    range: types.Range
    context: str


# Symbol types that can be navigated to
NAVIGABLE_SYMBOL_TYPES = {
    "event",
    "scripted_effect",
    "scripted_trigger",
    "saved_scope",
    "script_value",
    "localization_key",
    "on_action",
}


def is_navigable_symbol(symbol_type: str) -> bool:
    """
    Check if a symbol type supports navigation.

    Args:
        symbol_type: The type of symbol

    Returns:
        True if symbol supports navigation, False otherwise
    """
    return symbol_type in NAVIGABLE_SYMBOL_TYPES


def create_definition_location(
    uri: str, line: int, character: int, symbol_type: str, symbol_name: str
) -> DefinitionLocation:
    """
    Create a DefinitionLocation object.

    Args:
        uri: Document URI
        line: Line number (0-indexed)
        character: Character position (0-indexed)
        symbol_type: Type of symbol
        symbol_name: Name of symbol

    Returns:
        DefinitionLocation object
    """
    # Create a range (single character for now, can be expanded)
    range_obj = types.Range(
        start=types.Position(line=line, character=character),
        end=types.Position(line=line, character=character + len(symbol_name)),
    )

    return DefinitionLocation(
        uri=uri, range=range_obj, symbol_type=symbol_type, symbol_name=symbol_name
    )


def create_reference(
    uri: str, line: int, character: int, symbol_length: int, context: str = "reference"
) -> Reference:
    """
    Create a Reference object.

    Args:
        uri: Document URI
        line: Line number (0-indexed)
        character: Character position (0-indexed)
        symbol_length: Length of the symbol
        context: Context of the reference

    Returns:
        Reference object
    """
    range_obj = types.Range(
        start=types.Position(line=line, character=character),
        end=types.Position(line=line, character=character + symbol_length),
    )

    return Reference(uri=uri, range=range_obj, context=context)


def find_event_definition(event_id: str, document_index: Dict) -> Optional[DefinitionLocation]:
    """
    Find the definition location of an event.

    Args:
        event_id: The event ID to find (e.g., my_mod.0001)
        document_index: Index of all parsed documents

    Returns:
        DefinitionLocation if found, None otherwise
    """
    if "events" not in document_index:
        return None

    events = document_index["events"]
    if event_id not in events:
        return None

    location = events[event_id]
    return DefinitionLocation(
        uri=location.get("uri", ""),
        range=location.get(
            "range",
            types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
            ),
        ),
        symbol_type="event",
        symbol_name=event_id,
    )


def find_scripted_effect_definition(
    effect_name: str, document_index: Dict
) -> Optional[DefinitionLocation]:
    """
    Find the definition location of a scripted effect.

    Args:
        effect_name: The effect name to find
        document_index: Index of all parsed documents

    Returns:
        DefinitionLocation if found, None otherwise
    """
    if "scripted_effects" not in document_index:
        return None

    effects = document_index["scripted_effects"]
    if effect_name not in effects:
        return None

    location = effects[effect_name]
    return DefinitionLocation(
        uri=location.get("uri", ""),
        range=location.get(
            "range",
            types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
            ),
        ),
        symbol_type="scripted_effect",
        symbol_name=effect_name,
    )


def find_scripted_trigger_definition(
    trigger_name: str, document_index: Dict
) -> Optional[DefinitionLocation]:
    """
    Find the definition location of a scripted trigger.

    Args:
        trigger_name: The trigger name to find
        document_index: Index of all parsed documents

    Returns:
        DefinitionLocation if found, None otherwise
    """
    if "scripted_triggers" not in document_index:
        return None

    triggers = document_index["scripted_triggers"]
    if trigger_name not in triggers:
        return None

    location = triggers[trigger_name]
    return DefinitionLocation(
        uri=location.get("uri", ""),
        range=location.get(
            "range",
            types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
            ),
        ),
        symbol_type="scripted_trigger",
        symbol_name=trigger_name,
    )


def find_saved_scope_definition(
    scope_name: str, document_index: Dict, current_uri: str
) -> Optional[DefinitionLocation]:
    """
    Find the definition location of a saved scope.

    Saved scopes are defined with save_scope_as or save_temporary_scope_as.

    Args:
        scope_name: The scope name to find (without scope: prefix)
        document_index: Index of all parsed documents
        current_uri: Current document URI

    Returns:
        DefinitionLocation if found, None otherwise
    """
    if "saved_scopes" not in document_index:
        return None

    saved_scopes = document_index["saved_scopes"]
    if scope_name not in saved_scopes:
        return None

    # Prefer definitions in the current document
    scope_locations = saved_scopes[scope_name]
    if not isinstance(scope_locations, list):
        scope_locations = [scope_locations]

    # First try to find in current document
    for location in scope_locations:
        if location.get("uri") == current_uri:
            return DefinitionLocation(
                uri=location.get("uri", ""),
                range=location.get(
                    "range",
                    types.Range(
                        start=types.Position(line=0, character=0),
                        end=types.Position(line=0, character=0),
                    ),
                ),
                symbol_type="saved_scope",
                symbol_name=scope_name,
            )

    # Otherwise return first definition found
    if scope_locations:
        location = scope_locations[0]
        return DefinitionLocation(
            uri=location.get("uri", ""),
            range=location.get(
                "range",
                types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=0, character=0),
                ),
            ),
            symbol_type="saved_scope",
            symbol_name=scope_name,
        )

    return None


def find_script_value_definition(
    value_name: str, document_index: Dict
) -> Optional[DefinitionLocation]:
    """
    Find the definition location of a script value.

    Args:
        value_name: The script value name to find
        document_index: Index of all parsed documents

    Returns:
        DefinitionLocation if found, None otherwise
    """
    if "script_values" not in document_index:
        return None

    script_values = document_index["script_values"]
    if value_name not in script_values:
        return None

    location = script_values[value_name]
    return DefinitionLocation(
        uri=location.get("uri", ""),
        range=location.get(
            "range",
            types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
            ),
        ),
        symbol_type="script_value",
        symbol_name=value_name,
    )


def find_all_references(
    symbol_name: str, symbol_type: str, document_index: Dict, include_declaration: bool = False
) -> List[Reference]:
    """
    Find all references to a symbol.

    Args:
        symbol_name: The symbol name to find references for
        symbol_type: The type of symbol
        document_index: Index of all parsed documents
        include_declaration: Whether to include the declaration/definition

    Returns:
        List of Reference objects
    """
    references = []

    # Get references from index
    if "references" not in document_index:
        return references

    refs_by_type = document_index["references"]
    if symbol_type not in refs_by_type:
        return references

    symbol_refs = refs_by_type[symbol_type]
    if symbol_name not in symbol_refs:
        return references

    # Convert stored references to Reference objects
    for ref_data in symbol_refs[symbol_name]:
        ref = create_reference(
            uri=ref_data.get("uri", ""),
            line=ref_data.get("line", 0),
            character=ref_data.get("character", 0),
            symbol_length=len(symbol_name),
            context=ref_data.get("context", "reference"),
        )

        # Filter out declaration if not requested
        if not include_declaration and ref.context == "declaration":
            continue

        references.append(ref)

    return references


def convert_to_lsp_location(def_location: DefinitionLocation) -> types.Location:
    """
    Convert a DefinitionLocation to LSP Location format.

    Args:
        def_location: The definition location to convert

    Returns:
        LSP Location object
    """
    return types.Location(uri=def_location.uri, range=def_location.range)


def convert_to_lsp_location_link(
    def_location: DefinitionLocation, origin_range: types.Range
) -> types.LocationLink:
    """
    Convert a DefinitionLocation to LSP LocationLink format.

    LocationLink provides more context by including the origin selection range.

    Args:
        def_location: The definition location to convert
        origin_range: Range of the symbol at the origin

    Returns:
        LSP LocationLink object
    """
    return types.LocationLink(
        origin_selection_range=origin_range,
        target_uri=def_location.uri,
        target_range=def_location.range,
        target_selection_range=def_location.range,
    )


def get_symbol_at_position(
    document_text: str, line: int, character: int
) -> Optional[Tuple[str, str]]:
    """
    Get the symbol at a specific position in the document.

    Args:
        document_text: The full document text
        line: Line number (0-indexed)
        character: Character position (0-indexed)

    Returns:
        Tuple of (symbol_name, symbol_type) if found, None otherwise
    """
    lines = document_text.split("\n")
    if line >= len(lines):
        return None

    current_line = lines[line]
    if character >= len(current_line):
        return None

    # Simple heuristic: extract word at position
    # In real implementation, would use proper AST analysis
    import re

    # Find word boundaries
    start = character
    while start > 0 and (
        current_line[start - 1].isalnum() or current_line[start - 1] in ("_", ".", ":")
    ):
        start -= 1

    end = character
    while end < len(current_line) and (
        current_line[end].isalnum() or current_line[end] in ("_", ".", ":")
    ):
        end += 1

    symbol = current_line[start:end]
    if not symbol:
        return None

    # Determine symbol type based on context
    # This is simplified - real implementation would use AST
    if symbol.startswith("scope:"):
        return (symbol[6:], "saved_scope")
    elif "." in symbol and symbol.count(".") >= 2:
        # Might be an event ID (namespace.number)
        return (symbol, "event")
    else:
        # Could be scripted effect, trigger, or script value
        # Would need context from AST to determine
        return (symbol, "unknown")


def find_definition(
    document, position: Tuple[int, int], index: Optional[Dict]
) -> List[types.Location]:
    """
    Simplified wrapper for find definition functionality.
    Used by integration tests.

    Args:
        document: Parsed document
        position: (line, character) tuple
        index: Document index

    Returns:
        List of LSP Location objects
    """
    if not index:
        return []

    line, character = position
    symbol_info = get_symbol_at_position(
        document.text if hasattr(document, "text") else str(document), line, character
    )

    if not symbol_info:
        return []

    symbol_name, symbol_type = symbol_info

    # Try to find definition based on symbol type
    def_location = None
    if symbol_type == "event" or "." in symbol_name:
        def_location = find_event_definition(symbol_name, index)
    elif symbol_type == "scripted_effect":
        def_location = find_scripted_effect_definition(symbol_name, index)
    elif symbol_type == "scripted_trigger":
        def_location = find_scripted_trigger_definition(symbol_name, index)
    elif symbol_type == "saved_scope":
        current_uri = document.uri if hasattr(document, "uri") else "file:///unknown"
        def_location = find_saved_scope_definition(symbol_name, index, current_uri)
    elif symbol_type == "script_value":
        def_location = find_script_value_definition(symbol_name, index)

    if def_location:
        return [convert_to_lsp_location(def_location)]

    return []


def find_references(
    document, position: Tuple[int, int], index: Optional[Dict], include_declaration: bool = False
) -> List[types.Location]:
    """
    Simplified wrapper for find references functionality.
    Used by integration tests.

    Args:
        document: Parsed document
        position: (line, character) tuple
        index: Document index
        include_declaration: Whether to include the declaration

    Returns:
        List of LSP Location objects
    """
    if not index:
        return []

    line, character = position
    symbol_info = get_symbol_at_position(
        document.text if hasattr(document, "text") else str(document), line, character
    )

    if not symbol_info:
        return []

    symbol_name, symbol_type = symbol_info

    # Find all references
    references = find_all_references(
        symbol_name, symbol_type, index, include_declaration=include_declaration
    )

    # Convert to LSP locations
    locations = []
    for ref in references:
        location = types.Location(uri=ref.uri, range=ref.range)
        locations.append(location)

    return locations
