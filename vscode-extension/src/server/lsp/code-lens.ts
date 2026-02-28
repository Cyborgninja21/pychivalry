/**
 * Enhanced Code Lens Provider - Provides comprehensive inline actionable information
 * 
 * Features:
 * - Reference counts for symbols (events, decisions, scripted effects/triggers)
 * - Complexity metrics with visual indicators
 * - Event chain visualization (triggers/triggered by)
 * - Namespace statistics
 * - Localization coverage
 * - Clickable actions (find references, navigate, rename)
 * - Context-specific lenses for different content types
 */

import {
    CodeLens,
    Command,
    Location,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { DocumentIndexer, SymbolType } from '../core/indexer';
import { EnhancedIndexer } from '../core/indexer-enhanced';
import { LocalizationIndex } from '../core/localization-index';

/**
 * Code lens configuration
 */
export interface CodeLensConfig {
    showReferenceCounts: boolean;
    showComplexity: boolean;
    showEventChains: boolean;
    showNamespaceStats: boolean;
    showLocalization: boolean;
    minLinesForLens: number;
    maxLensesPerDocument: number;
}

/**
 * Complexity metrics for code blocks
 */
interface ComplexityMetrics {
    lines: number;
    depth: number;
    statements: number;
    branches: number;
    score: number;
    level: 'simple' | 'moderate' | 'complex';
    icon: string;
}

/**
 * Reference information
 */
interface ReferenceInfo {
    count: number;
    locations: Location[];
    isUnused: boolean;
}

/**
 * Event chain information
 */
interface EventChain {
    source: string;
    targets: string[];
    callers: string[];
    hasCircularRef: boolean;
}

/**
 * Namespace statistics
 */
interface NamespaceStats {
    name: string;
    eventCount: number;
    decisionCount: number;
    localizationCoverage: number;
    localizationTotal: number;
    fileCount: number;
}

/**
 * Context for lens generation
 */
interface LensContext {
    document: TextDocument;
    indexer: DocumentIndexer;
    config: CodeLensConfig;
    namespaceCache: Map<string, NamespaceStats>;
    referenceCache: Map<string, ReferenceInfo>;
}

/**
 * Lens generator interface
 */
interface LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean;
    generate(node: ASTNode, context: LensContext): CodeLens[];
}

/**
 * Enhanced Code Lens Provider
 */
export class CodeLensProvider {
    private config: CodeLensConfig = {
        showReferenceCounts: true,
        showComplexity: true,
        showEventChains: true,
        showNamespaceStats: true,
        showLocalization: true,
        minLinesForLens: 10,
        maxLensesPerDocument: 50,
    };

    private generators: LensGenerator[];
    private referenceCache: Map<string, ReferenceInfo> = new Map();
    private namespaceCache: Map<string, NamespaceStats> = new Map();
    private cacheTimestamp: number = 0;
    private readonly cacheTTL = 5000; // 5 seconds
    private static readonly MAX_REFERENCE_CACHE = 1000;
    private static readonly MAX_NAMESPACE_CACHE = 1000;

