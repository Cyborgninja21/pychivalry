/**
 * Completion (docs/PLAN.md item 7.5): what may be written at a place of a file, read from the
 * spec package and the workspace index alone. It is the other side of lookup: lookup says
 * where a name is valid, completion lists the names valid at a place. The editor's completion
 * renders it; nothing here knows the protocol.
 *
 * What it offers, by the place (the context reader, `check/context.ts`, says what each block
 * of the file is; the scope walk, `check/scope.ts`, says the scope it runs in):
 *
 * - **A key in a trigger or effect block:** the context's bucket (`triggers`, `effects`); the
 *   links (a scope switch, `liege = { }`); the documented iterators of each list
 *   (`scope_validity.lists.<base>.iterators`) whose prefix part D8 confirms for the context
 *   (`any_` in a trigger block, the others in an effect block); the structural keys of the
 *   table `structural`; the names the mod and the base game define in the directories of
 *   `vanilla_indexed_dirs` the reader accepts there (scripted triggers in a trigger block,
 *   scripted effects in an effect block, and the directories whose records have no body
 *   context, such as script values); and the schema fields the reader reads the block against.
 *   Where the block's scope is known, a keyword, a link or an iterator whose scope data does
 *   not list it is not offered: the game rejects it there. Where the scope is not known,
 *   nothing is left out for it.
 * - **A key in a modifier block:** the `modifiers` bucket, without a modifier whose use areas
 *   the block's part D7 row (confirmed) excludes, and the block's fields.
 * - **A key in a script value:** the keys of the table `value_block_keys`, and the names of the
 *   directories whose records have no body context.
 * - **A key in a record's body or a field's block:** the fields the schema records there.
 * - **A value:** the values the base game writes in that field (`values`, where the package
 *   records them), and the names the mod and the base game define in the databases a confirmed
 *   row of part D6 (`field_references`) says the field's or the keyword's value names.
 *
 * Nothing is offered at the top level of a file (a record's name is the modder's own), inside
 * quoted text or a comment, or where the package says nothing about the place. The answer is
 * bounded: past `limit` candidates it keeps those that start with the word already written
 * (letter case ignored), cut to the limit, and says it is not complete, so that another word
 * is asked again.
 */

import {
    readContext,
    type BlockKind,
    type DefinedNames,
    type FileReading,
} from '../check/context.js';
import { readScopes } from '../check/scope.js';
import type { FolderTable } from '../index/folders.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import type { BucketName, FieldReferenceRow, SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf, type Tables } from '../spec/tables.js';
import { vocabularyOf, type Vocabulary } from '../spec/vocabulary.js';
import type { ParseResult } from '../syntax/parser.js';
import type { Block, FileNode, Pair } from '../syntax/tree.js';

/** What a candidate is. */
export type CompletionKind =
    | 'trigger'
    | 'effect'
    | 'link'
    | 'iterator'
    | 'modifier-type'
    | 'structural'
    | 'value-key'
    | 'field'
    | 'defined'
    | 'value';

/** One name that may be written at the place. */
export interface CompletionCandidate {
    readonly name: string;
    readonly kind: CompletionKind;
    /** Where it comes from, in a few words: its bucket, the field, the database that defines it. */
    readonly detail: string;
    /** The package's description of it, or null when the package has none. */
    readonly description: string | null;
}

/** The place completion was asked at. */
export type CompletionPlace =
    /** Inside quoted text or a comment, or outside any block of the file: nothing is offered. */
    | { readonly kind: 'none'; readonly why: 'text' | 'comment' | 'top-level' }
    | {
          readonly kind: 'key';
          /** How the block around is read; `not-read` where the reader did not reach it. */
          readonly block: BlockKind | 'not-read';
          /** The current scope type of the block, or null when it is not known. */
          readonly scope: string | null;
      }
    | {
          readonly kind: 'value';
          readonly block: BlockKind | 'not-read';
          /** The key whose value is being written. */
          readonly key: string;
      };

export interface CompletionAnswer {
    readonly place: CompletionPlace;
    /** The word already written at the place, and its span: what a candidate replaces. */
    readonly word: { readonly text: string; readonly start: number; readonly end: number };
    readonly candidates: readonly CompletionCandidate[];
    /**
     * False when there were more than `limit` candidates: those kept are the ones that start
     * with the word already written, and another word needs another answer.
     */
    readonly complete: boolean;
}

export interface CompletionInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod, with `/`. */
    readonly file: string;
    /** The file as the editor holds it, parsed. */
    readonly parsed: ParseResult;
    /** Where completion is asked, an offset into `parsed.text`. */
    readonly offset: number;
    /** The definitions the context reader sees (`definedNamesOf`). */
    readonly names: DefinedNames;
    /** The workspace index, for the names the mod and the base game define; none without it. */
    readonly index?: WorkspaceIndex | null | undefined;
    /** The most candidates; 2,000 by default. */
    readonly limit?: number | undefined;
}

