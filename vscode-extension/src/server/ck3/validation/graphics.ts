/**
 * Graphics files: references to .dds, .png and .tga files that do not exist.
 *
 * Diagnostic codes:
 * - GFX001: Graphics file not found (warning)
 *
 * A missing texture shows in game as a pink or black checkerboard; this plug-in reports the
 * reference in the editor instead. Rebuilt from pychivalry PR #56 (the Python server's
 * gfx_validator.py) as an extension plug-in: it needs the file system, which the engine core
 * does not touch.
 *
 * What counts as a reference: one of GRAPHICS_KEYS with a scalar value that looks like a
 * path to a graphics file (at least one '/' or '\', one of GRAPHICS_EXTENSIONS). A bare name
 * (`icon = standard_character_event`) is a key into another database, and a bare file name
 * (`icon = "death_unknown.dds"`) is resolved by its database against a folder of its own:
 * neither is a path the game resolves against a content root, so neither is checked. Values
 * with `$VARIABLE$` placeholders or `[...]` expressions, absolute paths and paths with `..`
 * segments are skipped too.
 *
 * Resolution mirrors the game: a path is relative to a content root, searched in the mod
 * roots of the workspace, then the base game's `game/` and every `game/dlc/<dlc>/` folder.
 * The existence test is case-insensitive on every platform (CK3 runs on Windows and most
 * mods are written there), through a per-directory listing cache that the server drops for
 * a directory when the file watcher reports a file created or deleted under it.
 *
 * Without the base game a miss cannot be proven (the file may be the base game's, or a DLC's),
 * so the check reports nothing at all until the base game is known.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from 'pychivalry-engine';

/** The keys whose values name a graphics file (PR #56's reference patterns). */
export const GRAPHICS_KEYS: ReadonlySet<string> = new Set([
    'icon',
    'texture',
    'sprite',
    'background',
    'portrait_texture',
    'reference',
    'activity_window_background',
    'background_texture',
    'icon_texture',
]);

/** The graphics file extensions CK3 loads (compared case-insensitively). */
export const GRAPHICS_EXTENSIONS: readonly string[] = ['.dds', '.png', '.tga'];

/**
 * The graphics path a value names, normalised ('/' separators, no leading './'), or undefined
 * when the value is not a path to a graphics file.
 */
export function extractGraphicsPath(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    let p = value.trim();
    if (p.length >= 2 && (p[0] === '"' || p[0] === "'") && p[p.length - 1] === p[0]) {
        p = p.slice(1, -1).trim();
    }
    // $VARIABLE$ placeholders and [...] expressions are filled in at run time.
    if (p.length === 0 || /[$[\]]/.test(p)) {
        return undefined;
    }
    p = p.replace(/\\/g, '/');
    while (p.startsWith('./')) {
        p = p.slice(2);
    }
    if (!p.includes('/')) {
        return undefined;
    }
    // Absolute paths and paths leaving the content root are not content paths.
    if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) {
        return undefined;
    }
    const segments = p.split('/');
    if (segments.some((s) => s === '' || s === '.' || s === '..')) {
        return undefined;
    }
    const lower = p.toLowerCase();
    if (!GRAPHICS_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        return undefined;
    }
    return p;
}

/** True when `key = value` references a graphics file. */
export function isGraphicsReference(key: string | undefined, value: unknown): boolean {
    return key !== undefined && GRAPHICS_KEYS.has(key) && extractGraphicsPath(value) !== undefined;
}

interface Entry {
    name: string;
    directory: boolean;
}

/**
 * Directory listings, read once per directory and grouped by lower-cased name, so a path is
 * found whatever the case of its segments.
 */
export class DirectoryCache {
    private readonly listings = new Map<string, Map<string, Entry[]> | null>();
    /** Directory reads performed (tests and statistics). */
    public reads = 0;

    /** The entries of `dir` by lower-cased name, or undefined when it is not a directory. */
    public list(dir: string): ReadonlyMap<string, readonly Entry[]> | undefined {
        const key = path.resolve(dir);
        const cached = this.listings.get(key);
        if (cached !== undefined) {
            return cached ?? undefined;
        }
        this.reads++;
        let listing: Map<string, Entry[]> | null = null;
        try {
            listing = new Map();
            for (const dirent of fs.readdirSync(key, { withFileTypes: true })) {
                let directory = dirent.isDirectory();
                if (dirent.isSymbolicLink()) {
                    try {
                        directory = fs.statSync(path.join(key, dirent.name)).isDirectory();
                    } catch {
                        continue; // dangling link
                    }
                }
                const lower = dirent.name.toLowerCase();
                const list = listing.get(lower) ?? [];
                list.push({ name: dirent.name, directory });
                listing.set(lower, list);
            }
        } catch {
            listing = null;
        }
        this.listings.set(key, listing);
        return listing ?? undefined;
    }

