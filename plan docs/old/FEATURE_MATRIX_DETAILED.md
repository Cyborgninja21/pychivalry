# PyChivalry Feature Matrix - Detailed Coverage

Comprehensive tracking of all validators, LSP features, and diagnostic capabilities.

---

## 1. VALIDATION FEATURES - Fully Validated File Types (Part 1: Core Files)

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Schema |
|-----------|----------|-----------------|----------------------|--------------|-----------------|--------|
| Events | `events/` | ✅ `type`, `title`, `desc` | ✅ | ✅ | ✅ scripted, ⚠️ events | ✅ `events.yaml` |
| Letter Events | `events/` | ✅ `type`, `title`, `desc`, `sender` | ✅ | ✅ | ✅ scripted, ⚠️ events | ✅ `events.yaml` |
| Event Options | `events/` | ✅ `name` (conditional) | ✅ | ✅ | ✅ | ✅ `events.yaml` |
| Event triggered_desc | `events/` | ✅ `trigger`, `desc` | ✅ | ✅ | ✅ | ✅ `events.yaml` |
| Event Portraits | `events/` | ✅ `character` | ✅ | ✅ | ✅ | ✅ `events.yaml` |
| Story Cycles | `common/story_cycles/` | ✅ `effect_group` + timing | ✅ | ✅ | ✅ scripted | ✅ `story_cycles.yaml` |
| Story triggered_effect | `common/story_cycles/` | ✅ `trigger`, `effect` | ✅ | ✅ | ✅ | ✅ `story_cycles.yaml` |

## 2. VALIDATION FEATURES - Fully Validated File Types (Part 2: Additional Features)

| File Type | Loc Keys | Duplicates | Value Checks | Performance | Scope Timing | Variables | Field Order | Pattern Validation | Type Resolution |
|-----------|----------|------------|--------------|-------------|--------------|-----------|-------------|-------------------|-----------------|
| Events | ✅ code lens | ✅ immediate, trigger_else | ✅ ai_chance | ✅ iterators | ✅ Golden Rule | ✅ | ❌ | ❌ | ❌ |
| Letter Events | ✅ code lens | ✅ | ✅ ai_chance | ✅ iterators | ✅ Golden Rule | ✅ | ❌ | ❌ | ❌ |
| Event Options | ✅ | ✅ multiple names | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Event triggered_desc | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Event Portraits | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Story Cycles | ✅ code lens | ✅ | ✅ chance > 100 | ✅ short intervals | N/A | ✅ | ❌ | ❌ | ❌ |
| Story triggered_effect | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | ❌ | ❌ |

---

## 3. VALIDATION FEATURES - Schema-Driven Files (Part 1: Core)

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Schema |
|-----------|----------|-----------------|----------------------|--------------|-----------------|--------|
| Decisions | `common/decisions/` | ✅ `ai_check_interval`, `effect` | ✅ | ✅ | ✅ indexed | ✅ `decisions.yaml` |
| Character Interactions | `common/character_interactions/` | ✅ `category` | ✅ | ✅ | ✅ indexed | ✅ `character_interactions.yaml` |
| Schemes | `common/schemes/` | ✅ `skill` | ✅ | ✅ | ✅ indexed | ✅ `schemes.yaml` |
| On Actions | `common/on_actions/` | ✅ events or `effect` | ✅ | ✅ | ✅ indexed | ✅ `on_actions.yaml` |
| Mod Descriptor | `descriptor.mod` | ✅ `name` | N/A | N/A | N/A | ❌ |

## 4. VALIDATION FEATURES - Schema-Driven Files (Part 2: Additional)

| File Type | Loc Keys | Duplicates | Value Checks | Performance | Scope Timing | Variables | Field Order | Pattern Validation | Type Resolution |
|-----------|----------|------------|--------------|-------------|--------------|-----------|-------------|-------------------|-----------------|
| Decisions | ✅ code lens | ✅ | ✅ cost, cooldown | ✅ | N/A | ✅ | ❌ | ❌ | ❌ |
| Character Interactions | ✅ code lens | ✅ | ✅ cooldown | ✅ | N/A | ✅ | ❌ | ❌ | ❌ |
| Schemes | ✅ code lens | ✅ | ✅ power, cooldown | ✅ | N/A | ✅ | ❌ | ❌ | ❌ |
| On Actions | ✅ code lens | ✅ | ✅ event weights | ✅ | N/A | ✅ | ❌ | ❌ | ❌ |
| Mod Descriptor | N/A | ❌ | ❌ | N/A | N/A | N/A | N/A | N/A | N/A |

---

## 5. LSP FEATURES - Navigation & Core (Part 1)

