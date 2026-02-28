/**
 * Unit Tests for Scripted Parameter Validation ($PARAM$ checks)
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import { validateScriptedParameters, ScriptedBlockConfig } from '../../server/ck3/validation/scripted-blocks';

function makeAssignment(key: string, value: string | boolean): ASTNode {
    return {
        type: NodeType.ASSIGNMENT,
        key,
        value,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
}

function makeBlock(key: string, children: ASTNode[] = []): ASTNode {
    return {
        type: NodeType.BLOCK,
        key,
        children,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
}

const config: ScriptedBlockConfig = {
    enabled: true,
    checkEffects: true,
    checkTriggers: true,
};

describe('Scripted Parameter Validation', () => {
    describe('CK3956: recursive self-reference', () => {
        it('should flag scripted block that calls itself', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_scripted_effect', [
                    makeBlock('if', [
                        makeBlock('limit', [makeAssignment('is_adult', 'yes')]),
                        makeBlock('my_scripted_effect', []),  // Recursive call
                    ]),
                ]),
            ]);
            const diags = validateScriptedParameters(root, config, 'file:///common/scripted_effects/test.txt');
            assert.ok(diags.some(d => d.code === 'CK3956'), 'Should flag recursive call');
        });

        it('should not flag non-recursive blocks', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_scripted_effect', [
                    makeBlock('if', [
                        makeBlock('limit', [makeAssignment('is_adult', 'yes')]),
                        makeBlock('other_effect', []),
                    ]),
                ]),
            ]);
            const diags = validateScriptedParameters(root, config, 'file:///common/scripted_effects/test.txt');
            assert.ok(!diags.some(d => d.code === 'CK3956'));
        });
    });

    describe('File path filtering', () => {
        it('should skip non-scripted files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_effect', [
                    makeBlock('my_effect', []),  // Would be recursive if checked
                ]),
            ]);
            const diags = validateScriptedParameters(root, config, 'file:///events/test.txt');
            assert.strictEqual(diags.length, 0);
        });

        it('should validate scripted_trigger files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_trigger', [
                    makeBlock('my_trigger', []),  // Recursive
                ]),
            ]);
            const diags = validateScriptedParameters(root, config, 'file:///common/scripted_triggers/test.txt');
            assert.ok(diags.some(d => d.code === 'CK3956'));
        });
    });

    describe('Disabled config', () => {
        it('should return empty when disabled', () => {
            const root = makeBlock('ROOT', [
                makeBlock('recursive', [makeBlock('recursive', [])]),
            ]);
            const diags = validateScriptedParameters(root, { ...config, enabled: false }, 'file:///common/scripted_effects/test.txt');
            assert.strictEqual(diags.length, 0);
        });
    });
});