    /**
     * Forget what is cached about `changed` (a file or directory created or deleted): its
     * own listing, the listings below it, and the listings of every directory above it (a
     * new file may come with new directories).
     */
    public invalidate(changed: string): void {
        const target = path.resolve(changed);
        const below = target.endsWith(path.sep) ? target : target + path.sep;
        for (const key of [...this.listings.keys()]) {
            if (key === target || key.startsWith(below)) {
                this.listings.delete(key);
            }
        }
        let dir = path.dirname(target);
        for (;;) {
            this.listings.delete(dir);
            const parent = path.dirname(dir);
            if (parent === dir) {
                break;
            }
            dir = parent;
        }
    }

    public clear(): void {
        this.listings.clear();
    }

    /** Directories currently cached. */
    public get size(): number {
        return this.listings.size;
    }
}

const sharedCache = new DirectoryCache();

/** The file `segments` names below `dir`, matched case-insensitively segment by segment. */
function findBelow(
    cache: DirectoryCache,
    dir: string,
    segments: readonly string[],
    at: number
): string | undefined {
    const listing = cache.list(dir);
    if (!listing) {
        return undefined;
    }
    const last = at === segments.length - 1;
    for (const entry of listing.get(segments[at].toLowerCase()) ?? []) {
        const full = path.join(dir, entry.name);
        if (last) {
            if (!entry.directory) {
                return full;
            }
        } else if (entry.directory) {
            const found = findBelow(cache, full, segments, at + 1);
            if (found) {
                return found;
            }
        }
    }
    return undefined;
}

/**
 * The file a graphics path names in the first of `roots` that has it (case-insensitively),
 * or undefined when none does.
 */
export function resolveGraphicsPath(
    graphicsPath: string,
    roots: readonly string[],
    cache: DirectoryCache = sharedCache
): string | undefined {
    const segments = graphicsPath.replace(/\\/g, '/').split('/');
    for (const root of roots) {
        const found = findBelow(cache, root, segments, 0);
        if (found) {
            return found;
        }
    }
    return undefined;
}

/** Where graphics paths are looked up, and whether a miss is a proven miss. */
export interface GraphicsResolver {
    /** The content roots searched, in order. */
    readonly roots: readonly string[];
    /** True when the base game's roots are among them. */
    readonly baseGameKnown: boolean;
    /** The file a path names, or undefined. */
    resolve(graphicsPath: string): string | undefined;
}

/**
 * The base game's content roots: `game/`, then every `game/dlc/<dlc>/` folder (sorted).
 */
export function baseGameRoots(gameRoot: string, cache: DirectoryCache = sharedCache): string[] {
    const roots = [gameRoot];
    for (const dlcDir of cache.list(gameRoot)?.get('dlc') ?? []) {
        if (!dlcDir.directory) {
            continue;
        }
        const dlcRoot = path.join(gameRoot, dlcDir.name);
        const dlcs: string[] = [];
        for (const entries of cache.list(dlcRoot)?.values() ?? []) {
            for (const entry of entries) {
                if (entry.directory) {
                    dlcs.push(entry.name);
                }
            }
        }
        dlcs.sort();
        roots.push(...dlcs.map((name) => path.join(dlcRoot, name)));
    }
    return roots;
}

/**
 * A resolver over the workspace's mod roots and, when known, the base game (`gameRoot` is
 * the `game` directory, the one holding `common/`).
 */
export function createGraphicsResolver(
    modRoots: readonly string[],
    gameRoot: string | undefined,
    cache: DirectoryCache = sharedCache
): GraphicsResolver {
    const roots = [...modRoots, ...(gameRoot ? baseGameRoots(gameRoot, cache) : [])];
    return {
        roots,
        baseGameKnown: gameRoot !== undefined,
        resolve: (graphicsPath) => resolveGraphicsPath(graphicsPath, roots, cache),
    };
}

/**
 * GFX001 for each distinct graphics path the file references that no root has: one
 * diagnostic per path (compared case-insensitively), on the value of its first reference.
 * Nothing is reported while the base game is unknown.
 */
export function validateGraphics(ast: ASTNode, resolver: GraphicsResolver): Diagnostic[] {
    if (!resolver.baseGameKnown) {
        return [];
    }
    const diagnostics: Diagnostic[] = [];
    const seen = new Set<string>();
    const visit = (node: ASTNode): void => {
        if (node.key !== undefined && GRAPHICS_KEYS.has(node.key)) {
            const graphicsPath = extractGraphicsPath(node.value);
            if (graphicsPath !== undefined) {
                const id = graphicsPath.toLowerCase();
                if (!seen.has(id)) {
                    seen.add(id);
                    if (resolver.resolve(graphicsPath) === undefined) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: node.valueRange ?? node.range,
                            message: `Graphics file not found: "${String(node.value)}"`,
                            code: 'GFX001',
                            source: 'ck3-graphics',
                        });
                    }
                }
            }
        }
        for (const child of node.children ?? []) {
            visit(child);
        }
    };
    visit(ast);
    return diagnostics;
}
