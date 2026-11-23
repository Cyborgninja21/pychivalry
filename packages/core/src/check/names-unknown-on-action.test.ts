import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, onActionPlaces } from './names-unknown-on-action.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('names-unknown-on-action-bad');
    assert.deepEqual(found, expectedFindings('names-unknown-on-action-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Unknown on action: ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('names-unknown-on-action-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'unknown_on_action_X');
});

test(`${CODE} reads only the places part D6 confirms`, () => {
    const places = onActionPlaces(committedSpec());
    assert.equal(places.database, 'common/on_action');
    const ids = [...places.fields.values(), ...places.parameters.values()].flat().map((r) => r.id);
    assert.ok(ids.includes('effects::trigger_event.on_action'));
    assert.ok(ids.includes('common/on_action::on_actions'));
    // A measured-only row raises nothing: its place is not read.
    assert.ok(!ids.some((id) => id.startsWith('events::generic_scheme_process_ending_effect')));
    for (const rows of [...places.fields.values(), ...places.parameters.values()]) {
        assert.ok(
            rows.every((r) => r.status === 'confirmed' && r.refers_to.includes('common/on_action')),
        );
    }
});

test(`${CODE}: a defined on-action, an engine on-action and a scope are not reported`, () => {
    const text =
        'fixture.1 = {\n\ttype = character_event\n\timmediate = {\n\t\ttrigger_event = { on_action = known_on_action }\n\t\ttrigger_event = { on_action = on_birth_child }\n\t\ttrigger_event = { on_action = scope:x }\n\t\ttrigger_event = { on_action = $ON_ACTION$ }\n\t\ttrigger_event = { on_action = unknown_one }\n\t}\n}\n';
    const found = checkText('events/fixture.txt', text, {
        'common/on_action': ['known_on_action'],
    });
    assert.deepEqual(
        found.filter((f) => f.code === CODE).map((f) => f.args[0]),
        ['unknown_one'],
    );
});
