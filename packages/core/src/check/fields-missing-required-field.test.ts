import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CODE, requiredFields } from './fields-missing-required-field.js';
import { CHECK_KINDS } from './finding.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('fields-missing-required-field-bad');
    assert.deepEqual(found, expectedFindings('fields-missing-required-field-bad'));
    assert.equal(found.length, 3);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('fields-missing-required-field-good'), []);
});

test(`${CODE} reads every field the package marks required, and only those: three in 1.21.0.3`, () => {
    const marked = requiredFields(committedSpec()).map((r) => `${r.directory} ${r.path.join('.')}`);
    assert.deepEqual(marked.sort(), [
        'common/casus_belli_types on_invalidated_desc',
        'common/character_interaction_categories index',
        'common/tutorial_lessons chain',
    ]);
    assert.equal(CHECK_KINDS[CODE].evidenceFrom, 'required-field');
});

test(`${CODE}: each finding carries its field's own message as its evidence`, () => {
    const [found] = checkText('common/tutorial_lessons/x.txt', 'fixture_lesson = { delay = 1 }\n');
    assert.ok(found !== undefined);
    assert.deepEqual(found.evidence, {
        kind: 'required-field',
        directory: 'common/tutorial_lessons',
        field: 'chain',
        id: 'missing_or_invalid_tutorial_chain_for_tutorial_lesson_X',
        text: "Missing or invalid tutorial chain for tutorial lesson '%s'",
    });
});

test(`${CODE}: a field a .info file calls required, or the base game always sets, is not required`, () => {
    // An event's `desc`: D4 gives it a `required` role, but the schema marks it not required.
    const found = checkText('events/x.txt', 'namespace = fixture\nfixture.1 = { hidden = yes }\n');
    assert.deepEqual(
        found.filter((f) => f.code === CODE),
        [],
    );
});

test(`${CODE}: a file is classified by its path inside the mod, by whole folder names`, () => {
    const text = 'fixture_cb = { group = fixture_group }\n';
    const at = (file: string): number =>
        checkText(file, text).filter((f) => f.code === CODE).length;
    assert.equal(at('common/casus_belli_types/x.txt'), 1);
    assert.equal(at('common/casus_belli_types/sub/x.txt'), 1);
    // A folder whose name only starts with the folder's is not it.
    assert.equal(at('common/casus_belli_types_old/x.txt'), 0);
    assert.equal(at('mod/common/casus_belli_types/x.txt'), 0);
});
