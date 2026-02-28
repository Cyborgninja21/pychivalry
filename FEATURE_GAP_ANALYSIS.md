# Feature Gap Analysis: RE Specifications vs Current Language Server

**Date**: February 27, 2026
**Sources**: `pdx-parser-re/spec/` (binary reverse engineering) | `Documentation/LANGUAGE_SERVER_FEATURES.md` (current features)

---

## Summary

The reverse engineering of the CK3 binary extracted **2,164 keywords** — more than double what public community documentation provides. Cross-referencing these findings against the current language server reveals 20 concrete improvements grouped into 5 priority tiers.

| Area | RE Data Available | Currently Used | Gap |
|------|-------------------|----------------|-----|
| Triggers | 995 | ~200 | **795 missing** |
| Effects | 812 | ~300 | **512 missing** |
| On-Actions | 185 | ~50 | **135 missing** |
| Interaction Hooks | 150 | 0 | **150 missing** |
| Scope Types | 15 | ~100 link entries | Partial — see Tier 2 |
| Event Types | 6 | 6 | Complete |
| Scope Transitions | ~80 | Basic chains | **Structured map missing** |
| Scriptable Systems | 160+ dirs | Partial schema | **Major gap** |

---

## Tier 1 — Data Import (Highest Impact, Lowest Effort)

These items only require updating bundled YAML data files. No new logic needed.

### 1. Complete Trigger Registry (995 triggers)

**Current**: `data/triggers/triggers.yaml` contains ~200 triggers with documentation.
**RE Source**: `spec/keywords/triggers.txt` — 995 verified triggers extracted from `TriggerRegistry` at `0x14320e860`.
**Gap**: ~795 triggers are unknown to completions, hover, and diagnostics.
**Action**: Merge all 995 triggers into `triggers.yaml`. For triggers without documentation, include them with a `description: "Undocumented trigger"` placeholder so they at least appear in completions and don't produce false-positive "unknown trigger" warnings.

### 2. Complete Effect Registry (812 effects)

**Current**: `data/effects/effects.yaml` contains ~300 effects.
**RE Source**: `spec/keywords/effects.txt` — 812 verified effects extracted from `EffectRegistry` at `0x143242000`.
**Gap**: ~512 effects missing from completions/hover/diagnostics.
**Action**: Same approach as triggers — merge all 812 into `effects.yaml`.

### 3. Complete On-Action Registry (185 on-actions)

**Current**: `data/on_actions/on_actions.yaml` contains ~50 on-actions.
**RE Source**: `spec/keywords/on_actions.txt` — 185 on-actions from `OnActionTable` at `0x14273c590`.
**Gap**: 135 on-actions missing.
**Action**: Merge into `on_actions.yaml`. On-actions are critical for event validation (validating that `on_action = { ... }` references a valid on-action).

### 4. Interaction Hook Validation (150 hooks)

**Current**: No interaction hook validation exists.
**RE Source**: `spec/keywords/interaction_hooks.txt` — 150 hooks (e.g., `on_accept`, `on_decline`, `on_send`).
**Gap**: Character interactions are a major scripting system with zero validation coverage.
**Action**: Create `data/interaction_hooks/interaction_hooks.yaml` and add a validation phase for `character_interaction` definitions.

---

## Tier 2 — Scope System Overhaul (High Impact, Medium Effort)

The RE specifications provide a complete, structured scope system far beyond our current flat link table.

### 5. Typed Scope System (15 scope types)

**Current**: `scopes.yaml` has ~100 scope link entries as a flat map. Scope validation checks chain validity but doesn't track the *type* of each scope.
**RE Source**: `spec/scopes/SCOPE_TYPES.md` defines 15 distinct scope types: `character`, `title`, `province`, `faith`, `culture`, `dynasty`, `dynasty_house`, `artifact`, `scheme`, `war`, `faction`, `activity`, `story_cycle`, `combat_side`, `great_holy_war`.
**Gap**: The server validates that `root.liege` is a valid chain but doesn't know that `liege` produces a `character` scope. This prevents type-aware trigger/effect filtering.
**Action**: Restructure `scopes.yaml` into a typed model: each scope link specifies `from_type -> to_type`. The scope validator can then infer the current scope type at any point in a chain.

### 6. Scope-Aware Completions

**Current**: Completions include all effects/triggers regardless of scope context.
**RE Source**: Each trigger/effect in the RE data is associated with specific scope types (e.g., `has_trait` requires `character` scope; `tier` requires `title` scope).
**Gap**: A user typing inside `every_held_title = { }` gets character-scope suggestions even though they're in a title scope.
**Action**: With the typed scope system (item 5), filter completions to only show triggers/effects valid in the current scope type. This is the single highest-value DX improvement.

### 7. Scope Transition Map

