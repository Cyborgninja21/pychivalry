/**
 * A log analysed and tied to the mod's files (docs/PLAN.md items 11.3 and 11.4), on the hand-made
 * logs of `fixtures/logs/hand-made/` over the planted-defect mod and its game stub. Every line of
 * those logs is a catalogue message with values the mod gives it; they show what the matcher and
 * the ties do, not what the game writes, which no real log has shown yet (fixtures/logs/README.md).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { openWorkspace } from '../check/workspace.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { analyzeLog, LONGEST_LINE, logShape, LogShapeError, type LogReport } from './analyze.js';
import { logMatcher } from './matcher.js';

const spec = committedSpec();
const HAND_MADE = path.join(REPO_ROOT, 'fixtures', 'logs', 'hand-made');
const workspace = openWorkspace({
    spec,
    modDir: path.join(REPO_ROOT, 'fixtures', 'defects', 'mod'),
    gameDir: path.join(REPO_ROOT, 'fixtures', 'game', 'planted-defects', 'game'),
    cacheDir: null,
});

function log(name: string): Uint8Array {
    return readFileSync(path.join(HAND_MADE, name));
}

/** Each line's message and where it is tied, as `kind:layer:file:line[ name]`, by log line. */
function summary(report: LogReport): Map<number, { key: string; ties: string[] }> {
    const out = new Map<number, { key: string; ties: string[] }>();
    for (const m of report.messages) {
        for (const o of m.occurrences) {
            out.set(o.line, {
                key: m.key,
                ties: o.ties.map(
                    (t) =>
                        `${t.kind}:${t.layer}:${t.file}:${String(t.range.start.line + 1)}${t.line === null ? '' : `(${t.line})`}${t.name === null ? '' : ` ${t.name}`}`,
                ),
            });
        }
    }
    return out;
}

test('the hand-made log over the planted-defect mod: every line a message, tied where its values say', () => {
    const report = analyzeLog({ spec, index: workspace.index, log: log('planted-defects.log') });
    assert.deepEqual(report.lines, { total: 18, empty: 0, not_utf8: 0 });
    assert.deepEqual(report.totals, {
        matched: 17,
        ambiguous: 1,
        unmatched: 0,
        tied_to_mod: 14,
        tied_to_game: 1,
        not_tied: 2,
    });
    const s = summary(report);
    // An unknown name: where the mod writes it.
    assert.deepEqual(s.get(1), {
        key: 'unknown_trigger_X',
        ties: ['use:mod:events/harvest_events.txt:11 is_imprisonned'],
    });
    // The file and line the message gives, and the name of the message inside it, at that line.
    assert.deepEqual(s.get(3), {
        key: 'error_X_in_file_X_near_line_X',
        ties: [
            'file:mod:events/harvest_events.txt:39(message)',
            'use:mod:events/harvest_events.txt:39 harvest_give_alms_effect',
        ],
    });
    // A place written `at {}`: the file is found in it; the line is not known.
    assert.deepEqual(s.get(4), {
        key: 'unknown_modifier_type_X_at_X',
        ties: ['file:mod:common/culture/traditions/harvest_traditions.txt:1'],
    });
    // Two catalogue entries of one text: ambiguous, both named; a database's name is no name.
    assert.deepEqual(s.get(6), {
        key: 'failed_to_read_key_reference_X_from_database_X|failed_to_read_key_reference_X_from_database_X_2',
        ties: ['use:mod:common/on_action/harvest_on_actions.txt:6 harvest.0012'],
    });
    // A name defined twice: both definitions.
    assert.deepEqual(s.get(15)?.ties, [
        'definition:mod:events/harvest_court_events.txt:36 harvest.0002',
        'definition:mod:events/harvest_events.txt:51 harvest.0002',
    ]);
    // A file of the base game: its layer is the game's.
    assert.deepEqual(s.get(16)?.ties, [
        'file:game:common/culture/traditions/00_traditions.txt:1',
        'definition:game:common/culture/traditions/00_traditions.txt:2 tradition_agrarian',
    ]);
    // A scope type is no name: only the effect is looked up.
    assert.deepEqual(s.get(9)?.ties, [
        'use:mod:common/scripted_effects/harvest_effects.txt:28 add_county_modifier',
        'use:mod:events/harvest_events.txt:17 add_county_modifier',
    ]);
    // A texture no file of the index is, and a message of two lines whose values name nothing.
    assert.deepEqual(s.get(12)?.ties, []);
    assert.equal(s.get(17)?.key, 'failed_to_pick_default_activity_option_for_category_X_for_sc');
    const span = report.messages.find((m) => m.key === s.get(17)?.key)?.occurrences[0];
    assert.equal(span?.end_line, 18);
    assert.deepEqual(span.values, ['harvest_feast', 'character']);
    // The checks whose evidence the message is.
    assert.deepEqual(report.messages.find((m) => m.key === 'unknown_trigger_X')?.checks, [
        'names/unknown-trigger',
    ]);
    // The messages about the mod first.
    const order = report.messages.map((m) => m.key);
    assert.ok(order.indexOf('unknown_trigger_X') < order.indexOf('duplicate_item_X_at_X'));
});

