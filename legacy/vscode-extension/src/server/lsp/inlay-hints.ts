/**
 * Inlay Hints Provider - inline annotations from the engine (pychivalry-engine)
 *
 * Features:
 * - Scope types from the engine's resolver (`resolveScopes`, on the game's own `script_docs`
 *   data in the spec package): the type after each step of a scope chain
 *   (`root.primary_title.holder` → `: character` `: landed_title` `: character`, setting
 *   showChainTypes), the element type of an iterator (`every_vassal: character`,
 *   showIteratorTypes) and the type a `save_scope_as` saves (showScopeTypes). A step whose
 *   type the resolver does not know gets no hint: nothing is guessed.
 * - Saved scopes: a `scope:x` reference shows where the engine index found the matching save
 *   (file and line).
 * - Parameter names for block-form keywords, read from the engine doc string's usage example.
 * - Variable type hints (inferred from the values set in this document).
 */

import { InlayHint, InlayHintKind, MarkupKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    ASTNode,
    ChainResolution,
    CK3Parser,
    NodeType,
    resolveScopes,
    ScopeResolution,
    SymbolType,
    uriToPath,
    Workspace,
} from 'pychivalry-engine';
import { docParameters } from './keyword-docs';

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

    // Scope types of the document being hinted (undefined when resolution failed)
    private scopes: ScopeResolution | undefined;

    constructor(
        private parser: CK3Parser,
        private workspace: Workspace
    ) {}

    /**
     * Update settings for inlay hints
     */
    public updateSettings(settings: Partial<InlayHintSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Provide inlay hints
     */
    public async provideInlayHints(document: TextDocument, range: Range): Promise<InlayHint[]> {
        const parsed = this.parser.parse(document.getText());
        const hints: InlayHint[] = [];

        // Reset variable type cache for this document
        this.variableTypes.clear();

        // First pass: collect variable type information
        this.collectVariableTypes(parsed.ast);
        this.scopes = this.resolve(document, parsed.ast);

        // Second pass: collect hints
        this.collectInlayHints(parsed.ast, hints, range, document);

        return hints;
    }

    /** The engine's scope types for the document, or undefined. */
    private resolve(document: TextDocument, ast: ASTNode): ScopeResolution | undefined {
        const { showScopeTypes, showChainTypes, showIteratorTypes } = this.settings;
        if (!showScopeTypes && !showChainTypes && !showIteratorTypes) {
            return undefined;
        }
        const file = uriToPath(document.uri);
        return resolveScopes({
            spec: this.workspace.spec,
            workspace: this.workspace,
            file: this.workspace.relativePath(file),
            uri: document.uri,
            ast,
        });
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
                    value: `**Scope Type:** \`${data.detail}\`\n\nThis scope can be referenced later in effects and triggers.`,
                };
            } else if (data.type === 'scope-type' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Scope type:** \`${data.detail}\`\n\nFrom the game's own scope documentation (\`script_docs\`).`,
                };
            } else if (data.type === 'chain' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Saved scope:** ${data.detail}`,
                };
            } else if (data.type === 'variable' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: `**Variable Type:** \`${data.detail}\`\n\nInferred from variable usage.`,
                };
            } else if (data.type === 'parameter' && data.detail) {
                hint.tooltip = {
                    kind: MarkupKind.Markdown,
                    value: data.detail,
                };
            }
        }

        return hint;
    }

    /**
     * Collect variable types from AST (first pass)
     */
    private collectVariableTypes(node: ASTNode): void {
        if (!node.children) {
            return;
        }

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
        let varValue: ASTNode['value'] = undefined;

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
                        confidence: 0.9,
                    });
                }
            }
        }
    }

    /**
     * Infer variable type from value
     */
    private inferVariableType(value: ASTNode['value']): VariableTypeInfo {
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
        if (!node.children) {
            return;
        }

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

            // Iterator element types (`every_vassal: character`)
            if (this.settings.showIteratorTypes) {
                this.addIteratorHints(child, hints);
            }

            // Scope type after each step of a chain (`root.primary_title: landed_title`)
            if (this.settings.showChainTypes) {
                this.addChainTypeHints(child, hints);
            }

            // Recurse
            if (child.children) {
                this.collectInlayHints(child, hints, range, document);
            }
        }
    }

    /**
     * Saved scopes: `save_scope_as = x` shows the type it saves (the scope type where it is
     * written), or `scope` when the resolver does not know it.
     */
    private addScopeHints(node: ASTNode, hints: InlayHint[]): void {
        if (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') {
            if (typeof node.value === 'string') {
                const type = this.scopes?.nodeFrames.get(node)?.this ?? 'scope';
                const hint: InlayHint = {
                    position: node.range.end,
                    label: `: ${type}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: true,
                    data: { type: 'scope', detail: type },
                };
                hints.push(hint);
            }
        }
    }

    /** Iterators: the element type of the list (`every_held_title: landed_title`). */
    private addIteratorHints(node: ASTNode, hints: InlayHint[]): void {
        const element = this.scopes?.iterators.get(node);
        if (element === undefined) {
            return;
        }
        hints.push({
            position: (node.keyRange ?? node.range).end,
            label: `: ${element}`,
            kind: InlayHintKind.Type,
            paddingLeft: true,
            data: { type: 'scope-type', detail: element },
        });
    }

    /** The type after each step of a key or value chain, where the resolver knows it. */
    private addChainTypeHints(node: ASTNode, hints: InlayHint[]): void {
        const key = this.scopes?.keyChains.get(node);
        if (key && node.key) {
            this.pushStepHints(key, (node.keyRange ?? node.range).start, hints);
        }
        const value = this.scopes?.valueChains.get(node);
        if (value && node.valueRange) {
            this.pushStepHints(value, node.valueRange.start, hints);
        }
    }

    private pushStepHints(
        chain: ChainResolution,
        start: ASTNode['range']['start'],
        hints: InlayHint[]
    ): void {
        let offset = 0;
        chain.steps.forEach((step, i) => {
            offset += step.segment.length + (i > 0 ? 1 : 0);
            if (step.type === undefined) {
                return;
            }
            hints.push({
                position: { line: start.line, character: start.character + offset },
                label: `: ${step.type}`,
                kind: InlayHintKind.Type,
                paddingLeft: false,
                data: { type: 'scope-type', detail: step.type },
            });
        });
    }

    /**
     * Saved-scope references: `scope:x` (as a key or a value) resolved against the engine
     * index's saved scopes. The hint names where `x` is saved (its type, when the resolver
     * knows it, is the chain type hint).
     */
    private addChainHints(node: ASTNode, hints: InlayHint[]): void {
        const refs: Array<{ name: string; at: ASTNode['range']['end'] }> = [];
        if (node.key && node.key.startsWith('scope:')) {
            refs.push({
                name: node.key.slice(6).split('.')[0],
                at: (node.keyRange ?? node.range).end,
            });
        }
        if (typeof node.value === 'string' && node.value.startsWith('scope:')) {
            refs.push({ name: node.value.slice(6).split('.')[0], at: node.range.end });
        }
        for (const ref of refs) {
            const saved = this.workspace.index
                .findSymbolsByName(ref.name)
                .find((s) => s.type === SymbolType.SCOPE);
            if (!saved) {
                continue;
            }
            const file = saved.uri.split('/').pop() ?? saved.uri;
            const where = `${file}:${saved.range.start.line + 1}`;
            hints.push({
                position: ref.at,
                label: ` ⇐ ${where}`,
                kind: InlayHintKind.Type,
                paddingLeft: true,
                data: { type: 'chain', detail: `saved with save_scope_as in ${where}` },
            });
        }
    }

    /**
     * Parameter name hints for block-form keywords: the parameter order of the usage
     * example in the keyword's engine doc string.
     */
    private addParameterHints(node: ASTNode, hints: InlayHint[]): void {
        if (!node.key || !node.children) {
            return;
        }
        const spec = this.workspace.spec;
        const bucket = spec.has(node.key, 'effects')
            ? 'effects'
            : spec.has(node.key, 'triggers')
              ? 'triggers'
              : undefined;
        if (!bucket) {
            return;
        }
        const params = docParameters(spec.doc(node.key, bucket), node.key);
        if (params.length === 0) {
            return;
        }
        let paramIndex = 0;
        for (const child of node.children) {
            if (paramIndex < params.length && child.type === NodeType.ASSIGNMENT) {
                if (child.key !== params[paramIndex]) {
                    hints.push({
                        position: child.range.start,
                        label: `${params[paramIndex]}:`,
                        kind: InlayHintKind.Parameter,
                        paddingRight: true,
                        data: { type: 'parameter', detail: `Parameter: ${params[paramIndex]}` },
                    });
                }
                paramIndex++;
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
                        data: { type: 'variable', detail: typeInfo.type },
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
                    data: { type: 'variable', detail: typeInfo.type },
                };
                hints.push(hint);
            }
        }
    }
}
