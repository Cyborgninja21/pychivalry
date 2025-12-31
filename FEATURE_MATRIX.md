# pygls API Feature Matrix for pychivalry

Based on the Python API documentation, here's a comprehensive matrix of what's available vs what's implemented vs what could be added.

**Last Updated:** December 31, 2025

---

## Core LSP Features Matrix

| Feature | pygls API | Status | In-Depth Use Case Examples |
|---------|-----------|--------|---------------------------|
| **Document Sync** | `TEXT_DOCUMENT_DID_OPEN`, `DID_CHANGE`, `DID_CLOSE` | ✅ Complete | **Real-time AST Updates**: When a modder opens `events/my_story.txt`, the server parses it into an AST, indexes all event IDs like `my_mod.0001`, and tracks saved scopes like `save_scope_as = target_character`. As they type, every keystroke triggers re-parsing so completions and diagnostics stay current. When they close the file, the server cleans up document-specific state but keeps indexed symbols for cross-file navigation. |
| **Completions** | `TEXT_DOCUMENT_COMPLETION` | ✅ Context-Aware | **Scope-Aware Suggestions**: Inside a `trigger = { }` block, only triggers appear (e.g., `is_adult`, `has_trait`). Inside `effect = { }`, only effects appear (e.g., `add_gold`, `trigger_event`). After typing `scope:`, all saved scopes from the current event chain appear. After `root.`, scope links like `liege`, `spouse`, `primary_title` appear filtered by the current scope type (character vs title vs province). |
| **Hover** | `TEXT_DOCUMENT_HOVER` | ✅ Complete | **Contextual Documentation**: Hovering over `add_opinion` shows: parameter syntax, valid targets, that it requires an opinion modifier, and a usage example. Hovering over `scope:friend` shows where it was saved (`line 45: save_scope_as = friend`), its scope type (character), and what event chain it belongs to. Hovering over `rq.0001` shows the event's title from localization, its trigger conditions, and file location. |
| **Go to Definition** | `TEXT_DOCUMENT_DEFINITION` | ✅ Complete | **Cross-File Navigation**: Ctrl+Click on `trigger_event = { id = rq.0015 }` jumps to the event definition in `events/rq_chapter2.txt`. Ctrl+Click on `my_custom_effect` jumps to its definition in `common/scripted_effects/`. Ctrl+Click on `rq.0001.desc` in an event file jumps to the localization entry in `localization/english/rq_events_l_english.yml`. |
| **Find References** | `TEXT_DOCUMENT_REFERENCES` | ✅ Complete | **Impact Analysis**: Before renaming event `rq.0050`, use Find References to see all 12 places it's called via `trigger_event`. Before modifying a scripted effect `apply_stress_effect`, see which 8 events use it. Before removing a saved scope `scope:rival`, verify it's only used in 3 places across the event chain. |
| **Document Symbols** | `TEXT_DOCUMENT_DOCUMENT_SYMBOL` | ✅ Complete | **Outline Navigation**: The outline view shows a hierarchical tree: `namespace = rq` at top, then events `rq.0001`, `rq.0002` as siblings, each containing `trigger`, `immediate`, `option` blocks. Click any node to jump directly. Useful for navigating 2000-line event files with dozens of events. |
| **Workspace Symbols** | `WORKSPACE_SYMBOL` | ✅ Complete | **Global Search**: Press Ctrl+T and type "daughter" to instantly find `rq_nts_daughter.0001`, `daughter_birthday_effect`, `has_daughter_trigger` across the entire mod—even files you haven't opened. Essential for large mods with 500+ events spread across 50 files. |
| **Code Actions** | `TEXT_DOCUMENT_CODE_ACTION` | ✅ Complete | **Quick Fixes**: Typo `ad_gold = 100` shows lightbulb with "Did you mean 'add_gold'?" Click to auto-fix. Undefined `scope:friend` in `desc` block offers "Move scope creation to calling event" with explanation of timing rules. Missing localization key offers "Generate localization stub" action. |
| **Semantic Tokens** | `TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL` | ✅ Complete | **Rich Highlighting**: Effects like `add_gold` are colored differently than triggers like `has_gold`. Scope references `scope:target` get a distinct color from scope links `root.liege`. Event IDs `rq.0001` are highlighted as events. Custom mod-defined effects from your `common/scripted_effects/` folder get the same highlighting as built-in effects. |
| **Diagnostics** | `publishDiagnostics` | ✅ Complete | **Real-time Validation**: Red squiggle under `has_trait = proud` with message "Unknown trait 'proud'. Did you mean 'arrogant'?" Yellow warning on `scope:friend` in `desc` block: "Scope created in immediate but used in desc—may not exist at evaluation time (see CK3 scope timing rules)." Error on missing closing brace with exact line number. |
| **Code Lens** | `TEXT_DOCUMENT_CODE_LENS` | ✅ Complete | **Inline Metadata**: Above `rq.0001 = {` show "🔗 5 references \| 📨 3 trigger_event calls \| ⚠️ Missing: rq.0001.desc". Above `my_custom_effect = {` show "⚡ Used in 12 places". Clickable to jump to references. Above namespace declarations, show "📦 N events in namespace" with clickable link to list events. |
| **Document Formatting** | `TEXT_DOCUMENT_FORMATTING` | ✅ Complete | **Auto-Format**: Format entire CK3 script to Paradox conventions. Uses tabs for indentation (not spaces). Opening brace on same line: `trigger = {`. Single space around `=` and comparison operators. Proper blank lines between top-level blocks. Trims trailing whitespace. Preserves quoted strings and comments. |
| **Range Formatting** | `TEXT_DOCUMENT_RANGE_FORMATTING` | ✅ Complete | **Format Selection**: Format only the selected range without touching the rest of the file. Automatically expands to include complete blocks for syntax validity. Useful when pasting code from examples or other mods with different formatting conventions. |
| **Inlay Hints** | `TEXT_DOCUMENT_INLAY_HINT` | ✅ Complete | **Type Annotations**: After `scope:friend` show ghost text `: character`. After `root.primary_title` show `: landed_title`. After `every_vassal = {` show `→ character`. Infers scope types from naming conventions (e.g., `_target` → character, `_title` → landed_title). Configurable via settings to show/hide scope types, chain types, or iterator types. Helps understand scope chains without hovering. |
| **Signature Help** | `TEXT_DOCUMENT_SIGNATURE_HELP` | ✅ Complete | **Parameter Hints**: When typing `add_opinion = {`, show popup with required parameters: `target = <character>`, `modifier = <opinion_modifier>`, optional: `years = <int>`. Highlights current parameter as you type. Supports 25+ effects including trigger_event, set_variable, add_character_modifier, random, death, and more. Shows required vs optional parameters with type hints. |
| **Document Highlight** | `TEXT_DOCUMENT_DOCUMENT_HIGHLIGHT` | ✅ Complete | **Symbol Tracking**: Click on `scope:target` and all uses in the current file highlight with appropriate highlight kinds (Read for references, Write for definitions). Supports saved scopes, event IDs, variables, character flags, global flags, and traits. Click on `rq.0001` and its definition plus all `trigger_event` references in the file highlight. |
| **Document Links** | `TEXT_DOCUMENT_DOCUMENT_LINK` | ✅ Complete | **Clickable References**: File paths like `gfx/interface/icons/my_icon.dds` and `common/scripted_effects/my_effects.txt` become clickable links. URLs (https://) are clickable with domain-specific tooltips. Event IDs in comments (# See rq.0050) link to event definitions. GFX paths in script (`icon = "gfx/..."`) are clickable. Supports workspace-relative path resolution. |
| **Rename Symbol** | `TEXT_DOCUMENT_RENAME` | ✅ Complete | **Safe Refactoring**: Rename `rq.0001` to `rq_intro.0001` and automatically update: the event definition, all `trigger_event` calls (15 files), all localization keys (`rq.0001.t` → `rq_intro.0001.t`), and comments referencing it. Preview changes before applying. Supports saved scopes, variables, character flags, global flags, opinion modifiers, scripted effects/triggers. |
| **Folding Range** | `TEXT_DOCUMENT_FOLDING_RANGE` | ✅ Complete | **Code Collapse**: Collapse entire events to single lines for overview. Collapse `trigger = { ... }` blocks when focusing on effects. Collapse all options except the one you're editing. Collapse consecutive comment blocks. Supports `# region` / `# endregion` markers for custom folding regions. Click fold icon in gutter or use Ctrl+Shift+[ to fold. |

---

## Server Communication Features

| Feature | pygls API | Status | In-Depth Use Case Examples |
|---------|-----------|--------|---------------------------|
| **Show Message** | `server.show_message()` | ✅ Complete | **User Notifications**: After workspace scan: "Indexed 847 events, 123 scripted effects, 2,341 localization keys". On validation error: "Found 3 undefined scripted effects—see Problems panel". Warning when deprecated syntax detected: "Using 'ROOT' instead of 'root' is deprecated in CK3 1.9+". |
| **Show Message Log** | `server.show_message_log()` | ✅ Complete | **Debug Output**: Log parsing times: "Parsed rq_chapter1.txt in 45ms (127 events)". Log indexing details: "Found scripted effect 'my_reward_effect' at common/scripted_effects/rewards.txt:156". Useful for troubleshooting without popup spam. View in Output panel → "CK3 Language Server". |
| **Progress Reporting** | `server.progress` | ✅ Complete | **Long Operation Feedback**: During initial workspace scan, show progress bar: "Indexing CK3 Workspace: Scanning events... (25%)" → "Scanning scripted effects... (50%)" → "Scanning localization... (75%)" → "Building cross-references... (90%)". User sees activity, can estimate wait time. |
| **Apply Workspace Edit** | `server.apply_edit_async()` | ✅ Complete | **Automated Refactoring**: "Generate Localization Stubs" command creates entries in `localization/english/` file. "Extract to Scripted Effect" takes selected code and creates new file in `common/scripted_effects/`, replacing selection with call. "Add Missing Namespace" inserts `namespace = my_mod` at file top. |
| **Publish Diagnostics** | `server.text_document_publish_diagnostics()` | ✅ Complete | **Real-time Problems**: As you type, Problems panel updates: "Error: Unknown effect 'ad_gold' at line 45" with severity icon. Clicking jumps to location. Filter by severity. Errors persist until fixed. Warnings for style issues like "Consider using 'every_child' instead of deprecated 'any_child' loop". |
| **Get Configuration** | `server.get_configuration_async()` | ✅ Complete | **User Preferences**: Read `ck3LanguageServer.diagnostics.unknownEffect` setting to control whether unknown effects are errors/warnings/ignored. Read `ck3LanguageServer.validation.checkLocalization` to enable/disable loc key validation. Read custom game path for vanilla file lookups. |
| **Custom Commands** | `@server.command()` | ✅ Complete | **Mod-Specific Tools**: `ck3.validateWorkspace` runs full validation with progress and summary. `ck3.generateEventTemplate` prompts for namespace/ID and inserts boilerplate. `ck3.showEventChain` visualizes which events trigger which. `ck3.findOrphanedLocalization` finds loc keys with no matching events. |

---

## Protocol & IO Options

| Feature | pygls API | Status | In-Depth Use Case Examples |
|---------|-----------|--------|---------------------------|
| **Stdio Transport** | `server.start_io()` | ✅ Used | **Standard VS Code**: Extension spawns Python process, communicates via stdin/stdout JSON-RPC. Zero configuration required. Works on all platforms. Default for all desktop editors. |
| **TCP Transport** | `server.start_tcp()` | ❌ Available | **Remote Development**: Run language server on powerful remote machine while editing locally. Share single server instance across multiple editor windows. Enable debugging with network protocol analyzers. |
| **WebSocket Transport** | `server.start_ws()` | ❌ Available | **Web-Based Editors**: Support browser-based CK3 mod editors. Enable collaborative editing scenarios. Cloud IDE integration (Gitpod, Codespaces). |
| **Async Handlers** | `async def handler(params)` | ⚠️ Partial | **Non-Blocking Operations**: Workspace scan doesn't freeze completions. Progress reporting updates while indexing continues. Currently used for: `did_open`, `validateWorkspace`, `rescanWorkspace`, `insertTextAtCursor`, `generateLocalizationStubs`, `renameEvent`. Most feature handlers (`did_change`, `completions`, `hover`, `semantic_tokens`, etc.) are still synchronous. See `ASYNC_THREADING_REPORT.md` for full analysis. |
| **Threaded Handlers** | `@server.thread()` | ❌ Not Used | **Heavy Computation**: Run expensive validation in background thread. Parse large files without blocking. Cross-reference building for 1000+ event mods. **Currently NO handlers use `@server.thread()`** - all sync handlers block the event loop. Key candidates: `semantic_tokens_full`, `rename`, `references`, `workspace_symbol`, `formatting`. See `ASYNC_THREADING_REPORT.md` for implementation plan. |

---

## Workspace Management

| Feature | pygls API | Status | In-Depth Use Case Examples |
|---------|-----------|--------|---------------------------|
| **Workspace Folders** | `server.workspace.folders` | ✅ Used | **Multi-Root Workspaces**: Open main mod + dependency mods simultaneously. Index `Carnalitas/` alongside your mod to resolve cross-mod references. Navigate between related mods. Separate `common/` and `events/` as different roots. |
| **Text Documents** | `workspace.get_text_document()` | ✅ Used | **Live Document Access**: Get current unsaved content for parsing. Track document versions for incremental updates. Access file content without filesystem reads. Ensures diagnostics match what user sees, not what's saved. |
| **Notebook Documents** | `workspace.get_notebook_document()` | ❌ N/A | Not applicable—CK3 doesn't use notebook formats. |
| **Document Watching** | `workspace/didChangeWatchedFiles` | ❌ Not Started | **External Changes**: Detect when Git pull adds new events. Update index when files created in file explorer. Re-parse when external formatter modifies files. Handle mod manager installations. |
| **Folder Change Events** | `workspace/didChangeWorkspaceFolders` | ❌ Not Started | **Dynamic Workspace**: User adds dependency mod folder → automatically index it. User removes folder → clean up stale references. Support "Add Mod to Workspace" workflow. |

---

## High-Value Features NOT YET Implemented

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Inlay Hints** | Medium | Medium | Show scope types inline (e.g., `scope:friend` → `: character`) |
| **Rename Symbol** | High | Medium | Safely rename events across all files with preview |
| **Folding Range** | Low | Low | Collapse event blocks for better overview |
| **Document Highlight** | Low | Low | Highlight all occurrences of selected symbol |
| **Document Links** | Low | Low | Make file paths and event IDs in comments clickable |

---

## Recommended Priority Implementation

### Phase 1: Quick Wins ✅ COMPLETE

- ~~Progress Reporting~~ - Show scanning progress
- ~~Show Message~~ - User notifications
- ~~Custom Commands~~ - "Validate Workspace", "Generate Event"
- ~~Configuration~~ - User settings for diagnostics
- ~~Code Lens~~ - Reference counts and missing localization above events

### Phase 2: Navigation Enhancement ✅ COMPLETE

- ~~Folding Range~~ - Code folding for events and blocks (❌ Not Started)
- ~~Document Links~~ - Clickable event references in comments ✅
- ~~Document Highlight~~ - Highlight same symbols in file ✅

### Phase 3: Advanced Features ✅ COMPLETE

- ~~Inlay Hints~~ - Scope type annotations inline ✅
- ~~Rename Symbol~~ - Safe cross-file refactoring ✅

---

## Custom Commands (Implemented)

Using `@server.command()`, the following commands are available:

| Command | Detailed Use Case |
|---------|-------------------|
| `ck3.validateWorkspace` | Run before releasing mod update. Scans all 200 event files, checks for: undefined scripted effects, missing localization keys, invalid trait names, scope timing violations. Shows progress bar during scan. Outputs summary: "Validation complete: 3 errors, 12 warnings. See Problems panel." |
| `ck3.rescanWorkspace` | After pulling Git changes that added 50 new events, rescan to update index without restarting VS Code. After manually adding files outside the editor, rescan to pick them up. Clears stale entries from renamed/deleted files. |
| `ck3.getWorkspaceStats` | Quick health check: "Events: 847, Namespaces: 12, Scripted Effects: 123, Scripted Triggers: 89, Localization Keys: 2,341, Character Flags: 156". Useful for mod documentation or comparing before/after refactoring. |
| `ck3.generateEventTemplate` | Creating new event? Run command, enter "rq_romance" namespace and "0001" ID, select "character_event" type. Inserts complete boilerplate with title, desc, theme, portraits, trigger, immediate, and two options. Lists localization keys to create. |
| `ck3.findOrphanedLocalization` | Before release, find unused strings. Scans all `.yml` files, compares to event IDs. Reports: "Found 23 orphaned keys: rq.0099.t (event deleted), rq.0045.c (option removed)...". Helps reduce file size and translator burden. |
| `ck3.checkDependencies` | Verify mod doesn't use undefined symbols. Reports: "Defined: 123 effects, 89 triggers. Used but undefined: 'carnx_enslave_effect' (line 456)—may require Carnalitas dependency". Catches missing mod dependencies before players report crashes. |
| `ck3.showNamespaceEvents` | View all events in a namespace. Click the Code Lens above a namespace declaration, or run manually with namespace name. Returns list of events with their file locations and localized titles. Useful for navigating large event chains. |
| `ck3.showEventChain` | Debugging complex storyline? Enter starting event `rq.0001`, see chain: `rq.0001 → rq.0010 (option a) → rq.0020 → rq.0025 (immediate)`. Visualize branching paths. Find dead ends (events with no outgoing triggers). |
| `ck3.generateLocalizationStubs` | After creating 5 new events, run for each to generate `.yml` entries. Enter `rq.0015`, copies to clipboard: ` rq.0015.t:0 "Event Title"`, ` rq.0015.desc:0 "Description"`, etc. Paste into localization file. |
| `ck3.renameEvent` | Reorganizing event IDs? Enter old ID `rq.0001`, new ID `rq_intro.0001`. Shows: "Definition in events/rq_main.txt:45. Referenced in 8 files. Localization keys to update: 4". Provides find-replace guidance. |
| `ck3.insertTextAtCursor` | Internal command used by other features. Called by "Generate Event Template" to insert text. Called by "Generate Localization Stubs" to insert into `.yml` files. Uses `apply_edit` for undo support. |

---

## Currently Registered Feature Handlers

```python
# Document sync handlers (3)
@server.feature(TEXT_DOCUMENT_DID_OPEN)          # Document opened
@server.feature(TEXT_DOCUMENT_DID_CHANGE)        # Document modified
@server.feature(TEXT_DOCUMENT_DID_CLOSE)         # Document closed

# Core language features (12)
@server.feature(TEXT_DOCUMENT_COMPLETION)        # Context-aware completions
@server.feature(TEXT_DOCUMENT_HOVER)             # Hover documentation
@server.feature(TEXT_DOCUMENT_DEFINITION)        # Go to definition
@server.feature(TEXT_DOCUMENT_REFERENCES)        # Find all references
@server.feature(TEXT_DOCUMENT_DOCUMENT_SYMBOL)   # Outline view
@server.feature(TEXT_DOCUMENT_CODE_ACTION)       # Quick fixes
@server.feature(TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL)  # Rich highlighting
@server.feature(TEXT_DOCUMENT_CODE_LENS)         # Inline metadata (events, effects)
@server.feature(CODE_LENS_RESOLVE)               # Lazy load lens details
@server.feature(TEXT_DOCUMENT_FORMATTING)        # Document formatting
@server.feature(TEXT_DOCUMENT_RANGE_FORMATTING)  # Range formatting
@server.feature(WORKSPACE_SYMBOL)                # Workspace search

# Custom commands (11)
@server.command("ck3.validateWorkspace")         # Full workspace validation
@server.command("ck3.rescanWorkspace")           # Rescan and reindex
@server.command("ck3.getWorkspaceStats")         # Index statistics
@server.command("ck3.generateEventTemplate")     # Event boilerplate
@server.command("ck3.findOrphanedLocalization")  # Unused loc keys
@server.command("ck3.checkDependencies")         # Dependency check
@server.command("ck3.showNamespaceEvents")       # List events in namespace
@server.command("ck3.showEventChain")            # Event flow visualization
@server.command("ck3.generateLocalizationStubs") # Loc entry generator
@server.command("ck3.renameEvent")               # Event ID renaming
@server.command("ck3.insertTextAtCursor")        # Programmatic text insertion
```

### Total Registered Handlers: 26 (15 features + 11 commands)
