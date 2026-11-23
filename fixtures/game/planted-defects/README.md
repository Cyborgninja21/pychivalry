# planted-defects

The base game of the planted-defect mod, [fixtures/defects](../../defects/README.md), written by
hand for build step 6 (items 6.7 to 6.9). The graders check the mod over it, and the scored run
starts the agent server over it, so both see the same base game and neither needs the game
installed.

It holds only what the mod uses and does not define itself, each a look-alike of the mod:

- `game/common/culture/traditions/00_traditions.txt` defines the tradition `tradition_agrarian`,
  which the mod's scripted trigger tests for;
- `game/common/scripted_effects/00_feast_effects.txt` defines the scripted effect
  `ruler_feast_gift_effect`, which one of the mod's events calls.

`launcher/launcher-settings.json` states the build, `1.21.0.3`.
