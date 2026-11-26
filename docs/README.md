# pychivalry: documents

Every document in this folder, what it is for, and which build step writes it. A step that adds
a document adds its row here.

## What is being built

| Document | What it holds | Written by |
| --- | --- | --- |
| [MVP.md](MVP.md) | What is being built and why: the decisions as they stand, the scope, the tests each feature needs, the definition of done | Before step 1 |
| [PLAN.md](PLAN.md) | How it is built: thirteen steps, each with numbered items, tests and a "done when" list; the Progress table | Before step 1; updated by every step |
| [decisions.md](decisions.md) | Every decision with its date, in the order it was made, and the choices an agent made that the owner has not yet confirmed | Every step that asks or answers one |
| [checks.md](checks.md) | The check inventory: every check the MVP ships, with its code, severity, evidence (or "advice"), the 2.3.0 check it replaces, its fixture pair and its state (built, blocked, retired); the code scheme; the review of 2.3.0's codes and the pre-2.0 rules. Signed off by the owner on 2026-11-21 | Step 4, item 4.1; every step that adds a check |
| [preview-release.md](preview-release.md) | The first preview's GitHub pre-release (item 7.12), published on the owner's word on 2026-11-23: its tag, title, commit, file and notes as published, and how a preview is made | Step 7 |
| [preview-release-0.2.0.md](preview-release-0.2.0.md) | The second preview's GitHub pre-release (item 8.10), published on the owner's word on 2026-11-23: its tag, title, commit, file and notes as published, what is new since 0.1.0, and that the by-hand check was not run before it | Step 8; step 9 records the publication |
| [preview-release-0.3.0.md](preview-release-0.3.0.md) | The third preview's GitHub pre-release (item 9.9), published on the owner's word on 2026-11-26: its tag, title, commit, file and notes as published, what is new since 0.2.0, the release run's result and the judge not yet calibrated, and that the by-hand check, the hand calibration and the hand checklist were not done before it | Step 9 |
| [shared-index.md](shared-index.md) | How the language server, the agent servers and the command line share one copy of the base game's index (decision 87): the options weighed and why one was chosen, how it works, its local channel and the exception to rule 12, what only Windows can show, and the measurements | Step 7, after its pre-release |

## Sources and test data

| Document | What it holds | Written by |
| --- | --- | --- |
| [references/](references/README.md) | Every source pychivalry draws on, how far each is trusted, what may be copied from it, and notes on each | Step 1; every step that uses a new source |
| [test-data.md](test-data.md) | Every kind of test data: fixtures, the planted-defect mod, the five real mods, the base game, records, what is carried over from 2.3.0 | Step 1; every step that adds test data |

## For users

