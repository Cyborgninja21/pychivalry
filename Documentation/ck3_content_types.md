# CK3 Moddable Content Types

**Master reference of all moddable content in Crusader Kings III.**

Use this as a checklist for PyChivalry feature coverage. For detailed validation status per file type, see [feature_matrix.md](feature_matrix.md).

---

## Status Legend

| Symbol | Status | Meaning |
|--------|--------|---------|
| ✅ | **Complete** | Full schema-driven validation with completions, hover, code lens |
| ⚠️ | **Indexed** | Cross-file references work (go-to-def, find refs), no dedicated schema |
| 🔄 | **Planned** | Generic effect/trigger validation only, schema planned |
| ❌ | **N/A** | Different syntax or asset files, not applicable |

---

## Content Types by Category

| Category | Content Type | Location | Description | Status | Functionality |
|----------|--------------|----------|-------------|--------|---------------|
| **Gameplay Logic** | Events | `events/` | Story beats, popups, choices | ✅ Complete | Required fields, effect/trigger context, completions, hover docs, code lens |
| | Decisions | `common/decisions/` | Player-triggered actions | ✅ Complete | Required fields, AI validation, cost checks, cooldown warnings |
| | Character Interactions | `common/character_interactions/` | Right-click menu actions | ✅ Complete | Category validation, target scope checks, AI behavior validation |
| | Interaction Categories | `common/character_interaction_categories/` | Right-click menu groups | 🔄 Planned | Generic validation only |
| | Schemes | `common/schemes/` | Murder, seduce, etc. | ✅ Complete | Skill requirements, power balance checks, agent validation |
| | On Actions | `common/on_action/` | Game event hooks | ✅ Complete | Event list validation, weight checks, effect blocks |
| | Story Cycles | `common/story_cycles/` | Multi-event narratives | ✅ Complete | Timing validation, effect_group checks, lifecycle hooks |
| | Activities | `common/activities/` | Feasts, hunts, tours | 🔄 Planned | Generic effect/trigger validation only |
| | Casus Belli | `common/casus_belli_types/` | War justifications | 🔄 Planned | Generic effect/trigger validation only |
| | Casus Belli Groups | `common/casus_belli_groups/` | CB categories | 🔄 Planned | Generic validation only |
| | Factions | `common/factions/` | Independence, claimant | 🔄 Planned | Generic effect/trigger validation only |
| | Game Rules | `common/game_rules/` | Difficulty settings | 🔄 Planned | Generic effect/trigger validation only |
| | Important Actions | `common/important_actions/` | Alert system triggers | 🔄 Planned | Generic effect/trigger validation only |
| | Situations | `common/situation/` | Dynamic event chains | 🔄 Planned | Generic effect/trigger validation only |
| | Decision Groups | `common/decision_group_types/` | Decision menu categories | 🔄 Planned | Generic validation only |
| | Suggestions | `common/suggestions/` | Player advice system | 🔄 Planned | Generic validation only |
| **Scripting** | Scripted Effects | `common/scripted_effects/` | Reusable effect blocks | ⚠️ Indexed | Go-to-def, find refs, parameter hints, usage tracking |
| | Scripted Triggers | `common/scripted_triggers/` | Reusable conditions | ⚠️ Indexed | Go-to-def, find refs, parameter hints, usage tracking |
| | Script Values | `common/script_values/` | Dynamic calculations | ⚠️ Indexed | Go-to-def, find refs, formula validation |
| | Scripted Lists | `common/scripted_lists/` | Character/title filters | 🔄 Planned | Generic validation only |
| | Scripted GUIs | `common/scripted_guis/` | Custom UI interactions | 🔄 Planned | Generic validation only |
| | Scripted Modifiers | `common/scripted_modifiers/` | Conditional modifiers | 🔄 Planned | Generic validation only |
| | Scripted Rules | `common/scripted_rules/` | Game behavior overrides | 🔄 Planned | Generic validation only |
| | Scripted Costs | `common/scripted_costs/` | Reusable cost definitions | 🔄 Planned | Generic validation only |
| | Scripted Relations | `common/scripted_relations/` | Custom relationships | 🔄 Planned | Generic validation only |
| | Scripted Character Templates | `common/scripted_character_templates/` | Character generation | 🔄 Planned | Generic validation only |
| | Modifiers | `common/modifiers/` | Static stat changes | ⚠️ Indexed | Reference resolution, usage tracking |
| | Opinion Modifiers | `common/opinion_modifiers/` | Relationship modifiers | ⚠️ Indexed | Reference resolution, value validation |
| | Defines | `common/defines/` | Game constants | 🔄 Planned | Generic validation only |
| | Effect Localization | `common/effect_localization/` | Custom effect text | 🔄 Planned | Generic validation only |
| | Trigger Localization | `common/trigger_localization/` | Custom trigger text | 🔄 Planned | Generic validation only |
| | Named Colors | `common/named_colors/` | Color definitions | 🔄 Planned | Generic validation only |
| **Characters** | Traits | `common/traits/` | Brave, craven, etc. | 🔄 Planned | Trait name completions, typo detection |
| | Lifestyles | `common/lifestyles/` | Lifestyle definitions | 🔄 Planned | Generic validation only |
| | Lifestyle Perks | `common/lifestyle_perks/` | Perk tree unlocks | 🔄 Planned | Generic validation only |
| | Focuses | `common/focuses/` | Lifestyle choices | 🔄 Planned | Generic validation only |
| | Character Backgrounds | `common/character_backgrounds/` | Starting backgrounds | 🔄 Planned | Generic validation only |
| | Character Memory Types | `common/character_memory_types/` | Event memories | 🔄 Planned | Generic validation only |
| | Nicknames | `common/nicknames/` | the Great, the Wise | 🔄 Planned | Generic validation only |
| | Council Positions | `common/council_positions/` | Chancellor, steward | 🔄 Planned | Generic validation only |
| | Council Tasks | `common/council_tasks/` | Fabricate claim, etc. | 🔄 Planned | Generic validation only |
| | Secret Types | `common/secret_types/` | Murders, affairs | 🔄 Planned | Generic validation only |
| | Hook Types | `common/hook_types/` | Blackmail leverage | 🔄 Planned | Generic validation only |
| | Death Reasons | `common/deathreasons/` | Death cause definitions | 🔄 Planned | Generic validation only |
| | Pool Character Selectors | `common/pool_character_selectors/` | Character pool rules | 🔄 Planned | Generic validation only |
| **Dynasties & Houses** | Dynasties | `common/dynasties/` | Dynasty definitions | 🔄 Planned | Generic validation only |
| | Dynasty Houses | `common/dynasty_houses/` | Cadet branches | 🔄 Planned | Generic validation only |
| | Dynasty Legacies | `common/dynasty_legacies/` | Legacy trees | 🔄 Planned | Generic validation only |
| | Dynasty Perks | `common/dynasty_perks/` | Individual perks | 🔄 Planned | Generic validation only |
| | House Unities | `common/house_unities/` | House unity levels | 🔄 Planned | Generic validation only |
| | House Aspirations | `common/house_aspirations/` | House goals | 🔄 Planned | Generic validation only |
| | House Mottos | `common/dynasty_house_mottos/` | House motto definitions | 🔄 Planned | Generic validation only |
| | House Relation Types | `common/house_relation_types/` | House relationships | 🔄 Planned | Generic validation only |
| **Titles & Realms** | Landed Titles | `common/landed_titles/` | Kingdoms, duchies | 🔄 Planned | Generic validation only |
| | Holdings | `common/holdings/` | Castle, city, temple | 🔄 Planned | Generic validation only |
| | Buildings | `common/buildings/` | Construction options | 🔄 Planned | Generic validation only |
| | Great Projects | `common/great_projects/` | Wonders, special buildings | 🔄 Planned | Generic validation only |
| | Laws | `common/laws/` | Succession, realm laws | 🔄 Planned | Generic validation only |
| | Governments | `common/governments/` | Feudal, clan, tribal | 🔄 Planned | Generic validation only |
| | Succession Election | `common/succession_election/` | Elective succession | 🔄 Planned | Generic validation only |
| | Succession Appointment | `common/succession_appointment/` | Appointed succession | 🔄 Planned | Generic validation only |
| | Vassal Stances | `common/vassal_stances/` | Vassal contracts | 🔄 Planned | Generic validation only |
| | Diarchies | `common/diarchies/` | Regency rules | 🔄 Planned | Generic validation only |
| | Tax Slots | `common/tax_slots/` | Tax collection | 🔄 Planned | Generic validation only |
| **Court & Guests** | Court Positions | `common/court_positions/` | Court roles | 🔄 Planned | Generic validation only |
| | Court Types | `common/court_types/` | Court grandeur types | 🔄 Planned | Generic validation only |
| | Court Amenities | `common/court_amenities/` | Court features | 🔄 Planned | Generic validation only |
| | Guest System | `common/guest_system/` | Wandering characters | 🔄 Planned | Generic validation only |
| | Courtier/Guest Management | `common/courtier_guest_management/` | Guest spawning rules | 🔄 Planned | Generic validation only |
| | Domiciles | `common/domiciles/` | Adventurer bases | 🔄 Planned | Generic validation only |
| **Culture & Religion** | Cultures | `common/culture/cultures/` | Culture definitions | 🔄 Planned | Generic validation only |
| | Culture Traditions | `common/culture/traditions/` | Cultural bonuses | 🔄 Planned | Generic validation only |
| | Culture Pillars | `common/culture/pillars/` | Heritage, language | 🔄 Planned | Generic validation only |
| | Culture Eras | `common/culture/eras/` | Tech progression | 🔄 Planned | Generic validation only |
| | Innovations | `common/culture/innovations/` | Tech unlocks | 🔄 Planned | Generic validation only |
| | Name Lists | `common/culture/name_lists/` | Character names | 🔄 Planned | Generic validation only |
| | Culture Aesthetics | `common/culture/aesthetics_bundles/` | Visual style bundles | 🔄 Planned | Generic validation only |
| | Religions | `common/religion/religions/` | Faith families | 🔄 Planned | Generic validation only |
| | Religion Families | `common/religion/religion_families/` | Religion groupings | 🔄 Planned | Generic validation only |
| | Doctrines | `common/religion/doctrines/` | Religious tenets | 🔄 Planned | Generic validation only |
| | Holy Sites | `common/religion/holy_sites/` | Sacred locations | 🔄 Planned | Generic validation only |
| | Fervor Modifiers | `common/religion/fervor_modifiers/` | Faith fervor effects | 🔄 Planned | Generic validation only |
| | Flavorization | `common/flavorization/` | Name/title variations | 🔄 Planned | Generic validation only |
| **Military** | Men at Arms | `common/men_at_arms_types/` | Unit types | 🔄 Planned | Generic validation only |
| | Combat Effects | `common/combat_effects/` | Battle modifiers | 🔄 Planned | Generic validation only |
| | Combat Phase Events | `common/combat_phase_events/` | Battle events | 🔄 Planned | Generic validation only |
| | AI War Stances | `common/ai_war_stances/` | AI behavior | 🔄 Planned | Generic validation only |
| | AI Goal Types | `common/ai_goaltypes/` | AI decision making | 🔄 Planned | Generic validation only |
| | Raids | `common/raids/` | Raiding system | 🔄 Planned | Generic validation only |
| **Artifacts & Items** | Artifacts | `common/artifacts/` | Weapons, regalia | 🔄 Planned | Generic validation only |
| | Accolade Types | `common/accolade_types/` | Knight honors | 🔄 Planned | Generic validation only |
| | Inspirations | `common/inspirations/` | Artifact creation | 🔄 Planned | Generic validation only |
| **Map & History** | Bookmarks | `common/bookmarks/` | Start dates | 🔄 Planned | Generic validation only |
| | Terrain Types | `common/terrain_types/` | Map terrain | 🔄 Planned | Generic validation only |
| | Geographical Regions | `map_data/geographical_regions/` | Region definitions | 🔄 Planned | Generic validation only |
| | Province Terrain | `common/province_terrain/` | Province terrain mapping | 🔄 Planned | Generic validation only |
| | Character History | `history/characters/` | Starting characters | 🔄 Planned | No validation (different syntax) |
| | Province History | `history/provinces/` | Province setup | 🔄 Planned | No validation (different syntax) |
| | Title History | `history/titles/` | Title holders | 🔄 Planned | No validation (different syntax) |
| | Culture History | `history/cultures/` | Culture start states | 🔄 Planned | No validation (different syntax) |
| | War History | `history/wars/` | Ongoing wars at start | 🔄 Planned | No validation (different syntax) |
| | Artifact History | `history/artifacts/` | Starting artifacts | 🔄 Planned | No validation (different syntax) |
| **DLC Features** | Struggles | `common/struggle/` | Iberian Struggle | 🔄 Planned | Generic validation only |
| | Legends | `common/legends/` | Legendary journeys | 🔄 Planned | Generic validation only |
| | Travel | `common/travel/` | Travel system | 🔄 Planned | Generic validation only |
| | Epidemics | `common/epidemics/` | Plague, disease | 🔄 Planned | Generic validation only |
| | Legitimacy | `common/legitimacy/` | Ruler legitimacy | 🔄 Planned | Generic validation only |
| | Confederations | `common/confederation_types/` | Administrative gov | 🔄 Planned | Generic validation only |
| | Subject Contracts | `common/subject_contracts/` | Vassal obligations | 🔄 Planned | Generic validation only |
| | Task Contracts | `common/task_contracts/` | Mercenary contracts | 🔄 Planned | Generic validation only |
| | Lease Contracts | `common/lease_contracts/` | Holy order leases | 🔄 Planned | Generic validation only |
| **Genetics & Appearance** | DNA Data | `common/dna_data/` | Character appearance | 🔄 Planned | Generic validation only |
| | Genes | `common/genes/` | Genetic traits | 🔄 Planned | Generic validation only |
| | Ethnicities | `common/ethnicities/` | Population appearances | 🔄 Planned | Generic validation only |
| **UI & Presentation** | GUI | `gui/` | Interface layout | ❌ N/A | Not supported (different syntax) |
| | Localization | `localization/` | Text strings | ⚠️ Indexed | Key resolution, missing key warnings, go-to-def |
| | Customizable Loc | `common/customizable_localization/` | Dynamic text | 🔄 Planned | Generic validation only |
| | Game Concepts | `common/game_concepts/` | Encyclopedia entries | 🔄 Planned | Generic validation only |
| | Messages | `common/messages/` | Notification system | 🔄 Planned | Generic validation only |
| | GFX | `gfx/` | Graphics, icons | ❌ N/A | Not supported (asset files) |
| | Coat of Arms | `common/coat_of_arms/` | Heraldry system | 🔄 Planned | Generic validation only |
| | Event Backgrounds | `common/event_backgrounds/` | Event window art | 🔄 Planned | Generic validation only |
| | Event Themes | `common/event_themes/` | Event styling | 🔄 Planned | Generic validation only |
| | Notifications | `notifications/` | Toast notifications | 🔄 Planned | Generic validation only |
| | Scripted Animations | `common/scripted_animations/` | Character animations | 🔄 Planned | Generic validation only |
| | Portrait Types | `common/portrait_types/` | Character portraits | 🔄 Planned | Generic validation only |
| **Meta** | Mod Descriptor | `descriptor.mod` | Mod metadata | ✅ Complete | Required name field, path validation |

---

## Summary Statistics

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Complete | 7 | ~6% |
| ⚠️ Indexed | 6 | ~5% |
| 🔄 Planned | 100+ | ~87% |
| ❌ N/A | 2 | ~2% |

---

## See Also

- [feature_matrix.md](feature_matrix.md) - Detailed validation capabilities per file type
- [SCHEMA_AUTHORING_GUIDE.md](../docs/SCHEMA_AUTHORING_GUIDE.md) - How to create schemas for new content types
