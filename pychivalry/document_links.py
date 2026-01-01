"""
Document Links Module for CK3 Language Server.

This module provides clickable links within CK3 script files for:
- File paths (gfx/interface/icons/my_icon.dds, common/scripted_effects/file.txt)
- Event IDs in comments (# See rq.0050)
- URLs (https://ck3.paradoxwikis.com/...)
- Localization keys referenced in comments

LSP Reference:
    https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentLink
"""

import re
import os
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple
from urllib.parse import quote
from lsprotocol import types

logger = logging.getLogger(__name__)


@dataclass
class LinkInfo:
    """
    Information about a detected link.

    Attributes:
        target: The link target (file path, URL, or event ID)
        link_type: Type of link (file, url, event, localization)
        line: Line number (0-indexed)
        start: Start character position
        end: End character position
        tooltip: Optional tooltip text
    """

    target: str
    link_type: str
    line: int
    start: int
    end: int
    tooltip: Optional[str] = None


# Common CK3 mod directory patterns
CK3_PATH_PREFIXES = (
    "common/",
    "events/",
    "gfx/",
    "gui/",
    "localization/",
    "map_data/",
    "music/",
    "sound/",
    "history/",
    "dlc/",
)

# File extensions that are linkable
LINKABLE_EXTENSIONS = (
    ".txt",
    ".yml",
    ".yaml",
    ".dds",
    ".png",
    ".tga",
    ".mesh",
    ".asset",
    ".gui",
    ".gfx",
    ".shader",
    ".settings",
    ".mod",
    ".json",
)


# =============================================================================
# Regex Patterns
# =============================================================================

# File path pattern - matches common CK3 paths
# Matches: common/scripted_effects/my_effects.txt, gfx/icons/icon.dds
FILE_PATH_PATTERN = re.compile(
    r"\b("
    r"(?:common|events|gfx|gui|localization|map_data|music|sound|history|dlc)"
    r"/[a-zA-Z0-9_/.-]+"
    r"(?:\.(?:txt|yml|yaml|dds|png|tga|mesh|asset|gui|gfx|shader|settings|mod|json))?"
    r")\b"
)

# Relative path pattern - matches paths starting with ./
RELATIVE_PATH_PATTERN = re.compile(r'(?:^|\s|"|\')(\.\./[a-zA-Z0-9_/.-]+|\.\/[a-zA-Z0-9_/.-]+)')

# URL pattern - matches http:// and https:// URLs
URL_PATTERN = re.compile(r'(https?://[^\s<>"\')\]]+)')

# Event ID pattern (used after confirming line is a comment)
# Matches: rq.0001, my_mod.0050, my_event.100
EVENT_ID_PATTERN = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]*\.\d+)\b")

# Localization key in comments pattern
# Matches: # Localization: my_mod.0001.t, # See loc key my_event_desc
LOC_KEY_COMMENT_PATTERN = re.compile(
    r"#[^#\n]*(?:loc(?:alization)?(?:\s+key)?|text|string)[:\s]+([a-zA-Z_][a-zA-Z0-9_.]+)\b",
    re.IGNORECASE,
)

# GFX path in script (not just comments)
# Matches: icon = "gfx/interface/icons/icon.dds"
GFX_SCRIPT_PATTERN = re.compile(r'(?:icon|texture|sprite|background)\s*=\s*"([^"]+)"')


def get_document_links(
    text: str,
    document_uri: str,
    workspace_folders: Optional[List[str]] = None,
) -> List[types.DocumentLink]:
    """
    Get all document links in a file.

    Args:
        text: Document text
        document_uri: URI of the document
        workspace_folders: List of workspace folder paths for resolving relative paths

    Returns:
        List of DocumentLink objects
    """
    links: List[types.DocumentLink] = []
    lines = text.split("\n")

    # Extract document path for resolving relative links
    doc_path = _uri_to_path(document_uri)
    doc_dir = os.path.dirname(doc_path) if doc_path else None

    for line_num, line in enumerate(lines):
        # Find file paths
        links.extend(_find_file_paths(line, line_num, workspace_folders, doc_dir))

        # Find URLs
        links.extend(_find_urls(line, line_num))

        # Find event IDs in comments
        links.extend(_find_event_ids(line, line_num, workspace_folders))

        # Find GFX paths in script
        links.extend(_find_gfx_paths(line, line_num, workspace_folders, doc_dir))

    return links


