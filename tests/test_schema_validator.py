"""
Unit tests for the SchemaValidator module.

Tests schema-driven validation including required fields, type checks,
cross-field validations, and condition evaluation.
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


def create_node(key: str, value: str = None, children: list = None, line: int = 0, node_type: str = 'block') -> CK3Node:
    """Helper to create a CK3Node for testing."""
    node = CK3Node(
        type=node_type,
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


class TestSchemaValidatorBasics:
    """Test basic schema validator functionality."""

    def test_initialization(self, schema_loader):
        """Test validator initialization."""
        validator = SchemaValidator(schema_loader)
        assert validator.loader is schema_loader

    def test_validate_no_schema(self, validator):
        """Test validation when no schema exists for file type."""
        ast = [create_node('test', 'value')]
        diagnostics = validator.validate('unknown/file.xyz', ast)
        
        # Should return empty list for unknown file types
        assert diagnostics == []

    def test_matches_block_pattern_no_pattern(self, validator):
        """Test block pattern matching with no pattern defined."""
        # None pattern should match everything
        assert validator._matches_block_pattern('anything', None) is True
        assert validator._matches_block_pattern('test.0001', None) is True

    def test_matches_block_pattern_with_regex(self, validator):
        """Test block pattern matching with regex."""
        pattern = r'^[a-z_]+\.[0-9]+$'
        
        assert validator._matches_block_pattern('test.0001', pattern) is True
        assert validator._matches_block_pattern('my_event.1234', pattern) is True
        assert validator._matches_block_pattern('invalid', pattern) is False
        assert validator._matches_block_pattern('TEST.0001', pattern) is False


class TestRequiredFieldValidation:
    """Test required field validation."""

    def test_simple_required_field_present(self, validator, schema_loader):
        """Test that validation passes when required field is present."""
        # Mock schema with required field
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'type': {
                    'required': True,
                    'diagnostic': 'TEST-001'
                }
            }
        }
        
        # Create AST with required field
        node = create_node('test.0001')
        node.children = [create_node('type', 'test_type')]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have no diagnostics
        assert len(diagnostics) == 0

    def test_simple_required_field_missing(self, validator, schema_loader):
        """Test that validation fails when required field is missing."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'type': {
                    'required': True,
                    'diagnostic': 'TEST-001'
                }
            }
        }
        
        # Create AST without required field
        node = create_node('test.0001')
        node.children = []
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have one error
        assert len(diagnostics) == 1
        assert diagnostics[0].code == 'TEST-001'
        assert diagnostics[0].severity == DiagnosticSeverity.Error

    def test_required_unless_condition_met(self, validator, schema_loader):
        """Test required_unless when condition is met."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'desc': {
                    'required': True,
                    'required_unless': ['hidden'],
                    'diagnostic': 'TEST-002'
                },
                'hidden': {
                    'type': 'boolean'
                }
            }
        }
        
        # Create AST with hidden=yes but no desc
        node = create_node('test.0001')
        node.children = [create_node('hidden', 'yes')]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have no diagnostic (hidden exempts desc requirement)
        assert len(diagnostics) == 0

    def test_required_when_condition_met(self, validator, schema_loader):
        """Test required_when when condition is met."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'type': {
                    'type': 'enum',
                    'values': ['letter', 'character']
                },
                'sender': {
                    'required': True,
                    'required_when': {
                        'field': 'type',
                        'equals': 'letter'
                    },
                    'diagnostic': 'TEST-003'
                }
            }
        }
        
        # Create AST with type=letter but no sender
        node = create_node('test.0001')
        node.children = [create_node('type', 'letter')]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have diagnostic (sender required when type=letter)
        assert len(diagnostics) > 0
        assert any(d.code == 'TEST-003' for d in diagnostics)


class TestCountConstraints:
    """Test max_count and min_count constraints."""

    def test_max_count_violation(self, validator, schema_loader):
        """Test that exceeding max_count triggers diagnostic."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'immediate': {
                    'type': 'block',
                    'max_count': 1,
                    'diagnostic': 'TEST-004'
                }
            }
        }
        
        # Create AST with multiple immediate blocks
        node = create_node('test.0001')
        node.children = [
            create_node('immediate', None),
            create_node('immediate', None)
        ]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        assert len(diagnostics) > 0
        assert any(d.code == 'TEST-004' for d in diagnostics)

    def test_min_count_with_unless(self, validator, schema_loader):
        """Test min_count with unless condition."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'option': {
                    'min_count': 1,
                    'min_count_unless': ['hidden'],
                    'diagnostic': 'TEST-005'
                },
                'hidden': {
                    'type': 'boolean'
                }
            }
        }
        
        # Create AST with hidden=yes but no options
        node = create_node('test.0001')
        node.children = [create_node('hidden', 'yes')]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have no diagnostic (hidden exempts option requirement)
        assert not any(d.code == 'TEST-005' for d in diagnostics)


