/**
 * Helpers for the language server's tests: a protocol client that speaks to the server, no
 * editor involved. The server runs as its own process over standard input and output
 * (`spawnServer`, the transport a test can use without an editor), or in this process over a
 * pair of streams (`serverInProcess`), where a test can give it its own Steam search. The
 * client answers the server's requests as an editor would (its settings, progress tokens,
 * registrations) and records what the server sends: diagnostics, messages, progress, the end
 * of each background pass. No test reads the real game, and no test writes outside its
 * temporary folder: the server's cache folder is always one of the test's own. Not part of the
 * package's surface.
 */

import { openSpec, type Spec } from '@pychivalry/core';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    createProtocolConnection,
    StreamMessageReader,
    StreamMessageWriter,
    type CompletionList,
    type Diagnostic,
    type DocumentSymbol,
    type Hover,
    type Location,
    type ProtocolConnection,
    type ShowMessageParams,
    type TextDocumentContentChangeEvent,
} from 'vscode-languageserver-protocol/node';
import { createConnection } from 'vscode-languageserver/node';
import { defaultSpecDir } from './args.js';
import { pathToUri } from './paths.js';
import {
    BACKGROUND_DONE,
    FINDINGS_REQUEST,
    startServer,
    type BackgroundDone,
    type FindingsResult,
    type LanguageServer,
} from './server.js';

/** The repository root: compiled tests live in `packages/lsp/dist/`. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));

/** The server's entry point, compiled. */
export const MAIN = fileURLToPath(new URL('./main.js', import.meta.url));

export const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');
export const GAMES = path.join(REPO_ROOT, 'fixtures', 'game');

let committed: Spec | null = null;

/** The committed spec package, read once. */
export function committedSpec(): Spec {
    committed ??= openSpec(defaultSpecDir());
    return committed;
}

/** A temporary folder, removed when the test ends. */
export function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-lsp-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

export function write(file: string, text: string | Uint8Array): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** A copy of a fixture mod in a temporary folder, which a test may change. */
export function modCopy(t: TestContext, mod: string): string {
    const dir = path.join(scratch(t), mod);
    cpSync(path.join(MODS, mod), dir, { recursive: true });
    return dir;
}

/**
 * A file's text as an editor holds it: decoded as UTF-8, without the byte-order mark, which an
 * editor keeps as the document's encoding, not as its text (the fixtures are in pychivalry's
 * format, so they start with it).
 */
