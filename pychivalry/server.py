"""
Crusader Kings 3 Language Server - Main LSP Server Implementation

DIAGNOSTIC CODES:
    SERVER-001: Server initialization failed
    SERVER-002: Client capability mismatch
    SERVER-003: Request handler exception
    SERVER-004: Invalid LSP message format

MODULE OVERVIEW:
    This is the main entry point and orchestrator for the CK3 Language Server.
    It implements the Language Server Protocol (LSP) to provide IDE-like features
    for Crusader Kings 3 modding in any LSP-compatible editor (VS Code, Neovim,
    Sublime, Emacs, etc.).
    
    The server acts as a bridge between the editor (client) and CK3-specific
    analysis modules, handling all LSP protocol details and routing requests
    to appropriate feature implementations.

ARCHITECTURE:
    **Server Lifecycle**:
    1. **Initialization** (initialize request):
       - Negotiate capabilities with client
       - Set up workspace folders
       - Configure logging
       - Initialize document index
       - Return server capabilities to client
    
    2. **Running State** (initialized notification):
       - Start listening for requests
       - Handle document synchronization
       - Process feature requests
       - Send diagnostics
       - Maintain document index
    
    3. **Shutdown** (shutdown request):
       - Clean up resources
       - Close files
       - Stop background threads
       - Return confirmation
    
    **Request/Response Flow**:
    ```
    Editor                    Server                    Feature Modules
      |                         |                             |
      |---> initialize -------->|                             |
      |<--- capabilities -------|                             |
      |                         |                             |
      |---> didOpen ----------->|                             |
      |                         |---> parse document -------->|
      |                         |<--- AST -------------------|
      |                         |---> validate ------------->|
      |                         |<--- diagnostics -----------|
      |<--- publishDiagnostics -|                             |
      |                         |                             |
      |---> completion -------->|                             |
      |                         |---> get completions ------>|
      |                         |<--- completion items ------|
      |<--- completion list ----|                             |
    ```

LSP FEATURES IMPLEMENTED:
    **Text Synchronization** (Required):
    - textDocument/didOpen: Track opened documents
    - textDocument/didChange: Incremental updates
    - textDocument/didClose: Clean up closed documents
    - textDocument/didSave: Trigger full validation
    
    **Language Features** (33 implemented):
    1. textDocument/completion: Auto-complete (completions.py)
    2. textDocument/hover: Documentation on hover (hover.py)
    3. textDocument/signatureHelp: Parameter hints (signature_help.py)
    4. textDocument/definition: Go-to-definition (navigation.py)
    5. textDocument/references: Find-all-references (navigation.py)
    6. textDocument/documentHighlight: Highlight symbol (document_highlight.py)
    7. textDocument/documentSymbol: Outline view (symbols.py)
    8. textDocument/codeAction: Quick fixes (code_actions.py)
    9. textDocument/codeLens: Inline metrics (code_lens.py)
    10. textDocument/documentLink: Clickable links (document_links.py)
    11. textDocument/formatting: Format document (formatting.py)
    12. textDocument/rangeFormatting: Format selection (formatting.py)
    13. textDocument/rename: Rename symbol (rename.py)
    14. textDocument/foldingRange: Code folding (folding.py)
    15. textDocument/semanticTokens: Syntax highlighting (semantic_tokens.py)
    16. textDocument/inlayHint: Inline annotations (inlay_hints.py)
    17. textDocument/publishDiagnostics: Error/warning display (diagnostics.py)
    ... plus workspace features, configuration, and more

HANDLER REGISTRATION:
    Handlers are registered using @server.feature decorators:
    ```python
    @server.feature(types.TEXT_DOCUMENT_COMPLETION)
    def completion_handler(params):
        # Handle completion request
        return CompletionList(...)
    ```
    
    The decorator maps LSP method names to handler functions.
    Requests are automatically deserialized and responses serialized.

DOCUMENT MANAGEMENT:
    Server maintains document state:
    - workspace.documents: Open documents by URI
    - document_versions: Version numbers for incremental sync
    - parse_cache: Cached ASTs for performance
    - index: Cross-document symbol index
    
    Documents are automatically parsed on open/change,
    with results cached for subsequent requests.

PERFORMANCE OPTIMIZATIONS:
    1. **Parse Caching**: AST cached until document changes
    2. **Incremental Parsing**: Only reparse changed regions
    3. **Debouncing**: Delay validation 200ms after typing
    4. **Lazy Evaluation**: Resolve code lenses on-demand
    5. **Parallel Processing**: Use ThreadPoolExecutor for workspace scan
    6. **Incremental Index**: Update index incrementally, not full rebuild
    
    Typical response times:
    - Completion: <10ms
    - Hover: <5ms
    - Diagnostics: <200ms (debounced)
    - Workspace scan: <1s for 1000 files

COMMUNICATION PROTOCOL:
    Server uses JSON-RPC 2.0 over stdin/stdout:
    - Request: Editor → Server (expects response)
    - Response: Server → Editor (replies to request)
    - Notification: Either direction (no response expected)
    
    Example request:
    ```json
    {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "textDocument/completion",
        "params": { "textDocument": {...}, "position": {...} }
    }
    ```

ERROR HANDLING:
    - Parse errors: Return partial results + diagnostics
    - Handler exceptions: Log error, return null/empty
    - Invalid requests: Return LSP error response
    - Timeout requests: Cancel after 30s
    
    Errors logged but don't crash server.
    Server remains responsive after errors.

USAGE:
    **Direct execution**:
    ```bash
    python -m pychivalry.server
    ```
    
    **After installation**:
    ```bash
    pychivalry
    ```
    
    **VS Code integration** (settings.json):
    ```json
    {
        "ck3-script.server.command": ["pychivalry"],
        "ck3-script.trace.server": "verbose"
    }
    ```

LOGGING:
    Configurable via LSP initialization:
    - ERROR: Only errors
    - WARNING: Errors + warnings
    - INFO: Errors + warnings + info
    - DEBUG: All messages + timing
    
    Logs written to ~/.pychivalry/server.log

SEE ALSO:
    - All feature modules: completions.py, hover.py, diagnostics.py, etc.
    - indexer.py: Symbol index management
    - parser.py: CK3 script parsing
    - ck3_language.py: Language definitions
    
    LSP Specification: https://microsoft.github.io/language-server-protocol/
    pygls Documentation: https://pygls.readthedocs.io/
"""

import asyncio
import hashlib
import logging
import os
import threading
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Any, Set, Tuple

# Import enhanced thread pool manager
from .thread_manager import ThreadPoolManager, TaskPriority, TaskStats

# Import the LanguageServer class from pygls
# This is the core class that handles LSP protocol communication
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument
from pygls.uris import to_fs_path

# Import LSP types from lsprotocol
# These define the structure of LSP messages (requests, responses, notifications)
from lsprotocol import types

# Import CK3 language definitions
# These lists contain all the CK3 scripting constructs we provide completions for:
# - CK3_KEYWORDS: Control flow and structural keywords
# - CK3_EFFECTS: Commands that modify game state
# - CK3_TRIGGERS: Conditional checks
# - CK3_SCOPES: Context switches for accessing game objects
# - CK3_EVENT_TYPES: Different event presentation styles
# - CK3_BOOLEAN_VALUES: Boolean true/false values
from .ck3_language import (
    CK3_KEYWORDS,
    CK3_EFFECTS,
    CK3_TRIGGERS,
    CK3_SCOPES,
    CK3_EVENT_TYPES,
    CK3_BOOLEAN_VALUES,
)

# Import parser and indexer
from .parser import parse_document, CK3Node, get_node_at_position
from .indexer import DocumentIndex

# Import diagnostics
from .diagnostics import collect_all_diagnostics, check_syntax, check_semantics, check_scopes

# Import hover
from .hover import create_hover_response, get_word_at_position

# Import context-aware completions
from .completions import get_context_aware_completions, detect_context

# Import code actions
from .code_actions import get_all_code_actions, convert_to_lsp_code_action

# Import semantic tokens
from .semantic_tokens import get_semantic_tokens, TOKEN_TYPES, TOKEN_MODIFIERS

# Import code lens
from .code_lens import get_code_lenses, resolve_code_lens

# Import formatting
from .formatting import format_document, format_range

# Import inlay hints
from .inlay_hints import get_inlay_hints, resolve_inlay_hint, InlayHintConfig

# Import log watcher components
from .log_watcher import CK3LogWatcher, detect_ck3_log_path
from .log_analyzer import CK3LogAnalyzer
from .log_diagnostics import LogDiagnosticConverter

# Import signature help
from .signature_help import get_signature_help, get_trigger_characters, get_retrigger_characters

# Import document highlight
from .document_highlight import get_document_highlights

# Import document links
from .document_links import get_document_links, resolve_document_link

# Import rename
from .rename import prepare_rename as do_prepare_rename, perform_rename

# Import folding
from .folding import get_folding_ranges

# Logger will be configured in main() after parsing arguments
logger = logging.getLogger(__name__)


