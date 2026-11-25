import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS, isAdvice, type CheckCode } from './finding.js';
import {
    CODE,
    confirmedEnough,
    indexDatabase,
    keyPlaces,
    withAddedDatabases,
} from './references-unknown-key.js';
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

test(`${CODE} reads only D6 rows that are confirmed, not the on-action ones, whose databases the index holds`, () => {
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
    const byId = new Map(spec.part('field_references')?.fields.map((r) => [r.id, r]));
    // Format 9: `holding = none` is a sentinel of a confirmed row, which is read and accepts it.
    const holding = [...(places.fields.get('history/provinces') ?? [])].find(
        (p) => p.row.id === 'history/provinces::holding',
    );
    assert.ok(holding !== undefined);
    assert.deepEqual([...holding.sentinels].sort(), ['auto', 'none']);
    // `mechanic_type` is no key at all (status not-a-key): not read.
    assert.equal(byId.get('common/governments::mechanic_type')?.status, 'not-a-key');
    assert.ok(!ids.includes('common/governments::mechanic_type'));
    // A row with an undefined miss is confirmed on rank 1 or 2 evidence, and is read.
    for (const id of ['triggers::has_court_position', 'history/characters::<date>.add_spouse']) {
        const row = byId.get(id);
        assert.ok(row !== undefined && confirmedEnough(row), id);
        assert.ok(ids.includes(id), id);
    }
    // A game concept's key may be an alias: the index holds no alias database, so the row is
    // not read rather than report the aliases the base game writes there.
    assert.deepEqual(withAddedDatabases(spec, ['common/game_concepts']), [
        'common/game_concepts',
        'common/game_concepts#alias',
    ]);
    assert.ok(!ids.includes('common/game_concepts::parent'));
});

test(`${CODE}: a confirmed row with an undefined miss needs evidence of rank 1 or 2`, () => {
    const row = committedSpec()
        .part('field_references')
        ?.fields.find((r) => r.id === 'triggers::has_court_position');
    assert.ok(row !== undefined);
    assert.equal(confirmedEnough(row), true);
    assert.equal(
        confirmedEnough({ ...row, evidence: row.evidence.filter((e) => e.rank > 2) }),
        false,
    );
    assert.equal(confirmedEnough({ ...row, miss_values: [], evidence: [] }), true);
});

test(`${CODE}: a sentinel is accepted where its row says, and is no key elsewhere`, () => {
    const province =
        '1 = {\n\tholding = none\n\tholding = auto\n\tholding = fixture_no_holding\n}\n';
    assert.deepEqual(
        checkText('history/provinces/x.txt', province)
            .filter((f) => f.code === CODE)
            .map((f) => f.data['name']),
        ['fixture_no_holding'],
    );
    const trigger = 'fixture_trigger = {\n\thas_cultural_tradition = none\n}\n';
    assert.deepEqual(
        checkText('common/scripted_triggers/x.txt', trigger)
            .filter((f) => f.code === CODE)
            .map((f) => f.data['name']),
        ['none'],
    );
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
