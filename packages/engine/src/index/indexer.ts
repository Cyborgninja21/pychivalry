/**
 * The workspace index: one class built from the extension's core/indexer.ts
 * (DocumentIndexer) plus the parts of core/indexer-enhanced.ts that the call-hierarchy,
 * code-lens and hover providers use (event metadata, event-namespace lookup, reference
 * tracking, the call graph).
 *
 * `DocumentIndexer` and `EnhancedIndexer` are exported as aliases of `Indexer` so a
 * provider's import changes in one place. Additions over the extension's indexer:
 * scripted lists, scripted modifiers and file-local `scripted_trigger x = { }` /
 * `scripted_effect x = { }` definitions are indexed, and indexing can run synchronously.
 */

import { ASTNode, NodeType, Range } from '../syntax/ast';
import { CallGraph } from './call-graph';
import { IndexSymbol, SymbolType } from './symbols';

export { SymbolType } from './symbols';
export type { IndexSymbol, Symbol, SymbolLookup } from './symbols';

export type EventType =
    | 'character_event'
    | 'letter_event'
    | 'activity_event'
    | 'string_event'
    | 'window_event'
    | 'empty_event';

const EVENT_TYPES: ReadonlySet<string> = new Set([
    'character_event',
    'letter_event',
    'activity_event',
    'string_event',
    'window_event',
    'empty_event',
]);

/** Key of an event record: `<namespace>.<number>`. */
const EVENT_RECORD_ID = /^[A-Za-z_][A-Za-z0-9_-]*\.\d+$/;

function isEventType(key: string): key is EventType {
    return EVENT_TYPES.has(key);
}

/** Event metadata with full details */
export interface EventMetadata {
    id: string;
    namespace: string;
    number: string;
    type: EventType;
    theme?: string;
    title?: string;
    desc?: string;
    options: EventOption[];
    triggers: string[];
    immediate: string[];
    after: string[];
    portrait?: PortraitConfig;
    animation?: string;
    references: EventReference[];
    localizationKeys: string[];
    sourceUri: string;
}

export interface EventOption {
    name: string;
    triggers: string[];
    effects: string[];
    ai_chance?: number;
    /** Events triggered by this option */
    triggeredEvents: string[];
}

export interface PortraitConfig {
    character?: string;
    position?: string;
    animation?: string;
}

export interface EventReference {
    fromEvent: string;
    toEvent: string;
    via: 'option' | 'immediate' | 'after';
    optionIndex?: number;
}

/** A reference to a name that no indexed symbol defines (yet). */
export interface UndefinedReference {
    name: string;
    type: SymbolType;
    locations: ReferenceLocation[];
}

/** Reference information */
export interface Reference {
    symbol: IndexSymbol;
    locations: ReferenceLocation[];
}

export interface ReferenceLocation {
    uri: string;
    range: Range;
    context: 'call' | 'definition' | 'import' | 'trigger' | 'effect';
}

interface FileKind {
    test: RegExp;
    type: SymbolType;
}

/**
 * Directory patterns → symbol type of the file's top-level keys (first match wins). Each is
 * anchored to whole path segments and tested against the mod-relative path, so a mod folder
 * (or a folder above it) named `viet-events` or `events` does not make every file an event
 * file (issue #90). decision_group_types comes before decisions.
 */
