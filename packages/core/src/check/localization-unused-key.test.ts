import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { unreadWords } from '../index/read-game.js';
import { fixtureIndex } from '../index/testing.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, implicitPatterns } from './localization-unused-key.js';
import { definedNamesOf } from './names.js';
import { checkFixture, expectedFindings } from './testing.js';

const GAME = 'event-targets-and-localization';

const ON = { game: GAME, unusedKeys: true } as const;

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('localization-unused-key-bad', ON);
    assert.deepEqual(found, expectedFindings('localization-unused-key-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['key']]),
        [[CODE, 'hint', 'fixture_unused_key']],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('localization-unused-key-good', ON), []);
});

test(`${CODE} is silent when no base game is read`, () => {
    assert.deepEqual(checkFixture('localization-unused-key-bad', { unusedKeys: true }), []);
});

test(`${CODE} is on by default (2026-11-23, replacing decision 76), and can be turned off`, () => {
    assert.deepEqual(
        checkFixture('localization-unused-key-bad', { game: GAME }),
        expectedFindings('localization-unused-key-bad'),
    );
    assert.deepEqual(
        checkFixture('localization-unused-key-bad', { game: GAME, unusedKeys: false }),
        [],
    );
    assert.equal(CHECK_KINDS[CODE].offByDefault, undefined);
    assert.equal(CHECK_KINDS[CODE].canTurnOff, true);
    assert.deepEqual(
        Object.entries(CHECK_KINDS)
            .filter(([, kind]) => kind.offByDefault === true)
            .map(([code]) => code),
        [],
        'no check is off by default',
    );
    assert.deepEqual(
        Object.entries(CHECK_KINDS)
            .filter(([, kind]) => kind.canTurnOff === true)
            .map(([code]) => code),
        [CODE],
        'the only check that can be turned off',
    );
});

test(`${CODE} is advice, at hint`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
    assert.equal(CHECK_KINDS[CODE].gameOutput, undefined);
});

test(`${CODE}: what counts as a use beside the index's words`, () => {
    const mod = 'localization-unused-key-bad';
    const index = fixtureIndex(GAME, mod);
    const words = unreadWords(path.join(REPO_ROOT, 'fixtures', 'mods', mod), index);
    // The interface file, which the index does not read.
    assert.ok(words.has('fixture_unused_in_gui'));
    assert.ok(!index.isUsed('fixture_unused_in_gui'));
    const names = definedNamesOf(index, { unreadWords: words });
    assert.equal(names.isUsed('fixture_unused_in_gui'), true);
    assert.equal(names.isUsed('fixture_unused_in_text'), true);
    assert.equal(names.isBaseGameLocalizationKey('fixture_base_replaced'), true);
    assert.equal(names.isUsed('fixture_unused_key'), false);
});

test(`${CODE}: a dotted key is used when a file writes it as one chain`, () => {
    const index = fixtureIndex(GAME, 'localization-unused-key-bad');
    // Written `custom_tooltip = fixture_unused.written_as_a_chain`: the index records the
    // chain's two segments, not the whole word.
    const key = 'fixture_unused.written_as_a_chain';
    assert.equal(index.isUsed(key), false);
    assert.equal(index.isUsedAsChain(key), true);
    assert.equal(index.isUsedAsChain('fixture_unused.written'), false);
    assert.equal(index.isUsedAsChain('written_as_a_chain.fixture_unused'), false);
    assert.equal(definedNamesOf(index).isUsed(key), true);
});

test(`${CODE}: every pattern of part D5, with one or two names`, () => {
    const patterns = implicitPatterns(committedSpec());
    assert.ok(patterns.length > 500);
    assert.ok(patterns.every((p) => p.holes.length === 1 || p.holes.length === 2));
    assert.ok(patterns.some((p) => p.first === 'decision_group_type_' && p.tail === ''));
});
