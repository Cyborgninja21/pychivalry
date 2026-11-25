/**
 * The same answers on the terminal and to an agent (docs/MVP.md, "Same answers on every
 * surface"), for what the owner's decisions of 2026-11-25 added to both:
 *
 * - **`source`.** The command line's `pychivalry source --json` and the agent server's `source`
 *   tool, over the planted-defect mod and its game stub, give the same lines for the same place,
 *   for every file pychivalry reads there (its file not valid UTF-8 and its localization among
 *   them), with and without a place of several lines and its context; and refuse the same places
 *   with the same words, each surface naming the argument its own way.
 * - **`lookup`'s evidence.** The agent server's `lookup` with `evidence` gives, for one name, the
 *   readings the command line's `lookup --json` prints for it, each whole, every place in them
 *   written as the agent server writes every place; as many as fit, the rest counted.
 *
 * The command line runs in this process; the agent server is the built one, spoken to over
 * standard input and output by the MCP library's own client. No VS Code, no game files.
 */

import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { defaultSpecDir, run, type Io } from '@pychivalry/cli';
import { openSources, openSpec } from '@pychivalry/core';
import { withPlaces } from '@pychivalry/mcp';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const SERVER = path.join(REPO, 'packages', 'mcp', 'dist', 'main.js');
const PLANTED_GAME = path.join(REPO, 'fixtures', 'game', 'planted-defects', 'game');
const PLANTED_MOD = path.join(REPO, 'fixtures', 'defects', 'mod');
const LOOKUP_GAME = path.join(REPO, 'fixtures', 'game', 'lookup', 'game');
const LOOKUP_MOD = path.join(REPO, 'fixtures', 'mods', 'lookup-definitions-and-uses');

type Out = Record<string, unknown>;

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-same-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** The command line in this process, its cache folder the test's own, the game never searched for. */
function cli(argv: readonly string[], cache: string): { code: number; out: string; err: string } {
    let out = '';
    let err = '';
    const io: Io = {
        stdout: (text) => {
            out += text;
        },
        stderr: (text) => {
            err += text;
        },
        cwd: REPO,
        env: { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        platform: process.platform,
        home: cache,
        specDir: defaultSpecDir(),
        findGame: () => null,
    };
    const code = run(argv, io);
    return { code, out, err };
}

interface Agent {
    readonly call: (
        name: string,
        args: Out,
    ) => Promise<{ readonly error: string | null; readonly output: Out | null }>;
}

/** The built agent server on `argv`, its cache folder `cache`, and a client; closed at the end. */
async function agent(t: TestContext, argv: readonly string[], cache: string): Promise<Agent> {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER, ...argv],
        env: { ...getDefaultEnvironment(), XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'pychivalry-same-answers', version: '0.0.0' });
    await client.connect(transport);
    t.after(async () => {
        await client.close();
    });
    return {
        call: async (name, args) => {
            const result = (await client.callTool(
                { name, arguments: args },
                { timeout: 600_000 },
            )) as {
                content: { text?: string }[];
                structuredContent?: Out;
                isError?: boolean;
            };
            return result.isError === true
                ? { error: result.content.map((c) => c.text ?? '').join('\n'), output: null }
                : { error: null, output: result.structuredContent ?? null };
        },
    };
}

/** How the command line names an argument the agent server names `argument`. */
const CLI_ARGUMENT: Readonly<Record<string, string>> = {
    layer: '<layer>',
    file: '<file>',
    line: '<line>',
    end_line: '--end-line',
    context: '--context',
};

/** A place as each surface takes it. */
interface Place {
    readonly layer: string;
    readonly file: string;
    readonly line: number;
    readonly end_line?: number;
    readonly context?: number;
}

function cliArgs(place: Place): string[] {
    return [
        'source',
        place.layer,
        place.file,
        String(place.line),
        ...(place.end_line === undefined ? [] : ['--end-line', String(place.end_line)]),
        ...(place.context === undefined ? [] : ['--context', String(place.context)]),
    ];
}

/** What a surface answered for a place: its lines, or its refusal, the argument named apart. */
type Answer =
    | {
          readonly lines: unknown;
          readonly from: unknown;
          readonly to: unknown;
          readonly count: unknown;
          readonly cut: unknown;
          readonly encoding: unknown;
          readonly notes: unknown;
      }
    | { readonly argument: string; readonly refused: string };

function fromCli(r: { code: number; out: string; err: string }): Answer {
    if (r.code === 0) {
        const o = JSON.parse(r.out) as Out;
        return {
            lines: o['lines'],
            from: o['line'],
            to: o['end_line'],
            count: o['line_count'],
            cut: o['cut_lines'],
            encoding: o['encoding'],
            notes: o['notes'],
        };
    }
    const m = /^pychivalry source: (\S+): (.*)$/m.exec(r.err);
    assert.ok(m !== null, r.err);
    const named = Object.entries(CLI_ARGUMENT).find(([, v]) => v === m[1]);
    return { argument: named?.[0] ?? m[1] ?? '', refused: m[2] ?? '' };
}

function fromAgent(r: { error: string | null; output: Out | null }): Answer {
    if (r.output !== null) {
        const shown = r.output['shown'] as Out;
        return {
            lines: r.output['lines'],
            from: shown['line'],
            to: shown['end_line'],
            count: r.output['line_count'],
            cut: r.output['cut_lines'],
            encoding: r.output['encoding'],
            // The session's own notes (no game found, a game of another build) come first; the
            // stub is of the spec's build, so there are none.
            notes: r.output['notes'],
        };
    }
    const m = /^([a-z_]+): (.*)$/s.exec(r.error ?? '');
    assert.ok(m !== null, r.error ?? '');
    return { argument: m[1] ?? '', refused: m[2] ?? '' };
}

