/**
 * The presentation data (docs/PLAN.md item 8.8): every file reads; every name it gives is a
 * name of the committed spec package (an outline rule's and a field order's fields are fields
 * of the folder's record schema, a hint's field too, a snippet's choices are values the base
 * game writes in that field); the snippet syntax reads as the editor reads it; and the data is
 * the language server's alone: no file of the core references it, and nothing in the core,
 * where every check lives, can receive it.
 */

import type { SchemaField } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
    defaultPresentationDir,
    expandSnippet,
    loadPresentation,
    readFolderFile,
    renderTemplate,
    snippetChoices,
    snippetText,
    templateFields,
    type FolderPresentation,
} from './presentation.js';
import { committedSpec, REPO_ROOT } from './testing.js';

const spec = committedSpec();
const presentation = loadPresentation();

type Fields = Readonly<Record<string, SchemaField>>;

/** The schema fields of a block of a folder's records, by its path of keys; null when none. */
function fieldsAt(folder: string, block: string): Fields | null {
    const schema = spec.data.schema;
    if (!Object.prototype.hasOwnProperty.call(schema, folder)) {
        return null;
    }
    let fields: Fields | undefined = schema[folder]?.fields;
    for (const segment of block === '' ? [] : block.split('.')) {
        fields =
            fields !== undefined && Object.hasOwn(fields, segment)
                ? fields[segment]?.fields
                : undefined;
    }
    return fields ?? null;
}

function has(fields: Fields | null, name: string): boolean {
    return fields !== null && Object.hasOwn(fields, name);
}

test('the presentation data is read from the repository, every file of it', () => {
    assert.equal(path.resolve(defaultPresentationDir()), path.join(REPO_ROOT, 'presentation'));
    assert.deepEqual(presentation.problems, []);
    assert.ok(presentation.folders.size >= 20, String(presentation.folders.size));
    assert.equal(presentation.every.language, 'l_english');
    assert.deepEqual(presentation.every.hints, [{ kind: 'scope' }]);
});

test('every folder of the data is a folder whose records the spec describes', () => {
    for (const folder of presentation.folders.keys()) {
        assert.ok(fieldsAt(folder, '') !== null, `${folder}: no record schema in the spec`);
    }
});

test('every field an outline rule, a field order or a hint names is a field of the spec', () => {
    const missing: string[] = [];
    const check = (f: FolderPresentation, block: string, name: string, what: string): void => {
        if (!has(fieldsAt(f.folder, block), name)) {
            missing.push(`${f.folder}: ${what} ${block === '' ? '' : `${block}.`}${name}`);
        }
    };
    let names = 0;
    for (const f of presentation.folders.values()) {
        for (const block of f.outline?.blocks ?? []) {
            check(f, '', block.field, 'outline block');
            for (const name of templateFields(`${block.label ?? ''}${block.fallback ?? ''}`)) {
                check(f, block.field, name, 'outline label');
            }
            names++;
        }
        for (const name of templateFields(f.outline?.detail ?? '')) {
            check(f, '', name, 'outline detail');
            names++;
        }
        for (const order of f.fieldOrder) {
            assert.equal(new Set(order.fields).size, order.fields.length, `${f.folder}: twice`);
            for (const name of order.fields) {
                check(f, order.block, name, 'field order');
                names++;
            }
        }
        for (const hint of f.hints) {
            if (hint.kind === 'text') {
                const block = hint.block ?? '';
                if (block !== '') {
                    check(f, '', block, 'hint block');
                }
                if (hint.field !== undefined) {
                    check(f, block, hint.field, 'hint');
                }
                names++;
            }
        }
    }
    assert.deepEqual(missing, []);
    assert.ok(names > 100, String(names));
});

