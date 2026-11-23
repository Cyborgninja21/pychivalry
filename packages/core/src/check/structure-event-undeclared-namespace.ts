/**
 * `structure/event-undeclared-namespace` (docs/checks.md, item 4.5): an event whose namespace
 * its file does not declare, including every event of a file that declares none. A warning
 * on the catalogue's `namespace_X_used_in_event_X_file_X_is_not_defined_in_this_fi`
 * ("Namespace '{}' used in event '{}' (file: {}) is not defined in this file - it might not
 * load properly.").
 *
 * Written by hand against that message, with its keywords from the spec package:
 *
 * - The declaration: a confirmed row of part D2 (`declarations`) for the file's folder that
 *   declares a namespace for its file (`declares: namespace`, `scope: file`; in 1.21.0.3,
 *   `namespace = x` in `events`). Its value is a namespace the file declares.
 * - What the namespace names: a confirmed row of part D4 (`keyword_roles`) for the same key
 *   and folder whose role `id_prefix` is confirmed: the namespace is the first part of the ids
 *   of the records of its file, `<namespace>.<number>` (the executable's own wording: "in the
 *   form of 'namespace.integer'").
 *
 * A record (`check/records.ts`) whose key is `<prefix>.<number>` uses the namespace
 * `<prefix>`; when no declaration of the file gives it, the record is reported at its key. A
 * key not of that form is no event id and is not judged here.
 */

import type { FolderTable } from '../index/folders.js';
import { keyMatcher } from '../index/folders.js';
import type { Spec } from '../spec/reader.js';
import type { FileNode } from '../syntax/tree.js';
import type { CheckFinding } from './finding.js';
import { holdsIn, keywordRolesOf, roleConfirmed } from './keyword-roles.js';
import { recordsOf } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'structure/event-undeclared-namespace';

/** The role of part D4 that makes a key the first part of its file's record ids. */
const ID_PREFIX = 'id_prefix';

/** What the check reads. */
export interface NamespaceInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
}

/** The declarations of a folder that name its files' id prefixes: D2 rows that D4 confirms. */
export function namespaceDeclarations(
    spec: Spec,
    folder: string,
): readonly { readonly key: string; readonly match: string }[] {
    const roles = keywordRolesOf(spec).rows;
    return (spec.part('declarations')?.directories[folder] ?? []).filter(
        (row) =>
            row.status === 'confirmed' &&
            row.declares === 'namespace' &&
            row.scope === 'file' &&
            roles.some(
                (role) =>
                    role.keyword === row.key &&
                    roleConfirmed(role, ID_PREFIX) &&
                    holdsIn(role, folder),
            ),
    );
}

/** The id prefix of a key written `<prefix>.<number>`, or null. */
export function idPrefixOf(key: string): string | null {
    const match = /^(.+)\.[0-9]+$/.exec(key);
    return match?.[1] ?? null;
}

export function undeclaredNamespaces(context: CheckContext, input: NamespaceInput): CheckFinding[] {
    const out: CheckFinding[] = [];
    const folder = input.folders.classify(input.file)?.folder;
    if (folder === undefined) {
        return out;
    }
    const declarations = namespaceDeclarations(input.spec, folder.path);
    if (declarations.length === 0) {
        return out;
    }
    const declared = new Set<string>();
    for (const item of input.tree.items) {
        if (
            item.kind === 'pair' &&
            item.prefix === null &&
            item.value?.kind === 'scalar' &&
            declarations.some((d) => keyMatcher(d.key, d.match)(item.key.text))
        ) {
            declared.add(item.value.value);
        }
    }
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    for (const record of records.records) {
        const id = record.pair.key.text;
        const prefix = idPrefixOf(id);
        if (prefix === null || declared.has(prefix)) {
            continue;
        }
        out.push(
            finding(
                CODE,
                record.pair.key,
                [prefix, id, input.file],
                { namespace: prefix, event: id, declared: [...declared].sort() },
                context,
            ),
        );
    }
    return out;
}
