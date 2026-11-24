/**
 * `style/localization-key-characters` (the family `style`, pychivalry's own best-practice rules):
 * a localization key that starts with a digit or holds a character other than a letter, a digit,
 * `_` or `.`. Release 2.3.0's LOC-001, brought back on the owner's word of 2026-11-23 as a
 * best-practice hint: 2.3.0 called such a key one its localization index could not read
 * (`legacy/vscode-extension/src/server/ck3/localization/validator.ts`, `RE_VALID_KEY`), a claim
 * about its own reader, not about the game, which reads and ships such keys
 * (`innovation_men-at-arms`). The letters are 2.3.0's, `A` to `Z` and `a` to `z`.
 *
 * It tests no keyword: only the characters of each entry's key, as the localization reader reads
 * the entries (`index/localization.ts`; a key with white space or a quote in it is no entry
 * there). One finding a key, at the key. No fix: a key's name is the author's, and renaming it
 * means renaming every use of it, in script and in other entries' texts.
 */

import type { LocalizationFile } from '../index/localization.js';
import type { AdviceResult } from './advice.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'style/localization-key-characters';

/** What a key may hold. */
const ALLOWED = /[A-Za-z0-9_.]/;

/** What a key may start with. */
const FIRST = /[A-Za-z_]/;

/**
 * What is wrong with a key's characters, or null when nothing is: the first character when it
 * may stand in a key but not first (a digit, `.`), and every character that may not stand in a
 * key at all, each once, in the order written.
 */
export function keyProblem(
    key: string,
): { readonly first: string | null; readonly characters: readonly string[] } | null {
    const characters: string[] = [];
    for (const c of key) {
        if (!ALLOWED.test(c) && !characters.includes(c)) {
            characters.push(c);
        }
    }
    const head = key.charAt(0);
    const first = !FIRST.test(head) && ALLOWED.test(head) ? head : null;
    return first === null && characters.length === 0 ? null : { first, characters };
}

/** The words of a message saying what is wrong with a key. */
function wrongOf(problem: NonNullable<ReturnType<typeof keyProblem>>): string {
    const parts: string[] = [];
    if (problem.first !== null) {
        parts.push(
            problem.first >= '0' && problem.first <= '9'
                ? 'starts with a digit'
                : `starts with '${problem.first}'`,
        );
    }
    if (problem.characters.length > 0) {
        parts.push(`holds ${problem.characters.map((c) => `'${c}'`).join(', ')}`);
    }
    return parts.join(' and ');
}

/** Every key of a localization file that breaks the rule; `judged` counts the keys read. */
export function localizationKeyFindings(
    parsed: LocalizationFile,
    context: CheckContext,
): AdviceResult {
    const findings: CheckFinding[] = [];
    for (const entry of parsed.entries) {
        const problem = keyProblem(entry.key);
        if (problem === null) {
            continue;
        }
        findings.push(
            finding(
                CODE,
                { start: entry.start, end: entry.end },
                [entry.key, wrongOf(problem)],
                {
                    key: entry.key,
                    starts_with: problem.first ?? '',
                    characters: [...problem.characters],
                },
                context,
            ),
        );
    }
    return { judged: parsed.entries.length, findings };
}
