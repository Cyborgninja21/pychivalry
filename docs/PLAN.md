# pychivalry: build plan

Status: plan for approval, 2026-11-22. Step 0 is done: the 1.21.0.3 spec package in format 7 is committed, its override rules table among its parts. Step 1 is complete, and steps 2 and 3 are built and merged, the index reading the override rules from the package. Item 4.1, the check inventory, is written and signed off; item 4.2 is built, its six checks, with item 4.3's context reader as its prerequisite, but for two iterator sub-cases that wait on the owner. Items 4.4 onward are next. The Progress table says what is open.

This is the "how" for the rebuild. The "what" and the "why" are in [MVP.md](MVP.md): the
decisions, the scope, the tests each feature needs and the definition of done. Where the two
disagree, MVP.md is right and this plan is fixed.

## How to read this plan

- The work is thirteen build steps, preceded by step 0, which happens in another repository.
- Steps run in order. A step is finished when every item under "Done when" holds. The next step
  does not start before that.
- Each step has the same parts: goal, what it depends on, the work items, the tests, what it
  delivers, done when, and what is not yet known.
- Work items are numbered `<step>.<item>` so they can be referred to and ticked off.

## Progress

| Step | Name | Needs the 1.21 spec | State |
| --- | --- | --- | --- |
| 0 | Spec work, in `pdx-parser-re` | It produces it | Done: the 1.21.0.3 package, adopted in item 1.6 in format 5 and replaced the same day by format 7 (decision 64), with its three companions, its schema `schema.format7.json` and a new format 4 copy. Format 7 carries the override rules table (D1) and the other held requests (D2 to D8) |
| 1 | Repository skeleton | Two items only (1.6, 1.11) | Complete (pull requests #114, #115 and #124). Item 1.6: the 1.21.0.3 package is committed, gzipped. Item 1.11: the speed and result baselines of 2.3.0 are recorded on its format 4 copy |
| 2 | Parser | No | Built and merged (pull request #116). Item 2.6's public codes are left to item 4.1, which maps the syntax finding identifiers to them |
| 3 | Workspace index | No for the index; the override rules table comes from step 0 | Built and merged (pull requests #118 and #120). The override rules come from the spec package's part D1 (the stand-in `spec/override-rules.json` is retired, decision 65): a settled or derived row decides, a partial or open row does not; parts D2 and D3 say what a definition is. Base-game names defined more than once with no winner known: 1,309 before, 118 now. Still open: character history defined twice (a partial row), the depth of the folders only partial rows or no row describe, the 32 folders with no row and `gui`, and the order of several mods or DLC packs (`docs/overrides.md`) |
| 4 | Engine checks and lookup | Yes, from item 4.2 on | Item 4.1 is done and signed off (pull requests #121 and #122): `docs/checks.md`, the check inventory and the code scheme; its codes are permanent. Item 4.2 is done on the format 7 package (pull request #125 and this one): the typed spec reader, its eight new parts typed, and the six checks (`names/unknown-trigger`, `-effect`, `-link`, `-modifier`, `-on-action`, `names/modifier-outside-use-area`), with item 4.3's context reader built as their prerequisite. Open in item 4.2: the iterator sub-cases of `names/unknown-trigger` and `names/unknown-effect`, which wait on the owner (no game message ties them to an iterator of the wrong kind). Next: items 4.4 to 4.11, by another agent |
| 5 | Command line | Through step 4 | Not started |
| 6 | Agent server | Through step 4 | Not started |
| 7 | Language server and extension | Through step 4 | Not started |
| 8 | Formatter and fixes | No, but follows step 7 | Not started |
| 9 | Skills and the authoring run | Through step 4 | Not started |
| 10 | GUI files, graphics check, call graph | Partly | Not started |
| 11 | Game-log analysis, in-game load | Yes | Not started |
| 12 | Editor views | No, but follows step 11 | Not started |
| 13 | Benchmarks, legacy removed, 1.0.0 | Yes | Not started |

Steps 1, 2 and 3 and item 4.1 could be done before the 1.21 spec existed; the rest of the plan
runs on it.

## Working rules

These apply to every step and to every agent doing the work.

1. **One step, one branch, one pull request.** Branch `agents/step-<n>-<short-name>`, cut from
   `main`, worked in its own git worktree. The pull request is merged when the step's "Done
   when" list holds and a second agent that did not write the code has checked it.
2. **The step's section is the brief.** An agent executing a step reads MVP.md, this section,
   and the sections of the steps before it.
3. **Tests first where a record exists.** Where 2.3.0 has a test, a fixture or a record for the
   behaviour, it is carried over before the code is written.
4. **Nothing from `legacy/` is copied as code.** Tests, fixtures and records are data and are
   carried over. Reading the old code for how it solved a problem is expected.
5. **No name lists in the code.** A table a check needs comes from the spec package or from the
   user's installed game. If a step finds it needs a table the spec lacks, it stops and the
   table is requested from `pdx-parser-re`.
6. **Evidence for every error and warning.** A finding without game evidence is advice.
7. **`task ci` stays green and stays free** of any display, game file, model, key or network.
8. **A blocked item is a question for the owner,** asked at once. It is not a reason to start a
   later item.
9. **Game launches happen only on the analysis machine,** on the owner's word.
10. **Every step ends by updating** the Progress table above, `CHANGELOG.md`, and any document
    the step changed the truth of. In particular: the user guide (`docs/guide/`) for anything a
    user can see; `docs/references/` for a source used for the first time; `docs/test-data.md`
    and the page of the `fixtures/` part for new test data; `docs/decisions.md` for a decision
    asked, answered or made; `docs/README.md` for a new document; and the wiki manifest
    (`docs/wiki/manifest.json`) for a document users should find on the wiki.

## Technical choices

| Area | Choice | Why |
| --- | --- | --- |
| Language | TypeScript **6.0.3**, strict mode, one `tsconfig` base shared by all packages (`tsconfig.base.json`), ES modules | Decided. 6.0.3 rather than the newer 7.0.2: typescript-eslint 8.73.0, the current release, supports TypeScript below 6.1 only. |
| Runtime | Node 22 for development and CI (CI: **22.23.5**; `engines` `>=22.13.0`); the shipped servers run on VS Code's own bundled runtime | Node 22 is what is installed; users need no Node of their own. |
| Workspace | npm workspaces, one lock file at the root | What 2.3.0 used; no extra tool. |
| `packages/core` dependencies | None at run time | Decided: the core is dependency-free. |
| Tests | Node's built-in test runner (`node:test`, `node:assert/strict`) on compiled output, for every package except the extension; types from `@types/node` **22.20.5** | No test framework to keep current; agents run it with one command. |
| Extension tests | `@vscode/test-electron` driving a real VS Code; pinned in step 7, which adds it | The only way to test the extension as shipped. 2.3.0 used the same. |
| Bundling | esbuild, one single file each for the language server, the agent server and the command line; the spec stays a separate data file; pinned in the step that adds it | VS Code's own guidance; small and fast. |
| Language client | `vscode-languageclient` 11, started as a module over IPC; pinned in step 7 | Runs on VS Code's runtime on Linux and Windows. |
| Agent server library | The MCP TypeScript library, 2.x line (`@modelcontextprotocol/server`); pinned in step 6 | The current line; the 1.x line is in maintenance. |
| Lint and format | ESLint **10.15.0** with `@eslint/js` **10.0.1** and `typescript-eslint` **8.73.0** (`strictTypeChecked`); Prettier **3.10.1** | What 2.3.0 used. |
| Task runner | `Taskfile.yml` at the root; Task **3.54.0** in CI (developed with 3.50.0) | What 2.3.0 used; one entry point for agents. |
| Licence | Apache-2.0 | What 2.3.0 used. |
| Extension identity | Publisher `cyborgninja21`, name `pychivalry`, version 1.0.0 at release | Decided: a new identity. |
| Record checks | `ajv` **8.20.0** (JSON Schema 2020-12), in `tools/` only | Validates every record against `records/record.schema.json`; the core stays dependency-free. |
| CI actions | `actions/checkout` **v7.0.1**, `actions/setup-node` **v7.1.0**, `go-task/setup-task` **v2.2.0**, each pinned by commit | Pinned so a moved tag cannot change what CI runs. |

Versions are pinned to exact numbers when a step installs them, and written into this table.
Step 1 pinned the ones in bold (2026-11-21, the current releases on the npm registry and
GitHub); a tool that arrives later is pinned by the step that adds it.

## Repository layout

```text
AGENTS.md                 rules for agents working here
CHANGELOG.md
CONTRIBUTING.md           how to report a problem or propose a change
LICENSE
README.md
SECURITY.md               how to report a vulnerability
Taskfile.yml
package.json              npm workspaces root
tsconfig.base.json
.editorconfig  .nvmrc  .vscode/   editor settings that match the formatter
.github/
  workflows/ci.yml        public CI: Linux and Windows, fixtures only
  ISSUE_TEMPLATE/         the bug and feature forms
  pull_request_template.md
docs/
  README.md               the index: every document and the step that writes it
  MVP.md                  what and why
  PLAN.md                 this file
  decisions.md            every decision with its date; choices awaiting confirmation
  test-data.md            every kind of test data and where it lives
  references/             every source, its trust and copying rules, notes per source
  guide/                  the user guide: installing, commands, settings
  wiki/                   the wiki's home page, its manifest, how it is generated
  checks.md               the check inventory (step 4)
  encoding.md             what the parser reads (step 2)
  overrides.md            the game's override rules (step 3)
  formatting.md           the formatting rules (step 8)
  gui-syntax.md           GUI file syntax (step 10)
  game-log.md             the error-log format (step 11)
spec/
  ck3-spec-<version>.json.gz     the committed spec package file, gzipped
  ck3-spec-<version>.<part>.json.gz   its companions: info, gui, data_types
  ck3-spec-<version>[.<part>].sha256  checksum of each file's uncompressed bytes
  schema.format7.json            the package's own schema, from pdx-parser-re
  legacy/                        the same version in format 4, for the 2.3.0 baselines only
packages/
  core/                   parse, index, check, lookup, format, fix data
  cli/                    command line
  mcp/                    agent server
  lsp/                    language server
  vscode/                 the extension
skills/                   explain, fix, write content
presentation/             outline rules, snippets, field order, hints (step 8)
fixtures/
  mods/                   small hand-written mods, one behaviour each (from step 2)
  game/                   stubs of a base game (from step 3)
  defects/                the planted-defect mod, its manifest and reference copy (step 6)
  requests/               the content requests of the authoring run (step 9)
  logs/                   captured game error logs (step 11)
records/                  committed results of the game-file suites
tools/                    scripts behind the local tasks
legacy/                   release 2.3.0, unchanged, until step 13
```

Inside `packages/core/src`: `syntax/` (step 2), `index/` (step 3), `spec/` and `check/`
(step 4), `lookup/` (step 4), `format/` and `fix/` (step 8), `gui/` (step 10), `log/`
(step 11). Each check is one file under `check/`, with its test beside it.

## Environment for the game-file suites

| Variable | Meaning |
| --- | --- |
| `CK3_GAME_PATH` | The game's `game` folder: `<Steam library>/steamapps/common/Crusader Kings III/game` |
| `CK3_CORPUS` | The folder holding the pinned copy of the test mods, outside the repository |
| `CK3_CORPUS_SLUGS` | Which mods to run; default all |

The values on the machine that runs the suites are not written in this repository.

These names are the ones 2.3.0 used, so its scripts and records stay comparable.

---

## Step 0: spec work

**Where.** In `pdx-parser-re`, by another agent, to `spec/FORMAT_5_PLAN.md` in that repository.

**Done** (2026-11-21, adopted here 2026-11-22 in item 1.6): the 1.21.0.3 package in format 5
with all twelve of its parts built, its three companions, its schema, and the format 4 copy.
**Follow-up done** (adopted 2026-11-22, decision 64): the same package in format 7, which adds
the override rules table (D1) and the other requests held in [decisions.md](decisions.md)
(D2 to D8). No real error log came with it; item 11.1 starts by capturing them.

**What this plan needs from it.**

| Item | Needed by |
| --- | --- |
| The 1.21 spec in format 4 | Item 1.11, the result baselines |
| The 1.21 spec in format 5, with its checksum and schema | Item 1.6; step 4 from item 4.2 |
| The hand-kept tables, in the package | Items 4.2 to 4.5 |
| Value types, observed values, localization-key fields | Items 4.4, 4.5; completion in step 7 |
| Modifier use areas | Item 4.2 |
| The cleaned error catalogue | Item 4.1, item 11.3 |
| Paradox's `.info` documentation, as data | Lookup in item 4.6; hover in step 7 |
| The data-types dump | After the MVP: localization bracket checks |
| The GUI vocabulary | After the MVP: GUI checks |
| Real error logs from the analysis machine | Item 11.1 |
| The override rules, as a table: each rule, its evidence, the platforms it holds on (Windows and Linux both analysed) | Items 3.2 and 3.6. Delivered in format 7 as part D1 (Windows read for every row, Linux for the localization reader, the rest of Linux on the owner's decision that the engine is the same); the stand-in table is retired |

**The contract.** The format 5 layout is the table "Format 5" in that plan. The spec reader in
item 4.2 is written against it. If the other agent changes the layout, that plan is updated
first and this one follows.

---

## Step 1: repository skeleton

**Goal.** A repository an agent can clone, build and test in one command, with the game-file
suites and their records wired up, and the 2.3.0 baselines on record.

**Depends on.** Nothing for most items. Items 1.6 and 1.11 need step 0.

**Work items.**

- 1.1 Root files: `README.md` (what pychivalry is, state of the rebuild, how to build),
  `LICENSE` (Apache-2.0), `CHANGELOG.md`, `.gitignore`, `.gitattributes`. The repository has
  had no root README or licence since everything moved to `legacy/`.
- 1.2 npm workspaces root, `tsconfig.base.json`, and an empty buildable package for each of
  `core`, `cli`, `mcp`, `lsp`, `vscode`. Exact tool versions pinned and written into
  "Technical choices".
- 1.3 `Taskfile.yml`: `install`, `build`, `test`, `lint`, `format:check`, `ci` (all of the
  preceding), and the local tasks of item 1.8.
- 1.4 `AGENTS.md`: the working rules above, how to add a check and its test, how to run each
  suite, what may and may not be committed.
- 1.5 `.github/workflows/ci.yml`: `task ci` on Linux and Windows, on pushes and pull requests.
  No self-hosted runner. No secrets.
- 1.6 The spec package under `spec/`, with its checksum file and schema. `task ci` verifies the
  checksum and the format number. Decide compressed or raw here: 2.3.0 compressed it because a
  commit hook refused files over 1 MB; the package is about 7 MB. **Needs step 0.** Until
  then the 1.20.0.2 package is committed as a stand-in so the check exists.
  **Done** (2026-11-22): the 1.21.0.3 package, format 5, its three companions and its schema,
  committed gzipped by the owner's decision; `task spec:check` verifies every file's checksum,
  the companions the package lists, the JSON Schema and the format 4 copy kept for 2.3.0 in
  `spec/legacy/` ([spec/README.md](../spec/README.md)). Replaced the same day, on the owner's
  go, by the 1.21.0.3 package in format 7 (decision 64): the same twelve parts and eight more,
  the override rules table among them, with `schema.format7.json` and a new format 4 copy.
- 1.7 The record format, in `records/README.md`: every record is JSON and states the suite,
  the tool version and commit, the game build and the hash of the game's file manifest, the
  spec version and checksum, the corpus manifest hash, when it was made, and the results.
- 1.8 The local tasks behind the game-file suites: `task game:parse`, `game:check`,
  `game:mods`, `game:bench`. Each reads `CK3_GAME_PATH` and `CK3_CORPUS`, writes its record
  under `records/`, and exits non-zero on a failed pass condition. Each is a stub in this step
  that writes a valid, empty record.
- 1.9 Public CI checks the records: each is valid against the record format, and its spec
  checksum equals the committed spec's. A record made on an older spec fails the check, so a
  spec change forces the suites to be re-run.
- 1.10 The mod corpus: the five mods copied from the Steam workshop cache into `CK3_CORPUS`,
  `music/` folders left out as 2.3.0 did, with `records/corpus/MANIFEST.tsv` (slug, workshop
  id, name, supported version, file count, hash). Workshop ids: elf-destiny 3114064450, rice
  2273832430, viet-events 2227658180, divine-intervention 2986538297, balance-of-power-ui
  3157042775.
- 1.11 The 2.3.0 baselines, by building `legacy/` and running it on the current game:
  - **Speed**, now: parse time, base-game load time, whole-mod check time and peak memory for
    each of the five mods; editor time to first full result. Each is the median of at least
    five runs, cold start and warm start kept apart, with the machine described in the record.
  - **Results**, when the 1.21 format 4 spec exists: the base-game parse and check counts, and
    the five mods' findings. **Needs step 0.**
  - **Done** (2026-11-22): both re-recorded on game 1.21.0.3 with the 1.21.0.3 format 4 copy,
    the speed baselines replacing those made on the 1.20.0.2 spec; `task records:check` ties
    every baseline to that copy, the game build and the corpus
    ([records/README.md](../records/README.md#baselines)).

- 1.12 The documents index (`docs/README.md`) and the decision log (`docs/decisions.md`).
- 1.13 References: `docs/references/`, an index of every source with its place in the order of
  trust and what may be copied from it, and a notes page per source.
- 1.14 Test data: `docs/test-data.md`, and `fixtures/` in three parts, `mods/`, `game/` and
  `defects/`, each with a page stating its layout and rules. The steps that fill them follow
  those pages.
- 1.15 The user guide, `docs/guide/`: installing, commands, settings, stating what is decided
  and built. Each later step adds what it ships; item 13.7 completes it.
- 1.16 The repository wiki, generated from `docs/`: the manifest and home page in
  `docs/wiki/`, `task wiki:check` in `task ci`, `task wiki:build` and `task wiki:publish`.
  Publishing leaves pages it did not write alone unless told to remove them.
- 1.17 Community and editor files: `CONTRIBUTING.md`, `SECURITY.md`, the issue forms and the
  pull-request template, `.editorconfig`, `.nvmrc`, `.vscode/`; the repository's description
  and topics on GitHub.

**Tests.** `task ci` passes from a clean clone on Linux and Windows. The record checker
rejects a record with a wrong spec checksum and a record with a missing field. The wiki build
rejects a published document that is missing or holds a link that points at nothing.

**Delivers.** The layout above, a green CI, the corpus manifest, the speed baselines.

**Done when.**

1. A fresh clone builds and passes `task ci` with no display, game, model or key.
2. Public CI is green on Linux and Windows.
3. The speed baselines are committed, each a median of at least five runs.
4. Items 1.6 and 1.11 are either complete or listed as open in the Progress table, waiting on
   step 0.

**Not yet known.** Whether 2.3.0 runs cleanly on the 1.21 game with a 1.20.0.2 spec for the
speed runs. It should, with more "unknown" findings; the speed figures barely depend on that.

**Found** (item 1.11): it does, with an 8 GiB heap limit for the base game; and on the 1.21.0.3
format 4 copy, once its loader accepted the `since` value `1.21.0.3` (the one change under
`legacy/`, the owner's decision).

---

## Step 2: parser

**Goal.** Every script file of the base game becomes a syntax tree, and broken input still
does.

**Depends on.** Step 1.

**What 2.3.0 did.** A hand-written lexer and a recursive-descent parser for `.txt` script
files only. It read UTF-8, skipped a leading byte-order mark, and always returned a tree. Its
parser tests are 74 cases in two files. It has one fixture for broken input.

**Work items.**

- 2.1 `docs/encoding.md`: what the parser reads. UTF-8 with or without a byte-order mark is
  the base; in the 1.20 base game 3,363 of 4,035 script files had the mark. This item scans
  the 1.21 base game for files that are not valid UTF-8 and decides, with the count in hand,
  what happens to them.
- 2.2 The position model: offsets and UTF-16 columns, with the byte-order mark not counted, so
  positions match what VS Code and the language-server protocol use.
- 2.3 The lexer. Tokens it must produce, each with a test:
  - the operators `=`, `==`, `!=`, `?=`, `>`, `<`, `>=`, `<=`; `?=` only after a name or a
    scope chain;
  - quoted text, which may span lines, with `\"` and `\\` as the only escapes;
  - comments, kept in the tree;
  - numbers, and dates in the form year.month.day;
  - `@name` constants, and `@[ … ]` inline arithmetic as one token;
  - a scope chain as one token, including a dot inside `|…|`; `namespace.0001` stays a name;
  - `$PARAM$` macro parameters, including in the operator position.
- 2.4 The parser. Forms it must accept, each with a test: `key = value`, `key = { … }`,
  anonymous blocks, lists of bare values, mixed lists, numeric and date keys, an operator as a
  value, `list "name"`, colour values (`rgb`, `hsv`, `hsv360`, in either letter case), and
  file-local `scripted_trigger name = { … }` and `scripted_effect name = { … }` definitions.
- 2.5 Error recovery. The parser always returns a tree. One recovery path per error, each with
  a broken-input fixture, including text cut off mid-edit. The base game's own known defect,
  a block with no `=` before it, must recover the way the game does.
- 2.6 Parse errors as findings, in the structured shape from principle 3 of MVP.md. Codes come
  from the spec's error catalogue where a message exists; the two that have none in 2.3.0 are
  an unterminated string and a malformed inline arithmetic block.
- 2.7 Incremental re-parse: an edit re-parses the affected part and reuses the rest.
- 2.8 The base-game parse suite, `task game:parse`: an explicit list of folders and file
  extensions with the expected file count for each, the parse time, and every parse error.
- 2.9 The 74 parser cases from 2.3.0, carried over as table fixtures.

**Tests.** Rows "Parser" in MVP.md's table. The broken-input set has at least one fixture per
recovery path.

**Delivers.** `packages/core/src/syntax/`, `docs/encoding.md`, the parse record for the 1.21
base game.

**Done when.**

1. Every script file in the suite's folder list yields a tree.
2. Every parse error in the base game is listed in the record with a classification.
3. All carried-over cases and all broken-input fixtures pass.
4. A re-parse after an edit gives the same tree as a full parse, on every fixture.

**Not yet known.** How many base-game files are not valid UTF-8, and which folders beyond
`common`, `events` and `history` hold script the parser should read (2.3.0 covered those three
only; `gfx` has 272 `.txt` files).

**Found** (build step 2, [encoding.md](encoding.md)): 27 of the base game's 20,530 text files
are not valid UTF-8, 25 of them title histories with Windows-1252 letters in comments; the
owner decided what happens to them (decision 38). Beyond the three, `gfx`, `map_data`,
`music`, `sound`, `dlc`, `data_binding` and `content_source/map_objects` hold script: 4,854
files in all, each with the evidence for it.

---

## Step 3: workspace index

**Goal.** Know every definition and every use in the mod and in the whole base game, follow
the game's override rules, and keep the result on disk.

**Depends on.** Step 2.

**What 2.3.0 did.** An in-memory index of every mod file, and of seven base-game folders only.
Nothing was saved on disk. "Defined" meant "in the mod or in the base game": no load order, no
replaced paths, no DLC precedence. All of this step beyond the basics is new work.

**Work items.**

- 3.1 `docs/overrides.md`: the game's override rules, established before any code, from the
  game's own files: `paths.settings`, mod descriptor files, Paradox's `.info` files, the
  executable's message texts and what the base game's files depend on. It covers a later file
  overriding an earlier one, whole-record against field-by-field replacement, `replace_path`,
  DLC folders, the install's three folders, localization, letter case, and the order files load
  in. Each rule is marked settled or open. **Done.** Six rules are open.
- 3.1a The override rules as data. The rules are a table, never code: each row names the rule,
  the folders it applies to, what wins, its evidence, and the platforms it holds on. The table
  comes in the spec package from step 0, which reads the open rules out of the Windows and
  Linux executables. Until it arrived, a stand-in table under `spec/` carried only the rules
  overrides.md marks settled. The core reads the table; it holds no rule of its own. **Built:**
  first a stand-in, `spec/override-rules.json`; since 2026-11-22 the spec package's part D1,
  read by `rulesFromSpec` ([spec/README.md](../spec/README.md#the-override-rules-table)) and
  checked by `task spec:check`; the stand-in is retired (decision 65).
- 3.2 A fixture mod and a fixture game stub that exercise every rule in `overrides.md`. For a
  settled rule the fixture states the winner. For an open rule it states both definitions and
  that no winner is given.
- 3.3 What a definition is, per folder: the record's key, taken from the spec's folder list and
  record schemas. Events, scripted effects and triggers, script values, on-actions, decisions,
  interactions, traits, modifiers, localization keys, and every other folder the spec lists.
- 3.4 References: every use of a defined name, with its position.
- 3.5 The base-game index: every folder the spec lists, not seven.
- 3.6 Layering, neutral by default. The index records every definition with the layer it came
  from (the install's folders, a DLC, the mod), its file's relative path and its place in the
  file. It names a winner only where the rules table has a rule for that folder and platform.
  Where the table has none, the index answers "defined more than once, winner not known", and
  a check or lookup that depends on the winner stays silent. Nothing is guessed. When the
  table gains a rule, the answer changes with no change to the code.
- 3.6a The game is on the same computer (MVP.md, "Where the game is"). The index reads the game
  folder from the local disk. A game on another computer comes after the MVP; the index does
  nothing that would rule it out: the game folder is a parameter, the cache is keyed by the
  game's build and file manifest and kept in the user's cache folder, and lookups do not
  assume one letter case.
- 3.7 Incremental update: a changed file updates its own entries and marks the files that use
  the names it defines.
- 3.8 The on-disk cache of the base-game index: keyed by the spec checksum and a hash of the
  game's file manifest; written atomically; a version number in the file so a format change
  invalidates it. Stored in the user's cache folder, never in the mod.
- 3.9 Localization as index data: keys per language, entries with and without a version
  number, the byte-order mark handled.
- 3.10 File lookup without regard to letter case, and paths classified by whole folder names.

**Tests.** Rows "Workspace index" and "Index cache" in MVP.md's table.

**Delivers.** `packages/core/src/index/`, `docs/overrides.md`, the override fixtures.

**Done when.**

1. On the fixture mod, every definition and use is found and none is invented.
2. Overrides resolve as the rules table says on every fixture case; with a rule missing, both
   definitions are reported and no winner is given. The step is complete for the rules the
   table holds; each rule step 0 adds later is covered by its fixture with no code change.
3. A reloaded cache answers exactly as a fresh index; changing the spec or the game manifest
   forces a rebuild.
4. Indexing the whole base game is timed and the figure is in a record.

**Not yet known.** The override rules themselves (open question 1 in MVP.md). How much memory
a whole-base-game index takes; 2.3.0's partial index peaked near 1 GB on the largest mod.

**Found** (item 3.1, [overrides.md](overrides.md)): the game's own files settle that a mod's file
replaces the base-game file at the same relative path, whole; that a file is identified by its
whole relative path; the rules of events and character history (override priorities), of
on-actions (declarations add up), of defines (field by field) and of container keys; and that
on game 1.21.0.3 no DLC file collides with the base game. They do not settle the order files
are read in, whether a key defined again replaces the whole record, which of the install's
`game/` and `jomini/` copies is used, localization's duplicate keys and `replace` folder,
`replace_path`, or the letter case of paths. Each of those has an in-game experiment in
overrides.md; by the owner's decision of 2026-11-21 they are not run for now, and the open rules
are read out of the executable by step 0 instead (item 3.1a). The base game spans three folders of the install: `jomini/` and `clausewitz/`
beside `game/` hold script and localization too.

**Found** (items 3.1a to 3.10, [records/game/index.json](../records/game/index.json)): on game
1.21.0.3 the index reads 17,272 files of 219 folders the spec lists, in four layers (88 files of
`clausewitz/`, 230 of `jomini/`, 16,910 of `game/`, 44 in 23 DLC packs), and holds 3,344,507
definitions (3,100,873 of them localization keys in 11 languages) and 9,017,490 uses, 5,075,832
of them of a defined name. 13,007 names are defined more than once: 11,662 are province-terrain
statements, 33 add up (on-actions, define groups, container keys), 3 are the character ids the
game itself calls an error, and 1,309 have no winner known: 638 under rule 6's open part (the
history of provinces and titles), 440 under rule 5, 231 under rule 3. The build takes 13.5
seconds and peaks at 1.30 GiB; the cache is 250 MiB and reloads in 0.9 seconds, answering
exactly as the fresh index. Gaps the spec work can close: 14 folders beside the spec's hold
1.21 files the 1.20 spec does not describe (`common/districts`, `common/trade` and others);
eight folders of the 1.20 list hold no file the index reads on 1.21; the three history folders whose records are named by their
file (`history/cultures`, `history/situations`, `history/struggles`) have no keyed definitions;
a landed title's nested titles are not definitions, because nothing says its nested keys are
titles; and `namespace` in an event file is a top-level value with no row, defined 631 times.
Re-measured on the 1.21.0.3 package (item 1.6): 236 folders indexed, 17,302 files; 12 folders
of 103 files are still not described, 3 of them beside the spec's (`common` itself,
`gfx/tools`, `map_data`); the same eight folders hold no file; 1,309 names still have no winner
known. Re-measured on the format 7 package with its override rules (part D1) and parts D2 and
D3 (item 4.2, [records/game/index.json](../records/game/index.json)): 17,302 files, 3,370,975
definitions (`namespace` no longer one; 21,647 more, the nested titles and the other nested
definitions D3 confirms, and 154 culture histories named by their files) and 9,068,424 uses;
12,845 names defined more than once, of which 164 now have a winner, 672 add up, 229 have one
definition in force, 11,662 are province-terrain statements and 118 have no winner known, down
from 1,309: 93 with no row of the table (the folders the package leaves without a rule, the
coats of arms written both as a record and as a value, and nested names written twice under
one parent), 22 in files below a subfolder whose depth no settled row states (`sound`,
`gfx/portraits`, `gfx/map/map_object_data`, `music`) and 3 character ids under the partial
character row. The 3 character ids are no longer a clash: the row that made them one is
partial.

---

## Step 4: engine checks and lookup

**Goal.** Tell the modder what the game would say, with evidence, and answer any question
about a name.

**Depends on.** Step 3. From item 4.2 on, the 1.21 spec in format 7.

**Work items.**

- 4.1 **The check inventory, `docs/checks.md`.** One row per check: code, severity, what it
  finds, its evidence (or "advice"), the 2.3.0 check it replaces, the fixture pair that tests
  it. Sources: 2.3.0's engine codes (about 14 from the catalogue, 6 of its own), its plug-in
  catalogue of 85 codes, the audit record, and for advice only the 38 required-field flags and
  89 rule codes of the pre-2.0 schema files. The code naming scheme is fixed here; codes are
  permanent. The syntax findings of step 2 already have stable identifiers and catalogue
  evidence ([encoding.md](encoding.md#what-the-parser-reports)); this item gives each its code,
  and confirms or changes the information severity of the three that have no catalogue
  message. ck3-tiger and the CWTools rule files are looked at here for rules worth taking,
  each proved against the game before it is adopted. *Needs no spec.*
  **Done and signed off** on 2026-11-21: [checks.md](checks.md). Its codes are permanent.
- 4.2 **The spec reader** and the unknown-name checks. The reader verifies the checksum and the
  format, and exposes the package as typed data. Checks: unknown trigger, effect, scope link,
  list, modifier and on-action; name templates (the `%s` forms) accepted; names in more than
  one bucket resolved by context; a modifier used outside its use area.
  **Built**, the six rows, two iterator sub-cases excepted (below): `packages/core/src/spec/` and
  six checks in `packages/core/src/check/`; the last two rows and the reader's format 7 parts
  on the follow-up package (decision 64).
- 4.3 **Context.** Which blocks hold triggers and which hold effects, from the hand-kept tables
  now in the spec: block-opening keys, iterator parameters, structural keywords, containers.
  **Built** inside item 4.2, whose rows need it: `packages/core/src/check/context.ts`.
- 4.4 **Scope checks.** The scope a block runs in, from the record's root scope, per-field
  scopes, links and iterators; a keyword in a scope the spec says it does not support. Judged
  only where the spec has scope data; "no requirement declared" is not a finding.
- 4.5 **Fields and structure.** Unknown field in a record, from the record schemas; the 3
  required fields; a wrong kind of value, from the measured value types; the structural checks
  written by hand against catalogue messages.
- 4.6 **Event targets and localization.** An undefined event target, as information. A missing
  localization key and unbalanced brackets, as warnings with their catalogue evidence. An
  unused key, as advice.
- 4.7 **Advice checks,** each a row in the inventory with "advice" as its evidence, each
  re-proved on the 1.21 base game before it ships.
- 4.8 **Lookup.** For any name: its buckets, description, the scopes it supports, what it
  takes, where it is defined and used. Where the spec has nothing it answers "unknown".
  Modifier descriptions come from the installed game's localization.
- 4.9 **The base game's own errors.** Every error pychivalry reports in the base game is
  classified: a defect of the game's files, with the reason, or a pychivalry fault to fix.
  2.3.0 left 14 unclassified.
- 4.10 **The game-file suites:** `task game:check` (base game) and `task game:mods` (the five
  mods), with a classification file: every error in a test mod is classified as a real defect
  with its reason, and an unclassified error fails the suite, as in 2.3.0.
- 4.11 **Limits that keep it usable,** each with a test: a cap on findings per file with the
  most severe kept; a bound on the work behind "did you mean"; silence when no game folder is
  set.

**Tests.** Rows "Engine checks" and "Lookup" in MVP.md's table. One fixture pair per check: a
bad file it fires on and a good file it is silent on.

**Delivers.** `packages/core/src/{spec,check,lookup}/`, `docs/checks.md`, the base-game and
real-mod records.

**Done when.**

1. Every check in the inventory has its fixture pair and both pass.
2. Every base-game error is classified, and none is a pychivalry fault.
3. The scope check has zero findings on every base-game use it can judge, and the record
   states how many it judged. 2.3.0 judged 93,665 of 561,077.
4. On the five mods the error list equals the list of real defects.
5. The core contains no keyword list: a search for the names in 2.3.0's tables finds none.

**Not yet known.** How many of the old advice rules still hold on 1.21. Whether the measured
value types are clean enough to raise a finding, or only good enough for completion.

**Found** (item 4.1, [checks.md](checks.md)): 78 checks, 11 of them the parse findings step 2
built; 21 errors, 9 warnings, 45 information and 3 hints; 31 with game evidence and 47 advice.
Of release 2.3.0's 108 codes, 56 are carried over (5 at another severity), 13 provisionally, 39
not. Of the pre-2.0 rules, 17 of the 38 required-field flags and 28 of the 89 rule codes hold
on the 1.21 base game and return as advice; none of the 32 "required" flags is a requirement
the game states. Every catalogue message cited is present in the 1.21.0.3 executable, but four
sit beside a narrower reader than the check citing them (the unknown-field message among the
province-history reader's), which the planted-defect capture of item 11.1 should settle. The
structural and advice checks need their keywords (`hidden`, `option`, `if`, `else`) as data,
which the format 5 plan does not yet carry. ck3-tiger is GPL-3.0, so nothing of it may enter
this repository; the CWTools rule files are MIT and three years behind the game.

**Found** (item 4.2, measured on game 1.21.0.3 with a one-off script over the built core, the
base game's index and the committed spec; the suites of item 4.10 will record the same):

- The typed reader checks the package file's checksum, format 5 and version, and each
  companion's checksum, size and header when it is opened; every caller in a process shares one
  parse. The data-types companion answers every lookup with a list.
- The hand-kept tables are read by the trust rule in docs/decisions.md: confirmed entries as
  written; of the 15 contradicted, the game's lists widen 3, the game's buckets correct the
  reason of 9 whose role stands, and the rule drops 3 (`debug_only` as a container, and two
  `file_kinds` patterns of a table this item does not read); entries with no evidence only
  accept keys. The 29 candidates of the tables it reads that the game's output or its `.info`
  files document (17 iterator parameters, 10 script-value operations, 2 containers) accept
  their keys too.
- Four checks are built, all errors on their catalogue messages. On the base game they judge
  1,200,304 keys in trigger and effect blocks, 10,736 keys in modifier blocks and 416,190 scope
  chains, and raise 20 errors (16 `names/unknown-trigger`, 4 `names/unknown-effect`), each at a
  line where release 2.3.0 reports the same name; 8 of them rest on a measured field kind the
  package gets wrong (`config` of `common/pool_character_selectors`). Item 4.9 classifies them.
  Release 2.3.0's other 74 errors of these families are not raised: the game documents the key
  as an iterator parameter (`culture_filter`, `government_type_filter`, `is_eminent`), lists it
  for the iterator (`faith_filter`), the block is a modifier block (`market_modifier`), or the
  iterator is written in another letter case (`any_in_List`, whose `list` is then its
  parameter).
- On the five mods: 0 errors in balance-of-power-ui and divine-intervention, 2 in elf-destiny,
  489 in rice and 1 in viet-events: the same errors, line for line, as release 2.3.0's of
  these four families, without its 12 false ones in divine-intervention (a market modifier
  block read as triggers; an iterator parameter the game documents). RICE's 489 are written for
  game 1.19: 1.21.0.3 removed most of the names, and each finding carries the version and the
  replacement the package gives.
- Two rows cannot be built from the 1.21.0.3 package: `names/unknown-on-action` needs to know
  which fields name an on-action, and the B1 value types name no database;
  `names/modifier-outside-use-area` needs the use area of a modifier block, and the package
  gives use areas only to the modifiers themselves. Which iterator prefix belongs in a trigger
  block and which in an effect block is a keyword role the package does not carry either, so
  the unknown-trigger and unknown-effect rows do not report an iterator in the wrong block.
  These are questions for the owner (docs/decisions.md); the step stops before item 4.4.
- The package's measured field kinds are mostly right, but not always: a dated title history
  entry is measured an effect block with no fields, and `common/script_values` records its
  links as effect blocks. The rules of reading that keep such cases silent are stated from the
  package's data in docs/decisions.md ("Awaiting confirmation").

**Found** (item 4.2 finished on the format 7 package, 2026-11-22, measured the same way with a
one-off script over the built core, the base game's index and the committed spec):

- The typed reader reads format 7 only and exposes its eight new parts (`Spec.part`), each row
  with its status and evidence; the package file is read once per process. The hand-kept
  tables grew (177 entries: 154 confirmed, 15 contradicted, 8 with none).
- `names/unknown-on-action` reads the 11 places part D6 confirms name an on-action (5 fields of
  `common/council_tasks` and `common/on_action`, 6 effect parameters, `trigger_event`'s
  `on_action` among them). It raises nothing on the base game and nothing on the five mods.
- `names/modifier-outside-use-area` reads the use area part D7 confirms for each block that
  holds modifiers; the context reader now also reads as modifier blocks the 132 confirmed D7
  blocks the schema does not mark, with the keys D7 measures there as parameters. On the base
  game it judges 33,186 modifiers and raises 215 warnings, every one in one block,
  `county_potential_trade_good_modifier` of `common/buildings`
  (`regular_district_buildings/00_villages_district_buildings.txt`, 145 between lines 38 and
  5,610; `00_tribal_economy_and_prestige_district_buildings.txt`, 70 between lines 382 and
  1,626): 29 `trade_good_<x>_production_add` modifiers, whose only use area the game documents
  is province, in a block D7 confirms as county while its own note says the two disagree and
  that the row is not settled without a running game. A request to the spec work
  (docs/decisions.md).
- The base game's errors: 12, down from item 4.2's 20; the 8 `config` errors of
  `common/pool_character_selectors` are gone with the corrected field kind. The 12, for item
  4.9 to classify: `names/unknown-trigger` at
  `common/decisions/00_major_decisions_east_europe.txt:397` (`filter`),
  `common/scripted_effects/00_laamp_effects.txt:1846` (`save_scope_as`),
  `common/scripted_effects/00_relation_effects.txt:757` (`is_powerful`),
  `common/scripted_effects/00_religion_effects.txt:1320` and `:1331` (`can_elevate_holy_site`,
  `can_demote_holy_site`), `common/scripted_triggers/00_relation_triggers.txt:1071`
  (`is_powerful`), `common/scripted_triggers/00_religious_triggers.txt:806` and `:807` (the two
  `secret_is_blackmailable_*_hook_trigger`); `names/unknown-effect` at
  `common/scripted_effects/00_religion_effects.txt:1322` and `:1333` (`elevate_holy_site`,
  `demote_holy_site`) and `events/dlc/gdp/gdp_merchant_events.txt:2195` and `:2240`
  (`selection_count`). The checks judge 1,199,844 keys in trigger and effect blocks, 39,902 in
  modifier blocks and 416,167 scope chains.
- On the five mods, errors per code: balance-of-power-ui none; divine-intervention none (215
  warnings, the same block in its copies of the two base-game files); elf-destiny 2
  `names/unknown-link` as before (70 warnings, the same block); rice 139
  `names/unknown-trigger`, 314 `names/unknown-effect` as before and 361
  `names/unknown-modifier` (36 before: 325 more in blocks D7 confirms, nearly all modifiers
  1.21.0.3 removed, such as `development_growth_factor`), and 80 warnings (`monthly_income`, a
  character modifier, in a building's `province_modifier`); viet-events 1
  `names/unknown-effect` as before.
- The iterator sub-cases are not built: part D8 says which kind each prefix is, from the
  game's own documentation, but no game message ties the unknown-trigger or unknown-effect
  message to an iterator of the wrong kind (D8's own first open point), and the rows are
  errors. A question for the owner.
- Part D4 replaces nothing the context reader took from the tables: each context it states,
  it states as the table entry the reader already reads.

---

## Step 5: command line

**Goal.** The checker as a command, with output that matches 2.3.0's so results compare.

**Depends on.** Step 4.

**Work items.**

- 5.1 `check <mod> [--vanilla <game>] [--spec <file>] [--json]`. Exit codes: 0 no errors,
  1 errors found, 2 bad usage or not a folder.
- 5.2 Text output in 2.3.0's shape: the file, then `line:col  severity  code  message`, then a
  summary line. 2.3.0's golden output file is the first test.
- 5.3 JSON output: one finding per line with 2.3.0's six fields (`file`, `range`, `severity`,
  `code`, `message`, `source`), new fields beside them (`evidence`, `fix`), and a final
  summary line: tool version, spec and game builds, counts by severity and by code.
- 5.4 Filters: `--severity`, `--code`, `--limit`.
- 5.5 `lookup <name>…`, `explain <code>…`, each with text and JSON output.
- 5.6 `format` and `log` are declared here and filled in at steps 8 and 11.
- 5.7 The command uses the on-disk index, so a second run does not reload the base game.

**Tests.** 2.3.0's golden text output reproduced on its fixture mod. Exit codes. JSON lines
parse and carry the six fields. A second run is faster than the first by the load time.

**Delivers.** `packages/cli/`.

**Done when.** The golden tests pass, and on each of the five mods the command line's findings
equal the core's.

**Not yet known.** Nothing identified.

---

## Step 6: agent server

**Goal.** Everything the core knows, offered to an AI agent as tools that fit a context
window, and a scored test that an agent can really use it.

**Depends on.** Step 5.

**Work items.**

- 6.1 The server: a local process over standard input and output, on the MCP TypeScript
  library's 2.x line. It reports its version and a schema version, and written instructions
  saying what it is for and which tool to start with.
- 6.2 The tools. Names are lower-case with underscores. Each declares the shape of what it
  takes and what it returns, and is marked read-only.

| Tool | Takes | Returns |
| --- | --- | --- |
| `check` | A file, a folder or the whole mod; minimum severity (default error); codes; a limit (default 50); a cursor | Totals by severity and by code, always; then the findings; a cursor when there are more |
| `lookup` | One or more names | For each: what `lookup` in item 4.8 returns |
| `find_definition` | A name, or a file and position | Where it is defined |
| `find_references` | A name; a limit; a cursor | Where it is used |
| `list_definitions` | A kind; a limit; a cursor | The definitions of that kind |
| `call_graph` | A name; a direction | Callers or callees (filled in at step 10) |
| `analyze_log` | A log file | Findings tied to files (filled in at step 11) |
| `explain_code` | One or more codes | What each means and its evidence |
| `format` | A file | The formatted text, as a proposal (filled in at step 8) |

- 6.3 Result size: every result stays under about 10,000 tokens. A test measures each tool on
  the largest test mod.
- 6.4 Bad input is returned as a result that names the valid values, not as a protocol error.
- 6.5 The server reads only the mod folder and the game folder, and writes nothing.
- 6.6 It loads the on-disk index; it does not build its own from scratch when one exists.
- 6.7 The planted-defect test mod: 20 to 30 defects, one per check code, each recorded in a
  manifest (file, code, the text it sits on); lines that look wrong and are not; and a
  reference copy with every defect fixed that passes all the graders.
- 6.8 The scored-run script. For each trial it makes a fresh copy of the test mod with no git
  history and starts Claude Code's command-line mode once, on the existing login, confined to
  this server plus file read and edit. The flags, as documented for the installed version:
  `--strict-mcp-config --mcp-config <file> --tools "Read,Edit" --allowedTools
  "mcp__pychivalry__*" --permission-mode dontAsk --max-budget-usd <n> --output-format
  stream-json --verbose --no-session-persistence --model <pinned>`.
- 6.9 The graders, in code: the checker reports zero errors; every planted defect is gone;
  nothing outside the planted lines changed; the look-alikes are untouched; no content was
  deleted.
- 6.10 The record of a scored run: the harness version, the model, the tool calls and tool
  errors per trial, the pass rate per task. 5 trials per task in development, 10 before a
  release.
- 6.11 The first scored run, from which the owner sets the target.

**Tests.** Each tool against fixtures. The size test. The graders pass on the reference copy
and fail on the untouched test mod.

**Delivers.** `packages/mcp/`, `fixtures/defects/`, `tools/scored-run/`, the first scored
record.

**Done when.**

1. Every tool passes its fixture tests and the size test.
2. The first scored run is on record, and the owner has set the target from it.

**Not yet known.** Whether confining a run with those flags also keeps out the user's own
Claude settings; one test run settles it. How many trials the login's usage limits allow.

---

## Step 7: language server and extension

**Goal.** The editor shows what the core knows, the agent server reaches both AI harnesses, and
one test proves every surface gives the same answers. First preview build.

**Depends on.** Step 6.

**Work items.**

- 7.1 **Prove the AI wiring first,** before anything else in this step, with the server from
  step 6 and nothing more:
  - VS Code's default AI harness sees a local server the extension registers.
  - Claude Code sees the same server after the "Set up for Claude Code" command.
  - The registered location survives an extension update. The extension's folder name carries
    its version, so the server is copied to the extension's own storage folder, or the entry
    is rewritten on activation.
  The result is written into MVP.md's open question 4. If either harness cannot be reached as
  designed, this step stops and the owner is asked.
- 7.2 The VS Code floor, pinned from what 7.1 found, written into the extension's manifest and
  into MVP.md. The starting figure is 1.146.
- 7.3 The language server, started by the extension as a module over IPC on VS Code's own
  runtime. Languages: `ck3` for script files, `ck3-localization` for localization files.
  Activation when such a file opens or the workspace holds a mod descriptor.
- 7.4 Diagnostics while typing, and for the whole mod in the background with a file limit and a
  yield between files. Closing a file keeps its diagnostics.
- 7.5 Completion, hover, go to definition, find references, document symbols. Hover text is
  the spec's description. Completion offers what is valid at the position.
- 7.6 The game-path setting: detection across every Steam library on Linux and Windows, an
  explicit setting that overrides it, and a clear message when no game is found.
- 7.7 The extension bundles the command line and puts it on the path of the integrated
  terminal.
- 7.8 "Set up for Claude Code": adds the server to Claude Code's own configuration for this
  workspace. If the Claude Code command is not installed it says so and offers to write a
  project configuration file instead, after asking.
- 7.9 The same-answers test: one mod through the editor, the command line and the agent
  server; the three finding lists must be identical.
- 7.10 Packaging: one installable file with the three bundles and the spec. Its size is
  recorded; 2.3.0's was 1.8 MB.
- 7.11 A smoke test on the packaged file, installed into a clean VS Code, on Linux and Windows.
- 7.12 The first preview build, attached to a GitHub pre-release.

**Tests.** Rows "Completion and hover" and "Same answers on every surface" in MVP.md's table.
The extension tests run with the launching VS Code's own variables removed, so they also run
from a terminal inside VS Code.

**Delivers.** `packages/lsp/`, `packages/vscode/`, the first preview build.

**Done when.**

1. Both AI harnesses reach the server, on Linux and Windows, as recorded in 7.1.
2. The same-answers test passes.
3. The packaged extension passes its smoke test on both systems.
4. The preview build is published as a pre-release.

**Not yet known.** MVP.md open question 4, which item 7.1 exists to answer. Whether three
copies of the index in memory at once are acceptable, or the servers need to share one.

---

## Step 8: formatter and fixes

**Goal.** One formatting, defined in writing, that never loses anything; and fixes that travel
with findings. Second preview build.

**Depends on.** Step 7.

**What 2.3.0 did.** Reprinted the file from the tree with tabs, aligned `=` within a block,
kept lists of five or fewer on one line, quoted text containing spaces, and allowed at most two
blank lines. It had no golden files and no written rules, and its settings were not read until
2.3.

**Work items.**

- 8.1 `docs/formatting.md`: the rules, decided before any code. Indentation, operator
  alignment on or off, list wrapping, quoting, blank lines, comments, line endings. 2.3.0's
  behaviour is the starting point and each rule is checked against how the base game is
  written.
- 8.2 The formatter, working from the tree and keeping every comment and token.
- 8.3 The round-trip suite on the base game: after formatting, every file re-parses to the same
  tree. Part of `task game:parse`.
- 8.4 Golden files for each rule; formatting twice changes nothing.
- 8.5 On-type formatting, derived from the same rules, tested for agreement with the formatter.
- 8.6 Fix data in the core: where a finding has a mechanical fix, the fix is part of the
  finding.
- 8.7 Quick fixes, each from fix data. 2.3.0's ten are the starting list: a localization stub
  for a missing key, a key rename, indentation, operator spacing, trailing whitespace, an
  empty block removed, a missing `ai_chance`, and three refactors.
- 8.8 `presentation/`: outline rules, snippets, field order and inline hints, brought back from
  the pre-2.0 schema files as pychivalry's own data. Loaded by the language server only. A
  test proves no check reads it.
- 8.9 `format` in the command line and the agent server, filled in.
- 8.10 The second preview build.

**Tests.** Rows "Formatter", "On-type formatting" and "Quick fixes" in MVP.md's table.

**Delivers.** `packages/core/src/{format,fix}/`, `docs/formatting.md`, `presentation/`.

**Done when.**

1. The round-trip suite passes on every base-game file.
2. Every golden file and every fix fixture passes.
3. The same-answers test is extended to formatting and passes.

**Not yet known.** Whether a recognised community formatting convention exists beyond "tabs".

---

## Step 9: skills and the authoring run

**Goal.** The AI can explain an error, fix an error and write new content that the game
accepts, in both harnesses, and a scored run says how well. Third preview build.

**Depends on.** Step 8.

**Work items.**

- 9.1 The skills folder, in the form both harnesses load, as proved in 7.1. Three skills:
  explain an error, fix an error, write new content.
- 9.2 The authoring skill's rules: look names up before using them; write events with their
  localization; run the checker; repair from the findings; stop at zero errors or after 5
  rounds; never claim success with errors left. Content types: events, decisions, scripted
  effects, scripted triggers.
- 9.3 "Set up for Claude Code" extended to install the skills.
- 9.4 The fixed list of content requests, with what a correct result must contain for each.
- 9.5 The scored authoring run, on the script from item 6.8. Grade one, validity: the checker.
  Grade two, the match to the request: a separate model call that reads the request and the
  result and answers per dimension, and may answer "cannot tell".
- 9.6 The judge is calibrated once against results graded by hand, and the agreement is
  recorded.
- 9.7 The hand checklist for VS Code's built-in AI, which cannot be scripted: the same
  requests, run by a person, with what to look for.
- 9.8 The first scored authoring run, from which the owner sets the targets.
- 9.9 The third preview build.

**Tests.** Row "Authoring" in MVP.md's table, on its first two measures.

**Delivers.** `skills/`, `fixtures/requests/`, the first scored authoring record.

**Done when.**

1. The three skills load in both harnesses.
2. The first scored authoring run is on record and the owner has set the targets.
3. The hand checklist has been run once on VS Code's built-in AI.

**Not yet known.** How well a model judge agrees with hand grading. Whether one skills folder
serves both harnesses unchanged.

---

## Step 10: GUI files, graphics check, call graph

**Goal.** GUI files are read and navigable, missing graphics are caught, and the call graph is
available on every surface.

**Depends on.** Step 9. The GUI vocabulary from step 0 is not needed: checks against it are
after the MVP.

**What 2.3.0 did.** No GUI or GFX checks. Its script parser reported errors on 327 of the 416
base-game GUI files. Its graphics check read nine hand-picked keys and skipped bare names,
macro values and parent-folder paths. Its call graph had five kinds of link.

**Work items.**

- 10.1 `docs/gui-syntax.md`: how GUI syntax differs from script, from the base game's files:
  `types` blocks, `template` and `using`, `blockoverride`, values with units.
- 10.2 The GUI parser, sharing the lexer where the syntax agrees.
- 10.3 The GUI parse suite: every base-game GUI file parses (441 in 1.21.0.3). Part of
  `task game:parse`.
- 10.4 The index of GUI types and templates, and go to definition on them.
- 10.5 The graphics-file check. Which keys hold a file path is taken from the spec and written
  in the check inventory, with its catalogue evidence. Silent when no game folder is set.
- 10.6 The call graph in the core: an event triggering an event, a scripted effect call, a
  scripted trigger call, an on-action firing an event or another on-action, a decision firing
  an event.
- 10.7 `call_graph` in the agent server, filled in.

**Tests.** Rows "GUI files", "Graphics-file check" and "Call graph, call hierarchy" in MVP.md's
table.

**Delivers.** `packages/core/src/gui/`, `docs/gui-syntax.md`, the GUI parse record.

**Done when.**

1. Every base-game GUI file parses.
2. The graphics check passes its fixtures and raises nothing on the base game.
3. The call graph equals the known graph of the fixture mod, for all five kinds of link.

**Not yet known.** The full extent of GUI syntax; item 10.1 finds out by reading every file
that fails to parse.

---

## Step 11: game-log analysis and the in-game load

**Goal.** The game's own error log, read correctly and tied to the mod's files; and the third
measure of authored content.

**Depends on.** Step 10, and the analysis machine on the owner's word.

**What 2.3.0 did.** An analyser built on 14 guessed patterns, tested on one hand-written
16-line log. No real log exists in either repository.

**Work items.**

- 11.1 Capture real logs on the analysis machine: the base game alone; a fixture mod with one planted
  defect per check; each of the five test mods. Each capture records the game build and the
  launch options. The launch reuses the procedure in `pdx-parser-re`
  (`research/oracle/<version>/README.md`): the mod list set through `dlc_load.json`, the game
  started directly, the main menu judged reached when the logs go quiet, the process stopped,
  the mod list restored and compared.
- 11.2 `docs/game-log.md`: the real format, from those captures. Whether an entry is one line
  or several, when the log is cleared, what debug mode adds.
- 11.3 The matcher, built on the spec's catalogue messages. Lines it cannot match are listed.
- 11.4 Tying a message to a file and line in the mod.
- 11.5 The answer to MVP.md's open question 2, from the planted-defect capture: which defects
  the game reports at load, and which only when the content runs.
- 11.6 `log` in the command line and `analyze_log` in the agent server, filled in.
- 11.7 The editor shows the log's findings against the mod's files. Log folders: on Windows
  under `Documents/Paradox Interactive/Crusader Kings III/logs`, including the OneDrive
  variant; on Linux under `~/.local/share/Paradox Interactive/Crusader Kings III/logs`; the
  Proton location found and added.
- 11.8 The in-game load as the authoring run's third grade: the content is loaded on the analysis machine,
  and the log is compared with a log of the same build without it. It must add no lines that
  name its files. The measure is named for what item 11.5 showed it proves.

**Tests.** Row "Game-log analysis" in MVP.md's table, on the captured logs kept as fixtures.

**Delivers.** `packages/core/src/log/`, `docs/game-log.md`, the captured logs as fixtures.

**Done when.**

1. Every message in the captured logs is either tied to a file and line or listed as
   unmatched, and the unmatched count is on record.
2. Open questions 2 and 3 in MVP.md are answered in writing.
3. One authored result has been through the in-game load end to end.

**Not yet known.** MVP.md open questions 2 and 3. Whether the game's start-up option for
running a console command works unattended.

---

## Step 12: editor views

**Goal.** The remaining editor features.

**Depends on.** Step 11.

**Work items.**

- 12.1 The CK3 Explorer tree: events by namespace, decisions, interactions, scripted effects
  and triggers, script values, on-actions, localization per language. Answered from the index;
  each node opens its file and line.
- 12.2 Call hierarchy, from the call graph of step 10.
- 12.3 Selection ranges, from the syntax tree.

**Tests.** Rows "CK3 Explorer tree", "Call graph, call hierarchy" and "Selection ranges,
document symbols" in MVP.md's table.

**Delivers.** The three features in `packages/lsp/` and `packages/vscode/`.

**Done when.** Each passes its fixture tests, and the tree's contents equal the index on the
five test mods.

**Not yet known.** Nothing identified.

---

## Step 13: benchmarks, legacy removed, release 1.0.0

**Goal.** Prove the definition of done, remove the old code, release.

**Depends on.** Every step before it.

**Work items.**

- 13.1 `task game:bench`: parse, index load, cached load, check and memory, each timed apart,
  each the median of at least five runs, compared with the 2.3.0 baselines of item 1.11 within
  the stated tolerance.
- 13.2 Every game-file suite re-run on the current game and spec, records committed.
- 13.3 A final scored run of both AI suites at 10 trials per task, against the targets.
- 13.4 The definition of done in MVP.md, checked line by line, with the evidence for each line
  written into the release notes.
- 13.5 The decision on the `ck3-language-support` 2.x listing and its users (MVP.md open
  question 7), put to the owner.
- 13.6 `legacy/` deleted. The README says the tag `v2.3.0` is the reference for anything not
  rebuilt.
- 13.7 User documentation: install, set up for Claude Code, settings, every diagnostic code
  with its evidence.
- 13.8 Release 1.0.0: the tag, the GitHub release, the installable file.

**Done when.** Every line of MVP.md's definition of done holds, and the release is published.

---

## What is carried over from 2.3.0

| From `legacy/` | Used in |
| --- | --- |
| 74 parser cases (`packages/engine/test/unit/parser.test.ts`, `syntax-gaps.test.ts`) | Step 2 |
| The engine's 250 unit tests, 3 golden files, 3 fixture mods | Steps 2 to 5 |
| The command line's golden output (`test/fixtures/example-mod.cli.txt`) | Step 5 |
| The extension's 485 tests and 77 fixture files | Steps 7, 8, 12 |
| The classification rules for real-mod errors (`test/corpus/real-mods/classifications.json`) | Item 4.10 |
| The plug-in catalogue (`data/diagnostics.yaml`) and the audit record | Item 4.1 |
| The lessons in the changelogs for 2.1 to 2.3 | MVP.md "Lessons from 2.3.0"; a test each, in the step that owns the behaviour |
| The whole of 2.3.0, runnable | Item 1.11, the baselines |

## Decisions the plan will bring to the owner

| When | Decision |
| --- | --- |
| Item 1.6 | The spec package committed compressed or raw. Decided 2026-11-22: compressed. |
| Item 6.11 | The target for the agent-use run. |
| Item 7.1 | Only if a harness cannot be reached as designed. |
| Item 8.1 | Sign-off on the formatting rules. |
| Item 9.8 | The targets for the authoring run. |
| Step 11 | Each use of the analysis machine. |
| Item 13.5 | What happens to the 2.x listing. |
