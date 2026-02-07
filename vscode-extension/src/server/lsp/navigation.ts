/**
 * Navigation Provider - Cross-file navigation for CK3 language server
 * Supports go-to-definition, find-references, type definitions, and implementations
 */

import { Location, Position, LocationLink } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { DocumentIndexer, Symbol, SymbolType } from '../core/indexer';
import { CK3Language } from '../ck3/language';

interface TokenInfo {
    text: string;
    startOffset: number;
    endOffset: number;
    context: NavigationContext;
}

enum NavigationContext {
    EVENT_ID,
    DECISION_ID,
    EFFECT_NAME,
    TRIGGER_NAME,
    VARIABLE_NAME,
    SCOPE_NAME,
    LOCALIZATION_KEY,
    SCRIPTED_BLOCK,
    UNKNOWN
}

/**
 * Enhanced Definition Provider with cross-file navigation
 */
export class DefinitionProvider {
    constructor(
        private ck3Parser: CK3Parser,
        private symbolIndexer: DocumentIndexer
    ) {}

    /**
     * Navigate to definition (supports LocationLink for preview)
     */
    public async navigateToDefinition(
        doc: TextDocument,
        pos: Position
    ): Promise<Location[] | LocationLink[] | null> {
        const tokenInfo = this.extractTokenAtCursor(doc, pos);
        if (!tokenInfo) return null;

        const targetLocations = await this.resolveDefinitionTargets(tokenInfo, doc.uri);
        
        if (targetLocations.length === 0) return null;
        
        // Return as LocationLink for better UX with preview
        return targetLocations.map(target => 
            LocationLink.create(target.uri, target.range, target.range, {
                start: { line: pos.line, character: tokenInfo.startOffset },
                end: { line: pos.line, character: tokenInfo.endOffset }
            })
        );
    }

    /**
     * Find all references to symbol at position
     */
    public async findAllReferences(
        doc: TextDocument,
        pos: Position,
        includeDecl: boolean
    ): Promise<Location[]> {
        const tokenInfo = this.extractTokenAtCursor(doc, pos);
        if (!tokenInfo) return [];

        const matchingSymbols = this.symbolIndexer.findSymbolsByName(tokenInfo.text);
        
        if (matchingSymbols.length === 0) return [];

        // Filter by context type for accuracy
        const contextFilteredSymbols = this.filterByNavigationContext(
            matchingSymbols,
            tokenInfo.context
        );

        const referenceLocations: Location[] = contextFilteredSymbols.map(sym =>
            Location.create(sym.uri, sym.range)
        );

        // Optionally exclude declaration
        if (!includeDecl && contextFilteredSymbols.length > 0) {
            const primaryDef = this.selectPrimaryDefinition(contextFilteredSymbols);
            return referenceLocations.filter(loc => 
                !(loc.uri === primaryDef.uri && this.rangesEqual(loc.range, primaryDef.range))
            );
        }

        return referenceLocations;
    }

    /**
     * Navigate to type definition (e.g., from variable to its declaration)
     */
    public async navigateToTypeDefinition(
        doc: TextDocument,
        pos: Position
    ): Promise<Location[] | null> {
        const tokenInfo = this.extractTokenAtCursor(doc, pos);
        if (!tokenInfo) return null;

        // For variables, find their set_variable declarations
        if (tokenInfo.context === NavigationContext.VARIABLE_NAME) {
            const varSymbols = this.symbolIndexer.findSymbolsByType(SymbolType.VARIABLE)
                .filter(s => s.name === tokenInfo.text);
            
            if (varSymbols.length > 0) {
                return varSymbols.map(s => Location.create(s.uri, s.range));
            }
        }

        // For scopes, find their save_scope_as declarations
        if (tokenInfo.context === NavigationContext.SCOPE_NAME) {
            const scopeSymbols = this.symbolIndexer.findSymbolsByType(SymbolType.SCOPE)
                .filter(s => s.name === tokenInfo.text);
            
            if (scopeSymbols.length > 0) {
                return scopeSymbols.map(s => Location.create(s.uri, s.range));
            }
        }

        return null;
    }

