/**
 * The committed real-mod corpus records (test/corpus/real-mods/<slug>.counts.json, written by
 * scripts/corpus-acceptance.js and the extension's corpus suite; the corpus itself is never
 * committed). Checks that each record is complete and self-consistent: both paths present,
 * counts add up, every error-severity finding classified, every false positive tracked by
 * an issue.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { packageRoot } from '../../src/spec/spec';

const DIR = path.join(packageRoot(), 'test', 'corpus', 'real-mods');
const SLUGS = ['balance-of-power-ui', 'divine-intervention', 'elf-destiny', 'rice', 'viet-events'];

interface CodeCount {
    severity: string;
    count: number;
}

interface Finding {
    file: string;
    line: number;
    code: string;
    classification: string;
    issue?: number;
}

interface PathRecord {
    counts: Record<string, CodeCount>;
    bySeverity: Record<string, number>;
    errors: Finding[];
}

function load(slug: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.counts.json`), 'utf8'));
}

describe('Real-mod corpus records', () => {
    for (const slug of SLUGS) {
        describe(slug, () => {
            const record = load(slug);
            for (const key of ['engine', 'editor']) {
                it(`${key} path: counts add up and every error is classified`, () => {
                    const r = record[key] as PathRecord | undefined;
                    assert.ok(r, `${key} record present`);
                    const errorCount = Object.values(r.counts)
                        .filter((c) => c.severity === 'error')
                        .reduce((a, c) => a + c.count, 0);
                    assert.strictEqual(errorCount, r.errors.length);
                    assert.strictEqual(r.bySeverity.error, r.errors.length);
                    for (const e of r.errors) {
                        assert.ok(
                            e.classification === 'real-defect' ||
                                e.classification === 'false-positive',
                            `${e.file}:${e.line} ${e.code} is ${e.classification}`
                        );
                        if (e.classification === 'false-positive') {
                            assert.ok(typeof e.issue === 'number', `${e.code} names its issue`);
                        }
                    }
                });
            }
            it('records the editor features smoke (2.3: colours, on-type, CK3 Explorer)', () => {
                const features = record.features as
                    | {
                          colors: { values: number } | null;
                          onType: { edits: unknown[] } | null;
                          tree: {
                              categories: Record<string, number>;
                              topRequestMs: number;
                              reveal: { ok: boolean } | null;
                          };
                      }
                    | undefined;
                assert.ok(features, 'features record present');
                if (features.colors) {
                    assert.ok(features.colors.values > 0, 'colour values found');
                }
                assert.ok(features.onType && Array.isArray(features.onType.edits));
                assert.ok(Object.keys(features.tree.categories).length > 0);
                for (const count of Object.values(features.tree.categories)) {
                    assert.ok(count > 0, 'empty categories are hidden');
                }
                assert.ok(typeof features.tree.topRequestMs === 'number');
                assert.strictEqual(features.tree.reveal?.ok, true);
            });
            it('records the editor-path budget (time to first full result, peak RSS)', () => {
                const editor = record.editor as Record<string, unknown>;
                assert.ok(typeof editor.timeToFirstFullResultMs === 'number');
                assert.ok(typeof editor.peakServerRssKb === 'number');
                const engine = record.engine as Record<string, unknown>;
                assert.ok(typeof engine.milliseconds === 'number');
                assert.ok(typeof engine.maxRssKb === 'number');
            });
        });
    }
});
