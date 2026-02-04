# Pychivalry Package Reorganization Plan

**Status**: Planned  
**Date**: 2026-02-04

## Overview

Reorganize the flat 47-file `pychivalry/` directory into 6 logical subpackages for improved maintainability and discoverability.

## Current State

All 47 Python files sit directly in `pychivalry/`:

```
pychivalry/
├── __init__.py
├── asset_validation.py
├── block_validator.py
├── ck3_language.py
├── code_actions.py
├── code_lens.py
├── completions.py
├── concepts.py
├── diagnostics.py
├── document_highlight.py
├── document_links.py
├── effect_trigger_docs.py
├── events.py
├── folding.py
├── formatting.py
├── generic_rules_validator.py
├── hover.py
├── icons.py
├── incremental_parser.py
├── indexer.py
├── inlay_hints.py
├── lists.py
├── localization.py
├── log_analyzer.py
├── log_diagnostics.py
├── log_watcher.py
├── navigation.py
├── paradox_checks.py
├── parser.py
├── rename.py
├── schema_completions.py
├── schema_hover.py
├── schema_loader.py
├── schema_symbols.py
├── schema_validator.py
├── scope_timing.py
├── scopes.py
├── script_values.py
├── scripted_blocks.py
├── semantic_tokens.py
├── server.py
├── signature_help.py
├── story_cycles.py
├── style_checks.py
├── symbols.py
├── threading.py
├── traits.py
├── utils.py
├── variables.py
├── workspace.py
└── data/
```

## Proposed Structure

```
pychivalry/
├── __init__.py                    # Package metadata only
├── server.py                      # Main entry point (stays at root)
│
├── core/                          # Infrastructure (7 files)
│   ├── __init__.py
│   ├── parser.py
│   ├── incremental_parser.py
│   ├── indexer.py
│   ├── threading.py
│   ├── utils.py
│   └── workspace.py
│
├── lsp/                           # LSP features (14 files)
│   ├── __init__.py
│   ├── completions.py
│   ├── hover.py
│   ├── navigation.py
│   ├── symbols.py
│   ├── semantic_tokens.py
│   ├── code_actions.py
│   ├── code_lens.py
│   ├── formatting.py
│   ├── folding.py
│   ├── rename.py
│   ├── inlay_hints.py
│   ├── signature_help.py
│   ├── document_highlight.py
│   └── document_links.py
│
├── schema/                        # Schema system (5 files)
│   ├── __init__.py
│   ├── loader.py                  # was: schema_loader.py
│   ├── validator.py               # was: schema_validator.py
│   ├── completions.py             # was: schema_completions.py
│   ├── hover.py                   # was: schema_hover.py
│   └── symbols.py                 # was: schema_symbols.py
│
├── ck3/                           # CK3 game logic (17 files)
│   ├── __init__.py
│   ├── language.py                # was: ck3_language.py
│   ├── effect_trigger_docs.py
│   │
│   ├── validation/                # Game validators (15 files)
│   │   ├── __init__.py
│   │   ├── diagnostics.py         # Coordinator
│   │   ├── scopes.py
│   │   ├── scope_timing.py
│   │   ├── events.py
│   │   ├── story_cycles.py
│   │   ├── lists.py
│   │   ├── variables.py
│   │   ├── scripted_blocks.py
│   │   ├── script_values.py
│   │   ├── traits.py
│   │   ├── paradox_checks.py
│   │   ├── style_checks.py
│   │   ├── block_validator.py
│   │   ├── generic_rules_validator.py
│   │   └── asset_validation.py
│   │
│   └── localization/              # Localization subsystem (3 files)
│       ├── __init__.py
│       ├── validator.py           # was: localization.py
│       ├── concepts.py
│       └── icons.py
│
├── log/                           # Game log integration (3 files)
│   ├── __init__.py
│   ├── watcher.py                 # was: log_watcher.py
│   ├── analyzer.py                # was: log_analyzer.py
│   └── diagnostics.py             # was: log_diagnostics.py
│
└── data/                          # Unchanged (YAML definitions)
    ├── __init__.py
    ├── schemas/
    ├── scopes/
    ├── effects/
    ├── triggers/
    └── traits/
```

## File Categories

### Core Infrastructure (7 files)
| File | Purpose | Dependencies |
|------|---------|--------------|
| `parser.py` | Lexer/parser, generates AST (`CK3Node`) | None |
| `incremental_parser.py` | Optimized incremental parsing | `parser` |
| `indexer.py` | Cross-document symbol indexing | `parser` |
| `threading.py` | Thread pool management, task prioritization | None |
| `utils.py` | URI/path utilities, position checks | None |
| `workspace.py` | Workspace management, mod descriptor parsing | None |

### LSP Features (14 files)
| File | Purpose |
|------|---------|
| `completions.py` | Context-aware auto-completion |
| `hover.py` | Hover documentation provider |
| `navigation.py` | Go-to-definition, find references |
| `symbols.py` | Document outline/breadcrumbs |
| `semantic_tokens.py` | Semantic syntax highlighting |
| `code_actions.py` | Quick fixes, refactoring |
| `code_lens.py` | Inline actionable info |
| `formatting.py` | Document/range formatting |
| `folding.py` | Code folding ranges |
| `rename.py` | Workspace-wide renaming |
| `inlay_hints.py` | Inline type annotations |
| `signature_help.py` | Parameter hints |
| `document_highlight.py` | Highlight occurrences |
| `document_links.py` | Clickable file/URL links |

