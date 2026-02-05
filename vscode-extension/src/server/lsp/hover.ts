/**
 * Hover Provider - Provides documentation on hover
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { CK3Language } from '../ck3/language';

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
        
        // Check if it's an effect
        const effects = CK3Language.getEffects();
        if (effects[word]) {
            const effect = effects[word];
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `**Effect:** ${word}\n\n${effect.description || 'No description available'}`,
                },
            };
        }
        
        // Check if it's a trigger
        const triggers = CK3Language.getTriggers();
        if (triggers[word]) {
            const trigger = triggers[word];
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `**Trigger:** ${word}\n\n${trigger.description || 'No description available'}`,
                },
            };
        }
        
        // Check if it's a trait
        if (CK3Language.isTrait(word)) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `**Trait:** ${word}`,
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
