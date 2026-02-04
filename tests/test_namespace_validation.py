"""
Tests for namespace and event ID validation (CK3400-CK3406).

This module tests the Phase 3 validation checks for namespace declarations
and event ID format/consistency validation.
"""

import pytest
from lsprotocol import types

from pychivalry.core.parser import parse_document
from pychivalry.ck3.validation.paradox_checks import (
    check_namespace_declaration,
    check_event_id_validation,
    ParadoxConfig,
)
from pychivalry import events


def parse_ck3_script(script: str):
    """Helper to parse CK3 script and return just the AST."""
    ast, errors = parse_document(script)
    return ast


# =============================================================================
# Helper Functions Tests
# =============================================================================


def test_is_valid_namespace_valid():
    """Valid namespaces with alphanumeric and underscores."""
    assert events.is_valid_namespace("my_mod")
    assert events.is_valid_namespace("MyMod")
    assert events.is_valid_namespace("my_mod_123")
    assert events.is_valid_namespace("test")


def test_is_valid_namespace_invalid():
    """Invalid namespaces with periods or special characters."""
    assert not events.is_valid_namespace("my.mod")
    assert not events.is_valid_namespace("my-mod")
    assert not events.is_valid_namespace("my mod")
    assert not events.is_valid_namespace("my@mod")
    assert not events.is_valid_namespace("")


def test_extract_event_number():
    """Extract numeric portion from event IDs."""
    assert events.extract_event_number("my_mod.0001") == 1
    assert events.extract_event_number("my_mod.1234") == 1234
    assert events.extract_event_number("my_mod.9999") == 9999
    assert events.extract_event_number("my_mod.10001") == 10001
    assert events.extract_event_number("invalid") is None
    assert events.extract_event_number("no_dot") is None


# =============================================================================
# CK3400: Missing Namespace Declaration
# =============================================================================


def test_ck3400_missing_namespace():
    """File has events but no namespace declaration."""
    script = """
my_event.0001 = {
    type = character_event
    title = my_event.0001.t
    desc = my_event.0001.desc
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_namespace_declaration(ast, config)

    assert len(diagnostics) == 1
    assert diagnostics[0].code == "CK3400"
    assert diagnostics[0].severity == types.DiagnosticSeverity.Error
    assert "no 'namespace' declaration" in diagnostics[0].message


def test_ck3400_namespace_present():
    """File has namespace - no error."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_namespace_declaration(ast, config)

    # Should not have CK3400 error
    ck3400_errors = [d for d in diagnostics if d.code == "CK3400"]
    assert len(ck3400_errors) == 0


def test_ck3400_no_events():
    """File has no events - no error even without namespace."""
    script = """
# Just some comments
some_variable = yes
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_namespace_declaration(ast, config)

    assert len(diagnostics) == 0


# =============================================================================
# CK3401: Event ID Namespace Mismatch
# =============================================================================


def test_ck3401_namespace_mismatch():
    """Event ID uses different namespace than declared."""
    script = """
namespace = my_events

other_namespace.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3401_errors = [d for d in diagnostics if d.code == "CK3401"]
    assert len(ck3401_errors) == 1
    assert ck3401_errors[0].severity == types.DiagnosticSeverity.Error
    assert "other_namespace" in ck3401_errors[0].message
    assert "my_events" in ck3401_errors[0].message


def test_ck3401_namespace_match():
    """Event ID matches declared namespace - no error."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
}

my_events.0002 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3401_errors = [d for d in diagnostics if d.code == "CK3401"]
    assert len(ck3401_errors) == 0


# =============================================================================
# CK3402: Event ID Exceeds 9999
# =============================================================================


def test_ck3402_id_exceeds_9999():
    """Event ID number exceeds 9999."""
    script = """
namespace = my_events

my_events.10001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3402_warnings = [d for d in diagnostics if d.code == "CK3402"]
    assert len(ck3402_warnings) == 1
    assert ck3402_warnings[0].severity == types.DiagnosticSeverity.Warning
    assert "10001" in ck3402_warnings[0].message
    assert "9999" in ck3402_warnings[0].message


def test_ck3402_id_at_limit():
    """Event ID 9999 is valid - no warning."""
    script = """
namespace = my_events

my_events.9999 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3402_warnings = [d for d in diagnostics if d.code == "CK3402"]
    assert len(ck3402_warnings) == 0


def test_ck3402_id_below_limit():
    """Event ID below 9999 - no warning."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
}

my_events.5000 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3402_warnings = [d for d in diagnostics if d.code == "CK3402"]
    assert len(ck3402_warnings) == 0


# =============================================================================
# CK3403: Invalid Namespace Characters
# =============================================================================


def test_ck3403_namespace_with_period():
    """Namespace contains period."""
    script = """
namespace = my.events

my.events.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_namespace_declaration(ast, config)

    ck3403_errors = [d for d in diagnostics if d.code == "CK3403"]
    assert len(ck3403_errors) == 1
    assert ck3403_errors[0].severity == types.DiagnosticSeverity.Error
    assert "my.events" in ck3403_errors[0].message
    assert "invalid characters" in ck3403_errors[0].message


def test_ck3403_namespace_with_hyphen():
    """Namespace contains hyphen."""
    script = """