def _find_file_paths(
    line: str,
    line_num: int,
    workspace_folders: Optional[List[str]],
    doc_dir: Optional[str],
) -> List[types.DocumentLink]:
    """Find file path references in a line."""
    links = []

    # Find CK3 paths (common/, events/, gfx/, etc.)
    for match in FILE_PATH_PATTERN.finditer(line):
        path = match.group(1)
        resolved = _resolve_path(path, workspace_folders, doc_dir)

        link = types.DocumentLink(
            range=types.Range(
                start=types.Position(line=line_num, character=match.start(1)),
                end=types.Position(line=line_num, character=match.end(1)),
            ),
            target=resolved,
            tooltip=f"Open {path}" if resolved else f"File not found: {path}",
        )
        links.append(link)

    # Find relative paths (../, ./)
    for match in RELATIVE_PATH_PATTERN.finditer(line):
        path = match.group(1)
        resolved = _resolve_relative_path(path, doc_dir)

        if resolved:
            link = types.DocumentLink(
                range=types.Range(
                    start=types.Position(line=line_num, character=match.start(1)),
                    end=types.Position(line=line_num, character=match.end(1)),
                ),
                target=resolved,
                tooltip=f"Open {os.path.basename(path)}",
            )
            links.append(link)

    return links


def _find_urls(line: str, line_num: int) -> List[types.DocumentLink]:
    """Find URL references in a line."""
    links = []

    for match in URL_PATTERN.finditer(line):
        url = match.group(1)
        # Clean up trailing punctuation that might have been captured
        url = url.rstrip(".,;:!?")

        link = types.DocumentLink(
            range=types.Range(
                start=types.Position(line=line_num, character=match.start(1)),
                end=types.Position(line=line_num, character=match.start(1) + len(url)),
            ),
            target=url,
            tooltip=_get_url_tooltip(url),
        )
        links.append(link)

    return links


def _find_event_ids(
    line: str,
    line_num: int,
    workspace_folders: Optional[List[str]],
) -> List[types.DocumentLink]:
    """Find event ID references in comments."""
    links = []

    # Only look in comment lines
    comment_start = line.find("#")
    if comment_start == -1:
        return links

    # Search for event IDs in the comment portion of the line
    comment_text = line[comment_start:]

    for match in EVENT_ID_PATTERN.finditer(comment_text):
        event_id = match.group(1)

        # Calculate actual position in the full line
        actual_start = comment_start + match.start(1)
        actual_end = comment_start + match.end(1)

        # Create a command link that will trigger go-to-definition
        # Format: command:ck3.goToEvent?eventId
        command_uri = f"command:ck3.goToEvent?{quote(event_id)}"

        link = types.DocumentLink(
            range=types.Range(
                start=types.Position(line=line_num, character=actual_start),
                end=types.Position(line=line_num, character=actual_end),
            ),
            target=command_uri,
            tooltip=f"Go to event {event_id}",
            data={"type": "event", "id": event_id},
        )
        links.append(link)

    return links


def _find_gfx_paths(
    line: str,
    line_num: int,
    workspace_folders: Optional[List[str]],
    doc_dir: Optional[str],
) -> List[types.DocumentLink]:
    """Find GFX path references in script (icon = "gfx/...")."""
    links = []

    for match in GFX_SCRIPT_PATTERN.finditer(line):
        path = match.group(1)

        # Only link if it looks like a file path
        if "/" in path or "\\" in path:
            resolved = _resolve_path(path, workspace_folders, doc_dir)

            # Calculate position within the quoted string
            full_match = match.group(0)
            quote_start = full_match.find('"') + 1
            path_start = match.start() + quote_start

            link = types.DocumentLink(
                range=types.Range(
                    start=types.Position(line=line_num, character=path_start),
                    end=types.Position(line=line_num, character=path_start + len(path)),
                ),
                target=resolved,
                tooltip=f"Open {os.path.basename(path)}" if resolved else f"File not found: {path}",
            )
            links.append(link)

    return links


def _resolve_path(
    path: str,
    workspace_folders: Optional[List[str]],
    doc_dir: Optional[str],
) -> Optional[str]:
    """
    Resolve a CK3 path to a file URI.

    Searches in workspace folders for the file.

    Args:
        path: The path to resolve (e.g., "common/scripted_effects/file.txt")
        workspace_folders: List of workspace folder paths
        doc_dir: Directory of the current document

    Returns:
        File URI if found, None otherwise
    """
    if not workspace_folders:
        workspace_folders = []

    # Add doc_dir's parent as a potential root (for mod structure)
    if doc_dir:
        # Try to find mod root by looking for descriptor.mod or common/events folders
        potential_root = _find_mod_root(doc_dir)
        if potential_root and potential_root not in workspace_folders:
            workspace_folders = [potential_root] + list(workspace_folders)

    # Normalize path separators
    path = path.replace("\\", "/")

    for folder in workspace_folders:
        full_path = os.path.join(folder, path)
        if os.path.exists(full_path):
            return _path_to_uri(full_path)

    return None


