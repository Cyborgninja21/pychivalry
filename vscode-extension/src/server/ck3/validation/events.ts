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
 *     EVENT-014: Event file should use .txt extension
 *     EVENT-015: Event file inside common/ instead of top-level events/
 *     EVENT-016: Namespace not defined in file (game engine warning)
 *     EVENT-017: Non-event content detected in events/ directory
 *     EVENT-018: Event content detected in non-event directory
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
 * Check if a document URI points to a file inside an events/ directory.
 * CK3 loads events from a top-level `events/` directory (not `common/events/`).
 */
export function isEventFilePath(documentUri: string): boolean {
    const normalized = documentUri.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/events/');
}

/**
 * CK3 event file location rules (from binary analysis + schema):
 *
 * 1. Events must be in a top-level `events/` directory (not `common/events/`)
 *    - The `scriptable_directories.yaml` registers `events` at level 1 (top-level)
 *    - Game engine: "Loaded [{}] events from '{}'"
 *
 * 2. Subdirectories within `events/` ARE supported:
 *    - `events/lifestyle/*.txt`, `events/war/*.txt`, etc.
 *    - Schema pattern: events subdirectories with .txt files
 *
 * 3. File extension MUST be `.txt`:
 *    - Schema pattern: events directory with .txt files
 *    - CK3 engine only loads `.txt` files for script content
 *
 * 4. Events in `common/` subdirectories are NOT event files:
 *    - `common/event_themes/` → theme definitions, not events
 *    - `common/event_backgrounds/` → background art paths
 *    - `common/event_pictures/` → event artwork
 *    - `common/event_2d_effects/` → visual effects
 *    - `common/event_transitions/` → transition animations
 *    - `common/combat_phase_events/` → battle event effects (not event type)
 *
 * 5. Namespace must be declared and must match event IDs:
 *    - Game engine: "Namespace '{}' used in event '{}' (file: {})
 *      is not defined in this file - it might not load properly."
 */

/**
 * Comprehensive file location validation for event files.
 * Checks all CK3 engine requirements for event file placement.
 */
