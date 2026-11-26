import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    catalogueFromSpec,
    fillPlaceholders,
    FINDING_KINDS,
    findingMessage,
    placeholderCount,
    severityOf,
    type FindingId,
} from './findings.js';
import { parse } from './parser.js';
import { committedCatalogue, committedSpecPackage } from './testing.js';

const ids = Object.keys(FINDING_KINDS) as FindingId[];

test('every catalogue entry a finding names is in the committed spec, with its placeholders', () => {
    const catalogue = committedCatalogue();
    for (const id of ids) {
        const kind = FINDING_KINDS[id];
        if (kind.catalogue === null) {
            continue;
        }
        const text = catalogue.get(kind.catalogue);
        assert.ok(text !== undefined, `${id}: ${kind.catalogue} is not in the spec's catalogue`);
        assert.equal(placeholderCount(text), kind.slots.length, `${id}: placeholders`);
    }
});

test('the catalogue entries are those of the expected categories in the spec', () => {
    const spec = committedSpecPackage() as { errors: { id: string; category: string }[] };
    const category = new Map(spec.errors.map((e) => [e.id, e.category]));
    assert.equal(category.get('expected_after_arguments'), 'expected_brace_close');
    assert.equal(category.get('expected_between_equals_and_arguments'), 'expected_brace_open');
    assert.equal(category.get('expected_between_block_name_and_body'), 'expected_equals');
    assert.equal(category.get('unexpected_token_expected_key'), 'unexpected_token');
    assert.equal(category.get('unexpected_token_X_found_at_X_expected'), 'unexpected_token');
});

test('a finding with a catalogue message is an error; one without is information', () => {
    for (const id of ids) {
        const expected = FINDING_KINDS[id].catalogue === null ? 'information' : 'error';
        assert.equal(severityOf(id), expected, id);
    }
});

test("a finding carries the catalogue's text as evidence when the catalogue is supplied", () => {
    const [withText] = parse('a = {', { catalogue: committedCatalogue() }).findings;
    assert.deepEqual(withText?.evidence, {
        kind: 'catalogue',
        id: 'expected_after_arguments',
        text: 'Expected } after arguments',
    });
    const without = parse('a = {').findings[0];
    assert.ok(without !== undefined);
    assert.deepEqual(without.evidence, {
        kind: 'catalogue',
        id: 'expected_after_arguments',
        text: null,
    });
    assert.equal(
        findingMessage(without),
        'expected_after_arguments (the catalogue was not supplied)',
    );
});

test('a message names the place as <file>:<line>, or line <n> without a file', () => {
    const [finding] = parse('\n\ntitle text', { catalogue: committedCatalogue() }).findings;
    assert.ok(finding !== undefined);
    assert.equal(
        findingMessage(finding, { file: 'events/a.txt' }),
        "Unexpected token 'text' found at 'events/a.txt:3', '=' expected",
    );
    assert.equal(
        findingMessage(finding),
        "Unexpected token 'text' found at 'line 3', '=' expected",
    );
});

test('placeholders: printf conversions and {}; %% is a percent sign', () => {
    assert.equal(placeholderCount("Unexpected token '%s' found at '%s', '=' expected"), 2);
    assert.equal(placeholderCount("Event '{}' expected scope '{}', but got '{}'"), 3);
    assert.equal(placeholderCount("Data error in loc string '%.*s' %d%% %I64d"), 3);
    assert.equal(fillPlaceholders('%s and {} at %d%%', ['a', 'b']), 'a and b at %');
});

test('the catalogue is read from a package and ignores what is not an entry', () => {
    const catalogue = catalogueFromSpec({
        errors: [{ id: 'a', text: 'A' }, { id: 1, text: 'B' }, null, { id: 'c' }, 'd'],
    });
    assert.deepEqual([...catalogue], [['a', 'A']]);
    assert.equal(catalogueFromSpec(null).size, 0);
    assert.equal(catalogueFromSpec({ errors: 'no' }).size, 0);
});

test('a format 9 catalogue entry is read by its id and text; the keys format 5 added are not used', () => {
    const catalogue = catalogueFromSpec({
        package_format: 5,
        errors: [
            {
                id: 'expected_after_arguments',
                category: 'expected_brace_close',
                text: 'Expected } after arguments',
                since: '<=1.19.0.6',
                note: '',
                script_facing: 'unknown',
                reason: 'no rule matched',
                subject: 'unknown',
                subject_reason: 'no rule matched',
            },
        ],
    });
    assert.deepEqual([...catalogue], [['expected_after_arguments', 'Expected } after arguments']]);
    const spec = committedSpecPackage() as { package_format: number };
    assert.equal(spec.package_format, 9);
    // Format 9: 2,671 messages (2,023 of format 8, byte for byte but two subjects, and 648 more).
    assert.equal(committedCatalogue().size, 2671);
});

test('every finding is in the structured shape: id, severity, offsets, range, args, evidence', () => {
    const [finding] = parse('a = "open').findings;
    assert.deepEqual(Object.keys(finding ?? {}).sort(), [
        'args',
        'end',
        'evidence',
        'id',
        'range',
        'severity',
        'start',
    ]);
});

test('format 9: the catalogue holds the messages the blocked checks wait for', () => {
    const catalogue = committedCatalogue();
    // structure/triggered-desc-other-field (docs/decisions.md, row 74).
    assert.equal(
        catalogue.get('the_body_of_triggered_desc_can_only_take_desc_and_or_trigger'),
        'The body of triggered_desc can only take desc and/or trigger. %s',
    );
    // The localization reader's "Unterminated ..." messages (localization/unbalanced-brackets).
    const unterminated = [...catalogue].filter(([, text]) => text.includes('Unterminated'));
    assert.ok(unterminated.length >= 5, String(unterminated.length));
    assert.ok(unterminated.some(([, text]) => text.startsWith('Loc key `{}`: Unterminated')));
    assert.ok(
        unterminated.some(([, text]) => text === "Unterminated '[' when reading property '%.*s'"),
    );
});

test('format 9: two catalogue rows of format 8 changed their subject, and nothing reads a subject', () => {
    const errors = (committedSpecPackage() as { errors: { id: string; subject: string }[] }).errors;
    const subject = (id: string): string | undefined => errors.find((e) => e.id === id)?.subject;
    assert.equal(subject('invalid_court_position'), 'game_object');
    assert.equal(
        subject('attempt_to_destroy_an_court_position_that_is_already_invalid'),
        'game_object',
    );
});
