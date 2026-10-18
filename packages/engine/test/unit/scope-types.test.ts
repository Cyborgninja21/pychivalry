/**
 * Scope-type inference (check/scope-types.ts) and the per-keyword scope check (check/scope.ts),
 * on the game's own `script_docs` data in the spec package (format 3; field scopes format 4).
 */

import * as assert from 'assert';
import * as path from 'path';

import { resolveScopes, ScopeResolution } from '../../src/check/scope-types';
import { blockContexts } from '../../src/check/registry';
import { Diagnostic } from '../../src/diagnostics';
import { pathToUri, Workspace } from '../../src/index/workspace';
import { ASTNode } from '../../src/syntax/ast';
import { check, event, newWorkspace, VIRTUAL_ROOT } from '../helpers/engine';

const SCOPE_CODES = new Set([
    'wrong_scope_for_trigger_X_expected_X',
    'wrong_scope_for_effect_X_expected_X',
    'trying_to_use_X_link_on_an_invalid_scope_X',
]);

function scopeFindings(diags: Diagnostic[]): Diagnostic[] {
    return diags.filter((d) => SCOPE_CODES.has(d.code));
}

interface Resolved {
    res: ScopeResolution;
    ast: ASTNode;
}

function resolve(text: string, rel: string, others: Record<string, string> = {}): Resolved {
    const ws: Workspace = newWorkspace();
    for (const [file, content] of Object.entries(others)) {
        ws.indexFile(path.join(VIRTUAL_ROOT, file), content);
    }
    const file = path.join(VIRTUAL_ROOT, rel);
    ws.indexFile(file, text);
    const ast = ws.parse(file, text).ast;
    const input = { spec: ws.spec, workspace: ws, file: rel, uri: pathToUri(file), ast };
    return { res: resolveScopes(input, blockContexts(input)), ast };
}

/** The first node (depth first) with key `key`, below `from`. */
function find(from: ASTNode, key: string, nth = 0): ASTNode {
    const hits: ASTNode[] = [];
    const visit = (n: ASTNode): void => {
        for (const c of n.children ?? []) {
            if (c.key === key) {
                hits.push(c);
            }
            visit(c);
        }
    };
    visit(from);
    assert.ok(hits[nth], `no node ${key} #${nth}`);
    return hits[nth];
}

/** The scope type `this` has where `key` is written. */
function thisAt(r: Resolved, key: string, nth = 0): string | undefined {
    return r.res.nodeFrames.get(find(r.ast, key, nth))?.this;
}

