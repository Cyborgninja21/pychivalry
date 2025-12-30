"""
Tests for CK3 Variables System Module

Tests variable parsing, validation, and operations.
"""

import pytest
from pychivalry.variables import (
    parse_variable_reference,
    is_variable_reference,
    is_valid_variable_name,
    is_variable_effect,
    is_variable_trigger,
    validate_set_variable,
    validate_change_variable,
    validate_clamp_variable,
    validate_variable_list_operation,
    get_variable_scope_type,
    suggest_variable_scope,
    create_variable,
    format_variable_reference,
    extract_variable_comparisons,
    Variable,
)


class TestParseVariableReference:
    """Test parsing variable references."""
    
    def test_parse_var_reference(self):
        """Test parsing var: reference."""
        result = parse_variable_reference('var:my_variable')
        assert result is not None
        assert result == ('var', 'my_variable')
    
    def test_parse_local_var_reference(self):
        """Test parsing local_var: reference."""
        result = parse_variable_reference('local_var:counter')
        assert result is not None
        assert result == ('local_var', 'counter')
    
    def test_parse_global_var_reference(self):
        """Test parsing global_var: reference."""
        result = parse_variable_reference('global_var:world_state')
        assert result is not None
        assert result == ('global_var', 'world_state')
    
    def test_parse_invalid_no_colon(self):
        """Test parsing identifier without colon."""
        result = parse_variable_reference('my_variable')
        assert result is None
    
    def test_parse_invalid_scope(self):
        """Test parsing with invalid scope."""
        result = parse_variable_reference('invalid:my_variable')
        assert result is None
    
    def test_parse_empty_name(self):
        """Test parsing with empty variable name."""
        result = parse_variable_reference('var:')
        assert result is None


class TestIsVariableReference:
    """Test variable reference detection."""
    
    def test_valid_var_reference(self):
        """Test valid var: reference."""
        assert is_variable_reference('var:my_variable') is True
    
    def test_valid_local_var_reference(self):
        """Test valid local_var: reference."""
        assert is_variable_reference('local_var:counter') is True
    
    def test_valid_global_var_reference(self):
        """Test valid global_var: reference."""
        assert is_variable_reference('global_var:state') is True
    
    def test_invalid_reference(self):
        """Test invalid references."""
        assert is_variable_reference('not_a_variable') is False
        assert is_variable_reference('invalid:var') is False
        assert is_variable_reference('var:') is False


class TestIsValidVariableName:
    """Test variable name validation."""
    
    def test_valid_simple_name(self):
        """Test valid simple names."""
        assert is_valid_variable_name('my_variable') is True
        assert is_valid_variable_name('counter') is True
        assert is_valid_variable_name('_private') is True
    
    def test_valid_with_numbers(self):
        """Test valid names with numbers."""
        assert is_valid_variable_name('var123') is True
        assert is_valid_variable_name('my_var_1') is True
    
    def test_valid_with_underscores(self):
        """Test valid names with underscores."""
        assert is_valid_variable_name('my_long_variable_name') is True
        assert is_valid_variable_name('___private') is True
    
    def test_invalid_starts_with_number(self):
        """Test invalid names starting with number."""
        assert is_valid_variable_name('123var') is False
    
    def test_invalid_special_characters(self):
        """Test invalid names with special characters."""
        assert is_valid_variable_name('my-variable') is False
        assert is_valid_variable_name('my.variable') is False
        assert is_valid_variable_name('my variable') is False
    
    def test_invalid_empty(self):
        """Test invalid empty name."""
        assert is_valid_variable_name('') is False


class TestIsVariableEffect:
    """Test variable effect detection."""
    
    def test_valid_effects(self):
        """Test valid variable effects."""
        assert is_variable_effect('set_variable') is True
        assert is_variable_effect('change_variable') is True
        assert is_variable_effect('clamp_variable') is True
        assert is_variable_effect('round_variable') is True
        assert is_variable_effect('remove_variable') is True
    
    def test_valid_list_effects(self):
        """Test valid variable list effects."""
        assert is_variable_effect('add_to_variable_list') is True
        assert is_variable_effect('remove_list_variable') is True
        assert is_variable_effect('clear_variable_list') is True
    
    def test_invalid_effects(self):
        """Test invalid effects."""
        assert is_variable_effect('add_gold') is False
        assert is_variable_effect('has_variable') is False


