/**
 * CK3 Event System - Validation and Processing of Narrative Events
 *
 * DIAGNOSTIC CODES:
 *     EVENT-001: Invalid event type
 *     EVENT-002: Missing required field
 *     EVENT-003: Invalid event theme
 *     EVENT-004: Invalid portrait position or animation
 *     EVENT-005: Malformed event ID
 *     EVENT-006: Invalid dynamic description configuration
 *     EVENT-007: Invalid option configuration
 *     EVENT-008: Event file not in events/ directory
 *     EVENT-009: Event namespace does not match namespace declaration
 *     EVENT-010: Missing namespace declaration in event file
 *     EVENT-011: Hidden event should not have options
 *     EVENT-012: Hidden event should not have after block
 *     EVENT-013: Non-hidden event missing options
 *
 * Event types determine presentation style (character portrait, letter, court scene),
 * required fields, and available features. Each type has specific validation rules.
 */

import { ASTNode, NodeType } from '../../core/parser';
import { DataLoader } from '../../data/loader';

/**
 * Represents a CK3 event
 */
export interface Event {
    eventId: string;
    eventType: string;
    namespace?: string;
    title?: string;
    desc?: string;
    theme?: string;
    requiredFields: Set<string>;
    portraits: Map<string, any>;
    options: any[];
}

/**
 * Valid event types - these determine presentation style and required fields
 */
export const EVENT_TYPES = new Set([
    'character_event',
    'letter_event',
    'court_event',
    'activity_event',
    'fullscreen_event',
    'duel_event',
    'feast_event',
    'story_cycle',
]);

/**
 * Portrait positions
 */
export const PORTRAIT_POSITIONS = new Set([
    'left_portrait',
    'right_portrait',
    'center_portrait',
    'lower_left_portrait',
    'lower_center_portrait',
    'lower_right_portrait',
]);

/**
 * Required fields by event type
 */
export const REQUIRED_FIELDS: Map<string, Set<string>> = new Map([
    ['character_event', new Set(['type', 'title', 'desc'])],
    ['letter_event', new Set(['type', 'title', 'desc', 'sender'])],
    ['court_event', new Set(['type', 'title', 'desc'])],
    ['activity_event', new Set(['type', 'title', 'desc'])],
    ['fullscreen_event', new Set(['type', 'title', 'desc'])],
    ['duel_event', new Set(['type', 'title', 'desc'])],
    ['feast_event', new Set(['type', 'title', 'desc'])],
    ['story_cycle', new Set(['type', 'title', 'desc'])],
]);

/**
 * Load event themes from data
 */
let EVENT_THEMES: Set<string> | null = null;

function getEventThemes(): Set<string> {
    if (!EVENT_THEMES) {
        const dataLoader = DataLoader.getInstance();
        // Themes would be loaded from themes.yaml if available
        // For now, return common themes
        EVENT_THEMES = new Set([
            'default', 'diplomacy', 'intrigue', 'martial', 'stewardship',
            'learning', 'seduction', 'temptation', 'romance', 'faith',
            'culture', 'war', 'death', 'dread', 'dungeon', 'feast',
            'hunt', 'travel', 'pet', 'friendly', 'unfriendly',
            'healthcare', 'physical_health', 'mental_health', 'childhood',
            'pregnancy', 'family', 'realm', 'vassal', 'courtier', 'liege', 'tax',
        ]);
    }
    return EVENT_THEMES;
}

/**
 * Load portrait animations from data
 */
let PORTRAIT_ANIMATIONS: Set<string> | null = null;

function getPortraitAnimations(): Set<string> {
    if (!PORTRAIT_ANIMATIONS) {
        const dataLoader = DataLoader.getInstance();
        const animations = dataLoader.getAnimations();
        PORTRAIT_ANIMATIONS = new Set(Object.keys(animations));
    }
    return PORTRAIT_ANIMATIONS;
}

/**
 * Check if an event type is valid
 */
export function isValidEventType(eventType: string): boolean {
    return EVENT_TYPES.has(eventType);
}

/**
 * Check if an event theme is valid
 * If themes data not loaded, validation is disabled (returns true)
 */
export function isValidTheme(theme: string): boolean {
    const themes = getEventThemes();
    if (themes.size === 0) {
        return true; // Validation disabled if no themes loaded
    }
    return themes.has(theme);
}

/**
 * Check if a portrait position is valid
 */
export function isValidPortraitPosition(position: string): boolean {
    return PORTRAIT_POSITIONS.has(position);
}

