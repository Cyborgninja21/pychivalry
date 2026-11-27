/**
 * The catalogue read as templates (docs/PLAN.md item 11.3), on every entry of the committed spec
 * package: each text read back from its pieces, its placeholders counted as the syntax layer
 * counts them, what its values stand for read from the message's own words, and which templates
 * are not matched and why.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { placeholderCount } from '../syntax/findings.js';
import { templateOf, type LogTemplate } from './templates.js';

const spec = committedSpec();
const templates = spec.data.errors.map(templateOf);

function byId(id: string): LogTemplate {
    const t = templates.find((x) => x.id === id);
    assert.ok(t !== undefined, id);
    return t;
}

function roles(t: LogTemplate): string[] {
    return t.parts.flatMap((p) => (p.kind === 'value' ? [p.role] : []));
}

test('every catalogue entry is a template whose pieces give back its text', () => {
    assert.equal(templates.length, 2671);
    for (const t of templates) {
        const back = t.parts.map((p) => (p.kind === 'fixed' ? p.text : p.written)).join('');
        assert.equal(back, t.text.trim().replaceAll('%%', '%'), t.id);
    }
});

test('every template has the placeholders the syntax layer counts in its text', () => {
    for (const t of templates) {
        assert.equal(t.values, placeholderCount(t.text.trim()), t.id);
        assert.equal(t.parts.filter((p) => p.kind === 'value').length, t.values, t.id);
    }
});

test("a value's role comes from the message's own words: line, column, and <file>:<line>", () => {
    assert.deepEqual(roles(byId('unexpected_token_X_at_line_X_and_column_X_in_X')), [
        'text',
        'line',
        'column',
        'text',
    ]);
    assert.deepEqual(roles(byId('error_X_in_file_X_near_line_X')), ['text', 'text', 'line']);
    const child = byId('child_X_already_exists_added_at_X_X_duplicate_children_with');
    assert.deepEqual(roles(child), ['text', 'text', 'line']);
    const line = child.parts.filter((p) => p.kind === 'value')[2];
    assert.ok(line?.kind === 'value' && line.lineOf === 1);
    // `{}` after the word line is a line all the same.
    assert.deepEqual(roles(byId('invalid_landed_title_name_X_in_X_line_X')), [
        'text',
        'text',
        'line',
    ]);
    assert.deepEqual(roles(byId('unknown_trigger_X')), ['text']);
});

test('a template the package marks as no message is not matched, nor one with too little fixed text', () => {
    let notAMessage = 0;
    let tooLittle = 0;
    for (const t of templates) {
        const words = t.parts
            .flatMap((p) => (p.kind === 'fixed' ? [p.text] : []))
            .join('')
            .match(/[A-Za-z]{3,}/g);
        if (t.subject === 'not_a_message') {
            assert.equal(t.notMatched, 'not-a-message', t.id);
            notAMessage++;
        } else if ((words ?? []).length < 2) {
            assert.equal(t.notMatched, 'too-little-fixed-text', t.id);
            tooLittle++;
        } else {
            assert.equal(t.notMatched, null, t.id);
        }
    }
    assert.equal(notAMessage, 520);
    assert.equal(tooLittle, 43);
});

test('a message whose text holds a newline spans that many more lines', () => {
    const spans = templates.filter((t) => t.lines > 1 && t.notMatched === null).map((t) => t.id);
    assert.deepEqual(spans.sort(), [
        'assertion_failure_at_X_X_X_triggered_X_X_X',
        'effect_X_at_X_no_seed_set_in_top_scope_caller_should_seed_to',
        'failed_to_pick_default_activity_option_for_category_X_for_sc',
    ]);
    // A trailing newline is the text's edge, not a second line.
    assert.equal(byId('event_X_is_marked_as_letter_but_doesn_t_has_a_sender').lines, 1);
});