**Current**: Basic chain validation via flat link table.
**RE Source**: `spec/scopes/SCOPE_TRANSITIONS.md` documents ~80 structured transitions organized by source scope type:
- Character: ~30 transitions (family, liege, court, titles, identity)
- Title: ~10 transitions (holder, de_jure, de_facto, county)
- Province: ~5 transitions
- Faith/Dynasty/Culture: ~5 each
- Iterator patterns: `any_`, `every_`, `ordered_`, `random_` with result types
**Gap**: Our flat table doesn't encode which transitions are available from which scope type, leading to incomplete validation.
**Action**: Encode the full transition map with source/target types. This enables complete scope chain validation.

### 8. Saved Scope Cross-File Tracking

**Current**: The indexer tracks `save_scope_as` declarations. Completions suggest `scope:name` references.
**RE Source**: `spec/scopes/SPECIAL_SCOPES.md` documents scope stack semantics (`root`, `prev`, `this`, `from`, `prev_prev`), null-safe access (`?=`), and saved scope lifecycle rules.
**Gap**: No cross-file validation that a `scope:target` reference has a matching `save_scope_as = target` somewhere in the event chain. No warning for unused saved scopes.
**Action**: Extend the reference graph in the Enhanced Indexer to track saved scope lifecycle: declaration → usage → cross-file resolution.

---

## Tier 3 — Parser Enhancements (Medium Impact, Medium Effort)

The RE grammar reveals parser constructs we don't fully handle.

### 9. Null-Safe Scope Operator (`?=`)

**Current**: The parser handles `=` and comparison operators but not `?=`.
**RE Source**: `spec/grammar/GRAMMAR.ebnf` defines `?=` as a null-safe assignment that silently skips if the scope is null.
**Gap**: Files using `?=` may parse incorrectly or produce false errors.
**Action**: Add `?=` to the tokenizer's operator set and handle it as an assignment variant in the parser.

### 10. Variable Interpolation (`@[expr]`)

**Current**: The parser handles `@variable_name` references.
**RE Source**: `spec/grammar/GRAMMAR.ebnf` also defines `@[expression]` — inline arithmetic expressions using script value syntax (e.g., `@[base_gold + bonus * 2]`).
**Gap**: `@[...]` expressions are not tokenized or parsed, likely producing syntax errors.
**Action**: Add `@[...]` as a composite token type. Inside the brackets, parse as a script value formula.

### 11. Iterator Validation Requirements

