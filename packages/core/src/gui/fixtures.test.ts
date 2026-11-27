/**
 * The GUI parser on its fixture pairs (docs/PLAN.md item 10.2): every mod `fixtures/mods/gui-*-bad`
 * gives exactly the findings and the tree its `expected.json` states, its good half
 * `gui-*-good` gives none, and every kind of GUI finding has its pair.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { FINDING_KINDS, findingMessage, type FindingId } from '../syntax/findings.js';
import { filesUnder, fixtureMods } from '../syntax/testing.js';
import { readGui } from './parser.js';
import { guiSummary } from './testing.js';

interface Expected {
    files: Record<
        string,
        {
            findings: {
                id: FindingId;
                severity: string;
                line: number;
                column: number;
                message: string;
            }[];
            tree: string;
        }
    >;
}

const mods = readdirSync(fixtureMods)
    .filter((name) => name.startsWith('gui-') && (name.endsWith('-bad') || name.endsWith('-good')))
    .sort();

const seen = new Set<FindingId>();

for (const mod of mods.filter((m) => m.endsWith('-bad'))) {
    const dir = path.join(fixtureMods, mod);
    const expected = JSON.parse(readFileSync(path.join(dir, 'expected.json'), 'utf8')) as Expected;
    test(`GUI fixture ${mod}`, () => {
        assert.deepEqual(Object.keys(expected.files).sort(), filesUnder(dir, '.gui').sort());
        for (const [file, want] of Object.entries(expected.files)) {
            const result = readGui(readFileSync(path.join(dir, file)));
            assert.deepEqual(
                result.findings.map((f) => ({
                    id: f.id,
                    severity: f.severity,
                    line: f.range.start.line + 1,
                    column: f.range.start.character + 1,
                    message: findingMessage(f, { file }),
                })),
                want.findings,
                file,
            );
            assert.equal(guiSummary(result.file.items), want.tree, file);
            for (const finding of want.findings) {
                seen.add(finding.id);
            }
        }
    });
}

for (const mod of mods.filter((m) => m.endsWith('-good'))) {
    test(`GUI fixture ${mod} has no finding`, () => {
        const dir = path.join(fixtureMods, mod);
        const files = filesUnder(dir, '.gui');
        assert.ok(files.length > 0, `${mod} has a GUI file`);
        for (const file of files) {
            assert.deepEqual(readGui(readFileSync(path.join(dir, file))).findings, [], file);
        }
        assert.equal(
            existsSync(path.join(dir, 'expected.json')),
            false,
            `${mod} has no expected.json`,
        );
    });
}

test("every kind of the GUI parser's findings has its fixture pair, named for it", () => {
    const kinds = (Object.keys(FINDING_KINDS) as FindingId[]).filter(
        (id) => FINDING_KINDS[id].reader === 'gui',
    );
    assert.equal(kinds.length, 13);
    for (const id of kinds) {
        const name = id.slice('syntax/gui-'.length);
        assert.ok(mods.includes(`gui-${name}-bad`), `gui-${name}-bad`);
        assert.ok(mods.includes(`gui-${name}-good`), `gui-${name}-good`);
    }
    assert.deepEqual(
        kinds.filter((id) => !seen.has(id)),
        [],
    );
});

test('each GUI fixture mod is game-shaped and explained', () => {
    for (const mod of mods) {
        const names = readdirSync(path.join(fixtureMods, mod));
        assert.ok(names.includes('descriptor.mod'), `${mod} has a descriptor.mod`);
        assert.ok(names.includes('README.md'), `${mod} has a README.md`);
        assert.ok(names.includes('gui'), `${mod} keeps its GUI file in gui/`);
    }
});
