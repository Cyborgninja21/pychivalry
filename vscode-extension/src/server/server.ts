/**
 * Crusader Kings 3 Language Server - Main LSP Server Implementation (TypeScript)
 * 
 * This is a complete rewrite of the Python language server in TypeScript,
 * implementing all features as a single-process solution that runs within
 * the VS Code extension for improved performance and simplified deployment.
 * 
 * ARCHITECTURE:
 * - No separate Python process required
 * - Runs in same process as VS Code extension
 * - Full LSP feature implementation
 * - CK3-specific validation and features
 */

import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    WorkspaceFolder,
    Connection,
    ServerCapabilities,
    SelectionRangeParams,
    SelectionRange,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

// Core imports
import { CK3Parser, CachingParser } from './core/parser';
import { IncrementalParser } from './core/incremental-parser';
import { EnhancedIndexer } from './core/indexer-enhanced';
import { WorkspaceManager } from './core/workspace';
import { EnhancedWorkspaceManager } from './core/workspace-enhanced';
import { LocalizationIndex } from './core/localization-index';
import { SchemaLoader } from './schema/loader';
import { DataLoader } from './data/loader';
import { ModScanner } from './data/mod-scanner';
import { CK3Language } from './ck3/language';
import { serverLogger } from './utils/logger';

// Log watcher + analyzer
import { CK3LogWatcher, LogEntry, LogWatcherConfig } from './log/watcher';
import { CK3LogAnalyzer } from './log/analyzer';
import { LogDiagnosticConverter } from './log/diagnostics';

// LSP feature imports
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

/**
 * Server configuration interface
 */
export interface ServerConfig {
    logLevel: 'debug' | 'info' | 'warning' | 'error';
    formatting: {
        enabled: boolean;
        insertSpaces: boolean;
        tabSize: number;
    };
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

/**
 * Main CK3 Language Server class
 */
export class CK3LanguageServer {
    private connection: Connection;
    private documents: TextDocuments<TextDocument>;
    private workspaceFolders: WorkspaceFolder[] = [];
    private hasConfigurationCapability = false;
    private hasWorkspaceFolderCapability = false;
    private hasDiagnosticRelatedInformationCapability = false;

    // Core components
    private parser: CK3Parser;
    private indexer: EnhancedIndexer;
    private workspaceManager: WorkspaceManager;
    private enhancedWorkspace: EnhancedWorkspaceManager;
    private localizationIndex: LocalizationIndex;
    private modScanner: ModScanner;
    private schemaLoader: SchemaLoader;
    private dataLoader: DataLoader;

    // LSP feature providers
    private completionProvider: CompletionProvider;
    private hoverProvider: HoverProvider;
    private definitionProvider: DefinitionProvider;
    private symbolProvider: DocumentSymbolProvider;
    private diagnosticsProvider: DiagnosticsProvider;
    private formattingProvider: FormattingProvider;
    private foldingProvider: FoldingRangeProvider;
    private renameProvider: RenameProvider;
    private semanticTokensProvider: SemanticTokensProvider;
    private codeActionsProvider: CodeActionsProvider;
    private codeLensProvider: CodeLensProvider;
    private documentLinksProvider: DocumentLinksProvider;
    private documentHighlightProvider: DocumentHighlightProvider;
    private inlayHintsProvider: InlayHintsProvider;
    private signatureHelpProvider: SignatureHelpProvider;
    private callHierarchyProvider: CallHierarchyProvider;
    private selectionRangeProvider: SelectionRangeProvider;

    // Log watcher + analyzer
    private logWatcher: CK3LogWatcher | null = null;
    private logAnalyzer: CK3LogAnalyzer | null = null;
    private logDiagnosticConverter: LogDiagnosticConverter | null = null;

    // Parse cache: keyed by URI, stores version + parsed result
    private parseCache: Map<string, { version: number; ast: any; errors: any[]; timestamp: number }> = new Map();
    private readonly PARSE_CACHE_MAX_SIZE = 200;

    // Validation debounce timers
    private validationTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly VALIDATION_DEBOUNCE_MS = 300;

    // Server configuration
    private config: ServerConfig = {
        logLevel: 'info',
        formatting: {
            enabled: true,
            insertSpaces: false,
            tabSize: 4,
        },
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

    constructor() {
        // Create LSP connection
        this.connection = createConnection(ProposedFeatures.all);

        // Wire shared logger to LSP connection
        serverLogger.setConnection(this.connection);

        // Create document manager
        this.documents = new TextDocuments(TextDocument);

        // Initialize core components
        this.parser = new IncrementalParser();
        this.indexer = new EnhancedIndexer();
        this.workspaceManager = new WorkspaceManager();
        this.enhancedWorkspace = new EnhancedWorkspaceManager();
        this.localizationIndex = new LocalizationIndex();
        this.modScanner = new ModScanner();
        this.schemaLoader = new SchemaLoader();
        this.dataLoader = DataLoader.getInstance();

        // Populate CK3Language keyword sets from YAML data
        CK3Language.initialize(
            this.dataLoader.getEffects().keys(),
            this.dataLoader.getTriggers().keys(),
        );

        // Initialize LSP providers
        this.completionProvider = new CompletionProvider(this.parser, this.indexer, this.schemaLoader, this.modScanner);
        this.hoverProvider = new HoverProvider(this.parser, this.schemaLoader, this.indexer, this.localizationIndex, this.modScanner);
        this.definitionProvider = new DefinitionProvider(this.parser, this.indexer, this.localizationIndex);
        this.symbolProvider = new DocumentSymbolProvider(this.parser, this.indexer);
        this.diagnosticsProvider = new DiagnosticsProvider(
            this.parser, this.schemaLoader, this.indexer, [],
            () => this.enhancedWorkspace.getKnownAssets(),
            this.localizationIndex,
        );
        this.formattingProvider = new FormattingProvider(this.parser);
        this.foldingProvider = new FoldingRangeProvider(this.parser);
        this.renameProvider = new RenameProvider(this.parser, this.indexer);
        this.semanticTokensProvider = new SemanticTokensProvider(this.parser);
        this.codeActionsProvider = new CodeActionsProvider(this.parser);
        this.codeLensProvider = new CodeLensProvider(this.parser, this.indexer, this.localizationIndex);
        this.documentLinksProvider = new DocumentLinksProvider(this.parser, this.indexer);
        this.documentHighlightProvider = new DocumentHighlightProvider(this.parser);
        this.inlayHintsProvider = new InlayHintsProvider(this.parser);
        this.signatureHelpProvider = new SignatureHelpProvider(this.parser);
        this.callHierarchyProvider = new CallHierarchyProvider(this.parser, this.indexer);
        this.selectionRangeProvider = new SelectionRangeProvider(this.parser);

        // Register handlers
        this.registerHandlers();
    }

    /**
     * Register all LSP protocol handlers
     */
    private registerHandlers(): void {
        // Connection lifecycle
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.connection.onShutdown(this.onShutdown.bind(this));

        // Document synchronization
        this.documents.onDidOpen(this.onDidOpenDocument.bind(this));
        this.documents.onDidChangeContent(this.onDidChangeDocument.bind(this));
        this.documents.onDidClose(this.onDidCloseDocument.bind(this));
        this.documents.onDidSave(this.onDidSaveDocument.bind(this));

        // Configuration
        this.connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));

