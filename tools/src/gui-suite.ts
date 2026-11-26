/**
 * The GUI parse suite (docs/PLAN.md item 10.3), part of `task game:parse`: it parses every GUI
 * file (`.gui`) of the install, in the three folders the game mounts (the spec package's part
 * D1, `search-path-order`: `clausewitz/`, `jomini/` and `game/`), each folder with the number of
 * files expected; times the parse; lists every finding of the GUI parser with its
 * classification from `tools/data/gui-parse-classifications.json`; and measures every form of
 * GUI syntax the files write, which is the evidence behind docs/gui-syntax.md. With the corpus,
 * it parses every GUI file of each mod too and lists its findings, by mod.
 *
 * It passes when every folder holds the files expected, every file yields a tree, and every
 * finding is classified as a defect of the game's own files: a finding without a
 * classification, a classification that matches no finding, and a pychivalry fault each fail it.
 * Every GUI finding is information (no catalogue message is the GUI reader's, docs/checks.md),
 * and every one is classified: a GUI file parses when it gives none.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
    findingMessage,
    guiBlockOf,
    readGui,
    type GuiBlock,
    type GuiItem,
    type Scalar,
} from '@pychivalry/core';
import { CommandError, EXIT, isObject, readJson } from './util.js';

/** A folder of the install the suite reads, with the evidence for it. */
export interface GuiSuiteFolder {
    /** The install's folder: `game`, `jomini` or `clausewitz`. */
    readonly layer: string;
    /** The folder inside it, with `/`. */
    readonly folder: string;
    /** How many `.gui` files it holds, with its sub-folders. */
    readonly expected: number;
    readonly why: string;
}

/** What the suite reads in game 1.21.0.3: every `.gui` file of the install. */
export const GUI_FOLDERS: readonly GuiSuiteFolder[] = [
    {
        layer: 'game',
        folder: 'gui',
        expected: 441,
        why: "The game's GUI folder: the spec lists `gui` (content type gui, 441 .gui files), and the game's checksum_manifest.txt names it with its sub-directories.",
    },
    {
        layer: 'game',
        folder: 'tweakergui_assets',
        expected: 1,
        why: "The tweaker's GUI file, interface/tweakergui.gui: read by the spec package's GUI companion (C2), which counts 442 files; no folder of the spec lists it, so the index does not read it.",
    },
    {
        layer: 'jomini',
        folder: 'gui',
        expected: 91,
        why: "The install's jomini/ folder, mounted below game/ (part D1, search-path-order); game/gui holds 21 of its paths and replaces each whole (game-file-replaces-jomini-and-clausewitz).",
    },
    {
        layer: 'jomini',
        folder: 'jomini',
        expected: 1,
        why: 'jomini/jomini/gui/encyclopedia/jomini_encyclopedia.gui: a GUI file of the install outside every gui/ folder; whether the game reads it is not shown, and the index does not.',
    },
    {
        layer: 'clausewitz',
        folder: 'gui',
        expected: 49,
        why: "The install's clausewitz/ folder, mounted first (part D1, search-path-order): the engine's own tool windows.",
    },
];

export type GuiClassification = 'game-defect' | 'pychivalry-fault';

export interface GuiClassificationEntry {
    readonly layer: string;
    readonly file: string;
    readonly id: string;
    readonly line: number;
    readonly classification: GuiClassification;
    readonly reason: string;
}

/** Read the classification file: a list of `{ layer, file, id, line, classification, reason }`. */
export function readGuiClassifications(file: string): GuiClassificationEntry[] {
    const data = readJson(file);
    const list = isObject(data) ? data['classifications'] : undefined;
    if (!Array.isArray(list)) {
        throw new CommandError(`${path.basename(file)} has no classifications list`, EXIT.usage);
    }
    return list.map((entry: unknown, n) => {
        if (
            !isObject(entry) ||
            typeof entry['layer'] !== 'string' ||
            typeof entry['file'] !== 'string' ||
            typeof entry['id'] !== 'string' ||
            typeof entry['line'] !== 'number' ||
            (entry['classification'] !== 'game-defect' &&
                entry['classification'] !== 'pychivalry-fault') ||
            typeof entry['reason'] !== 'string' ||
            entry['reason'] === ''
        ) {
            throw new CommandError(
                `${path.basename(file)}: classification ${String(n + 1)} is not { layer, file, id, line, classification, reason }`,
                EXIT.usage,
            );
        }
        return {
            layer: entry['layer'],
            file: entry['file'],
            id: entry['id'],
            line: entry['line'],
            classification: entry['classification'],
            reason: entry['reason'],
        };
    });
}

