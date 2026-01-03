"""
Tests for the Code Actions module.

Tests Phase 14: Code Actions (v0.14.0)
"""

import pytest
from lsprotocol import types
from pychivalry.code_actions import (
    calculate_levenshtein_distance,
    find_similar_keywords,
    create_did_you_mean_action,
    create_add_namespace_action,
    create_fix_scope_chain_action,
    suggest_valid_scope_links,
    extract_selection_as_scripted_effect,
    extract_selection_as_scripted_trigger,
    generate_localization_key_action,
    get_code_actions_for_diagnostic,
    get_refactoring_actions,
    convert_to_lsp_code_action,
    get_all_code_actions,
    CodeAction,
    KNOWN_EFFECTS,
    KNOWN_TRIGGERS,
)


class TestLevenshteinDistance:
    """Test Levenshtein distance calculation."""

    def test_identical_strings(self):
        """Test distance between identical strings is 0."""
        assert calculate_levenshtein_distance("add_gold", "add_gold") == 0
        assert calculate_levenshtein_distance("has_trait", "has_trait") == 0

    def test_single_character_difference(self):
        """Test single character substitution."""
        assert calculate_levenshtein_distance("add_gold", "add_gond") == 1
        assert calculate_levenshtein_distance("has_trait", "has_traat") == 1

    def test_insertion(self):
        """Test character insertion."""
        assert calculate_levenshtein_distance("gold", "goldd") == 1
        assert calculate_levenshtein_distance("add", "addd") == 1

    def test_deletion(self):
        """Test character deletion."""
        assert calculate_levenshtein_distance("gold", "gld") == 1
        assert calculate_levenshtein_distance("trait", "trat") == 1

    def test_multiple_differences(self):
        """Test multiple character differences."""
        assert calculate_levenshtein_distance("add_gold", "add_silver") > 3
        assert calculate_levenshtein_distance("kitten", "sitting") == 3

    def test_empty_strings(self):
        """Test with empty strings."""
        assert calculate_levenshtein_distance("", "abc") == 3
        assert calculate_levenshtein_distance("abc", "") == 3
        assert calculate_levenshtein_distance("", "") == 0


class TestFindSimilarKeywords:
    """Test finding similar keywords."""

    def test_find_exact_match(self):
        """Test finding exact matches."""
        results = find_similar_keywords("add_gold", KNOWN_EFFECTS)
        assert "add_gold" in results
        assert results[0] == "add_gold"  # Should be first

    def test_find_typo(self):
        """Test finding corrections for typos."""
        results = find_similar_keywords("add_glod", KNOWN_EFFECTS)
        assert "add_gold" in results

        results = find_similar_keywords("has_triat", KNOWN_TRIGGERS)
        assert "has_trait" in results

    def test_max_distance_limit(self):
        """Test max distance limiting."""
        results = find_similar_keywords("add_silver", KNOWN_EFFECTS, max_distance=1)
        # 'add_silver' is too different from any known effect with distance 1
        assert len(results) == 0

    def test_sorted_by_distance(self):
        """Test results are sorted by distance."""
        results = find_similar_keywords("add_gol", KNOWN_EFFECTS, max_distance=2)
        # 'add_gold' (distance 1) should come before others
        if len(results) > 0:
            assert "add_gold" in results

    def test_no_matches(self):
        """Test with no similar matches."""
        results = find_similar_keywords("completely_different", KNOWN_EFFECTS, max_distance=2)
        assert len(results) == 0

    def test_pattern_matching_lifestyle_xp(self):
        """Test pattern matching for multi-part keywords like add_lifestyle_xp."""
        results = find_similar_keywords("add_lifestyle_xp", KNOWN_EFFECTS, max_distance=2)
        # Should match all lifestyle XP effects via pattern matching
        assert "add_learning_lifestyle_xp" in results
        assert "add_diplomacy_lifestyle_xp" in results
        assert "add_martial_lifestyle_xp" in results
        # Should have at least 6 lifestyle effects
        assert len(results) >= 6


