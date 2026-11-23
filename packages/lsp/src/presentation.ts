/**
 * The presentation data (docs/PLAN.md item 8.8): pychivalry's own data files in the
 * repository's `presentation/` folder, read by the language server only. Per record kind, that
 * is per game folder, a file says how the editor shows that folder's records: the outline rule
 * (which records and which of their blocks the outline lists, with what label and symbol
 * kind), the snippets (a new file's head, a new record, a field with its tab stops), the field
 * order (the order fields are conventionally written in, which completion follows) and the
 * inline hints (a record's localized name beside its key). One more file, `_all.json`, holds
 * what applies to every folder: the scope a link switches to, shown after its key, and the
 * language the localized hints are read in. The format is `presentation/README.md`, its
 * JSON Schema `presentation/presentation.schema.json`.
 *
 * Nothing here judges script. The core never reads these files and no check receives them
 * (`presentation.test.ts` proves it); a file that cannot be read is skipped and reported, and
 * the server keeps its plain outline and completion.
 *
 * Where the files are: beside the server's own module in the extension's bundle
 * (`dist/bundle/lsp/presentation/`, copied there by the bundle step), otherwise the
 * repository's `presentation/` folder beside this package.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SymbolKind } from 'vscode-languageserver/node';

/** The name of a protocol symbol kind, as the protocol writes it (`Event`, `EnumMember`). */
export type SymbolKindName = keyof typeof SymbolKind;

/** How one field of a record, mostly a block, appears in the outline, under its record. */
export interface OutlineBlockRule {
    /** The field, a key of the record's body. */
    readonly field: string;
    readonly symbol: SymbolKindName;
    /** The label, a template (`{key}` by default); see `renderTemplate`. */
    readonly label?: string | undefined;
    /** The label when `label` resolves to nothing. */
    readonly fallback?: string | undefined;
    /** Also list the block's own keyed blocks under it. */
    readonly children?: 'blocks' | undefined;
}

/** How the records of a folder appear in the outline. */
export interface OutlineRule {
    readonly symbol: SymbolKindName;
    /** The record's detail, a template over the record's fields. */
    readonly detail?: string | undefined;
    readonly blocks: readonly OutlineBlockRule[];
}

/** The order the fields of one block are conventionally written in. */
export interface FieldOrder {
    /** The path of keys from the record's body to the block, joined by `.`; `""` the body. */
    readonly block: string;
    readonly fields: readonly string[];
}

/** One snippet, in VS Code's snippet syntax (`$1`, `${1:default}`, `${1|a,b|}`, `$0`). */
export interface Snippet {
    readonly label: string;
    readonly description: string;
    /**
     * Where it is offered: `file`, the head of a new file of the folder, and `record`, a new
     * record, at the top level of a file; `field`, where completion offers its field.
     */
    readonly at: 'file' | 'record' | 'field';
    /** For `field`: the block it is written in, as in `FieldOrder.block`. */
    readonly block?: string | undefined;
    /** For `field`: the field it writes. */
    readonly field?: string | undefined;
    /** The lines of the snippet. */
    readonly body: readonly string[];
}

/** An inline hint. */
export type HintRule =
    /**
     * The localized text of a record's name beside its key, or of a block's beside the block's
     * key (`block`): the localization key the field `field` holds, or, where the field is not
     * written, the key a confirmed row of part D5 says the record has without it; with no
     * field, the key part D5 gives the record's own name.
     */
    | {
          readonly kind: 'text';
          readonly block?: string | undefined;
          readonly field?: string | undefined;
      }
    /** The scope type a link, a chain or an iterator switches to, after its key. */
    | { readonly kind: 'scope' };

/** The presentation of one folder's records. */
export interface FolderPresentation {
    /** The game folder, as the spec writes it (`events`, `common/decisions`). */
    readonly folder: string;
    /** The pre-2.0 schema files the entries were brought back from; empty for new data. */
    readonly from: readonly string[];
    readonly outline: OutlineRule | null;
    readonly fieldOrder: readonly FieldOrder[];
    readonly snippets: readonly Snippet[];
    readonly hints: readonly HintRule[];
}

