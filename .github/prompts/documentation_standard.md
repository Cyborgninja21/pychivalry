# Pychivalry Documentation Standard

## Overview
This document defines the comprehensive documentation standard for the pychivalry Language Server Protocol implementation for Crusader Kings 3 modding.

## Documentation Philosophy
**Goal**: Aggressive inline documentation where functionally every line of code has strong documentation explaining the WHY behind decisions, not just the WHAT.

## Module Documentation Structure

### 1. Module Docstring Template

```python
"""
Module Title - Brief One-Line Description

DIAGNOSTIC CODES:
    MODULE-XXX-001: Description of error/warning condition
    MODULE-XXX-002: Description of another condition
    MODULE-XXX-003: Additional error conditions
    ...

MODULE OVERVIEW:
    Comprehensive explanation of what this module does and why it exists.
    Include the problem it solves, the approach taken, and key design decisions.
    Explain the role this module plays in the larger system.

ARCHITECTURE:
    Key architectural patterns and design decisions:
    - Pattern 1: Why this pattern was chosen
    - Pattern 2: Trade-offs and benefits
    - Design Decision 3: Rationale and alternatives considered

[SPECIFIC SECTION - if applicable]:
    Module-specific information like:
    - LANGUAGE SPECIFICATION: For parsers
    - PROTOCOL DETAILS: For network/LSP modules
    - ALGORITHM DESCRIPTION: For complex processing
    - DATA STRUCTURES: For storage/indexing modules

USAGE EXAMPLES:
    >>> # Real-world usage example
    >>> result = function_call(param)
    >>> result.property  # Expected output
    
    >>> # Another example showing edge cases
    >>> edge_case = function_call(edge_param)
    >>> # Explanation of behavior

PERFORMANCE:
    - Operation 1: O(n) complexity, typical time ~Xms
    - Memory usage: ~X MB for typical use case
    - Optimization notes: Why certain optimizations were made
    - Caching strategy: If applicable

ERROR HANDLING:
    - Strategy: Fail fast / Graceful degradation / etc.
    - Error propagation: How errors are handled and reported
    - Recovery mechanisms: If applicable

SEE ALSO:
    - related_module.py: How it interacts with this module
    - another_module.py: Dependencies and relationships
    - external_library: External dependencies
"""
```

### 2. Section Dividers

Use clear section dividers for visual organization:

```python
# =============================================================================
# SECTION NAME (e.g., IMPORTS, DATA STRUCTURES, CORE FUNCTIONS, VALIDATION)
# =============================================================================
```

**Standard Sections**:
- `IMPORTS`: With explanatory comments
- `CONSTANTS`: With purpose and usage
- `DATA STRUCTURES`: Classes and dataclasses
- `CORE FUNCTIONS`: Main functionality
- `HELPER FUNCTIONS`: Utilities
- `VALIDATION FUNCTIONS`: Input/output validation
- `UTILITIES`: General utilities

### 3. Import Documentation

Document WHY each import is needed:

```python
# =============================================================================
# IMPORTS
# =============================================================================

# Standard library imports
from typing import Dict, List, Optional  # Type hints for better code clarity
from dataclasses import dataclass  # For efficient data structures with __slots__
import logging  # For diagnostic output and error tracking

# Third-party imports
from lsprotocol import types  # LSP protocol type definitions
from pygls.server import LanguageServer  # Core LSP server implementation

# Internal imports - module relationships
from .parser import parse_document  # AST generation from text
from .scopes import validate_scope_chain  # Scope validation logic
```

### 4. Constant Documentation

Every constant should explain its purpose:

```python
# Maximum number of completion suggestions to return
# Limited to prevent UI lag in editors with large suggestion lists
MAX_COMPLETIONS = 100

# Cache timeout in seconds
# Balance between memory usage and performance
# Set to 300s (5 minutes) based on typical editing patterns
CACHE_TIMEOUT = 300

# Universal scope links available in ALL scope types
# These preserve the current scope type during navigation
# - root: Original scope when script started
# - this: Current scope (explicit reference)
# - prev: Previous scope in transition chain
UNIVERSAL_LINKS = ["root", "this", "prev", "from", "fromfrom"]
```