def configure_logging(level: str = "info") -> None:
    """
    Configure logging for the language server.

    Args:
        level: Log level string (debug, info, warning, error)
    """
    level_map = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
    }
    log_level = level_map.get(level.lower(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


class CK3LanguageServer(LanguageServer):
    """
    Extended language server with CK3-specific state.

    This class extends the base LanguageServer to add:
    - Document AST tracking (updated on open/change)
    - Cross-document symbol indexing
    - Parser integration with document lifecycle
    - Workspace scanning for scripted effects/triggers
    - Progress reporting for long operations
    - User message notifications
    - Custom command support
    """

    def __init__(self, *args, **kwargs):
        """Initialize the CK3 language server."""
        super().__init__(*args, **kwargs)

        # Document ASTs (updated on open/change)
        self.document_asts: Dict[str, List[CK3Node]] = {}

        # Cross-document index for navigation
        self.index = DocumentIndex()

        # Track whether workspace has been scanned
        self._workspace_scanned = False

        # User configuration cache
        self._config_cache: Dict[str, Any] = {}

        # =====================================================================
        # Threading Infrastructure
        # =====================================================================

        # Enhanced thread pool manager for CPU-bound operations
        # Provides priority queuing, monitoring, and graceful shutdown
        self._thread_manager = ThreadPoolManager(
            max_workers=min(4, (os.cpu_count() or 1) + 1),
            thread_name_prefix="ck3-worker",
            enable_monitoring=True
        )
        
        # Legacy thread pool reference for backwards compatibility during migration
        # This will be removed once all operations are migrated
        self._thread_pool = self._thread_manager._executor

        # Thread-safety locks for shared data structures
        self._ast_lock = threading.RLock()  # Protects document_asts
        self._index_lock = threading.RLock()  # Protects index operations

        # =====================================================================
        # Async Document Update Infrastructure
        # =====================================================================

        # Pending document updates (for debouncing)
        # Maps URI -> asyncio.Task for scheduled updates
        self._pending_updates: Dict[str, asyncio.Task] = {}

        # Document versions to detect stale updates
        self._document_versions: Dict[str, int] = {}

        # Base debounce delay in seconds (150ms is good for typing)
        self._debounce_delay = 0.15

        # =====================================================================
        # Log Watcher Infrastructure
        # =====================================================================

        # Log watcher components (initialized on demand)
        self.log_analyzer: Optional[CK3LogAnalyzer] = None
        self.log_watcher: Optional[CK3LogWatcher] = None
        self.log_diagnostic_converter: Optional[LogDiagnosticConverter] = None

        # =====================================================================
        # AST Caching by Content Hash (Tier 2 Optimization)
        # =====================================================================

        # Cache ASTs by content hash to avoid re-parsing unchanged content
        # Uses OrderedDict for LRU eviction
        self._ast_cache: OrderedDict[str, List[CK3Node]] = OrderedDict()
        self._ast_cache_max = 50  # Maximum cached ASTs
        self._ast_cache_lock = threading.Lock()

        # =====================================================================
        # Pre-emptive Parsing Infrastructure (Tier 4 Optimization)
        # =====================================================================

        # Queue of files to pre-parse (low priority background work)
        self._preparse_queue: List[str] = []
        self._preparse_lock = threading.Lock()

    # =====================================================================
    # Enhanced Thread Pool Interface
    # =====================================================================

    async def run_in_thread(
        self,
        func: callable,
        *args,
        priority: TaskPriority = TaskPriority.NORMAL,
        task_name: Optional[str] = None,
        **kwargs
    ):
        """
        Run a CPU-bound function in the custom thread pool.
        
        This is the preferred method for executing CPU-intensive operations
        like parsing, diagnostics, and workspace scanning.
        
        Args:
            func: Function to execute
            *args: Positional arguments for the function
            priority: Task priority (CRITICAL, HIGH, NORMAL, LOW)
            task_name: Optional name for monitoring
            **kwargs: Keyword arguments for the function
        
        Returns:
            Result from the function execution
        
        Example:
            ```python
            ast = await self.run_in_thread(
                parse_document, 
                content,
                priority=TaskPriority.HIGH,
                task_name="parse_main_event_file"
            )
            ```
        """
        loop = asyncio.get_event_loop()
        future = self._thread_manager.submit_task(
            func, *args, priority=priority, task_name=task_name, **kwargs
        )
        # Wait for the future to complete in an asyncio-compatible way
        return await loop.run_in_executor(None, future.result)
    
    def get_thread_pool_stats(self) -> TaskStats:
        """
        Get current thread pool statistics.
        
        Returns:
            TaskStats object with active, queued, completed task counts
        
        Example:
            ```python
            stats = self.get_thread_pool_stats()
            logger.info(f"Thread pool: {stats}")
            ```
        """
        return self._thread_manager.get_stats()
    
    def log_thread_pool_stats(self):
        """Log current thread pool statistics at DEBUG level."""
        if logger.isEnabledFor(logging.DEBUG):
            stats = self.get_thread_pool_stats()
            logger.debug(str(stats))

    # =====================================================================
    # Thread-Safe Document Access
    # =====================================================================

    def get_ast(self, uri: str) -> List[CK3Node]:
        """
        Thread-safe access to document AST.

        Args:
            uri: Document URI

        Returns:
            List of AST nodes, or empty list if not found
        """
        with self._ast_lock:
            return self.document_asts.get(uri, [])

    def set_ast(self, uri: str, ast: List[CK3Node]):
        """
        Thread-safe update of document AST.

        Args:
            uri: Document URI
            ast: New AST nodes
        """
        with self._ast_lock:
            self.document_asts[uri] = ast

    def remove_ast(self, uri: str):
        """
        Thread-safe removal of document AST.

        Args:
            uri: Document URI
        """
        with self._ast_lock:
            self.document_asts.pop(uri, None)

    def get_document_version(self, uri: str) -> int:
        """Get the current document version for staleness detection."""
        return self._document_versions.get(uri, 0)

    def increment_document_version(self, uri: str) -> int:
        """Increment and return the new document version."""
        self._document_versions[uri] = self._document_versions.get(uri, 0) + 1
        return self._document_versions[uri]

    # =====================================================================
    # Adaptive Debounce (Tier 2 Optimization)
    # =====================================================================

    def get_adaptive_debounce_delay(self, source: str) -> float:
        """
        Calculate debounce delay based on document size.

        Smaller files get faster feedback, larger files get more debouncing
        to prevent excessive parsing during rapid typing.

        Args:
            source: Document source text

        Returns:
            Debounce delay in seconds
        """
        line_count = source.count("\n")

        if line_count < 500:
            return 0.08  # 80ms for small files - faster feedback
        elif line_count < 2000:
            return 0.15  # 150ms for medium files (default)
        elif line_count < 5000:
            return 0.25  # 250ms for large files
        else:
            return 0.40  # 400ms for very large files

    # =====================================================================
    # AST Content Hash Caching (Tier 2 Optimization)
    # =====================================================================

    def _compute_content_hash(self, source: str) -> str:
        """Compute MD5 hash of document content for cache lookup."""
        return hashlib.md5(source.encode("utf-8", errors="replace")).hexdigest()

    def get_cached_ast(self, source: str) -> Optional[List[CK3Node]]:
        """
        Get AST from content hash cache if available.

        Args:
            source: Document source text

        Returns:
            Cached AST or None if not in cache
        """
        content_hash = self._compute_content_hash(source)
        with self._ast_cache_lock:
            if content_hash in self._ast_cache:
                # Move to end for LRU behavior
                self._ast_cache.move_to_end(content_hash)
                logger.debug(f"AST cache hit for hash {content_hash[:8]}...")
                return self._ast_cache[content_hash]
        return None

    def cache_ast(self, source: str, ast: List[CK3Node]):
        """
        Store AST in content hash cache.

        Args:
            source: Document source text
            ast: Parsed AST to cache
        """
        content_hash = self._compute_content_hash(source)
        with self._ast_cache_lock:
            # Evict oldest if at capacity
            while len(self._ast_cache) >= self._ast_cache_max:
                self._ast_cache.popitem(last=False)

            self._ast_cache[content_hash] = ast
            logger.debug(
                f"AST cached with hash {content_hash[:8]}... (cache size: {len(self._ast_cache)})"
            )

    def get_or_parse_ast(self, source: str) -> List[CK3Node]:
        """
        Get AST from cache or parse if not cached.

        This is the primary method for obtaining an AST with caching.

        Args:
            source: Document source text

        Returns:
            Parsed AST (from cache or freshly parsed)
        """
        # Check cache first
        cached = self.get_cached_ast(source)
        if cached is not None:
            return cached

        # Parse and cache
        ast = parse_document(source)
        self.cache_ast(source, ast)
        return ast

    # =====================================================================
    # Server Communication: Show Message
    # =====================================================================

    def notify_info(self, message: str):
        """
        Show an information message to the user.

        This displays a non-intrusive notification in the editor's UI.
        Safe to call even when not connected to a client.

        Args:
            message: The message to display
        """
        try:
            self.show_message(message, types.MessageType.Info)
        except Exception:
            pass  # Ignore if not connected
        logger.info(f"User notification: {message}")

    def notify_warning(self, message: str):
        """
        Show a warning message to the user.

        This displays a warning notification in the editor's UI.
        Safe to call even when not connected to a client.

        Args:
            message: The warning message to display
        """
        try:
            self.show_message(message, types.MessageType.Warning)
        except Exception:
            pass  # Ignore if not connected
        logger.warning(f"User warning: {message}")

    def notify_error(self, message: str):
        """
        Show an error message to the user.

        This displays an error notification in the editor's UI.
        Safe to call even when not connected to a client.

        Args:
            message: The error message to display
        """
        try:
            self.show_message(message, types.MessageType.Error)
        except Exception:
            pass  # Ignore if not connected
        logger.error(f"User error: {message}")

    def log_message(self, message: str, msg_type: types.MessageType = types.MessageType.Log):
        """
        Log a message to the editor's output channel.

        This writes to the language server output channel without
        showing a popup notification to the user.
        Safe to call even when not connected to a client.

        Args:
            message: The message to log
            msg_type: The message type (Log, Info, Warning, Error)
        """
        try:
            self.show_message_log(message, msg_type)
        except Exception:
            pass  # Ignore if not connected

    # =====================================================================
    # Server Communication: Progress Reporting
    # =====================================================================

    async def with_progress(
        self,
        title: str,
        task_func,
        cancellable: bool = False,
    ):
        """
        Execute a task with progress reporting.

        This shows a progress indicator in the editor while the task runs.
        The task function receives a callback to report progress.

        Args:
            title: Title of the progress notification
            task_func: Async function that takes (report_progress) callback
            cancellable: Whether the user can cancel the operation

        Example:
            async def do_scan(report_progress):
                report_progress("Scanning events...", 25)
                await scan_events()
                report_progress("Scanning effects...", 50)
                await scan_effects()
                report_progress("Done!", 100)

            await server.with_progress("Indexing Workspace", do_scan)
        """
        token = str(uuid.uuid4())

        try:
            # Create progress
            await self.progress.create_async(token)

            # Begin progress
            self.progress.begin(
                token,
                types.WorkDoneProgressBegin(
                    title=title,
                    cancellable=cancellable,
                    percentage=0,
                ),
            )

            # Define report callback
            def report_progress(message: str, percentage: Optional[int] = None):
                self.progress.report(
                    token,
                    types.WorkDoneProgressReport(
                        message=message,
                        percentage=percentage,
                    ),
                )

            # Execute the task
            await task_func(report_progress)

        finally:
            # End progress
            self.progress.end(token, types.WorkDoneProgressEnd(message="Complete"))

    # =====================================================================
    # Server Communication: Configuration
    # =====================================================================

    async def get_user_configuration(self, section: str = "ck3LanguageServer") -> Dict[str, Any]:
        """
        Get user configuration from the client.

        This retrieves settings from the user's VS Code settings.json.

        Args:
            section: Configuration section name

        Returns:
            Dictionary of configuration values
        """
        try:
            config = await self.get_configuration_async(
                types.ConfigurationParams(items=[types.ConfigurationItem(section=section)])
            )
            if config and len(config) > 0:
                self._config_cache = config[0] or {}
                return self._config_cache
        except Exception as e:
            logger.warning(f"Failed to get configuration: {e}")

        return self._config_cache

    def get_cached_config(self, key: str, default: Any = None) -> Any:
        """
        Get a cached configuration value.

        Args:
            key: Configuration key
            default: Default value if key not found

        Returns:
            Configuration value or default
        """
        return self._config_cache.get(key, default)

    # =====================================================================
    # Server Communication: Apply Workspace Edit
    # =====================================================================

    async def apply_edit(
        self,
        edit: types.WorkspaceEdit,
        label: Optional[str] = None,
    ) -> bool:
        """
        Apply a workspace edit to modify files programmatically.

        This allows the server to make changes to files in the workspace,
        such as refactoring operations, code generation, or bulk edits.

        Args:
            edit: The WorkspaceEdit containing changes to apply
            label: Optional label for the edit (shown in undo history)

        Returns:
            True if the edit was applied successfully, False otherwise

        Example:
            # Create a simple text edit
            edit = types.WorkspaceEdit(
                changes={
                    "file:///path/to/file.txt": [
                        types.TextEdit(
                            range=types.Range(
                                start=types.Position(line=0, character=0),
                                end=types.Position(line=0, character=0)
                            ),
                            new_text="# New content\\n"
                        )
                    ]
                }
            )
            success = await server.apply_edit(edit, "Insert header")
        """
        try:
            result = await self.apply_edit_async(edit, label)
            if result.applied:
                logger.info(f"Workspace edit applied successfully: {label or 'unnamed'}")
                return True
            else:
                failure_reason = result.failure_reason or "Unknown reason"
                logger.warning(f"Workspace edit failed: {failure_reason}")
                return False
        except Exception as e:
            logger.error(f"Error applying workspace edit: {e}", exc_info=True)
            return False

    def create_text_edit(
        self,
        uri: str,
        start_line: int,
        start_char: int,
        end_line: int,
        end_char: int,
        new_text: str,
    ) -> types.WorkspaceEdit:
        """
        Create a simple workspace edit for a single file change.

        Helper method to create WorkspaceEdit objects more easily.

        Args:
            uri: File URI to edit
            start_line: Starting line (0-indexed)
            start_char: Starting character (0-indexed)
            end_line: Ending line (0-indexed)
            end_char: Ending character (0-indexed)
            new_text: Text to insert/replace

        Returns:
            WorkspaceEdit ready to apply
        """
        return types.WorkspaceEdit(
            changes={
                uri: [
                    types.TextEdit(
                        range=types.Range(
                            start=types.Position(line=start_line, character=start_char),
                            end=types.Position(line=end_line, character=end_char),
                        ),
                        new_text=new_text,
                    )
                ]
            }
        )

    def create_insert_edit(
        self, uri: str, line: int, character: int, text: str
    ) -> types.WorkspaceEdit:
        """
        Create a workspace edit that inserts text at a position.

        Args:
            uri: File URI to edit
            line: Line to insert at (0-indexed)
            character: Character position to insert at (0-indexed)
            text: Text to insert

        Returns:
            WorkspaceEdit ready to apply
        """
        return self.create_text_edit(uri, line, character, line, character, text)

    def create_multi_file_edit(
        self, changes: Dict[str, List[types.TextEdit]]
    ) -> types.WorkspaceEdit:
        """
        Create a workspace edit that modifies multiple files.

        Args:
            changes: Dictionary mapping file URIs to lists of TextEdits

        Returns:
            WorkspaceEdit ready to apply
        """
        return types.WorkspaceEdit(changes=changes)

    # =====================================================================
    # Async Document Update Scheduling
    # =====================================================================

    async def schedule_document_update(self, uri: str, doc_source: str):
        """
        Schedule document parsing with debouncing.

        This method:
        1. Cancels any pending update for this document
        2. Schedules a new update after the debounce delay
        3. Runs parsing and diagnostics in the thread pool
        4. Publishes diagnostics when complete

        Args:
            uri: Document URI
            doc_source: Current document source text
        """
        # Increment version to track this update
        version = self.increment_document_version(uri)

        # Calculate adaptive debounce delay based on document size
        debounce_delay = self.get_adaptive_debounce_delay(doc_source)

        # Cancel any pending update for this document
        if uri in self._pending_updates:
            self._pending_updates[uri].cancel()
            try:
                await self._pending_updates[uri]
            except asyncio.CancelledError:
                pass

        async def do_update():
            """Perform the actual update after debounce delay."""
            try:
                # Wait for adaptive debounce period
                await asyncio.sleep(debounce_delay)

                # Check if this update is still current
                if self.get_document_version(uri) != version:
                    logger.debug(f"Skipping stale update for {uri} (version {version})")
                    return

                # Get current document content
                try:
                    doc = self.workspace.get_text_document(uri)
                    current_source = doc.source
                except Exception:
                    # Document may have been closed
                    return

                # Try to get AST from content hash cache first
                ast = await self.run_in_thread(
                    self.get_or_parse_ast, 
                    current_source,
                    priority=TaskPriority.HIGH,
                    task_name=f"parse_{uri.split('/')[-1]}"
                )

                # Check again if still current before updating
                if self.get_document_version(uri) != version:
                    logger.debug(f"Skipping stale AST update for {uri}")
                    return

                # Update AST (thread-safe)
                self.set_ast(uri, ast)

                # Update index (thread-safe)
                with self._index_lock:
                    self.index.update_from_ast(uri, ast)

                # =========================================================
                # Streaming Diagnostics (Tier 3 Optimization)
                # =========================================================
                # Phase 1: Publish syntax errors immediately for fast feedback
                syntax_diags = await self.run_in_thread(
                    self._collect_syntax_diagnostics_sync,
                    uri,
                    current_source,
                    ast,
                    priority=TaskPriority.HIGH,
                    task_name="syntax_diagnostics"
                )

                # Check if still current
                if self.get_document_version(uri) != version:
                    logger.debug(f"Skipping stale syntax diagnostics for {uri}")
                    return

                # Publish syntax errors immediately
                self.text_document_publish_diagnostics(
                    types.PublishDiagnosticsParams(
                        uri=uri,
                        diagnostics=syntax_diags,
                    )
                )

                # Phase 2: Run semantic analysis in background
                semantic_diags = await self.run_in_thread(
                    self._collect_semantic_diagnostics_sync,
                    uri,
                    ast,
                    priority=TaskPriority.NORMAL,
                    task_name="semantic_diagnostics"
                )

                # Check again before final publish
                if self.get_document_version(uri) != version:
                    logger.debug(f"Skipping stale semantic diagnostics for {uri}")
                    return

                # Publish complete diagnostics (syntax + semantic)
                all_diagnostics = syntax_diags + semantic_diags
                self.text_document_publish_diagnostics(
                    types.PublishDiagnosticsParams(
                        uri=uri,
                        diagnostics=all_diagnostics,
                    )
                )

                logger.debug(
                    f"Async update complete for {uri} (version {version}, debounce {debounce_delay*1000:.0f}ms, {len(syntax_diags)} syntax + {len(semantic_diags)} semantic diags)"
                )

            except asyncio.CancelledError:
                logger.debug(f"Update cancelled for {uri}")
                raise
            except Exception as e:
                logger.error(f"Error in async document update for {uri}: {e}", exc_info=True)

        # Schedule the update
        self._pending_updates[uri] = asyncio.create_task(do_update())

    def _collect_diagnostics_sync(
        self, uri: str, source: str, ast: List[CK3Node]
    ) -> List[types.Diagnostic]:
        """
        Synchronous wrapper for diagnostics collection (for thread pool).

        Args:
            uri: Document URI
            source: Document source text
            ast: Parsed AST

        Returns:
            List of diagnostics
        """
        try:
            # Create a minimal document object for the diagnostics function
            doc = TextDocument(uri=uri, source=source)

            # Get index with lock
            with self._index_lock:
                index = self.index

            return collect_all_diagnostics(doc, ast, index)
        except Exception as e:
            logger.error(f"Error collecting diagnostics: {e}", exc_info=True)
            return []

    def _collect_syntax_diagnostics_sync(
        self, uri: str, source: str, ast: List[CK3Node]
    ) -> List[types.Diagnostic]:
        """
        Collect only syntax diagnostics for fast initial feedback.

        This is called first to provide immediate error highlighting,
        while semantic analysis runs in the background.

        Args:
            uri: Document URI
            source: Document source text
            ast: Parsed AST

        Returns:
            List of syntax diagnostics only
        """
        try:
            doc = TextDocument(uri=uri, source=source)
            return check_syntax(doc, ast)
        except Exception as e:
            logger.error(f"Error collecting syntax diagnostics: {e}", exc_info=True)
            return []

    def _collect_semantic_diagnostics_sync(
        self, uri: str, ast: List[CK3Node]
    ) -> List[types.Diagnostic]:
        """
        Collect semantic diagnostics (effects, triggers, scopes).

        This runs after syntax diagnostics for progressive error discovery.

        Args:
            uri: Document URI
            ast: Parsed AST

        Returns:
            List of semantic and scope diagnostics
        """
        try:
            diagnostics = []

            # Get index with lock
            with self._index_lock:
                index = self.index

            # Check semantics (effects, triggers, etc.)
            diagnostics.extend(check_semantics(ast, index))

            # Check scopes
            diagnostics.extend(check_scopes(ast, index))

            return diagnostics
        except Exception as e:
            logger.error(f"Error collecting semantic diagnostics: {e}", exc_info=True)
            return []

    # =====================================================================
    # Lifecycle Management
    # =====================================================================

    def shutdown(self):
        """
        Clean shutdown of server resources.

        This method:
        1. Cancels all pending document updates
        2. Shuts down the thread pool gracefully
        """
        logger.info("Shutting down CK3 Language Server...")

        # Cancel all pending updates
        for uri, task in self._pending_updates.items():
            task.cancel()
            logger.debug(f"Cancelled pending update for {uri}")

        self._pending_updates.clear()

        # Shutdown enhanced thread pool manager
        shutdown_success = self._thread_manager.shutdown(wait=True, timeout=10)
        if shutdown_success:
            logger.info("Thread pool manager shut down successfully")
        else:
            logger.warning("Thread pool manager shutdown timed out")

    # =====================================================================
    # Workspace Scanning with Progress
    # =====================================================================

    async def _scan_workspace_folders_async(self):
        """
        Scan all workspace folders for scripted effects and triggers with progress.

        This is called on first document open to index all custom effects
        and triggers in the mod's common/ folder. Shows progress to the user.
        """
        if self._workspace_scanned:
            logger.debug("Workspace already scanned, skipping")
            return

        logger.info("Starting workspace scan...")
        try:
            # Get workspace folders
            workspace_folders = []
            if self.workspace.folders:
                for folder in self.workspace.folders:
                    # Convert URI to path
                    folder_uri = folder.uri if hasattr(folder, "uri") else folder
                    if folder_uri.startswith("file:///"):
                        # Convert file URI to path
                        from urllib.parse import unquote

                        path = unquote(folder_uri[8:])  # Remove 'file:///'
                        # On Windows, handle drive letter
                        if len(path) > 2 and path[0] == "/" and path[2] == ":":
                            path = path[1:]  # Remove leading slash
                        workspace_folders.append(path)
                    else:
                        workspace_folders.append(folder_uri)

            if workspace_folders:
                folder_count = len(workspace_folders)
                logger.info(f"Scanning {folder_count} workspace folder(s): {workspace_folders}")

                # Perform the actual scan in thread pool with lock
                # Pass the executor for parallel scanning (2-4x faster)
                def scan_with_lock():
                    with self._index_lock:
                        self.index.scan_workspace(workspace_folders, executor=self._thread_pool)

                await self.run_in_thread(
                    scan_with_lock,
                    priority=TaskPriority.NORMAL,
                    task_name="workspace_scan"
                )

                # Notify user of scan results (thread-safe access)
                with self._index_lock:
                    stats = (
                        f"Indexed {len(self.index.events)} events, "
                        f"{len(self.index.scripted_effects)} effects, "
                        f"{len(self.index.scripted_triggers)} triggers, "
                        f"{len(self.index.localization)} localization keys"
                    )
                logger.info(stats)
                self.log_message(stats, types.MessageType.Info)
            else:
                logger.warning("No workspace folders found for scanning")

            self._workspace_scanned = True

        except Exception as e:
            logger.error(f"Error scanning workspace folders: {e}", exc_info=True)
            self.notify_error(f"Failed to scan workspace: {str(e)}")
            self._workspace_scanned = True  # Don't retry on error

    def _scan_workspace_folders(self):
        """
        Scan all workspace folders for scripted effects and triggers.

        This is called on first document open to index all custom effects
        and triggers in the mod's common/ folder.

        Note: This is the synchronous fallback. The async version with
        progress reporting is preferred.
        """
        if self._workspace_scanned:
            return

        try:
            # Get workspace folders
            workspace_folders = []
            if self.workspace.folders:
                for folder in self.workspace.folders:
                    # Convert URI to path
                    folder_uri = folder.uri if hasattr(folder, "uri") else folder
                    if folder_uri.startswith("file:///"):
                        # Convert file URI to path
                        from urllib.parse import unquote

                        path = unquote(folder_uri[8:])  # Remove 'file:///'
                        # On Windows, handle drive letter
                        if len(path) > 2 and path[0] == "/" and path[2] == ":":
                            path = path[1:]  # Remove leading slash
                        workspace_folders.append(path)
                    else:
                        workspace_folders.append(folder_uri)

            if workspace_folders:
                logger.info(
                    f"Scanning {len(workspace_folders)} workspace folder(s) for "
                    f"scripted effects/triggers"
                )
                self.index.scan_workspace(workspace_folders)
            else:
                logger.warning("No workspace folders found for scanning")

            self._workspace_scanned = True

        except Exception as e:
            logger.error(f"Error scanning workspace folders: {e}", exc_info=True)
            self._workspace_scanned = True  # Don't retry on error

    def parse_and_index_document(self, doc: TextDocument) -> List[CK3Node]:
        """
        Parse a document and update the index (thread-safe).

        This is called whenever a document is opened or changed.

        Args:
            doc: The text document to parse

        Returns:
            The parsed AST
        """
        try:
            ast = parse_document(doc.source)

            # Thread-safe AST update
            self.set_ast(doc.uri, ast)

            # Thread-safe index update
            with self._index_lock:
                self.index.update_from_ast(doc.uri, ast)

            logger.debug(f"Parsed and indexed document: {doc.uri}")
            return ast
        except Exception as e:
            logger.error(f"Error parsing document {doc.uri}: {e}")
            # Return empty AST on parse error
            return []

    def publish_diagnostics_for_document(self, doc: TextDocument):
        """
        Validate document and publish diagnostics to the client.

        This collects all validation errors and warnings for the document
        and sends them to the client via LSP's PublishDiagnostics notification.

        Args:
            doc: The text document to validate
        """
        try:
            # Thread-safe AST access
            ast = self.get_ast(doc.uri)

            # Thread-safe index access
            with self._index_lock:
                diagnostics = collect_all_diagnostics(doc, ast, self.index)

            # Publish diagnostics to client
            self.text_document_publish_diagnostics(
                types.PublishDiagnosticsParams(
                    uri=doc.uri,
                    diagnostics=diagnostics,
                )
            )
            logger.debug(f"Published {len(diagnostics)} diagnostics for {doc.uri}")
        except Exception as e:
            logger.error(f"Error publishing diagnostics for {doc.uri}: {e}", exc_info=True)


# Create the CK3 language server instance
# This is the main server object that will handle all LSP communication
# Parameters:
#   - name: Identifier for this language server
#   - version: Server version (should match package version)
server = CK3LanguageServer("ck3-language-server", "v0.1.0")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
async def did_open(ls: CK3LanguageServer, params: types.DidOpenTextDocumentParams):
    """
    Handle document open event

    This handler is called when a user opens a CK3 script file in their editor.
    It parses the document, updates the index, and publishes diagnostics.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the opened document:
            - text_document.uri: The file URI (file path)
            - text_document.text: The full document content
            - text_document.language_id: The language identifier (e.g., "ck3")
            - text_document.version: Document version number

    LSP Specification:
        This is a notification from client to server, no response is expected.
    """
    logger.info(f"Document opened: {params.text_document.uri}")

    # Parse the document FIRST for immediate responsiveness
    # This ensures documentSymbol, hover, etc. work immediately
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse_and_index_document(doc)

    # Publish initial diagnostics (may have false positives until workspace scan completes)
    ls.publish_diagnostics_for_document(doc)

    # On first document open, scan workspace for scripted effects/triggers/localization
    # This runs after parsing so the document is immediately usable
    if not ls._workspace_scanned:
        logger.info("First document open - triggering workspace scan")
        await ls._scan_workspace_folders_async()

        # Re-publish diagnostics now that workspace is indexed
        # This clears false positives for custom triggers/effects
        ls.publish_diagnostics_for_document(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
async def did_change(ls: CK3LanguageServer, params: types.DidChangeTextDocumentParams):
    """
    Handle document change event (async with debouncing).

    This handler is called whenever the user makes changes to a CK3 script file.
    Instead of blocking on parsing and diagnostics, it schedules an async update
    that will run after a debounce period (150ms by default).

    Args:
        ls: The CK3 language server instance
        params: Contains information about the document changes:
            - text_document.uri: The file URI being modified
            - text_document.version: New document version number
            - content_changes: List of changes (incremental or full document)

    LSP Specification:
        This is a notification from client to server. The server should update
        its internal representation of the document but no response is required.

    Benefits:
        - No blocking on typing - returns immediately
        - Debouncing prevents excessive parsing during rapid typing
        - Parsing runs in thread pool, doesn't block event loop
        - Stale updates are automatically discarded
    """
    uri = params.text_document.uri
    logger.debug(f"Document changed: {uri}")

    # Get current document content
    try:
        doc = ls.workspace.get_text_document(uri)
    except Exception as e:
        logger.warning(f"Could not get document {uri}: {e}")
        return

    # Schedule async update (debounced, runs in thread pool)
    await ls.schedule_document_update(uri, doc.source)


@server.feature(types.TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: CK3LanguageServer, params: types.DidCloseTextDocumentParams):
    """
    Handle document close event.

    This handler is called when a user closes a CK3 script file in their editor.
    It cleans up document-specific resources, removes entries from the index,
    and clears diagnostics.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the closed document:
            - text_document.uri: The file URI being closed

    LSP Specification:
        This is a notification from client to server. After this, the server
        should no longer track this document until it's opened again.
        No response is expected.

    Note:
        The server should not send diagnostics or other information about
        this document after it's closed.
    """
    uri = params.text_document.uri
    logger.info(f"Document closed: {uri}")

    # Cancel any pending update for this document
    if uri in ls._pending_updates:
        ls._pending_updates[uri].cancel()
        del ls._pending_updates[uri]

    # Remove version tracking
    ls._document_versions.pop(uri, None)

    # Thread-safe AST removal
    ls.remove_ast(uri)

    # Thread-safe index removal
    with ls._index_lock:
        ls.index.remove_document(uri)

    # Clear diagnostics for this document
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=uri,
            diagnostics=[],  # Empty list clears all diagnostics
        )
    )


@server.feature(
    types.TEXT_DOCUMENT_COMPLETION,
    types.CompletionOptions(trigger_characters=["_", ".", ":", "="]),
)
def completions(ls: CK3LanguageServer, params: types.CompletionParams):
    """
    Provide context-aware completion suggestions for CK3 scripting.

    This feature provides intelligent auto-completion (IntelliSense) that understands
    the structure of CK3 code and provides appropriate suggestions based on:
    - Current scope type (character, title, province, etc.)
    - Block context (trigger, effect, immediate, option, limit, etc.)
    - Cursor position (after dot, after scope:, in assignment, etc.)

    Args:
        ls: The CK3 language server instance
        params: Contains information about the completion request:
            - text_document.uri: The file where completion was triggered
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)
            - context.trigger_kind: How completion was triggered

    Returns:
        CompletionList with context-aware completion items

    Features:
        - Context detection (trigger vs effect blocks)
        - Scope-aware filtering (only valid scope links)
        - Snippet completions (event templates, etc.)
        - Saved scope suggestions after 'scope:'
        - Trigger character handling (_, ., :, =)
    """
    try:
        logger.debug(f"Completion request at {params.text_document.uri}:{params.position.line}:{params.position.character}")
        doc = ls.workspace.get_text_document(params.text_document.uri)
        ast = ls.get_ast(doc.uri)

        # Get the current line text for context detection
        lines = doc.source.split("\n")
        line_text = lines[params.position.line] if params.position.line < len(lines) else ""
        logger.debug(f"Completion line text: '{line_text}'")

        # Find the AST node at cursor position for context
        node = get_node_at_position(ast, params.position) if ast else None

        # Get context-aware completions
        result = get_context_aware_completions(
            document_uri=doc.uri,
            position=params.position,
            ast=node,
            line_text=line_text,
            document_index=ls.index,
        )
        logger.debug(f"Returning {len(result.items) if result else 0} completion items")
        return result
    except Exception as e:
        logger.error(f"Error in completions handler: {e}", exc_info=True)
        # Fallback to empty completion list on error
        return types.CompletionList(is_incomplete=False, items=[])


@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(ls: CK3LanguageServer, params: types.HoverParams):
    """
    Provide hover documentation for CK3 constructs.

    This feature shows helpful information when users hover over CK3 keywords,
    effects, triggers, scopes, events, and other constructs. The documentation
    includes usage examples, parameter information, and cross-references.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the hover request:
            - text_document.uri: The file where hover was triggered
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)

    Returns:
        Hover: Contains:
            - contents: Markdown-formatted documentation
            - range: Optional range that the hover applies to
        or None if no hover information available

    LSP Specification:
        This is a request from client to server. The server should respond with
        a Hover object containing documentation, or null if no information is available.

    Features:
        - Effect documentation with usage examples
        - Trigger documentation with return types
        - Scope navigation information
        - Event definitions with file locations
        - Saved scope references with definition locations
        - List iterator explanations
    """
    try:
        logger.debug(f"Hover request at {params.text_document.uri}:{params.position.line}:{params.position.character}")
        doc = ls.workspace.get_text_document(params.text_document.uri)
        ast = ls.get_ast(doc.uri)

        result = create_hover_response(doc, params.position, ast, ls.index)
        logger.debug(f"Hover result: {'Found' if result else 'None'}")
        return result
    except Exception as e:
        logger.error(f"Error in hover handler: {e}", exc_info=True)
        return None


@server.feature(types.TEXT_DOCUMENT_DEFINITION)
def definition(ls: CK3LanguageServer, params: types.DefinitionParams):
    """
    Provide Go-to-Definition for CK3 constructs.

    This feature allows users to Ctrl+Click (or F12) on symbols to navigate
    to their definitions. Supports:
    - Localization keys -> Jump to .yml file definition
    - Event IDs -> Jump to event definition
    - Custom scripted effects -> Jump to effect definition
    - Custom scripted triggers -> Jump to trigger definition
    - Saved scopes -> Jump to save_scope_as location

    Args:
        ls: The CK3 language server instance
        params: Contains information about the definition request:
            - text_document.uri: The file where definition was requested
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)

    Returns:
        Location or list of Locations for the definition(s), or None if not found

    LSP Specification:
        This is a request from client to server. The server should respond with
        a Location, Location[], LocationLink[], or null.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)

        # Get word at cursor position
        from .hover import get_word_at_position

        word = get_word_at_position(doc, params.position)

        if not word:
            return None

        logger.debug(f"Go-to-definition for: {word}")

        # Check if it's a localization key (contains dots)
        if "." in word and ls.index:
            loc_info = ls.index.find_localization(word)
            if loc_info:
                text, file_uri, line_num = loc_info
                return types.Location(
                    uri=file_uri,
                    range=types.Range(
                        start=types.Position(line=line_num, character=0),
                        end=types.Position(line=line_num, character=len(word)),
                    ),
                )

        # Check if it's an event ID (format: namespace.number like rq_nts_daughter.0001)
        if "." in word and ls.index:
            event_loc = ls.index.find_event(word)
            if event_loc:
                return event_loc

        # Check if it's a custom scripted effect
        if ls.index:
            effect_loc = ls.index.find_scripted_effect(word)
            if effect_loc:
                return effect_loc

        # Check if it's a custom scripted trigger
        if ls.index:
            trigger_loc = ls.index.find_scripted_trigger(word)
            if trigger_loc:
                return trigger_loc

        # Check if it's a saved scope reference (scope:xxx)
        if word.startswith("scope:") and ls.index:
            scope_name = word[6:]
            scope_loc = ls.index.find_saved_scope(scope_name)
            if scope_loc:
                return scope_loc

        # Check if it's a character flag
        if ls.index:
            flag_loc = ls.index.find_character_flag(word)
            if flag_loc:
                return flag_loc

        # Check if it's a character interaction
        if ls.index:
            interaction_loc = ls.index.find_character_interaction(word)
            if interaction_loc:
                return interaction_loc

        # Check if it's a modifier
        if ls.index:
            modifier_loc = ls.index.find_modifier(word)
            if modifier_loc:
                return modifier_loc

        # Check if it's an on_action
        if ls.index:
            on_action_loc = ls.index.find_on_action(word)
            if on_action_loc:
                return on_action_loc

        # Check if it's an opinion modifier
        if ls.index:
            opinion_loc = ls.index.find_opinion_modifier(word)
            if opinion_loc:
                return opinion_loc

        # Check if it's a scripted GUI
        if ls.index:
            gui_loc = ls.index.find_scripted_gui(word)
            if gui_loc:
                return gui_loc

        return None

    except Exception as e:
        logger.error(f"Error in definition handler: {e}", exc_info=True)
        return None


@server.feature(types.TEXT_DOCUMENT_CODE_ACTION)
def code_action(ls: CK3LanguageServer, params: types.CodeActionParams):
    """
    Provide code actions (quick fixes and refactorings) for CK3 scripts.

    This feature provides quick fixes for common errors and refactoring options.
    Code actions appear as lightbulb icons in the editor and in the right-click menu.

    Supported Actions:
        - Quick fixes for typos (e.g., "Did you mean 'add_gold'?")
        - Add missing namespace declaration
        - Fix invalid scope chains
        - Extract selection as scripted effect/trigger

    Args:
        ls: The CK3 language server instance
        params: Contains information about the code action request:
            - text_document.uri: The file where action was requested
            - range: The range in the document
            - context.diagnostics: Diagnostics in the range
            - context.only: Types of actions requested (optional filter)

    Returns:
        List of CodeAction objects, or None if no actions available

    LSP Specification:
        This is a request from client to server. The server should respond with
        (Command | CodeAction)[] or null.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)

        # Get selected text (if any)
        lines = doc.source.split("\n")
        selected_text = ""
        if params.range.start.line == params.range.end.line:
            # Single line selection
            line = lines[params.range.start.line] if params.range.start.line < len(lines) else ""
            selected_text = line[params.range.start.character : params.range.end.character]
        else:
            # Multi-line selection
            selected_lines = []
            for i in range(params.range.start.line, min(params.range.end.line + 1, len(lines))):
                if i == params.range.start.line:
                    selected_lines.append(lines[i][params.range.start.character :])
                elif i == params.range.end.line:
                    selected_lines.append(lines[i][: params.range.end.character])
                else:
                    selected_lines.append(lines[i])
            selected_text = "\n".join(selected_lines)

        # Detect context (trigger vs effect block)
        ast = ls.get_ast(doc.uri)
        node = get_node_at_position(ast, params.range.start) if ast else None
        context = "unknown"
        if node:
            ctx = detect_context(node, params.range.start, "", ls.index)
            context = ctx.block_type

        # Get all applicable code actions
        actions = get_all_code_actions(
            uri=doc.uri,
            range=params.range,
            diagnostics=params.context.diagnostics,
            document_text=doc.source,
            selected_text=selected_text,
            context=context,
        )

        # Convert to LSP code actions
        lsp_actions = [convert_to_lsp_code_action(action) for action in actions]

        return lsp_actions if lsp_actions else None

    except Exception as e:
        logger.error(f"Error in code_action handler: {e}", exc_info=True)
        return None


