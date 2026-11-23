import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inventoryRows } from '../check/inventory.js';
import { applyEdits, applyFixes, joinBom, splitBom } from './apply.js';
import {
    MAX_FIX_ALTERNATIVES,
    rangesOverlap,
    suggestion,
    type FindingFix,
    type FixAlternative,
    type FixEdit,
} from './fix.js';
import { oneSlip } from './near-name.js';
import { FIX_ROWS } from './registry.js';
import { verifySafeFixes, type Counted } from './verify.js';

function edit(file: string, sl: number, sc: number, el: number, ec: number, text: string): FixEdit {
    return {
        file,
        range: { start: { line: sl, character: sc }, end: { line: el, character: ec } },
        new_text: text,
    };
}

test('edits are applied against the text as it was, insertions at one place in order', () => {
    const text = 'a = b\nc = d\n';
    assert.equal(
        applyEdits(text, [
            edit('f', 0, 4, 0, 5, 'x'),
            edit('f', 1, 0, 1, 0, 'y'),
            edit('f', 1, 0, 1, 0, 'z'),
        ]),
        'a = x\nyzc = d\n',
    );
    assert.throws(
        () => applyEdits(text, [edit('f', 0, 0, 0, 3, ''), edit('f', 0, 2, 0, 4, '')]),
        /overlap/,
    );
    // A position past the end of a line is its end; past the last line, the end of the text.
    assert.equal(
        applyEdits('ab\r\ncd', [edit('f', 0, 9, 0, 9, '!'), edit('f', 7, 0, 7, 0, '?')]),
        'ab!\r\ncd?',
    );
});

test('a file keeps its byte-order mark; a created file is its text whole', () => {
    assert.deepEqual(splitBom('\ufeffl_english:\n'), { text: 'l_english:\n', bom: true });
    assert.equal(joinBom({ text: 'x', bom: true }), '\ufeffx');
    const files = new Map([['loc/a_l_english.yml', '\ufeffl_english:\n a:0 "a"\n']]);
    const read = (file: string): string | null => files.get(file) ?? null;
    const append: FixAlternative = {
        title: 'append',
        edits: [edit('loc/a_l_english.yml', 2, 0, 2, 0, ' b:0 "b"\n')],
    };
    const create: FixAlternative = {
        title: 'create',
        edits: [
            {
                ...edit('loc/new_l_english.yml', 0, 0, 0, 0, '\ufeffl_english:\n c:0 "c"\n'),
                create: true,
            },
        ],
    };
    const again: FixAlternative = {
        title: 'again',
        edits: [
            {
                ...edit('loc/new_l_english.yml', 0, 0, 0, 0, '\ufeffl_english:\n d:0 "d"\n'),
                create: true,
            },
        ],
    };
    const result = applyFixes([append, create, again], read);
    assert.equal(result.files.get('loc/a_l_english.yml'), '\ufeffl_english:\n a:0 "a"\n b:0 "b"\n');
    assert.equal(result.files.get('loc/new_l_english.yml'), '\ufeffl_english:\n c:0 "c"\n');
    assert.deepEqual(
        result.skipped.map((a) => a.title),
        ['again'],
        'a file is created once',
    );
});

test('two spans overlap unless one ends where the other starts; insertions only inside a span', () => {
    const r = (sc: number, ec: number) => ({
        start: { line: 0, character: sc },
        end: { line: 0, character: ec },
    });
    assert.equal(rangesOverlap(r(0, 3), r(3, 5)), false);
    assert.equal(rangesOverlap(r(0, 3), r(2, 5)), true);
    assert.equal(rangesOverlap(r(2, 2), r(0, 5)), true);
    assert.equal(rangesOverlap(r(0, 0), r(0, 5)), false);
    assert.equal(rangesOverlap(r(4, 4), r(4, 4)), false);
});

