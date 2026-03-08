# Test Writing Best Practices

**Purpose:** Guidelines and patterns for writing high-quality tests using Mocha and TypeScript.

**Use this when:** Adding new tests, improving test coverage, or refactoring existing tests.

---

## Test Philosophy

### Test Pyramid
```
         /\
        /  \    Few: End-to-End Tests
       /____\
      /      \  Some: Integration Tests
     /________\
    /          \ Many: Unit Tests
   /____________\
```

**Focus:** Most tests should be fast unit tests; fewer integration tests; minimal E2E tests.

## Test Organization

### Directory Structure
```
vscode-extension/src/test/
├── unit/                       # Fast unit tests (no VS Code instance)
│   ├── parser.test.ts          # Parser unit tests
│   ├── style-checks.test.ts    # Style validation tests
│   ├── log-diagnostics.test.ts # Log diagnostics tests
│   └── *.test.ts               # Other unit tests
├── integration/                # Integration tests (launches VS Code)
│   └── extension.test.ts
└── fixtures/                   # Test data files
    └── sample_events.txt
```

### Naming Conventions

```typescript
// Test files: kebab-case.test.ts
// Describe blocks: PascalCase class/module name
// It blocks: 'should ...' description

describe('CK3Parser', () => {
    describe('parse()', () => {
        it('should return a ROOT node for empty input', () => {
            // ...
        });
    });
});

describe('Style Checks', () => {
    describe('checkIndentation()', () => {
        it('should flag space indentation when tabs preferred', () => {
            // ...
        });
    });
});
```

## Unit Test Patterns

### Basic Unit Test Structure

```typescript
import * as assert from 'assert';
import { CK3Parser, NodeType } from '../../server/core/parser';

describe('CK3Parser', () => {
    let parser: CK3Parser;

    beforeEach(() => {
        parser = new CK3Parser();
    });

    it('should parse key = string_value', () => {
        // Arrange
        const input = 'name = my_event';

        // Act
        const result = parser.parse(input);

        // Assert
        const node = result.ast.children![0];
        assert.strictEqual(node.type, NodeType.ASSIGNMENT);
        assert.strictEqual(node.key, 'name');
        assert.strictEqual(node.value, 'my_event');
    });
});
```

### Setup with beforeEach and Helper Functions

```typescript
import * as assert from 'assert';
import {
    checkIndentation,
    DEFAULT_STYLE_CONFIG,
    StyleConfig,
} from '../../server/ck3/validation/style-checks';
import { CK3Parser, ASTNode } from '../../server/core/parser';

function makeConfig(overrides: Partial<StyleConfig> = {}): StyleConfig {
    return { ...DEFAULT_STYLE_CONFIG, ...overrides };
}

function parseAST(text: string): ASTNode {
    const parser = new CK3Parser();
    return parser.parse(text).ast;
}

describe('Style Checks', () => {
    describe('checkIndentation()', () => {
        it('should flag space indentation when tabs preferred', () => {
            const text = '    key = value';
            const diags = checkIndentation(text, makeConfig({ preferTabs: true }));
            assert.ok(diags.length > 0, 'Should flag space indentation');
            assert.ok(diags.some((d) => d.code === 'CK3303'));
        });

        it('should return empty when indentation checking disabled', () => {
            const text = '    key = value';
            const diags = checkIndentation(text, makeConfig({ indentation: false }));
            assert.strictEqual(diags.length, 0);
        });
    });
});
```

### Parametric Tests (Loop-Driven)

Use for testing multiple similar cases:

```typescript
describe('scope resolution', () => {
    const cases = [
        { input: 'root', expected: 'character' },
        { input: 'root.liege', expected: 'character' },
        { input: 'root.capital_province', expected: 'province' },
        { input: 'root.primary_title', expected: 'title' },
    ];

    for (const { input, expected } of cases) {
        it(`should resolve "${input}" to scope "${expected}"`, () => {
            const result = resolveScope(input, 'character');
            assert.strictEqual(result, expected);
        });
    }
});

describe('trait validation', () => {
    const validTraits = ['brave', 'craven', 'just', 'arbitrary'];
    const invalidTraits = ['not_a_real_trait', ''];

    for (const trait of validTraits) {
        it(`should accept valid trait "${trait}"`, () => {
            assert.strictEqual(isValidTrait(trait), true);
        });
    }

    for (const trait of invalidTraits) {
        it(`should reject invalid trait "${trait}"`, () => {
            assert.strictEqual(isValidTrait(trait), false);
        });
    }
});
```

### Testing Error Conditions

