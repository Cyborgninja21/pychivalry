/**
 * Enhanced Hover Provider - Rich documentation with context awareness
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { CK3Language } from '../ck3/language';
import { getDataLoader, EffectDefinition, TriggerDefinition, TraitDefinition, ScopeDefinition } from '../data/loader';

/**
 * Default scope used when scope chain analysis cannot determine starting point
 */
const DEFAULT_ROOT_SCOPE = 'character';

/**
 * Represents different documentation contexts
 */
enum DocContext {
    Effect = 'effect',
    Trigger = 'trigger',
    Trait = 'trait',
    Scope = 'scope',
    Variable = 'variable',
    Unknown = 'unknown'
}

/**
 * Markdown documentation assembler using functional composition
 */
class MarkdownDocAssembler {
    private fragments: string[] = [];

    /** Append title with emoji icon */
    title(text: string, emoji: string): this {
        this.fragments.push(`${emoji} **${text}**`);
        return this;
    }

    /** Append descriptive paragraph */
    paragraph(text: string): this {
        if (text) {
            this.fragments.push(`\n${text}`);
        }
        return this;
    }

    /** Append divider line */
    divider(): this {
        this.fragments.push('\n---');
        return this;
    }

    /** Append formatted table */
    table(headers: string[], rows: string[][]): this {
        if (rows.length === 0) return this;
        
        this.fragments.push('\n');
        this.fragments.push(`| ${headers.join(' | ')} |`);
        this.fragments.push(`| ${headers.map(() => '---').join(' | ')} |`);
        
        rows.forEach(row => {
            this.fragments.push(`| ${row.join(' | ')} |`);
        });
        
        return this;
    }

    /** Append code snippet */
    codeSnippet(code: string, lang: string = 'ck3'): this {
        this.fragments.push(`\n\`\`\`${lang}\n${code}\n\`\`\``);
        return this;
    }

    /** Append bulleted list */
    bulletList(items: string[]): this {
        if (items.length > 0) {
            this.fragments.push('\n');
            items.forEach(item => this.fragments.push(`- ${item}`));
        }
        return this;
    }

    /** Append inline code reference */
    inlineRef(text: string): this {
        this.fragments.push(`\n\`${text}\``);
        return this;
    }

    /** Get assembled markdown */
    compile(): string {
        return this.fragments.join('');
    }
}

/**
 * Enhanced Hover Provider with rich documentation
 */
export class HoverProvider {
    private docCache: Map<string, string> = new Map();

    constructor(
        private parser: CK3Parser,
        private schemaLoader: SchemaLoader
    ) {}

    /**
     * Provide context-aware hover information
     */
    public async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
        const tokenInfo = this.extractTokenInfo(document, position);
        if (!tokenInfo.token) return null;
        
        // Check cache first
        const cacheKey = `${tokenInfo.context}:${tokenInfo.token}`;
        if (this.docCache.has(cacheKey)) {
            return this.createHoverResponse(this.docCache.get(cacheKey)!);
        }

        const dataLoader = getDataLoader();
        let documentation: string | null = null;

        // Route to appropriate documentation generator
        const effects = dataLoader.getEffects();
        if (effects.has(tokenInfo.token)) {
            documentation = this.generateEffectDocs(tokenInfo.token, effects.get(tokenInfo.token)!, dataLoader);
        } else {
            const triggers = dataLoader.getTriggers();
            if (triggers.has(tokenInfo.token)) {
                documentation = this.generateTriggerDocs(tokenInfo.token, triggers.get(tokenInfo.token)!, dataLoader);
            } else {
                const traits = dataLoader.getTraits();
                if (traits.has(tokenInfo.token)) {
                    documentation = this.generateTraitDocs(tokenInfo.token, traits.get(tokenInfo.token)!, dataLoader);
                } else {
                    // Check for scope chain
                    if (tokenInfo.token.includes('.')) {
                        documentation = this.generateScopeChainDocs(tokenInfo.token, dataLoader);
                    }
                }
            }
        }

        if (documentation) {
            this.docCache.set(cacheKey, documentation);
            return this.createHoverResponse(documentation);
        }

