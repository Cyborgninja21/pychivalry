# Changelog

All notable changes to pychivalry are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog starts with the rebuild. The history of releases up to 2.3.0 is in
[`legacy/CHANGELOG.md`](legacy/CHANGELOG.md).

## [Unreleased]

### Added

- Build step 1, the repository skeleton ([docs/PLAN.md](docs/PLAN.md), items 1.1 to 1.11):
  root files, an npm workspace with the five empty packages `core`, `cli`, `mcp`, `lsp` and
  `vscode` plus `tools`, a strict shared `tsconfig.base.json`, `Taskfile.yml` with `task ci`,
  `AGENTS.md`, and a public CI workflow on Linux and Windows.
- `spec/`: the 1.20.0.2 spec package from release 2.3.0, committed as a stand-in until the
  1.21 package in format 5 arrives, with its checksum and schema; `task spec:check` verifies
  both.
- `records/`: the record format (`records/README.md`, `records/record.schema.json`) and its
  checker, `task records:check`; the local game-file suites `task game:parse`, `game:check`,
  `game:mods` and `game:bench` as stubs that write a valid, empty record.
- `records/corpus/MANIFEST.tsv`: the five-mod test corpus, pinned.
- `records/baseline-2.3.0/`: speed baselines of release 2.3.0 on game 1.21.0.3, made with
  `task baseline:prepare` and `task baseline:speed` from a build of `legacy/` outside the
  repository: per mod, the command line's load, whole-mod check and peak memory (11 runs);
  the base game's parse, check and peak memory (6 runs); per mod, the editor's time to first
  full result and the language server's peak memory under xvfb (6 runs). Each keeps its first
  run apart from the median and spread of the rest. 2.3.0's base-game script needs a heap
  limit above Node's default on this game build; the record states the one used.

- The structure every later step fills ([docs/PLAN.md](docs/PLAN.md), items 1.12 to 1.17):
  `docs/README.md`, an index of every document; `docs/decisions.md`, the decision log;
  `docs/references/`, every source with its trust and copying rules; `docs/test-data.md` and
  `fixtures/` in three parts (`mods/`, `game/`, `defects/`); `docs/guide/`, the user guide.
- The repository wiki is generated from `docs/`: `docs/wiki/manifest.json` names the pages,
  `task wiki:check` runs in `task ci`, `task wiki:build` builds them locally and
  `task wiki:publish` publishes them, leaving pages it did not write alone.
- `CONTRIBUTING.md`, `SECURITY.md`, issue forms and a pull-request template; `.editorconfig`,
  `.nvmrc` and `.vscode/`.

- Build step 2, the parser ([docs/PLAN.md](docs/PLAN.md), items 2.1 to 2.9), in
  `packages/core/src/syntax/`: decoding, a position model in UTF-16 code units with the
  byte-order mark never counted, a lexer, a syntax tree, a parser that always returns a tree
  and recovers from every error on its own path, findings in the structured shape with the
  spec catalogue's message as their evidence, and incremental re-parse after an edit. The
  parser holds no CK3 name: forms such as `rgb { }`, `list "name"` and
  `scripted_trigger name = { }` are recognised by their shape.
- `docs/encoding.md`, what the parser reads: a file that is not valid UTF-8 is read and parsed
  in full, with one information note, and can be decoded as Windows-1252 instead (the owner's
  decision of 2026-11-21); the base-game folders that hold script, with the evidence for each;
  the syntax accepted and the findings reported.
- `task game:parse` is the real base-game parse suite: 4,854 script files of game 1.21.0.3 in
  ten folders, each yielding a tree, in 5.3 seconds; its three errors are classified as defects
  of the game's own files in `tools/data/parse-classifications.json`. Its record,
  `records/game/parse.json`, also measures the encoding of all 20,530 text files of the game.
- Release 2.3.0's 74 parser cases, carried over as table fixtures; thirteen fixture mods under
  `fixtures/mods/`: one per recovery path, text cut off mid-edit, 2.3.0's `broken_syntax` mod,
  and a file that is not valid UTF-8.

- Build step 3, item 3.1 ([docs/PLAN.md](docs/PLAN.md)): `docs/overrides.md`, the game's
  override rules, from the game's own evidence: the executable's messages, Paradox's `.info`
  files, the install's layout and DLC descriptors, and a scan of the base game's files. Each
  rule is marked settled or open; each open rule has the in-game experiment that would settle
  it, written as probe mods for the analysis machine.


- Build step 3, the workspace index ([docs/PLAN.md](docs/PLAN.md), items 3.1a to 3.10), in
  `packages/core/src/index/`. The override rules are data: `spec/override-rules.json`, a
  stand-in table with its schema `spec/override-rules.schema.json`, carries only the rules
  `docs/overrides.md` marks settled, and `task spec:check` validates it. The index records
  every definition with its layer (the install's `clausewitz/`, `jomini/` and `game/` folders,
  a DLC pack, the mod), its relative path and its place, and every use of a name; it names a
  winner only where a row of the table answers, and otherwise answers "defined more than once,
  winner not known". Localization keys per language, with and without a version number.
  Incremental update names the files that use what a changed file defines. Files are found
  without regard to letter case and classified by whole folder names. The base game's index is
  cached in the user's cache folder, keyed by the spec checksum, the rules digest, the platform,
  the game build and the manifest of the files read, and written atomically.
- Fixtures for every rule of `docs/overrides.md`: the game stub `fixtures/game/override-rules`
  and the mods `override-rules`, `override-rules-replace-path` and `override-rules-folder-case`;
  and `index-definitions-and-uses`, every definition and use the index finds.
- `task game:index` and its record `records/game/index.json`: the whole base game of 1.21.0.3
  indexed (17,272 files, 3,344,507 definitions, 9,017,490 uses) in 13.5 seconds at a peak of
  1.30 GiB, its 250 MiB cache reloaded in 0.9 seconds, and each of the five corpus mods indexed
  over it. `task records:check` refuses an index record made on another rules table.

- Build step 4, item 4.1 ([docs/PLAN.md](docs/PLAN.md)): `docs/checks.md`, the check inventory
  and its code scheme, signed off by the owner on 2026-11-21; its codes are permanent. Codes are `family/name`
  (`names/unknown-trigger`), the step 2 identifiers kept as they are; 78 rows, each with its
  severity, its evidence or the word advice, the 2.3.0 code it replaces, its fixture pair, its
  build item and what it needs from the 1.21 spec. Every one of release 2.3.0's 108 codes is
  mapped to a new code or to "not carried over", with the reason. The pre-2.0 schema files' 38
  required-field flags and 89 rule codes are each counted on the 1.21.0.3 base game, with a
  verdict. Every catalogue message the inventory cites is checked against the 1.21.0.3
  executable. ck3-tiger (GPL-3.0) and the CWTools rule files (MIT) are evaluated and their
  licences recorded in `docs/references/community-tools.md`; nothing is taken from either.

- Items 1.6 and 1.11, which closes build step 1 ([docs/PLAN.md](docs/PLAN.md)): the spec
  package for game 1.21.0.3 in format 5, committed as `pdx-parser-re` built it, with Paradox's
  full `.info` text, and gzipped deterministically (the owner's decisions of 2026-11-22): the
  package file, its three companions (the `.info` documentation, the GUI vocabulary, the
  data-types dump), each with the checksum of its uncompressed bytes, and its JSON Schema
  `spec/schema.format5.json`. `task spec:check` verifies every file's checksum, format 5, every
  companion the package lists (its checksum, size, its own record and header), the package and
  the companions against the JSON Schema, and that no gzip header stores a name or a time.
- `spec/legacy/`: the same game version in format 4, which only release 2.3.0 reads, for the
  baselines; `task spec:check` verifies its checksum, format and game version.
- `records/baseline-2.3.0/results-base-game.json` and `results-mods.json`, the result baselines
  of release 2.3.0 that never existed before (`task baseline:results`): its base-game parse
  and check counts with every error (4,482 files, 3 parse errors, 96 check errors), and its
  findings on each of the five mods by code and severity, with every error (0, 12, 2, 508 and
  1 errors).

- Build step 4, item 4.2 ([docs/PLAN.md](docs/PLAN.md)): the typed spec reader in
  `packages/core/src/spec/`. It checks the SHA-256 of the package file's uncompressed bytes,
  format 5 and the version, decompresses with Node's own `zlib` (the core keeps no runtime
  dependency), exposes the package as typed data read once per process, and opens a companion
  only when it is asked for, checked against the record the package keeps of it; every lookup
  in the data-types dump returns a list. The hand-kept tables are read by a written trust rule
  in which the game's own output wins over a contradicted entry and an entry with no evidence
  raises nothing ([docs/decisions.md](docs/decisions.md), "Awaiting confirmation").
- The context reader of item 4.3, built inside item 4.2 as its prerequisite
  (`packages/core/src/check/context.ts`): which blocks of a file hold triggers, effects,
  modifiers and script values, and what each key in them is, from the package alone.