    constructor(
        private parser: CK3Parser,
        private indexer: DocumentIndexer,
        private localizationIndex?: LocalizationIndex
    ) {
        // Initialize lens generators
        this.generators = [
            new EventLensGenerator(),
            new DecisionLensGenerator(),
            new ScriptedEffectLensGenerator(),
            new ScriptedTriggerLensGenerator(),
            new ComplexityLensGenerator(),
            new NamespaceLensGenerator(),
            new LocalizationLensGenerator(),
        ];
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<CodeLensConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Provide code lenses
     */
    public async provideCodeLens(document: TextDocument): Promise<CodeLens[]> {
        const parsed = this.parser.parse(document.getText());
        const lenses: CodeLens[] = [];

        // Clear cache if stale
        if (Date.now() - this.cacheTimestamp > this.cacheTTL) {
            this.clearCache();
        }

        // Create context
        const context: LensContext = {
            document,
            indexer: this.indexer,
            config: this.config,
            namespaceCache: this.namespaceCache,
            referenceCache: this.referenceCache,
        };

        // Collect lenses from AST
        this.collectCodeLenses(parsed.ast, lenses, context);

        // Limit number of lenses
        if (lenses.length > this.config.maxLensesPerDocument) {
            return lenses.slice(0, this.config.maxLensesPerDocument);
        }

        return lenses;
    }

    /**
     * Resolve code lens (compute expensive data on demand)
     */
    public async resolveCodeLens(lens: CodeLens): Promise<CodeLens> {
        // If the lens has a data payload with a symbol name, refresh its reference count
        if (lens.data && typeof lens.data === 'object' && lens.data.symbolName) {
            const symbolName = lens.data.symbolName;
            const symbols = this.indexer.findSymbolsByName(symbolName);
            const refCount = Math.max(0, symbols.length - 1);
            lens.command = Command.create(
                `${refCount} reference${refCount !== 1 ? 's' : ''}`,
                lens.command?.command || 'ck3.showReferences',
                ...(lens.command?.arguments || [])
            );
        }
        return lens;
    }

    /**
     * Collect code lenses from AST
     */
    private collectCodeLenses(
        node: ASTNode,
        lenses: CodeLens[],
        context: LensContext
    ): void {
        if (!node.children) {
            return;
        }

        for (const child of node.children) {
            // Try each generator
            for (const generator of this.generators) {
                if (generator.canApply(child, context)) {
                    const generatedLenses = generator.generate(child, context);
                    lenses.push(...generatedLenses);
                }
            }

            // Recurse into children
            if (child.children) {
                this.collectCodeLenses(child, lenses, context);
            }
        }
    }

    /**
     * Clear caches
     */
    private clearCache(): void {
        this.referenceCache.clear();
        this.namespaceCache.clear();
        this.cacheTimestamp = Date.now();
    }

    /**
     * Find references to a symbol
     */
    private findReferences(symbolName: string, context: LensContext): ReferenceInfo {
        // Check cache
        if (context.referenceCache.has(symbolName)) {
            return context.referenceCache.get(symbolName)!;
        }

        // Find in indexer
        const symbols = context.indexer.findSymbolsByName(symbolName);
        const locations: Location[] = symbols.map(s => ({
            uri: s.uri,
            range: s.range,
        }));

        const info: ReferenceInfo = {
            count: Math.max(0, locations.length - 1), // Subtract definition
            locations,
            isUnused: locations.length <= 1,
        };

        // Cache result (with size cap)
        if (context.referenceCache.size >= CodeLensProvider.MAX_REFERENCE_CACHE) {
            const firstKey = context.referenceCache.keys().next().value;
            if (firstKey !== undefined) context.referenceCache.delete(firstKey);
        }
        context.referenceCache.set(symbolName, info);
        return info;
    }

    /**
     * Calculate complexity metrics
     */
    private calculateComplexity(node: ASTNode): ComplexityMetrics {
        // Guard against missing range
        if (!node.range) {
            return {
                lines: 0,
                depth: 0,
                statements: 0,
                branches: 0,
                score: 0,
                level: 'simple',
                icon: '🟢',
            };
        }

        const lines = node.range.end.line - node.range.start.line + 1;
        const depth = this.calculateMaxDepth(node);
        const statements = this.countStatements(node);
        const branches = this.countBranches(node);

        // Calculate complexity score
        const score = lines * 0.1 + depth * 2 + statements * 0.5 + branches * 3;

        // Determine level - use AND logic for clear categorization
        let level: 'simple' | 'moderate' | 'complex';
        let icon: string;

        if (lines < 50 && score < 20) {
            level = 'simple';
            icon = '🟢';
        } else if (lines < 150 && score < 50) {
            level = 'moderate';
            icon = '🟡';
        } else {
            level = 'complex';
            icon = '🔴';
        }

        return { lines, depth, statements, branches, score, level, icon };
    }

    /**
     * Calculate maximum nesting depth
     */
    private calculateMaxDepth(node: ASTNode, currentDepth: number = 0): number {
        if (!node.children || node.children.length === 0) {
            return currentDepth;
        }

        let maxChildDepth = currentDepth;
        for (const child of node.children) {
            if (child.type === NodeType.BLOCK) {
                const childDepth = this.calculateMaxDepth(child, currentDepth + 1);
                maxChildDepth = Math.max(maxChildDepth, childDepth);
            } else {
                const childDepth = this.calculateMaxDepth(child, currentDepth);
                maxChildDepth = Math.max(maxChildDepth, childDepth);
            }
        }

        return maxChildDepth;
    }

    /**
     * Count statements in a node
     */
    private countStatements(node: ASTNode): number {
        if (!node.children) return 0;

        let count = 0;
        for (const child of node.children) {
            if (child.type === NodeType.ASSIGNMENT || child.type === NodeType.COMPARISON) {
                count++;
            }
            if (child.children) {
                count += this.countStatements(child);
            }
        }

        return count;
    }

    /**
     * Count branches (options, conditionals)
     */
    private countBranches(node: ASTNode): number {
        if (!node.children) return 0;

        let count = 0;
        for (const child of node.children) {
            if (child.key === 'option' || child.key === 'if' || child.key === 'else_if') {
                count++;
            }
            if (child.children) {
                count += this.countBranches(child);
            }
        }

        return count;
    }

    /**
     * Get namespace statistics
     */
    private getNamespaceStats(namespace: string, context: LensContext): NamespaceStats {
        // Check cache
        if (context.namespaceCache.has(namespace)) {
            return context.namespaceCache.get(namespace)!;
        }

        // Calculate stats
        const events = context.indexer.findSymbolsByType(SymbolType.EVENT)
            .filter(s => s.name.startsWith(namespace + '.'));
        const decisions = context.indexer.findSymbolsByType(SymbolType.DECISION)
            .filter(s => s.name.startsWith(namespace + '_'));

        // Localization coverage — check actual keys via LocalizationIndex
        const locSuffixes = ['.t', '.desc', '.tooltip']; // CK3 loc key suffixes
        const locKeys = events.length * locSuffixes.length;
        let locFound = 0;
        if (this.localizationIndex) {
            for (const ev of events) {
                for (const suffix of locSuffixes) {
                    if (this.localizationIndex.hasKey(ev.name + suffix)) {
                        locFound++;
                    }
                }
            }
        }

        const stats: NamespaceStats = {
            name: namespace,
            eventCount: events.length,
            decisionCount: decisions.length,
            localizationCoverage: locFound,
            localizationTotal: locKeys,
            fileCount: new Set(events.map(e => e.uri)).size,
        };

        // Cache result (with size cap)
        if (context.namespaceCache.size >= CodeLensProvider.MAX_NAMESPACE_CACHE) {
            const firstKey = context.namespaceCache.keys().next().value;
            if (firstKey !== undefined) context.namespaceCache.delete(firstKey);
        }
        context.namespaceCache.set(namespace, stats);
        return stats;
    }
}

/**
 * Event lens generator
 */
class EventLensGenerator implements LensGenerator {
    canApply(node: ASTNode): boolean {
        // Match event definitions (namespace.number pattern)
        return !!(node.key && /^[a-z_]+\.\d+$/.test(node.key) && node.type === NodeType.ASSIGNMENT);
    }

