/**
 * Mocha entry point of the VSIX smoke suite (run by runVsix.ts; see smoke.test.ts).
 */

import * as path from 'path';
import Mocha from 'mocha';

export async function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 120_000 });
    mocha.addFile(path.resolve(__dirname, 'smoke.test.js'));
    return new Promise((resolve, reject) => {
        mocha.run((failures) =>
            failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve()
        );
    });
}
