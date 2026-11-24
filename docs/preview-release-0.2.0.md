# The second preview: the pre-release, drafted

Item 8.10 of [PLAN.md](PLAN.md): the second preview build, attached to a GitHub pre-release.
**This page is a draft. Nothing here is published.** A release is public the moment it is made,
so it is made only on the owner's word; until then this page holds what it would be. It is made
the way the first one was ([preview-release.md](preview-release.md#how-a-preview-is-made)): the
step's pull request merged, public CI green on Linux and Windows for that commit, `task ci` and
`task vscode:package` on a clean checkout of it, the by-hand check on Linux and Windows with that
file, then the GitHub pre-release.

## What it would be

| | |
| --- | --- |
| Tag | `v0.2.0` |
| Title | pychivalry 0.2.0 (preview) |
| Marked | Pre-release |
| Commit | The merge of step 8 into `main` (not yet made) |
| Attached | `pychivalry-0.2.0.vsix`, its SHA-256 written here when it is built from that commit |

The extension's version is `0.2.0` and its manifest still says `"preview": true`.

## What is new since 0.1.0

- **Formatting.** One formatting for every CK3 script and localization file, by the rules the
  owner decided ([formatting.md](formatting.md)): Format Document, Format Selection and on-type
  formatting in VS Code; `pychivalry format` in the terminal; a `format` tool for AI agents. It
  never changes a word, number, quoted text or comment, and leaves a file with a parse error as
  it is.
- **Formatting findings.** A file not in the format is a `style/` warning, each untidy place a
  hint, each with a safe fix.
- **Quick fixes and fix data.** Every finding carries its mechanical fix, if it has one: quick
  fixes in the editor ("fix every safe ... in the file", Fix All), `pychivalry check --fix`, and
  the fixes in the agent server's `check`.
- **Inline hints and presentation data.** An event's title and an option's text beside their keys,
  the scope type after a link; snippets and field order in completion; the outline of 27 folders.
- **One copy of the game's index.** The language server lends its index of the game to the agent
  servers and the terminal's `pychivalry`, so the three hold one copy between them.

## The notes, drafted

> **pychivalry 0.2.0 is the second preview** of the rebuilt pychivalry, a VS Code extension for
> Crusader Kings III modding: it tells you, and the AI you use, what the game itself would say
> about your mod's script. It is not 1.0.0: it will change, and it is installed and updated by
> hand. It is the extension `cyborgninja21.pychivalry`, not an update of `ck3-language-support`
> 2.3.0; disable that one for a mod you open with this.
>
> **New since 0.1.0.**
>
> - **Formatting.** One formatting for every CK3 script and localization file: tabs, one space
>   between tokens, a short block or list on one line and every other block one item a line,
>   Windows line breaks and the UTF-8 byte-order mark, the game's own form. Format Document,
>   Format Selection and formatting as you type in VS Code; `pychivalry format` in the terminal
>   (`--check`, `--diff`); a `format` tool for your AI. It never changes a word, a number, quoted
>   text or a comment, and leaves a file with a syntax error as it is.
> - **Formatting findings.** A file that is not formatted shows a warning, and each place that
>   differs a hint, each with a quick fix. These rest on pychivalry's own formatting rules, not
>   on the game: the game does not care.
> - **Quick fixes.** A finding with a mechanical fix offers it: a misspelled keyword with its one
>   valid name, a removed keyword with its documented replacement, a missing `=`, a missing
>   localization key's stub, and more; Fix All applies every safe fix of a file, and
>   `pychivalry check --fix` every safe fix of the mod.
> - **Inline hints** beside an event's key (its title) and an option's (its text), and after a
>   link (the scope it leads to); snippets and field order in completion; a richer outline.
> - **Less memory.** With VS Code open, the agent servers and the terminal's `pychivalry` use the
>   language server's copy of the game's index instead of loading their own.
>
> **Not yet.** Skills for writing content, GUI files, the call graph, the game's error log and
> the CK3 Explorer views come with later steps; two checks wait on the spec package. Linux and
> Windows are tested, macOS is not; the game must be on the same computer.
>
> **Installing.** Download `pychivalry-0.2.0.vsix` below. In VS Code 1.146 or later: Extensions
> view, `...`, "Install from VSIX...". It updates 0.1.0 in place. Open your mod's folder; if the
> game is not in a Steam library, set `pychivalry.gamePath` to its `game` folder.
>
> pychivalry holds no API key, token or login and makes no network or model call. Please report
> what goes wrong on the issues page.
