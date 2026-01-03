# Internal Diagnostic Codes

This document covers **internal diagnostic codes** used for debugging, error handling, and internal validation within the PyChivalry LSP. These codes are typically not shown to users during normal operation but may appear in logs or during error conditions.

---

## Overview

Internal codes are organized by module and represent internal error states, parse failures, or system issues. They help developers debug problems with the language server itself.

---

## Index Operations (INDEX-XXX)

**Module:** `indexer.py`

| Code | Description |
|------|-------------|
| **INDEX-001** | Failed to parse document for indexing |
| **INDEX-002** | Duplicate symbol definition detected |
| **INDEX-003** | Index corruption detected |
| **INDEX-004** | Workspace scan timeout |

These codes indicate issues with the workspace indexing system that tracks symbols across files.

---

## Localization Internal (LOC-XXX)

**Module:** `localization.py`

| Code | Description |
|------|-------------|
| **LOC-001** | Invalid localization key format |
| **LOC-002** | Unknown character function in loc string |
| **LOC-003** | Malformed text formatting code |
| **LOC-004** | Invalid icon reference |
| **LOC-005** | Unclosed brackets in localization text |
| **LOC-006** | Unknown concept reference |

These handle parsing and validation of localization file content beyond just key existence.

---

## Log Diagnostics (LOGDIAG-XXX)

**Module:** `log_diagnostics.py`

| Code | Description |
|------|-------------|
| **LOGDIAG-001** | URI resolution failed |
| **LOGDIAG-002** | Diagnostic conversion error |
| **LOGDIAG-003** | Publishing failed |

These track issues converting game log errors to LSP diagnostics.

---

## Log Watcher (LOGWATCH-XXX)

**Module:** `log_watcher.py`

| Code | Description |
|------|-------------|
| **LOGWATCH-001** | Log directory not found |
| **LOGWATCH-002** | File access error |
| **LOGWATCH-003** | Watcher initialization failed |
| **LOGWATCH-004** | Parse error in log line |

These track issues with the CK3 error log monitoring system.

---

## Parser (PARSE-XXX)

**Module:** `parser.py`

| Code | Description |
|------|-------------|
| **PARSE-001** | Unterminated string literal |
| **PARSE-002** | Invalid number format |
| **PARSE-003** | Unexpected token |
| **PARSE-004** | Unclosed block (missing closing brace) |
| **PARSE-005** | Invalid assignment syntax |

These represent low-level parse errors that may be reported differently to users (as CK3001/CK3002) but tracked internally with more detail.

---

## Scripted Blocks (SCRIPT-XXX)

**Module:** `scripted_blocks.py`

| Code | Description |
|------|-------------|
| **SCRIPT-001** | Undefined scripted trigger/effect |
| **SCRIPT-002** | Missing required parameter |
| **SCRIPT-003** | Invalid parameter name format |
| **SCRIPT-004** | Scope requirement not met |
| **SCRIPT-005** | Circular dependency in script references |
| **SCRIPT-006** | Inline script file not found |

These handle validation of scripted_triggers and scripted_effects.

---

## Semantic Tokens (TOKEN-XXX)

**Module:** `semantic_tokens.py`

| Code | Description |
|------|-------------|
| **TOKEN-001** | Unable to generate semantic tokens (parse error) |
| **TOKEN-002** | Token encoding overflow |
| **TOKEN-003** | Invalid token range |

These track issues with syntax highlighting token generation.

---

## Signature Help (SIG-XXX)

**Module:** `signature_help.py`

| Code | Description |
|------|-------------|
| **SIG-001** | Unable to determine active signature |
| **SIG-002** | Invalid parameter context |
| **SIG-003** | Signature documentation unavailable |

These track issues with parameter hint generation.

---

## Workspace (WORKSPACE-XXX)

**Module:** `workspace.py`

| Code | Description |
|------|-------------|
| **WORKSPACE-001** | Invalid mod descriptor format or missing required fields |
| **WORKSPACE-002** | Undefined scripted effect referenced across workspace |
| **WORKSPACE-003** | Undefined scripted trigger referenced across workspace |
| **WORKSPACE-004** | Broken event chain (trigger_event target doesn't exist) |
| **WORKSPACE-005** | Missing localization keys for events |
| **WORKSPACE-006** | Incompatible mod/game version mismatch |

These track cross-file validation issues at the workspace level.

---

## Variables (VAR-XXX)

**Module:** `variables.py`

| Code | Description |
|------|-------------|
| **VAR-001** | Invalid variable name format |
| **VAR-002** | Unknown variable scope prefix |
| **VAR-003** | Invalid set_variable parameters |
| **VAR-004** | Invalid change_variable parameters |
| **VAR-005** | Invalid clamp_variable parameters (min > max) |
| **VAR-006** | Invalid variable list operation parameters |

These validate CK3's variable system usage.

---

## Traits (TRAIT-XXX)

**Module:** `traits.py`

| Code | Description |
|------|-------------|
| **TRAIT-001** | Unknown trait reference |

This is used internally; users see CK3451 for trait validation.

---

## Usage Notes

These internal codes are primarily for:

1. **Development Debugging** - Understanding internal failures
2. **Log Analysis** - Tracking issues in production
3. **Error Categorization** - Grouping related failures

Most users will never see these codes directly. They're converted to user-friendly CK3XXX codes or logged silently for troubleshooting.

---

## Related Documentation

- [Main Diagnostic Codes](Diagnostic%20codes.md) - User-facing CK3XXX codes
- [Schema Authoring Guide](../docs/SCHEMA_AUTHORING_GUIDE.md) - Creating validation schemas
