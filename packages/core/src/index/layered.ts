/**
 * A map that can be forked (docs/shared-index.md): the fork sees every entry of the map it was
 * forked from and keeps its own changes apart, copying an entry's value only when it changes it
 * (`mutable`); the map forked from is frozen from then on. A fork is iterated in the order a
 * single `Map` would give had it been made by the same changes in the same order: the entries of
 * the map forked from in their order, a value changed in place where it stands, then the keys
 * the fork added (or removed and added again) in the order it added them.
 */

export class LayeredMap<K, V> {
    private readonly own = new Map<K, V>();
    /** The map this one was forked from, or null. */
    private readonly base: LayeredMap<K, V> | null;
    /** Keys of the base whose place in the base's order no longer holds here: removed here. */
    private readonly moved = new Set<K>();
    private frozen = false;

    constructor(base: LayeredMap<K, V> | null = null) {
        this.base = base;
    }

    /** A map over this one; this one changes no more. */
    fork(): LayeredMap<K, V> {
        this.frozen = true;
        return new LayeredMap(this);
    }

    private change(): void {
        if (this.frozen) {
            throw new Error('the map is shared by a fork and changes no more');
        }
    }

    /** True when the key is the base's, at the base's place. */
    private inherits(key: K): boolean {
        return this.base !== null && !this.moved.has(key) && this.base.has(key);
    }

    get(key: K): V | undefined {
        const value = this.own.get(key);
        if (value !== undefined || this.base === null || this.moved.has(key)) {
            return value;
        }
        return this.base.get(key);
    }

    has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    set(key: K, value: V): this {
        this.change();
        this.own.set(key, value);
        return this;
    }

    delete(key: K): boolean {
        this.change();
        const had = this.has(key);
        this.own.delete(key);
        if (this.base?.has(key) === true) {
            this.moved.add(key);
        }
        return had;
    }

    /**
     * The value of `key` that this map may change in place: its own, or the base's copied with
     * `copy` the first time; undefined when the key has no value.
     */
    mutable(key: K, copy: (value: V) => V): V | undefined {
        this.change();
        const value = this.own.get(key);
        if (value !== undefined || this.base === null || this.moved.has(key)) {
            return value;
        }
        const inherited = this.base.get(key);
        if (inherited === undefined) {
            return undefined;
        }
        const mine = copy(inherited);
        this.own.set(key, mine);
        return mine;
    }

    *entries(): Generator<[K, V]> {
        if (this.base === null) {
            yield* this.own.entries();
            return;
        }
        for (const [key, value] of this.base.entries()) {
            if (!this.moved.has(key)) {
                yield [key, this.own.get(key) ?? value];
            }
        }
        for (const [key, value] of this.own) {
            if (!this.inherits(key)) {
                yield [key, value];
            }
        }
    }

    *keys(): Generator<K> {
        for (const [key] of this.entries()) {
            yield key;
        }
    }

    [Symbol.iterator](): Generator<[K, V]> {
        return this.entries();
    }
}
