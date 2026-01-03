"""
Schema-based Hover - File-type-aware hover documentation provider.

This module provides hover documentation based on schema definitions, making hover
file-type-aware and automatically supporting new file types as schemas are added.

Responsibilities:
- Load field_docs from schemas for the current file type
- Convert field documentation to LSP Hover objects
- Provide context-appropriate documentation based on cursor position
- Generate formatted Markdown documentation
"""

from typing import Optional, Dict, Any
from lsprotocol.types import Hover, MarkupContent, MarkupKind
import logging

from .schema_loader import SchemaLoader

logger = logging.getLogger(__name__)


class SchemaHoverProvider:
    """Provide hover documentation based on schema field documentation."""

    def __init__(self, schema_loader: SchemaLoader) -> None:
        """
        Initialize the hover provider.

        Args:
            schema_loader: Schema loader instance for accessing schemas
        """
        self.loader = schema_loader

    def get_field_hover(
        self, file_path: str, field_name: str, context: Optional[str] = None
    ) -> Optional[Hover]:
        """
        Get hover documentation for a field.

        Args:
            file_path: Path to the file being edited
            field_name: Name of the field to document
            context: Optional context string (e.g., "option", "effect_group")

        Returns:
            Hover object with field documentation, or None if not found
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema or 'field_docs' not in schema:
            return None

        field_docs = schema['field_docs']
        if field_name not in field_docs:
            return None

        docs = field_docs[field_name]
        return self._create_hover(field_name, docs, schema.get('file_type'))

    def get_nested_field_hover(
        self, file_path: str, nested_schema: str, field_name: str
    ) -> Optional[Hover]:
        """
        Get hover documentation for a field in a nested schema.

        Args:
            file_path: Path to the file being edited
            nested_schema: Name of the nested schema (e.g., "option", "effect_group")
            field_name: Name of the field to document

        Returns:
            Hover object with field documentation, or None if not found
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema or 'nested_schemas' not in schema:
            return None

        nested_schemas = schema['nested_schemas']
        if nested_schema not in nested_schemas:
            return None

        nested = nested_schemas[nested_schema]
        if 'field_docs' not in nested or field_name not in nested['field_docs']:
            return None

        docs = nested['field_docs'][field_name]
        return self._create_hover(field_name, docs, schema.get('file_type'), nested_schema)

    def _create_hover(
        self,
        field_name: str,
        docs: Dict[str, Any],
        file_type: Optional[str] = None,
        nested_context: Optional[str] = None
    ) -> Optional[Hover]:
        """
        Create a Hover object from field documentation.

        Args:
            field_name: Name of the field
            docs: Documentation dictionary with description, detail
            file_type: Type of file (e.g., "event", "story_cycle")
            nested_context: Optional nested schema context

        Returns:
            Hover object or None if documentation is invalid
        """
        if not isinstance(docs, dict):
            return None

        # Extract documentation components
        description = docs.get('description', '')
        detail = docs.get('detail', '')

        # Build Markdown documentation
        markdown_lines = []

        # Header with field name and context
        header = f"**`{field_name}`**"
        if nested_context:
            header += f" _(in {nested_context})_"
        elif file_type:
            header += f" _(in {file_type})_"
        markdown_lines.append(header)
        markdown_lines.append("")

        # Description
        if description:
            markdown_lines.append(description)
            markdown_lines.append("")

        # Detail information
        if detail:
            markdown_lines.append(f"_{detail}_")
            markdown_lines.append("")

        # Check for enum values
        if 'values' in docs:
            markdown_lines.append("**Valid values:**")
            values = docs['values']
            if isinstance(values, list):
                for value in values[:10]:  # Show first 10 values
                    markdown_lines.append(f"- `{value}`")
                if len(values) > 10:
                    markdown_lines.append(f"- _(and {len(values) - 10} more)_")
            markdown_lines.append("")

        # Example usage from snippet
        snippet = docs.get('snippet')
        if snippet and snippet != f'{field_name} = $0':
            markdown_lines.append("**Example:**")
            markdown_lines.append("```ck3")
            # Clean up snippet placeholders for display
            clean_snippet = snippet.replace('$0', '...').replace('${1:', '').replace('}', '')
            markdown_lines.append(clean_snippet)
            markdown_lines.append("```")

        markdown = "\n".join(markdown_lines)

        return Hover(
            contents=MarkupContent(
                kind=MarkupKind.Markdown,
                value=markdown
            )
        )

    def get_enum_value_hover(
        self, file_path: str, field_name: str, value: str
    ) -> Optional[Hover]:
        """
        Get hover documentation for an enum field value.

        Args:
            file_path: Path to the file being edited
            field_name: Name of the enum field
            value: The enum value to document

        Returns:
            Hover object with value documentation, or None if not found
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema or 'fields' not in schema:
            return None

        fields = schema['fields']
        if field_name not in fields:
            return None

        field_def = fields[field_name]
        if field_def.get('type') != 'enum' or 'values' not in field_def:
            return None

        values = field_def['values']
        if value not in values:
            return None

        # Build hover for the enum value
        markdown_lines = [
            f"**`{value}`**",
            "",
            f"Valid value for `{field_name}` field",
        ]

        # Add field description if available
        field_docs = schema.get('field_docs', {}).get(field_name, {})
        if field_docs.get('description'):
            markdown_lines.append("")
            markdown_lines.append(field_docs['description'])

        return Hover(
            contents=MarkupContent(
                kind=MarkupKind.Markdown,
                value="\n".join(markdown_lines)
            )
        )


def get_schema_hover(
    file_path: str,
    field_name: str,
    schema_loader: SchemaLoader,
    context: Optional[str] = None
) -> Optional[Hover]:
    """
    Convenience function to get schema-based hover documentation.

    Args:
        file_path: Path to the file being edited
        field_name: Name of the field to document
        schema_loader: Schema loader instance
        context: Optional context string

    Returns:
        Hover object with documentation, or None if not found
    """
    provider = SchemaHoverProvider(schema_loader)
    return provider.get_field_hover(file_path, field_name, context)
