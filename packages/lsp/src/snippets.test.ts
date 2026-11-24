/**
 * Every snippet of the presentation data produces script pychivalry's own checks accept with no
 * error and no warning (docs/PLAN.md item 8.8). Each is written as a file of its folder
 * (`snippet-hosts.ts`) in a mod of its own and checked by the one runner over the committed
 * spec package, with no base game: what the spec alone judges (unknown triggers, effects,
 * links, fields, kinds of value, scopes, structure, the parse). The same files were also
 * checked over the 1.21.0.3 base game when the data was written; that run needs the game and
 * is not part of CI.
 */

import { checkWorkspace, parse } from '@pychivalry/core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { loadPresentation } from './presentation.js';
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
        // The `style/` family is the formatter's: a snippet is laid out where it is inserted.
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
