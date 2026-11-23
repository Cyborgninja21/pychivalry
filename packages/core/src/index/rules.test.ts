/**
 * The override rules as data (docs/PLAN.md item 3.1a): the spec package's part D1 reads with
 * the core's reader; every row names its status, evidence, platforms and what it rests on per
 * platform; a partial or open row decides nothing; a table that is not well formed is refused
 * with every problem listed, two rows answering one question on one platform among them.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import {
    APPLIED_KINDS,
    canonicalJson,
    currentPlatform,
    databaseMatches,
    decides,
    decidingRules,
    EXTENSION_KINDS,
    PYCHIVALRY_KINDS,
    readRulesTable,
    resolveOfDetail,
    RULE_KINDS,
    rulesDigest,
    rulesFor,
    RulesTableError,
    SKIPPED_KINDS,
    withRule,
    type Rule,
} from './rules.js';
import { packageRules, TEST_ROW } from './testing.js';

test("the package's table reads: 82 rows, each with its status, evidence and basis per platform", () => {
    const table = packageRules();
    assert.equal(table.format, 1);
    assert.equal(table.game_build, '1.21.0.3');
    assert.equal(table.rules.length, 82);
    const byStatus = new Map<string, number>();
    for (const rule of table.rules) {
        byStatus.set(rule.status, (byStatus.get(rule.status) ?? 0) + 1);
        assert.ok(rule.evidence.length > 0, rule.id);
        for (const platform of rule.platforms) {
            assert.ok(rule.platform_basis[platform] !== undefined, `${rule.id} on ${platform}`);
        }
    }
    assert.deepEqual(Object.fromEntries([...byStatus].sort()), {
        derived: 3,
        open: 7,
        partial: 12,
        settled: 60,
    });
    assert.equal(
        table.rules.filter((r) => PYCHIVALRY_KINDS.includes(r.kind)).length,
        35,
        "the rows of pychivalry's own nine kinds",
    );
});

test("the extension kinds are the package's own list of what it added as a kind", () => {
    const part = committedSpec().part('override_rules');
    // An extension's name is the kind, then what else it adds after a `;`.
    const added = (part?.extensions ?? [])
        .filter((e) => e.what === 'kind')
        .map((e) => e.name.split(';')[0]?.trim() ?? '');
    assert.deepEqual([...added].sort(), [...EXTENSION_KINDS].sort());
    // Each extension kind is applied or skipped with its reason, never both, never neither.
    for (const kind of EXTENSION_KINDS) {
        assert.notEqual(APPLIED_KINDS.has(kind), kind in SKIPPED_KINDS, kind);
    }
});

test('a partial or open row never decides; a settled or derived row of an applied kind does', () => {
    for (const rule of packageRules().rules) {
        const expected =
            APPLIED_KINDS.has(rule.kind) &&
            (rule.status === 'settled' || rule.status === 'derived');
        assert.equal(decides(rule), expected, rule.id);
    }
    const linux = decidingRules(packageRules(), 'linux').map((r) => r.id);
    const windows = decidingRules(packageRules(), 'windows').map((r) => r.id);
    // Letter case is the file system's: each platform has its own path-case row.
    assert.ok(linux.includes('path-case-linux') && !linux.includes('path-case-windows'));
    assert.ok(windows.includes('path-case-windows') && !windows.includes('path-case-linux'));
    assert.ok(!linux.includes('characters-by-override-priority'), 'partial');
    assert.ok(!linux.includes('localization-read-order-linux'), 'partial');
});

function base(fields: Record<string, unknown>): Record<string, unknown> {
    return { id: 'a-row', overrides_rule: 5, title: 'A row', ...TEST_ROW, ...fields };
}

function table(rules: unknown[]): unknown {
    return { format: 1, game_build: '1.21.0.3', rules };
}

function problems(data: unknown): readonly string[] {
    try {
        readRulesTable(data);
    } catch (err) {
        assert.ok(err instanceof RulesTableError);
        return err.problems;
    }
    return [];
}

test('every kind of row is accepted when well formed', () => {
    const rows = [
        base({ id: 'r1', kind: 'file-replace', layer: 'mod', over: ['game'] }),
        base({ id: 'r2', kind: 'file-identity', by: 'relative-path' }),
        base({ id: 'r3', kind: 'path-case', compare: 'exact' }),
        base({
            id: 'r4',
            kind: 'pack-layer',
            layer: 'game',
            folder: 'dlc',
            descriptor_extension: '.dlc',
            path_key: 'path',
        }),
        base({ id: 'r5', kind: 'replace-path', hides: ['game', 'dlc'], subfolders: true }),
        base({
            id: 'r6',
            kind: 'file-order',
            compare: 'bytes',
            subfolders: 'files-first',
            layers: 'in-order',
            layer_order: ['game', 'mod'],
        }),
        base({
            id: 'r7',
            kind: 'key-resolution',
            databases: ['common/traits'],
            forms: ['record'],
            resolve: 'later-wins',
            combine: 'whole',
        }),
        base({ id: 'r8', kind: 'containers', databases: ['common/x'], keys: ['*'] }),
        base({ id: 'r9', kind: 'folder-wins', databases: ['localization'], segment: 'replace' }),
        base({ id: 'r10', kind: 'listing-depth', databases: ['common/x'], recursive: true }),
        base({ id: 'r11', kind: 'mount-order', order: ['game', 'mod'] }),
        base({ id: 'r12', kind: 'mount-dependencies' }),
        base({ id: 'r13', kind: 'key-identity', databases: ['common/x'] }),
        base({ id: 'r14', kind: 'field-outcomes', databases: ['common/on_action'] }),
        base({ id: 'r15', kind: 'path-case-mechanism' }),
        base({ id: 'r16', kind: 'duplicate-message', text: 'Duplicate {}' }),
        base({ id: 'r17', kind: 'open-question', found: 'located, not followed', status: 'open' }),
    ];
    assert.deepEqual(problems(table(rows)), []);
    assert.deepEqual(
        [...new Set(rows.map((r) => r['kind']))].sort(),
        [...RULE_KINDS].sort(),
        'the test covers every kind',
    );
});

test('a table that is not well formed is refused, with every problem listed', () => {
    assert.match(
        problems(table([base({ kind: 'guess' })])).join('\n'),
        /kind "guess" is not one of/,
    );
    assert.match(
        problems(table([base({ kind: 'path-case', compare: 'exact', status: 'likely' })])).join(
            '\n',
        ),
        /status must be one of/,
    );
    assert.match(
        problems(table([base({ kind: 'path-case', compare: 'exact', platform_basis: {} })])).join(
            '\n',
        ),
        /platform_basis\.linux must give a basis/,
    );
    assert.match(
        problems(table([base({ kind: 'file-replace', layer: 'mod' })])).join('\n'),
        /over is missing/,
    );
    assert.match(
        problems(table([base({ kind: 'path-case', compare: 'exact', platforms: ['macos'] })])).join(
            '\n',
        ),
        /platforms must list/,
    );
    assert.match(
        problems(table([base({ kind: 'path-case', compare: 'exact', evidence: [] })])).join('\n'),
        /evidence must list at least one source/,
    );
    assert.match(
        problems(
            table([
                base({
                    kind: 'key-resolution',
                    databases: ['events'],
                    resolve: 'priority',
                    combine: 'whole',
                }),
            ]),
        ).join('\n'),
        /names its priority_field/,
    );
    assert.match(
        problems(
            table([
                base({
                    kind: 'key-resolution',
                    databases: ['events'],
                    resolve: 'all',
                    combine: 'whole',
                }),
            ]),
        ).join('\n'),
        /combine is for a rule that names a winner/,
    );
    assert.match(
        problems(
            table([base({ kind: 'key-resolution', databases: ['events'], resolve: 'later-wins' })]),
        ).join('\n'),
        /says what it takes: combine/,
    );
    assert.match(
        problems(table([base({ kind: 'listing-depth', databases: ['events'] })])).join('\n'),
        /recursive is missing/,
    );
    assert.match(
        problems(
            table([
                base({ id: 'same', kind: 'path-case', compare: 'exact' }),
                base({ id: 'same', kind: 'file-identity', by: 'relative-path' }),
            ]),
        ).join('\n'),
        /two rows have the id same/,
    );
    assert.match(problems({ ...(table([]) as object), format: 2 }).join('\n'), /format is 2/);
});

test('two rows that answer the same question on one platform are refused, whatever their status', () => {
    const a = base({
        id: 'a',
        kind: 'key-resolution',
        databases: ['common/traits'],
        resolve: 'all',
    });
    const b = base({
        id: 'b',
        kind: 'key-resolution',
        databases: ['common/traits'],
        forms: ['record'],
        resolve: 'statements',
        status: 'partial',
    });
    assert.match(
        problems(table([a, b])).join('\n'),
        /rows a and b both answer key-resolution common\/traits record on linux/,
    );
    // On different platforms they do not overlap.
    const c = { ...b, platforms: ['windows'] };
    const d = { ...a, platforms: ['linux'] };
    assert.deepEqual(problems(table([c, d])), []);
    // Two listing-depth rows for one folder.
    assert.match(
        problems(
            table([
                base({ id: 'l1', kind: 'listing-depth', databases: ['x'], recursive: true }),
                base({
                    id: 'l2',
                    kind: 'listing-depth',
                    databases: ['y'],
                    other_folders: ['x'],
                    recursive: false,
                }),
            ]),
        ).join('\n'),
        /rows l1 and l2 both answer listing-depth x on linux/,
    );
});

test('rulesFor keeps the rows that hold on a platform; decidingRules those that decide', () => {
    const rows = [
        base({ id: 'both', kind: 'path-case', compare: 'exact', platforms: ['linux', 'windows'] }),
        base({
            id: 'windows',
            kind: 'file-identity',
            by: 'relative-path',
            platforms: ['windows'],
        }),
        base({
            id: 'open',
            kind: 'replace-path',
            hides: ['game'],
            subfolders: false,
            status: 'open',
        }),
    ];
    const t = readRulesTable(table(rows));
    assert.deepEqual(
        rulesFor(t, 'linux').map((r) => r.id),
        ['both', 'open'],
    );
    assert.deepEqual(
        decidingRules(t, 'windows').map((r) => r.id),
        ['both', 'windows'],
    );
});

test('withRule adds a row and checks the table again', () => {
    const t = packageRules();
    const row = base({
        id: 'extra',
        kind: 'key-resolution',
        databases: ['common/a_test_folder'],
        resolve: 'all',
    }) as unknown as Rule;
    assert.equal(withRule(t, row).rules.length, t.rules.length + 1);
    assert.throws(
        () => withRule(t, { ...row, kind: 'nonsense' } as unknown as Rule),
        RulesTableError,
    );
});

test('the digest is of the canonical JSON: key order does not change it, a value does', () => {
    const t = packageRules();
    const reverse = (value: unknown): unknown =>
        Array.isArray(value)
            ? value.map(reverse)
            : typeof value === 'object' && value !== null
              ? Object.fromEntries(
                    Object.entries(value)
                        .reverse()
                        .map(([k, v]) => [k, reverse(v)]),
                )
              : value;
    const reordered = reverse(t) as typeof t;
    assert.notEqual(JSON.stringify(reordered), JSON.stringify(t));
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
    assert.equal(rulesDigest(reordered), rulesDigest(t));
    assert.notEqual(rulesDigest({ ...t, game_build: '1.21.0.4' }), rulesDigest(t));
});

test('a database pattern covers itself and its languages, never a longer name', () => {
    assert.ok(databaseMatches('localization', 'localization:l_english'));
    assert.ok(databaseMatches('events', 'events'));
    assert.ok(!databaseMatches('events', 'events_old'));
    assert.ok(!databaseMatches('common/traits', 'common/traits_old'));
    assert.ok(!databaseMatches('common/traits', 'common/traits#trait_track'), 'a nested kind');
});

test('a details text gives its resolve word when it starts with one', () => {
    assert.equal(resolveOfDetail('earlier-wins: the first of the two'), 'earlier-wins');
    assert.equal(resolveOfDetail('later-wins: of two files'), 'later-wins');
    assert.equal(resolveOfDetail('first-read-kept: with equal priority'), undefined);
    assert.equal(resolveOfDetail(undefined), undefined);
});

test('the current platform is named as a rule names it', () => {
    const expected =
        process.platform === 'win32'
            ? 'windows'
            : process.platform === 'linux'
              ? 'linux'
              : undefined;
    assert.equal(currentPlatform(), expected);
});
