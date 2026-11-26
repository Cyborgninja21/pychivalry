/**
 * `call_graph` (docs/PLAN.md item 10.7, tool schema version 6), over a real round trip: each name
 * answered whole with the core's call graph (`CallGraph`), its places written as every place is;
 * a game place says its layer and `read_with: "source"`; one side alone; a name too large for one
 * result written smaller, its counts whole; names that do not fit named in `not_answered`, with no
 * cursor. The mod `call-graph` read alone, and the mod `lookup-definitions-and-uses` over the game
 * stub `lookup`.
 */

import assert from 'node:assert/strict';
import {
    CallGraph,
    diskFileSource,
    linkKind,
    openSpec,
    openWorkspace,
    type CallLink,
    type SourceListing,
} from '@pychivalry/core';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir } from './args.js';
import { placeOf } from './places.js';
import { RESULT_BUDGET } from './result.js';
import {
    connect,
    GAMES,
    MODS,
    resultSize,
    scratch,
    write,
    MAX_RESULT_CHARACTERS,
} from './testing.js';

const spec = openSpec(defaultSpecDir());
const CALLS_MOD = path.join(MODS, 'call-graph');

function coreGraph(modDir: string, gameDir: string | null): CallGraph {
    const workspace = openWorkspace({ spec, modDir, gameDir, cacheDir: null });
    const listings: SourceListing[] = [];
    if (workspace.game !== null) {
        listings.push(workspace.game.listing);
    }
    if (workspace.mod !== null) {
        listings.push(workspace.mod);
    }
    return new CallGraph({ spec, index: workspace.index, files: diskFileSource(listings) });
}

/** A link as the tool writes it (`tools/calls.ts`), from the side asked. */
function written(link: CallLink, side: 'callers' | 'callees'): Record<string, unknown> {
    const other = side === 'callers' ? link.from : link.to;
    return {
        ...placeOf(link.at.layer, link.at.file, link.at.range),
        name: other.name,
        database: other.database,
        ...(side === 'callees' ? { defined: link.to.defined } : {}),
        kind: linkKind(link),
        via: link.via,
        basis: link.basis.kind,
        ...(link.basis.kind === 'field-reference'
            ? { row: link.basis.row, status: link.basis.status }
            : {}),
    };
}

test("call_graph answers each name whole: the core's callers, callees and definitions", async (t) => {
    const s = await connect(t, ['--mod', CALLS_MOD, '--no-vanilla'], path.join(scratch(t), 'c'));
    const names = [
        'fixture_calls.1',
        'fixture_calls.2',
        'fixture_call_effect',
        'fixture_call_trigger',
        'fixture_on_action_a',
        'fixture_call_decision',
        'fixture_calls.9',
    ];
    const out = await s.output('call_graph', { names });
    assert.equal(out['not_answered'], null);
    const graph = coreGraph(CALLS_MOD, null);
    const results = out['results'] as Record<string, unknown>[];
    assert.deepEqual(
        results.map((r) => r['name']),
        names,
    );
    for (const result of results) {
        const answer = graph.answer(String(result['name']));
        for (const side of ['callers', 'callees'] as const) {
            const got = result[side] as Record<string, unknown>;
            assert.equal(got['count'], answer[side].length);
            assert.equal(got['not_listed'], 0);
            assert.deepEqual(
                got['links'],
                answer[side].map((l) => written(l, side)),
                `${String(result['name'])} ${side}`,
            );
        }
        assert.equal(result['detail'], undefined);
        assert.equal((result['definitions'] as { count: number }).count, answer.definitions.length);
    }
    // The decision calls a scripted effect and a scripted trigger, and fires an event.
    const decision = results.find((r) => r['name'] === 'fixture_call_decision');
    assert.deepEqual((decision?.['callees'] as { by_kind: unknown }).by_kind, {
        'common/decisions -> common/scripted_triggers': 1,
        'common/decisions -> common/scripted_effects': 1,
        'common/decisions -> events': 1,
    });
    // An event fired that nothing defines: called, and defined nowhere.
    const missing = results.find((r) => r['name'] === 'fixture_calls.9');
    assert.equal((missing?.['definitions'] as { count: number }).count, 0);
    assert.equal((missing?.['callers'] as { count: number }).count, 1);
});

