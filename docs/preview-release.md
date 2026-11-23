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

> **pychivalry 0.1.0 is a preview** of the rebuilt pychivalry, a VS Code extension for Crusader
> Kings III modding: it tells you, and the AI you use, what the game itself would say about your
> mod's script. It is not 1.0.0: it will change, and it is installed and updated by hand. It is a
> new extension, `cyborgninja21.pychivalry`, not an update of `ck3-language-support` 2.3.0;
> disable that one for a mod you open with this.
>
> **What works.** Checks while you type and for the whole mod in the background, every error and
> warning resting on the game's own evidence (game 1.21.0.3); hover with the game's own
> description, completion of what is valid where you type, go to definition, find references
> and the outline. VS Code's own AI sees pychivalry's tools as soon as it is installed; for
> Claude Code, run "pychivalry: Set up for Claude Code" once in your mod's folder. In VS Code's
> terminal, `pychivalry check .`, `lookup` and `explain`, with no Node of your own. The editor,
> the command line and the agent server report the same findings.
>
> **Not yet.** Formatting and quick fixes, skills for writing content, GUI files, the call
> graph, the game's error log and the CK3 Explorer views come with later steps; two checks wait
> on the spec package. Linux and Windows are tested, macOS is not; the game must be on the same
> computer.
>
> **Installing.** Download `pychivalry-0.1.0.vsix` below. In VS Code 1.146 or later: Extensions
> view, `...`, "Install from VSIX...". Open your mod's folder; if the game is not in a Steam
> library, set `pychivalry.gamePath` to its `game` folder.
>
> pychivalry holds no API key, token or login and makes no network or model call. Please report
> what goes wrong on the issues page.
