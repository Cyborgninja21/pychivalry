# PyChivalry - Detailed Function Signatures

This document provides detailed function signatures and class definitions for all Python modules in the PyChivalry project.

---

## Core Infrastructure

### `__init__.py`
```python
__version__ = "0.1.0"
```

### `parser.py`
**Classes:**
```python
@dataclass(slots=True)
class CK3Node:
    """AST node for CK3 script parsing with memory-efficient slots."""
    type: str
    key: str
    value: Any
    range: types.Range
    parent: Optional["CK3Node"] = None
    scope_type: str = "unknown"
    children: List["CK3Node"] = field(default_factory=list)

class CK3Token:
    """Lexical token with slots."""
    __slots__ = ("type", "value", "line", "character")
    
    def __init__(self, type: str, value: str, line: int, character: int)
    def __repr__(self) -> str
```

**Functions:**
```python
def tokenize(text: str) -> List[CK3Token]:
    """
    Tokenize CK3 script text into lexical tokens.
    
    Handles: identifiers, operators, strings, numbers, braces, comments
    Supports: quoted strings with escapes, negative numbers, decimals
    """

def parse_document(text: str) -> List[CK3Node]:
    """
    Parse CK3 script text into Abstract Syntax Tree.
    
    Returns: List of top-level CK3Node objects
    Node types: block, assignment, list, comment, namespace, event
    """

def get_node_at_position(nodes: List[CK3Node], position: types.Position) -> Optional[CK3Node]:
    """
    Find the most specific (deepest) AST node at given position.
    
    Uses depth-first search through AST hierarchy.
    Used by: hover, completion, goto-definition, diagnostics
    """
```

---

### `indexer.py`
**Class:**
```python
class DocumentIndex:
    """Track symbols across all workspace documents."""
    
    def __init__(self)
    
    # Workspace Scanning
    def scan_workspace(
        self,
        workspace_roots: List[str],
        executor: Optional[ThreadPoolExecutor] = None
    )
    
    def _scan_workspace_parallel(
        self,
        workspace_roots: List[str],
        executor: ThreadPoolExecutor
    )
    
    def _scan_workspace_sequential(self, workspace_roots: List[str])
    
    # Folder Scanners
    def _scan_scripted_effects_folder(self, folder_path: Path)
    def _scan_scripted_triggers_folder(self, folder_path: Path)
    def _scan_common_folder(
        self,
        folder_path: Path,
        target_dict: Dict[str, types.Location],
        def_type: str
    )
    def _scan_localization_folder(self, folder_path: Path)
    def _scan_events_folder(self, folder_path: Path)
    def _scan_character_flags(self, root_path: Path)
    def _scan_flags_in_folder(self, folder_path: Path)
    
    # File Scanners (Parallel)
    def _scan_single_file(
        self,
        file_path: Path,
        folder_type: str
    ) -> Optional[Dict]
    
    def _scan_localization_file_parallel(
        self,
        file_path: Path
    ) -> Optional[Dict]
    
    def _scan_events_file_parallel(
        self,
        file_path: Path
    ) -> Optional[Dict]
    
    def _merge_scan_result(self, result: Dict)
    
    # Extraction Functions
    def _extract_top_level_definitions(
        self,
        content: str,
        uri: str
    ) -> Dict[str, types.Location]
    
    def _extract_event_definitions(
        self,
        content: str,
        uri: str
    ) -> Dict[str, types.Location]
    
    def _extract_namespaces(
        self,
        content: str,
        uri: str
    ) -> Dict[str, str]
    
    def _extract_saved_scopes(
        self,
        content: str,
        uri: str
    ) -> Dict[str, types.Location]
    
    def _extract_character_flags(self, content: str, uri: str)
    
    def _parse_localization_file(
        self,
        content: str,
        uri: str
    ) -> Dict[str, tuple]
    
    # Lookup Functions
    def find_event(self, event_id: str) -> Optional[types.Location]
    def find_scripted_effect(self, name: str) -> Optional[types.Location]
    def find_scripted_trigger(self, name: str) -> Optional[types.Location]
    def find_character_interaction(self, name: str) -> Optional[types.Location]
    def find_modifier(self, name: str) -> Optional[types.Location]
    def find_on_action(self, name: str) -> Optional[types.Location]
    def find_opinion_modifier(self, name: str) -> Optional[types.Location]
    def find_scripted_gui(self, name: str) -> Optional[types.Location]
    def find_saved_scope(self, scope_name: str) -> Optional[types.Location]
    def find_character_flag(self, flag_name: str) -> Optional[types.Location]
    def find_localization(self, key: str) -> Optional[tuple]
    
    # Get All Functions
    def get_all_events(self) -> List[str]
    def get_all_namespaces(self) -> List[str]
    def get_all_scripted_effects(self) -> Set[str]
    def get_all_scripted_triggers(self) -> Set[str]
    def get_all_localization_keys(self) -> Set[str]
    def get_all_character_flags(self) -> Set[str]
    
    def get_character_flag_usages(
        self,
        flag_name: str
    ) -> Optional[List[tuple]]
    
    # Event Helpers
    def get_events_for_namespace(self, namespace: str) -> List[str]
    def get_event_title_key(self, event_id: str) -> str
    def get_event_localized_title(self, event_id: str) -> Optional[str]
    
    # AST Integration
    def update_from_ast(self, uri: str, ast: List[CK3Node])
    def _index_node(self, uri: str, node: CK3Node)
    def remove_document(self, uri: str)
    def _remove_document_entries(self, uri: str)
```

