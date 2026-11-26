# graphics

A stub of a game install for `graphics/missing-file` (docs/PLAN.md item 10.5), written by hand.
It holds the base game's side of the textures the fixture pair `graphics-missing-file` names, one
in each place the check looks:

| File | What it holds for the fixture |
| --- | --- |
| `launcher/launcher-settings.json` | The game build, `1.21.0.3` |
| `game/gfx/interface/illustrations/decisions/fixture_base_picture.dds` | A texture of the install's `game/` folder |
| `game/gfx/interface/illustrations/event_scenes/fixture_base_scene.png` | A texture of `game/`, as a `.png` |
| `game/dlc/dlc_fixture/dlc_fixture.dlc`, `game/dlc/dlc_fixture/gfx/interface/illustrations/decisions/fixture_dlc_picture.dds` | A DLC pack, its descriptor naming its folder, and a texture of it |
| `jomini/gfx/interface/icons/fixture_jomini_icon.tga` | A texture of the install's `jomini/` folder, as a `.tga` |
| `game/common/scripted_effects/fixture_graphics_effects.txt` | One script file, so that the index holds the base game |

A texture here is a line of text, never an image: the check looks a path up and reads no file.
The test is `packages/core/src/check/graphics-missing-file.test.ts`.
