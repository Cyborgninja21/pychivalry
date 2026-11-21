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

## 2.3: spec package format 4, the schema review (post-2.0 Phase 6, step 6.5)

The records were re-made 2026-10-03 with the format-4 spec package (sha256 `a9959bf9…`):
the four directory roots and the interaction pickers that 2.1 and 2.2 handled with an
exception table in the engine are now in the package (story cycles run in the `story` scope;
24 record fields carry the scope the game evaluates them in, measured on vanilla, pdx-parser-re
`research/analysis/ROOT_SCOPES_1.20.0.2.md`), the engine reads them, and a block inside a
keyword's parameter block has its root unknown (`ai_start_best_war`'s callbacks are "called
with scopes: root - Current AI character"). EVENT-016 is a warning (the game's namespace
warning is in the catalogue).

**No change by code on either path.** Engine path: on all five mods the counts per code and
every error are identical to the 2.2.0 records (only the spec sha256, the timings and the peak
memory differ). Editor path (base game set, the integration run with `CK3_CORPUS`): the counts per code,
the severity totals, every error and the `features` smoke results (timings aside) are identical
too. No mod of the corpus has an EVENT-016 finding, so the
severity change moves nothing here. No new finding, so no new classification and no new issue.

**The base game is 1.20.0.3.** The spec is derived from the CK3 1.20.0.2 executable, but the 2.3.0 acceptance and corpus records were measured against the 1.20.0.3 game files (Steam updated the install on 2026-10-03; every record's `game` field gives the version, the executable's sha256 and `matches_spec_exe: false`), 21 game files differ, and on the unchanged 2.2.0 engine the difference is one `undefined_event_target_X` finding and four judged keyword uses, with zero scope findings either way. Steam updated the local install on 2026-10-03 at 13:48, the day
these records were made: `binaries/ck3.exe` (sha256 `94B55397…02A6`, the same size as 1.20.0.2)
and 21 files under `game/` (nine `settings_l_*.yml`, the English trigger localization, and
eleven script files: `common/character_interactions/00_grant_titles_interaction.txt`,
`common/on_action/game_start.txt` and `religion_on_actions.txt`,
`common/scripted_triggers/00_religious_triggers.txt`,
`common/trigger_localization/00_character_triggers.txt`, `common/scripted_effects/pam_effects.txt`,
`common/task_contracts/laamp_transport_contracts.txt`, `events/dlc/ep3/ep3_frankokratia_events.txt`,
`common/activities/activity_types/pilgrimage.txt`,
`common/religion/rite_types/01_christian_heresy_rite_types.txt`,
`common/religion/doctrine_types/20_doctrines.txt`). The spec package still describes 1.20.0.2.
On the 2.2.0 engine and package, the update alone changed the vanilla acceptance record by
one `undefined_event_target_X` (10,522 to 10,523) and 22 keyword uses, 4 judged uses and 2
judged link steps, with 0 scope findings either way.

**Vanilla acceptance (format 4, the 1.20.0.3 game).** 0 scope findings over 93,665 judged
keyword uses (2.2.0: 91,580) and 17,312 judged link steps (2.2.0: 17,836). More uses are judged
because story cycles, factions, casus belli types and buildings now have known roots and
fields; fewer link steps because a callback inside a keyword's parameter block no longer
inherits the caller's root. The 14 errors are the same 14 (10 unknown_trigger_X, 4
unknown_effect_X) as in 2.2.0.

## 2.2.0: the release records (post-2.0 Phase 4, step 4.7)

