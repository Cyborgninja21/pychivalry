"""
Tests for CK3 Script Lists Module

Tests list iterator parsing, validation, and parameter checking.
"""

import pytest
from pychivalry.lists import (
    parse_list_iterator,
    is_list_iterator,
    get_supported_parameters,
    validate_list_block_content,
    is_valid_list_parameter,
    is_valid_list_base,
    get_list_result_scope,
    ListIteratorInfo,
)


class TestParseListIterator:
    """Test parsing of list iterator identifiers."""
    
    def test_parse_any_vassal(self):
        """Test parsing any_vassal iterator."""
        result = parse_list_iterator('any_vassal')
        assert result is not None
        assert result.prefix == 'any_'
        assert result.base_name == 'vassal'
        assert result.iterator_type == 'trigger'
        assert 'count' in result.supported_params
        assert 'percent' in result.supported_params
    
    def test_parse_every_courtier(self):
        """Test parsing every_courtier iterator."""
        result = parse_list_iterator('every_courtier')
        assert result is not None
        assert result.prefix == 'every_'
        assert result.base_name == 'courtier'
        assert result.iterator_type == 'effect'
        assert 'limit' in result.supported_params
        assert 'max' in result.supported_params
    
    def test_parse_random_prisoner(self):
        """Test parsing random_prisoner iterator."""
        result = parse_list_iterator('random_prisoner')
        assert result is not None
        assert result.prefix == 'random_'
        assert result.base_name == 'prisoner'
        assert result.iterator_type == 'effect'
        assert 'weight' in result.supported_params
    
    def test_parse_ordered_child(self):
        """Test parsing ordered_child iterator."""
        result = parse_list_iterator('ordered_child')
        assert result is not None
        assert result.prefix == 'ordered_'
        assert result.base_name == 'child'
        assert result.iterator_type == 'effect'
        assert 'order_by' in result.supported_params
        assert 'position' in result.supported_params
    
    def test_parse_non_iterator(self):
        """Test parsing non-iterator identifier."""
        result = parse_list_iterator('add_gold')
        assert result is None
    
    def test_parse_invalid_prefix_only(self):
        """Test parsing prefix without base name."""
        result = parse_list_iterator('any_')
        assert result is None
    
    def test_parse_custom_list_base(self):
        """Test parsing iterator with custom base name."""
        result = parse_list_iterator('any_my_custom_list')
        assert result is not None
        assert result.base_name == 'my_custom_list'


class TestIsListIterator:
    """Test list iterator detection."""
    
    def test_is_list_iterator_any(self):
        """Test detection of any_ iterator."""
        assert is_list_iterator('any_vassal') is True
    
    def test_is_list_iterator_every(self):
        """Test detection of every_ iterator."""
        assert is_list_iterator('every_courtier') is True
    
    def test_is_list_iterator_random(self):
        """Test detection of random_ iterator."""
        assert is_list_iterator('random_child') is True
    
    def test_is_list_iterator_ordered(self):
        """Test detection of ordered_ iterator."""
        assert is_list_iterator('ordered_spouse') is True
    
    def test_is_list_iterator_false(self):
        """Test non-iterator returns false."""
        assert is_list_iterator('add_gold') is False
        assert is_list_iterator('has_trait') is False
        assert is_list_iterator('liege') is False


class TestGetSupportedParameters:
    """Test getting supported parameters for iterators."""
    
    def test_any_parameters(self):
        """Test any_ iterator parameters."""
        info = parse_list_iterator('any_vassal')
        params = get_supported_parameters(info)
        assert 'count' in params
        assert 'percent' in params
        assert 'limit' in params
        assert 'order_by' not in params
    
    def test_every_parameters(self):
        """Test every_ iterator parameters."""
        info = parse_list_iterator('every_courtier')
        params = get_supported_parameters(info)
        assert 'limit' in params
        assert 'max' in params
        assert 'count' not in params
    
    def test_random_parameters(self):
        """Test random_ iterator parameters."""
        info = parse_list_iterator('random_child')
        params = get_supported_parameters(info)
        assert 'limit' in params
        assert 'weight' in params
        assert 'order_by' not in params
    
    def test_ordered_parameters(self):
        """Test ordered_ iterator parameters."""
        info = parse_list_iterator('ordered_spouse')
        params = get_supported_parameters(info)
        assert 'limit' in params
        assert 'order_by' in params
        assert 'position' in params
        assert 'max' in params
        assert 'min' in params


class TestIsValidListParameter:
    """Test list parameter validation."""
    
    def test_valid_any_parameter(self):
        """Test valid parameter for any_ iterator."""
        info = parse_list_iterator('any_vassal')
        assert is_valid_list_parameter(info, 'count') is True
        assert is_valid_list_parameter(info, 'percent') is True
    
    def test_invalid_any_parameter(self):
        """Test invalid parameter for any_ iterator."""
        info = parse_list_iterator('any_vassal')
        assert is_valid_list_parameter(info, 'order_by') is False
        assert is_valid_list_parameter(info, 'weight') is False
    
    def test_valid_every_parameter(self):
        """Test valid parameter for every_ iterator."""
        info = parse_list_iterator('every_courtier')
        assert is_valid_list_parameter(info, 'limit') is True
        assert is_valid_list_parameter(info, 'max') is True
    
    def test_invalid_every_parameter(self):
        """Test invalid parameter for every_ iterator."""
        info = parse_list_iterator('every_courtier')
        assert is_valid_list_parameter(info, 'count') is False
        assert is_valid_list_parameter(info, 'position') is False
    
    def test_valid_random_parameter(self):
        """Test valid parameter for random_ iterator."""
        info = parse_list_iterator('random_child')
        assert is_valid_list_parameter(info, 'limit') is True
        assert is_valid_list_parameter(info, 'weight') is True
    
    def test_valid_ordered_parameter(self):
        """Test valid parameter for ordered_ iterator."""
        info = parse_list_iterator('ordered_spouse')
        assert is_valid_list_parameter(info, 'order_by') is True
        assert is_valid_list_parameter(info, 'position') is True


