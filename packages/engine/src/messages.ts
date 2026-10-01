/**
 * Message lookup for every diagnostic the engine emits.
 *
 * Engine messages come from the spec package's error catalogue (`Spec.message`). A
 * package-local `PYCH-` id is used only where the catalogue has no corresponding engine
 * message; each one is listed here with its text, and README.md repeats the list.
 */

import { fillPlaceholders, Spec } from './spec/spec';

export const PYCH_MESSAGES: Readonly<Record<string, string>> = {
    /** Parser: a quoted string runs to the end of the file. */
    'PYCH-P001': "Unterminated string starting at '%s'",
    /** Parser: `@[ ... ]` is not a well-formed arithmetic expression. */
    'PYCH-P002': "Malformed inline expression '@[%s]': %s",
    /** Registry: a keyword removed from the engine, with its replacement(s). */
    'PYCH-R001': "'%s' was removed in CK3 %s; use %s instead",
    /** Registry: a keyword removed from the engine that has no replacement. */
    'PYCH-R002': "'%s' was removed in CK3 %s and has no replacement%s",
    /** Schema: a field the package marks required is absent and the catalogue has no text. */
    'PYCH-S002': "Missing required field '%s' in %s '%s'",
    /** Schema: a file declares content of one type in a directory that loads another. */
    'PYCH-S003': "'%s' declares %s content, but %s loads %s content",
};

export function isLocalId(id: string): boolean {
    return id.startsWith('PYCH-');
}

/**
 * Text for a catalogue id (via the spec) or a package-local PYCH- id. Throws for an id
 * that is in neither.
 */
export function messageText(spec: Spec, id: string, ...args: Array<string | number>): string {
    if (isLocalId(id)) {
        const text = PYCH_MESSAGES[id];
        if (text === undefined) {
            throw new Error(`Unknown package-local message id '${id}'`);
        }
        return fillPlaceholders(text, args);
    }
    return spec.message(id, ...args);
}
