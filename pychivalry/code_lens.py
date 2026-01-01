"""
CK3 Code Lens Module

This module provides Code Lens functionality for CK3 scripts.
Code lenses are actionable, contextual information displayed inline in the editor.

Code Lenses for CK3:
- Events: Show reference count, trigger_event calls, missing localization
- Scripted Effects: Show usage count across events
- Scripted Triggers: Show usage count across events
- Namespaces: Show event count in namespace

LSP Methods:
- TEXT_DOCUMENT_CODE_LENS: Return code lenses for document
- CODE_LENS_RESOLVE: Resolve details for a code lens (lazy loading)
"""

import logging
import re
from typing import Dict, List, Set, Tuple, Any
from dataclasses import dataclass, field
from lsprotocol import types

logger = logging.getLogger(__name__)


@dataclass
class CodeLensData:
    """
    Data stored in a code lens for later resolution.

    Attributes:
        lens_type: Type of code lens (event, effect, trigger, namespace)
        symbol_name: Name of the symbol
        uri: Document URI where the lens is located
    """

    lens_type: str
    symbol_name: str
    uri: str
    extra: Dict[str, Any] = field(default_factory=dict)


def get_code_lenses(
    document_text: str,
    document_uri: str,
    document_index: Any,
) -> List[types.CodeLens]:
    """
    Generate code lenses for a CK3 document.

    Identifies events, scripted effects, scripted triggers, and namespaces
    in the document and creates code lenses showing reference counts.

    Args:
        document_text: Full document text
        document_uri: Document URI
        document_index: Index with workspace symbols

    Returns:
        List of CodeLens objects
    """
    lenses = []
    lines = document_text.split("\n")

    # Track what we've already added lenses for to avoid duplicates
    processed_symbols: Set[str] = set()

    # Find namespace declarations
    namespace_lenses = _find_namespace_lenses(lines, document_uri, document_index)
    lenses.extend(namespace_lenses)

    # Find event definitions
    event_lenses = _find_event_lenses(lines, document_uri, document_index, processed_symbols)
    lenses.extend(event_lenses)

    # Find scripted effect definitions (if this is a scripted_effects file)
    if "scripted_effects" in document_uri:
        effect_lenses = _find_scripted_effect_lenses(
            lines, document_uri, document_index, processed_symbols
        )
        lenses.extend(effect_lenses)

    # Find scripted trigger definitions (if this is a scripted_triggers file)
    if "scripted_triggers" in document_uri:
        trigger_lenses = _find_scripted_trigger_lenses(
            lines, document_uri, document_index, processed_symbols
        )
        lenses.extend(trigger_lenses)

    logger.debug(f"Generated {len(lenses)} code lenses for {document_uri}")
    return lenses


def _find_namespace_lenses(
    lines: List[str],
    document_uri: str,
    document_index: Any,
) -> List[types.CodeLens]:
    """
    Find namespace declarations and create lenses showing event count.

    Args:
        lines: Document lines
        document_uri: Document URI
        document_index: Index with workspace symbols

    Returns:
        List of CodeLens objects for namespaces
    """
    lenses = []
    pattern = re.compile(r"^\s*namespace\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)")

    for line_num, line in enumerate(lines):
        match = pattern.match(line)
        if match:
            namespace_name = match.group(1)

            # Count events in this namespace
            event_count = 0
            if document_index:
                events = document_index.get_events_for_namespace(namespace_name)
                event_count = len(events)

            # Create lens range (line above the namespace declaration)
            lens_range = types.Range(
                start=types.Position(line=line_num, character=0),
                end=types.Position(line=line_num, character=len(line)),
            )

            # Create command for the lens
            command = types.Command(
                title=f"📦 {event_count} events in namespace",
                command="ck3.showNamespaceEvents",
                arguments=[namespace_name],
            )

            lens = types.CodeLens(
                range=lens_range,
                command=command,
                data={
                    "lens_type": "namespace",
                    "symbol_name": namespace_name,
                    "uri": document_uri,
                },
            )
            lenses.append(lens)

    return lenses


