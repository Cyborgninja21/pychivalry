/**
 * Inlay Hints Provider - Provides inline type annotations
 * 
 * Features:
 * - Scope type hints (save_scope_as, save_temporary_scope_as)
 * - Chain type hints (root.primary_title → : landed_title)
 * - Parameter hints for effects/triggers
 * - Variable type hints (inferred from values)
 * - Iterator type hints (every_vassal → character)
 * - Resolve support for lazy-loading detailed hints
 * - Configuration-aware (respects VS Code settings)
 */

import { InlayHint, InlayHintKind, Range, Position, MarkupContent, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { CK3Language, EffectDefinition, TriggerDefinition } from '../ck3/language';

/**
 * Configuration for inlay hints
 */
export interface InlayHintSettings {
    showScopeTypes: boolean;
    showChainTypes: boolean;
    showParameterNames: boolean;
    showVariableTypes: boolean;
    showIteratorTypes: boolean;
}

/**
 * Variable type information
 */
interface VariableTypeInfo {
    type: 'number' | 'bool' | 'flag' | 'scope' | 'unknown';
    confidence: number; // 0-1
}

/**
 * Inlay Hints Provider
 */
export class InlayHintsProvider {
    private settings: InlayHintSettings = {
        showScopeTypes: true,
        showChainTypes: true,
        showParameterNames: true,
        showVariableTypes: true,
        showIteratorTypes: true,
    };

    // Cache for variable types within document
    private variableTypes: Map<string, VariableTypeInfo> = new Map();

    constructor(private parser: CK3Parser) {}

    /**
     * Update settings for inlay hints
     */
    public updateSettings(settings: Partial<InlayHintSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Provide inlay hints
     */
    public async provideInlayHints(
        document: TextDocument,
        range: Range
    ): Promise<InlayHint[]> {
        const parsed = this.parser.parse(document.getText());
        const hints: InlayHint[] = [];

        // Reset variable type cache for this document
        this.variableTypes.clear();

        // First pass: collect variable type information
        this.collectVariableTypes(parsed.ast);

        // Second pass: collect hints
        this.collectInlayHints(parsed.ast, hints, range, document);

        return hints;
    }

    /**
     * Resolve inlay hint (add additional details)
     */
    public resolveInlayHint(hint: InlayHint): InlayHint {
        // Add tooltip with more detailed information
        if (hint.data && typeof hint.data === 'object') {
            const data = hint.data as { type: string; detail?: string };
            
            if (data.type === 'scope' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Scope Type:** \`${data.detail}\`\n\nThis scope can be referenced later in effects and triggers.`
                };
            } else if (data.type === 'chain' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Result Type:** \`${data.detail}\`\n\nThis scope chain resolves to a ${data.detail} scope.`
                };
            } else if (data.type === 'iterator' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Element Type:** \`${data.detail}\`\n\nEach iteration operates on a ${data.detail} scope.`
                };
            } else if (data.type === 'variable' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Variable Type:** \`${data.detail}\`\n\nInferred from variable usage.`
                };
            } else if (data.type === 'parameter' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: data.detail
                };
            }
        }
        
        return hint;
    }

    /**
     * Collect variable types from AST (first pass)
     */
    private collectVariableTypes(node: ASTNode): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Detect variable assignments
            if (child.key === 'set_variable' && child.children) {
                this.analyzeVariableSet(child);
            } else if (child.key === 'change_variable' && child.children) {
                this.analyzeVariableChange(child);
            }

            // Recurse
            if (child.children) {
                this.collectVariableTypes(child);
            }
        }
    }

    /**
     * Analyze set_variable to infer type
     */
    private analyzeVariableSet(node: ASTNode): void {
        let varName: string | null = null;
        let varValue: any = null;

        if (node.children) {
            for (const child of node.children) {
                if (child.key === 'name' && typeof child.value === 'string') {
                    varName = child.value;
                } else if (child.key === 'value') {
                    varValue = child.value;
                }
            }
        }

        if (varName) {
            const typeInfo = this.inferVariableType(varValue);
            this.variableTypes.set(varName, typeInfo);
        }
    }

    /**
     * Analyze change_variable (implies numeric type)
     */
    private analyzeVariableChange(node: ASTNode): void {
        if (node.children) {
            for (const child of node.children) {
                if (child.key === 'name' && typeof child.value === 'string') {
                    this.variableTypes.set(child.value, {
                        type: 'number',
                        confidence: 0.9
                    });
                }
            }
        }
    }

    /**
     * Infer variable type from value
     */
    private inferVariableType(value: any): VariableTypeInfo {
        if (typeof value === 'number') {
            return { type: 'number', confidence: 1.0 };
        } else if (typeof value === 'boolean') {
            return { type: 'bool', confidence: 1.0 };
        } else if (value === 'yes' || value === 'no') {
            return { type: 'bool', confidence: 1.0 };
        } else if (typeof value === 'string') {
            // Check if it's a scope reference
            if (value.startsWith('scope:') || value.includes('.')) {
                return { type: 'scope', confidence: 0.8 };
            }
            // Check if it's a flag
            if (value.startsWith('flag:')) {
                return { type: 'flag', confidence: 1.0 };
            }
        }
        
        return { type: 'unknown', confidence: 0.0 };
    }

    /**
     * Collect inlay hints from AST (second pass)
     */
    private collectInlayHints(
        node: ASTNode,
        hints: InlayHint[],
        range: Range,
        document: TextDocument
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

            // Scope type hints
            if (this.settings.showScopeTypes) {
                this.addScopeHints(child, hints);
            }

            // Chain type hints
            if (this.settings.showChainTypes) {
                this.addChainHints(child, hints);
            }

            // Parameter hints
            if (this.settings.showParameterNames) {
                this.addParameterHints(child, hints);
            }

            // Variable type hints
            if (this.settings.showVariableTypes) {
                this.addVariableHints(child, hints);
            }

            // Iterator type hints
            if (this.settings.showIteratorTypes) {
                this.addIteratorHints(child, hints);
            }

            // Recurse
            if (child.children) {
                this.collectInlayHints(child, hints, range, document);
            }
        }
    }

    /**
     * Add scope type hints
     */
    private addScopeHints(node: ASTNode, hints: InlayHint[]): void {
        if (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') {
            if (typeof node.value === 'string') {
                const hint: InlayHint = {
                    position: node.range.end,
                    label: ': scope',
                    kind: InlayHintKind.Type,
                    paddingLeft: true,
                    data: { type: 'scope', detail: 'scope' }
                };
                hints.push(hint);
            }
        }
    }

    /**
     * Add scope chain type hints
     */
    private addChainHints(node: ASTNode, hints: InlayHint[]): void {
        if (node.type === NodeType.ASSIGNMENT && typeof node.value === 'string') {
            const scopeType = this.inferScopeChainType(node.value);
            
            if (scopeType) {
                const hint: InlayHint = {
                    position: node.range.end,
                    label: `: ${scopeType}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: true,
                    data: { type: 'chain', detail: scopeType }
                };
                hints.push(hint);
            }
        }
    }

    /**
     * Add parameter name hints
     */
    private addParameterHints(node: ASTNode, hints: InlayHint[]): void {
        if (!node.key) return;

        const effects = CK3Language.getEffects();
        const triggers = CK3Language.getTriggers();

        const effect = effects[node.key];
        const trigger = triggers[node.key];

        if (effect?.parameters || trigger?.parameters) {
            const params = effect?.parameters || trigger?.parameters || [];
            
            // Add parameter name hints for block parameters
            if (node.children && params.length > 0) {
                let paramIndex = 0;
                for (const child of node.children) {
                    if (paramIndex < params.length && child.type === NodeType.ASSIGNMENT) {
                        // Check if parameter name is not already explicit
                        if (child.key !== params[paramIndex]) {
                            const hint: InlayHint = {
                                position: child.range.start,
                                label: `${params[paramIndex]}:`,
                                kind: InlayHintKind.Parameter,
                                paddingRight: true,
                                data: { 
                                    type: 'parameter', 
                                    detail: `Parameter: ${params[paramIndex]}` 
                                }
                            };
                            hints.push(hint);
                        }
                        paramIndex++;
                    }
                }
            }
        }
    }

    /**
     * Add variable type hints
     */
    private addVariableHints(node: ASTNode, hints: InlayHint[]): void {
        // Show type for variable references
        if (node.key === 'var' || node.key === 'variable') {
            if (typeof node.value === 'string') {
                const typeInfo = this.variableTypes.get(node.value);
                if (typeInfo && typeInfo.type !== 'unknown' && typeInfo.confidence > 0.5) {
                    const hint: InlayHint = {
                        position: node.range.end,
                        label: `: ${typeInfo.type}`,
                        kind: InlayHintKind.Type,
                        paddingLeft: true,
                        data: { type: 'variable', detail: typeInfo.type }
                    };
                    hints.push(hint);
                }
            }
        }

        // Show type for variable checks/comparisons
        if (typeof node.value === 'string' && node.value.startsWith('var:')) {
            const varName = node.value.substring(4);
            const typeInfo = this.variableTypes.get(varName);
            if (typeInfo && typeInfo.type !== 'unknown' && typeInfo.confidence > 0.5) {
                const hint: InlayHint = {
                    position: node.range.end,
                    label: `: ${typeInfo.type}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: true,
                    data: { type: 'variable', detail: typeInfo.type }
                };
                hints.push(hint);
            }
        }
    }

    /**
     * Add iterator type hints
     */
    private addIteratorHints(node: ASTNode, hints: InlayHint[]): void {
        if (
            node.key &&
            (node.key.startsWith('every_') ||
                node.key.startsWith('any_') ||
                node.key.startsWith('random_') ||
                node.key.startsWith('ordered_'))
        ) {
            const scopeType = this.inferIteratorType(node.key);
            if (scopeType) {
                const hint: InlayHint = {
                    position: {
                        line: node.range.start.line,
                        character: node.range.start.character + node.key.length
                    },
                    label: ` → ${scopeType}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: true,
                    data: { type: 'iterator', detail: scopeType }
                };
                hints.push(hint);
            }
        }
    }

    /**
     * Infer scope type from scope chain
     */
    private inferScopeChainType(chain: string): string | null {
        const parts = chain.split('.');
        if (parts.length < 2) return null;

        let currentType: string | null = null;

        // Start with the base scope
        if (parts[0] === 'root' || parts[0] === 'this') {
            // Assume character scope for root/this
            currentType = 'character';
        } else if (parts[0].startsWith('scope:')) {
            // Named scope - would need context to determine type
            return null;
        } else {
            return null;
        }

        // Follow the chain
        for (let i = 1; i < parts.length; i++) {
            const accessor = parts[i];
            currentType = this.inferScopeType(accessor, currentType);
            if (!currentType) return null;
        }

        return currentType;
    }

    /**
     * Infer scope type from accessor with context
     */
    private inferScopeType(accessor: string, fromScope?: string | null): string | null {
        // Character scope accessors
        const characterAccessors: Record<string, string> = {
            'primary_title': 'title',
            'capital_county': 'title',
            'capital_province': 'province',
            'top_liege': 'character',
            'liege': 'character',
            'father': 'character',
            'mother': 'character',
            'real_father': 'character',
            'spouse': 'character',
            'primary_spouse': 'character',
            'primary_heir': 'character',
            'player_heir': 'character',
            'faith': 'faith',
            'culture': 'culture',
            'house': 'dynasty_house',
            'dynasty': 'dynasty',
            'location': 'province',
            'court_owner': 'character',
            'employer': 'character',
            'host': 'character',
            'guardian': 'character',
            'councillor_liege': 'character',
            'commanding_army': 'army',
        };

        // Title scope accessors
        const titleAccessors: Record<string, string> = {
            'holder': 'character',
            'de_jure_liege': 'title',
            'de_facto_liege': 'title',
            'empire': 'title',
            'kingdom': 'title',
            'duchy': 'title',
            'county': 'title',
            'barony': 'title',
            'capital_province': 'province',
            'title_province': 'province',
        };

        // Province scope accessors
        const provinceAccessors: Record<string, string> = {
            'county': 'title',
            'duchy': 'title',
            'kingdom': 'title',
            'empire': 'title',
            'barony': 'title',
            'holder': 'character',
        };

        // Faith scope accessors
        const faithAccessors: Record<string, string> = {
            'religious_head': 'character',
            'religion': 'religion',
        };

        // Dynasty scope accessors
        const dynastyAccessors: Record<string, string> = {
            'dynast': 'character',
            'house': 'dynasty_house',
        };

        // Select appropriate map based on source scope
        let accessorMap: Record<string, string> | null = null;
        
        if (!fromScope || fromScope === 'character') {
            accessorMap = characterAccessors;
        } else if (fromScope === 'title') {
            accessorMap = titleAccessors;
        } else if (fromScope === 'province') {
            accessorMap = provinceAccessors;
        } else if (fromScope === 'faith') {
            accessorMap = faithAccessors;
        } else if (fromScope === 'dynasty' || fromScope === 'dynasty_house') {
            accessorMap = dynastyAccessors;
        }

        if (accessorMap && accessorMap[accessor]) {
            return accessorMap[accessor];
        }

        // Fallback: try character accessors (most common)
        return characterAccessors[accessor] || null;
    }

    /**
     * Infer scope type from iterator
     */
    private inferIteratorType(iterator: string): string | null {
        // Character iterators
        if (iterator.includes('_vassal')) return 'character';
        if (iterator.includes('_courtier')) return 'character';
        if (iterator.includes('_prisoner')) return 'character';
        if (iterator.includes('_ally')) return 'character';
        if (iterator.includes('_enemy')) return 'character';
        if (iterator.includes('_truce_holder')) return 'character';
        if (iterator.includes('_truce_target')) return 'character';
        if (iterator.includes('_child')) return 'character';
        if (iterator.includes('_sibling')) return 'character';
        if (iterator.includes('_spouse')) return 'character';
        if (iterator.includes('_relation')) return 'character';
        if (iterator.includes('_councillor')) return 'character';
        if (iterator.includes('_knight')) return 'character';
        if (iterator.includes('_heir')) return 'character';
        if (iterator.includes('_claimant')) return 'character';
        if (iterator.includes('_pretender')) return 'character';
        if (iterator.includes('_pool_')) return 'character';
        if (iterator.includes('_dynasty_member')) return 'character';
        if (iterator.includes('_house_member')) return 'character';
        if (iterator.includes('_ruler')) return 'character';
        if (iterator.includes('_player')) return 'character';
        if (iterator.includes('_living_character')) return 'character';
        if (iterator.includes('_known_character')) return 'character';
        if (iterator.includes('_diplomatic_character')) return 'character';
        
        // Title iterators
        if (iterator.includes('_held_title')) return 'title';
        if (iterator.includes('_claim')) return 'title';
        if (iterator.includes('_realm_county')) return 'title';
        if (iterator.includes('_realm_province')) return 'province';
        if (iterator.includes('_county')) return 'title';
        if (iterator.includes('_de_jure_')) return 'title';
        if (iterator.includes('_title')) return 'title';
        if (iterator.includes('_barony')) return 'title';
        if (iterator.includes('_duchy')) return 'title';
        if (iterator.includes('_kingdom')) return 'title';
        if (iterator.includes('_empire')) return 'title';
        if (iterator.includes('_in_de_jure_')) return 'title';
        
        // Province iterators
        if (iterator.includes('_province')) return 'province';
        if (iterator.includes('_neighboring_province')) return 'province';
        
        // War iterators
        if (iterator.includes('_war')) return 'war';
        if (iterator.includes('_war_ally')) return 'character';
        if (iterator.includes('_war_enemy')) return 'character';
        
        // Combat iterators
        if (iterator.includes('_army')) return 'army';
        if (iterator.includes('_character_war')) return 'war';
        
        // Religion/Culture iterators
        if (iterator.includes('_faith')) return 'faith';
        if (iterator.includes('_religion')) return 'religion';
        if (iterator.includes('_culture')) return 'culture';
        if (iterator.includes('_culture_pillar')) return 'culture_pillar';
        
        // Dynasty iterators
        if (iterator.includes('_dynasty')) return 'dynasty';
        if (iterator.includes('_house')) return 'dynasty_house';
        
        // Scheme iterators
        if (iterator.includes('_scheme')) return 'scheme';
        if (iterator.includes('_secret')) return 'secret';
        
        // Activity iterators
        if (iterator.includes('_activity')) return 'activity';
        if (iterator.includes('_participant')) return 'character';
        
        // Story cycle iterators
        if (iterator.includes('_story')) return 'story_cycle';
        
        // Artifact iterators
        if (iterator.includes('_artifact')) return 'artifact';
        
        // Memory iterators
        if (iterator.includes('_memory')) return 'memory';

        return null;
    }
}
