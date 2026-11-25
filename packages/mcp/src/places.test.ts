/**
 * Every place a tool names is written by one writer (`places.ts`, tool schema version 4): its
 * layer, its file's path inside the layer, its span from 1, and, outside the mod, `read_with:
 * "source"`. Held on every tool's answer over a real round trip: each place of the mod is a file
 * under the mod's folder; each place of the base game says it is read with `source`, and `source`
 * shows it. The expert requests' development run had a session read a game place as if it were
 * under its mod.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { modPlaceOf, placeOf, withPlaces } from './places.js';
import { connect, GAMES, MODS, scratch, type Connection } from './testing.js';

const SPAN = ['line', 'column', 'end_line', 'end_column'];

/** Every object of a value that names a place: a file and a span. */
function placesIn(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        for (const v of value) {
            placesIn(v, out);
        }
        return out;
    }
    if (typeof value !== 'object' || value === null) {
        return out;
    }
    const o = value as Record<string, unknown>;
    if (typeof o['file'] === 'string' && SPAN.every((k) => typeof o[k] === 'number')) {
        out.push(o);
    }
    for (const inner of Object.values(o)) {
        placesIn(inner, out);
    }
    return out;
}

test('the one writer: the layer, the file, the span from 1, and read_with outside the mod', () => {
    const range = { start: { line: 4, character: 2 }, end: { line: 4, character: 9 } };
    assert.deepEqual(placeOf('game', 'common/x.txt', range), {
        layer: 'game',
        file: 'common/x.txt',
        line: 5,
        column: 3,
        end_line: 5,
        end_column: 10,
        read_with: 'source',
    });
    assert.deepEqual(placeOf('dlc:fp1', 'common/x.txt', range)['read_with'], 'source');
    assert.deepEqual(modPlaceOf('events/a.txt', range), {
        layer: 'mod',
        file: 'events/a.txt',
        line: 5,
        column: 3,
        end_line: 5,
        end_column: 10,
    });
    // A value of the core's: a definition keeps its layer, a fix's edit (no layer) is the mod's.
    assert.deepEqual(
        withPlaces({
            definitions: [{ layer: 'jomini', file: 'a.txt', range, form: 'block' }],
            edits: [{ file: 'b.txt', range, new_text: 'x' }],
            other: { range },
        }),
        {
            definitions: [
                {
                    layer: 'jomini',
                    file: 'a.txt',
                    line: 5,
                    column: 3,
                    end_line: 5,
                    end_column: 10,
                    read_with: 'source',
                    form: 'block',
                },
            ],
            edits: [
                {
                    layer: 'mod',
                    file: 'b.txt',
                    line: 5,
                    column: 3,
                    end_line: 5,
                    end_column: 10,
                    new_text: 'x',
                },
            ],
            other: { line: 5, column: 3, end_line: 5, end_column: 10 },
        },
    );
});

/** Every place of every answer: each one the writer's, the mod's a file under the mod, the game's shown by source. */
async function heldPlaces(s: Connection, mod: string, answers: unknown[]): Promise<number[]> {
    let game = 0;
    let own = 0;
    for (const place of placesIn(answers)) {
        const layer = place['layer'];
        assert.equal(typeof layer, 'string', `a place says its layer: ${JSON.stringify(place)}`);
        if (layer === 'mod') {
            own++;
            assert.equal('read_with' in place, false, JSON.stringify(place));
            assert.ok(
                existsSync(path.join(mod, ...(place['file'] as string).split('/'))),
                `a file of the mod: ${String(place['file'])}`,
            );
            continue;
        }
        game++;
        assert.equal(place['read_with'], 'source', JSON.stringify(place));
        const shown = await s.output('source', {
            layer,
            file: place['file'],
            line: place['line'],
            context: 0,
        });
        assert.equal(
            (shown['lines'] as string[])[0]?.split('\t')[0],
            String(place['line']),
            `source shows ${String(place['file'])}:${String(place['line'])}`,
        );
    }
    return [own, game];
}

test("every tool's places are the writer's: the mod's under the mod, the base game's read with source", async (t) => {
    const dir = scratch(t);
    const mod = path.join(MODS, 'lookup-definitions-and-uses');
    const s = await connect(
        t,
        ['--mod', mod, '--vanilla', path.join(GAMES, 'lookup', 'game')],
        path.join(dir, 'cache'),
    );
    const answers: unknown[] = [
        await s.output('check', { min_severity: 'hint' }),
        await s.output('lookup', {
            names: ['fixture_scripted_trigger', 'monthly_prestige', 'every_fixture_list'],
        }),
        await s.output('find_definition', { name: 'fixture_scripted_trigger' }),
        await s.output('find_definition', {
            file: 'events/fixture_lookup_mod_events.txt',
            line: 5,
            column: 20,
        }),
        await s.output('find_references', { name: 'fixture_scripted_trigger' }),
        await s.output('list_definitions', { kind: 'common/scripted_triggers' }),
        await s.output('source', {
            layer: 'mod',
            file: 'events/fixture_lookup_mod_events.txt',
            line: 5,
        }),
    ];
    const [own, game] = await heldPlaces(s, mod, answers);
    assert.ok(
        (own ?? 0) > 5 && (game ?? 0) > 5,
        `places of both layers: ${String(own)} and ${String(game)}`,
    );
});

test("a finding's place and its fix's edits are the mod's", async (t) => {
    const dir = scratch(t);
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const s = await connect(
        t,
        ['--mod', mod, '--vanilla', path.join(GAMES, 'lookup', 'game')],
        path.join(dir, 'cache'),
    );
    const out = await s.output('check', { min_severity: 'hint', limit: 200 });
    const findings = out['findings'] as Record<string, unknown>[];
    assert.ok(findings.length > 0);
    assert.ok(
        findings.some((f) => f['fix'] !== null),
        'with a fix',
    );
    const places = placesIn(findings);
    assert.ok(places.length > findings.length, 'the fixes name places too');
    for (const place of places) {
        assert.equal(place['layer'], 'mod', JSON.stringify(place));
        assert.equal('read_with' in place, false);
    }
});
