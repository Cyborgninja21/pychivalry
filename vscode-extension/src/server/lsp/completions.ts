/**
 * Enhanced Completion Provider for CK3 Language Server
 * 
 * Architecture: Strategy pattern with AST traversal and multi-phase analysis
 * Features: Schema-driven suggestions, scope tracking, snippet generation
 */

import {
    CompletionItem,
    CompletionItemKind,
    Position,
    InsertTextFormat,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { DocumentIndexer } from '../core/indexer';
import { SchemaLoader, SchemaField } from '../schema/loader';
import { getDataLoader, EffectDefinition, TriggerDefinition, ScopeDefinition } from '../data/loader';

/**
 * Constants for completion behavior
 */
const EMPTY_DOCUMENT_THRESHOLD = 50; // Characters threshold for template suggestions
const DEFAULT_ROOT_SCOPE = 'character'; // Default scope when unable to infer

/**
 * Represents the analysis result of cursor position in document
 */
class CursorAnalysis {
    lineText: string = '';
    textBeforeCursor: string = '';
    textAfterCursor: string = '';
    fullDocumentText: string = '';
    cursorOffset: number = 0;
    
    // AST information
    astTree: ASTNode | null = null;
    nearestNode: ASTNode | null = null;
    ancestorNodes: ASTNode[] = [];
    
    // Semantic context
    withinBlock: boolean = false;
    blockIdentifier: string | null = null;
    afterAssignmentOp: boolean = false;
    assignmentKey: string | null = null;
    chainedScopeAccess: boolean = false;
    scopeChainParts: string[] = [];
    
    // Document metadata
    documentCategory: string | null = null;
    
    // Already used identifiers in current block
    usedIdentifiers: Set<string> = new Set();
}

/**
 * Completion item builder with fluent API
 */
class CompletionBuilder {
    private item: CompletionItem;
    
    constructor(labelText: string) {
        this.item = {
            label: labelText,
            kind: CompletionItemKind.Text,
        };
    }
    
    withKind(itemKind: CompletionItemKind): CompletionBuilder {
        this.item.kind = itemKind;
        return this;
    }
    
    withDetails(detailText: string): CompletionBuilder {
        this.item.detail = detailText;
        return this;
    }
    
    withMarkdownDocs(markdown: string): CompletionBuilder {
        this.item.documentation = {
            kind: MarkupKind.Markdown,
            value: markdown,
        };
        return this;
    }
    
    withPlainDocs(text: string): CompletionBuilder {
        this.item.documentation = text;
        return this;
    }
    
    withSnippet(snippetText: string): CompletionBuilder {
        this.item.insertText = snippetText;
        this.item.insertTextFormat = InsertTextFormat.Snippet;
        return this;
    }
    
    withPlainInsertion(text: string): CompletionBuilder {
        this.item.insertText = text;
        this.item.insertTextFormat = InsertTextFormat.PlainText;
        return this;
    }
    
    withRanking(rankingKey: string): CompletionBuilder {
        this.item.sortText = rankingKey;
        return this;
    }
    
    withMetadata(metaKey: string, metaValue: any): CompletionBuilder {
        if (!this.item.data) {
            this.item.data = {};
        }
        this.item.data[metaKey] = metaValue;
        return this;
    }
    
    build(): CompletionItem {
        return this.item;
    }
}

/**
 * Strategy interface for different completion generators
 */
interface CompletionStrategy {
    canHandle(analysis: CursorAnalysis): boolean;
    generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]>;
}

/**
 * Template/snippet completion strategy
 */
class TemplateCompletionStrategy implements CompletionStrategy {
    canHandle(analysis: CursorAnalysis): boolean {
        // Handle when document is mostly empty or at root level
        return analysis.fullDocumentText.trim().length < EMPTY_DOCUMENT_THRESHOLD || 
               (!analysis.withinBlock && analysis.ancestorNodes.length <= 1);
    }
    
    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const docPath = document.uri.toLowerCase();
        
