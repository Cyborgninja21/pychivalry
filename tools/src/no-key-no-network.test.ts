/**
 * pychivalry holds no API key, no token and no login, and makes no network call and no model
 * call (docs/MVP.md, "AI tests"; docs/decisions.md, decision 80). The AI is always another
 * program that connects to pychivalry. This test makes that true by construction for every
 * shipped package (`packages/core`, `cli`, `mcp`, `lsp`, `vscode`): it reads every source file
 * under `packages/<name>/src` but the tests (`*.test.ts`), test helpers (`testing.ts`) included,
 * comments included, and fails when one
 *
 * 1. names a credential variable or holds a key-shaped string: `API_KEY`, `AUTH_TOKEN`,
 *    `sk-ant`, `Authorization`, `Bearer`, in any letter case;
 * 2. imports a networking module (`node:http`, `node:https`, `node:http2`, `node:net`,
 *    `node:tls`, `node:dgram`, `node:dns`, `node:inspector`, the same without `node:`, or
 *    `undici`), or calls one of the networking functions every JavaScript runtime has
 *    (`fetch(`, `WebSocket`, `XMLHttpRequest`, `EventSource`);
 * 3. imports a module that is neither one of Node's built-ins nor one of pychivalry's own
 *    packages, unless `EXCEPTIONS` lists that module for that file with its reason; Node's
 *    `child_process`, which can start any program, is listed the same way.
 *
 * Rules 1 and 2 have no exceptions. A step that needs another module adds it to `EXCEPTIONS`
 * with its reason, and a networking module is never one.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { repoRoot } from './util.js';

const root = repoRoot();

/** Rule 1: a credential variable's name or a key-shaped string. */
const CREDENTIALS: readonly { readonly what: string; readonly pattern: RegExp }[] = [
    { what: 'API_KEY', pattern: /API_?KEY/i },
    { what: 'AUTH_TOKEN', pattern: /AUTH_?TOKEN/i },
    { what: 'sk-ant', pattern: /sk-ant/i },
    { what: 'Authorization', pattern: /Authorization/i },
    { what: 'Bearer', pattern: /\bBearer\b/i },
];

/** Rule 2: the networking modules, by the name an import gives without `node:`. */
const NETWORK_MODULES: readonly string[] = [
    'http',
    'https',
    'http2',
    'net',
    'tls',
    'dgram',
    'dns',
    'inspector',
    'undici',
];

