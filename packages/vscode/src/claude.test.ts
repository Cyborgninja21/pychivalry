import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
    addArgs,
    claudeEnv,
    cmdArgument,
    cmdInvocation,
    envValue,
    findClaude,
    removeArgs,
    runClaude,
} from './claude.js';
import { serverLaunch } from './launch.js';

function scratch(t: TestContext, name = 'pychivalry-vscode-'): string {
    const dir = mkdtempSync(path.join(tmpdir(), name));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

const files = (...list: string[]): ((file: string) => boolean) => {
    const set = new Set(list);
    return (file) => set.has(file);
};

test('on Linux claude is the first runnable one on the path, else in ~/.local/bin', () => {
    const where = {
        env: { PATH: '/usr/local/bin:relative/bin:/opt/claude/bin:/usr/bin' },
        platform: 'linux' as const,
        home: '/home/u',
    };
    assert.deepEqual(
        findClaude({ ...where, isExecutable: files('/opt/claude/bin/claude', '/usr/bin/claude') }),
        { file: '/opt/claude/bin/claude', viaCmd: false },
    );
    assert.deepEqual(
        findClaude({
            ...where,
            isExecutable: files('relative/bin/claude', '/home/u/.local/bin/claude'),
        }),
        { file: '/home/u/.local/bin/claude', viaCmd: false },
        'a relative folder on the path is not searched',
    );
    assert.equal(findClaude({ ...where, isExecutable: files() }), null);
});

test('on Windows the path and PATHEXT are read in any letter case; a .cmd runs through cmd.exe', () => {
    const where = {
        env: {
            Path: 'C:\\Windows\\system32;"C:\\Users\\A B\\AppData\\Roaming\\npm";;C:\\tools',
            PathExt: '.COM;.EXE;.BAT;.CMD',
        },
        platform: 'win32' as const,
        home: 'C:\\Users\\A B',
    };
    assert.deepEqual(
        findClaude({
            ...where,
            isExecutable: files(
                'C:\\Users\\A B\\AppData\\Roaming\\npm\\claude.cmd',
                'C:\\tools\\claude.exe',
            ),
        }),
        { file: 'C:\\Users\\A B\\AppData\\Roaming\\npm\\claude.cmd', viaCmd: true },
    );
    assert.deepEqual(findClaude({ ...where, isExecutable: files('C:\\tools\\claude.exe') }), {
        file: 'C:\\tools\\claude.exe',
        viaCmd: false,
    });
    assert.deepEqual(
        findClaude({ ...where, isExecutable: files('C:\\Users\\A B\\.local\\bin\\claude.exe') }),
        { file: 'C:\\Users\\A B\\.local\\bin\\claude.exe', viaCmd: false },
        "Claude Code's own installer's place",
    );
    // With no PATHEXT, Windows' own default list.
    assert.deepEqual(
        findClaude({
            env: { PATH: 'C:\\tools' },
            platform: 'win32',
            home: 'C:\\Users\\u',
            isExecutable: files('C:\\tools\\claude.bat'),
        }),
        { file: 'C:\\tools\\claude.bat', viaCmd: true },
    );
    assert.equal(envValue({ pAtH: 'x' }, 'PATH', 'win32'), 'x');
    assert.equal(envValue({ pAtH: 'x' }, 'PATH', 'linux'), undefined);
});

test('the add arguments: options first, an option after --env, the command line after --', () => {
    const launch = serverLaunch('/usr/share/code/code', '/s', '/m', path.posix);
    assert.deepEqual(addArgs(launch), [
        'mcp',
        'add',
        '--scope',
        'local',
        '--env',
        'ELECTRON_RUN_AS_NODE=1',
        '--transport',
        'stdio',
        'pychivalry',
        '--',
        '/usr/share/code/code',
        '/s/pychivalry-mcp.mjs',
        '--mod',
        '/m',
        '--spec',
        '/s/spec',
    ]);
    assert.deepEqual(removeArgs(), ['mcp', 'remove', '--scope', 'local', 'pychivalry']);
});

test("claude runs without the starting VS Code's or Claude Code session's variables", () => {
    assert.deepEqual(
        claudeEnv({
            PATH: '/bin',
            HOME: '/h',
            VSCODE_PID: '1',
            vscode_ipc_hook: 'x',
            ELECTRON_RUN_AS_NODE: '1',
            CLAUDECODE: '1',
            GONE: undefined,
        }),
        { PATH: '/bin', HOME: '/h' },
    );
});

test('cmd.exe quoting: each argument quoted for the program, every special character escaped twice', () => {
    assert.equal(cmdArgument('plain'), '^^^"plain^^^"');
    assert.equal(cmdArgument('a b'), '^^^"a^^^ b^^^"');
    assert.equal(cmdArgument(''), '^^^"^^^"');
    // A quote inside: backslash-escaped for the program, then the quote escaped for cmd.exe.
    assert.equal(cmdArgument('say "hi"'), '^^^"say^^^ \\^^^"hi\\^^^"^^^"');
    // Backslashes before a quote and at the end are doubled; others are kept.
    assert.equal(cmdArgument('C:\\a\\'), '^^^"C:\\a\\\\^^^"');
    assert.equal(cmdArgument('x\\"y'), '^^^"x\\\\\\^^^"y^^^"');
    assert.equal(cmdArgument('%PATH%&|<>!^'), '^^^"^^^%PATH^^^%^^^&^^^|^^^<^^^>^^^!^^^^^^^"');
    assert.throws(() => cmdArgument('two\nlines'), /line break/);
    assert.deepEqual(
        cmdInvocation(
            'C:\\Program Files (x86)\\npm\\claude.cmd',
            ['mcp'],
            'C:\\Windows\\system32\\cmd.exe',
        ),
        {
            command: 'C:\\Windows\\system32\\cmd.exe',
            args: ['/d', '/s', '/c', '"C:\\Program^ Files^ ^(x86^)\\npm\\claude.cmd ^^^"mcp^^^""'],
        },
    );
});

/** Arguments that break naive quoting on one system or the other. */
const HARD_ARGS = [
    'plain',
    'with space',
    '',
    'quote"inside',
    'trailing\\',
    'back\\slash\\"quote',
    '&|<>^%PATH%!PATH!',
    '(paren) [bracket] {brace}',
    'semi;colon,comma=equals',
    'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
    'D:\\Mods & More (100%)\\my mod',
    'unicode é ü ✓',
];

/** A path written into a batch file, where `%` must be doubled to stay a `%`. */
const inBatch = (p: string): string => p.replace(/%/g, '%%');

/** A stand-in `claude` that prints its arguments as JSON. */
function echoClaude(dir: string): { readonly file: string; readonly viaCmd: boolean } {
    const script = path.join(dir, 'echo-args.cjs');
    writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
    if (process.platform === 'win32') {
        // As an npm install's claude.cmd does: the arguments handed on with %*.
        const file = path.join(dir, 'claude.cmd');
        writeFileSync(
            file,
            `@echo off\r\n"${inBatch(process.execPath)}" "${inBatch(script)}" %*\r\n`,
        );
        return { file, viaCmd: true };
    }
    const file = path.join(dir, 'claude');
    writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, {
        mode: 0o755,
    });
    return { file, viaCmd: false };
}