    generate(node: ASTNode, context: LensContext): CodeLens[] {
        const lenses: CodeLens[] = [];
        const eventId = node.key!;

        // Reference count lens
        if (context.config.showReferenceCounts) {
            const references = this.findReferences(eventId, context);
            const label = references.isUnused
                ? '0 references • unused'
                : `${references.count} reference${references.count !== 1 ? 's' : ''}`;

            lenses.push({
                range: node.range,
                command: Command.create(
                    label,
                    'ck3.showReferences',
                    context.document.uri,
                    node.range.start
                ),
                data: { symbolName: eventId },
            });
        }

        // Complexity lens
        if (context.config.showComplexity && node.children) {
            const metrics = this.calculateComplexity(node);
            lenses.push({
                range: node.range,
                command: Command.create(
                    `${metrics.icon} ${metrics.lines} lines, ${this.countOptions(node)} options, depth ${metrics.depth}`,
                    ''
                ),
            });
        }

        // Event chain lens
        if (context.config.showEventChains) {
            const chain = this.analyzeEventChain(eventId, context);
            if (chain.targets.length > 0) {
                lenses.push({
                    range: node.range,
                    command: Command.create(
                        `→ triggers ${chain.targets.length} event${chain.targets.length !== 1 ? 's' : ''}`,
                        'ck3.showEventChain',
                        eventId
                    ),
                });
            }
            if (chain.callers.length > 0) {
                lenses.push({
                    range: node.range,
                    command: Command.create(
                        `← triggered by ${chain.callers.length} event${chain.callers.length !== 1 ? 's' : ''}`,
                        'ck3.showCallers',
                        eventId
                    ),
                });
            }
            if (chain.hasCircularRef) {
                lenses.push({
                    range: node.range,
                    command: Command.create(
                        '⚠ circular reference detected',
                        'ck3.showCircularReference',
                        eventId
                    ),
                });
            }
        }

        return lenses;
    }