The records in this folder are the 2.2.0 build's (2026-10-03), base game set. Errors and
warnings are the same as after step 4.0: **every error-severity editor finding is a real
defect** (0 / 0 / 15 / 92 / 1, the engine path's list, classified below) and the warnings are
the engine's `unknown_X_in_X` (1,582) plus CK3800 (6), CK4100 (3) and GFX001 (3), each
evidence-backed (table in the step 4.0 section).

**The per-file cap keeps the most severe first (2.2 fix-up).** The provider publishes at most
1,000 diagnostics per file. Until this fix it kept the first 1,000 by position, so in a long
file full of style hints an error near the end would not be published (none was on this
corpus: the editor's errors already equalled the engine's). A capped file now keeps errors,
then warnings, information and hints, and the corpus suite compares the editor's errors with
the engine's in capped files too. Re-recorded with the fix, errors are unchanged and in the
capped files hints give way to more severe findings, error / warning / information / hint:

| Mod | Files at cap | Before the fix | After the fix | Change |
| --- | ---: | --- | --- | --- |
| balance-of-power-ui | 0 | 0 / 0 / 7 / 331 | 0 / 0 / 7 / 331 | none |
| divine-intervention | 14 | 0 / 0 / 468 / 24,547 | 0 / 0 / 1,441 / 23,574 | +973 information, -973 hints |
| elf-destiny | 22 | 15 / 500 / 1,585 / 47,729 | 15 / 501 / 1,779 / 47,534 | +1 warning (unknown_X_in_X), +194 information, -195 hints |
| rice | 23 | 92 / 1,064 / 2,968 / 145,819 | 92 / 1,064 / 3,618 / 145,169 | +650 information, -650 hints |
| viet-events | 5 | 1 / 29 / 635 / 10,428 | 1 / 29 / 929 / 10,134 | +294 information, -294 hints |

The per-code counts in the table below are the records before this fix; the codes that move
are the information codes of capped files (CK3977, CK3875, undefined_event_target_X, CK3656,
CK5137, CK3563 …) up and the style hints (CK3303, CK3317, CK3304 …) down by the same totals. Every change since 2.1, by code, summed over
the five mods (editor path):

| Code | 2.1 | 2.2.0 | Why |
| --- | ---: | ---: | --- |
| CK5142 (error) | 267 | 0 | removed, #91 |
| CK3873 | 128 (error) | 128 (hint) | `always = no` is deliberate, #92 |
| CK3950, CK3951 (error) | 202 | 0 | removed, #93 |
| CK3420 (error) | 10 | 0 | removed, #94 |
| CK3552 | 78 (error) | 12 (information) | corrected evaluation order, #95 |
| CK3550 | 2 (error) | 4 (information) | a scope saved earlier in the trigger is fine, #96; the rest are conventions |
| CK3553 (error) | 1 | 0 | only local variables, #97 |
| CK4100 (warning) | 7,622 | 3 | real localization fields only; the base game's keys; `key: "text"` entries read |
| CK3430 + EVENT-003 (warnings) | 2,880 | 0 | one code, against the workspace's and the base game's themes |
| CK3340 (warning) | 425 | 0 | merged into the engine's chain check |
| CK3800 (warning) | 155 | 6 | trait groups known; traditions are not traits |
| EVENT-002 (warning) | 172 | 0 | `type` is optional |
| CONV-002 (warning) | 44 | 0 | renamed CK3765 (43, information): every non-hidden event without title |
| LOC-001 (warning) | 31 | 0 | literal script-value `desc` labels are not localization fields; the script-file code is CK4101 |
| CK3701 | 716 (warning) | 276 (information) | judged across the workspace and the base game |
| CK3702 (hint) | 876 | 88 | the same |
| ITER-003 | 22 (warning) | 22 (information) | convention |
| COND-001 / COND-002 / COND-003 | 10 / 5 / 2 (warning) | 10 / 5 / 2 (information) | conventions |
| CK3511, CK3450, CONV-001, CONV-004, SWITCH-003, CK3341 | 3, 1, 9, 1, 13, 1 (warning) | 3, 1 (information), 0, 0, 0, 0 | conventions; CONV-001 removed (type optional), CONV-004 merged into CK3450, SWITCH-003 judged only against plain trigger names with the base game's scripted triggers, CK3341 merged into the engine |
| CK3301, CK3303, CK3314 (warnings); CK3304, CK3306, CK3316, CK3317 (information) | 20,392, 79,302, 2,163; 36,094, 34,845, 3,675, 48,465 | 20,427, 79,525, 2,164; 35,988, 34,904, 3,672, 48,626 (all hints) | style; the counts move only through the 1000-per-file cap |
| CK3612, CK3611 (information) | 14, 2 (base = 0, base above 100) | 11, 11 | new meanings: total can be negative (#22), total always zero (#21) |
| CK3613, CK3563, CK3433, CK3522, CK3422 | (new) | 3,321 hint, 108, 14, 11 hint, 16 | #23, #60, #28, #19; CK3422 never reported before 2.2 |
| CK3769, CK3762, CK3763, CK3764 (information) | 0 | 123, 2, 1, 1 | the event checks now run on every event |
| CONV-003 (information) | 2 | 0 | merged into CK3764 |
| CK3703 (information) | 0 | 3 | judged across the workspace (a variable read in one namespace and set only in another) |
| CK3875, CK5137, CK3656 (information); undefined_event_target_X (engine) | 2,009, 442, 269; 1,428 | 2,017, 443, 266; 1,429 | unchanged checks; the counts move only through the 1000-per-file cap |

Unchanged counts: CK3977 (665), CK3872 (130), ITER-004 (45), GFX001 (3) and the engine's other
codes. Total findings 245,310 → 236,218.

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
and the 1.20.0.2 base game; the engine's own `unknown_X_in_X` (1,581 at step 4.0, a field the directory
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

## 2.2: the new codes of steps 4.1 to 4.4, and the quick-fix ranking (step 4.5)

Re-recorded on the editor path after step 4.4 (2026-10-03). Errors and warnings are unchanged
from step 4.0 (errors 0 / 0 / 15 / 92 / 1, the same warning classes); the new codes are all
conventions at information or hint severity, summed over the five mods:

| Code | Severity | Count | What |
| --- | --- | ---: | --- |
| CK3613 | hint | 3,321 | an option of a several-option event without ai_chance or ai_will_select (#23) |
| CK3563 | information | 108 | trigger guard: a random_ save used by an option without an any_ check (#60) |
| CK3765 | information | 43 | a non-hidden event without title (#25; CONV-002's 44 were events with options) |
| CK3433 | information | 14 | an override_background equal to the theme's own background (#28) |
| CK3611 | information | 11 | an ai_chance total that is always zero (#21) |
| CK3612 | information | 11 | an ai_chance total that can be negative (#22) |
| CK3522 | hint | 11 | an after block that only cleans up (#19) |

CK3423 to CK3426, CK3431, CK3560 and CK3561 report nothing on the corpus (every background
reference exists, no desc or title text reads a scope saved only in an option).

**The ten most frequent plug-in codes** on these records (step 4.5, issue #85), with the quick
fix each has: CK3303 79,525 (indentation to tabs), CK3317 48,627 (none: reducing nesting means
extracting blocks, a design choice), CK3304 35,989 (remove trailing whitespace), CK3306 34,904
(spaces around the operator), CK3301 20,427 (indentation to tabs), CK3316 3,672 (none: where to
break a line is a judgement), CK3613 3,321 (add `ai_chance = { base = 100 }`), CK3314 2,164
(remove the empty block), CK3875 2,017 and CK3977 665 (none: the filter of an iterator is the
author's decision; an inserted empty limit would change nothing).

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