        if (docPath.includes('/events/') || docPath.includes('\\events\\')) {
            suggestions.push(this.buildEventTemplate());
            suggestions.push(this.buildEventOptionTemplate());
        }
        
        if (docPath.includes('/decisions/') || docPath.includes('\\decisions\\')) {
            suggestions.push(this.buildDecisionTemplate());
        }
        
        // Universal templates
        suggestions.push(this.buildTriggerBlockTemplate());
        suggestions.push(this.buildEffectBlockTemplate());
        
        return suggestions;
    }
    
    private buildEventTemplate(): CompletionItem {
        return new CompletionBuilder('event_template')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Complete event structure')
            .withSnippet(
                'namespace = ${1:my_namespace}\n\n' +
                '${1:my_namespace}.${2:0001} = {\n' +
                '\ttype = ${3|character_event,letter_event,fullscreen_event|}\n' +
                '\ttitle = ${1:my_namespace}.${2:0001}.t\n' +
                '\tdesc = ${1:my_namespace}.${2:0001}.desc\n' +
                '\ttheme = ${4|court,family,realm,faith,culture|}\n' +
                '\t\n' +
                '\ttrigger = {\n' +
                '\t\t${5:# Trigger conditions}\n' +
                '\t}\n' +
                '\t\n' +
                '\timmediate = {\n' +
                '\t\t${6:# Immediate effects}\n' +
                '\t}\n' +
                '\t\n' +
                '\toption = {\n' +
                '\t\tname = ${1:my_namespace}.${2:0001}.a\n' +
                '\t\t${7:# Option effects}\n' +
                '\t}\n' +
                '}\n'
            )
            .withRanking('0_event_template')
            .build();
    }
    
    private buildEventOptionTemplate(): CompletionItem {
        return new CompletionBuilder('option')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Event option with effects')
            .withSnippet(
                'option = {\n' +
                '\tname = ${1:event_namespace}.${2:event_id}.${3:option_letter}\n' +
                '\t\n' +
                '\ttrigger = {\n' +
                '\t\t${4:# When this option is available}\n' +
                '\t}\n' +
                '\t\n' +
                '\t${5:# Option effects}\n' +
                '}'
            )
            .withRanking('1_option')
            .build();
    }
    
    private buildDecisionTemplate(): CompletionItem {
        return new CompletionBuilder('decision_template')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Complete decision structure')
            .withSnippet(
                '${1:decision_id} = {\n' +
                '\tpicture = "gfx/interface/illustrations/${2:illustration.dds}"\n' +
                '\t\n' +
                '\tis_shown = {\n' +
                '\t\t${3:# When decision is visible}\n' +
                '\t}\n' +
                '\t\n' +
                '\tis_valid = {\n' +
                '\t\t${4:# When decision can be taken}\n' +
                '\t}\n' +
                '\t\n' +
                '\teffect = {\n' +
                '\t\t${5:# Decision effects}\n' +
                '\t}\n' +
                '\t\n' +
                '\tai_potential = {\n' +
                '\t\talways = yes\n' +
                '\t}\n' +
                '\t\n' +
                '\tai_will_do = {\n' +
                '\t\tbase = ${6:100}\n' +
                '\t}\n' +
                '}'
            )
            .withRanking('0_decision_template')
            .build();
    }
    
    private buildTriggerBlockTemplate(): CompletionItem {
        return new CompletionBuilder('trigger')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Trigger condition block')
            .withSnippet('trigger = {\n\t${1:# Conditions}\n}')
            .withRanking('2_trigger_block')
            .build();
    }
    
    private buildEffectBlockTemplate(): CompletionItem {
        return new CompletionBuilder('effect')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Effect execution block')
            .withSnippet('effect = {\n\t${1:# Effects to execute}\n}')
            .withRanking('2_effect_block')
            .build();
    }
}

/**
 * Schema-based field completion strategy
 */
class SchemaFieldStrategy implements CompletionStrategy {
    constructor(private schemaLoader: SchemaLoader) {}
    
