import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { parse } from '../syntax/parser.js';
import { readContext, type JudgedKey } from './context.js';
import { CHECK_KINDS } from './finding.js';
import { keywordRolesOf } from './keyword-roles.js';
import { CODE, check } from './style-redundant-condition.js';
import { CODE as FAILS, check as failsCheck } from './style-redundant-false-condition.js';
import { checkText, expectedFindings, specContext, styleFixture } from './testing.js';

const spec = committedSpec();

/** How the context reader reads the first key inside the first record of a scripted trigger. */
function firstPairOf(text: string): JudgedKey {
    const tree = parse(text).file;
    const reading = readContext({
        spec,
        folders: specContext().folders,
        file: 'common/scripted_triggers/x.txt',
        tree,
        names: { isDefined: () => false },
    });
    const first = reading.keys[0];
    assert.ok(first !== undefined);
    return first;
}

/** How many blocks each of the two rules judged on a text read as `file`. */
function judgedOn(text: string, file = 'common/scripted_triggers/x.txt'): Record<string, number> {
    const parsed = parse(text);
    const input = {
        spec,
        folders: specContext().folders,
        file,
        tree: parsed.file,
        names: { isDefined: () => false },
        context: { lines: parsed.lines },
        invalid: [],
        encoding: 'utf-8',
    } as const;
    return { [CODE]: check.run(input).judged, [FAILS]: failsCheck.run(input).judged };
}

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-redundant-condition-bad');
    assert.deepEqual(found, expectedFindings('style-redundant-condition-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['block']]),
        [
            [CODE, 'hint', 'AND'],
            [CODE, 'hint', 'NAND'],
            [CODE, 'hint', 'any_false'],
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
    const roles = keywordRolesOf(spec);
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
    assert.deepEqual(found('\tany_false = { always = yes }'), []);
    // Of two, one is reported; the block keeps the other.
    assert.deepEqual(found('\tAND = {\n\t\talways = yes\n\t\talways = yes\n\t}'), ['AND 3']);
    assert.deepEqual(found('\tany_false = {\n\t\talways = yes\n\t\talways = yes\n\t}'), [
        'any_false 3',
    ]);
    // A plain trigger block, an OR (which it makes hold) and a NOT have no neutral answer.
    assert.deepEqual(found('\talways = yes\n\tis_adult = yes'), []);
    assert.deepEqual(found('\tOR = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
    assert.deepEqual(found('\tNOT = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
    // `always = no` is not a condition that always holds.
    assert.deepEqual(found('\tAND = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
    // `and` and `And` are read as the game's trigger `and`, of which part D4 says nothing.
    assert.deepEqual(found('\tand = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
});

test(`${CODE} judges every block part D4 names, whatever the reader reads it as (decision 163)`, () => {
    const found = (body: string): string[] =>
        checkText('common/scripted_triggers/x.txt', `x = {\n${body}\n}\n`, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => `${String(f.data['block'])} ${String(f.range.start.line)}`);
    // The reader reads `AND` as a structural keyword and `any_false` as a trigger whose body
    // holds triggers (a container of the tables); part D4's row is what decides.
    const text = firstPairOf('x = {\n\tany_false = {\n\t\talways = yes\n\t}\n}\n');
    assert.deepEqual(
        [text.reading.kind, text.reading.kind === 'keyword' ? text.reading.bucket : null],
        ['keyword', 'triggers'],
    );
    assert.deepEqual(found('\tany_false = {\n\t\tis_adult = yes\n\t\talways = yes\n\t}'), [
        'any_false 3',
    ]);
    // Nested in another judged block, each block is judged on its own children.
    assert.deepEqual(
        found(
            '\tAND = {\n\t\talways = yes\n\t\tany_false = {\n\t\t\talways = yes\n\t\t\tis_adult = yes\n\t\t}\n\t}',
        ),
        ['AND 2', 'any_false 4'],
    );
    // In an `any_false` a condition that always fails makes it hold: no neutral answer.
    assert.deepEqual(found('\tany_false = {\n\t\talways = no\n\t\tis_adult = yes\n\t}'), []);
    // `all_false`, which part D4 makes fail on a condition that always holds, is not judged.
    assert.deepEqual(found('\tall_false = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), []);
    // The reader reads `Any_False` as `any_false`, letter case aside, and so does the check.
    assert.deepEqual(found('\tAny_False = {\n\t\talways = yes\n\t\tis_adult = yes\n\t}'), [
        'any_false 2',
    ]);
});

test(`${CODE} counts as judged each block part D4 names, and no other`, () => {
    const text =
        'x = {\n' +
        ['AND', 'NAND', 'any_false', 'OR', 'NOR', 'all_false', 'NOT', 'trigger_if', 'and']
            .map((k) => `\t${k} = {\n\t\tis_adult = yes\n\t}\n`)
            .join('') +
        '}\n';
    assert.deepEqual(judgedOn(text), {
        [CODE]: 3,
        [FAILS]: 3,
    });
    // A block in an effect block, or in a block that is no context, is not judged.
    assert.deepEqual(
        judgedOn('x = {\n\tAND = { is_adult = yes }\n}\n', 'common/scripted_effects/x.txt'),
        { [CODE]: 0, [FAILS]: 0 },
    );
});
