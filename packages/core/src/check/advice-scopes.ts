/**
 * Saved scopes, the smallest reading the advice checks need: which keys save a scope under a
 * name (the table `save_keys`), and which link reads a saved scope back (`scope:name`). The
 * event-target checks of item 4.6 read the same two things; this file is the piece to merge
 * onto theirs.
 *
 * Which link reads a saved scope is not a field of the package. It is read from the evidence
 * of the table `save_keys`: the link that requires data and is a global link, among the words
 * an `.info` line cited for a save key names (`save_temporary_scope_as = name # Saves the
 * current scope as scope:name`, words `save_temporary_scope_as`, `scope`). When that finds no
 * link, or more than one, no saved scope is read and the checks that need one judge nothing.
 */

import type { TableEvidence } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import type { Block, Pair, Scalar } from '../syntax/tree.js';
import { walkPairs } from './advice.js';

const links = new WeakMap<Spec, string | null>();

/** The link that reads a saved scope, from the evidence of the table `save_keys`. */
export function savedScopeLink(spec: Spec): string | null {
    let found = links.get(spec);
    if (found === undefined) {
        const words = new Set<string>();
        const entries = spec.data.tables.data['save_keys']?.entries ?? {};
        for (const entry of Object.values(entries)) {
            const evidence: readonly TableEvidence[] =
                entry.evidence === undefined || entry.evidence === 'none' ? [] : entry.evidence;
            if (entry.evidence_status !== 'confirmed') {
                continue;
            }
            for (const item of evidence) {
                const cited: unknown = item['words'];
                if (item.kind === 'info' && Array.isArray(cited)) {
                    for (const w of cited as unknown[]) {
                        if (typeof w === 'string') {
                            words.add(w);
                        }
                    }
                }
            }
        }
        const candidates = [...words].filter((w) =>
            (spec.data.scope_validity.links[w]?.forms ?? []).some(
                (f) => f.global_link && f.requires_data,
            ),
        );
        found = candidates.length === 1 ? (candidates[0] ?? null) : null;
        links.set(spec, found);
    }
    return found;
}

/** The names saved under the blocks' save keys, at any depth. */
export function savedIn(spec: Spec, blocks: readonly Block[]): Set<string> {
    const keys = tablesOf(spec).saveKeys;
    const names = new Set<string>();
    for (const block of blocks) {
        walkPairs(block, (pair) => {
            if (keys.has(pair.key.text) && pair.value?.kind === 'scalar') {
                names.add(pair.value.text);
            }
        });
    }
    return names;
}

/** A read of a saved scope: the scalar, and the name it reads. */
export interface ScopeRead {
    readonly scalar: Scalar;
    readonly name: string;
}

/** The saved scope a scalar reads first in its chain (`scope:x`, `scope:x.liege`), if any. */
export function scopeReadOf(scalar: Scalar, link: string): string | undefined {
    const head = scalar.segments?.[0] ?? scalar.text;
    const prefix = `${link}:`;
    return head.startsWith(prefix) && head.length > prefix.length
        ? head.slice(prefix.length)
        : undefined;
}

/** Every read of a saved scope in a pair's key and value, at any depth. */
export function scopeReadsIn(pair: Pair, link: string): ScopeRead[] {
    const out: ScopeRead[] = [];
    const look = (s: Scalar): void => {
        const name = scopeReadOf(s, link);
        if (name !== undefined) {
            out.push({ scalar: s, name });
        }
    };
    const visit = (p: Pair): void => {
        look(p.key);
        if (p.value?.kind === 'scalar') {
            look(p.value);
        }
    };
    visit(pair);
    const body = pair.value?.kind === 'block' ? pair.value : undefined;
    if (body !== undefined) {
        walkPairs(body, visit);
        for (const item of body.items) {
            if (item.kind === 'scalar') {
                look(item);
            }
        }
    }
    return out;
}
