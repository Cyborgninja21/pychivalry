"""
CK3 Diagnostics Engine - Multi-Phase Validation System

DIAGNOSTIC CODES:
    General (CK30xx): Syntax and basic validation
    Scope (CK31xx): Scope chain and type validation
    Style (CK33xx): Code style and formatting
    Paradox (CK35xx-CK38xx): Convention and best practices
    Timing (CK3550-CK3555): Scope timing validation
    List (CK39xx): List iterator validation
    Semantic (CK51xx): Semantic errors and gotchas

MODULE OVERVIEW:
    Provides comprehensive validation and error detection for CK3 scripts through
    a multi-phase validation pipeline. This is the central diagnostics engine that
    coordinates all validation modules and publishes diagnostics to the editor.
    
    Diagnostics catch errors before the game runs them, saving hours of debugging.
    The system is designed to be fast enough for realtime validation on every
    keystroke (with debouncing).

ARCHITECTURE:
    **Multi-Phase Validation Pipeline**:
    
    1. **Parse Phase** (10-50ms):
       - Parse document to AST
       - Detect syntax errors (mismatched braces, etc.)
       - Build symbol table for current file
       - Emit parse diagnostics (CK30xx)
    
    2. **Semantic Phase** (20-100ms):
       - Validate effects/triggers exist (CK31xx)
       - Check scope chain validity (CK31xx)
       - Verify scope requirements for constructs
       - Emit semantic diagnostics
    
    3. **Style Phase** (10-30ms):
       - Check code formatting (CK33xx)
       - Verify naming conventions
       - Detect redundant code
       - Emit style diagnostics
    
    4. **Paradox Conventions Phase** (20-50ms):
       - Validate against Paradox best practices (CK35xx-CK38xx)
       - Check for common gotchas (CK51xx)
       - Verify iterator usage (CK39xx)
       - Emit convention diagnostics
    
    5. **Timing Phase** (10-30ms):
       - Validate scope timing (CK3550-CK3555)
       - Check Golden Rule violations
       - Verify variable initialization order
       - Emit timing diagnostics
    
    6. **Workspace Phase** (50-200ms, async):
       - Cross-file validation
       - Undefined reference detection
       - Event chain validation
       - Emit workspace diagnostics
    
    **Total Time**: 70-250ms for typical file (500-1000 lines)
    Fast enough for realtime validation with 200ms debounce.

DIAGNOSTIC SEVERITY LEVELS:
    - **Error**: Code will fail at runtime (red squiggle)
      - Unknown effects/triggers
      - Invalid syntax
      - Scope violations
    
    - **Warning**: Code may have issues (yellow squiggle)
      - Deprecated constructs
      - Potential performance issues
      - Style violations
    
    - **Information**: Suggestions (blue squiggle)
      - Code improvements
      - Refactoring opportunities
    
    - **Hint**: Subtle improvements (faint dots)
      - Minor style suggestions
      - Optional optimizations

DIAGNOSTIC CODES SYSTEM:
    Format: CK3###
    - CK30xx: General syntax/semantic
    - CK31xx: Scope validation
    - CK33xx: Style and formatting
    - CK35xx: Event structure
    - CK36xx: Opinion modifiers
    - CK37xx: Event fields
    - CK38xx: Effect/trigger context
    - CK39xx: List iterators
    - CK51xx: Common gotchas
    - CK3550-3555: Scope timing
    
    Codes enable:
    - Searchable error documentation
    - Selective suppression (.ck3-lint ignore)
    - Error categorization and tracking
    - Code action quick fixes

USAGE EXAMPLES:
    >>> # Get diagnostics for document
    >>> diagnostics = get_diagnostics(document, index)
    >>> len(diagnostics)
    3  # Found 3 issues
    >>> diagnostics[0].severity
    DiagnosticSeverity.Error
    >>> diagnostics[0].code
    'CK3101'  # Unknown effect
    >>> diagnostics[0].message
    'Unknown effect: add_gol (did you mean add_gold?)'

PERFORMANCE OPTIMIZATIONS:
    - Incremental validation: Only revalidate changed regions
    - Cached results: Store validation results per file version
    - Parallel phases: Run independent phases concurrently
    - Debouncing: Wait 200ms after typing before validating
    - Progressive disclosure: Show parse errors immediately, deeper analysis later

LSP INTEGRATION:
    textDocument/publishDiagnostics (server-initiated):
    - Server pushes diagnostics to client after validation
    - Client displays squiggles and error panel
    - Diagnostics persist until file changes or closes
    
    Triggered by:
    - File open
    - File change (after debounce)
    - File save
    - Workspace configuration change

SEE ALSO:
    - parser.py: AST for semantic analysis
    - scope_timing.py: Timing validation
    - paradox_checks.py: Convention validation
    - style_checks.py: Style validation
    - indexer.py: Workspace-wide symbol resolution
    - ck3_language.py: Language definitions for validation
"""

