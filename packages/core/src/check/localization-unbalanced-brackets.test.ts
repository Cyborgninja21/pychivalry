import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { catalogueFromSpec, placeholderCount } from '../syntax/findings.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, EXTRA_CLOSE, extraBracket } from './localization-unbalanced-brackets.js';
import { checkFixture, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('localization-unbalanced-brackets-bad');
    assert.deepEqual(found, expectedFindings('localization-unbalanced-brackets-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['bracket']]),
        [
            [CODE, 'warning', '['],
            [CODE, 'warning', ']'],
        ],
    );
    assert.ok(found[0]?.message.includes('Unexpected extra `[` at position 24'));
    assert.ok(found[1]?.message.includes('Unexpected extra `]` at position 22'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('localization-unbalanced-brackets-good'), []);
});

test(`${CODE} rests on its two catalogue messages`, () => {
    const kind = CHECK_KINDS[CODE];
    assert.equal(kind.severity, 'warning');
    assert.equal(kind.catalogue, 'loc_key_X_unexpected_extra_at_position_X_file_X');
    assert.deepEqual(kind.alsoCatalogue, [EXTRA_CLOSE]);
    const catalogue = catalogueFromSpec(committedSpec().data);
    for (const id of [kind.catalogue, EXTRA_CLOSE]) {
        const text = catalogue.get(id);
        assert.ok(text?.startsWith('Loc key `{}`: Unexpected extra '), id);
        assert.equal(placeholderCount(text ?? ''), kind.slots.length);
    }
});

test(`${CODE}: where the first extra bracket is`, () => {
    const cases: [string, ReturnType<typeof extraBracket>][] = [
        ['plain text', undefined],
        ['[a] and [b]', undefined],
        ['[a [b]', { at: 3, close: false }],
        ['a] [b]', { at: 1, close: true }],
        ['[a]]', { at: 3, close: true }],
        // A statement left open is not reported: its message is not in the catalogue.
        ['[a', undefined],
        // Inside a statement, brackets in single quotes are text; a quote after `\` is escaped.
        ["[F( 'x [y] z' )]", undefined],
        ["[F( 'it\\\\'s [ok]' )]", undefined],
        // Outside a statement an apostrophe is text.
        ["it's ] here", { at: 5, close: true }],
    ];
    for (const [text, want] of cases) {
        assert.deepEqual(extraBracket(text), want, text);
    }
});
