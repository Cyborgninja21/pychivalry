/**
 * Call Graph - Shared module for tracking call relationships between CK3 script symbols
 *
 * Tracks five types of call relationships:
 * - trigger_event invocations (event-to-event, decision-to-event, effect-to-event)
 * - Scripted effect invocations
 * - Scripted trigger invocations
 * - On-action to event connections
 * - Decision effect to event relationships
 *
 * Used by both CallHierarchyProvider (LSP call hierarchy) and CodeLensProvider (inline lenses).
 */

import { ASTNode, NodeType, Range } from './parser';
import { DocumentIndexer, SymbolType } from './indexer';

/**
 * How a call relationship was established
 */
export enum CallKind {
    /** trigger_event = { id = ... } or trigger_event = event_id */
    TRIGGER_EVENT = 'trigger_event',
    /** A scripted effect invoked by name in an effect block */
    SCRIPTED_EFFECT = 'scripted_effect',
    /** A scripted trigger invoked by name in a trigger block */
    SCRIPTED_TRIGGER = 'scripted_trigger',
    /** An on_action listing events in events = {} or random_events = {} */
    ON_ACTION_EVENT = 'on_action_event',
    /** A decision's effect block triggering an event */
    DECISION_EVENT = 'decision_event',
}

/**
 * A single directed edge in the call graph: one symbol invoking another.
 */
export interface CallEdge {
    /** The caller symbol name (e.g., "my_mod.0001", "my_custom_effect") */
    fromName: string;
    /** The callee symbol name (e.g., "my_mod.0002") */
    toName: string;
    /** The SymbolType of the caller */
    fromType: SymbolType;
    /** The SymbolType of the callee */
    toType: SymbolType;
    /** How the call is made */
    callKind: CallKind;
    /** URI of the file containing the call site */
    sourceUri: string;
    /** Range of the call site in the source file */
    sourceRange: Range;
}

/**
 * Result of circular reference detection
 */
export interface CircularReferenceInfo {
    hasCircular: boolean;
    cyclePath: string[];
}

/** Context entry for tracking the enclosing symbol during AST traversal */
interface TraversalContext {
    name: string;
    type: SymbolType;
    /** Whether we're inside an effect block (for scripted effect detection) */
    inEffect: boolean;
    /** Whether we're inside a trigger block (for scripted trigger detection) */
    inTrigger: boolean;
}

/** Keys that indicate we're entering an effect context */
const EFFECT_CONTEXT_KEYS = new Set([
    'immediate', 'after', 'effect', 'on_success', 'on_fail',
    'on_potential_fail', 'on_invalidated',
]);

/** Keys that indicate we're entering a trigger context */
const TRIGGER_CONTEXT_KEYS = new Set([
    'trigger', 'is_shown', 'is_valid', 'is_valid_showing_failures_only',
    'can_use_triggers', 'potential',
]);

/** Event type keys in CK3 */
const EVENT_TYPES = new Set([
    'character_event', 'letter_event', 'activity_event',
    'string_event', 'window_event', 'empty_event',
]);

/**
 * Call Graph engine that tracks call relationships across the workspace.
 *
 * Dual-indexed for efficient lookup:
 * - outgoingEdges: caller name -> edges (for "what does this call?")
 * - incomingEdges: callee name -> edges (for "what calls this?")
 * - edgesByUri: source URI -> edges (for per-document clearing)
 */
export class CallGraph {
    private outgoingEdges: Map<string, CallEdge[]> = new Map();
    private incomingEdges: Map<string, CallEdge[]> = new Map();
    private edgesByUri: Map<string, CallEdge[]> = new Map();

    constructor(private indexer: DocumentIndexer) {}

    /**
     * Clear all edges originating from a document URI.
     * Called before re-indexing a document.
     */
    public clearDocument(uri: string): void {
        const edges = this.edgesByUri.get(uri);
        if (!edges) return;

        for (const edge of edges) {
            // Remove from outgoing index
            const outgoing = this.outgoingEdges.get(edge.fromName);
            if (outgoing) {
                const filtered = outgoing.filter(e => e.sourceUri !== uri);
                if (filtered.length === 0) {
                    this.outgoingEdges.delete(edge.fromName);
                } else {
                    this.outgoingEdges.set(edge.fromName, filtered);
                }
            }

            // Remove from incoming index
            const incoming = this.incomingEdges.get(edge.toName);
            if (incoming) {
                const filtered = incoming.filter(e => e.sourceUri !== uri);
                if (filtered.length === 0) {
                    this.incomingEdges.delete(edge.toName);
                } else {
                    this.incomingEdges.set(edge.toName, filtered);
                }
            }
        }

        this.edgesByUri.delete(uri);
    }

