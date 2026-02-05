/**
 * Document Links Provider - Provides clickable links in documents
 */

import { DocumentLink } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Document Links Provider
 */
export class DocumentLinksProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide document links
     */
    public async provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        const parsed = this.parser.parse(document.getText());
        const links: DocumentLink[] = [];

        this.collectDocumentLinks(parsed.ast, links);

        return links;
    }

    /**
     * Collect document links from AST
     */
    private collectDocumentLinks(node: ASTNode, links: DocumentLink[]): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Look for file references
            if (child.key === 'file' || child.key === 'icon' || child.key === 'texture') {
                if (typeof child.value === 'string') {
                    const link: DocumentLink = {
                        range: child.range,
                        target: child.value,
                    };
                    links.push(link);
                }
            }

            // Recurse
            if (child.children) {
                this.collectDocumentLinks(child, links);
            }
        }
    }
}