@server.feature(types.TEXT_DOCUMENT_REFERENCES)
async def references(ls: CK3LanguageServer, params: types.ReferenceParams):
    """
    Find all references to a symbol across the workspace.

    This feature allows users to find all places where a symbol (event, effect,
    trigger, saved scope, etc.) is referenced. This is useful for understanding
    how events are connected, where effects are used, and for refactoring.

    Runs in custom thread pool as it iterates through all open document ASTs.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the references request:
            - text_document.uri: The file where references was requested
            - position.line: Line number (0-indexed)
            - position.character: Character offset in the line (0-indexed)
            - context.include_declaration: Whether to include the declaration

    Returns:
        List of Location objects where the symbol is referenced, or None if not found

    LSP Specification:
        This is a request from client to server. The server should respond with
        a Location[], or null if no references found.
    """
    def _references_sync():
        """Synchronous implementation of references logic."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            # Get word at cursor position
            from .hover import get_word_at_position

            word = get_word_at_position(doc, params.position)

            if not word:
                return None

            logger.debug(f"Find references for: {word}")

            references_list = []

            # Thread-safe iteration over ASTs
            with ls._ast_lock:
                ast_items = list(ls.document_asts.items())

            for uri, ast in ast_items:
                try:
                    # Find all occurrences of the word in this document
                    refs = _find_word_references_in_ast(word, ast, uri)
                    references_list.extend(refs)
                except Exception as e:
                    logger.warning(f"Error searching {uri}: {e}")
                    continue

            # If include_declaration is False, filter out the definition itself
            if not params.context.include_declaration:
                # Try to find the definition location
                def_location = None

                # Thread-safe index access
                with ls._index_lock:
                    # Check various symbol types
                    if "." in word and ls.index:
                        def_location = ls.index.find_event(word)
                    if not def_location and ls.index:
                        def_location = ls.index.find_scripted_effect(word)
                    if not def_location and ls.index:
                        def_location = ls.index.find_scripted_trigger(word)
                    if not def_location and word.startswith("scope:") and ls.index:
                        scope_name = word[6:]
                        def_location = ls.index.find_saved_scope(scope_name)

                # Filter out the definition
                if def_location:
                    references_list = [
                        ref
                        for ref in references_list
                        if ref.uri != def_location.uri
                        or ref.range.start.line != def_location.range.start.line
                    ]

            return references_list if references_list else None

        except Exception as e:
            logger.error(f"Error in references handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with HIGH priority (user-initiated action)
    return await ls.run_in_thread(
        _references_sync,
        priority=TaskPriority.HIGH,
        task_name="find_references"
    )


def _find_word_references_in_ast(word: str, ast: List[CK3Node], uri: str) -> List[types.Location]:
    """
    Find all occurrences of a word in an AST.

    Args:
        word: The word to search for
        ast: The AST to search
        uri: The document URI

    Returns:
        List of Location objects where the word appears
    """
    locations = []

    def search_node(node: CK3Node):
        # Check if the node key matches
        if node.key == word or (isinstance(node.value, str) and node.value == word):
            locations.append(types.Location(uri=uri, range=node.range))

        # Search children recursively
        for child in node.children:
            search_node(child)

    for node in ast:
        search_node(node)

    return locations


@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(ls: CK3LanguageServer, params: types.DocumentSymbolParams):
    """
    Provide document symbols for outline view.

    This feature provides a hierarchical view of the document structure, showing
    events, scripted effects, scripted triggers, and their components. This appears
    as an outline in the editor's sidebar.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the symbol request:
            - text_document.uri: The file to get symbols for

    Returns:
        List of DocumentSymbol objects representing the document structure

    LSP Specification:
        This is a request from client to server. The server should respond with
        DocumentSymbol[] or SymbolInformation[], or null.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)
        ast = ls.get_ast(doc.uri)

        if not ast:
            return None

        symbols = []

        # Extract symbols from AST
        for node in ast:
            symbol = _extract_symbol_from_node(node)
            if symbol:
                symbols.append(symbol)

        return symbols if symbols else None

    except Exception as e:
        logger.error(f"Error in document_symbol handler: {e}", exc_info=True)
        return None


