/**
 * The scored runs and their judge reach a model only by starting the developer's own Claude
 * Code as a child process (AGENTS.md rule 12; docs/decisions.md, decision 80): no SDK, no key,
 * no network call. `tools/src/no-key-no-network.test.ts` holds every shipped package to holding
 * no key and reaching no network; this test holds the scripts of `tools/src/scored-run/`, which
 * are never shipped, to the one way they may reach a model. It reads every source file of the
 * folder but the tests, comments included, and fails when one
 *
 * 1. names a credential or holds a key-shaped string (`API_KEY`, `AUTH_TOKEN`, `sk-ant`,
 *    `Authorization`, `Bearer`), or names a model provider's library (`@anthropic-ai`);
 * 2. imports a networking module or calls a networking function (`fetch(`, `WebSocket`, ...);
 * 3. imports a module that is neither Node's, pychivalry's own, the tools' `ajv`, nor one of the
 *    folder's own files;
 * 4. starts a program that is not the Claude Code the run names (`options.claude`): every
 *    `spawnSync` is handed `<options>.claude.command`, and no other way of starting a program
 *    of `node:child_process` is used.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { repoRoot } from '../util.js';

const root = repoRoot();
const dir = path.join(root, 'tools', 'src', 'scored-run');
const files = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort();

const FORBIDDEN: readonly { readonly what: string; readonly pattern: RegExp }[] = [
    { what: 'API_KEY', pattern: /API_?KEY/i },
    { what: 'AUTH_TOKEN', pattern: /AUTH_?TOKEN/i },
    { what: 'sk-ant', pattern: /sk-ant/i },
    { what: 'Authorization', pattern: /Authorization/i },
    { what: 'Bearer', pattern: /\bBearer\b/i },
    { what: '@anthropic-ai', pattern: /@anthropic-ai/i },
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

function importsOf(text: string): string[] {
    const pattern =
        /\bfrom\s*['"]([^'"\s]+)['"]|\bimport\s*['"]([^'"\s]+)['"]|\bimport\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)|\brequire\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)/g;
    return [...text.matchAll(pattern)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
}

function allowed(module: string): boolean {
    return (
        module.startsWith('./') ||
        module === '../util.js' ||
        module === '../game.js' ||
        module === '../record.js' ||
        module === '../testing.js' ||
        module.startsWith('@pychivalry/') ||
        module.startsWith('ajv') ||
        (module.startsWith('node:') &&
            ![
                'node:http',
                'node:https',
                'node:http2',
                'node:net',
                'node:tls',
                'node:dgram',
                'node:dns',
                'node:inspector',
            ].includes(module))
    );
}

test('the folder holds the scored runs and their judge', () => {
    for (const file of ['run.ts', 'authoring.ts', 'judge.ts', 'calibration.ts', 'fake-claude.ts']) {
        assert.ok(files.includes(file), file);
    }
});

test('no file of the scored runs names a key or a model library, or reaches the network', () => {
    const found: string[] = [];
    for (const file of files) {
        const text = readFileSync(path.join(dir, file), 'utf8');
        text.split(/\r?\n/).forEach((line, i) => {
            for (const { what, pattern } of FORBIDDEN) {
                if (pattern.test(line)) {
                    found.push(`${file}:${String(i + 1)}: ${what}`);
                }
            }
        });
        for (const module of importsOf(text)) {
            if (!allowed(module)) {
                found.push(`${file}: imports ${module}`);
            }
        }
    }
    assert.deepEqual(found, []);
});

test('every program the scored runs start is the Claude Code the run names', () => {
    const starts: string[] = [];
    for (const file of files) {
        const text = readFileSync(path.join(dir, file), 'utf8');
        // Of node:child_process, only spawnSync is taken, and only as a name of its own.
        for (const m of text.matchAll(
            /import\s*(\{[^}]*\}|\*\s*as\s+\w+|\w+)\s*from\s*['"](node:)?child_process['"]/g,
        )) {
            assert.equal(m[1]?.replace(/\s+/g, ' '), '{ spawnSync }', `${file}: ${m[0]}`);
        }
        const code = text.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        for (const m of code.matchAll(/\bspawnSync\(\s*([^,\s]+)/g)) {
            starts.push(`${file}: ${m[1] ?? ''}`);
        }
    }
    assert.deepEqual(starts.sort(), [
        'authoring.ts: options.claude.command',
        'judge.ts: options.claude.command',
        'run.ts: claude.command',
        'run.ts: options.claude.command',
    ]);
});
