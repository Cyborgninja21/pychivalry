# Required Fields Validation Status

Based on file types present in `example mod/`.

## Validated File Types

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

## Not Yet Validated File Types

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

## History Files

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Character History | `history/characters/` | ❌ `name`, `dynasty` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Province History | `history/provinces/` | ❌ `culture`, `religion` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Title History | `history/titles/` | ❌ date blocks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Other Files

| File Type | Location | Required Fields | Effect/Trigger Context | Scope Chains | Cross-File Refs | Loc Keys | Duplicates | Value Checks | Performance |
|-----------|----------|-----------------|----------------------|--------------|-----------------|----------|------------|--------------|-------------|
| Localization | `localization/` | ❌ | N/A | N/A | ✅ indexed | N/A | ❌ | ❌ | N/A |
| GUI | `gui/` | ❌ | N/A | N/A | ❌ | ❌ | ❌ | ❌ | N/A |
| GFX | `gfx/` | ❌ | N/A | N/A | ❌ | ❌ | ❌ | ❌ | N/A |

## Legend

- ✅ = Fully implemented
- ⚠️ = Partially implemented (generic checks only)
- ❌ = Not implemented
- N/A = Not applicable to this file type

**Generic checks** (apply to all .txt files): effect in trigger block, effect in any_ iterator, missing limit in random_, every_ without limit, unknown effect/trigger
