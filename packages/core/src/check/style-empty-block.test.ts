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
            [CODE, 'hint', 'limit', 'no', 'trigger-block'],
            [CODE, 'hint', 'else', 'yes', 'effect'],
            [CODE, 'hint', 'any_child', 'no', 'at-least-one'],
            [CODE, 'hint', 'every_child', 'no', undefined],
            [CODE, 'hint', 'liege', 'no', 'scope-switch'],
            [CODE, 'hint', 'OR', 'no', 'logical-operator'],
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
    // does, which the rule never offers (decision 167, its extension confirmed by decision 171).
    // An empty `limit` is a trigger block whose meaning the package leaves open (decision 172).
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
            ['limit', 'trigger-block', null],
            ['trigger_else', 'trigger', null],
        ],
    );
});

test(`${CODE}: an empty trigger block's meaning is left open by the package`, () => {
    // A structural keyword or a parameter of the block around it whose block the package's
    // tables read as triggers, and that part D4 gives no `combines_conditions` row: a `limit`,
    // an `alternative_limit`, a `random_list` entry's `trigger` (decision 172).
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\tif = { limit = {} add_gold = 2 }',
                '\trandom_list = {',
                '\t\t10 = { trigger = {} add_gold = 1 }',
                '\t\t20 = { add_gold = 2 }',
                '\t}',
                '\trandom_in_list = { list = x limit = { is_adult = yes } alternative_limit = {} add_gold = 1 }',
                '}',
                '',
            ].join('\n'),
        ),
        [
            ['limit', 'trigger-block'],
            ['trigger', 'trigger-block'],
            ['alternative_limit', 'trigger-block'],
        ],
    );
    // Where the reader judges no key, by the table `structural`: a `limit` in a script value.
    const value = checkText(
        'common/script_values/x.txt',
        'my_value = {\n\tvalue = 1\n\tif = { limit = {} add = 1 }\n}\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        value.map((f) => [f.args[0], f.data['means']]),
        [['limit', 'trigger-block']],
    );
    // A record's own trigger field is a field's default either way: read as before.
    const event = checkText(
        'events/x.txt',
        [
            'namespace = x',
            'x.1 = {',
            '\ttype = character_event',
            '\thidden = yes',
            '\ttrigger = {}',
            '\timmediate = { add_gold = 1 }',
            '}',
            '',
        ].join('\n'),
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        event.map((f) => [f.args[0], f.data['means']]),
        [['trigger', undefined]],
    );
});

test(`${CODE}: an empty scope switch's meaning is left open by the package`, () => {
    // A chain or a name of the links bucket, its block read in the scope it switches to, in an
    // effect block and in a trigger block (decision 172); `root` is a link the table
    // `structural` also lists.
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\tscope:target = {}',
                '\tliege = {}',
                '\troot = {}',
                '\tif = { limit = { is_adult = yes father = {} } add_gold = 2 }',
                '}',
                '',
            ].join('\n'),
        ),
        [
            ['scope:target', 'scope-switch'],
            ['liege', 'scope-switch'],
            ['root', 'scope-switch'],
            ['father', 'scope-switch'],
        ],
    );
    // Where the reader judges no key, by its own rule that a chain or a link there is a scope
    // switch: in a script value.
    const value = checkText(
        'common/script_values/x.txt',
        'my_value = {\n\tvalue = 1\n\tscope:owner = {}\n}\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        value.map((f) => [f.args[0], f.data['means']]),
        [['scope:owner', 'scope-switch']],
    );
    // A case of a `switch` is no scope switch, though its key is a chain: read as before.
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\tswitch = {',
                '\t\ttrigger = var:x',
                '\t\tflag:a = {}',
                '\t\tflag:b = { add_gold = 1 }',
                '\t}',
                '}',
                '',
            ].join('\n'),
        ),
        [['flag:a', undefined]],
    );
});

test(`${CODE}: an empty logical operator's meaning is left open by the package`, () => {
    // Every key part D4 gives the role `combines_conditions`, whatever the reader calls it: a
    // structural keyword (`OR`, `NOT`) or a trigger of the triggers bucket (`all_false`), which
    // was a trigger written with an empty block before (decision 172).
    const trigger = checkText(
        'common/scripted_triggers/x.txt',
        'my_trigger = {\n\tis_adult = yes\n\tOR = {}\n\tNOT = {}\n\tall_false = {}\n\tand = {}\n}\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        trigger.map((f) => [f.args[0], f.data['means']]),
        [
            ['OR', 'logical-operator'],
            ['NOT', 'logical-operator'],
            ['all_false', 'logical-operator'],
            // The reader reads `and` as the game's own trigger, of which part D4 says nothing.
            ['and', 'trigger'],
        ],
    );
    // In a limit of an effect block, and where the reader judges no key: an AI weight's
    // `modifier`, read as a script value.
    assert.deepEqual(
        meanings(
            'my_effect = { add_gold = 1 if = { limit = { is_adult = yes OR = {} } add_gold = 2 } }\n',
        ),
        [['OR', 'logical-operator']],
    );
    const value = checkText(
        'common/script_values/x.txt',
        'my_value = {\n\tvalue = 10\n\tmodifier = {\n\t\tfactor = 0\n\t\tOR = {}\n\t}\n}\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        value.map((f) => [f.args[0], f.data['means']]),
        [['OR', 'logical-operator']],
    );
});