describe('Scope-type inference', () => {
    describe('root per directory', () => {
        it('events: character by default, the scope field when given, none is unknown', () => {
            const plain = resolve(event(['is_ai = yes']), 'events/a.txt');
            assert.strictEqual(thisAt(plain, 'is_ai'), 'character');
            const typed = resolve(
                't.2 = {\n\ttype = character_event\n\tscope = landed_title\n\ttrigger = { tier = 3 }\n}',
                'events/a.txt'
            );
            assert.strictEqual(thisAt(typed, 'tier'), 'landed_title');
            const none = resolve(
                't.3 = {\n\tscope = none\n\ttrigger = { tier = 3 }\n}',
                'events/a.txt'
            );
            assert.strictEqual(thisAt(none, 'tier'), undefined);
        });

        it('decisions: the schema root scope (character)', () => {
            const r = resolve('d = {\n\tis_shown = { is_ai = no }\n}', 'common/decisions/d.txt');
            assert.strictEqual(thisAt(r, 'is_ai'), 'character');
        });

        it('on_actions: the expected scope the game documents for that on_action', () => {
            const r = resolve(
                'on_faith_monthly = {\n\ttrigger = { always = yes }\n}\non_my_mod_thing = {\n\ttrigger = { always = yes }\n}',
                'common/on_action/x.txt'
            );
            assert.strictEqual(thisAt(r, 'always', 0), 'faith');
            assert.strictEqual(thisAt(r, 'always', 1), undefined);
        });

        it('scripted effects: unknown; story cycles: the story (package format 4, measured on vanilla)', () => {
            const se = resolve('my_effect = {\n\tadd_gold = 1\n}', 'common/scripted_effects/e.txt');
            assert.strictEqual(thisAt(se, 'add_gold'), undefined);
            const sc = resolve(
                'my_story = {\n\ton_setup = { add_gold = 1 }\n}',
                'common/story_cycles/s.txt'
            );
            assert.strictEqual(thisAt(sc, 'add_gold'), 'story');
        });

        it("a callback inside a keyword's parameter block has its own root (unknown)", () => {
            const r = resolve(
                [
                    'my_story = {',
                    '\teffect_group = {',
                    '\t\ttriggered_effect = {',
                    '\t\t\teffect = {',
                    '\t\t\t\tstory_owner = {',
                    '\t\t\t\t\tai_start_best_war = {',
                    '\t\t\t\t\t\tis_valid = { root = { has_treasury = yes } }',
                    '\t\t\t\t\t}',
                    '\t\t\t\t}',
                    '\t\t\t}',
                    '\t\t}',
                    '\t}',
                    '}',
                ].join('\n'),
                'common/story_cycles/s.txt'
            );
            const war = find(r.ast, 'ai_start_best_war');
            assert.strictEqual(r.res.frames.get(war.children ?? [])?.root, 'story');
            const valid = find(r.ast, 'is_valid');
            assert.strictEqual(r.res.frames.get(valid.children ?? [])?.root, undefined);
            assert.strictEqual(thisAt(r, 'has_treasury'), undefined);
        });

        it('record fields the package gives a scope run there; root and prev unknown', () => {
            const f = resolve(
                [
                    'my_faction = {',
                    '\tis_valid = { exists = faction_leader }',
                    '\tcan_character_join = { is_adult = yes }',
                    '\tcan_county_join = { holder = { is_adult = yes } }',
                    '\tcounty_power = { always = yes }',
                    '}',
                ].join('\n'),
                'common/factions/f.txt'
            );
            assert.strictEqual(thisAt(f, 'exists'), 'faction');
            assert.strictEqual(thisAt(f, 'is_adult', 0), 'character');
            const join = find(f.ast, 'can_character_join');
            assert.deepStrictEqual(f.res.frames.get(join.children ?? []), { this: 'character' });
            assert.strictEqual(thisAt(f, 'holder'), 'landed_title');
            assert.strictEqual(thisAt(f, 'is_adult', 1), 'character');
            // county_power: the evidence names three types, so the field's scope is unknown.
            assert.strictEqual(thisAt(f, 'always'), undefined);
            const cb = resolve(
                'my_cb = {\n\tallowed_for_character = { is_adult = yes }\n\ton_victory = { war = { } }\n}',
                'common/casus_belli_types/c.txt'
            );
            assert.strictEqual(thisAt(cb, 'is_adult'), 'character');
            assert.strictEqual(thisAt(cb, 'war'), 'casus_belli');
        });

        it('interaction pickers: the title picker is a landed_title, the artifact picker unknown', () => {
            const r = resolve(
                [
                    'my_interaction = {',
                    '\tcan_be_picked = { is_adult = yes }',
                    '\tcan_be_picked_title = { tier = 3 }',
                    '\tcan_be_picked_artifact = { always = yes }',
                    '}',
                ].join('\n'),
                'common/character_interactions/i.txt'
            );
            assert.strictEqual(thisAt(r, 'is_adult'), 'character');
            assert.strictEqual(thisAt(r, 'tier'), 'landed_title');
            assert.strictEqual(thisAt(r, 'always'), undefined);
        });
    });

    describe('iterators, links and chains', () => {
        it('iterator element types from the oracle, prev is the outer scope', () => {
            const r = resolve(
                event(
                    [],
                    [
                        'every_held_title = {',
                        '\tlimit = { tier = 3 }',
                        '\tholder = { add_gold = 1 }',
                        '}',
                        'every_vassal = { add_prestige = 1 }',
                    ]
                ),
                'events/a.txt'
            );
            assert.strictEqual(thisAt(r, 'tier'), 'landed_title');
            assert.strictEqual(thisAt(r, 'add_gold'), 'character');
            assert.strictEqual(thisAt(r, 'add_prestige'), 'character');
            const limit = find(r.ast, 'limit');
            assert.strictEqual(r.res.frames.get(limit.children ?? [])?.prev, 'character');
            assert.strictEqual(
                r.res.iterators.get(find(r.ast, 'every_held_title')),
                'landed_title'
            );
        });

        it('link chains: each step has the output type of its link', () => {
            const r = resolve(
                event([], ['root.primary_title.holder = { add_gold = 1 }']),
                'events/a.txt'
            );
            const node = find(r.ast, 'root.primary_title.holder');
            const chain = r.res.keyChains.get(node);
            assert.deepStrictEqual(
                chain?.steps.map((s) => s.type),
                ['character', 'landed_title', 'character']
            );
            assert.strictEqual(thisAt(r, 'add_gold'), 'character');
        });

        it('a link whose input does not accept the current type is a mismatch', () => {
            const r = resolve(
                event([], ['root.primary_title.liege = { add_gold = 1 }']),
                'events/a.txt'
            );
            const chain = r.res.keyChains.get(find(r.ast, 'root.primary_title.liege'));
            assert.deepStrictEqual(chain?.steps[2].mismatch, {
                link: 'liege',
                on: 'landed_title',
                expected: ['character'],
            });
            assert.strictEqual(chain?.result, undefined, 'no type after a mismatch');
        });

        it('scope:x has the type at its only save site in the record', () => {
            const r = resolve(
                event(
                    [],
                    [
                        'primary_title = { save_scope_as = my_title }',
                        'scope:my_title = { add_county_modifier = { modifier = m days = 1 } }',
                    ]
                ),
                'events/a.txt'
            );
            assert.strictEqual(thisAt(r, 'add_county_modifier'), 'landed_title');
        });

        it('scope:x saved twice, or saved in another file, stays unknown', () => {
            const twice = resolve(
                event(
                    [],
                    [
                        'primary_title = { save_scope_as = x }',
                        'liege = { save_scope_as = x }',
                        'scope:x = { add_gold = 1 }',
                    ]
                ),
                'events/a.txt'
            );
            assert.strictEqual(thisAt(twice, 'add_gold'), undefined);
            const elsewhere = resolve(event([], ['scope:y = { add_gold = 1 }']), 'events/a.txt', {
                'events/b.txt': event([], ['primary_title = { save_scope_as = y }']),
            });
            assert.strictEqual(thisAt(elsewhere, 'add_gold'), undefined);
        });

        it('unknown propagates: parameter blocks, links and iterators from an unknown scope', () => {
            const r = resolve(
                'my_effect = {\n\tprimary_title = { holder = { add_gold = 1 } }\n\tevery_vassal = { add_prestige = 1 }\n}',
                'common/scripted_effects/e.txt'
            );
            assert.strictEqual(thisAt(r, 'add_gold'), undefined);
            assert.strictEqual(thisAt(r, 'add_prestige'), undefined);
            const p = resolve(
                event([], ['add_opinion = { target = root modifier = m }']),
                'events/a.txt'
            );
            assert.strictEqual(thisAt(p, 'target'), undefined);
        });
    });
});

