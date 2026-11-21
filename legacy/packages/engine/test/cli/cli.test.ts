/**
 * The CLI: its text output on `example mod/` is checked in as
 * test/fixtures/example-mod.cli.txt and must not change; --json prints one object per line.
 */

import * as assert from 'assert';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { packageRoot } from '../../src/spec/spec';
import { repoRoot } from '../helpers/engine';

const CLI = path.join(packageRoot(), 'dist', 'cli.js');

function run(...args: string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('CLI', () => {
    const exampleMod = path.join(repoRoot(), 'example mod');

    it('check "example mod" prints the checked-in text output', () => {
        const expected = fs.readFileSync(
            path.join(packageRoot(), 'test', 'fixtures', 'example-mod.cli.txt'),
            'utf8'
        );
        const r = run('check', exampleMod);
        assert.strictEqual(r.stdout, expected);
        assert.strictEqual(r.status, 1, 'exit code 1 when errors are reported');
    });

    it('--json prints one diagnostic object per line', () => {
        const r = run('check', exampleMod, '--json');
        const lines = r.stdout.trim().split('\n');
        assert.ok(lines.length > 0);
        for (const line of lines) {
            const d: unknown = JSON.parse(line);
            assert.ok(typeof d === 'object' && d !== null && 'code' in d && 'file' in d);
        }
    });

    it('--spec loads another package file; usage errors exit with 2', () => {
        const spec = path.join(packageRoot(), 'spec', 'ck3-spec-1.20.0.2.json.gz');
        const golden = path.join(
            packageRoot(),
            'test',
            'fixtures',
            'engine-test-mods',
            'unknown_trigger'
        );
        assert.strictEqual(run('check', golden, '--spec', spec).status, 1);
        assert.strictEqual(run('lint', golden).status, 2);
        assert.strictEqual(run('check').status, 2);
    });
});
