/**
 * Vanilla acceptance: every .txt under the CK3 1.20 common/, events/ and history/ trees
 * parses with zero errors, except the parse errors recorded (with the catalogue message
 * the game itself has for them) in test/acceptance/vanilla-1.20.0.2.json.
 *
 * Needs a game directory and is skipped without one:
 *   CK3_VANILLA_DIR=<dir holding common/ events/ history/> npm test
 * The record itself is produced by `node scripts/vanilla-acceptance.js <dir>`.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { CK3Parser } from '../../src/syntax/parser';
import { defaultSpec, packageRoot } from '../../src/spec/spec';
import { assertGameRecord } from '../helpers/game-record';

interface Recorded {
    file: string;
    line: number;
    code: string;
}

function walk(dir: string, out: string[]): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (entry.name.toLowerCase().endsWith('.txt')) {
            out.push(full);
        }
    }
    return out;
}

function recordedErrors(): { files: number; errors: Recorded[] } {
    const file = path.join(packageRoot(), 'test', 'acceptance', 'vanilla-1.20.0.2.json');
    const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const parse: unknown =
        typeof data === 'object' && data !== null ? Reflect.get(data, 'parse') : undefined;
    if (typeof parse !== 'object' || parse === null) {
        throw new Error('vanilla record: no parse section');
    }
    const list: unknown = Reflect.get(parse, 'errorList');
    if (!Array.isArray(list)) {
        throw new Error('vanilla record: no errorList');
    }
    return {
        files: Number(Reflect.get(parse, 'files')),
        errors: list.map((e: unknown) => ({
            file: String(Reflect.get(Object(e), 'file')),
            line: Number(Reflect.get(Object(e), 'line')),
            code: String(Reflect.get(Object(e), 'code')),
        })),
    };
}

describe('Vanilla 1.20 acceptance', function () {
    this.timeout(600_000);
    const dir = process.env.CK3_VANILLA_DIR;

    it('the record says which game it was run against', () => {
        const file = path.join(packageRoot(), 'test', 'acceptance', 'vanilla-1.20.0.2.json');
        const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        assertGameRecord('vanilla record', Reflect.get(Object(data), 'game'));
    });

    it('parses every common/, events/, history/ .txt with only the recorded errors', function () {
        if (!dir) {
            this.skip();
        }
        const spec = defaultSpec();
        const recorded = recordedErrors();
        const actual: Recorded[] = [];
        let files = 0;
        for (const tree of ['common', 'events', 'history']) {
            for (const file of walk(path.join(dir, tree), [])) {
                files++;
                const rel = path.relative(dir, file).split(path.sep).join('/');
                const result = new CK3Parser({ spec, file: rel }).parse(
                    fs.readFileSync(file, 'utf8')
                );
                for (const e of result.errors) {
                    actual.push({ file: rel, line: e.range.start.line + 1, code: e.code });
                }
            }
        }
        assert.strictEqual(files, recorded.files);
        assert.deepStrictEqual(actual, recorded.errors);
    });
});
