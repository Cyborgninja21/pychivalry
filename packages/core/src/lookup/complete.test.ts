/**
 * Completion (docs/PLAN.md item 7.5; the row "Completion and hover" of docs/MVP.md's table):
 * at fixture positions, the expected items are offered and nothing invalid at the position is.
 * Every name the test expects or forbids is read from the committed spec package, never
 * written here.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DefinedNames } from '../check/context.js';
import { folderTableFromSpec } from '../index/folders.js';
import { rulesFromSpec } from '../index/rules.js';
import { WorkspaceIndex } from '../index/workspace.js';
import { committedSpec } from '../spec/testing.js';
import { parse } from '../syntax/parser.js';
import { completionsAt, type CompletionAnswer } from './complete.js';

const spec = committedSpec();
const folders = folderTableFromSpec(spec.data);
const NONE: DefinedNames = { isDefined: () => false };

/** Completion where `|` stands in `text`, as the file `file`. */
function at(
    file: string,
    text: string,
    options: { index?: WorkspaceIndex; limit?: number } = {},
): CompletionAnswer {
    const offset = text.indexOf('|');
    assert.ok(offset >= 0);
    return completionsAt({
        spec,
        folders,
        file,
        parsed: parse(text.replace('|', '')),
        offset,
        names: NONE,
        index: options.index ?? null,
        limit: options.limit ?? 100_000,
    });
}

const offered = (answer: CompletionAnswer): Set<string> =>
    new Set(answer.candidates.map((c) => c.name));

const buckets = spec.data.buckets;
const validity = spec.data.scope_validity;

/** A trigger the game documents for the scope `scope` only, and one it documents for others only. */
function triggersFor(scope: string): { fits: string; not: string } {
    let fits: string | undefined;
    let not: string | undefined;
    for (const name of Object.keys(buckets.triggers)) {
        const scopes = validity.triggers[name]?.supported_scopes;
        if (scopes === undefined || scopes.length === 0 || scopes.includes('none')) {
            continue;
        }
        if (name in buckets.effects || name in buckets.links) {
            continue;
        }
        if (scopes.includes(scope)) {
            fits ??= name;
        } else {
            not ??= name;
        }
    }
    assert.ok(fits !== undefined && not !== undefined);
    return { fits, not };
}

const EVENT = (body: string): string =>
    `namespace = t\nt.1 = {\n\ttype = character_event\n${body}\n}\n`;

test('in an event trigger block: triggers of its scope, links, any_ iterators; no effect, no trigger of another scope', () => {
    const answer = at('events/t.txt', EVENT('\ttrigger = {\n\t\t|\n\t}'));
    assert.deepEqual(answer.place, { kind: 'key', block: 'trigger', scope: 'character' });
    const names = offered(answer);
    const { fits, not } = triggersFor('character');
    assert.ok(names.has(fits), fits);
    assert.ok(!names.has(not), not);
    const effectsOnly = Object.keys(buckets.effects).filter(
        (n) => !(n in buckets.triggers) && !(n in buckets.links),
    );
    assert.deepEqual(
        effectsOnly.filter((n) => names.has(n)),
        [],
    );
    const iterators = answer.candidates.filter((c) => c.kind === 'iterator');
    assert.ok(iterators.length > 0);
    const kinds = spec.part('iterator_kinds')?.prefixes ?? [];
    const triggerPrefixes = kinds.filter((p) => p.kind === 'trigger').map((p) => p.prefix);
    assert.ok(iterators.every((c) => triggerPrefixes.some((p) => c.name.startsWith(p))));
    for (const name of spec.data.iterator_prefixes) {
        if (!triggerPrefixes.includes(name)) {
            assert.ok(!iterators.some((c) => c.name.startsWith(name)), name);
        }
    }
    const description = answer.candidates.find((c) => c.name === fits)?.description;
    assert.equal(description, buckets.triggers[fits]?.doc || validity.triggers[fits]?.description);
});

test('in an effect block: effects and the effect iterators, no trigger', () => {
    const answer = at('events/t.txt', EVENT('\timmediate = {\n\t\t|\n\t}'));
    assert.equal(answer.place.kind, 'key');
    const names = offered(answer);
    const triggersOnly = Object.keys(buckets.triggers).filter(
        (n) => !(n in buckets.effects) && !(n in buckets.links),
    );
    assert.deepEqual(
        triggersOnly.filter((n) => names.has(n)),
        [],
    );
    const effectPrefixes = (spec.part('iterator_kinds')?.prefixes ?? [])
        .filter((p) => p.kind === 'effect')
        .map((p) => p.prefix);
    assert.ok(effectPrefixes.length > 0);
    assert.ok(
        answer.candidates
            .filter((c) => c.kind === 'iterator')
            .every((c) => effectPrefixes.some((p) => c.name.startsWith(p))),
    );
});

test("in an event's body: the fields of the events schema; its type's values from the base game", () => {
    const fields = Object.keys(spec.data.schema['events']?.fields ?? {}).filter(
        (f) => !f.startsWith('<'),
    );
    const body = at('events/t.txt', EVENT('\t|'));
    assert.deepEqual(body.place, { kind: 'key', block: 'none', scope: 'character' });
    assert.deepEqual([...offered(body)].sort(), [...fields].sort());
    const type = at('events/t.txt', 'namespace = t\nt.1 = {\n\ttype = |\n}\n');
    assert.deepEqual(type.place, { kind: 'value', block: 'none', key: 'type' });
    assert.deepEqual(
        [...offered(type)].sort(),
        (spec.data.schema['events']?.fields['type']?.values ?? []).map((v) => v.value).sort(),
    );
    assert.ok(type.candidates.every((c) => c.kind === 'value'));
});

