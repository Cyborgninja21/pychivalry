/**
 * Example Mod Validation Test Suite
 *
 * Validates every file in the `example mod/` directory against the Language
 * Server's DiagnosticsEngine. Good files must produce zero Error/Warning
 * diagnostics; bad files must contain all expected diagnostic codes annotated
 * via `# ERROR: CODE` comments.
 *
 * Runs as part of `npm run test:unit` — no VS Code host required.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { CK3Parser } from '../../server/core/parser';
import { DiagnosticsEngine } from '../../server/ck3/validation/diagnostics';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';
import { DataLoader } from '../../server/data/loader';
import { SchemaLoader } from '../../server/schema/loader';
import { LocalizationIndex, LocalizationEntry } from '../../server/core/localization-index';
import {
    validateLocalizationContent,
    DEFAULT_LOC_VALIDATION_CONFIG,
} from '../../server/ck3/localization/validator';
import {
    discoverExampleFiles,
    getSimulatedUri,
    extractExpectedCodes,
    createDoc,
    formatDiags,
    printSummaryTable,
    writeJsonReport,
    TestResult,
} from './helpers/example-mod-helpers';

/**
 * Parse a CK3 localization YAML string into LocalizationEntry objects.
 * Uses the same regex pattern as LocalizationIndex.indexFile().
 */
function parseLocalizationEntries(content: string, uri: string, filePath: string): LocalizationEntry[] {
    const entries: LocalizationEntry[] = [];
    const stripped = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    const lines = stripped.split('\n');
    const entryPattern = /^\s+([a-zA-Z_][a-zA-Z0-9_.]*):(\d+)\s+"(.*)"\s*$/;

    for (let i = 0; i < lines.length; i++) {
        const match = entryPattern.exec(lines[i]);
        if (match) {
            entries.push({
                key: match[1],
                text: match[3],
                fileUri: uri,
                filePath,
                line: i,
            });
        }
    }
    return entries;
}

describe('Example Mod Validation', () => {
    let schemaLoader: SchemaLoader;
    let locIndex: LocalizationIndex;
    const results: TestResult[] = [];

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

    after(() => {
        printSummaryTable(results);
        writeJsonReport(results);
    });

    const allEntries = discoverExampleFiles();
    const sections = [...new Set(allEntries.map((e) => e.sectionDir))].sort();

    for (const section of sections) {
        describe(section, () => {
            const sectionEntries = allEntries.filter((e) => e.sectionDir === section);

            for (const entry of sectionEntries) {
                it(`[${entry.expectation}] ${entry.fileName}`, async () => {
                    const content = fs.readFileSync(entry.filePath, 'utf-8');
                    const uri = getSimulatedUri(entry.sectionDir, entry.fileName);
                    let diagnostics: Diagnostic[];

                    if (entry.fileName.endsWith('.yml')) {
                        // Content-level localization pipeline
                        const locEntries = parseLocalizationEntries(
                            content,
                            uri,
                            entry.filePath
                        );
                        diagnostics = [];
                        for (const locEntry of locEntries) {
                            diagnostics.push(
                                ...validateLocalizationContent(
                                    locEntry,
                                    DEFAULT_LOC_VALIDATION_CONFIG
                                )
                            );
                        }
                    } else {
                        // Standard parse + validate pipeline
                        const parser = new CK3Parser();
                        const parsed = parser.parse(content);
                        const doc = createDoc(content, uri);

                        const engine = new DiagnosticsEngine(
                            {}, // default config — all validators enabled
                            schemaLoader,
                            undefined,
                            locIndex
                        );
                        diagnostics = await engine.collectDiagnostics(
                            doc,
                            [parsed.ast],
                            parsed.errors
                        );
                    }

                    // Record result for reporting
                    const result: TestResult = {
                        section: entry.sectionDir,
                        fileName: entry.fileName,
                        expectation: entry.expectation,
                        status: 'pass',
                        actualCodes: diagnostics.map((d) => String(d.code)),
                    };

                    if (entry.expectation === 'good') {
                        // Strict: zero Error/Warning (Info and Hint tolerated)
                        const errors = diagnostics.filter(
                            (d) =>
                                d.severity === DiagnosticSeverity.Error ||
                                d.severity === DiagnosticSeverity.Warning
                        );
                        if (errors.length > 0) {
                            result.status = 'fail';
                            result.failureReason =
                                `Unexpected Error/Warning diagnostics:\n${formatDiags(errors)}`;
                        }
                        results.push(result);
                        assert.deepStrictEqual(
                            errors,
                            [],
                            `Expected zero Error/Warning diagnostics for good file, got:\n${formatDiags(errors)}`
                        );
                    } else {
                        // Relaxed: every expected code must be present (extras OK)
                        const expectedCodes = extractExpectedCodes(content);
                        const actualCodes = new Set(diagnostics.map((d) => String(d.code)));
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
                            assert.ok(
                                actualCodes.has(code),
                                `Missing expected diagnostic ${code}.\n` +
                                    `  Expected: [${[...expectedCodes].join(', ')}]\n` +
                                    `  Actual:   [${[...actualCodes].join(', ')}]`
                            );
                        }
                    }
                });
            }
        });
    }
});
