"""
Tests for CK3 Event System Module

Tests event validation, types, themes, portraits, and dynamic descriptions.
"""

import pytest
from pychivalry.events import (
    is_valid_event_type,
    is_valid_theme,
    is_valid_portrait_position,
    is_valid_portrait_animation,
    validate_event_fields,
    validate_portrait_configuration,
    parse_event_id,
    validate_dynamic_description,
    get_event_type_description,
    get_theme_description,
    create_event,
    validate_option,
    suggest_event_id_format,
    Event,
)


class TestIsValidEventType:
    """Test event type validation."""
    
    def test_valid_character_event(self):
        """Test valid character_event type."""
        assert is_valid_event_type('character_event') is True
    
    def test_valid_letter_event(self):
        """Test valid letter_event type."""
        assert is_valid_event_type('letter_event') is True
    
    def test_valid_court_event(self):
        """Test valid court_event type."""
        assert is_valid_event_type('court_event') is True
    
    def test_valid_all_types(self):
        """Test all valid event types."""
        valid_types = ['character_event', 'letter_event', 'court_event', 'duel_event', 'feast_event', 'story_cycle']
        for event_type in valid_types:
            assert is_valid_event_type(event_type) is True
    
    def test_invalid_type(self):
        """Test invalid event type."""
        assert is_valid_event_type('invalid_event') is False
        assert is_valid_event_type('') is False


class TestIsValidTheme:
    """Test event theme validation."""
    
    def test_valid_themes(self):
        """Test valid themes."""
        valid_themes = ['default', 'diplomacy', 'intrigue', 'martial', 'faith', 'war']
        for theme in valid_themes:
            assert is_valid_theme(theme) is True
    
    def test_invalid_theme(self):
        """Test invalid theme."""
        assert is_valid_theme('invalid_theme') is False
        assert is_valid_theme('') is False


class TestIsValidPortraitPosition:
    """Test portrait position validation."""
    
    def test_valid_positions(self):
        """Test valid portrait positions."""
        positions = ['left_portrait', 'right_portrait', 'lower_left_portrait', 'lower_center_portrait', 'lower_right_portrait']
        for position in positions:
            assert is_valid_portrait_position(position) is True
    
    def test_invalid_position(self):
        """Test invalid portrait position."""
        assert is_valid_portrait_position('center_portrait') is False
        assert is_valid_portrait_position('') is False


class TestIsValidPortraitAnimation:
    """Test portrait animation validation."""
    
    def test_valid_animations(self):
        """Test valid animations."""
        animations = ['idle', 'happiness', 'sadness', 'anger', 'fear', 'shock']
        for animation in animations:
            assert is_valid_portrait_animation(animation) is True
    
    def test_invalid_animation(self):
        """Test invalid animation."""
        assert is_valid_portrait_animation('invalid_animation') is False


class TestValidateEventFields:
    """Test event field validation."""
    
    def test_valid_character_event(self):
        """Test valid character event with all fields."""
        event = Event(
            event_id='test.0001',
            event_type='character_event',
            title='test.0001.t',
            desc='test.0001.desc'
        )
        is_valid, missing = validate_event_fields(event)
        assert is_valid is True
        assert missing == []
    
    def test_missing_title(self):
        """Test event missing title."""
        event = Event(
            event_id='test.0001',
            event_type='character_event',
            desc='test.0001.desc'
        )
        is_valid, missing = validate_event_fields(event)
        assert is_valid is False
        assert 'title' in missing
    
    def test_missing_desc(self):
        """Test event missing desc."""
        event = Event(
            event_id='test.0001',
            event_type='character_event',
            title='test.0001.t'
        )
        is_valid, missing = validate_event_fields(event)
        assert is_valid is False
        assert 'desc' in missing
    
    def test_missing_multiple_fields(self):
        """Test event missing multiple fields."""
        event = Event(
            event_id='test.0001',
            event_type='character_event'
        )
        is_valid, missing = validate_event_fields(event)
        assert is_valid is False
        assert len(missing) >= 2
    
    def test_invalid_event_type(self):
        """Test event with invalid type."""
        event = Event(
            event_id='test.0001',
            event_type='invalid_type'
        )
        is_valid, missing = validate_event_fields(event)
        assert is_valid is False


