/**
 * Interned strings: every name, path and database in the index is stored once and referred to
 * by a number, so that millions of definitions and uses fit in packed integer arrays.
 */

export class StringTable {
    private readonly ids = new Map<string, number>();
    private readonly values: string[] = [];

    /** A table holding `values` in this order, as a cache file stores them. */
    static from(values: readonly string[]): StringTable {
        const table = new StringTable();
        for (const value of values) {
            table.intern(value);
        }
        return table;
    }

    /** The number of a string, adding it if it is new. */
    intern(value: string): number {
        let id = this.ids.get(value);
        if (id === undefined) {
            id = this.values.length;
            this.ids.set(value, id);
            this.values.push(value);
        }
        return id;
    }

    /** The number of a string, or -1 when the table does not hold it. */
    find(value: string): number {
        return this.ids.get(value) ?? -1;
    }

    /** The string with a number. */
    get(id: number): string {
        const value = this.values[id];
        if (value === undefined) {
            throw new RangeError(`no string ${String(id)} in the table`);
        }
        return value;
    }

    get size(): number {
        return this.values.length;
    }

    /** Every string, in the order of their numbers. */
    all(): readonly string[] {
        return this.values;
    }
}
