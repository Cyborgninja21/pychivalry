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
        it('should detect events/ in path', () => {
            assert.ok(isEventFilePath('file:///mod/events/test.txt'));
            assert.ok(isEventFilePath('file:///C:/mod/events/subfolder/test.txt'));
            assert.ok(isEventFilePath('C:\\mod\\events\\test.txt'));
        });

        it('should detect non-events paths', () => {
            assert.ok(!isEventFilePath('file:///mod/decisions/test.txt'));
            assert.ok(!isEventFilePath('file:///mod/common/test.txt'));
            assert.ok(!isEventFilePath('C:\\mod\\common\\test.txt'));
        });

        it('should return EVENT-008 when events not in events/ dir', () => {
            const errors = validateEventFileLocation('file:///mod/common/test.txt', true);
            assert.strictEqual(errors.length, 1);
            assert.strictEqual(errors[0].code, 'EVENT-008');
        });

        it('should return no errors when events are in events/ dir', () => {
            const errors = validateEventFileLocation('file:///mod/events/test.txt', true);
            assert.strictEqual(errors.length, 0);
        });

        it('should return no errors when no event blocks', () => {
            const errors = validateEventFileLocation('file:///mod/common/test.txt', false);
            assert.strictEqual(errors.length, 0);
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

        it('should flag EVENT-009 for namespace mismatch', () => {
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
            assert.ok(errors.some(e => e.code === 'EVENT-009'));
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
});
