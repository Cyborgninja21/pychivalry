import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import type { SuiteRecord } from './record.js';
import {
    checkRecord,
    checkRecords,
    compileRecordSchema,
    localPaths,
    type Expected,
} from './records-check.js';
import { summarize } from './stats.js';
import { tempDir, writeTree } from './testing.js';
import { repoRoot, sha256 } from './util.js';

const schemaFile = path.join(repoRoot(), 'records', 'record.schema.json');
const validate = compileRecordSchema(schemaFile);

const SPEC = { version: '1.21.0.3', sha256: 'a'.repeat(64) };
const LEGACY = { version: '1.21.0.3', sha256: '9'.repeat(64), package_format: 4 };
const CORPUS = 'b'.repeat(64);
const expected: Expected = { spec: SPEC, legacySpec: LEGACY, corpusManifestSha256: CORPUS };

function validRecord(): SuiteRecord {
    return {
        record_format: 1,
        suite: 'game:bench',
        command: 'task game:bench',
        made_at: '2026-11-21T12:00:00.000Z',
        tool: { name: 'pychivalry', version: '0.0.0', commit: 'c'.repeat(40), dirty: false },
        machine: { os: 'linux', arch: 'x64', logical_cpus: 16, memory_gib: 62, node: 'v22.23.4' },
        game: {
            build: '1.21.0.3',
            manifest_sha256: 'd'.repeat(64),
            files: 3,
            content_hashed_files: 1,
        },
        spec: { ...SPEC, package_format: 9 },
        corpus: { manifest_sha256: CORPUS, slugs: ['rice'] },
        results: {},
    };
}

function speedRecord(later: number[]): SuiteRecord {
    return {
        ...validRecord(),
        suite: 'baseline:speed',
        spec: { ...LEGACY },
        notes: ['The first run is not a cold start.'],
        results: {
            series: [
                {
                    name: 'mod rice: command-line check',
                    method: 'corpus-acceptance',
                    mod: 'rice',
                    runs: later.length + 1,
                    measures: { load_ms: { unit: 'ms', first: 900, later: summarize(later) } },
                    context: {},
                },
            ],
        },
    };
}

test('a valid record passes', () => {
    assert.deepEqual(checkRecord(validRecord(), validate, expected), []);
});

test('a record with a wrong spec checksum is rejected', () => {
    const record = validRecord();
    record.spec.sha256 = 'e'.repeat(64);
    const problems = checkRecord(record, validate, expected);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? '', /^\/spec: made on spec .* re-run the suite$/);
});

test('a record made on another spec version is rejected', () => {
    const record = validRecord();
    record.spec.version = '1.20.0.2';
    assert.match(checkRecord(record, validate, expected).join('\n'), /made on spec "1\.20\.0\.2"/);
});

test('a 2.3.0 baseline is tied to the committed format 4 copy and its game build, not to the package', () => {
    assert.deepEqual(checkRecord(speedRecord([5, 1, 4, 2, 3]), validate, expected), []);
    const onPackage = { ...speedRecord([5, 1, 4, 2, 3]), spec: { ...SPEC, package_format: 9 } };
    assert.match(
        checkRecord(onPackage, validate, expected).join('\n'),
        /^\/spec: a 2\.3\.0 baseline made on spec "1\.21\.0\.3" format 9 .* but the committed format 4 copy is 1\.21\.0\.3 format 4/,
    );
    const otherCopy = speedRecord([5, 1, 4, 2, 3]);
    otherCopy.spec.sha256 = '8'.repeat(64);
    assert.match(checkRecord(otherCopy, validate, expected).join('\n'), /re-run the baseline/);
    const otherGame = speedRecord([5, 1, 4, 2, 3]);
    otherGame.game.build = '1.21.1.0';
    assert.deepEqual(checkRecord(otherGame, validate, expected), [
        '/game/build: a 2.3.0 baseline made on game "1.21.1.0", but the committed spec is for game 1.21.0.3; re-run the baseline',
    ]);
    const otherCorpus = speedRecord([5, 1, 4, 2, 3]);
    otherCorpus.corpus = { manifest_sha256: 'f'.repeat(64), slugs: ['rice'] };
    assert.match(
        checkRecord(otherCorpus, validate, expected).join('\n'),
        /made on corpus manifest/,
    );
    assert.match(
        checkRecord(speedRecord([5, 1, 4, 2, 3]), validate, {
            ...expected,
            legacySpec: undefined,
        }).join('\n'),
        /committed format 4 copy spec\/legacy\/, which is missing/,
    );
});

