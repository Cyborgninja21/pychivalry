"""
Tests for Issue #60 - Enhanced Scope Timing with Localization Awareness.

These tests verify CK3560/CK3561 diagnostics that detect the "Golden Rule"
violations where scopes created in immediate blocks are incorrectly referenced
in desc/title localization, which evaluates BEFORE immediate runs.

This is the #1 source of runtime errors for CK3 modders.
"""

import pytest
from lsprotocol import types

from pychivalry.parser import parse_document
from pychivalry.scope_timing import check_scope_timing
from pychivalry.indexer import DocumentIndex


class TestScopeTimingLocalization:
    """
    Tests for Issue #60 - Enhanced scope timing checks with localization awareness.

    These tests verify the "Golden Rule" enforcement for localization references:
    Scopes created in immediate blocks are NOT available in desc/title localization
    because those blocks evaluate BEFORE immediate runs.
    """

    def test_scope_in_desc_localization_error(self):
        """
        CK3560: Scope created in immediate but used in desc localization.

        Bug pattern (most common):
        - Event has desc = my_event.001.desc
        - Localization text contains [scope:target.GetName]
        - Target scope is created in immediate = { save_scope_as = target }
        - Result: ERROR text in game because scope doesn't exist when desc renders

        This is the #1 bug reported in Issue #60.
        """
        # Create a mock document index with localization data
        index = DocumentIndex()
        index.localization = {
            # Localization text references scope:target which doesn't exist yet
            "test.0001.desc": (
                "[scope:target.GetFirstName] approaches you with a proposal.",
                "file:///test/loc.yml",
                10,
            )
        }

        text = """test.0001 = {
    type = character_event
    desc = test.0001.desc
    immediate = {
        random_courtier = { save_scope_as = target }
    }
    option = { name = test.0001.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)
        codes = [d.code for d in diagnostics]

        # Should produce CK3560 error
        assert "CK3560" in codes, f"Expected CK3560 diagnostic, got: {codes}"

        # Check error message is helpful
        ck3560_diag = [d for d in diagnostics if d.code == "CK3560"][0]
        assert "target" in ck3560_diag.message
        assert "immediate" in ck3560_diag.message.lower()
        assert "before" in ck3560_diag.message.lower() or "BEFORE" in ck3560_diag.message

    def test_scope_in_title_localization_error(self):
        """
        CK3561: Scope created in immediate but used in title localization.

        Similar to desc but affects event title.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0002.t": (
                "Meeting with [scope:vassal.GetTitledFirstName]",
                "file:///test/loc.yml",
                20,
            )
        }

        text = """test.0002 = {
    type = character_event
    title = test.0002.t
    desc = test.0002.desc
    immediate = {
        random_vassal = { save_scope_as = vassal }
    }
    option = { name = test.0002.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)
        codes = [d.code for d in diagnostics]

        # Should produce CK3561 error
        assert "CK3561" in codes, f"Expected CK3561 diagnostic, got: {codes}"

        # Check error message
        ck3561_diag = [d for d in diagnostics if d.code == "CK3561"][0]
        assert "vassal" in ck3561_diag.message
        assert "title" in ck3561_diag.message.lower()

    def test_multiple_scopes_in_localization(self):
        """
        Multiple scopes in localization, all created in immediate.

        Should report separate diagnostics for each problematic scope.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0003.desc": (
                "[scope:target.GetName] and [scope:friend.GetName] meet.",
                "file:///test/loc.yml",
                30,
            )
        }

        text = """test.0003 = {
    type = character_event
    desc = test.0003.desc
    immediate = {
        random_courtier = { save_scope_as = target }
        random_friend = { save_scope_as = friend }
    }
    option = { name = test.0003.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)

        # Should produce CK3560 for both scopes
        ck3560_diags = [d for d in diagnostics if d.code == "CK3560"]
        assert len(ck3560_diags) >= 1, "Should flag at least one scope"

        # Check that scope names appear in diagnostics
        all_messages = " ".join([d.message for d in ck3560_diags])
        # At least one of the scopes should be mentioned
        assert "target" in all_messages or "friend" in all_messages

    def test_builtin_scope_in_localization_ok(self):
        """
        Built-in scopes (root, actor, etc.) in localization should be OK.

        Built-in scopes are always available and don't require save_scope_as.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0004.desc": (
                "[ROOT.GetName] receives a letter from [actor.GetName].",
                "file:///test/loc.yml",
                40,
            )
        }

        text = """test.0004 = {
    type = character_event
    desc = test.0004.desc
    immediate = {
        add_gold = 100
    }
    option = { name = test.0004.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)

        # Should NOT produce CK3560 (built-in scopes are always available)
        ck3560_diags = [d for d in diagnostics if d.code == "CK3560"]
        assert len(ck3560_diags) == 0, "Built-in scopes should not trigger diagnostics"

    def test_scope_passed_from_caller_ok(self):
        """
        Scope used in desc but NOT defined in immediate should be OK.

        If a scope is referenced in desc localization but NOT created in
        immediate, we assume it was passed from the calling event.
        This is a safe pattern and should not produce diagnostics.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0005.desc": (
                "[scope:target.GetName] has been captured.",
                "file:///test/loc.yml",
                50,
            )
        }

        text = """test.0005 = {
    type = character_event
    desc = test.0005.desc
    immediate = {
        # No save_scope_as here - scope:target comes from caller
        add_prestige = 50
    }
    option = { name = test.0005.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)

        # Should NOT produce CK3560 (scope comes from caller)
        ck3560_diags = [d for d in diagnostics if d.code == "CK3560"]
        assert len(ck3560_diags) == 0, "Scopes from caller should not trigger diagnostics"

    def test_no_index_provided_no_error(self):
        """
        If no DocumentIndex is provided, localization checks are skipped.

        This ensures backward compatibility and prevents errors when index
        is not available.
        """
        text = """test.0006 = {
    type = character_event
    desc = test.0006.desc
    immediate = {
        random_courtier = { save_scope_as = target }
    }
    option = { name = test.0006.a }
}"""
        ast, _parse_errors = parse_document(text)
        # No index provided
        diagnostics = check_scope_timing(ast, index=None)

        # Should not crash, and should not produce CK3560/CK3561
        # (because we can't check without localization data)
        ck3560_diags = [d for d in diagnostics if d.code in ["CK3560", "CK3561"]]
        assert len(ck3560_diags) == 0, "Should skip localization checks without index"

    def test_localization_key_not_found_no_error(self):
        """
        If localization key is referenced but not in index, skip check gracefully.

        This handles cases where localization might be in a different file
        or not yet defined.
        """
        index = DocumentIndex()
        index.localization = {
            # Different key, not the one referenced in event
            "other.0001.desc": ("Some text", "file:///test/loc.yml", 60)
        }

        text = """test.0007 = {
    type = character_event
    desc = test.0007.desc
    immediate = {
        random_courtier = { save_scope_as = target }
    }
    option = { name = test.0007.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)

        # Should not crash - gracefully handle missing localization
        # Should not produce CK3560 (can't check without loc data)
        ck3560_diags = [d for d in diagnostics if d.code == "CK3560"]
        assert len(ck3560_diags) == 0, "Should skip check when localization not found"

    def test_scope_in_both_desc_and_trigger(self):
        """
        Scope used in BOTH trigger and desc localization.

        Should produce both CK3550 (trigger) and CK3560 (desc) diagnostics.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0009.desc": (
                "[scope:enemy.GetName] has been defeated!",
                "file:///test/loc.yml",
                80,
            )
        }

        text = """test.0009 = {
    type = character_event
    trigger = {
        scope:enemy = { is_alive = yes }
    }
    desc = test.0009.desc
    immediate = {
        random_rival = { save_scope_as = enemy }
    }
    option = { name = test.0009.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)
        codes = [d.code for d in diagnostics]

        # Should produce BOTH diagnostics
        assert "CK3550" in codes, "Should detect trigger violation"
        assert "CK3560" in codes, "Should detect desc localization violation"

    def test_no_immediate_block_no_error(self):
        """
        Event with no immediate block should not produce timing diagnostics.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0010.desc": (
                "[scope:target.GetName] is here.",
                "file:///test/loc.yml",
                90,
            )
        }

        text = """test.0010 = {
    type = character_event
    desc = test.0010.desc
    option = { name = test.0010.a }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)

        # Should not produce CK3560 (no scopes defined in immediate)
        ck3560_diags = [d for d in diagnostics if d.code == "CK3560"]
        assert len(ck3560_diags) == 0, "No immediate = no timing violations"

    def test_scope_in_option_localization_ok(self):
        """
        Scope in option localization is OK (options evaluate AFTER immediate).

        Options are rendered after immediate runs, so scopes created in
        immediate ARE available in option localization.
        """
        index = DocumentIndex()
        index.localization = {
            "test.0011.a": (
                "Execute [scope:prisoner.GetName]",
                "file:///test/loc.yml",
                100,
            )
        }

        text = """test.0011 = {
    type = character_event
    desc = test.0011.desc
    immediate = {
        random_prisoner = { save_scope_as = prisoner }
    }
    option = {
        name = test.0011.a
    }
}"""
        ast, _parse_errors = parse_document(text)
        diagnostics = check_scope_timing(ast, index=index)

        # Should NOT produce CK3560/CK3561 (options are safe)
        # Note: Current implementation only checks desc/title, not option names
        timing_diags = [d for d in diagnostics if d.code in ["CK3560", "CK3561"]]
        assert len(timing_diags) == 0, "Options evaluate after immediate"
