# pychivalry: MVP

Status: draft, 2026-11-21. Decisions are answered, the scope is confirmed, and every build step
has been checked against real data: the spec package, the 2.3.0 code and its records, the game
installed today, and the current VS Code, Claude Code and GitHub documentation. Build step 1,
the repository skeleton, is built; nothing else in this document is yet.

The build plan, step by step, is in [PLAN.md](PLAN.md).

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
| Source of truth | pychivalry takes its vocabulary only from the spec package produced by `pdx-parser-re`. It does not scrape the wiki and ships no name lists of its own. At run time it does read the user's installed game for names the game defines in files (traits, localization keys and the like). |
| Derived names | A name the derivation produced is never dropped because the game's own documentation omits it. The doubt is documented instead. |
| Identity | A new extension, named `pychivalry`, starting at 1.0.0. It does not update `ck3-language-support` 2.x in place; people on 2.3.0 install the new one by hand. |
| Spec delivery | The built spec package is a file committed in this repository with its checksum. `pdx-parser-re` stays private. |
| Spec version | The spec is re-derived for the current game, 1.21, before building starts. The existing spec is for 1.20.0.2. |
| Hand-kept tables | The tables 2.3.0 kept in code (about 100 entries: iterator parameters, structural keywords, block names) move into the spec package as a new format, with their evidence. The core holds none. |
| Grounding | Everything is grounded in the game: its executable, its files, its own documentation and its own output. Community tools and the wiki may supply a hint or an idea for a rule, and nothing rests on them alone. |
| Spec additions | The 1.21 spec keeps every part of the current package and adds twelve things (see [What the 1.21 spec adds](#what-the-121-spec-adds)). |
| Game dumps | The game's documentation dumps run on Thor-R7 only, started with the game's own command-line option for running a console command, not by injecting keystrokes. |
| Community tools | ck3-tiger and the CWTools rule files may be evaluated, and a rule or its logic taken where it proves true against the game. Neither is a source of vocabulary or a basis for a finding. |
| Presentation data | Outline rules, snippets, field order and inline hints return as pychivalry's own data, in a separate file in this repository. It is never used to raise an error. |
| Old rules | The 38 required-field flags and 89 rule codes of the pre-2.0 schema files are reviewed in the check inventory. Those that still hold on the 1.21 base game return as advice, never as errors or warnings. |
| Game versions | One game version at a time: the current one. |
| Game-file suites | No test runner is attached to this repository. A local task runs the suites that need game files and writes result records, which are committed. Public CI checks the records and runs everything else. |
| Machines | This laptop runs the game-file suites: it has the game and the five test mods. Thor-R7, the Windows desktop with the analysis tools, is used only to re-derive the spec and to load content in the running game. |
| VS Code floor | Recent editors only. The floor is the release where VS Code's Copilot harness is the default; 1.146 unless build step 7 finds an earlier one. |
| AI surface | One bundled agent server (MCP) plus a set of skills. It serves both Claude Code and VS Code's built-in AI. There is no chat participant and no separate set of language-model tools. |
| AI harness | The AI that uses pychivalry is Claude Code running in VS Code, or VS Code's built-in AI. No API key is stored anywhere. |
| Authoring bar | The authoring loop has a round limit of 5. Its pass-rate targets are set after the first scored run. |
| Authored content | Scored on validity (the checker) and on two further measures: a model judging the result against the request, and loading the content in the real game. |
| Authoring order | The authoring skill is built straight after the formatter, at build step 9. |
| GUI and GFX | Parse, index and navigate. Checks and lookup against a GUI vocabulary are after the MVP; the 1.21 spec work starts collecting that vocabulary. |
| Game patches | After 1.21, the spec is re-derived on the owner's word. Until then pychivalry reports the version mismatch and keeps working. Nothing runs unattended on Thor-R7. |
| Platforms | Linux and Windows are supported and tested. macOS is untested. |
| VS Code only | pychivalry is always used through VS Code. The command line and the agent server ship inside the extension and are never installed separately. Nothing is published to npm. |
| Marketplace | Not in the MVP. 1.0.0 ships as a downloadable file on GitHub, which means no automatic updates for its users. |
| CI | A new root workflow arrives with the repository skeleton (build step 1). Until then nothing runs, and `legacy/` is not re-tested. |

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
4. **Tests decide, not a person.** A change is correct when the acceptance suites pass. A
   feature without a named suite is not in the MVP (see
   [Tests per feature](#tests-per-feature)).
5. **Fast enough to run on every keystroke and on every agent turn.** How is in
   [Speed](#speed).

## AI first

"AI first" means all four of the following, and each one changes what is built.

### 1. Built for AI agents to use

An agent working in VS Code can do everything the editor's own features can, as structured
data, through the [agent server](#agent-server-mcp) and the bundled command line.

### 2. AI help inside VS Code

The extension gives the AI already running in the user's VS Code real CK3 knowledge.

- **One agent server** carries every check and lookup.
- **Skills** carry the workflows: explain this error, fix this error, write new content. A
  skill is a short set of written instructions the AI loads when the task calls for it.
- **Two ways in, one server.** VS Code's built-in AI gets the server from the extension's own
  registration. Claude Code does not read what an extension registers with VS Code; it reads
  its own configuration. The extension therefore has a command, "Set up for Claude Code", that
  adds the server and the skills to Claude Code once.
- Quick fixes on diagnostics come from the same fix data an agent receives.

pychivalry holds no model and no API key.

Why not a chat participant: VS Code deprecated chat participants on 2026-11-18. They do not
work in its default AI harness, and the older harness that still runs them is removed in
February 2027.

### 3. Built by AI agents

The repository is laid out so that agents do the development and can prove their own work.

- The spec package is the input; the acceptance suites are the judge.
- `task ci` runs everything that decides pass or fail, with no display, no game install, no
  model and no key.
- An `AGENTS.md` at the root states the rules: evidence for every error, nothing dropped from
  the spec, one core, no name lists in the code, how to add a check and its test.
- Each check is one small file with its evidence named in it and one test file beside it.

### 4. AI writes mods end to end

The headline feature: describe content, get script the game accepts.

- **The AI runs the loop; pychivalry supplies the tools and the rules.** The authoring skill
  tells the AI to draft with the lookup tools, run the checker, repair from the findings, and
  stop at zero errors or after 5 rounds. pychivalry contains no loop code of its own and never
  calls a model.
- The MVP covers the content types modders write most: events (with their localization),
  decisions, scripted effects and scripted triggers.
- The AI's edits go through its own harness, which shows them to the person for approval.
  pychivalry's server writes nothing.

**Zero checker errors is not the same as content that works.** The checker proves the script
is valid. It does not prove an event can fire, does what was asked, or reads sensibly. Authored
content is therefore scored three ways:

1. **Validity.** The checker reports zero errors.
2. **Does what was asked.** A model reads the request and the result and scores the match.
3. **Loads in the game.** The content is loaded in CK3 on Thor-R7 and the game's error log is
   compared with a log of the same game build without it. The content must add no lines that
   name its files. This proves "no new errors at load"; whether the game also reports a defect
   in content that never runs is not yet known (see [Open questions](#open-questions)).

## Who it is for

| User | Surface | What they get |
| --- | --- | --- |
| A modder in VS Code | The extension | Engine-true errors, completion, hover, go to definition, an AI that knows CK3. |
| An AI agent working on a mod in VS Code | The agent server, the skills, the bundled command line | The same checks and lookups as structured data, and the authoring workflow. |
| An agent or person developing pychivalry | The repository | A spec-driven core and suites that judge a change without a human. |

## Architecture

```text
spec package (from pdx-parser-re)
        |
  packages/core        parse, index, check, lookup, format, fix data. No dependencies.
        |
  +-----+---------+-----------+
  |               |           |
packages/cli   packages/mcp   packages/lsp        skills/
command line   agent server   language server     explain, fix, write content
  |               |           |                      |
  +---------------+-----------+----------------------+
                              |
                       packages/vscode
                       thin extension: bundles all of the above, starts the
                       servers, registers the agent server with VS Code, and
                       sets it up for Claude Code on request
```

Rules that keep it honest:

- Only `packages/core` knows CK3. The others translate between the core and a protocol.
- `packages/vscode` contains no checking, parsing or lookup logic.
- The spec package is read at start. The core contains no keyword lists; a table the checks
  need comes from the spec package or from the user's installed game.

## The spec package

Facts about the existing package, format 4, for game 1.20.0.2 (7.1 MB uncompressed):

| Part | What it holds |
| --- | --- |
| Names | 1,447 triggers, 1,007 effects, 312 links, 377 lists, 217 on-actions, 609 modifiers. |
| Descriptions | A free-text description for most triggers, effects, links and lists. None for modifiers or on-actions. No structured argument types anywhere. |
| Scope data | Which scopes a trigger or effect is valid in, from the game's own `script_docs` output. 55 triggers and 99 effects have no entry; a further 157 and 320 declare no requirement. |
| Record schemas | 185 of 227 game folders have a field list (18,234 fields, almost all an inventory of the base game's own files). The fields have a kind but no value types. Only 3 fields in the whole package are marked required. No schema for `gui`, `gfx` or `localization`. |
| Error catalogue | 1,968 message texts taken from the game executable. Text only: no severity and no condition. It includes strings that are not game errors. |

Every part of this package is kept. Release 2.3.0's engine read all of it.

### What the 1.21 spec adds

The pre-2.0 pychivalry had 32 hand-written schema files, taken from the wiki. The extractor
uses them only as hints for a field's kind and description, and keeps its own copy in
`pdx-parser-re`. They held more than the spec carries: value types on 594 fields, 737
descriptions, lists of allowed values. Release 2.3.0 no longer had those files at all. The 1.21
derivation brings that knowledge back, measured from the game where it can be:

| Addition | Source | What it enables |
| --- | --- | --- |
| The hand-kept tables (about 100 entries) | The 2.3.0 engine's code, each with its evidence | A core with no keyword lists. |
| A value type per field | How the base game writes the field; the wiki type kept beside it as a hint | "Wrong kind of value" checks; better completion. |
| Observed values per field, where the set is small | The base game | Allowed-value completion and advice. |
| How often each field is set, per record | The base game | Advice-level "usually present", without claiming the game requires it. |
| Every matching wiki description | The seed files, marked as wiki | Hover text for more than today's 272 fields. |
| Which fields hold a localization key | The base game and the seed files | The missing-key warning, without hard-coded field names. |
| A cleaned error catalogue | The existing catalogue | Non-game strings removed; each message marked as script-facing or not. |
| A structured "what it takes" for triggers and effects | The usage line in the game's own documentation output | Lookup and completion that say what a keyword accepts. |
| Where each modifier may be used | The game's documentation output, which lists a use area for all 761 modifiers. Already captured in October and left out of the package | A "modifier used in the wrong place" check with game evidence. |
| Paradox's own documentation files | 214 `.info` files shipped in the game folders, describing records field by field with value types, the scope each block receives, and defaults | The best source for value types, descriptions and scopes; ranks above the wiki. |
| Functions usable in localization and GUI | The game's data-types dump, never yet captured | Checking the bracket commands in localization; part of a GUI vocabulary. |
| A measured GUI vocabulary | The base game's 441 GUI files, which use about 2,000 distinct block names | Widget types and properties with usage counts, where today there is nothing. |

The same derivation also emits the 1.21 spec in the current format, so 2.3.0 can run on it for
the baselines.

Where sources disagree about a field, the order of trust is: the executable, then the game's
own output, then Paradox's documentation files, then what the base game's files do, then the
wiki-era hints. The package records which source each fact came from.

Other material in the game folder, used as evidence and not carried in the package:

- **Base-game localization** holds a name and description for each modifier. pychivalry reads
  it at run time for hover text, which fills the gap of modifiers having no description.
- **The command-line options file** documents how to start the game straight into a save, in
  debug mode, with a console command run at start-up.
- **The load-path settings** list which folders the game loads, which bears on override rules.
- **The Linux executable** keeps its class names, about 6,100 of which name triggers or
  effects: a second binary to cross-check derived names against.

What no derivation can supply: scope data for the triggers and effects the game itself does not
document, and descriptions for on-actions. These stay documented gaps. A GUI vocabulary taken
from the base game's files is measured, not derived from the executable, and is labelled so.

### What this means for the build

- **Required-field checks are small.** They cover the fields the spec marks, which today is 3.
  A field the base game always sets is advice, not a requirement.
- **Each structural check is written by hand** against a catalogue message. The catalogue
  supplies the wording and the evidence, not the logic. 2.3.0 implemented about 14.
- **Lookup says what the spec says.** Where the spec has nothing, lookup says so; it does not
  guess.
- 2.3.0 shipped the package compressed because of a file-size limit on commits. Step 1 decides
  compressed or raw; either way the checksum is of the uncompressed bytes and `task ci`
  verifies it.

## The game

- **Versions.** The spec is from 1.20.0.2; version 1.20 was released on 2026-09-30. Since then the game has had
  seven updates. The current version is 1.21.0.3 (2026-11-19), which followed the 1.21 release
  and its expansion on 2026-11-17.
- **On this laptop.** CK3 1.21.0.3 is installed in a second Steam library, with all five test
  mods in the Steam workshop cache. The base game has 4,482 script files in the three folders
  2.3.0 covered (2.3.0's record: 4,035), plus 441 GUI files and 12,171 localization files.
- **The 2.3.0 records cannot be reproduced.** They were made on 1.20.0.3 files. New baselines
  are recorded in build step 1 by running 2.3.0 on the current game with the 1.21 spec.
- **Mismatch.** pychivalry records which game build its spec came from and reads which is
  installed. When they differ it says so once and carries on.

## MVP scope

Everything in this section is in the MVP.

### Core

| Capability | What it means |
| --- | --- |
| Parser | Reads every script file of the base game; recovers from broken input so the editor keeps working mid-edit. Reads UTF-8 with or without a byte-order mark; the policy for anything else is written down in build step 2. |
| Workspace index | Knows every definition in the mod and in every folder of the base game and its DLC, not the seven folders 2.3.0 indexed. Follows the game's override rules. Updates on change without re-reading everything. Saved on disk between runs. |
| Engine checks | Unknown triggers, effects, scopes, modifiers and fields; wrong scope for a keyword, judged only where the spec has scope data; the 3 required fields; structural checks written against catalogue messages. The full list is the [check inventory](#check-inventory-and-codes). |
| Event targets | An undefined event target is reported as information. The base game alone has 10,523 of them. |
| Lookup | For any name: what it is, where it is valid, its description, where it is defined and used. |
| Formatter | One formatting, defined by written rules, used by the editor, the command line and the AI. It never loses a comment or a token. |
| Fix data | Where a finding has a mechanical fix, the fix travels with the finding. |
| Localization | Reads localization files. A missing key is a warning, with game evidence. Unbalanced brackets are a warning, with game evidence. An unused key is advice. |
| GUI and GFX files | A parser for GUI syntax proven on every base-game GUI file; an index of GUI types and templates; go to definition. No checks or lookup against a GUI vocabulary. |
| Graphics-file check | Warns when a referenced `.dds`, `.png` or `.tga` file exists in neither the mod, the base game nor its DLC folders. The keys it reads and its game evidence are written in the check inventory. Silent when no game folder is set. |
| Game-log analysis | Reads the game's own error log and ties each message to the file and line in the mod it is about. Lines it cannot tie are listed, not dropped. |
| Call graph | Five kinds of link: an event triggering an event, a scripted effect call, a scripted trigger call, an on-action firing an event or another on-action, and a decision firing an event. |

### Editor (VS Code)

Diagnostics while typing and for the whole mod in the background; completion; hover; go to
definition and find references; document symbols; call hierarchy; selection ranges; formatting,
including on type; quick fixes; the CK3 Explorer tree view; the game's error log shown against
the mod's files; a game-path setting that finds the game in any Steam library, not only the
default folder.

### Command line

`check`, `lookup`, `format`, `explain`, `log` and `mcp`.

- `check` keeps what 2.3.0 had, so results stay comparable: the mod folder, `--vanilla`,
  `--spec`, `--json`, and exit codes 0 (no errors), 1 (errors) and 2 (bad usage).
- JSON output is one finding per line with 2.3.0's six fields under the same names (file,
  range, severity, code, message, source), new fields added beside them, and a final summary
  line with the spec and game builds and the counts.
- Filters: by severity, by code, and a limit.
- The extension puts the command on the path of VS Code's integrated terminal.

### Agent server (MCP)

- **Tools.** About nine: check; look up names (several at once); find a definition; find
  references; list definitions of a kind; call graph; analyse a log; explain codes; format.
- **Results fit a context window.** Check returns totals by severity and by code every time,
  then findings filtered by severity and code, limited, with a cursor for the next page.
  Results stay under about 10,000 tokens; Claude Code cuts a result off at 25,000.
- **Errors are results.** Bad input comes back as a result that lists the valid values.
- **Read-only.** The server reads the mod folder and the game folder and writes nothing.
- **Connection.** A local process spoken to over standard input and output. No network port.
- **Several copies run at once.** Each AI harness starts its own copy, beside the language
  server. Each would hold its own index in memory, so all of them load the same on-disk index.
- **Stability.** The server reports its version and a schema version. A breaking change to a
  tool gets a new tool name; the protocol has no other way to version a tool.

### Skills

Three: explain an error, fix an error, write new content. Each is tested by the scored runs in
[AI tests](#ai-tests).

## Check inventory and codes

- Build step 4 starts by writing `docs/checks.md`: every check the MVP ships, one row each,
  with its code, severity, evidence (or the word "advice") and the 2.3.0 check it replaces.
- Its three sources in `legacy/`: the engine's own message codes (about 14 from the catalogue
  and 6 of its own); the plug-in catalogue `data/diagnostics.yaml` (85 codes: 1 error, 10
  warnings, 63 information, 11 hints, of which 11 have game evidence and 72 are advice); and
  `Documentation/developer-guide/diagnostics-evidence.md`, the record of the audit behind them.
- A fourth source, for advice only: the rules of the pre-2.0 schema files (38 required-field
  flags, 89 rule codes), kept in `pdx-parser-re` under `research/seeds`. Each is reviewed; one
  that still holds on the 1.21 base game returns as advice.
- A check is built only if it has a row. A row without evidence can only be advice.
- **Codes are permanent.** A code is never renamed and never reused for a different finding.
  The naming scheme is chosen with the inventory.
- **The base game's own errors.** 2.3.0 reports 1 parse error and 14 check errors in the base
  game. The parse error is a known defect in the game's files. The 14 were never classified.
  Classifying each as a game defect or a pychivalry fault is part of build step 4.

## Speed

Measured on release 2.3.0 with five real mods of 5 to 1,313 script files. These figures are
indicative only: they came from a Linux-under-Windows setup reading the game across a slow
mount, and the same run varied three to four times between attempts.

| Measure | 2.3.0 |
| --- | --- |
| Loading the base game before any mod file is checked | 4.2 to 6.3 seconds |
| Whole-mod check from the command line, load included | 4.2 to 10.4 seconds |
| Editor: time from start to the first complete result | 7.4 to 32.8 seconds |
| Peak memory, command line | 0.26 to 0.97 GB |
| Peak memory, language server | 0.29 to 0.75 GB |
| Base game alone: parse 4,035 files, then check them | 33 seconds, then 213 seconds |

The design:

- **An index on disk, shared by everything.** The base game's index is saved, keyed by the
  spec's checksum and a hash of the game's file manifest. The executable's checksum alone is
  not enough: a patch can change script files without changing the executable.
- **Long-running servers** load that index once and keep it.
- **Incremental updates.** A changed file re-checks itself and what depends on it, not the mod.

The budgets: build step 1 runs 2.3.0 on this laptop against the current game and records, for
each measure, the median of at least five runs, with a cold start and a warm start kept apart.
The rebuild must stay within a stated tolerance of those medians.
The records are in `records/baseline-2.3.0/`. The operating system's file cache cannot be dropped
without administrator rights, so each series keeps its first run, in a fresh process, apart from
the later ones instead of claiming a cold start.

## Tests per feature

`G` means the suite needs game files: it is run by the local task on this laptop and its result
is a committed record. `T` means it needs the running game on Thor-R7. `M` means it calls an AI
model (see [AI tests](#ai-tests)). Everything unmarked runs in public CI on fixtures.

| Feature | Suite | Passes when |
| --- | --- | --- |
| Parser | Base-game parse `G`; the 74 parser cases from 2.3.0; a new broken-input set, one per recovery path | Every base-game script file yields a tree; the only errors are classified game defects; every fixture gives the expected tree and errors. |
| Workspace index | Fixture mod with known definitions, uses and overrides | Every definition and use is found, none invented; overrides resolve as the game resolves them; an edit updates only what depends on it. |
| Index cache | Build, save, reload | A reloaded index answers exactly as a fresh one; a changed spec or game manifest forces a rebuild. |
| Engine checks | Base game `G`; real mods `G`; one fixture pair per check | Records match; each check fires on its bad fixture and is silent on its good one. |
| Lookup | Golden answers for a fixed list of names | Each answer equals the spec's own text; a name the spec says nothing about answers "unknown". |
| Completion and hover | Fixture positions with expected items | The expected items are offered, nothing invalid at that position is, and hover text equals the spec description. |
| Formatter | Golden files; format twice; base-game round trip `G` | Output equals the golden file, a second pass changes nothing, and every base-game file re-parses to the same tree after formatting. |
| On-type formatting | Fixture keystrokes | Agrees with the formatter on the same text. |
| Quick fixes | Fixture per fix | Applying the fix removes the finding and adds none. |
| Localization | Fixture mod | Missing keys and unbalanced brackets are warnings; unused keys are advice; entries with and without a version number are read. |
| GUI files | Base-game GUI files `G`; fixtures | Every base-game GUI file parses; types and templates are found; go to definition lands on them. |
| Graphics-file check | Fixture mod with present and absent files | Warns on each absent file and on none that exists in mod, base game or DLC. |
| Game-log analysis | Real captured logs `T` kept as fixtures | Each message is tied to the right file and line; unmatched lines are listed. |
| Call graph, call hierarchy | Fixture mod | Callers and callees equal the known graph, for all five kinds of link. |
| Selection ranges, document symbols | Fixture positions | Ranges and symbols equal the expected ones. |
| CK3 Explorer tree | Fixture mod; real mods `G` | Tree contents equal the index; each node opens the right file and line. |
| Same answers on every surface | One mod through editor, command line and agent server | The three finding lists are identical. Extended each time a build step adds a feature. |
| Agent use | Planted defects `M` | See [AI tests](#ai-tests). |
| Authoring | Fixed content requests `M`; the in-game load `T` | See [AI tests](#ai-tests). |
| Speed | Benchmarks `G` | Within the stated tolerance of the 2.3.0 medians recorded in build step 1. |

## AI tests

Two suites call an AI model. They are scored runs: each task runs several times and the result
is a rate, because a model's output is not repeatable.

- **How they run.** A script starts Claude Code's command-line mode once per trial, on the
  existing Claude login. No API key is stored. Each trial is confined to the agent server
  under test plus file read and edit, in a fresh throwaway copy of a test mod. Runs draw on
  the login's usage limits, so they are started by a person or an agent, never by CI.
- **VS Code's built-in AI cannot be scripted.** It is checked by hand before a release, against
  a short written checklist. Only the Claude Code runs are scored.
- **Agent use.** A test mod with 20 to 30 planted defects, one per check code, plus lines that
  look wrong and are not. A trial passes when the checker reports zero errors, every planted
  defect is gone, nothing outside the planted lines changed, and the look-alikes are untouched.
- **Authoring.** A fixed list of content requests. Each result is graded on validity by the
  checker and on the match to the request by a separate model call that may answer "cannot
  tell". The in-game load is the third grade once build step 11 exists.
- **Repetitions.** 5 trials per task during development, 10 before a release.
- **Each record states** the harness version, the model, the tool calls made, and the result.

## Test data

- **Base game.** Read from this laptop's game install. Never committed.
- **Real mods.** The five mods used for 2.3.0, copied from this laptop's Steam workshop cache
  into a pinned folder with a manifest (mod, workshop id, version, file count). Never
  committed. A refresh is a deliberate act that re-records the expected results. Only mods the
  project owner supplies are used.
- **Records.** Each run of the local task writes a record: the game build, the spec checksum,
  the mod manifest and the results. Records are committed, and public CI checks that they are
  present and consistent with the spec in the repository.
- **Fixtures.** Small hand-written mods committed in this repository. 2.3.0 supplies 250
  engine tests, 485 extension tests and 77 fixture files to draw on.
- **Game logs.** No real game log exists in either repository; 2.3.0's log fixture is
  hand-written and its format is unverified. Build step 11 starts by capturing real ones.

## Distribution and platforms

- **One thing to install: the extension.** A downloadable file attached to each GitHub release.
  It contains the language server, the agent server, the command line and the skills. No
  Marketplace listing in the MVP, so users update by hand.
- **Claude Code.** After installing, the user runs "Set up for Claude Code" once. The extension
  keeps the registered location working when it updates.
- **Nothing else is published.** No npm package and no separate download.
- **Operating systems.** Linux and Windows are tested in public CI on fixtures. The game-file
  suites run on Linux. macOS is untested.

## Not in the MVP

These come after the MVP: checks and lookup against a GUI vocabulary; `.asset` files; colour
swatches and picker; checking several mods together as one playset; more than one game version
at a time; the VS Code Marketplace; macOS testing; use outside VS Code; a chat participant; and
authoring of content types beyond the four named above.

## Definition of done

The MVP is done when all of these hold, each proved by a suite in the repository.

1. **Every feature's suite passes.** Each row of [Tests per feature](#tests-per-feature).
2. **Base game.** Every script and GUI file parses. Every error pychivalry reports in the base
   game is classified as a defect of the game's own files. The scope check has zero findings on
   every keyword use it can judge. 2.3.0 could judge 93,665 of 561,077 uses, about 17%; the
   rebuild judges at least as many and the record states the figure.
3. **Real mods.** On the five-mod corpus, the error list equals the list of real defects: no
   false errors, none missed. 2.3.0 reached this on all 108 of its errors.
4. **Same answers everywhere.** The editor, the command line and the agent server report the
   same findings for the same mod.
5. **Agent use.** The scored run meets its target.
6. **Authoring.** The scored run meets its targets on all three measures.
7. **Speed.** Within tolerance of the 2.3.0 medians recorded in build step 1.
8. **Development needs no human.** `task ci` passes from a clean clone with no display, no
   game files, no model and no key.

## Lessons from 2.3.0

Each of these cost false findings or time in the old code. The rebuild has a test for each.

- Classify a file by its path inside the mod, matching whole folder names. A loose match once
  produced 1,750 false errors.
- No name lists in the code. A hard-coded theme list produced 2,880 false findings.
- A colour value is not a call. `x = root` is a comparison. `always = no` is deliberate.
- Trait groups count as traits.
- Cap findings per file, and keep the most severe first when capping.
- Bound the work behind "did you mean" suggestions; one file took 6.9 seconds.
- Yield between files so the editor stays responsive; honour the background file limit.
- Closing a file keeps its diagnostics.
- Stay silent, not wrong, when no game folder is set.
- Look up files without regard to letter case, and build file addresses with the platform's own
  function, for Windows.
- Find the game in any Steam library.

## Legacy

`legacy/` holds release 2.3.0 unchanged and still builds from inside the folder. It is used
three ways: as the behaviour to match (it is run on the current game to record the baselines),
as a source of test data, and as a record of lessons. No code is copied from it.

It is deleted when the new code meets the definition of done. After that, the reference for
anything not yet rebuilt, colour swatches in particular, is the tag `v2.3.0` in this
repository's history.

## Build order

Each step ends with its suites passing; the next does not start before that. The same-answers
test is extended in every step from 7 onward that adds a feature.

**Step 0, before anything is built here: spec work.** It happens in `pdx-parser-re`, on the
owner's word. Derive the spec for game 1.21 in a new package format that keeps every current
part and adds the twelve additions listed in [What the 1.21 spec adds](#what-the-121-spec-adds).
Also emit the 1.21 spec in the current format, so 2.3.0 can run on it for the baselines. The
executable analysis needs Thor-R7; the parts that only read game files may run wherever the
1.21 files are.

1. Repository skeleton: workspace layout, `task ci`, the root CI workflow (Linux and Windows),
   `AGENTS.md`, the spec package committed with its checksum check, the local task for the
   game-file suites and its record format, the mod corpus pinned with its manifest, and the
   2.3.0 baselines recorded on this laptop.
2. Parser for script files, with the base-game parse suite, the 74 carried-over cases and the
   new broken-input set. The encoding policy is written here.
3. Workspace index. First the game's override rules are established and written down, with a
   fixture mod that exercises them. Then every base-game folder is indexed, and the index is
   saved on disk.
4. Engine checks and lookup, in this order, each with its fixtures and the base-game suite:
   1. The check inventory, `docs/checks.md`, and the code scheme.
   2. Unknown names: triggers, effects, scopes, modifiers, fields.
   3. Scope checks, where the spec has scope data.
   4. The 3 required fields and the hand-written structural checks.
   5. Event targets and localization.
   6. Lookup, the classification of the base game's own errors, then the real-mod suite.
5. Command line, with 2.3.0's output format and exit codes.
6. Agent server (MCP), with the planted-defect suite.
7. Language server and the thin VS Code extension, which bundles the command line and the
   agent server, registers the server with VS Code and sets it up for Claude Code. The VS Code
   floor is pinned here. The same-answers test starts here. **First preview build.**
8. Formatter. First its rules are written down. Then the formatter, its round-trip suite,
   on-type formatting, fix data and quick fixes. The presentation data file (outline rules,
   snippets, field order, inline hints) is added here. **Preview build.**
9. Skills: explain, fix and write content, with the scored authoring run on its first two
   measures. **Preview build.**
10. GUI files: the parser, the index of types and templates, go to definition. The
    graphics-file check. The call graph.
11. Game-log analysis. First real logs are captured on Thor-R7: the base game alone, a fixture
    mod with one planted defect per check, and each test mod. Then the matcher is built on
    them. Then the in-game load is added as the authoring run's third measure.
12. Editor views: the CK3 Explorer tree, call hierarchy and selection ranges.
13. Benchmarks enforced, `legacy/` removed, release 1.0.0 of `pychivalry`.

## Risks

| Risk | What it would do | What limits it |
| --- | --- | --- |
| The game is patched during the build | The spec falls behind again; records shift. It was updated seven times in the seven weeks after the last derivation. | Every record states its game build; the mismatch is reported, not hidden; re-derivation is a known procedure. |
| VS Code changes its AI interfaces again | It deprecated chat participants three days before this document was checked. The registration of the agent server could change next. | The AI surface is one standard agent server and plain-text skills; only `packages/vscode` touches VS Code's AI interfaces. |
| Skills or the server do not load the same way in both AI harnesses | Two sets of setup instead of one. | Build step 7 proves both with the server alone, before any skill is written. |
| Thor-R7 | It hibernates after 30 idle minutes, has powered itself off mid-run, and the game needs an unlocked desktop session there. | It is needed only for spec derivation and in-game loads; a keep-awake task runs for the length of a run. |
| The in-game load proves less than hoped | A defect in content that never runs may not be logged at load. | The measure is named for what it proves; build step 11 tests which planted defects the game reports. |
| The error-log format is not what 2.3.0 assumed | The log matcher is built on a wrong format. | Real logs are captured before the matcher is written. |
| The scope is a full product, not a small first version | Nothing ships for a long time. | Preview builds at steps 7, 8 and 9. |
| Model output is not repeatable | A scored run passes one day and fails the next. | Rates over several trials, targets set from real numbers. |
| The derived spec is incomplete somewhere | A false "unknown" error on a real keyword. | Nothing is dropped from the spec; the real-mod suite demands zero false errors. |
| Scored runs use the owner's Claude usage limits | A release-size run could be cut short. | Trial counts are fixed and small; a run records where it stopped and resumes. |

## Open questions

Each is settled by evidence inside the build, not by a choice.

| # | Question | Settled when |
| --- | --- | --- |
| 1 | The game's override rules: load order, replaced paths, DLC precedence. Neither 2.3.0 nor its documents state them. | Build step 3, from the spec work or an in-game test. |
| 2 | Whether the game reports, at load, a defect in content that never runs. | Build step 11, with the planted-defect mod. |
| 3 | The real format of the error log, when it is cleared, and what debug mode adds. | Build step 11, from captured logs. |
| 8 | Whether the game's command-line option for running a console command produces the documentation dumps unattended. | Step 0, on Thor-R7. |
| 9 | Whether ck3-tiger and the CWTools rule files hold rules worth taking, and under what licences. | Build step 4, when the check inventory is written. |
| 4 | Whether VS Code forwards an extension-registered local server to its default AI harness as documented, and whether one skills folder loads in both harnesses. | Build step 7. |
| 5 | The targets for the scored agent and authoring runs. | After the first scored runs, in build steps 6 and 9. |
| 6 | Whether the spec package is committed compressed or raw. | Build step 1. |
| 7 | What happens to the `ck3-language-support` 2.x listing and its users when 1.0.0 ships. | Before release 1.0.0. |