describe('Scope check (game messages)', () => {
    it('wrong_scope_for_trigger_X_expected_X: positive and negative', () => {
        const bad = scopeFindings(check(event(['primary_title = { is_ai = yes }'])));
        assert.deepStrictEqual(
            bad.map((d) => [d.code, d.message, d.severity]),
            [
                [
                    'wrong_scope_for_trigger_X_expected_X',
                    'Wrong scope for trigger: landed_title, expected character',
                    'error',
                ],
            ]
        );
        assert.deepStrictEqual(scopeFindings(check(event(['is_ai = yes']))), []);
    });

    it('wrong_scope_for_effect_X_expected_X: positive and negative', () => {
        const bad = scopeFindings(check(event([], ['every_held_title = { add_gold = 5 }'])));
        assert.deepStrictEqual(
            bad.map((d) => [d.code, d.message]),
            [
                [
                    'wrong_scope_for_effect_X_expected_X',
                    'Wrong scope for effect: landed_title, expected character',
                ],
            ]
        );
        assert.deepStrictEqual(scopeFindings(check(event([], ['add_gold = 5']))), []);
    });

    it('trying_to_use_X_link_on_an_invalid_scope_X: positive and negative', () => {
        const bad = scopeFindings(
            check(event([], ['primary_title = { liege = { add_gold = 1 } }']))
        );
        assert.deepStrictEqual(
            bad.map((d) => [d.code, d.message]),
            [
                [
                    'trying_to_use_X_link_on_an_invalid_scope_X',
                    'Trying to use liege link on an invalid scope landed_title',
                ],
            ]
        );
        const chain = scopeFindings(check(event(['root.primary_title.liege = { is_ai = yes }'])));
        assert.deepStrictEqual(
            chain.map((d) => d.code),
            ['trying_to_use_X_link_on_an_invalid_scope_X']
        );
        assert.deepStrictEqual(
            scopeFindings(check(event(['root.primary_title.holder = { is_ai = yes }']))),
            []
        );
    });

    it('never reports a keyword whose supported scopes are none, nor in an unknown scope', () => {
        assert.deepStrictEqual(
            scopeFindings(check(event([], ['primary_title = { add_diplomacy_skill = 1 }']))),
            []
        );
        assert.deepStrictEqual(
            scopeFindings(
                check(
                    'my_effect = {\n\tprimary_title = { add_gold = 1 }\n}',
                    'common/scripted_effects/e.txt'
                )
            ),
            []
        );
        assert.deepStrictEqual(
            scopeFindings(
                check(event([], ['add_opinion = { target = root.primary_title modifier = m }']))
            ),
            []
        );
    });

    it('iterators are checked as the triggers and effects the game documents', () => {
        const bad = scopeFindings(
            check(event(['primary_title = { any_vassal = { is_ai = yes } }']))
        );
        assert.deepStrictEqual(
            bad.map((d) => d.message),
            ['Wrong scope for trigger: landed_title, expected character']
        );
    });
});
