r"""
CK3 Scripted Blocks Module

This module handles validation and processing of CK3 scripted triggers and effects.
Scripted blocks allow modular, reusable code with parameter substitution.

Scripted Triggers:
- Defined in common/scripted_triggers/*.txt
- Contains conditional logic (triggers)
- Can be called like any trigger
- Supports parameters via $PARAM$ syntax

Scripted Effects:
- Defined in common/scripted_effects/*.txt
- Contains actions (effects)
- Can be called like any effect
- Supports parameters via $PARAM$ syntax

Inline Scripts:
- References via inline_script = { script = path }
- Files in common/inline_scripts/
- Parameter substitution with $PARAM$

Parameter Syntax:
- $PARAM$ - Required parameter
- Extract with regex: r'\$([A-Z_]+)\$'
- Validate all required parameters provided when called
"""

from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
import re


@dataclass
class ScriptedBlock:
    """
    Represents a scripted trigger or effect.

    Attributes:
        name: Block identifier
        block_type: 'scripted_trigger' or 'scripted_effect'
        file_path: Source file location
        parameters: Set of parameter names (without $)
        scope_requirement: Required scope type (if specified)
        documentation: Optional description
        content: The actual script content
    """

    name: str
    block_type: str
    file_path: str
    parameters: Set[str]
    scope_requirement: Optional[str] = None
    documentation: Optional[str] = None
    content: Optional[str] = None


@dataclass
class InlineScript:
    """
    Represents an inline script reference.

    Attributes:
        script_path: Path to the inline script file
        parameters: Dictionary of parameter name → value
        file_path: Source file where inline_script is used
    """

    script_path: str
    parameters: Dict[str, str]
    file_path: str


# Pattern for parameter extraction: $PARAM_NAME$
PARAMETER_PATTERN = re.compile(r"\$([A-Z_][A-Z0-9_]*)\$")


def extract_parameters(text: str) -> Set[str]:
    """
    Extract all parameter names from text.

    Parameters are in the format $PARAM_NAME$ where PARAM_NAME
    consists of uppercase letters, numbers, and underscores.

    Args:
        text: The text to search for parameters

    Returns:
        Set of parameter names (without the $ delimiters)

    Examples:
        >>> extract_parameters("add_gold = $AMOUNT$")
        {'AMOUNT'}

        >>> extract_parameters("$TARGET$ = { add_trait = $TRAIT$ }")
        {'TARGET', 'TRAIT'}
    """
    matches = PARAMETER_PATTERN.findall(text)
    return set(matches)


def validate_parameter_name(param_name: str) -> bool:
    """
    Validate that a parameter name follows CK3 conventions.

    Parameter names should:
    - Start with uppercase letter or underscore
    - Contain only uppercase letters, numbers, and underscores

    Args:
        param_name: The parameter name to validate (without $ delimiters)

    Returns:
        True if valid, False otherwise

    Examples:
        >>> validate_parameter_name("AMOUNT")
        True

        >>> validate_parameter_name("my_param")
        False  # Should be uppercase
    """
    if not param_name:
        return False

    pattern = r"^[A-Z_][A-Z0-9_]*$"
    return bool(re.match(pattern, param_name))


def create_scripted_trigger(name: str, content: str, file_path: str) -> ScriptedBlock:
    """
    Create a ScriptedBlock representing a scripted trigger.

    Args:
        name: Trigger name
        content: Trigger script content
        file_path: Source file path

    Returns:
        ScriptedBlock object
    """
    parameters = extract_parameters(content)

    return ScriptedBlock(
        name=name,
        block_type="scripted_trigger",
        file_path=file_path,
        parameters=parameters,
        content=content,
    )


def create_scripted_effect(name: str, content: str, file_path: str) -> ScriptedBlock:
    """
    Create a ScriptedBlock representing a scripted effect.

    Args:
        name: Effect name
        content: Effect script content
        file_path: Source file path

    Returns:
        ScriptedBlock object
    """
    parameters = extract_parameters(content)

    return ScriptedBlock(
        name=name,
        block_type="scripted_effect",
        file_path=file_path,
        parameters=parameters,
        content=content,
    )


def validate_scripted_block_call(
    block: ScriptedBlock, provided_params: Dict[str, str]
) -> Tuple[bool, Optional[str]]:
    """
    Validate that a call to a scripted block provides all required parameters.

    Args:
        block: The scripted block being called
        provided_params: Dictionary of parameter name → value provided in call

    Returns:
        Tuple of (is_valid, error_message)

    Examples:
        >>> block = ScriptedBlock(name='my_trigger', block_type='scripted_trigger',
        ...                       file_path='test.txt', parameters={'AMOUNT', 'TARGET'})
        >>> validate_scripted_block_call(block, {'AMOUNT': '100', 'TARGET': 'root'})
        (True, None)

        >>> validate_scripted_block_call(block, {'AMOUNT': '100'})
        (False, "Missing required parameters: TARGET")
    """
    required = block.parameters
    provided = set(provided_params.keys())

    missing = required - provided
    extra = provided - required

    if missing:
        return (False, f"Missing required parameters: {', '.join(sorted(missing))}")

    if extra:
        # Extra parameters are a warning, not an error
        # CK3 ignores extra parameters
        pass

    return (True, None)