test('a record with a missing field is rejected, for every required field', () => {
    for (const field of Object.keys(validRecord())) {
        const record: Record<string, unknown> = { ...validRecord() };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- the field under test
        delete record[field];
        const problems = checkRecord(record, validate, expected);
        assert.ok(
            problems.some((p) => p.includes(`must have required property '${field}'`)),
            `missing ${field}: ${problems.join('; ')}`,
        );
    }
});

test('a record with a missing nested field is rejected', () => {
    const record = validRecord() as unknown as { game: Record<string, unknown> };
    delete record.game['manifest_sha256'];
    assert.match(
        checkRecord(record, validate, expected).join('\n'),
        /\/game: must have required property 'manifest_sha256'/,
    );
});

test('a record with an unknown field is rejected', () => {
    const record = { ...validRecord(), extra: 1 };
    assert.match(
        checkRecord(record, validate, expected).join('\n'),
        /must NOT have additional properties \(extra\)/,
    );
});

test('a record made on another corpus manifest is rejected', () => {
    const record = validRecord();
    record.corpus = { manifest_sha256: 'f'.repeat(64), slugs: ['rice'] };
    assert.match(
        checkRecord(record, validate, expected).join('\n'),
        /\/corpus\/manifest_sha256: made on corpus manifest/,
    );
});

test('a record holding a local path is rejected', () => {
    for (const command of [
        'CK3_GAME_PATH=/opt/games/ck3 task game:mods',
        'node check C:\\Users\\someone\\mod',
        'run ~/ck3-corpus',
    ]) {
        const record = { ...validRecord(), command };
        assert.match(checkRecord(record, validate, expected).join('\n'), /holds a local path/);
    }
    assert.deepEqual(localPaths({ command: 'CK3_GAME_PATH=<game dir> task game:mods' }), []);
});

test('a speed record whose statistics agree with its values passes', () => {
    assert.deepEqual(checkRecord(speedRecord([5, 1, 4, 2, 3]), validate, expected), []);
});

test('a speed record whose statistics disagree with its values is rejected', () => {
    const record = speedRecord([5, 1, 4, 2, 3]);
    const series = (
        record.results['series'] as Array<{ measures: { load_ms: { later: { median: number } } } }>
    )[0];
    assert.ok(series !== undefined);
    series.measures.load_ms.later.median = 4;
    assert.match(checkRecord(record, validate, expected).join('\n'), /median: 4 does not agree/);
});

test('a speed record with fewer than five later runs is rejected', () => {
    assert.match(
        checkRecord(speedRecord([1, 2, 3, 4]), validate, expected).join('\n'),
        /must NOT have fewer than 5 items/,
    );
});

test('a speed record without notes is rejected', () => {
    const record = speedRecord([5, 1, 4, 2, 3]);
    delete record.notes;
    assert.match(
        checkRecord(record, validate, expected).join('\n'),
        /must have required property 'notes'/,
    );
});