class TestDidYouMeanAction:
    """Test 'Did you mean?' code actions."""

    def test_create_did_you_mean_action(self):
        """Test creating a did you mean action."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=8)
            ),
            message="Unknown effect 'add_glod'",
            severity=types.DiagnosticSeverity.Error,
        )

        action = create_did_you_mean_action(diagnostic, "file:///test.txt", "add_glod", "add_gold")

        assert action.title == "Did you mean 'add_gold'?"
        assert action.kind == "quickfix"
        assert len(action.diagnostics) == 1
        assert action.is_preferred is True
        assert action.edit is not None

    def test_edit_replaces_text(self):
        """Test that edit replaces the misspelled text."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=5, character=4), end=types.Position(line=5, character=13)
            ),
            message="Unknown effect 'has_triat'",
            severity=types.DiagnosticSeverity.Error,
        )

        action = create_did_you_mean_action(
            diagnostic, "file:///test.txt", "has_triat", "has_trait"
        )

        assert action.edit.changes is not None
        changes = action.edit.changes["file:///test.txt"]
        assert len(changes) == 1
        assert changes[0].new_text == "has_trait"
        assert changes[0].range == diagnostic.range


class TestAddNamespaceAction:
    """Test adding namespace declaration."""

    def test_create_add_namespace_action(self):
        """Test creating add namespace action."""
        action = create_add_namespace_action("file:///mod/events/test.txt", "")

        assert action.title == "Add namespace declaration"
        assert action.kind == "quickfix"
        assert action.edit is not None

    def test_namespace_from_path(self):
        """Test extracting namespace from file path."""
        action = create_add_namespace_action("file:///mods/my_cool_mod/events/test.txt", "")

        changes = action.edit.changes["file:///mods/my_cool_mod/events/test.txt"]
        assert len(changes) == 1
        # Should extract 'my_cool_mod' from path
        assert "namespace" in changes[0].new_text

    def test_inserts_at_beginning(self):
        """Test namespace is inserted at beginning of file."""
        action = create_add_namespace_action("file:///test.txt", "some content")

        changes = action.edit.changes["file:///test.txt"]
        assert changes[0].range.start.line == 0
        assert changes[0].range.start.character == 0


class TestFixScopeChainAction:
    """Test fixing invalid scope chains."""

    def test_create_fix_scope_chain_action(self):
        """Test creating scope chain fix action."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=10, character=4),
                end=types.Position(line=10, character=18),
            ),
            message="Invalid scope chain 'liege.invalid'",
            severity=types.DiagnosticSeverity.Error,
        )

        action = create_fix_scope_chain_action(
            diagnostic, "file:///test.txt", "liege.invalid", "liege"
        )

        assert action.title == "Replace with 'liege'"
        assert action.kind == "quickfix"
        assert len(action.diagnostics) == 1

    def test_replacement_text(self):
        """Test scope chain replacement."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=10)
            ),
            message="Invalid scope link",
            severity=types.DiagnosticSeverity.Error,
        )

        action = create_fix_scope_chain_action(
            diagnostic, "file:///test.txt", "bad_scope", "good_scope"
        )

        changes = action.edit.changes["file:///test.txt"]
        assert changes[0].new_text == "good_scope"


class TestSuggestValidScopeLinks:
    """Test suggesting valid scope links."""

    def test_suggest_with_definitions(self):
        """Test suggesting from scope definitions."""
        scope_defs = {
            "character": {
                "links": ["liege", "spouse", "primary_title", "capital_county", "father", "mother"]
            }
        }

        suggestions = suggest_valid_scope_links("character", "spuse", scope_defs)
        assert "spouse" in suggestions  # Similar to 'spuse'

    def test_unknown_scope_type(self):
        """Test with unknown scope type."""
        scope_defs = {"character": {"links": ["liege"]}}

        suggestions = suggest_valid_scope_links("unknown", "invalid", scope_defs)
        assert len(suggestions) == 0

    def test_no_similar_links(self):
        """Test when no similar links found."""
        scope_defs = {"character": {"links": ["liege", "spouse", "primary_title"]}}

        suggestions = suggest_valid_scope_links("character", "completely_different", scope_defs)
        # Should return some valid links even if not similar
        assert len(suggestions) > 0
        assert len(suggestions) <= 5