| Document | What it holds | Written by |
| --- | --- | --- |
| [guide/](guide/README.md) | The user guide: installing the preview, commands, settings, the agent server ([guide/agent-server.md](guide/agent-server.md), step 6), formatting ([guide/formatting.md](guide/formatting.md), step 8), the reference of every check ([guide/checks.md](guide/checks.md), written from the core's check inventory by `task docs:checks`), the check a person makes by hand before a preview goes out ([guide/by-hand-check.md](guide/by-hand-check.md), step 7), the hand checklist of the skills in VS Code's own AI ([guide/ai-checklist.md](guide/ai-checklist.md), step 9), and grading results by hand for the judge's calibration, on its two sheets ([guide/judge-calibration.md](guide/judge-calibration.md), step 9) | Step 1 starts it; each step that ships a feature adds to it; step 13 completes it |
| [wiki/](wiki/README.md) | How the repository's GitHub wiki is generated from these documents, and its home page | Step 1 |

## The game's behaviour, as each step establishes it

Each is written by the step named, from evidence.

| Document | What it holds | Written by |
| --- | --- | --- |
| [encoding.md](encoding.md) | What the parser reads: encodings, byte-order marks, line endings, positions, the base-game folders it reads, the syntax it accepts and the findings it reports; and the best-practice warning on a file not UTF-8, with its converting fix (decision 106) | Step 2; step 8 (#148) |
| [overrides.md](overrides.md) | The game's override rules: which definition the game uses when one is made twice, by a mod and the base game, by two files or in one file; the evidence for each rule, settled or open, and the in-game experiment for each open one. The rules are carried as data in the spec package's part D1 | Step 3, items 3.1 and 3.1a |
| [formatting.md](formatting.md) | The formatting rules, as the owner decided them (decisions 90 to 103) and as built: the principle, each rule with its base-game evidence and what it changes, the 120-column rule, the `style/` findings, what the formatter guarantees, the round trip on the base game, on-type formatting and Format Selection, what release 2.3.0's formatter did, and the record of what was decided | Step 8, items 8.1 to 8.5 |
| [gui-syntax.md](gui-syntax.md) | GUI file syntax, measured from all 583 `.gui` files of the install: which files, what it shares with script, named blocks, type definitions, templates and `using`, values with units, constants; what the GUI parser reports and the install's own defects; the index of GUI types and templates and go to definition; how a mod's GUI overrides the base game's, from the spec package's override rules, and what is open | Step 10, items 10.1 to 10.4 |

These do not exist yet:

| Document | What it will hold | Written by |
| --- | --- | --- |
| `game-log.md` | The error-log format | Step 11 |

## Elsewhere in the repository

| Document | What it holds |
| --- | --- |
| [../README.md](../README.md) | What pychivalry is and the state of the rebuild |
| [../AGENTS.md](../AGENTS.md) | The rules for anyone, agent or person, working here |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How to report a problem or propose a change |
| [../SECURITY.md](../SECURITY.md) | How to report a vulnerability |
| [../CHANGELOG.md](../CHANGELOG.md) | What changed, release by release |
| [../spec/README.md](../spec/README.md) | The committed spec package |
| [../records/README.md](../records/README.md) | The record format of the suites that need game files |
| [../records/corpus/README.md](../records/corpus/README.md) | The five real mods and their manifest |
| [../fixtures/README.md](../fixtures/README.md) | The hand-written test mods, the game stubs, the planted-defect mod and the content requests |
| [../fixtures/requests/README.md](../fixtures/requests/README.md) | The content requests of the scored authoring test (step 9): the twenty-four requests, twelve of them expert, what each holds and expects, the base mods, the example results, the expert requests' first drafts and the tests that hold them |
| [../fixtures/requests/judge/README.md](../fixtures/requests/judge/README.md) | The judge's labelled cases (step 9): hand-made results that hold what the judge of the scored authoring test is given, each from a case a run found it getting wrong, beginning with the expert run's `trigger-loyal-realm` |
| [../skills/README.md](../skills/README.md) | The three skills (step 9): what each is for, the one form both AI harnesses load, how VS Code's AI and Claude Code each get them, and the tests that hold them |
| [../presentation/README.md](../presentation/README.md) | The presentation data (step 8, item 8.8): outline rules, snippets and inline hints, one JSON file per game folder, read by the language server only and never by a check; its schema and what was carried over from the pre-2.0 schema files. The field order it held moved into the core's data (decision 107); the page still says what it is, and in which folders it has no meaning to the game |
| [../tools/scored-run/README.md](../tools/scored-run/README.md) | The scored tests (steps 6 and 9): developer's test scripts, never shipped or run by CI, that start the developer's own Claude Code as separate test sessions: the agent-use test on the planted-defect mod, the authoring test on the content requests with its judge and the owner's targets, the judge's calibration and the re-judging of kept results; how each runs, is graded and recorded, and the runs so far; pychivalry holds no key and makes no model call |
| [../tools/data/](../tools/data/) | The classifications of the base game's parse errors (`parse-classifications.json`) and check findings (`check-classifications.json`), and of the five mods' check errors (`mods-classifications.json`), read by the game-file suites |
