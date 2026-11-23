/**
 * `localization/unused-key` (docs/checks.md, item 4.6): a key the mod defines that nothing in
 * the mod or the base game uses. Advice, at hint: the game prints nothing for a key it never
 * shows, and what uses a key cannot all be seen.
 *
 * A key counts as used, and is not reported, when any of these holds:
 *
 * - the base game defines it too: the mod replaces a text of the base game, which the base
 *   game's own files, its interface files or the engine show (the index does not read `.gui`
 *   files, so it cannot see every such use);
 * - a file of the index uses it as a word: written in a field or anywhere in a script file,
 *   or as `$key$` in a localization text (`WorkspaceIndex.isUsed`); or a text file of the mod
 *   the index does not read writes it, an interface file above all (`unreadWords`, passed to
 *   `definedNamesOf`: without it, a key only an interface file shows is reported);
 * - it is itself the name of a definition of the mod or the base game (a scripted GUI, a
 *   record): the record's own name is a key it may show, as the plain `<name>` rows of part D5
 *   measure in 112 folders;
 * - a definition of the mod or the base game has it by its name, by any pattern of part D5
 *   (`implicit_loc_keys`): every row, whatever its status or requirement, as the part says a
 *   check for unused keys may; its patterns set aside (written in the record, or the key of
 *   another record); and its two-name patterns, each split of the key tried.
 *
 * Without the base game in the index the check is silent: a key the base game uses must not be
 * reported because the base game was not read.
 */

import type { FolderTable } from '../index/folders.js';
import type { LocalizationFile } from '../index/localization.js';
import type { Spec } from '../spec/reader.js';
import type { CheckFinding } from './finding.js';
import { withBaseGame, type WorkspaceNames } from './names.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'localization/unused-key';

/** A placeholder of a D5 pattern, and the group whose definitions give its names. */
interface Hole {
    /** `folder | name_from`, as D5 writes a group; null for a placeholder any text fills. */
    readonly group: string | null;
}

/** A D5 pattern split at its placeholders: the literal text around one or two holes. */
interface Pattern {
    /** The text before the first hole, between the two, and after the last. */
    readonly first: string;
    readonly middle: string;
    readonly tail: string;
    readonly holes: readonly Hole[];
}

const PLACEHOLDER = /<([a-z_]+)>/g;

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A pattern and the group of each of its placeholders; null when it has none or more than two. */
function split(pattern: string, groups: Readonly<Record<string, string | null>>): Pattern | null {
    const parts: string[] = [];
    const holes: Hole[] = [];
    let from = 0;
    for (const match of pattern.matchAll(PLACEHOLDER)) {
        parts.push(pattern.slice(from, match.index));
        holes.push({ group: groups[match[1] ?? ''] ?? null });
        from = match.index + match[0].length;
    }
    parts.push(pattern.slice(from));
    if (holes.length === 0 || holes.length > 2) {
        return null;
    }
    const [first = '', middle = '', last = ''] = parts;
    return holes.length === 1
        ? { first, middle: '', tail: middle, holes }
        : { first, middle, tail: last, holes };
}

const patternsBySpec = new WeakMap<Spec, readonly Pattern[]>();

