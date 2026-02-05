/**
 * Inlay Hints Provider - Provides inline type annotations
 */

import { InlayHint, InlayHintKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { CK3Language } from '../ck3/language';

/**
 * Inlay Hints Provider
 */
export class InlayHintsProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide inlay hints
     */
    public async provideInlayHints(
        document: TextDocument,
        range: Range
    ): Promise<InlayHint[]> {
        const parsed = this.parser.parse(document.getText());
        const hints: InlayHint[] = [];

        this.collectInlayHints(parsed.ast, hints, range);

        return hints;
    }

    /**
     * Collect inlay hints from AST
     */
    private collectInlayHints(
        node: ASTNode,
        hints: InlayHint[],
        range: Range
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Skip nodes outside the requested range
            if (
                child.range.end.line < range.start.line ||
                child.range.start.line > range.end.line
            ) {
                continue;
            }

            // Add type hint for save_scope_as
            if (child.key === 'save_scope_as' || child.key === 'save_temporary_scope_as') {
                if (typeof child.value === 'string') {
                    const hint: InlayHint = {
                        position: child.range.end,
                        label: ': scope',
                        kind: InlayHintKind.Type,
                        paddingLeft: true,
                    };
                    hints.push(hint);
                }
            }

            // Add type hint for scope accessors (like root.primary_title)
            if (child.type === NodeType.ASSIGNMENT && typeof child.value === 'string') {
                const parts = child.value.split('.');
                if (parts.length > 1 && parts[0] === 'root') {
                    const accessor = parts[1];
                    const scopeType = this.inferScopeType(accessor);
                    
                    if (scopeType) {
                        const hint: InlayHint = {
                            position: child.range.end,
                            label: `: ${scopeType}`,
                            kind: InlayHintKind.Type,
                            paddingLeft: true,
                        };
                        hints.push(hint);
                    }
                }
            }

            // Add type hint for iterators
            if (
                child.key &&
                (child.key.startsWith('every_') ||
                    child.key.startsWith('any_') ||
                    child.key.startsWith('random_'))
            ) {
                const scopeType = this.inferIteratorType(child.key);
                if (scopeType) {
                    const hint: InlayHint = {
                        position: child.range.end,
                        label: ` → ${scopeType}`,
                        kind: InlayHintKind.Type,
                        paddingLeft: true,
                    };
                    hints.push(hint);
                }
            }

            // Recurse
            if (child.children) {
                this.collectInlayHints(child, hints, range);
            }
        }
    }

    /**
     * Infer scope type from accessor
     */
    private inferScopeType(accessor: string): string | null {
        const typeMap: Record<string, string> = {
            'primary_title': 'title',
            'capital_county': 'title',
            'liege': 'character',
            'father': 'character',
            'mother': 'character',
            'spouse': 'character',
            'primary_heir': 'character',
            'faith': 'faith',
            'culture': 'culture',
            'house': 'house',
            'dynasty': 'dynasty',
        };

        return typeMap[accessor] || null;
    }

    /**
     * Infer scope type from iterator
     */
    private inferIteratorType(iterator: string): string | null {
        if (iterator.includes('_vassal')) return 'character';
        if (iterator.includes('_ally')) return 'character';
        if (iterator.includes('_realm_county')) return 'title';
        if (iterator.includes('_held_title')) return 'title';
        if (iterator.includes('_county')) return 'title';
        if (iterator.includes('_de_jure_')) return 'title';
        if (iterator.includes('_child')) return 'character';
        if (iterator.includes('_sibling')) return 'character';
        if (iterator.includes('_courtier')) return 'character';
        if (iterator.includes('_war')) return 'war';

        return null;
    }
}
