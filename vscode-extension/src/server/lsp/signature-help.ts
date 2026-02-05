/**
 * Signature Help Provider - Provides parameter hints
 */

import {
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { CK3Language } from '../ck3/language';

/**
 * Signature Help Provider
 */
export class SignatureHelpProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide signature help
     */
    public async provideSignatureHelp(
        document: TextDocument,
        position: Position
    ): Promise<SignatureHelp | null> {
        const text = document.getText();
        const offset = document.offsetAt(position);

        // Find the context - what effect/trigger are we in?
        const context = this.findContext(text, offset);
        if (!context) return null;

        // Get signature for the effect/trigger
        const signatures = this.getSignatures(context);
        if (signatures.length === 0) return null;

        return {
            signatures,
            activeSignature: 0,
            activeParameter: 0,
        };
    }

    /**
     * Find the context at the cursor position
     */
    private findContext(text: string, offset: number): string | null {
        // Simple implementation: find the last key before the cursor
        let pos = offset - 1;
        
        // Skip whitespace and equals sign
        while (pos >= 0 && /[\s=]/.test(text[pos])) {
            pos--;
        }

        if (pos < 0) return null;

        // Find the start of the word
        let start = pos;
        while (start >= 0 && /[a-zA-Z0-9_]/.test(text[start])) {
            start--;
        }
        start++;

        if (start >= pos) return null;

        return text.substring(start, pos + 1);
    }

    /**
     * Get signatures for an effect/trigger
     */
    private getSignatures(context: string): SignatureInformation[] {
        const signatures: SignatureInformation[] = [];

        // Check if it's an effect
        const effects = CK3Language.getEffects();
        if (effects[context]) {
            const effect = effects[context];
            const sig: SignatureInformation = {
                label: `${context} = value`,
                documentation: effect.description,
                parameters: [],
            };
            signatures.push(sig);
        }

        // Check if it's a trigger
        const triggers = CK3Language.getTriggers();
        if (triggers[context]) {
            const trigger = triggers[context];
            const sig: SignatureInformation = {
                label: `${context} = value`,
                documentation: trigger.description,
                parameters: [],
            };
            signatures.push(sig);
        }

        // Special case for set_variable
        if (context === 'set_variable') {
            const sig: SignatureInformation = {
                label: 'set_variable = { name = <name> value = <value> }',
                documentation: 'Set a variable with a name and value',
                parameters: [
                    ParameterInformation.create('name', 'Variable name'),
                    ParameterInformation.create('value', 'Variable value'),
                ],
            };
            signatures.push(sig);
        }

        // Special case for trigger_event
        if (context === 'trigger_event') {
            const sig: SignatureInformation = {
                label: 'trigger_event = { id = <event_id> days = <days> }',
                documentation: 'Trigger an event after a delay',
                parameters: [
                    ParameterInformation.create('id', 'Event ID'),
                    ParameterInformation.create('days', 'Delay in days (optional)'),
                ],
            };
            signatures.push(sig);
        }

        return signatures;
    }
}