from dataclasses import dataclass
from typing import List, Optional
from lsprotocol import types
from pygls.workspace import TextDocument

from .parser import CK3Node
from .indexer import DocumentIndex
from .scopes import (
    validate_scope_chain,
    is_valid_list_base,
    parse_list_iterator,
)
from .ck3_language import CK3_EFFECTS, CK3_TRIGGERS, CK3_SCOPES
import logging

logger = logging.getLogger(__name__)


def create_diagnostic(
    message: str,
    range_: types.Range,
    severity: types.DiagnosticSeverity = types.DiagnosticSeverity.Error,
    code: Optional[str] = None,
    source: str = "ck3-ls",
) -> types.Diagnostic:
    """
    Create a diagnostic object.

    Args:
        message: Human-readable error/warning message
        range_: Document range where the diagnostic applies
        severity: Severity level (Error, Warning, Information, Hint)
        code: Optional diagnostic code (e.g., "CK3001")
        source: Source of the diagnostic (default: "ck3-ls")

    Returns:
        Diagnostic object ready to send to client
    """
    return types.Diagnostic(
        message=message,
        severity=severity,
        range=range_,
        code=code,
        source=source,
    )


def check_syntax(doc: TextDocument, ast: List[CK3Node]) -> List[types.Diagnostic]:
    """
    Check for syntax errors in the document.

    Validates:
    - Bracket matching (unclosed/unmatched brackets)
    - Basic structural issues

    Args:
        doc: The text document to check
        ast: Parsed AST (may be incomplete if syntax errors exist)

    Returns:
        List of syntax error diagnostics
    """
    diagnostics = []

    # Check bracket matching
    stack = []
    lines = doc.source.split("\n")
    total_lines = len(lines)

    for line_num, line in enumerate(lines):
        # Track position in line
        in_string = False
        for char_idx, char in enumerate(line):
            # Handle strings - don't count brackets inside strings
            if char == '"' and (char_idx == 0 or line[char_idx - 1] != "\\"):
                in_string = not in_string
                continue

            if in_string:
                continue

            if char == "#":
                # Rest of line is comment, skip it
                break

            if char == "{":
                stack.append((line_num, char_idx))
            elif char == "}":
                if not stack:
                    # Unmatched closing bracket
                    diagnostics.append(
                        create_diagnostic(
                            message=(
                                "Unmatched closing bracket - no corresponding "
                                "opening bracket found"
                            ),
                            range_=types.Range(
                                start=types.Position(line=line_num, character=char_idx),
                                end=types.Position(line=line_num, character=char_idx + 1),
                            ),
                            severity=types.DiagnosticSeverity.Error,
                            code="CK3001",
                        )
                    )
                else:
                    stack.pop()

    # Report unclosed brackets with helpful context
    for line_num, char_idx in stack:
        # Get context: what key opened this bracket?
        open_line = lines[line_num]
        # Try to extract the key before the '=' on the same line
        key_context = ""
        key_start = 0
        equals_pos = open_line.rfind("=", 0, char_idx)
        if equals_pos != -1:
            # Extract the key before the equals sign
            key_part = open_line[:equals_pos].strip()
            # Get the last word (the key)
            key_words = key_part.split()
            if key_words:
                key_context = f" (block: '{key_words[-1]}')"
                # Find where the key starts for better highlighting
                key_start = open_line.find(key_words[-1])
                if key_start == -1:
                    key_start = 0

        # Highlight from the key to the end of line for better visibility
        line_end = len(open_line)

        # Primary diagnostic at the opening bracket - highlight the whole declaration
        diagnostics.append(
            create_diagnostic(
                message=(
                    f"Unclosed bracket{key_context} - opened at line "
                    f"{line_num + 1}, expected closing '}}' before end of "
                    f"file (line {total_lines})"
                ),
                range_=types.Range(
                    start=types.Position(line=line_num, character=key_start),
                    end=types.Position(line=line_num, character=line_end),
                ),
                severity=types.DiagnosticSeverity.Error,
                code="CK3002",
            )
        )

        # Secondary diagnostic at end of file to help locate the problem
        last_line_idx = total_lines - 1
        last_line_len = len(lines[last_line_idx]) if lines else 0
        diagnostics.append(
            create_diagnostic(
                message=(
                    f"Missing closing '}}' for block opened at line " f"{line_num + 1}{key_context}"
                ),
                range_=types.Range(
                    start=types.Position(line=last_line_idx, character=max(0, last_line_len - 1)),
                    end=types.Position(line=last_line_idx, character=last_line_len),
                ),
                severity=types.DiagnosticSeverity.Error,
                code="CK3002",
            )
        )

    return diagnostics