    /**
     * Find implementation of effect/trigger (where it's defined as scripted)
     */
    public async findImplementation(
        doc: TextDocument,
        pos: Position
    ): Promise<Location[] | null> {
        const tokenInfo = this.extractTokenAtCursor(doc, pos);
        if (!tokenInfo) return null;

        const implLocations: Location[] = [];

        // Check if it's a scripted effect
        if (tokenInfo.context === NavigationContext.EFFECT_NAME) {
            const scriptedEffects = this.symbolIndexer.findSymbolsByType(SymbolType.SCRIPTED_EFFECT)
                .filter(s => s.name === tokenInfo.text);
            implLocations.push(...scriptedEffects.map(s => Location.create(s.uri, s.range)));
        }

        // Check if it's a scripted trigger
        if (tokenInfo.context === NavigationContext.TRIGGER_NAME) {
            const scriptedTriggers = this.symbolIndexer.findSymbolsByType(SymbolType.SCRIPTED_TRIGGER)
                .filter(s => s.name === tokenInfo.text);
            implLocations.push(...scriptedTriggers.map(s => Location.create(s.uri, s.range)));
        }

        return implLocations.length > 0 ? implLocations : null;
    }

    /**
     * Navigate to declaration (similar to definition but prioritizes forward declarations)
     */
    public async navigateToDeclaration(
        doc: TextDocument,
        pos: Position
    ): Promise<Location[] | null> {
        // For CK3, declaration and definition are typically the same
        // But we can prioritize on_action declarations over event definitions
        const tokenInfo = this.extractTokenAtCursor(doc, pos);
        if (!tokenInfo) return null;

        if (tokenInfo.context === NavigationContext.EVENT_ID) {
            // Check if there's an on_action that declares this event
            const onActionSymbols = this.symbolIndexer.findSymbolsByType(SymbolType.ON_ACTION);
            
            // This would require deeper AST parsing to find event references in on_actions
            // For now, fall back to regular definition
            const defResult = await this.navigateToDefinition(doc, pos);
            return this.convertToLocationArray(defResult);
        }

        const defResult = await this.navigateToDefinition(doc, pos);
        return this.convertToLocationArray(defResult);
    }

    /**
     * Convert LocationLink[] or Location[] to Location[]
     */
    private convertToLocationArray(result: Location[] | LocationLink[] | null): Location[] | null {
        if (!result) return null;
        
        if (result.length === 0) return [];
        
        // Check if first item is LocationLink
        const firstItem = result[0] as any;
        if ('targetUri' in firstItem) {
            // It's LocationLink[], convert to Location[]
            return (result as LocationLink[]).map(link => 
                Location.create(link.targetUri, link.targetRange)
            );
        }
        
        return result as Location[];
    }

    /**
     * Extract token and determine its navigation context
     */
    private extractTokenAtCursor(doc: TextDocument, pos: Position): TokenInfo | null {
        const documentText = doc.getText();
        const cursorOffset = doc.offsetAt(pos);

        // Extract identifier at cursor (including dots for namespaces)
        let scanStart = cursorOffset;
        let scanEnd = cursorOffset;

        // Scan backwards
        while (scanStart > 0 && this.isIdentifierCharacter(documentText[scanStart - 1])) {
            scanStart--;
        }

        // Scan forwards
        while (scanEnd < documentText.length && this.isIdentifierCharacter(documentText[scanEnd])) {
            scanEnd++;
        }

        if (scanStart === scanEnd) return null;

        const extractedText = documentText.substring(scanStart, scanEnd);
        const navContext = this.determineNavigationContext(extractedText, doc, pos);

        return {
            text: extractedText,
            startOffset: scanStart,
            endOffset: scanEnd,
            context: navContext
        };
    }

