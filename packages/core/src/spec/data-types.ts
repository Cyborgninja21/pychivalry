/**
 * The data-types companion (part C3): the game's own `dump_data_types` output, the functions
 * usable in localization and GUI. A name can have several entries (a global can be both a
 * promote and a function), so every lookup here returns a list, empty when the dump has none.
 * Nothing reads it before the localization bracket checks after the MVP; it is typed here so
 * that the reader is complete.
 */

import type { Spec } from './reader.js';

/** One entry of the dump: a global, a type, or a member of a type. */
export interface DataTypeEntry {
    readonly name: string;
    readonly kind: string;
    readonly owner: string | null;
    readonly args: unknown;
    readonly description: string | null;
    readonly macro_replacement: string | null;
    readonly definition_type: string;
    readonly return_type: string | null;
    readonly source: { readonly file: string; readonly line: number };
}

interface TypeRecord {
    readonly definitions: readonly DataTypeEntry[];
    readonly members: Readonly<Record<string, readonly DataTypeEntry[]>>;
}

const NONE: readonly DataTypeEntry[] = [];

function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/** Lookups in the data-types dump. */
export class DataTypes {
    private readonly globals: Readonly<Record<string, readonly DataTypeEntry[]>>;
    private readonly types: Readonly<Record<string, TypeRecord>>;

    constructor(data: Readonly<Record<string, unknown>>) {
        this.globals = (data['globals'] ?? {}) as Readonly<Record<string, readonly DataTypeEntry[]>>;
        this.types = (data['types'] ?? {}) as Readonly<Record<string, TypeRecord>>;
    }

    /** Every entry of a global name (`GetPlayer`). */
    global(name: string): readonly DataTypeEntry[] {
        return own(this.globals, name) ?? NONE;
    }

    /** Every definition of a type (`Character`). */
    type(name: string): readonly DataTypeEntry[] {
        return own(this.types, name)?.definitions ?? NONE;
    }

    /** Every entry of a member of a type (`Character`, `GetPrimaryTitle`). */
    member(type: string, name: string): readonly DataTypeEntry[] {
        const record = own(this.types, type);
        return record === undefined ? NONE : (own(record.members, name) ?? NONE);
    }

    /** How many global names and type names the dump holds. */
    get counts(): { readonly globals: number; readonly types: number } {
        return { globals: Object.keys(this.globals).length, types: Object.keys(this.types).length };
    }
}

const cache = new WeakMap<Spec, DataTypes>();

/** The data-types dump of a package, opened (and checked) the first time it is asked for. */
export function dataTypesOf(spec: Spec): DataTypes {
    let types = cache.get(spec);
    if (types === undefined) {
        types = new DataTypes(spec.companion('data_types').data);
        cache.set(spec, types);
    }
    return types;
}
