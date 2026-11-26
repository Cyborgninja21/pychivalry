/**
 * The re-proof of the advice checks (advice-proof.ts) on a stub game written in the test: it
 * reads the game's script files with the game's own index, counts what each row applies to
 * and fires on, and gives each row its verdict.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { ADVICE_CHECKS, openSpec, BEST_PRACTICE_CHECKS } from '@pychivalry/core';
import { adviceProof, MIN_APPLIES, proofText, styleVerdictOf, verdictOf } from './advice-proof.js';
import { fixtureGame, tempDir, writeTree } from './testing.js';
import { repoRoot } from './util.js';

const spec = openSpec(path.join(repoRoot(), 'spec'));

test('a row holds when it applies to at least 10 and fires on none', () => {
    assert.equal(verdictOf(MIN_APPLIES, 0), 'holds');
    assert.equal(verdictOf(MIN_APPLIES - 1, 0), 'too-few');
    assert.equal(verdictOf(500, 1), 'fires');
});

test('a style rule follows when the base game breaks it at most as often as it follows it', () => {
    assert.equal(styleVerdictOf(10, 5), 'follows');
    assert.equal(styleVerdictOf(10, 6), 'broken');
    assert.equal(styleVerdictOf(0, 0), 'follows');
});

test('every advice check has a row, with what it judged and what it found', (t) => {
    const root = tempDir(t);
    const game = fixtureGame(root);
    const events: string[] = ['namespace = stub'];
    for (let i = 1; i <= 12; i++) {
        events.push(`stub.${String(i)} = { hidden = yes }`);
    }
    events.push('stub.13 = { }');
    writeTree(root, {
        'game/events/stub_events.txt': `${events.join('\n')}\n`,
        'game/common/scripted_effects/stub_effects.txt': 'stub_effect = { if = { } else = { } }\n',
    });
    const proof = adviceProof(spec, game, 'linux');
    assert.deepEqual(
        proof.rows.map((r) => r.code),
        [
            ...[...ADVICE_CHECKS, ...BEST_PRACTICE_CHECKS].map((c) => c.code),
            'style/localization-key-characters',
        ],
    );
    const empty = proof.rows.find((r) => r.code === 'structure/event-empty');
    assert.equal(empty?.applies, 13);
    assert.equal(empty.fires, 1);
    assert.equal(empty.verdict, 'fires');
    assert.deepEqual(empty.findings, [
        {
            file: 'events/stub_events.txt',
            line: 14,
            message: "The event 'stub.13' is empty.",
        },
    ]);
    const twice = proof.rows.find((r) => r.code === 'structure/event-several-immediate');
    assert.equal(twice?.applies, 13);
    assert.equal(twice.verdict, 'holds');
    const orphan = proof.rows.find((r) => r.code === 'structure/else-without-if');
    assert.equal(orphan?.applies, 1);
    assert.equal(orphan.verdict, 'too-few');
    // The best-practice rules, with their rate and their counts by folder.
    const empty2 = proof.rows.find((r) => r.code === 'style/empty-block');
    assert.equal(empty2?.kind, 'style');
    assert.equal(empty2.applies, 2);
    assert.equal(empty2.fires, 2);
    assert.equal(empty2.verdict, 'broken');
    assert.deepEqual(empty2.byFolder, [
        { folder: 'common/scripted_effects', applies: 2, fires: 2 },
    ]);
    // By the fix each finding is offered, and by what its data says the place means: an effect
    // written with an empty block is never offered for removal (decision 167).
    assert.deepEqual(empty2.byFix, [{ name: 'none', fires: 2 }]);
    assert.deepEqual(empty2.byMeaning, [{ name: 'effect', fires: 2 }]);
    const deep = proof.rows.find((r) => r.code === 'style/deep-nesting');
    assert.deepEqual([deep?.byFix, deep?.byMeaning], [[], []]);
    assert.deepEqual([twice.byFix, twice.byMeaning], [[], []]);
    const text = proofText(proof);
    assert.match(text, /^ {2}fixes offered: none 2$/m);
    assert.match(text, /^ {2}what they mean: effect 2$/m);
    assert.match(text, /^structure\/event-empty: applies to 13, fires on 1: fires$/m);
    assert.match(text, /^style\/empty-block: applies to 2, fires on 2 \(100\.00%\): broken$/m);
    assert.match(text, /^ {2}common\/scripted_effects: applies to 2, fires on 2 \(100\.00%\)$/m);
    assert.match(text, /^ {2}events\/stub_events\.txt:14: The event 'stub\.13' is empty\.$/m);
});
