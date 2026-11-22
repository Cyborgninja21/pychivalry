import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from './testing.js';
import { templatePattern, vocabularyOf } from './vocabulary.js';

const vocabulary = vocabularyOf(committedSpec());

test('a lookup is by name and bucket; a name in several buckets is in each of them', () => {
    assert.ok(vocabulary.has('triggers', 'is_adult'));
    assert.equal(vocabulary.has('effects', 'is_adult'), false);
    assert.deepEqual(vocabulary.bucketsOf('accolade'), ['triggers', 'links', 'lists']);
    assert.deepEqual(vocabulary.bucketsOf('add_gold'), ['effects']);
    assert.deepEqual(vocabulary.bucketsOf('no_such_name_anywhere'), []);
    assert.ok(vocabulary.has('triggers', 'false'), 'the trigger false is in the bucket on purpose');
});

test('modifier templates, with a marked template no proof alone (spec/README.md of the spec work)', () => {
    const stationed = vocabulary.modifierTemplateMatch('stationed_archers_damage_mult');
    assert.equal(stationed.kind, 'template');
    assert.deepEqual([...stationed.templates].sort(), [
        '%s_damage_mult',
        'stationed_%s_damage_mult',
    ]);
    // `%s_add` alone is no proof; one of the game forms that rests on it is.
    assert.equal(vocabulary.modifierTemplateMatch('elephant_cavalry_control_value_add').kind, 'template');
    assert.deepEqual(vocabulary.modifierTemplateMatch('zzzz_add'), {
        kind: 'marked-only',
        templates: ['%s_add'],
    });
    assert.deepEqual(vocabulary.modifierTemplateMatch('zzzz'), { kind: 'none' });
});

test('keyword templates name the database whose key fills them', () => {
    const fills = vocabulary.keywordTemplateFills('effects', 'add_diplomacy_xp');
    assert.deepEqual(
        fills.map((f) => [f.template.template, f.key, f.template.keys]),
        [['add_%s_xp', 'diplomacy', 'common/lifestyles']],
    );
    // `%s_xp` (a trigger) is filled too, by `add_diplomacy`: whether that is a key of its
    // database is the caller's question, not the template's.
    assert.deepEqual(
        vocabulary.keywordTemplateFills('triggers', 'add_diplomacy_xp').map((f) => f.key),
        ['add_diplomacy'],
    );
    assert.ok(templatePattern('a_%s_b').test('a_x_1_b'));
    assert.equal(templatePattern('a_%s_b').test('a_X_b'), false);
});

test('removed keywords, iterators and links as the package gives them', () => {
    const retired = vocabulary.retired('effects', 'add_great_building');
    assert.deepEqual(retired.map((r) => [r.removed_in, r.replacement]), [['1.21.0.3', ['add_great_district']]]);
    assert.deepEqual(vocabulary.retired('triggers', 'add_great_building'), []);
    assert.deepEqual(vocabulary.iteratorOf('every_vassal'), { prefix: 'every_', base: 'vassal' });
    assert.equal(vocabulary.iteratorOf('vassal'), undefined);
    assert.ok(vocabulary.isDataHead('scope'), 'scope:x starts a chain');
    assert.ok(vocabulary.isDataHead('title'));
    assert.equal(vocabulary.isDataHead('liege'), false);
    assert.ok(vocabulary.takesData('aptitude'));
    assert.equal(vocabulary.scopeValidity('triggers', 'is_adult')?.supported_scopes[0], 'character');
    assert.equal(vocabulary.message('unknown_trigger_X')?.text, "Unknown trigger '%s'");
});
