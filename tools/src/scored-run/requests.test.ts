/**
 * The content requests of the scored authoring test (docs/PLAN.md item 9.4,
 * `fixtures/requests/`): the committed list is well formed, covers the four content types at
 * every difficulty, relies only on names the game has as the spec package states it (and on
 * names its base mod defines, as the index reads it), names in its text exactly what it relies
 * on and expects, and can be met: each request's example result meets every expectation, and the
 * checker reports nothing on it. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { formatKindOf, formatText } from '@pychivalry/core';
import { checkOver, exampleResult, root, spec } from './authoring-testing.js';
import { checkExpectations } from './expectations.js';
import {
    baseDir,
    committedRequests,
    CONTENT_TYPES,
    DIFFICULTIES,
    parseRequests,
    reliedOnName,
    reliedOnProblems,
    REQUESTS_DIR,
    requestsShapeProblems,
    textNames,
    type ContentRequest,
    type RequestList,
} from './requests.js';

const list = committedRequests(root);

function firstRequest(): ContentRequest {
    const [first] = list.requests;
    assert.ok(first !== undefined);
    return first;
}

function filesUnder(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
}

test('the committed request list is well formed', () => {
    const value = JSON.parse(
        readFileSync(path.join(root, REQUESTS_DIR, 'requests.json'), 'utf8'),
    ) as unknown;
    assert.deepEqual(requestsShapeProblems(value), []);
    assert.equal(list.requests_format, 1);
});

test('the requests cover events, decisions, scripted effects and scripted triggers, several each, at every difficulty', () => {
    for (const type of CONTENT_TYPES) {
        const mine = list.requests.filter((r) => r.content_type === type);
        assert.ok(mine.length >= 3, `${type}: ${String(mine.length)} requests`);
        assert.deepEqual(
            [...new Set(mine.map((r) => r.difficulty))].sort(),
            [...DIFFICULTIES].sort(),
            type,
        );
    }
    assert.equal(list.requests.length, 12);
    // A hard request of some types builds on a mod that already has content.
    assert.ok(list.requests.some((r) => r.base !== 'empty'));
});

test('every name a request relies on exists in the game, as the spec package states it, or in its base mod', () => {
    assert.deepEqual(reliedOnProblems(spec, root, list), []);
    // The check finds a name the package lacks, of every kind.
    const first = firstRequest();
    const broken: RequestList = {
        ...list,
        requests: [
            {
                ...first,
                relies_on: [
                    { bucket: 'effects', name: 'add_gold_coins' },
                    { iterator: 'every_childe' },
                    { field: 'typ', folder: 'events' },
                    { field: 'type', folder: 'events', value: 'party_event' },
                    { base: 'empty', database: 'events', name: 'feast.0001' },
                    { base: 'feast', database: 'events', name: 'feast.0001' },
                ],
            },
        ],
    };
    const id = first.id;
    assert.deepEqual(reliedOnProblems(spec, root, broken), [
        `${id}: add_gold_coins is not a name of the spec package's effects`,
        `${id}: every_childe is not an iterator prefix of the spec package before one of its lists`,
        `${id}: typ is not a field the spec package's schema gives events`,
        `${id}: party_event is not a value the base game writes in events's type`,
        `${id}: feast.0001 is not defined in events of the base empty`,
        `${id}: feast.0001 is relied on in the base feast, but the request starts from empty`,
    ]);
});

test("every name a request's text writes between backticks is one it relies on, one the result must define or write, or a folder; and each of those is in the text", () => {
    for (const request of list.requests) {
        const names = textNames(request.request);
        const relied = request.relies_on.map(reliedOnName);
        const written: string[] = [];
        const folders: string[] = [];
        for (const e of request.expect) {
            if (e.kind === 'defines') {
                written.push(e.name);
            } else if (e.kind === 'top-level') {
                written.push(e.value);
            } else if (e.kind === 'localization') {
                written.push(e.key);
            } else if (e.kind === 'file') {
                folders.push(e.folder);
            }
        }
        for (const name of names) {
            const folder = name.endsWith('/') ? name.slice(0, -1) : null;
            assert.ok(
                relied.includes(name) ||
                    written.includes(name) ||
                    (folder !== null &&
                        folders.some((f) => f === folder || folder.startsWith(`${f}/`))),
                `${request.id}: \`${name}\` is neither relied on nor expected`,
            );
        }
        for (const name of [...relied, ...written]) {
            assert.ok(names.includes(name), `${request.id}: ${name} is not named in the text`);
        }
        // What the result uses is a name the game has or one the request or its base defines.
        for (const e of request.expect) {
            if (e.kind === 'uses' || e.kind === 'resolves') {
                assert.ok(
                    relied.includes(e.uses) || written.includes(e.uses),
                    `${request.id}: ${e.uses} is neither relied on nor defined by the request`,
                );
            }
        }
    }
});

test('every field an expectation names is one the spec package gives its folder, and every question asks a dimension of the set', () => {
    const dimensions = list.dimensions.map((d) => d.id);
    for (const request of list.requests) {
        for (const e of request.expect) {
            if (e.kind === 'field') {
                assert.ok(
                    spec.data.schema[e.database]?.fields[e.field] !== undefined,
                    `${request.id}: ${e.field} in ${e.database}`,
                );
            }
        }
        for (const q of request.judged) {
            assert.ok(dimensions.includes(q.dimension), `${request.id}: ${q.dimension}`);
        }
    }
    // Every dimension of the set is asked by some request.
    for (const d of dimensions) {
        assert.ok(
            list.requests.some((r) => r.judged.some((q) => q.dimension === d)),
            d,
        );
    }
});

test('each base mod is in the format, and the checker reports nothing on it', (t) => {
    for (const base of [...new Set(list.requests.map((r) => r.base))]) {
        const dir = baseDir(root, base);
        assert.deepEqual(
            checkOver(t, dir).findings.map((f) => `${f.file} ${f.code}`),
            [],
            base,
        );
    }
});

test('every request can be met: its example result meets every expectation, and the checker reports nothing on it', (t) => {
    for (const request of list.requests) {
        const mod = exampleResult(t, request);
        const check = checkOver(t, mod);
        assert.deepEqual(
            check.findings.map((f) => `${f.file}:${String(f.range.start.line + 1)} ${f.code}`),
            [],
            request.id,
        );
        const results = checkExpectations(
            { index: check.index, modDir: mod, givenDir: baseDir(root, request.base) },
            request.expect,
        );
        assert.deepEqual(
            results.filter((r) => !r.met).map((r) => `${r.expectation}: ${String(r.problem)}`),
            [],
            request.id,
        );
    }
    // No example exists for a request the list does not hold.
    assert.deepEqual(
        readdirSync(path.join(root, REQUESTS_DIR, 'examples')).sort(),
        list.requests.map((r) => r.id).sort(),
    );
});

test("every script and localization file of the bases and the examples is in pychivalry's format", () => {
    const out: string[] = [];
    for (const dir of ['bases', 'examples']) {
        for (const full of filesUnder(path.join(root, REQUESTS_DIR, dir))) {
            const kind = formatKindOf(full);
            if (kind === undefined) {
                continue;
            }
            const text = readFileSync(full, 'utf8');
            const result = formatText(text, kind);
            if (result.left !== null || result.changed || !text.startsWith('\uFEFF')) {
                out.push(path.relative(root, full));
            }
        }
    }
    assert.deepEqual(out, []);
});

test('the shape check names what is wrong', () => {
    const good = JSON.parse(JSON.stringify(list)) as Record<string, unknown>;
    const bad = (change: (r: Record<string, unknown>) => void): string[] => {
        const copy = JSON.parse(JSON.stringify(good)) as { requests: Record<string, unknown>[] };
        const [first] = copy.requests;
        assert.ok(first !== undefined);
        change(first);
        return requestsShapeProblems(copy);
    };
    assert.deepEqual(requestsShapeProblems(good), []);
    assert.deepEqual(requestsShapeProblems([]), ['the request list is not a JSON object']);
    assert.deepEqual(
        bad((r) => {
            r['id'] = 'Not An Id';
        }),
        ['requests[0]: id is not lower-case words joined by hyphens'],
    );
    assert.deepEqual(
        bad((r) => {
            r['content_type'] = 'casus_belli';
        }),
        [
            'requests[0]: content_type is not one of event, decision, scripted_effect, scripted_trigger',
        ],
    );
    assert.deepEqual(
        bad((r) => {
            r['expect'] = [
                { kind: 'field', database: 'events', name: 'x', field: 'y', value: 'z', count: 2 },
            ];
        }),
        ['requests[0].expect[0]: not an expectation'],
    );
    assert.deepEqual(
        bad((r) => {
            r['judged'] = [
                { dimension: 'effects-as-asked', question: 'a?' },
                { dimension: 'effects-as-asked', question: 'b?' },
                { dimension: 'tone', question: 'c?' },
            ];
        }),
        [
            'requests[0].judged[1]: effects-as-asked is asked twice',
            'requests[0].judged[2]: tone is not one of the dimensions',
        ],
    );
    assert.deepEqual(
        bad((r) => {
            r['relies_on'] = [{ bucket: 'traits', name: 'brave' }];
        }),
        ['requests[0].relies_on[0]: not a bucket, iterator, field or base name'],
    );
    assert.throws(() => parseRequests('{', 'x.json'), /x\.json is not JSON/);
    assert.throws(
        () => parseRequests(JSON.stringify({ ...good, requests_format: 2 }), 'x.json'),
        /requests_format is not 1/,
    );
});

test('textNames lists each name between backticks once, in order', () => {
    assert.deepEqual(textNames('Use `a`, then `b.c` and `a` again, and `d/`.'), ['a', 'b.c', 'd/']);
});