test('checkRecords finds the records of a repository and names the file of each problem', (t) => {
    const root = tempDir(t);
    const json = Buffer.from(
        JSON.stringify({ package_format: 9, manifest: { version: '1.21.0.3', companions: {} } }),
    );
    writeTree(root, {
        'spec/ck3-spec-1.21.0.3.json.gz': gzipSync(json),
        'spec/ck3-spec-1.21.0.3.sha256': `${sha256(json)}  ck3-spec-1.21.0.3.json\n`,
        'spec/schema.format9.json': JSON.stringify({
            properties: { package_format: { const: 9 } },
        }),
        'records/corpus/MANIFEST.tsv': 'manifest\n',
    });
    mkdirSync(path.join(root, 'records'), { recursive: true });
    copyFileSync(schemaFile, path.join(root, 'records', 'record.schema.json'));
    const good = validRecord();
    good.spec = { version: '1.21.0.3', sha256: sha256(json), package_format: 9 };
    good.corpus = { manifest_sha256: sha256('manifest\n'), slugs: ['rice'] };
    const stale = { ...good, spec: { ...good.spec, sha256: '0'.repeat(64) } };
    const missing: Record<string, unknown> = { ...good };
    delete missing['game'];
    writeTree(root, {
        'records/game/mods.json': JSON.stringify(good),
        'records/game/check.json': JSON.stringify(stale),
        'records/game/parse.json': JSON.stringify(missing),
    });
    const result = checkRecords(root);
    assert.deepEqual(result.files, [
        'records/game/check.json',
        'records/game/mods.json',
        'records/game/parse.json',
    ]);
    assert.equal(result.problems.length, 2);
    assert.match(result.problems[0] ?? '', /^records\/game\/check\.json: \/spec: made on spec/);
    assert.match(
        result.problems[1] ?? '',
        /^records\/game\/parse\.json: \(root\): must have required property 'game'/,
    );
});

function parseRecord(): SuiteRecord {
    return {
        ...validRecord(),
        suite: 'game:parse',
        command: 'task game:parse',
        corpus: null,
        notes: ['Files are decoded as UTF-8.'],
        results: {
            passed: true,
            failures: [],
            files: 2,
            trees: 2,
            parse_ms: 5,
            folders: [
                {
                    folder: 'events',
                    extension: '.txt',
                    expected_files: 2,
                    files: 2,
                    trees: 2,
                    bom: 1,
                    not_utf8: 0,
                    errors: 1,
                    parse_ms: 5,
                    why: 'Events.',
                    excluded: [],
                },
            ],
            errors: [
                {
                    file: 'events/a.txt',
                    line: 3,
                    column: 1,
                    id: 'syntax/missing-closing-brace',
                    catalogue: 'expected_after_arguments',
                    message: 'Expected } after arguments',
                    classification: 'game-defect',
                    reason: 'Never closed.',
                },
            ],
            notes: [],
            not_read: [{ what: 'gui/**/*.gui', why: 'Step 10.' }],
            encoding: {
                extensions: ['.txt'],
                files: 2,
                bom: 1,
                utf16_bom: 0,
                not_utf8: 0,
                line_endings: { lf: 2, crlf: 0, cr: 0, mixed: 0, none: 0 },
                by_folder: [{ folder: 'events', extension: '.txt', files: 2, bom: 1, not_utf8: 0 }],
                not_utf8_files: [],
            },
            round_trip: roundTrip(2, 1),
            round_trip_localization: roundTrip(0, 0),
        },
    };
}

/** A round trip's results: `files` files, `formatted` of them formatted, the rest left. */
function roundTrip(files: number, formatted: number): Record<string, unknown> {
    return {
        rules: 'docs/formatting.md',
        files,
        formatted,
        left: Array.from({ length: files - formatted }, () => ({
            file: 'events/b.txt',
            id: 'syntax/missing-closing-brace',
            line: 1,
        })),
        changed: formatted,
        trees_equal: formatted,
        tokens_equal: formatted,
        second_format_unchanged: formatted,
        comments_before: 3,
        comments_after: 3,
        comments_moved: 0,
        lines_before: 10,
        lines_after: 9,
        lines_changed: 4,
        blocks_written_on_one_line_broken: 1,
        blocks: [
            {
                kind: 'one-simple-pair',
                written_one_line_kept: 1,
                written_one_line_broken: 0,
                written_several_joined: 1,
                written_several_kept: 0,
            },
        ],
        by_rule: [{ code: 'style/indentation', files: formatted, places: 2, lines: 2 }],
        width: {
            columns: 120,
            tab_columns: 4,
            lines_over_before: 1,
            files_with_lines_over_before: 1,
            lines_over_without_width_rule: 1,
            lines_over_after: 0,
            files_changed_by_width_alone: 1,
        },
        format_ms: 1,
        largest_file: files === 0 ? null : { file: 'events/a.txt', bytes: 100, format_ms: 1 },
        failures: [],
    };
}

