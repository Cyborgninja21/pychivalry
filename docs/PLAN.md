# pychivalry: build plan

Status: plan for approval, 2026-11-22. Step 0 is done: the 1.21.0.3 spec package in format 8 is committed (2026-11-23, decision 68), its override rules table among its parts. Step 1 is complete, and steps 2 and 3 are built and merged, the index reading the override rules from the package. Item 4.1, the check inventory, is written and signed off. The rest of step 4 and step 5 were built in parallel on the owner's word (decisions 70 and 72) and brought together by an integration pull request: every item of step 4 and step 5 is built, but for two blocked rows of the inventory and the parts of four rows that wait on the owner or on the spec work. Step 4's "Done when" holds but for its first line (two blocked rows have no fixture pair); step 5's holds. Step 6 is built (decision 77): the agent server, the planted-defect mod, its graders and the scored-test script; item 6.11's first test sessions ran on the owner's word (decision 81), 5 of 5 passed, and the owner set the target from them: every test session passes, 10 of 10 before a release (decision 82). The five proposals of those sessions are done (decision 83): a harder planted mod, findings that say what is valid, and the rest. Step 7 was built on the owner's word by agents in parallel (decisions 84 and 85): the language server, the extension that starts it and registers the agent server with both AI harnesses, the command line on the terminal's path, the same-answers test, the packaged `.vsix` and its smoke test. Its item 7.12, the first preview's pre-release, was published on the owner's word on 2026-11-23 (decision 86): step 7 is done. Then, on the owner's word (decision 87), the language server, the agent servers and the command line were made to share one copy of the base game's index ([shared-index.md](shared-index.md)). Step 8 was built on the owner's word, by agents in parallel (decision 89): its formatting rules were signed off and then re-decided under a new principle, best practice over the author's layout (decisions 90 to 103), and items 8.1 to 8.9 are built; under the same principle the family `style/` also holds four best-practice rules and unused localization keys are reported by default (decisions 105 to 108); then the owner's answers to step 8's questions were built (decisions 109 to 115): field order judged in every folder, every fixture and the planted mod in the format, the snippets in the format, 2.3.0's LOC-001 restored (CK3872 blocked on the spec), one finding for a file not UTF-8; item 8.10, the second preview, was published on the owner's word on 2026-11-23 (decision 116): step 8 is done. Step 9 was started on the owner's word (decision 118), by agents in parallel: the skills, their set-up and the hand checklist (#151), and the content requests, the scored authoring run, its judge and the judge's calibration (#152). Item 9.8, the first scored authoring run, was made on the owner's word of 2026-11-24 (decisions 120 to 124) and is on record; the faults it found in pychivalry's own harness, tools and skills are fixed (#153): `apply_format`, a base mod clean over the game, an expectation that accepts what the game documents. The same day the owner confirmed `apply_format` (decision 126), set the authoring targets (decision 127) and had a second run made, its results kept (decision 128): it meets every target, every measure at its ceiling. The owner grades results by hand for the calibration, on two sheets, and runs the hand checklist on a build from `main` (decision 129); the third preview waits for both. On his word, twelve harder requests were added before the third preview (decision 131, #PRNUM), and the third preview's release run, 10 trials of each request, is made once, after the calibration, the checklist and the request list is final (decision 132). The Progress table says what is open.

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
| 0 | Spec work, in `pdx-parser-re` | It produces it | Done: the 1.21.0.3 package, adopted in item 1.6 in format 5, replaced the same day by format 7 (decision 64) and on 2026-11-23 by format 8 (decision 68), with its three companions, its schema `schema.format8.json` and the format 4 copy. Format 7 carries the override rules table (D1) and the other held requests (D2 to D8); format 8 answers the five points of decision 67 (decision 69) |
| 1 | Repository skeleton | Two items only (1.6, 1.11) | Complete (pull requests #114, #115 and #124). Item 1.6: the 1.21.0.3 package is committed, gzipped. Item 1.11: the speed and result baselines of 2.3.0 are recorded on its format 4 copy |
| 2 | Parser | No | Built and merged (pull request #116). Item 2.6's public codes are left to item 4.1, which maps the syntax finding identifiers to them |
| 3 | Workspace index | No for the index; the override rules table comes from step 0 | Built and merged (pull requests #118 and #120). The override rules come from the spec package's part D1 (the stand-in `spec/override-rules.json` is retired, decision 65): a settled or derived row decides, a partial or open row does not; parts D2 and D3 say what a definition is. Base-game names defined more than once with no winner known: 1,309 on the format 5 package, 118 on format 7, 233 on format 8 (the 21 coats of arms and the gene of decision 67 are answered; 167 nested names whose scope the package does not settle, under several parents, are new). Since format 8 the index also applies the scope of nested names, the gene containers, the coat of arms alias line, the stores of province terrain and the localization file condition. Still open: character history defined twice (a partial row), nested names of a scope resting on the measurement alone, the depth of the folders only partial rows or no row describe, the 32 folders with no row and `gui`, and the order of several mods or DLC packs (`docs/overrides.md`) |
| 4 | Engine checks and lookup | Yes, from item 4.2 on | Built. Item 4.1 is signed off (#121, #122); 4.2 with 4.3 (#125, #127, re-measured on format 8 in #132); 4.4 scope (#130); 4.5 fields and structure (#131); 4.6 event targets and localization (#134); 4.7 advice (#133); 4.8 lookup (#128); 4.9 to 4.11, the classification of the base game's errors, the game-file suites and the limits, in the integration pull request. 62 of the inventory's 78 rows are built (five in part), 11 retired by item 4.7's re-proof, 2 blocked, 3 belong to steps 10 and 11. Open: `structure/triggered-desc-other-field` (its message is not in the catalogue) and `scope/title-text-reads-scope-saved-late` (the localization text's saved-scope form is not data), blocked; the iterator sub-cases of `names/unknown-trigger` and `-effect` (the owner); the game-concept half of `references/unknown-name`, the open brackets of `localization/unbalanced-brackets` and the block and word types of `fields/wrong-kind-of-value`; the twelve spec requests of decision 73 and the questions in decisions.md. "Done when" 2 to 5 hold; 1 does not, for the two blocked rows |
| 5 | Command line | Through step 4 | Built (#129, with the per-file cap in the integration pull request): `check`, `lookup` and `explain`, text and JSON, the filters, the exit codes, the on-disk index. "Done when" holds: the golden test passes, and on each of the five mods the command line's findings equal the core's and the `game:mods` record's. Open: the owner's questions on `--severity`, `--no-vanilla`, the folders checked and `mcp` (decisions.md) |
| 6 | Agent server | Through step 4 | Items 6.1 to 6.6 built (the agent server, `packages/mcp/`): the six tools `check`, `lookup`, `find_definition`, `find_references`, `list_definitions` and `explain_code`, each read-only with its shapes declared, every result under 10,000 tokens (measured on rice), bad input as results naming the valid values, nothing written but the index cache, the on-disk index loaded; with them decisions 74 to 77 (`localization/unused-key` off by default). `call_graph`, `analyze_log` and `format` come with steps 10, 11 and 8. Items 6.7 to 6.10 built (#136): the planted-defect mod `fixtures/defects/` (27 defects, one per error and warning code, and 10 look-alikes, over the game stub `planted-defects`), the five graders, the scored-test script `task scored:agent-use` and its record format, all tested in CI without Claude Code; with them a CI test that no shipped package holds a key or reaches the network. Item 6.11 run on the owner's word (decision 81): the first five test sessions are on record, 5 of 5 passed (`records/scored/agent-use.json`), after two repair sessions that found harness faults, fixed; the owner set the target from them: every test session passes, a release run 10 of 10 (decision 82), which the record now states. Then, on the owner's word (decision 83), the sessions' five proposals: the planted mod made harder (32 defects, every error and warning code at least once, 29 look-alikes, 17 files; defects that need a lookup, interact or are fixed elsewhere; its reference's wrong-scope fix made right), scope findings that name the links that lead to the scope they need, field findings that carry the value type and the base game's values, the instructions naming the tools' prefix, and readable slots in every message `explain_code` shows; with them, the core's check on a name defined in many files no longer grows with the cube of the files (300 files: 7.5 s before, 0.09 s after). "Done when" holds: both lines. The harder mod has not been run by a test session yet |
| 7 | Language server and extension | Through step 4 | Done. Built on the owner's word (decisions 84 and 85), by agents in parallel: the language server, server side (#140); the extension with its AI wiring, items 7.1, 7.2 and 7.8 (#142); the rest of items 7.3 to 7.11 in one more pull request. The extension starts the language server over IPC on VS Code's own runtime, declares its four settings, gives the agent server the game folder, registers it with VS Code's AI and sets it up for Claude Code, and puts the command line on the integrated terminal's path. The same-answers test passes on the planted-defect mod in CI and on the five real mods (0, 15, 627, 2,942 and 62 findings, the same on the editor, the command line and the agent server). The `.vsix` is 3.88 MB (2.3.0's: 1.8 MB) and its smoke test passes in a clean VS Code on Linux and Windows. Editor speed against the 2.3.0 baseline: faster on all five mods, more memory on four (MVP.md, "Speed"). "Done when" holds: 2 to 4 in full, 1 for everything a test can show (a signed-in harness calling the tools is the owner's by-hand check). The first preview is published (decision 86): the GitHub pre-release `v0.1.0`, "pychivalry 0.1.0 (preview)", with the `.vsix` ([preview-release.md](preview-release.md)). The VS Code floor stays 1.146 (decision 88). After it, on the owner's word (decision 87), the three programs share one copy of the base game's index: the language server lends it to the agent servers and the command line, which load their own only when it cannot answer ([shared-index.md](shared-index.md)); on rice their peak memory went from 3.02 GiB to 1.83 GiB (the medians of five runs and six) in all, with the same findings on every surface. Open: the owner's questions on step 7 in decisions.md |
| 8 | Formatter and fixes | No, but follows step 7 | Done. Built on the owner's word (decision 89) by agents in parallel: the presentation data (#144), fix data and quick fixes (#146), the shared index (#147), and one more pull request for the rest. The formatting rules were signed off (decisions 90 to 100), then re-decided under the owner's new principle, best practice and cleanliness over anything a mod author did (decisions 101 to 103): the formatter decides the layout, joins and splits, writes Windows line breaks and the byte-order mark in every file, and the `style/` family flags a file not in the format (one warning) and each untidy place (a hint), each with a safe fix. The round trip on the base game passes on all 4,851 script files it formats (3 left: a parse error) and its 12,171 localization files: trees, tokens, second format and comments (502,890, none lost or moved) the same; it changes 4,656 script files. `format` on the command line, the agent server and the language server give the same text (the same-answers test). Then four best-practice rules in the same family (#148, decisions 105 to 107): `style/not-utf8` (a warning, with a fix converting the file to UTF-8 with the mark), `style/empty-block`, `style/deep-nesting` and `style/unusual-field-order` (hints), each followed by the base game more often than it is broken; and `localization/unused-key` on by default (decision 108). Then the owner's answers to step 8's questions (decisions 109 to 115, one more pull request): `style/unusual-field-order` judges `common/decisions` and `common/character_interactions` too, on their `.info` files' order; every fixture mod and the planted-defect mod in the format but for what each tests, the planted mod planting a formatting defect and a file not UTF-8 and its graders counting the `style/` family; the 111 snippets in the format, a test holding it; release 2.3.0's LOC-001 restored as `style/localization-key-characters` (hint), its CK3872 the blocked row `style/redundant-condition` (part D4 gives `always` and the logical operators no role); a file not UTF-8 shows one finding, `style/not-utf8`, the note `encoding/not-utf8` retired; the cost of the style findings accepted. "Done when" holds: 1 to 3. Item 8.10, the second preview, was published on the owner's word (decision 116): the GitHub pre-release `v0.2.0`, "pychivalry 0.2.0 (preview)", on commit `5b69ec0`, with `pychivalry-0.2.0.vsix` ([preview-release-0.2.0.md](preview-release-0.2.0.md)); the by-hand check was not run before it |
| 9 | Skills and the authoring run | Through step 4 | Started on the owner's word (decision 118), by agents in parallel. Items 9.1 to 9.3 and 9.7 built in one pull request: the three skills in `skills/`, in the one form both harnesses load (VS Code's AI from the extension's `contributes.chatSkills`, which VS Code syncs into its Copilot harness; Claude Code from its personal skills folder, where "Set up for Claude Code" copies them, confirmed by the owner, decision 122), each held by a test to the agent server's tools, the command line and the spec package; the authoring skill's rules of item 9.2 and the format; the set-up idempotent and removable ("Remove from Claude Code"), its copies kept current across an update; the hand checklist [guide/ai-checklist.md](guide/ai-checklist.md). Items 9.4 to 9.6 built in another (#152): twelve content requests in `fixtures/requests/`, three of each kind, each relying only on names the spec package (or its base mod) has, a test proving it, each with expectations checked in code and judged dimensions; the scored authoring run `task scored:authoring`; the judge's calibration `task scored:calibrate`; both records in the record format. Item 9.8, the first scored authoring run, made on the owner's word of 2026-11-24, the whole run at once (decision 120): 120 test sessions, Opus 5.5 writing and Fable 5.2 judging (decision 121), on record (`records/scored/authoring.json`): 60 of 60 trials held, 50 without an error, none without a warning, none in the format, 58 meeting every expectation, the judge yes on all 180 answers. Its faults fixed in one more pull request ([tools/scored-run/README.md](../tools/scored-run/README.md#the-first-scored-authoring-run-item-98)): the agent server's `apply_format`, which the skills now use; the two requests whose base clashed with the game retired and replaced, and a run that refuses a base not clean over the game; the on-action expectation made to accept what the game documents; ten hand-made results and a sheet for the calibration. Then, on the owner's word of the same day: `apply_format` confirmed (decision 126); the targets set, strict (decision 127): every result with no error, every result with no warning and in the format, at least 95% meeting every expectation, no judged dimension below 95% yes, before any release; a second run, its results kept (decision 128): 60 of 60 trials on every measure, the judge yes to all 180 questions, every target met; both records kept as files (`authoring-run-1.json`, `authoring.json`), the targets read by the run and `task scored:targets`, a calibration sheet of twelve real results beside the hand-made one, and the hand checklist runnable on a build from `main` (decision 130, #154). Then, on the owner's word, harder requests before the third preview (decision 131): twelve expert requests, three of each kind, each with a trap a first draft is likely to fall into, a hand-made first draft that fails the code-checked side for its stated reason and a third calibration sheet of hand-made results that only a judge can tell apart; the targets read with and without them; the wording behind the second run's tool errors made plain (#PRNUM). Open: the calibration's sheets and the hand checklist, the owner's own (decision 129); whether the list of twenty-four is final, or the expert requests first get a development run (asked); 9.9, the third preview, whose release run of 480 test sessions is made once on the owner's word (decision 132). "Done when" 1 and 2 hold; 3 does not yet |
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
| Extension tests | `@vscode/test-electron` **3.1.0** driving a real VS Code, the release **1.147.0** (pinned in `packages/vscode/src/editor/version.ts`), on a virtual display under `xvfb-run` on Linux; pinned in step 7 (#142) | The only way to test the extension as shipped. 2.3.0 used the same. |
| Bundling | esbuild **0.28.2** (pinned in step 7, #142), one single file each for the extension, the language server, the agent server and the command line; the spec stays a separate data file, one copy beside the agent server | VS Code's own guidance; small and fast. |
| Language client | `vscode-languageclient` **11.0.1**, started as a module over IPC (`TransportKind.ipc`); pinned in step 7 | Runs on VS Code's runtime on Linux and Windows; the companion of the server's 11.0.1. VS Code's own guide still names 9.x. |
| VS Code API | The floor **1.146** (`engines.vscode` `^1.146.0`), `@types/vscode` **1.146.0**, pinned in step 7 (#142) | The lowest release on which the AI wiring was proven (item 7.2); VS Code's packaging refuses types newer than the floor. |
| Packaging | `@vscode/vsce` **4.1.1**, pinned in step 7: `vsce package --no-dependencies` from a staging folder; no publishing token | VS Code's own packaging tool; the bundles hold every dependency. |
| Language server library | `vscode-languageserver` **11.0.1** (pinned in step 7, #140), the server-side companion of `vscode-languageclient` 11.0.1, both on `vscode-languageserver-protocol` 3.18.6; the language server's tests add `vscode-languageserver-protocol` **3.18.6** as a development dependency for their protocol client. The server depends on the core and this library only | The library VS Code's own language servers use; started as a Node module over IPC (`--node-ipc`), or over standard input and output (`--stdio`) for tests, and on no other transport. |
| Agent server library | The MCP TypeScript library, 2.x line: `@modelcontextprotocol/server` **2.4.0** (pinned in step 6, 2026-11-23, the current release on the npm registry). It pulls in `@modelcontextprotocol/core` 2.4.0 and `zod` 4 (4.6.7 locked), nothing else at run time; its JSON Schema validator (ajv) is bundled inside it. The tests add its client, `@modelcontextprotocol/client` **2.4.0**, as a development dependency (with `eventsource`, `eventsource-parser`, `jose` and `pkce-challenge`) | The current line; the 1.x line (`@modelcontextprotocol/sdk`) is in maintenance. The server is declared as its documentation describes (`McpServer`, `registerTool`, `serveStdio`), its shapes as JSON Schema (`fromJsonSchema`), so the package depends on the core and the library only. |
| Lint and format | ESLint **10.15.0** with `@eslint/js` **10.0.1** and `typescript-eslint` **8.73.0** (`strictTypeChecked`); Prettier **3.10.1** | What 2.3.0 used. |
| Task runner | `Taskfile.yml` at the root; Task **3.54.0** in CI (developed with 3.50.0) | What 2.3.0 used; one entry point for agents. |
| Licence | Apache-2.0 | What 2.3.0 used. |
| Extension identity | Publisher `cyborgninja21`, name `pychivalry`, version 1.0.0 at release | Decided: a new identity. |
| Record checks | `ajv` **8.20.0** (JSON Schema 2020-12), in `tools/` only | Validates every record against `records/record.schema.json`; the core stays dependency-free. |
| CI actions | `actions/checkout` **v7.0.1**, `actions/setup-node` **v7.1.0**, `go-task/setup-task` **v2.2.0**, and in the editor-test job `actions/cache` **v6.1.0** (step 7) for the downloaded VS Code, each pinned by commit | Pinned so a moved tag cannot change what CI runs. |

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
  shared-index.md         one index of the base game shared by the programs (decision 87)
  formatting.md           the formatting rules (step 8)
  gui-syntax.md           GUI file syntax (step 10)
  game-log.md             the error-log format (step 11)
spec/
  ck3-spec-<version>.json.gz     the committed spec package file, gzipped
  ck3-spec-<version>.<part>.json.gz   its companions: info, gui, data_types
  ck3-spec-<version>[.<part>].sha256  checksum of each file's uncompressed bytes
  schema.format8.json            the package's own schema, from pdx-parser-re
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
(D2 to D8). **Third pass done** (adopted 2026-11-23, decision 68): format 8, the same package
with keys inside D1, D2 and D3 that answer the five points of decision 67. No real error log
came with it; item 11.1 starts by capturing them.

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
  Replaced on 2026-11-23 by format 8 (decision 68), with `schema.format8.json`; the format 4
  copy is unchanged.
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
partial. Re-measured on the format 8 package (2026-11-23,
[records/game/index.json](../records/game/index.json)): the same 17,302 files, 3,371,180
definitions (205 more: 196 entries and 20 containers, the genes and gene containers inside
`special_genes`, the entries of `age_presets` and the containers themselves, for 11 records
fewer) and 9,068,219 uses. 1,322 names are defined more than once
(12,845 before: a province's terrain line and its winter block are separate stores now, and the
base game writes no province id twice in one form): 185 have a winner, 675 add up, 229 have one
definition in force and 233 have no winner known. Of the 118: the 21 coats of arms and the one
gene are answered (the alias replay names, for each of the 21, what the package derives);
`activity_window_character` and `task_contract_reward` move from "no row" to "scope not
settled". Of the 233: 167 nested names written under more than one parent whose scope part D3
rests on the measurement alone (142 portrait modifiers, 15 task contract rewards, 9 window
characters of activities, 1 dynasty house motto insert), 41 with no row of the table, 22 below
a subfolder of a depth no settled row states and 3 character ids under the partial row. The
build peaks at 1.60 GiB (1.48 before).

---

## Step 4: engine checks and lookup

**Goal.** Tell the modder what the game would say, with evidence, and answer any question
about a name.

**Depends on.** Step 3. From item 4.2 on, the 1.21 spec in format 7, in format 8 since 2026-11-23.

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
  on the follow-up package (decision 64); the reader on format 8 since 2026-11-23 (decision 68).
- 4.3 **Context.** Which blocks hold triggers and which hold effects, from the hand-kept tables
  now in the spec: block-opening keys, iterator parameters, structural keywords, containers.
  **Built** inside item 4.2, whose rows need it: `packages/core/src/check/context.ts`.
- 4.4 **Scope checks.** The scope a block runs in, from the record's root scope, per-field
  scopes, links and iterators; a keyword in a scope the spec says it does not support. Judged
  only where the spec has scope data; "no requirement declared" is not a finding.
  **Built** (#130): `check/scope.ts` and the three rows.
- 4.5 **Fields and structure.** Unknown field in a record, from the record schemas; the 3
  required fields; a wrong kind of value, from the measured value types; the structural checks
  written by hand against catalogue messages.
  **Built** (#131), ten of eleven rows; `structure/triggered-desc-other-field` is blocked.
- 4.6 **Event targets and localization.** An undefined event target, as information. A missing
  localization key and unbalanced brackets, as warnings with their catalogue evidence. An
  unused key, as advice.
  **Built** (#134), all four rows; an opener left open waits on the catalogue.
- 4.7 **Advice checks,** each a row in the inventory with "advice" as its evidence, each
  re-proved on the 1.21 base game before it ships.
  **Built** (#133): 28 rows and the re-proof tool `advice proof`; 11 retired, 1 blocked.
- 4.8 **Lookup.** For any name: its buckets, description, the scopes it supports, what it
  takes, where it is defined and used. Where the spec has nothing it answers "unknown".
  Modifier descriptions come from the installed game's localization.
  **Built** (#128): `packages/core/src/lookup/`.
- 4.9 **The base game's own errors.** Every error pychivalry reports in the base game is
  classified: a defect of the game's files, with the reason, or a pychivalry fault to fix.
  2.3.0 left 14 unclassified.
  **Done:** `tools/data/check-classifications.json`, every error and warning; none is a
  pychivalry fault.
- 4.10 **The game-file suites:** `task game:check` (base game) and `task game:mods` (the five
  mods), with a classification file: every error in a test mod is classified as a real defect
  with its reason, and an unclassified error fails the suite, as in 2.3.0.
  **Built:** `tools/src/check-suite.ts`, the records `records/game/check.json` and `mods.json`,
  and `tools/data/mods-classifications.json`.
- 4.11 **Limits that keep it usable,** each with a test: a cap on findings per file with the
  most severe kept; a bound on the work behind "did you mean"; silence when no game folder is
  set.
  **Built:** the cap in the one runner (`MAX_FINDINGS_PER_FILE`, 1,000) and the tests of all
  three (`check/limits.test.ts`).

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

**Done when, checked** (2026-11-23, game 1.21.0.3, the records of `task game:check` and `task
game:mods`):

1. **Not met, for two rows.** The 62 built codes have their fixtures and all pass in `task ci`:
   the 51 check codes each a `-bad` and `-good` pair, the 11 parse findings their `parse-*` and
   `encoding-*` fixtures. The two blocked rows, `structure/triggered-desc-other-field` and
   `scope/title-text-reads-scope-saved-late`, have none; the 11 retired rows need none, and the 3
   rows of steps 10 and 11 are theirs.
2. **Met.** The base game raises 806 errors: 13 are defects of the game's files (the 3 parse
   errors `game:parse` classifies and 10 unknown names), 793 are spec-package faults with the requests of
   decision 73 (791 parse errors in `sound/GUIDs.txt` and `gfx/models/buildings/naming.txt`,
   which are not script; 2 `selection_count` the package's entry leaves out); none is a
   pychivalry fault. Its 151 warnings are all defects of the game's files.
3. **Met.** The scope check judges 178,395 of the base game's 610,898 keyword uses (29.2%) and
   41,022 link steps, with no finding. Release 2.3.0 judged 93,665 of 561,077 on game 1.20 and
   101,162 of 613,103 on 1.21.0.3.
4. **Met.** The five mods raise 844 errors (balance-of-power-ui 0, divine-intervention 0,
   elf-destiny 2, rice 841, viet-events 1), each classified a real defect with its reason in
   `tools/data/mods-classifications.json`; none is unclassified. All 511 errors release 2.3.0
   reports in elf-destiny, rice and viet-events are reported at the same lines; its 12 in
   divine-intervention are the false ones item 4.2 found. Rice has 333 more: 325 unknown
   modifiers in blocks part D7 confirms hold modifiers (288 in the package's removed list, such
   as `development_growth_factor` 121 times and `tax_mult` 55, and 37 terrain forms of
   `development_growth_factor`), and 8 more buildings run in a province.
5. **Met.** `packages/core/src/no-keyword-list.test.ts` searches the core's strings for the names
   of 2.3.0's tables in the package and finds none.

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

**Found** (the format 8 package adopted, 2026-11-23, measured the same way with a one-off
script over the built core, the base game's index and the committed spec, on Linux):

- The typed reader and `task spec:check` read format 8 only; format 7 is refused, as format 5
  was. The reader checks that every nested row of D3 says the scope of its name.
- `names/modifier-outside-use-area` raises no warning on the base game (215 before): D7 now
  confirms `county_potential_trade_good_modifier` as province. On the mods: divine-intervention
  none (215 before), elf-destiny none (70 before), rice 80 as before (`monthly_income`, a
  character modifier, in a building's `province_modifier`).
- The base game's errors are the same 12 at the same lines (8 `names/unknown-trigger`, 4
  `names/unknown-effect`, listed above); the mods' errors are as before: balance-of-power-ui
  and divine-intervention none, elf-destiny 2 `names/unknown-link`, rice 139
  `names/unknown-trigger`, 314 `names/unknown-effect` and 361 `names/unknown-modifier`,
  viet-events 1 `names/unknown-effect`.

**Found** (items 4.4 to 4.11, built in parallel and brought together on 2026-11-23; game
1.21.0.3, the records `records/game/check.json` and `records/game/mods.json` of the suites item
4.10 built):

- **4.4 scope.** The scope walk (`check/scope.ts`) follows `this` and `root` through what the
  context reader read, from the schema's `root_scope`, an event's `scope` (part D4), an
  on-action's documented scope, the fields' scopes, links, chains and iterators (part D8 for
  the prefix kinds); where the package does not say, the scope is unknown and nothing that
  depends on it is judged. On the base game: 610,898 keyword uses, 303,835 with a known scope,
  178,395 judged, 0 findings; 41,022 link steps judged, 0 findings. The uses not judged, by
  why: no requirement declared 117,296; a saved scope or variable 108,728; a definition called
  by name 60,563; a block below a record field 59,701; an inline scripted trigger or effect
  18,836; no root scope in the schema 18,751; a link block, judged as a link 16,366; no scope
  data 8,144; a parameter block 8,082; a list with no single element type 7,131; an on-action
  with no single documented scope 3,278; a root that is no scope type 3,057; keyword parameters
  1,135; a chain ending in a value 635; a key that is no name 598; the previous scope 197;
  `fields_outside_root` 5. On the mods: 27 `scope/wrong-scope-for-effect`, all in rice.
- **4.5 fields and structure.** Ten of the eleven rows; `structure/triggered-desc-other-field`
  is blocked on the catalogue. `fields/wrong-kind-of-value` judges 7 value groups: block and
  word fire on correct mod script. No error or warning on the base game; 88
  `definitions/not-read` information findings, in `jomini/` files the game's copies replace.
  On the mods: elf-destiny 72 `fields/unknown-field` (47 `ai_is_valid` in scripted GUIs, 15
  trait `index`, 6 likely false: an ethnicity's custom genes) and 1 `references/unknown-key`;
  rice 649, 182 and 3 `fields/wrong-kind-of-value`.
- **4.6 event targets and localization.** All four rows; the index records saved scopes, their
  reads and `$PARAM$` templates per file (cache format 4), and the runner checks `.yml` files.
  On the base game: 5,969 `scope/undefined-event-target` (76 names, `duel_value` 4,716); 151
  `localization/missing-key` warnings on 104 keys no localization file of the install defines;
  no unbalanced brackets, no unused key. On the mods (event targets / missing-key warnings /
  missing-key advice / brackets / unused keys): balance-of-power-ui 0/0/0/0/105,
  divine-intervention 3/0/0/0/3,699, elf-destiny 21/6/129/0/2,444, rice 189/204/19/7/141,365,
  viet-events 45/0/0/3/21,592 (before the per-file cap). Since decision 76 the unused-key check
  is off by default, so a check and the suites report those hints only when asked.
- **4.7 advice.** 28 rows built, each re-proved on the base game by `pychivalry-tools advice
  proof`; the eleven provisional rows that fire there are retired (checks.md, Retired codes);
  `scope/title-text-reads-scope-saved-late` and the game-concept half of
  `references/unknown-name` are blocked. `references/unknown-name` fires on 4 base-game
  portraits, as its row says; it ships as information with the 4 listed as known exceptions
  (decision 75).
- **4.8 lookup.** Every reading of a name the package has, its definitions and uses in a
  workspace with what is in force (since the integration also the object an alias row makes
  it share, and "not in force"), a modifier's localization through part D5, and "did you
  mean" under a work budget. Only 9 of 778 modifiers have a localization key the package
  names; the base game uses `MOD_<NAME>` for 646 (decision 73).
- **4.9 the base game's own errors.** 806 errors and 151 warnings, every one classified in
  `tools/data/check-classifications.json`: 13 errors and the 151 warnings are defects of the
  game's files, 793 errors are spec-package faults, none is a pychivalry fault. The defects:
  the 3 parse errors of `game:parse`; `filter` written in `any_vassal`, which the game documents
  only for `in_de_jure_hierarchy`; `save_scope_as` in a limit (an effect only);
  `is_powerful` twice (no such trigger; the base game uses `is_powerful_vassal` 260 times);
  `can_elevate_holy_site`, `can_demote_holy_site`, `elevate_holy_site`, `demote_holy_site` in
  two scripted effects nothing calls; two scripted triggers no file defines; and 104
  localization keys no `.yml` defines (three misspelled, one in another letter case). The
  faults: `sound/GUIDs.txt` (790 errors) and `gfx/models/buildings/naming.txt` (1), which the
  index reads as script because the package lists their folders, and `selection_count` in
  `every_top_trade_good_in_range` twice, which the package's own evidence documents and its
  entry leaves out. Release 2.3.0 reports 88 errors on the same game; 12 are at lines this run
  also reports.
- **4.10 the suites.** `task game:check` checks the base game's 17,302 files (game 16,940,
  jomini 230, clausewitz 88, DLC 44) in 55 s (16 s to build the index, 38 s to check) at a
  peak of 2.7 GiB; `task game:mods` builds the index once (16 s, 1.5 GiB) and checks each mod
  from it in 1.5 to 17 s at peaks of 0.7 to 2.0 GiB. Both run the one runner the
  command line runs; on each mod the command line, the core and the record agree.
- **4.11 the limits.** The per-file cap keeps 1,000 findings, the most severe first, and
  reports the rest: on rice it drops 275 unused-key hints of one file (141,365 before, 141,090
  after), on viet-events 1,894 of 8 files; the base game and the other mods have no file over
  the cap. With the unused-key check off by default (decision 76) no file of the five mods is
  over it. No check computes "did you mean"; lookup's budget is tested in `suggest.test.ts`.
  Without a game folder every fixture's bad half gives only findings that a base game defining
  every name gives too.
- **Merged without changing a finding:** the advice checks' saved scopes onto the index's own
  reading of item 4.6, one reader of part D4 for items 4.5 and 4.7, `info_scope`'s type, and
  lookup's shared objects. The fixture tests, both records and the advice re-proof were the
  same before and after.

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

**Done when, checked** (2026-11-23): **met.** `packages/cli/src/golden.test.ts` passes (release
2.3.0's `example-mod` golden output: its shape, the 54 files, the 118 findings both tools give).
On each of the five mods `check --json` gives the same findings as the core's `checkWorkspace`,
finding by finding, and the same counts by code and the same error and warning lists as the
`game:mods` record: 105, 3,714, 3,071, 144,032 and 19,760 findings (a one-off comparison,
not committed). Those counts hold the unused-key hints, which decision 76 has since turned off
by default: the record re-made after it counts 0, 15, 627, 2,942 and 62.

**Not yet known.** Nothing identified.

**Found** (#129, and the per-file cap added in the integration): `check`, `lookup` and
`explain`, text and JSON; `format` and `log` are entries steps 8 and 11 add to the command
table. The core's `checkWorkspace` is the one code path every surface runs; `find-game.ts`
finds the game in any Steam library by its launcher's `gameId`; `inventory.ts` gives `explain`
the inventory rows as data. A first run reads the base game in about 17 s and saves the index
(251 MB); a later one loads it in 1 to 2 s. `explain` called `fields/missing-required-field`
and `definitions/clash` advice until the integration gave place-dependent evidence its own
kind.

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

  *Built (items 6.1 to 6.6):* the six tools that work today. `call_graph`, `analyze_log` and
  `format` are not registered until they do something (no stubs): steps 10, 11 and 8 each add its
  tool as one more entry of `TOOLS` in `packages/mcp/src/server.ts`, with its shapes, its fixture
  tests and the size test, and raise the schema version (`packages/mcp/src/version.ts`).

- 6.3 Result size: every result stays under about 10,000 tokens. A test measures each tool on
  the largest test mod.
- 6.4 Bad input is returned as a result that names the valid values, not as a protocol error.
- 6.5 The server reads only the mod folder and the game folder, and writes nothing. *Since item
  9.8, confirmed by the owner (decision 126):* but for `apply_format`, which writes the one file
  of the mod it is given in pychivalry's format.
- 6.6 It loads the on-disk index; it does not build its own from scratch when one exists.
- 6.7 The planted-defect test mod: 20 to 30 defects, one per check code, each recorded in a
  manifest (file, code, the text it sits on); lines that look wrong and are not; and a
  reference copy with every defect fixed that passes all the graders. *Changed by decision
  83:* every error and warning code at least once, a code more than once where it makes the
  mod harder.
- 6.8 The scored-test script, a developer's test script: not shipped, not part of the
  extension, never run by CI. pychivalry holds no key and makes no model call; the script
  starts the Claude Code program already installed on the developer's machine, signed in
  however the developer signed it in, once per trial as a separate test session. For each
  trial it makes a fresh copy of the test mod with no git history and starts the test session
  in Claude Code's command-line mode, confined to this server plus file read and edit. The
  flags, as documented for the installed version: `--strict-mcp-config --mcp-config <file>
  --tools "Read,Edit" --allowedTools "mcp__pychivalry__*" --permission-mode dontAsk
  --max-budget-usd <session limit> --output-format stream-json --verbose
  --no-session-persistence --model <pinned>`. The session limit goes to Claude Code's own
  option that ends a session early; the script uses it only as a per-session limit, a safety
  stop, and does no accounting of its own. Each test session counts against the developer's
  own Claude plan, like any session they open.
- 6.9 The graders, in code: the checker reports zero errors; every planted defect is gone;
  nothing outside the planted lines changed; the look-alikes are untouched; no content was
  deleted.
- 6.10 The record of a scored run: the harness version, the model, the tool calls and tool
  errors per trial, the pass rate per task. 5 trials per task in development, 10 before a
  release.

  *Built (items 6.7 to 6.10, #136):* `fixtures/defects/`, a hand-written mod with 27 defects,
  one per error and warning code of this build, and 10 look-alike lines, its manifest and its
  fixed reference copy, checked over the game stub `fixtures/game/planted-defects`; the five
  graders (`tools/src/scored-run/graders.ts`); the script, `task scored:agent-use`
  ([tools/scored-run/README.md](../tools/scored-run/README.md)), with the model pinned to Opus
  5.5 (`claude-opus-5-5`, decision 78), 5 trials by default, a session limit
  (`SCORED_SESSION_LIMIT`, required, no default) and a time limit of 30 minutes; and the
  record, `records/scored/agent-use.json`, in the record format and `task records:check`. Every
  part is tested in public CI against a stand-in for Claude Code. The command line differs from
  the one above, each change with its reason in the script's README: the prompt goes first as
  `-p <prompt>`; `Read,Edit` is also on the allow list; `--setting-sources project,local` is
  added; key and token variables are dropped from the session's environment; the other agent
  servers Claude Code would offer from claude.ai and its automatic memory are switched off for
  the session; each test session checks its own confinement, and a session offered anything
  else fails the run. A CI test, `tools/src/no-key-no-network.test.ts`, holds every shipped
  package to holding no key and reaching no network.
- 6.11 The first test sessions, from which the owner sets the target. They start only on the
  owner's word (decision 80); the result is then reported, and step 7 starts only on the
  owner's go (decision 79).

  *Run (item 6.11, on the owner's word of 2026-11-23, decision 81):* five test sessions of
  Claude Code 2.1.330 on `claude-opus-5-5`, each with session limit 3, are on record
  (`records/scored/agent-use.json`): **5 of 5 passed**, every grader in every session, each
  session about a minute and 38 or 39 tool calls, two tool errors in all (a tool called by its
  bare name). Two repair sessions before them found harness faults, now fixed with tests: the
  Claude Code on the path, 2.1.220, cannot run the pinned model and its refusal ended the
  session as "success"; Claude Code's own skills were offered; Claude Code's own plugins
  tripped the confinement check; and three variables of a surrounding session reached the test
  session. Every start event showed the confinement holding, the plan's open question.
  `SCORED_CONTINUE` lets one record hold a first session and the sessions after it. The analysis
  and the proposals for the server are in
  [tools/scored-run/README.md](../tools/scored-run/README.md#the-first-test-sessions-item-611).
  **Done:** the owner set the target from this result (decision 82): every test session passes;
  a release run of 10 test sessions must pass all 10, and a development run of 5 that passes
  fewer than 5 is looked into. The record states each task's target and whether the run met
  it (`target`; item 6.11's record, made before, has none).

  *Done after item 6.11, on the owner's word (decision 83):* the sessions' five proposals.
  1. **A harder planted mod** (`fixtures/defects/`): 32 defects, every error and warning code
     at least once and four codes twice, 29 look-alikes, 17 files and 591 lines (the first mod:
     27, 10, 15 and 254). Defects whose fix needs a lookup (the scope an effect or trigger
     takes and the link that leads there, an exact name, an event of another file, the values
     a field takes); defects that interact (a namespace typo whose obvious fix clashes with an
     event of another file; a clash whose right fix also answers an unknown key; a faith
     event whose scope line must stay); defects fixed away from the finding (a localization
     key, a block named by its caller, a brace that belongs inside the block). The checker
     reports exactly the planted defects on `mod/` (26 errors and 7 warnings) and nothing on
     `reference/`, in CI. The reference's wrong-scope fix now gives a county a modifier of
     county modifiers; no built row judges that case (decisions.md, "Asked, awaiting the
     owner"). The graders judge by the checker and the fix ranges, so fixes the reference does
     not use pass (`primary_title.holder`, `add_character_modifier`), and the obvious fixes of
     interacting defects fail; tests show both.
  2. **Scope findings say the way out:** `scope/wrong-scope-for-effect`, `-for-trigger` and
     `scope/link-on-wrong-scope` carry `links_from_scope`, the links (or chains of two) from
     the current scope to the scopes the keyword or link takes, from the spec package, at most
     12.
  3. **Field findings say what the field takes:** `fields/missing-required-field` and
     `fields/wrong-kind-of-value` carry the field's `value_type` and `values`, the values the
     base game writes, at most 20. The command line's text shows both after the game's
     message; no code, severity or message changes.
  4. **The instructions name the prefix:** a client may show the tools under its own prefix
     (`mcp__pychivalry__check`); the names in the instructions are the bare ones.
  5. **Readable slots:** `explain` and `explain_code` show every message with named slots
     (`Unknown trigger '<trigger>'`), never `%s` or `{}`.

  With them, the slowdown the size test had noted: the core's check resolved a name once per
  definition and compared every pair of its definitions each time, so a name defined in n
  files cost n cubed (100 files 0.3 s, 300 files 6 to 7.5 s). It now sorts them and resolves a
  name once: 300 files 0.09 s, 1,000 files 0.36 s; tests count the sort's comparisons (n log
  n), hold the resolution remembered, and bound a check of 1,000 files. `task
  game:check` and `task game:mods` were re-run: no finding figure moved. The size test on
  rice passes, every result under 30,000 characters (the largest 27,990).

**Tests.** Each tool against fixtures. The size test. The graders pass on the reference copy
and fail on the untouched test mod.

**Delivers.** `packages/mcp/`, `fixtures/defects/`, `tools/scored-run/`, the first scored
record.

**Done when.**

1. Every tool passes its fixture tests and the size test. *Met.*
2. The first scored run is on record, and the owner has set the target from it. *Met: 5 of 5
   on record; the target, every test session passing, set by decision 82.*

**Not yet known.** How many test sessions a release run of 10 per task can take, since each
counts against the developer's own Claude plan. (Whether the flags keep the developer's own
Claude Code settings out of a test session was settled by item 6.11: they do, each start event
showing it.)

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

  *Built (#142):* the extension `cyborgninja21.pychivalry` 0.1.0 in `packages/vscode/` copies
  the bundled agent server and its spec package into its global storage folder
  (`<global storage>/agent-server/`), checked by a manifest of SHA-256 sums, and registers it
  with `vscode.lm.registerMcpServerDefinitionProvider`: one local server per workspace folder,
  run by VS Code's own executable as Node (`ELECTRON_RUN_AS_NODE=1`) with `--mod` and `--spec`
  named. (a) VS Code 1.146.0 and 1.147.0 hand that definition, unchanged, to the Copilot harness
  (the plugin VS Code writes into its user-data folder), with no sign-in. (b) "Set up for Claude
  Code" runs `claude mcp remove` then `claude mcp add --scope local`; a real Claude Code 2.1.220
  connected to the server from that entry (`claude mcp get`, against a throwaway configuration);
  CI uses a stand-in that writes Claude Code's format. (c) An update from 0.1.0 to 0.1.1, the old
  folder removed, leaves Claude Code's entry unchanged and answering, with no VS Code running.
  The editor tests run in a real VS Code on a virtual display, in a CI job of their own on Linux
  and Windows. Written into MVP.md's open question 4: the VS Code half is answered.
- 7.2 The VS Code floor, pinned from what 7.1 found, written into the extension's manifest and
  into MVP.md. The starting figure is 1.146.

  *Built (#142):* the floor is 1.146 (`engines.vscode` `^1.146.0`, `@types/vscode` 1.146.0, a
  test holding the two together). 1.142, 1.143 and 1.145 start no Copilot harness session in a
  fresh profile without a sign-in, so forwarding could not be seen there; signed in, they are
  not known (a question for the owner).
- 7.3 The language server, started by the extension as a module over IPC on VS Code's own
  runtime. Languages: `ck3` for script files, `ck3-localization` for localization files.
  Activation when such a file opens or the workspace holds a mod descriptor.
- 7.4 Diagnostics while typing, and for the whole mod in the background with a file limit and a
  yield between files. Closing a file keeps its diagnostics.
- 7.5 Completion, hover, go to definition, find references, document symbols. Hover text is
  the spec's description. Completion offers what is valid at the position.
- 7.6 The game-path setting: detection across every Steam library on Linux and Windows, an
  explicit setting that overrides it, and a clear message when no game is found.

  *Built, server side (items 7.3 to 7.6, #140):* `packages/lsp/`, the language server on
  `vscode-languageserver` 11.0.1, started as a Node module over IPC or, for tests, over standard
  input and output. Script and localization files are told apart by extension, whatever the
  language id. Diagnostics while typing (an incremental re-parse and the one runner's own
  per-file path, `checkSourceFile` over `checkNames`, which `checkWorkspace` now calls for
  each file) and for the whole mod in the background, with a file limit, a yield between files,
  progress, cancellation when files change and a notice at the end of each pass; closing a file
  keeps its diagnostics; a finding's evidence and data travel in the diagnostic's `data`.
  Completion (the core's new `completionsAt`), hover (the lookup answer), go to definition,
  find references and document symbols. The game folder from the setting `pychivalry.gamePath`
  or any Steam library, one clear message when none is found, and a build other than the
  spec's said once. Four settings ([docs/guide/settings.md](guide/settings.md)). A test holds,
  on every fixture mod and the planted-defect mod, each file's diagnostics equal to the one
  runner's findings for it. The core gained, additively, `FileReading.fields`,
  `WorkspaceIndex.namesIn` and `filesNaming`. The extension that starts it (7.1, 7.2, the
  client side of 7.3, 7.7 to 7.12) is another branch's. Questions for the owner are in
  decisions.md ("Asked, awaiting the owner").

  *Built, client side (items 7.3, 7.4 and 7.6):* the extension starts the language server with
  `vscode-languageclient` 11.0.1: the bundle `dist/bundle/lsp/pychivalry-lsp.mjs` in the
  extension's folder, a Node module over IPC (`TransportKind.ipc`) on VS Code's own runtime, for
  the languages `ck3` and `ck3-localization`, with the spec package beside the agent server
  (`--spec`); it activates on either language or a folder holding `descriptor.mod`, and holds no
  checking, parsing or lookup logic. The manifest declares the four settings, with the language
  server's defaults (a test holds them to the server's) and a description each. The game folder
  setting reaches the language server (which reads it itself and says once when no game is
  found), the agent server (`--vanilla <folder>`; VS Code is told at once and forwards the new
  command line to its AI) and Claude Code: the extension remembers each set-up's command line
  and, when it would now give another, offers once to set the folder up again, the set-up's own
  remove-then-add. Editor tests in a real VS Code show the diagnostics, the server's
  `pychivalry/findings` equal to them, hover with the spec's description and completion of what
  is valid at the place (item 7.5 through VS Code).
- 7.7 The extension bundles the command line and puts it on the path of the integrated
  terminal.

  *Built:* the command line is bundled into `pychivalry-cli.mjs` beside the agent server, so it
  is copied to global storage with it and reads the same spec package. A launcher named
  `pychivalry` (a shell script; on Windows `pychivalry.cmd`) runs it on VS Code's own executable
  as Node, so the user needs no Node; it is written into `<global storage>/bin/` on activation,
  and VS Code's environment-variable collection puts that folder at the front of the integrated
  terminal's `PATH`. The smoke test types `pychivalry` into a terminal of the VS Code under test
  on Linux and Windows, and the same-answers test runs `check --json` there.
- 7.8 "Set up for Claude Code": adds the server to Claude Code's own configuration for this
  workspace. If the Claude Code command is not installed it says so and offers to write a
  project configuration file instead, after asking.

  *Built (#142):* with item 7.1 (b); without `claude` it asks, in a modal question, before
  writing `.mcp.json`, keeping the file's other entries, and writes nothing on a no.
- 7.9 The same-answers test: one mod through the editor, the command line and the agent
  server; the three finding lists must be identical.

  *Built:* in a real VS Code, once the language server's background pass has left nothing to
  check, every file's findings are read through its `pychivalry/findings` request and VS Code's
  diagnostics must be them; `pychivalry check --json --vanilla <game> <mod>` is typed into a
  terminal of that VS Code; the agent server is started from the definition VS Code's AI is given
  and asked `check` at every severity, page after page to the end. The three lists must be the
  same findings, compared on file, range, severity, code, message and data, and the editor's and
  the command line's on evidence too. In CI (the `vscode-test` job, Linux and Windows) on the
  planted-defect mod over its game stub: 33 findings (26 errors, 7 warnings) in 16 files. Locally
  on the five real mods with the game (`task vscode:corpus`, 2026-11-23): balance-of-power-ui 0
  findings in 11 files; divine-intervention 15 (3 information, 12 hints) in 433;
  elf-destiny 627 (2 errors, 79 warnings, 443 information, 103 hints) in 958; rice 2,942 (841
  errors, 1,122 warnings, 857 information, 122 hints) in 2,090, which the agent server gives in
  89 pages; viet-events 62 (1 error, 3 warnings, 58 information) in 211. Identical on all three
  surfaces, every mod.
- 7.10 Packaging: one installable file with the three bundles and the spec. Its size is
  recorded; 2.3.0's was 1.8 MB.

  *Built:* `task vscode:package` writes `packages/vscode/dist/pychivalry-0.1.0.vsix` with
  `@vscode/vsce` 4.1.1 (`--no-dependencies`; no publishing token, nothing published) from a
  staging folder of exactly what ships, and refuses a file holding anything else. It is
  **3.88 MB** (3,788 KiB), against release 2.3.0's 1.8 MB, in 18 entries: the manifest, the
  extension's README, the licence; `dist/bundle/extension.cjs` (the extension with its language
  client, 964 KiB, 145 KiB compressed), `lsp/pychivalry-lsp.mjs` (883 KiB, 167 KiB),
  `server/pychivalry-mcp.mjs` (1,274 KiB, 269 KiB), `server/pychivalry-cli.mjs` (427 KiB,
  100 KiB) and `server/manifest.json`; and the spec package with its three companions and their
  checksums, `server/spec/` (3.03 MiB, already gzipped: four fifths of the file). Nothing from
  `legacy/`, no source, no test, no fixture, no source map; the bundles are not minified.
- 7.11 A smoke test on the packaged file, installed into a clean VS Code, on Linux and Windows.

  *Built:* the `smoke` editor suite installs the `.vsix` with VS Code's own installer into a
  clean extensions folder and opens a copy of the planted-defect mod with the game folder set to
  its stub: the extension activates by itself from its versioned folder, which holds no source,
  test or source map; the background pass checks the mod and its errors and warnings appear;
  hover gives the spec's description of `is_adult`; completion in an effect block offers effects
  and no trigger; the agent server's definition carries the game folder; `pychivalry --version`
  runs in a terminal and is the launcher in global storage; and the same-answers test passes.
  It passes on Linux locally and in CI on Linux and Windows (the `vscode-test` job).
- 7.12 The first preview build, attached to a GitHub pre-release.

  *Done (decision 86):* on the owner's word, 2026-11-23, the public GitHub pre-release
  `v0.1.0`, "pychivalry 0.1.0 (preview)", on commit `133a9a1`, with `pychivalry-0.1.0.vsix`
  attached (SHA-256 `25f38c9dfd11e7019ac0f0b9b5d193b305be87c129fa687dca59dad7c20cac94`) and
  the notes as drafted. [preview-release.md](preview-release.md) is the record of what was
  published, and says how the next preview is made.

**Tests.** Rows "Completion and hover" and "Same answers on every surface" in MVP.md's table.
The extension tests run with the launching VS Code's own variables removed, so they also run
from a terminal inside VS Code.

**Delivers.** `packages/lsp/`, `packages/vscode/`, the first preview build.

**Done when.**

1. Both AI harnesses reach the server, on Linux and Windows, as recorded in 7.1.
2. The same-answers test passes.
3. The packaged extension passes its smoke test on both systems.
4. The preview build is published as a pre-release.

*2026-11-23:* (1) holds for all a test can show, on Linux and Windows in CI: VS Code forwards
the extension's definition to the Copilot harness, "Set up for Claude Code" writes Claude Code's
entry, and both command lines start a server that answers `check`, across an update too; a
real Claude Code connected from the entry on Linux. A signed-in harness calling the tools, and a
real Claude Code on Windows, are the owner's by-hand check. (2) holds: in CI on the planted mod,
and on the five real mods locally. (3) holds on Linux and in CI on Linux and Windows. (4) is
met: the pre-release was published on the owner's word (decision 86). Step 7 is done.

**Speed** (2026-11-23, `task vscode:corpus`; MVP.md, "Speed", has the method): the packaged
extension's time from activation to its first full result, and the language server's peak
memory then, the median of five warm runs, against the 2.3.0 editor baseline:

| | balance-of-power-ui | divine-intervention | elf-destiny | rice | viet-events |
| --- | ---: | ---: | ---: | ---: | ---: |
| First full result, 2.3.0 | 2.42 s | 18.00 s | 6.95 s | 22.47 s | 7.80 s |
| First full result, step 7 | 2.16 s | 9.86 s | 3.35 s | 6.41 s | 2.97 s |
| Peak memory, 2.3.0 | 0.28 GiB | 2.43 GiB | 0.39 GiB | 0.74 GiB | 0.43 GiB |
| Peak memory, step 7 | 0.65 GiB | 1.36 GiB | 0.72 GiB | 0.87 GiB | 0.72 GiB |

The language server alone, started by a test client (#140): 2.22, 13.92, 4.40, 7.88 and 3.47
seconds to the first full result, at 0.73, 1.98, 0.88, 1.02 and 0.84 GiB.

**Not yet known.** MVP.md open question 4's skills half (step 9). Whether three copies of the
index in memory at once were acceptable is answered: they were not (decision 87); the programs
share one ([shared-index.md](shared-index.md)), measured in MVP.md, "Speed".

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

  *Proposed (#145), then decided:* [formatting.md](formatting.md) proposed 13 rules, each checked
  against the base game, with 11 decisions; it measured 2.3.0's formatter on the base game (it
  changes the tree of 3,203 of 4,842 files). The owner signed the eleven off (decisions 90 to
  100), then set a new principle the same day, best practice and cleanliness over anything a mod
  author did, and decided again where it differs (decisions 101 to 103): the formatter decides
  the layout (a block of one simple pair, a list of plain values and an empty block on one line
  when the line fits in 120 columns, every other block broken, one item a line), writes Windows
  line breaks and the byte-order mark in every file, and a file not in the format is flagged.
  formatting.md is now the decided rules, with the record of both.
- 8.2 The formatter, working from the tree and keeping every comment and token.

  *Built:* `packages/core/src/format/`: every token kept, only the whitespace between tokens
  decided, gap by gap, from one table of layout rules (`FORMAT_RULES`) that every surface uses;
  it joins lines as well as splitting them, and leaves a file with a parse error as it is, with
  the reason. With it the `style/` family ([checks.md](checks.md#formatting-the-style-family)):
  `style/not-formatted`, one warning a file not in the format, whose safe fix formats the whole
  file, and eight hints, one a rule, each with a safe fix for its place, through the one runner,
  on pychivalry's own formatting rules (evidence `formatting-rules`, decision 103). A fixture
  pair for each of the nine codes.
- 8.3 The round-trip suite on the base game: after formatting, every file re-parses to the same
  tree. Part of `task game:parse`.

  *Built:* `task game:parse` formats every script file it parses, and the game's localization
  files, and fails on a file whose tree, tokens or comments change, whose comment moves, or that
  a second format changes (`records/game/parse.json`). On game 1.21.0.3: 4,854 script files, 4,851
  formatted (3 left, each with a parse error), 4,851 trees and token lists the same, 4,851 second
  formats unchanged, 502,890 comments before and after, none moved; 4,656 files changed, 3,280,071
  of 8,301,399 lines touched (by rule: layout 4,073 files, blank lines 2,749, trailing whitespace
  2,365, spacing 1,609, line breaks 1,551, indentation 1,493, comment spacing 683, the mark 645).
  12,171 localization files, all formatted, readings the same, 74,238 comments kept, 12,064
  changed. The 120-column rule: 26,560 lines over it before, 9,784 after (nothing left to break),
  990 files changed by it alone. On the five corpus mods (run, not committed): 2,206 script files and 1,497 localization
  files the index reads, every one formatted (none with a parse error), every tree and reading
  the same, every second format unchanged, 149,240 and 17,515 comments kept, none moved; 2,154
  and 1,391 files changed.
- 8.4 Golden files for each rule; formatting twice changes nothing.

  *Built:* `fixtures/format/`, 21 pairs written by hand, one a rule (and the files left as they
  are), in CI: each `before` formatted is its `after` byte for byte, a second format changes
  nothing, the tree and the comments are kept. *Since decision 110:* every fixture mod and the
  planted-defect mod are in the format too, but for exactly what each exists to test (a file
  with a parse error, a file not valid UTF-8, the bad half of a `style/` pair, three
  localization files without the mark), each fixture's other findings the same before and after;
  a test holds it.
- 8.5 On-type formatting, derived from the same rules, tested for agreement with the formatter.

  *Built:* after Enter, `}` and `=` in a script file (`format/on-type.ts`), never inside quoted
  text or a comment, never on another line. On every golden output, typing it key by key ends in
  the formatter's text, and Enter, `}` and `=` typed again at every place give it back.
- 8.6 Fix data in the core: where a finding has a mechanical fix, the fix is part of the
  finding.

  *Built (#146):* every finding carries `fix`: null, or its safety (`safe`, the one outcome that
  can be right; `suggestion`, a choice), its basis (a removed keyword's documented replacement,
  the names near the one written that fit the place, the links the game documents between
  scopes, what the parser read) and at most five alternatives, each a title and its edits, which
  may create or edit another file of the mod. The core checks a safe fix by checking the file
  again with it applied. Of the 62 built codes, 4 always have a safe fix, 12 have one when a
  single outcome is left and suggestions otherwise, 10 only suggestions, 36 none, each with its
  reason (`FIX_ROWS`; the Fix column of [checks.md](checks.md) and of the guide's check
  reference). Every surface carries them: the command line's JSON `fix`, `check --fix` (safe
  fixes only, then the mod checked again) and `--dry-run`; the agent server's `check`, which
  still writes nothing; the language server's quick fixes (8.7). On the corpus: rice has 141 safe
  fixes, all documented replacements of removed keywords, which take its errors and warnings
  from 1,963 to 1,822 and add nothing new; elf-destiny has 137 suggestions. New fixtures
  `fix-near-values` and `fix-scope-links`.
- 8.7 Quick fixes, each from fix data. 2.3.0's ten are the starting list: a localization stub
  for a missing key, a key rename, indentation, operator spacing, trailing whitespace, an
  empty block removed, a missing `ai_chance`, and three refactors.

  *Built in part (#146):* the language server offers each finding's fix as a quick fix,
  "Fix every safe `<code>` in the file", and "Fix every safe pychivalry finding in the file"
  (`source.fixAll`), all from fix data. Of 2.3.0's ten, the localization stub for a missing key
  is built (into one localization file of the mod: English if it has one, otherwise its first
  language; the text is the key), and the renames to a near name are built for the unknown-name
  name. Not built: an empty block removed and a missing `ai_chance` have no built check that
  reports them; the three refactors. *Since #148:* an empty block removed is the suggestion of
  `style/empty-block` (decision 105); a missing `ai_chance` (2.3.0's CK3613) waits for a role in
  the spec package (a question for the owner).

  *The formatting quick fixes, with 8.2:* 2.3.0's indentation, operator spacing and trailing
  whitespace quick fixes are retired as quick fixes of their own: no check of the signed-off
  inventory reports such a finding (2.3.0's `CK3301`, `CK3303`, `CK3304` and `CK3306` were not
  carried over in item 4.1), so they are what Format Document does. Since the owner's decision
  103 the `style/` family's safe fixes, `style/indentation`, `style/spacing` and
  `style/trailing-whitespace` among them, made by the formatter, are offered as quick fixes too.
- 8.8 `presentation/`: outline rules, snippets, field order and inline hints, brought back from
  the pre-2.0 schema files as pychivalry's own data. Loaded by the language server only. A
  test proves no check reads it.

  *Built (#144):* `presentation/`, one JSON file per game folder with `_all.json`, its schema
  and its README, read by the language server only (a test holds that no check reads it):
  outline rules for 27 folders; 111 snippets, each checked to raise no error or warning; field
  orders kept from the old files and re-ranked by what the base game writes most (decisions
  from 80 % to 95 % agreement, schemes from 86 % to 99 %); inline hints beside a record's key
  (its localized name, an option's text) and after a link (the scope type it switches to), at
  most 1,000 a file and 60 characters each, behind the new setting
  `pychivalry.inlayHints.enabled` (on by default; five settings now). Of the old files' entries
  266 are carried (30 corrected) and 27 dropped, the kind `faith_doctrines` with them. The
  extension's bundle carries the data beside the language server
  (`dist/bundle/lsp/presentation/`). New fixture `presentation-outline-and-hints`.

  *Since #148 (decision 107):* the field order moved, unchanged, into data the core reads
  (`packages/core/src/check/field-order.json`), since a check now judges it; completion reads it
  there, and no check is handed the presentation data. *Since decisions 109 and 111:* the orders
  of `common/decisions` and `common/character_interactions` are their `.info` files', and the
  111 snippets are written in the format (81 changed), a test holding that the formatter leaves
  each, expanded as the editor inserts it, unchanged.
- 8.9 `format` in the command line and the agent server, filled in.

  *Built:* the command line's `format <file|folder>...` (in place; `--check`, exit 1 when a file
  would change; `--diff`; nothing outside the mod, no file with a parse error or not valid UTF-8
  touched), the agent server's read-only `format` tool (the text as a proposal, paged; tool schema
  version 2) and the language server's Format Document, Format Selection and on-type formatting,
  all from the core. The extension makes UTF-8 with the mark and `\r\n` the defaults of CK3 files
  and turns a document's `\n` to `\r\n` with Format Document. The same-answers test covers
  formatting: on the planted-defect mod each file formatted by the editor, the command line in a
  terminal and the agent server, with the shared index on and off, gives the same text. Speed:
  formatting the whole base game's 4,854 script files takes 18.6 s (the median of five runs
  after a first of 17.5 s), its largest file (13.2 MB) 0.10 s; the `style/` findings make the
  base game's `game:check` 95 s and 3.7 GB at its peak (56 s and 2.9 GB before).
- *Best-practice rules (#148, decisions 105 to 108).* Under the owner's principle (decision 101),
  four rows of `style/` on pychivalry's own best-practice rules (evidence `best-practice`), each
  with a fixture pair, each counted on the base game by `pychivalry-tools advice proof`:
  `style/empty-block` (release 2.3.0's CK3314; the base game breaks it in 1.05% of its 2,321,663
  blocks inside records), `style/deep-nesting` (CK3317, one finding a record; 3.83% of 223,429
  records), `style/not-utf8` (a warning on a script or localization file not valid UTF-8, beside
  the unchanged note `encoding/not-utf8`; its fix converts the file to UTF-8 with the mark, the
  bad bytes read as Windows-1252, safe on all 27 such base-game files) and
  `style/unusual-field-order` (in six folders whose records the game reads by name; 10.68% of
  11,291 records, `common/decisions` and `common/character_interactions` not judged). `check
  --fix` converts a file not UTF-8 first; after each rule's fixes the formatter finds nothing new
  in its fixture. `localization/unused-key` is on by default again (decision 108, replacing
  decision 76), `--no-unused-keys` turning it off.
- *The owner's answers to step 8's questions (decisions 109 to 115).* `style/unusual-field-order`
  judges all eight folders of its data: `common/decisions` and `common/character_interactions`
  take the order of their `.info` files (Paradox's documentation, the spec's `info_docs`), and the
  base game breaks it in 398 of 587 decisions and 492 of 650 interactions; the rule as a whole in
  2,096 of 12,528 records (16.73%). `style/empty-block` and `style/deep-nesting` judge every
  folder, none left out. Every fixture mod and the planted-defect mod are in the format, but for
  what each exists to test; the planted mod plants a line indented with spaces
  (`style/not-formatted` and its hint `style/indentation`) and a file not UTF-8
  (`style/not-utf8`), 35 defects in all, and its graders and its every-code rule count the
  family. The 111 snippets are in the format. Release 2.3.0's LOC-001 is
  `style/localization-key-characters`, a hint (15,406 of the base game's 3,100,662 keys, 0.50%;
  1,675 of its 340,445 English keys); its CK3872 is the row `style/redundant-condition`,
  blocked: part D4 gives `always` and the logical operators no role, so the check would have to
  name them. A file not UTF-8 shows one finding, `style/not-utf8`, whose message and data say
  how it was read; the note `encoding/not-utf8` is retired. The style findings' cost is accepted
  as it is (the base game's `game:check` now 90 s and 3.9 GB at its peak).
- 8.10 The second preview build.

  *Done (decision 116):* on the owner's word, 2026-11-23, the public GitHub pre-release
  `v0.2.0`, "pychivalry 0.2.0 (preview)", on commit `5b69ec0` (the merge of #150), with
  `pychivalry-0.2.0.vsix` attached (4,050,490 bytes, SHA-256
  `cf810a06a9ee2a04783bf26e96323bebf545a35f61bd0e124e2cf95ab0bc4b61`) and the notes as drafted.
  The by-hand check was not run before it was published.
  [preview-release-0.2.0.md](preview-release-0.2.0.md) is the record.

**Tests.** Rows "Formatter", "On-type formatting" and "Quick fixes" in MVP.md's table.

**Delivers.** `packages/core/src/{format,fix}/`, `docs/formatting.md`, `presentation/`.

**Done when.**

1. The round-trip suite passes on every base-game file. *Holds:* on all 4,851 script files the
   formatter formats (the 3 with a parse error are left as they are, byte for byte) and all
   12,171 localization files.
2. Every golden file and every fix fixture passes. *Holds:* the 21 golden pairs, the nine
   formatting `style/` pairs and the five best-practice pairs, and every fix of every fixture mod
   (`task ci`).
3. The same-answers test is extended to formatting and passes. *Holds:* in a real VS Code on the
   planted-defect mod (`task vscode:test`, in CI on Linux and Windows), the editor's side by the
   real Format Document command, which turns the mod's `\n` files to `\r\n`.

**Not yet known.** Whether a recognised community formatting convention exists beyond "tabs".
*Answered by item 8.1: beyond one tab per block, none
([formatting.md](formatting.md#is-there-a-community-convention)).*

---

## Step 9: skills and the authoring run

**Goal.** The AI can explain an error, fix an error and write new content that the game
accepts, in both harnesses, and a scored run says how well. Third preview build.

**Depends on.** Step 8.

**Work items.**

- 9.1 The skills folder, in the form both harnesses load, as proved in 7.1. Three skills:
  explain an error, fix an error, write new content.

  *Built:* `skills/` holds `pychivalry-explain-error`, `pychivalry-fix-error` and
  `pychivalry-write-content` ([skills/README.md](../skills/README.md)), each a folder with one
  `SKILL.md`: a frontmatter of `name` (the folder's name) and `description`, then the
  instructions. That is the form VS Code 1.147 and Claude Code 2.1.220 both read, checked
  against each one's documentation and shipped code
  ([references/editors-and-agents.md](references/editors-and-agents.md#skills-checked-for-build-step-9-2026-11-23)).
  The bundle copies the folder to `dist/bundle/skills/`, the manifest lists each `SKILL.md`
  under `contributes.chatSkills`, and the `.vsix` holds them. Each skill drives the agent
  server's tools by their bare names (a client may prefix them), names the command line where a
  terminal helps (`pychivalry format <file>`, `pychivalry check --fix .`), and holds no CK3
  vocabulary of its own. `packages/vscode/src/skill-files.test.ts` holds the three skills and the
  manifest's list together; each file to both harnesses' rules on its frontmatter; every tool,
  command and option a skill names to the agent server's registry (`TOOLS`) and the command
  line's (`COMMANDS`), with the tools each skill must drive; and everything a skill writes as
  code to pychivalry's own vocabulary or a name the spec package has, with no such name outside
  code. In the editor tests (`task vscode:test`, Linux and Windows), VS Code lists the three
  skills the extension contributes, from its development folder and from the installed `.vsix`'s
  versioned folder, and syncs them byte for byte into the plugin it writes for its Copilot
  harness, as item 7.1 (a) saw it do with the agent server's definition.
- 9.2 The authoring skill's rules: look names up before using them; write events with their
  localization; run the checker; repair from the findings; stop at zero errors or after 5
  rounds; never claim success with errors left. Content types: events, decisions, scripted
  effects, scripted triggers.

  *Built:* `pychivalry-write-content` states the six rules in this order, then a seventh from the
  owner's principle (decision 101): format what it writes, so that no `style/` finding is left,
  `style/not-formatted` and `style/not-utf8` counting as errors for the stop rule; the four
  kinds of content and the folder each goes in; and the steps: learn the folder from the base
  game (`list_definitions`, `lookup` of each field), names of the mod's own that clash with
  nothing (`find_definition`), draft, check and repair round by round, report, saying what a
  clean check does not prove. A missing localization key's finding carries the stub to write,
  and the skill writes real text there. A test holds the rules, in order, and the four kinds.
  Since item 9.8 the format is written by the agent server's `apply_format`, which the skill runs
  on each file it wrote: the first run showed that a harness's own file tools cannot be relied
  on to write Windows line breaks (confirmed by the owner, decision 126, since the server wrote
  nothing before). In the second run every session ran `apply_format` and every result was in
  the format.
- 9.3 "Set up for Claude Code" extended to install the skills.

  *Built:* once the server is set up (by `claude mcp add`, or the `.mcp.json` the person said
  yes to), the set-up copies the skills into Claude Code's folder of personal skills, `skills/`
  of `$CLAUDE_CONFIG_DIR` or of `~/.claude`, as Claude Code 2.1.220 computes it, never into the
  mod (`packages/vscode/src/skills.ts`). It is idempotent (a second set-up writes nothing) and
  writes and removes only pychivalry's own copies, known by the SHA-256 of every file it wrote,
  of any version, kept in a file of the extension's global storage: a skill of the same name it
  did not write, or one edited since, is left as it is and named. Activation brings existing
  copies up to the extension's version after an update. A new command, "pychivalry: Remove from
  Claude Code", undoes a folder's set-up: its local entry, the extension's own entry of
  `.mcp.json`, and, with the last folder set up, the skills. Unit tests run it in temporary
  folders with Linux and Windows path forms; the editor tests show the set-up copying them, a
  second set-up changing nothing, an update from one version to the next bringing them to the
  new version's skills, and the removal taking them out while another skill stays.
- 9.4 The fixed list of content requests, with what a correct result must contain for each.

  *Built (#152):* `fixtures/requests/requests.json`
  ([fixtures/requests/README.md](../fixtures/requests/README.md)): twelve requests with stable
  ids, three each of events, decisions, scripted effects and scripted triggers, one easy, one
  medium and one hard of each; ten start from an empty mod and two from a mod that already has an
  event, a scripted effect and a scripted trigger (`fixtures/requests/bases/`). Each states the
  names it relies on, each a name of the spec package's buckets, an iterator over one of its
  lists, a schema field with a value the base game writes, or a definition of its base mod;
  `tools/src/scored-run/requests.test.ts` proves every one exists, and the run checks it again
  before it starts. What a correct result must contain is written twice over: expectations
  checked in code (a new file in a folder, an event namespace, a name defined, a field written
  directly in a record with a value or a count, a name used inside a record, a reference that
  resolves to a definition of the mod or the base game, an English localization key, a base
  file left byte for byte), and judged dimensions from one closed set of five
  (`effects-as-asked`, `conditions-as-asked`, `scope-as-asked`, `text-as-asked`,
  `nothing-unasked`), each with its question. Every request can be met: an example result of
  each, in pychivalry's format, meets every expectation with nothing from the checker, in CI.

  *Harder requests (#PRNUM),* on the owner's word (decision 131), because the second run was at the
  ceiling: twelve more, three of each kind, at a new difficulty level, `expert`, after the twelve,
  which are unchanged; four build on a new base, `granary`. Each sets a trap a first draft is
  likely to fall into: a name 1.21.0.3 renamed (`county_opinion`, `house_power`) or the game never
  had (`is_at_peace`, `has_spouse`, `release_prisoner`), described in words so that only a lookup
  finds the right one; a scope a list leads into; a saved scope passed between events; a
  definition of the base only described, to find and use; a definition changed in place, the rest
  of its file byte for byte; a new file of the base's namespace. The request format gains a name
  left `unnamed` in the text, expectations `within` a block, a `count` of definitions and `kept`
  definitions; the dimensions are unchanged. Each has an example clean over an empty and the
  installed game, and a hand-made first draft with its mistake that a test holds to failing for
  its stated reason: eight on the checker's own errors and warnings, four on expectations
  ([tools/scored-run/README.md](../tools/scored-run/README.md#the-expert-requests-decisions-131-and-132)).
- 9.5 The scored authoring run, on the script from item 6.8. Grade one, validity: the checker.
  Grade two, the match to the request: a separate model call that reads the request and the
  result and answers per dimension, and may answer "cannot tell".

  *Built (#152):* `task scored:authoring`
  ([tools/scored-run/README.md](../tools/scored-run/README.md#the-scored-authoring-test)), on
  item 6.8's script, its confinement check now shared by every scored session
  (`confinement.ts`). For each request and trial: a fresh copy of its base mod, the three skills
  copied whole as the set-up copies them into a configuration folder of the trial's own (its
  `.claude/skills/`, or with `SCORED_SKILLS_IN=config` a temporary `CLAUDE_CONFIG_DIR`), one
  authoring test session with the agent server over the installed game, `Read`, `Edit`, `Write`
  and `Skill`, the session limit and a time limit; the harness held only if the three skills
  were offered and every file the session named was in its mod. Grade one: the checker, as three
  measures (no error, no warning, in pychivalry's format). Grade two: the expectations in code,
  then the judge, one more test session of the same Claude Code started as a child process, with
  no tool, no server and no skill, its prompt (`tools/scored-run/judge.prompt.md`) on its
  standard input, answering each dimension `yes`, `no` or `cannot-tell` in the shape of
  `judge.schema.json`; the parsing is fixed, and an answer that is not that shape, about another
  request, or not answering exactly the questions, is recorded as malformed. A harness problem
  stops the run. The record `records/scored/authoring.json` (suite `scored:authoring`) keeps per
  trial what the agent-use record keeps of the session, the validity, the expectations and the
  judge's answers, and per request and over all the counts of each measure; no target, no
  figure about the developer's plan. Every part is tested in public CI against a stand-in for
  Claude Code; `no-model-call.test.ts` holds the scripts to starting no program but the Claude
  Code named, and to no key, model library or network.
- 9.6 The judge is calibrated once against results graded by hand, and the agreement is
  recorded.

  *Built (#152), not run:* `task scored:calibrate`
  ([tools/scored-run/README.md](../tools/scored-run/README.md#calibrating-the-judge-item-96)): a
  hand-grades file (`grades_format` 1: each result's folder, its request, and the person's answer
  on each of its dimensions; no name of the person), one judge test session per result, and the
  record `records/scored/calibration.json` (suite `scored:calibration`): per dimension and over
  all, the grades, those the judge answered, those it agreed with, the agreement, how often the
  person and the judge said "cannot tell", and the table of hand answer against judge answer.
  Tested with stand-in grades and a stand-in judge. The calibration itself needs results graded
  by hand: a procedure the owner starts. Two sheets wait for him
  ([guide/judge-calibration.md](guide/judge-calibration.md)): ten hand-made results, some
  deliberately wrong (`fixtures/requests/calibration/`, 26 answers, 10 judge test sessions),
  graded first; and twelve real results of the second run, trial 1 of each request, not picked
  (`fixtures/requests/calibration/run-2/`, 36 answers, 12 judge test sessions). `SCORED_RECORD`
  gives each sheet's calibration a record of its own.
- 9.7 The hand checklist for VS Code's built-in AI, which cannot be scripted: the same
  requests, run by a person, with what to look for.

  *Built:* [guide/ai-checklist.md](guide/ai-checklist.md): what a person needs (VS Code signed
  in, in agent mode; an empty mod and a copy of the planted-defect mod over its game stub, each a
  git repository), the checks that the skills and the tools are there, six requests (one of each
  kind of content, an explanation and a fix), and what to look for in each: the skill used,
  names looked up first, the right folders, the localization written, a check after each round
  and at most five, no error and no `style/` warning, the request met, an honest report. Its
  authoring requests are four of item 9.4's list, by their ids and words (#152). It has not
  been run yet.
- 9.8 The first scored authoring run, from which the owner sets the targets.

  *Run on the owner's word of 2026-11-24* (decisions 120 to 124), the whole run at once:
  `SCORED_MODEL=claude-opus-5-5 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring`
  on Claude Code 2.1.330: every request, 5 trials each, 120 test sessions (60 authoring, 60
  judge), each with session limit 3; no harness problem. The record,
  `records/scored/authoring.json`: 60 of 60 trials held; 50 without an error, 0 without a
  warning, 0 in the format, 58 meeting every expectation; the judge answered yes to all 180 of
  its questions, never no or cannot tell, none malformed. It proved the four things the tests
  had assumed: project skills offered under the setting sources used, the `Skill` tool, the
  judge's prompt on standard input with no tool, and the judge's answer shape. It found three
  faults of pychivalry's own, each fixed with tests that need no model
  ([tools/scored-run/README.md](../tools/scored-run/README.md#the-first-scored-authoring-run-item-98)):
  nothing in a session could put a file in the format (`format` only proposes, and Claude Code's
  own file tools keep the line breaks they are given or find), now the agent server's
  `apply_format`, which the skills use; the base mod of two requests defined an event the base
  game defines too (`definitions/clash` in every trial of theirs), now retired and replaced on a
  clean base, the run refusing a base not clean over the game; and an expectation stricter than
  the game, which failed two trials that hooked their event through an on-action of their own,
  as the game documents, now corrected. The record's measures stay as made; since the second
  run it is kept as `records/scored/authoring-run-1.json`.

  *The targets,* set by the owner on 2026-11-24 (decision 127), strict, holding before any
  release: every result with no error; every result with no warning and in pychivalry's format;
  at least 95% meeting every expectation checked in code; no judged dimension below 95% yes. The
  record holds measures only; the targets are read from them, by the run when it ends and by
  `task scored:targets` from any record ([tools/scored-run/README.md](../tools/scored-run/README.md#the-targets-item-98)).
  The first run meets two of them (every expectation 58 of 60; every dimension 100% yes) and
  misses two (no error 50 of 60; no warning and in the format 0 of 60).

  *The second run,* on the owner's word of the same day (decision 128), the whole run at once
  with its results kept, from the merge of #153: the same command with `SCORED_KEEP=true`, every
  request of the corrected list, 120 test sessions, each with session limit 3, on Claude Code
  2.1.330. Its record, `records/scored/authoring.json`: 60 of 60 trials held; 60 without an
  error, 60 without a warning, 60 in the format, 60 meeting every expectation; the judge yes to
  all 180 questions. Every target met, by a development run of 5 trials a request
  ([tools/scored-run/README.md](../tools/scored-run/README.md#the-second-scored-authoring-run-item-98)).
  From the kept trials: every session ran `apply_format` (110 calls, none refused) and `format`
  never; no check a session made after writing found an error or a warning, so no session needed
  a round of repair for one (four made one round for a hint) and the five-round stop rule was
  never approached; 17 tool errors, 13 of them calls by a tool's bare name in four sessions of
  one request; no permission denial. Every measure is at its ceiling, on twelve requests written
  with the skill they test, one model writing and one judging, nothing harder tried: the run
  shows the fixes hold, not that the test can tell a better server or skill from a worse one, nor
  that the judge can say no.

  *Harder requests,* the owner's answer (decision 131): added before the third preview (item
  9.4). What shows without a model that they tell results apart: each expert request's first
  draft fails the code-checked side for its stated reason; a third calibration sheet holds a
  right and a subtly wrong result of each, which only a judge can tell apart, every one passing
  everything code checks (88 answers, 24 judge test sessions, graded only if the owner chooses).
  The repair loop can be shown only by a real run; a test plays the skill's steps on the eight
  drafts the checker catches through the built agent server, their errors and warnings reported
  and none after the repair, and those eight requests are the ones expected to exercise it. The
  second run's tool errors are answered in pychivalry's own wording: each skill and the server's
  instructions give Claude Code's full name of every tool and say a short name reaches nothing (13
  calls); a cursor is said to continue only the answer it came from, with the same arguments, and
  a refused one says what to do instead (4 calls). The targets are read with and without the
  expert requests; a record made before them, as both committed ones were, is read over the twelve
  it has, names the twelve it lacks, and is no release run of the list.
- 9.9 The third preview build.

  *Its release run* (decision 132) is made once, on the owner's word, after his hand calibration
  and hand checklist and once the request list is final: 10 trials of each request, as MVP.md's
  repetitions before a release. With the twenty-four requests, 240 trials, each one authoring and
  one judge test session: 480 test sessions.

**Tests.** Row "Authoring" in MVP.md's table, on its first two measures.

**Delivers.** `skills/`, `fixtures/requests/`, the first scored authoring record.

**Done when.**

1. The three skills load in both harnesses. *Holds: in Claude Code, every session of the first
   run offered them and loaded one (item 9.8); in VS Code, the editor tests list them.*
2. The first scored authoring run is on record and the owner has set the targets. *Holds: the
   first run is on record (2026-11-24), kept as `records/scored/authoring-run-1.json`; the
   targets are set (decision 127), and the second run meets them all (decision 128).*
3. The hand checklist has been run once on VS Code's built-in AI. *Not yet: the owner runs it
   himself (decision 129), on an extension file built from `main` (not preview 0.2.0), which the
   checklist says how to build, install over 0.2.0 and tell apart from it.*

**Not yet known.** How well a model judge agrees with hand grading: the calibration of item 9.6
is built to measure it, and waits for results graded by hand on its sheets; the judge of
both runs said yes to every question, which agrees with everything code could check but cannot
show it would say no. Whether the requests are hard enough to tell a better server or skill from
a worse one: the second run is at the ceiling on every measure, and twelve expert requests were
added (decision 131), which no model has been run on yet. Whether one skills folder
serves both harnesses unchanged: *answered by items 9.1 and 9.3 as far as a test can show: it
does, the same files read by VS Code from the extension and by Claude Code from its own folder;
whether a signed-in AI follows them is the scored run's to measure.*

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
| Item 6.11 | The word to start the first test sessions of the agent-use test; then, from their result, its target and the go for step 7 (decisions 79 and 80). Answered: the sessions ran (decision 81), the target is every test session passing, 10 of 10 before a release (decision 82), and step 7 has started (decision 84). |
| Item 7.1 | Only if a harness cannot be reached as designed. Not needed: both were reached (#142). |
| Item 7.12 | The word to publish the first preview as a GitHub pre-release, from the draft in [preview-release.md](preview-release.md). |
| Item 8.1 | Sign-off on the formatting rules. |
| Item 9.8 | The targets for the authoring run. Answered 2026-11-24 (decision 127): every result with no error; every result with no warning and in the format; at least 95% meeting every expectation; no judged dimension below 95% yes; before any release. |
| Step 11 | Each use of the analysis machine. |
| Item 13.5 | What happens to the 2.x listing. |
