/**
 * `lookup`'s `evidence` (the owner's decision of 2026-11-25, tool schema version 5): off by
 * default, so that no answer grows unless it is asked; with one name, the core's readings of the
 * name whole, with the spec package's evidence behind each part, as the command line's `lookup
 * --json` prints them, every place in them written by the one place writer; as many as fit the
 * result, the rest counted with the characters they hold and what to ask, never cut silently;
 * refused with more than one name, saying how to ask. Every name of the spec package is answered
 * so within a result. That the readings are the command line's own is held by the extension's
 * same-answers test (`packages/vscode/src/source-answers.test.ts`).
 */

import {
    diskFileSource,
    lookup,
    openSpec,
    openWorkspace,
    type LookupResult,
    type SourceListing,
} from '@pychivalry/core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir } from './args.js';
import { withPlaces } from './places.js';
import { RESULT_BUDGET, sizeOf } from './result.js';
import { connect, GAMES, MODS, scratch } from './testing.js';
import {
    answerOf,
    EVIDENCE_ASK_FOLDER,
    EVIDENCE_ASK_NOTHING_SMALLER,
    evidenceOf,
    readingsIn,
} from './tools/lookup-answer.js';

const spec = openSpec(defaultSpecDir());
const GAME = path.join(GAMES, 'lookup', 'game');
const MOD = path.join(MODS, 'lookup-definitions-and-uses');

/** The core's answer of a name over the fixture's game and mod, as the server reads them. */
function coreLookup(name: string, language: string | null = null): LookupResult {
    const workspace = openWorkspace({ spec, gameDir: GAME, modDir: MOD, cacheDir: null });
    const listings: SourceListing[] = [];
    if (workspace.game !== null) {
        listings.push(workspace.game.listing);
    }
    if (workspace.mod !== null) {
        listings.push(workspace.mod);
    }
    return lookup(name, {
        spec,
        index: workspace.index,
        files: diskFileSource(listings),
        language,
    });
}

type Out = Record<string, unknown>;

function answers(out: Out): Out[] {
    return out['results'] as Out[];
}

test('off by default: no answer holds evidence unless it is asked, and asking changes nothing else', async (t) => {
    const dir = scratch(t);
    const s = await connect(t, ['--mod', MOD, '--vanilla', GAME], path.join(dir, 'cache'));
    const plain = await s.output('lookup', { names: ['monthly_prestige', 'is_adult'] });
    for (const answer of answers(plain)) {
        assert.ok(!('evidence' in answer), String(answer['name']));
    }
    const off = await s.output('lookup', { names: ['monthly_prestige'], evidence: false });
    assert.ok(!('evidence' in (answers(off)[0] ?? {})));
    const on = await s.output('lookup', { names: ['monthly_prestige'], evidence: true });
    const [withEvidence] = answers(on);
    assert.ok(withEvidence !== undefined);
    const { evidence, ...rest } = withEvidence;
    assert.ok(evidence !== undefined);
    assert.deepEqual(rest, answers(off)[0], 'the answer is otherwise the same');
});

test("one name's evidence is the core's readings whole, as lookup --json prints them, its places written as every place", async (t) => {
    const dir = scratch(t);
    const s = await connect(t, ['--mod', MOD, '--vanilla', GAME], path.join(dir, 'cache'));
    // Every reading of these fits; monthly_prestige is also a field of many folders, whose
    // readings come as far as they fit, the rest counted.
    const whole = ['is_adult', 'add_gold', 'county_opinion', 'no_such_name_at_all'];
    for (const name of [...whole, 'monthly_prestige']) {
        const out = await s.output('lookup', { names: [name], evidence: true });
        const evidence = answers(out)[0]?.['evidence'] as Out;
        const core = coreLookup(name);
        const written = JSON.parse(JSON.stringify(withPlaces(core.readings))) as Out[];
        const given = evidence['readings'] as Out[];
        assert.deepEqual(evidence['spec'], core.spec, name);
        assert.deepEqual(given, written.slice(0, given.length), name);
        assert.equal(evidence['readings_total'], core.readings.length, name);
        const left = evidence['left_out'] as Out | null;
        assert.equal(
            given.length + ((left?.['readings'] as number | undefined) ?? 0),
            written.length,
        );
        if (whole.includes(name)) {
            assert.equal(left, null, name);
        } else {
            assert.ok(left !== null && given.length > 0, name);
        }
        assert.ok(JSON.stringify(out).length <= RESULT_BUDGET, name);
    }
    // A modifier's localization in the base game: a place that says its layer and how to read it.
    const out = await s.output('lookup', {
        names: ['monthly_prestige'],
        evidence: true,
        language: 'l_english',
    });
    const text = JSON.stringify((answers(out)[0]?.['evidence'] as Out)['readings']);
    assert.match(
        text,
        /"layer":"game","file":"localization\/english\/fixture_modifiers_l_english\.yml","line":2,/,
    );
    assert.match(text, /"read_with":"source"/);
    assert.doesNotMatch(text, /"range"/, 'no place of the core is left as it was');
    // A removed name: the package's own record of its removal, with its evidence.
    const removed = await s.output('lookup', { names: ['county_opinion'], evidence: true });
    const readings = (answers(removed)[0]?.['evidence'] as Out)['readings'] as Out[];
    assert.ok(
        readings.some((r) => r['kind'] === 'retired'),
        'the removal is a reading',
    );
});