    /**
     * Build call edges from a parsed AST for a given document URI.
     * Traverses the AST looking for call patterns and creates edges.
     */
    public buildFromAST(uri: string, ast: ASTNode): void {
        // Pre-collect known scripted effect and trigger names for O(1) lookup
        const knownEffects = new Set<string>(
            this.indexer.findSymbolsByType(SymbolType.SCRIPTED_EFFECT).map(s => s.name)
        );
        const knownTriggers = new Set<string>(
            this.indexer.findSymbolsByType(SymbolType.SCRIPTED_TRIGGER).map(s => s.name)
        );

        // Traverse top-level children to find symbol definitions
        if (!ast.children) return;

        for (const topNode of ast.children) {
            if (!topNode.key || !topNode.children) continue;

            // Detect the enclosing symbol type
            if (EVENT_TYPES.has(topNode.key)) {
                // Format 2: character_event = { id = my_mod.0001 ... }
                const eventId = this.findChildValue(topNode, 'id');
                if (eventId) {
                    this.processEventNode(topNode, eventId, uri, knownEffects, knownTriggers);
                }
            } else if (this.isEventId(topNode.key)) {
                // Format 1: my_mod.0001 = { type = character_event ... }
                this.processEventNode(topNode, topNode.key, uri, knownEffects, knownTriggers);
            } else if (this.isOnActionBlock(topNode)) {
                // On-action definition
                this.processOnActionNode(topNode, topNode.key, uri);
            } else if (topNode.children) {
                // Could be a decision, scripted effect, or scripted trigger definition
                const symbolType = this.inferContextType(topNode.key, uri);
                if (symbolType) {
                    this.processGenericBlock(topNode, topNode.key, symbolType, uri, knownEffects, knownTriggers);
                }
            }
        }
    }

    /**
     * Get all outgoing calls from a symbol.
     */
    public getOutgoingCalls(symbolName: string): CallEdge[] {
        return this.outgoingEdges.get(symbolName) || [];
    }

    /**
     * Get all incoming calls to a symbol.
     */
    public getIncomingCalls(symbolName: string): CallEdge[] {
        return this.incomingEdges.get(symbolName) || [];
    }

    /**
     * BFS-based circular reference detection starting from a symbol.
     */
    public detectCircularReferences(symbolName: string): CircularReferenceInfo {
        const visited = new Set<string>([symbolName]);
        const queue: Array<{ name: string; path: string[] }> = [];

        // Seed with direct outgoing calls
        const directCalls = this.getOutgoingCalls(symbolName);
        for (const edge of directCalls) {
            queue.push({ name: edge.toName, path: [symbolName, edge.toName] });
        }

        while (queue.length > 0) {
            const { name, path } = queue.shift()!;
            if (name === symbolName) {
                return { hasCircular: true, cyclePath: path };
            }
            if (visited.has(name)) continue;
            visited.add(name);

            const nextCalls = this.getOutgoingCalls(name);
            for (const edge of nextCalls) {
                queue.push({ name: edge.toName, path: [...path, edge.toName] });
            }
        }

        return { hasCircular: false, cyclePath: [] };
    }

    // --- Private Implementation ---

    private addEdge(edge: CallEdge): void {
        // Add to outgoing index
        if (!this.outgoingEdges.has(edge.fromName)) {
            this.outgoingEdges.set(edge.fromName, []);
        }
        this.outgoingEdges.get(edge.fromName)!.push(edge);

        // Add to incoming index
        if (!this.incomingEdges.has(edge.toName)) {
            this.incomingEdges.set(edge.toName, []);
        }
        this.incomingEdges.get(edge.toName)!.push(edge);

        // Add to URI index
        if (!this.edgesByUri.has(edge.sourceUri)) {
            this.edgesByUri.set(edge.sourceUri, []);
        }
        this.edgesByUri.get(edge.sourceUri)!.push(edge);
    }

