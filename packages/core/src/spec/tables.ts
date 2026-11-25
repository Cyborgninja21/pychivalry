/**
 * The hand-kept tables of part C4 (`tables.data`), read by the trust rule of
 * docs/decisions.md ("Awaiting confirmation", item 4.2). Release 2.3.0 kept these tables in
 * its code; the spec work moved each entry into the package with its evidence and an
 * `evidence_status`. The core holds none of them: every name below comes from the package.
 *
 * The trust rule, in the order of trust (the game's own output above anything else):
 *
 * 1. Candidates are listed apart in the package and are never read.
 * 2. A `confirmed` entry is read as written.
 * 3. A `contradicted` entry: where the game's own output contradicts it, the game wins, and
 *    only on the point it contradicts.
 *    - The game documents the key for more lists than the entry names (an evidence item with
 *      `bases_found`): the entry is read with its own lists and the game's together.
 *    - The game registers the name in a keyword bucket that the entry's reason says it is not
 *      in (an evidence item of kind `bucket` that lists buckets): the name is what the game's
 *      buckets say wherever it is judged as a name, and the entry's own role, which the game
 *      does not contradict, is read as written (an iterator parameter where the iterator reads
 *      it, how a `root = { }` block reads, where a chain is walked from).
 *    - Any other contradiction (the game documents a keyword's value where the entry reads a
 *      block, or the base game's files contradict the entry's pattern): the entry is not read.
 * 4. An entry with no evidence (`none`) may not raise an error or a warning. It is read only
 *    where it makes a key not a finding, never where it would open a reading whose keys could
 *    be reported: its body is read as `none` (not as triggers, effects or modifiers).
 * 5. A candidate is not an entry. But where the game's own output or Paradox's own `.info`
 *    files document it (an evidence item of kind `script_docs` or `info`), reporting the key
 *    as unknown would contradict the game's documentation, so it is read as an entry with no
 *    evidence is: only where it makes a key not a finding.
 */

import type { Spec } from './reader.js';
import type { Table, TableContradiction, TableEntry } from './package.js';

/** How a block's body is read: as triggers, as effects, as the block around it, or not at all. */
export type Child = 'trigger' | 'effect' | 'same' | 'none';

/** What the trust rule did with one entry. */
export interface TrustDecision {
    readonly table: string;
    readonly entry: string;
    readonly status: TableEntry['evidence_status'];
    /** `read`, `widened` (lists joined with the game's), `accept-only` or `not-read`. */
    readonly use: 'read' | 'widened' | 'accept-only' | 'not-read';
    readonly why: string;
}

/** How a container keyword's body is read (`containers`). */
export interface ContainerRule {
    readonly child: Child;
    /** Parameter keys of the body, each read in its own way. */
    readonly params: ReadonlyMap<string, Child>;
    /** True when every other key of the body is a case label whose block keeps the context. */
    readonly cases: boolean;
    /** The parameters inside each case block, from the table `case_params` names. */
    readonly caseParams: ReadonlyMap<string, Child>;
    readonly scriptedModifiers: boolean;
    readonly caseScriptedModifiers: boolean;
}

/**
 * Format 9: what an entry of `save_keys` saves and where its name is written. `nameIn` lists the
 * forms: `value` (the key's own value, `key = name`) or the key of a parameter of the key's block
 * that holds the name (`name`: `key = { name = x }`); `saves` is `scope` or `value`; `temporary`
 * whether the name lasts only for the effect; `parameterOf` the effects inside whose block the
 * key saves the object the effect creates.
 */
export interface SaveRule {
    readonly saves: string;
    readonly source: string | null;
    readonly nameIn: readonly string[];
    readonly temporary: boolean | null;
    readonly parameterOf: readonly string[];
}

/**
 * Format 9: a keyword of the table `variables` (75 entries): what it does to a variable, on
 * what kind of variable, in which namespace, where the name is written, and the duration keys.
 */
