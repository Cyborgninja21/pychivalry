/**
 * Unit Tests for the variables plug-in (CK3701 declaration tracking across blocks)
 */

import * as assert from 'assert';
import { validateVariables, VariablesConfig } from '../../server/ck3/validation/variables';
import { CK3Parser, ASTNode } from 'pychivalry-engine';

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

function codes(text: string): string[] {
    return validateVariables(parseAST(text), CONFIG).map((d) => String(d.code));
}

describe('Variables plug-in', () => {
    it('accepts a has_variable guard in trigger declared later in immediate (block form)', () => {
        const text = [
            'my_mod.0001 = {',
            '    trigger = { NOT = { has_variable = already_fired } }',
            '    immediate = { set_variable = { name = already_fired value = yes } }',
            '}',
        ].join('\n');
        assert.ok(!codes(text).includes('CK3701'), 'CK3701 must not fire');
    });

    it('accepts the same pattern with the direct form of set_variable', () => {
        const text = [
            'my_mod.0002 = {',
            '    trigger = { NOT = { has_variable = seen_once } }',
            '    immediate = { set_variable = seen_once }',
            '}',
        ].join('\n');
        assert.ok(!codes(text).includes('CK3701'));
    });

    it('still reports a variable that is checked but never set anywhere', () => {
        const text = ['my_mod.0003 = {', '    trigger = { has_variable = never_set }', '}'].join(
            '\n'
        );
        assert.ok(codes(text).includes('CK3701'));
    });

    it('does not report a declared-later variable as unused (CK3702)', () => {
        const text = [
            'my_mod.0004 = {',
            '    trigger = { has_variable = flag_a }',
            '    immediate = { set_variable = { name = flag_a value = 1 } }',
            '}',
        ].join('\n');
        assert.ok(!codes(text).includes('CK3702'));
    });
});
