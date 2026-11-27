/**
 * Tying a matched message to the files of the mod and the base game (docs/PLAN.md item 11.4;
 * docs/game-log.md, "What can be tied"). A message's values are read three ways, in this order:
 *
 * 1. **A file it names.** A text value that holds the path of a file the index read (written
 *    with `/` or `\`, relative or inside a longer path, the longest path the index knows): the
 *    file, and its line when the message's own text gives one (`line %d`, `<file>:%d`) or the
 *    place format the user gave reads one (`LogShape.location`). Otherwise the line is not
 *    known, and the file's first line stands for the file.
 * 2. **A definition it names.** A value that is one name (no space) and that a file of the mod
 *    or the base game defines: each definition, the mod's first.
 * 3. **Where the mod writes it.** The same, for a name nothing defines: each place in the mod
 *    that writes it (an unknown trigger is where the mod wrote it).
 *
 * A scope type's name (the package's `scope_types`, and part O2's values) is the kind of a
 * scope, and a folder's (`events`) a database, not names a file defines: neither is looked up.
 * A number is not either. Nothing else
 * decides: what a value is comes from the index, never from a list of message kinds.
 */

import type { WorkspaceIndex } from '../index/workspace.js';
import type { Spec } from '../spec/reader.js';
import type { Range } from '../syntax/position.js';
import type { LogShape, TemplateMatch } from './matcher.js';

/** A place in a file of the mod or the base game a message is about. */
export interface LogTie {
    /** `file`: a file the message names; `definition`: a name it names; `use`: where the mod writes it. */
    readonly kind: 'file' | 'definition' | 'use';
    /** The message's value it was read from, counted from 0. */
    readonly value: number;
    /** `inner` when the value is one of a message inside the line's message. */
    readonly from: 'message' | 'inner';
    readonly layer: string;
    /** The file's path inside its layer, with `/`. */
    readonly file: string;
    /** Its place: for a file whose line is not known, the file's first line. */
    readonly range: Range;
    /**
     * For a file: where its line came from, the message's own text (`message`) or the place
     * format the user gave (`location`); null when not known. Null for the other kinds.
     */
    readonly line: 'message' | 'location' | null;
    /** The name, for a definition or a use; otherwise null. */
    readonly name: string | null;
    /** The database of a definition (its folder, or a language); otherwise null. */
    readonly database: string | null;
}

/** What a message ties to: the first `limit` places, and how many more there are. */
export interface Ties {
    readonly ties: readonly LogTie[];
    readonly notListed: number;
}

/** What ties are read from. */
export interface TieContext {
    readonly spec: Spec;
    /** The workspace index; null when there is none, and nothing is tied. */
    readonly index: WorkspaceIndex | null;
    readonly shape: LogShape;
    /** The most places listed for one message. */
    readonly limit: number;
}

const MOD = 'mod';

