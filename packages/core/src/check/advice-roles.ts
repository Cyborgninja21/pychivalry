/**
 * The keyword roles of part D4 (`keyword_roles`), as the advice checks of item 4.7 read them
 * (docs/checks.md, "4.7: advice that holds on 1.21"). Every keyword such a check tests comes
 * from a row here: its word, where it holds (`where`: the folders and the parent keys), its
 * roles and their qualifiers (`follows`, `pairs_with`, `needs`, `range`). The core writes no
 * keyword: a check names a role of the part's vocabulary, never a word.
 *
 * Every row may feed advice, whatever its status: a check built on a measured-only role is
 * advice (the part's own `consumer` text), and every check here is advice. A row that adds no
 * role (`stated-elsewhere`) is read for the roles its `stated_elsewhere` names.
 *
 * A condition the part states only in words (`condition`) is read from the row's measurement,
 * as `condition_from: measured` says the package itself does: a count of `measured.counts`
 * whose `test` is the check's own test and which holds on no base-game record gives, in its
 * `when` terms, the records the check judges. Four forms of term are read (`has:K`, `no:K`,
 * `K=V`, `K!=V`, each over the record's direct children); a count with any other term gives
 * no condition, and the check then judges nothing.
 */

import type { KeywordRoleRow, KeywordRolesData } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { blockOf, significantItems, type Block, type Pair } from '../syntax/tree.js';

/** A row of part D4 as the advice checks read it. */
export interface RoleRow {
    readonly keyword: string;
    /** The folders the row holds in, or `anywhere`. */
    readonly directories: 'anywhere' | readonly string[];
    /** The parent keys, when the row holds inside a keyed block; otherwise empty. */
    readonly parents: readonly string[];
    /** Every role of the row: those it adds and those `stated_elsewhere` names. */
    readonly roles: ReadonlySet<string>;
    readonly pairsWith: readonly string[];
    readonly follows: readonly string[];
    readonly needs: readonly string[];
    readonly range: string | null;
    readonly row: KeywordRoleRow;
}

/** One term of a measured count, over a record's direct children. */
export type Term =
    | { readonly form: 'has' | 'no'; readonly key: string }
    | { readonly form: 'is' | 'is-not'; readonly key: string; readonly value: string };

/** A count of a row's measurement (`measured.counts[]`). */
interface MeasuredCount {
    readonly holds: number;
    readonly of: number;
    readonly test: readonly string[];
    readonly when: readonly string[];
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function countsOf(row: KeywordRoleRow): MeasuredCount[] {
    const measured = row['measured'];
    if (typeof measured !== 'object' || measured === null) {
        return [];
    }
    const counts = (measured as Record<string, unknown>)['counts'];
    if (!Array.isArray(counts)) {
        return [];
    }
    const out: MeasuredCount[] = [];
    for (const c of counts as unknown[]) {
        if (typeof c !== 'object' || c === null) {
            continue;
        }
        const r = c as Record<string, unknown>;
        if (typeof r['holds'] === 'number' && typeof r['of'] === 'number') {
            out.push({
                holds: r['holds'],
                of: r['of'],
                test: strings(r['test']),
                when: strings(r['when']),
            });
        }
    }
    return out;
}

/** A term of the measurement's own language, when it is one of the four forms read here. */
export function parseTerm(text: string): Term | undefined {
    const prefixed = /^(has|no):([^:|=!<>]+)$/.exec(text);
    if (prefixed?.[1] !== undefined && prefixed[2] !== undefined) {
        return { form: prefixed[1] === 'has' ? 'has' : 'no', key: prefixed[2] };
    }
    const compared = /^([^:|=!<>]+)(!=|=)([^=!<>]+)$/.exec(text);
    if (compared?.[1] !== undefined && compared[2] !== undefined && compared[3] !== undefined) {
        return {
            form: compared[2] === '=' ? 'is' : 'is-not',
            key: compared[1],
            value: compared[3],
        };
    }
    return undefined;
}

/** The direct children of a block that are pairs with this key. */
export function childPairs(block: Block, key: string): Pair[] {
    const out: Pair[] = [];
    for (const item of significantItems(block)) {
        if (item.kind === 'pair' && item.key.text === key) {
            out.push(item);
        }
    }
    return out;
}

/** True when every term holds over the block's direct children. */
export function termsHold(terms: readonly Term[], block: Block): boolean {
    return terms.every((term) => {
        const pairs = childPairs(block, term.key);
        switch (term.form) {
            case 'has':
                return pairs.length > 0;
            case 'no':
                return pairs.length === 0;
            case 'is':
                return pairs.some((p) => p.value?.kind === 'scalar' && p.value.text === term.value);
            case 'is-not':
                return !pairs.some(
                    (p) => p.value?.kind === 'scalar' && p.value.text === term.value,
                );
        }
        return false;
    });
}

/** The rows of part D4, read once per package. */
export class KeywordRoles {
    readonly rows: readonly RoleRow[];

    constructor(data: KeywordRolesData | null) {
        const rows: RoleRow[] = [];
        for (const row of data?.keywords ?? []) {
            const roles = new Set<string>(row.roles);
            for (const stated of row.stated_elsewhere ?? []) {
                roles.add(stated.role);
            }
            rows.push({
                keyword: row.keyword,
                directories: row.where.directories,
                parents: row.where.parents ?? [],
                roles,
                pairsWith: strings(row['pairs_with']),
                follows: strings(row['follows']),
                needs: strings(row['needs']),
                range: typeof row['range'] === 'string' ? row['range'] : null,
                row,
            });
        }
        this.rows = rows;
    }

    /** The rows that have every one of these roles. */
    withRoles(...roles: readonly string[]): RoleRow[] {
        return this.rows.filter((r) => roles.every((role) => r.roles.has(role)));
    }

    /**
     * The `when` terms of the row's measured count whose test is `test` alone and which holds
     * on no base-game record: the records the rule that count measures judges. Undefined when
     * there is no such count, or a term is not of a form read here.
     */
    condition(row: RoleRow, test: string): Term[] | undefined {
        for (const count of countsOf(row.row)) {
            if (count.holds !== 0 || count.test.length !== 1 || count.test[0] !== test) {
                continue;
            }
            const terms = count.when.map(parseTerm);
            if (terms.every((t): t is Term => t !== undefined)) {
                return terms;
            }
        }
        return undefined;
    }

    /**
     * The value a flag keyword is set to where the row's measurement counts the records it
     * marks (a `when` term `K=V` of the keyword itself): what `hidden = yes` is to `hidden`.
     */
    setValue(row: RoleRow): string | undefined {
        for (const count of countsOf(row.row)) {
            for (const text of count.when) {
                const term = parseTerm(text);
                if (term?.form === 'is' && term.key === row.keyword) {
                    return term.value;
                }
            }
        }
        return undefined;
    }
}

const cache = new WeakMap<Spec, KeywordRoles>();

/** The keyword roles of a package, read once. */
export function keywordRolesOf(spec: Spec): KeywordRoles {
    let roles = cache.get(spec);
    if (roles === undefined) {
        roles = new KeywordRoles(spec.part('keyword_roles'));
        cache.set(spec, roles);
    }
    return roles;
}

/** True when the row holds in this folder (`anywhere`, or one of its folders). */
export function holdsIn(row: RoleRow, directory: string | null): boolean {
    return (
        row.directories === 'anywhere' ||
        (directory !== null && row.directories.includes(directory))
    );
}

/** The block a pair's value is, if any. */
export function bodyOf(pair: Pair): Block | undefined {
    return blockOf(pair.value);
}
