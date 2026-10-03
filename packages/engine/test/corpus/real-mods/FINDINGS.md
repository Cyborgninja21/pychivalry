# Error-severity findings on the real-mod corpus

Every error-severity finding of the engine path and of the editor path on the five mods is
classified here; the per-finding list, with the classification merged in, is the `errors` array
of each `<slug>.counts.json` (rules: [`classifications.json`](classifications.json)). A real
defect is wrong against CK3 1.20.0.2, the game reports it, and the message is the engine's
catalogue text (the game's own). A false positive is the tool being wrong and has a GitHub
issue (labels `post-2.0`, `false-positive`). Nothing in the corpus was edited.

**Fixed: issue [#90](https://github.com/Cyborgninja21/pychivalry/issues/90).** The first
recording reported 1,751 errors on VIET Events (1,750 false positives): a file's kind was judged
from its absolute path, so the corpus folder `viet-events/` matched the `events/` pattern and
every scripted effect and trigger of the mod was indexed as an event. Files are now classified
by their path inside the mod with segment-anchored patterns; VIET Events has 1 error, the real
defect below.

**The 2.1 scope check adds no finding.** Re-recorded 2026-10-02 with spec package format 3 and
the scope check (`wrong_scope_for_trigger_X_expected_X`, `wrong_scope_for_effect_X_expected_X`,
`trying_to_use_X_link_on_an_invalid_scope_X`): on both paths and all five mods the counts per
code and every error are identical to the Phase 1 records, so there is no new finding to
classify and no new issue.

**The graphics-file check (GFX001, post-2.0 Phase 3).** Re-recorded on the editor path
2026-10-03 with the base game set (`CK3_GAME_PATH` = the 1.20.0.2 `game` directory): the records
change only by `GFX001` entries (warnings, so the error tables below are unchanged; the engine
path has no plug-ins and is unchanged). Each reference is looked up, case-insensitively, in the
mod root, then `game/`, then the 22 `game/dlc/<dlc>/` folders of the install (24 roots).

| Mod | GFX001 (editor path) |
| --- | ---: |
| balance-of-power-ui | 0 |
| divine-intervention | 0 |
| elf-destiny | 0 |
| rice | 3 |
| viet-events | 0 |

All three are real missing files (the same `RICE_consecrate_holy_well` decision, culture-gated
`picture` blocks). Looked for in `rice/`, `game/` and every `game/dlc/*` folder: found in none.
The mod has each file under `gfx/interface/illustrations/decisions/` and its other decisions
reference them there (`RICE_chios_decisions.txt:71`, `RICE_khuzestan_decisions.txt:389`, …);
these three point at `event_scenes/` instead, so the game shows no picture for them.

| Mod | File:line | Referenced path | Looked in | Classification |
| --- | --- | --- | --- | --- |
| rice | `common/decisions/RICE_mayo_decisions.txt:425` | `gfx/interface/illustrations/event_scenes/decision_erect_homer_monument.dds` | `rice/`, `game/`, `game/dlc/dlc001_preorder` … `dlc030_ce3` (22): absent; exists as `rice/gfx/interface/illustrations/decisions/decision_erect_homer_monument.dds` | real missing file (wrong folder) |
| rice | `common/decisions/RICE_mayo_decisions.txt:431` | `gfx/interface/illustrations/event_scenes/decision_visit_western_oasis_springs.dds` | the same 24 roots: absent; exists as `rice/gfx/interface/illustrations/decisions/decision_visit_western_oasis_springs.dds` | real missing file (wrong folder) |
| rice | `common/decisions/RICE_mayo_decisions.txt:437` | `gfx/interface/illustrations/event_scenes/decision_RICE_east_asian_garden.dds` | the same 24 roots: absent; exists as `rice/gfx/interface/illustrations/decisions/decision_RICE_east_asian_garden.dds` | real missing file (wrong folder) |

No false positive, so no new issue.

## 2.2: the plug-in false positives are fixed (post-2.0 Phase 4, step 4.0)

Re-recorded on the editor path 2026-10-03 after the evidence audit of the plug-in catalogue
([diagnostics-evidence.md](../../../../../Documentation/developer-guide/diagnostics-evidence.md)).
The engine path is unchanged. **Every error-severity editor finding is now a real defect the
engine path proves:** 0 / 0 / 15 / 92 / 1 (balance-of-power-ui, divine-intervention,
elf-destiny, rice, viet-events), the same list as the engine path's, classified in the tables
below. All seven false positives are fixed, each pinned by its corpus case in
`vscode-extension/src/test/unit/plugin-false-positives.test.ts`:

| Issue | Code | Fix | Editor errors before → after |
| --- | --- | --- | --- |
| [#91](https://github.com/Cyborgninja21/pychivalry/issues/91) | CK5142 | removed: `liege = root` is the ordinary comparison | 267 → 0 |
| [#92](https://github.com/Cyborgninja21/pychivalry/issues/92) | CK3873 | a hint: `always = no` switches content off on purpose | 128 → 0 (128 hints) |
| [#93](https://github.com/Cyborgninja21/pychivalry/issues/93) | CK3950, CK3951 | removed: only tagged colour values reached them; undefined calls are the engine's unknown_effect_X / unknown_trigger_X | 202 → 0 |
| [#94](https://github.com/Cyborgninja21/pychivalry/issues/94) | CK3420 | removed: an unknown event field is the engine schema check's unknown_X_in_X | 10 → 0 |
| [#95](https://github.com/Cyborgninja21/pychivalry/issues/95) | CK3552 | the window is evaluated after immediate; reports (information) only scopes saved in an option or after | 78 → 0 (12 information) |
| [#96](https://github.com/Cyborgninja21/pychivalry/issues/96) | CK3550 | a scope saved earlier in the trigger is available; information | 2 → 0 (4 information) |
| [#97](https://github.com/Cyborgninja21/pychivalry/issues/97) | CK3553 | variables persist; only local variables are reported (information) | 1 → 0 |

**Warnings left, and why each is evidence-backed.** The plug-ins leave three warning classes
on the corpus, each a catalogue message of the game and each checked by hand against the mod
and the 1.20.0.2 base game; the engine's own `unknown_X_in_X` (1,581, a field the directory
schema does not list) is unchanged.

| Code | Count | Evidence | Findings |
| --- | ---: | --- | --- |
| CK3800 | 6 (elf-destiny) | `unknown_trait_X_in_event_at_X` | `trait = pillager` in `history/characters/dark_elf_tinder_characters.txt` (lines 99, 146, 193, 250, 297, 344): no `pillager` trait or trait group in the mod's or the base game's `common/traits` |
| CK4100 | 3 (elf-destiny) | `unknown_loc_key_X` | `events/elf_destiny_debug_menu.txt:713`, `:714`, `:727` name `elf_destiny_debug_menu.023.title`, `.desc`, `.culture`: in no localization file of the mod or the base game |
| GFX001 | 3 (rice) | `failed_to_load_texture_X_file_not_found` | the three `RICE_mayo_decisions.txt` pictures below (Phase 3) |

What went away besides the false positives: CK4100 (7,622 → 3) reads only real localization
fields (gene names in ethnicities, script-value breakdown labels and trigger_localization keys
were read as keys) and the base game's 297,792 English keys, and the localization index now
reads `key: "text"` entries without a version number (65,842 of them in the corpus' own
localization); CK3430 / EVENT-003 (2,880 → 0) judge a theme against the workspace's and the
base game's `common/event_themes` instead of 32 hard-coded names (VIET's own themes and
vanilla themes such as `feast_activity` were reported); CK3340 (425 → 0) was merged into the
engine's chain check; CK3800 (155 → 6) knows trait groups (`has_trait = lunatic`, the
group_equivalence the base game itself uses 542 times) and culture traditions are no longer
read as traits; EVENT-002 (172 → 0, a missing `type`, which is optional); CK3701 (716 → 276)
and CK3702 (876 → 88) look across the workspace and the base game, and are information and
hint. Style codes are hints. Counts per code before and after: the audit table of
diagnostics-evidence.md.

## Summary (2.1 records)

| Mod | Engine path errors | Editor path errors |
| --- | --- | --- |
| balance-of-power-ui | 0 | 0 |
| divine-intervention | 0 | 8: false positives #91 (5), #92 (3) |
| elf-destiny | 15 real defects | 338: the same 15 real defects; false positives #93 (164), #92 (92), #91 (29), #95 (29), #94 (7), #96 (2) |
| rice | 92 real defects | 438: the same 92 real defects; false positives #91 (222), #95 (49), #93 (38), #92 (33), #94 (3), #97 (1) |
| viet-events | 1 real defect | 12: the same real defect; false positives #91 (11) |

## Real defects

| Mod | Count | Example (file:line) | Message | Why |
| --- | ---: | --- | --- | --- |
| rice | 87 | `history/titles/RICE_laamp_titles_867.txt:12` | Unknown effect 'destroy_landless_title_no_dlc_effect' | 1.20.0.2 defines no `destroy_landless_title*` effect anywhere in `game/common` or `game/history` |
| rice | 1 | `history/titles/RICE_admin_titles.txt:21` | Unknown effect 'destroy_landless_title_no_tgp_dlc_effect' | the same, the TGP variant |
| rice | 3 | `common/modifiers/RICE_pamir_event_modifiers.txt:386` | 'faith_creation_piety_cost_mult' was removed in CK3 1.20.0.2; use rite_creation_piety_cost_mult instead | renamed in 1.20 (the base game's buildings use `rite_creation_piety_cost_mult`); RICE declares 1.19 |
| rice | 1 | `common/modifiers/RICE_south_ethiopia_modifiers.txt:381` | Unknown modifier type 'Fertility' at common/modifiers/RICE_south_ethiopia_modifiers.txt:381 | modifier names are case-sensitive: `fertility` |
| elf-destiny | 12 | `history/titles/elf_landless_titles.txt:10` | Unknown effect 'destroy_landless_title_no_dlc_effect' | as in RICE; Elf Destiny declares 1.20.\* |
| elf-destiny | 1 | `common/schemes/scheme_types/OVERRIDE_schemes.txt:469` | Unknown trigger 'trait_is_shunned_or_criminal_in_faith_trigger' | an override of a vanilla scheme file keeps the pre-1.20 name; 1.20.0.2 has `trait_is_shunned_or_criminal_in_rite_trigger` |
| elf-destiny | 1 | `common/tutorial_lessons/mod_intro.txt:30` | Unknown trigger 'is_widget_open' | the trigger is `is_widgetid_open` in 1.20.0.2 (`game/common/trigger_localization/00_debug_triggers.txt`: "re-uses the old 'is_widget_open' localization") |
| elf-destiny | 1 | `common/scripted_effects/entrance_scheme_scripted_effects.txt:661` | Unexpected token, expected 'key = {' | the file's last line is an unmatched `}` (brace depth goes negative there) |
| viet-events | 1 | `common/scripted_effects/VIET_misc_effects.txt:307` | Unknown effect 'ek_character_setup_effect' | defined neither by the mod nor by the base game (an Elder Kings compatibility hook) |

## False positives

| Issue | Path | Code | Cause | Count | Example |
| --- | --- | --- | --- | ---: | --- |
| [#91](https://github.com/Cyborgninja21/pychivalry/issues/91) | plug-in paradox-checks | CK5142 | `liege = root`, `employer = scope:x` … are the ordinary comparison form (1,475 uses in the base game) | 267 | RICE `common/scripted_effects/RICE_manichean_effects.txt:329` |
| [#92](https://github.com/Cyborgninja21/pychivalry/issues/92) | plug-in paradox-checks | CK3873 | `trigger = { always = no }` disables content on purpose (167 uses in the base game) | 128 | RICE `common/buildings/RICE_harran_buildings.txt:12` |
| [#93](https://github.com/Cyborgninja21/pychivalry/issues/93) | plug-in scripted-blocks | CK3950, CK3951 | colour values `rgb { }` / `hsv { }` read as scripted effect and trigger calls | 202 | Elf Destiny `common/coat_of_arms/coat_of_arms/coa_elf_test_template.txt:4` |
| [#94](https://github.com/Cyborgninja21/pychivalry/issues/94) | plug-in paradox-checks | CK3420 | every key ending in `_portrait` is checked (gfx accessories and cameras, a decision and opinion modifiers named `…_portrait`); `highlight_portrait` (an event portrait slot in 12 vanilla event files) is unknown to it | 10 | Elf Destiny `gfx/portraits/cameras/elf_dest_portrait_cameras.txt:27` |
| [#95](https://github.com/Cyborgninja21/pychivalry/issues/95) | plug-in scope-timing | CK3552 | `triggered_desc` triggers are evaluated when the window is shown, after `immediate` (864 vanilla events read immediate-saved scopes there) | 78 | RICE `events/RICE_socotra_events.txt:821` |
| [#96](https://github.com/Cyborgninja21/pychivalry/issues/96) | plug-in scope-timing | CK3550 | the scope is saved earlier inside the same trigger | 2 | Elf Destiny `events/aeluran/aeluran_advisor_task_events.txt:696` |
| [#97](https://github.com/Cyborgninja21/pychivalry/issues/97) | plug-in scope-timing | CK3553 | the variable is set by an earlier firing of the event, the intended pattern | 1 | RICE `events/RICE_sicily_events.txt:922` |
