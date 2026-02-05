# Hybrid Architecture Proposal: TypeScript + Python

## Problem Statement

We're manually reimplementing 45,000+ lines of Python code into TypeScript. After significant effort, we've completed only **10.6%** (3,607 / 34,141 lines). At this pace, it will take **10-14 more weeks** to reach feature parity.

**The existing Python implementation already works perfectly and has all features!**

## Current Status

### What We've Built (TypeScript)
- ✅ LSP protocol infrastructure (connection, sync, routing)
- ✅ Basic parser (650 lines)
- ✅ Basic indexer (340 lines)
- ✅ YAML data loader (620 lines)
- ✅ Some validation (1,971 lines - only 14% of Python's validation)
- ✅ Basic LSP features (completions, hover, etc.)

### What We're Missing (TypeScript)
- ❌ 86% of validation logic (11,723 lines)
- ❌ Advanced diagnostics
- ❌ Localization system (2,400 lines)
- ❌ Log integration (2,400 lines)
- ❌ Schema system (80%)
- ❌ Deep indexing
- ❌ Cross-file analysis

### What Python Has (Already Working!)
- ✅ **ALL** validation logic (13,694 lines)
- ✅ **ALL** diagnostics
- ✅ **ALL** localization features
- ✅ **ALL** log integration
- ✅ **ALL** schema validation
- ✅ **ALL** advanced features
- ✅ **Tested and proven** in production

## Proposed Solution: Hybrid Architecture

Instead of reimplementing everything, **use both servers strategically**:

### Architecture

```
┌─────────────────────────────────────────────────┐
│            VS Code Extension                     │
│  ┌───────────────────────────────────────────┐  │
│  │   Server Selection & Management           │  │
│  │  • Choose: TypeScript, Python, or Hybrid  │  │
│  │  • Spawn appropriate server(s)            │  │
│  │  • Route requests intelligently           │  │
│  └───────────────────────────────────────────┘  │
└──────────────┬────────────────┬─────────────────┘
               │                │
       ┌───────▼──────┐  ┌─────▼──────────┐
       │  TypeScript  │  │  Python Server │
       │    Server    │  │   (pygls)      │
       │  (Node.js)   │  │                │
       └──────────────┘  └────────────────┘
```

### Strategy Options

#### Option 1: TypeScript Primary, Python Fallback (Recommended)
**Best for: Zero Python dependency for basic features**

- TypeScript handles:
  - LSP protocol & connection
  - Basic syntax highlighting
  - Simple completions
  - Basic hover
  - Document parsing
  
- Python handles (if installed):
  - Deep validation (all 13,694 lines)
  - Advanced diagnostics
  - Localization analysis
  - Log integration
  - Schema validation

**User Experience:**
- Install extension → Works immediately (TypeScript)
- Install Python package → Full features unlock
- Graceful degradation if Python not available

**Implementation:**
```typescript
class HybridLanguageServer {
  private tsServer: TypeScriptServer;
  private pyServer?: PythonServerProxy;
  
  async initialize() {
    // Always start TS server
    this.tsServer = new TypeScriptServer();
    
    // Try to find Python server
    this.pyServer = await PythonServerProxy.tryConnect();
    
    if (this.pyServer) {
      console.log("Full features enabled (Python validation)");
    } else {
      console.log("Basic features only (Python not found)");
    }
  }
  
  async getDiagnostics(doc: TextDocument) {
    // Get basic diagnostics from TypeScript
    const tsDiagnostics = await this.tsServer.validate(doc);
    
    // Get deep validation from Python (if available)
    const pyDiagnostics = this.pyServer 
      ? await this.pyServer.validate(doc)
      : [];
    
    // Merge and deduplicate
    return [...tsDiagnostics, ...pyDiagnostics];
  }
}
```

#### Option 2: Python Primary, TypeScript for Performance
**Best for: Maximum features, gradual TypeScript migration**

- Python handles everything initially
- TypeScript gradually takes over features
- Hot-swap between implementations

**Configuration:**
```json
{
  "ck3LanguageServer.features": {
    "completion": "typescript",     // Fast, simple
    "hover": "typescript",          // Fast, simple  
    "validation": "python",         // Complex, comprehensive
    "localization": "python",       // Complex
    "logWatcher": "python"          // Complex
  }
}
```

#### Option 3: Side-by-Side Comparison Mode
**Best for: Development and testing**

- Run both servers
- Compare results
- Verify TypeScript parity
- Debug differences

### Benefits

1. **Immediate Full Functionality**
   - Users get all 45,000 lines of Python features NOW
   - No waiting 10-14 weeks for reimplementation

2. **Zero Python Dependency for Basic Use**
   - TypeScript handles essential features
   - Works out of the box
   - Python enhances but isn't required

3. **Gradual Migration Path**
   - Port features from Python → TypeScript as needed
   - No rush, no pressure
   - Focus on high-value features first

4. **Validation Testing**
   - Use Python as ground truth
   - Test TypeScript implementations against it
   - Ensure 100% accuracy

5. **Performance Optimization**
   - TypeScript handles fast, simple features
   - Python handles complex, slow features
   - Best of both worlds

6. **Risk Mitigation**
   - Python is proven and stable
   - TypeScript can't break what works
   - Fallback always available

### Implementation Plan

#### Phase 1: Hybrid Infrastructure (1 week)
- [ ] Create PythonServerProxy class
- [ ] Implement server discovery
- [ ] Add inter-process communication
- [ ] Implement feature routing
- [ ] Add configuration options

#### Phase 2: Integration (1 week)
- [ ] Route validation to Python
- [ ] Route localization to Python
- [ ] Route log watching to Python
- [ ] Keep TS for basic features
- [ ] Test hybrid mode

#### Phase 3: Feature Parity Testing (ongoing)
- [ ] Compare TS vs Python results
- [ ] Port high-priority features to TS
- [ ] Verify accuracy
- [ ] Gradually reduce Python dependency

### Configuration

```json
{
  "ck3LanguageServer.mode": "hybrid",  // "typescript" | "python" | "hybrid"
  
  "ck3LanguageServer.pythonPath": "auto",  // Path to Python interpreter
  
  "ck3LanguageServer.featureRouting": {
    "basic": "typescript",      // completion, hover, symbols
    "validation": "python",     // complex diagnostics
    "localization": "python",   // localization analysis
    "logs": "python"            // log integration
  },
  
  "ck3LanguageServer.fallback": {
    "enabled": true,           // Fallback to TS if Python fails
    "showWarning": true        // Warn about limited features
  }
}
```

### User Experience

**Scenario 1: Python Not Installed**
```
✓ Extension activated
✓ Basic features available (TypeScript)
  - Syntax highlighting
  - Basic completions (500+ items)
  - Basic hover
  - Go-to-definition
  - Document symbols
  
ℹ️ Install pychivalry Python package for:
  - Deep validation (50+ diagnostic types)
  - Localization analysis
  - Log integration
  - Advanced completions
```

**Scenario 2: Python Installed**
```
✓ Extension activated
✓ Python server detected
✓ Full features enabled
  - All TypeScript features
  - All Python features (45,000 lines!)
  - Deep validation
  - Localization analysis
  - Log integration
```

## Comparison: Manual Port vs Hybrid

| Aspect | Manual Port | Hybrid Architecture |
|--------|-------------|---------------------|
| Time to Full Features | 10-14 weeks | 1-2 weeks |
| Lines to Write | 30,000+ | ~500 |
| Risk | High (bugs in new code) | Low (reuse proven code) |
| Python Dependency | None | Optional |
| Basic Features | Immediate | Immediate |
| Advanced Features | 10-14 weeks | Immediate |
| Maintenance | High | Medium |
| Performance | Native TS | Mixed (mostly native) |
| Feature Parity | Uncertain | Guaranteed |

## Recommendation

**Implement Option 1: TypeScript Primary, Python Fallback**

### Why?
1. ✅ Gets all features working **immediately** (1-2 weeks)
2. ✅ Keeps TypeScript benefits (no Python for basic use)
3. ✅ Leverages existing 45,000 lines of working code
4. ✅ Allows gradual migration at our own pace
5. ✅ Reduces risk (Python is proven)
6. ✅ Better user experience (full features now!)

### Migration Path
- Week 1-2: Implement hybrid architecture
- Week 3+: Port features gradually, starting with high-value ones
- No deadline pressure - port when it makes sense
- Python validation as ground truth for testing

## Questions?

**Q: Doesn't this defeat the purpose of TypeScript migration?**
A: No! We still get TypeScript benefits for basic features (no Python install needed). We're just being pragmatic about the 86% of validation logic we haven't ported yet.

**Q: What about the Python dependency?**
A: It's optional. Extension works without it (basic features). Python enhances it (advanced features). User chooses based on needs.

**Q: How do we ensure TypeScript parity?**
A: Use Python as ground truth. Run both, compare results, verify accuracy. Port carefully with validation.

**Q: What's the long-term goal?**
A: Gradually port everything to TypeScript, but no rush. We can take our time and do it right, while users have full features today.

## Next Steps

1. **Decision**: Approve hybrid architecture approach
2. **Implementation**: Build PythonServerProxy and routing (1 week)
3. **Testing**: Verify hybrid mode works correctly (1 week)
4. **Release**: Ship with full features immediately
5. **Gradual Port**: Migrate features over time as makes sense

## Conclusion

Manual reimplementation is technically impressive but **impractical**:
- 10-14 weeks to completion
- High risk of bugs
- Users wait for features that already exist

Hybrid architecture is **pragmatic**:
- 1-2 weeks to full features
- Low risk (reuse proven code)
- Users get everything immediately
- We can still port to TypeScript gradually

**Let's be smart about this. Use what we have. Port what makes sense. Ship value today.**
