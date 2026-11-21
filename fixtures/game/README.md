# Game stubs

Stand-ins for a base game, for tests that need one: a name looked up in the game's files, a mod
overriding a game file, a version mismatch. A stub has the layout of the game's `game` folder
and holds only the few files the test needs, written by hand.

```text
fixtures/game/<name>/
  README.md                 what it stands in for
  launcher/launcher-settings.json   states the game build
  game/
    checksum_manifest.txt
    common/ events/ localization/ ...
```

A stub is never a copy of game files. The real base game is read only by the local suites
(`task game:*`), from the folder `CK3_GAME_PATH` names, and is never committed.

Nothing is here yet. Build step 3, the workspace index, adds the first.
