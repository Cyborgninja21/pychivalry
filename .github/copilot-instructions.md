# Copilot Workspace Instructions

This is the **ck3-language-support** repository — a VS Code extension with an embedded Language Server (LSP) for Crusader Kings 3 modding scripts. TypeScript 5.x, Apache-2.0 license.

## Architecture

Two webpack entry points produce separate bundles:

- `src/extension.ts` → `dist/extension.js` (VS Code extension client)
- `src/server/server.ts` → `dist/server-main.js` (Language Server)

Server subsystems under `src/server/`:

| Directory | Responsibility |
|-----------|---------------|
| `core/` | Parser, incremental parser, indexer, workspace management |
| `lsp/` | LSP feature providers (completions, hover, navigation, formatting, rename, inlay hints, code actions, code lens, folding, semantic tokens, etc.) |
| `ck3/` | CK3 game logic, validation engine (25+ validators), localization subsystem |
| `schema/` | YAML schema loading, validation, schema-driven completions/hover |
| `data/` | Data loader, directory registry, mod scanner |
| `log/` | Game log watcher, analyzer, diagnostics |
| `utils/` | Shared utilities (fuzzy match, logger, URI handling) |

Data flow: files parsed by `core/parser.ts` → indexed by `core/indexer.ts` → validated by `ck3/validation/diagnostics.ts` (coordinator) → results surfaced through `lsp/` providers.

## Repository Structure

```
vscode-extension/    All extension source, tests, build config, assets
  src/               TypeScript source (client + embedded LSP server)
  dist/              Webpack output (gitignored)
  out/               Compiled tests (gitignored)
data/                Static YAML data files (effects, triggers, scopes, schemas)
example mod/         Example CK3 mod workspace for manual testing
Documentation/       All project documentation
tools/               Development and setup scripts
.github/             CI workflows, Copilot instructions, prompt templates, agents
```

## Core Principles

- **Strict TypeScript.** `strict: true` in `tsconfig.json`. Never use `any` — use `unknown` with type guards.
- **Functional composition over inheritance.** Single-responsibility modules per LSP feature.
- **YAML-driven data.** Game content (effects, triggers, scopes, schemas) defined in `data/` YAML files, copied into the bundle at build time.
- **Pre-commit hooks enforced.** 8 automated checks run on every commit — never skip with `--no-verify`.
- **No new dependencies** without explicit permission.

## Build & Test Quick Reference

All commands available via Taskfile (from workspace root) or npm (from `vscode-extension/`):

| Task | npm equivalent | Description |
|------|---------------|-------------|
| `task build` | `npm ci && npm run compile && npm run compile-tests` | Full build |
| `task test:unit` | `npm run test:unit` | Unit tests only (fast, no VS Code) |
| `task test` | `npm test` | Full test suite |
| `task lint` | `npm run lint` | ESLint |
| `task format:check` | `npm run format-check` | Prettier check |
| `task ci` | — | Full CI pipeline (build + lint + format + unit tests) |

## Language and Tool Standards

Detailed per-topic standards live in `.github/instructions/`:

| Topic | Instruction file |
|-------|-----------------|
| TypeScript / VS Code extension | [typescript.instructions.md](instructions/typescript.instructions.md) |
| GitHub Actions CI | [ci-cd.instructions.md](instructions/ci-cd.instructions.md) |

## Forbidden Practices

- No `any` type — use `unknown` with type guards
- No `var` — use `const` (preferred) or `let`
- No loose equality — use `===` and `!==` only
- No missing curly braces on `if`/`else`/`for`/`while`
- No throw literals — always `throw new Error(...)`
- No `console.log` in production code — use the OutputChannel logger
- No type assertions (`as`) without validation — prefer type guards
- No callback patterns when async/await works
- Do not remove `TODO:` or `FIXME:` comments
- Do not skip pre-commit hooks (`--no-verify`)
- Do not introduce new dependencies without permission
