# CK3 Live Log Analysis - Implementation Plan

## Executive Summary

This document outlines the implementation plan for the **CK3 Live Log Analysis** feature, which will monitor Crusader Kings 3 game logs in real-time, analyze them for errors and patterns, and provide actionable feedback directly in VS Code.

**Key Features:**
- Real-time log file monitoring using `watchdog`
- Pattern-based error detection and classification
- Automatic conversion of game logs to LSP diagnostics
- Interactive log panel with clickable errors
- Performance analytics and optimization suggestions
- Smart code actions based on log patterns

**Target Users:** CK3 modders who want instant feedback on their script errors without leaving VS Code

---

## Module Architecture

### 1. Core Components

```
pychivalry/
├── log_watcher.py           # NEW - Main log watching and file monitoring
├── log_analyzer.py          # NEW - Pattern recognition and error analysis
├── log_formatter.py         # NEW - Log formatting and output generation
├── log_diagnostics.py       # NEW - Convert logs to LSP diagnostics
└── server.py                # MODIFY - Add log watcher commands and handlers
```

### 2. Data Flow

```
CK3 Game Logs               Log Watcher              Log Analyzer           LSP Server
     |                           |                         |                      |
     |-- game.log            -->|                         |                      |
     |-- error.log           -->|-- File Changed          |                      |
     |-- exceptions.log      -->|                         |                      |
                                 |-- Read New Lines   --->|                      |
                                                           |-- Parse Pattern      |
                                                           |-- Extract Location   |
                                                           |-- Generate Fix   --->|
                                                                                  |-- Send Notification
                                                                                  |-- Publish Diagnostic
                                                                                  |-- Create Code Action
                                                                                      |
VS Code Extension           <---------------------------------------------------|
     |
     |-- Display in Log Panel
     |-- Show in Problems Panel
     |-- Add Quick Fix Action
```

### 3. Threading Model

- **Main Thread**: LSP request handling (no blocking)
- **Watcher Thread**: File system monitoring (`watchdog.Observer`)
- **Analysis Thread**: Pattern matching and parsing (offloaded from main)
- **Communication**: Thread-safe queues for log entry processing

---

## Detailed Component Specifications

### Component 1: `log_watcher.py`

**Purpose:** Monitor CK3 log directory and detect file changes

**Classes:**

#### `CK3LogWatcher`
Main controller for log monitoring

```python
class CK3LogWatcher:
    """Manages CK3 log directory watching and file change detection"""
    
    def __init__(self, server: LanguageServer, analyzer: CK3LogAnalyzer)
    def start(self, log_path: str) -> bool
    def stop(self) -> None
    def pause(self) -> None
    def resume(self) -> None
    def is_running(self) -> bool
    def get_watched_files(self) -> List[str]
```

**Attributes:**
- `server: LanguageServer` - Reference to LSP server for notifications
- `analyzer: CK3LogAnalyzer` - Log analysis engine
- `observer: Observer` - Watchdog observer instance
- `handler: FileSystemEventHandler` - File change event handler
- `last_positions: Dict[str, int]` - Track read positions for incremental reading
- `is_paused: bool` - Pause/resume state
- `watched_path: str` - Current watched directory

#### `CK3LogFileHandler`
Handle file system events

```python
class CK3LogFileHandler(FileSystemEventHandler):
    """Handle file system events for CK3 logs"""
    
    def __init__(self, watcher: CK3LogWatcher)
    def on_modified(self, event: FileSystemEvent) -> None
    def on_created(self, event: FileSystemEvent) -> None
```

**Watched Files:**
- `game.log` - General game events and script execution
- `error.log` - Script errors and warnings
- `exceptions.log` - Critical errors and crashes
- `system.log` - System-level information
- `setup.log` - Game initialization

**Features:**
- Incremental file reading (only new lines)
- Automatic file rotation handling
- Cross-platform path resolution
- Configurable file filters

---

### Component 2: `log_analyzer.py`

**Purpose:** Parse log lines and extract actionable information

