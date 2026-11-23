# Game stubs

Stand-ins for a base game, for tests that need one: a name looked up in the game's files, a mod
overriding a game file, a version mismatch. A stub has the layout of a game install and holds
only the few files the test needs, written by hand.

```text
fixtures/game/<name>/
  README.md                 what it stands in for
  launcher/launcher-settings.json   states the game build
  game/                     the game folder: CK3_GAME_PATH points here
    checksum_manifest.txt
    common/ events/ localization/ ...
    dlc/<pack>/<pack>.dlc   a DLC pack, its descriptor naming its folder, and its files
  jomini/  clausewitz/      the install's two other folders, when the test needs them
```

The base game is all three folders of the install (docs/overrides.md, rule 3), so a stub that
tests how they relate holds `jomini/` or `clausewitz/` beside `game/`.

A stub is never a copy of game files. The real base game is read only by the local suites
(`task game:*`), from the folder `CK3_GAME_PATH` names, and is never committed.

| Stub | What it stands in for | Added by |
| --- | --- | --- |
| [override-rules](override-rules/README.md) | An install with the three folders and a DLC pack, holding the game's side of every rule in docs/overrides.md | Step 3 |
| [event-targets-and-localization](event-targets-and-localization/README.md) | A base game that saves a scope and defines two localization keys, for the checks that stay silent without one | Item 4.6 |