test('a suggestion is bounded: at most MAX_FIX_ALTERNATIVES, the count of all of them given', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ title: String(i), edits: [] }));
    const fix = suggestion('nearest-name', many);
    assert.equal(fix?.alternatives.length, MAX_FIX_ALTERNATIVES);
    assert.equal(fix.alternatives_total, 9);
    assert.equal(suggestion('nearest-name', []), null);
    assert.equal(suggestion('nearest-name', many.slice(0, 2))?.alternatives_total, undefined);
});

test('every code of this build has a fix row, and a fixer exactly when it offers one', () => {
    assert.deepEqual(
        inventoryRows()
            .map((r) => r.code)
            .sort(),
        Object.keys(FIX_ROWS).sort(),
    );
    for (const [code, row] of Object.entries(FIX_ROWS)) {
        assert.equal(row.fixer !== undefined, row.offer !== 'none', code);
        assert.ok(row.what.endsWith('.'), `${code}: a sentence`);
    }
});

const SAFE = (file: string, text: string, at: number): FindingFix => ({
    safety: 'safe',
    basis: 'nearest-name',
    alternatives: [{ title: text, edits: [edit(file, 0, at, 0, at + 1, text)] }],
});

test('safe fixes that pass together stay safe; one that brings an error is a suggestion', () => {
    const findings: Counted[] = [
        { code: 'names/unknown-trigger', severity: 'error' },
        { code: 'names/unknown-trigger', severity: 'error' },
    ];
    const fixes = [SAFE('f', 'X', 0), SAFE('f', 'Y', 2)];
    // The check again: an X takes a finding away, a Y brings a scope error.
    const recheck = (text: string): Counted[] => [
        ...(text.includes('X') ? [] : [findings[0] as Counted]),
        ...(text.includes('Y')
            ? [{ code: 'scope/wrong-scope-for-trigger' as const, severity: 'error' as const }]
            : [findings[1] as Counted]),
    ];
    const out = verifySafeFixes('f', 'a b c', findings, fixes, recheck);
    assert.equal(out[0]?.safety, 'safe');
    assert.equal(out[1]?.safety, 'suggestion');
    const fine = verifySafeFixes('f', 'a b c', findings, fixes, (text) =>
        text.includes('X') && text.includes('Y') ? [] : findings,
    );
    assert.deepEqual(
        fine.map((f) => f?.safety),
        ['safe', 'safe'],
    );
});

test('a safe fix that overlaps another, or edits another file, is a suggestion', () => {
    const findings: Counted[] = [
        { code: 'names/unknown-trigger', severity: 'error' },
        { code: 'names/unknown-trigger', severity: 'error' },
        { code: 'names/unknown-trigger', severity: 'error' },
    ];
    const out = verifySafeFixes(
        'f',
        'abc',
        findings,
        [SAFE('f', 'X', 0), SAFE('f', 'Y', 0), SAFE('g', 'Z', 0)],
        () => [findings[1] as Counted, findings[2] as Counted],
    );
    assert.deepEqual(
        out.map((f) => f?.safety),
        ['safe', 'suggestion', 'suggestion'],
    );
});

test('a safe near name is one slip away: a letter added, left out or changed, two swapped, the case', () => {
    assert.equal(oneSlip('is_imprisonned', 'is_imprisoned'), true);
    assert.equal(oneSlip('add_piety_experiance', 'add_piety_experience'), true);
    assert.equal(oneSlip('primary_spose', 'primary_spouse'), true);
    assert.equal(oneSlip('is_adlut', 'is_adult'), true);
    assert.equal(oneSlip('IS_ADULT', 'is_adult'), true);
    assert.equal(oneSlip('heritage_levantine', 'heritage_byzantine'), false);
    assert.equal(oneSlip('fixture_idel', 'fixture_idle'), true);
    assert.equal(oneSlip('fixture_idel', 'fixture_ilde'), false);
    assert.equal(oneSlip('abcd', 'acbe'), false);
    assert.equal(oneSlip('abc', 'abcde'), false);
});
