"""
Tests for the data loader module.

This module tests loading of CK3 game definitions from YAML files.
"""

import pytest
from pathlib import Path

from pychivalry.data import (
    load_yaml_file,
    load_all_files_in_directory,
    load_scopes,
    get_scopes,
    get_effects,
    get_triggers,
    get_traits,
    clear_cache,
    DATA_DIR,
)


class TestDataLoader:
    """Tests for basic data loading functions."""

    def test_data_dir_exists(self):
        """Data directory exists."""
        assert DATA_DIR.exists()
        assert DATA_DIR.is_dir()

    def test_scopes_dir_exists(self):
        """Scopes directory exists."""
        scopes_dir = DATA_DIR / "scopes"
        assert scopes_dir.exists()
        assert scopes_dir.is_dir()

    def test_load_character_scope(self):
        """Can load character scope definition."""
        scopes = load_scopes()
        assert "character" in scopes

        char_scope = scopes["character"]
        assert "links" in char_scope
        assert "lists" in char_scope
        assert "triggers" in char_scope
        assert "effects" in char_scope

    def test_character_scope_has_links(self):
        """Character scope has valid links."""
        scopes = load_scopes()
        char_links = scopes["character"]["links"]

        # Check some common links exist
        assert "liege" in char_links
        assert "spouse" in char_links
        assert "father" in char_links
        assert "mother" in char_links
        assert "primary_title" in char_links

    def test_character_scope_has_lists(self):
        """Character scope has valid lists."""
        scopes = load_scopes()
        char_lists = scopes["character"]["lists"]

        # Check some common lists exist
        assert "vassal" in char_lists
        assert "courtier" in char_lists
        assert "child" in char_lists
        assert "prisoner" in char_lists

    def test_character_scope_has_triggers(self):
        """Character scope has valid triggers."""
        scopes = load_scopes()
        char_triggers = scopes["character"]["triggers"]

        # Check some common triggers exist
        assert "is_adult" in char_triggers
        assert "is_alive" in char_triggers
        assert "is_ruler" in char_triggers
        assert "has_trait" in char_triggers
        assert "age" in char_triggers

    def test_character_scope_has_effects(self):
        """Character scope has valid effects."""
        scopes = load_scopes()
        char_effects = scopes["character"]["effects"]

        # Check some common effects exist
        assert "add_trait" in char_effects
        assert "add_gold" in char_effects
        assert "add_prestige" in char_effects
        assert "death" in char_effects

    def test_load_title_scope(self):
        """Can load landed_title scope definition."""
        scopes = load_scopes()

        if "landed_title" in scopes:
            title_scope = scopes["landed_title"]
            assert "links" in title_scope
            assert "holder" in title_scope["links"]
            assert "de_jure_liege" in title_scope["links"]

    def test_load_province_scope(self):
        """Can load province scope definition."""
        scopes = load_scopes()

        if "province" in scopes:
            province_scope = scopes["province"]
            assert "links" in province_scope
            assert "county" in province_scope["links"]
            assert "terrain" in province_scope["triggers"]

    def test_get_scopes_with_cache(self):
        """get_scopes returns cached data."""
        clear_cache()

        # First call loads from files
        scopes1 = get_scopes()
        assert len(scopes1) > 0

        # Second call uses cache
        scopes2 = get_scopes()
        assert scopes1 is scopes2  # Same object (cached)

    def test_get_scopes_without_cache(self):
        """get_scopes can bypass cache."""
        scopes1 = get_scopes(use_cache=False)
        scopes2 = get_scopes(use_cache=False)

        # Different objects (not cached)
        assert scopes1 is not scopes2
        # But same content
        assert scopes1 == scopes2

    def test_clear_cache(self):
        """clear_cache clears all cached data."""
        # Load some data
        get_scopes()
        get_effects()
        get_triggers()
        get_traits()

        # Clear cache
        clear_cache()

        # Next calls will reload from files
        scopes = get_scopes()
        assert scopes is not None


class TestDataLoaderEdgeCases:
    """Tests for error handling and edge cases."""

    def test_load_nonexistent_file(self):
        """Loading nonexistent file raises error."""
        with pytest.raises(FileNotFoundError):
            load_yaml_file(Path("/nonexistent/file.yaml"))

    def test_load_nonexistent_directory(self):
        """Loading from nonexistent directory returns empty dict."""
        result = load_all_files_in_directory(Path("/nonexistent/directory"))
        assert result == {}

    def test_get_effects_empty(self):
        """get_effects returns dict even if no files."""
        effects = get_effects()
        # May be empty if no effect files exist yet
        assert isinstance(effects, dict)

    def test_get_triggers_empty(self):
        """get_triggers returns dict even if no files."""
        triggers = get_triggers()
        # May be empty if no trigger files exist yet
        assert isinstance(triggers, dict)

    def test_get_traits_empty(self):
        """get_traits returns dict even if no files."""
        traits = get_traits()
        # May be empty if no trait files exist yet
        assert isinstance(traits, dict)


class TestDataStructure:
    """Tests for data structure validation."""

    def test_scope_structure(self):
        """Scope definitions have expected structure."""
        scopes = load_scopes()

        for scope_name, scope_data in scopes.items():
            assert isinstance(scope_data, dict), f"{scope_name} should be a dict"

            # Each scope should have these keys (at minimum)
            expected_keys = ["links", "lists", "triggers", "effects"]
            for key in expected_keys:
                if key in scope_data:
                    assert isinstance(scope_data[key], list), f"{scope_name}.{key} should be a list"

    def test_no_duplicate_scope_links(self):
        """Scope links should not have duplicates."""
        scopes = load_scopes()

        for scope_name, scope_data in scopes.items():
            if "links" in scope_data:
                links = scope_data["links"]
                assert len(links) == len(set(links)), f"{scope_name} has duplicate links"

    def test_no_duplicate_scope_lists(self):
        """Scope lists should not have duplicates."""
        scopes = load_scopes()

        for scope_name, scope_data in scopes.items():
            if "lists" in scope_data:
                lists = scope_data["lists"]
                assert len(lists) == len(set(lists)), f"{scope_name} has duplicate lists"


class TestDataIntegration:
    """Integration tests with the full data system."""

    def test_load_all_scope_types(self):
        """Can load multiple scope types."""
        scopes = load_scopes()

        # Should have at least character scope
        assert len(scopes) >= 1
        assert "character" in scopes

    def test_scopes_have_consistent_structure(self):
        """All scopes have consistent structure."""
        scopes = load_scopes()

        for scope_name, scope_data in scopes.items():
            # All scopes should be dicts
            assert isinstance(scope_data, dict)

            # All scopes should have at least some data
            assert len(scope_data) > 0
