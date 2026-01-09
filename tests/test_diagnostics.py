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
