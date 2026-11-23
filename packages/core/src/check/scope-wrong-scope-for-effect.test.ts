import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS, isAdvice } from './finding.js';
import { CODE } from './scope-wrong-scope-for-effect.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('scope-wrong-scope-for-effect-bad');
    assert.deepEqual(found, expectedFindings('scope-wrong-scope-for-effect-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Wrong scope for effect: ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('scope-wrong-scope-for-effect-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'wrong_scope_for_effect_X_expected_X');
});

test(`${CODE}: an every_ iterator is an effect by its prefix (part D8), an any_ iterator a trigger`, () => {
    // In a title's scope: `every_vassal` is judged by the effects' scope data; `any_vassal`, in
    // the effect block's `limit`, by the triggers'.
    const text =
        'fixture_decision = {\n\teffect = {\n\t\tprimary_title = {\n\t\t\tif = {\n\t\t\t\tlimit = {\n\t\t\t\t\tany_vassal = { is_adult = yes }\n\t\t\t\t}\n\t\t\t\tevery_vassal = { add_gold = 1 }\n\t\t\t}\n\t\t}\n\t}\n}\n';
    const found = checkText('common/decisions/fixture.txt', text).filter((f) => !isAdvice(f.code));
    assert.deepEqual(
        found.map((f) => [f.code, f.data['name']]),
        [
            ['scope/wrong-scope-for-trigger', 'any_vassal'],
            [CODE, 'every_vassal'],
        ],
    );
});
