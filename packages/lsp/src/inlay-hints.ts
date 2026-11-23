/**
 * Inlay hints from the presentation data (docs/PLAN.md item 8.8), shown and never judged:
 *
 * - **Text.** Beside a record's key, the localized text of its name: the key its field (an
 *   event's `title`) holds, or, where the field is not written, the key a confirmed row of
 *   part D5 says the record has in its place (a decision's own key); beside a block's key (an
 *   event's `option`), the text of the key its field holds. Read through the index, in the
 *   language `_all.json` names, from the copy in force; where the override rules do not say
 *   which copy is in force and the copies differ, nothing is shown.
 * - **Scope.** After the key of a link, a chain or an iterator, the scope type it switches to,
 *   from the core's scope walk; nothing where the walk does not know it.
 *
 * Bounded: only the requested range is read, at most `MAX_HINTS` hints are returned, and a
 * text is cut to `MAX_TEXT` characters. Cancellable: the work yields between records and stops
 * when the editor cancels the request.
 */

import {
    readContext,
    readScopes,
    type Block,
    type DefinedNames,
    type FileNode,
    type FolderTable,
    type Pair,
    type Spec,
} from '@pychivalry/core';
import {
    InlayHintKind,
    type CancellationToken,
    type InlayHint,
    type Position,
} from 'vscode-languageserver/node';
import { scalarField } from './outline.js';
import type { HintRule, Presentation } from './presentation.js';

/** The most hints one request returns. */
export const MAX_HINTS = 1000;

/** The most characters of a localized text a hint shows. */
export const MAX_TEXT = 60;

/** How many records are read between two yields to the editor's other requests. */
const RECORDS_PER_YIELD = 50;

/** What the hints of a file read. */
export interface InlayHintInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod or game folder, with `/`. */
    readonly file: string;
    /** The file's folder, as the spec writes it, or null. */
    readonly folder: string | null;
    readonly tree: FileNode;
    /** The span asked for, as offsets. */
    readonly start: number;
    readonly end: number;
    readonly positionAt: (offset: number) => Position;
    readonly presentation: Presentation;
    /** The definitions the scope walk reads (`checkNames`). */
    readonly names: DefinedNames;
    /** The text in force of a localization key in a language, or null. */
    readonly text: (key: string, language: string) => string | null;
    readonly token?: CancellationToken | undefined;
}

const yieldNow = (): Promise<void> =>
    new Promise((resolve) => {
        setImmediate(resolve);
    });

/** A localized text as one short line: white space collapsed, cut to `MAX_TEXT`. */
export function shortText(text: string): string {
    const line = text.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    return line.length > MAX_TEXT ? `${line.slice(0, MAX_TEXT - 1)}…` : line;
}

/** The pairs of a path of keys below a block (`a.b`: the `b` pairs inside each `a` block). */
function pairsAt(block: Block, path: readonly string[]): (Pair & { readonly value: Block })[] {
    let level: Block[] = [block];
    let out: (Pair & { readonly value: Block })[] = [];
    for (const segment of path) {
        out = [];
        for (const b of level) {
            for (const item of b.items) {
                if (
                    item.kind === 'pair' &&
                    item.key.text === segment &&
                    item.value?.kind === 'block'
                ) {
                    out.push({ ...item, value: item.value });
                }
            }
        }
        level = out.map((p) => p.value);
    }
    return out;
}

/**
 * The localization key a record's name is read from without its field (`overridden_by`), or
 * its own name with no field: a confirmed row of part D5 for the folder, from the record's
 * key, that holds unconditionally.
 */
function implicitKey(
    spec: Spec,
    folder: string,
    field: string | undefined,
    record: string,
): string | null {
    const rows = spec.part('implicit_loc_keys')?.directories[folder] ?? [];
    const row = rows.find(
        (r) =>
            r.status === 'confirmed' &&
            r.name_from === 'record-key' &&
            (r['condition'] === undefined || r['condition'] === null) &&
            (field === undefined
                ? r['overridden_by'] === undefined && r.prefix === '' && r.suffix === ''
                : r['overridden_by'] === field),
    );
    return row === undefined ? null : `${row.prefix}${record}${row.suffix}`;
}

