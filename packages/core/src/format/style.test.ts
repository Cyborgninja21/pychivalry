/**
 * The style findings (`style.ts`): every edit the formatter would make is some hint's, each hint's
 * fix moves the file toward the format and never away from it, the warning's fix formats the
 * whole file, and a file in the format, or one with a parse error, has none.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from '../spec/testing.js';
import { formatText } from './index.js';
import { applyFormatEdits, type FormatKind } from './result.js';
import { styleOf, type StylePlace } from './style.js';

const BOM = '\uFEFF';

/** A text with the mark apart, as the runner gives it. */
function split(text: string): { body: string; bom: boolean } {
    return text.startsWith(BOM) ? { body: text.slice(1), bom: true } : { body: text, bom: false };
}

/** The file written back after a fix: its body edited, the mark as a fix's U+FEFF makes it. */
function fixed(body: string, bom: boolean, place: StylePlace): string {
    const out = applyFormatEdits(body, place.edits);
    return (bom ? BOM : '') + out;
}

const DIR = path.join(REPO_ROOT, 'fixtures', 'format');
const inputs = readdirSync(DIR)
    .filter((f) => f.includes('.before.'))
    .map((f) => ({
        name: f,
        kind: (f.endsWith('.yml') ? 'localization' : 'script') as FormatKind,
        text: readFileSync(path.join(DIR, f), 'utf8'),
    }));

for (const input of inputs) {
    test(`style on ${input.name}: the warning's fix formats the file, each hint's fix moves toward it`, () => {
        const { body, bom } = split(input.text);
        const formatted = formatText(input.text, input.kind);
        const places = styleOf(input.kind, body, bom);
        if (formatted.left !== null || formatted.text === input.text) {
            assert.deepEqual(places, [], 'a file in the format, or left as it is, has none');
            return;
        }
        const warnings = places.filter((p) => p.code === 'style/not-formatted');
        assert.equal(warnings.length, 1, 'one warning a file');
        const warning = warnings[0] as StylePlace;
        assert.equal(fixed(body, bom, warning), formatted.text, "the warning's fix");
        const hints = places.filter((p) => p.code !== 'style/not-formatted');
        assert.ok(hints.length > 0);
        for (const hint of hints) {
            const once = fixed(body, bom, hint);
            assert.notEqual(once, input.text, `${hint.code}: its fix changes the file`);
            assert.equal(
                formatText(once, input.kind).text,
                formatted.text,
                `${hint.code} at ${String(hint.start)}: its fix moves toward the format`,
            );
            const again = split(once);
            const left = styleOf(input.kind, again.body, again.bom).filter(
                (p) => p.code === hint.code,
            );
            assert.ok(
                left.length < hints.filter((h) => h.code === hint.code).length,
                `${hint.code} at ${String(hint.start)}: its finding goes`,
            );
        }
    });
}

test('every edit of the formatter belongs to some hint', () => {
    // Applying every hint's fix, one at a time from the last, gives the formatted file.
    for (const input of inputs) {
        let text = input.text;
        for (let round = 0; round < 500; round++) {
            const { body, bom } = split(text);
            const hints = styleOf(input.kind, body, bom).filter(
                (p) => p.code !== 'style/not-formatted',
            );
            const last = hints[hints.length - 1];
            if (last === undefined) {
                break;
            }
            text = fixed(body, bom, last);
        }
        assert.equal(text, formatText(input.text, input.kind).text, input.name);
    }
});
