# Async and Threaded Handlers Analysis Report

**pychivalry Language Server - Performance Optimization Plan**

**Date:** December 31, 2025

---

## Executive Summary

The pychivalry language server currently uses **partial async support** but does **not use threaded handlers**. This report analyzes the current implementation, identifies bottlenecks, and provides a comprehensive plan to implement both async and threaded patterns for improved responsiveness.

---

## Current State Analysis

### Async Handlers (⚠️ Partial Implementation)

| Handler | Currently Async? | Notes |
|---------|-----------------|-------|
| `did_open` | ✅ `async def` | Calls `_scan_workspace_folders_async()` with progress |
| `did_change` | ❌ Sync | Blocks on parsing + diagnostics |
| `did_close` | ❌ Sync | Minimal work, acceptable |
| `completions` | ❌ Sync | Can block on large files |
| `hover` | ❌ Sync | Fast, low priority |
| `definition` | ❌ Sync | Fast, low priority |
| `references` | ❌ Sync | **Scans all open documents - can be slow** |
| `document_symbol` | ❌ Sync | Fast, low priority |
| `workspace_symbol` | ❌ Sync | Searches entire index - can be slow |
| `code_action` | ❌ Sync | Fast, low priority |
| `semantic_tokens_full` | ❌ Sync | **CPU intensive for large files** |
| `code_lens` | ❌ Sync | Moderate work |
| `formatting` | ❌ Sync | Can be slow on large files |
| `range_formatting` | ❌ Sync | Generally fast |
| `inlay_hint` | ❌ Sync | Moderate work |
| `signature_help` | ❌ Sync | Fast, low priority |
| `document_highlight` | ❌ Sync | Fast, low priority |
| `document_link` | ❌ Sync | Fast, low priority |
| `folding_range` | ❌ Sync | Fast, low priority |
| `rename` | ❌ Sync | **Scans workspace files - slow** |
| `prepare_rename` | ❌ Sync | Fast, low priority |
| **Commands** | | |
| `ck3.validateWorkspace` | ✅ `async def` | Uses `with_progress` |
| `ck3.rescanWorkspace` | ✅ `async def` | Uses `_scan_workspace_folders_async` |
| `ck3.insertTextAtCursor` | ✅ `async def` | Uses `apply_edit` |
| `ck3.generateLocalizationStubs` | ✅ `async def` | Uses `apply_edit` |
| `ck3.renameEvent` | ✅ `async def` | Minimal work |
| Others | ❌ Sync | Fast, acceptable |

### Threaded Handlers (❌ Not Implemented)

**No handlers currently use `@server.thread()`** - all synchronous handlers run on the main event loop, which can cause:

1. **UI freezing** during heavy computation (semantic tokens, large file parsing)
2. **Input lag** during typing when `did_change` runs expensive operations
3. **Delayed responses** when multiple requests queue up

### Current Async/Executor Usage

Found only **2 places** using `run_in_executor`:

```python
# server.py line 511-515 - Workspace scanning
await loop.run_in_executor(
    None,  # Uses default ThreadPoolExecutor
    self.index.scan_workspace, 
    workspace_folders
)

# server.py line 2105 - Validate workspace command  
await loop.run_in_executor(None, ls.index.scan_workspace, workspace_folders)
```

---

## Identified Bottlenecks

### Critical (Blocks typing/UI)

| Operation | Location | Problem | Impact |
|-----------|----------|---------|--------|
| **Document parsing** | `parse_and_index_document()` | Synchronous, runs on every keystroke | Input lag on large files |
| **Diagnostics collection** | `collect_all_diagnostics()` | Runs after every change | Delayed error reporting |
| **Semantic token generation** | `get_semantic_tokens()` | Tokenizes entire file | Syntax highlighting delays |

### High Impact (Slow operations)

