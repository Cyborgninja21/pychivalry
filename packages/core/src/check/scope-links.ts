/**
 * The links that lead from one scope type to others, from the game's own documentation of its
 * links (`scope_validity.links`): what a scope finding names as the way to a scope a trigger,
 * an effect or a link takes (docs/PLAN.md, step 6; tools/scored-run/README.md, proposal 2).
 *
 * A link leads from a scope to another when one of its forms starts from the first
 * (`supported_scopes`) and gives the second (`supported_targets`). A global link (`root`,
 * `title:k_x`) does not start from the scope it is written in and is not listed. A link whose
 * form needs data after a `:` is written `<link>:<key>`. Where no one link leads there, chains
 * of two links without data are listed (`religious_head.primary_title`). The lists are bounded:
 * at most `MAX_LINKS`, links without data first, each group by name; the count of all of them
 * is given when the list is cut.
 */

import type { Spec } from '../spec/reader.js';

/** The most links or chains a finding lists. */
export const MAX_LINKS = 12;

/** One way from a scope: a link, with the scopes it gives. */
interface Step {
    readonly name: string;
    readonly data: boolean;
    readonly targets: ReadonlySet<string>;
}

const steps = new WeakMap<Spec, ReadonlyMap<string, readonly Step[]>>();

/** Per scope type, the links that start from it, each form apart, sorted by name. */
function stepsOf(spec: Spec): ReadonlyMap<string, readonly Step[]> {
    let out = steps.get(spec);
    if (out === undefined) {
        const byScope = new Map<string, Step[]>();
        const links = spec.data.scope_validity.links;
        for (const name of Object.keys(links).sort()) {
            for (const form of links[name]?.forms ?? []) {
                if (form.global_link || form.wild_card || form.supported_targets.length === 0) {
                    continue;
                }
                const step: Step = {
                    name,
                    data: form.requires_data,
                    targets: new Set(form.supported_targets),
                };
                for (const scope of form.supported_scopes) {
                    byScope.set(scope, [...(byScope.get(scope) ?? []), step]);
                }
            }
        }
        out = byScope;
        steps.set(spec, out);
    }
    return out;
}

/** The links, or chains of two, that lead from `from` to one of `to`. */
export interface LinksBetween {
    /** At most `MAX_LINKS`: links without data first, then with, each by name. */
    readonly links: readonly string[];
    /** How many there are in all. */
    readonly total: number;
}

function written(step: Step): string {
    return step.data ? `${step.name}:<key>` : step.name;
}

/**
 * The links that lead from the scope type `from` to one of `to`; where none does, the chains
 * of two links without data that do.
 */
export function linksBetween(spec: Spec, from: string, to: readonly string[]): LinksBetween {
    const all = stepsOf(spec);
    const wanted = new Set(to);
    const reaches = (step: Step): boolean => [...step.targets].some((t) => wanted.has(t));
    const first = all.get(from) ?? [];
    const direct = new Set<string>();
    const withData = new Set<string>();
    for (const step of first) {
        if (reaches(step)) {
            (step.data ? withData : direct).add(written(step));
        }
    }
    let found = [...direct, ...[...withData].filter((w) => !direct.has(w.split(':')[0] ?? ''))];
    if (found.length === 0) {
        const chains = new Set<string>();
        for (const a of first) {
            if (a.data) {
                continue;
            }
            for (const middle of a.targets) {
                if (middle === from || wanted.has(middle)) {
                    continue;
                }
                for (const b of all.get(middle) ?? []) {
                    if (!b.data && reaches(b)) {
                        chains.add(`${a.name}.${b.name}`);
                    }
                }
            }
        }
        found = [...chains].sort();
    }
    return { links: found.slice(0, MAX_LINKS), total: found.length };
}

/**
 * The data a scope finding adds about the way there: `links_from_scope`, and
 * `links_from_scope_total` when the list is cut. Nothing when no way is known.
 */
export function linksData(
    spec: Spec,
    from: string,
    to: readonly string[],
): Readonly<Record<string, string | readonly string[]>> {
    const between = linksBetween(spec, from, to);
    if (between.total === 0) {
        return {};
    }
    return {
        links_from_scope: between.links,
        ...(between.total > between.links.length
            ? { links_from_scope_total: String(between.total) }
            : {}),
    };
}