class TestValidatePortraitConfiguration:
    """Test portrait configuration validation."""
    
    def test_valid_portrait_simple(self):
        """Test valid simple portrait config."""
        config = {'character': 'root'}
        is_valid, error = validate_portrait_configuration(config)
        assert is_valid is True
        assert error is None
    
    def test_valid_portrait_with_animation(self):
        """Test valid portrait with animation."""
        config = {'character': 'root', 'animation': 'happiness'}
        is_valid, error = validate_portrait_configuration(config)
        assert is_valid is True
    
    def test_invalid_animation(self):
        """Test invalid animation."""
        config = {'character': 'root', 'animation': 'invalid'}
        is_valid, error = validate_portrait_configuration(config)
        assert is_valid is False
        assert 'animation' in error
    
    def test_invalid_not_dict(self):
        """Test invalid non-dict config."""
        is_valid, error = validate_portrait_configuration('not_a_dict')
        assert is_valid is False
        assert 'dictionary' in error


class TestParseEventId:
    """Test event ID parsing."""
    
    def test_parse_simple_id(self):
        """Test parsing simple event ID."""
        namespace, number = parse_event_id('my_mod.0001')
        assert namespace == 'my_mod'
        assert number == '0001'
    
    def test_parse_nested_namespace(self):
        """Test parsing nested namespace."""
        namespace, number = parse_event_id('my_mod.events.0001')
        assert namespace == 'my_mod.events'
        assert number == '0001'
    
    def test_parse_invalid_no_dot(self):
        """Test parsing invalid ID without dot."""
        namespace, number = parse_event_id('invalid')
        assert namespace is None
        assert number is None
    
    def test_parse_various_formats(self):
        """Test parsing various valid formats."""
        test_cases = [
            ('mod.0001', 'mod', '0001'),
            ('my.long.namespace.9999', 'my.long.namespace', '9999'),
            ('test.a', 'test', 'a'),
        ]
        for event_id, expected_ns, expected_num in test_cases:
            namespace, number = parse_event_id(event_id)
            assert namespace == expected_ns
            assert number == expected_num


class TestValidateDynamicDescription:
    """Test dynamic description validation."""
    
    def test_valid_triggered_desc(self):
        """Test valid triggered_desc."""
        config = {
            'triggered_desc': {
                'trigger': {'is_adult': 'yes'},
                'desc': 'test.desc'
            }
        }
        is_valid, error = validate_dynamic_description(config)
        assert is_valid is True
        assert error is None
    
    def test_triggered_desc_missing_trigger(self):
        """Test triggered_desc without trigger."""
        config = {
            'triggered_desc': {
                'desc': 'test.desc'
            }
        }
        is_valid, error = validate_dynamic_description(config)
        assert is_valid is False
        assert 'trigger' in error
    
    def test_triggered_desc_missing_desc(self):
        """Test triggered_desc without desc."""
        config = {
            'triggered_desc': {
                'trigger': {'is_adult': 'yes'}
            }
        }
        is_valid, error = validate_dynamic_description(config)
        assert is_valid is False
        assert 'desc' in error
    
    def test_invalid_not_dict(self):
        """Test invalid non-dict config."""
        is_valid, error = validate_dynamic_description('not_a_dict')
        assert is_valid is False
        assert 'dictionary' in error


class TestGetEventTypeDescription:
    """Test event type description retrieval."""
    
    def test_get_character_event_description(self):
        """Test character_event description."""
        desc = get_event_type_description('character_event')
        assert 'character' in desc.lower()
        assert 'portrait' in desc.lower()
    
    def test_get_letter_event_description(self):
        """Test letter_event description."""
        desc = get_event_type_description('letter_event')
        assert 'letter' in desc.lower()
    
    def test_get_unknown_type(self):
        """Test unknown event type."""
        desc = get_event_type_description('unknown')
        assert 'unknown' in desc.lower()


