/**
 * Diagnostics Engine - Multi-phase validation pipeline
 *
 * This module orchestrates the complete validation process for CK3 scripts,
 * collecting diagnostics from multiple sources:
 * - Parse errors (syntax)
 * - Scope validation (context checking)
 * - Schema validation (structure)
 * - Convention checking (best practices)
 * - Localization checking (missing keys)
 *
 * DIAGNOSTIC CODES:
 *     PARSE-XXX: Parser-level errors
 *     SCOPE-XXX: Scope validation errors
 *     SCHEMA-XXX: Schema validation errors
 *     CONV-XXX: Convention violations
 *     LOC-XXX: Localization issues
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ParseError as ParserError, ASTNode, NodeType } from '../../core/parser';
import {
    validateScopeChain,
    isScopeLink,
    isValidEffect,
    isValidTrigger,
    isKnownEffect,
    isKnownTrigger,
    getScopeLinks,
    getTargetScopeType,
    getListResultScope,
    isListIterator,
    parseListIterator,
    isValidListBase,
} from './scopes';
import { validateDocumentScopeTiming, DEFAULT_SCOPE_TIMING_CONFIG } from './scope-timing';
import { validateStyle, DEFAULT_STYLE_CONFIG } from './style-checks';
import { validateParadoxConventions, DEFAULT_PARADOX_CONFIG } from './paradox-checks';
import { validateVariables, VariablesConfig } from './variables';
import { validateTraits, TraitsConfig } from './traits';
import { validateScriptedBlocks, ScriptedBlockConfig } from './scripted-blocks';
import { serverLogger } from '../../utils/logger';
import { validateGenericRules, GenericRulesConfig } from './generic-rules';
import { validateAssets, AssetConfig } from './assets';
import { validateStoryCycles, StoryCycleConfig } from './story-cycles';
import { validateEventFromNode, validateEventFileLocation, validateNamespaceDeclaration, validateContentTypePlacement } from './events';
import { validateScriptValues, ScriptValuesConfig, DEFAULT_SCRIPT_VALUES_CONFIG } from './script-values';
import { SchemaValidator } from '../../schema/validator';
import { SchemaLoader } from '../../schema/loader';
import { DataLoader } from '../../data/loader';
import { DocumentIndexer, SymbolType } from '../../core/indexer';
import { LocalizationIndex } from '../../core/localization-index';
import { validateLocalizationContent, DEFAULT_LOC_VALIDATION_CONFIG, LocalizationValidationConfig } from '../localization/validator';
import { validateInteractionHooks, DEFAULT_INTERACTION_HOOK_CONFIG } from './interaction-hooks';
import { validateIterators, DEFAULT_ITERATOR_CONFIG } from './iterators';
import { validateSwitch, DEFAULT_SWITCH_CONFIG } from './switch-validation';
import { validateDecisions, DEFAULT_DECISION_CONFIG } from './decisions';
import { validateInteractions, DEFAULT_INTERACTION_VALIDATION_CONFIG } from './interactions';
import { validateActivities, DEFAULT_ACTIVITY_CONFIG } from './activities';
import { validateOnActions, DEFAULT_ON_ACTION_CONFIG } from './on-actions';
import { validateSchemes, DEFAULT_SCHEME_CONFIG } from './schemes';
import { validateModifiers, DEFAULT_MODIFIER_CONFIG } from './modifiers';
import { validateCasusBelli, DEFAULT_CASUS_BELLI_CONFIG } from './casus-belli';
import { validateCourtPositions, DEFAULT_COURT_POSITION_CONFIG } from './court-positions';
import { validateScriptedParameters } from './scripted-blocks';
import { classifyContext } from './context-engine';

/**
 * Diagnostic configuration
 */