def _resolve_relative_path(
    path: str,
    doc_dir: Optional[str],
) -> Optional[str]:
    """
    Resolve a relative path to a file URI.

    Args:
        path: Relative path (e.g., "../other_file.txt")
        doc_dir: Directory of the current document

    Returns:
        File URI if found, None otherwise
    """
    if not doc_dir:
        return None

    full_path = os.path.normpath(os.path.join(doc_dir, path))

    if os.path.exists(full_path):
        return _path_to_uri(full_path)

    return None


def _find_mod_root(start_dir: str) -> Optional[str]:
    """
    Find the mod root directory by looking for descriptor.mod or standard folders.

    Args:
        start_dir: Directory to start searching from

    Returns:
        Mod root path if found, None otherwise
    """
    current = start_dir

    # Limit search depth
    for _ in range(10):
        # Check for descriptor.mod
        if os.path.exists(os.path.join(current, "descriptor.mod")):
            return current

        # Check for common CK3 mod structure
        if os.path.isdir(os.path.join(current, "common")) or os.path.isdir(
            os.path.join(current, "events")
        ):
            return current

        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent

    return None


def _path_to_uri(path: str) -> str:
    """Convert a file path to a file:// URI."""
    # Normalize path
    path = os.path.normpath(path)

    # Convert to forward slashes
    path = path.replace("\\", "/")

    # Handle Windows drive letters
    if len(path) >= 2 and path[1] == ":":
        path = "/" + path

    # Encode spaces and special characters
    path = quote(path, safe="/:")

    return f"file://{path}"


def _uri_to_path(uri: str) -> Optional[str]:
    """Convert a file:// URI to a file path."""
    if not uri.startswith("file://"):
        return None

    from urllib.parse import unquote

    path = unquote(uri[7:])

    # Handle Windows paths (file:///C:/...)
    if len(path) > 2 and path[0] == "/" and path[2] == ":":
        path = path[1:]

    return path


def _get_url_tooltip(url: str) -> str:
    """Generate a tooltip for a URL based on its domain."""
    if "paradoxwikis.com" in url:
        return "Open CK3 Wiki page"
    elif "github.com" in url:
        return "Open GitHub page"
    elif "discord" in url:
        return "Open Discord link"
    elif "forum.paradoxplaza.com" in url:
        return "Open Paradox Forums"
    else:
        return "Open external link"


def resolve_document_link(
    link: types.DocumentLink,
    workspace_folders: Optional[List[str]] = None,
) -> types.DocumentLink:
    """
    Resolve a document link that was previously returned without a target.

    This is called by the LSP when the client needs the full target.

    Args:
        link: The link to resolve
        workspace_folders: List of workspace folder paths

    Returns:
        DocumentLink with resolved target
    """
    # If link already has a target, return as-is
    if link.target:
        return link

    # If we have data with event info, try to resolve it
    if link.data and isinstance(link.data, dict):
        link_type = link.data.get("type")

        if link_type == "event":
            event_id = link.data.get("id")
            if event_id:
                # Return command link
                link.target = f"command:ck3.goToEvent?{quote(event_id)}"

    return link


# =============================================================================
# Additional Pattern Detection
# =============================================================================


def find_localization_references(
    text: str,
    line_num: int,
) -> List[LinkInfo]:
    """
    Find localization key references in a line.

    This is for advanced features - detecting loc keys like:
    - title = my_event.0001.t
    - desc = my_event.0001.desc

    Args:
        text: Line text
        line_num: Line number

    Returns:
        List of LinkInfo objects
    """
    links = []

    # Pattern for localization key assignments
    loc_pattern = re.compile(r"(?:title|desc|name|tooltip|text)\s*=\s*([a-zA-Z_][a-zA-Z0-9_.]+)")

    for match in loc_pattern.finditer(text):
        key = match.group(1)

        # Skip if it looks like a variable or scope reference
        if ":" in key or key.startswith("scope"):
            continue

        links.append(
            LinkInfo(
                target=key,
                link_type="localization",
                line=line_num,
                start=match.start(1),
                end=match.end(1),
                tooltip=f"Localization key: {key}",
            )
        )

    return links


def get_link_at_position(
    text: str,
    position: types.Position,
    document_uri: str,
    workspace_folders: Optional[List[str]] = None,
) -> Optional[types.DocumentLink]:
    """
    Get the link at a specific position, if any.

    Useful for resolving links on-demand.

    Args:
        text: Document text
        position: Cursor position
        document_uri: Document URI
        workspace_folders: Workspace folders

    Returns:
        DocumentLink if position is on a link, None otherwise
    """
    links = get_document_links(text, document_uri, workspace_folders)

    for link in links:
        if _position_in_range(position, link.range):
            return link

    return None


def _position_in_range(position: types.Position, range_: types.Range) -> bool:
    """Check if a position is within a range."""
    if position.line < range_.start.line or position.line > range_.end.line:
        return False

    if position.line == range_.start.line and position.character < range_.start.character:
        return False

    if position.line == range_.end.line and position.character > range_.end.character:
        return False

    return True