**Classes:**

#### `CK3LogAnalyzer`
Core analysis engine with pattern matching

```python
class CK3LogAnalyzer:
    """Analyze CK3 logs and extract structured error information"""
    
    def __init__(self, server: LanguageServer)
    def analyze_line(self, line: str, source_file: str) -> Optional[LogAnalysisResult]
    def analyze_batch(self, lines: List[str], source_file: str) -> List[LogAnalysisResult]
    def register_pattern(self, pattern: ErrorPattern) -> None
    def get_statistics(self) -> LogStatistics
    def reset_statistics(self) -> None
```

**Attributes:**
- `error_patterns: List[ErrorPattern]` - Registered error patterns
- `statistics: LogStatistics` - Accumulated statistics
- `server: LanguageServer` - LSP server reference

#### `ErrorPattern`
Pattern definition for log parsing

```python
@dataclass
class ErrorPattern:
    """Definition of a log error pattern"""
    
    regex: str                          # Pattern to match
    severity: DiagnosticSeverity        # Error, Warning, Info, Hint
    category: str                       # Classification (scope_error, missing_loc, etc.)
    message_template: str               # Format string for user message
    action_type: str                    # Type of code action to generate
    extract_location: bool = True       # Try to extract file/line info
    suggest_fix: bool = True            # Generate quick fix suggestions
```

**Pre-defined Patterns:**

| Category | Pattern | Example |
|----------|---------|---------|
| **Unknown Effect** | `Unknown effect: (\w+)` | `Unknown effect: add_glod` |
| **Unknown Trigger** | `Unknown trigger: (\w+)` | `Unknown trigger: has_triat` |
| **Scope Error** | `Invalid scope.*from (\w+) to (\w+)` | `Invalid scope navigation from character to title` |
| **Missing Event** | `Event ([\w.]+) not found` | `Event my_event.1 not found` |
| **Missing Localization** | `Missing localization key: (\w+)` | `Missing localization key: my_event.1.t` |
| **Undefined Variable** | `Variable ['\"](\w+)['\"] not defined` | `Variable 'my_var' not defined` |
| **Performance Warning** | `Script execution took (\d+)ms.*in event ([\w.]+)` | `Script execution took 120ms in event my_event.1` |
| **Syntax Error** | `Unexpected token ['\"](.*?)['\"]` | `Unexpected token '}'` |
| **Missing File** | `File ['\"]([^'\"]+)['\"] not found` | `File 'events/missing.txt' not found` |

#### `LogAnalysisResult`
Structured result from analysis

```python
@dataclass
class LogAnalysisResult:
    """Result from analyzing a log line"""
    
    severity: DiagnosticSeverity        # Error severity
    category: str                       # Error category
    message: str                        # Human-readable message
    raw_line: str                       # Original log line
    timestamp: datetime                 # When detected
    
    # Source location (if extractable)
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    
    # Extracted data
    extracted_values: Dict[str, str] = field(default_factory=dict)
    
    # Suggestions
    suggestions: List[str] = field(default_factory=list)
    code_action_type: Optional[str] = None
```

#### `LogStatistics`
Aggregate statistics

```python
@dataclass
class LogStatistics:
    """Accumulated statistics from log analysis"""
    
    total_lines_processed: int = 0
    total_errors: int = 0
    total_warnings: int = 0
    total_info: int = 0
    
    errors_by_category: Dict[str, int] = field(default_factory=dict)
    slow_events: Dict[str, List[float]] = field(default_factory=dict)
    most_common_errors: List[Tuple[str, int]] = field(default_factory=list)
    
    start_time: datetime = field(default_factory=datetime.now)
    last_update: datetime = field(default_factory=datetime.now)
```

---

### Component 3: `log_formatter.py`

**Purpose:** Format log output for display in VS Code

**Classes:**

#### `LogFormatter`
Format logs for various output targets

