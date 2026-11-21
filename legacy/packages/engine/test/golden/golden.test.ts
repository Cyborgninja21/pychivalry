/**
 * Golden tests: the three engine test mods from pdx-parser-re must yield exactly the
 * diagnostics written by hand in test/golden/<mod>.json (message text and line).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { diagnoseWorkspace } from '../../src/diagnostics';
import { Workspace } from '../../src/index/workspace';
import { packageRoot } from '../../src/spec/spec';

interface GoldenRow {
    file: string;
    line: number;
    code: string;
    severity: string;
    message: string;
}

function readGolden(mod: string): GoldenRow[] {
    const file = path.join(packageRoot(), 'test', 'golden', `${mod}.json`);
    const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
        typeof data !== 'object' ||
        data === null ||
        !('diagnostics' in data) ||
        !Array.isArray(data.diagnostics)
    ) {
        throw new Error(`${file}: no diagnostics array`);
    }
    return data.diagnostics.map((row: unknown): GoldenRow => {
        if (typeof row !== 'object' || row === null) {
            throw new Error(`${file}: bad row`);
        }
        const get = (k: string): unknown => (k in row ? Reflect.get(row, k) : undefined);
        return {
            file: String(get('file')),
            line: Number(get('line')),
            code: String(get('code')),
            severity: String(get('severity')),
            message: String(get('message')),
        };
    });
}

describe('Golden: engine test mods', () => {
    for (const mod of ['broken_syntax', 'unknown_trigger', 'unknown_effect']) {
        it(`${mod} yields exactly the golden diagnostics`, () => {
            const root = path.join(packageRoot(), 'test', 'fixtures', 'engine-test-mods', mod);
            const results = diagnoseWorkspace(new Workspace(root));
            const actual: GoldenRow[] = [];
            for (const [file, diagnostics] of results) {
                for (const d of diagnostics) {
                    actual.push({
                        file,
                        line: d.range.start.line + 1,
                        code: d.code,
                        severity: d.severity,
                        message: d.message,
                    });
                }
            }
            assert.deepStrictEqual(actual, readGolden(mod));
        });
    }
});
