import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import {
    baseGameResults,
    bundledLegacySpec,
    modResults,
    prepareLegacySpec,
    severityTotals,
} from './baseline.js';
import { checkLegacySpec } from './spec.js';
import { tempDir, writeTree } from './testing.js';
import { repoRoot, sha256 } from './util.js';

/** The part of an export of legacy/ that prepareLegacySpec touches. */
function legacyExport(dir: string): string {
    writeTree(dir, {
        'packages/engine/spec.config.json': JSON.stringify({
            spec: 'spec/ck3-spec-1.20.0.2.json.gz',
            sha256: 'spec/ck3-spec-1.20.0.2.sha256',
            schema: 'spec/schema.json',
        }),
        'packages/engine/spec/schema.json': '{}',
    });
    return dir;
}

test('an export of legacy/ is pointed at the committed format 4 copy through its own spec.config.json', (t) => {
    const dir = legacyExport(tempDir(t));
    const legacy = prepareLegacySpec(repoRoot(), dir);
    assert.deepEqual(legacy, checkLegacySpec(path.join(repoRoot(), 'spec')).legacy);
    const engine = path.join(dir, 'packages', 'engine');
    const config = JSON.parse(readFileSync(path.join(engine, 'spec.config.json'), 'utf8')) as {
        spec: string;
        sha256: string;
        schema: string;
    };
    assert.deepEqual(config, {
        spec: `spec/ck3-spec-${legacy.version}.format4.json.gz`,
        sha256: `spec/ck3-spec-${legacy.version}.format4.sha256`,
        schema: 'spec/schema.json',
    });
    // The paths are relative to the engine, as 2.3.0's scripts join them.
    assert.deepEqual(
        readFileSync(path.join(engine, config.spec)),
        readFileSync(path.join(repoRoot(), 'spec', legacy.file)),
    );
    assert.match(readFileSync(path.join(engine, config.sha256), 'utf8'), new RegExp(legacy.sha256));
});

test('a folder that is not an export of legacy/ is refused', (t) => {
    assert.throws(() => prepareLegacySpec(repoRoot(), tempDir(t)), /not an export of legacy/);
});

test('the spec a built 2.3.0 bundles is read from its build output and checked', (t) => {
    const dir = tempDir(t);
    const json = Buffer.from(
        JSON.stringify({ package_format: 4, manifest: { version: '1.21.0.3' } }),
    );
    writeTree(dir, {
        'packages/engine/dist/data/ck3-spec.json.gz': gzipSync(json),
        'packages/engine/dist/data/ck3-spec.sha256': `${sha256(json)}  ck3-spec.json\n`,
    });
    assert.deepEqual(bundledLegacySpec(dir), {
        version: '1.21.0.3',
        sha256: sha256(json),
        package_format: 4,
    });
    writeTree(dir, {
        'vscode-extension/dist/data/engine/ck3-spec.json.gz': gzipSync('{}'),
        'vscode-extension/dist/data/engine/ck3-spec.sha256': `${sha256('{}')}  ck3-spec.json\n`,
    });
    assert.throws(() => bundledLegacySpec(dir), /has no manifest\.version/);
    writeTree(dir, {
        'vscode-extension/dist/data/engine/ck3-spec.json.gz': gzipSync(json),
        'vscode-extension/dist/data/engine/ck3-spec.sha256': `${'0'.repeat(64)}  ck3-spec.json\n`,
    });
    assert.throws(() => bundledLegacySpec(dir), /its ck3-spec\.sha256 says 0{64}/);
    assert.throws(() => bundledLegacySpec(tempDir(t)), /has no built spec/);
});

test("a base-game record of 2.3.0 becomes the results baseline's base_game", () => {
    const results = baseGameResults({
        parse: {
            trees: { common: 2, events: 1, history: 0 },
            files: 3,
            filesWithBom: 2,
            errors: 1,
            milliseconds: 9,
            errorList: [{ file: 'common/a.txt', line: 4, column: 1, code: 'p', message: 'P' }],
        },
        checks: {
            milliseconds: 10,
            countsBySeverityAndCode: {
                'warning w_code': 2,
                'error e_code': 1,
                'information i_code': 5,
            },
            errors: 1,
            errorList: [{ file: 'events/b.txt', line: 2, code: 'e_code', message: 'E' }],
        },
        scope: {
            keywordUses: 10,
            keywordUsesKnownScope: 6,
            keywordUsesJudged: 4,
            linkStepsJudged: 3,
            keywordUsesByKnownScopeType: { character: 5, title: 1 },
            findings: 0,
        },
    });
    assert.deepEqual(results, {
        parse: {
            files: 3,
            by_folder: [
                { folder: 'common', files: 2 },
                { folder: 'events', files: 1 },
                { folder: 'history', files: 0 },
            ],
            files_with_bom: 2,
            errors: 1,
            error_list: [{ file: 'common/a.txt', line: 4, column: 1, code: 'p', message: 'P' }],
        },
        check: {
            by_severity: { error: 1, warning: 2, information: 5, hint: 0 },
            by_code: [
                { code: 'e_code', severity: 'error', count: 1 },
                { code: 'w_code', severity: 'warning', count: 2 },
                { code: 'i_code', severity: 'information', count: 5 },
            ],
            errors: 1,
            error_list: [{ file: 'events/b.txt', line: 2, code: 'e_code', message: 'E' }],
        },
        scope: {
            keyword_uses: 10,
            keyword_uses_known_scope: 6,
            keyword_uses_judged: 4,
            link_steps_judged: 3,
            findings: 0,
            keyword_uses_by_known_scope_type: [
                { type: 'character', uses: 5 },
                { type: 'title', uses: 1 },
            ],
        },
    });
    assert.throws(
        () => baseGameResults({ checks: { countsBySeverityAndCode: { odd: 1 } } }),
        /is not "<severity> <code>"/,
    );
});

test("a mod record of 2.3.0 becomes a results baseline's mod, a code at a second severity included", () => {
    const mod = modResults('rice', {
        files: 7,
        bySeverity: { error: 1, warning: 1, information: 2, hint: 0 },
        counts: {
            unknown_x: { severity: 'error', count: 1 },
            unknown_x_y: { severity: 'warning', count: 1 },
            'unknown_x_y@information': { severity: 'information', count: 2 },
        },
        errors: [
            {
                file: 'events/a.txt',
                line: 1,
                code: 'unknown_x',
                message: 'X',
                classification: 'real-defect',
                reason: 'r',
                issue: 12,
            },
        ],
    });
    assert.deepEqual(mod, {
        slug: 'rice',
        files: 7,
        by_severity: { error: 1, warning: 1, information: 2, hint: 0 },
        by_code: [
            { code: 'unknown_x', severity: 'error', count: 1 },
            { code: 'unknown_x_y', severity: 'warning', count: 1 },
            { code: 'unknown_x_y', severity: 'information', count: 2 },
        ],
        errors: 1,
        error_list: [
            {
                file: 'events/a.txt',
                line: 1,
                code: 'unknown_x',
                message: 'X',
                classification: 'real-defect',
                reason: 'r',
                issue: '12',
            },
        ],
    });
    assert.deepEqual(severityTotals([]), { error: 0, warning: 0, information: 0, hint: 0 });
    assert.throws(
        () =>
            modResults('rice', {
                files: 1,
                bySeverity: { error: 2, warning: 0, information: 0, hint: 0 },
                counts: { unknown_x: { severity: 'error', count: 1 } },
                errors: [],
            }),
        /its totals by severity .* are not those of its counts/,
    );
});
