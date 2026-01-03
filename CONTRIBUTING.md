# Contributing to pychivalry

Thank you for your interest in contributing to pychivalry! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- Python 3.9 or higher
- Git
- Node.js and npm (for VS Code extension development)

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

2. Install the package in development mode with dev dependencies:
```bash
pip install -e ".[dev]"
```

3. Install pre-commit hooks (recommended):
```bash
pre-commit install
```

This will automatically run code formatters and linters before each commit, ensuring code quality and consistency.

4. For VS Code extension development:
```bash
cd vscode-extension
npm install
```

### Pre-commit Hooks

The project uses pre-commit hooks to automatically check and format code before commits. These hooks:

- **Python:**
  - Format code with Black
  - Check code style with flake8
  - Sort imports with isort
  - Check for trailing whitespace and other issues

- **TypeScript (VS Code extension):**
  - Format code with Prettier
  - Lint with ESLint

**Manual execution:**
```bash
# Run on all files
pre-commit run --all-files

# Run on staged files only
pre-commit run

# Skip hooks for a specific commit (not recommended)
git commit --no-verify -m "message"
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
black pychivalry/ tests/
flake8 pychivalry/ tests/
isort pychivalry/ tests/
```

4. Run tests:
```bash
pytest tests/ -v
```

5. Commit your changes with a descriptive message:
```bash
git commit -m "Add feature: description of your change"
```
The pre-commit hooks will run automatically and fix most formatting issues.

### Code Style

- Follow PEP 8 guidelines
- Use Black for code formatting (line length: 100)
- Write docstrings for all public functions and classes
- Add type hints where appropriate

### Testing

- Write tests for all new features
- Ensure all existing tests pass
- Aim for good test coverage
- Tests should be in the `tests/` directory

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

- [ ] Tests pass (`pytest tests/`)
- [ ] Pre-commit hooks pass (`pre-commit run --all-files`)
- [ ] Code is formatted with Black (automatic with pre-commit)
- [ ] No linting errors (automatic with pre-commit)
- [ ] Type checking passes (`mypy pychivalry/`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Commit messages are clear and descriptive

## Project Structure

```
pychivalry/
├── pychivalry/          # Main Python package
│   ├── __init__.py
│   └── server.py        # Language server implementation
├── tests/               # Test suite
│   └── test_server.py
├── vscode-extension/    # VS Code extension
│   ├── src/
│   │   └── extension.ts
│   ├── package.json
│   └── tsconfig.json
├── examples/            # Example CK3 files
├── pyproject.toml       # Python project configuration
└── README.md
```

## Areas for Contribution

We welcome contributions in these areas:

### Language Server Features

- [ ] Syntax validation and diagnostics
- [ ] Auto-completion for CK3 keywords and scopes
- [ ] Hover information for game concepts
- [ ] Go to definition for scripted effects/triggers
- [ ] Find references
- [ ] Code formatting
- [ ] Symbol search

### CK3 Language Support

- [ ] Comprehensive keyword database
- [ ] Scope validation
- [ ] Effect and trigger validation
- [ ] Localization support
- [ ] Error messages and diagnostics

### Testing & Documentation

- [ ] Increase test coverage
- [ ] Add integration tests
- [ ] Improve documentation
- [ ] Add more examples
- [ ] Create tutorials

### VS Code Extension

- [ ] Syntax highlighting themes
- [ ] Code snippets
- [ ] Better file associations
- [ ] Configuration options

## Bug Reports

When filing a bug report, please include:

- Python version
- pychivalry version
- Operating system
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages or logs

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

Thank you for contributing to pychivalry! 🎉
