/**
 * Every fix is checked by construction (docs/MVP.md, "Tests per feature", row "Quick fixes"):
 * on every fixture mod with a defect in it (the checks' bad fixtures, the parser's fixtures and
 * the fixes' own), every alternative of every fix is applied to a copy of the mod, and the one
 * runner checked again: the finding goes, and no error or warning comes in. Every code whose
 * fix is not "none" has at least one fix proved here.
 */

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PAIR_GAMES } from '../check/testing.js';
import { FIX_ROWS } from './registry.js';
import { checkMod, fixturePath, proveAlternative, stubGame } from './testing.js';

/**
 * The fixture mods with defects to fix, by their path under `fixtures/`: the planted-defect
 * mod, which has every error and warning code, and the mods of `fixtures/mods/`.
 */
const MODS = [
    'defects/mod',
    ...readdirSync(fixturePath('mods'))
        .filter(
            (name) => name.endsWith('-bad') || name.startsWith('parse-') || name.startsWith('fix-'),
        )
        .sort()
        .map((name) => `mods/${name}`),
];

/** The game stub a fixture mod is read over: its pair's, or the planted-defect mod's. */
function gameOf(mod: string): string {
    const pair = mod.replace(/^mods\//, '').replace(/-bad$/, '');
    return stubGame(PAIR_GAMES[pair] ?? 'planted-defects');
}

const proved = new Map<string, { safe: number; suggestion: number }>();

for (const mod of MODS) {
    test(`every fix on ${mod} takes its finding away and brings no error or warning`, () => {
        const dir = fixturePath(mod);
        const game = gameOf(mod);
        const before = checkMod(dir, game).findings;
        const problems: string[] = [];
        for (const finding of before) {
            if (finding.fix === null) {
                continue;
            }
            assert.ok(
                finding.fix.alternatives.length > 0,
                `${finding.code}: a fix with no alternative`,
            );
            if (finding.fix.safety === 'safe') {
                assert.equal(
                    finding.fix.alternatives.length,
                    1,
                    `${finding.code}: a safe fix has one alternative`,
                );
            }
            const seen = proved.get(finding.code) ?? { safe: 0, suggestion: 0 };
            seen[finding.fix.safety]++;
            proved.set(finding.code, seen);
            for (const alternative of finding.fix.alternatives) {
                problems.push(...proveAlternative(dir, game, finding, alternative, before));
            }
        }
        assert.deepEqual(problems, []);
    });
}

test('every code with a fix has one proved on a fixture', () => {
    const missing = Object.entries(FIX_ROWS)
        .filter(([code, row]) => row.offer !== 'none' && !proved.has(code))
        .map(([code]) => code);
    assert.deepEqual(missing, []);
    for (const [code, seen] of proved) {
        const offer = FIX_ROWS[code as keyof typeof FIX_ROWS].offer;
        if (offer === 'safe') {
            assert.equal(seen.suggestion, 0, `${code} is always safe`);
        }
        if (offer === 'suggestion') {
            assert.equal(seen.safe, 0, `${code} is never safe`);
        }
    }
});

test('every code without a fix has none on any fixture', () => {
    for (const [code] of proved) {
        assert.notEqual(FIX_ROWS[code as keyof typeof FIX_ROWS].offer, 'none', code);
    }
});
