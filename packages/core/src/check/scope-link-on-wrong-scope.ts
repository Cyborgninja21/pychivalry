/**
 * `scope/link-on-wrong-scope` (docs/checks.md, item 4.4): a link applied to a scope it cannot
 * start from. Evidence: the catalogue's `trying_to_use_X_link_on_an_invalid_scope_X` ("Trying to
 * use %s link on an invalid scope %s"), and the scopes each link takes from the game's own
 * documentation output (`scope_validity.links`).
 *
 * Judged where the scope walk (`check/scope.ts`) knows the scope the link is applied to and
 * every form of the link states the scopes it takes (a global link, `title:k_x`, takes any):
 * a link written as a block key (`liege = { }`), each segment of a chain written as a key, and
 * each segment of a chain written as the value of a trigger, an effect, a link or a chain in a
 * trigger or effect block (`is_vassal_of = root.liege`). A chain in a keyword's parameters, or
 * in the parameters of an iterator or a call, is evaluated where that runs it, and is not
 * judged.
 */

import type { FileReading, KeyReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';
import type { LinkStep, ScopeReading } from './scope.js';

export const CODE = 'scope/link-on-wrong-scope';

/** The readings of a pair whose link is applied in its own block's scope. */
const IN_ITS_BLOCK: ReadonlySet<KeyReading['kind']> = new Set<KeyReading['kind']>([
    'keyword',
    'link',
    'structural',
    'chain',
]);

/** The link steps the check judges: in a trigger or effect block, their pair no parameter. */
export function judgedSteps(reading: FileReading, scopes: ScopeReading): LinkStep[] {
    const kinds = new Map<unknown, KeyReading['kind']>();
    for (const key of reading.keys) {
        kinds.set(key.pair, key.reading.kind);
    }
    return scopes.links.filter((step) => {
        const kind = kinds.get(step.pair);
        return (
            (step.block === 'trigger' || step.block === 'effect') &&
            kind !== undefined &&
            IN_ITS_BLOCK.has(kind) &&
            step.input.type !== null &&
            step.expected !== null
        );
    });
}

export function linksOnWrongScope(
    reading: FileReading,
    scopes: ScopeReading,
    context: CheckContext,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const step of judgedSteps(reading, scopes)) {
        const input = step.input.type;
        if (input === null || step.expected === null || step.expected.includes(input)) {
            continue;
        }
        out.push(
            finding(
                CODE,
                step.scalar,
                [step.link, input],
                {
                    link: step.link,
                    scope: input,
                    expected: step.expected,
                    position: step.position,
                    ...(step.scalar.type === 'chain'
                        ? { chain: step.scalar.text, segment: step.segment }
                        : {}),
                },
                context,
            ),
        );
    }
    return out;
}