```python
class LogFormatter:
    """Format log entries for display"""
    
    def format_for_output_channel(self, result: LogAnalysisResult) -> str
    def format_for_webview(self, result: LogAnalysisResult) -> dict
    def format_for_notification(self, result: LogAnalysisResult) -> str
    def format_statistics(self, stats: LogStatistics) -> str
```

**Output Formats:**

1. **Output Channel** (simple text):
   ```
   [12:34:56.789] ❌ ERROR: Unknown effect 'add_glod'
   → events/my_event.txt:45
   💡 Did you mean 'add_gold'?
   ```

2. **Webview Panel** (rich HTML):
   ```json
   {
     "timestamp": "2026-01-01T12:34:56.789Z",
     "severity": "error",
     "icon": "❌",
     "message": "Unknown effect 'add_glod'",
     "location": {
       "file": "events/my_event.txt",
       "line": 45,
       "clickable": true
     },
     "suggestion": "Did you mean 'add_gold'?",
     "actionable": true
   }
   ```

3. **Status Bar** (compact):
   ```
   $(pulse) CK3: 3 errors, 12 warnings (last: 2s ago)
   ```

---

### Component 4: `log_diagnostics.py`

**Purpose:** Convert log analysis results to LSP diagnostics

**Classes:**

#### `LogDiagnosticConverter`
Convert logs to LSP diagnostics

```python
class LogDiagnosticConverter:
    """Convert log analysis results to LSP diagnostics"""
    
    def __init__(self, server: LanguageServer, workspace_root: str)
    def convert_to_diagnostic(self, result: LogAnalysisResult) -> Optional[types.Diagnostic]
    def publish_diagnostics(self, uri: str, diagnostics: List[types.Diagnostic]) -> None
    def clear_log_diagnostics(self, uri: str) -> None
    def get_active_diagnostics(self) -> Dict[str, List[types.Diagnostic]]
```

**Diagnostic Generation:**

```python
def convert_to_diagnostic(self, result: LogAnalysisResult) -> Optional[types.Diagnostic]:
    """
    Convert LogAnalysisResult to LSP Diagnostic
    
    Features:
    - Resolve relative file paths to workspace URIs
    - Set appropriate severity level
    - Add custom diagnostic code (e.g., "GAME_LOG_001")
    - Include related information for context
    - Mark as coming from game logs (source="ck3-game-log")
    """
```

**Features:**
- Merge with existing static analysis diagnostics
- Don't override static analysis (game logs are secondary)
- Clear game log diagnostics when logs cleared
- Support "ignore this warning" functionality

---

### Component 5: Server Integration (`server.py`)

**New Commands:**

```python
@server.command("ck3.startLogWatcher")
def start_log_watcher(ls: LanguageServer, args: List) -> dict:
    """
    Start watching CK3 log directory
    
    Args:
        args[0]: Optional log path (auto-detect if not provided)
    
    Returns:
        {"success": bool, "message": str, "watching": List[str]}
    """

@server.command("ck3.stopLogWatcher")
def stop_log_watcher(ls: LanguageServer, args: List) -> dict:
    """Stop watching CK3 logs"""

@server.command("ck3.pauseLogWatcher")
def pause_log_watcher(ls: LanguageServer, args: List) -> dict:
    """Pause log processing (keeps watcher running)"""

@server.command("ck3.resumeLogWatcher")
def resume_log_watcher(ls: LanguageServer, args: List) -> dict:
    """Resume log processing"""

@server.command("ck3.clearGameLogs")
def clear_game_logs(ls: LanguageServer, args: List) -> dict:
    """Clear all game log diagnostics"""

@server.command("ck3.getLogStatistics")
def get_log_statistics(ls: LanguageServer, args: List) -> dict:
    """Get accumulated log statistics"""
```

**New Notifications (Server → Client):**

```python
# Log entry detected
ls.send_notification("ck3/logEntry", {
    "severity": "error",
    "message": "Unknown effect 'add_glod'",
    "location": {"file": "events/my_event.txt", "line": 45},
    "suggestion": "Did you mean 'add_gold'?"
})

# Statistics update
ls.send_notification("ck3/logStats", {
    "errors": 3,
    "warnings": 12,
    "lastUpdate": "2026-01-01T12:34:56Z"
})

# Performance warning
ls.send_notification("ck3/performanceWarning", {
    "event": "my_event.1",
    "duration_ms": 120,
    "threshold_ms": 50
})
```

