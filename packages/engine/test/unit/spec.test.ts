/**
 * Spec loader and typed API.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';

import {
    defaultSpec,
    fillPlaceholders,
    loadSpec,
    packageRoot,
    Spec,
    SpecValidationError,
    UnknownMessageError,
    validateSpecPackage,
} from '../../src/spec';

const VENDORED = path.join(packageRoot(), 'spec', 'ck3-spec-1.20.0.2.json.gz');

describe('Spec loader', () => {
    let spec: Spec;

    before(() => {
        spec = defaultSpec();
    });

    it('loads the vendored package and verifies its checksum', () => {
        const vendored = loadSpec(VENDORED);
        assert.strictEqual(vendored.version(), '1.20.0.2');
    });

    it('loads the bundled package once per process', () => {
        assert.strictEqual(defaultSpec(), spec);
        assert.strictEqual(spec.version(), '1.20.0.2');
    });

    it('has the documented bucket sizes', () => {
        const sizes = {
            triggers: spec.names('triggers').length,
            effects: spec.names('effects').length,
            links: spec.names('links').length,
            lists: spec.names('lists').length,
            on_actions: spec.names('on_actions').length,
            modifiers: spec.names('modifiers').length,
        };
        assert.deepStrictEqual(sizes, {
            triggers: 1442,
            effects: 1011,
            links: 283,
            lists: 355,
            on_actions: 203,
            modifiers: 609,
        });
    });

    it('rejects a package whose checksum does not match', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-spec-'));
        try {
            const json = zlib.gunzipSync(fs.readFileSync(VENDORED));
            fs.writeFileSync(
                path.join(dir, 'ck3-spec-x.json'),
                Buffer.concat([json, Buffer.from(' ')])
            );
            fs.copyFileSync(
                path.join(packageRoot(), 'spec', 'ck3-spec-1.20.0.2.sha256'),
                path.join(dir, 'ck3-spec-x.sha256')
            );
            assert.throws(() => loadSpec(path.join(dir, 'ck3-spec-x.json')), /sha256/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('rejects a structurally invalid package with every problem listed', () => {
        const broken: unknown = JSON.parse(zlib.gunzipSync(fs.readFileSync(VENDORED)).toString());
        if (typeof broken !== 'object' || broken === null || !('retired' in broken)) {
            assert.fail('vendored package is not an object');
        }
        delete broken.retired;
        Object.assign(broken, { package_format: 2 });
        try {
            validateSpecPackage(broken);
            assert.fail('expected a validation error');
        } catch (e) {
            assert.ok(e instanceof SpecValidationError);
            assert.ok(e.problems.some((p) => p.includes("'retired'")));
            assert.ok(e.problems.some((p) => p.startsWith('package_format')));
        }
    });

    describe('lookups', () => {
        it('has(name, bucket) and bucketsOf(name)', () => {
            assert.ok(spec.has('is_alive', 'triggers'));
            assert.ok(!spec.has('is_alive', 'effects'));
            assert.ok(spec.has('add_gold', 'effects'));
            assert.deepStrictEqual(spec.bucketsOf('not_a_keyword_at_all'), []);
            assert.ok(spec.bucketsOf('custom_tooltip').includes('triggers'));
            assert.ok(spec.bucketsOf('custom_tooltip').includes('effects'));
            assert.ok(spec.multiBucket('custom_tooltip'));
        });

        it('doc(name, bucket?) returns the engine documentation', () => {
            const doc = spec.doc('add_gold', 'effects');
            assert.ok(typeof doc === 'string');
            assert.strictEqual(spec.doc('add_gold'), doc);
            assert.strictEqual(spec.doc('add_gold', 'links'), undefined);
            assert.strictEqual(spec.doc('not_a_keyword_at_all'), undefined);
        });

        it('isIterator uses the lists bucket, never links', () => {
            assert.deepStrictEqual(spec.isIterator('any_vassal'), {
                prefix: 'any_',
                base: 'vassal',
            });
            assert.deepStrictEqual(spec.isIterator('ordered_child'), {
                prefix: 'ordered_',
                base: 'child',
            });
            assert.strictEqual(spec.isIterator('every_liege'), undefined); // liege is a link
            assert.strictEqual(spec.isIterator('random_fake_scope'), undefined);
            assert.strictEqual(spec.listBase('every_vassal'), 'vassal');
            assert.strictEqual(spec.iteratorPrefix('random_fake_scope'), 'random_');
        });

        it('isModifier: static table, then %s templates', () => {
            assert.strictEqual(spec.isModifier('monthly_income_mult'), 'static');
            assert.strictEqual(spec.isModifier('stationed_heavy_infantry_damage_mult'), 'template');
            assert.strictEqual(spec.isModifier('mountains_advantage'), 'template');
            assert.strictEqual(spec.isModifier('not_a_modifier_at_all_mult_x'), undefined);
        });

        it('directoryOf uses the longest matching directory', () => {
            assert.strictEqual(spec.directoryOf('events/my_events.txt')?.content_type, 'event');
            assert.strictEqual(
                spec.directoryOf('common/decisions/sub/x.txt')?.path,
                'common/decisions'
            );
            assert.strictEqual(
                spec.directoryOf('common\\court_positions\\types\\x.txt')?.path,
                'common/court_positions/types'
            );
            assert.strictEqual(spec.directoryOf('README.txt'), undefined);
        });

        it('schemaOf returns the per-directory schema', () => {
            const decisions = spec.schemaOf('common/decisions');
            assert.ok(decisions);
            assert.strictEqual(decisions.fields.is_shown.kind, 'trigger_block');
            assert.strictEqual(decisions.fields.effect.kind, 'effect_block');
            assert.ok(decisions.fields.widget.fields?.setup_items);
        });

        it('message() fills %s, {}, %d and %.*s in order', () => {
            assert.strictEqual(spec.message('unknown_trigger_X', 'foo'), "Unknown trigger 'foo'");
            assert.strictEqual(
                spec.message('unknown_modifier_type_X_at_X', 'm', 'f.txt:3'),
                "Unknown modifier type 'm' at f.txt:3"
            );
            assert.strictEqual(
                fillPlaceholders('a %s b {} c %d d %.*s', ['1', '2', 3, '4']),
                'a 1 b 2 c 3 d 4'
            );
            assert.throws(() => spec.message('no_such_message_id'), UnknownMessageError);
        });

        it('retired() names the replacement', () => {
            assert.deepStrictEqual(spec.retired('on_character_faith_change')?.replacement, [
                'on_rite_change',
                'on_county_rite_change',
            ]);
            assert.strictEqual(spec.retired('activate_holy_site')?.replacement, null);
            assert.strictEqual(spec.retired('add_gold'), undefined);
        });

        it('scopeValidity reads the (empty) slot', () => {
            assert.deepStrictEqual(spec.data.scope_validity, {});
            assert.strictEqual(spec.scopeValidity('is_alive'), undefined);
        });
    });
});
