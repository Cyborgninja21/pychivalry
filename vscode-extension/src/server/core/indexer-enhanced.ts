/**
 * Enhanced Document Indexer - Advanced cross-file tracking and analysis
 * 
 * This module provides comprehensive symbol tracking with:
 * - Event metadata (namespace, type, theme, options)
 * - Decision groups and prerequisites
 * - Reference counting and cross-file resolution
 * - Dependency graph construction
 * - Event chain tracking
 * - Namespace inference
 * - Localization key extraction
 * - Undefined reference detection
 */

import { ASTNode, NodeType } from './parser';
import { Symbol, SymbolType, DocumentIndexer } from './indexer';

/**
 * Event metadata with full details
 */
export interface EventMetadata {
    id: string;
    namespace: string;
    number: string;
    type: 'character_event' | 'letter_event' | 'activity_event' | 'string_event' | 'window_event' | 'empty_event';
    theme?: string;
    title?: string;
    desc?: string;
    options: EventOption[];
    triggers: string[];
    immediate: string[];
    after: string[];
    portrait?: PortraitConfig;
    animation?: string;
    references: EventReference[];
    localizationKeys: string[];
}

export interface EventOption {
    name: string;
    triggers: string[];
    effects: string[];
    ai_chance?: number;
    triggeredEvents: string[]; // Events triggered by this option
}

export interface PortraitConfig {
    character?: string;
    position?: string;
    animation?: string;
}

export interface EventReference {
    fromEvent: string;
    toEvent: string;
    via: 'option' | 'immediate' | 'after';
    optionIndex?: number;
}

/**
 * Decision metadata
 */
export interface DecisionMetadata {
    id: string;
    title?: string;
    desc?: string;
    selection_tooltip?: string;
    major?: boolean;
    ai_check_frequency?: number;
    is_shown: string[];
    is_valid: string[];
    is_valid_showing_failures_only: string[];
    effect: string[];
    ai_potential: string[];
    ai_will_do: any;
    cost?: any;
    localizationKeys: string[];
}

/**
 * Reference information
 */
export interface Reference {
    symbol: Symbol;
    locations: ReferenceLocation[];
}

export interface ReferenceLocation {
    uri: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    context: 'call' | 'definition' | 'import' | 'trigger' | 'effect';
}

/**
 * Dependency information
 */
export interface Dependency {
    from: Symbol;
    to: Symbol;
    type: 'requires' | 'optional' | 'triggers' | 'calls';
}

/**
 * Undefined reference tracker
 */
export interface UndefinedReference {
    name: string;
    type: SymbolType;
    locations: ReferenceLocation[];
}

/**
 * Enhanced Document Indexer with advanced features
 */
export class EnhancedIndexer extends DocumentIndexer {
    // Event tracking
    private events: Map<string, EventMetadata> = new Map(); // event_id -> metadata
    private eventsByNamespace: Map<string, EventMetadata[]> = new Map(); // namespace -> events
    
    // Decision tracking
    private decisions: Map<string, DecisionMetadata> = new Map(); // decision_id -> metadata
    
    // Reference tracking
    private references: Map<string, Reference> = new Map(); // symbol_name -> references
    
    // Dependency tracking
    private dependencies: Map<string, Dependency[]> = new Map(); // from_symbol -> dependencies
    
    // Undefined references
    private undefinedReferences: Map<string, UndefinedReference> = new Map();
    
    // Localization keys
    private localizationKeys: Set<string> = new Set();
    private missingLocalizationKeys: Set<string> = new Set();
    
    // Event chains
    private eventChains: Map<string, string[]> = new Map(); // event_id -> triggered_events
    
