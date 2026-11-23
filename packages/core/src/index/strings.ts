/**
 * Interned strings: every name, path and database in the index is stored once and referred to
 * by a number, so that millions of definitions and uses fit in packed integer arrays.
 *
 * A table can be forked (`fork`): the fork holds every string of this one under the same
 * numbers and numbers the strings it adds after them, and this table is frozen from then on, so
 * that the numbers it gave stay the fork's (docs/shared-index.md).
 */

export class StringTable {
    private readonly ids = new Map<string, number>();
    private readonly values: string[] = [];
    /** The table this one was forked from, or null. */
    private readonly parent: StringTable | null;
    /** The number of the first string this table adds: the parent's size when forked. */
    private readonly offset: number;
    private frozen = false;

    constructor(parent: StringTable | null = null) {
        this.parent = parent;
        this.offset = parent?.size ?? 0;
    }

    /** A table holding `values` in this order, as a cache file stores them. */
    static from(values: readonly string[]): StringTable {
        const table = new StringTable();
        for (const value of values) {
            table.intern(value);
        }
        return table;
    }

    /**
     * A table over this one: every string of this one under the same number, and room for more.
     * This table adds no string from then on.
     */
    fork(): StringTable {
        this.frozen = true;
        return new StringTable(this);
    }

    /** The number of a string, adding it if it is new. */
    intern(value: string): number {
        if (this.parent !== null) {
            const inherited = this.parent.find(value);
            if (inherited >= 0) {
                return inherited;
            }
        }
        let id = this.ids.get(value);
        if (id === undefined) {
            if (this.frozen) {
                throw new Error('the string table is shared by a fork and adds no string');
            }
            id = this.offset + this.values.length;
            this.ids.set(value, id);
            this.values.push(value);
        }
        return id;
    }

    /** The number of a string, or -1 when the table does not hold it. */
    find(value: string): number {
        if (this.parent !== null) {
            const inherited = this.parent.find(value);
            if (inherited >= 0) {
                return inherited;
            }
        }
        return this.ids.get(value) ?? -1;
    }

    /** The string with a number. */
    get(id: number): string {
        if (id < this.offset && this.parent !== null) {
            return this.parent.get(id);
        }
        const value = this.values[id - this.offset];
        if (value === undefined) {
            throw new RangeError(`no string ${String(id)} in the table`);
        }
        return value;
    }

    get size(): number {
        return this.offset + this.values.length;
    }

    /** Every string, in the order of their numbers. */
    all(): readonly string[] {
        return this.parent === null ? this.values : [...this.parent.all(), ...this.values];
    }
}