### Schema System (5 files)
| File | Purpose |
|------|---------|
| `schema_loader.py` | Load YAML schemas, resolve inheritance |
| `schema_validator.py` | Schema-based validation engine |
| `schema_completions.py` | Schema-aware completions |
| `schema_hover.py` | Schema-based hover docs |
| `schema_symbols.py` | Schema-driven symbol extraction |

### CK3 Game Validation (15 files)
| File | Purpose |
|------|---------|
| `diagnostics.py` | Multi-phase validation coordinator |
| `scopes.py` | Scope type validation |
| `scope_timing.py` | Golden Rule validation |
| `events.py` | Event structure validation |
| `story_cycles.py` | Story cycle validation |
| `lists.py` | List iterator validation |
| `variables.py` | Variable system validation |
| `scripted_blocks.py` | Scripted triggers/effects |
| `script_values.py` | Formula validation |
| `traits.py` | Trait validation |
| `paradox_checks.py` | Convention/pitfall detection |
| `style_checks.py` | Code style validation |
| `block_validator.py` | Context-aware semantic validation |
| `generic_rules_validator.py` | Schema-driven rule validation |
| `asset_validation.py` | Graphics/audio file validation |

### CK3 Language Definitions (2 files)
| File | Purpose |
|------|---------|
| `ck3_language.py` | Keywords, effects, triggers, scopes |
| `effect_trigger_docs.py` | Effect/trigger YAML documentation loader |

### Localization (3 files)
| File | Purpose |
|------|---------|
| `localization.py` | Localization syntax validation |
| `concepts.py` | Game concept validation |
| `icons.py` | Icon reference validation |

### Log Integration (3 files)
| File | Purpose |
|------|---------|
| `log_watcher.py` | Real-time log monitoring |
| `log_analyzer.py` | Log pattern matching |
| `log_diagnostics.py` | Convert log to LSP diagnostics |

## Dependency Analysis

### Standalone Files (No pychivalry imports)
These can be moved first with minimal risk:
- `utils.py`
- `threading.py`
- `ck3_language.py`
- `effect_trigger_docs.py`
- `parser.py`
- `data/__init__.py`

### Tightly Coupled Clusters
These files should be moved together:

**Parser Cluster:**
- `parser.py` + `incremental_parser.py`

**Schema Cluster:**
- All `schema_*.py` files

**Log Cluster:**
- All `log_*.py` files

**Localization Cluster:**
- `localization.py` + `concepts.py` + `icons.py`

### Circular Import Risks

```
                    server.py (top)
                        ↓
             ┌─────────────────────┐
             │    LSP Features     │
             │ (completions, hover,│
             │  navigation, etc.)  │
             └─────────────────────┘
                        ↓
    ┌───────────────────┼───────────────────┐
    ↓                   ↓                   ↓
diagnostics.py    schema/*.py          indexer.py
    ↓                   ↓                   ↓
┌───────┐         schema_loader      ┌──────────┐
│ck3/   │              ↓             │  parser  │
│valid/ │         data/__init__.py   └──────────┘
└───────┘              ↑
    ↓            ck3_language.py
    └─────────────────────┘
```

**Key rule**: Lower layers should never import from higher layers.

## Execution Plan

### Phase 1: Create Subpackages with Re-exports
Create `__init__.py` files that re-export all public symbols for backward compatibility.

### Phase 2: Move Core Infrastructure
1. Create `pychivalry/core/`
2. Move: `parser.py`, `incremental_parser.py`, `indexer.py`, `threading.py`, `utils.py`, `workspace.py`
3. Update imports in moved files
4. Add re-exports to `core/__init__.py`
5. Run tests

### Phase 3: Move Log Integration
1. Create `pychivalry/log/`
2. Move: `log_watcher.py` → `watcher.py`, `log_analyzer.py` → `analyzer.py`, `log_diagnostics.py` → `diagnostics.py`
3. Update imports
4. Run tests

### Phase 4: Move Schema System
1. Create `pychivalry/schema/`
2. Move all `schema_*.py` files (rename to drop prefix)
3. Update imports
4. Run tests

### Phase 5: Move CK3 Game Logic
1. Create `pychivalry/ck3/`, `ck3/validation/`, `ck3/localization/`
2. Move validation files
3. Move localization files
4. Move `ck3_language.py` → `language.py`
5. Update imports
6. Run tests

### Phase 6: Move LSP Features
1. Create `pychivalry/lsp/`
2. Move all LSP feature files
3. Update imports
4. Run tests

### Phase 7: Update Server and Tests
1. Update all imports in `server.py`
2. Update all test files
3. Full test suite validation
4. Remove backward compatibility re-exports (optional)

## Estimated Impact
- **~800+ import statements** to update
- **~50 test files** to update
- **Risk**: Medium (circular imports possible if order wrong)

## Benefits
1. **Discoverability**: Related files grouped together
2. **Clear dependencies**: Architecture visible in folder structure
3. **Maintainability**: Easier to find and modify related code
4. **Scalability**: New features go in obvious locations
5. **Onboarding**: New developers understand structure faster

## Rollback Plan
If issues arise, keep the `__init__.py` re-exports in place so old import paths continue to work. This provides a gradual migration path.