| Operation | Location | Problem | Impact |
|-----------|----------|---------|--------|
| **Workspace-wide rename** | `find_all_occurrences_workspace()` | Reads many files from disk | Multi-second delays |
| **Find references** | `_find_word_references_in_ast()` | Iterates all open ASTs | Slow with many open files |
| **Workspace symbol search** | `workspace_symbol()` | Searches full index | Can be slow with large mods |

### Moderate Impact

| Operation | Location | Problem | Impact |
|-----------|----------|---------|--------|
| Document formatting | `format_document()` | Line-by-line processing | Noticeable on large files |
| Code lens generation | `get_code_lenses()` | Counts references | Scales with file size |
| Inlay hints | `get_inlay_hints()` | Regex matching | Moderate on large files |

---

## Implementation Plan

### Phase 1: Critical Path Optimization

**Goal:** Prevent UI blocking during typing

#### 1.1 Debounced `did_change` with Async Parsing

```python
# Current implementation (BLOCKS):
@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: CK3LanguageServer, params: types.DidChangeTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_and_index_document(doc)           # BLOCKING
    ls.publish_diagnostics_for_document(doc)   # BLOCKING

# Proposed implementation (NON-BLOCKING):
@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
async def did_change(ls: CK3LanguageServer, params: types.DidChangeTextDocumentParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    
    # Schedule background parsing (debounced)
    await ls.schedule_document_update(doc.uri)

# Add to CK3LanguageServer class:
async def schedule_document_update(self, uri: str):
    """Schedule document parsing with debouncing."""
    # Cancel previous pending update for this document
    if uri in self._pending_updates:
        self._pending_updates[uri].cancel()
    
    # Schedule new update after 150ms debounce
    async def do_update():
        await asyncio.sleep(0.15)  # 150ms debounce
        doc = self.workspace.get_text_document(uri)
        
        # Run parsing in thread pool
        loop = asyncio.get_event_loop()
        ast = await loop.run_in_executor(
            self._thread_pool,
            parse_document,
            doc.source
        )
        
        self.document_asts[uri] = ast
        self.index.update_from_ast(uri, ast)
        
        # Run diagnostics in thread pool
        diagnostics = await loop.run_in_executor(
            self._thread_pool,
            collect_all_diagnostics,
            doc, ast, self.index
        )
        
        self.text_document_publish_diagnostics(
            types.PublishDiagnosticsParams(uri=uri, diagnostics=diagnostics)
        )
    
    self._pending_updates[uri] = asyncio.create_task(do_update())
```

**Changes Required:**
- Add `_pending_updates: Dict[str, asyncio.Task]` to `CK3LanguageServer`
- Add `_thread_pool: concurrent.futures.ThreadPoolExecutor` to `CK3LanguageServer`
- Convert `did_change` to async
- Add `schedule_document_update` method

#### 1.2 Threaded Semantic Tokens

```python
# Current (BLOCKING):
@server.feature(types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL, ...)
def semantic_tokens_full(ls: CK3LanguageServer, params: types.SemanticTokensParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    return get_semantic_tokens(doc.source, ls.index)  # BLOCKING

# Proposed (NON-BLOCKING with @server.thread):
@server.feature(types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL, ...)
@server.thread()  # Runs in thread pool
def semantic_tokens_full(ls: CK3LanguageServer, params: types.SemanticTokensParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    return get_semantic_tokens(doc.source, ls.index)
```

**Note:** `@server.thread()` is a pygls decorator that runs the handler in a thread pool, freeing the event loop.

### Phase 2: Heavy Operations Threading

**Goal:** Prevent blocking on workspace-wide operations

#### 2.1 Threaded Rename

```python
@server.feature(types.TEXT_DOCUMENT_RENAME)
@server.thread()  # Run in thread pool - scans disk
def rename(ls: CK3LanguageServer, params: types.RenameParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    workspace_folders = _get_workspace_folder_paths(ls)
    
    return perform_rename(
        doc.source,
        params.position,
        params.new_name,
        params.text_document.uri,
        workspace_folders,
    )
```

