# File Type Feature Matrix

Comprehensive mapping of PyChivalry features to CK3 file types and locations.

## Document Overview

This document tracks which LSP features work for which file types/locations. **Section 1 (Fully Validated File Types)** is organized by *file type*—it shows which CK3 content files (events, decisions, story cycles, etc.) have complete schema-driven validation and what validations apply to each. **Section 6.1 (Features by Module)** is organized by *implementation module*—it shows which Python modules provide which features and whether they are schema-driven. In short: Section 1 answers "what gets validated?" while Section 6.1 answers "how is validation implemented?"

Use this as a reference for:
- Understanding current coverage
- Planning feature expansion
- Identifying gaps in validation


### Related Documentation

- **[SCHEMA_AUTHORING_GUIDE.md](SCHEMA_AUTHORING_GUIDE.md)** - Complete guide for creating schemas
- **Schema Examples** - Every schema in `pychivalry/data/schemas/` includes usage examples




### Architecture Philosophy

**What's Declarative:**
1. Field requirements (required/optional per file type)
2. Validation rules (cross-field validations with conditions)
3. Generic rules (universal patterns like effect-in-trigger)
4. Completions (field completions with snippets)
5. Hover documentation (rich Markdown with examples)
6. Symbol definitions (document outline structure)
7. Code lenses (reference counts, warnings)
8. Diagnostic messages (error/warning templates)
9. Effect documentation (all 79 effects with examples)
10. Trigger documentation (all 80 triggers with examples)
11. Portrait animations (251 animations from `data/animations.yaml`)

**What Stays in Python:**
- Parser (AST construction)
- Scope chain validation (complex state tracking)
- Cross-file indexing (symbol resolution)
- Navigation features (go-to-def, find refs)
- LSP protocol implementation

---

## See Also: CK3 Content Types

For a comprehensive list of **all moddable content types** in CK3, see **[ck3_content_types.md](ck3_content_types.md)**.

---

## 1. FULLY VALIDATED FILE TYPES (Schema-Driven)

**All file types below use declarative YAML schemas** - validation, completions, hover, symbols, and code lens are now schema-driven!

### Table 1a: Structure & Context Validation

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs |
|-----------|----------|-----------------|----------------------|--------------|-----------------|
| Events | `events/` | ✅ `type`, `title`, `desc` | ✅ | ✅ | ✅ scripted, ⚠️ events |
| Letter Events | `events/` | ✅ `type`, `title`, `desc`, `sender` | ✅ | ✅ | ✅ scripted, ⚠️ events |
| Event Options | `events/` | ✅ `name` (conditional) | ✅ | ✅ | ✅ |
| Event triggered_desc | `events/` | ✅ `trigger`, `desc` | ✅ | ✅ | ✅ |
| Event Portraits | `events/` | ✅ `character` | ✅ | ✅ | ✅ |
| Story Cycles | `common/story_cycles/` | ✅ `effect_group` + timing | ✅ | ✅ | ✅ scripted |
| Story triggered_effect | `common/story_cycles/` | ✅ `trigger`, `effect` | ✅ | ✅ | ✅ |
| Decisions | `common/decisions/` | ✅ `ai_check_interval`, `effect` | ✅ | ✅ | ✅ indexed |
| Decision Group Types | `common/decision_group_types/` | ✅ `sort_order` | N/A | N/A | ✅ implicit loc |
| Character Interactions | `common/character_interactions/` | ✅ `category` | ✅ | ✅ | ✅ indexed |
| Schemes | `common/schemes/` | ✅ `skill` | ✅ | ✅ | ✅ indexed |
| On Actions | `common/on_actions/` | ✅ events or `effect` | ✅ | ✅ | ✅ indexed |
| Activity Types | `common/activities/activity_types/` | ✅ `is_shown` | ✅ | ✅ | ✅ indexed |
| Activity Phases | `common/activities/activity_types/` | ✅ `order` | ✅ | ✅ | ✅ |
| Activity Options | `common/activities/activity_types/` | ⚠️ | ✅ | ✅ | ✅ |
| Pulse Actions | `common/activities/pulse_actions/` | ✅ `is_valid`, `weight`, `effect` | ✅ | ✅ | ✅ indexed |
| Intents | `common/activities/intents/` | ✅ `scripted_animation` | ✅ | ✅ | ✅ indexed |
| Activity Locales | `common/activities/activity_locales/` | ✅ `on_enter_locale`, `visuals` | ✅ | ✅ | ✅ indexed |
| Activity Group Types | `common/activities/activity_group_types/` | ⚠️ `sort_order` | N/A | N/A | ✅ implicit loc |
| Guest Invite Rules | `common/activities/guest_invite_rules/` | ✅ `effect` | ✅ | ✅ | ✅ indexed |
| Mod Descriptor | `descriptor.mod` | ✅ `name` | N/A | N/A | N/A |

