# Server.py Refactoring Plan

## Executive Summary

This document outlines the implementation plan for refactoring the monolithic `server.py` file (3,665 lines) into a modular, maintainable architecture. The refactoring will improve code organization, reduce merge conflicts, enhance testability, and make feature development more efficient.

**Current State:** Single 3,665-line file containing:
- Server core class (~600 lines)
- 16+ LSP feature handlers (~2,000 lines)
- 12+ custom commands (~1,000 lines)
- Utility functions and infrastructure (~200 lines)

**Target State:** Modular package structure with:
- Clear separation of concerns
- Logical file organization (5-10 files per package)
- Maximum file size ~300 lines
- Easy navigation and maintenance

**Benefits:**
- **Developer Efficiency**: Find and modify features quickly
- **Reduced Conflicts**: Multiple developers can work simultaneously
- **Better Testing**: Unit test individual components
- **Clear Dependencies**: Explicit imports reveal coupling
- **Easier Onboarding**: New contributors understand structure faster

---

## Current Problems

### 1. Navigation Difficulty
Finding specific features requires searching through 3,665 lines. Related code is scattered throughout the file.

### 2. Merge Conflicts
Multiple developers editing `server.py` causes frequent conflicts, especially when working on different LSP features.

### 3. Testing Challenges
Cannot easily test individual handlers in isolation. Tests must import the entire server module.

### 4. Unclear Boundaries
Related functionality (e.g., all completion logic) is mixed with unrelated code, making it hard to understand dependencies.

### 5. Cognitive Load
Understanding any single feature requires holding the entire file structure in memory.

---

## Proposed Architecture

### New Module Structure

```
pychivalry/
├── server.py                      # NEW - Main entry point (~100 lines)
├── server_core.py                 # NEW - Core server class (~600 lines)
│
├── lsp_handlers/                  # NEW - LSP protocol handlers package
│   ├── __init__.py               # Re-export all handlers
│   ├── document_lifecycle.py     # Open, change, close handlers (~200 lines)
│   ├── navigation.py             # Completion, hover, definition, references (~400 lines)
│   ├── symbols.py                # Document/workspace symbols (~300 lines)
│   ├── editing.py                # Formatting, rename, code actions (~400 lines)
│   ├── presentation.py           # Semantic tokens, inlay hints, code lens (~400 lines)
│   └── utility.py                # Links, folding, signature help (~300 lines)
│
├── commands/                      # NEW - Custom workspace commands package
│   ├── __init__.py               # Re-export all commands
│   ├── workspace_commands.py     # Validate, rescan, stats (~200 lines)
│   ├── event_commands.py         # Event generation, chains, rename (~300 lines)
│   ├── localization_commands.py  # Loc stubs, orphaned keys (~200 lines)
│   └── log_commands.py           # Log watcher control (~200 lines)
│
├── server_utils.py                # NEW - Shared utilities (~150 lines)
│   ├── configure_logging()
│   ├── get_workspace_folder_paths()
│   └── Other shared helpers
│
└── [existing modules remain unchanged]
    ├── parser.py
    ├── diagnostics.py
    ├── completions.py
    └── ...
```

---

## Detailed Module Specifications

### Module 1: `server.py` (Main Entry Point)

**Purpose:** Slim main file that wires everything together

**Size:** ~100 lines

**Responsibilities:**
- Import and instantiate `CK3LanguageServer` from `server_core`
- Register all LSP handlers from `lsp_handlers/`
- Register all commands from `commands/`
- Provide `main()` entry point for CLI execution

**Structure:**
```python
"""
Main entry point for CK3 Language Server.
Wires together all components and starts the server.
"""

from .server_core import CK3LanguageServer
from .server_utils import configure_logging
from . import lsp_handlers
from . import commands

# Create server instance
server = CK3LanguageServer("ck3-language-server", "v0.1.0")

# Register all LSP handlers
lsp_handlers.register_all(server)

# Register all commands
commands.register_all(server)

def main():
    """Start the language server"""
    import argparse
    # ... argument parsing
    configure_logging(args.log_level)
    server.start_io()

if __name__ == "__main__":
    main()
```

**Benefits:**
- Clear overview of what the server does
- Easy to see all registered features
- Simple to add/remove handlers
- Clean entry point for testing

---

### Module 2: `server_core.py` (Server Class)

**Purpose:** Core `CK3LanguageServer` class with state management

