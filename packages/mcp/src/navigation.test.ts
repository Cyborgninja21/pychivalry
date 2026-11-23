/**
 * The tools that answer about names and codes, against fixture mods over a real round trip
 * (docs/PLAN.md item 6.2): `lookup` returns the core's lookup; `find_definition` by name and by
 * place; `find_references` and `list_definitions` page by page, the mod's places first;
 * `explain_code` the inventory's rows. The mod `lookup-definitions-and-uses` read over the game
 * stub `lookup` (fixtures/mods/lookup-definitions-and-uses/README.md says what is in it).
 */

import assert from 'node:assert/strict';
import {
    catalogueFromSpec,
    diskFileSource,
    inventoryRows,
    lookup,
    openSpec,
    openWorkspace,
    type SourceListing,
} from '@pychivalry/core';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './args.js';
import { withSpans } from './places.js';
import { connect, GAMES, MODS, scratch, type Connection } from './testing.js';
import { rowOutput } from './tools/explain.js';

const spec = openSpec(defaultSpecDir());
const MOD = path.join(MODS, 'lookup-definitions-and-uses');
const GAME = path.join(GAMES, 'lookup', 'game');

async function server(t: TestContext): Promise<Connection> {
    const dir = scratch(t);
    return connect(t, ['--mod', MOD, '--vanilla', GAME], path.join(dir, 'cache'));
}

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** Every page of a lookup, each name's parts joined: its head and all its readings. */
async function lookupAll(
    s: Connection,
    args: Record<string, unknown>,
): Promise<{ results: Record<string, unknown>[]; pages: number }> {
    const results: Record<string, unknown>[] = [];
    let cursor: unknown = undefined;
    let pages = 0;
    do {
        const out = await s.output('lookup', cursor === undefined ? args : { ...args, cursor });
        pages++;
        for (const part of out['results'] as Record<string, unknown>[]) {
            const last = results.at(-1);
            if (part['continued'] === true) {
                assert.equal(last?.['name'], part['name'], 'a name continues where it stopped');
                (last?.['readings'] as unknown[]).push(...(part['readings'] as unknown[]));
            } else {
                results.push({ ...part, readings: [...(part['readings'] as unknown[])] });
            }
        }
        cursor = out['next_cursor'];
    } while (cursor !== null);
    return { results, pages };
}

test("lookup returns the core's lookup of each name, its places counted from 1, page by page", async (t) => {
    const s = await server(t);
    const names = [
        'fixture_scripted_trigger',
        'monthly_prestige',
        'every_fixture_list',
        'fixture_scripted_trigge',
        'add_trait',
        'trait',
    ];
    const { results, pages } = await lookupAll(s, { names });
    assert.ok(pages > 1, 'trait alone is longer than one result');
    const workspace = openWorkspace({ spec, modDir: MOD, gameDir: GAME, cacheDir: null });
    const listings: SourceListing[] = [];
    if (workspace.game !== null) {
        listings.push(workspace.game.listing);
    }
    if (workspace.mod !== null) {
        listings.push(workspace.mod);
    }
    for (const [i, name] of names.entries()) {
        const got = results[i] ?? {};
        // The uses a head lists may be cut to fit (the answer says how many); the rest is the
        // core's answer, with its places as spans.
        const limit = (got['uses'] as { limit: number }).limit;
        assert.ok([20, 5, 0].includes(limit));
        const core = lookup(name, {
            spec,
            index: workspace.index,
            files: diskFileSource(listings),
            language: null,
            usesLimit: limit,
        });
        const expected = json(withSpans(core)) as Record<string, unknown>;
        assert.equal(got['readings_total'], core.readings.length);
        const answer = Object.fromEntries(
            Object.entries(got).filter(([field]) => field !== 'readings_total'),
        );
        assert.deepEqual(answer, expected, name);
    }
    const one = await s.output('lookup', { names: ['fixture_scripted_trigger'] });
    const [first] = one['results'] as { uses: { limit: number; first: object[] } }[];
    assert.equal(first?.uses.limit, 20);
    assert.deepEqual(Object.keys(first.uses.first[0] ?? {}), [
        'layer',
        'file',
        'line',
        'column',
        'end_line',
        'end_column',
        'read',
    ]);
    // The language chooses the localization text shown, not the definitions listed.
    const texts = async (args: Record<string, unknown>): Promise<string> =>
        JSON.stringify((await lookupAll(s, args)).results.map((r) => r['readings']));
    assert.match(await texts({ names: ['monthly_prestige'] }), /"language":"l_french"/);
    const english = await texts({ names: ['monthly_prestige'], language: 'l_english' });
    assert.match(english, /"language":"l_english"/);
    assert.doesNotMatch(english, /"language":"l_french"/);
    const bad = await s.error('lookup', { names: ['x'], language: 'english' });
    assert.match(
        bad,
        /language: english is not a language .*; the languages are l_english, l_french/,
    );
    const other = await s.error('lookup', { names: ['trait'], cursor: one['next_cursor'] ?? 'x' });
    assert.match(other, /cursor/);
});