class TestGetThemeDescription:
    """Test theme description retrieval."""
    
    def test_get_diplomacy_description(self):
        """Test diplomacy theme description."""
        desc = get_theme_description('diplomacy')
        assert 'diplom' in desc.lower()
    
    def test_get_intrigue_description(self):
        """Test intrigue theme description."""
        desc = get_theme_description('intrigue')
        assert 'intrigue' in desc.lower() or 'plot' in desc.lower()
    
    def test_get_unknown_theme(self):
        """Test unknown theme."""
        desc = get_theme_description('unknown')
        assert 'custom' in desc.lower() or 'unknown' in desc.lower()


class TestCreateEvent:
    """Test event creation."""
    
    def test_create_valid_event(self):
        """Test creating valid event."""
        event = create_event(
            'my_mod.0001',
            'character_event',
            title='my_mod.0001.t',
            desc='my_mod.0001.desc'
        )
        assert event.event_id == 'my_mod.0001'
        assert event.event_type == 'character_event'
        assert event.namespace == 'my_mod'
        assert event.title == 'my_mod.0001.t'
        assert event.desc == 'my_mod.0001.desc'
    
    def test_create_with_theme(self):
        """Test creating event with theme."""
        event = create_event(
            'test.0001',
            'character_event',
            title='test.t',
            desc='test.desc',
            theme='diplomacy'
        )
        assert event.theme == 'diplomacy'
    
    def test_create_invalid_type(self):
        """Test creating event with invalid type."""
        with pytest.raises(ValueError):
            create_event('test.0001', 'invalid_type')


class TestValidateOption:
    """Test event option validation."""
    
    def test_valid_option(self):
        """Test valid option with name."""
        option = {'name': 'test.option.a'}
        is_valid, error = validate_option(option)
        assert is_valid is True
        assert error is None
    
    def test_missing_name(self):
        """Test option missing name."""
        option = {'effect': 'add_gold = 100'}
        is_valid, error = validate_option(option)
        assert is_valid is False
        assert 'name' in error
    
    def test_invalid_not_dict(self):
        """Test invalid non-dict option."""
        is_valid, error = validate_option('not_a_dict')
        assert is_valid is False
        assert 'dictionary' in error


class TestSuggestEventIdFormat:
    """Test event ID format suggestions."""
    
    def test_suggest_for_namespace(self):
        """Test suggestions for namespace."""
        suggestions = suggest_event_id_format('my_mod')
        assert len(suggestions) > 0
        for suggestion in suggestions:
            assert suggestion.startswith('my_mod.')
            assert '.' in suggestion
    
    def test_suggestions_follow_pattern(self):
        """Test suggestions follow numbering pattern."""
        suggestions = suggest_event_id_format('test')
        # Should include various numbering patterns
        assert any('0001' in s for s in suggestions)


class TestEventIntegration:
    """Integration tests for event system."""
    
    def test_complete_event_workflow(self):
        """Test complete workflow for event."""
        # Create event
        event = create_event(
            'test_mod.0001',
            'character_event',
            title='test_mod.0001.t',
            desc='test_mod.0001.desc',
            theme='diplomacy'
        )
        
        assert event.event_id == 'test_mod.0001'
        assert event.namespace == 'test_mod'
        
        # Validate fields
        is_valid, missing = validate_event_fields(event)
        assert is_valid is True
        assert missing == []
        
        # Check type and theme validity
        assert is_valid_event_type(event.event_type) is True
        assert is_valid_theme(event.theme) is True
    
    def test_letter_event_workflow(self):
        """Test workflow for letter event."""
        event = create_event(
            'letters.0001',
            'letter_event',
            title='letters.0001.t',
            desc='letters.0001.desc'
        )
        
        assert event.event_type == 'letter_event'
        
        # Get description
        desc = get_event_type_description(event.event_type)
        assert 'letter' in desc.lower()
    
    def test_portrait_and_option_workflow(self):
        """Test portrait and option validation."""
        # Validate portrait
        portrait = {'character': 'root', 'animation': 'happiness'}
        is_valid, error = validate_portrait_configuration(portrait)
        assert is_valid is True
        
        # Validate option
        option = {'name': 'test.option.a', 'trigger': {}, 'effect': {}}
        is_valid, error = validate_option(option)
        assert is_valid is True