class TestIsVariableTrigger:
    """Test variable trigger detection."""
    
    def test_valid_triggers(self):
        """Test valid variable triggers."""
        assert is_variable_trigger('has_variable') is True
        assert is_variable_trigger('is_target_in_variable_list') is True
        assert is_variable_trigger('variable_list_size') is True
    
    def test_valid_list_iterators(self):
        """Test valid list iterator triggers."""
        assert is_variable_trigger('any_in_list') is True
        assert is_variable_trigger('every_in_list') is True
        assert is_variable_trigger('ordered_in_list') is True
        assert is_variable_trigger('random_in_list') is True
    
    def test_invalid_triggers(self):
        """Test invalid triggers."""
        assert is_variable_trigger('is_adult') is False
        assert is_variable_trigger('set_variable') is False


class TestValidateSetVariable:
    """Test set_variable validation."""
    
    def test_valid_set_variable(self):
        """Test valid set_variable."""
        params = {'name': 'my_var', 'value': 100}
        is_valid, error = validate_set_variable(params)
        assert is_valid is True
        assert error is None
    
    def test_valid_with_days(self):
        """Test valid set_variable with days parameter."""
        params = {'name': 'my_var', 'value': 100, 'days': 30}
        is_valid, error = validate_set_variable(params)
        assert is_valid is True
    
    def test_missing_name(self):
        """Test set_variable without name."""
        params = {'value': 100}
        is_valid, error = validate_set_variable(params)
        assert is_valid is False
        assert 'name' in error
    
    def test_missing_value(self):
        """Test set_variable without value."""
        params = {'name': 'my_var'}
        is_valid, error = validate_set_variable(params)
        assert is_valid is False
        assert 'value' in error
    
    def test_invalid_name(self):
        """Test set_variable with invalid name."""
        params = {'name': '123invalid', 'value': 100}
        is_valid, error = validate_set_variable(params)
        assert is_valid is False
        assert 'Invalid variable name' in error


class TestValidateChangeVariable:
    """Test change_variable validation."""
    
    def test_valid_add(self):
        """Test valid change_variable with add."""
        params = {'name': 'my_var', 'add': 10}
        is_valid, error = validate_change_variable(params)
        assert is_valid is True
        assert error is None
    
    def test_valid_subtract(self):
        """Test valid change_variable with subtract."""
        params = {'name': 'my_var', 'subtract': 5}
        is_valid, error = validate_change_variable(params)
        assert is_valid is True
    
    def test_valid_multiply(self):
        """Test valid change_variable with multiply."""
        params = {'name': 'my_var', 'multiply': 2}
        is_valid, error = validate_change_variable(params)
        assert is_valid is True
    
    def test_valid_divide(self):
        """Test valid change_variable with divide."""
        params = {'name': 'my_var', 'divide': 3}
        is_valid, error = validate_change_variable(params)
        assert is_valid is True
    
    def test_valid_multiple_operations(self):
        """Test valid change_variable with multiple operations."""
        params = {'name': 'my_var', 'add': 10, 'multiply': 2}
        is_valid, error = validate_change_variable(params)
        assert is_valid is True
    
    def test_missing_name(self):
        """Test change_variable without name."""
        params = {'add': 10}
        is_valid, error = validate_change_variable(params)
        assert is_valid is False
        assert 'name' in error
    
    def test_missing_operation(self):
        """Test change_variable without operation."""
        params = {'name': 'my_var'}
        is_valid, error = validate_change_variable(params)
        assert is_valid is False
        assert 'operation' in error


