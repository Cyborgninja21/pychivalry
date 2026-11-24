import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { addArgs, removeArgs, type ClaudeCommand, type RunResult } from './claude.js';
import { serverLaunch } from './launch.js';
import {
    outOfDate,
    PROJECT_FILE,
    readSetUps,
    recordOf,
    removeFromClaudeCode,
    serverEntry,
    setUpClaudeCode,
    withoutServer,
    withoutSetUp,
    withServer,
    withSetUp,
    type RemoveDeps,
    type SetupDeps,
} from './setup.js';
import type { SkillsInstall, SkillsRemoval } from './skills.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-vscode-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

const launch = serverLaunch('/usr/share/code/code', '/storage/agent-server', '/mods/m', path.posix);
const claude: ClaudeCommand = { file: '/usr/bin/claude', viaCmd: false };

/** What the skills step gives in these tests: the skills written into Claude Code's folder. */
const installed: SkillsInstall = {
    dir: '/claude/skills',
    written: ['pychivalry-write-content'],
    unchanged: [],
    removed: [],
    refused: [],
    record: { dir: '/claude/skills', names: ['pychivalry-write-content'], sha256: ['0'] },
};

interface Fakes {
    readonly deps: SetupDeps;
    readonly runs: { args: readonly string[]; cwd: string }[];
    readonly asked: string[];
    /** How many times the skills were installed. */
    readonly skills: { count: number };
}

function fakes(
    folder: string,
    options: {
        claude: ClaudeCommand | null;
        answer?: boolean;
        add?: RunResult;
        skillsFail?: boolean;
    },
): Fakes {
    const runs: { args: readonly string[]; cwd: string }[] = [];
    const asked: string[] = [];
    const skills = { count: 0 };
    return {
        runs,
        asked,
        skills,
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
            installSkills: () => {
                skills.count++;
                return options.skillsFail === true
                    ? Promise.reject(new Error('EACCES: permission denied'))
                    : Promise.resolve(installed);
            },
        },
    };
}

test("with Claude Code's command: an earlier entry removed, the server added for the folder, the skills installed, nothing asked", async (t) => {
    const folder = scratch(t);
    const f = fakes(folder, { claude });
    assert.deepEqual(await setUpClaudeCode(f.deps), {
        kind: 'claude',
        claude: '/usr/bin/claude',
        folder,
        output: 'Added stdio MCP server pychivalry',
        skills: { kind: 'installed', install: installed },
    });
    assert.equal(f.skills.count, 1);
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
    assert.equal(f.skills.count, 0, 'no skills without the server');
});

test('skills that cannot be written leave the server set up and say why', async (t) => {
    const f = fakes(scratch(t), { claude, skillsFail: true });
    const outcome = await setUpClaudeCode(f.deps);
    assert.ok(outcome.kind === 'claude');
    assert.deepEqual(outcome.skills, {
        kind: 'failed',
        message: 'the skills could not be installed: EACCES: permission denied',
    });
});

test('without the command: asked first; a no writes nothing', async (t) => {
    const folder = scratch(t);
    const f = fakes(folder, { claude: null, answer: false });
    assert.deepEqual(await setUpClaudeCode(f.deps), { kind: 'declined', folder });
    assert.deepEqual(f.asked, [folder]);
    assert.deepEqual(f.runs, []);
    assert.equal(f.skills.count, 0, 'a no installs no skills');
    assert.ok(!existsSync(path.join(folder, PROJECT_FILE)));
});

test('without the command: a yes writes .mcp.json, keeping what was there', async (t) => {
    const folder = scratch(t);
    const file = path.join(folder, PROJECT_FILE);
    writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: 'x' } }, note: 1 }));
    const f = fakes(folder, { claude: null, answer: true });
    assert.deepEqual(await setUpClaudeCode(f.deps), {
        kind: 'project-file',
        file,
        skills: { kind: 'installed', install: installed },
    });
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