/**
 * Check if a portrait animation is valid
 */
export function isValidPortraitAnimation(animation: string): boolean {
    const animations = getPortraitAnimations();
    return animations.has(animation);
}

/**
 * Validate that an event has all required fields.
 * When hidden=true, title and desc are not required.
 */
export function validateEventFields(event: Event, isHidden = false): { isValid: boolean; missing: string[] } {
    const required = REQUIRED_FIELDS.get(event.eventType);
    if (!required) {
        return { isValid: false, missing: [`Unknown event type: ${event.eventType}`] };
    }

    const missing: string[] = [];

    // Check each required field
    if (required.has('type') && !event.eventType) {
        missing.push('type');
    }
    // Hidden events don't require title/desc
    if (!isHidden) {
        if (required.has('title') && !event.title) {
            missing.push('title');
        }
        if (required.has('desc') && !event.desc) {
            missing.push('desc');
        }
    }

    return { isValid: missing.length === 0, missing };
}

/**
 * Validate a portrait configuration
 */
export function validatePortraitConfiguration(portraitConfig: any): { isValid: boolean; error?: string } {
    if (typeof portraitConfig !== 'object' || portraitConfig === null) {
        return { isValid: false, error: 'Portrait configuration must be an object' };
    }

    // Check animation if specified
    if (portraitConfig.animation) {
        if (!isValidPortraitAnimation(portraitConfig.animation)) {
            return { isValid: false, error: `Invalid portrait animation: ${portraitConfig.animation}` };
        }
    }

    return { isValid: true };
}

/**
 * Parse an event ID into namespace and number
 * Event IDs typically follow the format: namespace.number
 */
export function parseEventId(eventId: string): { namespace?: string; number?: string } {
    if (!eventId.includes('.')) {
        return {};
    }

    const lastDotIndex = eventId.lastIndexOf('.');
    const namespace = eventId.substring(0, lastDotIndex);
    const number = eventId.substring(lastDotIndex + 1);

    return { namespace, number };
}

/**
 * Validate a dynamic description configuration
 * 
 * Dynamic descriptions include:
 * - triggered_desc: Shows desc if trigger is true
 * - first_valid: Shows first desc where trigger is true
 * - random_valid: Shows random desc where trigger is true
 */
export function validateDynamicDescription(descConfig: any): { isValid: boolean; error?: string } {
    if (typeof descConfig !== 'object' || descConfig === null) {
        return { isValid: false, error: 'Dynamic description must be an object' };
    }

    // triggered_desc must have both trigger and desc
    if (descConfig.triggered_desc) {
        const triggered = descConfig.triggered_desc;
        if (typeof triggered !== 'object') {
            return { isValid: false, error: 'triggered_desc must be an object' };
        }
        if (!triggered.trigger) {
            return { isValid: false, error: "triggered_desc requires 'trigger' field" };
        }
        if (!triggered.desc) {
            return { isValid: false, error: "triggered_desc requires 'desc' field" };
        }
    }

    return { isValid: true };
}

/**
 * Get a description of an event type
 */
export function getEventTypeDescription(eventType: string): string {
    const descriptions: Record<string, string> = {
        character_event: 'Standard event with character portrait and options',
        letter_event: 'Event presented as a letter with parchment background',
        court_event: 'Event with court scene background and multiple characters',
        activity_event: 'Event occurring during activities (feasts, hunts, pilgrimages)',
        fullscreen_event: 'Full-screen event for major narrative moments',
        duel_event: 'Special event for combat/duel interactions',
        feast_event: 'Event during feast activities with feast-specific theming',
        story_cycle: 'Long-running event chain with persistent state across events',
    };
    return descriptions[eventType] || 'Unknown event type';
}

/**
 * Get a description of an event theme
 */
export function getThemeDescription(theme: string): string {
    const descriptions: Record<string, string> = {
        default: 'Default event styling',
        diplomacy: 'Diplomatic interactions and negotiations',
        intrigue: 'Plots, schemes, and secrets',
        martial: 'War, combat, and military matters',
        stewardship: 'Administration and economic matters',
        learning: 'Education, innovation, and knowledge',
        faith: 'Religious matters and faith interactions',
        culture: 'Cultural events and traditions',
        war: 'Warfare and military campaigns',
        death: 'Death and mortality events',
        family: 'Family relationships and dynamics',
    };
    return descriptions[theme] || 'Custom event theme';
}

/**
 * Create an Event object with validation
 */
