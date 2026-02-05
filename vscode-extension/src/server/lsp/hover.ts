/**
 * Hover Provider - Provides documentation on hover
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { CK3Language } from '../ck3/language';
import { getDataLoader } from '../data/loader';

/**
 * Hover Provider
 */
export class HoverProvider {
    constructor(
        private parser: CK3Parser,
        private schemaLoader: SchemaLoader
    ) {}

    /**
     * Provide hover information
     */
    public async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return null;
        
        const dataLoader = getDataLoader();
        
        // Check if it's an effect
        const effects = dataLoader.getEffects();
        if (effects.has(word)) {
            const effect = effects.get(word)!;
            let content = `**Effect:** \`${word}\`\n\n${effect.description || 'No description available'}`;
            
            if (effect.scope) {
                content += `\n\n**Scope:** ${effect.scope}`;
            }
            
            if (effect.target_scope) {
                content += `\n**Returns:** ${effect.target_scope}`;
            }
            
            if (effect.examples && effect.examples.length > 0) {
                content += `\n\n**Example:**\n\`\`\`ck3\n${effect.examples[0]}\n\`\`\``;
            }
            
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: content,
                },
            };
        }
        
        // Check if it's a trigger
        const triggers = dataLoader.getTriggers();
        if (triggers.has(word)) {
            const trigger = triggers.get(word)!;
            let content = `**Trigger:** \`${word}\`\n\n${trigger.description || 'No description available'}`;
            
            if (trigger.scope) {
                content += `\n\n**Scope:** ${trigger.scope}`;
            }
            
            if (trigger.return_type) {
                content += `\n**Returns:** ${trigger.return_type}`;
            }
            
            if (trigger.examples && trigger.examples.length > 0) {
                content += `\n\n**Example:**\n\`\`\`ck3\n${trigger.examples[0]}\n\`\`\``;
            }
            
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: content,
                },
            };
        }
        
        // Check if it's a trait
        const traits = dataLoader.getTraits();
        if (traits.has(word)) {
            const trait = traits.get(word)!;
            let content = `**Trait:** \`${word}\``;
            
            if (trait.name) {
                content += `\n\n**Name:** ${trait.name}`;
            }
            
            if (trait.category) {
                content += `\n**Category:** ${trait.category}`;
            }
            
            if (trait.opposites && trait.opposites.length > 0) {
                content += `\n**Opposites:** ${trait.opposites.join(', ')}`;
            }
            
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: content,
                },
            };
        }
        
        return null;
    }

    /**
     * Get word at position
     */
    private getWordAtPosition(document: TextDocument, position: Position): string | null {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        let start = offset;
        let end = offset;
        
        // Find word boundaries
        while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) {
            start--;
        }
        
        while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) {
            end++;
        }
        
        if (start === end) return null;
        
        return text.substring(start, end);
    }
}
