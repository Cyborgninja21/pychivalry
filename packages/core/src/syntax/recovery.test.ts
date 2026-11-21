/**
 * Error recovery on the broken-input fixtures (docs/PLAN.md item 2.5): every mod under
 * `fixtures/mods/parse-*` gives exactly the findings and the tree its `expected.json` states,
 * and every kind of parse finding has at least one such fixture.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { FINDING_KINDS, findingMessage, type FindingId } from './findings.js';
import { readScript } from './read.js';
import { committedCatalogue, filesUnder, fixtureMods, summary } from './testing.js';

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
            tree?: string;
        }
    >;
}

const mods = readdirSync(fixtureMods)
    .filter((name) => name.startsWith('parse-'))
    .sort();

const seen = new Set<FindingId>();

for (const mod of mods) {
    const dir = path.join(fixtureMods, mod);
    const expected = JSON.parse(readFileSync(path.join(dir, 'expected.json'), 'utf8')) as Expected;
    test(`recovery fixture ${mod}`, () => {
        assert.deepEqual(Object.keys(expected.files).sort(), filesUnder(dir, '.txt').sort());
        for (const [file, want] of Object.entries(expected.files)) {
            const result = readScript(readFileSync(path.join(dir, file)), {
                catalogue: committedCatalogue(),
            });
            assert.deepEqual(
                result.allFindings.map((f) => ({
                    id: f.id,
                    severity: f.severity,
                    line: f.range.start.line + 1,
                    column: f.range.start.character + 1,
                    message: findingMessage(f, { file }),
                })),
                want.findings,
                file,
            );
            if (want.tree !== undefined) {
                assert.equal(summary(result.file.items), want.tree, file);
            }
            for (const finding of want.findings) {
                seen.add(finding.id);
            }
        }
    });
}

test('every kind of parse finding has a broken-input fixture', () => {
    const kinds = (Object.keys(FINDING_KINDS) as FindingId[]).filter((id) =>
        id.startsWith('syntax/'),
    );
    assert.deepEqual(
        kinds.filter((id) => !seen.has(id)),
        [],
    );
    assert.ok(mods.includes('parse-cut-off-mid-edit'), 'text cut off mid-edit has a fixture');
});

test('each fixture mod is game-shaped and explained', () => {
    for (const mod of mods) {
        const names = readdirSync(path.join(fixtureMods, mod));
        assert.ok(names.includes('descriptor.mod'), `${mod} has a descriptor.mod`);
        assert.ok(names.includes('README.md'), `${mod} has a README.md`);
    }
});
