"""
Schema Validator - Generic validation engine driven by YAML schemas.

This module provides schema-driven validation of CK3 script files. It validates
AST nodes against declarative schema rules including required fields, field types,
value constraints, and cross-field validations.

Responsibilities:
- Validate AST against schema rules
- Check required fields (with conditional requirements)
- Validate field types and values
- Evaluate cross-field conditions
- Generate diagnostics with proper codes and messages
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Set
from lsprotocol.types import Diagnostic, DiagnosticSeverity, Range
import re
import logging

from .parser import CK3Node
from .schema_loader import SchemaLoader

logger = logging.getLogger(__name__)

# Map severity strings to LSP DiagnosticSeverity enum
SEVERITY_MAP = {
    'error': DiagnosticSeverity.Error,
    'warning': DiagnosticSeverity.Warning,
    'information': DiagnosticSeverity.Information,
    'info': DiagnosticSeverity.Information,
    'hint': DiagnosticSeverity.Hint,
}


class SchemaValidator:
    """Validate CK3 files against YAML schemas."""

    def __init__(self, schema_loader: SchemaLoader) -> None:
        """
        Initialize the schema validator.

        Args:
            schema_loader: Schema loader instance for accessing schemas and diagnostics
        """
        self.loader = schema_loader

    def validate(self, file_path: str, ast: List[CK3Node]) -> List[Diagnostic]:
        """
        Validate AST against the appropriate schema for the file.

        Args:
            file_path: Path to the file being validated
            ast: Parsed AST nodes from the file

        Returns:
            List of diagnostic messages for validation errors/warnings
        """
        schema = self.loader.get_schema_for_file(file_path)
        if not schema:
            # No schema for this file type, no schema-based validation
            return []

        diagnostics: List[Diagnostic] = []

        # Get block pattern for identifying top-level blocks to validate
        block_pattern = schema.get('identification', {}).get('block_pattern')

        # Validate each top-level node
        for node in ast:
            if self._matches_block_pattern(node.key, block_pattern):
                # Validate this block against the schema
                diagnostics.extend(
                    self._validate_block(node, schema, schema.get('fields', {}))
                )

                # Run top-level validations (cross-field checks)
                for validation in schema.get('validations', []):
                    if self._evaluate_condition(node, validation.get('condition', '')):
                        diagnostics.append(
                            self._create_diagnostic(
                                validation['diagnostic'],
                                node.range,
                                validation.get('severity', 'warning'),
                                **self._get_template_vars(node)
                            )
                        )

        return diagnostics

    def _matches_block_pattern(self, key: str, pattern: Optional[str]) -> bool:
        """
        Check if a key matches the block identification pattern.

        Args:
            key: The block key to check
            pattern: Regex pattern to match against (None means match all)

        Returns:
            True if the key matches, False otherwise
        """
        if not pattern:
            return True  # No pattern means match all top-level blocks
        try:
            return bool(re.match(pattern, key))
        except re.error:
            logger.warning(f"Invalid regex pattern: {pattern}")
            return False

    def _validate_block(
        self,
        node: CK3Node,
        schema: Dict[str, Any],
        fields: Dict[str, Any]
    ) -> List[Diagnostic]:
        """
        Validate a block node against field definitions.

        Args:
            node: The block node to validate
            schema: The overall schema (for nested schema lookups)
            fields: Field definitions for this level

        Returns:
            List of diagnostics for this block
        """
        diagnostics: List[Diagnostic] = []
        present_fields: Dict[str, List[CK3Node]] = {}

        # Group children by field name
        for child in node.children:
            if child.key not in present_fields:
                present_fields[child.key] = []
            present_fields[child.key].append(child)

        # Validate each field definition
        for field_name, field_def in fields.items():
            field_nodes = present_fields.get(field_name, [])

            # Check required field (including conditional requirements)
            if field_def.get('required') or field_def.get('required_when'):
                if not self._check_required(node, field_name, field_def, present_fields):
                    diagnostics.append(
                        self._create_diagnostic(
                            field_def.get('diagnostic', 'UNKNOWN'),
                            node.range,
                            'error',
                            field_name=field_name,
                            **self._get_template_vars(node)
                        )
                    )

            # Check max_count constraint
            if 'max_count' in field_def and len(field_nodes) > field_def['max_count']:
                diag_code = field_def.get('count_diagnostic', field_def.get('diagnostic'))
                diagnostics.append(
                    self._create_diagnostic(
                        diag_code,
                        node.range,
                        'error',
                        count=len(field_nodes),
                        **self._get_template_vars(node)
                    )
                )

            # Check min_count constraint
            if 'min_count' in field_def:
                min_count = field_def['min_count']
                unless_fields = field_def.get('min_count_unless', [])

                # Check if any "unless" field is present and truthy
                skip_check = False
                for unless_field in unless_fields:
                    if unless_field in present_fields:
                        unless_nodes = present_fields[unless_field]
                        if unless_nodes and unless_nodes[0].value in ('yes', True, 'true'):
                            skip_check = True
                            break

                if not skip_check and len(field_nodes) < min_count:
                    diag_code = field_def.get('count_diagnostic', field_def.get('diagnostic'))
                    diagnostics.append(
                        self._create_diagnostic(
                            diag_code,
                            node.range,
                            'warning',
                            count=len(field_nodes),
                            **self._get_template_vars(node)
                        )
                    )

            # Enum type validation
            if field_def.get('type') == 'enum' and field_nodes:
                valid_values = field_def.get('values', [])
                for field_node in field_nodes:
                    if field_node.value and field_node.value not in valid_values:
                        diag_code = field_def.get('invalid_diagnostic', field_def.get('diagnostic'))
                        template_vars = self._get_template_vars(field_node)
                        template_vars['valid_values'] = ', '.join(str(v) for v in valid_values)
                        diagnostics.append(
                            self._create_diagnostic(
                                diag_code,
                                field_node.range,
                                'error',
                                **template_vars
                            )
                        )

            # Pattern validation (Phase 8.1)
            if field_nodes and field_def.get('type'):
                for field_node in field_nodes:
                    if field_node.value:  # Only validate if there's a value
                        pattern_diag = self._validate_pattern(
                            field_node.value,
                            field_def.get('type'),
                            field_name
                        )
                        if pattern_diag:
                            template_vars = self._get_template_vars(field_node)
                            template_vars['pattern'] = pattern_diag.get('pattern', '')
                            diagnostics.append(
                                self._create_diagnostic(
                                    pattern_diag['code'],
                                    field_node.range,
                                    pattern_diag.get('severity', 'warning'),
                                    **template_vars
                                )
                            )

            # Nested schema validation
            if 'schema' in field_def:
                nested_schema_name = field_def['schema']
                nested_schemas = schema.get('nested_schemas', {})
                if nested_schema_name in nested_schemas:
                    nested_schema = nested_schemas[nested_schema_name]
                    for field_node in field_nodes:
                        # Validate nested block
                        diagnostics.extend(
                            self._validate_block(
                                field_node,
                                schema,
                                nested_schema.get('fields', {})
                            )
                        )
                        # Run nested validations
                        for validation in nested_schema.get('validations', []):
                            if self._evaluate_condition(field_node, validation.get('condition', '')):
                                diagnostics.append(
                                    self._create_diagnostic(
                                        validation['diagnostic'],
                                        field_node.range,
                                        validation.get('severity', 'warning'),
                                        **self._get_template_vars(field_node)
                                    )
                                )

            # Field-level warnings
            for warning in field_def.get('warnings', []):
                for field_node in field_nodes:
                    if self._evaluate_condition(field_node, warning.get('condition', '')):
                        diagnostics.append(
                            self._create_diagnostic(
                                warning['diagnostic'],
                                field_node.range,
                                warning.get('severity', 'warning'),
                                **self._get_template_vars(field_node)
                            )
                        )

        return diagnostics

    def _check_required(
        self,
        node: CK3Node,
        field_name: str,
        field_def: Dict[str, Any],
        present_fields: Dict[str, List[CK3Node]]
    ) -> bool:
        """
        Check if a required field is present, considering conditional requirements.

        Args:
            node: The parent node being validated
            field_name: Name of the field to check
            field_def: Field definition with requirement rules
            present_fields: Dictionary of present field names to nodes

        Returns:
            True if the requirement is satisfied, False otherwise
        """
        # Check required_unless conditions
        unless_fields = field_def.get('required_unless', [])
        for unless_field in unless_fields:
            if unless_field in present_fields:
                unless_nodes = present_fields[unless_field]
                if unless_nodes and unless_nodes[0].value in ('yes', True, 'true'):
                    return True  # Condition met, field not required

        # Check required_when conditions
        when_condition = field_def.get('required_when')
        if when_condition:
            check_field = when_condition.get('field')
            check_value = when_condition.get('equals')
            if check_field in present_fields:
                field_value = present_fields[check_field][0].value if present_fields[check_field] else None
                if field_value != check_value:
                    return True  # Condition not met, field not required
            else:
                return True  # Condition field not present, field not required
        
        # If field is not required at all (no 'required' or 'required_when'), consider it satisfied
        if not field_def.get('required') and not when_condition:
            return True

        # Field is required and conditions don't exempt it
        return field_name in present_fields

    def _evaluate_condition(self, node: CK3Node, condition: str) -> bool:
        """
        Evaluate a condition expression against a node.

        Supports simple expressions like:
        - field.exists
        - field.count > 0
        - field.value == 'yes'
        - condition1 AND condition2
        - NOT condition

        Args:
            node: The node to evaluate against
            condition: The condition expression

        Returns:
            True if the condition is met, False otherwise
        """
        if not condition:
            return False

        # Build context for evaluation
        context = self._build_evaluation_context(node)

        # Evaluate the expression
        try:
            return self._eval_expr(condition, context)
        except Exception as e:
            logger.warning(f"Failed to evaluate condition '{condition}': {e}")
            return False

    def _build_evaluation_context(self, node: CK3Node) -> Dict[str, Any]:
        """
        Build context dictionary for condition evaluation.

        Args:
            node: The node to build context from

        Returns:
            Context dictionary with field information
        """
        context: Dict[str, Any] = {
            'children': {'count': len(node.children)},
        }

        # Index children by key
        for child in node.children:
            if child.key not in context:
                context[child.key] = {
                    'exists': True,
                    'count': 0,
                    'value': child.value,
                    'nodes': []
                }
            context[child.key]['count'] += 1
            context[child.key]['nodes'].append(child)

        return context

    def _eval_expr(self, expr: str, context: Dict[str, Any]) -> bool:
        """
        Simple expression evaluator for condition expressions.

        Args:
            expr: The expression to evaluate
            context: Evaluation context with field data

        Returns:
            Boolean result of the expression
        """
        expr = expr.strip()

        # Handle NOT
        if expr.startswith('NOT '):
            return not self._eval_expr(expr[4:], context)

        # Handle AND
        if ' AND ' in expr:
            parts = expr.split(' AND ')
            return all(self._eval_expr(p.strip(), context) for p in parts)

        # Handle OR
        if ' OR ' in expr:
            parts = expr.split(' OR ')
            return any(self._eval_expr(p.strip(), context) for p in parts)

        # Handle comparisons
        for op in ['==', '!=', '>=', '<=', '>', '<']:
            if op in expr:
                left, right = expr.split(op, 1)
                left_val = self._resolve_value(left.strip(), context)
                right_val = self._resolve_value(right.strip(), context)
                return self._compare(left_val, op, right_val)

        # Handle field.exists
        if '.exists' in expr:
            field = expr.replace('.exists', '')
            return field in context and context[field].get('exists', False)

        # Handle field.count
        if '.count' in expr:
            field = expr.split('.')[0]
            return context.get(field, {}).get('count', 0)

        return False

    def _resolve_value(self, expr: str, context: Dict[str, Any]) -> Any:
        """
        Resolve a value expression to its actual value.

        Args:
            expr: The value expression
            context: Evaluation context

        Returns:
            The resolved value
        """
        # Integer literal
        if expr.isdigit() or (expr.startswith('-') and expr[1:].isdigit()):
            return int(expr)

        # Property access (field.property)
        if '.' in expr:
            parts = expr.split('.')
            obj = context
            for part in parts:
                if isinstance(obj, dict) and part in obj:
                    obj = obj[part]
                else:
                    return None
            return obj

        # For CK3, keep yes/no/true/false as strings for comparisons
        # since that's how they're stored in the AST
        # (Users can do explicit boolean conversion if needed)
        return expr

    def _compare(self, left: Any, op: str, right: Any) -> bool:
        """
        Perform a comparison operation.

        Args:
            left: Left operand
            op: Comparison operator
            right: Right operand

        Returns:
            Result of the comparison
        """
        try:
            if op == '==':
                return left == right
            if op == '!=':
                return left != right
            if op == '>':
                return left > right if left is not None and right is not None else False
            if op == '<':
                return left < right if left is not None and right is not None else False
            if op == '>=':
                return left >= right if left is not None and right is not None else False
            if op == '<=':
                return left <= right if left is not None and right is not None else False
        except TypeError:
            # Type mismatch in comparison
            return False
        return False

    def _validate_pattern(
        self,
        value: str,
        field_type: str,
        field_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Validate a field value against type pattern definitions.

        This implements Phase 8.1 pattern validation, checking values against
        patterns defined in _types.yaml.

        Args:
            value: The value to validate
            field_type: The field type (e.g., 'localization_key', 'integer')
            field_name: Name of the field being validated (for context)

        Returns:
            Dictionary with 'code', 'severity', and 'pattern' if validation fails,
            None if validation passes
        """
        # Skip pattern validation for enum types (already handled separately)
        if field_type == 'enum':
            return None

        # Get type definition from _types.yaml
        type_def = self.loader.get_type_definition(field_type)
        if not type_def:
            # No type definition found, skip pattern validation
            return None

        # Check if type has a pattern
        pattern = type_def.get('pattern')
        if not pattern:
            # No pattern defined for this type
            return None

        # Validate value against pattern
        try:
            if not re.match(pattern, str(value)):
                # Pattern mismatch - determine specific diagnostic code
                diagnostic_code = self._get_pattern_diagnostic_code(field_type)
                return {
                    'code': diagnostic_code,
                    'severity': 'warning',
                    'pattern': pattern
                }
        except re.error as e:
            logger.warning(f"Invalid regex pattern for type {field_type}: {pattern} ({e})")
            return None

        # Pattern matches
        return None

    def _get_pattern_diagnostic_code(self, field_type: str) -> str:
        """
        Get the appropriate diagnostic code for a pattern validation failure.

        Args:
            field_type: The field type that failed validation

        Returns:
            The diagnostic code to use
        """
        # Map common types to specific diagnostic codes
        type_to_diagnostic = {
            'localization_key': 'SCHEMA-001',
            'localization_key_or_block': 'SCHEMA-001',
            'scope_reference': 'SCHEMA-002',
            'integer': 'SCHEMA-003',
            'number': 'SCHEMA-003',
            'number_or_script_value': 'SCHEMA-003',
        }

        return type_to_diagnostic.get(field_type, 'SCHEMA-004')

    def _get_template_vars(self, node: CK3Node) -> Dict[str, Any]:
        """
        Get template variables for message formatting.

        Args:
            node: The node to extract variables from

        Returns:
            Dictionary of template variables
        """
        return {
            'id': node.key,
            'key': node.key,
            'value': node.value,
        }

    def _create_diagnostic(
        self,
        code: str,
        range_: Range,
        severity: str = 'error',
        **kwargs: Any
    ) -> Diagnostic:
        """
        Create a diagnostic from code and template variables.

        Args:
            code: Diagnostic code
            range_: Source range for the diagnostic
            severity: Severity level (error, warning, info, hint)
            **kwargs: Template variables for message formatting

        Returns:
            LSP Diagnostic object
        """
        diag_def = self.loader.get_diagnostic(code) or {}

        # Get message template and format with variables
        message = diag_def.get('message', kwargs.get('message', f'Validation error: {code}'))
        try:
            message = message.format(**kwargs)
        except KeyError:
            pass  # Keep original message if formatting fails

        # Determine severity
        severity_str = severity if severity else diag_def.get('severity', 'error')
        severity_enum = SEVERITY_MAP.get(severity_str, DiagnosticSeverity.Error)

        return Diagnostic(
            range=range_,
            severity=severity_enum,
            code=code,
            source='pychivalry',
            message=message
        )
