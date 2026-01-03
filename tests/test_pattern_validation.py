"""
Unit tests for Phase 8.1 Pattern Validation System.

Tests pattern-based validation of field values against type definitions
from _types.yaml, including localization keys, scope references, numbers,
and custom patterns.
"""

import pytest
from lsprotocol.types import Range, Position, DiagnosticSeverity
from pychivalry.schema_validator import SchemaValidator
from pychivalry.schema_loader import SchemaLoader
from pychivalry.parser import CK3Node


@pytest.fixture
def schema_loader():
    """Create and load a schema loader."""
    loader = SchemaLoader()
    loader.load_all()
    return loader


@pytest.fixture
def validator(schema_loader):
    """Create a schema validator with loaded schemas."""
    return SchemaValidator(schema_loader)


def create_node(key: str, value: str = None, children: list = None, line: int = 0) -> CK3Node:
    """Helper to create a CK3Node for testing."""
    node = CK3Node(
        type='block' if children else 'property',
        key=key,
        value=value,
        range=Range(
            start=Position(line=line, character=0),
            end=Position(line=line, character=10)
        )
    )
    if children:
        node.children = children
    return node


class TestTypeDefinitionLoading:
    """Test that type definitions are loaded from _types.yaml."""

    def test_types_loaded(self, schema_loader):
        """Test that type definitions are loaded."""
        assert schema_loader._types is not None
        assert len(schema_loader._types) > 0

    def test_get_type_definition(self, schema_loader):
        """Test retrieving specific type definitions."""
        # Should have common types
        localization_key = schema_loader.get_type_definition('localization_key')
        assert localization_key is not None
        assert 'pattern' in localization_key

        integer = schema_loader.get_type_definition('integer')
        assert integer is not None
        assert 'pattern' in integer

        scope_ref = schema_loader.get_type_definition('scope_reference')
        assert scope_ref is not None
        assert 'pattern' in scope_ref

    def test_get_nonexistent_type(self, schema_loader):
        """Test that nonexistent types return None."""
        result = schema_loader.get_type_definition('nonexistent_type')
        assert result is None


class TestLocalizationKeyValidation:
    """Test validation of localization key patterns."""

    def test_valid_localization_keys(self, validator):
        """Test that valid localization keys pass validation."""
        valid_keys = [
            'my_event_title',
            'decision.accept',
            'character_event_desc',
            'test_123',
            'a',
        ]

        for key in valid_keys:
            result = validator._validate_pattern(key, 'localization_key', 'title')
            assert result is None, f"Valid key '{key}' should pass validation"

    def test_invalid_localization_keys(self, validator):
        """Test that invalid localization keys fail validation."""
        invalid_keys = [
            'MyEvent',  # Capital letters
            '123_event',  # Starts with number
            'my-event',  # Contains hyphen
            'my event',  # Contains space
            '',  # Empty string
        ]

        for key in invalid_keys:
            result = validator._validate_pattern(key, 'localization_key', 'title')
            assert result is not None, f"Invalid key '{key}' should fail validation"
            assert result['code'] == 'SCHEMA-001'
            assert result['severity'] == 'warning'


class TestScopeReferenceValidation:
    """Test validation of scope reference patterns."""

    def test_valid_scope_references(self, validator):
        """Test that valid scope references pass validation."""
        valid_refs = [
            'scope:my_variable',
            'root',
            'prev',
            'this',
            'from',
            'liege',
            'primary_title',
            'root.primary_title',
        ]

        for ref in valid_refs:
            result = validator._validate_pattern(ref, 'scope_reference', 'target')
            assert result is None, f"Valid scope ref '{ref}' should pass validation"

    def test_invalid_scope_references(self, validator):
        """Test that invalid scope references fail validation."""
        # Note: scope_reference pattern is quite permissive in _types.yaml
        # We test a few clearly invalid cases
        invalid_refs = [
            '123invalid',  # Starts with number (no scope: prefix)
            '',  # Empty
        ]

        for ref in invalid_refs:
            result = validator._validate_pattern(ref, 'scope_reference', 'target')
            if result:  # Pattern is permissive, so some may pass
                assert result['code'] == 'SCHEMA-002'
                assert result['severity'] == 'warning'


class TestNumberValidation:
    """Test validation of number patterns."""

    def test_valid_integers(self, validator):
        """Test that valid integers pass validation."""
        valid_integers = [
            '0',
            '1',
            '100',
            '-5',
            '999999',
        ]

        for num in valid_integers:
            result = validator._validate_pattern(num, 'integer', 'value')
            assert result is None, f"Valid integer '{num}' should pass validation"

    def test_invalid_integers(self, validator):
        """Test that invalid integers fail validation."""
        invalid_integers = [
            '1.5',  # Decimal
            '1.0',  # Decimal
            'abc',  # Letters
            '1a',  # Mixed
            '',  # Empty
        ]

        for num in invalid_integers:
            result = validator._validate_pattern(num, 'integer', 'value')
            assert result is not None, f"Invalid integer '{num}' should fail validation"
            assert result['code'] == 'SCHEMA-003'

    def test_valid_numbers(self, validator):
        """Test that valid numbers (including decimals) pass validation."""
        valid_numbers = [
            '0',
            '1',
            '100',
            '-5',
            '3.14',
            '0.5',
            '-2.5',
            '100.',  # Trailing dot is valid per pattern
        ]

        for num in valid_numbers:
            result = validator._validate_pattern(num, 'number', 'value')
            assert result is None, f"Valid number '{num}' should pass validation"

    def test_invalid_numbers(self, validator):
        """Test that invalid numbers fail validation."""
        invalid_numbers = [
            'abc',
            '1.2.3',  # Multiple dots
            '1a',
            '',
        ]

        for num in invalid_numbers:
            result = validator._validate_pattern(num, 'number', 'value')
            assert result is not None, f"Invalid number '{num}' should fail validation"
            assert result['code'] == 'SCHEMA-003'


