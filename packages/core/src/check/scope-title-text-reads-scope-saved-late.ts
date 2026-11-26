/**
 * `scope/title-text-reads-scope-saved-late` (docs/checks.md, item 4.7, carried over
 * provisionally): the localization text of an event's `title` reads a scope the event saves only
 * in an option or in `after`, so the title is shown before the scope exists. Advice: re-proved on
 * the 1.21.0.3 base game, where it fires on none of the events it judges.
 *
 * The keywords are part D4's, as `scope/saved-late-read-in-desc` reads them: the title (the event
 * row with the role `text` whose block form is a dynamic description and which is not
 * `required`), the fire condition (`fire_condition`), the block run when the event fires
 * (`runs_before_options`), the options (`event_option`) and the block that needs them
 * (`needs_sibling`). A scope is saved late when the options or that block save it and neither the
 * fire condition nor the block run when it fires does. The title's localization keys are its own
 * value, or, in its block form, the value of each `desc` (the row with the role `text` that holds
 * anywhere) written directly in a block of a key the row names as its parent.
 *
 * What a key's text reads is the index's reading of it (`WorkspaceNames.textScopeReads`), by part
 * D9's forms: the head of a chain (`saved_scope_head`, confirmed) and the functions whose argument
 * is a saved name (`TopScope.sC` and its kin, measured only). A measured-only form is read
 * because this check is advice (information): it claims nothing as the game's; a form of status
 * `unknown` is not read. A first word that is a global of the data types (part C3: `GetPlayer`) is
 * no saved name. Every language of the key is read, in the mod and the base game.
 */

import { dataTypesOf } from '../spec/data-types.js';
import type { Spec } from '../spec/reader.js';
import type { Block, Pair, Scalar } from '../syntax/tree.js';
import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { eventModelOf, eventRow, eventRows, eventsOf } from './advice-events.js';
import { savedIn } from './advice-scopes.js';
import type { CheckFinding } from './finding.js';
import { bodyOf, childPairs, keywordRolesOf, type RoleRow } from './keyword-roles.js';
import type { WorkspaceNames } from './names.js';
import { finding } from './report.js';
import { blockOf, significantItems } from '../syntax/tree.js';

export const CODE = 'scope/title-text-reads-scope-saved-late';

/** The D4 role of a keyword whose value is the localization key of a text. */
const TEXT = 'text';
/** The D4 vocabulary's block form of a dynamic description. */
const DYNAMIC_DESCRIPTION = 'dynamic_description';

/** The event's title: its row of role `text` that opens a dynamic description and is not required. */
export function titleRow(spec: Spec): RoleRow | undefined {
    const rows = eventRows(eventModelOf(spec), TEXT).filter(
        (r) => r.row['opens'] === DYNAMIC_DESCRIPTION && !r.roles.has('required'),
    );
    return rows.length === 1 ? rows[0] : undefined;
}

/** The text keyword of a dynamic description: the row of role `text` that holds anywhere. */
export function textRow(spec: Spec): RoleRow | undefined {
    const rows = keywordRolesOf(spec)
        .withRoles(TEXT)
        .filter((r) => r.directories === 'anywhere' && r.parents.length > 0);
    return rows.length === 1 ? rows[0] : undefined;
}

/** The localization keys a title names: its value, or each text of its dynamic description. */
export function titleKeys(pair: Pair, text: RoleRow): Scalar[] {
    if (pair.value?.kind === 'scalar') {
        return [pair.value];
    }
    const out: Scalar[] = [];
    const walk = (block: Block, parentKey: string): void => {
        for (const item of significantItems(block)) {
            if (item.kind !== 'pair') {
                continue;
            }
            if (
                item.key.text === text.keyword &&
                text.parents.includes(parentKey) &&
                item.value?.kind === 'scalar'
            ) {
                out.push(item.value);
            }
            const inner = blockOf(item.value);
            if (inner !== undefined) {
                walk(inner, item.key.text);
            }
        }
    };
    const body = bodyOf(pair);
    if (body !== undefined) {
        walk(body, pair.key.text);
    }
    return out;
}

function run(input: AdviceInput): AdviceResult {
    const reads = (input.names as Partial<WorkspaceNames>).textScopeReads;
    const model = eventModelOf(input.spec);
    const title = titleRow(input.spec);
    const text = textRow(input.spec);
    const early = [eventRow(model, 'fire_condition'), eventRow(model, 'runs_before_options')];
    const late = [eventRow(model, 'event_option'), eventRow(model, 'needs_sibling')];
    if (
        reads === undefined ||
        title === undefined ||
        text === undefined ||
        early.some((r) => r === undefined) ||
        late.some((r) => r === undefined)
    ) {
        return NOTHING;
    }
    const earlyKeys = early.flatMap((r) => (r === undefined ? [] : [r.keyword]));
    const lateKeys = late.flatMap((r) => (r === undefined ? [] : [r.keyword]));
    const blocksOf = (body: Block, keys: readonly string[]): Block[] =>
        keys.flatMap((k) => childPairs(body, k).flatMap((p) => bodyOf(p) ?? []));
    const isGlobal = (name: string): boolean => dataTypesOf(input.spec).global(name).length > 0;
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        const titles = childPairs(event.body, title.keyword);
        if (titles.length === 0) {
            continue;
        }
        const saved = savedIn(input.folders, blocksOf(event.body, earlyKeys));
        const onlyLate = [...savedIn(input.folders, blocksOf(event.body, lateKeys))].filter(
            (n) => !saved.has(n),
        );
        if (onlyLate.length === 0) {
            continue;
        }
        judged++;
        for (const pair of titles) {
            for (const key of titleKeys(pair, text)) {
                for (const name of reads.call(input.names, key.value)) {
                    if (!onlyLate.includes(name) || isGlobal(name)) {
                        continue;
                    }
                    findings.push(
                        finding(
                            CODE,
                            key,
                            [key.value, name, either(lateKeys)],
                            {
                                key: key.value,
                                scope: name,
                                block: title.keyword,
                                saved_in: lateKeys,
                            },
                            input.context,
                        ),
                    );
                }
            }
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
