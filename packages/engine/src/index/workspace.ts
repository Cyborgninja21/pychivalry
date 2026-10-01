/**
 * The workspace: mod roots, their descriptors, the file list, one parse cache and one
 * index, plus an optional vanilla game tree used as the base game for scripted-name
 * lookups.
 *
 * The folder/descriptor/file-discovery part is ported from the extension's
 * core/workspace.ts (WorkspaceManager, exported here under that name too) without the
 * language-server protocol dependency: a workspace folder is `{ uri, name }`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { defaultSpec, Spec } from '../spec/spec';
import { ParsedDocument } from '../syntax/ast';
import { CK3Parser } from '../syntax/parser';
import { Indexer } from './indexer';
import { SymbolType } from './symbols';

export interface WorkspaceFolder {
    uri: string;
    name: string;
}

export interface ModDescriptor {
    name: string;
    version: string;
    path: string;
    supportedVersion?: string;
    tags?: string[];
}

export interface WorkspaceOptions {
    /** Spec package; the bundled one when omitted. */
    spec?: Spec;
    /** A vanilla game directory (the one holding common/, events/ ...) used as the base game. */
    vanilla?: string;
    /** Receives non-fatal problems (unreadable folders, bad descriptors). */
    log?: (message: string) => void;
}

/** Vanilla directories whose definitions a mod can call by name. */
const VANILLA_INDEXED_DIRS = [
    'common/scripted_effects',
    'common/scripted_triggers',
    'common/scripted_lists',
    'common/scripted_modifiers',
    'common/script_values',
    'common/modifier_definition_formats',
    'common/on_action',
];

const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', '.git', '.vscode']);

/** file:// URI → path; anything else is returned unchanged. */
export function uriToPath(uri: string): string {
    return uri.startsWith('file://') ? fileURLToPath(uri) : uri;
}

export function pathToUri(file: string): string {
    return pathToFileURL(path.resolve(file)).href;
}

function isCK3File(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.txt' || ext === '.gui' || ext === '.gfx' || ext === '.asset') {
        return true;
    }
    const locPattern =
        /_l_(english|german|french|spanish|russian|korean|simp_chinese|braz_por|polish|japanese)/;
    return locPattern.test(path.basename(filename).toLowerCase());
}

function walkFiles(dir: string, accept: (name: string) => boolean, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIPPED_DIRS.has(entry.name)) {
                walkFiles(full, accept, out);
            }
        } else if (entry.isFile() && accept(entry.name)) {
            out.push(full);
        }
    }
}

function extractQuotedValue(line: string): string {
    const match = line.match(/"([^"]*)"/);
    return match ? match[1] : '';
}

function extractListValue(line: string): string[] {
    const match = line.match(/{([^}]*)}/);
    if (!match) {
        return [];
    }
    return match[1]
        .split(/\s+/)
        .map((s) => s.replace(/"/g, '').trim())
        .filter((s) => s.length > 0);
}

/** Parse a descriptor.mod file (same rules as the extension's WorkspaceManager). */
export function parseModDescriptor(filePath: string): ModDescriptor {
    const content = fs.readFileSync(filePath, 'utf-8');
    const descriptor: ModDescriptor = { name: '', version: '', path: path.dirname(filePath) };
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('name')) {
            descriptor.name = extractQuotedValue(trimmed);
        } else if (trimmed.startsWith('version')) {
            descriptor.version = extractQuotedValue(trimmed);
        } else if (trimmed.startsWith('supported_version')) {
            descriptor.supportedVersion = extractQuotedValue(trimmed);
        } else if (trimmed.startsWith('tags')) {
            descriptor.tags = extractListValue(trimmed);
        }
    }
    return descriptor;
}

export class Workspace {
    public readonly spec: Spec;
    /** Index of the workspace's own files. */
    public readonly index: Indexer = new Indexer();
    /** Index of the vanilla base game's callable definitions (empty without --vanilla). */
    public readonly vanillaIndex: Indexer = new Indexer();
    public readonly vanillaRoot: string | undefined;

    private readonly workspaceFolders = new Map<string, WorkspaceFolder>();
    private readonly modDescriptors = new Map<string, ModDescriptor>();
    private readonly parseCache = new Map<string, { text: string; result: ParsedDocument }>();
    private readonly log: (message: string) => void;

