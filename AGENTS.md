# AGENTS.md

Rules for any agent, or person, working in this repository. The plan is
[docs/PLAN.md](docs/PLAN.md); the decisions and the definition of done are in
[docs/MVP.md](docs/MVP.md). Where this file and MVP.md disagree, MVP.md is right and this file
is fixed.

## Working rules

1. **One step, one branch, one pull request.** Branch `agents/step-<n>-<short-name>`, cut from
   `main`, worked in its own git worktree. The pull request is merged when the step's "Done
   when" list holds and a second agent that did not write the code has checked it.
2. **The step's section is the brief.** Read MVP.md, the step's section of PLAN.md, and the
   sections of the steps before it. Work its items in order.
3. **Tests first where a record exists.** Where release 2.3.0 has a test, a fixture or a record
   for the behaviour, carry it over before writing the code.
4. **Nothing from `legacy/` is copied as code.** Tests, fixtures and records are data and are
   carried over. Reading the old code for how it solved a problem is expected. Nothing under
   `legacy/` is changed.
5. **No name lists in the code.** A table a check needs comes from the spec package or from the
   user's installed game. If a step finds it needs a table the spec lacks, it stops and the
   table is requested from `pdx-parser-re`.
6. **Evidence for every error and warning.** A finding without game evidence is advice, shown as
   information or a hint.
7. **`task ci` stays green and stays free** of any display, game file, model, key or network.
8. **A blocked item is a question for the owner,** asked at once. It is not a reason to start a
   later item.
9. **Game launches happen only on the analysis machine the plan names,** on the owner's word.
10. **Every step ends by updating** the Progress table in PLAN.md, `CHANGELOG.md`, and any
    document the step changed the truth of: the user guide (`docs/guide/`) for anything a user
    can see, `docs/references/` for a source used for the first time, `docs/test-data.md` and
    the `fixtures/` pages for new test data, `docs/decisions.md` for a decision asked, answered
    or made, `docs/README.md` for a new document, and the wiki manifest for a document users
    should find on the wiki.
11. **No TODO or FIXME stubs.** Delivered code works. The only stubs are those the plan defines
    as stubs (the four `game:*` tasks of step 1).

## Commands

Everything goes through [Taskfile.yml](Taskfile.yml); `task --list` shows it all.

| Task | What it does |
| --- | --- |
| `task ci` | Everything public CI runs: install, build, lint, format check, tests, spec check, record check, wiki check |
| `task install` | `npm ci` from the root lock file |
| `task build` | `tsc -b` over every package and the tools |
| `task test` | Every package's tests: Node's built-in test runner on the compiled output |
| `task lint` | ESLint, type-aware, warnings as errors |
| `task format:check` / `task format` | Prettier, check only / write |
| `task spec:check` | The committed spec package: checksum of the uncompressed bytes, supported format |
| `task records:check` | Every committed record: valid format, made on the committed spec and corpus |
| `task wiki:check` | The wiki builds from `docs/`: every published document exists and every link resolves |
| `task wiki:build` | The wiki pages, built into `.wiki-build/` to look at |
| `task wiki:publish` | Publishes the wiki. Public the moment it runs: only on the owner's word ([docs/wiki/README.md](docs/wiki/README.md)) |

## Layout

| Folder | What lives there |
| --- | --- |
| `packages/core` | Parse, index, check, lookup, format, fix data. The only package that knows CK3. No runtime dependencies. |
| `packages/cli`, `packages/mcp`, `packages/lsp` | Thin shells over the core: command line, agent server, language server |
| `packages/vscode` | The extension: starts the servers, registers the agent server. No CK3 logic. |
| `tools` | The scripts behind the local tasks: spec and record checks, the game-file suites, the corpus manifest, the 2.3.0 baselines |
| `spec` | The committed spec package ([spec/README.md](spec/README.md)) |
| `records` | Committed results of the game-file suites ([records/README.md](records/README.md)) |
| `fixtures` | Hand-written test data in three parts: `mods/`, `game/`, `defects/` ([fixtures/README.md](fixtures/README.md)) |
| `docs` | Every document ([docs/README.md](docs/README.md)): MVP and plan, the decision log, references, test data, the user guide, the wiki source |
| `legacy` | Release 2.3.0, unchanged, until step 13 |

