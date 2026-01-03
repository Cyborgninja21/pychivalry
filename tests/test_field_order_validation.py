"""
Unit tests for Phase 8.3 Field Order Validation.

Tests field ordering validation according to schema configuration,
including flexible and strict modes.
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


class TestFieldOrderValidation:
    """Test field ordering validation."""

    def test_correct_order_no_diagnostic(self, validator, schema_loader):
        """Test that correct field order produces no diagnostics."""
        # Create a simple schema with field order
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'flexible',
                'order': ['type', 'title', 'desc']
            },
            'fields': {}
        }

        # Create node with correct order
        node = create_node('test.0001', children=[
            create_node('type', 'character_event', line=1),
            create_node('title', 'test.title', line=2),
            create_node('desc', 'test.desc', line=3)
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have no order diagnostics
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0

    def test_flexible_mode_minor_disorder_no_diagnostic(self, validator, schema_loader):
        """Test that flexible mode allows minor disorder without diagnostic."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'flexible',
                'order': ['type', 'title', 'desc']
            },
            'fields': {}
        }

        # Create node with one field out of order (only 2 fields, not enough for hint)
        node = create_node('test.0001', children=[
            create_node('title', 'test.title', line=1),
            create_node('type', 'character_event', line=2),
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have no diagnostics (not enough out of order)
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0

    def test_flexible_mode_significant_disorder_hint(self, validator, schema_loader):
        """Test that flexible mode shows hint for significant disorder."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'flexible',
                'order': ['type', 'title', 'desc', 'option']
            },
            'fields': {}
        }

        # Create node with multiple fields out of order
        node = create_node('test.0001', children=[
            create_node('option', line=1),
            create_node('desc', 'test.desc', line=2),
            create_node('type', 'character_event', line=3),
            create_node('title', 'test.title', line=4),
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have a SCHEMA-011 hint
        hints = [d for d in diagnostics if d.code == 'SCHEMA-011']
        assert len(hints) == 1
        assert hints[0].severity == DiagnosticSeverity.Hint
        assert 'type' in hints[0].message
        assert 'title' in hints[0].message

    def test_strict_mode_out_of_order_diagnostic(self, validator, schema_loader):
        """Test that strict mode produces diagnostic for each out-of-order field."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'strict',
                'order': ['type', 'title', 'desc']
            },
            'fields': {}
        }

        # Create node with fields out of order
        node = create_node('test.0001', children=[
            create_node('title', 'test.title', line=1),
            create_node('type', 'character_event', line=2),
            create_node('desc', 'test.desc', line=3)
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have SCHEMA-010 information diagnostic
        info_diags = [d for d in diagnostics if d.code == 'SCHEMA-010']
        assert len(info_diags) >= 1
        assert info_diags[0].severity == DiagnosticSeverity.Information

    def test_disabled_order_validation(self, validator, schema_loader):
        """Test that disabled field order produces no diagnostics."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': False,
                'mode': 'strict',
                'order': ['type', 'title', 'desc']
            },
            'fields': {}
        }

        # Create node with fields out of order
        node = create_node('test.0001', children=[
            create_node('desc', 'test.desc', line=1),
            create_node('type', 'character_event', line=2),
            create_node('title', 'test.title', line=3)
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have no order diagnostics
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0

    def test_missing_field_order_config(self, validator, schema_loader):
        """Test that missing field_order config doesn't cause errors."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'fields': {}
        }

        # Create node with fields
        node = create_node('test.0001', children=[
            create_node('desc', 'test.desc', line=1),
            create_node('type', 'character_event', line=2),
        ])

        # Validate - should not crash
        diagnostics = validator._validate_block(node, schema, {})

        # No order diagnostics expected
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0

    def test_empty_order_list(self, validator, schema_loader):
        """Test that empty order list produces no diagnostics."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'flexible',
                'order': []
            },
            'fields': {}
        }

        # Create node with fields
        node = create_node('test.0001', children=[
            create_node('type', 'character_event', line=1),
            create_node('title', 'test.title', line=2),
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # No order diagnostics expected
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0

    def test_fields_not_in_order_list(self, validator, schema_loader):
        """Test that fields not in order list don't affect validation."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'strict',
                'order': ['type', 'title']
            },
            'fields': {}
        }

        # Create node with ordered fields plus extra fields
        node = create_node('test.0001', children=[
            create_node('type', 'character_event', line=1),
            create_node('extra_field', 'value', line=2),
            create_node('title', 'test.title', line=3),
            create_node('another_extra', 'value2', line=4),
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have no diagnostics (type comes before title)
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0

    def test_duplicate_fields_order_validation(self, validator, schema_loader):
        """Test field order validation with duplicate fields."""
        schema = {
            'identification': {'block_pattern': 'test'},
            'field_order': {
                'enabled': True,
                'mode': 'strict',
                'order': ['type', 'option']
            },
            'fields': {}
        }

        # Create node with duplicate option fields
        node = create_node('test.0001', children=[
            create_node('type', 'character_event', line=1),
            create_node('option', line=2),
            create_node('option', line=3),
            create_node('option', line=4),
        ])

        # Validate
        diagnostics = validator._validate_block(node, schema, {})

        # Should have no order diagnostics (all in correct order)
        order_diags = [d for d in diagnostics if d.code in ['SCHEMA-010', 'SCHEMA-011']]
        assert len(order_diags) == 0


class TestSchemaFieldOrderIntegration:
    """Test field order validation with actual schemas."""

    def test_event_schema_has_field_order(self, schema_loader):
        """Test that event schema has field order configuration."""
        # Load events schema
        schema = schema_loader.get_schema_for_file('events/test.txt')
        assert schema is not None

        # Check field_order exists
        field_order = schema.get('field_order', {})
        assert field_order.get('enabled') is True
        assert 'order' in field_order
        assert len(field_order['order']) > 0

        # Check some expected fields in order
        order = field_order['order']
        assert 'type' in order
        assert 'title' in order
        assert 'desc' in order

    def test_decision_schema_has_field_order(self, schema_loader):
        """Test that decision schema has field order configuration."""
        schema = schema_loader.get_schema_for_file('common/decisions/test.txt')
        assert schema is not None

        field_order = schema.get('field_order', {})
        assert field_order.get('enabled') is True
        assert 'ai_check_interval' in field_order['order']

    def test_story_cycle_schema_has_field_order(self, schema_loader):
        """Test that story cycle schema has field order configuration."""
        schema = schema_loader.get_schema_for_file('common/story_cycles/test.txt')
        assert schema is not None

        field_order = schema.get('field_order', {})
        assert field_order.get('enabled') is True
        assert 'effect_group' in field_order['order']