---

### `server.py`
**Classes:**
```python
class CK3LanguageServer(LanguageServer):
    """Extended language server with CK3-specific state."""
    
    def __init__(self, *args, **kwargs)
    
    # Thread-Safe Document Access
    def get_ast(self, uri: str) -> List[CK3Node]
    def set_ast(self, uri: str, ast: List[CK3Node])
    def remove_ast(self, uri: str)
    def get_document_version(self, uri: str) -> int
    def increment_document_version(self, uri: str) -> int
    
    # Adaptive Debounce
    def get_adaptive_debounce_delay(self, source: str) -> float
    
    # AST Content Hash Caching
    def _compute_content_hash(self, source: str) -> str
    def get_cached_ast(self, source: str) -> Optional[List[CK3Node]]
    def cache_ast(self, source: str, ast: List[CK3Node])
    def get_or_parse_ast(self, source: str) -> List[CK3Node]
    
    # Server Communication
    def notify_info(self, message: str)
    def notify_warning(self, message: str)
    def notify_error(self, message: str)
    def log_message(
        self,
        message: str,
        msg_type: types.MessageType = types.MessageType.Log
    )
    
    async def with_progress(
        self,
        title: str,
        task_func,
        cancellable: bool = False
    )
    
    # Configuration
    async def get_user_configuration(
        self,
        section: str = "ck3LanguageServer"
    ) -> Dict[str, Any]
    
    def get_cached_config(self, key: str, default: Any = None) -> Any
    
    # Workspace Edits
    async def apply_edit(
        self,
        edit: types.WorkspaceEdit,
        label: Optional[str] = None
    ) -> bool
    
    def create_text_edit(
        self,
        uri: str,
        start_line: int,
        start_char: int,
        end_line: int,
        end_char: int,
        new_text: str
    ) -> types.WorkspaceEdit
    
    def create_insert_edit(
        self,
        uri: str,
        line: int,
        character: int,
        text: str
    ) -> types.WorkspaceEdit
    
    def create_multi_file_edit(
        self,
        changes: Dict[str, List[types.TextEdit]]
    ) -> types.WorkspaceEdit
    
    # Document Updates
    async def schedule_document_update(self, uri: str, doc_source: str)
    
    def _collect_diagnostics_sync(
        self,
        uri: str,
        source: str,
        ast: List[CK3Node]
    ) -> List[types.Diagnostic]
    
    def _collect_syntax_diagnostics_sync(
        self,
        uri: str,
        source: str,
        ast: List[CK3Node]
    ) -> List[types.Diagnostic]
    
    def _collect_semantic_diagnostics_sync(
        self,
        uri: str,
        ast: List[CK3Node]
    ) -> List[types.Diagnostic]
    
    # Lifecycle
    def shutdown(self)
    
    # Workspace Management
    async def _scan_workspace_folders_async(self)
    def _scan_workspace_folders(self)
    def parse_and_index_document(self, doc: TextDocument) -> List[CK3Node]
    def publish_diagnostics_for_document(self, doc: TextDocument)
```