test('call_graph over a base game: each game place says its layer and read_with source', async (t) => {
    const mod = path.join(MODS, 'lookup-definitions-and-uses');
    const game = path.join(GAMES, 'lookup', 'game');
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(scratch(t), 'c'));
    const out = await s.output('call_graph', {
        names: ['fixture_scripted_trigger'],
        direction: 'callers',
    });
    const [result] = out['results'] as Record<string, unknown>[];
    assert.equal(result?.['callees'], undefined, 'one side only');
    const links = (result?.['callers'] as { links: Record<string, unknown>[] }).links;
    assert.ok(links.some((l) => l['layer'] === 'mod' && l['read_with'] === undefined));
    assert.ok(links.some((l) => l['layer'] === 'game' && l['read_with'] === 'source'));
    // The mod's first.
    const layers = links.map((l) => l['layer']);
    assert.deepEqual(
        layers,
        [...layers].sort((a, b) => Number(a !== 'mod') - Number(b !== 'mod')),
    );
    const graph = coreGraph(mod, game);
    assert.deepEqual(
        links,
        graph.callers('fixture_scripted_trigger').map((l) => written(l, 'callers')),
    );
});

test('a name with more links than one result holds is written smaller; names after it wait, with no cursor', async (t) => {
    // A mod with one scripted effect called from 400 events, and another from 400 decisions.
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    const events = ['namespace = big', ''];
    const decisions: string[] = [];
    for (let i = 1; i <= 400; i++) {
        events.push(`big.${String(i)} = {`, '\ttype = character_event', '\thidden = yes');
        events.push('\timmediate = {', '\t\tbig_effect = yes', '\t}', '}', '');
        decisions.push(
            `big_decision_${String(i)} = {`,
            '\teffect = {',
            '\t\tother_effect = yes',
            '\t}',
            '}',
        );
    }
    write(path.join(mod, 'descriptor.mod'), 'name="big"\n');
    write(path.join(mod, 'events', 'big_events.txt'), events.join('\n'));
    write(path.join(mod, 'common', 'decisions', 'big_decisions.txt'), decisions.join('\n'));
    write(
        path.join(mod, 'common', 'scripted_effects', 'big_effects.txt'),
        'big_effect = {\n\tadd_gold = 1\n}\nother_effect = {\n\tadd_gold = 1\n}\n',
    );
    const s = await connect(t, ['--mod', mod, '--no-vanilla'], path.join(dir, 'cache'));
    const result = await s.call('call_graph', { names: ['big_effect', 'other_effect'] });
    assert.notEqual(result.isError, true);
    assert.ok(resultSize(result) <= MAX_RESULT_CHARACTERS);
    const out = result.structuredContent ?? {};
    assert.ok(JSON.stringify(out).length <= RESULT_BUDGET);
    const [first, second] = out['results'] as Record<string, unknown>[];
    assert.equal(second, undefined, 'one name a result when the first is cut');
    assert.equal(first?.['name'], 'big_effect');
    assert.equal(first['detail'], 'cut');
    const callers = first['callers'] as {
        count: number;
        links: unknown[];
        not_listed: number;
        by_kind: Record<string, number>;
    };
    assert.equal(callers.count, 400);
    assert.deepEqual(callers.by_kind, { 'events -> common/scripted_effects': 400 });
    assert.ok(callers.links.length > 0 && callers.links.length < 400);
    assert.equal(callers.links.length + callers.not_listed, 400);
    assert.deepEqual(out['not_answered'], {
        names: ['other_effect'],
        ask: 'These names did not fit in this result: ask call_graph about them in another call, with the same direction. call_graph has no cursor and no pages: every name it answers is answered whole',
    });
});

test('call_graph refuses a name longer than any name of the game', async (t) => {
    const s = await connect(t, ['--mod', CALLS_MOD, '--no-vanilla'], path.join(scratch(t), 'c'));
    assert.match(
        await s.error('call_graph', { names: ['x'.repeat(121)] }),
        /names\[0\]: longer than 120 characters/,
    );
    assert.match(
        await s.error('call_graph', { names: ['x'], direction: 'up' }),
        /direction: "up" is not one of the valid values: both, callers, callees/,
    );
});
