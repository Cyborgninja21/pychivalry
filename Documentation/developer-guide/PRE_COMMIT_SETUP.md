# Pre-commit Hooks Setup

This project uses [pre-commit](https://pre-commit.com/) to automatically run code quality checks before commits.

## What Gets Checked?

### Python Files (`pychivalry/`, `tests/`, `tools/`)
- **Black**: Auto-formats code to maintain consistent style (100 char line length)
- **flake8**: Checks for code style and potential errors
- **isort**: Sorts and organizes imports

### TypeScript Files (`vscode-extension/src/`)
- **Prettier**: Auto-formats code for consistent style
- **ESLint**: Checks for code quality and potential bugs

### All Files
- Removes trailing whitespace
- Ensures files end with a newline
- Checks for merge conflicts
- Validates YAML, JSON, and TOML files
- Prevents commits of large files (>1MB)

## Installation

### Automatic (Recommended)
Run the setup script from the repository root:
```bash
./tools/setup-dev-env.sh
```

### Manual
```bash
# Install pre-commit
pip install pre-commit

# Install the git hook scripts
pre-commit install
```

## Usage

### Automatic
Pre-commit hooks run automatically on `git commit`. If issues are found:
- **Auto-fixable issues** (formatting, whitespace, etc.) are fixed automatically
- **Manual fixes required** will cause the commit to fail with error messages
- After auto-fixes, review changes with `git diff` and commit again

### Manual
Run hooks manually without committing:
```bash
# Run on all files
pre-commit run --all-files

# Run on specific files
pre-commit run --files pychivalry/server.py

# Run specific hook
pre-commit run black --all-files
```

### Bypassing Hooks (Not Recommended)
In rare cases, you may need to bypass hooks:
```bash
git commit --no-verify -m "emergency fix"
```
⚠️ **Warning**: This should only be used in exceptional circumstances. Code that doesn't pass hooks may fail CI checks.

## Updating Hooks

Pre-commit hooks are automatically updated when you run them, but you can manually update:
```bash
pre-commit autoupdate
```

## Troubleshooting

### Hooks won't run
```bash
# Reinstall hooks
pre-commit uninstall
pre-commit install

# Clear cache and reinstall
pre-commit clean
pre-commit install --install-hooks
```

### Hook fails with unclear error
```bash
# Run with verbose output
pre-commit run --verbose --all-files
```

### Skip a specific hook temporarily
```bash
# Set environment variable
SKIP=flake8 git commit -m "message"
```

## Configuration

The pre-commit configuration is in `.pre-commit-config.yaml` at the repository root.

### Python Configuration
- Black: Line length 100, configured in `pyproject.toml`
- flake8: Line length 100, configured in `.flake8`
- isort: Black-compatible profile, configured in `pyproject.toml`

### TypeScript Configuration
- Prettier: Configured in `vscode-extension/.prettierrc`
- ESLint: Configured in `vscode-extension/.eslintrc.json`

## CI Integration

Pre-commit hooks are also run in CI/CD pipelines to ensure all code meets quality standards before merging.

## Benefits

- **Consistent code style** across all contributors
- **Catch errors early** before they reach code review
- **Faster code reviews** by automating style checks
- **Learn best practices** through automated feedback
- **Reduce CI failures** by catching issues locally

## Learn More

- [pre-commit documentation](https://pre-commit.com/)
- [Black documentation](https://black.readthedocs.io/)
- [flake8 documentation](https://flake8.pycqa.org/)
- [ESLint documentation](https://eslint.org/)
- [Prettier documentation](https://prettier.io/)