/** Rule 2: networking written anywhere in the text, an import or not. */
const NETWORK_TEXT: readonly { readonly what: string; readonly pattern: RegExp }[] = [
    { what: 'node:http', pattern: /node:http/ },
    { what: 'node:net', pattern: /node:net\b/ },
    { what: 'node:tls', pattern: /node:tls/ },
    { what: 'node:dgram', pattern: /node:dgram/ },
    { what: 'node:dns', pattern: /node:dns/ },
    { what: 'undici', pattern: /undici/i },
    { what: 'fetch(', pattern: /\bfetch\s*\(/ },
    { what: 'WebSocket', pattern: /\bWebSocket\b/ },
    { what: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
    { what: 'EventSource', pattern: /\bEventSource\b/ },
];

/** Rule 3: each module a shipped file may import that is not plainly allowed, with its reason. */
const EXCEPTIONS: readonly {
    readonly module: string;
    readonly files: readonly string[];
    readonly reason: string;
}[] = [
    {
        module: '@modelcontextprotocol/server',
        files: [
            'packages/mcp/src/result.ts',
            'packages/mcp/src/schema.ts',
            'packages/mcp/src/server.ts',
        ],
        reason: "The MCP library's server: the tool registry, its result type and its check of a tool's input and output shapes. pychivalry serves it only through the standard-input transport below and uses none of the library's HTTP handling.",
    },
    {
        module: '@modelcontextprotocol/server/stdio',
        files: ['packages/mcp/src/main.ts'],
        reason: "The MCP library's standard-input transport (`serveStdio`): the agent server talks only to the program that started it, over its own standard input and output. It opens no port and makes no connection.",
    },
    {
        module: '@modelcontextprotocol/client',
        files: ['packages/mcp/src/testing.ts'],
        reason: "A test helper, not shipped: the tests talk to the agent server through the library's own client (a development dependency).",
    },
    {
        module: '@modelcontextprotocol/client/stdio',
        files: ['packages/mcp/src/testing.ts'],
        reason: "A test helper, not shipped: the client's standard-input transport, which starts the agent server as a local process and talks to it over its standard input and output.",
    },
    {
        module: 'vscode-languageserver/node',
        files: [
            'packages/lsp/src/completion.ts',
            'packages/lsp/src/diagnostics.ts',
            'packages/lsp/src/documents.ts',
            'packages/lsp/src/inlay-hints.ts',
            'packages/lsp/src/main.ts',
            'packages/lsp/src/outline.ts',
            'packages/lsp/src/presentation-features.ts',
            'packages/lsp/src/presentation.ts',
            'packages/lsp/src/presented-completion.ts',
            'packages/lsp/src/server.ts',
            'packages/lsp/src/symbols.ts',
            'packages/lsp/src/testing.ts',
        ],
        reason: "The language-server protocol library's server: the connection, its message types and the IPC transport. pychivalry builds its connection only over IPC with the editor that started it (`--node-ipc`) or over its own standard input and output (`--stdio`); it refuses the library's socket and pipe transports (`args.ts`) and opens no port.",
    },
    {
        module: 'vscode-languageserver-protocol/node',
        files: ['packages/lsp/src/testing.ts'],
        reason: "A test helper, not shipped: the tests' protocol client (a development dependency) speaks to the language server over its standard input and output, or over a pair of streams in the test's own process.",
    },
    {
        module: 'node:child_process',
        files: ['packages/lsp/src/testing.ts'],
        reason: 'A test helper, not shipped: it starts the built language server in a process of its own, as an editor would, over its standard input and output.',
    },
    {
        module: 'node:child_process',
        files: ['packages/core/src/index/find-game.ts'],
        reason: "The game search on Windows asks the registry where Steam is installed by running the system's own `reg query`, a local program, and runs nothing else.",
    },
    {
        module: 'node:child_process',
        files: ['packages/cli/src/testing.ts'],
        reason: 'A test helper, not shipped: it runs the built command line in a process of its own, as a user would.',
    },
    {
        module: 'vscode',
        files: [
            'packages/vscode/src/extension.ts',
            'packages/vscode/src/language.ts',
            'packages/vscode/src/editor/corpus.ts',
            'packages/vscode/src/editor/main.ts',
            'packages/vscode/src/editor/same.ts',
            'packages/vscode/src/editor/smoke.ts',
            'packages/vscode/src/editor/update.ts',
        ],
        reason: "VS Code's own extension API, which the editor gives the extension when it loads it; the bundle leaves it out. The editor tests (not shipped) run inside that editor.",
    },
    {
        module: 'vscode-languageclient/node',
        files: ['packages/vscode/src/language.ts'],
        reason: "The language-server protocol library's client, the companion of `vscode-languageserver`: it starts pychivalry's own language server as a Node module over IPC (`TransportKind.ipc`), a child process of the editor, and talks to it over that channel only. The extension gives it no socket or pipe transport and it opens no port.",
    },
    {
        module: 'node:child_process',
        files: ['packages/vscode/src/testing.ts'],
        reason: "A test helper, not shipped: it runs the command line's launcher as a terminal runs it, a local program; on Windows through the system's `cmd.exe`.",
    },
    {
        module: 'node:child_process',
        files: ['packages/vscode/src/package.ts'],
        reason: 'The packaging script, not shipped: it runs the pinned `vsce` (a development dependency) to write the `.vsix` file locally. Packaging needs no publishing token, none is given, and nothing is published.',
    },
    {
        module: 'node:child_process',
        files: ['packages/vscode/src/claude.ts'],
        reason: '"Set up for Claude Code" runs the `claude` command the user installed, `claude mcp remove` and `claude mcp add`, a local program that writes its own configuration; on Windows a `claude.cmd` through the system\'s `cmd.exe`. It runs nothing else.',
    },
    {
        module: 'esbuild',
        files: ['packages/vscode/src/bundle.ts'],
        reason: "The build script, not shipped: esbuild writes the extension's bundles (a development dependency, never inside them).",
    },
    {
        module: '@vscode/test-electron',
        files: ['packages/vscode/src/editor/run.ts'],
        reason: "The editor tests' runner, not shipped and never in task ci: it downloads the pinned VS Code the tests run in (task vscode:test) and starts it; a development dependency, never in a bundle the extension ships.",
    },
    {
        module: '@modelcontextprotocol/client',
        files: ['packages/vscode/src/editor/agent.ts'],
        reason: "A test helper, not shipped: the extension's tests talk to the agent server through the MCP library's own client.",
    },
    {
        module: '@modelcontextprotocol/client/stdio',
        files: ['packages/vscode/src/editor/agent.ts'],
        reason: "A test helper, not shipped: the client's standard-input transport, which starts the agent server from a harness's entry and talks to it over its standard input and output.",
    },
];

/** The shipped packages: every folder of `packages/` with a `src` folder. */
function shippedPackages(): string[] {
    const dir = path.join(root, 'packages');
    return readdirSync(dir)
        .sort()
        .filter((name) =>
            statSync(path.join(dir, name, 'src'), { throwIfNoEntry: false })?.isDirectory(),
        );
}

/** A package's source files but its tests, from the repository root, written with `/`. */
function sources(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...sources(full));
        } else if (/\.[cm]?[jt]sx?$/.test(name) && !/\.test\.[cm]?[jt]sx?$/.test(name)) {
            out.push(path.relative(root, full).split(path.sep).join('/'));
        }
    }
    return out;
}

/**
 * Every module a source imports: `from '...'`, `import '...'`, `import('...')`, `require('...')`.
 * A module's name holds no white space, which keeps prose in comments out.
 */
