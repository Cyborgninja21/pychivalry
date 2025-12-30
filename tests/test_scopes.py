"""
Tests for the scope system.

This module tests scope type validation, navigation, and link checking.
"""

import pytest

from pychivalry.scopes import (
    get_scope_links,
    get_scope_lists,
    get_scope_triggers,
    get_scope_effects,
    get_available_scope_types,
    get_resulting_scope,
    validate_scope_chain,
    is_valid_trigger,
    is_valid_effect,
    is_valid_list_base,
    get_list_prefixes,
    parse_list_iterator,
    UNIVERSAL_LINKS,
)


class TestScopeLinks:
    """Tests for scope link retrieval."""
    
    def test_get_character_links(self):
        """Get valid links for character scope."""
        links = get_scope_links('character')
        
        # Should include specific character links
        assert 'liege' in links
        assert 'spouse' in links
        assert 'father' in links
        
        # Should include universal links
        assert 'root' in links
        assert 'this' in links
        assert 'prev' in links
    
    def test_unknown_scope_returns_universal_links(self):
        """Unknown scope returns only universal links."""
        links = get_scope_links('unknown_scope')
        
        # Should have universal links
        for link in UNIVERSAL_LINKS:
            assert link in links
    
    def test_universal_links_in_all_scopes(self):
        """Universal links available in all scopes."""
        scope_types = get_available_scope_types()
        
        for scope_type in scope_types:
            links = get_scope_links(scope_type)
            for universal_link in UNIVERSAL_LINKS:
                assert universal_link in links


class TestScopeLists:
    """Tests for scope list iterations."""
    
    def test_get_character_lists(self):
        """Get valid lists for character scope."""
        lists = get_scope_lists('character')
        
        # Should include common character lists
        assert 'vassal' in lists
        assert 'courtier' in lists
        assert 'child' in lists
    
    def test_unknown_scope_returns_empty_lists(self):
        """Unknown scope returns empty list."""
        lists = get_scope_lists('unknown_scope')
        assert lists == []


class TestScopeTriggers:
    """Tests for scope trigger validation."""
    
    def test_get_character_triggers(self):
        """Get valid triggers for character scope."""
        triggers = get_scope_triggers('character')
        
        # Should include common character triggers
        assert 'is_adult' in triggers
        assert 'is_alive' in triggers
        assert 'has_trait' in triggers
    
    def test_is_valid_trigger(self):
        """Check if trigger is valid in scope."""
        assert is_valid_trigger('is_adult', 'character') is True
        assert is_valid_trigger('nonexistent_trigger', 'character') is False


class TestScopeEffects:
    """Tests for scope effect validation."""
    
    def test_get_character_effects(self):
        """Get valid effects for character scope."""
        effects = get_scope_effects('character')
        
        # Should include common character effects
        assert 'add_trait' in effects
        assert 'add_gold' in effects
        assert 'death' in effects
    
    def test_is_valid_effect(self):
        """Check if effect is valid in scope."""
        assert is_valid_effect('add_gold', 'character') is True
        assert is_valid_effect('nonexistent_effect', 'character') is False


class TestAvailableScopeTypes:
    """Tests for available scope types."""
    
    def test_get_available_scope_types(self):
        """Get all available scope types."""
        scope_types = get_available_scope_types()
        
        # Should have at least character scope
        assert len(scope_types) > 0
        assert 'character' in scope_types
    
    def test_all_scope_types_loadable(self):
        """All scope types can be loaded."""
        scope_types = get_available_scope_types()
        
        for scope_type in scope_types:
            # Should be able to get data for each scope
            links = get_scope_links(scope_type)
            assert isinstance(links, list)


class TestScopeNavigation:
    """Tests for scope chain navigation."""
    
    def test_get_resulting_scope_same_type(self):
        """Some links return same scope type."""
        # character.liege -> character
        result = get_resulting_scope('character', 'liege')
        assert result == 'character'
    
    def test_get_resulting_scope_different_type(self):
        """Some links return different scope type."""
        # character.primary_title -> landed_title
        result = get_resulting_scope('character', 'primary_title')
        assert result == 'landed_title'
    
    def test_universal_links_preserve_scope(self):
        """Universal links preserve scope type."""
        for link in UNIVERSAL_LINKS:
            result = get_resulting_scope('character', link)
            assert result == 'character'
    
    def test_validate_simple_chain(self):
        """Validate simple scope chain."""
        valid, result = validate_scope_chain('liege', 'character')
        assert valid is True
        assert result == 'character'
    
    def test_validate_multi_step_chain(self):
        """Validate multi-step scope chain."""
        valid, result = validate_scope_chain('liege.primary_title', 'character')
        assert valid is True
        # liege (character) -> primary_title (landed_title)
        assert result == 'landed_title'
    
    def test_validate_invalid_chain(self):
        """Invalid scope chain fails validation."""
        valid, error = validate_scope_chain('invalid_link', 'character')
        assert valid is False
        assert 'not a valid link' in error
    
    def test_validate_empty_chain(self):
        """Empty chain is valid (stays in same scope)."""
        valid, result = validate_scope_chain('', 'character')
        assert valid is True
        assert result == 'character'


class TestListIterators:
    """Tests for list iteration support."""
    
    def test_get_list_prefixes(self):
        """Get all list prefixes."""
        prefixes = get_list_prefixes()
        
        assert 'any_' in prefixes
        assert 'every_' in prefixes
        assert 'random_' in prefixes
        assert 'ordered_' in prefixes
    
    def test_parse_list_iterator_every(self):
        """Parse every_* list iterator."""
        result = parse_list_iterator('every_vassal')
        assert result == ('every_', 'vassal')
    
    def test_parse_list_iterator_any(self):
        """Parse any_* list iterator."""
        result = parse_list_iterator('any_child')
        assert result == ('any_', 'child')
    
    def test_parse_list_iterator_random(self):
        """Parse random_* list iterator."""
        result = parse_list_iterator('random_courtier')
        assert result == ('random_', 'courtier')
    
    def test_parse_list_iterator_ordered(self):
        """Parse ordered_* list iterator."""
        result = parse_list_iterator('ordered_vassal')
        assert result == ('ordered_', 'vassal')
    
    def test_parse_list_iterator_invalid(self):
        """Invalid list iterator returns None."""
        result = parse_list_iterator('not_a_list_iterator')
        assert result is None
    
    def test_is_valid_list_base(self):
        """Check if list base is valid."""
        assert is_valid_list_base('vassal', 'character') is True
        assert is_valid_list_base('nonexistent_list', 'character') is False


class TestScopeIntegration:
    """Integration tests for scope system."""
    
    def test_character_scope_complete(self):
        """Character scope has complete data."""
        links = get_scope_links('character')
        lists = get_scope_lists('character')
        triggers = get_scope_triggers('character')
        effects = get_scope_effects('character')
        
        # All should have data
        assert len(links) > 0
        assert len(lists) > 0
        assert len(triggers) > 0
        assert len(effects) > 0
    
    def test_common_scope_chain_validation(self):
        """Common scope chains validate correctly."""
        # character -> character chains
        assert validate_scope_chain('liege.liege', 'character')[0] is True
        assert validate_scope_chain('father.father', 'character')[0] is True
        
        # character -> title -> character chains
        assert validate_scope_chain('primary_title.holder', 'character')[0] is True
    
    def test_list_iterator_with_validation(self):
        """List iterator parsing and validation work together."""
        iterator = 'every_vassal'
        result = parse_list_iterator(iterator)
        
        assert result is not None
        prefix, base = result
        
        # Base should be valid in character scope
        assert is_valid_list_base(base, 'character') is True
