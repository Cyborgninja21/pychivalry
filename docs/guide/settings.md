# Settings

pychivalry has five settings, in VS Code's Settings under "pychivalry" (or in `settings.json`
as `pychivalry.*`). The language server reads them, and the extension gives the agent server the
game folder; each step that adds a setting adds it here with its name, its default and what it
changes.

| Setting | Default | What it changes |
| --- | --- | --- |
| `pychivalry.gamePath` | empty | The game's `game` folder, the one holding `common/`. Empty: the game is looked for in every Steam library on Linux and Windows. When none is found, pychivalry says so once and judges no name the game defines |
| `pychivalry.background.fileLimit` | `3000` | The most files of the mod checked in the background; `0`: none. Files open in the editor are always checked |
| `pychivalry.localization.unusedKeys` | `false` | Report `localization/unused-key`, a hint for each localization key nothing uses; off by default, as in the command line and the agent server |
| `pychivalry.encoding.fallback` | `"none"` | `"windows-1252"`: read the bytes of a file that are not valid UTF-8 as Windows-1252, so their letters show correctly ([what the parser reads](../encoding.md)) |
| `pychivalry.inlayHints.enabled` | `true` | Show pychivalry's inline hints in script files: beside a record's key the localized text of its name (an event's title, a decision's name, an option's text), and after a link or an iterator the scope type it switches to. They are shown, never judged. VS Code's own `editor.inlayHints.enabled` also applies |

A value of the wrong type is ignored and the default used. Changing the game folder or the
fallback encoding reads the game again; turning `unusedKeys` on or off checks every file again.

**Where the game folder goes.** `pychivalry.gamePath` reaches every part of pychivalry in the
editor:

- the language server reads the game from it, and says once when it names no game folder (and,
  when it names the install folder, which folder inside it is the `game` folder);
- the agent server VS Code's AI starts is given it as `--vanilla <folder>` when it is an absolute
  path, and VS Code is told at once that the server's command line changed;
- Claude Code keeps the command line "Set up for Claude Code" gave it. When the setting changes
  after a set-up, pychivalry offers, once, to set that folder up again with the new one
  ([Commands](commands.md)).

The command line in the terminal does not read settings: it searches Steam's libraries, or takes
`--vanilla <game folder>`.

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
  and loads such files itself. A setting lets you name Windows-1252 as the encoding to
  read those bytes with, so their letters show correctly; the rest of the file is still read
  as UTF-8. It is off by default: `pychivalry.encoding.fallback`, above
  ([what the parser reads](../encoding.md)).
- **Where pychivalry keeps its index of the game.** pychivalry reads your installed game once
  and saves what it found, about 250 MB for game 1.21, in your own cache folder: on Windows
  `%LOCALAPPDATA%\pychivalry\Cache\index`, on Linux `~/.cache/pychivalry/index` (or under
  `$XDG_CACHE_HOME` when you set it). Nothing is written into your mod or the game folder. It is
  rebuilt by itself when the game is patched, and you can delete it at any time.
- **One copy of the game's index in memory.** While VS Code has a mod open, its language server
  lends its index of the game to pychivalry's agent servers and to `pychivalry` in the terminal,
  so that the three hold one copy between them, not one each (about 0.7 GB each for game 1.21).
  They find it through a small file in the same cache folder, beside `index` (`host/`, readable
  by you only), and talk over a local channel in that folder, a Unix socket, or on Windows a
  named pipe of your own computer: never a network port. When VS Code is closed, or a program
  cannot reach it, each loads the index itself, as before. Every program gives the same answer
  either way. To turn the sharing off, set the environment variable
  `PYCHIVALRY_SHARED_INDEX=off` for the programs (for VS Code, before you start it): each then
  loads its own copy ([how it works](../shared-index.md)).
- **No keys.** Nothing in the settings holds an API key, a token or a login, and pychivalry
  makes no network call or model call. The AI that uses pychivalry is always another program
  that connects to it: Claude Code or VS Code's built-in AI, signed in however you already
  signed it in ([the agent server](agent-server.md)).

## From source

The tasks that read the game take their locations from environment variables, not from
settings:

| Variable | Meaning |
| --- | --- |
| `CK3_GAME_PATH` | The game's `game` folder |
| `CK3_CORPUS` | The folder holding the pinned copy of the test mods |
| `CK3_CORPUS_SLUGS` | Which test mods to run, comma-separated; all when unset |