    canHandle(analysis: CursorAnalysis): boolean {
        return !analysis.afterAssignmentOp && !analysis.chainedScopeAccess;
    }
    
    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        
        const schemaData = await this.schemaLoader.getSchemaForFile(document.uri);
        if (!schemaData || !schemaData.properties) {
            return suggestions;
        }
        
        const blockKey = analysis.blockIdentifier;
        let relevantFields = schemaData.properties;
        
        // Navigate to nested schema if in specific block
        if (blockKey && schemaData.nested_schemas && schemaData.nested_schemas[blockKey]) {
            const nestedSchema = schemaData.nested_schemas[blockKey];
            if (nestedSchema.field_docs) {
                relevantFields = nestedSchema.field_docs;
            }
        }
        
        for (const [fieldName, fieldInfo] of Object.entries(relevantFields)) {
            const typedField = fieldInfo as SchemaField;
            
            // Skip if already used and not repeatable
            if (analysis.usedIdentifiers.has(fieldName) && typedField.cardinality === '1') {
                continue;
            }
            
            const builder = new CompletionBuilder(fieldName)
                .withKind(this.mapFieldTypeToKind(typedField))
                .withDetails(this.extractFieldType(typedField));
            
            if (typedField.description) {
                builder.withPlainDocs(typedField.description);
            }
            
            // Add ranking based on required/optional
            const rankPrefix = typedField.required ? '0_' : '1_';
            builder.withRanking(rankPrefix + fieldName);
            
            // Generate appropriate insertion text
            builder.withSnippet(this.generateFieldInsertion(fieldName, typedField));
            
            builder.withMetadata('fieldSchema', {
                schemaName: analysis.documentCategory,
                fieldName: fieldName,
            });
            
            suggestions.push(builder.build());
        }
        
        return suggestions;
    }
    
    private mapFieldTypeToKind(field: SchemaField): CompletionItemKind {
        const typeStr = Array.isArray(field.type) ? field.type[0] : field.type;
        
        const typeMapping: Record<string, CompletionItemKind> = {
            'boolean': CompletionItemKind.Value,
            'number': CompletionItemKind.Value,
            'integer': CompletionItemKind.Value,
            'string': CompletionItemKind.Text,
            'object': CompletionItemKind.Class,
            'array': CompletionItemKind.Class,
        };
        
        return typeMapping[typeStr || ''] || CompletionItemKind.Property;
    }
    
    private extractFieldType(field: SchemaField): string {
        if (Array.isArray(field.type)) {
            return field.type.join(' | ');
        }
        return field.type || 'field';
    }
    
    private generateFieldInsertion(fieldName: string, field: SchemaField): string {
        const typeStr = Array.isArray(field.type) ? field.type[0] : field.type;
        
        if (typeStr === 'object' || typeStr === 'array') {
            return `${fieldName} = {\n\t$0\n}`;
        } else if (typeStr === 'boolean') {
            return `${fieldName} = \${1|yes,no|}`;
        } else if (field.enum && field.enum.length > 0) {
            const enumValues = field.enum.map(v => String(v)).join(',');
            return `${fieldName} = \${1|${enumValues}|}`;
        } else {
            return `${fieldName} = $0`;
        }
    }
}

/**
 * Value assignment completion strategy
 */
class ValueAssignmentStrategy implements CompletionStrategy {
    constructor(private schemaLoader: SchemaLoader) {}
    
    canHandle(analysis: CursorAnalysis): boolean {
        return analysis.afterAssignmentOp && analysis.assignmentKey !== null;
    }
    
    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const keyName = analysis.assignmentKey!;
        
        // Check schema for enum values using injected schemaLoader
        const schemaData = await this.schemaLoader.getSchemaForFile(document.uri);
        