```typescript
describe('error handling', () => {
    let parser: CK3Parser;

    beforeEach(() => {
        parser = new CK3Parser();
    });

    it('should record parse errors for invalid syntax', () => {
        const result = parser.parse('namespace = { { {');
        assert.ok(result.errors.length > 0, 'Should have parse errors');
    });

    it('should handle null input gracefully', () => {
        const converter = new LogDiagnosticConverter(mockConnection(), []);
        const diag = converter.convertToDiagnostic(
            makeResult({ sourceFile: undefined })
        );
        assert.strictEqual(diag, null);
    });
});
```

## Integration Test Patterns

### Testing with VS Code Instance

Integration tests launch a VS Code instance and test the full extension:

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';

describe('Extension Integration', () => {
    it('should activate the extension', async () => {
        const ext = vscode.extensions.getExtension('publisher.ck3-language-support');
        assert.ok(ext, 'Extension should be found');
        await ext!.activate();
        assert.strictEqual(ext!.isActive, true);
    });
});
```

## Test Data Management

### Using Helper Functions for Test Data

```typescript
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { LogAnalysisResult } from '../../server/log/analyzer';

function makeResult(overrides: Partial<LogAnalysisResult> = {}): LogAnalysisResult {
    return {
        severity: DiagnosticSeverity.Error,
        category: 'unknown_effect',
        message: "Unknown effect 'add_glod'",
        rawLine: 'Unknown effect: add_glod',
        timestamp: Date.now(),
        sourceFile: 'events/my_event.txt',
        lineNumber: 45,
        extractedValues: { group0: 'add_glod' },
        suggestions: ['add_gold'],
        codeActionType: 'suggest_similar_effect',
        ...overrides,
    };
}
```

## Mocking and Stubbing

### Lightweight Mock Objects

```typescript
function mockConnection(): {
    sendDiagnostics: (p: { uri: string; diagnostics: unknown[] }) => void;
    _published: Array<{ uri: string; diagnostics: unknown[] }>;
} {
    const published: Array<{ uri: string; diagnostics: unknown[] }> = [];
    return {
        sendDiagnostics: (params: { uri: string; diagnostics: unknown[] }) => {
            published.push(params);
        },
        _published: published,
    };
}

describe('LogDiagnosticConverter', () => {
    it('sends empty diagnostics for all tracked URIs', () => {
        const conn = mockConnection();
        const converter = new LogDiagnosticConverter(conn, []);

        const diag = converter.convertToDiagnostic(makeResult());
        converter.publishDiagnostics('file:///test.txt', [diag!]);

        converter.clearAllLogDiagnostics();

        const cleared = conn._published.filter(
            (p: { diagnostics: unknown[] }) => p.diagnostics.length === 0
        );
        assert.ok(cleared.length > 0, 'Should send empty diagnostics');
    });
});
```

## Performance Testing

### Benchmarking with Timing

```typescript
describe('performance', () => {
    it('should parse large files within time budget', () => {
        const parser = new CK3Parser();
        const largeFile = 'has_trait = brave\n'.repeat(10000);

        const start = process.hrtime.bigint();
        const result = parser.parse(largeFile);
        const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms

        assert.ok(result.ast !== null);
        assert.ok(elapsed < 1000, `Parsing took ${elapsed}ms, expected < 1000ms`);
    });
});
```

## Test Coverage

### Running with Coverage

```bash
# Run unit tests (fast, no VS Code instance)
npm run test:unit

# Run all tests
npm test
```

### Coverage Goals

- **Parser:** 90%+ coverage
- **Validators:** 85%+ coverage
- **LSP Handlers:** 80%+ coverage
- **Utilities:** 75%+ coverage

## Running Tests

### Quick Reference

```bash
# Run all tests (pretest + full suite)
npm test

# Run unit tests only (fast)
npm run test:unit

# Run integration tests (launches VS Code)
npm run test:integration

# Run without linting
npm run test:quick

# Run specific test file
npx mocha out/test/unit/parser.test.js --timeout 10000

# Run tests matching pattern
npm run test:unit -- --grep "CK3Parser"

# Via Taskfile (from workspace root)
task test:unit
task test
task test:quick

# Stop on first failure
npm run test:unit -- --bail
```

## Best Practices Summary

### Do

- Write descriptive test names using `it('should ...')` format
- Test one behavior per `it` block
- Use `beforeEach` for shared setup
- Use loop-driven `it` blocks for similar test cases
- Test edge cases and error conditions
- Keep tests fast (unit tests need no VS Code instance)
- Use `assert.strictEqual` for value comparisons
- Use `assert.deepStrictEqual` for object/array comparisons
- Use `assert.ok` for truthiness with descriptive messages
- Organize tests logically with nested `describe` blocks
- Write tests before fixing bugs

### Don't

- Write tests that depend on other tests
- Use `setTimeout` in tests (use proper async patterns)
- Test implementation details (test behavior)
- Ignore flaky tests (fix them)
- Skip writing tests for "simple" code
- Let tests become unmaintainable
- Forget to test error paths
- Use `assert.equal` (use `assert.strictEqual` instead)
