/**
 * The tools that answer about names and codes, against fixture mods over a real round trip
 * (docs/PLAN.md item 6.2): `lookup` answers every name whole with the core's facts (since tool
 * schema version 4, compactly: `lookup-answer.ts`); `find_definition` by name and by
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
    type FieldReading,
    type LookupResult,
    type Reading,
    type SourceListing,
} from '@pychivalry/core';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './args.js';
import { placeOf } from './places.js';
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

/** The core's lookup of a name over the fixture mod and its game stub. */
function coreLookup(name: string, language: string | null = null): LookupResult {
    const workspace = openWorkspace({ spec, modDir: MOD, gameDir: GAME, cacheDir: null });
    const listings: SourceListing[] = [];
    if (workspace.game !== null) {
        listings.push(workspace.game.listing);
    }
    if (workspace.mod !== null) {
        listings.push(workspace.mod);
    }
    return lookup(name, {
        spec,
        index: workspace.index,
        files: diskFileSource(listings),
        language,
        usesLimit: 3,
    });
}

/**
 * The facts of a core reading that the agent server's compact reading must state, each held
 * against it: its kind, its folder for a field, its description, its scopes, what it takes and its
 * removal. The evidence behind them is left to the command line's lookup --json.
 */
function sameFacts(name: string, got: Record<string, unknown>, r: Reading, brief: boolean): void {
    const at = `${name}: ${r.kind}`;
    assert.equal(got['kind'], r.kind, at);
    if (r.kind === 'field') {
        assert.equal(got['folder'], r.directory, at);
        if (brief) {
            assert.equal(got['description'], undefined, `${at}: in brief`);
            return;
        }
    }
    if (r.kind === 'bucket') {
        assert.equal(got['bucket'], r.bucket, at);
    }
    if (r.description.status === 'known') {
        for (const text of got['description'] as string[]) {
            assert.ok(
                r.description.texts.some((t) => t.text === text),
                `${at}: a description of the core's`,
            );
        }
        for (const t of r.description.texts) {
            assert.ok(
                (got['description'] as string[]).some((text) => text.includes(t.text)),
                `${at}: every description of the core's is stated`,
            );
        }
    } else {
        assert.equal(got['description'], undefined, at);
    }
    if (r.scopes.status === 'supported') {
        assert.deepEqual(got['scopes'], r.scopes.scopes, at);
    }
    if (r.takes.status === 'known') {
        assert.deepEqual(got['takes'], r.takes.forms, at);
    }
    assert.deepEqual(
        ((got['removed'] ?? []) as { removed_in: string }[]).map((x) => x.removed_in),
        r.retired.map((x) => x.removed_in),
        at,
    );
}

test("lookup answers every name whole in one call, with the core's facts, its places counted from 1", async (t) => {
    const s = await server(t);
    const names = [
        'fixture_scripted_trigger',
        'monthly_prestige',
        'every_fixture_list',
        'fixture_scripted_trigge',
        'add_trait',
        'trait',
    ];
    const out = await s.output('lookup', { names });
    assert.equal(out['not_answered'], null, 'every name answered');
    assert.equal('next_cursor' in out, false, 'lookup has no cursor');
    const results = out['results'] as Record<string, unknown>[];
    assert.deepEqual(
        results.map((r) => r['name']),
        names,
        'in the order asked',
    );
    for (const [i, name] of names.entries()) {
        const got = results[i] ?? {};
        const core = coreLookup(name);
        assert.equal(got['unknown'], core.unknown, name);
        const readings = got['readings'] as Record<string, unknown>[];
        assert.equal(readings.length, core.readings.length, `${name}: every reading`);
        const brief = got['fields_in_brief'] === true;
        assert.equal(
            brief,
            core.readings.filter((r) => r.kind === 'field').length > 3,
            `${name}: fields in brief only for a field of many folders`,
        );
        core.readings.forEach((r, j) => {
            sameFacts(name, readings[j] ?? {}, r, brief);
        });
        // Where it is defined and used: the counts whole, the places by the one writer.
        const definitions = got['definitions'] as {
            count: number;
            groups: { database: string; count: number; first: Record<string, unknown>[] }[];
        };
        const coreGroups = core.definitions.status === 'read' ? core.definitions.groups : [];
        assert.equal(
            definitions.count,
            coreGroups.reduce((n, g) => n + g.definitions.length, 0),
            `${name}: definitions counted whole`,
        );
        assert.deepEqual(
            definitions.groups.map((g) => [g.database, g.count]),
            coreGroups.map((g) => [g.database, g.definitions.length]),
            name,
        );
        for (const group of definitions.groups) {
            assert.ok(group.first.length <= 3, `${name}: at most three places a group`);
        }
        const uses = got['uses'] as {
            count: number;
            by_layer: Record<string, number>;
            first: Record<string, unknown>[];
        };
        assert.ok(core.uses.status === 'read');
        assert.equal(uses.count, core.uses.count, `${name}: uses counted whole`);
        assert.deepEqual(uses.by_layer, core.uses.byLayer, name);
        assert.deepEqual(
            uses.first,
            json(core.uses.first.map((u) => placeOf(u.layer, u.file, u.range))),
            `${name}: the first three uses, by the one writer`,
        );
    }
    // A name nothing knows: the names close to it.
    assert.ok(
        ((results[3]?.['did_you_mean'] ?? []) as string[]).includes('fixture_scripted_trigger'),
    );
    // A use in the base game: a place outside the mod, which says it is read with source.
    const one = await s.output('lookup', { names: ['fixture_scripted_trigger'] });
    const [first] = one['results'] as { uses: { first: Record<string, unknown>[] } }[];
    assert.equal(first?.uses.first[0]?.['layer'], 'game');
    assert.deepEqual(Object.keys(first.uses.first[0] as object), [
        'layer',
        'file',
        'line',
        'column',
        'end_line',
        'end_column',
        'read_with',
    ]);
    assert.equal(first.uses.first[0]['read_with'], 'source');
    // The language chooses the localization text shown, and the definitions of localization
    // keys: those of other languages are counted, not listed.
    const texts = async (args: Record<string, unknown>): Promise<string> =>
        JSON.stringify(
            ((await s.output('lookup', args))['results'] as Record<string, unknown>[]).map(
                (r) => r['readings'],
            ),
        );
    assert.match(await texts({ names: ['monthly_prestige'] }), /"language":"l_french"/);
    const english = await texts({ names: ['monthly_prestige'], language: 'l_english' });
    assert.match(english, /"language":"l_english"/);
    assert.doesNotMatch(english, /"language":"l_french"/);
    const bad = await s.error('lookup', { names: ['x'], language: 'english' });
    assert.match(
        bad,
        /language: english is not a language .*; the languages are l_english, l_french/,
    );
    assert.match(
        await s.error('lookup', { names: ['trait'], cursor: 'x' }),
        /cursor: no such argument; the arguments are names, language, folder/,
    );
});