export function validateEventFileLocation(
    documentUri: string,
    hasEventBlocks: boolean,
): Array<{ code: string; message: string }> {
    if (!hasEventBlocks) return [];

    const normalized = documentUri.replace(/\\/g, '/').toLowerCase();
    const errors: Array<{ code: string; message: string }> = [];

    // Check 1: Is the file in ANY events/ directory?
    const inEventsDir = normalized.includes('/events/');

    if (!inEventsDir) {
        errors.push({
            code: 'EVENT-008',
            message: "Event definitions not in 'events/' directory — CK3 will not load events from this location",
        });
        // If not in events/ at all, no point checking further location rules
        return errors;
    }

    // Check 2: Is it in common/events/ instead of top-level events/?
    // CK3 registers `events` at level 1 (top-level), NOT under common/
    if (normalized.includes('/common/events/')) {
        errors.push({
            code: 'EVENT-015',
            message: "Event file is in 'common/events/' — CK3 loads events from top-level 'events/' directory, not 'common/events/'",
        });
    }

    // Check 3: File extension must be .txt
    // Extract the actual file path from URI (strip file:// prefix and query/fragment)
    const pathPart = normalized.replace(/^file:\/\/\/?/, '').split(/[?#]/)[0];
    if (!pathPart.endsWith('.txt')) {
        errors.push({
            code: 'EVENT-014',
            message: "Event file should use '.txt' extension — CK3 only loads '.txt' files for script content",
        });
    }

    return errors;
}

/**
 * Validate namespace declarations in an event file.
 *
 * CK3 game engine warning (from binary):
 *   "Namespace '{}' used in event '{}' (file: {}) is not defined
 *    in this file - it might not load properly."
 *
 * Checks that:
 * - A `namespace = X` declaration exists at the root level (EVENT-010)
 * - Event IDs match the declared namespace (EVENT-009)
 * - All namespaces used in events are declared in the file (EVENT-016)
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

    // Find ALL namespace declarations (a file can have multiple)
    const namespaceDecls = children.filter(
        c => c.type === NodeType.ASSIGNMENT && c.key === 'namespace' && c.value
    );
    const declaredNamespaces = new Set(namespaceDecls.map(d => String(d.value)));

    const errors: Array<{ code: string; message: string; range?: any }> = [];

    if (declaredNamespaces.size === 0) {
        errors.push({
            code: 'EVENT-010',
            message: "Missing 'namespace' declaration — event files should declare 'namespace = X'",
            range: eventNodes[0]?.range,
        });
        return errors;
    }

    // Check each event's namespace is declared in this file.
    // When there's exactly one declared namespace, use EVENT-009 (specific mismatch message).
    // When there are multiple, use EVENT-016 (game engine wording: "not defined in this file").
    const singleNamespace = declaredNamespaces.size === 1 ? [...declaredNamespaces][0] : null;

    for (const eventNode of eventNodes) {
        const parsed = parseEventId(eventNode.key!);
        if (parsed.namespace && !declaredNamespaces.has(parsed.namespace)) {
            if (singleNamespace) {
                // Single declared namespace — specific mismatch message
                errors.push({
                    code: 'EVENT-009',
                    message: `Event namespace '${parsed.namespace}' does not match declared namespace '${singleNamespace}'`,
                    range: eventNode.range,
                });
            } else {
                // Multiple declared namespaces — use game engine wording
                errors.push({
                    code: 'EVENT-016',
                    message: `Namespace '${parsed.namespace}' used in event '${eventNode.key}' is not defined in this file — it might not load properly`,
                    range: eventNode.range,
                });
            }
        }
    }

    return errors;
}

/**
 * Content type classification for block fingerprinting.
 * Used to detect when content is placed in the wrong directory.
 */
export type ContentType = 'event' | 'decision' | 'character_interaction' | 'on_action' | 'unknown';

/** Keys that fingerprint a block as a decision */
const DECISION_FINGERPRINTS = new Set([
    'is_shown', 'is_valid', 'is_valid_showing_failures_only',
]);

/** Keys that fingerprint a block as a character interaction */
const INTERACTION_FINGERPRINTS = new Set([
    'on_accept', 'on_decline', 'category', 'can_send',
    'send_option', 'greeting', 'notification_text',
]);

/** Keys that fingerprint a block as an on-action */
const ON_ACTION_FINGERPRINTS = new Set([
    'random_events', 'first_valid', 'events', 'on_actions',
]);

/** Event ID pattern: word.digits */
const EVENT_ID_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*\.\d+$/;

/**
 * Classify what type of content a top-level block looks like
 * based on its structural fingerprint (child keys and key pattern).
 *
 * This is a heuristic — it checks for characteristic child keys
 * that distinguish events from decisions, interactions, and on-actions.
 */
export function classifyBlockContentType(node: ASTNode): ContentType {
    if (!node.children || node.children.length === 0) return 'unknown';

    const childKeys = new Set(
        node.children
            .map(c => c.key)
            .filter((k): k is string => Boolean(k))
    );

    // Events: key matches namespace.number AND has a `type` child with an event type value
    if (node.key && EVENT_ID_PATTERN.test(node.key)) {
        const typeChild = node.children.find(c => c.key === 'type' && c.value);
        if (typeChild && EVENT_TYPES.has(String(typeChild.value))) {
            return 'event';
        }
        // Even without a valid type, the namespace.number pattern strongly suggests event
        return 'event';
    }

    // Decision: has is_shown, is_valid, or is_valid_showing_failures_only
    for (const fp of DECISION_FINGERPRINTS) {
        if (childKeys.has(fp)) return 'decision';
    }

    // Character interaction: has on_accept, on_decline, category, can_send, etc.
    // Require at least 2 fingerprints to avoid false positives
    let interactionScore = 0;
    for (const fp of INTERACTION_FINGERPRINTS) {
        if (childKeys.has(fp)) interactionScore++;
    }
    if (interactionScore >= 2) return 'character_interaction';

    // On-action: has random_events, first_valid, events, on_actions
    for (const fp of ON_ACTION_FINGERPRINTS) {
        if (childKeys.has(fp)) return 'on_action';
    }

    return 'unknown';
}

/**
 * Directory-to-expected-content-type mapping.
 * Maps directory path segments to the content type they should contain.
 */
const DIRECTORY_CONTENT_MAP: Array<{ pathSegment: string; expectedType: ContentType; label: string }> = [
    { pathSegment: '/events/', expectedType: 'event', label: 'events/' },
    { pathSegment: '/common/decisions/', expectedType: 'decision', label: 'common/decisions/' },
    { pathSegment: '/common/character_interactions/', expectedType: 'character_interaction', label: 'common/character_interactions/' },
    { pathSegment: '/common/on_actions/', expectedType: 'on_action', label: 'common/on_actions/' },
];

/** Human-readable labels for content types */
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
    event: 'event',
    decision: 'decision',
    character_interaction: 'character interaction',
    on_action: 'on-action',
    unknown: 'unknown',
};

/**
 * Validate that top-level blocks in a file match the expected content type
 * for the directory the file is in.
 *
 * - EVENT-017: Non-event content detected in events/ directory
 *   (e.g., a decision block with is_shown/is_valid in events/)
 * - EVENT-018: Event content detected in non-event directory
 *   (e.g., a namespace.0001 block in common/decisions/)
 */
export function validateContentTypePlacement(
    rootNode: ASTNode,
    documentUri: string,
): Array<{ code: string; message: string; range?: any }> {
    const normalized = documentUri.replace(/\\/g, '/').toLowerCase();
    const children = rootNode.children || [];
    if (children.length === 0) return [];

    // Determine what directory this file is in
    let expectedType: ContentType | null = null;
    let dirLabel = '';
    for (const mapping of DIRECTORY_CONTENT_MAP) {
        if (normalized.includes(mapping.pathSegment)) {
            expectedType = mapping.expectedType;
            dirLabel = mapping.label;
            break;
        }
    }

    // If we can't determine the directory type, skip validation
    if (!expectedType) return [];

    const errors: Array<{ code: string; message: string; range?: any }> = [];

    // Check each top-level block (skip assignments like `namespace = X`)
    for (const child of children) {
        if (!child.children || child.children.length === 0) continue;

        const detectedType = classifyBlockContentType(child);
        if (detectedType === 'unknown') continue;

        if (detectedType !== expectedType) {
            const detectedLabel = CONTENT_TYPE_LABELS[detectedType];
            const expectedLabel = CONTENT_TYPE_LABELS[expectedType];
            const code = expectedType === 'event' ? 'EVENT-017' : 'EVENT-018';

            errors.push({
                code,
                message: `Block '${child.key || '(unnamed)'}' looks like a ${detectedLabel} (not a ${expectedLabel}) — it is in '${dirLabel}' directory where ${expectedLabel} content is expected`,
                range: child.range,
            });
        }
    }

    return errors;
}
