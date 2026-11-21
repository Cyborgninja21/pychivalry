```instructions
# TypeScript Instructions — ck3-language-support

Project-specific TypeScript and VS Code extension conventions. These override generic TypeScript knowledge when they conflict.

---

## Compiler Configuration

- **Strict mode:** `strict: true` — no implicit `any`, strict null checks, strict property initialization
- **Target:** ES2020
- **Module:** CommonJS
- **Source maps:** enabled
- **Root directory:** `src/`
- **Test output:** `out/` (tsc), **Extension output:** `dist/` (webpack)

---

## Formatting (Prettier)

Configuration in `vscode-extension/.prettierrc`:

| Setting | Value |
|---------|-------|
| Print width | 100 |
| Tab width | 4 (spaces, not tabs) |
| Semicolons | required |
| Quotes | single |
| Trailing commas | `es5` |
| Bracket spacing | yes |
| Arrow parens | always |

Run: `task format` to auto-fix, `task format:check` to verify.

---

## Linting (ESLint)

Configuration in `vscode-extension/.eslintrc.json`. Extends `eslint:recommended` + `plugin:@typescript-eslint/recommended`.

Key enforced rules:

| Rule | Setting | Effect |
|------|---------|--------|
| `@typescript-eslint/naming-convention` | warn | Enforces naming patterns |
| `@typescript-eslint/semi` | warn | Semicolons required |
| `curly` | warn | Braces required on all control flow |
| `eqeqeq` | warn | Strict equality only (`===`, `!==`) |
| `no-throw-literal` | warn | Must throw `Error` objects |

Run: `task lint` to check.

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Variables, functions | camelCase | `parseDocument`, `tokenCount` |
| Interfaces, types, classes | PascalCase | `DocumentSymbol`, `ValidationResult` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_HINTS_PER_LINE`, `DEFAULT_LOG_LEVEL` |
| File names | kebab-case.ts | `context-engine.ts`, `call-hierarchy.ts` |

---

## Type Safety

- **Never use `any`.** Use `unknown` with type guards or proper interface types.
- **Never use `var`.** Use `const` (preferred) or `let`.
- **Use optional chaining** (`?.`) and **nullish coalescing** (`??`).
- **Prefer type guards over `as` casts.** Type assertions without validation are forbidden.
- **Use proper interfaces** for all data structures passed between modules.

---

## Error Handling

- **Async operations:** Always wrap in try-catch.
- **User-facing errors:** Surface via `vscode.window.showErrorMessage`.
- **Internal logging:** Use the OutputChannel-based logger (`server/utils/logger.ts` for server, `src/logger.ts` for client). Never use `console.log` in production code.
- **LSP connection errors:** Handle gracefully — the extension must not crash on server disconnection.

---

## Design Patterns

- **Functional composition** over class inheritance.
- **Single-responsibility modules** — one LSP feature per file in `lsp/`.
- **Coordinator pattern** for validation — `ck3/validation/diagnostics.ts` delegates to specialized validators.
- **YAML-driven data definitions** — game content (effects, triggers, scopes, schemas) defined in `data/` YAML files.

---

## Forbidden Practices

- No `any` type
- No `var` keyword
- No loose equality (`==`, `!=`)
- No missing curly braces on `if`/`else`/`for`/`while`
- No throw literals (`throw "string"`)
- No `console.log` in production code
- No callback patterns when async/await works
- No type assertions (`as`) without validation
- No new dependencies without explicit permission
- No skipping pre-commit hooks (`--no-verify`)
- Do not remove `TODO:` or `FIXME:` comments
```
