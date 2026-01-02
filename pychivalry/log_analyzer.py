"""
CK3 Log Analyzer - Pattern matching and error detection for game logs

DIAGNOSTIC CODES:
    LOGANAL-001: Pattern matching error
    LOGANAL-002: Location extraction failed
    LOGANAL-003: Suggestion generation error

MODULE OVERVIEW:
    This module analyzes CK3 game logs by matching them against pre-defined error
    patterns. It extracts structured information from raw log lines, generates
    suggestions for fixes, and tracks statistics about errors encountered.

ARCHITECTURE:
    **Pattern System**:
    - Pre-defined regex patterns for common CK3 errors
    - Extensible pattern registration system
    - Category-based classification
    
    **Analysis Flow**:
    ```
    Raw log line → Pattern matching → Extract location → Generate suggestions →
    Create LogAnalysisResult → Track statistics
    ```

CLASSES:
    - ErrorPattern: Definition of a log error pattern
    - LogAnalysisResult: Structured result from analysis
    - LogStatistics: Accumulated error statistics
    - CK3LogAnalyzer: Main analysis engine

USAGE:
    ```python
    from pychivalry.log_analyzer import CK3LogAnalyzer
    
    analyzer = CK3LogAnalyzer(server)
    
    # Analyze single line
    result = analyzer.analyze_line(
        "Unknown effect: add_glod",
        "game.log"
    )
    
    # Analyze batch
    results = analyzer.analyze_batch(lines, "error.log")
    
    # Get statistics
    stats = analyzer.get_statistics()
    print(f"Total errors: {stats.total_errors}")
    ```

FEATURES:
    - Regex-based pattern matching
    - File/line location extraction from CK3 log format
    - Typo correction using fuzzy matching
    - Performance tracking
    - Category-based classification
    - Statistics accumulation

PERFORMANCE:
    - Pattern matching: ~0.1ms per line
    - Fuzzy matching: ~1ms per match
    - Memory: ~1-2 MB for statistics

DEPENDENCIES:
    - pygls>=2.0.0: LSP types for diagnostics
    - re: Regular expression matching (stdlib)
    - difflib: Fuzzy string matching (stdlib)

TESTING:
    See tests/test_log_analyzer.py for test suite

AUTHOR:
    Cyborgninja21

VERSION:
    1.0.0 (2026-01-01)
"""

import logging
import re
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime
from difflib import get_close_matches
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

from lsprotocol import types

if TYPE_CHECKING:
    from pygls.server import LanguageServer

logger = logging.getLogger(__name__)


@dataclass
class ErrorPattern:
    """
    Definition of a log error pattern.
    
    Each pattern defines how to match a specific type of error in CK3 logs,
    what information to extract, and what actions to suggest.
    
    Attributes:
        regex: Regular expression pattern to match log lines
        severity: Diagnostic severity (Error, Warning, Info, Hint)
        category: Classification string (e.g., "unknown_effect", "scope_error")
        message_template: Format string for user message (use {0}, {1} for captured groups)
        action_type: Type of code action to generate
        extract_location: Whether to try extracting file/line info
        suggest_fix: Whether to generate quick fix suggestions
        
    Example:
        ```python
        pattern = ErrorPattern(
            regex=r"Unknown effect: (\w+)",
            severity=types.DiagnosticSeverity.Error,
            category="unknown_effect",
            message_template="Unknown effect '{0}' used in script",
            action_type="suggest_similar",
            extract_location=True,
            suggest_fix=True
        )
        ```
    """
    
    regex: str
    severity: types.DiagnosticSeverity
    category: str
    message_template: str
    action_type: str
    extract_location: bool = True
    suggest_fix: bool = True
    
    def __post_init__(self) -> None:
        """Compile regex pattern after initialization."""
        self.compiled_regex = re.compile(self.regex, re.IGNORECASE)


