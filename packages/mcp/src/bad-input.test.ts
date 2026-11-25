/**
 * Bad input (docs/PLAN.md item 6.4): every kind of bad argument comes back as a tool result
 * marked as an error, never as a protocol error, and its text names the valid values, so that
 * an agent can correct its call from the result alone. Also the validator's own text, without
 * a server.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { problems, type Schema } from './schema.js';
import { connect, gameStub, MODS, scratch, write } from './testing.js';

test('bad arguments are results that name the valid values', async (t) => {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'));
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    const cases: [string, Record<string, unknown>, RegExp][] = [
        [
            'check',
            { min_severity: 'fatal' },
            /min_severity: "fatal" is not one of the valid values: error, warning, information, hint/,
        ],
        ['check', { limit: 0 }, /limit: 0 is out of range; it must be from 1 to 200/],
        ['check', { limit: 'ten' }, /limit: "ten" is not a whole number/],
        [
            'check',
            { severity: 'error' },
            /severity: no such argument; the arguments are path, min_severity, codes, limit, cursor, unused_keys/,
        ],
        [
            'check',
            { codes: ['names/no-such-check'] },
            /codes: names\/no-such-check matches no code of this build; the codes are .*names\/unknown-trigger.*; a whole family is written .*names\/\*/,
        ],
        ['check', { codes: [] }, /codes: give at least 1/],
        ['check', { path: '../elsewhere' }, /path: \.\.\/elsewhere is outside the mod/],
        [
            'check',
            { path: 'no/such/file.txt' },
            /path: the mod has no file or folder no\/such\/file\.txt; its folder holds README\.md, common\/, descriptor\.mod, events\/, expected\.json/,
        ],
        ['check', { cursor: 'not-a-cursor' }, /cursor: not a cursor this server gave/],
        ['lookup', {}, /names: missing; it is required/],
        [
            'lookup',
            { names: ['x'], cursor: 'abc' },
            /cursor: no such argument; the arguments are names, language, folder/,
        ],
        [
            'lookup',
            { names: ['x'], folder: 'nowhere/at_all' },
            /folder: nowhere\/at_all is not a folder the game reads; give the folder's path from the mod's top/,
        ],
        [
            'lookup',
            { names: ['x'.repeat(121)] },
            /names\[0\]: longer than 120 characters; no name of the game or a mod is that long/,
        ],
        ['source', { layer: 'mod', file: 'x.txt' }, /line: missing; it is required/],
        [
            'source',
            { layer: 'nope', file: 'x.txt', line: 1 },
            /layer: nope is not a layer read here; the layers are mod, game/,
        ],
        [
            'source',
            { layer: 'mod', file: '../outside.txt', line: 1 },
            /file: the path may hold no empty, \. or \.\. part/,
        ],
        [
            'source',
            { layer: 'mod', file: 'common/scripted_triggers/fixture_triggers.txt', line: 999 },
            /line: 999 is past the end of common\/scripted_triggers\/fixture_triggers\.txt, which has \d+ lines/,
        ],
        [
            'source',
            {
                layer: 'mod',
                file: 'common/scripted_triggers/fixture_triggers.txt',
                line: 3,
                end_line: 2,
            },
            /end_line: 2 is before line 3/,
        ],
        [
            'source',
            {
                layer: 'mod',
                file: 'common/scripted_triggers/fixture_triggers.txt',
                line: 1,
                context: 21,
            },
            /context: 21 is out of range; it must be from 0 to 20/,
        ],
        ['lookup', { names: 'trait' }, /names: "trait" is not a list/],
        [
            'lookup',
            { names: Array.from({ length: 21 }, (_, i) => `n${String(i)}`) },
            /names: give at most 20 in one call \(21 given\); ask again for the rest/,
        ],
        ['find_definition', {}, /nothing to find; give either name, or file with line and column/],
        [
            'find_definition',
            { name: 'x', file: 'a.txt' },
            /name and a place were both given; give either name, or file with line and column/,
        ],
        [
            'find_definition',
            { file: 'common/scripted_triggers/fixture_triggers.txt', line: 3 },
            /a place needs all three of file, line and column/,
        ],
        [
            'find_definition',
            { file: 'common/scripted_triggers/fixture_triggers.txt', line: 999, column: 1 },
            /line: 999 is past the end of common\/scripted_triggers\/fixture_triggers\.txt, which has \d+ lines/,
        ],
        ['find_definition', { file: 'common', line: 1, column: 1 }, /file: common is a folder/],
        [
            'find_references',
            { name: 'x', limit: 201 },
            /limit: 201 is out of range; it must be from 1 to 200/,
        ],
        [
            'list_definitions',
            { kind: 'scripted_effects' },
            /kind: scripted_effects holds no definition in the mod or the base game; .*the kinds the mod defines are common\/scripted_triggers/,
        ],
        [
            'explain_code',
            { codes: ['nope'] },
            /codes: nope is no code of this build; the codes are .*syntax\//,
        ],
        ['format', { file: 'nope.txt' }, /file: the mod has no file or folder nope.txt/],
        [
            'format',
            { file: 'descriptor.mod' },
            /file: descriptor.mod is not a script or localization file/,
        ],
        ['format', { file: '../outside.txt' }, /file: \.\.\/outside.txt is outside the mod/],
        ['apply_format', { file: 'nope.txt' }, /file: the mod has no file or folder nope.txt/],
        [
            'apply_format',
            { file: 'descriptor.mod' },
            /file: descriptor.mod is not a script or localization file/,
        ],
        ['apply_format', { file: '../outside.txt' }, /file: \.\.\/outside.txt is outside the mod/],
        ['apply_format', { file: 'events' }, /file: events is a folder/],
    ];
    for (const [tool, args, expected] of cases) {
        const result = await s.call(tool, args);
        assert.equal(result.isError, true, `${tool} ${JSON.stringify(args)} is an error result`);
        const text = result.content.map((c) => c.text ?? '').join('\n');
        assert.match(text, expected, `${tool} ${JSON.stringify(args)}`);
    }
});

