/**
 * Server-side background validation helpers (server/background.ts).
 */

import * as assert from 'assert';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { countDiagnostics, isBackgroundFile } from '../../server/background';

const at = (severity: DiagnosticSeverity): Diagnostic => ({
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    message: 'm',
    severity,
});

describe('Background validation helpers', () => {
    it('counts diagnostics by severity (hints are not counted)', () => {
        const counts = countDiagnostics('file:///m/a.txt', [
            at(DiagnosticSeverity.Error),
            at(DiagnosticSeverity.Error),
            at(DiagnosticSeverity.Warning),
            at(DiagnosticSeverity.Information),
            at(DiagnosticSeverity.Hint),
        ]);
        assert.deepStrictEqual(counts, {
            uri: 'file:///m/a.txt',
            errors: 2,
            warnings: 1,
            information: 1,
        });
    });

    it('validates script .txt and localization files, not GUI files', () => {
        assert.strictEqual(isBackgroundFile('/m/events/a.txt'), true);
        assert.strictEqual(isBackgroundFile('/m/common/X.TXT'), true);
        assert.strictEqual(isBackgroundFile('/m/localization/english/a_l_english.yml'), true);
        assert.strictEqual(isBackgroundFile('/m/gui/window.gui'), false);
        assert.strictEqual(isBackgroundFile('/m/gfx/x.gfx'), false);
        assert.strictEqual(isBackgroundFile('/m/notes.yml'), false);
    });
});
