/**
 * Schema-based Hover - File-type-aware hover documentation provider
 * 
 * This module provides hover documentation based on schema definitions, making hover
 * file-type-aware and automatically supporting new file types as schemas are added.
 * 
 * Responsibilities:
 * - Load field_docs from schemas for the current file type
 * - Convert field documentation to LSP Hover objects
 * - Provide context-appropriate documentation based on cursor position
 * - Generate formatted Markdown documentation
 */

import { Hover, MarkupContent, MarkupKind } from 'vscode-languageserver';
import { SchemaLoader, SchemaDefinition } from './loader';

/**
 * Schema Hover Provider provides hover documentation based on schema field documentation
 */
export class SchemaHoverProvider {
    private loader: SchemaLoader;

    constructor(loader: SchemaLoader) {
        this.loader = loader;
    }

    /**
     * Get hover documentation for a field
     */
    public async getFieldHover(
        filePath: string,
        fieldName: string,
        context?: string
    ): Promise<Hover | null> {
        const schema = await this.getSchemaForFile(filePath);
        if (!schema || !schema.field_docs) {
            return null;
        }

        const fieldDocs = schema.field_docs;
        if (!fieldDocs[fieldName]) {
            return null;
        }

        const docs = fieldDocs[fieldName];
        return this.createHover(fieldName, docs, schema.file_type);
    }

    /**
     * Get hover documentation for a field in a nested schema
     */
    public async getNestedFieldHover(
        filePath: string,
        nestedSchema: string,
        fieldName: string
    ): Promise<Hover | null> {
        const schema = await this.getSchemaForFile(filePath);
        if (!schema || !schema.nested_schemas) {
            return null;
        }

        const nestedSchemas = schema.nested_schemas;
        if (!nestedSchemas[nestedSchema]) {
            return null;
        }

        const nested = nestedSchemas[nestedSchema];
        if (!nested.field_docs || !nested.field_docs[fieldName]) {
            return null;
        }

        const docs = nested.field_docs[fieldName];
        return this.createHover(fieldName, docs, schema.file_type, nestedSchema);
    }

    /**
     * Create a Hover object from field documentation
     */
    private createHover(
        fieldName: string,
        docs: any,
        fileType?: string,
        nestedContext?: string
    ): Hover | null {
        if (!docs) {
            return null;
        }

        const parts: string[] = [];

        // Header with field name and type
        parts.push(`## ${fieldName}`);
        if (docs.type) {
            parts.push(`**Type:** ${docs.type}`);
        }

        // File type and context
        if (fileType) {
            parts.push(`**Context:** ${fileType}${nestedContext ? ' > ' + nestedContext : ''}`);
        }

        // Required indicator
        if (docs.required) {
            parts.push('**Required field**');
        }

        // Description
        if (docs.description) {
            parts.push(`\n${docs.description}`);
        }

        // Default value
        if (docs.default !== undefined) {
            parts.push(`\n**Default:** \`${docs.default}\``);
        }

        // Valid values for enums
        if (docs.values && Array.isArray(docs.values)) {
            parts.push(`\n**Valid values:**`);
            for (const value of docs.values) {
                parts.push(`- \`${value}\``);
            }
        }

        // Cardinality
        if (docs.min_count !== undefined || docs.max_count !== undefined) {
            const min = docs.min_count !== undefined ? docs.min_count : 0;
            const max = docs.max_count !== undefined ? docs.max_count : '∞';
            parts.push(`\n**Cardinality:** ${min}..${max}`);
        }

        // Example
        if (docs.example) {
            parts.push(`\n**Example:**\n\`\`\`ck3\n${docs.example}\n\`\`\``);
        }

        // Warnings
        if (docs.warnings && Array.isArray(docs.warnings)) {
            parts.push(`\n**⚠️ Warnings:**`);
            for (const warning of docs.warnings) {
                parts.push(`- ${warning}`);
            }
        }

        // Related fields
        if (docs.related && Array.isArray(docs.related)) {
            parts.push(`\n**Related fields:** ${docs.related.map((f: string) => `\`${f}\``).join(', ')}`);
        }

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: parts.join('\n')
            }
        };
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