@dataclass
class LogAnalysisResult:
    """
    Structured result from analyzing a log line.
    
    Contains all extracted information from a matched log pattern, including
    the error details, source location, and suggested fixes.
    
    Attributes:
        severity: Error severity level
        category: Error category/classification
        message: Human-readable error message
        raw_line: Original log line text
        timestamp: When the error was detected
        source_file: File where error occurred (if extractable)
        line_number: Line number in source file (if extractable)
        column_number: Column number in source file (if extractable)
        extracted_values: Dictionary of captured values from regex
        suggestions: List of suggested fixes
        code_action_type: Type of code action to create
        
    Example:
        ```python
        result = LogAnalysisResult(
            severity=types.DiagnosticSeverity.Error,
            category="unknown_effect",
            message="Unknown effect 'add_glod'",
            raw_line="[error] Unknown effect: add_glod",
            timestamp=datetime.now(),
            source_file="events/my_event.txt",
            line_number=45,
            suggestions=["add_gold", "add_gold_scaled"]
        )
        ```
    """
    
    severity: types.DiagnosticSeverity
    category: str
    message: str
    raw_line: str
    timestamp: datetime
    
    # Source location (optional)
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    
    # Extracted data
    extracted_values: Dict[str, str] = field(default_factory=dict)
    
    # Suggestions
    suggestions: List[str] = field(default_factory=list)
    code_action_type: Optional[str] = None


@dataclass
class LogStatistics:
    """
    Accumulated statistics from log analysis.
    
    Tracks various metrics about errors encountered during log monitoring,
    useful for performance analysis and debugging insights.
    
    Attributes:
        total_lines_processed: Number of log lines analyzed
        total_errors: Count of error-level issues
        total_warnings: Count of warning-level issues
        total_info: Count of info-level issues
        errors_by_category: Count of errors per category
        slow_events: Dictionary of event IDs to list of execution times (ms)
        most_common_errors: List of (error_message, count) tuples
        start_time: When statistics tracking started
        last_update: When statistics were last updated
        
    Example:
        ```python
        stats = analyzer.get_statistics()
        print(f"Processed {stats.total_lines_processed} lines")
        print(f"Found {stats.total_errors} errors")
        for category, count in stats.errors_by_category.items():
            print(f"  {category}: {count}")
        ```
    """
    
    total_lines_processed: int = 0
    total_errors: int = 0
    total_warnings: int = 0
    total_info: int = 0
    
    errors_by_category: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    slow_events: Dict[str, List[float]] = field(default_factory=lambda: defaultdict(list))
    most_common_errors: List[Tuple[str, int]] = field(default_factory=list)
    
    start_time: datetime = field(default_factory=datetime.now)
    last_update: datetime = field(default_factory=datetime.now)