test('in a block that holds modifiers: modifiers', () => {
    let found: { dir: string; field: string } | undefined;
    for (const [dir, schema] of Object.entries(spec.data.schema)) {
        if (schema.record_body !== undefined) {
            continue;
        }
        for (const [field, f] of Object.entries(schema.fields)) {
            if (f.holds === 'modifiers' && !field.startsWith('<')) {
                found ??= { dir, field };
            }
        }
    }
    assert.ok(found !== undefined);
    const answer = at(`${found.dir}/t.txt`, `t = {\n\t${found.field} = {\n\t\t|\n\t}\n}\n`);
    assert.deepEqual(answer.place, {
        kind: 'key',
        block: 'modifiers',
        scope: answer.place.kind === 'key' ? answer.place.scope : null,
    });
    assert.ok(answer.candidates.some((c) => c.kind === 'modifier-type'));
    assert.ok(answer.candidates.every((c) => c.kind !== 'trigger' && c.kind !== 'effect'));
});

test("a value a confirmed row of part D6 says names a database: the index's names of it", () => {
    const row = (spec.part('field_references')?.fields ?? []).find(
        (r) =>
            r.status === 'confirmed' &&
            r.kind === 'value' &&
            r.bucket === 'triggers' &&
            !r.refers_to.some((d) => d.includes('#')),
    );
    assert.ok(row !== undefined);
    const database = row.refers_to[0] ?? '';
    const index = new WorkspaceIndex({ folders, rules: rulesFromSpec(spec), platform: 'linux' });
    index.setFile('mod', `${database}/zz_completion.txt`, 'completion_fixture_name = {\n}\n');
    const answer = at('common/scripted_triggers/t.txt', `t = {\n\t${row.path} = |\n}\n`, { index });
    assert.equal(answer.place.kind, 'value');
    const names = offered(answer);
    assert.ok(names.has('completion_fixture_name'), JSON.stringify([...names].slice(0, 10)));
    assert.ok(
        answer.candidates.find((c) => c.name === 'completion_fixture_name')?.detail === database,
    );
    // Without the index, nothing is offered for it.
    assert.equal(
        offered(at('common/scripted_triggers/t.txt', `t = {\n\t${row.path} = |\n}\n`)).has(
            'completion_fixture_name',
        ),
        false,
    );
});

test('a scripted trigger the index holds is offered in a trigger block, not in an effect block', () => {
    const index = new WorkspaceIndex({ folders, rules: rulesFromSpec(spec), platform: 'linux' });
    index.setFile(
        'mod',
        'common/scripted_triggers/zz.txt',
        'completion_fixture_trigger = { always = yes }\n',
    );
    index.setFile('mod', 'common/scripted_effects/zz.txt', 'completion_fixture_effect = { }\n');
    const inTrigger = offered(at('events/t.txt', EVENT('\ttrigger = {\n\t\t|\n\t}'), { index }));
    assert.ok(inTrigger.has('completion_fixture_trigger'));
    assert.ok(!inTrigger.has('completion_fixture_effect'));
    const inEffect = offered(at('events/t.txt', EVENT('\timmediate = {\n\t\t|\n\t}'), { index }));
    assert.ok(inEffect.has('completion_fixture_effect'));
    assert.ok(!inEffect.has('completion_fixture_trigger'));
});

test('nothing is offered in a comment, in quoted text, at the top level, or for a key the spec knows nothing of', () => {
    assert.deepEqual(at('events/t.txt', EVENT('\ttrigger = {\n\t\t# has_|\n\t}')).place, {
        kind: 'none',
        why: 'comment',
    });
    assert.deepEqual(at('events/t.txt', EVENT('\tdesc = "some |text"')).place, {
        kind: 'none',
        why: 'text',
    });
    assert.deepEqual(at('events/t.txt', 'namespace = t\n|').place, {
        kind: 'none',
        why: 'top-level',
    });
    for (const answer of [
        at('events/t.txt', 'namespace = t\n|'),
        at('events/t.txt', EVENT('\tno_such_field_of_events = |')),
        at('nothing_the_spec_lists/t.txt', 'a = {\n\t|\n}\n'),
    ]) {
        assert.deepEqual(answer.candidates, [], JSON.stringify(answer.place));
    }
});

test('the answer is bounded: past the limit, the names that start with the word, cut, and not complete', () => {
    const all = at('events/t.txt', EVENT('\ttrigger = {\n\t\thas_|\n\t}'));
    assert.equal(all.complete, true);
    assert.deepEqual(all.word, { text: 'has_', start: all.word.start, end: all.word.start + 4 });
    const bounded = at('events/t.txt', EVENT('\ttrigger = {\n\t\thas_|\n\t}'), { limit: 10 });
    assert.equal(bounded.complete, false);
    assert.equal(bounded.candidates.length, 10);
    assert.ok(bounded.candidates.every((c) => c.name.toLowerCase().startsWith('has_')));
});