test('source: the same lines for the same place, and the same refusals, on the terminal and to an agent', async (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const server = await agent(t, ['--mod', PLANTED_MOD, '--vanilla', PLANTED_GAME], cache);
    const spec = openSpec(defaultSpecDir());
    const set = openSources({ spec, gameDir: PLANTED_GAME, modDir: PLANTED_MOD });
    const places: Place[] = [];
    for (const listing of set.listings) {
        for (const file of listing.files) {
            for (const line of [1, 4, 12, 40]) {
                places.push({ layer: file.layer, file: file.path, line });
                places.push({
                    layer: file.layer,
                    file: file.path,
                    line,
                    end_line: line + 3,
                    context: 0,
                });
                places.push({ layer: file.layer, file: file.path, line, end_line: line + 60 });
            }
        }
    }
    const effects = 'common/scripted_effects/00_feast_effects.txt';
    const refusals: Place[] = [
        { layer: 'game', file: '/etc/hostname', line: 1 },
        { layer: 'game', file: 'C:/Windows/win.ini', line: 1 },
        { layer: 'game', file: '../secret.txt', line: 1 },
        { layer: 'mod', file: 'events\\harvest_events.txt', line: 1 },
        { layer: 'game', file: 'common/scripted_effects/00_FEAST_effects.txt', line: 1 },
        { layer: 'mod', file: 'descriptor.mod', line: 1 },
        { layer: 'jomini', file: effects, line: 1 },
        { layer: 'game', file: effects, line: 999 },
        { layer: 'game', file: effects, line: 4, end_line: 2 },
    ];
    let shown = 0;
    let notUtf8 = 0;
    let refused = 0;
    for (const place of [...places, ...refusals]) {
        const fromTerminal = fromCli(
            cli(
                [...cliArgs(place), '--vanilla', PLANTED_GAME, '--mod', PLANTED_MOD, '--json'],
                cache,
            ),
        );
        const fromServer = fromAgent(await server.call('source', { ...place }));
        assert.deepEqual(fromTerminal, fromServer, JSON.stringify(place));
        if ('lines' in fromTerminal) {
            shown++;
            notUtf8 += fromTerminal.encoding === 'utf-8' ? 0 : 1;
        } else {
            refused++;
        }
    }
    // Line 40 is past the end of the shorter files: refused alike on both.
    assert.ok(shown > places.length / 2, `${String(shown)} of ${String(places.length)} shown`);
    assert.ok(notUtf8 > 0, 'the planted file not valid UTF-8 among them');
    assert.ok(refused >= refusals.length, 'every refusal refused on both');
    // Without the base game: the same refusal of a game place.
    const alone = await agent(t, ['--mod', PLANTED_MOD, '--no-vanilla'], path.join(dir, 'cache2'));
    const place: Place = { layer: 'game', file: effects, line: 1 };
    assert.deepEqual(
        fromCli(cli([...cliArgs(place), '--no-vanilla', '--mod', PLANTED_MOD, '--json'], cache)),
        fromAgent(await alone.call('source', { ...place })),
    );
});

test("lookup's evidence: one name's readings as lookup --json prints them, on the terminal and to an agent", async (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const cases: { game: string; mod: string; names: string[]; language?: string }[] = [
        {
            game: PLANTED_GAME,
            mod: PLANTED_MOD,
            names: [
                'add_prestige',
                'is_adult',
                'harvest_feast_effect',
                'harvest_famine_trigger',
                'county_opinion',
                'popular_opinion',
                'no_such_name_at_all',
                'effect',
            ],
        },
        {
            game: LOOKUP_GAME,
            mod: LOOKUP_MOD,
            names: ['monthly_prestige', 'fixture_scripted_trigger'],
            language: 'l_english',
        },
    ];
    let whole = 0;
    let counted = 0;
    for (const c of cases) {
        // A copy of the mod: the agent server is given a folder of its own, as a harness gives it.
        const mod = path.join(dir, path.basename(c.mod));
        cpSync(c.mod, mod, { recursive: true });
        const server = await agent(t, ['--mod', mod, '--vanilla', c.game], cache);
        for (const name of c.names) {
            const language = c.language === undefined ? [] : ['--language', c.language];
            const r = cli(
                ['lookup', name, '--vanilla', c.game, '--mod', mod, '--json', ...language],
                cache,
            );
            assert.ok(r.code === 0 || r.code === 1, r.err);
            const printed = JSON.parse(r.out) as Out;
            const answer = await server.call('lookup', {
                names: [name],
                evidence: true,
                ...(c.language === undefined ? {} : { language: c.language }),
            });
            assert.equal(answer.error, null, name);
            const evidence = ((answer.output?.['results'] as Out[])[0] ?? {})['evidence'] as Out;
            const expected = JSON.parse(
                JSON.stringify(withPlaces(printed['readings'])),
            ) as unknown[];
            const given = evidence['readings'] as unknown[];
            assert.deepEqual(evidence['spec'], printed['spec'], name);
            assert.deepEqual(given, expected.slice(0, given.length), name);
            assert.equal(evidence['readings_total'], expected.length, name);
            const left = evidence['left_out'] as Out | null;
            if (left === null) {
                assert.equal(given.length, expected.length, name);
                whole++;
            } else {
                assert.equal(left['readings'], expected.length - given.length, name);
                assert.equal(
                    left['characters'],
                    expected
                        .slice(given.length)
                        .reduce((n: number, x) => n + JSON.stringify(x).length, 0),
                    name,
                );
                counted++;
            }
        }
    }
    assert.ok(whole >= 8, `${String(whole)} names whole`);
    assert.ok(counted >= 1, 'effect, a field of many folders, counted');
});