- Four engine checks, each an error on its catalogue message, with its fixture pair:
  `names/unknown-trigger`, `names/unknown-effect`, `names/unknown-link` and
  `names/unknown-modifier`. A removed keyword carries the version it went in and its
  replacement; an iterator over no list carries the list. On game 1.21.0.3 they raise 20 errors
  in the base game and, on the five corpus mods, the same errors line for line as release 2.3.0
  in these families, without its 12 false ones (docs/PLAN.md, item 4.2's "Found").
- Tests that every code the core emits has its row in `docs/checks.md` with its severity and
  evidence, and that no source file of the core writes a name of release 2.3.0's tables as a
  string (definition of done 5).
- Fixtures `names-unknown-trigger`, `names-unknown-effect`, `names-unknown-link` and
  `names-unknown-modifier`, each a `-bad` and a `-good` mod.
- Item 4.2 finished on the 1.21.0.3 spec package in format 7 (the owner's go of 2026-11-22):
  the typed reader exposes its eight new parts (D1 override rules, D2 declarations, D3 nested and
  file-named definitions, D4 keyword roles, D5 implicit localization keys, D6 field references,
  D7 modifier block areas, D8 iterator kinds), each row with its status and evidence, read once
  per process (`Spec.part`). Two more engine checks, each with its fixture pair:
  `names/unknown-on-action` (an error on the catalogue's "Unknown on action: %s", at the places
  D6 confirms name an on-action) and `names/modifier-outside-use-area` (a warning on the game's
  own modifier documentation, in the blocks D7 confirms the use area of). The iterator
  sub-cases of `names/unknown-trigger` and `names/unknown-effect` are not built: no game message
  ties them to an iterator of the wrong kind, a question for the owner.
- The rest of build step 4 and build step 5, built in parallel on the owner's word of
  2026-11-23 (decisions 70 and 72) and brought together in one integration pull request:
  - Item 4.4, the scope checks (#130): `packages/core/src/check/scope.ts` follows the scope a
    block runs in, and `scope/wrong-scope-for-trigger`, `scope/wrong-scope-for-effect` and
    `scope/link-on-wrong-scope` are errors on their catalogue messages. On the base game they
    judge 178,395 of 610,898 keyword uses and 41,022 link steps, and find nothing.
  - Item 4.5, fields and structure (#131): ten rows (`fields/unknown-field`,
    `fields/bare-value-in-record`, `fields/missing-required-field`, `fields/wrong-kind-of-value`,
    `references/unknown-key`, `structure/event-undeclared-namespace`,
    `structure/range-min-above-max`, `structure/event-non-character-shown`,
    `definitions/clash`, `definitions/not-read`).
  - Item 4.6, event targets and localization (#134): `scope/undefined-event-target`,
    `localization/missing-key`, `localization/unbalanced-brackets` and
    `localization/unused-key`; the index records saved scopes and their reads (cache format 4)
    and the runner checks `.yml` files.
  - Item 4.7, the advice checks (#133): 28 rows, each re-proved on the base game with
    `pychivalry-tools advice proof`.
  - Item 4.8, lookup (#128): `packages/core/src/lookup/`, every reading of a name, its
    definitions and uses in a workspace with what is in force, a modifier's localization, and
    "did you mean" under a work budget.
  - Build step 5, the command line (#129): `pychivalry check`, `lookup` and `explain`, text and
    JSON, with filters, exit codes and the base game's index cached on disk; the core's
    `checkWorkspace` is the one code path every surface runs.
  - Items 4.9 and 4.10: `task game:check` and `task game:mods` are the real suites, over that
    one runner, each check in a fresh process with its time and peak memory. Every error and
    warning of the base game is classified in `tools/data/check-classifications.json` (13 errors
    and 151 warnings are defects of the game's files, 793 errors faults of the spec package,
    none pychivalry's), every error of the five mods in `tools/data/mods-classifications.json`
    (844, each a real defect).
  - Item 4.11: a file reports at most 1,000 findings, its most severe first, and what is left
    out is counted (the command line's summary says so); tests that no check computes "did you
    mean" and that, without a game folder, no finding depends on a name the base game might
    define.
  - `docs/guide/checks.md`, the user guide's reference of every code this build reports,
    written from the core's check inventory by `task docs:checks` and tested against it.
- Build step 6, items 6.1 to 6.6, the agent server (`packages/mcp/`, on the owner's word,
  decision 77): an MCP server over standard input and output on `@modelcontextprotocol/server`
  2.4.0, which names itself, its version and its tool schema version (1), and whose written
  instructions say what it is for and to start with `check`. Six tools, each read-only and
  declaring the shape of what it takes and returns: `check` (totals by severity and by code
  first, then the findings at or above a minimum severity, of some codes, in a file or folder,
  a page at a time with a cursor; `localization/unused-key` with `unused_keys`), `lookup`,
  `find_definition` (by name or by a place in a file), `find_references`, `list_definitions` and
  `explain_code`. Every result stays under about 10,000 tokens, measured on a written mod of
  thousands of findings in CI and on rice over the real base game locally; bad input comes back
  as a result naming the valid values; the server writes nothing but the base game's index in
  the user's cache folder, and loads that index when it is there. `check` reports exactly the
  core's findings, through the one runner. Started as `node packages/mcp/dist/main.js` with
  `--mod`, `--vanilla` or `--no-vanilla` and `--spec`; `docs/guide/agent-server.md` says how an
  agent uses it.
- The core, for a server that keeps one index between requests: `syncMod` brings a mod indexed
  earlier up to date with its folder; the index's `nameAt`, `databases` and `definitionsOf`; the
  runner's options `only` (check some files of an indexed mod) and `workspace` (an open one).
- `pychivalry check --unused-keys`.
- Build step 6, items 6.7 to 6.10 (#136): `fixtures/defects/`, the planted-defect mod, written
  by hand, with 27 defects, one per error and warning code of this build, 10 lines that look
  wrong and are not, a manifest of where each defect is reported and which lines its fix may
  change, and a fixed reference copy, checked over a new game stub,
  `fixtures/game/planted-defects`; the five graders (`zero-errors`, `defects-gone`,
  `only-planted-lines`, `look-alikes-untouched`, `nothing-deleted`); and the scored agent-use
  test, `task scored:agent-use` ([tools/scored-run/README.md](tools/scored-run/README.md)), a
  developer's test script that is not shipped and never runs in CI. It starts the Claude Code
  already installed on the developer's machine as separate test sessions, each with
  pychivalry's agent server attached and a session limit, grades in code what each did to a copy
  of the planted mod, and writes `records/scored/agent-use.json`, which `task records:check`
  checks. pychivalry holds no key and makes no model call; each test session counts against the
  developer's own Claude plan. Every part is tested in CI against a stand-in for Claude Code,
  and the built agent server is tested on the planted mod as a test session's configuration
  starts it.
- `tools/src/no-key-no-network.test.ts`, in CI: no source file of a shipped package names a
  credential or holds a key-shaped string, imports a networking module or calls `fetch`, and
  every other module one imports is listed with its reason (the MCP library's server and its
  standard-input transport; on Windows, the game search's `reg query`).
- Item 6.11: the first test sessions of the agent-use test, on the owner's word of 2026-11-23
  (decision 81): five test sessions of Claude Code 2.1.330 on `claude-opus-5-5`, each with
  session limit 3, all five passing every grader (`records/scored/agent-use.json`); the
  analysis per session and per defect, and proposals for the agent server, in
  `tools/scored-run/README.md`. `SCORED_CONTINUE=true` adds a run's test sessions to the record
  already written when it was made the same way, so one record holds a first session and the
  ones after it.
- The owner's target for the agent-use test (decision 82): every test session passes, 10 of 10
  in a release run; a development run of 5 that passes fewer than 5 is looked into. Each task
  of a scored record states its `target` (the run, the trials needed, met or not) and the run
  prints it; `task records:check` holds it to the trials.
- Findings say what is valid (decision 83): `scope/wrong-scope-for-effect`, `-for-trigger` and
  `scope/link-on-wrong-scope` carry `links_from_scope`, the links (or chains of two) that lead
  from the current scope to the scopes the keyword or link takes, from the spec package's link
  documentation; `fields/missing-required-field` and `fields/wrong-kind-of-value` carry the
  field's measured `value_type` and the `values` the base game writes. Both are bounded. The
  command line's text shows them after the game's message (the core's `whatIsValid`); the
  agent server and the JSON output give the data. No code, severity or message changes.

- Build step 7, items 7.3 to 7.6, server side (#140): `packages/lsp/`, the language server on
  `vscode-languageserver` 11.0.1, started over IPC (or standard input and output for tests).
  Diagnostics while typing and for the whole mod in the background (a file limit, progress,
  cancellation; closing a file keeps them), equal file for file to the one runner's findings;
  completion, hover, go to definition, find references and document symbols; the game folder
  from a setting or any Steam library; four settings (`pychivalry.gamePath`,
  `pychivalry.background.fileLimit`, `pychivalry.localization.unusedKeys`,
  `pychivalry.encoding.fallback`). The core gained, additively, `checkSourceFile` and
  `checkNames` (which `checkWorkspace` now calls per file), `FileReading.fields`,
  `WorkspaceIndex.namesIn` and `filesNaming`, and completion (`completionsAt`).
- Build step 7, items 7.1, 7.2 and 7.8 (#142): `packages/vscode/`, the extension
  `cyborgninja21.pychivalry` 0.1.0, a preview, on the VS Code floor 1.146 (`engines.vscode`
  `^1.146.0`, `@types/vscode` 1.146.0). It copies the bundled agent server and its spec package
  into its global storage folder, checked by a manifest of SHA-256 sums, and registers it with
  VS Code's own AI, one local server per workspace folder, run by VS Code's own executable as
  Node; VS Code 1.146 and 1.147 forward it to the Copilot harness with no sign-in. The command
  "pychivalry: Set up for Claude Code" runs `claude mcp remove` then `claude mcp add --scope
  local`, or, without the `claude` command and only after asking, writes a project `.mcp.json`.
  Claude Code's entry keeps working across an update (0.1.0 to 0.1.1, the old folder removed, no
  VS Code running). The editor tests (`task vscode:test`, `@vscode/test-electron` 3.1.0, VS Code
  1.147.0) run in a real VS Code on a virtual display, in a CI job of their own on Linux and
  Windows; the extension's bundles are written with esbuild 0.28.2.
- Build step 7, the rest of items 7.3 to 7.11: the extension starts the language server
  (`vscode-languageclient` 11.0.1, the bundled `dist/bundle/lsp/pychivalry-lsp.mjs`, a Node
  module over IPC on VS Code's own runtime) for `ck3` and `ck3-localization` files; the four
  settings in the manifest with descriptions; the game folder setting reaches the agent server
  as `--vanilla`, VS Code's AI at once, and a Claude Code set-up made before it as an offer to set
  it up again; the command line bundled beside the agent server and put on the integrated
  terminal's path as `pychivalry` (a launcher in global storage, VS Code's environment-variable
  collection), on Linux and Windows, with no Node of the user's own. The same-answers test
  (editor, command line in a terminal, agent server paged to the end) on the planted-defect mod
  in CI and on the five real mods locally; packaging with `@vscode/vsce` 4.1.1
  (`task vscode:package`): one `.vsix` of 3.88 MB with the three bundles and the spec; a smoke
  test of the packaged file installed into a clean VS Code, on Linux and Windows;
  `task vscode:corpus`, the editor's speed and the same-answers test on the real mods; the CI
  job caches the downloaded VS Code. The language server's notice of a finished background pass
  carries its peak memory (`peakRssKib`).
- `docs/guide/by-hand-check.md`, the check a person makes on Linux and Windows before a preview
  goes out; `docs/preview-release.md`, the draft of the first preview's pre-release.
- The first preview, published on the owner's word (decision 86): the GitHub pre-release
  `v0.1.0`, "pychivalry 0.1.0 (preview)", on commit `133a9a1`, with `pychivalry-0.1.0.vsix`
  attached; `docs/preview-release.md` is now the record of what was published, and the install
  page links the download. Step 7 is done.
- Build step 8, item 8.8 (#144): `presentation/`, pychivalry's own presentation data, one JSON
  file per game folder with `_all.json`, a schema and a README, read by the language server only
  (a test holds that no check reads it): outline rules for 27 folders, 111 snippets (each raising
  no error or warning), field orders re-ranked by what the base game writes most, and inline hints
  (a record's localized name, an option's text, the scope type after a link), behind the new
  setting `pychivalry.inlayHints.enabled`. Carried over from the pre-2.0 schema files: 266
  entries, 30 corrected; 27 dropped. The bundle carries the data beside the language server.
  Fixture `presentation-outline-and-hints`.
- Build step 8, item 8.1 (#145): `docs/formatting.md`, the formatting rules, proposed for the
  owner's sign-off: 13 rules checked against the base game, 11 decisions for the owner, and what
  release 2.3.0's formatter does to the base game (it changes the tree of 3,203 of 4,842 files
  and its output does not parse in 540).
- Build step 8, items 8.6 and 8.7 (#146): every finding carries its fix as data (`fix`: null, or
  its safety, its basis and at most five alternatives of edits), a safe fix checked by checking
  the file again with it applied; the command line's JSON carries it, `check --fix` applies the
  safe fixes and checks again, and `--dry-run` shows them; the agent server's `check` carries
  them and writes nothing; the language server offers quick fixes, "fix every safe `<code>` in
  the file" and `source.fixAll`. Of the 62 built codes 4 always have a safe fix, 12 when one
  outcome is left, 10 only suggestions, 36 none (`FIX_ROWS`, the Fix column of `docs/checks.md`
  and the guide's check reference). On rice, 141 safe fixes take its errors and warnings from
  1,963 to 1,822. Fixtures `fix-near-values` and `fix-scope-links`. The three formatting fixes,
  an empty block removed, a missing `ai_chance` and the three refactors are not built.
- One shared index (decision 87, `docs/shared-index.md`): the language server lends its index of
  the base game, frozen, to the agent servers and the command line on the same machine, and
  answers their requests with their own code (the command line's `runSteps`, the agent server's
  tools) over a fork that shares every file and table of the base game; each loads its own copy
  only when no language server answers, so the three hold one copy between them. On rice, the
  largest test mod, the three programs' peak memory went from 3.02 GiB to 1.83 GiB (the medians
  of five runs and six) in all, and the editor's time to its first full result is not measurably
  worse (`docs/shared-index.md`, "Measured"). The core gained forks of an index
  (`WorkspaceIndex.fork`, a layered string table and maps), work in steps that a server runs in
  slices (`Steps`, `drainInSlices`, `checkWorkspaceSteps` and the indexing's step forms), the
  lent base game (`shareBase`, `BaseRefused`), the address file in the user's owner-only cache
  folder and the local channel (`packages/core/src/share/`); the language server's
  `pychivalry/sharing` request says what it lent; the command line's JSON summary says
  `game.shared`; `PYCHIVALRY_SHARED_INDEX=off` turns it off. Tested on Linux and Windows: the
  same answers on every fixture mod and the planted-defect mod through a fork, and every
  fallback (no lender, a lender gone, refusing, silent or dying in the middle of a request, a
  second language server taking over). The same-answers test runs with sharing on, checking that
  the language server answered the command line and every page of the agent server, and again
  with it off. `check --fix` is never sent to the language server, and the language server
  refuses one: the edits are made by the command line's own process.

- Build step 8, items 8.2 to 8.5 and 8.9: the formatter, by the rules the owner decided
  (`docs/formatting.md`, decisions 90 to 103): best practice and cleanliness over the author's
  layout. `packages/core/src/format/` keeps every token and comment and decides only the
  whitespace between tokens, from one table of layout rules: tabs, one space between tokens, no
  alignment; a block of one simple pair, a list of plain values and an empty block on one line
  when the line fits in 120 columns, every other block broken, one item a line, lines joined as
  well as split; at most one blank line; one space before an end-of-line comment; no trailing
  whitespace; Windows line breaks and the UTF-8 byte-order mark in every file. A file with a
  parse error is left untouched, with the reason; localization files get whitespace only. Format
  Selection, on-type formatting after Enter, `}` and `=`. `pychivalry format <file|folder>...`
  (in place, `--check`, `--diff`), the agent server's read-only `format` tool (tool schema
  version 2) and the language server's document, range and on-type formatting give the same
  text; the extension sets `editor.insertSpaces` false, `files.encoding` `utf8bom` and
  `files.eol` `\r\n` for CK3 files and turns a document's `\n` to `\r\n` with Format Document.
- The `style/` family (decision 103), nine new rows of `docs/checks.md`, on pychivalry's own
  formatting rules (evidence `formatting-rules`): `style/not-formatted`, a warning for each file
  not in the format, whose safe fix formats it, and a hint at each untidy place, each with a safe
  fix: `style/indentation`, `style/spacing`, `style/comment-spacing`,
  `style/trailing-whitespace`, `style/blank-lines`, `style/block-layout`, `style/line-endings`,
  `style/byte-order-mark`. A fixture pair for each.
- The formatter's round trip in `task game:parse` (item 8.3): on game 1.21.0.3 all 4,851 script
  files it formats (3 left, each with a parse error) and all 12,171 localization files keep their
  tree, tokens and comments (502,890 and 74,238, none lost or moved), and a second format changes
  nothing; the record says what it changes, by rule. Golden files under `fixtures/format/`
  (item 8.4), 21 pairs, and on-type formatting proved against them (item 8.5).
- The same-answers test covers formatting: each file of the planted-defect mod formatted by the
  editor, the command line and the agent server, with the shared index on and off, is the same.
- Four best-practice rules in the `style/` family (decisions 105 to 107), new rows of
  `docs/checks.md` on pychivalry's own best-practice rules (evidence `best-practice`), each with
  the base game's own rate and a fixture pair: `style/not-utf8`, a warning on a script or
  localization file that is not valid UTF-8, whose fix converts it to UTF-8 with the byte-order
  mark, its bad bytes read as Windows-1252 (safe when every such byte is a printable letter and
  the tree is the same; `check --fix` converts such a file first); `style/empty-block` (release
  2.3.0's CK3314) and `style/deep-nesting` (CK3317, one finding a record), hints;
  `style/unusual-field-order`, a hint with a safe fix that reorders a record's fields, comments
  with them, in the six folders whose records the game reads by name and whose base-game records
  follow the order. `pychivalry-tools advice proof` counts these rules beside the advice rows,
  with their rate and by folder. The decoder records each stretch of a file that is not valid
  UTF-8 on its note.

- `style/localization-key-characters` (decision 112), release 2.3.0's LOC-001 brought back as a
  best-practice hint: a localization key that starts with a digit or holds a character other than
  a letter, a digit, `_` or `.`; no fix. The base game: 15,406 of its 3,100,662 keys (0.50%),
  1,675 of its 340,445 English ones. A fixture pair, `style-localization-key-characters-bad` and
  `-good`. Its 2.3.0 sibling CK3872 is the row `style/redundant-condition`, blocked: part D4 of
  the spec package gives `always` and the logical operators no role, so the check would have to
  name them.
- A test that every fixture mod and the planted-defect mod are in pychivalry's format, but for
  exactly what each exists to test (`packages/core/src/format/fixtures.test.ts`), and one that
  every snippet of the presentation data, expanded as the editor inserts it, is left unchanged by
  the formatter.
- The second preview, published on the owner's word (decision 116): the GitHub pre-release
  `v0.2.0`, "pychivalry 0.2.0 (preview)", on commit `5b69ec0`, with `pychivalry-0.2.0.vsix`
  attached (4,050,490 bytes, SHA-256
  `cf810a06a9ee2a04783bf26e96323bebf545a35f61bd0e124e2cf95ab0bc4b61`) and the notes as
  drafted; `docs/preview-release-0.2.0.md` is now the record of what was published, and says
  that the by-hand check was not run before it. The install guide describes 0.2.0.

- Build step 9, started on the owner's word (decision 118), items 9.1 to 9.3 and 9.7:
  - `skills/`, three skills in the one form both AI harnesses load, a `SKILL.md` with a `name`
    and a `description`: `pychivalry-explain-error` (what a finding means, from `explain_code`
    and `lookup`; changes no file), `pychivalry-fix-error` (check, look up, edit, check again,
    at most 5 rounds, then format) and `pychivalry-write-content` (events with their
    localization, decisions, scripted effects and scripted triggers, by item 9.2's rules: look
    names up before using them, write events with their localization, run the checker, repair
    from the findings, stop at zero errors or after 5 rounds, never claim success with errors
    left, and format what it writes, leaving no `style/` warning).
  - VS Code's own AI has them from the extension's manifest (`contributes.chatSkills`, the
    bundle's `dist/bundle/skills/`), and VS Code hands them on to its Copilot harness; the
    `.vsix` holds them.
  - "Set up for Claude Code" copies them into Claude Code's folder of personal skills
    (`skills/` of `$CLAUDE_CONFIG_DIR`, or of `~/.claude`), never into the mod; running it again
    changes nothing; it writes and removes only pychivalry's own copies, known by a record of
    their SHA-256 in the extension's global storage, and leaves a skill it did not write, or
    one that was edited, as it is. Activation brings the copies up to the new version after an
    update. A new command, "pychivalry: Remove from Claude Code", undoes a folder's set-up: the
    server's entry, the extension's own entry of `.mcp.json` (and the file, when nothing else
    is left in it), and the skills with the last folder.
  - Tests (`packages/vscode/src/skill-files.test.ts`, `skills.test.ts`, `setup.test.ts`): each
    skill is well-formed for both harnesses; names only the agent server's tools and the command
    line's commands and options that exist, read from `TOOLS` and `COMMANDS`; writes as code
    only pychivalry's own vocabulary or names the spec package has, and no name outside code;
    the authoring skill states item 9.2's rules in order. The installation is idempotent and
    removable, on Linux and Windows path forms, in temporary folders. The editor tests: VS Code
    lists the three skills (from the extension's folder, and from the packaged `.vsix`'s) and
    syncs them into its Copilot harness's plugin; the set-up copies them, a second set-up
    changes nothing, an update brings them to the new version's, and the removal takes them
    away and leaves another skill alone.
  - `docs/guide/ai-checklist.md`, the hand checklist for VS Code's own AI (item 9.7): the
    requests, one of each kind of content, an explanation and a fix, and what to look for in
    each.
- Build step 9, items 9.4 to 9.6, built in parallel with the skills (decision 118), with 9.8
  prepared:
  - `fixtures/requests/`, the fixed list of content requests: twelve, three each of events,
    decisions, scripted effects and scripted triggers, easy to hard, two of them on a mod that
    already has content; each with the names it relies on (every one a name the spec package or
    its base mod has, which a test proves), expectations checked in code and judged dimensions
    from one closed set of five; and an example result of each, which meets every expectation
    with nothing from the checker.
  - `task scored:authoring`, the scored authoring test (`tools/scored-run/README.md`), a
    developer's test script on the agent-use script, never shipped or run by CI: per request and
    trial, a test session of the developer's own Claude Code in a fresh copy of the request's
    base mod with the agent server over the installed game and the three skills; grade one, the
    checker (no error, no warning, in the format); grade two, the expectations and a judge, one
    more test session started the same way with no tool, server or skill, answering each
    dimension yes, no or cannot tell, by a fixed prompt, a fixed answer schema and fixed parsing,
    a malformed answer recorded as such. A harness problem stops the run.
  - `task scored:calibrate`, the judge run over results graded by hand, recording its agreement
    per dimension and over all, with the cannot-tell rates.
  - The record format gains the suites `scored:authoring` and `scored:calibration`, and
    `task records:check` their checks; a calibration record states no game.
  - Tests, in public CI against a stand-in for Claude Code: the request list, the expectations
    (each kind failing when it should), the judge's prompt, schema and parsing, the run (a
    correct result, an empty one, a broken one, an unconfined session, an unconfined judge, both
    places of the skills, a continued run), the calibration, and `no-model-call.test.ts`: the
    scored scripts name no key or model library, reach no network, and start no program but the
    Claude Code the run names.
- Build step 9, item 9.8, the first scored authoring run, made on the owner's word of
  2026-11-24 and committed as `records/scored/authoring.json`: every request, 5 trials each,
  Opus 5.5 writing and Fable 5.2 judging, each of the 120 test sessions with session limit 3, on
  Claude Code 2.1.330. 60 of 60 trials held; 50 had no error, none had no warning, none was in
  the format, 58 met every expectation, and the judge answered yes to all 180 of its questions.
  What the run showed, and what was done with it (`tools/scored-run/README.md`, "The first scored
  authoring run"):
  - The agent server's `apply_format` tool: one script or localization file of the mod written
    in pychivalry's format, in place, as `pychivalry format <file>` writes it. The run left all
    60 results out of the format, because nothing a session had could write the format's
    Windows line breaks (Claude Code's own file tools keep the line breaks they are sent or find);
    the write-content and fix-error skills now run `apply_format` on each file they wrote or
    changed. It is the server's one tool that writes, declared not read-only; tool schema
    version 3.
  - The content requests `decision-hold-banquet` and `trigger-banquet-guest`, on a new base mod
    `banquet`, replace `decision-hold-feast` and `trigger-feast-guest`, which are retired: their
    base defined the event `feast.0001`, which the base game defines too, an error in every result
    of theirs. The run now refuses to start a test session while a base mod has an error or a
    warning over the installed game.
  - The judge's calibration can be run now: ten hand-made results, labelled as such, some right
    and some deliberately wrong, with a sheet in the grades format for the owner to fill in, and
    a page of the guide on grading them (`docs/guide/judge-calibration.md`).
- Build step 9, item 9.8, the second scored authoring run, made on the owner's word of
  2026-11-24 with its results kept, from the merge of #153: every request of the corrected list,
  5 trials each, 120 test sessions of Claude Code 2.1.330, Opus 5.5 writing and Fable 5.2
  judging, each with session limit 3. Committed as `records/scored/authoring.json`, as the run
  wrote it: 60 of 60 trials held, and all 60 had no error, no warning, were in the format and met
  every expectation; the judge answered yes to all 180 of its questions. The first run's record
  is kept beside it, unchanged, as `records/scored/authoring-run-1.json`, so that both runs'
  measures stay readable (`records/README.md`). What the kept trials show, and what the run does
  and does not show, is in `tools/scored-run/README.md`, "The second scored authoring run".
- The owner's targets for the scored authoring test (decision 127), read from a record's measures
  and never written into one (`tools/src/scored-run/authoring-targets.ts`): every result with no
  error; every result with no warning and in the format; at least 95% meeting every expectation;
  no judged dimension below 95% yes. The authoring run prints each target met or not when it
  ends, and `task scored:targets` reads them from the committed record, or the one
  `SCORED_RECORD` names, starting no session: the second run meets all four, the first two.
- A second calibration sheet, of real results: trial 1 of each of the twelve requests of the
  second run, taken by number and not picked, each the trial's mod with its skills folder taken
  out (`fixtures/requests/calibration/run-2/`, 36 answers left for the owner); the hand-made
  sheet stays and is graded first. `task scored:calibrate` takes `SCORED_RECORD`, a file of
  `records/scored/`, so that each sheet's calibration writes a record of its own.
- Twelve expert content requests, on the owner's word (decision 131), after the twelve the first
  two runs were made on, which are unchanged: three of each kind, each setting a trap a first
  draft is likely to fall into (a name 1.21.0.3 renamed or the game never had, described in words;
  a scope a list leads into; a saved scope passed between events; a definition of the base to find
  and use, or to change in place; a namespace a new file must declare again); four on a new base,
  `granary`. Each has an example result clean over an empty and the installed game, and a
  hand-made first draft with the mistake it invites, which a test holds to failing the
  code-checked side for the reason `fixtures/requests/drafts/drafts.json` gives (eight on the
  checker's errors and warnings). The request format gains names left `unnamed` in the text and
  expectations `within` a block, with a `count` of definitions, and `kept` definitions of the base.
- `tools/src/scored-run/repair.test.ts`: the authoring skill's steps played on those eight drafts
  through the built agent server, with no model: their errors and warnings reported to `check`,
  none after the repair.
- A third calibration sheet, `fixtures/requests/calibration/expert/`: twenty-four hand-made
  results of the expert requests, two of each, some right and some wrong on a judged dimension,
  every one passing everything code checks (88 answers, 24 judge test sessions, graded only if the
  owner chooses). The owner's two sheets are unchanged.
- `SCORED_RECORD` for `task scored:authoring`: the record a run writes and, with
  `SCORED_CONTINUE=true`, continues, a file directly in `records/scored/`. A run of some requests
  only is filed beside `authoring.json` as `authoring-<set>-run-<n>.json`, never over it.
- The hand checklist for VS Code's AI has one expert request, `effect-granary-gift-edit`, run in a
  copy of the base `granary`: the one effect changed in place, the other two effects and every
  other file unchanged (decision 136).
- `records/scored/authoring-expert-run-1.json`: the expert requests' development run, finished
  (decision 138), filed as the run wrote it. 61 trials and 121 test sessions, 60 trials held; no
  error, no warning, in the format and every expectation 60 of 60; every judged dimension 100% yes
  but `conditions-as-asked`, 52 of 55 (94.5%), short of its target.
- `task scored:rejudge`: the judge run again, with the committed judge's prompt, over an authoring
  record's kept results, starting no authoring session (`tools/src/scored-run/rejudge.ts`). Before
  any session it refuses unless the requests, bases, spec, game and Claude Code are the record's
  and every kept trial's stream and graded result match the record to the letter; it writes
  `<record>-judge-<version>.json` beside the record, never over it, and nothing when it stops.
  Its tests run a kept stand-in run, judge it again and hold each refusal.
- `fixtures/requests/judge/`: a hand-made, labelled case of what the judge is given, the logic all
  five `trigger-loyal-realm` results of the expert run wrote; `judge.test.ts` holds what the judge
  is given for it and for its first draft, word for word.
- `records/scored/authoring-expert-run-1-judge-2.json`: the expert requests' development run's
  kept results judged again with version 2 of the judge's prompt, on the owner's word (decision
  139), as `task scored:rejudge` wrote it: 61 judge test sessions of Fable 5.2, no authoring
  session; 61 trials, 60 held; no error, no warning, in the format and every expectation 60 of 60;
  `effects-as-asked` 45 of 45, `scope-as-asked` 55 of 55, `text-as-asked` 30 of 30,
  `nothing-unasked` 35 of 35, `conditions-as-asked` 55 of 55 (52 of 55 under version 1): every
  target met. The judge again said yes to all 220 questions: whether it says no where it should
  still rests on the owner's hand-graded calibration sheets.
- The agent server's `source` tool (decision 140, tool schema version 4), read-only: the base
  game's own text, or the mod's, around a place another result named, by its layer, its file's
  path inside the layer and a line, at most 40 lines, each numbered, a line cut after 400
  characters; only a script or localization file the index read, decoded and split as the index
  reads it, never by an address (an absolute path, a backslash, `..`, a link, a file outside its
  layer's folder: refused, saying why). In the core, `readListedFile` and
  `WorkspaceIndex.decode`.
- `lookup` of the agent server takes `folder`: a field's reading in that folder in full, the
  fields of other folders counted.
- A scored record names the agent server's tool schema version (`server.schema_version`); `task
  scored:targets` says which version a record's sessions were given and that records of different
  versions are not comparable without saying so, and a run refuses to continue a record of another.
- `pychivalry source <layer> <file> <line>` (decision 143): the text around a place a result
  named, the base game's own script or localization or the mod's, at most 40 lines, each with its
  number, as text or as one JSON object (`--json`), with `--end-line`, `--context`, `--mod`,
  `--vanilla`, `--no-vanilla` and `--spec`. The same reading as the agent server's `source`, from
  the same core code: the same lines, limits and refusals. Exit 0 when the lines are shown, 1
  when no such place is read (a layer not read, a file its layer does not list, a link, a file
  outside its layer's folder, a line past the end), 2 on bad usage (an absolute path, a
  backslash, `..`, a line before 1). It indexes nothing: the base game's folders are listed as the
  index lists them, about a second on the installed game. In the core, `readSource`,
  `sourceLayers`, `openSources` and `workspaceSources`.
- The agent server's `lookup` takes `evidence` (decision 144, tool schema version 5): off by
  default; with exactly one name, its answer also holds `evidence`, the name's readings whole with
  the spec package's evidence behind each part, as the command line's `lookup --json` prints
  them, every place in them written as every place the server names; as many whole readings as fit
  the result, the rest counted in `left_out` with the characters they hold and what to ask (a
  folder, for a field of many folders). Refused with more than one name, saying how to ask. The
  evidence of 15,758 of the spec package's 15,852 names fits whole.
- A same-answers test of the two (`packages/vscode/src/source-answers.test.ts`): the command
  line's `source --json` and the agent server's `source` give the same lines and the same
  refusals for every place tried in every file of the planted-defect mod and its game stub, its
  file not valid UTF-8 among them; `lookup`'s evidence of one name is `lookup --json`'s readings,
  over the planted-defect mod and the lookup fixture with its localization.
- The explain-error skill names `lookup`'s `evidence`, for when a person asks why a name is wrong
  or where its reading comes from; a test holds the other two skills to not naming it.
- The checks the spec package's format 9 unblocked (docs/decisions.md, row 153), each with its
  fixture pair, tests and docs/checks.md row, the same on every surface (one runner):
  `structure/triggered-desc-other-field`, a warning on the catalogue's message, at each key a
  `triggered_desc` holds beside `desc` and `trigger` (its block and keys from part D4's
  `closed_body` and `allows_only`); `scope/title-text-reads-scope-saved-late`, advice, an event's
  title text reading a scope saved only in an option or `after`, by part D9's forms (re-proof: 757
  events, no finding); `style/redundant-condition`, a best-practice hint (release 2.3.0's CK3872),
  an `always = yes` that changes nothing in an `AND`, a `NAND` or an `any_false`, with a safe fix
  that takes it away; `style/option-without-ai-weight`, a new best-practice hint (release 2.3.0's
  CK3613), an option of a shown event with several options and neither `ai_chance` nor
  `ai_will_select` (the base game: 19.95% of its 21,581); and `variables/read-without-set`, new
  advice on the table `variables`, a variable read in a namespace and as a kind nothing sets (the
  base game: 31 of 42,001 reads, its known exceptions). `localization/unbalanced-brackets` also
  reports an opener left open (`[`, `(`, `'`, `$`) on the catalogue's four "Unterminated"
  messages, with a fix that closes or removes it.
- The index records, per file, the variables a script sets and the names of its variable
  statements, and the names each localization entry's text reads as a saved scope (D9's forms);
  the on-disk cache's format is 5, so an older cache is rebuilt. The language server rechecks the
  files that read a variable whose sets change, and those that name a localization key whose text
  reads other saved scopes.
- `style/redundant-false-condition`, a best-practice hint (decision 158): an `always = no` that
  changes nothing, directly in an `OR`, a `NOR` or an `all_false` beside other conditions (part
  D4's `child_always_false: neutral`), with a safe fix that takes it away; never a block left
  empty. The base game breaks it in 1 of its 39,426 such blocks; the five mods: none in any of the five.
  Its fixture pair, tests and docs/checks.md row.
- The write-content skill's eighth rule (decision 159): every option of an event with several
  options gets an AI weight, written with the keywords `lookup` reads with the role `ai_weight`;
  its stop rule and report count an option without one as left. The fix-error skill fixes
  `style/option-without-ai-weight` with the other `style/` findings when the person asks.
- `records/scored/authoring-expert-run-2.json`: the expert requests' second development run, on
  the owner's word of 2026-11-26 (decision 165), committed as the run wrote it, the first record
  of tool schema version 5, the spec package in format 9 and the write-content skill's eighth
  rule. 60 trials and 120 test sessions (Opus 5.5 writing, Fable 5.2 judging with version 2 of its
  prompt), every trial held; no error, no warning, in the format and every expectation 60 of 60;
  `effects-as-asked` 45 of 45, `scope-as-asked` 55 of 55, `text-as-asked` 30 of 30,
  `nothing-unasked` 35 of 35, `conditions-as-asked` 55 of 55: every target met. The judge again
  said yes to all 220 questions. What its 60 kept trials show, beside the first expert run's 61,
  is in [tools/scored-run/README.md](tools/scored-run/README.md#the-expert-requests-second-development-run-decision-165).
- `records/scored/authoring.json`: the third preview's release run (decision 132), made on the
  owner's word of 2026-11-26, before his hand calibration and his hand checklist (decision 178),
  from the merge of #168, and committed as the run wrote it (decision 179): all 24 requests, 10
  trials each, 480 test sessions of Claude Code (Opus 5.5 writing, Fable 5.2 judging with version 2
  of its prompt), each with session limit 3, every trial held; no error, no warning, in the format
  and every expectation 240 of 240; `effects-as-asked` 180 of 180, `text-as-asked` 120 of 120,
  `nothing-unasked` 140 of 140, `conditions-as-asked` 210 of 210, `scope-as-asked` 150 of 150:
  every target met as a release run, and again without the expert requests. The judge said yes to
  all 800 of its questions and is not yet calibrated against hand grading, so whether it says no
  where it should is still unmeasured. What its 240 kept trials show, beside the second expert
  run's, is in [tools/scored-run/README.md](tools/scored-run/README.md#the-third-previews-release-run-decision-132):
  2 tool errors, both a tool called by its bare name (9 in the second expert run's 60 sessions),
  no file read outside the mod, every option weighted, no repair round needed; no fault of
  pychivalry's, so no code changed.
- `docs/preview-release-0.3.0.md`: the third preview's pre-release, drafted (item 9.9): the tag
  `v0.3.0`, the title "pychivalry 0.3.0 (preview)", the file `pychivalry-0.3.0.vsix`, what is new
  since 0.2.0, and the notes. **Nothing is published**: no tag and no release; the owner decides.
- A test that reads the release run's targets from the committed record: a release run, 240 of 240
  on every measure, every target met with and without the expert requests, its sessions given the
  committed tool schema version and judged with the committed judge's prompt
  (`authoring-targets.test.ts`).
- The third preview, 0.3.0, released on 2026-11-26, published on the owner's word (decision 180)
  before his hand calibration of the judge and his hand checklist on VS Code's built-in AI: the
  GitHub pre-release `v0.3.0`, "pychivalry 0.3.0 (preview)", on commit `81f7dec` (the merge of
  #169), with `pychivalry-0.3.0.vsix` attached (4,277,332 bytes, SHA-256
  `8259b159a1ac8ba1932aa96ec8ffb417ff982c7c1b09ff25e7e13820c28b26b5`) and the notes as drafted;
  `docs/preview-release-0.3.0.md` is now the record of what was published, and says that the
  by-hand check, the calibration and the checklist were not done before it. The install guide
  describes 0.3.0.

- Build step 10, items 10.1 to 10.4 (#172): GUI files. `docs/gui-syntax.md`, GUI syntax measured
  from all 583 `.gui` files of the install (`game/` 442, `jomini/` 92, `clausewitz/` 49): what it
  shares with script (the tokens, `key = value`, lists, only `=`), named blocks of six keywords
  (`types`, `template`, `local_template`, `layer`, `block`, `blockoverride`) written with or
  without `=` and in any letter case, type definitions (`type` and `local_type`), `using`, values
  with units (`100%`, `5.5f`), constants and `@[ ]`, each with its count and first place; on every
  count of the spec's GUI companion the two agree. The GUI parser (`packages/core/src/gui/`) reads
  a GUI file with the script lexer and a grammar of its own, always gives a tree, and reports
  thirteen new codes, `syntax/gui-*`, all advice at information (no catalogue message is shown to
  be the GUI reader's), each with its row in `docs/checks.md` and its fixture pair
  `fixtures/mods/gui-<what>-bad`/`-good`. `task game:parse` parses every GUI file of the install
  (`results.gui`): 583 trees, 18 findings in 9 files, each classified a defect of the game's own
  files in `tools/data/gui-parse-classifications.json`, and the five corpus mods' 209 GUI files,
  one finding; every form counted. The workspace index reads the GUI files of `gui/`: types
  (database `gui`, found in any letter case by part D1's settled `key-identity-gui-types`), local
  types, templates and local templates (3,495 definitions in the base game), every word a use;
  go to definition, find references, hover and the outline of a GUI file in the editor (a third
  language, `ck3-gui`), `lookup` and `source` on the command line, `find_definition`,
  `find_references`, `list_definitions` and `source` in the agent server, the same on all three
  (the fixture mod `gui-index` over the stub `gui-index`; the language server's round trip; the
  command line against the agent server; the editor tests on a GUI file of their planted copy).

- Build step 10, items 10.5 to 10.7: the graphics-file check `graphics/missing-file` (warning), on the 13 fields the spec package documents as file paths, a `.dds`, `.png` or `.tga` path from the top of the game's folders looked up in the mod, the install's three folders and every DLC pack, by part D1's letter-case row, silent with no game folder ([docs/graphics-check.md](docs/graphics-check.md)); the index keeps the files of each layer it does not read. The call graph in the core (`packages/core/src/calls/`): keys called by name (`vanilla_indexed_dirs`) and values naming an event or an on-action (part D6), each link with its caller, callee, place, statement and basis ([docs/call-graph.md](docs/call-graph.md)). The agent server's `call_graph` (tool schema version 6), the language server's call hierarchy, and the command line's `pychivalry calls`.

- Build step 11, without launching the game (decision 194; decisions 195 to 199): game-log
  analysis built on the spec package's catalogue alone ([docs/game-log.md](docs/game-log.md)).
  `packages/core/src/log/`: each of the catalogue's 2,671 messages a template (printf
  placeholders and `{}`, a value's role read from the message's own words); a matcher that assumes
  no line prefix and no place format (both may be given as patterns), names equally good matches
  as ambiguous and picks none, marks lines that split two ways, matches a message inside a message
  and the three that span lines, and lists every line it cannot match; on the whole catalogue
  2,108 matched, each found on a line made from it, 17 ambiguous groups, none shadowed, 563 not
  matched and listed (`task docs:game-log` writes the table per family into docs/game-log.md).
  The ties: a file and line the message names, a file named inside a value (its line, for a place
  written `at {}`, waits on a capture), a definition a value names, where the mod writes a name
  nothing defines; each message with the pychivalry codes whose evidence it is. The game's log
  folders: Windows' Documents (the registry's, OneDrive's), Linux's `~/.local/share`, the Proton
  prefix by Steam's own app manifest. `pychivalry log [<log>]` (text or `--json`, `--mod`,
  `--prefix`, `--location`, `--catalogue`); the agent server's `analyze_log`, its eleventh tool,
  tool schema version 7, answered whole by message, reading a log only in the game's log folders,
  a `--logs` folder or the mod's own (`--no-log-folders` for the scored runs, which now offer it
  and record version 7); a same-answers test of the two. The editor: "Show the game's log against
  the mod", "Watch the game's log", "Clear the game's log findings", a diagnostics collection of
  their own (source `CK3 game log`), the settings `pychivalry.log.file`, `.linePrefix` and
  `.location`. Test logs are hand-made from catalogue templates over the planted-defect mod and
  say so (`fixtures/logs/`): the matcher has not seen a real log. The captures of item 11.1 and the
  in-game load of item 11.8 are prepared, not run ([docs/game-log-capture.md](docs/game-log-capture.md)):
  `task game:capture-log` and `task scored:in-game-load`, behind a guard that refuses unless a
  decision records the owner's word for a launch, tested on a stand-in for the game; the logs it
  keeps name no folder of the machine. A new reference page, `docs/references/game-logs.md`.

### Changed

- The planted-defect mod plants `graphics/missing-file` (37 defects, 30 look-alikes); its game stub holds the texture the decisions show. The language server checks the mod again when a texture is added or removed.
- GUI files are read since build step 10: a GUI file's findings are the GUI parser's alone (no
  engine check, no `style/` rule, no fix), and the formatter leaves GUI files as they are, which
  Format Document, `pychivalry format` (a folder's counted in one line) and the agent server's
  `format` each say. `task game:parse` now reads the corpus (its GUI files). The index cache's
  format is 6. `localization/unused-key` sees the words of the base game's GUI files through the
  index, and a mod's GUI file no longer counts its comments' words. The base game's index: 17,880
  files (581 GUI files more), 3,374,650 definitions, 9,497,915 uses; 277 names with no winner
  known (233 before: 44 GUI names in sub-folders of `gui/`, which no row says are read). The game-file
  records are made again (after merging #171): the base game's errors (13) and warnings (17,207, #171's 19 `graphics/missing-file` among them) unchanged by the GUI files, its information 167 (149 before: the 18 GUI findings); in the five mods no error or warning changed by them (rice's 3 `graphics/missing-file` are #171's); elf-destiny's one GUI finding; `localization/unused-key` 9 more in divine-intervention and 11 in elf-destiny, each a key a GUI file writes only in a comment; `variables/read-without-set` one fewer in elf-destiny (`disable_toast_notifications`, which a GUI file of the mod reads).
- The game-file suites are re-run with the format 9 checks. The base game: errors (13) and
  warnings (17,188) unchanged; new `style/option-without-ai-weight` 4,165 (the per-file limit
  drops the rest), `variables/read-without-set` 31, `style/redundant-condition` 1. The five mods:
  no error changed; seven openers left open (elf-destiny 3, rice 3, viet-events 1), each a defect
  of the mod's text; `variables/read-without-set` 97 (rice 84, elf-destiny 12, viet-events 1).
- The planted-defect mod plants `structure/triggered-desc-other-field` (36 defects) and gives
  every option of its shown events with several options an AI weight, in `mod/` and
  `reference/`; its manifest's lines moved with them. The requests' frozen results are held to
  "the checker reports nothing" but for `style/option-without-ai-weight`, which came after them
  (a question for the owner). The game stub `event-targets-and-localization` sets a variable.
- A fix may rest on part D4's roles (`basis: keyword-roles`); the agent server describes it, and
  its tool schema version stays 5.
- The requests' frozen results weight every option (decision 160): twelve results gained
  `ai_chance = { base = 50 }` in each option of their events with several options, six example
  results and six hand-made results of the expert calibration sheet (its README names them, to be
  graded again if graded already); the two tests that hold them to "the checker reports
  nothing" leave no code out any more (`LATER_CODES` removed).
- `style/redundant-condition` runs through the reader it now shares with
  `style/redundant-false-condition`, judging exactly what it judged before.
- The game-file suites are re-run with `style/redundant-false-condition`: the base game's errors
  (13) and warnings unchanged, the new hint 1; the five mods' errors unchanged.
- `spec/README.md` says which checks read part D9, the table `variables` and D4's new keys
  (decision 161); nothing else under `spec/` changed.
- MVP.md's definition of done 2 stays open until the spec work answers decisions 151 and 154
  (decision 157); its state, 13 base-game errors, each a defect of the game's files, beside it.
- `style/redundant-condition` judges `any_false` too, as its row says (decision 163): the reader
  it shares with `style/redundant-false-condition` judges every block part D4 names, whatever
  the context reader calls it (a structural keyword, or a trigger whose body holds triggers), so
  an `always = yes` beside other conditions in an `any_false` is reported, with the same safe fix.
  Its code and grade are unchanged; its fixture pair gained an `any_false`. Neither the base game
  nor the five mods writes an `any_false`: no count moved (the base game's 9,350 judged blocks and
  1 finding, the five mods none).
- `style/empty-block` never offers to take away an empty block that means something (decision
  167). An empty iterator that is a condition (part D8's `any_`, read in a trigger block) asks for
  at least one item: its message says so and names the test written out with the parameter D8
  points to and the game documents with a number, `count >= 1`, and its fix, a suggestion (the
  package states no default for that parameter), writes it in (`basis: iterator-kinds`; finding
  data `means` and `written_out`). An iterator the package does not say how to read where it is
  written (of the other kind than its block, in a script value or a keyword's parameters) gets no
  fix (`means: not-known`). A trigger or an effect of the package's buckets written with an empty
  block (`faction_start_war = { }`, `trigger_else = { }`) is not offered for removal either, which
  would take it away (`means: trigger` or `effect`). An effect iterator in an effect block runs no
  effect and is taken away as before, like every other empty block. The code, its grade and its
  counts are unchanged; of the base game's 21,658 listed empty blocks, 239 are such conditions
  (114 were offered for removal before, 125 nothing), 23 iterators not placed (13 were offered for
  removal) and 83 triggers or effects (43 were): 170 removals withdrawn, 20,020 left. In the five
  mods 9 are withdrawn (elf-destiny 8, rice 1), elf-destiny's one condition now offered its test
  written out. The fixture pair gained an `any_child` and an `every_child`. The agent server's
  tool schema version stays 5 (a new value of a string, no new shape).
- The three skills write every tool by Claude Code's full name, `mcp__pychivalry__<tool>`, in
  every step and rule, not only in their list at the top (decision 168), and say how VS Code's
  names are made (`pychivalry-` before the tool's own name in its Copilot harness,
  `mcp_pychivalry_` in its own); `skill-files.test.ts` holds it. The skills' hashes change, so the
  release run is not compared with the second expert run without saying so.
- The game-file suites are re-run with these changes: every count of the base game and the five
  mods is the same, but their times.
- `style/empty-block` never offers to take away an empty logical operator, scope switch or trigger
  block (a `limit`) either, until the spec work says what each evaluates to when empty (decisions
  171 to 173): each is still a hint, its message saying the spec package leaves its empty meaning
  open (`means: logical-operator`, `scope-switch` or `trigger-block`), with no fix. Read from the
  package, no keyword in the code: a key part D4 gives the role `combines_conditions` (`OR`, `AND`,
  `all_false`); a chain or a name of the links bucket; a structural keyword or a parameter whose
  block the tables read as triggers (`limit`, a `random_list` entry's `trigger`). The extension of
  decision 167, a trigger or an effect written with an empty block never offered for removal, is
  kept (decision 171). On all of the base game's 24,274 empty blocks: 11 trigger blocks, 28 scope
  switches and 2 logical operators, 20 removals withdrawn (7, 12 and 1), 22,452 left; in the five
  mods 3,793, every one divine-intervention's (the `AND = { }` its patched buildings write in an
  `OR`). The fixture pair gained a `liege` and an `OR`. `pychivalry-tools advice proof` counts
  each best-practice rule's findings by the fix offered and by what they mean. The game-file
  suites, re-run, give the same figures but their times; their records are not committed.
- `style/empty-block` never offers to take away an empty `random_list` entry or `switch` case
  either (decisions 174 and 175): each is still a hint, its message saying what taking it away
  would change (`: an entry of 'random_list', a chance of nothing; taking it away changes the
  odds of the others`, `means: random-entry`; `: a case of 'switch'; taking it away lets
  'fallback' run for its value`, `case`; an empty `fallback` itself, `fallback-case`), with no
  fix. Read from the package, no keyword in the code: a case of a container of the table
  `containers` with `cases`, an entry where its cases take the parameters of the table
  `random_list_entry`, a case of a case list where part D4 gives the container `case_list`, the
  fallback by D4's `fallback_case`; where the context reader judges no key (inside the body of
  an effect the package gives no rule for), by the container's name. On all of the base game's
  24,274 empty blocks: 263 entries, 28 cases and 1 fallback, 179 removals withdrawn (152, 26
  and 1), 22,273 left; in the five mods 172 (rice 149, viet-events 20, elf-destiny 2,
  divine-intervention 1). The fixture pair gained an entry and a case. `pychivalry-tools advice
  proof` also counts each fix offered by the block it would change. The game-file suites, re-run,
  give the same figures but their times; their records are not committed.
- `style/empty-block` never offers to take away an event's empty `option` either (decisions 176
  and 177): it is still a hint, its message saying that taking it away takes that choice away
  from the player or the AI (`: a choice of its event; taking it away takes that choice away from
  the player or the AI`, `means: event-option`), with no fix, in a shown event or a hidden one.
  Read from part D4, no keyword in the code: a key of an event's own body that is the word of the
  event row with the role `event_option`. On all of the base game's 24,274 empty blocks: 5 options,
  5 removals withdrawn, 22,268 left; none in the five mods. The fixture pair gained an event whose
  one option is empty. A `duel`'s empty outcome is offered for removal as before until the spec
  package gives the table `containers` a row for `duel` (decision 176). The game-file suites,
  re-run, give the same figures but their times; their records are not committed.

- The formatting rules of `docs/formatting.md`, signed off (decisions 90 to 100), then decided
  again under the owner's new principle (decisions 101 to 102): the document is now the rules as
  built. The command line, the agent server and the editor report the `style/` findings with the
  others; `task game:check` and `task game:mods` count them by code and classify none. The fixture
  pair `names-unknown-trigger-*` is in the format. The game-file record of `game:parse` holds the
  round trip.
- AGENTS.md rule 12's test (`tools/src/no-key-no-network.test.ts`) allows Node's `node:net` in
  exactly one shipped file, the local channel of the shared index
  (`packages/core/src/share/channel.ts`), with its reason, and holds that file to binding and
  connecting a path only, never a port or a host; every other shipped file is refused it as
  before.

- `localization/unused-key` is off by default (decision 76): the runner reports it only with
  `unusedKeys`, the command line's `check` with `--unused-keys`, the agent server's `check` with
  `unused_keys`; `explain` and the check reference say so. `task game:mods` runs the default, and
  its record no longer counts those hints (rice: 141,090; viet-events: 19,698), nor what the
  per-file cap dropped of them.
- `localization/unused-key` is on by default again (decision 108, replacing decision 76): the
  command line's `--no-unused-keys` (replacing `--unused-keys`), the agent server's
  `unused_keys: false` and the editor's `pychivalry.localization.unusedKeys` (now `true` by
  default) turn it off; `explain` and `explain_code` say it can be (`can_turn_off`). The
  game-file records count its hints again.
- The field order moved from `presentation/` into data the core reads
  (`packages/core/src/check/field-order.json`, decision 107): completion reads it there, and the
  rule `style/unusual-field-order` judges it, so every surface uses one copy.
- The agent server's `check` leaves out the edits of any fix too long to list (not only a
  formatting fix), marked `edits_omitted`; two identical edits of two fixes are made once.
- The scored agent-use test's harness, from item 6.11's first real test sessions: a session's
  end counts as ended by itself only when it is `success` and not an error (Claude Code ends a
  session that never reached the model with `success` and `is_error`); the start event's skills
  and plugins are read and recorded, and a skill or a plugin that is not Claude Code's own is a
  harness problem; `--disable-slash-commands` keeps Claude Code's own skills out; a surrounding
  session's `AI_AGENT` and every `MCP_*` variable are dropped from the test session's
  environment and `MCP_CONNECTION_NONBLOCKING=0` is set; a record made with another Claude Code
  than `claude` says so in its command. The tests' stand-in stream is the shape Claude Code
  2.1.330 wrote, scrubbed.
- The scored agent-use test is described in plain words everywhere (decision 80): test sessions
  of the developer's own Claude Code, each with a session limit, each counting against the
  developer's own Claude plan; pychivalry holds no API key, token or login and makes no network
  call or model call. The script's setting is `SCORED_SESSION_LIMIT` (required, no default), the
  record's field `session_limit` and its stop `session-limit`; the record keeps no figure about
  a session's use of the developer's plan. The test session's environment drops every variable
  named like a key, a token or another credential, not only Claude's own two. The pinned model
  is Opus 5.5, `claude-opus-5-5` (decision 78).
- Owner decisions 74 and 75: the four checks whose message is in the 1.21 executable but not in
  the catalogue wait for it (`structure/triggered-desc-other-field` stays blocked, the three
  event advice rows stay advice); `references/unknown-name` ships, its 4 base-game findings
  listed as known exceptions in `docs/checks.md`.

- Merged without changing a finding: the advice checks read saved scopes as the index does
  (item 4.6's reading); one reader of part D4, `check/keyword-roles.ts` (formerly
  `advice-roles.ts`), serves the structural checks of item 4.5 and the advice checks; a field's
  `.info` scope may name no scope (`string | null`); lookup shows the object a coat-of-arms
  alias makes a name share.
- `pychivalry explain` and the check inventory give `fields/missing-required-field` and
  `definitions/clash` the evidence of the place they are found at; both were shown as advice.
- `docs/checks.md` marks every row built, blocked or not built yet; the eleven provisional
  advice rows item 4.7's re-proof found firing on the base game are retired, in a Retired codes
  table.
- The spec package is the 1.21.0.3 package in format 9 (the owner's word of 2026-11-25; 57.4 MB,
  3.32 MB gzipped), with `spec/schema.format9.json`, answering the seventeen items of the request
  of 2026-11-25 (docs/decisions.md, rows 147 to 152). Format 9 is format 8 plus the parts D9
  (localization forms), O1 (names the game saves from its own code) and O2 (scope values that are
  no scope type), keys on the folders, the record schemas and the scope types, and keys inside
  C4, D1, D4, D5 and D6. The core's reader and `task spec:check` read format 9 only and refuse
  format 8. The format 4 copy for release 2.3.0 is kept as it was: 2.3.0 cannot read the one the
  format 9 pass built, and `legacy/` does not change.
- The rebuild reads what format 9 gives where it read an older form or a measured stand-in. The
  index reads which files of a folder are script: `sound/GUIDs.txt`,
  `gfx/models/buildings/naming.txt` and a `.txt` file in `gui/` are not read (the index record
  lists them, `not_script`), and `game:parse` takes its two exclusions from the package. The scope
  checks judge a record's root only where its folder's rule is `fixed` and not on the wiki-era
  seed alone: laws root at a character, title history at a landed title, scripted modifiers at
  their caller; a keyword whose scopes name `none` (part O2) is not judged. A save of a value
  (`save_scope_value_as`, its name in the block's `name`) is a save, and the 409 names the game
  saves from its own code are defined. `references/unknown-key` reads D6's `sentinels` (`holding =
  none`) and `miss_values`, not a measurement of its own, and leaves a row whose database the
  index does not hold; `fields/unknown-field` takes an ethnicity's keys as gene names. Lookup gives
  a modifier's localization key `MOD_<NAME>` (or the executable's own literal) from part D5. The
  index compares a province id as an integer (`003` is `3`), drops a replaced gene's templates,
  and reads `within`, `merge`, `path_match`, `compare_unit` and `pack` of the override rules. The
  table of the keywords of variables, D9's forms, D4's new roles and the catalogue's new messages
  are read and exposed for the checks that wait on them; none of those checks is built (they are
  since row 153, above).
- The game-file suites are re-run on format 9. The base game's errors: 806 to 13, every one a
  defect of the game's own files (the 791 parse errors of the two files that are not script and
  the 2 false `selection_count` errors are gone); its warnings 17,185 to 17,188 (4
  `references/unknown-key` on values nothing in the install defines, which the package lists, and
  one `style/not-formatted` fewer); `scope/undefined-event-target` 5,969 to 26. The scope check
  judges 179,669 of 610,886 keyword uses (178,395 before), with no finding. In the mods:
  elf-destiny's 6 false `fields/unknown-field` warnings on its genes are gone, and
  `scope/undefined-event-target` falls from 258 to 1 in all; the errors are the same.
- The spec package is the 1.21.0.3 package in format 8 (the owner's go of 2026-11-23; 55.7 MB,
  3.18 MB gzipped), with `spec/schema.format8.json`; the format 4 copy is unchanged. Format 8 is
  format 7 plus keys inside parts D1, D2 and D3, which answer the five points the format 7
  adoption sent back (docs/decisions.md, rows 67 and 69). The core's reader and
  `task spec:check` read format 8 only and refuse format 7; `task spec:check` also counts the
  rows whose file condition the index applies.
- The index applies the format 8 data. Part D3's `name_scope`: a nested name is known by itself
  or with the parent `scope_parent` names (a trait's track by its trait, an activity's option
  category by its record); a scope resting on the measurement alone or unknown decides nothing,
  and such a name under more than one parent has no winner (reason `name-scope`). D1's
  `file_condition`: a localization file without a UTF-8 byte-order mark adds no keys, on Linux
  and Windows (`IndexedFile.noDefinitions`). The gene containers: `special_genes` holds gene
  containers, every gene is one key space known by its name and portrait group, a later gene of
  another type is refused, and `age_presets` is a key space of its own. A coat of arms written
  `key = other_key` is replayed in read order as the alias row says, and the answer says the
  object the name shares (`Resolution.shared`, and the new status `not-in-force` for a line whose
  target is not read yet). Province terrain keeps a province's terrain line and its winter block
  apart, the later of each in force (the block field by field). The index cache's format is 3.
- The game-file suites are re-run on the format 8 package. On the base game 1,322 names are
  defined more than once (12,845 before, most of them a province's terrain line beside its
  winter block) and 233 have no winner known (118 before): the 21 coats of arms and the gene are
  answered, and 167 nested names whose scope the package does not settle are new.
  `names/modifier-outside-use-area` raises no warning on the base game (215 before), nor in
  divine-intervention (215) and elf-destiny (70); the errors are the same.
- The spec package is the 1.21.0.3 package in format 7 (55.4 MB, 3.14 MB gzipped), with
  `spec/schema.format7.json` and a new format 4 copy; the core's reader and `task spec:check`
  read format 7 only and refuse format 5.
- The override rules come from the package (part D1): the stand-in `spec/override-rules.json`
  and its schema are retired. The core's rules reader reads every row's status and its basis per
  platform; a settled or derived row of a kind the index applies decides, a partial or open row
  decides nothing. The index applies the extension kind `listing-depth` and reads the other
  seven without applying them, reads the rows' `details` where the kind alone would name a
  wrong winner, and matches `replace` and `replace_path` folders byte for byte. With parts D2 and
  D3, `namespace` and settings are no definitions, a constant holds for its file, a landed title
  nested at any depth is a definition and a `history/cultures` file defines its culture's
  record, named by its stem. The index cache's format is 2; the index record counts the names
  with no winner known by reason too. On the base game 118 names defined more than once have no
  winner known, where there were 1,309.
- The game-file suites are re-run on the format 7 package. The checks raise 12 errors in the base
  game where item 4.2 raised 20 (the 8 errors of `common/pool_character_selectors` are gone with
  the corrected field kind) and 215 warnings, all in one block the package's own row says is
  not settled (docs/decisions.md, row 67); on the mods the same errors as before, and 325 more
  unknown modifiers in RICE, in the blocks part D7 confirms.
- The context reader reads the blocks part D7 confirms as modifier blocks, with the keys D7
  measures there as their parameters.
- The 2.3.0 baselines are re-recorded on the new format 4 copy, whose bytes changed: 2.3.0's
  base-game check now reports 88 errors (96 before); its findings on the five mods are the same.

- The tools' suites and the core's tests read the spec package through the core's reader; the
  tools' own `readSpecPackage` is removed. `task spec:check` keeps its fuller check.
- The speed baselines of release 2.3.0 are re-recorded on the 1.21.0.3 format 4 copy (they were
  made on its 1.20.0.2 spec). `task baseline:prepare` points the export of `legacy/` at that
  copy through the export's own `spec.config.json`, and every baseline task checks that the
  build bundles it. `task records:check` ties every 2.3.0 baseline to the committed format 4
  copy, its game build and the committed corpus, instead of to the package.
- The game-file suites are re-run on the 1.21.0.3 package. The index now describes the 17
  folders game 1.21 added (236 folders indexed instead of 219, 17,302 files instead of 17,272);
  12 folders of 103 files are still not described, and 1,309 names still have no winner known.
  The parse is unchanged: 4,854 files, 3 errors, all classified.
- The rebuild reads package format 5 only; the stand-in for 1.20.0.2 in format 4 and its schema
  are removed.

- In the MVP the game is on the same computer as VS Code; a game on another computer on the
  local network comes after the MVP. Linux and Windows are supported equally (the owner's
  decisions of 2026-11-21).
- The override rules are data: a table in the spec package read out of the executable, with a
  neutral index until it arrives. Build step 3 is re-planned on that
  ([docs/PLAN.md](docs/PLAN.md), items 3.1a, 3.6 and 3.6a).
- The Windows-1252 fallback reads only the bytes that are not valid UTF-8; a file that mixes
  both encodings now reads all its letters correctly (the owner's decision of 2026-11-21).
- The plan's environment table no longer states paths from the machine that runs the suites.
- The planted-defect mod lives in `fixtures/defects/` (the plan said `fixtures/planted/`).

- `tools/` depends on `@pychivalry/core`, for the parse suite.
- The record check also checks that a parse record agrees with itself.
- The planted-defect mod is harder (decision 83): 32 defects, every error and warning code at
  least once and four codes twice, and 29 look-alikes, in 17 files and 591 lines (was 27, 10,
  15 and 254). Defects need a lookup (the scope an effect or trigger takes and the link to it,
  an exact name, an event of another file, the values a field takes), interact (an obvious
  rename that clashes with another file's event; a clash whose right fix also answers an
  unknown key; a scope line that must stay), or are fixed away from the finding (a
  localization key, a block named by its caller, a brace inside the block rather than at the
  end of the file). Its reference copy's wrong-scope fix gives a county a modifier of county
  modifiers. The graders judge by the checker and the manifest's fix ranges, and tests show
  fixes the reference does not use passing and the obvious fixes of interacting defects
  failing; `defects-gone` lists a code planted twice once.
- `pychivalry explain` and the agent server's `explain_code` show every message with readable
  slots (`Unknown trigger '<trigger>'`), never `%s` or `{}`; the check reference writes them as
  text, not tags, and the command line's `explain` shows the message of an advice or per-place
  row.
- The agent server's instructions say that a client may list its tools under a prefix of its
  own (`mcp__pychivalry__check` in Claude Code) and that the names in them are the bare ones.

- `style/unusual-field-order` judges `common/decisions` and `common/character_interactions` too
  (decision 109), each with the order of its fields in the folder's own `.info` file: the base
  game writes 398 of 587 decisions and 492 of 650 interactions in another order; the rule as a
  whole fires on 2,096 of 12,528 base-game records (was 1,206 of 11,291). Completion offers a
  decision's and an interaction's fields in that order. `style/empty-block` and
  `style/deep-nesting` judge every folder, none left out.
- Every fixture mod and the planted-defect mod are in pychivalry's format (decision 110): Windows
  line breaks, the byte-order mark, the formatter's layout, but for what each fixture exists to
  test (files with a parse error or not valid UTF-8, the bad half of each `style/` pair, three
  localization files without the mark), kept byte for byte. Each fixture's other findings are
  the same; only their lines and columns moved, and the expected outputs with them.
- The planted-defect mod plants the `style/` family: a line indented with spaces
  (`style/not-formatted` and `style/indentation`) and a file not valid UTF-8 (`style/not-utf8`),
  35 defects in all (26 errors, 9 warnings and a hint on `mod/`, nothing on `reference/`), in 17
  files and 539 lines; the graders and the rule that every error and warning code is planted
  count the family instead of leaving it out.
- The presentation data's 111 snippets are written in the format (decision 111), so what
  completion inserts is formatted already: a block of one simple pair on one line, an empty block
  `{}`; 81 changed.
- A file that is not valid UTF-8 shows one finding, the warning `style/not-utf8`, which now says
  how the file was read (`read_as` in its data). The parse note `encoding/not-utf8` is retired
  (decision 113): no surface emits it, and the code is never reused.

- The scored authoring test's judge is Fable 5.2 unless `SCORED_JUDGE_MODEL` names another, in
  the run and in the calibration (the owner's answer of 2026-11-24: Opus 5.5 writes, Fable 5.2
  judges).
- An expectation that a name is used inside a record may also follow records of the mod in a
  named database that the record uses: `event-letter-from-spouse` accepts its event in an
  on-action of the mod that `yearly_playable_pulse` fires, the way the game's own on-action
  documentation tells a mod to append to one of its on-actions. Two trials of the first run did
  that and failed the expectation as it was; their recorded measures stay as the run made them.
- The hand checklist for VS Code's AI uses the banquet request and `apply_format`, and says that
  it cannot be run on preview 0.2.0, which has neither the skills nor `apply_format`.
- The hand checklist says how to build the extension file from `main`, install it over preview
  0.2.0 (`code --install-extension <file> --force`, checked on VS Code 1.147.0's command line)
  and tell which of the two is installed, since both read version 0.2.0: only the build from
  `main` has the command "pychivalry: Remove from Claude Code", the skills and their folder.
- `apply_format` is the owner's confirmed choice (decision 126): the agent server writes nothing
  but the file `apply_format` is given, in the format.
- The guide's page on the judge's calibration names both sheets, which to grade first, their
  answers (26 and 36), where to save them, the one command of each and its judge test sessions
  (10 and 12).
- The targets of the scored authoring test are read with and without the expert requests, and
  against the committed request list: a record made before the expert requests, as both committed
  ones were, is read over the requests it has and names those it lacks, and a record that lacks
  any is not a release run (`task scored:targets`).
- The skills and the agent server's instructions say plainly which name to call: Claude Code's
  full name of every tool a skill drives (`mcp__pychivalry__check` and so on), that a call of the
  short name reaches nothing, and to call the same tool again by its listed name; both scored
  authoring runs had sessions call tools by the short name (10 calls, then 13).
- The paged tools' and `lookup`'s cursor say that a cursor only continues the answer it came from,
  with exactly the same arguments, and that a lookup of other names never takes one; a refused
  cursor says to repeat those arguments or to call again without cursor (the second run had 4
  lookups given another call's cursor). The same calls are refused as before.
- The guide's page on the judge's calibration names the third sheet, of the expert requests, its
  88 answers, its command and its 24 judge test sessions.
- **A scored authoring run stops only when the trials after a trial that did not hold would say as
  little:** a session not set up as the run asks, the run's first trial broken, or three trials in
  a row not holding. Otherwise it carries on, and a run continuing the record tries the request
  again. What counts as held is unchanged. The expert requests' development run had stopped after
  14 trials, every target met by the 13 that held, because one session, with a clean result, once
  called `Read` on a game file outside its mod.
- **A trial that did not hold never improves a score:** it is graded, and judged when its authoring
  session ended by itself; `task scored:targets` and the run's reading never count it as a
  success, count it against each target its own result fails when its session ended by itself,
  count it for nothing when a session of it broke, and name each one with why. A release run needs
  10 trials that held of each request.
- `SCORED_CONTINUE=true` continues an authoring record made at an earlier commit when git shows
  that only documents, records, tests and the run's own files changed since; anything a trial is
  made or graded with refuses it, naming the files. The record keeps its first `tool`, and a note
  names each continuing run's commit and the files of code that changed.
- `task scored:authoring` exits 1 when it stopped early or a request it names is short of
  `SCORED_TRIALS` trials that held, and names which; it no longer fails for a trial of the record
  that did not hold and was tried again.
- The owner grades all three calibration sheets before the release run (decision 135); the guide's
  page and the scored-run README say so.
- **The judge is no longer the authority on whether a name exists or what it means** (version 2 of
  its prompt, decision 138): it is given what pychivalry's checker reports in the result over the
  installed game and the game's own description, from the spec package, of every trigger, effect,
  iterator and link the result's script files write (read in place as the checker reads them),
  and those the package lists as removed, and takes names and their meanings from them, never from
  its memory of the game. The prompt is versioned by its hash; `task scored:targets` names the
  version a record was judged with and says when it is not the committed one (every committed
  record: version 1).
- `task scored:calibrate` gives its judge the same material, so it needs `CK3_GAME_PATH` and its
  record states the game (a calibration record's `game` is no longer `null`; none had been made).
  The guide's three commands name it; the sheets are unchanged.
- **The agent server's `lookup` answers every name whole** (decision 140, tool schema version 4):
  each name asked is answered whole in one result, its readings first, each with what it is, the
  game's description, its scopes, what it takes, its version and its removal, then its
  definitions (at most 3 places a group, counted whole) and its uses (counted by layer, the first
  3; `find_references` lists all), or it is named in `not_answered`, to look up in another call.
  There is no cursor. The spec package's evidence is left to the command line's `lookup --json`;
  a field of more than three folders comes in brief; every name of the spec package fits a result
  alone. In the expert run, every session's first lookup got 1 to 3 of its 2 to 20 names and 9 of
  its 12 tool errors were cursors given with other names; replayed over the installed game, 45 of
  those 61 first lookups are answered whole in one call and the rest in 2 or 3.
- **Every place every tool names says its layer** (decision 140): one writer writes `layer`,
  `file` and the span, and a place outside the mod `"read_with": "source"`; `check`'s findings and
  fix edits and `find_definition`'s `at` say `layer: "mod"`. The same-answers comparison holds
  every place of a finding to the mod before it takes the layer off.
- The server's instructions and the three skills say when to read the game's own text with
  `source`, that a game place is never read with a session's own file tools, and that `lookup`
  names what it did not answer; the write-content skill learns a folder's fields with `folder`.
  The scored runs offer `source`.
- **The agent server's tool schema version is 5** (decision 144): `lookup`'s `evidence`. Scored
  records carry the version, so the next development run is made at version 5 and is not compared
  with records of version 4 or earlier (none was made on version 4).
- The reading behind the agent server's `source` moved into the core (`readSource`), which the
  command line's `source` calls too. The lines it shows are bounded there, at most 12,000
  characters written as JSON strings, instead of by the agent server fitting its whole result into
  its budget, so both surfaces show the same lines; the result still fits its budget. A refusal
  names its argument and whether its form is wrong or no such place is read; the form of every
  argument is checked before the layer. Two texts are worded for both surfaces: a layer not read
  (`jomini is not a layer read here; the layers are mod, game`, and without a game `the base game
  is not read, so the only layer is mod`) and a place that ends past the file (`the place ends at
  line N, past the end of the file`).
- The second scored authoring run's record is kept as `records/scored/authoring-run-2.json`, byte
  for byte, moved with `git mv` in a commit of its own, since the release run's record is
  `authoring.json` now (records/README.md); `judge.test.ts` lists both with the judge's version
  each was judged with (`authoring.json` version 2, `authoring-run-2.json` version 1), the test of
  the second run reads it by name, and every document naming the file says which run it is.
- The extension's version is 0.3.0 (`packages/vscode/package.json` and the lock file), the third
  preview's, before that preview is published: a build from `main` writes
  `pychivalry-0.3.0.vsix`. The hand checklist says how to install it over 0.2.0 and tell the two
  apart by their versions; the install guide names the file a build writes; the extension's own
  README names formatting and quick fixes, the agent server's `source` and `format`, "Remove from
  Claude Code" and the three skills.
- The guide's calibration page and the second run's calibration sheet say where the second run's
  record is now, and that the three sheets are graded after the release run (decision 178).
- The fix-error and write-content skills use the call graph (decision 193). The fix-error skill,
  before it edits a scripted effect, a scripted trigger or an event, asks
  `mcp__pychivalry__call_graph` for the definition's callers, and its report says what the change
  affects; the write-content skill, after its draft and before the checker's rounds, reads back
  every event chain or call it wrote with it, each call it meant there and each callee defined.
  `skill-files.test.ts` holds both. The two skills' hashes change, so the next scored run is
  measured on the new skills and tool schema version 6, not compared with the committed records
  without saying so (`tools/scored-run/README.md`).
- Build step 10 is done on the owner's word (decision 192): the graphics check's base-game
  warnings, each a defect of the game's own files, count as raising nothing. The GUI parser's
  structural words are GUI grammar, not game vocabulary (decision 191). Build step 11 started
  without launching the game (decision 194).

### Fixed

- The shared index's test "a lender that dies in the middle of a request takes nothing with it"
  failed once on Windows in #156 and #157: the program that starts lending right after the first
  one is killed did not lend at its first look. A race in the code, not a timeout: it took a
  successful connection to the address as the old lender alive, and a program being killed can
  still take one for a moment (on Windows, another instance of its named pipe). A program that
  would lend now probes with the address file's token and takes the address over unless the lender
  answers within 2 seconds; a lender answers a probe at once, busy or not. A new test of an address
  that takes a connection and never answers, or closes, fails with the old check.

- The judge of the scored authoring test answered from its memory of the game: in the expert
  requests' development run it said three times that `popular_opinion`, the trigger game 1.21.0.3
  has for a county's opinion of its holder, is not a trigger and that the name is `county_opinion`,
  which 1.21.0.3 removed, on five results of one logic it also said yes to twice. The results, the
  request, its expectation and the checker were right. The judge now takes names from the checker
  and the game's own documentation (above).

- The command line's cache test compared the wall-clock times of two runs and failed once on a
  loaded machine. It now proves the second run did not read the game by the work done: it
  reports a cache load and no build, the cache file is not written again, and a game file
  changed between the runs where the listing cannot see it leaves the findings unchanged (a run
  on a fresh cache shows they would change).

- The core's check slowed with the cube of the number of files defining one name: it resolved
  the name once per definition and compared every pair of the definitions each time (100 files
  0.3 s, 300 files 6 to 7.5 s). The index now finds an unordered pair among sorted neighbours
  and keeps each name's resolution until a file changes: 300 files take 0.09 s and 1,000 files
  0.36 s. Tests count the sort's comparisons (n log n, not n squared), hold the resolution
  remembered until a file changes, and bound a check of 1,000 files; no finding of the base
  game or the five mods moved.

### Open

- Build step 10's GUI items go back to the spec work in eight points (decision 181): which reader
  reads a `.gui` file and what it prints for a defect (until then the `syntax/gui-*` codes are
  advice), whether `gui/` is read with its sub-folders (224 of `game/gui/`'s 441 files "read: not
  known"), which of two types of one name in two files is in force, templates registered twice,
  one database for two registries, files outside `gui/`, local types and templates, and the
  keywords' letter case; and a ninth (decision 191), the GUI grammar's structural words as data,
  which the parser then reads from the package. Questions for the owner are in
  `docs/decisions.md`.
- Build step 11's captures on the analysis machine, and the items that rest on them (11.1, 11.2,
  11.5 and 11.8), wait on the owner's word (decision 194).
- Build step 10's graphics check goes back to the spec work in three points (decision 187): the
  `.info` type `file_path` as data on the 48 fields of 25 folders measured as paths, the folder a
  file name is read in for a field that names one inside a define's folder, and how the game reads
  a path with no folder, a `..` segment, a leading `/` or a backslash.
- The harder planted mod has not been run by a test session yet; a run starts only on the
  owner's word (decision 80).
- The by-hand check of the signed-in AI harnesses, on Linux and Windows, is the owner's.
- Build step 9: the judge's calibration (item 9.6), on its three sheets, and the hand checklist on
  VS Code's AI (item 9.7), on the third preview's file or one built from `main`, are the owner's to
  run. The third preview's release run was made on his word of 2026-11-26, before both (decision
  178), and met every target (decision 179); its judge said yes to all 800 of its questions, and
  only the calibration can show that it says no where it should. The third preview, 0.3.0, was
  published the same day, also before both (decision 180).
- Whether a check row should judge a static modifier applied by an effect of another use area
  is a question for the owner (`docs/decisions.md`); no built row covers it.
- The game-concept half of `references/unknown-name` stays blocked: without a concept's aliases
  (row 151) it would report 20,715 of the 65,007 concept names of the base game's English. Parts
  of two more rows wait on the owner: the iterator sub-cases of `names/unknown-trigger` and
  `-effect`, the block and word types of `fields/wrong-kind-of-value`.
- `variables/read-without-set` fires on 31 base-game reads; whether it ships with them as known
  exceptions, a condition that always fails where it changes nothing, the requests' frozen
  results and the 15 folders below `events/` that break `style/option-without-ai-weight` more
  often than they follow it are questions for the owner (docs/decisions.md); three points go back
  to the spec work (row 154): the variables the game's code sets, whether the engine keeps a
  variable's namespaces and kinds apart, and the position of the "Unterminated" messages.
- Four points of `style/empty-block` go back to the spec work (decision 169): the default of an
  `any_` iterator's `count`, what an iterator body with no condition asks of an item, how an
  iterator is read where the package's rules do not place it, and what an empty logical
  operator, plain trigger block or scope switch evaluates to; until it says, the rule offers no
  fix for those last (decision 172). A row of the table `containers` for `duel`, whose body the
  game documents as a `random_list`'s, goes back to the spec work (decision 175); until the
  package has it, a `duel`'s empty outcome (1 in the base game) is offered for removal as before,
  and then it is read as an entry of a random list (decision 176).
- The seventeen requests of 2026-11-25 are answered by format 9 (docs/decisions.md, row 150),
  what the package still leaves open with them; one new request goes back to the spec work
  (row 151): the trait groups and the game concepts' aliases, which part D6 names as databases and
  part D3 does not define, so that three confirmed rows of D6 cannot be read.
- The override rules `docs/overrides.md` leaves open (rules 3, 4, 5, 7, 8 and 9, and the open
  parts of 6 and 10) are to arrive as rows of a table in the spec package, read out of the
  Windows and Linux executables; the 1.21.0.3 package does not carry it. Until it does the
  index lists every definition those rules decide and names no winner: 1,309 names of the base
  game.