def _find_event_lenses(
    lines: List[str],
    document_uri: str,
    document_index: Any,
    processed_symbols: Set[str],
) -> List[types.CodeLens]:
    """
    Find event definitions and create lenses showing reference count.

    Args:
        lines: Document lines
        document_uri: Document URI
        document_index: Index with workspace symbols
        processed_symbols: Set of already processed symbols

    Returns:
        List of CodeLens objects for events
    """
    lenses = []

    # Pattern for event definition: namespace.number = {
    pattern = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*\.\d+)\s*=\s*\{")

    for line_num, line in enumerate(lines):
        stripped = line.lstrip()
        leading_ws = len(line) - len(stripped)

        # Events should be at top level (minimal indentation)
        if leading_ws > 1:
            continue

        match = pattern.match(stripped)
        if match:
            event_id = match.group(1)

            if event_id in processed_symbols:
                continue
            processed_symbols.add(event_id)

            # Analyze event references and localization
            ref_count, trigger_event_count, missing_loc = _analyze_event(event_id, document_index)

            # Build the lens title
            title_parts = []

            # Reference count
            if ref_count > 0:
                title_parts.append(f"🔗 {ref_count} references")
            else:
                title_parts.append("🔗 0 references")

            # trigger_event calls (subset of references)
            if trigger_event_count > 0:
                title_parts.append(f"📨 {trigger_event_count} trigger_event calls")

            # Missing localization
            if missing_loc:
                missing_str = ", ".join(missing_loc[:3])  # Show first 3
                if len(missing_loc) > 3:
                    missing_str += f" (+{len(missing_loc) - 3} more)"
                title_parts.append(f"⚠️ Missing: {missing_str}")

            title = " | ".join(title_parts)

            # Create lens range
            char_start = line.find(event_id)
            lens_range = types.Range(
                start=types.Position(line=line_num, character=0),
                end=types.Position(line=line_num, character=char_start + len(event_id)),
            )

            # Create command - clicking shows references
            command = types.Command(
                title=title,
                command="editor.action.findReferences",
                arguments=[
                    document_uri,
                    {"line": line_num, "character": char_start},
                ],
            )

            lens = types.CodeLens(
                range=lens_range,
                command=command,
                data={
                    "lens_type": "event",
                    "symbol_name": event_id,
                    "uri": document_uri,
                    "ref_count": ref_count,
                    "missing_loc": missing_loc,
                },
            )
            lenses.append(lens)

    return lenses


def _find_scripted_effect_lenses(
    lines: List[str],
    document_uri: str,
    document_index: Any,
    processed_symbols: Set[str],
) -> List[types.CodeLens]:
    """
    Find scripted effect definitions and create lenses showing usage count.

    Args:
        lines: Document lines
        document_uri: Document URI
        document_index: Index with workspace symbols
        processed_symbols: Set of already processed symbols

    Returns:
        List of CodeLens objects for scripted effects
    """
    lenses = []

    # Pattern for top-level definition: name = {
    pattern = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{")

    # Skip keywords that aren't definitions
    skip_keywords = {
        "if",
        "else",
        "else_if",
        "trigger",
        "effect",
        "limit",
        "modifier",
        "hidden_effect",
        "show_as_tooltip",
        "random_list",
        "switch",
    }

    brace_depth = 0

    for line_num, line in enumerate(lines):
        # Track if we're at top level
        current_depth = brace_depth

        if current_depth == 0:
            stripped = line.lstrip()
            match = pattern.match(stripped)
            if match:
                effect_name = match.group(1)

                if effect_name in skip_keywords or effect_name in processed_symbols:
                    pass  # Skip
                else:
                    processed_symbols.add(effect_name)

                    # Count usages
                    usage_count = _count_symbol_usages(effect_name, document_index)

                    # Create lens
                    char_start = line.find(effect_name)
                    lens_range = types.Range(
                        start=types.Position(line=line_num, character=0),
                        end=types.Position(line=line_num, character=char_start + len(effect_name)),
                    )

                    title = f"⚡ Used in {usage_count} places"

                    command = types.Command(
                        title=title,
                        command="editor.action.findReferences",
                        arguments=[
                            document_uri,
                            {"line": line_num, "character": char_start},
                        ],
                    )

                    lens = types.CodeLens(
                        range=lens_range,
                        command=command,
                        data={
                            "lens_type": "scripted_effect",
                            "symbol_name": effect_name,
                            "uri": document_uri,
                            "usage_count": usage_count,
                        },
                    )
                    lenses.append(lens)

        # Update brace depth for next line
        in_string = False
        for i, char in enumerate(line):
            if char == '"' and (i == 0 or line[i - 1] != "\\"):
                in_string = not in_string
            elif not in_string:
                if char == "#":
                    break
                elif char == "{":
                    brace_depth += 1
                elif char == "}":
                    brace_depth = max(0, brace_depth - 1)

    return lenses


def _find_scripted_trigger_lenses(
    lines: List[str],
    document_uri: str,
    document_index: Any,
    processed_symbols: Set[str],
) -> List[types.CodeLens]:
    """
    Find scripted trigger definitions and create lenses showing usage count.

    Args:
        lines: Document lines
        document_uri: Document URI
        document_index: Index with workspace symbols
        processed_symbols: Set of already processed symbols

    Returns:
        List of CodeLens objects for scripted triggers
    """
    lenses = []

    # Pattern for top-level definition: name = {
    pattern = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{")

    # Skip keywords that aren't definitions
    skip_keywords = {
        "if",
        "else",
        "else_if",
        "trigger",
        "effect",
        "limit",
        "modifier",
        "hidden_effect",
        "show_as_tooltip",
        "random_list",
        "switch",
    }

    brace_depth = 0

    for line_num, line in enumerate(lines):
        # Track if we're at top level
        current_depth = brace_depth

        if current_depth == 0:
            stripped = line.lstrip()
            match = pattern.match(stripped)
            if match:
                trigger_name = match.group(1)

                if trigger_name in skip_keywords or trigger_name in processed_symbols:
                    pass  # Skip
                else:
                    processed_symbols.add(trigger_name)

                    # Count usages
                    usage_count = _count_symbol_usages(trigger_name, document_index)

                    # Create lens
                    char_start = line.find(trigger_name)
                    lens_range = types.Range(
                        start=types.Position(line=line_num, character=0),
                        end=types.Position(line=line_num, character=char_start + len(trigger_name)),
                    )

                    title = f"🔍 Used in {usage_count} places"

                    command = types.Command(
                        title=title,
                        command="editor.action.findReferences",
                        arguments=[
                            document_uri,
                            {"line": line_num, "character": char_start},
                        ],
                    )

                    lens = types.CodeLens(
                        range=lens_range,
                        command=command,
                        data={
                            "lens_type": "scripted_trigger",
                            "symbol_name": trigger_name,
                            "uri": document_uri,
                            "usage_count": usage_count,
                        },
                    )
                    lenses.append(lens)

        # Update brace depth for next line
        in_string = False
        for i, char in enumerate(line):
            if char == '"' and (i == 0 or line[i - 1] != "\\"):
                in_string = not in_string
            elif not in_string:
                if char == "#":
                    break
                elif char == "{":
                    brace_depth += 1
                elif char == "}":
                    brace_depth = max(0, brace_depth - 1)

    return lenses


def _analyze_event(
    event_id: str,
    document_index: Any,
) -> Tuple[int, int, List[str]]:
    """
    Analyze an event for reference count and missing localization.

    Args:
        event_id: The event ID to analyze
        document_index: Index with workspace symbols

    Returns:
        Tuple of (reference_count, trigger_event_count, missing_loc_keys)
    """
    ref_count = 0
    trigger_event_count = 0
    missing_loc = []

    if not document_index:
        return ref_count, trigger_event_count, missing_loc

    # Count references by searching all indexed events and their content
    # This is a simplified count - full implementation would search ASTs
    # For now, we count based on event existence in index

    # Check for expected localization keys
    expected_keys = [
        f"{event_id}.t",  # title
        f"{event_id}.desc",  # description
    ]

    # Add option keys (we don't know how many options, check common ones)
    for opt in ["a", "b", "c", "d", "e"]:
        expected_keys.append(f"{event_id}.{opt}")

    # Check which keys are missing
    for key in expected_keys:
        loc_info = document_index.find_localization(key)
        if not loc_info:
            # Only report .t and .desc as definitely missing
            if key.endswith(".t") or key.endswith(".desc"):
                missing_loc.append(key)

    return ref_count, trigger_event_count, missing_loc


def _count_symbol_usages(
    symbol_name: str,
    document_index: Any,
) -> int:
    """
    Count usages of a scripted effect or trigger across the workspace.

    Args:
        symbol_name: Name of the symbol to count
        document_index: Index with workspace symbols

    Returns:
        Number of usages found (approximate)
    """
    # This is a placeholder - full implementation would search all ASTs
    # For now, return 0 to indicate we'd need to search
    return 0


def resolve_code_lens(
    code_lens: types.CodeLens,
    document_index: Any,
) -> types.CodeLens:
    """
    Resolve a code lens with updated information.

    This is called when a code lens becomes visible and needs
    fresh data (e.g., updated reference counts).

    Args:
        code_lens: The code lens to resolve
        document_index: Index with workspace symbols

    Returns:
        Resolved CodeLens with command
    """
    if not code_lens.data:
        return code_lens

    data = code_lens.data
    lens_type = data.get("lens_type", "unknown")
    symbol_name = data.get("symbol_name", "")
    uri = data.get("uri", "")

    if lens_type == "event":
        # Re-analyze the event
        ref_count, trigger_event_count, missing_loc = _analyze_event(symbol_name, document_index)

        # Build updated title
        title_parts = []
        if ref_count > 0:
            title_parts.append(f"🔗 {ref_count} references")
        else:
            title_parts.append("🔗 0 references")

        if trigger_event_count > 0:
            title_parts.append(f"📨 {trigger_event_count} trigger_event calls")

        if missing_loc:
            missing_str = ", ".join(missing_loc[:3])
            if len(missing_loc) > 3:
                missing_str += f" (+{len(missing_loc) - 3} more)"
            title_parts.append(f"⚠️ Missing: {missing_str}")

        title = " | ".join(title_parts)

        code_lens.command = types.Command(
            title=title,
            command="editor.action.findReferences",
            arguments=[uri, {"line": code_lens.range.start.line, "character": 0}],
        )

    elif lens_type == "scripted_effect":
        usage_count = _count_symbol_usages(symbol_name, document_index)
        code_lens.command = types.Command(
            title=f"⚡ Used in {usage_count} places",
            command="editor.action.findReferences",
            arguments=[uri, {"line": code_lens.range.start.line, "character": 0}],
        )

    elif lens_type == "scripted_trigger":
        usage_count = _count_symbol_usages(symbol_name, document_index)
        code_lens.command = types.Command(
            title=f"🔍 Used in {usage_count} places",
            command="editor.action.findReferences",
            arguments=[uri, {"line": code_lens.range.start.line, "character": 0}],
        )

    elif lens_type == "namespace":
        event_count = 0
        if document_index:
            events = document_index.get_events_for_namespace(symbol_name)
            event_count = len(events)

        code_lens.command = types.Command(
            title=f"📦 {event_count} events in namespace",
            command="ck3.showNamespaceEvents",
            arguments=[symbol_name],
        )

    return code_lens
