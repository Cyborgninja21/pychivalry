# CK3 Game Log Watcher - User Guide

## Overview

The CK3 Game Log Watcher provides real-time monitoring and analysis of Crusader Kings 3 game logs, surfacing scripting errors and warnings directly in VS Code as you test your mods.

## Features

### Real-Time Error Detection
- **Automatic Monitoring**: Watches `game.log` for new entries as you play
- **Pattern Matching**: Detects 10 common error types with intelligent pattern recognition
- **LSP Integration**: Errors appear as diagnostics (squiggly lines) in the Problems panel
- **Live Output**: View raw log entries in the GameLogs output channel

### Error Types Detected

1. **Unknown Effects/Triggers** (`CK3-LOG-001`)
   - Detects typos in effect and trigger names
   - Provides fuzzy-matched suggestions for corrections

2. **Scope Mismatches** (`CK3-LOG-002`)
   - Identifies effects used in wrong scope contexts
   - Example: Using character effect on title scope

3. **Missing Files** (`CK3-LOG-003`)
   - Detects references to non-existent files
   - Helps catch broken asset paths

4. **Invalid Syntax** (`CK3-LOG-004`)
   - Catches parsing errors in script files
   - Reports malformed brackets, quotes, etc.

5. **Script Errors** (`CK3-LOG-005`)
   - General scripting mistakes
   - Logic errors and runtime issues

6. **Localization Missing** (`CK3-LOG-006`)
   - Identifies missing loc keys
   - Helps ensure all text is localized

7. **Performance Warnings** (`CK3-LOG-007`)
   - Flags potentially slow operations
   - Suggests optimization opportunities

8. **Duplicate Definitions** (`CK3-LOG-008`)
   - Detects conflicting IDs
   - Prevents mod conflicts

9. **Invalid References** (`CK3-LOG-009`)
   - Catches broken cross-references
   - Example: Events calling non-existent events

10. **Unknown Errors** (`CK3-LOG-999`)
    - Captures other error patterns
    - Ensures nothing slips through

## Usage

### Starting the Watcher

**Method 1: Command Palette**
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: `CK3: Start Game Log Watcher`

**Method 2: Automatic**
- Enable `ck3LanguageServer.logWatcher.autoStart` in settings
- Watcher starts automatically when opening a CK3 workspace

### Viewing Logs

**GameLogs Output Channel:**
- Shows timestamped log entries with severity icons
- Color-coded by severity: 🔴 Error, ⚠️ Warning, 🔵 Info
- Access via: View → Output → Select "GameLogs" channel

**Problems Panel:**
- All detected errors appear as diagnostics
- Click to jump to problematic code
- Shows suggested fixes when available

### Controls

| Command | Description |
|---------|-------------|
| Start Game Log Watcher | Begin monitoring game logs |
| Stop Game Log Watcher | Stop monitoring and clear diagnostics |
| Pause Game Log Watcher | Temporarily pause without clearing |
| Resume Game Log Watcher | Resume after pause |
| Clear Game Log Diagnostics | Remove all log-based diagnostics |
| Show Game Log Statistics | Display accumulated statistics |

### Statistics View

Run `CK3: Show Game Log Statistics` to see:
- Total log entries processed
- Error/warning/info breakdown
- Most common error types
- Processing performance metrics
- Timestamp of last update

## Configuration

### Settings

Access via Settings → Extensions → CK3 Language Server

#### `ck3LanguageServer.logWatcher.enabled`
- **Type**: boolean
- **Default**: `true`
- **Description**: Master toggle for log watcher feature

#### `ck3LanguageServer.logWatcher.autoStart`
- **Type**: boolean
- **Default**: `false`
- **Description**: Auto-start watcher when opening CK3 workspace

#### `ck3LanguageServer.logWatcher.logPath`
- **Type**: string
- **Default**: `""` (auto-detect)
- **Description**: Custom log directory path
- **Platforms**:
  - Windows: `%USERPROFILE%\Documents\Paradox Interactive\Crusader Kings III\logs`
  - Linux: `~/.local/share/Paradox Interactive/Crusader Kings III/logs`
  - macOS: `~/Documents/Paradox Interactive/Crusader Kings III/logs`