    /**
     * Index a document with enhanced tracking
     */
    public async indexDocumentEnhanced(uri: string, ast: ASTNode): Promise<void> {
        // First do basic indexing
        await this.indexDocument(uri, ast);
        
        // Then do enhanced tracking
        this.extractEventMetadata(uri, ast);
        this.extractDecisionMetadata(uri, ast);
        this.extractReferences(uri, ast);
        this.extractLocalizationKeys(uri, ast);
        this.buildDependencyGraph(uri);
    }
    
    /**
     * Extract detailed event metadata
     */
    private extractEventMetadata(uri: string, ast: ASTNode): void {
        this.traverseForEvents(ast, (node) => {
            const metadata = this.parseEventNode(node, uri);
            if (metadata) {
                this.events.set(metadata.id, metadata);
                
                // Add to namespace index
                if (!this.eventsByNamespace.has(metadata.namespace)) {
                    this.eventsByNamespace.set(metadata.namespace, []);
                }
                this.eventsByNamespace.get(metadata.namespace)!.push(metadata);
                
                // Build event chains
                for (const ref of metadata.references) {
                    if (!this.eventChains.has(ref.fromEvent)) {
                        this.eventChains.set(ref.fromEvent, []);
                    }
                    this.eventChains.get(ref.fromEvent)!.push(ref.toEvent);
                }
            }
        });
    }
    
    /**
     * Parse event node to extract metadata
     */
    private parseEventNode(node: ASTNode, uri: string): EventMetadata | null {
        // Look for event type nodes (character_event, letter_event, etc.)
        if (!node.key || !this.isEventType(node.key)) {
            return null;
        }
        
        const eventId = this.extractEventId(node);
        if (!eventId) return null;
        
        const [namespace, number] = eventId.split('.');
        
        const metadata: EventMetadata = {
            id: eventId,
            namespace,
            number,
            type: node.key as any,
            options: [],
            triggers: [],
            immediate: [],
            after: [],
            references: [],
            localizationKeys: []
        };
        
        // Extract event details
        if (node.children) {
            for (const child of node.children) {
                switch (child.key) {
                    case 'type':
                        metadata.type = child.value as any;
                        break;
                    case 'theme':
                        metadata.theme = typeof child.value === 'string' ? child.value : undefined;
                        break;
                    case 'title':
                        metadata.title = typeof child.value === 'string' ? child.value : undefined;
                        if (typeof child.value === 'string') metadata.localizationKeys.push(child.value);
                        break;
                    case 'desc':
                        metadata.desc = typeof child.value === 'string' ? child.value : undefined;
                        if (typeof child.value === 'string') metadata.localizationKeys.push(child.value);
                        break;
                    case 'trigger':
                        metadata.triggers.push(...this.extractTriggers(child));
                        break;
                    case 'immediate':
                        metadata.immediate.push(...this.extractEffects(child));
                        this.extractTriggeredEvents(child, metadata, 'immediate');
                        break;
                    case 'after':
                        metadata.after.push(...this.extractEffects(child));
                        this.extractTriggeredEvents(child, metadata, 'after');
                        break;
                    case 'option':
                        const option = this.parseOption(child, metadata);
                        if (option) metadata.options.push(option);
                        break;
                    case 'left_portrait':
                    case 'right_portrait':
                        metadata.portrait = this.parsePortrait(child);
                        break;
                }
            }
        }
        
        return metadata;
    }
    
    /**
     * Parse event option
     */
    private parseOption(node: ASTNode, eventMetadata: EventMetadata): EventOption | null {
        const option: EventOption = {
            name: '',
            triggers: [],
            effects: [],
            triggeredEvents: []
        };
        
        if (node.children) {
            for (const child of node.children) {
                switch (child.key) {
                    case 'name':
                        option.name = typeof child.value === 'string' ? child.value : '';
                        if (typeof child.value === 'string') eventMetadata.localizationKeys.push(child.value);
                        break;
                    case 'trigger':
                        option.triggers.push(...this.extractTriggers(child));
                        break;
                    case 'ai_chance':
                        // Parse ai_chance block or value
                        break;
                    default:
                        // Effects
                        option.effects.push(...this.extractEffects(child));
                        this.extractTriggeredEvents(child, eventMetadata, 'option', option);
                        break;
                }
            }
        }
        
        return option;
    }
    
