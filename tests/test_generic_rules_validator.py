"""
Tests for generic_rules_validator.py

Validates schema-driven generic validation rules.
"""

import pytest
from pychivalry.generic_rules_validator import (
    _load_generic_rules,
    validate_generic_rules,
    check_generic_rules,
)
from pychivalry.parser import CK3Node
from lsprotocol import types


class TestGenericRulesSchema:
    """Test generic rules schema loading."""
    
    def test_schema_loads(self):
        """Test that generic_rules.yaml loads successfully."""
        schema = _load_generic_rules()
        
        assert schema is not None
        assert "rules" in schema
        assert "configuration" in schema
        assert len(schema["rules"]) > 0
    
    def test_schema_structure(self):
        """Test that schema has expected structure."""
        schema = _load_generic_rules()
        
        # Check categories
        assert "categories" in schema
        categories = schema["categories"]
        assert "context_violations" in categories
        assert "iterator_misuse" in categories
        assert "common_gotchas" in categories
        
        # Check rules
        rules = schema["rules"]
        assert "effect_in_trigger_block" in rules
        assert "effect_in_limit_block" in rules
        assert "random_without_limit" in rules
        
        # Check rule structure
        rule = rules["effect_in_trigger_block"]
        assert "diagnostic" in rule
        assert "severity" in rule
        assert "pattern" in rule
        assert "context" in rule
        assert "message" in rule
    
    def test_configuration_categories(self):
        """Test that configuration maps to rule categories."""
        schema = _load_generic_rules()
        config = schema["configuration"]
        
        assert "effect_trigger_context" in config
        assert "list_iterators" in config
        assert "common_gotchas" in config
        assert "opinion_modifiers" in config
        
        # Each category should have rules
        for category, settings in config.items():
            assert "rules" in settings
            assert len(settings["rules"]) > 0


class TestEffectInTriggerValidation:
    """Test effect-in-trigger context validation."""
    
    def test_effect_in_trigger_block(self):
        """Test detecting effect in trigger block."""
        # Create AST with effect in trigger block
        ast = [
            CK3Node(
                key="trigger",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",  # This is an effect, not allowed in trigger
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should detect effect in trigger block
        assert len(diagnostics) > 0
        error_diags = [d for d in diagnostics if d.code == "CK3870"]
        assert len(error_diags) > 0
        assert "add_gold" in error_diags[0].message
        assert "trigger" in error_diags[0].message.lower()
    
    def test_effect_in_limit_block(self):
        """Test detecting effect in limit block."""
        ast = [
            CK3Node(
                key="limit",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should detect effect in limit block with CK3871
        error_diags = [d for d in diagnostics if d.code == "CK3871"]
        assert len(error_diags) > 0
        assert "limit" in error_diags[0].message.lower()
    
    def test_effect_in_effect_block_allowed(self):
        """Test that effects are allowed in effect blocks."""
        ast = [
            CK3Node(
                key="effect",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should NOT detect error - effects allowed in effect blocks
        effect_errors = [d for d in diagnostics if d.code in ("CK3870", "CK3871")]
        assert len(effect_errors) == 0


class TestRedundantChecks:
    """Test redundant pattern detection."""
    
    def test_redundant_always_yes(self):
        """Test detecting trigger = { always = yes }."""
        ast = [
            CK3Node(
                key="trigger",
                value=None,
                children=[
                    CK3Node(
                        key="always",
                        value="yes",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=12)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should detect redundant pattern
        redundant_diags = [d for d in diagnostics if d.code == "CK3872"]
        assert len(redundant_diags) > 0
        assert "always = yes" in redundant_diags[0].message.lower()
    
    def test_impossible_always_no(self):
        """Test detecting trigger = { always = no }."""
        ast = [
            CK3Node(
                key="trigger",
                value=None,
                children=[
                    CK3Node(
                        key="always",
                        value="no",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=12)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should detect impossible pattern with error severity
        impossible_diags = [d for d in diagnostics if d.code == "CK3873"]
        assert len(impossible_diags) > 0
        assert "always = no" in impossible_diags[0].message.lower()
        assert impossible_diags[0].severity == types.DiagnosticSeverity.Error


class TestIteratorValidation:
    """Test iterator usage validation."""
    
    def test_random_without_limit(self):
        """Test detecting random_ without limit."""
        ast = [
            CK3Node(
                key="random_vassal",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should detect missing limit
        limit_diags = [d for d in diagnostics if d.code == "CK3875"]
        assert len(limit_diags) > 0
        assert "limit" in limit_diags[0].message.lower()
    
    def test_any_with_effects(self):
        """Test detecting effects in any_ iterator."""
        ast = [
            CK3Node(
                key="any_vassal",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",  # Effect in any_ (should use every_)
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        diagnostics = validate_generic_rules(ast, index=None)
        
        # Should detect effects in any_
        any_diags = [d for d in diagnostics if d.code == "CK3976"]
        assert len(any_diags) > 0
        assert "every_" in any_diags[0].message


class TestConfigurationFiltering:
    """Test that configuration properly filters rules."""
    
    def test_disable_category(self):
        """Test disabling entire rule category."""
        ast = [
            CK3Node(
                key="trigger",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        # Disable effect_trigger_context checks
        config = {
            "effect_trigger_context": False,
            "list_iterators": True,
            "common_gotchas": True,
            "opinion_modifiers": True,
        }
        
        diagnostics = validate_generic_rules(ast, index=None, config=config)
        
        # Should NOT detect effect in trigger (category disabled)
        effect_errors = [d for d in diagnostics if d.code in ("CK3870", "CK3871")]
        assert len(effect_errors) == 0
    
    def test_legacy_compatibility_function(self):
        """Test that legacy API works."""
        ast = [
            CK3Node(
                key="trigger",
                value=None,
                children=[
                    CK3Node(
                        key="add_gold",
                        value="100",
                        children=[],
                        range=types.Range(
                            start=types.Position(line=1, character=0),
                            end=types.Position(line=1, character=15)
                        )
                    )
                ],
                range=types.Range(
                    start=types.Position(line=0, character=0),
                    end=types.Position(line=2, character=1)
                )
            )
        ]
        
        # Use legacy API
        diagnostics = check_generic_rules(
            ast,
            index=None,
            effect_trigger_context=True,
            list_iterators=True,
        )
        
        # Should detect effect in trigger
        assert len(diagnostics) > 0
        error_diags = [d for d in diagnostics if d.code == "CK3870"]
        assert len(error_diags) > 0
