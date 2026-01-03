# Debugging LSP Server Issues

**Purpose:** Comprehensive guide for troubleshooting Language Server Protocol server issues in pychivalry.

**Use this when:** LSP server is not starting, crashing, not responding, or behaving incorrectly.

---

## Quick Diagnostics

### 1. Check Server Status

In VS Code:
1. Open Output panel (View → Output)
2. Select "CK3 Language Server" from dropdown
3. Look for startup messages or errors

### 2. Enable Verbose Logging

Add to VS Code settings (`.vscode/settings.json`):
```json
{
  "ck3LanguageServer.trace.server": "verbose"
}
```

Restart VS Code and check Output panel for detailed logs.

### 3. Verify Installation

```bash
# Check Python version
python --version  # Should be 3.9+

# Check pychivalry is installed
python -c "import pychivalry; print(pychivalry.__version__)"

# Test server directly
python -m pychivalry.server --version
```

## Common Issues and Solutions

### Server Not Starting

**Symptom:** No LSP features working, no output in Output panel

**Possible Causes:**

1. **Python not found**
   ```json
   // Set correct Python path in settings
   {
     "ck3LanguageServer.pythonPath": "/path/to/python"
   }
   ```

2. **pychivalry not installed**
   ```bash
   pip install -e .
   # Or
   pip install pychivalry
   ```

3. **Wrong Python environment**
   ```bash
   # Ensure you're in the correct virtual environment
   which python
   # Should point to environment with pychivalry
   ```

4. **Extension not activated**
   - Check that `.txt` files trigger activation
   - Open a CK3 script file
   - Run command: "CK3 Language Server: Restart"

**Debug Steps:**

1. Check VS Code Developer Tools (Help → Toggle Developer Tools)
2. Look for extension errors in Console tab
3. Try starting server manually:
   ```bash
   python -m pychivalry.server
   ```
4. Check if server process is running:
   ```bash
   ps aux | grep pychivalry
   ```

### Server Crashes on Startup

**Symptom:** Server starts then immediately exits

**Check Output panel for errors:**

**Error: "ModuleNotFoundError"**
```bash
# Missing dependency
pip install -e ".[dev]"
```

**Error: "ImportError"**
```bash
# Check all dependencies installed
pip list | grep -E "pygls|pyyaml"
```

**Error: "SyntaxError"**
- Python version too old
- Check: `python --version` (need 3.9+)

**Debug with direct execution:**
```bash
# Run server with verbose output
python -m pychivalry.server --log-level DEBUG
```

### Server Crashes During Operation

**Symptom:** Server works initially, then crashes

**Common Causes:**

1. **Unhandled exception in handler**
   - Check Output panel for traceback
   - Look for the failing LSP method
   - Fix exception in handler code

2. **Memory leak**
   ```bash
   # Monitor memory usage
   python -m memory_profiler server.py
   ```

3. **Infinite loop**
   - Check for recursive calls
   - Add timeout to expensive operations

**Debug Steps:**

1. Enable Python logging:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. Add exception handlers:
   ```python
   @server.feature(TEXT_DOCUMENT_COMPLETION)
   async def completion(params):
       try:
           # handler code
       except Exception as e:
           logger.exception("Completion failed")
           return None
   ```

3. Use Python debugger:
   ```python
   import pdb; pdb.set_trace()
   ```

### Features Not Working

**Symptom:** Server running but completions/hover/etc. not working

**Diagnostics:**

1. **Check server capabilities**
   - Look at initialization in Output panel
   - Verify capabilities are advertised

2. **Check if handler is registered**
   ```python
   # Ensure decorator is present
   @server.feature(TEXT_DOCUMENT_COMPLETION)
   async def completion_handler(params):
       pass
   ```

3. **Test handler directly**
   ```python
   # Create test
   @pytest.mark.asyncio
   async def test_completion():
       server = CK3LanguageServer()
       result = await completion_handler(server, test_params)
       assert result is not None
   ```

4. **Check LSP protocol**
   - Use VS Code LSP Inspector
   - Help → Toggle Developer Tools → Console
   - Filter for LSP messages

### Diagnostics Not Appearing

**Symptom:** No errors shown in Problems panel

**Check:**

1. **Is validation enabled?**
   ```python
   # Ensure publishDiagnostics is called
   server.publish_diagnostics(uri, diagnostics)
   ```

2. **Are diagnostics generated?**
   ```python
   # Add logging
   logger.info(f"Generated {len(diagnostics)} diagnostics")
   ```