    /**
     * Extract triggered events from effects
     */
    private extractTriggeredEvents(
        node: ASTNode,
        metadata: EventMetadata,
        via: 'option' | 'immediate' | 'after',
        option?: EventOption
    ): void {
        this.traverse(node, (n) => {
            if (n.key === 'trigger_event') {
                const eventId = typeof n.value === 'string' ? n.value : this.findChildValue(n, 'id');
                if (eventId) {
                    const ref: EventReference = {
                        fromEvent: metadata.id,
                        toEvent: eventId,
                        via
                    };
                    metadata.references.push(ref);
                    if (option) {
                        option.triggeredEvents.push(eventId);
                    }
                }
            }
        });
    }
    
    /**
     * Extract decision metadata
     */
    private extractDecisionMetadata(uri: string, ast: ASTNode): void {
        this.traverseForDecisions(ast, (node) => {
            const metadata = this.parseDecisionNode(node, uri);
            if (metadata) {
                this.decisions.set(metadata.id, metadata);
            }
        });
    }
    
    /**
     * Parse decision node
     */
    private parseDecisionNode(node: ASTNode, uri: string): DecisionMetadata | null {
        const decisionId = node.key;
        if (!decisionId) return null;
        
        const metadata: DecisionMetadata = {
            id: decisionId,
            is_shown: [],
            is_valid: [],
            is_valid_showing_failures_only: [],
            effect: [],
            ai_potential: [],
            ai_will_do: [],
            localizationKeys: []
        };
        
        if (node.children) {
            for (const child of node.children) {
                switch (child.key) {
                    case 'title':
                        metadata.title = typeof child.value === 'string' ? child.value : undefined;
                        if (typeof child.value === 'string') metadata.localizationKeys.push(child.value);
                        break;
                    case 'desc':
                        metadata.desc = typeof child.value === 'string' ? child.value : undefined;
                        if (typeof child.value === 'string') metadata.localizationKeys.push(child.value);
                        break;
                    case 'selection_tooltip':
                        metadata.selection_tooltip = typeof child.value === 'string' ? child.value : undefined;
                        if (typeof child.value === 'string') metadata.localizationKeys.push(child.value);
                        break;
                    case 'major':
                        metadata.major = child.value === 'yes';
                        break;
                    case 'is_shown':
                        metadata.is_shown.push(...this.extractTriggers(child));
                        break;
                    case 'is_valid':
                        metadata.is_valid.push(...this.extractTriggers(child));
                        break;
                    case 'is_valid_showing_failures_only':
                        metadata.is_valid_showing_failures_only.push(...this.extractTriggers(child));
                        break;
                    case 'effect':
                        metadata.effect.push(...this.extractEffects(child));
                        break;
                    case 'ai_potential':
                        metadata.ai_potential.push(...this.extractTriggers(child));
                        break;
                }
            }
        }
        
        return metadata;
    }
    
    /**
     * Extract references to symbols
     */
    private extractReferences(uri: string, ast: ASTNode): void {
        // Track where symbols are referenced
        this.traverse(ast, (node) => {
            // Check for event references
            if (node.key === 'trigger_event' || node.key === 'add_to_list') {
                const symbolName = typeof node.value === 'string' ? node.value : this.findChildValue(node, 'id');
                if (symbolName) {
                    this.addReference(symbolName, uri, node, 'call');
                }
            }
            
            // Check for decision references
            if (node.key === 'has_character_flag' || node.key === 'has_global_variable') {
                const symbolName = node.value;
                if (typeof symbolName === 'string') {
                    this.addReference(symbolName, uri, node, 'trigger');
                }
            }
        });
    }
    
