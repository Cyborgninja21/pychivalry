/**
 * Unit Tests for CK3 Court Position Validation
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import { validateCourtPositions, DEFAULT_COURT_POSITION_CONFIG } from '../../server/ck3/validation/court-positions';

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

describe('Court Position Validation', () => {
    describe('COURT-001: missing can_be_appointed', () => {
        it('should flag position without can_be_appointed', () => {
            const root = makeBlock('ROOT', [
                makeBlock('court_physician', [
                    makeBlock('salary', [makeAssignment('gold', '2')]),
                    makeBlock('opinion', [makeAssignment('value', '10')]),
                ]),
            ]);
            const diags = validateCourtPositions(root, DEFAULT_COURT_POSITION_CONFIG, 'file:///common/court_positions/test.txt');
            assert.ok(diags.some(d => d.code === 'COURT-001'), 'Should flag missing can_be_appointed');
        });

        it('should not flag position with can_be_appointed', () => {
            const root = makeBlock('ROOT', [
                makeBlock('court_physician', [
                    makeBlock('can_be_appointed', [makeAssignment('is_adult', 'yes')]),
                    makeBlock('salary', []),
                    makeBlock('opinion', []),
                ]),
            ]);
            const diags = validateCourtPositions(root, DEFAULT_COURT_POSITION_CONFIG, 'file:///common/court_positions/test.txt');
            assert.ok(!diags.some(d => d.code === 'COURT-001'));
        });
    });

    describe('COURT-002: salary without opinion', () => {
        it('should flag position with salary but no opinion', () => {
            const root = makeBlock('ROOT', [
                makeBlock('court_physician', [
                    makeBlock('can_be_appointed', []),
                    makeBlock('salary', [makeAssignment('gold', '2')]),
                ]),
            ]);
            const diags = validateCourtPositions(root, DEFAULT_COURT_POSITION_CONFIG, 'file:///common/court_positions/test.txt');
            assert.ok(diags.some(d => d.code === 'COURT-002'), 'Should flag salary without opinion');
        });

        it('should not flag when both salary and opinion present', () => {
            const root = makeBlock('ROOT', [
                makeBlock('court_physician', [
                    makeBlock('can_be_appointed', []),
                    makeBlock('salary', []),
                    makeBlock('opinion', []),
                ]),
            ]);
            const diags = validateCourtPositions(root, DEFAULT_COURT_POSITION_CONFIG, 'file:///common/court_positions/test.txt');
            assert.ok(!diags.some(d => d.code === 'COURT-002'));
        });
    });

    describe('File path filtering', () => {
        it('should skip non-court_position files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('test', [makeBlock('salary', [])]),
            ]);
            const diags = validateCourtPositions(root, DEFAULT_COURT_POSITION_CONFIG, 'file:///events/test.txt');
            assert.strictEqual(diags.length, 0);
        });
    });
});