namespace = my-events

my-events.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_namespace_declaration(ast, config)

    ck3403_errors = [d for d in diagnostics if d.code == "CK3403"]
    assert len(ck3403_errors) == 1


def test_ck3403_valid_namespace():
    """Valid namespace with alphanumeric and underscores."""
    script = """
namespace = my_events_123

my_events_123.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_namespace_declaration(ast, config)

    ck3403_errors = [d for d in diagnostics if d.code == "CK3403"]
    assert len(ck3403_errors) == 0


# =============================================================================
# CK3404: Duplicate Event IDs
# =============================================================================


def test_ck3404_duplicate_event_ids():
    """Same event ID defined multiple times."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
    title = first
}

my_events.0001 = {
    type = character_event
    title = duplicate
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3404_errors = [d for d in diagnostics if d.code == "CK3404"]
    assert len(ck3404_errors) == 1
    assert ck3404_errors[0].severity == types.DiagnosticSeverity.Error
    assert "Duplicate event ID" in ck3404_errors[0].message
    assert "my_events.0001" in ck3404_errors[0].message


def test_ck3404_unique_event_ids():
    """All event IDs are unique - no error."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
}

my_events.0002 = {
    type = character_event
}

my_events.0003 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3404_errors = [d for d in diagnostics if d.code == "CK3404"]
    assert len(ck3404_errors) == 0


def test_ck3404_triple_duplicate():
    """Three instances of same event ID."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
}

my_events.0001 = {
    type = letter_event
}

my_events.0001 = {
    type = court_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3404_errors = [d for d in diagnostics if d.code == "CK3404"]
    # Should have 2 errors (second and third occurrences)
    assert len(ck3404_errors) == 2


# =============================================================================
# CK3406: Invalid Event ID Format
# =============================================================================


def test_ck3406_invalid_format_no_dot():
    """Event ID without period separator."""
    script = """
namespace = my_events

invalid_event = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    # This won't trigger CK3406 because it doesn't look like an event
    # (no period and number pattern)
    ck3406_errors = [d for d in diagnostics if d.code == "CK3406"]
    assert len(ck3406_errors) == 0


def test_ck3406_valid_format():
    """Valid event ID format."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()
    diagnostics = check_event_id_validation(ast, config)

    ck3406_errors = [d for d in diagnostics if d.code == "CK3406"]
    assert len(ck3406_errors) == 0


# =============================================================================
# Integration Tests - Multiple Errors
# =============================================================================


def test_multiple_namespace_errors():
    """File with multiple namespace/event ID issues."""
    script = """
namespace = my.invalid.namespace

other_namespace.10001 = {
    type = character_event
}

my.invalid.namespace.0001 = {
    type = character_event
}

my.invalid.namespace.0001 = {
    type = letter_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()

    # Check namespace declaration
    ns_diagnostics = check_namespace_declaration(ast, config)
    # Check event ID validation
    id_diagnostics = check_event_id_validation(ast, config)

    all_diagnostics = ns_diagnostics + id_diagnostics

    # Should have:
    # - CK3403: Invalid namespace characters (period)
    # - CK3401: Namespace mismatch (other_namespace vs my.invalid.namespace)
    # - CK3402: ID exceeds 9999 (10001)
    # - CK3404: Duplicate event ID (my.invalid.namespace.0001)

    ck3403 = [d for d in all_diagnostics if d.code == "CK3403"]
    ck3401 = [d for d in all_diagnostics if d.code == "CK3401"]
    ck3402 = [d for d in all_diagnostics if d.code == "CK3402"]
    ck3404 = [d for d in all_diagnostics if d.code == "CK3404"]

    assert len(ck3403) == 1  # Invalid namespace
    assert len(ck3401) == 1  # Namespace mismatch
    assert len(ck3402) == 1  # ID > 9999
    assert len(ck3404) == 1  # Duplicate


def test_perfect_event_file():
    """Well-formed event file with no errors."""
    script = """
namespace = my_events

my_events.0001 = {
    type = character_event
    title = my_events.0001.t
    desc = my_events.0001.desc
}

my_events.0002 = {
    type = letter_event
    title = my_events.0002.t
    desc = my_events.0002.desc
    sender = root
}

my_events.9999 = {
    type = court_event
    title = my_events.9999.t
    desc = my_events.9999.desc
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig()

    ns_diagnostics = check_namespace_declaration(ast, config)
    id_diagnostics = check_event_id_validation(ast, config)

    all_diagnostics = ns_diagnostics + id_diagnostics

    # Should have no CK3400-CK3406 errors
    namespace_errors = [d for d in all_diagnostics if d.code and d.code.startswith("CK340")]
    assert len(namespace_errors) == 0


def test_config_disabled():
    """Validation disabled via config."""
    script = """
# Invalid file - missing namespace
my_events.0001 = {
    type = character_event
}
"""
    ast = parse_ck3_script(script)
    config = ParadoxConfig(event_structure=False)

    ns_diagnostics = check_namespace_declaration(ast, config)
    id_diagnostics = check_event_id_validation(ast, config)

    # Should have no diagnostics when disabled
    assert len(ns_diagnostics) == 0
    assert len(id_diagnostics) == 0