/** What applies to every folder (`_all.json`). */
export interface EveryFolder {
    readonly hints: readonly HintRule[];
    /** The language localized hints are read in, as a file's header names it (`l_english`). */
    readonly language: string | null;
}

/** The presentation data, read. */
export interface Presentation {
    readonly folders: ReadonlyMap<string, FolderPresentation>;
    readonly every: EveryFolder;
    /** The files that could not be read, each with why: they are left out. */
    readonly problems: readonly string[];
}

/** The file that holds what applies to every folder. */
export const EVERY_FOLDER_FILE = '_all.json';

/** The folder of the presentation data the server reads by default. */
export function defaultPresentationDir(): string {
    const bundled = fileURLToPath(new URL('./presentation/', import.meta.url));
    if (existsSync(bundled)) {
        return bundled;
    }
    return fileURLToPath(new URL('../../../presentation/', import.meta.url));
}

/** No presentation data: the plain outline and completion. */
export const NO_PRESENTATION: Presentation = {
    folders: new Map(),
    every: { hints: [], language: null },
    problems: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function optionalString(value: unknown, what: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`${what} is not text`);
    }
    return value;
}

function symbolKind(value: unknown, what: string): SymbolKindName {
    if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(SymbolKind, value)) {
        throw new Error(`${what} is no symbol kind of the protocol: ${String(value)}`);
    }
    return value as SymbolKindName;
}

function readOutline(value: unknown): OutlineRule | null {
    if (value === undefined) {
        return null;
    }
    if (!isRecord(value) || !Array.isArray(value['blocks'])) {
        throw new Error('outline is not an object with blocks');
    }
    const blocks = value['blocks'].map((b: unknown, i): OutlineBlockRule => {
        if (!isRecord(b) || typeof b['field'] !== 'string') {
            throw new Error(`outline.blocks[${String(i)}] has no field`);
        }
        const children = b['children'];
        if (children !== undefined && children !== 'blocks') {
            throw new Error(`outline.blocks[${String(i)}].children is not "blocks"`);
        }
        return {
            field: b['field'],
            symbol: symbolKind(b['symbol'], `outline.blocks[${String(i)}].symbol`),
            label: optionalString(b['label'], `outline.blocks[${String(i)}].label`),
            fallback: optionalString(b['fallback'], `outline.blocks[${String(i)}].fallback`),
            children,
        };
    });
    return {
        symbol: symbolKind(value['symbol'], 'outline.symbol'),
        detail: optionalString(value['detail'], 'outline.detail'),
        blocks,
    };
}

function readOrder(value: unknown): FieldOrder[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error('fieldOrder is not a list');
    }
    return value.map((o: unknown, i): FieldOrder => {
        if (!isRecord(o) || typeof o['block'] !== 'string' || !isStringArray(o['fields'])) {
            throw new Error(`fieldOrder[${String(i)}] has no block and fields`);
        }
        return { block: o['block'], fields: o['fields'] };
    });
}

function readSnippets(value: unknown): Snippet[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error('snippets is not a list');
    }
    return value.map((s: unknown, i): Snippet => {
        const what = `snippets[${String(i)}]`;
        if (
            !isRecord(s) ||
            typeof s['label'] !== 'string' ||
            typeof s['description'] !== 'string' ||
            !isStringArray(s['body'])
        ) {
            throw new Error(`${what} has no label, description and body`);
        }
        const at = s['at'];
        if (at !== 'file' && at !== 'record' && at !== 'field') {
            throw new Error(`${what}.at is not file, record or field`);
        }
        const field = optionalString(s['field'], `${what}.field`);
        if ((at === 'field') !== (field !== undefined)) {
            throw new Error(`${what}: a field snippet, and only one, names its field`);
        }
        return {
            label: s['label'],
            description: s['description'],
            at,
            block: optionalString(s['block'], `${what}.block`),
            field,
            body: s['body'],
        };
    });
}