**LSP Feature Handlers:**
```python
# Document Lifecycle
@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
async def did_open(
    ls: CK3LanguageServer,
    params: types.DidOpenTextDocumentParams
)

@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
async def did_change(
    ls: CK3LanguageServer,
    params: types.DidChangeTextDocumentParams
)

@server.feature(types.TEXT_DOCUMENT_DID_CLOSE)
def did_close(
    ls: CK3LanguageServer,
    params: types.DidCloseTextDocumentParams
)

# Language Features
@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def completions(
    ls: CK3LanguageServer,
    params: types.CompletionParams
)

@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(ls: CK3LanguageServer, params: types.HoverParams)

@server.feature(types.TEXT_DOCUMENT_DEFINITION)
def definition(ls: CK3LanguageServer, params: types.DefinitionParams)

@server.feature(types.TEXT_DOCUMENT_CODE_ACTION)
def code_action(
    ls: CK3LanguageServer,
    params: types.CodeActionParams
)

@server.feature(types.TEXT_DOCUMENT_REFERENCES)
@server.thread()
def references(ls: CK3LanguageServer, params: types.ReferenceParams)

@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(
    ls: CK3LanguageServer,
    params: types.DocumentSymbolParams
)

@server.feature(types.WORKSPACE_SYMBOL)
@server.thread()
def workspace_symbol(
    ls: CK3LanguageServer,
    params: types.WorkspaceSymbolParams
)

@server.feature(types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL)
@server.thread()
def semantic_tokens_full(
    ls: CK3LanguageServer,
    params: types.SemanticTokensParams
)

@server.feature(types.TEXT_DOCUMENT_FORMATTING)
@server.thread()
def document_formatting(
    ls: CK3LanguageServer,
    params: types.DocumentFormattingParams
)

@server.feature(types.TEXT_DOCUMENT_RANGE_FORMATTING)
@server.thread()
def range_formatting(
    ls: CK3LanguageServer,
    params: types.DocumentRangeFormattingParams
)

@server.feature(types.TEXT_DOCUMENT_CODE_LENS)
@server.thread()
def code_lens(ls: CK3LanguageServer, params: types.CodeLensParams)

@server.feature(types.CODE_LENS_RESOLVE)
def code_lens_resolve(ls: CK3LanguageServer, params: types.CodeLens)

@server.feature(types.TEXT_DOCUMENT_INLAY_HINT)
@server.thread()
def inlay_hint(ls: CK3LanguageServer, params: types.InlayHintParams)

@server.feature(types.INLAY_HINT_RESOLVE)
def inlay_hint_resolve(ls: CK3LanguageServer, params: types.InlayHint)

@server.feature(types.TEXT_DOCUMENT_SIGNATURE_HELP)
def signature_help(
    ls: CK3LanguageServer,
    params: types.SignatureHelpParams
)

@server.feature(types.TEXT_DOCUMENT_DOCUMENT_HIGHLIGHT)
@server.thread()
def document_highlight(
    ls: CK3LanguageServer,
    params: types.DocumentHighlightParams
) -> Optional[List[types.DocumentHighlight]]

@server.feature(types.TEXT_DOCUMENT_DOCUMENT_LINK)
def document_link(
    ls: CK3LanguageServer,
    params: types.DocumentLinkParams
) -> Optional[List[types.DocumentLink]]

@server.feature(types.DOCUMENT_LINK_RESOLVE)
def document_link_resolve(
    ls: CK3LanguageServer,
    link: types.DocumentLink
) -> types.DocumentLink

@server.feature(types.TEXT_DOCUMENT_PREPARE_RENAME)
def prepare_rename(
    ls: CK3LanguageServer,
    params: types.PrepareRenameParams
) -> Optional[types.PrepareRenameResult]

@server.feature(types.TEXT_DOCUMENT_RENAME)
@server.thread()
def rename(
    ls: CK3LanguageServer,
    params: types.RenameParams
) -> Optional[types.WorkspaceEdit]

@server.feature(types.TEXT_DOCUMENT_FOLDING_RANGE)
@server.thread()
def folding_range(
    ls: CK3LanguageServer,
    params: types.FoldingRangeParams
) -> Optional[List[types.FoldingRange]]
```

