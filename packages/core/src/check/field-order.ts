/**
 * The order the fields of a folder's records are conventionally written in: pychivalry's own
 * data (`field-order.json` beside this file), not the game's. Two things read it: the language
 * server's completion, which offers a block's fields in this order, and the best-practice rule
 * `style/unusual-field-order`, which flags a record written in another order where the order
 * has no meaning to the game.
 *
 * It was part of the language server's presentation data (item 8.8) and moved here on
 * the owner's word of 2026-11-23, when a check came to need it: the presentation data is the
 * language server's alone and no check may be handed it, so the field order became data of
 * the core, which every surface (the command line, the agent server, the language server, the
 * game-file suites) runs, and they all judge with the one copy. The sets of fields are those the
 * presentation data had, the pre-2.0 schema files'. Six orders are ranked by the base game's
 * majority order; the two folders of `from_info` (`common/decisions` and
 * `common/character_interactions`) take the order their fields have in the folder's own `.info`
 * file, Paradox's documentation (the spec package's companion `info_docs`), on the owner's word
 * of 2026-11-23: the evidence first, the base game's habit only where no `.info` file orders the
 * fields. Every field it names is a field of its folder's record schema in the committed spec
 * package, and each `from_info` order is the `.info` file's, which tests hold
 * (`style-unusual-field-order.test.ts`); it adds no name to the vocabulary.
 */

import data from './field-order.json' with { type: 'json' };

/** The order of the fields of one block of a folder's records. */
export interface FieldOrder {
    /** The path of keys from the record's body to the block, joined by `.`; `""` the body. */
    readonly block: string;
    readonly fields: readonly string[];
}

function read(value: unknown): ReadonlyMap<string, readonly FieldOrder[]> {
    const folders =
        typeof value === 'object' && value !== null
            ? (value as Record<string, unknown>)['folders']
            : undefined;
    if (typeof folders !== 'object' || folders === null) {
        throw new Error('field-order.json: no folders');
    }
    const out = new Map<string, readonly FieldOrder[]>();
    for (const [folder, orders] of Object.entries(folders)) {
        if (!Array.isArray(orders)) {
            throw new Error(`field-order.json: ${folder} is not a list`);
        }
        out.set(
            folder,
            (orders as unknown[]).map((o) => {
                const order = o as { block?: unknown; fields?: unknown };
                if (
                    typeof order.block !== 'string' ||
                    !Array.isArray(order.fields) ||
                    !order.fields.every((f) => typeof f === 'string')
                ) {
                    throw new Error(`field-order.json: ${folder} has an order out of the format`);
                }
                return { block: order.block, fields: order.fields };
            }),
        );
    }
    return out;
}

function folderList(value: unknown, key: 'judged' | 'from_info'): ReadonlySet<string> {
    const list =
        typeof value === 'object' && value !== null
            ? (value as Record<string, unknown>)[key]
            : undefined;
    if (!Array.isArray(list) || !list.every((f) => typeof f === 'string')) {
        throw new Error(`field-order.json: ${key} is not a list of folders`);
    }
    return new Set(list);
}

/** Every folder's field orders, by the folder's path as the spec package writes it. */
export const FIELD_ORDERS: ReadonlyMap<string, readonly FieldOrder[]> = read(data);

/**
 * The folders whose record bodies `style/unusual-field-order` judges: every folder with an order,
 * on the owner's word of 2026-11-23 (best practice over what the base game writes). Each folder's
 * base-game rate is counted on 1.21.0.3 by `pychivalry-tools advice proof`.
 */
export const JUDGED_FOLDERS: ReadonlySet<string> = folderList(data, 'judged');

/**
 * The folders whose order is the order of their fields in the folder's own `.info` file (the
 * spec package's companion `info_docs`), not the base game's majority order.
 */
export const INFO_ORDER_FOLDERS: ReadonlySet<string> = folderList(data, 'from_info');

/** The order of the fields of a folder's record bodies, or undefined when it has none. */
export function bodyFieldOrder(folder: string): readonly string[] | undefined {
    return FIELD_ORDERS.get(folder)?.find((o) => o.block === '')?.fields;
}
