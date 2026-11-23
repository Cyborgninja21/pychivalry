# The first preview: the pre-release, drafted

Item 7.12 of [PLAN.md](PLAN.md): the first preview build, attached to a GitHub pre-release. A
release is public the moment it is made, so it is made only on the owner's word. This is the
draft for the owner to approve or change. **Nothing here has been published.**

## How it is made, once approved

1. The pull request of step 7 is merged to `main`, and public CI is green on Linux and Windows
   for that commit, both jobs.
2. On a clean checkout of that commit: `task ci`, then `task vscode:package`, which writes
   `packages/vscode/dist/pychivalry-0.1.0.vsix` (about 3.9 MB) and prints its contents.
3. The by-hand check, on Linux and on Windows ([guide/by-hand-check.md](guide/by-hand-check.md)),
   with that file.
4. A GitHub release with the tag, title and notes below, on that commit, marked **pre-release**
   (not "latest"), with the `.vsix` attached.

| | |
| --- | --- |
| Tag | `v0.1.0` |
| Title | pychivalry 0.1.0 (preview) |
| Marked | Pre-release |
| Attached | `pychivalry-0.1.0.vsix` |

The extension's version is `0.1.0` and its manifest says `"preview": true`; the tag carries the
version as it is, and the pre-release mark says it is a preview. The repository's tags so far
are `v1.0.0`, `v1.1.0` and `v2.0.0` to `v2.3.0`, all of the old project; `v0.1.0` is free.
`v1.0.0` is taken, so release 1.0.0 of the rebuild needs another tag name (a question for the
owner in [decisions.md](decisions.md#asked-awaiting-the-owner)).

## The notes

> **pychivalry 0.1.0 is a preview** of the rebuilt pychivalry: a VS Code extension for Crusader
> Kings III modding that tells you, and the AI you use, what the game itself would say about
> your mod's script. It is not 1.0.0. It will change, it is installed and updated by hand, and
> it is a new extension, `cyborgninja21.pychivalry`, not an update of `ck3-language-support`
> 2.3.0.
>
> ### What works
>
> - **Checks**, while you type and for the whole mod in the background: syntax, unknown
>   triggers, effects and links, scopes, fields and structure, event targets, localization,
>   and advice. Every error and warning rests on the game's own evidence; information and
>   hints are advice. Checked on game 1.21.0.3.
> - **Hover** with the game's own description, **completion** of what is valid where you type,
>   **go to definition**, **find references** and the **outline** of a file, across your mod and
>   the base game.
> - **The agent server for your AI.** VS Code's own AI sees pychivalry's tools (check, lookup,
>   find definitions and references, list definitions, explain a code) as soon as the extension
>   is installed. For Claude Code, run "pychivalry: Set up for Claude Code" once in your mod's
>   folder.
> - **The command line** in VS Code's terminal: `pychivalry check .`, `pychivalry lookup <name>`,
>   `pychivalry explain <code>`. No Node needed: VS Code runs it.
> - **The same answers everywhere:** the editor, the command line and the agent server report the
>   same findings for the same mod.
> - **Settings:** the game folder (found in any Steam library when left empty), the background
>   file limit, unused localization keys, and reading older files saved as Windows-1252.
>
> ### What is not in this preview
>
> - Formatting and quick fixes, skills for writing content with AI, GUI files and the graphics
>   check, the call graph, the game's error log, and the CK3 Explorer views: they come with
>   later build steps.
> - Two checks of the inventory are blocked, waiting on the spec package; a few others are built
>   in part. The check reference on the wiki says which.
> - Linux and Windows are tested; macOS is not. The game must be on the same computer as VS Code.
>
> ### Installing
>
> 1. Download `pychivalry-0.1.0.vsix` below.
> 2. In VS Code (1.146 or later): Extensions view, `...` menu, "Install from VSIX...", and choose
>    the file. Or: `code --install-extension pychivalry-0.1.0.vsix`.
> 3. Open your mod's folder. If the game is not in a Steam library, set `pychivalry.gamePath` to
>    its `game` folder.
> 4. For Claude Code: run "pychivalry: Set up for Claude Code" from the Command Palette.
>
> If you also have `ck3-language-support` 2.3.0 installed, disable it for the mod: both would
> check the same files.
>
> pychivalry holds no API key, no token and no login, and makes no network call and no model
> call. The AI is always another program that connects to it.
>
> This is a preview: please report what goes wrong on the issues page.
