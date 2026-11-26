/**
 * The same answers on the terminal and to an agent for GUI files (docs/MVP.md, "Same answers on
 * every surface"; docs/PLAN.md item 10.4), over the mod `fixtures/mods/gui-index` and its game
 * stub `fixtures/game/gui-index`:
 *
 * - **Go to definition.** For every place of the fixture's `expected.json` (`go_to`), the agent
 *   server's `find_definition` at that place and the command line's `lookup --json` of the name
 *   written there give the same definitions, by database, each at the same place, and the name is
 *   the one the core's own test expects.
 * - **References.** The agent server's `find_references` and the command line's `lookup --json`
 *   count and list the same uses of a GUI type, in any letter case in a GUI file.
 * - **Findings.** On a GUI fixture with a defect, the command line's `check --json` and the agent
 *   server's `check` give the same GUI findings.
 *
 * The language server's side is `packages/lsp/src/gui.test.ts`, and the editor's the editor
 * tests' same-answers case (`editor/same.ts`). The command line runs in this process; the agent
 * server is the built one, over standard input and output. No VS Code, no game files.
 */

import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { defaultSpecDir, run, type Io } from '@pychivalry/cli';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const SERVER = path.join(REPO, 'packages', 'mcp', 'dist', 'main.js');
const GAME = path.join(REPO, 'fixtures', 'game', 'gui-index', 'game');
const MOD = path.join(REPO, 'fixtures', 'mods', 'gui-index');
const BAD = path.join(REPO, 'fixtures', 'mods', 'gui-missing-equals-bad');

type Out = Record<string, unknown>;

interface Expected {
    readonly go_to: readonly {
        readonly file: string;
        readonly line: number;
        readonly column: number;
        readonly name: string;
    }[];
    readonly references: readonly { readonly name: string }[];
}

const expected = JSON.parse(readFileSync(path.join(MOD, 'expected.json'), 'utf8')) as Expected;

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-gui-same-'));
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

/** The built agent server on `argv`, its cache folder `cache`, and a client; closed at the end. */
async function agent(
    t: TestContext,
    argv: readonly string[],
    cache: string,
): Promise<(name: string, args: Out) => Promise<Out>> {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER, ...argv],
        env: { ...getDefaultEnvironment(), XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'pychivalry-gui-same-answers', version: '0.0.0' });
    await client.connect(transport);
    t.after(async () => {
        await client.close();
    });
    return async (name, args) => {
        const result = (await client.callTool({ name, arguments: args }, { timeout: 600_000 })) as {
            content: { text?: string }[];
            structuredContent?: Out;
            isError?: boolean;
        };
        assert.notEqual(result.isError, true, result.content.map((c) => c.text ?? '').join('\n'));
        return result.structuredContent ?? {};
    };
}

/** A definition group as each surface writes it, as `<database> <layer> <file>:<line>` lines. */
function fromAgent(groups: unknown): string[] {
    return (
        groups as {
            database: string;
            definitions: { layer: string; file: string; line: number }[];
        }[]
    )
        .flatMap((g) =>
            g.definitions.map((d) => `${g.database} ${d.layer} ${d.file}:${String(d.line)}`),
        )
        .sort();
}

function fromCli(groups: unknown): string[] {
    return (
        groups as {
            database: string;
            definitions: { layer: string; file: string; range: { start: { line: number } } }[];
        }[]
    )
        .flatMap((g) =>
            g.definitions.map(
                (d) => `${g.database} ${d.layer} ${d.file}:${String(d.range.start.line + 1)}`,
            ),
        )
        .sort();
}

test('go to definition and references on GUI names: the same on the terminal and to an agent', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const call = await agent(t, ['--mod', MOD, '--vanilla', GAME], cache);
    for (const place of expected.go_to) {
        const answer = await call('find_definition', {
            file: place.file,
            line: place.line,
            column: place.column,
        });
        assert.equal(answer['name'], place.name, `${place.file}:${String(place.line)}`);
        const looked = cli(
            ['lookup', place.name, '--vanilla', GAME, '--mod', MOD, '--json'],
            cache,
        );
        assert.equal(looked.code, 0, looked.err);
        const printed = JSON.parse(looked.out) as { definitions: { groups: unknown } };
        const agentSays = fromAgent(answer['definitions']);
        assert.ok(agentSays.length > 0, place.name);
        assert.deepEqual(agentSays, fromCli(printed.definitions.groups), place.name);
    }
    for (const { name } of expected.references) {
        const answer = await call('find_references', { name });
        const looked = cli(['lookup', name, '--vanilla', GAME, '--mod', MOD, '--json'], cache);
        const uses = (
            JSON.parse(looked.out) as {
                uses: {
                    count: number;
                    first: { layer: string; file: string; range: { start: { line: number } } }[];
                };
            }
        ).uses;
        assert.equal(answer['count'], uses.count, name);
        const agentUses = (answer['references'] as { layer: string; file: string; line: number }[])
            .map((u) => `${u.layer} ${u.file}:${String(u.line)}`)
            .sort();
        const cliUses = uses.first
            .map((u) => `${u.layer} ${u.file}:${String(u.range.start.line + 1)}`)
            .sort();
        assert.deepEqual(agentUses, cliUses, name);
    }
});

test("a GUI file's findings: the same on the terminal and to an agent", async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const call = await agent(t, ['--mod', BAD, '--no-vanilla'], cache);
    const answer = await call('check', { min_severity: 'hint' });
    const checked = cli(['check', BAD, '--no-vanilla', '--json'], cache);
    // One finding a line (2.3.0's JSON lines), then the summary.
    const printed = checked.out
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.startsWith('{"summary"'))
        .map(
            (line) =>
                JSON.parse(line) as {
                    file: string;
                    code: string;
                    range: { start: { line: number; character: number } };
                    message: string;
                },
        );
    const agentSays = (
        answer['findings'] as {
            file: string;
            code: string;
            line: number;
            column: number;
            message: string;
        }[]
    )
        .map((f) => `${f.code} ${f.file}:${String(f.line)}:${String(f.column)} ${f.message}`)
        .sort();
    const cliSays = printed
        .map(
            (f) =>
                `${f.code} ${f.file}:${String(f.range.start.line + 1)}:${String(f.range.start.character + 1)} ${f.message}`,
        )
        .sort();
    assert.deepEqual(agentSays, cliSays);
    assert.ok(
        agentSays.some((s) => s.startsWith('syntax/gui-missing-equals gui/fixture_window.gui:4:8')),
        agentSays.join('\n'),
    );
});
