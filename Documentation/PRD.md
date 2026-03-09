# Product Requirements Document (PRD)
# pychivalry - CK3 Language Server & VS Code Extension

| Field | Value |
|-------|-------|
| **Product Name** | pychivalry |
| **Version** | 1.2.0 |
| **Author** | Cyborgninja21 |
| **Last Updated** | January 8, 2026 |
| **Status** | Production Ready |
| **License** | Apache 2.0 |

---

## Table of Contents

1. [Introduction / Overview](#1-introduction--overview)
2. [Goals / Objectives](#2-goals--objectives)
3. [Target Audience / User Personas](#3-target-audience--user-personas)
4. [User Stories / Use Cases](#4-user-stories--use-cases)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Data Extraction Roadmap](#7-data-extraction-roadmap)
8. [Success Metrics](#8-success-metrics)
9. [Open Questions / Future Considerations](#9-open-questions--future-considerations)

---

## 1. Introduction / Overview

### 1.1 What is pychivalry?

**pychivalry** is a Language Server Protocol (LSP) implementation that brings modern IDE features to Crusader Kings 3 mod development. It transforms the CK3 modding experience from error-prone wiki-hunting into a professional development environment with real-time validation, intelligent autocomplete, and comprehensive documentation at your fingertips.

### 1.2 The Problem

CK3 modding is powerful but challenging:

| Pain Point | Impact |
|------------|--------|
| **No IDE tooling** | Paradox's custom scripting language has no native editor support |
| **Runtime-only errors** | Syntax mistakes only appear when the game crashes or shows pink textures |
| **Documentation scattered** | Wiki-hunting for effect/trigger syntax wastes hours |
| **Inconsistent formatting** | No standard code style across the community |
| **Complex scope system** | Scope chain errors are difficult to debug |

### 1.3 The Solution

pychivalry provides:

- **Real-time validation** — Catch errors before launching the game
- **Context-aware autocomplete** — 500+ effects, 400+ triggers, intelligent filtering
- **Hover documentation** — Rich tooltips without leaving the editor
- **Go-to-definition** — Navigate large mods instantly
- **Professional tooling** — Formatting, rename, find references, code actions

### 1.4 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language Server | TypeScript (vscode-languageserver) | LSP implementation |
| VS Code Extension | TypeScript | Editor integration |
| Data Format | YAML schemas | Declarative validation rules |
| Protocol | LSP 3.17 | Editor-agnostic communication |

---

## 2. Goals / Objectives

### 2.1 Achieved Goals (v1.0.0 - v1.1.0)

| Goal | Status | Evidence |
|------|--------|----------|
| Production-ready LSP server | ✅ Complete | 1,142+ passing tests |
| Core IDE features | ✅ Complete | 33+ LSP features implemented |
| Schema-driven validation | ✅ Complete | 17 file types fully validated |
| Real-time diagnostics | ✅ Complete | Syntax, semantic, scope validation |
| Game log integration | ✅ Complete | Live error detection from game.log |
| VS Code extension | ✅ Complete | Full feature parity with server |

### 2.2 Current Objectives (v1.2+)

| Objective | Priority | Status |
|-----------|----------|--------|
| **Threading System Optimization** | High | ✅ Complete — 50-80% performance improvement |
| **Semantic Tokens** | High | In Progress — Rich syntax highlighting |
| **Workspace Validation** | High | In Progress — Cross-file validation |
| **VS Code Marketplace** | High | Planned — Public release |
| **Schema Coverage Expansion** | Medium | Ongoing — Add remaining file types |
| **Data Extraction Framework** | Medium | Planned — Systematic game data extraction |

### 2.3 Long-Term Vision

Transform pychivalry into the **definitive IDE experience for Paradox modding**, potentially expanding beyond CK3 to other Clausewitz engine games (EU4, HOI4, Stellaris, Victoria 3).

---

## 3. Target Audience / User Personas

### 3.1 Primary Personas

#### Persona 1: Novice Modder ("First Event")

| Attribute | Description |
|-----------|-------------|
| **Experience** | New to CK3 scripting, learning syntax |
| **Goals** | Create first event, understand scope system |
| **Pain Points** | Cryptic error messages, unknown keywords |
| **Key Features** | Autocomplete, hover docs, error messages with suggestions |
| **Success Criteria** | "I created a working event without wiki-hunting" |

#### Persona 2: Intermediate Modder ("Content Creator")

| Attribute | Description |
|-----------|-------------|
| **Experience** | Comfortable with events, decisions, story cycles |
| **Goals** | Build cohesive content packs, maintain quality |
| **Pain Points** | Inconsistent formatting, missing localization |
| **Key Features** | Go-to-definition, formatting, code lens (missing loc warnings) |
| **Success Criteria** | "My mod is well-organized and error-free" |

#### Persona 3: Advanced Modder ("Overhaul Developer")

| Attribute | Description |
|-----------|-------------|
| **Experience** | Large multi-file mods, complex scope chains |
| **Goals** | Maintain massive codebases, refactor safely |
| **Pain Points** | Cross-file dependencies, rename propagation |
| **Key Features** | Workspace symbols, find references, rename, cross-file validation |
| **Success Criteria** | "I can refactor 500 files with confidence" |

#### Persona 4: Content Creator ("Tutorial Author")

| Attribute | Description |
|-----------|-------------|
| **Experience** | Writes guides, shares code snippets |
| **Goals** | Consistent code style, demonstrable examples |
| **Pain Points** | Formatting inconsistency, unclear best practices |
| **Key Features** | Auto-formatting, style checks, code actions |
| **Success Criteria** | "My tutorials look professional and follow conventions" |

### 3.2 User Distribution Estimate

```
Novice Modders:      ████████████████████ 40%
Intermediate:        ██████████████████   35%
Advanced/Overhaul:   ████████             15%
Content Creators:    █████                10%
```

---

## 4. User Stories / Use Cases

### 4.1 Core User Stories

#### US-001: Autocomplete Effects
> **As a** novice modder  
> **I want** autocomplete suggestions when typing effects  
> **So that** I don't have to memorize or look up effect names

**Acceptance Criteria:**
- [x] Typing `add_` shows `add_gold`, `add_prestige`, `add_trait`, etc.
- [x] Context-aware: effects only shown in effect blocks
- [x] Includes snippets with parameter placeholders

#### US-002: Real-Time Error Detection
> **As an** intermediate modder  
> **I want** to see errors as I type  
> **So that** I catch mistakes before launching the game

**Acceptance Criteria:**
- [x] Syntax errors highlighted immediately
- [x] Effects in trigger blocks flagged
- [x] Unknown effects/triggers show suggestions
- [x] Scope chain errors detected

#### US-003: Navigate to Definitions
> **As an** advanced modder  
> **I want** to jump to event/effect/trigger definitions  
> **So that** I can understand and modify cross-file references

**Acceptance Criteria:**
- [x] Ctrl+Click on event ID jumps to definition
- [x] Works for scripted_effects, scripted_triggers
- [x] Works for localization keys
- [x] Works across workspace folders

#### US-004: Rename Symbols Safely
> **As an** overhaul developer  
> **I want** to rename an event and update all references  
> **So that** I can refactor without breaking things

**Acceptance Criteria:**
- [x] F2 on event ID renames across all files
- [x] Updates localization keys (.t, .desc, .a suffixes)
- [x] Updates trigger_event references
- [x] Preview changes before applying

#### US-005: Format Code Consistently
> **As a** content creator  
> **I want** to auto-format my code to Paradox conventions  
> **So that** my code is readable and consistent

**Acceptance Criteria:**
- [x] Shift+Alt+F formats entire document
- [x] Tab indentation (Paradox convention)
- [x] Consistent brace placement
- [x] Proper spacing around operators

#### US-006: Understand Code at a Glance
> **As a** novice modder  
> **I want** to hover over keywords and see documentation  
> **So that** I understand what each effect/trigger does

**Acceptance Criteria:**
- [x] Hover shows effect description
- [x] Shows parameter signatures
- [x] Includes usage examples
- [x] Links to wiki where relevant

#### US-007: Live Game Error Detection
> **As an** intermediate modder  
> **I want** errors from game.log to appear in VS Code  
> **So that** I can fix runtime errors without alt-tabbing

**Acceptance Criteria:**
- [x] Watch game.log in real-time
- [x] Parse error patterns (10+ types)
- [x] Show diagnostics in Problems panel
- [x] Fuzzy-match suggestions for typos

### 4.2 Use Case Matrix

| Use Case | Novice | Intermediate | Advanced | Creator |
|----------|--------|--------------|----------|---------|
| Autocomplete | ●●●●● | ●●●●○ | ●●●○○ | ●●●○○ |
| Real-time errors | ●●●●● | ●●●●● | ●●●●● | ●●●●○ |
| Go-to-definition | ●●○○○ | ●●●●○ | ●●●●● | ●●●○○ |
| Find references | ●○○○○ | ●●●○○ | ●●●●● | ●●○○○ |
| Rename symbol | ●○○○○ | ●●●○○ | ●●●●● | ●●○○○ |
| Formatting | ●●●○○ | ●●●●○ | ●●●○○ | ●●●●● |
| Hover docs | ●●●●● | ●●●●○ | ●●●○○ | ●●●●○ |
| Game log watcher | ●●●●○ | ●●●●● | ●●●●● | ●●●○○ |

*Legend: ● = importance level (5 = critical, 1 = nice-to-have)*

---

## 5. Functional Requirements

### 5.1 Feature Inventory (v1.1.0)

#### 5.1.1 Validation Features

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-VAL-001 | Syntax Validation | Parse errors, bracket matching | ✅ |
| F-VAL-002 | Semantic Validation | Effect/trigger context, required fields | ✅ |
| F-VAL-003 | Scope Validation | Scope chain transitions, saved scopes | ✅ |
| F-VAL-004 | Schema Validation | File-type-specific field requirements | ✅ |
| F-VAL-005 | Cross-File References | Undefined effect/trigger detection | ✅ |
| F-VAL-006 | Localization Validation | Missing/invalid localization keys | ✅ |
| F-VAL-007 | Style Validation | Whitespace, formatting conventions | ✅ |
| F-VAL-008 | Game Log Analysis | Runtime error detection from game.log | ✅ |

#### 5.1.2 Navigation Features

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-NAV-001 | Go-to-Definition | Jump to symbol definition | ✅ |
| F-NAV-002 | Find References | Find all usages of symbol | ✅ |
| F-NAV-003 | Document Symbols | Outline/breadcrumb navigation | ✅ |
| F-NAV-004 | Workspace Symbols | Search across workspace (Ctrl+T) | ✅ |
| F-NAV-005 | Document Highlight | Highlight all occurrences in file | ✅ |
| F-NAV-006 | Document Links | Clickable file paths, URLs, event refs | ✅ |

#### 5.1.3 Editing Features

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-EDT-001 | Completions | Context-aware autocomplete | ✅ |
| F-EDT-002 | Hover | Rich documentation tooltips | ✅ |
| F-EDT-003 | Signature Help | Parameter hints for effects | ✅ |
| F-EDT-004 | Inlay Hints | Inline scope type annotations | ✅ |
| F-EDT-005 | Code Lens | Reference counts, warnings | ✅ |
| F-EDT-006 | Formatting | Document/range formatting | ✅ |
| F-EDT-007 | Folding | Code folding (blocks, regions) | ✅ |
| F-EDT-008 | Rename | Workspace-wide symbol rename | ✅ |
| F-EDT-009 | Code Actions | Quick fixes, refactoring | ✅ |
| F-EDT-010 | Semantic Tokens | Rich syntax highlighting | 🚧 In Progress |

#### 5.1.4 Workspace Features

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-WKS-001 | Multi-Folder Support | Multiple workspace roots | ✅ |
| F-WKS-002 | Mod Descriptor Parsing | Parse *.mod files | ✅ |
| F-WKS-003 | Cross-File Indexing | Symbol tracking across files | ✅ |
| F-WKS-004 | Workspace Validation | Full cross-file validation | 🚧 In Progress |

### 5.2 Schema Coverage

#### 5.2.1 Fully Validated (17 types)

| File Type | Location | Schema |
|-----------|----------|--------|
| Events | `events/` | `events.yaml` |
| Story Cycles | `common/story_cycles/` | `story_cycles.yaml` |
| Decisions | `common/decisions/` | `decisions.yaml` |
| Decision Group Types | `common/decision_group_types/` | `decision_group_types.yaml` |
| Character Interactions | `common/character_interactions/` | `character_interactions.yaml` |
| Schemes | `common/schemes/` | `schemes.yaml` |
| On Actions | `common/on_actions/` | `on_actions.yaml` |
| Activity Types | `common/activities/activity_types/` | `activity_types.yaml` |
| Pulse Actions | `common/activities/pulse_actions/` | `pulse_actions.yaml` |
| Intents | `common/activities/intents/` | `intents.yaml` |
| Activity Locales | `common/activities/activity_locales/` | `activity_locales.yaml` |
| Activity Group Types | `common/activities/activity_group_types/` | `activity_group_types.yaml` |
| Guest Invite Rules | `common/activities/guest_invite_rules/` | `guest_invite_rules.yaml` |

#### 5.2.2 Planned (35+ types)

See [feature_matrix.md](user-guide/feature_matrix.md) Section 3 for complete list including:
- Traits, Casus Belli, Buildings, Laws, Factions
- Council Tasks/Positions, Focuses, Lifestyle Perks
- Cultures, Religions, Doctrines
- Artifacts, Governments, Men at Arms
- And more...

### 5.3 Diagnostic Codes

| Prefix | Category | Example |
|--------|----------|---------|
| CK3XXX | Core validation | CK3101 (unknown effect) |
| EVENT-XXX | Event-specific | EVENT-001 (missing type) |
| STORY-XXX | Story cycles | STORY-001 (missing effect_group) |
| DECISION-XXX | Decisions | DECISION-001 (missing ai_check_interval) |
| INTERACTION-XXX | Interactions | INTERACTION-001 (missing category) |
| SCHEME-XXX | Schemes | SCHEME-001 (missing skill) |
| ON_ACTION-XXX | On-actions | ON_ACTION-001 (empty on_action) |
| SCHEMA-XXX | Schema validation | SCHEMA-001 (pattern mismatch) |

See [Diagnostic Index](user-guide/diagnostics/Diagnostic%20codes%20-%20Index.md) for complete reference.

---

## 6. Non-Functional Requirements

### 6.1 Performance Requirements

| Metric | Target | Current |
|--------|--------|---------|
| Server startup | < 100ms | ✅ Achieved |
| Completion response | < 10ms | ✅ Achieved |
| Diagnostics (typical file) | < 50ms | ✅ Achieved |
| Workspace indexing (large mod) | < 5s | ✅ Achieved |
| Memory usage (1000 files) | < 200MB | ✅ Achieved |

#### Threading System Optimizations (v1.2)

**January 2026** — Comprehensive threading system overhaul achieving 50-80% performance improvement:

| Optimization | Impact | Status |
|--------------|--------|--------|
| Fast task ID generation | 80-90% faster (UUID → itertools.count) | ✅ Complete |
| RLock → Lock optimization | 20-30% faster lock operations | ✅ Complete |
| O(1) URI-based cancellation | 95% faster (O(n) → O(1) with hash index) | ✅ Complete |
| Priority-based scheduling | 2-5x faster for CRITICAL tasks | ✅ Complete |
| Atomic counters | 30-50% faster metrics (lock-free) | ✅ Complete |
| Thread pool pre-warming | Eliminates cold-start latency | ✅ Complete |

**Key Results:**
- Task submission: ~9μs mean (40-50% improvement)
- Task latency: ~0.08ms P50 (15-25% improvement)
- URI cancellation: ~167μs for 20 tasks (95% faster)
- Throughput: ~2000 tasks/sec (50-80% improvement)
- CRITICAL priority tasks no longer blocked by LOW priority indexing

**Test Coverage:** 22/22 tests passing (17 original + 5 new priority tests)

See [docs/threading-optimization-complete.md](../docs/threading-optimization-complete.md) for full implementation details.

### 6.2 Compatibility Requirements

| Requirement | Specification |
|-------------|---------------|
| Node.js | 18+ |
| VS Code | 1.75.0+ |
| Node.js | 18+ (for extension build) |
| Operating Systems | Windows, macOS, Linux |
| CK3 Versions | All versions (syntax is stable) |

### 6.3 Reliability Requirements

| Requirement | Target |
|-------------|--------|
| Test Coverage | 1,142+ tests passing (language server + 22 threading tests) |
| Crash Recovery | Graceful degradation on parse errors |
| Thread Safety | Optimized locks + atomic counters on shared data structures |
| Memory Leaks | LRU caches with size limits + automatic task cleanup |
| Priority Enforcement | CRITICAL tasks execute before LOW priority background work |

### 6.4 Usability Requirements

| Requirement | Implementation |
|-------------|----------------|
| Zero-config startup | Works immediately on mod folders |
| Progressive enhancement | Basic features without game data |
| Clear error messages | Diagnostic codes with explanations |
| Discoverable features | Command palette, hover hints |

### 6.5 Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| No telemetry | No data collection |
| Local processing | All validation runs locally |
| Safe file access | Path validation, no arbitrary execution |
| Game data privacy | Extracted data stays local, gitignored |

---

## 7. Data Extraction Roadmap

### 7.1 Overview

Many advanced pychivalry features require data extracted from a user's CK3 installation. This data is **copyrighted by Paradox Interactive** and must be extracted locally by each user—it cannot be distributed with the extension.

### 7.2 Current State

| Data Type | Status | Command |
|-----------|--------|---------|
| Traits | ✅ Implemented | `CK3: Extract Trait Data from CK3 Installation` |
| Effects | ❌ Hardcoded | — |
| Triggers | ❌ Hardcoded | — |
| Scopes | ❌ Hardcoded | — |
| Modifiers | ❌ Not extracted | — |

### 7.3 Extraction Roadmap

| Phase | Data Types | Features Unlocked |
|-------|------------|-------------------|
| **Phase 1** (Current) | Traits | Trait validation, completion, hover |
| **Phase 2** | Effects, Triggers | Complete effect/trigger validation |
| **Phase 3** | Scopes, Modifiers | Full scope chain validation |
| **Phase 4** | Buildings, Laws, etc. | Domain-specific validation |
| **Phase 5** | Localization templates | Loc key pattern validation |

### 7.4 Design Principles

1. **Graceful Degradation** — All features work without extracted data (reduced accuracy)
2. **User-Initiated** — Extraction only happens when user runs command
3. **Local Storage** — Data stored in extension directory, gitignored
4. **Version Aware** — Support multiple CK3 versions if syntax changes
5. **Incremental** — Extract only what's needed, cache results

### 7.5 User Experience Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRST LAUNCH                              │
├─────────────────────────────────────────────────────────────┤
│  1. Extension activates                                      │
│  2. Basic features work immediately (syntax, formatting)     │
│  3. Notification: "Extract game data for full validation"    │
│  4. User runs extraction command                             │
│  5. Selects CK3 installation folder                          │
│  6. Data extracted to local YAML files                       │
│  7. Full features now available                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Success Metrics

### 8.1 Primary Metrics

#### Coverage Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Schema-validated file types | 17 | Open-ended (all common/ types feasible) |
| LSP features implemented | 33 | 35+ (add Semantic Tokens, Workspace Validation) |
| Test count | 1,142 | Maintain 100% pass rate |
| Diagnostic code coverage | 100+ codes | Expand per schema |

#### Adoption Metrics

| Metric | Current | Target (12 months) |
|--------|---------|-------------------|
| VS Code Marketplace installs | 0 (not published) | Track post-launch |
| GitHub stars | TBD | Track growth |
| GitHub issues (user-reported) | TBD | Track engagement |
| Community mods using pychivalry | 0 | Track adoption |

### 8.2 Secondary Metrics

| Category | Metric |
|----------|--------|
| **Quality** | Bug reports per release |
| **Performance** | Response time P95 |
| **Community** | Pull requests from contributors |
| **Documentation** | User guide completeness |

### 8.3 Measurement Plan

| Metric | How Measured | Frequency |
|--------|--------------|-----------|
| Schema coverage | Count files in `data/schemas/` | Per release |
| Test coverage | Mocha test output | Per commit |
| Marketplace installs | VS Code Marketplace dashboard | Weekly |
| GitHub activity | GitHub Insights | Monthly |

---

## 9. Open Questions / Future Considerations

### 9.1 Open Questions

| ID | Question | Impact | Status |
|----|----------|--------|--------|
| OQ-001 | Paradox IP policy for game data extraction? | Could affect distribution | Research needed |
| OQ-002 | Support for other Clausewitz games (EU4, HOI4)? | Major scope expansion | Future consideration |
| OQ-003 | Web-based version (Monaco editor)? | Accessibility | Low priority |
| OQ-004 | Collaboration with CWTools (existing tool)? | Community alignment | Open |
| OQ-005 | Monetization (if any)? | Sustainability | Open-source preferred |

### 9.2 Future Feature Considerations

| Feature | Description | Priority |
|---------|-------------|----------|
| **GFX Validation** | Validate graphics file references exist | Medium |
| **GUI Support** | Full validation for `.gui` files | Low |
| **History Files** | Validation for `history/` folder | Low |
| **Debugging Integration** | CK3 debug console integration | Low |
| **AI Assistant** | LLM-powered mod suggestions | Future |

### 9.3 Known Limitations

| Limitation | Workaround | Future Fix? |
|------------|------------|-------------|
| Requires CK3 for full features | Works without, reduced accuracy | Data extraction framework |
| No GUI file validation | Basic syntax highlighting only | GUI schema planned |
| History files not validated | Manual review | History schema planned |
| No multiplayer compatibility check | N/A | Out of scope |

### 9.4 Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CK3 syntax changes | Low | Medium | Version detection, community reports |
| Paradox legal concerns | Low | High | User-extracted data only, respect copyright |
| VS Code API changes | Low | Low | Use stable APIs only |

---

## Appendix A: Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.1.0 | 2026-01-01 | Live Game Log Analysis |
| 1.0.0 | 2026-01-01 | First stable release, 1,142 tests |
| 0.2.0 | 2025-12-30 | Hover, diagnostics, scope system |
| 0.1.0 | 2025-12-30 | Initial release, autocomplete |

## Appendix B: Related Documents

| Document | Location |
|----------|----------|
| Feature Matrix | [Documentation/user-guide/feature_matrix.md](user-guide/feature_matrix.md) |
| Diagnostic Index | [Documentation/user-guide/diagnostics/](user-guide/diagnostics/) |
| Schema Authoring Guide | [Documentation/schemas/SCHEMA_AUTHORING_GUIDE.md](schemas/SCHEMA_AUTHORING_GUIDE.md) |
| CK3 Content Types | [Documentation/schemas/ck3_content_types.md](schemas/ck3_content_types.md) |
| Changelog | [CHANGELOG.md](../CHANGELOG.md) |
| Contributing Guide | [CONTRIBUTING.md](../CONTRIBUTING.md) |

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **LSP** | Language Server Protocol — standard for IDE features |
| **CK3** | Crusader Kings 3 — Paradox grand strategy game |
| **Schema** | YAML file defining validation rules for a file type |
| **Scope** | CK3 context (character, title, province, etc.) |
| **Effect** | CK3 command that changes game state |
| **Trigger** | CK3 condition that evaluates to true/false |
| **vscode-languageserver** | TypeScript Language Server framework |

---

*Document generated: January 6, 2026*
*Next review: On major version release*