export const DEFAULT_COMPLETION_LIMIT = 2000;

/** The characters of a word completion replaces: a name, a number, a `$PARAM$`, `@value`. */
const WORD_CHAR = /[A-Za-z0-9_$@\-']/;

/** The characters an operator is written with. */
const OPERATOR_CHAR = /[=<>!?]/;

/** The word around `offset`: from the first word character before it to the last after it. */
function wordAt(text: string, offset: number): { text: string; start: number; end: number } {
    let start = offset;
    while (start > 0 && WORD_CHAR.test(text.charAt(start - 1))) {
        start--;
    }
    let end = offset;
    while (end < text.length && WORD_CHAR.test(text.charAt(end))) {
        end++;
    }
    return { text: text.slice(start, offset), start, end };
}

/** Whether the place is inside quoted text or after a `#` on its line. */
function insideTextOrComment(text: string, offset: number): 'text' | 'comment' | null {
    let at = offset;
    while (at > 0 && text.charAt(at - 1) !== '\n' && text.charAt(at - 1) !== '\r') {
        at--;
    }
    let quoted = false;
    for (let i = at; i < offset; i++) {
        const c = text.charAt(i);
        if (c === '"') {
            quoted = !quoted;
        } else if (c === '#' && !quoted) {
            return 'comment';
        }
    }
    return quoted ? 'text' : null;
}

/**
 * Whether the word at `start` is a value: an operator stands before it (white space between).
 * Returns the key the value belongs to, or null for a key.
 */
function keyBefore(text: string, start: number): { key: string } | null {
    let at = start;
    while (at > 0 && /\s/.test(text.charAt(at - 1))) {
        at--;
    }
    if (at === 0 || !OPERATOR_CHAR.test(text.charAt(at - 1))) {
        return null;
    }
    while (at > 0 && OPERATOR_CHAR.test(text.charAt(at - 1))) {
        at--;
    }
    while (at > 0 && /\s/.test(text.charAt(at - 1))) {
        at--;
    }
    let keyStart = at;
    while (keyStart > 0 && /[^\s{}=<>!?"#]/.test(text.charAt(keyStart - 1))) {
        keyStart--;
    }
    return { key: text.slice(keyStart, at) };
}

/** The innermost block whose braces hold `offset`, with the pairs that lead to it. */
function blockAt(file: FileNode, offset: number): { block: Block | null; path: Pair[] } {
    let block: Block | null = null;
    const path: Pair[] = [];
    let items = file.items;
    for (;;) {
        let next: { block: Block; pair: Pair | null } | null = null;
        for (const item of items) {
            const candidate =
                item.kind === 'block'
                    ? { block: item, pair: null }
                    : item.kind === 'pair' && item.value?.kind === 'block'
                      ? { block: item.value, pair: item }
                      : null;
            if (candidate === null) {
                continue;
            }
            const b = candidate.block;
            const inside = offset > b.start && (b.closed ? offset < b.end : offset <= b.end);
            if (inside) {
                next = candidate;
                break;
            }
        }
        if (next === null) {
            break;
        }
        block = next.block;
        if (next.pair !== null) {
            path.push(next.pair);
        }
        items = next.block.items;
    }
    return { block, path };
}

/** The candidates gathered, each name once, the first kind that offers it kept. */
class Gathered {
    private readonly seen = new Set<string>();
    readonly list: CompletionCandidate[] = [];

    add(name: string, kind: CompletionKind, detail: string, description: string | null): void {
        if (name === '' || this.seen.has(name)) {
            return;
        }
        this.seen.add(name);
        this.list.push({
            name,
            kind,
            detail,
            description: description === '' ? null : description,
        });
    }
}

/** Whether scope data lets a keyword run in the scope `current` (null: not known, so yes). */
function fits(supported: readonly string[] | undefined, current: string | null): boolean {
    return (
        current === null ||
        supported === undefined ||
        supported.length === 0 ||
        supported.includes('none') ||
        supported.includes(current)
    );
}

/** The databases a confirmed D6 row says a value names, with the container after `#`. */
function databasesOf(
    rows: readonly FieldReferenceRow[],
): { database: string; container: string | null }[] {
    const out: { database: string; container: string | null }[] = [];
    for (const row of rows) {
        if (row.status !== 'confirmed') {
            continue;
        }
        for (const target of row.refers_to) {
            const at = target.indexOf('#');
            out.push(
                at < 0
                    ? { database: target, container: null }
                    : { database: target.slice(0, at), container: target.slice(at + 1) },
            );
        }
    }
    return out;
}

/** A key's segment of a D6 path: as written, and a number or a date by its placeholder. */
function pathSegment(key: string): string[] {
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(key)) {
        return [key, '<number>'];
    }
    if (/^-?[0-9]+\.[0-9]+\.[0-9]+$/.test(key)) {
        return [key, '<date>'];
    }
    return [key];
}

/** Every way the keys of a path may be written in a D6 row: as written, or by placeholder. */
function pathForms(keys: readonly string[]): string[] {
    let forms = [''];
    for (const key of keys) {
        const next: string[] = [];
        for (const form of forms) {
            for (const segment of pathSegment(key)) {
                next.push(form === '' ? segment : `${form}.${segment}`);
            }
        }
        forms = next;
    }
    return forms;
}

class Completer {
    private readonly vocabulary: Vocabulary;
    private readonly tables: Tables;
    private readonly found = new Gathered();
    private reading: FileReading | null = null;

    constructor(private readonly input: CompletionInput) {
        this.vocabulary = vocabularyOf(input.spec);
        this.tables = tablesOf(input.spec);
    }

    private read(): FileReading {
        this.reading ??= readContext({
            spec: this.input.spec,
            folders: this.input.folders,
            file: this.input.file,
            tree: this.input.parsed.file,
            names: this.input.names,
        });
        return this.reading;
    }

    run(): CompletionAnswer {
        const { parsed, offset } = this.input;
        const text = parsed.text;
        const at = Math.max(0, Math.min(offset, text.length));
        const word = wordAt(text, at);
        const done = (place: CompletionPlace): CompletionAnswer => this.answer(place, word);
        const inside = insideTextOrComment(text, word.start);
        if (inside !== null) {
            return done({ kind: 'none', why: inside });
        }
        const { block, path } = blockAt(parsed.file, at);
        const value = keyBefore(text, word.start);
        if (block === null) {
            return done({ kind: 'none', why: 'top-level' });
        }
        const reading = this.read();
        const kind = reading.blocks.get(block) ?? 'not-read';
        const fields = reading.fields.get(block);
        if (value !== null) {
            this.values(kind, value.key, fields, path);
            return done({ kind: 'value', block: kind, key: value.key });
        }
        const scope = this.scopeOf(block, reading);
        switch (kind) {
            case 'trigger':
            case 'effect':
                this.contextKeys(kind, scope);
                this.fields(fields);
                this.callable(kind);
                break;
            case 'modifiers':
                this.modifiers(block, reading);
                this.fields(fields);
                this.callable(null);
                break;
            case 'script-value':
                for (const key of this.tables.valueBlockKeys) {
                    this.found.add(key, 'value-key', 'value_block_keys', null);
                }
                this.callable(null);
                break;
            case 'none':
                this.fields(fields);
                break;
            case 'not-read':
                break;
        }
        return done({ kind: 'key', block: kind, scope });
    }

    private answer(
        place: CompletionPlace,
        word: { text: string; start: number; end: number },
    ): CompletionAnswer {
        const limit = this.input.limit ?? DEFAULT_COMPLETION_LIMIT;
        let candidates = this.found.list;
        let complete = true;
        if (candidates.length > limit) {
            // Kept by the word already written: another word needs another answer.
            const prefix = word.text.toLowerCase();
            candidates = candidates
                .filter((c) => c.name.toLowerCase().startsWith(prefix))
                .slice(0, limit);
            complete = false;
        }
        return { place, word, candidates, complete };
    }

    /** The current scope type of a block, from the scope walk. */
    private scopeOf(block: Block, reading: FileReading): string | null {
        const scopes = readScopes(
            {
                spec: this.input.spec,
                folders: this.input.folders,
                file: this.input.file,
                tree: this.input.parsed.file,
                names: this.input.names,
            },
            reading,
        );
        return scopes.frames.get(block)?.this.type ?? null;
    }

    /** The keywords, links, iterators and structural keys of a trigger or effect block. */
    private contextKeys(context: 'trigger' | 'effect', scope: string | null): void {
        const spec = this.input.spec.data;
        const bucket: BucketName = context === 'trigger' ? 'triggers' : 'effects';
        const group = context === 'trigger' ? 'triggers' : 'effects';
        for (const [name, entry] of Object.entries(spec.buckets[bucket])) {
            const data = this.vocabulary.scopeValidity(group, name);
            if (fits(data?.supported_scopes, scope)) {
                this.found.add(name, context, bucket, entry.doc || (data?.description ?? null));
            }
        }
        for (const name of Object.keys(spec.buckets.links)) {
            const forms = this.vocabulary.linkForms(name).filter((f) => !f.requires_data);
            const usable =
                forms.length === 0 ||
                forms.some((f) => f.global_link || fits(f.supported_scopes, scope));
            if (usable) {
                this.found.add(name, 'link', 'links', forms[0]?.description ?? null);
            }
        }
        const prefixes = new Set(
            (this.input.spec.part('iterator_kinds')?.prefixes ?? [])
                .filter((row) => row.status === 'confirmed' && row.kind === context)
                .map((row) => row.prefix),
        );
        for (const [base, data] of Object.entries(spec.scope_validity.lists)) {
            if (!this.vocabulary.has('lists', base) || !fits(data.supported_scopes, scope)) {
                continue;
            }
            for (const iterator of data.iterators ?? []) {
                const from = this.vocabulary.iteratorOf(iterator);
                if (from !== undefined && prefixes.has(from.prefix) && from.base === base) {
                    this.found.add(iterator, 'iterator', `iterator over ${base}`, data.description);
                }
            }
        }
        for (const name of this.tables.structural.keys()) {
            this.found.add(name, 'structural', 'structural', null);
        }
    }

    /** The modifiers a modifier block may hold. */
    private modifiers(block: Block, reading: FileReading): void {
        const row = reading.modifierBlocks.get(block)?.row ?? null;
        const areas = row?.status === 'confirmed' ? row.use_areas : null;
        for (const [name, entry] of Object.entries(this.input.spec.data.buckets.modifiers)) {
            const own = entry.use_areas ?? null;
            if (areas === null || own === null || own.some((a) => areas.includes(a))) {
                this.found.add(name, 'modifier-type', 'modifiers', entry.doc || null);
            }
        }
    }

    /** The schema fields a block's keys are read against; placeholder fields are not names. */
    private fields(fields: Readonly<Record<string, SchemaField>> | undefined): void {
        for (const [name, field] of Object.entries(fields ?? {})) {
            if (!name.startsWith('<')) {
                this.found.add(name, 'field', `field (${field.kind})`, field.description ?? null);
            }
        }
    }

    /**
     * The names defined in the directories of `vanilla_indexed_dirs` the reader accepts as a
     * key here: those whose records are blocks of the context, and those whose records have no
     * body context.
     */
    private callable(context: 'trigger' | 'effect' | null): void {
        const index = this.input.index;
        if (index === null || index === undefined) {
            return;
        }
        const schema = this.input.spec.data.schema;
        for (const dir of this.tables.vanillaIndexedDirs) {
            const body = Object.prototype.hasOwnProperty.call(schema, dir)
                ? schema[dir]?.record_body
                : undefined;
            const bodyContext =
                body === 'trigger_block' ? 'trigger' : body === 'effect_block' ? 'effect' : null;
            if (bodyContext === null || bodyContext === context) {
                this.defined(index, dir, null);
            }
        }
    }

    /** The names a database of the index defines (in one container, when given). */
    private defined(index: WorkspaceIndex, database: string, container: string | null): void {
        for (const d of index.definitionsOf(database)) {
            if (container === null || d.container === container) {
                this.found.add(d.name, 'defined', database, null);
            }
        }
    }

    /** The values a key's value may be. */
    private values(
        block: BlockKind | 'not-read',
        key: string,
        fields: Readonly<Record<string, SchemaField>> | undefined,
        path: readonly Pair[],
    ): void {
        const rows = this.input.spec.part('field_references')?.fields ?? [];
        const index = this.input.index ?? null;
        const field =
            fields !== undefined && Object.prototype.hasOwnProperty.call(fields, key)
                ? fields[key]
                : undefined;
        for (const v of field?.values ?? []) {
            this.found.add(
                v.value,
                'value',
                `written ${String(v.count)} times in the base game`,
                null,
            );
        }
        const matched: FieldReferenceRow[] = [];
        if (block === 'trigger' || block === 'effect') {
            const bucket = block === 'trigger' ? 'triggers' : 'effects';
            matched.push(
                ...rows.filter((r) => r.kind === 'value' && r.bucket === bucket && r.path === key),
            );
        }
        const directory = this.read().directory;
        if (field !== undefined && directory !== null) {
            const forms = new Set(pathForms([...path.slice(1).map((p) => p.key.text), key]));
            matched.push(
                ...rows.filter(
                    (r) => r.kind === 'field' && r.directory === directory && forms.has(r.path),
                ),
            );
        }
        if (index !== null) {
            for (const { database, container } of databasesOf(matched)) {
                this.defined(index, database, container);
            }
        }
    }
}

/** What may be written at a place of a file (see the head of this file). */
export function completionsAt(input: CompletionInput): CompletionAnswer {
    return new Completer(input).run();
}
