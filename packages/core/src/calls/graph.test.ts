/**
 * The call graph equals the known graph of the fixture mod `call-graph`, for all five kinds of
 * link docs/PLAN.md item 10.6 names (its "Done when" 3), and callers and callees of each name
 * are the graph's own links.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { openWorkspace } from '../check/workspace.js';
import { diskFileSource } from '../lookup/localization.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { specContext } from '../check/testing.js';
import { CallGraph, linkKind } from './graph.js';
import { callRows, firedDatabases, type CallLink } from './links.js';

const MOD = path.join(REPO_ROOT, 'fixtures', 'mods', 'call-graph');

interface WrittenLink {
    readonly kind: string;
    readonly from: { readonly name: string; readonly database: string };
    readonly to: { readonly name: string; readonly database: string; readonly defined: boolean };
    readonly via: string;
    readonly basis: CallLink['basis'];
    readonly at: { readonly file: string; readonly line: number; readonly column: number };
}

function written(link: CallLink): WrittenLink {
    return {
        kind: linkKind(link),
        from: { name: link.from.name, database: link.from.database },
        to: link.to,
        via: link.via,
        basis: link.basis,
        at: {
            file: link.at.file,
            line: link.at.range.start.line + 1,
            column: link.at.range.start.character + 1,
        },
    };
}

function graph(): CallGraph {
    const spec = committedSpec();
    const workspace = openWorkspace({
        spec,
        gameDir: null,
        cacheDir: null,
        modDir: MOD,
        platform: 'linux',
    });
    const listings = workspace.mod === null ? [] : [workspace.mod];
    return new CallGraph({ spec, index: workspace.index, files: diskFileSource(listings) });
}

const expected = (
    JSON.parse(readFileSync(path.join(MOD, 'expected.json'), 'utf8')) as {
        links: WrittenLink[];
    }
).links;

test('the call graph equals the known graph of the fixture mod', () => {
    assert.deepEqual(graph().all().map(written), expected);
});

test('the known graph has all five kinds of link, and the others the package marks as calls', () => {
    const kinds = new Set(expected.map((l) => l.kind));
    // An event triggering an event; a scripted effect call; a scripted trigger call; an
    // on-action firing an event or another on-action; a decision firing an event.
    for (const kind of [
        'events -> events',
        'events -> common/scripted_effects',
        'events -> common/scripted_triggers',
        'common/on_action -> events',
        'common/on_action -> common/on_action',
        'common/decisions -> events',
    ]) {
        assert.ok(kinds.has(kind), kind);
    }
    // Beside them: an event firing an on-action, a scripted effect firing an event.
    assert.ok(kinds.has('events -> common/on_action'));
    assert.ok(kinds.has('common/scripted_effects -> events'));
    // An event fired that nothing defines is a link too, its callee not defined.
    assert.deepEqual(
        expected.filter((l) => !l.to.defined).map((l) => l.to.name),
        ['fixture_calls.9'],
    );
});

test("each name's callers and callees are the graph's own links that name it or are written in it", () => {
    const g = graph();
    const all = g.all().map(written);
    const names = new Set(all.flatMap((l) => [l.from.name, l.to.name]));
    for (const name of names) {
        const byAt = (a: WrittenLink, b: WrittenLink): number =>
            a.at.file.localeCompare(b.at.file) ||
            a.at.line - b.at.line ||
            a.at.column - b.at.column;
        assert.deepEqual(
            g.callers(name).map(written).sort(byAt),
            all.filter((l) => l.to.name === name).sort(byAt),
            `callers of ${name}`,
        );
        assert.deepEqual(
            g.callees(name).map(written).sort(byAt),
            all.filter((l) => l.from.name === name).sort(byAt),
            `callees of ${name}`,
        );
    }
    assert.deepEqual(g.callers('nothing_calls_this'), []);
    assert.deepEqual(g.callees('fixture_calls.9'), []);
});

test('the databases the game fires come from the package: part D4 and the on-action database of part D6', () => {
    const spec = committedSpec();
    const { folders } = specContext();
    assert.deepEqual(firedDatabases(spec, folders), ['events', 'common/on_action']);
    const rows = callRows(spec, folders);
    const ids = [...rows.fields.values(), ...rows.keywords.values()].flat().map((r) => r.row.id);
    // The rows a link is read by, confirmed and measured only; none of another database.
    for (const id of [
        'effects::trigger_event',
        'effects::trigger_event.id',
        'effects::trigger_event.on_action',
        'common/on_action::events',
        'common/on_action::on_actions',
        'common/on_action::random_events.<number>',
    ]) {
        assert.ok(ids.includes(id), id);
    }
    assert.ok(
        [...rows.fields.values(), ...rows.keywords.values()]
            .flat()
            .every((r) => r.databases.some((db) => rows.fired.includes(db))),
    );
    // Read: confirmed and measured-only rows, never unknown or not-a-key ones.
    const statuses = new Set(
        [...rows.fields.values(), ...rows.keywords.values()].flat().map((r) => r.row.status),
    );
    assert.deepEqual([...statuses].sort(), ['confirmed', 'measured-only']);
    // A trigger that tests a decision names no database the game fires: no link.
    assert.ok(!ids.includes('triggers::can_execute_decision'));
});
