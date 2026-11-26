import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { keywordRolesOf } from './keyword-roles.js';
import { CODE } from './style-redundant-condition.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-redundant-condition-bad');
    assert.deepEqual(found, expectedFindings('style-redundant-condition-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['block']]),
        [
            [CODE, 'hint', 'AND'],
            [CODE, 'hint', 'NAND'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-redundant-condition-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE} reads its keywords from part D4's roles`, () => {
    const roles = keywordRolesOf(committedSpec());
    assert.deepEqual(
        roles.withRoles('constant_condition').map((r) => [r.keyword, r.holdsWith, r.failsWith]),
        [['always', 'yes', 'no']],
    );
    assert.deepEqual(
        roles
            .withRoles('combines_conditions')
            .filter((r) => r.childAlwaysTrue === 'neutral')
            .map((r) => r.keyword)
            .sort(),
        ['AND', 'NAND', 'any_false'],
    );
});

test(`${CODE} never decides on an empty block, nor on a block the part says nothing of`, () => {
    const found = (body: string): string[] =>
        checkText('common/scripted_triggers/x.txt', `x = {\n${body}\n}\n`, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => `${String(f.data['block'])} ${String(f.range.start.line)}`);
    // Alone in its block: taking it away would leave the block empty, whose value is open.
    assert.deepEqual(found('\tAND = { always = yes }'), []);
    // Of two, one is reported; the block keeps the other.
    assert.deepEqual(found('\tAND = {\n\t\talways = yes\n\t\talways = yes\n\t}'), ['AND 3']);
    // A plain trigger block, an OR (which it makes hold) and a NOT have no neutral answer.
    assert.deepEqual(found('\talways = yes\n\tis_adult = yes'), []);
    assert.deepEqual(found('\tOR = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
    assert.deepEqual(found('\tNOT = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
    // `always = no` is not a condition that always holds.
    assert.deepEqual(found('\tAND = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
    // `and` and `And` are read as the game's trigger `and`, of which part D4 says nothing.
    assert.deepEqual(found('\tand = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
});
