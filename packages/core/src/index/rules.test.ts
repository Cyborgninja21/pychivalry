/**
 * The override rules as data (docs/PLAN.md item 3.1a): the committed stand-in table reads,
 * carries only the rules docs/overrides.md marks settled, and every row names its evidence and
 * platforms; a table that is not well formed is refused with every problem listed.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    canonicalJson,
    currentPlatform,
    databaseMatches,
    readRulesTable,
    RULE_KINDS,
    rulesDigest,
    rulesFor,
    RulesTableError,
    withRule,
    type Rule,
} from './rules.js';
import { standInRules, TEST_ROW } from './testing.js';

/** The rules docs/overrides.md marks settled, wholly or in part (its summary table). */
const SETTLED = new Set([1, 2, 6, 10, 11]);

test('the committed stand-in table reads and carries only settled rules', () => {
    const table = standInRules();
    assert.equal(table.status, 'stand-in');
    assert.equal(table.game_build, '1.21.0.3');
    assert.ok(table.rules.length > 0);
    for (const rule of table.rules) {
        assert.ok(
            SETTLED.has(rule.overrides_rule),
            `${rule.id}: rule ${String(rule.overrides_rule)} is open`,
        );
        assert.ok(rule.evidence.length > 0, rule.id);
        assert.deepEqual([...rule.platforms].sort(), ['linux', 'windows'], rule.id);
        for (const e of rule.evidence) {
            assert.ok(
                !/^\//.test(e.source) && !/^[A-Za-z]:\\/.test(e.source),
                `${rule.id}: no local path`,
            );
        }
    }
});

test('the stand-in table has no row for an open rule: 3, 4, 5, 7, 8, 9', () => {
    const numbers = new Set(standInRules().rules.map((r) => r.overrides_rule));
    for (const open of [3, 4, 5, 7, 8, 9]) {
        assert.ok(!numbers.has(open), `rule ${String(open)}`);
    }
});

function base(fields: Record<string, unknown>): Record<string, unknown> {
    return { id: 'a-row', overrides_rule: 5, title: 'A row', ...TEST_ROW, ...fields };
}

function table(rules: unknown[]): unknown {
    return { rules_format: 1, status: 'stand-in', game_build: '1.21.0.3', source: 'a test', rules };
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

test('every kind of row in the vocabulary is accepted when well formed', () => {
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
        problems(table([base({ kind: 'path-case', compare: 'exact', winner: 'mod' })])).join('\n'),
        /has no field winner/,
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
        problems(
            table([
                base({ id: 'same', kind: 'path-case', compare: 'exact' }),
                base({ id: 'same', kind: 'file-identity', by: 'relative-path' }),
            ]),
        ).join('\n'),
        /two rows have the id same/,
    );
    assert.match(
        problems({ ...(table([]) as object), rules_format: 2 }).join('\n'),
        /rules_format is 2/,
    );
    assert.match(problems({ ...(table([]) as object), extra: 1 }).join('\n'), /no field extra/);
});

test('two rows that answer the same question on one platform are refused', () => {
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
    });
    assert.match(
        problems(table([a, b])).join('\n'),
        /rows a and b both answer key-resolution common\/traits record on linux/,
    );
    // On different platforms they do not overlap.
    const c = { ...b, platforms: ['windows'] };
    const d = { ...a, platforms: ['linux'] };
    assert.deepEqual(problems(table([c, d])), []);
});

test('rulesFor keeps the rows that hold on a platform', () => {
    const rows = [
        base({ id: 'both', kind: 'path-case', compare: 'exact', platforms: ['linux', 'windows'] }),
        base({ id: 'windows', kind: 'file-identity', by: 'relative-path', platforms: ['windows'] }),
    ];
    const t = readRulesTable(table(rows));
    assert.deepEqual(
        rulesFor(t, 'linux').map((r) => r.id),
        ['both'],
    );
    assert.deepEqual(
        rulesFor(t, 'windows').map((r) => r.id),
        ['both', 'windows'],
    );
});

test('withRule adds a row and checks the table again', () => {
    const t = standInRules();
    const row = base({ id: 'extra', kind: 'path-case', compare: 'exact' }) as unknown as Rule;
    assert.equal(withRule(t, row).rules.length, t.rules.length + 1);
    assert.throws(
        () => withRule(t, { ...row, kind: 'nonsense' } as unknown as Rule),
        RulesTableError,
    );
});

test('the digest is of the canonical JSON: key order does not change it, a value does', () => {
    const t = standInRules();
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
