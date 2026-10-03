/**
 * Issue #59: the CK3: Index output channel receives the language server's indexing messages
 * (`ck3/indexLog`, `ck3/indexLog/bulk`), on start-up (workspace initialization, indexing,
 * base game) and on a rescan. An output channel cannot be read back through the VS Code
 * API, so the test reads the lines the client's logger wrote to the channel
 * (CK3ExtensionApi.logs, logger.lines()).
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CK3ExtensionApi } from '../../extension';
import { LogCategory } from '../../logger';

async function api(): Promise<CK3ExtensionApi> {
    const extension = vscode.extensions.getExtension<CK3ExtensionApi>(
        'cyborgninja21.ck3-language-support'
    );
    assert.ok(extension, 'Extension should be installed');
    return extension.isActive ? extension.exports : await extension.activate();
}

/** Wait until `done` accepts the Index channel's lines. */
async function indexLines(
    logs: CK3ExtensionApi['logs'],
    done: (lines: readonly string[]) => boolean,
    ms = 60_000
): Promise<readonly string[]> {
    const until = Date.now() + ms;
    let lines = logs.lines(LogCategory.Index);
    while (!done(lines) && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        lines = logs.lines(LogCategory.Index);
    }
    return lines;
}

function indexOf(lines: readonly string[], pattern: RegExp, from = 0): number {
    for (let i = from; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
            return i;
        }
    }
    return -1;
}

suite('CK3: Index output channel (#59)', () => {
    test('receives the start-up indexing messages', async function () {
        this.timeout(90_000);
        const { logs } = await api();
        const lines = await indexLines(logs, (l) =>
            l.some((x) => x.includes('Workspace initialized successfully'))
        );
        // In the order the server sends them (server.ts initializeWorkspace, commands.ts).
        const steps = [
            /\] Initializing workspace\.\.\.$/,
            /\] CK3 spec package \d+\.\d+\.\d+\.\d+ loaded$/,
            /\] Game data loaded$/,
            /\] Scanning workspace folder: test-workspace$/,
            /\] Found \d+ CK3 files in test-workspace$/,
            /\] Indexed \d+ files$/,
            /\] (Base game loaded: \d+ files from .* in \d+ ms|No CK3 game directory found .*)$/,
            /\] Workspace initialized successfully$/,
        ];
        let at = 0;
        for (const step of steps) {
            const found = indexOf(lines, step, at);
            assert.ok(found >= 0, `${step} after line ${at}:\n${lines.join('\n')}`);
            at = found + 1;
        }
    });

    test('receives the rescan messages, single and bulk', async function () {
        this.timeout(90_000);
        const { logs } = await api();
        const before = logs.lines(LogCategory.Index).length;
        await vscode.commands.executeCommand('ck3LanguageServer.rescanWorkspace');
        const lines = await indexLines(logs, (l) =>
            l.slice(before).some((x) => /^Workspace rescan complete: \d+ files indexed$/.test(x))
        );
        const added = lines.slice(before);
        const start = indexOf(added, /\] Starting workspace rescan\.\.\.$/);
        assert.ok(start >= 0, added.join('\n'));
        assert.ok(indexOf(added, /\] Found \d+ CK3 files in test-workspace$/, start) > start);
        // ck3/indexLog/bulk: lines without a timestamp, appended as sent.
        const done = indexOf(added, /^Workspace rescan complete: \d+ files indexed$/, start);
        assert.ok(done > start, added.join('\n'));
        assert.match(added[done + 1] ?? '', /^(No errors|\d+ file\(s\) had errors)$/);
    });
});
