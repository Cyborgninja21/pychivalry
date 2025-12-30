"""
Tests for CK3 Document Symbols Module

Tests outline view and symbol extraction for CK3 scripts.
"""

import pytest
from lsprotocol import types
from pychivalry.symbols import (
    get_symbol_kind,
    create_document_symbol,
    extract_event_symbols,
    extract_scripted_effect_symbols,
    extract_scripted_trigger_symbols,
    extract_script_value_symbols,
    extract_on_action_symbols,
    extract_document_symbols,
    convert_to_lsp_document_symbol,
    find_symbols_by_name,
    get_symbol_hierarchy,
    DocumentSymbol,
)


class TestGetSymbolKind:
    """Test mapping CK3 constructs to LSP symbol kinds."""
    
    def test_event_kind(self):
        """Test event maps to Event kind."""
        kind = get_symbol_kind('event')
        assert kind == types.SymbolKind.Event
    
    def test_scripted_effect_kind(self):
        """Test scripted effect maps to Function kind."""
        kind = get_symbol_kind('scripted_effect')
        assert kind == types.SymbolKind.Function
    
    def test_scripted_trigger_kind(self):
        """Test scripted trigger maps to Function kind."""
        kind = get_symbol_kind('scripted_trigger')
        assert kind == types.SymbolKind.Function
    
    def test_script_value_kind(self):
        """Test script value maps to Variable kind."""
        kind = get_symbol_kind('script_value')
        assert kind == types.SymbolKind.Variable
    
    def test_unknown_kind(self):
        """Test unknown construct maps to Object kind."""
        kind = get_symbol_kind('unknown_type')
        assert kind == types.SymbolKind.Object


class TestCreateDocumentSymbol:
    """Test creating document symbol objects."""
    
    def test_create_simple_symbol(self):
        """Test creating simple symbol."""
        symbol = create_document_symbol('my_event', 'event', 0, 0, 10, 0)
        assert symbol.name == 'my_event'
        assert symbol.kind == types.SymbolKind.Event
        assert symbol.range.start.line == 0
        assert symbol.range.end.line == 10
    
    def test_create_with_detail(self):
        """Test creating symbol with detail."""
        symbol = create_document_symbol('my_value', 'script_value', 0, 0, 5, 0, detail='Type: fixed')
        assert symbol.detail == 'Type: fixed'
    
    def test_selection_range(self):
        """Test selection range is symbol name length."""
        symbol = create_document_symbol('test', 'event', 0, 0, 10, 0)
        assert symbol.selection_range.start.line == 0
        assert symbol.selection_range.start.character == 0
        assert symbol.selection_range.end.character == 4  # len('test')


class TestExtractEventSymbols:
    """Test extracting symbols from events."""
    
    def test_extract_simple_event(self):
        """Test extracting simple event without children."""
        event_node = {
            'id': 'test.0001',
            'type': 'character_event',
            'start_line': 0,
            'start_char': 0,
            'end_line': 10,
            'end_char': 0
        }
        symbol = extract_event_symbols(event_node)
        assert symbol.name == 'test.0001'
        assert symbol.detail == 'character_event'
        assert len(symbol.children) == 0
    
    def test_extract_event_with_trigger(self):
        """Test extracting event with trigger."""
        event_node = {
            'id': 'test.0001',
            'type': 'character_event',
            'start_line': 0,
            'start_char': 0,
            'end_line': 10,
            'end_char': 0,
            'trigger': {
                'start_line': 1,
                'start_char': 4,
                'end_line': 3,
                'end_char': 4
            }
        }
        symbol = extract_event_symbols(event_node)
        assert len(symbol.children) == 1
        assert symbol.children[0].name == 'trigger'
    
    def test_extract_event_with_options(self):
        """Test extracting event with options."""
        event_node = {
            'id': 'test.0001',
            'type': 'character_event',
            'start_line': 0,
            'start_char': 0,
            'end_line': 20,
            'end_char': 0,
            'options': [
                {'name': 'option_a', 'start_line': 10, 'start_char': 4, 'end_line': 12, 'end_char': 4},
                {'name': 'option_b', 'start_line': 13, 'start_char': 4, 'end_line': 15, 'end_char': 4}
            ]
        }
        symbol = extract_event_symbols(event_node)
        assert len(symbol.children) == 2
        assert symbol.children[0].name == 'option_a'
        assert symbol.children[1].name == 'option_b'
    
    def test_extract_event_with_all_children(self):
        """Test extracting event with all child types."""
        event_node = {
            'id': 'test.0001',
            'type': 'character_event',
            'start_line': 0,
            'start_char': 0,
            'end_line': 30,
            'end_char': 0,
            'trigger': {'start_line': 1, 'start_char': 4, 'end_line': 3, 'end_char': 4},
            'immediate': {'start_line': 4, 'start_char': 4, 'end_line': 6, 'end_char': 4},
            'options': [
                {'name': 'option_a', 'start_line': 10, 'start_char': 4, 'end_line': 12, 'end_char': 4}
            ],
            'after': {'start_line': 25, 'start_char': 4, 'end_line': 28, 'end_char': 4}
        }
        symbol = extract_event_symbols(event_node)
        assert len(symbol.children) == 4  # trigger, immediate, option, after


