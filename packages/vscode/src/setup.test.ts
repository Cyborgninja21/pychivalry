import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { addArgs, removeArgs, type ClaudeCommand, type RunResult } from './claude.js';
import { serverLaunch } from './launch.js';
import { PROJECT_FILE, serverEntry, setUpClaudeCode, withServer, type SetupDeps } from './setup.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-vscode-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

const launch = serverLaunch('/usr/share/code/code', '/storage/agent-server', '/mods/m', path.posix);
const claude: ClaudeCommand = { file: '/usr/bin/claude', viaCmd: false };

interface Fakes {
    readonly deps: SetupDeps;
    readonly runs: { args: readonly string[]; cwd: string }[];
    readonly asked: string[];
}

function fakes(
    folder: string,
    options: { claude: ClaudeCommand | null; answer?: boolean; add?: RunResult },
): Fakes {
    const runs: { args: readonly string[]; cwd: string }[] = [];
    const asked: string[] = [];
    return {
        runs,
        asked,
        deps: {
            folder,
            launch,
            findClaude: () => options.claude,
            runClaude: (_c, args, cwd) => {
                runs.push({ args, cwd });
                const removing = args[1] === 'remove';
                return Promise.resolve(
                    removing
                        ? { code: 1, stdout: '', stderr: 'No MCP server found' }
                        : (options.add ?? {
                              code: 0,
                              stdout: 'Added stdio MCP server pychivalry\n',
                              stderr: '',
                          }),
                );
            },
            ui: {
                confirmProjectFile: (f) => {
                    asked.push(f);
                    return Promise.resolve(options.answer ?? false);
                },
            },
        },
    };
}

test("with Claude Code's command: an earlier entry removed, the server added for the folder, nothing asked", async (t) => {
    const folder = scratch(t);
    const f = fakes(folder, { claude });
    assert.deepEqual(await setUpClaudeCode(f.deps), {
        kind: 'claude',
        claude: '/usr/bin/claude',
        folder,
        output: 'Added stdio MCP server pychivalry',
    });
    assert.deepEqual(f.runs, [
        { args: removeArgs(), cwd: folder },
        { args: addArgs(launch), cwd: folder },
    ]);
    assert.deepEqual(f.asked, []);
    assert.ok(!existsSync(path.join(folder, PROJECT_FILE)));
});

test("Claude Code's refusal is reported with its own words", async (t) => {
    const f = fakes(scratch(t), {
        claude,
        add: { code: 1, stdout: '', stderr: 'error: unknown option' },
    });
    const outcome = await setUpClaudeCode(f.deps);
    assert.ok(outcome.kind === 'failed');
    assert.match(
        outcome.message,
        /\/usr\/bin\/claude could not add the server: error: unknown option/,
    );
});

test('without the command: asked first; a no writes nothing', async (t) => {
    const folder = scratch(t);
    const f = fakes(folder, { claude: null, answer: false });
    assert.deepEqual(await setUpClaudeCode(f.deps), { kind: 'declined', folder });
    assert.deepEqual(f.asked, [folder]);
    assert.deepEqual(f.runs, []);
    assert.ok(!existsSync(path.join(folder, PROJECT_FILE)));
});

test('without the command: a yes writes .mcp.json, keeping what was there', async (t) => {
    const folder = scratch(t);
    const file = path.join(folder, PROJECT_FILE);
    writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: 'x' } }, note: 1 }));
    const f = fakes(folder, { claude: null, answer: true });
    assert.deepEqual(await setUpClaudeCode(f.deps), { kind: 'project-file', file });
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), {
        mcpServers: { other: { command: 'x' }, pychivalry: serverEntry(launch) },
        note: 1,
    });
});

test('a .mcp.json that is not JSON is left as it is and the reason given', async (t) => {
    const folder = scratch(t);
    const file = path.join(folder, PROJECT_FILE);
    writeFileSync(file, '{ "mcpServers": ');
    const outcome = await setUpClaudeCode(fakes(folder, { claude: null, answer: true }).deps);
    assert.ok(outcome.kind === 'failed');
    assert.match(outcome.message, /not valid JSON/);
    assert.equal(readFileSync(file, 'utf8'), '{ "mcpServers": ');
});

test('the entry is the one Claude Code writes itself: type, command, arguments, variables', () => {
    assert.deepEqual(serverEntry(launch), {
        type: 'stdio',
        command: '/usr/share/code/code',
        args: [
            '/storage/agent-server/pychivalry-mcp.mjs',
            '--mod',
            '/mods/m',
            '--spec',
            '/storage/agent-server/spec',
        ],
        env: { ELECTRON_RUN_AS_NODE: '1' },
    });
    assert.equal(
        withServer(null, launch),
        `${JSON.stringify({ mcpServers: { pychivalry: serverEntry(launch) } }, null, 2)}\n`,
    );
    assert.equal(withServer('  ', launch), withServer(null, launch));
    // An earlier pychivalry entry is replaced.
    assert.deepEqual(
        JSON.parse(
            withServer(JSON.stringify({ mcpServers: { pychivalry: { command: 'old' } } }), launch),
        ),
        { mcpServers: { pychivalry: serverEntry(launch) } },
    );
    assert.throws(() => withServer('[]', launch), /does not hold a JSON object/);
    assert.throws(() => withServer('{"mcpServers": []}', launch), /mcpServers is not an object/);
});