        // LSP features
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
        this.connection.onTypeDefinition(this.onTypeDefinition.bind(this));
        this.connection.onImplementation(this.onImplementation.bind(this));
        this.connection.onDeclaration(this.onDeclaration.bind(this));
        this.connection.onReferences(this.onReferences.bind(this));
        this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
        this.connection.onDocumentFormatting(this.onDocumentFormatting.bind(this));
        this.connection.onDocumentRangeFormatting(this.onDocumentRangeFormatting.bind(this));
        this.connection.onFoldingRanges(this.onFoldingRanges.bind(this));
        this.connection.onPrepareRename(this.onPrepareRename.bind(this));
        this.connection.onRenameRequest(this.onRenameRequest.bind(this));
        this.connection.onDocumentHighlight(this.onDocumentHighlight.bind(this));
        this.connection.languages.semanticTokens.on(this.onSemanticTokens.bind(this));
        this.connection.languages.semanticTokens.onRange(this.onSemanticTokensRange.bind(this));
        this.connection.onCodeAction(this.onCodeAction.bind(this));
        this.connection.onCodeLens(this.onCodeLens.bind(this));
        this.connection.onCodeLensResolve(this.onCodeLensResolve.bind(this));
        this.connection.onDocumentLinks(this.onDocumentLinks.bind(this));
        this.connection.onDocumentLinkResolve(this.onDocumentLinkResolve.bind(this));
        this.connection.languages.inlayHint.on(this.onInlayHint.bind(this));
        this.connection.languages.inlayHint.resolve(this.onInlayHintResolve.bind(this));
        this.connection.onSignatureHelp(this.onSignatureHelp.bind(this));
        this.connection.languages.callHierarchy.onPrepare(this.onPrepareCallHierarchy.bind(this));
        this.connection.languages.callHierarchy.onIncomingCalls(this.onCallHierarchyIncomingCalls.bind(this));
        this.connection.languages.callHierarchy.onOutgoingCalls(this.onCallHierarchyOutgoingCalls.bind(this));
        this.connection.onSelectionRanges(this.onSelectionRanges.bind(this));

        // Workspace features
        this.connection.onWorkspaceSymbol(this.onWorkspaceSymbol.bind(this));

        // Custom commands
        this.connection.onExecuteCommand(this.onExecuteCommand.bind(this));

        // Make the text document manager listen on the connection
        this.documents.listen(this.connection);
    }