function importsOf(text: string): string[] {
    const pattern =
        /\bfrom\s*['"]([^'"\s]+)['"]|\bimport\s*['"]([^'"\s]+)['"]|\bimport\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)|\brequire\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)/g;
    return [...text.matchAll(pattern)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
}

/** What rules 1 and 2 find in a text, each as `<line>: <what>`. */
function forbiddenIn(text: string): string[] {
    const found: string[] = [];
    text.split(/\r?\n/).forEach((line, i) => {
        for (const { what, pattern } of [...CREDENTIALS, ...NETWORK_TEXT]) {
            if (pattern.test(line)) {
                found.push(`${String(i + 1)}: ${what}`);
            }
        }
    });
    for (const module of importsOf(text)) {
        if (NETWORK_MODULES.includes(module.replace(/^node:/, '').split('/')[0] ?? '')) {
            found.push(`imports ${module}`);
        }
    }
    return found;
}

/** Whether rule 3 lets a shipped file import `module` without an exception. */
function plainlyAllowed(module: string): boolean {
    if (module.startsWith('.') || module.startsWith('@pychivalry/')) {
        return true;
    }
    return module.startsWith('node:') && module !== 'node:child_process';
}

/** Whether `EXCEPTIONS` lists `module` for `file`. */
function excepted(file: string, module: string): boolean {
    return EXCEPTIONS.some((e) => e.module === module && e.files.includes(file));
}

const files = shippedPackages().flatMap((name) =>
    sources(path.join(root, 'packages', name, 'src')),
);

test('the search reads every shipped package', () => {
    const packages = shippedPackages();
    for (const name of ['core', 'cli', 'mcp', 'lsp', 'vscode']) {
        assert.ok(packages.includes(name), `packages/${name}`);
        assert.ok(
            files.some((f) => f.startsWith(`packages/${name}/src/`)),
            `no source file read in packages/${name}`,
        );
    }
    assert.ok(files.length > 100, `only ${String(files.length)} files read`);
});

test('no shipped file names a credential or a key, imports a networking module or calls fetch', () => {
    const found = files.flatMap((file) =>
        forbiddenIn(readFileSync(path.join(root, file), 'utf8')).map((f) => `${file}:${f}`),
    );
    assert.deepEqual(found, []);
});

test('every other module a shipped file imports is listed with its reason', () => {
    const found: string[] = [];
    for (const file of files) {
        for (const module of importsOf(readFileSync(path.join(root, file), 'utf8'))) {
            if (!plainlyAllowed(module) && !excepted(file, module)) {
                found.push(`${file}: ${module}`);
            }
        }
    }
    assert.deepEqual(found, []);
});

test('each exception is still needed, has a reason, and is no networking module', () => {
    for (const e of EXCEPTIONS) {
        assert.ok(e.reason.length > 20, `${e.module}: a reason`);
        assert.ok(!NETWORK_MODULES.includes(e.module.replace(/^node:/, '')), e.module);
        for (const file of e.files) {
            assert.ok(files.includes(file), `${e.module}: ${file} is a shipped source file`);
            assert.ok(
                importsOf(readFileSync(path.join(root, file), 'utf8')).includes(e.module),
                `${file} no longer imports ${e.module}: remove the exception`,
            );
        }
    }
});

test('the search finds what it looks for', () => {
    const samples: readonly [string, string][] = [
        ["const key = process.env['ANTHROPIC_API_KEY'];", 'API_KEY'],
        ['const apiKey = read();', 'API_KEY'],
        ["env['ANTHROPIC_AUTH_TOKEN']", 'AUTH_TOKEN'],
        ["const k = 'sk-ant-api03-x';", 'sk-ant'],
        ["headers: { authorization: 'x' }", 'Authorization'],
        ['`Bearer ${token}`', 'Bearer'],
        ["import http from 'node:http';", 'node:http'],
        ["import { request } from 'node:https';", 'node:http'],
        ["import net from 'node:net';", 'node:net'],
        ["import tls from 'node:tls';", 'node:tls'],
        ["import dgram from 'node:dgram';", 'node:dgram'],
        ["import { fetch } from 'undici';", 'undici'],
        ['const r = await fetch(url);', 'fetch('],
        ['new WebSocket(url)', 'WebSocket'],
    ];
    for (const [text, what] of samples) {
        assert.ok(
            forbiddenIn(text).some((f) => f.endsWith(`: ${what}`)),
            `${text} is not found as ${what}`,
        );
    }
    assert.deepEqual(forbiddenIn("import https from 'https';"), ['imports https']);
    assert.deepEqual(forbiddenIn("const m = await import('net');"), ['imports net']);
    assert.deepEqual(forbiddenIn("import { readFileSync } from 'node:fs';"), []);
    assert.deepEqual(importsOf("export { a } from './a.js';\nimport 'node:fs';"), [
        './a.js',
        'node:fs',
    ]);
    assert.ok(!plainlyAllowed('axios'));
    assert.ok(!plainlyAllowed('node:child_process'));
    assert.ok(plainlyAllowed('@pychivalry/core'));
});