class TestExtractScriptedEffectSymbols:
    """Test extracting symbols from scripted effects."""
    
    def test_extract_effect_without_parameters(self):
        """Test extracting effect without parameters."""
        effect_node = {
            'name': 'my_effect',
            'start_line': 0,
            'start_char': 0,
            'end_line': 5,
            'end_char': 0,
            'parameters': []
        }
        symbol = extract_scripted_effect_symbols(effect_node)
        assert symbol.name == 'my_effect'
        assert symbol.detail is None
        assert len(symbol.children) == 0
    
    def test_extract_effect_with_parameters(self):
        """Test extracting effect with parameters."""
        effect_node = {
            'name': 'my_effect',
            'start_line': 0,
            'start_char': 0,
            'end_line': 5,
            'end_char': 0,
            'parameters': ['PARAM1', 'PARAM2']
        }
        symbol = extract_scripted_effect_symbols(effect_node)
        assert 'PARAM1' in symbol.detail
        assert 'PARAM2' in symbol.detail
        assert len(symbol.children) == 2
        assert symbol.children[0].name == '$PARAM1$'
        assert symbol.children[1].name == '$PARAM2$'


class TestExtractScriptedTriggerSymbols:
    """Test extracting symbols from scripted triggers."""
    
    def test_extract_trigger_without_parameters(self):
        """Test extracting trigger without parameters."""
        trigger_node = {
            'name': 'my_trigger',
            'start_line': 0,
            'start_char': 0,
            'end_line': 5,
            'end_char': 0,
            'parameters': []
        }
        symbol = extract_scripted_trigger_symbols(trigger_node)
        assert symbol.name == 'my_trigger'
        assert len(symbol.children) == 0
    
    def test_extract_trigger_with_parameters(self):
        """Test extracting trigger with parameters."""
        trigger_node = {
            'name': 'my_trigger',
            'start_line': 0,
            'start_char': 0,
            'end_line': 5,
            'end_char': 0,
            'parameters': ['CONDITION']
        }
        symbol = extract_scripted_trigger_symbols(trigger_node)
        assert len(symbol.children) == 1
        assert symbol.children[0].name == '$CONDITION$'


class TestExtractScriptValueSymbols:
    """Test extracting symbols from script values."""
    
    def test_extract_fixed_value(self):
        """Test extracting fixed script value."""
        value_node = {
            'name': 'my_value',
            'type': 'fixed',
            'start_line': 0,
            'start_char': 0,
            'end_line': 1,
            'end_char': 0
        }
        symbol = extract_script_value_symbols(value_node)
        assert symbol.name == 'my_value'
        assert 'fixed' in symbol.detail
    
    def test_extract_formula_value(self):
        """Test extracting formula script value."""
        value_node = {
            'name': 'my_formula',
            'type': 'formula',
            'start_line': 0,
            'start_char': 0,
            'end_line': 5,
            'end_char': 0
        }
        symbol = extract_script_value_symbols(value_node)
        assert 'formula' in symbol.detail


