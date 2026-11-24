/**
 * The `check` tool against fixture mods, over a real round trip (docs/PLAN.md items 6.2 to
 * 6.4): it returns exactly the core's findings for the same mod, page by page; totals first,
 * over every finding of the path; the minimum severity, the codes, a file or a folder;
 * `unused_keys` (on by default, `false` turns it off); a cursor; and a mod edited between two
 * calls.
 */

import assert from 'node:assert/strict';
import { checkWorkspace, openSpec, type WorkspaceFinding } from '@pychivalry/core';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './args.js';
import { findingOutput, totalsOf } from './tools/check.js';
import {
    connect,
    gameStub,
    GAMES,
    modCopy,
    MODS,
    scratch,
    write,
    type Connection,
} from './testing.js';

const spec = openSpec(defaultSpecDir());

interface Setup {
    readonly game: string;
    readonly server: Connection;
}

/** The server on a mod, over a stand-in game (or a fixture's game stub). */
async function setup(t: TestContext, mod: string, game?: string): Promise<Setup> {
    const dir = scratch(t);
    const gameDir = game ?? gameStub(path.join(dir, 'install'));
    const server = await connect(t, ['--mod', mod, '--vanilla', gameDir], path.join(dir, 'cache'));
    return { game: gameDir, server };
}

/** Every page of a check, following the cursor. */
async function allPages(
    server: Connection,
    args: Record<string, unknown>,
): Promise<{ findings: unknown[]; pages: Record<string, unknown>[] }> {
    const pages: Record<string, unknown>[] = [];
    const findings: unknown[] = [];
    let cursor: unknown = undefined;
    do {
        const out = await server.output('check', cursor === undefined ? args : { ...args, cursor });
        pages.push(out);
        findings.push(...(out['findings'] as unknown[]));
        cursor = out['next_cursor'];
    } while (cursor !== null);
    return { findings, pages };
}

function core(mod: string, game: string, unusedKeys = true): WorkspaceFinding[] {
    return [
        ...checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null, unusedKeys })
            .findings,
    ];
}

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

test("check returns exactly the core's findings, page by page, totals first", async (t) => {
    for (const name of [
        'names-unknown-trigger-bad',
        'parse-broken-syntax',
        'names-unknown-modifier-bad',
        'structure-event-without-desc-bad',
    ]) {
        const mod = path.join(MODS, name);
        const { game, server } = await setup(t, mod);
        const expected = core(mod, game);
        const { findings, pages } = await allPages(server, { min_severity: 'hint', limit: 2 });
        assert.deepEqual(findings, json(expected.map(findingOutput)), name);
        const first = pages[0] ?? {};
        assert.deepEqual(Object.keys(first).slice(0, 4), [
            'files_checked',
            'totals',
            'matched',
            'findings',
        ]);
        assert.deepEqual(first['totals'], totalsOf(expected), `${name}: totals of every finding`);
        assert.equal(first['matched'], expected.length);
        assert.equal(pages.length, Math.max(1, Math.ceil(expected.length / 2)));
    }
});

test('the default lists errors only; the totals still count every severity', async (t) => {
    const mod = path.join(MODS, 'parse-broken-syntax');
    const { game, server } = await setup(t, mod);
    const expected = core(mod, game);
    const out = await server.output('check', { limit: 200 });
    const errors = expected.filter((f) => f.severity === 'error');
    assert.ok(errors.length > 0 && errors.length < expected.length);
    assert.deepEqual(out['findings'], json(errors.map(findingOutput)));
    assert.equal(out['matched'], errors.length);
    assert.deepEqual(out['totals'], totalsOf(expected));
    assert.equal(out['next_cursor'], null);
    const warnings = await server.output('check', { min_severity: 'information', limit: 200 });
    assert.deepEqual(
        warnings['findings'],
        json(expected.filter((f) => f.severity !== 'hint').map(findingOutput)),
    );
});

test('codes keep the findings of those codes, a family with <family>/*', async (t) => {
    const mod = path.join(MODS, 'parse-broken-syntax');
    const { game, server } = await setup(t, mod);
    const expected = core(mod, game);
    const syntax = await server.output('check', {
        min_severity: 'hint',
        codes: ['syntax/*'],
        limit: 200,
    });
    assert.deepEqual(
        syntax['findings'],
        json(expected.filter((f) => f.code.startsWith('syntax/')).map(findingOutput)),
    );
    const one = await server.output('check', {
        min_severity: 'hint',
        codes: ['syntax/unterminated-string'],
    });
    assert.deepEqual(
        (one['findings'] as { code: string }[]).map((f) => f.code),
        expected.filter((f) => f.code === 'syntax/unterminated-string').map((f) => f.code),
    );
});

