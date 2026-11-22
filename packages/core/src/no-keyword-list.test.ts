/**
 * The core holds no keyword list (docs/MVP.md, definition of done 5; AGENTS.md rule 5): a
 * search of its source for the names in release 2.3.0's tables, which the spec package now
 * carries with their evidence (part C4, `tables`), finds none written as a string.
 *
 * The search reads every source file of the core but its tests and test helpers, and takes
 * every quoted string in it. A few of the names are also words of the package format or of
 * the syntax tree, which the core must write to read its input; each is listed below with the
 * place it comes from, and may appear only as that.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { committedSpec, REPO_ROOT } from './spec/testing.js';

/** Names of 2.3.0's tables that are also words the core reads its input by. */
const FORMAT_WORDS: Readonly<Record<string, string>> = {
    trigger: "the C4 tables' own attribute value for a body read as triggers (`child`, `context`)",
    effect: "the C4 tables' own attribute value for a body read as effects (`child`, `context`)",
    name: "a word's kind in the syntax tree (`WordType`), and a slot of a message's placeholders",
    value: "a slot of a message's placeholders (`Slot`), as the syntax layer's findings have it",
    list: "a block's shape in the syntax tree (`blockShape`)",
    parameter: "a word's kind in the syntax tree (`WordType`): a `$PARAM$`",
    object: "what JavaScript's `typeof` gives for an object",
    status: "a key of the override rules table's own format (`spec/override-rules.json`)",
};

/** Every name of 2.3.0's tables: the entries, their parameters, the lists and folders they name. */
function tableNames(): Set<string> {
    const names = new Set<string>();
    for (const table of Object.values(committedSpec().data.tables.data)) {
        for (const [name, entry] of Object.entries(table.entries)) {
            names.add(name);
            const params = entry['params'];
            if (typeof params === 'object' && params !== null) {
                for (const key of Object.keys(params)) {
                    names.add(key);
                }
            }
            if (Array.isArray(entry['lists'])) {
                for (const list of entry['lists'] as unknown[]) {
                    names.add(String(list));
                }
            }
            if (typeof entry['directory'] === 'string') {
                names.add(entry['directory']);
            }
        }
    }
    return names;
}

/** The core's source files, without its tests and test helpers. */
function sources(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...sources(full));
        } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'testing.ts') {
            out.push(full);
        }
    }
    return out;
}

/** A TypeScript source without its comments: block comments, and line comments after a space. */
function withoutComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Every quoted string of a TypeScript source: '...', "..." and `...` without `${`. */
function strings(source: string): string[] {
    const text = withoutComments(source);
    const out: string[] = [];
    const pattern = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g;
    for (const match of text.matchAll(pattern)) {
        out.push(match[1] ?? match[2] ?? match[3] ?? '');
    }
    return out;
}

test('the search has names to look for: every table of the package, 166 entries', () => {
    const tables = committedSpec().data.tables.data;
    assert.equal(Object.keys(tables).length, 19);
    const entries = Object.values(tables).reduce((n, t) => n + Object.keys(t.entries).length, 0);
    assert.equal(entries, 166);
    assert.ok(tableNames().size >= 166);
});

test("no source file of the core writes a name of 2.3.0's tables as a string", () => {
    const names = tableNames();
    const root = path.join(REPO_ROOT, 'packages', 'core', 'src');
    const found: string[] = [];
    for (const file of sources(root)) {
        for (const value of strings(readFileSync(file, 'utf8'))) {
            if (names.has(value) && !Object.prototype.hasOwnProperty.call(FORMAT_WORDS, value)) {
                found.push(`${path.relative(root, file)}: '${value}'`);
            }
        }
    }
    assert.deepEqual(found, []);
});

test('each format word excepted is a name of the tables, so the list holds no other', () => {
    const names = tableNames();
    for (const word of Object.keys(FORMAT_WORDS)) {
        assert.ok(names.has(word), `${word} is in the tables`);
    }
});
