/**
 * Unit Tests for CK3 On-Action Validation
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import { validateOnActions, OnActionConfig } from '../../server/ck3/validation/on-actions';

function makeAssignment(key: string, value: string | boolean | number): ASTNode {
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

const config: OnActionConfig = { enabled: true, checkEventReferences: false };

describe('On-Action Validation', () => {
    describe('ON_ACTION-001: no effects or events', () => {
        it('should flag on-action with only trigger and no content', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('trigger', [makeAssignment('always', 'yes')]),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(diags.some(d => d.code === 'ON_ACTION-001'), 'Should flag empty on-action');
        });

        it('should not flag on-action with effect block', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('trigger', []),
                    makeBlock('effect', [makeAssignment('add_gold', '100')]),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(!diags.some(d => d.code === 'ON_ACTION-001'));
        });

        it('should not flag on-action with events list', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('events', [makeAssignment('my_event.0001', 'yes')]),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(!diags.some(d => d.code === 'ON_ACTION-001'));
        });

        it('should not flag on-action with random_events', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('random_events', [makeAssignment('my_event.0001', '100')]),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(!diags.some(d => d.code === 'ON_ACTION-001'));
        });
    });

    describe('ON_ACTION-002: empty events list', () => {
        it('should flag on-action with empty events block', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('events', []),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(diags.some(d => d.code === 'ON_ACTION-002'), 'Should flag empty events');
        });

        it('should not flag non-empty events list', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('events', [makeAssignment('my_event.0001', 'yes')]),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(!diags.some(d => d.code === 'ON_ACTION-002'));
        });
    });

    describe('ON_ACTION-004: zero weight random_events', () => {
        it('should flag random_events with total weight of 0', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('random_events', [
                        makeAssignment('chance_to_happen', '50'),
                        makeAssignment('my_event.0001', '0'),
                        makeAssignment('my_event.0002', '0'),
                    ]),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///common/on_action/test.txt');
            assert.ok(diags.some(d => d.code === 'ON_ACTION-004'), 'Should flag zero-weight random events');
        });
    });

    describe('File path filtering', () => {
        it('should skip non-on_action files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('trigger', []),
                ]),
            ]);
            const diags = validateOnActions(root, config, 'file:///events/test.txt');
            assert.strictEqual(diags.length, 0, 'Should not validate non-on_action files');
        });
    });

    describe('Disabled config', () => {
        it('should return empty when disabled', () => {
            const root = makeBlock('ROOT', [
                makeBlock('my_on_action', [
                    makeBlock('trigger', []),
                ]),
            ]);
            const diags = validateOnActions(root, { enabled: false, checkEventReferences: false }, 'file:///common/on_action/test.txt');
            assert.strictEqual(diags.length, 0);
        });
    });
});