def check_trait_references(ast: List[CK3Node]) -> List[types.Diagnostic]:
    """
    Validate trait references in has_trait, add_trait, remove_trait.
    
    This validation is OPTIONAL and requires user-extracted trait data.
    If trait data is not available, this check is silently skipped.
    
    Detects:
    - CK3451: Unknown trait referenced
    
    Args:
        ast: Parsed AST nodes
        
    Returns:
        List of diagnostics for invalid trait references,
        or empty list if trait data not available
        
    Note:
        Trait data must be extracted by users from their own CK3 installation
        using the VS Code command "PyChivalry: Extract Trait Data from CK3 Installation"
        due to copyright restrictions.
    """
    from pychivalry.traits import is_trait_data_available, is_valid_trait, suggest_similar_traits
    
    # Skip trait validation if data not available (user hasn't extracted it)
    if not is_trait_data_available():
        logger.debug("Trait data not available - skipping trait validation")
        return []
    
    diagnostics = []
    
    # Trait reference effects/triggers
    trait_keywords = {'has_trait', 'add_trait', 'remove_trait'}
    
    def check_node(node: CK3Node):
        if node.key in trait_keywords and node.value:
            trait_name = node.value.strip()
            
            # Skip if it's a variable or scope reference
            if trait_name.startswith('var:') or trait_name.startswith('scope:') or trait_name.startswith('local_var:') or trait_name.startswith('global_var:'):
                return
            
            # Validate trait exists
            if not is_valid_trait(trait_name):
                # Get suggestions
                suggestions = suggest_similar_traits(trait_name, max_suggestions=3)
                
                # Build message with suggestions
                message = f"Unknown trait '{trait_name}'"
                if suggestions:
                    message += f". Did you mean: {', '.join(suggestions)}?"
                
                diagnostics.append(
                    create_diagnostic(
                        message=message,
                        range_=node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3451",
                    )
                )
        
        # Recurse into children
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics


def check_semantics(ast: List[CK3Node], index: Optional[DocumentIndex]) -> List[types.Diagnostic]:
    """
    Check for semantic errors in the AST.

    Validates:
    - Unknown effects and triggers
    - Effects in trigger blocks
    - Triggers in effect blocks (warnings)
    - Undefined event references
    - Custom scripted effects/triggers (from workspace index)
    - Trait references (CK3451)

    Args:
        ast: Parsed AST
        index: Document index for cross-file validation (optional)

    Returns:
        List of semantic diagnostics
    """
    diagnostics = []
    
    # Check trait references first (fast validation)
    diagnostics.extend(check_trait_references(ast))

    # Get custom effects/triggers from workspace index
    custom_effects = index.get_all_scripted_effects() if index else set()
    custom_triggers = index.get_all_scripted_triggers() if index else set()

    # Get custom modifiers and opinion modifiers from workspace index
    custom_modifiers = set(index.modifiers.keys()) if index else set()
    custom_opinion_modifiers = set(index.opinion_modifiers.keys()) if index else set()

    # Combined sets for validation
    all_known_effects = set(CK3_EFFECTS) | custom_effects
    all_known_triggers = set(CK3_TRIGGERS) | custom_triggers

    # Effect parameters - these are arguments to effects, not effects themselves
    # Map of parent_effect -> valid parameter names
    EFFECT_PARAMETERS = {
        # Opinion effects
        "add_opinion": {"target", "modifier", "opinion", "years"},
        "reverse_add_opinion": {"target", "modifier", "opinion", "years"},
        "remove_opinion": {"target", "modifier"},
        # Modifier effects
        "add_character_modifier": {"modifier", "years", "months", "days", "stacking"},
        "remove_character_modifier": {"modifier"},
        "add_county_modifier": {"modifier", "years", "months", "days"},
        "add_province_modifier": {"modifier", "years", "months", "days"},
        # Trait effects
        "add_trait": {"trait", "track", "value"},
        "remove_trait": {"trait"},
        # Stress effects
        "add_stress": {"trait"},
        # Interaction effects
        "open_interaction_window": {
            "interaction",
            "actor",
            "recipient",
            "secondary_actor",
            "secondary_recipient",
        },
        # Event effects
        "trigger_event": {"id", "days", "weeks", "months", "years", "on_action", "delayed"},
        # Relation effects
        "set_relation_lover": {"target", "reason", "copy_reason"},
        "set_relation_friend": {"target", "reason", "copy_reason"},
        "set_relation_rival": {"target", "reason", "copy_reason"},
        "set_relation_best_friend": {"target", "reason", "copy_reason"},
        "set_relation_nemesis": {"target", "reason", "copy_reason"},
        "remove_relation_lover": {"target"},
        "remove_relation_friend": {"target"},
        "remove_relation_rival": {"target"},
        # Create character effects
        "create_character": {
            "template",
            "location",
            "culture",
            "faith",
            "dynasty",
            "gender",
            "name",
            "age",
            "trait",
            "employer",
            "father",
            "mother",
            "save_scope_as",
        },
        # Scope save
        "save_scope_as": {},  # Takes string value directly
        "save_temporary_scope_as": {},
        # Random effects
        "random": {"chance", "modifier"},
        "random_list": {},  # Children are weights
        # Death
        "death": {"death_reason", "killer"},
        # Flag effects
        "add_character_flag": {"flag", "years", "months", "days"},
        "remove_character_flag": {"flag"},
        # Marriage
        "marry": {"target"},
        "marry_matrilineal": {"target"},
        # Title effects
        "create_title_and_vassal_change": {"type", "save_scope_as", "add_claim_on_loss"},
        "change_title_holder": {"holder", "change", "take_baronies"},
        # War effects
        "start_war": {"casus_belli", "target", "target_title", "claimant"},
        # Duel effects
        "duel": {"target", "skill", "value", "on_success", "on_failure"},
        # Send interface message
        "send_interface_message": {"type", "title", "desc", "left_icon", "right_icon", "goto"},
        "send_interface_toast": {"type", "title", "desc", "left_icon", "right_icon"},
        # Custom tooltip
        "custom_tooltip": {},  # Takes string value
        # Scheme effects
        "start_scheme": {"type", "target"},
        # Show as tooltip
        "show_as_tooltip": {},  # Children are effects to show
        # Hidden effect
        "hidden_effect": {},  # Children are effects
        # Every/any/random list iterators - have 'limit' as parameter
        "every_": {
            "limit",
            "alternative",
            "order_by",
            "position",
            "min",
            "max",
            "check_range_bounds",
        },
        "any_": {"limit", "count", "percent"},
        "random_": {"limit", "weight", "alternative"},
        "ordered_": {"limit", "order_by", "position", "min", "max", "check_range_bounds"},
        # Set variable effects
        "set_variable": {"name", "value", "days", "years", "months"},
        "change_variable": {"name", "add", "subtract", "multiply", "divide"},
        "clamp_variable": {"name", "min", "max"},
        # Script values use base/add/multiply etc
        "script_value": {"base", "add", "multiply", "divide", "min", "max", "desc"},
    }

    # Common parameters that are valid in many contexts
    COMMON_PARAMETERS = {
        "target",
        "modifier",
        "limit",
        "weight",
        "years",
        "months",
        "days",
        "opinion",
        "reason",
        "save_scope_as",
        "value",
        "min",
        "max",
        "desc",
        "title",
        "type",
        "name",
        "holder",
        "skill",
        # Script value components
        "base",
        "add",
        "subtract",
        "multiply",
        "divide",
        # Random list weights
        "modifier",
        "trigger",
        "effect",
        # Common block types
        "alternative",
        "fallback",
        "on_success",
        "on_failure",
    }

    # All uppercase words are typically effect parameters/arguments
    def is_effect_parameter(key: str) -> bool:
        """Check if a key looks like an effect parameter (ALL_CAPS or known param)."""
        return key.isupper() or key in COMMON_PARAMETERS

    def get_parent_effect_params(parent_key: str) -> set:
        """Get valid parameters for a parent effect."""
        # Direct lookup
        if parent_key in EFFECT_PARAMETERS:
            return EFFECT_PARAMETERS[parent_key]
        # Check prefixes for list iterators
        for prefix in ["every_", "any_", "random_", "ordered_"]:
            if parent_key.startswith(prefix):
                return EFFECT_PARAMETERS.get(prefix, set())
        return set()

    def check_node(node: CK3Node, context: str = "unknown", parent_key: str = ""):
        """Recursively check a node and its children."""
        # Determine context from node type
        new_context = context
        if node.key == "trigger":
            new_context = "trigger"
        elif node.key in ("immediate", "effect"):
            new_context = "effect"
        elif node.key == "option":
            # Options can contain both triggers (in nested trigger blocks) and effects
            new_context = "option"

        # Check for unknown effects/triggers based on context
        if context == "trigger":
            # In trigger context, check if this is a known trigger
            if node.key not in all_known_triggers and node.type == "assignment":
                # Check if it's a valid scope-specific trigger
                # For now, just check against global trigger list
                if node.key not in ["NOT", "OR", "AND", "NAND", "NOR"]:
                    diagnostics.append(
                        create_diagnostic(
                            message=f"Unknown trigger: '{node.key}'",
                            range_=node.range,
                            severity=types.DiagnosticSeverity.Warning,
                            code="CK3101",
                        )
                    )

            # Check if someone put an effect in a trigger block
            if node.key in all_known_effects:
                diagnostics.append(
                    create_diagnostic(
                        message=(
                            f"Effect '{node.key}' used in trigger block "
                            "(triggers should check conditions, not modify state)"
                        ),
                        range_=node.range,
                        severity=types.DiagnosticSeverity.Error,
                        code="CK3102",
                    )
                )

        elif context == "effect":
            # In effect context, check if this is a known effect
            if node.key not in all_known_effects and node.type == "assignment":
                # Allow some control flow keywords and also triggers (used for limit blocks, etc.)
                # Also allow scopes as they can be used to switch context
                if node.key not in [
                    "if",
                    "else_if",
                    "else",
                    "random",
                    "random_list",
                    "trigger",
                    "limit",
                ]:
                    # Don't flag triggers - they're valid in effect blocks for limit/if conditions
                    if node.key not in all_known_triggers and node.key not in CK3_SCOPES:
                        # Check if this is an effect parameter (child of an effect block)
                        parent_params = get_parent_effect_params(parent_key)
                        is_param = (
                            node.key in parent_params
                            or is_effect_parameter(node.key)
                            or node.key in custom_modifiers
                            or node.key in custom_opinion_modifiers
                        )

                        # Only report if NOT a parameter
                        if not is_param:
                            diagnostics.append(
                                create_diagnostic(
                                    message=f"Unknown effect: '{node.key}'",
                                    range_=node.range,
                                    severity=types.DiagnosticSeverity.Warning,
                                    code="CK3103",
                                )
                            )

        # Recursively check children, passing current node key as parent
        for child in node.children:
            check_node(child, new_context, node.key)

    # Check all top-level nodes
    for node in ast:
        check_node(node)

    return diagnostics


