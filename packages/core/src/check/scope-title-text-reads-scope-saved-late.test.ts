import assert from 'node:assert/strict';
import { test } from 'node:test';
import { textScopeReads } from '../index/extract.js';
import { textScopeFormsFromSpec } from '../index/folders.js';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, textRow, titleRow } from './scope-title-text-reads-scope-saved-late.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = checkFixture('scope-title-text-reads-scope-saved-late-bad');
    assert.deepEqual(found, expectedFindings('scope-title-text-reads-scope-saved-late-bad'));
    assert.equal(found.filter((f) => f.code === CODE && f.severity === 'information').length, 2);
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('scope-title-text-reads-scope-saved-late-good'), []);
});

test(`${CODE} is advice: information, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'information');
    assert.equal(CHECK_KINDS[CODE].advice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE}: its keywords come from part D4, its text forms from part D9`, () => {
    const spec = committedSpec();
    assert.equal(titleRow(spec)?.keyword, 'title');
    assert.equal(textRow(spec)?.keyword, 'desc');
    const forms = textScopeFormsFromSpec(spec.data);
    // The confirmed head of a chain, and the measured-only functions; no form of status unknown.
    assert.equal(forms.heads, true);
    assert.deepEqual([...forms.functions.keys()].sort(), ['GetValue', 'sC', 'sTitle']);
    assert.equal(forms.conceptSuffix, 'E');
});

test(`${CODE}: what a text reads, by part D9's forms`, () => {
    const forms = textScopeFormsFromSpec(committedSpec().data);
    const cases: [string, string[]][] = [
        ['plain text', []],
        ['[friend.GetName] and [friend.GetHerHis]', ['friend', 'friend']],
        // A game concept is a key, not a saved name; a concept with a chain is not one word.
        ['[vassal|E] and [rival.GetName|U]', ['rival']],
        // A function's argument at its position, when it is one quoted word.
        ["[TopScope.sC('rival').GetName]", ['TopScope', 'rival']],
        ["[ROOT.Char.sC( 'x' )|U]", ['ROOT', 'x']],
        // An argument that is no quoted word, and a function D9 gives no saved name for.
        ["[TopScope.sC(GetName)] [TopScope.ScriptValue('v')]", ['TopScope', 'TopScope']],
        // Brackets in quotes are text; after an extra `[` nothing more is read.
        ["[F('a [b] c')] [x [y] [z]", []],
    ];
    for (const [text, want] of cases) {
        const got: string[] = [];
        textScopeReads(text, forms, (name, at) => {
            got.push(name);
            assert.equal(text.slice(at, at + name.length), name, text);
        });
        assert.deepEqual(got, want, text);
    }
});

test(`${CODE}: a title read nowhere, and an event that saves nothing late, are not judged`, () => {
    const text = [
        'namespace = fixture',
        'fixture.1 = {',
        '\ttitle = fixture.1.t',
        '\tdesc = fixture.1.d',
        '\toption = { name = fixture.1.a }',
        '}',
        '',
    ].join('\n');
    const found = checkText('events/x.txt', text, {}, { textScopeReads: () => ['x'] });
    assert.deepEqual(
        found.filter((f) => f.code === CODE),
        [],
    );
});
