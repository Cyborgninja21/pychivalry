/**
 * The base-game index suite (index-suite.ts) on the fixture stub and fixture mods: it passes,
 * its results fit the record format, a reloaded cache answers as the fresh index, and each
 * open answer is counted under the rule of docs/overrides.md that leaves it open and by its
 * reason.
 */

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Resolution } from '@pychivalry/core';
import { openRules, reasonsOf, runIndexSuite } from './index-suite.js';
import { checkRecord, compileRecordSchema } from './records-check.js';
import type { SuiteRecord } from './record.js';
import { committedRules } from './rules-table.js';
import { tempDir } from './testing.js';
import { repoRoot } from './util.js';

const root = repoRoot();

type Unknown = Extract<Resolution, { status: 'unknown' }>;

function unknown(reasons: Unknown['reasons']): Unknown {
    return { status: 'unknown', definitions: [], reasons };
}

test('each open answer is counted under the rule of docs/overrides.md that leaves it open', () => {
    const same = (
        layer: string,
        other: string,
        caseDiffers = false,
    ): Unknown['reasons'][number] => ({
        kind: 'file-unknown',
        layer,
        file: 'f',
        questions: [{ kind: 'same-path', other: { layer: other, path: 'f' }, caseDiffers }],
    });
    assert.deepEqual(openRules(unknown([same('game', 'jomini')])), [3]);
    assert.deepEqual(openRules(unknown([same('mod', 'clausewitz')])), [3]);
    assert.deepEqual(openRules(unknown([same('mod', 'dlc:x')])), [10]);
    assert.deepEqual(openRules(unknown([same('mod', 'game', true)])), [9]);
    assert.deepEqual(
        openRules(
            unknown([
                {
                    kind: 'file-unknown',
                    layer: 'mod',
                    file: 'f',
                    questions: [{ kind: 'path-case', folder: 'common/x' }],
                },
            ]),
        ),
        [9],
    );
    assert.deepEqual(
        openRules(
            unknown([
                {
                    kind: 'file-unknown',
                    layer: 'game',
                    file: 'f',
                    questions: [{ kind: 'replace-path', path: 'common/x' }],
                },
            ]),
        ),
        [8],
    );
    assert.deepEqual(
        openRules(
            unknown([{ kind: 'no-rule', database: 'localization:l_english', forms: ['key'] }]),
        ),
        [7],
    );
    assert.deepEqual(
        openRules(unknown([{ kind: 'no-rule', database: 'history/provinces', forms: ['record'] }])),
        [6],
    );
    assert.deepEqual(
        openRules(
            unknown([
                {
                    kind: 'not-settled',
                    database: 'history/characters',
                    rule: 'characters-by-override-priority',
                    status: 'partial',
                    overrides_rule: 6,
                },
            ]),
        ),
        [6],
    );
    assert.deepEqual(
        openRules(
            unknown([
                {
                    kind: 'file-unknown',
                    layer: 'game',
                    file: 'f',
                    questions: [
                        { kind: 'listing-depth', folder: 'history/characters', rule: null },
                    ],
                },
            ]),
        ),
        [4],
    );
    assert.deepEqual(
        openRules(unknown([{ kind: 'no-rule', database: 'common/traits', forms: ['record'] }])),
        [5],
    );
    assert.deepEqual(
        openRules(unknown([{ kind: 'no-order', database: 'common/traits', rule: 'x' }])),
        [4],
    );
    assert.deepEqual(
        openRules(
            unknown([
                same('game', 'jomini'),
                { kind: 'no-rule', database: 'common/x', forms: ['value'] },
            ]),
        ),
        [3, 5],
    );
    assert.deepEqual(
        reasonsOf(
            unknown([
                same('game', 'jomini'),
                { kind: 'no-rule', database: 'common/x', forms: ['value'] },
                {
                    kind: 'not-settled',
                    database: 'common/x',
                    rule: 'a-row',
                    status: 'open',
                    overrides_rule: 5,
                },
            ]),
        ),
        ['file-unknown:same-path', 'no-rule', 'not-settled:a-row'],
    );
});