test('the same answers whatever the line prefix: none, one not known, or one given', () => {
    const plain = analyzeLog({ spec, index: workspace.index, log: log('planted-defects.log') });
    const unknown = analyzeLog({
        spec,
        index: workspace.index,
        log: log('planted-defects-stand-in-prefix.log'),
    });
    const given = analyzeLog({
        spec,
        index: workspace.index,
        log: log('planted-defects-stand-in-prefix.log'),
        shape: logShape({ prefix: '^hand-made line \\d+ \\| ' }),
    });
    const strip = (r: LogReport): unknown =>
        r.messages.map((m) => ({
            ...m,
            occurrences: m.occurrences.map((o) => ({ ...o, before: undefined })),
        }));
    assert.deepEqual(strip(unknown), strip(plain));
    assert.deepEqual(strip(given), strip(plain));
    assert.deepEqual(unknown.totals, plain.totals);
    const first = unknown.messages.flatMap((m) => m.occurrences).find((o) => o.line === 1);
    assert.equal(first?.before, 'hand-made line 01 | ');
    assert.equal(given.shape.prefix, '^hand-made line \\d+ \\| ');
});

test('lines no message matches are listed as they are, never guessed at', () => {
    const report = analyzeLog({ spec, index: workspace.index, log: log('unmatched.log') });
    assert.deepEqual(
        report.unmatched.map((u) => [u.line, u.why]),
        [
            [1, 'no-message'],
            [2, 'no-message'],
            [3, 'no-message'],
        ],
    );
    assert.equal(report.totals.matched, 0);
    const long = analyzeLog({ spec, index: null, log: `${'x'.repeat(LONGEST_LINE + 1)}\n\n` });
    assert.deepEqual(
        long.unmatched.map((u) => u.why),
        ['too-long'],
    );
    assert.equal(long.lines.empty, 1);
});

test('every line of the hand-made logs is made from the catalogue', () => {
    const matcher = logMatcher(spec);
    for (const name of ['planted-defects.log', 'planted-defects-stand-in-prefix.log']) {
        const report = analyzeLog({ spec, index: null, log: log(name) });
        assert.equal(report.totals.unmatched, 0, name);
    }
    // The unmatched lines: a template with too little fixed text, filled; a text the package
    // marks as no message; and a catalogue message cut short.
    const [a, b, c] = readFileSync(path.join(HAND_MADE, 'unmatched.log'), 'utf8').split('\n');
    const byText = (pred: (text: string) => boolean): string[] =>
        matcher.templates.filter((t) => pred(t.text)).map((t) => t.id);
    assert.ok(byText((t) => t === 'ERROR: %s').length > 0 && a === 'ERROR: harvest');
    assert.equal(matcher.templates.find((t) => t.text === b)?.notMatched, 'not-a-message');
    const namespace = matcher.templates.find(
        (t) => t.id === 'namespace_X_used_in_event_X_file_X_is_not_defined_in_this_fi',
    );
    assert.ok(namespace !== undefined && c !== undefined && c.startsWith('Namespace '));
    assert.ok(
        namespace.text.startsWith(
            c
                .replace("'harvst'", "'{}'")
                .replace("'harvst.0004'", "'{}'")
                .replace('events/harvest_events.txt', '{}'),
        ),
    );
});

test('without an index nothing is tied, and every line is still matched', () => {
    const report = analyzeLog({ spec, index: null, log: log('planted-defects.log') });
    assert.equal(report.totals.matched, 17);
    assert.equal(report.totals.not_tied, 17);
});

test('the place format the user gives reads a line from an `at {}` value', () => {
    const report = analyzeLog({
        spec,
        index: workspace.index,
        log: "Unknown modifier type 'monthly_prestige_gain_mult' at common/culture/traditions/harvest_traditions.txt:12\n",
        shape: logShape({ location: '^(?<file>[^:]+):(?<line>\\d+)$' }),
    });
    const ties = report.messages[0]?.occurrences[0]?.ties ?? [];
    assert.equal(ties[0]?.line, 'location');
    assert.equal(ties[0].range.start.line, 11);
});

test('a shape that cannot be used is refused with why', () => {
    assert.throws(() => logShape({ prefix: '(' }), LogShapeError);
    assert.throws(() => logShape({ location: '(?<path>.+)' }), /group file/);
    assert.throws(() => logShape({ prefix: 'x'.repeat(201) }), /longer than/);
    assert.deepEqual(logShape({}), { prefix: null, location: null });
});
