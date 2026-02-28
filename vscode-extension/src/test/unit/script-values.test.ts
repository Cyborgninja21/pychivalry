/**
 * Unit Tests for Script Values Validation
 */

import * as assert from 'assert';
import { validateScriptValues, DEFAULT_SCRIPT_VALUES_CONFIG, ScriptValuesConfig } from '../../server/ck3/validation/script-values';
import { CK3Parser, ASTNode, NodeType } from '../../server/core/parser';

function parseAST(text: string): ASTNode {
    return new CK3Parser().parse(text).ast;
}

function makeConfig(overrides: Partial<ScriptValuesConfig> = {}): ScriptValuesConfig {
    return { ...DEFAULT_SCRIPT_VALUES_CONFIG, ...overrides };
}

describe('Script Values Validation', () => {

    describe('disabled config', () => {
        it('returns no diagnostics when disabled', () => {
            const ast = parseAST('script_values = { my_value = { min = 100 max = 10 } }');
            const diags = validateScriptValues(ast, makeConfig({ enabled: false }));
            assert.strictEqual(diags.length, 0);
        });
    });

    describe('range validation', () => {
        it('flags min > max (VALUE-002)', () => {
            const ast = parseAST('script_values = { my_value = { min = 100 max = 10 } }');
            const diags = validateScriptValues(ast, makeConfig());
            assert.ok(diags.some(d => d.code === 'VALUE-002'), 'Should flag invalid range');
        });

        it('passes valid range', () => {
            const ast = parseAST('script_values = { my_value = { min = 10 max = 100 } }');
            const diags = validateScriptValues(ast, makeConfig());
            const rangeErrors = diags.filter(d => d.code === 'VALUE-002');
            assert.strictEqual(rangeErrors.length, 0, 'Should not flag valid range');
        });

        it('skips range checks when disabled', () => {
            const ast = parseAST('script_values = { my_value = { min = 100 max = 10 } }');
            const diags = validateScriptValues(ast, makeConfig({ checkRanges: false }));
            const rangeErrors = diags.filter(d => d.code === 'VALUE-002');
            assert.strictEqual(rangeErrors.length, 0);
        });
    });

    describe('formula validation', () => {
        it('flags unknown formula operation (VALUE-003)', () => {
            const ast = parseAST('script_values = { my_value = { value = 10 frobnicate = 5 } }');
            const diags = validateScriptValues(ast, makeConfig());
            assert.ok(diags.some(d => d.code === 'VALUE-003'), 'Should flag unknown operation');
        });

        it('passes valid formula', () => {
            const ast = parseAST('script_values = { my_value = { value = 10 add = 5 multiply = 2 } }');
            const diags = validateScriptValues(ast, makeConfig());
            const formulaErrors = diags.filter(d => d.code === 'VALUE-003');
            assert.strictEqual(formulaErrors.length, 0, 'Should accept known operations');
        });

        it('flags negative round_to (VALUE-006)', () => {
            const ast = parseAST('script_values = { my_value = { value = 10 round_to = -1 } }');
            const diags = validateScriptValues(ast, makeConfig());
            assert.ok(diags.some(d => d.code === 'VALUE-006'), 'Should flag negative round_to');
        });

        it('warns on arithmetic without explicit value (VALUE-005)', () => {
            const ast = parseAST('script_values = { my_value = { add = 5 multiply = 2 } }');
            const diags = validateScriptValues(ast, makeConfig());
            assert.ok(diags.some(d => d.code === 'VALUE-005'), 'Should warn about missing value');
        });
    });

    describe('conditional validation', () => {
        it('flags else_if after else (VALUE-004)', () => {
            const text = `script_values = {
                my_value = {
                    if = { limit = { age >= 16 } value = 100 }
                    else = { value = 50 }
                    else_if = { limit = { age >= 10 } value = 75 }
                }
            }`;
            const ast = parseAST(text);
            const diags = validateScriptValues(ast, makeConfig());
            assert.ok(diags.some(d => d.code === 'VALUE-004'), 'Should flag else_if after else');
        });

        it('passes valid conditional chain', () => {
            const text = `script_values = {
                my_value = {
                    if = { limit = { age >= 16 } value = 100 }
                    else_if = { limit = { age >= 10 } value = 75 }
                    else = { value = 50 }
                }
            }`;
            const ast = parseAST(text);
            const diags = validateScriptValues(ast, makeConfig());
            const condErrors = diags.filter(d => d.code === 'VALUE-004');
            assert.strictEqual(condErrors.length, 0, 'Valid conditional should pass');
        });
    });

    describe('fixed values', () => {
        it('does not flag simple numeric assignments', () => {
            const ast = parseAST('script_values = { my_gold = 100 }');
            const diags = validateScriptValues(ast, makeConfig());
            assert.strictEqual(diags.length, 0);
        });
    });
});