        if (schemaData?.properties?.[keyName]) {
            const fieldDef = schemaData.properties[keyName] as SchemaField;
            
            if (fieldDef.enum && Array.isArray(fieldDef.enum)) {
                for (const enumVal of fieldDef.enum) {
                    suggestions.push(
                        new CompletionBuilder(String(enumVal))
                            .withKind(CompletionItemKind.EnumMember)
                            .withDetails('Enum value')
                            .withRanking('0_' + String(enumVal))
                            .build()
                    );
                }
                return suggestions;
            }
            
            if (fieldDef.type === 'boolean') {
                suggestions.push(
                    new CompletionBuilder('yes').withKind(CompletionItemKind.Constant).withRanking('0_yes').build(),
                    new CompletionBuilder('no').withKind(CompletionItemKind.Constant).withRanking('0_no').build()
                );
                return suggestions;
            }
        }
        
        // Contextual value suggestions
        suggestions.push(...this.getContextualValues(keyName, document));
        
        return suggestions;
    }
    
    private getContextualValues(keyName: string, document: TextDocument): CompletionItem[] {
        const results: CompletionItem[] = [];
        const loader = getDataLoader();
        
        const keyHandlers: Record<string, () => CompletionItem[]> = {
            'type': () => this.getEventTypeValues(document),
            'theme': () => this.getThemeValues(),
            'trait': () => this.getTraitValues(loader),
            'animation': () => this.getAnimationValues(),
        };
        
        const handler = keyHandlers[keyName];
        if (handler) {
            return handler();
        }
        
        // Pattern-based heuristics
        if (keyName.match(/^(is|has|can|allow)_/)) {
            results.push(
                new CompletionBuilder('yes').withKind(CompletionItemKind.Constant).withRanking('0_yes').build(),
                new CompletionBuilder('no').withKind(CompletionItemKind.Constant).withRanking('0_no').build()
            );
        }
        
        return results;
    }
    
    private getEventTypeValues(document: TextDocument): CompletionItem[] {
        if (!document.uri.toLowerCase().includes('/events/')) {
            return [];
        }
        
        const types = [
            { val: 'character_event', desc: 'Standard character event' },
            { val: 'letter_event', desc: 'Letter format event' },
            { val: 'fullscreen_event', desc: 'Fullscreen display' },
            { val: 'duel_event', desc: 'Duel interface' },
        ];
        
        return types.map(t => 
            new CompletionBuilder(t.val)
                .withKind(CompletionItemKind.EnumMember)
                .withDetails(t.desc)
                .withRanking('0_' + t.val)
                .build()
        );
    }
    
    private getThemeValues(): CompletionItem[] {
        const themes = ['court', 'family', 'realm', 'war', 'faith', 'culture', 'diplomacy', 'intrigue', 'learning'];
        return themes.map(theme => 
            new CompletionBuilder(theme)
                .withKind(CompletionItemKind.EnumMember)
                .withDetails('Event theme: ' + theme)
                .withRanking('1_' + theme)
                .build()
        );
    }
    
    private getTraitValues(loader: ReturnType<typeof getDataLoader>): CompletionItem[] {
        const traitMap = loader.getTraits();
        const items: CompletionItem[] = [];
        
        for (const [traitId, traitData] of traitMap.entries()) {
            items.push(
                new CompletionBuilder(traitId)
                    .withKind(CompletionItemKind.Value)
                    .withDetails(traitData.name || 'Trait')
                    .withPlainDocs(traitData.category ? `Category: ${traitData.category}` : '')
                    .withRanking('2_' + traitId)
                    .build()
            );
        }
        
        return items;
    }
    
    private getAnimationValues(): CompletionItem[] {
        const animations = [
            'personality_rational', 'personality_honorable', 'personality_bold',
            'worry', 'happiness', 'schadenfreude', 'shock', 'personality_compassionate'
        ];
        
        return animations.map(anim => 
            new CompletionBuilder(anim)
                .withKind(CompletionItemKind.EnumMember)
                .withDetails('Animation type')
                .withRanking('1_' + anim)
                .build()
        );
    }
}

/**
 * Scope chain navigation strategy
 */
class ScopeNavigationStrategy implements CompletionStrategy {
    canHandle(analysis: CursorAnalysis): boolean {
        return analysis.chainedScopeAccess && analysis.scopeChainParts.length > 0;
    }
    
    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const scopeDefinitions = loader.getScopes();
        