export function createEvent(eventId: string, eventType: string, options: Partial<Event> = {}): Event {
    if (!isValidEventType(eventType)) {
        throw new Error(`Invalid event type: ${eventType}`);
    }

    const { namespace } = parseEventId(eventId);

    return {
        eventId,
        eventType,
        namespace,
        title: options.title,
        desc: options.desc,
        theme: options.theme,
        requiredFields: REQUIRED_FIELDS.get(eventType) || new Set(),
        portraits: options.portraits || new Map(),
        options: options.options || [],
    };
}

/**
 * Validate an event option configuration.
 * Options must have a 'name' field for localization.
 * Handles both plain objects and ASTNodes (checks children for name key).
 */
export function validateOption(optionConfig: any): { isValid: boolean; error?: string } {
    if (typeof optionConfig !== 'object' || optionConfig === null) {
        return { isValid: false, error: 'Option must be an object' };
    }

    // Check for name field — either as a direct property (plain object)
    // or as a child node with key 'name' (ASTNode)
    const hasName = optionConfig.name ||
        (Array.isArray(optionConfig.children) &&
         optionConfig.children.some((c: any) => c.key === 'name'));

    if (!hasName) {
        return { isValid: false, error: "Option requires 'name' field for localization" };
    }

    return { isValid: true };
}

/**
 * Suggest proper event ID formats for a namespace
 */
export function suggestEventIdFormat(namespace: string): string[] {
    return [
        `${namespace}.0001`,
        `${namespace}.0010`,
        `${namespace}.0100`,
        `${namespace}.1000`,
    ];
}

/**
 * Check if a namespace contains only valid characters
 * Valid namespaces must contain only alphanumeric characters and underscores
 */
export function isValidNamespace(namespace: string): boolean {
    if (!namespace) {
        return false;
    }
    // Only alphanumeric and underscores allowed
    return /^[a-zA-Z0-9_]+$/.test(namespace);
}

/**
 * Validate event structure from AST node
 */
export function validateEventFromNode(node: ASTNode): {
    event?: Event;
    errors: Array<{ code: string; message: string; field?: string }>;
} {
    const errors: Array<{ code: string; message: string; field?: string }> = [];

    // Extract event ID from the key of the assignment node containing this block
    let eventId = node.key || 'unknown';

    // Extract event type
    let eventType: string | undefined;
    const typeChild = (node.children || []).find((c: ASTNode) => c.type === NodeType.ASSIGNMENT && c.key === 'type');
    if (typeChild && typeChild.value) {
        eventType = String(typeChild.value);
    }

    if (!eventType) {
        errors.push({
            code: 'EVENT-002',
            message: 'Missing required field: type',
            field: 'type',
        });
        return { errors };
    }

    if (!isValidEventType(eventType)) {
        errors.push({
            code: 'EVENT-001',
            message: `Invalid event type: ${eventType}`,
            field: 'type',
        });
    }

    // Parse event ID
    const { namespace, number } = parseEventId(eventId);
    if (!namespace || !number) {
        errors.push({
            code: 'EVENT-005',
            message: `Malformed event ID: ${eventId}. Expected format: namespace.number`,
        });
    }

    // Extract other fields
    const children = node.children || [];
    const title = children.find((c: ASTNode) => c.type === NodeType.ASSIGNMENT && c.key === 'title')?.value;
    const desc = children.find((c: ASTNode) => c.type === NodeType.ASSIGNMENT && c.key === 'desc')?.value;
    const theme = children.find((c: ASTNode) => c.type === NodeType.ASSIGNMENT && c.key === 'theme')?.value;

    // Check hidden flag
    const hiddenChild = children.find((c: ASTNode) => c.type === NodeType.ASSIGNMENT && c.key === 'hidden');
    const isHidden = hiddenChild?.value === 'yes' || hiddenChild?.value === true;

    const event: Event = {
        eventId,
        eventType,
        namespace,
        title: title ? String(title) : undefined,
        desc: desc ? String(desc) : undefined,
        theme: theme ? String(theme) : undefined,
        requiredFields: REQUIRED_FIELDS.get(eventType) || new Set(),
        portraits: new Map(),
        options: [],
    };

    // Validate required fields (hidden-aware)
    const validation = validateEventFields(event, isHidden);
    if (!validation.isValid) {
        validation.missing.forEach(field => {
            errors.push({
                code: 'EVENT-002',
                message: `Missing required field: ${field}`,
                field,
            });
        });
    }

    // Validate theme if present
    if (theme && !isValidTheme(String(theme))) {
        errors.push({
            code: 'EVENT-003',
            message: `Invalid event theme: ${theme}`,
            field: 'theme',
        });
    }

    // Validate dynamic descriptions (first_valid, triggered_desc, random_valid)
    const descNode = children.find((c: ASTNode) => c.key === 'desc' && c.type === NodeType.BLOCK);
    if (descNode) {
        const dynResult = validateDynamicDescription(descNode);
        if (!dynResult.isValid) {
            errors.push({
                code: 'EVENT-006',
                message: dynResult.error || 'Invalid dynamic description configuration',
                field: 'desc',
            });
        }
    }

    // Validate portraits
    children
        .filter((c: ASTNode) => PORTRAIT_POSITIONS.has(c.key || ''))
        .forEach((portraitNode: ASTNode) => {
            const pValidation = validatePortraitConfiguration(portraitNode);
            if (!pValidation.isValid) {
                errors.push({
                    code: 'EVENT-004',
                    message: pValidation.error || 'Invalid portrait configuration',
                    field: portraitNode.key,
                });
            }
        });

    // Validate options
    const options = children.filter((c: ASTNode) => c.key === 'option');
    options.forEach((optionNode: ASTNode) => {
        const oValidation = validateOption(optionNode);
        if (!oValidation.isValid) {
            errors.push({
                code: 'EVENT-007',
                message: oValidation.error || 'Invalid option configuration',
                field: 'option',
            });
        }
    });

    // Cross-field validations
    const hasAfter = children.some((c: ASTNode) => c.key === 'after');

    if (isHidden && options.length > 0) {
        errors.push({
            code: 'EVENT-011',
            message: `Hidden event '${eventId}' should not have options`,
        });
    }

    if (isHidden && hasAfter) {
        errors.push({
            code: 'EVENT-012',
            message: `Hidden event '${eventId}' should not have 'after' block`,
        });
    }

    if (!isHidden && options.length === 0) {
        errors.push({
            code: 'EVENT-013',
            message: `Non-hidden event '${eventId}' must have at least one option`,
        });
    }

    return { event, errors };
}