class TestValidateClampVariable:
    """Test clamp_variable validation."""
    
    def test_valid_min_max(self):
        """Test valid clamp_variable with min and max."""
        params = {'name': 'my_var', 'min': 0, 'max': 100}
        is_valid, error = validate_clamp_variable(params)
        assert is_valid is True
        assert error is None
    
    def test_valid_min_only(self):
        """Test valid clamp_variable with min only."""
        params = {'name': 'my_var', 'min': 0}
        is_valid, error = validate_clamp_variable(params)
        assert is_valid is True
    
    def test_valid_max_only(self):
        """Test valid clamp_variable with max only."""
        params = {'name': 'my_var', 'max': 100}
        is_valid, error = validate_clamp_variable(params)
        assert is_valid is True
    
    def test_missing_name(self):
        """Test clamp_variable without name."""
        params = {'min': 0, 'max': 100}
        is_valid, error = validate_clamp_variable(params)
        assert is_valid is False
        assert 'name' in error
    
    def test_missing_bounds(self):
        """Test clamp_variable without min or max."""
        params = {'name': 'my_var'}
        is_valid, error = validate_clamp_variable(params)
        assert is_valid is False
        assert 'min' in error or 'max' in error
    
    def test_invalid_range(self):
        """Test clamp_variable with min > max."""
        params = {'name': 'my_var', 'min': 100, 'max': 0}
        is_valid, error = validate_clamp_variable(params)
        assert is_valid is False
        assert 'cannot be greater than' in error


class TestValidateVariableListOperation:
    """Test variable list operation validation."""
    
    def test_valid_add_to_list(self):
        """Test valid add_to_variable_list."""
        params = {'name': 'my_list', 'target': 'scope:character'}
        is_valid, error = validate_variable_list_operation('add_to_variable_list', params)
        assert is_valid is True
        assert error is None
    
    def test_valid_remove_from_list(self):
        """Test valid remove_list_variable."""
        params = {'name': 'my_list', 'target': 'scope:character'}
        is_valid, error = validate_variable_list_operation('remove_list_variable', params)
        assert is_valid is True
    
    def test_valid_clear_list(self):
        """Test valid clear_variable_list."""
        params = {'name': 'my_list'}
        is_valid, error = validate_variable_list_operation('clear_variable_list', params)
        assert is_valid is True
    
    def test_add_to_list_missing_name(self):
        """Test add_to_variable_list without name."""
        params = {'target': 'scope:character'}
        is_valid, error = validate_variable_list_operation('add_to_variable_list', params)
        assert is_valid is False
        assert 'name' in error
    
    def test_add_to_list_missing_target(self):
        """Test add_to_variable_list without target."""
        params = {'name': 'my_list'}
        is_valid, error = validate_variable_list_operation('add_to_variable_list', params)
        assert is_valid is False
        assert 'target' in error


class TestGetVariableScopeType:
    """Test variable scope type descriptions."""
    
    def test_var_scope(self):
        """Test var scope description."""
        desc = get_variable_scope_type('var')
        assert 'persistent' in desc.lower()
    
    def test_local_var_scope(self):
        """Test local_var scope description."""
        desc = get_variable_scope_type('local_var')
        assert 'temporary' in desc.lower() or 'block' in desc.lower()
    
    def test_global_var_scope(self):
        """Test global_var scope description."""
        desc = get_variable_scope_type('global_var')
        assert 'global' in desc.lower()


class TestSuggestVariableScope:
    """Test variable scope suggestions."""
    
    def test_suggest_local_for_immediate(self):
        """Test suggesting local_var for immediate context."""
        assert suggest_variable_scope('immediate') == 'local_var'
        assert suggest_variable_scope('option') == 'local_var'
        assert suggest_variable_scope('effect') == 'local_var'
    
    def test_suggest_var_for_character(self):
        """Test suggesting var for character context."""
        assert suggest_variable_scope('character') == 'var'
        assert suggest_variable_scope('title') == 'var'
    
    def test_suggest_global_for_other(self):
        """Test suggesting global_var for other contexts."""
        assert suggest_variable_scope('unknown') == 'global_var'


