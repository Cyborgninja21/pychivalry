/**
 * The `corpus` editor suite (`task vscode:corpus`, local only: it needs the game and the mod
 * corpus): the packaged extension opened on one real mod with the game folder set and every
 * other setting at its default, as release 2.3.0's editor baseline was measured
 * (`records/baseline-2.3.0/speed-editor.json`):
 *
 * - the time from the extension's activation to the language server's first full result (the
 *   first background pass that leaves nothing to check), and the server's peak resident memory
 *   at that moment (`process.resourceUsage().maxRSS`), written to `PYCHIVALRY_CORPUS_OUT`;
 * - when `PYCHIVALRY_CORPUS_COMPARE` is `1`, the same-answers test on the mod (item 7.9) and
 *   its formatting half (item 8.9), their counts written beside them.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as vscode from 'vscode';
import type { PychivalryApi } from '../extension.js';
import { given, type EditorCase } from './harness.js';
import { activeExtension, displayCase } from './main.js';
import { assertSameAnswers, assertSameFormatting } from './same.js';

function writeOut(file: string, add: Record<string, unknown>): void {
    const before = existsSync(file)
        ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>)
        : {};
    writeFileSync(file, `${JSON.stringify({ ...before, ...add }, null, 2)}\n`);
}

export function corpusCases(): readonly EditorCase[] {
    const mod = given('PYCHIVALRY_TEST_MOD');
    const game = given('PYCHIVALRY_TEST_GAME');
    const work = given('PYCHIVALRY_TEST_WORK');
    const out = given('PYCHIVALRY_CORPUS_OUT');
    let api: PychivalryApi | undefined;
    const cases: EditorCase[] = [
        displayCase(),
        {
            name: "the time to the first full result, and the language server's peak memory",
            run: async () => {
                api = (await activeExtension()).exports;
                const full = await api.language.firstFullResult;
                writeOut(out, {
                    vscode: vscode.version,
                    time_to_first_full_result_ms: full.at - api.activatedAt,
                    server_since_start_ms: full.done.sinceStartMs,
                    background_pass_ms: full.done.ms,
                    server_peak_rss_kib: full.done.peakRssKib,
                    files_checked: full.done.checked,
                    files_total: full.done.total,
                    limited: full.done.limited,
                });
            },
        },
    ];
    if (process.env['PYCHIVALRY_CORPUS_COMPARE'] === '1') {
        cases.push({
            name: '7.9: the editor, the command line and the agent server give the same findings',
            run: async () => {
                assert.ok(api !== undefined, 'the extension did not activate');
                const report = await assertSameAnswers(api, mod, game, work);
                writeOut(out, { same_answers: report });
            },
        });
        cases.push({
            name: '8.9: the editor, the command line and the agent server format alike',
            run: async () => {
                assert.ok(api !== undefined, 'the extension did not activate');
                const report = await assertSameFormatting(api, mod, work);
                writeOut(out, { same_formatting: report });
            },
        });
    }
    return cases;
}
