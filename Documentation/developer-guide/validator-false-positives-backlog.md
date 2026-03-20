# Validator False Positives Backlog

**GitHub Issue Title:** Fix remaining validator false positives identified by Example Mod Test Suite

## Summary

The Example Mod Validation Test Suite currently has 6 test failures in good files caused by underlying validator limitations. These are false positives — the validators flag valid CK3 constructs as errors/warnings.

**Current Status:** 44/50 tests passing (88% pass rate)

---

## Issues to Fix

### 1. Incomplete Trait Database (CK3800)

**File:** `events/good_traits.txt`
**Severity:** Easy fix

Traits `humble`, `depressed_1`, and `stressed_1` are flagged as unknown. Our trait database in `data/traits/` doesn't include all CK3 traits — these are valid traits that ship with the base game.

**Fix needed:** Audit `data/traits/*.yaml` against the complete CK3 trait list and add all missing entries. The `stressed_1` trait is a leveled health trait; `humble` is a personality trait that's already defined but may not be loading correctly.

---

### 2. User-Defined Scripted Effects/Triggers Not Recognized (CK3103, CK3101)

**File:** `common/scripted_effects/good_scripted_blocks.txt`
**Severity:** Medium (new feature)

Custom scripted effects like `grant_standard_reward_effect` and triggers like `is_eligible_hero_trigger` are flagged as unknown. The validator only knows about built-in effects/triggers from the data files — it doesn't track user-defined scripted blocks.

**Fix needed:** Implement a workspace-level index of scripted effects/triggers defined in `common/scripted_effects/` and `common/scripted_triggers/`, then check against this index before flagging CK3103/CK3101.

---

### 3. Variable Declaration Tracking Across Blocks (CK3701)

**File:** `events/good_scopes.txt`
**Severity:** Easy fix

Variable `already_fired` is used in a `NOT = { has_variable = ... }` guard in trigger, then set in immediate — a valid "fire once" pattern. The CK3553 check was fixed, but CK3701 ("variable used but never declared") still fires because the variable tracker doesn't recognize block-form `set_variable = { name = X }` as a declaration.

**Fix needed:** Update `extractVariableDefinitions()` in `variables.ts` to recognize the block form of `set_variable`.

---

### 4. EVENT-008 False Positive for On-Actions

**File:** `common/on_actions/good_on_actions.txt`
**Severity:** Easy fix

On-action files that contain event ID patterns (e.g., `on_actions_good.0001`) are incorrectly flagged with EVENT-008 ("Event definitions not in events/ directory"). On-actions reference events by ID, they don't define them.

**Fix needed:** Suppress EVENT-008 when the file is in `common/on_actions/` or when the pattern appears as a value rather than a block key.

---

### 5. ON_ACTION-001 Empty On-Action False Positive

**File:** `common/on_actions/good_on_actions.txt`
**Severity:** Easy fix

On-action `on_actions_good.0007` is flagged as having no effects or events, but it intentionally demonstrates a minimal/empty on-action pattern.

**Fix needed:** Review whether ON_ACTION-001 should be Information severity instead of Warning, or update the good file to include content.

---

### 6. Redundant has_trait Check Heuristic (CK3872)

**File:** `common/script_values/good_script_values.txt`
**Severity:** Medium (logic change)

The `has_trait` check inside a script value modifier is flagged as redundant. In script values, `has_trait` modifiers are a standard CK3 pattern for conditional value modification — they're not redundant.

**Fix needed:** Context-aware CK3872 check that understands script value modifier blocks differently from trigger blocks.

---

### 7. Localization Validator Coverage (LOC-001, LOC-004)

**File:** `localization/english/bad_syntax.yml`
**Severity:** Investigation needed

Two expected localization error codes (LOC-001, LOC-004) are not produced by the content-level validator. These may require file-level or cross-reference validation.

**Fix needed:** Verify which LOC codes are handled by the content validator vs the file-level validator, and ensure the test pipeline exercises both.

---

## Priority

Suggest tackling in this order:
1. **Trait database** (easiest — just data file updates)
2. **Variable declaration tracking** (localized fix in `variables.ts`)
3. **EVENT-008 suppression** (small change in `events.ts`)
4. **ON_ACTION-001 severity** (small change)
5. **Scripted effects/triggers indexing** (medium — new feature)
6. **CK3872 context awareness** (medium — logic change)
7. **LOC validator coverage** (investigation needed)

## Labels

`enhancement`, `validation`, `good first issue` (for items 1-4)
