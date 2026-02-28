/**
 * Unit Tests for CK3 Casus Belli Validation
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import { validateCasusBelli, DEFAULT_CASUS_BELLI_CONFIG } from '../../server/ck3/validation/casus-belli';

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

describe('Casus Belli Validation', () => {
    describe('CB-001: missing outcome effects', () => {
        it('should flag CB with no outcome effects', () => {
            const root = makeBlock('ROOT', [
                makeBlock('conquest_cb', [
                    makeBlock('valid_to_start', [makeAssignment('always', 'yes')]),
                ]),
            ]);
            const diags = validateCasusBelli(root, DEFAULT_CASUS_BELLI_CONFIG, 'file:///common/casus_belli_types/test.txt');
            assert.ok(diags.some(d => d.code === 'CB-001'), 'Should flag missing outcome effects');
        });

        it('should not flag CB with on_victory', () => {
            const root = makeBlock('ROOT', [
                makeBlock('conquest_cb', [
                    makeBlock('valid_to_start', []),
                    makeBlock('on_victory', [makeAssignment('add_prestige', '100')]),
                ]),
            ]);
            const diags = validateCasusBelli(root, DEFAULT_CASUS_BELLI_CONFIG, 'file:///common/casus_belli_types/test.txt');
            assert.ok(!diags.some(d => d.code === 'CB-001'));
        });

        it('should not flag CB with on_defeat', () => {
            const root = makeBlock('ROOT', [
                makeBlock('conquest_cb', [
                    makeBlock('valid_to_start', []),
                    makeBlock('on_defeat', []),
                ]),
            ]);
            const diags = validateCasusBelli(root, DEFAULT_CASUS_BELLI_CONFIG, 'file:///common/casus_belli_types/test.txt');
            assert.ok(!diags.some(d => d.code === 'CB-001'));
        });
    });

    describe('CB-002: invalid cost currency', () => {
        it('should flag invalid cost currency', () => {
            const root = makeBlock('ROOT', [
                makeBlock('conquest_cb', [
                    makeBlock('valid_to_start', []),
                    makeBlock('on_victory', []),
                    makeBlock('cost', [makeAssignment('diamonds', '100')]),
                ]),
            ]);
            const diags = validateCasusBelli(root, DEFAULT_CASUS_BELLI_CONFIG, 'file:///common/casus_belli_types/test.txt');
            assert.ok(diags.some(d => d.code === 'CB-002'), 'Should flag unknown currency');
        });

        it('should accept valid cost currencies', () => {
            const root = makeBlock('ROOT', [
                makeBlock('conquest_cb', [
                    makeBlock('valid_to_start', []),
                    makeBlock('on_victory', []),
                    makeBlock('cost', [
                        makeAssignment('prestige', '100'),
                        makeAssignment('piety', '50'),
                    ]),
                ]),
            ]);
            const diags = validateCasusBelli(root, DEFAULT_CASUS_BELLI_CONFIG, 'file:///common/casus_belli_types/test.txt');
            assert.ok(!diags.some(d => d.code === 'CB-002'));
        });
    });

    describe('File path filtering', () => {
        it('should skip non-casus_belli files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('test', [makeBlock('valid_to_start', [])]),
            ]);
            const diags = validateCasusBelli(root, DEFAULT_CASUS_BELLI_CONFIG, 'file:///events/test.txt');
            assert.strictEqual(diags.length, 0);
        });
    });
});
