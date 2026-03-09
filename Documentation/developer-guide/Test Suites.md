# Test Suites Documentation

This document provides a comprehensive overview of the test suites available in the pychivalry project and instructions on how to run them effectively.

## Table of Contents

- [Overview](#overview)
- [Test Framework & Configuration](#test-framework--configuration)
- [Writing New Tests](#writing-new-tests)
- [Test Fixtures](#test-fixtures)
- [Test Directory Structure](#test-directory-structure)
- [Running Tests](#running-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)
- [Unit Test Suites](#unit-test-suites)
- [Integration Tests](#integration-tests)
- [Performance Tests](#performance-tests)
- [Regression Tests](#regression-tests)

---

## Overview

Building a Language Server Protocol (LSP) implementation is a complex endeavor that touches nearly every aspect of code intelligence—from parsing raw text into meaningful structures, to understanding context for completions, to tracking symbols across an entire mod workspace. The pychivalry test suite reflects this complexity through a multi-layered testing strategy that ensures reliability at every level.

The testing philosophy follows the **testing pyramid** principle: a broad foundation of fast unit tests that verify individual components in isolation, a middle layer of integration tests that confirm components work together correctly, and a peak of end-to-end tests that validate complete user workflows. This approach catches bugs early (where they're cheapest to fix) while still ensuring the full system behaves correctly.

The pychivalry project uses **Mocha** as its primary testing framework with TypeScript support for structured testing:

| Tool | Purpose |
|--------|---------|
| `Mocha` | TypeScript test runner with async support |
| `@types/mocha` | TypeScript definitions for Mocha |
| `ts-node` | TypeScript execution for tests |
| `@vscode/test-electron` | VSCode extension testing utilities |

We chose Mocha for its TypeScript integration, built-in async support, and compatibility with VSCode extension testing. The combination of these tools allows us to test everything from basic function behavior to complex asynchronous protocol interactions within the VSCode environment.

---

## Test Framework & Configuration

The test configuration is intentionally minimal, relying on Mocha's sensible defaults while adding only what's necessary for our specific needs. This keeps the test infrastructure maintainable and makes it easy for new contributors to understand and extend.

### Configuration Files

Test settings are defined in `vscode-extension/package.json` scripts section:

```json
{
  "scripts": {
    "test": "npm run compile && node out/test/runTest.js",
    "test:quick": "mocha --require ts-node/register 'src/test/unit/**/*.test.ts'",
    "test:watch": "mocha --require ts-node/register --watch 'src/test/unit/**/*.test.ts'"
  }
}
```

TypeScript configuration in `vscode-extension/tsconfig.json` handles test compilation alongside the main codebase. The test runner automatically handles async functions without requiring explicit markers, essential for testing LSP protocol handlers which are inherently asynchronous.

### Installing Test Dependencies

Before running any tests, ensure all dependencies are installed. These include testing frameworks, TypeScript definitions, and code quality tools like ESLint and Prettier:

```bash
# Install extension dependencies (from vscode-extension/ directory)
npm install

# Or use the VS Code task
# Run Task: "Install Extension Dependencies"
```

---

## Writing New Tests

Good tests are as important as good code—they're documentation, specification, and safety net all in one. When writing tests for pychivalry, aim for clarity and comprehensiveness. Each test should have a clear purpose, test one thing well, and serve as an example of correct usage.

The best tests read like specifications: "Given this input, the system should produce this output." They're specific enough to catch regressions but general enough to remain valid as implementation details change. Tests that are too tightly coupled to implementation become a maintenance burden rather than a safety net.

### Test Naming Conventions

Test names should describe the behavior being tested, not the implementation detail. A name like `parseEmptyDocument` immediately tells you what scenario is covered. When a test fails, its name should give you a good idea of what broke without reading the test code.

```typescript
// Test file: <feature>.test.ts
// Test suite: describe('<Feature>')
// Test case: it('should <specific_behavior>')

describe('Parser', () => {
    it('should parse empty document', async () => {
        // Parser handles empty documents
    });
    
    it('should parse namespace declarations', async () => {
        // Parser extracts namespace declarations
    });
});
```

### Test Descriptions

Test descriptions serve as inline documentation explaining why a test exists and what it verifies. This is especially valuable for complex tests where the assertion alone doesn't tell the whole story. A good description explains the behavior being tested, any important context, and what a failure would indicate.

Always include clear descriptions explaining what the test verifies:

```typescript
it('should provide completions in effect blocks', async () => {
    // Test: Completions should include effect names when inside an effect block.
    // This validates that context-aware completion provides relevant suggestions
    // based on the cursor position within the AST.
});
```

### Using Test Helpers

Test helpers make tests cleaner by extracting common setup code. Instead of every test creating its own sample event text, they can call `getSampleEventText()` and receive consistent, well-defined test data. This reduces duplication and ensures tests use the same baseline data.

```typescript
import { getSampleEventText } from '../helpers/test-data';

it('should work with sample event', async () => {
    const sampleEvent = getSampleEventText();
    const ast = parseDocument(sampleEvent);
    assert(ast !== null);
});
```

### Test Categories

Mocha allows you to categorize tests and run specific subsets. Use `describe.skip()` for tests that document planned functionality not yet implemented—this keeps the test suite passing while still tracking what needs to be done.

```typescript
describe('Performance Tests', function() {
    // Increase timeout for slow tests
    this.timeout(10000);
    
    it('should handle large files efficiently', async () => {
        // Performance test implementation
    });
});

describe.skip('Future Features', () => {
    it('should implement planned feature', async () => {
        // Skip tests for unimplemented features
    });
});
```

### Adding Regression Tests

Regression tests are your insurance policy against past bugs returning. The key to a good regression test is documentation: future maintainers need to understand what bug the test prevents and why that specific test case triggers it.

When fixing a bug, add a regression test:

```typescript
it('should handle specific bug scenario', async () => {
    // Regression: Brief description of the bug
    // Bug: What was happening wrong
    // Fixed: How it was fixed
    
    // Test that the bug doesn't recur
});
```

---

## Test Fixtures

Test helpers and shared utilities provide a way to share setup code across tests while keeping test functions clean and focused. The pychivalry test suite uses helper functions and shared test data extensively for common operations like creating sample documents, setting up workspaces, and providing test data.

The helper system provides reusable functions and data that tests can import as needed. This makes tests self-documenting—you can see what a test uses just by looking at its imports.

### Shared Test Helpers (`vscode-extension/src/test/helpers/`)

The test helpers directory provides reusable utilities across the test suite:

| Helper Module | Description |
|---------------|-------------|
| `test-data.ts` | Sample CK3 script content for testing |
| `workspace-setup.ts` | Temporary workspace creation utilities |
| `test-utils.ts` | Common test utilities and assertions |
| `mock-lsp.ts` | LSP protocol mocking utilities |

### Test Data Files (`vscode-extension/src/test/fixtures/`)

The fixtures directory contains static test data that's too large or complex to define inline in test files. Using external files for test data has several advantages: it keeps test code readable, allows the same data to be reused across multiple tests, and makes it easy to add new test cases by simply dropping files into the directory.

Static test data files:

| File | Purpose |
|------|---------|
| `valid-event.txt` | Complete valid event for parsing tests |
| `syntax-errors.txt` | Examples of syntax errors |
| `scope-chains.txt` | Scope chain examples |
| `story-cycles/` | Story cycle test data |

---

## Test Directory Structure

The test directory is organized to mirror the logical structure of what's being tested, making it intuitive to find tests for any given functionality. Unit tests live in the `unit/` directory with names matching their corresponding modules, while specialized test categories (integration, performance, regression) have their own subdirectories.

This organization serves several purposes: it makes it easy to run related tests together, helps new developers find relevant test examples, and keeps the test suite manageable as it grows. The `fixtures/` directory contains static test data that would be cumbersome to define inline in test files.

```
vscode-extension/src/test/
├── runTest.ts               # Main test runner for VSCode extension
├── suite/                   # Integration test suites
│   └── index.ts            # Test suite entry point
├── unit/                    # Unit tests (by module)
│   ├── parser.test.ts
│   ├── diagnostics.test.ts
│   ├── completions.test.ts
│   └── validation.test.ts
├── integration/             # End-to-end workflow tests
│   └── lsp-workflows.test.ts
├── performance/             # Benchmarks and performance tests
│   └── benchmarks.test.ts
├── regression/              # Tests for previously fixed bugs
│   └── bug-fixes.test.ts
├── helpers/                 # Shared test utilities
│   ├── test-data.ts
│   ├── workspace-setup.ts
│   └── mock-lsp.ts
└── fixtures/                # Test data files
    ├── valid-event.txt
    ├── syntax-errors.txt
    ├── scope-chains.txt
    └── story-cycles/
```

---

## Running Tests

Understanding how to run tests effectively is crucial for productive development. Different situations call for different testing strategies—you might want fast feedback during active development, thorough validation before a commit, or focused debugging of a specific issue. The commands below cover these scenarios and more.

### Basic Commands

The most common operation is running all tests to verify everything still works. The extension tests run in the VSCode environment, providing full integration testing:

```bash
# Run all tests (full VSCode extension test)
npm test

# Run all tests (via VS Code task)
# Task: "Run Extension Tests"

# Run unit tests only (faster, no VSCode environment)
npm run test:quick

# Run tests in watch mode for development
npm run test:watch
```

### Running Specific Test Categories

When working on a particular feature area, you'll often want to run only the tests relevant to your changes. This provides faster feedback and reduces noise from unrelated test output:

```bash
# Run only unit tests
npx mocha --require ts-node/register 'src/test/unit/**/*.test.ts'

# Run integration tests
npx mocha --require ts-node/register 'src/test/integration/**/*.test.ts'

# Run performance tests
npx mocha --require ts-node/register 'src/test/performance/**/*.test.ts'

# Run regression tests
npx mocha --require ts-node/register 'src/test/regression/**/*.test.ts'
```

### Running Specific Test Files

Individual test files correspond to specific modules in the pychivalry server. When you're modifying a particular module, running its corresponding test file gives you targeted feedback:

```bash
# Run parser tests
npx mocha --require ts-node/register 'src/test/unit/parser.test.ts'

# Run diagnostics tests
npx mocha --require ts-node/register 'src/test/unit/diagnostics.test.ts'

# Run completions tests
npx mocha --require ts-node/register 'src/test/unit/completions.test.ts'

# Run validation tests
npx mocha --require ts-node/register 'src/test/unit/validation.test.ts'
```

### Running Specific Test Suites or Cases

For debugging specific issues or developing new features test-driven style, you can run individual test suites or even single test cases using Mocha's grep functionality:

```bash
# Run tests matching a pattern
npx mocha --require ts-node/register 'src/test/**/*.test.ts' --grep "parser"
npx mocha --require ts-node/register 'src/test/**/*.test.ts' --grep "completions"

# Run a specific test suite
npx mocha --require ts-node/register 'src/test/unit/parser.test.ts' --grep "Parser"

# Run a specific test case
npx mocha --require ts-node/register 'src/test/unit/parser.test.ts' --grep "should parse empty document"
```

### Excluding Slow Tests

Some tests, particularly those that require the full VSCode environment or extensive processing, can take significant time to run. During rapid iteration, you can focus on unit tests for faster feedback:

```bash
# Run only unit tests (fast)
npm run test:quick

# Skip integration tests
npx mocha --require ts-node/register 'src/test/unit/**/*.test.ts'
```

---

## Continuous Integration

Continuous Integration (CI) ensures that every change is tested before it's merged. The GitHub Actions workflow for this project runs the full TypeScript compilation and test suite on every pull request and commit to main.

### Running Full Test Suite

Before committing changes, it's good practice to run the full test suite to ensure nothing is broken. The tests compile TypeScript and run in the VSCode environment:

```bash
# Full test suite (recommended before commits)
npm test

# Quick unit test check
npm run test:quick

# Watch mode for development
npm run test:watch
```

### VS Code Tasks

For developers using VS Code, pre-configured tasks provide a convenient way to run common test operations without remembering command-line syntax. These tasks are defined in `.vscode/tasks.json` and `vscode-extension/package.json`.

The project includes VS Code tasks for common testing operations:

| Task | Command |
|------|---------|
| Run Extension Tests | `npm test` |
| Run Extension Tests (Quick) | `npm run test:quick` |
| Watch Extension Tests | `npm run test:watch` |

Access via: `Ctrl+Shift+P` → `Tasks: Run Task`

### Pre-commit Hooks

Pre-commit hooks automatically run linting and type checking before each commit, catching problems before they enter version control. This creates a safety net that helps maintain code quality without requiring developers to remember to run checks manually. See [PRE_COMMIT_SETUP.md](PRE_COMMIT_SETUP.md) for configuration.

---

## Troubleshooting

Even well-designed test suites occasionally present challenges. This section covers common issues developers encounter and their solutions. If you're stuck on a testing problem not covered here, check the Mocha documentation or ask in the project's issue tracker.

### Common Issues

**Tests not found:**
```bash
# Ensure you're in the vscode-extension directory
cd vscode-extension/
npm test

# Check test file patterns
npx mocha --require ts-node/register 'src/test/**/*.test.ts' --dry-run
```

**Compilation errors:**
```bash
# Ensure TypeScript compilation works
npm run compile

# Check for type errors
npx tsc --noEmit
```

**VSCode extension test issues:**
```bash
# Ensure @vscode/test-electron is installed
npm install

# Debug test runner
npm test -- --verbose
```

**Module import errors:**
```bash
# Verify TypeScript paths are configured correctly
# Check tsconfig.json paths mapping
```

### Getting Help

The best way to learn testing patterns is to read existing tests. The test suite contains examples of nearly every testing scenario you might encounter. When in doubt, find a similar test and use it as a template. The Mocha and VSCode extension testing communities are also helpful—the official documentation is excellent.

- Check existing tests in `vscode-extension/src/test/` for patterns
- Review test helpers in `vscode-extension/src/test/helpers/` for utilities
- Run `npx mocha --help` for Mocha options
- Consult [@vscode/test-electron documentation](https://www.npmjs.com/package/@vscode/test-electron)

---

# Test Suite Reference

The sections below provide detailed documentation of each test category in the pychivalry test suite. Use this as a reference when you need to understand what specific tests cover or when deciding where to add new tests.

---

## Unit Test Suites

Unit tests form the foundation of our testing strategy. Each test file focuses on a single module, testing its public interface in isolation from the rest of the system. This isolation is achieved through careful design—modules accept their dependencies as parameters rather than importing them globally—and through test helpers that provide controlled test doubles when needed.

The value of unit tests lies in their speed and precision. When a unit test fails, you know exactly where the problem is. When they pass, you have confidence that individual components behave correctly. The integration and end-to-end tests then verify these components work together properly.

Unit tests are organized by the module they test. Each test file corresponds to a module in `vscode-extension/src/server/`.

### Core Parser Tests (`parser.test.ts`)

The parser is the foundation of everything the language server does—every other feature depends on accurately converting CK3 script text into a structured Abstract Syntax Tree (AST). These tests are therefore among the most critical in the entire suite.

Parser testing follows a progression from simple to complex: first testing the tokenizer (which breaks text into tokens like identifiers, operators, and strings), then testing AST construction (which builds a tree structure from those tokens), and finally testing error recovery (which ensures the parser produces useful results even when the input is malformed). Position tracking tests verify that every node knows exactly where it came from in the source text—essential for features like go-to-definition and error highlighting.

Tests the CK3 script parser for:
- **Tokenization**: Breaking input into tokens (identifiers, operators, braces, strings, numbers, comments)
- **AST Construction**: Building correct Abstract Syntax Tree structures
- **Position Tracking**: Line/character positions for LSP features
- **Error Recovery**: Graceful handling of malformed input

```bash
npx mocha --require ts-node/register 'src/test/unit/parser.test.ts'
```

### Diagnostics Tests (`diagnostics.test.ts`)

Diagnostics are how the language server communicates problems to the user—the red squiggles and error messages that appear in the editor. These tests verify that errors are detected accurately, that messages are helpful and actionable, and that diagnostics have correct positions so they highlight the right code.

A key testing concern is ensuring no false positives (valid code reported as errors) or false negatives (actual errors not reported). The tests use representative samples of both valid and invalid CK3 code to verify detection accuracy. They also test diagnostic severity levels, ensuring that warnings don't block the user while errors clearly indicate problems that need fixing.

Tests diagnostic collection including:
- Syntax error detection
- Semantic validation errors
- Warning generation
- Error message formatting

```bash
npx mocha --require ts-node/register 'src/test/unit/diagnostics.test.ts'
```

### Schema Validation Tests (`validation.test.ts`)

The schema-driven validation system is one of pychivalry's most sophisticated features. Rather than hardcoding validation rules, the system loads YAML schema definitions that describe the structure of CK3 scripts—what fields are required, what types values should have, and what conditions must be met for code to be valid.

These tests verify the schema loading process (parsing YAML into usable schema objects), the validation engine (applying schemas to AST nodes), and the integration between them. They cover edge cases like conditional requirements (field X is required only if field Y has value Z), pattern matching (block names must match a regex), and cross-field validation (if you specify A, you must also specify B).

Tests the schema-driven validation system:
- Required field validation
- Type checking (strings, numbers, booleans, blocks)
- Cross-field validation rules
- Conditional field requirements
- Pattern matching for block names

```bash
npx mocha --require ts-node/register 'src/test/unit/validation.test.ts'
```

### Completions Tests (`completions.test.ts`)

Auto-completion is one of the most user-visible features of any language server. Good completions save time and teach users about available options; bad completions frustrate and mislead. These tests verify that completions are contextually appropriate, correctly formatted, and performant.

Context-awareness is the key challenge: the same trigger might suggest different completions depending on where the cursor is positioned. Inside a `trigger` block, you want trigger conditions; inside an `immediate` block, you want effects. The tests verify this context detection works correctly across many different scenarios. They also test schema-driven completions, which use the same schema definitions as validation to suggest fields appropriate for the current block type.

Tests auto-completion functionality:
- Context-aware completions
- Scope link completions
- Effect and trigger completions
- Schema-driven completions
- Snippet completions

```bash
npx mocha --require ts-node/register 'src/test/unit/completions.test.ts'
```

### LSP Feature Tests

Beyond parsing and validation, a language server provides many user-facing features that enhance the coding experience. Each feature has its own test file that verifies both correct behavior and edge case handling. These tests often need to simulate editor interactions—positioning a cursor, making selections, or simulating document changes.

| Test File | Feature | Command |
|-----------|---------|---------|
| `hover.test.ts` | Hover documentation | `npx mocha --require ts-node/register 'src/test/unit/hover.test.ts'` |
| `navigation.test.ts` | Go-to-definition, find references | `npx mocha --require ts-node/register 'src/test/unit/navigation.test.ts'` |
| `symbols.test.ts` | Document/workspace symbols | `npx mocha --require ts-node/register 'src/test/unit/symbols.test.ts'` |
| `folding.test.ts` | Code folding regions | `npx mocha --require ts-node/register 'src/test/unit/folding.test.ts'` |
| `formatting.test.ts` | Document formatting | `npx mocha --require ts-node/register 'src/test/unit/formatting.test.ts'` |

## Integration Tests

Integration tests verify that multiple components work together correctly, testing complete user workflows from file loading through LSP protocol interactions to final output.

## Performance Tests

Performance tests measure the language server's responsiveness under various conditions, ensuring it remains usable with large codebases and complex mods.

## Regression Tests

Regression tests capture specific bugs that have been fixed, preventing them from reoccurring as the codebase evolves.
| `test_inlay_hints.py` | Inline type hints |
| `test_semantic_tokens.py` | Syntax highlighting tokens |
| `test_signature_help.py` | Parameter hints |

### CK3-Specific Validation Tests

CK3 modding has its own unique semantics that go beyond generic code structure. Scopes flow through chains of references, variables have different lifetimes depending on their prefix, list iterators change context, and events have specific structural requirements. These tests verify that pychivalry understands and correctly validates these CK3-specific concepts.

These tests are particularly valuable because they encode domain knowledge about CK3 scripting that would otherwise exist only in documentation or modder expertise. When a test like "scope chain through any_vassal should validate" passes, it proves the system correctly understands that `any_vassal` iterates over character-type objects.

| Test File | Validation Type |
|-----------|----------------|
| `test_events.py` | Event structure validation |
| `test_scopes.py` | Scope chain validation |
| `test_variables.py` | Variable system (`var:`, `local_var:`, `global_var:`) |
| `test_lists.py` | List iterator validation (`any_*`, `every_*`) |
| `test_script_values.py` | Script value/formula validation |
| `test_scripted_blocks.py` | Scripted triggers/effects |
| `test_localization.py` | Localization key validation |
| `test_paradox_checks.py` | Paradox convention checks |
| `test_style_checks.py` | Code style validation |
| `test_story_cycles.py` | Story cycle validation |

---

## Integration Tests

While unit tests verify components in isolation, integration tests verify that components work together correctly. A parser might work perfectly, and a diagnostic collector might work perfectly, but do they work perfectly *together*? Integration tests answer this question by exercising realistic combinations of functionality.

The key insight behind integration testing is that bugs often live at boundaries—in the assumptions one component makes about another's behavior. By testing components together with realistic data flows, we catch these interface mismatches before users encounter them.

Located in `tests/integration/`, these tests verify complete user workflows.

### LSP Workflow Tests (`test_lsp_workflows.py`)

These tests simulate actual user workflows from start to finish. Rather than testing "does the parser handle this input correctly," they test "when a user opens a file, types some code, and requests completions, does the right thing happen?" This end-to-end perspective catches problems that unit tests might miss.

Each workflow test tells a story: a user opens a file with a typo, the language server highlights it, the user triggers quick fix, and the typo is corrected. These narrative-driven tests ensure the product works as intended from the user's perspective, not just from the implementer's perspective.

End-to-end tests including:

- **Open → Diagnose → Fix workflow**: Open file, collect diagnostics, apply code action
- **Type → Complete → Accept workflow**: Type code, request completions, accept suggestion
- **Navigate → Modify → Find References**: Go to definition, modify, verify references update
- **Cross-file event chain validation**: Validate event chains across multiple files
- **Multi-file scripted effect usage**: Track effects defined and used across files
- **Mod descriptor workflow**: Load mod descriptor, parse scripts, validate

```bash
npm run test:unit
```

### Server Integration Tests

The language server itself is a complex component that manages state, handles protocol messages, and coordinates all the feature implementations. These tests verify the server initializes correctly, communicates properly with editors via the LSP protocol, and maintains consistent state as documents change.

| Test File | Purpose |
|-----------|---------|
| `test_server.py` | Server creation and initialization |
| `test_server_communication.py` | LSP protocol communication |
| `test_server_integration.py` | Full server integration scenarios |
| `test_lsp_features.py` | All LSP features working together |

---

## Performance Tests

A language server that gives correct answers slowly is nearly as useless as one that gives wrong answers quickly. Users expect instant feedback as they type—completions should appear immediately, diagnostics should update in real-time, and navigation should be snappy. Performance tests ensure we meet these expectations.

Performance testing in a language server context has unique challenges. Response times depend on file size, workspace complexity, and the specific operation. We use benchmarking to measure actual performance under controlled conditions, and we define thresholds that represent acceptable user experience.

Located in `tests/performance/`, these tests ensure the LSP server meets performance requirements.

### Benchmark Tests (`benchmarks.test.ts`)

The benchmark tests measure operation times with statistical rigor. Each benchmark runs multiple iterations to account for variance, reporting minimum, maximum, mean, and standard deviation. This gives us confidence that measured improvements (or regressions) are real rather than noise.

The benchmarks are organized by operation type and input size. Parser benchmarks test small, medium, and large files to understand how parsing time scales. Completion benchmarks test various contexts to find expensive code paths. Navigation benchmarks test cross-file operations that might involve searching large indexes.

Measures:

#### Parser Performance
- Small file parsing (<100 lines): Target < 100ms
- Medium file parsing (100-1000 lines): Target < 100ms  
- Large file parsing (>1000 lines): Target < 100ms
- Deeply nested structure parsing

#### Diagnostics Performance
- Small file diagnostics: Target < 100ms
- Large workspace diagnostics (100 files): Target < 10s total

#### Completions Performance
- Completions in large file: Target < 50ms
- Completions with many scopes

#### Navigation Performance
- Find definition across 50+ files: Target < 50ms
- Find references performance

#### Memory Performance
- Document index memory usage with 500 files

#### Concurrency Performance
- 10 concurrent completion requests: Target < 1s total

```bash
# Run performance benchmarks
npm run test:unit -- --grep "benchmark|performance"
```

### Performance Thresholds

These thresholds represent our quality bar for user experience. The 100ms threshold for parsing and diagnostics ensures updates feel instantaneous. The 50ms threshold for completions and navigation ensures these interactive features feel responsive. These numbers are based on human perception research—delays under 100ms feel instant, while delays over 300ms feel sluggish.

```typescript
const PARSE_THRESHOLD = 0.1;       // 100ms
const DIAGNOSTICS_THRESHOLD = 0.1;  // 100ms
const COMPLETIONS_THRESHOLD = 0.05; // 50ms
const NAVIGATION_THRESHOLD = 0.05;  // 50ms
```

---

## Fuzzing / Property-Based Tests

Traditional tests verify specific scenarios we thought of in advance. But what about scenarios we didn't think of? Fuzzing and property-based testing address this gap by generating random inputs and verifying that certain properties always hold—like "the parser should never crash, regardless of input."

This approach has found real bugs that manual testing missed: unusual character sequences that confused the tokenizer, deeply nested structures that caused stack overflows, and edge cases in string parsing. The randomized nature means each test run potentially explores new territory.

Located in `src/test/unit/`, these tests generate random inputs and find edge cases.

### Property-Based Tests (`property-based.test.ts`)

The key insight behind property-based testing is identifying properties that should hold universally. For a parser, one such property is "it should always return a result without crashing." For diagnostics, "it should always return a list." These invariants are simple to state but powerful to verify across millions of random inputs.

Hypothesis is particularly clever about finding minimal failing examples. When it discovers an input that violates a property, it automatically shrinks that input to find the smallest example that still fails. This makes debugging much easier—instead of staring at 1000 characters of random garbage, you see "this 5-character input causes the crash."

Tests that the parser and other components handle arbitrary input without crashing:

#### Parser Robustness
- Arbitrary text input (up to 1000 chars)
- Valid CK3-like assignments
- Random bracket/delimiter combinations
- Deep nesting (up to 100 levels)
- Various quote combinations

#### Diagnostics Robustness  
- Arbitrary input produces valid diagnostics list
- Valid CK3 structures produce diagnostics without crashes

#### Completions Robustness
- Arbitrary cursor positions don't crash

#### Property Invariants
- Parser always returns a list
- Diagnostics always returns a list
- Valid CK3 syntax produces parseable AST

#### Edge Cases
- Empty files
- Single characters
- Very long lines (10000+ chars)
- Unicode characters
- Mixed line endings
- Incomplete structures
- Invalid UTF-8 sequences

```bash
# Run fuzzing tests
npm run test:unit -- --grep "fuzzing|property"
```

### Custom Strategies

To generate more realistic test data, we define custom Hypothesis strategies that produce CK3-like content. These strategies know the grammar of CK3 scripts and generate syntactically plausible (though semantically meaningless) code. This is more effective than purely random strings because it exercises the parser's actual code paths rather than just its error handling.

The fuzzing tests define custom Hypothesis strategies for generating CK3-like content:

- `ck3_identifier()` - Valid CK3 identifiers
- `ck3_namespace()` - Namespace declarations
- `ck3_simple_assignment()` - Key-value assignments
- `ck3_block()` - Nested block structures

---

## Regression Tests

Every bug that makes it to production is an opportunity to improve the test suite. Regression tests are written specifically to prevent fixed bugs from recurring. Each test documents what went wrong, how it was fixed, and provides a concrete example that would catch the bug if it returned.

This practice builds institutional memory into the codebase. Even if the original developer moves on, the regression test remains as a guardian against that specific failure mode. Over time, the regression test suite becomes a catalog of past problems and their solutions.

Located in `src/test/unit/`, these tests prevent previously fixed bugs from returning.

### Bug Fix Tests (`regression.test.ts`)

Each regression test tells a story in its docstring: what the bug was, how it manifested, and how it was fixed. This documentation is valuable for understanding the system's history and avoiding similar mistakes in the future. When adding a regression test, take time to write a clear explanation—your future self (or a future maintainer) will thank you.

Each test documents a specific bug that was found and fixed:

#### Parser Regressions
- Empty file handling
- Unclosed brace recovery
- Nested quotes handling
- Comment at EOF
- Whitespace-only files

#### Diagnostics Regressions
- No duplicate diagnostics
- Diagnostics update after document changes

#### Completions Regressions
- Completions after dot in empty context
- Completions at document boundary
- Snippet completions in effect blocks

#### Navigation Regressions
- Find definition in same file
- Namespaced event definition finding

#### Scopes Regressions
- Universal scope in any context
- Scope chain with list iteration

#### Events Regressions
- Event without theme allowed
- Dynamic desc validation

#### Backward Compatibility
- Old event format compatibility
- Legacy scope names

```bash
npm run test:unit -- --grep "regression"
```
