# lookup

A stub of a game install for lookup (docs/PLAN.md item 4.8), written by hand. It holds the base
game's side of the names the test looks up, read with the mod
[lookup-definitions-and-uses](../../mods/lookup-definitions-and-uses/README.md):

| File | What it holds for the fixture |
| --- | --- |
| `launcher/launcher-settings.json` | The game build, `1.21.0.3` |
| `game/common/modifier_definition_formats/00_fixture_definitions.txt` | Format definitions of two modifiers of the package, `monthly_prestige` and `monthly_prestige_gain_mult`: the records part D5 gives a localization key by their name |
| `game/localization/english/`, `game/localization/french/` | The key `monthly_prestige` in two languages, with the fixture's own text; `monthly_prestige_gain_mult` has none |
| `game/common/scripted_triggers/00_fixture_triggers.txt` | `fixture_scripted_trigger`, which the mod defines again |
| `game/history/characters/00_fixture_characters.txt` | `fixture_character`, which the mod writes again |
| `game/common/lifestyles/00_fixture_lifestyles.txt` | `fixture_lifestyle`, a key of the lifestyles' keyword templates (`add_%s_xp`) |
| `game/common/scripted_lists/00_fixture_lists.txt` | `fixture_list`, a list script can iterate (`every_fixture_list`) |
| `game/events/fixture_lookup_events.txt` | Three uses of `fixture_scripted_trigger` |

Localization files start with the UTF-8 byte-order mark, as the game asks for. The test is
`packages/core/src/lookup/workspace.test.ts`.
