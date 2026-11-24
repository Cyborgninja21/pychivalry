import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { applyEdits } from '../fix/apply.js';
import { staying, targetOrder } from '../fix/field-order.js';
import { checkFixtureMod } from '../fix/testing.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { parse } from '../syntax/parser.js';
import type { Pair } from '../syntax/tree.js';
import { bodyFieldOrder, FIELD_ORDERS, JUDGED_FOLDERS } from './field-order.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, fieldsReadByName, firstOutOfOrder } from './style-unusual-field-order.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

const spec = committedSpec();
const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');
const FILE = 'common/on_action/fixture_on_actions.txt';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-unusual-field-order-bad');
    assert.deepEqual(found, expectedFindings('style-unusual-field-order-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['record'], f.data['field'], f.data['after']]),
        [
            [CODE, 'hint', 'fixture_on_action', 'trigger', 'effect'],
            [CODE, 'hint', 'fixture_unclear', 'trigger', 'effect'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-unusual-field-order-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
});

test('the fix writes the record as the good fixture does, comments with their fields', () => {
    const bad = readFileSync(path.join(MODS, 'style-unusual-field-order-bad', FILE), 'utf8');
    const good = readFileSync(path.join(MODS, 'style-unusual-field-order-good', FILE), 'utf8');
    const run = checkFixtureMod(path.join(MODS, 'style-unusual-field-order-bad'));
    const fixes = run.findings.filter((f) => f.code === CODE).map((f) => f.fix);
    // The record whose comment's field is not clear has no fix.
    assert.deepEqual(
        fixes.map((f) => f?.safety ?? null),
        ['safe', null],
    );
    const fixed = applyEdits(bad, fixes[0]?.alternatives[0]?.edits ?? []);
    // The fixed record reads as the good fixture's; the other keeps its order. (The files'
    // first lines, a comment saying which they are, differ.)
    const records = (text: string): string[] =>
        text.slice(text.indexOf('\n') + 1).split('\r\n\r\n');
    assert.equal(records(fixed)[0], records(good)[0]);
    assert.equal(records(fixed)[1], records(bad)[1]);
});

test('on a record written on one line the fix rewrites the line, its spaces kept', () => {
    const text = 'x = { effect = { add_gold = 1 } trigger = { is_adult = yes } }\n';
    const found = checkText(FILE, text, {}, {}, { style: true }).filter((f) => f.code === CODE);
    assert.equal(found.length, 1);
    const run = checkFixtureMod(path.join(MODS, 'style-unusual-field-order-good'), undefined, {
        [FILE]: new TextEncoder().encode(text),
    });
    const fix = run.findings.find((f) => f.code === CODE)?.fix;
    assert.equal(fix?.safety, 'safe');
    assert.equal(
        applyEdits(text, fix.alternatives[0]?.edits ?? []),
        'x = { trigger = { is_adult = yes } effect = { add_gold = 1 } }\n',
    );
});

test('the field-order data names only fields of its folders, each once; the judged folders are read by name', () => {
    assert.equal(FIELD_ORDERS.size, 8);
    for (const [folder, orders] of FIELD_ORDERS) {
        assert.ok(Object.hasOwn(spec.data.schema, folder), folder);
        assert.equal(fieldsReadByName(spec, folder), true, folder);
        for (const order of orders) {
            assert.equal(order.block, '', folder);
            assert.equal(new Set(order.fields).size, order.fields.length, folder);
            for (const field of order.fields) {
                assert.ok(
                    Object.hasOwn(spec.data.schema[folder]?.fields ?? {}, field),
                    `${folder}: ${field}`,
                );
            }
        }
    }
    assert.deepEqual([...JUDGED_FOLDERS].sort(), [
        'common/casus_belli_types',
        'common/court_positions/types',
        'common/on_action',
        'common/schemes/scheme_types',
        'common/story_cycles',
        'events',
    ]);
    // A folder whose records are effects, triggers or script values is never read by name.
    for (const folder of [
        'common/scripted_effects',
        'common/scripted_triggers',
        'common/script_values',
    ]) {
        assert.equal(fieldsReadByName(spec, folder), false, folder);
    }
});

test(`${CODE} leaves alone a record that holds anything but fields, and two folders the base game does not follow`, () => {
    const found = (file: string, text: string): number =>
        checkText(file, text, {}, {}, { style: true }).filter((f) => f.code === CODE).length;
    const onAction = (body: string): number => found(FILE, `x = { ${body} }\n`);
    assert.equal(onAction('effect = { add_gold = 1 } trigger = { is_adult = yes }'), 1);
    // A bare value, an unknown key, a comparison, a parameter: not judged.
    assert.equal(onAction('effect = { add_gold = 1 } trigger = { is_adult = yes } stray'), 0);
    assert.equal(onAction('effect = { add_gold = 1 } trigger = { is_adult = yes } made_up = 1'), 0);
    assert.equal(onAction('effect = { add_gold = 1 } trigger > 1'), 0);
    assert.equal(onAction('effect = { add_gold = 1 } $T$ = { is_adult = yes }'), 0);
    // A field the order does not name keeps its place and does not count.
    assert.equal(onAction('effect = { add_gold = 1 } fallback = x'), 0);
    // common/decisions has an order, but the base game breaks it more often than it follows it.
    assert.ok(bodyFieldOrder('common/decisions') !== undefined);
    assert.equal(
        found(
            'common/decisions/x.txt',
            'd = { effect = { add_gold = 1 } is_shown = { always = yes } }\n',
        ),
        0,
    );
});

function pairsOf(text: string): Pair[] {
    const record = parse(text).file.items[0];
    assert.ok(record?.kind === 'pair' && record.value?.kind === 'block');
    return record.value.items.filter((i): i is Pair => i.kind === 'pair');
}

test("a field's copies keep their order; the fields the order does not name keep their places", () => {
    const pairs = pairsOf('x = { c = 1 a = 1 z = 1 b = 1 a = 2 }');
    const order = ['a', 'b', 'c'];
    assert.deepEqual(firstOutOfOrder(pairs, order)?.field.key.text, 'a');
    // a (1), a (2), b fill the places of c, a, b; z stays.
    assert.deepEqual(
        targetOrder(pairs, order).map(
            (i) =>
                `${pairs[i]?.key.text ?? ''}${pairs[i]?.value?.kind === 'scalar' ? pairs[i].value.text : ''}`,
        ),
        ['a1', 'a2', 'z1', 'b1', 'c1'],
    );
    assert.equal(firstOutOfOrder(pairsOf('x = { a = 1 a = 2 b = 1 }'), order), null);
});

test('the fix moves the fewest characters: the largest fields in order stay', () => {
    // Places after the fix: field 0 goes to 2, 1 to 0, 2 to 1.
    assert.deepEqual([...staying([1, 2, 0], [100, 1, 1])].sort(), [0]);
    assert.deepEqual([...staying([1, 2, 0], [1, 50, 50])].sort(), [1, 2]);
});
