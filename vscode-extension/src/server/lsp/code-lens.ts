/**
 * Code Lens Provider - Provides inline actionable information
 */

import {
    CodeLens,
    Command,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Code Lens Provider
 */
export class CodeLensProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide code lenses
     */
    public async provideCodeLens(document: TextDocument): Promise<CodeLens[]> {
        const parsed = this.parser.parse(document.getText());
        const lenses: CodeLens[] = [];

        this.collectCodeLenses(parsed.ast, lenses, document);

        return lenses;
    }

    /**
     * Collect code lenses from AST
     */
    private collectCodeLenses(
        node: ASTNode,
        lenses: CodeLens[],
        document: TextDocument
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Add code lens for events (showing reference count)
            if (child.key && child.key.includes('.')) {
                const lens: CodeLens = {
                    range: child.range,
                    command: Command.create(
                        '0 references',
                        'ck3.showReferences',
                        document.uri,
                        child.range.start,
                        []
                    ),
                };
                lenses.push(lens);
            }

            // Add code lens for blocks showing line count
            if (child.type === NodeType.BLOCK && child.children) {
                const lineCount = child.range.end.line - child.range.start.line + 1;
                if (lineCount > 10) {
                    const lens: CodeLens = {
                        range: child.range,
                        command: Command.create(
                            `${lineCount} lines`,
                            '',
                            []
                        ),
                    };
                    lenses.push(lens);
                }
            }

            // Recurse
            if (child.children) {
                this.collectCodeLenses(child, lenses, document);
            }
        }
    }
}
