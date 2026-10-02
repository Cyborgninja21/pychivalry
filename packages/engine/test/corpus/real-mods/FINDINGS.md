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

## Summary

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