/** Every D5 pattern a key may come from: the rows, the patterns set aside, the two-name ones. */
export function implicitPatterns(spec: Spec): readonly Pattern[] {
    const known = patternsBySpec.get(spec);
    if (known !== undefined) {
        return known;
    }
    const part = spec.part('implicit_loc_keys');
    const out = new Map<string, Pattern>();
    const add = (pattern: unknown, groups: Record<string, string | null>): void => {
        const made = typeof pattern === 'string' ? split(pattern, groups) : null;
        if (made !== null) {
            // One pattern per text and groups: several folders share a row's shape.
            out.set(JSON.stringify(made), made);
        }
    };
    for (const [directory, rows] of Object.entries(part?.directories ?? {})) {
        for (const row of rows) {
            add(row.pattern, { name: `${directory} | ${row.name_from}` });
        }
    }
    const setAside = part?.['set_aside'];
    for (const [directory, rows] of Object.entries(isObject(setAside) ? setAside : {})) {
        for (const row of Array.isArray(rows) ? (rows as unknown[]) : []) {
            if (isObject(row) && typeof row['name_from'] === 'string') {
                add(row['pattern'], { name: `${directory} | ${row['name_from']}` });
            }
        }
    }
    const twoNames = part?.['two_name_patterns'];
    for (const row of Array.isArray(twoNames) ? (twoNames as unknown[]) : []) {
        if (
            isObject(row) &&
            typeof row['first'] === 'string' &&
            typeof row['second'] === 'string'
        ) {
            add(row['pattern'], { first: row['first'], second: row['second'] });
        }
    }
    const patterns = [...out.values()];
    patternsBySpec.set(spec, patterns);
    return patterns;
}

/** The databases a D5 group's names are definitions of: `folder | name_from`. */
function databasesOf(group: string, folders: FolderTable): readonly string[] {
    const [directory = '', from = ''] = group.split(' | ');
    if (from.startsWith('nested:')) {
        const kind = from.slice('nested:'.length);
        return (folders.get(directory)?.nested ?? [])
            .filter((rule) => rule.kind === kind)
            .map((rule) => rule.database);
    }
    return [directory];
}

/** Whether some split of the key fills the pattern with names the index defines. */
function fills(
    key: string,
    pattern: Pattern,
    defined: (name: string, group: string) => boolean,
): boolean {
    const { first, middle, tail } = pattern;
    if (key.length <= first.length + tail.length || !key.startsWith(first) || !key.endsWith(tail)) {
        return false;
    }
    const inner = key.slice(first.length, key.length - tail.length);
    const holeOk = (hole: Hole | undefined, name: string): boolean =>
        name !== '' && (hole?.group === null || defined(name, hole?.group ?? ''));
    if (pattern.holes.length === 1) {
        return holeOk(pattern.holes[0], inner);
    }
    for (let at = inner.indexOf(middle); at >= 0; at = inner.indexOf(middle, at + 1)) {
        if (
            holeOk(pattern.holes[0], inner.slice(0, at)) &&
            holeOk(pattern.holes[1], inner.slice(at + middle.length))
        ) {
            return true;
        }
    }
    return false;
}

export interface UnusedKeyInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly loc: LocalizationFile;
    readonly names: Partial<WorkspaceNames>;
}

/** Per set of names (one index, as the caller reuses it for every file): each key's verdict. */
const verdicts = new WeakMap<WorkspaceNames, Map<string, boolean>>();

export function unusedKeys(input: UnusedKeyInput, context: CheckContext): CheckFinding[] {
    const names = withBaseGame(input.names);
    if (names === undefined) {
        return [];
    }
    const patterns = implicitPatterns(input.spec);
    const groupDatabases = new Map<string, readonly string[]>();
    const defined = (name: string, group: string): boolean => {
        if (!names.hasDefinition(name)) {
            return false;
        }
        let databases = groupDatabases.get(group);
        if (databases === undefined) {
            databases = databasesOf(group, input.folders);
            groupDatabases.set(group, databases);
        }
        return databases.some((database) => names.isDefined(name, database));
    };
    let known = verdicts.get(names);
    if (known === undefined) {
        known = new Map();
        verdicts.set(names, known);
    }
    const out: CheckFinding[] = [];
    for (const entry of input.loc.entries) {
        const key = entry.key;
        let used = known.get(key);
        if (used === undefined) {
            used =
                names.isBaseGameLocalizationKey(key) ||
                names.isUsed(key) ||
                names.isRecordName(key) ||
                patterns.some((p) => fills(key, p, defined));
            known.set(key, used);
        }
        if (!used) {
            out.push(finding(CODE, entry, [key], { key }, context));
        }
    }
    return out;
}
