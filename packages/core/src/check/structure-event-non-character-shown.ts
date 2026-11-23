/**
 * `structure/event-non-character-shown` (docs/checks.md, item 4.5): an event whose scope is not
 * a character and that is neither hidden nor major. An error on the catalogue's
 * `error_in_event_X_non_character_events_must_be_hidden_or_be_n` ("Error in event '{}'.
 * Non-character events must be hidden, or be narrative events").
 *
 * Written by hand against that message, with its keywords from the spec package, part D4
 * (`keyword_roles`), confirmed roles only:
 *
 * - The keyword that sets the scope a record runs in: a row whose role `sets_root_scope` is
 *   confirmed (in 1.21.0.3, `scope` in `events`). Without it a record runs in its folder's
 *   root scope, the schema's `root_scope` (`character` for `events`; `events/_events.info`:
 *   "Optional, defaults to character scope").
 * - The keywords one of which such a record needs: a row whose role `one_of_required` is
 *   confirmed by this check's own catalogue message (an evidence item naming its id), with the
 *   keys it `pairs_with` (in 1.21.0.3, `hidden` and `major`). That "narrative" means `major` is
 *   the package's own reading of the message beside the `.info` line, not this check's.
 *
 * A record (`check/records.ts`) of the folder that sets its scope to a plain name other than
 * the root scope, and writes none of those keywords, is reported at its key. A keyword is
 * counted as written whatever its value: `hidden = no` is read as present, so the check can
 * miss an event but never reports one the game accepts. A scope written as anything but a
 * plain name (`$SCOPE$`, a chain) is not judged.
 */

import type { FolderTable } from '../index/folders.js';
import type { KeywordRoleRow } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import type { FileNode } from '../syntax/tree.js';
import { CHECK_KINDS, type CheckFinding } from './finding.js';
import { recordsOf } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'structure/event-non-character-shown';

/** The roles of part D4 the check reads. */
const SETS_ROOT_SCOPE = 'sets_root_scope';
const ONE_OF_REQUIRED = 'one_of_required';

/** What the check reads. */
export interface NonCharacterInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
}

/** The keywords the check reads for a folder, or null when D4 gives it none. */
export interface ShownRule {
    /** The keyword that sets a record's scope. */
    readonly scopeKey: string;
    /** The keywords one of which a record of another scope needs. */
    readonly needs: readonly string[];
}

function inFolder(row: KeywordRoleRow, folder: string): boolean {
    return row.where.directories === 'anywhere' || row.where.directories.includes(folder);
}

/** The keywords of the rule for a folder (see the head of this file), or null. */
export function shownRuleOf(spec: Spec, folder: string): ShownRule | null {
    const rows = (spec.part('keyword_roles')?.keywords ?? []).filter((r) => inFolder(r, folder));
    const scope = rows.find((r) => r.role_status[SETS_ROOT_SCOPE] === 'confirmed');
    const message = CHECK_KINDS[CODE].catalogue;
    const needing = rows.filter(
        (r) =>
            r.role_status[ONE_OF_REQUIRED] === 'confirmed' &&
            r.evidence.some((e) => e['id'] === message),
    );
    if (scope === undefined || needing.length === 0) {
        return null;
    }
    const needs = new Set<string>();
    for (const row of needing) {
        needs.add(row.keyword);
        const pairs = row['pairs_with'];
        for (const key of Array.isArray(pairs) ? (pairs as unknown[]) : []) {
            if (typeof key === 'string') {
                needs.add(key);
            }
        }
    }
    return { scopeKey: scope.keyword, needs: [...needs].sort() };
}

export function nonCharacterShownEvents(
    context: CheckContext,
    input: NonCharacterInput,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    const folder = records.folder;
    const root = records.schema?.root_scope;
    if (folder === null || root === undefined) {
        return out;
    }
    const rule = shownRuleOf(input.spec, folder.path);
    if (rule === null) {
        return out;
    }
    for (const record of records.records) {
        let scope: string | null = null;
        let needed = false;
        for (const item of record.body.items) {
            if (item.kind !== 'pair') {
                continue;
            }
            if (item.key.text === rule.scopeKey && item.value?.kind === 'scalar') {
                scope =
                    item.value.type === 'name' && !item.value.text.includes('$')
                        ? item.value.text
                        : null;
            } else if (rule.needs.includes(item.key.text)) {
                needed = true;
            }
        }
        if (scope === null || scope === root || needed) {
            continue;
        }
        const id = record.pair.key.text;
        out.push(
            finding(
                CODE,
                record.pair.key,
                [id],
                { event: id, scope, root_scope: root, needs: rule.needs },
                context,
            ),
        );
    }
    return out;
}