        // Determine target scope type from chain
        const targetScopeType = this.resolveScopeChainType(analysis.scopeChainParts, scopeDefinitions);
        
        if (!targetScopeType) {
            return suggestions;
        }
        
        const scopeDef = scopeDefinitions.get(targetScopeType);
        if (!scopeDef || !scopeDef.links) {
            return suggestions;
        }
        
        // Add available scope links
        for (const [linkName, destinationType] of Object.entries(scopeDef.links)) {
            suggestions.push(
                new CompletionBuilder(linkName)
                    .withKind(CompletionItemKind.Reference)
                    .withDetails(`→ ${destinationType}`)
                    .withPlainDocs(`Navigate from ${targetScopeType} to ${destinationType}`)
                    .withRanking('1_' + linkName)
                    .build()
            );
        }
        
        return suggestions;
    }
    
    private resolveScopeChainType(
        chainParts: string[],
        scopeDefs: Map<string, ScopeDefinition>
    ): string | null {
        let currentType: string | null = 'character'; // Default starting scope
        
        for (const part of chainParts) {
            if (part === 'root' || part === 'this' || part === 'prev') {
                continue; // These don't change type predictably
            }
            
            let found = false;
            for (const [scopeType, scopeInfo] of scopeDefs.entries()) {
                if (scopeInfo.links && scopeInfo.links[part]) {
                    currentType = scopeInfo.links[part];
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                return null; // Can't resolve further
            }
        }
        
        return currentType;
    }
}

/**
 * Effect command completion strategy
 */
class EffectCommandStrategy implements CompletionStrategy {
    canHandle(analysis: CursorAnalysis): boolean {
        // Trigger in effect blocks or immediate blocks
        return analysis.blockIdentifier === 'effect' ||
               analysis.blockIdentifier === 'immediate' ||
               analysis.blockIdentifier?.includes('effect') ||
               false;
    }
    
    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const effectMap = loader.getEffects();
        
        const inferredScope = this.inferCurrentScope(analysis);
        
        for (const [effectName, effectData] of effectMap.entries()) {
            // Filter by scope compatibility
            if (effectData.scope && inferredScope && effectData.scope !== 'any') {
                if (!this.areScopesCompatible(inferredScope, effectData.scope)) {
                    continue;
                }
            }
            
            const ranking = this.calculateEffectRanking(effectName, effectData);
            
            const builder = new CompletionBuilder(effectName)
                .withKind(CompletionItemKind.Function)
                .withDetails(effectData.scope ? `[${effectData.scope}] Effect` : 'Effect')
                .withPlainInsertion(effectName + ' = ')
                .withRanking(ranking)
                .withMetadata('effectName', effectName);
            
            if (effectData.description) {
                let docs = effectData.description;
                if (effectData.scope) {
                    docs += `\n\n**Scope:** ${effectData.scope}`;
                }
                if (effectData.target_scope) {
                    docs += `\n**Result Scope:** ${effectData.target_scope}`;
                }
                builder.withMarkdownDocs(docs);
            }
            
            suggestions.push(builder.build());
        }
        
        return suggestions;
    }
    
    private inferCurrentScope(analysis: CursorAnalysis): string | null {
        // Try to infer from document type first
        if (analysis.documentCategory === 'character_interactions') {
            return 'character';
        }
        if (analysis.documentCategory === 'on_actions') {
            return 'character'; // Most on_actions are character scope
        }
        
        // Check ancestor nodes for scope hints
        for (const ancestor of analysis.ancestorNodes) {
            if (ancestor.key && ancestor.key.includes('character')) {
                return 'character';
            }
            if (ancestor.key && ancestor.key.includes('title')) {
                return 'title';
            }
        }
        
        // Fallback to default
        return DEFAULT_ROOT_SCOPE;
    }
    
    private areScopesCompatible(current: string, required: string): boolean {
        if (required === 'any') return true;
        if (current === required) return true;
        
        // Add specific compatibility rules here
        const compatibilityMap: Record<string, string[]> = {
            'character': ['character', 'any'],
            'title': ['title', 'any'],
            'province': ['province', 'any'],
        };
        
        return compatibilityMap[current]?.includes(required) || false;
    }
    
    private calculateEffectRanking(effectName: string, effectData: EffectDefinition): string {
        // Common effects get better ranking
        const commonEffects = new Set([
            'add_gold', 'add_prestige', 'add_piety', 'add_trait', 'remove_trait',
            'trigger_event', 'save_scope_as', 'set_variable'
        ]);
        
        if (commonEffects.has(effectName)) {
            return '1_' + effectName;
        }
        
        return '2_' + effectName;
    }
}

