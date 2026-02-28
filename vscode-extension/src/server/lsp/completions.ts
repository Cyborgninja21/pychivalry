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
import { DocumentIndexer, SymbolType } from '../core/indexer';
import { SchemaLoader, SchemaField } from '../schema/loader';
import { getDataLoader, EffectDefinition, TriggerDefinition, ScopeDefinition, OnActionDefinition, InteractionHookDefinition } from '../data/loader';
import { getTargetScopeType, getListResultScope, parseListIterator } from '../ck3/validation/scopes';
import { DirectoryRegistry } from '../data/directory-registry';
import { classifyContext } from '../ck3/validation/context-engine';
import { serverLogger } from '../utils/logger';
import { ModScanner, ModDataItem } from '../data/mod-scanner';

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

    // Scope context
    currentScopeType: string = DEFAULT_ROOT_SCOPE;

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

        if (docPath.includes('/story_cycles/') || docPath.includes('\\story_cycles\\')) {
            suggestions.push(this.buildStoryCycleTemplate());
            suggestions.push(this.buildEffectGroupTemplate());
            suggestions.push(this.buildTriggeredEffectTemplate());
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

    private buildStoryCycleTemplate(): CompletionItem {
        return new CompletionBuilder('story_cycle_template')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Complete story cycle structure')
            .withSnippet(
                '${1:my_story_cycle} = {\n' +
                '\ton_setup = {\n' +
                '\t\t${2:# Setup effects when story starts}\n' +
                '\t}\n' +
                '\t\n' +
                '\ton_end = {\n' +
                '\t\t${3:# Cleanup effects when story ends}\n' +
                '\t}\n' +
                '\t\n' +
                '\ton_owner_death = {\n' +
                '\t\tend_story = yes\n' +
                '\t}\n' +
                '\t\n' +
                '\teffect_group = {\n' +
                '\t\tdays = { ${4:30} ${5:60} }\n' +
                '\t\ttriggered_effect = {\n' +
                '\t\t\ttrigger = {\n' +
                '\t\t\t\t${6:# Conditions}\n' +
                '\t\t\t}\n' +
                '\t\t\teffect = {\n' +
                '\t\t\t\t${7:# Effects}\n' +
                '\t\t\t}\n' +
                '\t\t}\n' +
                '\t}\n' +
                '}'
            )
            .withRanking('0_story_cycle')
            .build();
    }

    private buildEffectGroupTemplate(): CompletionItem {
        return new CompletionBuilder('effect_group')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Timed effect group for story cycles')
            .withSnippet(
                'effect_group = {\n' +
                '\tdays = { ${1:30} ${2:90} }\n' +
                '\ttriggered_effect = {\n' +
                '\t\ttrigger = {\n' +
                '\t\t\t${3:# Conditions}\n' +
                '\t\t}\n' +
                '\t\teffect = {\n' +
                '\t\t\t${4:# Effects}\n' +
                '\t\t}\n' +
                '\t}\n' +
                '}'
            )
            .withRanking('1_effect_group')
            .build();
    }

    private buildTriggeredEffectTemplate(): CompletionItem {
        return new CompletionBuilder('triggered_effect')
            .withKind(CompletionItemKind.Snippet)
            .withDetails('Conditional effect in effect group')
            .withSnippet(
                'triggered_effect = {\n' +
                '\ttrigger = {\n' +
                '\t\t${1:# Conditions}\n' +
                '\t}\n' +
                '\teffect = {\n' +
                '\t\t${2:# Effects}\n' +
                '\t}\n' +
                '}'
            )
            .withRanking('1_triggered_effect')
            .build();
    }
}

/**
 * Schema-based field completion strategy
 */
class SchemaFieldStrategy implements CompletionStrategy {
    constructor(private schemaLoader: SchemaLoader) { }

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
    constructor(private schemaLoader: SchemaLoader) { }

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

