import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Table, TableEntry } from './package.js';
import { Tables, tablesOf } from './tables.js';
import { committedSpec } from './testing.js';
import { vocabularyOf } from './vocabulary.js';

const tables = tablesOf(committedSpec());

function decision(table: string, entry: string): string | undefined {
    return tables.decisions.find((d) => d.table === table && d.entry === entry)?.use;
}

test('every entry of the 19 tables gets a decision: 154 confirmed, 15 contradicted, 8 with no evidence', () => {
    const data = committedSpec().data.tables.data;
    const statuses: Record<string, number> = {};
    for (const table of Object.values(data)) {
        for (const entry of Object.values(table.entries)) {
            statuses[entry.evidence_status] = (statuses[entry.evidence_status] ?? 0) + 1;
        }
    }
    assert.deepEqual(statuses, { confirmed: 154, contradicted: 15, none: 8 });
    for (const [name, table] of Object.entries(data)) {
        if (['file_kinds', 'event_types', 'effect_context_keys', 'trigger_context_keys'].includes(name)) {
            continue; // read by later items (the index, the call graph, the structural checks)
        }
        for (const entry of Object.keys(table.entries)) {
            assert.ok(decision(name, entry) !== undefined, `${name}/${entry} has no decision`);
        }
    }
});

test("where the game documents a key for more lists, the entry is read with the game's lists too", () => {
    assert.equal(decision('iterator_params', 'faith_filter'), 'widened');
    const faithFilter = tables.iteratorParams.get('faith_filter');
    assert.ok(faithFilter !== undefined && faithFilter.lists !== '*');
    assert.ok(faithFilter.lists.has('ruler'), "the game's own list");
    assert.ok(faithFilter.lists.has('character_doctrine'), "the entry's own list");
    assert.ok(tables.iteratorParamsFor('in_de_facto_hierarchy').has('continue'));
});

test('where the game registers a name the entry says is in no bucket, the entry keeps its role', () => {
    const vocabulary = vocabularyOf(committedSpec());
    for (const head of ['root', 'prev', 'this']) {
        assert.equal(decision('scope_heads', head), 'read');
        assert.ok(tables.scopeHeads.has(head));
        assert.ok(vocabulary.has('links', head), `the game registers ${head} as a link`);
    }
    assert.equal(decision('iterator_params', 'candidate'), 'read');
    assert.equal(tables.structural.get('root'), 'same');
});

test("where the game documents a keyword's value, its container entry is not read", () => {
    assert.equal(decision('containers', 'debug_only'), 'not-read');
    assert.equal(tables.containers.has('debug_only'), false);
    assert.equal(tables.containers.get('if')?.child, 'same');
});

test('an entry with no evidence is read only where it makes a key not a finding', () => {
    assert.equal(decision('random_list_entry', 'max'), 'accept-only');
    const randomList = tables.containers.get('random_list');
    assert.ok(randomList !== undefined);
    assert.equal(randomList.caseParams.get('max'), 'none');
    assert.equal(randomList.caseParams.get('trigger'), 'trigger');
});

test("a candidate the game's documentation names is read only to accept its key", () => {
    assert.equal(decision('iterator_params', 'culture_filter'), 'accept-only');
    assert.equal(tables.iteratorParamsFor('ruler').get('culture_filter'), 'none');
    assert.equal(decision('containers', 'weighted_calc_true_if'), 'accept-only');
    // Format 7 made the script-value operations entries, `min` among them: read as written.
    assert.equal(decision('value_block_keys', 'min'), 'read');
    assert.ok(tables.valueBlockKeys.has('min'));
});

test('the trust rule on a table written for the test', () => {
    const entry = (fields: Partial<TableEntry>): TableEntry =>
        ({ evidence_status: 'confirmed', evidence: [], ...fields });
    const table = (entries: Record<string, TableEntry>, candidates?: unknown): Table => ({
        about: {},
        entries,
        candidates,
    });
    const made = new Tables({
        structural: table({
            kept: entry({ child: 'trigger' }),
            unproved: entry({ evidence_status: 'none', child: 'trigger' }),
            dropped: entry({
                evidence_status: 'contradicted',
                child: 'trigger',
                contradicted: [{ claim: 'child: trigger', evidence: [{ kind: 'base_game' }], finding: 'no' }],
            }),
        }),
        iterator_params: table(
            {
                p: entry({
                    evidence_status: 'contradicted',
                    child: 'trigger',
                    lists: ['a'],
                    contradicted: [
                        { claim: 'lists: a', evidence: [{ kind: 'script_docs', bases_found: ['a', 'b'] }], finding: '' },
                    ],
                }),
            },
            {
                documented: { evidence: [{ kind: 'script_docs' }], lists: ['c'] },
                measured: { evidence: [{ kind: 'base_game' }], lists: ['c'] },
            },
        ),
        scope_heads: table({ unproved: entry({ evidence_status: 'none' }) }),
    });
    assert.equal(made.structural.get('kept'), 'trigger');
    assert.equal(made.structural.get('unproved'), 'none');
    assert.equal(made.structural.has('dropped'), false);
    assert.deepEqual([...made.iteratorParamsFor('b')], [['p', 'trigger']]);
    assert.deepEqual([...made.iteratorParamsFor('c')], [['documented', 'none']]);
    assert.equal(made.scopeHeads.size, 0, 'an unproved entry leads to no judgement');
});
