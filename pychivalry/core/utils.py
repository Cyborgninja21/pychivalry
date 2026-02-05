"""
CK3 Language Server Utilities - Shared Helper Functions

MODULE OVERVIEW:
    This module provides shared utility functions used across multiple LSP
    feature implementations. Centralizing these functions avoids code
    duplication and ensures consistent behavior.

UTILITY CATEGORIES:
    1. **URI/Path Conversion**: Convert between file paths and URIs
    2. **Position Utilities**: Check positions within ranges
    3. **Text Utilities**: Extract words at positions
    4. **Async File I/O**: Async file reading utilities

USAGE EXAMPLES:
    >>> from pychivalry.core.utils import path_to_uri, uri_to_path
    >>> path_to_uri('/path/to/file.txt')
    'file:///path/to/file.txt'
    >>> uri_to_path('file:///path/to/file.txt')
    '/path/to/file.txt'
    
    >>> # Async file reading
    >>> content = await read_file_async(Path('file.txt'))

SEE ALSO:
    - document_links.py: Uses URI conversion for file links
    - rename.py: Uses URI conversion for workspace edits
    - hover.py: Uses text utilities for word extraction
"""

import logging
import os
from pathlib import Path
from typing import Optional, List
from urllib.parse import quote, unquote
from lsprotocol import types
import aiofiles

logger = logging.getLogger(__name__)


# =============================================================================
# URI/Path Conversion Utilities
# =============================================================================


def path_to_uri(path: str) -> str:
    """
    Convert a file path to a file:// URI.

    Handles platform-specific path formats:
    - Unix paths: /path/to/file → file:///path/to/file
    - Windows paths: C:\\path\\to\\file → file:///C:/path/to/file

    Args:
        path: The file system path to convert

    Returns:
        A file:// URI string

    Examples:
        >>> path_to_uri('/home/user/mod/events.txt')
        'file:///home/user/mod/events.txt'

        >>> path_to_uri('C:\\Users\\mod\\events.txt')
        'file:///C:/Users/mod/events.txt'
    """
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


def uri_to_path(uri: str) -> Optional[str]:
    """
    Convert a file:// URI to a file path.

    Handles platform-specific URI formats:
    - Unix: file:///path/to/file → /path/to/file
    - Windows: file:///C:/path/to/file → C:/path/to/file

    Args:
        uri: The file:// URI to convert

    Returns:
        A file system path, or None if not a valid file:// URI

    Examples:
        >>> uri_to_path('file:///home/user/mod/events.txt')
        '/home/user/mod/events.txt'

        >>> uri_to_path('file:///C:/Users/mod/events.txt')
        'C:/Users/mod/events.txt'

        >>> uri_to_path('https://example.com')
        None
    """
    if not uri.startswith("file://"):
        return None

    path = unquote(uri[7:])

    # Handle Windows paths (file:///C:/...)
    if len(path) > 2 and path[0] == "/" and path[2] == ":":
        path = path[1:]

    return path


# =============================================================================
# Position Utilities
# =============================================================================


def position_in_range(position: types.Position, range_: types.Range) -> bool:
    """
    Check if a position is within a range.

    Args:
        position: The position to check
        range_: The range to check against

    Returns:
        True if position is within range, False otherwise

    Examples:
        >>> pos = types.Position(line=5, character=10)
        >>> rng = types.Range(
        ...     start=types.Position(line=5, character=5),
        ...     end=types.Position(line=5, character=15)
        ... )
        >>> position_in_range(pos, rng)
        True
    """
    if position.line < range_.start.line or position.line > range_.end.line:
        return False

    if position.line == range_.start.line and position.character < range_.start.character:
        return False

    if position.line == range_.end.line and position.character > range_.end.character:
        return False

    return True


# =============================================================================
# Async File I/O Utilities
# =============================================================================


async def read_file_async(
    file_path: Path, encodings: Optional[List[str]] = None
) -> Optional[str]:
    """
    Asynchronously read a file with automatic encoding detection.

    This function attempts to read a file using multiple encodings, which is
    important for CK3 mod files that may use various encodings. It uses
    aiofiles for true async I/O without blocking the event loop.

    Args:
        file_path: Path to the file to read
        encodings: List of encodings to try. Defaults to common CK3 encodings.

    Returns:
        File contents as string, or None if file couldn't be read

    Examples:
        >>> content = await read_file_async(Path('events.txt'))
        >>> if content:
        ...     print(f"Read {len(content)} characters")

    Note:
        - Uses UTF-8-BOM as first choice (most common for CK3 files)
        - Falls back to other encodings if UTF-8-BOM fails
        - Returns None on all encoding failures (logs warning)
    """
    if encodings is None:
        encodings = ["utf-8-sig", "utf-8", "latin-1", "cp1252"]

    for encoding in encodings:
        try:
            async with aiofiles.open(file_path, mode="r", encoding=encoding) as f:
                return await f.read()
        except UnicodeDecodeError:
            continue
        except Exception as e:
            logger.warning(f"Error reading {file_path}: {e}")
            return None

    logger.warning(f"Could not decode {file_path} with any encoding")
    return None


async def read_file_async_single(file_path: Path, encoding: str = "utf-8-sig") -> str:
    """
    Asynchronously read a file with a single encoding.

    Simpler version for when encoding is known. Raises exceptions on error
    for proper error propagation.

    Args:
        file_path: Path to the file to read
        encoding: Encoding to use (default: utf-8-sig for UTF-8 with BOM)

    Returns:
        File contents as string

    Raises:
        UnicodeDecodeError: If file cannot be decoded with specified encoding
        FileNotFoundError: If file doesn't exist
        IOError: On other I/O errors

    Examples:
        >>> content = await read_file_async_single(Path('descriptor.mod'))
    """
    async with aiofiles.open(file_path, mode="r", encoding=encoding) as f:
        return await f.read()