    private findReferences(symbolName: string, context: LensContext): ReferenceInfo {
        if (context.referenceCache.has(symbolName)) {
            return context.referenceCache.get(symbolName)!;
        }

        const symbols = context.indexer.findSymbolsByName(symbolName);
        const info: ReferenceInfo = {
            count: Math.max(0, symbols.length - 1),
            locations: symbols.map(s => ({ uri: s.uri, range: s.range })),
            isUnused: symbols.length <= 1,
        };

        context.referenceCache.set(symbolName, info);
        return info;
    }

    private calculateComplexity(node: ASTNode): ComplexityMetrics {
        const lines = node.range.end.line - node.range.start.line + 1;
        const depth = this.calculateMaxDepth(node, 0);
        const statements = this.countStatements(node);
        const options = this.countOptions(node);

        const score = lines * 0.1 + depth * 2 + statements * 0.5 + options * 5;

        let level: 'simple' | 'moderate' | 'complex';
        let icon: string;

        if (lines < 50 && options < 3) {
            level = 'simple';
            icon = '🟢';
        } else if (lines < 150 && options < 5) {
            level = 'moderate';
            icon = '🟡';
        } else {
            level = 'complex';
            icon = '🔴';
        }

        return { lines, depth, statements, branches: options, score, level, icon };
    }

    private calculateMaxDepth(node: ASTNode, depth: number): number {
        if (!node.children) {
            return depth;
        }
        let max = depth;
        for (const child of node.children) {
            if (child.type === NodeType.BLOCK) {
                max = Math.max(max, this.calculateMaxDepth(child, depth + 1));
            }
        }
        return max;
    }

    private countStatements(node: ASTNode): number {
        if (!node.children) {
            return 0;
        }
        return node.children.reduce((sum, child) => {
            const count = child.type === NodeType.ASSIGNMENT ? 1 : 0;
            return sum + count + this.countStatements(child);
        }, 0);
    }

    private countOptions(node: ASTNode): number {
        if (!node.children) {
            return 0;
        }
        return node.children.reduce((sum, child) => {
            const count = child.key === 'option' ? 1 : 0;
            return sum + count + this.countOptions(child);
        }, 0);
    }