    /**
     * Determine what kind of symbol we're navigating to
     */
    private determineNavigationContext(
        tokenText: string,
        doc: TextDocument,
        pos: Position
    ): NavigationContext {
        // Event IDs have namespace.id pattern
        if (/^\w+\.\d+$/.test(tokenText) || /^\w+\.\w+$/.test(tokenText)) {
            return NavigationContext.EVENT_ID;
        }

        // Check if it's a known effect
        if (CK3Language.isEffect(tokenText)) {
            return NavigationContext.EFFECT_NAME;
        }

        // Check if it's a known trigger
        if (CK3Language.isTrigger(tokenText)) {
            return NavigationContext.TRIGGER_NAME;
        }

        // Check surrounding context by parsing
        const parseResult = this.ck3Parser.parse(doc.getText());
        const enclosingNode = this.findNodeAtPosition(parseResult.ast, pos);
        
        if (enclosingNode) {
            // Check parent key to determine context
            if (enclosingNode.key === 'trigger_event' || enclosingNode.key === 'id') {
                return NavigationContext.EVENT_ID;
            }
            
            if (enclosingNode.key === 'save_scope_as' || enclosingNode.key === 'save_temporary_scope_as') {
                return NavigationContext.SCOPE_NAME;
            }

            if (enclosingNode.key === 'name' && enclosingNode.value === tokenText) {
                return NavigationContext.VARIABLE_NAME;
            }
        }

        return NavigationContext.UNKNOWN;
    }

    /**
     * Find AST node at specific position
     */
    private findNodeAtPosition(ast: ASTNode, pos: Position): ASTNode | null {
        if (!this.positionInRange(pos, ast.range)) {
            return null;
        }

        if (ast.children) {
            for (const child of ast.children) {
                const found = this.findNodeAtPosition(child, pos);
                if (found) return found;
            }
        }

        return ast;
    }

    /**
     * Check if position is within range
     */
    private positionInRange(pos: Position, range: any): boolean {
        if (pos.line < range.start.line || pos.line > range.end.line) {
            return false;
        }
        if (pos.line === range.start.line && pos.character < range.start.character) {
            return false;
        }
        if (pos.line === range.end.line && pos.character > range.end.character) {
            return false;
        }
        return true;
    }

    /**
     * Resolve definition targets based on context
     */
    private async resolveDefinitionTargets(
        tokenInfo: TokenInfo,
        sourceUri: string
    ): Promise<Symbol[]> {
        const candidates = this.symbolIndexer.findSymbolsByName(tokenInfo.text);
        
        if (candidates.length === 0) return [];

        // Filter and rank by context
        return this.filterByNavigationContext(candidates, tokenInfo.context);
    }

    /**
     * Filter symbols by navigation context for better accuracy
     */
    private filterByNavigationContext(
        symbols: Symbol[],
        context: NavigationContext
    ): Symbol[] {
        const contextTypeMap: Record<NavigationContext, SymbolType[]> = {
            [NavigationContext.EVENT_ID]: [SymbolType.EVENT],
            [NavigationContext.DECISION_ID]: [SymbolType.DECISION],
            [NavigationContext.EFFECT_NAME]: [SymbolType.SCRIPTED_EFFECT],
            [NavigationContext.TRIGGER_NAME]: [SymbolType.SCRIPTED_TRIGGER],
            [NavigationContext.VARIABLE_NAME]: [SymbolType.VARIABLE],
            [NavigationContext.SCOPE_NAME]: [SymbolType.SCOPE],
            [NavigationContext.LOCALIZATION_KEY]: [],
            [NavigationContext.SCRIPTED_BLOCK]: [SymbolType.SCRIPTED_EFFECT, SymbolType.SCRIPTED_TRIGGER],
            [NavigationContext.UNKNOWN]: []
        };

        const targetTypes = contextTypeMap[context];
        
        if (targetTypes.length === 0) return symbols;

        return symbols.filter(sym => targetTypes.includes(sym.type));
    }

    /**
     * Select primary definition (prefer first declaration in alphabetical order by URI)
     */
    private selectPrimaryDefinition(symbols: Symbol[]): Symbol {
        if (symbols.length === 1) return symbols[0];
        
        // Sort by URI and take first
        const sorted = [...symbols].sort((a, b) => a.uri.localeCompare(b.uri));
        return sorted[0];
    }

    /**
     * Check if character is part of identifier
     */
    private isIdentifierCharacter(char: string): boolean {
        return /[a-zA-Z0-9_.@$:]/.test(char);
    }

    /**
     * Check if ranges are equal
     */
    private rangesEqual(r1: any, r2: any): boolean {
        return r1.start.line === r2.start.line &&
               r1.start.character === r2.start.character &&
               r1.end.line === r2.end.line &&
               r1.end.character === r2.end.character;
    }
}