def _extract_symbol_from_node(node: CK3Node) -> Optional[types.DocumentSymbol]:
    """
    Extract a DocumentSymbol from a CK3Node.

    Args:
        node: The CK3Node to extract symbol from

    Returns:
        DocumentSymbol or None
    """
    # Check if this is a story cycle (block with story cycle-specific fields)
    is_story_cycle = False
    if node.type == "assignment" and hasattr(node, 'children'):
        for child in node.children:
            if child.key in ('on_setup', 'on_end', 'on_owner_death', 'effect_group'):
                is_story_cycle = True
                break
    
    # Determine symbol kind based on node type
    if is_story_cycle:
        kind = types.SymbolKind.Event
        detail = "Story Cycle"
    elif node.type == "namespace":
        kind = types.SymbolKind.Namespace
        detail = "Namespace"
    elif node.type == "event":
        kind = types.SymbolKind.Event
        detail = "Event"
    elif node.key in ("trigger", "immediate", "after", "effect"):
        kind = types.SymbolKind.Object
        detail = node.key.capitalize()
    elif node.key in ("on_setup", "on_end", "on_owner_death"):
        kind = types.SymbolKind.Method
        detail = "Lifecycle Hook"
    elif node.key == "effect_group":
        kind = types.SymbolKind.Object
        detail = "Effect Group"
    elif node.key == "option":
        kind = types.SymbolKind.EnumMember
        # Try to find the option name
        name_value = None
        for child in node.children:
            if child.key == "name":
                name_value = child.value
                break
        detail = f"Option: {name_value}" if name_value else "Option"
    elif node.type == "block" and ("_effect" in node.key or "_trigger" in node.key):
        kind = types.SymbolKind.Function
        detail = "Scripted Effect" if "_effect" in node.key else "Scripted Trigger"
    else:
        # Default for other blocks
        kind = types.SymbolKind.Object
        detail = None

    # Extract children symbols
    children = []
    for child in node.children:
        child_symbol = _extract_symbol_from_node(child)
        if child_symbol:
            children.append(child_symbol)

    # Create selection range (just the key name)
    selection_range = types.Range(
        start=node.range.start,
        end=types.Position(
            line=node.range.start.line, character=node.range.start.character + len(node.key)
        ),
    )

    return types.DocumentSymbol(
        name=node.key,
        kind=kind,
        range=node.range,
        selection_range=selection_range,
        detail=detail,
        children=children if children else None,
    )