def parse_inline_script_reference(text: str) -> Optional[Tuple[str, Dict[str, str]]]:
    """
    Parse an inline_script reference.

    Format: inline_script = { script = path [param = value ...] }
    or: inline_script = path

    Args:
        text: The text containing inline_script reference

    Returns:
        Tuple of (script_path, parameters) if valid, None otherwise

    Examples:
        >>> parse_inline_script_reference("inline_script = my_script")
        ('my_script', {})

        >>> parse_inline_script_reference("inline_script = { script = my_script AMOUNT = 100 }")
        ('my_script', {'AMOUNT': '100'})
    """
    # Simplified parsing - in real implementation would use proper AST
    # For now, extract basic structure

    # Simple form: inline_script = path (with word boundary)
    simple_match = re.search(r"\binline_script\s*=\s*([a-zA-Z_][a-zA-Z0-9_/]*)", text)
    if simple_match:
        return (simple_match.group(1), {})

    # Block form: inline_script = { script = path ... }
    block_match = re.search(r"\binline_script\s*=\s*\{([^}]+)\}", text)
    if block_match:
        content = block_match.group(1)

        # Extract script path
        script_match = re.search(r"script\s*=\s*([a-zA-Z_][a-zA-Z0-9_/]*)", content)
        if not script_match:
            return None

        script_path = script_match.group(1)

        # Extract parameters (simplified - real parser would be more robust)
        params = {}
        param_matches = re.finditer(r"([A-Z_][A-Z0-9_]*)\s*=\s*([^\s]+)", content)
        for match in param_matches:
            param_name = match.group(1)
            param_value = match.group(2)
            if param_name != "script":  # Exclude 'script' keyword
                params[param_name] = param_value

        return (script_path, params)

    return None


def validate_inline_script_path(script_path: str, base_path: str = "common/inline_scripts/") -> str:
    """
    Validate and construct full path to inline script file.

    Args:
        script_path: The script path from inline_script reference
        base_path: Base directory for inline scripts

    Returns:
        Full path to inline script file

    Examples:
        >>> validate_inline_script_path('my_script')
        'common/inline_scripts/my_script.txt'

        >>> validate_inline_script_path('utils/helper')
        'common/inline_scripts/utils/helper.txt'
    """
    # Ensure .txt extension
    if not script_path.endswith(".txt"):
        script_path = f"{script_path}.txt"

    # Construct full path
    full_path = f"{base_path}{script_path}"

    return full_path


def is_scripted_trigger(identifier: str, scripted_triggers: Dict[str, ScriptedBlock]) -> bool:
    """
    Check if an identifier is a known scripted trigger.

    Args:
        identifier: The identifier to check
        scripted_triggers: Dictionary of scripted trigger name → ScriptedBlock

    Returns:
        True if identifier is a known scripted trigger, False otherwise
    """
    return identifier in scripted_triggers


def is_scripted_effect(identifier: str, scripted_effects: Dict[str, ScriptedBlock]) -> bool:
    """
    Check if an identifier is a known scripted effect.

    Args:
        identifier: The identifier to check
        scripted_effects: Dictionary of scripted effect name → ScriptedBlock

    Returns:
        True if identifier is a known scripted effect, False otherwise
    """
    return identifier in scripted_effects


def get_scripted_block_documentation(block: ScriptedBlock) -> str:
    """
    Generate documentation string for a scripted block.

    Args:
        block: The scripted block

    Returns:
        Formatted documentation string
    """
    doc_parts = []

    # Block type
    block_type_str = (
        "Scripted Trigger" if block.block_type == "scripted_trigger" else "Scripted Effect"
    )
    doc_parts.append(f"**{block_type_str}**: `{block.name}`")

    # File location
    doc_parts.append(f"**File**: {block.file_path}")

    # Parameters
    if block.parameters:
        params_str = ", ".join(f"${p}$" for p in sorted(block.parameters))
        doc_parts.append(f"**Parameters**: {params_str}")
    else:
        doc_parts.append("**Parameters**: None")

    # Scope requirement
    if block.scope_requirement:
        doc_parts.append(f"**Scope**: {block.scope_requirement}")

    # Custom documentation
    if block.documentation:
        doc_parts.append(f"\n{block.documentation}")

    return "\n".join(doc_parts)


def substitute_parameters(text: str, parameters: Dict[str, str]) -> str:
    """
    Substitute parameters in text with their values.

    Args:
        text: Text containing $PARAM$ placeholders
        parameters: Dictionary of parameter name → value

    Returns:
        Text with parameters substituted

    Examples:
        >>> substitute_parameters("add_gold = $AMOUNT$", {'AMOUNT': '100'})
        'add_gold = 100'
    """
    result = text
    for param_name, param_value in parameters.items():
        placeholder = f"${param_name}$"
        result = result.replace(placeholder, param_value)
    return result


def find_undefined_parameters(text: str, defined_params: Set[str]) -> Set[str]:
    """
    Find parameters used in text that are not defined.

    Args:
        text: Text to search
        defined_params: Set of defined parameter names

    Returns:
        Set of undefined parameter names
    """
    used_params = extract_parameters(text)
    return used_params - defined_params