/**
 * Trigger condition completion strategy
 */
class TriggerConditionStrategy implements CompletionStrategy {
    canHandle(analysis: CursorAnalysis): boolean {
        return analysis.blockIdentifier === 'trigger' ||
               analysis.blockIdentifier === 'is_shown' ||
               analysis.blockIdentifier === 'is_valid' ||
               analysis.blockIdentifier?.includes('trigger') ||
               false;
    }
    
    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const triggerMap = loader.getTriggers();
        
        const inferredScope = this.inferCurrentScope(analysis);
        
        for (const [triggerName, triggerData] of triggerMap.entries()) {
            if (triggerData.scope && inferredScope && triggerData.scope !== 'any') {
                if (!this.areScopesCompatible(inferredScope, triggerData.scope)) {
                    continue;
                }
            }
            
            const ranking = this.calculateTriggerRanking(triggerName);
            
            const builder = new CompletionBuilder(triggerName)
                .withKind(CompletionItemKind.Function)
                .withDetails(triggerData.scope ? `[${triggerData.scope}] Trigger` : 'Trigger')
                .withPlainInsertion(triggerName + ' = ')
                .withRanking(ranking)
                .withMetadata('triggerName', triggerName);
            
            if (triggerData.description) {
                let docs = triggerData.description;
                if (triggerData.scope) {
                    docs += `\n\n**Scope:** ${triggerData.scope}`;
                }
                if (triggerData.return_type) {
                    docs += `\n**Returns:** ${triggerData.return_type}`;
                }
                builder.withMarkdownDocs(docs);
            }
            
            suggestions.push(builder.build());
        }
        
        return suggestions;
    }
    
    private inferCurrentScope(analysis: CursorAnalysis): string | null {
        for (const ancestor of analysis.ancestorNodes) {
            if (ancestor.key && ancestor.key.includes('character')) {
                return 'character';
            }
        }
        return 'character';
    }
    
    private areScopesCompatible(current: string, required: string): boolean {
        if (required === 'any') return true;
        return current === required;
    }
    
    private calculateTriggerRanking(triggerName: string): string {
        const commonTriggers = new Set([
            'has_trait', 'is_alive', 'age', 'has_title', 'gold', 'prestige', 'piety'
        ]);
        
        if (commonTriggers.has(triggerName)) {
            return '1_' + triggerName;
        }
        
        return '2_' + triggerName;
    }
}

/**
 * Main enhanced completion provider
 */
export class CompletionProvider {
    private strategies: CompletionStrategy[];
    private documentAnalysisCache: WeakMap<TextDocument, Map<number, CursorAnalysis>> = new WeakMap();
    
    constructor(
        private parser: CK3Parser,
        private indexer: DocumentIndexer,
        private schemaLoader: SchemaLoader
    ) {
        // Initialize strategy pipeline with dependencies
        this.strategies = [
            new TemplateCompletionStrategy(),
            new SchemaFieldStrategy(schemaLoader),
            new ValueAssignmentStrategy(schemaLoader),
            new ScopeNavigationStrategy(),
            new EffectCommandStrategy(),
            new TriggerConditionStrategy(),
        ];
    }
    
