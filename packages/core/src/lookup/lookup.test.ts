/**
 * Lookup against the committed spec package alone (docs/MVP.md, row "Lookup": each answer
 * equals the spec's own text; a name the spec says nothing about answers "unknown"). One test
 * per kind of reading; every expected text is read from the package itself, so the test holds
 * the answer to the spec rather than to a copy of it.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BucketName } from '../spec/package.js';
import { committedSpec } from '../spec/testing.js';
import { lookup } from './lookup.js';
import type {
    BucketReading,
    DescriptionAnswer,
    LookupResult,
    Reading,
    ReadingKind,
} from './types.js';

function look(name: string, options: { dataTypes?: boolean } = {}): LookupResult {
    return lookup(name, { spec: committedSpec(), ...options });
}

function only<K extends ReadingKind>(
    result: LookupResult,
    kind: K,
): Extract<Reading, { kind: K }>[] {
    return result.readings.filter((r): r is Extract<Reading, { kind: K }> => r.kind === kind);
}

function bucket(result: LookupResult, name: BucketName): BucketReading {
    const found = only(result, 'bucket').find((r) => r.bucket === name);
    assert.ok(found, `${result.name} has a ${name} reading`);
    return found;
}

function texts(answer: DescriptionAnswer): { text: string; sources: readonly string[] }[] {
    return answer.status === 'known'
        ? answer.texts.map((t) => ({ text: t.text, sources: t.sources }))
        : [];
}

test('a trigger: its doc, the scopes the game documents, and no usage line said as such', () => {
    const spec = committedSpec().data;
    const r = look('has_trait');
    assert.equal(r.unknown, false);
    const trigger = bucket(r, 'triggers');
    assert.deepEqual(texts(trigger.description), [
        { text: spec.buckets.triggers['has_trait']?.doc, sources: ['doc', 'script_docs'] },
    ]);
    assert.deepEqual(trigger.scopes, {
        status: 'supported',
        scopes: spec.scope_validity.triggers['has_trait']?.supported_scopes,
        targets: spec.scope_validity.triggers['has_trait']?.supported_targets,
        source: 'script_docs',
    });
    assert.equal(spec.buckets.triggers['has_trait']?.takes, null);
    assert.equal(trigger.takes.status, 'no-usage-line');
    assert.equal(trigger.derivedOnly, false);
    assert.equal(trigger.since.status, 'unknown');
    assert.deepEqual(trigger.retired, []);
    // What its value names, from part D6, with the row's status and evidence.
    assert.deepEqual(
        trigger.valueNames.map((v) => [v.id, v.refersTo, v.status]),
        [['triggers::has_trait', ['common/traits'], 'measured-only']],
    );
    assert.deepEqual(r.definitions.status, 'no-workspace');
    assert.deepEqual(r.uses.status, 'no-workspace');
    assert.deepEqual(r.suggestions, { status: 'not-needed' });
});

test('what a keyword takes: forms and readings as the package gives them', () => {
    const spec = committedSpec().data;
    const takes = spec.buckets.triggers['accolade_attribute_level']?.takes;
    assert.ok(takes);
    const reading = bucket(look('accolade_attribute_level'), 'triggers');
    assert.deepEqual(reading.takes, {
        status: 'known',
        forms: takes.forms,
        readings: takes.readings,
        disagreement: takes.disagreement,
    });
});

test('an effect whose entry declares no requirement is kept apart from one the game documents not at all', () => {
    const spec = committedSpec().data;
    const declared = bucket(look('save_scope_as'), 'effects');
    assert.deepEqual(spec.scope_validity.effects['save_scope_as']?.supported_scopes, ['none']);
    assert.equal(declared.scopes.status, 'no-requirement');
    // `false` is in the triggers bucket, kept by the derivation; the game documents it nowhere.
    assert.equal(spec.scope_validity.triggers['false'], undefined);
    const derived = bucket(look('false'), 'triggers');
    assert.equal(derived.scopes.status, 'not-documented');
    assert.equal(derived.derivedOnly, true);
});

test('a name in several buckets has a reading per bucket, none picked', () => {
    const spec = committedSpec().data;
    const r = look('accolade');
    const buckets = only(r, 'bucket').map((b) => b.bucket);
    assert.deepEqual(buckets, spec.multi_bucket['accolade']);
    const links = bucket(r, 'links');
    assert.deepEqual(links.alsoIn, ['triggers', 'lists']);
    assert.equal(links.scopes.status, 'link-forms');
    const forms = spec.scope_validity.links['accolade']?.forms ?? [];
    assert.deepEqual(
        links.scopes.forms.map((f) => [f.scopes, f.targets, f.globalLink, f.requiresData]),
        forms.map((f) => [f.supported_scopes, f.supported_targets, f.global_link, f.requires_data]),
    );
    // The trigger reading is one the derivation keeps and the game does not document.
    assert.equal(bucket(r, 'triggers').derivedOnly, true);
    assert.equal(bucket(r, 'lists').derivedOnly, false);
});

test('a link the game documents nowhere is derived only', () => {
    const spec = committedSpec().data;
    const undocumented = Object.keys(spec.buckets.links).filter(
        (n) => spec.scope_validity.links[n] === undefined,
    );
    assert.ok(undocumented.length > 0);
    for (const name of undocumented) {
        const link = bucket(look(name), 'links');
        assert.equal(link.derivedOnly, true, name);
        assert.equal(link.scopes.status, 'not-documented', name);
    }
});

test('a list: its descriptions and the kind of block D8 documents each iterator form in', () => {
    const spec = committedSpec().data;
    const list = bucket(look('vassal'), 'lists');
    assert.deepEqual(
        texts(list.description).map((t) => t.text),
        [spec.buckets.lists['vassal']?.doc, spec.scope_validity.lists['vassal']?.description],
    );
    const forms = committedSpec().part('iterator_kinds')?.lists['vassal']?.forms ?? {};
    assert.deepEqual(
        list.iterators?.map((i) => [i.name, i.kind, i.documented]),
        spec.iterator_prefixes.map((p) => [`${p}vassal`, forms[p] ?? null, true]),
    );
    assert.equal(list.takes.status, 'not-applicable');
});

test('an iterator: its prefix, its list, the kind D8 gives the prefix and the scopes of the form', () => {
    const spec = committedSpec();
    const r = look('every_vassal');
    const [iterator] = only(r, 'iterator');
    assert.ok(iterator);
    assert.equal(iterator.prefix, 'every_');
    assert.equal(iterator.base, 'vassal');
    assert.deepEqual(iterator.list, { from: 'lists' });
    const row = spec.part('iterator_kinds')?.prefixes.find((p) => p.prefix === 'every_');
    assert.equal(iterator.prefixKind?.kind, row?.kind);
    assert.equal(iterator.prefixKind?.status, row?.status);
    assert.equal(iterator.formKind, spec.part('iterator_kinds')?.lists['vassal']?.forms['every_']);
    const documented = spec.data.scope_validity.effects['every_vassal'];
    assert.ok(documented);
    assert.deepEqual(iterator.scopes, {
        status: 'supported',
        scopes: documented.supported_scopes,
        targets: documented.supported_targets,
        source: 'script_docs',
    });
    assert.equal(iterator.derivedOnly, false);
    // Without a workspace an iterator over a name no list has is no reading.
    assert.deepEqual(look('every_fixture_made_up_list').readings, []);
});

test("a departure from the iterator forms is the package's statement about the name", () => {
    const rows = committedSpec().part('iterator_kinds')?.departures ?? [];
    const row = rows.find((d) => (d as { name?: string }).name === 'any_child_all');
    assert.ok(row);
    const [departure] = only(look('any_child_all'), 'iterator-departure');
    assert.deepEqual(departure?.row, row);
});

test('an on-action of the bucket, and one only the game documents (defined in script)', () => {
    const spec = committedSpec().data;
    const fired = bucket(look('five_year_everyone_pulse'), 'on_actions');
    assert.equal(
        fired.fromCode,
        spec.scope_validity.on_actions['five_year_everyone_pulse']?.from_code,
    );
    assert.equal(fired.description.status, 'none');
    const scripted = Object.keys(spec.scope_validity.on_actions).find(
        (n) => spec.buckets.on_actions[n] === undefined,
    );
    assert.ok(scripted);
    const r = look(scripted);
    const [documented] = only(r, 'documented-on-action');
    assert.ok(documented);
    assert.equal(documented.fromCode, false);
    assert.equal(documented.derivedOnly, false);
    assert.equal(only(r, 'bucket').length, 0);
});

test('a modifier: its use areas, no description, and no localization without a game folder', () => {
    const spec = committedSpec().data;
    const modifier = bucket(look('monthly_prestige'), 'modifiers');
    assert.deepEqual(modifier.scopes, {
        status: 'use-areas',
        areas: spec.buckets.modifiers['monthly_prestige']?.use_areas,
        source: 'modifier_log',
    });
    assert.equal(modifier.description.status, 'none');
    assert.ok(modifier.modifier);
    assert.equal(modifier.modifier.provenance, 'table');
    assert.equal(modifier.modifier.localization.status, 'no-game-folder');
});

test('a modifier template: the templates it fills and the tags with their use areas', () => {
    const spec = committedSpec().data;
    const [template] = only(look('stationed_archers_damage_mult'), 'modifier-template');
    assert.ok(template);
    assert.equal(template.proof, 'template');
    assert.deepEqual(template.templates, ['%s_damage_mult', 'stationed_%s_damage_mult']);
    assert.deepEqual(template.marks, []);
    assert.equal(template.scopes.status, 'by-template-tag');
    for (const tag of template.scopes.tags) {
        assert.deepEqual(tag.useAreas, spec.modifier_template_tags.data[tag.tag]?.use_areas);
    }
});

test('a name only the marked template fills carries the bare_suffix caveat', () => {
    const mark = committedSpec().data.modifier_template_marks['%s_add'];
    assert.ok(mark);
    const [template] = only(look('fixture_made_up_thing_add'), 'modifier-template');
    assert.ok(template);
    assert.equal(template.proof, 'marked-only');
    assert.deepEqual(template.marks, [
        {
            template: '%s_add',
            mark: mark.mark,
            fixedText: mark.fixed_text,
            gameTags: mark.game_tags,
            formsFilled: [],
        },
    ]);
    assert.equal(mark.mark, 'bare_suffix');
    // A game form resting on the marked template makes it proof, and says which form.
    const [proved] = only(look('elephant_cavalry_control_value_add'), 'modifier-template');
    assert.ok(proved);
    assert.equal(proved.proof, 'template');
    assert.deepEqual(
        proved.marks.map((m) => m.formsFilled),
        [['%s_control_value_add']],
    );
});

test('a keyword template: the template, its database and the key; without a workspace the key is not judged', () => {
    const r = look('add_diplomacy_lifestyle_xp');
    const fills = only(r, 'keyword-template');
    const effect = fills.find((f) => f.bucket === 'effects');
    assert.ok(effect);
    assert.equal(effect.template, 'add_%s_xp');
    assert.equal(effect.database, 'common/lifestyles');
    assert.equal(effect.key, 'diplomacy_lifestyle');
    assert.equal(effect.keyDefined, null);
    // The game documents the filled name: its scopes are the game's.
    const documented = committedSpec().data.scope_validity.effects['add_diplomacy_lifestyle_xp'];
    assert.ok(documented);
    assert.equal(effect.scopes.status, 'supported');
    assert.equal(effect.derivedOnly, false);
    assert.equal(effect.takes.status, 'unknown');
});

test('a schema field, with its folder: kind, measured type, values, description and since', () => {
    const field = committedSpec().data.schema['common/traits']?.fields['genetic'];
    assert.ok(field);
    const readings = only(look('genetic'), 'field');
    const reading = readings.find((f) => f.directory === 'common/traits');
    assert.ok(reading);
    assert.deepEqual(reading.path, ['genetic']);
    assert.equal(reading.fieldKind, field.kind);
    assert.deepEqual(reading.valueType, {
        status: 'measured',
        type: field.value_type,
        evidence: field.value_type_evidence,
        wikiType: null,
        infoType: field.info_type,
    });
    assert.deepEqual(reading.values, { status: 'observed', values: field.values });
    assert.deepEqual(texts(reading.description), [{ text: field.description, sources: ['info'] }]);
    assert.deepEqual(reading.since, { status: 'known', since: field.since });
    assert.equal(reading.localizationKey.status, 'not-marked');
});

test('a field that holds a localization key, one whose values name a database, and one holding modifiers', () => {
    const spec = committedSpec();
    const desc = only(look('desc'), 'field').find(
        (f) => f.directory === 'common/traits' && f.path.length === 1,
    );
    assert.equal(desc?.localizationKey.status, 'yes');
    const onAction = spec
        .part('field_references')
        ?.fields.find((f) => f.id === 'common/on_action::on_actions');
    assert.ok(onAction);
    const field = only(look('on_actions'), 'field').find(
        (f) => f.directory === 'common/on_action' && f.path.join('.') === onAction.path,
    );
    assert.deepEqual(
        field?.refersTo.map((r) => r.id),
        [onAction.id],
    );
    // A modifier block part D7 describes: its use areas, with the row's status.
    const row = spec
        .part('modifier_block_areas')
        ?.fields.find((f) => f.id === 'common/buildings::character_culture_modifier');
    assert.ok(row);
    const modifierField = only(look('character_culture_modifier'), 'field').find(
        (f) => f.directory === 'common/buildings' && f.path.length === 1,
    );
    assert.deepEqual(modifierField?.useAreas, {
        id: row.id,
        useAreas: row.use_areas,
        status: row.status,
        evidence: row.evidence,
    });
});

test('a parameter of a keyword that part D6 says names a database', () => {
    const [parameter] = only(look('on_action'), 'keyword-parameter').filter(
        (p) => p.keyword === 'trigger_event',
    );
    assert.ok(parameter);
    assert.equal(parameter.bucket, 'effects');
    assert.equal(parameter.reference.id, 'effects::trigger_event.on_action');
    assert.deepEqual(parameter.reference.refersTo, ['common/on_action']);
});

test('a structural keyword (part D4) and a declaration (part D2)', () => {
    const spec = committedSpec();
    const r = look('namespace');
    const roles = only(r, 'keyword-role');
    const rows =
        spec.part('keyword_roles')?.keywords.filter((k) => k.keyword === 'namespace') ?? [];
    assert.deepEqual(
        roles.map((x) => x.roles),
        rows.map((x) => x.roles),
    );
    assert.deepEqual(
        roles.map((x) => x.status),
        rows.map((x) => x.status),
    );
    const [declaration] = only(r, 'declaration');
    assert.ok(declaration);
    assert.equal(declaration.directory, 'events');
    assert.equal(declaration.declares, 'namespace');
    // A prefix row: `@name` is a constant in every folder.
    const [constant] = only(look('@fixture_constant'), 'declaration');
    assert.ok(constant);
    assert.equal(constant.directory, null);
    assert.equal(constant.declares, 'constant');
    // A row whose pattern matches every key describes a folder's records, not a name.
    assert.deepEqual(only(look('fixture_any_record_name'), 'declaration'), []);
});

test('a table entry (part C4), with what the trust rule does with it', () => {
    const r = look('save_scope_as');
    const [entry] = only(r, 'table-entry');
    const table = committedSpec().data.tables.data['save_keys'];
    assert.ok(entry);
    assert.equal(entry.table, 'save_keys');
    assert.equal(entry.evidenceStatus, table?.entries['save_scope_as']?.evidence_status);
    assert.equal(entry.trust?.use, 'read');
    assert.equal(entry.candidate, false);
});

test('a scope type, with how the game names it', () => {
    const type = committedSpec().data.scope_types['character'] as {
        named_as: string[];
        links: string[];
    };
    const [reading] = only(look('character'), 'scope-type');
    assert.ok(reading);
    assert.deepEqual(reading.namedAs, type.named_as);
    assert.equal(reading.counts.links, type.links.length);
});

test('a removed keyword: the version and its replacement', () => {
    const retired = committedSpec().data.retired.find((r) => r.name === 'add_great_building');
    assert.ok(retired);
    const r = look('add_great_building');
    assert.equal(r.unknown, false);
    const [reading] = only(r, 'retired');
    assert.ok(reading);
    assert.deepEqual(reading.entry, retired);
    assert.deepEqual(reading.retired, [retired]);
    assert.deepEqual(reading.entry.replacement, ['add_great_district']);
});

test('a name the derivation found and the package dropped says why', () => {
    const r = look('doctrines');
    const [dropped] = only(r, 'dropped');
    assert.ok(dropped);
    assert.equal(dropped.bucket, 'effects');
    assert.ok(dropped.reason.length > 0);
});

test('data types are read only when asked, every entry as a list', () => {
    assert.deepEqual(look('GetPlayer').dataTypes, { status: 'not-asked' });
    const asked = look('GetPlayer', { dataTypes: true });
    assert.equal(asked.dataTypes.status, 'read');
    assert.ok(asked.dataTypes.entries.length >= 2);
    // A global is named as written; a member by its type and name (`Type.GetPlayer`).
    assert.ok(
        asked.dataTypes.entries.every(
            (e) => e.name === 'GetPlayer' || e.name === `${e.owner ?? ''}.GetPlayer`,
        ),
    );
    assert.ok(asked.dataTypes.entries.some((e) => e.kind === 'member'));
    assert.deepEqual(
        asked.dataTypes.entries.filter((e) => e.kind === 'global').map((e) => e.definition_type),
        ['Global promote', 'Global function'],
    );
});

test('a name the package says nothing about answers unknown, and every part says why', () => {
    const r = look('fixture_no_such_name_anywhere');
    assert.equal(r.unknown, true);
    assert.deepEqual(r.readings, []);
    assert.equal(r.definitions.status, 'no-workspace');
    assert.equal(r.uses.status, 'no-workspace');
    assert.equal(r.suggestions.status, 'computed');
    assert.equal(r.suggestions.complete, true);
    assert.ok(r.suggestions.work <= r.suggestions.budget);
});

test('did you mean: a near name of the package, nearest first', () => {
    const r = look('has_trai');
    assert.equal(r.suggestions.status, 'computed');
    const [first] = r.suggestions.suggestions;
    assert.ok(first);
    assert.equal(first.name, 'has_trait');
    assert.equal(first.from, 'package');
    // Off when the caller says so.
    assert.deepEqual(
        lookup('has_trai', { spec: committedSpec(), suggestions: false }).suggestions,
        {
            status: 'off',
        },
    );
});

test('every reading has every common part, each with a status where the package may have nothing', () => {
    for (const name of [
        'has_trait',
        'liege',
        'vassal',
        'any_vassal',
        'monthly_prestige',
        'genetic',
        'AND',
        'namespace',
    ]) {
        for (const reading of look(name).readings) {
            assert.ok(['known', 'none'].includes(reading.description.status), name);
            assert.ok(typeof reading.scopes.status === 'string', name);
            assert.ok(typeof reading.takes.status === 'string', name);
            assert.ok(['known', 'unknown'].includes(reading.since.status), name);
            assert.ok(Array.isArray(reading.retired), name);
            assert.ok(
                reading.derivedOnly === null || typeof reading.derivedOnly === 'boolean',
                name,
            );
        }
    }
});

test('the answer names its package', () => {
    const spec = committedSpec();
    assert.deepEqual(look('has_trait').spec, { version: spec.version, sha256: spec.sha256 });
});
