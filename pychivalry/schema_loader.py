"""
Schema Loader - Load and merge validation schemas from YAML files.

This module is responsible for loading schema files from the data/schemas/ directory,
resolving schema inheritance, variable references, and providing cached access to
schemas and diagnostic definitions.

Responsibilities:
- Load schema files from data/schemas/
- Resolve inheritance ($extends)
- Resolve variable references ($variable_name)
- Cache parsed schemas for performance
- Provide schema lookup by file type and path
- Load centralized diagnostic definitions
"""

from pathlib import Path
from typing import Dict, Any, Optional, List
import yaml
import logging
import fnmatch

logger = logging.getLogger(__name__)

# Schema and diagnostics file locations
SCHEMAS_DIR = Path(__file__).parent / "data" / "schemas"
DIAGNOSTICS_FILE = Path(__file__).parent / "data" / "diagnostics.yaml"
TYPES_FILE = SCHEMAS_DIR / "_types.yaml"


class SchemaLoader:
    """Load and cache validation schemas from YAML files."""

    def __init__(self) -> None:
        """Initialize the schema loader with empty caches."""
        self._schemas: Dict[str, Dict[str, Any]] = {}
        self._diagnostics: Dict[str, Dict[str, Any]] = {}
        self._types: Dict[str, Dict[str, Any]] = {}  # Type definitions from _types.yaml
        self._file_type_cache: Dict[str, str] = {}  # path -> schema_name
        self._loaded = False

    def load_all(self) -> None:
        """Load all schemas and diagnostics from disk."""
        if self._loaded:
            return

        self._load_diagnostics()
        self._load_types()
        self._load_schemas()
        self._loaded = True
        logger.info(f"Loaded {len(self._schemas)} schemas, {len(self._diagnostics)} diagnostics, and {len(self._types)} type definitions")

    def _load_diagnostics(self) -> None:
        """Load centralized diagnostics definitions from diagnostics.yaml."""
        if not DIAGNOSTICS_FILE.exists():
            logger.warning(f"Diagnostics file not found: {DIAGNOSTICS_FILE}")
            return

        try:
            with open(DIAGNOSTICS_FILE, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and 'diagnostics' in data:
                    self._diagnostics = data['diagnostics']
                    logger.debug(f"Loaded {len(self._diagnostics)} diagnostic definitions")
        except Exception as e:
            logger.error(f"Failed to load diagnostics from {DIAGNOSTICS_FILE}: {e}")

    def _load_types(self) -> None:
        """Load type definitions from _types.yaml."""
        if not TYPES_FILE.exists():
            logger.warning(f"Types file not found: {TYPES_FILE}")
            return

        try:
            with open(TYPES_FILE, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and 'types' in data:
                    self._types = data['types']
                    logger.debug(f"Loaded {len(self._types)} type definitions")
        except Exception as e:
            logger.error(f"Failed to load types from {TYPES_FILE}: {e}")

    def _load_schemas(self) -> None:
        """Load all schema files from the schemas directory."""
        if not SCHEMAS_DIR.exists():
            logger.warning(f"Schemas directory not found: {SCHEMAS_DIR}")
            return

        # Load all YAML files except those starting with underscore (base/types)
        for schema_file in SCHEMAS_DIR.glob("*.yaml"):
            if schema_file.name.startswith("_"):
                continue  # Skip base and type definition files

            try:
                with open(schema_file, 'r', encoding='utf-8') as f:
                    schema = yaml.safe_load(f)
                    if schema and 'file_type' in schema:
                        # Resolve variable references in the schema
                        self._resolve_references(schema)
                        self._schemas[schema['file_type']] = schema
                        logger.debug(f"Loaded schema: {schema['file_type']} from {schema_file.name}")
            except Exception as e:
                logger.error(f"Failed to load schema {schema_file}: {e}")

    def _resolve_references(self, schema: Dict[str, Any]) -> None:
        """
        Resolve $variable references in schema.

        Variables are defined in the 'constants' section of each schema and can be
        referenced elsewhere using the $variable_name syntax.
        """
        constants = schema.get('constants', {})
        if constants:
            self._resolve_in_dict(schema, constants)

    def _resolve_in_dict(self, obj: Any, constants: Dict[str, Any]) -> None:
        """
        Recursively resolve variable references in a dictionary or list.

        Args:
            obj: The object to process (dict, list, or other)
            constants: Dictionary of constants for variable resolution
        """
        if isinstance(obj, dict):
            for key, value in list(obj.items()):
                if isinstance(value, str) and value.startswith('$'):
                    var_name = value[1:]
                    if var_name in constants:
                        obj[key] = constants[var_name]
                else:
                    self._resolve_in_dict(value, constants)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, str) and item.startswith('$'):
                    var_name = item[1:]
                    if var_name in constants:
                        obj[i] = constants[var_name]
                else:
                    self._resolve_in_dict(item, constants)

    def get_schema_for_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get the appropriate schema for a file path.

        The schema is determined by matching the file path against the path_patterns
        defined in each schema's identification section.

        Args:
            file_path: Path to the file to get schema for

        Returns:
            The schema dictionary if found, None otherwise
        """
        # Ensure schemas are loaded
        if not self._loaded:
            self.load_all()

        # Check cache first for performance
        if file_path in self._file_type_cache:
            schema_name = self._file_type_cache[file_path]
            return self._schemas.get(schema_name)

        # Normalize path separators for cross-platform matching
        normalized_path = file_path.replace('\\', '/')

        # Find matching schema by path pattern
        for schema_name, schema in self._schemas.items():
            patterns = schema.get('identification', {}).get('path_patterns', [])
            for pattern in patterns:
                if fnmatch.fnmatch(normalized_path, pattern):
                    # Cache the result
                    self._file_type_cache[file_path] = schema_name
                    logger.debug(f"Matched {file_path} to schema {schema_name}")
                    return schema

        # No matching schema found
        logger.debug(f"No schema found for {file_path}")
        return None

    def get_diagnostic(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Get diagnostic definition by code.

        Args:
            code: The diagnostic code (e.g., 'CK3760', 'STORY-001')

        Returns:
            The diagnostic definition dictionary if found, None otherwise
        """
        if not self._loaded:
            self.load_all()

        return self._diagnostics.get(code)

    def get_all_schemas(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all loaded schemas.

        Returns:
            Dictionary mapping schema names to schema definitions
        """
        if not self._loaded:
            self.load_all()

        return self._schemas.copy()

    def get_all_diagnostics(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all loaded diagnostic definitions.

        Returns:
            Dictionary mapping diagnostic codes to definitions
        """
        if not self._loaded:
            self.load_all()

        return self._diagnostics.copy()

    def get_type_definition(self, type_name: str) -> Optional[Dict[str, Any]]:
        """
        Get type definition from _types.yaml by name.

        Args:
            type_name: The type name (e.g., 'localization_key', 'integer', 'effect_block')

        Returns:
            The type definition dictionary if found, None otherwise
        """
        if not self._loaded:
            self.load_all()

        return self._types.get(type_name)

    def clear_cache(self) -> None:
        """Clear all caches and force reload on next access."""
        self._schemas.clear()
        self._diagnostics.clear()
        self._types.clear()
        self._file_type_cache.clear()
        self._loaded = False
        logger.info("Schema cache cleared")

    def reload(self) -> None:
        """Reload all schemas and diagnostics from disk."""
        self.clear_cache()
        self.load_all()