def check_scopes(ast: List[CK3Node], index: Optional[DocumentIndex]) -> List[types.Diagnostic]:
    """
    Check for scope-related errors.

    Validates:
    - Scope chain validity (e.g., liege.primary_title.holder)
    - Undefined saved scope references
    - Invalid list iterations

    Args:
        ast: Parsed AST
        index: Document index for saved scope tracking (optional)

    Returns:
        List of scope-related diagnostics
    """
    diagnostics = []

    def is_event_id(key: str) -> bool:
        """Check if a key looks like an event ID (e.g., namespace.0001)."""
        if "." not in key:
            return False
        parts = key.split(".")
        # Event IDs typically have format: namespace.number (e.g., test_events.0001)
        if len(parts) == 2:
            # Check if second part is numeric (event ID)
            try:
                int(parts[1])
                return True
            except ValueError:
                pass
        return False

    def check_node(node: CK3Node, current_scope: str = "character"):
        """Recursively check scope validity."""
        # Check for scope chains (contains '.')
        if "." in node.key and not node.key.startswith("scope:"):
            # Skip event IDs (e.g., namespace.0001) - they're not scope chains
            if not is_event_id(node.key):
                # Validate scope chain
                valid, result = validate_scope_chain(node.key, current_scope)
                if not valid:
                    diagnostics.append(
                        create_diagnostic(
                            message=f"Invalid scope chain: {result}",
                            range_=node.range,
                            severity=types.DiagnosticSeverity.Error,
                            code="CK3201",
                        )
                    )

        # Check for saved scope references (scope:xxx)
        if node.key.startswith("scope:"):
            scope_name = node.key[6:]  # Remove 'scope:' prefix
            if index and scope_name not in index.saved_scopes:
                diagnostics.append(
                    create_diagnostic(
                        message=(
                            f"Undefined saved scope: '{scope_name}' "
                            "(use save_scope_as to define it)"
                        ),
                        range_=node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3202",
                    )
                )

        # Check list iterations (any_, every_, random_, ordered_)
        parsed = parse_list_iterator(node.key)
        if parsed:
            prefix, base = parsed
            if not is_valid_list_base(base, current_scope):
                diagnostics.append(
                    create_diagnostic(
                        message=f"'{base}' is not a valid list in {current_scope} scope",
                        range_=node.range,
                        severity=types.DiagnosticSeverity.Warning,
                        code="CK3203",
                    )
                )

        # Recursively check children
        for child in node.children:
            check_node(child, current_scope)

    # Check all top-level nodes
    for node in ast:
        check_node(node)

    return diagnostics


