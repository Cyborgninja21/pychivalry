# Testing Guide for CK3 Language Support Extension

This document describes how to run and write tests for the VS Code extension.

## Overview

The extension includes a comprehensive test suite that covers:
- **Command registration and execution** (22+ commands)
- **LSP client integration** (initialization, document sync, language features)
- **Diagnostics** (error display, severity levels, multi-file support)
- **Configuration** (settings validation, updates, events)

## Test Structure

```
vscode-extension/
├── src/
│   └── test/
│       ├── suite/
│       │   ├── index.ts              # Test suite loader
│       │   ├── extension.test.ts     # Extension activation tests
│       │   ├── commands.test.ts      # Command execution tests (NEW)
│       │   ├── lsp-client.test.ts    # LSP integration tests (NEW)
│       │   ├── diagnostics.test.ts   # Diagnostic display tests (NEW)
│       │   └── configuration.test.ts # Configuration tests (NEW)
│       └── runTest.ts                # Test runner
├── test-workspace/                   # Sample CK3 mod for testing (NEW)
│   ├── events/test_events.txt
│   ├── common/traits/test_traits.txt
│   ├── localization/english/
│   ├── gui/test_window.gui
│   └── .vscode/settings.json
└── out/                              # Compiled test output
    └── test/
```

## Running Tests

### From Command Line

```bash
# Full test suite (with linting and compilation)

npm test

# Quick test run (skip linting)
npm run test:quick

# Integration tests only
npm run test:integration

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Compile tests only
npm run compile-tests
```

### From VS Code

Use the VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run these tasks:

1. **Run Extension Tests** - Full test suite with all checks
2. **Run Extension Tests (Quick)** - Fast test run without linting
3. **Watch Extension Tests** - Auto-rerun tests on changes

Or use the Tasks menu: `Terminal > Run Task > Run Extension Tests`

### From VS Code Debug

1. Open the Debug panel (`Ctrl+Shift+D` / `Cmd+Shift+D`)
2. Select "Extension Tests" from the dropdown
3. Press F5 to start debugging tests

## Test Workspace

The [test-workspace/](test-workspace/) directory contains sample CK3 mod files used for integration testing:

- **Events** with various test cases (valid, syntax errors, scope chains)
- **Traits** with proper and broken references
- **Localization** with orphaned keys and missing references
- **GUI** definitions
- **Settings** configured for testing

This workspace is automatically used by the test runner.

## Writing Tests

### Test Framework

We use:
- **Mocha** - Test framework (TDD style: `suite`, `test`)
- **VS Code Test API** - For running tests in Extension Development Host
- **Node assert** - Assertion library

### Example Test

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('My Test Suite', () => {
    suiteSetup(async function() {
        this.timeout(30000);
        // Setup code that runs once before all tests
    });

    test('Should do something', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: 'namespace = test',
        });

        assert.strictEqual(doc.languageId, 'ck3');
    });

    suiteTeardown(async () => {
        // Cleanup code
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });
});
```

### Test Guidelines

1. **Use descriptive test names** - `test('Should register all commands', ...)`
2. **Set appropriate timeouts** - LSP operations may be slow: `this.timeout(10000)`
3. **Clean up after tests** - Close editors, restore configuration
4. **Handle LSP unavailability gracefully** - Tests should pass even if LSP server isn't running
5. **Test both success and error paths** - Try-catch for expected failures
6. **Use parallel test execution** - Keep tests independent

### Test Categories

#### 1. Unit Tests (Fast)
- Test individual components in isolation
- Mock external dependencies
- Should run in <100ms each

#### 2. Integration Tests (Slower)
- Test extension + LSP interaction
- Use real VS Code APIs
- May take 2-5 seconds each

#### 3. End-to-End Tests (Slowest)
- Test complete workflows
- Multiple document interactions
- User-facing scenarios

## Continuous Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- All platforms: **Windows**, **Linux**, **macOS**

See [.github/workflows/ci.yml](../.github/workflows/ci.yml) for CI configuration.

### CI Test Matrix

| OS | Node.js | Status |
|----|---------|--------|
| Ubuntu Latest | 18 LTS | ✅ Running |
| Windows Latest | 18 LTS | ✅ Running |
| macOS Latest | 18 LTS | ✅ Running |

## Test Coverage

Current test coverage by component:

| Component | Tests | Status |
|-----------|-------|--------|
| Extension Activation | 5 tests | ✅ Complete |
| Command Registration | 8+ suites | ✅ Complete |
| LSP Client Integration | 6 suites | ✅ Complete |
| Diagnostics Display | 7 suites | ✅ Complete |
| Configuration | 8 suites | ✅ Complete |
| Language Features | In progress | 🚧 Partial |

## Troubleshooting

### Tests fail with "Extension not found"

Ensure the extension ID in `package.json` matches the ID used in tests:
```typescript
const ext = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
```

### Tests timeout on Linux

Linux CI needs `xvfb` for headless testing. The CI workflow handles this automatically:
```bash
xvfb-run -a npm test
```

### LSP server not starting in tests

This is expected in some test environments. Tests are designed to:
- Function without LSP when possible
- Gracefully handle LSP unavailability
- Report what would happen if LSP were available

### Compilation errors

Make sure TypeScript is compiling correctly:
```bash
npm run compile-tests
# Check for errors in output
```

### Test workspace issues

If tests fail due to workspace problems:
1. Verify [test-workspace/](test-workspace/) exists
2. Check that sample files are valid CK3 syntax
3. Review [test-workspace/.vscode/settings.json](test-workspace/.vscode/settings.json)

## Performance

Test suite performance targets:

- **Full suite**: < 2 minutes (on CI)
- **Quick run**: < 30 seconds (local development)
- **Individual test**: < 5 seconds (integration tests)
- **Unit tests**: < 100ms each

## Adding New Tests

1. Create test file in `src/test/suite/`
2. Follow naming convention: `*.test.ts`
3. Import necessary APIs (`vscode`, `assert`)
4. Write tests using `suite()` and `test()`
5. Compile: `npm run compile-tests`
6. Run: `npm test`
7. Verify in CI after pushing

## Related Documentation

- [CONTRIBUTING.md](../../CONTRIBUTING.md) - General contribution guidelines
- [package.json](package.json) - Test scripts configuration
- [.vscode/tasks.json](../.vscode/tasks.json) - VS Code test tasks
- [Test Workspace README](test-workspace/README.md) - Sample files documentation

## Support

If you encounter issues with testing:
1. Check this documentation
2. Review existing test files for examples
3. Open an issue on [GitHub](https://github.com/Cyborgninja21/pychivalry/issues)
4. Tag with `testing` and `extension` labels
