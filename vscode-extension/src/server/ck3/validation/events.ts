/**
 * CK3 events: type, required parts and the namespace declaration (engine plug-in).
 *
 * The reference is the game's own events documentation, game/events/_events.info (1.20.0.2).
 * None of these rules has engine evidence (no error-catalogue message, no `required` field in
 * the events schema), so every code is a convention at information severity (2.2 evidence
 * audit).
 *
 * DIAGNOSTIC CODES (information):
 *     EVENT-001: event type not one the documentation lists (character_event, letter_event,
 *                court_event, activity_event; the 1.20.0.2 base game uses exactly these four)
 *     EVENT-002: a letter_event without `sender` ("required for letter events")
 *     EVENT-010: an events/ file with events and no `namespace = …` declaration
 *     EVENT-016: an event whose namespace the file does not declare. The game prints
 *                "Namespace '{}' used in event '{}' (file: {}) is not defined in this file -
 *                it might not load properly." (a string of the 1.20.0.2 executable that the
 *                spec package's error catalogue does not hold, hence still a convention)
 *
 * Retired in 2.2 (each merged into the code that reports the same thing, or removed):
 *     EVENT-002 for a missing `type` (optional, defaults to character_event) or a missing
 *     title / desc (paradox-checks CK3765 / CK3764); EVENT-003 (theme: paradox-checks CK3430,
 *     against the workspace's and the base game's event_themes); EVENT-004 (portrait
 *     animation: paradox-checks CK3422); EVENT-005 (malformed id: unreachable, only
 *     `namespace.number` keys reach the validator); EVENT-006 (dynamic description: the check
 *     read plain-object fields an AST node never has, so it never reported); EVENT-007
 *     (option without name: paradox-checks CK3450); EVENT-009 (merged into EVENT-016, the same
 *     game message); EVENT-011 / EVENT-012 / EVENT-013 (paradox-checks CK3762 / CK3520 /
 *     CK3763). Retired in Phase 4: EVENT-008, EVENT-014, EVENT-015, EVENT-017, EVENT-018.
 */

import { ASTNode, NodeType, Range } from 'pychivalry-engine';
import { DataLoader } from '../../data/loader';
import { EVENT_KEY_RE } from './event-helpers';

/** Event types game/events/_events.info documents (and the only ones vanilla 1.20.0.2 uses). */
export const EVENT_TYPES = new Set([
    'character_event',
    'letter_event',
    'court_event',
    'activity_event',
]);

/** Portrait positions of an event (game/events/_events.info). */
export const PORTRAIT_POSITIONS = new Set([
    'left_portrait',
    'right_portrait',
    'center_portrait',
    'lower_left_portrait',
    'lower_center_portrait',
    'lower_right_portrait',
]);

let PORTRAIT_ANIMATIONS: Set<string> | null = null;

function getPortraitAnimations(): Set<string> {
    if (!PORTRAIT_ANIMATIONS) {
        PORTRAIT_ANIMATIONS = new Set(Object.keys(DataLoader.getInstance().getAnimations()));
    }
    return PORTRAIT_ANIMATIONS;
}

export function isValidEventType(eventType: string): boolean {
    return EVENT_TYPES.has(eventType);
}

export function isValidPortraitPosition(position: string): boolean {
    return PORTRAIT_POSITIONS.has(position);
}

/** Is the animation in the optional extracted data? True when no data is loaded. */
export function isValidPortraitAnimation(animation: string): boolean {
    const animations = getPortraitAnimations();
    return animations.size === 0 || animations.has(animation);
}

/** `namespace.number` → its parts. */
export function parseEventId(eventId: string): { namespace?: string; number?: string } {
    if (!eventId.includes('.')) {
        return {};
    }
    const lastDotIndex = eventId.lastIndexOf('.');
    return {
        namespace: eventId.substring(0, lastDotIndex),
        number: eventId.substring(lastDotIndex + 1),
    };
}

/** Namespaces hold only letters, digits and underscores. */
export function isValidNamespace(namespace: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(namespace);
}

export interface EventFinding {
    code: string;
    message: string;
    range?: Range;
}

/** EVENT-001 and EVENT-002 on one event block. */
export function validateEventFromNode(node: ASTNode): { errors: EventFinding[] } {
    const errors: EventFinding[] = [];
    const children = node.children ?? [];
    const typeChild = children.find((c) => c.type === NodeType.ASSIGNMENT && c.key === 'type');
    const eventType = typeChild?.value !== undefined ? String(typeChild.value) : undefined;
    if (eventType !== undefined && !isValidEventType(eventType)) {
        errors.push({
            code: 'EVENT-001',
            message: `Convention: event type '${eventType}' is not one game/events/_events.info documents (${[...EVENT_TYPES].join(', ')})`,
            range: typeChild?.range,
        });
    }
    const hidden = children.some(
        (c) => c.key === 'hidden' && (c.value === 'yes' || c.value === true)
    );
    if (eventType === 'letter_event' && !hidden && !children.some((c) => c.key === 'sender')) {
        errors.push({
            code: 'EVENT-002',
            message: `Convention: letter event '${node.key}' has no 'sender' (game/events/_events.info: required for letter events)`,
        });
    }
    return { errors };
}

/** Is the URI or path a file inside an events/ directory? */
export function isEventFilePath(documentUri: string): boolean {
    return documentUri.replace(/\\/g, '/').toLowerCase().includes('/events/');
}

/**
 * EVENT-010 (no namespace declaration) and EVENT-016 (an event's namespace is not declared
 * in the file) for an events/ file.
 */
export function validateNamespaceDeclaration(
    rootNode: ASTNode,
    documentUri: string
): EventFinding[] {
    if (!isEventFilePath(documentUri)) {
        return [];
    }
    const children = rootNode.children ?? [];
    const eventNodes = children.filter((c) => c.key && EVENT_KEY_RE.test(c.key) && c.children);
    if (eventNodes.length === 0) {
        return [];
    }
    const declared = new Set(
        children
            .filter((c) => c.type === NodeType.ASSIGNMENT && c.key === 'namespace' && c.value)
            .map((d) => String(d.value))
    );
    if (declared.size === 0) {
        return [
            {
                code: 'EVENT-010',
                message:
                    "Convention: the file declares no 'namespace = X'; the game warns that its events might not load properly",
                range: eventNodes[0].range,
            },
        ];
    }
    const errors: EventFinding[] = [];
    for (const eventNode of eventNodes) {
        const { namespace } = parseEventId(eventNode.key!);
        if (namespace && !declared.has(namespace)) {
            errors.push({
                code: 'EVENT-016',
                message: `Convention: namespace '${namespace}' used in event '${eventNode.key}' is not defined in this file - it might not load properly (the game's warning)`,
                range: eventNode.range,
            });
        }
    }
    return errors;
}
