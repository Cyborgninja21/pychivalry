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

It is read with the mods [override-rules](../../mods/override-rules/README.md),
[override-rules-replace-path](../../mods/override-rules-replace-path/README.md) and
[override-rules-folder-case](../../mods/override-rules-folder-case/README.md), one mod at a
time. Each mod's `expected.json` says what a correct index answers for every name of the stub
and the mod; the test is `packages/core/src/index/fixtures.test.ts`.

Localization files start with the UTF-8 byte-order mark, as the game asks for.