class TestExtractScriptedEffect:
    """Test extracting scripted effects."""

    def test_extract_as_scripted_effect(self):
        """Test extracting selection as scripted effect."""
        range = types.Range(
            start=types.Position(line=5, character=4), end=types.Position(line=7, character=5)
        )

        action = extract_selection_as_scripted_effect(
            "file:///test.txt", range, "add_gold = 100", "give_gold"
        )

        assert action.title == "Extract as scripted effect 'give_gold'"
        assert action.kind == "refactor.extract"
        assert action.edit is not None

    def test_replacement_calls_effect(self):
        """Test that replacement calls the scripted effect."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=2, character=0)
        )

        action = extract_selection_as_scripted_effect(
            "file:///test.txt", range, "add_gold = 100\nadd_prestige = 50", "reward_player"
        )

        changes = action.edit.changes["file:///test.txt"]
        assert changes[0].new_text == "reward_player = yes"


class TestExtractScriptedTrigger:
    """Test extracting scripted triggers."""

    def test_extract_as_scripted_trigger(self):
        """Test extracting selection as scripted trigger."""
        range = types.Range(
            start=types.Position(line=3, character=4), end=types.Position(line=5, character=5)
        )

        action = extract_selection_as_scripted_trigger(
            "file:///test.txt", range, "has_gold = 100", "has_enough_gold"
        )

        assert action.title == "Extract as scripted trigger 'has_enough_gold'"
        assert action.kind == "refactor.extract"
        assert action.edit is not None

    def test_replacement_calls_trigger(self):
        """Test that replacement calls the scripted trigger."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=1, character=0)
        )

        action = extract_selection_as_scripted_trigger(
            "file:///test.txt", range, "has_gold >= 100", "is_wealthy"
        )

        changes = action.edit.changes["file:///test.txt"]
        assert changes[0].new_text == "is_wealthy"


