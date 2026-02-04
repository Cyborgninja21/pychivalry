"""
Schema System - YAML-Based Validation and Auto-completion

This subpackage provides the schema-driven validation framework:
- Loader: Load and parse YAML schema definitions with inheritance resolution
- Validator: Schema-based validation engine for CK3 script structures
- Completions: Schema-aware auto-completion suggestions
- Hover: Schema-based hover documentation
- Symbols: Schema-driven document symbol extraction
"""

# Re-export all public symbols for backward compatibility
from .loader import SchemaLoader
from .validator import SchemaValidator
from .completions import SchemaCompletionProvider
from .hover import SchemaHoverProvider
from .symbols import SchemaSymbolExtractor

__all__ = [
    # Loader
    "SchemaLoader",
    # Validator
    "SchemaValidator",
    # Completions
    "SchemaCompletionProvider",
    # Hover
    "SchemaHoverProvider",
    # Symbols
    "SchemaSymbolExtractor",
]