---

## VS Code Extension Integration

### New Files:

```
vscode-extension/src/
├── logPanel.ts              # NEW - Webview panel for logs
├── logWatcher.ts            # NEW - Client-side log watcher controller
└── logCommands.ts           # NEW - Command implementations
```

### Modified Files:

```
vscode-extension/src/
├── extension.ts             # Add log watcher initialization
├── logger.ts                # Add GameLogs category
└── package.json             # Add new commands and configuration
```

### New Commands (Extension):

- `ck3LanguageServer.startLogWatcher` - Start watching logs
- `ck3LanguageServer.stopLogWatcher` - Stop watching logs
- `ck3LanguageServer.showLogPanel` - Show interactive log panel
- `ck3LanguageServer.clearLogs` - Clear log display
- `ck3LanguageServer.showLogStatistics` - Show statistics dashboard

### New Configuration:

```json
{
  "ck3LanguageServer.logWatcher.enabled": {
    "type": "boolean",
    "default": false,
    "description": "Enable CK3 game log monitoring"
  },
  "ck3LanguageServer.logWatcher.path": {
    "type": "string",
    "default": "",
    "description": "Path to CK3 logs directory (auto-detected if empty)"
  },
  "ck3LanguageServer.logWatcher.autoStart": {
    "type": "boolean",
    "default": false,
    "description": "Automatically start watching logs on extension activation"
  },
  "ck3LanguageServer.logWatcher.watchedFiles": {
    "type": "array",
    "default": ["game.log", "error.log", "exceptions.log"],
    "description": "Which log files to monitor"
  },
  "ck3LanguageServer.logWatcher.publishDiagnostics": {
    "type": "boolean",
    "default": true,
    "description": "Publish game log errors as LSP diagnostics"
  },
  "ck3LanguageServer.logWatcher.performanceThreshold": {
    "type": "number",
    "default": 50,
    "description": "Report events slower than this many milliseconds"
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Days 1-2)
- [ ] Add `watchdog` dependency to `pyproject.toml`
- [ ] Create `log_watcher.py` with basic file monitoring
- [ ] Implement incremental file reading
- [ ] Add platform-specific log path detection
- [ ] Test file watching on Linux/Windows/macOS

**Deliverable:** Basic log file monitoring working

### Phase 2: Pattern Analysis (Days 3-4)
- [ ] Create `log_analyzer.py` with pattern matching
- [ ] Define error patterns for common CK3 errors
- [ ] Implement location extraction from log lines
- [ ] Add suggestion generation (typo corrections, similar names)
- [ ] Test pattern matching with sample logs

**Deliverable:** Pattern recognition and error extraction working

### Phase 3: LSP Integration (Days 5-6)
- [ ] Create `log_diagnostics.py` for diagnostic conversion
- [ ] Integrate with server.py (commands, notifications)
- [ ] Add code actions for log-based errors
- [ ] Implement diagnostic merging with static analysis
- [ ] Test end-to-end flow (log → diagnostic → editor)

**Deliverable:** Game logs appear as diagnostics in VS Code

### Phase 4: VS Code Extension (Days 7-8)
- [ ] Create log panel webview (HTML/CSS/JavaScript)
- [ ] Add log category to logger system
- [ ] Implement notification handlers
- [ ] Add commands (start/stop/clear/stats)
- [ ] Add configuration options

**Deliverable:** Interactive log panel in VS Code

### Phase 5: Performance Analytics (Days 9-10)
- [ ] Add performance tracking to analyzer
- [ ] Create statistics aggregation
- [ ] Build statistics dashboard view
- [ ] Add performance suggestions
- [ ] Test with real CK3 sessions

**Deliverable:** Performance analytics and reporting

### Phase 6: Polish & Testing (Days 11-12)
- [ ] Comprehensive unit tests for all components
- [ ] Integration tests with mock logs
- [ ] Performance testing (memory usage, CPU impact)
- [ ] Documentation (wiki pages, README updates)
- [ ] User testing with real mods

**Deliverable:** Production-ready feature

---

## Testing Strategy

### Unit Tests

**`tests/test_log_watcher.py`:**
- File system event detection
- Incremental reading
- Pause/resume functionality
- Error handling

**`tests/test_log_analyzer.py`:**
- Pattern matching accuracy
- Location extraction
- Suggestion generation
- Statistics tracking

**`tests/test_log_diagnostics.py`:**
- Diagnostic conversion
- URI resolution
- Diagnostic merging
- Clear operations

### Integration Tests

**`tests/integration/test_log_flow.py`:**
- End-to-end: log file → diagnostic → editor
- Multiple files simultaneously
- File rotation handling
- Performance under load

### Fixtures

```
tests/fixtures/logs/
├── sample_game.log          # Sample game logs with various errors
├── sample_error.log         # Sample error logs
├── sample_exceptions.log    # Sample exception logs
└── performance.log          # Sample performance data
```

---

## Performance Considerations

### Memory Management
- **Incremental reading**: Only read new lines, don't load entire files
- **Bounded queues**: Limit queue size to prevent memory growth
- **Periodic cleanup**: Clear old diagnostics and statistics

### CPU Usage
- **Efficient patterns**: Use compiled regex patterns
- **Batch processing**: Process multiple lines together
- **Debouncing**: Don't process every single character change

### Disk I/O
- **Minimal reads**: Only read when files actually change
- **Buffered I/O**: Use buffered file reading
- **Smart polling**: watchdog uses OS-native events (inotify, FSEvents)

### Expected Impact
- **CPU**: <1% idle, <5% during active logging
- **Memory**: ~10-20 MB for watcher + analysis
- **Disk I/O**: Minimal (only on file changes)

---

## Configuration & User Experience

### Auto-Detection

```python
def detect_ck3_log_path() -> Optional[str]:
    """
    Auto-detect CK3 log directory based on platform
    
    Returns:
        Path to logs directory or None if not found
    """
    import platform
    from pathlib import Path
    
    system = platform.system()
    
    paths = {
        "Windows": Path.home() / "Documents" / "Paradox Interactive" / "Crusader Kings III" / "logs",
        "Linux": Path.home() / ".local" / "share" / "Paradox Interactive" / "Crusader Kings III" / "logs",
        "Darwin": Path.home() / "Documents" / "Paradox Interactive" / "Crusader Kings III" / "logs"
    }
    
    path = paths.get(system)
    return str(path) if path and path.exists() else None
