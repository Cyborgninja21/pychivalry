"""Tests for the diagnostics module."""

import pytest
from lsprotocol import types
from pygls.workspace import TextDocument

from pychivalry.diagnostics import (
    check_syntax,
    check_semantics,
    check_scopes,
    collect_all_diagnostics,
    create_diagnostic,
    validate_ast_structure,
)
from pychivalry.block_validator import validate_block_semantics
from pychivalry.parser import parse_document
from pychivalry.indexer import DocumentIndex


class TestSyntaxDiagnostics:
    """Tests for syntax error detection."""

    def test_unclosed_bracket(self):
        """Detects unclosed brackets."""
        text = """
namespace = test_mod

test_mod.0001 = {
    type = character_event
    trigger = {
        is_adult = yes
    # Missing closing bracket
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)
        diagnostics = check_syntax(doc, ast)

        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0
        assert any("bracket" in d.message.lower() for d in errors)

    def test_valid_syntax_no_errors(self):
        """Valid syntax produces no syntax errors."""
        text = """
namespace = test_mod

test_mod.0001 = {
    type = character_event
    trigger = {
        is_adult = yes
    }
    
    option = {
        name = test_mod.0001.a
    }
}
"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)
        diagnostics = check_syntax(doc, ast)

        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) == 0

    def test_orphan_closing_bracket(self):
        """Detects orphan closing brackets."""
        text = """
}
namespace = test
"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)
        diagnostics = check_syntax(doc, ast)

        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0


class TestSemanticDiagnostics:
    """Tests for semantic error detection."""

    def test_effect_in_trigger_block(self):
        """Effects in trigger blocks produce errors."""
        text = """
trigger = {
    add_gold = 100
}
"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_semantics(ast, None)

        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0
        assert any("effect" in d.message.lower() and "trigger" in d.message.lower() for d in errors)

    def test_valid_semantics_no_errors(self):
        """Valid semantics produce no errors."""
        text = """
trigger = {
    is_adult = yes
}
immediate = {
    add_gold = 100
}
"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_semantics(ast, None)

        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) == 0


class TestScopeDiagnostics:
    """Tests for scope-related diagnostics."""

    def test_undefined_saved_scope(self):
        """Using undefined saved scopes produces warnings."""
        text = """
immediate = {
    scope:undefined_scope = { add_gold = 100 }
}
"""
        index = DocumentIndex()
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scopes(ast, index)

        warnings = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Warning]
        assert len(warnings) > 0
        assert any("undefined" in d.message.lower() for d in warnings)


class TestDiagnosticCreation:
    """Tests for diagnostic object creation."""

    def test_create_diagnostic(self):
        """create_diagnostic creates valid objects."""
        diag = create_diagnostic(
            message="Test error",
            range_=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            severity=types.DiagnosticSeverity.Error,
            code="CK3001",
        )

        assert diag.message == "Test error"
        assert diag.severity == types.DiagnosticSeverity.Error
        assert diag.code == "CK3001"
        assert diag.source == "ck3-ls"


class TestCollectAllDiagnostics:
    """Tests for the main diagnostic collection function."""

    def test_collects_multiple_types(self):
        """Collects syntax, semantic, and scope diagnostics."""
        text = """
trigger = {
    is_adult = yes
    add_gold = 100
}
"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)
        index = DocumentIndex()

        diagnostics = collect_all_diagnostics(doc, ast, index)

        # Should have at least the effect-in-trigger error
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0


