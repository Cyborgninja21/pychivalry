"""
Tests for Phase 8.2: Type System Integration.

Tests the integration of _types.yaml type definitions into the schema validation
system, including:
- Type resolution from _types.yaml
- one_of type handling (type composition)
- Type-specific validation rules
- Context validation (effect_block vs trigger_block)
"""

import pytest
from pathlib import Path
from lsprotocol.types import Diagnostic, Range, Position
from pychivalry.schema_loader import SchemaLoader
from pychivalry.schema_validator import SchemaValidator
from pychivalry.parser import CK3Node


@pytest.fixture
def schema_loader():
    """Create a schema loader instance."""
    loader = SchemaLoader()
    loader.load_all()
    return loader


@pytest.fixture
def validator(schema_loader):
    """Create a schema validator instance."""
    return SchemaValidator(schema_loader)


def create_test_node(key: str, value: str = None, children: list = None) -> CK3Node:
    """Helper to create a test CK3Node."""
    return CK3Node(
        key=key,
        value=value,
        children=children or [],
        range=Range(Position(0, 0), Position(0, 10))
    )


class TestTypeResolution:
    """Test type resolution from _types.yaml."""

    def test_get_type_definition_localization_key(self, schema_loader):
        """Test retrieving localization_key type definition."""
        type_def = schema_loader.get_type_definition('localization_key')
        
        assert type_def is not None
        assert 'pattern' in type_def
        assert type_def['pattern'] == '^[a-z][a-z0-9_.]*$'
        assert 'description' in type_def

    def test_get_type_definition_integer(self, schema_loader):
        """Test retrieving integer type definition."""
        type_def = schema_loader.get_type_definition('integer')
        
        assert type_def is not None
        assert 'pattern' in type_def
        assert type_def['pattern'] == '^-?[0-9]+$'

    def test_get_type_definition_number(self, schema_loader):
        """Test retrieving number type definition."""
        type_def = schema_loader.get_type_definition('number')
        
        assert type_def is not None
        assert 'pattern' in type_def
        assert type_def['pattern'] == '^-?[0-9]+\\.?[0-9]*$'

    def test_get_type_definition_boolean(self, schema_loader):
        """Test retrieving boolean type definition."""
        type_def = schema_loader.get_type_definition('boolean')
        
        assert type_def is not None
        assert 'values' in type_def
        assert set(type_def['values']) == {'yes', 'no', 'true', 'false'}

    def test_get_type_definition_unknown(self, schema_loader):
        """Test retrieving unknown type returns None."""
        type_def = schema_loader.get_type_definition('nonexistent_type')
        
        assert type_def is None


class TestOneOfTypeValidation:
    """Test validation of one_of type definitions (type composition)."""

    def test_localization_key_or_block_with_valid_key(self, schema_loader, validator):
        """Test localization_key_or_block accepts valid localization key."""
        # Valid localization key should pass
        result = validator._validate_pattern(
            'my_event_title',
            'localization_key_or_block',
            'title'
        )
        
        assert result is None  # No error

    def test_localization_key_or_block_with_invalid_key(self, schema_loader, validator):
        """Test localization_key_or_block rejects invalid localization key format."""
        # Invalid localization key (starts with uppercase)
        result = validator._validate_pattern(
            'MyEventTitle',
            'localization_key_or_block',
            'title'
        )
        
        # Should fail since it doesn't match localization_key pattern
        # and isn't a block
        assert result is not None
        assert 'code' in result
        assert result['code'] == 'SCHEMA-001'  # localization_key error

    def test_localization_key_or_block_with_empty_value(self, schema_loader, validator):
        """Test localization_key_or_block accepts empty value (could be block)."""
        # Empty value could be a block reference
        result = validator._validate_pattern(
            '',
            'localization_key_or_block',
            'desc'
        )
        
        assert result is None  # No error for potential block

    def test_number_or_script_value_with_valid_number(self, schema_loader, validator):
        """Test number_or_script_value accepts valid number."""
        result = validator._validate_pattern(
            '100',
            'number_or_script_value',
            'gold'
        )
        
        assert result is None

    def test_number_or_script_value_with_valid_decimal(self, schema_loader, validator):
        """Test number_or_script_value accepts valid decimal."""
        result = validator._validate_pattern(
            '3.14',
            'number_or_script_value',
            'multiplier'
        )
        
        assert result is None

    def test_number_or_script_value_with_valid_script_value(self, schema_loader, validator):
        """Test number_or_script_value accepts valid script value name."""
        result = validator._validate_pattern(
            'monthly_character_income',
            'number_or_script_value',
            'gold'
        )
        
        assert result is None

    def test_number_or_script_value_with_invalid_value(self, schema_loader, validator):
        """Test number_or_script_value rejects invalid format."""
        # Invalid - not a number and not a valid script value name (has spaces)
        result = validator._validate_pattern(
            'invalid value',
            'number_or_script_value',
            'gold'
        )
        
        assert result is not None
        assert result['code'] == 'SCHEMA-003'

    def test_integer_or_range_with_integer(self, schema_loader, validator):
        """Test integer_or_range accepts integer value."""
        result = validator._validate_pattern(
            '50',
            'integer_or_range',
            'days'
        )
        
        assert result is None

    def test_integer_or_range_with_negative_integer(self, schema_loader, validator):
        """Test integer_or_range accepts negative integer."""
        result = validator._validate_pattern(
            '-100',
            'integer_or_range',
            'modifier'
        )
        
        assert result is None

    def test_integer_or_range_with_empty_value(self, schema_loader, validator):
        """Test integer_or_range accepts empty value (could be range block)."""
        # Empty value could be a range block reference
        result = validator._validate_pattern(
            '',
            'integer_or_range',
            'years'
        )
        
        assert result is None


