/**
 * Completion Provider - Provides context-aware auto-completion
 */

import {
    CompletionItem,
    CompletionItemKind,
    Position,
    InsertTextFormat,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode } from '../core/parser';
import { DocumentIndexer, SymbolType } from '../core/indexer';
import { SchemaLoader } from '../schema/loader';
import { CK3Language } from '../ck3/language';
import { getDataLoader } from '../data/loader';

/**
 * Completion Provider
 */
export class CompletionProvider {
    constructor(
        private parser: CK3Parser,
        private indexer: DocumentIndexer,
        private schemaLoader: SchemaLoader
    ) {}

    /**
     * Provide completions at a given position
     */
    public async provideCompletions(document: TextDocument, position: Position): Promise<CompletionItem[]> {
        const completions: CompletionItem[] = [];
        
        // Get text up to cursor
        const text = document.getText({
            start: { line: 0, character: 0 },
            end: position,
        });
        
        // Determine context
        const context = this.determineContext(text, position);
        
        // Provide completions based on context
        switch (context.type) {
            case 'key':
                completions.push(...await this.provideKeyCompletions(document, context));
                break;
            case 'value':
                completions.push(...await this.provideValueCompletions(document, context));
                break;
            case 'scope':
                completions.push(...this.provideScopeCompletions(context));
                break;
            case 'effect':
                completions.push(...this.provideEffectCompletions(context));
                break;
            case 'trigger':
                completions.push(...this.provideTriggerCompletions(context));
                break;
        }
        
        return completions;
    }

    /**
     * Resolve additional details for a completion item
     */
    public resolveCompletion(item: CompletionItem): CompletionItem {
        // Add documentation and detail if not already present
        return item;
    }

    /**
     * Determine completion context from text
     */
    private determineContext(text: string, position: Position): {
        type: 'key' | 'value' | 'scope' | 'effect' | 'trigger';
        key?: string;
        parent?: string;
    } {
        const lines = text.split('\n');
        const currentLine = lines[position.line] || '';
        const beforeCursor = currentLine.substring(0, position.character);
        
        // Check if we're after an equals sign (value context)
        if (beforeCursor.includes('=') && !beforeCursor.trim().endsWith('}')) {
            const key = beforeCursor.split('=')[0].trim();
            return { type: 'value', key };
        }
        
        // Check if we're in a scope context (after a dot)
        if (beforeCursor.includes('.')) {
            return { type: 'scope' };
        }
        
        // Check if we're in an effect/trigger context
        // This would require parsing the parent blocks to determine if we're
        // inside a trigger = { } or effect = { } block
        
        // Default to key context
        return { type: 'key' };
    }

    /**
     * Provide key completions
     */
    private async provideKeyCompletions(document: TextDocument, context: any): Promise<CompletionItem[]> {
        const completions: CompletionItem[] = [];
        
        // Get schema for document
        const schema = await this.schemaLoader.getSchemaForFile(document.uri);
        
        if (schema && schema.properties) {
            for (const [key, field] of Object.entries(schema.properties)) {
                const fieldDef = field as any;
                completions.push({
                    label: key,
                    kind: CompletionItemKind.Property,
                    detail: fieldDef.description || '',
                    documentation: fieldDef.description,
                    insertText: key,
                });
            }
        }
        
        // Add CK3 effects
        completions.push(...this.provideEffectCompletions(context));
        
        // Add CK3 triggers
        completions.push(...this.provideTriggerCompletions(context));
        
        return completions;
    }