/** Every regular `.gui` file under `dir`, relative to `base` with `/`, sorted. */
function guiFilesUnder(base: string, dir: string): string[] {
    const out: string[] = [];
    const walk = (at: string): void => {
        for (const entry of readdirSync(at, { withFileTypes: true })) {
            const full = path.join(at, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.gui')) {
                out.push(path.relative(base, full).split(path.sep).join('/'));
            }
        }
    };
    if (statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true) {
        walk(dir);
    }
    return out.sort();
}

/** One form of GUI syntax: how often it is written, in how many files, and its first place. */
export interface FormCount {
    count: number;
    files: number;
    /** How often it is written in each folder of the install: `game`, `jomini`, `clausewitz`. */
    by_layer: Record<string, number>;
    /** `<layer> <file>:<line>`, the first place, the files read in path order. */
    example: string;
}

export interface GuiFolderResult {
    layer: string;
    folder: string;
    expected_files: number;
    files: number;
    trees: number;
    bom: number;
    not_utf8: number;
    findings: number;
    parse_ms: number;
    why: string;
}

export interface GuiFindingResult {
    layer: string;
    file: string;
    line: number;
    column: number;
    id: string;
    message: string;
    classification: GuiClassification | 'unclassified';
    reason: string;
}

export interface GuiModResult {
    slug: string;
    files: number;
    trees: number;
    parse_ms: number;
    findings: { file: string; line: number; column: number; id: string; message: string }[];
}

export interface GuiSuiteResults {
    passed: boolean;
    failures: string[];
    files: number;
    trees: number;
    parse_ms: number;
    folders: GuiFolderResult[];
    findings: GuiFindingResult[];
    /** Every form of GUI syntax the base game's files write (docs/gui-syntax.md), by name. */
    forms: Record<string, FormCount>;
    mods: GuiModResult[];
}

/** Counts the forms of GUI syntax over many files (docs/gui-syntax.md, "How it was measured"). */
class FormCounter {
    readonly forms = new Map<string, FormCount & { lastFile: string }>();

    add(form: string, where: { layer: string; file: string; line: number }): void {
        const place = `${where.layer} ${where.file}`;
        const row = this.forms.get(form);
        if (row === undefined) {
            this.forms.set(form, {
                count: 1,
                files: 1,
                by_layer: { [where.layer]: 1 },
                example: `${place}:${String(where.line)}`,
                lastFile: place,
            });
            return;
        }
        row.count++;
        row.by_layer[where.layer] = (row.by_layer[where.layer] ?? 0) + 1;
        if (row.lastFile !== place) {
            row.files++;
            row.lastFile = place;
        }
    }

    done(): Record<string, FormCount> {
        const out: Record<string, FormCount> = {};
        for (const [form, row] of [...this.forms.entries()].sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
        )) {
            out[form] = {
                count: row.count,
                files: row.files,
                by_layer: row.by_layer,
                example: row.example,
            };
        }
        return out;
    }
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const FLOAT_F = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)f$/;
const PERCENT = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/;
const DATA_BINDING = /^\[[\s\S]*\]$/;

/** The shape of a scalar written as a value, for the counts of docs/gui-syntax.md. */
export function valueShape(scalar: Scalar): string {
    if (scalar.type === 'arithmetic') {
        return 'arithmetic';
    }
    if (scalar.type === 'constant') {
        return 'constant';
    }
    if (scalar.type === 'string') {
        if (DATA_BINDING.test(scalar.value)) {
            return /\s/.test(scalar.value)
                ? 'quoted-data-binding-with-space'
                : 'quoted-data-binding';
        }
        return 'quoted-text';
    }
    const text = scalar.text;
    if (DATA_BINDING.test(text)) {
        return 'data-binding';
    }
    if (text.startsWith('[')) {
        // A bare data binding the lexer cut at a space: its words are values of their own.
        return 'data-binding-cut';
    }
    if (NUMBER.test(text)) {
        return 'number';
    }
    if (FLOAT_F.test(text)) {
        return 'number-with-f';
    }
    if (PERCENT.test(text)) {
        return 'percent';
    }
    if (text.includes('|')) {
        return 'flags';
    }
    if (text.startsWith("'") && text.endsWith("'") && text.length > 1) {
        return 'single-quoted';
    }
    return 'word';
}