    /**
     * Add a reference to a symbol
     */
    private addReference(
        symbolName: string,
        uri: string,
        node: ASTNode,
        context: ReferenceLocation['context']
    ): void {
        if (!this.references.has(symbolName)) {
            // Check if symbol exists
            const symbols = this.findSymbolsByName(symbolName);
            if (symbols.length === 0) {
                // Undefined reference
                if (!this.undefinedReferences.has(symbolName)) {
                    this.undefinedReferences.set(symbolName, {
                        name: symbolName,
                        type: this.inferSymbolType(symbolName),
                        locations: []
                    });
                }
                this.undefinedReferences.get(symbolName)!.locations.push({
                    uri,
                    range: node.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    context
                });
                return;
            }
            
            this.references.set(symbolName, {
                symbol: symbols[0],
                locations: []
            });
        }
        
        this.references.get(symbolName)!.locations.push({
            uri,
            range: node.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            context
        });
    }
    
    /**
     * Extract localization keys
     */
    private extractLocalizationKeys(uri: string, ast: ASTNode): void {
        this.traverse(ast, (node) => {
            // Look for localization key patterns
            if (node.value && typeof node.value === 'string') {
                if (this.isLocalizationKey(node.value)) {
                    this.localizationKeys.add(node.value);
                }
            }
        });
    }
    
    /**
     * Build dependency graph
     */
    private buildDependencyGraph(uri: string): void {
        // Build dependencies between symbols
        for (const [symbolName, reference] of this.references) {
            const fromSymbols = reference.locations.map(loc => 
                this.findSymbolAtPosition(loc.uri, loc.range.start.line, loc.range.start.character)
            ).filter(s => s !== null) as Symbol[];
            
            for (const fromSymbol of fromSymbols) {
                const dependency: Dependency = {
                    from: fromSymbol,
                    to: reference.symbol,
                    type: 'requires'
                };
                
                const key = `${fromSymbol.uri}:${fromSymbol.name}`;
                if (!this.dependencies.has(key)) {
                    this.dependencies.set(key, []);
                }
                this.dependencies.get(key)!.push(dependency);
            }
        }
    }
    
    // Query methods
    
    /**
     * Get event metadata by ID
     */
    public getEvent(eventId: string): EventMetadata | undefined {
        return this.events.get(eventId);
    }
    
    /**
     * Get all events in a namespace
     */
    public getEventsByNamespace(namespace: string): EventMetadata[] {
        return this.eventsByNamespace.get(namespace) || [];
    }
    
    /**
     * Get decision metadata by ID
     */
    public getDecision(decisionId: string): DecisionMetadata | undefined {
        return this.decisions.get(decisionId);
    }
    
    /**
     * Get all references to a symbol
     */
    public getReferences(symbolName: string): Reference | undefined {
        return this.references.get(symbolName);
    }
    
    /**
     * Get dependencies for a symbol
     */
    public getDependencies(symbolUri: string, symbolName: string): Dependency[] {
        const key = `${symbolUri}:${symbolName}`;
        return this.dependencies.get(key) || [];
    }
    
    /**
     * Get event chain (events triggered by an event)
     */
    public getEventChain(eventId: string): string[] {
        return this.eventChains.get(eventId) || [];
    }
    
    /**
     * Get undefined references
     */
    public getUndefinedReferences(): UndefinedReference[] {
        return Array.from(this.undefinedReferences.values());
    }
    
    /**
     * Get all localization keys
     */
    public getLocalizationKeys(): string[] {
        return Array.from(this.localizationKeys);
    }
    
    /**
     * Check if a localization key is defined
     */
    public hasLocalizationKey(key: string): boolean {
        return this.localizationKeys.has(key);
    }
    
