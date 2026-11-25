import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formsReading, localizationFormsOf } from './localization-forms.js';
import { committedSpec } from './testing.js';

test('part D9: 36 forms and 36 suffixes, each with its status', () => {
    const forms = localizationFormsOf(committedSpec());
    assert.ok(forms !== null);
    assert.equal(forms.forms.length, 36);
    assert.equal(forms.suffixes.length, 36);
    const statuses = new Map<string, number>();
    for (const form of forms.forms) {
        statuses.set(form.status, (statuses.get(form.status) ?? 0) + 1);
    }
    assert.deepEqual(Object.fromEntries(statuses), { confirmed: 4, 'measured-only': 6, unknown: 26 });
    assert.equal(localizationFormsOf(committedSpec()), forms, 'read once');
});

test("part D9: the game concept form `[key|E]`, confirmed, and what a concept's key is", () => {
    const forms = localizationFormsOf(committedSpec());
    assert.ok(forms !== null);
    const concept = formsReading(forms, 'game_concept');
    assert.deepEqual(
        concept.map((f) => [f.id, f.shape, f.suffix]),
        [
            ['game_concept', 'bare_key', 'E'],
            ['game_concept_custom_text', 'function', 'E'],
            ['game_concept_by_key', 'function', 'E'],
        ],
    );
    // A concept's key: a key of common/game_concepts, or one of the aliases a concept lists.
    assert.deepEqual((forms.reads['game_concept'] as { refers_to: unknown }).refers_to, {
        also_field: 'alias',
        folder: 'common/game_concepts',
    });
});

test('part D9: the forms that read a saved scope by its name, for the "saved too late" check', () => {
    const forms = localizationFormsOf(committedSpec());
    assert.ok(forms !== null);
    // The head of a chain (confirmed) and `TopScope.sC` (measured only) are the forms the base
    // game writes; the other functions of the kind are unknown.
    assert.deepEqual(
        formsReading(forms, 'saved_scope_or_value').map((f) => [f.id, f.shape]),
        [['saved_scope_head', 'head']],
    );
    const measured = formsReading(forms, 'saved_scope', ['confirmed', 'measured-only']);
    assert.deepEqual(
        measured.map((f) => [f.id, f.owner, f.function, f.name_arg, f.status]),
        [
            ['TopScope.sC', 'TopScope', 'sC', 0, 'measured-only'],
            ['TopScope.sTitle', 'TopScope', 'sTitle', 0, 'measured-only'],
        ],
    );
    assert.ok(forms.notSettled.length > 0);
});