**Current**: Basic checks — `CK3875` warns about missing `limit` in random iterators, `CK3977` warns about `every_` without limit.
**RE Source**: `spec/grammar/SYNTAX_RULES.md` documents 4 iterator prefixes (`any_`, `every_`, `ordered_`, `random_`) with distinct validation requirements:
- `any_` requires at least one trigger inside (it's a boolean check)
- `every_` and `ordered_` require at least one effect inside
- `random_` can have both but needs special weight handling
- All support optional `limit = { }` blocks
- `ordered_` supports `order_by`, `position`, `min`, `max` parameters
**Gap**: Missing validation for `any_` (boolean iterator), `ordered_` parameters, and `random_` weight blocks.
**Action**: Extend the iterator validation in the Paradox convention checks to cover all 4 patterns.

### 12. Switch Statement Validation

**Current**: No specific switch statement handling.
**RE Source**: `spec/grammar/SYNTAX_RULES.md` documents `switch = { trigger = <trigger_name> <value_1> = { ... } <value_2> = { ... } }` syntax.
**Gap**: Switch blocks are parsed as generic blocks with no structural validation.
**Action**: Add a convention check that validates switch structure: exactly one `trigger` key, and branch values that match the trigger's valid outputs.

### 13. Conditional Trigger/Effect Validation (`trigger_if`/`trigger_else`)

**Current**: `if`/`else_if`/`else` chains are validated for effects. `trigger_if`/`trigger_else_if`/`trigger_else` are not specifically handled.
**RE Source**: `spec/grammar/SYNTAX_RULES.md` distinguishes trigger-context conditionals (`trigger_if`) from effect-context conditionals (`if`). Using `if` inside a trigger block is invalid.
**Gap**: No diagnostic for using `if` where `trigger_if` is required, or vice versa.
**Action**: Add a diagnostic that checks conditional keyword usage against the current block context (trigger vs. effect).

---

## Tier 4 — System Validators (Medium Impact, Higher Effort)

These require new validation phases for specific game systems.

### 14. Decision Validation

**Current**: Decisions are indexed (symbol type DECISION) but not structurally validated.
**RE Source**: `spec/SCRIPTABLE_SYSTEMS.md` documents decision structure:
- Required: `is_shown`, `is_valid` (trigger blocks), `effect` (effect block)
- Optional: `ai_check_frequency`, `ai_will_do`, `cost`, `cooldown`, `minimum_age`
- Scope: always `character`
**Gap**: No validation of required fields, scope context, or cost/cooldown format.
**Action**: Add a decision validation phase similar to the existing event convention checks (Phase 4).

### 15. Character Interaction Validation

**Current**: CHARACTER_INTERACTION is an indexed symbol type but has no validation.
**RE Source**: `spec/SCRIPTABLE_SYSTEMS.md` documents interaction structure with 150 valid hooks (from item 4). Complex lifecycle: `is_shown` → `is_valid_showing_failures_only` → `on_accept`/`on_decline` → `on_auto_accept`.
**Gap**: No structural validation, no hook validation, no scope checking.
**Action**: New validation phase using the 150 hooks from Tier 1 as the valid field set.

### 16. Activity/Scheme/War Lifecycle Validation

**Current**: No system-specific validation for activities, schemes, or wars.
**RE Source**: `spec/SCRIPTABLE_SYSTEMS.md` documents these as complex lifecycle systems:
- Activities: `phases`, `on_start`/`on_complete`/`on_invalidated`, guest management
- Schemes: `on_ready`, `on_monthly`, agents, power/resistance
- Wars: `on_victory`/`on_white_peace`/`on_defeat`, wargoals
**Gap**: These are large scripting systems with zero validation coverage.
**Action**: Add validation phases for each, at minimum checking required lifecycle hooks and scope context.

### 17. Scriptable Directory Awareness (160+ directories)

**Current**: The server recognizes files by extension (`.txt`, `.gui`, `.gfx`, `.asset`) and infers category from path heuristics.
**RE Source**: `spec/SCRIPTABLE_SYSTEMS.md` enumerates 160+ content directories organized in a 5-level dependency hierarchy. Each directory has a specific expected file structure.
**Gap**: The server doesn't know that files in `common/decisions/` should contain decision definitions, or that `events/` should contain event definitions. This limits auto-detection of context for completions and validation.
**Action**: Create a directory-to-schema mapping. When opening a file, resolve its parent directory against the 160-directory table to determine what structures are expected. This enables:
- Auto-selecting the right schema for validation
- Context-appropriate completions (don't suggest event fields in a decision file)
- "Wrong directory" warnings

---

## Tier 5 — Developer Experience (Lower Priority, High Polish)

These are quality-of-life features that leverage the RE data for better UX.

### 18. Scope Chain Inlay Hints with Full Type Information

**Current**: Inlay hints show scope types for `save_scope_as` and iterators.
**RE Source**: With the typed scope system (item 5), every scope chain resolves to a concrete type.
**Gap**: Current hints are limited because the underlying scope model is untyped.
**Action**: Once item 5 is implemented, enhance inlay hints to show the resolved type at each step: `root` `: character` `.primary_title` `: title` `.holder` `: character`.

### 19. Event Chain Visualization

**Current**: Code lens shows event chain links. Document links allow clicking event IDs.
**RE Source**: `spec/events/EVENT_TYPES.md` documents 6 event types with scope requirements. `spec/SCRIPTABLE_SYSTEMS.md` documents the on-action → event triggering flow.
**Gap**: No visual representation of the full event chain (which on-actions trigger which events, which events trigger other events).
**Action**: Add a webview panel or tree view that renders the event chain graph for the current workspace.

### 20. Comprehensive Effect/Trigger Context Detection

**Current**: Diagnostics detect effects in trigger blocks (`CK3870`) and effects in limit blocks (`CK3871`).
**RE Source**: With 995 triggers and 812 effects fully catalogued, context detection can be exhaustive.
**Gap**: The current detection uses a small hardcoded list of known effects/triggers for context checking.
**Action**: Replace the hardcoded lists with lookups against the full 995/812 registries. Every misplaced keyword gets flagged, not just the common ones.

---

## Implementation Roadmap

| Tier | Items | Estimated Scope | Dependencies |
|------|-------|-----------------|--------------|
| **Tier 1** | 1-4 | Data files only | None |
| **Tier 2** | 5-8 | Core scope refactor | Tier 1 (for scope-aware filtering) |
| **Tier 3** | 9-13 | Parser + validation | Items 9-10 independent; 11-13 benefit from Tier 2 |
| **Tier 4** | 14-17 | New validation phases | Tier 1 (keyword data), Tier 2 (scope types) |
| **Tier 5** | 18-20 | DX polish | Tier 2 (typed scopes) |

**Recommended sequence**: Tier 1 → Tier 2 (items 5-7) → Tier 3 (items 9-10) → Tier 2 (item 8) → Tier 3 (items 11-13) → Tier 4 → Tier 5

---

*Generated from cross-referencing `pdx-parser-re/spec/` reverse engineering data against `Documentation/LANGUAGE_SERVER_FEATURES.md`.*