    /**
     * Get statistics
     */
    public getStatistics(): {
        totalDocuments: number;
        totalSymbols: number;
        symbolsByType: Record<string, number>;
    } {
        return {
            totalDocuments: this.events.size + this.decisions.size,
            totalSymbols: this.events.size + this.decisions.size + this.references.size + this.localizationKeys.size,
            symbolsByType: {
                events: this.events.size,
                decisions: this.decisions.size,
                references: this.references.size,
                undefinedReferences: this.undefinedReferences.size,
                localizationKeys: this.localizationKeys.size
            }
        };
    }
    
    // Helper methods
    
    private isEventType(key: string): boolean {
        return ['character_event', 'letter_event', 'activity_event', 'string_event', 'window_event', 'empty_event'].includes(key);
    }
    
    private extractEventId(node: ASTNode): string | null {
        // Look for id field
        if (node.children) {
            for (const child of node.children) {
                if (child.key === 'id') {
                    return typeof child.value === 'string' ? child.value : null;
                }
            }
        }
        return null;
    }
    
    private extractTriggers(node: ASTNode): string[] {
        const triggers: string[] = [];
        if (node.children) {
            for (const child of node.children) {
                if (child.key) {
                    triggers.push(child.key);
                }
            }
        }
        return triggers;
    }
    
    private extractEffects(node: ASTNode): string[] {
        const effects: string[] = [];
        if (node.children) {
            for (const child of node.children) {
                if (child.key) {
                    effects.push(child.key);
                }
            }
        }
        return effects;
    }
    
    private parsePortrait(node: ASTNode): PortraitConfig {
        const portrait: PortraitConfig = {};
        if (node.children) {
            for (const child of node.children) {
                switch (child.key) {
                    case 'character':
                        portrait.character = typeof child.value === 'string' ? child.value : undefined;
                        break;
                    case 'animation':
                        portrait.animation = typeof child.value === 'string' ? child.value : undefined;
                        break;
                }
            }
        }
        return portrait;
    }
    
    private findChildValue(node: ASTNode, key: string): string | null {
        if (node.children) {
            for (const child of node.children) {
                if (child.key === key) {
                    return typeof child.value === 'string' ? child.value : null;
                }
            }
        }
        return null;
    }
    
    private isLocalizationKey(value: string): boolean {
        // Localization keys typically end with _t, _desc, _tt, _name, etc.
        return value.endsWith('_t') || 
               value.endsWith('_desc') || 
               value.endsWith('_tt') || 
               value.endsWith('_name') ||
               value.endsWith('_tooltip') ||
               value.endsWith('_effect') ||
               value.endsWith('_trigger');
    }
    
    private inferSymbolType(name: string): SymbolType {
        // Infer type from name pattern
        if (name.includes('.')) return SymbolType.EVENT;
        if (name.startsWith('decision_')) return SymbolType.DECISION;
        if (name.startsWith('on_action_')) return SymbolType.ON_ACTION;
        return SymbolType.GENERIC;
    }
    
    private traverse(node: ASTNode, callback: (node: ASTNode) => void): void {
        callback(node);
        if (node.children) {
            for (const child of node.children) {
                this.traverse(child, callback);
            }
        }
    }
    
    private traverseForEvents(node: ASTNode, callback: (node: ASTNode) => void): void {
        if (this.isEventType(node.key || '')) {
            callback(node);
        }
        if (node.children) {
            for (const child of node.children) {
                this.traverseForEvents(child, callback);
            }
        }
    }
    
    private traverseForDecisions(node: ASTNode, callback: (node: ASTNode) => void): void {
        // Decisions are typically at top level in decision files
        if (node.type === NodeType.BLOCK && node.key && !this.isEventType(node.key)) {
            callback(node);
        }
        if (node.children) {
            for (const child of node.children) {
                this.traverseForDecisions(child, callback);
            }
        }
    }
    
    private findSymbolAtPosition(uri: string, line: number, character: number): Symbol | null {
        // Find symbol at specific position
        // This would use the basic indexer's functionality
        return null; // Placeholder
    }
}
