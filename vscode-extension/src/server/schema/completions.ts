/**
 * Schema-based Completions - File-type-aware completion provider
 * 
 * This module provides completions based on schema definitions, making completions
 * file-type-aware and automatically supporting new file types as schemas are added.
 * 
 * Responsibilities:
 * - Load field_docs from schemas for the current file type
 * - Convert field documentation to LSP CompletionItem objects
 * - Provide context-appropriate completions based on cursor position
 * - Generate snippets with proper formatting and placeholders
 */

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupContent,
    MarkupKind,
} from 'vscode-languageserver';
import { SchemaLoader, SchemaDefinition } from './loader';

/**
 * Schema Completion Provider provides completions based on schema field documentation
 */
export class SchemaCompletionProvider {
    private loader: SchemaLoader;

    constructor(loader: SchemaLoader) {
        this.loader = loader;
    }

    /**
     * Get completions for fields in the given file type
     */
    public async getFieldCompletions(
        filePath: string,
        context?: string
    ): Promise<CompletionItem[]> {
        const schema = await this.getSchemaForFile(filePath);
        if (!schema || !schema.field_docs) {
            return [];
        }

        const completions: CompletionItem[] = [];
        const fieldDocs = schema.field_docs;

        for (const [fieldName, docs] of Object.entries(fieldDocs)) {
            const completion = this.createCompletionItem(fieldName, docs);
            if (completion) {
                completions.push(completion);
            }
        }

        return completions;
    }

    /**
     * Get completions for fields in a nested schema
     */
    public async getNestedFieldCompletions(
        filePath: string,
        nestedSchema: string
    ): Promise<CompletionItem[]> {
        const schema = await this.getSchemaForFile(filePath);
        if (!schema || !schema.nested_schemas) {
            return [];
        }

        const nestedSchemas = schema.nested_schemas;
        if (!nestedSchemas[nestedSchema]) {
            return [];
        }

        const nested = nestedSchemas[nestedSchema];
        if (!nested.field_docs) {
            return [];
        }

        const completions: CompletionItem[] = [];
        for (const [fieldName, docs] of Object.entries(nested.field_docs)) {
            const completion = this.createCompletionItem(fieldName, docs);
            if (completion) {
                completions.push(completion);
            }
        }

        return completions;
    }

    /**
     * Get all completions for a file (both top-level and nested)
     */
    public async getAllCompletions(filePath: string): Promise<CompletionItem[]> {
        const schema = await this.getSchemaForFile(filePath);
        if (!schema) {
            return [];
        }

        const completions: CompletionItem[] = [];

        // Add top-level field completions
        completions.push(...await this.getFieldCompletions(filePath));

        // Add nested schema completions
        if (schema.nested_schemas) {
            for (const nestedSchemaName of Object.keys(schema.nested_schemas)) {
                completions.push(
                    ...await this.getNestedFieldCompletions(filePath, nestedSchemaName)
                );
            }
        }

        return completions;
    }

    /**
     * Create a completion item from field documentation
     */
    private createCompletionItem(fieldName: string, docs: any): CompletionItem | null {
        if (!docs) {
            return null;
        }

        const item: CompletionItem = {
            label: fieldName,
            kind: this.getCompletionKind(docs.type),
            detail: docs.type || 'field',
            documentation: this.createDocumentation(docs),
            insertText: this.createInsertText(fieldName, docs),
            insertTextFormat: docs.snippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
            sortText: docs.common ? '0' + fieldName : '1' + fieldName, // Prioritize common fields
        };

        return item;
    }

    /**
     * Get completion kind based on field type
     */
    private getCompletionKind(type?: string): CompletionItemKind {
        if (!type) {
            return CompletionItemKind.Field;
        }

        const typeMap: Record<string, CompletionItemKind> = {
            'boolean': CompletionItemKind.Value,
            'number': CompletionItemKind.Value,
            'string': CompletionItemKind.Text,
            'enum': CompletionItemKind.Enum,
            'block': CompletionItemKind.Class,
            'list': CompletionItemKind.Class,
        };

        return typeMap[type] || CompletionItemKind.Field;
    }

    /**
     * Create documentation for completion
     */
    private createDocumentation(docs: any): MarkupContent | string {
        if (!docs.description && !docs.example) {
            return '';
        }

        const parts: string[] = [];

        if (docs.description) {
            parts.push(docs.description);
        }

        if (docs.required) {
            parts.push('\n**Required**');
        }

        if (docs.default) {
            parts.push(`\n**Default:** ${docs.default}`);
        }

        if (docs.values && Array.isArray(docs.values)) {
            parts.push(`\n**Valid values:** ${docs.values.join(', ')}`);
        }

        if (docs.example) {
            parts.push(`\n**Example:**\n\`\`\`ck3\n${docs.example}\n\`\`\``);
        }

        return {
            kind: MarkupKind.Markdown,
            value: parts.join('\n')
        };
    }

    /**
     * Create insert text for completion
     */
    private createInsertText(fieldName: string, docs: any): string {
        if (docs.snippet) {
            return docs.snippet;
        }

        // Default snippets based on field type
        if (docs.type === 'block') {
            return `${fieldName} = {\n\t$0\n}`;
        } else if (docs.type === 'boolean') {
            return `${fieldName} = \${1|yes,no|}`;
        } else if (docs.type === 'enum' && docs.values) {
            const values = docs.values.join(',');
            return `${fieldName} = \${1|${values}|}`;
        } else {
            return `${fieldName} = $0`;
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