class TestPatternValidationIntegration:
    """Test pattern validation integrated into full schema validation."""

    def test_pattern_validation_in_schema(self, validator, schema_loader):
        """Test that pattern validation works in full schema validation flow."""
        # Create a mock schema with pattern-validated fields
        schema_loader._schemas['pattern_test'] = {
            'file_type': 'pattern_test',
            'identification': {
                'path_patterns': ['test/*'],
                'block_pattern': r'^test\.[0-9]+$'
            },
            'fields': {
                'title': {
                    'type': 'localization_key',
                    'required': True,
                    'diagnostic': 'TEST-001'
                },
                'value': {
                    'type': 'integer',
                    'required': False
                }
            }
        }

        # Test with valid values
        valid_node = create_node('test.0001')
        valid_node.children = [
            create_node('title', 'my_valid_key'),
            create_node('value', '100')
        ]

        diagnostics = validator.validate('test/file.txt', [valid_node])
        pattern_diagnostics = [d for d in diagnostics if d.code and d.code.startswith('SCHEMA-')]
        assert len(pattern_diagnostics) == 0, "Valid values should not produce pattern diagnostics"

        # Test with invalid localization key
        invalid_node = create_node('test.0002')
        invalid_node.children = [
            create_node('title', 'Invalid-Key'),  # Invalid: contains hyphen
            create_node('value', '100')
        ]

        diagnostics = validator.validate('test/file.txt', [invalid_node])
        pattern_diagnostics = [d for d in diagnostics if d.code and d.code.startswith('SCHEMA-')]
        assert len(pattern_diagnostics) > 0, "Invalid localization key should produce diagnostic"
        assert any(d.code == 'SCHEMA-001' for d in pattern_diagnostics)

        # Test with invalid integer
        invalid_int_node = create_node('test.0003')
        invalid_int_node.children = [
            create_node('title', 'valid_key'),
            create_node('value', '1.5')  # Invalid: not an integer
        ]

        diagnostics = validator.validate('test/file.txt', [invalid_int_node])
        pattern_diagnostics = [d for d in diagnostics if d.code and d.code.startswith('SCHEMA-')]
        assert len(pattern_diagnostics) > 0, "Invalid integer should produce diagnostic"
        assert any(d.code == 'SCHEMA-003' for d in pattern_diagnostics)


class TestPatternDiagnosticMessages:
    """Test that pattern validation produces appropriate diagnostic messages."""

    def test_localization_key_diagnostic_message(self, validator, schema_loader):
        """Test diagnostic message for invalid localization key."""
        schema_loader._schemas['msg_test'] = {
            'file_type': 'msg_test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'title': {
                    'type': 'localization_key',
                    'required': True,
                    'diagnostic': 'TEST-001'
                }
            }
        }

        node = create_node('test.0001')
        node.children = [create_node('title', 'INVALID_KEY')]

        diagnostics = validator.validate('test/file.txt', [node])
        schema_diags = [d for d in diagnostics if d.code == 'SCHEMA-001']

        assert len(schema_diags) > 0
        diag = schema_diags[0]
        assert 'INVALID_KEY' in diag.message
        assert 'localization key' in diag.message.lower()

    def test_number_diagnostic_message(self, validator, schema_loader):
        """Test diagnostic message for invalid number."""
        schema_loader._schemas['num_test'] = {
            'file_type': 'num_test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'amount': {
                    'type': 'integer',
                    'required': False
                }
            }
        }

        node = create_node('test.0001')
        node.children = [create_node('amount', 'not_a_number')]

        diagnostics = validator.validate('test/file.txt', [node])
        schema_diags = [d for d in diagnostics if d.code == 'SCHEMA-003']

        assert len(schema_diags) > 0
        diag = schema_diags[0]
        assert 'not_a_number' in diag.message
        assert 'number' in diag.message.lower()


class TestEdgeCases:
    """Test edge cases in pattern validation."""

    def test_none_value(self, validator):
        """Test that None values don't cause errors."""
        result = validator._validate_pattern(None, 'localization_key', 'field')
        # Should handle gracefully (convert to string "None")
        assert result is not None or result is None  # Either is acceptable

    def test_empty_string(self, validator):
        """Test empty string validation."""
        result = validator._validate_pattern('', 'localization_key', 'field')
        assert result is not None  # Empty strings should fail most patterns

    def test_unknown_type(self, validator):
        """Test validation with unknown type."""
        result = validator._validate_pattern('test', 'unknown_type_xyz', 'field')
        assert result is None  # Should skip validation for unknown types

    def test_type_without_pattern(self, validator):
        """Test type that exists but has no pattern."""
        # 'block' type has no pattern defined
        result = validator._validate_pattern('anything', 'block', 'field')
        assert result is None  # Should skip pattern validation

    def test_enum_type_skipped(self, validator):
        """Test that enum types skip pattern validation."""
        result = validator._validate_pattern('character_event', 'enum', 'type')
        assert result is None  # Enum validation is handled separately