export interface DiagnosticConfig {
    enableScopeValidation: boolean;
    enableSchemaValidation: boolean;
    enableConventionChecks: boolean;
    enableLocalizationChecks: boolean;
    enableParadoxChecks: boolean;
    enableVariableChecks: boolean;
    enableTraitChecks: boolean;
    enableScriptedBlockChecks: boolean;
    enableGenericRules: boolean;
    enableAssetChecks: boolean;
    enableStoryCycleChecks: boolean;
    enableScriptValueChecks: boolean;
    enableLocalizationValidation: boolean;
    enableInteractionHookChecks: boolean;
    enableIteratorChecks: boolean;
    enableSwitchChecks: boolean;
    enableDecisionChecks: boolean;
    enableInteractionValidation: boolean;
    enableActivityChecks: boolean;
    enableOnActionChecks: boolean;
    enableSchemeChecks: boolean;
    enableModifierChecks: boolean;
    enableCasusBelliChecks: boolean;
    enableCourtPositionChecks: boolean;
    maxDiagnostics: number;
    /** Workspace root paths for asset validation */
    workspaceRoots: string[];
    /** Known asset paths for asset existence validation */
    knownAssets?: Set<string>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DiagnosticConfig = {
    enableScopeValidation: true,
    enableSchemaValidation: true,
    enableConventionChecks: true,
    enableLocalizationChecks: true,
    enableParadoxChecks: true,
    enableVariableChecks: true,
    enableTraitChecks: true,
    enableScriptedBlockChecks: true,
    enableGenericRules: true,
    enableAssetChecks: true,
    enableStoryCycleChecks: true,
    enableScriptValueChecks: true,
    enableLocalizationValidation: true,
    enableInteractionHookChecks: true,
    enableIteratorChecks: true,
    enableSwitchChecks: true,
    enableDecisionChecks: true,
    enableInteractionValidation: true,
    enableActivityChecks: true,
    enableOnActionChecks: true,
    enableSchemeChecks: true,
    enableModifierChecks: true,
    enableCasusBelliChecks: true,
    enableCourtPositionChecks: true,
    maxDiagnostics: 1000,
    workspaceRoots: [],
};

/**
 * Effect block context names - blocks where children are effects
 */
const EFFECT_CONTEXT_KEYS = new Set([
    'effect', 'immediate', 'after', 'on_completion',
    'on_success', 'on_failure', 'on_start',
    'on_invalidated', 'on_monthly',
    'if', 'else_if', 'else',
    // Effect containers — propagate effect context to their children
    'hidden_effect', 'show_as_tooltip',
    'random_list', 'weighted_random_list',
    'switch', 'while', 'random',
]);

/**
 * Trigger block context names - blocks where children are triggers
 */
const TRIGGER_CONTEXT_KEYS = new Set([
    'trigger', 'is_shown', 'is_valid',
    'is_valid_showing_failures_only',
    'potential', 'allow', 'ai_potential',
    'can_be_shown', 'can_start',
    'trigger_if', 'trigger_else_if', 'trigger_else',
    // Logical operators — propagate trigger context to children
    'AND', 'OR', 'NOT', 'NOR', 'NAND',
    // Trigger-context blocks inside iterators and conditionals
    'limit', 'calc_true_if', 'alternative_limit',
]);

/**
 * Pattern matching event definition IDs (e.g., my_namespace.0001)
 */
const EVENT_ID_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*\.\d+$/;

/**
 * Structural fields at the event definition level.
 * These are NOT effects/triggers — they configure the event's presentation and behavior.
 * Derived from the events.yaml schema field_order + known event-level keys.
 */
const EVENT_LEVEL_FIELDS = new Set([
    'type', 'title', 'desc', 'theme', 'hidden', 'sender',
    'trigger', 'option', 'immediate', 'after', 'on_completion',
    'left_portrait', 'right_portrait', 'center_portrait',
    'lower_left_portrait', 'lower_center_portrait', 'lower_right_portrait',
    'widgets', 'is_triggered_only', 'override_background', 'override_icon',
    'override_sound', 'weight_multiplier', 'cooldown', 'opening',
]);

/**
 * Structural fields within an option block.
 * These are NOT effects — they configure the option's presentation and AI behavior.
 */
const OPTION_STRUCTURAL_FIELDS = new Set([
    'name', 'trigger', 'ai_chance', 'highlight_portrait', 'flavor',
    'custom_tooltip', 'show_as_tooltip', 'exclusive', 'fallback',
    'show_as_unavailable',
]);

/**
 * Diagnostics Engine
 */
export class DiagnosticsEngine {
    private config: DiagnosticConfig;
    private schemaValidator: SchemaValidator | null = null;
    private indexer: DocumentIndexer | null = null;
    private localizationIndex: LocalizationIndex | null = null;

