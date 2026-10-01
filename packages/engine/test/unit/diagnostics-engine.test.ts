/**
 * Unit tests for the diagnostics pipeline (ported from the extension's
 * diagnostics-engine.test.ts).
 *
 * Ported: "Phase 1: Parse error diagnostics" and "Phase 3: Scope validation for event
 * files" (the false-positive cases), with the same inputs; the assertion is now that the
 * engine reports no registry diagnostic for those keys. Not ported: "Phase 5: Convention
 * checks", "Phase 6: Localization checks", "maxDiagnostics limit" and "configuration":
 * they test per-system validators that Phase 4 wraps as plug-ins.
 */

import * as assert from 'assert';

import { Diagnostic, registeredPluginCount } from '../../src/diagnostics';
import { check, codes, event, newWorkspace, VIRTUAL_ROOT } from '../helpers/engine';
import { diagnose } from '../../src/diagnostics';
import { Workspace } from '../../src/index/workspace';
import { packageRoot } from '../../src/spec/spec';
import * as path from 'path';

function registry(diags: Diagnostic[]): Diagnostic[] {
    return diags.filter((d) => d.code === 'unknown_trigger_X' || d.code === 'unknown_effect_X');
}

function mentions(diags: Diagnostic[], ...names: string[]): Diagnostic[] {
    return diags.filter((d) => names.some((n) => d.message.includes(`'${n}'`)));
}

