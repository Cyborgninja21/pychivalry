/**
 * Mod structure (#83): the logical structure of the mod for the client's CK3 Explorer view,
 * answered from the engine index (`ck3/modStructure`), never by reading files.
 *
 * The view asks one level at a time: no parameters gives the categories with their
 * counts (empty ones left out); a category gives its items, or its groups for Events
 * (namespaces) and Localization (languages); a group gives its items. Every item carries
 * the location of its definition. Nothing is parsed: the index and the localization index
 * already hold every name, range and key count.
 */

import { Range } from 'vscode-languageserver/node';
import { EventMetadata, IndexSymbol, LocalizationFileInfo, SymbolType } from 'pychivalry-engine';

export const MOD_STRUCTURE_REQUEST = 'ck3/modStructure';
/** Sent by the server when the index changed (files on disk, saves, the first index). */
export const MOD_STRUCTURE_CHANGED = 'ck3/modStructureChanged';

export interface ModStructureParams {
    /** A category id (`events`, `decisions`, …); absent for the categories themselves. */
    category?: string;
    /** A group of the category: an event namespace or a localization language. */
    group?: string;
}

export interface ModStructureNode {
    /** Unique in the tree: `events`, `events/my_ns`, `events/my_ns/my_ns.0001@<uri>`. */
    id: string;
    label: string;
    kind: 'category' | 'group' | 'item';
    category: string;
    /** Number of items below a category or group. */
    count?: number;
    /** An event's type, a definition's file name. */
    detail?: string;
    /** Where the item is defined. */
    location?: { uri: string; range: Range };
    /** The request for this node's children; absent on leaves. */
    children?: ModStructureParams;
}

/** What the structure reads from the engine. */
export interface StructureIndex {
    findSymbolsByType(type: SymbolType): IndexSymbol[];
    getEvent(eventId: string): EventMetadata | undefined;
}

export interface StructureLocalization {
    files(): LocalizationFileInfo[];
}

interface Category {
    id: string;
    label: string;
    /** The symbol type listed, for flat categories. */
    type?: SymbolType;
}

/** The categories, in the order the view shows them. */
export const CATEGORIES: readonly Category[] = [
    { id: 'events', label: 'Events' },
    { id: 'decisions', label: 'Decisions', type: SymbolType.DECISION },
    {
        id: 'character_interactions',
        label: 'Character Interactions',
        type: SymbolType.CHARACTER_INTERACTION,
    },
    { id: 'scripted_effects', label: 'Scripted Effects', type: SymbolType.SCRIPTED_EFFECT },
    { id: 'scripted_triggers', label: 'Scripted Triggers', type: SymbolType.SCRIPTED_TRIGGER },
    { id: 'script_values', label: 'Script Values', type: SymbolType.SCRIPT_VALUE },
    { id: 'on_actions', label: 'On-Actions', type: SymbolType.ON_ACTION },
    { id: 'localization', label: 'Localization' },
];

/** `<namespace>.<number>`: an event record (the index also lists `namespace = x`). */
const EVENT_ID = /^([A-Za-z_][A-Za-z0-9_-]*)\.(\d+)$/;

/** Names, natural order: `ns.2` before `ns.10`, then the URI for duplicates. */
export function compareNames(a: string, b: string): number {
    const pa = a.split(/(\d+)/);
    const pb = b.split(/(\d+)/);
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        if (pa[i] === pb[i]) {
            continue;
        }
        const numeric = i % 2 === 1;
        if (numeric) {
            const d = Number(pa[i]) - Number(pb[i]);
            if (d !== 0) {
                return d;
            }
        }
        return pa[i] < pb[i] ? -1 : 1;
    }
    return pa.length - pb.length;
}

function fileName(uri: string): string {
    return decodeURIComponent(uri.slice(uri.lastIndexOf('/') + 1));
}

/** A symbol is a definition the view lists (not a constant or a stray value). */
function isDefinition(symbol: IndexSymbol): boolean {
    return !symbol.name.startsWith('@') && symbol.name !== 'namespace';
}

function bySymbol(a: IndexSymbol, b: IndexSymbol): number {
    return compareNames(a.name, b.name) || (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0);
}

export class ModStructure {
    constructor(
        private index: StructureIndex,
        private localization: StructureLocalization
    ) {}

