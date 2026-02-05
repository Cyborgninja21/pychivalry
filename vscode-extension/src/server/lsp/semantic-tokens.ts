/**
 * Semantic Tokens Provider - Provides semantic syntax highlighting
 */

import {
    SemanticTokens,
    SemanticTokensBuilder,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { CK3Language } from '../ck3/language';

// Token types (must match the legend in server.ts)
enum TokenType {
    KEYWORD = 0,
    OPERATOR = 1,
    STRING = 2,
    NUMBER = 3,
    VARIABLE = 4,
    FUNCTION = 5,
    NAMESPACE = 6,
    CLASS = 7,
    PROPERTY = 8,
    COMMENT = 9,
}

/**
 * Semantic Tokens Provider
 */
export class SemanticTokensProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide semantic tokens
     */
    public async provideSemanticTokens(document: TextDocument): Promise<SemanticTokens> {
        const parsed = this.parser.parse(document.getText());
        const builder = new SemanticTokensBuilder();
        
        this.encodeTokens(parsed.ast, builder);
        
        return builder.build();
    }

    /**
     * Encode tokens from AST
     */
    private encodeTokens(node: ASTNode, builder: SemanticTokensBuilder): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (child.type === NodeType.COMMENT) {
                // Comment
                builder.push(
                    child.range.start.line,
                    child.range.start.character,
                    (child.value as string)?.length || 0,
                    TokenType.COMMENT,
                    0
                );
            } else if (child.key) {
                // Determine token type based on key
                let tokenType = TokenType.PROPERTY;
                
                if (CK3Language.isEffect(child.key)) {
                    tokenType = TokenType.FUNCTION;
                } else if (CK3Language.isTrigger(child.key)) {
                    tokenType = TokenType.FUNCTION;
                } else if (child.key.includes('.')) {
                    tokenType = TokenType.NAMESPACE;
                }
                
                // Encode the key
                builder.push(
                    child.range.start.line,
                    child.range.start.character,
                    child.key.length,
                    tokenType,
                    0
                );
                
                // Encode the value if it's a simple value
                if (child.type === NodeType.ASSIGNMENT && typeof child.value === 'string') {
                    const valueTokenType = TokenType.STRING;
                    // Note: We'd need to track the position of the value more precisely
                    // For now, this is a simplified implementation
                } else if (child.type === NodeType.ASSIGNMENT && typeof child.value === 'number') {
                    // Number value
                }
            }

            // Recurse into children
            if (child.children) {
                this.encodeTokens(child, builder);
            }
        }
    }
}
