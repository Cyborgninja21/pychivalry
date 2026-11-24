/**
 * The best-practice rules' fixes and the formatter agree: on each of their bad fixtures, which
 * are in pychivalry's format but for what they test, the fixes of the rule's findings applied
 * (as `check --fix` applies a safe one, and a person a suggestion) leave a file the formatter
 * finds nothing in, and the finding gone.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from '../spec/testing.js';
import { applyToMod, checkFixtureMod, copyMod } from '../fix/testing.js';
import { CHECK_KINDS, type CheckCode } from './finding.js';

const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');

const formatting = (code: string): boolean =>
    code in CHECK_KINDS && CHECK_KINDS[code as CheckCode].formattingRules === true;

for (const [pair, code] of [
    ['style-empty-block-bad', 'style/empty-block'],
    ['style-unusual-field-order-bad', 'style/unusual-field-order'],
    ['style-not-utf8-bad', 'style/not-utf8'],
] as const) {
    test(`${pair}: after the fixes of ${code} the formatter finds nothing`, () => {
        const copy = copyMod(path.join(MODS, pair));
        const before = checkFixtureMod(copy).findings.filter((f) => f.code === code);
        const alternatives = before.flatMap((f) => f.fix?.alternatives.slice(0, 1) ?? []);
        assert.ok(alternatives.length > 0, 'a fix to apply');
        applyToMod(copy, alternatives);
        const after = checkFixtureMod(copy).findings;
        assert.deepEqual(
            after.filter((f) => formatting(f.code)).map((f) => `${f.file} ${f.code}`),
            [],
        );
        assert.equal(
            after.filter((f) => f.code === code).length,
            before.length - alternatives.length,
        );
    });
}

test('style-deep-nesting-bad has no fix, and the formatter finds nothing in it', () => {
    const run = checkFixtureMod(path.join(MODS, 'style-deep-nesting-bad'));
    assert.ok(run.findings.some((f) => f.code === 'style/deep-nesting' && f.fix === null));
    assert.deepEqual(
        run.findings.filter((f) => formatting(f.code)),
        [],
    );
});