test(`${CODE}: no fix for a block whose empty meaning is left open`, () => {
    const mod = writeMod({
        'descriptor.mod': 'name="x"\n',
        'common/scripted_effects/x.txt':
            '\uFEFFmy_effect = {\r\n\tadd_gold = 1\r\n\tif = {\r\n\t\tlimit = {\r\n\t\t\tis_adult = yes\r\n\t\t\tOR = {}\r\n\t\t}\r\n\t\tadd_gold = 2\r\n\t}\r\n\tif = {\r\n\t\tlimit = {}\r\n\t\tadd_gold = 3\r\n\t}\r\n\tliege = {}\r\n\tevery_child = {}\r\n}\r\n',
    });
    assert.deepEqual(
        checkFixtureMod(mod)
            .findings.filter((f) => f.code === CODE)
            .map((f) => [f.data['block'], f.data['means'], f.fix?.basis ?? null]),
        [
            ['OR', 'logical-operator', null],
            ['limit', 'trigger-block', null],
            ['liege', 'scope-switch', null],
            // Every other empty block is taken away as before.
            ['every_child', undefined, 'parser'],
        ],
    );
});

test(`${CODE}: the message of a block whose empty meaning is left open says so`, () => {
    const [found] = checkText(
        'common/scripted_effects/x.txt',
        'my_effect = { add_gold = 1 if = { limit = {} add_gold = 2 } }\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(found?.args, [
        'limit',
        ': the spec package leaves open what an empty trigger block means',
    ]);
    const [scope] = checkText(
        'common/scripted_effects/x.txt',
        'my_effect = { add_gold = 1 liege = {} }\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(scope?.args, [
        'liege',
        ': the spec package leaves open what an empty scope switch means',
    ]);
    const [operator] = checkText(
        'common/scripted_triggers/x.txt',
        'my_trigger = { is_adult = yes OR = {} }\n',
        {},
        {},
        { style: true },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(operator?.args, [
        'OR',
        ': the spec package leaves open what an empty logical operator means',
    ]);
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

test(`${CODE}: an empty entry of a random list is never offered for removal`, () => {
    // A case of a container whose cases take parameters of their own (the table `containers`,
    // its `case_params` naming `random_list_entry`): taking an empty entry away changes the odds
    // of the others, and it may be a deliberate chance of nothing (decision 174).
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\trandom_list = {',
                '\t\t10 = {}',
                '\t\t20 = { add_gold = 2 }',
                '\t\t30 = {',
                '\t\t\t# Nothing happens.',
                '\t\t}',
                '\t\t40 = { trigger = {} }',
                '\t\t50 = { modifier = { add = 10 } random_list = { 1 = {} 2 = { add_gold = 1 } } }',
                '\t}',
                '}',
                '',
            ].join('\n'),
        ),
        [
            ['10', 'random-entry'],
            ['30', 'random-entry'],
            // An entry's own `trigger` is a trigger block (decision 172), not an entry.
            ['trigger', 'trigger-block'],
            ['1', 'random-entry'],
        ],
    );
    const mod = writeMod({
        'descriptor.mod': 'name="x"\n',
        'common/scripted_effects/x.txt':
            '﻿my_effect = {\r\n\tadd_gold = 1\r\n\trandom_list = {\r\n\t\t10 = {}\r\n\t\t90 = { add_gold = 1 }\r\n\t}\r\n}\r\n',
    });
    assert.deepEqual(
        checkFixtureMod(mod)
            .findings.filter((f) => f.code === CODE)
            .map((f) => [f.data['block'], f.data['means'], f.fix?.basis ?? null, f.message]),
        [
            [
                '10',
                'random-entry',
                null,
                "The block '10' is empty: an entry of 'random_list', a chance of nothing; taking it away changes the odds of the others.",
            ],
        ],
    );
});

test(`${CODE}: an empty random list entry where the reader judges no key is read by the container's name`, () => {
    // Inside the body of an effect the package gives no rule for (a `duel`'s outcome), which the
    // reader reads as record fields: the table's name decides, as for a `limit` there. The
    // `duel`'s own empty outcome is no case of a container the package describes: as before.
    assert.deepEqual(
        meanings(
            [
                'my_effect = {',
                '\tadd_gold = 1',
                '\tduel = {',
                '\t\tskill = prowess',
                '\t\ttarget = root',
                '\t\t40 = {',
                '\t\t\tadd_gold = 1',
                '\t\t\trandom_list = {',
                '\t\t\t\t10 = {}',
                '\t\t\t\t5 = { add_gold = 1 }',
                '\t\t\t}',
                '\t\t}',
                '\t\t60 = {}',
                '\t}',
                '}',
                '',
            ].join('\n'),
        ),
        [
            ['10', 'random-entry'],
            ['60', undefined],
        ],
    );
});

test('the random lists come from the package: the containers whose cases take parameters of their own', () => {
    const containers = [...tablesOf(committedSpec()).containers];
    assert.deepEqual(
        containers.filter(([, r]) => r.cases && r.caseParams.size > 0).map(([name]) => name),
        ['random_list'],
    );
});
