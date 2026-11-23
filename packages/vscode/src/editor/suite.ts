/**
 * The editor tests (`task vscode:test`): they run inside a real VS Code that `run.ts` starts
 * under a virtual display, with throwaway user-data, extensions, home and Claude Code
 * configuration folders. `PYCHIVALRY_EDITOR_SUITE` names the suite:
 *
 * - `main`: the extension loaded from its development folder on a copy of a fixture mod;
 *   item 7.1 (a) and (b), and item 7.8;
 * - `update-1`, `update-2`: the extension installed as a user gets it, before and after an
 *   update to a second version (item 7.1 (c)); the runner swaps the versions between them.
 */

import { runCases, type EditorCase } from './harness.js';
import { mainCases } from './main.js';
import { updateCases } from './update.js';

export async function run(): Promise<void> {
    const suite = process.env['PYCHIVALRY_EDITOR_SUITE'] ?? 'main';
    const suites: Record<string, () => readonly EditorCase[]> = {
        main: mainCases,
        'update-1': () => updateCases(1),
        'update-2': () => updateCases(2),
    };
    const cases = suites[suite];
    if (cases === undefined) {
        throw new Error(`no editor suite ${suite}`);
    }
    await runCases(suite, cases());
}
