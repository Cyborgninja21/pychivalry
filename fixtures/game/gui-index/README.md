# gui-index

A stub of a game install for the index of GUI types and templates (docs/PLAN.md item 10.4),
written by hand, read with the mod [gui-index](../../mods/gui-index/README.md). Each file holds
one case of docs/gui-syntax.md, "How a mod's GUI overrides the base game's":

| File | What it holds for the fixture |
| --- | --- |
| `launcher/launcher-settings.json` | The game build, `1.21.0.3` |
| `game/common/script_values/00_fixture_values.txt` | One script value, used nowhere: a game folder has `common/` |
| `game/gui/fixture_window.gui` | A window that uses the type `fixture_button` twice (once written `Fixture_Button`) and the template `Fixture_Window_Background`; the type `fixture_button`, which the mod defines again in a file of its own; and that template |
| `game/gui/fixture_replaced.gui` | The type `fixture_replaced_type`; the mod has a file at the same path, which replaces this one whole (part D1, `mod-file-replaces-lower-layers`) |
| `game/gui/shared/fixture_shared.gui` | The type `fixture_shared_type`, in a sub-folder of `gui/`: no row of part D1 says whether the game reads `gui/` with its sub-folders, so whether this file is read is not known |
| `game/gui/fixture_engine.gui`, `jomini/gui/fixture_engine.gui` | The template `Fixture_Engine_Template` in both; the `game/` copy replaces the `jomini/` one whole (`game-file-replaces-jomini-and-clausewitz`) |

GUI files start with the UTF-8 byte-order mark and have Windows line breaks, as the other fixture
files do. The tests are `packages/core/src/gui/index.test.ts` and
`packages/vscode/src/gui-answers.test.ts`.
