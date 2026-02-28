/**
 * Unit Tests for CK3 Modifier Validation
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import { validateModifiers, ModifierConfig } from '../../server/ck3/validation/modifiers';

function makeAssignment(key: string, value: string | boolean | number): ASTNode {
    return {
        type: NodeType.ASSIGNMENT,
        key,
        value: typeof value === 'number' ? String(value) : value,
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

const config: ModifierConfig = {
    enabled: true,
    knownModifierKeys: new Set(['diplomacy', 'martial', 'monthly_income', 'general_opinion']),
};

describe('Modifier Validation', () => {
    describe('MOD-001: unknown modifier key', () => {
        it('should flag unknown modifier key', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_modifier', [
                    makeAssignment('made_up_stat', '5'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///common/modifiers/test.txt');
            assert.ok(diags.some(d => d.code === 'MOD-001'), 'Should flag unknown modifier key');
        });

        it('should not flag known modifier key', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_modifier', [
                    makeAssignment('diplomacy', '5'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///common/modifiers/test.txt');
            assert.ok(!diags.some(d => d.code === 'MOD-001'));
        });

        it('should not flag meta keys (icon, name, etc.)', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_modifier', [
                    makeAssignment('icon', 'my_icon'),
                    makeAssignment('diplomacy', '5'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///common/modifiers/test.txt');
            assert.ok(!diags.some(d => d.code === 'MOD-001'));
        });
    });

    describe('MOD-002: non-numeric modifier value', () => {
        it('should flag non-numeric modifier value', () => {
            const root = makeBlock('ROOT', [
                makeBlock('bad_modifier', [
                    makeAssignment('diplomacy', 'abc'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///common/modifiers/test.txt');
            assert.ok(diags.some(d => d.code === 'MOD-002'), 'Should flag non-numeric value');
        });

        it('should not flag numeric values', () => {
            const root = makeBlock('ROOT', [
                makeBlock('ok_modifier', [
                    makeAssignment('diplomacy', '5'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///common/modifiers/test.txt');
            assert.ok(!diags.some(d => d.code === 'MOD-002'));
        });

        it('should accept yes/no values', () => {
            const root = makeBlock('ROOT', [
                makeBlock('ok_modifier', [
                    makeAssignment('diplomacy', 'yes'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///common/modifiers/test.txt');
            assert.ok(!diags.some(d => d.code === 'MOD-002'));
        });
    });

    describe('MOD-003: opinion modifier missing opinion field', () => {
        it('should flag opinion modifier without opinion', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_opinion', [
                    makeAssignment('months', '12'),
                ]),
            ]);
            const diags = validateModifiers(root, { enabled: true }, 'file:///common/opinion_modifiers/test.txt');
            assert.ok(diags.some(d => d.code === 'MOD-003'), 'Should flag missing opinion');
        });

        it('should not flag when opinion is present', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_opinion', [
                    makeAssignment('opinion', '10'),
                ]),
            ]);
            const diags = validateModifiers(root, { enabled: true }, 'file:///common/opinion_modifiers/test.txt');
            assert.ok(!diags.some(d => d.code === 'MOD-003'));
        });
    });

    describe('MOD-004: opinion value out of range', () => {
        it('should flag opinion value > 200', () => {
            const root = makeBlock('ROOT', [
                makeBlock('extreme_opinion', [
                    makeAssignment('opinion', '500'),
                ]),
            ]);
            const diags = validateModifiers(root, { enabled: true }, 'file:///common/opinion_modifiers/test.txt');
            assert.ok(diags.some(d => d.code === 'MOD-004'), 'Should flag out-of-range opinion');
        });

        it('should not flag opinion value in range', () => {
            const root = makeBlock('ROOT', [
                makeBlock('normal_opinion', [
                    makeAssignment('opinion', '50'),
                ]),
            ]);
            const diags = validateModifiers(root, { enabled: true }, 'file:///common/opinion_modifiers/test.txt');
            assert.ok(!diags.some(d => d.code === 'MOD-004'));
        });
    });

    describe('File path filtering', () => {
        it('should skip non-modifier files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_modifier', [
                    makeAssignment('made_up_stat', '5'),
                ]),
            ]);
            const diags = validateModifiers(root, config, 'file:///events/test.txt');
            assert.strictEqual(diags.length, 0);
        });
    });
});
