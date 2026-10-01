/**
 * Crusader Kings 3 Language Server — wiring.
 *
 * The server owns the LSP connection and the shared state; every request is handed to a
 * provider (lsp/*), every provider reads the engine (pychivalry-engine: spec package,
 * parser, workspace index, diagnostics pipeline), the extension's plug-ins are registered
 * in plugins.ts, and the ck3.* commands live in commands.ts and log/controller.ts.
 */

import {
    CallHierarchyIncomingCallsParams,
    CallHierarchyOutgoingCallsParams,
    CallHierarchyPrepareParams,
    CodeActionParams,
    CodeLens,
    CodeLensParams,
    CompletionItem,
    Connection,
    createConnection,
    DidChangeConfigurationNotification,
    DocumentFormattingParams,
    DocumentLink,
    DocumentRangeFormattingParams,
    ExecuteCommandParams,
    InitializeParams,
    InitializeResult,
    InlayHint,
    InlayHintParams,
    ProposedFeatures,
    ReferenceParams,
    RenameParams,
    SelectionRangeParams,
    SemanticTokensRangeParams,
    TextDocumentPositionParams,
    TextDocuments,
    TextDocumentSyncKind,
    WorkspaceFolder,
    WorkspaceSymbolParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { IncrementalParser, LocalizationIndex, setDefaultSpec, Workspace } from 'pychivalry-engine';

import { bundledSpec } from './engine-host';
import { enginePlugins, localizationDiagnostics } from './plugins';
import { ServerCommands, SERVER_COMMANDS } from './commands';
import { LogWatcherController } from './log/controller';
import { DataLoader } from './data/loader';
import { ModScanner } from './data/mod-scanner';
import { loadExtractedTraits } from './data/traits';
import { serverLogger } from './utils/logger';

import { CompletionProvider } from './lsp/completions';
import { HoverProvider } from './lsp/hover';
import { DefinitionProvider } from './lsp/navigation';
import { DocumentSymbolProvider } from './lsp/symbols';
import { DiagnosticsProvider } from './lsp/diagnostics';
import { FormattingProvider } from './lsp/formatting';
import { FoldingRangeProvider } from './lsp/folding';
import { RenameProvider } from './lsp/rename';
import { SemanticTokensProvider } from './lsp/semantic-tokens';
import { CodeActionsProvider } from './lsp/code-actions';
import { CodeLensProvider } from './lsp/code-lens';
import { DocumentLinksProvider } from './lsp/document-links';
import { DocumentHighlightProvider } from './lsp/document-highlight';
import { InlayHintsProvider } from './lsp/inlay-hints';
import { SignatureHelpProvider } from './lsp/signature-help';
import { CallHierarchyProvider } from './lsp/call-hierarchy';
import { SelectionRangeProvider } from './lsp/selection-range';

/** Server settings pulled from the client (ck3LanguageServer.*). */
export interface ServerConfig {
    logLevel: 'debug' | 'info' | 'warning' | 'error';
    formatting: { enabled: boolean; insertSpaces: boolean; tabSize: number };
    inlayHints: {
        enabled: boolean;
        showScopeTypes: boolean;
        showChainTypes: boolean;
        showIteratorTypes: boolean;
        maxHintsPerLine: number;
    };
    logWatcher: {
        enabled: boolean;
        autoStart: boolean;
        logPath: string;
        showInOutput: boolean;
        maxLogSize: number;
        debounceDelay: number;
    };
}

const DEFAULT_CONFIG: ServerConfig = {
    logLevel: 'info',
    formatting: { enabled: true, insertSpaces: false, tabSize: 4 },
    inlayHints: {
        enabled: true,
        showScopeTypes: true,
        showChainTypes: true,
        showIteratorTypes: true,
        maxHintsPerLine: 3,
    },
    logWatcher: {
        enabled: true,
        autoStart: false,
        logPath: '',
        showInOutput: true,
        maxLogSize: 100,
        debounceDelay: 500,
    },
};

/** Merge a client settings section over the current one (unset keys keep their value). */
function merge<T extends object>(current: T, update: unknown): T {
    return update && typeof update === 'object'
        ? { ...current, ...(update as Partial<T>) }
        : current;
}

export class CK3LanguageServer {
    private connection: Connection = createConnection(ProposedFeatures.all);
    private documents = new TextDocuments(TextDocument);
    private workspaceFolders: WorkspaceFolder[] = [];
    private hasConfigurationCapability = false;
    private hasWorkspaceFolderCapability = false;
    private config: ServerConfig = DEFAULT_CONFIG;
    private validationTimers = new Map<string, NodeJS.Timeout>();
    private readonly VALIDATION_DEBOUNCE_MS = 300;

    // Engine state shared by every provider
    private parser = new IncrementalParser(5, { spec: bundledSpec() });
    private workspace = new Workspace(undefined, { spec: bundledSpec() });
    private localization = new LocalizationIndex();
    private modScanner = new ModScanner();
    private extractedTraits = loadExtractedTraits();
    private currentSpec = () => this.workspace.spec;

    // Providers
    private completion = new CompletionProvider(this.parser, this.workspace);
    private hover = new HoverProvider(this.parser, this.workspace, this.localization);
    private definition = new DefinitionProvider(
        this.parser,
        this.workspace.index,
        this.localization,
        this.currentSpec
    );
    private symbols = new DocumentSymbolProvider(
        this.parser,
        this.workspace.index,
        this.currentSpec
    );
    private diagnostics = new DiagnosticsProvider(
        this.workspace,
        enginePlugins({
            localization: this.localization,
            extractedTraits: () => this.knownTraits(),
        }),
        this.localization,
        localizationDiagnostics
    );
    private formatting = new FormattingProvider(this.parser);
    private folding = new FoldingRangeProvider(this.parser);
    private rename = new RenameProvider(this.parser, this.workspace.index);
    private semanticTokens = new SemanticTokensProvider(this.parser, this.workspace);
    private codeActions = new CodeActionsProvider(this.parser, this.currentSpec);
    private codeLens = new CodeLensProvider(this.parser, this.workspace.index, this.localization);
    private documentLinks = new DocumentLinksProvider(this.parser, this.workspace.index);
    private documentHighlight = new DocumentHighlightProvider(this.parser);
    private inlayHints = new InlayHintsProvider(this.parser, this.workspace);
    private signatureHelp = new SignatureHelpProvider(this.currentSpec);
    private callHierarchy = new CallHierarchyProvider(this.parser, this.workspace.index);
    private selectionRange = new SelectionRangeProvider(this.parser);

    private log = new LogWatcherController(
        this.connection,
        () => this.workspaceFolders.map((f) => f.uri.replace('file://', '')),
        () => this.config.logWatcher
    );
    private commands = new ServerCommands({
        connection: this.connection,
        documents: this.documents,
        workspace: this.workspace,
        localization: this.localization,
        parser: this.parser,
        workspaceFolders: () => this.workspaceFolders,
        diagnose: (document) => this.diagnostics.provideDiagnostics(document),
        publish: (document) => this.validateDocument(document),
        log: this.log,
    });

    constructor() {
        serverLogger.setConnection(this.connection);
        this.registerHandlers();
    }

    public listen(): void {
        this.connection.listen();
    }

    /** Run a provider for an open document; errors are logged and yield the fallback. */
    private withDocument<T>(
        uri: string,
        name: string,
        fallback: T,
        run: (document: TextDocument) => T | Promise<T>
    ): Promise<T> {
        const document = this.documents.get(uri);
        if (!document) {
            return Promise.resolve(fallback);
        }
        return Promise.resolve()
            .then(() => run(document))
            .catch((error) => {
                this.connection.console.error(`${name} error: ${error}`);
                return fallback;
            });
    }

    /** Run a document-less handler; errors are logged and yield the fallback. */
    private guarded<T>(name: string, fallback: T, run: () => T | Promise<T>): Promise<T> {
        return Promise.resolve()
            .then(run)
            .catch((error) => {
                this.connection.console.error(`${name} error: ${error}`);
                return fallback;
            });
    }

    private registerHandlers(): void {
        const c = this.connection;
        const doc = <T>(
            uri: string,
            name: string,
            fallback: T,
            run: (d: TextDocument) => T | Promise<T>
        ) => this.withDocument(uri, name, fallback, run);

        c.onInitialize((params) => this.onInitialize(params));
        c.onInitialized(() => this.onInitialized());
        c.onShutdown(() => this.onShutdown());

        this.documents.onDidOpen((e) => this.onDidOpen(e.document));
        this.documents.onDidChangeContent((e) => this.onDidChange(e.document));
        this.documents.onDidClose((e) => this.onDidClose(e.document));
        this.documents.onDidSave((e) => this.validateDocument(e.document));
        c.onDidChangeConfiguration(() => this.onDidChangeConfiguration());

        c.onCompletion((p: TextDocumentPositionParams) =>
            doc(p.textDocument.uri, 'Completion', [] as CompletionItem[], (d) =>
                this.completion.provideCompletions(d, p.position)
            )
        );
        c.onCompletionResolve((item) =>
            this.guarded('Completion resolve', item, () => this.completion.resolveCompletion(item))
        );
        c.onHover((p) =>
            doc(p.textDocument.uri, 'Hover', null, (d) => this.hover.provideHover(d, p.position))
        );
        c.onDefinition((p) =>
            doc(p.textDocument.uri, 'Definition', null, (d) =>
                this.definition.navigateToDefinition(d, p.position)
            )
        );
        c.onTypeDefinition((p) =>
            doc(p.textDocument.uri, 'Type definition', null, (d) =>
                this.definition.navigateToTypeDefinition(d, p.position)
            )
        );
        c.onImplementation((p) =>
            doc(p.textDocument.uri, 'Implementation', null, (d) =>
                this.definition.findImplementation(d, p.position)
            )
        );
        c.onDeclaration((p) =>
            doc(p.textDocument.uri, 'Declaration', null, (d) =>
                this.definition.navigateToDeclaration(d, p.position)
            )
        );
        c.onReferences((p: ReferenceParams) =>
            doc(p.textDocument.uri, 'References', [], (d) =>
                this.definition.findAllReferences(d, p.position, p.context.includeDeclaration)
            )
        );
        c.onDocumentSymbol((p) =>
            doc(p.textDocument.uri, 'Document symbol', [], (d) =>
                this.symbols.buildDocumentOutline(d)
            )
        );
        c.onWorkspaceSymbol((p: WorkspaceSymbolParams) =>
            this.guarded('Workspace symbol', [], () => this.symbols.searchWorkspaceSymbols(p.query))
        );
        c.onDocumentFormatting((p: DocumentFormattingParams) =>
            doc(p.textDocument.uri, 'Formatting', [], (d) =>
                this.formatting.formatDocument(d, p.options)
            )
        );
        c.onDocumentRangeFormatting((p: DocumentRangeFormattingParams) =>
            doc(p.textDocument.uri, 'Range formatting', [], (d) =>
                this.formatting.formatRange(d, p.range, p.options)
            )
        );
        c.onFoldingRanges((p) =>
            doc(p.textDocument.uri, 'Folding ranges', [], (d) =>
                this.folding.provideFoldingRanges(d)
            )
        );
        c.onSelectionRanges((p: SelectionRangeParams) =>
            doc(p.textDocument.uri, 'Selection ranges', [], (d) =>
                this.selectionRange.provideSelectionRanges(d, p.positions)
            )
        );
        c.onPrepareRename((p) =>
            doc(p.textDocument.uri, 'Prepare rename', null, (d) =>
                this.rename.prepareRename(d, p.position)
            )
        );
        c.onRenameRequest((p: RenameParams) =>
            doc(p.textDocument.uri, 'Rename', null, (d) =>
                this.rename.provideRename(d, p.position, p.newName)
            )
        );
        c.onDocumentHighlight((p) =>
            doc(p.textDocument.uri, 'Document highlight', [], (d) =>
                this.documentHighlight.provideDocumentHighlights(d, p.position)
            )
        );
        c.languages.semanticTokens.on((p) =>
            doc(p.textDocument.uri, 'Semantic tokens', { data: [] as number[] }, (d) =>
                this.semanticTokens.generateSemanticTokens(d)
            )
        );
        c.languages.semanticTokens.onRange((p: SemanticTokensRangeParams) =>
            doc(p.textDocument.uri, 'Semantic tokens range', { data: [] as number[] }, (d) =>
                this.semanticTokens.generateRangeSemanticTokens(d, p.range)
            )
        );
        c.onCodeAction((p: CodeActionParams) =>
            doc(p.textDocument.uri, 'Code action', [], (d) =>
                this.codeActions.provideCodeActions(d, p.range, p.context.diagnostics)
            )
        );
        c.onCodeLens((p: CodeLensParams) =>
            doc(p.textDocument.uri, 'Code lens', [] as CodeLens[], (d) =>
                this.codeLens.provideCodeLens(d)
            )
        );
        c.onCodeLensResolve((lens) =>
            this.guarded('Code lens resolve', lens, () => this.codeLens.resolveCodeLens(lens))
        );
        c.onDocumentLinks((p) =>
            doc(p.textDocument.uri, 'Document links', [] as DocumentLink[], (d) =>
                this.documentLinks.provideDocumentLinks(d)
            )
        );
        c.onDocumentLinkResolve((link) =>
            this.guarded('Document link resolve', link, () =>
                this.documentLinks.resolveDocumentLink(link)
            )
        );
        c.languages.inlayHint.on((p: InlayHintParams) =>
            doc(p.textDocument.uri, 'Inlay hint', [] as InlayHint[], (d) =>
                this.inlayHints.provideInlayHints(d, p.range)
            )
        );
        c.languages.inlayHint.resolve((hint) =>
            this.guarded('Inlay hint resolve', hint, () => this.inlayHints.resolveInlayHint(hint))
        );
        c.onSignatureHelp((p) =>
            doc(p.textDocument.uri, 'Signature help', null, (d) =>
                this.signatureHelp.provideSignatureHelp(d, p.position)
            )
        );
        c.languages.callHierarchy.onPrepare((p: CallHierarchyPrepareParams) =>
            doc(p.textDocument.uri, 'Call hierarchy prepare', null, (d) =>
                this.callHierarchy.prepareCallHierarchy(d, p)
            )
        );
        c.languages.callHierarchy.onIncomingCalls((p: CallHierarchyIncomingCallsParams) =>
            this.guarded('Call hierarchy incoming calls', [], () =>
                this.callHierarchy.incomingCalls(p)
            )
        );
        c.languages.callHierarchy.onOutgoingCalls((p: CallHierarchyOutgoingCallsParams) =>
            this.guarded('Call hierarchy outgoing calls', [], () =>
                this.callHierarchy.outgoingCalls(p)
            )
        );

        c.onExecuteCommand((p: ExecuteCommandParams) => {
            c.console.log(`Executing command: ${p.command}`);
            return this.commands.execute(p.command, p.arguments ?? []);
        });

        this.documents.listen(c);
    }

    private onInitialize(params: InitializeParams): InitializeResult {
        const capabilities = params.capabilities;
        this.hasConfigurationCapability = !!capabilities.workspace?.configuration;
        this.hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
        this.workspaceFolders = params.workspaceFolders ?? [];

        return {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.', ':', '=', ' ', '\t', '_'],
                },
                hoverProvider: true,
                definitionProvider: true,
                typeDefinitionProvider: true,
                implementationProvider: true,
                declarationProvider: true,
                referencesProvider: true,
                documentSymbolProvider: true,
                documentFormattingProvider: true,
                documentRangeFormattingProvider: true,
                renameProvider: { prepareProvider: true },
                foldingRangeProvider: true,
                semanticTokensProvider: {
                    legend: SemanticTokensProvider.getTokenLegend(),
                    full: true,
                    range: true,
                },
                codeActionProvider: true,
                codeLensProvider: { resolveProvider: true },
                documentLinkProvider: { resolveProvider: true },
                documentHighlightProvider: true,
                signatureHelpProvider: { triggerCharacters: ['{', '=', ' '] },
                inlayHintProvider: { resolveProvider: true },
                callHierarchyProvider: true,
                selectionRangeProvider: true,
                workspaceSymbolProvider: true,
                executeCommandProvider: { commands: SERVER_COMMANDS },
            },
            serverInfo: { name: 'CK3 Language Server (TypeScript)', version: '1.1.0' },
        };
    }

    private async onInitialized(): Promise<void> {
        if (this.hasConfigurationCapability) {
            this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
        }
        if (this.hasWorkspaceFolderCapability) {
            this.connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
                this.connection.console.log('Workspace folders changed');
                this.workspaceFolders.push(...event.added);
                this.workspaceFolders = this.workspaceFolders.filter(
                    (f) => !event.removed.some((r) => r.uri === f.uri)
                );
                for (const folder of event.added) {
                    await this.workspace.addWorkspaceFolder(folder);
                }
                for (const folder of event.removed) {
                    this.workspace.removeWorkspaceFolder(folder.uri);
                }
                await this.commands.rescanWorkspace();
            });
        }
        await this.initializeWorkspace();
        this.connection.console.log('CK3 Language Server initialized (TypeScript)');
    }

    /** Spec package, game-content data, workspace folders, localization, mod overlays. */
    private async initializeWorkspace(): Promise<void> {
        const notify = (message: string) =>
            this.connection.sendNotification('ck3/indexLog', { message });
        try {
            notify('Initializing workspace...');
            notify(`CK3 spec package ${bundledSpec().version()} loaded`);
            await DataLoader.getInstance().initialize();
            notify('Game data loaded');
            for (const folder of this.workspaceFolders) {
                notify(`Scanning workspace folder: ${folder.name}`);
                await this.workspace.addWorkspaceFolder(folder);
            }
            // Index the workspace so that definitions in unopened files resolve
            const indexed = await this.commands.indexWorkspace();
            notify(`Indexed ${indexed.uris.length} files`);
            await this.commands.scanLocalization();
            try {
                const modCount = await this.modScanner.discoverMods();
                if (modCount > 0) {
                    await this.modScanner.extractAllModData();
                    this.applyModOverlays();
                    notify(
                        `Discovered ${modCount} mod(s): ${this.modScanner.getDiscoveredModNames().join(', ')}`
                    );
                }
            } catch (error) {
                this.connection.console.error(`Mod discovery failed: ${error}`);
            }
            notify('Workspace initialized successfully');
            this.connection.console.log('Workspace initialized successfully');
        } catch (error) {
            this.connection.console.error(`Failed to initialize workspace: ${error}`);
        }
    }

    /**
     * Layer the discovered mods' scripted triggers and effects (data/mods registry) over
     * the spec package; every provider and the diagnostics read the workspace's spec.
     */
    private applyModOverlays(): void {
        const overlays = this.modScanner.toOverlays();
        if (overlays.length > 0) {
            const spec = bundledSpec().withOverlay(...overlays);
            this.workspace.useSpec(spec);
            setDefaultSpec(spec);
            this.hover.clearCache();
        }
    }

    /** Extracted trait data plus the discovered mods' traits (CK3800's known set). */
    private knownTraits(): ReadonlySet<string> | undefined {
        // Without extracted vanilla trait data the check does not run at all.
        if (!this.extractedTraits) {
            return undefined;
        }
        return new Set([...this.extractedTraits, ...this.modScanner.getAllTraits().keys()]);
    }

    private onShutdown(): void {
        this.connection.console.log('CK3 Language Server shutting down');
        this.log.dispose();
        for (const timer of this.validationTimers.values()) {
            clearTimeout(timer);
        }
        this.validationTimers.clear();
        this.parser.clearContentCache();
        for (const document of this.documents.all()) {
            this.workspace.index.removeDocument(document.uri);
            this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
        }
    }

    private index(document: TextDocument): void {
        this.workspace.index.indexSync(document.uri, this.parser.parse(document.getText()).ast);
    }

    private async onDidOpen(document: TextDocument): Promise<void> {
        this.connection.console.log(`Document opened: ${document.uri}`);
        this.index(document);
        await this.validateDocument(document);
    }

    private onDidChange(document: TextDocument): void {
        // Index immediately (completions and hover need it); validate debounced.
        this.index(document);
        const existing = this.validationTimers.get(document.uri);
        if (existing) {
            clearTimeout(existing);
        }
        this.validationTimers.set(
            document.uri,
            setTimeout(async () => {
                this.validationTimers.delete(document.uri);
                const current = this.documents.get(document.uri);
                if (current) {
                    await this.validateDocument(current);
                }
            }, this.VALIDATION_DEBOUNCE_MS)
        );
    }

    private onDidClose(document: TextDocument): void {
        this.connection.console.log(`Document closed: ${document.uri}`);
        const timer = this.validationTimers.get(document.uri);
        if (timer) {
            clearTimeout(timer);
            this.validationTimers.delete(document.uri);
        }
        this.hover.clearCache();
        this.workspace.index.removeDocument(document.uri);
        this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    }

    private async validateDocument(document: TextDocument): Promise<void> {
        try {
            const diagnostics = await this.diagnostics.provideDiagnostics(document);
            this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
        } catch (error) {
            this.connection.console.error(`Validation error: ${error}`);
        }
    }

    private async onDidChangeConfiguration(): Promise<void> {
        if (this.hasConfigurationCapability) {
            const settings: unknown =
                await this.connection.workspace.getConfiguration('ck3LanguageServer');
            if (settings && typeof settings === 'object') {
                const s = settings as Partial<Record<keyof ServerConfig, unknown>>;
                this.config = {
                    logLevel: (s.logLevel as ServerConfig['logLevel']) ?? this.config.logLevel,
                    formatting: merge(this.config.formatting, s.formatting),
                    inlayHints: merge(this.config.inlayHints, s.inlayHints),
                    logWatcher: merge(this.config.logWatcher, s.logWatcher),
                };
            }
        }
        for (const document of this.documents.all()) {
            await this.validateDocument(document);
        }
    }
}

new CK3LanguageServer().listen();