describe('DiagnosticsEngine', () => {
    describe('Phase 1: Parse error diagnostics', () => {
        it('should convert parse errors to diagnostics', () => {
            const diags = check('bad_key', 'events/test.txt');
            const parseErrors = diags.filter(
                (d) => d.code === 'unexpected_token_X_found_at_X_expected'
            );
            assert.ok(parseErrors.length > 0, 'Should have parse error diagnostics');
            assert.strictEqual(parseErrors[0].source, 'engine');
            assert.strictEqual(parseErrors[0].severity, 'error');
        });

        it('should produce no diagnostics for valid code', () => {
            const diags = check('name = test', 'common/test.txt');
            assert.deepStrictEqual(diags, []);
        });
    });

    describe('Phase 3: Scope validation for event files', () => {
        it('should not flag event structural fields as invalid effects', () => {
            const text = [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\ttitle = my_mod.0001.t',
                '\tdesc = my_mod.0001.desc',
                '\toption = {',
                '\t\tname = my_mod.0001.a',
                '\t}',
                '}',
            ].join('\n');
            const falsePositives = mentions(check(text), 'type', 'title', 'desc', 'name');
            assert.deepStrictEqual(falsePositives, []);
        });

        it('should not flag event trigger block as invalid effect', () => {
            const text = [
                'my_mod.0002 = {',
                '\ttype = character_event',
                '\ttitle = my_mod.0002.t',
                '\tdesc = my_mod.0002.desc',
                '\ttrigger = {',
                '\t}',
                '\toption = {',
                '\t\tname = my_mod.0002.a',
                '\t}',
                '}',
            ].join('\n');
            assert.deepStrictEqual(mentions(check(text), 'trigger'), []);
        });

        it('should not flag triggers inside limit blocks as invalid effects', () => {
            const text = event(
                [],
                [
                    'if = {',
                    '\tlimit = {',
                    '\t\tis_alive = yes',
                    '\t\tis_adult = yes',
                    '\t}',
                    '\tadd_gold = 100',
                    '}',
                ]
            );
            assert.deepStrictEqual(registry(check(text)), []);
        });

        it('should not flag parameters of compound effects like add_opinion', () => {
            const text = event(
                [],
                ['add_opinion = {', '\tmodifier = grateful', '\ttarget = root', '}']
            );
            assert.deepStrictEqual(registry(check(text)), []);
        });

        it('should not flag trait names in stress_impact as invalid effects', () => {
            const text = [
                'my_mod.0005 = {',
                '\ttype = character_event',
                '\toption = {',
                '\t\tname = my_mod.0005.a',
                '\t\tstress_impact = {',
                '\t\t\tambitious = -10',
                '\t\t\tcontent = 10',
                '\t\t}',
                '\t}',
                '}',
            ].join('\n');
            assert.deepStrictEqual(registry(check(text)), []);
        });

        it('should not flag effect containers like hidden_effect as invalid', () => {
            const text = event([], ['hidden_effect = {', '\tadd_gold = 100', '}']);
            assert.deepStrictEqual(registry(check(text)), []);
        });

        it('should not flag logical operators AND/OR/NOT as invalid triggers', () => {
            const text = event([
                'AND = { is_alive = yes }',
                'OR = { is_adult = yes }',
                'NOT = { is_imprisoned = yes }',
            ]);
            assert.deepStrictEqual(registry(check(text)), []);
        });
    });

    describe('Registry checks', () => {
        it('unknown trigger / unknown effect with the engine texts', () => {
            const diags = check(event(['fake_trigger_xyz = yes'], ['fake_effect_xyz = yes']));
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.message, d.range.start.line]),
                [
                    ['unknown_trigger_X', "Unknown trigger 'fake_trigger_xyz'", 6],
                    ['unknown_effect_X', "Unknown effect 'fake_effect_xyz'", 9],
                ]
            );
        });

        it('effect used in trigger context and trigger used in effect context', () => {
            const diags = check(event(['add_gold = 5'], ['is_alive = yes']));
            assert.deepStrictEqual(codes(diags), ['unknown_trigger_X', 'unknown_effect_X']);
        });

        it('names in both buckets are accepted in either context', () => {
            const diags = check(
                event(['custom_tooltip = { text = x is_alive = yes }'], ['custom_tooltip = x'])
            );
            assert.deepStrictEqual(diags, []);
        });

        it('iterators: unknown base and prefix misuse', () => {
            const diags = check(
                event(
                    [
                        'any_vassal = { is_alive = yes }',
                        'any_fake_list = { }',
                        'every_vassal = { }',
                    ],
                    ['every_vassal = { add_gold = 1 }', 'any_vassal = { }']
                )
            );
            assert.deepStrictEqual(
                diags.map((d) => d.message),
                [
                    "Unknown trigger 'any_fake_list'",
                    "Unknown trigger 'every_vassal'",
                    "Unknown effect 'any_vassal'",
                ]
            );
        });

        it('iterator parameters are accepted only in their iterators', () => {
            const ok = check(event(['any_held_title = { title_tier = county }']));
            assert.deepStrictEqual(ok, []);
            const bad = check(event(['any_vassal = { title_tier = county }']));
            assert.deepStrictEqual(codes(bad), ['unknown_trigger_X']);
        });

        it('workspace scripted effects, triggers, lists and values are not unknown', () => {
            const diags = check(
                event(
                    ['my_trigger = yes', 'any_my_list = { }', 'my_value > 5'],
                    ['my_effect = { X = 1 }', 'every_my_list = { }']
                ),
                'events/test.txt',
                {
                    'common/scripted_triggers/t.txt': 'my_trigger = { is_alive = yes }',
                    'common/scripted_effects/e.txt': 'my_effect = { add_gold = $X$ }',
                    'common/scripted_lists/l.txt': 'my_list = { base = vassal }',
                    'common/script_values/v.txt': 'my_value = { value = 1 }',
                }
            );
            assert.deepStrictEqual(diags, []);
        });

        it('a scripted effect is still unknown in trigger context', () => {
            const diags = check(event(['my_effect = yes']), 'events/test.txt', {
                'common/scripted_effects/e.txt': 'my_effect = { add_gold = 1 }',
            });
            assert.deepStrictEqual(codes(diags), ['unknown_trigger_X']);
        });

        it('file-local scripted triggers are known in the same file', () => {
            const text = `scripted_trigger local_check = { is_alive = yes }\n${event(['local_check = yes'])}`;
            assert.deepStrictEqual(check(text), []);
        });

        it('retired keywords name their replacement', () => {
            const diags = check(
                event([], ['set_state_faith = faith:catholic', 'activate_holy_site = x'])
            );
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.message]),
                [
                    [
                        'PYCH-R001',
                        "'set_state_faith' was removed in CK3 1.20.0.2; use set_state_rite instead",
                    ],
                    [
                        'PYCH-R002',
                        "'activate_holy_site' was removed in CK3 1.20.0.2 and has no replacement (holy sites are now created and removed, not activated: see create_holy_site, remove_holy_site, add_holy_site, make_holy_site_eminent)",
                    ],
                ]
            );
        });

        describe('keyword templates', () => {
            const baseGame = (): Workspace =>
                new Workspace(VIRTUAL_ROOT, {
                    vanilla: path.join(
                        packageRoot(),
                        'test',
                        'fixtures',
                        'engine-test-mods',
                        'unknown_effect'
                    ),
                });
            const run = (
                ws: Workspace,
                text: string,
                others: Record<string, string>
            ): Diagnostic[] => {
                for (const [file, content] of Object.entries(others)) {
                    ws.indexFile(path.join(VIRTUAL_ROOT, file), content);
                }
                return diagnose(ws, path.join(VIRTUAL_ROOT, 'events/test.txt'), { text });
            };
            const relations = {
                'common/scripted_relations/r.txt': 'friend = { opposites = { rival } }',
            };

            it('has_relation_friend is accepted when the workspace defines friend', () => {
                const diags = run(
                    baseGame(),
                    event(
                        ['has_relation_friend = root', 'num_of_relation_friend > 1'],
                        ['set_relation_friend = root', 'remove_relation_friend = root']
                    ),
                    relations
                );
                assert.deepStrictEqual(diags, []);
            });

            it('a fill that is not a key of the database is unknown with a base game', () => {
                const diags = run(
                    baseGame(),
                    event(['has_relation_not_a_relation_xyz = root'], ['add_gold = 1']),
                    relations
                );
                assert.deepStrictEqual(
                    diags.map((d) => d.message),
                    ["Unknown trigger 'has_relation_not_a_relation_xyz'"]
                );
            });

            it('(template, keys) is the identity: %s_perks from two databases', () => {
                const diags = run(
                    baseGame(),
                    event(
                        [
                            'diplomacy_lifestyle_perks > 1',
                            'kin_legacy_track_perks > 1',
                            'kin_legacy_track_xp > 1',
                        ],
                        ['add_diplomacy_lifestyle_xp = 10', 'add_kin_legacy_track_xp = 10']
                    ),
                    {
                        'common/lifestyles/l.txt': 'diplomacy_lifestyle = { }',
                        'common/dynasty_legacies/d.txt': 'kin_legacy_track = { }',
                    }
                );
                // %s_xp and add_%s_xp are filled from common/lifestyles only.
                assert.deepStrictEqual(
                    diags.map((d) => d.message),
                    [
                        "Unknown trigger 'kin_legacy_track_xp'",
                        "Unknown effect 'add_kin_legacy_track_xp'",
                    ]
                );
            });

            it('without a base game any fill is accepted (the vanilla keys are unknown)', () => {
                const diags = check(
                    event(['has_relation_friend = root'], ['add_intrigue_lifestyle_xp = 5'])
                );
                assert.deepStrictEqual(diags, []);
            });
        });

        it('yes/no as values and root as a chain head are not reported as links', () => {
            const diags = check(
                event(
                    [
                        'always = yes',
                        'is_alive = no',
                        'root = { is_alive = yes }',
                        'root.father = { is_alive = yes }',
                        'scope:x.root = { is_alive = yes }',
                    ],
                    ['root = { add_gold = 1 }', 'save_scope_as = x']
                )
            );
            assert.deepStrictEqual(diags, []);
        });

        it('modifier blocks: static table, templates, unknown names', () => {
            const text = [
                'my_trait = {',
                '\tcategory = personality',
                '\tmonthly_income_mult = 0.1',
                '\tstationed_heavy_infantry_damage_mult = 0.1',
                '\tculture_modifier = {',
                '\t\tparameter = x',
                '\t\tnot_a_real_modifier_mult = 1',
                '\t}',
                '}',
            ].join('\n');
            const diags = check(text, 'common/traits/t.txt');
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.message]),
                [
                    [
                        'unknown_modifier_type_X_at_X',
                        "Unknown modifier type 'not_a_real_modifier_mult' at common/traits/t.txt:7",
                    ],
                ]
            );
        });
    });

    describe('Schema and scope checks', () => {
        it('unknown record field (warning) and allowed unconfirmed fields', () => {
            const text = [
                'my_decision = {',
                '\tis_shown = { is_ruler = yes }',
                '\teffect = { add_gold = 1 }',
                '\tnot_a_decision_field = yes',
                '}',
            ].join('\n');
            const diags = check(text, 'common/decisions/d.txt');
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.severity, d.message]),
                [
                    [
                        'unknown_X_in_X',
                        'warning',
                        "Unknown 'not_a_decision_field' in decision 'my_decision'",
                    ],
                ]
            );
        });

        it('required field with engine evidence uses the evidence message', () => {
            const diags = check(
                'my_cb = {\n\tgroup = conquest\n}',
                'common/casus_belli_types/c.txt'
            );
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.message]),
                [
                    [
                        'casus_belli_X_missing_on_invalidated_desc',
                        'Casus belli my_cb missing on_invalidated_desc',
                    ],
                ]
            );
        });

        it('event content outside events/ (PYCH-S003)', () => {
            const diags = check(
                'namespace = x\nx.1 = { type = character_event }',
                'common/decisions/d.txt'
            );
            assert.deepStrictEqual(codes(diags).filter((c) => c === 'PYCH-S003').length, 1);
        });

        it('a bare value in a record body is a parse-style error', () => {
            const text = 'x.1 = {\n\ttype = character_event\n\ttitle  x.1.t\n}';
            const diags = check(`namespace = x\n${text}`);
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.message, d.range.start.line]),
                [
                    [
                        'unexpected_token_X_found_at_X_expected',
                        "Unexpected token 'x.1.t' found at 'events/test.txt:4', '=' expected",
                        3,
                    ],
                ]
            );
        });

        it('undefined saved scope (information, with a base game) and broken chains (error)', () => {
            const ws = new Workspace(VIRTUAL_ROOT, {
                vanilla: path.join(
                    packageRoot(),
                    'test',
                    'fixtures',
                    'engine-test-mods',
                    'unknown_effect'
                ),
            });
            const diags = diagnose(ws, path.join(VIRTUAL_ROOT, 'events/test.txt'), {
                text: event(
                    ['scope:never_saved = { is_alive = yes }', 'root.not_a_link_xyz = { }'],
                    ['save_scope_as = saved', 'scope:saved = { add_gold = 1 }']
                ),
            });
            const withoutBase = check(
                event(['scope:never_saved = { is_alive = yes }'], ['save_scope_as = saved'])
            );
            assert.deepStrictEqual(withoutBase, []);
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.severity]),
                [
                    ['undefined_event_target_X', 'information'],
                    ['failed_to_parse_data_for_event_target_link_link_X_location_X', 'error'],
                ]
            );
        });
    });

    describe('Plug-ins', () => {
        it('none are registered in this phase', () => {
            assert.strictEqual(registeredPluginCount(), 0);
        });

        it('plug-in diagnostics run last and are marked source plugin', () => {
            const ws = newWorkspace();
            const file = path.join(VIRTUAL_ROOT, 'events/p.txt');
            const diags = diagnose(ws, file, {
                text: 'a = b',
                plugins: [
                    (ctx) => [
                        {
                            file: ctx.file,
                            range: ctx.ast.range,
                            severity: 'hint',
                            code: 'PLUGIN-1',
                            message: `seen ${ctx.file}`,
                            source: 'engine',
                        },
                    ],
                ],
            });
            assert.deepStrictEqual(
                diags.map((d) => [d.code, d.source, d.message]),
                [['PLUGIN-1', 'plugin', 'seen events/p.txt']]
            );
        });
    });
});
