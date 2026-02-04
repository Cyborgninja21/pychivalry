"""
Game Log Integration - Real-time Error Detection from CK3 Game Logs

This subpackage provides integration with Crusader Kings 3 game logs:
- Watcher: Real-time monitoring of game log files for changes
- Analyzer: Pattern matching and error extraction from log entries
- Diagnostics: Convert game log errors into LSP diagnostic messages
"""

# Re-export all public symbols for backward compatibility
from .watcher import GameLogWatcher, LogWatcherConfig
from .analyzer import (
    LogAnalyzer,
    LogEntry,
    ErrorPattern,
    ScriptErrorMatch,
    AnalysisResult,
)
from .diagnostics import LogDiagnosticsProvider

__all__ = [
    # Watcher
    "GameLogWatcher",
    "LogWatcherConfig",
    # Analyzer
    "LogAnalyzer",
    "LogEntry",
    "ErrorPattern",
    "ScriptErrorMatch",
    "AnalysisResult",
    # Diagnostics
    "LogDiagnosticsProvider",
]
