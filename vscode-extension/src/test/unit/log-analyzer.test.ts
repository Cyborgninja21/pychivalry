/**
 * Unit Tests for CK3 Log Analyzer
 */

import * as assert from 'assert';
import { CK3LogAnalyzer } from '../../server/log/analyzer';

describe('CK3LogAnalyzer', () => {

    let analyzer: CK3LogAnalyzer;

    beforeEach(() => {
        analyzer = new CK3LogAnalyzer();
    });

    describe('analyzeLine()', () => {
        it('returns null for non-matching lines', () => {
            const result = analyzer.analyzeLine('Just a normal log line', 'game.log');
            assert.strictEqual(result, null);
        });

        it('matches unknown effect pattern', () => {
            const result = analyzer.analyzeLine("Unknown effect: add_glod", 'error.log');
            assert.ok(result, 'Should match unknown effect');
            assert.strictEqual(result!.category, 'unknown_effect');
            assert.ok(result!.message.includes('add_glod'));
        });

        it('matches unknown trigger pattern', () => {
            const result = analyzer.analyzeLine("Unknown trigger: 'has_trat'", 'error.log');
            assert.ok(result, 'Should match unknown trigger');
            assert.strictEqual(result!.category, 'unknown_trigger');
        });

        it('matches script system error', () => {
            const result = analyzer.analyzeLine('[12:00:00][E][game.cpp:123]: Script system error!', 'error.log');
            assert.ok(result);
            assert.strictEqual(result!.category, 'script_system_error');
        });

        it('matches scope error', () => {
            const result = analyzer.analyzeLine('Invalid scope transition from character to title', 'error.log');
            assert.ok(result);
            assert.strictEqual(result!.category, 'scope_error');
        });

        it('matches missing event', () => {
            const result = analyzer.analyzeLine('Event my_mod.0001 not found', 'error.log');
            assert.ok(result);
            assert.strictEqual(result!.category, 'missing_event');
        });

        it('matches missing localization', () => {
            const result = analyzer.analyzeLine("Missing localization key: 'my_event.title'", 'game.log');
            assert.ok(result);
            assert.strictEqual(result!.category, 'missing_localization');
        });

        it('matches duplicate definition', () => {
            const result = analyzer.analyzeLine("Duplicate scripted_effect definition 'my_effect'", 'error.log');
            assert.ok(result);
            assert.strictEqual(result!.category, 'duplicate_definition');
        });
    });

    describe('location extraction', () => {
        it('extracts file and line from pattern 1', () => {
            const result = analyzer.analyzeLine(
                "Unknown effect: add_glod in file 'events/my_event.txt' line 45",
                'error.log',
            );
            assert.ok(result);
            assert.strictEqual(result!.sourceFile, 'events/my_event.txt');
            assert.strictEqual(result!.lineNumber, 45);
        });

        it('extracts file and line from pattern 3 (path:line)', () => {
            const result = analyzer.analyzeLine(
                "Unknown effect: add_glod events/my_event.txt:99",
                'error.log',
            );
            assert.ok(result);
            assert.strictEqual(result!.sourceFile, 'events/my_event.txt');
            assert.strictEqual(result!.lineNumber, 99);
        });
    });

    describe('analyzeBatch()', () => {
        it('returns results for matching lines only', () => {
            const lines = [
                'Normal line 1',
                "Unknown effect: add_glod",
                'Normal line 2',
                'Event my_mod.0001 not found',
            ];
            const results = analyzer.analyzeBatch(lines, 'error.log');
            assert.strictEqual(results.length, 2);
        });

        it('returns empty array for empty input', () => {
            const results = analyzer.analyzeBatch([], 'error.log');
            assert.strictEqual(results.length, 0);
        });
    });

    describe('statistics', () => {
        it('tracks total lines processed', () => {
            analyzer.analyzeLine('line 1', 'game.log');
            analyzer.analyzeLine('line 2', 'game.log');
            const stats = analyzer.getStatistics();
            assert.strictEqual(stats.totalLinesProcessed, 2);
        });

        it('tracks error counts by category', () => {
            analyzer.analyzeLine("Unknown effect: foo", 'error.log');
            analyzer.analyzeLine("Unknown effect: bar", 'error.log');
            const stats = analyzer.getStatistics();
            assert.strictEqual(stats.errorsByCategory['unknown_effect'], 2);
        });

        it('resets statistics', () => {
            analyzer.analyzeLine("Unknown effect: foo", 'error.log');
            analyzer.resetStatistics();
            const stats = analyzer.getStatistics();
            assert.strictEqual(stats.totalLinesProcessed, 0);
            assert.strictEqual(stats.totalErrors, 0);
        });

        it('computes most common errors', () => {
            analyzer.analyzeLine("Unknown effect: foo", 'error.log');
            analyzer.analyzeLine("Unknown trigger: bar", 'error.log');
            analyzer.analyzeLine("Unknown effect: baz", 'error.log');
            const stats = analyzer.getStatistics();
            assert.ok(stats.mostCommonErrors.length > 0);
            assert.strictEqual(stats.mostCommonErrors[0][0], 'unknown_effect');
        });
    });
});