    private analyzeEventChain(eventId: string, context: LensContext): EventChain {
        const targets: string[] = [];
        const callers: string[] = [];
        let hasCircularRef = false;

        // Use EnhancedIndexer if available for event chain data
        const indexer = context.indexer;
        if (indexer instanceof EnhancedIndexer) {
            // Get events triggered by this event
            const triggered = indexer.getEventChain(eventId);
            targets.push(...triggered);

            // Check if any of the triggered events chain back to this one (circular)
            const visited = new Set<string>([eventId]);
            const queue = [...triggered];
            while (queue.length > 0) {
                const next = queue.shift()!;
                if (next === eventId) {
                    hasCircularRef = true;
                    break;
                }
                if (visited.has(next)) continue;
                visited.add(next);
                const nextTargets = indexer.getEventChain(next);
                queue.push(...nextTargets);
            }

            // Find callers: events that trigger this event
            // Search all event symbols for chains that include this eventId
            const allEvents = indexer.findSymbolsByType(SymbolType.EVENT);
            for (const eventSymbol of allEvents) {
                if (eventSymbol.name === eventId) continue;
                const chain = indexer.getEventChain(eventSymbol.name);
                if (chain.includes(eventId)) {
                    callers.push(eventSymbol.name);
                }
            }
        }

        return { source: eventId, targets, callers, hasCircularRef };
    }
}

/**
 * Decision lens generator
 */
class DecisionLensGenerator implements LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean {
        // Match decision definitions: named blocks in decision files
        if (!node.key || node.type !== NodeType.ASSIGNMENT || !node.children) return false;
        if (node.key.includes('.') || /^\d+$/.test(node.key)) return false;
        return this.isDecisionContext(context);
    }

    generate(node: ASTNode, context: LensContext): CodeLens[] {
        const lenses: CodeLens[] = [];
        const decisionId = node.key!;

        if (context.config.showReferenceCounts) {
            const references = this.findReferences(decisionId, context);
            lenses.push({
                range: node.range,
                command: Command.create(
                    `${references.count} reference${references.count !== 1 ? 's' : ''}`,
                    'ck3.showReferences',
                    context.document.uri,
                    node.range.start
                ),
                data: { symbolName: decisionId },
            });
        }

        if (context.config.showComplexity && node.children) {
            const conditions = this.countConditions(node);
            const effects = this.countEffects(node);
            lenses.push({
                range: node.range,
                command: Command.create(
                    `${conditions} conditions, ${effects} effects`,
                    ''
                ),
            });
        }

        return lenses;
    }

    private isDecisionContext(context: LensContext): boolean {
        // Check if the document is in a decisions directory
        const uri = context.document.uri.toLowerCase();
        return uri.includes('decision');
    }

    private findReferences(symbolName: string, context: LensContext): ReferenceInfo {
        const symbols = context.indexer.findSymbolsByName(symbolName);
        return {
            count: Math.max(0, symbols.length - 1),
            locations: symbols.map(s => ({ uri: s.uri, range: s.range })),
            isUnused: symbols.length <= 1,
        };
    }

    private countConditions(node: ASTNode): number {
        if (!node.children) {
            return 0;
        }
        return node.children.reduce((sum, child) => {
            const isCondition = child.key === 'is_shown' || child.key === 'is_valid' ||
                               child.key === 'is_valid_showing_failures_only';
            return sum + (isCondition ? 1 : 0) + this.countConditions(child);
        }, 0);
    }

    private countEffects(node: ASTNode): number {
        if (!node.children) {
            return 0;
        }
        return node.children.reduce((sum, child) => {
            const isEffect = child.key === 'effect';
            return sum + (isEffect ? 1 : 0) + this.countEffects(child);
        }, 0);
    }
}

/**
 * Scripted effect lens generator - only applies in scripted_effects files/contexts
 */
class ScriptedEffectLensGenerator implements LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean {
        if (!node.key || node.type !== NodeType.ASSIGNMENT || !node.children) return false;
        if (node.key.includes('.') || /^\d+$/.test(node.key)) return false;
        // Only match if the document URI suggests scripted_effects context
        const uri = context.document.uri.toLowerCase();
        return uri.includes('scripted_effect');
    }

    generate(node: ASTNode, context: LensContext): CodeLens[] {
        const lenses: CodeLens[] = [];
        const effectName = node.key!;

        if (context.config.showReferenceCounts) {
            const symbols = context.indexer.findSymbolsByName(effectName);
            const refCount = Math.max(0, symbols.length - 1);
            lenses.push({
                range: node.range,
                command: Command.create(
                    `scripted_effect: ${refCount} reference${refCount !== 1 ? 's' : ''}`,
                    'ck3.showReferences',
                    context.document.uri,
                    node.range.start
                ),
                data: { symbolName: effectName },
            });
        }

        return lenses;
    }
}

