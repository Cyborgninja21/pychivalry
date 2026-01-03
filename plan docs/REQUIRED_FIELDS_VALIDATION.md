# File Type Feature Matrix

Comprehensive mapping of PyChivalry features to CK3 file types and locations.

## Document Overview

This document tracks which LSP features work for which file types/locations. Use this as a reference for:
- Understanding current coverage
- Planning feature expansion
- Identifying gaps in validation

---

## 1. FULLY VALIDATED FILE TYPES

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Events | `events/` | ✅ `type`, `title`, `desc` | ✅ | ✅ | ✅ scripted, ⚠️ events | ✅ code lens | ✅ immediate, trigger_else | ✅ ai_chance | ✅ iterators |
| Letter Events | `events/` | ✅ `type`, `title`, `desc`, `sender` | ✅ | ✅ | ✅ scripted, ⚠️ events | ✅ code lens | ✅ | ✅ ai_chance | ✅ iterators |
| Event Options | `events/` | ✅ `name` | ✅ | ✅ | ✅ | ✅ | ✅ multiple names | ✅ | ✅ |
| Event triggered_desc | `events/` | ✅ `trigger`, `desc` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Event Portraits | `events/` | ✅ `character` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Story Cycles | `common/story_cycles/` | ✅ `effect_group` + timing | ✅ | ✅ | ✅ scripted | ❌ | ❌ | ✅ chance > 100 | ✅ short intervals |
| Story triggered_effect | `common/story_cycles/` | ✅ `trigger`, `effect` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mod Descriptor | `descriptor.mod` | ✅ `name` | N/A | N/A | N/A | N/A | ❌ | ❌ | N/A |

---

## 2. LSP FEATURES BY FILE TYPE

### Navigation & Editing Features Matrix

