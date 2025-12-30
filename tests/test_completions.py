"""
Tests for CK3 language completion features
"""

from pychivalry.server import completions
from lsprotocol import types


def test_completions_returns_items():
    """Test that completion returns a list of items"""
    params = types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri="file:///test.txt"),
        position=types.Position(line=0, character=0),
    )

    result = completions(params)

    assert isinstance(result, types.CompletionList)
    assert len(result.items) > 0
    assert result.is_incomplete is False


def test_completions_includes_keywords():
    """Test that completions include CK3 keywords"""
    params = types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri="file:///test.txt"),
        position=types.Position(line=0, character=0),
    )

    result = completions(params)
    labels = [item.label for item in result.items]

    # Check a few common keywords are present
    assert "if" in labels
    assert "trigger" in labels
    assert "effect" in labels


def test_completions_includes_effects():
    """Test that completions include CK3 effects"""
    params = types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri="file:///test.txt"),
        position=types.Position(line=0, character=0),
    )

    result = completions(params)
    labels = [item.label for item in result.items]

    # Check a few common effects are present
    assert "add_trait" in labels
    assert "add_gold" in labels
    assert "add_prestige" in labels


def test_completions_includes_triggers():
    """Test that completions include CK3 triggers"""
    params = types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri="file:///test.txt"),
        position=types.Position(line=0, character=0),
    )

    result = completions(params)
    labels = [item.label for item in result.items]

    # Check a few common triggers are present
    assert "age" in labels
    assert "has_trait" in labels
    assert "is_ai" in labels


def test_completion_item_kinds():
    """Test that completion items have appropriate kinds"""
    params = types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri="file:///test.txt"),
        position=types.Position(line=0, character=0),
    )

    result = completions(params)

    # Find specific items and check their kinds
    for item in result.items:
        if item.label == "if":
            assert item.kind == types.CompletionItemKind.Keyword
        elif item.label == "add_trait":
            assert item.kind == types.CompletionItemKind.Function
        elif item.label == "root":
            assert item.kind == types.CompletionItemKind.Variable
        elif item.label == "yes":
            assert item.kind == types.CompletionItemKind.Value
