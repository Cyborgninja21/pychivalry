/**
 * Unit Tests for CK3 Event Validation
 *
 * Tests event type recognition, portrait positions, file location validation,
 * namespace declaration checks, cross-field validations, and hidden awareness.
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import {
    EVENT_TYPES,
    PORTRAIT_POSITIONS,
    REQUIRED_FIELDS,
    isValidEventType,
    isValidTheme,
    isValidPortraitPosition,
    parseEventId,
    isValidNamespace,
    validateEventFields,
    validateEventFromNode,
    validateEventFileLocation,
    validateNamespaceDeclaration,
    validateContentTypePlacement,
    classifyBlockContentType,
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
    } = {},
): ASTNode {
    const children: ASTNode[] = [];
    const eventType = overrides.type ?? 'character_event';
    const title = overrides.title ?? 'test.t';
    const desc = overrides.desc ?? 'test.desc';

    children.push(makeAssignment('type', eventType));
    if (title) children.push(makeAssignment('title', title));
    if (desc) children.push(makeAssignment('desc', desc));

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

    describe('Event Types', () => {
        it('should recognize all spec primary types', () => {
            assert.ok(isValidEventType('character_event'));
            assert.ok(isValidEventType('letter_event'));
            assert.ok(isValidEventType('court_event'));
            assert.ok(isValidEventType('activity_event'));
            assert.ok(isValidEventType('fullscreen_event'));
            assert.ok(isValidEventType('duel_event'));
        });

        it('should recognize backwards-compat types', () => {
            assert.ok(isValidEventType('feast_event'));
            assert.ok(isValidEventType('story_cycle'));
        });

        it('should reject unknown types', () => {
            assert.ok(!isValidEventType('invalid_event'));
            assert.ok(!isValidEventType('empty'));
            assert.ok(!isValidEventType(''));
        });

        it('should have REQUIRED_FIELDS for all event types', () => {
            for (const eventType of EVENT_TYPES) {
                assert.ok(REQUIRED_FIELDS.has(eventType), `Missing REQUIRED_FIELDS for ${eventType}`);
            }
        });
    });

    describe('Portrait Positions', () => {
        it('should recognize all 6 portrait positions', () => {
            assert.ok(isValidPortraitPosition('left_portrait'));
            assert.ok(isValidPortraitPosition('right_portrait'));
            assert.ok(isValidPortraitPosition('center_portrait'));
            assert.ok(isValidPortraitPosition('lower_left_portrait'));
            assert.ok(isValidPortraitPosition('lower_center_portrait'));
            assert.ok(isValidPortraitPosition('lower_right_portrait'));
        });

        it('should have exactly 6 positions', () => {
            assert.strictEqual(PORTRAIT_POSITIONS.size, 6);
        });

        it('should reject invalid positions', () => {
            assert.ok(!isValidPortraitPosition('upper_portrait'));
            assert.ok(!isValidPortraitPosition(''));
        });
    });

    describe('Themes', () => {
        it('should accept standard themes', () => {
            assert.ok(isValidTheme('default'));
            assert.ok(isValidTheme('diplomacy'));
            assert.ok(isValidTheme('intrigue'));
            assert.ok(isValidTheme('martial'));
            assert.ok(isValidTheme('stewardship'));
            assert.ok(isValidTheme('learning'));
        });

        it('should accept extended themes from schema', () => {
            assert.ok(isValidTheme('seduction'));
            assert.ok(isValidTheme('temptation'));
            assert.ok(isValidTheme('romance'));
            assert.ok(isValidTheme('dread'));
            assert.ok(isValidTheme('dungeon'));
            assert.ok(isValidTheme('feast'));
            assert.ok(isValidTheme('hunt'));
            assert.ok(isValidTheme('travel'));
            assert.ok(isValidTheme('pet'));
            assert.ok(isValidTheme('healthcare'));
            assert.ok(isValidTheme('physical_health'));
            assert.ok(isValidTheme('mental_health'));
            assert.ok(isValidTheme('childhood'));
            assert.ok(isValidTheme('pregnancy'));
        });

        it('should reject invalid themes', () => {
            assert.ok(!isValidTheme('totally_made_up_theme'));
        });
    });

    describe('Event ID Parsing', () => {
        it('should parse namespace.number format', () => {
            const result = parseEventId('my_mod.0001');
            assert.strictEqual(result.namespace, 'my_mod');
            assert.strictEqual(result.number, '0001');
        });

        it('should handle complex namespaces', () => {
            const result = parseEventId('my_mod_events.1234');
            assert.strictEqual(result.namespace, 'my_mod_events');
            assert.strictEqual(result.number, '1234');
        });

        it('should return empty for no dot', () => {
            const result = parseEventId('no_dot');
            assert.strictEqual(result.namespace, undefined);
            assert.strictEqual(result.number, undefined);
        });
    });

    describe('Namespace Validation', () => {
        it('should accept valid namespaces', () => {
            assert.ok(isValidNamespace('my_namespace'));
            assert.ok(isValidNamespace('test123'));
            assert.ok(isValidNamespace('a'));
        });

        it('should reject invalid namespaces', () => {
            assert.ok(!isValidNamespace(''));
            assert.ok(!isValidNamespace('has space'));
            assert.ok(!isValidNamespace('has-dash'));
        });
    });

    describe('validateEventFields()', () => {
        it('should pass for complete event', () => {
            const result = validateEventFields({
                eventId: 'test.0001',
                eventType: 'character_event',
                title: 'test.t',
                desc: 'test.desc',
                requiredFields: new Set(['type', 'title', 'desc']),
                portraits: new Map(),
                options: [],
            });
            assert.ok(result.isValid);
            assert.strictEqual(result.missing.length, 0);
        });

        it('should report missing title', () => {
            const result = validateEventFields({
                eventId: 'test.0001',
                eventType: 'character_event',
                requiredFields: new Set(['type', 'title', 'desc']),
                portraits: new Map(),
                options: [],
            });
            assert.ok(!result.isValid);
            assert.ok(result.missing.includes('title'));
        });

        it('should skip title/desc check when hidden', () => {
            const result = validateEventFields({
                eventId: 'test.0001',
                eventType: 'character_event',
                requiredFields: new Set(['type', 'title', 'desc']),
                portraits: new Map(),
                options: [],
            }, true);
            assert.ok(result.isValid, 'Hidden event should not require title/desc');
        });
    });

    describe('validateEventFromNode() - cross-field checks', () => {
        it('should produce no errors for valid complete event', () => {
            const node = makeEventNode('test.0001');
            const result = validateEventFromNode(node);
            assert.strictEqual(result.errors.length, 0, `Unexpected errors: ${JSON.stringify(result.errors)}`);
        });

        it('should flag EVENT-002 for missing type', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('title', 'test.t'),
                makeBlock('option', [makeAssignment('name', 'test.a')]),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(result.errors.some(e => e.code === 'EVENT-002' && e.field === 'type'));
        });

        it('should flag EVENT-001 for invalid type', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('type', 'invalid_type'),
                makeAssignment('title', 'test.t'),
                makeAssignment('desc', 'test.desc'),
                makeBlock('option', [makeAssignment('name', 'test.a')]),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(result.errors.some(e => e.code === 'EVENT-001'));
        });

        it('should accept activity_event as valid type', () => {
            const node = makeEventNode('test.0001', { type: 'activity_event' });
            const result = validateEventFromNode(node);
            assert.ok(!result.errors.some(e => e.code === 'EVENT-001'), 'activity_event should be valid');
        });

        it('should accept fullscreen_event as valid type', () => {
            const node = makeEventNode('test.0001', { type: 'fullscreen_event' });
            const result = validateEventFromNode(node);
            assert.ok(!result.errors.some(e => e.code === 'EVENT-001'), 'fullscreen_event should be valid');
        });

        it('should not require title/desc for hidden events', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('type', 'character_event'),
                makeAssignment('hidden', 'yes'),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(!result.errors.some(e => e.code === 'EVENT-002' && e.field === 'title'),
                'Hidden event should not require title');
            assert.ok(!result.errors.some(e => e.code === 'EVENT-002' && e.field === 'desc'),
                'Hidden event should not require desc');
        });

        it('should flag EVENT-011 for hidden event with options', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('type', 'character_event'),
                makeAssignment('hidden', 'yes'),
                makeBlock('option', [makeAssignment('name', 'test.a')]),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(result.errors.some(e => e.code === 'EVENT-011'),
                'Should flag hidden event with options');
        });

        it('should flag EVENT-012 for hidden event with after block', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('type', 'character_event'),
                makeAssignment('hidden', 'yes'),
                makeBlock('after', []),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(result.errors.some(e => e.code === 'EVENT-012'),
                'Should flag hidden event with after block');
        });

        it('should flag EVENT-013 for non-hidden event without options', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('type', 'character_event'),
                makeAssignment('title', 'test.t'),
                makeAssignment('desc', 'test.desc'),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(result.errors.some(e => e.code === 'EVENT-013'),
                'Should flag non-hidden event without options');
        });

        it('should not flag EVENT-013 for hidden events without options', () => {
            const node = makeBlock('test.0001', [
                makeAssignment('type', 'character_event'),
                makeAssignment('hidden', 'yes'),
            ]);
            const result = validateEventFromNode(node);
            assert.ok(!result.errors.some(e => e.code === 'EVENT-013'),
                'Hidden event without options is fine');
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

        describe('validateEventFileLocation() - EVENT-008', () => {
            it('should flag EVENT-008 when events not in events/ dir', () => {
                const errors = validateEventFileLocation('file:///mod/common/test.txt', true);
                assert.ok(errors.some(e => e.code === 'EVENT-008'));
            });

            it('should return no errors when events are in events/ dir (.txt)', () => {
                const errors = validateEventFileLocation('file:///mod/events/test.txt', true);
                assert.strictEqual(errors.length, 0);
            });

            it('should accept events/ subdirectories', () => {
                const errors = validateEventFileLocation('file:///mod/events/lifestyle/focus.txt', true);
                assert.strictEqual(errors.length, 0);
            });

            it('should return no errors when no event blocks', () => {
                const errors = validateEventFileLocation('file:///mod/common/test.txt', false);
                assert.strictEqual(errors.length, 0);
            });
        });

        describe('validateEventFileLocation() - EVENT-015 (common/events/)', () => {
            it('should flag EVENT-015 when events in common/events/', () => {
                const errors = validateEventFileLocation('file:///mod/common/events/test.txt', true);
                assert.ok(errors.some(e => e.code === 'EVENT-015'),
                    'Should warn about common/events/ vs top-level events/');
            });

            it('should not flag EVENT-015 for top-level events/', () => {
                const errors = validateEventFileLocation('file:///mod/events/test.txt', true);
                assert.ok(!errors.some(e => e.code === 'EVENT-015'));
            });
        });

        describe('validateEventFileLocation() - EVENT-014 (.txt extension)', () => {
            it('should flag EVENT-014 for non-.txt file in events/', () => {
                const errors = validateEventFileLocation('file:///mod/events/test.yml', true);
                assert.ok(errors.some(e => e.code === 'EVENT-014'),
                    'Should warn about non-.txt extension');
            });

            it('should flag EVENT-014 for .json file in events/', () => {
                const errors = validateEventFileLocation('file:///mod/events/test.json', true);
                assert.ok(errors.some(e => e.code === 'EVENT-014'));
            });

            it('should not flag EVENT-014 for .txt file', () => {
                const errors = validateEventFileLocation('file:///mod/events/test.txt', true);
                assert.ok(!errors.some(e => e.code === 'EVENT-014'));
            });
        });
    });

    describe('Namespace Declaration Validation', () => {
        it('should pass with matching namespace declaration', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeAssignment('namespace', 'my_mod'),
                    makeEventNode('my_mod.0001'),
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.strictEqual(errors.length, 0);
        });

        it('should flag EVENT-010 for missing namespace declaration', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeEventNode('my_mod.0001'),
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.ok(errors.some(e => e.code === 'EVENT-010'));
        });

        it('should flag EVENT-009 for single namespace mismatch', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeAssignment('namespace', 'my_mod'),
                    makeEventNode('other_mod.0001'),
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.ok(errors.some(e => e.code === 'EVENT-009'),
                'Should use EVENT-009 when single namespace declared');
            assert.ok(!errors.some(e => e.code === 'EVENT-016'),
                'Should NOT use EVENT-016 when single namespace declared');
        });

        it('should flag EVENT-016 when multiple namespaces and event uses undeclared one', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeAssignment('namespace', 'ns_a'),
                    makeAssignment('namespace', 'ns_b'),
                    makeEventNode('ns_a.0001'),
                    makeEventNode('ns_c.0001'),  // ns_c not declared
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.ok(errors.some(e => e.code === 'EVENT-016'),
                'Should use EVENT-016 for undeclared namespace with multiple declarations');
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
                children: [
                    makeEventNode('my_mod.0001'),
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/decisions/test.txt');
            assert.strictEqual(errors.length, 0, 'Should skip for non-event files');
        });

        it('should skip when no event blocks exist', () => {
            const root: ASTNode = {
                type: NodeType.ROOT,
                key: 'root',
                children: [
                    makeAssignment('some_key', 'some_value'),
                ],
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            };
            const errors = validateNamespaceDeclaration(root, 'file:///mod/events/test.txt');
            assert.strictEqual(errors.length, 0, 'Should skip when no event blocks');
        });
    });

    describe('Content-Type Fingerprinting', () => {
        describe('classifyBlockContentType()', () => {
            it('should classify event blocks (namespace.number key + event type)', () => {
                const node = makeBlock('my_mod.0001', [
                    makeAssignment('type', 'character_event'),
                    makeAssignment('title', 'test.t'),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'event');
            });

            it('should classify event blocks with just namespace.number key', () => {
                const node = makeBlock('test.0001', [
                    makeAssignment('title', 'test.t'),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'event');
            });

            it('should classify decision blocks (has is_shown)', () => {
                const node = makeBlock('my_decision', [
                    makeBlock('is_shown', [makeAssignment('is_ruler', 'yes')]),
                    makeBlock('effect', [makeAssignment('add_gold', '100')]),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'decision');
            });

            it('should classify decision blocks (has is_valid)', () => {
                const node = makeBlock('my_decision', [
                    makeBlock('is_valid', [makeAssignment('is_alive', 'yes')]),
                    makeBlock('effect', [makeAssignment('add_gold', '100')]),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'decision');
            });

            it('should classify decision blocks (has is_valid_showing_failures_only)', () => {
                const node = makeBlock('my_decision', [
                    makeBlock('is_valid_showing_failures_only', [makeAssignment('age', '16')]),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'decision');
            });

            it('should classify character interaction blocks (2+ fingerprints)', () => {
                const node = makeBlock('my_interaction', [
                    makeBlock('on_accept', []),
                    makeBlock('on_decline', []),
                    makeAssignment('category', 'interaction_category_diplomacy'),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'character_interaction');
            });

            it('should NOT classify as interaction with only 1 fingerprint', () => {
                const node = makeBlock('some_block', [
                    makeBlock('on_accept', []),
                ]);
                // Should be unknown, not interaction (need >= 2)
                assert.notStrictEqual(classifyBlockContentType(node), 'character_interaction');
            });

            it('should classify on-action blocks (has random_events)', () => {
                const node = makeBlock('on_birth', [
                    makeBlock('random_events', []),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'on_action');
            });

            it('should classify on-action blocks (has first_valid)', () => {
                const node = makeBlock('on_death', [
                    makeBlock('first_valid', []),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'on_action');
            });

            it('should return unknown for empty blocks', () => {
                const node = makeBlock('some_block', []);
                assert.strictEqual(classifyBlockContentType(node), 'unknown');
            });

            it('should return unknown for unrecognized blocks', () => {
                const node = makeBlock('some_block', [
                    makeAssignment('weight', '10'),
                    makeAssignment('modifier', 'some_mod'),
                ]);
                assert.strictEqual(classifyBlockContentType(node), 'unknown');
            });
        });

        describe('validateContentTypePlacement()', () => {
            it('should produce no errors for events in events/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeAssignment('namespace', 'my_mod'),
                        makeEventNode('my_mod.0001'),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/events/test.txt');
                assert.strictEqual(errors.length, 0);
            });

            it('should flag EVENT-017 for decision block in events/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeBlock('my_decision', [
                            makeBlock('is_shown', [makeAssignment('is_ruler', 'yes')]),
                            makeBlock('effect', [makeAssignment('add_gold', '100')]),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/events/test.txt');
                assert.ok(errors.some(e => e.code === 'EVENT-017'),
                    'Should flag decision in events/ dir');
                assert.ok(errors[0].message.includes('decision'),
                    'Message should mention decision');
            });

            it('should flag EVENT-017 for interaction block in events/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeBlock('my_interaction', [
                            makeBlock('on_accept', []),
                            makeBlock('on_decline', []),
                            makeAssignment('category', 'interaction_category_diplomacy'),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/events/test.txt');
                assert.ok(errors.some(e => e.code === 'EVENT-017'),
                    'Should flag interaction in events/ dir');
                assert.ok(errors[0].message.includes('character interaction'),
                    'Message should mention character interaction');
            });

            it('should flag EVENT-017 for on-action block in events/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeBlock('on_birth', [
                            makeBlock('random_events', []),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/events/test.txt');
                assert.ok(errors.some(e => e.code === 'EVENT-017'),
                    'Should flag on-action in events/ dir');
            });

            it('should flag EVENT-018 for event block in decisions/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeEventNode('my_mod.0001'),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/common/decisions/test.txt');
                assert.ok(errors.some(e => e.code === 'EVENT-018'),
                    'Should flag event in decisions/ dir');
                assert.ok(errors[0].message.includes('event'),
                    'Message should mention event');
            });

            it('should flag EVENT-018 for event block in character_interactions/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeEventNode('my_mod.0001'),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/common/character_interactions/test.txt');
                assert.ok(errors.some(e => e.code === 'EVENT-018'),
                    'Should flag event in character_interactions/ dir');
            });

            it('should flag EVENT-018 for event block in on_actions/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeEventNode('my_mod.0001'),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/common/on_actions/test.txt');
                assert.ok(errors.some(e => e.code === 'EVENT-018'),
                    'Should flag event in on_actions/ dir');
            });

            it('should produce no errors for decisions in decisions/ dir', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeBlock('my_decision', [
                            makeBlock('is_shown', []),
                            makeBlock('effect', []),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/common/decisions/test.txt');
                assert.strictEqual(errors.length, 0);
            });

            it('should skip validation for unknown directories', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeBlock('my_decision', [
                            makeBlock('is_shown', []),
                            makeBlock('effect', []),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/common/cultures/test.txt');
                assert.strictEqual(errors.length, 0, 'Should skip for unknown directories');
            });

            it('should skip unknown blocks without flagging', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeBlock('generic_block', [
                            makeAssignment('weight', '10'),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/events/test.txt');
                assert.strictEqual(errors.length, 0, 'Unknown blocks should be skipped');
            });

            it('should handle mixed content — flag only mismatched blocks', () => {
                const root: ASTNode = {
                    type: NodeType.ROOT,
                    key: 'root',
                    children: [
                        makeAssignment('namespace', 'my_mod'),
                        makeEventNode('my_mod.0001'),  // correct — event in events/
                        makeBlock('oops_decision', [   // wrong — decision in events/
                            makeBlock('is_shown', []),
                            makeBlock('effect', []),
                        ]),
                    ],
                    range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
                };
                const errors = validateContentTypePlacement(root, 'file:///mod/events/test.txt');
                assert.strictEqual(errors.length, 1, 'Should flag only the decision block');
                assert.ok(errors[0].message.includes('oops_decision'));
                assert.strictEqual(errors[0].code, 'EVENT-017');
            });
        });
    });
});
