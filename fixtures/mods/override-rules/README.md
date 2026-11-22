# override-rules

A mod, read over the game stub [fixtures/game/override-rules](../../game/override-rules/README.md),
that exercises every rule of [docs/overrides.md](../../../docs/overrides.md) a single mod can
(build step 3, item 3.2). Rule 8 (`replace_path`) and the folder half of rule 9 have mods of
their own, because the first hides whole folders and the second cannot share a folder tree
with this one on Windows.

| Rule | Files | What a correct index answers |
| --- | --- | --- |
| 1 | `common/traits/00_fixture_traits.txt`, at the game file's path | The game's file is not read: `fixture_shy` is the mod's, `fixture_brave` is not read anywhere |
| 2 | (stub) two `00_fixture_buildings.txt` in different folders | Both are read |
| 3 | (stub) `jomini/` and `game/` copies; `common/defines/jomini/fixture_jomini_only.txt` here | Every definition listed, no winner |
| 4, 5, 11 | `common/script_values/zz_fixture_values.txt`; (stub) a value defined twice in one file | No winner |
| 6 | `events/`, `history/characters/`, `common/on_action/`, `common/defines/`, `common/named_colors/`, (stub) `common/province_terrain/`, `history/titles/` | Events and characters by priority (a winner, or a clash at equal priority); on-actions, define groups and container keys add up; province terrain is statements; a title's history in two places has no winner |
| 7 | `localization/english/`, and its `replace/` folder | No winner |
| 9 | `common/script_values/00_FIXTURE_AGE_VALUES.txt` beside the game's `00_fixture_age_values.txt` | Whether either file is read is open: no winner |
| 10 | `music/music_player_categories/fixture_dlc_categories.txt`, at the DLC file's path | Whether either is read is open; the DLC's own other file is read, at its path inside the pack |

`expected.json` lists every name the stub and this mod define, each with its rule, its status,
its winner and every definition with its layer, file, line and whether the game reads its file.
A settled rule names its winner, or says all definitions add up (`all`), are statements
(`statements`) or clash (`clash`); an open rule gives `unknown` and no winner. The answers hold
on Linux and on Windows.
