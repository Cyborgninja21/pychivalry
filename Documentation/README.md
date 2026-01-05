# 📚 PyChivalry Documentation

Welcome to the PyChivalry documentation! PyChivalry is a **Language Server Protocol (LSP) implementation** for Crusader Kings 3 modding, providing intelligent code assistance, validation, and diagnostics for Paradox script files.

Whether you're building events, decisions, story cycles, or any other CK3 mod content, PyChivalry helps you write better code faster with real-time error detection, auto-completion, and comprehensive validation.

---

## 📑 Documentation by Audience

| Section | Who It's For | Description |
|---------|--------------|-------------|
| [📖 User Guide](#-user-guide) | CK3 Modders | Features, diagnostics, and how to use PyChivalry |
| [🔧 Developer Guide](#-developer-guide) | Contributors | Testing, architecture, and development setup |
| [📐 Schema Authoring](#-schema-authoring) | Schema Authors | Creating validation schemas for new file types |
| [🎮 CK3 Reference](#-ck3-reference) | Modders | CK3-specific modding guides and templates |

---

## 📖 User Guide

Documentation for CK3 modders using PyChivalry.

| Document | Description |
|----------|-------------|
| [Feature Matrix](user-guide/feature_matrix.md) | Complete list of LSP features and their implementation status |

### ⚠️ Diagnostic Reference

PyChivalry provides extensive diagnostics to help you catch errors. See the [Diagnostic Index](user-guide/diagnostics/Diagnostic%20codes%20-%20Index.md) for a complete list, or jump to a category:

| Category | Code Prefix | Description |
|----------|-------------|-------------|
| [Standard](user-guide/diagnostics/Diagnostic%20codes.md) | `CK3XXX` | Core syntax, semantic, scope, and style validation |
| [Story Cycles](user-guide/diagnostics/Diagnostic%20codes%20-%20Story%20Cycles.md) | `STORY-XXX` | Story cycle structure and flow validation |
| [Decisions](user-guide/diagnostics/Diagnostic%20codes%20-%20Decisions.md) | `DECISION-XXX` | Decision configuration validation |
| [Interactions](user-guide/diagnostics/Diagnostic%20codes%20-%20Interactions.md) | `INTERACTION-XXX` | Character interaction validation |
| [Schemes](user-guide/diagnostics/Diagnostic%20codes%20-%20Schemes.md) | `SCHEME-XXX` | Scheme configuration validation |
| [On Actions](user-guide/diagnostics/Diagnostic%20codes%20-%20On%20Actions.md) | `ON_ACTION-XXX` | On-action hook validation |
| [Events](user-guide/diagnostics/Diagnostic%20codes%20-%20Events.md) | `EVENT-XXX` | Event-type-specific validation |
| [Schema](user-guide/diagnostics/Diagnostic%20codes%20-%20Schema%20Validation.md) | `SCHEMA-XXX` | Pattern and type validation |
| [Internal](user-guide/diagnostics/Diagnostic%20codes%20-%20Internal.md) | Various | Debug and internal diagnostics |

### Understanding Diagnostic Severity

| Severity | Meaning |
|----------|---------|
| 🔴 Error | Must be fixed — will cause issues in-game |
| 🟡 Warning | Should be reviewed — potential problems |
| 🔵 Information | Suggestions for improvement |
| ⚪ Hint | Style and best practice recommendations |

---

## 🔧 Developer Guide

Documentation for PyChivalry contributors.

| Document | Description |
|----------|-------------|
| [Test Suites](developer-guide/Test%20Suites.md) | Test organization, coverage, and how to run tests |
| [Pre-commit Setup](developer-guide/PRE_COMMIT_SETUP.md) | Installing pre-commit hooks for code quality |
| [Pre-commit Usage](developer-guide/PRE_COMMIT_USAGE_GUIDE.md) | Daily workflow with pre-commit hooks |

### Architecture

| Document | Description |
|----------|-------------|
| [Validation Architecture](developer-guide/architecture/VALIDATION.md) | How the validation system works internally |

---

## 📐 Schema Authoring

Documentation for creating validation schemas for new CK3 file types.

| Document | Description |
|----------|-------------|
| [Schema Authoring Guide](schemas/SCHEMA_AUTHORING_GUIDE.md) | Complete guide for writing YAML validation schemas |
| [Onboarding Template](schemas/SCHEMA_ONBOARDING_TEMPLATE.md) | Template for planning new schema implementations |
| [CK3 Content Types](schemas/ck3_content_types.md) | Reference of all moddable content types and their validation status |

### Active Schema Plans

| Document | Status | Description |
|----------|--------|-------------|
| [Activities Schema](schemas/plans/ACTIVITIES_SCHEMA_PLAN.md) | Planning | Schema for `common/activities/` validation |
| [Story Cycles Schema](schemas/plans/STORY_CYCLES_SCHEMA_PLAN.md) | Planning | Schema improvements for story cycles |

---

## 🎮 CK3 Reference

CK3-specific modding guides and templates (not PyChivalry-specific).

| Document | Description |
|----------|-------------|
| [Activity Template](ck3-reference/Activity_Template.md) | Complete guide to building CK3 activities |

---

## 📁 Folder Structure

```
Documentation/
├── README.md                     ← You are here
├── user-guide/                   ← For CK3 modders
│   ├── feature_matrix.md
│   └── diagnostics/              ← All diagnostic code references
├── developer-guide/              ← For PyChivalry contributors
│   ├── Test Suites.md
│   ├── PRE_COMMIT_SETUP.md
│   ├── PRE_COMMIT_USAGE_GUIDE.md
│   └── architecture/
│       └── VALIDATION.md
├── schemas/                      ← For schema authors
│   ├── SCHEMA_AUTHORING_GUIDE.md
│   ├── SCHEMA_ONBOARDING_TEMPLATE.md
│   ├── ck3_content_types.md
│   └── plans/                    ← Active schema development
│       ├── ACTIVITIES_SCHEMA_PLAN.md
│       └── STORY_CYCLES_SCHEMA_PLAN.md
└── ck3-reference/                ← CK3 modding guides
    └── Activity_Template.md
```

---

*Happy modding! 🎮*
