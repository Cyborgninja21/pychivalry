# Contributing to pychivalry

Thank you for your interest in contributing. This document covers the workspace layout, the
development workflow and the rules the code follows.

## Getting started

### Prerequisites

- Node.js 22 or newer and npm 10
- Git
- [Task](https://taskfile.dev/) (recommended; every command below also has an npm form)
- [pre-commit](https://pre-commit.com/) (recommended)

### Setting up

```bash
git clone https://github.com/YOUR_USERNAME/pychivalry.git
cd pychivalry
npm ci              # installs the whole npm workspace from the root package-lock.json
pre-commit install  # optional but recommended
task build          # engine, extension bundle, compiled tests
```

`./tools/setup-dev-env.sh` does the same checks and installs in one go.

The repository is an **npm workspace**: run `npm ci` (or `npm install`) at the root only. The
root `package-lock.json` is the only lock file; the engine package is linked into
`node_modules/pychivalry-engine`, which is how the extension and the tools import it.

### Pre-commit hooks

The hooks fix trailing whitespace and final newlines, validate YAML and JSON, reject merge
markers and files over 1 MB, normalize line endings to LF, and run Prettier and ESLint
(`--max-warnings=0`) on `vscode-extension/src` and `packages/engine/{src,test}`. Prettier and
ESLint run from the workspace's `node_modules`, so they are exactly the versions CI uses:
install the workspace before committing.

```bash
pre-commit run --files <paths>   # the staged files
pre-commit run --all-files       # everything (also rewrites whitespace in old documents)
```

### GitHub Copilot

[`.github/copilot-instructions.md`](.github/copilot-instructions.md) carries the same guidance
as [`CLAUDE.md`](CLAUDE.md). The prompts and agents that still match the code are under
`.github/prompts/` and `.github/agents/`; older ones are archived in
[`.github/archive/`](.github/archive/README.md).

## Workspace layout

```
pychivalry/
├── package.json, package-lock.json   npm workspace root (packages/*, vscode-extension)
├── Taskfile.yml                      task runner entry points
├── packages/engine/                  pychivalry-engine: the engine core (no runtime dependencies)
│   ├── spec/                         the vendored CK3 spec package (do not edit)
│   ├── spec.config.json              which spec package the build bundles
│   ├── src/spec/                     spec package loader and API
│   ├── src/syntax/                   lexer, parser, incremental parser, AST
│   ├── src/index/                    indexer, call graph, workspace, localization index
│   ├── src/check/                    registry, schema and scope checks
│   ├── src/diagnostics.ts            the pipeline (parse → registry → schema → scope → plug-ins)
│   ├── src/cli.ts                    pychivalry-engine check <modDir>
│   ├── scripts/                      spec copy step, vanilla acceptance run
│   └── test/                         unit, golden, corpus, CLI and acceptance tests
├── vscode-extension/                 the VS Code extension (ck3-language-support)
│   ├── src/extension.ts, src/client/ client: server controller, commands, output channels
│   ├── src/server/server.ts          server wiring
│   ├── src/server/lsp/               20 LSP providers (import only pychivalry-engine + LSP libraries)
│   ├── src/server/plugins.ts         the engine plug-ins (surviving validators), registered once
│   ├── src/server/ck3/validation/    the plug-ins
│   ├── src/server/ck3/localization/  localization text validator, concepts, icons
│   ├── src/server/data/              optional game data and the mod scanner
│   ├── src/server/log/               game log watcher and analyzer
│   ├── src/test/unit/                unit tests (mocha, no VS Code)
│   ├── src/test/suite/               integration tests (VS Code Extension Development Host)
│   └── syntaxes/, snippets/          TextMate grammars, snippets
├── data/                             optional game content (traits, concepts, icons, animations,
│                                     mods registry) and diagnostics.yaml (plug-in codes)
├── tools/                            trait/theme/background extractors, gen-diagnostics-docs.ts
├── example mod/                      numbered good_/bad_ corpus used by the tests
└── Documentation/                    user and developer guides (archive/ for history)
```

CK3 vocabulary (triggers, effects, scopes, modifiers, directories, error texts) comes **only**
from the spec package; see [the spec package](Documentation/developer-guide/spec-package.md)
for how a new game version is adopted.

## Development workflow

### Dev Mode: everything current while you edit

The extension bundles the **built** engine (`packages/engine/dist`), so an engine change
reaches the editor only after the engine is rebuilt and the bundle is rebuilt on top of it.
Dev Mode keeps both current:

| Terminal | VS Code | What runs |
| --- | --- | --- |
| `task dev` | task **Dev Mode** | one engine build, then in parallel: the engine in `tsc --watch` (after copying the spec package into `dist/data`) and the extension and server bundles in `webpack --watch`, which rebuild when the engine's `dist/` changes |
| `task dev:tests` | task **Dev Mode + Unit Tests** | the same plus the extension's unit tests: `tsc --watch` on the tests and `mocha --watch`, re-run when `out/` or the engine's `dist/` changes |
| | launch **🎯 Extension - Dev Mode** (F5) | starts **Dev Mode**, waits until both bundles report a finished build, then opens the Extension Development Host on `example mod/` |

The VS Code tasks have problem matchers: TypeScript errors of the engine, of the bundles
(ts-loader's `[tsl] ERROR in …`) and failing unit tests (at the failing line of the
`.test.ts` file) appear in the Problems view, and the background tasks report "ready" when
the build has finished, which is what the launch configuration waits for. After a rebuild,
reload the Extension Development Host (**Developer: Reload Window**, `Ctrl+R` in that window)
to load the new bundle. `task watch` (bundle only) and `task engine:watch` (engine only) run
one side alone.

Issue #36 was written for the Python language server that 2.0.0 removed: its "Python LSP
server in watch/debug mode" is now the TypeScript server, which webpack bundles in the same
watch as the client (`dist/server-main.js`), and its engine in `tsc --watch`; debugging the
server is in [debugging.md](Documentation/developer-guide/debugging.md).

### Making changes

1. Branch: `git checkout -b feature/your-feature-name`.
2. Change the code. Engine changes go in `packages/engine` with tests in
   `packages/engine/test`; editor features in `vscode-extension/src/server/lsp`; a new
   validation rule the spec package cannot express becomes a plug-in registered in
   `vscode-extension/src/server/plugins.ts`, and its codes go into `data/diagnostics.yaml`.
3. Check:

```bash
task ci                  # build, lint, format checks, engine tests, diagnostics-docs check, unit tests
task test:integration    # VS Code integration tests (xvfb-run -a on headless Linux)
task docs:diagnostics    # after changing diagnostics: regenerate the reference pages
```

npm equivalents: `npm run build`, `npm test` and `npm run lint` at the root;
`npm run test:unit`, `npm run lint`, `npm run format-check` in `vscode-extension/`;
`npm test`, `npm run lint`, `npm run format:check` in `packages/engine/`.

4. Commit with a descriptive message (conventional commits: `feat:`, `fix:`, `refactor:`,
   `docs:`, `test:`, `chore:`); the hooks run on commit.

### Code style

- Strict TypeScript, no `any` (see Rules below)
- Prettier: print width 100, 4-space indent, single quotes, semicolons
- ESLint `@typescript-eslint/recommended` with the repository's rules
- Files `kebab-case.ts`; variables and functions `camelCase`; types `PascalCase`; constants
  `UPPER_SNAKE_CASE`

### Testing

- Engine: `packages/engine/test/{unit,golden,corpus,cli}`; golden tests assert the game's exact
  messages, corpus tests the expectations in `test/fixtures/corpus-expectations.json`.
- Extension unit tests: `vscode-extension/src/test/unit/` (the example-mod test runs the engine
  plus plug-ins over the corpus copy in `src/test/fixtures/mock-ck3-mod/`).
- Extension integration tests: `vscode-extension/src/test/suite/`.
- Write tests for new features and keep all suites green.

### Documentation

- Update `README.md` for user-visible changes and `CHANGELOG.md` (Keep a Changelog format).
- The diagnostics reference (`Documentation/user-guide/diagnostics/`) is generated; edit
  `data/diagnostics.yaml` or the engine, not the pages.

## Rules

These are the still-true rules of the former `kanban-development-guideline.md` (archived under
`Documentation/archive/`); ESLint and the pre-commit hooks enforce most of them.

- **Strict TypeScript.** `strict: true`; never `any` (use `unknown` with type guards), never `var`.
  Prefer type guards over unchecked `as` casts.
- **Strict equality and braces.** `===`/`!==` only (`eqeqeq`); braces on every `if`/`else`/`for`/`while`
  (`curly`).
- **Throw `Error` objects**, never literals (`no-throw-literal`). Prefer async/await over callbacks.
- **No `console.log` in production code.** The server logs through `server/utils/logger.ts`, the
  client through `src/logger.ts` (VS Code output channels).
- **Naming.** Files `kebab-case.ts`; variables and functions `camelCase`; types, interfaces and
  classes `PascalCase`; constants `UPPER_SNAKE_CASE`.
- **Formatting.** Prettier: print width 100, 4-space indent, single quotes, semicolons, trailing commas
  `es5`, arrow parens always.
- **No new runtime dependencies** without the maintainer's agreement; the engine package
  (`packages/engine`) has none at all.
- **Never skip the pre-commit hooks** (`--no-verify`).
- **Documentation lives under `Documentation/`.** Exceptions: a `README.md` per package or data folder
  and the standard root files (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CLAUDE.md`).
- **Error handling.** Wrap async work in try/catch; show user-facing failures with
  `vscode.window.showErrorMessage` and log the detail to the output channel; handle a lost LSP
  connection without crashing the client.

## Pull request process

1. All tests pass and the code is formatted (`task ci`).
2. Documentation and `CHANGELOG.md` are updated.
3. Push your branch and open a pull request describing the change.
4. Address review feedback.

### Checklist

- [ ] `task ci` passes (and `task test:integration` for client or server wiring changes)
- [ ] Pre-commit hooks pass
- [ ] New diagnostics codes are in `data/diagnostics.yaml` and the reference is regenerated
- [ ] Documentation and `CHANGELOG.md` are updated
- [ ] Commit messages are clear

## Where to help

Open issues labelled [`post-2.0`](https://github.com/Cyborgninja21/pychivalry/issues?q=is%3Aopen+label%3Apost-2.0)
are the features and checks kept after the 2.0.0 triage
([triage record](Documentation/developer-guide/issue-triage-2.0.0.md)). Missing CK3 names belong
in pdx-parser-re's spec package, not in this repository.

## Bug reports

Please include the Node.js, VS Code and extension versions, the operating system, steps to
reproduce, expected and actual behaviour, and the error messages or logs (from
"CK3: Show Output Channel").

## Feature requests

Describe the feature, the use case, examples, and any CK3 documentation that applies.

## Code of conduct

Be respectful and constructive, welcome newcomers, and focus on what is best for the project.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