    constructor(config: Partial<DiagnosticConfig> = {}, schemaLoader?: SchemaLoader, indexer?: DocumentIndexer, localizationIndex?: LocalizationIndex) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (schemaLoader) {
            this.schemaValidator = new SchemaValidator(schemaLoader);
        }
        if (indexer) {
            this.indexer = indexer;
        }
        if (localizationIndex) {
            this.localizationIndex = localizationIndex;
        }
    }

    /**
     * Set schema loader (can be set after construction)
     */
    public setSchemaLoader(loader: SchemaLoader): void {
        this.schemaValidator = new SchemaValidator(loader);
    }

    /**
     * Collect all diagnostics for a document
     */
    public async collectDiagnostics(
        document: TextDocument,
        ast: ASTNode[],
        parseErrors: ParserError[]
    ): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        // Phase 1: Parse errors
        diagnostics.push(...this.parseErrorsToDiagnostics(parseErrors));

        // Phase 2: Syntax validation
        if (this.config.enableScopeValidation) {
            diagnostics.push(...await this.checkSyntax(ast, document));
        }

        // Phase 3: Scope validation
        if (this.config.enableScopeValidation) {
            diagnostics.push(...await this.checkScopes(ast, document));
        }

        // Phase 4: Schema validation
        if (this.config.enableSchemaValidation) {
            diagnostics.push(...await this.checkSchema(ast, document));
        }

        // Phase 5: Convention checks
        if (this.config.enableConventionChecks) {
            diagnostics.push(...await this.checkConventions(ast, document));
        }

        // Phase 6: Localization checks
        if (this.config.enableLocalizationChecks) {
            diagnostics.push(...await this.checkLocalization(ast, document));
        }

        // Phase 7: Extended validation modules
        diagnostics.push(...this.checkExtendedValidation(ast, document));

        // Deduplicate overlapping brace diagnostics from two independent sources:
        //
        // 1. The parser (parser.ts) detects brace errors during AST construction
        //    and reports them as PARSE-XXX codes with messages containing "brace".
        // 2. The style checker (style-checks.ts) independently scans the raw text
        //    for brace mismatches, reporting CK3330 (unclosed) and CK3331 (extra).
        //
        // When both systems report an error on the same line, we keep only the
        // parser's diagnostic since it has more precise context from the AST.
        const parseBraceLines = new Set<number>();
        for (const d of diagnostics) {
            if (typeof d.code === 'string' && d.code.startsWith('PARSE-') &&
                d.message.includes('brace')) {
                parseBraceLines.add(d.range.start.line);
            }
        }
        const deduped = diagnostics.filter(d => {
            if ((d.code === 'CK3330' || d.code === 'CK3331') &&
                parseBraceLines.has(d.range.start.line)) {
                return false; // Parser already reports this error
            }
            return true;
        });

        // Limit total diagnostics
        if (deduped.length > this.config.maxDiagnostics) {
            deduped.length = this.config.maxDiagnostics;
        }