| File Type | Go-to-Def | Find Refs | Symbols | Highlight | Links | Completions | Hover | Sig Help | Inlay Hints | Code Lens | Format | Fold | Rename |
|-----------|-----------|-----------|---------|-----------|-------|-------------|-------|----------|-------------|-----------|--------|------|--------|
| **events/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/story_cycles/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **common/decisions/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **common/scripted_effects/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/scripted_triggers/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/on_actions/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **common/character_interactions/** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ⚠️ |
| **common/schemes/** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ⚠️ |
| **common/traits/** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ❌ | ✅ | ✅ | ⚠️ |
| **common/*/ (generic)** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ⚠️ |
| **history/** | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **localization/** | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ |
| **gui/** | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Legend:**
- ✅ Full support - file-type-aware implementation
- ⚠️ Partial support - generic implementation, not file-type-specific
- ❌ Not implemented

---

## 3. NOT YET VALIDATED FILE TYPES

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance | Priority |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|----------|
| Decisions | `common/decisions/` | ❌ `effect`, `ai_check_interval` | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | High |
| Character Interactions | `common/character_interactions/` | ❌ `category`, `on_accept` | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | High |
| Schemes | `common/schemes/` | ❌ `skill`, `on_ready` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | High |
| On Actions | `common/on_action/` | ❌ events or `effect` | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | Medium |
| Traits | `common/traits/` | ❌ `category` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Medium |
| Casus Belli | `common/casus_belli_types/` | ❌ `war_score` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Medium |
| Buildings | `common/buildings/` | ❌ `type`, `cost` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Medium |
| Laws | `common/laws/` | ❌ succession or effects | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Medium |
| Factions | `common/factions/` | ❌ `power_threshold` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Medium |
| Council Tasks | `common/council_tasks/` | ❌ `position`, `effect` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Council Positions | `common/council_positions/` | ❌ `skill` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Focuses | `common/focuses/` | ❌ `lifestyle` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Lifestyle Perks | `common/lifestyle_perks/` | ❌ `tree`, `position` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Cultures | `common/culture/cultures/` | ❌ `heritage`, `ethos` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Culture Traditions | `common/culture/traditions/` | ❌ `category` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Culture Pillars | `common/culture/pillars/` | ❌ `type` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Culture Eras | `common/culture/eras/` | ❌ `year` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Religions | `common/religion/religions/` | ❌ `family`, `doctrine` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Doctrines | `common/religion/doctrines/` | ❌ `group` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Holy Sites | `common/religion/holy_sites/` | ❌ `county` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Holdings | `common/holdings/` | ❌ `building_slot` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Landed Titles | `common/landed_titles/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Dynasties | `common/dynasties/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Bookmarks | `common/bookmarks/` | ❌ `date`, `characters` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Game Rules | `common/game_rules/` | ❌ `option` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Succession Election | `common/succession_election/` | ❌ `electors` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Vassal Stances | `common/vassal_stances/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Travel | `common/travel/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Legends | `common/legends/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Struggle | `common/struggle/` | ❌ `phases` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Scripted Effects | `common/scripted_effects/` | ❌ | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | Low |
| Scripted Triggers | `common/scripted_triggers/` | ❌ | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | Low |
| Scripted GUIs | `common/scripted_guis/` | ❌ `scope` | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | Low |
| Scripted Lists | `common/scripted_lists/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Scripted Modifiers | `common/scripted_modifiers/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Script Values | `common/script_values/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Modifiers | `common/modifiers/` | ❌ | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | Low |
| Opinion Modifiers | `common/opinion_modifiers/` | ❌ `opinion` | ⚠️ generic only | ✅ | ✅ indexed | ❌ | ❌ | ❌ | ❌ | Low |
| Activities | `common/activities/` | ❌ `phases` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Artifacts | `common/artifacts/` | ❌ `slot`, `type` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Governments | `common/governments/` | ❌ | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |
| Men at Arms | `common/men_at_arms_types/` | ❌ `damage`, `toughness` | ⚠️ generic only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Low |

---

## 4. HISTORY FILES

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Character History | `history/characters/` | ❌ `name`, `dynasty` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Province History | `history/provinces/` | ❌ `culture`, `religion` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Title History | `history/titles/` | ❌ date blocks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. OTHER FILES

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Localization | `localization/` | ❌ | N/A | N/A | ✅ indexed | N/A | ❌ | ❌ | N/A |
| GUI | `gui/` | ❌ | N/A | N/A | ❌ | ❌ | ❌ | ❌ | N/A |
| GFX | `gfx/` | ❌ | N/A | N/A | ❌ | ❌ | ❌ | ❌ | N/A |

---

## 6. FEATURE IMPLEMENTATION DETAILS

### 6.1 Features by Module

| Module | Features Provided | File Type Awareness |
|--------|-------------------|---------------------|
| `events.py` | Required fields for events, letter events, options, portraits | ✅ Events only |
| `story_cycles.py` | Required fields for story cycles, triggered effects | ✅ Story cycles only |
| `paradox_checks.py` | Effect/trigger context, iterators, opinion modifiers | ⚠️ Generic (all .txt) |
| `scopes.py` | Scope chain validation | ⚠️ Generic (all .txt) |
| `lists.py` | Iterator validation (any_, every_, random_) | ⚠️ Generic (all .txt) |
| `localization.py` | Localization key validation | ✅ Loc files + refs |
| `indexer.py` | Cross-file refs (events, effects, triggers) | ✅ Per symbol type |
| `navigation.py` | Go-to-definition, find references | ✅ Per symbol type |
| `completions.py` | Context-aware completions | ⚠️ Block context only |
| `hover.py` | Hover documentation | ⚠️ Effect/trigger only |
| `code_lens.py` | Reference counts, missing loc | ✅ Events, scripted |
| `inlay_hints.py` | Scope type annotations | ⚠️ Generic (all .txt) |
| `symbols.py` | Document outline | ⚠️ Generic (all .txt) |
| `formatting.py` | Auto-format | ⚠️ Generic (all .txt) |
| `folding.py` | Code folding | ⚠️ Generic (all .txt) |
| `rename.py` | Symbol rename | ✅ Per symbol type |
| `document_highlight.py` | Occurrence highlighting | ⚠️ Generic (all .txt) |
| `document_links.py` | Clickable paths/URLs | ⚠️ Generic (all .txt) |
| `signature_help.py` | Parameter hints | ⚠️ Effect/trigger only |
| `semantic_tokens.py` | Syntax highlighting | ⚠️ Generic (all .txt) |
| `code_actions.py` | Quick fixes | ⚠️ Limited per type |

### 6.2 What "File Type Aware" Means

**✅ File Type Aware:**
- Knows the expected structure of the file type
- Validates required fields specific to that type
- Provides type-specific completions/hints
- Example: Events have `type`, `title`, `desc`; story cycles have `effect_group`

**⚠️ Generic (Block Context):**
- Works for any .txt file
- Only understands trigger vs effect block context
- Doesn't know file-type-specific field requirements
- Example: Catches effects in trigger blocks everywhere

**❌ Not Implemented:**
- No validation for this file type
- May still benefit from generic features

---

## 7. INDEXED SYMBOL TYPES

The `indexer.py` tracks these symbols across the workspace:

| Symbol Type | Source Location | Used For |
|-------------|-----------------|----------|
| Events | `events/**/*.txt` | Go-to-def, find refs, validation |
| Scripted Effects | `common/scripted_effects/**/*.txt` | Go-to-def, validation, completion |
| Scripted Triggers | `common/scripted_triggers/**/*.txt` | Go-to-def, validation, completion |
| Scripted Lists | `common/scripted_lists/**/*.txt` | Validation |
| Script Values | `common/script_values/**/*.txt` | Go-to-def, validation |
| On-Actions | `common/on_actions/**/*.txt` | Reference tracking |
| Saved Scopes | Any file | Highlight, rename |
| Variables | Any file | Highlight, rename |
| Character Flags | Any file | Highlight, rename |
| Localization | `localization/**/*.yml` | Validation, go-to-def |
| Modifiers | `common/modifiers/**/*.txt` | Validation |
| Opinion Modifiers | `common/opinion_modifiers/**/*.txt` | Validation |

---

## 8. LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented with file-type-specific logic |
| ⚠️ | Partially implemented (generic checks only) |
| ❌ | Not implemented |
| N/A | Not applicable to this file type |

**"Generic checks"** (apply to all .txt files):
- Effect in trigger block detection
- Effect in any_ iterator warning
- Missing limit in random_ warning
- every_ without limit warning
- Unknown effect/trigger validation (if indexed)
- Scope chain validation (where context available)

---

## 9. PRIORITY RECOMMENDATIONS

### High Priority (Most Used)
1. **Decisions** - `common/decisions/` - High modder usage
2. **Character Interactions** - `common/character_interactions/` - Complex structure
3. **Schemes** - `common/schemes/` - Complex lifecycle

### Medium Priority (Common)
4. **On-Actions** - `common/on_actions/` - Event integration
5. **Traits** - `common/traits/` - Referenced everywhere
6. **Casus Belli** - `common/casus_belli_types/` - War system

### Lower Priority (Specialized)
7. Culture/Religion types - Less frequently modified
8. History files - Different validation needs
9. GUI files - Separate syntax entirely

---

## 10. LSP FEATURE INVENTORY

### Validation Features (Diagnostics)
| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Required Fields** | Validates mandatory fields per file type | `events.py`, `story_cycles.py` |
| **Effect/Trigger Context** | Prevents effects in trigger blocks | `paradox_checks.py` |
| **Scope Chain Validation** | Validates scope transitions | `scopes.py` |
| **Cross-File References** | Validates refs to effects/triggers/events | `indexer.py`, `diagnostics.py` |
| **Localization Keys** | Checks localization refs exist | `localization.py` |
| **Duplicate Detection** | Detects duplicate definitions | `paradox_checks.py` |
| **Value Range Checks** | Validates numeric ranges (chance, etc.) | `paradox_checks.py` |
| **Iterator Validation** | Validates any_/every_/random_ usage | `lists.py` |
| **Style Checks** | Whitespace, formatting validation | `style_checks.py` |

### Navigation Features
| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Go-to-Definition** | Jump to symbol definition | `navigation.py` |
| **Find References** | Find all uses of a symbol | `navigation.py` |
| **Document Symbols** | Outline/breadcrumb navigation | `symbols.py` |
| **Workspace Symbols** | Search symbols across workspace | `indexer.py` |
| **Document Highlight** | Highlight occurrences in file | `document_highlight.py` |
| **Document Links** | Clickable file paths/URLs | `document_links.py` |

### Editing Assistance
| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Completions** | Context-aware autocomplete | `completions.py` |
| **Hover** | Documentation on hover | `hover.py` |
| **Signature Help** | Parameter hints for effects | `signature_help.py` |
| **Inlay Hints** | Inline scope type annotations | `inlay_hints.py` |
| **Code Lens** | Inline reference counts | `code_lens.py` |
| **Formatting** | Auto-format to Paradox style | `formatting.py` |
| **Folding** | Collapsible code regions | `folding.py` |
| **Rename** | Workspace-wide symbol rename | `rename.py` |
| **Code Actions** | Quick fixes and refactoring | `code_actions.py` |
| **Semantic Tokens** | Context-aware syntax highlighting | `semantic_tokens.py` |
