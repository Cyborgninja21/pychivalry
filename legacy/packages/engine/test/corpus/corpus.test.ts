/**
 * Corpus test over pychivalry's example corpus.
 *
 * mock-ck3-mod (vscode-extension/src/test/fixtures/mock-ck3-mod) lays the fixtures out in
 * real CK3 directories; `example mod/` holds the same good_/bad_ files under numbered
 * teaching sections (01_syntax/, 05_events/ …) that are not CK3 directories. The engine
 * judges a file by the directory it is in, so each example-mod file is checked at the path
 * of its byte-identical mock-ck3-mod twin (the identity is asserted).
 *
 * good_* files must yield exactly the engine diagnostics listed in
 * test/fixtures/corpus-expectations.json (empty unless the fixture contradicts the
 * engine-derived truth, with the reason recorded); bad_* files must yield at least the
 * expected catalogue ids at the expected lines, written by hand from the fixtures' intent.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { diagnose, Diagnostic } from '../../src/diagnostics';
import { Workspace } from '../../src/index/workspace';
import { packageRoot } from '../../src/spec/spec';
import { repoRoot } from '../helpers/engine';

interface Entry {
    line: number;
    code: string;
}

interface Expectations {
    good: Record<string, Entry[]>;
    bad: Record<string, Entry[]>;
}

function entries(value: unknown, key: string): Entry[] {
    if (typeof value !== 'object' || value === null || !(key in value)) {
        throw new Error(`corpus expectations: missing '${key}'`);
    }
    const list: unknown = Reflect.get(value, key);
    if (!Array.isArray(list)) {
        throw new Error(`corpus expectations: '${key}' is not a list`);
    }
    return list.map((item: unknown) => {
        if (typeof item !== 'object' || item === null) {
            throw new Error('corpus expectations: bad entry');
        }
        return { line: Number(Reflect.get(item, 'line')), code: String(Reflect.get(item, 'code')) };
    });
}

function readExpectations(): Expectations {
    const file = path.join(packageRoot(), 'test', 'fixtures', 'corpus-expectations.json');
    const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out: Expectations = { good: {}, bad: {} };
    if (typeof data !== 'object' || data === null) {
        throw new Error('corpus expectations: not an object');
    }
    for (const kind of ['good', 'bad'] as const) {
        const section: unknown = Reflect.get(data, kind);
        if (typeof section !== 'object' || section === null) {
            throw new Error(`corpus expectations: no '${kind}' section`);
        }
        for (const [rel, value] of Object.entries(section)) {
            out[kind][rel] = entries(value, kind === 'good' ? 'known' : 'expected');
        }
    }
    return out;
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (/^(good|bad)_.*\.txt$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out.sort();
}

function key(e: Entry): string {
    return `${e.line} ${e.code}`;
}

function asEntries(diagnostics: Diagnostic[]): Entry[] {
    return diagnostics.map((d) => ({ line: d.range.start.line + 1, code: d.code }));
}

describe('Corpus: good_* and bad_* fixtures', () => {
    const mockRoot = path.join(
        repoRoot(),
        'vscode-extension',
        'src',
        'test',
        'fixtures',
        'mock-ck3-mod'
    );
    const exampleRoot = path.join(repoRoot(), 'example mod');
    const expectations = readExpectations();
    const workspace = new Workspace(mockRoot).load();
    const mockFiles = walk(mockRoot);
    const byName = new Map(mockFiles.map((f) => [path.basename(f), f]));

    function checkFile(rel: string, diagnostics: Diagnostic[]): void {
        const actual = asEntries(diagnostics);
        if (path.basename(rel).startsWith('good_')) {
            const known = expectations.good[rel] ?? [];
            assert.deepStrictEqual(
                actual.map(key).sort(),
                known.map(key).sort(),
                `${rel}: ${JSON.stringify(diagnostics, null, 1)}`
            );
        } else {
            const expected = expectations.bad[rel];
            assert.ok(expected, `${rel}: no expectation written for this bad_* file`);
            const have = new Set(actual.map(key));
            const missing = expected.filter((e) => !have.has(key(e)));
            assert.deepStrictEqual(missing, [], `${rel}: expected diagnostics missing`);
        }
    }

    describe('mock-ck3-mod', () => {
        for (const file of mockFiles) {
            const rel = workspace.relativePath(file);
            it(rel, () => {
                checkFile(rel, diagnose(workspace, file));
            });
        }
    });

    describe('example mod', () => {
        for (const file of walk(exampleRoot)) {
            const name = path.basename(file);
            const twin = byName.get(name);
            const rel = path.relative(exampleRoot, file).split(path.sep).join('/');
            it(`${rel} (checked as its mock-ck3-mod twin)`, () => {
                assert.ok(twin, `${rel}: no mock-ck3-mod twin`);
                const text = fs.readFileSync(file, 'utf8');
                assert.strictEqual(
                    text,
                    fs.readFileSync(twin, 'utf8'),
                    `${rel} differs from its twin`
                );
                checkFile(workspace.relativePath(twin), diagnose(workspace, twin, { text }));
            });
        }
    });

    it('every bad_* file has a hand-written expectation', () => {
        const rels = mockFiles
            .map((f) => workspace.relativePath(f))
            .filter((r) => path.basename(r).startsWith('bad_'));
        assert.deepStrictEqual(
            rels.filter((r) => !(r in expectations.bad)),
            []
        );
    });
});