    /**
     * Provide value completions
     */
    private async provideValueCompletions(document: TextDocument, context: any): Promise<CompletionItem[]> {
        const completions: CompletionItem[] = [];
        const key = context.key;
        
        if (!key) return completions;
        
        // Get schema for document
        const schema = await this.schemaLoader.getSchemaForFile(document.uri);
        
        if (schema && schema.properties && schema.properties[key]) {
            const field = schema.properties[key] as any;
            
            // If field has enum, provide enum values
            if (field.enum && Array.isArray(field.enum)) {
                for (const value of field.enum) {
                    completions.push({
                        label: String(value),
                        kind: CompletionItemKind.EnumMember,
                        insertText: String(value),
                        detail: field.description || '',
                    });
                }
            }
        }
        
        // Context-specific completions
        switch (key) {
            case 'type':
                // Provide event types
                completions.push(
                    { label: 'character_event', kind: CompletionItemKind.EnumMember },
                    { label: 'letter_event', kind: CompletionItemKind.EnumMember },
                    { label: 'duel_event', kind: CompletionItemKind.EnumMember }
                );
                break;
            case 'theme':
                // Provide event themes
                completions.push(
                    { label: 'court', kind: CompletionItemKind.EnumMember },
                    { label: 'family', kind: CompletionItemKind.EnumMember },
                    { label: 'realm', kind: CompletionItemKind.EnumMember }
                );
                break;
            case 'trait':
                // Provide traits from YAML data files
                const dataLoader = getDataLoader();
                const traits = dataLoader.getTraits();
                for (const [traitId, trait] of traits.entries()) {
                    completions.push({
                        label: traitId,
                        kind: CompletionItemKind.Value,
                        detail: trait.name || 'Trait',
                        documentation: trait.category ? `Category: ${trait.category}` : undefined,
                    });
                }
                break;
        }
        
        // Boolean values (heuristic-based pattern matching)
        // Note: This is a best-effort approach and may produce false positives
        // for custom keys. Consider refining based on schema information.
        if (key.startsWith('is_') || key.startsWith('can_') || key.startsWith('has_')) {
            completions.push(
                { label: 'yes', kind: CompletionItemKind.Value },
                { label: 'no', kind: CompletionItemKind.Value }
            );
        }
        
        return completions;
    }

    /**
     * Provide scope completions
     */
    private provideScopeCompletions(context: any): CompletionItem[] {
        const completions: CompletionItem[] = [];
        
        // Provide scope accessors
        const scopes = [
            'root', 'prev', 'this', 'scope:name',
            'liege', 'primary_title', 'capital_county',
            'father', 'mother', 'primary_heir',
            'spouse', 'faith', 'culture', 'house',
        ];
        
        for (const scope of scopes) {
            completions.push({
                label: scope,
                kind: CompletionItemKind.Reference,
                detail: 'Scope accessor',
            });
        }
        
        return completions;
    }

    /**
     * Provide effect completions
     */
    private provideEffectCompletions(context: any): CompletionItem[] {
        const completions: CompletionItem[] = [];
        
        // Load effects from YAML data files
        const dataLoader = getDataLoader();
        const effects = dataLoader.getEffects();
        
        for (const [name, effect] of effects.entries()) {
            completions.push({
                label: name,
                kind: CompletionItemKind.Function,
                detail: effect.description || 'Effect',
                documentation: effect.description + (effect.scope ? `\n\nScope: ${effect.scope}` : ''),
                insertText: name + ' = ',
                insertTextFormat: InsertTextFormat.PlainText,
            });
        }
        
        return completions;
    }

    /**
     * Provide trigger completions
     */
    private provideTriggerCompletions(context: any): CompletionItem[] {
        const completions: CompletionItem[] = [];
        
        // Load triggers from YAML data files
        const dataLoader = getDataLoader();
        const triggers = dataLoader.getTriggers();
        
        for (const [name, trigger] of triggers.entries()) {
            completions.push({
                label: name,
                kind: CompletionItemKind.Function,
                detail: trigger.description || 'Trigger',
                documentation: trigger.description + (trigger.scope ? `\n\nScope: ${trigger.scope}` : ''),
                insertText: name + ' = ',
                insertTextFormat: InsertTextFormat.PlainText,
            });
        }
        
        return completions;
    }
}
