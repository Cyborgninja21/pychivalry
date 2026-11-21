# Pre-commit Hooks Setup

This project uses [pre-commit](https://pre-commit.com/) to automatically run code quality checks before commits.

## What Gets Checked?

### TypeScript Files (`vscode-extension/src/`)
- **Prettier**: Auto-formats code for consistent style
- **ESLint**: Checks for code quality and potential bugs
- **TypeScript Compiler**: Type checking and compilation validation

### TypeScript Files (`tools/`)
- **Prettier**: Auto-formats extraction scripts to maintain consistent style (120 char line length)
- **ESLint**: Checks for code style and potential errors in extraction tools
- **TypeScript Compiler**: Type checking and compilation validation

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
# Install pre-commit (if not installed system-wide)
npm install -g pre-commit
# or
pip install pre-commit

# Install the git hook scripts
pre-commit install

# Install TypeScript dependencies
cd vscode-extension/
npm install
cd ..
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
pre-commit run --files vscode-extension/src/server/server.ts

# Run specific hook on TypeScript files
pre-commit run eslint --all-files

# Run specific hook on TypeScript files (extraction tools)
pre-commit run eslint --all-files
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
# Set environment variable to skip ESLint
SKIP=eslint git commit -m "message"

# Skip multiple hooks
SKIP=eslint,prettier git commit -m "message"
```

## Configuration

The pre-commit configuration is in `.pre-commit-config.yaml` at the repository root.

### TypeScript Configuration
- Prettier: Configured in `vscode-extension/.prettierrc`
- ESLint: Configured in `vscode-extension/.eslintrc.json`
- TypeScript: Configured in `vscode-extension/tsconfig.json`

### TypeScript Configuration (Extraction Tools)
- Prettier: Line length 120, configured in `tools/.prettierrc`
- ESLint: Configured in `tools/.eslintrc.json`
- TypeScript: Configured in `tools/tsconfig.json`

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
- [ESLint documentation](https://eslint.org/)
- [Prettier documentation](https://prettier.io/)