test('a parse record must agree with itself: totals, error counts, passed and classifications', () => {
    assert.deepEqual(checkRecord(parseRecord(), validate, expected), []);
    const record = parseRecord();
    record.results['files'] = 3;
    record.results['passed'] = false;
    const errors = record.results['errors'] as { classification: string }[];
    errors.push({ ...(errors[0] ?? { classification: '' }), classification: 'unclassified' });
    assert.deepEqual(checkRecord(record, validate, expected), [
        "/results/files: 3 is not the folders' total (2)",
        '/results/errors: 2 listed, but the folders count 1',
        '/results/passed: false with 0 failures',
    ]);
    const passing = parseRecord();
    (passing.results['errors'] as { classification: string }[])[0] = {
        ...((passing.results['errors'] as object[])[0] as object),
        classification: 'unclassified',
    };
    assert.deepEqual(checkRecord(passing, validate, expected), [
        '/results/errors/0: a passing record holds an error classified "unclassified"',
    ]);
    const noShape = { ...parseRecord(), results: {} };
    assert.ok(checkRecord(noShape, validate, expected).some((p) => p.includes('required')));
    const lost = parseRecord();
    lost.results['round_trip'] = { ...roundTrip(2, 1), comments_after: 2, trees_equal: 0 };
    assert.deepEqual(checkRecord(lost, validate, expected), [
        '/results/round_trip/trees_equal: 0 of 1 in a passing record',
        '/results/round_trip: comments lost or moved in a passing record',
    ]);
});

function resultsModsRecord(): SuiteRecord {
    return {
        ...validRecord(),
        suite: 'baseline:results',
        spec: { ...LEGACY },
        notes: ['One run per mod.'],
        results: {
            method: 'corpus-acceptance',
            context: { exit_codes: [1], load_average_1m: [1.5] },
            mods: [
                {
                    slug: 'rice',
                    files: 4,
                    by_severity: { error: 1, warning: 0, information: 2, hint: 0 },
                    by_code: [
                        { code: 'unknown_trigger_X', severity: 'error', count: 1 },
                        { code: 'undefined_event_target_X', severity: 'information', count: 2 },
                    ],
                    errors: 1,
                    error_list: [
                        {
                            file: 'events/a.txt',
                            line: 3,
                            code: 'unknown_trigger_X',
                            message: "Unknown trigger 'x'",
                            classification: 'unclassified',
                        },
                    ],
                },
            ],
        },
    };
}

function resultsBaseGameRecord(): SuiteRecord {
    return {
        ...validRecord(),
        suite: 'baseline:results',
        spec: { ...LEGACY },
        corpus: null,
        notes: ['One run.'],
        results: {
            method: 'vanilla-acceptance',
            context: { node_flags: [], load_average_1m: 1 },
            base_game: {
                parse: {
                    files: 3,
                    by_folder: [
                        { folder: 'common', files: 2 },
                        { folder: 'events', files: 1 },
                    ],
                    files_with_bom: 1,
                    errors: 1,
                    error_list: [
                        { file: 'common/a.txt', line: 1, column: 2, code: 'x', message: 'X' },
                    ],
                },
                check: {
                    by_severity: { error: 0, warning: 1, information: 0, hint: 0 },
                    by_code: [{ code: 'y', severity: 'warning', count: 1 }],
                    errors: 0,
                    error_list: [],
                },
                scope: {
                    keyword_uses: 10,
                    keyword_uses_known_scope: 5,
                    keyword_uses_judged: 4,
                    link_steps_judged: 3,
                    findings: 0,
                    keyword_uses_by_known_scope_type: [{ type: 'character', uses: 5 }],
                },
            },
        },
    };
}

