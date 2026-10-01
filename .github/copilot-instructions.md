# Copilot Workspace Instructions

Guidance for GitHub Copilot in this repository. It mirrors [CLAUDE.md](../CLAUDE.md); keep the
two in step. Per-topic standards are in [instructions/](instructions/README.md).

## Project

pychivalry 2.0.0: Crusader Kings III script tooling. An npm workspace with two packages:

- `packages/engine` (npm `pychivalry-engine`): the engine core. Dependency-free TypeScript that
  parses CK3 script, indexes a mod and reports the game's own diagnostics; has a CLI
  (`pychivalry-engine check <modDir>`).
- `vscode-extension` (`ck3-language-support`): the VS Code extension, a thin client plus a
  language server whose providers read the engine.

Node 22, npm 10, TypeScript 5, Apache-2.0. Target game version: CK3 1.20.0.2.

## The rule: CK3 vocabulary comes only from the spec package

Every trigger, effect, link, list, on_action, modifier, script directory, directory schema
field, error-message text and retired keyword comes from the spec package that
`packages/engine` bundles (`packages/engine/spec/ck3-spec-1.20.0.2.json.gz`, generated from
the game executable by pdx-parser-re). Do not add keyword lists, YAML vocabularies or
hard-coded name sets anywhere: query the `Spec` (`has`, `bucketsOf`, `doc`, `isIterator`,
`isModifier`, `directoryOf`, `schemaOf`, `message`, `retired`). Missing names are fixed in
pdx-parser-re and arrive with the next package.

- Do not edit `packages/engine/spec/` (vendored, checksum-verified) or
  `packages/engine/src/check/supplement.ts` (21 names and 11 templates the 1.20.0.2 package
  lacks; deleted when the fixed package is adopted; never add to it).
- `data/` holds only optional game **content** (traits, concepts, icons, animations, the mod
  registry in `data/mods/`) and `data/diagnostics.yaml` (the plug-in code catalogue).

**Bumping the spec package version:** regenerate it in pdx-parser-re
(`tools/python/build_spec_package.py`), copy `ck3-spec-<version>.json` (gzipped with
`gzip -9 -n`), its `.sha256` and `schema.json` into `packages/engine/spec/`, point
`packages/engine/spec.config.json` at them, then `task engine:test`, the vanilla acceptance
run (`node packages/engine/scripts/vanilla-acceptance.js "<game dir>"`),
`npm run docs:diagnostics` and `task ci`. Full procedure:
[Documentation/developer-guide/spec-package.md](../Documentation/developer-guide/spec-package.md).

## Architecture

**`packages/engine/src`**

| Module | Responsibility |
| --- | --- |
| `spec/` | Load and validate the spec package (`loadSpec`, `defaultSpec`, `Spec`, `withOverlay`, `validateSpecPackage`) |
| `syntax/` | Lexer, parser (`CK3Parser`, `CachingParser`), `IncrementalParser`, `@[ … ]` expressions; AST with 0-based positions; parse errors carry catalogue ids |
| `index/` | `Indexer` (symbols, events, references), `CallGraph`, `Workspace` (one spec + one index per mod root), `LocalizationIndex`, mod descriptor |
| `check/` | `registry.ts` (unknown keyword by name and context, iterators, modifiers, retired names), `schema.ts` (directory fields, required fields, content in the wrong directory), `scope.ts` (scope chains, saved scopes), `contexts.ts`/`context.ts` (trigger vs effect context), `structural.ts` (calibrated tables), `supplement.ts` (temporary) |
| `diagnostics.ts` | `diagnose(workspace, file, {text, uri, plugins})`: parse → registry → schema → scope → plug-ins |
| `messages.ts` | `PYCH-` package-local message ids (only where the catalogue has no text) |
| `cli.ts` | `pychivalry-engine check <modDir> [--spec <file>] [--json] [--vanilla <dir>]` |

**`vscode-extension/src`**