> **Table 1a** shows the structural validation capabilities for each file type. This includes whether required fields are enforced (like `type` and `title` for events), whether effects are correctly placed in effect blocks and triggers in trigger blocks, whether scope chain transitions are validated (e.g., `liege.primary_title`), and whether cross-file references to scripted effects/triggers are resolved.

### Table 1b: Value & Pattern Validation

| File Type | Loc Keys | Duplicates | Value Checks | Performance | Field Order | Pattern Validation | Type Resolution | Schema |
|-----------|----------|------------|--------------|-------------|-------------|-------------------|-----------------|--------|
| Events | ✅ code lens | ✅ immediate, trigger_else | ✅ ai_chance | ✅ iterators | ❌ | ❌ | ❌ | ✅ `events.yaml` |
| Letter Events | ✅ code lens | ✅ | ✅ ai_chance | ✅ iterators | ❌ | ❌ | ❌ | ✅ `events.yaml` |
| Event Options | ✅ | ✅ multiple names | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `events.yaml` |
| Event triggered_desc | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `events.yaml` |
| Event Portraits | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `events.yaml` |
| Story Cycles | ✅ code lens | ✅ | ✅ chance > 100 | ✅ short intervals | ❌ | ❌ | ❌ | ✅ `story_cycles.yaml` |
| Story triggered_effect | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `story_cycles.yaml` |
| Decisions | ✅ code lens | ✅ | ✅ cost, cooldown | ✅ | ❌ | ❌ | ❌ | ✅ `decisions.yaml` |
| Decision Group Types | ✅ implicit key | ✅ | ❌ | N/A | ❌ | ❌ | ❌ | ✅ `decision_group_types.yaml` |
| Character Interactions | ✅ code lens | ✅ | ✅ cooldown | ✅ | ❌ | ❌ | ❌ | ✅ `character_interactions.yaml` |
| Schemes | ✅ code lens | ✅ | ✅ power, cooldown | ✅ | ❌ | ❌ | ❌ | ✅ `schemes.yaml` |
| On Actions | ✅ code lens | ✅ | ✅ event weights | ✅ | ❌ | ❌ | ❌ | ✅ `on_actions.yaml` |
| Activity Types | ✅ code lens | ✅ | ✅ cost, cooldown | ✅ | ❌ | ❌ | ❌ | ✅ `activity_types.yaml` |
| Activity Phases | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `activity_types.yaml` |
| Activity Options | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `activity_types.yaml` |
| Pulse Actions | ✅ code lens | ✅ | ✅ weight | ✅ | ❌ | ❌ | ❌ | ✅ `pulse_actions.yaml` |
| Intents | ✅ code lens | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `intents.yaml` |
| Activity Locales | ✅ code lens | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `activity_locales.yaml` |
| Activity Group Types | ✅ implicit key | ✅ | ❌ | N/A | ❌ | ❌ | ❌ | ✅ `activity_group_types.yaml` |
| Guest Invite Rules | ✅ code lens | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ `guest_invite_rules.yaml` |
| Mod Descriptor | N/A | ❌ | ❌ | N/A | N/A | N/A | N/A | ❌ |

