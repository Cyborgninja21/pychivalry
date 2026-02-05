/**
 * Schema-based Symbols - File-type-aware symbol extraction
 * 
 * This module extracts symbols from CK3 files based on schema definitions,
 * making symbol extraction file-type-aware and automatically supporting
 * new file types as schemas are added.
 * 
 * Responsibilities:
 * - Load symbol definitions from schemas for the current file type
 * - Extract symbols from AST based on schema patterns
 * - Provide hierarchical symbol structure
 * - Support nested symbols and symbol kinds
 */

import { DocumentSymbol, SymbolKind, Range } from 'vscode-languageserver';
import { CK3Node } from '../core/parser';
import { SchemaLoader, SchemaDefinition } from './loader';

/**
 * Schema Symbol Extractor extracts symbols based on schema definitions
 */
export class SchemaSymbolExtractor {
    private loader: SchemaLoader;

    constructor(loader: SchemaLoader) {
        this.loader = loader;
    }

    /**
     * Extract symbols from AST based on schema
     */
    public async extractSymbols(filePath: string, ast: CK3Node[]): Promise<DocumentSymbol[]> {
        const schema = await this.getSchemaForFile(filePath);
        if (!schema) {
            return [];
        }

        const symbols: DocumentSymbol[] = [];

        // Get symbol extraction configuration
        const symbolConfig = schema.symbols || {};
        const blockPattern = schema.identification?.block_pattern;

        for (const node of ast) {
            if (this.matchesBlockPattern(node.key, blockPattern)) {
                const symbol = this.createSymbol(node, schema, symbolConfig);
                if (symbol) {
                    symbols.push(symbol);
                }
            }
        }

        return symbols;
    }

    /**
     * Create a symbol from a node
     */
    private createSymbol(
        node: CK3Node,
        schema: SchemaDefinition,
        symbolConfig: any
    ): DocumentSymbol | null {
        // Determine symbol kind based on schema config
        const kind = this.getSymbolKind(node, symbolConfig);

        // Create symbol
        const symbol: DocumentSymbol = {
            name: node.key,
            detail: this.getSymbolDetail(node, schema),
            kind,
            range: node.range,
            selectionRange: node.range,
            children: []
        };

        // Extract nested symbols
        if (symbolConfig.nested) {
            symbol.children = this.extractNestedSymbols(node, schema, symbolConfig.nested);
        }

        return symbol;
    }

    /**
     * Extract nested symbols from a node
     */
    private extractNestedSymbols(
        node: CK3Node,
        schema: SchemaDefinition,
        nestedConfig: any
    ): DocumentSymbol[] {
        const symbols: DocumentSymbol[] = [];

        for (const child of node.children) {
            // Check if this child should be a symbol
            if (nestedConfig.fields && nestedConfig.fields.includes(child.key)) {
                const symbol = this.createNestedSymbol(child, nestedConfig);
                if (symbol) {
                    symbols.push(symbol);
                }
            }

            // Check for pattern-based symbols
            if (nestedConfig.pattern) {
                try {
                    const regex = new RegExp(nestedConfig.pattern);
                    if (regex.test(child.key)) {
                        const symbol = this.createNestedSymbol(child, nestedConfig);
                        if (symbol) {
                            symbols.push(symbol);
                        }
                    }
                } catch (error) {
                    // Invalid regex
                }
            }
        }

        return symbols;
    }

    /**
     * Create a nested symbol
     */
    private createNestedSymbol(node: CK3Node, config: any): DocumentSymbol | null {
        const kind = this.getNestedSymbolKind(node, config);

        return {
            name: node.key,
            detail: node.value ? String(node.value) : '',
            kind,
            range: node.range,
            selectionRange: node.range,
            children: []
        };
    }