        // Determine target scope type from chain, starting from the inferred scope
        const targetScopeType = this.resolveScopeChainType(analysis.scopeChainParts, scopeDefinitions, analysis.currentScopeType);

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
        scopeDefs: Map<string, ScopeDefinition>,
        startScope: string = DEFAULT_ROOT_SCOPE
    ): string | null {
        let currentType: string | null = startScope;

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
        if (analysis.blockIdentifier === 'effect' ||
            analysis.blockIdentifier === 'immediate' ||
            analysis.blockIdentifier?.includes('effect')) {
            return true;
        }

        // Fallback: use context engine for ancestor chain and iterator-based classification
        if (analysis.ancestorNodes.length > 0) {
            const ctx = classifyContext(analysis.ancestorNodes, analysis.blockIdentifier, '');
            if (ctx.context === 'effect' && ctx.confidence !== 'low') {
                return true;
            }
        }

        return false;
    }

    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const effectMap = loader.getEffects();

        const inferredScope = analysis.currentScopeType;

        for (const [effectName, effectData] of effectMap.entries()) {
            // Filter by scope compatibility using both scope (single) and scopes (array) fields
            if (!this.isScopeCompatible(inferredScope, effectData)) {
                continue;
            }

            const ranking = this.calculateEffectRanking(effectName, effectData);

            const builder = new CompletionBuilder(effectName)
                .withKind(CompletionItemKind.Function)
                .withDetails(effectData.scope ? `[${effectData.scope}] Effect` : 'Effect')
                .withRanking(ranking)
                .withMetadata('effectName', effectName);

            // Use YAML snippet if available, otherwise plain insertion
            if (effectData.snippet) {
                builder.withSnippet(effectData.snippet);
            } else {
                builder.withPlainInsertion(effectName + ' = ');
            }

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

    private isScopeCompatible(currentScope: string, effectData: EffectDefinition): boolean {
        // If no scope constraints, it's valid everywhere
        if (!effectData.scope && (!effectData.scopes || effectData.scopes.length === 0)) {
            return true;
        }

        // Check scopes array (new format from merged data)
        if (effectData.scopes && effectData.scopes.length > 0) {
            if (effectData.scopes.includes('any')) return true;
            return effectData.scopes.includes(currentScope);
        }

        // Check scope string (legacy format)
        if (effectData.scope) {
            if (effectData.scope === 'any') return true;
            return effectData.scope === currentScope;
        }

        return true;
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
        if (analysis.blockIdentifier === 'trigger' ||
            analysis.blockIdentifier === 'is_shown' ||
            analysis.blockIdentifier === 'is_valid' ||
            analysis.blockIdentifier?.includes('trigger')) {
            return true;
        }

        // Fallback: use context engine for ancestor chain and iterator-based classification
        if (analysis.ancestorNodes.length > 0) {
            const ctx = classifyContext(analysis.ancestorNodes, analysis.blockIdentifier, '');
            if (ctx.context === 'trigger' && ctx.confidence !== 'low') {
                return true;
            }
        }

        return false;
    }

    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const triggerMap = loader.getTriggers();

        const inferredScope = analysis.currentScopeType;

        for (const [triggerName, triggerData] of triggerMap.entries()) {
            // Filter by scope compatibility using both scope (single) and scopes (array) fields
            if (!this.isScopeCompatible(inferredScope, triggerData)) {
                continue;
            }

            const ranking = this.calculateTriggerRanking(triggerName);

            const builder = new CompletionBuilder(triggerName)
                .withKind(CompletionItemKind.Function)
                .withDetails(triggerData.scope ? `[${triggerData.scope}] Trigger` : 'Trigger')
                .withRanking(ranking)
                .withMetadata('triggerName', triggerName);

            // Use YAML snippet if available, otherwise plain insertion
            if (triggerData.snippet) {
                builder.withSnippet(triggerData.snippet);
            } else {
                builder.withPlainInsertion(triggerName + ' = ');
            }

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

    private isScopeCompatible(currentScope: string, triggerData: TriggerDefinition): boolean {
        // If no scope constraints, it's valid everywhere
        if (!triggerData.scope && (!triggerData.scopes || triggerData.scopes.length === 0)) {
            return true;
        }

        // Check scopes array (new format from merged data)
        if (triggerData.scopes && triggerData.scopes.length > 0) {
            if (triggerData.scopes.includes('any')) return true;
            return triggerData.scopes.includes(currentScope);
        }

        // Check scope string (legacy format)
        if (triggerData.scope) {
            if (triggerData.scope === 'any') return true;
            return triggerData.scope === currentScope;
        }

        return true;
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
 * Saved scope completion strategy (scope:xxx)
 */
class SavedScopeStrategy implements CompletionStrategy {
    constructor(private indexer: DocumentIndexer) { }

    canHandle(analysis: CursorAnalysis): boolean {
        return analysis.textBeforeCursor.trimEnd().endsWith('scope:');
    }

    async generateSuggestions(analysis: CursorAnalysis, document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const scopeSymbols = this.indexer.findSymbolsByType(SymbolType.SCOPE);

        const seen = new Set<string>();
        for (const sym of scopeSymbols) {
            if (seen.has(sym.name)) continue;
            seen.add(sym.name);

            const fileName = sym.uri.split('/').pop() || sym.uri;
            suggestions.push(
                new CompletionBuilder(sym.name)
                    .withKind(CompletionItemKind.Variable)
                    .withDetails(`Saved scope from ${fileName}`)
                    .withPlainDocs(`Saved scope defined at line ${sym.range.start.line + 1}`)
                    .withRanking('0_' + sym.name)
                    .build()
            );
        }

        return suggestions;
    }
}

/**
 * On-action completion strategy
 * Provides on-action names when editing on_actions/ files or on_actions blocks
 */
class OnActionCompletionStrategy implements CompletionStrategy {
    canHandle(analysis: CursorAnalysis): boolean {
        // At root level or shallow nesting in on_actions/ files
        if (analysis.documentCategory === 'on_actions') {
            return !analysis.withinBlock || analysis.ancestorNodes.length <= 2;
        }

        return false;
    }

    async generateSuggestions(analysis: CursorAnalysis, _document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const onActionMap = loader.getOnActions();

        for (const [actionName, actionData] of onActionMap.entries()) {
            let docs = actionData.description || 'On-action';
            const metaParts: string[] = [];

            if (actionData.scopes) {
                const scopeEntries = Object.entries(actionData.scopes);
                if (scopeEntries.length > 0) {
                    metaParts.push(`**Scopes:** ${scopeEntries.map(([k, v]) => `\`${k}\` = \`${v}\``).join(', ')}`);
                }
            }
            if (actionData.has_trigger) metaParts.push('**Has trigger:** yes');
            if (actionData.has_effect) metaParts.push('**Has effect:** yes');
            if (actionData.is_pulse) metaParts.push('**Pulse action:** yes');

            if (metaParts.length > 0) {
                docs += '\n\n' + metaParts.join('  \n');
            }

            const builder = new CompletionBuilder(actionName)
                .withKind(CompletionItemKind.Event)
                .withDetails('On-action')
                .withSnippet(`${actionName} = {\n\t$0\n}`)
                .withMarkdownDocs(docs)
                .withRanking('2_' + actionName)
                .withMetadata('onAction', actionName);

            suggestions.push(builder.build());
        }

        return suggestions;
    }
}

/**
 * Interaction hook completion strategy
 * Provides hook names inside character_interaction, activity_type, scheme_type blocks
 */
class InteractionHookCompletionStrategy implements CompletionStrategy {
    private static readonly HOOK_PARENTS = new Set([
        'character_interaction', 'activity_type', 'scheme_type',
    ]);

    canHandle(analysis: CursorAnalysis): boolean {
        // In character_interactions/ files when inside a block (the interaction definition)
        if (analysis.documentCategory === 'character_interactions' && analysis.withinBlock) {
            return true;
        }

        // Check if any ancestor is a hook-containing block type
        for (const ancestor of analysis.ancestorNodes) {
            if (!ancestor.key) continue;
            for (const parent of InteractionHookCompletionStrategy.HOOK_PARENTS) {
                if (ancestor.key === parent || ancestor.key.endsWith('_' + parent)) {
                    return true;
                }
            }
        }

        return false;
    }

    async generateSuggestions(analysis: CursorAnalysis, _document: TextDocument): Promise<CompletionItem[]> {
        const suggestions: CompletionItem[] = [];
        const loader = getDataLoader();
        const hookMap = loader.getInteractionHooks();

        for (const [hookName, hookData] of hookMap.entries()) {
            const docs = hookData.description || 'Interaction hook';

            const builder = new CompletionBuilder(hookName)
                .withKind(CompletionItemKind.Event)
                .withDetails('Interaction hook')
                .withSnippet(`${hookName} = {\n\t$0\n}`)
                .withMarkdownDocs(docs)
                .withRanking('2_' + hookName)
                .withMetadata('hook', hookName);

            suggestions.push(builder.build());
        }

        return suggestions;
    }
}

/**
 * Main enhanced completion provider
 */
export class CompletionProvider {
    private strategies: CompletionStrategy[];
    private documentAnalysisCache: WeakMap<TextDocument, Map<number, CursorAnalysis>> = new WeakMap();
    private cursorDocument: TextDocument | null = null;

    constructor(
        private parser: CK3Parser,
        private indexer: DocumentIndexer,
        private schemaLoader: SchemaLoader,
        private modScanner?: ModScanner
    ) {
        // Initialize strategy pipeline with dependencies
        this.strategies = [
            new TemplateCompletionStrategy(),
            new SchemaFieldStrategy(schemaLoader),
            new ValueAssignmentStrategy(schemaLoader),
            new ScopeNavigationStrategy(),
            new SavedScopeStrategy(indexer),
            new EffectCommandStrategy(),
            new TriggerConditionStrategy(),
            new OnActionCompletionStrategy(),
            new InteractionHookCompletionStrategy(),
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

            // Add mod-aware completions
            allCompletions.push(...this.getModCompletions(analysis));

            // Sort by ranking
            allCompletions.sort((a, b) => {
                const rankA = a.sortText || a.label;
                const rankB = b.sortText || b.label;
                return rankA.localeCompare(rankB);
            });

            return allCompletions;

        } catch (error) {
            serverLogger.error('Completion generation error:', error);
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
            serverLogger.error('Error resolving completion:', error);
        }

        return item;
    }

    /**
     * Analyze cursor position and build comprehensive context
     */
    private async analyzeCursorPosition(document: TextDocument, position: Position): Promise<CursorAnalysis> {
        const analysis = new CursorAnalysis();
        this.cursorDocument = document;

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

        // Infer current scope type from ancestor chain
        analysis.currentScopeType = this.inferScopeFromAncestors(analysis, document.uri);

        // Extract used identifiers in current block
        if (analysis.nearestNode && analysis.nearestNode.type === NodeType.BLOCK) {
            analysis.usedIdentifiers = this.extractUsedKeys(analysis.nearestNode);
        }

        return analysis;
    }

    /**
     * Locate AST node at specific offset using Position-based comparison
     */
    private locateNodeAtOffset(root: ASTNode, offset: number): ASTNode | null {
        if (!root.range) {
            return null;
        }

        // Check if offset is within this node's range
        const withinNode = this.isOffsetInRange(offset, root.range.start, root.range.end);

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

    /**
     * Check if offset falls within a Position range.
     * Since we don't have the document here to convert offset to Position,
     * we store the document in cursorDocument during analyzeCursorPosition
     * and use it for offset-to-position conversion.
     */
    private isOffsetInRange(offset: number, start: Position, end: Position): boolean {
        if (!this.cursorDocument) {
            return true; // Fallback: match everything if no document reference
        }

        const pos = this.cursorDocument.positionAt(offset);

        // Check pos >= start
        if (pos.line < start.line || (pos.line === start.line && pos.character < start.character)) {
            return false;
        }
        // Check pos <= end
        if (pos.line > end.line || (pos.line === end.line && pos.character > end.character)) {
            return false;
        }
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
     * Infer the current scope type by walking the ancestor chain.
     * Uses data-driven scope transitions from scope YAML files.
     */
    private inferScopeFromAncestors(analysis: CursorAnalysis, fileUri?: string): string {
        // Use DirectoryRegistry default scope as the initial scope if available
        let scopeType = DEFAULT_ROOT_SCOPE;
        if (fileUri) {
            const registry = DirectoryRegistry.getInstance();
            if (registry.isLoaded()) {
                const defaultScope = registry.getDefaultScope(fileUri);
                if (defaultScope && defaultScope !== 'none') {
                    scopeType = defaultScope;
                }
            }
        }

        // Walk ancestors from root to leaf, transitioning scope at each step
        for (const ancestor of analysis.ancestorNodes) {
            if (!ancestor.key) continue;

            // Check if this ancestor is a scope link (e.g., "liege", "primary_title")
            const linkTarget = getTargetScopeType(scopeType, ancestor.key);
            if (linkTarget) {
                scopeType = linkTarget;
                continue;
            }

            // Check if this ancestor is a list iterator (e.g., "every_vassal", "any_held_title")
            const parsed = parseListIterator(ancestor.key);
            if (parsed) {
                const resultScope = getListResultScope(ancestor.key, scopeType);
                if (resultScope) {
                    scopeType = resultScope;
                }
            }
        }

        return scopeType;
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

    /**
     * Generate completion items from mod data
     */
    private getModCompletions(analysis: CursorAnalysis): CompletionItem[] {
        if (!this.modScanner || !this.modScanner.hasDiscoveredMods()) return [];

        const items: CompletionItem[] = [];

        // Add mod triggers
        for (const [name, item] of this.modScanner.getAllTriggers()) {
            if (analysis.usedIdentifiers?.has(name)) continue;
            items.push({
                label: name,
                kind: CompletionItemKind.Function,
                detail: `\uD83D\uDCE6 ${item.source} Trigger`,
                documentation: item.description || `Scripted trigger from ${item.source}`,
                sortText: `z_${name}`,
            });
        }

        // Add mod effects
        for (const [name, item] of this.modScanner.getAllEffects()) {
            if (analysis.usedIdentifiers?.has(name)) continue;
            items.push({
                label: name,
                kind: CompletionItemKind.Function,
                detail: `\uD83D\uDCE6 ${item.source} Effect`,
                documentation: item.description || `Scripted effect from ${item.source}`,
                sortText: `z_${name}`,
            });
        }

        // Add mod traits
        for (const [name, item] of this.modScanner.getAllTraits()) {
            if (analysis.usedIdentifiers?.has(name)) continue;
            items.push({
                label: name,
                kind: CompletionItemKind.EnumMember,
                detail: `\uD83D\uDCE6 ${item.source} Trait`,
                documentation: item.description || `Trait from ${item.source}`,
                sortText: `z_${name}`,
            });
        }

        return items;
    }
}
