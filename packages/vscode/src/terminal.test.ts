/**
 * The command line's launcher on the terminal's path (item 7.7): its text on Linux and Windows,
 * written once, and run for real on this system, as a terminal runs `pychivalry`.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { CLI_COMMAND, launcherFor, writeLauncher } from './terminal.js';
import { runLauncher } from './testing.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-terminal-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

test('on Linux: a shell script runs the command line with VS Code as Node, every argument passed on', () => {
    const launcher = launcherFor(
        "/opt/it's code/code",
        '/home/u/.config/Code/User/globalStorage/cyborgninja21.pychivalry/agent-server/pychivalry-cli.mjs',
        'linux',
    );
    assert.equal(launcher.file, CLI_COMMAND);
    assert.equal(launcher.executable, true);
    assert.equal(
        launcher.text,
        [
            '#!/bin/sh',
            '# pychivalry: its command line, run by VS Code as Node. Written by the pychivalry extension.',
            `ELECTRON_RUN_AS_NODE=1 exec '/opt/it'\\''s code/code' '/home/u/.config/Code/User/globalStorage/cyborgninja21.pychivalry/agent-server/pychivalry-cli.mjs' "$@"`,
            '',
        ].join('\n'),
    );
});

test('on Windows: a pychivalry.cmd, its percent signs doubled, its lines ended as cmd.exe ends them', () => {
    const launcher = launcherFor(
        'C:\\Users\\A B\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
        'C:\\Users\\A B (100%)\\AppData\\Roaming\\Code\\User\\globalStorage\\cyborgninja21.pychivalry\\agent-server\\pychivalry-cli.mjs',
        'win32',
    );
    assert.equal(launcher.file, 'pychivalry.cmd');
    assert.equal(launcher.executable, false);
    assert.deepEqual(launcher.text.split('\r\n'), [
        '@echo off',
        'rem pychivalry: its command line, run by VS Code as Node. Written by the pychivalry extension.',
        'setlocal',
        'set ELECTRON_RUN_AS_NODE=1',
        '"C:\\Users\\A B\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" "C:\\Users\\A B (100%%)\\AppData\\Roaming\\Code\\User\\globalStorage\\cyborgninja21.pychivalry\\agent-server\\pychivalry-cli.mjs" %*',
        'exit /b %ERRORLEVEL%',
        '',
    ]);
});

test('a relative path, or a Windows path holding a quote, is refused', () => {
    assert.throws(() => launcherFor('code', '/s/cli.mjs', 'linux'), /runtime must be an absolute/);
    assert.throws(() => launcherFor('/c', 'cli.mjs', 'linux'), /command line must be an absolute/);
    assert.throws(() => launcherFor('C:\\c.exe', 'C:\\a"b\\cli.mjs', 'win32'), /quote/);
});

test('the launcher is written once, and runs a program with every argument as given', (t) => {
    const dir = scratch(t);
    const program = path.join(dir, 'echo args.mjs');
    writeFileSync(
        program,
        'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), node: process.env.ELECTRON_RUN_AS_NODE }));\nprocess.exitCode = 3;\n',
    );
    const bin = path.join(dir, 'global storage', 'bin');
    const first = writeLauncher(bin, process.execPath, program);
    assert.equal(first.written, true);
    assert.equal(writeLauncher(bin, process.execPath, program).written, false);
    if (process.platform !== 'win32') {
        assert.equal(statSync(first.file).mode & 0o777, 0o755);
    }
    assert.equal(
        readFileSync(first.file, 'utf8'),
        launcherFor(process.execPath, program, process.platform).text,
    );
    const args = ['check', 'a mod & more (100%)', '--code', 'names/*', '"quoted"', ''];
    const run = runLauncher(first.file, args, dir);
    assert.equal(run.status, 3, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), { args, node: '1' });
});
