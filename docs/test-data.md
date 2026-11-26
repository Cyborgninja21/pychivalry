# pychivalry: test data

Every kind of data the tests run on, where it lives, whether it is committed, and which suite
uses it. A step that adds test data adds it here.

| Kind | Where | Committed | Used by | Runs in public CI |
| --- | --- | --- | --- | --- |
| Hand-written mods | [`fixtures/mods/`](../fixtures/mods/README.md) | Yes | Every package's tests | Yes |
| Game stubs | [`fixtures/game/`](../fixtures/game/README.md) | Yes | Tests that need a base game: the index's override fixtures, the checks that are silent without one, lookup, the planted-defect mod | Yes |
| The planted-defect mod | [`fixtures/defects/`](../fixtures/defects/README.md) | Yes | The scored agent-use test's test sessions; its graders' own tests; the built agent server's `check` on it; the extension's smoke test and same-answers test (`task vscode:test`) | The tests, yes; the test sessions never |
| Content requests | [`fixtures/requests/`](../fixtures/requests/README.md): twenty-four requests, twelve of them expert, added after the second run (two more retired after the first run), three base mods, an example result of each; for each expert request a hand-made first draft with the mistake it invites, and what fails it (`drafts/`); for the judge's calibration, ten hand-made results with a sheet for grading them (`calibration/`), twelve real results of the second scored run, trial 1 of each of its requests, with a sheet of their own (`calibration/run-2/`), and twenty-four hand-made results of the expert requests with a third sheet (`calibration/expert/`); hand-made, labelled cases of what the judge is given, each from a case a run found it getting wrong (`judge/`: the logic every `trigger-loyal-realm` result of the expert requests' development run wrote, which the judge of version 1 answered no from its memory of the game) | Yes | The scored authoring test's test sessions; its tests (what the judge is given for the labelled case and its first draft, word for word, the requests' names against the spec package, the expectations on the examples, each first draft failing for its reason, the repair of the drafts through the built agent server, the run against a stand-in (which can give one trial of a run a stream of its own: one that reads outside its mod, or breaks), the three calibration sheets, the real results holding only the mod's own files); the hand checklist's authoring requests; the owner's hand grading | The tests, yes; the test sessions never |
| Captured game logs | `fixtures/logs/` (step 11) | Yes | Game-log analysis | Yes |
| The five real mods | Outside the repository, in the folder `CK3_CORPUS` names; pinned by [`records/corpus/MANIFEST.tsv`](../records/corpus/README.md) | The manifest only | `task game:index`, `task game:mods`, `task game:bench`, `task vscode:corpus`, the 2.3.0 baselines | No |
| A real VS Code | Downloaded by `@vscode/test-electron` into `.vscode-test/` (the release `packages/vscode/src/editor/version.ts` pins, 1.147.0), cached by CI | Never | The extension's editor tests, `task vscode:test` and `task vscode:corpus`; on Linux only on a virtual display | Yes, in a job of its own (`vscode-test`), not in `task ci` |
| The base game | The local install, in the folder `CK3_GAME_PATH` names | Never | `task game:parse`, `task game:index`, `task game:check` and the suites above | No |
| Classifications | `tools/data/`: what the base game's parse errors and check findings are, and the five mods' check errors, each with its reason | Yes | `task game:parse`, `task game:check`, `task game:mods` | No |
| Records | [`records/`](../records/README.md) | Yes | Public CI checks each one against the committed spec and corpus (a 2.3.0 baseline against the committed format 4 copy) | The check, yes |
| The spec package | [`spec/`](../spec/README.md): the 1.21.0.3 package in format 9 (its override rules are part D1), its companions, and the format 4 copy for 2.3.0 (the format 8 pass's, which 2.3.0 reads) | Yes, gzipped | Every reader of the spec; the index and its override fixtures; the parse and index suites; the 2.3.0 baselines (the format 4 copy) | Its check, yes; the tests read the package file |
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
in its `expected.json`, what a correct index answers for every name: a winner where a row of the
spec package's rules table (part D1) decides the rule, every definition and no winner where no
row decides it; a case that differs by platform (letter case) is written once for each. Item
4.2 added to them a landed title nested in another, a culture history named by its file, a
constant in two files, a define written twice in one block, two files under `replace`, and files
below subfolders of a folder read without them and of one whose depth is not settled. The format
9 adoption (2026-11-25) added a gene the mod replaces, whose templates go with it (`on_replace`),
and a province id written `003` where the stub writes `3`, one key compared as an integer
(`key_identity`); a `MOD_` key of a modifier to the lookup stub; and `scope:actor`, a name the
game saves from its own code, to the event-target pair. A fourth
mod, `index-definitions-and-uses`, lists every definition and every use of a defined name the
index must find, and none it must not. The list is in
[fixtures/mods/README.md](../fixtures/mods/README.md).

Build step 4 added the first check pairs, one per check of item 4.2: `names-unknown-trigger`,
`names-unknown-effect`, `names-unknown-link`, `names-unknown-modifier`, `names-unknown-on-action`
and `names-modifier-outside-use-area`, each a `-bad` mod the
check fires on and a `-good` mod that differs from it only in the defects. A bad mod's
`expected.json` lists every finding of every check on it; the good mod has none. Each check's
test (`packages/core/src/check/<name>.test.ts`) indexes the mod on its own and runs every check
on its files. The rules of reading the checks follow are tested on a few lines of text each, in
`packages/core/src/check/context.test.ts`.

Items 4.4 to 4.8 added a pair for every check they built: 3 for the scope checks (4.4), 10 for
fields and structure (4.5), 4 for event targets and localization (4.6) and 28 for the advice
checks (4.7), 51 pairs in all with item 4.2's six. A pair's `expected.json` lists its own
check's findings and those of every check that is not advice; the advice checks are tested on
their own pairs. The three checks that report nothing without a base game are read over a
second game stub, [`fixtures/game/event-targets-and-localization`](../fixtures/game/README.md),
which saves a scope and defines two localization keys. Lookup (4.8) reads the mod
`lookup-definitions-and-uses` over a third stub, [`fixtures/game/lookup`](../fixtures/game/README.md),
and answers for names of every kind the package has (`packages/core/src/lookup/lookup.test.ts`
reads its expected texts from the committed package). The command line (step 5) is tested on
these mods and stubs, on stubs its tests write, and against release 2.3.0's golden output for
its `example-mod`, read in place in `legacy/`. Item 4.11's limits are tested on mods written
in the test and on every bad half run with no game folder
(`packages/core/src/check/limits.test.ts`). The list is in
[fixtures/mods/README.md](../fixtures/mods/README.md).

Build step 8 added three mods. The fixes (items 8.6 and 8.7, #146) are tested on two:
`fix-near-values`, three advice findings each a misspelling of exactly one value (a
suggestion each, since advice is never fixed safely), and `fix-scope-links`, the fixes of the
scope findings from the links the finding names (a safe one where one plain link leads there,
suggestions where two do); both read over the stub `planted-defects`, and each fix applied
takes its finding away and brings no other. The language server's use of the presentation data
(item 8.8, #144) is tested on `presentation-outline-and-hints`, whose README lists what a
correct server answers for its outline, completion and inline hints. The list is in
[fixtures/mods/README.md](../fixtures/mods/README.md).

The formatter (items 8.2 to 8.5) added a fixture pair for each of the nine `style/` codes,
`style-<name>-bad` and `-good`, each the same scripted effects and localization file, the bad
half breaking one rule of [formatting.md](formatting.md) and the good half in the format
(`\r\n`, the byte-order mark); their bytes are exact on every platform (`.gitattributes`). And
a new part, [`fixtures/format/`](../fixtures/format/README.md): the golden files, 21 pairs
written by hand, `<name>.before.<ext>` and the `<name>.after.<ext>` the formatter must make of
it, one a rule, byte for byte, on which on-type formatting is also proved. At first only the
pair `names-unknown-trigger-*` was brought into the format; since the owner's word of
2026-11-23 (decision 110) every fixture mod is in the format, but for exactly what it exists to
test, kept byte for byte: a file with a parse error, a file not valid UTF-8, the bad half of a
`style/` pair, three localization files written without the byte-order mark. Each fixture's
findings outside the `style/` family were the same before and after (same codes and counts,
each on the same text with the same data; only lines and columns moved), and the expected
outputs that moved were made again; `packages/core/src/format/fixtures.test.ts` holds every
fixture in the format but those. The tests of other checks still leave the `style/` family out.

The best-practice rules of `style/` (#148, decision 112) added five pairs: `style-not-utf8`,
`style-empty-block`, `style-deep-nesting`, `style-unusual-field-order` and
`style-localization-key-characters`, each in the format but for what it tests
(`style-not-utf8-bad` holds Windows-1252 bytes and its scripted effect lacks the mark; its bytes
are exact), so that a test can apply each rule's fixes and find the formatter has nothing left to
change. The existing `encoding-windows-1252` also tests the conversion: its four bytes convert
safely; since decision 113 it shows one finding, the warning `style/not-utf8`, and no note.

The checks the spec package's format 9 unblocked (2026-11-25) added five pairs, each in the
format: `structure-triggered-desc-other-field` (a `first_valid` beside a `triggered_desc`'s
`trigger` and `desc`), `scope-title-text-reads-scope-saved-late` (a dynamic title whose
localization text reads a scope saved only in an option, through both of part D9's forms the
check reads), `style-redundant-condition` (an `always = yes` in an `AND` and in a `NAND`, whose
safe fixes leave the file in the format), `style-option-without-ai-weight` (an option with no AI
weight beside one with it, and an event of one option, not judged) and
`variables-read-without-set` (three reads that nothing sets in their namespace and kind, read
over the stub `event-targets-and-localization`, which now also sets a variable). The pair
`localization-unbalanced-brackets` gained four openers left open and a `]` inside an open
parenthesis, which the check does not decide. 70 check pairs in all.

The hint for a condition that always fails where it changes nothing (decision 158) added one pair,
in the format: `style-redundant-false-condition` (an `always = no` in an `OR`, a `NOR` and an
`all_false`, each beside two other conditions, whose safe fixes leave the file in the format).
71 check pairs in all. The requests' frozen results were brought into
`style/option-without-ai-weight` (decision 160): every option of the example results and of the
expert sheet's hand-made results that had no AI weight now has one
([fixtures/requests/README.md](../fixtures/requests/README.md)). Since decision 163 the pair
`style-redundant-condition` also holds an `any_false`, with an `always = yes` beside two other
conditions in the bad half, reported, its safe fix leaving the file in the format; 71 check pairs
still.

## The planted-defect mod

[`fixtures/defects/`](../fixtures/defects/README.md), written by hand in build step 6 (items 6.7
to 6.9) and made harder after the first test sessions (decision 83): a "Harvest Festival" mod,
`mod/`, of 17 files and 563 lines, in pychivalry's format but for its defects, with 36 planted
defects, every check code of this build that is an error or a warning at least once (21 errors
and 9 warnings, the `style/` family's two among them, `structure/triggered-desc-other-field` since
format 9; four codes twice; and the hint of the planted formatting defect), and 29
lines that look wrong and are not; `manifest.json`, which gives each defect's code, the line the
checker reports it at, the text of that line and the lines a fix may change, and each
look-alike with why it is right; and `reference/`, the same mod with every defect fixed. Some
defects need a lookup to fix, some interact (the obvious fix of one makes another), and some
are fixed away from the line the finding points at. It is checked over its own game stub,
[`fixtures/game/planted-defects`](../fixtures/game/README.md), which defines the tradition and
the scripted effect the mod uses and does not define itself, so CI needs no game.

On `mod/` the checker reports exactly the planted defects (26 errors, the clash at both of its
definitions, 10 warnings and 1 hint); on `reference/`, nothing
(`tools/src/scored-run/defects.test.ts`). Since format 9 every option of its shown events with
several options gives the AI a weight (`ai_chance`), in both copies, so that the best-practice
hint `style/option-without-ai-weight` finds nothing. The built agent server gives the same 37 findings
(`tools/src/scored-run/server.test.ts`). It is what the scored agent-use test is graded on: in
each test session of the developer's own Claude Code an agent is asked to fix a fresh copy, and
the trial passes when the checker reports no errors, every planted defect is gone, nothing else
changed, the look-alikes are untouched and nothing was deleted
([tools/scored-run/README.md](../tools/scored-run/README.md)). The graders' tests run in CI;
the test sessions never do. The first five test sessions (item 6.11, 2026-11-23) ran on the
first mod, of 27 defects and 10 look-alikes, which was replaced by this one because each of them
fixed every defect in about a minute; their record is `records/scored/agent-use.json`, and how
each defect was fixed is in
[tools/scored-run/README.md](../tools/scored-run/README.md#each-planted-defect).

## The extension's editor tests

`task vscode:test` ([packages/vscode/src/editor/](../packages/vscode/src/editor/)) starts a real
VS Code four times, each with throwaway user-data, extensions, home, cache and Claude Code
configuration folders, on copies of committed test data written into a temporary folder:

- `main`: the extension from its folder, on a copy of the fixture mod
  `parse-missing-closing-brace` with a localization file the runner adds; the game stub
  `planted-defects` is the game folder the setting is changed to.
- `smoke`: the packaged `.vsix`, installed by VS Code's own installer, on a copy of the
  planted-defect mod in a folder whose name holds a space, with `pychivalry.gamePath` naming its
  game stub. Its same-answers test compares the editor's, the command line's (typed into a
  terminal of that VS Code) and the agent server's findings: 38 in its 16 checked files, 26
  errors, 10 warnings and 2 hints. The mod being in pychivalry's format, the copy writes one
  file, `events/harvest_faith_events.txt`, with `\n` line breaks, so that the same-formatting
  test still proves Format Document turns a document's `\n` into `\r\n`; that file adds the
  formatter's warning and hint to the planted defects' 36.
- `update-1`, `update-2`: two versions of the extension written by test code as installable
  files, on the same fixture mod copy.

Claude Code is a stand-in that writes its configuration as Claude Code 2.1.220 does
(`claude-stand-in.ts`), unless `PYCHIVALRY_TEST_CLAUDE` names a real one, whose own
configuration commands are then run against the throwaway configuration folder only.

`task vscode:corpus` runs the packaged extension on each of the five real mods with the game,
locally: the speed of the editor ([MVP.md](MVP.md#speed)) and the same-answers test on each mod.
It prints its figures and writes no record.

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

The largest, `rice`, is also the agent server's size test (docs/PLAN.md item 6.3,
`packages/mcp/src/size.test.ts`): a local game-file test that runs only where `CK3_GAME_PATH` and
`CK3_CORPUS` are set, calls every tool on it over the real base game, holds each result under
10,000 tokens, and holds `check`'s totals equal to the rice entry of `records/game/mods.json`. In
CI the same test runs on a mod it writes into a temporary folder: thousands of unknown triggers,
a name defined in 100 files and used 3,000 times, and 3,000 localization keys.

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

`task game:check` runs every check on those 17,302 files and `task game:mods` on each of the
five mods, through the same code the command line runs; their records are
`records/game/check.json` and `records/game/mods.json`
([records/README.md](../records/README.md#check-records-gamecheck-gamemods)). Every error and
warning the base game raises is classified in `tools/data/check-classifications.json`, as a
defect of the game's own files or a fault of the spec package, each with its reason; every
error of the five mods in `tools/data/mods-classifications.json`, as a real defect with its
reason. A finding with no entry, or an entry that matches no finding, fails the suite.

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

The planted-defect mod is in pychivalry's format but for its defects, and plants the `style/`
family too: a formatting defect and a file not valid UTF-8, which its tests and graders count
like any other (decision 110).

## What does not exist yet

- **A real game error log.** Release 2.3.0's log fixture is hand-written and its format is
  unverified. Build step 11 starts by capturing real ones.
- **Results of a test session graded by hand.** Real results exist since the second scored
  authoring run (2026-11-24), which kept its trials: twelve of them, one of each request, are
  committed with a sheet (`fixtures/requests/calibration/run-2/`), beside the ten hand-made ones;
  neither sheet is graded yet ([guide/judge-calibration.md](guide/judge-calibration.md)).
- **A committed result of a test session on the expert requests.** Their development run
  (decision 134) finished on 2026-11-25: 61 trials, kept outside the repository by the run, and
  its record is committed (`records/scored/authoring-expert-run-1.json`); their second, on tool
  schema version 5 (decision 165), finished on 2026-11-26: 60 trials, kept the same way, its record
  committed too (`records/scored/authoring-expert-run-2.json`). None of their results is
  committed: the drafts, the third calibration sheet and the judge's labelled case are hand-made
  (the case holds the logic the first run's five `trigger-loyal-realm` results wrote, written by
  hand).
