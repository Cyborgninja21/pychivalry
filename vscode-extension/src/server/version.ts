/**
 * The extension's version, reported as the language server's serverInfo.version.
 *
 * Read from the extension's own package.json at run time (the one shipped in the VSIX next
 * to dist/), found by walking up from this module: dist/ in the webpack bundle, out/server/
 * when the unit tests run the compiled sources.
 */

import * as fs from 'fs';
import * as path from 'path';

const EXTENSION_NAME = 'ck3-language-support';

let cached: string | undefined;

/** The `version` of the ck3-language-support package.json ('0.0.0' when none is found). */
export function extensionVersion(): string {
    if (cached === undefined) {
        cached = findVersion(__dirname) ?? '0.0.0';
    }
    return cached;
}

function findVersion(start: string): string | undefined {
    let dir = start;
    for (;;) {
        const file = path.join(dir, 'package.json');
        if (fs.existsSync(file)) {
            const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                Reflect.get(parsed, 'name') === EXTENSION_NAME &&
                typeof Reflect.get(parsed, 'version') === 'string'
            ) {
                return String(Reflect.get(parsed, 'version'));
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}
