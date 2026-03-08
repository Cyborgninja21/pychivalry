# Contributing to pychivalry

Thank you for your interest in contributing to pychivalry! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm
- Git

### Setting Up Development Environment

**Quick Setup (Recommended):**

Run the automated setup script to install all dependencies and configure pre-commit hooks:
```bash
./tools/setup-dev-env.sh
```

**Manual Setup:**

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/pychivalry.git
cd pychivalry
```

2. Install extension dependencies:
```bash
cd vscode-extension
npm install
```

3. Install pre-commit hooks (recommended):
```bash
pre-commit install
```

This will automatically run code formatters and linters before each commit, ensuring code quality and consistency.

### Pre-commit Hooks

The project uses pre-commit hooks to automatically check and format code before commits. These hooks:

- Fix trailing whitespace and ensure end-of-file newlines
- Validate YAML and JSON files
- Check for merge conflict markers
- Normalize line endings to LF
- Format TypeScript files with Prettier
- Lint TypeScript files with ESLint (`--max-warnings=0`)

**Manual execution:**
```bash
# Run on all files
pre-commit run --all-files

# Run on staged files only
pre-commit run
```

### GitHub Copilot Support

This project is configured for GitHub Copilot to provide AI-assisted development:

**Configuration files:**
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — Main instructions, coding standards, and guidelines
- [`.github/prompts/`](.github/prompts/) — Custom prompts for documentation, architecture, and common tasks
- [`.github/skills/`](.github/skills/) — Specialized skills like GitHub Actions debugging

**Using Copilot with this project:**
- Copilot automatically reads the instructions when assisting with code
- Use `@workspace` in Copilot Chat to ask project-specific questions
- Reference prompt files for specialized tasks (e.g., `@workspace /prompts/documentation_standard.md`)
- Follow the established patterns for consistency

See [`.github/README.md`](.github/README.md) for complete documentation on the Copilot setup.

## Development Workflow

### Making Changes

1. Create a new branch for your feature or bugfix:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes to the codebase

3. The pre-commit hooks will automatically run when you commit. If you want to run them manually:
```bash
# Format and lint all code
pre-commit run --all-files

# Or run individual tools
cd vscode-extension
npm run format
npm run lint
```

4. Run tests:
```bash
# Unit tests (fast, no VS Code instance)
cd vscode-extension
npm run test:unit

# Full test suite (compiles + lints + tests)
npm test
```

Or from the workspace root using the Taskfile:
```bash
task test:unit
task test
```

5. Commit your changes with a descriptive message:
```bash
git commit -m "feat: description of your change"
```
The pre-commit hooks will run automatically and fix most formatting issues.

### Code Style

- Follow the project TypeScript coding standards (strict mode, no `any`)
- Use Prettier for code formatting (print width 100, 4-space indent, single quotes, semicolons)
- Use ESLint for linting (`@typescript-eslint/recommended` rules)
- File names: `kebab-case.ts`
- Variables/functions: `camelCase`, types/interfaces: `PascalCase`, constants: `SCREAMING_SNAKE_CASE`

### Testing

- Write tests for all new features
- Ensure all existing tests pass
- Unit tests go in `vscode-extension/src/test/unit/`
- Integration tests go in `vscode-extension/src/test/suite/`

### Documentation

- Update README.md if you add new features
- Update CHANGELOG.md following Keep a Changelog format
- Add docstrings to new functions and classes
- Update examples if needed

## Pull Request Process

1. Ensure all tests pass and code is properly formatted
2. Update documentation as needed
3. Update CHANGELOG.md with your changes
4. Push your branch to your fork
5. Create a Pull Request with a clear description of your changes
6. Wait for review and address any feedback

### Pull Request Checklist

- [ ] Tests pass (`npm test` or `task test`)
- [ ] Pre-commit hooks pass (`pre-commit run --all-files`)
- [ ] Code is formatted with Prettier (automatic with pre-commit)
- [ ] No linting errors (automatic with pre-commit)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Commit messages are clear and descriptive (conventional commits: `feat:`, `fix:`, `refactor:`, etc.)

## Project Structure

```
pychivalry/
├── vscode-extension/        # VS Code extension + embedded LSP server
│   ├── src/
│   │   ├── extension.ts     # Extension client entry point
│   │   ├── server-main.ts   # Language server entry point
│   │   ├── server/
│   │   │   ├── core/        # Parser, indexer, workspace management
│   │   │   ├── lsp/         # LSP feature providers (completions, hover, etc.)
│   │   │   ├── ck3/         # CK3 game logic and validation
│   │   │   ├── schema/      # YAML schema loading and validation
│   │   │   ├── data/        # Data loader, directory registry
│   │   │   ├── log/         # Game log watcher and analyzer
│   │   │   └── utils/       # Shared utilities (logger, fuzzy match, etc.)
│   │   └── test/
│   │       ├── unit/        # Unit tests (Mocha)
│   │       └── suite/       # Integration tests (VS Code test runner)
│   ├── syntaxes/            # TextMate grammars
│   ├── snippets/            # Code snippets
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
├── data/                    # Static YAML data files (effects, triggers, scopes, schemas)
├── Documentation/           # Developer and user guides
├── example mod/             # Example CK3 mod for manual testing
└── README.md
```

## Areas for Contribution

We welcome contributions in these areas:

### Language Server Features

- [x] Syntax validation and diagnostics
- [x] Auto-completion for CK3 keywords and scopes
- [x] Hover information for game concepts
- [x] Go to definition for scripted effects/triggers
- [ ] Find references
- [x] Code formatting
- [x] Symbol search
- [ ] Rename support improvements

### CK3 Language Support

- [x] Comprehensive keyword database
- [x] Scope validation
- [x] Effect and trigger validation
- [x] Localization support
- [x] Error messages and diagnostics

### Testing & Documentation

- [ ] Increase test coverage
- [ ] Add integration tests
- [ ] Improve documentation
- [ ] Add more examples
- [ ] Create tutorials

### VS Code Extension

- [x] Syntax highlighting themes
- [x] Code snippets
- [x] Better file associations
- [x] Configuration options
- [ ] Additional snippet coverage

## Bug Reports

When filing a bug report, please include:

- Node.js version
- VS Code version
- Extension version
- Operating system
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages or logs (from "CK3: Show Output Channel")

## Feature Requests

Feature requests are welcome! Please provide:

- Clear description of the feature
- Use case or motivation
- Examples if applicable
- Any relevant CK3 documentation

## Questions?

If you have questions about contributing, feel free to:

- Open an issue for discussion
- Check existing issues and discussions
- Review the CK3 modding documentation

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what's best for the project
- Show empathy towards others

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- Project documentation
- Release notes

Thank you for contributing to pychivalry!