/**
 * Scripted trigger lens generator - only applies in scripted_triggers files/contexts
 */
class ScriptedTriggerLensGenerator implements LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean {
        if (!node.key || node.type !== NodeType.ASSIGNMENT || !node.children) return false;
        if (node.key.includes('.') || /^\d+$/.test(node.key)) return false;
        // Only match if the document URI suggests scripted_triggers context
        const uri = context.document.uri.toLowerCase();
        return uri.includes('scripted_trigger');
    }

    generate(node: ASTNode, context: LensContext): CodeLens[] {
        const lenses: CodeLens[] = [];
        const triggerName = node.key!;

        if (context.config.showReferenceCounts) {
            const symbols = context.indexer.findSymbolsByName(triggerName);
            const refCount = Math.max(0, symbols.length - 1);
            lenses.push({
                range: node.range,
                command: Command.create(
                    `scripted_trigger: ${refCount} reference${refCount !== 1 ? 's' : ''}`,
                    'ck3.showReferences',
                    context.document.uri,
                    node.range.start
                ),
                data: { symbolName: triggerName },
            });
        }

        return lenses;
    }
}

/**
 * Complexity lens generator
 */
class ComplexityLensGenerator implements LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean {
        if (!context.config.showComplexity) {
            return false;
        }
        const lines = node.range.end.line - node.range.start.line + 1;
        return node.type === NodeType.BLOCK && lines >= context.config.minLinesForLens;
    }

    generate(node: ASTNode): CodeLens[] {
        const lines = node.range.end.line - node.range.start.line + 1;
        return [{
            range: node.range,
            command: Command.create(
                `${lines} lines`,
                ''
            ),
        }];
    }
}

/**
 * Namespace lens generator
 */
class NamespaceLensGenerator implements LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean {
        if (!context.config.showNamespaceStats) {
            return false;
        }
        // Match namespace declarations: namespace = my_namespace
        return !!(node.key === 'namespace' && node.type === NodeType.ASSIGNMENT && node.value);
    }

    generate(node: ASTNode, context: LensContext): CodeLens[] {
        const lenses: CodeLens[] = [];
        const namespace = String(node.value);

        // Count events in this namespace via the indexer
        const symbols = context.indexer.findSymbolsByName(namespace);
        const eventPattern = new RegExp(`^${namespace}\\.\\d+$`);

        // Count events matching namespace.NNN pattern
        let eventCount = 0;
        const allSymbols = context.indexer.getDocumentSymbols(context.document.uri);
        for (const sym of allSymbols) {
            if (eventPattern.test(sym.name)) {
                eventCount++;
            }
        }

        lenses.push({
            range: node.range,
            command: Command.create(
                `namespace "${namespace}" - ${eventCount} event${eventCount !== 1 ? 's' : ''} in file`,
                'ck3.showNamespaceEvents',
                namespace
            ),
        });

        return lenses;
    }
}

/**
 * Localization lens generator
 */
class LocalizationLensGenerator implements LensGenerator {
    private static readonly LOC_FIELDS = new Set(['title', 'desc', 'name', 'custom_tooltip', 'selection_tooltip']);

    canApply(node: ASTNode, context: LensContext): boolean {
        if (!context.config.showLocalization) {
            return false;
        }
        // Match fields that reference localization keys
        return !!(node.key && LocalizationLensGenerator.LOC_FIELDS.has(node.key) &&
                 node.type === NodeType.ASSIGNMENT && node.value && typeof node.value === 'string');
    }

    generate(node: ASTNode, context: LensContext): CodeLens[] {
        const lenses: CodeLens[] = [];
        const locKey = String(node.value);

        lenses.push({
            range: node.range,
            command: Command.create(
                `loc: "${locKey}"`,
                'ck3.findLocalization',
                locKey
            ),
        });

        return lenses;
    }
}
