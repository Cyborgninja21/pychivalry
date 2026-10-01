/**
 * Signature Help Provider — parameter hints for block-form keywords.
 *
 * The signature of a keyword is read from its engine doc string in the spec package
 * (pychivalry-engine): the label lists the `key =` lines of the doc's usage example and the
 * documentation is the doc verbatim. A name in both the triggers and effects buckets gets
 * one signature per bucket. Keywords whose doc shows no block form have no signature.
 */

import {
    MarkupKind,
    ParameterInformation,
    Position,
    SignatureHelp,
    SignatureInformation,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Bucket, defaultSpec, Spec } from 'pychivalry-engine';
import { bucketLabel, docParameters } from './keyword-docs';

/**
 * Context information for signature help
 */
interface SignatureContext {
    command: string;
    isInBlock: boolean;
    currentParameterIndex: number;
    blockDepth: number;
}

const SIGNATURE_BUCKETS: Bucket[] = ['effects', 'triggers', 'lists'];

/**
 * Signature Help Provider
 */
export class SignatureHelpProvider {
    constructor(private spec: Spec = defaultSpec()) {}

    /**
     * Provide signature help
     */
    public async provideSignatureHelp(
        document: TextDocument,
        position: Position
    ): Promise<SignatureHelp | null> {
        const text = document.getText();
        const offset = document.offsetAt(position);

        const context = this.findDetailedContext(text, offset);
        if (!context) {
            return null;
        }

        const signatures = this.getSignatures(context.command);
        if (signatures.length === 0) {
            return null;
        }

        return {
            signatures,
            activeSignature: 0,
            activeParameter: context.currentParameterIndex,
        };
    }

    /**
     * Find detailed context at cursor position
     */
    private findDetailedContext(text: string, offset: number): SignatureContext | null {
        let pos = offset - 1;

        // Find the start of the current block
        let braceDepth = 0;
        let blockStart = -1;

        // Scan backwards to find the opening brace and command
        while (pos >= 0) {
            const char = text[pos];

            if (char === '}') {
                braceDepth++;
            } else if (char === '{') {
                braceDepth--;
                if (braceDepth < 0) {
                    blockStart = pos;
                    break;
                }
            }

            pos--;
        }

        if (blockStart === -1) {
            return null;
        }

        // Find the command name before the opening brace
        pos = blockStart - 1;
        while (pos >= 0 && /[\s=]/.test(text[pos])) {
            pos--;
        }

        if (pos < 0) {
            return null;
        }

        // Extract command name
        const commandEnd = pos + 1;
        while (pos >= 0 && /[a-zA-Z0-9_]/.test(text[pos])) {
            pos--;
        }
        const commandStart = pos + 1;

        if (commandStart >= commandEnd) {
            return null;
        }

        const command = text.substring(commandStart, commandEnd);

        // Count parameters to determine active parameter
        const blockContent = text.substring(blockStart + 1, offset);
        const parameterIndex = this.countParameters(blockContent);

        return {
            command,
            isInBlock: true,
            currentParameterIndex: parameterIndex,
            blockDepth: 1,
        };
    }

    /**
     * Count parameters in block content
     */
    private countParameters(content: string): number {
        let count = 0;
        let depth = 0;
        let inString = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (char === '"') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') {
                    depth++;
                } else if (char === '}') {
                    depth--;
                } else if (char === '=' && depth === 0) {
                    count++;
                }
            }
        }

        return Math.max(0, count);
    }

    /**
     * One signature per bucket whose engine doc shows a block form of the keyword.
     */
    private getSignatures(command: string): SignatureInformation[] {
        const signatures: SignatureInformation[] = [];
        for (const bucket of SIGNATURE_BUCKETS) {
            if (!this.spec.has(command, bucket)) {
                continue;
            }
            const doc = this.spec.doc(command, bucket);
            const params = docParameters(doc, command);
            if (params.length === 0) {
                continue;
            }
            signatures.push({
                label: `${command} = { ${params.join(' ')} }`,
                documentation: {
                    kind: MarkupKind.Markdown,
                    value: `*${bucketLabel(bucket)}* — CK3 ${this.spec.version()} engine documentation\n\n\`\`\`text\n${doc ?? ''}\n\`\`\``,
                },
                parameters: params.map((p) => ParameterInformation.create(p)),
            });
        }
        return signatures;
    }
}
