# pychivalry: MVP

Status: draft, 2026-11-21. The opening decisions and the decisions raised by the review are
answered, and the scope is confirmed. Nothing in this document is built yet.

## What pychivalry is

pychivalry tells a Crusader Kings 3 modder, and any AI agent working on a mod, what the game
itself would say about their script, and helps them write script the game accepts.

It is rebuilt from the ground up. Release 2.3.0 is the last version of the old code, which now
lives unchanged in `legacy/`.

## Decisions already made

| Decision | Choice |
| --- | --- |
| Language | TypeScript throughout. |
| Old code | Clean rewrite. No code is copied from `legacy/`. Its test cases, fixtures and acceptance records are carried over as test data. |
| Core features | Engine-true errors, a command-line checker and the everyday editor features are all core. None is deferred. |
| AI | AI first, in four senses (see [AI first](#ai-first)). |
| Source of truth | The reverse-engineered spec package from `pdx-parser-re`. Vocabulary is never scraped from the wiki or from game files. |
| Derived names | A name the derivation produced is never dropped because the game's own documentation omits it. The doubt is documented instead. |
| Identity | A new extension, named `pychivalry`, starting at 1.0.0. It does not update `ck3-language-support` 2.x in place; people on 2.3.0 install the new one by hand. |
| Spec delivery | The built spec package is a file committed in this repository with its checksum. `pdx-parser-re` stays private. |
| Game versions | One game version at a time: the current one. |
| Game-file suites | The base-game and real-mod suites run on a private, self-hosted runner on a machine that has the game files. Public CI runs everything else. |
| VS Code floor | Recent editors only: new enough for chat participants and language-model tools. No fallback mode for older editors. |
| Authoring bar | The authoring loop has a round limit of 5. Its pass-rate target is set after the first scored run. |
| CI | A new root workflow arrives with the repository skeleton (build step 1). Until then nothing runs, and `legacy/` is not re-tested. |
| Marketplace | Not in the MVP. 1.0.0 ships as a downloadable file on GitHub, which means no automatic updates for its users. |
| VS Code only | pychivalry is always used through VS Code. There is always an extension; the command line and the agent server ship inside it and are never installed separately. Nothing is published to npm. |
| AI harness | The AI that uses pychivalry is Claude Code running in VS Code, or VS Code's built-in AI. The same two run the project's AI test suites. No API key is stored anywhere. |
| Authored content | Scored on validity (the checker) and on two further measures: a model judging the result against the request, and loading the content in the real game and reading its error log. |
| Game patches | The spec is re-derived on the owner's word after a patch. Until then pychivalry reports the version mismatch and keeps working. Nothing runs unattended on the analysis machine. |
| Platforms | Linux and Windows are supported and tested. macOS is untested. |
| Private runner | Thor-R7, the Windows desktop that already holds the game, the analysis tools and the mod cache. |
| Authoring order | The authoring loop is built straight after the formatter, at build step 9. |

## Principles

1. **The engine is the authority.** An error or a warning exists only when there is evidence the
   game raises it: a message in the spec's error catalogue, a required schema field, the game's
   `script_docs` output, or a reproduced in-game error. Anything else pychivalry says is its own
   advice, shown as information or a hint and labelled as advice, never as an error.
2. **One core, many surfaces.** Parsing, indexing, checking and lookup live in one package with
   no dependencies and no knowledge of VS Code. The editor, the command line and the agent
   server are thin shells over it and give the same answers.
3. **Every answer is structured first.** The core returns data (code, severity, range, the
   evidence behind the finding, a suggested fix where one exists). Text for a person is a
   rendering of that data. This is what makes the tool usable by an agent.
4. **Tests decide, not a person.** A change is correct when the acceptance suites pass. No step
   of development needs a human to look at an editor. A feature without a named suite is not in
   the MVP (see [Tests per feature](#tests-per-feature)).
5. **Fast enough to run on every keystroke and on every agent turn.** How is in
   [Speed](#speed); the budgets are in [Definition of done](#definition-of-done).

## AI first

"AI first" means all four of the following, and each one changes what is built.

### 1. Built for AI agents to use

An agent working in VS Code (Claude Code, or VS Code's built-in AI) can do everything the
editor's own features can, as structured data.

- **MCP server**, shipped inside the extension and registered by it, with tools for: check a file or a whole mod; look up a
  trigger, effect, scope, modifier or record field (what it is, where it is valid, what it
  takes); find a definition and its references; list a mod's events, decisions, scripted
  effects and so on; show what calls a scripted effect or trigger; analyse a game error log;
  explain a diagnostic code with its evidence; format a file.
- **Command line** (`pychivalry check <mod> --vanilla <game> --json`), bundled in the extension
  for agents and tasks running in VS Code's terminal, with the same findings as the editor and
  an exit code that says whether there are errors.
- Results are sized for a context window: counts and the most severe findings first, with
  paging for the rest.

The server's details are in [Agent server](#agent-server-mcp).

### 2. AI help inside VS Code

The extension gives the editor's own AI chat CK3 knowledge instead of guesses.

- The core's lookups and checks are registered as language-model tools, so the chat can call
  them.
- A `@ck3` chat participant with three commands: explain this error, fix this error, and write
  new content (see sense 4).
- Quick fixes on diagnostics come from the same fix data an agent receives.

pychivalry holds no model and no API key. It uses the AI already running in the user's VS
Code: Claude Code or VS Code's built-in AI. The project's own AI test runs use the same two;
see [AI tests](#ai-tests).

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
  reports zero errors or the round limit of 5 is reached.
- The MVP covers the content types modders write most: events (with their localization),
  decisions, scripted effects and scripted triggers. Other types follow after the MVP.
- Output is always a proposed change the person or agent reviews; nothing is written into a
  mod silently.
- Available from the `@ck3` participant for VS Code's built-in AI, and as an MCP prompt for
  Claude Code.

**Zero checker errors is not the same as content that works.** The checker proves the script
is valid: known names, right scopes, required fields. It does not prove an event can fire, does
what was asked, or reads sensibly. The MVP therefore scores authored content three ways:

1. **Validity.** The checker reports zero errors.
2. **Does what was asked.** A model reads the request and the result and scores the match.
3. **Loads in the game.** The content is loaded in CK3 on the private runner and the game's own
   error log is read back; the content must add no errors to it.

## Who it is for

| User | Surface | What they get |
| --- | --- | --- |
| A modder in VS Code | The extension | Engine-true errors, completion, hover, go to definition, AI chat that knows CK3. |
| An AI agent working on a mod in VS Code | The extension's MCP server and bundled command line | The same checks and lookups as structured data, and the authoring loop. |
| An agent or person developing pychivalry | The repository | A spec-driven core and suites that judge a change without a human. |

## Architecture

```text
spec package (from pdx-parser-re)
        |
  packages/core        parse, index, check, lookup, format, fix data. No dependencies.
        |
  +-----+---------+-----------+--------------+
  |               |           |              |
packages/cli   packages/mcp   packages/lsp   packages/author
command line   agent server   language       generate, check, repair loop
                              server         (model supplied by VS Code)
                                 |
                          packages/vscode
                          thin extension: bundles all of the above, starts the
                          servers, registers the agent server, the chat
                          participant and the language-model tools
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
| Parser | Reads every script file of the base game; recovers from broken input so the editor keeps working mid-edit. |
| Workspace index | Knows every definition in the mod, the base game and its DLC folders; updates on change without re-reading everything. |
| Engine checks | Unknown triggers, effects, scopes, modifiers and fields; wrong scope for a keyword; missing required fields; undefined event targets; the error catalogue's structural checks. The full list is the [check inventory](#check-inventory-and-codes). |
| Lookup | For any name: what it is, where it is valid, what it takes, where it is defined and used. |
| Formatter | One formatting, used by the editor, the command line and the authoring loop. |
| Fix data | Where a finding has a mechanical fix, the fix travels with the finding. |
| Localization | Reads localization files. Missing and unused keys are reported as pychivalry's own advice (information) unless evidence that the game reports them is recorded in the check inventory. |
| GUI and GFX files | `.gui` and `.gfx` files are parsed, indexed, checked and looked up like script files, not only parsed. |
| Graphics-file check | Warns when a referenced `.dds`, `.png` or `.tga` file exists in neither the mod, the base game nor its DLC folders. |
| Game-log analysis | Reads the game's own error log and ties each message to the file and line in the mod it is about. |
| Call graph | For a scripted effect or trigger: what calls it and what it calls. |

### Editor (VS Code)

Diagnostics while typing and for the whole mod in the background; completion; hover; go to
definition and find references; document symbols; call hierarchy; selection ranges; formatting,
including on type; quick fixes; the CK3 Explorer tree view of a mod's events, decisions,
scripted effects and the rest; the game's error log shown against the mod's files; a game-path
setting with detection of the Steam default.

### Command line

`check` (text or JSON, exit code), `lookup`, `format`, `explain <code>`, `log` (analyse a game
error log against a mod), and `mcp` to start the agent server.

### Agent server (MCP)

The tools listed under [sense 1](#1-built-for-ai-agents-to-use), plus the authoring prompt.

- **Connection.** Bundled in the extension and registered by it with VS Code, so Claude Code
  and VS Code's built-in AI find it without setup. It runs as a local process spoken to over
  standard input and output. No network port is opened.
- **Folders.** The mod folder is the open workspace and the game folder is the extension's
  game-path setting. The server
  reads only inside those two folders, and writes nothing: changes are returned as proposals.
- **Lifetime.** One long-running process per mod that holds the index in memory, so only the
  first call pays for loading the base game.
- **Stability.** Tool names, argument names and result shapes carry a version. A breaking
  change raises it, and the old shape is kept for one release.

### Authoring loop

As described under [sense 4](#4-ai-writes-mods-end-to-end).

## Check inventory and codes

The first draft named the checks in one sentence. That is not enough to build from.

- Build step 4 starts by writing `docs/checks.md`: every check the MVP ships, one row each,
  with its code, severity, the evidence for it (or the word "advice") and the legacy check it
  replaces. Its starting point is `legacy/Documentation/developer-guide/diagnostics-evidence.md`,
  the record of the October 2026 audit that reduced the plug-in catalogue to 1 error and 9
  warnings backed by game evidence.
- A check is built only if it has a row. A row without evidence can only be advice.
- **Codes are permanent.** A code is never renamed and never reused for a different finding.
  Agents, `explain` and people's suppression settings all depend on this. The naming scheme is
  chosen with the inventory, since the new identity owes nothing to the 2.x code names.

## The spec and the game

The spec package in `legacy/` was derived from the game executable of version 1.20.0.2. The
game files used for the 2.3.0 records were already 1.20.0.3. The game will be patched again
during this build.

- pychivalry records which game version and executable its spec was derived from, and reads
  which version is installed.
- When they differ, it says so once, plainly, and carries on: findings are still produced, and
  each run's output states the mismatch. It never refuses to work.
- Deriving a spec for a new game version happens in `pdx-parser-re`, on Thor-R7, and arrives
  here as a new committed file. It is started on the owner's word after a patch. Nothing detects
  a patch or starts a derivation unattended.

## Speed

Measured on release 2.3.0 (from the records in `legacy/`, five real mods of 5 to 1,313 script
files):

| Measure | 2.3.0 |
| --- | --- |
| Loading the base game before any mod file is checked | 4.2 to 6.3 seconds |
| Whole-mod check from the command line, load included | 4.2 to 10.4 seconds |
| Editor: time from start to the first complete result | 7.4 to 32.8 seconds |
| Peak memory, command line | 0.26 to 0.97 GB |
| Peak memory, language server | 0.29 to 0.75 GB |
| Base game alone: parse all 4,035 files | 32.8 seconds |

A command-line call that reloads the base game on every agent turn would cost four to six
seconds each time. The design that avoids it:

- **Long-running servers hold the index.** The language server and the agent server load the
  base game once and keep it.
- **An index cache on disk for the command line.** The base game's index is saved, keyed by
  the spec's checksum and the game executable's checksum, and reused until either changes.
- **Incremental updates.** A changed file re-checks itself and what depends on it, not the mod.

## Tests per feature

Every feature in the scope has a suite and a pass condition. `P` means it needs the private
runner (game files); `M` means it calls an AI model (see [AI tests](#ai-tests)).

| Feature | Suite | Passes when |
| --- | --- | --- |
| Parser | Base-game parse `P`; broken-input fixtures | Matches the 2.3.0 record on the base game; every fixture yields a tree and the expected errors. |
| Engine checks | Base-game `P`; real mods `P`; one fixture pair per check | Base game and real mods match their records; each check fires on its bad fixture and is silent on its good one. |
| Lookup | Golden answers for a fixed list of names | Each answer equals the recorded one, which is derived from the spec. |
| Workspace index, references, definitions | Fixture mod with known definitions and uses | Every definition and use is found, none invented; an edit updates only what depends on it. |
| Completion and hover | Fixture positions with expected items | The expected items are offered and nothing invalid at that position is. |
| Formatter, on-type formatting | Golden files; format twice | Output equals the golden file and a second pass changes nothing. |
| Quick fixes | Fixture per fix | Applying the fix removes the finding and adds none. |
| Localization | Fixture mod | Known missing and unused keys are reported, as advice. |
| GUI and GFX support | Base-game `.gui` and `.gfx` files `P`; fixtures | All base-game files parse; fixtures give the expected findings. |
| Graphics-file check | Fixture mod with present and absent files | Warns on each absent file and on none that exists in mod, base game or DLC. |
| Game-log analysis | Recorded game error logs with known sources | Each message is tied to the right file and line; unmatched messages are listed, not dropped. |
| Call graph, call hierarchy | Fixture mod | Callers and callees equal the known graph. |
| Selection ranges, document symbols | Fixture positions | Ranges and symbols equal the expected ones. |
| CK3 Explorer tree | Fixture mod and real mods `P` | Tree contents equal the index; each node opens the right file and line. |
| Same answers on every surface | One mod through editor, command line and agent server | The three finding lists are identical. Extended each time a build step adds a feature. |
| Agent use | Planted defects in a test mod `M` | An agent with only the agent server finds and fixes them; scored automatically. |
| Authoring | Fixed content requests `M`; the in-game load also `P` | Scored on validity, on the match to the request, and on loading in the game. |
| Speed | Benchmarks `P` | No slower than release 2.3.0 measured on the same runner. |

## AI tests

Two suites call an AI model: agent use and authoring.

- **The model is the one a user would have:** Claude Code running in VS Code, or VS Code's
  built-in AI. A scored run is started from such a session. No API key is stored in the
  repository, in CI or on the runner.
- These suites are **scored runs**, not pass-or-fail gates on every change. A model's output
  is not repeatable, so each request runs several times and the result is a rate.
- They run when started by a person or an agent, and before a release. They never run in CI.
- Everything else in `task ci` stays free of any model, any key and any network call.
- Each scored run records which harness and model produced it, so two runs can be compared.

## Test data

- **Base game.** Read from the game install on Thor-R7, the private runner. Never committed.
- **Real mods.** The five mods used for 2.3.0 were copied from a Steam workshop cache. They
  cannot be committed to a public repository, and they change when their authors update them.
  Thor-R7 keeps a pinned copy with a manifest (mod, workshop id, version, file count), and a
  refresh is a deliberate act that re-records the expected results. Only mods the project
  owner supplies are used.
- **Fixtures.** Small hand-written mods committed in this repository. Everything that is not
  marked `P` above runs on these alone.

## Distribution and platforms

- **One thing to install: the extension.** A downloadable file attached to each GitHub release.
  It contains the language server, the agent server and the command line. No Marketplace
  listing in the MVP, so users update by hand.
- **Nothing else is published.** No npm package and no separate command-line download.
- **Operating systems.** Linux and Windows are supported and tested in public CI. macOS is
  untested: it may work, and nothing proves it.

## Not in the MVP

These come after the MVP: colour swatches and picker, support for more than one game version at
a time, publishing to the VS Code Marketplace, macOS testing, use outside VS Code, and
authoring of content types beyond the four named above.

## Definition of done

The MVP is done when all of these hold, each proved by a suite in the repository.

1. **Every feature's suite passes.** Each row of [Tests per feature](#tests-per-feature).
2. **Base game** (private runner). The parse and check results match the 2.3.0 record: one
   parse error and 14 check errors, all in the base game's own files, each one classified
   either as a defect of the base game or as a pychivalry fault to fix. The scope check judges
   every keyword use it can with zero findings (2.3.0: 93,665 uses judged).
3. **Real mods** (private runner). On the five-mod corpus, the error list equals the list of
   real defects: no false errors, none missed.
4. **Same answers everywhere.** For the same mod, the editor, the command line and the agent
   server report the same findings.
5. **Agent use.** The scored agent run meets its target.
6. **Authoring.** The scored authoring run meets its target on all three measures. The targets
   are set once the first run exists.
7. **Speed.** No slower than release 2.3.0 measured on Thor-R7 (the figures in [Speed](#speed)
   are re-recorded there in build step 1), enforced by the benchmark suite on the runner.
8. **Development needs no human.** `task ci` passes from a clean clone with no display, no
   game files, no model and no key.

## Legacy

`legacy/` holds release 2.3.0 unchanged and still builds from inside the folder. It is used
three ways: as the behaviour to match (its acceptance records are the baseline), as a source of
test data, and as a record of lessons. No code is copied from it.

It is deleted when the new code meets the definition of done. After that, the reference for
anything not yet rebuilt, colour swatches in particular, is the tag `v2.3.0` in this
repository's history.

## Build order

Each step ends with its suites passing; the next does not start before that. The same-answers
test is extended in every step from 7 onward that adds a feature.

1. Repository skeleton: workspace layout, `task ci`, the root CI workflow (Linux and Windows),
   `AGENTS.md`, the spec package committed with its checksum, the private runner registered on
   Thor-R7 with the game files and the pinned mod corpus, and the 2.3.0 speed figures
   re-recorded on that machine as the baseline.
2. Parser, with the base-game parse suite and the broken-input fixtures.
3. Workspace index, with the on-disk cache.
4. Engine checks and lookup, in this order, each with its fixtures and the base-game suite:
   1. The check inventory, `docs/checks.md`, and the code scheme.
   2. Unknown names: triggers, effects, scopes, modifiers, fields.
   3. Scope checks.
   4. Required fields and the error catalogue's structural checks.
   5. Event targets and localization.
   6. Lookup, then the real-mod suite.
5. Command line, JSON output.
6. Agent server (MCP), with the planted-defect agent suite.
7. Language server and the thin VS Code extension, which bundles the command line and the
   agent server, with the same-answers test. **First preview build** of the extension.
8. Formatter and fix data, quick fixes. **Preview build.**
9. Authoring loop, chat participant and language-model tools, with the scored authoring run
   on its first two measures (validity and the match to the request). **Preview build.**
10. GUI and GFX file support, the graphics-file check and the call graph, on every surface.
11. Game-log analysis, on every surface. The authoring run's third measure, loading in the
    game and reading its error log, is added here because it needs this step.
12. Editor views: the CK3 Explorer tree, call hierarchy and selection ranges.
13. Benchmarks enforced, `legacy/` removed, release 1.0.0 of `pychivalry`.

## Risks

| Risk | What it would do | What limits it |
| --- | --- | --- |
| The game is patched during the build | The spec falls behind the installed game; records made on the runner shift. | Every record states the game build it was made on; the mismatch is reported, not hidden; a re-derivation is a known procedure. |
| VS Code changes its AI interfaces | The chat participant, the language-model tools and the way the agent server is registered break or need rework. pychivalry is used only through VS Code, so this reaches every AI feature. | They live only in `packages/vscode`; the core, the checks and the editor features do not depend on them. |
| One private runner, and it is a desktop | Thor-R7 hibernates after 30 idle minutes and has powered itself off mid-run before. The game-file suites and benchmarks cannot run while it is down. | A keep-awake task runs for the length of a run and is stopped after; the last results are kept as records; everything else runs in public CI. |
| The scope is a full product, not a small first version | Nothing ships for a long time. | Preview builds of the extension at steps 7, 8 and 9. |
| Model output is not repeatable | A scored run passes one day and fails the next. | Rates over several runs, with targets set from real numbers. |
| The derived spec is incomplete somewhere | A false "unknown" error on a real keyword. | Nothing is dropped from the spec; the real-mod suite demands zero false errors. |

## Open decisions

The opening decisions and the seven raised by the review were answered on 2026-11-21 and are in
[Decisions already made](#decisions-already-made). What remains is settled inside the build:

| # | Question | Settled when |
| --- | --- | --- |
| 1 | The exact minimum VS Code version. | Build step 9, from what the chat, tool and agent-server interfaces need. |
| 2 | What happens to the `ck3-language-support` 2.x listing and its users when 1.0.0 ships. | Before release 1.0.0. |
| 3 | How CK3 is started unattended on Thor-R7 for the in-game measure. | Build step 11. |
| 4 | The targets for the scored agent and authoring runs. | After the first scored runs, in build steps 6 and 9. |