Every package is TypeScript in strict mode on the shared [tsconfig.base.json](tsconfig.base.json),
compiled by `tsc -b` to its `dist/`, ES modules. A test file sits beside the file it tests as
`<name>.test.ts` and uses `node:test` and `node:assert/strict`; the runner reads the compiled
`dist/**/*.test.js`.

## How to add a check

From step 4. Each check is one file under `packages/core/src/check/`, with its test beside it:

1. Add its row to `docs/checks.md` first: code, severity, what it finds, its evidence (a
   catalogue message, a required schema field, the game's own output, or a reproduced in-game
   error) or the word "advice", the 2.3.0 check it replaces, and its fixture pair. A row
   without evidence can only be advice. Codes are permanent: never renamed, never reused.
2. Write the fixture pair under `fixtures/mods/`: `<check-name>-bad`, which it fires on, and
   `<check-name>-good`, which it is silent on ([fixtures/mods/README.md](fixtures/mods/README.md)).
3. Write `check/<name>.test.ts` against the pair, then `check/<name>.ts`. Every keyword it
   needs comes from the spec package or the installed game, never from a list in the code.
4. Run the base-game and real-mod suites (`task game:check`, `task game:mods`) and commit
   their records. Every error the check raises in the base game is classified.

## The suites that need game files

These run only on a machine with the game and the mod corpus, never in CI. Each writes a
record under `records/`, which is committed; CI checks the record.

| Variable | Meaning |
| --- | --- |
| `CK3_GAME_PATH` | The game's `game` folder |
| `CK3_CORPUS` | The pinned copy of the test mods ([records/corpus/README.md](records/corpus/README.md)) |
| `CK3_CORPUS_SLUGS` | Which mods to run, comma-separated; default all |

| Task | Reads | Record |
| --- | --- | --- |
| `task game:parse` | game | `records/game/parse.json` |
| `task game:check` | game | `records/game/check.json` |
| `task game:mods` | game, corpus | `records/game/mods.json` |
| `task game:bench` | game, corpus | `records/game/bench.json` |
| `task corpus:manifest` | corpus | `records/corpus/MANIFEST.tsv` (a deliberate refresh only) |
| `task baseline:prepare`, `task baseline:speed` | game, corpus, `LEGACY_BUILD` | `records/baseline-2.3.0/` |

A suite exits 0 when it passed, 1 when a pass condition failed (a corpus mod that is not the
pinned copy counts), and 2 on bad usage. A record made on another spec than the committed one
fails `task records:check`: changing the spec means re-running the suites.

Run one heavy job at a time: one install, one build, one suite, one benchmark. Never two
benchmarks at once.

## What may be committed, and what may not

The repository is public.

- **Never:** a person's name, a home folder, a host name, an e-mail address, a key or token,
  or any absolute path from the machine a suite ran on. Records and documents write
  `<game dir>`, `<corpus dir>` and `<legacy build>` instead; `task records:check` rejects a
  record that holds an absolute path. A machine is described only generically: operating
  system family, CPU architecture, logical CPU count, memory, Node version.
- **Never:** game files, mod files, or text copied from either beyond the messages a record
  needs. The corpus lives outside the repository; only its manifest is committed.
- **Never:** `node_modules/`, build output (`dist/`, anything built inside `legacy/`), test
  downloads (`.vscode-test/`), packaged extensions.
- **Yes:** sources, tests, fixtures, the spec package with its checksum and schema, records
  made by the tasks, and documents.

Commits stage explicit file lists, never `git add -A`.