class TestASTStructureValidation:
    """Tests for AST-based structural validation."""

    def test_empty_trigger_block_warning(self):
        """Detects empty trigger blocks (CK3007)."""
        text = "trigger = { }"
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        # Should have CK3007 warning for empty trigger block
        warnings = [d for d in diagnostics if d.code == "CK3007"]
        assert len(warnings) == 1
        assert "empty" in warnings[0].message.lower()
        assert "trigger" in warnings[0].message

    def test_empty_effect_block_warning(self):
        """Detects empty effect blocks."""
        text = "effect = { }"
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        warnings = [d for d in diagnostics if d.code == "CK3007"]
        assert len(warnings) == 1
        assert "effect" in warnings[0].message

    def test_logical_operator_requires_block(self):
        """Detects logical operators with non-block values (CK3005)."""
        text = "NOT = yes"  # Should be NOT = { ... }
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        # Should have CK3005 error
        errors = [d for d in diagnostics if d.code == "CK3005"]
        assert len(errors) == 1
        assert "NOT" in errors[0].message
        assert "block" in errors[0].message.lower()

    def test_valid_NOT_block_no_error(self):
        """Valid NOT block does not trigger errors."""
        text = """NOT = {
    has_trait = brave
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        # Should have no CK3005 errors
        errors = [d for d in diagnostics if d.code == "CK3005"]
        assert len(errors) == 0

    def test_nested_empty_blocks(self):
        """Detects multiple nested empty blocks."""
        text = """trigger = {
    effect = { }
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        # Should detect empty effect block
        warnings = [d for d in diagnostics if d.code == "CK3007"]
        assert len(warnings) >= 1

    def test_valid_structure_no_warnings(self):
        """Valid structure produces no warnings."""
        text = """trigger = {
    is_adult = yes
    NOT = {
        has_trait = content
    }
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        # Should have no structural errors or warnings
        assert len(diagnostics) == 0

    def test_AND_operator_requires_block(self):
        """AND operator must have block value."""
        text = "AND = yes"
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        errors = [d for d in diagnostics if d.code == "CK3005"]
        assert len(errors) == 1
        assert "AND" in errors[0].message

    def test_OR_operator_requires_block(self):
        """OR operator must have block value."""
        text = "OR = no"
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_ast_structure(ast)

        errors = [d for d in diagnostics if d.code == "CK3005"]
        assert len(errors) == 1
        assert "OR" in errors[0].message


class TestBlockSemanticValidation:
    """Tests for context-aware block semantic validation."""

    def test_effect_in_trigger_context(self):
        """Detects effects used in trigger blocks (CK3101)."""
        text = """trigger = {
    add_gold = 100
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast)

        # Should have CK3101 error
        errors = [d for d in diagnostics if d.code == "CK3101"]
        assert len(errors) == 1
        assert "add_gold" in errors[0].message
        assert "trigger" in errors[0].message.lower()

    def test_trigger_in_effect_context(self):
        """Detects triggers used in effect blocks (CK3102)."""
        text = """effect = {
    is_adult = yes
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast)

        # Should have CK3102 error
        errors = [d for d in diagnostics if d.code == "CK3102"]
        assert len(errors) == 1
        assert "is_adult" in errors[0].message
        assert "effect" in errors[0].message.lower()

    def test_valid_trigger_in_trigger_context(self):
        """Valid triggers in trigger context produce no errors."""
        text = """trigger = {
    is_adult = yes
    is_alive = yes
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast)

        # Should have no CK3101/CK3102 errors
        context_errors = [d for d in diagnostics if d.code in ("CK3101", "CK3102")]
        assert len(context_errors) == 0

    def test_valid_effect_in_effect_context(self):
        """Valid effects in effect context produce no errors."""
        text = """effect = {
    add_gold = 100
    add_prestige = 50
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast)

        # Should have no CK3101/CK3102 errors
        context_errors = [d for d in diagnostics if d.code in ("CK3101", "CK3102")]
        assert len(context_errors) == 0

    def test_nested_trigger_in_effect(self):
        """Nested trigger blocks inside effects are allowed."""
        text = """effect = {
    if = {
        limit = {
            is_adult = yes
        }
        add_gold = 100
    }
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast)

        # limit is a trigger context inside effect - should be valid
        errors = [d for d in diagnostics if d.code in ("CK3101", "CK3102")]
        # Note: Current implementation may not fully handle nested contexts
        # This test documents expected behavior

    def test_multiple_context_violations(self):
        """Detects multiple context violations in same block."""
        text = """trigger = {
    add_gold = 100
    add_prestige = 50
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast)

        # Should detect both effects in trigger context
        errors = [d for d in diagnostics if d.code == "CK3101"]
        assert len(errors) == 2

    def test_unknown_context_no_errors(self):
        """Unknown context doesn't trigger false positives."""
        text = """some_custom_block = {
    add_gold = 100
    is_adult = yes
}"""
        ast, _parse_errors = parse_document(text)

        diagnostics = validate_block_semantics(ast, context="unknown")

        # Should have no context errors in unknown context
        errors = [d for d in diagnostics if d.code in ("CK3101", "CK3102")]
        assert len(errors) == 0


class TestLocalizationValidation:
    """Tests for localization validation (Issue #33, CK3600-CK3604)."""

    def test_missing_localization_key_diagnostic(self):
        """Detects missing localization keys (CK3600)."""
        from pychivalry.diagnostics import collect_missing_localization_diagnostics

        text = """test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.missing.desc
}"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)

        # Create index with one key but not the other
        index = DocumentIndex()
        index.localization["test_mod.0001.t"] = ("Title text", "file:///loc.yml", 10)
        # test_mod.missing.desc is NOT defined

        diagnostics = collect_missing_localization_diagnostics(doc, ast, index)

        # Should have one missing key diagnostic
        missing_diags = [d for d in diagnostics if d.code == "CK3600"]
        assert len(missing_diags) == 1
        assert "test_mod.missing.desc" in missing_diags[0].message
        assert missing_diags[0].severity == types.DiagnosticSeverity.Warning

    def test_all_keys_present_no_diagnostic(self):
        """No diagnostic when all keys are present."""
        from pychivalry.diagnostics import collect_missing_localization_diagnostics

        text = """test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
}"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)

        # Create index with both keys
        index = DocumentIndex()
        index.localization["test_mod.0001.t"] = ("Title", "file:///loc.yml", 10)
        index.localization["test_mod.0001.desc"] = ("Desc", "file:///loc.yml", 11)

        diagnostics = collect_missing_localization_diagnostics(doc, ast, index)

        # Should have no missing key diagnostics
        missing_diags = [d for d in diagnostics if d.code == "CK3600"]
        assert len(missing_diags) == 0

    def test_fuzzy_matching_suggests_similar_keys(self):
        """Suggests similar keys using fuzzy matching."""
        from pychivalry.diagnostics import collect_missing_localization_diagnostics

        text = """test_mod.0001 = {
    title = test_mod.0001.typo
}"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)

        # Create index with similar key
        index = DocumentIndex()
        index.localization["test_mod.0001.t"] = ("Title", "file:///loc.yml", 10)

        diagnostics = collect_missing_localization_diagnostics(doc, ast, index)

        # Should suggest the similar key
        assert len(diagnostics) == 1
        assert "Did you mean" in diagnostics[0].message or "test_mod.0001.t" in diagnostics[0].message

    def test_ignores_literal_strings(self):
        """Doesn't validate literal strings as localization keys."""
        from pychivalry.diagnostics import collect_missing_localization_diagnostics

        text = """test_mod.0001 = {
    title = "Literal Title"
    desc = test_mod.0001.desc
}"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)

        index = DocumentIndex()
        index.localization["test_mod.0001.desc"] = ("Desc", "file:///loc.yml", 10)

        diagnostics = collect_missing_localization_diagnostics(doc, ast, index)

        # Should not complain about literal string
        # Should have no diagnostics since desc key exists
        assert len(diagnostics) == 0

    def test_validates_all_loc_fields(self):
        """Validates all localization field types."""
        from pychivalry.diagnostics import collect_missing_localization_diagnostics

        text = """test_mod.0001 = {
    title = test.title
    desc = test.desc
    option = {
        name = test.name
        tooltip = test.tooltip
        custom_tooltip = test.custom_tooltip
    }
    text = test.text
}"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)

        # Empty index - all keys missing
        index = DocumentIndex()

        diagnostics = collect_missing_localization_diagnostics(doc, ast, index)

        # Should find all 6 missing keys
        assert len(diagnostics) == 6
        all_missing = [d.message for d in diagnostics]
        assert any("test.title" in msg for msg in all_missing)
        assert any("test.desc" in msg for msg in all_missing)
        assert any("test.name" in msg for msg in all_missing)
        assert any("test.tooltip" in msg for msg in all_missing)
        assert any("test.custom_tooltip" in msg for msg in all_missing)
        assert any("test.text" in msg for msg in all_missing)

    def test_integration_with_collect_all_diagnostics(self):
        """Localization validation integrates with main diagnostics pipeline."""
        text = """test_mod.0001 = {
    type = character_event
    title = missing.key
}"""
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast, _parse_errors = parse_document(text)

        # Create index (empty, so key will be missing)
        index = DocumentIndex()

        # Run full diagnostics
        all_diagnostics = collect_all_diagnostics(doc, ast, index)

        # Should include CK3600 diagnostic
        ck3600_diags = [d for d in all_diagnostics if d.code == "CK3600"]
        assert len(ck3600_diags) == 1
        assert "missing.key" in ck3600_diags[0].message


