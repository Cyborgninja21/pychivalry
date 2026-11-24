# Checking a preview by hand

The editor tests prove most of what the extension does in a real VS Code, on Linux and Windows,
in public CI. A few things they cannot prove: an AI harness signed in to a real account calling
pychivalry's tools, a real Claude Code reading the entry the set-up wrote, and the extension on
an ordinary desktop with the game installed. This page is the check a person makes before a
preview or a release goes out, once on Linux and once on Windows. It takes about twenty
minutes on each. How well VS Code's AI uses the skills is a longer check of its own,
[Checking the skills by hand](ai-checklist.md).

Nothing here needs a key or a login of pychivalry's own: pychivalry holds none. The AI you use
is signed in however you already signed it in.

## What you need

- VS Code **1.146 or later**, signed in to the AI you use with it (VS Code's own AI, the Copilot
  harness, is the default).
- Crusader Kings III installed through Steam, and a mod folder to open: your own, or a copy of
  one. pychivalry writes nothing into it, but a copy is the safe habit.
- Claude Code, for steps 6 and 7.
- The preview's `.vsix` file, and for step 5 a newer build of it (any later version).

## The steps

Write down for each step: what you did, what you saw, and pass or fail.

1. **Install and open a mod.** In VS Code, the Extensions view, the `...` menu, "Install from
   VSIX...", and choose the file. Open the mod's folder (the one holding `descriptor.mod`).
   - Pass: a script file shows the language "Crusader Kings 3" in the status bar; within a few
     seconds (the first time up to a minute while pychivalry reads the game) the Problems panel
     lists pychivalry's findings for the mod, each with its code, and the progress notice
     "Checking the mod" comes and goes.
2. **The editor features.** Open an event file.
   - Hover over a trigger such as `is_adult`: the game's own description appears.
   - In an `immediate = { }` block, start typing `add_`: effects are offered, and no trigger.
   - "Go to Definition" on a scripted effect or an event id the mod uses opens its definition,
     in the mod or the base game; "Find All References" lists its uses.
   - Pass: all four answer. If the game is not in a Steam library, set
     `pychivalry.gamePath` first ([Settings](settings.md)); without a game, a message says so
     once, and names the game defines are not judged.
3. **VS Code's AI sees the agent server.** Run "MCP: List Servers" from the Command Palette.
   - Pass: `pychivalry` is listed, from the extension. In the Chat view, typing `/` offers the
     three pychivalry skills (a build with the skills, from the third preview).
4. **VS Code's AI uses it.** In the chat, in agent mode, ask: "Use pychivalry's check tool on
   this mod and list the errors." Approve the tool call when VS Code asks.
   - Pass: the answer names the same errors that `pychivalry check .` prints in the integrated
     terminal (step 8). Then ask: "Use pychivalry's lookup on `add_gold`." Pass: it answers
     from the spec (the scopes it supports, what it takes).
5. **An update keeps it working.** Install the newer build's `.vsix` over the first, reload
   the window, and repeat step 4.
   - Pass: the tools still answer, and the extension's version in the Extensions view is the
     new one.
6. **Claude Code.** Run "pychivalry: Set up for Claude Code" from the Command Palette. Then, in
   a terminal in the mod's folder, start `claude` and type `/mcp`.
   - Pass: the set-up says it is done; `/mcp` lists `pychivalry` as connected. Ask Claude Code
     to run pychivalry's check: the findings are the same as in step 4. Ask "What skills are
     available?": `pychivalry-explain-error`, `pychivalry-fix-error` and
     `pychivalry-write-content` are among them (a build with the skills, from the third
     preview).
7. **The game folder setting reaches Claude Code.** Set `pychivalry.gamePath` to the game's
   `game` folder (or change it). pychivalry offers to set Claude Code up again; accept.
   - Pass: `claude mcp get pychivalry` in the mod's folder shows `--vanilla` and the folder you
     set.
8. **The command line in the terminal.** Open a new integrated terminal and run
   `pychivalry --version`, then `pychivalry check .` in the mod's folder.
   - Pass: the version prints, and the findings and their count match the Problems panel's
     (the terminal's `pychivalry` reads the game from Steam's libraries, or from `--vanilla
     <game folder>` when you pass it).
9. **One copy of the game's index** ([how it works](../shared-index.md)). With the mod still
   open, run `pychivalry check --json .` in the terminal and look at the last line.
   - Pass: its `"game"` says `"shared":true`: the language server answered. Then close VS Code
     and run the same in a plain terminal outside it: it still works, says `"shared":false`,
     and its findings are the same. With VS Code open again, a Claude Code session's check
     (step 6) gives the same findings as before, and the system monitor shows one pychivalry
     language server at about 0.7 GB or more and the agent server and the command line well
     under 0.3 GB each.

## Only on Windows

These the Windows runner in CI cannot show, because it has neither Claude Code nor the game:

- **Claude Code installed with npm** (a `claude.cmd`) and with Claude Code's own installer (a
  `claude.exe`): step 6 with each, if you have both.
- **The drive letter.** Open the mod with a lower-case drive letter in the path (for example
  from a shortcut or `code c:\mods\my-mod`); step 6 must still work: Claude Code keeps its
  entry under the folder as a terminal names it, `C:\...`.
- **Where VS Code lives across its own updates.** After VS Code updates itself, step 6's
  `/mcp` must still show pychivalry connected, and step 8 must still run.
- **The game found by Steam's libraries** with `pychivalry.gamePath` empty, on a library that
  is not on the system drive.
- **The shared index's pipe.** Step 9 on Windows, where the channel is a named pipe; and, on a
  machine with a second Windows account, that a `pychivalry check --json` run in that account,
  on the same mod, says `"shared":false` (it cannot reach the first account's language
  server, whose address file is in the first account's own folder).

## When something fails

Note the step, the VS Code and Claude Code versions (Help, About; `claude --version`), the
operating system, and the text of the "pychivalry" output channel (View, Output, choose
"pychivalry"). Report it on the repository's issues page.