        return null;
    }

    /**
     * Generate rich documentation for effects
     */
    private generateEffectDocs(name: string, effect: EffectDefinition, loader: any): string {
        const doc = new MarkdownDocAssembler();
        
        doc.title(`Effect: ${name}`, '⚡');
        doc.paragraph(effect.description || 'Modifies game state');

        // Parameter details
        if (effect.parameters && Object.keys(effect.parameters).length > 0) {
            doc.divider();
            doc.paragraph('**Parameters**');
            
            const paramRows = Object.entries(effect.parameters).map(([key, val]) => {
                return [key, val, this.inferParamType(key, val)];
            });
            doc.table(['Name', 'Description', 'Type'], paramRows);
        }

        // Scope information
        if (effect.scope || effect.target_scope) {
            doc.divider();
            const scopeInfo: string[] = [];
            if (effect.scope) scopeInfo.push(`**Required Scope:** \`${effect.scope}\``);
            if (effect.target_scope) scopeInfo.push(`**Result Scope:** \`${effect.target_scope}\``);
            doc.bulletList(scopeInfo);
        }

        // Examples with explanations
        if (effect.examples && effect.examples.length > 0) {
            doc.divider();
            doc.paragraph('**Usage Examples**');
            
            const exampleCount = Math.min(effect.examples.length, 3);
            for (let i = 0; i < exampleCount; i++) {
                const exampleLabel = exampleCount > 1 ? `Example ${i + 1}` : 'Example';
                doc.paragraph(`\n*${exampleLabel}:*`);
                doc.codeSnippet(effect.examples[i]);
            }
        }

        // Related effects
        const relatedEffects = this.findRelatedEffects(name, loader);
        if (relatedEffects.length > 0) {
            doc.divider();
            doc.paragraph('**Related Effects**');
            doc.bulletList(relatedEffects.map(e => `\`${e}\``));
        }

        return doc.compile();
    }

    /**
     * Generate rich documentation for triggers
     */
    private generateTriggerDocs(name: string, trigger: TriggerDefinition, loader: any): string {
        const doc = new MarkdownDocAssembler();
        
        doc.title(`Trigger: ${name}`, '🔍');
        doc.paragraph(trigger.description || 'Evaluates game condition');

        // Parameters
        if (trigger.parameters && Object.keys(trigger.parameters).length > 0) {
            doc.divider();
            doc.paragraph('**Parameters**');
            
            const paramRows = Object.entries(trigger.parameters).map(([key, val]) => {
                return [key, val, this.inferParamType(key, val)];
            });
            doc.table(['Name', 'Description', 'Type'], paramRows);
        }

        // Scope and return type
        const metaInfo: string[] = [];
        if (trigger.scope) metaInfo.push(`**Scope:** \`${trigger.scope}\``);
        if (trigger.return_type) metaInfo.push(`**Returns:** \`${trigger.return_type}\``);
        
        if (metaInfo.length > 0) {
            doc.divider();
            doc.bulletList(metaInfo);
        }

        // Usage examples
        if (trigger.examples && trigger.examples.length > 0) {
            doc.divider();
            doc.paragraph('**Usage Examples**');
            
            const exampleCount = Math.min(trigger.examples.length, 3);
            for (let i = 0; i < exampleCount; i++) {
                const exampleLabel = exampleCount > 1 ? `Example ${i + 1}` : 'Example';
                doc.paragraph(`\n*${exampleLabel}:*`);
                doc.codeSnippet(trigger.examples[i]);
            }
        }

        // Related triggers
        const relatedTriggers = this.findRelatedTriggers(name, loader);
        if (relatedTriggers.length > 0) {
            doc.divider();
            doc.paragraph('**Related Triggers**');
            doc.bulletList(relatedTriggers.map(t => `\`${t}\``));
        }

        return doc.compile();
    }

    /**
     * Generate rich documentation for traits
     */
    private generateTraitDocs(id: string, trait: TraitDefinition, loader: any): string {
        const doc = new MarkdownDocAssembler();
        
        doc.title(`Trait: ${trait.name || id}`, '🎭');
        
        // Trait metadata table
        const metaRows: string[][] = [];
        if (trait.category) metaRows.push(['Category', trait.category]);
        if (trait.level !== undefined) metaRows.push(['Level', trait.level.toString()]);
        
        if (metaRows.length > 0) {
            doc.table(['Property', 'Value'], metaRows);
        }

        // Opposites and compatibility
        if (trait.opposites && trait.opposites.length > 0) {
            doc.divider();
            doc.paragraph('⚠️ **Incompatible With**');
            doc.bulletList(trait.opposites.map(o => `\`${o}\``));
        }

        // Usage in effects
        doc.divider();
        doc.paragraph('**Common Usage**');
        doc.codeSnippet(`add_trait = ${id}\n\nremove_trait = ${id}\n\nhas_trait = ${id}`);

        return doc.compile();
    }

    /**
     * Generate documentation for scope chains (e.g., "root.liege.primary_title")
     */
    private generateScopeChainDocs(chain: string, loader: any): string {
        const doc = new MarkdownDocAssembler();
        const parts = chain.split('.');
        
        doc.title(`Scope Chain`, '🔗');
        doc.paragraph(`Navigates through game object relationships`);
        doc.divider();

        // Explain each step
        const scopes = loader.getScopes();
        let currentScope = DEFAULT_ROOT_SCOPE;
        
        doc.paragraph('**Navigation Steps**');
        const steps: string[] = [];
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const scopeData = scopes.get(currentScope);
            
            if (scopeData?.links?.[part]) {
                const targetScope = scopeData.links[part];
                steps.push(`${i + 1}. \`${part}\` → moves from \`${currentScope}\` to \`${targetScope}\``);
                currentScope = targetScope;
            } else {
                steps.push(`${i + 1}. \`${part}\` → scope transition`);
            }
        }
        
        doc.bulletList(steps);
        doc.divider();
        doc.paragraph(`**Final Scope Type:** \`${currentScope}\``);

        // Example usage
        doc.divider();
        doc.paragraph('**Example Usage**');
        doc.codeSnippet(`${chain} = {\n    # Apply effects to target scope\n    add_gold = 100\n}`);

        return doc.compile();
    }

    /**
     * Find effects related to the given effect name
     */
    private findRelatedEffects(name: string, loader: any): string[] {
        const related: string[] = [];
        const effects = loader.getEffects();
        
        // Pattern matching for related effects
        if (name.startsWith('add_')) {
            const base = name.substring(4);
            const removeVariant = `remove_${base}`;
            const changeVariant = `change_${base}`;
            if (effects.has(removeVariant)) related.push(removeVariant);
            if (effects.has(changeVariant)) related.push(changeVariant);
        } else if (name.startsWith('remove_')) {
            const base = name.substring(7);
            const addVariant = `add_${base}`;
            if (effects.has(addVariant)) related.push(addVariant);
        } else if (name.startsWith('set_')) {
            const base = name.substring(4);
            const changeVariant = `change_${base}`;
            if (effects.has(changeVariant)) related.push(changeVariant);
        }
        
        return related.slice(0, 5); // Limit to 5 related items
    }

    /**
     * Find triggers related to the given trigger name
     */
    private findRelatedTriggers(name: string, loader: any): string[] {
        const related: string[] = [];
        const triggers = loader.getTriggers();
        
        // Find inverse or related triggers
        if (name.startsWith('is_')) {
            const base = name.substring(3);
            const notVariant = `is_not_${base}`;
            if (triggers.has(notVariant)) related.push(notVariant);
        } else if (name.startsWith('has_')) {
            const base = name.substring(4);
            const notVariant = `has_no_${base}`;
            if (triggers.has(notVariant)) related.push(notVariant);
        }
        
        // Find "any_" and "all_" variants
        if (name.startsWith('any_')) {
            const base = name.substring(4);
            const allVariant = `all_${base}`;
            if (triggers.has(allVariant)) related.push(allVariant);
        } else if (name.startsWith('all_')) {
            const base = name.substring(4);
            const anyVariant = `any_${base}`;
            if (triggers.has(anyVariant)) related.push(anyVariant);
        }
        
        return related.slice(0, 5);
    }

    /**
     * Infer parameter type from key/value patterns using heuristic matching
     * 
     * Note: This uses string-based heuristics which may produce false positives.
     * Patterns are matched in priority order with explicit fallback to 'value'.
     */
    private inferParamType(key: string, description: string): string {
        const lowerKey = key.toLowerCase();
        const lowerDesc = description.toLowerCase();
        
        // Pattern configuration for type inference (priority order)
        const typePatterns = {
            number: {
                keyPatterns: ['days', 'years', 'months', 'amount', 'count'],
                descPatterns: ['number', 'amount', 'value']
            },
            scope: {
                keyPatterns: ['target', 'who', 'character', 'title'],
                descPatterns: ['scope', 'character', 'target']
            },
            bool: {
                keyPatterns: [],
                descPatterns: ['yes', 'no', 'true', 'false']
            }
        };
        
        // Check each type pattern
        for (const [type, patterns] of Object.entries(typePatterns)) {
            const keyMatch = patterns.keyPatterns.some(p => lowerKey.includes(p));
            const descMatch = patterns.descPatterns.every(p => lowerDesc.includes(p)) && patterns.descPatterns.length > 0;
            
            if (keyMatch || descMatch) {
                return type;
            }
        }
        
        // Explicit fallback
        return 'value';
    }

    /**
     * Extract token and context information from document position
     */
    private extractTokenInfo(document: TextDocument, position: Position): { token: string; context: DocContext } {
        const line = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: 1000 }
        });
        
        const offset = document.offsetAt(position);
        const text = document.getText();
        
        // Extract token with scope chain support
        let tokenStart = offset;
        let tokenEnd = offset;
        
        while (tokenStart > 0 && /[a-zA-Z0-9_.]/.test(text[tokenStart - 1])) {
            tokenStart--;
        }
        
        while (tokenEnd < text.length && /[a-zA-Z0-9_.]/.test(text[tokenEnd])) {
            tokenEnd++;
        }
        
        const token = text.substring(tokenStart, tokenEnd);
        
        // Determine context (simplified - would be enhanced with AST analysis)
        let context = DocContext.Unknown;
        if (token.includes('.')) {
            context = DocContext.Scope;
        }
        
        return { token, context };
    }

    /**
     * Create hover response from markdown content
     */
    private createHoverResponse(markdown: string): Hover {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: markdown
            }
        };
    }
}