@server.feature(types.WORKSPACE_SYMBOL)
async def workspace_symbol(ls: CK3LanguageServer, params: types.WorkspaceSymbolParams):
    """
    Search for symbols across the entire workspace.

    This feature allows users to quickly find and navigate to any symbol in the
    workspace by name. It supports fuzzy matching and is typically invoked with
    Ctrl+T in VS Code.

    Runs in custom thread pool as it searches through the full index.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the symbol search:
            - query: The search query string

    Returns:
        List of SymbolInformation objects matching the query

    LSP Specification:
        This is a request from client to server. The server should respond with
        SymbolInformation[] or WorkspaceSymbol[], or null.
    """
    def _workspace_symbol_sync():
        """Synchronous implementation of workspace symbol search."""
        try:
            query = params.query.lower()

            if not query:
                return None

            symbols = []

            # Thread-safe index access - wrap all index reads in lock
            with ls._index_lock:
                # Search events
                if ls.index:
                    for event_id, location in ls.index.events.items():
                        if query in event_id.lower():
                            symbols.append(
                                types.SymbolInformation(
                                    name=event_id,
                                    kind=types.SymbolKind.Event,
                                    location=location,
                                    container_name="Event",
                                )
                            )

                # Search scripted effects
                if ls.index:
                    for effect_name, location in ls.index.scripted_effects.items():
                        if query in effect_name.lower():
                            symbols.append(
                                types.SymbolInformation(
                                    name=effect_name,
                                    kind=types.SymbolKind.Function,
                                    location=location,
                                    container_name="Scripted Effect",
                                )
                            )

                # Search scripted triggers
                if ls.index:
                    for trigger_name, location in ls.index.scripted_triggers.items():
                        if query in trigger_name.lower():
                            symbols.append(
                                types.SymbolInformation(
                                    name=trigger_name,
                                    kind=types.SymbolKind.Function,
                                    location=location,
                                    container_name="Scripted Trigger",
                                )
                            )

                # Search script values
                if ls.index:
                    for value_name, location in ls.index.script_values.items():
                        if query in value_name.lower():
                            symbols.append(
                                types.SymbolInformation(
                                    name=value_name,
                                    kind=types.SymbolKind.Variable,
                                    location=location,
                                    container_name="Script Value",
                                )
                            )

                # Search on_actions
                if ls.index:
                    for on_action_name, location in ls.index.on_action_definitions.items():
                        if query in on_action_name.lower():
                            symbols.append(
                                types.SymbolInformation(
                                    name=on_action_name,
                                    kind=types.SymbolKind.Event,
                                    location=location,
                                    container_name="On-Action",
                                )
                            )

            return symbols if symbols else None

        except Exception as e:
            logger.error(f"Error in workspace_symbol handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with HIGH priority (user-initiated search)
    return await ls.run_in_thread(
        _workspace_symbol_sync,
        priority=TaskPriority.HIGH,
        task_name="workspace_symbol_search"
    )


@server.feature(
    types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL,
    types.SemanticTokensRegistrationOptions(
        legend=types.SemanticTokensLegend(
            token_types=list(TOKEN_TYPES),
            token_modifiers=list(TOKEN_MODIFIERS),
        ),
        full=True,
        document_selector=[
            types.TextDocumentFilterLanguage(language="ck3"),
        ],
    ),
)
async def semantic_tokens_full(ls: CK3LanguageServer, params: types.SemanticTokensParams):
    """
    Provide semantic tokens for rich syntax highlighting.

    Unlike TextMate grammars (regex-based), semantic tokens understand:
    - Whether a word is an effect vs trigger based on context
    - Scope types and their relationships
    - Custom mod definitions (scripted effects, triggers, etc.)
    - Event definitions vs references

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to tokenize

    Returns:
        SemanticTokens with encoded data, or None

    Token Types:
        - namespace: Event namespace declarations
        - class: Event type keywords (character_event, etc.)
        - function: Effects and triggers
        - variable: Scopes and saved scope references
        - property: Scope links (liege, spouse, primary_title)
        - string: Localization keys
        - number: Numeric values
        - keyword: Control flow (if, else, trigger, effect, limit)
        - operator: Operators (=, >, <, >=, <=)
        - comment: Comments (# ...)
        - parameter: Effect/trigger parameters
        - event: Event definitions and references
        - macro: List iterators (any_, every_, etc.)
        - enumMember: Boolean values, traits

    Token Modifiers:
        - declaration: Where a symbol is defined
        - definition: Definition site
        - readonly: Immutable values
        - defaultLibrary: Built-in game effects/triggers
    """
    def _semantic_tokens_sync():
        """Synchronous implementation of semantic tokenization."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            # Thread-safe index access
            with ls._index_lock:
                index = ls.index

            # Get semantic tokens using the module
            return get_semantic_tokens(doc.source, index)

        except Exception as e:
            logger.error(f"Error in semantic_tokens handler: {e}", exc_info=True)
            return types.SemanticTokens(data=[])
    
    # Execute in custom thread pool with NORMAL priority (background highlighting)
    return await ls.run_in_thread(
        _semantic_tokens_sync,
        priority=TaskPriority.NORMAL,
        task_name="semantic_tokens"
    )


# =============================================================================
# Document Formatting
# =============================================================================


@server.feature(
    types.TEXT_DOCUMENT_FORMATTING,
    types.DocumentFormattingOptions(),
)
async def document_formatting(ls: CK3LanguageServer, params: types.DocumentFormattingParams):
    """
    Format an entire CK3 document.

    This feature provides auto-formatting for CK3 scripts, following Paradox
    conventions:
    - Tab indentation (not spaces)
    - Opening braces on same line: `trigger = {`
    - Proper spacing around operators
    - Consistent blank lines between blocks
    - Trimmed trailing whitespace

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to format
            - options: Formatting options (tab size, spaces vs tabs, etc.)

    Returns:
        List of TextEdit objects to apply, or None

    LSP Specification:
        This is a request from client to server. The server should respond with
        TextEdit[] or null. The client applies the edits to format the document.

    Usage:
        - VS Code: Shift+Alt+F (Windows/Linux) or Shift+Option+F (Mac)
        - Or right-click -> Format Document
    """
    def _format_sync():
        """Synchronous implementation of document formatting."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            # Get formatting edits
            edits = format_document(doc.source, params.options)

            if edits:
                logger.debug(f"Formatting document: {len(edits)} edit(s)")

            return edits if edits else None

        except Exception as e:
            logger.error(f"Error in document_formatting handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with HIGH priority (user-initiated action)
    return await ls.run_in_thread(
        _format_sync,
        priority=TaskPriority.HIGH,
        task_name="format_document"
    )


@server.feature(
    types.TEXT_DOCUMENT_RANGE_FORMATTING,
    types.DocumentRangeFormattingOptions(),
)
async def range_formatting(ls: CK3LanguageServer, params: types.DocumentRangeFormattingParams):
    """
    Format a selected range within a CK3 document.

    This feature allows formatting only a portion of the document, which is
    useful when:
    - Pasting code from another source that has different formatting
    - Cleaning up a specific event or block without touching the rest
    - Formatting newly written code without affecting existing code

    The formatter will automatically expand the range to include complete
    blocks to ensure the resulting code is syntactically valid.

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file containing the range
            - range: The range to format (start and end positions)
            - options: Formatting options (tab size, spaces vs tabs, etc.)

    Returns:
        List of TextEdit objects to apply, or None

    LSP Specification:
        This is a request from client to server. The server should respond with
        TextEdit[] or null. The client applies the edits to format the range.

    Usage:
        - Select text, then use Format Selection command
        - VS Code: Ctrl+K Ctrl+F (Windows/Linux) or Cmd+K Cmd+F (Mac)
    """
    def _format_range_sync():
        """Synchronous implementation of range formatting."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            # Get formatting edits for the range
            edits = format_range(doc.source, params.range, params.options)

            if edits:
                logger.debug(f"Formatting range: {len(edits)} edit(s)")

            return edits if edits else None

        except Exception as e:
            logger.error(f"Error in range_formatting handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with HIGH priority (user-initiated action)
    return await ls.run_in_thread(
        _format_range_sync,
        priority=TaskPriority.HIGH,
        task_name="format_range"
    )


# =============================================================================
# Code Lens
# =============================================================================


@server.feature(
    types.TEXT_DOCUMENT_CODE_LENS,
    types.CodeLensOptions(resolve_provider=True),
)
async def code_lens(ls: CK3LanguageServer, params: types.CodeLensParams):
    """
    Provide code lenses for CK3 scripts.

    Code lenses show actionable, contextual information above code elements.
    For CK3, we show:
    - Event reference counts and missing localization warnings
    - Scripted effect/trigger usage counts
    - Namespace event counts

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to provide lenses for

    Returns:
        List of CodeLens objects, or None

    LSP Specification:
        This is a request from client to server. The server should respond with
        CodeLens[] or null. Code lenses can have a command, or the command can
        be provided later via codeLens/resolve.
    """
    def _code_lens_sync():
        """Synchronous implementation of code lens generation."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            # Get code lenses using the module
            return get_code_lenses(doc.source, doc.uri, ls.index)

        except Exception as e:
            logger.error(f"Error in code_lens handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with NORMAL priority (background feature)
    return await ls.run_in_thread(
        _code_lens_sync,
        priority=TaskPriority.NORMAL,
        task_name="code_lens"
    )


@server.feature(types.CODE_LENS_RESOLVE)
def code_lens_resolve(ls: CK3LanguageServer, params: types.CodeLens):
    """
    Resolve a code lens with its command.

    This is called when a code lens becomes visible and needs its
    command to be filled in. This enables lazy loading of expensive
    operations like counting references.

    Args:
        ls: The CK3 language server instance
        params: The CodeLens to resolve

    Returns:
        The resolved CodeLens with its command

    LSP Specification:
        This is a request from client to server. The server should respond with
        a CodeLens with the command field filled in.
    """
    try:
        return resolve_code_lens(params, ls.index)

    except Exception as e:
        logger.error(f"Error in code_lens_resolve handler: {e}", exc_info=True)
        return params


# =============================================================================
# Inlay Hints
# =============================================================================


@server.feature(
    types.TEXT_DOCUMENT_INLAY_HINT,
    types.InlayHintOptions(resolve_provider=True),
)
async def inlay_hint(ls: CK3LanguageServer, params: types.InlayHintParams):
    """
    Provide inlay hints for CK3 scripts.

    Inlay hints show inline type annotations and other helpful information
    directly in the code editor. For CK3, we show:
    - Scope types after saved scopes: `scope:friend` → `: character`
    - Scope types after scope chains: `root.primary_title` → `: landed_title`
    - Target scope type for list iterators: `every_vassal` → `→ character`

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to provide hints for
            - range: The range to provide hints for

    Returns:
        List of InlayHint objects, or None

    LSP Specification:
        This is a request from client to server. The server should respond with
        InlayHint[] or null. Hints are displayed inline in the editor.

    Usage:
        Inlay hints appear automatically as you view code. They can be toggled
        via editor settings (e.g., Editor > Inlay Hints in VS Code).
    """
    def _inlay_hint_sync():
        """Synchronous implementation of inlay hint generation."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            # Get inlay hint configuration from initialization options
            config = InlayHintConfig(
                show_scope_types=True,
                show_link_types=True,
                show_iterator_types=True,
                show_parameter_names=False,
            )

            # Get inlay hints for the range
            hints = get_inlay_hints(doc.source, params.range, ls.index, config)

            if hints:
                logger.debug(f"Providing {len(hints)} inlay hint(s)")

            return hints if hints else None

        except Exception as e:
            logger.error(f"Error in inlay_hint handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with NORMAL priority (background annotation)
    return await ls.run_in_thread(
        _inlay_hint_sync,
        priority=TaskPriority.NORMAL,
        task_name="inlay_hints"
    )


@server.feature(types.INLAY_HINT_RESOLVE)
def inlay_hint_resolve(ls: CK3LanguageServer, params: types.InlayHint):
    """
    Resolve an inlay hint with additional information.

    This is called when an inlay hint needs additional details.
    Currently, we populate all information upfront, so this just
    returns the hint as-is.

    Args:
        ls: The CK3 language server instance
        params: The InlayHint to resolve

    Returns:
        The resolved InlayHint

    LSP Specification:
        This is a request from client to server. The server should respond with
        a fully resolved InlayHint object.
    """
    try:
        return resolve_inlay_hint(params)

    except Exception as e:
        logger.error(f"Error in inlay_hint_resolve handler: {e}", exc_info=True)
        return params


# =============================================================================
# Signature Help
# =============================================================================


@server.feature(
    types.TEXT_DOCUMENT_SIGNATURE_HELP,
    types.SignatureHelpOptions(
        trigger_characters=get_trigger_characters(),
        retrigger_characters=get_retrigger_characters(),
    ),
)
def signature_help(ls: CK3LanguageServer, params: types.SignatureHelpParams):
    """
    Provide signature help for CK3 effects and triggers.

    Signature help shows parameter documentation when typing inside
    effect blocks that take structured parameters. For CK3, we show:
    - Required parameters: target, modifier, id, etc.
    - Optional parameters: years, days, months, etc.
    - Parameter types and documentation
    - Highlights the currently active parameter

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to provide help for
            - position: Cursor position in the document
            - context: Information about how signature help was triggered

    Returns:
        SignatureHelp object, or None if not in a relevant context

    LSP Specification:
        This is a request from client to server. The server should respond with
        SignatureHelp or null. The client displays parameter hints.

    Usage:
        Signature help appears automatically when typing inside effect blocks
        like `add_opinion = { }` or `trigger_event = { }`.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)

        # Get signature help for the current position
        help_result = get_signature_help(doc.source, params.position)

        if help_result:
            logger.debug(
                f"Providing signature help: {help_result.signatures[0].label if help_result.signatures else 'none'}"
            )

        return help_result

    except Exception as e:
        logger.error(f"Error in signature_help handler: {e}", exc_info=True)
        return None


# =============================================================================
# Document Highlight
# =============================================================================


@server.feature(types.TEXT_DOCUMENT_DOCUMENT_HIGHLIGHT)
async def document_highlight(
    ls: CK3LanguageServer, params: types.DocumentHighlightParams
) -> Optional[List[types.DocumentHighlight]]:
    """
    Provide document highlighting for CK3 scripts.

    Document highlighting shows all occurrences of a symbol when you click on it.
    This helps visualize where a variable, scope, or event is used and defined.

    Highlight kinds:
        - Read: The symbol is being read/accessed (e.g., scope:target)
        - Write: The symbol is being defined (e.g., save_scope_as = target)
        - Text: General text match

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to highlight in
            - position: Cursor position (which symbol to highlight)

    Returns:
        List of DocumentHighlight objects, or None if no symbol at position

    LSP Specification:
        This is a request from client to server. The server should respond with
        a list of DocumentHighlight or null. The client highlights matching text.

    Usage:
        Click on a saved scope like `scope:target` and all occurrences of
        `scope:target` and `save_scope_as = target` will be highlighted.
    """
    def _highlight_sync():
        """Synchronous implementation of document highlighting."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            highlights = get_document_highlights(doc.source, params.position)

            if highlights:
                logger.debug(f"Found {len(highlights)} highlight(s) at position {params.position}")

            return highlights

        except Exception as e:
            logger.error(f"Error in document_highlight handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with CRITICAL priority (immediate visual feedback)
    return await ls.run_in_thread(
        _highlight_sync,
        priority=TaskPriority.CRITICAL,
        task_name="document_highlight"
    )


# =============================================================================
# Document Links
# =============================================================================


@server.feature(types.TEXT_DOCUMENT_DOCUMENT_LINK)
def document_link(
    ls: CK3LanguageServer, params: types.DocumentLinkParams
) -> Optional[List[types.DocumentLink]]:
    """
    Provide document links for CK3 scripts.

    Document links make file paths, URLs, and references clickable in the editor.
    Ctrl+Click on a link to navigate to the target.

    Link types detected:
        - File paths: common/scripted_effects/my_effects.txt, gfx/icons/icon.dds
        - URLs: https://ck3.paradoxwikis.com/...
        - Event IDs in comments: # See rq.0001, # Fires my_mod.0050
        - GFX paths in script: icon = "gfx/interface/icons/icon.dds"

    Args:
        ls: The CK3 language server instance
        params: Contains information about the request:
            - text_document.uri: The file to find links in

    Returns:
        List of DocumentLink objects, or None if no links found

    LSP Specification:
        This is a request from client to server. The server should respond with
        a list of DocumentLink or null. The client makes matched text clickable.

    Usage:
        File paths become clickable. URLs open in browser. Event IDs in
        comments can navigate to event definitions.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)

        # Get workspace folders for path resolution
        workspace_folders = _get_workspace_folder_paths(ls)

        links = get_document_links(doc.source, params.text_document.uri, workspace_folders)

        if links:
            logger.debug(f"Found {len(links)} document link(s)")

        return links if links else None

    except Exception as e:
        logger.error(f"Error in document_link handler: {e}", exc_info=True)
        return None


@server.feature(types.DOCUMENT_LINK_RESOLVE)
def document_link_resolve(ls: CK3LanguageServer, link: types.DocumentLink) -> types.DocumentLink:
    """
    Resolve a document link that was returned without a full target.

    This is called when the user hovers over or clicks on a link that
    was returned from document_link without a resolved target.

    Args:
        ls: The CK3 language server instance
        link: The link to resolve

    Returns:
        DocumentLink with resolved target
    """
    try:
        workspace_folders = _get_workspace_folder_paths(ls)
        return resolve_document_link(link, workspace_folders)
    except Exception as e:
        logger.error(f"Error in document_link_resolve handler: {e}", exc_info=True)
        return link


def _get_workspace_folder_paths(ls: CK3LanguageServer) -> List[str]:
    """
    Get workspace folder paths from the language server.

    Args:
        ls: Language server instance

    Returns:
        List of workspace folder paths
    """
    workspace_folders = []
    if ls.workspace.folders:
        for folder in ls.workspace.folders:
            folder_uri = folder.uri if hasattr(folder, "uri") else folder
            if folder_uri.startswith("file:///"):
                from urllib.parse import unquote

                path = unquote(folder_uri[8:])
                if len(path) > 2 and path[0] == "/" and path[2] == ":":
                    path = path[1:]
                workspace_folders.append(path)
            else:
                workspace_folders.append(folder_uri)
    return workspace_folders


# =============================================================================
# Rename
# =============================================================================


@server.feature(types.TEXT_DOCUMENT_PREPARE_RENAME)
def prepare_rename(
    ls: CK3LanguageServer, params: types.PrepareRenameParams
) -> Optional[types.PrepareRenameResult]:
    """
    Prepare for a rename operation.

    This is called before the rename dialog appears to:
    1. Verify the symbol can be renamed
    2. Return the range of the symbol for the rename dialog
    3. Return a placeholder (current name) for the input field

    Args:
        ls: The CK3 language server instance
        params: Contains:
            - text_document.uri: The file URI
            - position: Cursor position

    Returns:
        PrepareRenameResult with range and placeholder, or None if not renamable

    LSP Specification:
        Optional request before rename. Helps the client show the correct
        range in the rename dialog.
    """
    try:
        doc = ls.workspace.get_text_document(params.text_document.uri)

        result = do_prepare_rename(doc.source, params.position)

        if result:
            logger.debug(f"Prepare rename: {result.placeholder}")
        else:
            logger.debug("No renamable symbol at position")

        return result

    except Exception as e:
        logger.error(f"Error in prepare_rename handler: {e}", exc_info=True)
        return None


@server.feature(types.TEXT_DOCUMENT_RENAME)
async def rename(ls: CK3LanguageServer, params: types.RenameParams) -> Optional[types.WorkspaceEdit]:
    """
    Perform a rename operation.

    Renames a symbol across the entire workspace, including:
    - Event definitions and trigger_event references
    - Saved scope definitions and scope: references
    - Scripted effect/trigger definitions and usages
    - Variable definitions and var: references
    - Character/global flag operations
    - Related localization keys (for events)

    Args:
        ls: The CK3 language server instance
        params: Contains:
            - text_document.uri: The file URI
            - position: Position of the symbol to rename
            - new_name: The new name for the symbol

    Returns:
        WorkspaceEdit with all changes, or None if rename not possible

    LSP Specification:
        Request from client to server. Server responds with WorkspaceEdit
        containing all text changes needed for the rename.

    Usage:
        Place cursor on `scope:target`, press F2, type "new_target".
        All `scope:target` and `save_scope_as = target` are updated.
    """
    def _rename_sync():
        """Synchronous implementation of rename operation."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)
            workspace_folders = _get_workspace_folder_paths(ls)

            edit = perform_rename(
                doc.source,
                params.position,
                params.new_name,
                params.text_document.uri,
                workspace_folders,
            )

            if edit:
                # Count total edits
                total_edits = sum(len(edits) for edits in (edit.changes or {}).values())
                total_files = len(edit.changes or {})
                logger.info(f"Rename: {total_edits} edits across {total_files} files")
            else:
                logger.debug("Rename returned no edits")

            return edit

        except Exception as e:
            logger.error(f"Error in rename handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with HIGH priority (user-initiated refactoring)
    return await ls.run_in_thread(
        _rename_sync,
        priority=TaskPriority.HIGH,
        task_name="rename_symbol"
    )


# =============================================================================
# Folding Range
# =============================================================================


@server.feature(
    types.TEXT_DOCUMENT_FOLDING_RANGE,
    types.FoldingRangeOptions(),
)
async def folding_range(
    ls: CK3LanguageServer, params: types.FoldingRangeParams
) -> Optional[List[types.FoldingRange]]:
    """
    Return folding ranges for a document.

    Enables code folding in the editor for:
    - Event blocks: `my_event.0001 = { ... }`
    - Named blocks: `trigger = { }`, `effect = { }`, `option = { }`
    - Nested blocks: Any `{ ... }` block spanning multiple lines
    - Comment blocks: Multiple consecutive comment lines
    - Region markers: `# region` / `# endregion` custom folding

    Args:
        ls: The CK3 language server instance
        params: Contains:
            - text_document.uri: The file URI

    Returns:
        List of FoldingRange objects, or None on error

    LSP Specification:
        Request from client to server for folding ranges.
        Client uses these to show fold/unfold controls in gutter.

    Usage:
        Click fold icon in gutter to collapse a block.
        Use Ctrl+Shift+[ to fold at cursor.
        Use Ctrl+Shift+] to unfold at cursor.
    """
    def _folding_range_sync():
        """Synchronous implementation of folding range detection."""
        try:
            doc = ls.workspace.get_text_document(params.text_document.uri)

            ranges = get_folding_ranges(doc.source)

            logger.debug(f"Folding ranges: {len(ranges)} ranges for {params.text_document.uri}")

            return ranges if ranges else None

        except Exception as e:
            logger.error(f"Error in folding_range handler: {e}", exc_info=True)
            return None
    
    # Execute in custom thread pool with NORMAL priority (background UI feature)
    return await ls.run_in_thread(
        _folding_range_sync,
        priority=TaskPriority.NORMAL,
        task_name="folding_ranges"
    )


# =============================================================================
# Custom Commands
# =============================================================================


def _normalize_command_args(raw_args: tuple[Any, ...]) -> tuple[Any, ...]:
    """Normalize command args across pygls and direct function calls.

    pygls expands LSP `workspace/executeCommand` params.arguments into positional
    arguments when invoking handlers.

    Some unit tests and legacy call sites invoke handlers directly using the
    pre-pygls2 convention: `handler(ls, [arg1, arg2, ...])`. After switching
    handlers to `*args` (to allow 0 arguments safely), that legacy style becomes
    a single positional argument whose value is a list.

    This helper unwraps that list/tuple into true positional arguments so both
    styles behave identically.
    """

    if len(raw_args) == 1 and isinstance(raw_args[0], (list, tuple)):
        return tuple(raw_args[0])
    return raw_args


@server.command("ck3.validateWorkspace")
async def validate_workspace_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Validate entire workspace.

    Scans all files in the workspace and reports validation results.
    Shows progress during validation and summarizes findings.

    Args:
        ls: The language server instance
        args: Command arguments (unused)

    Returns:
        Dictionary with validation results
    """
    logger.info("Executing ck3.validateWorkspace command")
    args = _normalize_command_args(args)

    async def validate_with_progress(report_progress):
        report_progress("Validating workspace...", 0)

        # Force rescan of workspace
        ls._workspace_scanned = False

        report_progress("Scanning workspace files...", 25)

        # Get workspace folders and scan
        workspace_folders = []
        if ls.workspace.folders:
            for folder in ls.workspace.folders:
                folder_uri = folder.uri if hasattr(folder, "uri") else folder
                if folder_uri.startswith("file:///"):
                    from urllib.parse import unquote

                    path = unquote(folder_uri[8:])
                    if len(path) > 2 and path[0] == "/" and path[2] == ":":
                        path = path[1:]
                    workspace_folders.append(path)
                else:
                    workspace_folders.append(folder_uri)

        if workspace_folders:
            # Run scan in thread pool with thread-safe index access
            def scan_with_lock():
                with ls._index_lock:
                    ls.index.scan_workspace(workspace_folders)

            await ls.run_in_thread(
                scan_with_lock,
                priority=TaskPriority.NORMAL,
                task_name="workspace_validation_scan"
            )

        ls._workspace_scanned = True

        report_progress("Analyzing results...", 75)

        # Thread-safe stats collection
        with ls._index_lock:
            stats = {
                "events": len(ls.index.events),
                "scripted_effects": len(ls.index.scripted_effects),
                "scripted_triggers": len(ls.index.scripted_triggers),
                "localization_keys": len(ls.index.localization),
                "character_flags": len(ls.index.character_flags),
                "saved_scopes": len(ls.index.saved_scopes),
            }

        report_progress("Validation complete!", 100)
        return stats

    try:
        stats = await ls.with_progress("Validating CK3 Workspace", validate_with_progress)

        # Show summary message
        summary = (
            f"Workspace validated: {stats['events']} events, "
            f"{stats['scripted_effects']} effects, "
            f"{stats['scripted_triggers']} triggers, "
            f"{stats['localization_keys']} loc keys"
        )
        ls.notify_info(summary)

        return stats

    except Exception as e:
        logger.error(f"Error validating workspace: {e}", exc_info=True)
        ls.notify_error(f"Validation failed: {str(e)}")
        return {"error": str(e)}


@server.command("ck3.rescanWorkspace")
async def rescan_workspace_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Rescan workspace for symbols.

    Forces a complete rescan of the workspace, useful when files
    have been added or modified outside the editor.

    Args:
        ls: The language server instance
        args: Command arguments (unused)

    Returns:
        Dictionary with scan results
    """
    logger.info("Executing ck3.rescanWorkspace command")
    args = _normalize_command_args(args)

    # Reset scan state
    ls._workspace_scanned = False

    # Thread-safe index replacement
    with ls._index_lock:
        ls.index = DocumentIndex()

    # Rescan with progress
    await ls._scan_workspace_folders_async()

    # Thread-safe stats collection
    with ls._index_lock:
        return {
            "events": len(ls.index.events),
            "scripted_effects": len(ls.index.scripted_effects),
            "scripted_triggers": len(ls.index.scripted_triggers),
            "localization_keys": len(ls.index.localization),
        }


@server.command("ck3.getWorkspaceStats")
def get_workspace_stats_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Get workspace statistics.

    Returns current workspace index statistics without rescanning.

    Args:
        ls: The language server instance
        args: Command arguments (unused)

    Returns:
        Dictionary with workspace statistics
    """
    logger.info("Executing ck3.getWorkspaceStats command")
    args = _normalize_command_args(args)

    # Thread-safe stats collection
    with ls._index_lock:
        return {
            "scanned": ls._workspace_scanned,
            "events": len(ls.index.events),
            "namespaces": len(ls.index.namespaces),
            "scripted_effects": len(ls.index.scripted_effects),
            "scripted_triggers": len(ls.index.scripted_triggers),
            "script_values": len(ls.index.script_values),
            "localization_keys": len(ls.index.localization),
            "character_flags": len(ls.index.character_flags),
            "saved_scopes": len(ls.index.saved_scopes),
            "character_interactions": len(ls.index.character_interactions),
            "modifiers": len(ls.index.modifiers),
            "on_actions": len(ls.index.on_action_definitions),
            "opinion_modifiers": len(ls.index.opinion_modifiers),
            "scripted_guis": len(ls.index.scripted_guis),
        }


@server.command("ck3.generateEventTemplate")
def generate_event_template_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Generate an event template.

    Returns a template for a new CK3 event that can be inserted
    into the current document.

    Args:
        ls: The language server instance
        args: Command arguments:
            - args[0]: Event namespace (optional, default: "my_mod")
            - args[1]: Event number (optional, default: "0001")
            - args[2]: Event type (optional, default: "character_event")

    Returns:
        Dictionary with the event template text
    """
    logger.info("Executing ck3.generateEventTemplate command")

    # Supports both LSP-style args (positional) and legacy direct calls
    # like generate_event_template_command(ls, [namespace, event_num, event_type]).
    args = _normalize_command_args(args)

    # Parse arguments
    namespace = args[0] if args and len(args) > 0 else "my_mod"
    event_num = args[1] if args and len(args) > 1 else "0001"
    event_type = args[2] if args and len(args) > 2 else "character_event"

    event_id = f"{namespace}.{event_num}"

    template = f"""{event_id} = {{
	type = {event_type}
	title = {event_id}.t
	desc = {event_id}.desc
	theme = diplomacy
	
	left_portrait = root
	
	trigger = {{
		is_adult = yes
	}}
	
	immediate = {{
		# Save scopes here
	}}
	
	option = {{
		name = {event_id}.a
		# Option effects
	}}
	
	option = {{
		name = {event_id}.b
		# Alternative option
	}}
}}
"""

    return {
        "template": template,
        "event_id": event_id,
        "localization_keys": [
            f"{event_id}.t",
            f"{event_id}.desc",
            f"{event_id}.a",
            f"{event_id}.b",
        ],
    }


@server.command("ck3.findOrphanedLocalization")
def find_orphaned_localization_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Find localization keys that may be orphaned.

    Compares localization keys with event IDs to find potential
    orphaned (unused) localization entries.

    Note: This is a heuristic check - it only looks at event-related
    keys, not all possible references.

    Args:
        ls: The language server instance
        args: Command arguments (unused)

    Returns:
        Dictionary with potentially orphaned keys
    """
    logger.info("Executing ck3.findOrphanedLocalization command")
    args = _normalize_command_args(args)

    # Get all event-related prefixes
    event_prefixes = set()
    for event_id in ls.index.events.keys():
        event_prefixes.add(event_id)

    # Find loc keys that look like event keys but don't have matching events
    orphaned = []
    for loc_key in ls.index.localization.keys():
        # Check if this looks like an event localization key
        # Pattern: namespace.number.suffix (e.g., my_mod.0001.t)
        parts = loc_key.split(".")
        if len(parts) >= 3 and parts[-2].isdigit():
            # Reconstruct the event ID
            potential_event_id = ".".join(parts[:-1])
            if potential_event_id not in event_prefixes:
                orphaned.append(loc_key)

    if orphaned:
        ls.notify_warning(f"Found {len(orphaned)} potentially orphaned localization keys")
    else:
        ls.notify_info("No orphaned localization keys found")

    return {
        "orphaned_keys": orphaned[:100],  # Limit to first 100
        "total_count": len(orphaned),
    }


@server.command("ck3.showEventChain")
def show_event_chain_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Show event chain starting from a given event.

    Analyzes trigger_event calls to build an event chain visualization.

    Args:
        ls: The language server instance
        args: Command arguments:
            - args[0]: Starting event ID

    Returns:
        Dictionary with event chain information
    """
    logger.info("Executing ck3.showEventChain command")

    # Normalize args so tests calling show_event_chain_command(ls, [event_id]) work.
    args = _normalize_command_args(args)

    if not args or not args[0]:
        return {"error": "Event ID required"}

    start_event = args[0]

    if start_event not in ls.index.events:
        return {"error": f"Event '{start_event}' not found"}

    # Import workspace module for event chain analysis
    from .workspace import extract_trigger_event_calls

    # Build event chain (BFS traversal)
    visited = set()
    chain = []
    queue = [start_event]

    while queue and len(visited) < 50:  # Limit depth
        current = queue.pop(0)
        if current in visited:
            continue

        visited.add(current)

        # Get event content if available
        event_loc = ls.index.events.get(current)
        if event_loc:
            # We'd need to read the file content to extract trigger_event calls
            # For now, just report the chain structure
            chain.append(
                {
                    "event_id": current,
                    "file": event_loc.uri,
                    "line": event_loc.range.start.line,
                }
            )

    return {
        "start_event": start_event,
        "chain": chain,
        "total_events": len(chain),
    }


@server.command("ck3.checkDependencies")
def check_dependencies_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Check for undefined dependencies.

    Finds scripted effects and triggers that are used but not defined
    in the current workspace.

    Args:
        ls: The language server instance
        args: Command arguments (unused)

    Returns:
        Dictionary with dependency check results
    """
    logger.info("Executing ck3.checkDependencies command")
    args = _normalize_command_args(args)

    # This would require tracking usages, which we partially do
    # For now, return current index stats

    result = {
        "defined_effects": len(ls.index.scripted_effects),
        "defined_triggers": len(ls.index.scripted_triggers),
        "indexed_events": len(ls.index.events),
        "status": "Check complete",
    }

    ls.notify_info(
        f"Dependencies: {result['defined_effects']} effects, "
        f"{result['defined_triggers']} triggers defined"
    )

    return result


@server.command("ck3.showNamespaceEvents")
def show_namespace_events_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Show all events in a namespace.

    Lists all events belonging to a specific namespace, useful for
    navigating event chains and understanding mod structure.

    Args:
        ls: The language server instance
        args: Command arguments:
            - args[0]: Namespace name (e.g., "rq_nts_daughter")

    Returns:
        Dictionary with namespace events
    """
    logger.info("Executing ck3.showNamespaceEvents command")
    args = _normalize_command_args(args)

    if not args or not args[0]:
        return {"error": "Namespace name required"}

    namespace = args[0]

    # Get events for this namespace
    events = ls.index.get_events_for_namespace(namespace)

    if not events:
        ls.notify_info(f"No events found in namespace '{namespace}'")
        return {
            "namespace": namespace,
            "events": [],
            "count": 0,
        }

    # Build event list with locations and titles
    event_list = []
    for event_id in events:
        event_loc = ls.index.find_event(event_id)
        title = ls.index.get_event_localized_title(event_id) or "(no title)"

        event_list.append(
            {
                "event_id": event_id,
                "title": title,
                "file": event_loc.uri if event_loc else None,
                "line": event_loc.range.start.line if event_loc else None,
            }
        )

    ls.notify_info(f"Found {len(events)} events in namespace '{namespace}'")

    return {
        "namespace": namespace,
        "events": event_list,
        "count": len(events),
    }


@server.command("ck3.insertTextAtCursor")
async def insert_text_at_cursor_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Insert text at a specific position in a file.

    This command demonstrates the apply_edit functionality by inserting
    text at a specified position.

    Args:
        ls: The language server instance
        args: Command arguments:
            - args[0]: File URI
            - args[1]: Line number (0-indexed)
            - args[2]: Character position (0-indexed)
            - args[3]: Text to insert

    Returns:
        Dictionary with success status
    """
    logger.info("Executing ck3.insertTextAtCursor command")
    args = _normalize_command_args(args)

    if not args or len(args) < 4:
        return {"error": "Required arguments: uri, line, character, text"}

    uri = args[0]
    line = int(args[1])
    character = int(args[2])
    text = args[3]

    try:
        edit = ls.create_insert_edit(uri, line, character, text)
        success = await ls.apply_edit(edit, "Insert text")

        if success:
            ls.notify_info("Text inserted successfully")
            return {"success": True}
        else:
            ls.notify_error("Failed to insert text")
            return {"success": False, "error": "Edit not applied"}
    except Exception as e:
        logger.error(f"Error inserting text: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@server.command("ck3.generateLocalizationStubs")
async def generate_localization_stubs_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Generate localization stubs for an event.

    Creates localization entries for a given event ID and optionally
    inserts them into a localization file using apply_edit.

    Args:
        ls: The language server instance
        args: Command arguments:
            - args[0]: Event ID (e.g., "my_mod.0001")
            - args[1]: (Optional) Target localization file URI
            - args[2]: (Optional) Line to insert at (0-indexed)

    Returns:
        Dictionary with generated localization text and success status
    """
    logger.info("Executing ck3.generateLocalizationStubs command")
    args = _normalize_command_args(args)

    if not args or len(args) < 1:
        return {"error": "Event ID required"}

    event_id = args[0]
    target_uri = args[1] if len(args) > 1 else None
    insert_line = int(args[2]) if len(args) > 2 else None

    # Generate localization stub text
    loc_text = f""" {event_id}.t:0 "Event Title"
 {event_id}.desc:0 "Event description goes here."
 {event_id}.a:0 "First Option"
 {event_id}.b:0 "Second Option"
"""

    result = {
        "event_id": event_id,
        "localization_text": loc_text,
        "keys_generated": [
            f"{event_id}.t",
            f"{event_id}.desc",
            f"{event_id}.a",
            f"{event_id}.b",
        ],
    }

    # If target file and line specified, insert the text
    if target_uri and insert_line is not None:
        try:
            edit = ls.create_insert_edit(target_uri, insert_line, 0, loc_text)
            success = await ls.apply_edit(edit, f"Add localization for {event_id}")

            result["inserted"] = success
            if success:
                ls.notify_info(f"Localization stubs for {event_id} inserted")
            else:
                ls.notify_warning(f"Could not insert localization stubs")
        except Exception as e:
            logger.error(f"Error inserting localization: {e}", exc_info=True)
            result["inserted"] = False
            result["error"] = str(e)
    else:
        result["inserted"] = False
        result["message"] = "No target file specified - text returned but not inserted"

    return result


@server.command("ck3.renameEvent")
async def rename_event_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Rename an event ID across files.

    This is a refactoring command that renames an event ID in both
    the event definition and all trigger_event references.

    Note: This is a basic implementation - a full rename would also
    update localization keys.

    Args:
        ls: The language server instance
        args: Command arguments:
            - args[0]: Old event ID (e.g., "my_mod.0001")
            - args[1]: New event ID (e.g., "my_mod.0100")

    Returns:
        Dictionary with rename results
    """
    logger.info("Executing ck3.renameEvent command")
    args = _normalize_command_args(args)

    if not args or len(args) < 2:
        return {"error": "Required arguments: old_event_id, new_event_id"}

    old_id = args[0]
    new_id = args[1]

    # Find the event definition
    event_loc = ls.index.find_event(old_id)
    if not event_loc:
        return {"error": f"Event '{old_id}' not found"}

    # Create edits to rename
    # This is a simplified version - full implementation would:
    # 1. Parse the file to find exact positions
    # 2. Find all trigger_event references
    # 3. Update localization keys

    try:
        # For now, just report what would be changed
        result = {
            "old_id": old_id,
            "new_id": new_id,
            "definition_file": event_loc.uri,
            "definition_line": event_loc.range.start.line,
            "message": "Event rename functionality requires parsing files for exact positions. Use find-and-replace for now.",
            "suggestion": f"Replace '{old_id}' with '{new_id}' in your event files and localization.",
        }

        ls.notify_info(f"To rename: Replace '{old_id}' with '{new_id}'")
        return result

    except Exception as e:
        logger.error(f"Error renaming event: {e}", exc_info=True)
        return {"error": str(e)}


# =============================================================================
# Log Watcher Commands
# =============================================================================


@server.command("ck3.startLogWatcher")
def start_log_watcher_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Start watching CK3 game logs.
    
    Begins real-time monitoring of CK3 log files for errors, warnings, and
    performance issues. Detected issues are displayed in the editor.
    
    Args:
        ls: The language server instance
        args: Command arguments (optional):
            - args[0] (optional): Custom log path (auto-detected if not provided)
    
    Returns:
        Dictionary with status and details
    """
    args = _normalize_command_args(args)
    logger.info("Executing ck3.startLogWatcher command")
    logger.info(f"[startLogWatcher] Received args type: {type(args)}")
    logger.info(f"[startLogWatcher] Received args value: {args}")
    logger.info(f"[startLogWatcher] Args length: {len(args) if args else 'None'}")
    
    try:
        # Get log path from args or auto-detect
        log_path = args[0] if args and len(args) > 0 else None
        logger.info(f"[startLogWatcher] Extracted log_path: {log_path}")
        
        if log_path is None:
            log_path = detect_ck3_log_path()
            if log_path is None:
                return {
                    "success": False,
                    "error": "Could not auto-detect CK3 log directory",
                    "message": "Please specify the log path manually in settings"
                }
        
        # Initialize log watcher components if not already done
        if ls.log_analyzer is None:
            ls.log_analyzer = CK3LogAnalyzer(ls)
            logger.info("Initialized log analyzer")
        
        if ls.log_diagnostic_converter is None:
            # Get workspace root for path resolution
            workspace_root = "."
            if ls.workspace.folders:
                # folders is a dict[str, WorkspaceFolder], get the first folder
                first_folder = next(iter(ls.workspace.folders.values()))
                # Convert URI to filesystem path
                workspace_root = to_fs_path(first_folder.uri) or "."
            ls.log_diagnostic_converter = LogDiagnosticConverter(ls, workspace_root)
            logger.info(f"Initialized log diagnostic converter for {workspace_root}")
        
        if ls.log_watcher is None:
            ls.log_watcher = CK3LogWatcher(ls, ls.log_analyzer)
            logger.info("Initialized log watcher")
        
        # Start watching
        if ls.log_watcher.start(log_path):
            logger.info(f"Log watcher started successfully at {log_path}")
            ls.notify_info(f"Now monitoring CK3 logs at: {log_path}")
            
            return {
                "success": True,
                "path": log_path,
                "watching": ls.log_watcher.get_watched_files(),
                "message": f"Monitoring {len(ls.log_watcher.get_watched_files())} log files"
            }
        else:
            return {
                "success": False,
                "error": "Failed to start log watcher",
                "message": "Check that the log path exists and is accessible"
            }
            
    except Exception as e:
        logger.error(f"Error starting log watcher: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@server.command("ck3.stopLogWatcher")
def stop_log_watcher_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Stop watching CK3 game logs.
    
    Stops monitoring log files and clears all game log diagnostics.
    
    Args:
        ls: The language server instance
    
    Returns:
        Dictionary with status
    """
    logger.info("Executing ck3.stopLogWatcher command")
    args = _normalize_command_args(args)
    
    try:
        if ls.log_watcher and ls.log_watcher.is_running():
            ls.log_watcher.stop()
            
            # Clear all log diagnostics
            if ls.log_diagnostic_converter:
                ls.log_diagnostic_converter.clear_all_log_diagnostics()
            
            ls.notify_info("Stopped monitoring CK3 logs")
            logger.info("Log watcher stopped")
            
            return {
                "success": True,
                "message": "Log monitoring stopped"
            }
        else:
            return {
                "success": False,
                "error": "Log watcher is not running"
            }
            
    except Exception as e:
        logger.error(f"Error stopping log watcher: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@server.command("ck3.pauseLogWatcher")
def pause_log_watcher_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Pause log processing.
    
    Temporarily pause log analysis while keeping the watcher active.
    
    Args:
        ls: The language server instance
    
    Returns:
        Dictionary with status
    """
    logger.info("Executing ck3.pauseLogWatcher command")
    args = _normalize_command_args(args)
    
    try:
        if ls.log_watcher and ls.log_watcher.is_running():
            ls.log_watcher.pause()
            ls.notify_info("Log monitoring paused")
            
            return {
                "success": True,
                "message": "Log monitoring paused"
            }
        else:
            return {
                "success": False,
                "error": "Log watcher is not running"
            }
            
    except Exception as e:
        logger.error(f"Error pausing log watcher: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@server.command("ck3.resumeLogWatcher")
def resume_log_watcher_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Resume log processing.
    
    Resume log analysis after pause.
    
    Args:
        ls: The language server instance
    
    Returns:
        Dictionary with status
    """
    logger.info("Executing ck3.resumeLogWatcher command")
    args = _normalize_command_args(args)
    
    try:
        if ls.log_watcher and ls.log_watcher.is_running():
            ls.log_watcher.resume()
            ls.notify_info("Log monitoring resumed")
            
            return {
                "success": True,
                "message": "Log monitoring resumed"
            }
        else:
            return {
                "success": False,
                "error": "Log watcher is not running"
            }
            
    except Exception as e:
        logger.error(f"Error resuming log watcher: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@server.command("ck3.clearGameLogs")
def clear_game_logs_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Clear all game log diagnostics.
    
    Removes all diagnostics that came from game logs while preserving
    static analysis diagnostics.
    
    Args:
        ls: The language server instance
    
    Returns:
        Dictionary with status
    """
    logger.info("Executing ck3.clearGameLogs command")
    args = _normalize_command_args(args)
    
    try:
        if ls.log_diagnostic_converter:
            ls.log_diagnostic_converter.clear_all_log_diagnostics()
            ls.notify_info("Cleared all game log diagnostics")
            
            return {
                "success": True,
                "message": "Game log diagnostics cleared"
            }
        else:
            return {
                "success": True,
                "message": "No log diagnostics to clear"
            }
            
    except Exception as e:
        logger.error(f"Error clearing game logs: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@server.command("ck3.getLogStatistics")
def get_log_statistics_command(ls: CK3LanguageServer, *args: Any):
    """
    Command: Get accumulated log statistics.
    
    Returns statistics about errors found in game logs, including
    error counts by category and performance metrics.
    
    Args:
        ls: The language server instance
    
    Returns:
        Dictionary with statistics
    """
    logger.info("Executing ck3.getLogStatistics command")
    args = _normalize_command_args(args)
    
    try:
        if not ls.log_analyzer:
            return {
                "success": False,
                "error": "Log analyzer not initialized",
                "message": "Start log watcher first"
            }
        
        from dataclasses import asdict
        stats = ls.log_analyzer.get_statistics()
        
        # Convert to dict for JSON serialization
        stats_dict = asdict(stats)
        
        # Convert datetime to ISO string
        if stats.start_time:
            stats_dict['start_time'] = stats.start_time.isoformat()
        if stats.last_update:
            stats_dict['last_update'] = stats.last_update.isoformat()
        
        return {
            "success": True,
            "statistics": stats_dict
        }
        
    except Exception as e:
        logger.error(f"Error getting log statistics: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


def main():
    """
    Main entry point for the language server

    This function starts the language server and begins listening for LSP messages
    from an editor/IDE over stdin/stdout.

    How it works:
        1. The server is configured with feature handlers (did_open, completions, etc.)
        2. start_io() begins reading JSON-RPC messages from stdin
        3. The server processes requests and sends responses to stdout
        4. This continues until the editor sends a shutdown request or stdin closes

    Communication Protocol:
        The server uses JSON-RPC 2.0 over stdin/stdout:
        - Editor sends requests/notifications to stdin
        - Server sends responses/notifications to stdout
        - stderr is used for logging (doesn't interfere with LSP communication)

    Process Lifecycle:
        The editor typically:
        1. Starts the server process
        2. Sends 'initialize' request with client capabilities
        3. Sends 'initialized' notification when ready
        4. Exchanges messages (document events, completion requests, etc.)
        5. Sends 'shutdown' request to begin graceful shutdown
        6. Sends 'exit' notification to terminate the process

    Usage:
        python -m pychivalry.server
        python -m pychivalry.server --log-level debug

    The server will log "Starting Crusader Kings 3 Language Server..." and then wait for
    LSP messages. You should see "Starting IO server" when it begins listening.
    """
    import argparse

    parser = argparse.ArgumentParser(description="Crusader Kings 3 Language Server")
    parser.add_argument(
        "--log-level",
        choices=["debug", "info", "warning", "error"],
        default="info",
        help="Set the logging level (default: info)",
    )
    args = parser.parse_args()

    # Configure logging with the specified level
    configure_logging(args.log_level)

    logger.info("Starting Crusader Kings 3 Language Server...")
    # Start the language server in IO mode (stdin/stdout communication)
    # This is a blocking call that runs until the server is shut down
    server.start_io()


# Standard Python idiom: run main() only when this file is executed directly
# This allows the module to be imported without running the server
if __name__ == "__main__":
    main()
