# 📚 PyChivalry Documentation

Welcome to the PyChivalry documentation! PyChivalry is a **Language Server Protocol (LSP) implementation** for Crusader Kings 3 modding, providing intelligent code assistance, validation, and diagnostics for Paradox script files.

Whether you're building events, decisions, story cycles, or any other CK3 mod content, PyChivalry helps you write better code faster with real-time error detection, auto-completion, and comprehensive validation.

---

## 📑 Table of Contents

- [Feature Matrix](#feature-matrix)
- [Test Suites](#test-suites)
- [Diagnostic Reference](#diagnostic-reference)
  - [Quick Reference Table](#diagnostic-categories-quick-reference)
  - [Standard Diagnostics](#standard-diagnostics-ck3xxx)
  - [Domain-Specific Diagnostics](#domain-specific-diagnostics)
  - [Schema Validation](#schema-validation)
  - [Internal Diagnostics](#internal-diagnostics)

---

## 🎯 Feature Matrix

| Document | Description |
|----------|-------------|
| [feature_matrix.md](feature_matrix.md) | Comprehensive overview of all LSP features implemented in PyChivalry |

**What you'll find:**
- Complete list of supported LSP capabilities
- Feature implementation status
- Integration details with VS Code extension

---

## 🧪 Test Suites

| Document | Description |
|----------|-------------|
| [Test Suites.md](Test%20Suites.md) | Documentation of all test suites and testing methodology |

**What you'll find:**
- Test organization and structure
- Coverage information
- How to run and extend tests

---

## ⚠️ Diagnostic Reference

PyChivalry provides extensive diagnostics to help you catch errors and improve your mod code. The diagnostic documentation is organized into categories for easy reference.

### Diagnostic Categories Quick Reference

| Category | Code Prefix | Count | Description |
|----------|-------------|-------|-------------|
| [Standard](diagnostics/Diagnostic%20codes.md) | `CK3XXX` | ~74 | Core syntax, semantic, scope, and style validation |
| [Story Cycles](diagnostics/Diagnostic%20codes%20-%20Story%20Cycles.md) | `STORY-XXX` | 15 | Story cycle structure and flow validation |
| [Decisions](diagnostics/Diagnostic%20codes%20-%20Decisions.md) | `DECISION-XXX` | 4 | Decision configuration validation |
| [Interactions](diagnostics/Diagnostic%20codes%20-%20Interactions.md) | `INTERACTION-XXX` | 3 | Character interaction validation |
| [Schemes](diagnostics/Diagnostic%20codes%20-%20Schemes.md) | `SCHEME-XXX` | 3 | Scheme configuration validation |
| [On Actions](diagnostics/Diagnostic%20codes%20-%20On%20Actions.md) | `ON_ACTION-XXX` | 2 | On-action hook validation |
| [Events](diagnostics/Diagnostic%20codes%20-%20Events.md) | `EVENT-XXX` | 1 | Event-type-specific validation |
| [Schema](diagnostics/Diagnostic%20codes%20-%20Schema%20Validation.md) | `SCHEMA-XXX` | 10 | Pattern and type validation |
| [Internal](diagnostics/Diagnostic%20codes%20-%20Internal.md) | Various | ~35 | Debug and internal diagnostics |

---

### 📋 Master Index

| Document | Description |
|----------|-------------|
| [Diagnostic codes - Index.md](diagnostics/Diagnostic%20codes%20-%20Index.md) | Master index linking all diagnostic documentation |

**Start here** if you're looking for a specific diagnostic code and aren't sure which category it belongs to.

---

### Standard Diagnostics (CK3XXX)

| Document | Description |
|----------|-------------|
| [Diagnostic codes.md](diagnostics/Diagnostic%20codes.md) | Main reference for ~74 standard diagnostic codes |

**What you'll find:**
- **Syntax errors** — Parsing and structural issues
- **Semantic errors** — Logical and reference problems
- **Scope validation** — Scope type mismatches and invalid transitions
- **Style warnings** — Code style and best practice suggestions
- **Event validation** — General event structure validation

---

### Domain-Specific Diagnostics

These documents cover validation rules for specific CK3 modding domains:

| Document | Codes | Description |
|----------|-------|-------------|
| [Story Cycles](diagnostics/Diagnostic%20codes%20-%20Story%20Cycles.md) | `STORY-001` to `STORY-015` | Validates story cycle definitions, chapter flow, slot usage, and state transitions |
| [Decisions](diagnostics/Diagnostic%20codes%20-%20Decisions.md) | `DECISION-001` to `DECISION-004` | Validates decision structure, conditions, and effects |
| [Interactions](diagnostics/Diagnostic%20codes%20-%20Interactions.md) | `INTERACTION-001` to `INTERACTION-003` | Validates character interaction definitions |
| [Schemes](diagnostics/Diagnostic%20codes%20-%20Schemes.md) | `SCHEME-001` to `SCHEME-003` | Validates scheme configuration and progress mechanics |
| [On Actions](diagnostics/Diagnostic%20codes%20-%20On%20Actions.md) | `ON_ACTION-001` to `ON_ACTION-002` | Validates on-action hooks and event triggering |
| [Events](diagnostics/Diagnostic%20codes%20-%20Events.md) | `EVENT-001` | Event-type-specific validation beyond standard checks |

---

### Schema Validation

| Document | Description |
|----------|-------------|
| [Diagnostic codes - Schema Validation.md](diagnostics/Diagnostic%20codes%20-%20Schema%20Validation.md) | SCHEMA-XXX codes for pattern and type validation |

**What you'll find:**
- Pattern matching validation
- Type constraint enforcement
- Required field validation
- Value range checking

---

### Internal Diagnostics

| Document | Description |
|----------|-------------|
| [Diagnostic codes - Internal.md](diagnostics/Diagnostic%20codes%20-%20Internal.md) | Internal and debug diagnostic codes |

**What you'll find:**
- Indexer diagnostics
- Parser internals
- Workspace validation
- Debug information

> 💡 **Note:** Internal diagnostics are primarily useful for PyChivalry development and troubleshooting. Most modders won't encounter these in normal usage.

---

## 🧭 Navigation Guide

### Finding a Specific Diagnostic Code

1. **Know the code prefix?** Jump directly to the relevant category document above
2. **Not sure?** Start with the [Master Index](diagnostics/Diagnostic%20codes%20-%20Index.md)
3. **Standard CK3XXX code?** Check [Diagnostic codes.md](diagnostics/Diagnostic%20codes.md)

### Understanding Diagnostic Severity

| Severity | Meaning |
|----------|---------|
| 🔴 Error | Must be fixed — will cause issues in-game |
| 🟡 Warning | Should be reviewed — potential problems |
| 🔵 Information | Suggestions for improvement |
| ⚪ Hint | Style and best practice recommendations |

### Getting Help

- Each diagnostic code includes an explanation and suggested fix
- Check the relevant category document for detailed examples
- Domain-specific documents include context about CK3 modding conventions

---

## 📁 Folder Structure

```
Documentation/
├── README.md                 ← You are here
├── feature_matrix.md         ← LSP feature documentation
├── Test Suites.md            ← Test suite documentation
└── diagnostics/              ← Diagnostic code references
    ├── Diagnostic codes - Index.md
    ├── Diagnostic codes.md
    ├── Diagnostic codes - Story Cycles.md
    ├── Diagnostic codes - Decisions.md
    ├── Diagnostic codes - Interactions.md
    ├── Diagnostic codes - Schemes.md
    ├── Diagnostic codes - On Actions.md
    ├── Diagnostic codes - Events.md
    ├── Diagnostic codes - Schema Validation.md
    └── Diagnostic codes - Internal.md
```

---

*Happy modding! 🎮*
