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
  goes out; `docs/preview-release.md`, the draft of the first preview's pre-release, not
  published.

### Changed

- `localization/unused-key` is off by default (decision 76): the runner reports it only with
  `unusedKeys`, the command line's `check` with `--unused-keys`, the agent server's `check` with
  `unused_keys`; `explain` and the check reference say so. `task game:mods` runs the default, and
  its record no longer counts those hints (rice: 141,090; viet-events: 19,698), nor what the
  per-file cap dropped of them.
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

### Fixed

- The core's check slowed with the cube of the number of files defining one name: it resolved
  the name once per definition and compared every pair of the definitions each time (100 files
  0.3 s, 300 files 6 to 7.5 s). The index now finds an unordered pair among sorted neighbours
  and keeps each name's resolution until a file changes: 300 files take 0.09 s and 1,000 files
  0.36 s. Tests count the sort's comparisons (n log n, not n squared), hold the resolution
  remembered until a file changes, and bound a check of 1,000 files; no finding of the base
  game or the five mods moved.

### Open

- The harder planted mod has not been run by a test session yet; a run starts only on the
  owner's word (decision 80).
- Build step 7 is built but for item 7.12: the first preview's pre-release waits for the owner's
  word, and the by-hand check of the signed-in AI harnesses for the owner, on Linux and Windows.
- Whether a check row should judge a static modifier applied by an effect of another use area
  is a question for the owner (`docs/decisions.md`); no built row covers it.
- Two rows of the check inventory are blocked: `structure/triggered-desc-other-field` (its
  message is not in the committed catalogue) and `scope/title-text-reads-scope-saved-late` (the
  saved-scope form of localization text is not data). Parts of four more wait on the owner or
  the spec work: the iterator sub-cases of `names/unknown-trigger` and `-effect`, the block and
  word types of `fields/wrong-kind-of-value`, the open brackets of
  `localization/unbalanced-brackets`, the game-concept half of `references/unknown-name`.
- Twelve requests back to the spec work (decision 73); 793 of the base game's 806 errors are
  spec-package faults until the package answers them.
- The override rules `docs/overrides.md` leaves open (rules 3, 4, 5, 7, 8 and 9, and the open
  parts of 6 and 10) are to arrive as rows of a table in the spec package, read out of the
  Windows and Linux executables; the 1.21.0.3 package does not carry it. Until it does the
  index lists every definition those rules decide and names no winner: 1,309 names of the base
  game.