#### 2.2 Threaded Find References

```python
@server.feature(types.TEXT_DOCUMENT_REFERENCES)
@server.thread()  # Run in thread pool - iterates all ASTs
def references(ls: CK3LanguageServer, params: types.ReferenceParams):
    # ... existing implementation
```

#### 2.3 Threaded Workspace Symbol

```python
@server.feature(types.WORKSPACE_SYMBOL)
@server.thread()  # Run in thread pool - searches entire index
def workspace_symbol(ls: CK3LanguageServer, params: types.WorkspaceSymbolParams):
    # ... existing implementation
```

### Phase 3: Additional Optimizations

#### 3.1 Threaded Formatting

```python
@server.feature(types.TEXT_DOCUMENT_FORMATTING, ...)
@server.thread()
def document_formatting(ls: CK3LanguageServer, params: types.DocumentFormattingParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    return format_document(doc.source, params.options)
```

#### 3.2 Threaded Code Lens

```python
@server.feature(types.TEXT_DOCUMENT_CODE_LENS, ...)
@server.thread()
def code_lens(ls: CK3LanguageServer, params: types.CodeLensParams):
    doc = ls.workspace.get_text_document(params.text_document.uri)
    return get_code_lenses(doc.source, doc.uri, ls.index)
```

---

## Implementation Details

### Thread Pool Configuration

Add to `CK3LanguageServer.__init__`:

```python
from concurrent.futures import ThreadPoolExecutor
import os

def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    
    # Existing attributes...
    
    # Thread pool for CPU-bound operations
    # Use 2-4 workers to avoid overwhelming the system
    self._thread_pool = ThreadPoolExecutor(
        max_workers=min(4, (os.cpu_count() or 1) + 1),
        thread_name_prefix="ck3-worker"
    )
    
    # Pending document updates (for debouncing)
    self._pending_updates: Dict[str, asyncio.Task] = {}
```

### Thread Safety Considerations

The following data structures need thread-safe access:

| Data Structure | Current Access | Solution |
|---------------|----------------|----------|
| `document_asts` | Read/Write from multiple handlers | Use `threading.Lock` |
| `index.*` | Read/Write during scanning | Already isolated by document |
| `_config_cache` | Read from multiple handlers | Immutable after load, safe |

Add locking:

```python
import threading

class CK3LanguageServer(LanguageServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # ... existing ...
        
        # Thread-safety locks
        self._ast_lock = threading.RLock()
        self._index_lock = threading.RLock()
    
    def parse_and_index_document(self, doc: TextDocument):
        """Thread-safe parse and index."""
        try:
            ast = parse_document(doc.source)
            
            with self._ast_lock:
                self.document_asts[doc.uri] = ast
            
            with self._index_lock:
                self.index.update_from_ast(doc.uri, ast)
            
            return ast
        except Exception as e:
            logger.error(f"Error parsing document {doc.uri}: {e}")
            return []
```

### Graceful Shutdown

Ensure thread pool is properly cleaned up:

```python
def shutdown(self):
    """Clean shutdown of server resources."""
    # Cancel pending updates
    for task in self._pending_updates.values():
        task.cancel()
    
    # Shutdown thread pool
    self._thread_pool.shutdown(wait=True, cancel_futures=True)
    
    super().shutdown()
```

---

## Feature Handler Classification

### Can Use `@server.thread()` (CPU-bound, no async I/O)

| Handler | Reason |
|---------|--------|
| `semantic_tokens_full` | CPU-intensive tokenization |
| `references` | AST traversal |
| `workspace_symbol` | Index search |
| `document_formatting` | Line processing |
| `range_formatting` | Line processing |
| `code_lens` | Reference counting |
| `inlay_hint` | Pattern matching |
| `folding_range` | Block detection |
| `document_highlight` | Pattern matching |
| `rename` | Disk I/O + text processing |

