/**
 * `analyze_log` (docs/PLAN.md item 11.6, tool schema version 7), over a real round trip, on the
 * hand-made logs of `fixtures/logs/hand-made/` and the planted-defect mod over its game stub:
 * the core's report, every place written as every place is (a game place with `read_with:
 * "source"`); the log read only from the game's log folders, a folder given, or the mod's own;
 * every message answered whole or named in `not_answered`, with no cursor, one too large alone
 * written smaller; the unmatched lines listed as many as fit; bad input naming the argument. The
 * server's home folder is always the test's own, so no real log folder is read.
 */

import assert from 'node:assert/strict';
import { analyzeLog, logShape, openSpec, openWorkspace, type LogTie } from '@pychivalry/core';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './args.js';
import { placeOf } from './places.js';
import { connect, MAX_RESULT_CHARACTERS, REPO_ROOT, resultSize, scratch } from './testing.js';

const spec = openSpec(defaultSpecDir());
const HAND_MADE = path.join(REPO_ROOT, 'fixtures', 'logs', 'hand-made');
const MOD = path.join(REPO_ROOT, 'fixtures', 'defects', 'mod');
const GAME = path.join(REPO_ROOT, 'fixtures', 'game', 'planted-defects', 'game');

/** A server over a copy of the planted mod, its home and log folder the test's own. */
async function server(t: TestContext, logs: Record<string, string | Uint8Array>) {
    const root = scratch(t);
    const mod = path.join(root, 'mod');
    cpSync(MOD, mod, { recursive: true });
    const logDir = path.join(root, 'logs');
    mkdirSync(logDir, { recursive: true });
    for (const [name, text] of Object.entries(logs)) {
        writeFileSync(path.join(logDir, name), text);
    }
    const home = path.join(root, 'home');
    mkdirSync(home, { recursive: true });
    const env = { HOME: home, USERPROFILE: home, XDG_DATA_HOME: path.join(home, 'data') };
    const s = await connect(
        t,
        ['--mod', mod, '--vanilla', GAME, '--logs', logDir],
        path.join(root, 'cache'),
        env,
    );
    return { s, mod, logDir, home, root };
}

interface Occurrence {
    readonly line: number;
    readonly values: string[];
    readonly ties: Record<string, unknown>[];
}

/** A tie as the tool writes it, from the core's. */
function written(t: LogTie): Record<string, unknown> {
    return {
        kind: t.kind,
        ...placeOf(t.layer, t.file, t.range),
        ...(t.kind === 'file' ? { line_from: t.line ?? 'not-known' } : {}),
        ...(t.name === null ? {} : { name: t.name }),
        ...(t.database === null ? {} : { database: t.database }),
        value: t.value + 1,
        from: t.from,
    };
}

test("analyze_log answers every message of the log with the core's places, game places read with source", async (t) => {
    const log = readFileSync(path.join(HAND_MADE, 'planted-defects.log'));
    const { s, mod, logDir } = await server(t, { 'error.log': log });
    const out = await s.output('analyze_log', { log: path.join(logDir, 'error.log') });
    const workspace = openWorkspace({ spec, modDir: mod, gameDir: GAME, cacheDir: null });
    const core = analyzeLog({ spec, index: workspace.index, log });
    assert.deepEqual(out['totals'], { ...core.totals, messages: core.messages.length });
    assert.deepEqual(out['lines'], core.lines);
    assert.equal(out['not_answered'], null);
    const messages = out['messages'] as {
        key: string;
        count: number;
        checks: string[];
        message: string;
        occurrences: Occurrence[];
    }[];
    assert.deepEqual(
        messages.map((m) => m.key),
        core.messages.map((m) => m.key),
    );
    for (const [i, m] of core.messages.entries()) {
        const w = messages[i];
        assert.ok(w !== undefined, m.key);
        assert.equal(w.count, m.count);
        assert.deepEqual(w.checks, m.checks);
        for (const [j, o] of m.occurrences.entries()) {
            const wo: Occurrence | undefined = w.occurrences[j];
            assert.ok(wo !== undefined, m.key);
            assert.equal(wo.line, o.line);
            assert.deepEqual(wo.values, o.values);
            assert.deepEqual(wo.ties, o.ties.map(written), `${m.key} line ${String(o.line)}`);
        }
    }
    const trigger = messages.find((m) => m.key === 'unknown_trigger_X');
    assert.equal(trigger?.message, "Unknown trigger '<value>'");
    const game = messages
        .flatMap((m) => m.occurrences.flatMap((o) => o.ties))
        .filter((x) => x['layer'] === 'game');
    assert.ok(game.length > 0 && game.every((x) => x['read_with'] === 'source'));
    assert.deepEqual(out['unmatched'], { count: 0, lines: [], not_listed: 0 });
});

