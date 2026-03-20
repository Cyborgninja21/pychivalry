/**
 * Helper utilities for the Example Mod Validation Test Suite.
 *
 * Provides file discovery, URI mapping, error-code extraction,
 * diagnostic formatting, and reporting functions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ExampleFileEntry {
    /** Section directory name, e.g. "05_events" */
    sectionDir: string;
    /** File name, e.g. "bad_missing_namespace.txt" */
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
// URI Mapping
// ---------------------------------------------------------------------------

const URI_MAP: Record<string, string> = {
    // Sections that contain event definitions → events/ directory
    '01_syntax': 'file:///mod/events/',
    '02_semantic': 'file:///mod/events/',
    '03_scopes': 'file:///mod/events/',
    '04_style': 'file:///mod/events/',
    '05_events': 'file:///mod/events/',
    '11_assets': 'file:///mod/events/',
    '16_traits': 'file:///mod/events/',
    '19_variables': 'file:///mod/events/',
    '23_switch': 'file:///mod/events/',
    '24_iterators': 'file:///mod/events/',
    // Sections with specific CK3 content types → proper common/ subdirectory
    '06_story_cycles': 'file:///mod/common/story_cycles/',
    '07_decisions': 'file:///mod/common/decisions/',
    '08_interactions': 'file:///mod/common/character_interactions/',
    '09_schemes': 'file:///mod/common/schemes/',
    '10_on_actions': 'file:///mod/common/on_actions/',
    '15_activities': 'file:///mod/common/activities/',
    '17_script_values': 'file:///mod/common/script_values/',
    '18_modifiers': 'file:///mod/common/modifiers/',
    '20_scripted_blocks': 'file:///mod/common/scripted_effects/',
    '21_court_positions': 'file:///mod/common/court_positions/',
    '22_casus_belli': 'file:///mod/common/casus_belli_types/',
    // Other sections
    '12_localization': 'file:///mod/localization/english/',
    '13_call_hierarchy': 'file:///mod/events/',
    '14_selection_range': 'file:///mod/events/',
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function discoverExampleFiles(): ExampleFileEntry[] {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
    const exampleModDir = path.join(repoRoot, 'example mod');
    const entries: ExampleFileEntry[] = [];

    for (const sectionDir of fs.readdirSync(exampleModDir)) {
        const sectionPath = path.join(exampleModDir, sectionDir);
        if (!fs.statSync(sectionPath).isDirectory()) {
            continue;
        }
        if (!/^\d{2}_/.test(sectionDir)) {
            continue;
        }

        for (const fileName of fs.readdirSync(sectionPath)) {
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
                sectionDir,
                fileName,
                filePath: path.join(sectionPath, fileName),
                expectation,
            });
        }
    }

    return entries;
}

// ---------------------------------------------------------------------------
// URI Helpers
// ---------------------------------------------------------------------------

export function getSimulatedUri(sectionDir: string, fileName: string): string {
    const base = URI_MAP[sectionDir];
    if (!base) {
        return `file:///test/${fileName}`;
    }
    return `${base}${fileName}`;
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
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
    const reportDir = path.join(repoRoot, 'vscode-extension', 'out', 'test-reports');

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