        return deduped;
    }

    /**
     * Convert parse errors to LSP diagnostics
     */
    private parseErrorsToDiagnostics(parseErrors: ParserError[]): Diagnostic[] {
        return parseErrors.map((error, index) => ({
            severity: DiagnosticSeverity.Error,
            range: error.range,
            message: error.message,
            code: `PARSE-${String(index + 1).padStart(3, '0')}`,
            source: 'ck3-parser',
        }));
    }

    /**
     * Check syntax (basic structural validation)
     */
    private async checkSyntax(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        const walk = (nodes: ASTNode[]) => {
            for (const node of nodes) {
                if (node.key === '' && node.type !== NodeType.ROOT) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: node.range,
                        message: 'Empty key in assignment',
                        code: 'SYNTAX-001',
                        source: 'ck3-syntax',
                    });
                }

                if (node.children) {
                    walk(node.children);
                }
            }
        };

        walk(ast);
        return diagnostics;
    }

    /**
     * Check scopes with proper context tracking for effect/trigger blocks
     */
    private async checkScopes(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        // Phase 1: Scope timing validation (Golden Rule checking)
        for (const node of ast) {
            const timingDiags = validateDocumentScopeTiming(node, DEFAULT_SCOPE_TIMING_CONFIG);
            diagnostics.push(...timingDiags);
        }

        // Phase 2: Walk the AST with context tracking
        const walk = (nodes: ASTNode[], currentScope: string = 'character', context: 'none' | 'effect' | 'trigger' = 'none', parentKey: string | null = null) => {
            for (const node of nodes) {
                // Check scope chains (e.g., root.liege.primary_title)
                // Only validate if the first segment is a known scope link;
                // dotted identifiers like event IDs (my_namespace.0001) are not scope chains.
                if (node.key && node.key.includes('.') && isScopeLink(node.key.split('.')[0], currentScope)) {
                    const [isValid, resultType, error] = validateScopeChain(node.key, currentScope);
                    if (!isValid && error) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: node.range,
                            message: error,
                            code: 'SCOPE-003',
                            source: 'ck3-scope',
                        });
                    }
                }

                // Determine context for this node's children
                let childContext = context;
                if (node.key) {
                    if (EVENT_ID_PATTERN.test(node.key)) {
                        // Event definition block: children are structural fields, not effects/triggers
                        childContext = 'none';
                    } else if (EFFECT_CONTEXT_KEYS.has(node.key)) {
                        childContext = 'effect';
                    } else if (TRIGGER_CONTEXT_KEYS.has(node.key)) {
                        childContext = 'trigger';
                    } else if (context === 'effect' && node.children && isKnownEffect(node.key) && !isListIterator(node.key)) {
                        // Known compound effect with block body — children are parameters, not sub-effects
                        // e.g., add_opinion = { modifier = ... target = ... }
                        //        stress_impact = { brave = -10 content = 10 }
                        childContext = 'none';
                    } else if (context === 'trigger' && node.children && isKnownTrigger(node.key) && !isListIterator(node.key)) {
                        // Known compound trigger with block body — children are parameters
                        childContext = 'none';
                    } else if (childContext === 'none') {
                        // Fallback: use context engine for keys not in either set
                        const classification = classifyContext([], node.key, document.uri);
                        if (classification.confidence !== 'low') {
                            if (classification.context === 'effect') {
                                childContext = 'effect';
                            } else if (classification.context === 'trigger') {
                                childContext = 'trigger';
                            }
                        }
                    }
                }

                // Check effects in effect context — only flag known effects in the wrong scope
                if (context === 'effect' && node.key && !node.key.includes('.')) {
                    const inEventBlock = parentKey !== null && EVENT_ID_PATTERN.test(parentKey);
                    const inOptionBlock = parentKey === 'option';
                    const isStructuralField =
                        (inEventBlock && EVENT_LEVEL_FIELDS.has(node.key)) ||
                        (inOptionBlock && OPTION_STRUCTURAL_FIELDS.has(node.key));
                    const isContextKey = EFFECT_CONTEXT_KEYS.has(node.key) || TRIGGER_CONTEXT_KEYS.has(node.key);
                    const isIterator = isListIterator(node.key);

                    if (!isStructuralField && !isContextKey && !isIterator
                            && isKnownEffect(node.key) && !isValidEffect(node.key, currentScope)) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: node.range,
                            message: `Effect '${node.key}' may not be valid in ${currentScope} scope`,
                            code: 'SCOPE-005',
                            source: 'ck3-scope',
                        });
                    }
                }

                // Check triggers in trigger context — only flag known triggers in the wrong scope
                if (context === 'trigger' && node.key && !node.key.includes('.')) {
                    const inEventBlock = parentKey !== null && EVENT_ID_PATTERN.test(parentKey);
                    const inOptionBlock = parentKey === 'option';
                    const isStructuralField =
                        (inEventBlock && EVENT_LEVEL_FIELDS.has(node.key)) ||
                        (inOptionBlock && OPTION_STRUCTURAL_FIELDS.has(node.key));
                    const isContextKey = EFFECT_CONTEXT_KEYS.has(node.key) || TRIGGER_CONTEXT_KEYS.has(node.key);
                    const isIterator = isListIterator(node.key);

                    if (!isStructuralField && !isContextKey && !isIterator
                            && isKnownTrigger(node.key) && !isValidTrigger(node.key, currentScope)) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: node.range,
                            message: `Trigger '${node.key}' may not be valid in ${currentScope} scope`,
                            code: 'SCOPE-004',
                            source: 'ck3-scope',
                        });
                    }
                }

                // Check list iterators
                if (node.key && isListIterator(node.key)) {
                    const parsed = parseListIterator(node.key);
                    if (parsed) {
                        const [prefix, baseName] = parsed;
                        if (!isValidListBase(baseName, currentScope)) {
                            diagnostics.push({
                                severity: DiagnosticSeverity.Error,
                                range: node.range,
                                message: `Invalid list iterator '${baseName}' for ${currentScope} scope`,
                                code: 'SCOPE-006',
                                source: 'ck3-scope',
                            });
                        }
                    }
                }

                // Recurse with context — transition scope for links and iterators
                if (node.children) {
                    let childScope = currentScope;
                    if (node.key) {
                        const scopeLinks = getScopeLinks(currentScope);
                        if (scopeLinks.includes(node.key)) {
                            // Scope link: transition to the target scope type
                            const targetScope = getTargetScopeType(currentScope, node.key);
                            if (targetScope) {
                                childScope = targetScope;
                            }
                        } else if (isListIterator(node.key)) {
                            // List iterator: transition to the result scope type
                            const resultScope = getListResultScope(node.key, currentScope);
                            if (resultScope) {
                                childScope = resultScope;
                            }
                        }
                    }
                    walk(node.children, childScope, childContext, node.key || null);
                }
            }
        };

        walk(ast);
        return diagnostics;
    }

    /**
     * Check schema (validate against schema definitions)
     */
    private async checkSchema(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        if (!this.schemaValidator) {
            return [];
        }

        try {
            return await this.schemaValidator.validate(document.uri, ast);
        } catch (error) {
            serverLogger.error(`Schema validation error: ${error}`);
            return [];
        }
    }

    /**
     * Check conventions (best practices and common patterns)
     */
    private async checkConventions(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        // Run style checks (validateStyle expects: ast, text, config)
        const text = document.getText();
        if (ast.length > 0) {
            const styleDiagnostics = validateStyle(ast[0], text, DEFAULT_STYLE_CONFIG);
            diagnostics.push(...styleDiagnostics);
        }

        // CK3-specific convention checks
        for (const node of ast) {
            this.checkCK3Conventions(node, diagnostics);
        }

        return diagnostics;
    }

    /**
     * Extended validation - Paradox checks, variables, traits, scripted blocks,
     * generic rules, assets, and story cycles
     */
    private checkExtendedValidation(ast: ASTNode[], document: TextDocument): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];

        for (const node of ast) {
            // Event structure validation (type, portraits, themes, etc.)
            if (this.config.enableConventionChecks && node.children) {
                let hasEventBlocks = false;
                for (const child of node.children) {
                    if (child.key && /^[a-z_]+\.\d+$/.test(child.key) && child.children) {
                        hasEventBlocks = true;
                        const result = validateEventFromNode(child);
                        for (const err of result.errors) {
                            diagnostics.push({
                                severity: DiagnosticSeverity.Warning,
                                range: child.range,
                                message: err.message,
                                code: err.code,
                                source: 'ck3-event',
                            });
                        }
                    }
                }

                // File-level event validations
                if (hasEventBlocks) {
                    // EVENT-008: Check file is in events/ directory
                    const locationErrors = validateEventFileLocation(document.uri, hasEventBlocks);
                    for (const err of locationErrors) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: node.children[0]?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                            message: err.message,
                            code: err.code,
                            source: 'ck3-event',
                        });
                    }

                    // EVENT-009/EVENT-010: Namespace declaration checks
                    const nsErrors = validateNamespaceDeclaration(node, document.uri);
                    for (const err of nsErrors) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: err.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                            message: err.message,
                            code: err.code,
                            source: 'ck3-event',
                        });
                    }
                }

                // EVENT-017/EVENT-018: Content-type mismatch detection
                const placementErrors = validateContentTypePlacement(node, document.uri);
                for (const err of placementErrors) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: err.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                        message: err.message,
                        code: err.code,
                        source: 'ck3-event',
                    });
                }
            }

            // Paradox convention checks (effects in trigger context, event structure, etc.)
            if (this.config.enableParadoxChecks) {
                diagnostics.push(...validateParadoxConventions(node, DEFAULT_PARADOX_CONFIG));
            }

            // Variable usage validation
            if (this.config.enableVariableChecks) {
                const variablesConfig: VariablesConfig = {
                    enabled: true,
                    checkUnused: true,
                    checkUndeclared: true,
                    checkScope: true,
                    checkTypes: true,
                };
                diagnostics.push(...validateVariables(node, variablesConfig));
            }

            // Trait validation (with known traits from DataLoader)
            if (this.config.enableTraitChecks) {
                const dataLoader = DataLoader.getInstance();
                const knownTraits = new Set(dataLoader.getTraits().keys());
                const traitsConfig: TraitsConfig = {
                    enabled: true,
                    checkExistence: true,
                    checkCompatibility: true,
                    checkOpposites: true,
                    knownTraits,
                };
                diagnostics.push(...validateTraits(node, traitsConfig));
            }

            // Scripted blocks validation (with known sets from indexer)
            if (this.config.enableScriptedBlockChecks) {
                let knownScriptedEffects: Set<string> | undefined;
                let knownScriptedTriggers: Set<string> | undefined;
                if (this.indexer) {
                    knownScriptedEffects = new Set(
                        this.indexer.findSymbolsByType(SymbolType.SCRIPTED_EFFECT).map(s => s.name)
                    );
                    knownScriptedTriggers = new Set(
                        this.indexer.findSymbolsByType(SymbolType.SCRIPTED_TRIGGER).map(s => s.name)
                    );
                }
                const scriptedBlockConfig: ScriptedBlockConfig = {
                    enabled: true,
                    checkEffects: true,
                    checkTriggers: true,
                    knownScriptedEffects,
                    knownScriptedTriggers,
                };
                diagnostics.push(...validateScriptedBlocks(node, scriptedBlockConfig));
            }

            // Generic rules validation
            if (this.config.enableGenericRules) {
                const genericConfig: GenericRulesConfig = { enabled: true };
                diagnostics.push(...validateGenericRules(node, undefined, genericConfig));
            }

            // Asset validation
            if (this.config.enableAssetChecks) {
                const assetConfig: AssetConfig = {
                    enabled: true,
                    checkGraphics: true,
                    checkSound: true,
                    checkAnimations: true,
                    checkGUI: true,
                    workspaceRoots: this.config.workspaceRoots,
                    knownAssets: this.config.knownAssets,
                };
                diagnostics.push(...validateAssets(node, assetConfig));
            }

            // Story cycle validation
            if (this.config.enableStoryCycleChecks) {
                const storyCycleConfig: StoryCycleConfig = {
                    enabled: true,
                    checkStructure: true,
                    checkPhases: true,
                    checkTransitions: true,
                };
                diagnostics.push(...validateStoryCycles(node, storyCycleConfig));
            }

            // Script value validation
            if (this.config.enableScriptValueChecks) {
                diagnostics.push(...validateScriptValues(node, DEFAULT_SCRIPT_VALUES_CONFIG));
            }

            // Interaction hook validation
            if (this.config.enableInteractionHookChecks) {
                diagnostics.push(...validateInteractionHooks(node, DEFAULT_INTERACTION_HOOK_CONFIG));
            }

            // Iterator requirement validation
            if (this.config.enableIteratorChecks) {
                diagnostics.push(...validateIterators(node, DEFAULT_ITERATOR_CONFIG));
            }

            // Switch statement validation
            if (this.config.enableSwitchChecks) {
                diagnostics.push(...validateSwitch(node, DEFAULT_SWITCH_CONFIG));
            }

            // Conditional block validation (trigger_if/trigger_else, if/else)
            diagnostics.push(...this.validateConditionalBlocks(node));

            // Decision validation (only for decision files)
            if (this.config.enableDecisionChecks) {
                diagnostics.push(...validateDecisions(node, DEFAULT_DECISION_CONFIG, document.uri));
            }

            // Character interaction validation
            if (this.config.enableInteractionValidation) {
                diagnostics.push(...validateInteractions(node, DEFAULT_INTERACTION_VALIDATION_CONFIG, document.uri));
            }

            // Activity lifecycle validation
            if (this.config.enableActivityChecks) {
                diagnostics.push(...validateActivities(node, DEFAULT_ACTIVITY_CONFIG, document.uri));
            }

            // On-action validation
            if (this.config.enableOnActionChecks) {
                diagnostics.push(...validateOnActions(node, DEFAULT_ON_ACTION_CONFIG, document.uri));
            }

            // Scheme validation
            if (this.config.enableSchemeChecks) {
                diagnostics.push(...validateSchemes(node, DEFAULT_SCHEME_CONFIG, document.uri));
            }

            // Modifier validation
            if (this.config.enableModifierChecks) {
                diagnostics.push(...validateModifiers(node, DEFAULT_MODIFIER_CONFIG, document.uri));
            }

            // Casus belli validation
            if (this.config.enableCasusBelliChecks) {
                diagnostics.push(...validateCasusBelli(node, DEFAULT_CASUS_BELLI_CONFIG, document.uri));
            }

            // Court position validation
            if (this.config.enableCourtPositionChecks) {
                diagnostics.push(...validateCourtPositions(node, DEFAULT_COURT_POSITION_CONFIG, document.uri));
            }

            // Scripted parameter validation ($PARAM$ checks)
            if (this.config.enableScriptedBlockChecks) {
                const scriptedBlockConfig: ScriptedBlockConfig = {
                    enabled: true,
                    checkEffects: true,
                    checkTriggers: true,
                };
                diagnostics.push(...validateScriptedParameters(node, scriptedBlockConfig, document.uri));
            }
        }

        // Localization content validation (operates on loc entries, not AST)
        if (this.config.enableLocalizationValidation && this.localizationIndex) {
            const uri = document.uri;
            // Only validate localization YAML files
            if (uri.endsWith('.yml')) {
                const entries = this.getLocalizationEntriesForFile(uri);
                for (const entry of entries) {
                    diagnostics.push(...validateLocalizationContent(entry, DEFAULT_LOC_VALIDATION_CONFIG));
                }
            }
        }

        return diagnostics;
    }

    /**
     * CK3-specific convention checks on AST nodes
     */
    private checkCK3Conventions(node: ASTNode, diagnostics: Diagnostic[]): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Events should have a type field
            if (child.key && child.key.includes('.') && child.children) {
                const hasOption = child.children.some(c => c.key === 'option');

                if (hasOption) {
                    const hasType = child.children.some(c => c.key === 'type');
                    if (!hasType) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: child.range,
                            message: `Event '${child.key}' is missing 'type' field`,
                            code: 'CONV-001',
                            source: 'ck3-convention',
                        });
                    }

                    const hasTitle = child.children.some(c => c.key === 'title');
                    if (!hasTitle) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: child.range,
                            message: `Event '${child.key}' is missing 'title' localization key`,
                            code: 'CONV-002',
                            source: 'ck3-convention',
                        });
                    }

                    const hasDesc = child.children.some(c => c.key === 'desc');
                    if (!hasDesc) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Information,
                            range: child.range,
                            message: `Event '${child.key}' is missing 'desc' localization key`,
                            code: 'CONV-003',
                            source: 'ck3-convention',
                        });
                    }
                }
            }

            // Option blocks should have a name
            if (child.key === 'option' && child.children) {
                const hasName = child.children.some(c => c.key === 'name');
                if (!hasName) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: 'Option block is missing a \'name\' field for localization',
                        code: 'CONV-004',
                        source: 'ck3-convention',
                    });
                }
            }

            this.checkCK3Conventions(child, diagnostics);
        }
    }

    /**
     * Validate conditional blocks (trigger_if/trigger_else, if/else)
     *
     * COND-001: trigger_if/trigger_else_if missing 'limit' child
     * COND-002: trigger_else should NOT have 'limit' child
     * COND-003: orphaned trigger_else/else without preceding if
     */
    private validateConditionalBlocks(node: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        this.walkConditionalBlocks(node, diagnostics);
        return diagnostics;
    }

    private walkConditionalBlocks(node: ASTNode, diagnostics: Diagnostic[]): void {
        if (!node.children) return;

        let lastConditionalKey: string | null = null;

        for (const child of node.children) {
            if (!child.key) continue;

            // trigger_if / trigger_else_if must have 'limit'
            if ((child.key === 'trigger_if' || child.key === 'trigger_else_if') && child.children) {
                const hasLimit = child.children.some(c => c.key === 'limit');
                if (!hasLimit) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: `'${child.key}' is missing required 'limit' block`,
                        code: 'COND-001',
                        source: 'ck3-conditional',
                    });
                }
                lastConditionalKey = child.key;
            }
            // trigger_else should NOT have 'limit'
            else if (child.key === 'trigger_else' && child.children) {
                const hasLimit = child.children.some(c => c.key === 'limit');
                if (hasLimit) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: "'trigger_else' should not have a 'limit' block - use 'trigger_else_if' instead",
                        code: 'COND-002',
                        source: 'ck3-conditional',
                    });
                }
                // Check for orphaned trigger_else
                if (lastConditionalKey !== 'trigger_if' && lastConditionalKey !== 'trigger_else_if') {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: "'trigger_else' without preceding 'trigger_if'",
                        code: 'COND-003',
                        source: 'ck3-conditional',
                    });
                }
                lastConditionalKey = child.key;
            }
            // Effect-side: if/else_if must have 'limit', else should not
            else if ((child.key === 'if' || child.key === 'else_if') && child.children) {
                const hasLimit = child.children.some(c => c.key === 'limit');
                if (!hasLimit) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: `'${child.key}' is missing required 'limit' block`,
                        code: 'COND-001',
                        source: 'ck3-conditional',
                    });
                }
                lastConditionalKey = child.key;
            }
            else if (child.key === 'else' && child.children) {
                const hasLimit = child.children.some(c => c.key === 'limit');
                if (hasLimit) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: "'else' should not have a 'limit' block - use 'else_if' instead",
                        code: 'COND-002',
                        source: 'ck3-conditional',
                    });
                }
                if (lastConditionalKey !== 'if' && lastConditionalKey !== 'else_if') {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: "'else' without preceding 'if'",
                        code: 'COND-003',
                        source: 'ck3-conditional',
                    });
                }
                lastConditionalKey = child.key;
            }
            else {
                // Non-conditional node resets the chain
                lastConditionalKey = null;
            }

            // Recurse into children
            this.walkConditionalBlocks(child, diagnostics);
        }
    }

    /**
     * Check localization (missing keys, format issues)
     */
    private async checkLocalization(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        for (const node of ast) {
            this.checkLocalizationKeys(node, diagnostics);
        }

        return diagnostics;
    }

    /**
     * Check localization key references in the AST
     */
    private checkLocalizationKeys(node: ASTNode, diagnostics: Diagnostic[]): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Check title, desc, name fields for localization key format
            if ((child.key === 'title' || child.key === 'desc' || child.key === 'name') &&
                child.value && typeof child.value === 'string') {
                const locKey = child.value;
                if (locKey.includes(' ') && !locKey.startsWith('"')) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: `'${locKey}' contains spaces - this should be a localization key, not literal text`,
                        code: 'LOC-001',
                        source: 'ck3-localization',
                    });
                }
            }

            // Check tooltip fields
            if ((child.key === 'custom_tooltip' || child.key === 'selection_tooltip') &&
                child.value && typeof child.value === 'string') {
                const locKey = child.value;
                if (locKey.includes(' ')) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: `Tooltip value '${locKey}' contains spaces - this should be a localization key`,
                        code: 'LOC-002',
                        source: 'ck3-localization',
                    });
                }
            }

            this.checkLocalizationKeys(child, diagnostics);
        }
    }

    /**
     * Get localization entries for a given file URI from the LocalizationIndex.
     */
    private getLocalizationEntriesForFile(uri: string): import('../../core/localization-index').LocalizationEntry[] {
        if (!this.localizationIndex) return [];
        // The LocalizationIndex stores entries keyed by localization key.
        // We need to filter entries whose fileUri matches.
        const allKeys = this.localizationIndex.getKeys();
        const entries: import('../../core/localization-index').LocalizationEntry[] = [];
        for (const key of allKeys) {
            const entry = this.localizationIndex.findLocalization(key);
            if (entry && entry.fileUri === uri) {
                entries.push(entry);
            }
        }
        return entries;
    }
}

/**
 * Create a diagnostic
 */
export function createDiagnostic(
    range: Range,
    message: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    code?: string,
    source: string = 'ck3'
): Diagnostic {
    return {
        severity,
        range,
        message,
        code,
        source,
    };
}
