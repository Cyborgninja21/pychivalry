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

### Changed

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

### Open

- Item 1.6: the 1.21 spec package in format 5 (step 0), and whether it is committed
  compressed or raw (an owner decision).
- Item 1.11: the result baselines, which need the 1.21 spec in format 4 (step 0).
- The override rules `docs/overrides.md` leaves open (rules 3, 4, 5, 7, 8 and 9, and the open
  parts of 6 and 10) arrive as rows of the spec package's table from step 0, read out of the
  Windows and Linux executables. Until then the index lists every definition those rules
  decide and names no winner: 1,309 names of the base game.
- Items 4.2 to 4.11 wait for the 1.21 spec in format 5.
