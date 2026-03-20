/**
 * Helper utilities for the Example Mod Validation Test Suite.
 *
 * Files live in a mock CK3 mod directory at:
 *   vscode-extension/src/test/fixtures/mock-ck3-mod/
 *
 * The mock mod mirrors a real CK3 mod layout (events/, common/decisions/,
 * common/schemes/, localization/english/, etc.) so path-based validators
 * fire correctly without any URI simulation.
 *
 * Provides file discovery, error-code extraction, diagnostic formatting,
 * and reporting functions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ExampleFileEntry {
    /** CK3 directory within the mock mod, e.g. "events" or "common/decisions" */
    sectionDir: string;
    /** File name, e.g. "bad_syntax.txt" */
    fileName: string;
    /** Absolute path to the file */
    filePath: string;
    /** Whether the file should pass cleanly or produce specific errors */
    expectation: 'good' | 'bad';
}

export interface TestResult {
    section: string;
    fileName: string;
    expectation: 'good' | 'bad';
    status: 'pass' | 'fail';
    actualCodes: string[];
    expectedCodes?: string[];
    failureReason?: string;
}

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

// ---------------------------------------------------------------------------
// Mock Mod Root
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute path to the mock CK3 mod fixture directory.
 *
 * At runtime (compiled JS in out/test/unit/helpers/), __dirname is:
 *   <repo>/vscode-extension/out/test/unit/helpers
 * We need:
 *   <repo>/vscode-extension/src/test/fixtures/mock-ck3-mod
 */
export function getMockModRoot(): string {
    // Walk up from out/test/unit/helpers → out/test/unit → out/test → out → vscode-extension
    const vsCodeExtRoot = path.resolve(__dirname, '..', '..', '..', '..');
    return path.join(vsCodeExtRoot, 'src', 'test', 'fixtures', 'mock-ck3-mod');
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * CK3 content directories to scan for test files.
 * Each entry is a relative path within the mock mod root.
 */
const CK3_CONTENT_DIRS = [
    'events',
    'common/decisions',
    'common/character_interactions',
    'common/story_cycles',
    'common/schemes',
    'common/on_actions',
    'common/activities',
    'common/traits',
    'common/script_values',
    'common/modifiers',
    'common/scripted_effects',
    'common/scripted_triggers',
    'common/court_positions',
    'common/casus_belli_types',
    'localization/english',
];

export function discoverExampleFiles(): ExampleFileEntry[] {
    const mockModRoot = getMockModRoot();
    const entries: ExampleFileEntry[] = [];

    for (const ck3Dir of CK3_CONTENT_DIRS) {
        const dirPath = path.join(mockModRoot, ck3Dir);
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            continue;
        }

        for (const fileName of fs.readdirSync(dirPath)) {
            if (!fileName.endsWith('.txt') && !fileName.endsWith('.yml')) {
                continue;
            }

            const expectation = fileName.startsWith('good_')
                ? 'good'
                : fileName.startsWith('bad_')
                  ? 'bad'
                  : null;
            if (!expectation) {
                continue;
            }

            entries.push({
                sectionDir: ck3Dir,
                fileName,
                filePath: path.join(dirPath, fileName),
                expectation,
            });
        }
    }

    return entries;
}

// ---------------------------------------------------------------------------
// URI Helpers
// ---------------------------------------------------------------------------

/**
 * Build a file:// URI from the real file path inside the mock mod.
 * Since files already live in the correct CK3 directory structure,
 * the URI naturally contains the path segments that validators check.
 */
export function getFileUri(filePath: string): string {
    // Use the real absolute path — validators check for path segments like
    // /events/, /common/decisions/, /common/schemes/ etc.
    return `file://${filePath.replace(/\\/g, '/')}`;
}

// ---------------------------------------------------------------------------
// Error Code Extraction
// ---------------------------------------------------------------------------

export function extractExpectedCodes(content: string): Set<string> {
    const codes = new Set<string>();
    // Matches: optional whitespace, #, whitespace, ERROR, optional colon,
    // whitespace, then the code (uppercase letters/underscores + optional hyphen + digits)
    const regex = /^[\t ]*#\s*ERROR[:\s]+([A-Z][A-Z_]*-?\d+)/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        codes.add(match[1]);
    }
    return codes;
}

// ---------------------------------------------------------------------------
// Document Helpers
// ---------------------------------------------------------------------------

export function createDoc(content: string, uri: string = 'file:///test.txt'): TextDocument {
    return TextDocument.create(uri, 'ck3', 1, content);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatDiags(diagnostics: Diagnostic[]): string {
    return diagnostics
        .map(
            (d) =>
                `  ${d.code} [${severityLabel(d.severity)}] line ${d.range.start.line + 1}: ${d.message}`
        )
        .join('\n');
}

export function severityLabel(severity: DiagnosticSeverity | undefined): string {
    switch (severity) {
        case DiagnosticSeverity.Error:
            return 'Error';
        case DiagnosticSeverity.Warning:
            return 'Warning';
        case DiagnosticSeverity.Information:
            return 'Info';
        case DiagnosticSeverity.Hint:
            return 'Hint';
        default:
            return 'Unknown';
    }
}

// ---------------------------------------------------------------------------
// Reporting — Console Summary
// ---------------------------------------------------------------------------

export function printSummaryTable(results: TestResult[]): void {
    const total = results.length;
    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = total - passed;

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║        Example Mod Validation Summary            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Total: ${total}   Passed: ${passed}   Failed: ${failed}`.padEnd(51) + '║');
    console.log('╠══════════════════════════════════════════════════╣');

    const sections = [...new Set(results.map((r) => r.section))].sort();
    for (const section of sections) {
        const sectionResults = results.filter((r) => r.section === section);
        const sPass = sectionResults.filter((r) => r.status === 'pass').length;
        const sFail = sectionResults.length - sPass;
        const indicator = sFail > 0 ? '✗' : '✓';
        console.log(`║  ${indicator} ${section}: ${sPass}/${sectionResults.length}`.padEnd(51) + '║');
    }

    console.log('╚══════════════════════════════════════════════════╝');

    if (failed > 0) {
        console.log('\nFailed files:');
        for (const r of results.filter((r) => r.status === 'fail')) {
            console.log(`  ✗ ${r.section}/${r.fileName}`);
            if (r.failureReason) {
                console.log(`    ${r.failureReason.split('\n').join('\n    ')}`);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Reporting — JSON
// ---------------------------------------------------------------------------

export function writeJsonReport(results: TestResult[]): void {
    // Walk from out/test/unit/helpers → vscode-extension root
    const vsCodeExtRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const reportDir = path.join(vsCodeExtRoot, 'out', 'test-reports');

    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const total = results.length;
    const passed = results.filter((r) => r.status === 'pass').length;

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
        files: results.map((r) => ({
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
