# pychivalry: MVP

Status: draft for review, 2026-11-21. Nothing in this document is built yet.

## What pychivalry is

pychivalry tells a Crusader Kings 3 modder, and any AI agent working on a mod, what the game
itself would say about their script, and helps them write script the game accepts.

It is rebuilt from the ground up. Release 2.3.0 is the last version of the old code, which now
lives unchanged in `legacy/`.

## Decisions already made

| Decision | Choice |
| --- | --- |
| Language | TypeScript throughout. |
| Old code | Clean rewrite. `legacy/` is a reference for lessons and test cases; nothing is copied across. |
| Core features | Engine-true errors, a command-line checker and the everyday editor features are all core. None is deferred. |
| AI | AI first, in four senses (see [AI first](#ai-first)). |
| Source of truth | The reverse-engineered spec package from `pdx-parser-re`. Vocabulary is never scraped from the wiki or from game files. |
| Derived names | A name the derivation produced is never dropped because the game's own documentation omits it. The doubt is documented instead. |

## Principles

1. **The engine is the authority.** An error or a warning exists only when there is evidence the
   game raises it: a message in the spec's error catalogue, a required schema field, the game's
   `script_docs` output, or a reproduced in-game error. Conventions are information; style is a
   hint.
2. **One core, many surfaces.** Parsing, indexing, checking and lookup live in one package with
   no dependencies and no knowledge of VS Code. The editor, the command line and the agent
   server are thin shells over it and give the same answers.
3. **Every answer is structured first.** The core returns data (code, severity, range, the
   evidence behind the finding, a suggested fix where one exists). Text for a person is a
   rendering of that data. This is what makes the tool usable by an agent.
4. **Tests decide, not a person.** A change is correct when the acceptance suites pass. No step
   of development needs a human to look at an editor.
5. **Fast enough to run on every keystroke and on every agent turn.** Budgets are in
   [Definition of done](#definition-of-done).

## AI first

"AI first" means all four of the following, and each one changes what is built.

### 1. Built for AI agents to use

An agent can do everything the editor can, without an editor.

- **MCP server** (`pychivalry mcp`), with tools for: check a file or a whole mod; look up a
  trigger, effect, scope, modifier or record field (what it is, where it is valid, what it
  takes); find a definition and its references; list a mod's events, decisions, scripted
  effects and so on; explain a diagnostic code with its evidence; format a file.
- **Command line** (`pychivalry check <mod> --vanilla <game> --json`), with the same findings as
  the editor and an exit code that says whether there are errors.
- Results are sized for a context window: counts and the most severe findings first, with
  paging for the rest.

### 2. AI help inside VS Code

The extension gives the editor's own AI chat CK3 knowledge instead of guesses.

- The core's lookups and checks are registered as language-model tools, so the chat can call
  them.
- A `@ck3` chat participant with three commands: explain this error, fix this error, and write
  new content (see sense 4).
- Quick fixes on diagnostics come from the same fix data an agent receives.

pychivalry holds no model and no API key. It uses whichever model the user's editor or agent
already has.

### 3. Built by AI agents

The repository is laid out so that agents do the development and can prove their own work.

- The spec package is the input; the acceptance suites are the judge.
- `task ci` runs everything that decides pass or fail, with no display and no game install
  needed for the default run.
- An `AGENTS.md` at the root states the rules: evidence for every error, nothing dropped from
  the spec, one core, no vocabulary from outside the spec, how to add a check and its test.
- Each check is one small file with its evidence named in it and one test file beside it.

### 4. AI writes mods end to end

The headline feature: describe content, get script the game accepts.

- A **generate, check, repair loop**. The model drafts files using the lookup tools, the
  checker runs, the findings go back to the model, and the loop ends only when the checker
  reports zero errors or a round limit is reached.
- The MVP covers the content types modders write most: events (with their localization),
  decisions, scripted effects and scripted triggers. Other types follow after the MVP.
- Output is always a proposed change the person or agent reviews; nothing is written into a
  mod silently.
- Available from the `@ck3` participant in VS Code and as an MCP prompt for outside agents.

## Who it is for

| User | Surface | What they get |
| --- | --- | --- |
| A modder in VS Code | The extension | Engine-true errors, completion, hover, go to definition, AI chat that knows CK3. |
| An AI agent working on a mod | MCP server, command line | The same checks and lookups as structured data, and the authoring loop. |
| An agent or person developing pychivalry | The repository | A spec-driven core and suites that judge a change without a human. |

## Architecture

```
spec package (from pdx-parser-re)
        |
  packages/core        parse, index, check, lookup, format, fix data. No dependencies.
        |
  +-----+---------+-----------+--------------+
  |               |           |              |
packages/cli   packages/mcp   packages/lsp   packages/author
command line   agent server   language       generate, check, repair loop
                              server         (model supplied by the caller)
                                 |
                          packages/vscode
                          thin extension: starts the server, registers the
                          chat participant and the language-model tools
```

Rules that keep it honest:

- Only `packages/core` knows CK3. The others translate between the core and a protocol.
- `packages/vscode` contains no checking, parsing or lookup logic.
- The spec package is read at start; the core contains no hard-coded keyword lists.

## MVP scope

Everything in this section is in the MVP.

### Core

| Capability | What it means |
| --- | --- |
| Parser | Reads every script file of the base game with no errors other than the game's own typos; recovers from broken input so the editor keeps working mid-edit. |
| Workspace index | Knows every definition in the mod, the base game and its DLC folders; updates on change without re-reading everything. |
| Engine checks | Unknown triggers, effects, scopes, modifiers and fields; wrong scope for a keyword; missing required fields; undefined event targets; the error catalogue's structural checks. |
| Lookup | For any name: what it is, where it is valid, what it takes, where it is defined and used. |
| Formatter | One formatting, used by the editor, the command line and the authoring loop. |
| Fix data | Where a finding has a mechanical fix, the fix travels with the finding. |
| Localization | Reads localization files; reports missing and unused keys as information. |

### Editor (VS Code)

Diagnostics while typing and for the whole mod in the background; completion; hover; go to
definition and find references; document symbols; formatting, including on type; quick fixes;
a game-path setting with detection of the Steam default.

### Command line

`check` (text or JSON, exit code), `lookup`, `format`, `explain <code>`, and `mcp` to start the
agent server.

### Agent server (MCP)

The tools listed under [sense 1](#1-built-for-ai-agents-to-use), plus the authoring prompt.

### Authoring loop

As described under [sense 4](#4-ai-writes-mods-end-to-end).

## Not in the MVP

These existed in 2.3.0 or were planned, and come after the MVP: colour swatches and picker, the
CK3 Explorer tree view, game-log analysis, the graphics-file check, call hierarchy, selection
ranges, GUI and GFX file support beyond parsing, support for more than one game version at a
time, publishing to the VS Code Marketplace, and authoring of content types beyond the four
named above.

## Definition of done

The MVP is done when all of these hold, each proved by a suite in the repository.

1. **Base game.** Every script file of the base game parses, with no finding other than the
   game's own known typos. The scope check judges every keyword use in the base game with zero
   findings. (2.3.0 reached this on 93,665 uses; the new core must match it.)
2. **Real mods.** On the five-mod corpus used for 2.3.0, the error list equals the list of
   real defects: no false errors, none missed.
3. **Same answers everywhere.** For the same mod, the editor, the command line and the agent
   server report the same findings. One test compares all three.
4. **Agent use.** An agent with only the MCP server can find and fix a planted set of defects
   in a test mod, scored automatically.
5. **Authoring.** For a fixed set of content requests, the authoring loop ends with zero
   checker errors within its round limit. A scored run records the pass rate; the target is
   set once the first run exists.
6. **Speed.** Budgets for a single-file check, a whole-mod first pass and server start are
   written into a benchmark suite and enforced in CI. The numbers are set from the 2.3.0
   measurements in `legacy/`, as "no slower than".
7. **Development needs no human.** `task ci` passes from a clean clone with no display.

## Legacy

`legacy/` holds release 2.3.0 unchanged and still builds from inside the folder. It is used
three ways: as the behaviour to match (its acceptance records are the baseline), as a source of
test cases, and as a record of lessons. No code is copied from it. It is deleted when the new
code meets the definition of done.

## Build order

Each step ends with its suite passing; the next does not start before that.

1. Repository skeleton: workspace layout, `task ci`, `AGENTS.md`, the spec package wired in.
2. Parser, with the base-game parse suite.
3. Workspace index.
4. Engine checks and lookup, with the base-game and real-mod suites.
5. Command line, JSON output.
6. Agent server (MCP), with the planted-defect agent suite.
7. Language server and the thin VS Code extension, with the same-answers test.
8. Formatter and fix data, quick fixes.
9. Authoring loop, chat participant and language-model tools, with the scored authoring run.
10. Benchmarks enforced, `legacy/` removed, first release of the new line.

## Open decisions

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | Does the new line keep the name and extension identity `ck3-language-support`, and is the first release 3.0.0? | Existing installs either update in place or need a new install. |
| 2 | How does the spec package arrive: a published npm package, a file committed into this repo, or a git submodule of `pdx-parser-re` (which is private)? | The repo is public and must build for anyone from a clean clone. |
| 3 | One supported game version at a time, or several side by side? | Several needs a spec package per version and a way to pick one per mod. |
| 4 | Where do the base-game and corpus suites run? They need game files that cannot be in a public repo. | CI on GitHub cannot hold the game; a private runner or recorded results are the options. |
| 5 | Minimum VS Code version. Chat participants and language-model tools need a far newer editor than the `1.75` the old extension supported. | Sets who can install it. |
| 6 | Round limit and scoring for the authoring loop, and which models the scored run uses. | Defines what "the authoring loop works" means. |
| 7 | Is CI turned back on at the root now, or when step 1 lands? | The workflow moved into `legacy/` and no longer runs. |