### 5. Function Documentation Template

```python
def function_name(param1: Type1, param2: Type2) -> ReturnType:
    """
    Brief one-line description of what the function does.

    Detailed explanation of the function's purpose, behavior, and use cases.
    Explain any important algorithms or processing steps at a high level.

    Algorithm (for complex functions):
    1. Step one: What happens and why
    2. Step two: Processing logic
    3. Step three: Result construction
    4. Edge case handling

    Args:
        param1: Description of parameter including:
               - Valid value ranges or types
               - Default behavior if None/empty
               - Examples of typical values
        param2: Description with constraints and expectations
               Can span multiple lines for complex parameters

    Returns:
        Description of return value including:
        - Type and structure
        - Special values (None, empty list, etc.)
        - Example return values
        
        For complex returns:
        Structure:
        {
            'key1': 'description',
            'key2': 'description'
        }

    Raises:
        ErrorType: When this error occurs and why
        AnotherError: Conditions that trigger this error

    Examples:
        >>> # Basic usage
        >>> result = function_name('input', 42)
        >>> result  # Expected: 'output'
        
        >>> # Edge case
        >>> result = function_name('', 0)
        >>> result  # Expected: default behavior

    Performance:
        - Time complexity: O(n log n) due to sorting
        - Space complexity: O(n) for intermediate storage
        - Typical execution: <10ms for 1000 items

    Diagnostic Codes:
        MODULE-XXX: Referenced when specific conditions occur

    Notes:
        - Important caveats or limitations
        - Thread safety considerations
        - Side effects or state changes
        - TODO items if applicable

    See Also:
        related_function(): How it relates to this function
        module.other_function(): Dependencies
    """
    # Implementation with inline comments...
```

### 6. Inline Comment Standards

**Rule**: Explain WHY, not WHAT. The code already shows WHAT.

❌ **Bad** (describes what):
```python
# Increment counter
counter += 1
```

✅ **Good** (explains why):
```python
# Track number of processed items for progress reporting
counter += 1
```

❌ **Bad**:
```python
# Check if scope_type is in scopes
if scope_type not in scopes:
    return []
```

✅ **Good**:
```python
# Unknown scope types return empty list as safe fallback
# This prevents cascade failures when encountering mod-specific scopes
if scope_type not in scopes:
    logger.warning(f"Unknown scope type: {scope_type}")  # SCOPE-001
    return []  # Safe default allows parsing to continue
```

### 7. Inline Comment Placement

**Before complex blocks**:
```python
# Algorithm: Boyer-Moore string search for O(n/m) performance
# Chosen over naive O(n*m) for large file performance
for i in range(len(text)):
    # ... implementation
```

**For non-obvious logic**:
```python
# Use set for O(1) lookup instead of list O(n) search
# Performance critical in hot path (called thousands of times)
valid_items = set(valid_items)
```

**For edge cases**:
```python
# Handle empty string edge case - prevents IndexError on line[0]
if not line:
    continue
```

**For performance optimizations**:
```python
# Cache result to avoid repeated YAML file I/O
# Typical 50ms file load → <1ms cached lookup
if cache is None:
    cache = load_data()
```

### 8. Class and Dataclass Documentation

