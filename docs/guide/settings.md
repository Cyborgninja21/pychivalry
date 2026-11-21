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
- **Files that are not UTF-8.** pychivalry reads a script file that is not valid UTF-8 in
  full, shows each byte it cannot read as the replacement character, and says once, as
  information, that the file is not valid UTF-8; it is never an error, because the game ships
  and loads such files itself. A setting will let you name Windows-1252 as the encoding to
  read those bytes with, so their letters show correctly; the rest of the file is still read
  as UTF-8. It is off by default and
  arrives with the extension in build step 7 ([what the parser reads](../encoding.md)).
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
