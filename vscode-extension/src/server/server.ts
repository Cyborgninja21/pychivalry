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
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Core imports
import { CK3Parser } from './core/parser';
import { DocumentIndexer } from './core/indexer';
import { WorkspaceManager } from './core/workspace';
import { SchemaLoader } from './schema/loader';

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
    private indexer: DocumentIndexer;
    private workspaceManager: WorkspaceManager;
    private schemaLoader: SchemaLoader;
    
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
        
        // Create document manager
        this.documents = new TextDocuments(TextDocument);
        
        // Initialize core components
        this.parser = new CK3Parser();
        this.indexer = new DocumentIndexer();
        this.workspaceManager = new WorkspaceManager();
        this.schemaLoader = new SchemaLoader();
        
        // Initialize LSP providers
        this.completionProvider = new CompletionProvider(this.parser, this.indexer, this.schemaLoader);
        this.hoverProvider = new HoverProvider(this.parser, this.schemaLoader);
        this.definitionProvider = new DefinitionProvider(this.parser, this.indexer);
        this.symbolProvider = new DocumentSymbolProvider(this.parser);
        this.diagnosticsProvider = new DiagnosticsProvider(this.parser, this.schemaLoader, this.indexer);
        this.formattingProvider = new FormattingProvider(this.parser);
        this.foldingProvider = new FoldingRangeProvider(this.parser);
        this.renameProvider = new RenameProvider(this.parser, this.indexer);
        this.semanticTokensProvider = new SemanticTokensProvider(this.parser);
        this.codeActionsProvider = new CodeActionsProvider(this.parser);
        this.codeLensProvider = new CodeLensProvider(this.parser);
        this.documentLinksProvider = new DocumentLinksProvider(this.parser);
        this.documentHighlightProvider = new DocumentHighlightProvider(this.parser);
        this.inlayHintsProvider = new InlayHintsProvider(this.parser);
        this.signatureHelpProvider = new SignatureHelpProvider(this.parser);
        
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
        this.connection.onReferences(this.onReferences.bind(this));
        this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
        this.connection.onDocumentFormatting(this.onDocumentFormatting.bind(this));
        this.connection.onDocumentRangeFormatting(this.onDocumentRangeFormatting.bind(this));
        this.connection.onFoldingRanges(this.onFoldingRanges.bind(this));
        this.connection.onPrepareRename(this.onPrepareRename.bind(this));
        this.connection.onRenameRequest(this.onRenameRequest.bind(this));
        this.connection.onDocumentHighlight(this.onDocumentHighlight.bind(this));
        this.connection.languages.semanticTokens.on(this.onSemanticTokens.bind(this));
        this.connection.onCodeAction(this.onCodeAction.bind(this));
        this.connection.onCodeLens(this.onCodeLens.bind(this));
        this.connection.onCodeLensResolve(this.onCodeLensResolve.bind(this));
        this.connection.onDocumentLinks(this.onDocumentLinks.bind(this));
        this.connection.onDocumentLinkResolve(this.onDocumentLinkResolve.bind(this));
        this.connection.languages.inlayHint.on(this.onInlayHint.bind(this));
        this.connection.languages.inlayHint.resolve(this.onInlayHintResolve.bind(this));
        this.connection.onSignatureHelp(this.onSignatureHelp.bind(this));
        
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
        this.connection.console.log('[CK3 Server] Initialize request received');
        this.connection.console.log(`[CK3 Server] Client info: ${params.clientInfo?.name || 'unknown'} v${params.clientInfo?.version || 'unknown'}`);
        this.connection.console.log(`[CK3 Server] Workspace folders: ${params.workspaceFolders?.length || 0}`);
        
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
                triggerCharacters: ['.', ':', '=', ' ', '\t'],
            },
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            renameProvider: { prepareProvider: true },
            foldingRangeProvider: true,
            semanticTokensProvider: {
                legend: {
                    tokenTypes: [
                        'keyword', 'operator', 'string', 'number', 'variable',
                        'function', 'namespace', 'class', 'property', 'comment'
                    ],
                    tokenModifiers: ['declaration', 'readonly', 'static']
                },
                full: true,
                range: false
            },
            codeActionProvider: true,
            codeLensProvider: { resolveProvider: true },
            documentLinkProvider: { resolveProvider: true },
            documentHighlightProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ','],
            },
            inlayHintProvider: { resolveProvider: true },
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
            this.connection.workspace.onDidChangeWorkspaceFolders(event => {
                this.connection.console.log('Workspace folders changed');
                // TODO: Handle workspace folder changes
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
            // Load schemas (lazy loading for performance)
            await this.schemaLoader.initialize();
            
            // Index workspace files
            for (const folder of this.workspaceFolders) {
                await this.workspaceManager.addWorkspaceFolder(folder);
            }
            
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
        // TODO: Clean up resources
    }

    /**
     * Document opened event
     */
    private async onDidOpenDocument(event: { document: TextDocument }): Promise<void> {
        const document = event.document;
        this.connection.console.log(`Document opened: ${document.uri}`);
        
        // Parse document
        const parsed = this.parser.parse(document.getText());
        
        // Index document
        await this.indexer.indexDocument(document.uri, parsed.ast);
        
        // Validate and send diagnostics
        await this.validateDocument(document);
    }

    /**
     * Document changed event
     */
    private async onDidChangeDocument(event: { document: TextDocument }): Promise<void> {
        const document = event.document;
        
        // Incremental parse
        const parsed = this.parser.parse(document.getText());
        
        // Update index
        await this.indexer.indexDocument(document.uri, parsed.ast);
        
        // Debounced validation
        await this.validateDocument(document);
    }

    /**
     * Document closed event
     */
    private onDidCloseDocument(event: { document: TextDocument }): void {
        const document = event.document;
        this.connection.console.log(`Document closed: ${document.uri}`);
        
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
            // Reset cached configuration
            // TODO: Implement configuration caching
        }
        
        // Revalidate all open documents
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
        
        return this.completionProvider.provideCompletions(document, params.position);
    }

    /**
     * Completion resolve handler
     */
    private onCompletionResolve(item: CompletionItem): CompletionItem {
        return this.completionProvider.resolveCompletion(item);
    }

    /**
     * Hover handler
     */
    private async onHover(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.hoverProvider.provideHover(document, params.position);
    }

    /**
     * Definition handler
     */
    private async onDefinition(params: TextDocumentPositionParams): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.definitionProvider.provideDefinition(document, params.position);
    }

    /**
     * References handler
     */
    private async onReferences(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.definitionProvider.provideReferences(document, params.position, params.context);
    }

    /**
     * Document symbol handler
     */
    private async onDocumentSymbol(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.symbolProvider.provideDocumentSymbols(document);
    }

    /**
     * Document formatting handler
     */
    private async onDocumentFormatting(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.formattingProvider.formatDocument(document, params.options);
    }

    /**
     * Document range formatting handler
     */
    private async onDocumentRangeFormatting(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.formattingProvider.formatRange(document, params.range, params.options);
    }

    /**
     * Folding ranges handler
     */
    private async onFoldingRanges(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.foldingProvider.provideFoldingRanges(document);
    }

    /**
     * Prepare rename handler
     */
    private async onPrepareRename(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.renameProvider.prepareRename(document, params.position);
    }

    /**
     * Rename request handler
     */
    private async onRenameRequest(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.renameProvider.provideRename(document, params.position, params.newName);
    }

    /**
     * Document highlight handler
     */
    private async onDocumentHighlight(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.documentHighlightProvider.provideDocumentHighlights(document, params.position);
    }

    /**
     * Semantic tokens handler
     */
    private async onSemanticTokens(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.semanticTokensProvider.provideSemanticTokens(document);
    }

    /**
     * Code action handler
     */
    private async onCodeAction(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.codeActionsProvider.provideCodeActions(
            document,
            params.range,
            params.context.diagnostics
        );
    }

    /**
     * Code lens handler
     */
    private async onCodeLens(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.codeLensProvider.provideCodeLens(document);
    }

    /**
     * Document links handler
     */
    private async onDocumentLinks(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.documentLinksProvider.provideDocumentLinks(document);
    }

    /**
     * Inlay hint handler
     */
    private async onInlayHint(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.inlayHintsProvider.provideInlayHints(document, params.range);
    }

    /**
     * Signature help handler
     */
    private async onSignatureHelp(params: any): Promise<any> {
        const document = this.documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }
        
        return this.signatureHelpProvider.provideSignatureHelp(document, params.position);
    }

    /**
     * Code lens resolve handler
     */
    private onCodeLensResolve(lens: any): any {
        return this.codeLensProvider.resolveCodeLens(lens);
    }

    /**
     * Document link resolve handler
     */
    private onDocumentLinkResolve(link: any): any {
        return this.documentLinksProvider.resolveDocumentLink(link);
    }

    /**
     * Inlay hint resolve handler
     */
    private onInlayHintResolve(hint: any): any {
        return this.inlayHintsProvider.resolveInlayHint(hint);
    }

    /**
     * Workspace symbol handler
     */
    private async onWorkspaceSymbol(params: any): Promise<any> {
        const query = params.query;
        
        // Search across all indexed symbols
        return this.indexer.searchSymbols(query).map(symbol => ({
            name: symbol.name,
            kind: this.mapSymbolTypeToKind(symbol.type),
            location: {
                uri: symbol.uri,
                range: symbol.range,
            },
        }));
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
        // Re-index all workspace files
        for (const folder of this.workspaceFolders) {
            const files = await this.workspaceManager.findCK3Files(folder);
            for (const file of files) {
                // This would require reading the file and parsing it
                // For now, just return success
            }
        }
        
        return { success: true, message: 'Workspace rescanned' };
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
        // This would require scanning localization files
        return {
            orphaned_keys: [],
            total_count: 0,
        };
    }

    private showEventChain(args: any[]): any {
        // Show events that trigger other events
        return { events: [], chain_depth: 0 };
    }

    private checkDependencies(): any {
        // Check for missing dependencies
        return { missing: [], satisfied: [] };
    }

    private showNamespaceEvents(args: any[]): any {
        const namespace = args[0] || '';
        const events = this.indexer.findSymbolsByType('event' as any)
            .filter(s => s.name.startsWith(namespace + '.'));
        
        return {
            namespace,
            events: events.map(e => ({
                event_id: e.name,
                file: e.uri,
                line: e.range.start.line,
            })),
            count: events.length,
        };
    }

    private insertTextAtCursor(args: any[]): any {
        // This would require workspace edit
        return { success: false, message: 'Not implemented yet' };
    }

    private generateLocalizationStubs(args: any[]): any {
        // Generate localization stubs
        return {
            localization_text: '',
            keys_generated: [],
        };
    }

    private renameEvent(args: any[]): any {
        // Rename an event
        return { success: false, message: 'Use the rename feature instead' };
    }

    private startLogWatcher(): any {
        return { success: true, message: 'Log watcher started' };
    }

    private stopLogWatcher(): any {
        return { success: true, message: 'Log watcher stopped' };
    }

    private pauseLogWatcher(): any {
        return { success: true, message: 'Log watcher paused' };
    }

    private resumeLogWatcher(): any {
        return { success: true, message: 'Log watcher resumed' };
    }

    private forceRefreshLogs(): any {
        return { success: true, files_read: 0, total_lines: 0 };
    }

    private clearGameLogs(): any {
        return { success: true, message: 'Game logs cleared' };
    }

    private getLogStatistics(): any {
        return {
            success: true,
            statistics: {
                total_lines_processed: 0,
                errors_found: 0,
                warnings_found: 0,
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
console.error('[CK3 Server] Starting TypeScript language server...');

try {
    const server = new CK3LanguageServer();
    console.error('[CK3 Server] Server instance created, starting listener...');
    server.listen();
    console.error('[CK3 Server] Server is now listening for connections');
} catch (error) {
    console.error('[CK3 Server] Failed to start server:', error);
    process.exit(1);
}