test('the log is read only from a log folder or the mod; a folder is read for its error.log', async (t) => {
    const { s, mod, logDir, home } = await server(t, {
        'error.log': readFileSync(path.join(HAND_MADE, 'unmatched.log')),
    });
    const folder = await s.output('analyze_log', { log: logDir });
    assert.equal(folder['log'], path.join(logDir, 'error.log'));
    assert.equal((folder['unmatched'] as { count: number }).count, 3);
    // With no log given: the error.log of the first log folder, the one given here.
    const byDefault = await s.output('analyze_log', {});
    assert.equal(byDefault['log'], path.join(logDir, 'error.log'));
    // A log in the mod's own folder.
    writeFileSync(
        path.join(mod, 'test.log'),
        readFileSync(path.join(HAND_MADE, 'planted-defects.log')),
    );
    const inMod = await s.output('analyze_log', { log: 'test.log' });
    assert.equal((inMod['totals'] as { matched: number }).matched, 17);
    // Anything else is refused, naming the folders it reads.
    const outside = path.join(home, 'secret.log');
    writeFileSync(outside, 'x\n');
    const refused = await s.error('analyze_log', { log: outside });
    assert.match(refused, /is outside the folders analyze_log reads; the folders read are /);
    assert.ok(refused.includes(logDir));
    assert.match(
        await s.error('analyze_log', { log: path.join(logDir, 'nothing.log') }),
        /no such file/,
    );
});

test('every message whole or named in not_answered, no cursor; one too large alone is cut, its count whole', async (t) => {
    const lines = readFileSync(path.join(HAND_MADE, 'planted-defects.log'), 'utf8')
        .split('\r\n')
        .slice(0, 16);
    const many = Array.from({ length: 12 }, () => lines.join('\n')).join('\n');
    const big = Array.from({ length: 300 }, () => "Unknown trigger 'is_imprisonned'").join('\n');
    const { s, logDir } = await server(t, { 'many.log': `${many}\n`, 'big.log': `${big}\n` });
    const first = await s.call('analyze_log', { log: path.join(logDir, 'many.log') });
    assert.ok(resultSize(first) <= MAX_RESULT_CHARACTERS);
    const out = first.structuredContent ?? {};
    const answered = (out['messages'] as { key: string; count: number; detail?: string }[]).map(
        (m) => m.key,
    );
    const left = (out['not_answered'] as { messages: string[] } | null)?.messages ?? [];
    assert.ok(answered.length > 0 && left.length > 0);
    assert.equal(answered.length + left.length, 16);
    assert.ok((out['messages'] as { detail?: string }[]).every((m) => m.detail === undefined));
    const next = await s.output('analyze_log', {
        log: path.join(logDir, 'many.log'),
        messages: left,
    });
    const nextKeys = (next['messages'] as { key: string }[]).map((m) => m.key);
    assert.deepEqual(nextKeys, left.slice(0, nextKeys.length));
    assert.ok(nextKeys.length > 0);
    // The totals are of the whole log, whatever was asked.
    assert.deepEqual(next['totals'], out['totals']);

    const cut = await s.output('analyze_log', { log: path.join(logDir, 'big.log') });
    const [only] = cut['messages'] as {
        count: number;
        detail?: string;
        not_listed?: number;
        occurrences: unknown[];
    }[];
    assert.equal(only?.count, 300);
    assert.equal(only.detail, 'cut');
    assert.equal(only.occurrences.length + (only.not_listed ?? 0), 300);
    assert.ok(only.occurrences.length > 0);
});

test('unmatched lines as many as fit, the rest counted; none listed when not asked', async (t) => {
    const lines = Array.from(
        { length: 2_000 },
        (_, i) => `ERROR: line ${String(i)} ${'x'.repeat(40)}`,
    ).join('\n');
    const { s, logDir } = await server(t, { 'error.log': `${lines}\n` });
    const r = await s.call('analyze_log', {});
    assert.ok(resultSize(r) <= MAX_RESULT_CHARACTERS);
    const u = (r.structuredContent ?? {})['unmatched'] as {
        count: number;
        lines: unknown[];
        not_listed: number;
    };
    assert.equal(u.count, 2_000);
    assert.ok(u.lines.length > 0 && u.lines.length < 2_000);
    assert.equal(u.lines.length + u.not_listed, 2_000);
    const none = await s.output('analyze_log', { log: logDir, unmatched: false });
    assert.deepEqual(none['unmatched'], { count: 2_000, lines: [], not_listed: 2_000 });
});

test('line_prefix and location are used as the core uses them; one that cannot be used names its argument', async (t) => {
    const stand = readFileSync(path.join(HAND_MADE, 'planted-defects-stand-in-prefix.log'));
    const { s, mod, logDir } = await server(t, { 'error.log': stand });
    const prefix = '^hand-made line \\d+ \\| ';
    const out = await s.output('analyze_log', { line_prefix: prefix });
    const workspace = openWorkspace({ spec, modDir: mod, gameDir: GAME, cacheDir: null });
    const core = analyzeLog({
        spec,
        index: workspace.index,
        log: stand,
        shape: logShape({ prefix }),
    });
    assert.deepEqual(out['shape'], { prefix, location: null });
    assert.deepEqual(out['totals'], { ...core.totals, messages: core.messages.length });
    assert.match(
        await s.error('analyze_log', { log: logDir, line_prefix: '(' }),
        /^line_prefix: not a regular expression/,
    );
    assert.match(
        await s.error('analyze_log', { location: '(?<path>.+)' }),
        /^location: it must name the group file/,
    );
    assert.match(
        await s.error('analyze_log', { line_prefix: 'x'.repeat(201) }),
        /^line_prefix: longer than 200/,
    );
});