#### `ck3LanguageServer.logWatcher.showInOutput`
- **Type**: boolean
- **Default**: `true`
- **Description**: Display log entries in GameLogs channel

#### `ck3LanguageServer.logWatcher.maxLogSize`
- **Type**: number
- **Default**: `100` MB
- **Range**: 10-1000 MB
- **Description**: Maximum log file size to process

#### `ck3LanguageServer.logWatcher.debounceDelay`
- **Type**: number
- **Default**: `500` ms
- **Range**: 100-5000 ms
- **Description**: Delay before processing changes (reduces CPU load)

#### `ck3LanguageServer.logWatcher.patterns`
- **Type**: array of objects
- **Default**: `[]`
- **Description**: Custom error detection patterns

**Example custom pattern:**
```json
{
  "ck3LanguageServer.logWatcher.patterns": [
    {
      "pattern": "\\[MyMod\\] Error: (.+)",
      "severity": "error",
      "message": "MyMod Error: {0}"
    }
  ]
}
```

## Workflow Integration

### Development Cycle

1. **Start Watcher** before launching CK3
2. **Edit Scripts** in VS Code
3. **Save Changes** to trigger reloads
4. **Test in Game** by loading save/triggering events
5. **View Errors** in Problems panel or GameLogs
6. **Fix Issues** by clicking diagnostic links
7. **Repeat** until clean

### Best Practices

- **Keep Watcher Running**: Leave it active during entire modding session
- **Clear Periodically**: Use "Clear Game Log Diagnostics" to reset between test runs
- **Check Statistics**: Monitor error counts to track progress
- **Use Output Channel**: Raw logs provide additional context not captured by diagnostics
- **Pause for Performance**: Pause watcher when not actively testing to save resources

### Troubleshooting

**Watcher Not Starting:**
- Verify log path exists (check game has been launched at least once)
- Try manual path configuration if auto-detection fails
- Check `ck3LanguageServer.logWatcher.enabled` is `true`

**No Diagnostics Appearing:**
- Ensure `showInOutput` is enabled to verify logs are being processed
- Check GameLogs channel for raw log entries
- Verify patterns are matching (some errors may not be recognized yet)

**High CPU Usage:**
- Increase `debounceDelay` to reduce processing frequency
- Lower `maxLogSize` to process less historical data
- Pause watcher when not testing

**Missing Errors:**
- Add custom patterns for mod-specific errors
- Report unrecognized patterns as feature requests
- Check that file paths in logs match workspace files

## Performance

### Benchmarks
- **Startup**: < 1 second
- **Processing**: ~1000 lines/second
- **Memory**: < 50 MB overhead
- **CPU**: < 5% during active logging

### Optimization Tips
- Use larger debounce delay for slower machines
- Reduce max log size on systems with limited memory
- Pause watcher when running performance-sensitive tests
- Clear old diagnostics regularly to maintain responsiveness

## Advanced Usage

### Custom Error Patterns

Define project-specific patterns in workspace settings:

```json
{
  "ck3LanguageServer.logWatcher.patterns": [
    {
      "pattern": "\\[error\\] .*?(\\w+\\.txt):(\\d+): (.+)",
      "severity": "error",
      "message": "{2}"
    },
    {
      "pattern": "\\[warning\\] Performance: (.+)",
      "severity": "warning", 
      "message": "Performance: {0}"
    }
  ]
}
```

**Capture Groups:**
- `{0}` - First capture group
- `{1}` - Second capture group
- `{n}` - Nth capture group

### Integration with CI/CD

The log analyzer can be scripted for automated testing:

```python
from pychivalry.log_analyzer import CK3LogAnalyzer

analyzer = CK3LogAnalyzer()
with open('game.log') as f:
    results = analyzer.analyze_logs(f.readlines())
    
if results.errors:
    print(f"Found {len(results.errors)} errors!")
    sys.exit(1)
```

## Feedback & Contributions

Found a common error pattern we're missing? Submit an issue with:
- Example log line
- Expected diagnostic behavior
- Suggested message/fix

Want to contribute patterns? See `pychivalry/log_analyzer.py` for implementation details.

## See Also

- [Implementation Plan](LOG_WATCHER_PLAN.md)
- [CK3 Event Modding Guide](workspace/CK3_EVENT_MODDING.md)
- [Validation Documentation](workspace/VALIDATION.md)
