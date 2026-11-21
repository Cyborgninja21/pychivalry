# Reference: VS Code, Claude Code and the Model Context Protocol

The facts about the editor and the AI harnesses that the design rests on. Each was checked
against the product's own documentation on 2026-11-21. These go stale faster than anything
about the game: check again before relying on one.

## VS Code

- **Chat participants are deprecated**, as of 2026-11-18, and the harness that hosted them is
  due to be removed in February 2027. pychivalry has no chat participant.
- **An extension can register a local agent server** (MCP) that VS Code's built-in AI then
  uses. Whether VS Code forwards it to its default harness as documented is open question 4 of
  MVP.md, settled in build step 7.
- **The floor** is the release where VS Code's own AI harness is the default: 1.146, unless
  build step 7 finds an earlier one.
- **The language client** is `vscode-languageclient` 11, started as a module over IPC, so it
  runs on VS Code's own runtime on Linux and Windows and the user needs no Node of their own.
- **Extension tests** use `@vscode/test-electron`, which drives a real VS Code. On a machine
  with a desktop they run under a virtual display so no window opens.

## Claude Code

- **Claude Code does not see agent servers registered through VS Code.** It reads its own
  configuration. The extension therefore has a command, "Set up for Claude Code", that
  registers the bundled server there, and keeps the registered location working when the
  extension updates.
- **Skills** are folders of instructions a harness loads on demand. pychivalry ships three:
  explain, fix, and write content. Whether one skills folder loads in both harnesses is part of
  open question 4.
- **Scored runs** start Claude Code's command-line mode once per trial on the existing login,
  confined to the server under test plus file read and edit. The flags are in item 6.8 of
  [PLAN.md](../PLAN.md). No API key is stored anywhere.
- **VS Code's built-in AI cannot be scripted.** It is checked by hand before a release against
  a written checklist.

## The Model Context Protocol library

- The TypeScript library has two lines. The 2.x line, `@modelcontextprotocol/server`, is the
  current one (2.4.0 when checked). The 1.x line, `@modelcontextprotocol/sdk` (1.32.2 when
  checked), is in maintenance.
- pychivalry uses the 2.x line. It is pinned to an exact version by build step 6, which adds
  it.

## GitHub

- **Self-hosted runners are advised against on public repositories**, because a pull request
  from a fork could run code on the machine. This is why no runner is attached and the suites
  that need game files run as a local task that commits its records.
- **A wiki's git repository** exists only once a first page has been saved in the web
  interface. After that it is an ordinary repository; this one's wiki is generated from
  `docs/` ([wiki/README.md](../wiki/README.md)).