**Size:** ~600 lines

**Responsibilities:**
- Extend `pygls.LanguageServer`
- Document AST tracking (thread-safe)
- Cross-document indexing
- Threading infrastructure (ThreadPoolExecutor, locks)
- Async document update scheduling with debouncing
- AST content hash caching (LRU)
- Progress reporting helpers
- Configuration management
- Workspace scanning coordination
- Log watcher component initialization

**Key Classes:**
```python
class CK3LanguageServer(LanguageServer):
    """Extended language server with CK3-specific state and optimizations"""
    
    def __init__(self, *args, **kwargs)
    
    # Thread-safe document access
    def get_ast(self, uri: str) -> List[CK3Node]
    def set_ast(self, uri: str, ast: List[CK3Node])
    def remove_ast(self, uri: str)
    
    # Adaptive debouncing
    def get_adaptive_debounce_delay(self, source: str) -> float
    
    # AST caching by content hash
    def get_cached_ast(self, source: str) -> Optional[List[CK3Node]]
    def cache_ast(self, source: str, ast: List[CK3Node])
    def get_or_parse_ast(self, source: str) -> List[CK3Node]
    
    # Server communication
    def notify_info(self, message: str)
    def notify_warning(self, message: str)
    def notify_error(self, message: str)
    async def with_progress(self, title: str, task_func, cancellable: bool)
    
    # Configuration
    async def get_user_configuration(self, section: str) -> Dict[str, Any]
    def get_cached_config(self, key: str, default: Any) -> Any
    
    # Workspace edits
    async def apply_edit(self, edit: types.WorkspaceEdit, label: Optional[str]) -> bool
    def create_text_edit(...) -> types.WorkspaceEdit
    
    # Document updates
    async def schedule_document_update(self, uri: str, doc_source: str)
    
    # Lifecycle
    def shutdown(self)
```

**Thread Safety:**
- `_ast_lock`: Protects `document_asts` dictionary
- `_index_lock`: Protects cross-document index
- `_ast_cache_lock`: Protects LRU AST cache
- All public methods use appropriate locks

**Migration Notes:**
- Move entire `CK3LanguageServer` class definition
- Keep all threading infrastructure
- Keep all optimization code (caching, debouncing)
- Remove handler decorators (move to handler modules)

---

### Module 3: `lsp_handlers/` Package

**Purpose:** All LSP protocol feature handlers organized by category

#### 3.1: `document_lifecycle.py`

**Size:** ~200 lines

**Handlers:**
- `@server.feature(TEXT_DOCUMENT_DID_OPEN)` → `did_open()`
- `@server.feature(TEXT_DOCUMENT_DID_CHANGE)` → `did_change()`
- `@server.feature(TEXT_DOCUMENT_DID_CLOSE)` → `did_close()`
- `@server.feature(TEXT_DOCUMENT_DID_SAVE)` → `did_save()` (if added)

**Pattern:**
```python
"""Document lifecycle handlers (open, change, close)"""

from lsprotocol import types
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..server_core import CK3LanguageServer

def register(server: 'CK3LanguageServer'):
    """Register all document lifecycle handlers"""
    
    @server.feature(types.TEXT_DOCUMENT_DID_OPEN)
    async def did_open(ls: 'CK3LanguageServer', params):
        # Implementation here
        pass
    
    @server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
    async def did_change(ls: 'CK3LanguageServer', params):
        # Implementation here
        pass
    
    # ... more handlers
```

#### 3.2: `navigation.py`

**Size:** ~400 lines

**Handlers:**
- `TEXT_DOCUMENT_COMPLETION` → `completions()`
- `TEXT_DOCUMENT_HOVER` → `hover()`
- `TEXT_DOCUMENT_DEFINITION` → `definition()`
- `TEXT_DOCUMENT_REFERENCES` → `references()`
- `TEXT_DOCUMENT_DOCUMENT_HIGHLIGHT` → `document_highlight()`

**Helper Functions:**
- `_find_word_references_in_ast()`

#### 3.3: `symbols.py`

**Size:** ~300 lines

**Handlers:**
- `TEXT_DOCUMENT_DOCUMENT_SYMBOL` → `document_symbol()`
- `WORKSPACE_SYMBOL` → `workspace_symbol()`

**Helper Functions:**
- `_extract_symbol_from_node()`