export function readDocument(file: string): string {
    return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

/**
 * A game install at `root`: its launcher settings stating the build and its game folder with
 * the given files (and `common/`). Returns the game folder.
 */
export function gameStub(
    root: string,
    files: Readonly<Record<string, string>> = {},
    build = '1.21.0.3',
): string {
    write(
        path.join(root, 'launcher', 'launcher-settings.json'),
        `${JSON.stringify({ gameId: 'ck3', rawVersion: build, dlcPath: '../game' })}\n`,
    );
    const game = path.join(root, 'game');
    mkdirSync(path.join(game, 'common'), { recursive: true });
    for (const [rel, text] of Object.entries(files)) {
        write(path.join(game, ...rel.split('/')), text);
    }
    return game;
}

export function uriOf(file: string): string {
    return pathToUri(file);
}

/** How long a test waits for the server before it fails. */
const WAIT_MS = 60_000;

/** The settings a test gives the server, as the `pychivalry` section of an editor's settings. */
export type TestSettings = Record<string, unknown>;

/** A protocol client connected to a language server. */
export class TestClient {
    readonly connection: ProtocolConnection;
    readonly diagnostics = new Map<string, { version?: number; diagnostics: Diagnostic[] }>();
    /** How many times diagnostics were published for each URI. */
    readonly published = new Map<string, number>();
    readonly messages: ShowMessageParams[] = [];
    readonly done: BackgroundDone[] = [];
    readonly progress: unknown[] = [];
    readonly registrations: string[] = [];
    settings: TestSettings;
    private readonly waiters: (() => void)[] = [];
    private versions = new Map<string, number>();

    constructor(connection: ProtocolConnection, settings: TestSettings) {
        this.connection = connection;
        this.settings = settings;
        connection.onNotification(
            'textDocument/publishDiagnostics',
            (params: { uri: string; version?: number; diagnostics: Diagnostic[] }) => {
                this.diagnostics.set(params.uri, params);
                this.published.set(params.uri, (this.published.get(params.uri) ?? 0) + 1);
                this.wake();
            },
        );
        connection.onNotification('window/showMessage', (params: ShowMessageParams) => {
            this.messages.push(params);
            this.wake();
        });
        connection.onNotification('window/logMessage', () => undefined);
        connection.onNotification(BACKGROUND_DONE, (params: BackgroundDone) => {
            this.done.push(params);
            this.wake();
        });
        connection.onNotification('$/progress', (params: { value: unknown }) => {
            this.progress.push(params.value);
        });
        connection.onRequest(
            'workspace/configuration',
            (params: { items: { section?: string }[] }) => params.items.map(() => this.settings),
        );
        connection.onRequest('window/workDoneProgress/create', () => null);
        connection.onRequest(
            'client/registerCapability',
            (params: { registrations: { method: string }[] }) => {
                this.registrations.push(...params.registrations.map((r) => r.method));
                return null;
            },
        );
        connection.listen();
    }

    private wake(): void {
        for (const waiter of this.waiters.splice(0)) {
            waiter();
        }
    }

    /** Wait until `ready` holds, checked after each message from the server. */
    async until(ready: () => boolean, what: string): Promise<void> {
        const started = Date.now();
        while (!ready()) {
            if (Date.now() - started > WAIT_MS) {
                throw new Error(`timed out waiting for ${what}`);
            }
            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, 200);
                this.waiters.push(() => {
                    clearTimeout(timer);
                    resolve();
                });
            });
        }
    }

    /** Start the session: `initialize` with the folders, then `initialized`. */
    async start(folders: readonly string[]): Promise<Record<string, unknown>> {
        const result = await this.connection.sendRequest('initialize', {
            processId: null,
            rootUri: folders[0] === undefined ? null : uriOf(folders[0]),
            workspaceFolders: folders.map((f) => ({ uri: uriOf(f), name: path.basename(f) })),
            capabilities: {
                workspace: {
                    configuration: true,
                    didChangeConfiguration: { dynamicRegistration: true },
                    didChangeWatchedFiles: { dynamicRegistration: true },
                    workspaceFolders: true,
                },
                window: { workDoneProgress: true },
                textDocument: {
                    publishDiagnostics: { versionSupport: true },
                    completion: { completionItem: { snippetSupport: false } },
                    hover: { contentFormat: ['markdown', 'plaintext'] },
                    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                },
            },
        });
        await this.connection.sendNotification('initialized', {});
        return result as Record<string, unknown>;
    }

    /** Wait for the end of a background pass that leaves nothing to check. */
    async settled(after = this.done.length): Promise<BackgroundDone> {
        await this.until(
            () => this.done.slice(after).some((d) => d.complete),
            'the background check to finish',
        );
        const last = this.done
            .slice(after)
            .filter((d) => d.complete)
            .at(-1);
        if (last === undefined) {
            throw new Error('no complete pass');
        }
        return last;
    }

    /** Open a file in the editor, under its URI or the one given (an editor's own spelling). */
    async open(file: string, text: string, language = 'ck3', given?: string): Promise<string> {
        const uri = given ?? uriOf(file);
        this.versions.set(uri, 1);
        await this.connection.sendNotification('textDocument/didOpen', {
            textDocument: { uri, languageId: language, version: 1, text },
        });
        return uri;
    }

    async change(uri: string, changes: TextDocumentContentChangeEvent[]): Promise<number> {
        const version = (this.versions.get(uri) ?? 1) + 1;
        this.versions.set(uri, version);
        await this.connection.sendNotification('textDocument/didChange', {
            textDocument: { uri, version },
            contentChanges: changes,
        });
        return version;
    }

    async close(uri: string): Promise<void> {
        await this.connection.sendNotification('textDocument/didClose', { textDocument: { uri } });
    }

    async filesChanged(changes: { uri: string; type: 1 | 2 | 3 }[]): Promise<void> {
        await this.connection.sendNotification('workspace/didChangeWatchedFiles', { changes });
    }

    async configure(settings: TestSettings): Promise<void> {
        this.settings = settings;
        await this.connection.sendNotification('workspace/didChangeConfiguration', {
            settings: { pychivalry: settings },
        });
    }

    async folders(added: readonly string[], removed: readonly string[]): Promise<void> {
        await this.connection.sendNotification('workspace/didChangeWorkspaceFolders', {
            event: {
                added: added.map((f) => ({ uri: uriOf(f), name: path.basename(f) })),
                removed: removed.map((f) => ({ uri: uriOf(f), name: path.basename(f) })),
            },
        });
    }

    /** Wait until the diagnostics of `uri` satisfy `ready`. */
    async diagnosticsOf(
        uri: string,
        ready: (d: Diagnostic[]) => boolean = () => true,
    ): Promise<Diagnostic[]> {
        await this.until(() => {
            const d = this.diagnostics.get(uri);
            return d !== undefined && ready(d.diagnostics);
        }, `diagnostics of ${uri}`);
        return this.diagnostics.get(uri)?.diagnostics ?? [];
    }

    async findings(uri: string): Promise<FindingsResult> {
        return this.connection.sendRequest(FINDINGS_REQUEST, { uri });
    }

    async hover(uri: string, line: number, character: number): Promise<Hover | null> {
        return this.connection.sendRequest('textDocument/hover', {
            textDocument: { uri },
            position: { line, character },
        });
    }

    async definition(uri: string, line: number, character: number): Promise<Location[] | null> {
        return this.connection.sendRequest('textDocument/definition', {
            textDocument: { uri },
            position: { line, character },
        });
    }

    async references(
        uri: string,
        line: number,
        character: number,
        includeDeclaration = false,
    ): Promise<Location[] | null> {
        return this.connection.sendRequest('textDocument/references', {
            textDocument: { uri },
            position: { line, character },
            context: { includeDeclaration },
        });
    }

    async symbols(uri: string): Promise<DocumentSymbol[] | null> {
        return this.connection.sendRequest('textDocument/documentSymbol', {
            textDocument: { uri },
        });
    }

    async completion(uri: string, line: number, character: number): Promise<CompletionList | null> {
        return this.connection.sendRequest('textDocument/completion', {
            textDocument: { uri },
            position: { line, character },
        });
    }

    async shutdown(): Promise<void> {
        await this.connection.sendRequest('shutdown');
    }
}