test('find_definition by name: every definition, the one in force first, and the rule that decides', async (t) => {
    const s = await server(t);
    const out = await s.output('find_definition', { name: 'fixture_scripted_trigger' });
    assert.equal(out['name'], 'fixture_scripted_trigger');
    assert.equal(out['at'], null);
    const [group] = out['definitions'] as {
        database: string;
        inForce: { status: string; rule?: string };
        definitions: { layer: string; file: string; line: number; inForce: string }[];
    }[];
    assert.equal(group?.database, 'common/scripted_triggers');
    assert.equal(group.inForce.status, 'winner');
    assert.equal(group.inForce.rule, 'scripted-triggers-and-effects-later-wins-whole');
    assert.deepEqual(
        group.definitions.map((d) => [d.layer, d.file, d.line, d.inForce]),
        [
            ['mod', 'common/scripted_triggers/zz_fixture_triggers.txt', 1, 'yes'],
            ['game', 'common/scripted_triggers/00_fixture_triggers.txt', 1, 'no'],
        ],
    );
    const nowhere = await s.output('find_definition', { name: 'add_trait' });
    assert.deepEqual(nowhere['definitions'], []);
    assert.match(String((nowhere['notes'] as string[]).at(-1)), /lookup says what it is/);
});

test('find_definition by place: the name written there, then its definitions', async (t) => {
    const s = await server(t);
    // `fixture_scripted_trigger = yes` on line 6 of the mod's event file, column 3 onwards.
    const out = await s.output('find_definition', {
        file: 'events/fixture_lookup_mod_events.txt',
        line: 6,
        column: 10,
    });
    assert.equal(out['name'], 'fixture_scripted_trigger');
    assert.deepEqual(out['at'], {
        file: 'events/fixture_lookup_mod_events.txt',
        line: 6,
        column: 3,
        end_line: 6,
        end_column: 27,
        written_as: 'use',
    });
    assert.equal((out['definitions'] as unknown[]).length, 1);
    const definition = await s.output('find_definition', {
        file: 'common/scripted_triggers/zz_fixture_triggers.txt',
        line: 1,
        column: 1,
    });
    assert.equal((definition['at'] as { written_as: string }).written_as, 'definition');
    const blank = await s.output('find_definition', {
        file: 'events/fixture_lookup_mod_events.txt',
        line: 2,
        column: 1,
    });
    assert.equal(blank['name'], null);
    assert.match(String((blank['notes'] as string[]).at(-1)), /no name is written at line 2/);
});

test('find_references: the count by layer, the mod first, a page at a time', async (t) => {
    const s = await server(t);
    const first = await s.output('find_references', { name: 'fixture_scripted_trigger', limit: 3 });
    assert.equal(first['count'], 5);
    assert.deepEqual(first['by_layer'], { game: 3, mod: 2 });
    const refs = first['references'] as { layer: string; file: string; line: number }[];
    assert.deepEqual(
        refs.map((r) => [r.layer, r.line]),
        [
            ['mod', 6],
            ['mod', 14],
            ['game', 6],
        ],
    );
    const next = await s.output('find_references', {
        name: 'fixture_scripted_trigger',
        limit: 3,
        cursor: first['next_cursor'],
    });
    assert.equal((next['references'] as unknown[]).length, 2);
    assert.equal(next['next_cursor'], null);
    const none = await s.output('find_references', { name: 'nothing_writes_this' });
    assert.equal(none['count'], 0);
});

test('list_definitions: a kind, the mod first, each with whether it is in force', async (t) => {
    const s = await server(t);
    const out = await s.output('list_definitions', { kind: 'common/scripted_triggers' });
    assert.equal(out['count'], 2);
    assert.deepEqual(out['by_layer'], { game: 1, mod: 1 });
    assert.deepEqual(
        (out['definitions'] as { name: string; layer: string; in_force: string }[]).map((d) => [
            d.name,
            d.layer,
            d.in_force,
        ]),
        [
            ['fixture_scripted_trigger', 'mod', 'yes'],
            ['fixture_scripted_trigger', 'game', 'no'],
        ],
    );
    const bad = await s.error('list_definitions', { kind: 'scripted_triggers' });
    assert.match(bad, /kind: scripted_triggers holds no definition/);
    assert.match(bad, /did you mean common\/scripted_triggers/);
    assert.match(bad, /the kinds the mod defines are .*events/);
});

test('explain_code: the rows of the inventory, a family with <family>/*', async (t) => {
    const s = await server(t);
    const rows = inventoryRows(catalogueFromSpec(spec.data));
    const out = await s.output('explain_code', {
        codes: ['names/unknown-effect', 'localization/*', 'nope'],
    });
    assert.deepEqual(
        out['codes'],
        json(
            [
                ...rows.filter((r) => r.code === 'names/unknown-effect'),
                ...rows.filter((r) => r.family === 'localization'),
            ].map(rowOutput),
        ),
        'in the order asked',
    );
    assert.deepEqual(out['unknown'], ['nope']);
    const unused = (out['codes'] as { code: string; off_by_default: boolean }[]).find(
        (r) => r.code === 'localization/unused-key',
    );
    assert.equal(unused?.off_by_default, true);
    const all = await s.output('explain_code', { codes: ['*'] });
    const shown = (all['codes'] as unknown[]).length + (all['not_shown'] as unknown[]).length;
    assert.equal(shown, rows.length, 'every code, shown or named to ask again');
});