#### 3.4: `editing.py`

**Size:** ~400 lines

**Handlers:**
- `TEXT_DOCUMENT_FORMATTING` → `document_formatting()`
- `TEXT_DOCUMENT_RANGE_FORMATTING` → `range_formatting()`
- `TEXT_DOCUMENT_CODE_ACTION` → `code_action()`
- `TEXT_DOCUMENT_PREPARE_RENAME` → `prepare_rename()`
- `TEXT_DOCUMENT_RENAME` → `rename()`

#### 3.5: `presentation.py`

**Size:** ~400 lines

**Handlers:**
- `TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL` → `semantic_tokens_full()`
- `TEXT_DOCUMENT_INLAY_HINT` → `inlay_hint()`
- `INLAY_HINT_RESOLVE` → `inlay_hint_resolve()`
- `TEXT_DOCUMENT_CODE_LENS` → `code_lens()`
- `CODE_LENS_RESOLVE` → `code_lens_resolve()`

#### 3.6: `utility.py`

**Size:** ~300 lines

**Handlers:**
- `TEXT_DOCUMENT_SIGNATURE_HELP` → `signature_help()`
- `TEXT_DOCUMENT_DOCUMENT_LINK` → `document_link()`
- `DOCUMENT_LINK_RESOLVE` → `document_link_resolve()`
- `TEXT_DOCUMENT_FOLDING_RANGE` → `folding_range()`

**Helper Functions:**
- `_get_workspace_folder_paths()`

#### 3.7: `__init__.py` (Package Entry)

**Size:** ~50 lines

**Purpose:** Provide unified registration function

```python
"""LSP protocol handlers package"""

from . import (
    document_lifecycle,
    navigation,
    symbols,
    editing,
    presentation,
    utility,
)

def register_all(server):
    """Register all LSP handlers with the server"""
    document_lifecycle.register(server)
    navigation.register(server)
    symbols.register(server)
    editing.register(server)
    presentation.register(server)
    utility.register(server)
```

---

### Module 4: `commands/` Package

**Purpose:** All custom workspace commands organized by domain

#### 4.1: `workspace_commands.py`

**Size:** ~200 lines

**Commands:**
- `@server.command("ck3.validateWorkspace")` → `validate_workspace_command()`
- `@server.command("ck3.rescanWorkspace")` → `rescan_workspace_command()`
- `@server.command("ck3.getWorkspaceStats")` → `get_workspace_stats_command()`
- `@server.command("ck3.checkDependencies")` → `check_dependencies_command()`

#### 4.2: `event_commands.py`

**Size:** ~300 lines

**Commands:**
- `@server.command("ck3.generateEventTemplate")` → `generate_event_template_command()`
- `@server.command("ck3.showEventChain")` → `show_event_chain_command()`
- `@server.command("ck3.showNamespaceEvents")` → `show_namespace_events_command()`
- `@server.command("ck3.renameEvent")` → `rename_event_command()`

#### 4.3: `localization_commands.py`

**Size:** ~200 lines

**Commands:**
- `@server.command("ck3.findOrphanedLocalization")` → `find_orphaned_localization_command()`
- `@server.command("ck3.generateLocalizationStubs")` → `generate_localization_stubs_command()`
- `@server.command("ck3.insertTextAtCursor")` → `insert_text_at_cursor_command()`

#### 4.4: `log_commands.py`

**Size:** ~200 lines

**Commands:**
- `@server.command("ck3.startLogWatcher")` → `start_log_watcher_command()`
- `@server.command("ck3.stopLogWatcher")` → `stop_log_watcher_command()`
- `@server.command("ck3.pauseLogWatcher")` → `pause_log_watcher_command()`
- `@server.command("ck3.resumeLogWatcher")` → `resume_log_watcher_command()`
- `@server.command("ck3.clearGameLogs")` → `clear_game_logs_command()`
- `@server.command("ck3.getLogStatistics")` → `get_log_statistics_command()`

#### 4.5: `__init__.py` (Package Entry)

**Size:** ~40 lines

```python
"""Custom workspace commands package"""

from . import (
    workspace_commands,
    event_commands,
    localization_commands,
    log_commands,
)

def register_all(server):
    """Register all custom commands with the server"""
    workspace_commands.register(server)
    event_commands.register(server)
    localization_commands.register(server)
    log_commands.register(server)
```

---

