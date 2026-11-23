# override-rules

A stub of a game install for the override rules of [docs/overrides.md](../../../docs/overrides.md),
written by hand: build step 3, item 3.2. It has the three folders of a real install, each in the
game's layout, and one DLC pack:

| Folder | What it holds for the fixture |
| --- | --- |
| `launcher/launcher-settings.json` | The game build, `1.21.0.3` |
| `game/` | The base game's files: one or two per rule |
| `game/dlc/dlc_fixture/` | A DLC pack: its descriptor `dlc_fixture.dlc` names its folder, and its files sit at their path inside it (rule 10) |
| `jomini/` | A file at a path `game/` also ships, and a file only `jomini/` ships (rule 3) |
| `clausewitz/` | A localization file at a path `game/` also ships (rule 3) |
| `game/common/landed_titles/` | Titles nested five deep, each a definition (the package's part D3) |
| `game/history/cultures/` | A culture's history, named by its file (part D3) |
| `game/common/named_colors/fixture_sub/`, `game/history/characters/fixture_sub/` | Files below a subfolder of a folder read without its subfolders, and of one whose depth only a partial row states (rule 4) |
| `game/common/genes/` | Gene containers, `special_genes` holding containers, a gene's templates and an age preset (format 8: the containers rows' `entries`, rule 6) |
| `game/common/coat_of_arms/coat_of_arms/` | Coats of arms written as blocks and as alias lines `key = other_key`, in each order, and a line whose target is read after it (format 8: `coat-of-arms-alias`, rule 5) |
| `game/common/house_relation_types/`, `game/common/task_contracts/` | A nested name of `global` scope under two parents, and one whose scope rests on the measurement alone (format 8: part D3's `name_scope`) |

It is read with the mods [override-rules](../../mods/override-rules/README.md),
[override-rules-replace-path](../../mods/override-rules-replace-path/README.md) and
[override-rules-folder-case](../../mods/override-rules-folder-case/README.md), one mod at a
time. Each mod's `expected.json` says what a correct index answers for every name of the stub
and the mod with the spec package's rules table (part D1), on each platform; the test is
`packages/core/src/index/fixtures.test.ts`.

Localization files start with the UTF-8 byte-order mark, as the game asks for.
