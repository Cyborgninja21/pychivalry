"""
CK3 Graphics File Validator - Validate GFX File References

DIAGNOSTIC CODES:
    GFX001: Graphics file not found

MODULE OVERVIEW:
    Validates that referenced graphics files (DDS, PNG, TGA) exist on disk.
    Prevents pink/black checkerboard patterns in-game by catching missing
    files during development.
    
    Works in conjunction with document_links.py which makes GFX paths clickable.

ARCHITECTURE:
    **Validation Pipeline**:
    1. Parse AST to find graphics reference patterns
    2. Extract file paths from assignments (icon =, texture =, etc.)
    3. Resolve paths relative to workspace folders
    4. Check if files exist on disk
    5. Generate diagnostics for missing files
    
    **Supported Patterns**:
    - icon = "gfx/path/to/file.dds"
    - texture = "gfx/path/to/file.dds"
    - reference = "gfx/path/to/file.png"
    - background = "gfx/path/to/file.dds"
    - portrait_texture = "gfx/path/to/file.dds"
    - sprite = "gfx/path/to/file.dds"
    
    **File Types**:
    - .dds (DirectDraw Surface - primary format)
    - .png (Portable Network Graphics)
    - .tga (Targa)

USAGE EXAMPLES:
    >>> # Validate graphics in AST
    >>> diagnostics = check_graphics_files(ast, workspace_folders)
    >>> len(diagnostics)
    1  # Found 1 missing file
    >>> diagnostics[0].code
    'GFX001'
    >>> diagnostics[0].message
    'Graphics file not found: "gfx/interface/icons/missing.dds"'

PERFORMANCE:
    - File existence check: ~1ms per file (cached by OS)
    - Typical file: ~5-10 graphics references
    - Total time: ~10-20ms per file
    
    Caching Strategy:
    - OS-level file system cache handles repeated checks
    - No additional caching needed in Python layer

LSP INTEGRATION:
    Called from diagnostics.py as part of collect_all_diagnostics()
    - Runs after syntax and semantic checks
    - Generates warnings (not errors) for missing files
    - User can click diagnostic to see file location

SEE ALSO:
    - document_links.py: Makes GFX paths clickable
    - diagnostics.py: Main diagnostics pipeline
    - data/diagnostics.yaml: Diagnostic code definitions
"""

import os
import re
import logging
from typing import List, Optional, Set
from lsprotocol import types

from .parser import CK3Node
from .diagnostics import create_diagnostic

logger = logging.getLogger(__name__)

# Graphics file extensions supported by CK3
GRAPHICS_EXTENSIONS = {".dds", ".png", ".tga"}

# Keywords that reference graphics files
# Based on document_links.py GFX_SCRIPT_PATTERN and extended
GRAPHICS_KEYWORDS = {
    "icon",
    "texture",
    "sprite",
    "background",
    "portrait_texture",
    "reference",
    "illustration",
    "image",
    "activity_window_background",  # Activities
    "background_texture",           # GUI
    "icon_texture",                 # GUI
}


def is_graphics_reference(key: str) -> bool:
    """
    Check if a key is a graphics file reference.
    
    Args:
        key: The key to check (e.g., "icon", "texture")
        
    Returns:
        True if the key references graphics files
    """
    return key in GRAPHICS_KEYWORDS


def extract_file_path(value: str) -> Optional[str]:
    """
    Extract file path from a value string.
    
    Handles quoted strings and returns the path.
    
    Args:
        value: Value string (may include quotes)
        
    Returns:
        Cleaned file path or None if invalid
    """
    if not value:
        return None
    
    # Remove quotes if present
    cleaned = value.strip().strip('"').strip("'")
    
    # Must contain a path separator to be a file path
    if "/" not in cleaned and "\\" not in cleaned:
        return None
    
    # Normalize path separators
    cleaned = cleaned.replace("\\", "/")
    
    # Must look like a graphics path (start with gfx/ or be a relative path)
    if not (cleaned.startswith("gfx/") or cleaned.startswith("../") or cleaned.startswith("./")):
        return None
    
    return cleaned


def resolve_graphics_path(
    path: str,
    workspace_folders: Optional[List[str]] = None,
    doc_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve a graphics path to an absolute file path.
    
    Searches workspace folders for the file, similar to document_links.py.
    
    Args:
        path: Relative path (e.g., "gfx/interface/icons/icon.dds")
        workspace_folders: List of workspace folder paths
        doc_dir: Directory of current document
        
    Returns:
        Absolute file path if found, None otherwise
    """
    if not workspace_folders:
        workspace_folders = []
    
    # Add doc_dir's parent as potential root (for mod structure)
    if doc_dir:
        potential_root = _find_mod_root(doc_dir)
        if potential_root and potential_root not in workspace_folders:
            workspace_folders = [potential_root] + list(workspace_folders)
    
    # Normalize path separators
    path = path.replace("\\", "/")
    
    # Try each workspace folder
    for folder in workspace_folders:
        full_path = os.path.join(folder, path)
        if os.path.exists(full_path):
            return full_path
    
    return None


def _find_mod_root(start_dir: str) -> Optional[str]:
    """
    Find the mod root directory by looking for descriptor.mod or standard folders.
    
    This is a simplified version of the function from document_links.py.
    
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


def check_graphics_files(
    ast: List[CK3Node],
    workspace_folders: Optional[List[str]] = None,
    doc_dir: Optional[str] = None,
) -> List[types.Diagnostic]:
    """
    Check for missing graphics file references in the AST.
    
    Validates that all referenced graphics files exist on disk.
    
    Args:
        ast: Parsed AST nodes
        workspace_folders: List of workspace folder paths
        doc_dir: Directory of current document
        
    Returns:
        List of diagnostics for missing graphics files
    """
    diagnostics = []
    checked_paths: Set[str] = set()  # Avoid duplicate checks
    
    def check_node(node: CK3Node):
        """Recursively check a node for graphics references."""
        # Check if this is a graphics reference assignment
        if node.key and is_graphics_reference(node.key) and node.value:
            # Extract the file path
            file_path = extract_file_path(node.value)
            
            if file_path and file_path not in checked_paths:
                checked_paths.add(file_path)
                
                # Resolve to absolute path
                resolved = resolve_graphics_path(file_path, workspace_folders, doc_dir)
                
                if not resolved:
                    # File not found - create diagnostic
                    diagnostics.append(
                        create_diagnostic(
                            message=f"Graphics file not found: '{file_path}'",
                            range_=node.range,
                            severity=types.DiagnosticSeverity.Warning,
                            code="GFX001",
                        )
                    )
                    logger.debug(f"Missing graphics file: {file_path} (node at {node.range})")
        
        # Recursively check children
        for child in node.children:
            check_node(child)
    
    # Check all top-level nodes
    for node in ast:
        check_node(node)
    
    return diagnostics
