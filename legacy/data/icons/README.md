# CK3 Icon References Data

This directory contains extracted icon reference data from your CK3 installation.

## Files

- `icons.yaml` - All icon references with metadata
- `categories.yaml` - Icons organized by category

## What are Icon References?

Icons are inline graphics used in CK3 localization:

```
@gold_icon!      -> Gold coin icon
@prestige_icon!  -> Prestige icon
@death_icon!     -> Skull icon
```

## Categories

### Buildings (219 icons)

- `@building!`
- `@building_buttons_connector!`
- `@building_icon!`
- `@building_level_01!`
- `@building_level_02!`
- `@building_level_03!`
- `@building_level_04!`
- `@building_level_05!`
- `@building_level_06!`
- `@building_level_07!`
- ... and 209 more

### Character (307 icons)

- `@_frame_diplomacy!`
- `@_frame_health!`
- `@_frame_intrigue!`
- `@_frame_learning!`
- `@_frame_martial!`
- `@a_legacy_to_last_the_ages_achievement!`
- `@a_legacy_to_last_the_ages_achievement_notachieved!`
- `@action_has_low_fertility!`
- `@action_lifestyle_intrigue!`
- `@action_lifestyle_learning!`
- ... and 297 more

### Council (21 icons)

- `@_frame_stewards!`
- `@a_catch_all_councillor!`
- `@action_empty_council_position!`
- `@chancellor_job!`
- `@council!`
- `@council_icon!`
- `@council_mixed!`
- `@council_negative!`
- `@council_positive!`
- `@ep2_17_little_william_marshal_achievement!`
- ... and 11 more

### Culture (91 icons)

- `@celestial_traditional!`
- `@celestial_traditional_small!`
- `@culture!`
- `@culture_disable!`
- `@culture_era_early_medieval!`
- `@culture_era_high_medieval!`
- `@culture_era_late_medieval!`
- `@culture_era_tribal!`
- `@culture_icon!`
- `@cultures!`
- ... and 81 more

### Military (132 icons)

- `@acclaimed_knight!`
- `@acclaimed_knight_icon!`
- `@acclaimed_knights!`
- `@army_active!`
- `@army_ally!`
- `@army_at_loot_cap!`
- `@army_attach!`
- `@army_attrition!`
- `@army_automation!`
- `@army_automation_off!`
- ... and 122 more

### Other (3729 icons)

- `@1!`
- `@2!`
- `@3!`
- `@4!`
- `@5!`
- `@6!`
- `@7!`
- `@_default!`
- `@_default_115_frame!`
- `@_default_115_shadow!`
- ... and 3719 more

### Relationships (56 icons)

- `@befriend_intent!`
- `@best_friend!`
- `@best_friend_icon!`
- `@county_modifier_opinion_mixed!`
- `@county_modifier_opinion_negative!`
- `@county_modifier_opinion_positive!`
- `@court_brewmaster_court_opinion!`
- `@court_brewmaster_popular_opinion!`
- `@cs_weak_hook_icon!`
- `@default_house_relation_level_friendly_flat!`
- ... and 46 more

### Religion (172 icons)

- `@bm_1178_swords_of_faith!`
- `@convert_faith!`
- `@core_tenet_adaptive!`
- `@core_tenet_adorcism!`
- `@core_tenet_alexandrian_catechism!`
- `@core_tenet_ancestor_worship!`
- `@core_tenet_aniconism!`
- `@core_tenet_asceticism!`
- `@core_tenet_assassin!`
- `@core_tenet_astrology!`
- ... and 162 more

### Resources (144 icons)

- `@_frame_stress!`
- `@adventurer_gold!`
- `@core_tenet_filial_piety!`
- `@domicile_agent_dread_yurt!`
- `@domicile_renown_gain_yurt!`
- `@dread!`
- `@dread_icon!`
- `@dread_mixed!`
- `@dread_negative!`
- `@dread_positive!`
- ... and 134 more

### Schemes (62 icons)

- `@confident_schemers!`
- `@confident_schemers_small!`
- `@domicile_secret_scheme_yurt!`
- `@feast_type_murder!`
- `@hostile_scheme!`
- `@icon_discovered_scheme!`
- `@icon_personal_scheme!`
- `@icon_raid_estate_scheme!`
- `@icon_scheme!`
- `@icon_scheme_abduct!`
- ... and 52 more

### Titles (80 icons)

- `@barony_crown!`
- `@bm_1178_call_of_the_empire!`
- `@ceremonial_claimant_faction!`
- `@claim_cb!`
- `@claimant_faction!`
- `@county_building_available!`
- `@county_capital!`
- `@county_conquest_cb!`
- `@county_control!`
- `@county_control_active!`
- ... and 70 more

### Traits (68 icons)

- `@_frame_education!`
- `@_frame_fame_bad!`
- `@_frame_fame_good!`
- `@_frame_fame_neutral!`
- `@_frame_lifestyle!`
- `@action_can_choose_lifestyle!`
- `@action_lifestyle_diplo!`
- `@action_lifestyle_stewarship!`
- `@action_lifestyle_wanderer!`
- `@activity_adult_education!`
- ... and 58 more

### Ui (371 icons)

- `@_no_task!`
- `@a_house_of_my_own_achievement_notachieved!`
- `@a_name_known_throughout_the_world_achievement!`
- `@a_name_known_throughout_the_world_achievement_notachieved!`
- `@a_perfect_circle_achievement_notachieved!`
- `@above_god_achievement_notachieved!`
- `@action_adult_player_heir_not_married!`
- `@action_adult_ruler_not_married!`
- `@action_ghw_participation_alert!`
- `@action_has_unopened_court_event!`
- ... and 361 more

## Usage in Mods

This data enables:
- **Validation**: Warns when you use a non-existent icon
- **Completions**: Auto-complete icon names in `@...!` patterns
- **Hover Docs**: Shows icon description when you hover over it

## Copyright Notice

Icon data is © Paradox Interactive AB. This data is extracted from your
personal CK3 installation for modding assistance only. Do not redistribute.

## Regenerating

Run: `CK3: Extract Localization Data from CK3 Installation` in VS Code
Or: `npx ts-node tools/extract-icons.ts --ck3-path "/path/to/ck3"`
