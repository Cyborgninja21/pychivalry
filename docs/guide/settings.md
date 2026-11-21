# Settings

The extension is not built yet, so it has no settings today. This page records what is decided
about configuration; each step that adds a setting adds it here with its name, its default and
what it changes.

## What is decided

- **Finding the game.** pychivalry looks for Crusader Kings 3 in every Steam library, not only
  the default one, and a setting names the folder when it is somewhere else.
- **No game folder.** When pychivalry cannot find the game it stays silent about names the game
  defines. It does not report them as unknown.
- **Background work.** There is a limit on how many files pychivalry checks in the background,
  so the editor stays responsive on a large mod.
- **No keys.** Nothing in the settings holds an API key or a login. The AI that uses pychivalry
  is Claude Code or VS Code's built-in AI, on the login it already has.

## From source

The tasks that read the game take their locations from environment variables, not from
settings:

| Variable | Meaning |
| --- | --- |
| `CK3_GAME_PATH` | The game's `game` folder |
| `CK3_CORPUS` | The folder holding the pinned copy of the test mods |
| `CK3_CORPUS_SLUGS` | Which test mods to run, comma-separated; all when unset |