```python
@dataclass(slots=True)
class CK3Node:
    """
    Abstract Syntax Tree node for CK3 script parsing.

    Represents a single element in the parsed CK3 script. Nodes form a tree
    structure where parent nodes contain child nodes, enabling hierarchical
    representation of script structure.

    MEMORY OPTIMIZATION:
    Uses __slots__ to reduce memory footprint by 30-50%. For large mods with
    thousands of nodes, this saves 10-50 MB of RAM.

    NODE TYPES:
    - 'block': Named block with children (e.g., trigger = { ... })
    - 'assignment': Key-value pair (e.g., gold = 100)
    - 'list': Collection of items
    - 'comment': Comment line
    - 'event': Event definition

    SCOPE TRACKING:
    Each node tracks its scope type (character, title, etc.) enabling
    scope-aware validation and intelligent completions.

    Attributes:
        type: Node type string (see NODE TYPES above)
        key: Identifier or key name
        value: Node value - string, number, or None for containers
        range: LSP Range with start/end positions
        parent: Reference to parent node (None for root)
        scope_type: Current scope for validation
        children: List of child nodes

    Examples:
        >>> node = CK3Node(
        ...     type='assignment',
        ...     key='gold',
        ...     value=100,
        ...     range=types.Range(...)
        ... )

    Performance:
        With __slots__: ~50 bytes per node
        Without __slots__: ~150 bytes per node (3x overhead)
    """
    type: str  # Node type classification
    key: str  # Identifier
    value: Any  # Value or None for containers
    range: types.Range  # Position in document
    parent: Optional["CK3Node"] = None  # Parent reference
    scope_type: str = "unknown"  # For validation
    children: List["CK3Node"] = field(default_factory=list)  # Nested nodes
```

### 9. Diagnostic Code System

**Format**: `MODULE-XXX`
- MODULE: Module name (SCOPE, DATA, PARSE, LIST, etc.)
- XXX: Three-digit code (001, 002, 003...)

**Usage**:
1. Define all codes in module docstring
2. Reference in function docstrings
3. Include in log messages

```python
"""
DIAGNOSTIC CODES:
    SCOPE-001: Unknown scope type
    SCOPE-002: Invalid scope link
    SCOPE-003: Invalid scope chain
"""

def validate_scope(scope_type: str) -> bool:
    """
    Diagnostic Codes:
        SCOPE-001: Emitted when scope_type is unknown
    """
    if scope_type not in known_scopes:
        logger.warning(f"Unknown scope: {scope_type}")  # SCOPE-001
        return False
    return True
```

## Documentation Ratio Target

**Target**: 45-60% documentation to code ratio

This means for every 100 lines of code, expect 45-60 lines of documentation including:
- Module docstrings
- Function docstrings  
- Inline comments
- Section dividers

## Quality Checklist

Before considering documentation complete, verify:

- [ ] Module docstring with diagnostic codes
- [ ] All imports have explanatory comments
- [ ] Constants document their purpose and values
- [ ] All functions have complete docstrings
- [ ] Complex algorithms have step-by-step explanations
- [ ] Performance characteristics documented where relevant
- [ ] Edge cases explicitly handled and documented
- [ ] Error conditions reference diagnostic codes
- [ ] Section dividers for organization
- [ ] Examples for public API functions
- [ ] Cross-references to related modules

## Examples of Excellent Documentation

See these completed files as references:
- `scopes.py`: Comprehensive scope system documentation
- `data/__init__.py`: Data loading with caching patterns
- `parser.py`: Two-phase parsing with algorithm explanations
- `lists.py`: Iterator validation with categorized constants

## Anti-Patterns to Avoid

❌ **Don't**: Document the obvious
```python
# Create a list
items = []
```

❌ **Don't**: Repeat the code in English
```python
# If x is greater than 10
if x > 10:
```

❌ **Don't**: Leave complex logic uncommented
```python
result = [(i, j) for i in range(n) for j in range(m) if matrix[i][j]]
```

✅ **Do**: Explain the why and the algorithm
```python
# Build coordinate pairs for non-zero matrix elements
# Using list comprehension for O(n*m) single pass
# Alternative: nested loops with same complexity but less Pythonic
result = [(i, j) for i in range(n) for j in range(m) if matrix[i][j]]
```

## Maintenance

This standard should be:
1. Applied to all new code
2. Used when refactoring existing code
3. Referenced in code review guidelines
4. Updated as patterns evolve

Last Updated: 2026-01-01