test('refused with more than one name, saying how to ask; one name given twice is one name', async (t) => {
    const dir = scratch(t);
    const s = await connect(t, ['--mod', MOD, '--vanilla', GAME], path.join(dir, 'cache'));
    const text = await s.error('lookup', { names: ['is_adult', 'add_gold'], evidence: true });
    assert.match(
        text,
        /^evidence: given with 2 names, and it is given for one name a call\. Ask lookup with that one name and evidence true, once for each name whose evidence you need, and look the other names up in one call without evidence$/,
    );
    const twice = await s.output('lookup', { names: ['is_adult', 'is_adult'], evidence: true });
    assert.equal(answers(twice).length, 1);
    assert.ok('evidence' in (answers(twice)[0] ?? {}));
});

test('evidence too large for one result: as many readings as fit, the rest counted and how to ask, never cut silently', async (t) => {
    const dir = scratch(t);
    const s = await connect(t, ['--mod', MOD, '--vanilla', GAME], path.join(dir, 'cache'));
    // `effect` is a trigger, an effect and a field of more than a hundred folders.
    const core = coreLookup('effect');
    const written = core.readings.map((r) => JSON.parse(JSON.stringify(withPlaces(r))) as Out);
    const out = await s.output('lookup', { names: ['effect'], evidence: true });
    assert.ok(JSON.stringify(out).length <= RESULT_BUDGET);
    const evidence = answers(out)[0]?.['evidence'] as Out;
    const given = evidence['readings'] as Out[];
    const left = evidence['left_out'] as Out;
    assert.ok(given.length > 0 && given.length < written.length, `${String(given.length)} given`);
    assert.deepEqual(given, written.slice(0, given.length), 'whole readings, from the first');
    assert.equal(evidence['readings_total'], written.length);
    assert.equal(left['readings'], written.length - given.length);
    assert.equal(
        left['characters'],
        written.slice(given.length).reduce((n, r) => n + JSON.stringify(r).length, 0),
    );
    assert.equal(left['ask'], EVIDENCE_ASK_FOLDER);
    // With a folder, the field readings of that folder only, as the answer has them.
    const folder = 'common/decisions';
    const narrowed = await s.output('lookup', { names: ['effect'], evidence: true, folder });
    const inFolder = answers(narrowed)[0]?.['evidence'] as Out;
    const kept = readingsIn(core.readings, folder);
    assert.equal(inFolder['readings_total'], kept.length);
    assert.deepEqual(inFolder['readings'], JSON.parse(JSON.stringify(withPlaces(kept))));
    assert.equal(inFolder['left_out'], null);
});

test('every name of the spec package: its evidence fits one result beside its answer, whole readings from the first, the rest counted', () => {
    const names = new Set<string>();
    for (const bucket of Object.values(spec.data.buckets)) {
        for (const name of Object.keys(bucket)) {
            names.add(name);
        }
    }
    const walk = (
        fields: Readonly<Record<string, { readonly fields?: unknown }>> | undefined,
    ): void => {
        for (const [name, field] of Object.entries(fields ?? {})) {
            names.add(name);
            walk(
                field.fields as Readonly<Record<string, { readonly fields?: unknown }>> | undefined,
            );
        }
    };
    for (const directory of Object.values(spec.data.schema)) {
        walk(directory.fields);
    }
    for (const name of Object.keys(spec.data.scope_types)) {
        names.add(name);
    }
    let whole = 0;
    let cut = 0;
    for (const name of names) {
        const core = lookup(name, { spec, suggestions: false });
        const { answer } = answerOf(core, null, null);
        const build = (evidence: Out): Out => ({
            results: [{ ...answer, evidence }],
            not_answered: null,
            notes: [],
        });
        const evidence = evidenceOf(core, null, (e) => sizeOf(build(e)) <= RESULT_BUDGET);
        assert.ok(sizeOf(build(evidence)) <= RESULT_BUDGET, name);
        const given = evidence['readings'] as unknown[];
        const left = evidence['left_out'] as Out | null;
        assert.equal(
            given.length + ((left?.['readings'] as number | undefined) ?? 0),
            core.readings.length,
            name,
        );
        if (left === null) {
            whole++;
        } else {
            cut++;
            assert.ok(
                left['ask'] === EVIDENCE_ASK_FOLDER || left['ask'] === EVIDENCE_ASK_NOTHING_SMALLER,
                name,
            );
        }
    }
    assert.ok(names.size > 10_000, 'the whole spec package');
    assert.ok(whole > cut, `${String(whole)} whole, ${String(cut)} with readings left out`);
});