/** The inlay hints of a script file in the span asked for. */
export async function inlayHints(input: InlayHintInput): Promise<InlayHint[]> {
    const folder = input.folder;
    const rules: HintRule[] = [
        ...(folder === null ? [] : (input.presentation.folders.get(folder)?.hints ?? [])),
        ...input.presentation.every.hints,
    ];
    if (rules.length === 0) {
        return [];
    }
    const out: InlayHint[] = [];
    const language = input.presentation.every.language;
    const texts = rules.filter((r) => r.kind === 'text');
    const cache = new Map<string, string | null>();
    const textOf = (key: string): string | null => {
        if (language === null) {
            return null;
        }
        let found = cache.get(key);
        if (found === undefined) {
            found = input.text(key, language);
            cache.set(key, found);
        }
        return found;
    };
    const add = (offset: number, label: string, tooltip: string, kind?: InlayHintKind): void => {
        if (out.length < MAX_HINTS && offset >= input.start && offset <= input.end) {
            out.push({
                position: input.positionAt(offset),
                label,
                ...(kind === undefined ? {} : { kind }),
                tooltip,
                paddingLeft: kind === undefined,
            });
        }
    };
    let scopes: { hint: (pair: Pair) => string | null } | null = null;
    if (rules.some((r) => r.kind === 'scope')) {
        const read = {
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.tree,
            names: input.names,
        };
        const reading = readContext(read);
        const walk = readScopes(read, reading);
        const switching = new Set<Pair>();
        for (const key of reading.keys) {
            const kind = key.reading.kind;
            if (kind === 'link' || kind === 'chain' || kind === 'iterator') {
                switching.add(key.pair);
            }
        }
        for (const step of walk.links) {
            if (step.position === 'key') {
                switching.add(step.pair);
            }
        }
        scopes = {
            hint: (pair) => {
                if (!switching.has(pair) || pair.value?.kind !== 'block') {
                    return null;
                }
                return walk.frames.get(pair.value)?.this.type ?? null;
            },
        };
    }
    let records = 0;
    for (const item of input.tree.items) {
        if (out.length >= MAX_HINTS || input.token?.isCancellationRequested === true) {
            break;
        }
        if (item.kind !== 'pair' || item.value?.kind !== 'block') {
            continue;
        }
        if (item.end < input.start || item.start > input.end) {
            continue;
        }
        const record: Pair & { readonly value: Block } = { ...item, value: item.value };
        for (const rule of texts) {
            // A local definition written after a word (`scripted_trigger name = { }`) is no
            // record of the folder.
            if (folder === null || record.prefix !== null) {
                continue;
            }
            const path = rule.block === undefined || rule.block === '' ? [] : rule.block.split('.');
            const targets = path.length === 0 ? [record] : pairsAt(record.value, path);
            for (const target of targets) {
                const written =
                    rule.field === undefined ? null : scalarField(target.value, rule.field);
                const key =
                    written ??
                    (path.length === 0 &&
                    !target.value.items.some((i) => i.kind === 'pair' && i.key.text === rule.field)
                        ? implicitKey(input.spec, folder, rule.field, record.key.text)
                        : null);
                const text = key === null ? null : textOf(key);
                if (key !== null && text !== null && text.trim() !== '') {
                    add(target.key.end, shortText(text), key);
                }
            }
        }
        if (scopes !== null) {
            const pending: Block[] = [record.value];
            while (pending.length > 0 && out.length < MAX_HINTS) {
                const block = pending.pop();
                if (block === undefined || block.end < input.start || block.start > input.end) {
                    continue;
                }
                for (const inner of block.items) {
                    if (inner.kind !== 'pair' || inner.value?.kind !== 'block') {
                        continue;
                    }
                    const type = scopes.hint(inner);
                    if (type !== null) {
                        add(
                            inner.key.end,
                            `: ${type}`,
                            `${inner.key.text} switches the scope to ${type}`,
                            InlayHintKind.Type,
                        );
                    }
                    pending.push(inner.value);
                }
            }
        }
        if (++records % RECORDS_PER_YIELD === 0) {
            await yieldNow();
        }
    }
    if (input.token?.isCancellationRequested === true) {
        return [];
    }
    return out.sort(
        (a, b) => a.position.line - b.position.line || a.position.character - b.position.character,
    );
}
