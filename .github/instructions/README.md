# GitHub Copilot Instructions

This directory contains instruction files that guide GitHub Copilot on how to work with this VS Code extension and LSP server codebase.

## Available Instructions

### [typescript.instructions.md](typescript.instructions.md)

TypeScript and VS Code extension development guidelines covering:

- Compiler configuration (strict mode, ES2020, CommonJS)
- Formatting (Prettier) and linting (ESLint) standards
- Naming conventions
- Type safety rules
- Error handling patterns
- Design patterns (functional composition, coordinator pattern)
- Forbidden practices

**Use when:** Creating or modifying TypeScript source files in `vscode-extension/src/`

### [ci-cd.instructions.md](ci-cd.instructions.md)

GitHub Actions CI pipeline conventions covering:

- CI workflow structure (`ci.yml`)
- Cross-platform test matrix (ubuntu, windows, macos)
- Workflow naming conventions
- Local equivalents via Taskfile

**Use when:** Creating or modifying CI/CD workflows in `.github/workflows/`

## How Copilot Uses These Instructions

GitHub Copilot automatically loads relevant instruction files based on what you're working on:

- Editing `.ts` files → Loads `typescript.instructions.md`
- Editing workflow `.yml` files → Loads `ci-cd.instructions.md`

You can also reference them explicitly:

```
Follow the standards in .github/instructions/typescript.instructions.md to implement...
```

## Related Documentation

- **Workspace instructions**: `.github/copilot-instructions.md` — project overview and architecture
- **Development guidelines**: `kanban-development-guideline.md` — full coding standards (source of truth)
- **Project documentation**: `Documentation/` — developer guides, user guides, CK3 reference

---

**Last Updated**: 2026-03-20