function readHints(value: unknown): HintRule[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error('hints is not a list');
    }
    return value.map((h: unknown, i): HintRule => {
        const what = `hints[${String(i)}]`;
        if (!isRecord(h)) {
            throw new Error(`${what} is not an object`);
        }
        if (h['kind'] === 'scope') {
            return { kind: 'scope' };
        }
        if (h['kind'] === 'text') {
            return {
                kind: 'text',
                block: optionalString(h['block'], `${what}.block`),
                field: optionalString(h['field'], `${what}.field`),
            };
        }
        throw new Error(`${what}.kind is not text or scope`);
    });
}

/** The folder a data file is for, by its path inside the data folder (`common/decisions.json`). */
export function folderOfFile(relative: string): string | null {
    const slashed = relative.split(path.sep).join('/');
    if (!slashed.endsWith('.json') || slashed === EVERY_FOLDER_FILE) {
        return null;
    }
    return slashed.slice(0, -'.json'.length);
}

/** One folder's file, read; throws with the reason when it is not in the format. */
export function readFolderFile(relative: string, data: unknown): FolderPresentation {
    const folder = folderOfFile(relative);
    if (folder === null) {
        throw new Error('not a folder file');
    }
    if (!isRecord(data)) {
        throw new Error('not a JSON object');
    }
    if (data['folder'] !== folder) {
        throw new Error(`its folder is ${String(data['folder'])}, its path says ${folder}`);
    }
    const from = data['from'] ?? [];
    if (!isStringArray(from)) {
        throw new Error('from is not a list of file names');
    }
    return {
        folder,
        from,
        outline: readOutline(data['outline']),
        fieldOrder: readOrder(data['fieldOrder']),
        snippets: readSnippets(data['snippets']),
        hints: readHints(data['hints']),
    };
}

/** `_all.json`, read; throws with the reason when it is not in the format. */
export function readEveryFolderFile(data: unknown): EveryFolder {
    if (!isRecord(data) || data['folder'] !== '*') {
        throw new Error('its folder is not "*"');
    }
    return {
        hints: readHints(data['hints']),
        language: optionalString(data['language'], 'language') ?? null,
    };
}

/** Every `.json` file under a folder, as paths relative to it, in code-point order. */
function jsonFiles(dir: string, under = ''): string[] {
    const out: string[] = [];
    for (const name of readdirSync(path.join(dir, under)).sort()) {
        const relative = under === '' ? name : path.join(under, name);
        if (statSync(path.join(dir, relative)).isDirectory()) {
            out.push(...jsonFiles(dir, relative));
        } else if (name.endsWith('.json') && name !== 'presentation.schema.json') {
            out.push(relative);
        }
    }
    return out;
}

/**
 * The presentation data in a folder. A file that cannot be read or is not in the format is
 * left out and listed in `problems`; a folder that does not exist gives no data.
 */