    /**
     * Main entry point for completion requests
     */
    public async provideCompletions(document: TextDocument, position: Position): Promise<CompletionItem[]> {
        try {
            // Analyze cursor position
            const analysis = await this.analyzeCursorPosition(document, position);
            
            // Collect completions from all applicable strategies
            const allCompletions: CompletionItem[] = [];
            
            for (const strategy of this.strategies) {
                if (strategy.canHandle(analysis)) {
                    const strategyResults = await strategy.generateSuggestions(analysis, document);
                    allCompletions.push(...strategyResults);
                }
            }
            
            // Sort by ranking
            allCompletions.sort((a, b) => {
                const rankA = a.sortText || a.label;
                const rankB = b.sortText || b.label;
                return rankA.localeCompare(rankB);
            });
            
            return allCompletions;
            
        } catch (error) {
            console.error('Completion generation error:', error);
            return [];
        }
    }
    
    /**
     * Resolve completion item with additional details (lazy loading)
     */
    public async resolveCompletion(item: CompletionItem): Promise<CompletionItem> {
        if (!item.data) {
            return item;
        }
        
        try {
            const loader = getDataLoader();
            
            // Handle effect documentation
            if (item.data.effectName) {
                const effectMap = loader.getEffects();
                const effectInfo = effectMap.get(item.data.effectName);
                
                if (effectInfo && effectInfo.examples && effectInfo.examples.length > 0) {
                    const currentDocs = typeof item.documentation === 'string' 
                        ? item.documentation 
                        : item.documentation?.value || '';
                    
                    const exampleText = `\n\n**Example:**\n\`\`\`ck3\n${effectInfo.examples[0]}\n\`\`\``;
                    
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: currentDocs + exampleText,
                    };
                }
            }
            
            // Handle trigger documentation
            if (item.data.triggerName) {
                const triggerMap = loader.getTriggers();
                const triggerInfo = triggerMap.get(item.data.triggerName);
                
                if (triggerInfo && triggerInfo.examples && triggerInfo.examples.length > 0) {
                    const currentDocs = typeof item.documentation === 'string'
                        ? item.documentation
                        : item.documentation?.value || '';
                    
                    const exampleText = `\n\n**Example:**\n\`\`\`ck3\n${triggerInfo.examples[0]}\n\`\`\``;
                    
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: currentDocs + exampleText,
                    };
                }
            }
            
