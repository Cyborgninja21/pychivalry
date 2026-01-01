"""
Tests for CK3 Script Values & Formulas Module

Tests script value parsing, formula validation, and conditional logic.
"""

import pytest
from pychivalry.script_values import (
    is_formula_operation,
    is_conditional_keyword,
    parse_script_value,
    validate_formula,
    validate_conditional_formula,
    extract_conditions,
    evaluate_formula_complexity,
    get_formula_operations,
    is_valid_range,
    format_script_value,
    is_value_reference,
    ScriptValue,
)


class TestFormulaOperations:
    """Test formula operation detection."""

    def test_valid_operations(self):
        """Test valid formula operations."""
        assert is_formula_operation("value") is True
        assert is_formula_operation("add") is True
        assert is_formula_operation("subtract") is True
        assert is_formula_operation("multiply") is True
        assert is_formula_operation("divide") is True
        assert is_formula_operation("modulo") is True
        assert is_formula_operation("min") is True
        assert is_formula_operation("max") is True
        assert is_formula_operation("round") is True
        assert is_formula_operation("ceiling") is True
        assert is_formula_operation("floor") is True

    def test_invalid_operations(self):
        """Test invalid operations."""
        assert is_formula_operation("invalid") is False
        assert is_formula_operation("add_gold") is False
        assert is_formula_operation("") is False


class TestConditionalKeywords:
    """Test conditional keyword detection."""

    def test_valid_conditionals(self):
        """Test valid conditional keywords."""
        assert is_conditional_keyword("if") is True
        assert is_conditional_keyword("else_if") is True
        assert is_conditional_keyword("else") is True

    def test_invalid_conditionals(self):
        """Test invalid conditional keywords."""
        assert is_conditional_keyword("elif") is False
        assert is_conditional_keyword("while") is False
        assert is_conditional_keyword("") is False


class TestParseScriptValue:
    """Test script value parsing."""

    def test_parse_fixed_value_int(self):
        """Test parsing fixed integer value."""
        result = parse_script_value("my_value", 100)
        assert result is not None
        assert result.name == "my_value"
        assert result.value_type == "fixed"
        assert result.value == 100

    def test_parse_fixed_value_float(self):
        """Test parsing fixed float value."""
        result = parse_script_value("my_value", 3.14)
        assert result is not None
        assert result.value_type == "fixed"
        assert result.value == 3.14

    def test_parse_range_dict(self):
        """Test parsing range as dictionary."""
        result = parse_script_value("my_range", {"min": 50, "max": 100})
        assert result is not None
        assert result.value_type == "range"
        assert result.value == (50, 100)

    def test_parse_range_list(self):
        """Test parsing range as list."""
        result = parse_script_value("my_range", [50, 100])
        assert result is not None
        assert result.value_type == "range"
        assert result.value == (50, 100)

    def test_parse_range_tuple(self):
        """Test parsing range as tuple."""
        result = parse_script_value("my_range", (50, 100))
        assert result is not None
        assert result.value_type == "range"
        assert result.value == (50, 100)

    def test_parse_formula(self):
        """Test parsing formula."""
        formula_data = {"value": 100, "add": 50, "multiply": 2}
        result = parse_script_value("my_formula", formula_data)
        assert result is not None
        assert result.value_type == "formula"
        assert result.value == formula_data

    def test_parse_conditional_formula(self):
        """Test parsing formula with conditionals."""
        formula_data = {"if": {}, "else": {}}
        result = parse_script_value("my_conditional", formula_data)
        assert result is not None
        assert result.value_type == "formula"
        assert result.conditions is not None


