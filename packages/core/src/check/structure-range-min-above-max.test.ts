import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../syntax/parser.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, rangeOf } from './structure-range-min-above-max.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('structure-range-min-above-max-bad');
    assert.deepEqual(found, expectedFindings('structure-range-min-above-max-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('structure-range-min-above-max-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.equal(
        CHECK_KINDS[CODE].catalogue,
        'min_value_in_range_directive_is_larger_than_the_max_value_un',
    );
});

test(`${CODE}: a range is two numbers in a block`, () => {
    const block = (text: string) => {
        const item = parse(`x = ${text}\n`).file.items[0];
        return item?.kind === 'pair' && item.value?.kind === 'block' ? item.value : undefined;
    };
    assert.deepEqual(rangeOf(block('{ 1 5 }') ?? assert.fail()), [1, 5]);
    assert.equal(rangeOf(block('{ 1 5 9 }') ?? assert.fail()), null);
    assert.equal(rangeOf(block('{ low high }') ?? assert.fail()), null);
    assert.equal(rangeOf(block('{ min = 5 max = 1 }') ?? assert.fail()), null);
});

test(`${CODE}: a field the base game writes script values in; not a curve's points`, () => {
    const template = 'fixture_template = {\n\tage = { 30 20 }\n}\n';
    assert.equal(
        checkText('common/scripted_character_templates/x.txt', template).filter(
            (f) => f.code === CODE,
        ).length,
        1,
    );
    const curve = 'fixture_value = {\n\tvalue = 1\n\tcurve = {\n\t\t{ 0.38 0.0 }\n\t}\n}\n';
    assert.deepEqual(
        checkText('common/script_values/x.txt', curve).filter((f) => f.code === CODE),
        [],
    );
});