test('a results baseline that agrees with itself passes, for the mods and for the base game', () => {
    assert.deepEqual(checkRecord(resultsModsRecord(), validate, expected), []);
    assert.deepEqual(checkRecord(resultsBaseGameRecord(), validate, expected), []);
});

test('a results baseline whose counts disagree with each other or with its corpus is rejected', () => {
    const record = resultsModsRecord();
    const mod = (record.results['mods'] as Record<string, unknown>[])[0] ?? {};
    mod['by_severity'] = { error: 2, warning: 0, information: 2, hint: 0 };
    mod['errors'] = 2;
    record.corpus = { manifest_sha256: CORPUS, slugs: ['viet-events'] };
    assert.deepEqual(checkRecord(record, validate, expected), [
        '/results/mods/0/by_severity/error: 2 is not the total of by_code (1)',
        '/results/mods/0/errors: 2 with 1 listed',
        '/results/mods/0/error_list: 1 listed, but by_severity counts 2 errors',
        '/results/mods: the mods ["rice"] are not the corpus slugs ["viet-events"]',
    ]);
    const base = resultsBaseGameRecord();
    const parse = (base.results['base_game'] as { parse: Record<string, unknown> }).parse;
    parse['files'] = 4;
    parse['errors'] = 0;
    assert.deepEqual(checkRecord(base, validate, expected), [
        "/results/base_game/parse/files: 4 is not the folders' total (3)",
        '/results/base_game/parse/errors: 0 with 1 listed',
    ]);
});

test('a results baseline must have the shape of its method', () => {
    const record = resultsModsRecord();
    record.results['method'] = 'vanilla-acceptance';
    assert.match(
        checkRecord(record, validate, expected).join('\n'),
        /must have required property 'base_game'/,
    );
    const noClassification = resultsModsRecord();
    const mod = (
        noClassification.results['mods'] as { error_list: Record<string, unknown>[] }[]
    )[0];
    delete mod?.error_list[0]?.['classification'];
    assert.match(
        checkRecord(noClassification, validate, expected).join('\n'),
        /must have required property 'classification'/,
    );
});

const SCOPE = {
    keyword_uses: 10,
    keyword_uses_known_scope: 6,
    keyword_uses_judged: 4,
    findings: 0,
    unjudged_by_reason: [{ reason: 'no-requirement', uses: 2 }],
    link_steps_judged: 3,
    link_findings: 0,
};
const NOT_CAPPED = { max_per_file: 1000, files: 0, dropped: 0, dropped_by_code: [] };

function checkSuiteRecord(): SuiteRecord {
    return {
        ...validRecord(),
        suite: 'game:check',
        command: 'task game:check',
        corpus: null,
        notes: ['A check record.'],
        results: {
            passed: true,
            failures: [],
            files: 3,
            files_by_layer: [
                { layer: 'game', files: 2 },
                { layer: 'jomini', files: 1 },
            ],
            by_severity: { error: 1, warning: 1, information: 2, hint: 0 },
            by_code: [
                { code: 'names/unknown-trigger', severity: 'error', count: 1 },
                { code: 'localization/missing-key', severity: 'warning', count: 1 },
                { code: 'scope/undefined-event-target', severity: 'information', count: 2 },
            ],
            errors: 1,
            error_list: [
                {
                    file: 'common/x.txt',
                    layer: 'game',
                    line: 3,
                    column: 5,
                    code: 'names/unknown-trigger',
                    message: "Unknown trigger 'x'",
                    classification: 'game-defect',
                    reason: 'No such trigger.',
                },
            ],
            warnings: 1,
            warning_list: [
                {
                    file: 'common/y.txt',
                    layer: 'game',
                    line: 4,
                    column: 1,
                    code: 'localization/missing-key',
                    message: 'Unknown loc key y',
                    classification: 'spec-package-fault',
                    reason: 'The package is wrong.',
                },
            ],
            classified: {
                'game-defect': 1,
                'spec-package-fault': 1,
                'pychivalry-fault': 0,
                unclassified: 0,
            },
            capped: NOT_CAPPED,
            scope: SCOPE,
            baseline_2_3_0: {
                errors: 2,
                errors_at_same_line: 1,
                errors_only_2_3_0: 1,
                errors_only_here: 0,
                keyword_uses: 9,
                keyword_uses_judged: 3,
            },
            time_ms: { list: 1, build: 2, check: 3, total: 6 },
            peak_rss_kib: 1024,
        },
    };
}

