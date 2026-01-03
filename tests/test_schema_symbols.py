"""
Unit tests for schema-driven symbol extraction.
"""

import pytest
from lsprotocol import types
from pychivalry.schema_symbols import SchemaSymbolExtractor, get_schema_symbols
from pychivalry.schema_loader import SchemaLoader


class MockNode:
    """Mock AST node for testing."""
    def __init__(self, key, value=None, children=None, line=0, char=0):
        self.key = key
        self.value = value
        self.children = children or []
        self.range = types.Range(
            start=types.Position(line=line, character=char),
            end=types.Position(line=line + 1, character=0)
        )


class MockSchemaLoader:
    """Mock schema loader for testing."""
    def __init__(self, schema):
        self.schema = schema
        
    def get_schema_for_file(self, file_path):
        return self.schema


def test_extract_symbols_no_schema():
    """Test symbol extraction when no schema is available."""
    loader = MockSchemaLoader(None)
    extractor = SchemaSymbolExtractor(loader)
    
    ast = [MockNode("test.0001")]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert symbols == []


def test_extract_symbols_no_symbols_config():
    """Test symbol extraction when schema has no symbols section."""
    schema = {
        'file_type': 'test',
        'identification': {'path_patterns': ['*.txt']}
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    ast = [MockNode("test.0001")]
    symbols = extractor.extract_symbols("test.txt", ast)
    
    assert symbols == []


def test_extract_primary_symbol():
    """Test extraction of primary symbol."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key',
                'detail': 'Event'
            }
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    ast = [MockNode("test.0001")]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 1
    assert symbols[0].name == "test.0001"
    assert symbols[0].kind == types.SymbolKind.Event
    assert symbols[0].detail == "Event"


def test_extract_symbol_with_detail_from():
    """Test extraction of symbol with detail_from field."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key',
                'detail_from': 'type'
            }
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    type_node = MockNode("type", "character_event")
    ast = [MockNode("test.0001", children=[type_node])]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 1
    assert symbols[0].detail == "character_event"


def test_extract_symbol_with_children():
    """Test extraction of symbol with children."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key'
            },
            'children': [
                {
                    'field': 'option',
                    'kind': 'EnumMember',
                    'name_from': 'name',
                    'fallback_name': '(unnamed option)'
                }
            ]
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    option_node = MockNode("option", children=[MockNode("name", "test.0001.a")])
    ast = [MockNode("test.0001", children=[option_node])]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 1
    assert len(symbols[0].children) == 1
    assert symbols[0].children[0].name == "test.0001.a"
    assert symbols[0].children[0].kind == types.SymbolKind.EnumMember


def test_extract_child_with_fallback_name():
    """Test extraction of child symbol with fallback name."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key'
            },
            'children': [
                {
                    'field': 'option',
                    'kind': 'EnumMember',
                    'name_from': 'name',
                    'fallback_name': '(unnamed option)'
                }
            ]
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    # Option without name
    option_node = MockNode("option")
    ast = [MockNode("test.0001", children=[option_node])]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 1
    assert len(symbols[0].children) == 1
    assert symbols[0].children[0].name == "(unnamed option)"


def test_extract_child_with_static_name():
    """Test extraction of child symbol with static name."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key'
            },
            'children': [
                {
                    'field': 'immediate',
                    'kind': 'Function',
                    'name': 'immediate'
                }
            ]
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    immediate_node = MockNode("immediate")
    ast = [MockNode("test.0001", children=[immediate_node])]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 1
    assert len(symbols[0].children) == 1
    assert symbols[0].children[0].name == "immediate"
    assert symbols[0].children[0].kind == types.SymbolKind.Function


def test_extract_child_with_name_pattern():
    """Test extraction of child symbol with name pattern."""
    schema = {
        'file_type': 'story_cycle',
        'identification': {
            'path_patterns': ['common/story_cycles/*.txt']
        },
        'symbols': {
            'primary': {
                'kind': 'Class',
                'name_from': 'key'
            },
            'children': [
                {
                    'field': 'effect_group',
                    'kind': 'Method',
                    'name_pattern': 'effect_group_{index}'
                }
            ]
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    eg1 = MockNode("effect_group")
    eg2 = MockNode("effect_group")
    ast = [MockNode("test_story", children=[eg1, eg2])]
    symbols = extractor.extract_symbols("common/story_cycles/test.txt", ast)
    
    assert len(symbols) == 1
    assert len(symbols[0].children) == 2
    assert symbols[0].children[0].name == "effect_group_1"
    assert symbols[0].children[1].name == "effect_group_2"


def test_extract_multiple_blocks():
    """Test extraction of multiple top-level blocks."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key'
            }
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    ast = [
        MockNode("test.0001"),
        MockNode("test.0002"),
        MockNode("test.0003")
    ]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 3
    assert symbols[0].name == "test.0001"
    assert symbols[1].name == "test.0002"
    assert symbols[2].name == "test.0003"


def test_get_schema_symbols_convenience():
    """Test the convenience function."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key'
            }
        }
    }
    loader = MockSchemaLoader(schema)
    
    ast = [MockNode("test.0001")]
    symbols = get_schema_symbols("events/test.txt", ast, loader)
    
    assert len(symbols) == 1
    assert symbols[0].name == "test.0001"


def test_block_pattern_filtering():
    """Test that blocks not matching pattern are filtered out."""
    schema = {
        'file_type': 'event',
        'identification': {
            'path_patterns': ['events/*.txt'],
            'block_pattern': r'^[a-z_]+\.\d+$'  # Only matches namespace.number
        },
        'symbols': {
            'primary': {
                'kind': 'Event',
                'name_from': 'key'
            }
        }
    }
    loader = MockSchemaLoader(schema)
    extractor = SchemaSymbolExtractor(loader)
    
    ast = [
        MockNode("test.0001"),  # Matches
        MockNode("namespace"),  # Doesn't match
        MockNode("test.0002")   # Matches
    ]
    symbols = extractor.extract_symbols("events/test.txt", ast)
    
    assert len(symbols) == 2
    assert symbols[0].name == "test.0001"
    assert symbols[1].name == "test.0002"