test('a cursor given with other arguments is bad input, not a wrong page', async (t) => {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'));
    const mod = path.join(MODS, 'parse-broken-syntax');
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    const first = await s.output('check', { min_severity: 'hint', limit: 1 });
    const cursor = first['next_cursor'];
    assert.equal(typeof cursor, 'string');
    const same = await s.output('check', { min_severity: 'hint', limit: 1, cursor });
    assert.equal(same['matched'], first['matched']);
    const other = await s.error('check', { min_severity: 'error', cursor });
    assert.match(other, /cursor: it was given for other arguments/);
    const elsewhere = await s.error('find_references', { name: 'x', cursor });
    assert.match(elsewhere, /cursor: it was given for other arguments/);
    // The way out is in the text: the same arguments to continue, no cursor for anything else.
    assert.match(
        other,
        /repeated with exactly the same arguments; to ask anything else, call again without cursor/,
    );
});

test("lookup answers the expert run's three names whole in one call, and takes no cursor", async (t) => {
    // The expert requests' development run (2026-11-25): sessions looked up three names, the
    // third name's head (its uses, each a place in a game file) ended the first page and its
    // readings went on to the next, and two sessions then gave the cursor with that name alone,
    // which the server refused (9 of the run's 12 tool errors were cursors given with other
    // names). Since tool schema version 4 the same call answers all three whole: each its
    // readings first, then its definitions, then how many places use it with the first three;
    // lookup has no cursor to give or to misuse. The stub game gives the run's shape: each name
    // used in 20 files of the game, with long paths.
    const dir = scratch(t);
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
        const n = String(i).padStart(2, '0');
        files[`common/scripted_triggers/${'t'.repeat(115)}_${n}.txt`] =
            `stub_trigger_${n} = { popular_opinion < -20 }\n`;
        files[`common/scripted_effects/${'e'.repeat(115)}_${n}.txt`] =
            `stub_effect_${n} = { add_popular_opinion = 10 }\n`;
    }
    const game = gameStub(path.join(dir, 'install'), files);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Empty"\n');
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    const names = ['popular_opinion', 'change_popular_opinion', 'add_popular_opinion'];
    const first = await s.output('lookup', { names });
    assert.equal(first['not_answered'], null);
    assert.equal('next_cursor' in first, false);
    const results = first['results'] as Record<string, unknown>[];
    assert.deepEqual(
        results.map((r) => [r['name'], (r['readings'] as unknown[]).length]),
        [
            ['popular_opinion', 2],
            ['change_popular_opinion', 1],
            ['add_popular_opinion', 2],
        ],
    );
    // Each answer's readings come first, then where it is defined, then its uses.
    for (const r of results) {
        assert.deepEqual(Object.keys(r).slice(0, 3), ['name', 'unknown', 'readings']);
    }
    // add_popular_opinion's readings, what the session went on looking for, are in this answer:
    // the effect and its documented usage.
    const add = JSON.stringify(results[2]?.['readings']);
    assert.match(add, /"bucket":"effects"/);
    assert.match(add, /scope:county = \{ add_popular_opinion = 10 \}/);
    const uses = results[2]?.['uses'] as {
        count: number;
        first: { layer: string; file: string; read_with?: string }[];
    };
    assert.equal(uses.count, 20, 'every use counted');
    assert.equal(uses.first.length, 3, 'three shown; find_references lists all');
    assert.ok(uses.first.every((u) => u.layer === 'game' && u.read_with === 'source'));
    // What the two sessions did, and the session that repeated the names: a cursor is no
    // argument of lookup, and the name alone is the same answer as in the call of three.
    assert.match(
        await s.error('lookup', { names: ['add_popular_opinion'], cursor: 'b2Zmc2V0' }),
        /cursor: no such argument; the arguments are names, language, folder/,
    );
    const alone = await s.output('lookup', { names: ['add_popular_opinion'] });
    assert.deepEqual((alone['results'] as unknown[])[0], results[2]);
});

test("the argument check's text, without a server", () => {
    const shape: Schema = {
        type: 'object',
        properties: {
            names: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
            size: { type: 'integer', minimum: 1 },
            on: { type: 'boolean' },
        },
        required: ['names'],
        additionalProperties: false,
    };
    assert.deepEqual(problems(shape, { names: ['a'] }), []);
    assert.deepEqual(problems(shape, 'x'), ['the arguments: "x" is not an object']);
    assert.deepEqual(problems(shape, { names: ['', 3], size: 1.5, on: 'yes', more: 1 }), [
        'names[0]: must not be empty',
        'names[1]: 3 is not a text',
        'size: 1.5 is not a whole number',
        'on: "yes" is not true or false',
        'more: no such argument; the arguments are names, size, on',
    ]);
    assert.deepEqual(problems(shape, { size: 0 }), [
        'names: missing; it is required',
        'size: 0 is out of range; it must be 1 or more',
    ]);
});
