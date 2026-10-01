# AI Development Guidelines

## 1. Project Overview

- **Name:** `ck3-language-support` (Crusader Kings 3 Language Support)
- **Type:** VS Code Extension with embedded Language Server (LSP)
- **Version:** 1.1.0
- **License:** Apache-2.0
- **Core Stack:** TypeScript 5.x, VS Code API ^1.75.0, vscode-languageserver ^9.0.1, webpack ^5.88.0
- **Primary Goal:** Provide full language support (diagnostics, completions, hover, navigation, formatting, and more) for Crusader Kings 3 modding scripts within VS Code
- **Repository Structure:**
  - `vscode-extension/` — All extension source code, tests, build configuration, and assets
  - `vscode-extension/src/` — TypeScript source (client extension + embedded LSP server)
  - `data/` — Static YAML data files (effects, triggers, scopes, traits, schemas) copied into the bundle at build time
  - `example mod/` / `test space/` — Example CK3 mod workspaces for manual testing
  - `Documentation/` — All project documentation (developer guides, user guides, CK3 reference)
  - `tools/` — Development and setup scripts
  - `.github/` — CI workflows, Copilot instructions, prompt templates, agent definitions

## 2. Architectural Patterns

- **Client–Server Architecture:** Two webpack entry points produce separate bundles:
  - `src/extension.ts` → `dist/extension.js` (VS Code extension client)
  - `src/server/server.ts` → `dist/server-main.js` (Language Server Protocol server)
- **Server Subsystems:**
  - `server/core/` — Parser, incremental parser, indexer, workspace management
  - `server/lsp/` — LSP feature providers (completions, hover, navigation, symbols, formatting, rename, inlay hints, code actions, code lens, folding, semantic tokens, selection range, call hierarchy, document highlight, document links, signature help)
  - `server/ck3/` — CK3 game logic: language keywords, validation engine (`ck3/validation/` with 25+ validators), localization subsystem (`ck3/localization/`)
  - `server/schema/` — YAML schema loading, validation, schema-driven completions/hover/symbols
  - `server/data/` — Data loader, directory registry, mod scanner
  - `server/log/` — Game log watcher, analyzer, diagnostics
  - `server/utils/` — Shared utilities (fuzzy match, logger, URI handling)
- **Data Flow:** Files are parsed by `core/parser.ts` → indexed by `core/indexer.ts` → validated by `ck3/validation/diagnostics.ts` (coordinator) → results surfaced through `lsp/` providers
- **Design Patterns:**
  - Functional composition over class inheritance
  - Single-responsibility modules per LSP feature
  - YAML-driven data definitions for game content (effects, triggers, scopes, schemas)
  - Coordinator pattern for validation (diagnostics coordinator delegates to specialized validators)

## 3. Coding Standards (Strict)

### TypeScript

- **Strict Mode:** `strict: true` in `tsconfig.json` — no implicit `any`, strict null checks, strict property initialization
- **Target:** ES2020, CommonJS module format
- **Formatting (Prettier):**
  - Print width: 100
  - Tab width: 4 (spaces, not tabs)
  - Semicolons: required
  - Single quotes: yes
  - Trailing commas: `es5`
  - Bracket spacing: yes
  - Arrow parens: always
- **Linting (ESLint):**
  - Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`
  - `@typescript-eslint/naming-convention`: warn
  - `curly`: warn (always use braces)
  - `eqeqeq`: warn (strict equality only)
  - `no-throw-literal`: warn (throw Error objects, not strings)
  - `semi`: enforced via `@typescript-eslint/semi`
- **Naming Conventions:**
  - Variables/Functions: `camelCase`
  - Interfaces/Types/Classes: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - File names: `kebab-case.ts` (e.g., `context-engine.ts`, `call-hierarchy.ts`)
- **Error Handling:**
  - Use try-catch for all async operations
  - Show user-facing errors via `vscode.window.showErrorMessage`
  - Log detailed errors to OutputChannel for debugging
  - Handle LSP connection errors gracefully
- **Type Safety:**
  - Never use `any` — use `unknown` with type guards instead
  - Use `const` and `let` — never `var`
  - Use optional chaining (`?.`) and nullish coalescing (`??`)
  - Use proper interfaces and type guards for narrowing

## 4. Preferred Libraries & Tools

### Runtime Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `vscode-languageserver` | ^9.0.1 | LSP server framework |
| `vscode-languageserver-textdocument` | ^1.0.12 | Text document model |
| `vscode-languageclient` | ^9.0.0 | LSP client for VS Code |
| `js-yaml` | ^4.1.1 | YAML parsing for data files and schemas |
| `fast-glob` | ^3.3.3 | File pattern matching for workspace scanning |

### Dev Dependencies

| Tool | Version | Purpose |
|------|---------|---------|
| `typescript` | ^5.0.0 | TypeScript compiler |
| `webpack` | ^5.88.0 | Module bundler (two entry points) |
| `webpack-cli` | ^5.1.0 | Webpack CLI |
| `ts-loader` | ^9.4.0 | TypeScript loader for webpack |
| `copy-webpack-plugin` | ^13.0.1 | Copies `data/` into dist at build time |
| `eslint` | ^8.0.0 | Linting |
| `@typescript-eslint/eslint-plugin` | ^6.0.0 | TypeScript-specific ESLint rules |
| `@typescript-eslint/parser` | ^6.0.0 | TypeScript ESLint parser |
| `prettier` | ^3.0.0 | Code formatting |
| `mocha` | ^10.0.0 | Test framework |
| `@vscode/test-electron` | ^2.3.0 | VS Code integration test runner |
| `glob` | ^10.0.0 | File globbing for test discovery |

### Task Runner

- **Taskfile** (`Taskfile.yml`) wraps npm scripts for convenience (e.g., `task build`, `task test:unit`, `task lint`)
- **Pre-commit** (`.pre-commit-config.yaml`) enforces formatting and linting on every commit

## 5. Development Workflow

### Setup

```bash
# Quick setup (automated)
./tools/setup-dev-env.sh

