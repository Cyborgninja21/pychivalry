/**
 * The content requests of the scored authoring test (docs/PLAN.md item 9.4,
 * `fixtures/requests/`): the committed list is well formed, covers the four content types at
 * every difficulty, relies only on names the game has as the spec package states it (and on
 * names its base mod defines, as the index reads it), names in its text exactly what it relies
 * on and expects (and nowhere a name it leaves to the session to find), and can be met: each
 * request's example result meets every expectation, and the checker reports nothing on it. Each
 * expert request's first draft, a result with the mistake the request invites, fails the
 * code-checked side for the reason `fixtures/requests/drafts/drafts.json` gives. No model, key,
 * network or display.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { folderTableFromSpec, formatKindOf, formatText } from '@pychivalry/core';
import { tempDir } from '../testing.js';
import {
    checkOver,
    committedDrafts,
    DRAFTS_DIR,
    exampleResult,
    root,
    spec,
} from './authoring-testing.js';
import { checkExpectations } from './expectations.js';
import {
    baseDir,
    committedRequests,
    CONTENT_TYPES,
    DIFFICULTIES,
    EXPERT,
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

test('the requests cover events, decisions, scripted effects and scripted triggers: one easy, one medium and one hard of each, and three expert', () => {
    for (const type of CONTENT_TYPES) {
        const mine = list.requests.filter((r) => r.content_type === type);
        assert.deepEqual(
            DIFFICULTIES.map((d) => mine.filter((r) => r.difficulty === d).length),
            [1, 1, 1, 3],
            type,
        );
        // One expert request of each type builds on the mod `granary`.
        assert.equal(
            mine.filter((r) => r.difficulty === EXPERT && r.base === 'granary').length,
            1,
            type,
        );
    }
    assert.equal(list.requests.length, 24);
    // A hard request of some types builds on a mod that already has content.
    assert.ok(list.requests.some((r) => r.difficulty === 'hard' && r.base !== 'empty'));
    // The expert requests come after the twelve the first two runs were made on, which keep
    // their places.
    assert.deepEqual(
        list.requests.map((r) => r.difficulty === EXPERT),
        [...Array<boolean>(12).fill(false), ...Array<boolean>(12).fill(true)],
    );
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

/** True when `name` is written in `text` as a name, between backticks or not. */
function writes(text: string, name: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Za-z0-9_.:])${escaped}($|[^A-Za-z0-9_])`).test(text);
}

test("every name a request's text writes between backticks is one it relies on, one the result must define or write, or a folder; and each of those is in the text", () => {
    for (const request of list.requests) {
        const names = textNames(request.request);
        const relied = request.relies_on.filter((e) => e.unnamed !== true).map(reliedOnName);
        // A name left to the session to find is nowhere in the text: not between backticks, and
        // not written plainly either.
        const unnamed = request.relies_on.filter((e) => e.unnamed === true).map(reliedOnName);
        for (const name of unnamed) {
            assert.ok(!writes(request.request, name), `${request.id}: ${name} is in the text`);
        }
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
                    relied.includes(e.uses) || unnamed.includes(e.uses) || written.includes(e.uses),
                    `${request.id}: ${e.uses} is neither relied on nor defined by the request`,
                );
                // The block a name must be used inside is one the request names: a name it
                // relies on, a field of the record, or a scope it asks to save by name.
                const within = e.within;
                if (within !== undefined) {
                    const saved = /^scope:([a-z_]+)$/.exec(within);
                    assert.ok(
                        relied.includes(within) ||
                            unnamed.includes(within) ||
                            spec.data.schema[e.database]?.fields[within] !== undefined ||
                            (saved !== null &&
                                request.request.includes(`scope named ${saved[1] ?? ''}`)),
                        `${request.id}: inside ${within}`,
                    );
                }
            }
            // A definition kept as the base has it is one the request relies on in its base.
            if (e.kind === 'kept') {
                assert.ok(
                    request.relies_on.some(
                        (r) =>
                            'base' in r &&
                            r.base === request.base &&
                            r.database === e.database &&
                            r.name === e.name,
                    ),
                    `${request.id}: kept ${e.name}`,
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
    // A database an expectation walks through is one the index knows.
    const folders = new Set(folderTableFromSpec(spec.data).folders.map((f) => f.path));
    for (const request of list.requests) {
        for (const e of request.expect) {
            if ((e.kind === 'uses' || e.kind === 'resolves') && e.through !== undefined) {
                assert.ok(folders.has(e.through), `${request.id}: through ${e.through}`);
            }
        }
    }
});

test('a retired id is never used again, and the requests the first run named and retired are listed', () => {
    const retired = (list.retired ?? []).map((r) => r.id);
    // The two requests of the first scored authoring run whose base clashed with the game.
    assert.deepEqual(retired, ['decision-hold-feast', 'trigger-feast-guest']);
    for (const id of retired) {
        assert.ok(!list.requests.some((r) => r.id === id), id);
        assert.ok(!existsSync(path.join(root, REQUESTS_DIR, 'examples', id)), `${id}: no example`);
    }
    // Only the bases a request starts from are kept.
    assert.deepEqual(
        readdirSync(path.join(root, REQUESTS_DIR, 'bases')).sort(),
        [...new Set(list.requests.map((r) => r.base))].sort(),
    );
    const copy = JSON.parse(JSON.stringify(list)) as {
        requests: Record<string, unknown>[];
        retired: Record<string, unknown>[];
    };
    const [first] = copy.requests;
    assert.ok(first !== undefined);
    first['id'] = 'trigger-feast-guest';
    assert.deepEqual(requestsShapeProblems(copy), [
        'requests[0]: the id trigger-feast-guest is retired, and a retired id is never used again',
    ]);
    copy.retired.push({ id: 'trigger-feast-guest', why: 'twice' }, { id: 'x' });
    first['id'] = 'event-merchant-debt';
    assert.deepEqual(requestsShapeProblems(copy), [
        'retired[2]: trigger-feast-guest is retired twice',
        'retired[3]: needs an id and why it was retired',
    ]);
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
        // Hints included: every option has its AI weight since decision 160.
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

test("each expert request's first draft fails the code-checked side, for the reason given", (t) => {
    const drafts = committedDrafts();
    // One draft for each expert request, in the list's order, and no other.
    assert.deepEqual(
        drafts.drafts.map((d) => d.request),
        list.requests.filter((r) => r.difficulty === EXPERT).map((r) => r.id),
    );
    assert.deepEqual(
        readdirSync(path.join(root, DRAFTS_DIR))
            .filter((name) => name !== 'drafts.json')
            .sort(),
        drafts.drafts.map((d) => d.request).sort(),
    );
    let checkerCaught = 0;
    for (const draft of drafts.drafts) {
        const request = list.requests.find((r) => r.id === draft.request);
        assert.ok(request !== undefined, draft.request);
        const mod = path.join(tempDir(t), 'mod');
        cpSync(baseDir(root, request.base), mod, { recursive: true });
        cpSync(path.join(root, DRAFTS_DIR, draft.request), mod, { recursive: true });
        const check = checkOver(t, mod);
        // Exactly the errors and warnings given, and nothing of the `style/` family: a draft is
        // in the format, so that what fails it is the mistake and nothing else.
        assert.deepEqual(
            check.findings
                .filter((f) => f.severity === 'error' || f.severity === 'warning')
                .map((f) => `${f.severity} ${f.code}`)
                .sort(),
            [...draft.checker].sort(),
            draft.request,
        );
        const results = checkExpectations(
            { index: check.index, modDir: mod, givenDir: baseDir(root, request.base) },
            request.expect,
        );
        assert.deepEqual(
            results.filter((r) => !r.met).map((r) => `${r.expectation}: ${String(r.problem)}`),
            draft.unmet,
            draft.request,
        );
        // Each fails the code-checked side: an error or a warning, or an expectation not met.
        assert.ok(draft.checker.length + draft.unmet.length > 0, draft.request);
        if (draft.checker.length > 0) {
            checkerCaught++;
        }
    }
    // Eight of the twelve set a trap the checker itself catches: a first draft that falls in
    // needs a round of repair before its check is clean.
    assert.equal(checkerCaught, 8);
});

test("every script and localization file of the bases, the examples and the drafts is in pychivalry's format", () => {
    const out: string[] = [];
    for (const dir of ['bases', 'examples', 'drafts']) {
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
            r['relies_on'] = [
                { bucket: 'traits', name: 'brave' },
                { bucket: 'effects', name: 'add_gold', unnamed: false },
                { iterator: 'every_child', unnamed: true },
            ];
        }),
        [
            'requests[0].relies_on[0]: not a bucket, iterator, field or base name',
            'requests[0].relies_on[1]: not a bucket, iterator, field or base name',
        ],
    );
    assert.deepEqual(
        bad((r) => {
            r['expect'] = [
                { kind: 'defines', database: 'events', name: 'x', count: 0 },
                {
                    kind: 'uses',
                    database: 'events',
                    name: 'x',
                    uses: 'y',
                    within: 'z',
                    through: 'w',
                },
                { kind: 'kept', database: 'events', name: 'x', file: 'y' },
                { kind: 'kept', database: 'events', name: 'x' },
                {
                    kind: 'resolves',
                    database: 'events',
                    name: 'x',
                    uses: 'y',
                    to: 'z',
                    within: 'w',
                },
            ];
        }),
        [
            'requests[0].expect[0]: not an expectation',
            'requests[0].expect[1]: not an expectation',
            'requests[0].expect[2]: not an expectation',
        ],
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
