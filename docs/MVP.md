# pychivalry: MVP

Status: draft, 2026-11-22. Decisions are answered, the scope is confirmed, and every build step
has been checked against real data: the spec package, the 2.3.0 code and its records, the game
installed today, and the current VS Code, Claude Code and GitHub documentation. Step 0, the
spec work, is done: the 1.21.0.3 package in format 8 is committed, the override rules table
among its parts. Build step 1, the repository skeleton, is complete, with that package and the
2.3.0 baselines recorded on its format 4 copy; build step 2, the parser, is built; build step 3,
the workspace index, is built, with the override rules as data, read from the package. Build
step 4 is built: the check inventory ([checks.md](checks.md), signed off), the typed spec reader,
62 of its 78 checks (two blocked, eleven retired by their re-proof, three for steps 10 and 11),
lookup, the base-game and real-mod suites and their classifications, and the limits; build step
5, the command line, is built; build step 6, the agent server, is built: the server, the
planted-defect mod (made harder after the first test sessions), its graders and the
scored-test script. Item 6.11's first test sessions ran on the owner's word, 5 of 5 passed, and
the owner set the target: every test session passes, 10 of 10 before a release. Build step 7
is built but for its last item: the language server, the extension that starts it and
registers the agent server with VS Code's AI and Claude Code, the command line on the terminal's
path, the same-answers test, the packaged `.vsix` and its smoke test; the first preview,
0.1.0, is published as a GitHub pre-release (2026-11-23). After it the language server, the
agent servers and the command line were made to share one copy of the base game's index
([shared-index.md](shared-index.md)). Build step 8, the formatter and fixes, has started. What
waits on the owner or on the spec work is in [decisions.md](decisions.md). Nothing else in this
document is built yet.

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
| Spec delivery | The built spec package is committed in this repository as it was built, with Paradox's full `.info` text, gzipped, with the checksum of each file's uncompressed bytes. `pdx-parser-re` stays private. |
| Spec version | The spec is re-derived for the current game, 1.21, before building starts. The committed package is for 1.21.0.3, in format 8. |
| Hand-kept tables | The tables 2.3.0 kept in code (about 100 entries: iterator parameters, structural keywords, block names) move into the spec package as a new format, with their evidence. The core holds none. |
| Grounding | Everything is grounded in the game: its executable, its files, its own documentation and its own output. Community tools and the wiki may supply a hint or an idea for a rule, and nothing rests on them alone. |
| Spec additions | The 1.21 spec keeps every part of the current package and adds thirteen things (see [What the 1.21 spec adds](#what-the-121-spec-adds)). |
| Game dumps | The game's documentation dumps run on the analysis machine only, started with the game's own command-line option for running a console command, not by injecting keystrokes. |
| Community tools | ck3-tiger and the CWTools rule files may be evaluated, and a rule or its logic taken where it proves true against the game. Neither is a source of vocabulary or a basis for a finding. |
| Presentation data | Outline rules, snippets, field order and inline hints return as pychivalry's own data, in a separate file in this repository. It is never used to raise an error. |
| Old rules | The 38 required-field flags and 89 rule codes of the pre-2.0 schema files are reviewed in the check inventory. Those that still hold on the 1.21 base game return as advice, never as errors or warnings. |
| Game versions | One game version at a time: the current one. |
| Game-file suites | No test runner is attached to this repository. A local task runs the suites that need game files and writes result records, which are committed. Public CI checks the records and runs everything else. |
| Machines | This laptop runs the game-file suites: it has the game and the five test mods. The analysis machine, a Windows desktop with the analysis tools, is used only to re-derive the spec and to load content in the running game. |
| VS Code floor | Recent editors only. The floor is the release where VS Code's Copilot harness is the default: **1.146**, pinned in build step 7 (item 7.2), the lowest release on which the extension's agent server was seen forwarded to that harness (1.142 to 1.145 start no harness session without a sign-in). The owner kept it at 1.146 on 2026-11-23 (decision 88). |
| Shared index | The language server, the agent servers and the command line hold one copy of the base game's index between them, not one each (decision 87): the language server lends it; the others load their own only when it cannot answer. Every surface gives the same findings either way ([shared-index.md](shared-index.md)). |
| AI surface | One bundled agent server (MCP) plus a set of skills. It serves both Claude Code and VS Code's built-in AI. There is no chat participant and no separate set of language-model tools. |
| AI harness | The AI that uses pychivalry is always another program that connects to it: Claude Code running in VS Code, or VS Code's built-in AI, signed in however its user already signed it in. pychivalry contains no API key, no token and no login, and no shipped package makes a network call or a model call; a test in CI holds every shipped package to it. |
| AI tests | The agent-use test runs test sessions of the Claude Code already installed on the developer's machine, pinned to Opus 5.5 (`claude-opus-5-5`). Its first five test sessions ran on the owner's word of 2026-11-23, each with session limit 3: 5 of 5 passed ([tools/scored-run/README.md](../tools/scored-run/README.md#the-first-test-sessions-item-611)). The target, set by the owner from that result: every test session passes. A release run of 10 must pass all 10; a development run of 5 that passes fewer than 5 is looked into. The planted-defect mod was made harder after those sessions, which fixed it too easily to tell a better agent server from a worse one. Documents and code never describe the test in terms of money, accounts or keys. |
| Authoring bar | The authoring loop has a round limit of 5. Its pass-rate targets are set after the first scored run. |
| Authored content | Scored on validity (the checker) and on two further measures: a model judging the result against the request, and loading the content in the real game. |
| Authoring order | The authoring skill is built straight after the formatter, at build step 9. |
| GUI and GFX | Parse, index and navigate. Checks and lookup against a GUI vocabulary are after the MVP; the 1.21 spec work starts collecting that vocabulary. |
| Game patches | After 1.21, the spec is re-derived on the owner's word. Until then pychivalry reports the version mismatch and keeps working. Nothing runs unattended on the analysis machine. |
| Platforms | Linux and Windows are supported equally and both are tested. A behaviour of the game that differs between them, the letter case of file paths for one, is settled for both; nothing is left unverified on one of them. macOS is untested. |
| Layouts | In the MVP the game is on the same computer as VS Code, which is the case about nine times in ten. A game on another computer on the local network comes after the MVP (see [Where the game is](#where-the-game-is)). |
| Override rules | The rules by which one definition replaces another are data, not code: a table in the spec package, each rule with its evidence and the platforms it holds on, read out of the game executable by the spec work. The index records every definition and picks a winner only where the table has a rule that decides (settled or derived; a partial or open row decides nothing). Where it has none, pychivalry says nothing that depends on the winner. The table is the package's part D1; the stand-in table is retired. |
| VS Code only | pychivalry is always used through VS Code. The command line and the agent server ship inside the extension and are never installed separately. Nothing is published to npm. |
| Marketplace | Not in the MVP. 1.0.0 ships as a downloadable file on GitHub, which means no automatic updates for its users. |
| CI | A new root workflow arrives with the repository skeleton (build step 1). Until then nothing runs, and `legacy/` is not re-tested. |
| Encoding | A script file that is not valid UTF-8 is read and parsed in full, each bad byte the replacement character, with one information note per file, never an error or a warning. A fallback encoding (Windows-1252, off by default) can be named to decode the bad bytes of such a file, and only those. Written in [encoding.md](encoding.md). |

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

pychivalry holds no model, no API key, no token and no login, and makes no network call and no
model call: the AI is always another program that connects to it. A test in public CI holds
every shipped package to that.

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
3. **Loads in the game.** The content is loaded in CK3 on the analysis machine and the game's error log is
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
- **One copy of the base game's index.** While the extension runs, the language server lends
  its index of the base game to the agent servers and the command line on the same machine,
  over a local channel (a Unix domain socket or a Windows named pipe in the user's own folder,
  never a port), and answers their requests with their own code over a fork of it; each loads
  its own copy only when no language server answers ([shared-index.md](shared-index.md)).

### Where the game is

pychivalry reads the user's installed game: its files for the names the game defines, and later
its error log.

- **In the MVP the game is on the same computer as VS Code.** That is the case about nine times
  in ten. pychivalry finds the game in any Steam library and reads it from the local disk.
- **A game on another computer on the local network comes after the MVP.** Nothing is built or
  tested for it now, and nothing is built that would rule it out: the game folder is a setting,
  the index cache is kept on the editor's computer keyed by the game's build and file manifest,
  and no path is assumed to be in one letter case.
- **Linux and Windows are supported equally.** The game and the editor may be on either.

## The spec package

Facts about the committed package, format 8, for game 1.21.0.3 (one package file of 26.9 MB and
three companion files, 55.7 MB in all uncompressed, 3.18 MB gzipped), measured from the
package itself:

| Part | What it holds |
| --- | --- |
| Names | 1,598 triggers, 1,105 effects, 361 links, 436 lists, 233 on-actions, 778 modifiers: 4,511 rows, 4,331 distinct names, 146 in more than one bucket. |
| Descriptions | The executable's own text for 1,563 triggers, 1,028 effects, 359 links and 436 lists. None for modifiers or on-actions. A structured "what it takes" for 2,075 of the 2,703 triggers and effects. |
| Scope data | Which scopes a trigger or effect is valid in, from the game's own `script_docs` output: 2,163 trigger and 2,399 effect entries. 63 triggers and 118 effects have no entry; 181 and 363 entries declare no requirement (`none`). Where each modifier may be used, for all 778. |
| Record schemas | 198 of the 239 game folders the package lists have a field list: 8,179 fields and 14,685 sub-fields (22,864 in all), each with a measured value type and how often the base game sets it. Only 3 are marked required, all three with the game's message: `on_invalidated_desc` of casus belli types, `index` of character interaction categories, `chain` of tutorial lessons. No schema for `gui`, `gfx` or `localization`. |
| Error catalogue | 2,023 message texts taken from the game executable, each marked as script-facing or not: 257 yes, 874 no, 892 unknown. Still no condition. |

Every part of the 1.20.0.2 package is kept, with the same shape. Release 2.3.0's engine read
all of it; it runs on the same game version's format 4 copy, committed apart for the baselines
(`spec/legacy/`).

### What the 1.21 spec adds

The 1.21.0.3 package in format 8 carries all thirteen additions below, each marked built in its
`parts` list: A1 modifier use areas, A2 how often each field is set, A3 the wiki descriptions,
A4 the cleaned catalogue, A5 what triggers and effects take, B1 value types, B2 observed values,
B3 localization-key fields, C1 the `.info` files, C2 the GUI vocabulary, C3 the data-types dump
and C4 the hand-kept tables (19 tables with their evidence); and, the thirteenth, **the override
rules** (D1, 82 rows read out of the executable). It also carries the other requests of
[decisions.md](decisions.md): declarations that are not records (D2), nested and file-named
definitions (D3), keyword roles (D4), implicit localization keys (D5), the database a field's
value names (D6), the use areas of modifier blocks (D7) and the kind of block each iterator
prefix belongs in (D8). [references/spec-package.md](references/spec-package.md) has their
counts and what is still open in each.

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
| The override rules | The executable, Windows and Linux: the code behind its "overriding entry" message, its file listing and sorting, `replace_path`, the localization reader and its path lookups. [overrides.md](overrides.md) lists the rules needed and what the game's files already settle | Knowing which of two definitions is in force, on both platforms, without a list of rules in the code. |

The same derivation also emits the 1.21 spec in format 4, so 2.3.0 can run on it for the
baselines; that copy is committed in `spec/legacy/`.

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

- **Required-field checks are small.** They cover the fields the spec marks, which in 1.21.0.3
  is still 3. A field the base game always sets is advice, not a requirement.
- **Each structural check is written by hand** against a catalogue message. The catalogue
  supplies the wording and the evidence, not the logic. 2.3.0 implemented about 14.
- **Lookup says what the spec says.** Where the spec has nothing, lookup says so; it does not
  guess.
- **The package is committed compressed** (decided 2026-11-22): each file gzipped
  deterministically, the checksum of the uncompressed bytes, all verified by `task ci`,
  together with each companion and the package's JSON Schema.

## The game

- **Versions.** The spec is for 1.21.0.3 (2026-11-19), the current version, which followed the
  1.21 release and its expansion on 2026-11-17. The spec it replaced was for 1.20.0.2; the game
  had seven updates between the two.
- **On this laptop.** CK3 1.21.0.3 is installed in a second Steam library, with all five test
  mods in the Steam workshop cache. The base game has 4,482 script files in the three folders
  2.3.0 covered (2.3.0's record: 4,035), plus 441 GUI files and 12,171 localization files.
- **The 2.3.0 records cannot be reproduced.** They were made on 1.20.0.3 files. New baselines
  were recorded in build step 1 by running 2.3.0 on game 1.21.0.3 with the 1.21.0.3 spec in
  format 4 (`records/baseline-2.3.0/`).
- **Mismatch.** pychivalry records which game build its spec came from and reads which is
  installed. When they differ it says so once and carries on.

## MVP scope

Everything in this section is in the MVP.

### Core

| Capability | What it means |
| --- | --- |
| Parser | Reads every script file of the base game; recovers from broken input so the editor keeps working mid-edit. Reads UTF-8 with or without a byte-order mark; the policy for anything else is written in [encoding.md](encoding.md). |
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

- Build step 4 starts by writing [checks.md](checks.md): every check the MVP ships, one row
  each, with its code, severity, evidence (or the word "advice") and the 2.3.0 check it
  replaces. It is written and was signed off on 2026-11-21; its codes are permanent.
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
  Classifying each as a game defect or a pychivalry fault is part of build step 4. On game
  1.21.0.3 with the 1.21.0.3 spec it reports 3 parse errors and 88 check errors
  ([records/baseline-2.3.0/results-base-game.json](../records/baseline-2.3.0/results-base-game.json)).
  The rebuild reports 806 errors and 151 warnings on the same game, each classified in
  `tools/data/check-classifications.json`: 13 errors and every warning are defects of the
  game's files, 793 errors are faults of the spec package (791 in two files that are not
  script), none is a pychivalry fault ([records/game/check.json](../records/game/check.json)).

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

Recorded on 2026-11-22 (re-recorded on the format 4 copy of the format 7 package), release
2.3.0 on game 1.21.0.3 with the 1.21.0.3 spec in format 4, on
this laptop (Linux, 16 logical CPUs, 62 GiB), the median of the later runs (10 per mod on the
command line, 5 for the base game and the editor):

| Measure | balance-of-power-ui | divine-intervention | elf-destiny | rice | viet-events |
| --- | ---: | ---: | ---: | ---: | ---: |
| Script files checked | 5 | 227 | 598 | 1,313 | 67 |
| Load before any mod file is checked | 1.48 s | 6.52 s | 2.20 s | 2.95 s | 1.95 s |
| Whole-mod check, load included | 1.49 s | 17.79 s | 2.98 s | 6.08 s | 2.44 s |
| Peak memory, command line | 0.23 GiB | 2.43 GiB | 0.62 GiB | 0.95 GiB | 0.48 GiB |
| Editor: time to the first full result | 2.42 s | 18.00 s | 6.95 s | 22.47 s | 7.80 s |
| Peak memory, language server | 0.28 GiB | 2.43 GiB | 0.39 GiB | 0.74 GiB | 0.43 GiB |

The base game alone: 4,482 files parsed in 5.3 seconds, then checked in 73.5 seconds, at a peak
of 5.8 GiB, with an 8 GiB heap limit, which 2.3.0 needs on this game build.

**The rebuild's editor, build step 7** (2026-11-23, `task vscode:corpus`): the packaged
extension in a real VS Code 1.147.0 on a virtual display, opened on each mod with the game
folder set and every other setting at its default, measured by the 2.3.0 baseline's method: the
time from the extension's activation to the language server's first background pass that leaves
nothing to check, and the language server's peak resident memory then. Six runs a mod, one mod
after another in turn; the first run of the series built the base game's index cache (14.2
seconds on balance-of-power-ui, the first mod), the others loaded it. The median of the later
five runs, on the same laptop, in ordinary use (one-minute load average 3 to 4.5):

| Measure | balance-of-power-ui | divine-intervention | elf-destiny | rice | viet-events |
| --- | ---: | ---: | ---: | ---: | ---: |
| Files checked (2.3.0's) | 11 (12) | 433 (434) | 958 (960) | 2,090 (2,090) | 211 (211) |
| Editor: time to the first full result, 2.3.0 | 2.42 s | 18.00 s | 6.95 s | 22.47 s | 7.80 s |
| Editor: time to the first full result, rebuild | 2.16 s | 9.86 s | 3.35 s | 6.41 s | 2.97 s |
| Peak memory, language server, 2.3.0 | 0.28 GiB | 2.43 GiB | 0.39 GiB | 0.74 GiB | 0.43 GiB |
| Peak memory, language server, rebuild | 0.65 GiB | 1.36 GiB | 0.72 GiB | 0.87 GiB | 0.72 GiB |

The rebuild's editor is faster on all five mods, 1.8 to 3.5 times on the four larger ones, and
uses less memory on divine-intervention and more on the other four: about 0.65 GiB of every
figure is the base game's index, which the language server holds whole (the step 3 question in
decisions.md). The figures are printed by the task and written here; no record is committed
(asked in decisions.md). The tolerance against 2.3.0 is not stated yet.

The language server alone, as its own pull request measured it (#140, started by a test client,
not in VS Code): 2.22, 13.92, 4.40, 7.88 and 3.47 seconds to the first full result, at 0.73,
1.98, 0.88, 1.02 and 0.84 GiB.

## Tests per feature

`G` means the suite needs game files: it is run by the local task on this laptop and its result
is a committed record. `T` means it needs the running game on the analysis machine. `M` means it runs as test
sessions of Claude Code (see [AI tests](#ai-tests)). Everything unmarked runs in public CI on fixtures.

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

**In plain words.** pychivalry contains no API key, no token and no login, and never will. No
shipped package (`packages/core`, `cli`, `mcp`, `lsp` and `vscode`) makes a network call or a
model call: the agent server is a local program that reads mod and game files and answers
questions. The AI is always another program that connects to pychivalry: Claude Code, or VS
Code's built-in AI, signed in however its user already signed it in. The AI tests below are
developer test scripts. They are not shipped, not part of the extension, and never run by CI.
Each starts the Claude Code program already installed on the developer's machine, as a separate
test session with pychivalry's agent server attached, and grades what that session did; the
agent-use test grades it in code, on a copy of the planted-defect mod.
The script gives Claude Code no credentials and removes any key or token variable from the
session's environment. The only effect on the developer is that each test session counts
against their own Claude plan, like any session they open themselves.

Two suites run this way. They are scored runs: each task runs several times and the result is a
rate, because a model's output is not repeatable.

- **How they run.** A script starts the developer's Claude Code in its command-line mode, one
  test session per trial. Each test session is confined to the agent server under test plus file
  read and edit, in a fresh throwaway copy of a test mod, and has a session limit and a time
  limit as safety stops. Runs are started by a person, or by an agent on the owner's word,
  never by CI ([tools/scored-run/README.md](../tools/scored-run/README.md)).
- **VS Code's built-in AI cannot be scripted.** It is checked by hand before a release, against
  a short written checklist. Only the Claude Code runs are scored.
- **Agent use.** A test mod with planted defects, every error and warning code at least once,
  plus lines that look wrong and are not; hard enough that the pass rate tells a better agent
  server from a worse one: defects whose fix needs a lookup, defects that interact, defects
  fixed in another file than the finding (built: 32 defects and 29 look-alikes in 17 files, in
  `fixtures/defects/`). A trial passes when the checker reports zero errors, every planted
  defect is gone, nothing outside the planted lines changed, the look-alikes are untouched and
  nothing was deleted. The graders judge by the checker and the manifest's fix ranges, so any
  fix the checker accepts inside those ranges passes, not only the reference copy's.
- **Authoring.** A fixed list of content requests. Each result is graded on validity by the
  checker and on the match to the request by a separate model call that may answer "cannot
  tell". The in-game load is the third grade once build step 11 exists.
- **Repetitions.** 5 trials per task during development, 10 before a release.
- **The target (agent use).** Every test session passes: a release run of 10 test sessions must
  pass all 10, and a development run of 5 that passes fewer than 5 is looked into. The record
  states the target and whether the run met it.
- **Each record states** the harness version, the model, the tool calls made, and the result.
- **The first result.** Agent use, 2026-11-23: five test sessions of Claude Code 2.1.330 on
  `claude-opus-5-5`, each with session limit 3, all passed, each in about a minute
  (`records/scored/agent-use.json`). The owner set the target from it (above); the planted
  mod was then made harder, and the harder mod has not been run yet.

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
at a time; a game installed on another computer than VS Code; the VS Code Marketplace; macOS
testing; use outside VS Code; a chat participant; and
authoring of content types beyond the four named above.

## Definition of done

The MVP is done when all of these hold, each proved by a suite in the repository.

1. **Every feature's suite passes.** Each row of [Tests per feature](#tests-per-feature).
2. **Base game.** Every script and GUI file parses. Every error pychivalry reports in the base
   game is classified as a defect of the game's own files. The scope check has zero findings on
   every keyword use it can judge. 2.3.0 could judge 93,665 of 561,077 uses, about 17%; the
   rebuild judges at least as many and the record states the figure.
   *2026-11-23, after build step 4:* the scope check judges 178,395 of 610,898 uses (29.2%) with
   no finding (met). Every error is classified, but 793 of the 806 as spec-package faults, not
   game defects, until the package answers decision 73 (not yet met); none is a pychivalry
   fault. GUI files are step 10's.
3. **Real mods.** On the five-mod corpus, the error list equals the list of real defects: no
   false errors, none missed. 2.3.0 reached this on all 108 of its errors.
   *2026-11-23:* met for build step 4's checks: 844 errors, each classified a real defect with
   its reason; every error release 2.3.0 reports in three of the mods is reported at the same
   line, and its 12 in divine-intervention are false.
4. **Same answers everywhere.** The editor, the command line and the agent server report the
   same findings for the same mod.
   *2026-11-23:* the command line's findings equal the core's on each of the five mods. After
   items 6.1 to 6.6 the agent server's `check` returns exactly the core's findings on the
   fixture mods (a test), and on rice its totals equal the `game:mods` record's (the local size
   test). The editor is step 7: its language server (#140) gives, on every fixture mod and the
   planted-defect mod, each file's diagnostics equal to the one runner's findings (a test).
   After build step 7 the same-answers test holds it whole: in a real VS Code, the editor's
   findings (the language server's, and the diagnostics VS Code shows), the command line's
   `check --json` typed into its terminal, and the agent server's `check` paged to the end are
   the same findings, on the planted-defect mod in CI on Linux and Windows and on each of the
   five real mods locally (met).
5. **Agent use.** The scored run meets its target: a release run of 10 test sessions passes all
   10 ([AI tests](#ai-tests)).
   *2026-11-23:* the target is set (10 of 10). The first five test sessions passed 5 of 5 on
   the first planted mod; the harder mod that replaced it has not been run yet (not yet met).
6. **Authoring.** The scored run meets its targets on all three measures.
7. **Speed.** Within tolerance of the 2.3.0 medians recorded in build step 1.
   *2026-11-23, after build step 7:* the editor reaches its first full result faster than 2.3.0
   on all five mods; the language server's peak memory is higher on four ([Speed](#speed)).
   The tolerance is not stated yet; step 13's benchmarks settle it.
8. **Development needs no human.** `task ci` passes from a clean clone with no display, no
   game files, no model and no key.
   *2026-11-23:* a fresh clone of the step 4 integration branch passes `task ci` with
   `CK3_GAME_PATH`, `CK3_CORPUS`, `DISPLAY` and `WAYLAND_DISPLAY` unset.

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
part and adds the thirteen additions listed in [What the 1.21 spec adds](#what-the-121-spec-adds).
Also emit the 1.21 spec in the current format, so 2.3.0 can run on it for the baselines. The
executable analysis needs the analysis machine; the parts that only read game files may run wherever the
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
11. Game-log analysis. First real logs are captured on the analysis machine: the base game alone, a fixture
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
| The analysis machine | It hibernates after 30 idle minutes, has powered itself off mid-run, and the game needs an unlocked desktop session there. | It is needed only for spec derivation and in-game loads; a keep-awake task runs for the length of a run. |
| The in-game load proves less than hoped | A defect in content that never runs may not be logged at load. | The measure is named for what it proves; build step 11 tests which planted defects the game reports. |
| The error-log format is not what 2.3.0 assumed | The log matcher is built on a wrong format. | Real logs are captured before the matcher is written. |
| The scope is a full product, not a small first version | Nothing ships for a long time. | Preview builds at steps 7, 8 and 9. |
| Model output is not repeatable | A scored run passes one day and fails the next. | Rates over several trials, targets set from real numbers. |
| The derived spec is incomplete somewhere | A false "unknown" error on a real keyword. | Nothing is dropped from the spec; the real-mod suite demands zero false errors. |
| Test sessions count against the developer's own Claude plan | A release-size run could be cut short by the plan's own limits. | Trial counts are fixed and small; each test session has a session limit and a time limit; a run records where it stopped and resumes. |

## Open questions

Each is settled by evidence inside the build, not by a choice.

| # | Question | Settled when |
| --- | --- | --- |
| 1 | The game's override rules: load order, replaced paths, DLC precedence. Neither 2.3.0 nor its documents state them. | Largely answered: the spec package's part D1 (format 7, 2026-11-22) is the table, read out of the Windows executable (and the Linux one's localization reader); [overrides.md](overrides.md) says which row decides each rule. Still open: character history defined twice (a partial row), the depth of 12 folders, the folders with no row, and what holds only by rows the package marks partial or open. The in-game experiments written in overrides.md stay as a cross-check and are not run for now. |
| 2 | Whether the game reports, at load, a defect in content that never runs. | Build step 11, with the planted-defect mod. |
| 3 | The real format of the error log, when it is cleared, and what debug mode adds. | Build step 11, from captured logs. |
| 8 | Whether the game's command-line option for running a console command produces the documentation dumps unattended. | Step 0, on the analysis machine. |
| 9 | Whether ck3-tiger and the CWTools rule files hold rules worth taking, and under what licences. | Build step 4, when the check inventory is written. |
| 4 | Whether VS Code forwards an extension-registered local server to its default AI harness as documented, and whether one skills folder loads in both harnesses. | The VS Code half is answered by build step 7 (item 7.1, #142): on VS Code 1.146 and later, the definition the extension registers is forwarded unchanged to the Copilot harness, with no sign-in, on Linux and Windows; Claude Code reaches the same server through "Set up for Claude Code", and both keep working across an extension update. Whether a signed-in harness then calls the tools is the by-hand check before a release ([guide/by-hand-check.md](guide/by-hand-check.md)). The skills half is open: build step 9. |
| 5 | The targets for the scored agent and authoring runs. | After the first scored runs, in build steps 6 and 9. |
| 7 | What happens to the `ck3-language-support` 2.x listing and its users when 1.0.0 ships. | Before release 1.0.0. |

Question 6, whether the spec package is committed compressed or raw, was closed on 2026-11-22:
compressed ([decisions.md](decisions.md)).
