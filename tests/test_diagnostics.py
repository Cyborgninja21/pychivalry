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
        ast = parse_document(text)
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
        ast = parse_document(text)
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
        ast = parse_document(text)
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
        ast = parse_document(text)
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
        ast = parse_document(text)
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
        ast = parse_document(text)
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
        ast = parse_document(text)
        index = DocumentIndex()

        diagnostics = collect_all_diagnostics(doc, ast, index)

        # Should have at least the effect-in-trigger error
        errors = [d for d in diagnostics if d.severity == types.DiagnosticSeverity.Error]
        assert len(errors) > 0