    /**
     * Get symbol kind based on node and configuration
     */
    private getSymbolKind(node: CK3Node, config: any): SymbolKind {
        if (config.kind) {
            return this.mapSymbolKind(config.kind);
        }

        // Default kinds based on file type
        const fileName = node.key.toLowerCase();
        if (fileName.includes('event')) {
            return SymbolKind.Event;
        } else if (fileName.includes('decision')) {
            return SymbolKind.Function;
        } else if (fileName.includes('interaction')) {
            return SymbolKind.Interface;
        } else if (fileName.includes('on_action')) {
            return SymbolKind.Event;
        }

        return SymbolKind.Class;
    }

    /**
     * Get nested symbol kind
     */
    private getNestedSymbolKind(node: CK3Node, config: any): SymbolKind {
        // Map common field names to symbol kinds
        const kindMap: Record<string, SymbolKind> = {
            'option': SymbolKind.Method,
            'trigger': SymbolKind.Property,
            'immediate': SymbolKind.Property,
            'after': SymbolKind.Property,
            'effect': SymbolKind.Property,
            'desc': SymbolKind.String,
            'title': SymbolKind.String,
            'name': SymbolKind.String,
        };

        return kindMap[node.key] || SymbolKind.Field;
    }

    /**
     * Map symbol kind string to SymbolKind enum
     */
    private mapSymbolKind(kindStr: string): SymbolKind {
        const kindMap: Record<string, SymbolKind> = {
            'file': SymbolKind.File,
            'module': SymbolKind.Module,
            'namespace': SymbolKind.Namespace,
            'package': SymbolKind.Package,
            'class': SymbolKind.Class,
            'method': SymbolKind.Method,
            'property': SymbolKind.Property,
            'field': SymbolKind.Field,
            'constructor': SymbolKind.Constructor,
            'enum': SymbolKind.Enum,
            'interface': SymbolKind.Interface,
            'function': SymbolKind.Function,
            'variable': SymbolKind.Variable,
            'constant': SymbolKind.Constant,
            'string': SymbolKind.String,
            'number': SymbolKind.Number,
            'boolean': SymbolKind.Boolean,
            'array': SymbolKind.Array,
            'object': SymbolKind.Object,
            'key': SymbolKind.Key,
            'null': SymbolKind.Null,
            'event': SymbolKind.Event,
        };

        return kindMap[kindStr.toLowerCase()] || SymbolKind.Class;
    }

    /**
     * Get symbol detail text
     */
    private getSymbolDetail(node: CK3Node, schema: SchemaDefinition): string {
        const details: string[] = [];

        // Add file type
        if (schema.file_type) {
            details.push(schema.file_type);
        }

        // Add value if present
        if (node.value) {
            details.push(String(node.value));
        }

        return details.join(' - ');
    }

    /**
     * Check if a key matches the block identification pattern
     */
    private matchesBlockPattern(key: string, pattern?: string): boolean {
        if (!pattern) {
            return true;
        }
        try {
            const regex = new RegExp(pattern);
            return regex.test(key);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get schema for file path
     */
    private async getSchemaForFile(filePath: string): Promise<SchemaDefinition | null> {
        const fileName = filePath.toLowerCase();

        if (fileName.includes('/events/') || fileName.includes('\\events\\')) {
            return await this.loader.loadSchema('events');
        } else if (fileName.includes('/decisions/') || fileName.includes('\\decisions\\')) {
            return await this.loader.loadSchema('decisions');
        } else if (fileName.includes('/character_interactions/') || fileName.includes('\\character_interactions\\')) {
            return await this.loader.loadSchema('character_interactions');
        } else if (fileName.includes('/on_actions/') || fileName.includes('\\on_actions\\')) {
            return await this.loader.loadSchema('on_actions');
        } else if (fileName.includes('/story_cycles/') || fileName.includes('\\story_cycles\\')) {
            return await this.loader.loadSchema('story_cycles');
        } else if (fileName.includes('/schemes/') || fileName.includes('\\schemes\\')) {
            return await this.loader.loadSchema('schemes');
        }

        return null;
    }
}
