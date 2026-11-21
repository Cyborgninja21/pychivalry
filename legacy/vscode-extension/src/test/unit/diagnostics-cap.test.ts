/**
 * The per-file cap of the diagnostics provider (2.2): over the cap, errors are kept first,
 * then warnings, information and hints, and the kept set is published in position order.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToUri, Workspace } from 'pychivalry-engine';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { capDiagnostics, DiagnosticsProvider, MAX_DIAGNOSTICS } from '../../server/lsp/diagnostics';
import { enginePlugins } from '../../server/plugins';

function diag(line: number, severity: DiagnosticSeverity): Diagnostic {
    return {
        range: { start: { line, character: 0 }, end: { line, character: 1 } },
        severity,
        message: String(line),
    };
}

describe('Diagnostics provider: the per-file cap keeps the most severe findings', () => {
    let root: string;
    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-cap-'));
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it('1,200 hint-level findings and one engine error at the end: 1,000 published, the error among them', () => {
        // 1,200 lines with a trailing space (CK3304, hint), then an unknown effect (error).
        const lines = Array.from({ length: 1200 }, (_, i) => `a_${i} = b `);
        lines.push('my_effect = { not_an_effect_at_all = yes }');
        const text = lines.join('\n') + '\n';
        const file = path.join(root, 'common', 'scripted_effects', 'cap.txt');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
        const workspace = new Workspace(root).load();
        const provider = new DiagnosticsProvider(workspace, enginePlugins({ workspace }));
        const published = provider.diagnoseText(pathToUri(file), text);
        assert.strictEqual(published.length, MAX_DIAGNOSTICS);
        const errors = published.filter((d) => d.severity === DiagnosticSeverity.Error);
        assert.deepStrictEqual(
            errors.map((d) => [d.code, d.range.start.line]),
            [['unknown_effect_X', 1200]]
        );
        // Published in position order: the error (last line) comes last.
        assert.strictEqual(published[published.length - 1].code, 'unknown_effect_X');
        for (let i = 1; i < published.length; i++) {
            assert.ok(published[i - 1].range.start.line <= published[i].range.start.line);
        }
    });

    it('keeps errors, then warnings, then information, then hints, each by position', () => {
        const input = [
            ...Array.from({ length: 5 }, (_, i) => diag(i, DiagnosticSeverity.Hint)),
            diag(10, DiagnosticSeverity.Information),
            diag(11, DiagnosticSeverity.Warning),
            diag(12, DiagnosticSeverity.Error),
        ];
        assert.deepStrictEqual(
            capDiagnostics(input, 4).map((d) => d.range.start.line),
            [0, 10, 11, 12]
        );
    });

    it('a list under the cap is returned unchanged', () => {
        const input = [
            diag(3, DiagnosticSeverity.Hint),
            diag(1, DiagnosticSeverity.Error),
            diag(2, DiagnosticSeverity.Warning),
        ];
        assert.strictEqual(capDiagnostics(input), input);
        assert.deepStrictEqual(
            capDiagnostics(input).map((d) => d.range.start.line),
            [3, 1, 2]
        );
    });
});