| File Type | Go-to-Def | Find Refs | Document Symbols | Workspace Symbols | Highlight | Document Links |
|-----------|-----------|-----------|------------------|-------------------|-----------|----------------|
| **events/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/story_cycles/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/decisions/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/character_interactions/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/schemes/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/on_actions/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/scripted_effects/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/scripted_triggers/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/traits/** | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ |
| **common/*/ (generic)** | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ |
| **history/** | ❌ | ❌ | ⚠️ | ❌ | ⚠️ | ✅ |
| **localization/** | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ |
| **gui/** | ❌ | ❌ | ⚠️ | ❌ | ⚠️ | ✅ |

## 6. LSP FEATURES - Editing Assistance (Part 2)

| File Type | Completions | Hover | Sig Help | Inlay Hints | Code Lens | Semantic Tokens |
|-----------|-------------|-------|----------|-------------|-----------|-----------------|
| **events/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ |
| **common/story_cycles/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ |
| **common/decisions/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ |
| **common/character_interactions/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ |
| **common/schemes/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ |
| **common/on_actions/** | ✅ Schema | ✅ Schema | ⚠️ | ✅ | ✅ Schema | ✅ |
| **common/scripted_effects/** | ✅ YAML | ✅ YAML | ✅ | ✅ | ✅ | ✅ |
| **common/scripted_triggers/** | ✅ YAML | ✅ YAML | ✅ | ✅ | ✅ | ✅ |
| **common/traits/** | ✅ | ✅ | ❌ | ⚠️ | ❌ | ✅ |
| **common/*/ (generic)** | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| **history/** | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| **localization/** | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| **gui/** | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |

## 7. LSP FEATURES - Code Modification (Part 3)

| File Type | Format | Range Format | Fold | Rename | Prepare Rename | Code Actions |
|-----------|--------|--------------|------|--------|----------------|--------------|
| **events/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/story_cycles/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/decisions/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/character_interactions/** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| **common/schemes/** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| **common/on_actions/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/scripted_effects/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/scripted_triggers/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/traits/** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **common/*/ (generic)** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **history/** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **localization/** | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ | ❌ |
| **gui/** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 8. DIAGNOSTIC CODES BY CATEGORY

### 8.1 Syntax & Basic (CK30xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3001 | Unmatched closing bracket | `diagnostics.py` | Error |
| CK3002 | Unclosed bracket | `diagnostics.py` | Error |

### 8.2 Scope Validation (CK31xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3101 | Unknown effect | `diagnostics.py` | Error |
| CK3102 | Unknown trigger | `diagnostics.py` | Error |
| CK3103 | Invalid scope chain | `scopes.py` | Error |

### 8.3 Style & Formatting (CK33xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3301 | Inconsistent indentation within block | `style_checks.py` | Warning |
| CK3302 | Multiple block assignments on one line | `style_checks.py` | Warning |
| CK3303 | Indentation uses spaces instead of tabs | `style_checks.py` | Information |
| CK3304 | Trailing whitespace detected | `style_checks.py` | Information |
| CK3305 | Block content not indented relative to parent | `style_checks.py` | Warning |
| CK3306 | Inconsistent spacing around operators | `style_checks.py` | Information |
| CK3307 | Closing brace indentation doesn't match opening | `style_checks.py` | Warning |
| CK3308 | Missing blank line between top-level blocks | `style_checks.py` | Information |
| CK3314 | Empty block detected (potential logic error) | `style_checks.py` | Warning |
| CK3316 | Line exceeds recommended length (120 chars) | `style_checks.py` | Information |
| CK3317 | Deeply nested blocks (>6 levels) | `style_checks.py` | Warning |
| CK3325 | Namespace declaration not at top of file | `style_checks.py` | Warning |
| CK3330 | Unclosed brace (missing '}') | `style_checks.py` | Error |
| CK3331 | Extra closing brace (no matching '{') | `style_checks.py` | Error |
| CK3332 | Brace mismatch in block | `style_checks.py` | Error |
| CK3340 | Unknown/suspicious scope reference (possible typo) | `style_checks.py` | Warning |
| CK3341 | Scope reference appears truncated | `style_checks.py` | Warning |
| CK3345 | Identifier contains merged text (missing newline) | `style_checks.py` | Warning |

### 8.4 Events & Portraits (CK34xx-CK35xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3421 | Portrait missing required `character` field | `events.py` / schema | Error |
| CK3422 | Invalid portrait animation | `events.py` / schema | Warning |
| CK3430 | Invalid event theme | `events.py` / schema | Warning |
| CK3440 | triggered_desc missing `trigger` | `events.py` / schema | Error |
| CK3441 | triggered_desc missing `desc` | `events.py` / schema | Error |
| CK3450 | Option missing `name` field | `events.py` / schema | Error |
| CK3453 | Option has multiple `name` fields | `events.py` / schema | Warning |
| CK3456 | Empty option block | `events.py` / schema | Warning |

### 8.5 Scope Timing - Golden Rule (CK3550-CK3555)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3550 | Scope used in trigger but defined in immediate | `scope_timing.py` | Error |
| CK3551 | Scope used in desc but defined in immediate | `scope_timing.py` | Error |
| CK3552 | Scope used in triggered_desc trigger but defined in immediate | `scope_timing.py` | Error |
| CK3553 | Variable checked before being set | `scope_timing.py` | Error |
| CK3554 | Temporary scope used across events (lost between events) | `scope_timing.py` | Warning |
| CK3555 | Scope needed in triggered event but not passed | `scope_timing.py` | Warning |

### 8.6 Localization (CK36xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3600 | Missing localization key | `localization.py` | Warning |
| CK3601 | Literal text usage (should use loc key) | `localization.py` | Information |
| CK3602 | Encoding issue (not UTF-8-BOM) | `localization.py` | Error |
| CK3603 | Inconsistent key naming convention | `localization.py` | Information |
| CK3604 | Unused localization key | `localization.py` | Information |

### 8.7 AI Chance & Value Checks (CK36xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3610 | Negative ai_chance base value | `events.py` / schema | Warning |
| CK3612 | Zero base with no modifiers (never selected) | `events.py` / schema | Warning |

### 8.8 Event Structure (CK37xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3760 | Event missing required field | `events.py` / schema | Error |
| CK3761 | Invalid event type value | `events.py` / schema | Error |
| CK3762 | Hidden event with options (contradictory) | `events.py` / schema | Warning |
| CK3763 | Non-hidden event without options | `events.py` / schema | Error |
| CK3764 | Non-hidden event missing desc | `events.py` / schema | Error |
| CK3766 | Multiple `after` blocks | `events.py` / schema | Error |
| CK3767 | Empty event block | `events.py` / schema | Warning |
| CK3768 | Multiple `immediate` blocks | `events.py` / schema | Error |

### 8.9 Effect/Trigger Context (CK38xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3800 | Effect used in trigger block | `paradox_checks.py` / generic_rules | Error |
| CK3801 | Trigger used in effect block (should use `if`) | `paradox_checks.py` / generic_rules | Warning |
| CK3802 | Effect in `any_` iterator without limit | `paradox_checks.py` / generic_rules | Warning |

### 8.10 List Iterators (CK39xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK3900 | Invalid list iterator prefix | `lists.py` | Error |
| CK3901 | Missing `limit` in `random_` iterator | `lists.py` | Warning |
| CK3902 | `every_` without `limit` (performance) | `lists.py` | Information |
| CK3903 | Invalid iterator parameter | `lists.py` | Warning |

### 8.11 Common Gotchas (CK51xx)

| Code | Description | Module | Severity |
|------|-------------|--------|----------|
| CK5100 | Duplicate key in immediate block | `paradox_checks.py` | Warning |
| CK5101 | `trigger_else` before `trigger_if` | `paradox_checks.py` | Error |

---

## 9. SPECIALIZED VALIDATORS NOT IN MAIN TABLES

### 9.1 Trait Validation (`traits.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Trait Existence | ✅ | Validates trait names against 297 CK3 traits |
| Opposite Traits | ✅ | Detects conflicting trait pairs (brave/craven) |
| Trait Category | ✅ | Validates trait categories |
| Trait Properties | ✅ | Skill bonuses, opinions, costs, flags |
| Typo Suggestions | ✅ | Fuzzy matching for misspelled traits |

**Diagnostic Codes:**
- TRAIT-001: Unknown trait reference
- TRAIT-002: Opposite traits both present
- TRAIT-003: Invalid trait category

### 9.2 Variable System Validation (`variables.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Variable Scope Prefix | ✅ | Validates `var:`, `local_var:`, `global_var:` |
| set_variable | ✅ | Validates parameters |
| change_variable | ✅ | Validates arithmetic operations |
| clamp_variable | ✅ | Checks min <= max |
| Variable Lists | ✅ | `add_to_variable_list`, `is_target_in_variable_list` |

**Diagnostic Codes:**
- VAR-001: Invalid variable name format
- VAR-002: Unknown variable scope prefix
- VAR-003: Invalid set_variable parameters
- VAR-004: Invalid change_variable parameters
- VAR-005: Invalid clamp_variable parameters (min > max)
- VAR-006: Invalid variable list operation parameters

### 9.3 Script Values Validation (`script_values.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Fixed Values | ✅ | Simple numeric validation |
| Range Values | ✅ | min/max validation |
| Formula Operations | ✅ | add, subtract, multiply, divide, modulo |
| Conditionals | ✅ | if/else_if/else order validation |
| Rounding | ✅ | round, round_to, ceiling, floor |

**Diagnostic Codes:**
- VALUE-001: Invalid script value type
- VALUE-002: Invalid range (min > max)
- VALUE-003: Unknown formula operation
- VALUE-004: Invalid conditional structure (else_if after else)
- VALUE-005: Missing value in arithmetic formula
- VALUE-006: Invalid round_to parameter

### 9.4 Scripted Blocks Validation (`scripted_blocks.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Scripted Triggers | ✅ | Definition and usage validation |
| Scripted Effects | ✅ | Definition and usage validation |
| Inline Scripts | ✅ | Template substitution validation |
| Parameter Validation | ✅ | $PARAM$ syntax checking |
| Circular Dependencies | ✅ | Detects recursive references |

**Diagnostic Codes:**
- SCRIPT-001: Undefined scripted trigger/effect
- SCRIPT-002: Missing required parameter
- SCRIPT-003: Invalid parameter name format
- SCRIPT-004: Scope requirement not met
- SCRIPT-005: Circular dependency in script references
- SCRIPT-006: Inline script file not found

### 9.5 Workspace Validation (`workspace.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Mod Descriptor | ✅ | Parse and validate *.mod files |
| Cross-File Refs | ✅ | Undefined effect/trigger detection |
| Event Chains | ✅ | Broken trigger_event validation |
| Localization Coverage | ✅ | Missing loc key detection |
| Version Compatibility | ⚠️ | Game version checking |

**Diagnostic Codes:**
- WORKSPACE-001: Invalid mod descriptor format
- WORKSPACE-002: Undefined scripted effect
- WORKSPACE-003: Undefined scripted trigger
- WORKSPACE-004: Broken event chain
- WORKSPACE-005: Missing localization keys
- WORKSPACE-006: Incompatible version

---

## 10. GAME LOG INTEGRATION (Runtime Validation)

### 10.1 Log Watcher (`log_watcher.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Real-time Monitoring | ✅ | Watchdog-based file monitoring |
| Incremental Reading | ✅ | Only reads new log lines |
| Platform Detection | ✅ | Auto-detect CK3 log path |
| Pause/Resume | ✅ | Control monitoring state |

**Diagnostic Codes:**
- LOGWATCH-001: Log directory not found
- LOGWATCH-002: File access error
- LOGWATCH-003: Watcher initialization failed
- LOGWATCH-004: Parse error in log line

### 10.2 Log Analyzer (`log_analyzer.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Pattern Matching | ✅ | Regex-based error detection |
| Location Extraction | ✅ | Extract file:line from logs |
| Typo Suggestions | ✅ | Fuzzy matching for fixes |
| Statistics | ✅ | Error categorization |

**Diagnostic Codes:**
- LOGANAL-001: Pattern matching error
- LOGANAL-002: Location extraction failed
- LOGANAL-003: Suggestion generation error

### 10.3 Log Diagnostics (`log_diagnostics.py`)

| Feature | Status | Description |
|---------|--------|-------------|
| Path Resolution | ✅ | Workspace-relative paths |
| Diagnostic Conversion | ✅ | Log results → LSP diagnostics |
| Source Attribution | ✅ | "ck3-game-log" source tag |
| Merge with Static | ✅ | Combine with static analysis |

**Diagnostic Codes:**
- LOGDIAG-001: URI resolution failed
- LOGDIAG-002: Diagnostic conversion error
- LOGDIAG-003: Publishing failed

---

## 11. MISSING/PLANNED FEATURES

### 11.1 Not Yet Implemented

| Feature | Category | Priority | Notes |
|---------|----------|----------|-------|
| Field Order Validation | Validation | Low | Style preference, CK3 is order-insensitive |
| Pattern Validation | Validation | Medium | Validate loc keys, scopes match patterns |
| Type Resolution | Validation | Medium | Resolve `_types.yaml` definitions |
| GUI File Validation | File Type | Low | Different syntax entirely |
| History File Validation | File Type | Low | Different structure |
| GFX Path Validation | Validation | Low | Validate image paths exist |

### 11.2 Partial Implementation

| Feature | Category | Status | Notes |
|---------|----------|--------|-------|
| Trait References | Validation | ⚠️ | Basic validation, no context awareness |
| On-Action Signature Help | LSP | ⚠️ | Limited parameter hints |
| History Symbols | LSP | ⚠️ | Generic parsing only |

---

## 12. LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented |
| ❌ | Not implemented |
| N/A | Not applicable |
| Schema | Uses YAML schema-driven validation |
| YAML | Uses YAML documentation files |

---

## 13. DIAGNOSTIC CODE RANGES

| Range | Category | Module(s) |
|-------|----------|-----------|
| CK30xx | Syntax/Basic | `diagnostics.py` |
| CK31xx | Scope Validation | `scopes.py`, `diagnostics.py` |
| CK33xx | Style/Formatting | `style_checks.py` |
| CK34xx | Portraits | `events.py`, schemas |
| CK35xx | Events | `events.py`, schemas |
| CK3550-CK3555 | Scope Timing | `scope_timing.py` |
| CK36xx | Localization | `localization.py` |
| CK37xx | Event Structure | `events.py`, schemas |
| CK38xx | Effect/Trigger Context | `paradox_checks.py`, `generic_rules_validator.py` |
| CK39xx | List Iterators | `lists.py` |
| CK51xx | Common Gotchas | `paradox_checks.py` |
| VAR-xxx | Variables | `variables.py` |
| VALUE-xxx | Script Values | `script_values.py` |
| SCRIPT-xxx | Scripted Blocks | `scripted_blocks.py` |
| TRAIT-xxx | Traits | `traits.py` |
| WORKSPACE-xxx | Workspace | `workspace.py` |
| LOGWATCH-xxx | Log Watcher | `log_watcher.py` |
| LOGANAL-xxx | Log Analyzer | `log_analyzer.py` |
| LOGDIAG-xxx | Log Diagnostics | `log_diagnostics.py` |
| EVENT-xxx | Events (legacy) | `events.py` |

---

## 14. LSP FEATURES IMPLEMENTED (Complete List)

### 14.1 Text Synchronization

| Feature | Method | Status |
|---------|--------|--------|
| Document Open | `textDocument/didOpen` | ✅ |
| Document Change | `textDocument/didChange` | ✅ |
| Document Close | `textDocument/didClose` | ✅ |
| Document Save | `textDocument/didSave` | ✅ |

### 14.2 Language Features

| Feature | Method | Module | Status |
|---------|--------|--------|--------|
| Completion | `textDocument/completion` | `completions.py`, `schema_completions.py` | ✅ |
| Hover | `textDocument/hover` | `hover.py`, `schema_hover.py` | ✅ |
| Signature Help | `textDocument/signatureHelp` | `signature_help.py` | ✅ |
| Go-to-Definition | `textDocument/definition` | `navigation.py` | ✅ |
| Find References | `textDocument/references` | `navigation.py` | ✅ |
| Document Highlight | `textDocument/documentHighlight` | `document_highlight.py` | ✅ |
| Document Symbol | `textDocument/documentSymbol` | `symbols.py`, `schema_symbols.py` | ✅ |
| Workspace Symbol | `workspace/symbol` | `indexer.py` | ✅ |
| Code Action | `textDocument/codeAction` | `code_actions.py` | ✅ |
| Code Lens | `textDocument/codeLens` | `code_lens.py` | ✅ |
| Code Lens Resolve | `codeLens/resolve` | `code_lens.py` | ✅ |
| Document Link | `textDocument/documentLink` | `document_links.py` | ✅ |
| Document Link Resolve | `documentLink/resolve` | `document_links.py` | ✅ |
| Formatting | `textDocument/formatting` | `formatting.py` | ✅ |
| Range Formatting | `textDocument/rangeFormatting` | `formatting.py` | ✅ |
| Prepare Rename | `textDocument/prepareRename` | `rename.py` | ✅ |
| Rename | `textDocument/rename` | `rename.py` | ✅ |
| Folding Range | `textDocument/foldingRange` | `folding.py` | ✅ |
| Semantic Tokens | `textDocument/semanticTokens/full` | `semantic_tokens.py` | ✅ |
| Inlay Hint | `textDocument/inlayHint` | `inlay_hints.py` | ✅ |
| Inlay Hint Resolve | `inlayHint/resolve` | `inlay_hints.py` | ✅ |
| Publish Diagnostics | `textDocument/publishDiagnostics` | `diagnostics.py` | ✅ |

### 14.3 Custom Commands

| Command | Description | Status |
|---------|-------------|--------|
| `ck3.validateWorkspace` | Validate entire workspace | ✅ |
| `ck3.startLogWatcher` | Start game log monitoring | ✅ |
| `ck3.stopLogWatcher` | Stop game log monitoring | ✅ |

---

*Last Updated: January 2026*