class TestEnumValidation:
    """Test enum type validation."""

    def test_valid_enum_value(self, validator, schema_loader):
        """Test that valid enum values pass validation."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'type': {
                    'type': 'enum',
                    'values': ['character_event', 'letter_event'],
                    'diagnostic': 'TEST-006'
                }
            }
        }
        
        node = create_node('test.0001')
        node.children = [create_node('type', 'character_event')]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have no enum diagnostic
        assert not any(d.code == 'TEST-006' for d in diagnostics)

    def test_invalid_enum_value(self, validator, schema_loader):
        """Test that invalid enum values fail validation."""
        schema_loader._schemas['test'] = {
            'file_type': 'test',
            'identification': {'path_patterns': ['test/*']},
            'fields': {
                'type': {
                    'type': 'enum',
                    'values': ['character_event', 'letter_event'],
                    'diagnostic': 'TEST-006',
                    'invalid_diagnostic': 'TEST-007'
                }
            }
        }
        
        node = create_node('test.0001')
        node.children = [create_node('type', 'invalid_type')]
        
        diagnostics = validator.validate('test/file.txt', [node])
        
        # Should have invalid enum diagnostic
        assert any(d.code == 'TEST-007' for d in diagnostics)


class TestConditionEvaluation:
    """Test condition expression evaluation."""

    def test_field_exists(self, validator):
        """Test field.exists condition."""
        node = create_node('test')
        node.children = [create_node('type', 'value')]
        
        context = validator._build_evaluation_context(node)
        
        assert validator._eval_expr('type.exists', context) is True
        assert validator._eval_expr('missing.exists', context) is False

    def test_field_count(self, validator):
        """Test field.count condition."""
        node = create_node('test')
        node.children = [
            create_node('option', None),
            create_node('option', None),
            create_node('type', 'value')
        ]
        
        context = validator._build_evaluation_context(node)
        
        # Test count comparisons
        assert validator._eval_expr('option.count > 1', context) is True
        assert validator._eval_expr('option.count == 2', context) is True
        assert validator._eval_expr('type.count == 1', context) is True

    def test_and_condition(self, validator):
        """Test AND logical operator."""
        node = create_node('test')
        node.children = [
            create_node('hidden', 'yes'),
            create_node('option', None)
        ]
        
        context = validator._build_evaluation_context(node)
        
        assert validator._eval_expr('hidden.exists AND option.exists', context) is True
        assert validator._eval_expr('hidden.exists AND missing.exists', context) is False

    def test_or_condition(self, validator):
        """Test OR logical operator."""
        node = create_node('test')
        node.children = [create_node('type', 'value')]
        
        context = validator._build_evaluation_context(node)
        
        assert validator._eval_expr('type.exists OR missing.exists', context) is True
        assert validator._eval_expr('missing1.exists OR missing2.exists', context) is False

    def test_not_condition(self, validator):
        """Test NOT logical operator."""
        node = create_node('test')
        node.children = [create_node('type', 'value')]
        
        context = validator._build_evaluation_context(node)
        
        assert validator._eval_expr('NOT missing.exists', context) is True
        assert validator._eval_expr('NOT type.exists', context) is False

    def test_value_comparison(self, validator):
        """Test field.value comparisons."""
        node = create_node('test')
        node.children = [
            create_node('hidden', 'yes'),
            create_node('count', '5')
        ]
        
        context = validator._build_evaluation_context(node)
        
        assert validator._eval_expr('hidden.value == yes', context) is True
        assert validator._eval_expr('hidden.value == no', context) is False


class TestDiagnosticCreation:
    """Test diagnostic message creation and formatting."""

    def test_create_diagnostic_basic(self, validator):
        """Test basic diagnostic creation."""
        range_ = Range(
            start=Position(line=0, character=0),
            end=Position(line=0, character=10)
        )
        
        diag = validator._create_diagnostic('CK3760', range_, 'error', id='test.0001')
        
        assert diag.code == 'CK3760'
        assert diag.severity == DiagnosticSeverity.Error
        assert diag.source == 'pychivalry'
        assert 'test.0001' in diag.message

    def test_create_diagnostic_with_formatting(self, validator):
        """Test diagnostic message formatting with variables."""
        range_ = Range(
            start=Position(line=0, character=0),
            end=Position(line=0, character=10)
        )
        
        diag = validator._create_diagnostic(
            'CK3761',
            range_,
            'error',
            value='invalid_type',
            valid_values='character_event, letter_event'
        )
        
        assert 'invalid_type' in diag.message
        assert 'character_event' in diag.message

    def test_get_template_vars(self, validator):
        """Test template variable extraction from node."""
        node = create_node('test.0001', 'character_event')
        
        vars = validator._get_template_vars(node)
        
        assert vars['id'] == 'test.0001'
        assert vars['key'] == 'test.0001'
        assert vars['value'] == 'character_event'
