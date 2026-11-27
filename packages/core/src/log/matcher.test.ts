/**
 * The matcher (docs/PLAN.md item 11.3), on every template of the committed catalogue: a line made
 * from each, with no prefix, after a stand-in prefix no game writes, and with that prefix taken
 * off, finds the template (alone, or with the templates listed as its equals) and gives back its
 * values. Then the cases a rule exists for: the best match, a message inside a message, a line
 * that splits two ways, the lines it must not match.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { catalogueCoverage, sampleLine, STAND_IN_PREFIX } from './coverage.js';
import { logMatcher, type LineMatch } from './matcher.js';

const spec = committedSpec();
const matcher = logMatcher(spec);

function ids(m: LineMatch): string[] {
    return m.kind === 'matched' ? m.candidates.map((c) => c.template.id) : [];
}

test('every matched template is found on a line made from it, with or without a prefix, its values given back', () => {
    const coverage = catalogueCoverage(spec);
    const equals = new Map<string, readonly string[]>();
    for (const group of coverage.ambiguous) {
        for (const id of group) {
            equals.set(id, group);
        }
    }
    let tried = 0;
    const unsure = new Set<string>();
    for (const t of matcher.templates) {
        if (t.notMatched !== null) {
            continue;
        }
        tried++;
        const { text, values } = sampleLine(t);
        const lines = text.split('\n');
        const cases: LineMatch[] =
            lines.length > 1
                ? [
                      matcher.matchSpan(lines),
                      matcher.matchSpan([STAND_IN_PREFIX + (lines[0] ?? ''), ...lines.slice(1)]),
                      matcher.matchSpan(lines, true),
                  ]
                : [
                      matcher.match(text),
                      matcher.match(STAND_IN_PREFIX + text),
                      matcher.match(text, true),
                  ];
        for (const [i, m] of cases.entries()) {
            // Its own id, and no other but those listed as its equals (one of a pair may be
            // alone on its own line and matched as well on the other's: `at%s`, `at %s`).
            const found = ids(m);
            const group = equals.get(t.id) ?? [t.id];
            assert.ok(found.includes(t.id), `${t.id}, case ${String(i)}: ${found.join()}`);
            assert.ok(
                found.every((id) => group.includes(id)),
                `${t.id}, case ${String(i)}: ${found.join()}`,
            );
            assert.ok(m.kind === 'matched');
            const own = m.candidates.find((c) => c.template.id === t.id);
            // With the start of the message not known, a first value holds the prefix too.
            const first = t.parts[0];
            const leading = first?.kind === 'value' && first.conversion === 'text';
            const expectedValues =
                i === 1 && leading
                    ? [STAND_IN_PREFIX + (values[0] ?? ''), ...values.slice(1)]
                    : values;
            // Values the line splits two ways (two text values side by side) are marked so.
            if (own?.split === 'one') {
                assert.deepEqual(
                    own.values.map((v) => v.trim()),
                    expectedValues.map((v) => v.trim()),
                    `${t.id}, case ${String(i)}`,
                );
            } else {
                unsure.add(t.id);
            }
            assert.equal(own?.before, i === 1 && !leading ? STAND_IN_PREFIX : '', t.id);
            assert.equal(own.startsWithValue, leading && i !== 2, t.id);
        }
    }
    assert.equal(tried, 2108);
    // Exactly those with two values side by side, which no line can split for sure.
    const adjacent = matcher.templates.filter((t) => t.notMatched === null && t.adjacentValues);
    assert.deepEqual([...unsure].sort(), adjacent.map((t) => t.id).sort());
});

test('the matcher on the catalogue: every template alone or with its listed equals, none shadowed, none lost', () => {
    const c = catalogueCoverage(spec);
    assert.equal(c.entries, 2671);
    assert.equal(c.matched, 2108);
    assert.deepEqual(c.notFound, []);
    assert.deepEqual(c.shadowed, []);
    assert.equal(c.alone + c.ambiguous.reduce((n, g) => n + g.length, 0), c.matched);
    assert.equal(c.ambiguous.length, 17);
    for (const group of c.ambiguous) {
        assert.ok(group.length >= 2);
    }
    // Two entries of one text, and two that differ only in a value written against another.
    assert.ok(
        c.ambiguous.some(
            (g) => g.join() === 'unknown_gfx_culture_flag_X,unknown_gfx_culture_flag_X_2',
        ),
    );
    assert.ok(c.ambiguous.some((g) => g.join() === 'missing_loc_key_for_X,missing_loc_key_for_XX'));
    assert.equal(
        c.families.reduce((n, f) => n + f.entries, 0),
        2671,
    );
});

test('the template that accounts for most of the line is the message', () => {
    const m = matcher.match(
        `Error: "Unknown trigger 'fixture_x'" in file: "events/fixture.txt" near line: 7`,
    );
    assert.deepEqual(ids(m), ['error_X_in_file_X_near_line_X']);
    assert.ok(m.kind === 'matched');
    assert.deepEqual(m.best.values, ["Unknown trigger 'fixture_x'", 'events/fixture.txt', '7']);
    // The message inside it is matched too.
    assert.equal(m.inner?.value, 0);
    assert.deepEqual(m.inner.match.kind === 'matched' ? ids(m.inner.match) : [], [
        'unknown_trigger_X',
    ]);
});

test('a line that splits into the values two ways is unsure', () => {
    const m = matcher.match('Wrong scope for effect: a, expected b, expected c');
    assert.ok(m.kind === 'matched');
    assert.equal(m.best.template.id, 'wrong_scope_for_effect_X_expected_X');
    assert.equal(m.best.split, 'unsure');
    const sure = matcher.match('Wrong scope for effect: add_gold, expected character');
    assert.ok(sure.kind === 'matched');
    assert.equal(sure.best.split, 'one');
});

test('a whole number must be a number; a line ending past the message is not that message', () => {
    assert.equal(
        matcher.match("Unexpected token 'x' at line seven and column 2 in events/a.txt").kind ===
            'matched' &&
            ids(
                matcher.match("Unexpected token 'x' at line seven and column 2 in events/a.txt"),
            ).includes('unexpected_token_X_at_line_X_and_column_X_in_X'),
        false,
    );
    // The message must end the line: a message cut short, or followed by text, is not it.
    assert.ok(!ids(matcher.match("Unknown trigger 'a' and more")).includes('unknown_trigger_X'));
});

test('text the package marks as no message, and too little fixed text, match nothing', () => {
    assert.equal(
        matcher.match('Log a string to the *error* log followed by a stack trace.').kind,
        'unmatched',
    );
    assert.equal(matcher.match('ERROR: harvest').kind, 'unmatched');
    assert.equal(matcher.match('').kind, 'unmatched');
});