test('a check record that agrees with itself passes', () => {
    assert.deepEqual(checkRecord(checkSuiteRecord(), validate, expected), []);
});

test('a check record whose counts disagree, or that passes with an unclassified finding, is rejected', () => {
    const record = checkSuiteRecord();
    const results = record.results as Record<string, unknown> & {
        error_list: Record<string, unknown>[];
        capped: Record<string, unknown>;
    };
    results['files'] = 4;
    results['errors'] = 2;
    const [error] = results.error_list;
    assert.ok(error !== undefined);
    error['classification'] = 'unclassified';
    results.capped = { ...NOT_CAPPED, dropped: 5 };
    assert.deepEqual(checkRecord(record, validate, expected), [
        '/results/error_list: 1 listed, but errors is 2 and by_severity counts 1',
        '/results/capped/dropped: 5 is not the total of dropped_by_code (0)',
        "/results/files: 4 is not the layers' total (3)",
        '/results/error_list/0: a passing record holds a finding classified "unclassified"',
    ]);
});

test('a mods check record must name its corpus slugs and classify every error to pass', () => {
    const base = checkSuiteRecord().results;
    const mod = {
        slug: 'rice',
        files: 3,
        not_checked: [],
        by_severity: base['by_severity'],
        by_code: base['by_code'],
        errors: 1,
        error_list: [
            {
                file: 'common/x.txt',
                line: 3,
                column: 5,
                code: 'names/unknown-trigger',
                message: "Unknown trigger 'x'",
                classification: 'pychivalry-fault',
                reason: 'Ours.',
            },
        ],
        warnings: 1,
        warning_list: [
            {
                file: 'common/y.txt',
                line: 4,
                column: 1,
                code: 'localization/missing-key',
                message: 'Unknown loc key y',
            },
        ],
        classified: {
            'real-defect': 0,
            'spec-package-fault': 0,
            'pychivalry-fault': 1,
            unclassified: 0,
        },
        capped: NOT_CAPPED,
        scope: SCOPE,
        baseline_2_3_0: {
            files: 3,
            by_severity: { error: 1, warning: 0, information: 0, hint: 0 },
            errors: 1,
            errors_at_same_line: 1,
            errors_only_2_3_0: 0,
            errors_only_here: 0,
        },
        time_ms: { load_base: 1, check: 2, total: 3 },
        peak_rss_kib: 1024,
    };
    const record: SuiteRecord = {
        ...validRecord(),
        suite: 'game:mods',
        command: 'task game:mods',
        corpus: { manifest_sha256: CORPUS, slugs: ['viet-events'] },
        notes: ['A mods record.'],
        results: {
            passed: true,
            failures: [],
            base_game_cache: { build_ms: 10, peak_rss_kib: 2048 },
            mods: [mod],
        },
    };
    assert.deepEqual(checkRecord(record, validate, expected), [
        '/results/mods/0/error_list/0: a passing record holds an error classified "pychivalry-fault"',
        '/results/mods: the mods ["rice"] are not the corpus slugs ["viet-events"]',
    ]);
});
