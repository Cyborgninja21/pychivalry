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

The [diagnostics reference](user-guide/diagnostics/README.md) is generated from the engine's
error catalogue and `data/diagnostics.yaml` by `tools/gen-diagnostics-docs.ts`: what the engine
core reports (the game's own message ids and texts), one page per plug-in, and the full game
message catalogue by category.

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
| [Spec Package](developer-guide/spec-package.md) | The generated CK3 vocabulary package and how a new game version is adopted |
| [Issue Triage 2.0.0](developer-guide/issue-triage-2.0.0.md) | The 2.0.0 triage of the open issues |
| [Test Suites](developer-guide/Test%20Suites.md) | Test organization, coverage, and how to run tests (1.x layout) |
| [Pre-commit Setup](developer-guide/PRE_COMMIT_SETUP.md) | Installing pre-commit hooks for code quality |
| [Pre-commit Usage](developer-guide/PRE_COMMIT_USAGE_GUIDE.md) | Daily workflow with pre-commit hooks |

### Architecture

| Document | Description |
|----------|-------------|
| [Architecture Flow](developer-guide/architecture/ARCHITECTURE_FLOW.md) | Spec package, engine core and extension layers; start-up, editing and request flows |
| [Validation Pipeline](developer-guide/architecture/VALIDATION.md) | Parse, registry, schema, scope, plug-ins |

---

## 📐 Schema Authoring

Historical (1.x). Since 2.0.0 the per-directory schemas come from the spec package
([spec package](developer-guide/spec-package.md)); the hand-written YAML schemas these guides
describe (`data/schemas/`) were deleted.

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

The CK3 executable analysis that used to sit here (`ck3_exe_analysis.md` / `.json`) was removed in 2.0.0: it is superseded by [pdx-parser-re](https://github.com/Cyborgninja21/pdx-parser-re), whose engine-derived spec package the engine core now bundles.

Sprint reports, session summaries and other historical documents are in [archive/](archive/README.md).

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
