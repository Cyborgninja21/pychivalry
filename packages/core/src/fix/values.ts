/**
 * The fixes that choose among values a finding's own data lists, and the fixes of text inside
 * a localization entry:
 *
 * - `fields/unusual-value` (a hint): the values the base game writes in the field that are near
 *   the one written; `structure/event-unknown-type`: the documented event types near the one
 *   written. Suggestions: both are advice, and the value may be one the mod defines.
 * - `fields/wrong-kind-of-value`: the values the base game writes in the field, when it writes
 *   a small set of them (`yes` and `no` where `maybe` is written). A suggestion.
 * - `structure/event-undeclared-namespace`: an event whose namespace its file does not declare.
 *   The id written with a namespace the file declares that is near the one written, when no
 *   event has that id yet; and the namespace declared at the top of the file. A suggestion.
 * - `localization/unbalanced-brackets`: for an extra `[`, the statement still open before it
 *   closed after its command (`[ROOT.Char.GetFirstName [x]` gives `[ROOT.Char.GetFirstName]
 *   [x]`); for an extra `]`, a statement opened before the command it closes; and the extra
 *   bracket taken away. Each offered only where the entry is then balanced, as the check reads
 *   it. Suggestions: which bracket is wrong is a choice.
 */

import { extraBracket } from '../check/localization-unbalanced-brackets.js';
import { listCandidates } from './candidates.js';
import { dataList, dataText, type FixableFinding, type FixFile } from './file.js';
import { MAX_FIX_ALTERNATIVES, suggestion, type FindingFix, type FixAlternative } from './fix.js';
import { nearNames } from './near-name.js';
import { replaceValue } from './unknown-name.js';

function nearValues(
    finding: FixableFinding,
    file: FixFile,
    written: string,
    values: readonly string[],
): FindingFix | null {
    const { near } = nearNames(written, listCandidates(values));
    return suggestion(
        'observed-values',
        near.map((v) => replaceValue(file, finding.start, finding.end, v)),
    );
}

export function unusualValueFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const value = dataText(finding.data, 'value');
    return value === null
        ? null
        : nearValues(finding, file, value, dataList(finding.data, 'observed'));
}

export function unknownEventTypeFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const type = dataText(finding.data, 'type');
    return type === null ? null : nearValues(finding, file, type, dataList(finding.data, 'types'));
}

export function wrongKindFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const values = dataList(finding.data, 'values');
    if (
        values.length === 0 ||
        values.length > MAX_FIX_ALTERNATIVES ||
        dataText(finding.data, 'values_total') !== null ||
        file.slice(finding.start, finding.end).startsWith('{')
    ) {
        return null;
    }
    return suggestion(
        'observed-values',
        values.map((v) => replaceValue(file, finding.start, finding.end, v)),
    );
}

export function undeclaredNamespaceFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const namespace = dataText(finding.data, 'namespace');
    // The finding is at the event's key: its id as written.
    const event = file.slice(finding.start, finding.end);
    const folder = file.input.folders.classify(file.file)?.folder.path;
    if (namespace === null || folder === undefined || !event.startsWith(namespace)) {
        return null;
    }
    const rest = event.slice(namespace.length);
    const alternatives: FixAlternative[] = [];
    const declared = dataList(finding.data, 'declared');
    for (const other of nearNames(namespace, listCandidates(declared)).near) {
        const id = `${other}${rest}`;
        if (!file.input.names.isDefined(id, folder)) {
            alternatives.push({
                title: `Write the event's id with the declared namespace: ${id}`,
                edits: [file.replace(finding.start, finding.start + namespace.length, other)],
            });
        }
    }
    alternatives.push({
        title: `Declare the namespace ${namespace} at the top of the file`,
        edits: [file.insert(0, `namespace = ${namespace}${file.newline}`)],
    });
    return suggestion('declared-names', alternatives);
}

/** The run of a statement's command: what follows a `[` up to a space, a bracket or a quote. */
const COMMAND = /^[^\s[\]"]+/;

/**
 * A statement's command as a fix may close or open it: a name, a scope or a `$name$` first, its
 * parentheses balanced, without the punctuation of the sentence around it (a comma, a full
 * stop). Undefined when the run is no such command (`#!`, a formatting code; `más)`).
 */
function commandOf(run: string | undefined): string | undefined {
    const command = run?.replace(/[,.;:!?]+$/, '');
    if (command === undefined || !/^[A-Za-z_$]/.test(command)) {
        return undefined;
    }
    let depth = 0;
    for (const ch of command) {
        depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
        if (depth < 0) {
            return undefined;
        }
    }
    return depth === 0 ? command : undefined;
}

/** The text of the localization entry a finding is in, and where it starts in the file. */
function entryText(
    file: FixFile,
    at: number,
): { readonly start: number; readonly text: string } | null {
    const entry = file.localization?.entries.find((e) => e.textStart <= at && at < e.textEnd);
    return entry === undefined
        ? null
        : { start: entry.textStart, text: file.text.slice(entry.textStart, entry.textEnd) };
}

export function unbalancedBracketFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const bracket = dataText(finding.data, 'bracket');
    const at = finding.start;
    const entry = entryText(file, at);
    if (bracket === null || entry === null || file.text.charAt(at) !== bracket) {
        return null;
    }
    const inEntry = at - entry.start;
    const candidates: { title: string; at: number; remove: boolean; text: string }[] = [];
    if (bracket === '[') {
        // The statement still open is the last `[` before this one: close it after its command.
        const open = entry.text.lastIndexOf('[', inEntry - 1);
        const command =
            open < 0 ? undefined : commandOf(COMMAND.exec(entry.text.slice(open + 1))?.[0]);
        if (command !== undefined && open + 1 + command.length <= inEntry) {
            candidates.push({
                title: `Close the statement [${command} with ']'`,
                at: open + 1 + command.length,
                remove: false,
                text: ']',
            });
        }
    } else {
        // A `]` with no statement open: open one before the command it closes.
        const before = entry.text.slice(0, inEntry);
        const run = /[^\s[\]"]+$/.exec(before)?.[0];
        const command = commandOf(run);
        if (command !== undefined && command === run) {
            candidates.push({
                title: `Open the statement ${command}] with '['`,
                at: inEntry - command.length,
                remove: false,
                text: '[',
            });
        }
    }
    candidates.push({
        title: `Remove the extra '${bracket}'`,
        at: inEntry,
        remove: true,
        text: '',
    });
    // Offered only where the entry is balanced after it, as the check reads it.
    const balanced = candidates.filter((c) => {
        const changed = c.remove
            ? entry.text.slice(0, c.at) + entry.text.slice(c.at + 1)
            : entry.text.slice(0, c.at) + c.text + entry.text.slice(c.at);
        return extraBracket(changed) === undefined;
    });
    return suggestion(
        'parser',
        balanced.map((c) => ({
            title: c.title,
            edits: [
                c.remove
                    ? file.replace(entry.start + c.at, entry.start + c.at + 1, '')
                    : file.insert(entry.start + c.at, c.text),
            ],
        })),
    );
}
