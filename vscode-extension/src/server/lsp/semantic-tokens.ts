/**
 * Semantic Tokens Provider - Context-aware syntax highlighting with scope coloring
 * Provides rich semantic highlighting based on CK3 script context
 */

import {
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokensLegend,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { CK3Language } from '../ck3/language';
import { classifyContext } from '../ck3/validation/context-engine';

/**
 * Token type indices (must match legend registration order)
 */
enum TokenTypeIndex {
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
    PARAMETER = 10,
    TYPE = 11,
    ENUM_MEMBER = 12,
    EVENT = 13,
    DECORATOR = 14,
    MACRO = 15,
}

/**
 * Token modifier indices (bitmask)
 */
enum TokenModifierBit {
    DECLARATION = 0,
    READONLY = 1,
    STATIC = 2,
    DEPRECATED = 3,
    ABSTRACT = 4,
    ASYNC = 5,
    MODIFICATION = 6,
    DOCUMENTATION = 7,
    DEFAULT_LIBRARY = 8,
}

interface SemanticContext {
    isEffectBlock: boolean;
    isTriggerBlock: boolean;
    isEventBlock: boolean;
    isDecisionBlock: boolean;
    scopeType: string | null;
    parentKey: string | null;
}

/**
 * Enhanced Semantic Tokens Provider with scope-aware coloring
 */
export class SemanticTokensProvider {
    private static readonly TOKEN_LEGEND: SemanticTokensLegend = {
        tokenTypes: [
            'keyword',
            'operator',
            'string',
            'number',
            'variable',
            'function',
            'namespace',
            'class',
            'property',
            'comment',
            'parameter',
            'type',
            'enumMember',
            'event',
            'decorator',
            'macro',
        ],
        tokenModifiers: [
            'declaration',
            'readonly',
            'static',
            'deprecated',
            'abstract',
            'async',
            'modification',
            'documentation',
            'defaultLibrary',
        ]
    };

    constructor(private ck3Parser: CK3Parser) {}

    /**
     * Get token legend for registration
     */
    public static getTokenLegend(): SemanticTokensLegend {
        return SemanticTokensProvider.TOKEN_LEGEND;
    }

    /**
     * Generate semantic tokens for document
     */
    public async generateSemanticTokens(doc: TextDocument): Promise<SemanticTokens> {
        const parseResult = this.ck3Parser.parse(doc.getText());
        const tokenBuilder = new SemanticTokensBuilder();
        
        const initialContext: SemanticContext = {
            isEffectBlock: false,
            isTriggerBlock: false,
            isEventBlock: false,
            isDecisionBlock: false,
            scopeType: null,
            parentKey: null,
        };

        const documentText = doc.getText();
        const documentLines = documentText.split('\n');
        this.processASTForTokens(parseResult.ast, tokenBuilder, initialContext, documentLines);

        return tokenBuilder.build();
    }

    /**
     * Process AST nodes and generate tokens with context awareness
     */
    private processASTForTokens(
        astNode: ASTNode,
        tokenBuilder: SemanticTokensBuilder,
        context: SemanticContext,
        documentLines: string[]
    ): void {
        if (!astNode.children || astNode.children.length === 0) {
            return;
        }

        for (const childNode of astNode.children) {
            // Handle comments specially
            if (childNode.type === NodeType.COMMENT) {
                this.emitCommentToken(childNode, tokenBuilder);
                continue;
            }

            // Skip nodes without keys
            if (!childNode.key) {
                continue;
            }

            // Determine context for this node
            const nodeContext = this.createNodeContext(childNode, context);

            // Emit token for the key
            this.emitKeyToken(childNode, tokenBuilder, nodeContext);

            // Emit token for the value if present
            if (childNode.value !== undefined) {
                this.emitValueToken(childNode, tokenBuilder, documentLines);
            }

            // Emit token for operator if present
            if (childNode.operator) {
                this.emitOperatorToken(childNode, tokenBuilder, documentLines);
            }

            // Recursively process children
            if (childNode.children) {
                this.processASTForTokens(childNode, tokenBuilder, nodeContext, documentLines);
            }
        }
    }

    /**
     * Create context for child node based on parent context
     */
    private createNodeContext(node: ASTNode, parentContext: SemanticContext): SemanticContext {
        const newContext: SemanticContext = { ...parentContext };

        if (!node.key) return newContext;

        // Update context based on node key
        if (node.key.includes('.') && /^\w+\.\d+$/.test(node.key)) {
            newContext.isEventBlock = true;
            newContext.isEffectBlock = false;
            newContext.isTriggerBlock = false;
        } else if (/_decision$/.test(node.key)) {
            newContext.isDecisionBlock = true;
        } else if (CK3Language.isEffect(node.key)) {
            newContext.isEffectBlock = true;
            newContext.isTriggerBlock = false;
        } else if (CK3Language.isTrigger(node.key)) {
            newContext.isTriggerBlock = true;
            newContext.isEffectBlock = false;
        } else {
            // Fallback: use context engine for keys not in effect/trigger lists
            const ctx = classifyContext([], node.key, '');
            if (ctx.confidence !== 'low') {
                if (ctx.context === 'effect') {
                    newContext.isEffectBlock = true;
                    newContext.isTriggerBlock = false;
                } else if (ctx.context === 'trigger') {
                    newContext.isTriggerBlock = true;
                    newContext.isEffectBlock = false;
                }
            }
        }

        // Track parent key for context
        newContext.parentKey = node.key;

        // Detect scope changes
        if (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') {
            if (node.value) {
                newContext.scopeType = String(node.value);
            }
        }

        return newContext;
    }

    /**
     * Emit semantic token for key
     */
    private emitKeyToken(
        node: ASTNode,
        builder: SemanticTokensBuilder,
        context: SemanticContext
    ): void {
        if (!node.key) return;

        const tokenClassification = this.classifyKey(node.key, context);
        const modifierMask = this.calculateModifierMask(node, context);

        builder.push(
            node.range.start.line,
            node.range.start.character,
            node.key.length,
            tokenClassification.type,
            modifierMask
        );
    }

    /**
     * Classify key into token type based on context
     */
    private classifyKey(
        keyName: string,
        context: SemanticContext
    ): { type: TokenTypeIndex; description: string } {
        // Event IDs
        if (/^\w+\.\d+$/.test(keyName) || /^\w+\.\w+$/.test(keyName)) {
            return { type: TokenTypeIndex.EVENT, description: 'Event identifier' };
        }

        // CK3 Effects
        if (CK3Language.isEffect(keyName)) {
            return { type: TokenTypeIndex.FUNCTION, description: 'CK3 effect' };
        }

        // CK3 Triggers
        if (CK3Language.isTrigger(keyName)) {
            return { type: TokenTypeIndex.MACRO, description: 'CK3 trigger' };
        }

        // Decisions
        if (/_decision$/.test(keyName)) {
            return { type: TokenTypeIndex.CLASS, description: 'Decision' };
        }

        // Character interactions
        if (/_interaction$/.test(keyName)) {
            return { type: TokenTypeIndex.CLASS, description: 'Interaction' };
        }

        // Story cycles
        if (/_story_cycle$/.test(keyName)) {
            return { type: TokenTypeIndex.NAMESPACE, description: 'Story cycle' };
        }

        // On-actions
        if (/^on_/.test(keyName)) {
            return { type: TokenTypeIndex.EVENT, description: 'On-action' };
        }

        // Special keywords
        const keywords = ['trigger', 'effect', 'immediate', 'option', 'after', 'desc', 'title'];
        if (keywords.includes(keyName)) {
            return { type: TokenTypeIndex.KEYWORD, description: 'Keyword' };
        }

        // Scope-related
        if (keyName === 'save_scope_as' || keyName === 'save_temporary_scope_as') {
            return { type: TokenTypeIndex.VARIABLE, description: 'Scope variable' };
        }

        // Variable-related
        if (keyName === 'set_variable' || keyName === 'change_variable') {
            return { type: TokenTypeIndex.VARIABLE, description: 'Variable operation' };
        }

        // Parameters (in certain contexts)
        const parameterKeys = ['name', 'value', 'target', 'days', 'months', 'years'];
        if (parameterKeys.includes(keyName)) {
            return { type: TokenTypeIndex.PARAMETER, description: 'Parameter' };
        }

        // Type-like (for schema fields)
        const typeKeys = ['type', 'category', 'group'];
        if (typeKeys.includes(keyName)) {
            return { type: TokenTypeIndex.TYPE, description: 'Type field' };
        }

        // Default to property
        return { type: TokenTypeIndex.PROPERTY, description: 'Property' };
    }

    /**
     * Calculate modifier bitmask for token
     */
    private calculateModifierMask(node: ASTNode, context: SemanticContext): number {
        let mask = 0;

        // Mark declarations
        if (node.key && context.isEventBlock && node.key.includes('.')) {
            mask |= (1 << TokenModifierBit.DECLARATION);
        }

        if (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') {
            mask |= (1 << TokenModifierBit.DECLARATION);
        }

        // Mark readonly (triggers are readonly conditions)
        if (context.isTriggerBlock && node.key && CK3Language.isTrigger(node.key)) {
            mask |= (1 << TokenModifierBit.READONLY);
        }

        // Mark modifications (effects modify game state)
        if (context.isEffectBlock && node.key && CK3Language.isEffect(node.key)) {
            mask |= (1 << TokenModifierBit.MODIFICATION);
        }

        // Mark default library (built-in CK3 functions)
        if (node.key && (CK3Language.isEffect(node.key) || CK3Language.isTrigger(node.key))) {
            mask |= (1 << TokenModifierBit.DEFAULT_LIBRARY);
        }

        return mask;
    }

    /**
     * Emit token for value
     */
    private emitValueToken(
        node: ASTNode,
        builder: SemanticTokensBuilder,
        documentLines: string[]
    ): void {
        if (node.value === undefined || node.value === null) return;

        // Calculate value position (approximate - after key and operator)
        const valueStr = String(node.value);
        const keyEndOffset = node.range.start.character + (node.key?.length || 0);

        // Find value position in text (search after '=')
        const lineText = this.getLineText(documentLines, node.range.start.line);
        const valueStart = lineText.indexOf(valueStr, keyEndOffset);
        
        if (valueStart === -1) return;

        let tokenType: TokenTypeIndex;

        if (typeof node.value === 'number') {
            tokenType = TokenTypeIndex.NUMBER;
        } else if (typeof node.value === 'boolean') {
            tokenType = TokenTypeIndex.ENUM_MEMBER; // yes/no as enum
        } else if (typeof node.value === 'string') {
            if (valueStr.startsWith('@[') || valueStr.startsWith('@')) {
                // Variable reference (@var) or interpolation (@[expr])
                tokenType = TokenTypeIndex.VARIABLE;
            } else if (lineText[valueStart - 1] === '"') {
                tokenType = TokenTypeIndex.STRING;
            } else {
                tokenType = TokenTypeIndex.ENUM_MEMBER;
            }
        } else {
            tokenType = TokenTypeIndex.STRING;
        }

        builder.push(
            node.range.start.line,
            valueStart,
            valueStr.length,
            tokenType,
            0
        );
    }

    /**
     * Emit token for operator
     */
    private emitOperatorToken(
        node: ASTNode,
        builder: SemanticTokensBuilder,
        documentLines: string[]
    ): void {
        if (!node.operator) return;

        // Find operator position (between key and value)
        const lineText = this.getLineText(documentLines, node.range.start.line);
        const keyEndPos = node.range.start.character + (node.key?.length || 0);
        const operatorPos = lineText.indexOf(node.operator, keyEndPos);

        if (operatorPos === -1) return;

        builder.push(
            node.range.start.line,
            operatorPos,
            node.operator.length,
            TokenTypeIndex.OPERATOR,
            0
        );
    }

    /**
     * Emit token for comment
     */
    private emitCommentToken(node: ASTNode, builder: SemanticTokensBuilder): void {
        const commentText = String(node.value || '');
        
        builder.push(
            node.range.start.line,
            node.range.start.character,
            commentText.length,
            TokenTypeIndex.COMMENT,
            1 << TokenModifierBit.DOCUMENTATION // Mark as documentation
        );
    }

    /**
     * Get text of a specific line
     */
    private getLineText(documentLines: string[], lineNumber: number): string {
        return documentLines[lineNumber] || '';
    }

    /**
     * Generate range semantic tokens (for incremental updates)
     */
    public async generateRangeSemanticTokens(
        doc: TextDocument,
        range: { start: { line: number; character: number }; end: { line: number; character: number } }
    ): Promise<SemanticTokens> {
        const parseResult = this.ck3Parser.parse(doc.getText());
        const tokenBuilder = new SemanticTokensBuilder();

        const initialContext: SemanticContext = {
            isEffectBlock: false,
            isTriggerBlock: false,
            isEventBlock: false,
            isDecisionBlock: false,
            scopeType: null,
            parentKey: null,
        };

        const documentText = doc.getText();
        const documentLines = documentText.split('\n');
        this.processASTForTokensInRange(parseResult.ast, tokenBuilder, initialContext, documentLines, range);

        return tokenBuilder.build();
    }

    /**
     * Process AST nodes but only emit tokens within the given range
     */
    private processASTForTokensInRange(
        astNode: ASTNode,
        tokenBuilder: SemanticTokensBuilder,
        context: SemanticContext,
        documentLines: string[],
        range: { start: { line: number; character: number }; end: { line: number; character: number } }
    ): void {
        if (!astNode.children || astNode.children.length === 0) {
            return;
        }

        for (const childNode of astNode.children) {
            // Skip nodes entirely below the range
            if (childNode.range.end.line < range.start.line) {
                continue;
            }
            // Stop processing if past the range
            if (childNode.range.start.line > range.end.line) {
                break;
            }

            if (childNode.type === NodeType.COMMENT) {
                if (childNode.range.start.line >= range.start.line && childNode.range.start.line <= range.end.line) {
                    this.emitCommentToken(childNode, tokenBuilder);
                }
                continue;
            }

            if (!childNode.key) {
                continue;
            }

            const nodeContext = this.createNodeContext(childNode, context);

            // Only emit tokens for nodes whose start line falls within the range
            if (childNode.range.start.line >= range.start.line && childNode.range.start.line <= range.end.line) {
                this.emitKeyToken(childNode, tokenBuilder, nodeContext);

                if (childNode.value !== undefined) {
                    this.emitValueToken(childNode, tokenBuilder, documentLines);
                }

                if (childNode.operator) {
                    this.emitOperatorToken(childNode, tokenBuilder, documentLines);
                }
            }

            // Recurse into children that may overlap with the range
            if (childNode.children) {
                this.processASTForTokensInRange(childNode, tokenBuilder, nodeContext, documentLines, range);
            }
        }
    }
}