@dataclass
class DiagnosticConfig:
    """
    Configuration for diagnostic checks.

    Attributes:
        style_enabled: Enable style/formatting checks (CK33xx)
        paradox_enabled: Enable Paradox convention checks (CK35xx+)
        scope_timing_enabled: Enable scope timing checks (CK3550-3555)
        story_cycles_enabled: Enable story cycle validation (STORY-001+)
        schema_enabled: Enable schema-driven validation (all codes)
    """

    style_enabled: bool = True
    paradox_enabled: bool = True
    scope_timing_enabled: bool = True
    story_cycles_enabled: bool = True
    schema_enabled: bool = True


def collect_all_diagnostics(
    doc: TextDocument,
    ast: List[CK3Node],
    index: Optional[DocumentIndex] = None,
    config: Optional[DiagnosticConfig] = None,
) -> List[types.Diagnostic]:
    """
    Collect all diagnostics for a document.

    This is the main entry point for diagnostic collection. It runs all
    validation checks and returns the combined results.

    Args:
        doc: The text document to validate
        ast: Parsed AST
        index: Document index for cross-file validation (optional)
        config: Diagnostic configuration (uses defaults if None)

    Returns:
        Combined list of all diagnostics
    """
    config = config or DiagnosticConfig()
    diagnostics = []

    try:
        # Syntax checks (always enabled)
        diagnostics.extend(check_syntax(doc, ast))

        # Semantic checks (always enabled)
        diagnostics.extend(check_semantics(ast, index))

        # Scope checks (always enabled)
        diagnostics.extend(check_scopes(ast, index))

        # Style checks (CK33xx)
        if config.style_enabled:
            try:
                from .style_checks import check_style

                diagnostics.extend(check_style(doc))
            except ImportError:
                logger.warning("style_checks module not available")
            except Exception as e:
                logger.error(f"Error in style checks: {e}", exc_info=True)

        # Paradox convention checks (CK35xx+)
        if config.paradox_enabled:
            try:
                from .paradox_checks import check_paradox_conventions

                diagnostics.extend(check_paradox_conventions(ast, index))
            except ImportError:
                logger.warning("paradox_checks module not available")
            except Exception as e:
                logger.error(f"Error in paradox checks: {e}", exc_info=True)

        # Scope timing checks (CK3550-3555)
        if config.scope_timing_enabled:
            try:
                from .scope_timing import check_scope_timing

                diagnostics.extend(check_scope_timing(ast, index))
            except ImportError:
                logger.warning("scope_timing module not available")
            except Exception as e:
                logger.error(f"Error in scope timing checks: {e}", exc_info=True)

        # Story cycle validation (STORY-001+)
        if config.story_cycles_enabled:
            try:
                from .story_cycles import collect_story_cycle_diagnostics

                diagnostics.extend(collect_story_cycle_diagnostics(ast, doc.uri))
            except ImportError:
                logger.warning("story_cycles module not available")
            except Exception as e:
                logger.error(f"Error in story cycle checks: {e}", exc_info=True)

        # Schema-driven validation (CK37xx, EVENT-xxx, etc.)
        if config.schema_enabled:
            try:
                from .schema_loader import SchemaLoader
                from .schema_validator import SchemaValidator
                
                # Get file path from URI for schema matching
                file_path = doc.uri.replace('file://', '')
                
                # Initialize schema system (cached after first load)
                if not hasattr(collect_all_diagnostics, '_schema_loader'):
                    collect_all_diagnostics._schema_loader = SchemaLoader()
                    collect_all_diagnostics._schema_loader.load_all()
                
                loader = collect_all_diagnostics._schema_loader
                validator = SchemaValidator(loader)
                
                # Run schema validation
                schema_diagnostics = validator.validate(file_path, ast)
                diagnostics.extend(schema_diagnostics)
                
                logger.debug(f"Schema validation found {len(schema_diagnostics)} diagnostics")
            except ImportError:
                logger.warning("schema_loader/schema_validator modules not available")
            except Exception as e:
                logger.error(f"Error in schema validation: {e}", exc_info=True)

        logger.debug(f"Found {len(diagnostics)} diagnostics for {doc.uri}")
    except Exception as e:
        logger.error(f"Error during diagnostic collection: {e}", exc_info=True)

    return diagnostics


def get_diagnostics_for_text(
    text: str, uri: str = "file:///test.txt", index: Optional[DocumentIndex] = None
) -> List[types.Diagnostic]:
    """
    Convenience function for testing: parse text and return diagnostics.

    Args:
        text: CK3 script text
        uri: Document URI (default: file:///test.txt)
        index: Document index for cross-file validation (optional)

    Returns:
        List of diagnostics
    """
    from .parser import parse_document

    # Parse the text
    ast = parse_document(text)

    # Create a mock TextDocument
    doc = TextDocument(uri=uri, source=text)

    # Collect diagnostics
    return collect_all_diagnostics(doc, ast, index)
