"""
Tests for Enhanced CK3 Localization Hover and Completions

Tests:
- Hover documentation for character functions
- Hover documentation for formatting codes
- Hover documentation for game concepts
- Completions inside brackets [...]
- Completions after # for formatting codes
- Completions after @ for icon references
- Completions inside $variables$
"""

import pytest
from lsprotocol import types
from pychivalry.hover import (
    get_localization_concept_documentation,
    get_localization_variable_documentation,
    get_hover_content,
)
from pychivalry.completions import get_localization_completions


class TestLocalizationHover:
    """Test hover documentation for localization elements."""

    def test_concept_documentation_vassal(self):
        """Test documentation for 'vassal' concept."""
        doc = get_localization_concept_documentation("vassal")
        assert doc is not None
        assert "vassal" in doc.lower()
        assert "liege" in doc.lower()

    def test_concept_documentation_opinion(self):
        """Test documentation for 'opinion' concept."""
        doc = get_localization_concept_documentation("opinion")
        assert doc is not None
        assert "opinion" in doc.lower()

    def test_concept_documentation_unknown(self):
        """Test that unknown concepts return None."""
        doc = get_localization_concept_documentation("unknown_concept_xyz")
        assert doc is None

    def test_variable_documentation_value(self):
        """Test documentation for VALUE variable."""
        doc = get_localization_variable_documentation("VALUE")
        assert doc is not None
        assert "VALUE" in doc
        assert "format" in doc.lower()

    def test_variable_documentation_generic(self):
        """Test documentation for generic variable."""
        doc = get_localization_variable_documentation("CUSTOM_VAR")
        assert doc is not None
        assert "CUSTOM_VAR" in doc

    def test_hover_content_character_function(self):
        """Test hover content for character functions."""
        content = get_hover_content("GetShortUIName", None, None)
        assert content is not None
        assert "GetShortUIName" in content
        assert "Character Function" in content

    def test_hover_content_formatting_code(self):
        """Test hover content for formatting codes."""
        content = get_hover_content("#bold", None, None)
        assert content is not None
        assert "#bold" in content
        assert "Formatting Code" in content

    def test_hover_content_game_concept(self):
        """Test hover content for game concepts."""
        content = get_hover_content("vassal", None, None)
        assert content is not None
        assert "vassal" in content.lower()
        assert "Game Concept" in content


class TestLocalizationCompletions:
    """Test completions for localization syntax."""

    def test_completions_inside_brackets_with_dot(self):
        """Test completions after scope.dot inside brackets."""
        line = " key:0 \"[CHARACTER."
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is not None
        assert len(completions) > 0

        # Should include character functions
        labels = [c.label for c in completions]
        assert "GetName" in labels
        assert "GetShortUIName" in labels

    def test_completions_inside_brackets_no_dot(self):
        """Test completions inside brackets before dot."""
        line = " key:0 \"["
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is not None
        assert len(completions) > 0

        # Should include scopes and concepts
        labels = [c.label for c in completions]
        # Check for some scopes
        assert any("CHARACTER" in label or "ROOT" in label for label in labels)
        # Check for some concepts
        assert any("|E" in label for label in labels)

    def test_completions_after_hash(self):
        """Test completions after # for formatting codes."""
        line = " key:0 \"some text #"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is not None
        assert len(completions) > 0

        # Should include formatting codes (without #)
        labels = [c.label for c in completions]
        assert "bold" in labels
        assert "italic" in labels
        assert "N" in labels  # Newline

    def test_completions_after_at(self):
        """Test completions after @ for icon references."""
        line = " key:0 \"You gain @"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is not None
        assert len(completions) > 0

        # Should include icon references (without @ and !)
        labels = [c.label for c in completions]
        assert "gold_icon" in labels
        assert "prestige_icon" in labels

    def test_completions_inside_variable(self):
        """Test completions inside $variable$."""
        line = " key:0 \"text $"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is not None
        assert len(completions) > 0

        # Should include common variables
        labels = [c.label for c in completions]
        assert "VALUE" in labels
        assert "SIZE" in labels

    def test_completions_inside_variable_format_specifier(self):
        """Test completions for format specifiers inside variable."""
        line = " key:0 \"text $VALUE|"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is not None
        assert len(completions) > 0

        # Should include format specifiers
        labels = [c.label for c in completions]
        assert "+" in labels
        assert "-" in labels
        assert "V0" in labels

    def test_no_completions_outside_context(self):
        """Test that no completions are offered outside special contexts."""
        line = " key:0 \"normal text"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        # Should return None when not in a special context
        assert completions is None

    def test_completions_closed_bracket(self):
        """Test that no completions after closed bracket."""
        line = " key:0 \"[CHARACTER.GetName]"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is None

    def test_completions_closed_variable(self):
        """Test that no completions after closed variable."""
        line = " key:0 \"$VALUE$"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)

        assert completions is None


class TestLocalizationIntegration:
    """Test integration of hover and completions."""

    def test_character_function_hover_and_completion(self):
        """Test that functions appear in both hover and completions."""
        # Test hover
        hover = get_hover_content("GetShortUINameNoTooltip", None, None)
        assert hover is not None

        # Test completion
        line = " key:0 \"[CHARACTER."
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)
        assert completions is not None
        labels = [c.label for c in completions]
        assert "GetShortUINameNoTooltip" in labels

    def test_formatting_code_hover_and_completion(self):
        """Test that formatting codes appear in both hover and completions."""
        # Test hover
        hover = get_hover_content("#color_blue", None, None)
        assert hover is not None

        # Test completion
        line = " key:0 \"text #"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)
        assert completions is not None
        labels = [c.label for c in completions]
        # The # is already typed, so we get "color_blue" without #
        assert "color_blue" in labels

    def test_complex_localization_line(self):
        """Test completions work correctly in complex lines."""
        # Test at different positions in a complex line
        base_line = " key:0 \"[CHARACTER.GetName] has $VALUE|+$ @gold_icon! and #bold won#!"

        # Position after [CHARACTER.
        line = " key:0 \"[CHARACTER."
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)
        assert completions is not None
        assert len(completions) > 0

        # Position after $VALUE|
        line = " key:0 \"text $VALUE|"
        position = types.Position(line=0, character=len(line))
        completions = get_localization_completions(line, position)
        assert completions is not None
        labels = [c.label for c in completions]
        assert "+" in labels


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