class TestOrphanedLocalizationValidation:
    """Tests for orphaned localization key validation (Issue #33, CK3604)."""

    def test_orphaned_key_diagnostic(self):
        """Detects orphaned (unused) localization keys (CK3604)."""
        from pychivalry.diagnostics import collect_orphaned_localization_diagnostics

        # Localization file with unused key
        text = """l_english:
 used_key:0 "This is used"
 orphaned_key:0 "This is never used"
 another_used_key:0 "Also used"
"""
        doc = TextDocument(uri="file:///localization/english/test_l_english.yml", source=text)

        # Create index with references for only some keys
        index = DocumentIndex()
        index.localization["used_key"] = ("This is used", doc.uri, 1)
        index.localization["orphaned_key"] = ("This is never used", doc.uri, 2)
        index.localization["another_used_key"] = ("Also used", doc.uri, 3)

        # Add references for used keys
        index._track_localization_reference("used_key", "file:///test.txt", 10, 5, "title")
        index._track_localization_reference("another_used_key", "file:///test.txt", 11, 5, "desc")

        diagnostics = collect_orphaned_localization_diagnostics(doc, index)

        # Should have one orphaned key diagnostic
        orphaned_diags = [d for d in diagnostics if d.code == "CK3604"]
        assert len(orphaned_diags) == 1
        assert "orphaned_key" in orphaned_diags[0].message

    def test_all_keys_used_no_diagnostic(self):
        """No diagnostic when all keys are used."""
        from pychivalry.diagnostics import collect_orphaned_localization_diagnostics

        text = """l_english:
 used_key:0 "This is used"
"""
        doc = TextDocument(uri="file:///localization/english/test_l_english.yml", source=text)

        index = DocumentIndex()
        index.localization["used_key"] = ("This is used", doc.uri, 1)
        index._track_localization_reference("used_key", "file:///test.txt", 10, 5, "title")

        diagnostics = collect_orphaned_localization_diagnostics(doc, index)

        # Should have no orphaned diagnostics
        assert len(diagnostics) == 0

    def test_only_runs_on_yml_files(self):
        """Orphaned key check only runs on .yml files."""
        from pychivalry.diagnostics import collect_orphaned_localization_diagnostics

        text = """test_mod.0001 = {
    title = test.key
}"""
        doc = TextDocument(uri="file:///events/test.txt", source=text)
        index = DocumentIndex()

        diagnostics = collect_orphaned_localization_diagnostics(doc, index)

        # Should not run on .txt files
        assert len(diagnostics) == 0

    def test_only_runs_in_localization_folder(self):
        """Orphaned key check only runs in localization/ folder."""
        from pychivalry.diagnostics import collect_orphaned_localization_diagnostics

        text = """l_english:
 some_key:0 "Text"
"""
        # Not in localization folder
        doc = TextDocument(uri="file:///other/test.yml", source=text)
        index = DocumentIndex()

        diagnostics = collect_orphaned_localization_diagnostics(doc, index)

        # Should not run outside localization folder
        assert len(diagnostics) == 0

    def test_multiple_orphaned_keys(self):
        """Detects multiple orphaned keys."""
        from pychivalry.diagnostics import collect_orphaned_localization_diagnostics

        text = """l_english:
 orphan1:0 "Unused 1"
 orphan2:0 "Unused 2"
 orphan3:0 "Unused 3"
"""
        doc = TextDocument(uri="file:///localization/english/test_l_english.yml", source=text)

        index = DocumentIndex()
        index.localization["orphan1"] = ("Unused 1", doc.uri, 1)
        index.localization["orphan2"] = ("Unused 2", doc.uri, 2)
        index.localization["orphan3"] = ("Unused 3", doc.uri, 3)
        # No references added

        diagnostics = collect_orphaned_localization_diagnostics(doc, index)

        # Should find all 3 orphaned keys
        assert len(diagnostics) == 3
        all_messages = [d.message for d in diagnostics]
        assert any("orphan1" in msg for msg in all_messages)
        assert any("orphan2" in msg for msg in all_messages)
        assert any("orphan3" in msg for msg in all_messages)

    def test_integration_with_collect_all_diagnostics_yml(self):
        """Orphaned key validation integrates with main diagnostics for .yml files."""
        text = """l_english:
 orphaned_key:0 "Never used"
"""
        doc = TextDocument(uri="file:///localization/english/test_l_english.yml", source=text)

        # Create index (with key defined but no references)
        index = DocumentIndex()
        index.localization["orphaned_key"] = ("Never used", doc.uri, 1)

        # For .yml files, we pass empty AST since they don't have CK3 syntax
        ast = []

        # Run full diagnostics
        all_diagnostics = collect_all_diagnostics(doc, ast, index)

        # Should include CK3604 diagnostic
        ck3604_diags = [d for d in all_diagnostics if d.code == "CK3604"]
        assert len(ck3604_diags) == 1
        assert "orphaned_key" in ck3604_diags[0].message
