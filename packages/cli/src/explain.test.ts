/**
 * `explain` (explain.ts): a code's row of the check inventory, from the data the core
 * exposes, as text and as JSON; patterns; unknown codes; exit codes.
 */

import assert from 'node:assert/strict';
import { inventoryRows } from '@pychivalry/core';
import { test } from 'node:test';
import { runCli, scratch } from './testing.js';

test('explain renders a code: severity, what it finds, and its evidence with the game message', (t) => {
    const cache = scratch(t);
    const r = runCli(['explain', 'names/unknown-trigger'], { cache });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
        r.stdout,
        [
            'names/unknown-trigger  error',
            '  Finds: A key in a trigger block that is no trigger there.',
            `  Evidence: the game's own message unknown_trigger_X: "Unknown trigger '<trigger>'"`,
            '',
        ].join('\n'),
    );
    const advice = runCli(['explain', 'syntax/unterminated-string'], { cache });
    assert.match(advice.stdout, /^syntax\/unterminated-string {2}information\n/);
    assert.match(advice.stdout, /Evidence: none: this is pychivalry's own advice/);
    assert.match(advice.stdout, /Message: "Unterminated string starting at '<file:line>'"/);
    const output = runCli(['explain', 'names/modifier-outside-use-area'], { cache });
    assert.match(output.stdout, /Evidence: the game's own output, with no message of its own: /);
});

test('explain shows no raw placeholder: each value is a readable slot', (t) => {
    // Item 6.11: the agent server showed "The %s is missing a field the spec package marks
    // required."; the command line's explain showed the game's messages with their %s.
    const cache = scratch(t);
    const required = runCli(['explain', 'fields/missing-required-field'], { cache });
    assert.match(
        required.stdout,
        /Message: the place's own; with none, "The <record> is missing a field the spec package marks required\."/,
    );
    for (const json of [false, true]) {
        const all = runCli(['explain', '*', ...(json ? ['--json'] : [])], { cache });
        assert.equal(all.code, 0);
        assert.doesNotMatch(all.stdout, /%s|\{\}/);
    }
});

test('explain takes several codes and patterns, each code once, in the order asked', (t) => {
    const cache = scratch(t);
    const r = runCli(['explain', 'syntax/missing-value', 'names/*', 'names/unknown-link'], {
        cache,
    });
    assert.equal(r.code, 0);
    const codes = r.stdout
        .split('\n')
        .filter((l) => /^\S/.test(l))
        .map((l) => l.split(' ')[0]);
    const names = inventoryRows()
        .filter((row) => row.family === 'names')
        .map((row) => row.code);
    assert.deepEqual(codes, ['syntax/missing-value', ...names]);
    const all = runCli(['explain', '*'], { cache });
    assert.equal(
        all.stdout.split('\n').filter((l) => /^\S/.test(l)).length,
        inventoryRows().length,
    );
});

test('explain --json: one object per code, an unknown code marked unknown, exit code 1', (t) => {
    const cache = scratch(t);
    const r = runCli(['explain', 'names/unknown-effect', 'names/no-such-check', '--json'], {
        cache,
    });
    assert.equal(r.code, 1);
    assert.equal(r.stderr, '');
    const lines = r.stdout
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.deepEqual(lines, [
        {
            code: 'names/unknown-effect',
            known: true,
            family: 'names',
            severity: 'error',
            finds: 'A key in an effect block that is no effect there.',
            evidence: {
                kind: 'catalogue',
                id: 'unknown_effect_X',
                text: "Unknown effect '<effect>'",
            },
            message: "Unknown effect '<effect>'",
            off_by_default: false,
            can_turn_off: false,
        },
        { code: 'names/no-such-check', known: false },
    ]);
    const text = runCli(['explain', 'nope'], { cache });
    assert.equal(text.code, 1);
    assert.equal(text.stdout, '');
    assert.match(text.stderr, /nope is no code of this build/);
});

test('explain needs a code', (t) => {
    const cache = scratch(t);
    const r = runCli(['explain'], { cache });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /explain needs <code>\.\.\./);
    assert.equal(runCli(['explain', 'x', '--limit', '3'], { cache }).code, 2);
});