test('the suite on the fixture stub and mods passes, and its results fit the record format', (t) => {
    const dir = tempDir(t);
    const install = path.join(dir, 'install');
    cpSync(path.join(root, 'fixtures', 'game', 'override-rules'), install, { recursive: true });
    const parent = path.join(dir, 'temp');
    mkdirSync(parent);
    const results = runIndexSuite({
        root,
        gameDir: path.join(install, 'game'),
        corpus: {
            dir: path.join(root, 'fixtures', 'mods'),
            slugs: ['override-rules', 'override-rules-replace-path'],
        },
        rulesSha256: committedRules(root).sha256,
        platform: 'linux',
        tempParent: parent,
    });
    assert.equal(results['passed'], true, JSON.stringify(results['failures']));
    assert.deepEqual(readdirSync(parent), [], 'the cache folder is removed');
    const base = results['base_game'] as Record<string, unknown>;
    assert.deepEqual(
        (base['layers'] as { layer: string }[]).map((l) => l.layer),
        ['clausewitz', 'jomini', 'game', 'dlc'],
    );
    assert.equal(base['packs'], 1);
    const cache = base['cache'] as { reload_answers_as_fresh: boolean; bytes: number };
    assert.equal(cache.reload_answers_as_fresh, true);
    assert.ok(cache.bytes > 0);
    const dupes = base['defined_more_than_once'] as {
        by_status: Record<string, number>;
        unknown_by_rule: { rule: number }[];
        unknown_by_reason: { reason: string; names: number }[];
    };
    // fixture_char_2, twice in one file: its row is partial, so no winner and no clash.
    assert.equal(dupes.by_status['clash'], undefined);
    assert.equal(dupes.by_status['unknown'], 1);
    assert.deepEqual(
        dupes.unknown_by_rule.map((r) => r.rule),
        [6],
    );
    assert.deepEqual(dupes.unknown_by_reason, [
        { reason: 'not-settled:characters-by-override-priority', names: 1 },
    ]);
    const [mod, replacePath] = results['mods'] as Record<string, unknown>[];
    assert.ok(mod !== undefined && replacePath !== undefined);
    // The traits file, jomini/'s define file, the DLC's category file, the culture history;
    // on Windows also the script values file the mod writes in upper case (path-case-windows:
    // the worker answers for the platform it runs on).
    assert.equal(mod['game_files_replaced'], process.platform === 'win32' ? 5 : 4);
    assert.deepEqual(replacePath['replace_paths'], ['common/decisions']);
    // Two files below subfolders whose depth no settled row states.
    assert.equal(replacePath['game_files_read_unknown'], 2);
    assert.equal(replacePath['game_files_hidden'], 1);
    const record = {
        record_format: 1,
        suite: 'game:index',
        command: 'task game:index',
        made_at: '2026-11-21T12:00:00.000Z',
        tool: { name: 'pychivalry', version: '0.0.0', commit: 'c'.repeat(40), dirty: false },
        machine: { os: 'linux', arch: 'x64', logical_cpus: 16, memory_gib: 62, node: 'v22.23.4' },
        game: {
            build: '1.21.0.3',
            manifest_sha256: 'd'.repeat(64),
            files: 3,
            content_hashed_files: 1,
        },
        spec: { version: '1.20.0.2', sha256: 'a'.repeat(64), package_format: 4 },
        corpus: {
            manifest_sha256: 'b'.repeat(64),
            slugs: ['override-rules', 'override-rules-replace-path'],
        },
        notes: ['A test record.'],
        results,
    } as unknown as SuiteRecord;
    const validate = compileRecordSchema(path.join(root, 'records', 'record.schema.json'));
    const problems = checkRecord(record, validate, {
        spec: { version: '1.20.0.2', sha256: 'a'.repeat(64) },
        corpusManifestSha256: 'b'.repeat(64),
        rulesSha256: committedRules(root).sha256,
    });
    assert.deepEqual(problems, []);
    // Made on another rules table, or with totals that disagree, the record fails its check.
    const other = checkRecord(record, validate, {
        spec: { version: '1.20.0.2', sha256: 'a'.repeat(64) },
        corpusManifestSha256: 'b'.repeat(64),
        rulesSha256: 'e'.repeat(64),
    });
    assert.match(other.join('\n'), /made on rules table .*; re-run the suite/);
    const changed = structuredClone(record);
    (changed.results['base_game'] as Record<string, unknown>)['definitions'] = 0;
    changed.results['passed'] = false;
    const found = checkRecord(changed, validate, {
        spec: { version: '1.20.0.2', sha256: 'a'.repeat(64) },
        corpusManifestSha256: 'b'.repeat(64),
        rulesSha256: committedRules(root).sha256,
    }).join('\n');
    assert.match(found, /definitions: 0 is not the layers' total/);
    assert.match(found, /passed: false with 0 failures/);
});
