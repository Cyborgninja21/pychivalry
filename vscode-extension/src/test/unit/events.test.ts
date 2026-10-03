/**
 * Unit Tests for CK3 Event Validation
 *
 * Tests event type recognition, portrait positions, file location validation,
 * namespace declaration checks, cross-field validations, and hidden awareness.
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from 'pychivalry-engine';
import {
    EVENT_TYPES,
    PORTRAIT_POSITIONS,
    isValidEventType,
    isValidPortraitPosition,
    parseEventId,
    isValidNamespace,
    validateEventFromNode,
    validateNamespaceDeclaration,
    isEventFilePath,
} from '../../server/ck3/validation/events';

/** Helper: create an ASSIGNMENT ASTNode */
function makeAssignment(key: string, value: string | boolean): ASTNode {
    return {
        type: NodeType.ASSIGNMENT,
        key,
        value,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
}

/** Helper: create a BLOCK ASTNode with children */
function makeBlock(key: string, children: ASTNode[] = []): ASTNode {
    return {
        type: NodeType.BLOCK,
        key,
        children,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
}

/** Helper: create a minimal valid event node */
function makeEventNode(
    eventId: string,
    overrides: {
        type?: string;
        title?: string;
        desc?: string;
        hidden?: boolean;
        extraChildren?: ASTNode[];
    } = {}
): ASTNode {
    const children: ASTNode[] = [];
    const eventType = overrides.type ?? 'character_event';
    const title = overrides.title ?? 'test.t';
    const desc = overrides.desc ?? 'test.desc';

    children.push(makeAssignment('type', eventType));
    if (title) {
        children.push(makeAssignment('title', title));
    }
    if (desc) {
        children.push(makeAssignment('desc', desc));
    }

    if (overrides.hidden) {
        children.push(makeAssignment('hidden', 'yes'));
    } else {
        // Non-hidden events need at least one option
        children.push(makeBlock('option', [makeAssignment('name', 'test.option')]));
    }

    if (overrides.extraChildren) {
        children.push(...overrides.extraChildren);
    }

    return makeBlock(eventId, children);
}

describe('Event Validation', () => {
    describe('Event Types (game/events/_events.info)', () => {
        it('knows the four documented types', () => {
            for (const t of ['character_event', 'letter_event', 'court_event', 'activity_event']) {
                assert.ok(isValidEventType(t), t);
            }
            assert.strictEqual(EVENT_TYPES.size, 4);
        });

        it('rejects types the documentation does not list', () => {
            for (const t of ['story_cycle', 'feast_event', 'not_a_type']) {
                assert.ok(!isValidEventType(t), t);
            }
        });
    });

    describe('Portrait Positions', () => {
        it('knows the six positions', () => {
            assert.strictEqual(PORTRAIT_POSITIONS.size, 6);
            assert.ok(isValidPortraitPosition('center_portrait'));
            assert.ok(!isValidPortraitPosition('highlight_portrait'));
        });
    });

    describe('Event ID Parsing', () => {
        it('should parse namespace.number format', () => {
            assert.deepStrictEqual(parseEventId('my_mod.0001'), {
                namespace: 'my_mod',
                number: '0001',
            });
        });

        it('should return empty for no dot', () => {
            assert.deepStrictEqual(parseEventId('nodot'), {});
        });
    });

    describe('Namespace Validation', () => {
        it('accepts letters, digits and underscores only', () => {
            assert.ok(isValidNamespace('VIETmisc'));
            assert.ok(!isValidNamespace('bad-ns'));
            assert.ok(!isValidNamespace(''));
        });
    });

    describe('validateEventFromNode()', () => {
        it('reports nothing for a complete event', () => {
            assert.deepStrictEqual(validateEventFromNode(makeEventNode('test.0001')).errors, []);
        });

        it('does not require type: it is optional and defaults to character_event', () => {
            const node = makeBlock('test.0002', [
                makeAssignment('title', 't'),
                makeAssignment('desc', 'd'),
                makeBlock('option', [makeAssignment('name', 'a')]),
            ]);
            assert.deepStrictEqual(validateEventFromNode(node).errors, []);
        });

        it('flags EVENT-001 for a type the documentation does not list', () => {
            const errors = validateEventFromNode(
                makeEventNode('test.0003', { type: 'story_cycle' })
            ).errors;
            assert.deepStrictEqual(
                errors.map((e) => e.code),
                ['EVENT-001']
            );
            assert.ok(errors[0].message.startsWith('Convention:'));
        });

        it('flags EVENT-002 for a letter event without sender', () => {
            const errors = validateEventFromNode(
                makeEventNode('test.0004', { type: 'letter_event' })
            ).errors;
            assert.deepStrictEqual(
                errors.map((e) => e.code),
                ['EVENT-002']
            );
            const withSender = makeEventNode('test.0005', {
                type: 'letter_event',
                extraChildren: [makeAssignment('sender', 'scope:writer')],
            });
            assert.deepStrictEqual(validateEventFromNode(withSender).errors, []);
        });
    });

    describe('File Location Validation', () => {
        describe('isEventFilePath()', () => {
            it('should detect events/ in path (forward slash)', () => {
                assert.ok(isEventFilePath('file:///mod/events/test.txt'));
            });

            it('should detect events/ in subdirectory path', () => {
                assert.ok(isEventFilePath('file:///C:/mod/events/subfolder/test.txt'));
            });

            it('should detect events/ with backslash (Windows)', () => {
                assert.ok(isEventFilePath('C:\\mod\\events\\test.txt'));
            });

            it('should be case-insensitive', () => {
                assert.ok(isEventFilePath('file:///mod/Events/test.txt'));
                assert.ok(isEventFilePath('file:///mod/EVENTS/test.txt'));
            });

            it('should reject non-events paths', () => {
                assert.ok(!isEventFilePath('file:///mod/decisions/test.txt'));
                assert.ok(!isEventFilePath('file:///mod/common/test.txt'));
                assert.ok(!isEventFilePath('C:\\mod\\common\\test.txt'));
            });
        });
    });

    describe('Namespace Declaration Validation', () => {
        it('should pass with matching namespace declaration', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [makeAssignment('namespace', 'my_mod'), makeEventNode('my_mod.0001')],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.strictEqual(errors.length, 0);
        });

        it('should flag EVENT-010 for missing namespace declaration', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [makeEventNode('my_mod.0001')],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.ok(errors.some((e) => e.code === 'EVENT-010'));
        });

        it('should flag EVENT-016 (EVENT-009 merged into it) for a single namespace mismatch', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [makeAssignment('namespace', 'my_mod'), makeEventNode('other_mod.0001')],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.deepStrictEqual(
                errors.map((e) => e.code),
                ['EVENT-016']
            );
        });

        it('should flag EVENT-016 when multiple namespaces and event uses undeclared one', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeAssignment('namespace', 'ns_a'),
                    makeAssignment('namespace', 'ns_b'),
                    makeEventNode('ns_a.0001'),
                    makeEventNode('ns_c.0001'), // ns_c not declared
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.ok(
                errors.some((e) => e.code === 'EVENT-016'),
                'Should use EVENT-016 for undeclared namespace with multiple declarations'
            );
        });

        it('should pass with multiple namespace declarations all matching', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeAssignment('namespace', 'ns_a'),
                    makeAssignment('namespace', 'ns_b'),
                    makeEventNode('ns_a.0001'),
                    makeEventNode('ns_b.0001'),
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.strictEqual(errors.length, 0, 'All event namespaces are declared');
        });

        it('should skip validation for non-event files', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [makeEventNode('my_mod.0001')],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/decisions/test.txt');
            assert.strictEqual(errors.length, 0, 'Should skip for non-event files');
        });

        it('should skip when no event blocks exist', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [makeAssignment('some_key', 'some_value')],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.strictEqual(errors.length, 0, 'Should skip when no event blocks');
        });
    });
});
