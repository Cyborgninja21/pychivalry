# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`ck3-language-support` — a VS Code extension with an **embedded Language Server (LSP)** for Crusader Kings 3 modding scripts. TypeScript 5.x, Node 18+, Apache-2.0.

All extension code lives in `vscode-extension/`. Static YAML game data (effects, triggers, scopes, schemas, traits) lives in root-level `data/` and is copied into the bundle at build time by webpack's `copy-webpack-plugin`.

## Architecture

Two webpack entry points produce two separate bundles from one `tsconfig`:

- `src/extension.ts` → `dist/extension.js` — VS Code extension client
- `src/server/server.ts` → `dist/server-main.js` — Language Server (spawned as a child process by the client)

Server subsystems under `src/server/`:

| Directory | Responsibility |
|-----------|---------------|
| `core/` | Parser, incremental parser, parse cache, indexer, workspace management |
| `lsp/` | LSP feature providers (completions, hover, navigation, formatting, rename, inlay hints, code actions, code lens, folding, semantic tokens, selection range, call hierarchy, document highlight, document links, signature help) |
| `ck3/` | CK3 game logic: language keywords, validation engine (25+ validators under `ck3/validation/`), localization subsystem (`ck3/localization/`) |
| `schema/` | YAML schema loading, validation, schema-driven completions/hover/symbols |
| `data/` | Data loader, directory registry, mod scanner |
| `log/` | Game log watcher, analyzer, diagnostics |
| `utils/` | Shared utilities (fuzzy match, logger, URI handling) |

**Data flow:** files parsed by [core/parser.ts](vscode-extension/src/server/core/parser.ts) → indexed by [core/indexer.ts](vscode-extension/src/server/core/indexer.ts) → validated by [ck3/validation/diagnostics.ts](vscode-extension/src/server/ck3/validation/diagnostics.ts) (coordinator delegates to specialized validators) → surfaced through `lsp/` providers.

**Design:** functional composition over class inheritance; one module per LSP feature; YAML-driven game content; coordinator pattern in validation.

## Build & Test

Use the root-level `Taskfile.yml` (preferred) or npm scripts inside `vscode-extension/`. All npm commands must be run from `vscode-extension/` — there is no workspace-root `package.json`.

| Task | What it does |
|------|--------------|
| `task build` | Full build (install + webpack extension + tsc tests) |
| `task watch` | Webpack watch mode |
| `task test:unit` | Mocha unit tests only — fast, no VS Code instance |
| `task test:integration` | Launches VS Code via `@vscode/test-electron` |
| `task test` | Full suite (pretest + compile + lint + all tests) |
| `task lint` / `task format:check` | ESLint / Prettier check |
| `task ci` | Full CI pipeline |

**Running a single test file:** the Taskfile already exposes every unit test file as its own task (`task test:parser`, `task test:completions`, `task test:scopes`, etc.) and grouped domains (`task test:core`, `task test:lsp`, `task test:validation`, `task test:ck3`, `task test:log`). Each depends on `compile:tests` so you can run it directly after edits.

**Ad-hoc single test:** `cd vscode-extension && npx mocha ./out/test/unit/<file>.test.js --timeout 15000` (requires `npm run compile-tests` first).

Tests compile from `src/test/**/*.ts` into `out/test/` via `tsc -p .` — distinct from the webpack bundle that serves runtime code.

## Strict Rules (enforced by ESLint + pre-commit)

Authoritative guide: [kanban-development-guideline.md](kanban-development-guideline.md). Non-obvious or frequently-tripped rules:

- **No `any`** — use `unknown` + type guards. No `var`. No loose equality (`==`/`!=`).
- **No `console.log` in production code** — use the OutputChannel logger at [src/logger.ts](vscode-extension/src/logger.ts) (client) or [server/utils/logger.ts](vscode-extension/src/server/utils/logger.ts) (server).
- **No type assertions (`as`) without validation** — prefer type guards.
- **No new runtime dependencies** without explicit permission.
- **Never skip pre-commit hooks** (`--no-verify`) — 8 checks enforce formatting, linting, YAML/JSON validity, LF line endings, merge-marker detection, large-file limits.
- **Do not remove `TODO:`/`FIXME:` comments** — they track planned work.
- **File naming:** `kebab-case.ts`. **Identifiers:** `camelCase` / `PascalCase` / `SCREAMING_SNAKE_CASE` for constants.
- **Prettier:** print width 100, 4-space indent, single quotes, semicolons, ES5 trailing commas.

## Debugging the Extension

Press **F5** in VS Code from the `vscode-extension/` folder to launch the Extension Development Host. Test workspaces: `example mod/` and `test space/` at the repo root. The `.vscode/launch.json` provides grouped debug configs for each test domain.

## Where to Find More

- [README.md](README.md) — user-facing feature list, installation, trait-data setup
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow, branching strategy
- [Documentation/](Documentation/) — developer and user guides
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — mirrors much of this file's architecture section