    constructor(root?: string, options: WorkspaceOptions = {}) {
        this.spec = options.spec ?? defaultSpec();
        this.vanillaRoot = options.vanilla ? path.resolve(options.vanilla) : undefined;
        this.log = options.log ?? (() => undefined);
        if (root !== undefined) {
            const resolved = path.resolve(root);
            this.addFolderSync({ uri: pathToUri(resolved), name: path.basename(resolved) });
        }
    }

    // ── WorkspaceManager API (core/workspace.ts) ────────────────────────

    public async addWorkspaceFolder(folder: WorkspaceFolder): Promise<void> {
        this.addFolderSync(folder);
    }

    public removeWorkspaceFolder(uri: string): void {
        this.workspaceFolders.delete(uri);
        this.modDescriptors.delete(uri);
    }

    public getWorkspaceFolders(): WorkspaceFolder[] {
        return Array.from(this.workspaceFolders.values());
    }

    public getModDescriptor(uri: string): ModDescriptor | undefined {
        return this.modDescriptors.get(uri);
    }

    public async findCK3Files(folder: WorkspaceFolder): Promise<string[]> {
        const files: string[] = [];
        walkFiles(uriToPath(folder.uri), isCK3File, files);
        return files;
    }

    private addFolderSync(folder: WorkspaceFolder): void {
        this.workspaceFolders.set(folder.uri, folder);
        const descriptorPath = path.join(uriToPath(folder.uri), 'descriptor.mod');
        if (fs.existsSync(descriptorPath)) {
            try {
                this.modDescriptors.set(folder.uri, parseModDescriptor(descriptorPath));
            } catch (error) {
                this.log(`Failed to parse mod descriptor ${descriptorPath}: ${String(error)}`);
            }
        }
    }

    // ── engine API ───────────────────────────────────────────────────────

    /** Root directories of the workspace folders. */
    public roots(): string[] {
        return this.getWorkspaceFolders().map((f) => uriToPath(f.uri));
    }

    /** Every script (.txt) file under the workspace roots, sorted. */
    public scriptFiles(): string[] {
        const files: string[] = [];
        for (const root of this.roots()) {
            walkFiles(root, (name) => name.toLowerCase().endsWith('.txt'), files);
        }
        return files;
    }

    /** Path of `file` relative to the workspace root that contains it, with '/' separators. */
    public relativePath(file: string): string {
        const absolute = path.resolve(file);
        let best: string | undefined;
        for (const root of this.roots()) {
            const rel = path.relative(root, absolute);
            if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                if (best === undefined || rel.length < best.length) {
                    best = rel;
                }
            }
        }
        return (best ?? absolute).split(path.sep).join('/');
    }

    /** Parse a file (text read from disk when not given); cached per file and text. */
    public parse(file: string, text?: string): ParsedDocument {
        const absolute = path.resolve(file);
        const content = text ?? fs.readFileSync(absolute, 'utf-8');
        const cached = this.parseCache.get(absolute);
        if (cached && cached.text === content) {
            return cached.result;
        }
        const parser = new CK3Parser({ spec: this.spec, file: this.relativePath(absolute) });
        const result = parser.parse(content);
        this.parseCache.set(absolute, { text: content, result });
        return result;
    }

    /** Index one file of the workspace (after an edit, say). */
    public indexFile(file: string, text?: string): void {
        this.index.indexSync(pathToUri(file), this.parse(file, text).ast);
    }

    /** Index every script file of the workspace, and the vanilla definitions when given. */
    public load(): this {
        for (const file of this.scriptFiles()) {
            this.indexFile(file);
        }
        if (this.vanillaRoot) {
            this.loadVanilla(this.vanillaRoot);
        }
        return this;
    }

    private loadVanilla(root: string): void {
        for (const dir of VANILLA_INDEXED_DIRS) {
            const files: string[] = [];
            walkFiles(path.join(root, ...dir.split('/')), (n) => n.endsWith('.txt'), files);
            for (const file of files) {
                const parser = new CK3Parser({ spec: this.spec, file });
                const parsed = parser.parse(fs.readFileSync(file, 'utf-8'));
                this.vanillaIndex.indexSync(pathToUri(file), parsed.ast);
            }
        }
    }

    /** Is `name` defined with one of `types` in the workspace or the vanilla base game? */
    public isDefined(name: string, ...types: SymbolType[]): boolean {
        return this.index.hasSymbol(name, ...types) || this.vanillaIndex.hasSymbol(name, ...types);
    }
}

export { Workspace as WorkspaceManager };
