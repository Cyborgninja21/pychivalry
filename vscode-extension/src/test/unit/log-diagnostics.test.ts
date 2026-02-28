/**
 * Unit Tests for Log Diagnostics Converter
 */

import * as assert from 'assert';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { LogDiagnosticConverter } from '../../server/log/diagnostics';
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

// Minimal mock connection for tests
function mockConnection(): any {
    const published: Array<{ uri: string; diagnostics: any[] }> = [];
    return {
        sendDiagnostics: (params: { uri: string; diagnostics: any[] }) => {
            published.push(params);
        },
        _published: published,
    };
}

describe('LogDiagnosticConverter', () => {

    describe('convertToDiagnostic()', () => {
        it('creates a diagnostic from a result with source location', () => {
            const conn = mockConnection();
            const converter = new LogDiagnosticConverter(conn, []);
            const diag = converter.convertToDiagnostic(makeResult());
            assert.ok(diag, 'Should produce a diagnostic');
            assert.strictEqual(diag!.source, 'ck3-game-log');
            assert.strictEqual(diag!.code, 'GAME_LOG_UNKNOWN_EFFECT');
            assert.ok(diag!.message.includes('[Game Log]'));
            // Line should be 0-indexed (45 → 44)
            assert.strictEqual(diag!.range.start.line, 44);
        });

        it('returns null when source file is missing', () => {
            const conn = mockConnection();
            const converter = new LogDiagnosticConverter(conn, []);
            const diag = converter.convertToDiagnostic(makeResult({ sourceFile: undefined }));
            assert.strictEqual(diag, null);
        });

        it('returns null when line number is missing', () => {
            const conn = mockConnection();
            const converter = new LogDiagnosticConverter(conn, []);
            const diag = converter.convertToDiagnostic(makeResult({ lineNumber: undefined }));
            assert.strictEqual(diag, null);
        });

        it('attaches suggestions as data', () => {
            const conn = mockConnection();
            const converter = new LogDiagnosticConverter(conn, []);
            const diag = converter.convertToDiagnostic(makeResult());
            assert.ok((diag as any).data);
            assert.deepStrictEqual((diag as any).data.suggestions, ['add_gold']);
        });
    });

    describe('clearAllLogDiagnostics()', () => {
        it('sends empty diagnostics for all tracked URIs', () => {
            const conn = mockConnection();
            const converter = new LogDiagnosticConverter(conn, []);

            // Publish some diagnostics first
            const diag = converter.convertToDiagnostic(makeResult());
            converter.publishDiagnostics('file:///test.txt', [diag!]);

            // Clear
            converter.clearAllLogDiagnostics();

            // Should have sent empty diagnostics
            const cleared = conn._published.filter((p: any) => p.diagnostics.length === 0);
            assert.ok(cleared.length > 0, 'Should send empty diagnostics');
        });
    });
});
