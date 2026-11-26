# pychivalry (preview)

Crusader Kings III modding for VS Code: pychivalry tells you, and the AI you use, what the game
itself would say about your mod's script, and helps you write script the game accepts.

This is a **preview**, version 0.x. It is built from the rewrite in
[Cyborgninja21/pychivalry](https://github.com/Cyborgninja21/pychivalry) and is not on the VS Code
Marketplace: you install it from a `.vsix` file and update it by hand. Report what goes wrong on
the repository's issues page.

## What it does

- **Checks your mod as you type**, and the whole mod in the background when you open it. Errors
  and warnings carry the game's own evidence; information and hints are advice. Each code links
  to its page on the project wiki.
- **Hover** shows what the game's own documentation says about a trigger, an effect or a name
  your mod or the game defines. **Completion** offers what is valid where you are typing. **Go to
  definition**, **find references** and the **outline** of a file work across your mod and the
  base game.
- **Formatting and quick fixes.** Format Document, Format Selection and formatting as you type,
  in the one layout pychivalry gives every CK3 script and localization file; a finding with a
  mechanical fix offers it as a quick fix.
- **The agent server for your AI.** VS Code's own AI sees pychivalry's tools (check, lookup,
  find definitions and references, read the game's own text around a place, explain a code,
  format) as soon as the extension is installed. For Claude Code, run **pychivalry: Set up for
  Claude Code** once in your mod's folder, and **pychivalry: Remove from Claude Code** to undo it.
- **Skills for your AI**: explain an error, fix one, and write new content (events with their
  localization, decisions, scripted effects and scripted triggers), looking every name up first,
  then checking and repairing, at most five rounds, until the checker reports no error, and
  formatting what they write. VS Code's own AI has them from the
  extension; "Set up for Claude Code" copies them into Claude Code's own skills folder.
- **The command line in the terminal.** In VS Code's integrated terminal, `pychivalry check .`
  checks the mod in the current folder, `pychivalry lookup <name>` looks a name up,
  `pychivalry source <layer> <file> <line>` shows the game's own text around a place a result
  named, and `pychivalry explain <code>` says what a code means. You need no Node of your own:
  VS Code runs it.

pychivalry holds no API key, no token and no login, and makes no network call and no model call.

## Settings

| Setting | Default | What it changes |
| --- | --- | --- |
| `pychivalry.gamePath` | empty | The game's `game` folder. Empty: pychivalry looks in every Steam library |
| `pychivalry.background.fileLimit` | `3000` | The most files checked in the background; `0`: only open files |
| `pychivalry.localization.unusedKeys` | `true` | A hint on each localization key nothing uses; `false` hides them |
| `pychivalry.encoding.fallback` | `none` | `windows-1252` reads a file that is not valid UTF-8 as many older mods were saved |

## Requirements

VS Code 1.146 or later, on Linux or Windows, and Crusader Kings III installed on the same
computer. Without the game, pychivalry still checks your script but does not judge the names the
game defines.

## Licence

Apache-2.0.
