/**
 * CK3 Localization Concepts — game concept validation and lookup
 *
 * Validates concept references such as `[concept|E]` found in CK3
 * localization strings against the concepts YAML data loaded by DataLoader.
 *
 * DIAGNOSTIC CODES:
 *   CONCEPT-001: Unknown concept reference
 *   CONCEPT-002: Invalid concept link syntax
 *   CONCEPT-003: Missing concept context marker
 */

import { DataLoader, ConceptDefinition } from '../../data/loader';
import { findSimilar } from '../../utils/fuzzy-match';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check whether `name` is a known game concept. */
export function isValidConcept(name: string): boolean {
    const concepts = getConceptMap();
    if (!concepts) return true; // graceful degradation
    return concepts.has(name);
}

/** Suggest similar concept names for a potential typo. */
export function suggestSimilarConcepts(name: string, max = 5): string[] {
    const concepts = getConceptMap();
    if (!concepts) return [];
    return findSimilar(name, concepts.keys(), { threshold: 0.6, max });
}

/** Return the full definition for a concept, or undefined. */
export function getConceptInfo(name: string): ConceptDefinition | undefined {
    const concepts = getConceptMap();
    if (!concepts) return undefined;
    return concepts.get(name);
}

/** Return a short markdown description suitable for hover. */
export function getConceptDescription(name: string): string {
    const info = getConceptInfo(name);
    if (!info) return `Unknown concept: \`${name}\``;

    const lines: string[] = [`**Game Concept:** \`${name}\``];
    if (info.text) {
        const truncated = info.text.length > 200 ? info.text.slice(0, 197) + '...' : info.text;
        lines.push('', truncated);
    }
    if (info.source) {
        lines.push('', `*Source:* ${info.source}`);
    }
    return lines.join('\n');
}

/** Return the total number of known concepts (0 if data unavailable). */
export function getConceptCount(): number {
    const concepts = getConceptMap();
    return concepts ? concepts.size : 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getConceptMap(): Map<string, ConceptDefinition> | null {
    try {
        return DataLoader.getInstance().getConcepts();
    } catch {
        return null;
    }
}
