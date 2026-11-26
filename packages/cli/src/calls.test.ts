/**
 * `calls` (calls.ts): the core's call graph answer, as text and as JSON, over the mod
 * `fixtures/mods/call-graph` (its README says what a correct call graph reads) and over the
 * stub game `fixtures/game/lookup`; the filters; exit codes.
 */

import assert from 'node:assert/strict';
import { CallGraph, diskFileSource, openSpec, openWorkspace } from '@pychivalry/core';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir } from './io.js';
import { REPO_ROOT, runCli, scratch } from './testing.js';

const MOD = path.join(REPO_ROOT, 'fixtures', 'mods', 'call-graph');
const ALONE = ['--mod', MOD, '--no-vanilla'];

test('calls as text: where a name is defined, what calls it and what it calls', (t) => {
    const r = runCli(['calls', 'fixture_calls.2', ...ALONE], { cache: scratch(t) });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
        r.stdout.trimEnd(),
        [
            'fixture_calls.2',
            '  defined in events: mod events/fixture_call_events.txt:15:1',
            '  called by 2',
            '    common/on_action fixture_on_action_a (common/on_action -> events), random_events.<number>: mod common/on_action/fixture_call_on_actions.txt:3:26; common/on_action::random_events.<number>, confirmed',
            '    events fixture_calls.1 (events -> events), trigger_event: mod events/fixture_call_events.txt:11:19; effects::trigger_event, measured-only',
            '  calls 3',
            '    common/scripted_effects fixture_call_effect (events -> common/scripted_effects), fixture_call_effect: mod events/fixture_call_events.txt:19:3; called by name',
            '    events fixture_calls.3 (events -> events), trigger_event.id: mod events/fixture_call_events.txt:21:9; effects::trigger_event.id, confirmed',
            '    common/on_action fixture_on_action_b (events -> common/on_action), trigger_event.on_action: mod events/fixture_call_events.txt:24:33; effects::trigger_event.on_action, confirmed',
        ].join('\n'),
    );
});

test("calls --json: one object per name, the core's answer as it is", (t) => {
    const names = ['fixture_calls.1', 'fixture_call_effect', 'fixture_on_action_b'];
    const r = runCli(['calls', ...names, ...ALONE, '--json'], { cache: scratch(t) });
    assert.equal(r.code, 0, r.stderr);
    const lines = r.stdout
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l) as unknown);
    const spec = openSpec(defaultSpecDir());
    const workspace = openWorkspace({ spec, gameDir: null, cacheDir: null, modDir: MOD });
    const graph = new CallGraph({
        spec,
        index: workspace.index,
        files: diskFileSource(workspace.mod === null ? [] : [workspace.mod]),
    });
    assert.deepEqual(
        lines,
        names.map((n) => JSON.parse(JSON.stringify(graph.answer(n))) as unknown),
    );
});

test('calls --callers and --callees give one side each, never both together', (t) => {
    const cache = scratch(t);
    const callers = runCli(['calls', 'fixture_call_trigger', ...ALONE, '--callers', '--json'], {
        cache,
    });
    assert.equal(callers.code, 0, callers.stderr);
    const one = JSON.parse(callers.stdout) as { callers: unknown[]; callees: unknown[] };
    assert.equal(one.callers.length, 3);
    assert.deepEqual(one.callees, []);
    const callees = runCli(['calls', 'fixture_call_effect', ...ALONE, '--callees'], { cache });
    assert.equal(callees.code, 0, callees.stderr);
    assert.doesNotMatch(callees.stdout, /\n {2}called by/);
    assert.match(callees.stdout, /calls 2\n/);
    const both = runCli(['calls', 'x', ...ALONE, '--callers', '--callees'], { cache });
    assert.equal(both.code, 2);
    assert.match(both.stderr, /--callers and --callees cannot both be given/);
});

test('calls exits 1 for a name nothing defines or calls, and 2 with nothing to read', (t) => {
    const cache = scratch(t);
    const none = runCli(['calls', 'nothing_defines_this', ...ALONE], { cache });
    assert.equal(none.code, 1);
    assert.match(none.stdout, /defined nowhere in the mod or the base game as script/);
    // Fired but defined nowhere: called, so known.
    const fired = runCli(['calls', 'fixture_calls.9', ...ALONE], { cache });
    assert.equal(fired.code, 0, fired.stderr);
    assert.match(fired.stdout, /called by 1\n/);
    const nothing = runCli(['calls', 'x', '--no-vanilla'], { cache });
    assert.equal(nothing.code, 2);
    assert.match(nothing.stderr, /nothing to read: give a mod with --mod <mod>/);
});

test('calls over a base game: the game places say their layer', (t) => {
    const game = path.join(REPO_ROOT, 'fixtures', 'game', 'lookup', 'game');
    const mod = path.join(REPO_ROOT, 'fixtures', 'mods', 'lookup-definitions-and-uses');
    const r = runCli(
        ['calls', 'fixture_scripted_trigger', '--vanilla', game, '--mod', mod, '--callers'],
        { cache: scratch(t) },
    );
    assert.equal(r.code, 0, r.stderr);
    assert.match(
        r.stdout,
        /\n {4}events \S+ \(events -> common\/scripted_triggers\), fixture_scripted_trigger: game events\/fixture_lookup_events\.txt:/,
    );
    assert.match(r.stdout, /: mod events\/fixture_lookup_mod_events\.txt:/);
});