> **Table 1b** covers value-level validation and the schema file that drives each file type. This includes localization key tracking (with code lens for missing keys), duplicate block detection, numeric value range checks (like `ai_chance` values), and performance warnings for expensive operations. The Schema column indicates which YAML schema file defines the validation rules.

---

## 2. LSP FEATURES BY FILE TYPE

### Table 2a: Navigation Features

| File Type | Go-to-Def | Find Refs | Symbols | Highlight | Links | Rename |
|-----------|-----------|-----------|---------|-----------|-------|--------|
| **events/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/story_cycles/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/decisions/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/decision_group_types/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/character_interactions/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/schemes/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/on_actions/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/activities/** | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/scripted_effects/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/scripted_triggers/** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **common/traits/** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| **common/*/ (generic)** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| **history/** | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ❌ |
| **localization/** | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| **gui/** | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ❌ |

> **Table 2a** tracks code navigation features by file location. Go-to-Definition and Find References let you jump to and discover usages of scripted effects, triggers, events, and localization keys. Symbols provides the document outline for breadcrumb navigation. Highlight shows all occurrences of a symbol in the current file, Links makes file paths clickable, and Rename enables workspace-wide symbol renaming.

### Table 2b: Editing & Assistance Features

| File Type | Completions | Hover | Sig Help | Inlay Hints | Code Lens | Format | Fold | Schema |
|-----------|-------------|-------|----------|-------------|-----------|--------|------|--------|
| **events/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/story_cycles/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/decisions/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/decision_group_types/** | ✅ Schema | ✅ Schema | N/A | N/A | ✅ Schema | ✅ | ✅ | ✅ |
| **common/character_interactions/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/schemes/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/on_actions/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/activities/** | ✅ Schema | ✅ Schema | ✅ | ✅ | ✅ Schema | ✅ | ✅ | ✅ |
| **common/scripted_effects/** | ✅ YAML | ✅ YAML | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| **common/scripted_triggers/** | ✅ YAML | ✅ YAML | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| **common/traits/** | ✅ | ✅ | ❌ | ⚠️ | ❌ | ✅ | ✅ | ❌ |
| **common/*/ (generic)** | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ❌ |
| **history/** | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **localization/** | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| **gui/** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

> **Table 2b** covers features that assist with writing code. Completions provides context-aware autocomplete for effects, triggers, and fields. Hover shows documentation when you mouse over keywords. Signature Help displays parameter hints. Inlay Hints shows inline scope type annotations. Code Lens displays reference counts and warnings above definitions. Format and Fold provide code formatting and collapsible regions.

**Legend:**
- ✅ Full support - file-type-aware implementation
- ✅ Schema - Schema-driven implementation (YAML-based, declarative)
- ✅ YAML - Uses YAML documentation files (effects.yaml/triggers.yaml)
- ⚠️ Partial support - generic implementation, not file-type-specific
- ❌ Not implemented

**Schema-Driven Features:**
- **Symbols**: Document outline extracted from schema definitions
- **Completions**: Field completions with snippets from schema `field_docs`
- **Hover**: Rich documentation generated from schema `field_docs`
- **Code Lens**: Reference counts and warnings configured in schema
- **Validation**: All validation rules defined declaratively in YAML

---

## 2.5. KNOWN VALIDATION GAPS

> ⚠️ **Important:** The following validation types are NOT yet implemented. These represent common error patterns that are only caught at runtime.

### Missing Graphics File Validation (GFX Paths)

**Status:** ❌ Not Implemented | **Priority:** Medium | **Issue:** Planned

PyChivalry does NOT validate that referenced graphics files exist. Missing `.dds` files cause pink/black checkerboard patterns in-game but generate no editor warnings.

| Pattern | Example | File Types Affected |
|---------|---------|---------------------|
| `texture = "..."` | `texture = "gfx/interface/icons/icon.dds"` | Events, Activities, GUI |
| `reference = "..."` | `reference = "gfx/interface/illustrations/scene.dds"` | Activity backgrounds |
| `icon = "..."` | `icon = "gfx/interface/icons/decision.dds"` | Decisions, Interactions |
| `background = "..."` | `background = "gfx/interface/backgrounds/bg.dds"` | Events, Activities |

**Current Behavior:**
- `document_links.py` makes GFX paths clickable with "File not found" tooltip
- No diagnostic/error is generated

**Proposed Diagnostic:** `GFX001` - Missing graphics file reference

**Real-World Impact:** Activity `rq_grand_debauch` showed checkerboard because `activity_window_background` referenced non-existent placeholder files. Only discovered at runtime.

---

## 3. NOT YET VALIDATED FILE TYPES

**Note:** The schema-driven architecture makes it easy to add support for new file types. Creating a new schema file takes ~2 hours instead of days of Python coding.

### Table 3a: Structure & Context

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs |
|-----------|----------|-----------------|----------------------|--------------|-----------------|
| Traits | `common/traits/` | ❌ `category` | ⚠️ generic only | ✅ | ❌ |
| Casus Belli | `common/casus_belli_types/` | ❌ `war_score` | ⚠️ generic only | ✅ | ❌ |
| Buildings | `common/buildings/` | ❌ `type`, `cost` | ⚠️ generic only | ✅ | ❌ |
| Laws | `common/laws/` | ❌ succession or effects | ⚠️ generic only | ✅ | ❌ |
| Factions | `common/factions/` | ❌ `power_threshold` | ⚠️ generic only | ✅ | ❌ |
| Council Tasks | `common/council_tasks/` | ❌ `position`, `effect` | ⚠️ generic only | ✅ | ❌ |
| Council Positions | `common/council_positions/` | ❌ `skill` | ⚠️ generic only | ✅ | ❌ |
| Focuses | `common/focuses/` | ❌ `lifestyle` | ⚠️ generic only | ✅ | ❌ |
| Lifestyle Perks | `common/lifestyle_perks/` | ❌ `tree`, `position` | ⚠️ generic only | ✅ | ❌ |
| Cultures | `common/culture/cultures/` | ❌ `heritage`, `ethos` | ⚠️ generic only | ✅ | ❌ |
| Culture Traditions | `common/culture/traditions/` | ❌ `category` | ⚠️ generic only | ✅ | ❌ |
| Culture Pillars | `common/culture/pillars/` | ❌ `type` | ⚠️ generic only | ✅ | ❌ |
| Culture Eras | `common/culture/eras/` | ❌ `year` | ⚠️ generic only | ✅ | ❌ |
| Religions | `common/religion/religions/` | ❌ `family`, `doctrine` | ⚠️ generic only | ✅ | ❌ |
| Doctrines | `common/religion/doctrines/` | ❌ `group` | ⚠️ generic only | ✅ | ❌ |
| Holy Sites | `common/religion/holy_sites/` | ❌ `county` | ⚠️ generic only | ✅ | ❌ |
| Holdings | `common/holdings/` | ❌ `building_slot` | ⚠️ generic only | ✅ | ❌ |
| Landed Titles | `common/landed_titles/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Dynasties | `common/dynasties/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Bookmarks | `common/bookmarks/` | ❌ `date`, `characters` | ⚠️ generic only | ✅ | ❌ |
| Game Rules | `common/game_rules/` | ❌ `option` | ⚠️ generic only | ✅ | ❌ |
| Succession Election | `common/succession_election/` | ❌ `electors` | ⚠️ generic only | ✅ | ❌ |
| Vassal Stances | `common/vassal_stances/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Travel | `common/travel/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Legends | `common/legends/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Struggle | `common/struggle/` | ❌ `phases` | ⚠️ generic only | ✅ | ❌ |
| Scripted Effects | `common/scripted_effects/` | N/A | ✅ generic rules | ✅ | ✅ indexed |
| Scripted Triggers | `common/scripted_triggers/` | N/A | ✅ generic rules | ✅ | ✅ indexed |
| Scripted GUIs | `common/scripted_guis/` | ❌ `scope` | ⚠️ generic only | ✅ | ✅ indexed |
| Scripted Lists | `common/scripted_lists/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Scripted Modifiers | `common/scripted_modifiers/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Script Values | `common/script_values/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Modifiers | `common/modifiers/` | ❌ | ⚠️ generic only | ✅ | ✅ indexed |
| Opinion Modifiers | `common/opinion_modifiers/` | ❌ `opinion` | ✅ generic rules | ✅ | ✅ indexed |
| Artifacts | `common/artifacts/` | ❌ `slot`, `type` | ⚠️ generic only | ✅ | ❌ |
| Governments | `common/governments/` | ❌ | ⚠️ generic only | ✅ | ❌ |
| Men at Arms | `common/men_at_arms_types/` | ❌ `damage`, `toughness` | ⚠️ generic only | ✅ | ❌ |

> **Table 3a** lists file types that don't yet have dedicated schema validation. These files still benefit from generic checks (effect/trigger context validation, scope chains), but lack file-type-specific required field validation. The Required Fields column shows what fields *should* be validated when a schema is created.

### Table 3b: Value Validation & Status

| File Type | Loc Keys | Duplicates | Value Checks | Performance | Priority | Schema Status |
|-----------|----------|------------|--------------|-------------|----------|---------------|
| Traits | ❌ | ❌ | ❌ | ❌ | Medium | 🔄 Planned |
| Casus Belli | ❌ | ❌ | ❌ | ❌ | Medium | 🔄 Planned |
| Buildings | ❌ | ❌ | ❌ | ❌ | Medium | 🔄 Planned |
| Laws | ❌ | ❌ | ❌ | ❌ | Medium | 🔄 Planned |
| Factions | ❌ | ❌ | ❌ | ❌ | Medium | 🔄 Planned |
| Council Tasks | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Council Positions | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Focuses | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Lifestyle Perks | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Cultures | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Culture Traditions | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Culture Pillars | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Culture Eras | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Religions | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Doctrines | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Holy Sites | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Holdings | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Landed Titles | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Dynasties | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Bookmarks | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Game Rules | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Succession Election | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Vassal Stances | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Travel | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Legends | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Struggle | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Scripted Effects | ✅ | ✅ | ✅ | ✅ | Low | ⚠️ Effects YAML |
| Scripted Triggers | ✅ | ✅ | ✅ | ✅ | Low | ⚠️ Triggers YAML |
| Scripted GUIs | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Scripted Lists | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Scripted Modifiers | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Script Values | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Modifiers | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Opinion Modifiers | ❌ | ❌ | ✅ inline values | ✅ | Low | ⚠️ Generic rules |
| Artifacts | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Governments | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |
| Men at Arms | ❌ | ❌ | ❌ | ❌ | Low | 🔄 Planned |

> **Table 3b** shows the current validation status and implementation priority for unvalidated file types. Most are marked 🔄 Planned, meaning a schema could be created. Scripted Effects/Triggers already have partial support via the effects.yaml/triggers.yaml documentation files. The Priority column indicates which file types would benefit most from dedicated schema support.

---

## 4. HISTORY FILES

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Character History | `history/characters/` | ❌ `name`, `dynasty` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Province History | `history/provinces/` | ❌ `culture`, `religion` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Title History | `history/titles/` | ❌ date blocks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Section 4** covers history files that define the starting state of the game world. These files use a different structure than common/ files (date-based blocks rather than effect/trigger blocks) and currently have no dedicated validation. Future support could validate date formats, cross-references to characters/titles, and required fields like dynasty assignments.

---

## 5. OTHER FILES

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Localization | `localization/` | ❌ | N/A | N/A | ✅ indexed | N/A | ❌ | ❌ | N/A |
| GUI | `gui/` | ❌ | N/A | N/A | ❌ | ❌ | ❌ | ❌ | N/A |
| GFX | `gfx/` | ❌ | N/A | N/A | ❌ | ❌ | ❌ | ❌ | N/A |

> **Section 5** covers non-script files that support the mod. Localization files (`.yml`) are indexed so that localization key references in script files can be validated and navigated. GUI and GFX files use completely different syntax and are not validated, though file path links in scripts pointing to these locations are still clickable.

---
## 6. FEATURE IMPLEMENTATION DETAILS

> **Section 6** is organized by *Python module*—it answers "what does each source file do?" Each row in the table below represents a `.py` file in the codebase, showing what features that module provides, whether it has file-type-specific logic, and whether it uses the schema-driven architecture. This is a **developer-focused** view useful for understanding the codebase structure and finding where specific functionality is implemented.

### 6.1 Features by Module (Updated for Schema-Driven Architecture)

**Total modules: 44** (excluding `__pycache__` and `data/` subdirectory)

#### Schema Core Infrastructure

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 1 | `schema_loader.py` | Schema infrastructure: loads YAML schemas, resolves `$extends` inheritance and `$variable` references, caches schemas, matches files via `path_patterns` glob | ✅ Specific (path pattern matching) | ✅ Core |
| 2 | `schema_validator.py` | Generic validation engine: required fields, conditional requirements, type checking, enum values, pattern validation, nested schemas, field order, cross-field conditions | ✅ Via schema patterns | ✅ Core |
| 3 | `schema_completions.py` | Schema-based completions: generates CompletionItems from `field_docs`, snippets, enum values, nested schema completions | ✅ Via schema patterns | ✅ Core |
| 4 | `schema_hover.py` | Schema-based hover: generates Markdown from `field_docs`, descriptions, valid enums, example snippets | ✅ Via schema patterns | ✅ Core |
| 5 | `schema_symbols.py` | Schema-driven outline: extracts DocumentSymbols using schema `symbols` configuration (primary/children rules) | ✅ Via schema patterns | ✅ Core |
| 6 | `generic_rules_validator.py` | Declarative rule validation: effect/trigger context, iterator patterns, redundant checks, common gotchas from YAML rules | ⚠️ Generic (all .txt) | ✅ Core (loads `generic_rules.yaml`) |

#### Data Loading & Documentation

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 7 | `effect_trigger_docs.py` | YAML documentation loader: loads effects/triggers from `data/effects/` and `data/triggers/`, cached lookups | ❌ N/A (data loader) | ✅ Via YAML docs |
| 8 | `ck3_language.py` | CK3 language definitions: 50+ keywords, 500+ effects, 400+ triggers, 20+ scopes, event types, operators, field docs | ❌ N/A (static data) | ❌ (hardcoded dicts) |
| 9 | `traits.py` | Trait data: 297 CK3 traits with properties (skills, opinions, costs, flags), typo suggestions, filtering | ❌ N/A (data module) | ✅ Via YAML (`traits.yaml`) |
| 10 | `scopes.py` | Scope system: loads scope definitions from YAML, scope links/lists/triggers/effects per type, chain validation | ❌ N/A (context-based) | ✅ Via YAML (`data/scopes/`) |
| 11 | `lists.py` | List iterator definitions: any_/every_/random_/ordered_ prefixes, parameter validation, resulting scope types | ❌ N/A (utility module) | ❌ (hardcoded configs) |
| 11b | `data/animations.yaml` | Portrait animation definitions: 251 valid CK3 animations organized by category (emotion, combat, ceremony, etc.) | ❌ N/A (data file) | ✅ Core data |

#### File-Type-Specific Validation

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 12 | `events.py` | Event validation: 6 event types, 30+ themes, portrait positions, 251 animations (YAML-loaded), dynamic descriptions, EVENT-001–006 | ✅ Events only | ✅ Animations via YAML |
| 13 | `story_cycles.py` | Story cycle validation: timing, lifecycle hooks, effect_group, triggered_effect, STORY-001–045 diagnostics | ✅ Story cycles only | ❌ (hardcoded structure) |
| 14 | `localization.py` | Localization validation: fuzzy matching, character functions, formatting codes, icons, CK3600–CK3604 diagnostics | ✅ .yml loc files + refs | ❌ (hardcoded patterns) |
| 15 | `scripted_blocks.py` | Scripted triggers/effects: parameter extraction ($PARAM$), validation, inline refs, scope requirements | ✅ scripted_effects/triggers | ❌ (hardcoded patterns) |
| 16 | `script_values.py` | Script value parsing: fixed/range/formula values, operations (add/multiply/min/max), conditional formulas | ❌ N/A (syntax-based) | ❌ (hardcoded operations) |
| 17 | `variables.py` | Variable system: var:/local_var:/global_var: validation, set_variable/change_variable params | ⚠️ Generic (all .txt) | ❌ (hardcoded patterns) |
| 18 | `scope_timing.py` | "Golden Rule" validation: trigger/desc vs immediate timing, CK3550–CK3555 diagnostics | ⚠️ Generic (event patterns) | ❌ (hardcoded analysis) |
| 19 | `paradox_checks.py` | Best practices: context violations, iterator misuse, event structure, trigger extensions, AI chance | ⚠️ Generic (all .txt) | ✅ Via generic_rules |
| 20 | `style_checks.py` | Code style: indentation, brace matching, whitespace, operator spacing, line length, nesting depth | ⚠️ Generic (all .txt) | ❌ (regex-based rules) |

#### LSP Feature Providers

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 21 | `completions.py` | Context-aware completions: trigger vs effect filtering, scope links, saved scopes, traits, snippets | ⚠️ Generic (AST context) | ✅ Via YAML docs |
| 22 | `hover.py` | Rich hover: effects, triggers, scopes, events, saved scopes, flags, modifiers, traits, loc keys | ⚠️ Generic (symbol-based) | ✅ Via YAML docs |
| 23 | `diagnostics.py` | Validation orchestrator: syntax, semantics (CK3101–3103), scopes (CK3201–3203), traits (CK3451), schema | ⚠️ Generic (all .txt) | ✅ Core (loads schemas) |
| 24 | `navigation.py` | Go-to-definition, find references: events, scripted effects/triggers, saved scopes, script values | ⚠️ Generic (symbol-based) | ❌ (indexer lookups) |
| 25 | `symbols.py` | Document outline: hierarchical symbols (events→triggers→options), workspace search | ⚠️ Generic (schema fallback) | ✅ Via schema when available |
| 26 | `code_lens.py` | Inline annotations: reference counts, missing loc warnings, namespace counts, usage counts | ✅ Events, scripted blocks | ✅ Via schema `code_lens` |
| 27 | `code_actions.py` | Quick fixes: "Did you mean?" suggestions, namespace insertion, scope fixes; refactorings: extract effect/trigger | ⚠️ Generic (all .txt) | ❌ (uses ck3_language) |
| 28 | `signature_help.py` | Parameter hints: ~25 complex effects (add_opinion, trigger_event, set_variable), active param detection | ⚠️ Generic (all .txt) | ❌ (hardcoded SIGNATURES) |
| 29 | `inlay_hints.py` | Inline annotations: scope types for scope:, chains, list iterators | ⚠️ Generic (all .txt) | ❌ (hardcoded mappings) |
| 30 | `semantic_tokens.py` | Syntax highlighting: 14 token types, 6 modifiers, delta-encoded, list iterator detection | ⚠️ Generic (all .txt) | ❌ (hardcoded patterns) |
| 31 | `folding.py` | Code folding: brace-based, comment blocks, `# region`/`# endregion` markers, AST-based | ⚠️ Generic (all .txt) | ❌ |
| 32 | `formatting.py` | Document formatting: indentation, brace placement, spacing, blank lines, Paradox conventions | ⚠️ Generic (all .txt) | ❌ (hardcoded rules) |
| 33 | `rename.py` | Symbol rename: events, saved scopes, scripted effects/triggers, variables, flags across workspace | ✅ Per symbol type | ❌ (regex patterns) |
| 34 | `document_highlight.py` | Occurrence highlighting: scopes, events, variables, flags, effects/triggers, traits, loc keys | ⚠️ Generic (pattern matching) | ❌ |
| 35 | `document_links.py` | Clickable links: file paths (common/, events/, gfx/), URLs, event refs in comments, GFX paths | ✅ CK3 path prefixes | ❌ |

#### Workspace & Cross-File

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 36 | `indexer.py` | Workspace indexing: events, scripted effects/triggers, modifiers, interactions, on_actions, loc keys, scopes, flags | ✅ Per folder type | ❌ (regex + folder conventions) |
| 37 | `workspace.py` | Cross-file validation: mod descriptor parsing (*.mod), undefined effect/trigger detection, event chains, loc coverage | ✅ .mod + cross-file | ❌ (regex parsing) |

#### Game Log Integration

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 38 | `log_watcher.py` | Real-time log monitoring: watchdog-based, incremental reads, platform-specific paths, pause/resume | ❌ N/A (external logs) | ❌ |
| 39 | `log_analyzer.py` | Log pattern analysis: regex-based error matching, file/line extraction, fix suggestions, categories | ❌ N/A (game logs) | ❌ (regex patterns) |
| 40 | `log_diagnostics.py` | Log→LSP bridge: converts log results to diagnostics, path resolution, lifecycle management | ❌ N/A (bridge module) | ❌ |

#### Core Infrastructure

| # | Module | Features Provided | File Type Awareness | Schema-Driven |
|---|--------|-------------------|---------------------|---------------|
| 41 | `parser.py` | Lexical/AST parsing: tokenization, block/assignment/list parsing, `get_node_at_position`, memory-optimized | ❌ N/A (core parser) | ❌ (infrastructure) |
| 42 | `server.py` | LSP orchestrator: 33+ LSP features, document sync, diagnostics publishing, workspace scanning, async debouncing, thread pool | ⚠️ Generic (all files) | ❌ (routes to modules) |
| 43 | `utils.py` | Shared utilities: URI↔path conversion (Windows/Unix), position-in-range checking | ❌ N/A (utilities) | ❌ |
| 44 | `__init__.py` | Package metadata: version (`1.1.0`), docstrings, file support declarations | ❌ N/A (package init) | ❌ |

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

### New Validation Feature Columns

| Column | Description | Example |
|--------|-------------|---------|
| **Field Order** | Validates fields appear in conventional order (style) | `type` before `title` before `desc` in events |
| **Pattern Validation** | Validates field values match expected patterns | Loc keys match `^[a-z][a-z0-9_.]*$`, numbers are numeric |
| **Type Resolution** | Resolves `type: localization_key` from `_types.yaml` and enforces its pattern | `type: scope_reference` → enforces scope pattern |

**Implementation Priority:**
- **Pattern Validation + Type Resolution** (recommended): Catches real bugs (invalid loc keys, bad scope refs)
- **Field Order**: Style preference only (CK3 is order-insensitive)

---




## 9. LSP FEATURE INVENTORY

> **Section 9** is organized by *LSP feature category*—it answers "what capabilities does this language server have?" Features are grouped into Validation (diagnostics), Navigation, and Editing Assistance, which are standard LSP capability categories. Each row describes a user-facing feature and notes which module implements it. This is a **user/capability-focused** view useful for understanding what the extension can do.

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
