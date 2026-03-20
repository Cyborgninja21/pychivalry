# CI/CD Instructions — ck3-language-support

Conventions and standards for GitHub Actions workflows in this repository.

---

## Active Workflows

| Workflow | File | Triggers | Purpose |
|----------|------|----------|---------|
| CI | `.github/workflows/ci.yml` | Push/PR to `main`, `develop` | Lint, format check, compile, test across OS matrix |

---

## CI Pipeline

The `ci.yml` workflow runs the full quality gate on every push and pull request:

**Matrix:** ubuntu-latest, windows-latest, macos-latest

**Node.js:** 18

**Steps (in order):**

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (node 18)
3. `npm ci` (clean install)
4. `npm run lint` (ESLint)
5. `npm run format-check` (Prettier)
6. `npm run compile` (webpack build)
7. `npm run compile-tests` (tsc test compilation)
8. `npm test` (full test suite — `xvfb-run` on Linux for headless display)

**Permissions:** `contents: read` (minimal).

**Working directory:** All steps run from `vscode-extension/`.

---

## Workflow Conventions

### File Naming

Workflow files use kebab-case: `ci.yml`, `pr-validation.yml`, `generate-diagrams.yml`.

### Job and Step Names

- Job IDs: kebab-case (`syntax-validation`, `extension`)
- Job display names: descriptive title case (`VS Code Extension Tests`)
- Step names: start with a verb, describe the action (`Lint extension`, `Compile tests`)

### Best Practices

- **Pin action versions** to major tags (`@v4`, `@v5`)
- **Set timeouts** on jobs to prevent hung builds
- **Use minimal permissions** — `contents: read` unless writes are needed
- **Use `fail-fast: false`** in matrix strategies so all platforms report results
- **Platform-specific steps:** Use `if: runner.os == 'Linux'` guards (e.g., `xvfb-run` wrapper)

---

## Local Equivalents

The CI pipeline maps directly to Taskfile commands:

| CI Step | Local command |
|---------|-------------|
| `npm run lint` | `task lint` |
| `npm run format-check` | `task format:check` |
| `npm run compile` | `task compile` |
| `npm run compile-tests` | `task compile:tests` |
| `npm test` | `task test` |
| Full pipeline | `task ci` |

Run `task ci` locally before pushing to catch failures early.

---

**Last Updated**: 2026-03-20
