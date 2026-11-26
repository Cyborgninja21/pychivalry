import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFixtureMod, writeMod } from '../fix/testing.js';
import { committedSpec } from '../spec/testing.js';
import { tablesOf } from '../spec/tables.js';
import { prefixReadings } from './empty-iterator.js';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './style-empty-block.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-empty-block-bad');
    assert.deepEqual(found, expectedFindings('style-empty-block-bad'));
    assert.deepEqual(
        found.map((f) => [
            f.code,
            f.severity,
            f.data['block'],
            f.data['comments'],
            f.data['means'],
        ]),
        [
            [CODE, 'hint', 'limit', 'no', undefined],
            [CODE, 'hint', 'else', 'yes', 'effect'],
            [CODE, 'hint', 'any_child', 'no', 'at-least-one'],
            [CODE, 'hint', 'every_child', 'no', undefined],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-empty-block-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE} judges the blocks inside records, never a record itself`, () => {
    const found = (text: string): string[] =>
        checkText('common/scripted_effects/x.txt', text, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => f.args[0] ?? '');
    // An empty definition is how a mod blanks one of the base game's out: not judged.
    assert.deepEqual(found('my_effect = { }\n'), []);
    assert.deepEqual(found('my_effect = { add_gold = 1 list = { } { } }\n'), ['list', '{ }']);
    assert.deepEqual(found('my_effect = { color = rgb { } }\n'), ['color']);
});

/** Each empty block's name and what the rule says it means, in a scripted effect. */
function meanings(text: string): [string, string | readonly string[] | undefined][] {
    return checkText('common/scripted_effects/x.txt', text, {}, {}, { style: true })
        .filter((f) => f.code === CODE)
        .map((f) => [f.args[0] ?? '', f.data['means']]);
}

test(`${CODE}: an iterator that is a condition asks for at least one; an effect iterator, nothing`, () => {
    // Part D8: `any_` is a trigger whose body is conditions, the other three prefixes effects
    // whose body is effects. An empty condition still has a result; empty effects do nothing.
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\tif = { limit = { any_child = {} } add_gold = 2 }',
                '\tevery_child = {}',
                '\trandom_child = {}',
                '\tordered_child = {}',
                '\tevery_child = { limit = { any_spouse = {} } add_gold = 1 }',
                '}',
                '',
            ].join('\n'),
        ),
        [
            ['any_child', 'at-least-one'],
            ['every_child', undefined],
            ['random_child', undefined],
            ['ordered_child', undefined],
            ['any_spouse', 'at-least-one'],
        ],
    );
    // In a scripted trigger, whose body is a trigger block, and as the reader folds letter case.
    const trigger = checkText(
        'common/scripted_triggers/x.txt',
        'my_trigger = {\n\tis_adult = yes\n\tany_child = {}\n\tAny_spouse = {}\n}\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        trigger.map((f) => [f.args[0], f.data['means'], f.data['written_out']]),
        [
            ['any_child', 'at-least-one', 'count >= 1'],
            ['Any_spouse', 'at-least-one', 'count >= 1'],
        ],
    );
});

test(`${CODE}: a trigger or an effect written with an empty block is never offered for removal`, () => {
    // Taking the block away takes the trigger or the effect away: a change of what the script
    // does, which the rule never offers (decision 167). A structural key or a scope switch is
    // read as before.
    const mod = writeMod({
        'descriptor.mod': 'name="x"\n',
        'common/scripted_effects/x.txt':
            '﻿my_effect = {\r\n\tadd_gold = 1\r\n\thidden_effect = {}\r\n\tif = {\r\n\t\tlimit = {}\r\n\t\tadd_gold = 2\r\n\t}\r\n}\r\n',
        'common/scripted_triggers/x.txt':
            '﻿my_trigger = {\r\n\tis_adult = yes\r\n\ttrigger_if = {\r\n\t\tlimit = { is_adult = yes }\r\n\t\tis_female = yes\r\n\t}\r\n\ttrigger_else = {}\r\n}\r\n',
    });
    assert.deepEqual(
        checkFixtureMod(mod)
            .findings.filter((f) => f.code === CODE)
            .map((f) => [f.data['block'], f.data['means'], f.fix?.basis ?? null]),
        [
            ['hidden_effect', 'effect', null],
            ['limit', undefined, 'parser'],
            ['trigger_else', 'trigger', null],
        ],
    );
});

test(`${CODE}: an iterator the package does not say how to read where it is written means nothing known`, () => {
    // Of the other kind than its block (part D8's own first open point), in a script value and
    // in a keyword's parameters (neither a trigger nor an effect block): no removal is offered.
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\tany_child = {}',
                '\tif = { limit = { every_child = {} } add_gold = 2 }',
                '\tadd_gold = { every_child = {} }',
                '}',
                '',
            ].join('\n'),
        ),
        [
            ['any_child', 'not-known'],
            ['every_child', 'not-known'],
            ['every_child', 'not-known'],
        ],
    );
    // A prefix whose rest is no list is no iterator: the rule's usual case.
    assert.deepEqual(meanings('my_effect = { add_gold = 1 any_no_such_list_here = {} }\n'), [
        ['any_no_such_list_here', undefined],
    ]);
});

test(`${CODE}: the message says what a condition asks for, written out by its own parameter`, () => {
    const [found] = checkText(
        'common/scripted_triggers/x.txt',
        'my_trigger = {\n\tis_adult = yes\n\tany_child = {}\n}\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(found?.args, [
        'any_child',
        ": as a condition it asks for at least one; write 'count >= 1' in it to say so",
    ]);
    // Every other empty block's message is as it was.
    const [plain] = checkText(
        'common/scripted_effects/x.txt',
        'my_effect = { add_gold = 1 every_child = {} }\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(plain?.args, ['every_child', '']);
});

test("the test written out comes from the package: the condition's parameter the game documents with a number", () => {
    const spec = committedSpec();
    const readings = prefixReadings(spec);
    // Part D8's row of the one prefix whose kind is a condition points to two parameters of the
    // table, which its documented usage line writes `<count=num/all>` and `<percent=fixed_point>`:
    // the one written with a number says how many items must match.
    const conditions = [...readings].filter(([, r]) => r.kind === 'trigger');
    assert.deepEqual(
        conditions.map(([prefix, r]) => [prefix, r.body, r.atLeastOne]),
        [['any_', 'trigger', 'count >= 1']],
    );
    assert.equal(tablesOf(spec).iteratorParams.get('count')?.lists, '*');
    // The effect prefixes ask for nothing: their body is effects.
    for (const [prefix, r] of readings) {
        if (r.kind === 'effect') {
            assert.equal(r.body, 'effect', prefix);
            assert.equal(r.atLeastOne, null, prefix);
        }
    }
    assert.deepEqual([...readings.keys()].sort(), ['any_', 'every_', 'ordered_', 'random_']);
});

test(`${CODE}'s fix: never the removal of a condition; its test written out instead, as a suggestion`, () => {
    const mod = writeMod({
        'descriptor.mod': 'name="x"\n',
        'common/scripted_triggers/x.txt':
            '﻿my_trigger = {\r\n\tis_adult = yes\r\n\tany_child = {}\r\n\tany_spouse = {\r\n\t\t# Later.\r\n\t}\r\n}\r\n',
        'common/scripted_effects/x.txt':
            '﻿my_effect = {\r\n\tadd_gold = 1\r\n\tany_child = {}\r\n\tevery_child = {}\r\n}\r\n',
    });
    const found = checkFixtureMod(mod)
        .findings.filter((f) => f.code === CODE)
        .map((f) => [
            f.file,
            f.data['block'],
            f.fix?.safety ?? null,
            f.fix?.basis ?? null,
            f.fix?.alternatives.map((a) => [a.title, a.edits.map((e) => e.new_text)]) ?? null,
        ]);
    assert.deepEqual(found, [
        // An iterator of the other kind than its block: nothing is offered.
        ['common/scripted_effects/x.txt', 'any_child', null, null, null],
        // An effect iterator in an effect block: the empty pair taken away, as before.
        [
            'common/scripted_effects/x.txt',
            'every_child',
            'suggestion',
            'parser',
            [["Take the empty 'every_child' away", ['']]],
        ],
        [
            'common/scripted_triggers/x.txt',
            'any_child',
            'suggestion',
            'iterator-kinds',
            [["Write 'count >= 1' in the empty 'any_child'", ['{ count >= 1 }']]],
        ],
        // A condition holding a comment: its comment is left alone, so no edit is offered.
        ['common/scripted_triggers/x.txt', 'any_spouse', null, null, null],
    ]);
});
