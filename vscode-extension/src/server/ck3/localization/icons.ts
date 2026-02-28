/**
 * CK3 Localization Icons — icon reference validation and lookup
 *
 * Validates icon references such as `@gold_icon!` found in CK3
 * localization strings against the icons YAML data loaded by DataLoader.
 *
 * DIAGNOSTIC CODES:
 *   ICON-001: Unknown icon reference
 *   ICON-002: Invalid icon reference syntax
 *   ICON-003: Missing icon file
 */

import { DataLoader, IconDefinition } from '../../data/loader';
import { findSimilar } from '../../utils/fuzzy-match';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether `name` is a known icon.
 * Strips leading `@` and trailing `!` before lookup.
 */
export function isValidIcon(name: string): boolean {
    const icons = getIconMap();
    if (!icons) return true; // graceful degradation
    return icons.has(normalise(name));
}

/** Suggest similar icon names for a potential typo. */
export function suggestSimilarIcons(name: string, max = 5): string[] {
    const icons = getIconMap();
    if (!icons) return [];
    return findSimilar(normalise(name), icons.keys(), { threshold: 0.6, max });
}

/** Return the full definition for an icon, or undefined. */
export function getIconInfo(name: string): IconDefinition | undefined {
    const icons = getIconMap();
    if (!icons) return undefined;
    return icons.get(normalise(name));
}

/** Return all icon names within a given category. */
export function getIconsByCategory(category: string): string[] {
    const icons = getIconMap();
    if (!icons) return [];
    const result: string[] = [];
    for (const [name, def] of icons) {
        if (def.category === category) result.push(name);
    }
    return result;
}

/** Return the set of distinct icon categories. */
export function getIconCategories(): string[] {
    const icons = getIconMap();
    if (!icons) return [];
    const cats = new Set<string>();
    for (const def of icons.values()) {
        if (def.category) cats.add(def.category);
    }
    return [...cats].sort();
}

/** Return a short markdown description suitable for hover. */
export function getIconDescription(name: string): string {
    const info = getIconInfo(name);
    if (!info) return `Unknown icon: \`${name}\``;

    const lines: string[] = [`**Icon:** \`@${info.name}!\``];
    if (info.category) lines.push(`*Category:* ${info.category}`);
    if (info.description) lines.push('', info.description);
    return lines.join('\n');
}

/** Return the total number of known icons (0 if data unavailable). */
export function getIconCount(): number {
    const icons = getIconMap();
    return icons ? icons.size : 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip `@` prefix and `!` suffix that CK3 icon syntax uses. */
function normalise(name: string): string {
    let n = name;
    if (n.startsWith('@')) n = n.slice(1);
    if (n.endsWith('!')) n = n.slice(0, -1);
    return n;
}

function getIconMap(): Map<string, IconDefinition> | null {
    try {
        return DataLoader.getInstance().getIcons();
    } catch {
        return null;
    }
}
