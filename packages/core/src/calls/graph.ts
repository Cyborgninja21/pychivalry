/**
 * The call graph of a workspace (docs/PLAN.md item 10.6): the call links (`links.ts`) of the mod's
 * and the base game's script files, read from the workspace index and the files' text, a file at
 * a time and only when asked.
 *
 * - **Callers of a name**: the links naming it, written in the files that use the name (the
 *   index's uses, `WorkspaceIndex.references`), so only those files are read.
 * - **Callees of a name**: the links written inside its definitions (`WorkspaceIndex.definitions`),
 *   so only the files that define it are read.
 * - **The whole graph**: every link of every script file the index holds, for the game-file
 *   suites and the fixture's known graph.
 *
 * What the context reader sees is the index's own definitions (`definedNamesOf`), with the base
 * game when the index holds it and without it otherwise: a key is a call only of a definition the
 * index knows, never of every name, as a check without a game folder takes them. The text of a
 * file is the caller's (`files`): the disk's for the command line and the agent server, the
 * editor's for an open file in the language server. A graph answers for the index as it was when
 * made; a caller makes a new one when the files change.
 */

import { compareCodePoints, layerKind } from '../index/order.js';
import type { Definition, WorkspaceIndex } from '../index/workspace.js';
import type { FileSource } from '../lookup/localization.js';
import type { Spec } from '../spec/reader.js';
import { parse } from '../syntax/parser.js';
import type { DefinedNames } from '../check/context.js';
import { definedNamesOf, isLocalizationDatabase } from '../check/names.js';
import { callLinksOf, type CallEnd, type CallLink, type CallPlace } from './links.js';

export interface CallGraphOptions {
    readonly spec: Spec;
    readonly index: WorkspaceIndex;
    /** The text of an indexed file by its layer and path (`diskFileSource`, or an editor's). */
    readonly files: FileSource;
}

/** The kind of a link: its caller's database and its callee's, `events -> events`. */
export function linkKind(link: CallLink): string {
    return `${link.from.database} -> ${link.to.database}`;
}

/** The mod's places first, then the base game's by layer, then by file and place. */
export function comparePlaces(a: CallPlace, b: CallPlace): number {
    const rank = (layer: string): number => (layerKind(layer) === 'mod' ? 0 : 1);
    return (
        rank(a.layer) - rank(b.layer) ||
        compareCodePoints(a.layer, b.layer) ||
        compareCodePoints(a.file, b.file) ||
        a.start - b.start
    );
}

/** True for a definition that can be a caller: one of script, not a localization key. */
function isScriptDefinition(d: Definition): boolean {
    return !isLocalizationDatabase(d.database);
}

/** A definition of a name that can call: its database and the place of its key. */
export type CallDefinition = CallEnd & CallPlace;

/** What the call graph answers for one name: its definitions, what calls it and what it calls. */
export interface CallAnswer {
    readonly name: string;
    /** The name's definitions of script (none of localization), the mod's first. */
    readonly definitions: readonly CallDefinition[];
    /** Every link that names it, the mod's first (`CallGraph.callers`). */
    readonly callers: readonly CallLink[];
    /** Every link written in its definitions, the mod's first (`CallGraph.callees`). */
    readonly callees: readonly CallLink[];
}

export class CallGraph {
    private readonly names: DefinedNames;
    private readonly byFile = new Map<string, readonly CallLink[]>();

    constructor(private readonly options: CallGraphOptions) {
        this.names = definedNamesOf(options.index);
    }

    /** Every link written in one file of the index, in the order of where each is written. */
    linksOf(layer: string, path: string): readonly CallLink[] {
        const key = `${layer}\u0000${path}`;
        const known = this.byFile.get(key);
        if (known !== undefined) {
            return known;
        }
        const index = this.options.index;
        const indexed = index.getFile(layer, path);
        let links: readonly CallLink[] = [];
        const content = indexed?.kind === 'script' ? this.options.files(layer, path) : undefined;
        if (content !== undefined) {
            const text = typeof content === 'string' ? content : index.decode(content).text;
            const parsed = parse(text);
            links = callLinksOf({
                spec: this.options.spec,
                folders: index.folders,
                layer,
                file: path,
                tree: parsed.file,
                lines: parsed.lines,
                names: this.names,
                definitions: index.definitionsIn(layer, path).filter(isScriptDefinition),
            });
        }
        this.byFile.set(key, links);
        return links;
    }

    /** The definitions of a name that can call: those of script, the mod's first. */
    definitionsOf(name: string): Definition[] {
        return this.options.index
            .definitions(name)
            .filter(isScriptDefinition)
            .sort((a, b) => comparePlaces(a, b));
    }

    /** Every link that names `name`, wherever it is written: the mod's first. */
    callers(name: string): CallLink[] {
        const files = new Map<string, { layer: string; file: string }>();
        for (const use of this.options.index.references(name)) {
            files.set(`${use.layer}\u0000${use.file}`, { layer: use.layer, file: use.file });
        }
        const out: CallLink[] = [];
        for (const { layer, file } of files.values()) {
            out.push(...this.linksOf(layer, file).filter((l) => l.to.name === name));
        }
        return out.sort((a, b) => comparePlaces(a.at, b.at));
    }

    /** Every link written inside a definition of `name`: what it calls, the mod's first. */
    callees(name: string): CallLink[] {
        const out: CallLink[] = [];
        for (const d of this.definitionsOf(name)) {
            out.push(
                ...this.linksOf(d.layer, d.file).filter(
                    (l) =>
                        l.from.name === name &&
                        l.from.database === d.database &&
                        l.from.start === d.start,
                ),
            );
        }
        return out.sort((a, b) => comparePlaces(a.at, b.at));
    }

    /** Callers, callees and definitions of one name, as every surface gives them. */
    answer(name: string): CallAnswer {
        return {
            name,
            definitions: this.definitionsOf(name).map((d) => ({
                name: d.name,
                database: d.database,
                layer: d.layer,
                file: d.file,
                start: d.start,
                end: d.end,
                range: d.range,
            })),
            callers: this.callers(name),
            callees: this.callees(name),
        };
    }

    /** Every link of every script file the index holds, file by file in the index's order. */
    all(): CallLink[] {
        const out: CallLink[] = [];
        for (const file of this.options.index.allFiles()) {
            if (file.kind === 'script') {
                out.push(...this.linksOf(file.layer, file.path));
            }
        }
        return out;
    }
}