export function loadPresentation(dir: string = defaultPresentationDir()): Presentation {
    if (!existsSync(dir)) {
        return { ...NO_PRESENTATION, problems: [`no presentation data in ${dir}`] };
    }
    const folders = new Map<string, FolderPresentation>();
    let every: EveryFolder = NO_PRESENTATION.every;
    const problems: string[] = [];
    for (const relative of jsonFiles(dir)) {
        const shown = relative.split(path.sep).join('/');
        try {
            const data: unknown = JSON.parse(readFileSync(path.join(dir, relative), 'utf8'));
            if (shown === EVERY_FOLDER_FILE) {
                every = readEveryFolderFile(data);
            } else {
                const read = readFolderFile(relative, data);
                folders.set(read.folder, read);
            }
        } catch (err) {
            problems.push(`${shown}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return { folders, every, problems };
}

/** The field order of a block of a folder's records, or undefined. */
export function fieldOrderOf(
    presentation: Presentation,
    folder: string,
    block: string,
): readonly string[] | undefined {
    return presentation.folders.get(folder)?.fieldOrder.find((o) => o.block === block)?.fields;
}

// ─── Templates and snippets ────────────────────────────────────────────────

/**
 * A label or detail template: text with placeholders `{key}` (the field's key as written),
 * `{n}` (its number among the fields of its key in its record, from 1), `{value}` (its value,
 * when it is plain text) and `{<field>}` (the value a field of its block holds, when it is
 * written once as plain text). A template with a placeholder that has no value resolves to
 * null.
 */
export function renderTemplate(
    template: string,
    values: (name: string) => string | null,
): string | null {
    const missing: string[] = [];
    const text = template.replace(/\{([A-Za-z0-9_]+)\}/g, (_all, name: string) => {
        const value = values(name);
        if (value === null) {
            missing.push(name);
            return '';
        }
        return value;
    });
    return missing.length > 0 ? null : text;
}

/** The placeholders of a template that name fields: `{key}`, `{n}` and `{value}` left out. */
export function templateFields(template: string): string[] {
    return [...template.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
        .map((m) => m[1] ?? '')
        .filter((name) => name !== 'key' && name !== 'n' && name !== 'value');
}

/** A snippet's text, as the editor inserts it. */
export function snippetText(snippet: Snippet): string {
    return snippet.body.join('\n');
}

/**
 * A snippet as the editor would leave it if every tab stop were accepted as offered: each
 * placeholder its default, each choice its first option, every other tab stop empty. The
 * snippet syntax's escapes (`\$`, `\}`, `\\`) are written as the characters they stand for.
 */
export function expandSnippet(text: string): string {
    let out = '';
    let i = 0;
    const readUntil = (close: string): string => {
        // A placeholder's default may hold nested placeholders: expand them as well.
        let depth = 0;
        let inner = '';
        while (i < text.length) {
            const c = text.charAt(i);
            if (c === '\\' && i + 1 < text.length) {
                inner += text.slice(i, i + 2);
                i += 2;
                continue;
            }
            if (c === '$' && text.charAt(i + 1) === '{') {
                depth++;
            } else if (c === '}') {
                if (depth === 0) {
                    break;
                }
                depth--;
            }
            if (depth === 0 && close !== '}' && text.startsWith(close, i)) {
                break;
            }
            inner += c;
            i++;
        }
        return inner;
    };
    while (i < text.length) {
        const c = text.charAt(i);
        if (c === '\\' && i + 1 < text.length && '$}\\'.includes(text.charAt(i + 1))) {
            out += text.charAt(i + 1);
            i += 2;
            continue;
        }
        if (c !== '$') {
            out += c;
            i++;
            continue;
        }
        const plain = /^\$([0-9]+|[A-Za-z_][A-Za-z0-9_]*)/.exec(text.slice(i));
        if (plain !== null) {
            // A tab stop or a variable with no default: nothing.
            i += plain[0].length;
            continue;
        }
        const braced = /^\$\{([0-9]+|[A-Za-z_][A-Za-z0-9_]*)/.exec(text.slice(i));
        if (braced === null) {
            out += c;
            i++;
            continue;
        }
        i += braced[0].length;
        const next = text.charAt(i);
        if (next === ':') {
            i++;
            out += expandSnippet(readUntil('}'));
            i++;
        } else if (next === '|') {
            i++;
            const choices = readUntil('|}');
            out += (choices.split(',')[0] ?? '').replace(/\\(.)/g, '$1');
            i += 2;
        } else {
            // `${1}`, or a form this reader does not know: nothing.
            readUntil('}');
            i++;
        }
    }
    return out;
}

/** The choices of every `${n|a,b|}` of a snippet, by tab stop. */
export function snippetChoices(text: string): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const m of text.matchAll(/\$\{([0-9]+)\|((?:[^|\\]|\\.)*)\|\}/g)) {
        out.set(
            m[1] ?? '',
            (m[2] ?? '').split(',').map((c) => c.replace(/\\(.)/g, '$1')),
        );
    }
    return out;
}
