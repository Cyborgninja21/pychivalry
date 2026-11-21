# Example Mod Validation Test Suite — Implementation Plan

## Table of Contents

- [1. Overview](#1-overview)
- [2. Goals](#2-goals)
- [3. Design Decisions](#3-design-decisions)
- [4. Initialization (before() Hook)](#4-initialization-before-hook)
- [5. Test Infrastructure & File Discovery](#5-test-infrastructure--file-discovery)
- [6. URI Mapping](#6-uri-mapping)
- [7. Error Code Extraction](#7-error-code-extraction)
- [8. Test Loop Design](#8-test-loop-design)
- [9. Reporting](#9-reporting)
- [10. CI/Pre-commit Integration](#10-cipre-commit-integration)
- [11. Dependencies](#11-dependencies)
- [12. Files to Create/Modify](#12-files-to-createmodify)

---

## 1. Overview

The example mod (`example mod/`) contains 24 numbered section directories, each holding `good_*.txt` files that should produce zero diagnostics and `bad_*.txt` files annotated with expected diagnostic codes. Today these files are used only for manual testing — an engineer opens them in the extension and eyeballs the squiggles. This plan describes an automated test suite that validates every example file against the Language Server's `DiagnosticsEngine` as part of the unit-test and CI pipeline.

The suite uses a **full-suite approach**: all validators are enabled from day one with default `DiagnosticConfig` flags. There is no progressive phase-based enabling — every file runs through the complete 34-validator pipeline on every execution. DataLoader, SchemaLoader, and LocalizationIndex all initialize in a single `before()` hook before any test executes.

The suite is a standard Mocha unit test using the existing `test:unit` runner (ts-node, no VS Code host). For `.txt` files it parses with `CK3Parser`, creates a `TextDocument`, and runs `DiagnosticsEngine.collectDiagnostics()`. For `.yml` files it branches to the content-level localization pipeline via `LocalizationIndex` and `validateLocalizationContent()`. Assertions follow:

- **`good_*` files** → zero Error or Warning diagnostics (Info and Hint severity tolerated)
- **`bad_*` files** → all expected diagnostic codes present (relaxed mode — unexpected extras do not fail the test)

After all tests complete, two reports are produced: a console summary table and a JSON report file written to disk.

---

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| 1 | Every example mod file validated automatically | `npm run test:unit` exercises all 24 sections |
| 2 | `good_*` files produce zero Error/Warning diagnostics | Assertion: no diagnostics with Error or Warning severity |
| 3 | `bad_*` files contain all expected codes | Assertion: every `# ERROR: CODE` comment code is present in actual diagnostics |
| 4 | Runs without VS Code host | Pure Node.js via ts-node, no `@vscode/test-electron` |
| 5 | Fast enough for pre-commit | Target < 5 seconds for the full suite |
| 6 | No new npm dependencies | Uses only `mocha`, `assert`, `fs`, `path`, existing server modules |
| 7 | Full validator coverage from day one | Default `DiagnosticConfig` — all 34 validators enabled |
| 8 | Actionable reporting | Console summary table + JSON report to disk after each run |

---

## 3. Design Decisions

All six foundational questions have been resolved. These decisions are final and apply to the implementation.

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Strict vs. relaxed assertions for `bad_*` files | **Relaxed mode.** Only check that expected error codes ARE present. Do NOT fail on unexpected extras. | Avoids brittleness when new validators are added. A new validator may correctly produce additional diagnostics on existing bad files — this should not break the suite. |
| 2 | DataLoader singleton approach | **Accept shared singleton.** `DataLoader.getInstance(dataPath)` + `initialize(dataPath)` once in `before()`. All tests share it. No `reset()` needed. | Single initialization per process is sufficient. The data files are read-only during test execution. Adding a `reset()` method introduces unnecessary API surface. |
| 3 | SchemaLoader path resolution | **Try first, patch only if needed.** `new SchemaLoader()` → `initialize()` → `preloadCommonSchemas()` as-is. If path probing fails from the test `out/` directory, add an explicit path at implementation time. | The loader's built-in path probing may already resolve correctly. Premature patching adds complexity for a problem that may not exist. |
| 4 | INFO diagnostics in good files | **Errors and warnings only.** `good_*` files must produce zero Error or Warning diagnostics. Info and Hint severity are tolerated (filtered out before assertion). | Info-level diagnostics are style hints, not correctness issues. Filtering them prevents churn when new informational rules are added while still catching real validation failures. |
| 5 | Section 12 localization split | **Single test loop with branching.** One `describe()`, one discovery pass. `.yml` files branch to the content-level pipeline (`LocalizationIndex` + `validateLocalizationContent`). `.txt` files use the standard parse+validate path. No separate `describe()` block. | Keeps all files in a unified test structure. Section 12 files appear alongside other sections in test output. Avoids duplicating discovery and setup logic. |
| 6 | Parallel execution | **Sequential per file.** Mocha default serial execution. One `it()` per file, no `--parallel`. | DataLoader and LocalizationIndex are shared singletons. Serial execution avoids race conditions and makes failure output deterministic. The full suite targets < 5 seconds — parallelism is unnecessary. |

---

## 4. Initialization (before() Hook)

All runtime dependencies initialize in a single suite-level `before()` hook. The initialization order is strict — later steps depend on earlier ones.

### Initialization Sequence

```typescript
before(async function () {
    this.timeout(10_000); // YAML loading can be slow on first run

    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const dataPath = path.join(repoRoot, 'data');

    // 1. DataLoader — must initialize first (scope validation depends on it)
    const dataLoader = DataLoader.getInstance(dataPath);
    await dataLoader.initialize(dataPath);

    // 2. SchemaLoader — depends on DataLoader for some schema resolution
    schemaLoader = new SchemaLoader();
    await schemaLoader.initialize();
    await schemaLoader.preloadCommonSchemas();

    // 3. LocalizationIndex — independent but initialized here for .yml pipeline
    locIndex = new LocalizationIndex();
    const exampleModDir = path.join(repoRoot, 'example mod');
    await locIndex.scanDirectory(exampleModDir);
});
```

### Initialization Order Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. DataLoader.getInstance(dataPath) + initialize()              │
│    └─ Loads: effects, triggers, scopes, traits, animations,     │
│       on-actions, concepts, icons                               │
├──────────────────────────────────────────────────────────────────┤
│ 2. SchemaLoader() + initialize() + preloadCommonSchemas()       │
│    └─ Loads: event schemas, decision schemas, etc.              │
├──────────────────────────────────────────────────────────────────┤
│ 3. LocalizationIndex() + scanDirectory()                        │
│    └─ Indexes: .yml localization files                          │
├──────────────────────────────────────────────────────────────────┤
│ 4. DiagnosticsEngine(config, schemaLoader, undefined, locIndex) │
│    └─ Constructed per-test (engines are cheap, no cross-state)  │
└──────────────────────────────────────────────────────────────────┘
```

Steps 1–3 run once in the suite-level `before()` hook. Step 4 runs per-test — `DiagnosticsEngine` instances are cheap to construct and carry no cross-test state.

### Timeout Guidance

The `before()` hook timeout is set to **10 seconds**. DataLoader reads dozens of YAML files; SchemaLoader preloads common schemas. Cold-start initialization on CI runners can approach 5–8 seconds. Individual `it()` tests use Mocha's default 2-second timeout, which is sufficient for single-file validation.

### Path Resolution

Tests compile to `vscode-extension/out/test/unit/`. Repo root is four directories up:

```
out/test/unit/example-mod-validation.test.js
 └── out/test/unit/
      └── out/test/
           └── out/
                └── vscode-extension/
                     └── <repo-root>        ← example mod/ and data/ live here
```

```typescript
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
```

---

## 5. Test Infrastructure & File Discovery

### Files to Create

| File | Purpose |
|------|---------|
| `vscode-extension/src/test/unit/example-mod-validation.test.ts` | Main test file |
| `vscode-extension/src/test/unit/helpers/example-mod-helpers.ts` | Discovery utilities, URI mapping, code extraction, formatting helpers |

### ExampleFileEntry Interface

```typescript
interface ExampleFileEntry {
    /** Section directory name, e.g. "05_events" */
    sectionDir: string;
    /** File name, e.g. "bad_missing_namespace.txt" */
    fileName: string;
    /** Absolute path to the file */
    filePath: string;
    /** Whether the file should pass cleanly or produce specific errors */
    expectation: 'good' | 'bad';
}
```

### Discovery Logic

```typescript
function discoverExampleFiles(): ExampleFileEntry[] {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const exampleModDir = path.join(repoRoot, 'example mod');
    const entries: ExampleFileEntry[] = [];

    for (const sectionDir of fs.readdirSync(exampleModDir)) {
        const sectionPath = path.join(exampleModDir, sectionDir);
        if (!fs.statSync(sectionPath).isDirectory()) { continue; }
        if (!/^\d{2}_/.test(sectionDir)) { continue; }

        for (const fileName of fs.readdirSync(sectionPath)) {
            if (!fileName.endsWith('.txt') && !fileName.endsWith('.yml')) { continue; }

            const expectation = fileName.startsWith('good_') ? 'good'
                              : fileName.startsWith('bad_')  ? 'bad'
                              : null;
            if (!expectation) { continue; }

            entries.push({
                sectionDir,
                fileName,
                filePath: path.join(sectionPath, fileName),
                expectation,
            });
        }
    }

    return entries;
}
```

---

## 6. URI Mapping

Many validators only fire when the file URI contains specific path segments (e.g., the modifiers validator only runs for files whose URI contains `common/modifiers/`). The example mod section directories do not match CK3's standard directory layout, so we simulate realistic URIs.

### URI Mapping Table

| Section Directory | Simulated URI Path |
|---|---|
| `01_syntax/` | `file:///test/syntax/` |
| `02_semantic/` | `file:///common/scripted_triggers/` |
| `03_scopes/` | `file:///common/scripted_triggers/` |
| `04_style/` | `file:///common/` |
| `05_events/` | `file:///events/` |
| `06_story_cycles/` | `file:///common/story_cycles/` |
| `07_decisions/` | `file:///common/decisions/` |
| `08_interactions/` | `file:///common/character_interactions/` |
| `09_schemes/` | `file:///common/schemes/` |
| `10_on_actions/` | `file:///common/on_actions/` |
| `11_assets/` | `file:///events/` |
| `12_localization/` | `file:///localization/english/` |
| `13_call_hierarchy/` | `file:///events/` |
| `14_selection_range/` | `file:///events/` |
| `15_activities/` | `file:///common/activities/` |
| `16_traits/` | `file:///common/traits/` |
| `17_script_values/` | `file:///common/script_values/` |
| `18_modifiers/` | `file:///common/modifiers/` |
| `19_variables/` | `file:///events/` |
| `20_scripted_blocks/` | `file:///common/scripted_effects/` |
| `21_court_positions/` | `file:///common/court_positions/` |
| `22_casus_belli/` | `file:///common/casus_belli_types/` |
| `23_switch/` | `file:///events/` |
| `24_iterators/` | `file:///events/` |

### Helper Function

```typescript
const URI_MAP: Record<string, string> = {
    '01_syntax':          'file:///test/syntax/',
    '02_semantic':        'file:///common/scripted_triggers/',
    '03_scopes':          'file:///common/scripted_triggers/',
    '04_style':           'file:///common/',
    '05_events':          'file:///events/',
    '06_story_cycles':    'file:///common/story_cycles/',
    '07_decisions':       'file:///common/decisions/',
    '08_interactions':    'file:///common/character_interactions/',
    '09_schemes':         'file:///common/schemes/',
    '10_on_actions':      'file:///common/on_actions/',
    '11_assets':          'file:///events/',
    '12_localization':    'file:///localization/english/',
    '13_call_hierarchy':  'file:///events/',
    '14_selection_range': 'file:///events/',
    '15_activities':      'file:///common/activities/',
    '16_traits':          'file:///common/traits/',
    '17_script_values':   'file:///common/script_values/',
    '18_modifiers':       'file:///common/modifiers/',
    '19_variables':       'file:///events/',
    '20_scripted_blocks': 'file:///common/scripted_effects/',
    '21_court_positions': 'file:///common/court_positions/',
    '22_casus_belli':     'file:///common/casus_belli_types/',
    '23_switch':          'file:///events/',
    '24_iterators':       'file:///events/',
};

function getSimulatedUri(sectionDir: string, fileName: string): string {
    const base = URI_MAP[sectionDir];
    if (!base) {
        return `file:///test/${fileName}`;
    }
    return `${base}${fileName}`;
}
```

---

## 7. Error Code Extraction

`bad_*` files contain comments that declare which diagnostic codes are expected.

### Comment Format

```
# ERROR: CK3001
# ERROR: PARSE-001
# ERROR CONV-002
```

### Extraction Regex

```typescript
function extractExpectedCodes(content: string): Set<string> {
    const codes = new Set<string>();
    // Matches: optional whitespace, #, whitespace, ERROR, optional colon,
    // whitespace, then the code (uppercase letters + optional hyphen + digits)
    const regex = /^[\t ]*#\s*ERROR[:\s]+([A-Z]+-?\d+)/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        codes.add(match[1]);
    }
    return codes;
}
```

### Assertion Logic

Two distinct assertion modes based on file expectation:

**RELAXED mode (bad files):** Only verify that every expected code is present in the actual diagnostics. Unexpected extra codes do NOT fail the test. This prevents brittleness when new validators are added — a new validator may correctly produce additional diagnostics on existing bad files.

```typescript
// bad_* files — relaxed assertion
const expectedCodes = extractExpectedCodes(content);
const actualCodes = new Set(diagnostics.map(d => String(d.code)));

for (const code of expectedCodes) {
    assert.ok(actualCodes.has(code),
        `Missing expected diagnostic ${code}.\n` +
        `  Expected: [${[...expectedCodes].join(', ')}]\n` +
        `  Actual:   [${[...actualCodes].join(', ')}]`);
}
```

**STRICT mode (good files):** Assert zero diagnostics at Error or Warning severity. Info and Hint severity diagnostics are filtered out before the assertion. This prevents style hints and informational rules from causing false failures.

```typescript
// good_* files — strict assertion with severity filtering
const errors = diagnostics.filter(d =>
    d.severity === DiagnosticSeverity.Error ||
    d.severity === DiagnosticSeverity.Warning
);
assert.deepStrictEqual(errors, [],
    `Expected zero Error/Warning diagnostics for good file, got:\n${formatDiags(errors)}`);
```

---

## 8. Test Loop Design

A single `describe('Example Mod Validation')` block contains all tests. Files are grouped by section in nested `describe()` blocks. Each file gets one `it()` test case, executed sequentially. The `.txt` and `.yml` pipelines branch within the same loop — there is no separate `describe()` for localization `.yml` files.

### Imports

```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { CK3Parser } from '../../server/core/parser';
import { DiagnosticsEngine } from '../../server/ck3/validation/diagnostics';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { DataLoader } from '../../server/data/loader';
import { SchemaLoader } from '../../server/schema/loader';
import { LocalizationIndex } from '../../server/core/localization-index';
import { validateLocalizationContent } from '../../server/ck3/localization/validator';
```

### Shared Helpers

```typescript
function createDoc(content: string, uri: string = 'file:///test.txt'): TextDocument {
    return TextDocument.create(uri, 'ck3', 1, content);
}

function formatDiags(diagnostics: Diagnostic[]): string {
    return diagnostics.map(d =>
        `  ${d.code} [${severityLabel(d.severity)}] line ${d.range.start.line + 1}: ${d.message}`
    ).join('\n');
}

function severityLabel(severity: DiagnosticSeverity | undefined): string {
    switch (severity) {
        case DiagnosticSeverity.Error:       return 'Error';
        case DiagnosticSeverity.Warning:     return 'Warning';
        case DiagnosticSeverity.Information: return 'Info';
        case DiagnosticSeverity.Hint:        return 'Hint';
        default:                             return 'Unknown';
    }
}
```

### Full Test Loop

```typescript
describe('Example Mod Validation', () => {
    let schemaLoader: SchemaLoader;
    let locIndex: LocalizationIndex;
    const results: TestResult[] = [];

    before(async function () {
        this.timeout(10_000);

        const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
        const dataPath = path.join(repoRoot, 'data');

        // 1. DataLoader
        const dataLoader = DataLoader.getInstance(dataPath);
        await dataLoader.initialize(dataPath);

        // 2. SchemaLoader
        schemaLoader = new SchemaLoader();
        await schemaLoader.initialize();
        await schemaLoader.preloadCommonSchemas();

        // 3. LocalizationIndex
        locIndex = new LocalizationIndex();
        const exampleModDir = path.join(repoRoot, 'example mod');
        await locIndex.scanDirectory(exampleModDir);
    });

    after(() => {
        printSummaryTable(results);
        writeJsonReport(results);
    });

    const allEntries = discoverExampleFiles();
    const sections = [...new Set(allEntries.map(e => e.sectionDir))].sort();

    for (const section of sections) {
        describe(section, () => {
            const sectionEntries = allEntries.filter(e => e.sectionDir === section);

            for (const entry of sectionEntries) {
                it(`[${entry.expectation}] ${entry.fileName}`, async () => {
                    const content = fs.readFileSync(entry.filePath, 'utf-8');
                    const uri = getSimulatedUri(entry.sectionDir, entry.fileName);
                    let diagnostics: Diagnostic[];

                    if (entry.fileName.endsWith('.yml')) {
                        // Content-level localization pipeline
                        await locIndex.indexFile(entry.filePath);
                        diagnostics = validateLocalizationContent(content, uri);
                    } else {
                        // Standard parse + validate pipeline
                        const parser = new CK3Parser();
                        const parsed = parser.parse(content);
                        const doc = createDoc(content, uri);

                        const engine = new DiagnosticsEngine(
                            {},              // default config — all validators enabled
                            schemaLoader,
                            undefined,
                            locIndex
                        );
                        diagnostics = await engine.collectDiagnostics(
                            doc, [parsed.ast], parsed.errors
                        );
                    }

                    // Record result for reporting
                    const result: TestResult = {
                        section: entry.sectionDir,
                        fileName: entry.fileName,
                        expectation: entry.expectation,
                        status: 'pass',
                        actualCodes: diagnostics.map(d => String(d.code)),
                    };

                    if (entry.expectation === 'good') {
                        // Strict: zero Error/Warning (Info and Hint tolerated)
                        const errors = diagnostics.filter(d =>
                            d.severity === DiagnosticSeverity.Error ||
                            d.severity === DiagnosticSeverity.Warning
                        );
                        if (errors.length > 0) {
                            result.status = 'fail';
                            result.failureReason =
                                `Unexpected Error/Warning diagnostics:\n${formatDiags(errors)}`;
                        }
                        results.push(result);
                        assert.deepStrictEqual(errors, [],
                            `Expected zero Error/Warning diagnostics for good file, got:\n${formatDiags(errors)}`);
                    } else {
                        // Relaxed: every expected code must be present (extras OK)
                        const expectedCodes = extractExpectedCodes(content);
                        const actualCodes = new Set(diagnostics.map(d => String(d.code)));
                        const missingCodes: string[] = [];

                        for (const code of expectedCodes) {
                            if (!actualCodes.has(code)) {
                                missingCodes.push(code);
                            }
                        }

                        if (missingCodes.length > 0) {
                            result.status = 'fail';
                            result.expectedCodes = [...expectedCodes];
                            result.failureReason =
                                `Missing expected diagnostics: [${missingCodes.join(', ')}]\n` +
                                `  Expected: [${[...expectedCodes].join(', ')}]\n` +
                                `  Actual:   [${[...actualCodes].join(', ')}]`;
                        } else {
                            result.expectedCodes = [...expectedCodes];
                        }
                        results.push(result);

                        for (const code of expectedCodes) {
                            assert.ok(actualCodes.has(code),
                                `Missing expected diagnostic ${code}.\n` +
                                `  Expected: [${[...expectedCodes].join(', ')}]\n` +
                                `  Actual:   [${[...actualCodes].join(', ')}]`);
                        }
                    }
                });
            }
        });
    }
});
```

### Key Design Points

| Aspect | Approach |
|--------|----------|
| Config | Empty object `{}` — all `DiagnosticConfig` boolean flags default to `true` |
| .yml branching | `entry.fileName.endsWith('.yml')` → `LocalizationIndex` + `validateLocalizationContent` |
| .txt pipeline | `CK3Parser` → `DiagnosticsEngine.collectDiagnostics()` with full validator set |
| Good file assertion | Filter to Error/Warning severity only, assert empty array |
| Bad file assertion | Relaxed — check each expected code is present, ignore extras |
| Execution order | Sequential (Mocha default), one `it()` per file |
| Engine construction | Per-test — engines are cheap and carry no cross-test state |

---

## 9. Reporting

Two report outputs are produced after every test run: a console summary table printed to stdout and a JSON report file written to disk.

### TestResult Interface

```typescript
interface TestResult {
    section: string;
    fileName: string;
    expectation: 'good' | 'bad';
    status: 'pass' | 'fail';
    actualCodes: string[];
    expectedCodes?: string[];
    failureReason?: string;
}
```

### Console Summary Table

Printed in the `after()` hook after all tests complete. Groups results by section and shows totals.

```typescript
function printSummaryTable(results: TestResult[]): void {
    const total = results.length;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = total - passed;

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║        Example Mod Validation Summary            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Total: ${total}   Passed: ${passed}   Failed: ${failed}`.padEnd(51) + '║');
    console.log('╠══════════════════════════════════════════════════╣');

    const sections = [...new Set(results.map(r => r.section))].sort();
    for (const section of sections) {
        const sectionResults = results.filter(r => r.section === section);
        const sPass = sectionResults.filter(r => r.status === 'pass').length;
        const sFail = sectionResults.length - sPass;
        const indicator = sFail > 0 ? '✗' : '✓';
        console.log(`║  ${indicator} ${section}: ${sPass}/${sectionResults.length}`.padEnd(51) + '║');
    }

    console.log('╚══════════════════════════════════════════════════╝');

    if (failed > 0) {
        console.log('\nFailed files:');
        for (const r of results.filter(r => r.status === 'fail')) {
            console.log(`  ✗ ${r.section}/${r.fileName}`);
            if (r.failureReason) {
                console.log(`    ${r.failureReason.split('\n').join('\n    ')}`);
            }
        }
    }
}
```

### Example Console Output

```
╔══════════════════════════════════════════════════╗
║        Example Mod Validation Summary            ║
╠══════════════════════════════════════════════════╣
║  Total: 48   Passed: 47   Failed: 1             ║
╠══════════════════════════════════════════════════╣
║  ✓ 01_syntax: 4/4                               ║
║  ✓ 02_semantic: 3/3                              ║
║  ✗ 03_scopes: 2/3                                ║
║  ✓ 04_style: 2/2                                 ║
║  ...                                             ║
╚══════════════════════════════════════════════════╝

Failed files:
  ✗ 03_scopes/bad_invalid_scope_chain.txt
    Missing expected diagnostics: [SCOPE-004]
      Expected: [SCOPE-004, SCOPE-005]
      Actual:   [SCOPE-005]
```

### JSON Report File

Written to disk after each run for CI artifact collection and trend analysis.

```typescript
interface JsonReport {
    timestamp: string;
    totals: {
        total: number;
        passed: number;
        failed: number;
    };
    sections: Record<string, { total: number; passed: number; failed: number }>;
    files: Array<{
        section: string;
        fileName: string;
        expectation: 'good' | 'bad';
        status: 'pass' | 'fail';
        actualCodes: string[];
        expectedCodes?: string[];
        failureReason?: string;
    }>;
}

function writeJsonReport(results: TestResult[]): void {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const reportDir = path.join(repoRoot, 'vscode-extension', 'out', 'test-reports');

    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const total = results.length;
    const passed = results.filter(r => r.status === 'pass').length;

    const sections: Record<string, { total: number; passed: number; failed: number }> = {};
    for (const r of results) {
        if (!sections[r.section]) {
            sections[r.section] = { total: 0, passed: 0, failed: 0 };
        }
        sections[r.section].total++;
        if (r.status === 'pass') {
            sections[r.section].passed++;
        } else {
            sections[r.section].failed++;
        }
    }

    const report: JsonReport = {
        timestamp: new Date().toISOString(),
        totals: { total, passed, failed: total - passed },
        sections,
        files: results.map(r => ({
            section: r.section,
            fileName: r.fileName,
            expectation: r.expectation,
            status: r.status,
            actualCodes: r.actualCodes,
            expectedCodes: r.expectedCodes,
            failureReason: r.failureReason,
        })),
    };

    const reportPath = path.join(reportDir, 'example-mod-validation.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\nJSON report written to: ${reportPath}`);
}
```

### Example JSON Report

```json
{
  "timestamp": "2026-03-20T14:30:00.000Z",
  "totals": {
    "total": 48,
    "passed": 47,
    "failed": 1
  },
  "sections": {
    "01_syntax": { "total": 4, "passed": 4, "failed": 0 },
    "02_semantic": { "total": 3, "passed": 3, "failed": 0 },
    "03_scopes": { "total": 3, "passed": 2, "failed": 1 }
  },
  "files": [
    {
      "section": "01_syntax",
      "fileName": "good_basic_namespace.txt",
      "expectation": "good",
      "status": "pass",
      "actualCodes": []
    },
    {
      "section": "03_scopes",
      "fileName": "bad_invalid_scope_chain.txt",
      "expectation": "bad",
      "status": "fail",
      "actualCodes": ["SCOPE-005"],
      "expectedCodes": ["SCOPE-004", "SCOPE-005"],
      "failureReason": "Missing expected diagnostics: [SCOPE-004]"
    }
  ]
}
```

---

## 10. CI/Pre-commit Integration

The test file lives at `src/test/unit/example-mod-validation.test.ts`, which is already included by the glob patterns in the existing `test:unit` npm script (`'src/test/unit/**/*.test.ts'`). No changes to test runner configuration are needed.

### Taskfile.yml

| Task | Impact |
|------|--------|
| `precommit` | Already runs `test:unit` — no change needed, the glob picks up the new file |
| `ci` | Same — the CI pipeline runs `npm run test:unit`, which includes the new test |

### Optional Dedicated Script

Add to `vscode-extension/package.json` for focused runs:

```json
{
  "scripts": {
    "test:examples": "mocha --require ts-node/register 'src/test/unit/example-mod-validation.test.ts'"
  }
}
```

### Pre-commit Hook Verification

Confirm the new test runs in the pre-commit flow:

1. `task precommit` (or `npm run test:unit`) — should include example mod tests
2. Verify pass/fail behavior by temporarily breaking an example file

### CI Artifact Collection

The JSON report at `vscode-extension/out/test-reports/example-mod-validation.json` can be collected as a CI artifact for trend tracking. Add to `.github/workflows/ci.yml` if desired:

```yaml
- name: Upload example mod report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: example-mod-report-${{ matrix.os }}
    path: vscode-extension/out/test-reports/example-mod-validation.json
```

---

## 11. Dependencies

**No new npm dependencies are required.** The suite uses only modules already present in the project:

| Dependency | Source | Purpose |
|------------|--------|---------|
| `mocha` | devDependency | Test runner |
| `assert` | Node.js built-in | Assertions |
| `fs` | Node.js built-in | File reading, report writing |
| `path` | Node.js built-in | Path resolution |
| `vscode-languageserver-textdocument` | existing dependency | `TextDocument.create()` |
| `vscode-languageserver-protocol` | existing dependency | `DiagnosticSeverity` enum |
| `CK3Parser` | `src/server/core/parser.ts` | PDX script parser |
| `DiagnosticsEngine` | `src/server/ck3/validation/diagnostics.ts` | Validation pipeline |
| `DataLoader` | `src/server/data/loader.ts` | YAML data loader (singleton) |
| `SchemaLoader` | `src/server/schema/loader.ts` | Schema loader |
| `LocalizationIndex` | `src/server/core/localization-index.ts` | .yml parser and indexer |
| `validateLocalizationContent` | `src/server/ck3/localization/validator.ts` | Content-level localization validation |

---

## 12. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `vscode-extension/src/test/unit/example-mod-validation.test.ts` | Main test file with `before()` init, discovery, test loop, and reporting |
| `vscode-extension/src/test/unit/helpers/example-mod-helpers.ts` | `ExampleFileEntry`, `discoverExampleFiles()`, `getSimulatedUri()`, `extractExpectedCodes()`, `formatDiags()`, `severityLabel()`, `createDoc()`, reporting functions |

### Modified Files

| File | Change |
|------|--------|
| `vscode-extension/package.json` | Add `"test:examples"` npm script (optional) |

### No Changes Expected

| File | Reason |
|------|--------|
| `Taskfile.yml` | `test:unit` glob already covers new test file |
| `.github/workflows/ci.yml` | CI runs `npm test` which includes unit tests |
| `example mod/` | No changes to example files — the test reads them as-is |
| `vscode-extension/src/server/data/loader.ts` | No `reset()` needed — shared singleton accepted (Decision #2) |

---

*Last Updated: 2026-03-20*