/** The environment of a spawned server: its cache folder is `cache`, on every system. */
function serverEnv(cache: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const name of ['PATH', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']) {
        const value = process.env[name];
        if (value !== undefined) {
            env[name] = value;
        }
    }
    return { ...env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache };
}

/**
 * The server started as its own process over standard input and output, with its cache
 * folder in the test's temporary folder, and a client connected to it. Every test of a spawned
 * server names its game in its settings (`gamePath`), so no test looks for the real one.
 */
export function spawnServer(
    t: TestContext,
    settings: TestSettings,
    args: readonly string[] = [],
): { client: TestClient; stderr: () => string } {
    if (typeof settings['gamePath'] !== 'string') {
        throw new Error('a spawned test server must name its game: settings.gamePath');
    }
    const cache = path.join(scratch(t), 'cache');
    const child = spawn(process.execPath, [MAIN, '--stdio', ...args], {
        env: serverEnv(cache),
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
    });
    const connection = createProtocolConnection(
        new StreamMessageReader(child.stdout),
        new StreamMessageWriter(child.stdin),
    );
    const client = new TestClient(connection, settings);
    t.after(async () => {
        try {
            await Promise.race([
                client.shutdown(),
                new Promise((resolve) => setTimeout(resolve, 2000)),
            ]);
            await connection.sendNotification('exit');
        } catch {
            // The server is gone already.
        }
        connection.dispose();
        child.kill();
    });
    return { client, stderr: () => stderr };
}

/**
 * The server in this process over a pair of streams, with its own Steam search (`findGame`)
 * and cache folder, and a client connected to it.
 */
export function serverInProcess(
    t: TestContext,
    settings: TestSettings,
    options: {
        readonly findGame?: (gameId: string) => string | null;
        readonly spec?: Spec;
        /** The cache folder; a temporary one by default. */
        readonly cache?: string;
        /** Lend the base game to programs whose cache folder is the same (docs/shared-index.md). */
        readonly lend?: boolean;
        readonly env?: Readonly<Record<string, string>>;
    } = {},
): { client: TestClient; server: LanguageServer } {
    const toServer = new PassThrough();
    const toClient = new PassThrough();
    const serverConnection = createConnection(
        new StreamMessageReader(toServer),
        new StreamMessageWriter(toClient),
    );
    const cache = options.cache ?? path.join(scratch(t), 'cache');
    const server = startServer(serverConnection, {
        spec: options.spec ?? committedSpec(),
        cacheDir: path.join(cache, 'pychivalry', 'index'),
        findGame: options.findGame ?? (() => null),
        editDelay: 20,
        diskDelay: 20,
        place:
            options.lend === true
                ? {
                      env: { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache, ...options.env },
                      platform: process.platform,
                      home: cache,
                  }
                : undefined,
        lendClaimMs: 100,
    });
    const connection = createProtocolConnection(
        new StreamMessageReader(toClient),
        new StreamMessageWriter(toServer),
    );
    const client = new TestClient(connection, settings);
    t.after(async () => {
        try {
            await client.shutdown();
        } catch {
            // Already closed.
        }
        connection.dispose();
        serverConnection.dispose();
        toServer.end();
        toClient.end();
    });
    return { client, server };
}
