# Debugging LSP Server Issues

**Purpose:** Comprehensive guide for troubleshooting Language Server Protocol server issues in the CK3 Language Support extension.

**Use this when:** LSP server is not starting, crashing, not responding, or behaving incorrectly.

---

## Quick Diagnostics

### 1. Check Server Status

In VS Code:
1. Open Output panel (View -> Output)
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
# Check Node.js version
node --version  # Should be 18+

# Verify extension builds
cd vscode-extension
npm run compile

# Run unit tests
npm run test:unit
```

## Common Issues and Solutions

### Server Not Starting

**Symptom:** No LSP features working, no output in Output panel

**Possible Causes:**

1. **Extension not compiled**
   ```bash
   cd vscode-extension
   npm run compile
   ```

2. **Dependencies not installed**
   ```bash
   cd vscode-extension
   npm install
   ```

3. **Extension not activated**
   - Check that CK3 script files trigger activation
   - Open a CK3 script file
   - Run command: "CK3 Language Server: Restart"

**Debug Steps:**

1. Check VS Code Developer Tools (Help -> Toggle Developer Tools)
2. Look for extension errors in Console tab
3. Verify the server bundle exists:
   ```bash
   ls vscode-extension/dist/server-main.js
   ```

### Server Crashes on Startup

**Symptom:** Server starts then immediately exits

**Check Output panel for errors:**

**Error: Missing module**
```bash
cd vscode-extension
npm install
npm run compile
```

**Debug with direct execution:**
```bash
# Check TypeScript compilation
cd vscode-extension
npx tsc --noEmit
```

### Server Crashes During Operation

**Symptom:** Server works initially, then crashes

**Common Causes:**

1. **Unhandled exception in handler**
   - Check Output panel for stack traces
   - Look for the failing LSP method
   - Fix exception in handler code

2. **Memory leak**
   - Monitor memory usage in VS Code Developer Tools
   - Check for unbounded caches or document references

3. **Infinite loop**
   - Check for recursive calls
   - Add timeout to expensive operations

**Debug Steps:**

1. Enable verbose server logging:
   ```json
   {
     "ck3LanguageServer.trace.server": "verbose"
   }
   ```

2. Add error logging in handler code:
   ```typescript
   import { logger } from '../utils/logger';

   function handleRequest(params: RequestParams): Result | null {
       try {
           // handler code
       } catch (e) {
           logger.error('Request failed', e);
           return null;
       }
   }
   ```

3. Use VS Code debugger:
   - Set breakpoints in server code
   - Use "Attach to Server" launch configuration

### Features Not Working

**Symptom:** Server running but completions/hover/etc. not working

**Diagnostics:**

1. **Check server capabilities**
   - Look at initialization in Output panel
   - Verify capabilities are advertised

2. **Check if handler is registered**
   ```typescript
   // Ensure capability is declared in server.ts
   connection.onCompletion((params) => {
       return completionProvider.provide(params);
   });
   ```

3. **Test handler directly**
   ```typescript
   // Create a unit test
   describe('CompletionProvider', () => {
       it('should provide completions', () => {
           const provider = new CompletionProvider();
           const result = provider.provide(testDocument, testPosition);
           assert.ok(result !== null);
       });
   });
   ```

4. **Check LSP protocol**
   - Use VS Code LSP Inspector
   - Help -> Toggle Developer Tools -> Console
   - Filter for LSP messages

### Diagnostics Not Appearing

**Symptom:** No errors shown in Problems panel

**Check:**

1. **Is validation enabled?**
   ```typescript
   // Ensure publishDiagnostics is called
   connection.sendDiagnostics({ uri, diagnostics });
   ```

2. **Are diagnostics generated?**
   ```typescript
   // Add logging
   logger.info(`Generated ${diagnostics.length} diagnostics`);
   ```

3. **Check diagnostic format**
   ```typescript
   import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver/node';

   const diag: Diagnostic = {
       range: {
           start: { line: 0, character: 0 },
           end: { line: 0, character: 10 },
       },
       message: 'Error message',
       severity: DiagnosticSeverity.Error,
   };
   ```

4. **Test validation directly**
   ```typescript
   const engine = new DiagnosticsEngine();
   const diags = engine.validate(document);
   console.log(diags);
   ```

### Slow Performance

**Symptom:** Features work but are very slow

**Profile the code:**

Use the VS Code Performance tab or Node.js inspector:

```bash
# Start server with inspector
node --inspect dist/server-main.js
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
```typescript
function timed<T>(label: string, fn: () => T): T {
    const start = process.hrtime.bigint();
    const result = fn();
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(`${label}: ${elapsed.toFixed(3)}ms`);
    return result;
}
```

### Document Synchronization Issues

**Symptom:** Server has stale document content

**Check:**

1. **didOpen/didChange events**
   - Log document updates
   - Verify version numbers

2. **Document cache**
   ```typescript
   // Check document store
   const document = documents.get(uri);
   logger.info(`Version: ${document?.version}`);
   logger.info(`Content length: ${document?.getText().length}`);
   ```

3. **URI format**
   - Must be `file:///path/to/file`
   - Check for mismatches

### Communication Issues

**Symptom:** Client and server not communicating

**Debug:**

1. **Check server transport**
   ```typescript
   // Server uses Node IPC by default
   const connection = createConnection(ProposedFeatures.all);
   ```

2. **Check client configuration**
   ```typescript
   // In extension.ts
   const serverModule = context.asAbsolutePath(path.join('dist', 'server-main.js'));
   const serverOptions: ServerOptions = {
       run: { module: serverModule, transport: TransportKind.ipc },
       debug: { module: serverModule, transport: TransportKind.ipc },
   };
   ```

3. **Monitor messages**
   - Enable verbose logging on both sides
   - Check for request/response pairs

## Debugging Tools

### VS Code Developer Tools

1. Help -> Toggle Developer Tools
2. Console tab: JavaScript errors
3. Network tab: LSP messages
4. Sources tab: Set breakpoints in extension code

### Node.js Debugger

Use the VS Code launch configuration to attach to the server:

```json
{
    "name": "Attach to Server",
    "type": "node",
    "request": "attach",
    "port": 6009,
    "restart": true,
    "outFiles": ["${workspaceFolder}/dist/**/*.js"]
}
```

### LSP Inspector

1. Install "LSP Inspector" extension
2. View all LSP traffic
3. Inspect requests and responses

### Logging

```typescript
import { logger } from '../utils/logger';

// Use throughout code
logger.debug('Processing completion request');
logger.info('Server started successfully');
logger.warn('Document not found in cache');
logger.error('Validation failed', error);
```

## Testing Checklist

When debugging, systematically check:

- [ ] Node.js version is 18+
- [ ] Dependencies installed (`npm install`)
- [ ] Extension compiles (`npm run compile`)
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Extension is activated (open a CK3 script file)
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
   - Node.js version: `node --version`
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
Command Palette -> "CK3 Language Server: Restart"

# Check logs
View -> Output -> "CK3 Language Server"

# Verify build
cd vscode-extension && npm run compile

# Run tests
npm run test:unit

# Enable debug logging
# Add to settings.json:
"ck3LanguageServer.trace.server": "verbose"
```
