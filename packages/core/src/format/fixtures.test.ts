/**
 * Every fixture mod (`fixtures/mods/`) and the planted-defect mod (`fixtures/defects/`) are in
 * pychivalry's format, on the owner's word of 2026-11-23: Windows line breaks, the byte-order
 * mark and the layout the formatter writes. The exceptions are exactly what a fixture exists to
 * test, each kept byte for byte (fixtures/README.md, rule 7):
 *
 * - a file with a parse error, which the formatter leaves as it is (the `parse-*` fixtures, and
 *   the planted mod's syntax defects);
 * - a file that is not valid UTF-8 (`encoding-windows-1252`, `style-not-utf8-bad`, the planted
 *   mod's `style/not-utf8` defect);
 * - the bad half of each `style/` pair, written to break one rule;
 * - three localization files written without the byte-order mark, to show what the game does
 *   without it: in the format but for the mark;
 * - the planted mod's formatting defect.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from '../spec/testing.js';
import { formatKindOf, formatText } from './index.js';

/** Files that are not valid UTF-8, on purpose. */
const NOT_UTF8 = new Set([
    'fixtures/mods/encoding-windows-1252/history/titles/k_fixture.txt',
    'fixtures/mods/style-not-utf8-bad/common/scripted_effects/fixture_effects.txt',
    'fixtures/mods/style-not-utf8-bad/localization/english/fixture_l_english.yml',
    'fixtures/defects/mod/common/modifiers/harvest_modifiers.txt',
]);

/** Localization files written without the byte-order mark, on purpose: in the format but for it. */
const NO_MARK = new Set([
    'fixtures/mods/localization-missing-key-bad/localization/english/fixture_loc_no_bom_l_english.yml',
    'fixtures/mods/localization-missing-key-good/localization/english/fixture_loc_no_bom_l_english.yml',
    'fixtures/mods/override-rules/localization/english/fixture_no_bom_l_english.yml',
]);

/** Other files written out of the format, on purpose. */
const PLANTED = new Set(['fixtures/defects/mod/events/harvest_market_events.txt']);

function filesUnder(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
}

test('every fixture mod and the planted-defect mod are in the format, but for what each exists to test', () => {
    const out: string[] = [];
    let formatted = 0;
    for (const root of ['fixtures/mods', 'fixtures/defects']) {
        for (const full of filesUnder(path.join(REPO_ROOT, root))) {
            const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
            const kind = formatKindOf(rel);
            if (kind === undefined || /^fixtures\/mods\/style-[a-z0-9-]+-bad\//.test(rel)) {
                continue;
            }
            const bytes = readFileSync(full);
            let text: string;
            try {
                text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
            } catch {
                if (!NOT_UTF8.has(rel)) {
                    out.push(`${rel}: not valid UTF-8`);
                }
                continue;
            }
            if (NOT_UTF8.has(rel)) {
                out.push(`${rel}: listed as not UTF-8, but it is`);
            }
            const marked = NO_MARK.has(rel);
            if (marked && text.startsWith('\uFEFF')) {
                out.push(`${rel}: listed as written without the mark, but it has it`);
            }
            const result = formatText(marked ? `\uFEFF${text}` : text, kind);
            if (result.left !== null) {
                // A parse error: the formatter leaves the file as it is.
                assert.ok(result.left.id.startsWith('syntax/'), rel);
                continue;
            }
            if (PLANTED.has(rel) !== result.changed) {
                out.push(
                    PLANTED.has(rel)
                        ? `${rel}: its planted formatting defect is gone`
                        : `${rel}: not in the format`,
                );
            }
            formatted++;
        }
    }
    assert.deepEqual(out, []);
    assert.ok(formatted > 250, `${String(formatted)} files in the format`);
});