class TestExtractOnActionSymbols:
    """Test extracting symbols from on_actions."""
    
    def test_extract_on_action_no_events(self):
        """Test extracting on_action without events."""
        on_action_node = {
            'name': 'on_birth',
            'start_line': 0,
            'start_char': 0,
            'end_line': 5,
            'end_char': 0,
            'events': []
        }
        symbol = extract_on_action_symbols(on_action_node)
        assert symbol.name == 'on_birth'
        assert symbol.detail is None
    
    def test_extract_on_action_with_events(self):
        """Test extracting on_action with events."""
        on_action_node = {
            'name': 'on_death',
            'start_line': 0,
            'start_char': 0,
            'end_line': 10,
            'end_char': 0,
            'events': ['event1', 'event2', 'event3']
        }
        symbol = extract_on_action_symbols(on_action_node)
        assert '3 event(s)' in symbol.detail


class TestExtractDocumentSymbols:
    """Test extracting all symbols from a document."""
    
    def test_extract_empty_document(self):
        """Test extracting from empty document."""
        parsed_doc = {}
        symbols = extract_document_symbols(parsed_doc)
        assert len(symbols) == 0
    
    def test_extract_document_with_events(self):
        """Test extracting document with events."""
        parsed_doc = {
            'events': [
                {
                    'id': 'test.0001',
                    'type': 'character_event',
                    'start_line': 0,
                    'start_char': 0,
                    'end_line': 10,
                    'end_char': 0
                },
                {
                    'id': 'test.0002',
                    'type': 'letter_event',
                    'start_line': 11,
                    'start_char': 0,
                    'end_line': 20,
                    'end_char': 0
                }
            ]
        }
        symbols = extract_document_symbols(parsed_doc)
        assert len(symbols) == 2
        assert symbols[0].name == 'test.0001'
        assert symbols[1].name == 'test.0002'
    
    def test_extract_document_with_mixed_constructs(self):
        """Test extracting document with multiple construct types."""
        parsed_doc = {
            'events': [
                {
                    'id': 'test.0001',
                    'type': 'character_event',
                    'start_line': 0,
                    'start_char': 0,
                    'end_line': 10,
                    'end_char': 0
                }
            ],
            'scripted_effects': [
                {
                    'name': 'my_effect',
                    'start_line': 11,
                    'start_char': 0,
                    'end_line': 15,
                    'end_char': 0,
                    'parameters': []
                }
            ],
            'script_values': [
                {
                    'name': 'my_value',
                    'type': 'fixed',
                    'start_line': 16,
                    'start_char': 0,
                    'end_line': 17,
                    'end_char': 0
                }
            ]
        }
        symbols = extract_document_symbols(parsed_doc)
        assert len(symbols) == 3


class TestConvertToLspDocumentSymbol:
    """Test converting to LSP DocumentSymbol format."""
    
    def test_convert_simple_symbol(self):
        """Test converting simple symbol."""
        symbol = create_document_symbol('test', 'event', 0, 0, 10, 0)
        lsp_symbol = convert_to_lsp_document_symbol(symbol)
        assert isinstance(lsp_symbol, types.DocumentSymbol)
        assert lsp_symbol.name == 'test'
        assert lsp_symbol.kind == types.SymbolKind.Event
    
    def test_convert_symbol_with_children(self):
        """Test converting symbol with children."""
        parent = create_document_symbol('parent', 'event', 0, 0, 10, 0)
        child = create_document_symbol('child', 'trigger', 1, 4, 3, 4)
        parent.children.append(child)
        
        lsp_symbol = convert_to_lsp_document_symbol(parent)
        assert lsp_symbol.children is not None
        assert len(lsp_symbol.children) == 1
        assert lsp_symbol.children[0].name == 'child'


