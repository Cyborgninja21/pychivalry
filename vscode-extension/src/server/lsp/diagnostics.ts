/**
 * Diagnostics Provider - Provides error and warning diagnostics
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ParseError } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { DocumentIndexer } from '../core/indexer';
import { DiagnosticsEngine } from '../ck3/validation/diagnostics';

/**
 * Diagnostics Provider
 */
export class DiagnosticsProvider {
    private diagnosticsEngine: DiagnosticsEngine;
    
    constructor(
        private parser: CK3Parser,
        private schemaLoader: SchemaLoader,
        private indexer: DocumentIndexer
    ) {
        this.diagnosticsEngine = new DiagnosticsEngine({
            enableScopeValidation: true,
            enableSchemaValidation: true,
            enableConventionChecks: true,
            enableLocalizationChecks: false, // Not yet implemented
        });
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