test('lookup with folder gives the field readings of that folder in full, the others counted', async (t) => {
    const s = await server(t);
    const core = coreLookup('trait');
    const fields = core.readings.filter((r): r is FieldReading => r.kind === 'field');
    assert.ok(fields.length > 3, 'trait is a field of many folders');
    const folder = fields[0]?.directory ?? '';
    const out = await s.output('lookup', { names: ['trait'], folder });
    const [answer] = out['results'] as Record<string, unknown>[];
    const readings = answer?.['readings'] as Record<string, unknown>[];
    const kept = core.readings.filter((r) => r.kind !== 'field' || r.directory === folder);
    assert.equal(readings.length, kept.length);
    kept.forEach((r, j) => {
        sameFacts('trait', readings[j] ?? {}, r, false);
    });
    assert.equal(answer?.['fields_in_brief'], undefined, 'in full');
    assert.equal(answer?.['fields_elsewhere'], fields.filter((r) => r.directory !== folder).length);
    assert.match(
        await s.error('lookup', { names: ['trait'], folder: 'traits' }),
        /folder: traits is not a folder the game reads; did you mean .*common\/traits/,
    );
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
    // `fixture_scripted_trigger = yes` on line 5 of the mod's event file, column 14 onwards.
    const out = await s.output('find_definition', {
        file: 'events/fixture_lookup_mod_events.txt',
        line: 5,
        column: 20,
    });
    assert.equal(out['name'], 'fixture_scripted_trigger');
    assert.deepEqual(out['at'], {
        layer: 'mod',
        file: 'events/fixture_lookup_mod_events.txt',
        line: 5,
        column: 14,
        end_line: 5,
        end_column: 38,
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
    const refs = first['references'] as {
        layer: string;
        file: string;
        line: number;
        read_with?: string;
    }[];
    assert.deepEqual(
        refs.map((r) => [r.layer, r.line, r.read_with]),
        [
            ['mod', 5, undefined],
            ['mod', 10, undefined],
            ['game', 6, 'source'],
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
    const unused = (
        out['codes'] as { code: string; off_by_default: boolean; can_turn_off: boolean }[]
    ).find((r) => r.code === 'localization/unused-key');
    assert.equal(unused?.off_by_default, false);
    assert.equal(unused.can_turn_off, true);
    const all = await s.output('explain_code', { codes: ['*'] });
    const shown = (all['codes'] as unknown[]).length + (all['not_shown'] as unknown[]).length;
    assert.equal(shown, rows.length, 'every code, shown or named to ask again');
    // Item 6.11: a message was shown with its raw %s; every value is a readable slot now.
    assert.doesNotMatch(JSON.stringify(all['codes']), /%s|\{\}/);
    const required = await s.output('explain_code', { codes: ['fields/missing-required-field'] });
    assert.equal(
        (required['codes'] as { message: string }[])[0]?.message,
        'The <record> is missing a field the spec package marks required.',
    );
});