# Manual setup
cd vscode-extension && npm install
pre-commit install   # from workspace root
```

### Branching Strategy

- `main` — stable release branch
- `develop` — integration branch (CI triggers on push/PR)
- Feature branches: `feature/your-feature-name`

### Development Loop

1. **Analyze:** Read existing source files and understand imports/dependencies before making changes
2. **Plan:** For changes to files >300 lines or multi-file edits, create a detailed edit plan before writing code
3. **Implement:** Make changes incrementally; one conceptual change at a time
4. **Verify:**
   - Run `task lint` (or `npm run lint` from `vscode-extension/`)
   - Run `task format:check` (or `npm run format-check`)
   - Run `task test:unit` for fast feedback
   - Run `task test` for the full suite (compiles + lints + tests)
5. **Commit:** Use conventional commit format (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`)

### Pre-commit Hooks

Automatically enforced on every commit:
- Trailing whitespace removal
- End-of-file newline fix
- YAML/JSON validation
- Large file check (max 1000 KB)
- Merge conflict markers check
- Line endings normalized to LF
- Prettier formatting (TypeScript files in `vscode-extension/src/`)
- ESLint linting with `--max-warnings=0` (TypeScript files in `vscode-extension/src/`)

### CI Pipeline (GitHub Actions)

- **Trigger:** Push/PR to `main` or `develop`
- **Matrix:** ubuntu-latest, windows-latest, macos-latest
- **Node.js:** 18
- **Steps:** `npm ci` → `npm run lint` → `npm run format-check` → `npm run compile` → `npm run compile-tests` → `npm test`
- Linux tests run under `xvfb-run` for headless display

## 6. Build & Test Commands

### Via Taskfile (from workspace root)

| Command | Description |
|---------|-------------|
| `task install` | Install extension dependencies |
| `task compile` | Compile extension with webpack |
| `task compile:tests` | Compile test files with tsc |
| `task build` | Full build (install + compile extension + compile tests) |
| `task watch` | Watch mode for extension rebuild |
| `task test` | Run all tests (pretest + full test suite) |
| `task test:unit` | Run unit tests only (fast, no VS Code instance) |
| `task test:integration` | Run integration tests (launches VS Code) |
| `task test:quick` | Run tests without linting |
| `task lint` | Lint TypeScript source files |
| `task format` | Format source files with Prettier |
| `task format:check` | Check formatting without modifying files |
| `task check` | Lint + format check (CI-friendly) |
| `task ci` | Full CI pipeline (build + lint + format check + unit tests) |
| `task precommit` | Pre-commit checks (lint + format check + unit tests) |

### Via npm (from `vscode-extension/`)

| Command | Description |
|---------|-------------|
| `npm run compile` | Webpack build |
| `npm run watch` | Webpack watch mode |
| `npm run package` | Production build with source maps |
| `npm run compile-tests` | Compile tests with tsc |
| `npm test` | Full test run (pretest + tests) |
| `npm run test:unit` | Unit tests only (Mocha) |
| `npm run test:integration` | Integration tests (VS Code instance) |
| `npm run test:quick` | Compile + test (skip lint) |
| `npm run lint` | ESLint on `src/` |
| `npm run format` | Prettier write |
| `npm run format-check` | Prettier check |

## 7. Forbidden Practices

- **No `any` type.** Use `unknown` with type guards or proper interface types.
- **No `var` keyword.** Use `const` (preferred) or `let`.
- **No loose equality.** Use `===` and `!==` only (`eqeqeq` rule enforced).
- **No missing curly braces.** All `if`/`else`/`for`/`while` blocks must use braces (`curly` rule enforced).
- **No throw literals.** Always `throw new Error(...)`, not `throw "string"`.
- **No callback-based patterns** when promises/async-await can be used.
- **No type assertions without validation.** Prefer type guards over `as` casts.
- **No `console.log` in production code.** Use the OutputChannel-based logger (`server/utils/logger.ts` or `src/logger.ts`).
- **No time estimates.** Never estimate or predict how long work will take.
- **No simultaneous multi-file edits.** Work on one file at a time to prevent corruption in AI-assisted editing.
- **No documentation files outside `Documentation/`.** Exception: `README.md` per folder and standard root files (`CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`).
- **Do not remove `TODO:` or `FIXME:` comments.** These track planned work.
- **Do not introduce new dependencies without explicit permission.**
- **Do not skip pre-commit hooks** (`--no-verify`) unless there is a justified, temporary reason.
- **No new markdown files in `pychivalry/`, `tests/`, or `vscode-extension/`** (except folder-specific README.md for data directories).
- **Validate file paths** to prevent directory traversal; sanitize all user inputs.