**Custom Commands:**
```python
@server.command("ck3.validateWorkspace")
async def validate_workspace_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.rescanWorkspace")
async def rescan_workspace_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.getWorkspaceStats")
def get_workspace_stats_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.generateEventTemplate")
def generate_event_template_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.findOrphanedLocalization")
def find_orphaned_localization_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.showEventChain")
def show_event_chain_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.checkDependencies")
def check_dependencies_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.showNamespaceEvents")
def show_namespace_events_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.insertTextAtCursor")
async def insert_text_at_cursor_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.generateLocalizationStubs")
async def generate_localization_stubs_command(
    ls: CK3LanguageServer,
    args: List[Any]
)

@server.command("ck3.renameEvent")
async def rename_event_command(
    ls: CK3LanguageServer,
    args: List[Any]
)
```

**Helper Functions:**
```python
def configure_logging(level: str = "info") -> None

def _find_word_references_in_ast(
    word: str,
    ast: List[CK3Node],
    uri: str
) -> List[types.Location]

def _extract_symbol_from_node(
    node: CK3Node
) -> Optional[types.DocumentSymbol]

def _get_workspace_folder_paths(
    ls: CK3LanguageServer
) -> List[str]

def main()
```

---

## CK3 Language Definitions

### `ck3_language.py`
**Constants:**
```python
CK3_KEYWORDS: List[str]
CK3_EFFECTS: List[str]
CK3_TRIGGERS: List[str]
CK3_SCOPES: List[str]
CK3_EVENT_TYPES: List[str]
CK3_OPERATORS: List[str]
CK3_BOOLEAN_VALUES: List[str]
CK3_FILE_EXTENSIONS: List[str]
CK3_SECTIONS: List[str]

# Field Documentation
CK3_OPTION_FIELDS: Dict[str, Dict[str, str]]
CK3_EVENT_FIELDS: Dict[str, Dict[str, str]]
CK3_PORTRAIT_FIELDS: Dict[str, Dict[str, str]]
CK3_CONTEXT_FIELDS: Dict[str, Dict[str, str]]
```

---

### `scopes.py`
**Constants:**
```python
UNIVERSAL_LINKS: List[str] = ["root", "this", "prev", "from", "fromfrom"]
```

**Functions:**
```python
def get_scope_links(scope_type: str) -> List[str]:
    """Get valid scope links for a given scope type."""

def get_scope_lists(scope_type: str) -> List[str]:
    """Get valid list iterations for a given scope type."""

def get_scope_triggers(scope_type: str) -> List[str]:
    """Get valid triggers for a given scope type."""

def get_scope_effects(scope_type: str) -> List[str]:
    """Get valid effects for a given scope type."""

def get_available_scope_types() -> List[str]:
    """Get all available scope types."""

def get_resulting_scope(current_scope: str, link: str) -> str:
    """Determine resulting scope type after following a link."""

def validate_scope_chain(
    chain: str,
    starting_scope: str
) -> Tuple[bool, str]:
    """
    Validate a scope chain (e.g., 'liege.primary_title.holder').
    
    Returns: (is_valid, result_or_error)
    """

def is_valid_trigger(trigger: str, scope_type: str) -> bool:
    """Check if trigger is valid in given scope type."""

def is_valid_effect(effect: str, scope_type: str) -> bool:
    """Check if effect is valid in given scope type."""

def is_valid_list_base(list_base: str, scope_type: str) -> bool:
    """Check if list base is valid in given scope type."""

def get_list_prefixes() -> List[str]:
    """Get all valid list iteration prefixes."""

def parse_list_iterator(
    identifier: str
) -> Optional[Tuple[str, str]]:
    """Parse list iterator into (prefix, base)."""
```

---

## LSP Features

### `completions.py`
**Classes:**
```python
@dataclass
class CompletionContext:
    """Represents completion context."""
    block_type: str = "unknown"
    scope_type: str = "character"
    after_dot: bool = False
    after_colon: bool = False
    in_assignment: bool = False
    trigger_character: Optional[str] = None
    saved_scopes: Set[str] = None
    incomplete_text: str = ""
    
    def __post_init__(self)
```

