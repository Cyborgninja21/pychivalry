# pychivalry

pychivalry tells a Crusader Kings 3 modder, and any AI agent working on a mod, what the game
itself would say about their script, and helps them write script the game accepts. It is a
VS Code extension with a language server, a command-line checker and an agent server (MCP),
all built on one core that takes its CK3 vocabulary only from a spec package derived from the
game.

## State of the rebuild

pychivalry is being rebuilt from the ground up in TypeScript. **1.0.0 is not released.** The
first preview, **0.1.0**, is published as a
[GitHub pre-release](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0) (build
step 7, 2026-11-23): an extension installed from its `.vsix` file, with the checks and lookups
built so far, the editor features (diagnostics, hover, completion, go to definition, find
references, the outline), the agent server for VS Code's AI and Claude Code, and the command
line in VS Code's terminal ([installing it](docs/guide/install.md)). Since then, on `main`,
the language server, the agent servers and the command line share one copy of the game's
index in memory ([how](docs/shared-index.md)), and build step 8 is built: the formatter, by
the formatting rules the owner decided ([docs/formatting.md](docs/formatting.md)), on every
surface, the `style/` findings, fixes carried by findings and quick fixes, and the presentation
data. The second preview, **0.2.0**, is published as a
[GitHub pre-release](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.2.0) (build step
8, 2026-11-23). Build step 9 is built: the skills that tell your AI how to explain an error,
fix one and write new content ([skills/](skills/README.md)), which VS Code's own AI gets from the
extension and Claude Code from "Set up for Claude Code". The scored authoring test's release run,
every content request 10 times, met every target on 2026-11-26
([tools/scored-run/README.md](tools/scored-run/README.md#the-third-previews-release-run-decision-132)),
its judge not yet calibrated against grading by hand. The third preview, **0.3.0**, with the
skills, is published as a
[GitHub pre-release](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.3.0) (build step
9, 2026-11-26), before the hand calibration of the judge and the hand checklist on VS Code's own
AI, which are still to be done.

- What is being built, and why: [docs/MVP.md](docs/MVP.md).
- How, step by step, and how far it has got: [docs/PLAN.md](docs/PLAN.md) (the Progress table).
- Build step 1, the repository skeleton, is complete: the workspace, `task ci`, public CI on
  Linux and Windows, the spec package for game 1.21.0.3 and its check, the record format, the
  pinned test mods, the 2.3.0 speed and result baselines, and the documents every later step
  fills. The parser (step 2), the workspace index (step 3), the checks and lookup (step 4), the
  command line (step 5), the agent server (step 6) and the language server and extension (step
  7) are built, and so are the formatter and fixes of step 8 and its preview, and step 9's skills
  and its preview.
- Every document, and which step writes it: [docs/README.md](docs/README.md). The sources
  pychivalry draws on: [docs/references/](docs/references/README.md). What the tests run on:
  [docs/test-data.md](docs/test-data.md). The user guide so far:
  [docs/guide/](docs/guide/README.md).
- Release 2.3.0, the last version of the old code, lives unchanged in [legacy/](legacy/) and
  still builds from inside that folder. It is the behaviour to match and a source of test data;
  no code is copied from it. It is published as the `ck3-language-support` extension; the
  rebuild ships as a new extension, `pychivalry`, previews from 0.1.0, then 1.0.0.

## Building

Needs Node 22 (22.13 or later) and [Task](https://taskfile.dev/).

```bash
task ci        # install, build, lint, format check, tests, spec and record checks
task --list    # every task
```

`task ci` needs no display, no game files, no model and no key. The suites that read the game
and the test mods run locally; see [AGENTS.md](AGENTS.md).

## Layout

```text
packages/core     parse, index, check, lookup, format, fix data; no dependencies
packages/cli      command line
packages/mcp      agent server
packages/lsp      language server
packages/vscode   the extension
tools/            the scripts behind the local tasks
spec/             the committed spec package, its companions, checksums and schema
records/          committed results of the suites that need game files
fixtures/         hand-written test mods, game stubs and the planted-defect mod
skills/           the skills an AI loads: explain an error, fix an error, write new content
docs/             MVP and plan, decision log, references, test data, user guide, wiki source
legacy/           release 2.3.0, unchanged
```

## Contributing

How to report a problem or propose a change: [CONTRIBUTING.md](CONTRIBUTING.md). Rules for
working on the code: [AGENTS.md](AGENTS.md). Reporting a vulnerability:
[SECURITY.md](SECURITY.md).

## Licence

Apache-2.0; see [LICENSE](LICENSE).
