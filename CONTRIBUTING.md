# Contributing to pychivalry

Thank you for your interest in contributing to pychivalry! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- Python 3.9 or higher
- Git
- Node.js and npm (for VS Code extension development)

### Setting Up Development Environment

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/pychivalry.git
cd pychivalry
```

2. Install the package in development mode with dev dependencies:
```bash
pip install -e ".[dev]"
```

3. For VS Code extension development:
```bash
cd vscode-extension
npm install
```

## Development Workflow

### Making Changes

1. Create a new branch for your feature or bugfix:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes to the codebase

3. Format your code with Black:
```bash
black pychivalry/ tests/
```

4. Run linters:
```bash
flake8 pychivalry/ tests/
mypy pychivalry/
```

5. Run tests:
```bash
pytest tests/ -v
```

6. Commit your changes with a descriptive message:
```bash
git commit -m "Add feature: description of your change"
```

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
- [ ] Code is formatted with Black
- [ ] No linting errors (`flake8 pychivalry/ tests/`)
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