class TestBooleanTypeValidation:
    """Test validation of boolean type against values constraint."""

    def test_boolean_yes_value(self, schema_loader):
        """Test boolean type definition includes 'yes'."""
        type_def = schema_loader.get_type_definition('boolean')
        
        assert 'yes' in type_def['values']

    def test_boolean_no_value(self, schema_loader):
        """Test boolean type definition includes 'no'."""
        type_def = schema_loader.get_type_definition('boolean')
        
        assert 'no' in type_def['values']

    def test_boolean_true_value(self, schema_loader):
        """Test boolean type definition includes 'true'."""
        type_def = schema_loader.get_type_definition('boolean')
        
        assert 'true' in type_def['values']

    def test_boolean_false_value(self, schema_loader):
        """Test boolean type definition includes 'false'."""
        type_def = schema_loader.get_type_definition('boolean')
        
        assert 'false' in type_def['values']


class TestContextTypeValidation:
    """Test context validation for effect_block and trigger_block types."""

    def test_effect_block_type_has_context(self, schema_loader):
        """Test effect_block type has context defined."""
        type_def = schema_loader.get_type_definition('effect_block')
        
        assert type_def is not None
        assert 'context' in type_def
        assert type_def['context'] == 'effect'

    def test_trigger_block_type_has_context(self, schema_loader):
        """Test trigger_block type has context defined."""
        type_def = schema_loader.get_type_definition('trigger_block')
        
        assert type_def is not None
        assert 'context' in type_def
        assert type_def['context'] == 'trigger'


class TestTypeDescriptions:
    """Test that all types have descriptions for documentation."""

    def test_localization_key_has_description(self, schema_loader):
        """Test localization_key type has description."""
        type_def = schema_loader.get_type_definition('localization_key')
        
        assert 'description' in type_def
        assert len(type_def['description']) > 0

    def test_scope_reference_has_description(self, schema_loader):
        """Test scope_reference type has description."""
        type_def = schema_loader.get_type_definition('scope_reference')
        
        assert 'description' in type_def
        assert len(type_def['description']) > 0

    def test_effect_block_has_description(self, schema_loader):
        """Test effect_block type has description."""
        type_def = schema_loader.get_type_definition('effect_block')
        
        assert 'description' in type_def
        assert len(type_def['description']) > 0


class TestComplexTypePatterns:
    """Test complex type pattern validation."""

    def test_scope_reference_with_scope_prefix(self, validator):
        """Test scope reference with 'scope:' prefix."""
        result = validator._validate_pattern(
            'scope:attacker',
            'scope_reference',
            'target'
        )
        
        assert result is None

    def test_scope_reference_with_root(self, validator):
        """Test scope reference with 'root' keyword."""
        result = validator._validate_pattern(
            'root',
            'scope_reference',
            'character'
        )
        
        assert result is None

    def test_scope_reference_with_prev(self, validator):
        """Test scope reference with 'prev' keyword."""
        result = validator._validate_pattern(
            'prev',
            'scope_reference',
            'previous_scope'
        )
        
        assert result is None

    def test_scope_reference_with_chain(self, validator):
        """Test scope reference with chained scopes."""
        result = validator._validate_pattern(
            'root.liege.capital_county',
            'scope_reference',
            'target'
        )
        
        assert result is None

    def test_scope_reference_invalid_format(self, validator):
        """Test scope reference rejects invalid format."""
        # Starts with number - invalid
        result = validator._validate_pattern(
            '123invalid',
            'scope_reference',
            'target'
        )
        
        assert result is not None
        assert result['code'] == 'SCHEMA-002'