export interface VariableKeyword {
    /** As what the keyword is registered: `effect`, `trigger`, `link` or `list`. */
    readonly kind: string;
    /** `set`, `change`, `remove`, `add_item`, `remove_item`, `clear`, `has`, `has_item`, `size`, `read`, `iterate`. */
    readonly does: string;
    /** `value`, `list` or `map`. */
    readonly holds: string;
    /** `scope`, `local`, `global` or `dead_character`. */
    readonly namespace: string;
    /** Where the name is written: `value`, `name`, `variable`, `link_data`, `link_argument`. */
    readonly nameIn: readonly string[];
    /** The duration keys the game's documentation gives, and those the base game writes. */
    readonly duration: readonly string[];
    readonly durationRequired: boolean;
    readonly durationWritten: readonly string[];
    readonly status: TableEntry['evidence_status'];
}

/** A parameter of the list iterators (`iterator_params`). */
export interface IteratorParam {
    readonly child: Child;
    /** `*` for every list, otherwise the list bases whose iterators read it. */
    readonly lists: '*' | ReadonlySet<string>;
}

const CHILDREN: ReadonlySet<string> = new Set<Child>(['trigger', 'effect', 'same', 'none']);

/** Evidence kinds that are the game's own documentation: its output, and its `.info` files. */
const DOCUMENTING: ReadonlySet<string> = new Set(['script_docs', 'info']);

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childOf(value: unknown): Child | undefined {
    return typeof value === 'string' && CHILDREN.has(value) ? (value as Child) : undefined;
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** An entry of `save_keys` as a rule (format 9). */
function saveRuleOf(entry: TableEntry): SaveRule {
    return {
        saves: typeof entry['saves'] === 'string' ? entry['saves'] : '',
        source: typeof entry['source'] === 'string' ? entry['source'] : null,
        nameIn: strings(entry['name_in']),
        temporary: typeof entry['temporary'] === 'boolean' ? entry['temporary'] : null,
        parameterOf: strings(entry['parameter_of']),
    };
}

/** An entry of `variables` (format 9). */
function variableOf(entry: TableEntry): VariableKeyword {
    const text = (key: string): string => (typeof entry[key] === 'string' ? (entry[key] as string) : '');
    return {
        kind: text('kind'),
        does: text('does'),
        holds: text('holds'),
        namespace: text('namespace'),
        nameIn: strings(entry['name_in']),
        duration: strings(entry['duration']),
        durationRequired: entry['duration_required'] === true,
        durationWritten: strings(entry['duration_written']),
        status: entry.evidence_status,
    };
}

/** How one contradiction is settled: the game's lists added, the role kept, or the entry dropped. */
function settle(contradiction: TableContradiction): 'widen' | 'keep-role' | 'drop' {
    if (contradiction.evidence.some((e) => Array.isArray(e.bases_found))) {
        return 'widen';
    }
    if (
        contradiction.evidence.some(
            (e) => e.kind === 'bucket' && Array.isArray(e.buckets) && e.buckets.length > 0,
        )
    ) {
        return 'keep-role';
    }
    return 'drop';
}

/** The hand-kept tables, trusted by the rule above. */
export class Tables {
    readonly structural = new Map<string, Child>();
    readonly containers = new Map<string, ContainerRule>();
    readonly opensContext = new Map<string, Child>();
    readonly iteratorParams = new Map<string, IteratorParam>();
    readonly blockParams = new Map<string, ReadonlyMap<string, Child>>();
    readonly modifierBlockParams = new Set<string>();
    readonly valueBlockKeys = new Set<string>();
    readonly valueFields = new Set<string>();
    readonly vanillaIndexedDirs = new Set<string>();
    readonly scopeHeads = new Set<string>();
    readonly saveKeys = new Set<string>();
    /** Format 9: per key of `saveKeys`, what it saves and where its name is written. */
    readonly saveRules = new Map<string, SaveRule>();
    /** Format 9: the keywords that set, change, test, read or iterate variables (`variables`). */
    readonly variables = new Map<string, VariableKeyword>();
    readonly sameScopeStructural = new Set<string>();
    /** Per directory, the record fields whose body runs outside the record's root scope. */
    readonly fieldsOutsideRoot = new Map<string, Set<string>>();
    /** Directories whose records' root scope the base game contradicts (`root_scope_contradicted`). */
    readonly rootScopeContradicted = new Set<string>();
    /** What the rule did with every entry of every table, in the package's order. */
    readonly decisions: TrustDecision[] = [];
    private readonly data: Readonly<Record<string, Table>>;

    constructor(data: Readonly<Record<string, Table>>) {
        this.data = data;
        for (const [name, entry] of this.read('structural')) {
            this.structural.set(name, this.bodyOf(entry, entry['child']));
        }
        for (const [name, entry] of this.read('opens_context')) {
            this.opensContext.set(name, this.bodyOf(entry, entry['context']));
        }
        for (const [name, entry, lists] of this.read('iterator_params')) {
            this.iteratorParams.set(name, {
                child: this.bodyOf(entry, entry['child']),
                lists: lists ?? '*',
            });
        }
        for (const [name, entry] of this.read('containers')) {
            this.containers.set(name, this.containerOf(entry));
        }
        for (const [name, entry] of this.read('block_params')) {
            this.blockParams.set(name, this.paramsOf(entry, entry['params']));
        }
        for (const [name, entry] of this.read('fields_outside_root')) {
            const dir = entry['directory'];
            if (typeof dir === 'string') {
                const set = this.fieldsOutsideRoot.get(dir) ?? new Set<string>();
                set.add(name);
                this.fieldsOutsideRoot.set(dir, set);
            }
        }
        // An entry of this table only ever makes a scope unknown, so stops a judgement: each
        // is read, whatever its evidence.
        for (const [name] of this.read('root_scope_contradicted')) {
            this.rootScopeContradicted.add(name);
        }
        // Entries of these tables only ever make a key not a finding: each is read.
        const accepting: readonly [string, Set<string>][] = [
            ['modifier_block_params', this.modifierBlockParams],
            ['value_block_keys', this.valueBlockKeys],
            ['value_fields', this.valueFields],
            ['vanilla_indexed_dirs', this.vanillaIndexedDirs],
        ];
        for (const [table, set] of accepting) {
            for (const [name] of this.read(table)) {
                set.add(name);
            }
        }
        // Entries of these lead to a judgement (a chain walked, a saved scope typed): an entry
        // read only where it makes a key not a finding is not read here.
        const judging: readonly [string, Set<string>][] = [
            ['scope_heads', this.scopeHeads],
            ['save_keys', this.saveKeys],
            ['same_scope_structural', this.sameScopeStructural],
        ];
        for (const [table, set] of judging) {
            for (const [name, entry, , acceptOnly] of this.read(table)) {
                if (!acceptOnly) {
                    set.add(name);
                    if (table === 'save_keys') {
                        this.saveRules.set(name, saveRuleOf(entry));
                    }
                }
            }
        }
        // Format 9's table of the keywords of variables: read as written, for the checks that
        // will need it; no check reads it yet (docs/checks.md, the five `variables/*` rows).
        for (const [name, entry, , acceptOnly] of this.read('variables')) {
            if (!acceptOnly) {
                this.variables.set(name, variableOf(entry));
            }
        }
    }

    /**
     * The entries of a table that the trust rule lets be read, each with its lists widened by
     * the game's where a contradiction calls for it. Records a decision for every entry.
     */
    private *read(
        table: string,
    ): Generator<[string, TableEntry, ReadonlySet<string> | undefined, boolean]> {
        const entries = this.data[table]?.entries ?? {};
        for (const [name, entry] of Object.entries(entries)) {
            const lists = Array.isArray(entry['lists']) ? new Set(entry['lists'] as string[]) : undefined;
            if (entry.evidence_status === 'none') {
                this.decisions.push({
                    table,
                    entry: name,
                    status: 'none',
                    use: 'accept-only',
                    why: 'no evidence: read only where it makes a key not a finding',
                });
                yield [name, entry, lists, true];
                continue;
            }
            if (entry.evidence_status !== 'contradicted') {
                this.decisions.push({ table, entry: name, status: entry.evidence_status, use: 'read', why: 'confirmed' });
                yield [name, entry, lists, false];
                continue;
            }
            const ways = (entry.contradicted ?? []).map(settle);
            if (ways.length === 0 || ways.includes('drop')) {
                this.decisions.push({
                    table,
                    entry: name,
                    status: 'contradicted',
                    use: 'not-read',
                    why: "the game's own output contradicts what the entry says it is",
                });
                continue;
            }
            if (ways.includes('widen')) {
                const widened = new Set(lists ?? []);
                for (const c of entry.contradicted ?? []) {
                    for (const e of c.evidence) {
                        for (const base of e.bases_found ?? []) {
                            widened.add(base);
                        }
                    }
                }
                this.decisions.push({
                    table,
                    entry: name,
                    status: 'contradicted',
                    use: 'widened',
                    why: "read with its own lists and the lists the game's output documents it for",
                });
                yield [name, entry, lists === undefined ? undefined : widened, false];
                continue;
            }
            this.decisions.push({
                table,
                entry: name,
                status: 'contradicted',
                use: 'read',
                why: "the game registers the name in a bucket; the entry's role, which the game does not contradict, is read as written",
            });
            yield [name, entry, lists, false];
        }
        const candidates = this.data[table]?.candidates;
        if (!isObject(candidates)) {
            return;
        }
        for (const [name, candidate] of Object.entries(candidates)) {
            if (!isObject(candidate) || Object.prototype.hasOwnProperty.call(entries, name)) {
                continue;
            }
            const evidence = Array.isArray(candidate['evidence']) ? (candidate['evidence'] as unknown[]) : [];
            if (!evidence.some((e) => isObject(e) && DOCUMENTING.has(String(e['kind'])))) {
                continue;
            }
            this.decisions.push({
                table,
                entry: name,
                status: 'none',
                use: 'accept-only',
                why: "a candidate the game's documentation names: read only where it makes a key not a finding",
            });
            const lists = Array.isArray(candidate['lists']) ? new Set(candidate['lists'] as string[]) : undefined;
            yield [name, { ...candidate, evidence_status: 'none' }, lists, true];
        }
    }

    /** A body's reading; `none` for an entry read only where it makes a key not a finding. */
    private bodyOf(entry: TableEntry, value: unknown): Child {
        return entry.evidence_status === 'none' ? 'none' : (childOf(value) ?? 'none');
    }

    private paramsOf(entry: TableEntry, value: unknown): ReadonlyMap<string, Child> {
        const params = new Map<string, Child>();
        if (isObject(value)) {
            for (const [key, child] of Object.entries(value)) {
                params.set(key, this.bodyOf(entry, child));
            }
        }
        return params;
    }

    /** A table named by its code name (`about.name`, `RANDOM_LIST_ENTRY`), read as parameters. */
    private tableParams(codeName: unknown): ReadonlyMap<string, Child> {
        const params = new Map<string, Child>();
        if (typeof codeName !== 'string') {
            return params;
        }
        const found = Object.entries(this.data).find(([, table]) => table.about['name'] === codeName);
        if (found === undefined) {
            return params;
        }
        for (const [name, entry] of this.read(found[0])) {
            params.set(name, this.bodyOf(entry, entry['context'] ?? entry['child']));
        }
        return params;
    }

    private containerOf(entry: TableEntry): ContainerRule {
        return {
            child: this.bodyOf(entry, entry['child']),
            params: this.paramsOf(entry, entry['params']),
            cases: entry['cases'] === true,
            caseParams: this.tableParams(entry['case_params']),
            scriptedModifiers: entry['scripted_modifiers'] === true,
            caseScriptedModifiers: entry['case_scripted_modifiers'] === true,
        };
    }

    /** The parameters an iterator over `base` reads, with how each one's block reads. */
    iteratorParamsFor(base: string): Map<string, Child> {
        const out = new Map<string, Child>();
        for (const [name, param] of this.iteratorParams) {
            if (param.lists === '*' || param.lists.has(base)) {
                out.set(name, param.child);
            }
        }
        return out;
    }
}

const cache = new WeakMap<Spec, Tables>();

/** The hand-kept tables of a package, trusted by the rule above; read once per package. */
export function tablesOf(spec: Spec): Tables {
    let tables = cache.get(spec);
    if (tables === undefined) {
        tables = new Tables(spec.data.tables.data);
        cache.set(spec, tables);
    }
    return tables;
}
