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
| [preview-release.md](preview-release.md) | The first preview's GitHub pre-release (item 7.12), drafted for the owner: its tag, title and notes, and how it is made. Not published | Step 7 |

## Sources and test data

| Document | What it holds | Written by |
| --- | --- | --- |
| [references/](references/README.md) | Every source pychivalry draws on, how far each is trusted, what may be copied from it, and notes on each | Step 1; every step that uses a new source |
| [test-data.md](test-data.md) | Every kind of test data: fixtures, the planted-defect mod, the five real mods, the base game, records, what is carried over from 2.3.0 | Step 1; every step that adds test data |

## For users

| Document | What it holds | Written by |
| --- | --- | --- |
| [guide/](guide/README.md) | The user guide: installing the preview, commands, settings, the agent server ([guide/agent-server.md](guide/agent-server.md), step 6), the reference of every check ([guide/checks.md](guide/checks.md), written from the core's check inventory by `task docs:checks`), and the check a person makes by hand before a preview goes out ([guide/by-hand-check.md](guide/by-hand-check.md), step 7) | Step 1 starts it; each step that ships a feature adds to it; step 13 completes it |
| [wiki/](wiki/README.md) | How the repository's GitHub wiki is generated from these documents, and its home page | Step 1 |

## The game's behaviour, as each step establishes it

Each is written by the step named, from evidence.

| Document | What it holds | Written by |
| --- | --- | --- |
| [encoding.md](encoding.md) | What the parser reads: encodings, byte-order marks, line endings, positions, the base-game folders it reads, the syntax it accepts and the findings it reports | Step 2 |
| [overrides.md](overrides.md) | The game's override rules: which definition the game uses when one is made twice, by a mod and the base game, by two files or in one file; the evidence for each rule, settled or open, and the in-game experiment for each open one. The rules are carried as data in the spec package's part D1 | Step 3, items 3.1 and 3.1a |

These do not exist yet:

| Document | What it will hold | Written by |
| --- | --- | --- |
| `formatting.md` | The formatting rules | Step 8 |
| `gui-syntax.md` | GUI file syntax | Step 10 |
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
| [../fixtures/README.md](../fixtures/README.md) | The hand-written test mods, the game stubs and the planted-defect mod |
| [../tools/scored-run/README.md](../tools/scored-run/README.md) | The scored test of the agent server (step 6): a developer's test script, never shipped or run by CI, that starts the developer's own Claude Code as separate test sessions with the agent server attached and grades them in code; pychivalry holds no key and makes no model call |
| [../tools/data/](../tools/data/) | The classifications of the base game's parse errors (`parse-classifications.json`) and check findings (`check-classifications.json`), and of the five mods' check errors (`mods-classifications.json`), read by the game-file suites |
