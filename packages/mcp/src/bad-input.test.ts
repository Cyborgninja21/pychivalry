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
import { connect, gameStub, MODS, scratch } from './testing.js';

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