### Module 5: `server_utils.py` (Shared Utilities)

**Purpose:** Common utility functions used across modules

**Size:** ~150 lines

**Functions:**
```python
def configure_logging(level: str = "info") -> None:
    """Configure logging for the language server"""
    pass

def get_workspace_folder_paths(ls: LanguageServer) -> List[str]:
    """Extract workspace folder paths from language server"""
    pass

def uri_to_path(uri: str) -> str:
    """Convert file:// URI to filesystem path"""
    pass

def path_to_uri(path: str) -> str:
    """Convert filesystem path to file:// URI"""
    pass
```

---

## Implementation Phases

### Phase 1: Extract Server Core ✓
**Goal:** Move `CK3LanguageServer` class to `server_core.py`

**Steps:**
1. Create `pychivalry/server_core.py`
2. Copy `CK3LanguageServer` class definition (without handler decorators)
3. Copy `configure_logging()` temporarily (will move to utils later)
4. Update `server.py` to import from `server_core`
5. Run tests to verify nothing broke
6. Commit: "refactor: extract CK3LanguageServer to server_core.py"

**Validation:**
- All tests pass
- Server starts without errors
- Basic LSP features work (hover, completion)

**Time Estimate:** 1-2 hours

---

### Phase 2: Create LSP Handlers Package ✓
**Goal:** Extract LSP handlers into organized package

**Steps:**
1. Create `pychivalry/lsp_handlers/` directory
2. Create `__init__.py` with registration infrastructure
3. Create `document_lifecycle.py` and move 3 handlers
4. Test that document open/change/close still works
5. Create remaining handler modules one at a time:
   - `navigation.py`
   - `symbols.py`
   - `editing.py`
   - `presentation.py`
   - `utility.py`
6. Update `server.py` imports
7. Remove handler code from old `server.py`
8. Commit: "refactor: organize LSP handlers into package"

**Validation:**
- All LSP features continue to work
- No regression in functionality
- Clean imports in main server.py

**Time Estimate:** 3-4 hours

---

### Phase 3: Create Commands Package ✓
**Goal:** Extract custom commands into organized package

**Steps:**
1. Create `pychivalry/commands/` directory
2. Create `__init__.py` with registration infrastructure
3. Create `workspace_commands.py` and move 4 commands
4. Test that workspace commands execute correctly
5. Create remaining command modules:
   - `event_commands.py`
   - `localization_commands.py`
   - `log_commands.py`
6. Update `server.py` imports
7. Remove command code from old `server.py`
8. Commit: "refactor: organize commands into package"

**Validation:**
- All commands execute successfully
- Command palette shows all commands
- No missing command registrations

**Time Estimate:** 2-3 hours

---

### Phase 4: Extract Utilities ✓
**Goal:** Create shared utilities module

**Steps:**
1. Create `pychivalry/server_utils.py`
2. Move `configure_logging()` from server_core
3. Move `_get_workspace_folder_paths()` from handlers
4. Add URI conversion utilities
5. Update imports across all modules
6. Commit: "refactor: create server_utils module"

**Validation:**
- All imports resolve correctly
- Utility functions work as expected

**Time Estimate:** 1 hour

---

### Phase 5: Simplify Main Server ✓
**Goal:** Reduce main `server.py` to minimal entry point

**Steps:**
1. Remove all implementation code from `server.py`
2. Keep only:
   - Imports
   - Server instantiation
   - Handler registration calls
   - `main()` function
3. Update module docstring
4. Verify final structure
5. Commit: "refactor: simplify main server.py entry point"

**Final server.py structure:**
```python
"""
Main entry point for CK3 Language Server.
Wires together all components and starts the server.
"""

from .server_core import CK3LanguageServer, server
from .server_utils import configure_logging
from . import lsp_handlers
from . import commands

# Register all handlers and commands
lsp_handlers.register_all(server)
commands.register_all(server)

def main():
    """Start the language server"""
    # ... minimal main function
    pass

if __name__ == "__main__":
    main()
```

**Validation:**
- Server starts correctly
- All features work end-to-end
- Documentation is clear

**Time Estimate:** 30 minutes

---

### Phase 6: Update Documentation & Tests ✓
**Goal:** Ensure all documentation and tests reflect new structure

