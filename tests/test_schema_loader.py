"""
Unit tests for the SchemaLoader module.

Tests schema loading, caching, variable resolution, and diagnostic lookup.
"""

import pytest
from pathlib import Path
from pychivalry.schema_loader import SchemaLoader


class TestSchemaLoader:
    """Test the SchemaLoader class."""

    def test_initialization(self):
        """Test that SchemaLoader initializes with empty caches."""
        loader = SchemaLoader()
        assert loader._schemas == {}
        assert loader._diagnostics == {}
        assert loader._file_type_cache == {}
        assert loader._loaded is False

    def test_load_all(self):
        """Test loading all schemas and diagnostics."""
        loader = SchemaLoader()
        loader.load_all()
        
        assert loader._loaded is True
        # Diagnostics should be loaded
        assert len(loader._diagnostics) > 0
        # At least some diagnostic codes should exist
        assert 'CK3760' in loader._diagnostics
        assert 'STORY-001' in loader._diagnostics

    def test_load_all_idempotent(self):
        """Test that load_all can be called multiple times safely."""
        loader = SchemaLoader()
        loader.load_all()
        first_load_count = len(loader._schemas)
        
        # Call again - should not reload
        loader.load_all()
        assert len(loader._schemas) == first_load_count

    def test_get_diagnostic(self):
        """Test retrieving diagnostic definitions."""
        loader = SchemaLoader()
        loader.load_all()
        
        # Test event diagnostic
        diag = loader.get_diagnostic('CK3760')
        assert diag is not None
        assert diag['severity'] == 'error'
        assert 'type' in diag['message']
        
        # Test story cycle diagnostic
        diag = loader.get_diagnostic('STORY-001')
        assert diag is not None
        assert diag['severity'] == 'error'
        assert 'timing' in diag['message'].lower()

    def test_get_diagnostic_not_found(self):
        """Test retrieving a non-existent diagnostic."""
        loader = SchemaLoader()
        loader.load_all()
        
        diag = loader.get_diagnostic('NONEXISTENT-999')
        assert diag is None

    def test_get_all_diagnostics(self):
        """Test getting all diagnostics at once."""
        loader = SchemaLoader()
        loader.load_all()
        
        diagnostics = loader.get_all_diagnostics()
        assert isinstance(diagnostics, dict)
        assert len(diagnostics) > 0
        assert 'CK3760' in diagnostics
        
        # Should return a copy, not the original
        diagnostics['TEST'] = {}
        assert 'TEST' not in loader._diagnostics

    def test_get_all_schemas(self):
        """Test getting all schemas at once."""
        loader = SchemaLoader()
        loader.load_all()
        
        schemas = loader.get_all_schemas()
        assert isinstance(schemas, dict)
        
        # Should return a copy, not the original
        original_count = len(schemas)
        schemas['test'] = {}
        assert len(loader._schemas) == original_count

    def test_clear_cache(self):
        """Test cache clearing."""
        loader = SchemaLoader()
        loader.load_all()
        
        assert loader._loaded is True
        assert len(loader._diagnostics) > 0
        
        loader.clear_cache()
        
        assert loader._loaded is False
        assert len(loader._schemas) == 0
        assert len(loader._diagnostics) == 0
        assert len(loader._file_type_cache) == 0

    def test_reload(self):
        """Test reloading schemas and diagnostics."""
        loader = SchemaLoader()
        loader.load_all()
        first_diag_count = len(loader._diagnostics)
        
        loader.reload()
        
        assert loader._loaded is True
        assert len(loader._diagnostics) == first_diag_count

    def test_get_schema_for_file_no_match(self):
        """Test getting schema for a file with no matching schema."""
        loader = SchemaLoader()
        loader.load_all()
        
        # This path shouldn't match any schemas
        schema = loader.get_schema_for_file("random/path/file.txt")
        # Could be None or could have a generic schema - depends on implementation
        # Just verify it doesn't crash

    def test_file_type_cache(self):
        """Test that file type lookups are cached."""
        loader = SchemaLoader()
        loader.load_all()
        
        # Create a schema that matches a specific pattern
        test_path = "events/test_event.txt"
        
        # First lookup
        schema1 = loader.get_schema_for_file(test_path)
        
        # Second lookup should use cache
        schema2 = loader.get_schema_for_file(test_path)
        
        # Should be the same object (from cache)
        if schema1 is not None:
            assert schema1 is schema2
            assert test_path in loader._file_type_cache


class TestSchemaVariableResolution:
    """Test variable resolution in schemas."""

    def test_resolve_simple_variable(self):
        """Test resolving a simple $variable reference."""
        loader = SchemaLoader()
        
        schema = {
            'constants': {
                'event_types': ['character_event', 'letter_event']
            },
            'fields': {
                'type': {
                    'values': '$event_types'
                }
            }
        }
        
        loader._resolve_references(schema)
        
        assert schema['fields']['type']['values'] == ['character_event', 'letter_event']

    def test_resolve_nested_variable(self):
        """Test resolving variables in nested structures."""
        loader = SchemaLoader()
        
        schema = {
            'constants': {
                'themes': ['default', 'intrigue', 'diplomacy']
            },
            'nested_schemas': {
                'event': {
                    'fields': {
                        'theme': {
                            'values': '$themes'
                        }
                    }
                }
            }
        }
        
        loader._resolve_references(schema)
        
        assert schema['nested_schemas']['event']['fields']['theme']['values'] == [
            'default', 'intrigue', 'diplomacy'
        ]

    def test_resolve_variable_in_list(self):
        """Test resolving variables within lists."""
        loader = SchemaLoader()
        
        schema = {
            'constants': {
                'required_fields': ['type', 'title']
            },
            'validations': [
                {'check': '$required_fields'}
            ]
        }
        
        loader._resolve_references(schema)
        
        assert schema['validations'][0]['check'] == ['type', 'title']

    def test_no_constants_section(self):
        """Test schema without constants section."""
        loader = SchemaLoader()
        
        schema = {
            'fields': {
                'type': {
                    'values': ['character_event']
                }
            }
        }
        
        # Should not crash
        loader._resolve_references(schema)
        assert schema['fields']['type']['values'] == ['character_event']


class TestSchemaPathMatching:
    """Test file path pattern matching for schema selection."""

    def test_path_normalization(self):
        """Test that paths are normalized for cross-platform matching."""
        loader = SchemaLoader()
        loader.load_all()
        
        # Windows-style path
        schema1 = loader.get_schema_for_file("events\\test.txt")
        
        # Unix-style path
        schema2 = loader.get_schema_for_file("events/test.txt")
        
        # Should match the same schema (or both None)
        assert (schema1 is None) == (schema2 is None)
        if schema1 is not None:
            assert schema1.get('file_type') == schema2.get('file_type')
