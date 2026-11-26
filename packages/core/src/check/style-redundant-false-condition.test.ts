import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { keywordRolesOf } from './keyword-roles.js';
import { CODE as HOLDS } from './style-redundant-condition.js';
import { CODE } from './style-redundant-false-condition.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-redundant-false-condition-bad');
    assert.deepEqual(found, expectedFindings('style-redundant-false-condition-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['block']]),
        [
            [CODE, 'hint', 'OR'],
            [CODE, 'hint', 'NOR'],
            [CODE, 'hint', 'all_false'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-redundant-false-condition-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE} reads its keywords from part D4's roles`, () => {
    const roles = keywordRolesOf(committedSpec());
    assert.deepEqual(
        roles.withRoles('constant_condition').map((r) => [r.keyword, r.failsWith]),
        [['always', 'no']],
    );
    assert.deepEqual(
        roles
            .withRoles('combines_conditions')
            .filter((r) => r.childAlwaysFalse === 'neutral')
            .map((r) => r.keyword)
            .sort(),
        ['NOR', 'OR', 'all_false'],
    );
});

test(`${CODE} never decides on an empty block, nor on a block the part says nothing of`, () => {
    const found = (body: string): string[] =>
        checkText('common/scripted_triggers/x.txt', `x = {\n${body}\n}\n`, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => `${String(f.data['block'])} ${String(f.range.start.line)}`);
    // Alone in its block: taking it away would leave the block empty, whose value is open.
    assert.deepEqual(found('\tOR = { always = no }'), []);
    // Of two, one is reported; the block keeps the other.
    assert.deepEqual(found('\tOR = {\n\t\talways = no\n\t\talways = no\n\t}'), ['OR 3']);
    // A plain trigger block, an AND (which it makes fail), a NAND (which it makes hold) and a
    // NOT have no neutral answer for a condition that always fails.
    assert.deepEqual(found('\talways = no\n\tis_adult = yes'), []);
    assert.deepEqual(found('\tAND = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
    assert.deepEqual(found('\tNAND = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
    assert.deepEqual(found('\tNOT = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
    // `always = yes` is not a condition that always fails.
    assert.deepEqual(found('\tOR = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
    // `or` and `Or` are read as the game's trigger `or`, of which part D4 says nothing.
    assert.deepEqual(found('\tor = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
});

test(`${CODE} leaves ${HOLDS} as it was: each judges its own fixed result, never the other's`, () => {
    const codes = (body: string): string[] =>
        checkText('common/scripted_triggers/x.txt', `x = {\n${body}\n}\n`, {}, {}, { style: true })
            .filter((f) => f.code === CODE || f.code === HOLDS)
            .map((f) => `${f.code} ${String(f.data['block'])}`);
    assert.deepEqual(codes('\tAND = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), [
        `${HOLDS} AND`,
    ]);
    assert.deepEqual(codes('\tOR = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), [`${CODE} OR`]);
    // An OR holding both: the one that always holds makes it hold, the one that always fails
    // changes nothing; only the second is reported, and the block keeps the first.
    assert.deepEqual(codes('\tOR = {\n\t\talways = yes\n\t\talways = no\n\t}'), [`${CODE} OR`]);
    // A block the reader reads as a trigger whose body holds triggers: this code judges every
    // block part D4 names (`all_false`); the other code was built on structural keywords only
    // and is left so, its `any_false` not judged (decision 158 keeps its meaning).
    assert.deepEqual(codes('\tall_false = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), [
        `${CODE} all_false`,
    ]);
    assert.deepEqual(codes('\tany_false = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
});