class TestValidateFormula:
    """Test formula validation."""

    def test_valid_simple_formula(self):
        """Test valid simple formula."""
        formula = {"value": 100, "add": 50}
        is_valid, error = validate_formula(formula)
        assert is_valid is True
        assert error is None

    def test_valid_complex_formula(self):
        """Test valid complex formula."""
        formula = {"value": 100, "add": 50, "multiply": 2, "min": 10, "max": 500}
        is_valid, error = validate_formula(formula)
        assert is_valid is True
        assert error is None

    def test_invalid_operation(self):
        """Test formula with invalid operation."""
        formula = {"invalid_op": 100}
        is_valid, error = validate_formula(formula)
        assert is_valid is False
        assert "Unknown formula operation" in error

    def test_formula_not_dict(self):
        """Test non-dictionary formula."""
        is_valid, error = validate_formula(100)
        assert is_valid is False
        assert "must be a dictionary" in error

    def test_valid_rounding_operations(self):
        """Test valid rounding operations."""
        formula = {"value": 3.7, "round": "yes"}
        is_valid, error = validate_formula(formula)
        assert is_valid is True

        formula = {"value": 3.7, "ceiling": "yes"}
        is_valid, error = validate_formula(formula)
        assert is_valid is True

        formula = {"value": 3.7, "floor": "yes"}
        is_valid, error = validate_formula(formula)
        assert is_valid is True


class TestValidateConditionalFormula:
    """Test conditional formula validation."""

    def test_valid_if_else(self):
        """Test valid if-else structure."""
        formula = {"if": {}, "else": {}}
        is_valid, error = validate_conditional_formula(formula)
        assert is_valid is True
        assert error is None

    def test_valid_if_elseif_else(self):
        """Test valid if-else_if-else structure."""
        formula = {"if": {}, "else_if": {}, "else": {}}
        is_valid, error = validate_conditional_formula(formula)
        assert is_valid is True
        assert error is None

    def test_invalid_elseif_after_else(self):
        """Test else_if cannot follow else."""
        formula = {"if": {}, "else": {}, "else_if": {}}
        is_valid, error = validate_conditional_formula(formula)
        assert is_valid is False
        assert "else_if cannot follow else" in error

    def test_invalid_multiple_else(self):
        """Test multiple else blocks not allowed."""
        # Note: In dict, duplicate keys would overwrite, so this tests the concept
        formula = {"if": {}, "else": {}}
        is_valid, error = validate_conditional_formula(formula)
        assert is_valid is True  # Single else is valid

    def test_conditional_not_dict(self):
        """Test non-dictionary conditional."""
        is_valid, error = validate_conditional_formula(100)
        assert is_valid is False
        assert "must be a dictionary" in error


class TestExtractConditions:
    """Test condition extraction from formulas."""

    def test_extract_if_condition(self):
        """Test extracting if condition."""
        formula = {"if": {"trigger": "has_trait"}}
        conditions = extract_conditions(formula)
        assert len(conditions) >= 1

    def test_extract_multiple_conditions(self):
        """Test extracting multiple conditions."""
        formula = {"if": {"trigger": "has_trait"}, "else_if": {"trigger": "is_adult"}, "else": {}}
        conditions = extract_conditions(formula)
        assert len(conditions) >= 2

    def test_extract_no_conditions(self):
        """Test formula without conditions."""
        formula = {"value": 100, "add": 50}
        conditions = extract_conditions(formula)
        assert len(conditions) == 0


class TestEvaluateFormulaComplexity:
    """Test formula complexity evaluation."""

    def test_simple_formula_complexity(self):
        """Test simple formula complexity."""
        formula = {"value": 100}
        complexity = evaluate_formula_complexity(formula)
        assert complexity == 1

    def test_arithmetic_formula_complexity(self):
        """Test arithmetic formula complexity."""
        formula = {"value": 100, "add": 50, "multiply": 2}
        complexity = evaluate_formula_complexity(formula)
        assert complexity == 3

    def test_conditional_formula_complexity(self):
        """Test conditional formula complexity."""
        formula = {"if": {}, "else": {}}
        complexity = evaluate_formula_complexity(formula)
        assert complexity >= 2  # Conditionals add more complexity

    def test_complex_formula_complexity(self):
        """Test complex formula complexity."""
        formula = {
            "value": 100,
            "add": 50,
            "multiply": 2,
            "min": 10,
            "max": 500,
            "if": {},
            "else": {},
        }
        complexity = evaluate_formula_complexity(formula)
        assert complexity >= 5


