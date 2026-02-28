/**
 * Diagnostics Provider - Provides error and warning diagnostics
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ParseError } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { DocumentIndexer } from '../core/indexer';
import { LocalizationIndex } from '../core/localization-index';
import { DiagnosticsEngine } from '../ck3/validation/diagnostics';

/**
 * Default diagnostics config used in both constructor and updateWorkspaceRoots
 */
const DEFAULT_DIAG_FLAGS = {
    enableScopeValidation: true,
    enableSchemaValidation: true,
    enableConventionChecks: true,
    enableLocalizationChecks: true,
    enableParadoxChecks: true,
    enableVariableChecks: true,
    enableTraitChecks: true,
    enableScriptedBlockChecks: true,
    enableGenericRules: true,
    enableAssetChecks: true,
    enableStoryCycleChecks: true,
    enableScriptValueChecks: true,
    enableLocalizationValidation: true,
};

/**
 * Diagnostics Provider
 */
export class DiagnosticsProvider {
    private diagnosticsEngine: DiagnosticsEngine;
    private knownAssetsSupplier?: () => Set<string>;
    private localizationIndex?: LocalizationIndex;

    constructor(
        private parser: CK3Parser,
        private schemaLoader: SchemaLoader,
        private indexer: DocumentIndexer,
        workspaceRoots: string[] = [],
        knownAssetsSupplier?: () => Set<string>,
        localizationIndex?: LocalizationIndex,
    ) {
        this.knownAssetsSupplier = knownAssetsSupplier;
        this.localizationIndex = localizationIndex;
        this.diagnosticsEngine = new DiagnosticsEngine({
            ...DEFAULT_DIAG_FLAGS,
            workspaceRoots,
            knownAssets: knownAssetsSupplier?.(),
        }, schemaLoader, indexer, localizationIndex);
    }

    /**
     * Update workspace roots for asset validation
     */
    public updateWorkspaceRoots(roots: string[]): void {
        this.diagnosticsEngine = new DiagnosticsEngine({
            ...DEFAULT_DIAG_FLAGS,
            workspaceRoots: roots,
            knownAssets: this.knownAssetsSupplier?.(),
        }, this.schemaLoader, this.indexer, this.localizationIndex);
    }

    /**
     * Provide diagnostics for a document
     */
    public async provideDiagnostics(document: TextDocument): Promise<Diagnostic[]> {
        // Parse document
        const parsed = this.parser.parse(document.getText());

        // Use the comprehensive diagnostics engine
        const diagnostics = await this.diagnosticsEngine.collectDiagnostics(
            document,
            [parsed.ast],
            parsed.errors
        );

        return diagnostics;
    }

    /**
     * Validate document against schema
     */
    private async validateSchema(document: TextDocument, ast: any): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        // Get schema for document
        const schema = await this.schemaLoader.getSchemaForFile(document.uri);

        if (!schema) {
            return diagnostics;
        }

        // Validate against schema
        // This would be a more complex validation in the full implementation

        return diagnostics;
    }
}
