/**
 * The same answers on the terminal and to an agent (docs/MVP.md, "Same answers on every
 * surface"), for the game's log (docs/PLAN.md item 11.6): the command line's
 * `pychivalry log --json` and the agent server's `analyze_log`, over the hand-made logs of
 * `fixtures/logs/hand-made/` and the planted-defect mod with its game stub, give the same totals,
 * the same messages in the same order, the same lines with the same values, and the same places,
 * each written as the agent server writes every place; with no line prefix and with one given.
 * The editor's log diagnostics are the language server's answer to the same report, which its
 * own test holds (packages/lsp/src/log.test.ts).
 *
 * The command line runs in this process; the agent server is the built one, spoken to over
 * standard input and output by the MCP library's own client. No VS Code, no game files, and the
 * server's home folder is the test's own, so no real log folder is read.
 */

import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { defaultSpecDir, run, type Io } from '@pychivalry/cli';
import { placeOf } from '@pychivalry/mcp';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const SERVER = path.join(REPO, 'packages', 'mcp', 'dist', 'main.js');
const GAME = path.join(REPO, 'fixtures', 'game', 'planted-defects', 'game');
const MOD = path.join(REPO, 'fixtures', 'defects', 'mod');
const HAND_MADE = path.join(REPO, 'fixtures', 'logs', 'hand-made');

type Out = Record<string, unknown>;

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-log-same-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** The command line in this process, its home and cache folder the test's own. */
function cli(argv: readonly string[], home: string): { code: number; out: string; err: string } {
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
        env: { XDG_CACHE_HOME: home, LOCALAPPDATA: home },
        platform: process.platform,
        home,
        specDir: defaultSpecDir(),
        findGame: () => null,
    };
    const code = run(argv, io);
    return { code, out, err };
}

/** The built agent server on `argv`, its home and cache folder `home`; closed at the end. */
async function agent(t: TestContext, argv: readonly string[], home: string): Promise<Client> {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER, ...argv],
        env: {
            ...getDefaultEnvironment(),
            XDG_CACHE_HOME: home,
            LOCALAPPDATA: home,
            HOME: home,
            USERPROFILE: home,
            XDG_DATA_HOME: path.join(home, 'data'),
        },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'pychivalry-log-same-answers', version: '0.0.0' });
    await client.connect(transport);
    t.after(async () => {
        await client.close();
    });
    return client;
}

interface CoreTie {
    readonly kind: string;
    readonly value: number;
    readonly from: string;
    readonly layer: string;
    readonly file: string;
    readonly range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    readonly line: string | null;
    readonly name: string | null;
    readonly database: string | null;
}

interface CoreReport {
    readonly totals: Out;
    readonly lines: Out;
    readonly shape: Out;
    readonly messages: readonly {
        readonly key: string;
        readonly ids: readonly string[];
        readonly checks: readonly string[];
        readonly count: number;
        readonly occurrences: readonly {
            readonly line: number;
            readonly values: readonly string[];
            readonly ties: readonly CoreTie[];
        }[];
    }[];
    readonly unmatched: readonly {
        readonly line: number;
        readonly text: string;
        readonly why: string;
    }[];
}

/** What the command line answered, as the agent server writes it: totals, messages, places. */
function asAgent(report: CoreReport): Out {
    return {
        totals: { ...report.totals, messages: report.messages.length },
        lines: report.lines,
        shape: report.shape,
        messages: report.messages.map((m) => ({
            key: m.key,
            ids: m.ids,
            checks: m.checks,
            count: m.count,
            occurrences: m.occurrences.map((o) => ({
                line: o.line,
                values: o.values,
                ties: o.ties.map((t) => ({
                    kind: t.kind,
                    ...placeOf(t.layer, t.file, t.range),
                    ...(t.kind === 'file' ? { line_from: t.line ?? 'not-known' } : {}),
                    ...(t.name === null ? {} : { name: t.name }),
                    ...(t.database === null ? {} : { database: t.database }),
                    value: t.value + 1,
                    from: t.from,
                })),
            })),
        })),
        unmatched: report.unmatched.map((u) => ({ line: u.line, text: u.text, why: u.why })),
    };
}

/** What the agent server answered, the same parts. */
function fromAgent(out: Out): Out {
    const messages = out['messages'] as {
        key: string;
        ids: string[];
        checks: string[];
        count: number;
        occurrences: { line: number; values: string[]; ties: Out[] }[];
    }[];
    return {
        totals: out['totals'],
        lines: out['lines'],
        shape: out['shape'],
        messages: messages.map((m) => ({
            key: m.key,
            ids: m.ids,
            checks: m.checks,
            count: m.count,
            occurrences: m.occurrences.map((o) => ({
                line: o.line,
                values: o.values,
                ties: o.ties,
            })),
        })),
        unmatched: (out['unmatched'] as { lines: Out[] }).lines,
    };
}

for (const [log, prefix] of [
    ['planted-defects.log', null],
    ['planted-defects-stand-in-prefix.log', null],
    ['planted-defects-stand-in-prefix.log', '^hand-made line \\d+ \\| '],
    ['unmatched.log', null],
] as const) {
    test(`log --json and analyze_log give the same answers: ${log}${prefix === null ? '' : ', a prefix given'}`, async (t) => {
        const root = scratch(t);
        const mod = path.join(root, 'mod');
        cpSync(MOD, mod, { recursive: true });
        const logs = path.join(root, 'logs');
        mkdirSync(logs);
        cpSync(path.join(HAND_MADE, log), path.join(logs, log));
        const home = path.join(root, 'home');
        mkdirSync(home);
        const shape = prefix === null ? [] : ['--prefix', prefix];
        const c = cli(
            ['log', path.join(logs, log), '--mod', mod, '--vanilla', GAME, ...shape, '--json'],
            home,
        );
        assert.ok(c.code === 0 || c.code === 1, c.err);
        const report = JSON.parse(c.out) as CoreReport;
        const client = await agent(t, ['--mod', mod, '--vanilla', GAME, '--logs', logs], home);
        const result = (await client.callTool(
            {
                name: 'analyze_log',
                arguments: {
                    log: path.join(logs, log),
                    ...(prefix === null ? {} : { line_prefix: prefix }),
                },
            },
            { timeout: 600_000 },
        )) as { structuredContent?: Out; isError?: boolean };
        assert.notEqual(result.isError, true);
        const out = result.structuredContent ?? {};
        assert.equal(out['not_answered'], null);
        assert.deepEqual(fromAgent(out), asAgent(report));
    });
}