test("every snippet's field is a field of the spec, and each choice a value the base game writes", () => {
    const wrong: string[] = [];
    for (const f of presentation.folders.values()) {
        const record = fieldsAt(f.folder, '');
        for (const s of f.snippets) {
            if (s.at === 'field' && !has(fieldsAt(f.folder, s.block ?? ''), s.field ?? '')) {
                wrong.push(`${f.folder}: snippet ${s.label} writes ${String(s.field)}`);
            }
            assert.equal(s.at === 'field', s.field !== undefined, `${f.folder}: ${s.label}`);
            const text = snippetText(s);
            for (const [stop, choices] of snippetChoices(text)) {
                // A choice is written as a field's value: `field = ${n|a,b|}`.
                const field = new RegExp(`([A-Za-z0-9_]+)\\s*=\\s*\\$\\{${stop}\\|`).exec(
                    text,
                )?.[1];
                const known =
                    field !== undefined && record !== null && Object.hasOwn(record, field)
                        ? record[field]
                        : undefined;
                const values = new Set((known?.values ?? []).map((v) => v.value));
                if (values.size === 0) {
                    wrong.push(`${f.folder}: ${s.label}: choices for ${String(field)}, no values`);
                }
                for (const c of choices) {
                    if (!values.has(c)) {
                        wrong.push(`${f.folder}: ${s.label}: ${String(field)} = ${c}`);
                    }
                }
            }
        }
    }
    assert.deepEqual(wrong, []);
});

test('a snippet expands as the editor leaves it when every tab stop is accepted', () => {
    assert.equal(expandSnippet('a = ${1:x}.${2:1} b = $3 c = ${4|p,q|}$0'), 'a = x.1 b =  c = p');
    assert.equal(expandSnippet('a = { ${1:b = ${2:c}} }'), 'a = { b = c }');
    assert.equal(expandSnippet('t = "\\$x\\$"'), 't = "$x$"');
    assert.deepEqual(
        [...snippetChoices('a = ${3|x,y|} b = ${1|z|}')],
        [
            ['3', ['x', 'y']],
            ['1', ['z']],
        ],
    );
    assert.equal(
        renderTemplate('{key} {n}: {name}', (n) => ({ key: 'k', n: '2', name: 'v' })[n] ?? null),
        'k 2: v',
    );
    assert.equal(
        renderTemplate('{name}', () => null),
        null,
    );
    assert.deepEqual(templateFields('{key} {n} {name} {type}'), ['name', 'type']);
});

test("a data file's folder is its path, and one out of the format is refused with why", () => {
    assert.throws(
        () => readFolderFile('events.json', { folder: 'common/decisions' }),
        /path says events/,
    );
    assert.throws(
        () =>
            readFolderFile('events.json', {
                folder: 'events',
                outline: { symbol: 'NoSuchKind', blocks: [] },
            }),
        /no symbol kind/,
    );
    assert.throws(
        () =>
            readFolderFile('events.json', {
                folder: 'events',
                snippets: [{ label: 'x', description: 'x', at: 'field', body: [] }],
            }),
        /names its field/,
    );
    const read = readFolderFile(path.join('common', 'decisions.json'), {
        folder: 'common/decisions',
    });
    assert.equal(read.folder, 'common/decisions');
    assert.equal(read.outline, null);
    assert.deepEqual(read.snippets, []);
});

// ─── The data is the language server's alone ───────────────────────────────

/** Every file under a folder, `dist` and `node_modules` left out. */
function sources(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        if (name === 'dist' || name === 'node_modules') {
            continue;
        }
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) {
            out.push(...sources(file));
        } else {
            out.push(file);
        }
    }
    return out;
}

test('no file of the core references the presentation data, and no check can receive it', () => {
    const core = path.join(REPO_ROOT, 'packages', 'core');
    const files = sources(core);
    assert.ok(files.length > 100);
    const naming = files.filter((f) => {
        const text = readFileSync(f, 'utf8');
        return /presentation\//.test(text) || text.includes('@pychivalry/lsp');
    });
    assert.deepEqual(naming, [], 'a core file names presentation/ or the language server');
    // Every check lives in the core (AGENTS.md, "How to add a check"); the core depends on no
    // other package of the workspace and references none in its build, so no check can import
    // the loader or its types, or be handed what they read.
    const manifest = JSON.parse(readFileSync(path.join(core, 'package.json'), 'utf8')) as Record<
        string,
        unknown
    >;
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const deps = manifest[key];
        assert.ok(
            deps === undefined ||
                Object.keys(deps as object).every((d) => !d.startsWith('@pychivalry/')),
            `core ${key}`,
        );
    }
    const tsconfig = readFileSync(path.join(core, 'tsconfig.json'), 'utf8');
    assert.doesNotMatch(tsconfig, /"references"/);
    assert.ok(
        files.some((f) => f.endsWith(path.join('src', 'check', 'index.ts'))),
        'the checks are in the core',
    );
});