/** A name a value may be: one token of name characters, with a letter, at most 120 long. */
const NAME = /^[A-Za-z0-9_.:@$'-]+$/;

function isName(value: string): boolean {
    return value.length <= 120 && NAME.test(value) && /[A-Za-z]/.test(value);
}

function isWhole(value: string): number | null {
    const t = value.trim();
    return /^\d+$/.test(t) ? Number.parseInt(t, 10) : null;
}

/** The tokens of a text that end in a file extension: the paths it may write. */
function pathTokens(text: string): string[] {
    const out: string[] = [];
    for (const raw of text.split(/[\s'"`,;()<>[\]{}|]+/)) {
        const t = raw
            .replace(/(?::\d+)+$/, '')
            .replace(/[.:]+$/, '')
            .replaceAll('\\', '/');
        if (t.length <= 400 && /[^/]\.[A-Za-z0-9]{1,5}$/.test(t)) {
            out.push(t);
        }
    }
    return out;
}

/** The files a path names: the longest end of it the index knows, every layer, the mod's first. */
function filesNamed(
    index: WorkspaceIndex,
    written: string,
): { layer: string; path: string; lines: number }[] {
    const segments = written.split('/').filter((s) => s !== '' && s !== '.');
    for (let k = 0; k < segments.length; k++) {
        const found = index.findFiles(segments.slice(k).join('/'));
        if (found.length > 0) {
            return found
                .map((f) => ({ layer: f.layer, path: f.path, lines: f.lines }))
                .sort((a, b) => Number(b.layer === MOD) - Number(a.layer === MOD));
        }
    }
    return [];
}

function at(line: number, character: number): Range {
    return { start: { line, character }, end: { line, character } };
}

const scopeNames = new WeakMap<Spec, ReadonlySet<string>>();

/**
 * What a value may be that names no definition: the package's scope types, the scope values that
 * are no scope type, and its folders (a database's name, `events`, `common/traits`). Never looked
 * up as names.
 */
function notNames(spec: Spec): ReadonlySet<string> {
    let set = scopeNames.get(spec);
    if (set === undefined) {
        set = new Set([
            ...Object.keys(spec.data.scope_types),
            ...Object.keys(spec.part('not_scope_types')?.values ?? {}),
            ...spec.data.directories.map((d) => d.path),
        ]);
        scopeNames.set(spec, set);
    }
    return set;
}

/** The places one match is about, in the order above. */
function tiesOfMatch(
    match: TemplateMatch,
    from: LogTie['from'],
    valueOffset: number | null,
    context: TieContext,
    out: LogTie[],
): void {
    const index = context.index;
    if (index === null) {
        return;
    }
    const roles = match.template.parts.flatMap((p) => (p.kind === 'value' ? [p] : []));
    const valueIndex = (i: number): number => valueOffset ?? i;
    // The message's own line and column, and which value's file the line is in.
    let line: { value: number; of: number | null } | null = null;
    let column: number | null = null;
    roles.forEach((role, i) => {
        const n = isWhole(match.values[i] ?? '');
        if (n === null) {
            return;
        }
        if (role.role === 'line' && line === null) {
            line = { value: n, of: role.lineOf };
        } else if (role.role === 'column' && column === null) {
            column = n;
        }
    });
    const named = new Set<number>();
    const fileTies: {
        i: number;
        layer: string;
        path: string;
        lines: number;
        line: number | null;
        column: number | null;
        basis: 'message' | 'location' | null;
    }[] = [];
    roles.forEach((role, i) => {
        const value = match.values[i] ?? '';
        if (role.conversion !== 'text' || value === '') {
            return;
        }
        const location = context.shape.location?.exec(value) ?? null;
        const file = location?.groups?.['file'];
        if (location !== null && file !== undefined) {
            const l = isWhole(location.groups?.['line'] ?? '');
            const c = isWhole(location.groups?.['column'] ?? '');
            for (const f of filesNamed(index, file.replaceAll('\\', '/'))) {
                fileTies.push({
                    i,
                    ...f,
                    line: l,
                    column: c,
                    basis: l === null ? null : 'location',
                });
                named.add(i);
            }
            return;
        }
        for (const token of pathTokens(value)) {
            for (const f of filesNamed(index, token)) {
                fileTies.push({ i, ...f, line: null, column: null, basis: null });
                named.add(i);
            }
        }
    });
    // The message's line goes with the file of the value it names, or with the only file named.
    const messageLine = line as { value: number; of: number | null } | null;
    if (messageLine !== null) {
        const files = new Set(fileTies.map((f) => f.i));
        const target = messageLine.of ?? (files.size === 1 ? [...files][0] : undefined);
        for (const f of fileTies) {
            if (f.i === target && f.basis === null) {
                f.line = messageLine.value;
                f.column = column;
                f.basis = 'message';
            }
        }
    }
    const first = out.length;
    const seen = new Set<string>();
    for (const f of fileTies) {
        const key = `${f.layer}\u0000${f.path}\u0000${String(f.line)}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const l = f.line === null ? 0 : Math.max(0, Math.min(f.line, Math.max(f.lines, 1)) - 1);
        const c = f.line === null || f.column === null ? 0 : Math.max(0, f.column - 1);
        out.push({
            kind: 'file',
            value: valueIndex(f.i),
            from,
            layer: f.layer,
            file: f.path,
            range: at(l, c),
            line: f.line === null ? null : f.basis,
            name: null,
            database: null,
        });
    }
    // A message that names its file says where its names are: in that file, at its line when
    // the message gives one, or, when none is written there, anywhere in that file.
    const placed = out.slice(first).filter((t) => t.kind === 'file');
    const within = <
        T extends { readonly layer: string; readonly file: string; readonly range: Range },
    >(
        found: readonly T[],
    ): T[] => {
        if (placed.length === 0) {
            return [...found];
        }
        const inFile = found.filter((f) =>
            placed.some((p) => p.layer === f.layer && p.file === f.file),
        );
        const atLine = inFile.filter((f) =>
            placed.some(
                (p) =>
                    p.line !== null &&
                    p.layer === f.layer &&
                    p.file === f.file &&
                    p.range.start.line === f.range.start.line,
            ),
        );
        return atLine.length > 0 ? atLine : inFile;
    };
    const skip = notNames(context.spec);
    roles.forEach((role, i) => {
        const value = (match.values[i] ?? '').trim();
        if (named.has(i) || role.role !== 'text' || !isName(value) || skip.has(value)) {
            return;
        }
        const definitions = within(index.definitions(value)).sort(
            (a, b) => Number(b.layer === MOD) - Number(a.layer === MOD),
        );
        if (definitions.length > 0) {
            for (const d of definitions) {
                out.push({
                    kind: 'definition',
                    value: valueIndex(i),
                    from,
                    layer: d.layer,
                    file: d.file,
                    range: d.range,
                    line: null,
                    name: value,
                    database: d.database,
                });
            }
            return;
        }
        for (const u of within(index.references(value).filter((r) => r.layer === MOD))) {
            out.push({
                kind: 'use',
                value: valueIndex(i),
                from,
                layer: u.layer,
                file: u.file,
                range: u.range,
                line: null,
                name: value,
                database: null,
            });
        }
    });
}

/**
 * The places a matched message is about: from its own values, then from the values of a
 * message inside it (`inner`), each kind in the order above; the first `limit` listed.
 */
export function tiesOf(
    match: TemplateMatch,
    inner: { readonly value: number; readonly match: TemplateMatch } | null,
    context: TieContext,
): Ties {
    const out: LogTie[] = [];
    tiesOfMatch(match, 'message', null, context, out);
    if (inner !== null) {
        tiesOfMatch(inner.match, 'inner', inner.value, context, out);
    }
    return {
        ties: out.slice(0, context.limit),
        notListed: Math.max(0, out.length - context.limit),
    };
}