**Cached Functions:**
```python
@lru_cache(maxsize=1)
def _cached_trigger_completions() -> Tuple[types.CompletionItem, ...]

@lru_cache(maxsize=1)
def _cached_effect_completions() -> Tuple[types.CompletionItem, ...]

@lru_cache(maxsize=1)
def _cached_scope_completions() -> Tuple[types.CompletionItem, ...]

@lru_cache(maxsize=1)
def _cached_all_keyword_completions() -> Tuple[types.CompletionItem, ...]

@lru_cache(maxsize=32)
def _cached_keyword_completions(
    keywords_tuple: Tuple[str, ...]
) -> Tuple[types.CompletionItem, ...]
```

**Main Functions:**
```python
def detect_context(
    node: Optional[CK3Node],
    position: types.Position,
    line_text: str,
    document_index: Optional[DocumentIndex] = None
) -> CompletionContext:
    """Detect completion context from AST and cursor position."""

def filter_by_context(
    context: CompletionContext
) -> List[types.CompletionItem]:
    """Generate completion items filtered by context."""

def get_scope_link_completions(
    context: CompletionContext
) -> List[types.CompletionItem]:
    """Get completions for scope links after a dot."""

def get_saved_scope_completions(
    context: CompletionContext
) -> List[types.CompletionItem]:
    """Get completions for saved scopes after 'scope:'."""

def create_trigger_completions() -> List[types.CompletionItem]
def create_effect_completions() -> List[types.CompletionItem]
def create_keyword_completions(
    keywords: Optional[List[str]] = None
) -> List[types.CompletionItem]
def create_scope_completions() -> List[types.CompletionItem]
def create_all_completions() -> List[types.CompletionItem]
def create_snippet_completions() -> List[types.CompletionItem]

def get_context_aware_completions(
    document_uri: str,
    position: types.Position,
    ast: Optional[CK3Node],
    line_text: str,
    document_index: Optional[DocumentIndex] = None
) -> types.CompletionList:
    """Main entry point for context-aware completions."""
```

---

### `diagnostics.py`
**Classes:**
```python
@dataclass
class DiagnosticConfig:
    """Configuration for diagnostic checks."""
    style_enabled: bool = True
    paradox_enabled: bool = True
    scope_timing_enabled: bool = True
```

**Functions:**
```python
def create_diagnostic(
    message: str,
    range_: types.Range,
    severity: types.DiagnosticSeverity = types.DiagnosticSeverity.Error,
    code: Optional[str] = None,
    source: str = "ck3-ls"
) -> types.Diagnostic:
    """Create a diagnostic object."""

def check_syntax(
    doc: TextDocument,
    ast: List[CK3Node]
) -> List[types.Diagnostic]:
    """Check for syntax errors (bracket matching, etc.)."""

def check_semantics(
    ast: List[CK3Node],
    index: Optional[DocumentIndex]
) -> List[types.Diagnostic]:
    """Check for semantic errors (unknown effects/triggers, etc.)."""

def check_scopes(
    ast: List[CK3Node],
    index: Optional[DocumentIndex]
) -> List[types.Diagnostic]:
    """Check for scope-related errors."""

def collect_all_diagnostics(
    doc: TextDocument,
    ast: List[CK3Node],
    index: Optional[DocumentIndex] = None,
    config: Optional[DiagnosticConfig] = None
) -> List[types.Diagnostic]:
    """Collect all diagnostics for a document."""

def get_diagnostics_for_text(
    text: str,
    uri: str = "file:///test.txt",
    index: Optional[DocumentIndex] = None
) -> List[types.Diagnostic]:
    """Convenience function for testing."""
```

---

## Summary

This document provides detailed signatures for:
- **4 Core Infrastructure modules** (parser, indexer, server, __init__)
- **2 Language Definition modules** (ck3_language, scopes)
- **2 LSP Feature modules** (completions, diagnostics)

### Module Counts
- **Total Functions Documented**: 100+
- **Total Classes Documented**: 6
- **LSP Handlers**: 24
- **Custom Commands**: 11
- **Cached Functions**: 5

### Key Patterns
1. **Thread Safety**: Lock-protected shared data structures
2. **Performance**: LRU caching for expensive operations
3. **Async/Await**: Non-blocking document updates
4. **Type Safety**: Comprehensive type hints throughout
5. **Error Handling**: Graceful degradation with logging

---

*Note: Additional modules (hover.py, navigation.py, code_actions.py, etc.) follow similar patterns and will be documented as needed.*