test('a path checks one file or one folder of the mod, with the findings of a whole run', async (t) => {
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const { game, server } = await setup(t, mod);
    const expected = core(mod, game);
    const file = 'common/scripted_triggers/fixture_triggers.txt';
    const one = await server.output('check', { path: file, min_severity: 'hint' });
    assert.equal(one['files_checked'], 1);
    assert.deepEqual(
        one['findings'],
        json(expected.filter((f) => f.file === file).map(findingOutput)),
    );
    const folder = await server.output('check', { path: 'common', min_severity: 'hint' });
    assert.deepEqual(
        folder['findings'],
        json(expected.filter((f) => f.file.startsWith('common/')).map(findingOutput)),
    );
    const absolute = await server.output('check', { path: path.join(mod, file) });
    assert.equal(absolute['files_checked'], 1, 'an absolute path inside the mod');
    const none = await server.output('check', { path: 'descriptor.mod' });
    assert.equal(none['files_checked'], 0);
    assert.match(String((none['notes'] as string[])[0]), /nothing was checked/);
});

test('localization/unused-key is on by default; unused_keys: false turns it off', async (t) => {
    const mod = path.join(MODS, 'localization-unused-key-bad');
    const game = path.join(GAMES, 'event-targets-and-localization', 'game');
    const { server } = await setup(t, mod, game);
    const on = await server.output('check', { min_severity: 'hint' });
    const expected = core(mod, game);
    assert.ok(expected.some((f) => f.code === 'localization/unused-key'));
    assert.deepEqual(on['findings'], json(expected.map(findingOutput)));
    const off = await server.output('check', { min_severity: 'hint', unused_keys: false });
    const offCodes = Object.keys((off['totals'] as { by_code: object }).by_code);
    assert.ok(!offCodes.includes('localization/unused-key'), 'turned off');
    assert.deepEqual(off['findings'], json(core(mod, game, false).map(findingOutput)));
});

test('each call reads the mod as it is now: an edit between two calls is seen', async (t) => {
    const mod = modCopy(t, 'names-unknown-trigger-good');
    const { game, server } = await setup(t, mod);
    const before = await server.output('check', { min_severity: 'hint' });
    assert.equal(before['matched'], 0);
    const file = path.join(mod, 'common', 'scripted_triggers', 'fixture_triggers.txt');
    write(file, 'fixture_new_trigger = {\n\tfixture_made_up_trigger = yes\n}\n');
    write(path.join(mod, 'events', 'added_events.txt'), 'namespace = added\n}\n');
    const after = await server.output('check', { min_severity: 'hint', limit: 200 });
    assert.deepEqual(after['findings'], json(core(mod, game).map(findingOutput)));
    assert.ok(
        (after['findings'] as { code: string }[]).some((f) => f.code === 'names/unknown-trigger'),
    );
    assert.ok(
        (after['findings'] as { file: string }[]).some((f) => f.file === 'events/added_events.txt'),
    );
});

test('the game read: its build and that its index came from the cache the second time', async (t) => {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/base_triggers.txt': 'base_trigger = { always = yes }\n',
    });
    const cache = path.join(dir, 'cache');
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const first = await connect(t, ['--mod', mod, '--vanilla', game], cache);
    const built = await first.output('check', {});
    assert.deepEqual(built['game'], { build: '1.21.0.3', from_cache: false });
    const second = await connect(t, ['--mod', mod, '--vanilla', game], cache);
    const loaded = await second.output('check', {});
    assert.deepEqual(loaded['game'], { build: '1.21.0.3', from_cache: true });
    const none = await connect(t, ['--mod', mod, '--no-vanilla'], cache);
    const without = await none.output('check', {});
    assert.equal(without['game'], null);
    assert.match(String((without['notes'] as string[])[0]), /without the base game/);
});

test('a fix too large for a result comes without its edits, marked so', async (t) => {
    const mod = path.join(scratch(t), 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name="Fixture"\n');
    // A scripted effect of 400 lines, each with a Windows-1252 letter in a comment.
    const lines: number[] = [];
    for (let i = 0; i < 400; i++) {
        lines.push(...new TextEncoder().encode(`# line ${String(i)} caf`), 0xe9, 0x0a);
    }
    lines.push(...new TextEncoder().encode('fixture_effect = { add_gold = 1 }\n'));
    write(
        path.join(mod, 'common', 'scripted_effects', 'fixture_effects.txt'),
        new Uint8Array(lines),
    );
    const { game, server } = await setup(t, mod);
    const out = await server.output('check', {
        min_severity: 'warning',
        codes: ['style/not-utf8'],
    });
    const [finding] = out['findings'] as { fix: Record<string, unknown> }[];
    assert.ok(finding !== undefined);
    assert.equal(finding.fix['safety'], 'safe');
    const [alternative] = finding.fix['alternatives'] as {
        edits: unknown[];
        edits_omitted: boolean;
    }[];
    assert.deepEqual(alternative?.edits, []);
    assert.equal(alternative.edits_omitted, true);
    // The core's fix is whole: one edit for each of the 400 lines, and the byte-order mark.
    const whole = core(mod, game).find((f) => f.code === 'style/not-utf8');
    assert.equal(whole?.fix?.alternatives[0]?.edits.length, 401);
});