test('a set-up is remembered with the command line it gave, and found out of date when that changes', () => {
    const before = serverLaunch(
        '/usr/share/code/code',
        '/storage/agent-server',
        '/mods/m',
        path.posix,
    );
    const after = serverLaunch(
        '/usr/share/code/code',
        '/storage/agent-server',
        '/mods/m',
        path.posix,
        '/games/Crusader Kings III/game',
    );
    assert.deepEqual(after.args.slice(-2), ['--vanilla', '/games/Crusader Kings III/game']);
    const skills = { kind: 'installed', install: installed } as const;
    const done = recordOf(
        { kind: 'claude', claude: '/usr/bin/claude', folder: '/mods/m', output: '', skills },
        '/mods/m',
        before,
    );
    assert.ok(done !== null);
    assert.equal(recordOf({ kind: 'declined', folder: '/mods/m' }, '/mods/m', before), null);
    assert.equal(recordOf({ kind: 'failed', message: 'x' }, '/mods/m', before), null);
    const other = { folder: '/mods/other', kind: 'project-file' as const, launch: before };
    // Kept as JSON in the global state, and read back; anything else is dropped.
    const records = readSetUps(
        JSON.parse(JSON.stringify([...withSetUp([other], done), 'junk', { folder: 1 }])),
    );
    assert.deepEqual(records, [other, done]);
    assert.deepEqual(readSetUps(undefined), []);
    // The same command line: nothing to do. A changed one: the folder's set-up is out of date.
    const now = (launch: typeof before) => (folder: string) =>
        folder === '/mods/m' ? launch : null;
    assert.deepEqual(outOfDate(records, now(before)), []);
    assert.deepEqual(outOfDate(records, now(after)), [done]);
    // A second set-up of the folder replaces the first.
    const again = recordOf(
        { kind: 'claude', claude: '/usr/bin/claude', folder: '/mods/m', output: '', skills },
        '/mods/m',
        after,
    );
    assert.ok(again !== null);
    assert.deepEqual(outOfDate(withSetUp(records, again), now(after)), []);
    assert.equal(withSetUp(records, again).length, 2);
    // Removed, the folder's set-up is forgotten and the others kept.
    assert.deepEqual(withoutSetUp(records, '/mods/m'), [other]);
});

const removal: SkillsRemoval = {
    dir: '/claude/skills',
    removed: ['pychivalry-write-content'],
    kept: [],
    record: { dir: '/claude/skills', names: [], sha256: ['0'] },
};

function removeDeps(
    folder: string,
    options: { claude: ClaudeCommand | null; remove?: RunResult; skills?: boolean },
): { deps: RemoveDeps; runs: (readonly string[])[] } {
    const runs: (readonly string[])[] = [];
    return {
        runs,
        deps: {
            folder,
            launches: [launch],
            findClaude: () => options.claude,
            runClaude: (_c, args) => {
                runs.push(args);
                return Promise.resolve(
                    options.remove ?? { code: 0, stdout: 'Removed\n', stderr: '' },
                );
            },
            removeSkills: options.skills === false ? null : () => Promise.resolve(removal),
        },
    };
}

test("removed with Claude Code's command: the entry, then the skills when no other folder uses them", async (t) => {
    const folder = scratch(t);
    const r = removeDeps(folder, { claude });
    assert.deepEqual(await removeFromClaudeCode(r.deps), {
        folder,
        claude: { file: '/usr/bin/claude', removed: true, output: 'Removed' },
        projectFile: 'none',
        skills: { kind: 'removed', removal },
    });
    assert.deepEqual(r.runs, [removeArgs()]);
    // Another folder still set up: the skills stay.
    const kept = await removeFromClaudeCode(removeDeps(folder, { claude, skills: false }).deps);
    assert.deepEqual(kept.skills, { kind: 'kept' });
    // No entry to remove: what Claude Code said, and nothing fails.
    const none = await removeFromClaudeCode(
        removeDeps(folder, {
            claude,
            remove: { code: 1, stdout: '', stderr: 'No MCP server found with name: "pychivalry"' },
        }).deps,
    );
    assert.deepEqual(none.claude, {
        file: '/usr/bin/claude',
        removed: false,
        output: 'No MCP server found with name: "pychivalry"',
    });
});

test(".mcp.json: the extension's own entry is taken out, the file too when nothing else is left; another entry is left", async (t) => {
    const folder = scratch(t);
    const file = path.join(folder, PROJECT_FILE);
    writeFileSync(
        file,
        withServer(JSON.stringify({ mcpServers: { other: { command: 'x' } } }), launch),
    );
    const kept = await removeFromClaudeCode(removeDeps(folder, { claude: null }).deps);
    assert.equal(kept.projectFile, 'entry-removed');
    assert.equal(kept.claude, null);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), {
        mcpServers: { other: { command: 'x' } },
    });
    writeFileSync(file, withServer(null, launch));
    assert.equal(
        (await removeFromClaudeCode(removeDeps(folder, { claude: null }).deps)).projectFile,
        'file-removed',
    );
    assert.ok(!existsSync(file));
    // An entry of that name the extension did not write is the person's own.
    const own = JSON.stringify({ mcpServers: { pychivalry: { command: 'node', args: ['dev'] } } });
    writeFileSync(file, own);
    assert.equal(
        (await removeFromClaudeCode(removeDeps(folder, { claude: null }).deps)).projectFile,
        'not-ours',
    );
    assert.equal(readFileSync(file, 'utf8'), own);
    writeFileSync(file, '{ broken');
    const broken = await removeFromClaudeCode(removeDeps(folder, { claude: null }).deps);
    assert.ok(typeof broken.projectFile === 'object');
    assert.equal(readFileSync(file, 'utf8'), '{ broken');
    // The text without the entry, kept apart from the file.
    assert.equal(withoutServer(withServer(null, launch)), null);
    assert.equal(
        withoutServer(withServer('{"note": 1}', launch)),
        `${JSON.stringify({ note: 1, mcpServers: {} }, null, 2)}\n`,
    );
    assert.throws(() => withoutServer('[]'), /does not hold a JSON object/);
});
