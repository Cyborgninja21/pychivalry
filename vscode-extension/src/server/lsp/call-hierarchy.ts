/**
 * Call Hierarchy Provider - LSP call hierarchy support for CK3 scripts
 *
 * Implements the three LSP call hierarchy handlers:
 * - prepareCallHierarchy: Identifies the CK3 symbol at cursor
 * - incomingCalls: What triggers/calls this symbol?
 * - outgoingCalls: What does this symbol trigger/call?
 *
 * Supports events, scripted effects, scripted triggers, on-actions, and decisions.
 */

import {
    CallHierarchyItem,
    CallHierarchyIncomingCall,
    CallHierarchyOutgoingCall,
    CallHierarchyIncomingCallsParams,
    CallHierarchyOutgoingCallsParams,
    CallHierarchyPrepareParams,
    SymbolKind,
    Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { EnhancedIndexer } from '../core/indexer-enhanced';
import { Symbol, SymbolType } from '../core/indexer';
import { CallEdge } from '../core/call-graph';

/** Symbol types eligible for call hierarchy */
const CALLABLE_TYPES = new Set<SymbolType>([
    SymbolType.EVENT,
    SymbolType.DECISION,
    SymbolType.ON_ACTION,
    SymbolType.SCRIPTED_EFFECT,
    SymbolType.SCRIPTED_TRIGGER,
]);

export class CallHierarchyProvider {
    constructor(
        private parser: CK3Parser,
        private indexer: EnhancedIndexer,
    ) {}

    /**
     * textDocument/prepareCallHierarchy
     *
     * Given a cursor position, identifies the CK3 symbol and returns a CallHierarchyItem.
     */
    public prepareCallHierarchy(
        document: TextDocument,
        params: CallHierarchyPrepareParams,
    ): CallHierarchyItem[] | null {
        const token = this.extractTokenAtCursor(document, params.position);
        if (!token) return null;

        // Look up the symbol in the index
        const symbols = this.indexer.findSymbolsByName(token);
        if (symbols.length === 0) return null;

        // Filter to callable types
        const callableSymbol = symbols.find(s => CALLABLE_TYPES.has(s.type));
        if (!callableSymbol) return null;

        return [this.symbolToItem(callableSymbol)];
    }

    /**
     * callHierarchy/incomingCalls
     *
     * Returns all symbols that call into the given item.
     */
    public incomingCalls(
        params: CallHierarchyIncomingCallsParams,
    ): CallHierarchyIncomingCall[] {
        const symbolName = this.getSymbolName(params.item);
        if (!symbolName) return [];

        const callGraph = this.indexer.getCallGraph();
        const edges = callGraph.getIncomingCalls(symbolName);

        // Group edges by caller name
        const grouped = this.groupEdgesBy(edges, e => e.fromName);

        const results: CallHierarchyIncomingCall[] = [];
        for (const [callerName, callerEdges] of grouped) {
            const callerSymbol = this.resolveSymbol(callerName);
            if (!callerSymbol) continue;

            results.push({
                from: this.symbolToItem(callerSymbol),
                fromRanges: callerEdges.map(e => e.sourceRange),
            });
        }

        return results;
    }

    /**
     * callHierarchy/outgoingCalls
     *
     * Returns all symbols that the given item calls out to.
     */
    public outgoingCalls(
        params: CallHierarchyOutgoingCallsParams,
    ): CallHierarchyOutgoingCall[] {
        const symbolName = this.getSymbolName(params.item);
        if (!symbolName) return [];

        const callGraph = this.indexer.getCallGraph();
        const edges = callGraph.getOutgoingCalls(symbolName);

        // Group edges by callee name
        const grouped = this.groupEdgesBy(edges, e => e.toName);

        const results: CallHierarchyOutgoingCall[] = [];
        for (const [calleeName, calleeEdges] of grouped) {
            const calleeSymbol = this.resolveSymbol(calleeName);
            // Create synthetic item for unresolved targets
            const item = calleeSymbol
                ? this.symbolToItem(calleeSymbol)
                : this.syntheticItem(calleeName, calleeEdges[0]);

            results.push({
                to: item,
                fromRanges: calleeEdges.map(e => e.sourceRange),
            });
        }

        return results;
    }

    // --- Private Helpers ---

    /**
     * Extract the symbol name from a CallHierarchyItem's data field.
     */
    private getSymbolName(item: CallHierarchyItem): string | null {
        if (item.data && typeof item.data === 'object' && 'name' in item.data) {
            return (item.data as { name: string }).name;
        }
        // Fallback to the item name
        return item.name || null;
    }

    /**
     * Convert a Symbol to a CallHierarchyItem.
     */
    private symbolToItem(sym: Symbol): CallHierarchyItem {
        return {
            name: sym.name,
            kind: this.symbolTypeToKind(sym.type),
            uri: sym.uri,
            range: sym.range,
            selectionRange: sym.range,
            detail: this.getDetail(sym),
            data: { name: sym.name, type: sym.type },
        };
    }

    /**
     * Create a synthetic CallHierarchyItem for an unresolved target.
     */
    private syntheticItem(name: string, edge: CallEdge): CallHierarchyItem {
        const zeroRange: Range = {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        };
        return {
            name,
            kind: this.symbolTypeToKind(edge.toType),
            uri: edge.sourceUri,
            range: zeroRange,
            selectionRange: zeroRange,
            detail: '(unresolved)',
            data: { name, type: edge.toType },
        };
    }

    /**
     * Map CK3 SymbolType to LSP SymbolKind.
     */
    private symbolTypeToKind(type: SymbolType): SymbolKind {
        switch (type) {
            case SymbolType.EVENT: return SymbolKind.Event;
            case SymbolType.DECISION: return SymbolKind.Function;
            case SymbolType.ON_ACTION: return SymbolKind.Interface;
            case SymbolType.SCRIPTED_EFFECT: return SymbolKind.Function;
            case SymbolType.SCRIPTED_TRIGGER: return SymbolKind.Boolean;
            default: return SymbolKind.Variable;
        }
    }

    /**
     * Generate a detail string for a symbol.
     */
    private getDetail(sym: Symbol): string {
        switch (sym.type) {
            case SymbolType.EVENT: {
                const meta = this.indexer.getEvent(sym.name);
                return meta ? `${meta.type} (${meta.namespace})` : 'event';
            }
            case SymbolType.DECISION: return 'decision';
            case SymbolType.ON_ACTION: return 'on_action';
            case SymbolType.SCRIPTED_EFFECT: return 'scripted_effect';
            case SymbolType.SCRIPTED_TRIGGER: return 'scripted_trigger';
            default: return sym.type;
        }
    }

    /**
     * Resolve a symbol name to its definition Symbol.
     */
    private resolveSymbol(name: string): Symbol | null {
        const symbols = this.indexer.findSymbolsByName(name);
        if (symbols.length === 0) return null;
        // Prefer the first definition found (sorted by URI for stability)
        return symbols.sort((a, b) => a.uri.localeCompare(b.uri))[0];
    }

    /**
     * Group call edges by a key function.
     */
    private groupEdgesBy(edges: CallEdge[], keyFn: (e: CallEdge) => string): Map<string, CallEdge[]> {
        const groups = new Map<string, CallEdge[]>();
        for (const edge of edges) {
            const key = keyFn(edge);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(edge);
        }
        return groups;
    }

    /**
     * Extract the identifier token at the cursor position.
     * Replicates the identifier scanning logic from DefinitionProvider.
     */
    private extractTokenAtCursor(doc: TextDocument, pos: { line: number; character: number }): string | null {
        const text = doc.getText();
        const offset = doc.offsetAt(pos);

        let start = offset;
        let end = offset;

        // Scan backwards
        while (start > 0 && this.isIdentifierChar(text[start - 1])) {
            start--;
        }

        // Scan forwards
        while (end < text.length && this.isIdentifierChar(text[end])) {
            end++;
        }

        if (start === end) return null;
        return text.substring(start, end);
    }

    /**
     * Check if a character is part of a CK3 identifier.
     */
    private isIdentifierChar(char: string): boolean {
        return /[a-zA-Z0-9_.@$:]/.test(char);
    }
}
