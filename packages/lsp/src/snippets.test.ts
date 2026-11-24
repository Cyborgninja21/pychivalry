/**
 * Every snippet of the presentation data is in pychivalry's format, so what completion inserts is
 * already formatted (the owner's word of 2026-11-23), and produces script pychivalry's own checks
 * accept with no error and no warning (docs/PLAN.md item 8.8). Each is written as a file of its folder
 * (`snippet-hosts.ts`) in a mod of its own and checked by the one runner over the committed
 * spec package, with no base game: what the spec alone judges (unknown triggers, effects,
 * links, fields, kinds of value, scopes, structure, the parse). The same files were also
 * checked over the 1.21.0.3 base game when the data was written; that run needs the game and
 * is not part of CI.
 */

import { checkWorkspace, formatText, parse } from '@pychivalry/core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { expandSnippet, loadPresentation, snippetText } from './presentation.js';
import { snippetHosts } from './snippet-hosts.js';
import { committedSpec, scratch, write } from './testing.js';

const spec = committedSpec();
const presentation = loadPresentation();

test('every snippet is written as a file of its folder', () => {
    const hosts = snippetHosts(presentation, (text) => parse(text).file);
    const snippets = [...presentation.folders.values()].reduce((n, f) => n + f.snippets.length, 0);
    assert.equal(hosts.length, snippets, 'a field snippet whose block its record does not write');
    assert.ok(snippets >= 100, String(snippets));
    // Each kind of snippet is there.
    for (const at of ['file', 'record', 'field'] as const) {
        assert.ok(
            hosts.some((h) => h.snippet.at === at),
            at,
        );
    }
});

test('every snippet produces script the checks accept with no error and no warning', (t) => {
    const root = scratch(t);
    const hosts = snippetHosts(presentation, (text) => parse(text).file);
    const failures: string[] = [];
    hosts.forEach((host, i) => {
        const mod = path.join(root, `snippet-${String(i)}`);
        write(path.join(mod, 'descriptor.mod'), 'name = "snippets"\n');
        write(path.join(mod, ...host.file.split('/')), host.text);
        const run = checkWorkspace({ spec, modDir: mod, gameDir: null, cacheDir: null });
        // The snippets are in the format (the test below); a host file, put together from
        // several, is not checked for it.
        for (const f of run.findings.filter((x) => !x.code.startsWith('style/'))) {
            if (f.severity === 'error' || f.severity === 'warning') {
                failures.push(
                    `${host.folder} "${host.snippet.label}": ${f.code} ${f.message} (line ${String(f.range.start.line + 1)})\n${host.text}`,
                );
            }
        }
    });
    assert.deepEqual(failures, []);
});

test('every snippet, expanded as the editor inserts it, is left unchanged by the formatter', () => {
    const out: string[] = [];
    let count = 0;
    for (const folder of presentation.folders.values()) {
        for (const snippet of folder.snippets) {
            count++;
            // Each placeholder its text, each choice its first option, every other tab stop
            // empty; written as a file in the format: the byte-order mark and Windows line breaks.
            const expanded = expandSnippet(snippetText(snippet));
            const file = `\uFEFF${expanded.replaceAll('\n', '\r\n')}\r\n`;
            const result = formatText(file, 'script');
            if (result.left !== null || result.changed) {
                out.push(
                    `${folder.folder} "${snippet.label}": ${result.left?.message ?? 'not in the format'}\n${expanded}\n---\n${result.text}`,
                );
            }
        }
    }
    assert.ok(count >= 100, String(count));
    assert.deepEqual(out, []);
});
