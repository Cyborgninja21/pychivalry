/**
 * The checks of definitions (docs/checks.md, item 4.5), from what the workspace index says of
 * each definition of a file: the index's statuses become findings as docs/checks.md's
 * "The step 2 identifiers and the index's statuses" sets out.
 *
 * - `definitions/clash` (error): the definition is one of several the rules table says the
 *   game calls an error (`clash`: two events with one id and the same `id_override_priority`).
 *   The evidence is the message the deciding row names: its `message`, a part D1 row of kind
 *   `duplicate-message`, whose `catalogue` entry the catalogue holds. A row whose status is
 *   partial or open decides nothing, so a name it alone would answer is "winner not known"
 *   and is not a clash: nothing is reported.
 * - `definitions/not-read` (information, advice): the definition is in a file the rules table
 *   says the game does not read (replaced by another layer's file, hidden by `replace_path`,
 *   a folder written in another letter case, a subfolder not listed). The rules row has game
 *   evidence, but the game prints nothing for a file it skips, so this is advice. A file whose
 *   read status is unknown is not reported.
 *
 * Both need the index and the layer the file is in; without them they are silent.
 */

import type { Definition, FileStatus, WorkspaceIndex } from '../index/workspace.js';
import type { Spec } from '../spec/reader.js';
import type { Evidence } from '../syntax/findings.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CLASH = 'definitions/clash';
export const NOT_READ = 'definitions/not-read';

/** The index and the layer a checked file is in. */
export interface DefinitionsInput {
    readonly workspace: WorkspaceIndex;
    readonly layer: string;
}

/** The kind of part D1 row that holds the game's message for a duplicate. */
const DUPLICATE_MESSAGE = 'duplicate-message';

/** The catalogue entry of the message a rules row names, or null when it names none held. */
export function clashMessageOf(spec: Spec, rule: string): string | null {
    const rows = spec.part('override_rules')?.rules ?? [];
    const message = rows.find((row) => row['id'] === rule)?.['message'];
    const row = rows.find((r) => r['id'] === message && r['kind'] === DUPLICATE_MESSAGE);
    const entries = row?.['catalogue'];
    for (const entry of Array.isArray(entries) ? (entries as unknown[]) : []) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const { held, id } = entry as { held?: unknown; id?: unknown };
        if (held === true && typeof id === 'string') {
            return id;
        }
    }
    return null;
}

/** The priority a definition has when it writes none: the rules row's `priority_default`. */
function priorityDefault(spec: Spec, rule: string): number {
    const value = (spec.part('override_rules')?.rules ?? []).find((row) => row['id'] === rule)?.[
        'priority_default'
    ];
    return typeof value === 'number' ? value : 0;
}

/** Why the game does not read a file, in a few words, from its status. */
function notReadReason(status: FileStatus | undefined): string {
    if (status?.replacedBy !== null && status?.replacedBy !== undefined) {
        const by = status.replacedBy;
        return `${by.layer}:${by.path} replaces it (${by.rule})`;
    }
    if (status?.hiddenBy !== null && status?.hiddenBy !== undefined) {
        return `replace_path ${status.hiddenBy.path} hides it (${status.hiddenBy.rule})`;
    }
    if (status?.notReadBecause !== null && status?.notReadBecause !== undefined) {
        return `the rule ${status.notReadBecause.rule}`;
    }
    return 'the rules table';
}

function span(definition: Definition): { readonly start: number; readonly end: number } {
    return { start: definition.start, end: definition.end };
}

export function definitionFindings(
    spec: Spec,
    file: string,
    context: CheckContext,
    input: DefinitionsInput | undefined,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    if (input === undefined) {
        return out;
    }
    const definitions = input.workspace.definitionsIn(input.layer, file);
    const status = input.workspace.fileStatus(input.layer, file);
    for (const definition of definitions) {
        if (definition.read === 'no') {
            out.push(
                finding(
                    NOT_READ,
                    span(definition),
                    [definition.name, notReadReason(status)],
                    { name: definition.name, database: definition.database },
                    context,
                ),
            );
            continue;
        }
        const resolution = input.workspace.resolve(
            definition.database,
            definition.name,
            definition.container,
        );
        if (resolution.status !== 'clash') {
            continue;
        }
        const id = clashMessageOf(spec, resolution.rule);
        if (id === null) {
            // A row that names no message the catalogue holds gives the clash no game evidence.
            continue;
        }
        const evidence: Evidence = {
            kind: 'catalogue',
            id,
            text: context.catalogue?.get(id) ?? null,
        };
        const others = resolution.definitions.filter(
            (d) =>
                !(
                    d.layer === definition.layer &&
                    d.file === definition.file &&
                    d.start === definition.start
                ),
        );
        out.push(
            finding(
                CLASH,
                span(definition),
                [
                    definition.name,
                    String(definition.priority ?? priorityDefault(spec, resolution.rule)),
                ],
                {
                    name: definition.name,
                    database: definition.database,
                    rule: resolution.rule,
                    others: others.map(
                        (d) => `${d.layer}:${d.file}:${String(d.range.start.line + 1)}`,
                    ),
                },
                context,
                evidence,
            ),
        );
    }
    return out;
}