class TestCreateVariable:
    """Test variable creation."""
    
    def test_create_simple_variable(self):
        """Test creating simple variable."""
        var = create_variable('my_var')
        assert var.name == 'my_var'
        assert var.scope == 'var'
        assert var.value is None
        assert var.is_list is False
    
    def test_create_with_scope(self):
        """Test creating variable with specific scope."""
        var = create_variable('counter', scope='local_var')
        assert var.scope == 'local_var'
    
    def test_create_with_value(self):
        """Test creating variable with value."""
        var = create_variable('my_var', value=100)
        assert var.value == 100
    
    def test_create_list_variable(self):
        """Test creating list variable."""
        var = create_variable('my_list', is_list=True)
        assert var.is_list is True


class TestFormatVariableReference:
    """Test variable reference formatting."""
    
    def test_format_var(self):
        """Test formatting var reference."""
        var = Variable(name='my_var', scope='var')
        formatted = format_variable_reference(var)
        assert formatted == 'var:my_var'
    
    def test_format_local_var(self):
        """Test formatting local_var reference."""
        var = Variable(name='counter', scope='local_var')
        formatted = format_variable_reference(var)
        assert formatted == 'local_var:counter'
    
    def test_format_global_var(self):
        """Test formatting global_var reference."""
        var = Variable(name='state', scope='global_var')
        formatted = format_variable_reference(var)
        assert formatted == 'global_var:state'


class TestExtractVariableComparisons:
    """Test extracting variable comparisons from text."""
    
    def test_extract_single_comparison(self):
        """Test extracting single comparison."""
        text = 'var:my_var >= 10'
        comparisons = extract_variable_comparisons(text)
        assert len(comparisons) == 1
        assert comparisons[0] == ('var:my_var', '>=', '10')
    
    def test_extract_multiple_comparisons(self):
        """Test extracting multiple comparisons."""
        text = 'var:counter > 5 AND local_var:temp < 100'
        comparisons = extract_variable_comparisons(text)
        assert len(comparisons) == 2
    
    def test_extract_different_operators(self):
        """Test extracting different comparison operators."""
        text = 'var:a >= 10 var:b <= 20 var:c == 15 var:d != 0'
        comparisons = extract_variable_comparisons(text)
        assert len(comparisons) == 4
    
    def test_extract_no_comparisons(self):
        """Test text without comparisons."""
        text = 'set_variable = { name = my_var value = 100 }'
        comparisons = extract_variable_comparisons(text)
        assert len(comparisons) == 0


class TestVariableIntegration:
    """Integration tests for variable system."""
    
    def test_complete_variable_workflow(self):
        """Test complete workflow for variable."""
        # Create
        var = create_variable('my_counter', scope='local_var', value=0)
        assert var is not None
        
        # Format reference
        ref = format_variable_reference(var)
        assert ref == 'local_var:my_counter'
        
        # Parse reference
        parsed = parse_variable_reference(ref)
        assert parsed == ('local_var', 'my_counter')
        
        # Validate set
        set_params = {'name': 'my_counter', 'value': 10}
        is_valid, error = validate_set_variable(set_params)
        assert is_valid is True
        
        # Validate change
        change_params = {'name': 'my_counter', 'add': 5}
        is_valid, error = validate_change_variable(change_params)
        assert is_valid is True
    
    def test_variable_list_workflow(self):
        """Test complete workflow for variable list."""
        # Create list variable
        var_list = create_variable('my_list', is_list=True)
        assert var_list.is_list is True
        
        # Validate add to list
        add_params = {'name': 'my_list', 'target': 'scope:char'}
        is_valid, error = validate_variable_list_operation('add_to_variable_list', add_params)
        assert is_valid is True
        
        # Validate clear list
        clear_params = {'name': 'my_list'}
        is_valid, error = validate_variable_list_operation('clear_variable_list', clear_params)
        assert is_valid is True