| Path | Responsibility |
| --- | --- |
| `extension.ts`, `client/` | Client wiring: server controller, commands, log channels, status bar, `logger.ts` |
| `server/server.ts` | Server wiring only: connection, documents, workspace, handlers delegate to providers |
| `server/engine-host.ts` | Loads the bundled spec package once and makes it the engine default |
| `server/lsp/` | 17 providers (completions, hover, navigation, symbols, semantic tokens, inlay hints, signature help, formatting, folding, rename, code actions, code lens, document links, document highlight, call hierarchy, selection range, diagnostics); each imports only `pychivalry-engine` and the LSP libraries |
| `server/plugins.ts` | The one registry of engine plug-ins (the surviving validators) and the localization validator |
| `server/ck3/validation/` | Plug-ins: scope-timing, style-checks, conventions, events, paradox-checks, variables, traits, scripted-blocks, script-values, iterators, switch |
| `server/ck3/localization/` | Localization text validator, concepts, icons |
| `server/data/` | Optional game data loader (`data/`), trait data, mod scanner (spec overlays) |
| `server/log/` | Game `error.log` watcher, analyzer, log diagnostics |
| `server/commands.ts` | `ck3.*` server commands |

Diagnostics codes: engine diagnostics use catalogue ids; plug-in codes are listed in
`data/diagnostics.yaml` (every code a plug-in emits must be there). The reference pages in
`Documentation/user-guide/diagnostics/` are generated: `npm run docs:diagnostics`.

## Build & test

Run `npm ci` once at the repository root (workspace install; the root `package-lock.json` is
the only lock file). Then use the Taskfile:

| Task | What it does |
| --- | --- |
| `task build` | Install if needed, build the engine, webpack the extension, compile the tests |
| `task engine:test` | Engine unit, golden, corpus and CLI tests |
| `task engine:check` | Engine lint (`--max-warnings=0`) and Prettier check |
| `task test:unit` | Extension unit tests (mocha, no VS Code) |
| `task test:integration` | Extension integration tests in a VS Code instance (`xvfb-run -a` on headless Linux; unset `ELECTRON_RUN_AS_NODE` and `VSCODE_*` when running inside VS Code) |
| `task lint` / `task format:check` | Extension ESLint (`--max-warnings=0`) / Prettier check |
| `task docs:diagnostics` / `task docs:diagnostics:check` | Regenerate / verify the diagnostics reference |
| `task ci` | Everything CI runs except the integration tests |
| `task package` | Build the VSIX (`npm run package` in `vscode-extension/`: production webpack bundle, then `vsce package`) |

Single extension test file: `task test:<name>` (e.g. `task test:hover`), or
`cd vscode-extension && npx mocha ./out/test/unit/<file>.test.js` after `npm run compile-tests`.
The CI workflow (`.github/workflows/ci.yml`) runs the same steps on Linux, Windows and macOS for
pushes to `main`, `develop` and `agents/**`.

## Rules (enforced by ESLint, Prettier and pre-commit)

The full list is in [CONTRIBUTING.md](../CONTRIBUTING.md#rules). The ones most often tripped:

- No `any` (use `unknown` and type guards), no `var`, `===` only, braces on every block.
- No `console.log` in production code: `server/utils/logger.ts` (server), `src/logger.ts` (client).
- No new runtime dependencies; the engine has none at all.
- Never `--no-verify`. The pre-commit hooks run the workspace's own Prettier and ESLint, so run
  `npm ci` first; `pre-commit run --files <paths>` checks staged files by hand.
- Files `kebab-case.ts`; Prettier: width 100, 4 spaces, single quotes, semicolons.

## Debugging the extension

Open the repository in VS Code and press **F5** (Extension Development Host). Test workspaces:
`example mod/` (the numbered good/bad corpus) and `test space/`.

## More

- [README.md](../README.md): what it is, install, CLI, trait data, the known gap
- [CONTRIBUTING.md](../CONTRIBUTING.md): workspace layout, workflow, rules
- [Documentation/developer-guide/architecture/](../Documentation/developer-guide/architecture/): architecture flow and validation pipeline
- [CLAUDE.md](../CLAUDE.md): the same guidance for Claude Code