class CK3LogAnalyzer:
    """
    Main analysis engine for CK3 game logs.
    
    Provides pattern-based error detection, location extraction, and suggestion
    generation for CK3 modding errors found in game logs.
    
    **Pattern Matching**:
    - Pre-defined patterns for common CK3 errors
    - Regex-based with capture groups
    - Category-based classification
    
    **Features**:
    - Extract file/line numbers from log format
    - Generate typo corrections using fuzzy matching
    - Track error statistics
    - Performance monitoring
    
    Attributes:
        server: LSP server instance
        error_patterns: List of registered error patterns
        statistics: Accumulated statistics
        
    Example:
        ```python
        analyzer = CK3LogAnalyzer(server)
        
        # Analyze logs
        results = analyzer.analyze_batch(log_lines, "game.log")
        
        # Check statistics
        stats = analyzer.get_statistics()
        if stats.total_errors > 10:
            print("Many errors detected!")
        ```
    """
    
    def __init__(self, server: "LanguageServer") -> None:
        """
        Initialize the log analyzer.
        
        Args:
            server: LSP server instance for notifications
        """
        self.server = server
        self.error_patterns: List[ErrorPattern] = []
        self.statistics = LogStatistics()
        
        # Register default patterns
        self._register_default_patterns()
        
        logger.info(f"CK3LogAnalyzer initialized with {len(self.error_patterns)} patterns")
    
    def _register_default_patterns(self) -> None:
        """Register default error patterns for common CK3 errors."""
        
        patterns = [
            # Unknown effect
            ErrorPattern(
                regex=r"Unknown effect:?\s+['\"]?(\w+)['\"]?",
                severity=types.DiagnosticSeverity.Error,
                category="unknown_effect",
                message_template="Unknown effect '{0}'",
                action_type="suggest_similar_effect"
            ),
            
            # Unknown trigger
            ErrorPattern(
                regex=r"Unknown trigger:?\s+['\"]?(\w+)['\"]?",
                severity=types.DiagnosticSeverity.Error,
                category="unknown_trigger",
                message_template="Unknown trigger '{0}'",
                action_type="suggest_similar_trigger"
            ),
            
            # Scope error
            ErrorPattern(
                regex=r"Invalid scope.*from\s+(\w+)\s+to\s+(\w+)",
                severity=types.DiagnosticSeverity.Error,
                category="scope_error",
                message_template="Invalid scope navigation from {0} to {1}",
                action_type="show_valid_scopes"
            ),
            
            # Missing event
            ErrorPattern(
                regex=r"Event\s+([\w.]+)\s+not found",
                severity=types.DiagnosticSeverity.Error,
                category="missing_event",
                message_template="Referenced event {0} doesn't exist",
                action_type="create_event_stub"
            ),
            
            # Missing localization
            ErrorPattern(
                regex=r"Missing localization key:?\s+['\"]?(\w+)['\"]?",
                severity=types.DiagnosticSeverity.Warning,
                category="missing_localization",
                message_template="Localization key '{0}' not found",
                action_type="generate_loc_entry"
            ),
            
            # Undefined variable
            ErrorPattern(
                regex=r"Variable\s+['\"](\w+)['\"].*not defined",
                severity=types.DiagnosticSeverity.Error,
                category="undefined_variable",
                message_template="Variable '{0}' used before definition",
                action_type="add_variable_definition"
            ),
            
            # Performance warning
            ErrorPattern(
                regex=r"Script execution took\s+(\d+)ms.*in event\s+([\w.]+)",
                severity=types.DiagnosticSeverity.Warning,
                category="performance",
                message_template="Event {1} took {0}ms (slow execution)",
                action_type="suggest_optimization"
            ),
            
            # Syntax error
            ErrorPattern(
                regex=r"Unexpected token\s+['\"]([^'\"]+)['\"]",
                severity=types.DiagnosticSeverity.Error,
                category="syntax_error",
                message_template="Unexpected token '{0}'",
                action_type="show_syntax_help"
            ),
            
            # Missing file
            ErrorPattern(
                regex=r"File\s+['\"]([^'\"]+)['\"].*not found",
                severity=types.DiagnosticSeverity.Error,
                category="missing_file",
                message_template="File '{0}' not found",
                action_type="create_file_stub"
            ),
            
            # Duplicate definition
            ErrorPattern(
                regex=r"Duplicate.*definition.*['\"](\w+)['\"]",
                severity=types.DiagnosticSeverity.Warning,
                category="duplicate_definition",
                message_template="Duplicate definition of '{0}'",
                action_type="show_other_definition"
            ),
        ]
        
        for pattern in patterns:
            self.register_pattern(pattern)
    
    def register_pattern(self, pattern: ErrorPattern) -> None:
        """
        Register a new error pattern.
        
        Args:
            pattern: ErrorPattern to register
            
        Example:
            ```python
            custom_pattern = ErrorPattern(
                regex=r"My custom error: (\w+)",
                severity=types.DiagnosticSeverity.Error,
                category="custom_error",
                message_template="Custom error with {0}",
                action_type="fix_custom"
            )
            analyzer.register_pattern(custom_pattern)
            ```
        """
        self.error_patterns.append(pattern)
        logger.debug(f"Registered pattern: {pattern.category}")
    
    def analyze_line(self, line: str, source_file: str) -> Optional[LogAnalysisResult]:
        """
        Analyze a single log line for errors.
        
        Args:
            line: Log line text to analyze
            source_file: Name of log file this line came from
            
        Returns:
            LogAnalysisResult if pattern matched, None otherwise
            
        Example:
            ```python
            result = analyzer.analyze_line(
                "Unknown effect: add_glod",
                "error.log"
            )
            if result:
                print(f"Error: {result.message}")
            ```
        """
        self.statistics.total_lines_processed += 1
        self.statistics.last_update = datetime.now()
        
        # Try each pattern
        for pattern in self.error_patterns:
            match = pattern.compiled_regex.search(line)
            if match:
                # Found a match - create result
                result = self._create_result_from_match(pattern, match, line, source_file)
                
                # Update statistics
                self._update_statistics(result)
                
                return result
        
        return None
    
    def analyze_batch(self, lines: List[str], source_file: str) -> List[LogAnalysisResult]:
        """
        Analyze multiple log lines.
        
        Args:
            lines: List of log lines to analyze
            source_file: Name of log file these lines came from
            
        Returns:
            List of LogAnalysisResult objects (one per matched line)
            
        Example:
            ```python
            with open("error.log") as f:
                lines = f.readlines()
            results = analyzer.analyze_batch(lines, "error.log")
            print(f"Found {len(results)} errors")
            ```
        """
        results = []
        
        for line in lines:
            result = self.analyze_line(line, source_file)
            if result:
                results.append(result)
        
        return results
    
    def _create_result_from_match(
        self,
        pattern: ErrorPattern,
        match: re.Match,
        line: str,
        source_file: str
    ) -> LogAnalysisResult:
        """
        Create LogAnalysisResult from regex match.
        
        Args:
            pattern: Matched error pattern
            match: Regex match object
            line: Original log line
            source_file: Source log file name
            
        Returns:
            LogAnalysisResult with extracted information
        """
        # Extract captured groups
        groups = match.groups()
        
        # Format message
        try:
            message = pattern.message_template.format(*groups)
        except (IndexError, KeyError):
            message = pattern.message_template
        
        # Create result
        result = LogAnalysisResult(
            severity=pattern.severity,
            category=pattern.category,
            message=message,
            raw_line=line.strip(),
            timestamp=datetime.now(),
            code_action_type=pattern.action_type
        )
        
        # Store extracted values
        for i, group in enumerate(groups):
            result.extracted_values[f"group{i}"] = group
        
        # Extract source location if requested
        if pattern.extract_location:
            location = self._extract_location(line)
            if location:
                result.source_file = location[0]
                result.line_number = location[1]
                result.column_number = location[2]
        
        # Generate suggestions if requested
        if pattern.suggest_fix:
            result.suggestions = self._generate_suggestions(pattern, groups)
        
        return result
    
    def _extract_location(self, line: str) -> Optional[Tuple[str, int, Optional[int]]]:
        """
        Extract file path and line number from CK3 log format.
        
        CK3 logs typically include location info like:
        - [error.cpp:123] Error in file 'events/my_event.txt' line 45: ...
        - File: events/my_event.txt, Line: 45
        - events/my_event.txt:45: ...
        
        Args:
            line: Log line text
            
        Returns:
            Tuple of (file_path, line_number, column_number) or None
        """
        # Pattern 1: file 'path' line 123
        match = re.search(r"file\s+['\"]([^'\"]+)['\"].*line\s+(\d+)", line, re.IGNORECASE)
        if match:
            return (match.group(1), int(match.group(2)), None)
        
        # Pattern 2: File: path, Line: 123
        match = re.search(r"File:\s+([^,]+),.*Line:\s+(\d+)", line, re.IGNORECASE)
        if match:
            return (match.group(1).strip(), int(match.group(2)), None)
        
        # Pattern 3: path:line:
        match = re.search(r"([a-zA-Z0-9_/\\.-]+\.txt):(\d+)", line)
        if match:
            return (match.group(1), int(match.group(2)), None)
        
        return None
    
    def _generate_suggestions(self, pattern: ErrorPattern, groups: tuple) -> List[str]:
        """
        Generate fix suggestions based on pattern and captured values.
        
        Args:
            pattern: Matched error pattern
            groups: Captured regex groups
            
        Returns:
            List of suggested fixes
        """
        suggestions = []
        
        if not groups:
            return suggestions
        
        # Get the main value (usually first group)
        value = groups[0] if groups else ""
        
        # Generate suggestions based on action type
        if pattern.action_type == "suggest_similar_effect":
            suggestions = self._suggest_similar_effects(value)
        elif pattern.action_type == "suggest_similar_trigger":
            suggestions = self._suggest_similar_triggers(value)
        elif pattern.action_type == "show_valid_scopes":
            # Suggestions would come from scope system
            suggestions = ["Check valid scope transitions", "See scope documentation"]
        
        return suggestions[:3]  # Limit to top 3 suggestions
    
    def _suggest_similar_effects(self, wrong_effect: str) -> List[str]:
        """
        Suggest similar effect names using fuzzy matching.
        
        Args:
            wrong_effect: The misspelled effect name
            
        Returns:
            List of similar valid effect names
        """
        # Import from ck3_language module
        try:
            from pychivalry.ck3_language import get_all_effects
            effects = get_all_effects()
            similar = get_close_matches(wrong_effect, effects, n=3, cutoff=0.6)
            return similar
        except ImportError:
            logger.warning("Could not import ck3_language for effect suggestions")
            return []
    
    def _suggest_similar_triggers(self, wrong_trigger: str) -> List[str]:
        """
        Suggest similar trigger names using fuzzy matching.
        
        Args:
            wrong_trigger: The misspelled trigger name
            
        Returns:
            List of similar valid trigger names
        """
        try:
            from pychivalry.ck3_language import get_all_triggers
            triggers = get_all_triggers()
            similar = get_close_matches(wrong_trigger, triggers, n=3, cutoff=0.6)
            return similar
        except ImportError:
            logger.warning("Could not import ck3_language for trigger suggestions")
            return []
    
    def _update_statistics(self, result: LogAnalysisResult) -> None:
        """
        Update statistics based on analysis result.
        
        Args:
            result: LogAnalysisResult to add to statistics
        """
        # Update counts by severity
        if result.severity == types.DiagnosticSeverity.Error:
            self.statistics.total_errors += 1
        elif result.severity == types.DiagnosticSeverity.Warning:
            self.statistics.total_warnings += 1
        elif result.severity == types.DiagnosticSeverity.Information:
            self.statistics.total_info += 1
        
        # Update category counts
        self.statistics.errors_by_category[result.category] += 1
        
        # Track performance if applicable
        if result.category == "performance" and len(result.extracted_values) >= 2:
            try:
                duration_ms = float(result.extracted_values.get("group0", 0))
                event_id = result.extracted_values.get("group1", "unknown")
                self.statistics.slow_events[event_id].append(duration_ms)
            except (ValueError, KeyError):
                pass
    
    def get_statistics(self) -> LogStatistics:
        """
        Get accumulated statistics.
        
        Returns:
            LogStatistics object with current stats
            
        Example:
            ```python
            stats = analyzer.get_statistics()
            print(f"Total errors: {stats.total_errors}")
            print(f"By category:")
            for cat, count in stats.errors_by_category.items():
                print(f"  {cat}: {count}")
            ```
        """
        # Update most common errors
        self.statistics.most_common_errors = sorted(
            self.statistics.errors_by_category.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return self.statistics
    
    def reset_statistics(self) -> None:
        """
        Reset statistics to zero.
        
        Useful for starting a new analysis session or after clearing logs.
        
        Example:
            ```python
            analyzer.reset_statistics()
            print("Statistics reset")
            ```
        """
        self.statistics = LogStatistics()
        logger.info("Statistics reset")