            // Handle schema field documentation
            if (item.data.fieldSchema) {
                const { schemaName, fieldName } = item.data.fieldSchema;
                const schema = await this.schemaLoader.loadSchema(schemaName);
                
                if (schema?.properties?.[fieldName]) {
                    const field = schema.properties[fieldName] as SchemaField;
                    
                    if (field.description && !item.documentation) {
                        item.documentation = field.description;
                    }
                }
            }
            
        } catch (error) {
            console.error('Error resolving completion:', error);
        }
        
        return item;
    }
    
    /**
     * Analyze cursor position and build comprehensive context
     */
    private async analyzeCursorPosition(document: TextDocument, position: Position): Promise<CursorAnalysis> {
        const analysis = new CursorAnalysis();
        
        // Extract text segments
        analysis.fullDocumentText = document.getText();
        analysis.lineText = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line + 1, character: 0 },
        });
        analysis.textBeforeCursor = analysis.lineText.substring(0, position.character);
        analysis.textAfterCursor = analysis.lineText.substring(position.character);
        analysis.cursorOffset = document.offsetAt(position);
        
        // Parse AST
        const parseResult = this.parser.parse(analysis.fullDocumentText);
        analysis.astTree = parseResult.ast;
        
        // Find node at cursor
        analysis.nearestNode = this.locateNodeAtOffset(parseResult.ast, analysis.cursorOffset);
        
        // Build ancestor chain
        analysis.ancestorNodes = this.buildAncestorChain(parseResult.ast, analysis.nearestNode);
        
        // Analyze semantic context
        this.analyzeSemanticContext(analysis);
        
        // Determine document category
        analysis.documentCategory = this.categorizeDocument(document.uri);
        
        // Extract used identifiers in current block
        if (analysis.nearestNode && analysis.nearestNode.type === NodeType.BLOCK) {
            analysis.usedIdentifiers = this.extractUsedKeys(analysis.nearestNode);
        }
        
        return analysis;
    }
    
    /**
     * Locate AST node at specific offset
     */
    private locateNodeAtOffset(root: ASTNode, offset: number): ASTNode | null {
        if (!root.range) {
            return null;
        }
        
        // Simple offset comparison (would need proper offset calculation in production)
        const nodeStart = root.range.start;
        const nodeEnd = root.range.end;
        
        // Check if offset is within this node
        const withinNode = this.isOffsetInRange(offset, nodeStart, nodeEnd);
        
        if (!withinNode) {
            return null;
        }
        
        // Check children for more specific match
        if (root.children) {
            for (const child of root.children) {
                const childMatch = this.locateNodeAtOffset(child, offset);
                if (childMatch) {
                    return childMatch;
                }
            }
        }
        
        return root;
    }
    
    private isOffsetInRange(offset: number, start: Position, end: Position): boolean {
        // Convert positions to offsets for comparison
        // Note: This is a simplified implementation
        // In production, would need document reference to calculate actual offsets
        
        // Basic line/character comparison
        const startLine = start.line;
        const endLine = end.line;
        const startChar = start.character;
        const endChar = end.character;
        
        // For now, return true to maintain functionality
        // TODO: Implement proper offset calculation with document reference
        return true;
    }
    
    /**
     * Build chain of ancestor nodes
     */
    private buildAncestorChain(root: ASTNode, target: ASTNode | null): ASTNode[] {
        if (!target) {
            return [];
        }
        
        const chain: ASTNode[] = [];
        this.collectAncestors(root, target, chain);
        return chain;
    }
    
    private collectAncestors(node: ASTNode, target: ASTNode, accumulator: ASTNode[]): boolean {
        if (node === target) {
            accumulator.unshift(node);
            return true;
        }
        
        if (node.children) {
            for (const child of node.children) {
                if (this.collectAncestors(child, target, accumulator)) {
                    accumulator.unshift(node);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Analyze semantic context from text and AST
     */
    private analyzeSemanticContext(analysis: CursorAnalysis): void {
        const beforeText = analysis.textBeforeCursor;
        
        // Check for assignment operators
        const assignmentMatch = beforeText.match(/(\w+)\s*=\s*$/);
        if (assignmentMatch) {
            analysis.afterAssignmentOp = true;
            analysis.assignmentKey = assignmentMatch[1];
        }
        
        // Check for scope chain
        const scopeChainMatch = beforeText.match(/([\w:]+(?:\.[\w:]*)+)$/);
        if (scopeChainMatch) {
            analysis.chainedScopeAccess = true;
            analysis.scopeChainParts = scopeChainMatch[1].split('.');
        }
        
        // Determine block context
        for (let i = analysis.ancestorNodes.length - 1; i >= 0; i--) {
            const ancestor = analysis.ancestorNodes[i];
            if (ancestor.key) {
                analysis.withinBlock = true;
                analysis.blockIdentifier = ancestor.key;
                break;
            }
        }
    }
    
    /**
     * Categorize document by file path
     */
    private categorizeDocument(uri: string): string | null {
        const lowerUri = uri.toLowerCase();
        
        if (lowerUri.includes('/events/') || lowerUri.includes('\\events\\')) {
            return 'events';
        }
        if (lowerUri.includes('/decisions/') || lowerUri.includes('\\decisions\\')) {
            return 'decisions';
        }
        if (lowerUri.includes('/character_interactions/')) {
            return 'character_interactions';
        }
        if (lowerUri.includes('/on_actions/')) {
            return 'on_actions';
        }
        
        return null;
    }
    
    /**
     * Extract already-used keys in a block
     */
    private extractUsedKeys(blockNode: ASTNode): Set<string> {
        const keys = new Set<string>();
        
        if (blockNode.children) {
            for (const child of blockNode.children) {
                if (child.key) {
                    keys.add(child.key);
                }
            }
        }
        
        return keys;
    }
}