```

### First-Time Setup

1. Extension activates
2. If `autoStart` enabled, try to auto-detect log path
3. If found, show notification: "CK3 logs detected at [path]. Start monitoring?"
4. If not found, show info message with setup instructions
5. User can manually configure path in settings

### Status Indicators

- **Status Bar**: Show watching state and error count
- **Output Channel**: Stream logs in real-time
- **Problems Panel**: Show diagnostics
- **Log Panel**: Interactive rich view

---

## Error Handling

### Graceful Degradation

```python
# If log path doesn't exist
- Don't crash
- Log warning to output channel
- Show user-friendly message
- Allow manual path configuration

# If watchdog not installed
- Disable log watcher feature
- Show installation instructions
- Continue with other features

# If log files are locked
- Retry with exponential backoff
- Skip locked files temporarily
- Log issue for user awareness

# If pattern matching fails
- Continue processing other patterns
- Log parsing error (not user error)
- Don't block other functionality
```

### User Notifications

```python
# Informational
- "Log watching started for: [path]"
- "3 errors detected in last 10 seconds"

# Warnings
- "Log file access temporarily unavailable"
- "Performance degradation detected (120ms event)"

# Errors (non-blocking)
- "Failed to access log directory"
- "Pattern parsing error (internal)"
```

---

## Documentation Requirements

### Wiki Pages

1. **Log Watcher Guide** (`Log-Watcher.md`)
   - Overview and benefits
   - Setup instructions
   - Configuration options
   - Troubleshooting

2. **Log Analysis Patterns** (`Log-Analysis-Patterns.md`)
   - List of detected patterns
   - Example errors and fixes
   - How to interpret results

3. **Performance Monitoring** (`Performance-Monitoring.md`)
   - How performance tracking works
   - Interpreting statistics
   - Optimization tips

### README Updates

- Add log watcher to feature list
- Include screenshot of log panel
- Link to detailed wiki documentation

### Inline Documentation

- Comprehensive docstrings for all classes/methods
- Type hints throughout
- Usage examples in docstrings

---

## Future Enhancements (v2.0+)

### Advanced Features
- [ ] Machine learning for error prediction
- [ ] Event flow visualization (interactive graph)
- [ ] Mod conflict detection and resolution
- [ ] Historical log analysis (analyze old sessions)
- [ ] Export reports (PDF/HTML)

### Integration Features
- [ ] GitHub issue creation from logs
- [ ] Discord webhook notifications
- [ ] Steam Workshop integration
- [ ] Multiplayer session log aggregation

### Analytics Features
- [ ] Comparative analysis (before/after changes)
- [ ] Benchmark tracking over time
- [ ] A/B testing support for event performance
- [ ] Automated regression detection

---

## Success Metrics

### Technical Metrics
- **Accuracy**: >95% correct pattern matching
- **Performance**: <100ms analysis latency
- **Reliability**: <0.1% false positives
- **Stability**: No crashes in 100 hours of use

### User Metrics
- **Time Saved**: Average 30%+ reduction in debug time
- **Error Detection**: 90%+ of errors caught in logs
- **Adoption**: 50%+ of users enable feature

---

## Dependencies

### Python Dependencies
```toml
[project]
dependencies = [
    "pygls>=2.0.0",
    "pyyaml>=6.0",
    "watchdog>=3.0.0",  # NEW - File system monitoring
]
```

### Development Dependencies
```toml
[project.optional-dependencies]
dev = [
    # ... existing dev dependencies ...
    "pytest-mock>=3.12.0",  # For mocking file system events
]
```

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Log format changes** | High | Medium | Flexible pattern system, version detection |
| **File locking issues** | Medium | Low | Retry logic, fallback to periodic polling |
| **Performance impact** | Medium | Low | Profiling, optimization, configurable throttling |
| **Platform differences** | Medium | Medium | Comprehensive cross-platform testing |
| **Pattern false positives** | Medium | Low | Extensive testing, user feedback loop |

### User Experience Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Setup complexity** | Medium | Medium | Auto-detection, clear instructions |
| **Information overload** | Medium | Medium | Filtering, severity levels, clear UI |
| **Feature discovery** | Low | High | Documentation, in-editor hints |

---

## Rollout Plan

### Beta Testing (Week 1-2)
1. Release to select users
2. Gather feedback on patterns and accuracy
3. Monitor performance metrics
4. Fix critical issues

### Soft Launch (Week 3)
1. Merge to main branch
2. Include in next minor release
3. Feature flag disabled by default
4. Documentation published

### Full Release (Week 4+)
1. Enable by default for new users
2. Add to marketing materials
3. Create tutorial video
4. Monitor adoption metrics

---

## Conclusion

The CK3 Live Log Analysis feature will provide significant value to modders by bringing real-time game feedback directly into their development environment. This implementation plan ensures a robust, performant, and user-friendly solution that integrates seamlessly with the existing pychivalry architecture.

**Estimated Timeline**: 12 development days
**Estimated LOC**: ~1,500 lines of production code, ~800 lines of tests
**Breaking Changes**: None (purely additive feature)

---

**Next Steps:**
1. Review and approve plan
2. Begin Phase 1 implementation
3. Set up tracking for success metrics
4. Schedule regular check-ins during development
