/**
 * Background validation in the Extension Development Host (post-2.0 Phase 1, #86): the
 * server validates the whole test workspace after startup, so a file that was never
 * opened has diagnostics in the Problems panel, and ck3.validateWorkspace forces a pass.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CK3ExtensionApi } from '../../extension';
import type { ValidateWorkspaceResult } from '../../client/commands';

const SOURCES = new Set(['ck3-engine', 'ck3-plugin']);

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

suite('Background validation', () => {
    let api: CK3ExtensionApi;
    let target: vscode.Uri;

    suiteSetup(async function () {
        this.timeout(120000);
        const extension = vscode.extensions.getExtension<CK3ExtensionApi>(
            'cyborgninja21.ck3-language-support'
        );
        assert.ok(extension, 'Extension should be installed');
        api = extension.isActive ? extension.exports : await extension.activate();
        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'the test workspace is open');
        target = vscode.Uri.joinPath(folder.uri, 'events', 'test_events.txt');
        await withTimeout(api.health.whenFirstFullResult(), 100000, 'the first full pass');
    });

    test('a file that was never opened has diagnostics after the first pass', () => {
        assert.ok(
            !vscode.workspace.textDocuments.some((d) => d.uri.toString() === target.toString()),
            'events/test_events.txt must not be open'
        );
        const diagnostics = vscode.languages
            .getDiagnostics(target)
            .filter((d) => typeof d.source === 'string' && SOURCES.has(d.source));
        assert.ok(diagnostics.length > 0, 'background diagnostics for events/test_events.txt');
        assert.ok(
            diagnostics.some((d) => d.severity === vscode.DiagnosticSeverity.Error),
            'the file has error-severity findings'
        );
        const counts = api.health.countsOf(target.toString());
        assert.ok(counts && counts.errors > 0, 'the client counts match the published result');
    });

    test('the Explorer decoration of the never-opened file shows its errors (#87)', () => {
        const counts = api.health.countsOf(target.toString());
        assert.ok(counts);
        const decoration = api.decorations.provideFileDecoration(target);
        assert.ok(decoration, 'a decoration for events/test_events.txt');
        assert.strictEqual(decoration.badge, counts.errors > 9 ? '9+' : String(counts.errors));
        assert.strictEqual(decoration.color?.id, 'list.errorForeground');
        assert.strictEqual(decoration.propagate, true);
        const readme = vscode.Uri.joinPath(target, '..', '..', 'README.md');
        assert.strictEqual(api.decorations.provideFileDecoration(readme), undefined);
    });

    test('the status bar shows the workspace totals once idle (#84)', () => {
        const summary = api.health.summary();
        assert.strictEqual(
            api.healthStatusBar.text,
            `$(error) ${summary.errors} $(warning) ${summary.warnings}`
        );
    });

    test('the run state reached idle with every file done', () => {
        const state = api.health.lastState;
        assert.ok(state, 'a state event arrived');
        assert.strictEqual(state.state, 'idle');
        assert.strictEqual(state.done, state.total);
        assert.ok(state.total >= 4, `files validated: ${state.total}`);
        assert.ok(typeof state.maxRssKb === 'number' && state.maxRssKb > 0);
        assert.ok(typeof state.firstFullResultMs === 'number');
        const summary = api.health.summary();
        assert.ok(summary.errors > 0 && summary.filesAffected > 0);
    });

    test('ck3LanguageServer.validateWorkspace forces a full pass and returns the counts', async function () {
        this.timeout(60000);
        const result = (await vscode.commands.executeCommand(
            'ck3LanguageServer.validateWorkspace'
        )) as ValidateWorkspaceResult | undefined;
        assert.ok(result, 'the command returned a result');
        assert.ok(result.files >= 4, `files: ${result.files}`);
        assert.ok(result.errors > 0);
        assert.strictEqual(result.cancelled, false);
        assert.ok(result.milliseconds >= 0);
    });
});