class TestFindSymbolsByName:
    """Test finding symbols by name."""
    
    def test_find_exact_match(self):
        """Test finding exact match."""
        symbols = [
            create_document_symbol('test_event', 'event', 0, 0, 10, 0),
            create_document_symbol('my_effect', 'scripted_effect', 11, 0, 15, 0)
        ]
        results = find_symbols_by_name(symbols, 'test_event')
        assert len(results) == 1
        assert results[0].name == 'test_event'
    
    def test_find_partial_match(self):
        """Test finding partial match."""
        symbols = [
            create_document_symbol('test_event_1', 'event', 0, 0, 10, 0),
            create_document_symbol('test_event_2', 'event', 11, 0, 20, 0),
            create_document_symbol('my_effect', 'scripted_effect', 21, 0, 25, 0)
        ]
        results = find_symbols_by_name(symbols, 'test')
        assert len(results) == 2
    
    def test_find_case_insensitive(self):
        """Test case-insensitive search."""
        symbols = [
            create_document_symbol('TestEvent', 'event', 0, 0, 10, 0)
        ]
        results = find_symbols_by_name(symbols, 'testevent')
        assert len(results) == 1
    
    def test_find_in_children(self):
        """Test finding in child symbols."""
        parent = create_document_symbol('parent', 'event', 0, 0, 10, 0)
        child = create_document_symbol('test_child', 'trigger', 1, 4, 3, 4)
        parent.children.append(child)
        
        results = find_symbols_by_name([parent], 'test_child')
        assert len(results) == 1
        assert results[0].name == 'test_child'
    
    def test_find_no_match(self):
        """Test finding no match."""
        symbols = [
            create_document_symbol('event1', 'event', 0, 0, 10, 0)
        ]
        results = find_symbols_by_name(symbols, 'nonexistent')
        assert len(results) == 0


class TestGetSymbolHierarchy:
    """Test getting symbol hierarchy."""
    
    def test_simple_hierarchy(self):
        """Test simple hierarchy string."""
        symbol = create_document_symbol('my_event', 'event', 0, 0, 10, 0)
        hierarchy = get_symbol_hierarchy(symbol)
        assert 'my_event' in hierarchy


class TestSymbolsIntegration:
    """Integration tests for symbols module."""
    
    def test_complete_workflow(self):
        """Test complete workflow for document symbols."""
        # Create parsed document
        parsed_doc = {
            'events': [
                {
                    'id': 'test.0001',
                    'type': 'character_event',
                    'start_line': 0,
                    'start_char': 0,
                    'end_line': 15,
                    'end_char': 0,
                    'trigger': {
                        'start_line': 1,
                        'start_char': 4,
                        'end_line': 3,
                        'end_char': 4
                    },
                    'options': [
                        {'name': 'option_a', 'start_line': 10, 'start_char': 4, 'end_line': 12, 'end_char': 4}
                    ]
                }
            ],
            'scripted_effects': [
                {
                    'name': 'my_effect',
                    'start_line': 20,
                    'start_char': 0,
                    'end_line': 25,
                    'end_char': 0,
                    'parameters': ['PARAM1']
                }
            ]
        }
        
        # Extract symbols
        symbols = extract_document_symbols(parsed_doc)
        assert len(symbols) == 2
        
        # Verify event structure
        event_symbol = symbols[0]
        assert event_symbol.name == 'test.0001'
        assert len(event_symbol.children) == 2  # trigger and option
        
        # Verify effect structure
        effect_symbol = symbols[1]
        assert effect_symbol.name == 'my_effect'
        assert len(effect_symbol.children) == 1  # parameter
        
        # Convert to LSP format
        lsp_symbols = [convert_to_lsp_document_symbol(s) for s in symbols]
        assert all(isinstance(s, types.DocumentSymbol) for s in lsp_symbols)
        
        # Search for symbols
        search_results = find_symbols_by_name(symbols, 'my_effect')
        assert len(search_results) == 1
