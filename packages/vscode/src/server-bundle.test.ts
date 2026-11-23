/**
 * The bundles as the extension ships them (`task vscode:bundle`): the agent server and the
 * command line copied to a storage folder as the extension copies them, the agent server started
 * by the command line both harnesses are given and the command line by the terminal's launcher,
 * with this Node standing in for VS Code's own executable, both asked to check a copy of the
 * editor tests' fixture mod; and the language server's bundle started. Runs on Linux and Windows
 * with no editor.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkThrough } from './editor/agent.js';
import { assertFixtureAnswer, FIXTURE_MOD } from './editor/fixture.js';
import { installServer } from './install.js';
import { CLI_FILE, LSP_FILE, LSP_FOLDER, serverLaunch, SPEC_FOLDER } from './launch.js';
import { writeLauncher } from './terminal.js';
import { runLauncher } from './testing.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const BUNDLED = path.join(PACKAGE, 'dist', 'bundle', 'server');
const LSP = path.join(PACKAGE, 'dist', 'bundle', LSP_FOLDER, LSP_FILE);

test('the bundled server, copied to storage, answers check on a mod in a folder that needs quoting', async (t) => {
    assert.ok(existsSync(BUNDLED), `${BUNDLED} is missing: run task vscode:bundle first`);
    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-vscode-'));
    t.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const storage = path.join(root, 'global storage', 'agent-server');
    assert.equal(installServer(BUNDLED, storage).changed, true);
    const mod = path.join(root, 'mods & more (100%)', 'a mod');
    cpSync(path.join(PACKAGE, '..', '..', 'fixtures', 'mods', FIXTURE_MOD), mod, {
        recursive: true,
    });
    const launch = serverLaunch(process.execPath, storage, mod);
    const home = path.join(root, 'home');
    assertFixtureAnswer(
        await checkThrough({
            ...launch,
            // No real game is looked for or cached: the home and cache folders are the test's.
            env: {
                ...launch.env,
                HOME: home,
                USERPROFILE: home,
                XDG_CACHE_HOME: home,
                LOCALAPPDATA: home,
            },
            cwd: root,
        }),
    );
});

test('the bundled command line, run by the terminal launcher from storage, checks the mod with the spec beside it', (t) => {
    assert.ok(existsSync(BUNDLED), `${BUNDLED} is missing: run task vscode:bundle first`);
    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-vscode-'));
    t.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const storage = path.join(root, 'global storage', 'agent-server');
    installServer(BUNDLED, storage);
    const launcher = writeLauncher(
        path.join(root, 'global storage', 'bin'),
        process.execPath,
        path.join(storage, CLI_FILE),
    ).file;
    const mod = path.join(root, 'mods & more (100%)', 'a mod');
    cpSync(path.join(PACKAGE, '..', '..', 'fixtures', 'mods', FIXTURE_MOD), mod, {
        recursive: true,
    });
    const home = path.join(root, 'home');
    const env = {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: home,
        LOCALAPPDATA: home,
    };
    const version = runLauncher(launcher, ['--version'], root, env);
    assert.equal(version.status, 0, version.stderr);
    assert.match(version.stdout, /^pychivalry \d+\.\d+\.\d+\n$/);
    const run = runLauncher(launcher, ['check', '--json', '--severity', 'error', mod], root, env);
    assert.equal(run.status, 1, `one error: exit code 1\n${run.stderr}`);
    const lines = run.stdout
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    const summary = lines.pop() as { summary: { spec: { version: string } } };
    assert.deepEqual(
        lines.map((f) => [f['code'], f['file']]),
        [['syntax/missing-closing-brace', 'events/fixture_events.txt']],
    );
    // The spec package it read is the one beside it, not the repository's.
    assert.match(summary.summary.spec.version, /^\d+\.\d+/);
    assert.ok(existsSync(path.join(storage, SPEC_FOLDER)));
});

test('the bundled language server starts and reads its own arguments', () => {
    assert.ok(existsSync(LSP), `${LSP} is missing: run task vscode:bundle first`);
    const bad = spawnSync(process.execPath, [LSP, '--no-such-argument'], { encoding: 'utf8' });
    assert.equal(bad.status, 2, bad.stderr);
    assert.match(bad.stderr, /pychivalry-lsp: unknown argument: --no-such-argument/);
    assert.match(bad.stderr, /usage: pychivalry-lsp \(--node-ipc \| --stdio\)/);
    // Over standard input and output with the spec beside the agent server: it waits for an
    // editor, and stops when its input closes.
    const quiet = spawnSync(
        process.execPath,
        [LSP, '--stdio', '--spec', path.join(BUNDLED, SPEC_FOLDER)],
        { encoding: 'utf8', input: '', timeout: 60_000 },
    );
    assert.equal(quiet.error, undefined);
    assert.doesNotMatch(quiet.stderr, /usage|cannot be read/);
});