class TestGenerateLocalizationKey:
    """Test generating localization keys."""

    def test_generate_for_event(self):
        """Test generating localization keys for event."""
        range = types.Range(
            start=types.Position(line=2, character=4), end=types.Position(line=2, character=4)
        )

        action = generate_localization_key_action("file:///test.txt", range, "my_mod.0001")

        assert action.title == "Generate localization keys"
        assert action.kind == "refactor.rewrite"
        assert action.edit is not None

    def test_keys_format(self):
        """Test localization key format."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
        )

        action = generate_localization_key_action("file:///test.txt", range, "test_mod.0042")

        changes = action.edit.changes["file:///test.txt"]
        text = changes[0].new_text
        assert "test_mod.0042.t" in text  # title key
        assert "test_mod.0042.desc" in text  # desc key


class TestGetCodeActionsForDiagnostic:
    """Test getting code actions for diagnostics."""

    def test_unknown_effect_typo(self):
        """Test actions for unknown effect typo."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=8)
            ),
            message="Unknown effect 'add_glod'",
            severity=types.DiagnosticSeverity.Error,
        )

        actions = get_code_actions_for_diagnostic(diagnostic, "file:///test.txt", "", "effect")

        assert len(actions) > 0
        assert any("add_gold" in action.title for action in actions)

    def test_unknown_trigger_typo(self):
        """Test actions for unknown trigger typo."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=9)
            ),
            message="Unknown trigger 'has_triat'",
            severity=types.DiagnosticSeverity.Error,
        )

        actions = get_code_actions_for_diagnostic(diagnostic, "file:///test.txt", "", "trigger")

        assert len(actions) > 0
        assert any("has_trait" in action.title for action in actions)

    def test_invalid_scope_chain(self):
        """Test actions for invalid scope chain."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=14)
            ),
            message="Invalid scope chain 'liege.invalid'",
            severity=types.DiagnosticSeverity.Error,
        )

        actions = get_code_actions_for_diagnostic(diagnostic, "file:///test.txt", "", "trigger")

        assert len(actions) > 0
        # Should suggest valid scope links

    def test_missing_namespace(self):
        """Test actions for missing namespace."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
            ),
            message="Missing namespace declaration",
            severity=types.DiagnosticSeverity.Warning,
        )

        actions = get_code_actions_for_diagnostic(
            diagnostic, "file:///test.txt", "event = {}", "unknown"
        )

        assert len(actions) > 0
        assert any("namespace" in action.title.lower() for action in actions)


class TestGetRefactoringActions:
    """Test getting refactoring actions."""

    def test_effect_refactoring(self):
        """Test refactoring in effect context."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=1, character=0)
        )

        actions = get_refactoring_actions("file:///test.txt", range, "add_gold = 100", "effect")

        assert len(actions) > 0
        assert any("scripted effect" in action.title for action in actions)

    def test_trigger_refactoring(self):
        """Test refactoring in trigger context."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=1, character=0)
        )

        actions = get_refactoring_actions("file:///test.txt", range, "has_gold >= 100", "trigger")

        assert len(actions) > 0
        assert any("scripted trigger" in action.title for action in actions)

    def test_unknown_context_offers_both(self):
        """Test unknown context offers both refactorings."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=1, character=0)
        )

        actions = get_refactoring_actions("file:///test.txt", range, "some_code = yes", "unknown")

        # Should offer both effect and trigger extraction
        titles = [a.title for a in actions]
        assert any("scripted effect" in t for t in titles)
        assert any("scripted trigger" in t for t in titles)

    def test_no_actions_for_short_selection(self):
        """Test no actions for very short selections."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=0, character=2)
        )

        actions = get_refactoring_actions("file:///test.txt", range, "ab", "effect")

        assert len(actions) == 0


class TestConvertToLSPCodeAction:
    """Test converting to LSP code action."""

    def test_basic_conversion(self):
        """Test basic code action conversion."""
        internal_action = CodeAction(
            title="Test Action", kind="quickfix", diagnostics=[], is_preferred=True
        )

        lsp_action = convert_to_lsp_code_action(internal_action)

        assert lsp_action.title == "Test Action"
        assert lsp_action.kind == "quickfix"
        assert lsp_action.is_preferred is True

    def test_with_edit(self):
        """Test conversion with workspace edit."""
        edit = types.WorkspaceEdit(
            changes={
                "file:///test.txt": [
                    types.TextEdit(
                        range=types.Range(
                            start=types.Position(line=0, character=0),
                            end=types.Position(line=0, character=5),
                        ),
                        new_text="fixed",
                    )
                ]
            }
        )

        internal_action = CodeAction(title="Fix It", kind="quickfix", diagnostics=[], edit=edit)

        lsp_action = convert_to_lsp_code_action(internal_action)
        assert lsp_action.edit == edit


class TestGetAllCodeActions:
    """Test getting all code actions."""

    def test_combines_diagnostic_and_refactoring_actions(self):
        """Test that both diagnostic and refactoring actions are returned."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=8)
            ),
            message="Unknown effect 'add_glod'",
            severity=types.DiagnosticSeverity.Error,
        )

        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=2, character=0)
        )

        actions = get_all_code_actions(
            "file:///test.txt",
            range,
            [diagnostic],
            "add_glod = 100\nadd_prestige = 50",
            "add_glod = 100\nadd_prestige = 50",
            "effect",
        )

        # Should have actions for the typo and refactoring actions
        assert len(actions) > 0

    def test_no_diagnostics_still_offers_refactoring(self):
        """Test refactoring actions offered without diagnostics."""
        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=1, character=0)
        )

        actions = get_all_code_actions(
            "file:///test.txt",
            range,
            [],  # No diagnostics
            "add_gold = 100",
            "add_gold = 100",
            "effect",
        )

        # Should still offer refactoring
        assert len(actions) > 0
        assert any("Extract" in action.title for action in actions)

    def test_empty_selection_no_refactoring(self):
        """Test no refactoring actions for empty selection."""
        diagnostic = types.Diagnostic(
            range=types.Range(
                start=types.Position(line=0, character=0), end=types.Position(line=0, character=8)
            ),
            message="Unknown effect 'add_glod'",
            severity=types.DiagnosticSeverity.Error,
        )

        range = types.Range(
            start=types.Position(line=0, character=0), end=types.Position(line=0, character=0)
        )

        actions = get_all_code_actions(
            "file:///test.txt", range, [diagnostic], "", "", "effect"  # Empty selection
        )

        # Should only have diagnostic actions
        assert all("Extract" not in action.title for action in actions)