**Steps:**
1. Update README.md with new module structure
2. Update CONTRIBUTING.md with guidelines for new files
3. Update architecture documentation
4. Update import paths in existing tests
5. Add new unit tests for individual modules
6. Update VS Code extension if needed
7. Commit: "docs: update for refactored server structure"

**Documentation Updates:**
- Architecture diagrams
- Developer quick start guide
- Module dependency graph
- Testing guidelines

**Time Estimate:** 2-3 hours

---

## Migration Safety Measures

### 1. Incremental Commits
Each phase is a separate commit that compiles and runs. If something breaks, we can bisect to find the problem.

### 2. Test-Driven Migration
Run full test suite after each phase:
```bash
python -m pytest tests/ -v
python -m pytest tests/test_server.py -v
```

### 3. Feature Validation
Test all major features manually after each phase:
- Document open/change/close
- Completions
- Hover
- Go-to-definition
- Diagnostics
- Custom commands

### 4. Git Branch Strategy
Create feature branch for refactoring:
```bash
git checkout -b refactor/modular-server
# Do all work here
# Merge to main only after full validation
```

### 5. Backward Compatibility
Maintain all public APIs. No breaking changes to:
- Extension integration
- Command names
- Configuration options

---

## Expected File Sizes After Refactoring

| Module | Lines | Purpose |
|--------|-------|---------|
| `server.py` | ~100 | Main entry point |
| `server_core.py` | ~600 | Core server class |
| `server_utils.py` | ~150 | Shared utilities |
| **lsp_handlers/** | | |
| `document_lifecycle.py` | ~200 | Open/change/close |
| `navigation.py` | ~400 | Completion, hover, definition |
| `symbols.py` | ~300 | Document/workspace symbols |
| `editing.py` | ~400 | Formatting, rename, actions |
| `presentation.py` | ~400 | Semantic tokens, hints, lens |
| `utility.py` | ~300 | Links, folding, signatures |
| **commands/** | | |
| `workspace_commands.py` | ~200 | Workspace operations |
| `event_commands.py` | ~300 | Event tools |
| `localization_commands.py` | ~200 | Localization tools |
| `log_commands.py` | ~200 | Log watcher control |
| **Total** | ~3,750 | (Slight increase due to module boilerplate) |

**Benefits of New Structure:**
- **Largest File:** 600 lines (vs 3,665 before)
- **Average File:** 250 lines
- **Modules:** 15 focused files (vs 1 monolith)
- **Max Cognitive Load:** ~600 lines per file
- **Navigation Time:** Find feature in <10 seconds

---

## Testing Strategy

### Unit Tests
Create tests for individual modules:
```python
# tests/lsp_handlers/test_navigation.py
def test_completion_handler():
    """Test completion handler in isolation"""
    pass

# tests/commands/test_workspace_commands.py
def test_validate_workspace():
    """Test workspace validation command"""
    pass
```

### Integration Tests
Verify handlers work with real server:
```python
# tests/integration/test_server_integration.py
def test_full_completion_flow():
    """Test completion from client request to response"""
    pass
```

### Regression Tests
Ensure no features broke during refactoring:
```python
# tests/test_regression.py
def test_all_features_after_refactor():
    """Comprehensive test of all LSP features"""
    pass
```

---

## Rollback Plan

If refactoring causes unexpected issues:

### Option 1: Fix Forward
1. Identify broken feature
2. Create targeted fix
3. Add test to prevent regression
4. Continue with refactoring

### Option 2: Revert Phase
1. Revert last commit: `git revert HEAD`
2. Diagnose issue in separate branch
3. Fix and re-apply phase

### Option 3: Complete Rollback
1. Reset to pre-refactor commit: `git reset --hard <commit>`
2. Re-plan refactoring approach
3. Start again with lessons learned

**Decision Criteria:**
- **Fix Forward:** Single handler/command broken
- **Revert Phase:** Entire phase broken, unclear cause
- **Complete Rollback:** Fundamental design issue discovered

---

## Success Metrics

### Quantitative
- ✅ Largest file reduced from 3,665 lines to <600 lines
- ✅ Number of files increased from 1 to ~15
- ✅ All tests pass (0 failures)
- ✅ No increase in startup time (< 1s)
- ✅ No regression in feature performance

### Qualitative
- ✅ Developers can find features in <10 seconds
- ✅ Merge conflicts reduced (measured over 1 month)
- ✅ New contributors understand structure faster
- ✅ Individual modules can be tested in isolation
- ✅ Code reviews are faster and more focused

---

## Future Improvements

### After Initial Refactoring

1. **Extract More Feature Logic**
   - Move more logic from handlers to feature modules
   - Handlers become thin wrappers

2. **Add Handler Base Classes**
   - `BaseHandler` with common patterns
   - `AsyncHandler` for async operations
   - Reduce boilerplate

3. **Dependency Injection**
   - Pass dependencies explicitly
   - Make testing easier
   - Reduce coupling

4. **Plugin System**
   - Allow external modules to register handlers
   - Make server extensible
   - Support community plugins

5. **Performance Monitoring**
   - Add timing decorators to handlers
   - Track slow operations
   - Identify optimization opportunities

---

## Appendix A: Import Patterns

### Before Refactoring
```python
# Everything in one file
from pychivalry.server import server, CK3LanguageServer
```

### After Refactoring
```python
# Clear module structure
from pychivalry.server import server           # Main entry
from pychivalry.server_core import CK3LanguageServer
from pychivalry.lsp_handlers import navigation
from pychivalry.commands import workspace_commands
```

---

## Appendix B: Testing Checklist

After each phase, verify:

**Document Operations:**
- [ ] Open CK3 file - syntax highlighting works
- [ ] Type code - no lag or errors
- [ ] Close file - diagnostics cleared

**Navigation:**
- [ ] Completion triggered by typing
- [ ] Hover shows documentation
- [ ] Go-to-definition jumps correctly
- [ ] Find references works

**Editing:**
- [ ] Format document works
- [ ] Rename symbol works
- [ ] Code actions appear

**Commands:**
- [ ] Workspace validation runs
- [ ] Event template generation works
- [ ] Log watcher starts/stops

**Performance:**
- [ ] Server starts in <1 second
- [ ] Completion appears in <100ms
- [ ] Diagnostics update in <500ms

---

## Appendix C: Communication Plan

### Internal Team
- Share this plan document for review
- Get feedback on module boundaries
- Assign phases to team members if parallel work possible

### Users/Community
- Announce refactoring in progress
- Note: "No user-visible changes expected"
- Mention testing period before release

### Documentation
- Update architecture docs during refactoring
- Add migration guide for contributors
- Document new module structure in wiki

---

## Status Tracking

| Phase | Status | Start Date | Complete Date | Notes |
|-------|--------|------------|---------------|-------|
| 1. Extract Server Core | ⏳ Not Started | - | - | - |
| 2. Create LSP Handlers | ⏳ Not Started | - | - | - |
| 3. Create Commands | ⏳ Not Started | - | - | - |
| 4. Extract Utilities | ⏳ Not Started | - | - | - |
| 5. Simplify Main Server | ⏳ Not Started | - | - | - |
| 6. Update Docs & Tests | ⏳ Not Started | - | - | - |

**Legend:**
- ⏳ Not Started
- 🏗️ In Progress
- ✅ Complete
- ❌ Blocked

---

## Questions & Decisions

### Q1: Should we keep backward compatibility during refactoring?
**Decision:** Yes. No breaking changes to public APIs. Extension continues to work unchanged.

### Q2: Can we do this in smaller increments?
**Decision:** Yes. Each phase is independently committable. Can pause between phases.

### Q3: What if performance degrades?
**Decision:** Profile before/after each phase. If degradation >10%, investigate before continuing.

### Q4: Should handlers be classes or functions?
**Decision:** Functions initially (matches current pattern). Can convert to classes later if needed.

### Q5: How do we handle circular imports?
**Decision:** Use TYPE_CHECKING and forward references. Server core imports nothing from handlers.

---

## Conclusion

This refactoring transforms a 3,665-line monolithic file into a well-organized, maintainable module structure. The incremental approach ensures safety, and each phase delivers immediate value:

- **Phase 1** enables clearer testing of server state management
- **Phase 2** allows independent LSP feature development
- **Phase 3** makes command development non-conflicting
- **Phases 4-5** polish the structure
- **Phase 6** ensures long-term maintainability

**Estimated Total Time:** 10-14 hours of focused work

**Risk Level:** Low (incremental, reversible, well-tested)

**Impact:** High (improved velocity, reduced conflicts, better code quality)

---

**Document Version:** 1.0  
**Created:** 2026-01-01  
**Author:** Development Team  
**Next Review:** After Phase 2 completion