/** How a named block's name is written. */
function nameShape(name: Scalar | null): string {
    if (name === null) {
        return 'none';
    }
    if (name.type === 'string') {
        return 'quoted';
    }
    return name.text.startsWith("'") ? 'single-quoted' : 'bare';
}

/** Count every form one GUI file writes. */
function countForms(
    items: readonly GuiItem[],
    counter: FormCounter,
    where: (offset: number) => { layer: string; file: string; line: number },
): void {
    const walk = (list: readonly GuiItem[], depth: number, inTypes: boolean): void => {
        const statements = list.some((i) => i.kind !== 'scalar' && i.kind !== 'comment');
        for (const item of list) {
            const at = where(item.start);
            switch (item.kind) {
                case 'comment':
                    counter.add('comment', at);
                    break;
                case 'scalar':
                    counter.add(statements ? 'value-among-statements' : 'list-value', at);
                    if (!statements) {
                        counter.add(`list-value:${valueShape(item)}`, at);
                    }
                    break;
                case 'gui-block':
                    counter.add('block-without-key', at);
                    break;
                case 'gui-named': {
                    const keyword = item.keyword.text.toLowerCase();
                    counter.add(`named:${keyword}`, at);
                    counter.add(`named:${keyword}:name-${nameShape(item.name)}`, at);
                    if (item.operator !== null) {
                        counter.add(`named:${keyword}:with-equals`, at);
                    }
                    if (item.keyword.text !== keyword) {
                        counter.add(`named:${keyword}:keyword-written-${item.keyword.text}`, at);
                    }
                    counter.add(`named:${keyword}:${depth === 0 ? 'top-level' : 'in-a-block'}`, at);
                    break;
                }
                case 'gui-type': {
                    const keyword = item.keyword.text.toLowerCase();
                    counter.add(`type-definition:${keyword}`, at);
                    counter.add(
                        `type-definition:${keyword}:${inTypes ? 'in-types-block' : 'elsewhere'}`,
                        at,
                    );
                    if (
                        item.base !== null &&
                        item.name.text.toLowerCase() === item.base.text.toLowerCase()
                    ) {
                        counter.add(`type-definition:${keyword}:base-is-itself`, at);
                    }
                    break;
                }
                case 'gui-property': {
                    const key = item.key;
                    counter.add('property', at);
                    if (key.type === 'constant') {
                        counter.add(
                            `constant-definition:${depth === 0 ? 'top-level' : 'in-a-block'}`,
                            at,
                        );
                    }
                    if (item.operator === null) {
                        counter.add('property:without-equals', at);
                    }
                    if (key.text.toLowerCase() === 'using') {
                        counter.add(
                            `using:${item.value?.kind === 'scalar' ? valueShape(item.value) : 'other'}`,
                            at,
                        );
                    }
                    const value = item.value;
                    if (value === null) {
                        counter.add('property:no-value', at);
                    } else if (value.kind === 'scalar') {
                        counter.add(`value:${valueShape(value)}`, at);
                    } else {
                        const shape = blockShape(value);
                        counter.add(`property:block-${shape}`, at);
                        if (depth === 0) {
                            counter.add('top-level-property:block', at);
                        }
                    }
                    break;
                }
            }
            const block = guiBlockOf(item);
            if (block !== undefined) {
                const named = item.kind === 'gui-named' ? item.keyword.text.toLowerCase() : null;
                walk(block.items, depth + 1, named === 'types');
            }
        }
    };
    walk(items, 0, false);
}

/** Whether a block holds statements, values only, or nothing. */
function blockShape(block: GuiBlock): 'empty' | 'list' | 'statements' {
    const items = block.items.filter((i) => i.kind !== 'comment');
    if (items.length === 0) {
        return 'empty';
    }
    return items.every((i) => i.kind === 'scalar') ? 'list' : 'statements';
}

/** Match a finding to its classification by layer, file, finding id and line. */
function classify(
    finding: { layer: string; file: string; id: string; line: number },
    classifications: readonly GuiClassificationEntry[],
): GuiClassificationEntry | undefined {
    return classifications.find(
        (c) =>
            c.layer === finding.layer &&
            c.file === finding.file &&
            c.id === finding.id &&
            c.line === finding.line,
    );
}

function round(ms: number): number {
    return Math.round(ms);
}

/**
 * Run the GUI parse suite on the install around a game folder (`<install>/game`), and on each
 * corpus mod given.
 */
