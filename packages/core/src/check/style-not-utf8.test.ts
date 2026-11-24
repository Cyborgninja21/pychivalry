import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { sameTree } from '../fix/encoding.js';
import { applyFixes } from '../fix/apply.js';
import { checkFixtureMod } from '../fix/testing.js';
import { REPO_ROOT } from '../spec/testing.js';
import { decodeScript } from '../syntax/decode.js';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './style-not-utf8.js';
import { expectedFindings, styleFixture } from './testing.js';

const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-not-utf8-bad');
    assert.deepEqual(found, expectedFindings('style-not-utf8-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.file]),
        [
            ['encoding/not-utf8', 'information', 'common/scripted_effects/fixture_effects.txt'],
            [CODE, 'warning', 'common/scripted_effects/fixture_effects.txt'],
            [CODE, 'warning', 'localization/english/fixture_l_english.yml'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-not-utf8-good'), []);
});

test(`${CODE} is a best-practice rule, at warning, beside the signed-off note encoding/not-utf8`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

/** The files of a mod as `check --fix` reads them, after the converting fix of each. */
function converted(mod: string, fallback?: 'windows-1252'): Map<string, string> {
    const dir = path.join(MODS, mod);
    const run = checkFixtureMod(dir, fallback);
    const fixes = run.findings.filter((f) => f.code === CODE);
    assert.ok(fixes.length > 0);
    for (const f of fixes) {
        assert.equal(f.fix?.safety, 'safe', f.file);
    }
    const read = (file: string): string | null => {
        const decoded = decodeScript(readFileSync(path.join(dir, ...file.split('/'))), {
            fallbackEncoding: fallback,
        });
        return `${decoded.bom ? '﻿' : ''}${decoded.text}`;
    };
    return new Map(
        applyFixes(
            fixes.flatMap((f) => f.fix?.alternatives ?? []),
            read,
        ).files,
    );
}

test('the fix writes the file as UTF-8 with the byte-order mark, read either way', () => {
    for (const fallback of [undefined, 'windows-1252'] as const) {
        const files = converted('style-not-utf8-bad', fallback);
        const good = (file: string): string =>
            readFileSync(path.join(MODS, 'style-not-utf8-good', ...file.split('/')), 'utf8');
        assert.equal(
            files.get('common/scripted_effects/fixture_effects.txt'),
            `﻿${good('common/scripted_effects/fixture_effects.txt')}`,
        );
        assert.equal(
            files.get('localization/english/fixture_l_english.yml'),
            good('localization/english/fixture_l_english.yml'),
        );
    }
});

test('on the fixture encoding-windows-1252 the fix is safe and converts all four bytes', () => {
    const files = converted('encoding-windows-1252');
    const text = files.get('history/titles/k_fixture.txt') ?? '';
    assert.ok(text.startsWith('﻿'));
    assert.equal(text.split('é').length - 1, 4);
    assert.ok(!text.includes('�'));
});

test('a byte that is no printable Windows-1252 character makes the fix a suggestion', () => {
    // 0x81 is one of the five bytes Windows-1252 leaves undefined: a control character.
    const dir = path.join(MODS, 'style-not-utf8-bad');
    const run = checkFixtureMod(dir, undefined, {
        'common/scripted_effects/fixture_effects.txt': new Uint8Array([
            ...new TextEncoder().encode('# x'),
            0x81,
            ...new TextEncoder().encode('\nfixture_effect = { add_gold = 1 }\n'),
        ]),
    });
    const fix = run.findings.find(
        (f) => f.code === CODE && f.file === 'common/scripted_effects/fixture_effects.txt',
    )?.fix;
    assert.equal(fix?.safety, 'suggestion');
});

test('the tree comparison tells a converted text that reads otherwise', () => {
    const stretch = { start: 1, end: 2, windows1252: 'é' };
    assert.equal(sameTree('a�b = c', 'aéb = c', [stretch]), true);
    // Were a stretch to read as a space, the key would split in two: not the same tree.
    assert.equal(sameTree('a�b = c', 'a b = c', [{ ...stretch, windows1252: ' ' }]), false);
});