class TestGetFormulaOperations:
    """Test getting formula operations."""

    def test_get_simple_operations(self):
        """Test getting operations from simple formula."""
        formula = {"value": 100, "add": 50}
        operations = get_formula_operations(formula)
        assert "value" in operations
        assert "add" in operations

    def test_get_all_operations(self):
        """Test getting all operations."""
        formula = {
            "value": 100,
            "add": 50,
            "subtract": 10,
            "multiply": 2,
            "divide": 4,
            "min": 10,
            "max": 500,
        }
        operations = get_formula_operations(formula)
        assert len(operations) == 7

    def test_get_no_operations(self):
        """Test formula without operations."""
        formula = {"if": {}}
        operations = get_formula_operations(formula)
        assert len(operations) == 0


class TestIsValidRange:
    """Test range validation."""

    def test_valid_range(self):
        """Test valid range."""
        is_valid, error = is_valid_range((50, 100))
        assert is_valid is True
        assert error is None

    def test_valid_range_equal(self):
        """Test valid range with equal values."""
        is_valid, error = is_valid_range((100, 100))
        assert is_valid is True
        assert error is None

    def test_invalid_range_reversed(self):
        """Test invalid range (min > max)."""
        is_valid, error = is_valid_range((100, 50))
        assert is_valid is False
        assert "cannot be greater than" in error

    def test_invalid_range_length(self):
        """Test invalid range with wrong number of values."""
        is_valid, error = is_valid_range((50,))
        assert is_valid is False
        assert "exactly two values" in error

    def test_invalid_range_non_numeric(self):
        """Test invalid range with non-numeric values."""
        is_valid, error = is_valid_range(("a", "b"))
        assert is_valid is False
        assert "must be numbers" in error


class TestFormatScriptValue:
    """Test script value formatting."""

    def test_format_fixed_value(self):
        """Test formatting fixed value."""
        value = ScriptValue(name="my_value", value_type="fixed", value=100)
        formatted = format_script_value(value)
        assert "my_value" in formatted
        assert "100" in formatted

    def test_format_range_value(self):
        """Test formatting range value."""
        value = ScriptValue(name="my_range", value_type="range", value=(50, 100))
        formatted = format_script_value(value)
        assert "my_range" in formatted
        assert "50" in formatted
        assert "100" in formatted

    def test_format_formula_value(self):
        """Test formatting formula value."""
        value = ScriptValue(
            name="my_formula", value_type="formula", value={"value": 100, "add": 50}
        )
        formatted = format_script_value(value)
        assert "my_formula" in formatted


class TestIsValueReference:
    """Test value reference detection."""

    def test_valid_references(self):
        """Test valid value references."""
        assert is_value_reference("gold") is True
        assert is_value_reference("prestige") is True
        assert is_value_reference("piety") is True
        assert is_value_reference("age") is True

    def test_invalid_references(self):
        """Test invalid value references."""
        assert is_value_reference("invalid_ref") is False
        assert is_value_reference("add_gold") is False
        assert is_value_reference("") is False


class TestScriptValueIntegration:
    """Integration tests for script values."""

    def test_complete_fixed_value_workflow(self):
        """Test complete workflow for fixed value."""
        # Parse
        value = parse_script_value("my_gold", 100)
        assert value is not None
        assert value.value_type == "fixed"

        # Format
        formatted = format_script_value(value)
        assert "my_gold" in formatted
        assert "100" in formatted

    def test_complete_range_workflow(self):
        """Test complete workflow for range value."""
        # Parse
        value = parse_script_value("my_range", (50, 100))
        assert value is not None
        assert value.value_type == "range"

        # Validate
        is_valid, error = is_valid_range(value.value)
        assert is_valid is True

        # Format
        formatted = format_script_value(value)
        assert "my_range" in formatted

    def test_complete_formula_workflow(self):
        """Test complete workflow for formula."""
        # Parse
        formula_data = {"value": 100, "add": 50, "multiply": 2, "max": 500}
        value = parse_script_value("my_formula", formula_data)
        assert value is not None
        assert value.value_type == "formula"

        # Validate
        is_valid, error = validate_formula(value.value)
        assert is_valid is True

        # Get operations
        operations = get_formula_operations(value.value)
        assert "value" in operations
        assert "add" in operations
        assert "multiply" in operations

        # Evaluate complexity
        complexity = evaluate_formula_complexity(value.value)
        assert complexity >= 4

        # Format
        formatted = format_script_value(value)
        assert "my_formula" in formatted