    public build(params: ModStructureParams = {}): ModStructureNode[] {
        if (params.category === undefined) {
            return this.categories();
        }
        const category = CATEGORIES.find((c) => c.id === params.category);
        if (!category) {
            return [];
        }
        if (category.id === 'events') {
            return params.group === undefined ? this.namespaces() : this.events(params.group);
        }
        if (category.id === 'localization') {
            return params.group === undefined
                ? this.languages()
                : this.localizationFiles(params.group);
        }
        return category.type === undefined ? [] : this.items(category, category.type);
    }

    // ── categories ──────────────────────────────────────────────────────────

    private categories(): ModStructureNode[] {
        const out: ModStructureNode[] = [];
        for (const category of CATEGORIES) {
            let count: number;
            if (category.id === 'events') {
                count = this.eventSymbols().length;
            } else if (category.id === 'localization') {
                count = this.localizationFilesWithKeys().reduce((n, f) => n + f.keys, 0);
            } else {
                count = this.definitions(category.type!).length;
            }
            if (count === 0) {
                continue;
            }
            out.push({
                id: category.id,
                label: category.label,
                kind: 'category',
                category: category.id,
                count,
                children: { category: category.id },
            });
        }
        return out;
    }

    // ── events ──────────────────────────────────────────────────────────────

    private eventSymbols(): IndexSymbol[] {
        return this.index.findSymbolsByType(SymbolType.EVENT).filter((s) => EVENT_ID.test(s.name));
    }

    private namespaces(): ModStructureNode[] {
        const counts = new Map<string, number>();
        for (const symbol of this.eventSymbols()) {
            const namespace = EVENT_ID.exec(symbol.name)![1];
            counts.set(namespace, (counts.get(namespace) ?? 0) + 1);
        }
        return Array.from(counts.keys())
            .sort(compareNames)
            .map((namespace) => ({
                id: `events/${namespace}`,
                label: namespace,
                kind: 'group' as const,
                category: 'events',
                count: counts.get(namespace),
                children: { category: 'events', group: namespace },
            }));
    }

    private events(namespace: string): ModStructureNode[] {
        return this.eventSymbols()
            .filter((s) => EVENT_ID.exec(s.name)![1] === namespace)
            .sort(bySymbol)
            .map((symbol) => ({
                id: `events/${namespace}/${symbol.name}@${symbol.uri}`,
                label: symbol.name,
                kind: 'item' as const,
                category: 'events',
                detail: this.index.getEvent(symbol.name)?.type ?? fileName(symbol.uri),
                location: { uri: symbol.uri, range: symbol.range },
            }));
    }

    // ── flat categories ─────────────────────────────────────────────────────

    private definitions(type: SymbolType): IndexSymbol[] {
        return this.index.findSymbolsByType(type).filter(isDefinition);
    }

    private items(category: Category, type: SymbolType): ModStructureNode[] {
        return this.definitions(type)
            .slice()
            .sort(bySymbol)
            .map((symbol) => ({
                id: `${category.id}/${symbol.name}@${symbol.uri}`,
                label: symbol.name,
                kind: 'item' as const,
                category: category.id,
                detail: fileName(symbol.uri),
                location: { uri: symbol.uri, range: symbol.range },
            }));
    }

    // ── localization ────────────────────────────────────────────────────────

    private localizationFilesWithKeys(): LocalizationFileInfo[] {
        return this.localization.files().filter((f) => f.keys > 0);
    }

    private languages(): ModStructureNode[] {
        const counts = new Map<string, number>();
        for (const file of this.localizationFilesWithKeys()) {
            const language = file.language ?? 'other';
            counts.set(language, (counts.get(language) ?? 0) + file.keys);
        }
        return Array.from(counts.keys())
            .sort(compareNames)
            .map((language) => ({
                id: `localization/${language}`,
                label: language,
                kind: 'group' as const,
                category: 'localization',
                count: counts.get(language),
                children: { category: 'localization', group: language },
            }));
    }

    private localizationFiles(language: string): ModStructureNode[] {
        const start = { line: 0, character: 0 };
        return this.localizationFilesWithKeys()
            .filter((f) => (f.language ?? 'other') === language)
            .sort((a, b) => compareNames(fileName(a.uri), fileName(b.uri)))
            .map((file) => ({
                id: `localization/${language}/${file.uri}`,
                label: fileName(file.uri),
                kind: 'item' as const,
                category: 'localization',
                count: file.keys,
                location: { uri: file.uri, range: { start, end: start } },
            }));
    }
}