    /**
     * Initialize handler - negotiate capabilities with client
     */
    private onInitialize(params: InitializeParams): InitializeResult {
        const capabilities = params.capabilities;

        // Check client capabilities
        this.hasConfigurationCapability = !!(
            capabilities.workspace && !!capabilities.workspace.configuration
        );
        this.hasWorkspaceFolderCapability = !!(
            capabilities.workspace && !!capabilities.workspace.workspaceFolders
        );
        this.hasDiagnosticRelatedInformationCapability = !!(
            capabilities.textDocument &&
            capabilities.textDocument.publishDiagnostics &&
            capabilities.textDocument.publishDiagnostics.relatedInformation
        );

        // Store workspace folders
        if (params.workspaceFolders) {
            this.workspaceFolders = params.workspaceFolders;
        }

        // Define server capabilities
        const serverCapabilities: ServerCapabilities = {
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
                range: true
            },
            codeActionProvider: true,
            codeLensProvider: { resolveProvider: true },
            documentLinkProvider: { resolveProvider: true },
            documentHighlightProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['{', '=', ' '],
            },
            inlayHintProvider: { resolveProvider: true },
            callHierarchyProvider: true,
            selectionRangeProvider: true,
            workspaceSymbolProvider: true,
            executeCommandProvider: {
                commands: [
                    'ck3.validateWorkspace',
                    'ck3.rescanWorkspace',
                    'ck3.getWorkspaceStats',
                    'ck3.getThreadingMetrics',
                    'ck3.generateEventTemplate',
                    'ck3.findOrphanedLocalization',
                    'ck3.showEventChain',
                    'ck3.checkDependencies',
                    'ck3.showNamespaceEvents',
                    'ck3.insertTextAtCursor',
                    'ck3.generateLocalizationStubs',
                    'ck3.renameEvent',
                    'ck3.startLogWatcher',
                    'ck3.stopLogWatcher',
                    'ck3.pauseLogWatcher',
                    'ck3.resumeLogWatcher',
                    'ck3.forceRefreshLogs',
                    'ck3.clearGameLogs',
                    'ck3.getLogStatistics',
                ]
            },
        };

        const result: InitializeResult = {
            capabilities: serverCapabilities,
            serverInfo: {
                name: 'CK3 Language Server (TypeScript)',
                version: '1.1.0'
            }
        };

        return result;
    }

    /**
     * Initialized notification - server is ready to receive requests
     */
    private async onInitialized(): Promise<void> {
        if (this.hasConfigurationCapability) {
            // Register for configuration changes
            this.connection.client.register(
                DidChangeConfigurationNotification.type,
                undefined
            );
        }

        if (this.hasWorkspaceFolderCapability) {
            this.connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
                this.connection.console.log('Workspace folders changed');
                for (const added of event.added) {
                    this.workspaceFolders.push(added);
                }
                for (const removed of event.removed) {
                    const idx = this.workspaceFolders.findIndex(f => f.uri === removed.uri);
                    if (idx !== -1) this.workspaceFolders.splice(idx, 1);
                }
                await this.rescanWorkspace();
            });
        }

        // Initialize workspace
        await this.initializeWorkspace();

        this.connection.console.log('CK3 Language Server initialized (TypeScript)');
    }

    /**
     * Initialize workspace - load schemas, index files, etc.
     */
    private async initializeWorkspace(): Promise<void> {
        try {
            this.connection.sendNotification('ck3/indexLog', {
                message: 'Initializing workspace...'
            });

            // Load schemas (lazy loading for performance)
            await this.schemaLoader.initialize();
            this.connection.sendNotification('ck3/indexLog', {
                message: 'Schemas loaded'
            });

            // Preload commonly used schemas
            await this.schemaLoader.preloadCommonSchemas();

            // Initialize data loader (async I/O for effects, triggers, scopes, etc.)
            await this.dataLoader.initialize();
            this.connection.sendNotification('ck3/indexLog', {
                message: 'Game data loaded'
            });

            // Index workspace files using both managers
            for (const folder of this.workspaceFolders) {
                this.connection.sendNotification('ck3/indexLog', {
                    message: `Scanning workspace folder: ${folder.name}`
                });
                await this.workspaceManager.addWorkspaceFolder(folder);
                await this.enhancedWorkspace.addWorkspaceFolder(folder);
            }

            // Scan localization files
            for (const folder of this.workspaceFolders) {
                const folderPath = folder.uri.replace('file:///', '').replace(/%20/g, ' ');
                const locPath = require('path').join(folderPath, 'localization');
                const count = await this.localizationIndex.scanDirectory(locPath);
                if (count > 0) {
                    this.connection.sendNotification('ck3/indexLog', {
                        message: `Indexed ${count} localization keys`
                    });
                }
            }

            // Discover and scan mods
            try {
                const modCount = await this.modScanner.discoverMods();
                if (modCount > 0) {
                    await this.modScanner.extractAllModData();
                    this.connection.sendNotification('ck3/indexLog', {
                        message: `Discovered ${modCount} mod(s): ${this.modScanner.getDiscoveredModNames().join(', ')}`
                    });
                }
            } catch (error) {
                this.connection.console.error(`Mod discovery failed: ${error}`);
            }

            this.connection.sendNotification('ck3/indexLog', {
                message: 'Workspace initialized successfully'
            });
            this.connection.console.log('Workspace initialized successfully');
        } catch (error) {
            this.connection.console.error(`Failed to initialize workspace: ${error}`);
        }
    }

    /**
     * Shutdown handler - clean up resources
     */
    private onShutdown(): void {
        this.connection.console.log('CK3 Language Server shutting down');

        // Stop log watcher if running
        if (this.logWatcher) {
            this.logWatcher.stop();
            this.logWatcher = null;
        }

        // Clear pending validation timers
        for (const timer of this.validationTimers.values()) {
            clearTimeout(timer);
        }
        this.validationTimers.clear();
        this.parseCache.clear();
        if (this.parser instanceof CachingParser) {
            this.parser.clearContentCache();
        }

        // Clear indexer data for all open documents
        for (const document of this.documents.all()) {
            this.indexer.removeDocument(document.uri);
        }

        // Clear document diagnostics for all open documents
        for (const document of this.documents.all()) {
            this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
        }
    }

    /**
     * Get parsed result for a document, using cache when possible
     */
    private getParsed(document: TextDocument): { ast: any; errors: any[] } {
        const cached = this.parseCache.get(document.uri);
        if (cached && cached.version === document.version) {
            return { ast: cached.ast, errors: cached.errors };
        }

        const parsed = this.parser.parse(document.getText());

        // Evict oldest entry if cache is full
        if (this.parseCache.size >= this.PARSE_CACHE_MAX_SIZE) {
            let oldestKey: string | undefined;
            let oldestTime = Infinity;
            for (const [key, entry] of this.parseCache) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey) this.parseCache.delete(oldestKey);
        }

        this.parseCache.set(document.uri, {
            version: document.version,
            ast: parsed.ast,
            errors: parsed.errors,
            timestamp: Date.now(),
        });

        return parsed;
    }

    /**
     * Document opened event
     */
    private async onDidOpenDocument(event: { document: TextDocument }): Promise<void> {
        const document = event.document;
        this.connection.console.log(`Document opened: ${document.uri}`);

        // Parse document (cached)
        const parsed = this.getParsed(document);

        // Index document with enhanced tracking (event metadata, references, loc keys)
        await this.indexer.indexDocumentEnhanced(document.uri, parsed.ast);

        // Validate and send diagnostics
        await this.validateDocument(document);
    }

    /**
     * Document changed event
     */
    private async onDidChangeDocument(event: { document: TextDocument }): Promise<void> {
        const document = event.document;

        // Parse and index immediately (needed for completions/hover)
        const parsed = this.getParsed(document);
        await this.indexer.indexDocumentEnhanced(document.uri, parsed.ast);

        // Debounce validation to avoid firing on every keystroke
        const existing = this.validationTimers.get(document.uri);
        if (existing) clearTimeout(existing);

        this.validationTimers.set(document.uri, setTimeout(async () => {
            this.validationTimers.delete(document.uri);
            const currentDoc = this.documents.get(document.uri);
            if (currentDoc) {
                await this.validateDocument(currentDoc);
            }
        }, this.VALIDATION_DEBOUNCE_MS));
    }

    /**
     * Document closed event
     */
    private onDidCloseDocument(event: { document: TextDocument }): void {
        const document = event.document;
        this.connection.console.log(`Document closed: ${document.uri}`);

        // Clear pending validation timer
        const timer = this.validationTimers.get(document.uri);
        if (timer) {
            clearTimeout(timer);
            this.validationTimers.delete(document.uri);
        }

        // Remove from parse cache
        this.parseCache.delete(document.uri);

        // Clear hover cache
        this.hoverProvider.clearCache();

        // Remove from index
        this.indexer.removeDocument(document.uri);

        // Clear diagnostics
        this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    }

    /**
     * Document saved event
     */
    private async onDidSaveDocument(event: { document: TextDocument }): Promise<void> {
        const document = event.document;
        this.connection.console.log(`Document saved: ${document.uri}`);

        // Full validation on save
        await this.validateDocument(document);
    }

    /**
     * Validate document and send diagnostics
     */
    private async validateDocument(document: TextDocument): Promise<void> {
        try {
            const diagnostics = await this.diagnosticsProvider.provideDiagnostics(document);
            this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
        } catch (error) {
            this.connection.console.error(`Validation error: ${error}`);
        }
    }

    /**
     * Configuration changed event
     */
    private async onDidChangeConfiguration(change: any): Promise<void> {
        if (this.hasConfigurationCapability) {
            // Pull updated configuration from the client
            const settings = await this.connection.workspace.getConfiguration('ck3LanguageServer');
            if (settings) {
                // Update formatting config
                if (settings.formatting) {
                    this.config.formatting = {
                        enabled: settings.formatting.enabled ?? this.config.formatting.enabled,
                        insertSpaces: settings.formatting.insertSpaces ?? this.config.formatting.insertSpaces,
                        tabSize: settings.formatting.tabSize ?? this.config.formatting.tabSize,
                    };
                }
                // Update inlay hints config
                if (settings.inlayHints) {
                    this.config.inlayHints = {
                        enabled: settings.inlayHints.enabled ?? this.config.inlayHints.enabled,
                        showScopeTypes: settings.inlayHints.showScopeTypes ?? this.config.inlayHints.showScopeTypes,
                        showChainTypes: settings.inlayHints.showChainTypes ?? this.config.inlayHints.showChainTypes,
                        showIteratorTypes: settings.inlayHints.showIteratorTypes ?? this.config.inlayHints.showIteratorTypes,
                        maxHintsPerLine: settings.inlayHints.maxHintsPerLine ?? this.config.inlayHints.maxHintsPerLine,
                    };
                }
                // Update log watcher config
                if (settings.logWatcher) {
                    this.config.logWatcher = {
                        enabled: settings.logWatcher.enabled ?? this.config.logWatcher.enabled,
                        autoStart: settings.logWatcher.autoStart ?? this.config.logWatcher.autoStart,
                        logPath: settings.logWatcher.logPath ?? this.config.logWatcher.logPath,
                        showInOutput: settings.logWatcher.showInOutput ?? this.config.logWatcher.showInOutput,
                        maxLogSize: settings.logWatcher.maxLogSize ?? this.config.logWatcher.maxLogSize,
                        debounceDelay: settings.logWatcher.debounceDelay ?? this.config.logWatcher.debounceDelay,
                    };
                }
                // Update log level
                if (settings.logLevel) {
                    this.config.logLevel = settings.logLevel;
                }
            }
        }

        // Revalidate all open documents with updated config
        for (const document of this.documents.all()) {
            await this.validateDocument(document);
        }
    }

    /**
     * Completion handler
     */
    private async onCompletion(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.completionProvider.provideCompletions(document, params.position);
        } catch (error) {
            this.connection.console.error(`Completion error: ${error}`);
            return [];
        }
    }

    /**
     * Completion resolve handler
     */
    private async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
        try {
            return await this.completionProvider.resolveCompletion(item);
        } catch (error) {
            this.connection.console.error(`Completion resolve error: ${error}`);
            return item;
        }
    }

    /**
     * Hover handler
     */
    private async onHover(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.hoverProvider.provideHover(document, params.position);
        } catch (error) {
            this.connection.console.error(`Hover error: ${error}`);
            return null;
        }
    }

    /**
     * Definition handler
     */
    private async onDefinition(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.definitionProvider.navigateToDefinition(document, params.position);
        } catch (error) {
            this.connection.console.error(`Definition error: ${error}`);
            return null;
        }
    }

    /**
     * References handler
     */
    private async onReferences(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.definitionProvider.findAllReferences(document, params.position, params.context.includeDeclaration);
        } catch (error) {
            this.connection.console.error(`References error: ${error}`);
            return [];
        }
    }

    /**
     * Type definition handler
     */
    private async onTypeDefinition(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.definitionProvider.navigateToTypeDefinition(document, params.position);
        } catch (error) {
            this.connection.console.error(`Type definition error: ${error}`);
            return null;
        }
    }

    /**
     * Implementation handler
     */
    private async onImplementation(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.definitionProvider.findImplementation(document, params.position);
        } catch (error) {
            this.connection.console.error(`Implementation error: ${error}`);
            return null;
        }
    }

    /**
     * Declaration handler
     */
    private async onDeclaration(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.definitionProvider.navigateToDeclaration(document, params.position);
        } catch (error) {
            this.connection.console.error(`Declaration error: ${error}`);
            return null;
        }
    }

    /**
     * Document symbol handler
     */
    private async onDocumentSymbol(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.symbolProvider.buildDocumentOutline(document);
        } catch (error) {
            this.connection.console.error(`Document symbol error: ${error}`);
            return [];
        }
    }

    /**
     * Document formatting handler
     */
    private async onDocumentFormatting(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.formattingProvider.formatDocument(document, params.options);
        } catch (error) {
            this.connection.console.error(`Formatting error: ${error}`);
            return [];
        }
    }

    /**
     * Document range formatting handler
     */
    private async onDocumentRangeFormatting(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.formattingProvider.formatRange(document, params.range, params.options);
        } catch (error) {
            this.connection.console.error(`Range formatting error: ${error}`);
            return [];
        }
    }

    /**
     * Folding ranges handler
     */
    private async onFoldingRanges(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.foldingProvider.provideFoldingRanges(document);
        } catch (error) {
            this.connection.console.error(`Folding ranges error: ${error}`);
            return [];
        }
    }

    /**
     * Selection ranges handler
     */
    private async onSelectionRanges(params: SelectionRangeParams): Promise<SelectionRange[]> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.selectionRangeProvider.provideSelectionRanges(document, params.positions);
        } catch (error) {
            this.connection.console.error(`Selection ranges error: ${error}`);
            return [];
        }
    }

    /**
     * Prepare rename handler
     */
    private async onPrepareRename(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.renameProvider.prepareRename(document, params.position);
        } catch (error) {
            this.connection.console.error(`Prepare rename error: ${error}`);
            return null;
        }
    }

    /**
     * Rename request handler
     */
    private async onRenameRequest(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.renameProvider.provideRename(document, params.position, params.newName);
        } catch (error) {
            this.connection.console.error(`Rename error: ${error}`);
            return null;
        }
    }

    /**
     * Document highlight handler
     */
    private async onDocumentHighlight(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.documentHighlightProvider.provideDocumentHighlights(document, params.position);
        } catch (error) {
            this.connection.console.error(`Document highlight error: ${error}`);
            return [];
        }
    }

    /**
     * Semantic tokens handler
     */
    private async onSemanticTokens(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return { data: [] };
        }

        try {
            return this.semanticTokensProvider.generateSemanticTokens(document);
        } catch (error) {
            this.connection.console.error(`Semantic tokens error: ${error}`);
            return { data: [] };
        }
    }

    /**
     * Semantic tokens range handler
     */
    private async onSemanticTokensRange(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return { data: [] };
        }

        try {
            return this.semanticTokensProvider.generateRangeSemanticTokens(document, params.range);
        } catch (error) {
            this.connection.console.error(`Semantic tokens range error: ${error}`);
            return { data: [] };
        }
    }

    /**
     * Code action handler
     */
    private async onCodeAction(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.codeActionsProvider.provideCodeActions(
                document,
                params.range,
                params.context.diagnostics
            );
        } catch (error) {
            this.connection.console.error(`Code action error: ${error}`);
            return [];
        }
    }

    /**
     * Code lens handler
     */
    private async onCodeLens(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.codeLensProvider.provideCodeLens(document);
        } catch (error) {
            this.connection.console.error(`Code lens error: ${error}`);
            return [];
        }
    }

    /**
     * Document links handler
     */
    private async onDocumentLinks(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.documentLinksProvider.provideDocumentLinks(document);
        } catch (error) {
            this.connection.console.error(`Document links error: ${error}`);
            return [];
        }
    }

    /**
     * Inlay hint handler
     */
    private async onInlayHint(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        try {
            return this.inlayHintsProvider.provideInlayHints(document, params.range);
        } catch (error) {
            this.connection.console.error(`Inlay hint error: ${error}`);
            return [];
        }
    }

    /**
     * Signature help handler
     */
    private async onSignatureHelp(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            return this.signatureHelpProvider.provideSignatureHelp(document, params.position);
        } catch (error) {
            this.connection.console.error(`Signature help error: ${error}`);
            return null;
        }
    }

    /**
     * Call hierarchy prepare handler
     */
    private onPrepareCallHierarchy(params: any): any {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) return null;
        try {
            return this.callHierarchyProvider.prepareCallHierarchy(document, params);
        } catch (error) {
            this.connection.console.error(`Call hierarchy prepare error: ${error}`);
            return null;
        }
    }

    /**
     * Call hierarchy incoming calls handler
     */
    private onCallHierarchyIncomingCalls(params: any): any {
        try {
            return this.callHierarchyProvider.incomingCalls(params);
        } catch (error) {
            this.connection.console.error(`Call hierarchy incoming calls error: ${error}`);
            return [];
        }
    }

    /**
     * Call hierarchy outgoing calls handler
     */
    private onCallHierarchyOutgoingCalls(params: any): any {
        try {
            return this.callHierarchyProvider.outgoingCalls(params);
        } catch (error) {
            this.connection.console.error(`Call hierarchy outgoing calls error: ${error}`);
            return [];
        }
    }

    /**
     * Code lens resolve handler
     */
    private onCodeLensResolve(lens: any): any {
        try {
            return this.codeLensProvider.resolveCodeLens(lens);
        } catch (error) {
            this.connection.console.error(`Code lens resolve error: ${error}`);
            return lens;
        }
    }

    /**
     * Document link resolve handler
     */
    private onDocumentLinkResolve(link: any): any {
        try {
            return this.documentLinksProvider.resolveDocumentLink(link);
        } catch (error) {
            this.connection.console.error(`Document link resolve error: ${error}`);
            return link;
        }
    }

    /**
     * Inlay hint resolve handler
     */
    private onInlayHintResolve(hint: any): any {
        try {
            return this.inlayHintsProvider.resolveInlayHint(hint);
        } catch (error) {
            this.connection.console.error(`Inlay hint resolve error: ${error}`);
            return hint;
        }
    }

    /**
     * Workspace symbol handler
     */
    private async onWorkspaceSymbol(params: any): Promise<any> {
        const query = params.query;

        try {
            return this.symbolProvider.searchWorkspaceSymbols(query);
        } catch (error) {
            this.connection.console.error(`Workspace symbol error: ${error}`);
            return [];
        }
    }

    /**
     * Execute command handler
     */
    private async onExecuteCommand(params: any): Promise<any> {
        const command = params.command;
        const args = params.arguments || [];

        this.connection.console.log(`Executing command: ${command}`);

        switch (command) {
            case 'ck3.validateWorkspace':
                return this.validateWorkspace();

            case 'ck3.rescanWorkspace':
                return this.rescanWorkspace();

            case 'ck3.getWorkspaceStats':
                return this.getWorkspaceStats();

            case 'ck3.getThreadingMetrics':
                return this.getThreadingMetrics();

            case 'ck3.generateEventTemplate':
                return this.generateEventTemplate(args);

            case 'ck3.findOrphanedLocalization':
                return this.findOrphanedLocalization();

            case 'ck3.showEventChain':
                return this.showEventChain(args);

            case 'ck3.checkDependencies':
                return this.checkDependencies();

            case 'ck3.showNamespaceEvents':
                return this.showNamespaceEvents(args);

            case 'ck3.insertTextAtCursor':
                return this.insertTextAtCursor(args);

            case 'ck3.generateLocalizationStubs':
                return this.generateLocalizationStubs(args);

            case 'ck3.renameEvent':
                return this.renameEvent(args);

            case 'ck3.startLogWatcher':
                return this.startLogWatcher();

            case 'ck3.stopLogWatcher':
                return this.stopLogWatcher();

            case 'ck3.pauseLogWatcher':
                return this.pauseLogWatcher();

            case 'ck3.resumeLogWatcher':
                return this.resumeLogWatcher();

            case 'ck3.forceRefreshLogs':
                return this.forceRefreshLogs();

            case 'ck3.clearGameLogs':
                return this.clearGameLogs();

            case 'ck3.getLogStatistics':
                return this.getLogStatistics();

            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }

    // Command implementations

    private async validateWorkspace(): Promise<any> {
        // Validate all documents in workspace
        const diagnosticsCount = { errors: 0, warnings: 0 };

        for (const document of this.documents.all()) {
            const diagnostics = await this.diagnosticsProvider.provideDiagnostics(document);
            diagnostics.forEach(d => {
                if (d.severity === 1) diagnosticsCount.errors++;
                else if (d.severity === 2) diagnosticsCount.warnings++;
            });
        }

        return { success: true, ...diagnosticsCount };
    }

    private async rescanWorkspace(): Promise<any> {
        let filesScanned = 0;
        let errors = 0;

        this.connection.sendNotification('ck3/indexLog', {
            message: 'Starting workspace rescan...'
        });

        for (const folder of this.workspaceFolders) {
            const files = await this.workspaceManager.findCK3Files(folder);

            this.connection.sendNotification('ck3/indexLog', {
                message: `Found ${files.length} CK3 files in ${folder.name}`
            });

            for (const file of files) {
                try {
                    const content = await readFileAsync(file, 'utf-8');
                    const uri = 'file:///' + file.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
                    const parsed = this.parser.parse(content);
                    await this.indexer.indexDocumentEnhanced(uri, parsed.ast);
                    filesScanned++;

                    // Send progress every 10 files
                    if (filesScanned % 10 === 0) {
                        this.connection.sendNotification('ck3/indexLog', {
                            message: `Indexed ${filesScanned} files...`
                        });
                    }
                } catch (error) {
                    errors++;
                    this.connection.console.error(`Failed to scan file ${file}: ${error}`);
                }
            }
        }

        // Rescan localization files
        for (const folder of this.workspaceFolders) {
            const folderPath = folder.uri.replace('file:///', '').replace(/%20/g, ' ');
            const locPath = require('path').join(folderPath, 'localization');
            const count = await this.localizationIndex.scanDirectory(locPath);
            if (count > 0) {
                this.connection.sendNotification('ck3/indexLog', {
                    message: `Indexed ${count} localization keys`
                });
            }
        }

        this.connection.sendNotification('ck3/indexLog/bulk', {
            lines: [
                `Workspace rescan complete: ${filesScanned} files indexed`,
                errors > 0 ? `${errors} file(s) had errors` : 'No errors',
            ]
        });

        // Revalidate all open documents after rescan
        for (const document of this.documents.all()) {
            await this.validateDocument(document);
        }

        return {
            success: true,
            message: `Workspace rescanned: ${filesScanned} files indexed${errors > 0 ? `, ${errors} errors` : ''}`,
            filesScanned,
            errors,
        };
    }

    private getWorkspaceStats(): any {
        return this.indexer.getStatistics();
    }

    private getThreadingMetrics(): any {
        // TypeScript server doesn't have threading like Python
        return {
            isThreaded: false,
            model: 'single-threaded',
            note: 'TypeScript server runs in single process',
        };
    }

    private generateEventTemplate(args: any[]): any {
        // Generate a basic event template
        const namespace = args[0] || 'my_namespace';
        const id = args[1] || '0001';

        const template = `${namespace}.${id} = {
    type = character_event
    title = ${namespace}.${id}.t
    desc = ${namespace}.${id}.desc
    theme = realm
    
    trigger = {
        # Add trigger conditions here
    }
    
    immediate = {
        # Add immediate effects here
    }
    
    option = {
        name = ${namespace}.${id}.a
        # Add option effects here
    }
}`;

        return {
            template,
            event_id: `${namespace}.${id}`,
            localization_keys: [
                `${namespace}.${id}.t`,
                `${namespace}.${id}.desc`,
                `${namespace}.${id}.a`,
            ],
        };
    }

    private findOrphanedLocalization(): any {
        // Get all event-related prefixes from the enhanced indexer
        const eventPrefixes = new Set<string>();
        const allEvents = this.indexer.findSymbolsByType('event' as any);
        for (const event of allEvents) {
            eventPrefixes.add(event.name);
        }

        // Get all localization keys tracked by the enhanced indexer
        const locKeys = this.indexer.getLocalizationKeys();

        // Find loc keys that look like event keys but don't have matching events
        const orphaned: string[] = [];
        for (const locKey of locKeys) {
            // Pattern: namespace.number.suffix (e.g., my_mod.0001.t)
            const parts = locKey.split('.');
            if (parts.length >= 3) {
                const potentialEventId = parts.slice(0, -1).join('.');
                if (!eventPrefixes.has(potentialEventId)) {
                    orphaned.push(locKey);
                }
            }
        }

        return {
            orphaned_keys: orphaned.slice(0, 100),
            total_count: orphaned.length,
        };
    }

    private showEventChain(args: any[]): any {
        const startEventId = args[0] || '';
        if (!startEventId) {
            return { events: [], chain_depth: 0 };
        }

        // BFS traversal of event chains using enhanced indexer
        const visited = new Set<string>();
        const chain: Array<{ event_id: string; depth: number }> = [];
        const queue: Array<{ id: string; depth: number }> = [{ id: startEventId, depth: 0 }];

        while (queue.length > 0 && chain.length < 50) {
            const current = queue.shift()!;
            if (visited.has(current.id)) continue;
            visited.add(current.id);

            chain.push({ event_id: current.id, depth: current.depth });

            const triggered = this.indexer.getEventChain(current.id);
            for (const nextEvent of triggered) {
                if (!visited.has(nextEvent)) {
                    queue.push({ id: nextEvent, depth: current.depth + 1 });
                }
            }
        }

        return {
            start_event: startEventId,
            events: chain,
            chain_depth: chain.length > 0 ? Math.max(...chain.map(c => c.depth)) : 0,
        };
    }

    private checkDependencies(): any {
        // Get undefined references from the enhanced indexer
        const undefinedRefs = this.indexer.getUndefinedReferences();

        const missing = undefinedRefs.map(ref => ({
            name: ref.name,
            type: ref.type,
            referenced_in: ref.locations.map(loc => ({
                file: loc.uri,
                line: loc.range.start.line,
            })),
        }));

        // Get all defined symbols as satisfied dependencies
        const stats = this.indexer.getStatistics();

        return {
            missing,
            missing_count: missing.length,
            satisfied_count: stats.totalSymbols,
        };
    }

    private showNamespaceEvents(args: any[]): any {
        const namespace = args[0] || '';

        // Use enhanced indexer's namespace-aware event lookup
        const eventMetadata = this.indexer.getEventsByNamespace(namespace);

        if (eventMetadata.length > 0) {
            return {
                namespace,
                events: eventMetadata.map(e => ({
                    event_id: e.id,
                    title: e.title || '(no title)',
                    file: '', // Would need to track file URI in event metadata
                    line: 0,
                })),
                count: eventMetadata.length,
            };
        }

        // Fallback to basic symbol lookup
        const events = this.indexer.findSymbolsByType('event' as any)
            .filter(s => s.name.startsWith(namespace + '.'));

        return {
            namespace,
            events: events.map(e => ({
                event_id: e.name,
                title: e.detail || '(no title)',
                file: e.uri,
                line: e.range.start.line,
            })),
            count: events.length,
        };
    }

    private async insertTextAtCursor(args: any[]): Promise<any> {
        if (!args || args.length < 4) {
            return { error: 'Required arguments: uri, line, character, text' };
        }

        const uri = args[0];
        const line = parseInt(args[1]);
        const character = parseInt(args[2]);
        const text = args[3];

        try {
            const edit = {
                documentChanges: [
                    {
                        textDocument: { uri, version: null },
                        edits: [
                            {
                                range: {
                                    start: { line, character },
                                    end: { line, character },
                                },
                                newText: text,
                            },
                        ],
                    },
                ],
            };

            const result = await this.connection.workspace.applyEdit(edit);
            return { success: result.applied };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private generateLocalizationStubs(args: any[]): any {
        if (!args || args.length < 1) {
            return { error: 'Event ID required' };
        }

        const eventId = args[0];
        const targetUri = args.length > 1 ? args[1] : null;
        const insertLine = args.length > 2 ? parseInt(args[2]) : null;

        // Check if the enhanced indexer has event metadata for richer stubs
        const eventMeta = this.indexer.getEvent(eventId);

        let locText: string;
        let keysGenerated: string[];

        if (eventMeta && eventMeta.options.length > 0) {
            // Generate stubs based on actual event structure
            const lines = [
                ` ${eventId}.t:0 "Event Title"`,
                ` ${eventId}.desc:0 "Event description goes here."`,
            ];
            keysGenerated = [`${eventId}.t`, `${eventId}.desc`];

            for (const option of eventMeta.options) {
                if (option.name) {
                    lines.push(` ${option.name}:0 "Option Text"`);
                    keysGenerated.push(option.name);
                }
            }

            locText = lines.join('\n') + '\n';
        } else {
            // Generate default stubs
            locText = ` ${eventId}.t:0 "Event Title"\n ${eventId}.desc:0 "Event description goes here."\n ${eventId}.a:0 "First Option"\n ${eventId}.b:0 "Second Option"\n`;
            keysGenerated = [
                `${eventId}.t`,
                `${eventId}.desc`,
                `${eventId}.a`,
                `${eventId}.b`,
            ];
        }

        return {
            event_id: eventId,
            localization_text: locText,
            keys_generated: keysGenerated,
        };
    }

    private async renameEvent(args: any[]): Promise<any> {
        if (!args || args.length < 2) {
            return { error: 'Required arguments: old_event_id, new_event_id' };
        }

        const oldId = args[0];
        const newId = args[1];

        // Check if event exists via enhanced indexer
        const eventMeta = this.indexer.getEvent(oldId);
        const eventSymbols = this.indexer.findSymbolsByName(oldId);

        if (!eventMeta && eventSymbols.length === 0) {
            return { error: `Event '${oldId}' not found` };
        }

        // Build workspace edit to rename all occurrences across files
        const changes: Record<string, Array<{ range: any; newText: string }>> = {};
        let totalReplacements = 0;

        // Collect all symbol locations for this event name
        for (const symbol of eventSymbols) {
            if (!changes[symbol.uri]) {
                changes[symbol.uri] = [];
            }
            changes[symbol.uri].push({
                range: symbol.range,
                newText: newId,
            });
            totalReplacements++;
        }

        // Also search open documents for text references (e.g., trigger_event = { id = old_id })
        for (const document of this.documents.all()) {
            const text = document.getText();
            const regex = new RegExp(`\\b${oldId.replace(/\./g, '\\.')}\\b`, 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + oldId.length);
                const range = { start: startPos, end: endPos };

                if (!changes[document.uri]) {
                    changes[document.uri] = [];
                }

                // Avoid duplicate edits for the same range
                const isDuplicate = changes[document.uri].some(
                    e => e.range.start.line === range.start.line &&
                        e.range.start.character === range.start.character
                );
                if (!isDuplicate) {
                    changes[document.uri].push({ range, newText: newId });
                    totalReplacements++;
                }
            }
        }

        if (totalReplacements === 0) {
            return { error: `No occurrences of '${oldId}' found to rename` };
        }

        // Apply the workspace edit
        try {
            const documentChanges = Object.entries(changes).map(([uri, edits]) => ({
                textDocument: { uri, version: null },
                edits,
            }));

            const result = await this.connection.workspace.applyEdit({ documentChanges });

            return {
                success: result.applied,
                old_id: oldId,
                new_id: newId,
                files_changed: Object.keys(changes).length,
                total_replacements: totalReplacements,
            };
        } catch (error) {
            return { error: `Rename failed: ${error}` };
        }
    }

    private startLogWatcher(): any {
        // Initialise log analyzer and diagnostic converter on first use
        if (!this.logAnalyzer) {
            this.logAnalyzer = new CK3LogAnalyzer();
        }
        if (!this.logDiagnosticConverter) {
            const roots = this.workspaceFolders.map(f => f.uri.replace('file://', ''));
            this.logDiagnosticConverter = new LogDiagnosticConverter(this.connection, roots);
        }

        if (!this.logWatcher) {
            const watcherConfig: LogWatcherConfig = {
                debounceDelay: this.config.logWatcher.debounceDelay,
                maxLogSize: this.config.logWatcher.maxLogSize,
            };
            this.logWatcher = new CK3LogWatcher({
                onLogEntries: (entry: LogEntry) => {
                    // Send bulk notification per file
                    this.connection.sendNotification(`ck3/logEntry/${entry.file.replace('.log', '')}/bulk`, {
                        lines: entry.lines,
                        log_file: entry.file,
                    });
                    // Also send combined channel
                    this.connection.sendNotification('ck3/logEntry/combined/bulk', {
                        lines: entry.lines,
                        log_file: entry.file,
                    });

                    // Analyse log lines and publish diagnostics
                    if (this.logAnalyzer && this.logDiagnosticConverter) {
                        const results = this.logAnalyzer.analyzeBatch(entry.lines, entry.file);
                        if (results.length > 0) {
                            this.logDiagnosticConverter.convertAndPublish(results);

                            // Also send matched patterns to client for output channel display
                            this.connection.sendNotification('ck3/logEntry/pattern/bulk', {
                                patterns: results.map(r => ({
                                    message: r.message,
                                    severity: r.severity,
                                    category: r.category,
                                    sourceFile: r.sourceFile,
                                    lineNumber: r.lineNumber,
                                    suggestions: r.suggestions,
                                })),
                            });
                        }
                    }
                },
                onStarted: (files: string[]) => {
                    this.connection.sendNotification('ck3/logWatcherStarted', { files });
                },
                onStopped: () => {
                    this.connection.sendNotification('ck3/logWatcherStopped', {});
                },
                onPaused: () => {
                    this.connection.sendNotification('ck3/logWatcherPaused', {});
                },
                onResumed: () => {
                    this.connection.sendNotification('ck3/logWatcherResumed', {});
                },
                onError: (message: string) => {
                    this.connection.console.error(`Log watcher error: ${message}`);
                },
            }, watcherConfig);
        }

        return this.logWatcher.start();
    }

    private stopLogWatcher(): any {
        if (!this.logWatcher) {
            return { success: false, message: 'Log watcher was never initialized' };
        }
        return this.logWatcher.stop();
    }

    private pauseLogWatcher(): any {
        if (!this.logWatcher) {
            return { success: false, message: 'Log watcher was never initialized' };
        }
        return this.logWatcher.pause();
    }

    private resumeLogWatcher(): any {
        if (!this.logWatcher) {
            return { success: false, message: 'Log watcher was never initialized' };
        }
        return this.logWatcher.resume();
    }

    private forceRefreshLogs(): any {
        if (!this.logWatcher) {
            return { success: false, files_read: 0, total_lines: 0 };
        }
        return this.logWatcher.forceRefresh();
    }

    private clearGameLogs(): any {
        // Clear log diagnostics from editor
        if (this.logDiagnosticConverter) {
            this.logDiagnosticConverter.clearAllLogDiagnostics();
        }
        // Reset analyzer statistics
        if (this.logAnalyzer) {
            this.logAnalyzer.resetStatistics();
        }
        // Stop watcher
        if (this.logWatcher) {
            this.logWatcher.stop();
            this.logWatcher = null;
        }
        return { success: true, message: 'Game logs cleared' };
    }

    private getLogStatistics(): any {
        const watcherStats = this.logWatcher
            ? this.logWatcher.getStatistics()
            : null;
        const analyzerStats = this.logAnalyzer
            ? this.logAnalyzer.getStatistics()
            : null;

        return {
            success: true,
            statistics: {
                total_lines_processed: analyzerStats?.totalLinesProcessed ?? watcherStats?.totalLinesProcessed ?? 0,
                total_errors: analyzerStats?.totalErrors ?? watcherStats?.errorsFound ?? 0,
                total_warnings: analyzerStats?.totalWarnings ?? watcherStats?.warningsFound ?? 0,
                total_info: 0,
                errors_by_category: analyzerStats?.errorsByCategory ?? {},
                most_common_errors: analyzerStats?.mostCommonErrors ?? [],
                slow_events: {},
                files_watched: watcherStats?.filesWatched ?? 0,
                is_running: watcherStats?.isRunning ?? false,
                is_paused: watcherStats?.isPaused ?? false,
            },
        };
    }

    /**
     * Map symbol type to LSP symbol kind
     */
    private mapSymbolTypeToKind(type: string): number {
        const map: Record<string, number> = {
            'event': 5, // Function
            'decision': 5,
            'on_action': 5,
            'scripted_effect': 12, // Function
            'scripted_trigger': 12,
            'variable': 13, // Variable
            'scope': 13,
            'namespace': 3, // Namespace
        };
        return map[type] || 1; // Default to File
    }

    /**
     * Start listening for requests
     */
    public listen(): void {
        this.connection.listen();
    }
}

// Create and start server
const server = new CK3LanguageServer();
server.listen();
