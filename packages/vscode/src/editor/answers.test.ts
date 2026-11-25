/**
 * The same-answers test's comparison (item 7.9), with no editor: a finding as the core, the
 * command line and the agent server state it is one answer, and two lists that differ say how.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    bySeverity,
    canonical,
    differences,
    fromAgent,
    fromCore,
    only,
    parseCliJson,
    sorted,
    withRanges,
} from './answers.js';

const core = {
    file: 'events/a.txt',
    range: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } },
    severity: 'error',
    code: 'names/unknown-trigger',
    message: "Unknown trigger 'is_adul'",
    evidence: { kind: 'catalogue', message: "Unknown trigger '%s'" },
    data: { name: 'is_adul', scopes: ['character'] },
};

const agent = {
    layer: 'mod',
    file: 'events/a.txt',
    line: 3,
    column: 5,
    end_line: 3,
    end_column: 10,
    severity: 'error',
    code: 'names/unknown-trigger',
    message: "Unknown trigger 'is_adul'",
    data: { scopes: ['character'], name: 'is_adul' },
};

test('the core, the command line and the agent server state one finding the same way', () => {
    const fromTheCore = fromCore(core);
    const fromTheAgent = fromAgent(agent);
    assert.deepEqual(only([fromTheCore], { data: true, evidence: false }), [fromTheAgent]);
    assert.equal(fromTheCore.evidence, canonical(core.evidence));
    // Keys in another order are the same data.
    assert.equal(canonical({ b: 1, a: [{ d: 2, c: 3 }] }), '{"a":[{"c":3,"d":2}],"b":1}');
});

test('a fix is the same answer on every surface: its places from 0 in the core, from 1 in the agent server', () => {
    const edit = {
        file: 'events/a.txt',
        range: { start: { line: 2, character: 4 }, end: { line: 2, character: 11 } },
        new_text: 'is_adult',
    };
    const fix = {
        safety: 'safe',
        basis: 'nearest-name',
        alternatives: [{ title: "Replace 'is_adul' with 'is_adult'", edits: [edit] }],
    };
    const agentFix = {
        safety: 'safe',
        basis: 'nearest-name',
        alternatives: [
            {
                title: "Replace 'is_adul' with 'is_adult'",
                edits: [
                    {
                        layer: 'mod',
                        file: 'events/a.txt',
                        line: 3,
                        column: 5,
                        end_line: 3,
                        end_column: 12,
                        new_text: 'is_adult',
                    },
                ],
            },
        ],
    };
    const fromTheCore = fromCore({ ...core, fix });
    assert.deepEqual(only([fromTheCore], { data: true, evidence: false }), [
        fromAgent({ ...agent, fix: agentFix }),
    ]);
    assert.equal(fromTheCore.fix, canonical(fix));
    assert.deepEqual(withRanges({ line: 1, column: 1, end_line: 1, end_column: 2, x: [] }), {
        x: [],
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    });
    assert.notDeepEqual(
        only([fromTheCore], { data: true, evidence: false }),
        [fromAgent({ ...agent, fix: null })],
        'a fix one surface lacks is a difference',
    );
    assert.equal(only([fromTheCore], { data: false, evidence: false, fix: false })[0]?.fix, null);
});

test("every place of the agent server's finding says the layer mod, and is held to it", () => {
    // Since tool schema version 4 every place says its layer; a finding's and its fix's are the
    // mod's, and the comparison takes the layer off only once it has seen that.
    const noLayer = Object.fromEntries(Object.entries(agent).filter(([key]) => key !== 'layer'));
    assert.throws(() => fromAgent(noLayer), /a place of a finding is not the mod's/);
    assert.throws(() => fromAgent({ ...agent, layer: 'game' }), /not the mod's/);
    assert.throws(() => fromAgent({ ...agent, read_with: 'source' }), /not the mod's/);
    const gameEdit = {
        safety: 'safe',
        basis: 'nearest-name',
        alternatives: [
            {
                title: 'x',
                edits: [
                    {
                        layer: 'game',
                        file: 'events/a.txt',
                        line: 3,
                        column: 5,
                        end_line: 3,
                        end_column: 12,
                        new_text: 'x',
                        read_with: 'source',
                    },
                ],
            },
        ],
    };
    assert.throws(() => fromAgent({ ...agent, fix: gameEdit }), /not the mod's/);
});

test("the command line's JSON lines are read, the summary last", () => {
    const out = `${JSON.stringify({ ...core, source: 'engine', fix: null })}\n${JSON.stringify({ summary: { files_checked: 1 } })}\n`;
    const read = parseCliJson(out);
    assert.deepEqual(read.findings, [fromCore(core)]);
    assert.deepEqual(read.summary, { files_checked: 1 });
    assert.throws(() => parseCliJson(`${JSON.stringify(core)}\n`), /no summary/);
});

test('two lists that differ say which finding each has that the other has not, counting repeats', () => {
    const a = fromCore(core);
    const b = { ...a, line: 7 };
    assert.deepEqual(differences(sorted([a, b]), sorted([b, a]), ['left', 'right']), []);
    const diff = differences([a, a], [a, b], ['left', 'right']);
    assert.equal(diff.length, 2);
    assert.match(diff[0] ?? '', /^only left, not right: events\/a\.txt:3:5-3:10 error/);
    assert.match(diff[1] ?? '', /^only right, not left: events\/a\.txt:8:5/);
    assert.deepEqual(bySeverity([a, b, { ...a, severity: 'hint' }]), {
        error: 2,
        warning: 0,
        information: 0,
        hint: 1,
    });
});
