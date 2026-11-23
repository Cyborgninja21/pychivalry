# lookup-definitions-and-uses

A mod read over the stub [game/lookup](../../game/lookup/README.md) for lookup (docs/PLAN.md
item 4.8), with the committed spec's folder list and override rules (part D1) on Linux. What a
correct lookup answers:

| Name | Answer |
| --- | --- |
| `fixture_scripted_trigger` | Defined in the game and again in the mod (`common/scripted_triggers`): the mod's is in force by a settled row (`scripted-triggers-and-effects-later-wins-whole`). Used 5 times, 3 in the game and 2 in the mod; with a limit of 2 the first two are the game's lines 6 and 7. The package has no reading of it: unknown, and script can call it as a trigger |
| `fixture_character` | Written in the game and in the mod (`history/characters`): only a partial row speaks, so the winner is not known |
| `monthly_prestige` | A modifier of the package whose format record the game defines: its localization key `monthly_prestige` (part D5, measured-only) has a text in the game's English and French files and in the mod's English file; one English copy is in force, as the index resolves it |
| `monthly_prestige_gain_mult` | A modifier with a format record whose key no localization file defines: the key is listed with no text |
| `add_fixture_lifestyle_xp` | Fills the effect template `add_%s_xp` with the key `fixture_lifestyle`, which the game defines, and the trigger template `%s_xp` with `add_fixture_lifestyle`, which nothing defines |
| `every_fixture_list` | An iterator over `fixture_list`, a list the game defines in `common/scripted_lists` |
| `fixture_scripted_trigge` | Nothing: did you mean `fixture_scripted_trigger` (the workspace), at distance 1 |

The test is `packages/core/src/lookup/workspace.test.ts`.
