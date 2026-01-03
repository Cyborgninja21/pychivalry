"""
Schema-based Completions - File-type-aware completion provider.

This module provides completions based on schema definitions, making completions
file-type-aware and automatically supporting new file types as schemas are added.

Responsibilities:
- Load field_docs from schemas for the current file type
- Convert field documentation to LSP CompletionItem objects
- Provide context-appropriate completions based on cursor position
- Generate snippets with proper formatting and placeholders
"""

from typing import List, Optional, Dict, Any
from lsprotocol.types import (
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupContent,
    MarkupKind,
)
import logging

from .schema_loader import SchemaLoader

logger = logging.getLogger(__name__)


class SchemaCompletionProvider:
    """Provide completions based on schema field documentation."""

    def __init__(self, schema_loader: SchemaLoader) -> None:
        """
        Initialize the completion provider.

        Args:
            schema_loader: Schema loader instance for accessing schemas
        """
        self.loader = schema_loader

    def get_field_completions(
        self, file_path: str, context: Optional[str] = None
    ) -> List[CompletionItem]:
        """
        Get completions for fields in the given file type.

        Args:
            file_path: Path to the file being edited
            context: Optional context string (e.g., "option", "effect_group")

        Returns:
            List of completion items for available fields
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema or 'field_docs' not in schema:
            return []

        completions = []
        field_docs = schema['field_docs']

        for field_name, docs in field_docs.items():
            completion = self._create_completion_item(field_name, docs)
            if completion:
                completions.append(completion)

        logger.debug(f"Generated {len(completions)} schema-based completions for {file_path}")
        return completions

    def get_nested_field_completions(
        self, file_path: str, nested_schema: str
    ) -> List[CompletionItem]:
        """
        Get completions for fields in a nested schema.

        Args:
            file_path: Path to the file being edited
            nested_schema: Name of the nested schema (e.g., "option", "effect_group")

        Returns:
            List of completion items for nested schema fields
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema or 'nested_schemas' not in schema:
            return []

        nested_schemas = schema['nested_schemas']
        if nested_schema not in nested_schemas:
            return []

        nested = nested_schemas[nested_schema]
        if 'field_docs' not in nested:
            return []

        completions = []
        for field_name, docs in nested['field_docs'].items():
            completion = self._create_completion_item(field_name, docs)
            if completion:
                completions.append(completion)

        return completions

    def _create_completion_item(
        self, field_name: str, docs: Dict[str, Any]
    ) -> Optional[CompletionItem]:
        """
        Create a CompletionItem from field documentation.

        Args:
            field_name: Name of the field
            docs: Documentation dictionary with description, detail, snippet

        Returns:
            CompletionItem or None if documentation is invalid
        """
        if not isinstance(docs, dict):
            return None

        # Extract documentation components
        description = docs.get('description', '')
        detail = docs.get('detail', '')
        snippet = docs.get('snippet', f'{field_name} = $0')

        # Create the completion item
        completion = CompletionItem(
            label=field_name,
            kind=CompletionItemKind.Field,
            detail=detail,
            documentation=MarkupContent(
                kind=MarkupKind.Markdown,
                value=description
            ) if description else None,
            insert_text=snippet,
            insert_text_format=InsertTextFormat.Snippet,
            sort_text=f"1_{field_name}",  # Schema fields get priority
        )

        return completion

    def get_enum_value_completions(
        self, file_path: str, field_name: str
    ) -> List[CompletionItem]:
        """
        Get completions for enum field values.

        Args:
            file_path: Path to the file being edited
            field_name: Name of the enum field

        Returns:
            List of completion items for enum values
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema or 'fields' not in schema:
            return []

        fields = schema['fields']
        if field_name not in fields:
            return []

        field_def = fields[field_name]
        if field_def.get('type') != 'enum' or 'values' not in field_def:
            return []

        completions = []
        for value in field_def['values']:
            completion = CompletionItem(
                label=str(value),
                kind=CompletionItemKind.EnumMember,
                detail=f"Valid {field_name} value",
                insert_text=str(value),
                sort_text=f"1_{value}",
            )
            completions.append(completion)

        return completions


def get_schema_completions(
    file_path: str,
    schema_loader: SchemaLoader,
    context: Optional[str] = None
) -> List[CompletionItem]:
    """
    Convenience function to get schema-based completions.

    Args:
        file_path: Path to the file being edited
        schema_loader: Schema loader instance
        context: Optional context string

    Returns:
        List of completion items from schema
    """
    provider = SchemaCompletionProvider(schema_loader)
    return provider.get_field_completions(file_path, context)
