# override-rules

A mod, read over the game stub [fixtures/game/override-rules](../../game/override-rules/README.md),
that exercises every rule of [docs/overrides.md](../../../docs/overrides.md) a single mod can
(build step 3, item 3.2; extended in item 4.2 for the rows of the spec package's part D1).
Rule 8 (`replace_path`) and the folder half of rule 9 have mods of their own, because the first
hides whole folders and the second cannot share a folder tree with this one on Windows.

| Rule | Files | What a correct index answers |
| --- | --- | --- |
| 1 | `common/traits/00_fixture_traits.txt`, at the game file's path; `history/cultures/fixture_culture.txt` | The game's file is not read: `fixture_shy` is the mod's, `fixture_brave` is not read anywhere; the culture history, named by its file, is the mod's |
| 2 | (stub) two `00_fixture_buildings.txt` in different folders | Both are read |
| 3 | (stub) `jomini/` and `game/` copies, `clausewitz/` and `game/` copies; `common/defines/jomini/fixture_jomini_only.txt` here | `game/` over `jomini/` over `clausewitz/`; the mod over each |
| 4, 5, 11 | `common/script_values/zz_fixture_values.txt`; (stub) a value defined twice in one file; a constant in both files | The later read wins, whole; a constant holds for its file |
| 4 | (stub) a file below a subfolder of `common/named_colors` and of `history/characters`; `music/music_player_categories/` here | Not read where the folder is read without subfolders; not known where no settled row says |
| 5 | `common/landed_titles/zz_fixture_titles.txt`; (stub) titles nested five deep | A nested title is a definition; the later wins per title |
| 6 | `events/`, `history/characters/`, `common/on_action/`, `common/defines/`, `common/named_colors/`, (stub) `common/province_terrain/`, `history/titles/` | Events by priority (a winner, or a clash at equal priority); character history no winner (a partial row); on-actions, define groups and container keys add up; a define set twice, the later block; province terrain is statements; a title's history in two places applies whole |
| 7 | `localization/english/`, and its `replace/` folder with two files | The copy read first among ordinary files; a `replace` file over them, the later of two |
| 9 | `common/script_values/00_FIXTURE_AGE_VALUES.txt` beside the game's `00_fixture_age_values.txt` | On Linux two paths, both read; on Windows the mod's replaces the game's |
| 10 | `music/music_player_categories/fixture_dlc_categories.txt`, at the DLC file's path | The DLC's file is not read; the DLC's other file is read, at its path inside the pack |
| 11 | `common/defines/zz_fixture_defines.txt`, a define written twice in one block | The first of the two |
| 5 | `common/coat_of_arms/coat_of_arms/zz_fixture_coat_of_arms.txt`; (stub) blocks and alias lines | Format 8, `coat-of-arms-alias` replayed in read order: of two alias lines the later; a block then an alias, the alias; an alias then a block, the block, for the key, its target and every name on the object; a target not read yet, nothing in force; a later block of a target fills every name aliased to it |
| 5 | `common/traits/00_fixture_traits.txt` (two traits with a track of one name); (stub) `common/house_relation_types/`, `common/task_contracts/` | Format 8, part D3's scope: a track is known by its trait, two tracks; a relation level by its name alone, one name defined twice and no row for a nested kind; a contract reward whose scope rests on the measurement alone, not known |
| 6 | `common/genes/zz_fixture_genes.txt`; (stub) `common/genes/00_fixture_genes.txt` | Format 8: the gene containers and `special_genes` add up; every gene is one key space, known by its name and portrait group; the same type again, the later wins; another type, the earlier stays, and a gene after it in its block is not known; an age preset in a key space of its own; a template is known by its gene. Format 9 (`on_replace`): a gene the mod replaces takes its templates with it, so a template written only in the earlier gene is in force nowhere, and one written in both is the later's |
| 6 | `common/province_terrain/zz_fixture_terrain.txt`; (stub) `common/province_terrain/` | Format 8, `province-terrain-statements`: a terrain line and a winter block are separate stores; a line written again, the later; a block written again, field by field. Format 9 (`key_identity`): a province id is compared as an integer, so `003` is the stub's `3` |
| 7 | `localization/english/fixture_no_bom_l_english.yml`, written without a byte-order mark | Format 8, `msg-localization-missing-bom` (`file_condition`), on Linux and Windows: the file adds no keys, so `fixture_loc_key`'s answer is the one without it and `fixture_loc_no_bom_only` is not defined |

Every localization file starts with the UTF-8 byte-order mark but `fixture_no_bom_l_english.yml`,
which leaves it out on purpose.

`expected.json` lists every name the stub and this mod define, each with its rule, its status,
its winner and every definition with its layer, file, line and whether the game reads its file,
as the spec package's rules table (part D1) decides. A deciding row names its winner, or says
all definitions add up (`all`), are statements (`statements`) or clash (`clash`); where no row
decides, `unknown` and no winner. The answers hold on Linux and on Windows, but for letter case
(rule 9), written once for each platform.