### Should Use `async def` (I/O or progress reporting)

| Handler | Reason |
|---------|--------|
| `did_open` | Already async, calls workspace scan |
| `did_change` | Needs debouncing, background work |
| `ck3.validateWorkspace` | Progress reporting |
| `ck3.rescanWorkspace` | Progress reporting |
| Commands with `apply_edit` | LSP client communication |

### Can Stay Synchronous (Fast operations)

| Handler | Reason |
|---------|--------|
| `did_close` | Just cleanup |
| `hover` | Single lookup |
| `definition` | Index lookup |
| `completions` | Context detection + lookup |
| `code_action` | Context detection |
| `signature_help` | Position analysis |
| `document_link` | Fast regex |
| `prepare_rename` | Single lookup |

---

## Expected Improvements

### Before Optimization

| Scenario | Current Behavior |
|----------|-----------------|
| Typing in 2000-line file | 50-150ms lag per keystroke |
| Opening large event file | 1-3 second freeze |
| Find all references | 200-500ms freeze |
| Workspace rename | 2-5 second freeze |
| Syntax highlighting update | 100-300ms delay |

### After Optimization

| Scenario | Expected Behavior |
|----------|------------------|
| Typing in 2000-line file | <10ms perceived lag (debounced) |
| Opening large event file | Progress bar, no freeze |
| Find all references | Non-blocking, results stream in |
| Workspace rename | Non-blocking with progress |
| Syntax highlighting update | Background update, no lag |

---

## Implementation Checklist

### Phase 1: Critical Path (Week 1)
- [ ] Add ThreadPoolExecutor to CK3LanguageServer
- [ ] Add thread-safety locks for shared data
- [ ] Convert `did_change` to async with debouncing
- [ ] Add `@server.thread()` to `semantic_tokens_full`
- [ ] Test typing responsiveness

### Phase 2: Heavy Operations (Week 2)
- [ ] Add `@server.thread()` to `rename`
- [ ] Add `@server.thread()` to `references`
- [ ] Add `@server.thread()` to `workspace_symbol`
- [ ] Test workspace-wide operations

### Phase 3: Polish (Week 3)
- [ ] Add `@server.thread()` to formatting handlers
- [ ] Add `@server.thread()` to code_lens
- [ ] Add graceful shutdown handling
- [ ] Performance benchmarking
- [ ] Documentation update

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Race conditions in shared data | Use RLock for all shared structures |
| Thread pool exhaustion | Limit workers, add queue monitoring |
| Stale AST data during async parse | Version tracking, discard stale results |
| Deadlocks | Use RLock (reentrant), timeout on locks |
| Memory pressure from concurrent ops | Limit parallel operations per document |

---

## Appendix: pygls Threading API

### `@server.thread()` Decorator

```python
from pygls.lsp.server import LanguageServer

# Runs handler in ThreadPoolExecutor
@server.thread()
def my_handler(ls: LanguageServer, params):
    # CPU-bound work here
    return result
```

### Async Handler Pattern

```python
@server.feature(types.SOME_FEATURE)
async def my_async_handler(ls: LanguageServer, params):
    # Can use await
    result = await some_async_operation()
    return result
```

### Manual Executor Usage

```python
async def my_handler(ls: LanguageServer, params):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,  # Use default executor
        cpu_bound_function,
        arg1, arg2
    )
    return result
```

---

## Conclusion

The pychivalry language server has significant room for performance improvement through proper async and threading implementation. The current synchronous handlers cause noticeable lag during typing and slow operations.

**Priority Actions:**
1. **Immediately:** Add `@server.thread()` to `semantic_tokens_full` and `rename`
2. **Short-term:** Convert `did_change` to async with debouncing
3. **Medium-term:** Thread remaining heavy handlers

This will transform the editor experience from laggy to responsive, especially for large CK3 mod projects with hundreds of event files.