    /**
     * Process an event definition node: find trigger_event calls, scripted effect/trigger invocations
     */
    private processEventNode(
        node: ASTNode,
        eventId: string,
        uri: string,
        knownEffects: Set<string>,
        knownTriggers: Set<string>,
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (!child.key) continue;

            if (child.key === 'trigger') {
                // Trigger context — look for scripted triggers
                this.findScriptedTriggerCalls(child, eventId, SymbolType.EVENT, uri, knownTriggers);
            } else if (EFFECT_CONTEXT_KEYS.has(child.key)) {
                // Effect context — look for trigger_event and scripted effects
                this.findTriggerEventCalls(child, eventId, SymbolType.EVENT, CallKind.TRIGGER_EVENT, uri);
                this.findScriptedEffectCalls(child, eventId, SymbolType.EVENT, uri, knownEffects);
            } else if (child.key === 'option') {
                // Options have both trigger and effect sub-blocks
                this.processOptionNode(child, eventId, uri, knownEffects, knownTriggers);
            }
        }
    }

    /**
     * Process an option block within an event
     */
    private processOptionNode(
        node: ASTNode,
        eventId: string,
        uri: string,
        knownEffects: Set<string>,
        knownTriggers: Set<string>,
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (!child.key) continue;

            if (child.key === 'trigger') {
                this.findScriptedTriggerCalls(child, eventId, SymbolType.EVENT, uri, knownTriggers);
            } else if (child.key !== 'name' && child.key !== 'ai_chance') {
                // Anything else in an option is effect context
                this.findTriggerEventCalls(child, eventId, SymbolType.EVENT, CallKind.TRIGGER_EVENT, uri);
                this.findScriptedEffectCalls(child, eventId, SymbolType.EVENT, uri, knownEffects);
            }
        }
    }

    /**
     * Process an on-action block: find event listings
     */
    private processOnActionNode(node: ASTNode, actionName: string, uri: string): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (!child.key) continue;

            if (child.key === 'events' && child.children) {
                // events = { event_id1 event_id2 ... }
                for (const eventNode of child.children) {
                    const eventId = eventNode.key || (typeof eventNode.value === 'string' ? eventNode.value : null);
                    if (eventId) {
                        this.addEdge({
                            fromName: actionName,
                            toName: eventId,
                            fromType: SymbolType.ON_ACTION,
                            toType: SymbolType.EVENT,
                            callKind: CallKind.ON_ACTION_EVENT,
                            sourceUri: uri,
                            sourceRange: eventNode.range,
                        });
                    }
                }
            } else if (child.key === 'random_events' && child.children) {
                // random_events = { N = { id = event_id } ... }
                this.extractRandomEvents(child, actionName, uri);
            } else if (child.key === 'first_valid' && child.children) {
                // first_valid = { event_id1 event_id2 ... }
                for (const eventNode of child.children) {
                    const eventId = eventNode.key || (typeof eventNode.value === 'string' ? eventNode.value : null);
                    if (eventId) {
                        this.addEdge({
                            fromName: actionName,
                            toName: eventId,
                            fromType: SymbolType.ON_ACTION,
                            toType: SymbolType.EVENT,
                            callKind: CallKind.ON_ACTION_EVENT,
                            sourceUri: uri,
                            sourceRange: eventNode.range,
                        });
                    }
                }
            } else if (child.key === 'on_actions' && child.children) {
                // Nested on-action references
                for (const nestedAction of child.children) {
                    const nestedName = nestedAction.key || (typeof nestedAction.value === 'string' ? nestedAction.value : null);
                    if (nestedName) {
                        this.addEdge({
                            fromName: actionName,
                            toName: nestedName,
                            fromType: SymbolType.ON_ACTION,
                            toType: SymbolType.ON_ACTION,
                            callKind: CallKind.ON_ACTION_EVENT,
                            sourceUri: uri,
                            sourceRange: nestedAction.range,
                        });
                    }
                }
            }
        }
    }

    /**
     * Process a generic block (decision, scripted effect, scripted trigger)
     */
    private processGenericBlock(
        node: ASTNode,
        name: string,
        symbolType: SymbolType,
        uri: string,
        knownEffects: Set<string>,
        knownTriggers: Set<string>,
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (!child.key) continue;

            if (TRIGGER_CONTEXT_KEYS.has(child.key)) {
                this.findScriptedTriggerCalls(child, name, symbolType, uri, knownTriggers);
            } else if (EFFECT_CONTEXT_KEYS.has(child.key)) {
                const callKind = symbolType === SymbolType.DECISION
                    ? CallKind.DECISION_EVENT
                    : CallKind.TRIGGER_EVENT;
                this.findTriggerEventCalls(child, name, symbolType, callKind, uri);
                this.findScriptedEffectCalls(child, name, symbolType, uri, knownEffects);
            }
        }
    }

    /**
     * Recursively find trigger_event calls within a node
     */
    private findTriggerEventCalls(
        node: ASTNode,
        callerName: string,
        callerType: SymbolType,
        callKind: CallKind,
        uri: string,
    ): void {
        this.traverse(node, (n) => {
            if (n.key === 'trigger_event') {
                const eventId = typeof n.value === 'string'
                    ? n.value
                    : this.findChildValue(n, 'id');
                if (eventId) {
                    this.addEdge({
                        fromName: callerName,
                        toName: eventId,
                        fromType: callerType,
                        toType: SymbolType.EVENT,
                        callKind,
                        sourceUri: uri,
                        sourceRange: n.range,
                    });
                }
            }
        });
    }

    /**
     * Find scripted effect invocations within an effect context node
     */
    private findScriptedEffectCalls(
        node: ASTNode,
        callerName: string,
        callerType: SymbolType,
        uri: string,
        knownEffects: Set<string>,
    ): void {
        this.traverse(node, (n) => {
            if (n.key && knownEffects.has(n.key)) {
                this.addEdge({
                    fromName: callerName,
                    toName: n.key,
                    fromType: callerType,
                    toType: SymbolType.SCRIPTED_EFFECT,
                    callKind: CallKind.SCRIPTED_EFFECT,
                    sourceUri: uri,
                    sourceRange: n.range,
                });
            }
        });
    }

    /**
     * Find scripted trigger invocations within a trigger context node
     */
    private findScriptedTriggerCalls(
        node: ASTNode,
        callerName: string,
        callerType: SymbolType,
        uri: string,
        knownTriggers: Set<string>,
    ): void {
        this.traverse(node, (n) => {
            if (n.key && knownTriggers.has(n.key)) {
                this.addEdge({
                    fromName: callerName,
                    toName: n.key,
                    fromType: callerType,
                    toType: SymbolType.SCRIPTED_TRIGGER,
                    callKind: CallKind.SCRIPTED_TRIGGER,
                    sourceUri: uri,
                    sourceRange: n.range,
                });
            }
        });
    }

    /**
     * Extract event references from random_events blocks
     */
    private extractRandomEvents(node: ASTNode, actionName: string, uri: string): void {
        if (!node.children) return;

        for (const child of node.children) {
            // random_events entries can be: weight = { id = event_id } or just event_id
            if (child.children) {
                const eventId = this.findChildValue(child, 'id');
                if (eventId) {
                    this.addEdge({
                        fromName: actionName,
                        toName: eventId,
                        fromType: SymbolType.ON_ACTION,
                        toType: SymbolType.EVENT,
                        callKind: CallKind.ON_ACTION_EVENT,
                        sourceUri: uri,
                        sourceRange: child.range,
                    });
                }
            } else {
                const eventId = typeof child.value === 'string' ? child.value : null;
                if (eventId && eventId.includes('.')) {
                    this.addEdge({
                        fromName: actionName,
                        toName: eventId,
                        fromType: SymbolType.ON_ACTION,
                        toType: SymbolType.EVENT,
                        callKind: CallKind.ON_ACTION_EVENT,
                        sourceUri: uri,
                        sourceRange: child.range,
                    });
                }
            }
        }
    }

    // --- Utility Methods ---

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

    private traverse(node: ASTNode, callback: (node: ASTNode) => void): void {
        callback(node);
        if (node.children) {
            for (const child of node.children) {
                this.traverse(child, callback);
            }
        }
    }

    private isOnActionBlock(node: ASTNode): boolean {
        if (!node.key) return false;
        // On-actions typically start with "on_" prefix
        return node.key.startsWith('on_') && node.children !== undefined;
    }

    /**
     * Check if a name looks like an event ID (namespace.number format)
     */
    private isEventId(name: string): boolean {
        return /^\w+\.\d+$/.test(name);
    }

    /**
     * Infer the symbol type from its name and context.
     * Returns null if we can't determine the type.
     */
    private inferContextType(name: string, _uri: string): SymbolType | null {
        // Check if this name is a known symbol
        const symbols = this.indexer.findSymbolsByName(name);
        if (symbols.length > 0) {
            return symbols[0].type;
        }
        // Heuristic fallback
        if (name.includes('.')) return SymbolType.EVENT;
        return null;
    }
}