export function runGuiSuite(
    gameDir: string,
    options: {
        classifications: readonly GuiClassificationEntry[];
        folders?: readonly GuiSuiteFolder[];
        mods?: readonly { readonly slug: string; readonly dir: string }[];
    },
): GuiSuiteResults {
    const install = path.dirname(path.resolve(gameDir));
    const folders = options.folders ?? GUI_FOLDERS;
    const failures: string[] = [];
    const findings: GuiFindingResult[] = [];
    const folderResults: GuiFolderResult[] = [];
    const counter = new FormCounter();
    let files = 0;
    let trees = 0;
    let parseMs = 0;
    for (const entry of folders) {
        const layerDir = path.join(install, entry.layer);
        const list = guiFilesUnder(layerDir, path.join(layerDir, ...entry.folder.split('/')));
        const row: GuiFolderResult = {
            layer: entry.layer,
            folder: entry.folder,
            expected_files: entry.expected,
            files: list.length,
            trees: 0,
            bom: 0,
            not_utf8: 0,
            findings: 0,
            parse_ms: 0,
            why: entry.why,
        };
        if (list.length !== entry.expected) {
            failures.push(
                `${entry.layer}/${entry.folder} holds ${String(list.length)} .gui files; ${String(entry.expected)} are expected`,
            );
        }
        for (const rel of list) {
            const bytes = readFileSync(path.join(layerDir, ...rel.split('/')));
            const started = performance.now();
            let parsed: ReturnType<typeof readGui>;
            try {
                parsed = readGui(bytes);
            } catch (err) {
                failures.push(`${entry.layer} ${rel} yielded no tree: ${(err as Error).message}`);
                continue;
            } finally {
                row.parse_ms += performance.now() - started;
            }
            row.trees++;
            if (parsed.bom) {
                row.bom++;
            }
            if (!parsed.validUtf8) {
                row.not_utf8++;
            }
            countForms(parsed.file.items, counter, (offset) => ({
                layer: entry.layer,
                file: rel,
                line: parsed.lines.positionAt(offset).line + 1,
            }));
            for (const finding of parsed.findings) {
                const line = finding.range.start.line + 1;
                const match = classify(
                    { layer: entry.layer, file: rel, id: finding.id, line },
                    options.classifications,
                );
                row.findings++;
                findings.push({
                    layer: entry.layer,
                    file: rel,
                    line,
                    column: finding.range.start.character + 1,
                    id: finding.id,
                    message: findingMessage(finding, { file: rel }),
                    classification: match?.classification ?? 'unclassified',
                    reason: match?.reason ?? '',
                });
            }
        }
        files += row.files;
        trees += row.trees;
        parseMs += row.parse_ms;
        row.parse_ms = round(row.parse_ms);
        folderResults.push(row);
    }
    for (const finding of findings) {
        const at = `${finding.layer} ${finding.file}:${String(finding.line)} ${finding.id}`;
        if (finding.classification === 'unclassified') {
            failures.push(`unclassified GUI finding: ${at}`);
        } else if (finding.classification === 'pychivalry-fault') {
            failures.push(`pychivalry fault: ${at}`);
        }
    }
    for (const c of options.classifications) {
        if (
            !findings.some(
                (f) =>
                    f.layer === c.layer && f.file === c.file && f.id === c.id && f.line === c.line,
            )
        ) {
            failures.push(
                `classification matches no GUI finding: ${c.layer} ${c.file}:${String(c.line)} ${c.id}`,
            );
        }
    }
    const mods: GuiModResult[] = [];
    for (const mod of options.mods ?? []) {
        const list = guiFilesUnder(mod.dir, mod.dir);
        const result: GuiModResult = {
            slug: mod.slug,
            files: list.length,
            trees: 0,
            parse_ms: 0,
            findings: [],
        };
        let ms = 0;
        for (const rel of list) {
            const bytes = readFileSync(path.join(mod.dir, ...rel.split('/')));
            const started = performance.now();
            const parsed = readGui(bytes);
            ms += performance.now() - started;
            result.trees++;
            for (const finding of parsed.findings) {
                result.findings.push({
                    file: rel,
                    line: finding.range.start.line + 1,
                    column: finding.range.start.character + 1,
                    id: finding.id,
                    message: findingMessage(finding, { file: rel }),
                });
            }
        }
        result.parse_ms = round(ms);
        mods.push(result);
    }
    return {
        passed: failures.length === 0,
        failures,
        files,
        trees,
        parse_ms: round(parseMs),
        folders: folderResults,
        findings,
        forms: counter.done(),
        mods,
    };
}
