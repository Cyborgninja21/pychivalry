# pychivalry: decision log

Every decision about the rebuild, with the date it was made, oldest first. The table in
[MVP.md](MVP.md#decisions-already-made) states the decisions as they stand today, in full; this
log says when each was made and records the changes since.

How it is kept:

- A new decision adds a row here and, where it changes what is being built, a row in MVP.md's
  table.
- A changed decision adds a new row here that names the row it replaces. Rows are never edited
  or removed.
- A choice an agent made while building, that the owner has not confirmed, goes in
  [Awaiting confirmation](#awaiting-confirmation) and moves to the log when it is confirmed or
  changed.
- Decisions the plan will ask for, and when, are listed in
  [PLAN.md](PLAN.md#decisions-the-plan-will-bring-to-the-owner).

## Log

| # | Date | Area | Decision |
| --- | --- | --- | --- |
| 1 | 2026-11-21 | Language | TypeScript throughout. |
| 2 | 2026-11-21 | Old code | A clean rewrite. Nothing is copied from `legacy/` as code; its tests, fixtures and records are carried over as test data. |
| 3 | 2026-11-21 | Core features | Engine-true errors, a command-line checker and the everyday editor features are all core. None is deferred. |
| 4 | 2026-11-21 | AI | AI first, in four senses: built for agents to use, AI help inside VS Code, built by agents, and AI writing mod content end to end. |
| 5 | 2026-11-21 | Identity | A new extension named `pychivalry`, starting at 1.0.0. It does not update `ck3-language-support` 2.x in place. |
| 6 | 2026-11-21 | Spec delivery | The built spec package is a file committed in this repository with its checksum. |
| 7 | 2026-11-21 | Game versions | One game version at a time: the current one. |
| 8 | 2026-11-21 | VS Code floor | Recent editors only. |
| 9 | 2026-11-21 | Authoring bar | A round limit of 5; pass-rate targets are set after the first scored run. |
| 10 | 2026-11-21 | CI | A new root workflow arrives with the repository skeleton. |
| 11 | 2026-11-21 | Scope | The CK3 Explorer tree view, game-log analysis, the graphics-file check, call hierarchy and selection ranges, and GUI and GFX file support move into the MVP. |
| 12 | 2026-11-21 | Marketplace | Not in the MVP. 1.0.0 ships as a downloadable file on GitHub. |
| 13 | 2026-11-21 | VS Code only | pychivalry is always used through VS Code. The command line and the agent server ship inside the extension. Nothing is published to npm. |
| 14 | 2026-11-21 | AI harness | The AI that uses pychivalry is Claude Code running in VS Code, or VS Code's built-in AI. No API key is stored. |
| 15 | 2026-11-21 | Authored content | Scored on validity, on a model judging the result against the request, and on loading the content in the real game. |
| 16 | 2026-11-21 | Game patches | After 1.21 the spec is re-derived on the owner's word. Nothing runs unattended on the analysis machine. |
| 17 | 2026-11-21 | Platforms | Linux and Windows are supported and tested. macOS is untested. |
| 18 | 2026-11-21 | Authoring order | The authoring skill is built straight after the formatter, at build step 9. |
| 19 | 2026-11-21 | AI surface | One bundled agent server (MCP) plus a set of skills, for both harnesses. No chat participant and no separate language-model tools. |
| 20 | 2026-11-21 | Game-file suites | No test runner is attached to this repository. A local task runs the suites that need game files and commits their records; public CI checks the records. |
| 21 | 2026-11-21 | Machines | The development laptop runs the game-file suites. The analysis machine is used only to re-derive the spec and to load content in the running game. |
| 22 | 2026-11-21 | Spec version | The spec is re-derived for the current game, 1.21, before building starts. |
| 23 | 2026-11-21 | GUI and GFX | Parse, index and navigate in the MVP. Checks against a GUI vocabulary come after it. |
| 24 | 2026-11-21 | Hand-kept tables | The tables 2.3.0 kept in code move into the spec package, with their evidence. The core holds none. |
| 25 | 2026-11-21 | Spec additions | The 1.21 spec keeps every part of the 1.20 package and adds twelve things. |
| 26 | 2026-11-21 | Presentation data | Outline rules, snippets, field order and inline hints return as pychivalry's own data file. It never raises an error. |
| 27 | 2026-11-21 | Old rules | The pre-2.0 required-field flags and rule codes are reviewed in the check inventory; those still true return as advice only. |
| 28 | 2026-11-21 | Source of truth | Vocabulary comes only from the spec package; at run time pychivalry also reads the user's installed game for names the game defines in files. |
| 29 | 2026-11-21 | Derived names | A derived name is never dropped because the game's own documentation omits it. The doubt is documented. |
| 30 | 2026-11-21 | Game dumps | The game's documentation dumps run on the analysis machine only, started by the game's own command-line option. |
| 31 | 2026-11-21 | Community tools | ck3-tiger and the CWTools rule files may be evaluated and a rule taken where it proves true against the game. Neither is a source of vocabulary. |
| 32 | 2026-11-21 | Grounding | Everything is grounded in the game: its executable, its files, its own documentation and its own output. |
| 33 | 2026-11-21 | Build order | Work the plan in order and build everything that does not need the 1.21 spec first: steps 1 to 3 and item 4.1. |
| 34 | 2026-11-21 | References | Reference material lives in `docs/references/`: an index of every source with its trust and copying rules, and a notes page per source. |
| 35 | 2026-11-21 | Test mods | `fixtures/` has three parts, `mods/`, `game/` and `defects/`, each with its own page, and `docs/test-data.md` explains all test data. |
| 36 | 2026-11-21 | Repository wiki | The GitHub wiki is generated from `docs/` by a task. The repository is the one source. |
| 37 | 2026-11-21 | Skeleton | The skeleton also carries contributor and security files with issue and pull-request templates, a user guide folder, a documents index, this log, editor settings files, and a corrected repository description. |

## Awaiting confirmation

Choices made by the agent that built a step, where the plan left the choice open. Each stands
until the owner changes it.

| Step | Choice | Why |
| --- | --- | --- |
| Plan | Node's built-in test runner; esbuild for bundling; one pull request per build step; publisher `cyborgninja21`. | Chosen when the plan was written; see "Technical choices" in PLAN.md. |
| Plan | `.asset` files and checking several mods together as one playset come after the MVP. | Neither is needed for the definition of done. |
| 1 | TypeScript 6.0.3, not the newer 7.0.2. | typescript-eslint 8.73.0 supports TypeScript below 6.1 only. |
| 1 | ES modules everywhere; packages named `@pychivalry/*`; every package at version 0.0.0 until release. | One module system; the version is set at release. |
| 1 | The tools behind the tasks are TypeScript in a `tools/` workspace, with `ajv` as their only dependency. | The core stays dependency-free. |
| 1 | The spec check accepts package formats 4 and 5. | Format 4 is the stand-in; format 5 is what step 0 produces. |
| 1 | A game's manifest hash lists every file with its size and hashes content only for the folders the game's own checksum manifest names; a mod's hash covers every file. | Hashing every game file is slow and the game itself treats only those folders as content. |
| 1 | The record check also refuses a record that names another corpus manifest, holds an absolute path, or states statistics that disagree with its raw values. | Each closes a way for a record to be wrong and still pass. |
| 1 | Release 2.3.0 is built for the baselines from an export of `legacy/` outside the repository. | Its scripts write into their own tree, and `legacy/` stays unchanged. |
| 1 | Speed baselines keep the first run of a series apart from the rest, and call it "first", not "cold". | The operating system's file cache cannot be dropped without administrator rights. |
| 1 | 2.3.0's base-game baseline ran with an 8 GiB heap limit. | It runs out of memory on game 1.21.0.3 under Node's default; the record says so. |
