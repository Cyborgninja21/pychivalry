/**
 * Unit tests for the variables plug-in: CK3701/CK3702 judged across the workspace index and
 * the base game's (2.2), CK3703 namespaces, CK3705 list and value, all conventions.
 */

import * as assert from 'assert';
import { validateVariables, VariablesConfig } from '../../server/ck3/validation/variables';
import { ASTNode, CK3Parser, defaultSpec, Indexer } from 'pychivalry-engine';

const CONFIG: VariablesConfig = {
    enabled: true,
    checkUnused: true,
    checkUndeclared: true,
    checkScope: true,
    checkTypes: true,
};

function parseAST(text: string): ASTNode {
    return new CK3Parser().parse(text).ast;
}

/** Index `others` (uri → text) and validate `text` against them. */
function run(text: string, others: Record<string, string> = {}, baseGameKnown = true) {
    const index = new Indexer();
    for (const [uri, other] of Object.entries(others)) {
        index.indexSync(uri, parseAST(other));
    }
    return validateVariables(parseAST(text), CONFIG, {
        spec: defaultSpec(),
        indexes: [index],
        baseGameKnown,
    });
}

function codes(text: string, others: Record<string, string> = {}, baseGameKnown = true) {
    return run(text, others, baseGameKnown).map((d) => String(d.code));
}

describe('Variables plug-in', () => {
    it('accepts a has_variable guard in trigger set later in immediate', () => {
        const text = [
            'my_mod.0001 = {',
            '    trigger = { NOT = { has_variable = already_fired } }',
            '    immediate = { set_variable = { name = already_fired value = yes } }',
            '}',
        ].join('\n');
        assert.deepStrictEqual(codes(text), []);
    });

    it('accepts a variable another workspace file sets (CK3701 is workspace-wide)', () => {
        const text = 'my_trigger = { has_variable = set_elsewhere }';
        const other = {
            'file:///mod/common/scripted_effects/a.txt': 'e = { set_variable = set_elsewhere }',
        };
        assert.ok(!codes(text, other).includes('CK3701'));
        assert.ok(codes(text).includes('CK3701'));
    });

    it('reports CK3701 as information, and only while the base game is known', () => {
        const text = 'my_trigger = { exists = var:never_set }';
        const diags = run(text);
        assert.deepStrictEqual(
            diags.map((d) => [d.code, d.severity]),
            [['CK3701', 3]]
        );
        assert.deepStrictEqual(codes(text, {}, false), []);
    });

    it('reports CK3702 (hint) for a variable read nowhere, not one another file reads', () => {
        const text = 'e = { set_variable = lonely }';
        const diags = run(text);
        assert.deepStrictEqual(
            diags.map((d) => [d.code, d.severity]),
            [['CK3702', 4]]
        );
        const other = { 'file:///mod/events/b.txt': 'x = { trigger = { has_variable = lonely } }' };
        assert.deepStrictEqual(codes(text, other), []);
    });

    it('judges local variables in their file, without the base game', () => {
        assert.deepStrictEqual(
            codes(
                'e = { set_local_variable = tmp  if = { limit = { has_local_variable = tmp } } }',
                {},
                false
            ),
            []
        );
        assert.ok(
            codes('e = { if = { limit = { exists = local_var:tmp } } }', {}, false).includes(
                'CK3701'
            )
        );
    });

    it('reports CK3703 when the variable is set only in another namespace', () => {
        const text = 'e = { set_global_variable = g  if = { limit = { has_variable = g } } }';
        assert.ok(codes(text).includes('CK3703'));
    });

    it('reports CK3705 for a name used as a list and as a value', () => {
        const text =
            'e = { set_variable = { name = both value = 1 } add_to_variable_list = { name = both target = root } if = { limit = { has_variable = both } } }';
        assert.ok(codes(text).includes('CK3705'));
    });
});