3. **Check diagnostic format**
   ```python
   # Must be proper LSP Diagnostic objects
   from lsprotocol.types import Diagnostic, Range, Position
   
   diag = Diagnostic(
       range=Range(
           start=Position(line=0, character=0),
           end=Position(line=0, character=10)
       ),
       message="Error message",
       severity=DiagnosticSeverity.Error
   )
   ```

4. **Test validation directly**
   ```python
   validator = DiagnosticsEngine()
   diags = validator.validate(document)
   print(diags)
   ```

### Slow Performance

**Symptom:** Features work but are very slow

**Profile the code:**

```python
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# Run the slow operation
result = slow_function()

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(30)
```

**Common bottlenecks:**

1. **Reparsing entire document**
   - Implement caching
   - Use incremental parsing

2. **Expensive validation**
   - Debounce validation
   - Run validators in background

3. **Large file handling**
   - Limit validation scope
   - Use streaming

4. **Synchronous operations**
   - Use async/await
   - Don't block event loop

**Monitor with:**
```python
import time

@functools.wraps(func)
async def timed(func):
    start = time.perf_counter()
    result = await func(*args, **kwargs)
    elapsed = time.perf_counter() - start
    logger.info(f"{func.__name__}: {elapsed:.3f}s")
    return result
```

### Document Synchronization Issues

**Symptom:** Server has stale document content

**Check:**

1. **didOpen/didChange events**
   - Log document updates
   - Verify version numbers

2. **Document cache**
   ```python
   # Check document store
   document = server.workspace.get_document(uri)
   print(f"Version: {document.version}")
   print(f"Content length: {len(document.source)}")
   ```

3. **URI format**
   - Must be `file:///path/to/file`
   - Check for mismatches

### Communication Issues

**Symptom:** Client and server not communicating

**Debug:**

1. **Check stdio/socket**
   ```python
   # Server uses stdio by default
   if __name__ == "__main__":
       server.start_io()  # Ensure this is called
   ```

2. **Check client configuration**
   ```typescript
   // In extension.ts
   const serverOptions = {
       command: pythonPath,
       args: ["-m", "pychivalry.server"],
       // Ensure correct
   };
   ```

3. **Monitor messages**
   - Enable verbose logging on both sides
   - Check for request/response pairs

## Debugging Tools

### VS Code Developer Tools

1. Help → Toggle Developer Tools
2. Console tab: JavaScript errors
3. Network tab: LSP messages
4. Sources tab: Set breakpoints in extension code

### Python Debugger

```python
# Add to server code
import debugpy
debugpy.listen(5678)
print("Waiting for debugger...")
debugpy.wait_for_client()
```

Then attach VS Code debugger to port 5678.

### LSP Inspector

1. Install "LSP Inspector" extension
2. View all LSP traffic
3. Inspect requests and responses

### Logging

```python
import logging

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('lsp_server.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Use throughout code
logger.debug("Processing completion request")
logger.info("Server started successfully")
logger.warning("Document not found in cache")
logger.error("Validation failed", exc_info=True)
```

## Testing Checklist

When debugging, systematically check:

- [ ] Python version is 3.9+
- [ ] pychivalry is installed correctly
- [ ] Extension is activated (open a .txt file)
- [ ] Server process is running (check process list)
- [ ] No errors in Output panel
- [ ] Verbose logging is enabled
- [ ] Server capabilities are advertised
- [ ] LSP methods are registered
- [ ] Document is opened in server
- [ ] URI format is correct
- [ ] No exceptions in handlers
- [ ] Diagnostics are properly formatted
- [ ] Performance is acceptable

## Getting Help

If issues persist:

1. **Gather information:**
   - Python version: `python --version`
   - VS Code version
   - Extension version
   - Operating system
   - Full error messages from Output panel
   - Steps to reproduce

2. **Create minimal reproduction:**
   - Simple CK3 script that triggers the issue
   - Minimal configuration

3. **Check existing issues:**
   - GitHub issues
   - Documentation

4. **Report the bug:**
   - Provide all gathered information
   - Include logs
   - Describe expected vs actual behavior

## Quick Reference

```bash
# Restart server
Command Palette → "CK3 Language Server: Restart"

# Check logs
View → Output → "CK3 Language Server"

# Test server
python -m pychivalry.server --version

# Run tests
pytest tests/ -v

# Enable debug logging
# Add to settings.json:
"ck3LanguageServer.trace.server": "verbose"
```
