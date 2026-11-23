import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS, isAdvice } from './finding.js';
import { CODE } from './scope-link-on-wrong-scope.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('scope-link-on-wrong-scope-bad');
    assert.deepEqual(found, expectedFindings('scope-link-on-wrong-scope-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Trying to use ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('scope-link-on-wrong-scope-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'trying_to_use_X_link_on_an_invalid_scope_X');
});

test(`${CODE}: a global link takes any scope; a link on an unknown scope is not judged`, () => {
    // `title:k_x` is a global link that takes data; `scope:x` has no type the package gives.
    const text =
        'fixture_decision = {\n\tis_shown = {\n\t\tprimary_title = {\n\t\t\ttitle:k_fixture.holder = { is_adult = yes }\n\t\t\tscope:fixture_target.holder = { is_adult = yes }\n\t\t}\n\t}\n}\n';
    assert.deepEqual(
        checkText('common/decisions/fixture.txt', text).filter((f) => !isAdvice(f.code)),
        [],
    );
});

test(`${CODE}: a chain in a keyword's parameters is evaluated where the keyword runs it, and is not judged`, () => {
    const text =
        'fixture_decision = {\n\teffect = {\n\t\tadd_opinion = {\n\t\t\ttarget = root.holder\n\t\t\tmodifier = fixture_opinion\n\t\t}\n\t}\n}\n';
    assert.deepEqual(
        checkText('common/decisions/fixture.txt', text).filter((f) => !isAdvice(f.code)),
        [],
    );
});
