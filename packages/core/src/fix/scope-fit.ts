/**
 * Whether a name a fix would write fits the scope it would stand in, by the same data the
 * scope checks judge by (`check/scope.ts`): the scopes a trigger, an effect or a list's
 * iterator takes (`scope_validity`), and the scopes a link starts from (its documented forms).
 * A name with no requirement, or one the package does not describe, fits: the checks would not
 * judge it either. Used to keep out of a fix a name that would raise a scope error.
 */

import type { Context } from '../check/context.js';
import type { Spec } from '../spec/reader.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import { iteratorPrefixes } from './candidates.js';

/** The word of `scope_validity` for a keyword that declares no requirement. */
const NO_REQUIREMENT = 'none';

function takes(expected: readonly string[] | undefined, scope: string): boolean {
    return (
        expected === undefined ||
        expected.length === 0 ||
        expected.includes(NO_REQUIREMENT) ||
        expected.includes(scope)
    );
}

/** True when the link may start from the scope: some form of it does, or is global. */
export function linkStartsFrom(spec: Spec, link: string, scope: string): boolean {
    const forms = vocabularyOf(spec).linkForms(link);
    if (forms.length === 0) {
        return true;
    }
    return forms.some(
        (f) =>
            f.global_link || f.supported_scopes.length === 0 || f.supported_scopes.includes(scope),
    );
}

/** True when `name`, written as a key of a block of `context` whose scope is `scope`, fits it. */
export function fitsScope(spec: Spec, name: string, context: Context, scope: string): boolean {
    const vocabulary = vocabularyOf(spec);
    const bucket = context === 'trigger' ? 'triggers' : 'effects';
    if (vocabulary.has(bucket, name)) {
        return takes(vocabulary.scopeValidity(bucket, name)?.supported_scopes, scope);
    }
    if (vocabulary.has('links', name)) {
        return linkStartsFrom(spec, name, scope);
    }
    for (const prefix of iteratorPrefixes(spec, context)) {
        if (name.startsWith(prefix)) {
            const list = name.slice(prefix.length);
            if (vocabulary.has('lists', list)) {
                return takes(vocabulary.scopeValidity('lists', list)?.supported_scopes, scope);
            }
        }
    }
    return true;
}
