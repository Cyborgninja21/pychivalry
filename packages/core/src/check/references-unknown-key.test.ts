import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS, isAdvice, type CheckCode } from './finding.js';
import { agreesWithBaseGame, CODE, indexDatabase, keyPlaces } from './references-unknown-key.js';
import {
    checkFixture,
    checkText,
    expectedFindings,
    specContext,
    type WrittenFinding,
} from './testing.js';

// The fixture's dynasty names no culture, though every base-game dynasty does: a culture the
// mod defined would need every field each base-game culture sets, and so on. The advice check
// `fields/usually-present` (item 4.7) is tested on its own pair, and not counted here.
const notAdvice = (found: WrittenFinding[]): WrittenFinding[] =>
    found.filter((f) => !isAdvice(f.code as CheckCode));

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = notAdvice(checkFixture('references-unknown-key-bad'));
    assert.deepEqual(found, expectedFindings('references-unknown-key-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'warning'));
    assert.ok(found.every((f) => f.message.startsWith('Failed to read key reference ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(notAdvice(checkFixture('references-unknown-key-good')), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'failed_to_read_key_reference_X_from_database_X');
});

test(`${CODE} reads only D6 rows that are confirmed, not the on-action ones, and that the base game bears out`, () => {
    const spec = committedSpec();
    const places = keyPlaces(spec, specContext().folders);
    const rows = [...places.fields.values(), ...places.keywords.values()].flat().map((p) => p.row);
    assert.ok(rows.length > 0);
    assert.ok(
        rows.every((r) => r.status === 'confirmed' && !r.refers_to.includes('common/on_action')),
    );
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes('effects::trigger_event.id'));
    assert.ok(ids.includes('triggers::has_cultural_tradition'));
    // Measured-only rows raise nothing.
    assert.ok(!ids.includes('events::theme'));
    // Confirmed rows the base game's own values contradict are not read.
    for (const id of ['history/provinces::holding', 'common/governments::mechanic_type']) {
        const row = spec.part('field_references')?.fields.find((r) => r.id === id);
        assert.ok(row !== undefined && row.status === 'confirmed', id);
        assert.equal(agreesWithBaseGame(spec, row), false, id);
        assert.ok(!ids.includes(id), id);
    }
});

test(`${CODE}: a nested kind is the folder's own database when it is the folder's content type`, () => {
    const folders = specContext().folders;
    assert.equal(
        indexDatabase(folders, 'common/portrait_types#portrait_type'),
        'common/portrait_types',
    );
    assert.equal(indexDatabase(folders, 'common/no_such_folder'), null);
});

test(`${CODE}: a scope, a chain, a parameter and a number are never keys`, () => {
    const text =
        'fixture_trigger = {\n\thas_cultural_tradition = root\n\thas_cultural_tradition = scope:fixture\n\thas_cultural_tradition = $TRADITION$\n\thas_cultural_tradition = 5\n}\n';
    assert.deepEqual(
        checkText('common/scripted_triggers/x.txt', text).filter((f) => f.code === CODE),
        [],
    );
});