test('every argument reaches claude whole, from a folder whose name needs quoting', async (t) => {
    // On Windows this runs through cmd.exe and a claude.cmd for real; elsewhere directly.
    const dir = path.join(scratch(t), 'claude & co (100%)');
    mkdirSync(dir, { recursive: true });
    const claude = echoClaude(dir);
    const run = await runClaude(claude, HARD_ARGS, dir, process.env);
    assert.equal(run.code, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), HARD_ARGS);
});

test('a claude that fails gives its exit code and output; one that cannot start says why', async (t) => {
    const dir = scratch(t);
    const script = path.join(dir, 'fail.cjs');
    writeFileSync(
        script,
        "process.stderr.write('MCP server pychivalry already exists'); process.exit(1);\n",
    );
    const file = path.join(dir, process.platform === 'win32' ? 'claude.cmd' : 'claude');
    writeFileSync(
        file,
        process.platform === 'win32'
            ? `@echo off\r\n"${inBatch(process.execPath)}" "${inBatch(script)}" %*\r\n`
            : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
        { mode: 0o755 },
    );
    const failed = await runClaude(
        { file, viaCmd: process.platform === 'win32' },
        ['mcp'],
        dir,
        process.env,
    );
    assert.equal(failed.code, 1);
    assert.match(failed.stderr, /already exists/);
    const missing = await runClaude(
        { file: path.join(dir, 'none'), viaCmd: false },
        [],
        dir,
        process.env,
    );
    assert.equal(missing.code, null);
    assert.match(missing.error ?? '', /ENOENT/);
});
