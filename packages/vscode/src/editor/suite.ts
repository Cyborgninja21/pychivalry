/**
 * The editor tests (`task vscode:test`, and `task vscode:corpus` locally): they run inside a
 * real VS Code that `run.ts` starts under a virtual display, with throwaway user-data,
 * extensions, home and Claude Code configuration folders. `PYCHIVALRY_EDITOR_SUITE` names the
 * suite:
 *
 * - `main`: the extension loaded from its development folder on a copy of a fixture mod;
 *   items 7.1 (a) and (b), 7.3, 7.4, 7.6 and 7.8;
 * - `smoke`: the packaged `.vsix` installed into a clean VS Code, on a copy of the planted-defect
 *   mod over its game stub; items 7.7, 7.9 and 7.11;
 * - `update-1`, `update-2`: the extension installed as a user gets it, before and after an
 *   update to a second version (item 7.1 (c)); the runner swaps the versions between them;
 * - `corpus`: the packaged extension on one real mod, timed, and the same-answers test on it.
 */

import { corpusCases } from './corpus.js';
import { runCases, type EditorCase } from './harness.js';
import { mainCases } from './main.js';
import { smokeCases } from './smoke.js';
import { updateCases } from './update.js';

export async function run(): Promise<void> {
    const suite = process.env['PYCHIVALRY_EDITOR_SUITE'] ?? 'main';
    const suites: Record<string, () => readonly EditorCase[]> = {
        main: mainCases,
        smoke: smokeCases,
        'update-1': () => updateCases(1),
        'update-2': () => updateCases(2),
        corpus: corpusCases,
    };
    const cases = suites[suite];
    if (cases === undefined) {
        throw new Error(`no editor suite ${suite}`);
    }
    await runCases(suite, cases());
}