const FILE_KINDS: FileKind[] = [
    { test: /(^|\/)decision_group_types?\//, type: SymbolType.DECISION_GROUP_TYPE },
    { test: /(^|\/)events?\//, type: SymbolType.EVENT },
    { test: /(^|\/)decisions?\//, type: SymbolType.DECISION },
    { test: /(^|\/)character_interactions?\//, type: SymbolType.CHARACTER_INTERACTION },
    { test: /(^|\/)on_actions?\//, type: SymbolType.ON_ACTION },
    { test: /(^|\/)story_cycles?\//, type: SymbolType.STORY_CYCLE },
    { test: /(^|\/)activities\//, type: SymbolType.ACTIVITY },
    { test: /(^|\/)schemes\//, type: SymbolType.SCHEME },
    { test: /(^|\/)scripted_effects\//, type: SymbolType.SCRIPTED_EFFECT },
    { test: /(^|\/)scripted_triggers\//, type: SymbolType.SCRIPTED_TRIGGER },
    { test: /(^|\/)scripted_lists\//, type: SymbolType.SCRIPTED_LIST },
    { test: /(^|\/)scripted_modifiers\//, type: SymbolType.SCRIPTED_MODIFIER },
    { test: /(^|\/)modifier_definition_formats\//, type: SymbolType.MODIFIER_FORMAT },
    { test: /(^|\/)scripted_guis?\//, type: SymbolType.SCRIPTED_GUI },
    { test: /(^|\/)script_values?\//, type: SymbolType.SCRIPT_VALUE },
    { test: /(^|\/)common\/traits?\//, type: SymbolType.TRAIT },
    { test: /(^|\/)common\/modifiers?\//, type: SymbolType.MODIFIER },
    { test: /(^|\/)opinion_modifiers?\//, type: SymbolType.OPINION_MODIFIER },
];

/** The symbol type of a file's top-level keys from its (mod-relative) path. */
export function symbolTypeForPath(relativePath: string): SymbolType {
    const normalized = relativePath.replace(/\\/g, '/');
    for (const kind of FILE_KINDS) {
        if (kind.test.test(normalized)) {
            return kind.type;
        }
    }
    return SymbolType.GENERIC;
}

/** The path part of a URI (decoded), or the string itself when it is not a URI. */
function uriPath(uri: string): string {
    const match = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)$/i.exec(uri);
    if (!match) {
        return uri;
    }
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const list = map.get(key);
    if (list) {
        list.push(value);
    } else {
        map.set(key, [value]);
    }
}

function stringValue(node: ASTNode): string | undefined {
    return typeof node.value === 'string' ? node.value : undefined;
}

function findChildValue(node: ASTNode, key: string): string | null {
    for (const child of node.children ?? []) {
        if (child.key === key) {
            return typeof child.value === 'string' ? child.value : null;
        }
    }
    return null;
}

function childKeys(node: ASTNode): string[] {
    const keys: string[] = [];
    for (const child of node.children ?? []) {
        if (child.key) {
            keys.push(child.key);
        }
    }
    return keys;
}

/** Options of an index. */
export interface IndexerOptions {
    /**
     * Record the names each file mentions (keys, values and their segments), the basis of
     * dependentsOf(). On by default; off for an index nobody asks for dependents (the
     * vanilla base game's).
     */
    trackMentions?: boolean;
    /**
     * The path of a document relative to its mod (or game) root, used to classify its
     * top-level keys by directory. Undefined (or no resolver) falls back to the URI's path.
     */
    relativePath?: (uri: string) => string | undefined;
}

const WHOLE_TOKEN_SPLIT = /[^A-Za-z0-9_.]+/;
const SEGMENT_SPLIT = /[^A-Za-z0-9_]+/;
const NUMERIC = /^[0-9.]+$/;

/**
 * The names a key or value mentions: the token itself, its parts between operators and
 * prefixes (`scope:actor` → `actor`, keeping dotted event ids whole) and its dot segments
 * (`root.my_list` → `my_list`). Numbers are left out.
 */
function mentionedNames(token: string, out: Set<string>): void {
    out.add(token);
    for (const part of token.split(WHOLE_TOKEN_SPLIT)) {
        if (part !== '' && !NUMERIC.test(part)) {
            out.add(part);
        }
    }
    for (const part of token.split(SEGMENT_SPLIT)) {
        if (part !== '' && !NUMERIC.test(part)) {
            out.add(part);
        }
    }
}

/**
 * Is a symbol a definition other files can depend on? Event namespaces are not, nor are the
 * other top-level keys of an event file that are not event records (its namespace line).
 */
function isDependencyDefinition(symbol: IndexSymbol): boolean {
    if (symbol.type === SymbolType.NAMESPACE) {
        return false;
    }
    return symbol.type !== SymbolType.EVENT || EVENT_RECORD_ID.test(symbol.name);
}

function traverse(node: ASTNode, callback: (node: ASTNode) => void): void {
    callback(node);
    for (const child of node.children ?? []) {
        traverse(child, callback);
    }
}

/**
 * Workspace-wide symbol index
 */
export class Indexer {
    private symbols: Map<string, IndexSymbol[]> = new Map(); // uri -> symbols
    private nameIndex: Map<string, IndexSymbol[]> = new Map(); // name -> symbols
    private typeIndex: Map<SymbolType, IndexSymbol[]> = new Map(); // type -> symbols

    private events: Map<string, EventMetadata> = new Map();
    private eventsByNamespace: Map<string, EventMetadata[]> = new Map();
    private references: Map<string, Reference> = new Map();
    /** References to names without a definition when they were indexed. */
    private unresolved: Map<string, ReferenceLocation[]> = new Map();
    private callGraph: CallGraph = new CallGraph(this);
    /** Names each file mentions (uri → names) and the reverse (name → uris). */
    private mentionsByUri: Map<string, Set<string>> = new Map();
    private mentionIndex: Map<string, Set<string>> = new Map();
    private readonly trackMentions: boolean;
    private readonly relativePath: ((uri: string) => string | undefined) | undefined;

    constructor(options: IndexerOptions = {}) {
        this.trackMentions = options.trackMentions ?? true;
        this.relativePath = options.relativePath;
    }

    /** The symbol type of a document's top-level keys (by its mod-relative directory). */
    public fileTypeOf(uri: string): SymbolType {
        let rel: string | undefined;
        try {
            rel = this.relativePath?.(uri);
        } catch {
            rel = undefined;
        }
        return symbolTypeForPath(rel ?? uriPath(uri));
    }

    /**
     * Index a document's symbols (asynchronous signature kept for the extension's callers).
     */
    public async indexDocument(uri: string, ast: ASTNode): Promise<void> {
        this.indexSync(uri, ast);
    }

    /** Same as indexDocument: the extension's EnhancedIndexer entry point. */
    public async indexDocumentEnhanced(uri: string, ast: ASTNode): Promise<void> {
        this.indexSync(uri, ast);
    }

    /** Index a document synchronously: symbols, events, references, call graph. */
    public indexSync(uri: string, ast: ASTNode): void {
        this.removeDocument(uri);

        const symbols = this.extractSymbols(uri, ast);
        this.symbols.set(uri, symbols);
        for (const symbol of symbols) {
            pushTo(this.nameIndex, symbol.name, symbol);
            pushTo(this.typeIndex, symbol.type, symbol);
        }

        this.extractEventMetadata(uri, ast);
        this.extractReferences(uri, ast);
        this.callGraph.buildFromAST(uri, ast);
        if (this.trackMentions) {
            this.extractMentions(uri, ast);
        }
    }

    /**
     * Remove a document from the index
     */
    public removeDocument(uri: string): void {
        const symbols = this.symbols.get(uri);
        if (symbols) {
            for (const symbol of symbols) {
                this.removeFrom(this.nameIndex, symbol.name, uri);
                this.removeFrom(this.typeIndex, symbol.type, uri);
            }
            this.symbols.delete(uri);
        }
        this.clearEnhancedData(uri);
        this.clearMentions(uri);
    }

    private extractMentions(uri: string, ast: ASTNode): void {
        const names = new Set<string>();
        traverse(ast, (node) => {
            if (node.key) {
                mentionedNames(node.key, names);
            }
            if (typeof node.value === 'string' && node.value !== '') {
                mentionedNames(node.value, names);
            }
        });
        this.mentionsByUri.set(uri, names);
        for (const name of names) {
            let uris = this.mentionIndex.get(name);
            if (!uris) {
                uris = new Set();
                this.mentionIndex.set(name, uris);
            }
            uris.add(uri);
        }
    }

    private clearMentions(uri: string): void {
        const names = this.mentionsByUri.get(uri);
        if (!names) {
            return;
        }
        for (const name of names) {
            const uris = this.mentionIndex.get(name);
            if (uris) {
                uris.delete(uri);
                if (uris.size === 0) {
                    this.mentionIndex.delete(name);
                }
            }
        }
        this.mentionsByUri.delete(uri);
    }

    /**
     * The files whose diagnostics may change when `uri` changes: every other indexed file
     * that mentions a name `uri` defines (a scripted effect or trigger it calls, an event it
     * fires, a saved scope it reads, a script value, a list ...), plus the reference and
     * call-graph sites of those names. `extraNames` adds names the file defined before
     * its last edit, so that callers of a definition that was just removed are included.
     * Event namespaces (and an event file's namespace line) are not counted as
     * definitions. Sorted.
     */
    public dependentsOf(uri: string, extraNames: Iterable<string> = []): string[] {
        const names = new Set<string>(extraNames);
        for (const symbol of this.getDocumentSymbols(uri)) {
            if (isDependencyDefinition(symbol)) {
                names.add(symbol.name);
            }
        }
        const out = new Set<string>();
        for (const name of names) {
            for (const other of this.mentionIndex.get(name) ?? []) {
                out.add(other);
            }
            for (const location of this.references.get(name)?.locations ?? []) {
                out.add(location.uri);
            }
            for (const edge of this.callGraph.getIncomingCalls(name)) {
                out.add(edge.sourceUri);
            }
        }
        out.delete(uri);
        return Array.from(out).sort();
    }

    /** Names a file defines (its symbols except event namespaces), for dependentsOf(). */
    public definedNames(uri: string): string[] {
        return this.getDocumentSymbols(uri)
            .filter(isDependencyDefinition)
            .map((s) => s.name);
    }

    private removeFrom<K>(map: Map<K, IndexSymbol[]>, key: K, uri: string): void {
        const list = map.get(key);
        if (!list) {
            return;
        }
        const filtered = list.filter((s) => s.uri !== uri);
        if (filtered.length === 0) {
            map.delete(key);
        } else {
            map.set(key, filtered);
        }
    }

    private clearEnhancedData(uri: string): void {
        for (const [eventId, metadata] of this.events) {
            if (metadata.sourceUri === uri) {
                this.events.delete(eventId);
            }
        }
        for (const [ns, events] of this.eventsByNamespace) {
            const filtered = events.filter((e) => e.sourceUri !== uri);
            if (filtered.length === 0) {
                this.eventsByNamespace.delete(ns);
            } else {
                this.eventsByNamespace.set(ns, filtered);
            }
        }
        for (const [name, ref] of this.references) {
            ref.locations = ref.locations.filter((loc) => loc.uri !== uri);
            if (ref.locations.length === 0) {
                this.references.delete(name);
            }
        }
        for (const [name, locations] of this.unresolved) {
            const kept = locations.filter((loc) => loc.uri !== uri);
            if (kept.length === 0) {
                this.unresolved.delete(name);
            } else {
                this.unresolved.set(name, kept);
            }
        }
        this.callGraph.clearDocument(uri);
    }

    /** Remove every document from the index. */
    public clear(): void {
        for (const uri of Array.from(this.symbols.keys())) {
            this.removeDocument(uri);
        }
        this.symbols.clear();
        this.nameIndex.clear();
        this.typeIndex.clear();
        this.events.clear();
        this.eventsByNamespace.clear();
        this.references.clear();
        this.unresolved.clear();
        this.mentionsByUri.clear();
        this.mentionIndex.clear();
    }

    /** Find symbols by name */
    public findSymbolsByName(name: string): IndexSymbol[] {
        return this.nameIndex.get(name) || [];
    }

    /** Find symbols by type */
    public findSymbolsByType(type: SymbolType): IndexSymbol[] {
        return this.typeIndex.get(type) || [];
    }

    /** Is `name` defined in the index with one of `types`? */
    public hasSymbol(name: string, ...types: SymbolType[]): boolean {
        const found = this.nameIndex.get(name);
        return found !== undefined && found.some((s) => types.includes(s.type));
    }

    /** Get all symbols in a document */
    public getDocumentSymbols(uri: string): IndexSymbol[] {
        return this.symbols.get(uri) || [];
    }

    /** Search symbols by pattern */
    public searchSymbols(pattern: string): IndexSymbol[] {
        const results: IndexSymbol[] = [];
        const lowerPattern = pattern.toLowerCase();
        for (const symbols of this.nameIndex.values()) {
            for (const symbol of symbols) {
                if (symbol.name.toLowerCase().includes(lowerPattern)) {
                    results.push(symbol);
                }
            }
        }
        return results;
    }

    /** URIs currently indexed. */
    public getIndexedUris(): string[] {
        return Array.from(this.symbols.keys());
    }

    /** Get event metadata by ID */
    public getEvent(eventId: string): EventMetadata | undefined {
        return this.events.get(eventId);
    }

    /** Get all events in a namespace */
    public getEventsByNamespace(namespace: string): EventMetadata[] {
        return this.eventsByNamespace.get(namespace) || [];
    }

    /** Get all tracked event metadata */
    public getAllEvents(): Map<string, EventMetadata> {
        return this.events;
    }

    /** Get all references to a symbol */
    public getReferences(symbolName: string): Reference | undefined {
        return this.references.get(symbolName);
    }

    /** Events an event triggers (from its options, immediate and after blocks). */
    public getEventChain(eventId: string): string[] {
        const event = this.events.get(eventId);
        if (!event) {
            return [];
        }
        return Array.from(new Set(event.references.map((r) => r.toEvent)));
    }

    /** Localization keys the indexed events use (title, desc, option names), sorted. */
    public getLocalizationKeys(): string[] {
        const keys = new Set<string>();
        for (const event of this.events.values()) {
            for (const key of event.localizationKeys) {
                keys.add(key);
            }
        }
        return Array.from(keys).sort();
    }

    /**
     * References (trigger_event, add_to_list, flag and variable checks) to names that no
     * indexed symbol defines now. Resolved when asked, so the order files are indexed in
     * does not matter.
     */
    public getUndefinedReferences(): UndefinedReference[] {
        const out: UndefinedReference[] = [];
        for (const [name, locations] of this.unresolved) {
            if (this.findSymbolsByName(name).length > 0) {
                continue;
            }
            const type = /^\w+\.\d+$/.test(name) ? SymbolType.EVENT : SymbolType.GENERIC;
            out.push({ name, type, locations: [...locations] });
        }
        return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }

    /** Get the call graph instance for call hierarchy and code lens */
    public getCallGraph(): CallGraph {
        return this.callGraph;
    }

    /** Get statistics about the index */
    public getStatistics(): {
        totalDocuments: number;
        totalSymbols: number;
        symbolsByType: Record<string, number>;
    } {
        const symbolsByType: Record<string, number> = {};
        for (const [type, symbols] of this.typeIndex.entries()) {
            symbolsByType[type] = symbols.length;
        }
        let totalSymbols = 0;
        for (const symbols of this.symbols.values()) {
            totalSymbols += symbols.length;
        }
        return { totalDocuments: this.symbols.size, totalSymbols, symbolsByType };
    }

    // ── symbol extraction (core/indexer.ts) ─────────────────────────────

    private extractSymbols(uri: string, ast: ASTNode): IndexSymbol[] {
        const symbols: IndexSymbol[] = [];
        if (!ast.children) {
            return symbols;
        }
        const fileType = this.fileTypeOf(uri);

        for (const node of ast.children) {
            if (node.type === NodeType.COMMENT || node.type === NodeType.VALUE) {
                continue;
            }
            const name = node.key;
            if (!name) {
                continue;
            }

            let type = fileType;
            let detail: string | undefined;
            if (node.keyPrefix === 'scripted_trigger') {
                type = SymbolType.SCRIPTED_TRIGGER;
            } else if (node.keyPrefix === 'scripted_effect') {
                type = SymbolType.SCRIPTED_EFFECT;
            } else if (type === SymbolType.EVENT) {
                detail = this.extractTitleDetail(node, true);
            } else if (type === SymbolType.DECISION) {
                detail = this.extractTitleDetail(node, false);
            }

            if (type === SymbolType.EVENT && name.includes('.')) {
                const [namespace] = name.split('.');
                symbols.push({
                    name: namespace,
                    type: SymbolType.NAMESPACE,
                    uri,
                    range: node.range,
                });
            }

            symbols.push({ name, type, uri, range: node.range, detail });

            if (node.children) {
                symbols.push(...this.extractNestedSymbols(uri, node.children));
            }
        }
        return symbols;
    }

    /** Nested symbols: saved scopes and variables. */
    private extractNestedSymbols(uri: string, nodes: ASTNode[]): IndexSymbol[] {
        const symbols: IndexSymbol[] = [];
        for (const node of nodes) {
            if (
                (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') &&
                node.value !== undefined &&
                node.value !== ''
            ) {
                symbols.push({
                    name: String(node.value),
                    type: SymbolType.SCOPE,
                    uri,
                    range: node.range,
                });
            }
            if (
                (node.key === 'save_scope_value_as' ||
                    node.key === 'save_temporary_scope_value_as') &&
                node.children
            ) {
                const nameNode = node.children.find((c) => c.key === 'name');
                if (nameNode && nameNode.value !== undefined) {
                    symbols.push({
                        name: String(nameNode.value),
                        type: SymbolType.SCOPE,
                        uri,
                        range: node.range,
                    });
                }
            }
            if (node.key === 'set_variable' && node.children) {
                const nameNode = node.children.find((c) => c.key === 'name');
                if (nameNode && nameNode.value !== undefined) {
                    symbols.push({
                        name: String(nameNode.value),
                        type: SymbolType.VARIABLE,
                        uri,
                        range: node.range,
                    });
                }
            }
            if (node.children) {
                symbols.push(...this.extractNestedSymbols(uri, node.children));
            }
        }
        return symbols;
    }

    private extractTitleDetail(node: ASTNode, allowDesc: boolean): string | undefined {
        const titleNode = node.children?.find((c) => c.key === 'title');
        if (titleNode && titleNode.value) {
            return String(titleNode.value);
        }
        if (allowDesc) {
            const descNode = node.children?.find((c) => c.key === 'desc');
            if (descNode && descNode.value) {
                return String(descNode.value);
            }
        }
        return undefined;
    }

    // ── event metadata (core/indexer-enhanced.ts) ───────────────────────

    private extractEventMetadata(uri: string, ast: ASTNode): void {
        const add = (metadata: EventMetadata | null): void => {
            if (metadata) {
                this.events.set(metadata.id, metadata);
                pushTo(this.eventsByNamespace, metadata.namespace, metadata);
            }
        };
        // The CK3 form: `<namespace>.<number> = { type = character_event ... }` records.
        for (const node of ast.children ?? []) {
            if (node.key && node.children && EVENT_RECORD_ID.test(node.key)) {
                add(this.parseEventNode(node, 'character_event', uri, node.key));
            }
        }
        // The older keyed form: `character_event = { id = <namespace>.<number> ... }`.
        traverse(ast, (node) => {
            if (node.key && isEventType(node.key)) {
                add(this.parseEventNode(node, node.key, uri));
            }
        });
    }

    private parseEventNode(
        node: ASTNode,
        eventType: EventType,
        uri: string,
        id?: string
    ): EventMetadata | null {
        const eventId = id ?? findChildValue(node, 'id');
        if (!eventId) {
            return null;
        }
        const [namespace, number] = eventId.split('.');
        const metadata: EventMetadata = {
            id: eventId,
            namespace,
            number,
            type: eventType,
            options: [],
            triggers: [],
            immediate: [],
            after: [],
            references: [],
            localizationKeys: [],
            sourceUri: uri,
        };

        for (const child of node.children ?? []) {
            switch (child.key) {
                case 'type':
                    if (typeof child.value === 'string' && isEventType(child.value)) {
                        metadata.type = child.value;
                    }
                    break;
                case 'theme':
                    metadata.theme = stringValue(child);
                    break;
                case 'title':
                case 'desc': {
                    const value = stringValue(child);
                    metadata[child.key] = value;
                    if (value !== undefined) {
                        metadata.localizationKeys.push(value);
                    }
                    break;
                }
                case 'trigger':
                    metadata.triggers.push(...childKeys(child));
                    break;
                case 'immediate':
                case 'after':
                    metadata[child.key].push(...childKeys(child));
                    this.extractTriggeredEvents(child, metadata, child.key);
                    break;
                case 'option':
                    metadata.options.push(this.parseOption(child, metadata));
                    break;
                case 'left_portrait':
                case 'right_portrait': {
                    const portrait: PortraitConfig = {};
                    for (const p of child.children ?? []) {
                        if (p.key === 'character' || p.key === 'animation') {
                            portrait[p.key] = stringValue(p);
                        }
                    }
                    metadata.portrait = portrait;
                    break;
                }
            }
        }
        return metadata;
    }

    private parseOption(node: ASTNode, eventMetadata: EventMetadata): EventOption {
        const option: EventOption = { name: '', triggers: [], effects: [], triggeredEvents: [] };
        for (const child of node.children ?? []) {
            switch (child.key) {
                case 'name':
                    option.name = stringValue(child) ?? '';
                    if (typeof child.value === 'string') {
                        eventMetadata.localizationKeys.push(child.value);
                    }
                    break;
                case 'trigger':
                    option.triggers.push(...childKeys(child));
                    break;
                case 'ai_chance':
                    break;
                default:
                    option.effects.push(...childKeys(child));
                    this.extractTriggeredEvents(child, eventMetadata, 'option', option);
                    break;
            }
        }
        return option;
    }

    private extractTriggeredEvents(
        node: ASTNode,
        metadata: EventMetadata,
        via: 'option' | 'immediate' | 'after',
        option?: EventOption
    ): void {
        traverse(node, (n) => {
            if (n.key !== 'trigger_event') {
                return;
            }
            const eventId = typeof n.value === 'string' ? n.value : findChildValue(n, 'id');
            if (eventId) {
                metadata.references.push({ fromEvent: metadata.id, toEvent: eventId, via });
                option?.triggeredEvents.push(eventId);
            }
        });
    }

    // ── references (core/indexer-enhanced.ts) ───────────────────────────

    private extractReferences(uri: string, ast: ASTNode): void {
        traverse(ast, (node) => {
            if (node.key === 'trigger_event' || node.key === 'add_to_list') {
                const symbolName =
                    typeof node.value === 'string' ? node.value : findChildValue(node, 'id');
                if (symbolName) {
                    this.addReference(symbolName, uri, node, 'call');
                }
            }
            if (node.key === 'has_character_flag' || node.key === 'has_global_variable') {
                if (typeof node.value === 'string') {
                    this.addReference(node.value, uri, node, 'trigger');
                }
            }
        });
    }

    private addReference(
        symbolName: string,
        uri: string,
        node: ASTNode,
        context: ReferenceLocation['context']
    ): void {
        let ref = this.references.get(symbolName);
        if (!ref) {
            const symbols = this.findSymbolsByName(symbolName);
            if (symbols.length === 0) {
                // Not defined (yet): kept for getUndefinedReferences().
                const list = this.unresolved.get(symbolName) ?? [];
                list.push({ uri, range: node.range, context });
                this.unresolved.set(symbolName, list);
                return;
            }
            ref = { symbol: symbols[0], locations: [] };
            this.references.set(symbolName, ref);
        }
        ref.locations.push({ uri, range: node.range, context });
    }
}

/** The extension's names for the same index. */
export { Indexer as DocumentIndexer, Indexer as EnhancedIndexer };
