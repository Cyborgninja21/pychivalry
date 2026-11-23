/**
 * The links that lead from one scope type to others (scope-links.ts), from the committed spec
 * package's link documentation: one link where one leads there, chains of two where none does,
 * a link that needs data written with its key, and the list bounded.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { linksBetween, linksData, MAX_LINKS } from './scope-links.js';

const spec = committedSpec();

test('the links that start from a scope and give one of the scopes asked for', () => {
    const between = linksBetween(spec, 'character', ['landed_title']);
    assert.ok(between.links.includes('capital_county'));
    assert.ok(between.links.includes('primary_title'));
    assert.ok(
        !between.links.includes('title:<key>'),
        'a global link does not start from the scope',
    );
    assert.equal(between.total, between.links.length);
    for (const name of between.links) {
        const forms = spec.data.scope_validity.links[name]?.forms ?? [];
        assert.ok(
            forms.some(
                (f) =>
                    f.supported_scopes.includes('character') &&
                    f.supported_targets.includes('landed_title'),
            ),
            name,
        );
    }
    assert.deepEqual(linksBetween(spec, 'character', ['faith']).links, ['faith', 'secret_faith']);
});

test('where no one link leads there, the chains of two that do', () => {
    // No link leads from a culture to a title; its head's links do.
    const between = linksBetween(spec, 'culture', ['landed_title']);
    assert.ok(between.links.includes('culture_head.primary_title'), between.links.join(' '));
    assert.ok(between.links.every((l) => l.split('.').length === 2));
});

test('a link that needs data is written with its key; the list is bounded and counted', () => {
    assert.deepEqual(linksBetween(spec, 'character', ['situation_participant_group']).links, [
        'top_participant_group:<key>',
    ]);
    const many = linksBetween(spec, 'character', ['character']);
    assert.equal(many.links.length, MAX_LINKS);
    assert.ok(many.total > MAX_LINKS);
    assert.deepEqual(linksData(spec, 'character', ['character']), {
        links_from_scope: many.links,
        links_from_scope_total: String(many.total),
    });
    assert.deepEqual(linksData(spec, 'character', ['no_such_scope']), {});
});