class TestValidateListBlockContent:
    """Test validation of list block content."""
    
    def test_any_block_content(self):
        """Test any_ block can contain triggers."""
        info = parse_list_iterator('any_vassal')
        is_valid, error = validate_list_block_content(info, 'has_trait', False)
        assert is_valid is True
        assert error is None
    
    def test_every_block_content(self):
        """Test every_ block can contain effects."""
        info = parse_list_iterator('every_courtier')
        is_valid, error = validate_list_block_content(info, 'add_gold', False)
        assert is_valid is True
        assert error is None


class TestIsValidListBase:
    """Test validation of list base names."""
    
    def test_valid_character_list_base(self):
        """Test valid character list bases."""
        assert is_valid_list_base('vassal') is True
        assert is_valid_list_base('courtier') is True
        assert is_valid_list_base('prisoner') is True
        assert is_valid_list_base('child') is True
    
    def test_valid_title_list_base(self):
        """Test valid title list bases."""
        assert is_valid_list_base('held_title') is True
        assert is_valid_list_base('claim') is True
        assert is_valid_list_base('de_jure_county') is True
    
    def test_valid_province_list_base(self):
        """Test valid province list bases."""
        assert is_valid_list_base('realm_province') is True
        assert is_valid_list_base('county_province') is True
    
    def test_invalid_list_base(self):
        """Test invalid list base names."""
        assert is_valid_list_base('not_a_list') is False
        assert is_valid_list_base('add_gold') is False


class TestGetListResultScope:
    """Test determining result scope from list iteration."""
    
    def test_character_list_scope(self):
        """Test character lists return character scope."""
        assert get_list_result_scope('vassal', 'character') == 'character'
        assert get_list_result_scope('courtier', 'character') == 'character'
        assert get_list_result_scope('child', 'character') == 'character'
    
    def test_title_list_scope(self):
        """Test title lists return title scope."""
        assert get_list_result_scope('held_title', 'character') == 'title'
        assert get_list_result_scope('claim', 'character') == 'title'
        assert get_list_result_scope('de_jure_duchy', 'title') == 'title'
    
    def test_province_list_scope(self):
        """Test province lists return province scope."""
        assert get_list_result_scope('realm_province', 'character') == 'province'
        assert get_list_result_scope('county_province', 'title') == 'province'
    
    def test_variable_list_scope(self):
        """Test variable lists preserve current scope."""
        assert get_list_result_scope('in_list', 'character') == 'character'
        assert get_list_result_scope('in_list', 'title') == 'title'
    
    def test_unknown_list_scope(self):
        """Test unknown lists default to current scope."""
        assert get_list_result_scope('unknown_list', 'character') == 'character'
        assert get_list_result_scope('unknown_list', 'title') == 'title'


class TestListIteratorIntegration:
    """Integration tests for list iterator functionality."""
    
    def test_complete_any_iterator_workflow(self):
        """Test complete workflow for any_ iterator."""
        # Parse
        info = parse_list_iterator('any_vassal')
        assert info is not None
        
        # Check type
        assert info.iterator_type == 'trigger'
        
        # Validate parameters
        assert is_valid_list_parameter(info, 'count') is True
        assert is_valid_list_parameter(info, 'percent') is True
        assert is_valid_list_parameter(info, 'order_by') is False
        
        # Check base
        assert is_valid_list_base('vassal') is True
        
        # Check result scope
        scope = get_list_result_scope('vassal', 'character')
        assert scope == 'character'
    
    def test_complete_every_iterator_workflow(self):
        """Test complete workflow for every_ iterator."""
        # Parse
        info = parse_list_iterator('every_held_title')
        assert info is not None
        
        # Check type
        assert info.iterator_type == 'effect'
        
        # Validate parameters
        assert is_valid_list_parameter(info, 'limit') is True
        assert is_valid_list_parameter(info, 'max') is True
        assert is_valid_list_parameter(info, 'count') is False
        
        # Check base
        assert is_valid_list_base('held_title') is True
        
        # Check result scope
        scope = get_list_result_scope('held_title', 'character')
        assert scope == 'title'
    
    def test_all_prefixes_detected(self):
        """Test all list prefixes are detected."""
        prefixes = ['any_', 'every_', 'random_', 'ordered_']
        base = 'vassal'
        
        for prefix in prefixes:
            identifier = f'{prefix}{base}'
            assert is_list_iterator(identifier) is True
            info = parse_list_iterator(identifier)
            assert info.prefix == prefix
            assert info.base_name == base
