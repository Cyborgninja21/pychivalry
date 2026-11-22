# pychivalry: test data

Every kind of data the tests run on, where it lives, whether it is committed, and which suite
uses it. A step that adds test data adds it here.

| Kind | Where | Committed | Used by | Runs in public CI |
| --- | --- | --- | --- | --- |
| Hand-written mods | [`fixtures/mods/`](../fixtures/mods/README.md) | Yes | Every package's tests | Yes |
| Game stubs | [`fixtures/game/`](../fixtures/game/README.md) | Yes | Tests that need a base game: the index's override fixtures | Yes |
| The planted-defect mod | [`fixtures/defects/`](../fixtures/defects/README.md) | Yes | The scored agent-use run; its graders' own tests | The graders' tests only |
| Content requests | `fixtures/requests/` (step 9) | Yes | The scored authoring run | No |
| Captured game logs | `fixtures/logs/` (step 11) | Yes | Game-log analysis | Yes |
| The five real mods | Outside the repository, in the folder `CK3_CORPUS` names; pinned by [`records/corpus/MANIFEST.tsv`](../records/corpus/README.md) | The manifest only | `task game:index`, `task game:mods`, `task game:bench`, the 2.3.0 baselines | No |
| The base game | The local install, in the folder `CK3_GAME_PATH` names | Never | `task game:parse`, `task game:index`, `task game:check` and the suites above | No |
| Records | [`records/`](../records/README.md) | Yes | Public CI checks each one against the committed spec and corpus (a 2.3.0 baseline against the committed format 4 copy) | The check, yes |
| The spec package | [`spec/`](../spec/README.md): the 1.21.0.3 package in format 5, its companions, and the format 4 copy for 2.3.0 | Yes, gzipped | Every reader of the spec; the parse and index suites; the 2.3.0 baselines (the format 4 copy) | Its check, yes; the tests read the package file |
| Release 2.3.0's tests and records | [`legacy/`](../legacy/) | Yes, unchanged | Carried over by the step that owns each behaviour | No |

## The rules

1. **Public CI needs nothing but the repository.** No game file, no mod from the workshop, no
   model, no key, no display. Everything it runs on is under `fixtures/` or written by the test
   itself in a temporary folder.
2. **Game and mod files are never committed.** A fixture is written by hand for the test. It is
   not a file copied out of the game or out of a published mod.
3. **Only mods the project owner supplies are used as real mods.** The five in the corpus are
   the same five release 2.3.0 was measured on. A refresh is a deliberate act that re-records
   the expected results ([records/corpus/README.md](../records/corpus/README.md)).
4. **A suite that needs the game writes a record, and the record is committed.** The record
   states the game build, the spec checksum and the corpus it ran on, so a result can be traced
   and a spec change forces a re-run ([records/README.md](../records/README.md)).
5. **Nothing committed names the machine it was made on.** Records write `<game dir>`,
   `<corpus dir>` and `<legacy build>`; a record holding an absolute path fails its check.

## Fixtures

Small mods written by hand, one behaviour each. The layout and the naming rules are in
[fixtures/README.md](../fixtures/README.md). A check is tested on a pair: a file it fires on and
a file it is silent on. Parser cases a few lines long stay as tables in the test file beside
the parser; anything larger is a file in a fixture mod.

Build step 2 added the first: twelve broken-input mods named `parse-*`, one per recovery path
of the parser plus text cut off mid-edit and release 2.3.0's `broken_syntax` mod, each with
the findings and tree a correct parser gives in its `expected.json`; and
`encoding-windows-1252`, a file that is not valid UTF-8. The list is in
[fixtures/mods/README.md](../fixtures/mods/README.md). The parser's other test data stays in
tables in the test files under `packages/core/src/syntax/`: the 74 parser cases of 2.3.0, and
one case per token and per form.

Build step 3 added the index's fixtures. The first game stub,
[`fixtures/game/override-rules`](../fixtures/game/README.md), is an install with the three folders
`game/`, `jomini/` and `clausewitz/` and one DLC pack, holding the game's side of every rule in
[overrides.md](overrides.md). Three mods are read over it, one at a time: `override-rules`,
`override-rules-replace-path` (rule 8) and `override-rules-folder-case` (rule 9, a folder in
upper case, which Windows cannot hold beside the lower-case one in a single tree). Each states,
in its `expected.json`, what a correct index answers for every name: a winner where the stand-in
rules table settles the rule, both definitions and no winner where the rule is open. A fourth
mod, `index-definitions-and-uses`, lists every definition and every use of a defined name the
index must find, and none it must not. The list is in
[fixtures/mods/README.md](../fixtures/mods/README.md).

## The planted-defect mod

One mod with 20 to 30 defects, one per check code, a manifest of where each sits, lines that
look wrong and are not, and a reference copy with every defect fixed. Build step 6 writes it.
It is what the scored agent-use run is graded on: a trial passes when the checker reports no
errors, every planted defect is gone, nothing else changed and the look-alikes are untouched.

## The five real mods

| Slug | Workshop id |
| --- | --- |
| `balance-of-power-ui` | 3157042775 |
| `divine-intervention` | 2986538297 |
| `elf-destiny` | 3114064450 |
| `rice` | 2273832430 |
| `viet-events` | 2227658180 |

They are published mods by other authors and are never committed. The copy the suites read is
pinned by file count and hash; a mod on disk that is not the pinned copy fails the suite.

## The base game

Read from the local install of the current game version. The suites state the build and a hash
of the game's file manifest in each record. `task game:parse` reads 4,854 script files of game
1.21.0.3 in ten folders and measures the encoding of all 20,530 text files; its record is
`records/game/parse.json`, and every parse error in it is classified in
`tools/data/parse-classifications.json` ([encoding.md](encoding.md)).

`task game:index` indexes the whole base game (17,302 files of 1.21.0.3 in the 236 folders of
the spec's list that hold files, with the install's `jomini/` and `clausewitz/` folders and the
DLC packs), caches and reloads the index, and indexes each of the five mods over it; its record
is `records/game/index.json` ([records/README.md](../records/README.md#index-records-gameindex)).

## Release 2.3.0's baselines

`records/baseline-2.3.0/` holds what release 2.3.0 does on game 1.21.0.3 and the five mods,
run from a build of `legacy/` outside the repository on the committed format 4 copy of the
1.21.0.3 spec: its speed (`speed-*.json`, `task baseline:speed`) and its results
(`results-*.json`, `task baseline:results`): the base game's parse and check counts with every
error, and each mod's findings by code and severity with every error. They are the behaviour the
rebuild is measured against ([records/README.md](../records/README.md#baselines)).

The game is never launched by a test on the development machine; loading content in the
running game happens only on the analysis machine the plan names, on the owner's word.

## Carried over from release 2.3.0

The old tests, fixtures and records are data and are carried over; the old code is not. The
table of what goes where is in
[PLAN.md](PLAN.md#what-is-carried-over-from-230). In short: 74 parser cases, the engine's 250
unit tests with 3 golden files and 3 fixture mods, the extension's 485 tests and 77 fixture
files, the classification rules for real-mod errors, and the plug-in catalogue.

## What does not exist yet

- **A real game error log.** Release 2.3.0's log fixture is hand-written and its format is
  unverified. Build step 11 starts by capturing real ones.
- **The planted-defect mod and the content requests.** Steps 6 and 9.