/**
 * Check if a document URI points to a file inside an events/ directory
 */
export function isEventFilePath(documentUri: string): boolean {
    const normalized = documentUri.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/events/');
}

/**
 * Validate that a file containing events is in the events/ directory.
 * Returns diagnostics if the file has event-shaped blocks but is not in events/.
 */
export function validateEventFileLocation(
    documentUri: string,
    hasEventBlocks: boolean,
): Array<{ code: string; message: string }> {
    if (!hasEventBlocks) return [];
    if (isEventFilePath(documentUri)) return [];

    return [{
        code: 'EVENT-008',
        message: "Event definitions not in 'events/' directory — CK3 will not load events from this location",
    }];
}

/**
 * Validate namespace declarations in an event file.
 * Checks that:
 * - A `namespace = X` declaration exists at the root level
 * - Event IDs match the declared namespace
 */
export function validateNamespaceDeclaration(
    rootNode: ASTNode,
    documentUri: string,
): Array<{ code: string; message: string; range?: any }> {
    if (!isEventFilePath(documentUri)) return [];

    const children = rootNode.children || [];
    const eventPattern = /^[a-z_]+\.\d+$/;

    // Find event blocks
    const eventNodes = children.filter(c => c.key && eventPattern.test(c.key) && c.children);
    if (eventNodes.length === 0) return [];

    // Find namespace declaration
    const namespaceDecl = children.find(
        c => c.type === NodeType.ASSIGNMENT && c.key === 'namespace' && c.value
    );

    const errors: Array<{ code: string; message: string; range?: any }> = [];

    if (!namespaceDecl) {
        errors.push({
            code: 'EVENT-010',
            message: "Missing 'namespace' declaration — event files should declare 'namespace = X'",
            range: eventNodes[0]?.range,
        });
        return errors;
    }

    const declaredNamespace = String(namespaceDecl.value);

    // Check each event's namespace matches the declaration
    for (const eventNode of eventNodes) {
        const parsed = parseEventId(eventNode.key!);
        if (parsed.namespace && parsed.namespace !== declaredNamespace) {
            errors.push({
                code: 'EVENT-009',
                message: `Event namespace '${parsed.namespace}' does not match declared namespace '${declaredNamespace}'`,
                range: eventNode.range,
            });
        }
    }

    return errors;
}

