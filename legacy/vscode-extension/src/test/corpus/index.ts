/**
 * Mocha entry point of the real-mod corpus suite (run by runTest.ts once per corpus mod,
 * with the mod as the workspace folder; see corpus.test.ts).
 */

import * as path from 'path';
import Mocha from 'mocha';

export async function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 30 * 60 * 1000 });
    mocha.addFile(path.resolve(__dirname, 'corpus.test.js'));
    return new Promise((resolve, reject) => {
        mocha.run((failures) =>
            failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve()
        );
    });
}
